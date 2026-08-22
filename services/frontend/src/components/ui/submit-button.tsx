import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

type SubmitButtonProps = {
  readonly isLoading: boolean;
  /** Rotulo exibido enquanto `isLoading`. */
  readonly loadingLabel?: string;
  readonly children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Botao primario de envio dos formularios de autenticacao.
 *
 * `disabled` durante o carregamento e requisito da spec, nao polimento: sem ele
 * um duplo clique dispara duas requisicoes de registro ou dois logins, e o
 * segundo pode invalidar o refresh token emitido pelo primeiro.
 *
 * Rotulo em branco sobre `brand.purple`: 5.70:1, acima do WCAG AA.
 */
export function SubmitButton({
  isLoading,
  loadingLabel = 'Aguarde…',
  children,
  disabled,
  className,
  ...rest
}: SubmitButtonProps): ReactElement {
  const classes = [
    'w-full rounded-field bg-brand-purple py-[14px] text-[0.95rem] font-extrabold tracking-[0.3px] text-white shadow-button transition hover:bg-brand-purple-hover hover:shadow-button-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
    className ?? '',
  ]
    .join(' ')
    .trim();

  return (
    <button
      type="submit"
      disabled={isLoading || disabled === true}
      // Spread condicional: `aria-busy="false"` em repouso e ruido no DOM. O
      // atributo so existe enquanto a requisicao esta em voo.
      {...(isLoading ? { 'aria-busy': true } : {})}
      className={classes}
      {...rest}
    >
      {isLoading ? loadingLabel : children}
    </button>
  );
}
