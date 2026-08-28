import type { PublicAnimal, PublicAnimalRow } from '~/domains/catalog/catalog.types';
import { buildPublicObjectUrl } from '~/infra/storage/object-path';
import { calculateAge } from '~/utils/age';

/**
 * ==================== O CONJUNTO DE CHAVES E FECHADO ====================
 *
 * O que este arquivo devolve E o contrato publico da vitrine, e o teste o compara
 * por IGUALDADE — `Object.keys(item)` contra o conjunto esperado, nao
 * `toMatchObject` (RN-57). Quem acrescentar um campo aqui esta mudando um
 * contrato publico, e o teste falha justamente para dizer isso antes de o campo
 * chegar ao navegador de alguem.
 *
 * ============ CADA CHAVE E ESCRITA UMA A UMA, E ISSO E A REGRA ============
 *
 * Proibido `...row`, `Object.assign`, `pick`/`omit` generico ou qualquer helper
 * que copie por iteracao (RN-55 camada 2, CA-43). Um helper generico anula a
 * garantia: ele copia o que existir na entrada, e o dia em que o `select` da
 * consulta crescer — por descuido ou por outra feature —, o campo novo sai para o
 * visitante sem que nenhuma linha deste arquivo mude.
 *
 * `species` e `city` sao literais aninhados montados campo a campo pelo MESMO
 * motivo. Repassar o objeto que veio do Prisma (`species: row.species`)
 * reintroduziria a falha por dentro: o objeto e do Prisma, e carrega o que o
 * `select` trouxer.
 *
 * ============ ARQUIVO PROPRIO, SEPARADO DO ADMINISTRATIVO ============
 *
 * `src/domains/animals/mappers/animal.mapper.ts` monta a representacao do
 * ADMINISTRADOR e continua intocado (RN-56). Compartilhar montador e exatamente o
 * que este arquivo existe para impedir: um campo interno futuro — numero do chip,
 * contato do proprietario — acrescentado ao lado administrativo nao pode virar
 * vazamento aqui por heranca.
 */

/** As chaves da projecao, na ordem em que sao escritas abaixo. */
export const PUBLIC_ANIMAL_KEYS = [
  'id',
  'name',
  'species',
  'size',
  'sex',
  'ageInYears',
  'ageInMonths',
  'description',
  'acceptsOtherAnimals',
  'needsLargeSpace',
  'city',
  'coverImageUrl',
] as const;

export function toPublicAnimal(row: PublicAnimalRow, now: Date): PublicAnimal {
  /**
   * `row.birthDate` alimenta o calculo e NAO e copiado para a saida (RN-59). Ele
   * so existe no recorte da consulta por isso.
   */
  const { ageInYears, ageInMonths } = calculateAge(row.birthDate, now);

  /**
   * A capa e `images[0]`, e a consulta ja a restringiu a `position: 0` com
   * `take: 1`. Ausente, `null` — o animal pode nao ter foto nenhuma (RN-58,
   * RN-62), e a tela e quem decide o que exibir no lugar.
   */
  const capa = row.images[0];

  return {
    id: row.id,
    name: row.name,
    species: { id: row.species.id, name: row.species.name },
    size: row.size,
    sex: row.sex,
    ageInYears,
    ageInMonths,
    /**
     * INTEGRAL, sem truncagem (RN-61, CA-45). Cortar aqui decidiria pela tela
     * quantos caracteres cabem, e a decisao depende da largura do cartao — que so
     * o navegador conhece. A truncagem e CSS.
     */
    description: row.description,
    acceptsOtherAnimals: row.acceptsOtherAnimals,
    needsLargeSpace: row.needsLargeSpace,
    /**
     * `stateUf` vem do dado PERSISTIDO, pela relacao `city -> state`. Nenhuma
     * chamada a servico externo em tempo de execucao (RN-64, RN-32).
     *
     * `city.id` NAO entra: os identificadores de filtro vem de
     * `GET /api/catalog/cities`, e nao da listagem (RN-59).
     */
    city: { name: row.city.name, stateUf: row.city.state.uf },
    coverImageUrl: capa === undefined ? null : buildPublicObjectUrl(capa.storagePath),
  };
}
