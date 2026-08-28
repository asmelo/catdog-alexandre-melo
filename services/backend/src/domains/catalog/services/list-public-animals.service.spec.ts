import { AnimalStatus } from '@prisma/client';

import { ListPublicAnimalsService } from '~/domains/catalog/services/list-public-animals.service';
import * as clock from '~/utils/clock';

import {
  ArmazemDoCatalogo,
  InMemoryPublicCatalogRepository,
} from '../../../../tests/fakes/in-memory-public-catalog.repository';

/**
 * O caso de uso da listagem publica.
 *
 * O repositorio e um FAKE que implementa a interface — nunca `jest.mock` do
 * modulo. O fake reproduz os quatro comportamentos que os casos abaixo observam:
 * o recorte fixo por `DISPONIVEL`, a ordenacao com desempate, o `total` calculado
 * depois dos filtros e a busca contra as duas colunas de nome.
 */

const AGORA = new Date('2026-08-25T12:00:00.000Z');

const ESPECIE_CACHORRO = 'e1111111-1111-4111-8111-111111111111';
const ESPECIE_GATO = 'e2222222-2222-4222-8222-222222222222';
const CIDADE_CAMPO_MAGRO = 'c1111111-1111-4111-8111-111111111111';
const CIDADE_BOA_ESPERANCA = 'c2222222-2222-4222-8222-222222222222';

let armazem: ArmazemDoCatalogo;
let service: ListPublicAnimalsService;

beforeEach(() => {
  jest.spyOn(clock, 'now').mockReturnValue(AGORA);
  armazem = new ArmazemDoCatalogo();
  service = new ListPublicAnimalsService(new InMemoryPublicCatalogRepository(armazem));
});

/** Query minima; os casos sobrescrevem o que exercitam. */
function consulta(ajustes: Record<string, unknown> = {}) {
  return { page: 1, pageSize: 12, ...ajustes } as Parameters<
    ListPublicAnimalsService['execute']
  >[0];
}

function nomes(items: ReadonlyArray<{ readonly name: string }>): ReadonlyArray<string> {
  return items.map((item) => item.name);
}

describe('recorte por situação', () => {
  it.each([
    { situacao: AnimalStatus.RESERVADO, ct: 'CT-18' },
    { situacao: AnimalStatus.ADOTADO, ct: 'CT-19' },
    { situacao: AnimalStatus.INDISPONIVEL, ct: 'CT-20' },
  ])('$ct: animal $situacao NÃO aparece na vitrine', async ({ situacao }) => {
    // Arrange
    armazem.semear({ name: 'Fora', status: situacao });

    // Act
    const pagina = await service.execute(consulta());

    // Assert
    expect(pagina.items).toEqual([]);
    expect(pagina.pagination.total).toBe(0);
  });

  it('CT-21: com os quatro status cadastrados, só o DISPONIVEL sai e o total é 1', async () => {
    // Arrange
    armazem.semear({ name: 'Disponível', status: AnimalStatus.DISPONIVEL });
    armazem.semear({ name: 'Reservado', status: AnimalStatus.RESERVADO });
    armazem.semear({ name: 'Adotado', status: AnimalStatus.ADOTADO });
    armazem.semear({ name: 'Indisponível', status: AnimalStatus.INDISPONIVEL });

    // Act
    const pagina = await service.execute(consulta());

    // Assert
    expect(nomes(pagina.items)).toEqual(['Disponível']);
    expect(pagina.pagination.total).toBe(1);
  });

  it('CT-22/CT-23: a mudança de situação é refletida na consulta SEGUINTE', async () => {
    // Arrange
    const theo = armazem.semear({ name: 'Theo' });

    expect((await service.execute(consulta())).pagination.total).toBe(1);

    // Act — o administrador marca como adotado em outra aba.
    armazem.alterarStatus(theo.id, AnimalStatus.ADOTADO);

    // Assert — sem cache, sem lista materializada: a consulta seguinte já não o vê.
    expect((await service.execute(consulta())).pagination.total).toBe(0);
  });
});

