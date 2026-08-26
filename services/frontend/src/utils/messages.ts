/**
 * Catalogo dos textos ESTATICOS das telas.
 *
 * Duas fontes normativas, e nenhuma delas admite reescrita por estilo:
 *
 * 1. `.makuco/resources/reference.html` — os sete textos da tela de login
 *    ("Bem vindo!", o subtitulo, os dois placeholders, "Entrar", "Não tem uma
 *    conta?" e "Cadastre-se") sao copiados caractere a caractere do mockup.
 * 2. A tabela "Mensagens ao Usuário" da spec — as frases de validacao e a de
 *    registro concluido, tambem literais (acentos e ponto final inclusos).
 *
 * O QUE NAO ESTA AQUI, de proposito: as mensagens que a API devolve.
 * "E-mail ou senha incorretos.", "Este e-mail já está em uso.", "Sua conta ainda
 * não foi confirmada. Verifique seu e-mail.", "Conta confirmada! Faça login para
 * continuar.", "Este link de confirmação expirou. Solicite um novo e-mail de
 * confirmação." e "Este link de confirmação já foi utilizado." chegam prontas em
 * `ApiError.message` / `MessageResponse.message`, escritas pelo catalogo
 * `auth.messages.ts` do backend. Copia-las para ca criaria DUAS fontes de
 * verdade para a mesma frase, e a divergencia apareceria como um texto que passa
 * no teste do backend e reprova no criterio da tela.
 *
 * "Esqueceu sua senha?" existe no mockup e esta AUSENTE deste catalogo de
 * proposito: recuperacao de senha esta fora do escopo da feature
 * ("Esta feature não implementa recuperação de senha"), e um link que nao leva a
 * nada e pior para o usuario do que a ausencia do link.
 *
 * O QUE NAO ESTA AQUI, no bloco `SPECIES`, pela mesma regra: as mensagens que a
 * API de especies devolve. Sete frases, nomeadas pela chave de origem em vez de
 * transcritas — transcreve-las neste arquivo, ainda que em comentario, e o
 * primeiro passo para alguem copiar uma delas para dentro do catalogo:
 *
 * - do `species.messages.ts` do backend: `NAME_ALREADY_EXISTS`
 *   (`code` `SPECIES_NAME_ALREADY_EXISTS`), `SPECIES_NOT_FOUND`
 *   (`code` homonimo), `SPECIES_IN_USE` (`code` homonimo), `INVALID_ID` e
 *   `FIELD_NOT_ALLOWED` (ambas dentro do `details` de um `VALIDATION_ERROR`);
 * - dos middlewares transversais: a recusa por falta de permissao (`FORBIDDEN`)
 *   e a de sessao vencida (`SESSION_EXPIRED`).
 *
 * Todas chegam prontas em `ApiError.message`. A tela ramifica pelo `code` e
 * exibe o `message` que veio — nunca compara o texto, e nunca o reescreve daqui
 * (CA-22). `FORM.SESSION_EXPIRED`, ja presente acima, e a unica excecao e existe
 * pelo motivo ali registrado: a tela de login a exibe quando a resposta que
 * derrubou a sessao ja foi consumida pelo cliente HTTP.
 */

/**
 * Textos que o backend tambem possui, replicados aqui porque sao usados em
 * situacoes em que NENHUMA resposta da API existe para carrega-los:
 *
 * - `SESSION_EXPIRED` e exibido pela tela de login quando o `logoutReason` do
 *   contexto vale `session-expired`. Nesse ponto a resposta que originou a queda
 *   da sessao ja foi consumida pelo cliente HTTP e nao chega a esta tela.
 * - `UNEXPECTED_ERROR` cobre a falha que nao virou `ApiError` (defeito de
 *   programacao na propria tela). Nao ha `message` a exibir.
 * - `CONFIRMATION_TOKEN_INVALID` cobre a URL de confirmacao SEM o parametro
 *   `token`, caso em que a API nao e chamada (nao ha o que enviar).
 * - `PASSWORD_TOO_SHORT`, `PASSWORDS_DO_NOT_MATCH` e `FIELD_REQUIRED` sao
 *   verificados no cliente ANTES de qualquer requisicao — e a confirmacao de
 *   senha, pela RN-12, nunca chega ao servidor.
 * - `SPECIES_NAME_TOO_SHORT` e `SPECIES_NAME_TOO_LONG` idem: `validateSpeciesNameForm`
 *   reprova o nome antes de chamar a API, e a requisicao que produziria o
 *   `VALIDATION_ERROR` correspondente nunca sai (CT-04 / CT-07).
 *
 * Cada literal e identico ao do `auth.messages.ts` do backend (ou ao do
 * `http-client.ts`, no caso de `UNEXPECTED_ERROR`).
 */
