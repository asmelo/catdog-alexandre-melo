import type { AnimalImage, PrismaClient } from '@prisma/client';

import { animalNameKey } from '~/domains/animals/animal-name';
import { normalizeForSearch } from '~/utils/text-normalizer';
import {
  AnimalNotFoundError,
  AnimalStaleUpdateError,
  CityNotFoundError,
} from '~/domains/animals/errors/animal.errors';
import {
  AnimalImageLimitExceededError,
  AnimalImageNotFoundError,
} from '~/domains/animals/errors/animal-image.errors';
import {
  toAnimalResponse,
  type AnimalResponse,
  type PublicAnimalSex,
  type PublicAnimalSize,
} from '~/domains/animals/mappers/animal.mapper';
import type {
  AnimalRepository,
  AnimalWithRelations,
  CreateAnimalImageData,
  UpdateAnimalData,
} from '~/domains/animals/repositories/animal.repository';
import {
  PORTE_PERSISTIDO,
  SEXO_PERSISTIDO,
} from '~/domains/animals/services/create-animal.service';
import type {
  AnimalImageUpload,
  StoreAnimalImagesService,
  StoredAnimalImage,
} from '~/domains/animals/services/store-animal-images.service';
import type { StateRepository } from '~/domains/geography/repositories/state.repository';
import { SpeciesNotFoundError } from '~/domains/species/errors/species.errors';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';
import { MAX_IMAGES_PER_ANIMAL } from '~/infra/upload/upload-limits';
import { now } from '~/utils/clock';

/**
 * HU-06 — edicao do animal (RN-06, RN-35, RN-36, RN-47, RN-48, RN-50).
 *
 * O molde e o `create-animal.service.ts`: mesma injecao, mesma transacao curta,
 * mesmo pipeline de imagens fora dela. O que a edicao acrescenta sao DOIS
 * mecanismos que o cadastro nao tem, e as duas metades deste arquivo sao eles:
 *
 * 1. BLOQUEIO OTIMISTA por `updatedAt` (RN-47). Quem grava devolve a marca que
 *    leu, e a gravacao so acontece se o registro ainda estiver naquela marca. Sem
 *    a guarda, a segunda de duas gravacoes concorrentes apaga a primeira sem que
 *    ninguem perceba — e a situacao nao e hipotetica: o mesmo animal e editavel
 *    pelo formulario e alteravel pela listagem ao mesmo tempo, em abas
 *    diferentes.
 * 2. RECONCILIACAO DE IMAGENS por `keepImageIds` (RN-35, RN-36, RN-50). A lista
 *    diz quais imagens permanecem E em que ordem; o que nao esta nela deixa de
 *    existir, no banco e no armazenamento.
 *
 * A ORDEM DOS DOIS EFEITOS EXTERNOS e a parte delicada, e ela e assimetrica de
 * proposito:
 *
 * - as imagens NOVAS sobem ANTES da transacao, como no cadastro, porque cada
 *   objeto custa ate 20 s de rede e uma transacao aberta durante isso seguraria a
 *   conexao do pooler. Falha no envio compensa aquele envio e propaga, sem tocar
 *   no banco (RN-39);
 * - os objetos das imagens REMOVIDAS so sao apagados DEPOIS do commit. Apagados
 *   antes, uma transacao desfeita deixaria o registro apontando para um objeto
 *   que ja nao existe — e um animal com foto quebrada e pior do que um objeto
 *   orfao invisivel, que nenhuma tela exibe (RN-40).
 */

/**
 * Pedido de edicao JA validado e JA normalizado por `updateAnimalBodySchema`.
 *
 * `id` vem do CAMINHO e nao do corpo (RN-06): o identificador do animal e
 * estavel, e nao ha campo de entrada por onde a edicao pudesse renomear o recurso
 * que ela edita.
 *
 * `expectedUpdatedAt` e o token de concorrencia lido no `GET` — ja uma `Date`,
 * porque o schema o converteu. `status` nao existe nesta forma (RN-16), e
 * `stateId` tampouco (RN-26a), pelas mesmas razoes do cadastro.
 */
