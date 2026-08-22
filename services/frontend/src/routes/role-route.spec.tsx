import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import type { AuthRole } from '~/contexts/auth/auth.types';
import { RoleRoute } from '~/routes/role-route';
import { ROUTE_PATHS } from '~/routes/route-paths';

import {
  ID_DA_LOCALIZACAO,
  USUARIO_ADMIN,
  USUARIO_CLIENTE,
  criarSessao,
  renderizarComSessao,
  type EstadoDublado,
} from '../../tests/auth-harness';

/**
 * Specs da guarda de role — CT-16 e CT-17.
 *
 * A verificacao central deste arquivo e por AUSENCIA NO DOM, nunca por estilo nem
 * por visibilidade. Esconder por CSS deixaria o conteudo administrativo no DOM e
 * no HTML entregue ao navegador, o que reprova o criterio mesmo com a tela
 * parecendo correta. A TASK-FRONTEND-011 provou por `MutationObserver` que o
 * conteudo nao aparece nem por um instante; o teste abaixo afirma a mesma
 * propriedade no nivel unitario.
 */

const ROLES_ADMIN: ReadonlyArray<AuthRole> = ['admin'];

const TEXTO_ADMINISTRATIVO = 'Conteúdo administrativo restrito';
const TEXTO_DA_AREA_DO_CLIENTE = 'Área do cliente';
const TEXTO_DO_LOGIN = 'Formulário de login';

const ID_DO_ESTADO_DE_RETORNO = 'estado-de-retorno';

/** Imprime o `state.from` que a guarda anexou, para afirmar o destino de retorno. */
function EspelhoDoLogin(): ReactElement {
  const { state } = useLocation();
  const de = typeof state === 'object' && state !== null && 'from' in state ? state.from : null;

  return (
    <div>
      <p>{TEXTO_DO_LOGIN}</p>
      <span data-testid={ID_DO_ESTADO_DE_RETORNO}>{typeof de === 'string' ? de : 'sem-estado'}</span>
    </div>
  );
}

/**
 * Arvore minima com a guarda no lugar em que ela vive de verdade: rota SEM `path`
 * envolvendo as rotas filhas, decidindo antes de qualquer filho montar.
 */
function ArvoreComGuardaDeAdmin(): ReactElement {
  return (
    <Routes>
      <Route element={<RoleRoute allow={ROLES_ADMIN} />}>
        <Route path={ROUTE_PATHS.ADMIN_HOME} element={<p>{TEXTO_ADMINISTRATIVO}</p>} />
      </Route>
      <Route path={ROUTE_PATHS.CLIENT_HOME} element={<p>{TEXTO_DA_AREA_DO_CLIENTE}</p>} />
      <Route path={ROUTE_PATHS.LOGIN} element={<EspelhoDoLogin />} />
    </Routes>
  );
}

// `rota: string` explicito: sem a anotacao, o default infere o tipo LITERAL
// `"/admin"` e nenhum outro caminho seria aceito pelo compilador.
function renderizarGuarda(estado: EstadoDublado, rota: string = ROUTE_PATHS.ADMIN_HOME): void {
  const { valor } = criarSessao(estado);

  renderizarComSessao(<ArvoreComGuardaDeAdmin />, { sessao: valor, rota });
}

function rotaAtual(): string | null {
  return screen.getByTestId(ID_DA_LOCALIZACAO).textContent;
}

describe('RoleRoute', () => {
  it('CT-16: cliente acessando rota de admin é redirecionado para a área do cliente', () => {
    renderizarGuarda({ status: 'authenticated', user: USUARIO_CLIENTE });

    /**
     * A ASSERCAO EXIGIDA PELA AC #5: ausencia no DOM, com `queryByText`
     * devolvendo `null`.
     *
     * `getByText` lancaria e provaria o mesmo, mas `queryBy...` deixa explicito
     * que o valor esperado e a AUSENCIA. E o oposto de afirmar `not.toBeVisible()`
     * — que passaria com o conteudo presente e apenas oculto.
     */
    expect(screen.queryByText(TEXTO_ADMINISTRATIVO)).toBeNull();

    // E o usuario acaba onde tem o que fazer: a area da propria role, nao um 403.
    // Ele nao precisa saber que existe uma area da qual foi barrado.
    expect(screen.getByText(TEXTO_DA_AREA_DO_CLIENTE)).toBeInTheDocument();
    expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
  });

  it('CT-17: usuário não autenticado em rota protegida é redirecionado para o login', () => {
    renderizarGuarda({ status: 'anonymous', user: null });

    expect(screen.queryByText(TEXTO_ADMINISTRATIVO)).toBeNull();
    expect(screen.getByText(TEXTO_DO_LOGIN)).toBeInTheDocument();
    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
  });

  it('CT-17: o destino original acompanha o redirecionamento, ja sanitizado', () => {
    renderizarGuarda({ status: 'anonymous', user: null }, `${ROUTE_PATHS.ADMIN_HOME}?aba=usuarios`);

    expect(screen.getByTestId(ID_DO_ESTADO_DE_RETORNO)).toHaveTextContent(
      `${ROUTE_PATHS.ADMIN_HOME}?aba=usuarios`,
    );
  });

  it('bootstrapping renderiza o splash e NAO redireciona', () => {
    renderizarGuarda({ status: 'bootstrapping', user: null });

    /**
     * A REGRESSAO QUE ESTE TESTE EXISTE PARA IMPEDIR: o access token vive em
     * memoria, entao um F5 o apaga e o `POST /auth/refresh` ainda esta em voo
     * quando a guarda decide. Redirecionar aqui deslogaria o usuario a cada
     * recarga — e nao ha nada hoje que impeca essa regressao alem deste teste.
     */
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
    expect(screen.queryByText(TEXTO_DO_LOGIN)).toBeNull();
    expect(screen.queryByText(TEXTO_DA_AREA_DO_CLIENTE)).toBeNull();

    // O conteudo restrito tambem nao vaza durante a espera.
    expect(screen.queryByText(TEXTO_ADMINISTRATIVO)).toBeNull();

    // `role="status"` + `aria-live="polite"`: sem eles a espera ficaria em
    // silencio para quem usa leitor de tela.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sua sessão...');
  });

  it('bootstrapping com usuario ja conhecido ainda mostra o splash', () => {
    // A ordem das guardas importa: `bootstrapping` e verificado ANTES de `user`,
    // porque a role so e definitiva depois de a renovacao responder.
    renderizarGuarda({ status: 'bootstrapping', user: USUARIO_ADMIN });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_ADMINISTRATIVO)).toBeNull();
  });

  it('role permitida renderiza as rotas filhas', () => {
    renderizarGuarda({ status: 'authenticated', user: USUARIO_ADMIN });

    expect(screen.getByText(TEXTO_ADMINISTRATIVO)).toBeInTheDocument();
    expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
  });
});
