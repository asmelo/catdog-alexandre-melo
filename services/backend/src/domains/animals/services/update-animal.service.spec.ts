import { AnimalSize } from '@prisma/client';

import {
  AnimalNotFoundError,
  AnimalStaleUpdateError,
  CityNotFoundError,
} from '~/domains/animals/errors/animal.errors';
import {
  AnimalImageLimitExceededError,
  AnimalImageNotFoundError,
} from '~/domains/animals/errors/animal-image.errors';
import type { AnimalWithRelations } from '~/domains/animals/repositories/animal.repository';
import type { AnimalImageUpload } from '~/domains/animals/services/store-animal-images.service';
import { SpeciesNotFoundError } from '~/domains/species/errors/species.errors';
import { MAX_IMAGES_PER_ANIMAL } from '~/infra/upload/upload-limits';

import {
  entradaDeEdicao,
  montarBancada,
  UUID_INEXISTENTE,
  type BancadaDeAnimais,
} from '../../../../tests/fakes/bancada-de-animais';
import { jpegBuffer } from '../../../../tests/fixtures/image-fixtures';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-06 — edicao de animal (CT-48, CT-49a, CT-49b, CT-58, CT-60 a CT-64, CT-66).
 *
 * Os dois assuntos que so aparecem aqui:
 *
 *   1. O LIMITE DE IMAGENS INCIDE SOBRE O ESTADO FINAL, e nao sobre o que foi
 *      enviado nesta requisicao. E a aritmetica que a ALT-002 da spec corrigiu:
 *      "5 gravadas, remover 2, acrescentar 3" da SEIS e e recusado; "remover 3,
 *      acrescentar 3" da cinco e e aceito. Um teste que contasse so os arquivos
 *      enviados aprovaria os dois.
 *   2. O BLOQUEIO OTIMISTA. O animal e editavel pelo formulario e alteravel pela
 *      listagem ao mesmo tempo, em abas diferentes — sem a marca de alteracao a
 *      segunda gravacao apaga a primeira sem ninguem perceber.
 */

function imagem(): AnimalImageUpload {
  const content = jpegBuffer(1024);

  return { content, sizeBytes: content.length };
}

function imagens(quantidade: number): ReadonlyArray<AnimalImageUpload> {
  return Array.from({ length: quantidade }, () => imagem());
}

let bancada: BancadaDeAnimais;

beforeEach(() => {
  reiniciarSequenciaDeUuid();
  bancada = montarBancada();
});

/** Semeia um animal com N imagens ja gravadas no banco E no armazenamento. */
async function animalComImagens(quantidade: number): Promise<AnimalWithRelations> {
  const animal = bancada.animais.semear({
    name: 'Theo',
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
  });

  for (let posicao = 0; posicao < quantidade; posicao += 1) {
    const gravada = bancada.animais.semearImagem({ animalId: animal.id, position: posicao });

    await bancada.armazenamento.upload({
      objectPath: gravada.storagePath,
      content: jpegBuffer(512),
      contentType: 'image/jpeg',
    });
  }

  const recarregado = bancada.animais.buscarPorId(animal.id);

  if (recarregado === null) {
    throw new Error('Bancada: o animal semeado deveria existir.');
  }

  return recarregado;
}

