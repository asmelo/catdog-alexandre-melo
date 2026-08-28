import { AnimalStatus, type Prisma, type PrismaClient } from '@prisma/client';

import { PrismaPublicCatalogRepository } from '~/domains/catalog/repositories/public-catalog.repository';
import * as clock from '~/utils/clock';

/**
 * A FORMA DA CONSULTA que o repositorio envia ao Prisma.
 *
 * =============== POR QUE ESTE SPEC OLHA O ARGUMENTO ===============
 *
 * O comportamento observavel — quem entra e quem sai da vitrine — e verificado em
 * `list-public-animals.service.spec.ts` sobre um fake em memoria. O que aquele
 * teste NAO consegue observar e se o `where` enviado ao banco tem a forma certa:
 * o fake reproduz a REGRA, nao a consulta.
 *
 * E a forma e onde moram os defeitos silenciosos deste arquivo. Um `status`
 * esquecido, um `not: null` aplicado sempre em vez de so com o filtro, um `count`
 * com `where` diferente do `findMany`, um `orderBy` sem o desempate — nenhum
 * deles produz erro: produzem uma vitrine que mostra animal adotado, esconde
 * animal sem data, conta errado ou repete registro entre paginas.
 *
 * O duble captura o argumento e devolve linha nenhuma. Nao ha banco, nao ha
 * socket.
 */

const AGORA = new Date('2026-08-25T12:00:00.000Z');

interface ConsultaCapturada {
  readonly findMany: Prisma.AnimalFindManyArgs | undefined;
  readonly count: Prisma.AnimalCountArgs | undefined;
}

/**
 * Cliente dublado com o MINIMO que o repositorio consome. `mockDeep` traria
 * dezenas de membros que este spec nao exercita e esconderia qual e, de fato, a
 * superficie usada.
 */
function clienteQueCaptura(): {
  readonly db: PrismaClient;
  readonly capturado: ConsultaCapturada;
} {
  const capturado: { findMany?: Prisma.AnimalFindManyArgs; count?: Prisma.AnimalCountArgs } = {};

  const db = {
    animal: {
      findMany: (argumentos: Prisma.AnimalFindManyArgs) => {
        capturado.findMany = argumentos;

        return Promise.resolve([]);
      },
      count: (argumentos: Prisma.AnimalCountArgs) => {
        capturado.count = argumentos;

        return Promise.resolve(0);
      },
    },
    species: { findMany: () => Promise.resolve([]) },
    city: { findMany: () => Promise.resolve([]) },
    /**
     * Forma de ARRAY, como o repositorio usa. As "consultas" ja sao promessas
     * quando chegam aqui — o duble apenas as aguarda, como o Prisma faria.
     */
    $transaction: (operacoes: ReadonlyArray<Promise<unknown>>) => Promise.all(operacoes),
  } as unknown as PrismaClient;

  return { db, capturado: capturado as ConsultaCapturada };
}

beforeEach(() => {
  jest.spyOn(clock, 'now').mockReturnValue(AGORA);
});

describe('listAvailableAnimals — a forma do `where`', () => {
  it('o recorte por DISPONIVEL é FIXO e está sempre presente', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 1, pageSize: 12 });

    // Assert — sem nenhum filtro, o `where` tem exatamente uma chave.
    expect(capturado.findMany?.where).toEqual({ status: AnimalStatus.DISPONIVEL });
  });

  it('filtro ausente NÃO entra no objeto — nem como chave `undefined` (RN-35)', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 1,
      pageSize: 12,
      speciesId: 'e1',
    });

    // Assert — chaves com valor `undefined` funcionariam no Prisma, mas tornariam
    // o objeto ilegível no log de consulta e esconderiam qual filtro está ativo.
    expect(Object.keys(capturado.findMany?.where ?? {}).sort()).toEqual(['speciesId', 'status']);
  });

  it('a busca vai INTEIRA, contra as duas colunas de nome, e sem `mode: insensitive`', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 1,
      pageSize: 12,
      search: 'campo magro',
    });

    // Assert — as duas pontas já estão em minúsculas e sem acento; o `mode`
    // custaria um `lower()` por linha e impediria o uso do índice.
    expect(capturado.findMany?.where?.OR).toEqual([
      { nameSearch: { contains: 'campo magro' } },
      { city: { nameSearch: { contains: 'campo magro' } } },
    ]);
  });

  it('`maxAgeYears` acrescenta `not: null` JUNTO do corte — e só com o filtro', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 1,
      pageSize: 12,
      maxAgeYears: 3,
    });

    // Assert — o corte é o dia civil de hoje menos 4 anos, mais um dia.
    expect(capturado.findMany?.where?.birthDate).toEqual({
      not: null,
      gte: new Date('2022-08-26T00:00:00.000Z'),
    });
  });

  it('sem `maxAgeYears`, NENHUMA cláusula sobre `birthDate` é enviada', async () => {
    // Arrange — é isto que faz o animal sem data voltar a aparecer (RN-42).
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 1, pageSize: 12 });

    // Assert
    expect(capturado.findMany?.where).not.toHaveProperty('birthDate');
  });

  it('todos os filtros compõem o MESMO `where`, e nenhum é aplicado em memória', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 2,
      pageSize: 24,
      search: 'theo',
      speciesId: 'e1',
      cityId: 'c1',
      size: 'GRANDE',
      sex: 'MACHO',
      maxAgeYears: 5,
    });

    // Assert
    expect(Object.keys(capturado.findMany?.where ?? {}).sort()).toEqual([
      'OR',
      'birthDate',
      'cityId',
      'sex',
      'size',
      'speciesId',
      'status',
    ]);
  });
});

