import { AnimalStatus, type AnimalSex, type AnimalSize } from '@prisma/client';

import type {
  PaginatedResult,
  PublicAnimalRow,
  PublicCatalogFilters,
} from '~/domains/catalog/catalog.types';
import type {
  AvailableCityOption,
  AvailableSpeciesOption,
  PublicCatalogRepository,
} from '~/domains/catalog/repositories/public-catalog.repository';
import { birthDateCutoffForMaxAge } from '~/utils/age';
import { now } from '~/utils/clock';
import { normalizeForSearch } from '~/utils/text-normalizer';

import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Fake da porta do catalogo publico.
 *
 * ============ QUATRO COMPORTAMENTOS PRECISAM SER FIEIS ============
 *
 * Um fake frouxo faz a suite passar e a producao quebrar. Estes quatro sao os que
 * os testes de fato observam, e cada um corresponde a um defeito real:
 *
 * 1. o recorte por `DISPONIVEL` e FIXO — reproduzir isso e o que faz o teste dos
 *    quatro status significar alguma coisa;
 * 2. a ordenacao aplica os DOIS criterios (`createdAt desc`, `id asc`). Um fake
 *    que ordenasse so por data faria o CT-74 passar por acidente e a paginacao
 *    continuar nao deterministica em producao;
 * 3. o `total` e calculado DEPOIS de todos os filtros, nunca sobre a colecao
 *    inteira;
 * 4. a busca compara contra o `nameSearch` do ANIMAL e o da CIDADE, com
 *    `contains` simples e sem quebrar o texto em termos.
 */

/** Linha semeada: a projecao do banco mais o que os filtros precisam ler. */
export interface LinhaDeCatalogoDeTeste {
  readonly id?: string;
  readonly name?: string;
  readonly status?: AnimalStatus;
  readonly speciesId?: string;
  readonly speciesName?: string;
  readonly cityId?: string;
  readonly cityName?: string;
  readonly stateUf?: string;
  readonly size?: AnimalSize;
  readonly sex?: AnimalSex;
  readonly birthDate?: Date | null;
  readonly description?: string | null;
  readonly acceptsOtherAnimals?: boolean;
  readonly needsLargeSpace?: boolean;
  readonly createdAt?: Date;
  readonly storagePaths?: ReadonlyArray<string>;
}

/** A linha guardada: `PublicAnimalRow` mais as colunas que so o filtro le. */
interface LinhaGuardada extends PublicAnimalRow {
  readonly status: AnimalStatus;
  readonly speciesId: string;
  readonly cityId: string;
  readonly createdAt: Date;
  readonly nameSearch: string;
  readonly cityNameSearch: string;
}

const INSTANTE_PADRAO = new Date('2026-08-01T12:00:00.000Z');

export class ArmazemDoCatalogo implements Restauravel {
  private linhas: LinhaGuardada[] = [];

  private sequenciaDeCriacao = INSTANTE_PADRAO.getTime();

  get todas(): ReadonlyArray<LinhaGuardada> {
    return this.linhas;
  }

  semear(dados: LinhaDeCatalogoDeTeste = {}): LinhaGuardada {
    const name = dados.name ?? 'Theo';
    const cityName = dados.cityName ?? 'Campo Magro';

    const linha: LinhaGuardada = {
      id: dados.id ?? proximoUuid(),
      name,
      /**
       * Derivado pela FUNCAO DE PRODUCAO, e nao por uma normalizacao escrita a
       * mao: uma copia da regra aqui divergiria dela na primeira revisao, e a
       * busca seria testada contra a regra errada.
       */
      nameSearch: normalizeForSearch(name),
      status: dados.status ?? AnimalStatus.DISPONIVEL,
      speciesId: dados.speciesId ?? 'e1111111-1111-4111-8111-111111111111',
      cityId: dados.cityId ?? 'c1111111-1111-4111-8111-111111111111',
      cityNameSearch: normalizeForSearch(cityName),
      size: dados.size ?? 'MEDIO',
      sex: dados.sex ?? 'MACHO',
      birthDate: dados.birthDate ?? null,
      description: dados.description ?? null,
      acceptsOtherAnimals: dados.acceptsOtherAnimals ?? false,
      needsLargeSpace: dados.needsLargeSpace ?? false,
      createdAt: dados.createdAt ?? new Date((this.sequenciaDeCriacao += 1000)),
      species: {
        id: dados.speciesId ?? 'e1111111-1111-4111-8111-111111111111',
        name: dados.speciesName ?? 'Cachorro',
      },
      city: { name: cityName, state: { uf: dados.stateUf ?? 'PR' } },
      images: (dados.storagePaths ?? []).map((storagePath) => ({ storagePath })),
    };

    this.linhas.push(linha);

    return linha;
  }

  alterarStatus(id: string, status: AnimalStatus): void {
    this.linhas = this.linhas.map((linha) => (linha.id === id ? { ...linha, status } : linha));
  }

