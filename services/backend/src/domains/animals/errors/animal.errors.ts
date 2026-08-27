import { MESSAGES } from '~/domains/animals/animals.messages';
import { ConflictError, NotFoundError } from '~/shared/errors/http-errors';

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
 * A TASK-BACKEND-007 acrescentou `CITY_NOT_FOUND` e a TASK-BACKEND-008
 * acrescentou o `ANIMAL_STALE_UPDATE` do bloqueio otimista.
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

/**
 * RN-26 — a cidade informada nao existe no cadastro de apoio.
 *
 * 404 e nao 400, pela mesma distincao que sustenta `AnimalNotFoundError` e
 * `StateNotFoundError`: a requisicao esta bem formada — o `cityId` TEM a forma de
 * um UUID, garantido por `createAnimalBodySchema` —, o que falta e o recurso.
 *
 * NAO ha `StateNotFoundError` correspondente no cadastro de animal, e a ausencia
 * e a RN-26a em uma linha: o estado nao trafega. Ele e o estado da cidade
 * gravada, entao nao existe estado a nao encontrar — o par incoerente "Campo
 * Magro - ES" e inexprimivel no contrato em vez de ser um erro a validar.
 *
 * Reusa o texto de `animals.messages.ts` e nao o de `geography.messages.ts`: a
 * falha e do cadastro de ANIMAL, e um import cruzado faria uma revisao de texto
 * na geografia mudar em silencio a resposta de `POST /api/animals`.
 */
export class CityNotFoundError extends NotFoundError {
  constructor() {
    super(MESSAGES.CITY_NOT_FOUND, 'CITY_NOT_FOUND');
  }
}

/**
 * RN-47 / RN-48 — o animal foi alterado por outra pessoa entre a leitura que
 * alimentou o formulario e a gravacao.
 *
 * 409 e nao 400, e a distincao e a razao de a classe existir: nao ha nada de
 * errado com o corpo enviado — cada campo dele e valido. O que impede a gravacao
 * e o ESTADO ATUAL do recurso, que ja nao e o estado sobre o qual o
 * administrador decidiu. Um 400 mandaria a interface procurar campo a corrigir;
 * um 409 diz para recarregar.
 *
 * DISTINTO DE `AnimalNotFoundError`, e a distincao nao e cosmetica (CT-64): a
 * atualizacao condicional devolve `count === 0` tanto quando o registro MUDOU
 * quanto quando ele SUMIU, e as duas respostas levam a interface a caminhos
 * diferentes — recarregar o formulario contra a versao atual, ou voltar para a
 * listagem porque o animal ja nao existe. Quem separa os dois casos e o service,
 * com uma releitura depois do desfazimento da transacao; o repositorio continua
 * apenas contando linhas.
 *
 * Nada e alterado quando ela e lancada (RN-48): a transacao inteira e desfeita
 * antes, e os objetos que ja tinham subido ao armazenamento sao removidos.
 */
export class AnimalStaleUpdateError extends ConflictError {
  constructor() {
    super(MESSAGES.ANIMAL_STALE_UPDATE, 'ANIMAL_STALE_UPDATE');
  }
}
