import type { ZodError } from 'zod';

import { AppError, type ErrorDetail } from '~/shared/errors/app-error';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Subclasses finas de `AppError`, uma por semantica HTTP. Cada uma fixa apenas o
 * `statusCode`: o `code` vem de quem lanca, porque um mesmo status atende varias
 * regras de negocio (409 serve tanto a e-mail duplicado quanto a pedido ja pago).
 *
 * Agrupadas em um unico arquivo de proposito porque sao declaracoes sem logica.
 * Os erros DE DOMINIO, que carregam regra, ganham arquivo proprio nos slices
 * seguintes.
 */

/** 400 — unico erro que popula `details`, um item por campo invalido. */
export class ValidationError extends AppError {
  constructor(message: string, code: string, details?: ReadonlyArray<ErrorDetail>) {
    super(message, HTTP_STATUS.BAD_REQUEST, code, details);
  }
}

/** 401 — ausencia ou invalidez de credencial. */
export class UnauthorizedError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.UNAUTHORIZED, code);
  }
}

/** 403 — credencial valida, porem sem permissao para o recurso. */
export class ForbiddenError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.FORBIDDEN, code);
  }
}

/** 404 — recurso (ou rota) inexistente. */
export class NotFoundError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.NOT_FOUND, code);
  }
}

/** 409 — conflito com o estado atual do recurso. */
export class ConflictError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.CONFLICT, code);
  }
}

/** 410 — recurso que existiu e expirou (ex.: token de confirmacao vencido). */
export class GoneError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.GONE, code);
  }
}

/**
 * 413 — corpo da requisicao (ou um arquivo dentro dele) acima do teto proprio da
 * rota. Sempre acompanhado de mensagem de negocio em PT-BR: um 413 generico,
 * produzido pelo servidor de borda, chegaria ao frontend sem `code` para
 * ramificar (RN-51).
 */
export class PayloadTooLargeError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.PAYLOAD_TOO_LARGE, code);
  }
}

/**
 * 415 — o corpo esta bem formado, mas o tipo de midia nao e aceito pela rota.
 * Distinto do 400: nao ha campo a corrigir, e o formato inteiro do envio (ou do
 * arquivo enviado) que a rota nao processa.
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, code);
  }
}

/**
 * 503 — dependencia externa da aplicacao indisponivel (RN-39).
 *
 * Distinto do 500 DE PROPOSITO, e a distincao e a razao de a classe existir: o
 * 500 significa defeito de programacao nosso e chega ao cliente com mensagem
 * generica pelo `error-handler`; o 503 significa que o pedido estava correto e
 * um servico do qual dependemos falhou, entao ele carrega `code` e mensagem de
 * negocio proprios e convida a nova tentativa.
 *
 * O erro do fornecedor NUNCA vem junto: quem lanca ja traduziu, e nenhum codigo,
 * mensagem ou status do terceiro atravessa esta fronteira.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, code: string) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, code);
  }
}

/** `code` unico de toda falha de validacao de entrada. */
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * Converte um `ZodError` no `ValidationError` equivalente.
 *
 * Vive junto da classe (e nao no middleware de validacao) porque os dois pontos
 * que precisam da conversao — o `validate-request` e o ramo de contingencia do
 * `error-handler`, para schemas parseados fora das rotas — consumiriam o mesmo
 * mapeamento de `issues`.
 *
 * As mensagens por campo vem dos schemas; daqui sai apenas a mensagem-guarda.
 */
export function validationErrorFromZodError(erro: ZodError): ValidationError {
  const detalhes: ReadonlyArray<ErrorDetail> = erro.issues.map((problema) => ({
    field: problema.path.join('.'),
    message: problema.message,
  }));

  return new ValidationError(
    'Verifique os campos informados.',
    VALIDATION_ERROR_CODE,
    detalhes,
  );
}
