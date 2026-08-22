/**
 * Contratos da sessao autenticada. Modulo SO DE TIPOS: nao exporta um unico
 * valor, portanto desaparece por completo na compilacao e nao cria aresta de
 * import em tempo de execucao — e por isso que `services/api/auth-api.ts` pode
 * importar `AuthUser` daqui sem inverter a direcao de dependencia real.
 */

/**
 * Os tres estados possiveis da sessao no cliente.
 *
 * `bootstrapping` e obrigatorio, e nao um detalhe: o access token vive em
 * memoria, entao um F5 o apaga. Entre o mount do provider e a resposta do
 * `POST /auth/refresh` a aplicacao nao sabe ainda se ha sessao. Com dois estados
 * apenas, esse intervalo seria indistinguivel de "anonimo" e cada recarga
 * jogaria o usuario logado para `/login`.
 */
export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

/**
 * Vocabulario de role exposto pela API, em MINUSCULAS. Espelha o `AuthRole` do
 * `user.mapper.ts` do backend, que e o unico ponto de conversao do enum do banco
 * (`ADMIN`/`CLIENTE`) para este contrato.
 */
export type AuthRole = 'admin' | 'cliente';

/**
 * Projecao do usuario que o backend devolve em `/auth/login` e `/auth/refresh`.
 *
 * Sem `status` de proposito. O `GET /auth/me` responde um campo `status` A MAIS,
 * e em MAIUSCULAS (`"ACTIVE"`), pela DECISAO-048 da TASK-BACKEND-006 — a
 * assimetria com `role` e deliberada la. Como a hidratacao da sessao usa
 * `/auth/refresh` (que ja devolve o usuario e nao tem esse campo), `status` nao
 * entra no estado do contexto: ele so aparece no tipo de retorno de
 * `authApi.me()`, para quem precisar dele.
 */
export interface AuthUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: AuthRole;
}

/**
 * Por que a sessao terminou. `session-expired` e o que permite a tela de login
 * exibir "Sua sessão expirou. Faça login novamente." em vez de aparecer em
 * branco, sem explicar ao usuario por que ele foi deslogado.
 */
export type LogoutReason = 'user' | 'session-expired';

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

/**
 * O que o registro envia. A confirmacao de senha NAO esta aqui (RN-12): ela
 * existe apenas para comparacao no formulario e nunca trafega — o schema do
 * backend rejeita chave extra no corpo do `POST /auth/register`.
 */
export interface RegistrationInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  /** `null` enquanto a sessao nunca terminou nesta aba. */
  readonly logoutReason: LogoutReason | null;
  /**
   * Devolve o usuario autenticado em vez de navegar. Quem redireciona e a
   * pagina: o provider nao importa o roteador, e por isso ele continua montavel
   * em teste e em qualquer arvore.
   */
  login(input: LoginCredentials): Promise<AuthUser>;
  /** Nunca rejeita: o usuario local sai da sessao mesmo com a API fora do ar. */
  logout(reason?: LogoutReason): Promise<void>;
  /** Registro NAO autentica: a conta nasce pendente de confirmacao de e-mail. */
  register(input: RegistrationInput): Promise<void>;
}
