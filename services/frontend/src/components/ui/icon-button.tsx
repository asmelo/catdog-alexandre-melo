import type { ReactElement, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'danger';

type IconButtonProps = {
  /**
   * Nome acessivel do botao. OBRIGATORIO e sem valor padrao de proposito: e ele
   * que satisfaz o RNF-07, e o texto precisa identificar a acao E o item sobre o
   * qual ela age ("Editar especie Gato"). Um padrao generico transformaria a
   * lista inteira em varios botoes chamados "Editar", indistinguiveis para quem
   * navega por leitor de tela.
   */
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly variant?: IconButtonVariant;
};

/**
 * `h-11 w-11` = alvo de toque de 44x44px com icone de 18px, igual ao botao do
 * olho do `PasswordField`: a area vem do padding, nao do tamanho do desenho.
 *
 * O anel de foco repete o `focus-visible:outline` do `admin-layout.tsx`, e nao o
 * `shadow-focus-ring` dos campos: sobre o cartao branco o contorno solido roxo
 * continua visivel mesmo quando o botao esta encostado na borda da linha.
 */
const CLASSES_BASE =
  'inline-flex h-11 w-11 items-center justify-center rounded-field transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Paleta por variante.
 *
 * A cor NAO e o unico indicador da diferenca entre as duas: quem carrega o
 * significado e o `label`, anunciado pelo leitor de tela e exibido como dica de
 * ferramenta pelo navegador. A variante `danger` usa `brand-orange-dark`
 * (4.85:1 sobre o cartao branco) e nao `brand-orange` (3.72:1), pela mesma
 * medicao ja registrada no `field-error.tsx`.
 */
const CLASSES_POR_VARIANTE: Readonly<Record<IconButtonVariant, string>> = {
  default: 'text-ink-mid hover:bg-brand-purple-light hover:text-brand-purple',
  danger: 'text-brand-orange-dark hover:bg-surface-input',
};

/**
 * Acao de linha representada por icone.
 *
 * `type="button"` explicito: o padrao do HTML e `submit`, e uma linha da lista
 * pode acabar dentro de um `<form>` — nesse caso o clique no lapis enviaria o
 * formulario em vez de abrir a edicao.
 */
export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  variant = 'default',
}: IconButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      // `disabled === true` em vez de repassar a prop: com
      // `exactOptionalPropertyTypes` um `undefined` explicito nao e valor valido
      // para o atributo, e o normalizador tambem documenta o padrao (habilitado).
      disabled={disabled === true}
      className={`${CLASSES_BASE} ${CLASSES_POR_VARIANTE[variant]}`}
    >
      {/*
        O `aria-hidden` fica AQUI e nao so dentro do icone: `icon` e um
        `ReactNode` de terceiros, e o botao nao pode depender de o chamador ter
        lembrado de esconder o desenho. Sem essa garantia, um SVG com `<title>`
        passaria a competir com o `label` na composicao do nome acessivel.

        O `title` mora NESTE span, e nao no `<button>`, de proposito. Ele existe
        para quem usa mouse: sem dica de ferramenta, um botao so de icone e mudo
        para quem enxerga. So que no botao ele virava tambem a DESCRICAO
        acessivel — o nome ja sai do `sr-only` por conteudo, e a especificacao de
        accname so promove `title` a nome quando nao ha outra fonte; sobrando, ele
        cai na descricao. Varios leitores anunciam nome e depois descricao, o que
        fazia o rotulo ser lido duas vezes. Dentro de um elemento `aria-hidden`,
        o `title` some da arvore de acessibilidade (descricao vazia, verificado)
        e continua rendendo a dica de ferramenta, que e comportamento visual do
        navegador e nao depende da arvore.

        `h-full w-full` para a dica cobrir os 44x44 inteiros do alvo de toque, e
        nao apenas os 18px do desenho.
      */}
      <span
        aria-hidden="true"
        title={label}
        className="inline-flex h-full w-full items-center justify-center"
      >
        {icon}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
