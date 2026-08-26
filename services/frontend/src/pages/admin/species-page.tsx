import { useState, type ReactElement } from 'react';

import { DataList } from '~/components/ui/data-list';
import { EmptyState, ErrorState, LoadingIndicator } from '~/components/ui/feedback-states';
import { StatusMessage } from '~/components/ui/status-message';
import { SpeciesCreateForm } from '~/pages/admin/species/species-create-form';
import { SpeciesRow } from '~/pages/admin/species/species-row';
import { useSpeciesCollection } from '~/pages/admin/species/use-species-collection';
import { MESSAGES } from '~/utils/messages';

/**
 * Aviso de resultado da tela. Forma ESTRUTURALMENTE identica ao parametro de
 * `onResult` do `SpeciesCreateForm`, o que permite entregar o proprio
 * `setResultado` como callback sem adaptador — e sem que o formulario precise
 * importar nada desta pagina, o que fecharia um ciclo de imports.
 */
type ResultadoDaOperacao = {
  readonly variant: 'success' | 'error';
  readonly message: string;
};

/**
 * Largura do conteudo medida na captura de tela que a spec declara fonte da
 * verdade do layout: com a barra lateral de `w-56` (224px) ocupando 146px da
 * imagem, a escala e 0,652 — e o bloco de conteudo, de 393px na imagem, sai em
 * torno de 600px, centrado no `<main>`.
 *
 * A tela ocupa o `<main>` INTEIRO sem esta trava, e uma linha de lista com um
 * unico nome a esquerda e dois icones a mais de mil pixels de distancia e o
 * defeito que a captura evita.
 */
const CLASSES_DO_CONTEUDO = 'mx-auto flex w-full max-w-[600px] flex-col gap-4';

/**
 * Tela de especies (`/admin/especies`), renderizada dentro do `AdminLayout` —
 * HU-02 (criar) e HU-03 (listar), com os tres estados de carga.
 *
 * A EDICAO EM LINHA E A EXCLUSAO NAO ESTAO AQUI: sao da TASK-FRONTEND-010. Os
 * dois icones de acao ja aparecem em cada linha (CA-03) e ainda nao recebem
 * handler.
 *
 * `<h1>` e nao `<h2>`: o `AdminLayout` fornece os landmarks (`header`, `nav`,
 * `main`) e nenhum cabecalho, portanto o primeiro nivel da pagina pertence a ela.
 * O texto "Espécies" e contrato de interface (CA-02) e ja vinha da casca.
 *
 * O FUNDO DO `<main>` NAO FOI ALTERADO, e a omissao e decisao registrada: a
 * captura mostra um cinza quase branco (por volta de `#fafafc`) enquanto o
 * layout usa `surface-canvas` (`#dde0ea`). Corrigir isso exigiria mexer em
 * `admin-layout.tsx` — que esta explicitamente fora do escopo desta task — e o
 * token e compartilhado com o `ClientLayout`, entao trocar o VALOR em
 * `tailwind.config.js` repintaria tambem a area do cliente. Nenhum dos dois
 * arquivos consta da tabela *Files* da task; a divergencia fica reportada.
 */
export function SpeciesPage(): ReactElement {
  const { species, status, recarregar, adicionar } = useSpeciesCollection();

  /**
   * O aviso mora na PAGINA e nao no formulario porque a TASK-FRONTEND-010 vai
   * alimenta-lo tambem a partir da linha (renomear e excluir): tres origens, um
   * unico ponto de exibicao. Guardar o aviso em cada origem empilharia varios
   * `StatusMessage` na tela.
   */
  const [resultado, setResultado] = useState<ResultadoDaOperacao | null>(null);

  /**
   * A regiao da lista alterna entre EXATAMENTE tres estados, e a ordem dos
   * degraus importa: `'erro'` vence a lista vazia, senao uma falha de carga
   * exibiria "Nenhuma espécie cadastrada ainda." — a tela afirmaria que o
   * cadastro esta vazio sem ter conseguido consulta-lo.
   *
   * Funcao com `return` por degrau em vez de ternarios encadeados: quatro ramos
   * aninhados dentro do JSX nao se leem.
   */
  function regiaoDaLista(): ReactElement {
    if (status === 'carregando') {
      return <LoadingIndicator label={MESSAGES.SPECIES.LOADING_LABEL} />;
    }

    if (status === 'erro') {
      return (
        <ErrorState
          message={MESSAGES.SPECIES.LOAD_ERROR}
          onRetry={recarregar}
          retryLabel={MESSAGES.SPECIES.RETRY_BUTTON}
        />
      );
    }

    if (species.length === 0) {
      return <EmptyState message={MESSAGES.SPECIES.EMPTY_LIST} />;
    }

    return (
      <DataList
        items={species}
        getKey={(especie) => especie.id}
        ariaLabel={MESSAGES.SPECIES.LIST_LABEL}
        renderRow={(especie) => <SpeciesRow species={especie} />}
      />
    );
  }

  return (
    <div className={CLASSES_DO_CONTEUDO}>
      <h1 className="text-2xl font-extrabold text-ink">{MESSAGES.SPECIES.PAGE_TITLE}</h1>

      {/*
        A LINHA DE CRIACAO FICA FORA da alternancia de estados e permanece
        visivel nos tres (HU-03 cenarios 3 e 4): quem abre a tela com o cadastro
        vazio, ou enquanto a lista carrega, precisa poder cadastrar a primeira
        especie sem esperar.
      */}
      <SpeciesCreateForm onCreated={adicionar} onResult={setResultado} />

      {/*
        Montado SOMENTE quando ha mensagem. `StatusMessage` e regiao viva
        (`role="status"`): renderiza-lo vazio e preenche-lo depois faz alguns
        leitores de tela perderem o anuncio, e e por isso que o formulario limpa
        o aviso no inicio de cada operacao — a desmontagem e o que devolve o
        anuncio na proxima (RNF-09).
      */}
      {resultado !== null && (
        <StatusMessage variant={resultado.variant}>{resultado.message}</StatusMessage>
      )}

      {regiaoDaLista()}
    </div>
  );
}
