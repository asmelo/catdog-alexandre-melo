import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { App } from '~/App';
import { AuthContext } from '~/contexts/auth/auth-context';
import { AdminLayout } from '~/layouts/admin-layout';
import { ClientLayout } from '~/layouts/client-layout';
import { ADMIN_DEFAULT_PATH, ROUTE_PATHS } from '~/routes/route-paths';
import * as authApi from '~/services/api/auth-api';
import * as speciesApi from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

import {
  ID_DA_LOCALIZACAO,
  MonitorDeLocalizacao,
  USUARIO_ADMIN,
  USUARIO_CLIENTE,
  criarSessao,
  renderizarComSessao,
  type EstadoDublado,
  type SessaoDublada,
} from '../../tests/auth-harness';

/**
 * Specs do MAPA DE ROTAS montado, atravessando `App` -> `AppRoutes` -> guardas ->
 * layouts -> paginas.
 *
 * Por que a arvore inteira e nao cada guarda isolada: o comportamento que a spec
 * cobra e uma propriedade da HIERARQUIA, nao de um componente. `/admin/inexistente`
 * cair no login para um visitante sem sessao (e nao numa 404) depende de o
 * catch-all estar DENTRO da guarda; nenhum teste de unidade de `RoleRoute` ou de
 * `NotFoundPage` observaria isso. `role-route.spec.tsx` cobre a decisao da guarda;
 * este arquivo cobre a montagem.
 *
 * `auth-api` e dublado porque a arvore importa a tela de login e a de confirmacao,
 * que chamam a API — e nenhuma requisicao pode escapar (AC #2).
 *
 * `species-api` e dublado pelo mesmo motivo e por um SEGUNDO, que vale o
 * registro: `/admin` passou a renderizar a tela de especies, e ela dispara
 * `GET /api/species` no efeito de mount. Sem o dublê, a guarda de rede de
 * `tests/setup.ts` LANCA, a promessa rejeita numa microtarefa POSTERIOR ao corpo
 * sincrono do teste e o `setStatus('erro')` resultante cai fora de `act` — os
 * cinco avisos "An update to SpeciesPage inside a test was not wrapped in act(...)"
 * que a suite emitia. Eles SEMPRE pertenceram a este arquivo (a execucao isolada
 * dele os reproduz na integra) e nao a nenhuma interacao entre suites.
 */
jest.mock('~/services/api/auth-api');
jest.mock('~/services/api/species-api');

const apiDublada = jest.mocked(authApi);
const especiesDubladas = jest.mocked(speciesApi);

/**
 * Os dublês do modulo automockado devolvem `undefined`, e a tela de confirmacao
 * encadeia `.then()` sobre o retorno. Sem estas implementacoes o teste falharia em
 * `Cannot read properties of undefined (reading 'then')` — um erro do dublê, nao
 * do codigo sob teste.
 */
beforeEach(() => {
  /**
   * A LISTAGEM FICA RETIDA EM VOO, e a escolha nao e preguica — foi medida.
   *
   * `mockResolvedValue({ items: [] })` NAO resolve o problema: piora. Uma promessa
   * ja resolvida agenda o `.then` como microtarefa e as DUAS atualizacoes de
   * estado da resolucao (`setSpecies` e `setStatus('pronto')`) caem fora do `act`
   * do `render`, que e sincrono e nao drena microtarefas — de cinco avisos a
   * suite passa a DEZ (verificado). Fazer os testes existentes `await` tambem esta
   * fora de questao: sao a regressao obrigatoria da FEATURE-002 e o corpo deles
   * nao pode mudar.
   *
   * Uma promessa PENDENTE nao agenda continuacao nenhuma: a tela fica no estado de
   * carga, que e um retrato legitimo e deterministico. O que este arquivo afirma e
   * a MONTAGEM (rota, guarda, layout, titulo) — nada disso depende do conteudo da
   * lista, que e objeto de `species-page.spec.tsx`.
   */
  especiesDubladas.listSpecies.mockReturnValue(new Promise(() => undefined));
  apiDublada.confirmEmail.mockResolvedValue({ message: 'Conta confirmada! Faça login para continuar.' });
  apiDublada.resendConfirmation.mockResolvedValue({ message: 'Novo link enviado.' });
});

