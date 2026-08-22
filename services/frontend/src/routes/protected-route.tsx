import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { CatDogLogo } from '~/components/ui/catdog-logo';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS, buildRedirectState } from '~/routes/route-paths';

/**
 * Tela de espera do bootstrap da sessao.
 *
 * Vive neste arquivo, e nao num arquivo proprio, porque o contrato desta task
 * fixa os arquivos a criar e nenhum deles e um componente de splash — e
 * duplicar o markup nas duas guardas que precisam dele seria pior. Nao e
 * componente de design system: e a moldura minima de um estado transitorio que
 * so as guardas produzem.
 *
 * `role="status"` + `aria-live="polite"` fazem o leitor de tela anunciar a
 * espera; sem isso a navegacao ficaria em silencio ate a sessao resolver.
 */
export function SessionSplash(): ReactElement {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-surface-canvas"
    >
      <CatDogLogo size={44} />
      <p className="text-sm font-semibold text-ink-muted">Carregando sua sessão...</p>
    </main>
  );
}

/**
 * Exige sessao autenticada para renderizar as rotas filhas.
 *
 * Os tres estados sao tratados separadamente, e a ORDEM importa:
 *
 * 1. `bootstrapping` renderiza o splash e NUNCA redireciona. O access token vive
 *    em memoria, entao um F5 o apaga e o `POST /auth/refresh` ainda esta em voo
 *    quando esta guarda decide. Redirecionar aqui deslogaria o usuario a cada
 *    recarga — o bug classico deste padrao.
 * 2. `anonymous` redireciona para o login com `replace`, para que o botao
 *    "voltar" nao recaia na rota bloqueada, e com o destino original no `state`.
 * 3. autenticado renderiza `<Outlet />`.
 *
 * A decisao acontece ANTES de montar qualquer filho: nao existe render em que o
 * conteudo protegido exista no DOM para um usuario sem sessao. Esconder por CSS
 * nao atenderia o criterio — o conteudo estaria no DOM e no bundle de HTML.
 */
export function ProtectedRoute(): ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return <SessionSplash />;
  }

  if (status === 'anonymous') {
    return (
      <Navigate to={ROUTE_PATHS.LOGIN} state={buildRedirectState(location)} replace />
    );
  }

  return <Outlet />;
}
