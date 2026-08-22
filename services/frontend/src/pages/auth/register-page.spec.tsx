import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';

import { RegisterPage } from '~/pages/auth/register-page';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError } from '~/services/api/api-error';

import {
  ID_DA_LOCALIZACAO,
  criarSessao,
  renderizarComSessao,
  type SessaoDublada,
} from '../../../tests/auth-harness';

/**
 * Specs da tela de cadastro — CT-01 a CT-05.
 *
 * A asserção central e NEGATIVA e aparece em dois lugares: a confirmacao de senha
 * nao pode trafegar (RN-12) e a validacao local que reprova nao pode gerar
 * requisicao (CT-03 / CT-04). Nos dois casos o que se mede e a ausencia de algo,
 * que e justamente o que um teste de "a tela mostra a mensagem certa" nao cobre.
 */

const NOME = 'Caio Cliente';
const EMAIL = 'pessoa@catdog.test';
const SENHA = 'Abc12345';

const TEXTO_DO_AVISO = 'Aviso de verificação de e-mail (destino)';

function ArvoreDeCadastro(): ReactElement {
  return (
    <Routes>
      <Route path={ROUTE_PATHS.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTE_PATHS.CHECK_EMAIL} element={<p>{TEXTO_DO_AVISO}</p>} />
      <Route path={ROUTE_PATHS.LOGIN} element={<p>Login (destino)</p>} />
    </Routes>
  );
}

function renderizarCadastro(): SessaoDublada {
  const sessao = criarSessao();

  renderizarComSessao(<ArvoreDeCadastro />, { sessao: sessao.valor, rota: ROUTE_PATHS.REGISTER });

  return sessao;
}

function botaoDeCriarConta(): HTMLElement {
  return screen.getByRole('button', { name: /^(Criar conta|Aguarde…)$/u });
}

async function preencherFormulario(
  usuario: ReturnType<typeof userEvent.setup>,
  confirmacao = SENHA,
): Promise<void> {
  await usuario.type(screen.getByLabelText('Nome completo'), NOME);
  await usuario.type(screen.getByLabelText('E-mail'), EMAIL);
  await usuario.type(screen.getByLabelText('Senha'), SENHA);
  await usuario.type(screen.getByLabelText('Confirmação de senha'), confirmacao);
}

describe('RegisterPage — cadastro bem-sucedido', () => {
  it('CT-01: cadastro valido leva ao aviso de verificacao de e-mail', async () => {
    const usuario = userEvent.setup();

    renderizarCadastro();

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByTestId(ID_DA_LOCALIZACAO)).toHaveTextContent(ROUTE_PATHS.CHECK_EMAIL);
    });

    // O registro NAO autentica: a conta nasce `PENDING_CONFIRMATION`, entao o
    // destino e o aviso, e nao a home de uma role.
    expect(screen.getByText(TEXTO_DO_AVISO)).toBeInTheDocument();
  });

  it('RN-12: a confirmacao de senha NAO trafega', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(sessao.register).toHaveBeenCalledTimes(1);
    });

    const [enviado] = sessao.register.mock.calls[0] ?? [];

    expect(enviado).toEqual({ name: NOME, email: EMAIL, password: SENHA });
    // A verificacao por CHAVES, e nao apenas por igualdade: uma chave extra com
    // valor `undefined` passaria no `toEqual` e viraria `400 VALIDATION_ERROR` no
    // servidor, porque o schema reprova qualquer chave a mais.
    expect(Object.keys(enviado ?? {})).toEqual(['name', 'email', 'password']);
    expect(enviado).not.toHaveProperty('passwordConfirmation');
  });
});

describe('RegisterPage — validacao local', () => {
  it('CT-03/CT-04: validacao local que reprova NAO chama a API', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      // Quatro campos obrigatorios reportados de uma vez.
      expect(screen.getAllByText('Este campo é obrigatório.')).toHaveLength(4);
    });

    // A AUSENCIA DE REQUISICAO e o que o criterio cobra.
    expect(sessao.register).not.toHaveBeenCalled();
  });

  it('CT-04: senhas divergentes reprovam no cliente, sem requisicao', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    await preencherFormulario(usuario, `${SENHA}x`);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
    });

    expect(sessao.register).not.toHaveBeenCalled();
  });

  it('CT-03: senha curta reprova no cliente, sem requisicao', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    await usuario.type(screen.getByLabelText('Nome completo'), NOME);
    await usuario.type(screen.getByLabelText('E-mail'), EMAIL);
    await usuario.type(screen.getByLabelText('Senha'), 'Abc1234');
    await usuario.type(screen.getByLabelText('Confirmação de senha'), 'Abc1234');
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument();
    });

    expect(sessao.register).not.toHaveBeenCalled();
  });
});

describe('RegisterPage — falhas da API', () => {
  it('CT-05: e-mail em uso exibe a mensagem do backend e MANTEM os campos preenchidos', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    sessao.register.mockRejectedValue(
      new ApiError({ status: 409, code: 'EMAIL_ALREADY_IN_USE', message: 'Este e-mail já está em uso.' }),
    );

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Este e-mail já está em uso.');
    });

    // Perder o que foi digitado obrigaria o usuario a refazer o formulario inteiro
    // por causa de um unico campo.
    expect(screen.getByLabelText('Nome completo')).toHaveValue(NOME);
    expect(screen.getByLabelText('E-mail')).toHaveValue(EMAIL);
  });

  it('VALIDATION_ERROR da API vira erro POR CAMPO, sem aviso de topo', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    sessao.register.mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: [{ field: 'email', message: 'Informe um e-mail válido.' }],
      }),
    );

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('erro que NAO e ApiError cai na mensagem generica', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    sessao.register.mockRejectedValue(new TypeError('undefined is not a function'));

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado. Tente novamente.');
    });
  });

  it('o botao fica disabled durante a requisicao e dois cliques disparam UMA chamada', async () => {
    const usuario = userEvent.setup();
    const sessao = renderizarCadastro();

    let liberar: () => void = () => undefined;

    sessao.register.mockReturnValue(
      new Promise<void>((resolve) => {
        liberar = () => {
          resolve();
        };
      }),
    );

    await preencherFormulario(usuario);
    await usuario.click(botaoDeCriarConta());

    await waitFor(() => {
      expect(botaoDeCriarConta()).toBeDisabled();
    });

    // Sempre `userEvent`: um `form.dispatchEvent(new Event('submit'))` nao passa
    // pela verificacao de `disabled` do navegador e mediria o oposto do
    // comportamento real.
    await usuario.click(botaoDeCriarConta());
    await usuario.type(screen.getByLabelText('Confirmação de senha'), '{Enter}');

    expect(sessao.register).toHaveBeenCalledTimes(1);

    liberar();

    await waitFor(() => {
      expect(screen.getByTestId(ID_DA_LOCALIZACAO)).toHaveTextContent(ROUTE_PATHS.CHECK_EMAIL);
    });
  });

  it('oferece o caminho de volta para quem ja tem conta', () => {
    renderizarCadastro();

    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.LOGIN,
    );
  });
});
