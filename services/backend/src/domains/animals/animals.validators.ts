import { z } from 'zod';

import { normalizeAnimalName } from '~/domains/animals/animal-name';
import { MESSAGES } from '~/domains/animals/animals.messages';
import type {
  PublicAnimalSex,
  PublicAnimalSize,
} from '~/domains/animals/mappers/animal.mapper';
import { productCivilDateOf } from '~/utils/age';
import { now } from '~/utils/clock';

/**
 * Schemas de entrada das rotas de animal. Sao a UNICA fronteira de validacao
 * desses endpoints: o `validateRequest` parseia e REATRIBUI o resultado sobre
 * `req.query`, `req.params` e `req.body`, entao o controller, os services e o
 * repositorio recebem os valores prontos — ja coagidos, ja normalizados e ja com
 * os padroes aplicados — e nenhum deles revalida nada.
 *
 * O schema do `PATCH` entra neste mesmo arquivo nas TASK-BACKEND-008 e 009 — nao
 * antecipado aqui.
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

/**
 * ============================================================================
 * Corpo do `POST /api/animals` (RN-46, contrato de cadastro)
 * ============================================================================
 *
 * TODO CAMPO CHEGA COMO TEXTO, e isso governa o arquivo inteiro: o corpo e
 * `multipart/form-data`, entao nao existe booleano, numero nem data do outro
 * lado — existe `"true"`, `"2022-11-05"` e `""`. Um `z.boolean()` aqui recusaria
 * a string `"true"` e devolveria ao administrador um erro que nao corresponde a
 * nada que ele fez (RN-24).
 *
 * O SELECT VAZIO E O CASO COMUM, e nao o campo ausente: um `<select>` sem escolha
 * e um `<input>` em branco viajam no `FormData` como `""`, e nao como chave
 * ausente. Por isso cada campo obrigatorio trata `""` como AUSENTE e responde
 * "Este campo é obrigatório." — a mensagem que a tabela da spec fixa para
 * "campo obrigatório em branco" (CT-09). Um schema que so olhasse `undefined`
 * responderia "Identificador inválido." para um formulario simplesmente nao
 * preenchido.
 */

/** RN-04 — limites do nome, contados sobre o valor JA normalizado (CT-04 a CT-07). */
const TAMANHO_MINIMO_DO_NOME = 2;

/**
 * RN-04 e, ao mesmo tempo, o limite fisico das colunas `name` e
 * `name_normalized`, ambas `VARCHAR(60)`.
 */
const TAMANHO_MAXIMO_DO_NOME = 60;

/** RN-23 — teto da descricao, contado DEPOIS do `trim` (CT-21). */
const TAMANHO_MAXIMO_DA_DESCRICAO = 1000;

/** RN-19 — barreira de sanidade contra erro de digitacao do ano (CT-17). */
const ANOS_MAXIMOS_DE_NASCIMENTO = 30;

/**
 * Forma exata de `AAAA-MM-DD`. Ancorada nas duas pontas e com contagem fixa de
 * digitos: sem isso, `"2022-11-05T00:00:00Z"` e `"2022-11-5"` chegariam ao
 * `new Date` e virariam datas validas com significado diferente do que o
 * contrato declara.
 */
const FORMATO_DE_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Forma de um UUID, em qualquer caixa. Escrita aqui em vez de `.uuid()` do Zod
 * porque a checagem precisa vir DEPOIS da de campo em branco: encadeada, ela
 * responderia "Identificador inválido." para um `speciesId=""`, que e o que o
 * formulario envia quando o administrador nao escolheu especie nenhuma.
 */
const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RN-11 e RN-12 — os conjuntos fechados, nos literais MINUSCULOS E SEM ACENTO do
 * contrato de API. Os rotulos acentuados ("Médio", "Fêmea") sao da interface, e
 * os literais MAIUSCULOS (`MEDIO`, `FEMEA`) sao do enum do banco — a traducao
 * para eles acontece na fronteira do service, nunca aqui.
 *
 * Tipados a partir de `PublicAnimalSize`/`PublicAnimalSex` do mapper, e nao
 * redeclarados como strings soltas: assim o vocabulario publico existe UMA vez no
 * projeto, e acrescentar um porte no mapper sem acrescenta-lo aqui (ou o
 * contrario) e erro de compilacao em vez de um valor que a leitura devolve e a
 * escrita recusa.
 */
const PORTES: readonly [PublicAnimalSize, ...PublicAnimalSize[]] = [
  'pequeno',
  'medio',
  'grande',
];

