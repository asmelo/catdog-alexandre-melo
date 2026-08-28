import {
  UserStatus,
  type AnimalImage,
  type AnimalStatus,
  type City,
  type EmailConfirmationToken,
  type Prisma,
  type PrismaClient,
  type RefreshToken,
  type RefreshTokenRevokedReason,
  type Species,
  type State,
  type User,
} from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { CreateEmailConfirmationTokenInput } from '~/domains/auth/repositories/email-confirmation-token.repository';
import type { CreateRefreshTokenInput } from '~/domains/auth/repositories/refresh-token.repository';
import type { CreateUserInput } from '~/domains/auth/repositories/user.repository';
import type {
  AnimalWithRelations,
  CreateAnimalData,
  CreateAnimalImageData,
  UpdateAnimalData,
} from '~/domains/animals/repositories/animal.repository';
import type {
  CreateSpeciesData,
  RenameSpeciesData,
} from '~/domains/species/repositories/species.repository';

import { ArmazemDeAnimais } from './in-memory-animal.repository';
import { ArmazemDeGeografia } from './in-memory-geography.repository';
import {
  ArmazemDeEspecies,
  erroDeRegistroAusente,
  erroDeVinculoDeAnimal,
} from './in-memory-species.repository';
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
export const armazemDeEspecies = new ArmazemDeEspecies();
export const armazemDeGeografia = new ArmazemDeGeografia();
export const armazemDeAnimais = new ArmazemDeAnimais(armazemDeEspecies, armazemDeGeografia);

const ARMAZENS: ReadonlyArray<Restauravel> = [
  armazemDeUsuarios,
  armazemDeTokensDeConfirmacao,
  armazemDeRefreshTokens,
  armazemDeEspecies,
  armazemDeGeografia,
  armazemDeAnimais,
];

/**
 * Ids cuja exclusao deve falhar com `P2003`, como a chave estrangeira restritiva
 * `animals.species_id` fara quando a feature de Cadastro de pets criar a tabela.
 *
 * Gancho e nao comportamento automatico: a CAMADA 2 da RN-09 nao tem como ser
 * derivada do estado do duble hoje, porque nao existe tabela de animais para
 * consultar. Ate la, o teste declara explicitamente qual especie o BANCO
 * recusaria remover, e a suite exercita a traducao `P2003 -> SPECIES_IN_USE`
 * (CA-15) que hoje e codigo inalcancavel em producao.
 */
const ESPECIES_COM_VINCULO_NO_BANCO = new Set<string>();

export function simularVinculoDeAnimalNoBanco(speciesId: string): void {
  ESPECIES_COM_VINCULO_NO_BANCO.add(speciesId);
}

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
 * As duas consultas de `PrismaSpeciesRepository`: por chave primaria
 * (`findById`) e pela chave de unicidade da RN-04 (`findByNameKey`).
 */
interface FiltroDeEspecie {
  readonly where: { readonly id?: string; readonly nameNormalized?: string };
}

/** RN-11 — a unica ordenacao que a listagem pede. */
interface OrdenacaoDeEspecies {
  readonly orderBy: { readonly nameNormalized: 'asc' | 'desc' };
}

/**
 * `id` vive so no `where` (RN-15) e o `data` traz exatamente o par
 * `name`/`nameNormalized` que a renomeacao grava.
 */
