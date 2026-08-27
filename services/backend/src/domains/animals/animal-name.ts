/**
 * PONTO UNICO de normalizacao do nome do ANIMAL. Modulo puro: sem Prisma, sem
 * Express e sem Zod, para que a regra continue verificavel isoladamente e para
 * que nao exista uma segunda implementacao dela em nenhuma camada.
 *
 * Espelha `species-name.ts` na forma e DIVERGE dele na finalidade, e a divergencia
 * e a razao de este arquivo existir em vez de um import cruzado:
 *
 * | | Especie (`species-name.ts`) | Animal (aqui) |
 * |---|---|---|
 * | Para que serve a chave | UNICIDADE (`@unique` na coluna) | ORDENACAO (RN-41) |
 * | Duplicata | recusada com 409 (RN-06) | ACEITA — dois "Theo" convivem (RN-05) |
 *
 * Fundir os dois modulos faria a proxima revisao da unicidade de especie mudar em
 * silencio a ordenacao da listagem de animais.
 */

/**
 * Colapso de espacos. `\s+` e nao `' +'` de proposito: o campo do frontend aceita
 * colagem de texto, e tabulacao e quebra de linha precisam virar um unico espaco
 * como qualquer outro branco.
 */
const SEQUENCIA_DE_ESPACOS = /\s+/g;

/**
 * RN-03 / RN-04 — remove os espacos das extremidades e colapsa qualquer sequencia
 * de espacos internos em um unico espaco.
 *
 * PRESERVA caixa e acentos: e este valor que a API expoe e a interface exibe.
 * `"  Theo   Junior "` vira `"Theo Junior"` (CT-07); `"   "` vira `""`, e e a
 * string vazia que permite ao validador reportar "Este campo é obrigatório." em
 * vez de "minimo 2 caracteres".
 */
export function normalizeAnimalName(bruto: string): string {
  return bruto.trim().replace(SEQUENCIA_DE_ESPACOS, ' ');
}

/**
 * RN-41 — chave de ORDENACAO, derivada do valor JA normalizado por
 * `normalizeAnimalName`. E o valor persistido em `animals.name_normalized`.
 *
 * `toLowerCase()` e nao `toLocaleLowerCase()`: o resultado e PERSISTIDO e
 * ordenado pelo banco, entao ele nao pode variar com o locale do processo (o
 * mapeamento turco de `I`, por exemplo, produziria uma chave diferente para o
 * mesmo nome dependendo de onde o conteiner roda).
 *
 * NENHUMA remocao de diacritico aqui — nada de `normalize('NFD')` nem
 * substituicao de acentos, e a ausencia e deliberada. Esta coluna NAO e um campo
 * de busca: ela existe para que a listagem ordene ignorando a caixa
 * ("Cachorro" antes de "gato"), e o `ORDER BY` do Postgres neste projeto e por
 * LOCALE (provider ICU, `en_US.UTF-8`), que ja coloca "Ágil" antes de "Cão".
 * Remover o acento aqui gravaria "cacula" para um animal chamado "Caçula" e
 * mudaria a posicao dele na lista sem que nada na tela explicasse por que.
 */
export function animalNameKey(nomeNormalizado: string): string {
  return nomeNormalizado.toLowerCase();
}
