import { useEffect, useState } from 'react';

import * as catalogApi from '~/services/api/catalog-api';
import type { CatalogCityOption, CatalogSpeciesOption } from '~/services/api/catalog-api';

export interface FilterOptions {
  readonly species: readonly CatalogSpeciesOption[];
  readonly cities: readonly CatalogCityOption[];
  readonly speciesError: boolean;
  readonly citiesError: boolean;
}

/**
 * As opcoes dos dois campos de selecao, carregadas UMA vez na montagem.
 *
 * ============ A FALHA AQUI NAO BLOQUEIA A GRADE ============
 *
 * Sao tres consultas INDEPENDENTES — animais, especies, cidades — e um
 * `Promise.all` unico faria uma derrubar as outras: uma falha ao carregar as
 * cidades esconderia a vitrine inteira, que e o oposto do que a CA-39 pede.
 *
 * Aqui as duas correm em promessas separadas, com estados de erro INDEPENDENTES
 * por lista. A grade nem sabe que este hook existe.
 *
 * ============ NAO RECARREGAM QUANDO OS FILTROS MUDAM ============
 *
 * As listas derivam do catalogo DISPONIVEL, e nao do recorte filtrado (RN-30,
 * RN-31): filtrar por "Gato" nao pode remover "Cachorro" das opcoes, senao o
 * visitante fica preso na escolha que fez.
 */
export function useFilterOptions(): FilterOptions {
  const [species, setSpecies] = useState<readonly CatalogSpeciesOption[]>([]);
  const [cities, setCities] = useState<readonly CatalogCityOption[]>([]);
  const [speciesError, setSpeciesError] = useState(false);
  const [citiesError, setCitiesError] = useState(false);

  useEffect(() => {
    let ativo = true;

    catalogApi
      .listCatalogSpecies()
      .then((resposta) => {
        if (ativo) {
          setSpecies(resposta.items);
        }
      })
      .catch(() => {
        if (ativo) {
          setSpeciesError(true);
        }
      });

    catalogApi
      .listCatalogCities()
      .then((resposta) => {
        if (ativo) {
          setCities(resposta.items);
        }
      })
      .catch(() => {
        if (ativo) {
          setCitiesError(true);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  return { species, cities, speciesError, citiesError };
}
