import { RefreshTokenRevokedReason } from '@prisma/client';

import type { RefreshTokenRepository } from '~/domains/auth/repositories/refresh-token.repository';
import { now } from '~/utils/clock';
import { hashToken } from '~/utils/secure-token';

/**
 * Encerramento de sessao. Idempotente por contrato: sem cookie, com cookie
 * desconhecido ou com a familia ja revogada, o resultado e o mesmo `204`.
 *
 * Nao ha nada a informar ao cliente em nenhum desses casos — dizer "esse token
 * nao existe" so entregaria informacao a quem esta sondando.
 */
export class LogoutService {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(rawToken: string | undefined): Promise<void> {
    if (rawToken === undefined) {
      return;
    }

    const registro = await this.refreshTokens.findByTokenHash(hashToken(rawToken));

    if (registro === null) {
      return;
    }

    // Revoga a familia, e nao apenas o token apresentado: encerrar a sessao
    // significa que nenhum elo da cadeia de rotacao pode continuar renovando.
    // O filtro `revokedAt: null` do repositorio preserva o motivo original de
    // quem ja estava revogado, entao um segundo logout altera zero linhas e
    // ainda responde 204.
    await this.refreshTokens.revokeFamily(
      registro.familyId,
      RefreshTokenRevokedReason.LOGOUT,
      now(),
    );
  }
}
