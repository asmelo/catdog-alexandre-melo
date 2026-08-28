import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ShowcasePage } from '~/pages/showcase/showcase-page';
import { ApiError } from '~/services/api/api-error';
import * as catalogApi from '~/services/api/catalog-api';
import type { PublicAnimal } from '~/services/api/catalog-api';
import { MESSAGES } from '~/utils/messages';

/**
 * A vitrine completa.
 *
 * O DUBLE E DO MODULO `catalog-api`, e nao do `fetch`: o objeto aqui e a TELA —
 * quais estados ela mostra, em que ordem decide e o que ela pede. O que sai no
 * `fetch` e assunto de `catalog-api.spec.ts`.
 */

jest.mock('~/services/api/catalog-api');

const api = jest.mocked(catalogApi);

const THEO: PublicAnimal = {
  id: 'a1',
  name: 'Theo',
  species: { id: 'e1', name: 'Cachorro' },
  size: 'grande',
  sex: 'macho',
  ageInYears: 3,
  ageInMonths: 45,
  description: 'Dócil e brincalhão.',
  acceptsOtherAnimals: true,
  needsLargeSpace: false,
  city: { name: 'Campo Magro', stateUf: 'PR' },
  coverImageUrl: null,
};

function animal(ajustes: Partial<PublicAnimal> & { readonly id: string }): PublicAnimal {
  return { ...THEO, ...ajustes };
}

function pagina(
  items: readonly PublicAnimal[],
  ajustes: { page?: number; pageSize?: number; total?: number } = {},
) {
  return {
    items,
    pagination: {
      page: ajustes.page ?? 1,
      pageSize: ajustes.pageSize ?? 12,
      total: ajustes.total ?? items.length,
    },
  };
}

function Endereco(): ReactElement {
  const local = useLocation();

  return <span data-testid="endereco">{`${local.pathname}${local.search}`}</span>;
}

function renderizar(rota = '/animais'): void {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Endereco />
      <Routes>
        <Route path="/animais" element={<ShowcasePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Espera a grade sair do estado de carregamento. */
async function aguardarGrade(): Promise<void> {
  await waitFor(() => {
    expect(api.listPublicAnimals).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(screen.queryByText(MESSAGES.SHOWCASE.LOADING_LABEL)).not.toBeInTheDocument();
  });
}

/**
 * O texto VISIVEL, excluindo a regiao viva.
 *
 * A regiao `aria-live` repete de proposito o que a tela mostra — e o mecanismo
 * que anuncia a mudanca de resultado a quem usa leitor de tela. Uma busca por
 * texto solto encontra os DOIS, e a duplicacao e o comportamento correto, nao um
 * defeito. Este auxiliar afirma sobre o que o visitante VE.
 */
function visivel(texto: string): HTMLElement | null {
  const candidatos = screen.queryAllByText(texto);

  return candidatos.find((elemento) => elemento.closest('[aria-live]') === null) ?? null;
}

/** A versão que espera o elemento aparecer. */
async function acharVisivel(texto: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(visivel(texto)).not.toBeNull();
  });

  const elemento = visivel(texto);

  if (elemento === null) {
    throw new Error(`Texto visível não encontrado: ${texto}`);
  }

  return elemento;
}

beforeEach(() => {
  api.listPublicAnimals.mockResolvedValue(pagina([THEO]));
  api.listCatalogSpecies.mockResolvedValue({ items: [{ id: 'e1', name: 'Cachorro' }] });
  api.listCatalogCities.mockResolvedValue({
    items: [{ id: 'c1', name: 'Campo Magro', stateUf: 'PR' }],
  });
});

