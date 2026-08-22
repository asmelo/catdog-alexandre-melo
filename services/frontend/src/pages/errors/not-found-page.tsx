import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { AuthCard } from '~/components/ui/auth-card';
import { PawBackground } from '~/components/ui/paw-background';
import type { AuthStatus, AuthUser } from '~/contexts/auth/auth.types';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS, homePathForRole } from '~/routes/route-paths';

interface DestinoDeRetorno {
  readonly path: string;
  readonly label: string;
}

/**
 * O link de retorno acompanha o estado da sessao — e o que o criterio de aceite
 * chama de "coerente": mandar um cliente autenticado para o login seria
 * desloga-lo por ter digitado a URL errada, e mandar um visitante para a area do
 * cliente so produziria um segundo redirecionamento.
 *
 * O caso `bootstrapping` aponta para a raiz de proposito: a sessao ainda nao e
 * conhecida e a raiz e justamente a rota que decide o destino pela role (ou
 * manda ao login, se nao houver sessao). Sem este ramo, um F5 numa URL invalida
 * com sessao valida mostraria "login" por um instante.
 *
 * Funcao com retornos antecipados, e nao ternario encadeado: sao tres casos, e
 * um `a ? b : c ? d : e` aqui nao teria como ser lido de primeira.
 */
function escolherDestino(status: AuthStatus, user: AuthUser | null): DestinoDeRetorno {
  if (status === 'bootstrapping') {
    return { path: ROUTE_PATHS.ROOT, label: 'Voltar para o início' };
  }

  if (user !== null) {
    return { path: homePathForRole(user.role), label: 'Voltar para a minha área' };
  }

  return { path: ROUTE_PATHS.LOGIN, label: 'Ir para a tela de login' };
}

/**
 * Rota inexistente.
 *
 * Autossuficiente de proposito: e montada em tres lugares (o `*` global, e os
 * catch-all das areas de `admin` e `cliente`), sempre FORA de um layout. Se ela
 * dependesse de um layout, o `*` global — que atende visitante sem sessao — nao
 * teria moldura nenhuma; e se ela fosse montada DENTRO dos layouts, haveria dois
 * `<main>` e dois `<h1>` na mesma pagina, quebrando a navegacao por landmark e
 * por cabecalho.
 *
 * O destino do `<Link>` e sempre uma constante de `ROUTE_PATHS`, nunca um valor
 * vindo da URL — o que mantem esta pagina fora do alcance da advisory de open
 * redirect do `react-router` (GHSA-wrjc-x8rr-h8h6).
 */
export function NotFoundPage(): ReactElement {
  const { status, user } = useAuth();
  const destino = escolherDestino(status, user);

  return (
    <main className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface-canvas px-4 py-8">
      <PawBackground />

      <AuthCard
        title="Página não encontrada"
        subtitle="O endereço que você acessou não existe ou foi movido."
      >
        <div className="text-center">
          <Link
            to={destino.path}
            className="inline-block rounded-field bg-brand-purple px-5 py-3 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            {destino.label}
          </Link>
        </div>
      </AuthCard>
    </main>
  );
}
