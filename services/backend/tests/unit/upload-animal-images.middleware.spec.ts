import express, { type Express } from 'express';
import request from 'supertest';

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ANIMAL,
  MAX_REQUEST_BODY_BYTES,
  MAX_TEXT_FIELD_BYTES,
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

/**
 * Resposta carregada por um erro do superagent. Quando o servidor responde e
 * fecha a conexao antes de o cliente terminar de escrever, o `await` rejeita com
 * um erro que TRAZ a resposta — e e ela o assunto do teste, nao o socket.
 */
function respostaDoErro(motivo: unknown): request.Response {
  if (motivo instanceof Error && 'response' in motivo) {
    const resposta: unknown = motivo.response;

    if (resposta !== undefined && resposta !== null) {
      return resposta as request.Response;
    }
  }

  throw motivo;
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
  // ------------------------------------------------------------------------
  // Ramos acrescentados pela TASK-BACKEND-011.
  //
  // Os tres casos abaixo cobriam-se apenas por SONDA durante a revisao da
  // TASK-BACKEND-003: o comportamento foi verificado a mao e nao ficou nenhum
  // teste. Sem eles, o contador de bytes e duas traducoes do parser podiam ser
  // removidos sem que nada ficasse vermelho.
  // ------------------------------------------------------------------------

  it('RN-51: campo de texto acima do teto vira 413 de negócio (`LIMIT_FIELD_VALUE`)', async () => {
    // Arrange — o limite por campo de texto é 16 kB. Um valor acima dele não é
    // "campo inválido": é envelope grande demais, e a mensagem precisa dizer o
    // que fazer (enviar menos, ou menor).
    const aplicacao = appComUpload();

    // Act
    const resposta = await request(aplicacao)
      .post('/animais')
      .field('description', 'a'.repeat(MAX_TEXT_FIELD_BYTES + 1));

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

  it('RN-51: parte sem NOME de campo cai no ramo genérico e vira 400 de campo não permitido', async () => {
    // Arrange — envelope bem formado, mas com uma parte cujo
    // `Content-Disposition` não traz `name`. O multer aborta com um código que
    // NÃO está entre os traduzidos um a um (`MISSING_FIELD_NAME`), e é o ramo
    // `default` que impede esse código de escapar para o erro genérico do
    // servidor. Sem ele, um cliente malformado produziria 500 e log de ruído.
    const corpo =
      `--${FRONTEIRA}\r\n` +
      'Content-Disposition: form-data\r\n\r\n' +
      'valor sem nome de campo\r\n' +
      `--${FRONTEIRA}--\r\n`;

    // Act
    const { resposta, logs } = await enviarCorpoBruto(
      `multipart/form-data; boundary=${FRONTEIRA}`,
      corpo,
    );

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(resposta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [
          { field: 'images', message: 'Campo não permitido nesta requisição.' },
        ],
      },
    });
    expect(logs).toBe(0);
  });

  it('CT-54: corpo em `chunked`, SEM `Content-Length`, é cortado pelo contador de bytes', async () => {
    // Arrange — o `Content-Length` cobre todo cliente real, porque o navegador
    // sempre o calcula para `FormData`. Um envio em `Transfer-Encoding: chunked`
    // chega SEM ele, e aí o único freio é o contador de bytes do middleware.
    //
    // São SEIS arquivos de 4,5 MB: cada um passa no limite POR ARQUIVO e a
    // quantidade cabe no que o parser aceita, mas a soma (27 MB) ultrapassa o
    // teto do corpo. Um arquivo único e grande não serviria — ele seria cortado
    // antes, pelo limite por arquivo, e o contador nunca entraria em cena.
    const aplicacao = appComUpload();
    const conteudo = jpeg(4.5 * 1024 * 1024);
    const envio = request(aplicacao)
      .post('/animais')
      .set('Content-Type', `multipart/form-data; boundary=${FRONTEIRA}`);

    // `write` do superagent NÃO define `Content-Length`: a requisição sai em
    // `chunked`, que é exatamente o caso que se quer medir.
    for (let indice = 0; indice < MAX_IMAGES_PER_ANIMAL + 1; indice += 1) {
      envio.write(
        Buffer.from(
          `--${FRONTEIRA}\r\n` +
            `Content-Disposition: form-data; name="images"; filename="foto-${String(indice)}.jpg"\r\n` +
            'Content-Type: image/jpeg\r\n\r\n',
          'ascii',
        ),
      );
      envio.write(conteudo);
      envio.write(Buffer.from('\r\n', 'ascii'));
    }

    // Act — o servidor responde e encerra a conexão enquanto o cliente ainda
    // escreve; o erro de escrita do socket não é o assunto deste teste.
    const resposta = await envio.catch((motivo: unknown) => respostaDoErro(motivo));

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

  it('RN-51: corpo declarado acima do teto em envelope quebrado responde 415, e não 500', async () => {
    // Arrange — `Content-Length` acima do teto E envelope sem `boundary`. O
    // busboy lança no construtor, o middleware responde antes de haver qualquer
    // ouvinte de `error` na requisição, e a recusa por tamanho não tem em quem
    // emitir. É o ramo que existe para que esse encontro não vire um 500.
    const espiaoDeLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const resposta = await request(appComUpload())
      .post('/animais')
      .set('Content-Type', 'multipart/form-data')
      .set('Content-Length', String(MAX_REQUEST_BODY_BYTES + 1))
      .send('x');

    // Assert
    expect(resposta.status).toBe(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect(resposta.body).toEqual(RECUSA_DO_ENVELOPE);
    expect(espiaoDeLog).not.toHaveBeenCalled();
  });
});
