import { getAccessToken, setAccessToken } from '~/services/api/access-token-store';
import { ApiError } from '~/services/api/api-error';
import {
  markSessionRestored,
  request,
  setOnSessionExpired,
  setSessionRefresher,
} from '~/services/api/http-client';

/**
 * Specs do ponto unico de saida HTTP do frontend.
 *
 * O ESTADO DE MODULO deste arquivo (renovador registrado, callback de expiracao e
 * a promessa da fila single-flight) NAO e reiniciado por `jest.resetModules` aqui:
 * `tests/setup.ts` o zera em `afterEach` chamando as tres funcoes que o proprio
 * modulo expoe. Recarregar o modulo funcionaria, mas produziria uma classe
 * `ApiError` nova por teste e cada `instanceof` passaria a comparar identidades
 * diferentes — falha confusa por um motivo que nao e o do teste.
 */

const URL_DA_API = '/api';
const CAMINHO_PROTEGIDO = '/animais';
const URL_PROTEGIDA = `${URL_DA_API}${CAMINHO_PROTEGIDO}`;
const URL_DE_REFRESH = `${URL_DA_API}/auth/refresh`;

/** Envelope de erro do backend, congelado nas TASK-BACKEND-004/005/006. */
function envelopeDeErro(code: string, message: string, details?: unknown): unknown {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

/**
 * `Response` falsa com apenas o que `interpretar`/`erroDaResposta` consomem
 * (`ok`, `status`, `json`).
 *
 * Nao ha `Response` de verdade a construir: o `jsdom` nao implementa a Fetch API,
 * e trazer um polyfill para produzir um objeto do qual o modulo le tres
 * propriedades seria custo sem retorno.
 */
function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

/** `204` do logout: corpo vazio, e `json()` que LANCA se alguem tentar le-lo. */
function respostaSemConteudo(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as Response;
}

/** Resposta nao-ok que nao traz o envelope do projeto (HTML de gateway, por exemplo). */
function respostaSemEnvelope(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  } as unknown as Response;
}

type Roteador = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Instala o dublê de `fetch` sobre a guarda de rede de `tests/setup.ts`.
 *
 * O roteador recebe a URL JA MONTADA, o que faz cada teste afirmar o caminho real
 * que o navegador emitiria (`/api/auth/refresh`) em vez do caminho logico
 * (`/auth/refresh`) — e e assim que o escopo do cookie `Path=/api/auth` fica
 * protegido por teste.
 */
function instalarFetch(roteador: Roteador): jest.SpyInstance<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
> {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((entrada: RequestInfo | URL, init?: RequestInit) =>
      roteador(String(entrada), init ?? {}),
    );
}

function chamadasPara(
  espiao: jest.SpyInstance<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>,
  url: string,
): ReadonlyArray<RequestInit> {
  return espiao.mock.calls
    .filter(([entrada]) => String(entrada) === url)
    .map(([, init]) => init ?? {});
}

interface Diferido<T> {
  readonly promessa: Promise<T>;
  readonly resolver: (valor: T) => void;
  readonly rejeitar: (motivo: unknown) => void;
}

/**
 * Promessa com resolucao MANUAL.
 *
 * E a peca central do teste de concorrencia. Sem ela o teste depende de a
 * renovacao demorar mais do que os tres `401`, o que e verdade por acidente e
 * deixa de ser no primeiro ambiente mais lento — e um teste que passa por
 * acidente nao protege nada. Com o diferido, os tres `401` estao
 * COMPROVADAMENTE na fila no momento da asserção.
 */
function criarDiferido<T>(): Diferido<T> {
  let resolver: (valor: T) => void = () => undefined;
  let rejeitar: (motivo: unknown) => void = () => undefined;

  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });

  return { promessa, resolver, rejeitar };
}

/**
 * Cede a fila de macrotasks, garantindo que TODA microtask pendente foi drenada.
 *
 * `await Promise.resolve()` avancaria um unico degrau da cadeia de `await` de cada
 * requisicao; um timer de 0 ms roda depois de a fila de microtasks esvaziar, que e
 * exatamente a condicao que o teste de concorrencia precisa afirmar.
 *
 * `setTimeout` e nao `setImmediate`: o `jest-environment-jsdom` do Jest 29 nao
 * injeta `setImmediate` no ambiente (verificado — a chamada falha com
 * `ReferenceError`), e trazer o polyfill do Node para uma cessao de controle seria
 * dependencia sem retorno.
 */
function cederOControle(): Promise<void> {
  return new Promise<void>((resolver) => {
    setTimeout(resolver, 0);
  });
}

