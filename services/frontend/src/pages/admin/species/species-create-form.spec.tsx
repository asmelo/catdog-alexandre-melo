import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpeciesCreateForm } from '~/pages/admin/species/species-create-form';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Specs da linha de criacao de especie (HU-02) — CT-01 a CT-04, CT-07 a CT-09,
 * CT-35 e CT-37.
 *
 * O `fetch` e ESPIONADO, e nao o modulo `species-api` dublado. E deliberado: os
 * criterios CT-02, CT-03, CT-04 e CT-07 cobram a AUSENCIA DE REQUISICAO, e a
 * unica forma de afirmar isso sem ambiguidade e observar a saida de rede real do
 * cliente. Um dublê de `createSpecies` provaria apenas que uma funcao nao foi
 * chamada — e nao que nenhum outro caminho do formulario emitiu requisicao.
 *
 * O formulario NAO usa roteador nem contexto de sessao, entao e montado direto
 * com `render`. Acrescentar `MemoryRouter` aqui afirmaria um acoplamento que o
 * componente nao tem.
 */

const ROTULO_DO_CAMPO = MESSAGES.SPECIES.NAME_PLACEHOLDER;
const ID_DO_CAMPO = 'species-create-name';

const CRIADA: Species = {
  id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Cachorro',
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

function envelopeDeErro(code: string, message: string, details?: unknown): unknown {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

type EspiaoDeFetch = jest.SpyInstance<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>;

function espionarFetch(): EspiaoDeFetch {
  return jest.spyOn(globalThis, 'fetch');
}

type Dublês = {
  readonly espiao: EspiaoDeFetch;
  readonly aoCriar: jest.Mock<void, [Species]>;
  readonly aoResultar: jest.Mock<void, [{ variant: 'success' | 'error'; message: string } | null]>;
};

function renderizarFormulario(): Dublês {
  const espiao = espionarFetch();
  const aoCriar = jest.fn<void, [Species]>();
  const aoResultar = jest.fn<
    void,
    [{ variant: 'success' | 'error'; message: string } | null]
  >();

  render(<SpeciesCreateForm onCreated={aoCriar} onResult={aoResultar} />);

  return { espiao, aoCriar, aoResultar };
}

function campoDoNome(): HTMLElement {
  return screen.getByLabelText(ROTULO_DO_CAMPO);
}

/**
 * O botao sob QUALQUER um dos seus dois rotulos.
 *
 * Enquanto a requisicao esta em voo o `SubmitButton` troca "Criar" por
 * "Aguarde…", entao consultar so por "Criar" deixaria de encontrar o elemento
 * exatamente no instante que o CT-35 precisa observar. Mesma tecnica ja usada em
 * `login-page.spec.tsx`.
 */
function botaoDeSubmissao(): HTMLElement {
  return screen.getByRole('button', { name: /^(Criar|Aguarde…)$/u });
}

describe('SpeciesCreateForm — criacao bem-sucedida', () => {
  it('CT-01: cria a especie, limpa o campo, devolve o foco e avisa a pagina', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao, aoCriar, aoResultar } = renderizarFormulario();

    espiao.mockResolvedValue(respostaJson(201, CRIADA));

    // Act
    await usuario.type(campoDoNome(), 'Cachorro');
    await usuario.click(botaoDeSubmissao());

    // Assert
    await waitFor(() => {
      expect(aoCriar).toHaveBeenCalledWith(CRIADA);
    });

    expect(campoDoNome()).toHaveValue('');
    // Devolver o foco ao campo e o que permite cadastrar varias especies em
    // sequencia sem tocar no mouse (RNF-06).
    expect(document.activeElement).toBe(document.getElementById(ID_DO_CAMPO));
    expect(aoResultar).toHaveBeenLastCalledWith({
      variant: 'success',
      message: MESSAGES.SPECIES.CREATE_SUCCESS,
    });
  });

  it('CT-01: toda submissao comeca LIMPANDO o aviso da pagina, antes de qualquer requisicao', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao, aoResultar } = renderizarFormulario();

    espiao.mockResolvedValue(respostaJson(201, CRIADA));

    // Act
    await usuario.type(campoDoNome(), 'Cachorro');
    await usuario.click(botaoDeSubmissao());

    // Assert
    // `StatusMessage` e regiao viva: um aviso que permanece montado entre duas
    // operacoes nao e reanunciado quando o texto se repete (RNF-09).
    expect(aoResultar.mock.calls[0]?.[0]).toBeNull();
  });

  it('CT-37: Enter dentro do campo submete o formulario, sem nenhum clique', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao, aoCriar } = renderizarFormulario();

    espiao.mockResolvedValue(respostaJson(201, CRIADA));

    // Act
    await usuario.type(campoDoNome(), 'Cachorro{Enter}');

    // Assert
    // `<form onSubmit>` de verdade, e nao `onClick` no botao: a submissao
    // implicita e comportamento que o navegador da de graca.
    await waitFor(() => {
      expect(aoCriar).toHaveBeenCalledWith(CRIADA);
    });
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('CT-05: um nome de exatamente dois caracteres chega ao servidor', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    espiao.mockResolvedValue(respostaJson(201, { ...CRIADA, name: 'Ov' }));

    // Act
    await usuario.type(campoDoNome(), 'Ov{Enter}');

    // Assert
    await waitFor(() => {
      expect(espiao).toHaveBeenCalledTimes(1);
    });

    const [, init] = espiao.mock.calls[0] ?? [];

    expect(JSON.parse(String(init?.body)) as unknown).toEqual({ name: 'Ov' });
  });
});

