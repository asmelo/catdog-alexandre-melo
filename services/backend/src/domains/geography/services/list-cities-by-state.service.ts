import { StateNotFoundError } from '~/domains/geography/errors/geography.errors';
import type { StateRepository } from '~/domains/geography/repositories/state.repository';

/**
 * Caso de uso: listar os municipios de uma unidade federativa, alimentando o
 * campo Cidade do formulario de animal (RN-25 / RN-27).
 *
 * Como o `ListStatesService`, responde inteiramente a partir do banco semeado:
 * nenhuma chamada externa participa deste caminho (RNF-15).
 */

/**
 * Projecao publica do municipio. Deliberadamente SEM `stateId` e SEM `ibgeCode`.
 *
 * `stateId` e redundante — a lista inteira ja e de um unico estado, aquele do
 * caminho — e expo-lo convidaria a interface a montar o par cidade/estado a
 * partir da resposta, exatamente o que a RN-26a torna impossivel de representar
 * ao fazer trafegar so a cidade. `ibgeCode` e chave de reconciliacao da carga do
 * recorte oficial, detalhe de persistencia sem uso de negocio na tela.
 *
 * `id` FICA, ao contrario do que acontece com o estado: e ele que o formulario
 * envia de volta ao gravar o animal (RN-28, vinculo com a cidade cadastrada e
 * nao texto livre). O nome nao serviria como identificador — ele se REPETE entre
 * unidades federativas.
 */
export interface PublicCity {
  readonly id: string;
  readonly name: string;
}

/**
 * A sigla chega JA validada e em maiusculas, normalizada por
 * `listCitiesParamsSchema`. O service nao renormaliza nem revalida o formato:
 * duplicar a regra aqui criaria um segundo lugar onde ela pode divergir.
 */
export interface ListCitiesByStateInput {
  readonly uf: string;
}

/** Mesmo envelope `{ items: [...] }` do `ListStatesService`. */
export interface ListCitiesByStateResult {
  readonly items: ReadonlyArray<PublicCity>;
}

export class ListCitiesByStateService {
  constructor(private readonly states: StateRepository) {}

  /**
   * Duas consultas em sequencia, e a primeira NAO e evitavel por otimizacao.
   *
   * Um unico `findMany` de cidades pela sigla do estado devolveria `[]` tanto
   * para `XX`, que nao existe, quanto para um estado real sem municipios — e o
   * contrato exige `404 STATE_NOT_FOUND` no primeiro caso e
   * `200 { items: [] }` no segundo. Resolver o estado primeiro e o que separa os
   * dois desfechos.
   *
   * A distincao nao e teorica no formulario: um campo Cidade vazio se leria como
   * "este estado nao tem cidades" e o administrador ficaria travado sem saber
   * por que, que e precisamente o que a RN-58 proibe.
   */
  async execute(entrada: ListCitiesByStateInput): Promise<ListCitiesByStateResult> {
    /**
     * `null` do repositorio vira erro de dominio AQUI, e nao la: a porta de
     * persistencia nunca lanca erro HTTP, e a decisao de que ausencia e um
     * problema pertence ao caso de uso.
     */
    const estado = await this.states.findByUf(entrada.uf);

    if (estado === null) {
      throw new StateNotFoundError();
    }

    /**
     * Consulta pelo `id` do estado ja resolvido, e nao pelo nome nem pela sigla.
     * E o que garante que a lista seja SO daquele estado: "Boa Esperança" existe
     * em ES, MG e PR, e qualquer busca por nome de municipio atravessaria as
     * fronteiras de UF.
     */
    const cidades = await this.states.listCitiesByStateId(estado.id);

    /**
     * Estado que existe e nao tem nenhuma cidade responde `200` com `items: []`,
     * NUNCA `404` — colecao vazia e um estado legitimo do recurso, e o `404`
     * fica reservado a sigla inexistente. Mesmo principio da listagem de
     * especies e da de animais.
     *
     * A ORDEM vem do banco (`ORDER BY name`, por locale) e nao de um `sort` em
     * memoria. Um `sort()` acrescentado aqui reordenaria por code unit e
     * empurraria todos os nomes acentuados para o fim da lista.
     */
    return {
      items: cidades.map((cidade) => ({ id: cidade.id, name: cidade.name })),
    };
  }
}