describe('UpdateAnimalService — dados do animal', () => {
  it('CT-63: grava a alteracao de cada campo e preserva o identificador do animal', async () => {
    // Arrange
    const animal = await animalComImagens(0);
    const outraEspecie = bancada.especies.semear({ name: 'Gato' });
    const outraCidade = bancada.geografia.semearCidade({
      stateId: bancada.estado.id,
      name: 'Vitoria',
    });

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        name: 'Theo Junior',
        speciesId: outraEspecie.id,
        cityId: outraCidade.id,
        size: 'pequeno',
        sex: 'femea',
        birthDate: new Date('2024-03-10T00:00:00.000Z'),
        description: 'Muito docil.',
        acceptsOtherAnimals: true,
        needsLargeSpace: true,
      }),
    );

    // Assert
    expect(atualizado.id).toBe(animal.id);
    expect(atualizado.name).toBe('Theo Junior');
    expect(atualizado.species.name).toBe('Gato');
    expect(atualizado.city.name).toBe('Vitoria');
    expect(atualizado.size).toBe('pequeno');
    expect(atualizado.sex).toBe('femea');
    expect(atualizado.birthDate).toBe('2024-03-10');
    expect(atualizado.description).toBe('Muito docil.');
    expect(atualizado.acceptsOtherAnimals).toBe(true);
    expect(atualizado.needsLargeSpace).toBe(true);
    expect(bancada.animais.linhas[0]?.nameNormalized).toBe('theo junior');
  });

  it('CT-63: a edicao NAO altera o status do animal', async () => {
    // Arrange — o formulario de edicao nao oferece status (RN-16), e o corpo da
    // edicao nao tem esse campo: o valor gravado precisa sobreviver a gravacao.
    const animal = await animalComImagens(0);

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { name: 'Theo Editado' }),
    );

    // Assert
    expect(atualizado.status).toBe('disponivel');
  });

  it('CT-64: editar animal inexistente responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange & Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, UUID_INEXISTENTE, new Date('2026-02-02T12:00:00.000Z')),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      code: 'ANIMAL_NOT_FOUND',
      message: 'Animal não encontrado.',
    });
  });

  it('CT-66: a segunda gravacao com a marca ANTIGA responde 409 e nada e sobrescrito', async () => {
    // Arrange — duas abas leram o mesmo animal e guardaram a MESMA marca.
    const animal = await animalComImagens(0);
    const marcaLidaPelasDuasAbas = animal.updatedAt;

    // Act — a primeira aba grava e avanca a marca; a segunda tenta com a antiga.
    const primeira = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, marcaLidaPelasDuasAbas, { name: 'Theo da Aba 1' }),
    );

    const segunda = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, marcaLidaPelasDuasAbas, { name: 'Theo da Aba 2' }),
    );

    // Assert
    await expect(segunda).rejects.toBeInstanceOf(AnimalStaleUpdateError);
    await expect(segunda).rejects.toMatchObject({
      statusCode: 409,
      code: 'ANIMAL_STALE_UPDATE',
      message: 'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
    });
    // A gravacao da primeira aba permanece: a segunda nao apagou nada.
    expect(primeira.name).toBe('Theo da Aba 1');
    expect(bancada.animais.linhas[0]?.name).toBe('Theo da Aba 1');
  });

  it('CT-66: com a marca RECARREGADA a mesma gravacao passa', async () => {
    // Arrange — a saida oferecida ao administrador ("recarregue e refaca") precisa
    // funcionar de verdade.
    const animal = await animalComImagens(0);

    const primeira = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { name: 'Theo da Aba 1' }),
    );

    // Act
    const segunda = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, new Date(primeira.updatedAt), {
        name: 'Theo da Aba 2',
      }),
    );

    // Assert
    expect(segunda.name).toBe('Theo da Aba 2');
  });

  it('CT-64: animal excluido entre a leitura e a gravacao responde 404, e nao 409', async () => {
    // Arrange — a marca nao bate porque a LINHA sUMIU, e nao porque alguem editou.
    // Dizer "foi alterado por outra pessoa" mandaria o administrador recarregar
    // uma tela de um animal que nao existe mais.
    const animal = await animalComImagens(0);

    jest
      .spyOn(bancada.repositorioDeAnimais, 'updateIfUnchanged')
      .mockImplementationOnce(async () => {
        bancada.animais.removerPorId(animal.id);

        return 0;
      });

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
  });

  it('CT-10 / CT-11: especie e cidade inexistentes recusam a edicao antes de gravar', async () => {
    // Arrange
    const animal = await animalComImagens(0);

    // Act
    const semEspecie = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { speciesId: UUID_INEXISTENTE }),
    );
    const semCidade = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { cityId: UUID_INEXISTENTE }),
    );

    // Assert
    await expect(semEspecie).rejects.toBeInstanceOf(SpeciesNotFoundError);
    await expect(semCidade).rejects.toBeInstanceOf(CityNotFoundError);
    expect(bancada.animais.linhas[0]?.name).toBe('Theo');
  });
});