export interface UpdateAnimalInput {
  readonly id: string;
  readonly expectedUpdatedAt: Date;
  readonly name: string;
  readonly speciesId: string;
  readonly cityId: string;
  readonly size: PublicAnimalSize;
  readonly sex: PublicAnimalSex;
  readonly birthDate: Date | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  /** Imagens gravadas que permanecem, NA ORDEM FINAL desejada (RN-35). */
  readonly keepImageIds: ReadonlyArray<string>;
  readonly images: ReadonlyArray<AnimalImageUpload>;
}

/**
 * O estado final das imagens, decidido antes de qualquer efeito: quais linhas
 * permanecem (na ordem informada) e quais deixam de existir.
 */
interface ReconciliacaoDeImagens {
  readonly mantidas: ReadonlyArray<AnimalImage>;
  readonly removidas: ReadonlyArray<AnimalImage>;
}

/**
 * `position` das imagens recem-enviadas: elas entram DEPOIS das mantidas, na
 * ordem de envio (RN-35). O deslocamento e a quantidade de mantidas — e por isso
 * que a capa continua sendo a primeira da lista do administrador mesmo quando ele
 * envia fotos novas na mesma gravacao.
 */
function comoLinhasDeImagem(
  gravadas: ReadonlyArray<StoredAnimalImage>,
  deslocamento: number,
): ReadonlyArray<CreateAnimalImageData> {
  return gravadas.map((imagem, indice) => ({
    id: imagem.imageId,
    storagePath: imagem.objectPath,
    position: deslocamento + indice,
    contentType: imagem.contentType,
    sizeBytes: imagem.sizeBytes,
  }));
}

