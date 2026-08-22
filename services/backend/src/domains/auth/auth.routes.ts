import { Router } from 'express';

import { createAuthController } from '~/domains/auth/auth.controller';
import {
  confirmEmailSchema,
  registerSchema,
  resendConfirmationSchema,
} from '~/domains/auth/auth.validators';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de autenticacao, montadas em `/api/auth`. Login, refresh, logout e `me`
 * entram neste mesmo arquivo na TASK-BACKEND-005; o middleware de autenticacao e
 * o rate limit, na TASK-BACKEND-006 — ate lá estas tres rotas sao publicas e sem
 * throttling, por decisao de escopo.
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
