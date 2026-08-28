import { calculateAgeInYears, productCivilDateOf } from '~/utils/age';

/**
 * Idade DERIVADA da data de nascimento (RN-20 / RN-21 / RNF-10).
 *
 * Nenhuma coluna de idade existe: se existisse, ela envelheceria em silencio e
 * passaria a mentir sem que nada acusasse. O que este spec protege sao tres
 * coisas que so aparecem em producao se estiverem erradas:
 *
 *   1. a idade muda quando o RELOGIO anda, sem nenhuma escrita no banco;
 *   2. `null` (sem data de nascimento) e `0` (nasceu este ano) sao resultados
 *      DISTINTOS — confundi-los faria a vitrine exibir "0 anos" para um animal
 *      cuja idade ninguem informou;
 *   3. a data civil e a do fuso do produto, e nao a do processo. Com o servidor em
 *      UTC, as 22h em Sao Paulo ja e o dia seguinte em UTC, e uma comparacao
 *      ingenua recusaria a data de HOJE como futura — defeito que so aparece a
 *      noite, em producao.
 *
 * As datas de nascimento sao construidas como `...T00:00:00.000Z` porque a coluna
 * e `@db.Date`: o Prisma devolve a data civil a meia-noite UTC.
 */

function dataDeNascimento(civil: string): Date {
  return new Date(`${civil}T00:00:00.000Z`);
}

describe('calculateAgeInYears', () => {
  it('CT-18: nascido em 05/11/2022, com o relogio em 25/08/2026, tem 3 anos', () => {
    // Arrange — o aniversario de 2026 ainda nao chegou.
    const nascimento = dataDeNascimento('2022-11-05');
    const agora = new Date('2026-08-25T12:00:00.000Z');

    // Act
    const idade = calculateAgeInYears(nascimento, agora);

    // Assert — 4 seria o erro classico de subtrair so os anos.
    expect(idade).toBe(3);
  });

  it('CT-19: o MESMO animal passa a 4 anos com o relogio em 06/11/2026, sem nenhuma escrita', () => {
    // Arrange — mesmo nascimento do CT-18. O que muda e apenas o relogio, o que e
    // a prova de que a idade nao esta persistida em lugar nenhum.
    const nascimento = dataDeNascimento('2022-11-05');

    // Act
    const antes = calculateAgeInYears(nascimento, new Date('2026-08-25T12:00:00.000Z'));
    const depois = calculateAgeInYears(nascimento, new Date('2026-11-06T12:00:00.000Z'));

    // Assert
    expect(antes).toBe(3);
    expect(depois).toBe(4);
  });

  it('CT-19: no PROPRIO dia do aniversario a idade ja avanca', () => {
    // Arrange — o dia exato e o limite entre os dois ramos de `aniversarioJaOcorreu`.
    const nascimento = dataDeNascimento('2022-11-05');

    // Act
    const vespera = calculateAgeInYears(nascimento, new Date('2026-11-04T12:00:00.000Z'));
    const noDia = calculateAgeInYears(nascimento, new Date('2026-11-05T12:00:00.000Z'));

    // Assert
    expect(vespera).toBe(3);
    expect(noDia).toBe(4);
  });

  it('avanca no mes seguinte ao do nascimento e ainda nao avanca no mes anterior', () => {
    // Arrange — cobre os dois lados da comparacao de MES, que e um ramo proprio.
    const nascimento = dataDeNascimento('2022-06-15');

    // Act
    const mesAnterior = calculateAgeInYears(nascimento, new Date('2026-05-31T12:00:00.000Z'));
    const mesSeguinte = calculateAgeInYears(nascimento, new Date('2026-07-01T12:00:00.000Z'));

    // Assert
    expect(mesAnterior).toBe(3);
    expect(mesSeguinte).toBe(4);
  });

  it('RN-21: sem data de nascimento a idade e `null`, e `null` NAO e `0`', () => {
    // Arrange — o animal nascido hoje tem idade 0; o animal sem data informada tem
    // idade ausente. Sao dois estados diferentes do produto.
    const agora = new Date('2026-08-25T12:00:00.000Z');
    const nascidoHoje = dataDeNascimento('2026-08-25');

    // Act
    const semData = calculateAgeInYears(null, agora);
    const recemNascido = calculateAgeInYears(nascidoHoje, agora);

    // Assert
    expect(semData).toBeNull();
    expect(recemNascido).toBe(0);
    expect(semData).not.toBe(recemNascido);
  });

  it('CT-20: a ausencia de data e preservada em qualquer instante', () => {
    // Arrange & Act
    const idades = [
      new Date('2020-01-01T00:00:00.000Z'),
      new Date('2026-08-25T12:00:00.000Z'),
      new Date('2099-12-31T23:59:59.999Z'),
    ].map((instante) => calculateAgeInYears(null, instante));

    // Assert
    expect(idades).toEqual([null, null, null]);
  });

  it('RNF-10: as 22h de Sao Paulo (01h do dia seguinte em UTC) a data de hoje ainda e hoje', () => {
    // Arrange — o processo em UTC ve 26/08; o produto vive em America/Sao_Paulo e
    // ainda esta em 25/08. Este e o defeito que so aparece depois das 21h.
    const vinteEDuasHorasEmSaoPaulo = new Date('2026-08-26T01:00:00.000Z');

    // Act
    const civil = productCivilDateOf(vinteEDuasHorasEmSaoPaulo);
    const idadeDeQuemNasceuHoje = calculateAgeInYears(
      dataDeNascimento('2026-08-25'),
      vinteEDuasHorasEmSaoPaulo,
    );

    // Assert — a data civil do produto e 25, e nao 26.
    expect(civil).toEqual({ year: 2026, month: 8, day: 25 });
    expect(vinteEDuasHorasEmSaoPaulo.getUTCDate()).toBe(26);
    // E a data de HOJE, aceita pelo validador, produz idade 0 e nao -1.
    expect(idadeDeQuemNasceuHoje).toBe(0);
  });

  it('RNF-10: a data civil do produto independe do fuso do PROCESSO', () => {
    // Arrange — o mesmo instante lido com `TZ` diferente no processo. `TZ` e
    // reposto no fim para nao contaminar os demais testes do arquivo.
    const instante = new Date('2026-08-26T01:00:00.000Z');
    const fusoOriginal = process.env.TZ;

    try {
      process.env.TZ = 'UTC';
      const emUtc = productCivilDateOf(instante);

      process.env.TZ = 'Asia/Tokyo';
      const emToquio = productCivilDateOf(instante);

      // Assert
      expect(emUtc).toEqual({ year: 2026, month: 8, day: 25 });
      expect(emToquio).toEqual(emUtc);
    } finally {
      if (fusoOriginal === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = fusoOriginal;
      }
    }
  });
});