const SEXOS: readonly [PublicAnimalSex, ...PublicAnimalSex[]] = ['macho', 'femea'];

/** RN-24 — os dois unicos valores que uma alternancia pode trafegar. */
const VALORES_DE_ALTERNANCIA = ['true', 'false'] as const;

/**
 * `errorMap` e nao `invalid_type_error`, e a diferenca e a razao de a funcao
 * existir: `invalid_type_error` so alcanca o problema `invalid_type`, e um valor
 * FORA da lista produz `invalid_enum_value`, um codigo diferente, que sairia com
 * o default ingles do Zod — `"Invalid enum value. Expected 'pequeno' | ..."` —
 * na resposta ao usuario (RNF-22).
 *
 * As duas condicoes que o mapa separa sao as duas mensagens que a spec fixa:
 *
 * - campo AUSENTE (`invalid_type` com `received: 'undefined'`) ou EM BRANCO
 *   (`invalid_enum_value` com `received: ''`, o `<select>` sem escolha) ⇒
 *   "Este campo é obrigatório.";
 * - qualquer outro valor (`"gigante"`, `"outro"`) ⇒ "Selecione uma opção válida."
 *   (CT-12).
 */
function ehEntradaAusente(problema: z.ZodIssueOptionalMessage): boolean {
  if (problema.code === z.ZodIssueCode.invalid_type) {
    return problema.received === z.ZodParsedType.undefined;
  }

  if (problema.code === z.ZodIssueCode.invalid_enum_value) {
    return problema.received === '';
  }

  return false;
}

function conjuntoFechado<Valor extends string>(
  valores: readonly [Valor, ...Valor[]],
): z.ZodEnum<[Valor, ...Valor[]]> {
  return z.enum(valores as unknown as [Valor, ...Valor[]], {
    errorMap: (problema) => ({
      message: ehEntradaAusente(problema) ? MESSAGES.FIELD_REQUIRED : MESSAGES.INVALID_OPTION,
    }),
  });
}

/**
 * `superRefine` com `return` explicito, e NAO a cadeia `.min(2).max(60)`.
 *
 * ATENCAO ao motivo, porque o obvio NAO se aplica aqui: a cadeia de comprimento
 * NAO acumula. Medido com Zod 3.25.76 — `z.string().min(2).max(60)` sobre `""`
 * produz UM problema, nao dois, e minimo e maximo sao mutuamente exclusivos
 * sobre um mesmo comprimento. A acumulacao existe em `medirPagina` (acima), onde
 * a cadeia e `.int().min(1)` sobre NUMERO: `-1.5` falha no `int` E no minimo e
 * sai com dois `issues`. Sao remedios com a mesma forma e razoes diferentes; nao
 * transporte a justificativa de la para ca.
 *
 * Aqui o `superRefine` e exigido por DUAS razoes, ambas verificadas:
 *
 * 1. PRECEDENCIA. A cadeia so sabe dizer "minimo" ou "maximo". `"   "`, que o
 *    `transform` acima reduz a `""`, sairia como "O nome do animal deve ter no
 *    mínimo 2 caracteres." quando a tabela da spec manda "Este campo é
 *    obrigatório." (CT-09) — o `<input>` em branco e um campo nao preenchido, e
 *    nao um nome curto demais.
 * 2. A SEGUNDA MEDICAO, sobre `toLowerCase().length`, que nenhum `.max()` sobre
 *    o valor cru alcanca. Medido: `'İ'.repeat(60)` mede 60 e PASSA na cadeia,
 *    mas `toLowerCase()` o leva a 120 — ver a nota adiante, no proprio ramo.
 *
 * A PRECEDENCIA das tres mensagens e a da tabela da spec:
 *
 *   1. vazio depois de normalizar -> obrigatorio (CT-09)
 *   2. menos de 2 caracteres      -> minimo      (CT-04)
 *   3. mais de 60 caracteres      -> maximo      (CT-06)
 */
function medirNomeDoAnimal(nome: string, contexto: z.RefinementCtx): void {
  if (nome.length === 0) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.FIELD_REQUIRED });

    return;
  }

  if (nome.length < TAMANHO_MINIMO_DO_NOME) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.NAME_TOO_SHORT });

    return;
  }

  /**
   * As DUAS medicoes, e nao so a do nome: `toLowerCase()` pode AUMENTAR o
   * comprimento da string. `'İ'` (U+0130) vira dois code units, entao 60 desses
   * caracteres passam no limite de `name` e estouram os 60 de `name_normalized`
   * — o `INSERT` seria recusado pelo Postgres e uma entrada apenas longa demais
   * viraria 500 em vez de 400. Mesmo cuidado ja registrado em
   * `species.validators.ts`.
   */
  if (
    nome.length > TAMANHO_MAXIMO_DO_NOME ||
    nome.toLowerCase().length > TAMANHO_MAXIMO_DO_NOME
  ) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.NAME_TOO_LONG });
  }
}

