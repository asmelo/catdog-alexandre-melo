import type {
  AuthUser,
  LoginCredentials,
  RegistrationInput,
} from '~/contexts/auth/auth.types';
import { request } from '~/services/api/http-client';

/**
 * Uma funcao por endpoint de `/api/auth`, e nada mais.
 *
 * NENHUMA funcao aqui trata erro: todas deixam o `ApiError` subir para quem
 * chamou, que e quem sabe se um `ACCOUNT_NOT_CONFIRMED` deve virar um botao de
 * reenvio ou uma mensagem de topo. Tambem nao ha estado: guardar o access token
 * e responsabilidade do `AuthProvider`, o unico lugar que amarra a chamada de
 * rede ao estado da interface.
 *
 * O import de `auth.types` e `import type` sobre um modulo sem valores — ele nao
 * existe em tempo de execucao, entao a unica dependencia real deste arquivo e
 * `http-client.ts`.
 */

/** Corpo de `POST /auth/login` e `POST /auth/refresh`. O refresh token NAO vem aqui: ele sai no cookie `HttpOnly`. */
export interface SessionResponse {
  readonly accessToken: string;
  /** Segundos de validade do access token (900 no contrato atual). */
  readonly expiresIn: number;
  readonly user: AuthUser;
}

/** Corpo das rotas que so confirmam a acao (registro, confirmacao, reenvio). */
export interface MessageResponse {
  readonly message: string;
}

/**
 * Vocabulario do enum `UserStatus` do Prisma, em MAIUSCULAS — e assim que o
 * backend responde (DECISAO-048 da TASK-BACKEND-006). Comparar com `'ACTIVE'`,
 * nunca com `'active'`.
 */
export type AccountStatus = 'PENDING_CONFIRMATION' | 'ACTIVE';

/** Corpo de `GET /auth/me`: o usuario publico MAIS `status`. */
export interface CurrentUser extends AuthUser {
  readonly status: AccountStatus;
}

/**
 * Campos copiados um a um, e nao `body: input`.
 *
 * RN-12 em codigo: o schema do backend reprova QUALQUER chave extra no corpo,
 * entao um `passwordConfirmation` que vazasse do formulario nao seria ignorado —
 * viraria `400 VALIDATION_ERROR` e o registro pararia de funcionar. Copiar
 * explicitamente faz o compilador recusar a mudanca em vez de o servidor recusar
 * a requisicao.
 */
export function register(input: RegistrationInput): Promise<MessageResponse> {
  return request<MessageResponse>('/auth/register', {
    method: 'POST',
    body: { name: input.name, email: input.email, password: input.password },
  });
}

/** `POST`, e nao `GET` com o token na URL: pre-fetch de cliente de e-mail consumiria o token de uso unico. */
export function confirmEmail(token: string): Promise<MessageResponse> {
  return request<MessageResponse>('/auth/confirm-email', { method: 'POST', body: { token } });
}

/** Responde sempre `202` com a mesma mensagem, exista a conta ou nao. */
export function resendConfirmation(email: string): Promise<MessageResponse> {
  return request<MessageResponse>('/auth/confirmation/resend', {
    method: 'POST',
    body: { email },
  });
}

/**
 * `skipRefresh` obrigatorio: o `401` do login e credencial incorreta
 * (`INVALID_CREDENTIALS`), nao token vencido. Sem a marca, uma senha errada
 * dispararia um `POST /auth/refresh` inutil e, pior, uma rotacao do refresh token
 * de uma sessao possivelmente valida em outra aba.
 */
export function login(credentials: LoginCredentials): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/login', {
    method: 'POST',
    body: { email: credentials.email, password: credentials.password },
    skipRefresh: true,
  });
}

/**
 * A credencial vai no cookie `catdog_rt`, nao no corpo — dai a ausencia de
 * `body`. `skipRefresh` impede a recursao obvia: um `401` daqui NAO pode disparar
 * outra renovacao.
 *
 * Chamar esta funcao diretamente e correto apenas de dentro do renovador
 * registrado no cliente HTTP. Qualquer outro ponto do codigo deve passar por
 * `refreshSession()`, que serializa as chamadas — duas rotacoes simultaneas
 * derrubam a familia de tokens inteira (RN-07).
 */
export function refresh(): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/refresh', { method: 'POST', skipRefresh: true });
}

/**
 * `204` sem corpo. `skipRefresh` porque renovar uma sessao que se esta
 * encerrando nao faz sentido — e o backend responde `204` mesmo sem cookie,
 * entao nao ha `401` a interpretar.
 */
export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST', skipRefresh: true });
}

/**
 * Usuario corrente a partir do access token. Exige `Authorization`, portanto
 * participa do ciclo de renovacao: se o token tiver vencido, o `401` daqui e
 * exatamente o gatilho legitimo do refresh.
 */
export function me(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}
