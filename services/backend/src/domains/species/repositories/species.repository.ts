import type { Prisma, Species } from '@prisma/client';

/**
 * Porta de acesso a `species`. Como nos repositorios do dominio auth, os
 * services dependem da INTERFACE e nao do Prisma — e o que permite um duble em
 * memoria nos testes (TASK-BACKEND-005) sem simular o client inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 *
 * Escopo deste slice: apenas listagem e criacao. `update`, `delete` e a contagem
 * de animais vinculados chegam nas TASK-BACKEND-003 e 004 — declara-las agora
 * deixaria codigo morto atras de uma interface que ninguem implementa por
 * inteiro.
 */

/**
 * Dados de persistencia da especie. Nomeado `...Data` e nao `...Input` (como
 * `CreateUserInput` do auth) para nao colidir com o `CreateSpeciesInput` do caso
 * de uso: aqui a forma e a da linha da tabela, com a chave de unicidade ja
 * derivada, e la e a do pedido do usuario, que so tem o nome.
 */
export interface CreateSpeciesData {
  /**
   * Ja normalizado pelo schema Zod (espacos das pontas removidos e sequencias
   * internas colapsadas, RN-03). O repositorio NAO renormaliza nada.
   */
  readonly name: string;
  /** Resultado de `speciesNameKey(name)`. E a coluna com o indice unico. */
  readonly nameNormalized: string;
}

export interface SpeciesRepository {
  /**
   * RN-11 — todas as especies, sem paginacao e sem filtro (RN-12), ordenadas
   * alfabeticamente ignorando a caixa.
   */
  listAll(): Promise<Species[]>;
  /** Consulta pela chave de unicidade da RN-04. Ausencia e `null`. */
  findByNameKey(nameNormalized: string): Promise<Species | null>;
  create(data: CreateSpeciesData): Promise<Species>;
  /**
   * Mesma porta ligada a uma transacao em andamento. Nenhum caso de uso deste
   * slice abre transacao (a criacao e uma escrita unica), mas a porta ja nasce
   * com o metodo porque a exclusao da TASK-BACKEND-004 verifica o vinculo e
   * remove dentro da MESMA transacao (RN-09) — sem isto, um repositorio
   * construido com o client global executaria fora dela e a atomicidade seria
   * so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): SpeciesRepository;
}

/**
 * `Prisma.TransactionClient` e nao `PrismaClient` no construtor: e o tipo comum
 * aos dois — o client completo satisfaz a interface (ela e um `Omit` dele) e o
 * `tx` da transacao interativa tambem.
 */
export class PrismaSpeciesRepository implements SpeciesRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  /**
   * `orderBy: { nameNormalized: 'asc' }` e a RN-11 em uma linha: a coluna ja
   * esta em minusculas, entao a ordenacao do Postgres ignora a caixa sem
   * depender de `mode: 'insensitive'` nem da collation do ambiente — "Cachorro"
   * vem antes de "gato" em qualquer maquina (CT-13 / CT-14). Ordenar por `name`
   * com collation `C` colocaria todas as maiusculas antes de qualquer
   * minuscula.
   */
  async listAll(): Promise<Species[]> {
    return this.db.species.findMany({ orderBy: { nameNormalized: 'asc' } });
  }

  async findByNameKey(nameNormalized: string): Promise<Species | null> {
    return this.db.species.findUnique({ where: { nameNormalized } });
  }

  async create(data: CreateSpeciesData): Promise<Species> {
    return this.db.species.create({
      data: { name: data.name, nameNormalized: data.nameNormalized },
    });
  }

  withTransaction(executor: Prisma.TransactionClient): SpeciesRepository {
    return new PrismaSpeciesRepository(executor);
  }
}
