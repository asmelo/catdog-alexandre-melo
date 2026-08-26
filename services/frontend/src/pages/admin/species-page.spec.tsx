import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { SpeciesPage } from '~/pages/admin/species-page';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Specs da tela de especies inteira (`/admin/especies`) — a ORQUESTRACAO.
 *
 * O que se afirma aqui e o que nenhum spec de componente alcanca: quem chama a
 * API, o que acontece com a lista em cada desfecho e — sobretudo — o que
 * PERMANECE inalterado quando uma operacao falha.
 *
 * O `fetch` e espionado por cenario, e nao dublado o modulo `species-api`. Os
 * criterios cobram a AUSENCIA de requisicao (CT-23) e a PRESENCA de uma SEGUNDA
 * listagem (CT-20 / CT-27); as duas coisas sao afirmacoes sobre a saida de rede, e
 * so o espiao de `fetch` as observa sem intermediario.
 *
 * TRES CENARIOS DESTE ARQUIVO SAO DE CONCORRENCIA, e todos exigem PROMESSA RETIDA
 * EM VOO (`reter()`): um teste sequencial — disparar, esperar a resposta, disparar
 * de novo — passaria sem exercitar nada, porque a corrida so existe enquanto duas
 * operacoes coexistem.
 *
 * `userEvent` sempre, `fireEvent` nunca: metade das asserções e sobre ONDE O FOCO
 * ESTA, e `fireEvent.keyDown` nao move foco nenhum.
 */

const URL_DA_LISTA = '/api/species';

function especie(nome: string, id: string): Species {
  return {
    id,
    name: nome,
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  };
}

const CACHORRO = especie('Cachorro', 'id-cachorro');
const GATO = especie('Gato', 'id-gato');
const SAPO = especie('Sapo', 'id-sapo');

const CONFLITO = 'Já existe uma espécie com este nome.';
const NAO_ENCONTRADA = 'Espécie não encontrada.';
const EM_USO = 'Não é possível excluir esta espécie porque existem animais vinculados a ela.';

/* -------------------------------------------------------------------------- */
/*  Dublê de rede                                                             */
/* -------------------------------------------------------------------------- */

type Chamada = {
  readonly metodo: string;
  readonly url: string;
  readonly corpo: unknown;
};

type EspiaoDeFetch = jest.SpyInstance<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>;

type Manipulador = (chamada: Chamada) => Response | Promise<Response>;

function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

function listaDe(...especies: ReadonlyArray<Species>): Response {
  return respostaJson(200, { items: especies });
}

function semConteudo(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as Response;
}

function falha(status: number, code: string, message: string): Response {
  return respostaJson(status, { error: { code, message } });
}

/**
 * Uma resposta RETIDA EM VOO.
 *
 * E o instrumento das corridas: a promessa fica pendente ate o teste chamar
 * `concluir`, o que permite ter duas operacoes coexistindo e escolher a ORDEM em
 * que elas resolvem — que e justamente o que nenhuma sequencia normal produz.
 */
type EmVoo = {
  readonly promessa: Promise<Response>;
  readonly concluir: (resposta: Response) => Promise<void>;
};

function reter(): EmVoo {
  let liberar: (resposta: Response) => void = () => undefined;

  const promessa = new Promise<Response>((resolver) => {
    liberar = resolver;
  });

  return {
    promessa,
    /**
     * A resolucao muda estado do React: fora de `act` ela produziria o aviso de
     * atualizacao nao envolvida e — pior — a asserção seguinte leria a arvore
     * antes do commit.
     *
     * O TURNO DE MACROTAREFA NAO E PARANOIA. Liberar a promessa nao conclui a
     * operacao: entre o `fetch` e o `setState` da tela ha uma CADEIA de `await`
     * (o `executarFetch`, o `resposta.json()` do `http-client`, o `catch` da
     * pagina e, nos ramos de `404`, o `recarregar` que dispara outra listagem).
     * Cada elo e uma microtarefa nova, e um `act` que so libera a promessa
     * devolve o controle antes de a cadeia terminar — os `setState` do fim dela
     * caem fora, e voltam os avisos de `act` que esta task existe para eliminar.
     * Um `setTimeout(0)` DENTRO do `act` cede o turno e drena a fila inteira.
     */
    concluir: async (resposta: Response) => {
      await act(async () => {
        liberar(resposta);

        await new Promise((resolver) => {
          setTimeout(resolver, 0);
        });
      });
    },
  };
}

/**
 * Instala o dublê de `fetch` por VERBO.
 *
 * Um verbo sem manipulador LANCA com o nome da requisicao: um teste que dispare
 * uma chamada que ele nao previu falha apontando qual foi, em vez de receber
 * `undefined` e quebrar tres linhas adiante.
 */
function instalarRede(mapa: Readonly<Partial<Record<string, Manipulador>>>): EspiaoDeFetch {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const opcoes = init ?? {};
      const corpo = opcoes.body;
      const chamada: Chamada = {
        metodo: opcoes.method ?? 'GET',
        url: String(entrada),
        corpo: typeof corpo === 'string' ? (JSON.parse(corpo) as unknown) : undefined,
      };

      const manipulador = mapa[chamada.metodo];

      if (manipulador === undefined) {
        throw new Error(`Requisicao nao prevista neste teste: ${chamada.metodo} ${chamada.url}`);
      }

      return manipulador(chamada);
    });
}

/** Uma sequencia de respostas para o mesmo verbo, na ordem das chamadas. */
function emSequencia(...respostas: ReadonlyArray<Response | Promise<Response>>): Manipulador {
  let proxima = 0;

  return () => {
    const resposta = respostas[proxima];

    proxima += 1;

    if (resposta === undefined) {
      throw new Error(`Chamada ${proxima} nao prevista: a sequencia tem ${respostas.length}.`);
    }

    return resposta;
  };
}

function chamadasDe(espiao: EspiaoDeFetch, metodo: string): ReadonlyArray<Chamada> {
  return espiao.mock.calls.map(([entrada, init]) => ({
    metodo: init?.method ?? 'GET',
    url: String(entrada),
    corpo: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
  })).filter((chamada) => chamada.metodo === metodo);
}