describe('UpdateAnimalService — limite sobre o ESTADO FINAL (RN-50)', () => {
  it('CT-48: 3 gravadas mais 3 novas dariam 6 e a edicao e recusada', async () => {
    // Arrange
    const animal = await animalComImagens(3);
    const mantidas = animal.images.map((registro) => registro.id);

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: mantidas,
        images: imagens(3),
      }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageLimitExceededError);
    await expect(recusa).rejects.toMatchObject({
      message: 'É permitido no máximo 5 imagens por animal.',
    });
    // Recusado ANTES de enviar: nenhuma das tres novas foi ao armazenamento.
    expect(bancada.armazenamento.uploadCount).toBe(3);
    expect(bancada.animais.imagensDe(animal.id)).toHaveLength(3);
  });

  it('CT-49a: 5 gravadas, remover 2 e acrescentar 3 dariam 6 e a edicao e recusada', async () => {
    // Arrange — a aritmetica corrigida pela ALT-002: 5 - 2 + 3 = 6.
    const animal = await animalComImagens(MAX_IMAGES_PER_ANIMAL);
    const mantidas = animal.images.slice(0, 3).map((registro) => registro.id);

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: mantidas,
        images: imagens(3),
      }),
    );

    // Assert — e nada e alterado: as cinco originais continuam la.
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageLimitExceededError);
    expect(bancada.animais.imagensDe(animal.id)).toHaveLength(MAX_IMAGES_PER_ANIMAL);
    expect(bancada.armazenamento.storedPaths).toHaveLength(MAX_IMAGES_PER_ANIMAL);
  });

  it('CT-49b: 5 gravadas, remover 3 e acrescentar 3 dao 5 e a edicao e aceita', async () => {
    // Arrange — mesmo numero de arquivos ENVIADOS do caso anterior, desfecho
    // oposto: o que decide e o estado final, 5 - 3 + 3 = 5.
    const animal = await animalComImagens(MAX_IMAGES_PER_ANIMAL);
    const mantidas = animal.images.slice(0, 2).map((registro) => registro.id);

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: mantidas,
        images: imagens(3),
      }),
    );

    // Assert
    expect(atualizado.images).toHaveLength(MAX_IMAGES_PER_ANIMAL);
    expect(atualizado.images.map((registro) => registro.position)).toEqual([0, 1, 2, 3, 4]);
    expect(bancada.armazenamento.storedPaths).toHaveLength(MAX_IMAGES_PER_ANIMAL);
  });
});

