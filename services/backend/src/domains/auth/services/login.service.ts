import { randomUUID } from 'node:crypto';

import { UserStatus } from '@prisma/client';

import { env } from '~/config/env';
import {
  AccountNotConfirmedError,
  InvalidCredentialsError,
} from '~/domains/auth/errors/session.errors';
import {
  toAuthenticatedUser,
  type AuthenticatedUser,
} from '~/domains/auth/mappers/user.mapper';
import type { RefreshTokenRepository } from '~/domains/auth/repositories/refresh-token.repository';
import type { UserRepository } from '~/domains/auth/repositories/user.repository';
import { signAccessToken } from '~/domains/auth/tokens/access-token.service';
import { addDays, now } from '~/utils/clock';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '~/utils/password-hasher';
import { generateOpaqueToken, hashToken } from '~/utils/secure-token';

/**
 * HU-03 — login com emissao de access token e abertura de sessao (RN-01, RN-05).
 */

export interface LoginInput {
  /** Ja normalizado pelo `loginSchema` (minusculas, sem espacos nas pontas). */
  readonly email: string;
  readonly password: string;
}

/**
 * Resultado comum ao login e a renovacao. Declarado aqui, e nao duplicado no
 * `refresh-session.service`, porque e o mesmo contrato de API: os dois endpoints
 * respondem `{ accessToken, expiresIn, user }` e entregam o refresh token novo
 * pelo cookie.
 */
export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly user: AuthenticatedUser;
  /**
   * Refresh token em CLARO. Trafega somente do service ao controller, que o
   * transforma em cookie `HttpOnly`; o banco guarda apenas o hash e nenhuma
   * resposta HTTP o traz no corpo.
   */
  readonly refreshToken: string;
}

export class LoginService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(entrada: LoginInput): Promise<AuthenticatedSession> {
    const usuario = await this.users.findByEmail(entrada.email);

    // A comparacao roda SEMPRE, inclusive quando o e-mail nao existe, contra um
    // hash bcrypt fixo sem senha conhecida. Sem ela a resposta de "e-mail
    // inexistente" sairia em microssegundos e a de "senha errada" em ~220 ms:
    // as duas mensagens seriam identicas e o tempo denunciaria quais e-mails
    // estao cadastrados, deixando RN-05/RNF-03 cumpridas apenas na aparencia.
    const senhaConfere = await verifyPassword(
      entrada.password,
      usuario?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (usuario === null || !senhaConfere) {
      throw new InvalidCredentialsError();
    }

    // O status e verificado DEPOIS da senha, e a ordem e a propria regra de
    // seguranca: responder "conta nao confirmada" antes de conferir a senha
    // revelaria a existencia da conta a quem nao a conhece.
    if (usuario.status !== UserStatus.ACTIVE) {
      throw new AccountNotConfirmedError();
    }

    const rawToken = generateOpaqueToken();
    const instante = now();

    await this.refreshTokens.create({
      userId: usuario.id,
      // Sessao nova = familia nova. Reaproveitar a familia de um login anterior
      // faria um logout antigo derrubar a sessao recem-criada.
      familyId: randomUUID(),
      tokenHash: hashToken(rawToken),
      expiresAt: addDays(instante, env.REFRESH_TOKEN_TTL_DAYS),
    });

    const usuarioPublico = toAuthenticatedUser(usuario);

    return {
      ...signAccessToken(usuarioPublico),
      user: usuarioPublico,
      refreshToken: rawToken,
    };
  }
}
