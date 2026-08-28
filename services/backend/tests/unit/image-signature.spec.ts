import { fromBuffer, type FileTypeResult } from 'file-type';

/**
 * O `file-type` e substituido por um duble que, POR PADRAO, delega ao modulo real:
 * todos os casos deste arquivo continuam medindo a deteccao de verdade. So os dois
 * ultimos trocam a resposta, e so por uma chamada (`mockImplementationOnce`).
 *
 * E `jest.mock` e nao `jest.spyOn` porque `file-type` exporta `fromBuffer` como
 * propriedade NAO configuravel — `spyOn` falha com "Cannot redefine property".
 */
jest.mock('file-type', () => {
  const real = jest.requireActual<typeof import('file-type')>('file-type');

  return {
    ...real,
    fromBuffer: jest.fn(async (buffer: Buffer) => real.fromBuffer(buffer)),
  };
});

import { detectImageMimeType } from '~/infra/upload/image-signature';

import {
  elfBuffer,
  emptyBuffer,
  gifBuffer,
  jpegBuffer,
  pdfBuffer,
  pngBuffer,
  svgBuffer,
} from '../fixtures/image-fixtures';

/**
 * Assinatura binaria dos arquivos aceitos (RN-34 / RN-53).
 *
 * Este modulo e o unico ponto do produto que decide se um arquivo e imagem, e a
 * decisao e SEMPRE do conteudo: nem a extensao do arquivo nem o `mimetype`
 * declarado pelo cliente sao parametros desta funcao — nao ha como um deles
 * influenciar a resposta, e e por isso que renomear um SVG para `.jpg` nao
 * adianta.
 *
 * A prova vale nos DOIS sentidos, e o caso de sentido inverso e tao importante
 * quanto os de recusa: um JPEG chamado `.txt` continua sendo aceito.
 */

interface CasoDeRecusa {
  readonly formato: string;
  readonly conteudo: Buffer;
  readonly porQue: string;
}

const RECUSADOS: ReadonlyArray<CasoDeRecusa> = [
  {
    formato: 'GIF',
    conteudo: gifBuffer(),
    porQue: 'e imagem, mas nao esta entre os dois formatos aceitos',
  },
  {
    formato: 'PDF',
    conteudo: pdfBuffer(),
    porQue: 'e documento',
  },
  {
    formato: 'executavel ELF',
    conteudo: elfBuffer(),
    porQue: 'e binario executavel',
  },
  {
    formato: 'SVG',
    conteudo: svgBuffer(),
    porQue: 'executaria script no navegador de quem abrisse a URL publica',
  },
];

describe('detectImageMimeType', () => {
  it.each(RECUSADOS)(
    'CT-52 / CT-53: $formato renomeado para `.jpg` e declarado `image/jpeg` devolve `null` — $porQue',
    async ({ conteudo }: CasoDeRecusa) => {
      // Arrange — o nome do arquivo e o `mimetype` declarado NAO chegam ate aqui:
      // a assinatura da funcao recebe apenas os bytes. Essa e a garantia.

      // Act
      const detectado = await detectImageMimeType(conteudo);

      // Assert
      expect(detectado).toBeNull();
    },
  );

  it('CT-53: o SVG com script embutido e recusado pela ASSINATURA, antes de qualquer biblioteca', async () => {
    // Arrange — o `<svg` inicial nao bate com `FF D8 FF` nem com a assinatura do
    // PNG, entao a funcao devolve `null` sem sequer consultar o `file-type`.
    const conteudo = svgBuffer();

    // Act
    const detectado = await detectImageMimeType(conteudo);

    // Assert
    expect(detectado).toBeNull();
    expect(conteudo.toString('utf-8')).toContain('<script>');
  });

  it('CT-51: arquivo de 0 byte devolve `null` sem consultar a assinatura', async () => {
    // Arrange & Act
    const detectado = await detectImageMimeType(emptyBuffer());

    // Assert
    expect(detectado).toBeNull();
  });

  it('aceita JPEG pelo conteudo, mesmo com nome `.txt` e `mimetype` declarado `text/plain`', async () => {
    // Arrange — o caso INVERSO: prova que a decisao e do conteudo nos dois
    // sentidos, e nao uma recusa generica de tudo o que parece suspeito.

    // Act
    const detectado = await detectImageMimeType(jpegBuffer());

    // Assert
    expect(detectado).toBe('image/jpeg');
  });

  it('aceita PNG pelo conteudo', async () => {
    // Arrange & Act
    const detectado = await detectImageMimeType(pngBuffer());

    // Assert
    expect(detectado).toBe('image/png');
  });

  const DETECCOES_INSUFICIENTES: ReadonlyArray<{
    readonly cenario: string;
    readonly devolvido: FileTypeResult | undefined;
  }> = [
    { cenario: 'nao reconhece o conteudo', devolvido: undefined },
    { cenario: 'reconhece outro formato', devolvido: { ext: 'gif', mime: 'image/gif' } },
  ];

  it.each(DETECCOES_INSUFICIENTES)(
    'recusa quando a assinatura passa mas o detector $cenario',
    async ({ devolvido }: { readonly devolvido: FileTypeResult | undefined }) => {
      // Arrange — SEGUNDO portao. A guarda barata de tres bytes deixa passar
      // qualquer arquivo que COMECE como JPEG; e o detector completo que decide
      // depois. Sem este caso o `||` da linha de recusa nunca e exercitado, e um
      // dia alguem o remove por parecer inalcancavel.
      jest.mocked(fromBuffer).mockImplementationOnce(async () => devolvido);

      // Act
      const detectado = await detectImageMimeType(jpegBuffer());

      // Assert
      expect(detectado).toBeNull();
    },
  );
});
