import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { AuthRole } from '~/contexts/auth/auth.types';
import { useAuth } from '~/contexts/auth/use-auth';
import { SessionSplash } from '~/routes/protected-route';
import { ROUTE_PATHS, buildRedirectState, homePathForRole } from '~/routes/route-paths';

interface RoleRouteProps {
  /** Roles que podem ver as rotas filhas. */
  readonly allow: ReadonlyArray<AuthRole>;
}

/**
 * Restringe as rotas filhas a um conjunto de roles.
 *
 * Role fora da lista e REDIRECIONADA para a area da propria role — nao recebe um
 * 403. E o comportamento literal exigido pela spec (CT-16 / CA-11): o usuario
 * nao precisa saber que existe uma area da qual foi barrado, ele precisa acabar
 * onde tem o que fazer.
 *
 * A decisao vem antes de montar os filhos, entao o conteudo restrito nao existe
 * no DOM nem por um render. Vale lembrar que esta verificacao e CONVENIENCIA DE
 * UX: a autorizacao que vale e a do servidor (RN-10, `authenticate` +
 * `authorizeRole` da TASK-BACKEND-006). Nada que dependa apenas desta guarda
 * pode ser tratado como protegido.
 *
 * Espera `ProtectedRoute` acima na arvore, mas nao confia nisso: as duas guardas
 * de baixo cobrem a montagem isolada (em teste, ou numa arvore futura mal
 * montada) sem lancar excecao e sem vazar conteudo.
 */
export function RoleRoute({ allow }: RoleRouteProps): ReactElement {
  const { status, user } = useAuth();
  const location = useLocation();

  // Mesmo motivo do `ProtectedRoute`: durante o bootstrap ainda nao se sabe qual
  // e a role, e decidir agora deslogaria o usuario no F5.
  if (status === 'bootstrapping') {
    return <SessionSplash />;
  }

  if (user === null) {
    return (
      <Navigate to={ROUTE_PATHS.LOGIN} state={buildRedirectState(location)} replace />
    );
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
