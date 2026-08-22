import { env } from '~/config/env';
import { clearAccessToken, getAccessToken } from '~/services/api/access-token-store';
import { ApiError, type ApiErrorDetail } from '~/services/api/api-error';

/**
 * Cliente HTTP do projeto: um `fetch` com envio de credencial, traducao de erro
 * e renovacao automatica de sessao.
 *
 * ESTE MODULO NAO CONHECE O DOMINIO DE AUTENTICACAO. Ele nao importa
 * `auth-api.ts`, nao sabe o formato da resposta de `/auth/refresh` e nao importa
 * o contexto nem o roteador. Quem sabe renovar a sessao se REGISTRA aqui
 * (`setSessionRefresher`) e quem quer saber que a sessao caiu tambem
 * (`setOnSessionExpired`).
 *
 * A inversao nao e estilo: `auth-api.ts` importa o `request` daqui, entao um
 * import de `auth-api` neste arquivo fecharia um ciclo de modulos. Em ESM o
 * ciclo as vezes resolve, mas a ordem de avaliacao passa a decidir se um binding
 * ja existe no momento do uso — e a falha aparece como `undefined is not a
 * function` em tempo de inicializacao, longe da causa. Com o registro, o grafo
 * de imports em tempo de execucao e uma arvore: `auth-provider` -> `auth-api` ->
 * `http-client` -> (`api-error`, `access-token-store`, `config/env`).
 */

const STATUS_NAO_AUTORIZADO = 401;
const STATUS_SEM_CONTEUDO = 204;

/** `status` de um erro que nunca chegou a virar resposta HTTP. */
const SEM_RESPOSTA_HTTP = 0;

/**
 * Rotas que NUNCA entram no ciclo de renovacao. O `401` delas e a resposta
 * final, e nao um sinal de token vencido:
 *
 * - `/auth/refresh` responder `401` significa que a propria renovacao falhou;
 *   tentar renovar de novo seria recursao infinita.
 * - `/auth/login` responder `401` e credencial incorreta (`INVALID_CREDENTIALS`);
 *   nao existe sessao a renovar antes de existir login.
 */
const CAMINHOS_FORA_DO_CICLO: ReadonlySet<string> = new Set(['/auth/refresh', '/auth/login']);

/**
 * Mesmo texto do catalogo `auth.messages.ts` do backend. A duplicacao e
 * inevitavel — sao dois artefatos de deploy independentes — e vale so para o
 * caso em que o motivo da falha de renovacao NAO veio do backend (queda de rede
 * no meio do refresh, por exemplo). No caminho normal a mensagem exibida e a que
 * o backend enviou.
 */
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Faça login novamente.';

/**
 * Usada quando a resposta nao-ok nao traz o envelope de erro do projeto (um HTML
 * de gateway, por exemplo). E o MESMO texto do `INTERNAL_ERROR` do backend, e
 * nao uma frase montada a partir do `status`.
 */
const MENSAGEM_ERRO_INESPERADO = 'Ocorreu um erro inesperado. Tente novamente.';

const MENSAGEM_SEM_CONEXAO =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  readonly method?: HttpMethod;
  /** Serializado como JSON. Ausente significa requisicao sem corpo. */
  readonly body?: unknown;
  /**
   * Desliga a renovacao automatica para esta chamada. Necessario em `login` e
   * `refresh`, que sao justamente as rotas que produzem a sessao.
   */
  readonly skipRefresh?: boolean;
}

/**
 * Contrato de quem sabe renovar a sessao: resolve depois de ter guardado o novo
 * access token, rejeita se a renovacao falhou. O valor de retorno e `void` de
 * proposito — o cliente HTTP nao precisa (e nao deve) ver o usuario nem o token.
 */
export type SessionRefresher = () => Promise<void>;

let renovadorDeSessao: SessionRefresher | null = null;
let aoExpirarSessao: (() => void) | null = null;

/**
 * A promessa unica da fila single-flight. Enquanto nao for `null`, existe um
 * `POST /auth/refresh` em voo e QUALQUER outra requisicao que receba `401`
 * aguarda esta mesma promessa em vez de disparar a sua.
 *
 * Nao e otimizacao. O backend (TASK-BACKEND-005) rotaciona o refresh token por
 * compare-and-swap e trata perder a corrida como reutilizacao indevida (RN-07):
 * duas chamadas simultaneas com o mesmo cookie produzem `200` e `401` e
 * REVOGAM A FAMILIA INTEIRA — inclusive o token que o vencedor acabou de
 * emitir. Medido no checklist da TASK-BACKEND-005: quatro renovacoes
 * simultaneas devolveram `200,401,401,401` e derrubaram a sessao do usuario
 * legitimo. Esta variavel e a mitigacao.
 */
let renovacaoEmVoo: Promise<void> | null = null;

/**
 * Registra quem sabe renovar a sessao. `null` desregistra (no unmount do
 * provider). Sem renovador registrado, um `401` e tratado como sessao encerrada,
 * porque nao ha ninguem para renova-la.
 */
