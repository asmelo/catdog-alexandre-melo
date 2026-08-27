import { AnimalNotFoundError } from '~/domains/animals/errors/animal.errors';
import type { AnimalRepository } from '~/domains/animals/repositories/animal.repository';
import type { StoreAnimalImagesService } from '~/domains/animals/services/store-animal-images.service';

/**
 * HU-08 — exclusao definitiva do animal (RN-10, RN-37, RN-40, RN-44, RN-45,
 * RN-55).
 *
 * A EXCLUSAO E DEFINITIVA: nao ha coluna de exclusao logica, nao ha copia em
 * outra tabela, nao ha lixeira e nao ha recuperacao pela aplicacao (RN-45). Quem
 * quer apenas tirar o animal da vitrine sem perder o cadastro tem o status
 * Indisponivel, que e uma operacao diferente, com endpoint proprio.
 *
 * TRES efeitos, em bancos de dados diferentes e com garantias diferentes — e a
 * assimetria entre eles e o assunto deste arquivo:
 *
 * 1. a linha de `animals` e apagada, e essa e a operacao que o `204` afirma ter
 *    acontecido;
 * 2. as linhas de `animal_images` vao junto, pela CASCATA declarada no schema
 *    (RN-55). Nao ha `DELETE` de imagem escrito aqui, e escrever um duplicaria em
 *    codigo uma garantia que ja esta no banco — duas regras que precisariam ser
 *    mantidas iguais para sempre;
 * 3. os OBJETOS no armazenamento sao removidos DEPOIS, e a remocao NAO participa
 *    de nada: ela pode falhar sem alterar a resposta (RN-40).
 *
 * A cascata apaga as LINHAS, jamais os OBJETOS. O banco nao conhece o balde, e um
 * animal excluido cujas imagens ficassem no armazenamento sem ninguem as remover
 * seria lixo permanente — e por isso que o passo 3 existe, e por isso que ele
 * precisa dos caminhos coletados ANTES do passo 1.
 */

/**
 * O `id` chega JA validado como UUID por `animalIdParamsSchema`; o service nao
 * revalida formato, como em `GetAnimalService`.
 *
 * NAO ha token de bloqueio otimista nesta forma, e a ausencia e do contrato: o
 * `DELETE` nao aceita corpo. A guarda que a RN-47 pede na edicao e na alteracao
 * de status protege contra sobrescrever a decisao de outra pessoa; aqui a decisao
 * e "este animal nao deve mais existir", e ela nao fica errada porque o nome
 * mudou nesse meio-tempo. O que a exclusao precisa distinguir e apenas se o
 * registro ainda existe, e disso a contagem do `deleteById` da conta.
 */
export interface DeleteAnimalInput {
  readonly id: string;
}

export class DeleteAnimalService {
  /**
   * Depende do `StoreAnimalImagesService` e nao do `ImageStoragePort` direto,
   * ainda que o unico metodo usado aqui seja uma remocao.
   *
   * O motivo e a POLITICA e nao a chamada: `compensar` e o ponto unico do projeto
   * onde "remover objetos, engolir a falha e registrar a pendencia de limpeza"
   * esta escrito (RN-40). Chamar `storage.remove(...)` daqui obrigaria a repetir o
   * `catch` e a frase de log, e a segunda copia divergiria da primeira — e a
   * divergencia seria justamente numa falha que ninguem observa em teste manual,
   * porque ela nao muda a resposta.
   */
  constructor(
    private readonly animals: AnimalRepository,
    private readonly images: StoreAnimalImagesService,
  ) {}

