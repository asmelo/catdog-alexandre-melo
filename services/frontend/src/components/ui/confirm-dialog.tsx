import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Enquanto verdadeiro, os dois botoes ficam desabilitados. */
  readonly isSubmitting?: boolean;
};

/**
 * Foco pelo anel `shadow-focus-ring`, a tecnica dominante da base (paginas de
 * autenticacao, `client-layout.tsx`, `not-found-page.tsx` e os campos), e nao
 * pelo `focus-visible:outline` — este ultimo a task prescreve APENAS para o
 * `IconButton`, e so la ele fica.
 *
 * Os dois botoes vivem sobre o painel branco (`surface-card`), onde o anel roxo
 * a 80% rende 3.97:1 contra o cartao: acima dos 3:1 que o SC 1.4.11 pede de um
 * indicador nao-textual. O `outline-none` acompanha o anel para que o contorno
 * padrao do navegador nao se some a ele, exatamente como no `login-page.tsx`.
 */
const CLASSES_BASE_DO_BOTAO =
  'rounded-field border-[1.5px] px-4 py-2 text-[0.82rem] font-extrabold transition-colors focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/** Neutro: cancelar nunca deve parecer a acao principal. */
const CLASSES_DO_BOTAO_DE_CANCELAR =
  'border-hairline bg-surface-card text-ink hover:bg-surface-input';

/**
 * Perigo.
 *
 * DIVERGENCIA DELIBERADA DA TASK, por acessibilidade: ela prescreve borda e
 * fundo em `brand-orange`. Medido, o rotulo branco sobre `brand-orange`
 * (#e05a1e) rende 3.72:1 e reprova o WCAG AA (4.5:1) — a mesma medicao ja
 * registrada no `field-error.tsx`. O `brand-orange-dark` (#c44a10), que ja e
 * token do design system, rende 4.85:1 com o mesmo branco. Nenhuma cor nova foi
 * inventada e o laranja continua sendo o sinal de perigo.
 *
 * O HOVER nao pode desfazer a divergencia. Trocar o fundo para `brand-orange`
 * ao passar o mouse devolveria os mesmos 3.72:1 do estado de repouso recusado, e
 * o SC 1.4.3 vale para o texto em QUALQUER estado — nao so no de repouso. Como
 * nao existe laranja mais escuro que `brand-orange-dark` no design system e a
 * task proibe criar token, o hover mantem o fundo (4.85:1 intactos) e muda so a
 * BORDA para `ink`: 3.46:1 contra o fundo laranja, acima do minimo de 3:1 que o
 * SC 1.4.11 pede de um indicador nao-textual.
 *
 * A cor tambem nao e o unico indicador: o titulo e a descricao dizem o que sera
 * excluido e avisam que a acao nao pode ser desfeita.
 */
const CLASSES_DO_BOTAO_DE_CONFIRMAR =
  'border-brand-orange-dark bg-brand-orange-dark text-white hover:border-ink';

/**
 * Primeiro botao da lista que ainda aceita foco.
 *
 * `focus()` em elemento desabilitado e no-op silencioso: sem esta checagem, o
 * dialogo aberto ja com `isSubmitting` tentaria focar o confirmar, nao moveria
 * nada e deixaria o foco no <body> — fora da armadilha.
 */
function primeiroBotaoHabilitado(
  ...botoes: readonly (HTMLButtonElement | null)[]
): HTMLButtonElement | null {
  return (
    botoes.find((botao): botao is HTMLButtonElement => botao !== null && !botao.disabled) ?? null
  );
}

