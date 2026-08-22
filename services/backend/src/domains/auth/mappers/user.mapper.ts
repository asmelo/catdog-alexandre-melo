import { UserRole, type User } from '@prisma/client';

/**
 * PONTO UNICO de conversao entre a linha de `users` e o usuario publico da API.
 *
 * O banco guarda a role em UPPERCASE (convencao de enum do Postgres/Prisma) e o
 * contrato da API, do JWT e dos caminhos de rota usa lowercase. Espalhar
 * `.toLowerCase()` pelos services criaria duas fontes de verdade para o mesmo
 * vocabulario; aqui a tabela e explicita e o compilador cobra exaustividade.
 */

/** Vocabulario de role exposto ao cliente. */
export const AUTH_ROLES = ['admin', 'cliente'] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

/**
 * Projecao publica do usuario. Deliberadamente sem `passwordHash`, `status` e
 * timestamps: e este objeto que vai no corpo do login e do refresh, e campo que
 * nao existe no tipo nao vaza por descuido de serializacao.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: AuthRole;
}

/**
 * `Record<UserRole, AuthRole>` e nao um `switch`: acrescentar um valor ao enum do
 * schema passa a ser erro de compilacao aqui, em vez de cair num ramo default
 * silencioso.
 */
const PAPEL_PUBLICO: Readonly<Record<UserRole, AuthRole>> = {
  [UserRole.ADMIN]: 'admin',
  [UserRole.CLIENTE]: 'cliente',
};

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: PAPEL_PUBLICO[user.role],
  };
}
