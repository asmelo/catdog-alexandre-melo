import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Porta de acesso a `animals`. Como nos repositorios dos dominios auth, species
 * e geography, os services dependem da INTERFACE e nao do Prisma — e o que
 * permite um duble em memoria nos testes da TASK-BACKEND-011 sem simular o
 * client inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 *
 * Escopo desta fatia: SO LEITURA. Criacao, edicao, alteracao de status e
 * exclusao entram neste mesmo arquivo nas TASK-BACKEND-007 a 009.
 */

/**
 * Relacoes SEMPRE carregadas junto com o animal, porque a representacao do
 * contrato precisa das tres: `species` (id e nome), `city` com o seu `state`
 * (para derivar `stateUf`) e `images`.
 *
 * A CIDADE VEM PELO VINCULO, e isso nao e detalhe: nome de municipio se REPETE
 * entre unidades federativas — "Boa Esperança" existe em ES (IBGE 3201001), MG
 * (3107109) e PR (4103008), entre os 5.571 carregados. Qualquer resolucao por
 * nome atravessaria as fronteiras de UF e exibiria a sigla errada; o `include`
 * segue a chave estrangeira e so pode trazer o estado daquela cidade.
 *
 * `images` ja sai ORDENADO POR `position` do banco (RN-35): a capa e a posicao
 * `0`, e o indice `@@index([animalId, position])` do schema e exatamente este
 * par. Ordenar em memoria duplicaria a regra num segundo lugar.
 *
 * `as const` e obrigatorio, e nao estilo: sem ele o `species: true` alargaria
 * para `boolean` e o `AnimalGetPayload` abaixo deixaria de saber que as relacoes
 * estao presentes, devolvendo um tipo sem elas.
 */
const INCLUIR_RELACOES = {
  species: true,
  city: { include: { state: true } },
  images: { orderBy: { position: 'asc' } },
} as const;

/**
 * A linha de `animals` com as tres relacoes resolvidas. E o tipo que o mapper
 * consome — e o UNICO tipo de animal que sai deste arquivo, para que nenhum
 * chamador receba um animal sem `city.state` e descubra isso em producao.
 */
export type AnimalWithRelations = Prisma.AnimalGetPayload<{
  include: typeof INCLUIR_RELACOES;
}>;

/**
 * RN-41, os TRES criterios, nesta ordem exata.
 *
 * 1. `nameNormalized asc` — alfabetica ignorando a caixa. A coluna ja esta em
 *    minusculas, entao a comparacao nao depende de `mode: 'insensitive'`.
 *
 *    A ORDEM E A DO BANCO e ela ja e a correta: medido neste projeto — Postgres
 *    17.6, provider ICU, `en_US.UTF-8` —, o `ORDER BY` e por LOCALE e nao
 *    binario, entao devolve `Ágil, Cão, Cavalo, Gato, Zebra`. Nenhum `sort` em
 *    memoria deve ser acrescentado sobre este retorno: um `sort()` sem
 *    `localeCompare` reintroduziria a ordenacao binaria, que daria
 *    `Cavalo, Cão, Gato, Zebra, Ágil` — todos os nomes acentuados depois do `Z`.
 *
 * 2. `createdAt desc` — empate de nome resolvido pelo cadastro mais recente.
 *
 * 3. `id asc` — DESEMPATE FINAL OBRIGATORIO, e o mais importante dos tres.
 *    Sem um criterio que nunca empata, dois animais cadastrados no mesmo
 *    instante podem trocar de posicao entre uma consulta e a seguinte, e o
 *    percurso das paginas passa a exibir um registro duas vezes enquanto outro
 *    desaparece (RNF-08, CT-26). O defeito nao aparece em cadastro pequeno nem
 *    em teste de uma pagina so.
 *
 * O trio casa PARCIALMENTE com o indice `@@index([nameNormalized, createdAt, id])`
 * do schema, e a ressalva importa: o indice e todo ASC e o segundo criterio aqui
 * e `createdAt DESC`, entao ele nao entrega a ordem final pronta. O plano real,
 * verificado por `EXPLAIN` neste banco, e `Incremental Sort`
 * (`Presorted Key: name_normalized`) sobre `Index Only Scan` — o indice presorta
 * pelo primeiro criterio e apenas o desempate DENTRO de cada nome e ordenado por
 * cima. Sem impacto pratico: os grupos por nome sao minusculos, e a ordenacao
 * incremental nunca precisa materializar a tabela inteira.
 *
 * ATENCAO — `nameNormalized` de ANIMAL nao e a mesma coisa que o de ESPECIE,
 * apesar do nome igual: la e chave de UNICIDADE (`@unique`) e aqui e chave de
 * ORDENACAO, deliberadamente sem `@unique`, porque dois animais podem se chamar
 * "Theo" (RN-05). Ele tambem NAO e um campo de busca: acentos sao PRESERVADOS
 * ("caçula" continua com cedilha), e so a caixa e removida.
 */
