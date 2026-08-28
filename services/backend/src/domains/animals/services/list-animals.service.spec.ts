import { AnimalNotFoundError } from '~/domains/animals/errors/animal.errors';
import * as clock from '~/utils/clock';

import {
  montarBancada,
  UUID_INEXISTENTE,
  type BancadaDeAnimais,
} from '../../../../tests/fakes/bancada-de-animais';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-02 — listagem paginada (CT-25, CT-26, CT-29) e leitura de um animal.
 *
 * O caso que sustenta a feature inteira e o CT-26: a ordenacao tem TRES criterios
 * (`nameNormalized`, `createdAt` desc, `id`), e o terceiro existe para desempatar
 * registros criados no mesmo instante. Sem ele, dois animais podem trocar de
 * posicao entre duas consultas e o mesmo registro aparece na pagina 1 e na
 * pagina 2 enquanto outro nunca aparece — defeito que so se manifesta com volume
 * e que nenhum teste de uma pagina so revelaria.
 */

const PAGINA_PADRAO = { page: 1, pageSize: 20 } as const;

let bancada: BancadaDeAnimais;

beforeEach(() => {
  reiniciarSequenciaDeUuid();
  bancada = montarBancada();
});

function semear(name: string, createdAt?: Date): string {
  const animal = bancada.animais.semear({
    name,
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
    ...(createdAt === undefined ? {} : { createdAt }),
  });

  return animal.id;
}

