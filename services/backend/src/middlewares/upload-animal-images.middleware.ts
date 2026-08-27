import type { Request, RequestHandler } from 'express';
import multer, { memoryStorage, MulterError } from 'multer';

import { MESSAGES } from '~/domains/animals/animals.messages';
import {
  AnimalImageLimitExceededError,
  AnimalImageTooLargeError,
  MultipartBodyRequiredError,
  RequestBodyTooLargeError,
} from '~/domains/animals/errors/animal-image.errors';
import {
  ANIMAL_IMAGES_FIELD_NAME,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ANIMAL,
  MAX_REQUEST_BODY_BYTES,
  MAX_TEXT_FIELD_BYTES,
} from '~/infra/upload/upload-limits';
import { AppError } from '~/shared/errors/app-error';
import { ValidationError, VALIDATION_ERROR_CODE } from '~/shared/errors/http-errors';

/**
 * Leitura de `multipart/form-data` das rotas de animal (RN-51).
 *
 * MONTADO SO NAS ROTAS QUE ACEITAM ARQUIVO, nunca em `app.use`: o unico leitor de
 * corpo global do projeto continua sendo o `express.json({ limit: '10kb' })`, e o
 * teto de 10 KB continua valendo para todas as demais rotas. Montado
 * globalmente, este middleware mudaria o comportamento de rotas que hoje so
 * aceitam JSON.
 *
 * NENHUMA linha deste arquivo escreve em `res`. TODA falha vinda do corpo
 * enviado — a que o multer nomeia com codigo e a que o parser entrega como
 * `Error` cru — e TRADUZIDA para subclasse de `AppError` e entregue ao `next`;
 * o `error-handler.middleware.ts` continua sendo o unico ponto que monta corpo de
 * resposta de erro. Sem essa traducao, cinco arquivos de 5 MB produziriam
 * exatamente a falha que so aparece em producao: um erro generico, sem `code`,
 * que o frontend nao sabe traduzir.
 *
 * O 500 continua reservado ao que ele deve significar: defeito de programacao
 * nosso. Ver `traduzirFalhaDaLeitura` para onde a linha e tracada.
 */

/**
 * Armazenamento EM MEMORIA, e nao em disco: o conteiner tem sistema de arquivos
 * efemero e o arquivo segue direto para o armazenamento de objetos de qualquer
 * forma. Gravar em `/tmp` so criaria lixo e um caminho de falha a mais.
 *
 * `MAX_IMAGES_PER_ANIMAL + 1` nos dois lugares e DE PROPOSITO: o parser precisa
 * aceitar a sexta imagem para que a REGRA DE NEGOCIO possa recusa-la com
 * `ANIMAL_IMAGE_LIMIT_EXCEEDED` em PT-BR (RN-50). Cortada pelo parser, a recusa
 * chegaria como erro generico do multer e o frontend nao teria `code` para
 * ramificar.
 */
const LIMITE_DE_ARQUIVOS = MAX_IMAGES_PER_ANIMAL + 1;

/**
 * `+ 1` TAMBEM aqui, e por um motivo COMPLETAMENTE diferente do limite de
 * arquivos acima — nao replicar um raciocinio no outro.
 *
 * O `fileSize` do busboy e EXCLUSIVO: ele corta o arquivo assim que o contador
 * ATINGE o valor (`if (fileSize === fileSizeLimit)`), e nao quando o ultrapassa.
 * Configurado com `MAX_IMAGE_SIZE_BYTES` cru, um arquivo de exatamente 5 MB seria
 * recusado — e a spec exige que ele PASSE, recusando so a partir de 5 MB + 1 byte
 * (CT-50). Com `+ 1`, o corte acontece no primeiro byte acima do permitido, que e
 * a leitura correta da RN-32.
 */
const CORTE_DO_PARSER_POR_ARQUIVO = MAX_IMAGE_SIZE_BYTES + 1;

const manipuladorDoMulter: RequestHandler = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: CORTE_DO_PARSER_POR_ARQUIVO,
    files: LIMITE_DE_ARQUIVOS,
    fieldSize: MAX_TEXT_FIELD_BYTES,
  },
}).array(ANIMAL_IMAGES_FIELD_NAME, LIMITE_DE_ARQUIVOS);