export function setSessionRefresher(refresher: SessionRefresher | null): void {
  renovadorDeSessao = refresher;
}

/**
 * Registra quem quer saber que a sessao caiu de vez. E o que evita este modulo
 * importar o roteador ou o contexto de autenticacao: ele apenas avisa.
 */
export function setOnSessionExpired(callback: (() => void) | null): void {
  aoExpirarSessao = callback;
}

/**
 * Libera a fila depois de a sessao ter sido restabelecida por FORA dela — hoje,
 * apenas um login bem-sucedido. Sem esta chamada, a promessa rejeitada da ultima
 * renovacao continuaria travando qualquer renovacao futura da aba (ver a trava
 * documentada em `executarRenovacao`).
 */
export function markSessionRestored(): void {
  renovacaoEmVoo = null;
}

function erroDeSessaoExpirada(): ApiError {
  return new ApiError({
    status: STATUS_NAO_AUTORIZADO,
    code: 'SESSION_EXPIRED',
    message: MENSAGEM_SESSAO_EXPIRADA,
  });
}

/**
 * Renovacao de sessao com no maximo UMA chamada em voo por aba.
 *
 * Exportada porque o `AuthProvider` tambem precisa passar por aqui no boot: se o
 * bootstrap chamasse `authApi.refresh()` direto, um `401` concorrente (uma
 * requisicao disparada pela primeira tela, por exemplo) abriria uma SEGUNDA
 * rotacao e cairia exatamente no caso que esta fila existe para evitar.
 *
 * A promessa e liberada da fila no SUCESSO, para que a expiracao seguinte (15
 * minutos adiante) possa renovar de novo. Na FALHA ela permanece — ver a trava
 * em `executarRenovacao`.
 */
export function refreshSession(): Promise<void> {
  renovacaoEmVoo ??= executarRenovacao();

  return renovacaoEmVoo;
}

/**
 * As consequencias da falha ficam AQUI, na promessa compartilhada, e nao em cada
 * chamador: com tres requisicoes esperando a mesma renovacao, tratar a falha no
 * chamador dispararia `onSessionExpired` tres vezes e o usuario veria a mensagem
 * de sessao expirada em triplicado.
 *
 * TRAVA DE SESSAO ENCERRADA — a promessa REJEITADA fica na fila de proposito, e
 * so sai de la num login (`markSessionRestored`).
 *
 * Isto foi medido, nao imaginado. Com a fila sendo limpa tambem na falha, tres
 * requisicoes concorrentes produziram DOIS `POST /auth/refresh` e DOIS disparos
 * de `onSessionExpired`: quando o refresh falha rapido, a rejeicao acontece antes
 * de o segundo `401` voltar, e o segundo chamador encontra a fila vazia e abre
 * uma renovacao nova. Manter a rejeicao guardada resolve os dois problemas de
 * uma vez — a sessao morta nao e sondada de novo (o que castigaria o limite de
 * 20/min do refresh e insistiria numa familia de tokens que o backend ja
 * revogou) e o aviso de expiracao chega uma unica vez a interface.
 *
 * Sucesso limpa a fila logo apos o `await`, o que sempre acontece em microtask
 * posterior a atribuicao do `??=` — nunca de forma sincrona.
 */
async function executarRenovacao(): Promise<void> {
  const renovador = renovadorDeSessao;

  try {
    if (renovador === null) {
      throw erroDeSessaoExpirada();
    }

    await renovador();

    renovacaoEmVoo = null;
  } catch (motivo) {
    clearAccessToken();
    aoExpirarSessao?.();

    // Preserva o erro real quando ele existe (`SESSION_EXPIRED` do backend no
    // caso normal, `TOO_MANY_REQUESTS` se o limite de 20/min do refresh
    // estourar): o `code` e o que a tela usa para decidir o que dizer.
    throw motivo instanceof ApiError ? motivo : erroDeSessaoExpirada();
  }
}

/**
 * `env.apiBaseUrl` e `/api` em desenvolvimento (proxy de mesma origem do Vite),
 * entao `/auth/refresh` vira `/api/auth/refresh`.
 *
 * A montagem NAO pode mudar: o cookie de refresh e emitido com
 * `Path=/api/auth` e o navegador so o envia em requisicoes sob esse caminho.
 * Uma URL como `/api/v1/auth/refresh` ou `/auth/refresh` sairia do escopo do
 * cookie e o refresh passaria a falhar com `401` sem nenhuma pista do motivo.
 */
function montarUrl(caminho: string): string {
  const base = env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl.slice(0, -1) : env.apiBaseUrl;

  return `${base}${caminho}`;
}