/* -------------------------------------------------------------------------- */
/*  Consultas a tela                                                          */
/* -------------------------------------------------------------------------- */

function titulo(): HTMLElement {
  return screen.getByRole('heading', { level: 1, name: MESSAGES.SPECIES.PAGE_TITLE });
}

function focado(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/**
 * O campo de criacao, alcancado pelo FORMULARIO que ele compartilha com o botao
 * "Criar".
 *
 * Nao por `id`: o rotulo do campo de criacao e o mesmo do campo de edicao em
 * linha (`Nome de espécie`), entao `getByLabelText` encontraria dois elementos
 * enquanto uma linha estiver em edicao. O formulario e a fronteira que o usuario
 * ve — campo e botao de acao juntos.
 */
function campoDeCriacao(): HTMLElement {
  const botao = screen.getByRole('button', { name: /^(Criar|Aguarde…)$/u });
  const formulario = botao.closest('form');

  if (formulario === null) {
    throw new Error('O botao "Criar" nao esta dentro de um <form>.');
  }

  return within(formulario).getByRole('textbox');
}

/** A linha (o `<li>`) que esta em modo de EDICAO. So existe uma por vez, por desenho. */
function linhaEmEdicao(): HTMLElement {
  const lista = screen.getByRole('list', { name: MESSAGES.SPECIES.LIST_LABEL });
  const linha = within(lista)
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('textbox') !== null);

  if (linha === undefined) {
    throw new Error('Nenhuma linha da lista esta em modo de edicao.');
  }

  return linha;
}

function campoDaEdicao(): HTMLElement {
  return within(linhaEmEdicao()).getByRole('textbox');
}

/**
 * Os nomes exibidos na lista, NA ORDEM DO DOM.
 *
 * Lidos do nome acessivel do lapis de cada linha, que e a ordem que o leitor de
 * tela percorre — e nao de um seletor de CSS sobre a marcacao interna da linha.
 */
function nomesNaLista(): ReadonlyArray<string> {
  const prefixo = `${MESSAGES.SPECIES.EDIT_ACTION} `;

  return screen
    .getAllByRole('button', { name: new RegExp(`^${prefixo}`, 'u') })
    .map((botao) => (botao.textContent ?? '').slice(prefixo.length));
}

function lapisDe(nome: string): HTMLElement {
  return screen.getByRole('button', { name: `${MESSAGES.SPECIES.EDIT_ACTION} ${nome}` });
}

function lixeiraDe(nome: string): HTMLElement {
  return screen.getByRole('button', { name: `${MESSAGES.SPECIES.DELETE_ACTION} ${nome}` });
}

function salvarDaLinha(): HTMLElement {
  return within(linhaEmEdicao()).getByRole('button', { name: /^(Salvar|Aguarde…)$/u });
}

/** Espera a listagem inicial terminar: a lista, o estado vazio ou o de erro. */
async function aguardarCargaInicial(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: MESSAGES.SPECIES.LOADING_LABEL })).toBeNull();
  });
}

describe('SpeciesPage — listagem', () => {
  it('CT-13: os nomes aparecem no DOM na ordem em que a listagem os entrega', async () => {
    // Arrange
    instalarRede({ GET: () => listaDe(CACHORRO, GATO, SAPO) });

    // Act
    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Assert
    // A lista chega ORDENADA do backend (RN-11). A tela nao pode reembaralhar.
    expect(nomesNaLista()).toEqual(['Cachorro', 'Gato', 'Sapo']);
  });

  it('CT-14: a ordenacao ignora a caixa das letras — "Cachorro" antes de "gato"', async () => {
    // Arrange
    instalarRede({ GET: () => listaDe(CACHORRO, especie('gato', 'id-gato-minusculo')) });

    // Act
    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Assert
    expect(nomesNaLista()).toEqual(['Cachorro', 'gato']);
  });

  it('CT-11: "Réptil" e "Reptil" coexistem na lista — a diferenca de acento basta (RN-05)', async () => {
    // Arrange
    instalarRede({
      GET: () => listaDe(especie('Reptil', 'id-reptil'), especie('Réptil', 'id-reptil-acento')),
    });

    // Act
    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Assert
    expect(nomesNaLista()).toEqual(['Reptil', 'Réptil']);
    expect(screen.getByText('Reptil')).toBeInTheDocument();
    expect(screen.getByText('Réptil')).toBeInTheDocument();
  });

  it('CT-15: o cadastro vazio exibe a orientacao e MANTEM a linha de criacao', async () => {
    // Arrange
    instalarRede({ GET: () => listaDe() });

    // Act
    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Assert
    expect(screen.getByText(MESSAGES.SPECIES.EMPTY_LIST)).toBeInTheDocument();
    // Quem abre a tela com o cadastro vazio precisa poder cadastrar a primeira
    // especie sem esperar (HU-03 cenarios 3 e 4).
    expect(campoDeCriacao()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MESSAGES.SPECIES.CREATE_BUTTON })).toBeEnabled();
  });

  it('a espera pela listagem e anunciada como regiao viva educada', async () => {
    // Arrange
    const listagem = reter();

    instalarRede({ GET: () => listagem.promessa });

    // Act
    render(<SpeciesPage />);

    // Assert
    // `role="status"` e nao `role="alert"`: carregamento e informacao educada, e o
    // papel assertivo interromperia o leitor para anunciar "Carregando".
    expect(
      screen.getByRole('status', { name: MESSAGES.SPECIES.LOADING_LABEL }),
    ).toBeInTheDocument();

    await listagem.concluir(listaDe(GATO));

    expect(nomesNaLista()).toEqual(['Gato']);
  });

  it('CT-36: a falha de carga oferece nova tentativa, e o botao REFAZ a chamada', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: emSequencia(falha(500, 'UNEXPECTED_ERROR', 'Erro'), listaDe(GATO)),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    expect(screen.getByText(MESSAGES.SPECIES.LOAD_ERROR)).toBeInTheDocument();

    // Act
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.RETRY_BUTTON }));

    // Assert
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Gato']);
    });
    // Um estado de erro sem saida deixaria ao usuario recarregar a pagina por
    // conta propria ou concluir que o sistema quebrou.
    expect(chamadasDe(espiao, 'GET')).toHaveLength(2);
    expect(screen.queryByText(MESSAGES.SPECIES.LOAD_ERROR)).toBeNull();
  });

  it('a falha de carga VENCE a lista vazia: a tela nao afirma cadastro vazio sem ter conseguido consulta-lo', async () => {
    // Arrange
    instalarRede({ GET: () => falha(503, 'UNEXPECTED_ERROR', 'Indisponível') });

    // Act
    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Assert
    expect(screen.getByText(MESSAGES.SPECIES.LOAD_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.SPECIES.EMPTY_LIST)).toBeNull();
  });

  it('montada em StrictMode, a tela chama GET /api/species EXATAMENTE uma vez', async () => {
    // Arrange
    const espiao = instalarRede({ GET: () => listaDe(GATO) });

    // Act
    render(
      <StrictMode>
        <SpeciesPage />
      </StrictMode>,
    );
    await aguardarCargaInicial();

    // Assert
    // A dupla montagem do React 18 em desenvolvimento dispararia a listagem duas
    // vezes sem a trava de mount do hook.
    expect(chamadasDe(espiao, 'GET')).toHaveLength(1);
    expect(chamadasDe(espiao, 'GET')[0]?.url).toBe(URL_DA_LISTA);
  });
});

