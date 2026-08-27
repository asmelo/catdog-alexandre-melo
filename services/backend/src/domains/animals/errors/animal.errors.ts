import { MESSAGES } from '~/domains/animals/animals.messages';
import { NotFoundError } from '~/shared/errors/http-errors';

/**
 * Erros de dominio do ANIMAL (o recurso), separados dos de
 * `animal-image.errors.ts` (a entrada de arquivos). Como em `species.errors.ts`
 * e em `geography.errors.ts`, cada classe nomeia a REGRA violada e nao o status
 * HTTP — e o nome que aparece na stack e no log.
 *
 * Construtor sem parametro de proposito: mensagem e `code` sao contrato fixo dos
 * criterios de aceite, e permitir sobrescreve-los no ponto de lancamento abriria
 * caminho para duas mensagens diferentes para a mesma regra.
 *
 * `FORBIDDEN` e `SESSION_EXPIRED` NAO ganham classe aqui: continuam sendo
 * produzidos pelos middlewares transversais de autorizacao e autenticacao.
 *
 * As fatias de escrita (TASK-BACKEND-007 a 009) acrescentam neste mesmo arquivo
 * `ANIMAL_STALE_UPDATE` e `CITY_NOT_FOUND` — nao antecipados aqui.
 */

/**
 * RN-44 — nao existe animal com o identificador consultado.
 *
 * 404 e nao 400, e a distincao e a razao de a classe existir: a requisicao esta
 * bem formada — o `id` TEM a forma de um UUID, garantido por
 * `animalIdParamsSchema` —, o que falta e o recurso. O 400 pertence ao
 * validador, que barra o que nem identificador e ("abc").
 *
 * A mensagem NAO distingue "nunca existiu" de "ja foi excluido" (RN-44).
 *
 * Quem lanca e o `GetAnimalService`, a partir do `null` devolvido pelo
 * repositorio: a porta de persistencia nunca lanca erro HTTP, e a decisao de que
 * ausencia e um problema e do caso de uso.
 */
export class AnimalNotFoundError extends NotFoundError {
  constructor() {
    super(MESSAGES.ANIMAL_NOT_FOUND, 'ANIMAL_NOT_FOUND');
  }
}
