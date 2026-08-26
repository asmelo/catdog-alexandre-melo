import { request } from '~/services/api/http-client';

/**
 * Uma funcao por endpoint de `/api/species`, e nada mais.
 *
 * Mesmo desenho de `auth-api.ts`: sem estado e SEM TRATAMENTO DE ERRO. O
 * `ApiError` sobe inteiro para quem chamou, porque e a tela — e nao esta camada
 * — que sabe se um `SPECIES_NAME_ALREADY_EXISTS` deve marcar o campo da linha em
 * edicao ou o campo da linha de criacao, e se um `SPECIES_NOT_FOUND` deve
 * recarregar a lista. Nenhuma funcao deste arquivo contem `try`/`catch`.
 *
 * Tambem nao ha ramificacao por texto: quem consome decide pelo `code` do
 * `ApiError` e exibe o `message` que o backend enviou (CA-22).
 *
 * A unica dependencia real do modulo e `http-client.ts`, que ja resolve a base
 * (`/api`), o `Authorization`, o envio do cookie e a renovacao de sessao.
 *
 * NENHUMA das quatro funcoes passa `skipRefresh`, e a omissao e deliberada. Os
 * quatro endpoints exigem `Authorization`, portanto um `401` aqui e o gatilho
 * LEGITIMO de renovacao de sessao — o oposto do `401` de `/auth/login`, que e
 * credencial incorreta. Marcar estas rotas com `skipRefresh` faria a primeira
 * chamada depois dos 15 minutos do access token derrubar a sessao do
 * administrador em vez de renova-la.
 */

/**
 * Recurso publico da especie, exatamente como os quatro endpoints o devolvem.
 *
 * `nameNormalized` NAO existe aqui, e a ausencia e contrato: a chave de
 * unicidade e detalhe de persistencia do backend e nao e exposta pela API.
 * Declara-la neste tipo faria a interface passar a depender de um campo que
 * nunca chega.
 *
 * `createdAt` e `updatedAt` sao `string` e nao `Date`: o que trafega em JSON e o
 * texto ISO-8601, e converter aqui esconderia que a conversao aconteceu. Nenhuma
 * tela da feature exibe data — os dois campos existem porque a resposta os traz.
 */
export interface Species {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Envelope de colecao do projeto, inaugurado por `GET /api/species`.
 *
 * A lista chega ORDENADA pelo backend (por `name_normalized` ascendente, RN-11).
 * Reordenar no cliente e responsabilidade de quem reinsere um item sem recarregar
 * a lista, e nesse caso a comparacao correta e `localeCompare` — a ordenacao do
 * banco e por locale, nao binaria: `Ágil, Cão, Cavalo, Gato, Zebra`.
 */
export interface SpeciesListResponse {
  readonly items: ReadonlyArray<Species>;
}

/**
 * `GET /api/species` — todas as especies, sem paginacao e sem filtro (RN-12).
 *
 * DEVOLVE O ENVELOPE INTEIRO, e nao `items`. Mesma decisao de `auth-api.ts`, que
 * tambem nao desembrulha resposta de sucesso: o envelope existe justamente para
 * ganhar metadados no futuro, e desembrulhar aqui obrigaria a mudar a assinatura
 * desta funcao — e todos os seus chamadores — no dia em que o primeiro metadado
 * aparecer.
 *
 * Sem query string: a listagem nao tem parametros, e o `http-client` nao oferece
 * construtor de query justamente porque nenhuma rota precisou de um ate agora.
 */
export function listSpecies(): Promise<SpeciesListResponse> {
  return request<SpeciesListResponse>('/species');
}

/**
 * `POST /api/species` — `201` com o recurso PLANO, nao envelopado.
 *
 * Corpo montado campo a campo (`body: { name }`), e nunca `body: valores`: o
 * schema do backend recusa QUALQUER chave extra com `400 VALIDATION_ERROR`
 * (RN-13), entao um campo que vazasse do estado do formulario quebraria a
 * criacao. Copiar explicitamente faz o compilador barrar a mudanca antes de o
 * servidor barrar a requisicao — mesma justificativa ja registrada em `register`.
 *
 * O `name` enviado e o que o usuario DIGITOU: nada e normalizado antes de sair
 * daqui, e a autoridade sobre a forma gravada continua sendo o servidor (RN-03).
 *
 * QUEM PRECISAR CONTAR CARACTERES NO CLIENTE — um contador `n/60` sob o campo, o
 * caso obvio — deve usar `higienizarNomeDeEspecie` (`~/utils/validation.ts`), e
 * NAO `normalizeSpeciesName`. As duas nao sao intercambiaveis:
 *
 * - `normalizeSpeciesName` e a RN-03 pura, EXATAMENTE duas operacoes (aparar e
 *   colapsar espacos). Ela NAO remove os caracteres invisiveis, entao conta A MAIS
 *   que o servidor.
 * - `higienizarNomeDeEspecie` remove os invisiveis ANTES de normalizar, e e esse o
 *   valor que `erroDeNomeDeEspecie` mede — a mesma ordem e o mesmo resultado do
 *   `higienizar` do backend (`species.validators.ts`).
 *
 * Contar pela funcao errada reintroduz a divergencia PROIBIDA: o cliente recusando
 * um nome que o servidor aceita, por causa de um caractere que o usuario nao ve e
 * nao tem como apagar.
 *
 * `higienizarNomeDeEspecie` e privada de `validation.ts`. O contador pertence AO
 * LADO dela, naquele arquivo, exportado de la — nunca a uma reimplementacao da
 * regra aqui nesta camada.
 */
export function createSpecies(name: string): Promise<Species> {
  return request<Species>('/species', { method: 'POST', body: { name } });
}

/**
 * `PATCH /api/species/:id` — `200` com o recurso atualizado.
 *
 * `PATCH` e nao `PUT`, por duas razoes independentes ja registradas no
 * changelog: o nome e o unico atributo mutavel, o que caracteriza alteracao
 * parcial; e a configuracao de CORS em vigor nao libera o verbo `PUT`.
 *
 * Interpolar o `id` direto no caminho e seguro: ele vem de um item da lista
 * devolvida pela propria API, nunca de entrada do usuario, e o backend recusa
 * com `400 VALIDATION_ERROR` o que nao for UUID.
 */
export function renameSpecies(id: string, name: string): Promise<Species> {
  return request<Species>(`/species/${id}`, { method: 'PATCH', body: { name } });
}

/**
 * `DELETE /api/species/:id` — `204` sem corpo, dai o `Promise<void>`.
 *
 * O `request` ja devolve `undefined` para `204` sem passar pelo `json()`, entao
 * a promessa resolve sem erro de parsing (`logout` depende do mesmo tratamento).
 *
 * O `409 SPECIES_IN_USE` da RN-08 chega aqui como `ApiError` e sobe intacto: a
 * tela ramifica por esse `code` e exibe a mensagem que veio do backend.
 */
export function deleteSpecies(id: string): Promise<void> {
  return request<void>(`/species/${id}`, { method: 'DELETE' });
}
