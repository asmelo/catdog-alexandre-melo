import type { PublicAnimalFilters, PublicAnimal } from '~/services/api/catalog-api';

/**
 * A traducao entre o ENDERECO DA PAGINA e os PARAMETROS DA API.
 *
 * ============ "A TELA TOLERA, A API RECUSA" ============
 *
 * Esta e a regra que governa o arquivo (RN-49, RN-50). Um link colado num app de
 * mensagens chega quebrado o tempo todo — a mensagem corta o final, o app engole
 * um caractere, alguem edita a mao. O visitante que abre esse link precisa ver o
 * CATALOGO, e nao uma tela de erro sobre um parametro que ele nem sabe que
 * existe.
 *
 * `parseShowcaseFilters` NUNCA LANCA e sempre devolve um estado renderizavel. O
 * rigor que protege qualquer consumidor da API fica no SERVIDOR, que responde
 * `400` para os mesmos valores — as duas posturas coexistem por desenho.
 *
 * ============ PT-BR NO ENDERECO, INGLES NA API ============
 *
 * Endereco e interface VISIVEL ao usuario, e o produto e PT-BR; a API segue o
 * ingles do contrato. `toApiFilters` e a UNICA funcao de traducao, na fronteira:
 * duas copias divergiriam no primeiro filtro novo (RN-47).
 */

export type ShowcaseSize = PublicAnimal['size'];
export type ShowcaseSex = PublicAnimal['sex'];

export interface ShowcaseFilters {
  readonly busca: string;
  readonly especie: string | null;
  readonly porte: ShowcaseSize | null;
  readonly sexo: ShowcaseSex | null;
  readonly idadeMax: number | null;
  readonly cidade: string | null;
  readonly pagina: number;
}

/** O estado a que "Limpar filtros" retorna. */
export const EMPTY_FILTERS: ShowcaseFilters = {
  busca: '',
  especie: null,
  porte: null,
  sexo: null,
  idadeMax: null,
  cidade: null,
  pagina: 1,
};

const PORTES: ReadonlyArray<ShowcaseSize> = ['pequeno', 'medio', 'grande'];
const SEXOS: ReadonlyArray<ShowcaseSex> = ['macho', 'femea'];

/** RN-27, o mesmo teto do backend. */
const TAMANHO_MAXIMO_DA_BUSCA = 120;
const IDADE_MAXIMA_ACEITA = 30;

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `busca` acima do teto e TRUNCADA, e nao descartada: quem colou um texto longo
 * quis buscar por ele, e devolver o catalogo inteiro seria mais confuso do que
 * buscar pelos primeiros 120 caracteres.
 */
function lerBusca(bruto: string | null): string {
  return bruto === null ? '' : bruto.trim().slice(0, TAMANHO_MAXIMO_DA_BUSCA);
}

/**
 * UUID bem formado e MANTIDO mesmo que nao esteja entre as opcoes conhecidas.
 *
 * Quem decide que uma especie nao existe e o SERVIDOR, e ele responde `200` com
 * lista vazia — nunca `404` (RN-51, RN-33). Descartar aqui esconderia do
 * visitante o motivo de a lista estar vazia, e ele veria o catalogo inteiro
 * achando que o filtro dele foi aplicado.
 */
function lerIdentificador(bruto: string | null): string | null {
  return bruto !== null && FORMATO_DE_UUID.test(bruto) ? bruto : null;
}

function lerConjunto<Valor extends string>(
  bruto: string | null,
  aceitos: ReadonlyArray<Valor>,
): Valor | null {
  return aceitos.find((valor) => valor === bruto) ?? null;
}

/**
 * `0` E PRESERVADO. Ele significa "menos de um ano" e e um filtro APLICADO —
 * descarta-lo transformaria a escolha do visitante em ausencia de filtro, em
 * silencio (RN-41).
 *
 * Fracionario, negativo, acima de 30 e nao numerico sao descartados. `Number` e
 * nao `parseInt`: o segundo aceitaria `"3abc"` como `3`.
 */
