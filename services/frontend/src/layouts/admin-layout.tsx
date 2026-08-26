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
 * de tela sem nenhum atributo escrito a mao. O mecanismo continua sendo o do
 * proprio roteador: comparar `pathname` a mao devolveria o estado ativo sem o
 * `aria-current`, e a informacao sumiria para quem nao ve a tela.
 *
 * Item ativo = pilula solida `bg-brand-purple` com texto branco (5.70:1); item
 * inativo = sem fundo, `text-ink-mid` sobre a barra clara (8.64:1). E o mesmo
 * par ativo/inativo do `client-layout.tsx`, so que com a pilula preenchida em
 * vez do realce claro, como manda a captura de tela.
 *
 * O anel de foco e o `shadow-focus-ring` da base — nao ha mais fundo roxo sob os
 * itens para apaga-lo, e o token rende 3.98:1 sobre a barra clara, acima do
 * minimo de 3:1 do SC 1.4.11.
 *
 * As duas ramificacoes nao compartilham utilitarios de `hover`: o Tailwind
 * resolve `hover:text-white` contra `hover:text-brand-purple` pela ordem da
 * folha gerada, e nao pela ordem da string de classes, entao empilhar os dois no
 * mesmo elemento daria um vencedor que este arquivo nao controla.
 */
function classesDoItemDeNavegacao({ isActive }: { isActive: boolean }): string {
  const base =
    'block w-full rounded-field px-3 py-2 text-left text-sm font-extrabold transition-colors focus-visible:shadow-focus-ring focus-visible:outline-none';

  return isActive
    ? `${base} bg-brand-purple text-white hover:bg-brand-purple-hover`
    : `${base} text-ink-mid hover:bg-brand-purple-light hover:text-brand-purple`;
}

/**
 * Moldura da area administrativa: navegacao LATERAL clara + conteudo.
 *
 * O arranjo lateral vem da captura de tela que e a fonte da verdade do layout do
 * MODULE-002 (Decisao 4 do changelog da FEATURE-001), e substitui a topbar
 * horizontal de um item so entregue pela FEATURE-002.
 *
 * A BARRA E CLARA, e nao roxa. A captura mostra uma coluna `bg-surface-card`
 * separada do conteudo por um fio a direita, com o logo direto sobre o branco e
 * apenas o item ATIVO preenchido de roxo. A prosa da task descrevia a coluna
 * inteira roxa; a captura foi declarada fonte da verdade do layout e prevaleceu.
 * A moldura repete a do `client-layout.tsx` (`border-hairline` sobre
 * `bg-surface-card`), so que na vertical — nenhum token novo foi criado.
 *
 * Duas consequencias diretas do fundo claro: o `CatDogLogo` dispensa a placa
 * branca que existia para salvar o wordmark `text-ink` fixo (`#1e1b2e` sobre
 * branco rende 16.78:1, contra 2.78:1 que rendia sobre o roxo), e o anel de foco
 * volta a ser o `shadow-focus-ring` da base, sem a excecao do anel branco.
 *
 * Os landmarks sao `<header>`, `<nav>` e `<main>` de verdade, e nao `<div>`: sao
 * eles que permitem ao leitor de tela pular a navegacao e ir ao conteudo, e a
 * diferenca nao aparece na tela — so na navegacao assistiva.
 *
 * A barra lateral e `<header>` e nao `<aside>`, e a escolha resolve uma
 * divergencia INTERNA da task, que pede as duas coisas: `<aside>` ao descrever a
 * geometria da coluna e, adiante, "manter `<header>`/`<nav>`/`<main>` como
 * landmarks reais". `<header>` no topo da arvore e o landmark `banner`; `<aside>`
 * seria `complementary` e o `banner` deixaria de existir. Como o pedido explicito
 * sobre LANDMARKS nomeia `<header>` e o pedido por `<aside>` fala de posicao
 * ("fixa a esquerda"), venceu a semantica: a coluna e um `<header>` de 14rem.
 *
 * "Animais" aponta para uma rota que AINDA NAO TEM PAGINA, e isso e deliberado: o
 * item precisa estar visivel na navegacao (CA-01), e enquanto a feature de
 * animais nao existir o destino cai no catch-all administrativo e mostra a 404 do
 * projeto — a informacao honesta. Desabilita-lo, esconde-lo ou aponta-lo para
 * `/admin/especies` seriam as tres formas de mentir sobre isso.
 *
 * Os itens vao SEM icone. A captura mostra um icone a esquerda de cada rotulo,
 * mas `~/components/ui/icons.tsx` so entrega `PencilIcon` e `TrashIcon`
 * (TASK-FRONTEND-006) — nenhum deles representa animal ou especie. Desenhar dois
 * icones novos aqui seria criar primitiva de interface fora da task que a
 * governa; o rotulo textual sozinho ja identifica o destino.
 */
export function AdminLayout(): ReactElement {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      <header className="flex w-56 flex-col gap-6 border-r border-hairline bg-surface-card px-4 py-6">
        <CatDogLogo size={28} />

        <nav aria-label="Navegação administrativa" className="flex flex-col gap-1">
          <NavLink to={ROUTE_PATHS.ADMIN_ANIMALS} className={classesDoItemDeNavegacao}>
            Animais
          </NavLink>
          <NavLink to={ROUTE_PATHS.ADMIN_SPECIES} className={classesDoItemDeNavegacao}>
            Espécies
          </NavLink>
        </nav>

        <div className="mt-auto flex flex-col items-start gap-2">
          {/*
            "Administrador" identifica o PERFIL, o nome identifica a PESSOA. Os
            dois juntos sao o que torna o layout administrativo reconhecivel a
            olho nu e por consulta ao DOM — e a ausencia deste texto na area do
            cliente e parte do criterio CA-10 da FEATURE-002.
          */}
          <span className="text-sm font-extrabold text-ink">Administrador</span>
          {user !== null && <span className="text-sm font-semibold text-ink-mid">{user.name}</span>}

          <button
            type="button"
            onClick={() => {
              // `void` explicito: `logout` nunca rejeita (a promessa e engolida
              // dentro do provider), e o handler de clique nao pode ser `async`
              // sem devolver uma promessa que ninguem observa.
              void logout();
            }}
            className="rounded-field bg-brand-purple px-3 py-1.5 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
