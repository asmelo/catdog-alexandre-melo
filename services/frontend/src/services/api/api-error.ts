/**
 * Erro tipado da API — a UNICA forma como uma falha de rede ou de negocio chega
 * as telas.
 *
 * O envelope do backend (`{ error: { code, message, details? } }`, congelado nas
 * TASK-BACKEND-004/005/006) e reconstituido aqui com as tres informacoes que a
 * interface precisa e nada mais:
 *
 * - `code` e o DISCRIMINADOR de fluxo. E por ele que a tela ramifica — por
 *   exemplo, `ACCOUNT_NOT_CONFIRMED` habilita o botao de reenvio de e-mail e
 *   `SESSION_EXPIRED` manda o usuario ao login. Nunca comparar `message`.
 * - `message` ja vem em PT-BR pronto para exibicao, escrito pelo catalogo
 *   `auth.messages.ts` do backend. Montar texto de erro a partir do `status`
 *   HTTP e proibido: geraria duas fontes de verdade para a mesma frase.
 * - `details` so aparece em `VALIDATION_ERROR`, com um par campo/mensagem por
 *   problema.
 */

/** Um problema por campo, na notacao de caminho usada pelo backend (`endereco.cep`). */
export interface ApiErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorInput {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: ReadonlyArray<ApiErrorDetail>;
}

/**
 * Entrada em objeto, e nao quatro parametros posicionais: `status` e `code` sao
 * ambos curtos e trocar a ordem deles nao seria erro de compilacao.
 */
export class ApiError extends Error {
  readonly status: number;

  readonly code: string;

  /**
   * Atribuicao condicional, como no `AppError` do backend: quando nao ha
   * detalhes a propriedade fica AUSENTE, e nao presente com valor `undefined`.
   */
  readonly details?: ReadonlyArray<ApiErrorDetail>;

  constructor(input: ApiErrorInput) {
    super(input.message);

    // `name` explicito: o valor default seria `Error`, e e este nome que aparece
    // no console e no relatorio de erro do navegador.
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;

    if (input.details !== undefined) {
      this.details = input.details;
    }
  }
}

/**
 * Converte `details` no mapa que os formularios consomem para marcar cada input.
 *
 * Aceita `unknown` de proposito: o valor chega de um `catch`, onde o TypeScript
 * nao garante tipo algum. Erro que nao e `ApiError` (falha de programacao, por
 * exemplo) devolve mapa vazio, e nao excecao — quem estava tratando um erro nao
 * pode ser interrompido por um segundo erro.
 *
 * Primeira ocorrencia de cada campo vence: exibir duas mensagens no mesmo input
 * e impossivel, e a primeira e a mais especifica na ordem em que o Zod reporta.
 *
 * `Map` + `Object.fromEntries` em vez de escrita direta em objeto literal:
 * `fromEntries` define propriedade de dados mesmo para uma chave como
 * `__proto__`, enquanto `mapa[campo] = ...` acionaria o setter do prototipo.
 */
export function fieldErrorsOf(erro: unknown): Record<string, string> {
  if (!(erro instanceof ApiError) || erro.details === undefined) {
    return {};
  }

  const porCampo = new Map<string, string>();

  for (const detalhe of erro.details) {
    if (!porCampo.has(detalhe.field)) {
      porCampo.set(detalhe.field, detalhe.message);
    }
  }

  return Object.fromEntries(porCampo);
}
