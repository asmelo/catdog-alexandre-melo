import type { ReactElement } from 'react';

type FieldErrorProps = {
  /** Precisa casar com o `aria-describedby` do campo que descreve. */
  readonly id: string;
  readonly message: string;
};

/**
 * Mensagem de erro de um campo.
 *
 * A cor e `brand.orange-dark` (#c44a10), NAO o `brand.orange` (#e05a1e) que o
 * plano prescrevia. Medido: laranja da marca sobre branco da 3.72:1 e reprova o
 * WCAG AA (4.5:1) — justamente em texto de 0.75rem, o menor da interface e o que
 * mais precisa ser legivel. O laranja escuro do focinho do logo, que ja e token
 * do design system, da 4.85:1 e passa. Nenhuma cor nova foi inventada.
 *
 * A cor nunca e o unico indicador: o campo correspondente carrega
 * `aria-invalid="true"` e aponta para este elemento por `aria-describedby`.
 */
export function FieldError({ id, message }: FieldErrorProps): ReactElement {
  return (
    <p id={id} className="mt-1 text-[0.75rem] font-semibold text-brand-orange-dark">
      {message}
    </p>
  );
}
