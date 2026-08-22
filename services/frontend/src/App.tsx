import type { ReactElement } from 'react';

/**
 * Placeholder de verificacao do design system.
 *
 * Nao e tela nem componente reutilizavel: e a prova visual de que os tokens do
 * `reference.html` chegaram ao Tailwind. Exercita deliberadamente as sete
 * classes cobradas pelo criterio de aceite 6 — `max-w-card`, `p-card`,
 * `animate-fadeUp`, `rounded-field`, `bg-brand-purple`, `shadow-button` e
 * `text-ink-muted` — porque o Tailwind so emite a regra de uma classe que
 * aparece no `content`; sem uso real, o CSS gerado nao conteria nada a inspecionar.
 *
 * Sera substituido pelo roteador na TASK-FRONTEND-011.
 */
export function App(): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-card animate-fadeUp rounded-card bg-surface-card p-card shadow-card">
        <h1 className="text-center text-2xl font-extrabold text-ink">CatDog</h1>
        <p className="mt-2 text-center text-sm font-semibold text-ink-muted">
          Design system carregado. Este cartão é um placeholder de verificação dos tokens.
        </p>
        <div className="mt-6 rounded-field bg-brand-purple p-3 text-center text-sm font-extrabold text-white shadow-button">
          Amostra de token
        </div>
      </section>
    </main>
  );
}
