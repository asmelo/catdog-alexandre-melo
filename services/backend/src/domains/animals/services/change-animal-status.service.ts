import { AnimalStatus } from '@prisma/client';

import { AnimalNotFoundError } from '~/domains/animals/errors/animal.errors';
import {
  toAnimalResponse,
  type AnimalResponse,
  type PublicAnimalStatus,
} from '~/domains/animals/mappers/animal.mapper';
import type { AnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { conflitoOuAusencia } from '~/domains/animals/services/update-animal.service';
import { now } from '~/utils/clock';

/**
 * HU-07 — alteracao do status do animal pela listagem (RN-15, RN-16, RN-44,
 * RN-47, RN-48).
 *
 * OPERACAO PROPRIA, e nao um ramo do `UpdateAnimalService` (RN-16). O conjunto de
 * campos e disjunto do restante do animal: aqui entram `status` e o token de
 * concorrencia, e nada mais. Misturar as duas gramaticas num unico caso de uso
 * obrigaria ele a decidir, a cada chamada, qual delas se aplica — e a decisao
 * teria de ser tomada a partir de quais campos vieram, que e exatamente o tipo de
 * regra que produz "o status foi alterado porque o nome nao veio".
 *
 * O QUE ESTE SERVICE NAO FAZ, e cada ausencia e deliberada:
 *
 * - NAO valida transicao. Qualquer um dos doze pares entre os quatro status e
 *   aceito, sem ordem obrigatoria e sem confirmacao (RN-15, CT-70, CA-31). A
 *   alternativa considerada — exigir passagem por Reservado antes de Adotado —
 *   foi descartada POR ENQUANTO porque o modulo de pedidos nao existe: nada
 *   coloca um animal em Reservado automaticamente, e a regra obrigaria o
 *   administrador a encenar uma reserva para registrar uma adocao real. Nao ha
 *   maquina de estados a escrever aqui; ela volta a mesa quando o pedido existir
 *   (RN-17, RN-17b).
 * - NAO trata "mesmo status" como caso especial. Reenviar o status que o animal ja
 *   possui responde `200` sem erro (RN-15, CT-71) — ver `execute`.
 * - NAO toca imagem, especie nem cidade. Nenhuma das tres aparece neste arquivo.
 */

/**
 * Pedido JA validado por `changeStatusBodySchema`: `status` e um dos quatro
 * literais publicos e `expectedUpdatedAt` ja e uma `Date`, convertida pelo mesmo
 * `marcaDeAlteracaoSchema` que a edicao usa. O service nao reparseia texto.
 *
 * `id` vem do CAMINHO e nao do corpo (RN-06), como na edicao.
 *
 * NENHUM outro campo do animal existe nesta forma, e essa e a RN-16 escrita no
 * tipo: nao ha por onde `name`, `speciesId` ou `cityId` entrarem, entao nao ha o
 * que este caso de uso precise lembrar de ignorar (CT-69, CA-30).
 */
export interface ChangeAnimalStatusInput {
  readonly id: string;
  readonly expectedUpdatedAt: Date;
  readonly status: PublicAnimalStatus;
}

/**
 * Traducao do vocabulario PUBLICO (minusculo, sem acento, do contrato de API)
 * para o literal do enum do banco (maiusculo).
 *
 * `Record<Publico, Enum>` e nao um `switch`, pela mesma razao de
 * `PORTE_PERSISTIDO` e `SEXO_PERSISTIDO`: acrescentar um status ao vocabulario
 * publico passa a ser erro de compilacao aqui, em vez de cair num ramo default
 * silencioso que gravaria `undefined`. E a operacao INVERSA do `STATUS_PUBLICO`
 * do mapper — cada uma no seu sentido, nenhuma reimplementando a outra.
 *
 * Mora AQUI e nao no cadastro, ao contrario dos outros dois mapas: o cadastro nao
 * escolhe status (RN-14, o animal nasce `DISPONIVEL` pelo default do schema) e a
 * edicao tampouco (RN-16). Este e o UNICO caminho de escrita do produto que grava
 * a coluna `status`, e o mapa vive junto dele.
 */
export const STATUS_PERSISTIDO: Readonly<Record<PublicAnimalStatus, AnimalStatus>> = {
  disponivel: AnimalStatus.DISPONIVEL,
  reservado: AnimalStatus.RESERVADO,
  adotado: AnimalStatus.ADOTADO,
  indisponivel: AnimalStatus.INDISPONIVEL,
};

export class ChangeAnimalStatusService {
  constructor(private readonly animals: AnimalRepository) {}

  /**
   * UMA escrita condicional e UMA releitura. Nao ha transacao, e a ausencia e
   * deliberada: a unica escrita e o proprio `UPDATE`, que ja e atomico no banco.
   * Abrir uma transacao interativa para envolver um comando so custaria mais uma
   * ida ao pooler de `connection_limit=1` do Supabase e nao tornaria nada mais
   * atomico do que ja e. A edicao precisa de transacao porque grava a linha do
   * animal, apaga imagens, reposiciona imagens e insere imagens — quatro escritas
   * que precisam viver ou morrer juntas.
   *
   * SEM `findById` ANTES da escrita, ao contrario da edicao e da exclusao. A
   * leitura previa nao teria o que decidir: nao ha imagem a reconciliar, nao ha
   * limite a somar e nao ha transicao a conferir (RN-15). Ela so acrescentaria uma
   * ida ao banco e uma JANELA — o animal poderia mudar entre a leitura e a
   * gravacao, e o `404` seria decidido sobre um estado que ja nao vale. A propria
   * atualizacao condicional ja distingue os tres desfechos, e a releitura que
   * separa `404` de `409` acontece so quando ela recusa.
   *
   * REENVIAR O STATUS ATUAL passa por aqui como qualquer outro valor e responde
   * `200` (RN-15, CT-71): o `where` casa a linha, `count` e `1` e o animal e
   * devolvido. Nao ha ramo curto-circuitando esse caso, e nao pode haver — um
   * curto-circuito responderia `200` tambem para um token VENCIDO, trocando em
   * silencio o `409` que o contrato exige por um sucesso. O unico efeito de
   * reenviar o status atual e o giro do `updatedAt`, que e o token que a proxima
   * gravacao precisa: nenhum campo de negocio do animal muda (CT-69, CA-30).
   */
  async execute(entrada: ChangeAnimalStatusInput): Promise<AnimalResponse> {
    const alteradas = await this.animals.updateStatusIfUnchanged(
      entrada.id,
      entrada.expectedUpdatedAt,
      STATUS_PERSISTIDO[entrada.status],
    );

    /**
     * A MESMA distincao da edicao, pela MESMA funcao (CT-67, CT-73, CA-39):
     * `count === 0` significa que o `WHERE id = ? AND updated_at = ?` nao casou, e
     * ha exatamente duas causas — o registro MUDOU (`409 ANIMAL_STALE_UPDATE`) ou
     * SUMIU (`404 ANIMAL_NOT_FOUND`). As duas levam a interface a caminhos
     * diferentes: recarregar a linha contra a versao atual, ou atualizar a lista
     * porque o animal ja nao existe e a linha ficou fantasma.
     */
    if (alteradas === 0) {
      throw await conflitoOuAusencia(this.animals, entrada.id);
    }

    const atualizado = await this.animals.findById(entrada.id);

    if (atualizado === null) {
      /**
       * Alcancavel apenas por uma exclusao concorrente entre o `UPDATE` que
       * acabou de acontecer e esta leitura. `404` e a resposta honesta: o animal
       * que o administrador acabou de alterar ja nao existe, e devolver a
       * representacao antiga faria a listagem exibir uma linha fantasma (RN-44).
       */
      throw new AnimalNotFoundError();
    }

    /**
     * A MESMA projecao da leitura, com o `updatedAt` NOVO — o token que o cliente
     * precisa para a proxima gravacao (RN-47). Sem devolve-lo, duas alteracoes de
     * status seguidas na mesma listagem responderiam `409` contra uma alteracao
     * que o proprio administrador acabou de fazer.
     *
     * O `now()` sai de `~/utils/clock` e alimenta a idade derivada do mapper, como
     * em todas as respostas de animal (RN-20, RN-22).
     */
    return toAnimalResponse(atualizado, now());
  }
}
