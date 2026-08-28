import { AnimalSex, AnimalSize, AnimalStatus } from '@prisma/client';

import { MESSAGES } from '~/domains/animals/animals.messages';
import { CityNotFoundError } from '~/domains/animals/errors/animal.errors';
import {
  AnimalImageEmptyError,
  AnimalImageLimitExceededError,
  AnimalImageTooLargeError,
  AnimalImageTypeNotAllowedError,
  ImageStorageUnavailableError,
} from '~/domains/animals/errors/animal-image.errors';
import type { AnimalImageUpload } from '~/domains/animals/services/store-animal-images.service';
import { SpeciesNotFoundError } from '~/domains/species/errors/species.errors';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_ANIMAL } from '~/infra/upload/upload-limits';
import * as clock from '~/utils/clock';

import {
  entradaDeCadastro,
  montarBancada,
  UUID_INEXISTENTE,
  type BancadaDeAnimais,
} from '../../../../tests/fakes/bancada-de-animais';
import {
  emptyBuffer,
  gifBuffer,
  jpegBuffer,
  pngBuffer,
  svgBuffer,
} from '../../../../tests/fixtures/image-fixtures';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-03 e HU-05 — cadastro de animal (CT-01 a CT-22 do que e regra de SERVICE,
 * CT-45 a CT-47 e CT-51 a CT-57).
 *
 * ================== O QUE ESTE ARQUIVO MEDE, E O QUE NAO ==================
 *
 * Aqui esta a REGRA: a ordem das verificacoes, o desfecho de cada ramo, e a
 * consistencia entre o banco e o armazenamento quando algo falha no meio.
 *
 * A validacao de FORMULARIO (nome vazio, data futura, campo nao previsto) NAO
 * esta aqui: ela vive no schema Zod, e o spec dela e
 * `animals.validators.spec.ts`. Duplicar aqui produziria testes que passam sem
 * exercitar nada — o service recebe a entrada JA validada, entao um "nome vazio"
 * chegaria intacto ate o banco e o teste mediria o fake.
 *
 * ================== O CASO QUE NAO PODE FALTAR ==================
 *
 * CT-55. Falhar a TERCEIRA de cinco imagens tem que deixar o produto no estado
 * anterior nos DOIS lados: nenhum animal no banco E nenhum objeto no
 * armazenamento. Verificar so o banco deixaria passar o vazamento de arquivos
 * orfaos no balde, que ninguem percebe ate a conta chegar.
 */

const CINCO_MB = MAX_IMAGE_SIZE_BYTES;

