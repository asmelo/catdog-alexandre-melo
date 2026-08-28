import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingIndicator } from '~/components/ui/feedback-states';
import { Pagination } from '~/components/ui/pagination';
import { StatusMessage } from '~/components/ui/status-message';
import type { Animal, Pagination as PaginationInfo } from '~/domains/animals/animal.types';
import { AnimalDeleteDialog } from '~/pages/admin/animais/animal-delete-dialog';
import type { StatusChangeOutcome } from '~/pages/admin/animais/animal-status-select';
import { AnimalsTable } from '~/pages/admin/animais/animals-table';
import { ROUTE_PATHS, adminAnimalEditPath } from '~/routes/route-paths';
import { ApiError } from '~/services/api/api-error';
import * as animalsApi from '~/services/api/animals-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Tamanho de pagina pedido ao servidor. E o padrao da RN-42, declarado aqui
 * porque a tela precisa do MESMO numero para decidir se exibe a paginacao — e
 * porque a resposta devolve o `pageSize` efetivo, o que permitiria divergir em
 * silencio se cada lado usasse o seu.
 */
const TAMANHO_DA_PAGINA = 20;

/** Aviso de resultado da tela, na forma que o `StatusMessage` consome. */
interface ResultadoDaOperacao {
  readonly variant: 'success' | 'error';
  readonly message: string;
}

type EstadoDaColecao =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | {
      readonly kind: 'loaded';
      readonly animals: ReadonlyArray<Animal>;
      readonly pagination: PaginationInfo;
    };

/**
 * Tela `/admin/animais` (HU-02, HU-07, HU-08).
 *
 * ======================= PAGINACAO E DO SERVIDOR =======================
 *
 * `page` vive no estado da tela e e repassado a `listAnimals`; trocar de pagina
 * RECARREGA do servidor. Fatiar em memoria quebraria as duas garantias da
 * listagem de uma vez: o total do rodape passaria a ser o da pagina, e a ordem
 * determinista da RN-41 — nome normalizado, depois `createdAt`, depois `id` —
 * deixaria de valer entre paginas.
 *
 * ================= POR QUE SO A LISTAGEM E RECARREGADA =================
 *
 * Toda escrita reflete na tela em menos de 1 segundo (RNF-12). Recarregar a
 * pagina inteira depois de uma alteracao de status ou de uma exclusao e o que faz
 * esse orcamento estourar — voltariam o bootstrap da sessao, o layout e as
 * fontes. Aqui so a consulta da listagem e refeita.
 */
