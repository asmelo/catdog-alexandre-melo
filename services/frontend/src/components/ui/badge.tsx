import type { ReactElement, ReactNode } from 'react';

type BadgeTone = 'species' | 'trait';

interface BadgeProps {
  readonly tone: BadgeTone;
  readonly children: ReactNode;
}

/**
 * Paleta por tom.
 *
 * A etiqueta de ESPECIE e a de CARACTERISTICA tem pesos visuais diferentes na
 * captura: a primeira identifica o animal e fica ao lado do nome; as tres outras
 * sao atributos, e competir com o nome as tornaria ruido.
 *
 * CONTRASTE MEDIDO, os dois acima dos 4.5:1 do WCAG AA para texto:
 *
 * - `species`: `brand.purple` (#7c3aed) sobre `brand.purple-light` (#ede9fe) — 5.31:1
 * - `trait`:   `ink.mid` (#4b4869) sobre `surface.input` (#f8f7fc) — 8.11:1, a
 *   mesma medicao ja registrada no `text-field.tsx`
 *
 * Nenhuma cor literal: so tokens do `tailwind.config.js` (RNF-20).
 */
const CLASSES_POR_TOM: Readonly<Record<BadgeTone, string>> = {
  species: 'bg-brand-purple-light text-brand-purple',
  trait: 'border border-hairline bg-surface-input text-ink-mid',
};

/**
 * Etiqueta de leitura.
 *
 * O TEXTO E SEMPRE EXIBIDO: espécie, sexo, porte e idade nunca sao comunicados so
 * por cor (RNF-28, CT-125). O tom apenas hierarquiza — quem carrega a informacao
 * e o conteudo.
 *
 * `<span>` e nao `<button>`: nada nesta feature e acionavel dentro do cartao.
 */
export function Badge({ tone, children }: BadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold ${CLASSES_POR_TOM[tone]}`}
    >
      {children}
    </span>
  );
}
