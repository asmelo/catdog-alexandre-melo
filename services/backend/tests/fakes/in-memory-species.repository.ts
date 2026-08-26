import { Prisma, type Species } from '@prisma/client';

import type {
  CreateSpeciesData,
  RenameSpeciesData,
  SpeciesRepository,
} from '~/domains/species/repositories/species.repository';
import { normalizeSpeciesName, speciesNameKey } from '~/domains/species/species-name';

import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Duble em memoria de `species`, escrito contra a INTERFACE `SpeciesRepository`
 * — nao contra o Prisma. Mesmo papel de `in-memory-user.repository.ts` no
 * dominio auth: e a inversao de dependencia da TASK-BACKEND-002 que permite
 * exercitar os quatro services sem banco e sem simular o client inteiro.
 *
 * A fidelidade que importa aqui e DUPLA e nenhuma das duas e detalhe:
 *
 *   1. o indice unico sobre `name_normalized` (RN-04 / RN-16) — `criar` e
 *      `renomear` LANCAM `P2002` na colisao, que e o unico caminho pelo qual os
 *      services conseguem exercitar o ramo de corrida do CT-12;
 *   2. a ordenacao do `ORDER BY name_normalized` do Postgres (RN-11 / CT-13 /
 *      CT-14) — comparacao POR LOCALE da string ja minuscula, MEDIDA contra o
 *      banco de desenvolvimento e nao suposta; ver `ordenarPorChave`.
 */

/**
 * Os dois instantes sao DISTINTOS de proposito, e a diferenca e o que torna
 * `species.mapper.ts` observavel: gravando o MESMO valor nos dois campos,
 * `createdAt` e `updatedAt` da representacao publica ficam INTERCAMBIAVEIS —
 * trocar um pelo outro no mapper nao reprova teste nenhum, porque nao existe
 * valor que os distinga. Com instantes diferentes, a troca aparece.
 *
 * A escolha tambem e a realista: uma linha SEMEADA representa especie que ja
 * existia e ja foi renomeada alguma vez, e nesse estado `updatedAt` e posterior
 * a `createdAt`. Quem grava os dois iguais e `criar`, porque e isso que o par
 * `@default(now())` / `@updatedAt` do schema faz no INSERT.
 *
 * Exportados para que as asseroes possam comparar o VALOR exato sem escrever
 * `new Date()` dentro de um teste.
 */
export const INSTANTE_DE_CRIACAO = new Date('2026-01-01T00:00:00.000Z');
export const INSTANTE_DE_ATUALIZACAO = new Date('2026-03-04T05:06:07.008Z');

export interface DadosDeEspecieDeTeste {
  readonly id?: string;
  readonly name?: string;
  /**
   * Derivado de `name` quando ausente. Aceita valor explicito para que um teste
   * possa montar uma linha INCONSISTENTE de proposito (chave que nao corresponde
   * ao nome), cenario que o banco real admite e que a renomeacao precisa
   * atravessar sem quebrar.
   */
  readonly nameNormalized?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

/**
 * Fabrica de linha de `species`, no molde de `montarUsuario`. Os instantes sao
 * FIXOS e nao `new Date()`: o mapper converte os dois para ISO-8601 e as
 * asseroes de contrato comparam a string exata.
 *
 * O default de `updatedAt` NAO e o de `createdAt` — ver a nota dos dois
 * instantes acima.
 */
export function montarEspecie(dados: DadosDeEspecieDeTeste = {}): Species {
  const name = normalizeSpeciesName(dados.name ?? 'Gato');

  return {
    id: dados.id ?? proximoUuid(),
    name,
    nameNormalized: dados.nameNormalized ?? speciesNameKey(name),
    createdAt: dados.createdAt ?? INSTANTE_DE_CRIACAO,
    updatedAt: dados.updatedAt ?? INSTANTE_DE_ATUALIZACAO,
  };
}

/**
 * Erro de unicidade IDENTICO ao que o Prisma lanca na colisao de
 * `species.name_normalized`.
 *
 * Nao e preciosismo: `create-species.service.ts` e `rename-species.service.ts`
 * inspecionam `code === 'P2002'` para traduzir a corrida da RN-16 no mesmo
 * `409 SPECIES_NAME_ALREADY_EXISTS` da verificacao previa. Um `Error` generico
 * cairia no `throw motivo` final e o perdedor da corrida receberia 500 — que e
 * exatamente o defeito que a traducao existe para evitar.
 */
export function erroDeNomeDuplicado(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`name_normalized`)',
    {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['name_normalized'] },
    },
  );
}

/**
 * `P2025` — o `UPDATE`/`DELETE` nao encontrou a linha do `where`. E o unico
 * sinal que `deleteById` tem para "nao achei" (o contrato do repositorio manda
 * ele LANCAR, e nao devolver `null`), e o que produz o `404 SPECIES_NOT_FOUND`
 * do CT-20 e do CT-27.
 */
export function erroDeRegistroAusente(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'An operation failed because it depends on one or more records that were required but not found.',
    { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
  );
}

