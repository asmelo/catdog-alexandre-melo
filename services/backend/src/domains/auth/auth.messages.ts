/**
 * Catalogo UNICO dos textos PT-BR do dominio de autenticacao.
 *
 * Os blocos marcados como "spec" sao contrato literal: os criterios de aceite
 * comparam a string caractere a caractere, entao nada aqui pode ser reescrito
 * por estilo. As chaves seguem os `code` dos erros correspondentes para que o
 * frontend nunca precise comparar mensagem — ele ramifica pelo `code`.
 */
export const MESSAGES = {
  // --- Tabela "Mensagens ao Usuario" da spec: registro e confirmacao ---
  REGISTER_SUCCESS: 'Verifique seu e-mail para ativar sua conta.',
  EMAIL_ALREADY_IN_USE: 'Este e-mail já está em uso.',
  /** Validada apenas no formulario (RN-12); fica no catalogo por ser da spec. */
  PASSWORDS_DO_NOT_MATCH: 'As senhas não coincidem.',
  PASSWORD_TOO_SHORT: 'A senha deve ter pelo menos 8 caracteres.',
  FIELD_REQUIRED: 'Este campo é obrigatório.',
  CONFIRMATION_SUCCESS: 'Conta confirmada! Faça login para continuar.',
  CONFIRMATION_TOKEN_EXPIRED:
    'Este link de confirmação expirou. Solicite um novo e-mail de confirmação.',
  CONFIRMATION_TOKEN_ALREADY_USED: 'Este link de confirmação já foi utilizado.',

  // --- Tabela da spec: login e sessao (consumidas pela TASK-BACKEND-005) ---
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  ACCOUNT_NOT_CONFIRMED: 'Sua conta ainda não foi confirmada. Verifique seu e-mail.',
  SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.',

  // --- Fora da tabela da spec, exigidas pelo plano desta task ---
  CONFIRMATION_TOKEN_INVALID: 'Link de confirmação inválido.',
  /**
   * Resposta unica do reenvio. Deliberadamente ambigua: dizer "conta nao
   * encontrada" transformaria o endpoint em oraculo de e-mails cadastrados
   * (mesmo espirito da RN-05).
   */
  RESEND_GENERIC:
    'Se houver uma conta pendente para este e-mail, enviamos um novo link de confirmação.',

  // --- Validacao de campo: sem esta secao o Zod responderia em ingles ---
  REQUEST_BODY_INVALID: 'Corpo da requisição inválido.',
  UNEXPECTED_FIELD: 'Campo não permitido nesta requisição.',
  NAME_TOO_SHORT: 'O nome deve ter no mínimo 2 caracteres.',
  NAME_TOO_LONG: 'O nome deve ter no máximo 100 caracteres.',
  EMAIL_INVALID: 'Informe um e-mail válido.',
  EMAIL_TOO_LONG: 'O e-mail deve ter no máximo 254 caracteres.',
  PASSWORD_TOO_LONG: 'A senha deve ter no máximo 72 caracteres.',
  /**
   * O limite real do bcrypt e de 72 BYTES, e uma senha acentuada estoura os 72
   * bytes com menos de 72 caracteres — dai a mensagem separada, que explica o
   * motivo em vez de repetir um numero que o usuario ve como incorreto.
   */
  PASSWORD_TOO_LONG_IN_BYTES:
    'A senha é muito longa. Acentos e emojis ocupam mais de um caractere — use uma senha mais curta.',

  // --- Assunto do e-mail transacional ---
  CONFIRMATION_MAIL_SUBJECT: 'Confirme sua conta na CatDog',
} as const;
