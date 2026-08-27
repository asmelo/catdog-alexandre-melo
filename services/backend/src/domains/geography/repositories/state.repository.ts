import type { City, Prisma, State } from '@prisma/client';

/**
 * Porta de acesso a `states` e `cities`. Como nos repositorios dos dominios auth
 * e species, os services dependem da INTERFACE e nao do Prisma — e o que permite
 * um duble em memoria nos testes da TASK-BACKEND-011 sem simular o client
 * inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 *
 * UMA porta para as duas tabelas, e nao uma por tabela: o municipio nao e
 * consultavel fora de um estado neste contrato — nao existe "buscar cidade por
 * id" nem "listar todas as cidades", e a unica leitura de `cities` e sempre
 * escopada por `stateId`. Uma segunda porta so para `listCitiesByStateId`
 * separaria dois metodos que sempre sao chamados em sequencia, pelo mesmo caso
 * de uso, sobre o mesmo agregado de apoio.
 *
 * Escopo deliberadamente SO DE LEITURA: nao ha criacao, edicao nem exclusao de
 * estado ou de municipio em lugar nenhum do produto. A carga vem do recorte
 * oficial do IBGE, aplicada por `prisma/seeds/geography.seed.ts`, e nenhuma tela
 * mantem estes dados. Metodo de escrita aqui seria superficie sem chamador.
 */

export interface StateRepository {
  /**
   * As 27 unidades federativas, ordenadas pela SIGLA crescente.
   *
   * Sem paginacao e sem filtro: o conjunto tem 27 linhas e e fechado por lei.
   */
  listAll(): Promise<ReadonlyArray<State>>;
  /**
   * Consulta pela sigla, que e a chave natural do estado neste contrato.
   *
   * A sigla chega JA em maiusculas, normalizada por `listCitiesParamsSchema`; o
   * repositorio nao renormaliza nada.
   *
   * Ausencia e `null` — e o service que decide se isso e um problema.
   */
  findByUf(uf: string): Promise<State | null>;
  /**
   * Os municipios do estado `stateId`, ordenados pelo NOME crescente.
   *
   * Recebe o `id` do estado e nao a sigla, de proposito: quem chama ja resolveu
   * o estado por `findByUf` e portanto ja sabe se ele existe. Aceitar a sigla
   * aqui faria o metodo ter de responder tambem "esse estado nao existe" —
   * indistinguivel, num array vazio, de "esse estado nao tem municipios" — e o
   * caso de uso perderia a informacao de que precisa para separar `404` de
   * `200 { items: [] }`.
   *
   * Estado real sem nenhum municipio devolve `[]`, nunca `null`: colecao vazia e
   * um estado legitimo do recurso.
   */
  listCitiesByStateId(stateId: string): Promise<ReadonlyArray<City>>;
  /**
   * Consulta o municipio pela CHAVE PRIMARIA (RN-26).
   *
   * Acrescentado pela TASK-BACKEND-007: a gravacao do animal precisa afirmar que
   * a cidade recebida existe, e nenhum dos dois metodos acima responde a essa
   * pergunta — `listCitiesByStateId` exigiria o estado, que o contrato do animal
   * deliberadamente NAO recebe (RN-26a).
   *
   * POR `id`, JAMAIS POR NOME, e esta e a razao de o metodo existir com esta
   * assinatura: nome de municipio se REPETE entre unidades federativas — "Boa
   * Esperança" existe em ES (IBGE 3201001), MG (3107109) e PR (4103008), entre os
   * 5.571 carregados. Uma resolucao por nome escolheria uma das tres em silencio
   * e gravaria o animal na UF errada.
   *
   * NAO carrega o estado junto: quem chama so precisa saber se a cidade existe. O
   * `stateUf` da resposta vem do `include` da leitura do animal, que segue a
   * propria chave estrangeira e por isso so pode trazer o estado daquela cidade.
   *
   * Ausencia e `null` — e o service que decide se isso e um problema.
   */
  findCityById(id: string): Promise<City | null>;
  /**
   * Mesma porta ligada a uma transacao em andamento.
   *
   * Nenhum caso de uso desta task abre transacao — as duas operacoes sao
   * leituras isoladas. Existe porque e o contrato de porta do projeto, e porque
   * o consumidor previsto e a gravacao do animal (TASK-BACKEND-006 em diante):
   * ela precisa resolver a cidade DENTRO da mesma transacao que grava o animal,
   * e um repositorio construido com o client global executaria fora dela,
   * deixando a atomicidade so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): StateRepository;
}

/**
 * `Prisma.TransactionClient` e nao `PrismaClient` no construtor: e o tipo comum
 * aos dois — o client completo satisfaz a interface (ela e um `Omit` dele) e o
 * `tx` da transacao interativa tambem.
 */
export class PrismaStateRepository implements StateRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  /**
   * `orderBy: { uf: 'asc' }` e nao ordenacao por `name`: o contrato identifica e
   * exibe o estado pela sigla, e o campo Estado do formulario mostra "PR". As
   * duas ordens divergem — por sigla, `AC, AL, AM, AP…`; por nome, `Acre,
   * Alagoas, Amapá, Amazonas…` —, e ordenar por um campo que nao aparece na tela
   * faria a lista parecer embaralhada para quem a le.
   *
   * As siglas sao ASCII maiusculo puro, sem acento e sem caixa mista, entao esta
   * ordenacao e a mesma sob qualquer collation.
   */
  async listAll(): Promise<ReadonlyArray<State>> {
    return this.db.state.findMany({ orderBy: { uf: 'asc' } });
  }

