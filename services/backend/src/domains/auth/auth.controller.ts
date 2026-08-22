import type { RequestHandler } from 'express';

import { MESSAGES } from '~/domains/auth/auth.messages';
import type {
  ConfirmEmailInput,
  RegisterInput,
  ResendConfirmationInput,
} from '~/domains/auth/auth.validators';
import {
  PrismaEmailConfirmationTokenRepository,
} from '~/domains/auth/repositories/email-confirmation-token.repository';
import { PrismaUserRepository } from '~/domains/auth/repositories/user.repository';
import { ConfirmEmailService } from '~/domains/auth/services/confirm-email.service';
import { RegisterUserService } from '~/domains/auth/services/register-user.service';
import { ResendConfirmationService } from '~/domains/auth/services/resend-confirmation.service';
import { SendConfirmationMailService } from '~/domains/auth/services/send-confirmation-mail.service';
import { createGmailTransport, NodemailerMailer } from '~/infra/mail/nodemailer-mailer';
import { prisma } from '~/infra/prisma/prisma-client';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Camada HTTP do dominio auth: le a requisicao, chama UM service e responde.
 * Nenhum acesso a Prisma e nenhuma regra de negocio aqui.
 *
 * Sem `try/catch`: o `express-async-errors` (ligado no `app.ts`) encaminha a
 * rejeicao ao error handler, que e o unico ponto autorizado a montar resposta de
 * erro.
 */

/** Nenhuma rota deste slice tem parametro de caminho. */
type SemParametros = Record<string, never>;

interface RespostaComMensagem {
  readonly message: string;
}

/**
 * O tipo do corpo vem do `z.infer` do schema. A garantia em tempo de execucao e
 * do `validateRequest` montado na rota, que parseia e REATRIBUI `req.body` antes
 * do handler — declarar o generico e o que evita ler `req.body` como `any`.
 */
type Manipulador<Corpo> = RequestHandler<SemParametros, RespostaComMensagem, Corpo>;

export class AuthController {
  // Os campos injetados levam o sufixo `Service` porque os handlers ocupam os
  // nomes `confirmEmail`/`resendConfirmation` na mesma classe.
  constructor(
    private readonly registerUser: RegisterUserService,
    private readonly confirmEmailService: ConfirmEmailService,
    private readonly resendConfirmationService: ResendConfirmationService,
  ) {}

  /**
   * Propriedades com arrow function, e nao metodos: `authRoutes.post(..., c.register)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   */
  readonly register: Manipulador<RegisterInput> = async (requisicao, resposta) => {
    await this.registerUser.execute(requisicao.body);

    // 201 sem corpo de recurso: a conta existe, mas nada dela e publico ainda —
    // e nenhum campo da resposta pode conter o token de confirmacao.
    resposta.status(HTTP_STATUS.CREATED).json({ message: MESSAGES.REGISTER_SUCCESS });
  };

  readonly confirmEmail: Manipulador<ConfirmEmailInput> = async (requisicao, resposta) => {
    await this.confirmEmailService.execute(requisicao.body);

    resposta.status(HTTP_STATUS.OK).json({ message: MESSAGES.CONFIRMATION_SUCCESS });
  };

  /**
   * 202 e nao 200: o servidor aceitou o pedido e a entrega do e-mail acontece
   * fora do ciclo da requisicao. A mensagem e a mesma para conta pendente,
   * inexistente ou ja ativa.
   */
  readonly resendConfirmation: Manipulador<ResendConfirmationInput> = async (
    requisicao,
    resposta,
  ) => {
    await this.resendConfirmationService.execute(requisicao.body);

    resposta.status(HTTP_STATUS.ACCEPTED).json({ message: MESSAGES.RESEND_GENERIC });
  };
}

/**
 * Fabrica de composicao, executada UMA vez no import das rotas. Instanciar
 * repositorio e service dentro do handler recriaria o grafo em cada requisicao.
 *
 * O mailer entra como fabrica preguicosa: assim o import nao exige SMTP
 * configurado e o backend continua subindo em desenvolvimento sem conta de
 * e-mail (ver `send-confirmation-mail.service.ts`).
 */
export function createAuthController(): AuthController {
  const users = new PrismaUserRepository(prisma);
  const tokens = new PrismaEmailConfirmationTokenRepository(prisma);
  const confirmationMail = new SendConfirmationMailService(
    () => new NodemailerMailer(createGmailTransport()),
  );

  return new AuthController(
    new RegisterUserService(users, tokens, confirmationMail, prisma),
    new ConfirmEmailService(users, tokens, prisma),
    new ResendConfirmationService(users, tokens, confirmationMail, prisma),
  );
}
