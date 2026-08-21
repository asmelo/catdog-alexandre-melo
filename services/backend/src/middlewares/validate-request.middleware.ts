import type { Request, RequestHandler } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

import { validationErrorFromZodError } from '~/shared/errors/http-errors';

/**
 * Schema aceito pela fabrica. Tipado com saida `unknown` (e nao `ZodSchema`, cujo
 * parametro default e `any`) para que o dado parseado nao entre no fluxo como
 * `any`.
 */
type EsquemaDeRequisicao = ZodType<unknown, ZodTypeDef, unknown>;

interface EsquemasDaRequisicao {
  readonly body?: EsquemaDeRequisicao;
  readonly query?: EsquemaDeRequisicao;
  readonly params?: EsquemaDeRequisicao;
}

/**
 * `safeParse` e nao `parse`: entrada invalida e resultado esperado, nao excecao.
 * A unica excecao lancada aqui e o `ValidationError` proprio, que o Express
 * encaminha ao error handler.
 */
function parsear(esquema: EsquemaDeRequisicao, valor: unknown): unknown {
  const resultado = esquema.safeParse(valor);

  if (!resultado.success) {
    throw validationErrorFromZodError(resultado.error);
  }

  return resultado.data;
}

/**
 * Fabrica de middleware de validacao Zod.
 *
 * REATRIBUI o valor parseado sobre a requisicao — e isso que faz as
 * transformacoes declaradas no schema (normalizar e-mail para minusculas,
 * coagir numero de query string) valerem no controller. Validar sem reatribuir
 * deixa o controller lendo o dado cru.
 *
 * As secoes sao validadas em ordem e a primeira que falha interrompe: o Zod ja
 * agrega todos os problemas da propria secao, e body e query invalidos na mesma
 * requisicao e caso marginal.
 */
export function validateRequest(esquemas: EsquemasDaRequisicao): RequestHandler {
  return (requisicao, _resposta, proximo) => {
    if (esquemas.body !== undefined) {
      requisicao.body = parsear(esquemas.body, requisicao.body);
    }

    if (esquemas.query !== undefined) {
      requisicao.query = parsear(esquemas.query, requisicao.query) as Request['query'];
    }

    if (esquemas.params !== undefined) {
      requisicao.params = parsear(esquemas.params, requisicao.params) as Request['params'];
    }

    proximo();
  };
}
