import type { ReactElement, ReactNode } from 'react';

type StatusVariant = 'success' | 'error' | 'info';

type StatusMessageProps = {
  readonly variant: StatusVariant;
  readonly children: ReactNode;
};

/**
 * Paleta por variante, deliberadamente IGUAL a do `AlertMessage`.
 *
 * As classes sao repetidas em vez de importadas porque `alert-message.tsx` nao
 * as exporta e nao pode ser alterado por esta task — o `AlertMessage` precisa
 * permanecer byte a byte como esta, com `role="alert"`. Repetir tres linhas de
 * classes e o custo de manter as duas pecas com a mesma cara; extrai-las
 * exigiria mexer no componente que a task manda nao tocar.
 *
 * DIVIDA REGISTRADA, e ela e maior do que este mapa: a className BASE aplicada
 * ao elemento la embaixo (`rounded-field border-[1.5px] px-4 py-3
 * text-[0.82rem] font-semibold`) e byte a byte igual a da L41 do
 * `alert-message.tsx`. Sao portanto DOIS pontos de duplicacao, nao um, e os dois
 * divergem em silencio se alguem alterar so um dos lados. A extracao — do mapa e
 * da className base — cabe a primeira task que abrir `alert-message.tsx` por um
 * motivo legitimo proprio.
 *
 * As medicoes de contraste que justificam cada combinacao estao registradas no
 * `alert-message.tsx` e valem sem alteracao aqui.
 */
const CLASSES_POR_VARIANTE: Readonly<Record<StatusVariant, string>> = {
  success: 'border-brand-purple bg-brand-purple-light text-ink',
  error: 'border-brand-orange bg-surface-input text-ink',
  info: 'border-hairline bg-surface-card text-ink-mid',
};

/**
 * Aviso do RESULTADO de uma operacao ja concluida.
 *
 * Distinto do `AlertMessage` e sem substitui-lo. A diferenca esta na urgencia,
 * nao na aparencia: `AlertMessage` usa `role="alert"`, que implica
 * `aria-live="assertive"` e INTERROMPE o leitor de tela — comportamento certo
 * para o erro de formulario que impede o usuario de prosseguir. Aqui o desfecho
 * ja aconteceu ("Especie criada com sucesso."), e interromper a leitura para
 * anunciar algo que nao exige acao e ruido. `role="status"` com
 * `aria-live="polite"` enfileira o anuncio para a proxima pausa (RNF-09).
 *
 * Como o papel implica regiao viva, o componente precisa ser MONTADO no momento
 * em que a mensagem surge — renderiza-lo vazio e preenche-lo depois faz alguns
 * leitores perderem o anuncio. Mesma observacao ja registrada no
 * `alert-message.tsx`.
 */
export function StatusMessage({ variant, children }: StatusMessageProps): ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      // Base identica a L41 do `alert-message.tsx`, de proposito e sob a
      // restricao de escopo registrada no comentario do mapa acima.
      className={`rounded-field border-[1.5px] px-4 py-3 text-[0.82rem] font-semibold ${CLASSES_POR_VARIANTE[variant]}`}
    >
      {children}
    </div>
  );
}
