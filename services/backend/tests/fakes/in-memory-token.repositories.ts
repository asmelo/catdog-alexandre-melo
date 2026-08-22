import {
  Prisma,
  RefreshTokenRevokedReason,
  type EmailConfirmationToken,
  type RefreshToken,
} from '@prisma/client';

import type {
  CreateEmailConfirmationTokenInput,
  EmailConfirmationTokenRepository,
} from '~/domains/auth/repositories/email-confirmation-token.repository';
import type {
  CreateRefreshTokenInput,
  RefreshTokenRepository,
} from '~/domains/auth/repositories/refresh-token.repository';

import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Dublês em memória de `email_confirmation_tokens` e `refresh_tokens`, escritos
 * contra as INTERFACES dos repositórios.
 *
 * A fidelidade que importa aqui não é guardar linhas — é reproduzir a CONTAGEM de
 * linhas alteradas do compare-and-swap. `consume` e `markRotated` devolvem `0`
 * quando o registro já estava consumido/revogado, e é só essa contagem que
 * impede a rotação dupla e a confirmação dupla sob concorrência. Um dublê que
 * devolvesse `1` sempre faria a suíte inteira passar com a produção quebrada.
 */

const INSTANTE_DE_CRIACAO = new Date('2026-01-01T00:00:00.000Z');

function erroDeTokenDuplicado(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`token_hash`)',
    {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['tokenHash'] },
    },
  );
}

// --------------------------------------------------------------------------
// email_confirmation_tokens
// --------------------------------------------------------------------------

export interface DadosDeTokenDeConfirmacao {
  readonly id?: string;
  readonly userId?: string;
  readonly tokenHash?: string;
  readonly expiresAt?: Date;
  readonly consumedAt?: Date | null;
}

export function montarTokenDeConfirmacao(
  dados: DadosDeTokenDeConfirmacao,
): EmailConfirmationToken {
  return {
    id: dados.id ?? proximoUuid(),
    userId: dados.userId ?? proximoUuid(),
    tokenHash: dados.tokenHash ?? proximoUuid(),
    expiresAt: dados.expiresAt ?? new Date('2026-01-02T00:00:00.000Z'),
    consumedAt: dados.consumedAt ?? null,
    createdAt: INSTANTE_DE_CRIACAO,
  };
}

export class ArmazemDeTokensDeConfirmacao implements Restauravel {
  private registros: EmailConfirmationToken[] = [];

  get linhas(): ReadonlyArray<EmailConfirmationToken> {
    return this.registros;
  }

  limpar(): void {
    this.registros = [];
  }

  semear(dados: DadosDeTokenDeConfirmacao): EmailConfirmationToken {
    const token = montarTokenDeConfirmacao(dados);

    this.registros.push(token);

    return token;
  }

  criar(dados: CreateEmailConfirmationTokenInput): EmailConfirmationToken {
    if (this.buscarPorHash(dados.tokenHash) !== null) {
      throw erroDeTokenDuplicado();
    }

    return this.semear(dados);
  }

  buscarPorHash(tokenHash: string): EmailConfirmationToken | null {
    return this.registros.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  /**
   * Compare-and-swap: só altera o registro AINDA pendente. A contagem devolvida é
   * o que o `confirm-email.service.ts` interpreta como "perdi a corrida do duplo
   * clique no link" e traduz em "este link já foi utilizado".
   */
  consumir(id: string, consumedAt: Date): number {
    return this.marcarConsumidos(
      (token) => token.id === id && token.consumedAt === null,
      consumedAt,
    );
  }

  invalidarPendentesDoUsuario(userId: string, invalidatedAt: Date): number {
    return this.marcarConsumidos(
      (token) => token.userId === userId && token.consumedAt === null,
      invalidatedAt,
    );
  }

  private marcarConsumidos(
    alcanca: (token: EmailConfirmationToken) => boolean,
    consumedAt: Date,
  ): number {
    let alteradas = 0;

    this.registros = this.registros.map((token) => {
      if (!alcanca(token)) {
        return token;
      }

      alteradas += 1;

      return { ...token, consumedAt };
    });

    return alteradas;
  }

  capturarEstado(): () => void {
    const copia = [...this.registros];

    return () => {
      this.registros = copia;
    };
  }
}

export class InMemoryEmailConfirmationTokenRepository
  implements EmailConfirmationTokenRepository
{
  constructor(private readonly armazem: ArmazemDeTokensDeConfirmacao) {}

  create(data: CreateEmailConfirmationTokenInput): Promise<EmailConfirmationToken> {
    return comoPromessa(() => this.armazem.criar(data));
  }

  findByTokenHash(tokenHash: string): Promise<EmailConfirmationToken | null> {
    return comoPromessa(() => this.armazem.buscarPorHash(tokenHash));
  }

  consume(id: string, consumedAt: Date): Promise<number> {
    return comoPromessa(() => this.armazem.consumir(id, consumedAt));
  }

  invalidatePendingByUser(userId: string, invalidatedAt: Date): Promise<number> {
    return comoPromessa(() =>
      this.armazem.invalidarPendentesDoUsuario(userId, invalidatedAt),
    );
  }

  withTransaction(): EmailConfirmationTokenRepository {
    return this;
  }
}

// --------------------------------------------------------------------------
// refresh_tokens
// --------------------------------------------------------------------------

export interface DadosDeRefreshToken {
  readonly id?: string;
  readonly userId?: string;
  readonly familyId?: string;
  readonly tokenHash?: string;
  readonly expiresAt?: Date;
  readonly revokedAt?: Date | null;
  readonly revokedReason?: RefreshTokenRevokedReason | null;
  readonly replacedById?: string | null;
}

export function montarRefreshToken(dados: DadosDeRefreshToken): RefreshToken {
  return {
    id: dados.id ?? proximoUuid(),
    userId: dados.userId ?? proximoUuid(),
    familyId: dados.familyId ?? proximoUuid(),
    tokenHash: dados.tokenHash ?? proximoUuid(),
    expiresAt: dados.expiresAt ?? new Date('2026-01-08T00:00:00.000Z'),
    createdAt: INSTANTE_DE_CRIACAO,
    revokedAt: dados.revokedAt ?? null,
    revokedReason: dados.revokedReason ?? null,
    replacedById: dados.replacedById ?? null,
  };
}

export class ArmazemDeRefreshTokens implements Restauravel {
  private registros: RefreshToken[] = [];