/**
 * `P2003` — violacao de chave estrangeira restritiva.
 *
 * IMPOSSIVEL de produzir contra o banco real HOJE: a tabela `animals` nao existe
 * e nada referencia `species`, entao a CAMADA 2 da RN-09 e codigo alcancavel
 * apenas por duble ate a feature de Cadastro de pets criar a FK
 * `animals.species_id` com `onDelete: Restrict`. A TASK-010 daquela feature
 * reexecuta CT-24, CT-25, CT-26 e CT-32 contra a constraint real.
 *
 * O duble existe porque a traducao `P2003 -> SpeciesInUseError` ja esta escrita
 * (CA-15): deixa-la sem teste ate la significaria descobrir que ela nao funciona
 * no dia em que ela passar a ser o unico obstaculo entre o usuario e um animal
 * orfao.
 */
export function erroDeVinculoDeAnimal(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed on the field: `animals_species_id_fkey (index)`',
    {
      code: 'P2003',
      clientVersion: Prisma.prismaVersion.client,
      meta: { field_name: 'animals_species_id_fkey (index)' },
    },
  );
}

/**
 * `P2028` — a transacao do Prisma expirou ou nao conseguiu conexao no pooler.
 *
 * E um erro de INFRAESTRUTURA que chega pela mesma porta dos codigos de negocio:
 * um `PrismaClientKnownRequestError`, igual ao `P2002`, ao `P2003` e ao `P2025`.
 * E por isso que ele e o unico dado capaz de discriminar as guardas dos
 * services: um `Error` comum reprova ja no `instanceof`, entao uma guarda
 * degenerada para `motivo instanceof Prisma.PrismaClientKnownRequestError` (sem
 * conferir o `code`) continuaria passando nos testes negativos. Com o `P2028`, a
 * degeneracao vira falha — que e o desfecho correto: indisponibilidade de banco
 * nunca pode sair para o administrador como "Ja existe uma especie com este
 * nome." ou "Especie nao encontrada.".
 */
export function erroDeTransacaoExpirada(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Transaction API error: Transaction already closed: Could not perform operation.',
    { code: 'P2028', clientVersion: Prisma.prismaVersion.client },
  );
}

/**
 * Reproduz o `ORDER BY name_normalized ASC` do Postgres.
 *
 * O criterio e POR LOCALE. Isso nao e mais uma premissa adotada: foi MEDIDO no
 * banco de desenvolvimento (Supabase, leitura de catalogo) durante a rodada 2 de
 * revisao desta task —
 *
 *   PostgreSQL 17.6 | datlocprovider = 'i' (ICU) | datcollate = en_US.UTF-8
 *   species.name_normalized -> collation "default", SEM `COLLATE` explicito
 *   SELECT name FROM species ORDER BY name_normalized ASC
 *     -> Agil, Cao, Cavalo, Gato, Zebra   (acentos omitidos: ver convencao)
 *
 * — e `localeCompare('pt-BR')` reproduz exatamente essa ordem. A comparacao
 * BINARIA de code units, que este arquivo adotava ANTES da medicao, devolveria
 * `cavalo, cao, gato, zebra, agil`, jogando todo acentuado para o fim: era o
 * duble que divergia do banco, e nao o contrario. A premissa foi REFUTADA por
 * medicao e esta funcao passou a seguir o banco.
 *
 * O QUE AINDA E PREMISSA, e por isso fica registrado: a migracao de `species`
 * nao declara `COLLATE` em nenhuma das duas colunas, entao a ordem e propriedade
 * do AMBIENTE e nao do schema — o mesmo codigo devolveria `cavalo, ..., agil`
 * num Postgres provisionado com libc `C`. Declarar o `COLLATE` e task de
 * producao propria; enquanto ela nao existe, o duble reproduz o que o ambiente
 * EM USO faz, e o teste que fixa esta ordenacao (`species-routes.spec.ts`,
 * o CT-13 com "Agil"/"Zebra") e quem REPROVA se o ambiente mudar — a divergencia
 * vira uma decisao explicita em vez de um efeito colateral silencioso.
 *
 * A insensibilidade a caixa da RN-11 continua sem depender de colacao: a coluna
 * ja chega em minusculas.
 */
function ordenarPorChave(primeira: Species, segunda: Species): number {
  return primeira.nameNormalized.localeCompare(segunda.nameNormalized, 'pt-BR');
}

/**
 * Estado compartilhado das linhas. Separado do repositorio pelo mesmo motivo do
 * `ArmazemDeUsuarios`: o duble de `PrismaClient` da suite de integracao alcanca
 * as MESMAS linhas por outra porta (o delegate `species`), e duas copias do
 * estado produziriam testes que concordam entre si e discordam da producao.
 */
export class ArmazemDeEspecies implements Restauravel {
  private registros: Species[] = [];

  get linhas(): ReadonlyArray<Species> {
    return this.registros;
  }

  limpar(): void {
    this.registros = [];
  }

  /** Insere uma linha pronta, sem passar pelas regras de `criar`. */
  semear(dados: DadosDeEspecieDeTeste = {}): Species {
    const especie = montarEspecie(dados);

    this.registros.push(especie);

    return especie;
  }

