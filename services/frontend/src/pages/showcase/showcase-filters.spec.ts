import {
  EMPTY_FILTERS,
  hasActiveFilters,
  parseShowcaseFilters,
  toApiFilters,
  toSearchParams,
  type ShowcaseFilters,
} from '~/pages/showcase/showcase-filters';

/**
 * "A TELA TOLERA, A API RECUSA".
 *
 * O que este arquivo protege e a promessa de que `parseShowcaseFilters` NUNCA
 * lanca e sempre devolve um estado renderizavel — um link colado num app de
 * mensagens chega quebrado o tempo todo, e o visitante precisa ver o catalogo, e
 * nao uma tela de erro sobre um parametro que ele nem sabe que existe.
 */

const UUID_VALIDO = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OUTRO_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function analisar(query: string): ShowcaseFilters {
  return parseShowcaseFilters(new URLSearchParams(query));
}

describe('parseShowcaseFilters — leitura tolerante (RN-49)', () => {
  it('endereço vazio devolve o estado inicial', () => {
    expect(analisar('')).toEqual(EMPTY_FILTERS);
  });

  it('CT-82: um endereço completo é lido campo a campo', () => {
    expect(
      analisar(
        `busca=theo&especie=${UUID_VALIDO}&porte=grande&sexo=macho&idadeMax=3&cidade=${OUTRO_UUID}&pagina=2`,
      ),
    ).toEqual({
      busca: 'theo',
      especie: UUID_VALIDO,
      porte: 'grande',
      sexo: 'macho',
      idadeMax: 3,
      cidade: OUTRO_UUID,
      pagina: 2,
    });
  });

  it('CT-86/CT-87: um endereço inteiramente estragado NÃO lança e devolve estado renderizável', () => {
    // Arrange & Act — o caso do link cortado por um app de mensagens.
    const filtros = analisar('idadeMax=-5&porte=gigante&especie=abc&pagina=xyz&desconhecido=1');

    // Assert — os cinco descartados, e a vitrine é exibida normalmente.
    expect(filtros).toEqual(EMPTY_FILTERS);
  });

  it.each([
    { query: 'idadeMax=-1', motivo: 'negativa' },
    { query: 'idadeMax=31', motivo: 'acima de 30' },
    { query: 'idadeMax=3.5', motivo: 'fracionária' },
    { query: 'idadeMax=abc', motivo: 'não numérica' },
    { query: 'idadeMax=3abc', motivo: 'numérica com sufixo' },
  ])('idade $motivo é descartada', ({ query }) => {
    expect(analisar(query).idadeMax).toBeNull();
  });

  it('CT-59: `idadeMax=0` é PRESERVADO — zero é filtro aplicado', () => {
    // Descartá-lo transformaria a escolha do visitante em ausência de filtro.
    expect(analisar('idadeMax=0').idadeMax).toBe(0);
  });

  it('CT-53/RN-33: UUID bem formado é mantido mesmo sem estar entre as opções', () => {
    // Quem decide que uma espécie não existe é o SERVIDOR, e ele responde 200 com
    // lista vazia — nunca 404.
    expect(analisar(`especie=${UUID_VALIDO}`).especie).toBe(UUID_VALIDO);
  });

  it('identificador fora do formato UUID é descartado', () => {
    expect(analisar('especie=abc&cidade=123').especie).toBeNull();
    expect(analisar('especie=abc&cidade=123').cidade).toBeNull();
  });

  it.each(['porte=gigante', 'porte=GRANDE', 'porte='])('%s é descartado', (query: string) => {
    expect(analisar(query).porte).toBeNull();
  });

  it('busca acima de 120 caracteres é TRUNCADA, e não descartada', () => {
    // Quem colou um texto longo quis buscar por ele; devolver o catálogo inteiro
    // seria mais confuso.
    expect(analisar(`busca=${'a'.repeat(130)}`).busca).toHaveLength(120);
  });

  it('busca só de espaços vira vazia', () => {
    expect(analisar('busca=%20%20%20').busca).toBe('');
  });

  it.each(['pagina=xyz', 'pagina=0', 'pagina=-3', 'pagina=1.5'])(
    '%s cai em 1',
    (query: string) => {
      expect(analisar(query).pagina).toBe(1);
    },
  );

  it('CT-76: página maior que a última é PRESERVADA — a grade vem vazia, sem erro', () => {
    // A tela nem sabe o total quando lê o endereço; quem decide quantas páginas
    // existem é o servidor.
    expect(analisar('pagina=999').pagina).toBe(999);
  });

  it('parâmetro desconhecido é ignorado, sem afetar os demais', () => {
    expect(analisar('busca=theo&ordenacao=nome&utm_source=whatsapp')).toEqual({
      ...EMPTY_FILTERS,
      busca: 'theo',
    });
  });
});