function renderizar(estado: EstadoDublado, rota: string): SessaoDublada {
  const sessao = criarSessao(estado);

  renderizarComSessao(<App />, { sessao: sessao.valor, rota });

  return sessao;
}

function rotaAtual(): string | null {
  return screen.getByTestId(ID_DA_LOCALIZACAO).textContent;
}

const AUTENTICADO_ADMIN: EstadoDublado = { status: 'authenticated', user: USUARIO_ADMIN };
const AUTENTICADO_CLIENTE: EstadoDublado = { status: 'authenticated', user: USUARIO_CLIENTE };
const ANONIMO: EstadoDublado = { status: 'anonymous', user: null };
const EM_BOOTSTRAP: EstadoDublado = { status: 'bootstrapping', user: null };

/** Texto que EXISTE somente no layout administrativo. E o marcador do CA-10. */
const MARCADOR_DE_ADMIN = 'Administrador';

describe('AppRoutes — area administrativa', () => {
  it('CT-09: admin autenticado em /admin cai na primeira area administrativa, dentro do layout', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    // `/admin` nao renderiza mais pagina propria (TASK-FRONTEND-007): ele
    // redireciona para `ADMIN_DEFAULT_PATH`. O destino do pos-login continua
    // sendo `/admin` — `homePathForRole` nao mudou —, e o que este teste observa
    // e que ele termina numa tela real, e nao em branco nem na 404.
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Espécies');
    expect(screen.getByText(MARCADOR_DE_ADMIN)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação administrativa' })).toBeInTheDocument();
    // O nome prova que a sessao exibida e a do usuario que autenticou, e nao uma
    // pagina estatica igual para qualquer um.
    expect(screen.getByText(USUARIO_ADMIN.name)).toBeInTheDocument();
  });

  it('o item ativo da navegacao administrativa e anunciado por aria-current', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    // `NavLink` marca `aria-current="page"` sozinho: a indicacao de "onde estou"
    // chega ao leitor de tela sem nenhum atributo escrito a mao, e o sublinhado e
    // apenas o reforco visual dela.
    expect(screen.getByRole('link', { name: 'Espécies' })).toHaveAttribute('aria-current', 'page');
  });

  it('o botao Sair do layout administrativo chama logout', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    await usuario.click(screen.getByRole('button', { name: 'Sair' }));

    expect(sessao.logout).toHaveBeenCalledTimes(1);
  });

  it('rota inexistente DENTRO de /admin cai na 404, sem sair da guarda', () => {
    renderizar(AUTENTICADO_ADMIN, `${ROUTE_PATHS.ADMIN_HOME}/inexistente`);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Página não encontrada');
  });

  it('rota inexistente dentro de /admin manda o VISITANTE ao login, e nao a 404', () => {
    /**
     * E a razao de o catch-all viver DENTRO da guarda. Sem ele, `/admin/inexistente`
     * cairia no `*` global e um visitante sem sessao veria a 404 — descobrindo que
     * a area existe — em vez de ser mandado ao login. A area TODA fica atras da
     * guarda, nao apenas a sua home.
     */
    renderizar(ANONIMO, `${ROUTE_PATHS.ADMIN_HOME}/inexistente`);

    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
    expect(screen.queryByText('Página não encontrada')).toBeNull();
  });
});