const ORDENACAO_DA_LISTAGEM: Prisma.AnimalOrderByWithRelationInput[] = [
  { nameNormalized: 'asc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

/** Recorte da pagina, ja calculado pelo caso de uso a partir de `page`/`pageSize`. */
export interface AnimalPageRequest {
  readonly skip: number;
  readonly take: number;
}

/**
 * Itens da pagina mais o total de registros da COLECAO INTEIRA (nao o da
 * pagina): e ele que a interface usa para decidir se exibe controles de
 * navegacao (RN-42a).
 */
export interface AnimalPage {
  readonly items: ReadonlyArray<AnimalWithRelations>;
  readonly total: number;
}

export interface AnimalRepository {
  /**
   * Uma pagina da listagem administrativa, na ordenacao da RN-41, mais o total.
   *
   * Colecao vazia devolve `{ items: [], total: 0 }` — nunca `null`: pagina sem
   * itens e um estado legitimo do recurso, inclusive quando o `skip` passa do
   * total.
   */
  listPaginated(pagina: AnimalPageRequest): Promise<AnimalPage>;
  /**
   * Consulta pela chave primaria, com as mesmas relacoes da listagem. Ausencia e
   * `null` — e o service que decide se isso e um problema (RN-44).
   */
  findById(id: string): Promise<AnimalWithRelations | null>;
  /**
   * Mesma porta ligada a uma transacao em andamento.
   *
   * Nenhum caso de uso desta fatia abre transacao interativa — as duas
   * operacoes sao leituras. Existe porque e o contrato de porta do projeto e
   * porque os consumidores previstos sao as escritas (TASK-BACKEND-007 a 009):
   * elas releem o animal DENTRO da mesma transacao que o grava, e um repositorio
   * construido com o client global executaria fora dela, deixando a atomicidade
   * so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): AnimalRepository;
}

/**
 * Capacidade de executar um LOTE atomico de consultas.
 *
 * Existe como tipo proprio porque `Prisma.TransactionClient` — o tipo do
 * construtor, comum ao client completo e ao `tx` de uma transacao interativa —
 * NAO possui `$transaction`: ele e um `Omit` que retira exatamente esse metodo,
 * justamente para impedir transacao aninhada. Sem este segundo parametro, o
 * `listPaginated` nao teria como pedir o lote.
 */
type ExecutorDeLote = Pick<PrismaClient, '$transaction'>;

/**
 * `Prisma.TransactionClient` e nao `PrismaClient` no primeiro parametro: e o
 * tipo comum aos dois — o client completo satisfaz a interface (ela e um `Omit`
 * dele) e o `tx` da transacao interativa tambem.
 *
 * O segundo parametro e o mesmo client, quando ha um capaz de abrir lote. Na
 * composicao da aplicacao ele e passado (`new PrismaAnimalRepository(prisma,
 * prisma)`); em `withTransaction` ele e `null`, porque ali JA SE ESTA dentro de
 * uma transacao aberta por quem chamou e um lote aninhado seria recusado pelo
 * proprio Prisma.
 */
export class PrismaAnimalRepository implements AnimalRepository {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly lote: ExecutorDeLote | null = null,
  ) {}

  /**
   * Itens e total em UMA `$transaction`, e nao duas idas soltas ao banco.
   *
   * Contados fora do lote, um cadastro concorrente entre o `findMany` e o
   * `count` produziria um `total` incoerente com a pagina devolvida — a
   * interface exibiria "Total: 41 animais" ao lado de uma pagina montada quando
   * havia 40, e o ultimo animal apareceria ou sumiria conforme o momento.
   *
   * As duas consultas sao construidas ANTES do `await`: `PrismaPromise` e
   * preguicosa e so emite comando quando resolvida, o que e precisamente o que
   * permite entrega-las ao lote em vez de executa-las.
   */
  async listPaginated(pagina: AnimalPageRequest): Promise<AnimalPage> {
    const consultaDeItens = this.db.animal.findMany({
      skip: pagina.skip,
      take: pagina.take,
      orderBy: ORDENACAO_DA_LISTAGEM,
      include: INCLUIR_RELACOES,
    });

    /**
     * `count` SEM `where`: o total do contrato e o de animais cadastrados, e a
     * listagem nao oferece busca nem filtro (RN-42b). Quando a feature de
     * filtragem da vitrine chegar, o filtro tera de entrar nos DOIS lugares — um
     * `count` que ignorasse o `where` do `findMany` e o defeito classico de
     * paginacao filtrada.
     */
    const consultaDoTotal = this.db.animal.count();

    if (this.lote === null) {
      // Ja estamos dentro de uma transacao aberta por quem chamou: as duas
      // consultas correm nela, e pedir um lote aqui seria transacao aninhada.
      return { items: await consultaDeItens, total: await consultaDoTotal };
    }

    const [items, total] = await this.lote.$transaction([consultaDeItens, consultaDoTotal]);

    return { items, total };
  }

  /**
   * `findUnique` e nao `findUniqueOrThrow`: o "nao encontrado" da RN-44 e uma
   * resposta prevista do recurso, e nao uma falha de infraestrutura. Deixar o
   * Prisma lancar aqui obrigaria o service a inspecionar codigo de erro do ORM
   * para produzir um `404` que ele ja sabe produzir a partir de `null`.
   *
   * O `id` chega JA validado como UUID por `animalIdParamsSchema`; o repositorio
   * nao revalida formato.
   */
  async findById(id: string): Promise<AnimalWithRelations | null> {
    return this.db.animal.findUnique({ where: { id }, include: INCLUIR_RELACOES });
  }

  withTransaction(executor: Prisma.TransactionClient): AnimalRepository {
    return new PrismaAnimalRepository(executor);
  }
}
