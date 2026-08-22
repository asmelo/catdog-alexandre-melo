import { MESSAGES } from '~/utils/messages';

/**
 * Validacao de formulario do fluxo de autenticacao — funcoes PURAS, sem React.
 *
 * Sem hook, sem estado e sem import de componente de proposito: e o que permite
 * exercitar cada regra chamando uma funcao (TASK-FRONTEND-013) em vez de montar
 * uma arvore, digitar num campo e ler o DOM. Uma regra de validacao verificada
 * por consulta ao DOM e uma regra verificada de forma indireta.
 *
 * O RESULTADO E UM MAPA `campo -> mensagem`, e nao um booleano com uma lista de
 * frases: e a mesma forma que `fieldErrorsOf` produz a partir do `details` de um
 * `VALIDATION_ERROR` da API. Com as duas origens na mesma forma, a tela tem UM
 * estado de erros de campo — e nao um estado para o erro local e outro para o
 * erro do servidor, que divergiriam na primeira tela nova.
 *
 * ESTA CAMADA NAO E SEGURANCA. A validacao que vale e a do servidor
 * (`auth.validators.ts`, TASK-BACKEND-004): qualquer regra daqui e pulavel por
 * quem chamar a API diretamente. O que ela entrega e resposta imediata ao
 * usuario e, nos casos CT-03 e CT-04, a AUSENCIA de requisicao — que e
 * exatamente o que o criterio de aceite cobra.
 */

/** Mapa de erros por campo. Campo ausente do mapa significa campo valido. */
export type FieldErrors = Readonly<Record<string, string>>;

/** RN-04. O mesmo numero do `passwordSchema` do backend. */
const TAMANHO_MINIMO_DA_SENHA = 8;

/**
 * Formato de e-mail deliberadamente FROUXO: um caractere que nao seja espaço nem
 * `@`, um `@`, um dominio com ponto.
 *
 * Nao tenta reproduzir o RFC 5322 nem a regra do `z.string().email()` do
 * backend. Uma expressao mais rigida aqui produziria o pior defeito possivel
 * nesta camada — recusar no cliente um endereço que o servidor aceitaria,
 * impedindo o cadastro de um e-mail valido sem nenhuma forma de contornar. O
 * risco oposto (deixar passar algo que o servidor recusa) custa uma viagem de
 * rede e devolve `VALIDATION_ERROR` com a mensagem correta, que a tela ja sabe
 * distribuir pelos campos.
 */
const FORMATO_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Um par `campo -> mensagem`, ou nada.
 *
 * Objeto vazio em vez de `{ [campo]: undefined }`: a chave precisa ficar AUSENTE
 * do mapa, e nao presente com valor indefinido — `'name' in erros` e
 * `Object.keys(erros).length` sao o que as telas consultam para decidir se
 * chamam a API.
 */
function erroDoCampo(campo: string, mensagem: string | undefined): FieldErrors {
  return mensagem === undefined ? {} : { [campo]: mensagem };
}

/**
 * `.trim()` antes de medir: um campo com apenas espaços esta em branco para o
 * usuario, e o `nameSchema` do backend tambem apara antes de exigir conteudo.
 * Sem isso, " " passaria aqui e voltaria como `VALIDATION_ERROR` do servidor.
 */
function erroDeObrigatoriedade(valor: string): string | undefined {
  return valor.trim() === '' ? MESSAGES.VALIDATION.FIELD_REQUIRED : undefined;
}

/**
 * Obrigatoriedade tem precedencia sobre formato: um campo vazio recebe
 * "Este campo é obrigatório." e nao "Informe um e-mail válido.", porque o
 * problema que o usuario precisa resolver primeiro e o de preencher.
 */
function erroDeEmail(valor: string): string | undefined {
  const emBranco = erroDeObrigatoriedade(valor);

  if (emBranco !== undefined) {
    return emBranco;
  }

  return FORMATO_DE_EMAIL.test(valor.trim()) ? undefined : MESSAGES.VALIDATION.EMAIL_INVALID;
}

