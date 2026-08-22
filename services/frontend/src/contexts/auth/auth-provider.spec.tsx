import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactElement } from 'react';

import { AuthProvider } from '~/contexts/auth/auth-provider';
import type { AuthUser } from '~/contexts/auth/auth.types';
import { useAuth } from '~/contexts/auth/use-auth';
import { getAccessToken } from '~/services/api/access-token-store';
import { ApiError } from '~/services/api/api-error';
import * as authApi from '~/services/api/auth-api';

/**
 * Specs do estado da sessao.
 *
 * `auth-api` e dublado por modulo; `http-client` NAO e. A fila single-flight real
 * continua no caminho, porque e ela que o bootstrap atravessa (`refreshSession`) e
 * porque o `markSessionRestored` do `login` so tem sentido contra a implementacao
 * de verdade. Dublar os dois deixaria o teste afirmando o comportamento dos
 * dublês.
 */
jest.mock('~/services/api/auth-api');

const apiDublada = jest.mocked(authApi);

const USUARIO: AuthUser = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Caio Cliente',
  email: 'caio.cliente@catdog.test',
  role: 'cliente',
};

const ADMIN_REBAIXADO: AuthUser = { ...USUARIO, role: 'admin' };

const TOKEN_DO_BOOTSTRAP = 'access-token-do-bootstrap';
const TOKEN_DO_LOGIN = 'access-token-do-login';

function sessaoDaApi(accessToken: string, user: AuthUser): authApi.SessionResponse {
  return { accessToken, expiresIn: 900, user };
}

const ID_DO_STATUS = 'status-da-sessao';
const ID_DO_USUARIO = 'usuario-da-sessao';
const ID_DO_MOTIVO = 'motivo-da-saida';

/**
 * Consumidor do contexto que imprime o estado no DOM e expoe as tres acoes como
 * botoes.
 *
 * Botao e nao chamada direta: e o que permite usar `userEvent` e ficar dentro do
 * `act()` do React sem envolver cada chamada manualmente — as atualizacoes de
 * estado disparadas por `login`/`logout` acontecem no mesmo fluxo de evento que
 * a interface real produz.
 */
function SondaDaSessao(): ReactElement {
  const { status, user, logoutReason, login, logout, register } = useAuth();

  return (
    <div>
      <span data-testid={ID_DO_STATUS}>{status}</span>
      <span data-testid={ID_DO_USUARIO}>{user === null ? 'sem-usuario' : user.name}</span>
      <span data-testid={ID_DO_MOTIVO}>{logoutReason ?? 'sem-motivo'}</span>

      <button
        type="button"
        onClick={() => {
          void login({ email: USUARIO.email, password: 'SenhaValida1' }).catch(() => undefined);
        }}
      >
        entrar
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        sair
      </button>
      <button
        type="button"
        onClick={() => {
          void register({ name: USUARIO.name, email: USUARIO.email, password: 'SenhaValida1' }).catch(
            () => undefined,
          );
        }}
      >
        cadastrar
      </button>
    </div>
  );
}

function montarProvider(estrito = false): void {
  const arvore = (
    <AuthProvider>
      <SondaDaSessao />
    </AuthProvider>
  );

  render(estrito ? <StrictMode>{arvore}</StrictMode> : arvore);
}

function statusExibido(): string | null {
  return screen.getByTestId(ID_DO_STATUS).textContent;
}

const SESSAO_EXPIRADA = new ApiError({
  status: 401,
  code: 'SESSION_EXPIRED',
  message: 'Sua sessão expirou. Faça login novamente.',
});

beforeEach(() => {
  apiDublada.refresh.mockRejectedValue(SESSAO_EXPIRADA);
  apiDublada.login.mockResolvedValue(sessaoDaApi(TOKEN_DO_LOGIN, USUARIO));
  apiDublada.logout.mockResolvedValue(undefined);
  apiDublada.register.mockResolvedValue({ message: 'Verifique seu e-mail para ativar sua conta.' });
});