describe('SpeciesCreateForm — validacao local, SEM requisicao', () => {
  /**
   * Um `it` por caso da spec, e cada um assevera as DUAS coisas: a mensagem sob o
   * campo E a ausencia da chamada. So a mensagem deixaria passar a implementacao
   * que valida, exibe o erro e ainda assim dispara a requisicao.
   */
  const casos: ReadonlyArray<{
    readonly ct: string;
    readonly rotulo: string;
    readonly digitado: string;
    readonly mensagem: string;
  }> = [
    {
      ct: 'CT-02',
      rotulo: 'campo vazio',
      digitado: '',
      mensagem: MESSAGES.VALIDATION.FIELD_REQUIRED,
    },
    {
      ct: 'CT-03',
      rotulo: 'apenas espacos',
      digitado: '   ',
      mensagem: MESSAGES.VALIDATION.FIELD_REQUIRED,
    },
    {
      ct: 'CT-04',
      rotulo: 'um caractere',
      digitado: 'G',
      mensagem: MESSAGES.VALIDATION.NAME_TOO_SHORT,
    },
    {
      ct: 'CT-07',
      rotulo: 'sessenta e um caracteres',
      digitado: 'A'.repeat(61),
      mensagem: MESSAGES.VALIDATION.NAME_TOO_LONG,
    },
  ];

  for (const caso of casos) {
    it(`${caso.ct}: ${caso.rotulo} exibe a mensagem e NAO dispara requisicao`, async () => {
      // Arrange
      const usuario = userEvent.setup();
      const { espiao, aoCriar } = renderizarFormulario();

      // Act
      if (caso.digitado !== '') {
        await usuario.type(campoDoNome(), caso.digitado);
      }

      await usuario.click(botaoDeSubmissao());

      // Assert
      expect(await screen.findByText(caso.mensagem)).toBeInTheDocument();
      expect(espiao).not.toHaveBeenCalled();
      expect(aoCriar).not.toHaveBeenCalled();
    });
  }

  it('CT-02: o campo reprovado e marcado como invalido e apontado pela mensagem', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarFormulario();

    // Act
    await usuario.click(botaoDeSubmissao());

    // Assert
    const campo = campoDoNome();

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(MESSAGES.VALIDATION.FIELD_REQUIRED);
  });

  it('CT-06: sessenta caracteres NAO sao reprovados localmente — a borda superior passa', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    espiao.mockResolvedValue(respostaJson(201, CRIADA));

    // Act
    await usuario.type(campoDoNome(), 'A'.repeat(60));
    await usuario.click(botaoDeSubmissao());

    // Assert
    await waitFor(() => {
      expect(espiao).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(MESSAGES.VALIDATION.NAME_TOO_LONG)).toBeNull();
  });
});