describe('listAvailableAnimals — recorte, ordenação e paginação', () => {
  it('o `select` é explícito e NÃO traz `city.id` nem coluna interna alguma', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 1, pageSize: 12 });

    // Assert — com `include`, toda coluna nova do modelo passaria a ser LIDA, e a
    // única coisa entre ela e o visitante seria o montador (RNF-02).
    expect(capturado.findMany).not.toHaveProperty('include');
    expect(Object.keys(capturado.findMany?.select ?? {}).sort()).toEqual([
      'acceptsOtherAnimals',
      'birthDate',
      'city',
      'description',
      'id',
      'images',
      'name',
      'needsLargeSpace',
      'sex',
      'size',
      'species',
    ]);

    const cidade = capturado.findMany?.select?.city;

    expect(typeof cidade === 'object' && cidade !== null ? Object.keys(cidade.select ?? {}) : []).toEqual([
      'name',
      'state',
    ]);
  });

  it('só a CAPA é trazida: `position: 0` com `take: 1`', async () => {
    // Arrange — trazer as cinco imagens para usar uma multiplicaria por cinco as
    // linhas devolvidas numa página de doze cartões.
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 1, pageSize: 12 });

    // Assert
    expect(capturado.findMany?.select?.images).toEqual({
      select: { storagePath: true },
      where: { position: 0 },
      take: 1,
    });
  });

  it('a ordenação tem os DOIS critérios, com o desempate por `id`', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 1, pageSize: 12 });

    // Assert — sem o desempate, registros do mesmo instante trocam de posição
    // entre páginas: um se repete e outro nunca aparece (CT-74).
    expect(capturado.findMany?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('`skip` e `take` derivam da página pedida', async () => {
    // Arrange
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({ page: 3, pageSize: 12 });

    // Assert
    expect(capturado.findMany?.skip).toBe(24);
    expect(capturado.findMany?.take).toBe(12);
  });

  it('CT-98: o `count` usa EXATAMENTE o mesmo `where` do `findMany`', async () => {
    // Arrange — um `count` sem `where` é o defeito clássico de paginação
    // filtrada, e aparece como "13 resultados" acima de uma lista de 2.
    const { db, capturado } = clienteQueCaptura();

    // Act
    await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 1,
      pageSize: 12,
      speciesId: 'e1',
      search: 'theo',
    });

    // Assert
    expect(capturado.count?.where).toEqual(capturado.findMany?.where);
  });

  it('devolve o envelope com a página pedida e o total do banco', async () => {
    // Arrange
    const { db } = clienteQueCaptura();

    // Act
    const pagina = await new PrismaPublicCatalogRepository(db).listAvailableAnimals({
      page: 2,
      pageSize: 24,
    });

    // Assert
    expect(pagina).toEqual({ items: [], pagination: { page: 2, pageSize: 24, total: 0 } });
  });
});

describe('opções de filtro — a forma das duas consultas', () => {
  it('espécies: `some` sobre DISPONIVEL, `select` de dois campos, ordem por `nameNormalized`', async () => {
    // Arrange
    const chamadas: unknown[] = [];
    const db = {
      species: {
        findMany: (argumentos: unknown) => {
          chamadas.push(argumentos);

          return Promise.resolve([]);
        },
      },
    } as unknown as PrismaClient;

    // Act
    await new PrismaPublicCatalogRepository(db).listSpeciesWithAvailableAnimals();

    // Assert — `nameNormalized` e não `name`: o Prisma NÃO suporta
    // `mode: 'insensitive'` em `orderBy`, e a ordenação binária poria "zebra"
    // antes de "Abelha".
    expect(chamadas[0]).toEqual({
      where: { animals: { some: { status: AnimalStatus.DISPONIVEL } } },
      select: { id: true, name: true },
      orderBy: { nameNormalized: 'asc' },
    });
  });

  it('cidades: `some` sobre DISPONIVEL, sem `ibgeCode`/`stateId`, ordem por UF e nome', async () => {
    // Arrange
    const chamadas: unknown[] = [];
    const db = {
      city: {
        findMany: (argumentos: unknown) => {
          chamadas.push(argumentos);

          return Promise.resolve([
            { id: 'c1', name: 'Campo Magro', state: { uf: 'PR' } },
          ]);
        },
      },
    } as unknown as PrismaClient;

    // Act
    const opcoes = await new PrismaPublicCatalogRepository(db).listCitiesWithAvailableAnimals();

    // Assert
    expect(chamadas[0]).toEqual({
      where: { animals: { some: { status: AnimalStatus.DISPONIVEL } } },
      select: { id: true, name: true, state: { select: { uf: true } } },
      orderBy: [{ state: { uf: 'asc' } }, { name: 'asc' }],
    });
    // Achatada pela porta, e não pelo service.
    expect(opcoes).toEqual([{ id: 'c1', name: 'Campo Magro', stateUf: 'PR' }]);
  });
});
