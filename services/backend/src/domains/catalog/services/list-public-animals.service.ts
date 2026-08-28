import { AnimalSex, AnimalSize } from '@prisma/client';

import type {
  PaginatedResult,
  PublicAnimal,
  PublicCatalogFilters,
} from '~/domains/catalog/catalog.types';
import type {
  ListPublicAnimalsQuery,
  PublicSexFilter,
  PublicSizeFilter,
} from '~/domains/catalog/catalog.validators';
import { toPublicAnimal } from '~/domains/catalog/mappers/public-animal.mapper';
import type { PublicCatalogRepository } from '~/domains/catalog/repositories/public-catalog.repository';
import { now } from '~/utils/clock';

/**
 * Traducao do vocabulario do CONTRATO para o do BANCO.
 *
 * A conversao acontece aqui, e nao no validador: o schema pertence a borda HTTP e
 * nao deve conhecer os enums do Prisma. `Record` fechado e nao `toUpperCase()` —
 * acrescentar um porte ao contrato sem acrescentar a traducao quebra a
 * COMPILACAO, enquanto o `toUpperCase()` produziria um valor que o banco recusa
 * em tempo de execucao.
 */
const PORTE_PERSISTIDO: Readonly<Record<PublicSizeFilter, AnimalSize>> = {
  pequeno: AnimalSize.PEQUENO,
  medio: AnimalSize.MEDIO,
  grande: AnimalSize.GRANDE,
};

const SEXO_PERSISTIDO: Readonly<Record<PublicSexFilter, AnimalSex>> = {
  macho: AnimalSex.MACHO,
  femea: AnimalSex.FEMEA,
};

/**
 * Caso de uso da listagem publica.
 *
 * ================ NENHUMA REGRA DE NEGOCIO NOVA MORA AQUI ================
 *
 * O recorte por situacao, a ordenacao, o desempate e TODOS os filtros ja vivem na
 * consulta (TASK-BACKEND-002). Este service traduz vocabulario, chama a porta e
 * monta a projecao — nada mais.
 *
 * Em particular, ele NAO filtra em memoria e NAO recorta lista. Fazer isso
 * quebraria as duas coisas de uma vez: o `total` passaria a contar o que o banco
 * devolveu em vez do conjunto filtrado, e a paginacao passaria a pular registros
 * (RN-11, RN-44).
 *
 * Nao lanca erro de dominio. As unicas falhas possiveis neste endpoint acontecem
 * ANTES dele — validacao e limitador.
 */
export class ListPublicAnimalsService {
  constructor(private readonly catalog: PublicCatalogRepository) {}

  async execute(query: ListPublicAnimalsQuery): Promise<PaginatedResult<PublicAnimal>> {
    const filtros: PublicCatalogFilters = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search === undefined ? {} : { search: query.search }),
      ...(query.speciesId === undefined ? {} : { speciesId: query.speciesId }),
      ...(query.cityId === undefined ? {} : { cityId: query.cityId }),
      ...(query.size === undefined ? {} : { size: PORTE_PERSISTIDO[query.size] }),
      ...(query.sex === undefined ? {} : { sex: SEXO_PERSISTIDO[query.sex] }),
      ...(query.maxAgeYears === undefined ? {} : { maxAgeYears: query.maxAgeYears }),
    };

    const pagina = await this.catalog.listAvailableAnimals(filtros);

    /**
     * O instante e capturado UMA VEZ e passado a cada item.
     *
     * Chamar `now()` dentro do montador daria doze relogios ligeiramente
     * diferentes numa pagina de doze cartoes, e um animal que faz aniversario no
     * milissegundo da resposta poderia sair com idade diferente de outro da mesma
     * lista — uma inconsistencia rara, nao reproduzivel e impossivel de explicar.
     */
    const instante = now();

    return {
      items: pagina.items.map((linha) => toPublicAnimal(linha, instante)),
      pagination: pagina.pagination,
    };
  }
}
