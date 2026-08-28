import {
  birthDateCutoffForMaxAge,
  calculateAge,
  calculateAgeInYears,
  productCivilDateOf,
} from '~/utils/age';

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

/* ------------------------------------------------------------------------- */
/*  FEATURE-003 — anos E meses, e o corte do filtro de idade                  */
/* ------------------------------------------------------------------------- */

describe('calculateAge — anos e meses juntos', () => {
  it('CT-64: nascido em 05/11/2022, com o relógio em 25/08/2026, tem 3 anos e 45 meses', () => {
    // Arrange & Act
    const idade = calculateAge(dataDeNascimento('2022-11-05'), new Date('2026-08-25T12:00:00.000Z'));

    // Assert — 45 meses e não 46: o dia 25 ainda não alcançou o dia 5? alcançou,
    // então (2026-2022)*12 + (8-11) = 45 conta completo.
    expect(idade).toEqual({ ageInYears: 3, ageInMonths: 45 });
  });

  it('CT-65: o MESMO animal passa a 4 anos com o relógio adiantado, sem nenhuma escrita', () => {
    // Arrange
    const nascimento = dataDeNascimento('2022-11-05');

    // Act — só o relógio muda.
    const antes = calculateAge(nascimento, new Date('2026-08-25T12:00:00.000Z'));
    const depois = calculateAge(nascimento, new Date('2026-11-06T12:00:00.000Z'));

    // Assert
    expect(antes.ageInYears).toBe(3);
    expect(depois.ageInYears).toBe(4);
    expect(depois.ageInMonths).toBe(48);
  });

  it('CT-66: exatamente um ano completo devolve 1 ano e 12 meses', () => {
    expect(calculateAge(dataDeNascimento('2025-08-25'), new Date('2026-08-25T12:00:00.000Z'))).toEqual({
      ageInYears: 1,
      ageInMonths: 12,
    });
  });

  it('CT-67: cinco meses completos devolvem 0 ano e 5 meses', () => {
    // Arrange & Act — abaixo de um ano, "3 meses" informa e "0 anos" não. É por
    // isso que os dois valores saem sempre juntos (RN-38).
    const idade = calculateAge(dataDeNascimento('2026-03-25'), new Date('2026-08-25T12:00:00.000Z'));

    // Assert
    expect(idade).toEqual({ ageInYears: 0, ageInMonths: 5 });
  });

  it('CT-68: dez dias de vida devolvem 0 ano e 0 mês — e não `null`', () => {
    // `0` é "menos de um mês de vida"; `null` é "ninguém sabe". Confundir os dois
    // faria a interface exibir "Idade não informada" para um recém-nascido.
    expect(calculateAge(dataDeNascimento('2026-08-15'), new Date('2026-08-25T12:00:00.000Z'))).toEqual({
      ageInYears: 0,
      ageInMonths: 0,
    });
  });

  it('CT-58: sem data de nascimento, ambos são `null` — nunca `0` (RN-39)', () => {
    expect(calculateAge(null, new Date('2026-08-25T12:00:00.000Z'))).toEqual({
      ageInYears: null,
      ageInMonths: null,
    });
  });

  it('CT-69: nascido em 29/02, em ano NÃO bissexto o ano vira em 1º de março', () => {
    // Arrange — o caso que `setFullYear` resolveria por acidente num sentido e
    // erraria no outro: ele normaliza 29/02 para 01/03 em silêncio.
    const nascimento = dataDeNascimento('2024-02-29');

    // Act
    const emFevereiro = calculateAge(nascimento, new Date('2027-02-28T12:00:00.000Z'));
    const emMarco = calculateAge(nascimento, new Date('2027-03-01T12:00:00.000Z'));

    // Assert
    expect(emFevereiro.ageInYears).toBe(2);
    expect(emMarco.ageInYears).toBe(3);
  });

  it('CT-69: em ano BISSEXTO o aniversário cai no próprio 29/02', () => {
    expect(calculateAge(dataDeNascimento('2024-02-29'), new Date('2028-02-29T12:00:00.000Z')).ageInYears).toBe(4);
  });

  it('CT-70: com o processo em UTC, a idade é a de São Paulo — e não a do dia seguinte', () => {
    // Arrange — 22h de São Paulo é 01h UTC do DIA SEGUINTE. Sem a conversão para o
    // dia civil do produto, o animal faria aniversário três horas antes da hora,
    // todo ano (RNF-09, CA-27).
    const fusoOriginal = process.env.TZ;
    const nascimento = dataDeNascimento('2022-11-06');
    // 05/11/2026 às 22h em São Paulo é 06/11 às 01h em UTC.
    const instante = new Date('2026-11-06T01:00:00.000Z');

    try {
      // Act — o MESMO instante, com o processo em três fusos diferentes.
      process.env.TZ = 'UTC';
      const emUtc = calculateAge(nascimento, instante).ageInYears;

      process.env.TZ = 'America/Sao_Paulo';
      const emSaoPaulo = calculateAge(nascimento, instante).ageInYears;

      process.env.TZ = 'Asia/Tokyo';
      const emToquio = calculateAge(nascimento, instante).ageInYears;

      // Assert — ainda é dia 5 em São Paulo, então o aniversário é amanhã: 3 anos.
      // E o resultado NÃO depende do fuso do processo, porque o `Intl` recebe o
      // fuso do produto explicitamente.
      expect(emUtc).toBe(3);
      expect(emSaoPaulo).toBe(3);
      expect(emToquio).toBe(3);
    } finally {
      process.env.TZ = fusoOriginal;
    }
  });
});