  /**
   * Contrato do `Restauravel`: captura o estado e devolve quem o desfaz. Usado
   * pelo `$transaction` dublado para reverter quando a callback lanca.
   */
  capturarEstado(): () => void {
    const linhas = [...this.linhas];
    const sequencia = this.sequenciaDeCriacao;

    return () => {
      this.linhas = linhas;
      this.sequenciaDeCriacao = sequencia;
    };
  }

  /** Zera entre testes. */
  restaurar(): void {
    this.linhas = [];
    this.sequenciaDeCriacao = INSTANTE_PADRAO.getTime();
  }
}

/**
 * Ordenacao da vitrine, com os DOIS criterios.
 *
 * O desempate por `id` e o que o CT-74 observa: sem ele, 45 registros de mesmo
 * `createdAt` percorridos em quatro paginas nao produzem 45 ids distintos.
 */
function ordenarComoAVitrine(linhas: ReadonlyArray<LinhaGuardada>): LinhaGuardada[] {
  return [...linhas].sort((a, b) => {
    const porData = b.createdAt.getTime() - a.createdAt.getTime();

    return porData !== 0 ? porData : a.id.localeCompare(b.id);
  });
}

export class InMemoryPublicCatalogRepository implements PublicCatalogRepository {
  constructor(private readonly armazem: ArmazemDoCatalogo) {}

  listAvailableAnimals(
    filters: PublicCatalogFilters,
  ): Promise<PaginatedResult<PublicAnimalRow>> {
    return comoPromessa(() => {
      const filtradas = this.armazem.todas.filter((linha) => this.passa(linha, filters));
      const ordenadas = ordenarComoAVitrine(filtradas);
      const inicio = (filters.page - 1) * filters.pageSize;

      return {
        items: ordenadas.slice(inicio, inicio + filters.pageSize).map(comoProjecao),
        /** DEPOIS dos filtros, e nao sobre a colecao inteira. */
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: filtradas.length,
        },
      };
    });
  }

  listSpeciesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableSpeciesOption>> {
    return comoPromessa(() => {
      const porId = new Map<string, AvailableSpeciesOption>();

      for (const linha of this.disponiveis()) {
        porId.set(linha.speciesId, { id: linha.species.id, name: linha.species.name });
      }

      return [...porId.values()].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    });
  }

  listCitiesWithAvailableAnimals(): Promise<ReadonlyArray<AvailableCityOption>> {
    return comoPromessa(() => {
      const porId = new Map<string, AvailableCityOption>();

      for (const linha of this.disponiveis()) {
        porId.set(linha.cityId, {
          id: linha.cityId,
          name: linha.city.name,
          stateUf: linha.city.state.uf,
        });
      }

      return [...porId.values()].sort(
        (a, b) => a.stateUf.localeCompare(b.stateUf) || a.name.localeCompare(b.name),
      );
    });
  }

  private disponiveis(): ReadonlyArray<LinhaGuardada> {
    return this.armazem.todas.filter((linha) => linha.status === AnimalStatus.DISPONIVEL);
  }

  private passa(linha: LinhaGuardada, filters: PublicCatalogFilters): boolean {
    /** FIXO. Nao ha caminho neste fake que devolva outro status. */
    if (linha.status !== AnimalStatus.DISPONIVEL) {
      return false;
    }

    if (
      filters.search !== undefined &&
      !linha.nameSearch.includes(filters.search) &&
      !linha.cityNameSearch.includes(filters.search)
    ) {
      return false;
    }

    if (filters.speciesId !== undefined && linha.speciesId !== filters.speciesId) {
      return false;
    }

    if (filters.cityId !== undefined && linha.cityId !== filters.cityId) {
      return false;
    }

    if (filters.size !== undefined && linha.size !== filters.size) {
      return false;
    }

    if (filters.sex !== undefined && linha.sex !== filters.sex) {
      return false;
    }

    if (filters.maxAgeYears !== undefined) {
      // `not: null` + `gte`, exatamente como o `where` do repositorio real.
      if (linha.birthDate === null) {
        return false;
      }

      if (linha.birthDate < birthDateCutoffForMaxAge(filters.maxAgeYears, now())) {
        return false;
      }
    }

    return true;
  }
}

/** Descarta as colunas que so o filtro le, deixando o recorte que o Prisma traria. */
function comoProjecao(linha: LinhaGuardada): PublicAnimalRow {
  return {
    id: linha.id,
    name: linha.name,
    size: linha.size,
    sex: linha.sex,
    birthDate: linha.birthDate,
    description: linha.description,
    acceptsOtherAnimals: linha.acceptsOtherAnimals,
    needsLargeSpace: linha.needsLargeSpace,
    species: linha.species,
    city: linha.city,
    images: linha.images,
  };
}

/**
 * Instancia de MODULO, no mesmo padrao dos armazens do `prisma-double`.
 *
 * A suite de integracao precisa dela dentro da fabrica dublada do controller, que
 * roda durante o `require('~/app')` — antes de qualquer `const` do proprio
 * arquivo de teste ter sido inicializado. Um `const` no spec cairia na zona morta
 * temporal; um import ja esta avaliado nesse ponto.
 */
export const armazemDoCatalogo = new ArmazemDoCatalogo();
