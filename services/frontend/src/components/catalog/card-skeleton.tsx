import type { ReactElement } from 'react';

interface CardSkeletonGridProps {
  /** Quantos esqueletos exibir. O padrão é o tamanho de página do contrato. */
  readonly count?: number;
}

/**
 * Bloco cinza com a MESMA geometria do cartao real.
 *
 * A geometria e o ponto: sem ela o layout salta quando os dados chegam, e o
 * visitante que ja tinha comecado a ler perde o lugar.
 *
 * `motion-safe:animate-pulse` e nao `animate-pulse`: a variante do Tailwind so
 * aplica a animacao quando o visitante NAO pediu movimento reduzido no sistema.
 * Pulsacao continua e um gatilho conhecido para quem tem sensibilidade vestibular.
 */
function CardSkeleton(): ReactElement {
  return (
    <div className="overflow-hidden rounded-card bg-surface-card shadow-card">
      <div className="h-44 w-full motion-safe:animate-pulse bg-surface-input" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="h-4 w-2/3 rounded-field bg-surface-input motion-safe:animate-pulse" />
        <div className="h-3 w-1/2 rounded-field bg-surface-input motion-safe:animate-pulse" />
        <div className="h-3 w-full rounded-field bg-surface-input motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

const TAMANHO_DA_PAGINA = 12;

/**
 * A grade de esqueletos, na MESMA grade dos cartoes.
 *
 * `aria-hidden="true"` no conjunto inteiro: o anuncio do carregamento e
 * responsabilidade da regiao viva da pagina (TASK-FRONTEND-010), e um esqueleto
 * anunciado duplicaria a fala — o leitor diria "carregando" e depois leria doze
 * blocos vazios.
 */
export function CardSkeletonGrid({ count = TAMANHO_DA_PAGINA }: CardSkeletonGridProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, indice) => (
        <CardSkeleton key={indice} />
      ))}
    </div>
  );
}