/** Sessao devolvida por `POST /auth/refresh`. O refresh token nao vem aqui: ele sai no cookie `HttpOnly`. */
const SESSAO_RENOVADA = {
  accessToken: 'access-token-renovado',
  expiresIn: 900,
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Caio Cliente',
    email: 'caio.cliente@catdog.test',
    role: 'cliente',
  },
};

/**
 * Renovador REALISTA: passa pelo proprio `request`, portanto emite um `fetch` de
 * verdade para `/api/auth/refresh` e permite contar as chamadas — que e o que a
 * AC #3 exige. Um `jest.fn()` que apenas resolvesse provaria menos: contaria
 * invocacoes do dublê, nao requisicoes.
 */
function renovadorQuePassaPelaRede(): jest.Mock<Promise<void>, []> {
  return jest.fn(async () => {
    const sessao = await request<typeof SESSAO_RENOVADA>('/auth/refresh', { method: 'POST' });

    setAccessToken(sessao.accessToken);
  });
}

describe('http-client — requisicao base', () => {
  it('envia credentials: "include" e Accept em toda requisicao', async () => {
    const espiao = instalarFetch(() => Promise.resolve(respostaJson(200, { ok: true })));

    await request(CAMINHO_PROTEGIDO);

    const [init] = chamadasPara(espiao, URL_PROTEGIDA);

    expect(init).toBeDefined();
    // `credentials: 'include'` e o que faz o navegador anexar o cookie
    // `catdog_rt`. Sem ele o refresh chega sem credencial e volta `401`.
    expect(init?.credentials).toBe('include');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ Accept: 'application/json' });
  });

  it('envia credentials: "include" tambem na requisicao com corpo', async () => {
    const espiao = instalarFetch(() => Promise.resolve(respostaJson(201, { criado: true })));

    await request(CAMINHO_PROTEGIDO, { method: 'POST', body: { nome: 'Rex' } });

    const [init] = chamadasPara(espiao, URL_PROTEGIDA);

    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe(JSON.stringify({ nome: 'Rex' }));
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('omite Content-Type quando nao ha corpo', async () => {
    const espiao = instalarFetch(() => Promise.resolve(respostaJson(200, {})));

    await request(CAMINHO_PROTEGIDO);

    const [init] = chamadasPara(espiao, URL_PROTEGIDA);

    expect(init?.headers).not.toHaveProperty('Content-Type');
  });

  it('anexa Authorization quando existe access token e omite quando nao existe', async () => {
    const espiao = instalarFetch(() => Promise.resolve(respostaJson(200, {})));

    await request(CAMINHO_PROTEGIDO);
    setAccessToken('token-de-teste');
    await request(CAMINHO_PROTEGIDO);

    const [semToken, comToken] = chamadasPara(espiao, URL_PROTEGIDA);

    expect(semToken?.headers).not.toHaveProperty('Authorization');
    expect(comToken?.headers).toMatchObject({ Authorization: 'Bearer token-de-teste' });
  });

  it('devolve o corpo desserializado em resposta ok', async () => {
    instalarFetch(() => Promise.resolve(respostaJson(200, { id: 'a1', nome: 'Rex' })));

    await expect(request(CAMINHO_PROTEGIDO)).resolves.toEqual({ id: 'a1', nome: 'Rex' });
  });

  it('nao passa o 204 pelo parser de JSON', async () => {
    instalarFetch(() => Promise.resolve(respostaSemConteudo()));

    // O `json()` do dublê REJEITA de proposito: se o modulo o chamasse, este
    // teste falharia com SyntaxError em vez de resolver para `undefined`.
    await expect(
      request<void>('/auth/logout', { method: 'POST', skipRefresh: true }),
    ).resolves.toBeUndefined();
  });
});

