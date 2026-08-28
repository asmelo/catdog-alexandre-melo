import type { AriaAttributes, ReactElement, ReactNode } from 'react';

import { FieldError } from '~/components/ui/field-error';

/**
 * Anatomia comum dos campos ROTULADOS VISIVELMENTE do formulario de animal.
 *
 * Existe porque as quatro primitivas desta task repetiriam, cada uma, as mesmas
 * quatro decisoes: o `<label htmlFor>` casando com o `id` do controle, o
 * asterisco de obrigatoriedade acompanhado de texto acessivel, o par
 * `aria-invalid`/`aria-describedby` e o tratamento de `''` como ausencia de erro.
 * Quatro copias divergem na primeira correcao — e o que divergiria e justamente a
 * parte de acessibilidade, que e a que ninguem ve quebrar.
 *
 * NAO SUBSTITUI O `TextField`. Aquele e do fluxo de autenticacao, onde o rotulo e
 * `sr-only` por decisao de layout do mockup; aqui o rotulo e VISIVEL, como a
 * captura do formulario de animal mostra. Sao anatomias diferentes de proposito.
 */

export interface CamposDeAcessibilidadeDoControle {
  readonly id: string;
  readonly atributosDeErro: Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'>;
  readonly temErro: boolean;
}

export interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly error?: string;
  /** Texto auxiliar sob o controle (contador de caracteres, por exemplo). */
  readonly hint?: ReactNode;
  /** Recebe o `id` e os atributos de ARIA a aplicar no controle. */
  readonly children: (campos: CamposDeAcessibilidadeDoControle) => ReactNode;
}

/**
 * Classe do controle, compartilhada por `SelectField`, `TextareaField` e
 * `DateField` para que os tres tenham a MESMA altura, o mesmo raio e o mesmo anel
 * de foco. A borda fica de fora porque varia com o erro.
 */
export const CLASSES_BASE_DO_CONTROLE =
  'w-full rounded-field border-[1.5px] bg-surface-input px-4 py-[13px] text-[0.875rem] font-semibold text-ink outline-none transition-colors placeholder:font-semibold placeholder:text-ink-mid focus:border-brand-purple focus:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60';

export function classesDoControle(temErro: boolean, extras?: string): string {
  return [
    CLASSES_BASE_DO_CONTROLE,
    temErro ? 'border-brand-orange' : 'border-hairline',
    extras ?? '',
  ]
    .join(' ')
    .trim();
}

export function FieldShell({
  id,
  label,
  required,
  error,
  hint,
  children,
}: FieldShellProps): ReactElement {
  /**
   * `''` tratado como ausencia de erro, como no `TextField`: bibliotecas de
   * formulario devolvem texto vazio para campo valido, e emitir
   * `aria-invalid="true"` nesse caso marcaria como invalido um campo correto.
   */
  const mensagemDeErro = error === undefined || error === '' ? undefined : error;
  const temErro = mensagemDeErro !== undefined;
  const idDaMensagemDeErro = `${id}-error`;

  /**
   * Spread condicional, e nao `aria-invalid={undefined}`: o contrato e a AUSENCIA
   * dos dois atributos quando nao ha erro, nao um valor vazio.
   */
  const atributosDeErro: Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'> = temErro
    ? { 'aria-invalid': true, 'aria-describedby': idDaMensagemDeErro }
    : {};

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.8rem] font-extrabold text-ink"
      >
        {label}
        {required === true && (
          <>
            {/*
              O asterisco e DECORATIVO e fica escondido do leitor de tela; quem
              anuncia a obrigatoriedade e o texto ao lado, visualmente oculto. Um
              asterisco sozinho e lido como "asterisco" ou simplesmente ignorado,
              e o usuario nao fica sabendo que o campo e obrigatorio.
            */}
            <span aria-hidden="true" className="ml-1 text-brand-orange-dark">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </label>

      {children({ id, atributosDeErro, temErro })}

      {hint}

      {mensagemDeErro !== undefined && (
        <FieldError id={idDaMensagemDeErro} message={mensagemDeErro} />
      )}
    </div>
  );
}
