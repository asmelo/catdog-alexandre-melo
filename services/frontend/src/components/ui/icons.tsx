import type { ReactElement } from 'react';

type IconProps = {
  /** Aresta do icone em pixels. O padrao 18 e o mesmo dos icones do `PasswordField`. */
  readonly size?: number;
};

/**
 * Atributos comuns aos icones de acao.
 *
 * `aria-hidden` porque o icone NUNCA carrega o significado: quem o exibe e o
 * `IconButton`, e e o `label` dele que produz o nome acessivel exigido pelo
 * RNF-07. Um `<svg>` visivel ao leitor de tela aqui so acrescentaria ruido ou,
 * pior, competiria com esse nome.
 *
 * `focusable="false"` neutraliza o Internet Explorer/Edge legado, que insere
 * SVGs na ordem de tabulacao por conta propria — o alvo focavel precisa ser o
 * `<button>` em volta, e apenas ele.
 */
const ATRIBUTOS_COMUNS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: false,
  'aria-hidden': true,
} as const;

/**
 * Lapis — acao de editar.
 *
 * SVG inline e nao pacote de icones: acrescentar `lucide-react` ou similar
 * levaria as dependencias de runtime do projeto de tres para quatro por conta de
 * dois desenhos.
 *
 * A cor vem de `currentColor` (e nao de um literal, como no `CatDogLogo`) porque
 * aqui o traco e estilo de interface, nao ilustracao da marca: quem pinta e o
 * botao em volta, conforme a variante.
 */
export function PencilIcon({ size = 18 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} {...ATRIBUTOS_COMUNS}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/** Lixeira — acao de excluir. Mesmas razoes de traco e cor do `PencilIcon`. */
export function TrashIcon({ size = 18 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} {...ATRIBUTOS_COMUNS}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
