import { Prisma, UserRole, UserStatus, type User } from '@prisma/client';

import type {
  CreateUserInput,
  UserRepository,
} from '~/domains/auth/repositories/user.repository';
import { DUMMY_PASSWORD_HASH } from '~/utils/password-hasher';

import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Dublê em memória de `users`, escrito contra a INTERFACE `UserRepository` — não
 * contra o Prisma. É essa inversão (TASK-BACKEND-004) que permite exercitar os
 * services sem banco e sem simular o client inteiro.
 */

export interface DadosDeUsuarioDeTeste {
  readonly id?: string;
  readonly name?: string;
  readonly email?: string;
  readonly passwordHash?: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
  readonly emailConfirmedAt?: Date | null;
}

const INSTANTE_DE_CRIACAO = new Date('2026-01-01T00:00:00.000Z');

/**
 * Fábrica de linha de `users`. Os defaults reproduzem os do schema Prisma
 * (`role = CLIENTE`, `status = PENDING_CONFIRMATION`): um teste que precise de
 * conta ativa tem de PEDIR isso explicitamente, e é assim que um erro de
 * configuração de cenário aparece como falha em vez de passar por acidente.
 */
export function montarUsuario(dados: DadosDeUsuarioDeTeste = {}): User {
  return {
    id: dados.id ?? proximoUuid(),
    name: dados.name ?? 'Ana Silva',
    email: dados.email ?? 'ana@exemplo.com',
    /**
     * `DUMMY_PASSWORD_HASH` e nao uma string qualquer: e um hash bcrypt VALIDO
     * (custo 12, sem senha conhecida). Um valor malformado faria o
     * `bcrypt.compare` do login lancar "Invalid salt version" em vez de devolver
     * `false`, e o teste de credencial invalida passaria a medir um erro de
     * infraestrutura no lugar da regra.
     */
    passwordHash: dados.passwordHash ?? DUMMY_PASSWORD_HASH,
    role: dados.role ?? UserRole.CLIENTE,
    status: dados.status ?? UserStatus.PENDING_CONFIRMATION,
    emailConfirmedAt: dados.emailConfirmedAt ?? null,
    createdAt: INSTANTE_DE_CRIACAO,
    updatedAt: INSTANTE_DE_CRIACAO,
  };
}

/**
 * Erro de unicidade IDÊNTICO ao que o Prisma lança na colisão de `users.email`.
 *
 * Não é preciosismo: o `register-user.service.ts` inspeciona `code === 'P2002'` e
 * `meta.target` para traduzir a corrida de cadastro no `409 EMAIL_ALREADY_IN_USE`
 * da RN-13. Um `Error` genérico faria o teste desse ramo passar por engano — ele
 * cairia no `throw motivo` e responderia 500, que é exatamente o defeito que a
 * tradução existe para evitar.
 */
export function erroDeEmailDuplicado(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`email`)',
    {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['email'] },
    },
  );
}

/**
 * Estado compartilhado das linhas. Está separado do repositório porque o dublê de
 * `PrismaClient` da suíte de integração precisa das MESMAS linhas por outra porta
 * (os delegates `user.findUnique`/`create`/`update`) — duas cópias do estado
 * produziriam testes que concordam entre si e discordam da produção.
 */
export class ArmazemDeUsuarios implements Restauravel {
  private registros: User[] = [];

  get linhas(): ReadonlyArray<User> {
    return this.registros;
  }

  limpar(): void {
    this.registros = [];
  }

  /** Insere uma linha pronta, sem passar pelas regras de `create`. */
  semear(dados: DadosDeUsuarioDeTeste = {}): User {
    const usuario = montarUsuario(dados);

    this.registros.push(usuario);

    return usuario;
  }

  buscarPorEmail(email: string): User | null {
    return this.registros.find((usuario) => usuario.email === email) ?? null;
  }

  buscarPorId(id: string): User | null {
    return this.registros.find((usuario) => usuario.id === id) ?? null;
  }

  /** Reproduz a constraint `users_email_key`: e-mail repetido lança `P2002`. */
  criar(dados: CreateUserInput): User {
    if (this.buscarPorEmail(dados.email) !== null) {
      throw erroDeEmailDuplicado();
    }

    const usuario = montarUsuario({
      name: dados.name,
      email: dados.email,
      passwordHash: dados.passwordHash,
    });

    this.registros.push(usuario);

    return usuario;
  }

  ativar(userId: string, confirmedAt: Date): void {
    this.registros = this.registros.map((usuario) =>
      usuario.id === userId
        ? { ...usuario, status: UserStatus.ACTIVE, emailConfirmedAt: confirmedAt }
        : usuario,
    );
  }

  /**
   * Cópia rasa do array com as linhas por referência: as mutações do dublê sempre
   * SUBSTITUEM o objeto (`map` + spread) em vez de alterá-lo no lugar, então
   * guardar as referências basta para desfazer a transação.
   */
  capturarEstado(): () => void {
    const copia = [...this.registros];

    return () => {
      this.registros = copia;
    };
  }
}

export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly armazem: ArmazemDeUsuarios) {}

  findByEmail(email: string): Promise<User | null> {
    return comoPromessa(() => this.armazem.buscarPorEmail(email));
  }

  findById(id: string): Promise<User | null> {
    return comoPromessa(() => this.armazem.buscarPorId(id));
  }

  create(data: CreateUserInput): Promise<User> {
    return comoPromessa(() => this.armazem.criar(data));
  }

  activate(userId: string, confirmedAt: Date): Promise<void> {
    return comoPromessa(() => {
      this.armazem.ativar(userId, confirmedAt);
    });
  }

  /**
   * Devolve `this`, ignorando o executor: no dublê não existem duas conexões, e a
   * atomicidade que os testes precisam observar (o rollback do
   * `refresh-session.service.ts`) é fornecida pelo `$transaction` do dublê de
   * `PrismaClient`, que restaura o estado dos armazéns quando a callback lança.
   */
  withTransaction(): UserRepository {
    return this;
  }
}
