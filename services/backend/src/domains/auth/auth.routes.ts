import { Router } from 'express';

import { createAuthController } from '~/domains/auth/auth.controller';
import {
  confirmEmailSchema,
  loginSchema,
  registerSchema,
  resendConfirmationSchema,
} from '~/domains/auth/auth.validators';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de autenticacao, montadas em `/api/auth`. O `GET /me`, o middleware de
 * autenticacao e o rate limit entram na TASK-BACKEND-006 — ate lá estas seis
 * rotas sao publicas e sem throttling, por decisao de escopo.
 */

const controller = createAuthController();

export const authRoutes: Router = Router();

authRoutes.post(
  '/register',
  validateRequest({ body: registerSchema }),
  controller.register,
);

/**
 * POST, e nao GET com o token na URL: um GET seria disparado pelo pre-fetch de
 * clientes de e-mail e por scanners de seguranca, consumindo o token de uso
 * unico ANTES do clique do usuario e produzindo um falso "link ja utilizado".
 */
authRoutes.post(
  '/confirm-email',
  validateRequest({ body: confirmEmailSchema }),
  controller.confirmEmail,
);

authRoutes.post(
  '/confirmation/resend',
  validateRequest({ body: resendConfirmationSchema }),
  controller.resendConfirmation,
);

authRoutes.post('/login', validateRequest({ body: loginSchema }), controller.login);

/**
 * Sem `validateRequest`: a credencial destas duas rotas e o cookie, nao o corpo.
 * Declarar um schema de corpo vazio faria um cliente que enviasse `{}` receber
 * 400 em vez do 401 generico, criando uma diferenca observavel sem nenhum ganho.
 */
authRoutes.post('/refresh', controller.refresh);

authRoutes.post('/logout', controller.logout);
