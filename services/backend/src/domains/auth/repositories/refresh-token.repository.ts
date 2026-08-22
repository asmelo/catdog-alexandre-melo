import { RefreshTokenRevokedReason, type Prisma, type RefreshToken } from '@prisma/client';

/**
 * Porta de acesso a `refresh_tokens`. Guarda apenas o SHA-256 do token; o valor
 * em claro existe somente no cookie do navegador.
 *
 * Como nos repositorios da TASK-BACKEND-004, nada aqui lanca erro HTTP e o
 * instante de escrita chega por parametro (fonte de tempo unica em
 * `~/utils/clock`), para que o mesmo `now()` sirva a revogacao e ao calculo do
 * novo vencimento dentro de uma unica rotacao.
 */

export interface CreateRefreshTokenInput {
  readonly userId: string;
  /** Identificador da SESSAO: compartilhado por cada token da cadeia de rotacao. */
  readonly familyId: string;
  /** SHA-256 hexadecimal (64 caracteres) — nunca o token em claro. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenInput): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Revoga um token especifico ainda ativo; devolve quantas linhas mudaram. */
  revokeById(
    id: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number>;
  /**
   * Revoga em UM comando cada token ativo da familia — e o mecanismo de derrubada
   * da sessao inteira exigido pela RN-07, coberto pelo indice
   * `(family_id, revoked_at)`.
   *
   * Nao caminha a cadeia `replacedById`: seria uma ida ao banco por elo, com
   * risco de laco infinito se a cadeia estivesse corrompida.
   */
  revokeFamily(
    familyId: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number>;
  /**
   * Compare-and-swap da rotacao: marca `ROTATED` SOMENTE se o token ainda estiver
   * ativo e devolve a contagem de linhas alteradas.
   *
   * A contagem e o unico mecanismo que garante uma rotacao por token sob
   * concorrencia: com duas renovacoes simultaneas o Postgres serializa o UPDATE
   * na linha e a segunda encontra `revoked_at` preenchido, recebendo `0`. Um
   * `update` por `id` gravaria duas vezes e as duas requisicoes emitiriam
   * sessao nova a partir do mesmo token.
   *
   * `replacedById` e gravado NESTA mesma escrita, e nao num segundo `update`:
   * a coluna e `@unique`, e uma segunda gravacao do mesmo valor seria redundante
   * e capaz de colidir (`P2002`) sem acrescentar informacao.
   */
  markRotated(id: string, replacedById: string, revokedAt: Date): Promise<number>;
  withTransaction(executor: Prisma.TransactionClient): RefreshTokenRepository;
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async create(data: CreateRefreshTokenInput): Promise<RefreshToken> {
    return this.db.refreshToken.create({
      data: {
        userId: data.userId,
        familyId: data.familyId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeById(
    id: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number> {
    const resultado = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt, revokedReason: reason },
    });

    return resultado.count;
  }

  async revokeFamily(
    familyId: string,
    reason: RefreshTokenRevokedReason,
    revokedAt: Date,
  ): Promise<number> {
    const resultado = await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt, revokedReason: reason },
    });

    return resultado.count;
  }

  async markRotated(
    id: string,
    replacedById: string,
    revokedAt: Date,
  ): Promise<number> {
    const resultado = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt, revokedReason: RefreshTokenRevokedReason.ROTATED, replacedById },
    });

    return resultado.count;
  }

  withTransaction(executor: Prisma.TransactionClient): RefreshTokenRepository {
    return new PrismaRefreshTokenRepository(executor);
  }
}
