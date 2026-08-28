import { z } from 'zod';

import { MESSAGES } from '~/domains/catalog/catalog.messages';
import { normalizeForSearch } from '~/utils/text-normalizer';

/**
 * Schema da query de `GET /api/catalog/animals`.
 *
 * ============ A RECUSA DE `status` E ESTRUTURAL, NAO UMA REGRA ============
 *
 * Nao existe validacao dizendo "status nao e permitido". O campo simplesmente NAO
 * ESTA no schema, e o guarda de chaves extras recusa tudo o que nao esta
 * declarado. Tornar o status INEXPRIMIVEL e mais forte do que valida-lo: uma
 * regra pode ser removida por engano numa refatoracao, a ausencia de um campo
 * nao (RN-10, CA-10, RNF-04, CT-24).
 *
 * O mesmo guarda cobre `?ordenacao=nome` e qualquer outro parametro inventado
 * (RN-16).
 */

/**
 * Guarda de chaves extras.
 *
 * `.passthrough()` + `superRefine`, e NAO `.strict()` — a mesma correcao que a
 * TASK-BACKEND-009 da FEATURE-002 ja teve de fazer, e pelo mesmo motivo medido:
 * o `.strict()` do Zod devolve `path: []`, que o `validationErrorFromZodError`
 * transforma em `field: ""`, e a mensagem sai em INGLES. O criterio de aceite
 * exige `details[0].field = "status"` e a frase em PT-BR.
 *
 * Declarado aqui e nao importado de `animals.validators.ts`: o dominio publico
 * nao importa do administrativo. Sao dezoito linhas, e o import cruzado custaria
 * mais do que elas.
 */
function objetoSemCamposExtras<Forma extends z.ZodRawShape>(forma: Forma) {
  return z
    .object(forma, {
      required_error: MESSAGES.VALIDATION_GUARD,
      invalid_type_error: MESSAGES.VALIDATION_GUARD,
    })
    .passthrough()
    .superRefine((valor, contexto) => {
      for (const chave of Object.keys(valor)) {
        if (!Object.hasOwn(forma, chave)) {
          contexto.addIssue({
            code: z.ZodIssueCode.unrecognized_keys,
            keys: [chave],
            path: [chave],
            message: MESSAGES.FIELD_NOT_ALLOWED,
          });
        }
      }
    });
}

const identificadorSchema = z
  .string({
    required_error: MESSAGES.INVALID_IDENTIFIER,
    invalid_type_error: MESSAGES.INVALID_IDENTIFIER,
  })
  .uuid(MESSAGES.INVALID_IDENTIFIER);

/**
 * Conjunto fechado com mensagem UNICA para todo desvio.
 *
 * `z.enum` distingue "valor invalido" de "tipo invalido" com frases diferentes em
 * ingles; aqui os dois casos sao o mesmo problema para o visitante, e a cadeia
 * vazia (`size=`) cai no primeiro. E por isso que `size=` e RECUSADO em vez de
 * tratado como ausencia: o frontend OMITE o parametro quando o filtro nao esta
 * aplicado, entao uma cadeia vazia so pode ser requisicao malformada (CT-45).
 */
function conjuntoFechado<Valor extends string>(
  valores: readonly [Valor, ...Valor[]],
): z.ZodEnum<[Valor, ...Valor[]]> {
  /**
   * SO `errorMap`. O Zod LANCA em tempo de construcao se ele vier junto de
   * `required_error`/`invalid_type_error` ("Can't use ... in conjunction with
   * custom error map") — verificado neste projeto, Zod 3.25.76. O mapa sozinho ja
   * cobre os dois casos, que aqui produzem a mesma frase.
   */
  return z.enum(valores, {
    errorMap: () => ({ message: MESSAGES.INVALID_OPTION }),
  });
}

export const PUBLIC_SIZES = ['pequeno', 'medio', 'grande'] as const;
export const PUBLIC_SEXES = ['macho', 'femea'] as const;

export type PublicSizeFilter = (typeof PUBLIC_SIZES)[number];
export type PublicSexFilter = (typeof PUBLIC_SEXES)[number];

/** RN-27. Contado sobre o texto CRU, antes da normalizacao. */
const TAMANHO_MAXIMO_DA_BUSCA = 120;

const IDADE_MAXIMA_ACEITA = 30;
const TAMANHO_MAXIMO_DE_PAGINA = 100;
const TAMANHO_PADRAO_DE_PAGINA = 12;