describe('toSearchParams — só o aplicado deixa parâmetro (RN-48)', () => {
  it('CT-89: o estado inicial produz endereço SEM nenhum parâmetro', () => {
    // `?busca=&especie=&pagina=1` pareceria filtro aplicado.
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('CT-85: filtros parciais produzem só os aplicados', () => {
    expect(
      toSearchParams({ ...EMPTY_FILTERS, busca: 'theo', porte: 'grande' }).toString(),
    ).toBe('busca=theo&porte=grande');
  });

  it('`idadeMax: 0` PRODUZ parâmetro — a checagem é contra `null`, não veracidade', () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, idadeMax: 0 }).get('idadeMax')).toBe('0');
  });

  it('`pagina: 1` não aparece; `pagina: 3` aparece', () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, pagina: 1 }).has('pagina')).toBe(false);
    expect(toSearchParams({ ...EMPTY_FILTERS, pagina: 3 }).get('pagina')).toBe('3');
  });

  it('CT-81: a ida e a volta preservam o estado', () => {
    // Arrange
    const filtros: ShowcaseFilters = {
      busca: 'são paulo',
      especie: UUID_VALIDO,
      porte: 'medio',
      sexo: 'femea',
      idadeMax: 0,
      cidade: OUTRO_UUID,
      pagina: 4,
    };

    // Act & Assert — é o que faz recarregar a página não perder nada (CT-83).
    expect(parseShowcaseFilters(toSearchParams(filtros))).toEqual(filtros);
  });
});

describe('toApiFilters — a ÚNICA tradução PT-BR → inglês (RN-47)', () => {
  it('traduz as sete chaves', () => {
    expect(
      toApiFilters({
        busca: 'theo',
        especie: UUID_VALIDO,
        porte: 'grande',
        sexo: 'macho',
        idadeMax: 3,
        cidade: OUTRO_UUID,
        pagina: 2,
      }),
    ).toEqual({
      search: 'theo',
      speciesId: UUID_VALIDO,
      size: 'grande',
      sex: 'macho',
      maxAgeYears: 3,
      cityId: OUTRO_UUID,
      page: 2,
    });
  });

  it('filtro não aplicado não vira chave — nem como `undefined`', () => {
    expect(toApiFilters(EMPTY_FILTERS)).toEqual({ page: 1 });
  });

  it('`idadeMax: 0` vira `maxAgeYears: 0`, e não some', () => {
    expect(toApiFilters({ ...EMPTY_FILTERS, idadeMax: 0 })).toEqual({
      maxAgeYears: 0,
      page: 1,
    });
  });
});

describe('hasActiveFilters', () => {
  it('é falso no estado inicial', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it.each([
    { campo: 'busca', filtros: { busca: 'theo' } },
    { campo: 'especie', filtros: { especie: UUID_VALIDO } },
    { campo: 'porte', filtros: { porte: 'grande' as const } },
    { campo: 'sexo', filtros: { sexo: 'macho' as const } },
    { campo: 'idadeMax', filtros: { idadeMax: 0 } },
    { campo: 'cidade', filtros: { cidade: UUID_VALIDO } },
  ])('é verdadeiro com $campo aplicado', ({ filtros }) => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ...filtros })).toBe(true);
  });

  it('`pagina` NÃO conta como filtro', () => {
    // Estar na página 3 não é um critério a limpar; incluí-la deixaria o botão
    // "Limpar filtros" habilitado numa vitrine sem filtro nenhum.
    expect(hasActiveFilters({ ...EMPTY_FILTERS, pagina: 3 })).toBe(false);
  });
});

describe('o contrato da RN-49: `parseShowcaseFilters` NUNCA lança', () => {
  it.each([
    { cenario: 'chaves repetidas', query: 'porte=grande&porte=pequeno&busca=a&busca=b' },
    { cenario: 'valores absurdos', query: 'idadeMax=NaN&pagina=Infinity&especie=%%%' },
    { cenario: 'só sinais', query: '&&&===&' },
    { cenario: 'chave sem valor', query: 'busca&porte&pagina' },
    { cenario: 'percent-encoding quebrado', query: 'busca=%E0%A4%A' },
    { cenario: 'valor gigantesco', query: `busca=${'x'.repeat(5000)}` },
    { cenario: 'unicode e emoji', query: 'busca=%F0%9F%90%B6%20S%C3%A3o' },
  ])('$cenario devolve um estado renderizável, sem exceção', ({ query }) => {
    // Arrange & Act — é o contrato: um link colado num app de mensagens chega
    // quebrado o tempo todo, e o visitante precisa ver o catálogo.
    const executar = (): unknown => parseShowcaseFilters(new URLSearchParams(query));

    // Assert
    expect(executar).not.toThrow();

    const filtros = executar() as ShowcaseFilters;

    expect(typeof filtros.busca).toBe('string');
    expect(Number.isInteger(filtros.pagina)).toBe(true);
    expect(filtros.pagina).toBeGreaterThanOrEqual(1);
  });

  it('com chaves repetidas, o PRIMEIRO valor vence — o comportamento do `URLSearchParams`', () => {
    // Não é escolha desta função: `get` devolve a primeira ocorrência. O caso
    // existe para fixar o comportamento, e não para propô-lo.
    expect(parseShowcaseFilters(new URLSearchParams('porte=grande&porte=pequeno')).porte).toBe(
      'grande',
    );
  });
});