export class UpdateAnimalService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly species: SpeciesRepository,
    private readonly geography: StateRepository,
    private readonly images: StoreAnimalImagesService,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * A ORDEM DOS PASSOS E CONTRATO, e cada um esta onde esta por uma razao:
   *
   * 1. LEITURA do animal. Ausente ⇒ `404` (RN-44), e nenhum dos passos seguintes
   *    faz sentido sem ela: e desta leitura que saem as imagens gravadas contra as
   *    quais `keepImageIds` e conferido.
   * 2. RECONCILIACAO das imagens, que tambem CONFERE a pertinencia de cada
   *    identificador (CT-62). Vem antes do limite porque um identificador alheio
   *    torna a propria aritmetica do limite sem sentido — nao se sabe quantas
   *    imagens permaneceriam.
   * 3. LIMITE sobre o ESTADO FINAL (RN-50), e nao sobre o envio: 3 gravadas + 3
   *    novas somam 6 e sao recusadas; 5 gravadas menos 3 removidas + 3 novas
   *    voltam a 5 e sao aceitas (CT-48, CT-49a, CT-49b). Recusar aqui evita ler
   *    seis arquivos e consultar o banco duas vezes para responder o que ja se
   *    sabia.
   * 4. ESPECIE e 5. CIDADE, ANTES de tocar no armazenamento. Falhar depois do
   *    envio significaria compensar objetos que nunca precisariam ter subido.
   * 6. ENVIO das imagens novas, fora da transacao.
   * 7. GRAVACAO em UMA transacao, comecando pela atualizacao condicional.
   * 8. REMOCAO dos objetos das imagens removidas, DEPOIS do commit.
   *
   * Os passos 2 e 3 nao tocam o banco nem a rede: eles trabalham sobre o animal ja
   * lido no passo 1.
   */
  async execute(entrada: UpdateAnimalInput): Promise<AnimalResponse> {
    const atual = await this.animals.findById(entrada.id);

    if (atual === null) {
      throw new AnimalNotFoundError();
    }

    const reconciliacao = reconciliarImagens(atual, entrada.keepImageIds);

    /**
     * A MESMA comparacao do cadastro, com uma parcela a mais. No cadastro o
     * estado final E o proprio envio, porque nao ha imagem gravada a somar; aqui
     * ele e "as que ficam" mais "as que chegam". A regra e uma so (RN-50) e por
     * isso o limite mora em `upload-limits.ts`, e nao em literais locais.
     */
    if (
      reconciliacao.mantidas.length + entrada.images.length >
      MAX_IMAGES_PER_ANIMAL
    ) {
      throw new AnimalImageLimitExceededError();
    }

    await this.exigirEspecie(entrada.speciesId);
    await this.exigirCidade(entrada.cityId);

    const enviadas = await this.images.execute(entrada.id, entrada.images);

    const atualizado = await this.persistir(entrada, reconciliacao, enviadas).catch(
      async (motivo: unknown) => {
        /**
         * RN-39 e RN-48 — o banco desfaz a transacao sozinho; o armazenamento
         * nao. Alcanca TODAS as saidas de falha da transacao, e as duas que
         * importam sao as proprias do bloqueio otimista: recusada a gravacao por
         * conflito (`409`) ou por o animal ter sumido (`404`), NADA e alterado e
         * nenhum objeto daquele envio permanece no balde.
         *
         * As imagens REMOVIDAS nao entram aqui: os objetos delas ainda nao foram
         * tocados neste ponto — e exatamente por isso que a remocao acontece
         * depois do commit.
         */
        await this.images.compensar(
          enviadas.map((imagem) => imagem.objectPath),
          'envioDesfeito',
        );

        throw motivo;
      },
    );

    /**
     * RN-36 e RN-40 — SO AGORA, com o commit ja feito.
     *
     * Reusa `compensar` porque a operacao e literalmente a mesma e a tolerancia a
     * falha e a mesma: remove a lista e, se a remocao falhar, registra a pendencia
     * de limpeza no log SEM propagar. O registro da imagem ja nao existe, entao
     * nenhuma tela do produto aponta para o objeto remanescente, e derrubar aqui
     * uma edicao ja gravada faria o administrador ver um erro sobre uma faxina que
     * ele nao pediu.
     */
    await this.images.compensar(
      reconciliacao.removidas.map((imagem) => imagem.storagePath),
      'imagensSubstituidas',
    );

    /**
     * A MESMA projecao da leitura, com o `updatedAt` NOVO — que e o token que o
     * cliente precisa para a proxima gravacao (RN-47). Sem devolve-lo, a segunda
     * edicao seguida na mesma tela responderia `409` contra uma alteracao que o
     * proprio administrador acabou de fazer.
     */
    return toAnimalResponse(atualizado, now());
  }

  /**
   * RN-08 — identico ao cadastro, e deliberadamente o MESMO erro: uma especie
   * inexistente responde igual, venha a pergunta do cadastro ou da edicao.
   */
  private async exigirEspecie(speciesId: string): Promise<void> {
    if ((await this.species.findById(speciesId)) === null) {
      throw new SpeciesNotFoundError();
    }
  }

  /** RN-26 — a cidade e resolvida por `id`, JAMAIS por nome (CT-11). */
  private async exigirCidade(cityId: string): Promise<void> {
    if ((await this.geography.findCityById(cityId)) === null) {
      throw new CityNotFoundError();
    }
  }

  /**
   * A GRAVACAO INTEIRA em UMA transacao, comecando pela atualizacao condicional.
   *
   * A ATUALIZACAO CONDICIONAL VEM PRIMEIRO, e a posicao e a razao de ela estar
   * aqui e nao no fim: e ela que trava a linha do animal e que decide se a
   * gravacao acontece. Deixada para o final, as remocoes e reposicionamentos de
   * imagem seriam executados para em seguida serem desfeitos, e a linha do animal
   * ficaria destravada durante todo esse tempo — uma segunda gravacao concorrente
   * poderia entrar no meio.
   *
   * Recusada a condicao, o `throw` DENTRO da transacao e o que desfaz tudo: sem
   * ele, as linhas de imagem ja gravadas seriam confirmadas para um animal cujos
   * campos nao mudaram (RN-48).
   */
  private async persistir(
    entrada: UpdateAnimalInput,
    reconciliacao: ReconciliacaoDeImagens,
    enviadas: ReadonlyArray<StoredAnimalImage>,
  ): Promise<AnimalWithRelations> {
    return this.prisma.$transaction(
      async (tx) => {
        const repositorio = this.animals.withTransaction(tx);

        const alteradas = await repositorio.updateIfUnchanged(
          entrada.id,
          entrada.expectedUpdatedAt,
          comoLinhaDeAnimal(entrada),
        );

        if (alteradas === 0) {
          throw await conflitoOuAusencia(repositorio, entrada.id);
        }

        await repositorio.deleteImagesByIds(
          reconciliacao.removidas.map((imagem) => imagem.id),
        );

        await reposicionar(repositorio, reconciliacao.mantidas);

        await repositorio.createImages(
          entrada.id,
          comoLinhasDeImagem(enviadas, reconciliacao.mantidas.length),
        );

        /**
         * RELIDO, e nao montado em memoria — ao contrario do cadastro, e a
         * diferenca tem duas causas:
         *
         * 1. As RELACOES podem ter mudado. A edicao troca `speciesId` e `cityId`,
         *    e o animal lido no inicio ainda carrega a especie e a cidade
         *    ANTIGAS. Montar a resposta a partir dele devolveria "Cachorro" logo
         *    depois de o administrador ter gravado "Gato".
         * 2. A ORDEM das imagens sai pronta e correta: esta releitura passa pelo
         *    `include` com `orderBy: { position: 'asc' }` do repositorio, entao
         *    nao ha `sort` a fazer aqui. O cadastro precisa do `sort` explicito
         *    justamente porque as linhas dele vem do `RETURNING` do
         *    `createManyAndReturn`, cuja ordem o padrao SQL nao promete.
         *
         * Uma ida a mais ao banco, dentro de uma transacao que ja e curta e sem
         * nenhuma ida a rede externa.
         */
        const atualizado = await repositorio.findById(entrada.id);

        if (atualizado === null) {
          /**
           * Inalcancavel: a linha acabou de ser atualizada NESTA transacao. O
           * `throw` existe porque `findById` devolve `null` no tipo, e "nao
           * encontrado" e a unica resposta honesta se o impossivel acontecer.
           */
          throw new AnimalNotFoundError();
        }

        return atualizado;
      },
      {
        /**
         * Mesmos prazos do cadastro, pela mesma razao: o `DATABASE_URL` usa o
         * pooler do Supabase com `connection_limit=1`, e o `maxWait` default de
         * 2 s do Prisma faz uma gravacao legitima virar `P2028` (500) sob
         * concorrencia modesta — que e exatamente o cenario que o bloqueio
         * otimista existe para atender.
         */
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
}

/** Traducao do vocabulario publico para as colunas, sem `id` (RN-06). */
function comoLinhaDeAnimal(entrada: UpdateAnimalInput): UpdateAnimalData {
  return {
    name: entrada.name,

    /**
     * DERIVADO na escrita, exatamente como no cadastro (RN-41): e chave de
     * ordenacao, detalhe de persistencia que nao aparece no contrato de API.
     * Regravado a cada edicao porque o nome pode ter mudado — deixa-lo para tras
     * faria o animal renomeado continuar ordenado pelo nome antigo.
     */
    nameNormalized: animalNameKey(entrada.name),

    /**
     * REGRAVADO a cada edicao, pelo mesmo motivo do `nameNormalized` acima: o nome
     * pode ter mudado, e deixar a chave de busca para tras faria o animal
     * renomeado continuar sendo encontrado pelo nome antigo — e deixar de ser
     * encontrado pelo novo (RN-23, CT-132).
     */
    nameSearch: normalizeForSearch(entrada.name),

    speciesId: entrada.speciesId,
    cityId: entrada.cityId,
    size: PORTE_PERSISTIDO[entrada.size],
    sex: SEXO_PERSISTIDO[entrada.sex],
    birthDate: entrada.birthDate,
    description: entrada.description,
    acceptsOtherAnimals: entrada.acceptsOtherAnimals,
    needsLargeSpace: entrada.needsLargeSpace,
  };
}

/**
 * A DISTINCAO ENTRE `404` E `409`, que a contagem sozinha nao faz (CT-64).
 *
 * `count === 0` significa que o `WHERE id = ? AND updated_at = ?` nao casou, e
 * ha exatamente duas causas: o registro MUDOU ou o registro SUMIU. Uma releitura
 * por `id` separa as duas — ausente e `404 ANIMAL_NOT_FOUND`, presente e
 * `409 ANIMAL_STALE_UPDATE` —, e as duas respostas levam a interface a caminhos
 * diferentes: recarregar o formulario contra a versao atual, ou voltar para a
 * listagem porque o animal ja nao existe. Responder sempre `409` mandaria o
 * administrador recarregar um animal excluido.
 *
 * A releitura acontece DENTRO da transacao e enxerga o estado ja confirmado por
 * quem gravou antes: o Postgres opera em READ COMMITTED por padrao, entao cada
 * comando ve um instantaneo novo, e nao o do inicio da transacao.
 *
 * Devolve o erro em vez de lanca-lo para que o ponto de uso continue sendo um
 * `throw` visivel — quem le `persistir` ve onde a transacao termina.
 *
 * EXPORTADO desde a TASK-BACKEND-009: a alteracao de status tem a MESMA
 * atualizacao condicional e portanto a mesma ambiguidade a desfazer, e
 * `change-animal-status.service.ts` importa esta funcao em vez de reescreve-la.
 * Mesmo precedente de `PORTE_PERSISTIDO`/`SEXO_PERSISTIDO`, que a edicao importa
 * do cadastro: duas copias divergiriam, e a divergencia apareceria como um `409`
 * mandando o administrador recarregar um animal que ja nao existe.
 *
 * A funcao recebe o REPOSITORIO por parametro e nao le nada de fora: e por isso
 * que ela serve tanto ao caminho da edicao, que a chama com a porta ligada a
 * transacao, quanto ao da alteracao de status, que a chama com a porta comum.
 */
export async function conflitoOuAusencia(
  repositorio: AnimalRepository,
  id: string,
): Promise<AnimalNotFoundError | AnimalStaleUpdateError> {
  const aindaExiste = await repositorio.findById(id);

  return aindaExiste === null ? new AnimalNotFoundError() : new AnimalStaleUpdateError();
}

/**
 * RN-35 — `position` sequencial a partir de ZERO, na ordem de `keepImageIds`. A
 * primeira e a capa, e e por isso que inverter a lista no formulario troca a
 * miniatura da listagem (CT-60, CT-61).
 *
 * SO GRAVA O QUE MUDOU. A edicao que nao reordena nada — o caso comum — nao emite
 * nenhum `UPDATE`, e a que remove a capa de um animal de cinco fotos emite
 * quatro. Sao no maximo cinco linhas de qualquer forma; o ganho real e nao ocupar
 * a transacao com escritas que nao alteram nada.
 *
 * SEQUENCIAL e nao concorrente, ao contrario do envio ao armazenamento: aqui nao
 * ha rede externa, sao comandos na MESMA transacao, e um `Promise.all` sobre a
 * mesma conexao apenas os enfileiraria com menos previsibilidade.
 */
async function reposicionar(
  repositorio: AnimalRepository,
  mantidas: ReadonlyArray<AnimalImage>,
): Promise<void> {
  for (const [posicao, imagem] of mantidas.entries()) {
    if (imagem.position !== posicao) {
      await repositorio.updateImagePosition(imagem.id, posicao);
    }
  }
}

/**
 * Decide o estado final das imagens ANTES de qualquer efeito, e confere a
 * pertinencia de cada identificador ao animal (RN-36, CT-62).
 *
 * A CONFERENCIA E CONTRA AS IMAGENS DESTE ANIMAL, e nao contra a tabela: um
 * identificador valido de imagem ALHEIA nao esta no mapa e e recusado como
 * `400` apontando `keepImageIds` — nunca `404`, porque o recurso da requisicao e
 * o animal, que existe.
 *
 * As imagens vem da leitura que abriu o caso de uso, e nao de uma segunda
 * consulta dentro da transacao. Nada pode te-las alterado entre uma coisa e outra
 * sem que a marca de alteracao do ANIMAL tivesse mudado junto: toda alteracao de
 * imagem do produto acontece por este mesmo caso de uso ou pela exclusao do
 * animal, e as duas passam pela linha de `animals`. Se algo assim tiver
 * acontecido, a atualizacao condicional recusa a gravacao inteira com `409`.
 *
 * A ORDEM DE `mantidas` E A DE `keepImageIds`, e nao a ordem gravada: e a lista do
 * administrador que define a ordem final. `removidas` sai na ordem gravada, que e
 * indiferente — ninguem a observa.
 */
function reconciliarImagens(
  animal: AnimalWithRelations,
  keepImageIds: ReadonlyArray<string>,
): ReconciliacaoDeImagens {
  const porIdentificador = new Map(animal.images.map((imagem) => [imagem.id, imagem]));
  const mantidas: AnimalImage[] = [];

  for (const identificador of keepImageIds) {
    const imagem = porIdentificador.get(identificador);

    if (imagem === undefined) {
      throw new AnimalImageNotFoundError();
    }

    mantidas.push(imagem);
  }

  const permanecem = new Set(keepImageIds);

  return {
    mantidas,
    removidas: animal.images.filter((imagem) => !permanecem.has(imagem.id)),
  };
}
