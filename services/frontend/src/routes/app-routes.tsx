import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import type { AuthRole } from '~/contexts/auth/auth.types';
import { useAuth } from '~/contexts/auth/use-auth';
import { AdminLayout } from '~/layouts/admin-layout';
import { AuthLayout } from '~/layouts/auth-layout';
import { ClientLayout } from '~/layouts/client-layout';
import { SpeciesPage } from '~/pages/admin/species-page';
import { CheckEmailPage } from '~/pages/auth/check-email-page';
import { ConfirmEmailPage } from '~/pages/auth/confirm-email-page';
import { LoginPage } from '~/pages/auth/login-page';
import { RegisterPage } from '~/pages/auth/register-page';
import { ClientHomePage } from '~/pages/client/client-home-page';
import { NotFoundPage } from '~/pages/errors/not-found-page';
import { ProtectedRoute } from '~/routes/protected-route';
import { PublicOnlyRoute } from '~/routes/public-only-route';
import { ADMIN_DEFAULT_PATH, ROUTE_PATHS, homePathForRole } from '~/routes/route-paths';
import { RoleRoute } from '~/routes/role-route';

/**
 * Constantes de modulo, e nao literais no JSX: um `allow={['admin']}` escrito no
 * elemento cria um array novo a cada render do roteador, mudando a prop por
 * identidade sem mudar de valor.
 */
const ROLES_ADMIN: ReadonlyArray<AuthRole> = ['admin'];
const ROLES_CLIENTE: ReadonlyArray<AuthRole> = ['cliente'];

/**
 * A raiz nao tem tela propria: ela decide para onde ir.
 *
 * Fica DENTRO do `ProtectedRoute`, e nao solta: assim o visitante sem sessao que
 * abre `/` cai no mesmo caminho de qualquer rota protegida (splash durante o
 * bootstrap, login depois), sem precisar repetir aqui a logica dos tres estados.
 * O ramo de `user === null` e inalcancavel sob essa arvore e existe para nao
 * quebrar caso a montagem mude.
 */
function RedirecionamentoDaRaiz(): ReactElement {
  const { user } = useAuth();

  if (user === null) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
  }

  return <Navigate to={homePathForRole(user.role)} replace />;
}

/**
 * Mapa de rotas da aplicacao.
 *
 * A hierarquia e o que faz as guardas funcionarem: cada guarda e uma rota SEM
 * `path` que envolve as rotas filhas e decide antes de qualquer filho montar.
 *
 * Tres decisoes de desenho valem o comentario:
 *
 * 1. `/confirmar-email` e publico DE PROPOSITO, fora do `PublicOnlyRoute`: quem
 *    clica no link do e-mail nao tem sessao (e, se tiver, ainda assim precisa
 *    conseguir confirmar a conta).
 * 2. `/admin/*` e `/minha-area/*` tem um catch-all DENTRO da guarda. Sem ele,
 *    `/admin/inexistente` cairia no `*` global e um visitante sem sessao veria a
 *    404 em vez de ser mandado ao login — a area toda precisa estar atras da
 *    guarda, nao apenas a sua home.
 * 3. As folhas sao as paginas reais (TASK-FRONTEND-012). A estrutura de rotas, as
 *    guardas e os layouts NAO mudaram na troca dos placeholders — apenas os
 *    elementos das folhas — e e por isso que as verificacoes de guarda da
 *    TASK-FRONTEND-011 continuam valendo sem serem refeitas.
 *
 * Este arquivo nao le nenhum valor vindo da URL nem do `state` de navegacao:
 * cada `to` aqui e constante de `ROUTE_PATHS` ou saida de `homePathForRole`. O
 * unico consumidor de destino dinamico do projeto e a tela de login, que passa
 * pelo `readRedirectTarget` (GHSA-wrjc-x8rr-h8h6).
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      {/* Exclusivas de quem NAO tem sessao: login e cadastro. */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path={ROUTE_PATHS.LOGIN} element={<LoginPage />} />
          <Route path={ROUTE_PATHS.REGISTER} element={<RegisterPage />} />
        </Route>
      </Route>

      {/* Publicas para qualquer visitante, com ou sem sessao. */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTE_PATHS.CHECK_EMAIL} element={<CheckEmailPage />} />
        <Route path={ROUTE_PATHS.CONFIRM_EMAIL} element={<ConfirmEmailPage />} />
      </Route>

      {/* Exigem sessao. A role decide qual area. */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTE_PATHS.ROOT} element={<RedirecionamentoDaRaiz />} />

        <Route element={<RoleRoute allow={ROLES_ADMIN} />}>
          <Route path={ROUTE_PATHS.ADMIN_HOME} element={<AdminLayout />}>
            {/*
              `/admin` nao renderiza mais pagina propria: ele redireciona para a
              primeira area administrativa disponivel (`ADMIN_DEFAULT_PATH`).

              O redirecionamento fica DENTRO do `AdminLayout` e do `RoleRoute`, e
              nao solto: assim o visitante sem sessao e o `cliente` continuam
              sendo tratados pelas guardas ANTES de qualquer redirecionamento,
              exatamente como antes.

              `replace` e obrigatorio. Sem ele, o "voltar" do navegador devolve o
              usuario a `/admin`, que redireciona de novo — um laco do qual ele
              nao sai.
            */}
            <Route index element={<Navigate to={ADMIN_DEFAULT_PATH} replace />} />
            <Route path="especies" element={<SpeciesPage />} />
          </Route>
          <Route path={`${ROUTE_PATHS.ADMIN_HOME}/*`} element={<NotFoundPage />} />
        </Route>

        <Route element={<RoleRoute allow={ROLES_CLIENTE} />}>
          <Route path={ROUTE_PATHS.CLIENT_HOME} element={<ClientLayout />}>
            <Route index element={<ClientHomePage />} />
          </Route>
          <Route path={`${ROUTE_PATHS.CLIENT_HOME}/*`} element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
