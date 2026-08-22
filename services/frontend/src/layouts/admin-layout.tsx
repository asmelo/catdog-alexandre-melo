import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { CatDogLogo } from '~/components/ui/catdog-logo';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS } from '~/routes/route-paths';

/**
 * Estilo dos itens da navegacao administrativa.
 *
 * O `NavLink` marca `aria-current="page"` sozinho no item ativo — e por isso que
 * ele e usado aqui em vez do `Link`: a indicacao de "onde estou" chega ao leitor
 * de tela sem nenhum atributo escrito a mao, e o sublinhado abaixo e apenas o
 * reforco visual dela (cor nao e o unico indicador).
 *
 * O anel de foco e BRANCO neste layout. O token `shadow-focus-ring` e roxo a 80%
 * e some por completo sobre `bg-brand-purple`; branco sobre roxo rende 5.94:1,
 * bem acima do minimo de 3:1 do SC 1.4.11 para indicador nao-textual.
 */
function classesDoItemDeNavegacao({ isActive }: { isActive: boolean }): string {
  const base =
    'rounded-field px-3 py-1.5 text-sm font-extrabold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  return isActive ? `${base} bg-brand-purple-hover underline decoration-2 underline-offset-4` : base;
}

/**
 * Moldura da area administrativa: topbar roxa de gestao + conteudo.
 *
 * Os landmarks sao `<header>`, `<nav>` e `<main>` de verdade, e nao `<div>`: sao
 * eles que permitem ao leitor de tela pular a topbar e ir ao conteudo, e a
 * diferenca nao aparece na tela — so na navegacao assistiva.
 *
 * DIVERGENCIA DELIBERADA DO PLANO, por acessibilidade: o plano pede
 * `bg-brand-purple text-white` com o `CatDogLogo` dentro. O wordmark "CatDog" do
 * componente e `text-ink` (`#1e1b2e`) fixo — ele descreve a marca e nao pode ser
 * recolorido de fora (TASK-FRONTEND-009) — e `#1e1b2e` sobre `#7c3aed` rende
 * 2.78:1, reprovando o WCAG AA (4.5:1). A topbar continua roxa; o logo ganha uma
 * placa `bg-surface-card`, que devolve ao wordmark o fundo claro para o qual ele
 * foi desenhado (15.74:1). Alternativa recusada: editar o componente do logo —
 * ele pertence a outra task e e usado no cartao branco de autenticacao.
 */
export function AdminLayout(): ReactElement {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <header className="bg-brand-purple text-white shadow-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="rounded-field bg-surface-card px-3 py-1.5">
            <CatDogLogo size={28} />
          </div>

          <nav aria-label="Navegação administrativa" className="flex items-center gap-1">
            <NavLink to={ROUTE_PATHS.ADMIN_HOME} end className={classesDoItemDeNavegacao}>
              Painel
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/*
              "Administrador" identifica o PERFIL, o nome identifica a PESSOA. Os
              dois juntos sao o que torna o layout administrativo reconhecivel a
              olho nu e por consulta ao DOM — e a ausencia deste texto na area do
              cliente e parte do criterio CA-10.
            */}
            <span className="text-sm font-extrabold">Administrador</span>
            {user !== null && (
              <span className="text-sm font-semibold text-brand-purple-light">{user.name}</span>
            )}

            <button
              type="button"
              onClick={() => {
                // `void` explicito: `logout` nunca rejeita (a promessa e engolida
                // dentro do provider), e o handler de clique nao pode ser `async`
                // sem devolver uma promessa que ninguem observa.
                void logout();
              }}
              className="rounded-field border-[1.5px] border-white px-3 py-1.5 text-sm font-extrabold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