describe('CT-01/CT-07: a vitrine não espera a sessão', () => {
  it('a consulta parte na montagem, sem ler estado de sessão', async () => {
    // Arrange & Act — a página é renderizada SEM `AuthContext`. Se ela lesse
    // `useAuth()`, o `useContext` devolveria o valor padrão e o hook lançaria.
    renderizar();

    // Assert
    await waitFor(() => {
      expect(api.listPublicAnimals).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Animais para adoção' })).toBeInTheDocument();
  });

  it('título, barra de filtros e grade são exibidos', async () => {
    renderizar();
    await aguardarGrade();

    expect(screen.getByRole('region', { name: 'Filtros da vitrine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
  });
});

describe('os cinco estados da grade — a ORDEM da decisão é a regra', () => {
  it('CT-94: carregando exibe o esqueleto, mantém a barra utilizável e NENHUMA mensagem de vazio', async () => {
    // Arrange — quem está esperando um resultado é justamente quem pode querer
    // mudar o filtro.
    api.listPublicAnimals.mockImplementation(() => new Promise(() => undefined));

    // Act
    renderizar();

    // Assert
    await waitFor(() => {
      expect(screen.getByLabelText('Buscar')).toBeEnabled();
    });
    expect(screen.queryByText(MESSAGES.SHOWCASE.EMPTY_CATALOG)).not.toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.SHOWCASE.EMPTY_FILTERED)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('CT-95: a falha exibe a mensagem com nova tentativa, e NENHUMA mensagem de vazio', async () => {
    // Arrange
    const usuario = userEvent.setup();

    api.listPublicAnimals.mockRejectedValueOnce(new Error('rede caiu'));

    renderizar();

    // Assert
    expect(await acharVisivel('Não foi possível carregar os animais. Tente novamente.')).toBeInTheDocument();
    expect(visivel(MESSAGES.SHOWCASE.EMPTY_CATALOG)).toBeNull();

    // Act — a nova tentativa refaz a consulta.
    api.listPublicAnimals.mockResolvedValue(pagina([THEO]));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.RETRY_BUTTON }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
  });

  it('CT-108: um 429 exibe a mensagem em PT-BR DO BACKEND, com nova tentativa', async () => {
    // Arrange — a frase do limitador é escrita no servidor e não pode ser
    // reinventada aqui. A ramificação é por `code`, nunca pelo texto.
    api.listPublicAnimals.mockRejectedValue(
      new ApiError({
        status: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      }),
    );

    // Act
    renderizar();

    // Assert — nunca tela em branco.
    expect(
      await acharVisivel('Muitas tentativas. Aguarde alguns minutos e tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MESSAGES.ANIMALS.RETRY_BUTTON })).toBeInTheDocument();
  });

  it('CT-91: catálogo vazio SEM filtros exibe a mensagem própria, e SEM ação', async () => {
    // Arrange
    api.listPublicAnimals.mockResolvedValue(pagina([]));

    // Act
    renderizar();

    // Assert — não há o que limpar nem para onde ir.
    expect(await acharVisivel(MESSAGES.SHOWCASE.EMPTY_CATALOG)).toBeInTheDocument();
    // O único "Limpar filtros" no DOM é o da barra, desabilitado — o estado vazio
    // do catálogo não traz ação.
    expect(screen.getAllByRole('button', { name: MESSAGES.SHOWCASE.CLEAR_FILTERS })).toHaveLength(1);
    expect(screen.getByRole('button', { name: MESSAGES.SHOWCASE.CLEAR_FILTERS })).toBeDisabled();
  });

  it('CT-92: vazio COM filtros exibe a mensagem de filtros, com a ação de limpar', async () => {
    // Arrange
    api.listPublicAnimals.mockResolvedValue(pagina([]));

    // Act
    renderizar('/animais?busca=nadaencontra');

    // Assert — o estado vazio traz a SUA própria ação, além da barra.
    expect(await acharVisivel(MESSAGES.SHOWCASE.EMPTY_FILTERED)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: MESSAGES.SHOWCASE.CLEAR_FILTERS })).toHaveLength(2);
  });

  it('CT-93: catálogo vazio E filtros aplicados → vale a mensagem de FILTROS', async () => {
    // Arrange — é a única que dá ao visitante algo a fazer, e por isso o ramo dela
    // é avaliado primeiro.
    api.listPublicAnimals.mockResolvedValue(pagina([], { total: 0 }));

    // Act
    renderizar('/animais?porte=grande');

    // Assert
    expect(await acharVisivel(MESSAGES.SHOWCASE.EMPTY_FILTERED)).toBeInTheDocument();
    expect(visivel(MESSAGES.SHOWCASE.EMPTY_CATALOG)).toBeNull();
  });

  it('CT-92: "Limpar filtros" do estado vazio faz a grade voltar a exibir os animais', async () => {
    // Arrange
    const usuario = userEvent.setup();

    api.listPublicAnimals.mockImplementation((filtros) =>
      Promise.resolve(filtros?.search === undefined ? pagina([THEO]) : pagina([])),
    );

    renderizar('/animais?busca=nadaencontra');

    const mensagem = await acharVisivel(MESSAGES.SHOWCASE.EMPTY_FILTERED);

    // Act — o botão dentro do estado vazio, e não o da barra.
    const vazio = mensagem.parentElement;

    await usuario.click(
      within(vazio as HTMLElement).getByRole('button', { name: MESSAGES.SHOWCASE.CLEAR_FILTERS }),
    );

    // Assert
    expect(await screen.findByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
  });
});

describe('CT-36/RN-53: resposta obsoleta é descartada por sequência', () => {
  it('a primeira consulta respondendo POR ÚLTIMO não sobrescreve a segunda', async () => {
    // Arrange — o cliente HTTP não oferece `AbortSignal`, então o descarte é da
    // tela. Sem ele, o visitante veria o resultado de "gato" com "ga" no campo.
    const usuario = userEvent.setup();
    const liberadores = new Map<string, () => void>();

    api.listPublicAnimals.mockImplementation(
      (filtros) =>
        new Promise((resolver) => {
          liberadores.set(filtros?.search ?? '(sem busca)', () => {
            resolver(
              filtros?.search === 'gato'
                ? pagina([animal({ id: 'obsoleto', name: 'Resultado obsoleto' })])
                : pagina([animal({ id: 'atual', name: 'Resultado atual' })]),
            );
          });
        }),
    );

    renderizar();

    await usuario.type(screen.getByLabelText('Buscar'), 'gato');
    await waitFor(() => {
      expect(liberadores.has('gato')).toBe(true);
    });

    await usuario.clear(screen.getByLabelText('Buscar'));
    await usuario.type(screen.getByLabelText('Buscar'), 'ga');
    await waitFor(() => {
      expect(liberadores.has('ga')).toBe(true);
    });

    // Act — a MAIS RECENTE resolve primeiro; a obsoleta, depois.
    liberadores.get('ga')?.();
    expect(await screen.findByRole('heading', { name: 'Resultado atual' })).toBeInTheDocument();

    liberadores.get('gato')?.();

    // Assert — a obsoleta é descartada.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Resultado obsoleto' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Resultado atual' })).toBeInTheDocument();
  });
});

describe('CT-97/CT-44: o resumo de resultados', () => {
  it('aparece SÓ com filtro aplicado, com concordância', async () => {
    // Arrange
    api.listPublicAnimals.mockResolvedValue(pagina([THEO], { total: 1 }));

    // Act
    renderizar('/animais?porte=grande');
    await aguardarGrade();

    // Assert
    expect(visivel('1 animal encontrado')).toBeInTheDocument();
  });

  it('concorda no plural', async () => {
    api.listPublicAnimals.mockResolvedValue(
      pagina([THEO, animal({ id: 'a2', name: 'Luna' }), animal({ id: 'a3', name: 'Nina' })], {
        total: 3,
      }),
    );

    renderizar('/animais?porte=grande');
    await aguardarGrade();

    expect(visivel('3 animais encontrados')).toBeInTheDocument();
  });

  it('CT-44: SEM filtro aplicado, nenhum resumo está no DOM', async () => {
    // Sem filtro, "13 animais encontrados" acima do catálogo inteiro não informa
    // nada — o total já é o que a grade mostra.
    renderizar();
    await aguardarGrade();

    // A região viva anuncia o resumo mesmo sem filtro; o que não pode existir é o
    // parágrafo VISÍVEL.
    const visiveis = screen
      .queryAllByText(/animais? encontrados?/)
      .filter((elemento) => elemento.closest('[aria-live]') === null);

    expect(visiveis).toEqual([]);
  });

  it('CT-98: a contagem é a do conjunto FILTRADO, e não a do catálogo', async () => {
    api.listPublicAnimals.mockResolvedValue(pagina([THEO], { total: 1 }));

    renderizar('/animais?especie=3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');
    await aguardarGrade();

    expect(visivel('1 animal encontrado')).toBeInTheDocument();
  });
});

describe('paginação', () => {
  it('CT-72: com um único animal, NENHUM controle está no DOM', async () => {
    renderizar();
    await aguardarGrade();

    expect(screen.queryByRole('navigation', { name: /Paginação/ })).not.toBeInTheDocument();
  });

  it('CT-73/CT-75: com total acima da página, os controles aparecem e os extremos desabilitam', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const doze = Array.from({ length: 12 }, (_, i) => animal({ id: `id-${String(i)}` }));

    api.listPublicAnimals.mockImplementation((filtros) =>
      Promise.resolve(pagina(doze, { page: filtros?.page ?? 1, total: 25 })),
    );

    renderizar();
    await aguardarGrade();

    // Assert — desabilitar, e não ocultar.
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(api.listPublicAnimals).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('a troca de página vai para o endereço, e o filtro NÃO se perde', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const doze = Array.from({ length: 12 }, (_, i) => animal({ id: `id-${String(i)}` }));

    api.listPublicAnimals.mockImplementation((filtros) =>
      Promise.resolve(pagina(doze, { page: filtros?.page ?? 1, total: 25 })),
    );

    renderizar('/animais?porte=grande');
    await aguardarGrade();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('endereco')).toHaveTextContent('porte=grande');
    });
    expect(screen.getByTestId('endereco')).toHaveTextContent('pagina=2');
  });

  it('CT-76: página além da última exibe a mensagem de vazio, SEM erro', async () => {
    // Arrange — o servidor responde 200 com lista vazia.
    api.listPublicAnimals.mockResolvedValue(pagina([], { page: 99, total: 5 }));

    // Act
    renderizar('/animais?pagina=99');

    // Assert
    expect(await acharVisivel(MESSAGES.SHOWCASE.EMPTY_CATALOG)).toBeInTheDocument();
    expect(visivel('Não foi possível carregar os animais. Tente novamente.')).toBeNull();
  });
});

describe('CT-96/CA-39: falha ao carregar as opções NÃO bloqueia a grade', () => {
  it('a grade continua sendo exibida e só o campo afetado informa a falha', async () => {
    // Arrange — três consultas independentes; um `Promise.all` único faria uma
    // derrubar as outras.
    api.listCatalogCities.mockRejectedValue(new Error('rede caiu'));

    // Act
    renderizar();
    await aguardarGrade();

    // Assert
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
    expect(visivel(MESSAGES.SHOWCASE.OPTIONS_LOAD_ERROR)).toBeInTheDocument();
  });
});

describe('CT-124/CA-53: a região viva', () => {
  it('há UMA região `polite`, e ela anuncia a mudança de resultado', async () => {
    // Arrange & Act — duas regiões competem e o leitor de tela perde uma.
    renderizar('/animais?porte=grande');
    await aguardarGrade();

    // Assert
    const regioes = document.querySelectorAll('[aria-live]');

    expect(regioes).toHaveLength(1);
    expect(regioes[0]).toHaveAttribute('aria-live', 'polite');
    expect(regioes[0]).toHaveAttribute('aria-atomic', 'true');
    expect(regioes[0]).toHaveTextContent('1 animal encontrado');
  });

  it('anuncia também os estados de vazio', async () => {
    api.listPublicAnimals.mockResolvedValue(pagina([]));

    renderizar();
    await aguardarGrade();

    expect(document.querySelector('[aria-live]')).toHaveTextContent(
      MESSAGES.SHOWCASE.EMPTY_CATALOG,
    );
  });
});

describe('CT-131/CA-48: a tela é exclusivamente de LEITURA', () => {
  it('nenhuma interação dispara escrita — só as três consultas existem', async () => {
    // Arrange
    const usuario = userEvent.setup();

    renderizar();
    await aguardarGrade();

    // Act — percorre a barra inteira.
    await usuario.selectOptions(screen.getByLabelText('Espécie'), 'e1');
    await usuario.type(screen.getByLabelText('Buscar'), 'theo');

    // Assert — o módulo dublado só expõe as três funções de leitura; se a página
    // chamasse qualquer escrita, ela não existiria no dublê e lançaria.
    await waitFor(() => {
      expect(api.listPublicAnimals).toHaveBeenCalled();
    });
    // `__esModule` é marca do transpilador, e não parte da superfície do módulo.
    expect(Object.keys(api).filter((chave) => chave !== '__esModule').sort()).toEqual([
      'listCatalogCities',
      'listCatalogSpecies',
      'listPublicAnimals',
    ]);
  });
});

describe('CT-82/CT-83: o estado vive no endereço', () => {
  it('um endereço com filtros preenche a barra e vai para a consulta', async () => {
    // Arrange & Act
    renderizar('/animais?busca=theo&porte=grande&pagina=2');
    await aguardarGrade();

    // Assert
    expect(screen.getByLabelText('Buscar')).toHaveValue('theo');
    expect(screen.getByLabelText('Porte')).toHaveValue('grande');
    expect(api.listPublicAnimals).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'theo', size: 'grande', page: 2 }),
    );
  });

  it('CT-86: um endereço estragado exibe a vitrine normalmente', async () => {
    // Arrange & Act
    renderizar('/animais?idadeMax=-5&porte=gigante&especie=abc&pagina=xyz&desconhecido=1');
    await aguardarGrade();

    // Assert — sem tela de erro, e a consulta parte sem os valores descartados.
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
    expect(api.listPublicAnimals).toHaveBeenCalledWith({ page: 1 });
  });
});
