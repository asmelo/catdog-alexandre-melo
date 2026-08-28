import { MESSAGES } from '~/utils/messages';

/**
 * Rotulo de idade em PT-BR, a partir dos DOIS campos que o backend ja devolve.
 *
 * ============ A TELA NAO RECALCULA IDADE ============
 *
 * Nenhuma data entra aqui, e a ausencia e o contrato. O servidor calcula a idade
 * no fuso `America/Sao_Paulo` a cada resposta (RN-37) — e e por isso que
 * `birthDate` esta FORA da projecao publica. Recalcular no navegador usaria o
 * fuso do visitante e produziria, em algumas horas do dia, uma idade diferente da
 * que o filtro de idade maxima usou para escolher quem aparece.
 *
 * ============ CONCORDANCIA, QUE A CAPTURA ERRA ============
 *
 * A captura de tela exibe "3 ano(s)". Esta implementacao escreve "3 anos" e
 * "1 ano", pelo mesmo principio que ja corrigiu "Total: 1 animais" na FEATURE-002
 * deste modulo: a fonte da verdade e a captura, mas um defeito de concordancia
 * nela e um defeito, e nao um requisito.
 *
 * `null` E DIFERENTE DE `0`, e a distincao e visivel na tela: `null` vira "Idade
 * não informada" e `0` ano com `0` mes vira "Menos de 1 mês". Um `?? 0` aqui
 * transformaria animal de idade desconhecida em recem-nascido.
 */
export function formatAge(ageInYears: number | null, ageInMonths: number | null): string {
  if (ageInYears === null) {
    return MESSAGES.SHOWCASE.AGE_UNKNOWN;
  }

  if (ageInYears >= 1) {
    return ageInYears === 1 ? '1 ano' : `${String(ageInYears)} anos`;
  }

  /**
   * Abaixo de um ano o mes informa e o ano nao: "0 anos" nao diz nada a quem
   * procura um filhote (RN-38).
   *
   * O `ageInMonths` e conferido contra `null` mesmo com `ageInYears` ja nao nulo:
   * os dois vem juntos do backend, mas o tipo os declara independentes, e uma
   * assercao de nao-nulo aqui seria a unica do arquivo.
   */
  if (ageInMonths !== null && ageInMonths >= 1) {
    return ageInMonths === 1 ? '1 mês' : `${String(ageInMonths)} meses`;
  }

  return MESSAGES.SHOWCASE.AGE_UNDER_ONE_MONTH;
}
