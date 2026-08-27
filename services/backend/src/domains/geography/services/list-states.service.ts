import type { StateRepository } from '~/domains/geography/repositories/state.repository';

/**
 * Caso de uso: listar as unidades federativas que alimentam o campo Estado do
 * formulario de animal (RN-25 / RN-27).
 *
 * Respondido inteiramente a partir do banco semeado. NENHUMA chamada externa
 * participa deste caminho — nao ha cliente HTTP, URL de terceiro nem cache a
 * aquecer, e e essa ausencia que faz o formulario continuar abrindo com a rede
 * externa bloqueada (RNF-15).
 */

/**
 * Projecao publica do estado. Deliberadamente SEM `id`: o contrato identifica o
 * estado pela SIGLA em todo o produto — e a sigla que viaja no caminho de
 * `GET /api/states/:uf/cities` e e a sigla que o campo Estado exibe.
 *
 * O `id` interno nao e exposto porque ninguem o usaria, e identificador que
 * ninguem usa e superficie a mais: coerente com a RN-59, que exige projecao
 * explicita dos campos publicos em vez de serializar a entidade inteira. Como em
 * `user.mapper.ts` e em `species.mapper.ts`, campo que nao existe no tipo nao
 * vaza por descuido de serializacao — nenhum handler precisa lembrar de
 * remove-lo.
 */
export interface PublicState {
  readonly uf: string;
  readonly name: string;
}

/**
 * Envelope de colecao `{ items: [...] }`, estabelecido pela FEATURE-001 deste
 * modulo e reaproveitado aqui: um array puro nao admite metadados futuros sem
 * quebrar quem ja consome.
 *
 * Montado no SERVICE e nao no controller, ao contrario do que faz
 * `species.controller.ts`. A diferenca e deliberada e vem do contrato desta
 * task, que fixa a assinatura do caso de uso como
 * `Promise<{ items: ReadonlyArray<{ uf, name }> }>`. Mantem os dois handlers do
 * `geography.controller.ts` reduzidos a repassar o que o service devolveu, sem
 * nenhuma decisao de formato dividida entre as duas camadas.
 */
export interface ListStatesResult {
  readonly items: ReadonlyArray<PublicState>;
}

export class ListStatesService {
  constructor(private readonly states: StateRepository) {}

  /**
   * Sem argumentos: a listagem nao aceita paginacao, filtro nem ordenacao
   * configuravel. Sao 27 registros, conjunto fechado por lei — paginar seria
   * contrato a mais para sempre devolver uma pagina so.
   *
   * A ORDEM vem do banco (`ORDER BY uf`) e nao de um `sort` em memoria:
   * reordenar aqui duplicaria a regra em um segundo lugar, onde ela poderia
   * divergir do repositorio.
   *
   * O `map` projeta `uf` e `name` um a um — nao devolve a entidade `State`. E o
   * ponto em que a RN-59 deixa de ser intencao e vira codigo.
   */
  async execute(): Promise<ListStatesResult> {
    const estados = await this.states.listAll();

    return {
      items: estados.map((estado) => ({ uf: estado.uf, name: estado.name })),
    };
  }
}
