import { AnimalNotFoundError } from '~/domains/animals/errors/animal.errors';
import { toAnimalResponse, type AnimalResponse } from '~/domains/animals/mappers/animal.mapper';
import type { AnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { now } from '~/utils/clock';

/**
 * Caso de uso: consultar um animal pelo identificador.
 *
 * Alimenta o formulario de edicao, inclusive o `updatedAt`, que volta como token
 * de concorrencia das escritas (RN-47).
 */

/**
 * O `id` chega JA validado como UUID por `animalIdParamsSchema`. O service nao
 * revalida formato: quem manda "abc" recebe `400` antes de chegar aqui, e
 * duplicar a checagem criaria um segundo lugar de onde poderia sair um `404`
 * descrevendo mal o problema.
 */
export interface GetAnimalInput {
  readonly id: string;
}

export class GetAnimalService {
  constructor(private readonly animals: AnimalRepository) {}

  async execute(entrada: GetAnimalInput): Promise<AnimalResponse> {
    const animal = await this.animals.findById(entrada.id);

    /**
     * O `null` do repositorio vira erro de dominio AQUI, e nao la: a porta de
     * persistencia nunca lanca erro HTTP, e a decisao de que ausencia e um
     * problema pertence ao caso de uso.
     *
     * A mensagem nao distingue "nunca existiu" de "ja foi excluido" (RN-44).
     */
    if (animal === null) {
      throw new AnimalNotFoundError();
    }

    /**
     * O instante vem de `~/utils/clock` e e passado ao mapper: e a unica entrada
     * variavel da resposta, e e o que permite ao teste consultar o MESMO animal
     * duas vezes, com o relogio em 25/08/2026 e depois em 06/11/2026, e observar
     * 3 e 4 anos sem nenhuma escrita no banco entre as duas consultas (CT-18,
     * CT-19, RNF-09).
     */
    return toAnimalResponse(animal, now());
  }
}
