import type { ReactElement, ReactNode } from 'react';

interface EmptyStateProps {
  readonly message: string;
  /**
   * A saida, quando existe uma. AUSENTE de proposito no catalogo vazio: nao ha o
   * que limpar nem para onde ir, e um botao inutil ali seria pior que nenhum.
   */
  readonly action?: ReactNode;
}

/**
 * Vazio, nos DOIS sentidos que a vitrine tem.
 *
 * UM componente e nao dois: a diferenca entre "catalogo vazio" e "nenhum
 * resultado com os filtros" e a MENSAGEM e a presenca da acao — e quem sabe qual
 * dos dois e o caso e a pagina, que conhece os filtros aplicados. Um componente
 * que decidisse sozinho precisaria conhece-los.
 *
 * NAO E o `EmptyState` de `feedback-states.tsx`, que serve as listas
 * administrativas e nao aceita acao. Aquele nao pode mudar sem tocar duas telas
 * ja aprovadas.
 */
export function EmptyState({ message, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card bg-surface-card px-4 py-12 text-center shadow-card">
      <p className="text-[0.9rem] font-semibold text-ink-mid">{message}</p>
      {action}
    </div>
  );
}
