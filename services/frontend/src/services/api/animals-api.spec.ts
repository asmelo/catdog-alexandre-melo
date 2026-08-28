import type { Animal } from '~/domains/animals/animal.types';
import {
  changeAnimalStatus,
  createAnimal,
  deleteAnimal,
  getAnimal,
  listAnimals,
  updateAnimal,
} from '~/services/api/animals-api';
import { ApiError } from '~/services/api/api-error';
import { listCitiesByState, listStates } from '~/services/api/geography-api';

/**
 * Specs das camadas de endpoint de `/api/animals` e `/api/states`.
 *
 * O ESPIAO E O DE `fetch`, e nao o de `request` — mesma razao registrada em
 * `species-api.spec.ts`: o que precisa casar com o backend e a URL que o
 * navegador emite (`/api/animals?page=2`), o verbo que o CORS libera e o
 * cabecalho que o multipart exige que esteja AUSENTE. Nada disso e visivel
 * dublando `request`.
 */

const URL_DA_LISTA = '/api/animals';
const ID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const URL_DO_ITEM = `${URL_DA_LISTA}/${ID}`;

const THEO: Animal = {
  id: ID,
  name: 'Theo',
  species: { id: '11111111-1111-4111-8111-111111111111', name: 'Cachorro' },
  size: 'grande',
  sex: 'macho',
  status: 'disponivel',
  birthDate: '2022-11-05',
  ageInYears: 3,
  description: null,
  acceptsOtherAnimals: false,
  needsLargeSpace: true,
  city: { id: '22222222-2222-4222-8222-222222222222', name: 'Boa Esperança', stateUf: 'ES' },
  images: [],
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

function respostaSemConteudo(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as Response;
}

function envelopeDeErro(code: string, message: string): unknown {
  return { error: { code, message } };
}

type EspiaoDeFetch = jest.SpyInstance<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>;

function instalarFetch(resposta: Response): EspiaoDeFetch {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue(resposta);
}

function chamada(espiao: EspiaoDeFetch): {
  readonly url: string;
  readonly metodo: string | undefined;
  readonly corpo: unknown;
  readonly corpoBruto: BodyInit | null | undefined;
  readonly init: RequestInit;
} {
  const [entrada, init] = espiao.mock.calls[0] ?? [];
  const opcoes = init ?? {};
  const corpoBruto = opcoes.body;

  return {
    url: String(entrada),
    metodo: opcoes.method,
    corpo: typeof corpoBruto === 'string' ? (JSON.parse(corpoBruto) as unknown) : undefined,
    corpoBruto,
    init: opcoes,
  };
}

describe('animals-api — listAnimals', () => {
  it('monta a query com page e pageSize', async () => {
    // Arrange
    const espiao = instalarFetch(
      respostaJson(200, { items: [], pagination: { page: 2, pageSize: 50, total: 0 } }),
    );

    // Act
    await listAnimals({ page: 2, pageSize: 50 });

    // Assert
    expect(chamada(espiao).url).toBe(`${URL_DA_LISTA}?page=2&pageSize=50`);
    expect(chamada(espiao).metodo).toBe('GET');
    expect(chamada(espiao).init).not.toHaveProperty('body');
  });

  it('sem parâmetro, requisita SEM query — para o backend aplicar os padrões da RN-42', async () => {
    // Arrange
    const espiao = instalarFetch(
      respostaJson(200, { items: [], pagination: { page: 1, pageSize: 20, total: 0 } }),
    );

    // Act
    await listAnimals();

    // Assert — `?page=` chegaria como texto vazio e viraria `400`, e não o padrão.
    expect(chamada(espiao).url).toBe(URL_DA_LISTA);
  });

  it('devolve o envelope `{ items, pagination }` sem desembrulhar', async () => {
    // Arrange
    const pagina = { items: [THEO], pagination: { page: 1, pageSize: 20, total: 1 } };
    instalarFetch(respostaJson(200, pagina));

    // Act & Assert
    await expect(listAnimals()).resolves.toEqual(pagina);
  });
});

describe('animals-api — getAnimal', () => {
  it('GET /api/animals/:id', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, THEO));

    // Act
    await getAnimal(ID);

    // Assert
    expect(chamada(espiao).url).toBe(URL_DO_ITEM);
    expect(chamada(espiao).metodo).toBe('GET');
  });
});

