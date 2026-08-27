import { z } from 'zod';

import { normalizeAnimalName } from '~/domains/animals/animal-name';
import { MESSAGES } from '~/domains/animals/animals.messages';
import type {
  PublicAnimalSex,
  PublicAnimalSize,
  PublicAnimalStatus,
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
 * A TASK-BACKEND-008 acrescentou o schema do `PATCH /api/animals/:id`; o do
 * `PATCH /api/animals/:id/status` entra neste mesmo arquivo na TASK-BACKEND-009 —
 * nao antecipado aqui.
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
  return z.enum(valores, {
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
 * ISO 8601 com data, hora e FUSO EXPLICITO. O fuso e obrigatorio de proposito:
 * `"2026-08-25T13:40:12.481"` sem sufixo seria interpretado como hora LOCAL do
 * processo, e um servidor em UTC e outro em America/Sao_Paulo leriam instantes
 * diferentes do mesmo texto — o token de concorrencia passaria a depender de onde
 * a aplicacao roda.
 *
 * Os milissegundos sao opcionais na forma, mas a coluna e `@db.Timestamptz(3)`:
 * um token sem eles so casa com um registro gravado no milissegundo zero. Isso
 * NAO e um problema a corrigir aqui — o token e opaco para quem o devolve, e a
 * interface reenvia exatamente o texto que o `GET` serializou com `toISOString()`,
 * que sempre traz os tres digitos. Uma marca truncada simplesmente nao casa e sai
 * como `409`, que e a resposta correta para "este nao e o estado que voce leu".
 */
const FORMATO_DE_DATA_E_HORA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * `YYYY-MM-DD` — a parte de CALENDARIO do token, sempre a frente do `T` porque a
 * forma e ancorada. O dia do mes e conferido sobre esse recorte, e nao sobre o
 * instante inteiro: 30 de fevereiro nao existe em fuso nenhum, entao a pergunta
 * "essa data de calendario existe?" independe do deslocamento que vem no fim.
 */
const TAMANHO_DA_DATA_CIVIL = 10;

/**
 * Tres conferencias, e as tres sao necessarias — nenhuma cobre a outra:
 *
 * 1. A FORMA ancorada. `new Date` nao lanca: `new Date("2026")` e uma data valida
 *    — 1o de janeiro — e sem a ancora um token truncado viraria um instante de
 *    significado completamente diferente, recusado como conflito em vez de como
 *    entrada malformada.
 * 2. O CALENDARIO da data civil, pela MESMA `comoDataCivilUtc` que
 *    `dataDeNascimentoSchema` usa. `"2026-02-30T00:00:00.000Z"` casa a forma e
 *    NAO produz `NaN`: o motor TRANSBORDA o dia excedente e devolve 2 de marco.
 *    Sem esta conferencia o token vira um instante DIFERENTE do que o
 *    administrador digitou e a resposta sai `409` em vez do `400` que o contrato
 *    pede para marca malformada. `"2026-02-29"` (2026 nao e bissexto) tem o mesmo
 *    desfecho, e `"2024-02-29"` (bissexto) passa, como deve.
 * 3. O `NaN` do instante completo, que e o que barra o que a forma deixa passar
 *    fora da data — hora 25, minuto 70 — e tambem o mes 13, que o motor recusa em
 *    vez de transbordar.
 *
 * A conferencia de calendario reusa a funcao do campo irmao em vez de reserializar
 * aqui: a regra de "esta data de calendario existe?" vive em UM lugar so.
 */
function temFormaEInstanteDeDataEHora(texto: string): boolean {
  if (!FORMATO_DE_DATA_E_HORA.test(texto)) {
    return false;
  }

  if (comoDataCivilUtc(texto.slice(0, TAMANHO_DA_DATA_CIVIL)) === null) {
    return false;
  }

  return !Number.isNaN(new Date(texto).getTime());
}

/**
 * RN-47 — o token de concorrencia, na mesma precedencia dos demais campos: em
 * branco e "obrigatório" (CT-09) e so o que TEM conteudo mas nao e uma data e
 * hora existente e "formato inválido".
 */
function medirMarcaDeAlteracao(texto: string, contexto: z.RefinementCtx): void {
  if (texto.length === 0) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.FIELD_REQUIRED });

    return;
  }

  if (!temFormaEInstanteDeDataEHora(texto)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_UPDATED_AT });
  }
}

