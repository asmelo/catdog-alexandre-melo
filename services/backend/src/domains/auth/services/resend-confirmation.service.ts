import { type PrismaClient, UserStatus } from '@prisma/client';

import { env } from '~/config/env';
import type { EmailConfirmationTokenRepository } from '~/domains/auth/repositories/email-confirmation-token.repository';
import type { UserRepository } from '~/domains/auth/repositories/user.repository';
import {
  logConfirmationMailFailure,
  type SendConfirmationMailService,
} from '~/domains/auth/services/send-confirmation-mail.service';
import { addHours, now } from '~/utils/clock';
import { generateOpaqueToken, hashToken } from '~/utils/secure-token';

/**
 * Reenvio do link de confirmacao. Existe porque a propria spec instrui o usuario
 * a "Solicite um novo e-mail de confirmacao" quando o link expira — sem este
 * endpoint, o cenario CT-07 nao teria saida.
 */

/** Mesma razao de `confirm-email.service.ts`: pooler com uma conexao so. */
const OPCOES_DE_TRANSACAO = { maxWait: 10000, timeout: 15000 } as const;

export interface ResendConfirmationInput {
  readonly email: string;
}

export class ResendConfirmationService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: EmailConfirmationTokenRepository,
    private readonly confirmationMail: SendConfirmationMailService,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * SEMPRE termina sem erro, envie ou nao. E-mail desconhecido e conta ja ativa
   * saem pela mesma porta da conta pendente: qualquer diferenca de status, corpo
   * ou mensagem transformaria o endpoint em verificador de e-mails cadastrados
   * (mesmo espirito da RN-05).
   */
  async execute(entrada: ResendConfirmationInput): Promise<void> {
    const usuario = await this.users.findByEmail(entrada.email);

    // Cobre os dois casos silenciosos de uma vez: conta inexistente
    // (`usuario` nulo) e conta que nao esta pendente de confirmacao.
    if (usuario?.status !== UserStatus.PENDING_CONFIRMATION) {
      return;
    }

    const rawToken = generateOpaqueToken();
    const instante = now();

    await this.prisma.$transaction(async (tx) => {
      const tokens = this.tokens.withTransaction(tx);

      // Invalida antes de emitir para que exista no maximo UM link valido por
      // conta: sem isso, cada reenvio deixaria mais um link vivo pelas 24 h
      // seguintes, multiplicando a superficie de um token vazado.
      await tokens.invalidatePendingByUser(usuario.id, instante);

      await tokens.create({
        userId: usuario.id,
        tokenHash: hashToken(rawToken),
        expiresAt: addHours(instante, env.EMAIL_CONFIRMATION_TTL_HOURS),
      });
    }, OPCOES_DE_TRANSACAO);

    await this.confirmationMail
      .execute({ name: usuario.name, email: usuario.email, rawToken })
      .catch(logConfirmationMailFailure(usuario.id));
  }
}
