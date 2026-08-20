// Carrega o `.env` do diretorio do servico antes de qualquer leitura.
// Em producao (Render) o arquivo nao existe e o dotenv simplesmente nao faz nada:
// as variaveis vem do painel da plataforma.
import 'dotenv/config';

import { z } from 'zod';

/**
 * Ponto UNICO de leitura de `process.env` em todos os modulos do backend.
 * O `safeParse` roda no import: env invalida derruba o boot com mensagem
 * legivel em vez de propagar `undefined` silenciosamente em producao.
 */

const booleanoTextual = z
  .enum(['true', 'false'], {
    errorMap: () => ({ message: 'deve ser exatamente "true" ou "false"' }),
  })
  .transform((valor) => valor === 'true');

const listaDeOrigens = z
  .string()
  .min(1, 'deve conter ao menos uma origem')
  .transform((valor) =>
    valor
      .split(',')
      .map((origem) => origem.trim())
      .filter((origem) => origem.length > 0),
  )
  .refine((origens) => origens.length > 0, {
    message: 'deve conter ao menos uma origem valida',
  })
  .refine((origens) => !origens.includes('*'), {
    message: 'wildcard "*" e incompativel com CORS credentials: true',
  });

const envSchema = z.object({
  // --- Consumidas nesta task ---
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3333),
  DATABASE_URL: z.string().min(1, 'e obrigatoria'),
  DIRECT_URL: z.string().min(1, 'e obrigatoria'),
  CORS_ALLOWED_ORIGINS: listaDeOrigens,

  // --- Declaradas desde ja; consumidas nos slices seguintes ---
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'deve ter no minimo 32 caracteres')
    .optional(),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_ISSUER: z.string().min(1).default('catdog-api'),
  JWT_AUDIENCE: z.string().min(1).default('catdog-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  EMAIL_CONFIRMATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  BCRYPT_COST: z.coerce.number().int().min(4).max(20).default(12),
  APP_WEB_URL: z.string().url('deve ser uma URL valida').default('http://localhost:5173'),
  COOKIE_SECURE: booleanoTextual.default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(465),
  SMTP_SECURE: booleanoTextual.default('true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM_NAME: z.string().min(1).default('CatDog'),
  MAIL_FROM_ADDRESS: z.string().email('deve ser um e-mail valido').optional(),
  RATE_LIMIT_ENABLED: booleanoTextual.default('true'),
  SEED_ADMIN_EMAIL: z.string().email('deve ser um e-mail valido').optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8, 'deve ter no minimo 8 caracteres').optional(),
});

export type Env = z.infer<typeof envSchema>;

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  const detalhes = resultado.error.issues
    .map((problema) => {
      const variavel = problema.path.join('.') || '(raiz)';
      return `  - ${variavel}: ${problema.message}`;
    })
    .join('\n');

  throw new Error(
    `Variaveis de ambiente invalidas. Corrija as chaves abaixo em .env (referencia: .env.example):\n${detalhes}`,
  );
}

export const env: Readonly<Env> = Object.freeze(resultado.data);
