import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';

import type { AuthUser } from '~/contexts/auth/auth.types';
import { LoginPage } from '~/pages/auth/login-page';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError } from '~/services/api/api-error';
import * as authApi from '~/services/api/auth-api';

import {
  ID_DA_LOCALIZACAO,
  USUARIO_ADMIN,
  USUARIO_CLIENTE,
  criarSessao,
  renderizarComSessao,
  type EstadoDublado,
  type SessaoDublada,
} from '../../../tests/auth-harness';

/**
 * Specs da tela de login — CT-09 a CT-13.
 *
 * DOIS dublês, e a divisao nao e arbitraria: `login` vem do CONTEXTO (a tela nao
 * conhece `authApi.login`, ela chama `useAuth().login`, e e o provider que amarra
 * a chamada de rede ao estado da sessao), enquanto `resendConfirmation` e chamada
 * DIRETO pela tela e por isso e dublada no modulo. Espelhar essa divisao no teste
 * e o que impede o spec de afirmar um acoplamento que o codigo nao tem.
 */
jest.mock('~/services/api/auth-api');

const apiDublada = jest.mocked(authApi);

/**
 * O TEXTO DA AC #6 EM UMA CONSTANTE SO.
 *
 * CT-11 (senha incorreta) e CT-12 (e-mail inexistente) devem exibir exatamente a
 * mesma frase — e a defesa contra enumeracao de contas. Com duas literais
 * separadas nos dois testes, uma divergencia de um unico caractere passaria os
 * dois; com uma constante compartilhada, "a mesma frase" e garantido pela
 * estrutura do teste e nao pela atencao de quem o le.
 */
const MENSAGEM_DE_CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';
const MENSAGEM_DE_CONTA_NAO_CONFIRMADA =
  'Sua conta ainda não foi confirmada. Verifique seu e-mail.';
const MENSAGEM_DO_REENVIO =
  'Se este e-mail estiver cadastrado e pendente de confirmação, enviaremos um novo link.';

const EMAIL_DIGITADO = 'pessoa@catdog.test';
const SENHA_DIGITADA = 'SenhaValida1';

const TEXTO_DA_HOME_DE_ADMIN = 'Painel administrativo (destino)';
const TEXTO_DA_HOME_DE_CLIENTE = 'Minha área (destino)';

function ArvoreDeLogin(): ReactElement {
  return (
    <Routes>
      <Route path={ROUTE_PATHS.LOGIN} element={<LoginPage />} />
      <Route path={ROUTE_PATHS.ADMIN_HOME} element={<p>{TEXTO_DA_HOME_DE_ADMIN}</p>} />
      <Route path={ROUTE_PATHS.CLIENT_HOME} element={<p>{TEXTO_DA_HOME_DE_CLIENTE}</p>} />
      <Route path={ROUTE_PATHS.REGISTER} element={<p>Cadastro (destino)</p>} />
    </Routes>
  );
}

function renderizarLogin(estado: EstadoDublado = {}): SessaoDublada {
  const sessao = criarSessao(estado);

  renderizarComSessao(<ArvoreDeLogin />, { sessao: sessao.valor, rota: ROUTE_PATHS.LOGIN });

  return sessao;
}

function botaoDeEntrar(): HTMLElement {
  return screen.getByRole('button', { name: 'Entrar' });
}

/**
 * O botao de submissao sob QUALQUER um dos seus dois rotulos.
 *
 * Enquanto a requisicao esta em voo o `SubmitButton` troca o texto por
 * "Aguarde…", entao consultar por "Entrar" deixaria de encontrar o elemento
 * exatamente no instante que o teste da trava precisa observar. A consulta por
 * papel + rotulo continua sendo a do usuario, e nao um seletor de CSS.
 */
function botaoDeSubmissao(): HTMLElement {
  return screen.getByRole('button', { name: /^(Entrar|Aguarde…)$/u });
}

/** Preenche os dois campos com credenciais que PASSAM na validacao local. */
async function preencherCredenciais(usuario: ReturnType<typeof userEvent.setup>): Promise<void> {
  await usuario.type(screen.getByLabelText('E-mail'), EMAIL_DIGITADO);
  await usuario.type(screen.getByLabelText('Senha'), SENHA_DIGITADA);
}

function rotaAtual(): string | null {
  return screen.getByTestId(ID_DA_LOCALIZACAO).textContent;
}

function erroDaApi(status: number, code: string, message: string): ApiError {
  return new ApiError({ status, code, message });
}

