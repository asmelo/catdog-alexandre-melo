/**
 * Catalogo UNICO dos textos PT-BR do dominio de geografia (estados e
 * municipios), no mesmo formato de `species.messages.ts` e `animals.messages.ts`.
 *
 * Contrato literal: os criterios de aceite da TASK-BACKEND-005 comparam a string
 * caractere a caractere, entao nada aqui pode ser reescrito por estilo. As
 * chaves acompanham o `code` do erro correspondente para que o frontend
 * ramifique sempre pelo `code` e NUNCA pelo texto da mensagem.
 *
 * Catalogo proprio, e nao chaves novas em `animals.messages.ts`: estado e
 * municipio sao dado de apoio com ciclo de vida independente do animal — nao ha
 * tela de manutencao, nao ha escrita e os dois endpoints existem para alimentar
 * qualquer formulario que precise de localizacao, nao apenas o de animal. O
 * dominio `animals` guarda "Cidade não encontrada." porque ali a cidade e um
 * campo do animal sendo gravado; aqui a unidade federativa e o proprio recurso.
 *
 * O que deliberadamente NAO esta aqui:
 *
 * 1. "Você não tem permissão para acessar este recurso." e "Sua sessão expirou.
 *    Faça login novamente." — produzidas pelos middlewares transversais de
 *    autorizacao e autenticacao. Uma segunda copia divergiria na primeira
 *    revisao de texto.
 * 2. "Verifique os campos informados." — mensagem-guarda do `VALIDATION_ERROR`,
 *    montada uma unica vez em `validationErrorFromZodError`.
 * 3. Os textos de carregamento e de falha do campo Cidade ("Carregando
 *    cidades...", "Não foi possível carregar as cidades. Tente novamente.").
 *    Sao estado de interface, nunca saem em resposta desta API e vivem no
 *    catalogo do frontend.
 */
export const MESSAGES = {
  /**
   * Sigla de duas letras bem formada que nao corresponde a nenhuma unidade
   * federativa cadastrada. Acompanha o `code` `STATE_NOT_FOUND` (404).
   */
  STATE_NOT_FOUND: 'Estado não encontrado.',

  /**
   * Sigla que nem chega a ser uma sigla ("PARANA", "P1", ""). Acompanha o
   * `VALIDATION_ERROR` (400), em `details`, no `field` `uf`.
   *
   * Mesmo texto do `INVALID_ID` de especies e da linha "`id` fora do formato
   * UUID" do contrato de animais: a spec usa uma unica frase para "o
   * identificador que voce mandou nao tem a forma de um identificador",
   * qualquer que seja o recurso. A chave se chama `INVALID_IDENTIFIER` e nao
   * `INVALID_ID` porque aqui o identificador do recurso e a SIGLA, e nao um
   * `id`.
   */
  INVALID_IDENTIFIER: 'Identificador inválido.',
} as const;
