import {
  appendFiles,
  canAcceptFiles,
  itemKey,
  keepImageIdsOf,
  MAX_IMAGES,
  removeItem,
  remainingSlots,
  stagedFilesOf,
  type AnimalImageItem,
  type StagedFactory,
} from '~/domains/animals/animal-images';

/**
 * A ARITMETICA DO LIMITE, sem React e sem DOM.
 *
 * Testar isto aqui, e nao so pela tela, e o que impede que uma correcao futura no
 * componente reintroduza o erro que a propria spec ja teve de corrigir na
 * iteracao de qualidade: o limite vale sobre o ESTADO FINAL, e nao sobre o que ja
 * estava gravado nem sobre o que foi escolhido.
 */

let contador = 0;

/** Fabrica determinista: o teste precisa saber que URL foi criada para cada item. */
const FABRICA: StagedFactory = {
  createLocalId: () => `local-${String((contador += 1))}`,
  createPreviewUrl: () => `blob:preview-${String(contador)}`,
};

beforeEach(() => {
  contador = 0;
});

function arquivo(nome: string, bytes = 100, tipo = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

function gravadas(quantidade: number): ReadonlyArray<AnimalImageItem> {
  return Array.from({ length: quantidade }, (_, i) => ({
    kind: 'stored' as const,
    id: `img-${String(i)}`,
    url: `https://exemplo/${String(i)}.jpg`,
  }));
}

describe('remainingSlots e canAcceptFiles', () => {
  it('lista vazia é estado válido e aceita as cinco (RN-30)', () => {
    expect(remainingSlots([])).toBe(MAX_IMAGES);
    expect(canAcceptFiles([], 5)).toBe(true);
  });

  it('nunca devolve número negativo', () => {
    // Defensivo: uma lista acima do teto só existiria por defeito, e um valor
    // negativo aqui viraria "ainda cabem -1" na mensagem ao usuário.
    expect(remainingSlots(gravadas(7))).toBe(0);
  });
});

describe('appendFiles — o limite vale sobre o ESTADO FINAL (RN-50)', () => {
  it('CT-46: exatamente cinco é aceito', () => {
    // Arrange & Act
    const resultado = appendFiles(
      [],
      [arquivo('1.jpg'), arquivo('2.jpg'), arquivo('3.jpg'), arquivo('4.jpg'), arquivo('5.jpg')],
      FABRICA,
    );

    // Assert
    expect(resultado.items).toHaveLength(5);
    expect(resultado.limitError).toBeUndefined();
  });

  it('CT-47: seis é recusado', () => {
    // Arrange & Act
    const seis = Array.from({ length: 6 }, (_, i) => arquivo(`${String(i)}.jpg`));
    const resultado = appendFiles([], seis, FABRICA);

    // Assert — o LOTE inteiro é recusado, e nenhum arquivo entra pela metade.
    expect(resultado.items).toHaveLength(0);
    expect(resultado.limitError).toBe('Você já tem 0 imagens; ainda cabem 5.');
  });

  it('CT-48: 3 gravadas + 3 novas recusa o lote inteiro e informa quantas cabem', () => {
    // Arrange
    const atuais = gravadas(3);

    // Act
    const resultado = appendFiles(
      atuais,
      [arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg')],
      FABRICA,
    );

    // Assert — o ponto do caso: NENHUM dos três entra. Aceitar os dois primeiros
    // deixaria o administrador com metade do que escolheu e sem explicação
    // coerente.
    expect(resultado.items).toBe(atuais);
    expect(resultado.limitError).toBe('Você já tem 3 imagens; ainda cabem 2.');
  });

  it('CT-49a: 5 gravadas, remover 2 e escolher 3 continua recusando', () => {
    // Arrange
    let itens = gravadas(5);

    itens = removeItem(itens, 'img-0');
    itens = removeItem(itens, 'img-1');

    // Act
    const resultado = appendFiles(
      itens,
      [arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg')],
      FABRICA,
    );

    // Assert — 3 + 3 = 6.
    expect(resultado.items).toHaveLength(3);
    expect(resultado.limitError).toBe('Você já tem 3 imagens; ainda cabem 2.');
  });

  it('CT-49b: 5 gravadas, remover 3 e escolher 3 é aceito', () => {
    // Arrange
    let itens = gravadas(5);

    itens = removeItem(itens, 'img-0');
    itens = removeItem(itens, 'img-1');
    itens = removeItem(itens, 'img-2');

    // Act
    const resultado = appendFiles(
      itens,
      [arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg')],
      FABRICA,
    );

    // Assert — 2 + 3 = 5.
    expect(resultado.items).toHaveLength(5);
    expect(resultado.limitError).toBeUndefined();
  });

  it('a mensagem concorda no singular quando resta exatamente uma vaga', () => {
    const resultado = appendFiles(gravadas(4), [arquivo('a.jpg'), arquivo('b.jpg')], FABRICA);

    expect(resultado.limitError).toBe('Você já tem 4 imagens; ainda cabe 1.');
  });

  it('com o limite cheio, a mensagem não diz "cabem 0"', () => {
    const resultado = appendFiles(gravadas(5), [arquivo('a.jpg')], FABRICA);

    expect(resultado.limitError).toBe('Você já tem 5 imagens; não cabe mais nenhuma.');
  });
});

describe('appendFiles — triagem local de tipo e tamanho', () => {
  it('recusa o tipo não aceito PELO NOME, sem barrar os demais', () => {
    // Arrange & Act — o `accept` do input filtra isto no navegador, mas é apenas
    // uma dica: o usuário pode escolher "todos os arquivos" no seletor do sistema.
    const resultado = appendFiles(
      [],
      [arquivo('boa.jpg'), arquivo('doc.pdf', 100, 'application/pdf')],
      FABRICA,
    );

    // Assert
    expect(resultado.items).toHaveLength(1);
    expect(resultado.rejected).toEqual([
      { fileName: 'doc.pdf', reason: 'formato não aceito — envie JPEG ou PNG' },
    ]);
  });

  it('recusa acima de 5 MB e aceita exatamente 5 MB', () => {
    // Arrange
    const cincoMegas = 5 * 1024 * 1024;

    // Act
    const resultado = appendFiles(
      [],
      [arquivo('limite.jpg', cincoMegas), arquivo('grande.jpg', cincoMegas + 1)],
      FABRICA,
    );

    // Assert — o limite é inclusivo, como no servidor (CT-50).
    expect(resultado.items).toHaveLength(1);
    expect(resultado.rejected).toEqual([{ fileName: 'grande.jpg', reason: 'maior que 5 MB' }]);
  });

  it('recusa o arquivo de 0 byte', () => {
    const resultado = appendFiles([], [arquivo('vazio.jpg', 0)], FABRICA);

    expect(resultado.items).toHaveLength(0);
    expect(resultado.rejected).toEqual([{ fileName: 'vazio.jpg', reason: 'arquivo vazio' }]);
  });

  it('escolha vazia não altera a lista nem produz recusa', () => {
    const atuais = gravadas(2);
    const resultado = appendFiles(atuais, [], FABRICA);

    expect(resultado.items).toBe(atuais);
    expect(resultado.rejected).toEqual([]);
  });
});

describe('removeItem — a capa acompanha (RN-35, CT-60, CA-26)', () => {
  it('removido o item da posição 0, o seguinte passa a ocupá-la', () => {
    // Arrange
    const itens = gravadas(3);

    // Act
    const restantes = removeItem(itens, 'img-0');

    // Assert
    expect(restantes.map(itemKey)).toEqual(['img-1', 'img-2']);
  });

  it('preserva a ordem dos demais ao remover do meio', () => {
    expect(removeItem(gravadas(3), 'img-1').map(itemKey)).toEqual(['img-0', 'img-2']);
  });

  it('chave inexistente não altera a lista', () => {
    expect(removeItem(gravadas(2), 'nao-existe').map(itemKey)).toEqual(['img-0', 'img-1']);
  });
});

describe('derivação do envio', () => {
  it('keepImageIds sai na ORDEM da lista, só com as gravadas', () => {
    // Arrange
    const misto = appendFiles(gravadas(2), [arquivo('nova.jpg')], FABRICA).items;

    // Act & Assert — é esta ordem que o backend usa para reposicionar (RN-35).
    expect(keepImageIdsOf(misto)).toEqual(['img-0', 'img-1']);
  });

  it('stagedFiles sai na ORDEM da lista, só com as em preparo', () => {
    // Arrange
    const misto = appendFiles(gravadas(1), [arquivo('a.jpg'), arquivo('b.jpg')], FABRICA).items;

    // Act & Assert
    expect(stagedFilesOf(misto).map((file) => file.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('lista só de gravadas produz nenhum arquivo a enviar', () => {
    expect(stagedFilesOf(gravadas(3))).toEqual([]);
  });
});