const TEXTOS_COMPARTILHADOS_COM_O_BACKEND = {
  /** Tabela da spec: "Campo obrigatório em branco". */
  FIELD_REQUIRED: 'Este campo é obrigatório.',
  /** Tabela da spec: "Senha com menos de 8 caracteres". */
  PASSWORD_TOO_SHORT: 'A senha deve ter pelo menos 8 caracteres.',
  /** Tabela da spec: "Senhas não coincidem". */
  PASSWORDS_DO_NOT_MATCH: 'As senhas não coincidem.',
  /** Fora da tabela da spec; literal do `MESSAGES.EMAIL_INVALID` do backend. */
  EMAIL_INVALID: 'Informe um e-mail válido.',
  /** Tabela da spec: "Sessão expirada (refresh token inválido)". */
  SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.',
  /** Literal do `MENSAGEM_ERRO_INESPERADO` do `http-client.ts`. */
  UNEXPECTED_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
  /** Literal do `MESSAGES.CONFIRMATION_TOKEN_INVALID` do backend. */
  CONFIRMATION_TOKEN_INVALID: 'Link de confirmação inválido.',
  /** Tabela da spec: "Registro bem-sucedido". */
  REGISTER_SUCCESS: 'Verifique seu e-mail para ativar sua conta.',
  /** Literal do `MESSAGES.NAME_TOO_SHORT` do `species.messages.ts` do backend. */
  SPECIES_NAME_TOO_SHORT: 'O nome da espécie deve ter no mínimo 2 caracteres.',
  /** Literal do `MESSAGES.NAME_TOO_LONG` do `species.messages.ts` do backend. */
  SPECIES_NAME_TOO_LONG: 'O nome da espécie deve ter no máximo 60 caracteres.',
} as const;