function imagem(tamanhoEmBytes = 1024): AnimalImageUpload {
  const content = jpegBuffer(tamanhoEmBytes);

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

describe('CreateAnimalService — cadastro', () => {
  it('CT-01: cadastra com todos os obrigatorios e nasce com status Disponivel', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada, {
      name: 'Theo',
      size: 'grande',
      sex: 'macho',
    });

    // Act
    const criado = await bancada.createAnimal.execute(entrada);

    // Assert — o status NAO e escolhido por quem cadastra (RN-14).
    expect(criado.status).toBe('disponivel');
    expect(criado.name).toBe('Theo');
    expect(criado.species).toEqual({ id: bancada.especie.id, name: 'Cachorro' });
    expect(criado.city).toEqual({
      id: bancada.cidade.id,
      name: 'Boa Esperanca',
      stateUf: 'ES',
    });
    expect(bancada.animais.linhas).toHaveLength(1);
    expect(bancada.animais.linhas[0]?.status).toBe(AnimalStatus.DISPONIVEL);
  });

  it('CT-02: cadastra so com os obrigatorios — sem data, sem descricao e sem imagem', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada);

    // Act
    const criado = await bancada.createAnimal.execute(entrada);

    // Assert — ausente e ausente: a idade e nula, e nao zero (RN-21).
    expect(criado.birthDate).toBeNull();
    expect(criado.ageInYears).toBeNull();
    expect(criado.description).toBeNull();
    expect(criado.images).toEqual([]);
    expect(bancada.armazenamento.storedPaths).toEqual([]);
  });

  it('CT-07: o nome chega ao banco normalizado e a chave de ordenacao vai em minusculas', async () => {
    // Arrange — o service recebe o nome JA normalizado pelo schema; o que ele
    // decide e a chave de ORDENACAO derivada dele (RN-41).
    const entrada = entradaDeCadastro(bancada, { name: 'Theo Junior' });

    // Act
    const criado = await bancada.createAnimal.execute(entrada);

    // Assert — o nome exibido preserva a caixa; a chave de ordenacao, nao.
    expect(criado.name).toBe('Theo Junior');
    expect(bancada.animais.linhas[0]?.nameNormalized).toBe('theo junior');
  });

  it('CT-08: dois animais com o mesmo nome convivem — nome de animal nao e unico (RN-05)', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada, { name: 'Theo' });

    // Act
    const primeiro = await bancada.createAnimal.execute(entrada);
    const segundo = await bancada.createAnimal.execute(entrada);

    // Assert — e a diferenca deliberada em relacao a especie, cujo nome e unico.
    expect(segundo.id).not.toBe(primeiro.id);
    expect(bancada.animais.linhas).toHaveLength(2);
  });

  it('CT-10: especie inexistente responde 404 SPECIES_NOT_FOUND e nao cria nada', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada, { speciesId: UUID_INEXISTENTE });

    // Act
    const recusa = bancada.createAnimal.execute(entrada);

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(SpeciesNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      code: 'SPECIES_NOT_FOUND',
      message: 'Espécie não encontrada.',
    });
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-11: cidade inexistente responde 404 CITY_NOT_FOUND e nao cria nada', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada, { cityId: UUID_INEXISTENTE });

    // Act
    const recusa = bancada.createAnimal.execute(entrada);

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(CityNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITY_NOT_FOUND',
      message: MESSAGES.CITY_NOT_FOUND,
    });
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-10 / CT-11: a especie e verificada ANTES da cidade, e nenhuma imagem sobe antes das duas', async () => {
    // Arrange — as duas invalidas de uma vez. A resposta precisa ser a da
    // especie, e o armazenamento precisa continuar intocado: nenhum arquivo pode
    // subir para um animal que nunca sera criado.
    const entrada = entradaDeCadastro(bancada, {
      speciesId: UUID_INEXISTENTE,
      cityId: UUID_INEXISTENTE,
      images: imagens(2),
    });

    // Act
    const recusa = bancada.createAnimal.execute(entrada);

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(SpeciesNotFoundError);
    expect(bancada.armazenamento.uploadCount).toBe(0);
  });

  it('CT-18: a idade e derivada do relogio, sem nenhuma coluna de idade', async () => {
    // Arrange — o relogio e espionado na fonte unica do projeto.
    jest.spyOn(clock, 'now').mockReturnValue(new Date('2026-08-25T12:00:00.000Z'));

    const entrada = entradaDeCadastro(bancada, {
      birthDate: new Date('2022-11-05T00:00:00.000Z'),
    });

    // Act
    const criado = await bancada.createAnimal.execute(entrada);

    // Assert
    expect(criado.ageInYears).toBe(3);
    expect(criado.birthDate).toBe('2022-11-05');
    expect(Object.keys(bancada.animais.linhas[0] ?? {})).not.toContain('ageInYears');
  });

  it('CT-22: as duas alternancias sao gravadas como falsas quando nao sao ligadas', async () => {
    // Arrange
    const entrada = entradaDeCadastro(bancada);

    // Act
    const criado = await bancada.createAnimal.execute(entrada);

    // Assert
    expect(criado.acceptsOtherAnimals).toBe(false);
    expect(criado.needsLargeSpace).toBe(false);
  });

  it('CT-21: a descricao de 1000 caracteres chega inteira ao banco', async () => {
    // Arrange — o limite e do schema; o que se mede aqui e que o service nao
    // trunca nem reescreve o texto no caminho.
    const descricao = 'a'.repeat(1000);

    // Act
    const criado = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { description: descricao }),
    );

    // Assert
    expect(criado.description).toHaveLength(1000);
    expect(criado.description).toBe(descricao);
  });

  it('CT-12: porte e sexo publicos sao traduzidos para os literais persistidos', async () => {
    // Arrange — o contrato da API trafega minusculas; o banco guarda o literal da
    // enumeracao. A traducao e do service, e trocar os dois lados passaria
    // despercebido sem esta asserção.

    // Act
    const criado = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { size: 'pequeno', sex: 'femea' }),
    );

    // Assert
    expect(criado.size).toBe('pequeno');
    expect(criado.sex).toBe('femea');
    expect(bancada.animais.linhas[0]?.size).toBe(AnimalSize.PEQUENO);
    expect(bancada.animais.linhas[0]?.sex).toBe(AnimalSex.FEMEA);
  });
});