/**
 * O valor que sai daqui e a `Date` que a atualizacao condicional compara com a
 * coluna `updated_at` — o service nao reparseia texto nenhum.
 *
 * NAO e leitura de relogio, e por isso nao viola a regra de que a hora atual so
 * sai de `~/utils/clock.ts`: o instante vem inteiro do texto recebido.
 */
const marcaDeAlteracaoSchema = z
  .string({
    required_error: MESSAGES.FIELD_REQUIRED,
    invalid_type_error: MESSAGES.FIELD_REQUIRED,
  })
  .transform((valor) => valor.trim())
  .superRefine(medirMarcaDeAlteracao)
  .transform((texto) => new Date(texto));

/**
 * `keepImageIds` como o multipart o entrega: TEXTO contendo uma lista JSON.
 *
 * Um array de verdade nao trafega em `multipart/form-data` — o que existe do
 * outro lado sao partes com o mesmo nome, que o parser entregaria como
 * `string[]` sem nenhuma garantia de ORDEM, e a ordem e justamente o significado
 * do campo (a primeira imagem e a capa, RN-35). O texto JSON preserva a ordem e
 * permite distinguir "lista vazia" de "campo ausente", coisa que partes repetidas
 * nao permitem: zero partes e ausencia, e "remover todas" precisa ser dizivel.
 *
 * Devolve `null` — e nao lanca — em JSON malformado, em JSON que nao e lista e em
 * item sem forma de UUID: as tres condicoes sao o MESMO problema para quem
 * preenche ("isto nao e uma lista de identificadores") e produzem uma unica
 * mensagem, no unico lugar da tela onde ela cabe.
 */
function comoListaDeIdentificadores(texto: string): ReadonlyArray<string> | null {
  let decodificado: unknown;

  try {
    decodificado = JSON.parse(texto);
  } catch {
    return null;
  }

  if (!Array.isArray(decodificado)) {
    return null;
  }

  /**
   * `Array.isArray` sobre `unknown` estreita para `any[]`, e `any` e proibido no
   * projeto. A reatribuicao para `ReadonlyArray<unknown>` desfaz isso em uma
   * linha e obriga a checagem item a item logo abaixo.
   */
  const itens: ReadonlyArray<unknown> = decodificado;
  const identificadores: string[] = [];

  for (const item of itens) {
    if (typeof item !== 'string' || !FORMATO_DE_UUID.test(item)) {
      return null;
    }

    identificadores.push(item);
  }

  return identificadores;
}

/**
 * A PRECEDENCIA das tres mensagens, e ela e o motivo de haver `superRefine` aqui:
 *
 *   1. em branco             -> obrigatorio (CT-09)
 *   2. nao e lista de UUID   -> formato invalido
 *   3. identificador repetido -> repeticao
 *
 * `""` e AUSENTE e nao lista vazia: o formulario envia `"[]"` quando o
 * administrador removeu todas as imagens, e o campo em branco e um formulario que
 * simplesmente nao montou o campo. Tratar os dois como iguais faria uma requisicao
 * incompleta APAGAR todas as imagens do animal em silencio — o desfecho mais
 * destrutivo possivel para o erro mais banal.
 *
 * A repeticao e recusada e nao deduplicada: a lista E a ordem final, e uma imagem
 * nao pode ocupar duas posicoes. Ver `DUPLICATED_KEEP_IMAGE_ID`.
 *
 * A PERTINENCIA de cada identificador ao animal NAO e verificada aqui e nao tem
 * como ser: o schema nao conhece o banco. Ela e do service, que ja leu o animal
 * com as suas imagens (CT-62).
 */
function medirImagensMantidas(texto: string, contexto: z.RefinementCtx): void {
  if (texto.length === 0) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.FIELD_REQUIRED });

    return;
  }

  const identificadores = comoListaDeIdentificadores(texto);

  if (identificadores === null) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: MESSAGES.INVALID_KEEP_IMAGE_IDS,
    });

    return;
  }

  if (new Set(identificadores).size !== identificadores.length) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: MESSAGES.DUPLICATED_KEEP_IMAGE_ID,
    });
  }
}

/**
 * O `?? []` do `transform` NAO e um caminho de sucesso: ele so e alcancado quando
 * `medirImagensMantidas` ja registrou um problema, e o parse inteiro reprova
 * depois dele. Existe porque o `transform` do Zod roda mesmo com o resultado ja
 * sujo, e lancar dali trocaria um `400` com `details` por um `500`. Mesmo desenho
 * ja aplicado em `dataDeNascimentoSchema`.
 */