describe('animals-api — createAnimal', () => {
  it('POST com o próprio FormData e SEM Content-Type definido pela camada de API', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(201, THEO));
    const formulario = new FormData();

    formulario.append('name', 'Theo');

    // Act
    await createAnimal(formulario);

    // Assert — o mesmo objeto, e não um equivalente: reconstruí-lo perderia os
    // arquivos. E o cabeçalho ausente é o que deixa o navegador escrever o
    // `boundary`.
    expect(chamada(espiao).url).toBe(URL_DA_LISTA);
    expect(chamada(espiao).metodo).toBe('POST');
    expect(chamada(espiao).corpoBruto).toBe(formulario);
    expect(chamada(espiao).init.headers).not.toHaveProperty('Content-Type');
  });
});

describe('animals-api — updateAnimal', () => {
  it('PATCH, e nunca PUT — o CORS em vigor não libera o verbo', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, THEO));
    const formulario = new FormData();

    // Act
    await updateAnimal(ID, formulario);

    // Assert
    expect(chamada(espiao).url).toBe(URL_DO_ITEM);
    expect(chamada(espiao).metodo).toBe('PATCH');
    expect(chamada(espiao).corpoBruto).toBe(formulario);
  });
});

describe('animals-api — changeAnimalStatus', () => {
  it('PATCH /:id/status com corpo JSON contendo EXATAMENTE status e updatedAt', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, THEO));

    // Act
    await changeAnimalStatus(ID, { status: 'reservado', updatedAt: THEO.updatedAt });

    // Assert — `toEqual` sobre o objeto inteiro, e não `toMatchObject`: o schema
    // do backend reprova QUALQUER chave extra (CT-75), então um campo a mais aqui
    // viraria `400` em produção.
    expect(chamada(espiao).url).toBe(`${URL_DO_ITEM}/status`);
    expect(chamada(espiao).metodo).toBe('PATCH');
    expect(chamada(espiao).corpo).toEqual({
      status: 'reservado',
      updatedAt: '2026-08-25T12:00:00.000Z',
    });
    expect(chamada(espiao).init.headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });
});

describe('animals-api — deleteAnimal', () => {
  it('DELETE /:id e resolve para undefined no 204', async () => {
    // Arrange
    const espiao = instalarFetch(respostaSemConteudo());

    // Act & Assert
    await expect(deleteAnimal(ID)).resolves.toBeUndefined();

    expect(chamada(espiao).url).toBe(URL_DO_ITEM);
    expect(chamada(espiao).metodo).toBe('DELETE');
    expect(chamada(espiao).init).not.toHaveProperty('body');
  });
});

describe('animals-api — propagação de erro', () => {
  it('o ApiError sobe sem ser capturado nem reescrito', async () => {
    // Arrange
    instalarFetch(
      respostaJson(
        409,
        envelopeDeErro(
          'ANIMAL_STALE_UPDATE',
          'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
        ),
      ),
    );

    // Act
    const recusa = changeAnimalStatus(ID, { status: 'adotado', updatedAt: THEO.updatedAt });

    // Assert — a mensagem chega do backend PRONTA. É por isso que ela não está no
    // catálogo do frontend: duplicá-la criaria duas verdades.
    await expect(recusa).rejects.toBeInstanceOf(ApiError);
    await expect(recusa).rejects.toMatchObject({
      status: 409,
      code: 'ANIMAL_STALE_UPDATE',
      message: 'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
    });
  });
});

describe('geography-api', () => {
  it('listStates: GET /api/states, devolvendo o envelope `{ items }`', async () => {
    // Arrange
    const estados = { items: [{ uf: 'ES', name: 'Espírito Santo' }] };
    const espiao = instalarFetch(respostaJson(200, estados));

    // Act & Assert
    await expect(listStates()).resolves.toEqual(estados);

    expect(chamada(espiao).url).toBe('/api/states');
    expect(chamada(espiao).metodo).toBe('GET');
  });

  it('listCitiesByState: GET /api/states/:uf/cities', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, { items: [] }));

    // Act
    await listCitiesByState('ES');

    // Assert
    expect(chamada(espiao).url).toBe('/api/states/ES/cities');
  });
});