describe('SpeciesPage — criacao', () => {
  it('CT-01: a especie criada entra na lista sem recarregar, e o sucesso sai em role="status"', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(GATO),
      POST: () => respostaJson(201, CACHORRO),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.type(campoDeCriacao(), 'Cachorro{Enter}');

    // Assert
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Cachorro', 'Gato']);
    });
    // RNF-09: desfecho consumado vai no anuncio EDUCADO, na proxima pausa do
    // leitor de tela.
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.CREATE_SUCCESS);
    // NENHUMA escrita refaz a listagem: uma ida extra ao servidor por escrita
    // dobraria o custo de uma tela de dezenas de registros (RNF-05).
    expect(chamadasDe(espiao, 'GET')).toHaveLength(1);
  });

  it('CT-13: a especie criada entra na posicao ALFABETICA por LOCALE, e nao por ordem binaria', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const agil = especie('Ágil', 'id-agil');

    instalarRede({
      GET: () =>
        listaDe(
          especie('Cão', 'id-cao'),
          especie('Cavalo', 'id-cavalo'),
          GATO,
          especie('Zebra', 'id-zebra'),
        ),
      POST: () => respostaJson(201, agil),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.type(campoDeCriacao(), 'Ágil{Enter}');

    // Assert
    /**
     * O PAR ACENTUADO E O PONTO. Com nomes ASCII os dois criterios coincidem e o
     * teste ficaria verde com a implementacao errada — foi essa coincidencia que
     * deixou uma premissa errada sobreviver a duas revisoes no backend.
     *
     * A ordenacao do servidor (`ORDER BY name_normalized`, PostgreSQL 17.6 com
     * provedor ICU e `en_US.UTF-8`) devolve `Ágil, Cão, Cavalo, Gato, Zebra`. A
     * comparacao binaria devolveria `Cavalo, Cão, Gato, Zebra, Ágil`, jogando
     * todo nome acentuado para o fim — e a posicao do item recem-criado saltaria
     * no proximo recarregamento (CA-04).
     */
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Ágil', 'Cão', 'Cavalo', 'Gato', 'Zebra']);
    });
    expect('Zebra'.localeCompare('Ágil', 'pt-BR')).toBeGreaterThan(0);
  });

  it('o erro de criacao sai em role="alert", e nao em role="status"', async () => {
    // Arrange
    const usuario = userEvent.setup();

    instalarRede({
      GET: () => listaDe(GATO),
      POST: () => falha(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.'),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.type(campoDeCriacao(), 'Cachorro{Enter}');

    // Assert
    /**
     * MUDANCA DE PAPEL ARIA registrada pela TASK-FRONTEND-010: este erro saia
     * como `role="status"` / `polite` na TASK-FRONTEND-009 e passou a sair como
     * `role="alert"`. Um erro que interrompe o trabalho e exige decisao nao e um
     * aviso educado.
     */
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.FORM.UNEXPECTED_ERROR);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('SpeciesPage — renomeacao', () => {
  it('CT-16: o nome e atualizado na lista, o identificador NAO muda e o sucesso e anunciado', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(GATO, SAPO),
      PATCH: () => respostaJson(200, { ...SAPO, name: 'Perereca' }),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Sapo'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}Perereca{Enter}');

    // Assert
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Gato', 'Perereca']);
    });
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.UPDATE_SUCCESS);
    // O `PATCH` vai para o recurso da propria especie: renomear e alteracao
    // parcial, e o identificador e o mesmo antes e depois.
    expect(chamadasDe(espiao, 'PATCH')[0]?.url).toBe(`${URL_DA_LISTA}/${SAPO.id}`);
    expect(chamadasDe(espiao, 'PATCH')[0]?.corpo).toEqual({ name: 'Perereca' });
  });

  it('CT-17: ajustar apenas a caixa das letras e aceito, sem erro de conflito (RN-07)', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const minusculo = especie('gato', 'id-gato');

    instalarRede({
      GET: () => listaDe(minusculo),
      PATCH: () => respostaJson(200, { ...minusculo, name: 'Gato' }),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('gato'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}Gato{Enter}');

    // Assert
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Gato']);
    });
    expect(screen.queryByText(CONFLITO)).toBeNull();
  });

  it('CT-18: o 409 marca o CAMPO da linha, que PERMANECE em edicao, e nenhum dos dois nomes muda', async () => {
    // Arrange
    const usuario = userEvent.setup();

    instalarRede({
      GET: () => listaDe(GATO, SAPO),
      PATCH: () => falha(409, 'SPECIES_NAME_ALREADY_EXISTS', CONFLITO),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Sapo'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}gato{Enter}');

    // Assert
    expect(await within(linhaEmEdicao()).findByText(CONFLITO)).toBeInTheDocument();
    // NENHUM registro muda na lista: o tratador de conflito nao toca a colecao.
    expect(campoDaEdicao()).toHaveValue('gato');
    expect(screen.getByText('Gato')).toBeInTheDocument();
    expect(salvarDaLinha()).toBeEnabled();
  });

  it('CT-18: o erro de conflito da linha A NAO acompanha o usuario para a linha B', async () => {
    // Arrange
    const usuario = userEvent.setup();

    instalarRede({
      GET: () => listaDe(GATO, SAPO),
      PATCH: () => falha(409, 'SPECIES_NAME_ALREADY_EXISTS', CONFLITO),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Sapo'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}gato{Enter}');

    // O conflito precisa ter POUSADO antes da troca — sem isso o teste ficaria
    // verde por nunca ter havido erro nenhum para carregar adiante.
    expect(await within(linhaEmEdicao()).findByText(CONFLITO)).toBeInTheDocument();

    await usuario.click(lapisDe('Gato'));

    // Assert
    /**
     * O erro pertence A SESSAO DE EDICAO que o produziu, e nao a tela. Sem a
     * limpeza no ponto unico de troca de sessao, a frase reapareceria sob o campo
     * de "Gato" — acusando de conflito um nome que nem chegou a ser enviado, e
     * apontando para a especie errada.
     */
    expect(within(linhaEmEdicao()).queryByText(CONFLITO)).toBeNull();
    expect(screen.queryByText(CONFLITO)).toBeNull();
    expect(campoDaEdicao()).toHaveValue('Gato');
  });

  it('CT-19: campo vazio nao produz requisicao alguma e a linha continua em edicao', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({ GET: () => listaDe(GATO) });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Enter}');

    // Assert
    expect(await screen.findByText(MESSAGES.VALIDATION.FIELD_REQUIRED)).toBeInTheDocument();
    expect(chamadasDe(espiao, 'PATCH')).toEqual([]);
    expect(campoDaEdicao()).toBeInTheDocument();
  });

  it('CT-21: cancelar restaura o nome original e nao grava nada', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({ GET: () => listaDe(GATO) });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('Nome descartado');
    await usuario.click(within(linhaEmEdicao()).getByRole('button', { name: 'Cancelar' }));

    // Assert
    expect(nomesNaLista()).toEqual(['Gato']);
    expect(chamadasDe(espiao, 'PATCH')).toEqual([]);
    // O rascunho desmonta junto com o formulario da linha: reabrir a edicao traz
    // o nome atual, e nao o texto descartado.
    await usuario.click(lapisDe('Gato'));
    expect(campoDaEdicao()).toHaveValue('Gato');
  });

  it('CT-20: o 404 sai da edicao, avisa em role="alert", RECARREGA a lista e devolve o foco ao <h1>', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const recarga = reter();
    const espiao = instalarRede({
      // A SEGUNDA listagem fica RETIDA de proposito: com a lista recarregada, o
      // efeito de devolucao de foco do `SpeciesRow` encontraria um lapis para
      // focar e mascararia a ausencia da devolucao ao titulo. Retida, sobram
      // exatamente dois desfechos observaveis — o `<h1>` (correto) ou o <body>.
      GET: emSequencia(listaDe(GATO), recarga.promessa),
      PATCH: () => falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}Ó{Enter}');

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(NAO_ENCONTRADA);
    expect(chamadasDe(espiao, 'GET')).toHaveLength(2);
    expect(focado()).toBe(titulo());
    expect(focado()).not.toBe(document.body);
  });

  it('RNF-09: a renomeacao seguinte DESMONTA o aviso da anterior antes de partir', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const segundaGravacao = reter();

    instalarRede({
      GET: () => listaDe(GATO),
      PATCH: emSequencia(respostaJson(200, { ...GATO, name: 'Gata' }), segundaGravacao.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}a{Enter}');

    expect(await screen.findByText(MESSAGES.SPECIES.UPDATE_SUCCESS)).toBeInTheDocument();

    // A SEGUNDA gravacao fica RETIDA: a limpeza acontece na PARTIDA, e so uma
    // operacao em voo permite observar a janela entre a partida e o desfecho.
    await usuario.click(lapisDe('Gata'));
    await usuario.keyboard('{Backspace}o{Enter}');

    // Assert
    /**
     * A regiao viva e montada SOMENTE quando ha mensagem, e e a desmontagem que
     * devolve o anuncio na proxima operacao (RNF-09): reexibir o mesmo texto num
     * no que nunca saiu do DOM faz varios leitores de tela silenciarem o segundo
     * desfecho. A mesma garantia ja e afirmada para a criacao em
     * `species-create-form.spec.tsx`; aqui ela vale para a renomeacao.
     */
    expect(screen.queryByText(MESSAGES.SPECIES.UPDATE_SUCCESS)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    await segundaGravacao.concluir(respostaJson(200, { ...GATO, name: 'Gato' }));

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.UPDATE_SUCCESS);
  });
});