describe('busca livre', () => {
  beforeEach(() => {
    armazem.semear({ name: 'Theo', cityName: 'Campo Magro' });
    armazem.semear({ name: 'José', cityName: 'Boa Esperança', cityId: CIDADE_BOA_ESPERANCA });
    armazem.semear({ name: 'Luna', cityName: 'Curitiba', cityId: 'c3' });
  });

  it.each([
    { ct: 'CT-25', busca: 'the', esperado: ['Theo'] },
    { ct: 'CT-26', busca: 'magro', esperado: ['Theo'] },
    { ct: 'CT-27', busca: 'jose', esperado: ['José'] },
    { ct: 'CT-28', busca: 'THEO', esperado: ['Theo'] },
    { ct: 'CT-29', busca: 'un', esperado: ['Luna'] },
  ])('$ct: buscar "$busca" devolve $esperado', async ({ busca, esperado }) => {
    // A busca chega ao service JÁ normalizada pela borda; aqui ela é passada como
    // o validador a entregaria.
    const pagina = await service.execute(consulta({ search: normalizar(busca) }));

    expect(nomes(pagina.items)).toEqual(esperado);
  });

  it('CT-30: o texto vai INTEIRO — "theo campo" não é quebrado em dois termos', async () => {
    // Se fosse quebrado, "theo" OU "campo" devolveria o Theo. O visitante que
    // digita a sequência procura a sequência.
    const pagina = await service.execute(consulta({ search: 'theo campo' }));

    expect(pagina.items).toEqual([]);
  });

  it('CT-31: busca não aplicada devolve a lista completa', async () => {
    // A cadeia vazia vira `undefined` na borda, e o `undefined` faz o repositório
    // nem montar a cláusula.
    const pagina = await service.execute(consulta());

    expect(pagina.pagination.total).toBe(3);
  });

  it('CT-32: espaços internos colapsados encontram a cidade', async () => {
    const pagina = await service.execute(consulta({ search: normalizar('campo   magro') }));

    expect(nomes(pagina.items)).toEqual(['Theo']);
  });
});

describe('filtros exatos', () => {
  beforeEach(() => {
    armazem.semear({
      name: 'Theo',
      speciesId: ESPECIE_CACHORRO,
      cityId: CIDADE_CAMPO_MAGRO,
      cityName: 'Campo Magro',
      stateUf: 'PR',
      size: 'GRANDE',
      sex: 'MACHO',
      birthDate: new Date('2022-11-05T00:00:00.000Z'),
    });
    armazem.semear({
      name: 'Mia',
      speciesId: ESPECIE_GATO,
      cityId: CIDADE_BOA_ESPERANCA,
      cityName: 'Boa Esperança',
      stateUf: 'ES',
      size: 'PEQUENO',
      sex: 'FEMEA',
      birthDate: new Date('2026-03-25T00:00:00.000Z'),
    });
  });

  it.each([
    { ct: 'CT-37', filtro: { speciesId: ESPECIE_GATO }, esperado: ['Mia'] },
    { ct: 'CT-38', filtro: { size: 'pequeno' }, esperado: ['Mia'] },
    { ct: 'CT-39', filtro: { sex: 'macho' }, esperado: ['Theo'] },
    { ct: 'CT-40', filtro: { cityId: CIDADE_CAMPO_MAGRO }, esperado: ['Theo'] },
  ])('$ct: o filtro isolado restringe corretamente', async ({ filtro, esperado }) => {
    const pagina = await service.execute(consulta(filtro));

    expect(nomes(pagina.items)).toEqual(esperado);
  });

  it('CT-41: cidades homônimas em UFs distintas são registros diferentes', async () => {
    // Arrange — "Boa Esperança" existe em ES e em MG. O filtro é por
    // IDENTIFICADOR, não por nome, e é isso que as distingue.
    armazem.semear({
      name: 'Nina',
      cityId: 'c-boa-esperanca-mg',
      cityName: 'Boa Esperança',
      stateUf: 'MG',
    });

    // Act
    const pagina = await service.execute(consulta({ cityId: CIDADE_BOA_ESPERANCA }));

    // Assert
    expect(nomes(pagina.items)).toEqual(['Mia']);
  });

  it('CT-42: todos os filtros juntos devolvem só quem satisfaz TODOS', async () => {
    // Act
    const pagina = await service.execute(
      consulta({
        search: 'the',
        speciesId: ESPECIE_CACHORRO,
        size: 'grande',
        sex: 'macho',
        maxAgeYears: 10,
        cityId: CIDADE_CAMPO_MAGRO,
      }),
    );

    // Assert — a busca aproximada e os filtros exatos se combinam por E (RN-29).
    expect(nomes(pagina.items)).toEqual(['Theo']);
  });

  it('CT-42: um único critério discordante zera o resultado', async () => {
    const pagina = await service.execute(
      consulta({ search: 'the', cityId: CIDADE_BOA_ESPERANCA }),
    );

    expect(pagina.items).toEqual([]);
  });

  it('CT-43: cada filtro omitido deixa de restringir', async () => {
    // Arrange & Act — sem nenhum filtro, os dois voltam.
    const pagina = await service.execute(consulta());

    // Assert
    expect(pagina.pagination.total).toBe(2);
  });

  it('CT-47/CT-48: identificador bem formado inexistente devolve vazio, sem exceção', async () => {
    // Arrange & Act — o service NÃO consulta a existência da espécie antes, e é
    // por isso que a resposta é `200` com lista vazia e nunca `404` (RN-51).
    const especie = await service.execute(
      consulta({ speciesId: '00000000-0000-4000-8000-000000000000' }),
    );
    const cidade = await service.execute(
      consulta({ cityId: '00000000-0000-4000-8000-000000000001' }),
    );

    // Assert
    expect(especie).toEqual({ items: [], pagination: { page: 1, pageSize: 12, total: 0 } });
    expect(cidade.pagination.total).toBe(0);
  });

  it('CT-98: o total é o do conjunto FILTRADO, e não o do catálogo', async () => {
    const pagina = await service.execute(consulta({ speciesId: ESPECIE_GATO }));

    expect(pagina.pagination.total).toBe(1);
  });
});

