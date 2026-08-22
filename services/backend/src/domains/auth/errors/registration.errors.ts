import { MESSAGES } from '~/domains/auth/auth.messages';
import { ConflictError, GoneError, ValidationError } from '~/shared/errors/http-errors';

/**
 * Erros de dominio do registro e da confirmacao de conta. Cada classe nomeia a
 * REGRA violada, nao o status HTTP — e o nome que aparece na stack e no log.
 *
 * Construtores sem parametro de proposito: mensagem e `code` sao contrato fixo
 * dos criterios de aceite, e permitir sobrescreve-los no ponto de lancamento
 * abriria caminho para duas mensagens diferentes para a mesma regra.
 */

/** RN-13 — e-mail unico independentemente do status da conta. */
export class EmailAlreadyInUseError extends ConflictError {
  constructor() {
    super(MESSAGES.EMAIL_ALREADY_IN_USE, 'EMAIL_ALREADY_IN_USE');
  }
}

/**
 * Token inexistente. Estende `ValidationError` porque e a unica subclasse 400 do
 * projeto; o `code` proprio (e nao `VALIDATION_ERROR`) e o que o frontend usa
 * para distinguir "link quebrado" de "campo invalido", e `details` fica ausente.
 */
export class ConfirmationTokenInvalidError extends ValidationError {
  constructor() {
    super(MESSAGES.CONFIRMATION_TOKEN_INVALID, 'CONFIRMATION_TOKEN_INVALID');
  }
}

/** RN-02 — 410 e nao 400: o link EXISTIU e caducou, e a acao e pedir outro. */
export class ConfirmationTokenExpiredError extends GoneError {
  constructor() {
    super(MESSAGES.CONFIRMATION_TOKEN_EXPIRED, 'CONFIRMATION_TOKEN_EXPIRED');
  }
}

/** RN-03 — uso unico. Tambem cobre a perda da corrida no compare-and-swap. */
export class ConfirmationTokenAlreadyUsedError extends ConflictError {
  constructor() {
    super(MESSAGES.CONFIRMATION_TOKEN_ALREADY_USED, 'CONFIRMATION_TOKEN_ALREADY_USED');
  }
}