describe('SpeciesPage — exclusao', () => {
  it('CA-13: a lixeira apenas ABRE a confirmacao — nenhuma requisicao parte dela', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({ GET: () => listaDe(GATO) });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Gato'));

    // Assert
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAccessibleName(`${MESSAGES.SPECIES.DELETE_ACTION} ${GATO.name}`);
    // As aspas sao as CURVAS da tabela de mensagens da spec: o criterio compara o
    // texto caractere a caractere.
    expect(dialogo).toHaveAccessibleDescription(MESSAGES.SPECIES.deleteConfirmation(GATO.name));
    expect(chamadasDe(espiao, 'DELETE')).toEqual([]);
  });

  it('CT-22: confirmada, a especie sai da lista, o sucesso e anunciado e o foco vai ao <h1>', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(GATO, SAPO),
      DELETE: () => semConteudo(),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Sapo'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    // Assert
    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Gato']);
    });
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.DELETE_SUCCESS);
    expect(chamadasDe(espiao, 'DELETE')[0]?.url).toBe(`${URL_DA_LISTA}/${SAPO.id}`);
    /**
     * O `ConfirmDialog` devolve o foco a quem o abriu — e aqui esse elemento e a
     * lixeira da linha que acabou de sumir. `focus()` sobre no ja destacado e
     * no-op silencioso, entao sem a devolucao ao titulo o foco pararia no <body>.
     */
    expect(focado()).toBe(titulo());
  });

  it('CT-23: cancelar a confirmacao nao dispara requisicao e a especie PERMANECE', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({ GET: () => listaDe(GATO) });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Gato'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.CANCEL_BUTTON }));

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chamadasDe(espiao, 'DELETE')).toEqual([]);
    expect(nomesNaLista()).toEqual(['Gato']);
    // O foco volta a lixeira que abriu o dialogo, que sobreviveu a operacao.
    expect(focado()).toBe(lixeiraDe('Gato'));
  });

  it('CT-24: com animais vinculados, a mensagem aparece e a especie CONTINUA no DOM', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      DELETE: () => falha(409, 'SPECIES_IN_USE', EM_USO),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Gato'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    // Assert
    /**
     * O TESTE MAIS IMPORTANTE DO ARQUIVO (CA-14). A remocao da lista e SEMPRE
     * depois do `204`, nunca otimista: some-la da tela aqui contradiria o criterio
     * exatamente no caso que a feature existe para proteger.
     */
    expect(await screen.findByRole('alert')).toHaveTextContent(EM_USO);
    expect(nomesNaLista()).toEqual(['Cachorro', 'Gato']);
    expect(lixeiraDe('Gato')).toBeInTheDocument();
    // A tela nao recarrega: nada mudou no servidor.
    expect(chamadasDe(espiao, 'GET')).toHaveLength(1);
    // O dialogo FECHA: a mensagem vive na pagina, atras da sobreposicao.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CT-27: excluir especie inexistente avisa, RECARREGA a lista e devolve o foco ao <h1>', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const recarga = reter();
    const espiao = instalarRede({
      // Retida pela mesma razao do CT-20: sem isso a lista recarregada devolveria
      // um lapis para o efeito do `SpeciesRow` focar, e a asserção sobre o titulo
      // deixaria de distinguir o acerto do erro.
      GET: emSequencia(listaDe(GATO), recarga.promessa),
      DELETE: () => falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Gato'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(NAO_ENCONTRADA);
    expect(chamadasDe(espiao, 'GET')).toHaveLength(2);
    expect(focado()).toBe(titulo());
    expect(focado()).not.toBe(document.body);
  });

  it('RNF-09: a exclusao seguinte DESMONTA o aviso da anterior antes de partir', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const segundaExclusao = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      DELETE: emSequencia(semConteudo(), segundaExclusao.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Cachorro'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    expect(await screen.findByText(MESSAGES.SPECIES.DELETE_SUCCESS)).toBeInTheDocument();

    // A SEGUNDA exclusao fica RETIDA: e a janela entre a partida e o desfecho que
    // torna a limpeza observavel. Duas exclusoes concluidas em sequencia deixariam
    // o mesmo texto no lugar e o teste ficaria verde com a falha presente.
    await usuario.click(lixeiraDe('Gato'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    // Assert
    // Mesma razao do gemeo da renomeacao: sem a desmontagem, o segundo "Espécie
    // excluída com sucesso." pousa num no que nunca saiu do DOM e deixa de ser
    // anunciado (RNF-09).
    expect(screen.queryByText(MESSAGES.SPECIES.DELETE_SUCCESS)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    await segundaExclusao.concluir(semConteudo());

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.DELETE_SUCCESS);
    // As duas especies sairam: a lista cede lugar a orientacao de cadastro vazio.
    expect(screen.getByText(MESSAGES.SPECIES.EMPTY_LIST)).toBeInTheDocument();
  });
});

describe('SpeciesPage — concorrencia entre operacoes', () => {
  it('CT-18: o 409 de uma gravacao ABANDONADA nao pousa sob o campo da linha nova', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacao = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      PATCH: () => gravacao.promessa,
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act — `PATCH` de "Cachorro" fica EM VOO; o usuario passa para "Gato" e
    // digita um rascunho. So entao a resposta chega.
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}inho');

    await gravacao.concluir(falha(409, 'SPECIES_NAME_ALREADY_EXISTS', CONFLITO));

    // Assert
    /**
     * Insistir no `erroDaLinha` faria a frase aparecer sob o campo de OUTRA
     * especie, acusando de conflito um nome que nem chegou a ser enviado. Sobra o
     * aviso da PAGINA, que nao pertence a linha nenhuma — e silenciar nao e
     * alternativa: a renomeacao falhou de verdade (RNF-09).
     */
    expect(within(linhaEmEdicao()).queryByText(CONFLITO)).toBeNull();
    expect(campoDaEdicao()).not.toHaveAttribute('aria-invalid');
    expect(campoDaEdicao()).toHaveValue('Gatinho');
    expect(screen.getByRole('alert')).toHaveTextContent(CONFLITO);
  });

  it('CT-16: o sucesso TARDIO de outra linha nao expulsa da edicao a linha atual nem descarta o rascunho', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacao = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      PATCH: () => gravacao.promessa,
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}inho');

    await gravacao.concluir(respostaJson(200, { ...CACHORRO, name: 'Cachorra' }));

    // Assert
    /**
     * O efeito de OPERACAO sobrevive a morte da sessao — o servidor GRAVOU, e o
     * retrato tem de refletir isso —, mas o efeito de SESSAO nao: um sucesso
     * tardio que chamasse `trocarEdicao(null)` fecharia a linha que o usuario
     * abriu DEPOIS dele e jogaria fora o rascunho ja digitado nela.
     */
    expect(campoDaEdicao()).toHaveValue('Gatinho');
    expect(screen.getByText('Cachorra')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.UPDATE_SUCCESS);
  });

  it('CA-21: com um PATCH em voo, o dialogo de exclusao de OUTRA linha abre utilizavel', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacao = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      PATCH: () => gravacao.promessa,
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lixeiraDe('Gato'));

    // Assert
    /**
     * Com uma bandeira UNICA de "operacao em andamento", o `PATCH` de outra linha
     * abria este dialogo com os dois botoes desabilitados — e, como o
     * `ConfirmDialog` recusa o `Escape` enquanto `isSubmitting`, sem NENHUMA
     * saida: armadilha de teclado (SC 2.1.2 nivel A) contra o CA-21/RNF-06. Sem
     * `timeout` no cliente HTTP, a armadilha seria ilimitada.
     */
    const dialogo = screen.getByRole('dialog');

    expect(within(dialogo).getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION })).toBeEnabled();
    expect(within(dialogo).getByRole('button', { name: MESSAGES.SPECIES.CANCEL_BUTTON })).toBeEnabled();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CA-21: com o dialogo de exclusao ABERTO, o 404 de uma renomeacao nao rouba o foco do modal', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacao = reter();
    const recarga = reter();

    instalarRede({
      // A recarga do ramo de 404 fica RETIDA pela mesma razao do CT-20: uma lista
      // reentregue devolveria um lapis para o efeito do `SpeciesRow` focar e a
      // asserção sobre o foco deixaria de distinguir o acerto do erro.
      GET: emSequencia(listaDe(CACHORRO, GATO), recarga.promessa),
      PATCH: () => gravacao.promessa,
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act — as duas coisas precisam COEXISTIR: uma renomeacao em voo e o dialogo
    // de exclusao de OUTRA linha ja aberto. E so nesse arranjo que o desfecho da
    // primeira alcanca o foco que pertence ao segundo.
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lixeiraDe('Gato'));

    await gravacao.concluir(falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA));

    // Assert
    /**
     * O ramo de 404 devolve o foco ao `<h1>` porque `recarregar` desmonta a
     * `DataList` inteira no mesmo lote — mas o `<h1>` vive FORA da sobreposicao
     * `aria-modal`, e o tratador de `Escape` do `ConfirmDialog` vive NELA. Puxar o
     * foco para o titulo com o dialogo montado tiraria o teclado de dentro do
     * modal, e o `Escape` — que sobe a partir do elemento FOCADO — deixaria de
     * chegar ao tratador: armadilha de teclado (SC 2.1.2 nivel A) sobre a mesma
     * feature que o CA-21 protege.
     */
    const dialogo = screen.getByRole('dialog');

    expect(dialogo.contains(focado())).toBe(true);
    expect(focado()).not.toBe(titulo());

    // A prova de que o foco continua SERVINDO: o `Escape` ainda fecha o dialogo.
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CT-16: entre duas gravacoes da MESMA especie, a mais VELHA nao sobrescreve a mais nova', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const primeira = reter();
    const segunda = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      PATCH: emSequencia(primeira.promessa, segunda.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act — duas gravacoes de "Gato" partem da tela. A troca de linha no meio e o
    // que devolve a linha ao estado utilizavel enquanto a primeira ainda esta em
    // voo; sem ela a segunda gravacao nao teria como sair.
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}Anta{Enter}');
    await usuario.click(lapisDe('Cachorro'));
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}Zebra{Enter}');

    // As respostas voltam FORA DE ORDEM: a segunda primeiro.
    await segunda.concluir(respostaJson(200, { ...GATO, name: 'Zebra' }));
    await primeira.concluir(respostaJson(200, { ...GATO, name: 'Anta' }));

    // Assert
    /**
     * A sequencia de SESSAO nao separa este caso (as duas gravacoes podem sair da
     * mesma abertura da linha): quem decide e a sequencia de ESCRITA, por especie.
     * Aplicar sempre deixaria a tela em "Anta" com o servidor em "Zebra".
     */
    expect(nomesNaLista()).toEqual(['Cachorro', 'Zebra']);
    expect(screen.queryByText('Anta')).toBeNull();
  });

  it('CT-35: o `finally` de uma gravacao OBSOLETA nao solta os botoes da gravacao ainda em voo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const primeira = reter();
    const segunda = reter();

    instalarRede({
      GET: () => listaDe(CACHORRO, GATO),
      PATCH: emSequencia(primeira.promessa, segunda.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}Anta{Enter}');
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');

    expect(salvarDaLinha()).toBeDisabled();

    // A gravacao ANTIGA — a de "Gato" — resolve por ultimo.
    await primeira.concluir(respostaJson(200, { ...GATO, name: 'Anta' }));

    // Assert
    /**
     * ESTE E O TESTE QUE PROTEGE A LOGICA DE VIRAR UM `setSequenciaEmGravacao(null)`
     * CEGO numa refatoracao futura: limpar sem conferir a sequencia soltaria
     * salvar e cancelar de uma OUTRA gravacao que continua em voo, e o usuario
     * poderia disparar uma segunda escrita sobre uma requisicao pendente.
     */
    expect(salvarDaLinha()).toBeDisabled();
    expect(within(linhaEmEdicao()).getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await segunda.concluir(respostaJson(200, { ...CACHORRO, name: 'Cachorra' }));
  });
});

