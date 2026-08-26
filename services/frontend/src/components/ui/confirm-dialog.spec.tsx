import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { ConfirmDialog } from '~/components/ui/confirm-dialog';

/**
 * Specs da confirmacao de acao destrutiva (CA-13 / CT-37 / RNF-06).
 *
 * TODO o comportamento de teclado deste componente e escrito a mao — nao ha
 * biblioteca de dialogo no projeto —, e por isso ele precisa de teste de verdade:
 * sem a armadilha de foco, um modal e apenas uma caixa desenhada por cima e o
 * teclado continua percorrendo a lista atras dele.
 *
 * `userEvent` e NUNCA `fireEvent`: `fireEvent.keyDown` despacha o evento e NAO
 * move foco nenhum. Um teste de tabulacao escrito com ele fica verde sem exercitar
 * a armadilha — que e exatamente o unico comportamento que este arquivo existe
 * para proteger.
 */

const TITULO = 'Excluir Gato';
const DESCRICAO = 'Excluir a espécie “Gato”? Esta ação não pode ser desfeita.';
const CONFIRMAR = 'Excluir';
const CANCELAR = 'Cancelar';

type PropsDoDublê = {
  readonly open?: boolean;
  readonly isSubmitting?: boolean;
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
};

function renderizarDialogo(props: PropsDoDublê = {}): ReturnType<typeof render> {
  return render(
    <ConfirmDialog
      open={props.open ?? true}
      title={TITULO}
      description={DESCRICAO}
      confirmLabel={CONFIRMAR}
      cancelLabel={CANCELAR}
      isSubmitting={props.isSubmitting ?? false}
      onConfirm={props.onConfirm ?? jest.fn()}
      onCancel={props.onCancel ?? jest.fn()}
    />,
  );
}

function botaoDeConfirmar(): HTMLElement {
  return screen.getByRole('button', { name: CONFIRMAR });
}

function botaoDeCancelar(): HTMLElement {
  return screen.getByRole('button', { name: CANCELAR });
}

/**
 * `document.activeElement` estreitado sem conversao de tipo.
 *
 * `activeElement` e `Element | null`, e as asserções abaixo pedem `HTMLElement`.
 * Um `as HTMLElement` resolveria a compilacao e mentiria: o dia em que o foco
 * parasse num `<svg>`, a conversao esconderia o defeito em vez de reprova-lo.
 */
function focado(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/**
 * Arvore que reproduz o USO REAL: um gatilho fora do dialogo, um segundo
 * elemento focavel atras dele e o dialogo montado por estado.
 *
 * O segundo elemento existe so para a armadilha ter para onde vazar — sem
 * nenhum focavel atras do modal, um `Tab` que escapasse voltaria ao proprio
 * dialogo por acidente e o teste ficaria verde com a falha presente.
 */
function TelaComDialogo({ aoConfirmar }: { readonly aoConfirmar: () => void }): ReactElement {
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
        }}
      >
        Excluir Gato (gatilho)
      </button>
      <button type="button">Botão do fundo</button>

      <ConfirmDialog
        open={aberto}
        title={TITULO}
        description={DESCRICAO}
        confirmLabel={CONFIRMAR}
        cancelLabel={CANCELAR}
        onConfirm={() => {
          aoConfirmar();
          setAberto(false);
        }}
        onCancel={() => {
          setAberto(false);
        }}
      />
    </div>
  );
}

