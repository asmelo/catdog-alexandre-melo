import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdminLayout } from '~/layouts/admin-layout';
import { ROUTE_PATHS } from '~/routes/route-paths';

import {
  USUARIO_ADMIN,
  criarSessao,
  renderizarComSessao,
  type SessaoDublada,
} from '../../tests/auth-harness';

/**
 * Specs da moldura da area administrativa — CT-40 e a parte do CA-10 que a
 * FEATURE-002 consulta.
 *
 * NENHUMA ASSERÇÃO SOBRE CLASSE DE COR, e a omissao e deliberada. O par
 * ativo/inativo da barra lateral ainda esta em movimento (icones, fundo do
 * `<main>`, peso do fio de separacao), e um `expect` sobre `bg-brand-purple`
 * transformaria a proxima decisao de produto em teste vermelho sem que nenhum
 * comportamento tivesse mudado. O que E contrato aqui — porque chega ao leitor de
 * tela e ao roteador — sao `aria-current`, `href` e os nomes acessiveis.
 *
 * O layout e montado DIRETAMENTE, fora do mapa de rotas: e a unica forma de
 * observar a navegacao numa rota arbitraria da area (item inativo) e de exercitar
 * o ramo sem usuario no contexto. `app-routes.spec.tsx` cobre a montagem dentro do
 * mapa.
 */

function renderizarLayout(rota: string = ROUTE_PATHS.ADMIN_SPECIES): SessaoDublada {
  const sessao = criarSessao({ status: 'authenticated', user: USUARIO_ADMIN });

  renderizarComSessao(<AdminLayout />, { sessao: sessao.valor, rota });

  return sessao;
}

function itensDaNavegacao(): ReadonlyArray<HTMLElement> {
  return screen.getAllByRole('link');
}

describe('AdminLayout — navegacao lateral', () => {
  it('CT-40: a navegacao tem EXATAMENTE dois itens, "Animais" e "Espécies", nessa ordem', () => {
    // Arrange
    renderizarLayout();

    // Act
    const itens = itensDaNavegacao();

    // Assert
    // A quantidade faz parte do criterio: um terceiro item que aparecesse por
    // engano (ou o "Painel" removido voltando) reprova aqui.
    expect(itens).toHaveLength(2);
    expect(itens.map((item) => item.textContent)).toEqual(['Animais', 'Espécies']);
  });

  it('CT-40: cada item aponta para o caminho canonico de `ROUTE_PATHS`', () => {
    // Arrange
    renderizarLayout();

    // Act
    const animais = screen.getByRole('link', { name: 'Animais' });
    const especies = screen.getByRole('link', { name: 'Espécies' });

    // Assert
    /**
     * "Animais" aponta para uma rota que AINDA NAO TEM PAGINA, e isso e
     * deliberado: o item precisa estar visivel (CA-01) e, enquanto a feature de
     * animais nao existir, o destino cai no catch-all administrativo e mostra a
     * 404 do projeto — a informacao honesta. Desabilita-lo, esconde-lo ou
     * aponta-lo para `/admin/especies` seriam as tres formas de mentir sobre isso.
     */
    expect(animais).toHaveAttribute('href', ROUTE_PATHS.ADMIN_ANIMALS);
    expect(animais).toHaveAttribute('href', '/admin/animais');
    expect(especies).toHaveAttribute('href', ROUTE_PATHS.ADMIN_SPECIES);
  });

  it('CT-40: "Espécies" e anunciado como a pagina atual quando a rota e /admin/especies', () => {
    // Arrange
    renderizarLayout(ROUTE_PATHS.ADMIN_SPECIES);

    // Act
    const especies = screen.getByRole('link', { name: 'Espécies' });
    const animais = screen.getByRole('link', { name: 'Animais' });

    // Assert
    // O `NavLink` marca `aria-current="page"` sozinho: a indicacao de "onde
    // estou" chega ao leitor de tela sem nenhum atributo escrito a mao, e a
    // pilula roxa e apenas o reforco visual dela.
    expect(especies).toHaveAttribute('aria-current', 'page');
    expect(animais).not.toHaveAttribute('aria-current');
  });

  it('CT-40: nenhum item fica marcado como atual numa rota que a navegacao nao possui', () => {
    // Arrange
    renderizarLayout('/admin/outra-tela');

    // Act
    const marcados = itensDaNavegacao().filter((item) => item.hasAttribute('aria-current'));

    // Assert
    expect(marcados).toEqual([]);
  });

  it('CA-01: NAO existe item algum chamado "Painel" — a topbar de um item so foi substituida', () => {
    // Arrange
    renderizarLayout();

    // Act
    const painel = screen.queryByRole('link', { name: /Painel/u });

    // Assert
    // Ausencia no DOM, e nao ocultacao: `/admin` deixou de renderizar pagina
    // propria (decisao 4 do changelog) e o texto do bloco `ADMIN_HOME` foi
    // REMOVIDO do catalogo de mensagens.
    expect(painel).toBeNull();
    expect(screen.queryByText(/Painel/u)).toBeNull();
  });

  it('a navegacao e um landmark NOMEADO, para o leitor de tela poder pula-la', () => {
    // Arrange
    renderizarLayout();

    // Act
    const navegacao = screen.getByRole('navigation', { name: 'Navegação administrativa' });

    // Assert
    // Landmarks de verdade (`<header>`, `<nav>`, `<main>`) e nao `<div>`: a
    // diferenca nao aparece na tela, so na navegacao assistiva.
    expect(navegacao).toBeInTheDocument();
    expect(screen.getByRole('banner')).toContainElement(navegacao);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('AdminLayout — identificacao da sessao', () => {
  it('CA-10: exibe o PERFIL "Administrador" e o NOME da pessoa autenticada', () => {
    // Arrange
    renderizarLayout();

    // Act
    const perfil = screen.getByText('Administrador');

    // Assert
    /**
     * Os dois juntos sao o que torna o layout administrativo reconhecivel por
     * consulta ao DOM — e e exatamente por este texto que os testes de
     * redirecionamento por role da FEATURE-002 distinguem uma area da outra. Sem
     * ele, `app-routes.spec.tsx` deixaria de ter marcador.
     */
    expect(perfil).toBeInTheDocument();
    expect(screen.getByText(USUARIO_ADMIN.name)).toBeInTheDocument();
  });

  it('sem usuario no contexto, o layout nao imprime nome nenhum e nao lanca', () => {
    // Arrange
    const sessao = criarSessao({ status: 'authenticated', user: null });

    // Act
    renderizarComSessao(<AdminLayout />, {
      sessao: sessao.valor,
      rota: ROUTE_PATHS.ADMIN_SPECIES,
    });

    // Assert
    // Combinacao defensiva: `user` e `AuthUser | null` no contexto, e o layout
    // nao usa `!` nem `?.` para nao afirmar o que o tipo nao garante.
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText(USUARIO_ADMIN.name)).toBeNull();
  });

  it('o botao Sair chama logout uma unica vez', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const sessao = renderizarLayout();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Sair' }));

    // Assert
    expect(sessao.logout).toHaveBeenCalledTimes(1);
  });
});
