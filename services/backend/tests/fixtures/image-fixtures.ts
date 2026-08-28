/**
 * Arquivos de teste da feature de animais (TASK-BACKEND-011).
 *
 * Os buffers sao CONSTRUIDOS EM CODIGO a partir dos bytes de assinatura de cada
 * formato, e nao commitados como binarios. Um JPEG de 5 MB gerado por
 * preenchimento custa milissegundos; dez arquivos de megabytes no repositorio
 * encareceriam todo clone para sempre, e ninguem conseguiria revisar o diff de um
 * binario.
 *
 * Cada assinatura e a REAL do formato — e ela que a `detectImageMimeType` le, e um
 * byte trocado aqui transformaria o teste do SVG (RN-34) num teste de nada.
 */

/** `FF D8 FF E0` + `JFIF`: cabecalho JFIF, o JPEG que uma camera produz. */
const ASSINATURA_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00,
]);

/** Marcador de fim de imagem, para que o arquivo seja um JPEG completo. */
const FIM_DO_JPEG = Buffer.from([0xff, 0xd9]);

/** Assinatura de oito bytes do PNG seguida do bloco `IHDR`. */
const ASSINATURA_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
  0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
  0x15, 0xc4, 0x89,
]);

function comTamanho(
  assinatura: Buffer,
  rodape: Buffer,
  tamanhoEmBytes: number,
): Buffer {
  const minimo = assinatura.length + rodape.length;

  if (tamanhoEmBytes < minimo) {
    throw new RangeError(
      `Fixture de imagem: ${String(tamanhoEmBytes)} bytes nao cabem a assinatura ` +
        `(${String(minimo)} bytes no minimo).`,
    );
  }

  const conteudo = Buffer.alloc(tamanhoEmBytes, 0x00);

  assinatura.copy(conteudo, 0);
  rodape.copy(conteudo, tamanhoEmBytes - rodape.length);

  return conteudo;
}

const TAMANHO_PADRAO = 1024;

/** JPEG valido, do tamanho exato pedido. */
export function jpegBuffer(tamanhoEmBytes: number = TAMANHO_PADRAO): Buffer {
  return comTamanho(ASSINATURA_JPEG, FIM_DO_JPEG, tamanhoEmBytes);
}

/** PNG valido, do tamanho exato pedido. */
export function pngBuffer(tamanhoEmBytes: number = TAMANHO_PADRAO): Buffer {
  return comTamanho(ASSINATURA_PNG, Buffer.alloc(0), tamanhoEmBytes);
}

/** GIF89a — imagem de verdade, formato NAO aceito (CT-52). */
export function gifBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from('GIF89a', 'ascii'),
    Buffer.from([0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00]),
  ]);
}

/** Documento PDF (CT-52). */
export function pdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'ascii');
}

/**
 * SVG com script embutido (CT-53 / RN-34).
 *
 * E o arquivo mais importante do conjunto: SVG e imagem para o navegador, e
 * servido de um balde de leitura publica ele EXECUTA o script de quem o abrir. A
 * recusa dele nao pode depender de extensao nem de `mimetype` declarado.
 */
export function svgBuffer(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">' +
      '<script>alert(document.cookie)</script></svg>',
    'utf-8',
  );
}

/** Executavel ELF de Linux: `7F 45 4C 46` (CT-52). */
export function elfBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
    Buffer.alloc(56, 0x00),
  ]);
}

/** Arquivo de 0 byte (CT-51). */
export function emptyBuffer(): Buffer {
  return Buffer.alloc(0);
}

/**
 * Nomes de arquivo HOSTIS (CT-57 / RN-36).
 *
 * Nenhum deles pode influenciar o caminho do objeto: a aplicacao gera o caminho a
 * partir do identificador do animal e do identificador da imagem, e o nome
 * enviado nao e parametro dessa funcao.
 */
export const NOMES_HOSTIS = {
  travessia: '../../../etc/passwd.jpg',
  emoji: 'foto-do-theo-\u{1F436}\u{1F408}.jpg',
  longo: `${'a'.repeat(300)}.jpg`,
} as const;
