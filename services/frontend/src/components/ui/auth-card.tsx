import type { ReactElement, ReactNode } from 'react';

import { CatDogLogo } from '~/components/ui/catdog-logo';

type AuthCardProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
};

/**
 * Moldura branca do fluxo de autenticacao: logo, titulo, subtitulo e conteudo.
 *
 * `z-10` nao e cosmetico — e o que mantem o cartao acima da camada
 * `fixed inset-0 z-0` do `PawBackground`. Sem ele o cartao ainda apareceria
 * (mesma pilha, ordem do DOM), mas qualquer ajuste futuro de empilhamento no
 * fundo o cobriria.
 *
 * `p-card pb-9`: `spacing.card` e um valor unico de 44px, enquanto o `.card` do
 * mockup usa `padding: 44px 44px 36px`. O `pb-9` (36px) restaura a base menor da
 * referencia sem precisar de um segundo token.
 */
export function AuthCard({ title, subtitle, children }: AuthCardProps): ReactElement {
  return (
    <section className="relative z-10 w-full max-w-card animate-fadeUp rounded-card bg-surface-card p-card pb-9 shadow-card">
      <div className="mb-[22px]">
        <CatDogLogo />
      </div>

      <div className="text-center">
        {/*
          `<h1>` e obrigatorio e unico por pagina: e a ancora de navegacao por
          cabecalho do leitor de tela. Cada pagina do fluxo monta UM AuthCard.
        */}
        <h1 className="text-[1.35rem] font-extrabold text-ink">{title}</h1>
        {subtitle !== undefined && (
          <p className="mt-[5px] text-[0.82rem] font-semibold text-ink-mid">{subtitle}</p>
        )}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}