export function AnimaisListPage(): ReactElement {
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [colecao, setColecao] = useState<EstadoDaColecao>({ kind: 'loading' });
  const [resultado, setResultado] = useState<ResultadoDaOperacao | null>(null);
  const [animalParaExcluir, setAnimalParaExcluir] = useState<Animal | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async (paginaDesejada: number): Promise<void> => {
    setColecao({ kind: 'loading' });

    try {
      const resposta = await animalsApi.listAnimals({
        page: paginaDesejada,
        pageSize: TAMANHO_DA_PAGINA,
      });

      setColecao({
        kind: 'loaded',
        animals: resposta.items,
        pagination: resposta.pagination,
      });
    } catch {
      /**
       * O corpo do erro, quando existe, descreve a requisicao e nao a tela. A
       * frase da feature e a correta aqui, e vem com a saida obrigatoria de nova
       * tentativa que o `ErrorState` exige.
       */
      setColecao({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void carregar(pagina);
  }, [carregar, pagina]);

  /**
   * Recarrega a pagina CORRENTE, recuando uma quando ela ficou vazia.
   *
   * Sem o recuo, excluir o ultimo item da pagina 3 deixaria o administrador
   * olhando uma tabela vazia com "Total: 40 animais" no rodape — um estado que
   * parece defeito e do qual so se sai clicando em "Anterior".
   *
   * O recuo e decidido sobre o total DEPOIS da exclusao, e por isso recebe a
   * contagem como parametro: ler `colecao` aqui traria o valor de antes.
   */
  function recarregarApos(totalRestante: number): void {
    const ultimaPagina = Math.max(1, Math.ceil(totalRestante / TAMANHO_DA_PAGINA));

    if (pagina > ultimaPagina) {
      // A mudanca de `pagina` dispara o efeito, que recarrega.
      setPagina(ultimaPagina);
      return;
    }

    void carregar(pagina);
  }

  function aoAlterarStatus(desfecho: StatusChangeOutcome): void {
    if (desfecho.kind === 'success') {
      setResultado({ variant: 'success', message: MESSAGES.ANIMALS.STATUS_UPDATE_SUCCESS });
      void carregar(pagina);
      return;
    }

    setResultado({ variant: 'error', message: desfecho.message });

    if (desfecho.reloadList) {
      // A linha na tela nao corresponde mais ao banco: recarregar e o que impede
      // a linha fantasma (CT-73, CT-67).
      void carregar(pagina);
    }
  }

  async function excluir(animal: Animal): Promise<void> {
    setExcluindo(true);

    try {
      await animalsApi.deleteAnimal(animal.id);

      setAnimalParaExcluir(null);
      setResultado({ variant: 'success', message: MESSAGES.ANIMALS.DELETE_SUCCESS });
      recarregarApos(totalCarregado() - 1);
    } catch (motivo: unknown) {
      setAnimalParaExcluir(null);

      if (motivo instanceof ApiError) {
        setResultado({ variant: 'error', message: motivo.message });

        if (motivo.code === 'ANIMAL_NOT_FOUND') {
          // Ja nao existe: a lista precisa deixar de exibi-lo (CT-78).
          recarregarApos(totalCarregado() - 1);
        }

        return;
      }

      setResultado({ variant: 'error', message: MESSAGES.FORM.UNEXPECTED_ERROR });
    } finally {
      setExcluindo(false);
    }
  }

  function totalCarregado(): number {
    return colecao.kind === 'loaded' ? colecao.pagination.total : 0;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/*
        O cabecalho fica FORA do bloco que troca de estado: o titulo e o botao de
        cadastro permanecem visiveis enquanto a lista carrega, falha ou esta vazia.
        Some-los durante o carregamento faria a tela piscar por inteiro e tiraria
        do administrador a unica acao disponivel justamente no estado vazio.
      */}
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[1.35rem] font-extrabold text-ink">{MESSAGES.ANIMALS.PAGE_TITLE}</h1>
        <button
          type="button"
          onClick={() => {
            navigate(ROUTE_PATHS.ADMIN_ANIMALS_NEW);
          }}
          className="rounded-field bg-brand-purple px-4 py-2.5 text-[0.8rem] font-extrabold text-white shadow-button transition hover:bg-brand-purple-hover focus-visible:shadow-focus-ring focus-visible:outline-none"
        >
          {MESSAGES.ANIMALS.CREATE_BUTTON}
        </button>
      </header>

      {/*
        O `StatusMessage` precisa ser MONTADO no instante em que a mensagem surge —
        renderiza-lo vazio e preenche-lo depois faz alguns leitores perderem o
        anuncio da regiao viva (RNF-19).
      */}
      {resultado !== null && (
        <StatusMessage variant={resultado.variant}>{resultado.message}</StatusMessage>
      )}

      {colecao.kind === 'loading' && (
        <LoadingIndicator label={MESSAGES.ANIMALS.LOADING_LABEL} />
      )}

      {colecao.kind === 'error' && (
        <ErrorState
          message={MESSAGES.ANIMALS.LOAD_ERROR}
          retryLabel={MESSAGES.ANIMALS.RETRY_BUTTON}
          onRetry={() => {
            void carregar(pagina);
          }}
        />
      )}

      {colecao.kind === 'loaded' && colecao.animals.length === 0 && (
        <EmptyState message={MESSAGES.ANIMALS.EMPTY_LIST} />
      )}

      {colecao.kind === 'loaded' && colecao.animals.length > 0 && (
        <>
          <AnimalsTable
            animals={colecao.animals}
            busy={excluindo}
            onStatusOutcome={aoAlterarStatus}
            onEdit={(animal) => {
              navigate(adminAnimalEditPath(animal.id));
            }}
            onDelete={setAnimalParaExcluir}
          />

          <Pagination
            page={colecao.pagination.page}
            pageSize={colecao.pagination.pageSize}
            total={colecao.pagination.total}
            disabled={excluindo}
            onPageChange={setPagina}
          />
        </>
      )}

      {/*
        O rodape sai do `pagination.total`, que e o total GERAL da colecao e nao o
        da pagina (RN-43, CA-06). Contar `animals.length` daria "Total: 20 animais"
        em toda pagina cheia de uma lista de 45.
      */}
      {colecao.kind === 'loaded' && (
        <p className="text-center text-[0.78rem] font-semibold text-ink-mid">
          {MESSAGES.ANIMALS.totalLabel(colecao.pagination.total)}
        </p>
      )}

      <AnimalDeleteDialog
        animal={animalParaExcluir}
        isSubmitting={excluindo}
        onConfirm={(animal) => {
          void excluir(animal);
        }}
        onCancel={() => {
          setAnimalParaExcluir(null);
        }}
      />
    </div>
  );
}