function campoNaoPermitido(campo: string | undefined): ValidationError {
  return new ValidationError(MESSAGES.VALIDATION_GUARD, VALIDATION_ERROR_CODE, [
    { field: campo ?? ANIMAL_IMAGES_FIELD_NAME, message: MESSAGES.FIELD_NOT_ALLOWED },
  ]);
}

/**
 * Traducao dos codigos do multer para os erros proprios do dominio.
 *
 * Os tres primeiros sao os casos previstos pela spec. Os demais cobrem o
 * cabecalho multipart hostil que o multer sabe nomear (milhares de partes, nome
 * de campo gigante). O que o multer NAO nomeia — a falha crua do parser — e
 * tratado em `traduzirFalhaDaLeitura`.
 */
function traduzirErroDoMulter(erro: MulterError): Error {
  switch (erro.code) {
    // RN-32 — um arquivo individual passou de 5 MB.
    case 'LIMIT_FILE_SIZE':
      return new AnimalImageTooLargeError();

    // RN-50 — o parser desistiu de ler porque vieram mais arquivos do que a
    // sexta imagem que ele aceita de proposito. Mensagem de NEGOCIO, e nao
    // "Too many files".
    case 'LIMIT_FILE_COUNT':
      return new AnimalImageLimitExceededError();

    // Arquivo em um campo que a rota nao declara (ou alem do permitido no campo
    // declarado): e campo, e nao imagem, o que esta errado.
    case 'LIMIT_UNEXPECTED_FILE':
      return campoNaoPermitido(erro.field);

    // Envelope multipart alem do que a rota le: partes demais, campos demais ou
    // um campo de texto isolado acima do teto.
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_VALUE':
      return new RequestBodyTooLargeError();

    // Nome de campo malformado (longo demais, aninhado demais ou ausente): o
    // campo nao existe no contrato desta rota.
    default:
      return campoNaoPermitido(erro.field);
  }
}

/**
 * Erros nativos que NAO vem do corpo enviado: eles so aparecem por defeito de
 * programacao nosso (chamar metodo em `undefined`, buffer alem do maximo,
 * simbolo inexistente). O parser nunca os produz — todo `busboy` e todo `multer`
 * sinalizam falha de leitura com `new Error(...)` cru ou com `MulterError`
 * (`busboy/lib/types/multipart.js`, `busboy/lib/index.js`).
 *
 * Traduzi-los para erro de negocio ESCONDERIA um bug nosso atras de um 415 e
 * ainda diria ao cliente que a culpa e do envio dele. Eles seguem para o ramo
 * generico do error handler, que e onde um defeito nosso deve mesmo aparecer: 500
 * com a stack no log do servidor.
 */
const DEFEITOS_DE_PROGRAMACAO = [TypeError, RangeError, ReferenceError, SyntaxError];

function ehDefeitoDeProgramacao(erro: unknown): boolean {
  return DEFEITOS_DE_PROGRAMACAO.some((tipo) => erro instanceof tipo);
}

/**
 * ULTIMO filtro antes do `next`: e ele que sustenta a promessa da RN-51 de que
 * nenhuma falha de leitura chega ao frontend como erro generico sem `code`.
 *
 * O multer entrega tres coisas diferentes por este mesmo callback:
 *
 *   1. o `AppError` que ESTE arquivo emitiu na requisicao (o 413 do contador de
 *      bytes), que volta ja traduzido e nao pode ser reescrito;
 *   2. o `MulterError`, com codigo proprio, que a funcao acima traduz;
 *   3. o `Error` CRU do parser, que era o buraco: `boundary` ausente
 *      (`multer/lib/make-middleware.js:139-141`, o construtor do Busboy lancando
 *      "Multipart: Boundary not found"), corpo truncado ("Unexpected end of
 *      form"), cabecalho de parte malformado e requisicao abortada no meio, todos
 *      chegando por `busboy.on('error')`. Sem esta traducao cada um deles virava
 *      500 `INTERNAL_ERROR` — sem `code` para o frontend ramificar e com um
 *      `console.error` por requisicao, que e ruido de log de graca para quem
 *      quiser produzi-lo em massa.
 *
 * O caso (3) e sempre a MESMA regra violada: o que chegou nao e um envelope
 * `multipart/form-data` legivel. Um `code` novo por variacao do parser diria ao
 * frontend algo que ele nao pode acionar, entao todas elas caem no erro que ja
 * nomeia essa regra.
 */
