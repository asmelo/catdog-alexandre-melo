import { useCallback, useMemo, useRef, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AnimalGrid } from '~/components/catalog/animal-grid';
import { CardSkeletonGrid } from '~/components/catalog/card-skeleton';
import { ShowcaseFilterBar } from '~/components/catalog/showcase-filter-bar';
import { EmptyState } from '~/components/ui/empty-state';
import { Pagination } from '~/components/ui/pagination';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  parseShowcaseFilters,
  toApiFilters,
  toSearchParams,
  type ShowcaseFilters,
} from '~/pages/showcase/showcase-filters';
import { useFilterOptions } from '~/pages/showcase/use-filter-options';
import { usePublicAnimals } from '~/pages/showcase/use-public-animals';
import { MESSAGES } from '~/utils/messages';

const CLASSES_DO_BOTAO_SECUNDARIO =
  'rounded-field border-[1.5px] border-brand-purple px-4 py-2 text-[0.82rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none';

/**
 * A VITRINE PUBLICA (`/animais`).
 *
 * ============ NADA NESTA PAGINA LE `useAuth()` ============
 *
 * A sessao altera APENAS o cabecalho, que e do layout (RN-03, RN-06). Um
 * `if (user)` aqui seria a porta de entrada para a divergencia que a CA-03
 * proibe: visitante, cliente e admin veem exatamente a mesma lista, os mesmos
 * filtros e os mesmos campos em cada cartao.
 *
 * ============ EXCLUSIVAMENTE DE LEITURA ============
 *
 * Nenhuma interacao desta tela dispara `POST`, `PATCH` ou `DELETE` (RN-08,
 * CA-48). Nao ha acao no cartao, e a paginacao e a barra so alteram o endereco.
 */
