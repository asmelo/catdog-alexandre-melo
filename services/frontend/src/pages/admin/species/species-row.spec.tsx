import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { SpeciesRow } from '~/pages/admin/species/species-row';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Specs da linha da lista (HU-04) — CT-19, CT-21, CT-37 e CT-38.
 *
 * A LINHA NAO CHAMA A API: ela valida, avisa a pagina (`onSave`, `onDelete`) e
 * recebe de volta o estado. E por isso que este arquivo nao espiona `fetch` nem
 * dubla `species-api` — o componente nao importa nenhum dos dois, e um dublê aqui
 * afirmaria um acoplamento que nao existe. A guarda de rede de `tests/setup.ts`
 * continua valendo: qualquer requisicao que escapasse daqui reprovaria o teste.
 *
 * `userEvent` sempre. `fireEvent.keyDown` nao move foco nenhum, e metade do que
 * este arquivo protege (entrada em edicao com foco no campo, devolucao do foco ao
 * lapis) e exatamente sobre onde o foco esta.
 */

const GATO: Species = {
  id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Gato',
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

const ROTULO_DE_EDITAR = `${MESSAGES.SPECIES.EDIT_ACTION} ${GATO.name}`;
const ROTULO_DE_EXCLUIR = `${MESSAGES.SPECIES.DELETE_ACTION} ${GATO.name}`;

type Dublês = {
  readonly aoIniciarEdicao: jest.Mock<void, [Species]>;
  readonly aoCancelar: jest.Mock<void, []>;
  readonly aoSalvar: jest.Mock<void, [Species, string]>;
  readonly aoExcluir: jest.Mock<void, [Species]>;
};

type Opcoes = {
  readonly isEditing?: boolean;
  readonly isSubmitting?: boolean;
  readonly error?: string;
};

function criarDublês(): Dublês {
  return {
    aoIniciarEdicao: jest.fn<void, [Species]>(),
    aoCancelar: jest.fn<void, []>(),
    aoSalvar: jest.fn<void, [Species, string]>(),
    aoExcluir: jest.fn<void, [Species]>(),
  };
}

function renderizarLinha(
  opcoes: Opcoes = {},
  dublês: Dublês = criarDublês(),
): { readonly dublês: Dublês; readonly rerenderizar: (novas: Opcoes) => void } {
  function elemento(atuais: Opcoes): ReactElement {
    return (
      <SpeciesRow
        species={GATO}
        isEditing={atuais.isEditing ?? false}
        isSubmitting={atuais.isSubmitting ?? false}
        error={atuais.error ?? ''}
        onStartEdit={dublês.aoIniciarEdicao}
        onCancelEdit={dublês.aoCancelar}
        onSave={dublês.aoSalvar}
        onDelete={dublês.aoExcluir}
      />
    );
  }

  const { rerender } = render(elemento(opcoes));

  return {
    dublês,
    rerenderizar: (novas: Opcoes) => {
      rerender(elemento(novas));
    },
  };
}

function campoDeEdicao(): HTMLElement {
  return screen.getByLabelText(MESSAGES.SPECIES.NAME_PLACEHOLDER);
}

function botaoDeSalvar(): HTMLElement {
  return screen.getByRole('button', { name: /^(Salvar|Aguarde…)$/u });
}

describe('SpeciesRow — modo de exibicao', () => {
  it('CT-38: exibe o nome e as duas acoes com nome acessivel COMPOSTO', () => {
    // Arrange
    renderizarLinha();

    // Act
    const acoes = screen.getAllByRole('button');

    // Assert
    // "Editar" repetido em cada linha nao identifica nada para quem navega por
    // leitor de tela: a lista viraria uma sequencia de botoes homonimos (RNF-07).
    expect(screen.getByText(GATO.name)).toBeInTheDocument();
    expect(acoes.map((acao) => acao.textContent)).toEqual([ROTULO_DE_EDITAR, ROTULO_DE_EXCLUIR]);
    expect(screen.getByRole('button', { name: ROTULO_DE_EDITAR })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTULO_DE_EXCLUIR })).toBeInTheDocument();
  });

  it('CA-13: a lixeira apenas SELECIONA — nenhuma exclusao parte de um unico acionamento', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha();

    // Act
    await usuario.click(screen.getByRole('button', { name: ROTULO_DE_EXCLUIR }));

    // Assert
    expect(dublês.aoExcluir).toHaveBeenCalledWith(GATO);
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
  });

  it('CT-37: o lapis abre a edicao e e alcancavel apenas por teclado', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha();

    // Act
    await usuario.tab();
    await usuario.keyboard('{Enter}');

    // Assert
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ROTULO_DE_EDITAR }));
    expect(dublês.aoIniciarEdicao).toHaveBeenCalledWith(GATO);
  });

  it('no modo de exibicao NAO existe campo de texto algum na linha', () => {
    // Arrange
    renderizarLinha();

    // Act
    const campos = screen.queryAllByRole('textbox');

    // Assert
    expect(campos).toEqual([]);
  });
});