beforeEach(() => {
  apiDublada.resendConfirmation.mockResolvedValue({ message: MENSAGEM_DO_REENVIO });
});

describe('LoginPage — redirecionamento por role', () => {
  it('CT-09: login com credenciais corretas e role admin redireciona para o painel administrativo', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockResolvedValue(USUARIO_ADMIN);

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(rotaAtual()).toBe(ROUTE_PATHS.ADMIN_HOME);
    });

    expect(screen.getByText(TEXTO_DA_HOME_DE_ADMIN)).toBeInTheDocument();
    // O destino vem EXCLUSIVAMENTE da role devolvida pela API (RN-09), nao de
    // nada digitado na tela.
    expect(sessao.login).toHaveBeenCalledWith({ email: EMAIL_DIGITADO, password: SENHA_DIGITADA });
  });

  it('CT-10: login com credenciais corretas e role cliente redireciona para a área do cliente', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockResolvedValue(USUARIO_CLIENTE);

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    });

    expect(screen.getByText(TEXTO_DA_HOME_DE_CLIENTE)).toBeInTheDocument();
    // A area administrativa nao aparece em nenhum momento para um cliente.
    expect(screen.queryByText(TEXTO_DA_HOME_DE_ADMIN)).toBeNull();
  });

  it('o Enter em um campo submete o formulario, sem mouse', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockResolvedValue(USUARIO_CLIENTE);

    await preencherCredenciais(usuario);
    // `onSubmit` do `<form>`, e nao `onClick` do botao: e o que o navegador da de
    // graca e que um `onClick` jogaria fora (RNF-05).
    await usuario.keyboard('{Enter}');

    await waitFor(() => {
      expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    });
  });
});

describe('LoginPage — falhas de autenticacao', () => {
  it('CT-11: login com senha incorreta exibe "E-mail ou senha incorretos."', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(
      erroDaApi(401, 'INVALID_CREDENTIALS', MENSAGEM_DE_CREDENCIAL_INVALIDA),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    // `role="alert"` (implica `aria-live="assertive"`): a frase e anunciada no
    // momento em que aparece, sem o usuario precisar procurar.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA);
    });

    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
    // Sem botao de reenvio: aqui nao se sabe se a conta existe.
    expect(screen.queryByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeNull();
  });

  it('CT-12: login com e-mail inexistente exibe "E-mail ou senha incorretos." (a MESMA frase do CT-11)', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    // Mesmo `code` e mesma `message` que o CT-11 — o backend responde igual para
    // credencial errada e conta inexistente, por desenho: distinguir as duas
    // permitiria enumerar contas cadastradas.
    sessao.login.mockRejectedValue(
      erroDaApi(401, 'INVALID_CREDENTIALS', MENSAGEM_DE_CREDENCIAL_INVALIDA),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA);
    });

    expect(rotaAtual()).toBe(ROUTE_PATHS.LOGIN);
  });

  it('CT-13: conta não confirmada exibe a mensagem e o botão de reenvio', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(
      erroDaApi(403, 'ACCOUNT_NOT_CONFIRMED', MENSAGEM_DE_CONTA_NAO_CONFIRMADA),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_CONTA_NAO_CONFIRMADA);
    });

    const reenvio = screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' });

    expect(reenvio).toBeInTheDocument();

    await usuario.click(reenvio);

    // Usa o e-mail JA digitado: nao ha campo extra, porque o endereco que produziu
    // o `ACCOUNT_NOT_CONFIRMED` e exatamente o que esta no estado.
    await waitFor(() => {
      expect(apiDublada.resendConfirmation).toHaveBeenCalledWith(EMAIL_DIGITADO);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DO_REENVIO);
    });

    // O botao SOBREVIVE a troca da mensagem, para uma segunda tentativa.
    expect(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeInTheDocument();
  });

  it('reenvio que falha exibe a mensagem do erro sem derrubar a tela', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(
      erroDaApi(403, 'ACCOUNT_NOT_CONFIRMED', MENSAGEM_DE_CONTA_NAO_CONFIRMADA),
    );
    apiDublada.resendConfirmation.mockRejectedValue(
      erroDaApi(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Tente novamente em alguns minutos.'),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());
    await usuario.click(await screen.findByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Muitas tentativas. Tente novamente em alguns minutos.',
      );
    });
  });

  it('reenvio que falha com erro NAO-ApiError cai na mensagem generica', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(
      erroDaApi(403, 'ACCOUNT_NOT_CONFIRMED', MENSAGEM_DE_CONTA_NAO_CONFIRMADA),
    );
    apiDublada.resendConfirmation.mockRejectedValue(new TypeError('sem rede'));

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());
    await usuario.click(await screen.findByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ocorreu um erro inesperado. Tente novamente.',
      );
    });
  });

  it('erro que NAO e ApiError cai na mensagem generica', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(new TypeError('undefined is not a function'));

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ocorreu um erro inesperado. Tente novamente.',
      );
    });
  });

  it('VALIDATION_ERROR da API vira erro POR CAMPO, sem aviso de topo', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    sessao.login.mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: [{ field: 'email', message: 'Informe um e-mail válido.' }],
      }),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    });

    // A mensagem pertence ao input que a causou; duplica-la no topo faria o leitor
    // de tela anunciar a mesma frase duas vezes.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
  });
});