describe('UpdateAnimalService — imagens', () => {
  it('CT-58: a imagem removida deixa de existir no banco e o arquivo sai do armazenamento', async () => {
    // Arrange
    const animal = await animalComImagens(2);
    const primeira = animal.images[0];
    const segunda = animal.images[1];

    if (primeira === undefined || segunda === undefined) {
      throw new Error('Bancada: o animal deveria ter duas imagens.');
    }

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: [segunda.id],
      }),
    );

    // Assert
    expect(atualizado.images.map((registro) => registro.id)).toEqual([segunda.id]);
    expect(bancada.animais.linhasDeImagem.map((registro) => registro.id)).toEqual([
      segunda.id,
    ]);
    const caminhos = bancada.armazenamento.storedPaths;

    expect(caminhos).toHaveLength(1);
    expect(caminhos).not.toContain(primeira.storagePath);
  });

  it('CT-60: removida a capa, a imagem seguinte assume a posicao 0', async () => {
    // Arrange
    const animal = await animalComImagens(2);
    const segunda = animal.images[1];

    if (segunda === undefined) {
      throw new Error('Bancada: o animal deveria ter duas imagens.');
    }

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { keepImageIds: [segunda.id] }),
    );

    // Assert — sem a reposicao, a unica imagem restante ficaria na posicao 1 e a
    // listagem procuraria uma capa que nao existe.
    expect(atualizado.images).toEqual([
      expect.objectContaining({ id: segunda.id, position: 0 }),
    ]);
  });

  it('CT-61: a ordem gravada e a ORDEM INFORMADA, e nao a ordem anterior', async () => {
    // Arrange
    const animal = await animalComImagens(3);
    const [primeira, segunda, terceira] = animal.images;

    if (primeira === undefined || segunda === undefined || terceira === undefined) {
      throw new Error('Bancada: o animal deveria ter tres imagens.');
    }

    // Act — ordem invertida.
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: [terceira.id, primeira.id, segunda.id],
      }),
    );

    // Assert
    expect(atualizado.images.map((registro) => registro.id)).toEqual([
      terceira.id,
      primeira.id,
      segunda.id,
    ]);
    expect(atualizado.images.map((registro) => registro.position)).toEqual([0, 1, 2]);
  });

  it('CT-61: as imagens novas entram DEPOIS das mantidas', async () => {
    // Arrange
    const animal = await animalComImagens(2);
    const mantidas = animal.images.map((registro) => registro.id);

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: mantidas,
        images: imagens(2),
      }),
    );

    // Assert
    expect(atualizado.images).toHaveLength(4);
    expect(atualizado.images.slice(0, 2).map((registro) => registro.id)).toEqual(mantidas);
    expect(atualizado.images.map((registro) => registro.position)).toEqual([0, 1, 2, 3]);
  });

  it('CT-62: `keepImageIds` com imagem de OUTRO animal e recusado e nada e alterado', async () => {
    // Arrange — o identificador e valido e existe no banco; o que ele nao e e
    // deste animal. Sem esta verificacao, um administrador poderia anexar a foto
    // de um animal alheio ao seu.
    const animal = await animalComImagens(1);
    const outro = bancada.animais.semear({
      name: 'Bidu',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
    });
    const imagemAlheia = bancada.animais.semearImagem({ animalId: outro.id });

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: [imagemAlheia.id],
      }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'keepImageIds', message: 'Imagem não encontrada.' }],
    });
    expect(bancada.animais.imagensDe(animal.id)).toHaveLength(1);
    expect(bancada.animais.imagensDe(outro.id)).toHaveLength(1);
  });

  it('CT-58: a remocao do arquivo antigo so acontece DEPOIS de a gravacao ter dado certo', async () => {
    // Arrange — a ordem importa: apagar o arquivo antes de a transacao confirmar
    // deixaria o animal com um registro apontando para um objeto inexistente.
    const animal = await animalComImagens(2);
    const primeira = animal.images[0];
    const segunda = animal.images[1];

    if (primeira === undefined || segunda === undefined) {
      throw new Error('Bancada: o animal deveria ter duas imagens.');
    }

    const caminhoAntigo = primeira.storagePath;

    jest
      .spyOn(bancada.repositorioDeAnimais, 'updateIfUnchanged')
      .mockRejectedValueOnce(new Error('transacao abortada'));

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { keepImageIds: [segunda.id] }),
    );

    // Assert — a transacao caiu, e o arquivo da imagem "removida" continua la.
    await expect(recusa).rejects.toThrow('transacao abortada');
    expect(bancada.armazenamento.storedPaths).toContain(caminhoAntigo);
  });

  it('CT-55: a transacao que cai depois do envio limpa as imagens NOVAS do armazenamento', async () => {
    // Arrange
    const animal = await animalComImagens(1);

    jest
      .spyOn(bancada.repositorioDeAnimais, 'updateIfUnchanged')
      .mockRejectedValueOnce(new Error('transacao abortada'));

    // Act
    const recusa = bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: animal.images.map((registro) => registro.id),
        images: imagens(2),
      }),
    );

    // Assert — as duas novas sairam; a antiga, que nao era desta requisicao, ficou.
    await expect(recusa).rejects.toThrow('transacao abortada');
    expect(bancada.armazenamento.storedPaths).toHaveLength(1);
  });

  it('CT-58: a falha ao apagar o arquivo substituido vira log e NAO derruba a edicao', async () => {
    // Arrange — o registro ja saiu do banco; insistir na resposta faria o
    // administrador repetir uma edicao que ja foi aplicada.
    const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const animal = await animalComImagens(2);
    const segunda = animal.images[1];

    if (segunda === undefined) {
      throw new Error('Bancada: o animal deveria ter duas imagens.');
    }

    bancada.armazenamento.failRemove();

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, { keepImageIds: [segunda.id] }),
    );

    // Assert
    expect(atualizado.images).toHaveLength(1);
    expect(espiaoDeLog).toHaveBeenCalledWith(
      '[animal-images] falha ao remover objetos de imagens substituidas; limpeza pendente',
      expect.objectContaining({ objectPaths: expect.any(Array) }),
    );
  });

  it('a edicao que nao mexe em imagem nenhuma nao chama o armazenamento', async () => {
    // Arrange
    const animal = await animalComImagens(2);
    const espiaoDeRemocao = jest.spyOn(bancada.armazenamento, 'remove');

    // Act
    const atualizado = await bancada.updateAnimal.execute(
      entradaDeEdicao(bancada, animal.id, animal.updatedAt, {
        keepImageIds: animal.images.map((registro) => registro.id),
        size: 'medio',
      }),
    );

    // Assert
    expect(atualizado.images).toHaveLength(2);
    expect(bancada.animais.linhas[0]?.size).toBe(AnimalSize.MEDIO);
    expect(espiaoDeRemocao).not.toHaveBeenCalled();
  });
});