function traduzirFalhaDaLeitura(erro: unknown): unknown {
  if (erro instanceof AppError) {
    return erro;
  }

  if (erro instanceof MulterError) {
    return traduzirErroDoMulter(erro);
  }

  if (ehDefeitoDeProgramacao(erro)) {
    return erro;
  }

  return new MultipartBodyRequiredError();
}

/**
 * Entrega a recusa por tamanho PELO CAMINHO DE ERRO DO MULTER, e nao respondendo
 * de imediato.
 *
 * O multer, ao receber `error` na requisicao, DRENA o corpo restante antes de
 * chamar o `next` (e o que o proprio codigo dele documenta como defesa contra
 * EPIPE). Sem esse drenar, o servidor responderia 413 com o cliente ainda no meio
 * do envio de 27 MB, a conexao seria reiniciada e o administrador veria erro de
 * rede em vez da mensagem de negocio em PT-BR — exatamente o que a RN-51 existe
 * para impedir. Drenar descarta os bytes, nao os acumula: nada disso vira memoria.
 *
 * A guarda de `listenerCount` cobre o unico caso em que o multer devolve o
 * controle sem registrar o ouvinte (requisicao sem corpo): ali nao ha o que
 * drenar e nem ha erro a emitir.
 */
function recusarPorTamanho(requisicao: Request): void {
  if (requisicao.listenerCount('error') === 0) {
    return;
  }

  requisicao.emit('error', new RequestBodyTooLargeError());
}

/**
 * Contador de bytes do corpo, montado no MESMO tique em que o multer chama
 * `req.pipe(busboy)` — logo nenhum pedaco e perdido, porque `on('data')` so faz o
 * fluxo comecar no proximo tique.
 *
 * Existe porque o `Content-Length` cobre todo cliente real (o navegador sempre o
 * calcula para `FormData`), mas um envio em `Transfer-Encoding: chunked` chega sem
 * ele. Este contador e a rede de seguranca desse caso.
 */
function contarBytesDoCorpo(requisicao: Request): () => void {
  let lidos = 0;

  const contar = (pedaco: Buffer): void => {
    lidos += pedaco.length;

    if (lidos > MAX_REQUEST_BODY_BYTES) {
      requisicao.off('data', contar);
      recusarPorTamanho(requisicao);
    }
  };

  requisicao.on('data', contar);

  return (): void => {
    requisicao.off('data', contar);
  };
}

function corpoDeclaradoAcimaDoTeto(requisicao: Request): boolean {
  const declarado = Number(requisicao.headers['content-length']);

  return Number.isFinite(declarado) && declarado > MAX_REQUEST_BODY_BYTES;
}

const SEM_CONTADOR = (): void => undefined;

export const uploadAnimalImages: RequestHandler = (requisicao, resposta, proximo) => {
  /**
   * O multer chama `next()` em silencio quando o tipo de conteudo nao e
   * multipart — a rota receberia `req.body` vazio e recusaria por campo
   * obrigatorio ausente, escondendo o erro real de quem chama a API fora da
   * interface (RN-33). A recusa explicita e 415.
   */
  if (typeof requisicao.is('multipart/form-data') !== 'string') {
    proximo(new MultipartBodyRequiredError());
    return;
  }

  /**
   * RN-51 — decidido pelo `Content-Length`, ANTES de um unico byte do corpo ser
   * lido; o contador por byte fica so para o envio que chega sem esse cabecalho.
   * Manter os dois ligados faria o contador reprocessar uma recusa ja decidida.
   */
  const excedeODeclarado = corpoDeclaradoAcimaDoTeto(requisicao);
  const pararDeContar = excedeODeclarado ? SEM_CONTADOR : contarBytesDoCorpo(requisicao);

  manipuladorDoMulter(requisicao, resposta, (erro?: unknown) => {
    pararDeContar();

    if (erro === undefined || erro === null) {
      proximo();
      return;
    }

    proximo(traduzirFalhaDaLeitura(erro));
  });

  if (excedeODeclarado) {
    recusarPorTamanho(requisicao);
  }
};
