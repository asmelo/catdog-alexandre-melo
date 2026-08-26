import { ApiError } from '~/services/api/api-error';
import {
  createSpecies,
  deleteSpecies,
  listSpecies,
  renameSpecies,
  type Species,
} from '~/services/api/species-api';

/**
 * Specs da camada de endpoints de `/api/species`.
 *
 * O ESPIAO E O DE `fetch`, e nao o de `request`. A diferenca importa: dublar
 * `request` afirmaria o caminho LOGICO (`/species`), enquanto o que precisa casar
 * com o backend e a URL que o navegador emite (`/api/species`) e o VERBO que o
 * CORS libera. `auth-api.spec.ts` dubla `request` porque as rotas de sessao
 * dependem de `skipRefresh`, que so e visivel naquele nivel; aqui NENHUMA das
 * quatro funcoes passa `skipRefresh` (um `401` nestas rotas e o gatilho legitimo
 * de renovacao), entao o nivel util e o de baixo.
 *
 * O `fetch` que o `jsdom` NAO implementa e instalado por `tests/setup.ts` como uma
 * funcao que LANCA — a guarda de rede. Cada teste daqui a substitui por um dublê;
 * o `restoreAllMocks` do setup devolve a guarda depois.
 */

const URL_DA_LISTA = '/api/species';
const ID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const URL_DO_ITEM = `${URL_DA_LISTA}/${ID}`;

const GATO: Species = {
  id: ID,
  name: 'Gato',
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

/**
 * `Response` falsa com apenas o que o `http-client` consome (`ok`, `status`,
 * `json`). Mesma tecnica de `http-client.spec.ts`: o `jsdom` nao implementa a
 * Fetch API e trazer um polyfill para produzir um objeto de tres propriedades
 * seria custo sem retorno.
 */
function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

/** `204` do DELETE: sem corpo, e `json()` que LANCA se alguem tentar le-lo. */
function respostaSemConteudo(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as Response;
}

/** Envelope de erro do backend, congelado nas TASK-BACKEND-004/005/006. */
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

/** A chamada capturada, decomposta nos quatro valores que formam o contrato. */
function chamada(espiao: EspiaoDeFetch): {
  readonly url: string;
  readonly metodo: string | undefined;
  readonly corpo: unknown;
  readonly init: RequestInit;
} {
  const [entrada, init] = espiao.mock.calls[0] ?? [];
  const opcoes = init ?? {};
  const corpoBruto = opcoes.body;

  return {
    url: String(entrada),
    metodo: opcoes.method,
    corpo: typeof corpoBruto === 'string' ? (JSON.parse(corpoBruto) as unknown) : undefined,
    init: opcoes,
  };
}

describe('species-api — listSpecies', () => {
  it('CT-13: GET /api/species, sem query string e sem corpo', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, { items: [GATO] }));

    // Act
    await listSpecies();

    // Assert
    // Sem parametros: a listagem nao tem paginacao nem filtro (RN-12), e o
    // `http-client` nao oferece construtor de query justamente por isso.
    expect(espiao).toHaveBeenCalledTimes(1);
    expect(chamada(espiao).url).toBe(URL_DA_LISTA);
    expect(chamada(espiao).metodo).toBe('GET');
    expect(chamada(espiao).init).not.toHaveProperty('body');
  });

  it('listSpecies devolve o ENVELOPE `{ items }`, e NAO desembrulha o array', async () => {
    // Arrange
    instalarFetch(respostaJson(200, { items: [GATO] }));

    // Act
    const resposta = await listSpecies();

    // Assert
    /**
     * O envelope existe para ganhar metadados no futuro. Desembrulhar aqui
     * obrigaria a mudar a assinatura desta funcao — e todos os seus chamadores —
     * no dia em que o primeiro metadado aparecer. Quem consome e que le `.items`
     * (`use-species-collection.ts`).
     */
    expect(resposta).toEqual({ items: [GATO] });
    expect(Array.isArray(resposta)).toBe(false);
    expect(resposta.items).toEqual([GATO]);
  });

  it('CT-15: a lista vazia chega como `{ items: [] }`, e nao como ausencia de resposta', async () => {
    // Arrange
    instalarFetch(respostaJson(200, { items: [] }));

    // Act
    const resposta = await listSpecies();

    // Assert
    expect(resposta.items).toEqual([]);
  });
});

describe('species-api — createSpecies', () => {
  it('CT-01: POST /api/species com o corpo contendo EXATAMENTE a chave `name`', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(201, GATO));

    // Act
    await createSpecies('  Gato  ');

    // Assert
    const enviada = chamada(espiao);

    expect(enviada.url).toBe(URL_DA_LISTA);
    expect(enviada.metodo).toBe('POST');
    /**
     * O schema do backend recusa QUALQUER chave extra com `400 VALIDATION_ERROR`
     * (RN-13): um campo que vazasse do estado do formulario quebraria a criacao.
     */
    expect(Object.keys((enviada.corpo ?? {}) as object)).toEqual(['name']);
  });

  it('CT-10: o `name` enviado e o texto DIGITADO — nada e normalizado antes de sair daqui', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(201, GATO));

    // Act
    await createSpecies(' Cão   Pastor ');

    // Assert
    // A autoridade sobre a forma gravada (RN-03) e o servidor. Normalizar aqui
    // deslocaria a regra para o cliente, onde ela nao pode ser garantida.
    expect(chamada(espiao).corpo).toEqual({ name: ' Cão   Pastor ' });
  });

  it('createSpecies devolve o recurso PLANO do `201`, sem envelope', async () => {
    // Arrange
    instalarFetch(respostaJson(201, GATO));

    // Act
    const criada = await createSpecies('Gato');

    // Assert
    expect(criada).toEqual(GATO);
  });
});

