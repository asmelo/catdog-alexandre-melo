/**
 * Normalizacao de texto para BUSCA. Modulo puro: sem Prisma, sem Express e sem
 * dependencia externa — `String.prototype.normalize` e da plataforma.
 *
 * ==================== POR QUE ESTA FUNCAO EXISTE ====================
 *
 * O construtor de consultas do Prisma oferece `mode: 'insensitive'` para CAIXA,
 * mas nao para DIACRITICOS (Decisao B da spec). Sem isso, quem digita "sao" nao
 * encontra "São Paulo" e quem digita "cao" nao encontra "Cão" — que e exatamente
 * a busca que o visitante da vitrine tenta fazer.
 *
 * A alternativa recusada foi habilitar a extensao `unaccent` do Postgres: ela
 * exige privilegio de superusuario no banco gerenciado e tornaria a busca
 * dependente de uma extensao que nao esta no schema versionado.
 *
 * ============ A MESMA FUNCAO NORMALIZA OS DOIS LADOS ============
 *
 * A coluna gravada (`animals.name_search`, `cities.name_search`) e o texto que o
 * visitante digitou passam por AQUI. E essa simetria — e nao a collation do
 * Postgres — que torna a busca deterministica e reproduzivel em teste (RN-23,
 * RN-26). Normalizar so um dos lados produziria uma busca que funciona para
 * palavra sem acento e falha para palavra com acento, sem erro nenhum.
 *
 * ============== NAO CONFUNDIR COM `animalNameKey` ==============
 *
 * `animal-name.ts` produz `animals.name_normalized`, que e MINUSCULO MAS PRESERVA
 * ACENTOS de proposito: aquela coluna serve a ORDENACAO alfabetica administrativa
 * (RN-41 da FEATURE-002), e o `ORDER BY` do Postgres por locale ICU ja coloca
 * "Ágil" antes de "Cão". Remover o acento la mudaria a posicao de "Caçula" na
 * lista sem que nada na tela explicasse por que.
 *
 * As duas colunas coexistem porque servem a coisas diferentes. Fundir as duas
 * quebra a FEATURE-002 em silencio, sem quebrar nenhum teste dela.
 */

/**
 * Colapso de espacos, o MESMO padrao ja usado em `animal-name.ts` e em
 * `species-name.ts`. `\s+` e nao `' +'`: o campo de busca aceita colagem de
 * texto, e tabulacao e quebra de linha precisam virar um unico espaco como
 * qualquer outro branco.
 *
 * Exportado para que a duplicacao pare aqui — quem precisar do mesmo colapso
 * importa desta constante em vez de reescrever a expressao.
 */
export const SEQUENCIA_DE_ESPACOS = /\s+/g;

/**
 * Faixa das MARCAS COMBINANTES do Unicode (U+0300 a U+036F), que e onde o
 * `normalize('NFD')` deposita os acentos ao decompor cada letra acentuada em
 * "letra base + marca".
 *
 * Escrita como faixa de code points, e nao como `\p{Diacritic}`: a propriedade
 * `Diacritic` inclui tambem caracteres que NAO sao marcas combinantes (o acento
 * agudo isolado U+00B4, o circunflexo U+02C6, o macron U+00AF), e remove-los
 * apagaria caractere de texto em vez de acento decomposto.
 */
const MARCAS_COMBINANTES = /[̀-ͯ]/g;

/**
 * Texto pronto para comparacao de busca: sem espaco sobrando, sem acento e em
 * minusculas.
 *
 * `"  São   PAULO "` vira `"sao paulo"`; `"Cão"` vira `"cao"`; `"José"` vira
 * `"jose"`; `"   "` vira `""` — e a cadeia vazia e o sinal de "busca nao
 * aplicada" que o servico de catalogo consome (RN-26).
 *
 * SEM `normalize('NFC')` de volta: depois da remocao das marcas nao ha o que
 * recompor, e a recomposicao so custaria uma passada a mais.
 *
 * `toLowerCase()` e nao `toLocaleLowerCase()`: o resultado e PERSISTIDO numa
 * coluna e comparado por igualdade, entao ele nao pode variar com o locale do
 * processo — o mapeamento turco de `I` produziria uma chave diferente para o
 * mesmo nome dependendo de onde o conteiner roda.
 */
export function normalizeForSearch(valor: string): string {
  return valor
    .trim()
    .replace(SEQUENCIA_DE_ESPACOS, ' ')
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .toLowerCase();
}
