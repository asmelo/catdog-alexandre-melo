import { MESSAGES } from '~/domains/animals/animals.messages';
import {
  PayloadTooLargeError,
  ServiceUnavailableError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '~/shared/errors/http-errors';

/**
 * Erros de dominio da entrada de imagens de animal. Como em
 * `species.errors.ts`, cada classe nomeia a REGRA violada e nao o status HTTP —
 * e o nome que aparece na stack e no log.
 *
 * Construtores sem parametro de proposito: mensagem e `code` sao contrato fixo do
 * criterio de aceite, e permitir sobrescreve-los no ponto de lancamento abriria
 * caminho para duas mensagens diferentes para a mesma regra.
 *
 * NENHUMA delas escreve em `res`: o `error-handler.middleware.ts` continua sendo
 * o unico ponto autorizado a montar corpo de resposta de erro.
 */

/**
 * RN-32 — arquivo individual acima de 5 MB. 413 e nao 400: o pedido esta bem
 * formado, o que o impede e o tamanho da entidade enviada.
 */
export class AnimalImageTooLargeError extends PayloadTooLargeError {
  constructor() {
    super(MESSAGES.ANIMAL_IMAGE_TOO_LARGE, 'ANIMAL_IMAGE_TOO_LARGE');
  }
}

/**
 * RN-51 — corpo INTEIRO acima do teto proprio das rotas de escrita de animal.
 *
 * Distinto do anterior de proposito: cinco arquivos individualmente validos podem
 * somar mais do que o envelope permite, e a mensagem precisa dizer ao
 * administrador o que fazer ("envie menos imagens ou imagens menores"), coisa que
 * "cada imagem deve ter no maximo 5 MB" nao diria.
 */
export class RequestBodyTooLargeError extends PayloadTooLargeError {
  constructor() {
    super(MESSAGES.REQUEST_BODY_TOO_LARGE, 'REQUEST_BODY_TOO_LARGE');
  }
}

/**
 * RN-31 / RN-34 / RN-53 — conteudo real do arquivo nao e JPEG nem PNG. Lancado a
 * partir do resultado de `detectImageMimeType`, jamais a partir da extensao do
 * nome ou do `mimetype` declarado.
 */
export class AnimalImageTypeNotAllowedError extends UnsupportedMediaTypeError {
  constructor() {
    super(MESSAGES.ANIMAL_IMAGE_TYPE_NOT_ALLOWED, 'ANIMAL_IMAGE_TYPE_NOT_ALLOWED');
  }
}

/**
 * RN-33 / RN-51 — a rota nao recebeu um envelope `multipart/form-data` LEGIVEL.
 *
 * Cobre os dois lados da mesma regra: o `Content-Type` que anuncia outro formato
 * e o corpo que anuncia multipart mas nao pode ser lido como tal (`boundary`
 * ausente, corpo truncado, cabecalho de parte malformado). A causa e uma so — o
 * envelope, e nao o arquivo nem um campo — entao o `code` e a mensagem sao um so,
 * e o remedio que a mensagem indica serve aos dois.
 *
 * 415 e nao 400 pela mesma leitura que ja sustenta `AnimalImageTypeNotAllowedError`:
 * a RFC 9110 admite o 415 decidido por INSPECAO DIRETA do conteudo, e nao ha campo
 * a corrigir — o que nao serve e o formato do envio inteiro.
 */
export class MultipartBodyRequiredError extends UnsupportedMediaTypeError {
  constructor() {
    super(MESSAGES.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE');
  }
}

/**
 * RN-50 — mais de cinco imagens.
 *
 * 400 e nao 413: o problema e a QUANTIDADE pedida, nao o tamanho do que chegou.
 * Quem decide de verdade e o service, porque o limite vale sobre o ESTADO FINAL
 * do animal (tres gravadas mais tres novas somam seis e sao recusadas; cinco
 * gravadas das quais tres saem, mais tres novas, voltam a cinco e sao aceitas) e
 * o middleware nao conhece o animal. O middleware so lanca este erro no extremo
 * em que o proprio parser desiste de ler — e faz isso com a mensagem de NEGOCIO,
 * para o frontend nunca receber um erro generico sem `code` para ramificar.
 */
export class AnimalImageLimitExceededError extends ValidationError {
  constructor() {
    super(MESSAGES.ANIMAL_IMAGE_LIMIT_EXCEEDED, 'ANIMAL_IMAGE_LIMIT_EXCEEDED');
  }
}

/**
 * RN-39 — o armazenamento de objetos nao aceitou a gravacao (ou a remocao).
 *
 * Vive AQUI, com os demais erros de imagem, e nao no arquivo da porta: e assim
 * que o texto continua morando em `animals.messages.ts` e que o frontend continua
 * ramificando por `code`. A porta e os seus adaptadores importam esta classe;
 * o caminho inverso nao existe.
 *
 * ESTA CLASSE E A FRONTEIRA DO FORNECEDOR. O `StorageError` do Supabase, o seu
 * `statusCode` e a sua mensagem em ingles morrem no adaptador: nada disso entra
 * no construtor, porque nao ha parametro para isso. E o que mantem o dominio
 * ignorante de qual servico guarda os arquivos — trocar o Supabase por outro
 * fornecedor nao muda uma linha fora de `src/infra/storage/`.
 *
 * 503 e nao 500: o pedido do administrador estava correto e a aplicacao esta de
 * pe. Quem chama decide o efeito — na gravacao a alteracao e desfeita por inteiro
 * (RN-39), na remocao a operacao NAO e revertida (RN-40).
 */
export class ImageStorageUnavailableError extends ServiceUnavailableError {
  constructor() {
    super(MESSAGES.IMAGE_STORAGE_UNAVAILABLE, 'IMAGE_STORAGE_UNAVAILABLE');
  }
}
