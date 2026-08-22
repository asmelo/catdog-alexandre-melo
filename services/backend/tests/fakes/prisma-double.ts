import {
  UserStatus,
  type EmailConfirmationToken,
  type PrismaClient,
  type RefreshToken,
  type RefreshTokenRevokedReason,
  type User,
} from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { CreateEmailConfirmationTokenInput } from '~/domains/auth/repositories/email-confirmation-token.repository';
import type { CreateRefreshTokenInput } from '~/domains/auth/repositories/refresh-token.repository';
import type { CreateUserInput } from '~/domains/auth/repositories/user.repository';

import {
  ArmazemDeRefreshTokens,
  ArmazemDeTokensDeConfirmacao,
} from './in-memory-token.repositories';
import { ArmazemDeUsuarios } from './in-memory-user.repository';
import {
  comoPromessa,
  executarComRollback,
  reiniciarSequenciaDeUuid,
  type Restauravel,
} from './restauravel';

/**
 * Dublê de `PrismaClient` no nível dos DELEGATES (`user.findUnique`,
 * `refreshToken.updateMany`, ...), usado apenas pela suíte de integração HTTP.
 *
 * Por que no nível dos delegates e não dos repositórios: substituir os
 * repositórios exigiria trocar a fábrica `createAuthController()`, que é código de
 * `src/` — e este slice não altera `src/`. Trocando o cliente, a composição real
 * roda inteira (`PrismaUserRepository`, `PrismaRefreshTokenRepository`, as
 * transações, os services, o controller e os middlewares), e o único ponto
 * dublado é a borda do banco. Em troca, é obrigação deste arquivo reproduzir a
 * semântica que a aplicação depende: `updateMany` filtrando por
 * `consumedAt: null` / `revokedAt: null` e devolvendo `count`, e `$transaction`
 * com ROLLBACK quando a callback lança.
 *
 * As linhas ficam nos mesmos armazéns dos dublês de repositório
 * (`ArmazemDeUsuarios` e companhia): uma segunda cópia do estado produziria
 * testes que concordam entre si e discordam da produção.
 */

export const armazemDeUsuarios = new ArmazemDeUsuarios();
export const armazemDeTokensDeConfirmacao = new ArmazemDeTokensDeConfirmacao();
export const armazemDeRefreshTokens = new ArmazemDeRefreshTokens();

const ARMAZENS: ReadonlyArray<Restauravel> = [
  armazemDeUsuarios,
  armazemDeTokensDeConfirmacao,
  armazemDeRefreshTokens,
];

interface Contagem {
  readonly count: number;
}

interface FiltroDeUsuario {
  readonly where: { readonly id?: string; readonly email?: string };
}

interface AtualizacaoDeUsuario {
  readonly where: { readonly id: string };
  readonly data: { readonly status: UserStatus; readonly emailConfirmedAt: Date };
}

interface FiltroDeTokenDeConfirmacao {
  readonly where: {
    readonly id?: string;
    readonly userId?: string;
    readonly tokenHash?: string;
    readonly consumedAt?: Date | null;
  };
  readonly data: { readonly consumedAt: Date };
}

interface FiltroDeRefreshToken {
  readonly where: {
    readonly id?: string;
    readonly familyId?: string;
    readonly tokenHash?: string;
    readonly revokedAt?: Date | null;
  };
  readonly data: {
    readonly revokedAt: Date;
    readonly revokedReason: RefreshTokenRevokedReason;
    readonly replacedById?: string;
  };
}

/**
 * Falha alto em vez de devolver `0` silenciosamente. Um `where` que o dublê não
 * reconhece significa que o código de produção passou a consultar de outra forma
 * — se isso virasse "nenhuma linha alterada", a suíte continuaria verde medindo
 * um comportamento que o banco real não teria.
 */
function filtroNaoSuportado(operacao: string, where: unknown): Error {
  return new Error(
    `Dublê de Prisma: filtro não suportado em ${operacao}: ${JSON.stringify(where)}. ` +
      'Acrescente o caso a tests/fakes/prisma-double.ts em vez de deixá-lo passar como 0 linhas.',
  );
}

class DubleDePrisma {
  readonly user = {
    findUnique: (argumentos: FiltroDeUsuario): Promise<User | null> =>
      comoPromessa(() => {
        const { email, id } = argumentos.where;

        if (email !== undefined) {
          return armazemDeUsuarios.buscarPorEmail(email);
        }

        if (id !== undefined) {
          return armazemDeUsuarios.buscarPorId(id);
        }

        throw filtroNaoSuportado('user.findUnique', argumentos.where);
      }),

    create: (argumentos: { readonly data: CreateUserInput }): Promise<User> =>
      comoPromessa(() => armazemDeUsuarios.criar(argumentos.data)),

    update: (argumentos: AtualizacaoDeUsuario): Promise<User> =>
      comoPromessa(() => {
        const { id } = argumentos.where;

        if (argumentos.data.status === UserStatus.ACTIVE) {
          armazemDeUsuarios.ativar(id, argumentos.data.emailConfirmedAt);
        }

        const atualizado = armazemDeUsuarios.buscarPorId(id);

        if (atualizado === null) {
          throw filtroNaoSuportado('user.update', argumentos.where);
        }

        return atualizado;
      }),
  };

