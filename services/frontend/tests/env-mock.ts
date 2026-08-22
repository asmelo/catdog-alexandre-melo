import type { Env } from '~/config/env';

/**
 * Dublê de `~/config/env` para a suite (ver `moduleNameMapper` do
 * `jest.config.ts`).
 *
 * Existe porque `import.meta` e ERRO DE SINTAXE sob a transformacao CommonJS do
 * `@babel/preset-env`: o modulo real nao chega a ser avaliado, ele falha ao ser
 * transformado. Nenhum `jest.mock` resolveria isso, porque o erro acontece antes
 * de qualquer mock existir.
 *
 * A ANOTACAO `Env` NAO E DECORATIVA — e a unica coisa que impede o defeito mais
 * perigoso deste arquivo: um dublê com forma diferente do modulo real deixa a
 * suite inteira passar e a aplicacao quebrar em producao. Com o tipo importado do
 * proprio modulo, acrescentar um campo em `src/config/env.ts` faz o
 * `npm run typecheck` (projeto `tsconfig.test.json`) reprovar AQUI, em vez de a
 * divergencia aparecer no deploy.
 *
 * O valor `/api` e o mesmo default do modulo real, entao as asserções sobre URL
 * nos specs (`/api/auth/login`, `/api/auth/refresh`) descrevem exatamente o que o
 * navegador emitiria em desenvolvimento.
 */
export const env: Env = Object.freeze({
  apiBaseUrl: '/api',
});