describe('AppRoutes — area do cliente', () => {
  it('CT-10: cliente autenticado em /minha-area ve a area dentro do layout de cliente', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.CLIENT_HOME);

    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Minha área');
    expect(screen.getByRole('navigation', { name: 'Navegação do cliente' })).toBeInTheDocument();
    expect(screen.getByText(`Você está autenticado como cliente, ${USUARIO_CLIENTE.name}.`)).toBeInTheDocument();
  });

  it('CA-10: NENHUM controle administrativo existe no DOM da area do cliente', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.CLIENT_HOME);

    /**
     * Ausencia NO DOM, e nao ocultacao. Um `{user.role === 'admin' && <LinkAdmin/>}`
     * seria equivalente na tela e falharia o criterio na intencao: bastaria um
     * defeito de estado para o controle aparecer. Aqui o codigo nao existe, e e
     * isso que estas asserções afirmam.
     */
    expect(screen.queryByText(MARCADOR_DE_ADMIN)).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navegação administrativa' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Espécies' })).toBeNull();

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toContain(ROUTE_PATHS.ADMIN_HOME);
    }
  });

  it('CT-16: cliente que abre /admin acaba na propria area, sem conteudo administrativo no DOM', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.ADMIN_HOME);

    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    expect(screen.queryByText('Espécies')).toBeNull();
    expect(screen.queryByText(MARCADOR_DE_ADMIN)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Minha área');
  });

  it('admin que abre /minha-area e devolvido a area administrativa: a guarda vale nos dois sentidos', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.CLIENT_HOME);

    // A guarda devolve a `homePathForRole('admin')`, que continua sendo `/admin`;
    // e `/admin` que redireciona dali para a primeira area administrativa.
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);
  });

  it('o botao Sair do layout de cliente chama logout', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.CLIENT_HOME);

    await usuario.click(screen.getByRole('button', { name: 'Sair' }));

    expect(sessao.logout).toHaveBeenCalledTimes(1);
  });
});

describe('Layouts — indicacao de item ativo', () => {
  /**
   * Os layouts sao montados DIRETAMENTE aqui, fora do mapa de rotas.
   *
   * E a forma de observar o item de navegacao INATIVO numa rota que o mapa nao
   * possui: montado numa rota arbitraria da area, nenhum dos `NavLink` casa, e o
   * `aria-current` precisa estar ausente.
   */
  it('o item de navegacao administrativo fica sem aria-current fora da propria rota', () => {
    const sessao = criarSessao(AUTENTICADO_ADMIN);

    renderizarComSessao(<AdminLayout />, { sessao: sessao.valor, rota: '/admin/outra-tela' });

    expect(screen.getByRole('link', { name: 'Espécies' })).not.toHaveAttribute('aria-current');
  });

  it('o item de navegacao do cliente fica sem aria-current fora da propria rota', () => {
    const sessao = criarSessao(AUTENTICADO_CLIENTE);

    renderizarComSessao(<ClientLayout />, { sessao: sessao.valor, rota: '/minha-area/outra-tela' });

    expect(screen.getByRole('link', { name: 'Minha área' })).not.toHaveAttribute('aria-current');
  });

  it('layout sem usuario no contexto nao imprime nome nenhum e nao lanca', () => {
    // Combinacao defensiva: `user` e `AuthUser | null` no contexto, e os layouts
    // nao usam `!` nem `?.` para nao afirmar o que o tipo nao garante.
    const sessao = criarSessao({ status: 'authenticated', user: null });

    renderizarComSessao(<AdminLayout />, { sessao: sessao.valor, rota: ROUTE_PATHS.ADMIN_HOME });

    expect(screen.getByText(MARCADOR_DE_ADMIN)).toBeInTheDocument();
    expect(screen.queryByText(USUARIO_ADMIN.name)).toBeNull();
  });
});