/**
 * O `transform` roda ANTES da medicao: os limites da RN-04 sao contados sobre o
 * valor normalizado, e nao sobre o texto cru. `"  Theo  "` (8 caracteres crus)
 * mede 4 e e aceito; `"   "` chega como `""` e reporta obrigatoriedade em vez de
 * "minimo 2 caracteres" (CT-07).
 *
 * O valor que sai daqui e o que o repositorio grava em `name`, e e dele que o
 * service deriva `nameNormalized` — nenhuma camada renormaliza nada.
 */
const nomeDoAnimalSchema = z
  .string({
    required_error: MESSAGES.FIELD_REQUIRED,
    invalid_type_error: MESSAGES.FIELD_REQUIRED,
  })
  .transform(normalizeAnimalName)
  .superRefine(medirNomeDoAnimal);

/**
 * Identificador de recurso vindo do corpo (`speciesId`, `cityId`).
 *
 * Duas mensagens, nesta ordem, e a ordem e o ponto: em branco e "obrigatório"
 * (o `<select>` que o administrador nao preencheu, CT-09), e so o que TEM
 * conteudo mas nao tem a forma de um identificador e "inválido". `.uuid()`
 * encadeado inverteria essa leitura.
 *
 * A forma e verificada aqui e nao no repositorio para que `"abc"` responda `400`
 * e nao `500`: sem isto, ele chegaria ao Postgres como `WHERE` sobre coluna
 * `uuid` e a entrada invalida viraria falha de infraestrutura.
 */
function medirIdentificador(valor: string, contexto: z.RefinementCtx): void {
  if (valor.length === 0) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.FIELD_REQUIRED });

    return;
  }

  if (!FORMATO_DE_UUID.test(valor)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_IDENTIFIER });
  }
}

const identificadorObrigatorioSchema = z
  .string({
    required_error: MESSAGES.FIELD_REQUIRED,
    invalid_type_error: MESSAGES.FIELD_REQUIRED,
  })
  .transform((valor) => valor.trim())
  .superRefine(medirIdentificador);

/**
 * Data civil `AAAA-MM-DD` como texto ordenavel. Comparar as strings E a
 * comparacao cronologica: com ano de quatro digitos e mes e dia com zero a
 * esquerda, a ordem lexicografica do ISO 8601 e a ordem do calendario, e a
 * comparacao nao passa por nenhum `Date` — logo nao passa por nenhum fuso.
 */
