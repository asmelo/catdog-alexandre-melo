/**
 * Codigos de status HTTP usados pelo projeto.
 *
 * Existe para eliminar numeros magicos: nenhum outro arquivo escreve
 * `resposta.status(409)` literal. A lista e deliberadamente curta — cada entrada
 * aqui e um status que alguma regra da aplicacao realmente produz.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
