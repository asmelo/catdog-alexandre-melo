import { buildQuery, type QueryParamValue } from '~/services/api/build-query';
import { request } from '~/services/api/http-client';

/**
 * Os tres endpoints PUBLICOS da vitrine, no molde de `auth-api.ts`: uma funcao
 * por endpoint, sem `try/catch`, sem estado e sem React.
 *
 * ============ `skipRefresh` NAS TRES, E ESTA E A DECISAO CENTRAL ============
 *
 * Sem ela, um access token VENCIDO no armazenamento faria a vitrine disparar uma
 * renovacao de sessao — e, na falha dela, o `onSessionExpired` registrado pelo
 * `AuthProvider` mandaria o visitante para o login. De dentro da unica tela do
 * produto que nao exige sessao.
 *
 * A vitrine e publica e NAO PODE DEPENDER do desfecho de nenhuma renovacao
 * (RN-05, CA-04, RNF-13). Nenhuma das tres envia `Authorization`, e nenhuma exige
 * que exista token: `anonymous` e o caso normal.
 *
 * ============ NENHUMA LINHA DO `http-client.ts` FOI TOCADA ============
 *
 * Ele abriga a fila single-flight de renovacao e e o ponto de maior risco de
 * regressao do frontend. A FEATURE-002 do MODULE-001 o alterou porque envio de
 * arquivo nao tem alternativa; cadeia de parametros tem — e o `buildQuery` que
 * ela entregou ja resolve (Decisao E).
 */

/**
 * A PROJECAO PUBLICA, espelhada campo a campo. Conjunto FECHADO: o backend tem um
 * teste que compara as chaves por igualdade, e este tipo e o outro lado do mesmo
 * contrato.
 *
 * Anulaveis sao `| null` e NAO `?`: sob `exactOptionalPropertyTypes` os dois
 * significam coisas diferentes, e o backend envia a chave com valor `null` — nao
 * a omite. Declarar `?` faria a tela tratar "ausente" onde o dado diz "nulo".
 */
export interface PublicAnimal {
  readonly id: string;
  readonly name: string;
  readonly species: { readonly id: string; readonly name: string };
  readonly size: 'pequeno' | 'medio' | 'grande';
  readonly sex: 'macho' | 'femea';
  /** `null` e "nao informada"; `0` e "menos de um ano". Os dois precisam ser tratados. */
  readonly ageInYears: number | null;
  readonly ageInMonths: number | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly city: { readonly name: string; readonly stateUf: string };
  readonly coverImageUrl: string | null;
}

export interface CatalogSpeciesOption {
  readonly id: string;
  readonly name: string;
}

export interface CatalogCityOption {
  readonly id: string;
  readonly name: string;
  readonly stateUf: string;
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}

/** Envelope de colecao sem paginacao — os dois endpoints de opcoes. */
export interface CollectionResponse<T> {
  readonly items: readonly T[];
}

/**
 * Os filtros JA SANEADOS e JA em ingles. A traducao do endereco da pagina
 * (PT-BR) para estas chaves e da tela (TASK-FRONTEND-009): esta camada transporta.
 */
export interface PublicAnimalFilters {
  readonly search?: string;
  readonly speciesId?: string;
  readonly size?: PublicAnimal['size'];
  readonly sex?: PublicAnimal['sex'];
  readonly maxAgeYears?: number;
  readonly cityId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Trata a cadeia VAZIA como parametro ausente.
 *
 * O `buildQuery` descarta `undefined` mas PRESERVA `''` — deliberadamente, porque
 * para ele texto vazio e um valor. Aqui nao e: um filtro nao aplicado nao deixa
 * parametro (RN-35, RN-48), e `?search=` chegaria ao backend como busca por texto
 * vazio.
 *
 * A conversao mora AQUI, e nao no `buildQuery`, para nao mudar o contrato que a
 * FEATURE-002 congelou e testou.
 */
function textoOuAusente(valor: string | undefined): QueryParamValue {
  return valor === undefined || valor === '' ? undefined : valor;
}

/**
 * Chaves copiadas UMA A UMA, e nao iteradas genericamente.
 *
 * O backend recusa QUALQUER parametro nao previsto com `400` — e a recusa e
 * estrutural, o campo nem existe no schema. Um campo que vazasse do estado da
 * tela (um `loading`, um `selectedId` de outra coisa) quebraria a listagem
 * inteira em vez de ser ignorado. Copiar explicitamente faz o compilador recusar
 * a mudanca antes de o servidor recusar a requisicao — mesma decisao ja
 * registrada no `register` do `auth-api.ts`.
 *
 * `maxAgeYears` comparado contra `undefined`, JAMAIS por veracidade: `0` e valor
 * valido e significativo ("menos de um ano"), e um `if (valor)` o descartaria —
 * transformando um filtro aplicado em filtro ausente, em silencio (RN-41, CT-59).
 *
 * `pageSize` so viaja quando a tela pede algo diferente do padrao: o servidor ja
 * usa 12, e envia-lo redundantemente polui a chamada sem ganho.
 */
export function listPublicAnimals(
  filters: PublicAnimalFilters = {},
): Promise<PaginatedResponse<PublicAnimal>> {
  const query = buildQuery({
    search: textoOuAusente(filters.search),
    speciesId: textoOuAusente(filters.speciesId),
    size: textoOuAusente(filters.size),
    sex: textoOuAusente(filters.sex),
    maxAgeYears: filters.maxAgeYears,
    cityId: textoOuAusente(filters.cityId),
    page: filters.page,
    pageSize: filters.pageSize,
  });

  return request<PaginatedResponse<PublicAnimal>>(`/catalog/animals${query}`, {
    skipRefresh: true,
  });
}

/** As especies que tem ao menos um animal disponivel. Sem parametros. */
export function listCatalogSpecies(): Promise<CollectionResponse<CatalogSpeciesOption>> {
  return request<CollectionResponse<CatalogSpeciesOption>>('/catalog/species', {
    skipRefresh: true,
  });
}

/** As cidades que tem ao menos um animal disponivel. Sem parametros. */
export function listCatalogCities(): Promise<CollectionResponse<CatalogCityOption>> {
  return request<CollectionResponse<CatalogCityOption>>('/catalog/cities', {
    skipRefresh: true,
  });
}
