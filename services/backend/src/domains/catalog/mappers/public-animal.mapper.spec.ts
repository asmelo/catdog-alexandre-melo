import type { PublicAnimalRow } from '~/domains/catalog/catalog.types';
import {
  PUBLIC_ANIMAL_KEYS,
  toPublicAnimal,
} from '~/domains/catalog/mappers/public-animal.mapper';

/**
 * ==================== O TESTE CENTRAL DA FEATURE ====================
 *
 * A projecao publica e o unico ponto entre o banco e um visitante ANONIMO. O que
 * este arquivo protege nao e um comportamento — e uma AUSENCIA: a de qualquer
 * campo que ninguem decidiu expor.
 *
 * Por isso as asserções sao por IGUALDADE de conjunto de chaves, e jamais por
 * `toMatchObject`, `objectContaining` ou `toHaveProperty`. Continencia passaria
 * com um campo A MAIS, que e exatamente o defeito a impedir (RN-57, CA-40).
 */

const AGORA = new Date('2026-08-25T12:00:00.000Z');

function linha(ajustes: Partial<PublicAnimalRow> = {}): PublicAnimalRow {
  return {
    id: 'a1111111-1111-4111-8111-111111111111',
    name: 'Theo',
    size: 'GRANDE',
    sex: 'MACHO',
    birthDate: new Date('2022-11-05T00:00:00.000Z'),
    description: 'Dócil, brincalhão e acostumado com crianças.',
    acceptsOtherAnimals: true,
    needsLargeSpace: false,
    species: { id: 'e1111111-1111-4111-8111-111111111111', name: 'Cachorro' },
    city: { name: 'Campo Magro', state: { uf: 'PR' } },
    images: [],
    ...ajustes,
  };
}

describe('CT-99: o conjunto de chaves é FECHADO', () => {
  it('as chaves do item são EXATAMENTE as do contrato — nem uma a mais', () => {
    // Arrange & Act
    const item = toPublicAnimal(linha(), AGORA);

    // Assert — igualdade, e não continência. Um campo novo no literal do montador
    // faz este caso FALHAR, que é o ponto: acrescentá-lo é mudar um contrato
    // público, e quem o fizer precisa saber disso.
    expect(Object.keys(item).sort()).toEqual([...PUBLIC_ANIMAL_KEYS].sort());
  });

  it('`species` traz exatamente `id` e `name`', () => {
    expect(Object.keys(toPublicAnimal(linha(), AGORA).species).sort()).toEqual(['id', 'name']);
  });

  it('`city` traz exatamente `name` e `stateUf` — sem `id`', () => {
    // `city.id` fica de fora de propósito: os identificadores de filtro vêm de
    // `GET /api/catalog/cities`, e não da listagem (RN-59).
    expect(Object.keys(toPublicAnimal(linha(), AGORA).city).sort()).toEqual(['name', 'stateUf']);
  });

  it('CT-101: nenhum campo interno atravessa a projeção', () => {
    // Arrange & Act
    const item: Record<string, unknown> = { ...toPublicAnimal(linha(), AGORA) };

    // Assert
    for (const proibido of [
      'status',
      'birthDate',
      'createdAt',
      'updatedAt',
      'speciesId',
      'cityId',
      'nameSearch',
      'nameNormalized',
      'images',
    ]) {
      expect(item).not.toHaveProperty(proibido);
    }

    expect(toPublicAnimal(linha(), AGORA).city).not.toHaveProperty('id');
  });
});

describe('CT-100: um campo novo na linha NÃO chega à resposta', () => {
  it('a saída é idêntica com e sem um campo extra na entrada', () => {
    // Arrange — simula alguém acrescentando `chipNumber` ao modelo `Animal` e ao
    // `select`. A conversão é o único jeito de representar "uma linha com uma
    // coluna a mais", que é justamente o cenário sob teste.
    const comCampoNovo = {
      ...linha(),
      chipNumber: '985112345678901',
      ownerPhone: '(41) 99999-0000',
    } as unknown as PublicAnimalRow;

    // Act
    const semExtra = toPublicAnimal(linha(), AGORA);
    const comExtra = toPublicAnimal(comCampoNovo, AGORA);

    // Assert — ESTE caso é o que dá dente à RN-55. Trocar o montador por
    // `{ ...row }` o faz falhar: `chipNumber` e `ownerPhone` sairiam para o
    // visitante sem que nenhuma linha do montador mudasse.
    expect(comExtra).toEqual(semExtra);
    expect(Object.keys(comExtra).sort()).toEqual([...PUBLIC_ANIMAL_KEYS].sort());
  });
});

describe('tradução e conteúdo', () => {
  it('traduz o enum do banco para o vocabulário do contrato', () => {
    // O mesmo vocabulário que o filtro recebe em `?size=grande`. Devolver
    // `"GRANDE"` obrigaria o frontend a manter duas tabelas para o mesmo conceito.
    const item = toPublicAnimal(linha({ size: 'PEQUENO', sex: 'FEMEA' }), AGORA);

    expect(item.size).toBe('pequeno');
    expect(item.sex).toBe('femea');
  });

  it('a idade é derivada da data de nascimento, que NÃO sai na projeção', () => {
    const item = toPublicAnimal(linha(), AGORA);

    expect(item.ageInYears).toBe(3);
    expect(item.ageInMonths).toBe(45);
    expect(item).not.toHaveProperty('birthDate');
  });

  it('sem data de nascimento, ambas as idades são `null`', () => {
    const item = toPublicAnimal(linha({ birthDate: null }), AGORA);

    expect(item.ageInYears).toBeNull();
    expect(item.ageInMonths).toBeNull();
  });

  it('CT-102: com imagem, `coverImageUrl` traz UM endereço público', () => {
    // Arrange — a consulta já restringiu a `position: 0` com `take: 1`, então a
    // linha chega com uma imagem só. O montador não escolhe entre várias.
    const item = toPublicAnimal(
      linha({ images: [{ storagePath: 'animals/a1/capa.jpg' }] }),
      AGORA,
    );

    // Assert
    expect(item.coverImageUrl).toMatch(
      /^https:\/\/.+\/storage\/v1\/object\/public\/.+\/animals\/a1\/capa\.jpg$/,
    );
  });

  it('CT-103: sem imagem, `coverImageUrl` é `null`', () => {
    expect(toPublicAnimal(linha({ images: [] }), AGORA).coverImageUrl).toBeNull();
  });

  it('CT-15: descrição de 1000 caracteres sai INTEGRAL, sem truncagem', () => {
    // Arrange — cortar aqui decidiria pela tela quantos caracteres cabem, e a
    // decisão depende da largura do cartão. A truncagem é CSS (RN-61, CA-45).
    const longa = 'a'.repeat(1000);

    // Act & Assert
    expect(toPublicAnimal(linha({ description: longa }), AGORA).description).toBe(longa);
  });

  it('descrição ausente sai como `null`, e não como texto vazio', () => {
    expect(toPublicAnimal(linha({ description: null }), AGORA).description).toBeNull();
  });

  it('`city.stateUf` vem do dado persistido, sem nenhuma chamada externa', () => {
    // A guarda de rede do `tests/setup.ts` reprovaria qualquer `fetch`.
    const item = toPublicAnimal(linha({ city: { name: 'Vitória', state: { uf: 'ES' } } }), AGORA);

    expect(item.city).toEqual({ name: 'Vitória', stateUf: 'ES' });
  });
});