describe('filtro de idade máxima', () => {
  beforeEach(() => {
    armazem.semear({ name: 'Theo', birthDate: new Date('2022-11-05T00:00:00.000Z') });
    armazem.semear({ name: 'Filhote', birthDate: new Date('2026-03-25T00:00:00.000Z') });
    armazem.semear({ name: 'SemData', birthDate: null });
  });

  it('CT-54: `maxAgeYears=1` devolve só quem tem até 1 ano', async () => {
    expect(nomes((await service.execute(consulta({ maxAgeYears: 1 }))).items)).toEqual(['Filhote']);
  });

  it('CT-55: quem faz aniversário HOJE já conta a idade nova', async () => {
    // Arrange — nascido em 25/08/2022, hoje é 25/08/2026: fez 4 anos hoje.
    armazem.semear({ name: 'Aniversariante', birthDate: new Date('2022-08-25T00:00:00.000Z') });

    // Act & Assert — com o teto em 3, ele já saiu.
    expect(nomes((await service.execute(consulta({ maxAgeYears: 3 }))).items)).not.toContain(
      'Aniversariante',
    );
    expect(nomes((await service.execute(consulta({ maxAgeYears: 4 }))).items)).toContain(
      'Aniversariante',
    );
  });

  it('CT-56: quem faz aniversário AMANHÃ ainda tem a idade antiga', async () => {
    // Arrange
    armazem.semear({ name: 'Amanha', birthDate: new Date('2022-08-26T00:00:00.000Z') });

    // Act & Assert
    expect(nomes((await service.execute(consulta({ maxAgeYears: 3 }))).items)).toContain('Amanha');
  });

  it('CT-57/CT-58: sem data de nascimento sai com o filtro aplicado, e volta sem ele', async () => {
    // Arrange & Act — "até 3 anos" é pergunta sobre idade, e quem não tem data
    // não tem idade a comparar (RN-42).
    const comFiltro = await service.execute(consulta({ maxAgeYears: 3 }));
    const semFiltro = await service.execute(consulta());

    // Assert
    expect(nomes(comFiltro.items)).not.toContain('SemData');
    expect(nomes(semFiltro.items)).toContain('SemData');
  });

  it('CT-59: `maxAgeYears=0` é filtro aplicado, e não ausência', async () => {
    // Arrange — `0` significa "menos de um ano". Um `default(0)` no schema
    // inverteria a vitrine: ela passaria a mostrar só filhotes por omissão.
    armazem.semear({ name: 'RecemNascido', birthDate: new Date('2026-08-01T00:00:00.000Z') });

    // Act
    const pagina = await service.execute(consulta({ maxAgeYears: 0 }));

    // Assert — os DOIS com menos de um ano ("Filhote" nasceu em março do mesmo
    // ano), e nenhum dos outros: "Theo" tem 3 anos e "SemData" não tem idade.
    expect([...nomes(pagina.items)].sort()).toEqual(['Filhote', 'RecemNascido']);
    expect(nomes(pagina.items)).not.toContain('Theo');
    expect(nomes(pagina.items)).not.toContain('SemData');
  });

  it('CT-60: sem `maxAgeYears`, o filtro não é aplicado', async () => {
    expect((await service.execute(consulta())).pagination.total).toBe(3);
  });

  it('CT-63: nenhum devolvido sob `maxAgeYears=N` tem idade calculada maior que N', async () => {
    // Arrange — a coerência entre o corte e a idade exibida, verificada sobre o
    // resultado real do service e não por inspeção.
    for (let anos = 0; anos <= 6; anos += 1) {
      armazem.semear({
        name: `Idade${String(anos)}`,
        birthDate: new Date(Date.UTC(2026 - anos, 7, 20)),
      });
    }

    // Act & Assert
    for (const teto of [0, 1, 2, 3, 4, 5]) {
      const pagina = await service.execute(consulta({ maxAgeYears: teto, pageSize: 100 }));

      for (const item of pagina.items) {
        expect(item.ageInYears).not.toBeNull();
        expect(item.ageInYears ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(teto);
      }
    }
  });
});

describe('ordenação e paginação', () => {
  it('CT-74: 45 animais de MESMO `createdAt` percorridos em 4 páginas dão 45 ids distintos', async () => {
    // Arrange — o cenário que o desempate por `id` existe para resolver. Sem ele,
    // o banco não promete ordem estável entre registros do mesmo instante: um
    // aparece duas vezes e outro nunca.
    const mesmoInstante = new Date('2026-08-01T10:00:00.000Z');

    for (let indice = 0; indice < 45; indice += 1) {
      armazem.semear({ name: `Animal ${String(indice)}`, createdAt: mesmoInstante });
    }

    // Act
    const vistos = new Set<string>();

    for (const page of [1, 2, 3, 4]) {
      const pagina = await service.execute(consulta({ page, pageSize: 12 }));

      for (const item of pagina.items) {
        vistos.add(item.id);
      }
    }

    // Assert
    expect(vistos.size).toBe(45);
  });

  it('os mais recentes vêm primeiro', async () => {
    // Arrange
    armazem.semear({ name: 'Antigo', createdAt: new Date('2026-01-01T00:00:00.000Z') });
    armazem.semear({ name: 'Novo', createdAt: new Date('2026-08-01T00:00:00.000Z') });

    // Act & Assert
    expect(nomes((await service.execute(consulta())).items)).toEqual(['Novo', 'Antigo']);
  });

  it('CT-76: página além da última devolve lista vazia e o total REAL, sem erro', async () => {
    // Arrange
    armazem.semear({ name: 'Theo' });

    // Act
    const pagina = await service.execute(consulta({ page: 99 }));

    // Assert — o visitante que edita a URL não merece um 500.
    expect(pagina.items).toEqual([]);
    expect(pagina.pagination).toEqual({ page: 99, pageSize: 12, total: 1 });
  });

  it('CT-78: sem `pageSize`, o padrão da borda é 12', async () => {
    // Arrange
    for (let indice = 0; indice < 20; indice += 1) {
      armazem.semear({ name: `Animal ${String(indice)}` });
    }

    // Act — 12 é o valor que o schema aplica; aqui ele chega já resolvido.
    const pagina = await service.execute(consulta({ pageSize: 12 }));

    // Assert
    expect(pagina.items).toHaveLength(12);
    expect(pagina.pagination.total).toBe(20);
  });
});

/** A borda normaliza antes de chamar o service; aqui o teste faz o mesmo. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