describe('AuthProvider — bootstrap da sessao', () => {
  it('comeca em bootstrapping antes de a renovacao responder', async () => {
    // Renovacao que nunca resolve: congela o estado inicial para asserção.
    apiDublada.refresh.mockReturnValue(new Promise<authApi.SessionResponse>(() => undefined));

    montarProvider();

    expect(statusExibido()).toBe('bootstrapping');
    expect(screen.getByTestId(ID_DO_USUARIO)).toHaveTextContent('sem-usuario');

    // Sem esta espera o teste terminaria com um efeito pendente e o Jest avisaria
    // sobre atualizacao fora de `act()` no teste SEGUINTE — resultado dependente
    // de ordem, que a AC #8 proibe.
    await waitFor(() => {
      expect(apiDublada.refresh).toHaveBeenCalled();
    });
  });

  it('renovacao de bootstrap bem-sucedida termina em authenticated com o usuario', async () => {
    apiDublada.refresh.mockResolvedValue(sessaoDaApi(TOKEN_DO_BOOTSTRAP, USUARIO));

    montarProvider();

    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    expect(screen.getByTestId(ID_DO_USUARIO)).toHaveTextContent(USUARIO.name);
    expect(getAccessToken()).toBe(TOKEN_DO_BOOTSTRAP);
  });

  it('renovacao de bootstrap falha termina em anonymous SEM nenhuma mensagem de erro', async () => {
    montarProvider();

    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    // Visitante de primeira viagem: `logoutReason` fica `null`, e nao
    // `session-expired`. E o que impede a tela de login abrir dizendo
    // "Sua sessão expirou" para quem nunca logou.
    expect(screen.getByTestId(ID_DO_MOTIVO)).toHaveTextContent('sem-motivo');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('sob StrictMode o bootstrap dispara UM unico POST /auth/refresh', async () => {
    apiDublada.refresh.mockResolvedValue(sessaoDaApi(TOKEN_DO_BOOTSTRAP, USUARIO));

    montarProvider(true);

    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    // O `StrictMode` executa o efeito de mount DUAS vezes em desenvolvimento. Sem
    // a guarda `bootstrapIniciado`, a segunda execucao apresentaria o mesmo cookie
    // de novo e o backend leria as duas apresentacoes como reuso, revogando a
    // familia de tokens (RN-07).
    expect(apiDublada.refresh).toHaveBeenCalledTimes(1);
  });

  it('renovacao posterior reaplica o usuario, e nao apenas o token', async () => {
    apiDublada.refresh.mockResolvedValue(sessaoDaApi(TOKEN_DO_BOOTSTRAP, ADMIN_REBAIXADO));

    montarProvider();

    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    // A role gravada no banco e a verdade: um `admin` rebaixado a `cliente` passa
    // a valer no primeiro refresh, sem esperar o proximo login.
    expect(screen.getByTestId(ID_DO_USUARIO)).toHaveTextContent(ADMIN_REBAIXADO.name);
  });
});

describe('AuthProvider — renovacao apos o unmount', () => {
  it('renovacao que responde depois do unmount nao atualiza estado de componente desmontado', async () => {
    const diferido: { resolver: (sessao: authApi.SessionResponse) => void } = {
      resolver: () => undefined,
    };

    apiDublada.refresh.mockReturnValue(
      new Promise<authApi.SessionResponse>((resolve) => {
        diferido.resolver = resolve;
      }),
    );

    const { unmount } = render(
      <AuthProvider>
        <SondaDaSessao />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(apiDublada.refresh).toHaveBeenCalled();
    });

    /**
     * O renovador registrado no cliente HTTP SOBREVIVE ao componente: ele pode ser
     * chamado por uma requisicao que ainda estava em voo quando o provider
     * desmontou. A guarda `montado` e o que evita um `setState` nesse intervalo.
     */
    unmount();

    diferido.resolver({ accessToken: TOKEN_DO_BOOTSTRAP, expiresIn: 900, user: USUARIO });

    await waitFor(() => {
      // O token FOI guardado (o renovador rodou por completo), mas nenhum estado de
      // React foi tocado — e nada lancou.
      expect(getAccessToken()).toBe(TOKEN_DO_BOOTSTRAP);
    });

    expect(screen.queryByTestId(ID_DO_STATUS)).toBeNull();
  });
});

describe('AuthProvider — login, logout e registro', () => {
  it('login popula usuario e token e devolve o usuario a quem chamou', async () => {
    const usuario = userEvent.setup();

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    await usuario.click(screen.getByRole('button', { name: 'entrar' }));

    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    expect(screen.getByTestId(ID_DO_USUARIO)).toHaveTextContent(USUARIO.name);
    expect(getAccessToken()).toBe(TOKEN_DO_LOGIN);
    expect(apiDublada.login).toHaveBeenCalledWith({
      email: USUARIO.email,
      password: 'SenhaValida1',
    });
  });

  it('o access token NAO aparece em localStorage nem em sessionStorage apos o login', async () => {
    const usuario = userEvent.setup();

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    await usuario.click(screen.getByRole('button', { name: 'entrar' }));
    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    /**
     * Token em storage e legivel por qualquer script injetado, e uma unica falha
     * de XSS entregaria a sessao inteira (decisao do `access-token-store`).
     *
     * A verificacao percorre TODAS as chaves em vez de consultar uma chave
     * provavel: procurar por `localStorage.getItem('accessToken')` passaria caso
     * o token fosse gravado com outro nome.
     */
    for (const armazenamento of [window.localStorage, window.sessionStorage]) {
      expect(armazenamento).toHaveLength(0);

      const valores = Object.keys(armazenamento).map((chave) => armazenamento.getItem(chave));

      expect(valores).not.toContain(TOKEN_DO_LOGIN);
    }

    // E continua acessivel de onde deve estar: a memoria do modulo.
    expect(getAccessToken()).toBe(TOKEN_DO_LOGIN);
  });

  it('login que falha nao autentica e propaga o erro', async () => {
    const usuario = userEvent.setup();

    apiDublada.login.mockRejectedValue(
      new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' }),
    );

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    await usuario.click(screen.getByRole('button', { name: 'entrar' }));

    expect(statusExibido()).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
  });

  it('logout limpa o estado mesmo quando a API rejeita', async () => {
    const usuario = userEvent.setup();

    apiDublada.refresh.mockResolvedValue(sessaoDaApi(TOKEN_DO_BOOTSTRAP, USUARIO));
    // Um logout que falha e deixa a interface autenticada e pior do que um cookie
    // que sobrevive no servidor: o usuario pediu para sair e continuaria vendo os
    // dados dele.
    apiDublada.logout.mockRejectedValue(new Error('servidor fora do ar'));

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    await usuario.click(screen.getByRole('button', { name: 'sair' }));

    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    expect(screen.getByTestId(ID_DO_USUARIO)).toHaveTextContent('sem-usuario');
    expect(screen.getByTestId(ID_DO_MOTIVO)).toHaveTextContent('user');
    expect(getAccessToken()).toBeNull();
  });

  it('registro NAO autentica: o estado da sessao nao muda', async () => {
    const usuario = userEvent.setup();

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    await usuario.click(screen.getByRole('button', { name: 'cadastrar' }));

    await waitFor(() => {
      expect(apiDublada.register).toHaveBeenCalledTimes(1);
    });

    // A conta nasce `PENDING_CONFIRMATION`; nao existe sessao a criar.
    expect(statusExibido()).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
  });

  it('sessao que expira depois do bootstrap marca o motivo como session-expired', async () => {
    apiDublada.refresh.mockResolvedValue(sessaoDaApi(TOKEN_DO_BOOTSTRAP, USUARIO));

    montarProvider();
    await waitFor(() => {
      expect(statusExibido()).toBe('authenticated');
    });

    // Simula o que o `http-client` faz quando a renovacao falha de vez: avisa o
    // provider pelo callback registrado. Chamar o callback registrado (e nao um
    // metodo do contexto) e o que exercita o caminho real de `setOnSessionExpired`.
    apiDublada.refresh.mockRejectedValue(SESSAO_EXPIRADA);

    const { refreshSession } = await import('~/services/api/http-client');

    /**
     * `act` envolve a chamada porque a renovacao falha DENTRO dela e dispara o
     * `onSessionExpired` registrado, que atualiza o estado do provider. Sem o
     * envoltorio o React avisa "update ... was not wrapped in act(...)" — e o aviso
     * nao e cosmetico: ele sinaliza uma atualizacao que o teste nao esperou, e
     * portanto uma asserção que poderia correr antes do re-render.
     */
    await act(async () => {
      await refreshSession().catch(() => undefined);
    });

    await waitFor(() => {
      expect(statusExibido()).toBe('anonymous');
    });

    // Depois do bootstrap concluido, a queda da sessao TEM motivo — e o que
    // permite a tela de login explicar por que o usuario foi deslogado.
    expect(screen.getByTestId(ID_DO_MOTIVO)).toHaveTextContent('session-expired');
  });
});

describe('useAuth', () => {
  it('lanca erro explicito quando usado fora do AuthProvider', () => {
    // O React registra no console os erros lancados durante o render. Silenciar e
    // deliberado: o erro esperado nao e ruido a investigar.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<SondaDaSessao />)).toThrow('useAuth deve ser usado dentro de AuthProvider.');
  });
});
