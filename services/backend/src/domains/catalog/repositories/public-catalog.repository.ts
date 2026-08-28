import { AnimalStatus, type Prisma, type PrismaClient } from '@prisma/client';

import type {
  PaginatedResult,
  PublicAnimalRow,
  PublicCatalogFilters,
} from '~/domains/catalog/catalog.types';
import { birthDateCutoffForMaxAge } from '~/utils/age';
import { now } from '~/utils/clock';

/**
 * Porta do catalogo publico.
 *
 * ============ A ASSINATURA E A PRIMEIRA GARANTIA DE SEGURANCA ============
 *
 * O metodo se chama `listAvailableAnimals` e NAO recebe status. Nao ha parametro
 * capaz de selecionar `RESERVADO`, `ADOTADO` ou `INDISPONIVEL` — a consulta por
 * outro status e INEXPRIMIVEL por esta porta (RN-10). Um `listAnimals(status)`
 * com o chamador passando `'DISPONIVEL'` daria o mesmo resultado hoje e abriria a
 * porta para o dia em que alguem passasse outra coisa.
 *
 * Nenhum erro HTTP e lancado daqui: identificador bem formado que nao existe
 * produz lista vazia, e nao excecao (RN-51).
 */
export interface PublicCatalogRepository {
  listAvailableAnimals(
    filters: PublicCatalogFilters,
  ): Promise<PaginatedResult<PublicAnimalRow>>;

  /**
   * As opcoes dos dois campos de selecao da vitrine.
   *
   * SO O QUE TEM ANIMAL DISPONIVEL (Decisao D, RN-30, RN-31). Oferecer as ~5.600
   * cidades do cadastro de apoio produziria uma lista em que quase toda escolha
   * leva a zero resultados — um filtro que existe para nao funcionar.
   *
   * Sao consultas SEPARADAS da listagem, e nao um derivado dela: as opcoes
   * descrevem o catalogo INTEIRO, e derivar da pagina corrente ofereceria apenas
   * as cidades dos doze animais visiveis.
   */
  listSpeciesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableSpeciesOption>>;
  listCitiesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableCityOption>>;
}

export interface AvailableSpeciesOption {
  readonly id: string;
  readonly name: string;
}

/**
 * ACHATADA (`stateUf` e nao `state: { uf }`): o rotulo "Cidade - UF" e composto na
 * TELA, e o servidor devolve dado, nao texto de apresentacao.
 */
export interface AvailableCityOption {
  readonly id: string;
  readonly name: string;
  readonly stateUf: string;
}

/**
 * RECORTE EXPLICITO — camada 1 da RN-55.
 *
 * `select` e jamais `include` largo ou `select` omitido. A diferenca nao e de
 * estilo: com `include`, toda coluna que alguem acrescentar ao modelo `Animal`
 * passa a ser LIDA, e a unica coisa entre ela e o visitante e o montador. Com o
 * recorte, a coluna nova sequer chega a aplicacao (RNF-02, CT-100).
 *
 * `birthDate` entra porque a idade e derivada dele; o montador o descarta.
 * `city.id` fica FORA de proposito (RN-59) — os identificadores de filtro vem de
 * `GET /api/catalog/cities`.
 */
const RECORTE_PUBLICO = {
  id: true,
  name: true,
  size: true,
  sex: true,
  birthDate: true,
  description: true,
  acceptsOtherAnimals: true,
  needsLargeSpace: true,
  species: { select: { id: true, name: true } },
  city: { select: { name: true, state: { select: { uf: true } } } },
  /**
   * SO a capa: `position: 0` com `take: 1`. Trazer as cinco imagens para usar uma
   * multiplicaria por cinco as linhas devolvidas pelo banco numa pagina de doze
   * cartoes, e nenhuma delas apareceria na tela.
   */
  images: { select: { storagePath: true }, where: { position: 0 }, take: 1 },
} satisfies Prisma.AnimalSelect;

/**
 * ORDENACAO da vitrine: mais recentes primeiro, com DESEMPATE OBRIGATORIO por id.
 *
 * O desempate nao e cosmetico. `created_at` tem precisao de milissegundo, e uma
 * carga inicial ou uma importacao produz varios registros no mesmo instante. Sem
 * o segundo criterio, o Postgres nao promete ordem estavel entre eles: a pagina 2
 * pode repetir um animal que ja saiu na 1 e omitir outro que nunca aparece
 * (RN-14, RN-15, CT-74).
 */
const ORDENACAO_DA_VITRINE: Prisma.AnimalOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'asc' },
];

/**
 * Monta o `where` por COMPOSICAO CONDICIONAL.
 *
 * Filtro ausente nao entra no objeto (RN-35). A alternativa — chaves com valor
 * `undefined` espalhadas pelo literal — funciona no Prisma, mas torna o objeto
 * ilegivel no log de consulta e esconde qual filtro esta de fato aplicado.
 */