describe('SpeciesPage — percurso completo por teclado', () => {
  it('CT-37: criar, editar, salvar, cancelar, excluir e confirmar SEM nenhum clique de mouse', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(GATO),
      POST: () => respostaJson(201, CACHORRO),
      PATCH: () => respostaJson(200, { ...CACHORRO, name: 'Cachorra' }),
      DELETE: () => semConteudo(),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act & Assert — cada passo afirma ONDE o foco esta, o que faz deste teste
    // tambem a documentacao da ordem de tabulacao da tela.

    // 1. CRIAR: o campo de criacao e o primeiro focavel da pagina (o `<h1>` tem
    //    `tabIndex={-1}` e nao entra na ordem).
    await usuario.tab();
    expect(focado()).toBe(campoDeCriacao());

    await usuario.keyboard('Cachorro{Enter}');

    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Cachorro', 'Gato']);
    });
    // O foco volta ao campo, para cadastrar varias especies em sequencia.
    expect(focado()).toBe(campoDeCriacao());

    // 2. EDITAR: campo -> botao "Criar" -> lapis da primeira linha.
    await usuario.tab();
    expect(focado()).toBe(screen.getByRole('button', { name: MESSAGES.SPECIES.CREATE_BUTTON }));

    await usuario.tab();
    expect(focado()).toBe(lapisDe('Cachorro'));

    await usuario.keyboard('{Enter}');
    expect(focado()).toBe(campoDaEdicao());

    // 3. SALVAR pelo Enter dentro do campo.
    await usuario.keyboard('{Backspace}a{Enter}');

    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Cachorra', 'Gato']);
    });
    // Ao sair da edicao o campo desmonta: sem a devolucao, o foco cairia no
    // <body> e a proxima tabulacao recomecaria do topo da pagina.
    expect(focado()).toBe(lapisDe('Cachorra'));

    // 4. CANCELAR por Escape, de volta a mesma linha.
    await usuario.keyboard('{Enter}');
    expect(focado()).toBe(campoDaEdicao());

    await usuario.keyboard('{Escape}');
    expect(focado()).toBe(lapisDe('Cachorra'));

    // 5. EXCLUIR: lapis -> lixeira da mesma linha.
    await usuario.tab();
    expect(focado()).toBe(lixeiraDe('Cachorra'));

    await usuario.keyboard('{Enter}');
    // O dialogo abre com o foco no confirmar, porque e para isso que ele existe.
    expect(focado()).toBe(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: MESSAGES.SPECIES.DELETE_ACTION,
      }),
    );

    // 6. CONFIRMAR.
    await usuario.keyboard('{Enter}');

    await waitFor(() => {
      expect(nomesNaLista()).toEqual(['Gato']);
    });

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.SPECIES.DELETE_SUCCESS);
    expect(focado()).toBe(titulo());
    // As quatro operacoes saíram de fato para a rede: uma listagem, uma criacao,
    // uma renomeacao e uma exclusao.
    expect(chamadasDe(espiao, 'POST')).toHaveLength(1);
    expect(chamadasDe(espiao, 'PATCH')).toHaveLength(1);
    expect(chamadasDe(espiao, 'DELETE')).toHaveLength(1);
  });
});