describe('birthDateCutoffForMaxAge — o corte do filtro e a idade NUNCA divergem (RN-45)', () => {
  const AGORA = new Date('2026-08-25T12:00:00.000Z');

  function diasAntes(referencia: Date, dias: number): Date {
    return new Date(referencia.getTime() - dias * 24 * 60 * 60 * 1000);
  }

  it.each([0, 1, 3, 10, 30])(
    'CT-63: para maxAgeYears=%i, passa pelo corte SE E SOMENTE SE a idade calculada é <= N',
    (maxAgeYears: number) => {
      // Arrange — varredura de fronteira: cada dia entre `hoje - (N+1) anos - 2
      // dias` e hoje. É esta varredura, e não uma inspeção visual, que fecha a
      // RN-45: um corte com aritmética própria concordaria com a idade na maioria
      // dos dias e discordaria exatamente nos de aniversário.
      const corte = birthDateCutoffForMaxAge(maxAgeYears, AGORA);
      const inicio = new Date(
        Date.UTC(2026 - (maxAgeYears + 1), 7, 25 - 2),
      );

      // Act & Assert
      for (let dia = 0; dia <= (maxAgeYears + 1) * 365 + 4; dia += 1) {
        const nascimento = new Date(inicio.getTime() + dia * 24 * 60 * 60 * 1000);

        if (nascimento > AGORA) {
          break;
        }

        const passaNoCorte = nascimento >= corte;
        const idade = calculateAge(nascimento, AGORA).ageInYears;

        expect({ nascimento: nascimento.toISOString().slice(0, 10), passaNoCorte }).toEqual({
          nascimento: nascimento.toISOString().slice(0, 10),
          passaNoCorte: idade !== null && idade <= maxAgeYears,
        });
      }
    },
  );

  it('quem nasceu exatamente no corte ainda tem N anos; um dia antes já tem N+1', () => {
    // Arrange
    const corte = birthDateCutoffForMaxAge(3, AGORA);

    // Act
    const noCorte = calculateAge(corte, AGORA).ageInYears;
    const umDiaAntes = calculateAge(diasAntes(corte, 1), AGORA).ageInYears;

    // Assert
    expect(noCorte).toBe(3);
    expect(umDiaAntes).toBe(4);
  });

  it('o corte é derivado do dia civil de São Paulo, e não do fuso do processo', () => {
    // Às 22h de São Paulo de 25/08 (01h UTC de 26/08), o "hoje" continua sendo 25.
    const comRelogioDeSaoPaulo = birthDateCutoffForMaxAge(3, new Date('2026-08-26T01:00:00.000Z'));

    expect(comRelogioDeSaoPaulo.toISOString().slice(0, 10)).toBe('2022-08-26');
  });
});
