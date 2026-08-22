import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';

import { PawBackground } from '~/components/ui/paw-background';

/**
 * Moldura das telas de autenticacao: fundo com pegadas e o cartao centrado.
 *
 * Reproduz o enquadramento do `reference.html` (`body` com `display:flex`,
 * centralizado, fundo `--bg`). O `PawBackground` e `fixed inset-0 z-0`, e o
 * `AuthCard` sobe com `z-10` — por isso nao ha `relative` competindo aqui.
 *
 * `px-4 py-8`: o cartao tem `max-w-card` (420px) e, sem padding lateral, encosta
 * na borda em telas estreitas; o padding vertical evita que ele fique cortado
 * quando o conteudo passa da altura da viewport.
 *
 * `<main>` e nao `<div>`: e o landmark que o leitor de tela usa para pular
 * direto ao conteudo. Este layout nao tem `<header>` nem `<nav>` de proposito —
 * nao existe navegacao de aplicacao antes do login.
 */
export function AuthLayout(): ReactElement {
  return (
    <main className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface-canvas px-4 py-8">
      <PawBackground />
      <Outlet />
    </main>
  );
}
