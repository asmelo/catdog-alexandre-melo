import * as authApi from '~/services/api/auth-api';
import { request } from '~/services/api/http-client';

/**
 * Specs da camada de endpoints.
 *
 * O `request` e dublado de proposito: o comportamento dele (renovacao, traducao de
 * erro, `credentials`) e objeto de `http-client.spec.ts`, e o que se afirma AQUI e
 * o CONTRATO de cada chamada — caminho, metodo, corpo e a marca `skipRefresh`.
 * Sao esses quatro valores que precisam casar com o backend, e nenhum deles e
 * verificavel olhando a resposta.
 */
jest.mock('~/services/api/http-client');

const requestDublado = jest.mocked(request);

beforeEach(() => {
  requestDublado.mockResolvedValue(undefined as never);
});

describe('auth-api — rotas de conta', () => {
  it('RN-12: register envia EXATAMENTE tres campos, nomeados um a um', async () => {
    await authApi.register({ name: 'Caio Cliente', email: 'pessoa@catdog.test', password: 'Abc12345' });

    /**
     * O schema do backend reprova QUALQUER chave extra no corpo. Copiar os campos
     * explicitamente (em vez de `body: input`) faz o compilador recusar a mudanca
     * em vez de o servidor recusar a requisicao — um `passwordConfirmation` que
     * vazasse do formulario viraria `400 VALIDATION_ERROR`.
     */
    expect(requestDublado).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { name: 'Caio Cliente', email: 'pessoa@catdog.test', password: 'Abc12345' },
    });

    const [, opcoes] = requestDublado.mock.calls[0] ?? [];

    expect(Object.keys((opcoes?.body ?? {}) as object)).toEqual(['name', 'email', 'password']);
  });

  it('confirmEmail usa POST, e nao GET com o token na URL', async () => {
    await authApi.confirmEmail('token-de-confirmacao');

    // Pre-fetch de cliente de e-mail consumiria um token de uso unico (RN-03).
    expect(requestDublado).toHaveBeenCalledWith('/auth/confirm-email', {
      method: 'POST',
      body: { token: 'token-de-confirmacao' },
    });
  });

  it('resendConfirmation envia so o e-mail', async () => {
    await authApi.resendConfirmation('pessoa@catdog.test');

    expect(requestDublado).toHaveBeenCalledWith('/auth/confirmation/resend', {
      method: 'POST',
      body: { email: 'pessoa@catdog.test' },
    });
  });
});

describe('auth-api — rotas de sessao', () => {
  it('login marca skipRefresh: o 401 dele e credencial incorreta, nao token vencido', async () => {
    await authApi.login({ email: 'pessoa@catdog.test', password: 'Abc12345' });

    // Sem a marca, uma senha errada dispararia um refresh inutil e, pior, uma
    // rotacao do refresh token de uma sessao possivelmente valida em outra aba.
    expect(requestDublado).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'pessoa@catdog.test', password: 'Abc12345' },
      skipRefresh: true,
    });
  });

  it('refresh NAO envia corpo: a credencial vai no cookie catdog_rt', async () => {
    await authApi.refresh();

    expect(requestDublado).toHaveBeenCalledWith('/auth/refresh', {
      method: 'POST',
      skipRefresh: true,
    });

    const [, opcoes] = requestDublado.mock.calls[0] ?? [];

    expect(opcoes).not.toHaveProperty('body');
  });

  it('logout marca skipRefresh: renovar uma sessao que se esta encerrando nao faz sentido', async () => {
    await authApi.logout();

    expect(requestDublado).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      skipRefresh: true,
    });
  });

  it('me participa do ciclo de renovacao: o 401 dela e o gatilho legitimo do refresh', async () => {
    await authApi.me();

    // Nenhuma opcao: `GET` por default e SEM `skipRefresh`.
    expect(requestDublado).toHaveBeenCalledWith('/auth/me');
  });
});