/**
 * Busca: aparada, limitada e NORMALIZADA aqui, na borda.
 *
 * A normalizacao acontece neste ponto — e nao no repositorio — porque e ela que
 * garante que os DOIS lados da comparacao passaram pela mesma funcao: a coluna,
 * na escrita; o texto digitado, aqui. Normalizar so um dos lados produziria uma
 * busca que funciona para palavra sem acento e falha para palavra com acento, sem
 * erro nenhum (RN-23, RN-26).
 *
 * `"   "` vira `undefined` e nao `""`: busca em branco e busca NAO APLICADA, e a
 * resposta e a lista completa (CT-31). O `transform` para `undefined` e o que faz
 * o repositorio nem montar a clausula.
 *
 * O limite de 120 e medido ANTES da normalizacao: quem cola 121 caracteres de
 * espaco recebe `400`, e nao um `200` silencioso — o tamanho recusado e o do que
 * foi enviado.
 */
const buscaSchema = z
  .string({ invalid_type_error: MESSAGES.SEARCH_TOO_LONG })
  .max(TAMANHO_MAXIMO_DA_BUSCA, MESSAGES.SEARCH_TOO_LONG)
  .transform((bruto) => {
    const normalizado = normalizeForSearch(bruto);

    return normalizado === '' ? undefined : normalizado;
  });

/**
 * `z.coerce.number()` porque a query string SEMPRE chega como texto.
 *
 * `.int()` e o que recusa `"3.5"` — a coercao o aceitaria como `3.5`. `parseInt`
 * no lugar truncaria para `3` em silencio, e o visitante receberia um resultado
 * que nao pediu (CT-61).
 */
function inteiroNaFaixa(minimo: number, maximo: number, mensagem: string) {
  return z.coerce
    .number({ invalid_type_error: mensagem })
    .int(mensagem)
    .min(minimo, mensagem)
    .max(maximo, mensagem);
}

/**
 * Trata a CADEIA VAZIA como parametro AUSENTE, antes da coercao.
 *
 * Necessario porque `z.coerce.number()` converte `""` em `0`, e para
 * `maxAgeYears` isso seria desastroso: `?maxAgeYears=` passaria a significar
 * "so filhotes" em vez de "filtro nao aplicado", que e o oposto (CT-60). Um
 * formulario que envia o campo vazio ao submeter — comportamento normal de
 * navegador — inverteria o filtro sozinho.
 *
 * Aplicado SO aos numericos. Em `size` e `sex` a cadeia vazia continua sendo
 * RECUSADA com `400`, e a diferenca e deliberada: ali o frontend OMITE o
 * parametro quando o filtro nao esta aplicado, entao `size=` so pode ser
 * requisicao malformada (CT-45). Aqui, `page=` e `pageSize=` caem no padrao, que
 * e o comportamento util.
 */
function vazioComoAusente<Schema extends z.ZodTypeAny>(
  schema: Schema,
): z.ZodEffects<z.ZodOptional<Schema>, z.output<Schema> | undefined, unknown> {
  return z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    schema.optional(),
  ) as z.ZodEffects<z.ZodOptional<Schema>, z.output<Schema> | undefined, unknown>;
}

export const listPublicAnimalsQuerySchema = objetoSemCamposExtras({
  search: buscaSchema.optional(),
  speciesId: identificadorSchema.optional(),
  cityId: identificadorSchema.optional(),
  size: conjuntoFechado(PUBLIC_SIZES).optional(),
  sex: conjuntoFechado(PUBLIC_SEXES).optional(),
  /**
   * SO OPCIONAL, NUNCA COM PADRAO. `0` e valor valido e significativo — "menos de
   * um ano" —, e ausencia significa "filtro nao aplicado". Um `default(0)`
   * INVERTERIA o filtro: a vitrine passaria a mostrar so filhotes por omissao
   * (RN-41, CT-59, CT-60).
   */
  maxAgeYears: vazioComoAusente(
    inteiroNaFaixa(0, IDADE_MAXIMA_ACEITA, MESSAGES.INVALID_MAX_AGE),
  ),
  page: vazioComoAusente(
    inteiroNaFaixa(1, Number.MAX_SAFE_INTEGER, MESSAGES.INVALID_PAGE),
  ).transform((valor) => valor ?? 1),
  pageSize: vazioComoAusente(
    inteiroNaFaixa(1, TAMANHO_MAXIMO_DE_PAGINA, MESSAGES.INVALID_PAGE_SIZE),
  ).transform((valor) => valor ?? TAMANHO_PADRAO_DE_PAGINA),
});

export type ListPublicAnimalsQuery = z.infer<typeof listPublicAnimalsQuerySchema>;
