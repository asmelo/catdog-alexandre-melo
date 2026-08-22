import type { Request, RequestHandler, Response } from 'express';

import { MESSAGES } from '~/domains/auth/auth.messages';
import type {
  ConfirmEmailInput,
  LoginInput,
  RegisterInput,
  ResendConfirmationInput,
} from '~/domains/auth/auth.validators';
import type { AuthenticatedUser } from '~/domains/auth/mappers/user.mapper';
import {
  PrismaEmailConfirmationTokenRepository,
} from '~/domains/auth/repositories/email-confirmation-token.repository';
import { PrismaRefreshTokenRepository } from '~/domains/auth/repositories/refresh-token.repository';
import { PrismaUserRepository } from '~/domains/auth/repositories/user.repository';
import {
  buildRefreshCookieOptions,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from '~/domains/auth/session-cookie';
import { ConfirmEmailService } from '~/domains/auth/services/confirm-email.service';
import {
  LoginService,
  type AuthenticatedSession,
} from '~/domains/auth/services/login.service';
import { LogoutService } from '~/domains/auth/services/logout.service';
import { RefreshSessionService } from '~/domains/auth/services/refresh-session.service';
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
 * erro. A unica excecao e o `refresh`, que precisa limpar o cookie ANTES de
 * deixar o erro seguir.
 */

/** Nenhuma rota deste slice tem parametro de caminho. */
type SemParametros = Record<string, never>;

interface RespostaComMensagem {
  readonly message: string;
}

/**
 * Corpo das respostas de sessao. O refresh token NAO aparece aqui: ele sai
 * exclusivamente no cookie `HttpOnly`, e o tipo e a garantia estatica disso.
 */
interface RespostaDeSessao {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly user: AuthenticatedUser;
}

/**
 * O tipo do corpo vem do `z.infer` do schema. A garantia em tempo de execucao e
 * do `validateRequest` montado na rota, que parseia e REATRIBUI `req.body` antes
 * do handler — declarar o generico e o que evita ler `req.body` como `any`.
 */
type Manipulador<Corpo> = RequestHandler<SemParametros, RespostaComMensagem, Corpo>;

/** Rotas de sessao: `refresh` e `logout` nao tem corpo, a credencial e o cookie. */
type ManipuladorDeSessao<Corpo> = RequestHandler<SemParametros, RespostaDeSessao, Corpo>;

/** Handler de resposta 204: `void` declara a ausencia de corpo no tipo. */
type ManipuladorSemCorpo = RequestHandler<SemParametros, void, unknown>;

/**
 * Leitura defensiva do cookie: `req.cookies` e tipado como `any` pelo Express e
 * deixar esse `any` entrar no fluxo apagaria a checagem de tipo do service.
 * Cookie ausente, vazio ou com valor nao textual viram `undefined`, que e
 * exatamente o caso que o service trata como sessao expirada.
 */
function lerCookieDeRefresh(requisicao: Request): string | undefined {
  const cookies: Record<string, unknown> | undefined = requisicao.cookies;
  const valor = cookies?.[REFRESH_COOKIE_NAME];

  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

/**
 * Entrega a sessao: refresh token no cookie, o resto no corpo. Compartilhado
 * pelo login e pelo refresh porque o contrato das duas respostas e identico.
 */
function responderComSessao(resposta: Response, sessao: AuthenticatedSession): void {
  resposta.cookie(REFRESH_COOKIE_NAME, sessao.refreshToken, buildRefreshCookieOptions());

  resposta.status(HTTP_STATUS.OK).json({
    accessToken: sessao.accessToken,
    expiresIn: sessao.expiresIn,
    user: sessao.user,
  });
}

/**
 * Dependencias em um objeto, e nao seis parametros posicionais: com o slice de
 * sessao a classe passou a orquestrar seis casos de uso, e uma lista posicional
 * desse tamanho e facil de trocar de ordem sem o compilador perceber (os tipos
 * de service sao estruturalmente distintos, mas a leitura no ponto de chamada
 * deixa de ser obvia).
 */
export interface AuthControllerDependencies {
  readonly registerUser: RegisterUserService;
  readonly confirmEmail: ConfirmEmailService;
  readonly resendConfirmation: ResendConfirmationService;
  readonly login: LoginService;
  readonly refreshSession: RefreshSessionService;
  readonly logout: LogoutService;
}

export class AuthController {
  constructor(private readonly services: AuthControllerDependencies) {}

  /**
   * Propriedades com arrow function, e nao metodos: `authRoutes.post(..., c.register)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   */
  readonly register: Manipulador<RegisterInput> = async (requisicao, resposta) => {
    await this.services.registerUser.execute(requisicao.body);

    // 201 sem corpo de recurso: a conta existe, mas nada dela e publico ainda —
    // e nenhum campo da resposta pode conter o token de confirmacao.
    resposta.status(HTTP_STATUS.CREATED).json({ message: MESSAGES.REGISTER_SUCCESS });
  };

  readonly confirmEmail: Manipulador<ConfirmEmailInput> = async (requisicao, resposta) => {
    await this.services.confirmEmail.execute(requisicao.body);

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
    await this.services.resendConfirmation.execute(requisicao.body);

    resposta.status(HTTP_STATUS.ACCEPTED).json({ message: MESSAGES.RESEND_GENERIC });
  };

  readonly login: ManipuladorDeSessao<LoginInput> = async (requisicao, resposta) => {
    const sessao = await this.services.login.execute(requisicao.body);

    responderComSessao(resposta, sessao);
  };

  /**
   * Em qualquer falha o cookie e REMOVIDO antes de o erro seguir para o handler
   * global. Sem isso o navegador guardaria um refresh token que o servidor ja
   * recusa e o cliente ficaria repetindo 401 em vez de ir para o login.
   */
  readonly refresh: ManipuladorDeSessao<unknown> = async (requisicao, resposta) => {
    const sessao = await this.services.refreshSession
      .execute({
        rawToken: lerCookieDeRefresh(requisicao),
        ip: requisicao.ip,
        userAgent: requisicao.get('user-agent'),
      })
      .catch((motivo: unknown) => {
        clearRefreshCookie(resposta);

        throw motivo;
      });

    responderComSessao(resposta, sessao);
  };

  /**
   * 204 sem corpo, e o cookie e limpo mesmo quando nao havia sessao a encerrar:
   * o resultado observavel do logout precisa ser o mesmo em qualquer estado.
   */
  readonly logout: ManipuladorSemCorpo = async (requisicao, resposta) => {
    await this.services.logout.execute(lerCookieDeRefresh(requisicao));

    clearRefreshCookie(resposta);

    resposta.status(HTTP_STATUS.NO_CONTENT).end();
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
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);
  const confirmationMail = new SendConfirmationMailService(
    () => new NodemailerMailer(createGmailTransport()),
  );

  return new AuthController({
    registerUser: new RegisterUserService(users, tokens, confirmationMail, prisma),
    confirmEmail: new ConfirmEmailService(users, tokens, prisma),
    resendConfirmation: new ResendConfirmationService(users, tokens, confirmationMail, prisma),
    login: new LoginService(users, refreshTokens),
    refreshSession: new RefreshSessionService(users, refreshTokens, prisma),
    logout: new LogoutService(refreshTokens),
  });
}