  /**
   * A ORDEM DOS TRES PASSOS E CONTRATO, e o primeiro e o mais facil de errar:
   *
   * 1. LER o animal e COLETAR os `storagePath` das suas imagens. A leitura precisa
   *    vir ANTES do `DELETE`, e nao por eficiencia: depois da cascata as linhas de
   *    `animal_images` deixaram de existir, e com elas a UNICA informacao de quais
   *    objetos pertenciam aquele animal. Coletados depois, os caminhos seriam
   *    sempre uma lista vazia e cada exclusao deixaria ate cinco objetos orfaos no
   *    balde, em silencio — o defeito nao alteraria nenhuma resposta e nao
   *    apareceria em nenhum teste de API.
   * 2. APAGAR a linha do animal. A contagem decide o `404` (ver abaixo).
   * 3. REMOVER os objetos, tolerando falha (RN-40).
   *
   * Sem transacao: o passo 2 e a UNICA escrita no banco — a cascata e do proprio
   * `DELETE` —, e um comando so ja e atomico. Envolve-lo numa transacao interativa
   * custaria mais uma ida ao pooler de `connection_limit=1` do Supabase sem tornar
   * nada mais atomico.
   *
   * A ESPECIE e a CIDADE nao sao tocadas em nenhum dos tres passos, e nao ha
   * codigo a escrever para isso: os dois vinculos apontam do animal PARA elas e
   * sao RESTRITIVOS (RN-09, RN-29), entao apagar o animal apenas remove a
   * referencia. A especie continua cadastrada e inalterada, ainda que fique sem
   * nenhum animal (RN-10, CT-80, CA-35) — e e exatamente essa exclusao que passa a
   * permitir excluir a especie que so ela classificava (CT-83).
   */
  async execute(entrada: DeleteAnimalInput): Promise<void> {
    const animal = await this.animals.findById(entrada.id);

    /**
     * O `null` do repositorio vira erro de dominio AQUI e nao la: a porta de
     * persistencia nunca lanca erro HTTP. A mensagem nao distingue "nunca existiu"
     * de "ja foi excluido" (RN-44, CT-78).
     */
    if (animal === null) {
      throw new AnimalNotFoundError();
    }

    /**
     * A coleta acontece com as linhas AINDA existindo. `storagePath` e a coluna, e
     * nao a URL publica: e o caminho que o armazenamento entende, e o endereco
     * publico so e derivado dele quando uma resposta e montada (ver
     * `buildPublicObjectUrl`, no mapper).
     *
     * Animal sem imagem devolve `[]`, que e um estado legitimo (RN-30): `compensar`
     * sai sem tocar a rede nesse caso.
     */
    const caminhos = animal.images.map((imagem) => imagem.storagePath);

    const excluidos = await this.animals.deleteById(entrada.id);

    /**
     * A SEGUNDA guarda de ausencia, e ela nao e redundante com a primeira: entre a
     * leitura acima e este comando, outra pessoa pode ter excluido o mesmo animal.
     * Sem esta conferencia, o segundo administrador receberia `204` por uma
     * exclusao que ele nao realizou — e, pior, o passo 3 tentaria remover objetos
     * que o primeiro ja removeu, registrando uma pendencia de limpeza inexistente.
     *
     * A contagem e a fonte da verdade porque ela vem do proprio `DELETE`, e nao de
     * uma leitura anterior a ele (RN-44, HU-08 cenario 5).
     */
    if (excluidos === 0) {
      throw new AnimalNotFoundError();
    }

    /**
     * RN-37 e RN-40 — SO AGORA, com o registro ja apagado.
     *
     * A FALHA AQUI NAO REVERTE NADA e nao altera a resposta: o `compensar` engole a
     * rejeicao e registra os caminhos remanescentes como pendencia de limpeza, e a
     * requisicao segue para o `204` (CT-79). E a assimetria deliberada da RN-40 —
     * o registro ja nao existe, portanto nenhum ponto do produto exibe aquela
     * imagem, e o produto prefere um arquivo orfao invisivel a uma exclusao que
     * falha para o administrador por causa de uma faxina que ele nao pediu.
     *
     * O sentido oposto — remover os objetos ANTES do `DELETE` — foi descartado
     * pelo mesmo motivo ja registrado na edicao: uma remocao bem-sucedida seguida
     * de um `DELETE` que falhasse deixaria o animal vivo com todas as fotos
     * quebradas, e um animal com foto quebrada e pior do que um objeto orfao que
     * ninguem enxerga.
     */
    await this.images.compensar(caminhos, 'animalExcluido');
  }
}