describe('SpeciesRow — entrada em edicao', () => {
  it('CT-37: o campo entra PREENCHIDO com o nome atual e ja FOCADO, com o cursor no fim', () => {
    // Arrange
    renderizarLinha({ isEditing: true });

    // Act
    const campo = campoDeEdicao();

    // Assert
    // O administrador abre a edicao para AJUSTAR o nome, nao para reescreve-lo:
    // `focus()` sozinho em campo pre-preenchido posiciona o cursor de forma que
    // varia por navegador, e a primeira tecla apagaria o nome inteiro.
    expect(campo).toHaveValue(GATO.name);
    expect(document.activeElement).toBe(campo);
    expect(campo).toHaveProperty('selectionStart', GATO.name.length);
    expect(campo).toHaveProperty('selectionEnd', GATO.name.length);
  });

  it('CT-37: os icones de lapis e lixeira estao AUSENTES do DOM durante a edicao', () => {
    // Arrange
    renderizarLinha({ isEditing: true });

    // Act
    const lapis = screen.queryByRole('button', { name: ROTULO_DE_EDITAR });
    const lixeira = screen.queryByRole('button', { name: ROTULO_DE_EXCLUIR });

    // Assert
    // Ausencia, e nao ocultacao: um icone escondido por CSS continuaria na ordem
    // de tabulacao e permitiria excluir a linha que esta sendo editada.
    expect(lapis).toBeNull();
    expect(lixeira).toBeNull();
    expect(screen.getByRole('button', { name: MESSAGES.SPECIES.SAVE_BUTTON })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MESSAGES.SPECIES.CANCEL_BUTTON })).toBeInTheDocument();
  });

  it('CT-16: salvar entrega a especie e o texto DIGITADO a pagina', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.type(campoDeEdicao(), 'Perereca{Enter}');

    // Assert
    // Vai o texto digitado: a RN-03 e aplicada pelo SERVIDOR, que e a autoridade
    // sobre a forma gravada.
    expect(dublês.aoSalvar).toHaveBeenCalledWith(GATO, 'Perereca');
  });

  it('CT-17: renomear ajustando apenas a caixa das letras e submetido normalmente', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.type(campoDeEdicao(), 'GATO{Enter}');

    // Assert
    // A linha nao decide sobre conflito (RN-07): quem sabe se o novo nome colide
    // e o servidor.
    expect(dublês.aoSalvar).toHaveBeenCalledWith(GATO, 'GATO');
  });
});

describe('SpeciesRow — validacao local da renomeacao', () => {
  it('CT-19: campo vazio exibe a mensagem, a linha PERMANECE em edicao e onSave NAO e chamado', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.keyboard('{Enter}');

    // Assert
    expect(await screen.findByText(MESSAGES.VALIDATION.FIELD_REQUIRED)).toBeInTheDocument();
    // Nada aqui chama `onCancelEdit`: reprovar a validacao nao pode expulsar o
    // usuario da edicao e descartar o que ele digitou.
    expect(campoDeEdicao()).toBeInTheDocument();
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
    expect(dublês.aoCancelar).not.toHaveBeenCalled();
  });

  it('CT-19: apenas espacos tambem sao campo em branco, e tambem nao chamam onSave', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.type(campoDeEdicao(), '   {Enter}');

    // Assert
    expect(await screen.findByText(MESSAGES.VALIDATION.FIELD_REQUIRED)).toBeInTheDocument();
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
  });

  it('CT-04: um caractere reprova pelo tamanho minimo, com o literal do catalogo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.type(campoDeEdicao(), 'G{Enter}');

    // Assert
    expect(await screen.findByText(MESSAGES.VALIDATION.NAME_TOO_SHORT)).toBeInTheDocument();
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
  });

  it('o erro LOCAL vence o erro da API vindo da tentativa anterior', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const conflito = 'Já existe uma espécie com este nome.';

    renderizarLinha({ isEditing: true, error: conflito });

    expect(screen.getByText(conflito)).toBeInTheDocument();

    // Act
    await usuario.clear(campoDeEdicao());
    await usuario.keyboard('{Enter}');

    // Assert
    // O erro da API descreve a tentativa ANTERIOR, que nem chegou a ser refeita —
    // a requisicao nao saiu. Exibir o antigo por cima do novo responderia a
    // submissao errada.
    expect(await screen.findByText(MESSAGES.VALIDATION.FIELD_REQUIRED)).toBeInTheDocument();
    expect(screen.queryByText(conflito)).toBeNull();
  });

  it('CT-18: o erro da API chega ao campo quando nao ha erro local', () => {
    // Arrange
    const conflito = 'Já existe uma espécie com este nome.';

    renderizarLinha({ isEditing: true, error: conflito });

    // Act
    const campo = campoDeEdicao();

    // Assert
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(conflito);
  });
});

