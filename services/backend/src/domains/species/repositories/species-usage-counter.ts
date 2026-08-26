import type { Prisma } from '@prisma/client';

/**
 * Porta de CONTAGEM DE VINCULOS: quantos animais referenciam uma especie.
 *
 * E uma porta separada de `SpeciesRepository`, e nao mais um metodo dele, por
 * segregacao de interfaces: a contagem pertence ao agregado Animal, nao ao
 * agregado Especie. Juntar as duas obrigaria o repositorio de especies em
 * memoria dos testes (TASK-BACKEND-005) a fingir conhecer animais para
 * satisfazer uma interface que o caso de uso de listagem, criacao e renomeacao
 * nem usa. E esta separacao que torna o duble de teste trivial: um objeto com
 * dois metodos, sem nenhum conhecimento de especies.
 *
 * O repositorio NAO lanca erro HTTP: aqui isso significa que a contagem nunca
 * decide nada — ela devolve um numero e quem transforma `> 0` em
 * `409 SPECIES_IN_USE` e o `DeleteSpeciesService` (RN-08).
 *
 * O simbolo `Animal` NAO e referenciado aqui — nem como import, nem como tipo,
 * nem como modelo do client. A entidade e da feature seguinte do MODULE-002 e o
 * `@prisma/client` gerado a partir do schema atual nao a exporta: referencia-la
 * hoje quebraria a compilacao do projeto inteiro. O nome do metodo cita animais
 * porque e o termo do negocio (linguagem ubiqua da spec), nao um tipo.
 */
export interface SpeciesUsageCounter {
  /**
   * Quantos animais referenciam a especie `speciesId`. `0` significa "nenhum
   * vinculo", e e o unico valor que autoriza a exclusao (RN-08).
   */
  countAnimalsBySpecies(speciesId: string): Promise<number>;
  /**
   * Mesma porta ligada a uma transacao em andamento. Obrigatorio, e nao
   * conveniencia: a RN-09 exige que a contagem e a exclusao vejam o MESMO
   * instantaneo. Uma contagem executada com o client global rodaria fora da
   * transacao aberta pelo service e um animal criado entre a contagem e o
   * `DELETE` produziria exatamente o animal orfao que a regra proibe.
   */
  withTransaction(executor: Prisma.TransactionClient): SpeciesUsageCounter;
}

/**
 * Valor devolvido pela implementacao PROVISORIA. Constante nomeada, e nao um
 * `0` solto: e o unico ponto do codigo de producao onde a RN-08 esta hoje
 * desarmada, e um literal anonimo esconderia isso de quem le.
 */
const NENHUM_ANIMAL_CADASTRADO = 0;

/**
 * Implementacao Prisma da contagem — PROVISORIA.
 *
 * TODO (feature de Cadastro de pets, MODULE-002): apontar a contagem ao banco
 * real. Sao QUATRO edicoes, todas mecanicas e todas contidas neste arquivo:
 *
 *   a. `constructor(_executor: Prisma.TransactionClient) {}` vira
 *      `constructor(private readonly db: Prisma.TransactionClient) {}` (ver a
 *      nota do construtor abaixo);
 *   b. `async countAnimalsBySpecies(_speciesId: string)` vira
 *      `async countAnimalsBySpecies(speciesId: string)`;
 *   c. o corpo `return NENHUM_ANIMAL_CADASTRADO;` vira
 *      `return this.db.animal.count({ where: { speciesId } });`
 *   d. a constante `NENHUM_ANIMAL_CADASTRADO` e REMOVIDA. Sem o `return` do
 *      item c ela fica sem nenhuma referencia e o `noUnusedLocals` do
 *      `tsconfig.json` derruba o build com `TS6133`. Esquecer esta edicao
 *      reprova o typecheck da feature seguinte.
 *
 * Aquela feature NAO pode ser considerada concluida sem que:
 *
 *   1. a chave estrangeira `animals.species_id` exista declarada com
 *      `onDelete: Restrict` — `Cascade` apagaria animais silenciosamente e
 *      `SetNull` produziria animais sem classificacao, os dois desfechos
 *      explicitamente proibidos pela spec (RN-08 / RN-09);
 *   2. esta contagem consulte a tabela real; e
 *   3. os casos CT-24, CT-25, CT-26 e CT-32 sejam REEXECUTADOS contra dados
 *      reais, e nao apenas contra o duble de teste.
 *
 * Enquanto os tres pontos nao ocorrerem, a RN-08 esta verificada apenas por
 * duble — risco residual ja registrado na spec e no changelog da FEATURE-001.
 *
 * Ate la a resposta e `0` SEM TOCAR O BANCO. Nao ha consulta a emitir: a tabela
 * `animals` nao existe e qualquer `SELECT` sobre ela derrubaria a exclusao de
 * especie, que hoje e uma operacao legitima e sem vinculo possivel.
 */
export class PrismaSpeciesUsageCounter implements SpeciesUsageCounter {
  /**
   * O executor chega e e IGNORADO enquanto a contagem nao consulta o banco.
   * Nao vira `private readonly db` agora porque o `noUnusedLocals` do
   * `tsconfig.json` reprova propriedade privada nunca lida (TS6138) — e o
   * prefixo `_` nao isenta propriedades, so parametros. Guardar o client sem
   * usa-lo custaria um `@ts-expect-error` ou um uso artificial; nenhum dos dois
   * vale para um campo que a feature seguinte reintroduz em uma linha.
   *
   * O parametro CONTINUA na assinatura, ainda que ignorado, para que o grafo de
   * composicao (`species.controller.ts`) e o `withTransaction` ja passem o
   * executor certo hoje. Assim a troca da feature seguinte fica contida neste
   * arquivo: nenhum ponto de instanciacao muda.
   */
  constructor(_executor: Prisma.TransactionClient) {}

  /**
   * `_speciesId` prefixado porque o parametro ainda nao e lido — o
   * `noUnusedParameters` reprovaria `speciesId` sem uso. O prefixo cai junto
   * com o corpo provisorio.
   */
  async countAnimalsBySpecies(_speciesId: string): Promise<number> {
    return NENHUM_ANIMAL_CADASTRADO;
  }

  /**
   * Devolve uma instancia nova ligada ao executor, e nao `this`. Hoje as duas
   * se comportariam igual, porque o corpo provisorio ignora o client — e
   * exatamente por isso que devolver `this` seria uma armadilha: a contagem
   * real da feature seguinte passaria a rodar FORA da transacao do service sem
   * que nada aqui precisasse mudar, e a atomicidade da RN-09 seria so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): SpeciesUsageCounter {
    return new PrismaSpeciesUsageCounter(executor);
  }
}
