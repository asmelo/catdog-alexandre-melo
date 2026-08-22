import type { EmailConfirmationToken, Prisma } from '@prisma/client';

/**
 * Porta de acesso a `email_confirmation_tokens`. Guarda apenas o SHA-256 do
 * token; o valor em claro existe somente no e-mail enviado ao usuario.
 */

export interface CreateEmailConfirmationTokenInput {
  readonly userId: string;
  /** SHA-256 hexadecimal (64 caracteres) — nunca o token em claro. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface EmailConfirmationTokenRepository {
  create(data: CreateEmailConfirmationTokenInput): Promise<EmailConfirmationToken>;
  findByTokenHash(tokenHash: string): Promise<EmailConfirmationToken | null>;
  /**
   * Compare-and-swap: marca como consumido SOMENTE se ainda estiver pendente e
   * devolve quantas linhas mudaram.
   *
   * A contagem e o mecanismo de exclusao mutua do duplo clique no link: com
   * duas requisicoes simultaneas, o Postgres serializa o `UPDATE` na linha e a
   * segunda encontra `consumed_at` ja preenchido, retornando `0`. Um `update`
   * simples por `id` gravaria duas vezes e as duas requisicoes responderiam
   * sucesso.
   */
  consume(id: string, consumedAt: Date): Promise<number>;
  /**
   * Invalida os tokens pendentes do usuario para que exista no maximo um link
   * valido por vez (usado antes de emitir o token do reenvio).
   */
  invalidatePendingByUser(userId: string, invalidatedAt: Date): Promise<number>;
  withTransaction(executor: Prisma.TransactionClient): EmailConfirmationTokenRepository;
}

export class PrismaEmailConfirmationTokenRepository
  implements EmailConfirmationTokenRepository
{
  constructor(private readonly db: Prisma.TransactionClient) {}

  async create(
    data: CreateEmailConfirmationTokenInput,
  ): Promise<EmailConfirmationToken> {
    return this.db.emailConfirmationToken.create({
      data: { userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<EmailConfirmationToken | null> {
    return this.db.emailConfirmationToken.findUnique({ where: { tokenHash } });
  }

  async consume(id: string, consumedAt: Date): Promise<number> {
    const resultado = await this.db.emailConfirmationToken.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt },
    });

    return resultado.count;
  }

  async invalidatePendingByUser(userId: string, invalidatedAt: Date): Promise<number> {
    const resultado = await this.db.emailConfirmationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: invalidatedAt },
    });

    return resultado.count;
  }

  withTransaction(
    executor: Prisma.TransactionClient,
  ): EmailConfirmationTokenRepository {
    return new PrismaEmailConfirmationTokenRepository(executor);
  }
}