  buscarPorId(id: string): Species | null {
    return this.registros.find((especie) => especie.id === id) ?? null;
  }

  buscarPorChave(nameNormalized: string): Species | null {
    return this.registros.find((especie) => especie.nameNormalized === nameNormalized) ?? null;
  }

  /** RN-11 — copia ordenada; o armazem nao reordena as proprias linhas. */
  listarOrdenado(): Species[] {
    return [...this.registros].sort(ordenarPorChave);
  }

  /** Reproduz a constraint `species_name_normalized_key`: chave repetida lanca `P2002`. */
  criar(dados: CreateSpeciesData): Species {
    if (this.buscarPorChave(dados.nameNormalized) !== null) {
      throw erroDeNomeDuplicado();
    }

    const especie = montarEspecie({
      name: dados.name,
      nameNormalized: dados.nameNormalized,
      /**
       * No INSERT o `@default(now())` e o `@updatedAt` gravam o MESMO instante.
       * Explicito aqui porque o default de `montarEspecie` e a linha ja
       * renomeada, cujo `updatedAt` e posterior.
       */
      createdAt: INSTANTE_DE_CRIACAO,
      updatedAt: INSTANTE_DE_CRIACAO,
    });

    this.registros.push(especie);

    return especie;
  }

  /**
   * `P2025` quando a linha sumiu e `P2002` quando a chave nova pertence a OUTRA
   * linha — as duas corridas que `rename-species.service.ts` traduz. A ordem
   * importa: o Postgres so chega a avaliar o indice unico se encontrar a linha
   * do `where`.
   */
  renomear(id: string, dados: RenameSpeciesData): Species {
    const atual = this.buscarPorId(id);

    if (atual === null) {
      throw erroDeRegistroAusente();
    }

    const homonima = this.buscarPorChave(dados.nameNormalized);

    if (homonima !== null && homonima.id !== id) {
      throw erroDeNomeDuplicado();
    }

    /**
     * `map` + spread, e nao mutacao no lugar: o `capturarEstado` guarda as
     * linhas por REFERENCIA, entao alterar o objeto existente faria o rollback
     * da transacao simulada preservar a alteracao.
     *
     * `updatedAt` NAO e tocado aqui: quem o grava e o `@updatedAt` do schema, e
     * fingir um instante novo obrigaria o duble a inventar um relogio que a
     * aplicacao nao consulta.
     */
    const renomeada: Species = {
      ...atual,
      name: dados.name,
      nameNormalized: dados.nameNormalized,
    };

    this.registros = this.registros.map((especie) =>
      especie.id === id ? renomeada : especie,
    );

    return renomeada;
  }

  /** RN-10 — remocao definitiva. `P2025` para id inexistente (RN-14 / CT-27). */
  remover(id: string): void {
    if (this.buscarPorId(id) === null) {
      throw erroDeRegistroAusente();
    }

    this.registros = this.registros.filter((especie) => especie.id !== id);
  }

  capturarEstado(): () => void {
    const copia = [...this.registros];

    return () => {
      this.registros = copia;
    };
  }
}

export class InMemorySpeciesRepository implements SpeciesRepository {
  constructor(private readonly armazem: ArmazemDeEspecies) {}

  listAll(): Promise<Species[]> {
    return comoPromessa(() => this.armazem.listarOrdenado());
  }

  findById(id: string): Promise<Species | null> {
    return comoPromessa(() => this.armazem.buscarPorId(id));
  }

  findByNameKey(nameNormalized: string): Promise<Species | null> {
    return comoPromessa(() => this.armazem.buscarPorChave(nameNormalized));
  }

  create(data: CreateSpeciesData): Promise<Species> {
    return comoPromessa(() => this.armazem.criar(data));
  }

  rename(id: string, data: RenameSpeciesData): Promise<Species> {
    return comoPromessa(() => this.armazem.renomear(id, data));
  }

  deleteById(id: string): Promise<void> {
    return comoPromessa(() => {
      this.armazem.remover(id);
    });
  }

  /**
   * Devolve `this`, ignorando o executor. NAO e atalho: no duble nao existem
   * duas conexoes, e a atomicidade que os testes precisam observar (o rollback
   * do `delete-species.service.ts` quando ele lanca de dentro da transacao) vem
   * do `$transaction` de `criarPrismaComTransacao`, que restaura os armazens.
   *
   * Devolver uma instancia NOVA aqui, imitando `PrismaSpeciesRepository`, faria
   * o duble parecer transacional sem ser — um `jest.spyOn` sobre a instancia
   * injetada deixaria de valer dentro da transacao e o ramo `P2003` do CT-32
   * ficaria inalcancavel sem que nada avisasse.
   *
   * O PARAMETRO E DECLARADO ainda que ignorado (prefixo `_` por causa do
   * `noUnusedParameters`): e ele que faz um `jest.spyOn` sobre este metodo
   * registrar QUAL executor o service passou, e e essa identidade que torna a
   * RN-09 observavel.
   */
  withTransaction(_executor: Prisma.TransactionClient): SpeciesRepository {
    return this;
  }
}