export function ShowcasePage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const gradeRef = useRef<HTMLDivElement>(null);

  /**
   * O estado da tela VIVE NO ENDERECO, e nao em memoria (RN-46): e o que faz o
   * link ser compartilhavel, o "voltar" do navegador restaurar os filtros e a
   * recarga nao perder nada.
   *
   * `useMemo` sobre a cadeia do endereco: `searchParams` muda de identidade a
   * cada render, e sem isso o objeto de filtros seria novo toda vez.
   */
  const filtros = useMemo(
    () => parseShowcaseFilters(searchParams),
    // A cadeia, e não o objeto: é o valor que de fato muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()],
  );

  const filtrosDaApi = useMemo(() => toApiFilters(filtros), [filtros]);

  const { state, retry } = usePublicAnimals(filtrosDaApi);
  const opcoes = useFilterOptions();

  const temFiltros = hasActiveFilters(filtros);

  /**
   * `replace` para FILTRO e `push` para PAGINA, e a diferenca e o botao de voltar
   * do navegador (CT-83, CT-84): cada tecla digitada na busca criaria uma entrada
   * no historico, e voltar exigiria dez cliques para desfazer uma palavra. Trocar
   * de pagina, ao contrario, e um passo que o visitante espera poder desfazer.
   */
  const aplicarFiltros = useCallback(
    (novos: ShowcaseFilters): void => {
      setSearchParams(toSearchParams(novos), { replace: true });
    },
    [setSearchParams],
  );

  function irParaPagina(pagina: number): void {
    setSearchParams(toSearchParams({ ...filtros, pagina }));

    /**
     * Volta ao TOPO DA GRADE, e nao ao topo do documento (RN-21, CT-80): assim o
     * visitante comeca a pagina nova pelo primeiro cartao com a barra de filtros
     * ainda a vista, em vez de ter de rolar de volta ate ela.
     *
     * `smooth` so quando o visitante nao pediu movimento reduzido. `scrollIntoView`
     * nao existe no jsdom, daí a checagem.
     */
    const grade = gradeRef.current;

    if (grade !== null && typeof grade.scrollIntoView === 'function') {
      const movimentoReduzido =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      grade.scrollIntoView({ behavior: movimentoReduzido ? 'auto' : 'smooth', block: 'start' });
    }
  }

  const total = state.tipo === 'pronto' ? state.pagination.total : 0;

  /**
   * O texto da regiao viva. UMA regiao so — duas competem e o leitor de tela
   * perde uma (RNF-26, CA-53, CT-124).
   */
  function anuncio(): string {
    if (state.tipo === 'carregando') {
      return MESSAGES.SHOWCASE.LOADING_LABEL;
    }

    if (state.tipo === 'erro') {
      return state.mensagem;
    }

    if (state.items.length === 0) {
      return temFiltros ? MESSAGES.SHOWCASE.EMPTY_FILTERED : MESSAGES.SHOWCASE.EMPTY_CATALOG;
    }

    return MESSAGES.SHOWCASE.resultsSummary(total);
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[1.35rem] font-extrabold text-ink">
        {MESSAGES.SHOWCASE.PAGE_TITLE}
      </h1>

      <ShowcaseFilterBar
        filters={filtros}
        onChange={aplicarFiltros}
        speciesOptions={opcoes.species}
        cityOptions={opcoes.cities}
        speciesError={opcoes.speciesError}
        cityError={opcoes.citiesError}
        hasActiveFilters={temFiltros}
        onClear={() => {
          aplicarFiltros(EMPTY_FILTERS);
        }}
      />

      {/*
        O resumo aparece SO com filtro aplicado, como na captura (CT-97, CT-44):
        sem filtro, "13 animais encontrados" acima do catalogo inteiro nao informa
        nada — e o total ja e o que a grade mostra.
      */}
      {temFiltros && state.tipo === 'pronto' && (
        <p className="text-[0.82rem] font-semibold text-ink-mid">
          {MESSAGES.SHOWCASE.resultsSummary(total)}
        </p>
      )}

      {/*
        REGIAO VIVA. `polite` e nao `assertive`: a mudanca de resultado nao exige
        acao imediata e nao deve interromper o que o leitor estiver falando.
        `aria-atomic` para que a frase inteira seja anunciada, e nao so a parte
        que mudou.
      */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {anuncio()}
      </p>

      <div ref={gradeRef}>
        {/*
          A ORDEM DESTA DECISAO E A REGRA, e nao detalhe de implementacao:

          1. carregando — o esqueleto ocupa o lugar da grade e NENHUMA das duas
             mensagens de vazio aparece (uma lista ainda nao carregada nao esta
             vazia);
          2. erro — a falha com nova tentativa, e tambem NENHUMA mensagem de
             vazio;
          3. com itens — a grade;
          4. vazio COM filtros — a mensagem que oferece acao util;
          5. vazio SEM filtros — o catalogo vazio.

          O ramo 4 vem ANTES do 5 de proposito: com o catalogo vazio E filtros
          aplicados, vale a mensagem de filtros, que e a unica que da ao visitante
          algo a fazer (CA-37, CT-93).
        */}
        {state.tipo === 'carregando' && <CardSkeletonGrid />}

        {state.tipo === 'erro' && (
          <EmptyState
            message={state.mensagem}
            action={
              <button type="button" onClick={retry} className={CLASSES_DO_BOTAO_SECUNDARIO}>
                {MESSAGES.ANIMALS.RETRY_BUTTON}
              </button>
            }
          />
        )}

        {state.tipo === 'pronto' && state.items.length > 0 && (
          <AnimalGrid animals={state.items} />
        )}

        {state.tipo === 'pronto' && state.items.length === 0 && temFiltros && (
          <EmptyState
            message={MESSAGES.SHOWCASE.EMPTY_FILTERED}
            action={
              <button
                type="button"
                onClick={() => {
                  aplicarFiltros(EMPTY_FILTERS);
                }}
                className={CLASSES_DO_BOTAO_SECUNDARIO}
              >
                {MESSAGES.SHOWCASE.CLEAR_FILTERS}
              </button>
            }
          />
        )}

        {/* Catálogo vazio: SEM ação — não há o que limpar nem para onde ir. */}
        {state.tipo === 'pronto' && state.items.length === 0 && !temFiltros && (
          <EmptyState message={MESSAGES.SHOWCASE.EMPTY_CATALOG} />
        )}
      </div>

      {/*
        `Pagination` devolve `null` quando `total <= pageSize` (RN-19, CA-14,
        CT-72): com um único animal — o caso da captura — nenhum controle aparece
        no DOM, e não apenas escondido.

        `pageSize` NAO e exposto ao visitante: o padrao de 12 vem do servidor.
      */}
      {state.tipo === 'pronto' && (
        <Pagination
          page={state.pagination.page}
          pageSize={state.pagination.pageSize}
          total={state.pagination.total}
          onPageChange={irParaPagina}
        />
      )}
    </div>
  );
}