describe('SpeciesCreateForm — desfechos de erro da API', () => {
  it('CT-08: o 409 de nome duplicado marca o campo e PRESERVA o texto digitado', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao, aoCriar } = renderizarFormulario();
    const mensagemDoServidor = 'Já existe uma espécie com este nome.';

    espiao.mockResolvedValue(
      respostaJson(409, envelopeDeErro('SPECIES_NAME_ALREADY_EXISTS', mensagemDoServidor)),
    );

    // Act
    await usuario.type(campoDoNome(), 'gato{Enter}');

    // Assert
    expect(await screen.findByText(mensagemDoServidor)).toBeInTheDocument();
    // CA-08: a lista nao muda e o usuario precisa poder CORRIGIR a palavra em vez
    // de redigitar.
    expect(campoDoNome()).toHaveValue('gato');
    expect(aoCriar).not.toHaveBeenCalled();
  });

  it('CT-09: o mesmo desfecho vale para o nome cercado por espacos', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();
    const mensagemDoServidor = 'Já existe uma espécie com este nome.';

    espiao.mockResolvedValue(
      respostaJson(409, envelopeDeErro('SPECIES_NAME_ALREADY_EXISTS', mensagemDoServidor)),
    );

    // Act
    await usuario.type(campoDoNome(), '  Gato  {Enter}');

    // Assert
    expect(await screen.findByText(mensagemDoServidor)).toBeInTheDocument();
    expect(campoDoNome()).toHaveValue('  Gato  ');
  });

  it('o VALIDATION_ERROR do servidor vira erro DO CAMPO, na mesma forma da validacao local', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    espiao.mockResolvedValue(
      respostaJson(
        400,
        envelopeDeErro('VALIDATION_ERROR', 'Dados inválidos.', [
          { field: 'name', message: 'Campo não permitido.' },
        ]),
      ),
    );

    // Act
    await usuario.type(campoDoNome(), 'Cachorro{Enter}');

    // Assert
    // As duas origens (local e servidor) alimentam um unico estado de erro de
    // campo, e por isso a tela nao precisa de um caminho de exibicao para cada.
    expect(await screen.findByText('Campo não permitido.')).toBeInTheDocument();
  });

  it('qualquer outro code cai no aviso GENERICO da pagina, e nao sob o campo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao, aoResultar } = renderizarFormulario();

    espiao.mockResolvedValue(
      respostaJson(403, envelopeDeErro('FORBIDDEN', 'Você não tem permissão para acessar este recurso.')),
    );

    // Act
    await usuario.type(campoDoNome(), 'Cachorro{Enter}');

    // Assert
    await waitFor(() => {
      expect(aoResultar).toHaveBeenLastCalledWith({
        variant: 'error',
        message: MESSAGES.FORM.UNEXPECTED_ERROR,
      });
    });
    expect(campoDoNome()).not.toHaveAttribute('aria-invalid');
  });

  it('a falha de rede tambem devolve o botao ao estado utilizavel', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    espiao.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    await usuario.type(campoDoNome(), 'Cachorro{Enter}');

    // Assert
    // E o `finally` que garante isso em QUALQUER desfecho: preso em `true`, o
    // formulario ficaria sem forma de criar especie alguma.
    await waitFor(() => {
      expect(botaoDeSubmissao()).toBeEnabled();
    });
    expect(botaoDeSubmissao()).toHaveTextContent(MESSAGES.SPECIES.CREATE_BUTTON);
  });
});

describe('SpeciesCreateForm — submissao duplicada', () => {
  it('CT-35: dois acionamentos em sequencia rapida produzem UMA unica requisicao', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    let concluir: (resposta: Response) => void = () => undefined;

    // A promessa fica RETIDA EM VOO. Um teste sequencial (esperar a primeira
    // resposta e so entao clicar de novo) passaria sem exercitar nada: a trava do
    // CT-35 so existe ENQUANTO a requisicao esta pendente.
    espiao.mockReturnValue(
      new Promise<Response>((resolver) => {
        concluir = resolver;
      }),
    );

    await usuario.type(campoDoNome(), 'Cachorro');

    // Act
    await usuario.click(botaoDeSubmissao());
    await usuario.click(botaoDeSubmissao());

    // Assert
    expect(botaoDeSubmissao()).toBeDisabled();
    expect(botaoDeSubmissao()).toHaveAttribute('aria-busy', 'true');
    expect(espiao).toHaveBeenCalledTimes(1);

    // Encerrar a requisicao dentro de `act`: a resolucao muda estado, e deixa-la
    // vazar para fora produziria o aviso de atualizacao nao envolvida em `act`.
    await act(async () => {
      concluir(respostaJson(201, CRIADA));
    });

    expect(botaoDeSubmissao()).toBeEnabled();
  });

  it('CT-35: com a requisicao em voo, o Enter no campo tambem nao dispara a segunda', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { espiao } = renderizarFormulario();

    let concluir: (resposta: Response) => void = () => undefined;

    espiao.mockReturnValue(
      new Promise<Response>((resolver) => {
        concluir = resolver;
      }),
    );

    // Act
    await usuario.type(campoDoNome(), 'Cachorro{Enter}');
    await usuario.type(campoDoNome(), '{Enter}');

    // Assert
    // A submissao implicita por Enter tambem nao ocorre quando o botao padrao do
    // formulario esta desabilitado: uma trava so, e nao duas que divergiriam.
    expect(espiao).toHaveBeenCalledTimes(1);

    await act(async () => {
      concluir(respostaJson(201, CRIADA));
    });
  });
});
