import { z } from 'zod';

import { MESSAGES } from '~/domains/species/species.messages';
import { normalizeSpeciesName, speciesNameKey } from '~/domains/species/species-name';

/**
 * Schemas de entrada das rotas de especies. Sao a UNICA fronteira de validacao e
 * o UNICO ponto de normalizacao do nome: o `validateRequest` reatribui o
 * resultado sobre `req.body`, entao o service e o repositorio recebem o nome
 * PRONTO e nao renormalizam nada.
 */

/** RN-02 — limites contados sobre o nome JA normalizado pela RN-03. */
const TAMANHO_MINIMO_DO_NOME = 2;

/**
 * RN-02 e, ao mesmo tempo, o limite fisico das colunas `name` e
 * `name_normalized`, ambas `VARCHAR(60)`.
 */
const TAMANHO_MAXIMO_DO_NOME = 60;

/**
 * Caracteres invisiveis que o `\s` do JavaScript NAO reconhece e que, por isso,
 * sobrevivem ao colapso de espacos da RN-03: espaco de largura zero e seus
 * vizinhos (U+200B a U+200F, que incluem os marcadores de direcao de texto),
 * hifen suave, colador de palavras e BOM.
 *
 * Sem esta remocao, `"Ga\u200Bto"` chega ao banco como uma chave de unicidade
 * DIFERENTE de `"gato"` e o cadastro passa a exibir duas linhas visualmente
 * identicas — exatamente a duplicata que a RN-04 existe para impedir. Como o
 * usuario nao ve o caractere, recusar a requisicao produziria um erro
 * inexplicavel na tela; remover e o desfecho que corresponde ao que ele digitou.
 *
 * Vive AQUI e nao em `species-name.ts` de proposito: `normalizeSpeciesName` e o
 * contrato de forma da RN-03, que a spec descreve como exatamente duas
 * operacoes (aparar e colapsar). Esta e uma higienizacao de entrada nao
 * prevista pela spec, aplicada antes daquele contrato e apenas sobre o que chega
 * pela borda HTTP.
 */
const CARACTERES_INVISIVEIS = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g;

function higienizar(bruto: string): string {
  return normalizeSpeciesName(bruto.replace(CARACTERES_INVISIVEIS, ''));
}

/**
 * `superRefine` unico, e nao uma cadeia de `.min()`/`.max()`: o Zod acumula cada
 * problema de uma cadeia de checks no mesmo campo, e um nome em branco sairia
 * com duas mensagens ("obrigatorio" e "minimo de 2 caracteres") em `details`. Um
 * unico bloco com `return` explicito fixa a PRECEDENCIA exigida pela tabela de
 * mensagens da spec e mantem uma mensagem por campo:
 *
 *   1. vazio depois de normalizar  -> obrigatorio  (CT-02 / CT-03)
 *   2. menos de 2 caracteres       -> minimo       (CT-04)
 *   3. mais de 60 caracteres       -> maximo       (CT-07)
 */
function medirNome(nome: string, contexto: z.RefinementCtx): void {
  if (nome.length === 0) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.NAME_REQUIRED });

    return;
  }

  if (nome.length < TAMANHO_MINIMO_DO_NOME) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.NAME_TOO_SHORT });

    return;
  }

  /**
   * As DUAS medicoes, e nao so a do nome: `toLowerCase()` pode AUMENTAR o
   * comprimento da string. `'İ'` (U+0130) vira dois code units, entao 60 desses
   * caracteres passam no limite de `name` e estouram os 60 de
   * `name_normalized` — o `INSERT` seria recusado pelo Postgres e uma entrada
   * apenas longa demais viraria 500 em vez de 400. Medir a chave aqui e o que
   * mantem o desfecho no dominio da validacao.
   *
   * A mensagem e a mesma dos 61 caracteres comuns porque e a unica prevista pela
   * spec para "nao cabe em 60", e ela continua verdadeira: o nome informado nao
   * pode ser gravado dentro do limite.
   */
  if (
    nome.length > TAMANHO_MAXIMO_DO_NOME ||
    speciesNameKey(nome).length > TAMANHO_MAXIMO_DO_NOME
  ) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.NAME_TOO_LONG });
  }
}

/**
 * O `transform` roda ANTES das medicoes: os limites da RN-02 sao contados sobre
 * o valor normalizado, e nao sobre o texto cru (CA-07). `"   "` chega ao
 * `medirNome` como `""`, que e o que permite reportar obrigatoriedade em vez de
 * "minimo 2 caracteres".
 *
 * `required_error`/`invalid_type_error` explicitos porque o default do Zod para
 * campo ausente e o literal ingles "Required" (RNF-12).
 */
const speciesNameSchema = z
  .string({
    required_error: MESSAGES.NAME_REQUIRED,
    invalid_type_error: MESSAGES.NAME_REQUIRED,
  })
  .transform(higienizar)
  .superRefine(medirNome);

/**
 * Corpo do `POST /api/species` — RECUSA qualquer chave alem de `name` (RN-13 /
 * CT-33).
 *
 * Nao usa `.strict()`, pela mesma razao ja registrada em `auth.validators.ts`: o
 * `unrecognized_keys` do Zod sai com `path: []`, o `validationErrorFromZodError`
 * faz `path.join('.')` e o frontend receberia `details: [{ field: '', ... }]`,
 * que nao marca nenhum campo. O contrato da spec para esta falha exige
 * `field: "<chave>"`. Com `.passthrough()` as chaves extras sobrevivem ao parse e
 * o `superRefine` emite UM problema por chave, com `path` preenchido. Nada e
 * afrouxado: qualquer chave extra continua reprovando a requisicao.
 *
 * `required_error`/`invalid_type_error` do objeto cobrem o corpo que nem objeto
 * e (um array, unico caso que o `express.json` deixa passar): sem eles a
 * mensagem seria o "Expected object, received array" do Zod, em ingles.
 */
export const createSpeciesSchema = z
  .object(
    { name: speciesNameSchema },
    {
      required_error: MESSAGES.NAME_REQUIRED,
      invalid_type_error: MESSAGES.NAME_REQUIRED,
    },
  )
  .passthrough()
  .superRefine((valor, contexto) => {
    for (const chave of Object.keys(valor)) {
      if (chave !== 'name') {
        contexto.addIssue({
          code: z.ZodIssueCode.unrecognized_keys,
          keys: [chave],
          path: [chave],
          message: MESSAGES.FIELD_NOT_ALLOWED,
        });
      }
    }
  });

/** Tipo derivado do schema: nenhum DTO duplicando a mesma forma. */
export type CreateSpeciesBody = z.infer<typeof createSpeciesSchema>;
