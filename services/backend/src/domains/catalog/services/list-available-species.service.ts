import type {
  AvailableSpeciesOption,
  PublicCatalogRepository,
} from '~/domains/catalog/repositories/public-catalog.repository';

/**
 * Opcoes do campo de selecao de ESPECIE da vitrine.
 *
 * ============ ARQUIVO PROPRIO, E NAO UM "SERVICE DE OPCOES" ============
 *
 * O de cidades e outro caso de uso, com outra ordenacao. Um service unico com
 * dois metodos mudaria por dois motivos diferentes, e a primeira mudanca numa das
 * ordenacoes obrigaria a reler a outra.
 *
 * ================ SEM PAGINACAO, E A AUSENCIA E O CONTRATO ================
 *
 * Devolve `{ items }` e NAO `{ items, pagination }`. Acrescentar um `pagination`
 * vazio induziria o frontend a paginar o que nao pagina — e a lista, por
 * construcao, ja e curta: o recorte por disponibilidade e o limite.
 */
export interface AvailableSpeciesResult {
  readonly items: ReadonlyArray<AvailableSpeciesOption>;
}

export class ListAvailableSpeciesService {
  constructor(private readonly catalog: PublicCatalogRepository) {}

  async execute(): Promise<AvailableSpeciesResult> {
    return { items: await this.catalog.listSpeciesWithAvailableAnimals() };
  }
}
