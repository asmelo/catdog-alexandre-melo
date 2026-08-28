import { normalizeForSearch } from '~/utils/text-normalizer';

/**
 * A normalizacao de busca (TASK-BACKEND-001).
 *
 * A funcao normaliza os DOIS lados da comparacao — a coluna gravada e o texto
 * digitado —, entao um defeito aqui nao produz erro: produz uma busca que deixa
 * de encontrar o que existe, em silencio.
 */

describe('normalizeForSearch', () => {
  it.each([
    { entrada: '  São   PAULO ', esperado: 'sao paulo' },
    { entrada: 'Cão', esperado: 'cao' },
    { entrada: 'José', esperado: 'jose' },
    { entrada: 'Boa Esperança', esperado: 'boa esperanca' },
    { entrada: 'Ágil', esperado: 'agil' },
    { entrada: 'Caçula', esperado: 'cacula' },
  ])('"$entrada" vira "$esperado"', ({ entrada, esperado }) => {
    expect(normalizeForSearch(entrada)).toBe(esperado);
  });

  it('só espaços vira cadeia vazia — o sinal de "busca não aplicada"', () => {
    // É a cadeia vazia que o validador converte em `undefined`, e é o `undefined`
    // que faz o repositório nem montar a cláusula de busca (RN-26).
    expect(normalizeForSearch('   ')).toBe('');
    expect(normalizeForSearch('')).toBe('');
    expect(normalizeForSearch('\t\n ')).toBe('');
  });

  it('colapsa qualquer branco interno, e não só o espaço', () => {
    // O campo aceita colagem de texto: tabulação e quebra de linha precisam virar
    // um único espaço como qualquer outro branco.
    expect(normalizeForSearch('campo\t\nmagro')).toBe('campo magro');
    expect(normalizeForSearch('campo     magro')).toBe('campo magro');
  });

  it('remove SÓ as marcas combinantes, preservando o resto do texto', () => {
    // A propriedade `\p{Diacritic}` do Unicode incluiria o acento agudo isolado
    // (U+00B4), o circunflexo (U+02C6) e o macron (U+00AF) — que são caracteres
    // de texto, não acentos decompostos. A faixa U+0300–U+036F não os toca.
    expect(normalizeForSearch('a´b')).toBe('a´b');
    expect(normalizeForSearch('rex-2 (filhote)')).toBe('rex-2 (filhote)');
  });

  it('é idempotente: normalizar o já normalizado não muda nada', () => {
    // Importa porque a coluna gravada é normalizada na escrita e o texto digitado
    // na borda; se a função não fosse idempotente, uma segunda passada acidental
    // num dos lados quebraria a comparação.
    const uma = normalizeForSearch('  São   Paulo ');

    expect(normalizeForSearch(uma)).toBe(uma);
  });

  it('não é sensível à forma Unicode da entrada', () => {
    // "ã" pode chegar composto (U+00E3) ou decomposto (a + U+0303) — as duas
    // formas existem em texto colado de fontes diferentes e devem produzir a
    // mesma chave.
    const composto = 'São';
    const decomposto = 'São';

    expect(composto).not.toBe(decomposto);
    expect(normalizeForSearch(composto)).toBe(normalizeForSearch(decomposto));
  });
});