function comoTextoCivil(ano: number, mes: number, dia: number): string {
  const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');

  return `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

/**
 * `AAAA-MM-DD` que EXISTE no calendario.
 *
 * `new Date('2026-02-30')` nao lanca: ele rola para 02/03. A ida e volta pelo
 * ISO e o que separa "data escrita errada" de "data real", sem tabela de dias
 * por mes e sem regra de ano bissexto escrita a mao.
 *
 * O `Date` construido aqui e a MEIA-NOITE UTC daquele dia, que e exatamente como
 * o driver do Prisma materializa a coluna `@db.Date` na leitura — ver
 * `dataCivilDeColunaDate` em `~/utils/age.ts`. Gravar qualquer outro instante
 * faria a idade mudar um dia antes do aniversario, todo ano.
 *
 * NAO e leitura de relogio: o instante vem inteiro do texto recebido, e por isso
 * nao viola a regra de que a hora atual so sai de `~/utils/clock.ts`.
 */
function comoDataCivilUtc(texto: string): Date | null {
  const data = new Date(`${texto}T00:00:00.000Z`);

  if (Number.isNaN(data.getTime()) || !data.toISOString().startsWith(texto)) {
    return null;
  }

  return data;
}

/**
 * RN-19 — nem futura, nem anterior a 30 anos, COMPARADA NO FUSO DO PRODUTO.
 *
 * `productCivilDateOf(now())` e nao `new Date()` cru: com o processo em UTC, as
 * 22h em Sao Paulo ja e o dia seguinte em UTC, e uma comparacao ingenua
 * recusaria a data de HOJE como futura — defeito que so aparece a noite, em
 * producao (CT-16, RNF-10). A regra de fuso vive em UM lugar (`~/utils/age.ts`),
 * compartilhada com o calculo da idade.
 *
 * As duas bordas sao INCLUSIVAS: hoje e aceita (`>` e nao `>=`) e a data de
 * exatamente 30 anos atras tambem (`<` e nao `<=`). O limite inferior e montado
 * trocando SO o ano, o que o mantem no mesmo dia do calendario em qualquer mes.
 */
function medirDataDeNascimento(texto: string, contexto: z.RefinementCtx): void {
  if (texto.length === 0) {
    return;
  }

  if (!FORMATO_DE_DATA_CIVIL.test(texto) || comoDataCivilUtc(texto) === null) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_BIRTH_DATE });

    return;
  }

  const hoje = productCivilDateOf(now());

  if (texto > comoTextoCivil(hoje.year, hoje.month, hoje.day)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.BIRTH_DATE_IN_FUTURE });

    return;
  }

  if (texto < comoTextoCivil(hoje.year - ANOS_MAXIMOS_DE_NASCIMENTO, hoje.month, hoje.day)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.BIRTH_DATE_TOO_OLD });
  }
}

/**
 * RN-18 — OPCIONAL. Um animal resgatado frequentemente chega sem essa
 * informacao, e exigi-la produziria datas inventadas.
 *
 * `""` (o seletor de data em branco) e tratado como AUSENTE e sai `null`, nao
 * como formato invalido: e o que o formulario envia quando o administrador nao
 * preencheu o campo.
 */
const dataDeNascimentoSchema = z
  .string({ invalid_type_error: MESSAGES.INVALID_BIRTH_DATE })
  .optional()
  .transform((valor) => valor?.trim() ?? '')
  .superRefine(medirDataDeNascimento)
  .transform((texto) => (texto.length === 0 ? null : comoDataCivilUtc(texto)));

/** RN-23 — `trim` ANTES da medicao; `""` vira `null` e nao string vazia gravada. */
function medirDescricao(texto: string, contexto: z.RefinementCtx): void {
  if (texto.length > TAMANHO_MAXIMO_DA_DESCRICAO) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: MESSAGES.DESCRIPTION_TOO_LONG,
    });
  }
}

/**
 * `invalid_type_error` e a mensagem-guarda, e nao um texto proprio: a tabela da
 * spec nao preve frase para "descricao que nao e texto", e o unico caminho que
 * produz isso e a chave repetida no multipart (`description` duas vezes), que o
 * busboy entrega como array — coisa que so quem chama a API diretamente faz
 * (RN-33). Inventar "a descrição deve ser um texto" acrescentaria ao contrato
 * literal uma frase que nenhum criterio de aceite verifica.
 */
const descricaoSchema = z
  .string({ invalid_type_error: MESSAGES.VALIDATION_GUARD })
  .optional()
  .transform((valor) => valor?.trim() ?? '')
  .superRefine(medirDescricao)
  .transform((texto) => (texto.length === 0 ? null : texto));

/**
 * RN-24 — indicador de convivencia: sempre presente no dado, nunca nulo, nascendo
 * FALSO quando nao enviado (CT-22).
 *
 * `z.enum(['true','false'])` com `.default('false')` seria equivalente para o
 * campo AUSENTE, mas nao para o campo EM BRANCO: `.default()` so intercepta
 * `undefined`, e uma alternancia desmarcada pode viajar como `""`. Aqui `""` e
 * ausente sao o mesmo desfecho — falso —, e so um valor de fato estranho
 * (`"sim"`, `"1"`) e recusado.
 */
function medirAlternancia(texto: string, contexto: z.RefinementCtx): void {
  if (texto.length === 0) {
    return;
  }

  if (!(VALORES_DE_ALTERNANCIA as ReadonlyArray<string>).includes(texto)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_OPTION });
  }
}

const alternanciaSchema = z
  .string({ invalid_type_error: MESSAGES.INVALID_OPTION })
  .optional()
  .transform((valor) => valor?.trim() ?? '')
  .superRefine(medirAlternancia)
  .transform((texto) => texto === 'true');

/**
 * Objeto que RECUSA qualquer chave nao declarada (RN-46, CT-13, CT-14).
 *
 * NAO usa `.strict()`, pela mesma razao ja registrada em `species.validators.ts`
 * e em `auth.validators.ts`: o `unrecognized_keys` do Zod sai com `path: []`, o
 * `validationErrorFromZodError` faz `path.join('.')` e o cliente receberia
 * `details: [{ field: "", ... }]`, que nao marca campo nenhum. O contrato desta
 * feature exige `field: "<chave>"`. Com `.passthrough()` as chaves extras
 * sobrevivem ao parse e o `superRefine` emite UM problema por chave, com `path`
 * preenchido. Nada e afrouxado: qualquer chave extra continua reprovando.
 *
 * `Object.hasOwn` e nao `chave in forma`: `in` percorre a cadeia de prototipos, e
 * um campo chamado `constructor`, `toString` ou `__proto__` seria aceito como se
 * fosse declarado no schema.
 *
 * `images` NAO precisa constar da forma: e campo de ARQUIVO, consumido pelo
 * `uploadAnimalImages` antes deste schema, e por isso nunca aparece em
 * `req.body`.
 *
 * LIMITE CONHECIDO E ACEITO — a chave extra some de `details` quando um campo
 * DECLARADO tambem falha. Medido: `{ name, speciesId, sex, cityId, extra: '1' }`
 * (sem `size`) responde apenas `size=Este campo é obrigatório.`, sem citar
 * `extra`. A causa e do `ZodObject`: ele devolve `INVALID` assim que um campo
 * aborta e o `superRefine` de objeto nunca chega a rodar.
 *
 * Aceito, e nao esquecido, por tres razoes:
 *
 * 1. NENHUM criterio de aceite e contrariado. O CT-13 e o CT-14 enviam corpo
 *    valido salvo a chave extra, e passam. A RN-46 continua honrada no que ela
 *    afirma: a requisicao e RECUSADA e nada e criado — a chave extra nunca e
 *    aceita em silencio, apenas nao e nomeada nessa resposta. O "todos de uma
 *    vez" do CA-12/CT-09 fala dos campos OBRIGATORIOS do formulario, e esses
 *    continuam saindo juntos.
 * 2. A INTERFACE nao alcanca este caso: o formulario so envia as chaves que ele
 *    proprio monta. Chave extra so chega por chamada direta a API (RN-33), e la
 *    o desfecho e um `400` correto, com uma ida a mais para o segundo problema.
 * 3. Nao ha campo na tela para marcar com "extra": a mensagem existe para quem
 *    integra, nao para quem preenche.
 *
 * SE um contrato futuro passar a exigir `details` completo, o remedio verificado
 * e mover esta varredura para um `z.preprocess` ANTES do parse dos campos — os
 * problemas passam a acumular (medido: `extra`, `a` e `b` no mesmo `details`).
 * Nao foi feito agora porque a varredura passaria a correr sobre o corpo CRU, e
 * nao sobre o objeto ja reconstruido pelo Zod, mudando a superficie do
 * `Object.hasOwn`/`__proto__` abaixo — endurecimento verificado que nao vale a
 * pena refazer por um item de `details`.
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

/**
 * Corpo do `POST /api/animals`.
 *
 * `status` NAO esta na forma, e a ausencia e a regra: o animal nasce Disponivel
 * pelo default do schema do banco (RN-14), e enviar `status` cai na recusa de
 * chave nao prevista com "Campo não permitido nesta requisição." — nenhum animal
 * chega a ser criado com o status escolhido por quem chamou (CT-13, CT-14).
 *
 * `stateId` tambem nao existe aqui, pelo mesmo mecanismo e por uma razao mais
 * forte (RN-26a): o estado do animal e o estado da sua cidade, e o par incoerente
 * "Campo Magro - ES" nao e validado, e INEXPRIMIVEL no contrato.
 */
export const createAnimalBodySchema = objetoSemCamposExtras({
  name: nomeDoAnimalSchema,
  speciesId: identificadorObrigatorioSchema,
  size: conjuntoFechado(PORTES),
  sex: conjuntoFechado(SEXOS),
  cityId: identificadorObrigatorioSchema,
  birthDate: dataDeNascimentoSchema,
  description: descricaoSchema,
  acceptsOtherAnimals: alternanciaSchema,
  needsLargeSpace: alternanciaSchema,
});

/** Tipos derivados dos schemas: nenhum DTO duplicando a mesma forma. */
export type ListAnimalsQuery = z.infer<typeof listAnimalsQuerySchema>;
export type AnimalIdParams = z.infer<typeof animalIdParamsSchema>;
export type CreateAnimalBody = z.infer<typeof createAnimalBodySchema>;
