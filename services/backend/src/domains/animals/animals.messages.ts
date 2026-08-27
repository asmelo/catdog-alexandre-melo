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
 * `upload-animal-images.middleware.ts` consome. A TASK-BACKEND-007 ACRESCENTOU o
 * bloco de escrita; a TASK-BACKEND-008 ACRESCENTOU o bloco de edicao. Os textos
 * de exclusao entram na fatia seguinte, no mesmo arquivo — nao antecipados aqui.
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

  // --- Escrita do animal (TASK-BACKEND-007, contrato de `POST /api/animals`) ---

  /**
   * Campo obrigatorio ausente ou em branco. Acompanha o `VALIDATION_ERROR`
   * (400), em `details`, no `field` do campo que faltou.
   *
   * UMA chave para TODOS os campos obrigatorios (`name`, `speciesId`, `size`,
   * `sex`, `cityId`), e nao uma por campo: a tabela "Mensagens ao Usuario" da
   * spec fixa uma unica frase para a condicao "campo obrigatorio em branco", e
   * e o `field` do `details` — nao o texto — que diz ao administrador QUAL
   * campo corrigir. Cinco chaves com o mesmo literal so criariam cinco lugares
   * onde ele pode divergir.
   */
  FIELD_REQUIRED: 'Este campo é obrigatório.',

  /**
   * RN-03 / RN-04 — limites do nome, contados sobre o valor JA normalizado
   * (aparado e com espacos internos colapsados). Sem essa ordem, `"  Theo  "`
   * seria medido com 8 caracteres e um nome que apos o colapso ficasse com 1
   * caractere seria aceito (CT-04, CT-05, CT-06, CT-07).
   */
  NAME_TOO_SHORT: 'O nome do animal deve ter no mínimo 2 caracteres.',
  NAME_TOO_LONG: 'O nome do animal deve ter no máximo 60 caracteres.',

  /** RN-23 — 1000 caracteres contados DEPOIS do `trim` (CT-21). */
  DESCRIPTION_TOO_LONG: 'A descrição deve ter no máximo 1000 caracteres.',

  /**
   * RN-19 — as duas bordas da data de nascimento, comparadas no fuso
   * America/Sao_Paulo e nao no fuso do processo. A data de HOJE e sempre aceita
   * (CT-15, CT-16, CT-17).
   */
  BIRTH_DATE_IN_FUTURE: 'A data de nascimento não pode ser futura.',
  BIRTH_DATE_TOO_OLD: 'Informe uma data de nascimento dos últimos 30 anos.',

  /**
   * NAO consta da tabela "Mensagens ao Usuario", pela mesma razao ja registrada
   * em `INVALID_PAGE`: a spec so previu texto para data futura e para data
   * antiga demais, porque a interface usa um seletor de data e nunca produz
   * `"05/11/2022"` nem `"ontem"`. Quem alcanca esta mensagem e quem chama a API
   * diretamente (RN-33), e sem ela o Zod entregaria o literal ingles
   * `"Invalid date"` na resposta ao usuario, que a RNF-22 (Idioma) proibe. O
   * texto nomeia o formato aceito porque e a unica correcao possivel.
   */
  INVALID_BIRTH_DATE: 'Informe a data de nascimento no formato AAAA-MM-DD.',

  /**
   * RN-11, RN-12, RN-24 — valor fora do conjunto fechado de `size`, de `sex` ou
   * dos dois indicadores de convivencia (CT-12).
   *
   * A mesma frase serve aos quatro campos porque a spec a fixa para a condicao
   * "porte, sexo ou status fora da lista", e porque ela e verdadeira tambem para
   * uma alternancia que chegue com algo que nao seja `"true"` nem `"false"`.
   */
  INVALID_OPTION: 'Selecione uma opção válida.',

  /**
   * RN-26 — a cidade informada nao existe no cadastro de apoio. Acompanha o
   * `code` `CITY_NOT_FOUND` (404).
   *
   * Vive AQUI e nao em `geography.messages.ts`, ao lado de `STATE_NOT_FOUND`: a
   * falha e do cadastro de ANIMAL, e um import cruzado faria uma revisao de
   * texto na geografia mudar em silencio a resposta de `POST /api/animals`. E a
   * mesma razao ja registrada em `INVALID_IDENTIFIER`.
   */
  CITY_NOT_FOUND: 'Cidade não encontrada.',

  /**
   * NAO consta da tabela "Mensagens ao Usuario": a spec nao previu texto para um
   * envio que chega com tipo de conteudo diferente de `multipart/form-data`,
   * porque a interface sempre envia o formulario correto. A recusa existe para
   * quem chama a API diretamente (RN-33), e por isso o texto nomeia o formato
   * esperado em vez de falar de campo ou de imagem.
   */
  UNSUPPORTED_MEDIA_TYPE: 'Envie os dados do animal como multipart/form-data.',

  // --- Edicao do animal (TASK-BACKEND-008, contrato de `PATCH /api/animals/:id`) ---

  /**
   * RN-47 / RN-48 — o animal mudou entre a leitura que alimentou o formulario e
   * a gravacao. Acompanha o `code` `ANIMAL_STALE_UPDATE` (409).
   *
   * O texto manda RECARREGAR e REFAZER, e nao "tente novamente": repetir a mesma
   * requisicao com o mesmo token falharia identicamente, porque o token ficou
   * para tras. A frase e comparada caractere a caractere pelo CA-29.
   */
  ANIMAL_STALE_UPDATE:
    'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',

  /**
   * CT-62 — `keepImageIds` cita uma imagem que NAO pertence a este animal.
   *
   * Sai em `details`, no `field` `keepImageIds`, dentro de um `400
   * VALIDATION_ERROR` — e NAO como `404`. O recurso da requisicao e o ANIMAL, que
   * existe; o que esta errado e um campo do corpo. Um `404` aqui faria a interface
   * concluir que o animal sumiu e voltar para a listagem, perdendo tudo o que o
   * administrador havia preenchido.
   */
  IMAGE_NOT_FOUND: 'Imagem não encontrada.',

  /**
   * RN-47 — `updatedAt` ausente, em branco ou fora do formato de data e hora.
   *
   * NAO consta da tabela "Mensagens ao Usuario", pela mesma razao ja registrada em
   * `INVALID_BIRTH_DATE`: a interface sempre devolve o `updatedAt` que o `GET`
   * serializou, entao quem alcanca esta mensagem e quem chama a API diretamente
   * (RN-33). Sem ela o Zod entregaria texto em ingles ao usuario (RNF-22). O
   * texto nomeia o formato porque e a unica correcao possivel.
   *
   * Campo AUSENTE ou em BRANCO sai como `FIELD_REQUIRED`, e nao com este texto:
   * um `<input type="hidden">` nao preenchido e um campo obrigatorio faltando, e
   * nao um formato errado — mesma precedencia ja aplicada em `medirIdentificador`.
   */
  INVALID_UPDATED_AT: 'Informe a data e hora da última alteração no formato ISO 8601.',

  /**
   * RN-35 — `keepImageIds` chegou, mas nao e uma lista JSON de identificadores.
   *
   * O campo trafega como TEXTO porque o corpo e `multipart/form-data`: um array
   * de verdade nao existe do outro lado. Alcanca JSON malformado, JSON que nao e
   * lista e item que nao tem forma de UUID. `"[]"` e valido e significa "remover
   * todas" — nao cai aqui.
   */
  INVALID_KEEP_IMAGE_IDS:
    'Informe as imagens mantidas como uma lista JSON de identificadores.',

  /**
   * RN-35 — o mesmo identificador aparece duas vezes em `keepImageIds`.
   *
   * Recusado em vez de deduplicado em silencio: a lista E a ordem final das
   * imagens (`position` 0 e a capa), e uma imagem nao pode ocupar duas posicoes.
   * Deduplicar faria a resposta devolver menos imagens do que o administrador
   * listou, sem nada explicando a diferenca; e aceitar faria a soma do limite da
   * RN-50 contar a mesma imagem duas vezes.
   */
  DUPLICATED_KEEP_IMAGE_ID: 'Cada imagem mantida deve aparecer uma única vez na lista.',
} as const;
