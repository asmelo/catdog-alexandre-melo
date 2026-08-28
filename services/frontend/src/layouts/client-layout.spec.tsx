import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { ClientLayout } from '~/layouts/client-layout';
import { ROUTE_PATHS } from '~/routes/route-paths';

import {
  criarSessao,
  renderizarComSessao,
  USUARIO_CLIENTE,
} from '../../tests/auth-harness';

/**
 * A moldura da area do cliente.
 *
 * A REGRA CENTRAL do arquivo sob teste e uma AUSENCIA: nenhum controle
 * administrativo existe no DOM — nem oculto, nem desabilitado, nem escondido por
 * CSS. A FEATURE-003 acrescentou um item de navegacao a ele, e este spec existe
 * para verificar que o item novo entrou SEM afrouxar aquela regra.
 */

function renderizar(rota: string = ROUTE_PATHS.CLIENT_HOME): void {
  const sessao = criarSessao({ status: 'authenticated', user: USUARIO_CLIENTE });

  renderizarComSessao(
    <Routes>
      <Route element={<ClientLayout />}>
        <Route path={ROUTE_PATHS.CLIENT_HOME} element={<p>minha área</p>} />
        <Route path={ROUTE_PATHS.SHOWCASE} element={<p>vitrine</p>} />
      </Route>
    </Routes>,
    { sessao: sessao.valor, rota },
  );
}

describe('CT-116: o caminho para a vitrine', () => {
  it('a navegação do cliente traz "Minha área" e "Animais para adoção"', () => {
    // Arrange & Act — sem o item, o cliente autenticado não teria como chegar à
    // vitrine pela aplicação.
    renderizar();

    const navegacao = screen.getByRole('navigation', { name: 'Navegação do cliente' });
    const itens = within(navegacao).getAllByRole('link');

    // Assert
    expect(itens.map((item) => item.textContent)).toEqual([
      'Minha área',
      'Animais para adoção',
    ]);
    expect(itens[1]).toHaveAttribute('href', ROUTE_PATHS.SHOWCASE);
  });

  it('`end` em "Minha área": ela NÃO fica ativa quando a vitrine está aberta', () => {
    // Arrange & Act
    renderizar(ROUTE_PATHS.SHOWCASE);

    const navegacao = screen.getByRole('navigation', { name: 'Navegação do cliente' });
    const itens = within(navegacao).getAllByRole('link');

    // Assert
    expect(itens[0]).not.toHaveAttribute('aria-current');
    expect(itens[1]).toHaveAttribute('aria-current', 'page');
  });
});

describe('CT-117: nenhum controle administrativo, nem depois do item novo', () => {
  it('não há link para /admin, nem a palavra "Administrador", em lugar nenhum do DOM', () => {
    // Arrange & Act — a verificação é por AUSÊNCIA no DOM, e não por estilo ou
    // visibilidade: um controle renderizado e coberto por CSS já vazou.
    renderizar();

    // Assert
    expect(screen.queryByText('Administrador')).not.toBeInTheDocument();

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toContain('/admin');
    }

    expect(document.body.innerHTML).not.toContain('/admin');
  });

  it('o item novo aponta para uma rota PÚBLICA, e não administrativa', () => {
    renderizar();

    expect(screen.getByRole('link', { name: 'Animais para adoção' })).toHaveAttribute(
      'href',
      '/animais',
    );
  });
});
