import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ShowcaseLayout } from '~/layouts/showcase-layout';
import { ROUTE_PATHS } from '~/routes/route-paths';

import {
  criarSessao,
  renderizarComSessao,
  USUARIO_ADMIN,
  USUARIO_CLIENTE,
  type EstadoDublado,
  type SessaoDublada,
} from '../../tests/auth-harness';

/**
 * O cabecalho da VITRINE PUBLICA.
 *
 * Os tres estados de sessao sao o assunto, e o terceiro — `bootstrapping` — e o
 * que costuma faltar: exibir "Entrar" enquanto a aplicacao ainda nao sabe se ha
 * sessao faz o cabecalho piscar a cada carga de pagina de quem esta logado.
 */

function renderizar(estado: EstadoDublado): SessaoDublada {
  const sessao = criarSessao(estado);

  renderizarComSessao(
    <Routes>
      <Route element={<ShowcaseLayout />}>
        <Route path={ROUTE_PATHS.SHOWCASE} element={<p>conteúdo da vitrine</p>} />
      </Route>
    </Routes>,
    { sessao: sessao.valor, rota: ROUTE_PATHS.SHOWCASE },
  );

  return sessao;
}

describe('CT-05: sem sessão', () => {
  it('exibe o logotipo, "Entrar" e "Criar conta", e NENHUMA identificação de usuário', () => {
    // Arrange & Act
    renderizar({ status: 'anonymous', user: null });

    // Assert — `anonymous` é o caso NORMAL desta tela, não um erro.
    expect(screen.getByRole('link', { name: 'CatDog — início' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro');
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });
});

describe('CT-06: com sessão', () => {
  it('exibe o NOME e "Sair" — e o e-mail NÃO aparece em lugar nenhum do documento', () => {
    // Arrange & Act
    renderizar({ status: 'authenticated', user: USUARIO_CLIENTE });

    // Assert — e-mail é dado pessoal numa página pública, passível de ser vista
    // por terceiros sobre o ombro (RN-06).
    expect(screen.getByText(USUARIO_CLIENTE.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(USUARIO_CLIENTE.email);
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('o `admin` vê o mesmo cabeçalho que o `cliente` — a vitrine não tem área privilegiada', () => {
    renderizar({ status: 'authenticated', user: USUARIO_ADMIN });

    expect(screen.getByText(USUARIO_ADMIN.name)).toBeInTheDocument();
    expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('nome ausente NÃO cai no e-mail: não exibe nada no lugar', () => {
    // Arrange & Act — o e-mail não é alternativa (Decisão 2).
    renderizar({
      status: 'authenticated',
      user: { ...USUARIO_CLIENTE, name: '' },
    });

    // Assert
    expect(document.body.textContent).not.toContain(USUARIO_CLIENTE.email);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});

describe('CT-07: durante o bootstrap', () => {
  it('NEM "Entrar"/"Criar conta" NEM nome/"Sair" estão no DOM', () => {
    // Arrange & Act — a aplicação ainda não sabe se há sessão. Exibir qualquer
    // uma das duas alternativas produziria um piscar, e a pior delas seria
    // convidar a entrar quem já entrou.
    renderizar({ status: 'bootstrapping', user: null });

    // Assert
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Criar conta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    // O logotipo e o conteúdo continuam lá: a vitrine não espera a sessão.
    expect(screen.getByRole('link', { name: 'CatDog — início' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo da vitrine')).toBeInTheDocument();
  });
});

describe('CT-08: sair', () => {
  it('aciona `logout` e PERMANECE em /animais — nenhuma navegação ocorre', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const sessao = renderizar({ status: 'authenticated', user: USUARIO_CLIENTE });

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Sair' }));

    // Assert — expulsar quem acabou de sair de uma tela que não exige sessão
    // seria incoerente (RN-07).
    expect(sessao.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('localizacao-atual')).toHaveTextContent(ROUTE_PATHS.SHOWCASE);
  });
});

describe('CT-09: acessibilidade do botão "Sair"', () => {
  it('anuncia "Sair" UMA vez — o ícone é decorativo', () => {
    // Arrange & Act
    renderizar({ status: 'authenticated', user: USUARIO_CLIENTE });

    // Assert — o nome acessível é exatamente "Sair", e não "Sair Sair" nem o
    // conteúdo do SVG.
    const sair = screen.getByRole('button', { name: 'Sair' });

    expect(sair).toHaveAccessibleName('Sair');
    expect(sair.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('HU-02 cenário 6: o logotipo', () => {
  it('aponta para a própria vitrine, e não para a raiz', () => {
    // Arrange & Act — a raiz decide o destino por role dentro do
    // `ProtectedRoute`, e mandaria o visitante anônimo ao login.
    renderizar({ status: 'anonymous', user: null });

    // Assert
    expect(screen.getByRole('link', { name: 'CatDog — início' })).toHaveAttribute(
      'href',
      ROUTE_PATHS.SHOWCASE,
    );
  });
});

describe('estrutura do layout', () => {
  it('usa landmarks semânticos e NÃO declara região de navegação', () => {
    // Arrange & Act — a captura mostra o cabeçalho sem itens de navegação, e uma
    // região com um único link seria ruído para quem percorre por landmarks.
    renderizar({ status: 'anonymous', user: null });

    // Assert
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
