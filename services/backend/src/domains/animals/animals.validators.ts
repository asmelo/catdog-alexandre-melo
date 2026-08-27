import { z } from 'zod';

import { MESSAGES } from '~/domains/animals/animals.messages';

/**
 * Schemas de entrada das rotas de LEITURA de animal. Sao a UNICA fronteira de
 * validacao desses dois endpoints: o `validateRequest` parseia e REATRIBUI o
 * resultado sobre `req.query` e `req.params`, entao o controller, os services e
 * o repositorio recebem `page`, `pageSize` e `id` prontos — ja coagidos a numero
 * e ja com os padroes aplicados — e nenhum deles revalida nada.
 *
 * Os schemas de escrita (corpo do `POST` e do `PATCH`) entram neste mesmo
 * arquivo nas TASK-BACKEND-007 a 009 — nao antecipados aqui.
 */

/** RN-42 — pagina padrao e primeira pagina. */
const PAGINA_PADRAO = 1;

/** RN-42 — 20 registros por pagina quando o cliente nao pede outro tamanho. */
const TAMANHO_DE_PAGINA_PADRAO = 20;

/**
 * RN-42 — faixa FECHADA nos dois extremos: `1` e `100` sao validos, `0` e `101`
 * sao `400` (CT-28). O teto existe para que um cliente nao consiga pedir a
 * tabela inteira em uma requisicao e transformar a listagem paginada em uma
 * listagem sem paginacao.
 */
const TAMANHO_DE_PAGINA_MINIMO = 1;
const TAMANHO_DE_PAGINA_MAXIMO = 100;

/**
 * `superRefine` com `return` explicito, e NAO a cadeia
 * `.int().min(1)`.
 *
 * A cadeia ACUMULA os problemas: `?page=-1.5` coage para `-1.5`, os dois checks
 * falham e o `validationErrorFromZodError`, que mapeia `issues` um a um,
 * produziria `details: [{ field: "page", ... }, { field: "page", ... }]` — a
 * MESMA mensagem duas vezes, e a interface marcaria o campo duas vezes. E o
 * mesmo remedio, pela mesma razao, ja aplicado em `medirNome` (especies) e em
 * `medirSigla` (geografia).
 *
 * `Number.isInteger` cobre `Infinity` e fracionario — ambos "isto nao e um
 * numero de pagina", que e exatamente o que a mensagem diz. `NaN` NAO chega
 * aqui: quem o recusa e o proprio `ZodNumber`, um estagio antes, com o
 * `invalid_type_error` declarado no schema — ver a nota em
 * `listAnimalsQuerySchema`. O ramo continua existindo porque `Infinity` e
 * `1.5` sao numeros de verdade e passam pelo tipo.
 */
function medirPagina(valor: number, contexto: z.RefinementCtx): void {
  if (!Number.isInteger(valor)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_PAGE });

    return;
  }

  if (valor < PAGINA_PADRAO) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_PAGE });
  }
}

/** Mesma estrutura de `medirPagina`, com a faixa fechada da RN-42. */
function medirTamanhoDePagina(valor: number, contexto: z.RefinementCtx): void {
  if (!Number.isInteger(valor)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_PAGE_SIZE });

    return;
  }

  if (valor < TAMANHO_DE_PAGINA_MINIMO || valor > TAMANHO_DE_PAGINA_MAXIMO) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_PAGE_SIZE });
  }
}