describe('SpeciesPage — sequenciamento das listagens', () => {
  it('CT-01: a especie criada durante uma listagem EM VOO sobrevive ao retrato do servidor', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const listagem = reter();

    instalarRede({
      GET: () => listagem.promessa,
      POST: () => respostaJson(201, CACHORRO),
    });

    render(<SpeciesPage />);

    // Act — a criacao conclui ANTES da listagem, que partiu primeiro e ainda nao
    // voltou. O retrato que ela traz e ANTERIOR a criacao.
    await usuario.type(campoDeCriacao(), 'Cachorro{Enter}');
    await listagem.concluir(listaDe(GATO));

    // Assert
    /**
     * O contador de listagens sozinho NAO resolve este caso: quem envelhece a
     * resposta nao e uma listagem mais nova, e sim um `POST` que concluiu no meio
     * do voo — a listagem continua sendo a mais recente e passaria pelo teste de
     * identidade, sobrescrevendo com um retrato anterior a criacao. Por isso as
     * escritas locais do intervalo sao REAPLICADAS por cima de `resposta.items`:
     * descartar a resposta inteira tambem salvaria "Cachorro", mas jogaria fora
     * todas as outras especies que a listagem trouxe.
     */
    expect(nomesNaLista()).toEqual(['Cachorro', 'Gato']);
  });

  it('CT-36: uma listagem ULTRAPASSADA por outra e descartada, e nao aplicada por chegar depois', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacaoDeCachorro = reter();
    const gravacaoDeGato = reter();
    const recarga = reter();
    const recargaFinal = reter();

    instalarRede({
      GET: emSequencia(listaDe(CACHORRO, GATO), recarga.promessa, recargaFinal.promessa),
      PATCH: emSequencia(gravacaoDeCachorro.promessa, gravacaoDeGato.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act — as DUAS gravacoes precisam estar em voo ao mesmo tempo: e a unica
    // forma de os dois `404` dispararem duas recargas que coexistam.
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}inho{Enter}');

    await gravacaoDeCachorro.concluir(falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA));
    await gravacaoDeGato.concluir(falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA));

    /**
     * A ORDEM DAS DUAS RESOLUCOES E O TESTE. A listagem MAIS NOVA chega primeiro e
     * a mais velha depois — o unico arranjo em que o descarte importa. Resolvidas
     * na ordem inversa (velha antes, nova depois), a nova sobrescreveria a velha
     * de qualquer jeito e o estado final seria o mesmo COM e SEM o numero de
     * sequencia: o teste ficaria verde sem exercitar nada. (Verificado por mutacao.)
     */
    await recargaFinal.concluir(listaDe(especie('Retrato atual', 'id-atual')));
    await recarga.concluir(listaDe(especie('Retrato antigo', 'id-antigo')));

    // Assert
    // Sem o numero de sequencia, duas listagens em voo terminariam pela ordem de
    // chegada da REDE, e nao pela ordem em que foram pedidas.
    expect(nomesNaLista()).toEqual(['Retrato atual']);
    expect(screen.queryByText('Retrato antigo')).toBeNull();
  });

  it('CT-36: a FALHA de uma listagem ultrapassada nao joga a tela no estado de erro', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const gravacaoDeCachorro = reter();
    const gravacaoDeGato = reter();
    const recarga = reter();
    const recargaFinal = reter();

    instalarRede({
      GET: emSequencia(listaDe(CACHORRO, GATO), recarga.promessa, recargaFinal.promessa),
      PATCH: emSequencia(gravacaoDeCachorro.promessa, gravacaoDeGato.promessa),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Cachorro'));
    await usuario.keyboard('{Backspace}a{Enter}');
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}inho{Enter}');

    await gravacaoDeCachorro.concluir(falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA));
    await gravacaoDeGato.concluir(falha(404, 'SPECIES_NOT_FOUND', NAO_ENCONTRADA));

    // Mesma ordem do teste acima, e pela mesma razao: a nova chega primeiro e a
    // velha — que FALHOU — chega por ultimo.
    await recargaFinal.concluir(listaDe(GATO));
    await recarga.concluir(falha(500, 'UNEXPECTED_ERROR', 'Erro'));

    // Assert
    // Uma listagem ultrapassada e descartada INTEIRA — resposta E falha. Sem o
    // descarte simetrico, a falha da velha apagaria a lista que a nova ja trouxe e
    // a tela exibiria "Não foi possível carregar as espécies" sobre dado bom.
    expect(screen.queryByText(MESSAGES.SPECIES.LOAD_ERROR)).toBeNull();
    expect(nomesNaLista()).toEqual(['Gato']);
  });

  it('CT-01: a escrita local de um intervalo ANTERIOR nao reaparece sobre a listagem seguinte', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const primeiraListagem = reter();
    const segundaListagem = reter();

    instalarRede({
      GET: emSequencia(primeiraListagem.promessa, segundaListagem.promessa),
      POST: () => respostaJson(201, CACHORRO),
    });

    render(<SpeciesPage />);

    // Act — a criacao conclui com a primeira listagem ainda EM VOO, e essa
    // listagem FALHA. A escrita registrada para reaplicacao nao chega a ser
    // consumida por retrato nenhum: so o caminho de sucesso zera a lista na
    // chegada, e ele nao roda.
    await usuario.type(campoDeCriacao(), 'Cachorro{Enter}');
    await primeiraListagem.concluir(falha(500, 'UNEXPECTED_ERROR', 'Erro'));

    // A nova tentativa abre um intervalo NOVO — e e a PARTIDA dela que precisa
    // descartar a escrita pendente.
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.RETRY_BUTTON }));
    await segundaListagem.concluir(listaDe(GATO));

    // Assert
    /**
     * O retrato que a nova listagem traz e POSTERIOR a criacao e ja e a verdade do
     * servidor. Sem a zeragem na partida, a escrita do intervalo anterior voltaria
     * por cima dele e "Cachorro" reapareceria numa lista onde o servidor nao o tem
     * — a tela passaria a inventar registro em vez de refletir o cadastro, e o
     * defeito se acumularia a cada recarregamento.
     */
    expect(nomesNaLista()).toEqual(['Gato']);
    expect(screen.queryByText('Cachorro')).toBeNull();
  });
});