  readonly emailConfirmationToken = {
    create: (argumentos: {
      readonly data: CreateEmailConfirmationTokenInput;
    }): Promise<EmailConfirmationToken> =>
      comoPromessa(() => armazemDeTokensDeConfirmacao.criar(argumentos.data)),

    findUnique: (argumentos: {
      readonly where: { readonly tokenHash: string };
    }): Promise<EmailConfirmationToken | null> =>
      comoPromessa(() =>
        armazemDeTokensDeConfirmacao.buscarPorHash(argumentos.where.tokenHash),
      ),

    updateMany: (argumentos: FiltroDeTokenDeConfirmacao): Promise<Contagem> =>
      comoPromessa(() => {
        const { id, userId } = argumentos.where;

        if (id !== undefined) {
          return {
            count: armazemDeTokensDeConfirmacao.consumir(id, argumentos.data.consumedAt),
          };
        }

        if (userId !== undefined) {
          return {
            count: armazemDeTokensDeConfirmacao.invalidarPendentesDoUsuario(
              userId,
              argumentos.data.consumedAt,
            ),
          };
        }

        throw filtroNaoSuportado('emailConfirmationToken.updateMany', argumentos.where);
      }),
  };

  readonly refreshToken = {
    create: (argumentos: { readonly data: CreateRefreshTokenInput }): Promise<RefreshToken> =>
      comoPromessa(() => armazemDeRefreshTokens.criar(argumentos.data)),

    findUnique: (argumentos: {
      readonly where: { readonly tokenHash: string };
    }): Promise<RefreshToken | null> =>
      comoPromessa(() => armazemDeRefreshTokens.buscarPorHash(argumentos.where.tokenHash)),

    updateMany: (argumentos: FiltroDeRefreshToken): Promise<Contagem> =>
      comoPromessa(() => {
        const { id, familyId } = argumentos.where;
        const { revokedAt, revokedReason, replacedById } = argumentos.data;

        // `replacedById` no `data` é a assinatura do `markRotated`, e só dele: é
        // a única escrita do projeto que grava a coluna.
        if (id !== undefined && replacedById !== undefined) {
          return {
            count: armazemDeRefreshTokens.marcarRotacionado(id, replacedById, revokedAt),
          };
        }

        if (id !== undefined) {
          return {
            count: armazemDeRefreshTokens.revogarPorId(id, revokedReason, revokedAt),
          };
        }

        if (familyId !== undefined) {
          return {
            count: armazemDeRefreshTokens.revogarFamilia(familyId, revokedReason, revokedAt),
          };
        }

        throw filtroNaoSuportado('refreshToken.updateMany', argumentos.where);
      }),
  };

  /**
   * Transação interativa com rollback real. O `refresh-session.service.ts` conta
   * com ele: quando o compare-and-swap perde a corrida, o service lança de dentro
   * da transação exatamente para que o token recém-criado desapareça.
   */
  async $transaction<T>(executar: (tx: DubleDePrisma) => Promise<T>): Promise<T> {
    return executarComRollback(ARMAZENS, async () => executar(this));
  }
}

export const prisma = new DubleDePrisma();

/** Chamado no `beforeEach` da suíte de integração. */
export function reiniciarPrismaDouble(): void {
  armazemDeUsuarios.limpar();
  armazemDeTokensDeConfirmacao.limpar();
  armazemDeRefreshTokens.limpar();
  reiniciarSequenciaDeUuid();
}

/**
 * `PrismaClient` dublado para os specs UNITÁRIOS, onde os repositórios já são os
 * dublês em memória e a única coisa que o service usa do cliente é
 * `$transaction`.
 *
 * `mockDeep` (não um objeto literal) porque o construtor dos services exige
 * `PrismaClient` e o projeto proíbe `as`/`any`: o `DeepMockProxy<PrismaClient>` é
 * estruturalmente aceito pelo tipo. Qualquer outro método acessado seria um mock
 * vazio — e isso é desejável: significaria que o service passou a falar com o
 * banco por fora dos repositórios, o que apareceria como falha.
 */
export function criarPrismaComTransacao(
  ...armazens: ReadonlyArray<Restauravel>
): DeepMockProxy<PrismaClient> {
  const cliente = mockDeep<PrismaClient>();

  cliente.$transaction.mockImplementation(async (executar) => {
    if (typeof executar !== 'function') {
      throw new Error('Dublê de Prisma: apenas a forma interativa de $transaction é suportada.');
    }

    return executarComRollback(armazens, async () => executar(cliente));
  });

  return cliente;
}
