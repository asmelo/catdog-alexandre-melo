import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

import { AuthCard } from '~/components/ui/auth-card';
import type { AuthRole } from '~/contexts/auth/auth.types';
import { useAuth } from '~/contexts/auth/use-auth';
import { AdminLayout } from '~/layouts/admin-layout';
import { AuthLayout } from '~/layouts/auth-layout';
import { ClientLayout } from '~/layouts/client-layout';
import { NotFoundPage } from '~/pages/errors/not-found-page';
import { ProtectedRoute } from '~/routes/protected-route';
import { PublicOnlyRoute } from '~/routes/public-only-route';
import { ROUTE_PATHS, homePathForRole } from '~/routes/route-paths';
import { RoleRoute } from '~/routes/role-route';

/**
 * Constantes de modulo, e nao literais no JSX: um `allow={['admin']}` escrito no
 * elemento cria um array novo a cada render do roteador, mudando a prop por
 * identidade sem mudar de valor.
 */
const ROLES_ADMIN: ReadonlyArray<AuthRole> = ['admin'];
const ROLES_CLIENTE: ReadonlyArray<AuthRole> = ['cliente'];

const AVISO_PLACEHOLDER = 'Tela definitiva na TASK-FRONTEND-012.';

const CLASSES_DIAGNOSTICO = 'mt-1 text-center text-xs font-semibold text-ink-muted';

/**
 * Placeholder do login.
 *
 * Exibe `logoutReason` e o `state` de navegacao como DIAGNOSTICO, nao como
 * interface: e o que torna a AC #10 (sessao expirada) verificavel por consulta ao
 * DOM neste slice, sem antecipar o catalogo de mensagens da TASK-FRONTEND-012.
 * O texto "Sua sessão expirou. Faça login novamente." NAO e renderizado aqui de
 * proposito — quem o exibe e a tela real, ramificando em
 * `logoutReason === 'session-expired'`.
 *
 * TODO(TASK-FRONTEND-012): substituir por `src/pages/auth/login-page.tsx`.
 */
function PlaceholderDeLogin(): ReactElement {
  const { logoutReason } = useAuth();
  const location = useLocation();
  // O `state` do roteador e tipado como `any` pela biblioteca. A anotacao
  // explicita para `unknown` mantem o valor sem tipo utilizavel por acidente.
  const estadoDeNavegacao: unknown = location.state;

  return (
    <AuthCard title="Bem vindo!" subtitle={AVISO_PLACEHOLDER}>
      <p className={CLASSES_DIAGNOSTICO} data-testid="logout-reason">
        logoutReason: {logoutReason ?? 'null'}
      </p>
      <p className={CLASSES_DIAGNOSTICO} data-testid="redirect-state">
        state: {JSON.stringify(estadoDeNavegacao)}
      </p>
    </AuthCard>
  );
}

/** TODO(TASK-FRONTEND-012): substituir por `src/pages/auth/register-page.tsx`. */
function PlaceholderDeCadastro(): ReactElement {
  return (
    <AuthCard title="Criar conta" subtitle={AVISO_PLACEHOLDER}>
      <p className={CLASSES_DIAGNOSTICO}>rota: {ROUTE_PATHS.REGISTER}</p>
    </AuthCard>
  );
}

/** TODO(TASK-FRONTEND-012): substituir por `src/pages/auth/check-email-page.tsx`. */
function PlaceholderDeVerificacaoDeEmail(): ReactElement {
  return (
    <AuthCard title="Verifique seu e-mail" subtitle={AVISO_PLACEHOLDER}>
      <p className={CLASSES_DIAGNOSTICO}>rota: {ROUTE_PATHS.CHECK_EMAIL}</p>
    </AuthCard>
  );
}

/**
 * Placeholder do resultado da confirmacao de conta.
 *
 * Le e exibe o `token` da query string porque e exatamente isso que a AC #7
 * cobra: a rota e publica E o parametro continua acessivel. NAO chama a API — o
 * token e de uso unico (RN-03) e consumi-lo aqui faria a tela real da
 * TASK-FRONTEND-012 encontrar um token ja utilizado.
 *
 * TODO(TASK-FRONTEND-012): substituir por `src/pages/auth/confirm-email-page.tsx`.
 */
function PlaceholderDeConfirmacaoDeEmail(): ReactElement {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');

  return (
    <AuthCard title="Confirmação de conta" subtitle={AVISO_PLACEHOLDER}>
      <p className={CLASSES_DIAGNOSTICO} data-testid="confirm-token">
        token: {token ?? '(ausente)'}
      </p>
    </AuthCard>
  );
}

/** TODO(TASK-FRONTEND-012): substituir por `src/pages/admin/admin-home-page.tsx`. */
function PlaceholderDaHomeAdmin(): ReactElement {
  const { user } = useAuth();

  return (
    <section className="rounded-card bg-surface-card p-card shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">Painel administrativo</h1>
      <p className="mt-2 text-sm font-semibold text-ink-mid">
        Sessão de {user?.name ?? 'usuário'} — {AVISO_PLACEHOLDER}
      </p>
    </section>
  );
}

/** TODO(TASK-FRONTEND-012): substituir por `src/pages/client/client-home-page.tsx`. */
function PlaceholderDaHomeCliente(): ReactElement {
  const { user } = useAuth();

  return (
    <section className="rounded-card bg-surface-card p-card shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">Minha área</h1>
      <p className="mt-2 text-sm font-semibold text-ink-mid">
        Sessão de {user?.name ?? 'usuário'} — {AVISO_PLACEHOLDER}
      </p>
    </section>
  );
}

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
 * 3. Todas as folhas sao placeholders com `TODO(TASK-FRONTEND-012)`. E o que
 *    torna este slice executavel e verificavel isoladamente: as guardas, os
 *    layouts e os redirecionamentos sao exercitaveis hoje, e a task seguinte
 *    troca cada elemento pela pagina real sem tocar na estrutura.
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      {/* Exclusivas de quem NAO tem sessao: login e cadastro. */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path={ROUTE_PATHS.LOGIN} element={<PlaceholderDeLogin />} />
          <Route path={ROUTE_PATHS.REGISTER} element={<PlaceholderDeCadastro />} />
        </Route>
      </Route>

      {/* Publicas para qualquer visitante, com ou sem sessao. */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTE_PATHS.CHECK_EMAIL} element={<PlaceholderDeVerificacaoDeEmail />} />
        <Route path={ROUTE_PATHS.CONFIRM_EMAIL} element={<PlaceholderDeConfirmacaoDeEmail />} />
      </Route>

      {/* Exigem sessao. A role decide qual area. */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTE_PATHS.ROOT} element={<RedirecionamentoDaRaiz />} />

        <Route element={<RoleRoute allow={ROLES_ADMIN} />}>
          <Route path={ROUTE_PATHS.ADMIN_HOME} element={<AdminLayout />}>
            <Route index element={<PlaceholderDaHomeAdmin />} />
          </Route>
          <Route path={`${ROUTE_PATHS.ADMIN_HOME}/*`} element={<NotFoundPage />} />
        </Route>

        <Route element={<RoleRoute allow={ROLES_CLIENTE} />}>
          <Route path={ROUTE_PATHS.CLIENT_HOME} element={<ClientLayout />}>
            <Route index element={<PlaceholderDaHomeCliente />} />
          </Route>
          <Route path={`${ROUTE_PATHS.CLIENT_HOME}/*`} element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
