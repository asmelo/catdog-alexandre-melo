import { z } from 'zod';

import { MESSAGES } from '~/domains/geography/geography.messages';

/**
 * Schema de entrada da rota `GET /api/states/:uf/cities`. E a UNICA fronteira de
 * validacao do dominio e o UNICO ponto de normalizacao da sigla: o
 * `validateRequest` reatribui o resultado sobre `req.params`, entao o controller,
 * o service e o repositorio recebem a sigla PRONTA, em maiusculas, e nenhum
 * deles renormaliza nada.
 *
 * A normalizacao vive AQUI e nao no repositorio de proposito. A coluna `uf` e
 * `CHAR(2)` com indice unico e guarda as siglas em maiusculas; um
 * `toUpperCase()` espalhado por cada consulta seria a mesma regra em varios
 * lugares, e o primeiro ponto que esquecesse dela responderia `404` para `pr`.
 */

/** Sigla de unidade federativa: exatamente duas letras (RN-25). */
const COMPRIMENTO_DA_SIGLA = 2;

/**
 * Ancorado e sem `i`: a caixa e resolvida pelo `transform` logo abaixo, e nao
 * pelo padrao. `[A-Za-z]` e nao `\w` porque `\w` aceitaria digito e sublinhado,
 * e nao e `\p{L}` porque sigla de UF brasileira nao tem acento nem cedilha —
 * `ÇE` deve ser recusado.
 */
const PADRAO_DA_SIGLA = /^[A-Za-z]{2}$/;

/**
 * `superRefine` unico com `return` explicito, e NAO a cadeia
 * `.length(2).regex(...)`.
 *
 * A cadeia foi verificada contra o Zod 3.25.76 em uso e ACUMULA os problemas:
 * para `uf: "PARANA"` os dois checks falham e o `validationErrorFromZodError`,
 * que mapeia `issues` um a um, produz
 * `details: [{ field: "uf", ... }, { field: "uf", ... }]` — a MESMA mensagem
 * duas vezes. O criterio de aceite desta task cita `"PARANA"` nominalmente e
 * exige `details` com UM item, e a interface marcaria o campo duas vezes.
 *
 * O bloco unico fixa a precedencia e mantem uma mensagem por campo. E o mesmo
 * remedio, pela mesma razao, ja aplicado em `medirNome` no dominio de especies.
 *
 * As duas verificacoes sao mantidas separadas mesmo com o padrao ancorado
 * subsumindo o comprimento: e o comprimento que descreve o erro de quem digitou
 * o nome do estado por extenso, o caso comum, e a intencao das duas regras fica
 * legivel para quem alterar o schema depois.
 */
function medirSigla(sigla: string, contexto: z.RefinementCtx): void {
  if (sigla.length !== COMPRIMENTO_DA_SIGLA) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_IDENTIFIER });

    return;
  }

  if (!PADRAO_DA_SIGLA.test(sigla)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: MESSAGES.INVALID_IDENTIFIER });
  }
}

/**
 * Parametro de caminho `:uf`.
 *
 * Validado como `params` no `validateRequest`, e nao dentro do corpo, porque e o
 * `issue.path` que vira o `field` do `details`: com o schema montado sobre a
 * secao de parametros, o problema sai como
 * `details: [{ field: "uf", message: "Identificador inválido." }]`, exigido pelo
 * contrato.
 *
 * O `transform` roda DEPOIS da medicao — em `pr` as duas verificacoes ja passam,
 * entao a ordem nao muda nenhum desfecho; ela existe para que a sigla so seja
 * normalizada depois de reconhecida como sigla.
 *
 * `required_error`/`invalid_type_error` explicitos porque o default do Zod para
 * campo ausente e o literal ingles "Required". O Express sempre entrega
 * `req.params` com strings, entao os dois sao guarda de contrato e nao caminho
 * esperado — mas o schema tambem e usado como fonte do tipo do controller, e
 * deixar o default em ingles seria uma mensagem em ingles esperando por um
 * refactor de rota.
 */
export const listCitiesParamsSchema = z.object({
  uf: z
    .string({
      required_error: MESSAGES.INVALID_IDENTIFIER,
      invalid_type_error: MESSAGES.INVALID_IDENTIFIER,
    })
    .superRefine(medirSigla)
    .transform((sigla) => sigla.toUpperCase()),
});

/** Tipo derivado do schema: nenhum DTO duplicando a mesma forma. */
export type ListCitiesParams = z.infer<typeof listCitiesParamsSchema>;
