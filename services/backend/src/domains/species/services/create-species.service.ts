import { Prisma } from '@prisma/client';

import { SpeciesNameAlreadyExistsError } from '~/domains/species/errors/species.errors';
import {
  toPublicSpecies,
  type PublicSpecies,
} from '~/domains/species/mappers/species.mapper';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';
import { speciesNameKey } from '~/domains/species/species-name';

/**
 * HU-02 — criacao de especie (RN-04, RN-06 e RN-16).
 */

/**
 * O nome chega JA normalizado pelo `speciesNameSchema` (RN-03): este service nao
 * apara, nao colapsa espacos e nao mede tamanho. A unica derivacao que ele faz e
 * a chave de unicidade.
 */
export interface CreateSpeciesInput {
  readonly name: string;
}

/**
 * `species` tem exatamente UM indice unico (`name_normalized`), entao qualquer
 * `P2002` vindo deste `INSERT` e a colisao da RN-04 — nao ha um segundo alvo a
 * distinguir, ao contrario do `register-user.service.ts`, cuja transacao alcanca
 * `users.email` e `token_hash`.
 */
function violaUnicidadeDoNome(motivo: unknown): boolean {
  return motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2002';
}

export class CreateSpeciesService {
  constructor(private readonly species: SpeciesRepository) {}

  async execute(entrada: CreateSpeciesInput): Promise<PublicSpecies> {
    const chave = speciesNameKey(entrada.name);

    // RN-06 — o caso comum: o nome ja existe e a resposta e 409 sem tentar
    // gravar. Insensivel a caixa e a espacos, sensivel a acento (RN-05), porque
    // e essa a semantica da chave.
    const existente = await this.species.findByNameKey(chave);

    if (existente !== null) {
      throw new SpeciesNameAlreadyExistsError();
    }

    const criada = await this.species
      .create({ name: entrada.name, nameNormalized: chave })
      /**
       * A consulta acima fecha a janela comum, nao a corrida: duas criacoes
       * simultaneas do mesmo nome passam por ela juntas e a segunda bate no
       * indice unico. Traduzir o `P2002` para o MESMO erro de dominio faz as
       * duas origens do conflito responderem `409 SPECIES_NAME_ALREADY_EXISTS`
       * (RN-16 / CT-12) — sem isto, o perdedor da corrida receberia 500.
       *
       * Sem `$transaction` de proposito, e isso importa alem da simplicidade: em
       * Postgres a violacao de unicidade (`23505`) ABORTA a transacao inteira, e
       * qualquer comando seguinte na mesma transacao falharia com
       * `25P02 current transaction is aborted`. Capturar o `P2002` DENTRO de uma
       * transacao interativa so seria seguro se o `INSERT` fosse a ultima
       * operacao dela. Aqui a escrita e unica e a garantia de unicidade e do
       * indice, nao de uma leitura-e-escrita atomica — o tratamento acontece
       * fora de qualquer transacao aberta pela aplicacao.
       */
      .catch((motivo: unknown) => {
        if (violaUnicidadeDoNome(motivo)) {
          throw new SpeciesNameAlreadyExistsError();
        }

        throw motivo;
      });

    // `createdAt`/`updatedAt` vem dos defaults do schema — nenhum `new Date()`
    // nem `now()` participa da criacao.
    return toPublicSpecies(criada);
  }
}
