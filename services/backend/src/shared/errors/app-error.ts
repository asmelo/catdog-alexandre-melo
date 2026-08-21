/**
 * Um problema por campo, na forma consumida pelo frontend para marcar o input
 * correspondente. `field` usa notacao de caminho (`endereco.cep`).
 */
export interface ErrorDetail {
  readonly field: string;
  readonly message: string;
}

/**
 * Raiz da hierarquia de erros previstos da aplicacao.
 *
 * `code` e o discriminador estavel (SCREAMING_SNAKE_CASE) sobre o qual o
 * frontend ramifica; `message` e o texto PT-BR pronto para exibicao. A dupla
 * existe justamente para o frontend nunca precisar comparar strings de mensagem.
 */
export abstract class AppError extends Error {
  readonly statusCode: number;

  readonly code: string;

  /**
   * `declare` e obrigatorio aqui: com `target: ES2022` o TypeScript emite os
   * campos declarados via `Object.defineProperty`, o que criaria
   * `details: undefined` como propriedade PROPRIA em todas as instancias — e
   * `'details' in erro` passaria a ser sempre verdadeiro. Com `declare` a
   * propriedade so existe quando de fato atribuida.
   */
  declare readonly details?: ReadonlyArray<ErrorDetail>;

  /**
   * Distingue erro previsto (respondido com a mensagem real) de bug
   * (respondido com mensagem generica pelo error handler).
   */
  readonly isOperational: boolean = true;

  protected constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: ReadonlyArray<ErrorDetail>,
  ) {
    super(message);

    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;

    // Atribuicao condicional: com `exactOptionalPropertyTypes` a propriedade
    // opcional nao aceita `undefined` explicito.
    if (details !== undefined) {
      this.details = details;
    }

    // Sem isto o `instanceof` falha para as subclasses: ao transpilar
    // `extends Error` o prototipo do objeto criado seria o da classe base.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
