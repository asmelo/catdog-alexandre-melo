import { MESSAGES } from '~/domains/auth/auth.messages';
import { ForbiddenError, UnauthorizedError } from '~/shared/errors/http-errors';

/**
 * Erros de dominio da sessao (login, renovacao e encerramento). Como em
 * `registration.errors.ts`, cada classe nomeia a REGRA violada e nao o status, e
 * o construtor nao aceita parametro: mensagem e `code` sao contrato dos criterios
 * de aceite e nao podem variar por ponto de lancamento.
 */

/**
 * RN-05 / RNF-03 — e-mail inexistente e senha incorreta lancam ESTE MESMO erro,
 * de proposito: status, `code` e mensagem identicos sao o que impede o endpoint
 * de virar um oraculo de e-mails cadastrados.
 */
export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super(MESSAGES.INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }
}

/**
 * RN-01 — 403 e nao 401: a credencial esta correta, o que falta e a confirmacao
 * da conta. A distincao importa para o frontend, que oferece o reenvio do e-mail
 * neste caso e nao no anterior.
 */
export class AccountNotConfirmedError extends ForbiddenError {
  constructor() {
    super(MESSAGES.ACCOUNT_NOT_CONFIRMED, 'ACCOUNT_NOT_CONFIRMED');
  }
}

/**
 * Desfecho UNICO de qualquer falha na renovacao: cookie ausente, token
 * desconhecido, vencido, revogado ou reapresentado depois da rotacao (RN-07).
 * Diferenciar esses casos na resposta entregaria a um atacante a informacao de
 * que o token roubado ja foi usado pela vitima.
 */
export class SessionExpiredError extends UnauthorizedError {
  constructor() {
    super(MESSAGES.SESSION_EXPIRED, 'SESSION_EXPIRED');
  }
}