describe('ListAnimalsService', () => {
  it('CT-29: cadastro vazio responde lista vazia e total 0', async () => {
    // Arrange & Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert — e nao um 404: "nao ha animais" e uma resposta de sucesso.
    expect(pagina.items).toEqual([]);
    expect(pagina.pagination).toEqual({ page: 1, pageSize: 20, total: 0 });
  });

  it('CT-25: a ordenacao alfabetica ignora maiusculas e minusculas', async () => {
    // Arrange — cadastrados fora de ordem e com caixas diferentes.
    semear('theo');
    semear('Bidu');
    semear('Amora');

    // Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert — "theo" por ultimo, e nao primeiro: a chave de ordenacao e
    // minuscula, entao "T" nao vem depois de "a" como viria numa comparacao crua.
    expect(pagina.items.map((animal) => animal.name)).toEqual(['Amora', 'Bidu', 'theo']);
  });

  it('CT-26: 45 animais criados no MESMO instante saem sem repeticao e sem omissao nas tres paginas', async () => {
    // Arrange — mesmo nome e mesmo `createdAt` nos 45: os dois primeiros criterios
    // de ordenacao empatam em todos, e so o desempate por identificador torna a
    // paginacao deterministica.
    const mesmoInstante = new Date('2026-08-25T10:00:00.000Z');
    const identificadores = new Set<string>();

    for (let indice = 0; indice < 45; indice += 1) {
      identificadores.add(semear('Theo', mesmoInstante));
    }

    // Act
    const paginas = await Promise.all(
      [1, 2, 3].map(async (page) => bancada.listAnimals.execute({ page, pageSize: 20 })),
    );

    // Assert
    const vistos = paginas.flatMap((pagina) => pagina.items.map((animal) => animal.id));

    expect(paginas.map((pagina) => pagina.items.length)).toEqual([20, 20, 5]);
    expect(vistos).toHaveLength(45);
    expect(new Set(vistos).size).toBe(45);
    expect(new Set(vistos)).toEqual(identificadores);
    expect(paginas[0]?.pagination.total).toBe(45);
  });

  it('CT-26: a mesma pagina consultada duas vezes devolve a mesma ordem', async () => {
    // Arrange — a paginacao nao pode depender da ordem fisica das linhas.
    const mesmoInstante = new Date('2026-08-25T10:00:00.000Z');

    for (let indice = 0; indice < 25; indice += 1) {
      semear('Theo', mesmoInstante);
    }

    // Act
    const primeira = await bancada.listAnimals.execute({ page: 2, pageSize: 10 });
    const segunda = await bancada.listAnimals.execute({ page: 2, pageSize: 10 });

    // Assert
    expect(segunda.items.map((animal) => animal.id)).toEqual(
      primeira.items.map((animal) => animal.id),
    );
  });

  it('CT-26: entre dois animais de mesmo nome, o criado mais RECENTE vem primeiro', async () => {
    // Arrange — segundo criterio de ordenacao, `createdAt` DESCENDENTE.
    const antigo = semear('Theo', new Date('2026-01-01T00:00:00.000Z'));
    const recente = semear('Theo', new Date('2026-08-01T00:00:00.000Z'));

    // Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert
    expect(pagina.items.map((animal) => animal.id)).toEqual([recente, antigo]);
  });

  it('CT-28: a pagina alem da ultima responde lista vazia com o total preservado', async () => {
    // Arrange
    semear('Theo');

    // Act
    const pagina = await bancada.listAnimals.execute({ page: 9, pageSize: 20 });

    // Assert — e nao um erro: o rodape continua sabendo dizer quantos existem.
    expect(pagina.items).toEqual([]);
    expect(pagina.pagination).toEqual({ page: 9, pageSize: 20, total: 1 });
  });

  it('CT-28: uma pagina absurdamente alta e saturada e nao vira erro de servidor', async () => {
    // Arrange — `(page - 1) * pageSize` estoura o inteiro seguro do JavaScript com
    // paginas grandes. O service satura o deslocamento, e o resultado e uma pagina
    // vazia em vez de um 500.
    semear('Theo');

    // Act
    const pagina = await bancada.listAnimals.execute({ page: 1e15, pageSize: 100 });

    // Assert
    expect(pagina.items).toEqual([]);
    expect(pagina.pagination.total).toBe(1);
  });

  it('CT-18: todos os animais da pagina sao datados pelo MESMO instante', async () => {
    // Arrange — um unico `now()` para a pagina inteira: ler o relogio por animal
    // faria dois registros da mesma resposta usarem instantes diferentes na
    // virada do dia.
    const espiaoDoRelogio = jest
      .spyOn(clock, 'now')
      .mockReturnValue(new Date('2026-08-25T12:00:00.000Z'));

    bancada.animais.semear({
      name: 'Theo',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
      birthDate: new Date('2022-11-05T00:00:00.000Z'),
    });
    bancada.animais.semear({
      name: 'Bidu',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
      birthDate: new Date('2020-01-01T00:00:00.000Z'),
    });

    // Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert
    expect(pagina.items.map((animal) => animal.ageInYears)).toEqual([6, 3]);
    expect(espiaoDoRelogio).toHaveBeenCalledTimes(1);
  });

  it('CT-31: a imagem de posicao 0 e a primeira da lista, e e ela a capa da listagem', async () => {
    // Arrange
    const animal = bancada.animais.semear({
      name: 'Theo',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
    });

    bancada.animais.semearImagem({ animalId: animal.id, position: 1 });
    const capa = bancada.animais.semearImagem({ animalId: animal.id, position: 0 });

    // Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert — semeadas fora de ordem de proposito.
    expect(pagina.items[0]?.images[0]?.id).toBe(capa.id);
  });

  it('CT-32: animal sem imagem nenhuma sai com a lista de imagens vazia', async () => {
    // Arrange
    semear('Theo');

    // Act
    const pagina = await bancada.listAnimals.execute(PAGINA_PADRAO);

    // Assert — e nao `null` nem campo ausente: a interface itera a lista.
    expect(pagina.items[0]?.images).toEqual([]);
  });
});

describe('GetAnimalService', () => {
  it('CT-23: devolve o animal com especie, cidade, estado e imagens', async () => {
    // Arrange
    const animal = bancada.animais.semear({
      name: 'Theo',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
    });

    bancada.animais.semearImagem({ animalId: animal.id, position: 0 });

    // Act
    const lido = await bancada.getAnimal.execute({ id: animal.id });

    // Assert
    expect(lido.species.name).toBe('Cachorro');
    expect(lido.city).toEqual({
      id: bancada.cidade.id,
      name: 'Boa Esperanca',
      stateUf: 'ES',
    });
    expect(lido.images).toHaveLength(1);
  });

  it('CT-64: consultar animal inexistente responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange & Act
    const recusa = bancada.getAnimal.execute({ id: UUID_INEXISTENTE });

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      message: 'Animal não encontrado.',
    });
  });
});