const imagensMantidasSchema = z
  .string({
    required_error: MESSAGES.FIELD_REQUIRED,
    invalid_type_error: MESSAGES.FIELD_REQUIRED,
  })
  .transform((valor) => valor.trim())
  .superRefine(medirImagensMantidas)
  .transform((texto): ReadonlyArray<string> => comoListaDeIdentificadores(texto) ?? []);

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
const CAMPOS_DO_ANIMAL = {
  name: nomeDoAnimalSchema,
  speciesId: identificadorObrigatorioSchema,
  size: conjuntoFechado(PORTES),
  sex: conjuntoFechado(SEXOS),
  cityId: identificadorObrigatorioSchema,
  birthDate: dataDeNascimentoSchema,
  description: descricaoSchema,
  acceptsOtherAnimals: alternanciaSchema,
  needsLargeSpace: alternanciaSchema,
};

export const createAnimalBodySchema = objetoSemCamposExtras(CAMPOS_DO_ANIMAL);

/**
 * ============================================================================
 * Corpo do `PATCH /api/animals/:id` (RN-35, RN-47, RN-50, contrato de edicao)
 * ============================================================================
 *
 * OS MESMOS campos do cadastro, mais dois — e "os mesmos" e literal: a forma vem
 * do proprio `CAMPOS_DO_ANIMAL`, e nao de uma copia. Reescrever os nove campos
 * aqui faria a primeira revisao do limite do nome, do fuso da data ou do
 * vocabulario de porte valer no cadastro e nao valer na edicao, e o defeito so
 * apareceria pelo lado que ninguem testou.
 *
 * `status` continua FORA (RN-16, CT-68), e continua fora pelo mesmo mecanismo do
 * cadastro: nao esta na forma, entao cai na recusa de chave nao prevista com
 * "Campo não permitido nesta requisição.". A alteracao de status e operacao
 * propria, com endpoint proprio (TASK-BACKEND-009).
 *
 * `id` tambem nao esta na forma, e a ausencia e a RN-06: o identificador do
 * animal e estavel, entao ele vive no CAMINHO (`animalIdParamsSchema`) e nunca no
 * corpo — nao ha por onde a edicao renomear o recurso que ela edita.
 */
export const updateAnimalBodySchema = objetoSemCamposExtras({
  ...CAMPOS_DO_ANIMAL,
  updatedAt: marcaDeAlteracaoSchema,
  keepImageIds: imagensMantidasSchema,
});

/**
 * ============================================================================
 * Corpo do `PATCH /api/animals/:id/status` (RN-13, RN-16, RN-46, RN-47)
 * ============================================================================
 *
 * O UNICO endpoint de ESCRITA da feature que continua sob o
 * `express.json({ limit: '10kb' })` do `app.ts`: o corpo e `application/json` e
 * nao `multipart/form-data`, porque nao ha arquivo a enviar. E dai vem a
 * diferenca de gramatica em relacao a tudo o que esta acima neste arquivo — aqui
 * os valores chegam com o TIPO que o cliente escreveu, entao `null` e `42` sao
 * `null` e `42`, e nao `"null"` e `"42"`.
 *
 * `uploadAnimalImages` NAO e montado nesta rota: o middleware de multipart recusa
 * `Content-Type: application/json` com `415`, e monta-lo aqui faria toda
 * alteracao de status legitima ser recusada antes de chegar ao schema.
 */

/**
 * RN-13 — os quatro status, no vocabulario PUBLICO (minusculo, sem acento). Os
 * rotulos acentuados ("Disponível", "Indisponível") sao da interface e os
 * literais MAIUSCULOS (`DISPONIVEL`) sao do enum do banco; a traducao para eles
 * acontece na fronteira do service.
 *
 * Tipado a partir de `PublicAnimalStatus` do mapper pelo mesmo motivo de `PORTES`
 * e `SEXOS`: acrescentar um status no mapper sem acrescenta-lo aqui e erro de
 * compilacao, em vez de um valor que a leitura devolve e a escrita recusa.
 */
const STATUS: readonly [PublicAnimalStatus, ...PublicAnimalStatus[]] = [
  'disponivel',
  'reservado',
  'adotado',
  'indisponivel',
];

