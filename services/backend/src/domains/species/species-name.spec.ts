import { normalizeSpeciesName, speciesNameKey } from '~/domains/species/species-name';

/**
 * RN-03, RN-04 e RN-05 — o ponto UNICO de normalizacao do nome da especie.
 *
 * Spec CO-LOCADO em `src/`, e nao em `tests/unit/`: o modulo e regra de dominio
 * (a forma como o nome e gravado e comparado), nao infraestrutura transversal
 * como o relogio ou o gerador de token. A convencao do projeto e a mesma do
 * dominio auth — `register-user.service.spec.ts` ao lado do service, e
 * `access-token.service.spec.ts` em `tests/unit/`.
 *
 * Testes de TABELA e nao um `it` por caso: a regra e uma funcao pura e o que
 * importa e o CONJUNTO de entradas cobertas. Um caso novo entra como uma linha,
 * e a diferenca entre os casos fica visivel lado a lado em vez de espalhada por
 * dez blocos quase iguais.
 */

interface CasoDeNormalizacao {
  readonly ct: string;
  readonly descricao: string;
  readonly entrada: string;
  readonly esperado: string;
}

const NORMALIZACAO: ReadonlyArray<CasoDeNormalizacao> = [
  {
    ct: 'RN-03',
    descricao: 'remove espaços das duas extremidades',
    entrada: '  Gato  ',
    esperado: 'Gato',
  },
  {
    ct: 'CT-10',
    descricao: 'colapsa espaços internos repetidos e apara as extremidades',
    entrada: ' Cão   Pastor ',
    esperado: 'Cão Pastor',
  },
  {
    ct: 'RN-03',
    descricao: 'trata tabulação como espaço e a colapsa junto',
    entrada: 'Cão\t\t Pastor',
    esperado: 'Cão Pastor',
  },
  {
    ct: 'RN-03',
    descricao: 'trata quebra de linha como espaço',
    entrada: 'Cão\nPastor',
    esperado: 'Cão Pastor',
  },
  {
    ct: 'CT-03',
    descricao: 'string composta apenas de espaços vira string vazia',
    entrada: '     ',
    esperado: '',
  },
  {
    ct: 'CT-03',
    descricao: 'string composta apenas de brancos invisíveis do \\s vira string vazia',
    entrada: '\t\n  ',
    esperado: '',
  },
  {
    ct: 'RN-03',
    descricao: 'preserva a caixa exatamente como digitada',
    entrada: 'gAtO',
    esperado: 'gAtO',
  },
  {
    ct: 'RN-03',
    descricao: 'preserva acentos e cedilha',
    entrada: 'Réptil Ácaro Cão',
    esperado: 'Réptil Ácaro Cão',
  },
  {
    ct: 'RN-03',
    descricao: 'preserva hífen e apóstrofo, que a spec aceita no nome',
    entrada: "  Cão-d'água  ",
    esperado: "Cão-d'água",
  },
  {
    ct: 'RN-03',
    descricao: 'nome já normalizado atravessa inalterado (idempotência)',
    entrada: 'Cão Pastor',
    esperado: 'Cão Pastor',
  },
];

interface CasoDeChave {
  readonly ct: string;
  readonly descricao: string;
  readonly entrada: string;
  readonly esperado: string;
}

const CHAVE: ReadonlyArray<CasoDeChave> = [
  {
    ct: 'CT-08',
    descricao: 'caixa alta e caixa baixa produzem a MESMA chave',
    entrada: 'GATO',
    esperado: 'gato',
  },
  {
    ct: 'CT-08',
    descricao: 'caixa mista produz a mesma chave da minúscula',
    entrada: 'gAtO',
    esperado: 'gato',
  },
  {
    ct: 'CT-11',
    descricao: 'acento é PRESERVADO na chave (RN-05)',
    entrada: 'Réptil',
    esperado: 'réptil',
  },
  {
    ct: 'CT-11',
    descricao: 'a versão sem acento produz chave diferente',
    entrada: 'Reptil',
    esperado: 'reptil',
  },
  {
    ct: 'RN-04',
    descricao: 'espaço interno único sobrevive à chave',
    entrada: 'Cão Pastor',
    esperado: 'cão pastor',
  },
];

describe('normalizeSpeciesName', () => {
  it.each(NORMALIZACAO)(
    '$ct: $descricao',
    ({ entrada, esperado }: CasoDeNormalizacao) => {
      // Arrange & Act
      const resultado = normalizeSpeciesName(entrada);

      // Assert
      expect(resultado).toBe(esperado);
    },
  );

  it('RN-03: normalizar duas vezes tem o mesmo efeito de normalizar uma (idempotente)', () => {
    // Arrange
    const bruto = '   Cão   Pastor   Alemão  ';

    // Act
    const umaVez = normalizeSpeciesName(bruto);
    const duasVezes = normalizeSpeciesName(umaVez);

    // Assert — a garantia que permite ao repositório assumir que o nome chega
    // pronto e não renormalizar nada.
    expect(duasVezes).toBe(umaVez);
  });
});

describe('speciesNameKey', () => {
  it.each(CHAVE)('$ct: $descricao', ({ entrada, esperado }: CasoDeChave) => {
    // Arrange & Act
    const resultado = speciesNameKey(entrada);

    // Assert
    expect(resultado).toBe(esperado);
  });

  it('CT-08 / CT-09: "Gato", "gato", "GATO" e "  Gato  " colidem na MESMA chave (RN-04)', () => {
    // Arrange
    const variacoes = ['Gato', 'gato', 'GATO', '  Gato  ', ' GaTo '];

    // Act — o caminho real: normalizar a forma e só então derivar a chave.
    const chaves = variacoes.map((bruto) => speciesNameKey(normalizeSpeciesName(bruto)));

    // Assert
    expect(new Set(chaves)).toEqual(new Set(['gato']));
  });

  it('CT-11: "Réptil" e "Reptil" produzem chaves DISTINTAS e podem coexistir (RN-05)', () => {
    // Arrange & Act — nenhuma remoção de diacrítico participa da chave; inverter
    // esta regra tornaria a unicidade dependente da collation do banco.
    const comAcento = speciesNameKey(normalizeSpeciesName('Réptil'));
    const semAcento = speciesNameKey(normalizeSpeciesName('Reptil'));

    // Assert
    expect(comAcento).not.toBe(semAcento);
  });

  it('RN-04: a chave é estável sob o locale do processo, e não depende de toLocaleLowerCase', () => {
    // Arrange — o mapeamento turco de `I` produziria `ı` (sem ponto) com
    // `toLocaleLowerCase('tr')`, e a MESMA espécie ganharia duas chaves conforme
    // a máquina onde o container roda.
    const nome = 'IGUANA';

    // Act
    const chave = speciesNameKey(nome);

    // Assert
    expect(chave).toBe('iguana');
    expect(chave).not.toBe(nome.toLocaleLowerCase('tr-TR'));
  });
});