  /**
   * `findUnique` e nao `findUniqueOrThrow`: o "nao encontrado" e uma resposta
   * prevista do recurso, e nao uma falha de infraestrutura. Deixar o Prisma
   * lancar aqui obrigaria o service a inspecionar codigo de erro do ORM para
   * produzir um `404` que ele ja sabe produzir a partir de `null`.
   *
   * `where: { uf }` casa com o indice unico da coluna. A sigla ja chega em
   * maiusculas — `mode: 'insensitive'` nao entra: alem de nao ser aplicavel a
   * `findUnique`, ele desligaria o uso do indice.
   */
  async findByUf(uf: string): Promise<State | null> {
    return this.db.state.findUnique({ where: { uf } });
  }

  /**
   * ESCOPADO POR `stateId`, e este e o ponto mais importante do arquivo. Nome de
   * municipio NAO e unico no Brasil: "Boa Esperança" existe em ES (IBGE
   * 3201001), em MG (3107109) e em PR (4103008), entre 5.571 municipios
   * carregados. Uma consulta por nome, ou uma listagem nao escopada, misturaria
   * as tres — e a listagem de PR ofereceria uma cidade capixaba, que o
   * administrador gravaria sem perceber.
   *
   * O par `where: { stateId }` + `orderBy: { name: 'asc' }` e exatamente o
   * indice composto `@@index([stateId, name])` do schema: o Postgres percorre a
   * faixa do estado ja na ordem pedida, sem passo de ordenacao. Ordenar em
   * memoria, alem de duplicar a regra, obrigaria a carregar as mais de 600
   * cidades de SP para o processo so para reorganiza-las.
   *
   * A ORDEM E A DO BANCO e ela ja e a correta: medido neste projeto — Postgres
   * 17.6, provider ICU, `en_US.UTF-8` —, o `ORDER BY` e por LOCALE e nao
   * binario, entao devolve `Ágil, Cão, Cavalo, Gato, Zebra`, identico ao que
   * `localeCompare` produz. Os nomes vem com a acentuacao oficial ("Ubá",
   * "Poções", "Ji-Paraná"), e uma comparacao binaria os jogaria todos para o fim
   * da lista, depois de `Z`. Nenhum `sort` em memoria deve ser acrescentado
   * sobre este retorno: alem de redundante, um `sort()` sem `localeCompare`
   * REINTRODUZIRIA a ordenacao binaria errada que o banco ja evitou.
   */
  async listCitiesByStateId(stateId: string): Promise<ReadonlyArray<City>> {
    return this.db.city.findMany({ where: { stateId }, orderBy: { name: 'asc' } });
  }

  /**
   * `findUnique` e nao `findUniqueOrThrow`, pela mesma razao ja registrada em
   * `findByUf`: "cidade nao encontrada" e uma resposta prevista do recurso
   * (`404 CITY_NOT_FOUND`, RN-26), e nao uma falha de infraestrutura.
   *
   * O `id` chega JA validado como UUID por `createAnimalBodySchema`; o
   * repositorio nao revalida formato.
   */
  async findCityById(id: string): Promise<City | null> {
    return this.db.city.findUnique({ where: { id } });
  }

  withTransaction(executor: Prisma.TransactionClient): StateRepository {
    return new PrismaStateRepository(executor);
  }
}