/**
 * NAO usa `conjuntoFechado`, e a diferenca e a razao de este schema existir
 * separado.
 *
 * `conjuntoFechado` RAMIFICA a mensagem: campo ausente ou em branco sai como
 * "Este campo é obrigatório." e so o valor estranho sai como "Selecione uma opção
 * válida.". Aquela ramificacao existe porque os campos do FORMULARIO chegam de um
 * `multipart/form-data`, onde um `<select>` sem escolha viaja como `""` e e um
 * campo nao preenchido, e nao um valor invalido.
 *
 * Aqui o contrato pede o OPOSTO, e pede nominalmente: `status` ausente, `""`,
 * `null`, `42` e `"VENDIDO"` produzem TODOS
 * `details: [{ field: "status", message: "Selecione uma opção válida." }]`,
 * sem ramificacao (CT-72, CA-32). E coerente com o transporte: nao ha formulario
 * do outro lado — ha um `<select>` da LISTAGEM que so envia requisicao quando o
 * administrador ja escolheu um valor, entao qualquer coisa fora dos quatro e uma
 * chamada direta a API (RN-33), para a qual "selecione uma opção válida" e a
 * unica correcao possivel.
 *
 * `errorMap` e nao `invalid_type_error`, pelo mesmo motivo registrado em
 * `conjuntoFechado`: `invalid_type_error` so alcanca o problema `invalid_type`, e
 * um valor FORA da lista produz `invalid_enum_value` — codigo diferente, que
 * sairia com o default ingles do Zod na resposta ao usuario (RNF-22). Verificado:
 * `null` e `42` produzem `invalid_type`, `""` e `"VENDIDO"` produzem
 * `invalid_enum_value`, e os quatro passam pelo mapa.
 *
 * `STATUS` entra SEM assercao, aqui e em `conjuntoFechado`. O `z.enum` do Zod
 * 3.25.76 tem sobrecarga para tupla imutavel — `<U extends string, T extends
 * Readonly<[U, ...U[]]>>(values: T) => ZodEnum<Writeable<T>>` — entao o
 * `readonly` da constante e aceito e o tipo resultante e o mesmo
 * `ZodEnum<[PublicAnimalStatus, ...]>` que a dupla assercao produzia. Nao
 * reintroduza `as unknown as`: alem de desnecessario, ele apagaria o erro de
 * compilacao no dia em que a lista deixasse de casar com `PublicAnimalStatus`.
 */
const statusSchema = z.enum(STATUS, {
  errorMap: () => ({ message: MESSAGES.INVALID_OPTION }),
});

/**
 * Corpo do `PATCH /api/animals/:id/status`.
 *
 * DOIS campos e mais nenhum (RN-16, RN-46): qualquer outra chave — inclusive
 * `name`, e principalmente `name` — cai na recusa com "Campo não permitido nesta
 * requisição." (CT-75). E a garantia de que este endpoint altera EXCLUSIVAMENTE
 * o status: nao ha por onde um campo do animal entrar, entao nao ha o que o
 * service precise lembrar de ignorar (CT-69, CA-30).
 *
 * `objetoSemCamposExtras` e NAO `.strict()`, que o texto da TASK-BACKEND-009
 * pedia nominalmente ate a emenda 1 da rodada de revisao 1: o
 * `unrecognized_keys` do Zod sai com `path: []`,
 * o `validationErrorFromZodError` faz `path.join('.')` e o cliente receberia
 * `details: [{ field: "", ... }]`, que nao marca campo nenhum — enquanto a tabela
 * de falhas da spec exige `field: "<chave>"`. Mesma razao ja registrada no
 * proprio `objetoSemCamposExtras`, em `species.validators.ts` e em
 * `auth.validators.ts`.
 *
 * `updatedAt` e o MESMO `marcaDeAlteracaoSchema` da edicao, e nao uma segunda
 * declaracao: e o mesmo token de bloqueio otimista, lido do mesmo `GET` e
 * comparado com a mesma coluna (RN-47). Duas declaracoes divergiriam no dia em
 * que a forma aceita mudasse, e o defeito apareceria pelo lado que ninguem
 * testou.
 */
export const changeStatusBodySchema = objetoSemCamposExtras({
  status: statusSchema,
  updatedAt: marcaDeAlteracaoSchema,
});

/** Tipos derivados dos schemas: nenhum DTO duplicando a mesma forma. */
export type ListAnimalsQuery = z.infer<typeof listAnimalsQuerySchema>;
export type AnimalIdParams = z.infer<typeof animalIdParamsSchema>;
export type CreateAnimalBody = z.infer<typeof createAnimalBodySchema>;
export type UpdateAnimalBody = z.infer<typeof updateAnimalBodySchema>;
export type ChangeStatusBody = z.infer<typeof changeStatusBodySchema>;