describe('AppRoutes — rotas publicas e exclusivas de visitante', () => {
  it('visitante em /login ve o formulario', () => {
    renderizar(ANONIMO, ROUTE_PATHS.LOGIN);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bem vindo!');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('autenticado em /login e mandado para a home da propria role', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.LOGIN);

    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    // Sem o splash do `PublicOnlyRoute`, quem recarrega COM sessao valida veria o
    // formulario de login aparecer e desaparecer.
    expect(screen.queryByText('Bem vindo!')).toBeNull();
  });

  it('autenticado em /cadastro tambem e redirecionado', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.REGISTER);

    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);
  });

  it('visitante em /cadastro ve o formulario dentro do layout de autenticacao', () => {
    renderizar(ANONIMO, ROUTE_PATHS.REGISTER);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Criar conta');
  });

  it('CT-01: /verifique-seu-email e publico e exibe a frase literal da spec', () => {
    renderizar(ANONIMO, ROUTE_PATHS.CHECK_EMAIL);

    expect(screen.getByRole('alert')).toHaveTextContent('Verifique seu e-mail para ativar sua conta.');
    // O e-mail digitado NAO e exibido: a rota e alcancavel por URL direta e
    // imprimir um endereco vindo da URL transformaria a pagina num refletor de
    // texto arbitrario.
    expect(screen.getByRole('link', { name: 'Ir para a tela de login' })).toBeInTheDocument();
  });

  it('/confirmar-email e publico DE PROPOSITO, tambem para quem tem sessao', async () => {
    // Quem clica no link do e-mail nao tem sessao — e, se tiver, ainda assim
    // precisa conseguir confirmar a conta. Por isso a rota fica FORA do
    // `PublicOnlyRoute`.
    renderizar(AUTENTICADO_CLIENTE, `${ROUTE_PATHS.CONFIRM_EMAIL}?token=abc`);

    await waitFor(() => {
      expect(rotaAtual()).toBe(`${ROUTE_PATHS.CONFIRM_EMAIL}?token=abc`);
    });

    expect(screen.queryByText('Minha área')).toBeNull();
  });
});

describe('AppRoutes — raiz, splash e rota inexistente', () => {
  it('a raiz manda o admin a area administrativa e o cliente a propria area', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ROOT);
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);
  });

  it('a raiz manda o cliente a area do cliente', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.ROOT);
    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
  });

  it('a raiz manda o visitante ao login', () => {
    renderizar(ANONIMO, ROUTE_PATHS.ROOT);
    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
  });

  it('a raiz cai no login se o estado for authenticated SEM usuario', () => {
    // Combinacao que o provider real nunca produz (`status` e `user` mudam juntos).
    // O ramo existe para nao quebrar caso a montagem mude, e este teste e o que
    // garante que ele degrada para o login em vez de lancar.
    renderizar({ status: 'authenticated', user: null }, ROUTE_PATHS.ROOT);

    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
  });

  it('bootstrapping em rota protegida mostra o splash e NAO redireciona', () => {
    renderizar(EM_BOOTSTRAP, ROUTE_PATHS.ADMIN_HOME);

    // A regressao que desloga o usuario a cada F5.
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sua sessão...');
    expect(screen.queryByText('Espécies')).toBeNull();
  });

  it('bootstrapping em /login mostra o splash e NAO renderiza o formulario', () => {
    renderizar(EM_BOOTSTRAP, ROUTE_PATHS.LOGIN);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Bem vindo!')).toBeNull();
  });

  it('rota inexistente exibe a 404 com destino coerente com a sessao', () => {
    renderizar(ANONIMO, '/rota-que-nao-existe');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Página não encontrada');
    // Visitante: mandar para a area do cliente so produziria um segundo
    // redirecionamento.
    expect(screen.getByRole('link', { name: 'Ir para a tela de login' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.LOGIN,
    );
  });

  it('a 404 de um autenticado aponta para a home da propria role', () => {
    renderizar(AUTENTICADO_ADMIN, '/rota-que-nao-existe');

    // Mandar um autenticado ao login seria desloga-lo por ter digitado a URL
    // errada.
    expect(screen.getByRole('link', { name: 'Voltar para a minha área' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.ADMIN_HOME,
    );
  });

  it('a 404 durante o bootstrap aponta para a raiz, que e quem decide o destino', () => {
    renderizar(EM_BOOTSTRAP, '/rota-que-nao-existe');

    // Sem este ramo, um F5 numa URL invalida COM sessao valida mostraria "login"
    // por um instante.
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.ROOT,
    );
  });

  it('a decoracao de fundo e invisivel a tecnologia assistiva e nao intercepta clique', () => {
    renderizar(ANONIMO, ROUTE_PATHS.LOGIN);

    const decoracao = document.querySelector('[aria-hidden="true"].pointer-events-none');

    // Sem `aria-hidden`, o leitor de tela anunciaria 16 imagens sem significado
    // antes do formulario; sem `pointer-events-none`, a camada `fixed inset-0`
    // engoliria o clique do proprio botao de submit.
    expect(decoracao).not.toBeNull();
    expect(decoracao?.querySelectorAll('svg')).toHaveLength(16);
  });
});

/* -------------------------------------------------------------------------- */
/*  MODULE-002 / FEATURE-001 — a rota de especies e o que ela mudou            */
/* -------------------------------------------------------------------------- */

/**
 * Botao que anda para TRAS no historico do roteador.
 *
 * Existe porque o `replace` de um `<Navigate>` nao deixa rastro nenhum no DOM: a
 * unica forma de observa-lo e verificar PARA ONDE o "voltar" leva. Sem ele, um
 * `replace` esquecido passaria despercebido — e o usuario ficaria preso num laco
 * do qual nao sai.
 */
function BotaoDeVoltar(): ReactElement {
  const navegar = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        navegar(-1);
      }}
    >
      Voltar no histórico
    </button>
  );
}

