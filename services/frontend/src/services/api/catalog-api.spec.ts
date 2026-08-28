import { ApiError } from '~/services/api/api-error';
import {
  listCatalogCities,
  listCatalogSpecies,
  listPublicAnimals,
} from '~/services/api/catalog-api';

/**
 * A camada de endpoints da vitrine.
 *
 * O ESPIAO E O DE `fetch`, e nao o de `request`: o que precisa casar com o
 * backend e a URL que o navegador emite, a codificacao dos parametros e a
 * AUSENCIA de `Authorization`. Dublar `request` esconderia os tres.
 *
 * O `skipRefresh` e a excecao — ele so e visivel um nivel acima —, e por isso o
 * caso que o verifica observa o EFEITO: um `401` que NAO dispara renovacao.
 */

const URL_DA_LISTAGEM = '/api/catalog/animals';

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

type EspiaoDeFetch = jest.SpyInstance<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>;

function instalarFetch(resposta: Response): EspiaoDeFetch {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue(resposta);
}

function urlChamada(espiao: EspiaoDeFetch): string {
  return String(espiao.mock.calls[0]?.[0] ?? '');
}

function queryDe(espiao: EspiaoDeFetch): URLSearchParams {
  return new URL(urlChamada(espiao), 'http://local').searchParams;
}

const PAGINA_VAZIA = { items: [], pagination: { page: 1, pageSize: 12, total: 0 } };

describe('listPublicAnimals — montagem da query', () => {
  it('codifica acento e espaço corretamente — nenhuma concatenação manual', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    // Act
    await listPublicAnimals({ search: 'são paulo' });

    // Assert — a busca desta feature é justamente por texto acentuado; concatenar
    // erraria a codificação.
    expect(urlChamada(espiao)).toBe(`${URL_DA_LISTAGEM}?search=s%C3%A3o+paulo`);
    expect(queryDe(espiao).get('search')).toBe('são paulo');
  });

  it('`maxAgeYears: 0` ESTÁ presente — zero é filtro aplicado, não ausência', async () => {
    // Arrange — um `if (valor)` o descartaria, transformando um filtro aplicado
    // em filtro ausente, em silêncio (RN-41, CT-59).
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    // Act
    await listPublicAnimals({ maxAgeYears: 0 });

    // Assert
    expect(queryDe(espiao).get('maxAgeYears')).toBe('0');
  });

  it('cadeia vazia e `undefined` NÃO viram parâmetro', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    // Act
    await listPublicAnimals({ search: '', speciesId: undefined, size: undefined });

    // Assert — `?search=` chegaria ao backend como busca por texto vazio.
    expect(urlChamada(espiao)).toBe(URL_DA_LISTAGEM);
  });

  it('sem filtro nenhum, a URL não tem query', async () => {
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    await listPublicAnimals();

    expect(urlChamada(espiao)).toBe(URL_DA_LISTAGEM);
  });

  it('só `page: 1` produz apenas `page=1`', async () => {
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    await listPublicAnimals({ page: 1 });

    expect(urlChamada(espiao)).toBe(`${URL_DA_LISTAGEM}?page=1`);
  });

  it('envia todos os filtros aplicados, e SÓ eles', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    // Act
    await listPublicAnimals({
      search: 'theo',
      speciesId: 'e1',
      size: 'grande',
      sex: 'macho',
      maxAgeYears: 3,
      cityId: 'c1',
      page: 2,
      pageSize: 24,
    });

    // Assert — o backend recusa qualquer parâmetro não previsto com 400, então a
    // lista exata importa.
    expect([...queryDe(espiao).keys()].sort()).toEqual([
      'cityId',
      'maxAgeYears',
      'page',
      'pageSize',
      'search',
      'sex',
      'size',
      'speciesId',
    ]);
  });

  it('não envia `pageSize` quando a tela usa o padrão do servidor', async () => {
    const espiao = instalarFetch(respostaJson(200, PAGINA_VAZIA));

    await listPublicAnimals({ page: 3 });

    expect(queryDe(espiao).has('pageSize')).toBe(false);
  });
});

describe('as três chamadas são PÚBLICAS', () => {
  it.each([
    { nome: 'listPublicAnimals', chamar: () => listPublicAnimals(), url: URL_DA_LISTAGEM },
    { nome: 'listCatalogSpecies', chamar: () => listCatalogSpecies(), url: '/api/catalog/species' },
    { nome: 'listCatalogCities', chamar: () => listCatalogCities(), url: '/api/catalog/cities' },
  ])('$nome chama $url sem cabeçalho `Authorization`', async ({ chamar, url }) => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, { items: [], pagination: PAGINA_VAZIA.pagination }));

    // Act
    await chamar();

    // Assert
    expect(urlChamada(espiao)).toBe(url);
    expect(espiao.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });
});

describe('CT-03/CA-04: um 401 NÃO dispara renovação de sessão', () => {
  it.each([
    { nome: 'listPublicAnimals', chamar: () => listPublicAnimals() },
    { nome: 'listCatalogSpecies', chamar: () => listCatalogSpecies() },
    { nome: 'listCatalogCities', chamar: () => listCatalogCities() },
  ])('$nome não emite `POST /auth/refresh`', async ({ chamar }) => {
    // Arrange — o efeito observável do `skipRefresh`. Sem ele, um token vencido
    // no armazenamento faria a vitrine renovar a sessão e, na falha, mandar o
    // visitante ao login — de dentro da única tela que não exige sessão.
    const espiao = instalarFetch(
      respostaJson(401, { error: { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou.' } }),
    );

    // Act
    await expect(chamar()).rejects.toBeInstanceOf(ApiError);

    // Assert — uma única requisição: a original. Nenhuma tentativa de renovação,
    // e nenhuma segunda tentativa da chamada.
    expect(espiao).toHaveBeenCalledTimes(1);
    expect(espiao.mock.calls.every(([entrada]) => !String(entrada).includes('/auth/refresh'))).toBe(
      true,
    );
  });
});

describe('resposta e erro', () => {
  it('o envelope chega INTACTO, sem desembrulhar', async () => {
    // Arrange
    const pagina = {
      items: [{ id: 'a1', name: 'Theo' }],
      pagination: { page: 1, pageSize: 12, total: 1 },
    };

    instalarFetch(respostaJson(200, pagina));

    // Act & Assert
    await expect(listPublicAnimals()).resolves.toEqual(pagina);
  });

  it('as opções vêm no envelope `{ items }`, sem `pagination`', async () => {
    instalarFetch(respostaJson(200, { items: [{ id: 'e1', name: 'Cachorro' }] }));

    await expect(listCatalogSpecies()).resolves.toEqual({
      items: [{ id: 'e1', name: 'Cachorro' }],
    });
  });

  it('o `ApiError` SOBE — nenhuma das três o captura', async () => {
    // Arrange
    instalarFetch(
      respostaJson(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos informados.',
          details: [{ field: 'status', message: 'Campo não permitido nesta requisição.' }],
        },
      }),
    );

    // Act & Assert
    await expect(listPublicAnimals()).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });
});
