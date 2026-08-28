import { AnimalNotFoundError } from '~/domains/animals/errors/animal.errors';

import {
  montarBancada,
  UUID_INEXISTENTE,
  type BancadaDeAnimais,
} from '../../../../tests/fakes/bancada-de-animais';
import { jpegBuffer } from '../../../../tests/fixtures/image-fixtures';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-08 — exclusao de animal (CT-76, CT-78, CT-79, CT-80).
 *
 * O ponto delicado e o CT-79: quando o armazenamento RECUSA apagar o arquivo, a
 * exclusao continua sendo sucesso. O registro ja saiu do banco e nenhum ponto do
 * produto exibe a imagem (RN-40); insistir no erro faria o administrador repetir
 * uma exclusao ja aplicada e receber 404. O arquivo remanescente vira log, e a
 * assinatura desse log e contrato: e por ele que se descobre o que limpar.
 */

let bancada: BancadaDeAnimais;

beforeEach(() => {
  reiniciarSequenciaDeUuid();
  bancada = montarBancada();
});

async function animalComDuasImagens(): Promise<{
  readonly id: string;
  readonly caminhos: ReadonlyArray<string>;
}> {
  const animal = bancada.animais.semear({
    name: 'Theo',
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
  });

  const caminhos: string[] = [];

  for (let posicao = 0; posicao < 2; posicao += 1) {
    const imagem = bancada.animais.semearImagem({ animalId: animal.id, position: posicao });

    caminhos.push(imagem.storagePath);

    await bancada.armazenamento.upload({
      objectPath: imagem.storagePath,
      content: jpegBuffer(512),
      contentType: 'image/jpeg',
    });
  }

  return { id: animal.id, caminhos };
}

describe('DeleteAnimalService', () => {
  it('CT-76: exclui o animal, os registros das imagens e os arquivos do armazenamento', async () => {
    // Arrange
    const animal = await animalComDuasImagens();

    // Act
    await bancada.deleteAnimal.execute({ id: animal.id });

    // Assert — os tres lados: linha do animal, linhas das imagens (cascata da
    // chave estrangeira) e objetos no balde.
    expect(bancada.animais.linhas).toEqual([]);
    expect(bancada.animais.linhasDeImagem).toEqual([]);
    expect(bancada.armazenamento.storedPaths).toEqual([]);
  });

  it('CT-78: excluir animal inexistente responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange & Act
    const recusa = bancada.deleteAnimal.execute({ id: UUID_INEXISTENTE });

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      code: 'ANIMAL_NOT_FOUND',
      message: 'Animal não encontrado.',
    });
  });

  it('CT-78: o animal excluido por outra aba ENTRE a leitura e a remocao responde 404', async () => {
    // Arrange — a corrida: o `findById` achou, e a linha sumiu antes do
    // `deleteMany`. Sem este ramo a resposta seria 204 para uma exclusao que este
    // pedido nao fez, e o armazenamento seria limpo duas vezes.
    const animal = await animalComDuasImagens();

    jest
      .spyOn(bancada.repositorioDeAnimais, 'deleteById')
      .mockResolvedValueOnce(0);

    // Act
    const recusa = bancada.deleteAnimal.execute({ id: animal.id });

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
    // E o arquivo NAO foi apagado: quem nao excluiu nao limpa.
    expect(bancada.armazenamento.storedPaths).toHaveLength(2);
  });

  it('CT-79: o armazenamento que recusa a remocao NAO derruba a exclusao, e o log registra os caminhos', async () => {
    // Arrange
    const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const animal = await animalComDuasImagens();

    bancada.armazenamento.failRemove();

    // Act
    await expect(bancada.deleteAnimal.execute({ id: animal.id })).resolves.toBeUndefined();

    // Assert — o animal saiu do banco...
    expect(bancada.animais.linhas).toEqual([]);
    expect(bancada.animais.linhasDeImagem).toEqual([]);
    // ...e o que ficou no balde esta nominalmente no log, com a causa correta.
    expect(espiaoDeLog).toHaveBeenCalledWith(
      '[animal-images] falha ao remover objetos de animal excluido; limpeza pendente',
      expect.objectContaining({ objectPaths: [...animal.caminhos] }),
    );
  });

  it('CT-76: animal sem imagem nenhuma nao chama o armazenamento', async () => {
    // Arrange — `compensar` sai cedo com a lista vazia: uma chamada de rede para
    // remover nada e desperdicio, e ainda produziria log de erro se falhasse.
    const animal = bancada.animais.semear({
      name: 'Bidu',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
    });
    const espiaoDeRemocao = jest.spyOn(bancada.armazenamento, 'remove');

    // Act
    await bancada.deleteAnimal.execute({ id: animal.id });

    // Assert
    expect(bancada.animais.linhas).toEqual([]);
    expect(espiaoDeRemocao).not.toHaveBeenCalled();
  });

  it('CT-80: excluir o animal NAO afeta a especie nem a cidade', async () => {
    // Arrange — a distincao da Decisao 11: cascata entre animal e imagem, jamais
    // entre animal e especie. A especie existe independentemente e sobrevive.
    const animal = await animalComDuasImagens();

    // Act
    await bancada.deleteAnimal.execute({ id: animal.id });

    // Assert
    expect(bancada.especies.linhas.map((especie) => especie.name)).toEqual(['Cachorro']);
    expect(bancada.geografia.linhasDeCidade).toHaveLength(1);
  });
});