describe('species-api — renameSpecies', () => {
  it('CT-16: PATCH /api/species/:id com o `id` interpolado no caminho', async () => {
    // Arrange
    const espiao = instalarFetch(respostaJson(200, { ...GATO, name: 'Perereca' }));

    // Act
    await renameSpecies(ID, 'Perereca');

    // Assert
    const enviada = chamada(espiao);

    expect(enviada.url).toBe(URL_DO_ITEM);
    expect(enviada.metodo).toBe('PATCH');
    expect(enviada.corpo).toEqual({ name: 'Perereca' });
  });

  it('renameSpecies devolve o recurso ATUALIZADO, com o mesmo identificador', async () => {
    // Arrange
    instalarFetch(respostaJson(200, { ...GATO, name: 'Perereca' }));

    // Act
    const atualizada = await renameSpecies(ID, 'Perereca');

    // Assert
    // CT-16 cobra que o identificador nao mude: renomear e alteracao parcial, e
    // nao substituicao do recurso.
    expect(atualizada.id).toBe(ID);
    expect(atualizada.name).toBe('Perereca');
  });
});

describe('species-api — deleteSpecies', () => {
  it('CT-22: DELETE /api/species/:id, sem corpo', async () => {
    // Arrange
    const espiao = instalarFetch(respostaSemConteudo());

    // Act
    await deleteSpecies(ID);

    // Assert
    const enviada = chamada(espiao);

    expect(enviada.url).toBe(URL_DO_ITEM);
    expect(enviada.metodo).toBe('DELETE');
    expect(enviada.init).not.toHaveProperty('body');
  });

  it('CT-22: o `204` resolve sem erro de parsing — o corpo vazio nao passa pelo `json()`', async () => {
    // Arrange
    instalarFetch(respostaSemConteudo());

    // Act
    const resultado = await deleteSpecies(ID);

    // Assert
    // Corpo vazio faria o parser lancar `SyntaxError`, e a exclusao quebraria
    // justamente quando funcionou.
    expect(resultado).toBeUndefined();
  });
});

describe('species-api — verbos e propagacao de erro', () => {
  it('NENHUMA das quatro funcoes usa PUT: a configuracao de CORS em vigor nao libera o verbo', async () => {
    // Arrange
    const espiao = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(respostaJson(200, { items: [] }))
      .mockResolvedValueOnce(respostaJson(201, GATO))
      .mockResolvedValueOnce(respostaJson(200, GATO))
      .mockResolvedValueOnce(respostaSemConteudo());

    // Act
    await listSpecies();
    await createSpecies('Gato');
    await renameSpecies(ID, 'Gato');
    await deleteSpecies(ID);

    // Assert
    const verbos = espiao.mock.calls.map(([, init]) => init?.method);

    // `PATCH` e nao `PUT` por duas razoes independentes: o nome e o unico atributo
    // mutavel (alteracao parcial) e o CORS em vigor nao libera `PUT`.
    expect(verbos).toEqual(['GET', 'POST', 'PATCH', 'DELETE']);
    expect(verbos).not.toContain('PUT');
  });

  it('CT-08: o ApiError de um 409 SOBE — a funcao REJEITA em vez de resolver', async () => {
    // Arrange
    const mensagemDoServidor = 'Já existe uma espécie com este nome.';

    instalarFetch(
      respostaJson(409, envelopeDeErro('SPECIES_NAME_ALREADY_EXISTS', mensagemDoServidor)),
    );

    // Act
    const promessa = createSpecies('gato');

    // Assert
    /**
     * NENHUMA funcao deste modulo contem `try`/`catch`: e a TELA, e nao esta
     * camada, que sabe se um `SPECIES_NAME_ALREADY_EXISTS` deve marcar o campo da
     * linha em edicao ou o da linha de criacao. Uma funcao que resolvesse com um
     * resultado de erro obrigaria cada chamador a inspecionar o retorno.
     */
    await expect(promessa).rejects.toBeInstanceOf(ApiError);
    await expect(promessa).rejects.toMatchObject({
      status: 409,
      code: 'SPECIES_NAME_ALREADY_EXISTS',
      // A `message` sobe COMO VEIO do servidor: este arquivo nao possui copia
      // dela (CA-22).
      message: mensagemDoServidor,
    });
  });

  it('CT-24: o 409 SPECIES_IN_USE da exclusao tambem sobe intacto', async () => {
    // Arrange
    const mensagemDoServidor =
      'Não é possível excluir esta espécie porque existem animais vinculados a ela.';

    instalarFetch(respostaJson(409, envelopeDeErro('SPECIES_IN_USE', mensagemDoServidor)));

    // Act & Assert
    await expect(deleteSpecies(ID)).rejects.toMatchObject({
      code: 'SPECIES_IN_USE',
      message: mensagemDoServidor,
    });
  });

  it('CT-20: o 404 SPECIES_NOT_FOUND da renomeacao sobe com o `code` que a tela ramifica', async () => {
    // Arrange
    instalarFetch(respostaJson(404, envelopeDeErro('SPECIES_NOT_FOUND', 'Espécie não encontrada.')));

    // Act & Assert
    await expect(renameSpecies(ID, 'Perereca')).rejects.toMatchObject({
      status: 404,
      code: 'SPECIES_NOT_FOUND',
    });
  });
});