/**
 * Query de `GET /api/animals`.
 *
 * `z.coerce.number()` porque a query string SEMPRE chega como texto: sem a
 * coercao, `?page=2` seria a string `"2"` e o `skip` da paginacao viraria
 * `("2" - 1) * 20`. O `.default()` fica por FORA da coercao de proposito — ele
 * substitui a entrada `undefined` antes do parse, entao o parametro ausente vira
 * o padrao em vez de virar `Number(undefined)`, que e `NaN`.
 *
 * `invalid_type_error` EM CADA CAMPO, e nao so o `superRefine`: a coercao nunca
 * lanca, ela produz `NaN` — e `NaN` e reprovado pelo PROPRIO `ZodNumber`, antes
 * de qualquer refinamento, porque `ZodEffects` so roda depois que o tipo base
 * passa. Sem este parametro o administrador recebia o default do Zod,
 * `"Expected number, received nan"`, texto em ingles na resposta ao usuario
 * (RNF-22). Alcanca `?page=abc`, `?page=true`, `?page=null` e o `?page=1&page=2`
 * que o Express entrega como array de dois itens — todos `Number(...) === NaN`.
 *
 * `required_error` NAO acompanha, ao contrario de `species.validators.ts` e
 * `geography.validators.ts`: la o campo e obrigatorio, aqui o `.default()`
 * intercepta o `undefined` ANTES do parse, entao o `ZodNumber` nunca ve entrada
 * ausente e a chave seria configuracao morta.
 *
 * SEM `.strict()`. O texto desta task o pedia nominalmente ate a Rodada 1 de
 * revisao, que removeu a exigencia; o registro fica porque a ausencia e
 * deliberada, por duas razoes verificadas:
 *
 * 1. O `unrecognized_keys` do Zod sai com `path: []`, o
 *    `validationErrorFromZodError` faz `path.join('.')` e o cliente receberia
 *    `details: [{ field: "", ... }]`, que nao marca campo nenhum. E a mesma
 *    razao ja registrada em `species.validators.ts` e em `auth.validators.ts`.
 * 2. O contrato NAO pede a recusa. A tabela de falhas de `GET /api/animals` na
 *    spec lista apenas "`page` ou `pageSize` fora da faixa", e o precedente do
 *    projeto e explicito no sentido oposto: `speciesRoutes.get('/')` e
 *    `geographyRoutes.get('/')` IGNORAM query desconhecida, com teste dedicado
 *    afirmando isso. Recusar `?ordenar=nome` aqui faria o mesmo cliente receber
 *    `400` em `/api/animals` e `200` em `/api/species`.
 *
 * O `z.object` sem modificador ja DESCARTA as chaves nao declaradas, entao nada
 * de desconhecido chega ao controller — elas sao ignoradas, nao aceitas. A
 * recusa de chave extra continua valendo integralmente onde o contrato a exige:
 * no CORPO das escritas (RN-46), com a fabrica `.passthrough()` + `superRefine`
 * que as fatias seguintes trazem.
 */
export const listAnimalsQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: MESSAGES.INVALID_PAGE })
    .superRefine(medirPagina)
    .default(PAGINA_PADRAO),
  pageSize: z.coerce
    .number({ invalid_type_error: MESSAGES.INVALID_PAGE_SIZE })
    .superRefine(medirTamanhoDePagina)
    .default(TAMANHO_DE_PAGINA_PADRAO),
});

/**
 * Parametro de caminho `:id` de `GET /api/animals/:id`.
 *
 * Validado como `params` no `validateRequest`, e nao dentro do corpo, porque e o
 * `issue.path` que vira o `field` do `details`: com o schema montado sobre a
 * secao de parametros, o problema sai como
 * `details: [{ field: "id", message: "Identificador inválido." }]`, exigido pelo
 * contrato (CT-92).
 *
 * Existe para que um identificador malformado responda `400` e nao `500`: sem
 * ele, `"abc"` chegaria ao repositorio e o Postgres recusaria o `WHERE` sobre
 * uma coluna `uuid`, transformando entrada invalida em falha de infraestrutura.
 *
 * `.uuid()` encadeado ao `.string()` NAO acumula problemas: o Zod aborta no
 * proprio tipo quando a entrada nao e string, entao sai sempre UM item em
 * `details`. E por isso que aqui a cadeia e aceitavel e nos campos de paginacao
 * nao — la os dois checks rodam sobre o mesmo valor coagido.
 */
export const animalIdParamsSchema = z.object({
  id: z
    .string({
      required_error: MESSAGES.INVALID_IDENTIFIER,
      invalid_type_error: MESSAGES.INVALID_IDENTIFIER,
    })
    .uuid(MESSAGES.INVALID_IDENTIFIER),
});

/** Tipos derivados dos schemas: nenhum DTO duplicando a mesma forma. */
export type ListAnimalsQuery = z.infer<typeof listAnimalsQuerySchema>;
export type AnimalIdParams = z.infer<typeof animalIdParamsSchema>;
