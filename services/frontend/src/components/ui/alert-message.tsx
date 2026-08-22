import type { ReactElement, ReactNode } from 'react';

type AlertVariant = 'success' | 'error' | 'info';

type AlertMessageProps = {
  readonly variant: AlertVariant;
  readonly children: ReactNode;
};

/**
 * Paleta por variante.
 *
 * DIVERGENCIA DELIBERADA DO PLANO na variante `error`, que prescrevia texto em
 * `brand.orange` sobre `brand.purple-light`. Medido: 3.13:1 — reprova o WCAG AA
 * (4.5:1). E o `brand.orange-dark` sobre o mesmo fundo tambem reprova (4.08:1),
 * ou seja, nao existe laranja do design system legivel sobre o lilas.
 *
 * A solucao mantem o laranja como SINAL e nao como texto: a borda e laranja
 * (3.49:1 sobre `surface.input`, acima do minimo de 3:1 para elemento
 * nao-textual) e o texto e `ink` (15.74:1). A cor tambem nao e o unico
 * indicador — o proprio conteudo da mensagem carrega o significado.
 */
const CLASSES_POR_VARIANTE: Readonly<Record<AlertVariant, string>> = {
  success: 'border-brand-purple bg-brand-purple-light text-ink',
  error: 'border-brand-orange bg-surface-input text-ink',
  info: 'border-hairline bg-surface-card text-ink-mid',
};

/**
 * Mensagem de resultado de um formulario inteiro (nao de um campo).
 *
 * `role="alert"` e o que faz o leitor de tela anunciar "E-mail ou senha
 * incorretos." no momento em que a mensagem aparece, sem o usuario precisar
 * procurar. Como o papel implica `aria-live="assertive"`, o componente deve ser
 * montado quando a mensagem surge — nao renderizado vazio e depois preenchido.
 */
export function AlertMessage({ variant, children }: AlertMessageProps): ReactElement {
  return (
    <div
      role="alert"
      className={`rounded-field border-[1.5px] px-4 py-3 text-[0.82rem] font-semibold ${CLASSES_POR_VARIANTE[variant]}`}
    >
      {children}
    </div>
  );
}
