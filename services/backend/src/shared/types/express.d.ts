import type { AuthRole } from '~/domains/auth/mappers/user.mapper';

/**
 * Augmentacao do tipo `Request` do Express com o usuario autenticado.
 *
 * O arquivo entra no programa pelo `include` do `tsconfig` (o glob de `src`
 * ja casa `.d.ts`) e termina com `export {}` para ser tratado como MODULO. Sem
 * isso o `declare global` conviveria com um script global e a augmentacao nao
 * seria aplicada: `req.authUser` viraria erro de compilacao e a "solucao" obvia
 * seria um `as any` no middleware, que o projeto proibe.
 *
 * Nada e emitido para o `dist`: `declaration: false` esta ligado e arquivo
 * `.d.ts` de entrada nao gera saida.
 */

/**
 * Identidade extraida do access token. Guarda EXATAMENTE o que a claim carrega
 * (`sub` e `role`) e nada mais: acrescentar nome, e-mail ou status faria de
 * `req.authUser` um cache implicito do usuario, valido pelos 15 minutos do token
 * e sem invalidacao — um usuario renomeado ou desativado continuaria sendo lido
 * com os dados do instante em que o token foi assinado.
 *
 * `AuthRole` e reusado de `user.mapper` de proposito: o vocabulario
 * `admin`/`cliente` fica declarado uma unica vez no projeto (`AUTH_ROLES`) e e o
 * mesmo que o schema de claims do JWT valida.
 */
export interface AuthUser {
  readonly id: string;
  readonly role: AuthRole;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Preenchido APENAS pelo `authenticate.middleware`. Opcional porque a
       * maioria das rotas e publica: quem depende da identidade precisa
       * estreitar o `undefined`, e e esse estreitamento que faz o `authorizeRole`
       * montado sem o `authenticate` antes dele virar 401 em vez de acesso livre.
       */
      authUser?: AuthUser;
    }
  }
}

export {};