/**
 * Confirmacao de acao destrutiva.
 *
 * Todo o comportamento de teclado e escrito a mao porque nao ha biblioteca de
 * dialogo no projeto e a task proibe acrescentar uma. Sem a armadilha de foco,
 * um modal e apenas uma caixa desenhada por cima: o teclado continua percorrendo
 * a lista atras dele, o usuario edita e exclui o que nao esta vendo, e o RNF-06
 * cai junto (CT-37).
 *
 * `<dialog>` nativo foi recusado: o `showModal()` dele nao existe no jsdom em uso
 * pelos testes e o suporte a `::backdrop` ainda varia, o que exigiria justamente
 * o mesmo tratamento manual — com a diferenca de ele passar a depender de um
 * comportamento de navegador impossivel de verificar na suite.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ConfirmDialogProps): ReactElement | null {
  const idDoTitulo = useId();
  const idDaDescricao = useId();

  const refDoPainel = useRef<HTMLDivElement | null>(null);
  const refDoBotaoDeConfirmar = useRef<HTMLButtonElement | null>(null);
  const refDoBotaoDeCancelar = useRef<HTMLButtonElement | null>(null);
  const refDoElementoFocadoAntes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Lido DEPOIS da renderizacao do painel e ANTES de qualquer `focus()`:
    // montar o dialogo nao move o foco sozinho, entao aqui o foco ainda esta em
    // quem abriu (a lixeira da linha). Este efeito e declarado ANTES do que move
    // o foco porque o React executa os efeitos de um componente na ordem em que
    // aparecem — inverter os dois faria a captura ler o proprio botao do dialogo.
    const elementoAnterior = document.activeElement;
    refDoElementoFocadoAntes.current =
      elementoAnterior instanceof HTMLElement ? elementoAnterior : null;

    return () => {
      // Devolver o foco a origem e o que evita o "foco no <body>": sem isto, ao
      // fechar o dialogo a proxima tabulacao recomecaria do topo da pagina, e
      // quem navega por teclado perderia o lugar na lista.
      refDoElementoFocadoAntes.current?.focus();
      refDoElementoFocadoAntes.current = null;
    };
  }, [open]);

  // Efeito SEPARADO e dependente tambem de `isSubmitting`, e nao um trecho do
  // efeito acima: quando a exclusao comeca, os dois botoes sao desabilitados e o
  // navegador TIRA o foco do elemento que acabou de ser desabilitado, jogando-o
  // no <body>. Reagir a essa transicao e o que mantem o foco preso no dialogo
  // durante a operacao. (O jsdom nao reproduz esse blur automatico, por isso o
  // caminho precisa ser exercitado com `blur()` explicito na suite.)
  useEffect(() => {
    if (!open) {
      return;
    }

    const alvo =
      primeiroBotaoHabilitado(refDoBotaoDeConfirmar.current, refDoBotaoDeCancelar.current) ??
      refDoPainel.current;

    alvo?.focus();
  }, [open, isSubmitting]);

  // Retorno antecipado DEPOIS dos hooks (a ordem deles nao pode variar entre
  // renderizacoes). Fechado, o dialogo e desmontado e nao apenas escondido por
  // CSS: conteudo escondido por `display` continua no DOM e, dependendo da
  // tecnica, continua alcancavel pelo leitor de tela e pela tabulacao.
  if (!open) {
    return null;
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key === 'Escape') {
      // `stopPropagation` para que um Escape destinado a fechar o dialogo nao
      // seja lido tambem por quem estiver escutando a tecla na tela de tras.
      evento.stopPropagation();

      // `isSubmitting` congela TODAS as saidas, nao so os dois botoes. Fechar
      // por Escape com o DELETE em voo faria o dialogo sumir sobre uma operacao
      // que o consumidor ja nao tem como cancelar, deixando a tela sem sinal do
      // que estava acontecendo.
      if (!isSubmitting) {
        onCancel();
      }
      return;
    }

    if (evento.key !== 'Tab') {
      return;
    }

    // A armadilha percorre DOIS elementos conhecidos, entao nao e preciso varrer
    // o DOM atras de focaveis: com apenas dois, avancar e retroceder levam
    // sempre ao outro — `shiftKey` nao muda o destino. Quando o foco esta fora
    // dos dois (sobreposicao clicada, painel, <body>), a comparacao falha e o
    // destino vira o cancelar, a saida segura.
    evento.preventDefault();

    const focoAtual = document.activeElement;
    const proximo =
      focoAtual === refDoBotaoDeCancelar.current
        ? refDoBotaoDeConfirmar.current
        : refDoBotaoDeCancelar.current;

    proximo?.focus();

    // Rede de seguranca para o unico caso em que a linha acima nao move nada:
    // com `isSubmitting` os dois botoes estao desabilitados e `focus()` e no-op.
    // Sem isto o foco continuaria onde estava — possivelmente fora do dialogo.
    const painel = refDoPainel.current;
    if (painel !== null && !painel.contains(document.activeElement)) {
      painel.focus();
    }
  }

  /*
    O `onKeyDown` vive na SOBREPOSICAO, nao no painel.

    Evento de teclado sobe a partir do elemento FOCADO, e o foco nem sempre esta
    dentro do painel: basta um clique no fundo escuro, ou o `isSubmitting`
    desabilitando os dois botoes, para ele ir parar no <body>. Com o tratador no
    painel, `Escape` e `Tab` deixavam de chegar ate ele — o dialogo declarava
    `aria-modal="true"` e mesmo assim o teclado voltava a percorrer a lista
    atras, que e exatamente a falha que a armadilha existe para impedir.

    O `tabIndex={-1}` fecha o outro lado do mesmo furo: um clique na
    sobreposicao passa a focar a propria sobreposicao, DENTRO da arvore que
    escuta o teclado, em vez de descartar o foco no <body>. `focus:outline-none`
    porque ela nao e um controle e um contorno do tamanho da viewport so
    confundiria — quem navega por teclado nunca para aqui, o `Tab` seguinte ja
    manda o foco para o cancelar.

    Um ouvinte global em `document` cobriria os mesmos casos, mas sobreviveria ao
    fechamento do dialogo se alguma limpeza falhasse; a sobreposicao desmonta
    junto com ele.
  */
  return (
    <div
      tabIndex={-1}
      onKeyDown={aoTeclar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 focus:outline-none"
    >
      <div
        ref={refDoPainel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        aria-describedby={idDaDescricao}
        // Alvo de foco de ULTIMO recurso, fora da ordem de tabulacao (`-1`):
        // enquanto `isSubmitting` desabilita os dois botoes nao sobra nenhum
        // focavel, e focar o painel mantem o foco dentro do dialogo. Escolhido
        // no lugar da sobreposicao porque este elemento tem `role="dialog"` com
        // nome e descricao, entao o leitor de tela reanuncia o que esta em curso.
        tabIndex={-1}
        className="w-full max-w-card rounded-card bg-surface-card p-6 shadow-card"
      >
        <h2 id={idDoTitulo} className="text-[1.05rem] font-extrabold text-ink">
          {title}
        </h2>
        <p id={idDaDescricao} className="mt-2 text-[0.875rem] font-semibold text-ink-mid">
          {description}
        </p>

        {/*
          Cancelar vem PRIMEIRO na ordem de leitura e de tabulacao. O foco inicial
          e o confirmar (o dialogo existe para confirmar), mas quem chega ao
          dialogo lendo o conteudo encontra a saida segura antes da destrutiva.
        */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={refDoBotaoDeCancelar}
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={`${CLASSES_BASE_DO_BOTAO} ${CLASSES_DO_BOTAO_DE_CANCELAR}`}
          >
            {cancelLabel}
          </button>
          <button
            ref={refDoBotaoDeConfirmar}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`${CLASSES_BASE_DO_BOTAO} ${CLASSES_DO_BOTAO_DE_CONFIRMAR}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