  get linhas(): ReadonlyArray<RefreshToken> {
    return this.registros;
  }

  limpar(): void {
    this.registros = [];
  }

  semear(dados: DadosDeRefreshToken): RefreshToken {
    const token = montarRefreshToken(dados);

    this.registros.push(token);

    return token;
  }

  daFamilia(familyId: string): ReadonlyArray<RefreshToken> {
    return this.registros.filter((token) => token.familyId === familyId);
  }

  criar(dados: CreateRefreshTokenInput): RefreshToken {
    if (this.buscarPorHash(dados.tokenHash) !== null) {
      throw erroDeTokenDuplicado();
    }

    return this.semear(dados);
  }

  buscarPorHash(tokenHash: string): RefreshToken | null {
    return this.registros.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  revogarPorId(id: string, reason: RefreshTokenRevokedReason, revokedAt: Date): number {
    return this.revogar((token) => token.id === id, { reason, revokedAt });
  }

  /**
   * O filtro `revokedAt === null` é o MESMO do `PrismaRefreshTokenRepository`, e
   * reproduzi-lo é o ponto do dublê: quem já estava revogado PRESERVA o motivo
   * original (um `LOGOUT` não vira `REUSE_DETECTED`), e o token que disparou a
   * detecção de reuso continua `ROTATED` porque o `where` não o alcança.
   */
  revogarFamilia(
    familyId: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): number {
    return this.revogar((token) => token.familyId === familyId, { reason, revokedAt });
  }

  /**
   * Compare-and-swap da rotação. Grava `replacedById` na MESMA escrita que
   * `revokedAt`, como o repositório real, e devolve `0` se o token já não estava
   * ativo — a contagem que garante uma rotação por token.
   */
  marcarRotacionado(id: string, replacedById: string, revokedAt: Date): number {
    return this.revogar((token) => token.id === id, {
      reason: RefreshTokenRevokedReason.ROTATED,
      revokedAt,
      replacedById,
    });
  }

  private revogar(
    alcanca: (token: RefreshToken) => boolean,
    dados: {
      readonly reason: RefreshTokenRevokedReason;
      readonly revokedAt: Date;
      readonly replacedById?: string;
    },
  ): number {
    let alteradas = 0;

    this.registros = this.registros.map((token) => {
      if (!alcanca(token) || token.revokedAt !== null) {
        return token;
      }

      alteradas += 1;

      return {
        ...token,
        revokedAt: dados.revokedAt,
        revokedReason: dados.reason,
        replacedById: dados.replacedById ?? token.replacedById,
      };
    });

    return alteradas;
  }

  capturarEstado(): () => void {
    const copia = [...this.registros];

    return () => {
      this.registros = copia;
    };
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly armazem: ArmazemDeRefreshTokens) {}

  create(data: CreateRefreshTokenInput): Promise<RefreshToken> {
    return comoPromessa(() => this.armazem.criar(data));
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return comoPromessa(() => this.armazem.buscarPorHash(tokenHash));
  }

  revokeById(
    id: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number> {
    return comoPromessa(() => this.armazem.revogarPorId(id, reason, revokedAt));
  }

  revokeFamily(
    familyId: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number> {
    return comoPromessa(() => this.armazem.revogarFamilia(familyId, reason, revokedAt));
  }

  markRotated(id: string, replacedById: string, revokedAt: Date): Promise<number> {
    return comoPromessa(() => this.armazem.marcarRotacionado(id, replacedById, revokedAt));
  }

  withTransaction(): RefreshTokenRepository {
    return this;
  }
}