function montarFiltro(filters: PublicCatalogFilters): Prisma.AnimalWhereInput {
  const where: Prisma.AnimalWhereInput = {
    /**
     * FIXO, jamais parametrizado. E a segunda garantia, depois da assinatura: o
     * literal esta escrito aqui, no repositorio, e nao chega de fora (RN-09).
     */
    status: AnimalStatus.DISPONIVEL,
  };

  if (filters.search !== undefined) {
    /**
     * O texto vai INTEIRO, nunca quebrado em termos (RN-22, RN-24, RN-25): quem
     * digita "theo campo" procura essa sequencia, e nao "theo" OU "campo".
     *
     * SEM `mode: 'insensitive'`: as duas pontas ja estao em minusculas e sem
     * acento — a coluna por `normalizeForSearch` na escrita, o texto por
     * `normalizeForSearch` na borda. Acrescentar o modo aqui faria o Postgres
     * aplicar `ILIKE` sobre valores que ja nao tem caixa a ignorar, custando um
     * `lower()` por linha e impedindo o uso do indice.
     */
    where.OR = [
      { nameSearch: { contains: filters.search } },
      { city: { nameSearch: { contains: filters.search } } },
    ];
  }

  if (filters.speciesId !== undefined) {
    where.speciesId = filters.speciesId;
  }

  if (filters.cityId !== undefined) {
    where.cityId = filters.cityId;
  }

  if (filters.size !== undefined) {
    where.size = filters.size;
  }

  if (filters.sex !== undefined) {
    where.sex = filters.sex;
  }

  if (filters.maxAgeYears !== undefined) {
    /**
     * `not: null` E PARTE DO FILTRO, e so existe enquanto ele esta aplicado
     * (RN-42): perguntar "ate 3 anos" e perguntar por idade, e o animal sem data
     * de nascimento nao tem idade a comparar. Sem o filtro, ele volta a aparecer.
     *
     * O corte vem de `birthDateCutoffForMaxAge`, derivado da MESMA aritmetica de
     * `calculateAge` — e o que faz "nenhum devolvido tem idade maior que N" ser
     * estrutural em vez de coincidencia (RN-45).
     */
    where.birthDate = { not: null, gte: birthDateCutoffForMaxAge(filters.maxAgeYears, now()) };
  }

  return where;
}

export class PrismaPublicCatalogRepository implements PublicCatalogRepository {
  constructor(private readonly db: PrismaClient) {}

  async listAvailableAnimals(
    filters: PublicCatalogFilters,
  ): Promise<PaginatedResult<PublicAnimalRow>> {
    const where = montarFiltro(filters);

    /**
     * Pagina e contagem na MESMA transacao, com o MESMO `where`.
     *
     * O total e o do conjunto FILTRADO, nunca o do catalogo (RN-11, RNF-12) — um
     * `count` sem `where` e o defeito classico de paginacao filtrada, e ele
     * aparece como "13 resultados" acima de uma lista de 2.
     *
     * Na mesma transacao porque um cadastro entre as duas consultas produziria um
     * total que nao corresponde a pagina exibida.
     *
     * `skip` alem da ultima pagina devolve lista vazia e o total real, sem erro
     * (RN-20): o visitante que edita a URL nao merece um 500.
     */
    const [items, total] = await this.db.$transaction([
      this.db.animal.findMany({
        where,
        select: RECORTE_PUBLICO,
        orderBy: ORDENACAO_DA_VITRINE,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.db.animal.count({ where }),
    ]);

    return {
      items,
      pagination: { page: filters.page, pageSize: filters.pageSize, total },
    };
  }

  /**
   * `some` traduz literalmente "ao menos um animal disponivel" (RN-31), e o faz
   * como um `EXISTS` no banco — nao traz os animais para contar em memoria.
   *
   * ORDENADA POR `nameNormalized`, a coluna que a FEATURE-001 ja mantem em
   * minusculas, e nao por `name` com `mode: 'insensitive'`: o Prisma NAO suporta
   * o modo em `orderBy`, e ordenar por `name` cru colocaria "gato" depois de
   * "Cachorro" e antes de "Coelho" de forma imprevisivel conforme a caixa que o
   * administrador digitou (CT-50).
   *
   * `select` explicito: `nameNormalized`, `createdAt` e qualquer coluna futura
   * ficam fora da resposta (RN-55, CT-134).
   *
   * Sem `take`/`skip`: o recorte por disponibilidade E o limite. Uma lista de
   * especies com animal disponivel nao chega a dezenas.
   */
  async listSpeciesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableSpeciesOption>> {
    return this.db.species.findMany({
      where: { animals: { some: { status: AnimalStatus.DISPONIVEL } } },
      select: { id: true, name: true },
      orderBy: { nameNormalized: 'asc' },
    });
  }

  /**
   * Mesmo recorte, agrupado por unidade federativa (RN-30, CT-51).
   *
   * `[{ state: { uf: 'asc' } }, { name: 'asc' }]`: o campo agrupa por estado e,
   * dentro de cada um, ordena alfabeticamente — que e como o visitante procura.
   *
   * `ibgeCode`, `stateId` e `nameSearch` ficam FORA do `select`. O achatamento
   * para `stateUf` acontece aqui, e nao no service, porque e a forma da PORTA que
   * o contrato promete.
   */
  async listCitiesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableCityOption>> {
    const cidades = await this.db.city.findMany({
      where: { animals: { some: { status: AnimalStatus.DISPONIVEL } } },
      select: { id: true, name: true, state: { select: { uf: true } } },
      orderBy: [{ state: { uf: 'asc' } }, { name: 'asc' }],
    });

    return cidades.map((cidade) => ({
      id: cidade.id,
      name: cidade.name,
      stateUf: cidade.state.uf,
    }));
  }
}
