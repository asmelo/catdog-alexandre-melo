import { decode, sign, verify, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '~/config/env';
import { AUTH_ROLES, type AuthRole } from '~/domains/auth/mappers/user.mapper';

/**
 * UNICO arquivo do projeto autorizado a importar `jsonwebtoken`.
 *
 * O isolamento cumpre um criterio de aceite explicito da task e tem razao
 * pratica: trocar a biblioteca (ou migrar HS256 para chave assimetrica) custa a
 * edicao deste arquivo e de mais nenhum, porque o resto do sistema so conhece
 * `SignedAccessToken` e `AccessTokenClaims`.
 */

/**
 * O access token NAO leva `email` nem `name`: o JWT viaja em cada requisicao,
 * costuma parar em log de proxy e e legivel por qualquer um que o intercepte.
 * O frontend hidrata nome e e-mail pelo corpo do login/refresh, que trafega uma
 * vez sobre TLS.
 */
const TIPO_DE_TOKEN_DE_ACESSO = 'access';

const claimsSchema = z.object({
  /** UUID do usuario, gravado pela opcao `subject` do `sign`. */
  sub: z.string().min(1),
  role: z.enum(AUTH_ROLES),
  /**
   * Discriminador de finalidade. Verificado no `verify` e recusado se divergir:
   * sem ele, qualquer outro token assinado com o mesmo segredo (um futuro token
   * de troca de senha, por exemplo) seria aceito como credencial de acesso.
   */
  typ: z.literal(TIPO_DE_TOKEN_DE_ACESSO),
  iss: z.string().min(1),
  aud: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AccessTokenClaims = z.infer<typeof claimsSchema>;

/** Recorte minimo que a assinatura precisa: nada mais entra no token. */
export interface AccessTokenSubject {
  readonly id: string;
  readonly role: AuthRole;
}

export interface SignedAccessToken {
  readonly accessToken: string;
  /** Vida util em SEGUNDOS, exigida no corpo da resposta pelo contrato da API. */
  readonly expiresIn: number;
}

/** Apenas os dois instantes, para derivar `expiresIn` do token recem-assinado. */
const instantesSchema = z.object({ iat: z.number().int(), exp: z.number().int() });

/**
 * Formato de duracao aceito pelo `ms`, que e quem o `jsonwebtoken` usa para
 * interpretar `expiresIn`. Mantido alinhado com a regex do proprio `ms`.
 */
const FORMATO_DE_DURACAO =
  /^-?\d*\.?\d+ ?(years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms)?$/i;

/**
 * O tipo textual que o `SignOptions` aceita e um literal template (`"15m"`,
 * `"7 days"`, ...), nao `string`. Extraido do proprio tipo da biblioteca para
 * que uma mudanca dela apareca aqui como erro de compilacao.
 */
type DuracaoTextual = Extract<NonNullable<SignOptions['expiresIn']>, string>;

function ehDuracaoTextual(valor: string): valor is DuracaoTextual {
  return FORMATO_DE_DURACAO.test(valor);
}

/**
 * `env.JWT_ACCESS_TTL` chega como `string` livre. A validacao aqui e de verdade,
 * nao um cast: um TTL escrito errado no `.env` (`"15min"`, `"quinze"`) faria o
 * `ms` devolver `undefined` e o `jsonwebtoken` assinar um token SEM `exp`, isto
 * e, um access token eterno. Falhar alto e o comportamento correto.
 */
function duracaoDoAccessToken(): DuracaoTextual {
  const ttl = env.JWT_ACCESS_TTL;

  if (!ehDuracaoTextual(ttl)) {
    throw new Error(
      `JWT_ACCESS_TTL tem valor invalido (${ttl}): use uma duracao no formato do "ms", como "15m" ou "900s". Corrija a variavel em .env (referencia: .env.example).`,
    );
  }

  return ttl;
}

/**
 * `JWT_ACCESS_SECRET` e declarada como opcional no `src/config/env.ts` (arquivo
 * de outro slice, fora da tabela de arquivos desta task), entao o tipo que chega
 * aqui e `string | undefined` e o `sign` exige `string`. O estreitamento e feito
 * com verificacao explicita — sem `!`, sem `as` — e a mensagem NOMEIA a variavel
 * ausente, porque este e o unico ponto do sistema em que a falta dela importa.
 */
function segredoDeAssinatura(): string {
  const segredo = env.JWT_ACCESS_SECRET;

  if (segredo === undefined) {
    throw new Error(
      'JWT_ACCESS_SECRET nao esta definida: sem ela nenhum token de acesso pode ser assinado nem verificado. Defina a variavel em .env (referencia: .env.example) com no minimo 32 caracteres.',
    );
  }

  return segredo;
}

/**
 * `expiresIn` do corpo da resposta e derivado do PROPRIO token assinado
 * (`exp - iat`), e nao de um parser de duracao escrito a mao. Assim o numero
 * publicado e exatamente a validade que o `jsonwebtoken` gravou: um parser
 * paralelo poderia divergir do `ms` e o frontend agendaria a renovacao para
 * depois do vencimento real.
 */
function vidaUtilEmSegundos(token: string): number {
  const conteudo: unknown = decode(token);
  const resultado = instantesSchema.safeParse(conteudo);

  if (!resultado.success) {
    throw new Error('Token de acesso assinado sem os instantes `iat`/`exp`.');
  }

  return resultado.data.exp - resultado.data.iat;
}

export function signAccessToken(user: AccessTokenSubject): SignedAccessToken {
  const accessToken = sign(
    { role: user.role, typ: TIPO_DE_TOKEN_DE_ACESSO },
    segredoDeAssinatura(),
    {
      algorithm: 'HS256',
      subject: user.id,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: duracaoDoAccessToken(),
    },
  );

  return { accessToken, expiresIn: vidaUtilEmSegundos(accessToken) };
}

/**
 * Consumido pelo middleware `authenticate` da TASK-BACKEND-006.
 *
 * `issuer` e `audience` sao verificados explicitamente, e nao apenas a
 * assinatura: um token emitido por outro ambiente que compartilhe o segredo
 * (staging apontando para o mesmo valor de `.env`) seria criptograficamente
 * valido e ainda assim ilegitimo aqui.
 *
 * Qualquer excecao lancada por esta funcao — do `jsonwebtoken` ou do contrato de
 * claims — significa credencial invalida e deve ser traduzida em 401 por quem
 * chama; ela nao conhece HTTP de proposito.
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const conteudo: unknown = verify(token, segredoDeAssinatura(), {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  const resultado = claimsSchema.safeParse(conteudo);

  if (!resultado.success) {
    throw new Error('Token de acesso com claims fora do contrato esperado.');
  }

  return resultado.data;
}
