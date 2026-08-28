import { act, renderHook, waitFor } from '@testing-library/react';

import { useFilterOptions } from '~/pages/showcase/use-filter-options';
import { usePublicAnimals } from '~/pages/showcase/use-public-animals';
import * as catalogApi from '~/services/api/catalog-api';

/**
 * Os dois hooks da vitrine, nas bordas que a tela nao alcanca.
 *
 * O comportamento visivel de ambos e verificado em `showcase-page.spec.tsx`. O
 * que sobra para ca sao as guardas de DESMONTE — que so aparecem quando o
 * visitante sai da pagina antes de a resposta chegar — e a independencia entre as
 * duas consultas de opcoes.
 */

jest.mock('~/services/api/catalog-api');

const api = jest.mocked(catalogApi);

const ESPECIES = { items: [{ id: 'e1', name: 'Cachorro' }] };
const CIDADES = { items: [{ id: 'c1', name: 'Campo Magro', stateUf: 'PR' }] };

beforeEach(() => {
  api.listCatalogSpecies.mockResolvedValue(ESPECIES);
  api.listCatalogCities.mockResolvedValue(CIDADES);
  api.listPublicAnimals.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 12, total: 0 },
  });
});

describe('useFilterOptions', () => {
  it('carrega as duas listas em paralelo, uma única vez', async () => {
    // Arrange & Act
    const { result } = renderHook(() => useFilterOptions());

    // Assert
    await waitFor(() => {
      expect(result.current.species).toEqual(ESPECIES.items);
    });
    expect(result.current.cities).toEqual(CIDADES.items);
    expect(api.listCatalogSpecies).toHaveBeenCalledTimes(1);
    expect(api.listCatalogCities).toHaveBeenCalledTimes(1);
  });

  it('CA-39: a falha de UMA lista não derruba a outra', async () => {
    // Arrange — um `Promise.all` único faria a rejeição das cidades levar as
    // espécies junto.
    api.listCatalogCities.mockRejectedValue(new Error('rede caiu'));

    // Act
    const { result } = renderHook(() => useFilterOptions());

    // Assert
    await waitFor(() => {
      expect(result.current.citiesError).toBe(true);
    });
    expect(result.current.species).toEqual(ESPECIES.items);
    expect(result.current.speciesError).toBe(false);
  });

  it.each([
    { caminho: 'resolução', preparar: () => undefined },
    {
      caminho: 'rejeição',
      preparar: () => {
        api.listCatalogSpecies.mockRejectedValue(new Error('rede caiu'));
        api.listCatalogCities.mockRejectedValue(new Error('rede caiu'));
      },
    },
  ])('a $caminho que chega DEPOIS do desmonte não atualiza estado', async ({ preparar }) => {
    // Arrange — sem a guarda `ativo`, o React avisa "state update on an unmounted
    // component" e o aviso vira ruído em toda suíte que monte a vitrine.
    preparar();

    const avisos = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useFilterOptions());

    // Act
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Assert
    expect(avisos).not.toHaveBeenCalled();
  });
});

describe('usePublicAnimals — a guarda no caminho de ERRO', () => {
  it('a falha de uma consulta OBSOLETA é descartada como a resolução seria', async () => {
    // Arrange — o espelho do CT-36 no caminho de erro. Sem a guarda no `catch`, a
    // tela passaria de "pronto" para "erro" por causa de uma consulta que já não
    // interessa a ninguém.
    const rejeitadores = new Map<string, () => void>();

    api.listPublicAnimals.mockImplementation(
      (filtros) =>
        new Promise((resolver, rejeitar) => {
          rejeitadores.set(filtros?.search ?? '(sem)', () => {
            if (filtros?.search === 'obsoleta') {
              rejeitar(new Error('rede caiu'));
              return;
            }

            resolver({ items: [], pagination: { page: 1, pageSize: 12, total: 7 } });
          });
        }),
    );

    const { result, rerender } = renderHook(
      ({ search }: { search: string | undefined }) =>
        usePublicAnimals(search === undefined ? { page: 1 } : { search, page: 1 }),
      { initialProps: { search: 'obsoleta' as string | undefined } },
    );

    // Act — a consulta nova entra e resolve; a antiga falha depois.
    rerender({ search: undefined });

    await act(async () => {
      rejeitadores.get('(sem)')?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.tipo).toBe('pronto');
    });

    await act(async () => {
      rejeitadores.get('obsoleta')?.();
      await Promise.resolve();
    });

    // Assert — continua "pronto": a falha obsoleta não sobrescreve.
    expect(result.current.state.tipo).toBe('pronto');
  });
});
