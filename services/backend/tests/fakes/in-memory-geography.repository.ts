import type { City, Prisma, State } from '@prisma/client';

import type { StateRepository } from '~/domains/geography/repositories/state.repository';

import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Armazem em memoria de `states` e `cities` (TASK-BACKEND-011).
 *
 * Reproduz da tabela real apenas o que as regras leem, e reproduz FIELMENTE as
 * duas ordenacoes que o `PrismaStateRepository` pede ao banco:
 *   - `state.findMany({ orderBy: { uf: 'asc' } })`
 *   - `city.findMany({ where: { stateId }, orderBy: { name: 'asc' } })`
 *
 * Um armazem que devolvesse na ordem de insercao faria o CT-42 e o CT-36 passar
 * por acidente, porque as fixtures ja sao semeadas em ordem alfabetica na maioria
 * dos casos.
 */

const PRIMEIRO_CODIGO_IBGE = 4_100_000;

let sequenciaDeCodigoIbge = PRIMEIRO_CODIGO_IBGE;

function proximoCodigoIbge(): number {
  sequenciaDeCodigoIbge += 1;

  return sequenciaDeCodigoIbge;
}

export interface DadosDeEstadoDeTeste {
  readonly id?: string;
  readonly uf?: string;
  readonly name?: string;
}

export interface DadosDeCidadeDeTeste {
  readonly id?: string;
  readonly stateId: string;
  readonly name?: string;
  readonly ibgeCode?: number;
}

export function montarEstado(dados: DadosDeEstadoDeTeste = {}): State {
  return {
    id: dados.id ?? proximoUuid(),
    uf: dados.uf ?? 'PR',
    name: dados.name ?? 'Parana',
  };
}

export function montarCidade(dados: DadosDeCidadeDeTeste): City {
  return {
    id: dados.id ?? proximoUuid(),
    stateId: dados.stateId,
    name: dados.name ?? 'Campo Magro',
    ibgeCode: dados.ibgeCode ?? proximoCodigoIbge(),
  };
}

/**
 * Comparacao por sigla e por nome. `localeCompare` com `pt-BR` e nao `<`: a
 * coluna e ordenada pelo Postgres com a colacao do banco, e um nome acentuado
 * ("Sao Jose" ao lado de "Sertanopolis") sairia fora de lugar numa comparacao
 * byte a byte.
 */
function porTexto(primeiro: string, segundo: string): number {
  return primeiro.localeCompare(segundo, 'pt-BR');
}

export class ArmazemDeGeografia implements Restauravel {
  private estados: State[] = [];

  private cidades: City[] = [];

  get linhasDeEstado(): ReadonlyArray<State> {
    return this.estados;
  }

  get linhasDeCidade(): ReadonlyArray<City> {
    return this.cidades;
  }

  limpar(): void {
    this.estados = [];
    this.cidades = [];
    sequenciaDeCodigoIbge = PRIMEIRO_CODIGO_IBGE;
  }

  semearEstado(dados: DadosDeEstadoDeTeste = {}): State {
    const estado = montarEstado(dados);

    this.estados.push(estado);

    return estado;
  }

  semearCidade(dados: DadosDeCidadeDeTeste): City {
    const cidade = montarCidade(dados);

    this.cidades.push(cidade);

    return cidade;
  }

  /** Recorte reduzido: um estado e as suas cidades, semeadas de uma vez. */
  semearEstadoComCidades(
    dadosDoEstado: DadosDeEstadoDeTeste,
    nomesDasCidades: ReadonlyArray<string>,
  ): { readonly estado: State; readonly cidades: ReadonlyArray<City> } {
    const estado = this.semearEstado(dadosDoEstado);

    const cidades = nomesDasCidades.map((name) =>
      this.semearCidade({ stateId: estado.id, name }),
    );

    return { estado, cidades };
  }

  listarEstados(): State[] {
    return [...this.estados].sort((um, outro) => porTexto(um.uf, outro.uf));
  }

  buscarEstadoPorUf(uf: string): State | null {
    return this.estados.find((estado) => estado.uf === uf) ?? null;
  }

  listarCidadesDoEstado(stateId: string): City[] {
    return this.cidades
      .filter((cidade) => cidade.stateId === stateId)
      .sort((uma, outra) => porTexto(uma.name, outra.name));
  }

  buscarEstadoPorId(id: string): State | null {
    return this.estados.find((estado) => estado.id === id) ?? null;
  }

  buscarCidadePorId(id: string): City | null {
    return this.cidades.find((cidade) => cidade.id === id) ?? null;
  }

  capturarEstado(): () => void {
    const estados = [...this.estados];
    const cidades = [...this.cidades];

    return () => {
      this.estados = estados;
      this.cidades = cidades;
    };
  }
}

export class InMemoryStateRepository implements StateRepository {
  constructor(private readonly armazem: ArmazemDeGeografia) {}

  listAll(): Promise<ReadonlyArray<State>> {
    return comoPromessa(() => this.armazem.listarEstados());
  }

  findByUf(uf: string): Promise<State | null> {
    return comoPromessa(() => this.armazem.buscarEstadoPorUf(uf));
  }

  listCitiesByStateId(stateId: string): Promise<ReadonlyArray<City>> {
    return comoPromessa(() => this.armazem.listarCidadesDoEstado(stateId));
  }

  findCityById(id: string): Promise<City | null> {
    return comoPromessa(() => this.armazem.buscarCidadePorId(id));
  }

  withTransaction(_executor: Prisma.TransactionClient): StateRepository {
    return this;
  }
}
