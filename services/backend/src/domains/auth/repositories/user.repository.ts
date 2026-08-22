import { type Prisma, UserStatus, type User } from '@prisma/client';

/**
 * Porta de acesso a `users`. A interface existe para que os services dependam
 * dela e nao do Prisma — e o que permite um duble em memoria nos testes
 * (TASK-BACKEND-007) sem simular o client inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 */

export interface CreateUserInput {
  readonly name: string;
  /** Ja normalizado pelo schema Zod (minusculas, sem espacos nas pontas). */
  readonly email: string;
  readonly passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /**
   * `role` NAO e parametro: o auto-registro sempre produz `CLIENTE` pelo default
   * do schema. Aceitar a role de fora abriria escalonamento de privilegio pelo
   * corpo da requisicao.
   */
  create(data: CreateUserInput): Promise<User>;
  activate(userId: string, confirmedAt: Date): Promise<void>;
  /**
   * Mesma porta ligada a uma transacao em andamento. Sem isto, um repositorio
   * construido com o client global executaria FORA da transacao aberta pelo
   * service e a atomicidade seria so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): UserRepository;
}

/**
 * `Prisma.TransactionClient` e nao `PrismaClient` no construtor: e o tipo comum
 * aos dois: o client completo satisfaz a interface (ela e um `Omit` dele) e o
 * `tx` da transacao interativa tambem. Uma instancia serve aos dois contextos
 * sem uniao de tipos nem cast.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.db.user.create({
      data: { name: data.name, email: data.email, passwordHash: data.passwordHash },
    });
  }

  async activate(userId: string, confirmedAt: Date): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, emailConfirmedAt: confirmedAt },
    });
  }

  withTransaction(executor: Prisma.TransactionClient): UserRepository {
    return new PrismaUserRepository(executor);
  }
}
