/**
 * Tipos do CONTRATO de `/api/animals` e `/api/states`, e nao do modelo do banco.
 *
 * A distincao e a razao de este arquivo existir: o Prisma escreve `MEDIO`,
 * `FEMEA` e `DISPONIVEL` em maiusculas, e o `animal.mapper.ts` do backend traduz
 * para minusculas sem acento antes de responder. E a forma traduzida que trafega,
 * e e ela que precisa estar aqui — copiar o vocabulario do enum produziria uma
 * tela que compara `'MEDIO'` com o `'medio'` que chega e nunca casa.
 *
 * Os rotulos ACENTUADOS ("Médio", "Fêmea", "Disponível") sao responsabilidade da
 * interface e vivem em `animal-labels.ts`. O contrato nao os conhece.
 */

export type AnimalSize = 'pequeno' | 'medio' | 'grande';
export type AnimalSex = 'macho' | 'femea';
export type AnimalStatus = 'disponivel' | 'reservado' | 'adotado' | 'indisponivel';

export interface AnimalSpecies {
  readonly id: string;
  readonly name: string;
}

/**
 * A sigla vem junto porque a listagem exibe "Cidade - UF" e uma segunda
 * requisicao so para descobrir o estado seria absurda.
 */
export interface AnimalCity {
  readonly id: string;
  readonly name: string;
  readonly stateUf: string;
}

export interface AnimalImage {
  readonly id: string;
  readonly url: string;
  /** Posicao na ordem. `0` e a capa (RN-35). */
  readonly position: number;
}

export interface Animal {
  readonly id: string;
  readonly name: string;
  readonly species: AnimalSpecies;
  readonly size: AnimalSize;
  readonly sex: AnimalSex;
  readonly status: AnimalStatus;
  /**
   * `AAAA-MM-DD`, data pura, sem hora e sem fuso (RN-18). `null` quando nao foi
   * informada.
   */
  readonly birthDate: string | null;
  /**
   * Idade DERIVADA pelo servidor a cada resposta, nunca persistida (RN-20).
   *
   * `null` significa "nao informada" e `0` significa "menos de um ano". OS DOIS
   * PRECISAM SER TRATADOS SEPARADAMENTE (RN-21): um `ageInYears ?? 0` na tela
   * transformaria animal sem data de nascimento em filhote recem-nascido.
   *
   * E independente de `birthDate`: os dois sao nulos juntos hoje, mas a tela nao
   * deve inferir um do outro.
   */
  readonly ageInYears: number | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly city: AnimalCity;
  readonly images: ReadonlyArray<AnimalImage>;
  readonly createdAt: string;
  /**
   * TOKEN DE CONCORRENCIA da RN-47, alem de marca de alteracao. E ele que a
   * edicao e a mudanca de status devolvem ao servidor para que uma escrita sobre
   * dado velho seja recusada com `409 ANIMAL_STALE_UPDATE`.
   *
   * OBRIGATORIO no tipo, e nao opcional: opcional deixaria a tela compilar sem
   * envia-lo, e o defeito apareceria so como `400` em producao.
   */
  readonly updatedAt: string;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  /** Total da COLECAO inteira, nao o da pagina (RN-42a). */
  readonly total: number;
}

export interface Paginated<T> {
  readonly items: ReadonlyArray<T>;
  readonly pagination: Pagination;
}

/** Envelope de colecao sem paginacao, estabelecido pela FEATURE-001. */
export interface Collection<T> {
  readonly items: ReadonlyArray<T>;
}

export interface State {
  readonly uf: string;
  readonly name: string;
}

export interface City {
  readonly id: string;
  readonly name: string;
}