interface AtualizacaoDeEspecie {
  readonly where: { readonly id: string };
  readonly data: RenameSpeciesData;
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


interface ConsultaDeAnimais {
  readonly skip: number;
  readonly take: number;
  readonly orderBy: ReadonlyArray<Record<string, unknown>>;
}

interface AtualizacaoDeAnimal {
  readonly where: { readonly id: string; readonly updatedAt?: Date };
  readonly data: UpdateAnimalData | { readonly status: AnimalStatus };
}

/**
 * A ordenacao da listagem tem TRES criterios, e a ordem entre eles importa. O
 * duble recusa qualquer outra em vez de aceitar e devolver linhas: uma ordenacao
 * so por nome faria a paginacao passar nos testes e continuar nao deterministica
 * em producao.
 */
const ORDENACAO_ESPERADA_DA_LISTAGEM = [
  { nameNormalized: 'asc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

function exigirOrdenacaoDaListagem(orderBy: ReadonlyArray<Record<string, unknown>>): void {
  if (JSON.stringify(orderBy) !== JSON.stringify(ORDENACAO_ESPERADA_DA_LISTAGEM)) {
    throw filtroNaoSuportado('animal.findMany', orderBy);
  }
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
   * Delegate de `species`. Os cinco metodos sao exatamente os que
   * `PrismaSpeciesRepository` emite — nem um a mais: um metodo que a producao
   * nao chama e um metodo que o duble nao precisa reproduzir com fidelidade.
   */
  readonly species = {
    findUnique: (argumentos: FiltroDeEspecie): Promise<Species | null> =>
      comoPromessa(() => {
        const { id, nameNormalized } = argumentos.where;

        if (id !== undefined) {
          return armazemDeEspecies.buscarPorId(id);
        }

        if (nameNormalized !== undefined) {
          return armazemDeEspecies.buscarPorChave(nameNormalized);
        }

        throw filtroNaoSuportado('species.findUnique', argumentos.where);
      }),

    /**
     * A ordenacao vem do ARMAZEM e o `orderBy` recebido e conferido, nao
     * ignorado: a RN-11 depende de o repositorio pedir `nameNormalized: 'asc'`,
     * e um duble que ordenasse por conta propria deixaria os CT-13 e CT-14
     * verdes mesmo se a producao parasse de pedir ordem alguma.
     */
    findMany: (argumentos: OrdenacaoDeEspecies): Promise<Species[]> =>
      comoPromessa(() => {
        if (argumentos.orderBy.nameNormalized !== 'asc') {
          throw filtroNaoSuportado('species.findMany', argumentos.orderBy);
        }

        return armazemDeEspecies.listarOrdenado();
      }),

    create: (argumentos: { readonly data: CreateSpeciesData }): Promise<Species> =>
      comoPromessa(() => armazemDeEspecies.criar(argumentos.data)),

    update: (argumentos: AtualizacaoDeEspecie): Promise<Species> =>
      comoPromessa(() => armazemDeEspecies.renomear(argumentos.where.id, argumentos.data)),

    delete: (argumentos: { readonly where: { readonly id: string } }): Promise<Species> =>
      comoPromessa(() => {
        const { id } = argumentos.where;
        const especie = armazemDeEspecies.buscarPorId(id);

        /**
         * A ORDEM reproduz a do Postgres: a linha e localizada antes de a
         * constraint ser avaliada. Invertida, um id inexistente marcado no
         * gancho responderia `409` em vez de `404`.
         */
        if (especie === null) {
          throw erroDeRegistroAusente();
        }

        if (ESPECIES_COM_VINCULO_NO_BANCO.has(id)) {
          throw erroDeVinculoDeAnimal();
        }

        armazemDeEspecies.remover(id);

        return especie;
      }),
  };

  /**
   * Transação interativa com rollback real. O `refresh-session.service.ts` conta
   * com ele: quando o compare-and-swap perde a corrida, o service lança de dentro
   * da transação exatamente para que o token recém-criado desapareça.
   *
   * O EXECUTOR ENTREGUE A CALLBACK E UM OBJETO DISTINTO DE `this`, e isso nao e
   * detalhe: o Prisma real entrega um `TransactionClient` proprio, e um duble que
   * devolvesse o proprio cliente tornaria `tx === prisma`. Com as duas
   * referencias iguais, NENHUMA assercao sobre o argumento de
   * `withTransaction(...)` conseguiria distinguir um colaborador rebindado a
   * transacao de um colaborador ligado ao cliente global — que e exatamente a
   * quebra da RN-09 que a suite precisa poder observar.
   *
   * Uma instancia NOVA (e nao um clone parcial) porque todo o estado vive nos
   * armazens de modulo: o executor le e escreve as MESMAS linhas, entao a
   * fidelidade de comportamento e integral e so a identidade muda.
   */
  /**
   * Delegates de `animals`, `animal_images`, `states` e `cities`
   * (TASK-BACKEND-011).
   *
   * Sao eles que permitem a suite de integracao rodar o `PrismaAnimalRepository`
   * e o `PrismaStateRepository` DE VERDADE — a consulta que sai do repositorio e
   * interpretada aqui, e um `orderBy` ou um `where` diferente do combinado nao
   * passa em silencio: cai em `filtroNaoSuportado`. E a mesma escolha ja feita
   * para especie, e o motivo e o mesmo: um duble no lugar do repositorio deixaria
   * a montagem da consulta sem nenhum teste.
   */
  readonly animal = {
    findMany: (argumentos: ConsultaDeAnimais): Promise<AnimalWithRelations[]> =>
      comoPromessa(() => {
        exigirOrdenacaoDaListagem(argumentos.orderBy);

        return [
          ...armazemDeAnimais.listarPaginado({
            skip: argumentos.skip,
            take: argumentos.take,
          }).items,
        ];
      }),

    count: (): Promise<number> => comoPromessa(() => armazemDeAnimais.linhas.length),

    findUnique: (argumentos: {
      readonly where: { readonly id: string };
    }): Promise<AnimalWithRelations | null> =>
      comoPromessa(() => armazemDeAnimais.buscarPorId(argumentos.where.id)),

    create: (argumentos: {
      readonly data: CreateAnimalData;
    }): Promise<AnimalWithRelations> =>
      comoPromessa(() => armazemDeAnimais.criar(argumentos.data)),

    updateMany: (argumentos: AtualizacaoDeAnimal): Promise<Contagem> =>
      comoPromessa(() => {
        const { id, updatedAt } = argumentos.where;

        if (updatedAt === undefined) {
          throw filtroNaoSuportado('animal.updateMany', argumentos.where);
        }

        if ('status' in argumentos.data) {
          return {
            count: armazemDeAnimais.atualizarStatusSeInalterado(
              id,
              updatedAt,
              argumentos.data.status,
            ),
          };
        }

        return {
          count: armazemDeAnimais.atualizarSeInalterado(id, updatedAt, argumentos.data),
        };
      }),

    deleteMany: (argumentos: {
      readonly where: { readonly id: string };
    }): Promise<Contagem> =>
      comoPromessa(() => ({ count: armazemDeAnimais.removerPorId(argumentos.where.id) })),
  };

  readonly animalImage = {
    createManyAndReturn: (argumentos: {
      readonly data: ReadonlyArray<CreateAnimalImageData & { readonly animalId: string }>;
    }): Promise<AnimalImage[]> =>
      comoPromessa(() => {
        const primeira = argumentos.data[0];

        if (primeira === undefined) {
          return [];
        }

        return [...armazemDeAnimais.criarImagens(primeira.animalId, argumentos.data)];
      }),

    deleteMany: (argumentos: {
      readonly where: { readonly id: { readonly in: ReadonlyArray<string> } };
    }): Promise<Contagem> =>
      comoPromessa(() => ({
        count: armazemDeAnimais.removerImagensPorIds(argumentos.where.id.in),
      })),

    update: (argumentos: {
      readonly where: { readonly id: string };
      readonly data: { readonly position: number };
    }): Promise<void> =>
      comoPromessa(() => {
        armazemDeAnimais.atualizarPosicaoDaImagem(
          argumentos.where.id,
          argumentos.data.position,
        );
      }),
  };

  readonly state = {
    findMany: (argumentos: { readonly orderBy: { readonly uf: 'asc' | 'desc' } }): Promise<
      State[]
    > =>
      comoPromessa(() => {
        if (argumentos.orderBy.uf !== 'asc') {
          throw filtroNaoSuportado('state.findMany', argumentos.orderBy);
        }

        return armazemDeGeografia.listarEstados();
      }),

    findUnique: (argumentos: {
      readonly where: { readonly uf: string };
    }): Promise<State | null> =>
      comoPromessa(() => armazemDeGeografia.buscarEstadoPorUf(argumentos.where.uf)),
  };

  readonly city = {
    findMany: (argumentos: {
      readonly where: { readonly stateId: string };
      readonly orderBy: { readonly name: 'asc' | 'desc' };
    }): Promise<City[]> =>
      comoPromessa(() => {
        if (argumentos.orderBy.name !== 'asc') {
          throw filtroNaoSuportado('city.findMany', argumentos.orderBy);
        }

        return armazemDeGeografia.listarCidadesDoEstado(argumentos.where.stateId);
      }),

    findUnique: (argumentos: {
      readonly where: { readonly id: string };
    }): Promise<City | null> =>
      comoPromessa(() => armazemDeGeografia.buscarCidadePorId(argumentos.where.id)),
  };

  /**
   * As DUAS formas de `$transaction` do Prisma, porque as duas sao usadas:
   * a interativa (callback) pelas escritas de animal, e a de LOTE (array de
   * promessas) pelo `listPaginated`, que emite a busca e a contagem juntas para
   * que o total nao discorde da pagina.
   */
  async $transaction<T>(executar: (tx: DubleDePrisma) => Promise<T>): Promise<T>;
  async $transaction<T>(lote: ReadonlyArray<Promise<T>>): Promise<T[]>;
  async $transaction<T>(
    executarOuLote: ((tx: DubleDePrisma) => Promise<T>) | ReadonlyArray<Promise<T>>,
  ): Promise<T | T[]> {
    if (typeof executarOuLote === 'function') {
      return this.executarTransacaoInterativa(executarOuLote);
    }

    return Promise.all(executarOuLote);
  }

  private async executarTransacaoInterativa<T>(
    executar: (tx: DubleDePrisma) => Promise<T>,
  ): Promise<T> {
    const executorDaTransacao = new DubleDePrisma();

    return executarComRollback(ARMAZENS, async () => executar(executorDaTransacao));
  }
}

export const prisma = new DubleDePrisma();

/** Chamado no `beforeEach` da suíte de integração. */
export function reiniciarPrismaDouble(): void {
  armazemDeUsuarios.limpar();
  armazemDeTokensDeConfirmacao.limpar();
  armazemDeRefreshTokens.limpar();
  armazemDeEspecies.limpar();
  armazemDeGeografia.limpar();
  armazemDeAnimais.limpar();
  /**
   * O gancho de `P2003` tambem e zerado: sem isto, uma especie marcada como
   * vinculada em um teste faria o teste seguinte que reaproveitasse o mesmo id
   * sequencial receber `409` sem nenhuma relacao com o que ele configurou — e a
   * suite passaria a depender da ordem de execucao.
   */
  ESPECIES_COM_VINCULO_NO_BANCO.clear();
  reiniciarSequenciaDeUuid();
}

/**
 * Liga cada cliente dublado ao executor que o `$transaction` dele entrega. Um
 * `WeakMap` e nao um campo do mock: acrescentar propriedade ao
 * `DeepMockProxy<PrismaClient>` alargaria o tipo que os services recebem e faria
 * o duble parecer ter uma API que o `PrismaClient` real nao tem.
 */
const EXECUTORES_POR_CLIENTE = new WeakMap<
  DeepMockProxy<PrismaClient>,
  DeepMockProxy<Prisma.TransactionClient>
>();

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
  /**
   * O executor da transacao e um mock SEPARADO do cliente, pelo mesmo motivo
   * registrado no `$transaction` de `DubleDePrisma`: com `tx === cliente`,
   * `withTransaction(tx)` e `withTransaction(this.prisma)` produziriam
   * argumentos indistinguiveis e a RN-09 viraria uma regra que a suite anuncia
   * cobrir sem conseguir observar.
   */
  const executorDaTransacao = mockDeep<Prisma.TransactionClient>();

  EXECUTORES_POR_CLIENTE.set(cliente, executorDaTransacao);

  cliente.$transaction.mockImplementation(async (executar) => {
    if (typeof executar !== 'function') {
      throw new Error('Dublê de Prisma: apenas a forma interativa de $transaction é suportada.');
    }

    return executarComRollback(armazens, async () => executar(executorDaTransacao));
  });

  return cliente;
}

/**
 * Executor que `criarPrismaComTransacao(...)` entrega a callback de cada
 * `$transaction` do `cliente`.
 *
 * Existe para que um teste possa asserir a IDENTIDADE do argumento recebido por
 * `withTransaction(...)` — sem ele, um spy so consegue contar chamadas, e contar
 * chamadas nao distingue o executor da transacao do cliente global.
 */
export function executorDaTransacaoDe(
  cliente: DeepMockProxy<PrismaClient>,
): DeepMockProxy<Prisma.TransactionClient> {
  const executor = EXECUTORES_POR_CLIENTE.get(cliente);

  if (executor === undefined) {
    throw new Error(
      'Dublê de Prisma: este cliente não foi criado por `criarPrismaComTransacao`, ' +
        'então não há executor de transação associado a ele.',
    );
  }

  return executor;
}
