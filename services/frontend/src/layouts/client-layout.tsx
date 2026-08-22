import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { CatDogLogo } from '~/components/ui/catdog-logo';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS } from '~/routes/route-paths';

/**
 * Estilo dos itens da navegacao do cliente. Header claro, entao o indicador de
 * foco e o proprio token `shadow-focus-ring` (roxo a 80%, reforcado na
 * TASK-FRONTEND-009) — visivel sobre `surface-card`, ao contrario do que
 * acontece na topbar roxa do admin.
 */
function classesDoItemDeNavegacao({ isActive }: { isActive: boolean }): string {
  const base =
    'rounded-field px-3 py-1.5 text-sm font-extrabold text-ink-mid transition-colors hover:bg-brand-purple-light hover:text-brand-purple focus-visible:shadow-focus-ring focus-visible:outline-none';

  return isActive ? `${base} bg-brand-purple-light text-brand-purple` : base;
}

/**
 * Moldura da area do cliente: header claro + conteudo.
 *
 * REGRA CENTRAL DESTE ARQUIVO (CA-10): nenhum controle administrativo pode
 * existir aqui — nem oculto, nem desabilitado, nem escondido por CSS. A ausencia
 * e no DOM, o que significa que nao ha nada neste componente condicionado a
 * `role === 'admin'`. Um `{user.role === 'admin' && <LinkAdmin />}` seria
 * tecnicamente equivalente na tela e falharia o criterio na intencao: bastaria
 * um bug de estado para o controle aparecer. Aqui nao existe o codigo.
 *
 * O layout tambem nao renderiza a palavra "Administrador" nem qualquer rota de
 * `/admin`, o que torna a verificacao por consulta ao DOM objetiva.
 */
export function ClientLayout(): ReactElement {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <header className="border-b border-hairline bg-surface-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <CatDogLogo size={28} />

          <nav aria-label="Navegação do cliente" className="flex items-center gap-1">
            <NavLink to={ROUTE_PATHS.CLIENT_HOME} end className={classesDoItemDeNavegacao}>
              Minha área
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user !== null && (
              <span className="text-sm font-extrabold text-ink">{user.name}</span>
            )}

            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="rounded-field bg-brand-purple px-3 py-1.5 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