function montarCabecalhos(temCorpo: boolean): Record<string, string> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };

  if (temCorpo) {
    cabecalhos['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();

  if (token !== null) {
    cabecalhos.Authorization = `Bearer ${token}`;
  }

  return cabecalhos;
}

/**
 * `credentials: 'include'` em TODA requisicao, e nao apenas no refresh.
 *
 * E o que faz o navegador anexar o cookie `catdog_rt`. Sem isso o `POST
 * /auth/refresh` chega ao backend sem credencial e recebe `401 SESSION_EXPIRED`
 * — indistinguivel de token vencido, porque o backend responde igual para
 * cookie ausente, invalido, expirado e reusado, por desenho. Em desenvolvimento
 * o proxy do Vite deixa tudo na mesma origem e o default (`same-origin`) ate
 * funcionaria; em producao, com a API em outro host, nao funcionaria — e a falha
 * apareceria so no deploy.
 */
async function executarFetch(caminho: string, opcoes: RequestOptions): Promise<Response> {
  const temCorpo = opcoes.body !== undefined;

  try {
    return await fetch(montarUrl(caminho), {
      method: opcoes.method ?? 'GET',
      credentials: 'include',
      headers: montarCabecalhos(temCorpo),
      ...(temCorpo ? { body: JSON.stringify(opcoes.body) } : {}),
    });
  } catch {
    // `fetch` so rejeita quando nao houve resposta HTTP alguma (DNS, offline,
    // CORS bloqueado). Sem esta traducao, o `TypeError: Failed to fetch` do
    // navegador — em ingles e sem `code` — chegaria as telas.
    throw new ApiError({
      status: SEM_RESPOSTA_HTTP,
      code: 'NETWORK_ERROR',
      message: MENSAGEM_SEM_CONEXAO,
    });
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function ehDetalhe(valor: unknown): valor is ApiErrorDetail {
  return ehObjeto(valor) && typeof valor.field === 'string' && typeof valor.message === 'string';
}

/**
 * `details` so vem em `VALIDATION_ERROR`; qualquer outra forma e descartada em
 * vez de propagada meio tipada.
 */
function lerDetalhes(valor: unknown): ReadonlyArray<ApiErrorDetail> | undefined {
  if (!Array.isArray(valor)) {
    return undefined;
  }

  const itens: readonly unknown[] = valor;
  const detalhes = itens.filter(ehDetalhe);

  return detalhes.length === 0 ? undefined : detalhes;
}

async function lerCorpoJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    return undefined;
  }
}

async function erroDaResposta(resposta: Response): Promise<ApiError> {
  const corpo = await lerCorpoJson(resposta);

  if (
    ehObjeto(corpo) &&
    ehObjeto(corpo.error) &&
    typeof corpo.error.code === 'string' &&
    typeof corpo.error.message === 'string'
  ) {
    return new ApiError({
      status: resposta.status,
      code: corpo.error.code,
      message: corpo.error.message,
      details: lerDetalhes(corpo.error.details),
    });
  }

  return new ApiError({
    status: resposta.status,
    code: 'UNEXPECTED_ERROR',
    message: MENSAGEM_ERRO_INESPERADO,
  });
}

async function interpretar<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    throw await erroDaResposta(resposta);
  }

  /**
   * `204` do logout NAO pode ir para o `json()`: corpo vazio faz o parser lancar
   * `SyntaxError: Unexpected end of JSON input`, e o logout quebraria justamente
   * quando funcionou. A conversao e a unica do modulo e e segura porque quem
   * chama uma rota sem corpo declara `request<void>`.
   */
  if (resposta.status === STATUS_SEM_CONTEUDO) {
    return undefined as T;
  }

  const corpo: unknown = await resposta.json();

  return corpo as T;
}

function podeRenovarSessao(caminho: string, opcoes: RequestOptions): boolean {
  if (opcoes.skipRefresh === true) {
    return false;
  }

  const semQuery = caminho.split('?')[0] ?? caminho;

  return !CAMINHOS_FORA_DO_CICLO.has(semQuery);
}

/**
 * Ponto UNICO de saida HTTP do frontend.
 *
 * O fluxo do `401`, em tres passos e sem laco algum:
 *
 * 1. primeira tentativa;
 * 2. se o status e `401` e a rota participa do ciclo, aguarda a fila
 *    single-flight (uma renovacao por aba, compartilhada por quem estiver
 *    esperando);
 * 3. UMA segunda tentativa com o token novo. Um `401` aqui e final — nao existe
 *    terceira chamada a `executarFetch` em nenhum caminho deste modulo, o que se
 *    verifica contando as duas ocorrencias na funcao abaixo.
 */
export async function request<T>(caminho: string, opcoes: RequestOptions = {}): Promise<T> {
  const resposta = await executarFetch(caminho, opcoes);

  if (resposta.status !== STATUS_NAO_AUTORIZADO || !podeRenovarSessao(caminho, opcoes)) {
    return await interpretar<T>(resposta);
  }

  // Rejeicao aqui (renovacao falhou) sobe para quem chamou: `clearAccessToken` e
  // `onSessionExpired` ja aconteceram uma vez dentro da promessa compartilhada.
  await refreshSession();

  return await interpretar<T>(await executarFetch(caminho, opcoes));
}
