import {
  toPublicSpecies,
  type PublicSpecies,
} from '~/domains/species/mappers/species.mapper';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';

/**
 * HU-03 — listagem de todas as especies cadastradas (RN-11).
 *
 * Sem argumentos: a listagem nao aceita paginacao, filtro nem ordenacao
 * configuravel (RN-12). O volume esperado e de dezenas de registros.
 */
export class ListSpeciesService {
  constructor(private readonly species: SpeciesRepository) {}

  /**
   * Cadastro vazio devolve `[]` — NUNCA um erro. "Nenhuma especie cadastrada" e
   * um estado legitimo do recurso e quem o transforma em texto na tela e o
   * frontend (CT-15); um `404` aqui faria o cliente tratar a colecao vazia como
   * rota inexistente.
   *
   * A ORDEM vem do banco (`ORDER BY name_normalized`) e nao de um `sort` em
   * memoria: reordenar aqui duplicaria a regra da RN-11 em um segundo lugar,
   * onde ela poderia divergir do indice.
   */
  async execute(): Promise<ReadonlyArray<PublicSpecies>> {
    const especies = await this.species.listAll();

    return especies.map(toPublicSpecies);
  }
}
