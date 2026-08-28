/**
 * Textos de validacao da VITRINE PUBLICA.
 *
 * ============ O QUE NAO ESTA AQUI, DE PROPOSITO ============
 *
 * "Muitas tentativas. Aguarde alguns minutos e tente novamente." NAO e replicada:
 * ela ja vive no `TooManyRequestsError`, e duplica-la criaria duas fontes de
 * verdade para a mesma frase — que divergiriam no primeiro ajuste de texto.
 *
 * Nenhum codigo de erro NOVO nasce nesta feature: a vitrine produz apenas
 * `VALIDATION_ERROR`, que ja existia, e `TOO_MANY_REQUESTS`, que o limitador ja
 * produzia. Nao ha `catalog.errors.ts`.
 *
 * Os literais repetem os dos catalogos de `animals` e de `species` porque o
 * visitante nao deve ler frases diferentes para o mesmo problema dependendo do
 * endpoint. Sao valores iguais em modulos separados, e nao um import cruzado: o
 * dominio publico nao importa do administrativo.
 */
export const MESSAGES = {
  /** Mensagem de topo de todo `VALIDATION_ERROR`; o detalhe vai em `details`. */
  VALIDATION_GUARD: 'Verifique os campos informados.',

  /**
   * Chave nao prevista na query. E esta a mensagem que `?status=adotado` recebe
   * — o status nao e "proibido por nome", ele simplesmente nao existe no schema
   * (RN-10, CA-10).
   */
  FIELD_NOT_ALLOWED: 'Campo não permitido nesta requisição.',

  /** Mesmo literal do `INVALID_IDENTIFIER` de animais e do `INVALID_ID` de especies. */
  INVALID_IDENTIFIER: 'Identificador inválido.',

  /** Valor fora do conjunto fechado de `size` e de `sex`. */
  INVALID_OPTION: 'Selecione uma opção válida.',

  SEARCH_TOO_LONG: 'A busca deve ter no máximo 120 caracteres.',
  INVALID_MAX_AGE: 'Informe uma idade máxima entre 0 e 30 anos.',
  INVALID_PAGE: 'Informe um número de página válido.',
  INVALID_PAGE_SIZE: 'Informe um tamanho de página entre 1 e 100.',
} as const;