describe('SpeciesPage — desfechos residuais escolhidos pelo `code`', () => {
  it('CT-34: o VALIDATION_ERROR que reprova o IDENTIFICADOR cai na mensagem do envelope', async () => {
    // Arrange
    const usuario = userEvent.setup();

    instalarRede({
      GET: () => listaDe(GATO),
      PATCH: () =>
        respostaJson(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: [{ field: 'id', message: 'Identificador inválido.' }],
          },
        }),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}o{Enter}');

    // Assert
    // O `PATCH` tambem pode reprovar o `id`, e para esse caso NAO EXISTE campo na
    // tela: sobra a `message` do envelope, que ja vem pronta do servidor (CA-22).
    expect(await within(linhaEmEdicao()).findByText('Dados inválidos.')).toBeInTheDocument();
  });

  it('CT-18: na renomeacao, o VALIDATION_ERROR do CAMPO vence a mensagem do envelope', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const DO_CAMPO = 'O nome da espécie deve ter no máximo 60 caracteres.';
    const DO_ENVELOPE = 'Dados inválidos.';

    instalarRede({
      GET: () => listaDe(GATO),
      PATCH: () =>
        respostaJson(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: DO_ENVELOPE,
            details: [{ field: 'name', message: DO_CAMPO }],
          },
        }),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}o{Enter}');

    // Assert
    /**
     * O CT-34, gemeo deste, cobre o `details` que reprova o `id` — e para aquele
     * NAO existe campo na tela, entao sobra o envelope. Aqui existe: a mensagem
     * especifica e a unica que diz ao usuario o que corrigir, e o envelope
     * generico nao pode roubar o lugar dela. O fluxo de criacao ja afirma o
     * caminho analogo; sem esta, a precedencia so estava protegida de um lado.
     */
    expect(await within(linhaEmEdicao()).findByText(DO_CAMPO)).toBeInTheDocument();
    expect(screen.queryByText(DO_ENVELOPE)).toBeNull();
  });

  it('a renomeacao recusada por um `code` sem tratamento proprio cai no aviso generico', async () => {
    // Arrange
    const usuario = userEvent.setup();

    instalarRede({
      GET: () => listaDe(GATO),
      PATCH: () => falha(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.'),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lapisDe('Gato'));
    await usuario.keyboard('{Backspace}o{Enter}');

    // Assert
    // Ramificacao SEMPRE pelo `code`, nunca pelo `message` nem pelo `status`.
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.FORM.UNEXPECTED_ERROR);
    // A linha PERMANECE em edicao — o desfecho nao diz que a especie sumiu — e o
    // `finally` devolve os botoes ao estado utilizavel.
    expect(campoDaEdicao()).toHaveValue('Gato');
    expect(salvarDaLinha()).toBeEnabled();
  });

  it('a exclusao recusada por um `code` sem tratamento proprio tambem cai no aviso generico', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const espiao = instalarRede({
      GET: () => listaDe(GATO),
      DELETE: () => falha(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.'),
    });

    render(<SpeciesPage />);
    await aguardarCargaInicial();

    // Act
    await usuario.click(lixeiraDe('Gato'));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.SPECIES.DELETE_ACTION }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.FORM.UNEXPECTED_ERROR);
    // A especie PERMANECE: a remocao da lista so acontece depois do `204`.
    expect(nomesNaLista()).toEqual(['Gato']);
    // Nao e caso de recarregar: o desfecho nao diz que a especie sumiu.
    expect(chamadasDe(espiao, 'GET')).toHaveLength(1);
  });
});
