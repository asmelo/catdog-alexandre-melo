import { useRef, useState, type ReactElement } from 'react';

import { AlertMessage } from '~/components/ui/alert-message';
import { DataList } from '~/components/ui/data-list';
import { EmptyState, ErrorState, LoadingIndicator } from '~/components/ui/feedback-states';
import { StatusMessage } from '~/components/ui/status-message';
import { DeleteSpeciesDialog } from '~/pages/admin/species/delete-species-dialog';
import { SpeciesCreateForm } from '~/pages/admin/species/species-create-form';
import { SpeciesRow } from '~/pages/admin/species/species-row';
import { useSpeciesCollection } from '~/pages/admin/species/use-species-collection';
import { ApiError, fieldErrorsOf } from '~/services/api/api-error';
import * as speciesApi from '~/services/api/species-api';
import type { Species } from '~/services/api/species-api';
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
 * Mensagem de uma falha de OPERACAO INTEIRA, escolhida SEMPRE pelo `code`
 * (CA-22) — a que aparece no aviso da pagina, e nao sob o campo da linha.
 *
 * `SPECIES_IN_USE` (exclusivo da exclusao) e `SPECIES_NOT_FOUND` (comum aos dois
 * fluxos) exibem a frase que o backend enviou — este arquivo nao possui copia de
 * nenhuma das duas, e por isso nao ha o que divergir do servidor. Qualquer outro
 * desfecho cai no texto generico, incluindo a falha que nem virou `ApiError`.
 */
function mensagemDoErroDeOperacao(erro: unknown): string {
  if (
    erro instanceof ApiError &&
    (erro.code === 'SPECIES_IN_USE' || erro.code === 'SPECIES_NOT_FOUND')
  ) {
    return erro.message;
  }

  return MESSAGES.FORM.UNEXPECTED_ERROR;
}

/** A especie sumiu por acao de outra pessoa (RN-14): os dois fluxos recarregam a lista. */
function ehEspecieInexistente(erro: unknown): boolean {
  return erro instanceof ApiError && erro.code === 'SPECIES_NOT_FOUND';
}

/**
 * Mensagem de uma falha de renomeacao que pertence AO CAMPO da linha, escolhida
 * SEMPRE pelo `code` (CA-22) — `null` quando o desfecho nao e de campo.
 *
 * Extraida do tratador para que a ESCOLHA da mensagem fique separada da escolha
 * do CANAL onde ela e exibida: os dois codigos abaixo continuam produzindo o
 * mesmo texto quer a linha que gravou ainda esteja em edicao, quer ja tenha sido
 * substituida por outra. Sem a separacao, o tratador precisaria repetir a
 * ramificacao inteira uma vez para cada canal.
 */
function mensagemDoErroSobOCampo(erro: unknown): string | null {
  if (erro instanceof ApiError && erro.code === 'VALIDATION_ERROR') {
    // O `PATCH` tambem pode reprovar o `id` (identificador fora do formato UUID),
    // e para esse caso nao existe campo na tela: sobra a `message` do envelope,
    // que ja vem pronta do servidor.
    return fieldErrorsOf(erro).name ?? erro.message;
  }

  if (erro instanceof ApiError && erro.code === 'SPECIES_NAME_ALREADY_EXISTS') {
    return erro.message;
  }

  return null;
}

/**
 * A SESSAO DE EDICAO — qual linha esta em edicao e QUAL abertura dela e esta.
 *
 * O `especieId` sozinho nao e identidade suficiente: sair da linha e voltar a ela
 * produz um rascunho NOVO com o mesmo `id`, e uma gravacao da abertura anterior
 * que so resolvesse depois passaria por um teste de identidade feito por `id` e
 * pousaria na sessao errada. O numero de `sequencia` distingue as duas.
 */
type SessaoDeEdicao = {
  readonly sequencia: number;
  readonly especieId: string;
};

