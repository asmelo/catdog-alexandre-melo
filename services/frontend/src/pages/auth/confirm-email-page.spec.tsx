import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ConfirmEmailPage } from '~/pages/auth/confirm-email-page';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError } from '~/services/api/api-error';
import * as authApi from '~/services/api/auth-api';

/**
 * Specs da tela de confirmacao de conta — CT-06, CT-07 e CT-08.
 *
 * Esta tela nao consome `useAuth`, entao nao ha `AuthContext` a dublar: um
 * `MemoryRouter` basta, e e ele que fornece o `?token=` que `useSearchParams` le.
 */
jest.mock('~/services/api/auth-api');

const apiDublada = jest.mocked(authApi);

const TOKEN = 'token-de-confirmacao-valido';

const MENSAGEM_DE_SUCESSO = 'Conta confirmada! Faça login para continuar.';
const MENSAGEM_DE_EXPIRADO =
  'Este link de confirmação expirou. Solicite um novo e-mail de confirmação.';
const MENSAGEM_DE_JA_USADO = 'Este link de confirmação já foi utilizado.';
const MENSAGEM_DO_REENVIO =
  'Se este e-mail estiver cadastrado e pendente de confirmação, enviaremos um novo link.';

function renderizar(consulta = `?token=${TOKEN}`, estrito = false): void {
  const arvore = (
    <MemoryRouter initialEntries={[`${ROUTE_PATHS.CONFIRM_EMAIL}${consulta}`]}>
      <Routes>
        <Route path={ROUTE_PATHS.CONFIRM_EMAIL} element={<ConfirmEmailPage />} />
      </Routes>
    </MemoryRouter>
  );

  render(estrito ? <StrictMode>{arvore}</StrictMode> : arvore);
}

function erroDaApi(status: number, code: string, message: string): ApiError {
  return new ApiError({ status, code, message });
}

/** O `<h1>` do `AuthCard` — a ancora de navegacao por cabecalho do leitor de tela. */
function tituloDaPagina(): HTMLElement {
  return screen.getByRole('heading', { level: 1 });
}

beforeEach(() => {
  apiDublada.confirmEmail.mockResolvedValue({ message: MENSAGEM_DE_SUCESSO });
  apiDublada.resendConfirmation.mockResolvedValue({ message: MENSAGEM_DO_REENVIO });
});