/**
 * Monta a aplicacao sobre um historico com MAIS DE UMA entrada.
 *
 * `renderizarComSessao` do harness sempre cria uma unica entrada, e com uma so
 * nao ha para onde voltar: os dois desfechos (`replace` e `push`) ficariam
 * indistinguiveis. O harness NAO foi alterado — o que muda aqui e apenas o
 * `MemoryRouter` deste teste.
 */
function renderizarComHistorico(
  estado: EstadoDublado,
  entradas: ReadonlyArray<string>,
  indice: number,
): void {
  const sessao = criarSessao(estado);

  render(
    <MemoryRouter initialEntries={[...entradas]} initialIndex={indice}>
      <AuthContext.Provider value={sessao.valor}>
        <MonitorDeLocalizacao />
        <BotaoDeVoltar />
        <App />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('AppRoutes — rota de especies e redirecionamento de /admin', () => {
  it('CT-39: o admin que chega a /admin encontra uma tela FUNCIONAL, sem pagina em branco nem 404', () => {
    // Arrange
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    // Act
    const cabecalho = screen.getByRole('heading', { level: 1 });

    // Assert
    /**
     * CA-01b. `/admin` continua sendo o destino do pos-login por role
     * (`homePathForRole('admin')` nao mudou), mas deixou de renderizar pagina
     * propria: ele redireciona. Se o redirecionamento nao existisse, o layout
     * montaria com o `<Outlet>` VAZIO — pagina em branco — e o teste de
     * redirecionamento por role da FEATURE-002 continuaria verde, porque a rota
     * estaria certa.
     */
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);
    expect(cabecalho).toHaveTextContent('Espécies');
    expect(screen.queryByText('Página não encontrada')).toBeNull();
    expect(screen.getByRole('main')).not.toBeEmptyDOMElement();
  });

  it('CT-39: o destino de /admin e `ADMIN_DEFAULT_PATH`, e ele aponta para as especies', () => {
    // Arrange
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    // Act
    const destino = rotaAtual();

    // Assert
    // A feature seguinte do modulo muda ESTA constante — e so ela. `ADMIN_HOME`
    // continua `/admin` porque o `PublicOnlyRoute`, o `RoleRoute` e a tela de
    // login dependem desse valor.
    expect(ADMIN_DEFAULT_PATH).toBe(ROUTE_PATHS.ADMIN_SPECIES);
    expect(ADMIN_DEFAULT_PATH).toBe('/admin/especies');
    expect(destino).toBe(ADMIN_DEFAULT_PATH);
  });

  it('CT-39: o redirecionamento de /admin usa `replace` — o "voltar" NAO devolve ao laco', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizarComHistorico(AUTENTICADO_ADMIN, [ROUTE_PATHS.CHECK_EMAIL, ROUTE_PATHS.ADMIN_HOME], 1);

    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Voltar no histórico' }));

    // Assert
    /**
     * SEM `replace`, a entrada `/admin` PERMANECE no historico: o "voltar" cai
     * nela, ela redireciona de novo e o usuario nunca sai de `/admin/especies`.
     * Com `replace`, a entrada de `/admin` e SUBSTITUIDA e o "voltar" alcanca a
     * pagina de onde ele veio de verdade.
     */
    expect(rotaAtual()).toBe(ROUTE_PATHS.CHECK_EMAIL);
  });

  it('CT-40: dentro da area, a navegacao lateral tem os dois itens e marca o atual', () => {
    // Arrange
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const navegacao = screen.getByRole('navigation', { name: 'Navegação administrativa' });
    const itens = within(navegacao).getAllByRole('link');

    // Assert
    // Nenhuma asserção de cor: o par ativo/inativo ainda esta em movimento e um
    // `expect` sobre classe transformaria a proxima decisao de produto em teste
    // vermelho. `aria-current` e `href` sao contrato.
    expect(itens.map((item) => item.textContent)).toEqual(['Animais', 'Espécies']);
    expect(itens[0]).toHaveAttribute('href', ROUTE_PATHS.ADMIN_ANIMALS);
    expect(itens[1]).toHaveAttribute('href', ROUTE_PATHS.ADMIN_SPECIES);
    expect(itens[1]).toHaveAttribute('aria-current', 'page');
  });

  it('/admin/especies NAO cai no catch-all: a rota filha vem antes dele', () => {
    // Arrange
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const cabecalho = screen.getByRole('heading', { level: 1 });

    // Assert
    // O catch-all e `/admin/*` e casaria `/admin/especies` tambem: quem decide e a
    // especificidade do roteador, e este teste e o que garante que ela nao virou
    // ordem de declaracao por acidente.
    expect(cabecalho).toHaveTextContent('Espécies');
    expect(screen.queryByText('Página não encontrada')).toBeNull();
  });

  it('/admin/inexistente com sessao de admin cai na 404, e o catch-all continua DEPOIS da rota filha', () => {
    // Arrange
    renderizar(AUTENTICADO_ADMIN, `${ROUTE_PATHS.ADMIN_HOME}/inexistente`);

    // Act
    const cabecalho = screen.getByRole('heading', { level: 1 });

    // Assert
    expect(cabecalho).toHaveTextContent('Página não encontrada');
    // A 404 substitui a AREA inteira: nao ha barra lateral por tras dela.
    expect(screen.queryByRole('navigation', { name: 'Navegação administrativa' })).toBeNull();
  });

  it('CT-28: o `cliente` que abre /admin/especies e devolvido a propria area, sem conteudo administrativo', () => {
    // Arrange
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const destino = rotaAtual();

    // Assert
    /**
     * CA-19. O guard de rota e CONVENIENCIA DE NAVEGACAO: a verificacao que vale e
     * a do servidor, que recusa a chamada com `403`. O que o guard entrega e nao
     * exibir a um `cliente` uma tela que ele nao pode operar — e a asserção que
     * importa e a de AUSENCIA no DOM, nao a de rota.
     */
    expect(destino).toBe(ROUTE_PATHS.CLIENT_HOME);
    expect(screen.queryByText(MARCADOR_DE_ADMIN)).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navegação administrativa' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Espécies' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Editar /u })).toBeNull();
    expect(screen.queryByRole('button', { name: MESSAGES.SPECIES.CREATE_BUTTON })).toBeNull();
  });

  it('CT-29: o visitante sem sessao que abre /admin/especies e mandado ao login', () => {
    // Arrange
    renderizar(ANONIMO, ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const destino = rotaAtual();

    // Assert
    expect(destino).toBe(ROUTE_PATHS.LOGIN);
    expect(screen.queryByText('Espécies')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bem vindo!');
  });

  it('CT-29: a listagem de especies NAO e disparada por quem nem chega a tela', () => {
    // Arrange
    renderizar(ANONIMO, ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const listagens = especiesDubladas.listSpecies.mock.calls;

    // Assert
    // A guarda decide ANTES de qualquer filho montar: nenhuma requisicao de dado
    // administrativo parte de uma sessao que nao existe.
    expect(listagens).toHaveLength(0);
  });
});
