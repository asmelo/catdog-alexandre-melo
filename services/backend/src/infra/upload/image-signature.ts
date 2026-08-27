import { fromBuffer } from 'file-type';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
} from '~/infra/upload/upload-limits';

/**
 * RN-34 — apuracao do formato real da imagem pelos BYTES do arquivo.
 *
 * A extensao do nome e o `mimetype` declarado na parte multipart sao escritos por
 * quem envia e NAO entram na decisao em hipotese nenhuma. Um JPEG chamado
 * `foto.txt` e declarado `text/plain` e aceito; um SVG chamado `foto.jpg` e
 * declarado `image/jpeg` e recusado. A regra vale nos dois sentidos.
 *
 * RN-53 — o caso concreto a barrar e o SVG. Ele nao tem assinatura binaria (e
 * XML), portanto `detectImageMimeType` devolve `null` para ele, e esse `null` e o
 * comportamento CORRETO e desejado: um SVG aceito e servido a partir de um balde
 * de leitura publica executaria script no navegador de quem abrisse a imagem.
 * SVG nao deve ser acrescentado a nenhuma lista de "formatos que o navegador
 * exibe" — e exatamente o que esta regra existe para impedir.
 */

/** `FF D8 FF` — SOI seguido do inicio do proximo marcador. Todo JPEG comeca assim. */
const ASSINATURA_JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/** Os 8 bytes fixos de assinatura do PNG, incluindo o par CR LF anti-corrupcao. */
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * O `file-type` so decide dentro dos primeiros bytes; enviar o arquivo inteiro
 * (ate 5 MB) so faria o parser copiar dado que ele nao usa.
 */
const BYTES_DE_CABECALHO = 4100;

/**
 * Pre-filtro pelas duas unicas assinaturas que a aplicacao aceita.
 *
 * Existe por DOIS motivos, e nao um:
 *
 * 1. Nenhum arquivo que nao seja JPEG nem PNG chega aos parsers do `file-type`.
 *    A linha 16.x — a ultima CommonJS da biblioteca — carrega o aviso
 *    GHSA-5v7r-6r5c-r473: laco infinito no parser de ASF diante de um
 *    sub-cabecalho de tamanho zero (`file-type/core.js`, `header.size = 0` faz
 *    `tokenizer.ignore()` devolver a posicao e o `while` nunca avancar). Com o
 *    pre-filtro, um ASF malformado nunca alcanca esse parser.
 *
 *    O que PRENDE o projeto nesta versao e o FORMATO DE MODULO, e nao o `engines`
 *    nem a falta de correcao a montante — registrar isso errado faria a proxima
 *    revisao reabrir a discussao pela porta errada. Os fatos: `22.x` exige
 *    `node >= 22` e de fato nao serve ao `>=20 <21` daqui, mas `21.3.1`+ ja esta
 *    FORA da faixa do aviso (`>=13.0.0 <21.3.1`) e declara `node >= 20`,
 *    perfeitamente compativel. O que barra a `21.3.x` e ser ESM puro: o pacote
 *    nao tem `main` e so expoe `exports.import`, que o resolver CommonJS do Jest
 *    nao enxerga, e o `tsc` com `module: commonjs` ainda rebaixa
 *    `await import(x)` para `require(x)` — ou seja, nem o atalho do import
 *    dinamico escapa. A saida definitiva e o backend migrar para ESM, e nao subir
 *    de versao: no dia em que isso acontecer, `file-type@21.3.x` resolve o aviso
 *    sem tocar em mais nada aqui.
 * 2. A decisao final continua sendo do `file-type`: o arquivo precisa passar
 *    pelos DOIS testes. O pre-filtro so estreita a entrada, nunca alarga — ele
 *    nao aceita nada que o `file-type` recusaria.
 */
function temAssinaturaDeFormatoAceito(cabecalho: Buffer): boolean {
  return (
    cabecalho.subarray(0, ASSINATURA_JPEG.length).equals(ASSINATURA_JPEG) ||
    cabecalho.subarray(0, ASSINATURA_PNG.length).equals(ASSINATURA_PNG)
  );
}

function ehFormatoAceito(mime: string): mime is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(mime);
}

/**
 * Devolve o tipo real da imagem ou `null` para qualquer outra coisa.
 *
 * Buffer vazio (0 byte) tambem devolve `null`. Quem chama distingue os dois casos
 * pelo TAMANHO do arquivo, e nao pelo retorno daqui: arquivo de 0 byte produz
 * "O arquivo enviado esta vazio." (RN-54) e arquivo com conteudo de formato nao
 * aceito produz "Apenas imagens JPEG ou PNG sao aceitas." (RN-31). Fundir os dois
 * numa unica mensagem faria o administrador procurar problema de formato num
 * arquivo que na verdade nao subiu.
 */
export async function detectImageMimeType(
  buffer: Buffer,
): Promise<AllowedImageMimeType | null> {
  if (buffer.length === 0) {
    return null;
  }

  const cabecalho = buffer.subarray(0, BYTES_DE_CABECALHO);

  if (!temAssinaturaDeFormatoAceito(cabecalho)) {
    return null;
  }

  const detectado = await fromBuffer(cabecalho);

  if (detectado === undefined || !ehFormatoAceito(detectado.mime)) {
    return null;
  }

  return detectado.mime;
}
