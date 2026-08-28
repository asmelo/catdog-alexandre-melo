import { MESSAGES } from '~/utils/messages';

/**
 * O catalogo de textos tem duas regras que nenhum tipo consegue impor: a
 * concordancia da contagem e a proibicao de duplicar mensagem que o backend ja
 * devolve. As duas ficam aqui.
 */

describe('MESSAGES.ANIMALS.totalLabel — concordância do rodapé (RN-43, CT-24, CA-06)', () => {
  it('zero animais não vira "Total: 0 animais"', () => {
    expect(MESSAGES.ANIMALS.totalLabel(0)).toBe('Nenhum animal cadastrado');
  });

  it('um animal usa o singular', () => {
    // A captura de tela usada como fonte da verdade exibe "Total: 1 animais",
    // defeito de concordância na própria fonte, corrigido por decisão da spec.
    expect(MESSAGES.ANIMALS.totalLabel(1)).toBe('Total: 1 animal');
  });

  it('dois ou mais usam o plural', () => {
    expect(MESSAGES.ANIMALS.totalLabel(2)).toBe('Total: 2 animais');
    expect(MESSAGES.ANIMALS.totalLabel(37)).toBe('Total: 37 animais');
  });
});

describe('MESSAGES.ANIMALS.deleteConfirmation', () => {
  it('interpola o nome entre as aspas CURVAS da tabela da spec', () => {
    // `“ ”` e não `" "`: o critério compara o texto caractere a caractere.
    expect(MESSAGES.ANIMALS.deleteConfirmation('Theo')).toBe(
      'Excluir o animal “Theo”? Esta ação não pode ser desfeita.',
    );
  });
});

describe('o catálogo NÃO duplica mensagem que o backend devolve', () => {
  /**
   * Todo texto do bloco, incluindo o que as funções produzem.
   *
   * Os estáticos são separados por `typeof`, e não por desestruturação nominal:
   * uma função nova acrescentada ao bloco entraria calada na lista de estáticos e
   * a varredura passaria a comparar `[Function]` com as frases do backend — o
   * teste continuaria verde sem verificar a frase nova.
   */
  function textosDoBlocoDeAnimais(): ReadonlyArray<string> {
    /**
     * Passa por `unknown` antes de filtrar: com `as const`, `Object.values`
     * devolve a união dos tipos LITERAIS, e um predicado `valor is string` não
     * compila contra ela (`string` não é atribuível a `"Salvar" | ...`).
     */
    const valores: ReadonlyArray<unknown> = Object.values(MESSAGES.ANIMALS);
    const estaticos = valores.filter((valor): valor is string => typeof valor === 'string');

    return [
      ...estaticos,
      MESSAGES.ANIMALS.deleteConfirmation('Theo'),
      MESSAGES.ANIMALS.totalLabel(0),
      MESSAGES.ANIMALS.totalLabel(1),
      MESSAGES.ANIMALS.totalLabel(2),
      MESSAGES.ANIMALS.imageLimitError(3, 2),
      MESSAGES.ANIMALS.chosenFilesLabel(1),
      MESSAGES.ANIMALS.chosenFilesLabel(2),
      MESSAGES.ANIMALS.removeImageLabel(1, 3),
      MESSAGES.ANIMALS.rejectedFileLabel('a.jpg', 'maior que 5 MB'),
    ];
  }

  /**
   * Literais do `animals.messages.ts` do backend que chegam prontos em
   * `ApiError.message`. Estão aqui, num teste, e não no catálogo: é justamente o
   * lugar em que citá-los serve para PROIBIR a cópia, em vez de convidá-la.
   */
  const PRODUZIDAS_PELO_BACKEND: ReadonlyArray<string> = [
    'Animal não encontrado.',
    'Espécie não encontrada.',
    'Cidade não encontrada.',
    'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
    'É permitido no máximo 5 imagens por animal.',
    'Apenas imagens JPEG ou PNG são aceitas.',
    'Cada imagem deve ter no máximo 5 MB.',
    'O arquivo enviado está vazio.',
  ];

  it.each(PRODUZIDAS_PELO_BACKEND)('"%s" não aparece no catálogo do frontend', (frase: string) => {
    // Duplicar cria duas verdades para a mesma frase, e a divergência aparece
    // como um texto que passa no teste do backend e reprova no critério da tela.
    expect(textosDoBlocoDeAnimais()).not.toContain(frase);
  });
});
