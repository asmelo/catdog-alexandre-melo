/**
 * PONTO UNICO de normalizacao do nome da especie. Modulo puro: sem Prisma, sem
 * Express e sem Zod, para que a regra continue verificavel isoladamente e para
 * que nao exista uma segunda implementacao dela em nenhuma camada.
 *
 * O contrato entre as camadas depende disso:
 *
 * - o validador Zod aplica `normalizeSpeciesName` ANTES de medir o tamanho, de
 *   modo que os limites de 2 e 60 caracteres da RN-02 sao contados sobre o valor
 *   ja normalizado, e nao sobre o texto cru;
 * - o repositorio ASSUME que `name` chega normalizado e que `nameNormalized` foi
 *   derivado daqui — ele nao renormaliza nada;
 * - a coluna `name_normalized` e persistida com o resultado de
 *   `speciesNameKey(normalizeSpeciesName(...))`, e e o indice unico sobre ela que
 *   materializa a RN-04 no banco (RN-16).
 */

/**
 * Colapso de espacos da RN-03. `\s+` e nao `' +'` de proposito: o campo do
 * frontend aceita colagem de texto, e tabulacao e quebra de linha precisam virar
 * um unico espaco como qualquer outro branco.
 */
const SEQUENCIA_DE_ESPACOS = /\s+/g;

/**
 * RN-03 — remove os espacos das extremidades e colapsa qualquer sequencia de
 * espacos internos em um unico espaco.
 *
 * PRESERVA caixa e acentos: e este valor que a API expoe e a interface exibe.
 * `"  Cão   Pastor "` vira `"Cão Pastor"`; `"   "` vira `""`, e e a string vazia
 * que permite ao validador reportar "Este campo é obrigatório." em vez de
 * "minimo 2 caracteres".
 */
export function normalizeSpeciesName(bruto: string): string {
  return bruto.trim().replace(SEQUENCIA_DE_ESPACOS, ' ');
}

/**
 * RN-04/RN-05 — chave de unicidade, derivada do valor JA normalizado por
 * `normalizeSpeciesName`.
 *
 * `toLowerCase()` e nao `toLocaleLowerCase()`: o resultado e PERSISTIDO e
 * comparado por igualdade no banco, entao ele nao pode variar com o locale do
 * processo (o mapeamento turco de `I`, por exemplo, produziria uma chave
 * diferente para o mesmo nome dependendo de onde o container roda).
 *
 * NENHUMA remocao de diacritico aqui — nada de `normalize('NFD')` nem
 * substituicao de acentos. A unicidade e sensivel a acento por decisao da RN-05:
 * `"Réptil"` e `"Reptil"` produzem chaves distintas e as duas especies podem
 * coexistir. Remover acento aqui inverteria a regra.
 */
export function speciesNameKey(nomeNormalizado: string): string {
  return nomeNormalizado.toLowerCase();
}