describe('ConfirmDialog — presenca no DOM', () => {
  it('CA-13: fechado, o role="dialog" esta AUSENTE do DOM — verificado por ausencia, e nao por estilo', () => {
    // Arrange
    const { container } = renderizarDialogo({ open: false });

    // Act
    // `querySelector` e NAO `queryByRole`: as consultas por papel filtram por
    // acessibilidade e ja nao enxergam um no marcado com `aria-hidden` ou escondido
    // por `display` — isto e, sao CEGAS ao unico modo de falha que o CA-13 proibe.
    // Medido por mutacao: com o dialogo montado e escondido por CSS, a consulta por
    // papel continua devolvendo `null` e a asserção que da nome a este teste passa.
    // O seletor de DOM cru pergunta o que o criterio pergunta: o no existe?
    const dialogo = container.querySelector('[role="dialog"]');

    // Assert
    // Conteudo escondido por `display` continua no DOM e, dependendo da tecnica,
    // continua alcancavel pelo leitor de tela e pela tabulacao. Aqui ele e
    // DESMONTADO.
    expect(dialogo).toBeNull();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(screen.queryByRole('button', { name: CONFIRMAR })).toBeNull();
  });

  it('aberto, o dialogo se apresenta como modal, com nome e descricao acessiveis', () => {
    // Arrange
    renderizarDialogo();

    // Act
    const dialogo = screen.getByRole('dialog');

    // Assert
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName(TITULO);
    expect(dialogo).toHaveAccessibleDescription(DESCRICAO);
  });
});

describe('ConfirmDialog — foco', () => {
  it('CT-37: o foco inicial vai para o botao de confirmar, porque e para isso que o dialogo existe', () => {
    // Arrange
    renderizarDialogo();

    // Act
    const focoInicial = focado();

    // Assert
    expect(focoInicial).toBe(botaoDeConfirmar());
  });

  it('CT-37: cancelar vem ANTES de confirmar na ordem de leitura, mesmo com o foco no confirmar', () => {
    // Arrange
    renderizarDialogo();

    // Act
    const botoes = screen.getAllByRole('button');

    // Assert
    // Quem chega ao dialogo LENDO o conteudo encontra a saida segura antes da
    // destrutiva; quem chega pelo foco cai direto na acao pretendida.
    expect(botoes.map((botao) => botao.textContent)).toEqual([CANCELAR, CONFIRMAR]);
  });

  it('CT-37: o Tab em laco nao alcanca NENHUM elemento fora do dialogo', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarDialogo();

    const alcancados: (string | null)[] = [];

    // Act — seis tabulacoes, o triplo do numero de focaveis do dialogo: se a
    // armadilha vazasse, o `<body>` ou o proximo focavel do documento apareceria
    // em alguma delas.
    for (let volta = 0; volta < 6; volta += 1) {
      // eslint-disable-next-line no-await-in-loop -- a ordem das tabulacoes E o teste
      await usuario.tab();
      alcancados.push(focado()?.textContent ?? null);
    }

    // Assert
    expect(new Set(alcancados)).toEqual(new Set([CANCELAR, CONFIRMAR]));
    expect(screen.getByRole('dialog')).toContainElement(focado());
  });

  it('CT-37: Shift+Tab tambem nao sai do dialogo — com dois focaveis, avancar e retroceder levam ao outro', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarDialogo();

    // Act
    await usuario.tab({ shift: true });

    // Assert
    expect(document.activeElement).toBe(botaoDeCancelar());
    expect(screen.getByRole('dialog')).toContainElement(focado());
  });

  it('CT-37: o foco volta ao GATILHO depois de o dialogo fechar', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoConfirmar = jest.fn();

    render(<TelaComDialogo aoConfirmar={aoConfirmar} />);

    const gatilho = screen.getByRole('button', { name: 'Excluir Gato (gatilho)' });

    // Act
    await usuario.click(gatilho);
    await usuario.keyboard('{Escape}');

    // Assert
    // Sem a devolucao, a proxima tabulacao recomecaria do topo da pagina e quem
    // navega por teclado perderia o lugar na lista.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it('CT-37: o foco NAO cai no <body> quando os dois botoes sao desabilitados pela operacao em voo', () => {
    // Arrange
    const { rerender } = renderizarDialogo();

    expect(document.activeElement).toBe(botaoDeConfirmar());

    // Act — o `blur()` MODELA O NAVEGADOR, e nao acrescenta poder de deteccao.
    // O navegador tira o foco do elemento que acaba de ser desabilitado e o joga
    // no <body>; o jsdom nao reproduz esse blur, e sem ele o foco continuaria no
    // confirmar por inercia — um estado que o usuario real nunca ve. Medido: com
    // a asserção estrita abaixo (o foco tem de estar no PAINEL), a mutacao
    // `useEffect(..., [open])` e detectada com ou sem este `blur()`. Ele esta aqui
    // para que o teste exercite a transicao real, dentro do mesmo `act()` do
    // rerender.
    act(() => {
      focado()?.blur();

      rerender(
        <ConfirmDialog
          open
          title={TITULO}
          description={DESCRICAO}
          confirmLabel={CONFIRMAR}
          cancelLabel={CANCELAR}
          isSubmitting
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });

    // Assert
    expect(botaoDeConfirmar()).toBeDisabled();
    expect(botaoDeCancelar()).toBeDisabled();
    // Alvo de ULTIMO recurso: o painel tem `role="dialog"` com nome e descricao,
    // entao o leitor de tela reanuncia o que esta em curso.
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('CT-37: um clique na SOBREPOSICAO nao descarta o foco fora do dialogo', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarDialogo({ isSubmitting: true });

    // A sobreposicao e o PAI do painel. Consultada assim porque ela nao tem papel
    // proprio — e deliberado: ela nao e um controle, e um `role` a poria na
    // arvore de acessibilidade sem nada a anunciar.
    const sobreposicao = screen.getByRole('dialog').parentElement;

    if (sobreposicao === null) {
      throw new Error('O painel do dialogo nao esta dentro de uma sobreposicao.');
    }

    // Act
    await usuario.click(sobreposicao);
    await usuario.tab();

    // Assert
    /**
     * O `tabIndex={-1}` da sobreposicao e o que faz um clique no fundo escuro
     * focar a PROPRIA sobreposicao — dentro da arvore que escuta o teclado — em
     * vez de descartar o foco no <body>, de onde `Escape` e `Tab` nunca chegariam
     * ao tratador. Com os dois botoes desabilitados, `focus()` neles e no-op e a
     * rede de seguranca leva o foco ao painel.
     */
    expect(focado()).toBe(screen.getByRole('dialog'));
  });

  it('CT-37: com a operacao em voo, o Tab mantem o foco dentro do painel', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarDialogo({ isSubmitting: true });

    // Act
    await usuario.tab();

    // Assert
    // Os dois botoes estao desabilitados e `focus()` neles e no-op: a rede de
    // seguranca do tratador leva o foco ao painel em vez de deixa-lo escapar.
    expect(screen.getByRole('dialog')).toContainElement(focado());
  });
});

