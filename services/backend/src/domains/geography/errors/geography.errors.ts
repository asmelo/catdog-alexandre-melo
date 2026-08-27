import { MESSAGES } from '~/domains/geography/geography.messages';
import { NotFoundError } from '~/shared/errors/http-errors';

/**
 * Erros de dominio da geografia. Como em `species.errors.ts` e em
 * `animal-image.errors.ts`, cada classe nomeia a REGRA violada e nao o status
 * HTTP — e o nome que aparece na stack e no log.
 *
 * Construtor sem parametro de proposito: mensagem e `code` sao contrato fixo dos
 * criterios de aceite, e permitir sobrescreve-los no ponto de lancamento abriria
 * caminho para duas mensagens diferentes para a mesma regra.
 *
 * `FORBIDDEN` e `SESSION_EXPIRED` NAO ganham classe aqui: continuam sendo
 * produzidos pelos middlewares transversais de autenticacao e autorizacao.
 */

/**
 * Sigla de duas letras bem formada que nao corresponde a nenhuma unidade
 * federativa cadastrada (RN-25).
 *
 * 404 e nao 400, e a distincao e a razao de a classe existir: a requisicao esta
 * bem formada — `XX` TEM a forma de uma sigla —, o que falta e o recurso. Um 400
 * aqui diria ao administrador para corrigir o formato de algo cujo formato ja
 * esta correto. O 400 pertence a `geography.validators.ts`, que barra o que nem
 * sigla e ("PARANA", "P1").
 *
 * Quem lanca e o `ListCitiesByStateService`, a partir do `null` devolvido pelo
 * repositorio: a porta de persistencia nunca lanca erro HTTP, e a decisao de que
 * ausencia e um problema e do caso de uso.
 */
export class StateNotFoundError extends NotFoundError {
  constructor() {
    super(MESSAGES.STATE_NOT_FOUND, 'STATE_NOT_FOUND');
  }
}
