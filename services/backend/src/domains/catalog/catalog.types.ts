import type { AnimalSex, AnimalSize } from '@prisma/client';

/**
 * Tipos da VITRINE PUBLICA.
 *
 * Dominio proprio (`catalog`), e nao uma extensao de `animals`, e a separacao e o
 * ponto: `animals` serve o administrador e conhece situacao, marca de alteracao e
 * identificadores internos; este dominio serve o visitante ANONIMO e nao pode
 * conhecer nada disso. Um campo interno acrescentado la nao tem como vazar para ca
 * por heranca, porque nao ha heranca (RN-56).
 */

/**
 * O que o visitante pediu. Todo campo opcional AUSENTE significa "filtro nao
 * aplicado" (RN-35) — nunca "aplicado com valor vazio".
 */
export interface PublicCatalogFilters {
  /**
   * Texto de busca JA NORMALIZADO por `normalizeForSearch` e NUNCA vazio: a
   * cadeia vazia tem de chegar aqui como `undefined`.
   *
   * A normalizacao acontece na borda (o validador), e nao aqui, porque e ela que
   * garante que os dois lados da comparacao passaram pela MESMA funcao — a coluna
   * gravada e o texto digitado.
   */
  readonly search?: string;
  readonly speciesId?: string;
  readonly size?: AnimalSize;
  readonly sex?: AnimalSex;
  readonly maxAgeYears?: number;
  readonly cityId?: string;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * O RECORTE EXATO que a consulta traz do banco.
 *
 * Tipo SEPARADO de `PublicAnimal` de proposito, e nao um alias: e ele que impede
 * o montador de virar um `spread` da linha. Com um tipo so, `{ ...row }`
 * compilaria — e passaria a devolver ao visitante toda coluna que um `select`
 * futuro acrescentasse.
 *
 * `birthDate` entra aqui e NAO sai na projecao: ele existe para o calculo da
 * idade e e descartado pelo montador (RN-59).
 */
export interface PublicAnimalRow {
  readonly id: string;
  readonly name: string;
  readonly size: AnimalSize;
  readonly sex: AnimalSex;
  readonly birthDate: Date | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly species: { readonly id: string; readonly name: string };
  readonly city: { readonly name: string; readonly state: { readonly uf: string } };
  readonly images: ReadonlyArray<{ readonly storagePath: string }>;
}

/**
 * A PROJECAO PUBLICA. Conjunto de chaves FECHADO e verificado por igualdade no
 * teste (RN-57): quem acrescentar campo aqui esta mudando um contrato publico, e
 * o teste falha para dizer isso.
 *
 * NAO CONTEM, e a ausencia de cada um e deliberada (RN-59, CA-42):
 *
 * - `status` — todo item e `DISPONIVEL` por construcao, e expor o campo sugeriria
 *   que a vitrine devolve outros;
 * - `birthDate` — dado do animal, nao da vitrine; a idade derivada e o que
 *   interessa;
 * - `createdAt` / `updatedAt` — ordenacao e concorrencia sao assunto interno;
 * - `cityId` / `speciesId` — os identificadores de filtro vem dos endpoints de
 *   opcoes, nao da listagem;
 * - `images` — a vitrine mostra a CAPA, e `coverImageUrl` e o que ela precisa.
 */
export interface PublicAnimal {
  readonly id: string;
  readonly name: string;
  readonly species: { readonly id: string; readonly name: string };
  readonly size: AnimalSize;
  readonly sex: AnimalSex;
  readonly ageInYears: number | null;
  readonly ageInMonths: number | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly city: { readonly name: string; readonly stateUf: string };
  readonly coverImageUrl: string | null;
}

/**
 * Envelope paginado. Estruturalmente identico ao `ListAnimalsResult` da
 * FEATURE-002 — o mesmo `{ items, pagination: { page, pageSize, total } }` que o
 * frontend ja consome —, mas declarado como GENERICO aqui em vez de importado
 * dali: importar amarraria a vitrine publica ao modulo administrativo, e o import
 * cruzado e justamente o que a separacao de dominios existe para evitar.
 */
export interface PaginatedResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  };
}
