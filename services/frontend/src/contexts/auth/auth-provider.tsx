import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { AuthContext } from '~/contexts/auth/auth-context';
import type {
  AuthStatus,
  AuthUser,
  LoginCredentials,
  LogoutReason,
  RegistrationInput,
} from '~/contexts/auth/auth.types';
import { clearAccessToken, setAccessToken } from '~/services/api/access-token-store';
import * as authApi from '~/services/api/auth-api';
import {
  markSessionRestored,
  refreshSession,
  setOnSessionExpired,
  setSessionRefresher,
} from '~/services/api/http-client';

/**
 * Estado da sessao e PONTO UNICO de ligacao entre o cliente HTTP e a interface.
 *
 * Este e o modulo que fecha o grafo: ele registra no `http-client` quem sabe
 * renovar a sessao (`setSessionRefresher`) e quem quer saber que ela caiu
 * (`setOnSessionExpired`). O cliente HTTP nao importa este arquivo — a seta
 * aponta so nesta direcao, e e isso que mantem o grafo de imports sem ciclo.
 *
 * NAO e montado no `main.tsx` nesta task: isso acontece junto do roteador, na
 * TASK-FRONTEND-011.
 */

export interface AuthProviderProps {
  readonly children: ReactNode;
}

/**
 * Estado em um objeto unico, e nao tres `useState`.
 *
 * `status` e `user` precisam mudar JUNTOS: com estados separados existiria um
 * render intermediario com `status: 'authenticated'` e `user: null`, e um guard
 * que le os dois no mesmo render tomaria a decisao errada.
 */
interface EstadoDaSessao {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly logoutReason: LogoutReason | null;
}

const ESTADO_INICIAL: EstadoDaSessao = {
  status: 'bootstrapping',
  user: null,
  logoutReason: null,
};

/** Sessao viva zera o motivo de saida: a mensagem de sessao expirada nao pode sobreviver a um login novo. */
function sessaoAutenticada(user: AuthUser): EstadoDaSessao {
  return { status: 'authenticated', user, logoutReason: null };
}

