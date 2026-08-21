import type { CorsOptions } from 'cors';

import { env } from '~/config/env';

/**
 * `credentials: true` e obrigatorio para o cookie httpOnly do refresh token e e
 * INCOMPATIVEL com `origin: '*'` — por isso a lista explicita de origens, que o
 * `env.ts` ja recusa no boot caso contenha o wildcard.
 *
 * `methods` e `allowedHeaders` sao declarados explicitamente para o preflight
 * responder apenas o que a API realmente usa, em vez do default permissivo do
 * pacote.
 */
export const corsOptions: CorsOptions = {
  origin: [...env.CORS_ALLOWED_ORIGINS],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
