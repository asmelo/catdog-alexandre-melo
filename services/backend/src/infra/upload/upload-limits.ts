/**
 * Ponto UNICO de verdade dos limites de envio de imagem (RN-30, RN-31, RN-32,
 * RN-51).
 *
 * Os tres consumidores previstos leem daqui e nao de literais proprios: o
 * middleware de leitura de multipart, os services de cadastro e de edicao de
 * animal (que aplicam o limite sobre o ESTADO FINAL, coisa que o middleware nao
 * tem como fazer) e os testes. Cada copia local de `5` ou de `5242880` seria uma
 * chance a mais de o servidor e a interface discordarem sobre o mesmo limite.
 */

const BYTES_POR_MEGABYTE = 1024 * 1024;

/** RN-30 — de zero a cinco imagens por animal, contadas sobre o estado final. */
export const MAX_IMAGES_PER_ANIMAL = 5;

/** RN-32 — teto por arquivo. Exatamente 5 MB passa; 5 MB + 1 byte nao. */
export const MAX_IMAGE_SIZE_BYTES = 5 * BYTES_POR_MEGABYTE;

/**
 * Folga do envelope multipart sobre a soma dos arquivos: as fronteiras de cada
 * parte, os cabecalhos de cada parte e os campos de texto do formulario
 * (`description` com ate 1000 caracteres, `keepImageIds` com ate cinco UUID).
 * Um megabyte e ordens de grandeza acima do necessario e continua muito abaixo
 * do proximo arquivo inteiro.
 */
const MULTIPART_ENVELOPE_BYTES = 1 * BYTES_POR_MEGABYTE;

/**
 * RN-51 — teto do corpo INTEIRO das rotas de escrita de animal.
 *
 * Derivado, e nao a constante magica `27262976`: quem mudar o numero de imagens
 * ou o tamanho por imagem nao precisa lembrar de recalcular este valor. O
 * dimensionamento e deliberado — cinco imagens de 5 MB somam 25 MB e PRECISAM
 * passar; o que nao pode passar e o envio que ultrapassa esse envelope, e ele
 * precisa ser recusado com mensagem de negocio em PT-BR, nunca com o erro
 * generico do servidor de borda.
 */
export const MAX_REQUEST_BODY_BYTES =
  MAX_IMAGES_PER_ANIMAL * MAX_IMAGE_SIZE_BYTES + MULTIPART_ENVELOPE_BYTES;

/**
 * Teto por campo de TEXTO do formulario. Nao e o teto do corpo: serve para que
 * um campo isolado nao consuma sozinho o envelope reservado as fronteiras.
 * 16 KB e folgado sobre o maior campo previsto (`description`, 1000 caracteres,
 * ate 4 KB em UTF-8).
 */
export const MAX_TEXT_FIELD_BYTES = 16 * 1024;

/**
 * RN-31 — os dois unicos formatos aceitos.
 *
 * SVG esta fora DE PROPOSITO e nao deve ser acrescentado: ele nao tem assinatura
 * binaria (e XML), e um SVG aceito e servido a partir de um balde de leitura
 * publica executaria script no navegador de quem abrisse a imagem (RN-53).
 */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Nome do campo de arquivo no formulario multipart, conforme o contrato de API. */
export const ANIMAL_IMAGES_FIELD_NAME = 'images';
