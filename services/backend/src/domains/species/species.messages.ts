/**
 * Catalogo UNICO dos textos PT-BR do dominio de especies.
 *
 * Contrato literal: os criterios de aceite da FEATURE-001 do MODULE-002 comparam
 * a string caractere a caractere, entao nada aqui pode ser reescrito por estilo.
 * As chaves acompanham o `code` do erro correspondente para que o frontend
 * ramifique sempre pelo `code` e nunca pelo texto da mensagem.
 *
 * O que deliberadamente NAO esta aqui:
 *
 * 1. "Voce nao tem permissao para acessar este recurso." e "Sua sessao expirou.
 *    Faca login novamente." — produzidas pelos middlewares transversais e pelo
 *    dominio auth. Uma segunda copia divergiria na primeira revisao de texto.
 * 2. Os avisos de sucesso da tela (criacao, renomeacao e exclusao concluidas).
 *    Sao texto de interface e nao saem em nenhuma resposta desta API: o `POST`
 *    devolve o recurso e o `DELETE` devolve `204`. Vivem no catalogo do
 *    frontend.
 */
export const MESSAGES = {
  // --- Tabela "Mensagens ao Usuario" da spec ---
  NAME_REQUIRED: 'Este campo é obrigatório.',
  NAME_TOO_SHORT: 'O nome da espécie deve ter no mínimo 2 caracteres.',
  NAME_TOO_LONG: 'O nome da espécie deve ter no máximo 60 caracteres.',
  NAME_ALREADY_EXISTS: 'Já existe uma espécie com este nome.',
  SPECIES_NOT_FOUND: 'Espécie não encontrada.',
  SPECIES_IN_USE: 'Não é possível excluir esta espécie porque existem animais vinculados a ela.',

  // --- Validacao de parametro e de corpo (contrato de API da spec) ---
  INVALID_ID: 'Identificador inválido.',
  FIELD_NOT_ALLOWED: 'Campo não permitido nesta requisição.',
} as const;
