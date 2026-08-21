import type { RequestHandler } from 'express';

import { NotFoundError } from '~/shared/errors/http-errors';

/**
 * Ultimo middleware da cadeia de rotas: se a requisicao chegou aqui, nenhuma
 * rota casou. Lanca em vez de responder para que a rota inexistente saia no
 * mesmo envelope de erro das demais falhas, e nao no HTML default do Express.
 */
export const notFoundMiddleware: RequestHandler = () => {
  throw new NotFoundError('Recurso não encontrado.', 'ROUTE_NOT_FOUND');
};
