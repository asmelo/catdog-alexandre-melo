import { Prisma } from '@prisma/client';

import {
  SpeciesNameAlreadyExistsError,
  SpeciesNotFoundError,
} from '~/domains/species/errors/species.errors';
import {
  toPublicSpecies,
  type PublicSpecies,
} from '~/domains/species/mappers/species.mapper';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';
import { speciesNameKey } from '~/domains/species/species-name';

/**
 * HU-04 — renomeacao de especie (RN-04, RN-07, RN-14, RN-15 e RN-16).
 */

/**
 * O nome chega JA normalizado pelo `speciesNameSchema` (RN-03): este service nao
 * apara, nao colapsa espacos e nao mede tamanho. A unica derivacao que ele faz e
 * a chave de unicidade.
 *
 * O `id` vem do parametro de caminho e ja passou pelo `speciesIdParamSchema` —
 * chega aqui como UUID bem formado, nunca como texto arbitrario.
 */
export interface RenameSpeciesInput {
  readonly id: string;
  readonly name: string;
}

/**
 * `species` tem exatamente UM indice unico (`name_normalized`), entao qualquer
 * `P2002` vindo deste `UPDATE` e a colisao da RN-04 — nao ha um segundo alvo a
 * distinguir.
 */
function violaUnicidadeDoNome(motivo: unknown): boolean {
  return motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2002';
}

/**
 * `P2025` — o `UPDATE` nao encontrou a linha do `where`. Aqui isso significa
 * exatamente uma coisa: a especie foi excluida entre a leitura e a escrita.
 */
function registroAusenteNaEscrita(motivo: unknown): boolean {
  return motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2025';
}

export class RenameSpeciesService {
  constructor(private readonly species: SpeciesRepository) {}

  /**
   * SEM `$transaction`, pelo mesmo motivo registrado em `create-species.service.ts`
   * e por um agravante proprio: em Postgres a violacao do indice unico (`23505`)
   * ABORTA a transacao inteira, e o comando seguinte na mesma transacao falha com
   * `25P02 current transaction is aborted`. Traduzir o `P2002` do `UPDATE` para
   * `SpeciesNameAlreadyExistsError` DENTRO de uma transacao interativa so seria
   * seguro se nada mais rodasse depois — e nao ha o que ganhar abrindo uma: a
   * escrita e unica e a garantia de unicidade e do indice, nao de uma
   * leitura-e-escrita atomica. As leituras abaixo fecham a janela comum; a
   * corrida e fechada pela traducao dos erros do Prisma, fora de transacao.
   */
  async execute(entrada: RenameSpeciesInput): Promise<PublicSpecies> {
    /**
     * A existencia vem ANTES do conflito, e a ordem e deliberada: uma especie ja
     * excluida deve reportar "Especie nao encontrada." (RN-14 / CT-20), que e a
     * informacao acionavel para quem tinha a linha aberta em edicao. Checar o
     * conflito primeiro devolveria `409` sobre um recurso que nem existe mais.
     */
    const especie = await this.species.findById(entrada.id);

    if (especie === null) {
      throw new SpeciesNotFoundError();
    }

    const chaveNova = speciesNameKey(entrada.name);

    /**
     * RN-07 — renomear para o PROPRIO nome atual, pela comparacao da RN-04, nao
     * e conflito: e assim que o administrador corrige `"gato"` para `"Gato"` ou
     * remove espacos sobrando (CT-17). A verificacao de conflito e PULADA neste
     * caso, e nao apenas relativizada: `findByNameKey(chaveNova)` encontraria a
     * propria especie e um `409` sobre ela mesma seria o desfecho errado.
     *
     * O `rename` acontece do mesmo jeito — e ele que grava a nova caixa em
     * `name`, o unico efeito visivel da operacao.
     */
    if (chaveNova !== especie.nameNormalized) {
      const homonima = await this.species.findByNameKey(chaveNova);

      /**
       * A comparacao de `id` e a rede de seguranca do desvio acima: mesmo que a
       * chave coincidisse com a da propria especie por qualquer caminho, so
       * OUTRO registro caracteriza o conflito da RN-04 (CT-18).
       */
      if (homonima !== null && homonima.id !== especie.id) {
        throw new SpeciesNameAlreadyExistsError();
      }
    }

    const renomeada = await this.species
      .rename(entrada.id, { name: entrada.name, nameNormalized: chaveNova })
      /**
       * As duas traducoes cobrem a janela entre a leitura e a escrita, quando
       * outra sessao renomeia para o mesmo nome (indice unico, `P2002` -> o
       * MESMO `409 SPECIES_NAME_ALREADY_EXISTS` da verificacao previa, RN-16) ou
       * exclui a especie (`P2025` -> `404 SPECIES_NOT_FOUND`, RN-14). Sem elas,
       * as duas corridas responderiam `500`.
       */
      .catch((motivo: unknown) => {
        if (violaUnicidadeDoNome(motivo)) {
          throw new SpeciesNameAlreadyExistsError();
        }

        if (registroAusenteNaEscrita(motivo)) {
          throw new SpeciesNotFoundError();
        }

        throw motivo;
      });

    // `updatedAt` vem do `@updatedAt` do schema — nenhum `new Date()` aqui.
    return toPublicSpecies(renomeada);
  }
}