/**
 * A senha NAO passa por `.trim()` antes de ser medida — espaço e caractere valido
 * de senha, e apara-lo mudaria em silencio o segredo escolhido. Mesma decisao do
 * `passwordSchema` do backend.
 *
 * A obrigatoriedade e verificada sobre a string CRUA: uma senha de oito espaços
 * e uma senha ruim, nao uma senha ausente.
 */
function erroDeSenhaNova(valor: string): string | undefined {
  if (valor === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  return valor.length < TAMANHO_MINIMO_DA_SENHA
    ? MESSAGES.VALIDATION.PASSWORD_TOO_SHORT
    : undefined;
}

/**
 * Igualdade entre senha e confirmacao — RN-12 em codigo.
 *
 * Este e o UNICO lugar do sistema que conhece a confirmacao de senha: ela nao
 * existe no `RegistrationInput`, nao existe no corpo do `POST /auth/register` e
 * nao existe no schema do backend (que reprova qualquer chave extra). A
 * comparacao acontece aqui e o valor morre no estado do formulario.
 *
 * A divergencia so e reportada quando a confirmacao esta PREENCHIDA: com o campo
 * vazio a mensagem correta e "Este campo é obrigatório.", e emitir
 * "As senhas não coincidem." para um campo em branco culparia o usuario por algo
 * que ele ainda nao fez.
 */
function erroDeConfirmacaoDeSenha(senha: string, confirmacao: string): string | undefined {
  if (confirmacao === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  return senha === confirmacao ? undefined : MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH;
}

export interface LoginFormValues {
  readonly email: string;
  readonly password: string;
}

/**
 * Valores do formulario de cadastro, INCLUINDO a confirmacao de senha.
 *
 * Tipo proprio, e nao `RegistrationInput` acrescido de um campo: sao coisas
 * diferentes de proposito. `RegistrationInput` e o que TRAFEGA; este e o que o
 * usuario digitou. Reaproveitar o primeiro aqui abriria a porta para alguem
 * passar o objeto do formulario inteiro ao `register()` — o defeito exato que a
 * RN-12 proibe.
 */
export interface RegisterFormValues {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirmation: string;
}

/**
 * Valida o formulario de login.
 *
 * O TAMANHO MINIMO DA SENHA NAO SE APLICA AQUI, e a omissao e deliberada. Uma
 * senha de sete caracteres na tela de login deve produzir
 * "E-mail ou senha incorretos." como qualquer outra credencial errada:
 * responder "A senha deve ter pelo menos 8 caracteres." informaria a quem sonda
 * o sistema qual e o formato aceito e, para uma conta antiga com senha mais
 * curta, bloquearia o login em vez de recusar a credencial. E a mesma decisao do
 * `loginSchema` do backend, que exige apenas conteudo.
 */
export function validateLoginForm(values: LoginFormValues): FieldErrors {
  return {
    ...erroDoCampo('email', erroDeEmail(values.email)),
    ...erroDoCampo('password', erroDeObrigatoriedade(values.password)),
  };
}

/**
 * Valida o formulario de cadastro por completo — quatro campos numa passada.
 *
 * TODAS as regras sao avaliadas, e nao apenas a primeira que falha: um
 * formulario que aponta um problema por vez obriga o usuario a submeter quatro
 * vezes para descobrir os quatro erros. Cada campo recebe no maximo UMA
 * mensagem, porque e o que cabe abaixo do campo.
 */
export function validateRegisterForm(values: RegisterFormValues): FieldErrors {
  return {
    ...erroDoCampo('name', erroDeObrigatoriedade(values.name)),
    ...erroDoCampo('email', erroDeEmail(values.email)),
    ...erroDoCampo('password', erroDeSenhaNova(values.password)),
    ...erroDoCampo(
      'passwordConfirmation',
      erroDeConfirmacaoDeSenha(values.password, values.passwordConfirmation),
    ),
  };
}

/**
 * Valida o formulario de um campo so de e-mail — o pedido de novo link de
 * confirmacao. Existe para que a tela de confirmacao nao tenha de reimplementar
 * obrigatoriedade e formato por conta propria.
 */
export function validateEmailOnlyForm(email: string): FieldErrors {
  return erroDoCampo('email', erroDeEmail(email));
}

/** Acucar de leitura para `Object.keys(erros).length > 0` nos pontos de submissao. */
export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
