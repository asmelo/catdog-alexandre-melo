import type { ReactElement, TextareaHTMLAttributes } from 'react';

import { FieldShell, classesDoControle } from '~/components/ui/field-shell';

type TextareaFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  /**
   * Exibe "N/M caracteres" sob o campo. Exige `maxLength` — sem o teto nao ha
   * denominador, e um contador sem limite nao informa nada.
   */
  readonly showCounter?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

/** Comprimento do valor corrente, tolerando o campo ainda vazio. */
function comprimentoDe(valor: TextareaFieldProps['value']): number {
  return typeof valor === 'string' ? valor.length : 0;
}

/**
 * Area de texto rotulada, com o mesmo contrato do `SelectField`.
 *
 * O `maxLength` do elemento NAO substitui a validacao. O limite de 1000 da RN-23
 * vale sobre o texto JA NORMALIZADO e e verificado no servidor; aqui ele e
 * conveniencia, e impede a digitacao passar do teto no caso comum. Um usuario que
 * cole texto com espacos repetidos pode ficar abaixo de 1000 caracteres brutos e
 * acima depois da normalizacao — por isso o servidor continua sendo quem recusa.
 */
export function TextareaField({
  id,
  label,
  error,
  showCounter,
  required,
  className,
  maxLength,
  value,
  rows = 4,
  ...rest
}: TextareaFieldProps): ReactElement {
  const exibeContador = showCounter === true && maxLength !== undefined;
  const idDoContador = `${id}-counter`;

  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      {...(required === true ? { required } : {})}
      {...(exibeContador
        ? {
            hint: (
              /*
               * `polite` e NUNCA `assertive`: um contador que interrompe o leitor
               * de tela a cada tecla digitada torna o campo inutilizavel. Com
               * `polite` o valor e anunciado quando o usuario faz uma pausa.
               */
              <p
                id={idDoContador}
                aria-live="polite"
                className="mt-1 text-right text-[0.75rem] font-semibold text-ink-mid"
              >
                {comprimentoDe(value)}/{maxLength} caracteres
              </p>
            ),
          }
        : {})}
    >
      {({ atributosDeErro, temErro }) => (
        <textarea
          id={id}
          rows={rows}
          value={value}
          className={classesDoControle(temErro, ['resize-y', className ?? ''].join(' ').trim())}
          {...(maxLength === undefined ? {} : { maxLength })}
          {...(required === true ? { required: true } : {})}
          {...atributosDeErro}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
