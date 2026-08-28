import type { InputHTMLAttributes, ReactElement } from 'react';

import { FieldShell, classesDoControle } from '~/components/ui/field-shell';

type TextInputFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>;

/**
 * Campo de texto de UMA LINHA com rotulo VISIVEL.
 *
 * ===================== POR QUE NAO E O `TextField` =====================
 *
 * O `TextField` e do fluxo de autenticacao, e o rotulo dele e `sr-only` por
 * decisao de layout do `reference.html` — o comentario dele registra isso. Ele
 * tambem nao tem marcacao de obrigatoriedade, porque nenhum campo daquele fluxo
 * precisava de asterisco.
 *
 * O formulario de animal precisa das duas coisas: rotulo visivel (a captura
 * mostra "Nome *" acima do campo) e asterisco acompanhado de texto acessivel
 * (CA-09). Acrescentar as duas ao `TextField` mudaria a anatomia de um componente
 * usado por quatro telas de autenticacao ja aprovadas.
 *
 * Este e o membro que FALTAVA da familia do `FieldShell`: `SelectField`,
 * `TextareaField` e `DateField` sao os outros tres. Todos compartilham a mesma
 * anatomia — rotulo associado, asterisco com texto acessivel, `aria-invalid` e
 * `aria-describedby` — e a mesma classe de controle, para que tenham a mesma
 * altura, o mesmo raio e o mesmo anel de foco.
 */
export function TextInputField({
  id,
  label,
  error,
  required,
  className,
  ...rest
}: TextInputFieldProps): ReactElement {
  return (
    <FieldShell id={id} label={label} error={error} {...(required === true ? { required } : {})}>
      {({ atributosDeErro, temErro }) => (
        <input
          id={id}
          type="text"
          className={classesDoControle(temErro, className)}
          {...(required === true ? { required: true } : {})}
          {...atributosDeErro}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
