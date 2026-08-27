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
 * Implementacao Prisma da contagem, sobre a tabela REAL `animals`.
 *
 * A divida aberta pela FEATURE-001 do MODULE-002 — a RN-08 verificada apenas
 * por duble, porque a entidade Animal ainda nao existia — foi quitada pela
 * TASK-BACKEND-010 da FEATURE-002: a contagem consulta o banco, a chave
 * estrangeira `animals.species_id` existe com `onDelete: Restrict`, e os casos
 * CT-24, CT-25, CT-26 e CT-32 daquela spec foram reexecutados contra dados
 * reais em `tests/integration/species-animal-integrity.spec.ts` (CT-81 a CT-86).
 * O registro fica em `.makuco/codebase/technical-debt.md`.
 */
export class PrismaSpeciesUsageCounter implements SpeciesUsageCounter {
  /**
   * O executor e GUARDADO e usado: e ele que faz a contagem rodar dentro da
   * transacao aberta pelo `DeleteSpeciesService`. Ligado ao client global, um
   * animal inserido entre a contagem e o `DELETE` nao seria visto e a
   * atomicidade da RN-09 seria so aparente.
   *
   * `Prisma.TransactionClient` e nao `PrismaClient`: e o tipo mais fraco que
   * atende, e um `PrismaClient` o satisfaz estruturalmente. Assim o grafo de
   * composicao (`species.controller.ts`) passa o client global e o
   * `withTransaction` passa o `tx`, sem que nenhum dos dois precise de conversao.
   */
  constructor(private readonly db: Prisma.TransactionClient) {}

  /**
   * `count` e nao `findMany().length`: a decisao da RN-08 e sobre a EXISTENCIA
   * de vinculo, e trazer as linhas para conta-las em memoria custaria a tabela
   * inteira de uma especie popular. O indice `@@index([speciesId])` de `Animal`
   * atende esta consulta.
   */
  async countAnimalsBySpecies(speciesId: string): Promise<number> {
    return this.db.animal.count({ where: { speciesId } });
  }

  /**
   * Devolve uma instancia nova ligada ao executor, e nao `this`: e o que faz a
   * contagem rodar DENTRO da transacao do service. Devolver `this` a manteria no
   * client global e a atomicidade da RN-09 seria so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): SpeciesUsageCounter {
    return new PrismaSpeciesUsageCounter(executor);
  }
}