describe('http-client — traducao de erro', () => {
  it('reconstitui o envelope do backend em ApiError com code, message e details', async () => {
    instalarFetch(() =>
      Promise.resolve(
        respostaJson(
          400,
          envelopeDeErro('VALIDATION_ERROR', 'Informe um e-mail válido.', [
            { field: 'email', message: 'Informe um e-mail válido.' },
          ]),
        ),
      ),
    );

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido.',
      details: [{ field: 'email', message: 'Informe um e-mail válido.' }],
    });
  });

  it('descarta details que nao e lista e details cujos itens nao tem a forma esperada', async () => {
    const corpos: readonly unknown[] = [
      envelopeDeErro('VALIDATION_ERROR', 'Erro.', 'nao-e-lista'),
      envelopeDeErro('VALIDATION_ERROR', 'Erro.', [{ campo: 'email' }, 42, null]),
      envelopeDeErro('VALIDATION_ERROR', 'Erro.', []),
    ];

    for (const corpo of corpos) {
      instalarFetch(() => Promise.resolve(respostaJson(400, corpo)));

      const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

      expect(erro).toBeInstanceOf(ApiError);
      // `details` AUSENTE, e nao presente com valor vazio: e a forma que
      // `fieldErrorsOf` consulta.
      expect(erro).not.toHaveProperty('details');
      jest.restoreAllMocks();
    }
  });

  it('resposta nao-ok sem o envelope do projeto vira UNEXPECTED_ERROR', async () => {
    instalarFetch(() => Promise.resolve(respostaSemEnvelope(502)));

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({
      status: 502,
      code: 'UNEXPECTED_ERROR',
      message: 'Ocorreu um erro inesperado. Tente novamente.',
    });
  });

  it('envelope com code ou message de tipo errado tambem vira UNEXPECTED_ERROR', async () => {
    instalarFetch(() => Promise.resolve(respostaJson(500, { error: { code: 7, message: null } })));

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({ code: 'UNEXPECTED_ERROR' });
  });

  it('fetch que rejeita (sem resposta HTTP) vira NETWORK_ERROR', async () => {
    instalarFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message:
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    });
  });
});

