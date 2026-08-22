import { useState } from 'react';
import type { InputHTMLAttributes, ReactElement } from 'react';

import { TextField } from '~/components/ui/text-field';

type PasswordFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Olho aberto — estado "senha oculta", convite a revelar. */
function IconeDeOlhoAberto(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Olho cortado — estado "senha visivel", convite a ocultar. */
function IconeDeOlhoCortado(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * Campo de senha com alternancia de visibilidade.
 *
 * Delega TODA a marcacao do campo ao `TextField` (rotulo `sr-only`, borda,
 * `aria-invalid`/`aria-describedby`, mensagem de erro) e injeta apenas o botao
 * pelo slot `trailing`. Duplicar aqui a logica de ARIA criaria dois lugares para
 * o mesmo requisito de acessibilidade divergirem.
 *
 * Os dois icones sao componentes alternados por renderizacao condicional. O
 * `reference.html` troca `innerHTML` do SVG — inaceitavel em React: quebra a
 * reconciliacao e e um vetor de injecao se o conteudo algum dia vier de dado.
 */
export function PasswordField({ id, label, error, ...rest }: PasswordFieldProps): ReactElement {
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  return (
    <TextField
      id={id}
      label={label}
      {...(error === undefined ? {} : { error })}
      type={senhaVisivel ? 'text' : 'password'}
      // Reserva a faixa direita do campo para o botao, senao o texto digitado
      // passa por baixo do icone.
      className="pr-[40px]"
      trailing={
        <button
          // Sem `type="button"` o padrao HTML e `submit`: dentro de um `<form>`,
          // clicar no olho enviaria o formulario. E o erro classico deste
          // componente e o que o criterio de aceite 5 verifica.
          type="button"
          onClick={() => {
            setSenhaVisivel((visivel) => !visivel);
          }}
          aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={senhaVisivel}
          // `h-11 w-11` = area de toque de 44x44px com icone de 18px: o alvo vem
          // do padding, nao do tamanho do icone.
          //
          // `right-[1px]`: o mockup posiciona o icone a 14px da borda, ou seja
          // com centro a 14 + 9 = 23px. Uma caixa de 44px centrada nesse ponto
          // comeca a 23 - 22 = 1px da borda. Mantem o icone onde a referencia o
          // coloca sem encolher o alvo de toque.
          className="absolute right-[1px] top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-field text-ink-mid transition-colors hover:text-brand-purple"
        >
          {senhaVisivel ? <IconeDeOlhoCortado /> : <IconeDeOlhoAberto />}
        </button>
      }
      {...rest}
    />
  );
}