function lerIdadeMaxima(bruto: string | null): number | null {
  if (bruto === null || bruto.trim() === '') {
    return null;
  }

  const valor = Number(bruto);

  if (!Number.isInteger(valor) || valor < 0 || valor > IDADE_MAXIMA_ACEITA) {
    return null;
  }

  return valor;
}

/**
 * Pagina MAIOR que a ultima existente e PRESERVADA: a grade vem vazia com a
 * mensagem de nenhum resultado, e nao com erro (RN-20, CT-76). Quem decide
 * quantas paginas existem e o servidor, e a tela nem sabe o total ainda quando
 * le o endereco.
 */
function lerPagina(bruto: string | null): number {
  if (bruto === null) {
    return 1;
  }

  const valor = Number(bruto);

  return Number.isInteger(valor) && valor >= 1 ? valor : 1;
}

export function parseShowcaseFilters(params: URLSearchParams): ShowcaseFilters {
  return {
    busca: lerBusca(params.get('busca')),
    especie: lerIdentificador(params.get('especie')),
    porte: lerConjunto(params.get('porte'), PORTES),
    sexo: lerConjunto(params.get('sexo'), SEXOS),
    idadeMax: lerIdadeMaxima(params.get('idadeMax')),
    cidade: lerIdentificador(params.get('cidade')),
    pagina: lerPagina(params.get('pagina')),
    /**
     * Parametro DESCONHECIDO e simplesmente ignorado: ele nao e lido, entao nao
     * chega ao estado — e `toSearchParams` o remove do endereco na correcao.
     */
  };
}

/**
 * SO O QUE ESTA APLICADO deixa parametro (RN-48).
 *
 * `busca` vazia, filtro em `null` e `pagina === 1` nao aparecem. E o que faz
 * "Limpar filtros" devolver o endereco SEM NENHUM parametro, em vez de um
 * `?busca=&especie=&pagina=1` que parece filtro aplicado (CA-33, CT-89).
 */
export function toSearchParams(filters: ShowcaseFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.busca !== '') {
    params.set('busca', filters.busca);
  }

  if (filters.especie !== null) {
    params.set('especie', filters.especie);
  }

  if (filters.porte !== null) {
    params.set('porte', filters.porte);
  }

  if (filters.sexo !== null) {
    params.set('sexo', filters.sexo);
  }

  if (filters.idadeMax !== null) {
    // `0` entra: `!== null`, e nunca uma checagem de veracidade.
    params.set('idadeMax', String(filters.idadeMax));
  }

  if (filters.cidade !== null) {
    params.set('cidade', filters.cidade);
  }

  if (filters.pagina !== 1) {
    params.set('pagina', String(filters.pagina));
  }

  return params;
}

/** A UNICA traducao PT-BR → inglês. Na fronteira, e em um lugar so (RN-47). */
export function toApiFilters(filters: ShowcaseFilters): PublicAnimalFilters {
  return {
    ...(filters.busca === '' ? {} : { search: filters.busca }),
    ...(filters.especie === null ? {} : { speciesId: filters.especie }),
    ...(filters.porte === null ? {} : { size: filters.porte }),
    ...(filters.sexo === null ? {} : { sex: filters.sexo }),
    ...(filters.idadeMax === null ? {} : { maxAgeYears: filters.idadeMax }),
    ...(filters.cidade === null ? {} : { cityId: filters.cidade }),
    page: filters.pagina,
  };
}

/**
 * Governa o botao "Limpar filtros", o resumo de resultados e a escolha entre as
 * duas mensagens de vazio.
 *
 * `pagina` NAO conta como filtro: estar na pagina 3 nao e um criterio a limpar, e
 * incluí-la faria o botao ficar habilitado numa vitrine sem filtro nenhum.
 */
export function hasActiveFilters(filters: ShowcaseFilters): boolean {
  return (
    filters.busca !== '' ||
    filters.especie !== null ||
    filters.porte !== null ||
    filters.sexo !== null ||
    filters.idadeMax !== null ||
    filters.cidade !== null
  );
}
