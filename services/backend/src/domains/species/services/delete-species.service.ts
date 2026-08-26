import { Prisma, type PrismaClient } from '@prisma/client';

import {
  SpeciesInUseError,
  SpeciesNotFoundError,
} from '~/domains/species/errors/species.errors';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';
import type { SpeciesUsageCounter } from '~/domains/species/repositories/species-usage-counter';

/**
 * HU-05 e HU-06 — exclusao de especie com guarda de integridade (RN-08, RN-09,
 * RN-10 e RN-14).
 *
 * EXCLUSAO EM CASCATA E ANULACAO DE VINCULO SAO PROIBIDAS POR ESTA SPEC, EM
 * QUALQUER CAMADA. Nenhum animal e removido, desvinculado ou alterado por causa
 * desta operacao: a especie em uso simplesmente NAO e excluida. Isso vale tanto
 * para o codigo deste service quanto para a chave estrangeira que a feature
 * seguinte do modulo vai declarar, que precisa ser `onDelete: Restrict` —
 * `Cascade` apagaria animais silenciosamente e `SetNull` produziria animais sem
 * classificacao.
 *
 * A exclusao permitida e DEFINITIVA (RN-10): nao ha inativacao, arquivamento,
 * lixeira nem recuperacao, e por isso nenhum instante e gravado — nada de
 * `new Date()` nem de `now()` neste arquivo.
 */

/**
 * `maxWait` default do Prisma e 2 s, e o DATABASE_URL desta aplicacao usa o
 * pooler do Supabase com `connection_limit=1`: transacoes concorrentes disputam
 * UMA conexao e o excedente falha com `P2028`, respondido como 500. Mesmos
 * valores ja adotados em `confirm-email.service.ts` e `refresh-session.service.ts`
 * — esperar pela conexao e preferivel a recusar uma exclusao valida.
 */
const OPCOES_DE_TRANSACAO = { maxWait: 10000, timeout: 15000 } as const;

/**
 * Menor quantidade de animais vinculados que ja caracteriza especie em uso.
 * Nomeado para que a comparacao da RN-08 se leia como a regra, e nao como um
 * `> 0` solto.
 */
const VINCULOS_QUE_JA_BLOQUEIAM = 1;

/**
 * O `id` vem do parametro de caminho e ja passou pelo `speciesIdParamSchema` —
 * chega aqui como UUID bem formado, nunca como texto arbitrario (CT-34).
 */
export interface DeleteSpeciesInput {
  readonly id: string;
}

/**
 * `P2003` — violacao de chave estrangeira. Hoje NUNCA acontece: a tabela
 * `animals` nao existe e nada referencia `species`. Passa a ocorrer quando a FK
 * restritiva nascer, na feature seguinte do modulo.
 */
function violaChaveEstrangeira(motivo: unknown): boolean {
  return motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2003';
}

/**
 * `P2025` — o `DELETE` nao encontrou a linha do `where`. Aqui significa
 * exatamente uma coisa: a especie foi excluida por outra sessao entre a leitura
 * e a escrita desta transacao.
 */
function registroAusenteNaEscrita(motivo: unknown): boolean {
  return motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2025';
}

export class DeleteSpeciesService {
  /**
   * `PrismaClient` entra APENAS para abrir a transacao — nenhuma consulta sai
   * daqui por ele. Toda leitura e escrita passa pelas duas portas, o que
   * mantem o service testavel com dois dubles em memoria (TASK-BACKEND-005).
   */
  constructor(
    private readonly species: SpeciesRepository,
    private readonly usage: SpeciesUsageCounter,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * TUDO dentro de UMA transacao, com os dois colaboradores rebindados por
   * `withTransaction(tx)` — mas a transacao SOZINHA nao fecha a janela entre a
   * contagem e o `DELETE`. No isolamento padrao do Prisma em Postgres (READ
   * COMMITTED), um animal inserido e confirmado por outra sessao depois da
   * contagem simplesmente nao seria visto por ela.
   *
   * Quem fecha essa janela e a CAMADA 2: o `INSERT` do animal toma `FOR KEY
   * SHARE` sobre a linha da especie, o que faz este `DELETE` concorrente
   * BLOQUEAR ate o `COMMIT` do outro lado e entao falhar com `P2003` — que o
   * `catch` logo abaixo traduz para o mesmo `SpeciesInUseError`. E exatamente
   * por isso que a spec exige as DUAS camadas: a camada 1 produz a mensagem
   * correta em PT-BR no caso comum, e a camada 2 e a unica que impede de fato o
   * animal orfao sob concorrencia (RN-09).
   *
   * A ESCRITA E A ULTIMA OPERACAO DA TRANSACAO, e isso nao e estilo: em Postgres
   * uma violacao de constraint (`23505`, `23503`) ABORTA a transacao inteira, e
   * qualquer comando seguinte falharia com `25P02 current transaction is
   * aborted` — mascarando o erro traduzido por um erro de infraestrutura.
   * Capturar o `P2003` do `deleteById` so e seguro porque nada roda depois dele.
   * O mesmo cuidado ja esta registrado em `create-species.service.ts`.
   *
   * Os erros sao lancados de DENTRO da callback: e o que aborta a transacao e
   * garante que, quando a resposta e `409` ou `404`, nada foi confirmado
   * (CT-25 / RNF-02).
   */
  async execute(entrada: DeleteSpeciesInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const especies = this.species.withTransaction(tx);

      /**
       * RN-14 antes de tudo: uma especie ja excluida reporta "Especie nao
       * encontrada." (CT-27), e nao um conflito sobre um recurso inexistente.
       */
      const especie = await especies.findById(entrada.id);

      if (especie === null) {
        throw new SpeciesNotFoundError();
      }

      /**
       * CAMADA 1 da RN-09 — a verificacao da aplicacao. E ela que produz a
       * mensagem correta em PT-BR (CT-24). A camada 2, logo abaixo, e a
       * integridade referencial do banco.
       */
      const vinculados = await this.usage.withTransaction(tx).countAnimalsBySpecies(entrada.id);

      if (vinculados >= VINCULOS_QUE_JA_BLOQUEIAM) {
        throw new SpeciesInUseError();
      }

      await especies.deleteById(entrada.id).catch((motivo: unknown) => {
        /**
         * CAMADA 2 da RN-09 — a integridade referencial do banco. Traduz a
         * recusa da FK restritiva para o MESMO `SpeciesInUseError` da camada 1:
         * mesmo `code`, mesma mensagem, nunca um `500` (CA-15). A traducao
         * nasce agora, antes de a FK existir, para que a guarda nao precise ser
         * retroencaixada depois — e para que uma falha da camada 1 nao vire
         * erro inesperado na tela.
         *
         * O `P2025` cobre a corrida em que outra sessao excluiu a especie entre
         * o `findById` e este `DELETE` (RN-14).
         */
        if (violaChaveEstrangeira(motivo)) {
          throw new SpeciesInUseError();
        }

        if (registroAusenteNaEscrita(motivo)) {
          throw new SpeciesNotFoundError();
        }

        throw motivo;
      });
    }, OPCOES_DE_TRANSACAO);
  }
}
