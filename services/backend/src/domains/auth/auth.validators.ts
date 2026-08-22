import { z } from 'zod';

import { MESSAGES } from '~/domains/auth/auth.messages';

/**
 * Schemas de entrada das rotas de autenticacao. Sao a UNICA fronteira de
 * validacao: o `validateRequest` reatribui o resultado sobre `req.body`, entao
 * o que o controller entrega ao service ja esta validado e normalizado.
 */

/** O bcrypt trunca a senha em 72 BYTES — ver `passwordSchema`. */
const LIMITE_DE_BYTES_DO_BCRYPT = 72;

const TAMANHO_MINIMO_DO_TOKEN = 32;

/**
 * Campo de texto obrigatorio. O `required_error`/`invalid_type_error` existem
 * porque o default do Zod para campo ausente e o literal ingles "Required".
 */
function textoObrigatorio(): z.ZodString {
  return z.string({
    required_error: MESSAGES.FIELD_REQUIRED,
    invalid_type_error: MESSAGES.FIELD_REQUIRED,
  });
}

/**
 * `.pipe()` e nao mais um `.min()` na mesma cadeia: o Zod acumula cada um dos
 * problemas de uma cadeia de checks, entao um campo em branco sairia com duas
 * mensagens ("obrigatorio" e "minimo de 2 caracteres") no mesmo `field`. O pipe
 * curto-circuita — se o estagio 1 falha, o estagio 2 nao roda — e `details`
 * mantem uma mensagem por campo.
 */
const nameSchema = textoObrigatorio()
  .trim()
  .min(1, MESSAGES.FIELD_REQUIRED)
  .pipe(z.string().min(2, MESSAGES.NAME_TOO_SHORT).max(100, MESSAGES.NAME_TOO_LONG));

/**
 * PONTO UNICO de normalizacao do e-mail: `.trim()` + `.toLowerCase()` valem
 * para todas as rotas e o repositorio assume que o valor ja chega normalizado.
 * Sem isso, "ANA@Exemplo.com " criaria uma segunda conta ao lado de
 * "ana@exemplo.com" e a RN-13 cairia.
 *
 * Efeito colateral relevante para o e-mail transacional: `.email()` recusa
 * caracteres de controle, o que fecha a injecao de cabecalho SMTP (`\r\nBcc:`)
 * antes de o endereco chegar ao nodemailer.
 */
const emailSchema = textoObrigatorio()
  .trim()
  .toLowerCase()
  .min(1, MESSAGES.FIELD_REQUIRED)
  .pipe(z.string().max(254, MESSAGES.EMAIL_TOO_LONG).email(MESSAGES.EMAIL_INVALID));

/**
 * A senha NAO passa por `.trim()`: espaco e caractere valido de senha e apara-lo
 * mudaria silenciosamente o segredo escolhido pelo usuario.
 *
 * O limite duplo e proposital. `.max(72)` cumpre o contrato da task, mas conta
 * caracteres UTF-16, enquanto o bcrypt trunca em 72 BYTES — medido neste
 * projeto com bcrypt@6: uma senha de 72 caracteres "ç" (144 bytes) foi aceita e
 * seu hash casa com os 36 primeiros caracteres, ou seja, duas senhas diferentes
 * passariam a autenticar uma a outra. O `refine` em bytes fecha exatamente o
 * furo que o `.max(72)` pretendia fechar.
 */
const passwordSchema = textoObrigatorio()
  .min(1, MESSAGES.FIELD_REQUIRED)
  .pipe(
    z
      .string()
      .min(8, MESSAGES.PASSWORD_TOO_SHORT)
      .max(72, MESSAGES.PASSWORD_TOO_LONG)
      .refine(
        (valor) => Buffer.byteLength(valor, 'utf8') <= LIMITE_DE_BYTES_DO_BCRYPT,
        MESSAGES.PASSWORD_TOO_LONG_IN_BYTES,
      ),
  );

/** O token vai no corpo, nunca na URL: query string vaza em log de acesso. */
const tokenSchema = textoObrigatorio()
  .min(1, MESSAGES.FIELD_REQUIRED)
  .pipe(z.string().min(TAMANHO_MINIMO_DO_TOKEN, MESSAGES.CONFIRMATION_TOKEN_INVALID));

/**
 * Objeto que RECUSA campos nao declarados (RN-12: `confirmPassword` nunca e
 * aceito pelo servidor).
 *
 * Nao usa `.strict()`: o `unrecognized_keys` do Zod sai com `path: []`, e o
 * `validationErrorFromZodError` (TASK-BACKEND-002) faz `path.join('.')` — o
 * frontend receberia `details: [{ field: '', ... }]`, que nao marca nenhum
 * input. Com `.passthrough()` as chaves extras sobrevivem ao parse e o
 * `superRefine` emite UM problema por chave, com `path` preenchido. O
 * `.passthrough()` nao afrouxa nada: qualquer chave extra reprova a requisicao,
 * portanto nenhum corpo aprovado carrega chave fora da forma declarada.
 */
function objetoSemCamposExtras<Forma extends z.ZodRawShape>(forma: Forma) {
  return z
    .object(forma, {
      required_error: MESSAGES.REQUEST_BODY_INVALID,
      invalid_type_error: MESSAGES.REQUEST_BODY_INVALID,
    })
    .passthrough()
    .superRefine((valor, contexto) => {
      for (const chave of Object.keys(valor)) {
        if (!(chave in forma)) {
          contexto.addIssue({
            code: z.ZodIssueCode.unrecognized_keys,
            keys: [chave],
            path: [chave],
            message: MESSAGES.UNEXPECTED_FIELD,
          });
        }
      }
    });
}

export const registerSchema = objetoSemCamposExtras({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Confirmacao e reenvio usam `z.object` comum, que DESCARTA chaves extras em vez
 * de recusar: a exigencia de recusa e da RN-12, especifica do registro, e um 400
 * por campo ignorado atrapalharia clientes que anexem metadados.
 */
export const confirmEmailSchema = z.object({ token: tokenSchema });

export const resendConfirmationSchema = z.object({ email: emailSchema });

/**
 * Login. A senha e validada apenas como "preenchida": o `.min(8)` do cadastro NAO
 * se aplica aqui. Uma senha de 7 caracteres deve receber "E-mail ou senha
 * incorretos." como qualquer outra tentativa errada — devolver um erro de
 * validacao contando o tamanho minimo informaria a quem esta sondando qual e o
 * formato aceito pelo sistema, e para uma conta antiga com senha mais curta
 * bloquearia o login em vez de recusar a credencial.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: textoObrigatorio().min(1, MESSAGES.FIELD_REQUIRED),
});

/** Tipos derivam do schema: nenhum DTO duplicando a mesma forma. */
export type RegisterInput = z.infer<typeof registerSchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type ResendConfirmationInput = z.infer<typeof resendConfirmationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