describe('ConfirmEmailPage — resultado da confirmacao', () => {
  it('CT-06: token valido confirma a conta e oferece o caminho para o login', async () => {
    renderizar();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_SUCESSO);
    });

    expect(apiDublada.confirmEmail).toHaveBeenCalledWith(TOKEN);
    // Titulo por estado, e nao um titulo fixo: um "Confirmação de conta" generico
    // obrigaria o usuario a ouvir o corpo da pagina para saber o desfecho.
    expect(tituloDaPagina()).toHaveTextContent('Conta confirmada');
    expect(screen.getByRole('link', { name: 'Ir para a tela de login' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.LOGIN,
    );
  });

  it('anuncia a espera enquanto a confirmacao esta em voo', async () => {
    apiDublada.confirmEmail.mockReturnValue(new Promise(() => undefined));

    renderizar();

    // `role="status"` + `aria-live="polite"`: anuncia sem interromper a leitura.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Estamos confirmando a sua conta. Isso leva apenas alguns instantes.',
    );
    expect(tituloDaPagina()).toHaveTextContent('Confirmando sua conta');

    await waitFor(() => {
      expect(apiDublada.confirmEmail).toHaveBeenCalled();
    });
  });

  it('CT-08: link ja utilizado exibe a mensagem do backend e NAO oferece reenvio', async () => {
    apiDublada.confirmEmail.mockRejectedValue(
      erroDaApi(409, 'CONFIRMATION_TOKEN_ALREADY_USED', MENSAGEM_DE_JA_USADO),
    );

    renderizar();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_JA_USADO);
    });

    expect(tituloDaPagina()).toHaveTextContent('Não foi possível confirmar');
    // Reenviar nao resolveria nada: a conta ja esta confirmada.
    expect(screen.queryByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeNull();
  });

  it('sem token na URL a API NAO e chamada', async () => {
    renderizar('');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Link de confirmação inválido.');
    });

    // Nao existe requisicao a fazer, e o schema do backend responderia `400` para
    // um corpo sem token.
    expect(apiDublada.confirmEmail).not.toHaveBeenCalled();
  });

  it('token vazio na URL tambem nao chama a API', async () => {
    renderizar('?token=');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Link de confirmação inválido.');
    });

    expect(apiDublada.confirmEmail).not.toHaveBeenCalled();
  });

  it('erro que NAO e ApiError cai na mensagem generica', async () => {
    apiDublada.confirmEmail.mockRejectedValue(new TypeError('undefined is not a function'));

    renderizar();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado. Tente novamente.');
    });
  });

  it('RN-03: sob StrictMode o token e consumido UMA unica vez', async () => {
    renderizar(`?token=${TOKEN}`, true);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_SUCESSO);
    });

    /**
     * O `StrictMode` executa o efeito de mount DUAS vezes em desenvolvimento. Sem
     * a guarda de `useRef`, a segunda execucao consumiria o token de novo e a
     * resposta seria `409 CONFIRMATION_TOKEN_ALREADY_USED` — a tela diria
     * "Este link de confirmação já foi utilizado." para quem acabou de confirmar
     * a conta com sucesso.
     */
    expect(apiDublada.confirmEmail).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmEmailPage — link expirado e pedido de novo link', () => {
  beforeEach(() => {
    apiDublada.confirmEmail.mockRejectedValue(
      erroDaApi(410, 'CONFIRMATION_TOKEN_EXPIRED', MENSAGEM_DE_EXPIRADO),
    );
  });

  it('CT-07: link expirado exibe a mensagem e o formulario de novo link', async () => {
    renderizar();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_EXPIRADO);
    });

    expect(screen.getByText('Informe o seu e-mail para receber um novo link de confirmação.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('CT-07: o pedido de novo link envia o e-mail e troca o formulario pela resposta', async () => {
    const usuario = userEvent.setup();

    renderizar();

    await usuario.type(await screen.findByLabelText('E-mail'), 'pessoa@catdog.test');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(apiDublada.resendConfirmation).toHaveBeenCalledWith('pessoa@catdog.test');
    });

    await waitFor(() => {
      // Variante `info` e nao `success`: a resposta e sempre `202` com a mesma
      // frase generica, exista a conta ou nao — ela nao afirma que um e-mail saiu.
      expect(screen.getByText(MENSAGEM_DO_REENVIO)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('E-mail')).toBeNull();
  });

  it('CT-07: e-mail invalido no pedido de novo link NAO gera requisicao', async () => {
    const usuario = userEvent.setup();

    renderizar();

    await usuario.type(await screen.findByLabelText('E-mail'), 'sem-arroba');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    });

    expect(apiDublada.resendConfirmation).not.toHaveBeenCalled();
  });

  it('CT-07: falha no pedido de novo link exibe a mensagem do erro', async () => {
    const usuario = userEvent.setup();

    apiDublada.resendConfirmation.mockRejectedValue(
      erroDaApi(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Tente novamente em alguns minutos.'),
    );

    renderizar();

    await usuario.type(await screen.findByLabelText('E-mail'), 'pessoa@catdog.test');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(screen.getByText('Muitas tentativas. Tente novamente em alguns minutos.')).toBeInTheDocument();
    });
  });

  it('CT-07: falha que nao e ApiError no pedido de novo link cai na mensagem generica', async () => {
    const usuario = userEvent.setup();

    apiDublada.resendConfirmation.mockRejectedValue(new TypeError('sem rede'));

    renderizar();

    await usuario.type(await screen.findByLabelText('E-mail'), 'pessoa@catdog.test');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(screen.getByText('Ocorreu um erro inesperado. Tente novamente.')).toBeInTheDocument();
    });
  });
});
