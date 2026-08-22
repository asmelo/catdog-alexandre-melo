import type { PrismaClient } from '@prisma/client';

import {
  ConfirmationTokenAlreadyUsedError,
  ConfirmationTokenExpiredError,
  ConfirmationTokenInvalidError,
} from '~/domains/auth/errors/registration.errors';
import type { EmailConfirmationTokenRepository } from '~/domains/auth/repositories/email-confirmation-token.repository';
import type { UserRepository } from '~/domains/auth/repositories/user.repository';
import { now } from '~/utils/clock';
import { hashToken } from '~/utils/secure-token';

/**
 * HU-02 — confirmacao da conta pelo link do e-mail (RN-02, RN-03).
 */

/**
 * `maxWait` default do Prisma e 2 s, e o DATABASE_URL desta aplicacao usa o
 * pooler do Supabase com `connection_limit=1`: transacoes concorrentes
 * disputam UMA conexao e o excedente falhava com `P2028`, respondido como 500.
 * Esperar pela conexao e preferivel a recusar uma confirmacao valida.
 */
const OPCOES_DE_TRANSACAO = { maxWait: 10000, timeout: 15000 } as const;

export interface ConfirmEmailInput {
  /** Token em claro recebido do frontend; o banco guarda apenas o hash. */
  readonly token: string;
}

export class ConfirmEmailService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: EmailConfirmationTokenRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(entrada: ConfirmEmailInput): Promise<void> {
    const registro = await this.tokens.findByTokenHash(hashToken(entrada.token));

    if (registro === null) {
      throw new ConfirmationTokenInvalidError();
    }

    // A ORDEM importa e nao e arbitraria: "ja utilizado" e verificado ANTES de
    // "expirado" porque um token usado e depois vencido deve reportar o uso —
    // e a informacao acionavel ("sua conta ja esta ativa, faca login"), enquanto
    // "expirou, peca outro" mandaria o usuario a um reenvio que nada faria.
    if (registro.consumedAt !== null) {
      throw new ConfirmationTokenAlreadyUsedError();
    }

    const instante = now();

    if (registro.expiresAt.getTime() <= instante.getTime()) {
      throw new ConfirmationTokenExpiredError();
    }

    await this.prisma.$transaction(async (tx) => {
      const consumidos = await this.tokens.withTransaction(tx).consume(registro.id, instante);

      // `0` significa que outra requisicao consumiu o token entre a leitura
      // acima e este UPDATE (duplo clique no link). Tratar como "ja utilizado"
      // e o que garante exatamente um sucesso entre confirmacoes simultaneas.
      if (consumidos === 0) {
        throw new ConfirmationTokenAlreadyUsedError();
      }

      await this.users.withTransaction(tx).activate(registro.userId, instante);
    }, OPCOES_DE_TRANSACAO);
  }
}
