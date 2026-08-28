import { listPublicAnimalsQuerySchema } from '~/domains/catalog/catalog.validators';

/**
 * O schema da query da vitrine.
 *
 * O contrato HTTP e verificado em `tests/integration/catalog-routes.spec.ts`; o
 * que fica aqui sao as bordas do PARSING que a integracao nao alcanca sem
 * duplicar dezenas de requisicoes — e, principalmente, a distincao entre
 * "parametro vazio" e "parametro ausente", que difere de campo para campo e e a
 * fonte mais provavel de defeito silencioso neste arquivo.
 */

function analisar(query: Record<string, unknown>) {
  return listPublicAnimalsQuerySchema.safeParse(query);
}

describe('padrões', () => {
  it('sem nenhum parâmetro, aplica página 1 e 12 itens', () => {
    const resultado = analisar({});

    expect(resultado.success && resultado.data.page).toBe(1);
    expect(resultado.success && resultado.data.pageSize).toBe(12);
  });
});

describe('a distinção entre VAZIO e AUSENTE', () => {
  it('`maxAgeYears=` vazio é AUSENTE, e não zero', () => {
    // O caso que inverteria o filtro: `z.coerce.number()` converte `""` em `0`, e
    // `0` significa "só filhotes". Um formulário que envia o campo vazio ao
    // submeter desligaria a vitrine sozinho (CT-60).
    const resultado = analisar({ maxAgeYears: '' });

    // `undefined`, e não `0`. A chave permanece no objeto — o `transform` do Zod
    // não a remove —, e é o `=== undefined` do service que a trata como ausente:
    // filtro `undefined` não entra no `where`.
    expect(resultado.success && resultado.data.maxAgeYears).toBeUndefined();
  });

  it('`maxAgeYears=0` é filtro APLICADO', () => {
    const resultado = analisar({ maxAgeYears: '0' });

    expect(resultado.success && resultado.data.maxAgeYears).toBe(0);
  });

  it('`page=` e `pageSize=` vazios caem no padrão', () => {
    const resultado = analisar({ page: '', pageSize: '' });

    expect(resultado.success && resultado.data.page).toBe(1);
    expect(resultado.success && resultado.data.pageSize).toBe(12);
  });

  it('`size=` vazio é RECUSADO — a diferença é deliberada', () => {
    // O frontend OMITE o parâmetro quando o filtro não está aplicado, então
    // `size=` só pode ser requisição malformada (CT-45).
    expect(analisar({ size: '' }).success).toBe(false);
  });

  it('`search=` em branco é busca NÃO APLICADA, e não busca por vazio', () => {
    // A cadeia vazia vira `undefined`, e é o `undefined` que faz o repositório
    // nem montar a cláusula (RN-26, CT-31).
    for (const branco of ['', '   ', '\t\n']) {
      const resultado = analisar({ search: branco });

      expect(resultado.success).toBe(true);
      expect(resultado.success && resultado.data.search).toBeUndefined();
    }
  });
});

describe('normalização da busca', () => {
  it('normaliza acento, caixa e espaços internos antes de chegar ao repositório', () => {
    // É esta normalização, na borda, que garante que os DOIS lados da comparação
    // passaram pela mesma função.
    const resultado = analisar({ search: '  São   PAULO ' });

    expect(resultado.success && resultado.data.search).toBe('sao paulo');
  });

  it('o limite de 120 é medido sobre o texto CRU, antes da normalização', () => {
    // Quem cola 121 caracteres de espaço recebe 400, e não um 200 silencioso: o
    // tamanho recusado é o do que foi enviado.
    expect(analisar({ search: ' '.repeat(121) }).success).toBe(false);
    expect(analisar({ search: 'a'.repeat(120) }).success).toBe(true);
  });
});

describe('coerção numérica', () => {
  it('recusa fracionário em vez de truncar em silêncio', () => {
    // `parseInt` devolveria `3` e o visitante receberia um resultado que não
    // pediu (CT-61).
    expect(analisar({ maxAgeYears: '3.5' }).success).toBe(false);
    expect(analisar({ page: '2.5' }).success).toBe(false);
  });

  it('aceita os extremos da faixa', () => {
    expect(analisar({ maxAgeYears: '30', pageSize: '100', page: '1' }).success).toBe(true);
  });

  it('recusa fora da faixa', () => {
    expect(analisar({ maxAgeYears: '31' }).success).toBe(false);
    expect(analisar({ pageSize: '101' }).success).toBe(false);
    expect(analisar({ page: '0' }).success).toBe(false);
  });
});

describe('o guarda de chaves extras', () => {
  it.each(['status', 'ordenacao', 'sort', 'orderBy', 'limit'])(
    'recusa `%s` apontando o campo, com a frase em PT-BR',
    (chave: string) => {
      // Arrange & Act
      const resultado = analisar({ [chave]: 'x' });

      // Assert — é o `path` que vira o `field` do `details`. O `.strict()` do Zod
      // devolveria `path: []` e mensagem em inglês.
      expect(resultado.success).toBe(false);

      if (!resultado.success) {
        expect(resultado.error.issues[0]?.path).toEqual([chave]);
        expect(resultado.error.issues[0]?.message).toBe('Campo não permitido nesta requisição.');
      }
    },
  );

  it('aceita todos os campos declarados juntos', () => {
    const resultado = analisar({
      search: 'Cão',
      speciesId: '11111111-1111-4111-8111-111111111111',
      cityId: '22222222-2222-4222-8222-222222222222',
      size: 'medio',
      sex: 'femea',
      maxAgeYears: '3',
      page: '2',
      pageSize: '24',
    });

    expect(resultado.success && resultado.data).toEqual({
      search: 'cao',
      speciesId: '11111111-1111-4111-8111-111111111111',
      cityId: '22222222-2222-4222-8222-222222222222',
      size: 'medio',
      sex: 'femea',
      maxAgeYears: 3,
      page: 2,
      pageSize: 24,
    });
  });
});
