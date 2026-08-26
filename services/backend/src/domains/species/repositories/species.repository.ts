import type { Prisma, Species } from '@prisma/client';

/**
 * Porta de acesso a `species`. Como nos repositorios do dominio auth, os
 * services dependem da INTERFACE e nao do Prisma — e o que permite um duble em
 * memoria nos testes (TASK-BACKEND-005) sem simular o client inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 *
 * Escopo ate aqui: listagem, criacao e renomeacao. `delete` e a contagem de
 * animais vinculados chegam na TASK-BACKEND-004 — declara-los agora deixaria
 * codigo morto atras de uma interface que ninguem implementa por inteiro.
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

/**
 * Dados da renomeacao: a MESMA forma da criacao, e nao uma segunda declaracao
 * dela. As duas escritas gravam o par `name` / `nameNormalized` derivado do
 * mesmo ponto (`speciesNameKey`), entao um alias nomeado mantem a intencao
 * legivel na assinatura de `rename` sem permitir que as duas formas divirjam.
 *
 * `id` NAO entra aqui: ele e imutavel (RN-15) e vive apenas no `where`.
 */
export type RenameSpeciesData = CreateSpeciesData;

export interface SpeciesRepository {
  /**
   * RN-11 — todas as especies, sem paginacao e sem filtro (RN-12), ordenadas
   * alfabeticamente ignorando a caixa.
   */
  listAll(): Promise<Species[]>;
  /**
   * Consulta pela chave primaria. Ausencia e `null` — e o service que decide se
   * isso e um problema (RN-14).
   */
  findById(id: string): Promise<Species | null>;
  /** Consulta pela chave de unicidade da RN-04. Ausencia e `null`. */
  findByNameKey(nameNormalized: string): Promise<Species | null>;
  create(data: CreateSpeciesData): Promise<Species>;
  /**
   * HU-04 — grava o novo nome e a nova chave de unicidade da especie `id`.
   *
   * Devolve a linha ja atualizada porque a resposta do `PATCH` e o recurso
   * (`200 PublicSpecies`): uma segunda leitura depois da escrita so acrescentaria
   * viagem ao banco e uma janela para ler o estado de outra sessao.
   */
  rename(id: string, data: RenameSpeciesData): Promise<Species>;
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

  /**
   * `findUnique` e nao `findUniqueOrThrow`: o "nao encontrada" da RN-14 e uma
   * resposta prevista do recurso, e nao uma falha de infraestrutura. Deixar o
   * Prisma lancar aqui obrigaria o service a inspecionar codigo de erro do ORM
   * para produzir um `404` que ele ja sabe produzir a partir de `null`.
   */
  async findById(id: string): Promise<Species | null> {
    return this.db.species.findUnique({ where: { id } });
  }

  async findByNameKey(nameNormalized: string): Promise<Species | null> {
    return this.db.species.findUnique({ where: { nameNormalized } });
  }

  async create(data: CreateSpeciesData): Promise<Species> {
    return this.db.species.create({
      data: { name: data.name, nameNormalized: data.nameNormalized },
    });
  }

  /**
   * O `data` lista os campos um a um em vez de repassar o objeto recebido: e o
   * que impede uma chave inesperada de virar coluna atualizada caso a forma de
   * `RenameSpeciesData` cresca. `id` fica so no `where` (RN-15).
   *
   * `updatedAt` nao aparece: quem o grava e o `@updatedAt` do schema Prisma —
   * nenhum `new Date()` participa da renomeacao.
   */
  async rename(id: string, data: RenameSpeciesData): Promise<Species> {
    return this.db.species.update({
      where: { id },
      data: { name: data.name, nameNormalized: data.nameNormalized },
    });
  }

  withTransaction(executor: Prisma.TransactionClient): SpeciesRepository {
    return new PrismaSpeciesRepository(executor);
  }
}
