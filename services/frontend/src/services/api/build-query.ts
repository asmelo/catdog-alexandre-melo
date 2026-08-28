/**
 * Monta a query string das listagens paginadas.
 *
 * ARQUIVO SEPARADO, e nao uma funcao dentro do `http-client.ts`: aquele e o
 * modulo que abriga a fila single-flight de renovacao de sessao, cujo
 * comportamento na falha foi medido e e deliberado. Manter a superficie dele
 * intocada alem do necessario e o ponto — uma funcao de montagem de texto nao
 * tem por que dividir arquivo com ela.
 */

/**
 * Valor de parametro aceito. `undefined` significa "nao envie esta chave", e nao
 * "envie vazia" — ver o descarte abaixo.
 */
export type QueryParamValue = string | number | undefined;

/**
 * `""` quando nenhum parametro esta definido, `"?page=2&pageSize=20"` caso
 * contrario. O `?` faz parte do retorno para que o chamador concatene direto
 * (`` `/animals${buildQuery(...)}` ``) sem precisar decidir se ha o que anexar.
 *
 * CHAVES `undefined` SAO OMITIDAS, e nao enviadas vazias. `?page=` chegaria ao
 * `listAnimalsQuerySchema` do backend como texto vazio, que o `z.coerce.number()`
 * transforma em `0` — e `0` esta fora da faixa aceita. O resultado seria um `400`
 * de validacao exatamente no caso em que a intencao era "use o padrao".
 *
 * `URLSearchParams` e nao concatenacao a mao: e ele que escapa o valor. Montar o
 * texto manualmente e o tipo de codigo que funciona ate a primeira cidade com
 * acento ou espaco no nome.
 */
export function buildQuery(params: Readonly<Record<string, QueryParamValue>>): string {
  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined) {
      busca.set(chave, String(valor));
    }
  }

  const texto = busca.toString();

  return texto === '' ? '' : `?${texto}`;
}
