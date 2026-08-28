import type { InputHTMLAttributes, ReactElement } from 'react';

import { FieldShell, classesDoControle } from '~/components/ui/field-shell';

type DateFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>;

/**
 * Seletor de data rotulado.
 *
 * `<input type="date">` NATIVO, sem biblioteca de data e sem mascara de
 * digitacao. Alem de ser o que a captura mostra, ele resolve sozinho o calendario,
 * a localizacao do formato exibido e a entrada por teclado.
 *
 * ============ NENHUMA CONVERSAO DE FUSO ACONTECE AQUI ============
 *
 * O valor entra e sai como `AAAA-MM-DD`, que e o que o input nativo produz e
 * consome E o formato exato do contrato (`birthDate`). O componente nao toca no
 * texto.
 *
 * Passar por `Date` seria o defeito: `new Date('2022-11-05')` e interpretado como
 * MEIA-NOITE UTC, e `toLocaleDateString`/`getDate` a oeste de Greenwich devolvem
 * o dia ANTERIOR. Um nascimento em 05/11 viraria 04/11 para todo o Brasil, e o
 * valor mudaria de novo a cada ida e volta pelo formulario. O `type="date"` do
 * HTML e definido em termos de data pura, sem fuso, exatamente para evitar isso.
 *
 * `min` e `max` sao conveniencia de interface — impedem a escolha no calendario,
 * mas nao a digitacao em todos os navegadores. A recusa que vale e a do servidor
 * (RN-19).
 */
export function DateField({
  id,
  label,
  error,
  required,
  className,
  ...rest
}: DateFieldProps): ReactElement {
  return (
    <FieldShell id={id} label={label} error={error} {...(required === true ? { required } : {})}>
      {({ atributosDeErro, temErro }) => (
        <input
          id={id}
          type="date"
          className={classesDoControle(temErro, className)}
          {...(required === true ? { required: true } : {})}
          {...atributosDeErro}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
