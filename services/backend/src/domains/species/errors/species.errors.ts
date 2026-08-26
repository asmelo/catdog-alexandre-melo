import { MESSAGES } from '~/domains/species/species.messages';
import { ConflictError, NotFoundError } from '~/shared/errors/http-errors';

/**
 * Erros de dominio das especies. Como em `registration.errors.ts`, cada classe
 * nomeia a REGRA violada e nao o status HTTP — e o nome que aparece na stack e
 * no log.
 *
 * Construtores sem parametro de proposito: mensagem e `code` sao contrato fixo
 * dos criterios de aceite, e permitir sobrescreve-los no ponto de lancamento
 * abriria caminho para duas mensagens diferentes para a mesma regra.
 *
 * `FORBIDDEN` e `SESSION_EXPIRED` NAO ganham classe aqui: continuam sendo
 * produzidos pelos middlewares transversais de autenticacao e autorizacao.
 */

/**
 * RN-06 — nome unico pela comparacao da RN-04 (insensivel a caixa, sensivel a
 * acento). Lancado tanto pela verificacao previa quanto pela traducao da
 * violacao do indice unico do banco (RN-16): as duas origens respondem o mesmo
 * `code` e a mesma mensagem, para que duas criacoes simultaneas do mesmo nome
 * nao produzam respostas diferentes.
 */
export class SpeciesNameAlreadyExistsError extends ConflictError {
  constructor() {
    super(MESSAGES.NAME_ALREADY_EXISTS, 'SPECIES_NAME_ALREADY_EXISTS');
  }
}

/**
 * RN-14 — renomear ou excluir especie inexistente. Nao distingue "nunca
 * existiu" de "ja foi excluida": a resposta e a mesma nos dois casos.
 */
export class SpeciesNotFoundError extends NotFoundError {
  constructor() {
    super(MESSAGES.SPECIES_NOT_FOUND, 'SPECIES_NOT_FOUND');
  }
}

/**
 * RN-08 — especie referenciada por pelo menos um animal nao pode ser excluida.
 * 409 e nao 400: o pedido esta bem formado, o que impede a operacao e o estado
 * atual do recurso. Nunca existe exclusao em cascata de animais a partir daqui.
 */
export class SpeciesInUseError extends ConflictError {
  constructor() {
    super(MESSAGES.SPECIES_IN_USE, 'SPECIES_IN_USE');
  }
}
