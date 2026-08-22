import {
  RefreshTokenRevokedReason,
  UserStatus,
  type PrismaClient,
  type RefreshToken,
} from '@prisma/client';

import { env } from '~/config/env';
import { SessionExpiredError } from '~/domains/auth/errors/session.errors';
import { toAuthenticatedUser } from '~/domains/auth/mappers/user.mapper';
import type { RefreshTokenRepository } from '~/domains/auth/repositories/refresh-token.repository';
import type { UserRepository } from '~/domains/auth/repositories/user.repository';
import type { AuthenticatedSession } from '~/domains/auth/services/login.service';
import { signAccessToken } from '~/domains/auth/tokens/access-token.service';
import { addDays, now } from '~/utils/clock';
import { generateOpaqueToken, hashToken } from '~/utils/secure-token';

/**
 * HU-04 — renovacao da sessao com rotacao obrigatoria (RN-06) e derrubada da
 * familia inteira quando um token e reapresentado (RN-07).
 *
 * Qualquer desfecho de falha responde a MESMA `SessionExpiredError`: cookie ausente,
 * token desconhecido, vencido, conta desativada ou reuso detectado sao
 * indistinguiveis para o cliente, de proposito.
 */

/** Ver `confirm-email.service.ts`: o pooler do Supabase usa `connection_limit=1`. */
const OPCOES_DE_TRANSACAO = { maxWait: 10000, timeout: 15000 } as const;

export interface RefreshSessionInput {
  /** Valor bruto lido do cookie; ausente quando o navegador nao o enviou. */
  readonly rawToken: string | undefined;
  /** Metadados apenas para o log de auditoria do reuso — nunca para decidir. */
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
}

/**
 * Sinal interno de "perdi a corrida do compare-and-swap". Existe para abortar a
 * transacao (o `revokeFamily` do reuso precisa acontecer FORA dela, senao o
 * rollback desfaria a revogacao) e nao escapa deste arquivo.
 */
class RotacaoJaAplicada extends Error {}

export class RefreshSessionService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(entrada: RefreshSessionInput): Promise<AuthenticatedSession> {
    if (entrada.rawToken === undefined) {
      throw new SessionExpiredError();
    }

    const registro = await this.refreshTokens.findByTokenHash(hashToken(entrada.rawToken));

    // Token que nunca existiu (ou lixo no cookie): nao ha familia a revogar.
    if (registro === null) {
      throw new SessionExpiredError();
    }

    // RN-07 — reuso. Vale para QUALQUER motivo de revogacao, `ROTATED` incluido:
    // um token ja trocado so pode reaparecer se alguem guardou uma copia, e a
    // resposta correta e derrubar a sessao inteira em vez de tentar adivinhar se
    // o portador e a vitima ou o atacante.
    if (registro.revokedAt !== null) {
      await this.derrubarPorReuso(registro, entrada);
      throw new SessionExpiredError();
    }

    const instante = now();

    if (registro.expiresAt.getTime() <= instante.getTime()) {
      // Revoga so este token, e nao a familia: vencimento e fim de vida normal,
      // nao indicio de roubo.
      await this.refreshTokens.revokeById(
        registro.id,
        RefreshTokenRevokedReason.EXPIRED,
        instante,
      );
      throw new SessionExpiredError();
    }

    const usuario = await this.users.findById(registro.userId);

    if (usuario?.status !== UserStatus.ACTIVE) {
      await this.refreshTokens.revokeFamily(
        registro.familyId,
        RefreshTokenRevokedReason.ACCOUNT_DISABLED,
        instante,
      );
      throw new SessionExpiredError();
    }

    const rawToken = generateOpaqueToken();

    await this.rotacionar(registro, rawToken, instante, entrada);

    const usuarioPublico = toAuthenticatedUser(usuario);

    return {
      ...signAccessToken(usuarioPublico),
      user: usuarioPublico,
      refreshToken: rawToken,
    };
  }

  /**
   * Substitui o token apresentado por um novo da MESMA familia, em transacao.
   *
   * A ordem — criar o novo e so depois marcar o antigo como `ROTATED` — e
   * proposital: o `markRotated` grava `replacedById`, que e `@unique`, e assim o
   * id ja existe sem precisar gerar uuid a mao nem fazer uma segunda escrita na
   * mesma coluna. Se o compare-and-swap nao alterar nenhuma linha, a transacao
   * aborta e o token recem-criado desaparece com o rollback.
   *
   * O vencimento e recalculado a cada rotacao (TTL deslizante): e o que sustenta
   * "o usuario permanece logado enquanto usa o sistema" da HU-04.
   */
  private async rotacionar(
    registro: RefreshToken,
    rawToken: string,
    instante: Date,
    entrada: RefreshSessionInput,
  ): Promise<void> {
    await this.prisma
      .$transaction(async (tx) => {
        const tokens = this.refreshTokens.withTransaction(tx);

        const novo = await tokens.create({
          userId: registro.userId,
          familyId: registro.familyId,
          tokenHash: hashToken(rawToken),
          expiresAt: addDays(instante, env.REFRESH_TOKEN_TTL_DAYS),
        });

        const rotacionados = await tokens.markRotated(registro.id, novo.id, instante);

        if (rotacionados === 0) {
          throw new RotacaoJaAplicada();
        }
      }, OPCOES_DE_TRANSACAO)
      .catch(async (motivo: unknown) => {
        // Perder a corrida significa que o token foi rotacionado por outra
        // requisicao enquanto esta o processava — do ponto de vista do servidor,
        // e exatamente a mesma evidencia do reuso, e recebe o mesmo tratamento.
        if (motivo instanceof RotacaoJaAplicada) {
          await this.derrubarPorReuso(registro, entrada);
          throw new SessionExpiredError();
        }

        throw motivo;
      });
  }

  /**
   * Revoga em um comando cada token ativo da familia e registra a ocorrencia.
   *
   * O log alimenta a metrica de auditoria prevista na spec e e a unica pista que
   * o time tem de um token vazado, ja que a resposta ao cliente e generica.
   * Registra `userId`/`familyId` e os metadados da requisicao — nunca o token,
   * nem em claro nem por hash.
   */
  private async derrubarPorReuso(
    registro: RefreshToken,
    entrada: RefreshSessionInput,
  ): Promise<void> {
    const revogados = await this.refreshTokens.revokeFamily(
      registro.familyId,
      RefreshTokenRevokedReason.REUSE_DETECTED,
      now(),
    );

    console.warn('[catdog-backend] Reutilizacao de refresh token detectada:', {
      evento: 'refresh_token_reuse_detected',
      userId: registro.userId,
      familyId: registro.familyId,
      ip: entrada.ip,
      userAgent: entrada.userAgent,
      tokensRevogados: revogados,
    });
  }
}
