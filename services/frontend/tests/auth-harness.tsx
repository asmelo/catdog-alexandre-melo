import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AuthContext } from '~/contexts/auth/auth-context';
import type {
  AuthContextValue,
  AuthStatus,
  AuthUser,
  LogoutReason,
} from '~/contexts/auth/auth.types';

/**
 * Infraestrutura comum dos specs que montam arvore de React.
 *
 * Existe por DRY, e a duplicacao que ela evita e concreta: quatro specs
 * (`role-route`, `login-page`, `app-routes` e as duas home) precisam de um
 * `AuthContext` dublado e de uma forma de observar a rota atual. Cinco copias do
 * mesmo provider divergiriam no primeiro campo novo de `AuthContextValue`, e a
 * divergencia apareceria como um teste que passa afirmando o contrato errado.
 *
 * O dublê e do CONTEXTO, nao do `AuthProvider`. E deliberado: o provider tem
 * bootstrap, efeito de mount, registro no cliente HTTP e fila de renovacao —
 * tudo isso e o objeto de `auth-provider.spec.tsx` e seria ruido em um teste de
 * guarda de rota. Aqui interessa apenas o VALOR que a guarda le.
 */

/** `id` em formato de UUID porque e o que o backend emite; nada no cliente valida o formato. */
export const USUARIO_ADMIN: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana Administradora',
  email: 'ana.admin@catdog.test',
  role: 'admin',
};

export const USUARIO_CLIENTE: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Caio Cliente',
  email: 'caio.cliente@catdog.test',
  role: 'cliente',
};

/** So a parte de ESTADO do contexto; as tres funcoes sao sempre dublês. */
export interface EstadoDublado {
  readonly status?: AuthStatus;
  readonly user?: AuthUser | null;
  readonly logoutReason?: LogoutReason | null;
}

/**
 * Os dublês expostos ao lado do valor do contexto.
 *
 * Devolver as tres funcoes separadamente, e nao so `valor`, evita a conversao
 * `valor.login as jest.Mock` em cada asserção — conversao que o compilador nao
 * verifica e que passaria a mentir se o tipo do contexto mudasse.
 */
export interface SessaoDublada {
  readonly valor: AuthContextValue;
  readonly login: jest.MockedFunction<AuthContextValue['login']>;
  readonly logout: jest.MockedFunction<AuthContextValue['logout']>;
  readonly register: jest.MockedFunction<AuthContextValue['register']>;
}

/**
 * Monta um `AuthContextValue` completo a partir de um estado parcial.
 *
 * Os defaults descrevem o caso mais comum nos specs de guarda: sessao resolvida
 * e anonima. `status` e `user` sao passados JUNTOS pelo chamador de proposito —
 * o provider real nunca produz `authenticated` com `user: null`, e um dublê que
 * permitisse essa combinacao por descuido testaria um estado impossivel.
 */
export function criarSessao(estado: EstadoDublado = {}): SessaoDublada {
  const login = jest.fn<
    ReturnType<AuthContextValue['login']>,
    Parameters<AuthContextValue['login']>
  >();
  const logout = jest.fn<
    ReturnType<AuthContextValue['logout']>,
    Parameters<AuthContextValue['logout']>
  >();
  const register = jest.fn<
    ReturnType<AuthContextValue['register']>,
    Parameters<AuthContextValue['register']>
  >();

  login.mockResolvedValue(USUARIO_CLIENTE);
  logout.mockResolvedValue(undefined);
  register.mockResolvedValue(undefined);

  const valor: AuthContextValue = {
    status: estado.status ?? 'anonymous',
    user: estado.user ?? null,
    logoutReason: estado.logoutReason ?? null,
    login,
    logout,
    register,
  };

  return { valor, login, logout, register };
}

/** `data-testid` do monitor de rota. Constante para que nenhuma asserção repita a string. */
export const ID_DA_LOCALIZACAO = 'localizacao-atual';

/**
 * Imprime a rota atual no DOM.
 *
 * E o que torna um redirecionamento OBSERVAVEL sob `MemoryRouter`: nao existe
 * `window.location` para consultar, e `<Navigate>` nao deixa rastro alem da
 * arvore que passa a ser renderizada. Espionar `useNavigate` seria pior — provaria
 * que a funcao foi chamada, nao que o usuario acabou na rota certa.
 */
export function MonitorDeLocalizacao(): ReactElement {
  const { pathname, search } = useLocation();

  return <span data-testid={ID_DA_LOCALIZACAO}>{`${pathname}${search}`}</span>;
}

export interface OpcoesDeRenderizacao {
  readonly sessao: AuthContextValue;
  /** Rota inicial do `MemoryRouter`. */
  readonly rota?: string;
}

/**
 * Renderiza `ui` sob `MemoryRouter` + `AuthContext` dublado, com o monitor de
 * rota sempre presente.
 *
 * `MemoryRouter` e nao `BrowserRouter`: o segundo exige `window.history` real e
 * carrega o estado da navegacao entre testes do mesmo arquivo, o que faria o
 * resultado depender da ordem (AC #8).
 */
export function renderizarComSessao(ui: ReactNode, opcoes: OpcoesDeRenderizacao): RenderResult {
  return render(
    <MemoryRouter initialEntries={[opcoes.rota ?? '/']}>
      <AuthContext.Provider value={opcoes.sessao}>
        <MonitorDeLocalizacao />
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