describe('ConfirmDialog — saidas', () => {
  it('CA-13: Escape chama onCancel e NUNCA onConfirm', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoConfirmar = jest.fn();
    const aoCancelar = jest.fn();

    renderizarDialogo({ onConfirm: aoConfirmar, onCancel: aoCancelar });

    // Act
    await usuario.keyboard('{Escape}');

    // Assert
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('Escape e RECUSADO enquanto a operacao esta em voo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoCancelar = jest.fn();

    renderizarDialogo({ isSubmitting: true, onCancel: aoCancelar });

    // Act
    await usuario.keyboard('{Escape}');

    // Assert
    // Fechar por Escape com o DELETE em voo faria o dialogo sumir sobre uma
    // operacao que o consumidor ja nao tem como cancelar.
    expect(aoCancelar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('CT-37: confirmar e acionavel por teclado, sem nenhum clique de mouse', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoConfirmar = jest.fn();

    renderizarDialogo({ onConfirm: aoConfirmar });

    // Act
    await usuario.keyboard('{Enter}');

    // Assert
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('CT-37: cancelar e alcancavel por Tab e acionavel por Espaco', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoCancelar = jest.fn();

    renderizarDialogo({ onCancel: aoCancelar });

    // Act
    await usuario.tab();
    await usuario.keyboard(' ');

    // Assert
    expect(document.activeElement).toBe(botaoDeCancelar());
    expect(aoCancelar).toHaveBeenCalledTimes(1);
  });

  it('uma tecla que nao e Escape nem Tab atravessa o dialogo sem efeito', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoConfirmar = jest.fn();
    const aoCancelar = jest.fn();

    renderizarDialogo({ onConfirm: aoConfirmar, onCancel: aoCancelar });

    // Act
    await usuario.keyboard('a');

    // Assert
    expect(aoCancelar).not.toHaveBeenCalled();
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(botaoDeConfirmar());
  });
});
