import type { ReactElement, SelectHTMLAttributes } from 'react';

import { FieldShell, classesDoControle } from '~/components/ui/field-shell';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

type SelectFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly options: ReadonlyArray<SelectOption>;
  readonly error?: string;
  /**
   * Texto da opcao vazia. E o que permite o estado "nada escolhido" e o que faz o
   * campo Cidade dizer "Escolha primeiro o estado" enquanto desabilitado (CT-34)
   * e "Carregando cidades..." enquanto a busca esta em voo.
   */
  readonly placeholder?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

/**
 * Campo de selecao rotulado.
 *
 * `<select>` NATIVO, e nao uma lista construida com `div` e `role="listbox"`. O
 * nativo ja entrega navegacao por teclado, busca por digitacao, teclas de
 * primeira letra, comportamento correto em toque e leitura por leitor de tela.
 * Reimplementar tudo isso sem biblioteca e como a RNF-16 se perde sem ninguem
 * perceber — o componente parece funcionar no mouse e falha no teclado.
 *
 * OS TRES ESTADOS QUE A HU-04 EXIGE saem da combinacao de `disabled` com um
 * `placeholder` variavel, sem prop extra de estado:
 *
 * 1. desabilitado sem estado escolhido — `disabled` com "Escolha primeiro o estado";
 * 2. carregando — `disabled` com "Carregando cidades...";
 * 3. povoado — habilitado, com as opcoes.
 *
 * Quem decide o texto e a tela, que e quem sabe por que o campo esta indisponivel.
 * Uma prop `isLoading` aqui obrigaria este componente a conhecer o vocabulario da
 * tela de animais.
 */
export function SelectField({
  id,
  label,
  options,
  error,
  placeholder,
  required,
  className,
  value,
  ...rest
}: SelectFieldProps): ReactElement {
  return (
    <FieldShell id={id} label={label} error={error} {...(required === true ? { required } : {})}>
      {({ atributosDeErro, temErro }) => (
        <select
          id={id}
          /*
           * `value ?? ''` para que o campo seja SEMPRE controlado. `undefined`
           * faria o React alternar entre controlado e nao controlado quando a
           * tela limpasse a escolha, e o aviso apareceria no console junto com um
           * campo que para de responder ao estado.
           */
          value={value ?? ''}
          className={classesDoControle(temErro, className)}
          {...(required === true ? { required: true } : {})}
          {...atributosDeErro}
          {...rest}
        >
          {placeholder !== undefined && (
            /*
             * `disabled` na opcao vazia: ela existe para EXIBIR o estado "nada
             * escolhido", nao para ser escolhida de volta. Sem isso o usuario
             * consegue desfazer uma escolha obrigatoria e o formulario passa a
             * enviar texto vazio.
             *
             * SEM `hidden`: em Safari a opcao escondida nao e exibida como valor
             * corrente e o campo aparece em branco em vez de mostrar o
             * placeholder.
             */
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
