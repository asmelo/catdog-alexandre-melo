import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '~/App';
import { AdminLayout } from '~/layouts/admin-layout';
import { ClientLayout } from '~/layouts/client-layout';
import { ROUTE_PATHS } from '~/routes/route-paths';
import * as authApi from '~/services/api/auth-api';

import {
  ID_DA_LOCALIZACAO,
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
 */
jest.mock('~/services/api/auth-api');

const apiDublada = jest.mocked(authApi);

/**
 * Os dublês do modulo automockado devolvem `undefined`, e a tela de confirmacao
 * encadeia `.then()` sobre o retorno. Sem estas implementacoes o teste falharia em
 * `Cannot read properties of undefined (reading 'then')` — um erro do dublê, nao
 * do codigo sob teste.
 */
beforeEach(() => {
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
  it('CT-09: admin autenticado em /admin ve o painel dentro do layout administrativo', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Painel administrativo');
    expect(screen.getByText(MARCADOR_DE_ADMIN)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação administrativa' })).toBeInTheDocument();
    // O nome prova que a sessao exibida e a do usuario que autenticou, e nao uma
    // pagina estatica igual para qualquer um.
    expect(screen.getByText(`Você está autenticado como administrador, ${USUARIO_ADMIN.name}.`)).toBeInTheDocument();
  });

  it('o item ativo da navegacao administrativa e anunciado por aria-current', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ADMIN_HOME);

    // `NavLink` marca `aria-current="page"` sozinho: a indicacao de "onde estou"
    // chega ao leitor de tela sem nenhum atributo escrito a mao, e o sublinhado e
    // apenas o reforco visual dela.
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
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
    expect(screen.queryByRole('link', { name: 'Painel' })).toBeNull();

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toContain(ROUTE_PATHS.ADMIN_HOME);
    }
  });

  it('CT-16: cliente que abre /admin acaba na propria area, sem conteudo administrativo no DOM', () => {
    renderizar(AUTENTICADO_CLIENTE, ROUTE_PATHS.ADMIN_HOME);

    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    expect(screen.queryByText('Painel administrativo')).toBeNull();
    expect(screen.queryByText(MARCADOR_DE_ADMIN)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Minha área');
  });

  it('admin que abre /minha-area e devolvido ao painel: a guarda vale nos dois sentidos', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.CLIENT_HOME);

    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
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
   * E a unica forma de observar o item de navegacao INATIVO: no mapa atual cada
   * layout tem uma unica rota filha, que e sempre a do proprio item, e portanto o
   * `NavLink` esta sempre ativo. O estado inativo passa a existir quando a area
   * ganhar uma segunda tela, e o teste ja cobre esse caminho hoje.
   */
  it('o item de navegacao administrativo fica sem aria-current fora da propria rota', () => {
    const sessao = criarSessao(AUTENTICADO_ADMIN);

    renderizarComSessao(<AdminLayout />, { sessao: sessao.valor, rota: '/admin/outra-tela' });

    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
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

    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
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
  it('a raiz manda o admin ao painel e o cliente a propria area', () => {
    renderizar(AUTENTICADO_ADMIN, ROUTE_PATHS.ROOT);
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
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
    expect(screen.queryByText('Painel administrativo')).toBeNull();
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