export const MESSAGES = {
  /** Mensagens de validacao de campo, produzidas por `~/utils/validation`. */
  VALIDATION: {
    FIELD_REQUIRED: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.FIELD_REQUIRED,
    EMAIL_INVALID: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.EMAIL_INVALID,
    PASSWORD_TOO_SHORT: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.PASSWORD_TOO_SHORT,
    PASSWORDS_DO_NOT_MATCH: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.PASSWORDS_DO_NOT_MATCH,
    /**
     * Nome da especie (RN-02). Os limites sao contados sobre o nome JA
     * normalizado pela RN-03, tanto aqui quanto no `speciesNameSchema` do
     * backend — e por isso que os dois lados chegam a mesma mensagem para o
     * mesmo texto digitado.
     *
     * `FIELD_REQUIRED` acima cobre o campo em branco e NAO e reescrito para
     * "Informe o nome da espécie": o literal exigido pela tabela da spec e o
     * mesmo dos formularios de autenticacao.
     */
    NAME_TOO_SHORT: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.SPECIES_NAME_TOO_SHORT,
    NAME_TOO_LONG: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.SPECIES_NAME_TOO_LONG,
  },

  /** Texto comum a mais de uma tela do fluxo. */
  FORM: {
    UNEXPECTED_ERROR: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.UNEXPECTED_ERROR,
    SESSION_EXPIRED: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.SESSION_EXPIRED,
    RESEND_CONFIRMATION: 'Reenviar e-mail de confirmação',
    SENDING: 'Enviando…',
  },

  /**
   * Tela de login. Os sete valores abaixo sao os do `reference.html`; nenhum
   * deles pode ser reescrito sem que o mockup mude junto.
   */
  LOGIN: {
    TITLE: 'Bem vindo!',
    SUBTITLE: 'Digite os seus dados de acesso no campo abaixo',
    EMAIL_LABEL: 'E-mail',
    EMAIL_PLACEHOLDER: 'Informar o seu e-mail',
    PASSWORD_LABEL: 'Senha',
    PASSWORD_PLACEHOLDER: 'Informar a sua senha',
    SUBMIT: 'Entrar',
    NO_ACCOUNT: 'Não tem uma conta?',
    SIGN_UP: 'Cadastre-se',
  },

  /**
   * Tela de cadastro. Os rotulos e placeholders NAO vem do mockup — ele so cobre
   * o login. Seguem a forma dos dois placeholders que ele define ("Informar o
   * seu e-mail", "Informar a sua senha") para que as duas telas nao pareçam
   * escritas por pessoas diferentes.
   */
  REGISTER: {
    TITLE: 'Criar conta',
    SUBTITLE: 'Preencha os seus dados para criar a sua conta',
    NAME_LABEL: 'Nome completo',
    NAME_PLACEHOLDER: 'Informar o seu nome completo',
    EMAIL_LABEL: 'E-mail',
    EMAIL_PLACEHOLDER: 'Informar o seu e-mail',
    PASSWORD_LABEL: 'Senha',
    PASSWORD_PLACEHOLDER: 'Criar uma senha de 8 caracteres ou mais',
    PASSWORD_CONFIRMATION_LABEL: 'Confirmação de senha',
    PASSWORD_CONFIRMATION_PLACEHOLDER: 'Repetir a senha',
    SUBMIT: 'Criar conta',
    HAS_ACCOUNT: 'Já tenho conta',
  },

  /** Aviso pos-cadastro (`/verifique-seu-email`). */
  CHECK_EMAIL: {
    TITLE: 'Verifique seu e-mail',
    /** Literal da tabela da spec, exigido pelo CT-01. */
    SUCCESS: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.REGISTER_SUCCESS,
    /**
     * A orientacao cita o spam porque e a causa mais comum de "não recebi o
     * e-mail" e evita um reenvio que geraria um segundo token.
     */
    GUIDANCE:
      'Abrimos a sua conta e enviamos um link de confirmação. Procure a mensagem na sua caixa de entrada e, se não encontrar, verifique a pasta de spam ou lixo eletrônico.',
    /**
     * O e-mail digitado NAO e exibido nesta tela. Ela e alcançavel por URL
     * direta, sem estado de navegacao, e imprimir um endereço vindo da URL
     * transformaria a pagina num refletor de texto arbitrario.
     */
    BACK_TO_LOGIN: 'Ir para a tela de login',
  },

  /**
   * Resultado da confirmacao de conta (`/confirmar-email`).
   *
   * Tres titulos e nao um: o `AuthCard` monta o unico `<h1>` da pagina, e ele e a
   * primeira coisa que o leitor de tela anuncia. Um titulo fixo
   * ("Confirmação de conta") obrigaria o usuario a ouvir o corpo da pagina para
   * saber se a conta foi confirmada ou nao.
   */
  CONFIRM_EMAIL: {
    LOADING_TITLE: 'Confirmando sua conta',
    LOADING: 'Estamos confirmando a sua conta. Isso leva apenas alguns instantes.',
    SUCCESS_TITLE: 'Conta confirmada',
    ERROR_TITLE: 'Não foi possível confirmar',
    MISSING_TOKEN: TEXTOS_COMPARTILHADOS_COM_O_BACKEND.CONFIRMATION_TOKEN_INVALID,
    EXPIRED_GUIDANCE:
      'Informe o seu e-mail para receber um novo link de confirmação.',
    EMAIL_LABEL: 'E-mail',
    EMAIL_PLACEHOLDER: 'Informar o seu e-mail',
    GO_TO_LOGIN: 'Ir para a tela de login',
  },

  /**
   * Tela de especies (`/admin/especies`).
   *
   * SO existe aqui o que NENHUMA resposta da API carrega. As tres frases de
   * sucesso entram por esse criterio, e nao por conveniencia: o `POST` e o
   * `PATCH` devolvem o recurso e o `DELETE` devolve `204`, entao nao ha
   * `message` a exibir depois de uma operacao bem-sucedida. `EMPTY_LIST` e
   * `LOAD_ERROR` idem — nascem de ausencia de resposta util (`items: []`) e de
   * uma falha cujo corpo, quando existe, nao descreve a tela.
   *
   * O caminho oposto — conflito, especie inexistente, especie em uso, falta de
   * permissao, sessao expirada — nao tem entrada neste bloco: essas mensagens
   * chegam em `ApiError.message` e sao exibidas como vieram.
   *
   * `PAGE_TITLE` e `NAME_PLACEHOLDER` sao contrato de interface (CA-02), copiados
   * da captura de tela que serve de fonte da verdade do layout.
   */
  SPECIES: {
    PAGE_TITLE: 'Espécies',
    NAME_PLACEHOLDER: 'Nome de espécie',
    CREATE_BUTTON: 'Criar',
    SAVE_BUTTON: 'Salvar',
    CANCEL_BUTTON: 'Cancelar',
    /**
     * Verbos soltos: as duas acoes da linha sao representadas por icone e o
     * `IconButton` exige nome acessivel identificando a acao E a especie
     * (RNF-07). Quem monta a linha compoe `${EDIT_ACTION} ${nome}` — por isso
     * sao "Editar"/"Excluir" e nao "Editar espécie", que produziria
     * "Editar espécie Gato" apenas por acidente de concordancia e ficaria errado
     * na primeira lista de outra entidade.
     */
    EDIT_ACTION: 'Editar',
    DELETE_ACTION: 'Excluir',
    /** Nome da regiao da `<ul>` do `DataList`, anunciado ao entrar na lista. */
    LIST_LABEL: 'Espécies cadastradas',
    CREATE_SUCCESS: 'Espécie criada com sucesso.',
    UPDATE_SUCCESS: 'Espécie atualizada com sucesso.',
    DELETE_SUCCESS: 'Espécie excluída com sucesso.',
    EMPTY_LIST: 'Nenhuma espécie cadastrada ainda. Crie a primeira acima.',
    LOAD_ERROR: 'Não foi possível carregar as espécies. Tente novamente.',
    LOADING_LABEL: 'Carregando espécies…',
    RETRY_BUTTON: 'Tentar novamente',
    /**
     * FUNCAO e nao template solto: a frase interpola o nome e precisa sair
     * IDENTICA em toda chamada (CA-13). Montar a string no ponto de uso faria a
     * segunda chamada divergir da primeira em pontuacao ou espacamento sem que
     * nada reprovasse.
     *
     * As aspas sao as CURVAS `“ ”` da tabela de mensagens da spec, nao `" "`: o
     * criterio compara o texto caractere a caractere.
     */
    deleteConfirmation(nome: string): string {
      return `Excluir a espécie “${nome}”? Esta ação não pode ser desfeita.`;
    },
  },

  /**
   * Area interna do cliente. Minima por contrato: existe para tornar o
   * redirecionamento por role verificavel, e o conteudo real e de outras
   * features.
   *
   * O bloco `ADMIN_HOME` que ficava aqui foi REMOVIDO: `/admin` deixou de
   * renderizar pagina propria e passou a redirecionar para a primeira area
   * administrativa disponivel (decisao 4 do changelog), entao os seus dois
   * textos nao tinham mais nenhum consumidor. `ROUTE_PATHS.ADMIN_HOME`, que
   * continua existindo, e outra coisa — o caminho, nao o texto.
   */
  CLIENT_HOME: {
    TITLE: 'Minha área',
    GREETING: 'Você está autenticado como cliente',
  },
} as const;
