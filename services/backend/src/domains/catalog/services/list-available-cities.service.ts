import type {
  AvailableCityOption,
  PublicCatalogRepository,
} from '~/domains/catalog/repositories/public-catalog.repository';

/**
 * Opcoes do campo de selecao de CIDADE da vitrine.
 *
 * Distinto de `GET /api/states/:uf/cities` da FEATURE-002, que continua existindo
 * e nao foi tocado: aquele exige `admin`, pede a sigla do estado e devolve o
 * cadastro de apoio INTEIRO daquele estado, para o formulario de cadastro. Este e
 * publico, nao tem parametro e devolve so as cidades que tem animal disponivel.
 * Sao recursos diferentes com publicos diferentes.
 *
 * A cidade sai ACHATADA (`{ id, name, stateUf }`): o rotulo "Cidade - UF" e
 * composto na tela. O servidor devolve dado, nao texto de apresentacao.
 */
export interface AvailableCitiesResult {
  readonly items: ReadonlyArray<AvailableCityOption>;
}

export class ListAvailableCitiesService {
  constructor(private readonly catalog: PublicCatalogRepository) {}

  async execute(): Promise<AvailableCitiesResult> {
    return { items: await this.catalog.listCitiesWithAvailableAnimals() };
  }
}
