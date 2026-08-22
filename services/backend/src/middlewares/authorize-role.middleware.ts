import type { RequestHandler } from 'express';

import { SessionExpiredError } from '~/domains/auth/errors/session.errors';
import type { AuthRole } from '~/domains/auth/mappers/user.mapper';
import { ForbiddenError } from '~/shared/errors/http-errors';

/**
 * Materializacao da RN-10: a decisao de permissao que VALE e esta, no servidor.
 * O guard de rota do frontend continua existindo como conveniencia de UX — ele
 * evita uma navegacao que terminaria em 403 — mas nao protege nada, porque quem
 * chama a API direto nao passa por ele.
 *
 * Fabrica no mesmo formato de `validate-request.middleware.ts`: a configuracao e
 * lida uma vez na montagem da rota, nao em cada requisicao.
 */

/**
 * Fora do catalogo `auth.messages.ts` de proposito: `authorizeRole` e um
 * middleware transversal, usado pelas rotas de negocio das features seguintes
 * (pets, pedidos), e nao faz parte do dominio de autenticacao. O catalogo se
 * declara "textos PT-BR do dominio de autenticacao" e importa-lo aqui criaria
 * uma dependencia de `~/middlewares` para `~/domains/auth` que existe hoje
 * apenas para os tipos de erro.
 */
const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para acessar este recurso.';

/**
 * Fabrica variadica: `authorizeRole('admin')` ou `authorizeRole('admin', 'cliente')`.
 * O tipo dos argumentos e `AuthRole`, entao uma role inexistente (`'gerente'`) e
 * erro de compilacao no ponto de montagem da rota, e nao uma guarda que nunca
 * autoriza ninguem em producao.
 */
export function authorizeRole(...allowed: ReadonlyArray<AuthRole>): RequestHandler {
  return (requisicao, _resposta, proximo) => {
    const autenticado = requisicao.authUser;

    /**
     * Sem identidade na requisicao o middleware foi montado FORA de ordem (sem
     * `authenticate` antes). O desfecho e 401 e nao 500: para quem chama, o
     * efeito observavel de "voce nao se identificou" e o mesmo, e um erro de
     * composicao de rota nao deve virar acesso liberado nem vazamento de stack.
     */
    if (autenticado === undefined) {
      throw new SessionExpiredError();
    }

    /**
     * 403 e nao 401: a credencial esta correta e o servidor sabe quem e o
     * usuario — o que falta e permissao. Trocar por 401 faria o cliente tentar
     * renovar a sessao num loop, porque um access token novo nao muda a role.
     */
    if (!allowed.includes(autenticado.role)) {
      throw new ForbiddenError(MENSAGEM_SEM_PERMISSAO, 'FORBIDDEN');
    }

    proximo();
  };
}