describe('http-client — renovacao de sessao', () => {
  it('401 seguido de refresh bem-sucedido repete o request original uma unica vez', async () => {
    let tentativasNoProtegido = 0;

    const espiao = instalarFetch((url) => {
      if (url === URL_DE_REFRESH) {
        return Promise.resolve(respostaJson(200, SESSAO_RENOVADA));
      }

      tentativasNoProtegido += 1;

      return Promise.resolve(
        tentativasNoProtegido === 1
          ? respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.'))
          : respostaJson(200, { id: 'a1' }),
      );
    });

    setSessionRefresher(renovadorQuePassaPelaRede());

    await expect(request(CAMINHO_PROTEGIDO)).resolves.toEqual({ id: 'a1' });

    expect(chamadasPara(espiao, URL_PROTEGIDA)).toHaveLength(2);
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);
    // O retry leva o token NOVO, e nao o antigo.
    expect(getAccessToken()).toBe('access-token-renovado');
  });

  it('RN-07: tres requisicoes concorrentes em 401 disparam EXATAMENTE UM POST /auth/refresh', async () => {
    const diferido = criarDiferido<Response>();
    const jaRecebeu401 = new Set<number>();
    let sequencia = 0;

    const espiao = instalarFetch((url) => {
      if (url === URL_DE_REFRESH) {
        // Resolucao MANUAL: a renovacao fica em voo ate o teste decidir.
        return diferido.promessa;
      }

      sequencia += 1;

      const indice = sequencia;

      if (jaRecebeu401.size < 3) {
        jaRecebeu401.add(indice);

        return Promise.resolve(respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.')));
      }

      return Promise.resolve(respostaJson(200, { tentativa: indice }));
    });

    setSessionRefresher(renovadorQuePassaPelaRede());

    const emVoo = [
      request(CAMINHO_PROTEGIDO),
      request(CAMINHO_PROTEGIDO),
      request(CAMINHO_PROTEGIDO),
    ];

    // Neste ponto os tres `401` JA voltaram e os tres chamadores estao na fila.
    await cederOControle();

    expect(chamadasPara(espiao, URL_PROTEGIDA)).toHaveLength(3);
    // A ASSERCAO DA AC #3. Sem a fila single-flight seriam tres rotacoes
    // simultaneas do refresh token, o backend leria as duas perdedoras como
    // reuso indevido (RN-07) e revogaria a familia inteira — medido no backend
    // real como `200,401,401,401`.
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);

    diferido.resolver(respostaJson(200, SESSAO_RENOVADA));

    await expect(Promise.all(emVoo)).resolves.toHaveLength(3);

    // Uma renovacao, tres primeiras tentativas, tres retries.
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);
    expect(chamadasPara(espiao, URL_PROTEGIDA)).toHaveLength(6);
  });

  it('refresh falho limpa o token, dispara onSessionExpired uma vez e propaga SESSION_EXPIRED', async () => {
    instalarFetch((url) =>
      Promise.resolve(
        url === URL_DE_REFRESH
          ? respostaJson(401, envelopeDeErro('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.'))
          : respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.')),
      ),
    );

    const aoExpirar = jest.fn();

    setAccessToken('token-antigo');
    setSessionRefresher(renovadorQuePassaPelaRede());
    setOnSessionExpired(aoExpirar);

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(getAccessToken()).toBeNull();
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('RN-07: refresh que falha RAPIDO com tres 401 concorrentes mantem UM refresh e UM onSessionExpired', async () => {
    /**
     * REGRESSAO REAL da TASK-FRONTEND-010, e ela so aparece por CONTAGEM.
     *
     * Com a fila sendo limpa tambem na falha, a rejeicao chegava antes do segundo
     * `401`: o segundo chamador encontrava a fila vazia, abria uma renovacao nova
     * e o usuario via a mensagem de sessao expirada em duplicado — dois `POST
     * /auth/refresh` e dois `onSessionExpired`. A correcao foi manter a promessa
     * REJEITADA retida (trava de sessao encerrada), liberada so por
     * `markSessionRestored()`.
     *
     * O `criarDiferido` aqui e usado ao contrario do teste anterior: o refresh
     * rejeita ANTES de os outros dois `401` voltarem, que e a condicao exata em
     * que o defeito se manifestava.
     */
    const diferidoDoRefresh = criarDiferido<Response>();
    const diferidosDoProtegido: Array<Diferido<Response>> = [];

    const espiao = instalarFetch((url) => {
      if (url === URL_DE_REFRESH) {
        return diferidoDoRefresh.promessa;
      }

      const diferido = criarDiferido<Response>();

      diferidosDoProtegido.push(diferido);

      return diferido.promessa;
    });

    const aoExpirar = jest.fn();

    setAccessToken('token-antigo');
    setSessionRefresher(renovadorQuePassaPelaRede());
    setOnSessionExpired(aoExpirar);

    const emVoo = [
      request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo),
      request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo),
      request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo),
    ];

    await cederOControle();
    expect(diferidosDoProtegido).toHaveLength(3);

    const naoAutenticado = (): Response =>
      respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.'));

    // Apenas o PRIMEIRO 401 volta: e ele que abre a renovacao.
    diferidosDoProtegido[0]?.resolver(naoAutenticado());
    await cederOControle();
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);

    // A renovacao falha ANTES dos outros dois 401 — a condicao do defeito.
    diferidoDoRefresh.resolver(
      respostaJson(401, envelopeDeErro('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.')),
    );
    await cederOControle();

    diferidosDoProtegido[1]?.resolver(naoAutenticado());
    diferidosDoProtegido[2]?.resolver(naoAutenticado());

    const resultados = await Promise.all(emVoo);

    for (const resultado of resultados) {
      expect(resultado).toMatchObject({ code: 'SESSION_EXPIRED' });
    }

    // As duas contagens que provam a correcao. Antes dela: 2 e 2.
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);
    expect(aoExpirar).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('401 no proprio /auth/refresh nao recursa', async () => {
    const espiao = instalarFetch(() =>
      Promise.resolve(respostaJson(401, envelopeDeErro('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.'))),
    );

    // Renovador registrado de proposito: se `/auth/refresh` participasse do ciclo,
    // ele seria chamado e a recursao apareceria como estouro de contagem.
    setSessionRefresher(renovadorQuePassaPelaRede());

    const erro: unknown = await request('/auth/refresh', { method: 'POST' }).catch(
      (motivo: unknown) => motivo,
    );

    expect(erro).toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);
  });

  it('401 em /auth/login e final: credencial incorreta nao dispara renovacao', async () => {
    const espiao = instalarFetch(() =>
      Promise.resolve(respostaJson(401, envelopeDeErro('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.'))),
    );

    setSessionRefresher(renovadorQuePassaPelaRede());

    const erro: unknown = await request('/auth/login', { method: 'POST', body: {} }).catch(
      (motivo: unknown) => motivo,
    );

    expect(erro).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(0);
  });

  it('query string nao burla a lista de caminhos fora do ciclo', async () => {
    const espiao = instalarFetch(() =>
      Promise.resolve(respostaJson(401, envelopeDeErro('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.'))),
    );

    setSessionRefresher(renovadorQuePassaPelaRede());

    await request('/auth/refresh?tentativa=2', { method: 'POST' }).catch(() => undefined);

    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(0);
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('retry que tambem recebe 401 nao tenta uma terceira vez', async () => {
    const espiao = instalarFetch((url) =>
      Promise.resolve(
        url === URL_DE_REFRESH
          ? respostaJson(200, SESSAO_RENOVADA)
          : respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.')),
      ),
    );

    setSessionRefresher(renovadorQuePassaPelaRede());

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    // DUAS tentativas, nunca tres: a segunda resposta e final.
    expect(chamadasPara(espiao, URL_PROTEGIDA)).toHaveLength(2);
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);
  });

  it('sem renovador registrado, o 401 e sessao encerrada e nenhum refresh e emitido', async () => {
    const espiao = instalarFetch(() =>
      Promise.resolve(respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.'))),
    );

    const aoExpirar = jest.fn();

    setAccessToken('token-antigo');
    setOnSessionExpired(aoExpirar);

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: 'Sua sessão expirou. Faça login novamente.',
    });
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(0);
    expect(aoExpirar).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('skipRefresh desliga a renovacao mesmo em rota do ciclo', async () => {
    const espiao = instalarFetch(() =>
      Promise.resolve(respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.'))),
    );

    setSessionRefresher(renovadorQuePassaPelaRede());

    const erro: unknown = await request(CAMINHO_PROTEGIDO, { skipRefresh: true }).catch(
      (motivo: unknown) => motivo,
    );

    expect(erro).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('renovador que lanca erro COMUM ainda produz SESSION_EXPIRED para a tela', async () => {
    instalarFetch(() => Promise.resolve(respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.'))));

    const aoExpirar = jest.fn();

    // Falha de programacao dentro do renovador (nao um erro da API). A tela ramifica
    // por `code`, entao um erro sem `code` a deixaria sem saber o que dizer.
    setSessionRefresher(() => Promise.reject(new TypeError('undefined is not a function')));
    setOnSessionExpired(aoExpirar);

    const erro: unknown = await request(CAMINHO_PROTEGIDO).catch((motivo: unknown) => motivo);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: 'Sua sessão expirou. Faça login novamente.',
    });
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('a trava de sessao encerrada retem a fila, e markSessionRestored a libera', async () => {
    let refreshDeveFalhar = true;

    const espiao = instalarFetch((url) => {
      if (url === URL_DE_REFRESH) {
        return Promise.resolve(
          refreshDeveFalhar
            ? respostaJson(401, envelopeDeErro('SESSION_EXPIRED', 'Sua sessão expirou. Faça login novamente.'))
            : respostaJson(200, SESSAO_RENOVADA),
        );
      }

      return Promise.resolve(respostaJson(401, envelopeDeErro('UNAUTHORIZED', 'Não autenticado.')));
    });

    setSessionRefresher(renovadorQuePassaPelaRede());

    await request(CAMINHO_PROTEGIDO).catch(() => undefined);
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);

    // Sessao morta NAO e sondada de novo: a promessa rejeitada continua na fila,
    // poupando o limite de 20/min do refresh e uma familia de tokens ja revogada.
    await request(CAMINHO_PROTEGIDO).catch(() => undefined);
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(1);

    // Um login restabelece a sessao por FORA da fila — o unico evento que a libera.
    refreshDeveFalhar = false;
    markSessionRestored();

    await request(CAMINHO_PROTEGIDO).catch(() => undefined);
    expect(chamadasPara(espiao, URL_DE_REFRESH)).toHaveLength(2);
  });
});

/**
 * Bloco ISOLADO: e o unico que troca o dublê de `~/config/env`, e por isso ele
 * recarrega o modulo e desfaz a troca no `afterEach`. Sem isso, o `http-client`
 * recarregado ficaria no registro e um teste posterior poderia observar um estado
 * de modulo que nao e o dele — resultado dependente de ordem, que a AC #8 proibe.
 */
describe('http-client — montagem da URL', () => {
  afterEach(() => {
    jest.dontMock('~/config/env');
    jest.resetModules();
  });

  it('VITE_API_BASE_URL com barra final nao produz barra dupla', async () => {
    jest.resetModules();
    jest.doMock('~/config/env', () => ({ env: { apiBaseUrl: '/api/' } }));

    const { request: requestIsolado } = await import('~/services/api/http-client');
    const espiao = instalarFetch(() => Promise.resolve(respostaJson(200, {})));

    await requestIsolado(CAMINHO_PROTEGIDO);

    /**
     * A montagem NAO pode mudar: o cookie de refresh e emitido com
     * `Path=/api/auth` e o navegador so o envia sob esse caminho. Uma URL como
     * `/api//auth/refresh` sairia do escopo do cookie e o refresh passaria a
     * falhar com `401` sem nenhuma pista do motivo.
     */
    expect(String(espiao.mock.calls[0]?.[0])).toBe(URL_PROTEGIDA);
  });
});
