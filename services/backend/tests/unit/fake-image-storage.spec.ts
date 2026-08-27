import { ImageStorageUnavailableError } from '~/domains/animals/errors/animal-image.errors';
import type { StoredImageInput } from '~/infra/storage/image-storage.port';

import { FakeImageStorage } from '../fakes/fake-image-storage';

/**
 * O dublê é o que torna os casos de uso de animal testáveis sem balde real. Ele
 * próprio precisa de teste por um motivo específico: o gatilho por enésima chamada
 * é a peça que sustenta o CT-55 (falhar ao gravar a TERCEIRA de cinco imagens e
 * verificar que nada sobra no armazenamento). Um gatilho quebrado faria o CT-55
 * passar sem exercitar a compensação, que é justamente o que ele existe para
 * verificar.
 */
describe('FakeImageStorage', () => {
  function imagem(indice: number): StoredImageInput {
    return {
      objectPath: `animals/animal-1/imagem-${indice}.jpg`,
      content: Buffer.from(`conteudo-${indice}`),
      contentType: 'image/jpeg',
    };
  }

  it('guarda o objeto em memória e devolve uma URL pública com o caminho', async () => {
    // Arrange
    const armazenamento = new FakeImageStorage();

    // Act
    const { publicUrl } = await armazenamento.upload(imagem(1));

    // Assert
    expect(armazenamento.storedPaths).toEqual(['animals/animal-1/imagem-1.jpg']);
    expect(publicUrl).toContain('animals/animal-1/imagem-1.jpg');
    expect(armazenamento.objetoEm('animals/animal-1/imagem-1.jpg')?.contentType).toBe('image/jpeg');
  });

  it('CT-55 — `failUploadOnNthCall(3)` falha exatamente na terceira de cinco imagens', async () => {
    // Arrange
    const armazenamento = new FakeImageStorage();
    armazenamento.failUploadOnNthCall(3);

    // Act
    await armazenamento.upload(imagem(1));
    await armazenamento.upload(imagem(2));
    const falha: unknown = await armazenamento.upload(imagem(3)).catch((motivo: unknown) => motivo);

    // Assert — as duas primeiras subiram e continuam lá; a compensação é do
    // service, e é essa lista que ele precisa conseguir observar.
    expect(falha).toBeInstanceOf(ImageStorageUnavailableError);
    expect(armazenamento.storedPaths).toHaveLength(2);
    expect(armazenamento.uploadCount).toBe(3);
  });

  it('a falha sai como REJEIÇÃO da promessa, e não como exceção síncrona', async () => {
    // Arrange — é o que o `SupabaseImageStorage` faz, e é a forma que os `catch`
    // dos casos de uso esperam.
    const armazenamento = new FakeImageStorage();
    armazenamento.failUploadOnNthCall(1);

    // Act — a promessa precisa ser capturada na mesma expressão: um `upload` que
    // lançasse de forma síncrona quebraria aqui, e um cujo resultado fosse
    // descartado viraria rejeição não tratada, que derruba o worker do Jest.
    let promessa: Promise<unknown> | undefined;
    expect(() => {
      promessa = armazenamento.upload(imagem(1));
    }).not.toThrow();

    // Assert
    await expect(promessa).rejects.toBeInstanceOf(ImageStorageUnavailableError);
    await expect(armazenamento.upload(imagem(2))).resolves.toBeDefined();
  });

  it('reproduz o `upsert: false` do adaptador real: caminho repetido é recusado', async () => {
    // Arrange — um dublê que aceitasse a repetição esconderia um gerador de
    // caminho quebrado.
    const armazenamento = new FakeImageStorage();
    await armazenamento.upload(imagem(1));

    // Act & Assert
    await expect(armazenamento.upload(imagem(1))).rejects.toBeInstanceOf(
      ImageStorageUnavailableError,
    );
  });

  it('`remove` apaga a lista inteira e ignora caminho inexistente', async () => {
    // Arrange
    const armazenamento = new FakeImageStorage();
    await armazenamento.upload(imagem(1));
    await armazenamento.upload(imagem(2));

    // Act
    await armazenamento.remove([
      'animals/animal-1/imagem-1.jpg',
      'animals/animal-1/inexistente.jpg',
    ]);

    // Assert
    expect(armazenamento.storedPaths).toEqual(['animals/animal-1/imagem-2.jpg']);
  });

  it('`failRemove()` faz a remoção rejeitar sem apagar nada', async () => {
    // Arrange — é o cenário da RN-40: o registro já saiu do banco e o arquivo fica.
    const armazenamento = new FakeImageStorage();
    await armazenamento.upload(imagem(1));
    armazenamento.failRemove();

    // Act
    const falha: unknown = await armazenamento
      .remove(['animals/animal-1/imagem-1.jpg'])
      .catch((motivo: unknown) => motivo);

    // Assert
    expect(falha).toBeInstanceOf(ImageStorageUnavailableError);
    expect(armazenamento.storedPaths).toHaveLength(1);
  });

  it('`limpar()` zera objetos, contador e gatilhos', async () => {
    // Arrange — independência de ordem entre testes que compartilham o dublê.
    const armazenamento = new FakeImageStorage();
    armazenamento.failUploadOnNthCall(1);
    armazenamento.failRemove();

    // Act
    armazenamento.limpar();
    await armazenamento.upload(imagem(1));
    await armazenamento.remove(['animals/animal-1/imagem-1.jpg']);

    // Assert
    expect(armazenamento.storedObjects).toEqual([]);
    expect(armazenamento.uploadCount).toBe(1);
  });
});