/**
 * Tela de especies (`/admin/especies`), renderizada dentro do `AdminLayout` —
 * HU-02 (criar), HU-03 (listar), HU-04 (renomear), HU-05 e HU-06 (excluir).
 *
 * A PAGINA E QUEM CHAMA A API nas tres operacoes de escrita. A linha valida e
 * avisa; o dialogo pergunta. Concentrar as chamadas aqui e o que permite que
 * `species-row.tsx` e `delete-species-dialog.tsx` nao importem `species-api`.
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
  const { species, status, recarregar, adicionar, substituir, remover } = useSpeciesCollection();

  /**
   * O aviso mora na PAGINA e nao no formulario: tres origens (criar, renomear,
   * excluir), um unico ponto de exibicao. Guardar o aviso em cada origem
   * empilharia varios avisos na tela.
   */
  const [resultado, setResultado] = useState<ResultadoDaOperacao | null>(null);

  /**
   * APENAS UMA LINHA EM EDICAO POR VEZ (secao "Acao 2" da spec): um unico valor,
   * e nao um conjunto. Acionar o lapis de outra linha troca o valor, e a edicao
   * anterior e encerrada sem gravar — que e exatamente o HU-04 cenario 8. Nao ha
   * confirmacao para descartar a edicao anterior: o rascunho desmonta junto com o
   * formulario da linha.
   */
  const [edicao, setEdicao] = useState<SessaoDeEdicao | null>(null);

  /**
   * IDENTIDADE DA SESSAO DE EDICAO MAIS RECENTE — o mesmo remedio que
   * `listagemMaisRecente` aplica as listagens em `use-species-collection.ts`,
   * aqui aplicado as renomeacoes. Cada entrada, saida ou troca de linha em edicao
   * toma o proximo numero; `salvarRenomeacao` guarda o numero NA PARTIDA e, na
   * resolucao, so mexe no estado da sessao se ele ainda for o corrente.
   *
   * `useRef` e nao `useState`: o valor precisa ser lido DEPOIS do `await`, e uma
   * variavel de estado ficaria congelada no valor do render que criou o tratador
   * — exatamente a leitura obsoleta que esta identidade existe para eliminar.
   * `edicao` e o espelho em estado, para a renderizacao, e os dois mudam sempre
   * juntos, num unico lugar (`trocarEdicao`).
   *
   * Numero de sequencia e nao `AbortController`, pela mesma razao ja registrada
   * naquele arquivo: cancelar de verdade exigiria um `signal` atravessando
   * `speciesApi.renameSpecies` ate o `fetch` do `http-client.ts`, e nenhum dos
   * dois esta no escopo desta task. O descarte continuaria sendo feito aqui, na
   * resolucao.
   */
  const edicaoMaisRecente = useRef(0);

  /**
   * SEQUENCIA DE ESCRITA — quantas renomeacoes ja partiram desta tela.
   *
   * Contador SEPARADO de `edicaoMaisRecente`, e a separacao e o conserto: aquele
   * numera SESSOES de edicao, e duas gravacoes da MESMA especie podem partir da
   * mesma sessao (dois "Salvar" seguidos) ou de sessoes diferentes (sair da linha
   * e voltar). Em nenhum dos dois casos o numero da sessao ordena as gravacoes
   * ENTRE SI — e sem ordem entre elas a resolucao que chega por ultimo vence a
   * tela, mesmo sendo a mais VELHA.
   */
  const gravacaoMaisRecente = useRef(0);

  /**
   * Numero da ultima escrita cujo retrato foi APLICADO a lista, POR ESPECIE.
   *
   * Marcador por especie, e nao global: entre especies distintas nao ha nada a
   * ordenar, e um marcador unico descartaria a resolucao de "Gato" so porque
   * "Cachorro" gravou depois — jogando fora gravacao ja duravel no servidor.
   *
   * So avanca no SUCESSO, quando o retrato entra de fato na lista. Uma gravacao
   * que FALHOU nao mudou nada no servidor e por isso nao pode barrar o retrato de
   * uma escrita anterior que deu certo: com `PATCH`2 recusado e `PATCH`1 aceito
   * chegando depois, o nome corrente no servidor e o de `PATCH`1, e e ele que a
   * tela tem de mostrar.
   *
   * O mapa guarda um numero por especie renomeada nesta visita a tela — cresce
   * com a acao do usuario, nao com o tempo, e morre com a pagina.
   */
  const escritaAplicadaPorEspecie = useRef(new Map<string, number>());

  /**
   * Sequencia da sessao de edicao cuja gravacao esta EM VOO (`null` = nenhuma).
   *
   * Numero da sessao, e nao um booleano de "operacao em andamento" compartilhado
   * com a exclusao. Com a bandeira unica, o `PATCH` de uma linha desabilitava
   * salvar e cancelar da linha que entrou em edicao DEPOIS dele, e desabilitava
   * tambem os dois botoes do dialogo de exclusao — e como o `ConfirmDialog`
   * recusa o `Escape` enquanto `isSubmitting`, o dialogo abria sem nenhuma saida
   * (armadilha de teclado, SC 2.1.2 nivel A, contra o CA-21/RNF-06). Sem
   * `timeout` no `http-client.ts`, uma requisicao pendurada tornaria a armadilha
   * ilimitada.
   */
  const [sequenciaEmGravacao, setSequenciaEmGravacao] = useState<number | null>(null);

  /** A especie ESCOLHIDA para exclusao. Escolher nao exclui — a chamada so parte da confirmacao. */
  const [especieParaExcluir, setEspecieParaExcluir] = useState<Species | null>(null);

  /**
   * Espelho em `useRef` de "ha dialogo de exclusao aberto", pela MESMA razao de
   * `edicaoMaisRecente`: quem precisa da resposta e a resolucao de um `PATCH`, e
   * ela roda DEPOIS do `await`, sobre o fecho do render que a disparou. Nesse
   * fecho `especieParaExcluir` ainda vale o que valia na PARTIDA — `null`
   * justamente no caso que interessa, o do dialogo aberto com a gravacao ja em
   * voo. Ler o estado ali nao enxergaria dialogo nenhum.
   */
  const haDialogoDeExclusao = useRef(false);

  /**
   * Bandeira EXCLUSIVA da exclusao em curso — e aqui um booleano BASTA.
   *
   * A exclusao nao precisa de identidade porque o `DELETE` so parte da
   * confirmacao de um dialogo MODAL, que permanece montado ate a resolucao: nao
   * ha como haver dois em voo, nem como o alvo trocar no meio do caminho. As duas
   * coisas que obrigam a renomeacao a carregar sequencia simplesmente nao
   * existem deste lado.
   */
  const [exclusaoEmAndamento, setExclusaoEmAndamento] = useState(false);

  /** Erro da API da renomeacao em curso, exibido SOB O CAMPO da linha em edicao. */
  const [erroDaLinha, setErroDaLinha] = useState<string | null>(null);

  /**
   * DESTINO DO FOCO quando o elemento que originou a acao deixa de existir.
   *
   * O `ConfirmDialog` devolve o foco a quem o abriu chamando `focus()` no
   * elemento guardado — e na exclusao BEM-SUCEDIDA esse elemento e a lixeira da
   * linha que acabou de sumir da lista. `focus()` sobre um no ja destacado do DOM
   * e um no-op silencioso, entao o foco fica no <body>: exatamente o defeito que
   * aquela devolucao existe para evitar. E o primeiro fluxo do projeto em que
   * quem abre o dialogo desaparece ao confirmar.
   *
   * A correcao e do lado de QUEM CONSOME — `confirm-dialog.tsx` pertence a
   * TASK-FRONTEND-006 e nao consta da tabela *Files* desta task —, e o titulo da
   * pagina e o destino porque e o unico elemento que sobrevive a todos os
   * desfechos: a lista pode ficar vazia (e virar `EmptyState`), pode falhar (e
   * virar `ErrorState`) e a linha vizinha pode nao existir. Cabecalho e alvo de
   * foco conhecido — anuncia "Espécies, cabeçalho de nível 1" e reancora quem
   * navega por teclado no topo do conteudo.
   */
  const refDoTitulo = useRef<HTMLHeadingElement | null>(null);

  /**
   * Chamado ANTES da renderizacao que remove a linha, e a ordem e proposital: o
   * foco muda para um elemento que ja esta no DOM e nao vai sair dele, entao a
   * remocao seguinte nao encontra mais o foco em nada que apague, e a limpeza do
   * `ConfirmDialog` — que roda depois, sobre a lixeira ja destacada — e um no-op
   * que nao desfaz nada. Se o React chegasse a renderizar antes desta linha, o
   * resultado seria o mesmo por outro caminho: a limpeza no-op teria acontecido
   * primeiro e esta chamada seria a ultima a mexer no foco.
   */
  function devolverFocoAoTitulo(): void {
    refDoTitulo.current?.focus();
  }

  /**
   * PONTO UNICO por onde a sessao de edicao muda — entrar, sair ou trocar de
   * linha. Tomar o proximo numero aqui, e em nenhum outro lugar, e o que mantem
   * `edicaoMaisRecente` (lido depois do `await`) e `edicao` (lido na
   * renderizacao) sempre de acordo.
   *
   * SAIR da edicao tambem consome um numero: o contador passa a apontar para uma
   * sessao que nao existe e qualquer gravacao ainda em voo fica obsoleta — que e
   * o desfecho correto, porque a linha que a originou ja nao esta em edicao.
   */
  function trocarEdicao(especieId: string | null): void {
    edicaoMaisRecente.current += 1;

    setEdicao(especieId === null ? null : { sequencia: edicaoMaisRecente.current, especieId });

    // O erro pertencia a sessao ANTERIOR. Sem esta limpeza ele reapareceria sob
    // o campo da nova linha, acusando de conflito um nome que nao foi enviado.
    setErroDaLinha(null);
  }

  /**
   * PONTO UNICO por onde a escolha para exclusao muda — abrir, cancelar ou fechar
   * o dialogo. Mesma disciplina de `trocarEdicao`: e o que mantem
   * `haDialogoDeExclusao` (lido depois do `await`) e `especieParaExcluir` (lido na
   * renderizacao) sempre de acordo, sem que nenhum ponto de uso precise lembrar
   * dos dois.
   */
  function escolherParaExcluir(especie: Species | null): void {
    haDialogoDeExclusao.current = especie !== null;
    setEspecieParaExcluir(especie);
  }

  /**
   * Registra o retrato desta escrita como o mais novo ja aplicado A ESPECIE e
   * responde se ele deve entrar na lista. `false` significa que uma escrita MAIS
   * NOVA da mesma especie ja pousou: exibir este retrato por cima mostraria um
   * nome que o servidor ja nao guarda.
   */
  function registrarRetratoSeForOMaisNovo(especieId: string, minhaGravacao: number): boolean {
    const jaAplicada = escritaAplicadaPorEspecie.current.get(especieId) ?? 0;

    if (minhaGravacao < jaAplicada) {
      return false;
    }

    escritaAplicadaPorEspecie.current.set(especieId, minhaGravacao);

    return true;
  }

  function iniciarEdicao(especie: Species): void {
    trocarEdicao(especie.id);
  }

  function cancelarEdicao(): void {
    trocarEdicao(null);
  }

  /**
   * Ramifica por `code`, NUNCA por `message` nem por `status` (CA-22).
   *
   * `edicaoAindaEMinha` escolhe o CANAL do erro, e essa escolha e o conserto da
   * corrida: enquanto a sessao que gravou continua aberta, o erro pousa SOB O
   * CAMPO dela; quando ela ja foi encerrada ou trocada por outra linha, nao
   * existe mais campo onde pousar — e insistir no `erroDaLinha` faria a frase
   * aparecer sob o campo de OUTRA especie, acusando de conflito um nome que nem
   * chegou a ser enviado. Sobra o aviso da pagina, que nao pertence a linha
   * nenhuma. Silenciar nao e alternativa: a renomeacao falhou de verdade, o nome
   * continua o antigo, e sem aviso o usuario acreditaria ter gravado (RNF-09).
   *
   * `VALIDATION_ERROR` e `SPECIES_NAME_ALREADY_EXISTS` -> texto escolhido por
   * `mensagemDoErroSobOCampo`; a linha PERMANECE em edicao e NENHUM registro
   * muda na lista — nada aqui toca a colecao (CT-18 / CT-19).
   *
   * `SPECIES_NOT_FOUND` -> sai do modo de edicao e recarrega. Insistir na edicao
   * de um registro que nao existe mais nao leva a lugar nenhum, e a mensagem
   * passa a ser da operacao inteira porque a linha onde ela caberia esta prestes
   * a desaparecer (CT-20 / HU-04 cenario 7 / CA-17).
   */
  function tratarFalhaDaRenomeacao(erro: unknown, edicaoAindaEMinha: boolean): void {
    const sobOCampo = mensagemDoErroSobOCampo(erro);

    if (sobOCampo !== null && edicaoAindaEMinha) {
      setErroDaLinha(sobOCampo);

      return;
    }

    if (sobOCampo !== null) {
      setResultado({ variant: 'error', message: sobOCampo });

      return;
    }

    if (ehEspecieInexistente(erro)) {
      if (edicaoAindaEMinha) {
        trocarEdicao(null);
      }

      setResultado({ variant: 'error', message: mensagemDoErroDeOperacao(erro) });

      /**
       * O FOCO E DEVOLVIDO ANTES de `recarregar`, e a chamada e obrigatoria aqui.
       *
       * `recarregar` poe `status` em `'carregando'` no MESMO lote de atualizacao:
       * a `DataList` inteira desmonta na mesma renderizacao e o campo de edicao
       * (ou o lapis que o sucederia) deixa de existir antes de receber foco
       * algum — o foco cairia no <body> e a proxima tabulacao recomecaria do topo
       * da pagina. Nao e preciso sinal de conclusao de `recarregar` para
       * consertar isso: o `<h1>` vive FORA de `regiaoDaLista()` e sobrevive tanto
       * ao estado de carga quanto ao recarregamento.
       *
       * MAS SO QUANDO NAO HA DIALOGO DE EXCLUSAO ABERTO. O `<h1>` esta FORA da
       * sobreposicao `aria-modal`, e o tratador de `Escape` do `ConfirmDialog`
       * vive NA sobreposicao: puxar o foco para o titulo enquanto o dialogo esta
       * montado tiraria o teclado de dentro do modal e o `Escape` deixaria de
       * fecha-lo — que e exatamente o defeito que a armadilha de foco existe para
       * impedir. Aqui nao ha o que resgatar: o dialogo fica montado (ele vive fora
       * de `regiaoDaLista()`), o botao que detem o foco sobrevive ao
       * recarregamento e a armadilha do proprio dialogo continua valendo.
       */
      if (!haDialogoDeExclusao.current) {
        devolverFocoAoTitulo();
      }

      recarregar();

      return;
    }

    setResultado({ variant: 'error', message: MESSAGES.FORM.UNEXPECTED_ERROR });
  }

  async function salvarRenomeacao(especie: Species, nome: string): Promise<void> {
    /**
     * A identidade e capturada NA PARTIDA, e nao lida depois do `await`: e ela
     * que separa "a resolucao da MINHA gravacao" de "a resolucao de uma gravacao
     * que o usuario ja deixou para tras".
     */
    const minhaEdicao = edicaoMaisRecente.current;

    /**
     * A identidade da ESCRITA, tambem tomada na partida e em contador PROPRIO: a
     * sessao diz de qual abertura da linha esta gravacao saiu, e so a escrita diz
     * qual das gravacoes da mesma especie e a mais nova.
     */
    gravacaoMaisRecente.current += 1;
    const minhaGravacao = gravacaoMaisRecente.current;

    setResultado(null);
    setErroDaLinha(null);
    setSequenciaEmGravacao(minhaEdicao);

    try {
      const atualizada = await speciesApi.renameSpecies(especie.id, nome);

      /**
       * Efeito de OPERACAO — sobrevive a MORTE DA SESSAO, e a regra vale ENTRE
       * ESPECIES DISTINTAS: o servidor GRAVOU, e o retrato exibido tem de
       * refletir o que ficou duravel la, inclusive quando o usuario ja passou
       * para outra linha. Descartar uma resolucao so por ser obsoleta jogaria
       * fora gravacao real de uma especie que ninguem mais vai atualizar.
       *
       * ENTRE DUAS GRAVACOES DA MESMA ESPECIE a regra SE INVERTE, e por isso ela
       * nao e universal: `PATCH`1 envia "Anta", `PATCH`2 envia "Zebra" e as
       * respostas chegam 2 e depois 1 — aplicar sempre deixaria a tela em "Anta"
       * com o servidor em "Zebra". A sequencia de SESSAO nao separa esse caso
       * (as duas gravacoes podem sair da mesma sessao), entao quem decide aqui e
       * a sequencia de ESCRITA, por especie: `registrarRetratoSeForOMaisNovo`
       * recusa o retrato de uma escrita mais VELHA que a ultima ja aplicada
       * AQUELA especie, e nao consulta nem move o marcador de nenhuma outra.
       *
       * Recusado o retrato, a lista fica com o que a escrita mais nova ja pos
       * la: a tela continua batendo com o servidor, que e o que a regra queria
       * garantir desde o inicio.
       *
       * Nada disto e otimista: `substituir` vem DEPOIS do `await`, reinsere na
       * posicao alfabetica correta (CA-04) e passa pelo `escrever` do hook, que
       * registra a escrita para reaplicacao sobre uma listagem em voo —
       * `setSpecies` direto reintroduziria a corrida.
       */
      if (registrarRetratoSeForOMaisNovo(especie.id, minhaGravacao)) {
        substituir(atualizada);
      }

      setResultado({ variant: 'success', message: MESSAGES.SPECIES.UPDATE_SUCCESS });

      // Efeito de SESSAO — so quando a sessao que gravou ainda e a corrente. Sem
      // esta guarda, um sucesso tardio expulsaria da edicao a linha que o usuario
      // abriu DEPOIS dele e descartaria o rascunho ja digitado nela.
      if (minhaEdicao === edicaoMaisRecente.current) {
        trocarEdicao(null);
      }
    } catch (erro) {
      tratarFalhaDaRenomeacao(erro, minhaEdicao === edicaoMaisRecente.current);
    } finally {
      /**
       * `finally` e nao uma linha no fim do `try`: e ele que devolve salvar e
       * cancelar a vida em QUALQUER desfecho. Preso em nao-nulo, o `isSubmitting`
       * deixaria a linha em edicao sem saida nenhuma — os dois botoes
       * desabilitados e o `Escape` recusado — ate a pagina ser recarregada.
       *
       * Atualizador FUNCIONAL e comparacao por sequencia porque este `finally`
       * pode ser o de uma gravacao ja obsoleta: limpar sem conferir soltaria os
       * botoes de uma OUTRA gravacao ainda em voo.
       */
      setSequenciaEmGravacao((atual) => (atual === minhaEdicao ? null : atual));
    }
  }

  /**
   * A chamada so acontece AQUI, na confirmacao (CA-13). A lixeira apenas escolhe.
   *
   * A REMOCAO DA LISTA E DEPOIS DO `204`, nunca otimista, e sao dois motivos
   * independentes: no desfecho `SPECIES_IN_USE` a especie PERMANECE cadastrada e
   * some-la da tela contradiria o CA-14 exatamente no caso que a feature existe
   * para proteger; e o `remover` registra a escrita para reaplica-la sobre a
   * proxima listagem, de modo que uma remocao que o servidor nao confirmou
   * continuaria sendo reaplicada — a especie reapareceria sozinha no primeiro
   * recarregamento.
   */
  async function confirmarExclusao(especie: Species): Promise<void> {
    setResultado(null);
    setExclusaoEmAndamento(true);

    try {
      await speciesApi.deleteSpecies(especie.id);

      remover(especie.id);
      escolherParaExcluir(null);
      setResultado({ variant: 'success', message: MESSAGES.SPECIES.DELETE_SUCCESS });
      devolverFocoAoTitulo();
    } catch (erro) {
      // O dialogo fecha em TODOS os desfechos de falha: a mensagem vive na
      // pagina, atras da sobreposicao. Mante-lo aberto esconderia do usuario a
      // unica explicacao do que aconteceu.
      escolherParaExcluir(null);
      setResultado({ variant: 'error', message: mensagemDoErroDeOperacao(erro) });

      if (ehEspecieInexistente(erro)) {
        // MESMO motivo do ramo homonimo da renomeacao, e este desfecho e tao
        // grave quanto: `recarregar` desmonta a `DataList` inteira no mesmo lote,
        // entao a lixeira a quem o `ConfirmDialog` devolveria o foco na limpeza
        // ja nao existe e a devolucao vira um no-op sobre no destacado — o foco
        // pararia no <body>. O `<h1>` vive fora de `regiaoDaLista()`.
        devolverFocoAoTitulo();
        recarregar();
      }
    } finally {
      setExclusaoEmAndamento(false);
    }
  }

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
        renderRow={(especie) => {
          const emEdicao = edicao !== null && edicao.especieId === especie.id;

          return (
            <SpeciesRow
              species={especie}
              isEditing={emEdicao}
              // Estreitada por identidade de SESSAO, e nao por um booleano de
              // tela: so a sessao cuja gravacao esta em voo tem salvar e cancelar
              // desabilitados. Uma linha que entrou em edicao com o `PATCH` de
              // outra ainda em voo permanece inteiramente utilizavel.
              isSubmitting={emEdicao && edicao?.sequencia === sequenciaEmGravacao}
              error={erroDaLinha ?? ''}
              onStartEdit={iniciarEdicao}
              onCancelEdit={cancelarEdicao}
              onSave={(especieDaLinha, nome) => {
                void salvarRenomeacao(especieDaLinha, nome);
              }}
              onDelete={escolherParaExcluir}
            />
          );
        }}
      />
    );
  }

  return (
    <div className={CLASSES_DO_CONTEUDO}>
      {/*
        `tabIndex={-1}` NAO poe o titulo na ordem de tabulacao — ele apenas o
        torna focavel por programa, para receber o foco quando a linha que o
        detinha e excluida. O anel `focus-visible` e o mesmo da base e so aparece
        quando a interacao anterior foi por teclado, que e justamente quando o
        destino do foco importa.
      */}
      <h1
        ref={refDoTitulo}
        tabIndex={-1}
        className="rounded-field text-2xl font-extrabold text-ink focus-visible:shadow-focus-ring focus-visible:outline-none"
      >
        {MESSAGES.SPECIES.PAGE_TITLE}
      </h1>

      {/*
        A LINHA DE CRIACAO FICA FORA da alternancia de estados e permanece
        visivel nos tres (HU-03 cenarios 3 e 4): quem abre a tela com o cadastro
        vazio, ou enquanto a lista carrega, precisa poder cadastrar a primeira
        especie sem esperar.
      */}
      <SpeciesCreateForm onCreated={adicionar} onResult={setResultado} />

      {/*
        Montado SOMENTE quando ha mensagem. As duas variantes sao regioes vivas:
        renderiza-las vazias e preenche-las depois faz alguns leitores de tela
        perderem o anuncio, e e por isso que toda operacao limpa o aviso antes de
        comecar — a desmontagem e o que devolve o anuncio na proxima (RNF-09).

        SUCESSO e ERRO usam componentes DIFERENTES, e a diferenca e de urgencia e
        nao de aparencia (as duas paletas sao identicas). O sucesso e desfecho
        consumado e vai no `StatusMessage` (`role="status"`, anuncio educado, na
        proxima pausa do leitor). O erro de operacao inteira — "não é possível
        excluir esta espécie...", "espécie não encontrada." — interrompe o
        trabalho e exige decisao, entao vai no `AlertMessage` (`role="alert"`),
        que anuncia na hora. E a instrucao da task, e ela tambem alcanca o erro
        inesperado que o formulario de criacao ja emitia por este mesmo canal.

        MUDANCA DE PAPEL ARIA EM CAMINHO PRE-EXISTENTE, registrada aqui a pedido
        da revisao: o erro do FLUXO DE CRIACAO (o `onResult({ variant: 'error' })`
        do `SpeciesCreateForm`) saia como `role="status"` / `aria-live="polite"`
        na TASK-FRONTEND-009 e passa a sair como `role="alert"`. O texto nao
        mudou e nenhum arquivo fora da tabela *Files* foi tocado — o desvio
        acontece neste ramo de renderizacao. A revisao aceitou a mudanca por ser
        semanticamente melhor (um erro que interrompe o trabalho nao e um aviso
        educado). A TASK-FRONTEND-011 precisa consultar `role="alert"`, e nao
        `role="status"`, ao cobrir aquele fluxo.
      */}
      {resultado !== null &&
        (resultado.variant === 'error' ? (
          <AlertMessage variant="error">{resultado.message}</AlertMessage>
        ) : (
          <StatusMessage variant={resultado.variant}>{resultado.message}</StatusMessage>
        ))}

      {regiaoDaLista()}

      {/*
        Fora da regiao da lista de proposito: o dialogo e sobreposicao de tela
        inteira e nao pertence a nenhuma linha. Ele sai do DOM junto com
        `especieParaExcluir`, e e essa desmontagem que devolve o foco a lixeira
        quando ela sobrevive a operacao (cancelamento, `SPECIES_IN_USE`).
      */}
      <DeleteSpeciesDialog
        species={especieParaExcluir}
        // A bandeira da EXCLUSAO, e nao a da tela: com a bandeira compartilhada,
        // um `PATCH` de outra linha ainda em voo abria este dialogo com os dois
        // botoes desabilitados e o `Escape` recusado — sem nenhuma saida.
        isSubmitting={exclusaoEmAndamento}
        onConfirm={(especie) => {
          void confirmarExclusao(especie);
        }}
        onCancel={() => {
          // Cancelar nao dispara requisicao nenhuma e a especie permanece na
          // lista (CT-23): a unica coisa que muda e a escolha.
          escolherParaExcluir(null);
        }}
      />
    </div>
  );
}
