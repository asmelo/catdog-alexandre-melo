import type { AriaAttributes, InputHTMLAttributes, ReactElement, ReactNode } from 'react';

import { FieldError } from '~/components/ui/field-error';

type TextFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  /**
   * Conteudo sobreposto ao canto direito do campo, dentro do wrapper
   * posicionado. Existe para o `PasswordField` encaixar o botao do olho sem
   * duplicar a marcacao do rotulo nem a logica de ARIA deste componente — que e
   * exatamente a logica que os criterios de aceite 2 e 3 cobram.
   */
  readonly trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

/** Aparencia do `.field input` do mockup, sem a cor da borda (varia com o erro). */
const CLASSES_BASE_DO_INPUT =
  'w-full rounded-field border-[1.5px] bg-surface-input px-4 py-[13px] text-[0.875rem] font-semibold text-ink outline-none transition-colors placeholder:font-semibold placeholder:text-ink-mid focus:border-brand-purple focus:shadow-focus-ring';

/**
 * Campo de texto rotulado do fluxo de autenticacao.
 *
 * DIVERGENCIA DELIBERADA DO MOCKUP: o `reference.html` identifica os campos
 * apenas por `placeholder`. Aqui cada campo tem um `<label htmlFor>` real,
 * apenas visualmente oculto por `sr-only`. Placeholder nao e rotulo — desaparece
 * ao primeiro caractere digitado, some da leitura de campo preenchido e nao e
 * anunciado de forma confiavel por todos os leitores de tela (RNF-05).
 *
 * O placeholder usa `ink.mid`, nao o `ink.muted` do mockup: medido, `ink.muted`
 * sobre `surface.input` da 2.69:1 e reprova o WCAG AA. `ink.mid` da 8.11:1.
 */
export function TextField({
  id,
  label,
  error,
  trailing,
  className,
  ...rest
}: TextFieldProps): ReactElement {
  // Trata string vazia como ausencia de erro: bibliotecas de formulario
  // devolvem `''` para campo valido, e emitir `aria-invalid="true"` nesse caso
  // marcaria como invalido um campo correto. Normalizar para `undefined` tambem
  // deixa o TypeScript estreitar o tipo no ponto de renderizacao.
  const mensagemDeErro = error === undefined || error === '' ? undefined : error;
  const temErro = mensagemDeErro !== undefined;
  const idDaMensagemDeErro = `${id}-error`;

  // Spread condicional em vez de `aria-invalid={undefined}`: o criterio de
  // aceite 3 exige a AUSENCIA dos dois atributos quando nao ha erro, nao um
  // valor vazio. Mesmo padrao do `error-handler.middleware.ts` no backend.
  const atributosDeErro: Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'> = temErro
    ? { 'aria-invalid': true, 'aria-describedby': idDaMensagemDeErro }
    : {};

  const classesDoInput = [
    CLASSES_BASE_DO_INPUT,
    temErro ? 'border-brand-orange' : 'border-hairline',
    className ?? '',
  ]
    .join(' ')
    .trim();

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input id={id} className={classesDoInput} {...atributosDeErro} {...rest} />
        {trailing}
      </div>
      {mensagemDeErro !== undefined && (
        <FieldError id={idDaMensagemDeErro} message={mensagemDeErro} />
      )}
    </div>
  );
}
