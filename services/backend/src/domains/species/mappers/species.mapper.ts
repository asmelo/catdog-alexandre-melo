import type { Species } from '@prisma/client';

/**
 * PONTO UNICO de conversao entre a linha de `species` e a especie publica da
 * API. Mesmo papel de `user.mapper.ts` no dominio auth.
 */

/**
 * Projecao publica da especie. Deliberadamente SEM `nameNormalized`: a chave de
 * unicidade da RN-04 e detalhe de persistencia, nao informacao de negocio, e a
 * spec exige que ela nao seja exposta. Como em `user.mapper.ts`, campo que nao
 * existe no tipo nao vaza por descuido de serializacao — nenhum handler precisa
 * lembrar de removE-lo.
 *
 * As datas saem como `string` e nao como `Date`: o contrato da spec e ISO-8601
 * (`"2026-08-25T13:40:12.481Z"`). Converter aqui, e nao deixar para a
 * serializacao implicita do `res.json`, torna o formato explicito no tipo — e o
 * dia em que a resposta for montada por outro caminho o contrato nao muda.
 */
export interface PublicSpecies {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toPublicSpecies(species: Species): PublicSpecies {
  return {
    id: species.id,
    name: species.name,
    createdAt: species.createdAt.toISOString(),
    updatedAt: species.updatedAt.toISOString(),
  };
}
