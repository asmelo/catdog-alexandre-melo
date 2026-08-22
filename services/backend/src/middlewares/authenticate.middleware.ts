import type { RequestHandler } from 'express';

import { SessionExpiredError } from '~/domains/auth/errors/session.errors';
import { verifyAccessToken } from '~/domains/auth/tokens/access-token.service';
import type { AuthUser } from '~/shared/types/express';

/**
 * Guarda de autenticacao das rotas protegidas: valida o access token do header
 * `Authorization` e publica a identidade em `req.authUser`.
 *
 * DESFECHO UNICO de falha: `SessionExpiredError` (401 `SESSION_EXPIRED`), com a
 * mesma mensagem para header ausente, prefixo errado, assinatura adulterada,
 * token vencido, `typ` divergente e `iss`/`aud` de outro ambiente. Distinguir os
 * motivos na resposta entregaria a um atacante exatamente o sinal que ele
 * procura — "este token existiu e venceu" e "este token nunca foi valido" sao
 * informacoes diferentes para quem esta sondando.
 */

/**
 * `Bearer ` com espaco e caixa exata, como manda a RFC 6750. A comparacao e
 * case-sensitive de proposito: aceitar `bearer` seria tolerancia sem ganho, e
 * cliente que erra a caixa erra o contrato.
 */
const PREFIXO_BEARER = 'Bearer ';

/**
 * O token so e extraido de um header bem formado. Header ausente, com outro
 * esquema (`Basic`, `Token`) ou so com o prefixo e nada depois nao chegam ao
 * `verify`: gastar verificacao criptografica em entrada obviamente malformada
 * seria trabalho a pedido do cliente.
 */
function extrairToken(cabecalho: string | undefined): string {
  if (!cabecalho?.startsWith(PREFIXO_BEARER)) {
    throw new SessionExpiredError();
  }

  const token = cabecalho.slice(PREFIXO_BEARER.length).trim();

  if (token.length === 0) {
    throw new SessionExpiredError();
  }

  return token;
}

/**
 * `verifyAccessToken` lanca `Error` COMUM — ele nao conhece HTTP de proposito
 * (DECISAO-040 da TASK-BACKEND-005). Capturar qualquer excecao dele e traduzir
 * para `SessionExpiredError` e o que impede uma credencial invalida de cair no
 * ramo generico do error handler e responder 500 no lugar de 401.
 *
 * O `catch` fica em volta APENAS do `verify`: o erro que `extrairToken` lanca ja
 * e o `SessionExpiredError` final e passar por aqui o reembalaria sem motivo.
 */
function identificar(token: string): AuthUser {
  try {
    const claims = verifyAccessToken(token);

    return { id: claims.sub, role: claims.role };
  } catch {
    throw new SessionExpiredError();
  }
}

/**
 * NAO consulta o banco. O access token vive 15 minutos e a revogacao real
 * acontece na camada de refresh (RN-06/RN-07); uma ida ao Postgres por
 * requisicao anularia o ganho de ter um token assinado e transformaria toda rota
 * protegida em dependente da latencia do pooler.
 */
export const authenticate: RequestHandler = (requisicao, _resposta, proximo) => {
  requisicao.authUser = identificar(extrairToken(requisicao.get('authorization')));

  proximo();
};
