import express, { type Express } from 'express';
import request from 'supertest';

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ANIMAL,
  MAX_REQUEST_BODY_BYTES,
} from '~/infra/upload/upload-limits';
import { errorHandlerMiddleware } from '~/middlewares/error-handler.middleware';
import { uploadAnimalImages } from '~/middlewares/upload-animal-images.middleware';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Leitura de `multipart/form-data` das rotas de animal (TASK-BACKEND-003).
 *
 * O ponto que este spec protege é a TRADUÇÃO: sem ela as falhas do multer chegam
 * ao frontend como erro genérico, sem `code` para ramificar — que é exatamente a
 * falha da RN-51 que só aparece em produção. Cada asserção compara a mensagem
 * PT-BR literal, porque ela é o contrato.
 *
 * As imagens em si (assinatura binária, limite sobre o estado final) são
 * exercitadas pela TASK-BACKEND-011; aqui só se verifica o que o PARSER faz.
 */

/** Assinatura real de JPEG, preenchida até o tamanho pedido. */
function jpeg(tamanhoEmBytes: number): Buffer {
  const conteudo = Buffer.alloc(tamanhoEmBytes, 0x00);

  conteudo.set([0xff, 0xd8, 0xff, 0xe0], 0);

  return conteudo;
}

interface CorpoRecebido {
  readonly campos: unknown;
  readonly arquivos: ReadonlyArray<{ readonly campo: string; readonly bytes: number }>;
}

/**
 * Handler mínimo no lugar do controller: devolve o que o parser montou, para que
 * o teste observe o que CHEGARIA ao service — inclusive a sexta imagem, que o
 * middleware não pode cortar.
 */
function appComUpload(): Express {
  const aplicacao = express();

  aplicacao.post('/animais', uploadAnimalImages, (requisicao, resposta) => {
    const arquivos = Array.isArray(requisicao.files) ? requisicao.files : [];
    const corpo: CorpoRecebido = {
      campos: requisicao.body,
      arquivos: arquivos.map((arquivo) => ({
        campo: arquivo.fieldname,
        bytes: arquivo.buffer.length,
      })),
    };

    resposta.status(HTTP_STATUS.OK).json(corpo);
  });

  aplicacao.use(errorHandlerMiddleware);

  return aplicacao;
}

/** Fronteira arbitrária, usada para montar corpos multipart hostis à mão. */
const FRONTEIRA = 'FRONTEIRADETESTE';

/**
 * Envia um corpo bruto com o `Content-Type` escolhido, sem passar pelo montador
 * de formulário do supertest — é a única forma de produzir um envelope multipart
 * QUEBRADO, que é o que o parser recusa antes de qualquer regra de negócio.
 *
 * O espião de `console.error` é o segundo contrato verificado: uma falha traduzida
 * não pode deixar rastro no log do servidor, senão qualquer requisição malformada
 * vira ruído de log de graça.
 */
async function enviarCorpoBruto(
  contentType: string,
  corpo: string,
): Promise<{ readonly resposta: request.Response; readonly logs: number }> {
  const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  const resposta = await request(appComUpload())
    .post('/animais')
    .set('Content-Type', contentType)
    .send(corpo);

  return { resposta, logs: espiaoDeLog.mock.calls.length };
}

const RECUSA_DO_ENVELOPE = {
  error: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Envie os dados do animal como multipart/form-data.',
  },
};