function sessaoAnonima(logoutReason: LogoutReason | null): EstadoDaSessao {
  return { status: 'anonymous', user: null, logoutReason };
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [sessao, setSessao] = useState<EstadoDaSessao>(ESTADO_INICIAL);

  /**
   * O renovador registrado no cliente HTTP sobrevive ao componente: ele pode ser
   * chamado por uma requisicao que ainda estava em voo quando o provider
   * desmontou. Esta referencia e o que evita um `setState` em componente
   * desmontado nesse intervalo.
   */
  const montado = useRef(true);

  /**
   * O bootstrap acontece UMA vez por instancia do provider. Necessario porque o
   * `StrictMode` executa o efeito de mount duas vezes em desenvolvimento: sem a
   * guarda, a segunda execucao dispararia um SEGUNDO `POST /auth/refresh` — e se
   * o primeiro ja tivesse respondido, a fila single-flight nao teria como
   * colapsar os dois e o backend leria as duas apresentacoes como reuso,
   * derrubando a familia de tokens (RN-07). O `useRef` sobrevive ao duplo efeito
   * porque a instancia do componente e a mesma.
   */
  const bootstrapIniciado = useRef(false);

  /**
   * Enquanto `false`, uma falha de renovacao e o caso NORMAL de quem nunca
   * logou — nao uma sessao que expirou. E o que impede a tela de login abrir
   * dizendo "Sua sessão expirou" para um visitante de primeira viagem.
   */
  const bootstrapConcluido = useRef(false);

  const aplicar = useCallback((proximo: EstadoDaSessao): void => {
    if (montado.current) {
      setSessao(proximo);
    }
  }, []);

  /**
   * O renovador da sessao. Registrado no cliente HTTP, e usado por DOIS
   * caminhos: o boot da aplicacao e cada `401` recebido por qualquer requisicao.
   *
   * Ele tambem reaplica o usuario a cada renovacao, e nao apenas o token: a role
   * gravada no banco e a verdade, e um `admin` rebaixado a `cliente` passa a
   * valer no primeiro refresh em vez de esperar o proximo login.
   */
  const renovar = useCallback(async (): Promise<void> => {
    const sessaoRenovada = await authApi.refresh();

    setAccessToken(sessaoRenovada.accessToken);
    aplicar(sessaoAutenticada(sessaoRenovada.user));
  }, [aplicar]);

  const aoExpirarSessao = useCallback((): void => {
    clearAccessToken();
    aplicar(sessaoAnonima(bootstrapConcluido.current ? 'session-expired' : null));
  }, [aplicar]);

  useEffect(() => {
    montado.current = true;
    setSessionRefresher(renovar);
    setOnSessionExpired(aoExpirarSessao);

    if (!bootstrapIniciado.current) {
      bootstrapIniciado.current = true;

      /**
       * Passa pela fila single-flight (`refreshSession`), e nao por
       * `authApi.refresh()` direto: uma requisicao da primeira tela pode receber
       * `401` neste mesmo instante, e as duas renovacoes concorrentes derrubariam
       * a sessao. Falhar aqui e o desfecho esperado de quem nao tem cookie —
       * termina em `anonymous`, sem mensagem de erro.
       */
      void refreshSession()
        .catch(() => {
          aplicar(sessaoAnonima(null));
        })
        .finally(() => {
          bootstrapConcluido.current = true;
        });
    }

    return () => {
      montado.current = false;
      setSessionRefresher(null);
      setOnSessionExpired(null);
    };
  }, [aoExpirarSessao, aplicar, renovar]);

  const login = useCallback(
    async (input: LoginCredentials): Promise<AuthUser> => {
      const sessaoNova = await authApi.login(input);

      setAccessToken(sessaoNova.accessToken);

      // A sessao anterior pode ter morrido, e a fila de renovacao guarda a
      // rejeicao dela para nao sondar uma familia de tokens ja revogada. O login
      // e o unico evento que restabelece a sessao por fora da fila, portanto e
      // aqui que ela e liberada — sem isso, o primeiro `401` depois deste login
      // seria tratado como sessao expirada sem nem tentar renovar.
      markSessionRestored();
      aplicar(sessaoAutenticada(sessaoNova.user));

      // Devolve o usuario para a pagina decidir o destino pela role (HU-05). O
      // provider nao navega: importar o roteador aqui o acoplaria a arvore de
      // rotas e o tornaria inutilizavel fora dela.
      return sessaoNova.user;
    },
    [aplicar],
  );

  /**
   * NUNCA rejeita, nem com a API fora do ar. Um logout que falha e deixa a
   * interface autenticada e pior do que um cookie que sobrevive no servidor: o
   * usuario pediu para sair e continuaria vendo os dados dele na tela. O cookie
   * `HttpOnly` que eventualmente resta expira sozinho e a proxima renovacao ja
   * cai no fluxo normal de sessao expirada.
   */
  const logout = useCallback(
    async (reason: LogoutReason = 'user'): Promise<void> => {
      await authApi.logout().catch(() => undefined);

      clearAccessToken();
      aplicar(sessaoAnonima(reason));
    },
    [aplicar],
  );

  /** Registro nao autentica: a conta nasce `PENDING_CONFIRMATION` e o estado da sessao nao muda. */
  const register = useCallback(async (input: RegistrationInput): Promise<void> => {
    await authApi.register(input);
  }, []);

  /**
   * `useMemo` nao e otimizacao aqui: o valor do contexto e um objeto novo a cada
   * render, e qualquer consumidor de `useAuth` re-renderizaria em cada render do
   * provider mesmo sem nenhuma mudanca na sessao.
   */
  const valor = useMemo(
    () => ({
      status: sessao.status,
      user: sessao.user,
      logoutReason: sessao.logoutReason,
      login,
      logout,
      register,
    }),
    [login, logout, register, sessao],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
