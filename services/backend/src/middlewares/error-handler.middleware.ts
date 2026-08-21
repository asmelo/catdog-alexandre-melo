import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, type ErrorDetail } from '~/shared/errors/app-error';
import { validationErrorFromZodError } from '~/shared/errors/http-errors';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * UNICO ponto do projeto autorizado a montar uma resposta de erro. Qualquer
 * outro arquivo sinaliza falha lancando um `AppError` — nunca respondendo.
 */

interface CorpoDeErro {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: ReadonlyArray<ErrorDetail>;
  };
}

const ERRO_INTERNO: CorpoDeErro = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Ocorreu um erro inesperado. Tente novamente.',
  },
};

function montarCorpo(erro: AppError): CorpoDeErro {
  return {
    error: {
      code: erro.code,
      message: erro.message,
      // Espalhamento condicional: `details` precisa estar AUSENTE da resposta
      // quando nao ha detalhes, e nao presente com valor `undefined`.
      ...(erro.details === undefined ? {} : { details: erro.details }),
    },
  };
}

/**
 * A aridade de 4 argumentos e o que faz o Express reconhecer isto como error
 * handler: remover o `_next` nao usado transformaria o middleware em um handler
 * comum e todos os erros voltariam ao tratamento default do Express.
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  erro: unknown,
  _requisicao,
  resposta,
  _next,
): void => {
  // Schemas parseados fora do `validate-request` (services, jobs) chegam aqui
  // como `ZodError` cru.
  const erroTratado = erro instanceof ZodError ? validationErrorFromZodError(erro) : erro;

  if (erroTratado instanceof AppError) {
    resposta.status(erroTratado.statusCode).json(montarCorpo(erroTratado));
    return;
  }

  // Erro nao previsto: o diagnostico completo vai para o log do servidor e o
  // cliente recebe mensagem generica. Vazar `erro.message` ou a stack aqui
  // entregaria detalhe de implementacao a quem chamou.
  console.error('[catdog-backend] Erro nao tratado:', erroTratado);
  resposta.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(ERRO_INTERNO);
};
