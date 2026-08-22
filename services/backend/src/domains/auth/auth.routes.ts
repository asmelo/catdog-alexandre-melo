import { Router } from 'express';

import { createAuthController } from '~/domains/auth/auth.controller';
import {
  confirmEmailSchema,
  loginSchema,
  registerSchema,
  resendConfirmationSchema,
} from '~/domains/auth/auth.validators';
import { authenticate } from '~/middlewares/authenticate.middleware';
import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  resendLimiter,
} from '~/middlewares/rate-limit.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de autenticacao, montadas em `/api/auth`.
 *
 * Ordem dos middlewares em toda rota de credencial: LIMITER antes do
 * `validateRequest`. A requisicao abusiva e barrada sem pagar o parsing do
 * schema, o hash da senha nem a ida ao banco — se a validacao viesse primeiro,
 * cada tentativa de forca bruta ainda custaria trabalho ao servidor, e um
 * atacante mandando corpo invalido de proposito nem seria contado.
 *
 * A consequencia dessa ordem esta tratada no `rate-limit.middleware.ts`: nesse
 * ponto o e-mail do corpo ainda NAO passou pelo `.toLowerCase()` do schema, e por
 * isso a chave do limiter normaliza o valor por conta propria.
 */

const controller = createAuthController();

export const authRoutes: Router = Router();

authRoutes.post(
  '/register',
  registerLimiter,
  validateRequest({ body: registerSchema }),
  controller.register,
);

/**
 * POST, e nao GET com o token na URL: um GET seria disparado pelo pre-fetch de
 * clientes de e-mail e por scanners de seguranca, consumindo o token de uso
 * unico ANTES do clique do usuario e produzindo um falso "link ja utilizado".
 *
 * Sem limiter: o token tem 256 bits de entropia e uso unico, entao nao ha o que
 * adivinhar por repeticao — e um limite aqui castigaria justamente o usuario que
 * clica duas vezes no link do e-mail.
 */
authRoutes.post(
  '/confirm-email',
  validateRequest({ body: confirmEmailSchema }),
  controller.confirmEmail,
);

authRoutes.post(
  '/confirmation/resend',
  resendLimiter,
  validateRequest({ body: resendConfirmationSchema }),
  controller.resendConfirmation,
);

authRoutes.post(
  '/login',
  loginLimiter,
  validateRequest({ body: loginSchema }),
  controller.login,
);

/**
 * Sem `validateRequest`: a credencial destas duas rotas e o cookie, nao o corpo.
 * Declarar um schema de corpo vazio faria um cliente que enviasse `{}` receber
 * 400 em vez do 401 generico, criando uma diferenca observavel sem nenhum ganho.
 */
authRoutes.post('/refresh', refreshLimiter, controller.refresh);

/**
 * Logout sem limiter de proposito: ele e idempotente, sempre responde 204 e
 * encerrar sessao e algo que se quer permitir sempre. Limitar aqui criaria o
 * cenario absurdo de impedir alguem de sair.
 */
authRoutes.post('/logout', controller.logout);

/**
 * Primeira rota protegida do projeto. So `authenticate`, sem `authorizeRole`:
 * ambas as roles consultam a si mesmas, e a rota nao aceita id de terceiro — o
 * usuario devolvido vem SEMPRE do token, nunca de parametro de caminho ou de
 * query, entao nao existe superficie de acesso ao usuario alheio.
 */
authRoutes.get('/me', authenticate, controller.me);