describe('CreateAnimalService — imagens', () => {
  it('CT-45: duas imagens validas sao gravadas na ordem de envio, e a primeira e a capa', async () => {
    // Arrange
    const primeira = imagem(2048);
    const segunda: AnimalImageUpload = {
      content: pngBuffer(4096),
      sizeBytes: pngBuffer(4096).length,
    };

    // Act
    const criado = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [primeira, segunda] }),
    );

    // Assert
    expect(criado.images.map((registro) => registro.position)).toEqual([0, 1]);
    expect(bancada.armazenamento.storedPaths).toHaveLength(2);
    expect(bancada.animais.linhasDeImagem[0]?.contentType).toBe('image/jpeg');
    expect(bancada.animais.linhasDeImagem[1]?.contentType).toBe('image/png');
  });

  it('CT-46: exatamente 5 imagens sao aceitas', async () => {
    // Arrange & Act
    const criado = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: imagens(MAX_IMAGES_PER_ANIMAL) }),
    );

    // Assert
    expect(criado.images).toHaveLength(MAX_IMAGES_PER_ANIMAL);
    expect(bancada.armazenamento.storedPaths).toHaveLength(MAX_IMAGES_PER_ANIMAL);
  });

  it('CT-47: 6 imagens sao recusadas e NENHUMA delas chega ao armazenamento', async () => {
    // Arrange — a recusa e a PRIMEIRA coisa que o service faz, antes de consultar
    // especie, cidade ou armazenamento: subir cinco para recusar a sexta seria
    // gastar rede e deixar lixo no balde.
    const entrada = entradaDeCadastro(bancada, {
      images: imagens(MAX_IMAGES_PER_ANIMAL + 1),
    });

    // Act
    const recusa = bancada.createAnimal.execute(entrada);

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageLimitExceededError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 400,
      code: 'ANIMAL_IMAGE_LIMIT_EXCEEDED',
      message: 'É permitido no máximo 5 imagens por animal.',
    });
    expect(bancada.armazenamento.uploadCount).toBe(0);
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-51: arquivo de 0 byte e recusado com a mensagem de arquivo vazio', async () => {
    // Arrange
    const vazio: AnimalImageUpload = { content: emptyBuffer(), sizeBytes: 0 };

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [vazio] }),
    );

    // Assert — 400, e nao 415: o arquivo nao tem formato errado, ele nao tem nada.
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageEmptyError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 400,
      message: 'O arquivo enviado está vazio.',
    });
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-52: GIF renomeado para `.jpg` e recusado com 415 pela assinatura binaria', async () => {
    // Arrange
    const disfarcado: AnimalImageUpload = {
      content: gifBuffer(),
      sizeBytes: gifBuffer().length,
    };

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [disfarcado] }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageTypeNotAllowedError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 415,
      code: 'ANIMAL_IMAGE_TYPE_NOT_ALLOWED',
      message: 'Apenas imagens JPEG ou PNG são aceitas.',
    });
    expect(bancada.armazenamento.uploadCount).toBe(0);
  });

  it('CT-53: SVG com script embutido nunca chega ao balde de leitura publica', async () => {
    // Arrange — o caso mais grave: aceito, ele executaria script no navegador de
    // quem abrisse a URL publica da foto.
    const svg: AnimalImageUpload = { content: svgBuffer(), sizeBytes: svgBuffer().length };

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [svg] }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageTypeNotAllowedError);
    expect(bancada.armazenamento.storedPaths).toEqual([]);
    expect(bancada.armazenamento.uploadCount).toBe(0);
  });

  it('CT-50: a imagem de exatamente 5 MB e aceita e a de 5 MB + 1 byte e recusada com 413', async () => {
    // Arrange
    const noLimite = imagem(CINCO_MB);
    const umByteAlem = imagem(CINCO_MB + 1);

    // Act
    const aceita = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [noLimite] }),
    );
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [umByteAlem] }),
    );

    // Assert
    expect(aceita.images).toHaveLength(1);
    await expect(recusa).rejects.toBeInstanceOf(AnimalImageTooLargeError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 413,
      code: 'ANIMAL_IMAGE_TOO_LARGE',
      message: 'Cada imagem deve ter no máximo 5 MB.',
    });
  });

  it('CT-57: o nome hostil do arquivo nao entra no caminho do objeto', async () => {
    // Arrange — o `AnimalImageUpload` nem sequer TEM campo de nome: o caminho e
    // montado com o identificador do animal e o da imagem, e a garantia e
    // estrutural, nao uma sanitizacao que alguem possa esquecer de chamar.

    // Act
    const criado = await bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [imagem()] }),
    );

    // Assert
    const caminho = bancada.armazenamento.storedPaths[0] ?? '';

    expect(caminho.startsWith(`animals/${criado.id}/`)).toBe(true);
    expect(caminho).not.toContain('..');
    expect(caminho).toMatch(/^animals\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
  });

  it('CT-56: armazenamento indisponivel responde 503 e o banco continua consistente', async () => {
    // Arrange
    bancada.armazenamento.failUploadOnNthCall(1);

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: [imagem()] }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(ImageStorageUnavailableError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 503,
      code: 'IMAGE_STORAGE_UNAVAILABLE',
      message: 'Não foi possível salvar as imagens. Tente novamente.',
    });
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-55: falha ao gravar a TERCEIRA de cinco imagens nao deixa animal nem arquivo', async () => {
    // Arrange — o caso central da compensacao.
    bancada.armazenamento.failUploadOnNthCall(3);

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: imagens(MAX_IMAGES_PER_ANIMAL) }),
    );

    // Assert — AS DUAS COISAS. Verificar so o banco deixaria passar o vazamento
    // dos arquivos ja enviados, que ninguem percebe ate a conta do balde chegar.
    await expect(recusa).rejects.toBeInstanceOf(ImageStorageUnavailableError);
    expect(bancada.animais.linhas).toEqual([]);
    expect(bancada.animais.linhasDeImagem).toEqual([]);
    expect(bancada.armazenamento.storedPaths).toEqual([]);
    // As outras quatro CHEGARAM a ser enviadas — e por isso que a compensacao
    // existe. Se este numero cair para 3, o envio deixou de ser concorrente.
    expect(bancada.armazenamento.uploadCount).toBe(MAX_IMAGES_PER_ANIMAL);
  });

  it('CT-55: a compensacao so dispara depois que TODOS os envios em voo terminam', async () => {
    // Arrange — cinco imagens de duracoes DIFERENTES, e quem falha e a MAIS
    // RAPIDA. E o unico arranjo que separa `Promise.allSettled` de `Promise.all`:
    // com `Promise.all` o service rejeita no instante da primeira falha, a
    // compensacao roda com a lista VAZIA e os quatro envios ainda em voo terminam
    // DEPOIS dela, deixando quatro objetos orfaos no balde. Um teste sequencial —
    // ou um que meça o balde antes de os envios terminarem — passa nos dois casos.
    const atrasoPorEnvio = [0, 30, 20, 40, 10];
    const original = bancada.armazenamento.upload.bind(bancada.armazenamento);
    const emVoo: Array<Promise<unknown>> = [];
    let iniciados = 0;
    let concluidos = 0;

    jest.spyOn(bancada.armazenamento, 'upload').mockImplementation((entrada) => {
      const indice = iniciados;

      iniciados += 1;

      const envio = (async () => {
        await new Promise<void>((resolver) => {
          setTimeout(resolver, atrasoPorEnvio[indice] ?? 0);
        });

        concluidos += 1;

        // A primeira a ser preparada e a que falha, e ela e tambem a mais rapida.
        if (indice === 0) {
          throw new ImageStorageUnavailableError();
        }

        return original(entrada);
      })();

      emVoo.push(envio.catch(() => undefined));

      return envio;
    });

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: imagens(MAX_IMAGES_PER_ANIMAL) }),
    );

    await expect(recusa).rejects.toBeInstanceOf(ImageStorageUnavailableError);

    // Assert — PRIMEIRO: no instante em que o service desiste, os cinco envios ja
    // terminaram. Com `Promise.all` este numero seria 1.
    expect(concluidos).toBe(MAX_IMAGES_PER_ANIMAL);

    // SEGUNDO: mesmo dando ao laco de eventos toda a chance de entregar envios
    // atrasados, o balde continua vazio — nao ha objeto orfao chegando depois.
    await Promise.allSettled(emVoo);

    expect(bancada.armazenamento.storedPaths).toEqual([]);
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-55: falha ao GRAVAR NO BANCO depois do envio tambem limpa o armazenamento', async () => {
    // Arrange — o outro lado da compensacao: as cinco imagens subiram, e e a
    // transacao que cai. O `catch` do service precisa remover o que ja subiu,
    // senao o balde fica com cinco arquivos de um animal que nao existe.
    jest
      .spyOn(bancada.repositorioDeAnimais, 'create')
      .mockRejectedValueOnce(new Error('conexao com o banco perdida'));

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: imagens(2) }),
    );

    // Assert
    await expect(recusa).rejects.toThrow('conexao com o banco perdida');
    expect(bancada.armazenamento.storedPaths).toEqual([]);
    expect(bancada.animais.linhas).toEqual([]);
  });

  it('CT-56: a falha da REMOCAO durante a compensacao nao troca o erro devolvido ao cliente', async () => {
    // Arrange — o armazenamento recusa tanto o envio quanto a limpeza. O cliente
    // precisa continuar recebendo o 503 do envio, e nao um erro da limpeza:
    // a compensacao e melhor-esforco e o seu fracasso vira log, nao resposta.
    const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    bancada.armazenamento.failUploadOnNthCall(2);
    bancada.armazenamento.failRemove();

    // Act
    const recusa = bancada.createAnimal.execute(
      entradaDeCadastro(bancada, { images: imagens(3) }),
    );

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(ImageStorageUnavailableError);
    expect(espiaoDeLog).toHaveBeenCalledWith(
      '[animal-images] falha ao remover objetos apos envio desfeito; limpeza pendente',
      expect.objectContaining({ objectPaths: expect.any(Array) }),
    );
    expect(bancada.animais.linhas).toEqual([]);
  });
});