describe('LoginPage — validacao local e trava de submissao', () => {
  it('validacao local que reprova NAO chama a API', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    await usuario.type(screen.getByLabelText('E-mail'), 'sem-arroba');
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    });

    // A AUSENCIA de requisicao e o que o criterio cobra, e nao apenas a mensagem.
    expect(sessao.login).not.toHaveBeenCalled();
    expect(screen.getByText('Este campo é obrigatório.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('o botao fica disabled durante a requisicao e dois cliques disparam UMA chamada', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin();

    let liberarLogin: (user: AuthUser) => void = () => undefined;

    // Promessa de resolucao MANUAL: mantem a requisicao em voo enquanto as
    // interacoes extras acontecem. Sem isso a primeira chamada resolveria antes do
    // segundo clique e o teste nao exercitaria a trava.
    sessao.login.mockReturnValue(
      new Promise<AuthUser>((resolve) => {
        liberarLogin = resolve;
      }),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    await waitFor(() => {
      expect(botaoDeSubmissao()).toBeDisabled();
    });

    // `aria-busy` so existe enquanto a requisicao esta em voo — em repouso seria
    // ruido no DOM.
    expect(botaoDeSubmissao()).toHaveAttribute('aria-busy', 'true');
    expect(botaoDeSubmissao()).toHaveTextContent('Aguarde…');
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();

    /**
     * TODAS as tentativas extras por `userEvent`, jamais por
     * `form.dispatchEvent(new Event('submit'))`.
     *
     * A distincao e material e foi levantada como risco na TASK-FRONTEND-012: um
     * `submit` despachado a mao NAO passa pela verificacao de `disabled` do
     * navegador e produziria uma segunda chamada, fazendo o teste "descobrir" um
     * defeito que nao existe no uso real. O que se mede aqui e o comportamento do
     * usuario: cliques e teclado.
     */
    await usuario.click(botaoDeSubmissao());
    await usuario.click(botaoDeSubmissao());
    await usuario.type(screen.getByLabelText('Senha'), '{Enter}');

    expect(sessao.login).toHaveBeenCalledTimes(1);

    liberarLogin(USUARIO_CLIENTE);

    await waitFor(() => {
      expect(rotaAtual()).toBe(ROUTE_PATHS.CLIENT_HOME);
    });

    expect(sessao.login).toHaveBeenCalledTimes(1);
  });
});

describe('LoginPage — aviso de sessao expirada', () => {
  it('exibe a mensagem de sessao expirada quando o motivo da saida foi session-expired', () => {
    renderizarLogin({ logoutReason: 'session-expired' });

    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Faça login novamente.');
  });

  it('o resultado da tentativa de login vence o aviso de sessao expirada', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarLogin({ logoutReason: 'session-expired' });

    sessao.login.mockRejectedValue(
      erroDaApi(401, 'INVALID_CREDENTIALS', MENSAGEM_DE_CREDENCIAL_INVALIDA),
    );

    await preencherCredenciais(usuario);
    await usuario.click(botaoDeEntrar());

    // Depois de uma tentativa, o resultado dela e a informacao relevante.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA);
    });

    expect(screen.queryByText('Sua sessão expirou. Faça login novamente.')).toBeNull();
  });

  it('nao renderiza o link de recuperacao de senha, que esta fora do escopo', () => {
    renderizarLogin();

    // Um link para um caminho morto e defeito de produto: o usuario clica e
    // descobre que o sistema nao tem a funcao depois de ter confiado que tinha.
    expect(screen.queryByText('Esqueceu sua senha?')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cadastre-se' })).toBeInTheDocument();
  });
});