describe('uploadAnimalImages', () => {
  it('recusa com 415 quem envia a rota de animal fora de `multipart/form-data`', async () => {
    // Arrange
    const aplicacao = appComUpload();

    // Act — o multer devolveria o controle em silêncio aqui, e a rota culparia um
    // campo obrigatório ausente em vez do tipo de conteúdo.
    const resposta = await request(aplicacao)
      .post('/animais')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'Theo' }));

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect(resposta.body).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Envie os dados do animal como multipart/form-data.',
      },
    });
  });

  it('lê os campos de texto e os arquivos do formulário', async () => {
    // Arrange
    const aplicacao = appComUpload();

    // Act
    const resposta = await request(aplicacao)
      .post('/animais')
      .field('name', 'Theo')
      .attach('images', jpeg(64), 'theo.jpg');

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.OK);
    expect(resposta.body).toEqual({
      campos: { name: 'Theo' },
      arquivos: [{ campo: 'images', bytes: 64 }],
    });
  });

  it('CT-50: aceita a imagem de exatamente 5 MB e recusa 5 MB + 1 byte com 413', async () => {
    // Arrange
    const aplicacao = appComUpload();

    // Act
    const noLimite = await request(aplicacao)
      .post('/animais')
      .attach('images', jpeg(MAX_IMAGE_SIZE_BYTES), 'theo.jpg');
    const umByteAcima = await request(aplicacao)
      .post('/animais')
      .attach('images', jpeg(MAX_IMAGE_SIZE_BYTES + 1), 'theo.jpg');

    // Assert
    expect(noLimite.status).toBe(HTTP_STATUS.OK);
    expect(umByteAcima.status).toBe(HTTP_STATUS.PAYLOAD_TOO_LARGE);
    expect(umByteAcima.body).toEqual({
      error: {
        code: 'ANIMAL_IMAGE_TOO_LARGE',
        message: 'Cada imagem deve ter no máximo 5 MB.',
      },
    });
  });

  it('RN-50: NÃO corta a sexta imagem — as seis chegam ao service, que é quem recusa', async () => {
    // Arrange — o `+ 1` do limite do parser existe para que a recusa venha da
    // regra de negócio, com `code` em PT-BR, e não do multer.
    const aplicacao = appComUpload();
    const envio = request(aplicacao).post('/animais');

    for (let indice = 0; indice < MAX_IMAGES_PER_ANIMAL + 1; indice += 1) {
      void envio.attach('images', jpeg(32), `foto-${String(indice)}.jpg`);
    }

    // Act
    const resposta = await envio;

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.OK);
    expect(resposta.body).toMatchObject({
      arquivos: Array.from({ length: MAX_IMAGES_PER_ANIMAL + 1 }, () => ({
        campo: 'images',
        bytes: 32,
      })),
    });
  });

  it('RN-50: além do que o parser lê, a recusa continua sendo a mensagem de negócio', async () => {
    // Arrange
    const aplicacao = appComUpload();
    const envio = request(aplicacao).post('/animais');

    for (let indice = 0; indice < MAX_IMAGES_PER_ANIMAL + 3; indice += 1) {
      void envio.attach('images', jpeg(32), `foto-${String(indice)}.jpg`);
    }

    // Act
    const resposta = await envio;

    // Assert — "Too many files" do multer nunca chega ao frontend.
    expect(resposta.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(resposta.body).toEqual({
      error: {
        code: 'ANIMAL_IMAGE_LIMIT_EXCEEDED',
        message: 'É permitido no máximo 5 imagens por animal.',
      },
    });
  });

  it('traduz arquivo em campo não previsto para 400 apontando o campo recebido', async () => {
    // Arrange
    const aplicacao = appComUpload();

    // Act
    const resposta = await request(aplicacao)
      .post('/animais')
      .attach('avatar', jpeg(32), 'theo.jpg');

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(resposta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'avatar', message: 'Campo não permitido nesta requisição.' }],
      },
    });
  });

  it('CT-54: corpo total acima do teto vira 413 de negócio, e não erro genérico', async () => {
    // Arrange — seis imagens de 5 MB: cada uma passa no limite POR ARQUIVO e a
    // sexta passa no limite de quantidade do parser, mas a soma ultrapassa o teto
    // do corpo. É o caso que, sem tradução, chega ao frontend como erro genérico
    // do servidor de borda (RN-51).
    const aplicacao = appComUpload();
    const cincoMegabytes = jpeg(MAX_IMAGE_SIZE_BYTES);
    const envio = request(aplicacao).post('/animais');

    for (let indice = 0; indice < MAX_IMAGES_PER_ANIMAL + 1; indice += 1) {
      void envio.attach('images', cincoMegabytes, `foto-${String(indice)}.jpg`);
    }

    // Act
    const resposta = await envio;

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.PAYLOAD_TOO_LARGE);
    expect(resposta.body).toEqual({
      error: {
        code: 'REQUEST_BODY_TOO_LARGE',
        message:
          'O envio ultrapassou o tamanho máximo permitido. Envie menos imagens ou imagens menores.',
      },
    });
  });

  it('RN-51: `multipart/form-data` sem `boundary` vira 415 de negócio, e não 500', async () => {
    // Arrange & Act — sem o parâmetro `boundary` o construtor do Busboy lança um
    // `Error` CRU, e não um `MulterError`: era o caminho que escapava para o ramo
    // genérico do error handler.
    const { resposta, logs } = await enviarCorpoBruto('multipart/form-data', 'qualquer coisa');

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect(resposta.body).toEqual(RECUSA_DO_ENVELOPE);
    expect(logs).toBe(0);
  });

  it('RN-51: corpo truncado no meio de uma parte vira 415 de negócio, e não 500', async () => {
    // Arrange — a parte anuncia um arquivo e o corpo simplesmente acaba: o busboy
    // emite "Unexpected end of form" por `error`, também como `Error` cru.
    const corpoTruncado =
      `--${FRONTEIRA}\r\n` +
      'Content-Disposition: form-data; name="images"; filename="theo.jpg"\r\n' +
      'Content-Type: image/jpeg\r\n\r\n' +
      'inicio-de-arquivo-sem-fim';

    // Act
    const { resposta, logs } = await enviarCorpoBruto(
      `multipart/form-data; boundary=${FRONTEIRA}`,
      corpoTruncado,
    );

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect(resposta.body).toEqual(RECUSA_DO_ENVELOPE);
    expect(logs).toBe(0);
  });

  it('RN-51: cabeçalho de parte malformado vira 415 de negócio, e não 500', async () => {
    // Arrange — espaço antes dos dois-pontos quebra o cabeçalho da parte
    // ("Malformed part header"), terceiro caminho que chegava como `Error` cru.
    const cabecalhoQuebrado =
      `--${FRONTEIRA}\r\n` +
      'Content-Disposition : form-data; name="images"\r\n\r\n' +
      'x\r\n' +
      `--${FRONTEIRA}--\r\n`;

    // Act
    const { resposta, logs } = await enviarCorpoBruto(
      `multipart/form-data; boundary=${FRONTEIRA}`,
      cabecalhoQuebrado,
    );

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect(resposta.body).toEqual(RECUSA_DO_ENVELOPE);
    expect(logs).toBe(0);
  });

  it('defeito de programação nosso continua produzindo 500, e não é disfarçado de 415', async () => {
    // Arrange — a tradução não pode virar um `catch` universal: um `TypeError`
    // nascido de bug nosso tem de continuar aparecendo como erro do servidor, com
    // a stack no log, e não como culpa de quem enviou. O erro é emitido NA
    // REQUISIÇÃO para percorrer exatamente o mesmo caminho de falha do parser.
    const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const aplicacao = express();

    aplicacao.post(
      '/animais',
      (requisicao, _resposta, proximo) => {
        proximo();
        requisicao.emit('error', new TypeError('defeito de programacao nosso'));
      },
      uploadAnimalImages,
      (_requisicao, resposta) => {
        resposta.status(HTTP_STATUS.OK).json({});
      },
    );
    aplicacao.use(errorHandlerMiddleware);

    // Act
    const resposta = await request(aplicacao)
      .post('/animais')
      .attach('images', jpeg(32), 'theo.jpg');

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(resposta.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro inesperado. Tente novamente.',
      },
    });
    expect(espiaoDeLog).toHaveBeenCalledTimes(1);
  });

  it('o teto do corpo é derivado das cinco imagens de 5 MB, com folga para o envelope', () => {
    // Arrange & Act & Assert — cinco imagens no tamanho máximo PRECISAM caber; o
    // teto não pode ser a soma exata, senão as fronteiras do multipart e os
    // campos de texto derrubariam o envio válido.
    expect(MAX_REQUEST_BODY_BYTES).toBeGreaterThan(
      MAX_IMAGES_PER_ANIMAL * MAX_IMAGE_SIZE_BYTES,
    );
    expect(HTTP_STATUS.PAYLOAD_TOO_LARGE).toBe(413);
    expect(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE).toBe(415);
  });
});
