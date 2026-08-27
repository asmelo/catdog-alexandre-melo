/**
 * Idade derivada do animal (RN-20). Modulo PURO: nao ha `new Date()` aqui
 * dentro, e a ausencia e o contrato — o instante e sempre INJETADO por quem
 * chama, a partir de `~/utils/clock.ts`, que e a fonte unica de tempo do backend
 * e o unico ponto que os testes espionam (`jest.spyOn(clock, 'now')`).
 *
 * A idade NAO e persistida em coluna nenhuma (RN-20): uma idade gravada
 * envelheceria em silencio e passaria a mentir sem que nada no sistema acusasse.
 * O preco e recalcula-la a cada resposta, que e aritmetica sobre tres inteiros.
 */

/**
 * RN-22 — o fuso do PRODUTO, e nao o do processo.
 *
 * Fixo e nao configuravel: e uma regra de negocio ("a idade e contada como em
 * Sao Paulo"), nao um parametro de implantacao. Le-lo de `env` convidaria a
 * mudar a resposta da API editando uma variavel de ambiente.
 */
const FUSO_DO_PRODUTO = 'America/Sao_Paulo';

/**
 * Data civil — ano, mes e dia de calendario, sem hora e sem fuso. E sobre ESTA
 * forma que a idade e contada: subtrair milissegundos e dividir por 365,25 erra
 * em ano bissexto e em horario de verao, e erra justamente nos dias de
 * aniversario, que sao os unicos em que o resultado muda.
 */
interface DataCivil {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

/**
 * `formatToParts` e nao `format`: os `type` das partes (`year`, `month`, `day`)
 * sao estaveis, enquanto a string montada depende do locale e da versao do ICU.
 * O locale pedido e irrelevante para o que se le aqui — o que importa e o
 * `timeZone`.
 */
const PARTES_NO_FUSO_DO_PRODUTO = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_DO_PRODUTO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function lerParte(
  partes: ReadonlyArray<Intl.DateTimeFormatPart>,
  tipo: Intl.DateTimeFormatPartTypes,
): number {
  const parte = partes.find((candidata) => candidata.type === tipo);

  /**
   * Inalcancavel com as tres opcoes pedidas acima, e por isso e `TypeError` e
   * nao um erro de dominio: se acontecer, o defeito e nosso (ou do ICU do
   * runtime) e deve sair como 500 com stack no log, jamais como um 200 com uma
   * idade inventada a partir de `NaN`.
   */
  if (parte === undefined) {
    throw new TypeError(`Intl.DateTimeFormat nao devolveu a parte "${tipo}".`);
  }

  return Number(parte.value);
}

/** Data civil do INSTANTE `agora`, lida no fuso do produto (RN-22, RNF-10). */
function dataCivilNoFusoDoProduto(instante: Date): DataCivil {
  const partes = PARTES_NO_FUSO_DO_PRODUTO.formatToParts(instante);

  return {
    ano: lerParte(partes, 'year'),
    mes: lerParte(partes, 'month'),
    dia: lerParte(partes, 'day'),
  };
}

/**
 * Data civil da COLUNA `birth_date`, lida em UTC — e este e o ponto mais
 * delicado do arquivo.
 *
 * `birth_date` e `@db.Date`: uma data pura, sem hora e sem fuso (RN-18/RN-19). O
 * driver do Prisma a materializa em JavaScript como o instante da MEIA-NOITE UTC
 * daquele dia, porque `Date` nao sabe representar "so o dia". Ler essa meia-noite
 * no fuso do produto (UTC-3) devolveria as 21h do dia ANTERIOR — 05/11/2022
 * viraria 04/11/2022 —, e a idade mudaria um dia antes do aniversario, todo ano.
 *
 * Por isso os dois lados da comparacao sao obtidos de formas DIFERENTES, e a
 * assimetria e deliberada: `agora` e um instante real, que precisa ser
 * convertido para a data civil de Sao Paulo; `birth_date` ja E uma data civil,
 * carimbada em UTC pelo driver, e converte-la de novo a estragaria.
 */
function dataCivilDeColunaDate(data: Date): DataCivil {
  return {
    ano: data.getUTCFullYear(),
    // `getUTCMonth` e base zero; a `DataCivil` deste modulo e base um, como o
    // calendario e como as partes do `Intl`.
    mes: data.getUTCMonth() + 1,
    dia: data.getUTCDate(),
  };
}

/**
 * O aniversario do ano corrente ja passou (ou e hoje)?
 *
 * Compara o par (mes, dia) e nada mais. O `>=` no dia e o que faz o proprio dia
 * do aniversario ja contar o ano novo: quem nasceu em 05/11/2022 tem 4 anos EM
 * 05/11/2026, e nao a partir do dia 6.
 *
 * CONVENCAO PARA 29/02, que nenhuma regra da spec fixa: em ano NAO bissexto o
 * ano so se completa em 01/03, porque (3, 1) > (2, 29) e (2, 28) nao alcanca o
 * dia 29. Nascido em 29/02/2024 tem 0 ano em 28/02/2025 e 1 ano em 01/03/2025.
 * E a leitura civil brasileira usual; se algum dia a regra mudar para "completa
 * em 28/02", o lugar de mudar e AQUI e nao no calculo de anos.
 */
function aniversarioJaOcorreu(hoje: DataCivil, nascimento: DataCivil): boolean {
  if (hoje.mes !== nascimento.mes) {
    return hoje.mes > nascimento.mes;
  }

  return hoje.dia >= nascimento.dia;
}

/**
 * Anos COMPLETOS entre a data de nascimento e o instante `now` (RN-20).
 *
 * `null` quando nao ha data de nascimento, e `null` E DIFERENTE DE `0`
 * (RN-21): zero significa "menos de um ano de vida" e nulo significa "ninguem
 * sabe". Confundir os dois faz a interface exibir "0 anos" para um animal cuja
 * idade e desconhecida, quando o texto devido e "Idade não informada".
 *
 * Uma data de nascimento FUTURA produziria numero negativo. Nao ha travamento
 * para isso de proposito: a RN-19 ja recusa data futura na gravacao, entao um
 * negativo aqui so pode significar linha corrompida — e devolver `0` a
 * disfarcaria de recem-nascido, escondendo o defeito em vez de expo-lo.
 */
export function calculateAgeInYears(birthDate: Date | null, now: Date): number | null {
  if (birthDate === null) {
    return null;
  }

  const nascimento = dataCivilDeColunaDate(birthDate);
  const hoje = dataCivilNoFusoDoProduto(now);

  const anosDecorridos = hoje.ano - nascimento.ano;

  return aniversarioJaOcorreu(hoje, nascimento) ? anosDecorridos : anosDecorridos - 1;
}
