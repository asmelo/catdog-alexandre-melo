/**
 * Catalogo UNICO dos textos PT-BR do dominio de animais, no mesmo formato do
 * `species.messages.ts`.
 *
 * Contrato literal: a tabela "Mensagens ao Usuario" da spec e comparada caractere
 * a caractere pelos criterios de aceite, entao nada aqui pode ser reescrito por
 * estilo. As chaves acompanham o `code` do erro correspondente porque o frontend
 * ramifica sempre pelo `code` e NUNCA pelo texto de `message`.
 *
 * Esta fatia (TASK-BACKEND-003) declara apenas os textos que a entrada de
 * arquivos produz. Os textos de leitura e de escrita do animal entram nas fatias
 * seguintes, no mesmo arquivo — nao antecipados aqui.
 */
export const MESSAGES = {
  // --- Guarda comum de validacao (contrato de API da spec) ---
  VALIDATION_GUARD: 'Verifique os campos informados.',
  FIELD_NOT_ALLOWED: 'Campo não permitido nesta requisição.',

  // --- Entrada de arquivos (RN-31, RN-32, RN-50, RN-51, RN-54) ---
  ANIMAL_IMAGE_LIMIT_EXCEEDED: 'É permitido no máximo 5 imagens por animal.',
  ANIMAL_IMAGE_TYPE_NOT_ALLOWED: 'Apenas imagens JPEG ou PNG são aceitas.',
  ANIMAL_IMAGE_TOO_LARGE: 'Cada imagem deve ter no máximo 5 MB.',
  IMAGE_FILE_EMPTY: 'O arquivo enviado está vazio.',
  REQUEST_BODY_TOO_LARGE:
    'O envio ultrapassou o tamanho máximo permitido. Envie menos imagens ou imagens menores.',

  /**
   * NAO consta da tabela "Mensagens ao Usuario": a spec nao previu texto para um
   * envio que chega com tipo de conteudo diferente de `multipart/form-data`,
   * porque a interface sempre envia o formulario correto. A recusa existe para
   * quem chama a API diretamente (RN-33), e por isso o texto nomeia o formato
   * esperado em vez de falar de campo ou de imagem.
   */
  UNSUPPORTED_MEDIA_TYPE: 'Envie os dados do animal como multipart/form-data.',
} as const;
