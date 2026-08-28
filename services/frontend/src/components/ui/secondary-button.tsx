import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

type SecondaryButtonProps = {
  readonly isLoading?: boolean;
  /** Rotulo exibido enquanto `isLoading`. */
  readonly loadingLabel?: string;
  readonly children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Botao secundario: contorno roxo em vez de preenchido.
 *
 * A distincao nao e decorativa — ele nunca pode competir com o botao primario da
 * tela. Na de login e o reenvio do e-mail de confirmacao ao lado do "Entrar"; no
 * formulario de animal e o "Cancelar" ao lado do "Salvar".
 *
 * `type="button"` por PADRAO, ao contrario do `SubmitButton`. Dentro de um
 * `<form>`, o default do HTML e `submit`, e um "Cancelar" que envia o formulario
 * e o defeito classico deste componente. Continua sobrescritivel pelo `...rest`
 * para o caso raro em que um botao secundario precise enviar.
 *
 * Contraste medido: roxo da marca sobre o branco do cartao da 5.70:1 (AA exige
 * 4.5:1); o anel de foco da 3.97:1 contra o cartao (AA exige 3:1). Os dois
 * valores sao os ja registrados nos tokens — nenhuma cor nova foi introduzida.
 */
/**
 * EXPORTADA porque o `ImageUploadField` precisa da mesma aparencia num `<label>`,
 * e nao num `<button>`: dentro de um `<label htmlFor>`, um `<button>` nao aciona o
 * input de arquivo, e um botao que chamasse `input.click()` criaria um SEGUNDO
 * ponto focavel para a mesma acao — o usuario de teclado passaria duas vezes pelo
 * mesmo controle. Compartilhar a string e o que evita a divergencia visual que a
 * TASK-FRONTEND-014 acabou de eliminar.
 *
 * `w-full` faz parte da base porque os dois usos em formulario ocupam a largura
 * toda; quem precisa de largura automatica sobrescreve com `w-auto`.
 */
export const SECONDARY_BUTTON_CLASSES =
  'w-full rounded-field border-[1.5px] border-brand-purple bg-surface-card py-3 text-[0.82rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export function SecondaryButton({
  isLoading = false,
  loadingLabel = 'Aguarde…',
  children,
  disabled,
  className,
  ...rest
}: SecondaryButtonProps): ReactElement {
  return (
    <button
      type="button"
      disabled={isLoading || disabled === true}
      // Spread condicional: `aria-busy="false"` em repouso e ruido no DOM.
      {...(isLoading ? { 'aria-busy': true } : {})}
      className={[SECONDARY_BUTTON_CLASSES, className ?? ''].join(' ').trim()}
      {...rest}
    >
      {isLoading ? loadingLabel : children}
    </button>
  );
}
