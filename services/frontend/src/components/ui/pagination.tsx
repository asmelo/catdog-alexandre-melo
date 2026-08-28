import type { ReactElement } from 'react';

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  /** Enquanto verdadeiro, os controles ficam desabilitados. */
  readonly disabled?: boolean;
}

const CLASSES_DO_BOTAO =
  'rounded-field border-[1.5px] border-hairline bg-surface-card px-3 py-1.5 text-[0.78rem] font-extrabold text-ink transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Navegacao entre paginas da listagem.
 *
 * ============ RENDERIZA `null` QUANDO TUDO CABE NUMA PAGINA ============
 *
 * E por isso que a captura de tela, com um unico animal, nao exibe controle
 * nenhum e mesmo assim esta em conformidade (RN-42a, CT-27). O criterio e sobre a
 * AUSENCIA no DOM, e nao sobre estar escondido por CSS: controles desabilitados
 * continuariam na ordem de tabulacao e o usuario de teclado passaria por dois
 * botoes mortos em toda lista curta.
 *
 * O rotulo "Página N de M" nao e so decoracao — e o que da contexto ao
 * `aria-current` e o que um leitor de tela anuncia ao chegar na regiao.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
}: PaginationProps): ReactElement | null {
  if (total <= pageSize) {
    return null;
  }

  const ultimaPagina = Math.ceil(total / pageSize);
  const estaDesabilitado = disabled === true;

  return (
    <nav aria-label="Paginação da lista de animais" className="flex items-center justify-center gap-3">
      <button
        type="button"
        className={CLASSES_DO_BOTAO}
        disabled={estaDesabilitado || page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        Anterior
      </button>

      {/*
        `aria-current="page"` no elemento que representa a pagina corrente: e o que
        faz o leitor de tela anunciar "página atual" em vez de deixar o numero como
        texto solto no meio de dois botoes.
      */}
      <span aria-current="page" className="text-[0.78rem] font-semibold text-ink-mid">
        Página {page} de {ultimaPagina}
      </span>

      <button
        type="button"
        className={CLASSES_DO_BOTAO}
        disabled={estaDesabilitado || page >= ultimaPagina}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Próxima
      </button>
    </nav>
  );
}