describe('SpeciesRow — cancelamento e gravacao em voo', () => {
  it('CT-21: cancelar avisa a pagina e o rascunho DESMONTA junto com o formulario', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês, rerenderizar } = renderizarLinha({ isEditing: true });

    await usuario.clear(campoDeEdicao());
    await usuario.type(campoDeEdicao(), 'Rascunho descartado');

    // Act
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.CANCEL_BUTTON }));
    rerenderizar({ isEditing: false });

    // Assert
    expect(dublês.aoCancelar).toHaveBeenCalledTimes(1);
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
    expect(screen.getByText(GATO.name)).toBeInTheDocument();

    // Act — volta a editar: o rascunho anterior NAO pode reaparecer.
    rerenderizar({ isEditing: true });

    // Assert
    expect(campoDeEdicao()).toHaveValue(GATO.name);
  });

  it('CT-37: Escape no campo tem o MESMO efeito de cancelar', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true });

    // Act
    await usuario.keyboard('{Escape}');

    // Assert
    expect(dublês.aoCancelar).toHaveBeenCalledTimes(1);
    expect(dublês.aoSalvar).not.toHaveBeenCalled();
  });

  it('Escape e RECUSADO enquanto a gravacao esta em voo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { dublês } = renderizarLinha({ isEditing: true, isSubmitting: true });

    // Act
    await usuario.click(campoDeEdicao());
    await usuario.keyboard('{Escape}');

    // Assert
    // Com o `PATCH` em andamento nao ha o que cancelar, e sair da edicao deixaria
    // a resposta chegar sobre uma linha que ja voltou ao modo de exibicao.
    expect(dublês.aoCancelar).not.toHaveBeenCalled();
  });

  it('CT-35: com a gravacao em voo, salvar e cancelar ficam desabilitados', () => {
    // Arrange
    renderizarLinha({ isEditing: true, isSubmitting: true });

    // Act
    const salvar = botaoDeSalvar();
    const cancelar = screen.getByRole('button', { name: MESSAGES.SPECIES.CANCEL_BUTTON });

    // Assert
    expect(salvar).toBeDisabled();
    expect(salvar).toHaveAttribute('aria-busy', 'true');
    expect(cancelar).toBeDisabled();
  });
});

describe('SpeciesRow — devolucao do foco ao sair da edicao', () => {
  it('CT-37: ao sair da edicao, o foco vai para o LAPIS da propria linha, e nao para o <body>', () => {
    // Arrange
    const { rerenderizar } = renderizarLinha({ isEditing: true });

    expect(document.activeElement).toBe(campoDeEdicao());

    // Act — o campo DESMONTA e o jsdom devolve o foco ao <body>, exatamente como
    // o navegador faz. E essa assinatura que o efeito da linha reconhece.
    rerenderizar({ isEditing: false });

    // Assert
    // Sem a devolucao, a proxima tabulacao recomeca do topo da pagina e quem
    // navega so por teclado perde o lugar na lista (RNF-06).
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ROTULO_DE_EDITAR }));
  });

  it('HU-04 cenario 8: a linha NAO rouba o foco quando ele ja esta em outro elemento', async () => {
    // Arrange
    const usuario = userEvent.setup();

    render(<button type="button">Foco de outra linha</button>);

    const { rerenderizar } = renderizarLinha({ isEditing: true });
    const outroFocavel = screen.getByRole('button', { name: 'Foco de outra linha' });

    await usuario.click(outroFocavel);

    // Act
    rerenderizar({ isEditing: false });

    // Assert
    /**
     * A guarda `document.activeElement === document.body` E O PONTO. Sem ela, ao
     * acionar o lapis de uma SEGUNDA linha, esta aqui sairia da edicao e roubaria
     * o foco do campo que a outra acabou de focar — e a ordem entre os dois
     * efeitos depende da posicao alfabetica das linhas, entao o defeito
     * apareceria em metade dos casos.
     */
    expect(document.activeElement).toBe(outroFocavel);
  });
});
