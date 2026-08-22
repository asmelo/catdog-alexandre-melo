import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '~/contexts/auth/use-auth';
import { SessionSplash } from '~/routes/protected-route';
import { homePathForRole } from '~/routes/route-paths';

/**
 * Rotas que so fazem sentido para quem NAO tem sessao — login e cadastro.
 *
 * Quem ja esta autenticado e mandado para a home da propria role, atendendo a
 * restricao da spec ("Rotas de registro e login redirecionam automaticamente
 * para a area correta caso o usuario ja esteja autenticado").
 *
 * O splash durante o `bootstrapping` e tao necessario aqui quanto no
 * `ProtectedRoute`, por um motivo simetrico: sem ele, quem recarrega a pagina
 * COM sessao valida veria o formulario de login aparecer e desaparecer, porque
 * `status` comeca em `bootstrapping` e `user` ainda e `null`.
 */
export function PublicOnlyRoute(): ReactElement {
  const { status, user } = useAuth();

  if (status === 'bootstrapping') {
    return <SessionSplash />;
  }

  if (user !== null) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
