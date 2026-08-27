/**
 * Catalogo UNICO dos textos PT-BR do dominio de animais, no mesmo formato do
 * `species.messages.ts`.
 *
 * Contrato literal: a tabela "Mensagens ao Usuario" da spec e comparada caractere
 * a caractere pelos criterios de aceite, entao nada aqui pode ser reescrito por
 * estilo. As chaves acompanham o `code` do erro correspondente porque o frontend
 * ramifica sempre pelo `code` e NUNCA pelo texto de `message`.
 *
 * A TASK-BACKEND-003 declarou os textos que a entrada de arquivos produz; a
 * TASK-BACKEND-006 ACRESCENTOU o bloco de leitura abaixo. O arquivo e sempre
 * ESTENDIDO, nunca reescrito: sobrescreve-lo apagaria as mensagens que o
 * `upload-animal-images.middleware.ts` consome. Os textos de escrita entram nas
 * fatias seguintes, no mesmo arquivo — nao antecipados aqui.
 */
export const MESSAGES = {
  // --- Guarda comum de validacao (contrato de API da spec) ---
  VALIDATION_GUARD: 'Verifique os campos informados.',
  FIELD_NOT_ALLOWED: 'Campo não permitido nesta requisição.',

  // --- Leitura do animal (RN-44, contrato de `GET /api/animals`) ---

  /**
   * Animal inexistente na consulta por identificador. Acompanha o `code`
   * `ANIMAL_NOT_FOUND` (404).
   *
   * NAO distingue "nunca existiu" de "ja foi excluido" (RN-44): a distincao
   * informaria a quem sonda a API que aquele identificador ja existiu, e nao
   * muda em nada o que o administrador pode fazer a respeito.
   */
  ANIMAL_NOT_FOUND: 'Animal não encontrado.',

  /**
   * `id` de caminho que nao tem a forma de um UUID. Acompanha o
   * `VALIDATION_ERROR` (400), em `details`, no `field` `id`.
   *
   * Mesmo texto do `INVALID_ID` de especies e do `INVALID_IDENTIFIER` de
   * geografia: a spec usa uma unica frase para "o identificador que voce mandou
   * nao tem a forma de um identificador", qualquer que seja o recurso. A chave
   * NAO e importada daqueles catalogos — cada dominio tem o seu, e um import
   * cruzado faria uma revisao de texto em geografia mudar em silencio a resposta
   * de animais.
   */
  INVALID_IDENTIFIER: 'Identificador inválido.',

  /**
   * Parametros de paginacao fora da faixa (RN-42). Acompanham o
   * `VALIDATION_ERROR` (400), em `details`, nos `field` `page` e `pageSize`.
   *
   * NAO constam da tabela "Mensagens ao Usuario" da spec, que so fixa a
   * mensagem-guarda "Verifique os campos informados." para esta falha. As duas
   * chaves existem porque `details` exige UM texto por campo, e sem elas o
   * default do Zod entregaria ao administrador o literal ingles
   * "Expected number, received nan" — texto em outro idioma exibido ao usuario,
   * que a RNF-22 (Idioma) proibe. Quem consome as duas chaves nao e so o
   * `superRefine`: elas sao tambem o `invalid_type_error` de cada campo em
   * `animals.validators.ts`, e e esse segundo uso que fecha o caminho do `NaN`.
   * O texto nomeia a faixa aceita
   * porque quem chama a API direto e o unico que consegue produzir esta falha —
   * a interface so envia valores que ela mesma calculou.
   */
  INVALID_PAGE: 'A página deve ser um número inteiro maior ou igual a 1.',
  INVALID_PAGE_SIZE: 'O tamanho da página deve ser um número inteiro entre 1 e 100.',

  // --- Entrada de arquivos (RN-31, RN-32, RN-50, RN-51, RN-54) ---
  ANIMAL_IMAGE_LIMIT_EXCEEDED: 'É permitido no máximo 5 imagens por animal.',
  ANIMAL_IMAGE_TYPE_NOT_ALLOWED: 'Apenas imagens JPEG ou PNG são aceitas.',
  ANIMAL_IMAGE_TOO_LARGE: 'Cada imagem deve ter no máximo 5 MB.',
  IMAGE_FILE_EMPTY: 'O arquivo enviado está vazio.',
  REQUEST_BODY_TOO_LARGE:
    'O envio ultrapassou o tamanho máximo permitido. Envie menos imagens ou imagens menores.',

  // --- Armazenamento de objetos (RN-38, RN-39) ---
  IMAGE_STORAGE_UNAVAILABLE: 'Não foi possível salvar as imagens. Tente novamente.',

  /**
   * NAO consta da tabela "Mensagens ao Usuario": a spec nao previu texto para um
   * envio que chega com tipo de conteudo diferente de `multipart/form-data`,
   * porque a interface sempre envia o formulario correto. A recusa existe para
   * quem chama a API diretamente (RN-33), e por isso o texto nomeia o formato
   * esperado em vez de falar de campo ou de imagem.
   */
  UNSUPPORTED_MEDIA_TYPE: 'Envie os dados do animal como multipart/form-data.',
} as const;
