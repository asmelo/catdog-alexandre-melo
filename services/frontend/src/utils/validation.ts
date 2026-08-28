import { MESSAGES } from '~/utils/messages';

/**
 * Validacao de formulario — funcoes PURAS, sem React.
 *
 * Sem hook, sem estado e sem import de componente de proposito: e o que permite
 * exercitar cada regra chamando uma funcao (TASK-FRONTEND-013) em vez de montar
 * uma arvore, digitar num campo e ler o DOM. Uma regra de validacao verificada
 * por consulta ao DOM e uma regra verificada de forma indireta.
 *
 * O RESULTADO E UM MAPA `campo -> mensagem`, e nao um booleano com uma lista de
 * frases: e a mesma forma que `fieldErrorsOf` produz a partir do `details` de um
 * `VALIDATION_ERROR` da API. Com as duas origens na mesma forma, a tela tem UM
 * estado de erros de campo — e nao um estado para o erro local e outro para o
 * erro do servidor, que divergiriam na primeira tela nova.
 *
 * ESTA CAMADA NAO E SEGURANCA. A validacao que vale e a do servidor
 * (`auth.validators.ts`, TASK-BACKEND-004): qualquer regra daqui e pulavel por
 * quem chamar a API diretamente. O que ela entrega e resposta imediata ao
 * usuario e, nos casos CT-03 e CT-04, a AUSENCIA de requisicao — que e
 * exatamente o que o criterio de aceite cobra.
 */

/** Mapa de erros por campo. Campo ausente do mapa significa campo valido. */
export type FieldErrors = Readonly<Record<string, string>>;

/** RN-04. O mesmo numero do `passwordSchema` do backend. */
const TAMANHO_MINIMO_DA_SENHA = 8;

/** RN-02 do MODULE-002. Contado sobre o nome JA normalizado pela RN-03. */
const TAMANHO_MINIMO_DO_NOME_DE_ESPECIE = 2;

/**
 * RN-02 do MODULE-002 e, no backend, tambem o limite fisico das colunas `name` e
 * `name_normalized` (`VARCHAR(60)`).
 */
const TAMANHO_MAXIMO_DO_NOME_DE_ESPECIE = 60;

/** RN-04 do MODULE-002 / FEATURE-002. Contado sobre o nome JA normalizado. */
const TAMANHO_MINIMO_DO_NOME_DE_ANIMAL = 2;
const TAMANHO_MAXIMO_DO_NOME_DE_ANIMAL = 60;

/** RN-23. Contado sobre a descricao JA normalizada quanto a espacos. */
const TAMANHO_MAXIMO_DA_DESCRICAO = 1000;

/** RN-19. A janela aceita para a data de nascimento. */
const IDADE_MAXIMA_EM_ANOS = 30;

/**
 * Colapso de espacos da RN-03. `\s+` e nao `' +'`: o campo aceita colagem de
 * texto, e tabulacao e quebra de linha precisam virar um unico espaco como
 * qualquer outro branco. Mesmo padrao do `species-name.ts` do backend.
 */
const SEQUENCIA_DE_ESPACOS = /\s+/g;

/**
 * Os MESMOS code points que o `higienizar` da borda HTTP do backend remove
 * (`species.validators.ts`): espaco de largura zero e seus vizinhos
 * (U+200B a U+200F, que incluem os marcadores de direcao de texto), hifen suave
 * (U+00AD), colador de palavras (U+2060) e BOM (U+FEFF).
 *
 * Copiado literalmente, e nao "aproximado": qualquer code point a mais ou a
 * menos aqui devolve a divergencia de contagem que esta constante existe para
 * fechar. O servidor continua sendo a autoridade — remover aqui nao muda o que e
 * ENVIADO, so o que e MEDIDO antes de enviar.
 */
const CARACTERES_INVISIVEIS = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g;

/**
 * Formato de e-mail deliberadamente FROUXO: um caractere que nao seja espaço nem
 * `@`, um `@`, um dominio com ponto.
 *
 * Nao tenta reproduzir o RFC 5322 nem a regra do `z.string().email()` do
 * backend. Uma expressao mais rigida aqui produziria o pior defeito possivel
 * nesta camada — recusar no cliente um endereço que o servidor aceitaria,
 * impedindo o cadastro de um e-mail valido sem nenhuma forma de contornar. O
 * risco oposto (deixar passar algo que o servidor recusa) custa uma viagem de
 * rede e devolve `VALIDATION_ERROR` com a mensagem correta, que a tela ja sabe
 * distribuir pelos campos.
 */
const FORMATO_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Um par `campo -> mensagem`, ou nada.
 *
 * Objeto vazio em vez de `{ [campo]: undefined }`: a chave precisa ficar AUSENTE
 * do mapa, e nao presente com valor indefinido — `'name' in erros` e
 * `Object.keys(erros).length` sao o que as telas consultam para decidir se
 * chamam a API.
 */
function erroDoCampo(campo: string, mensagem: string | undefined): FieldErrors {
  return mensagem === undefined ? {} : { [campo]: mensagem };
}

/**
 * `.trim()` antes de medir: um campo com apenas espaços esta em branco para o
 * usuario, e o `nameSchema` do backend tambem apara antes de exigir conteudo.
 * Sem isso, " " passaria aqui e voltaria como `VALIDATION_ERROR` do servidor.
 */
function erroDeObrigatoriedade(valor: string): string | undefined {
  return valor.trim() === '' ? MESSAGES.VALIDATION.FIELD_REQUIRED : undefined;
}

/**
 * Obrigatoriedade tem precedencia sobre formato: um campo vazio recebe
 * "Este campo é obrigatório." e nao "Informe um e-mail válido.", porque o
 * problema que o usuario precisa resolver primeiro e o de preencher.
 */
function erroDeEmail(valor: string): string | undefined {
  const emBranco = erroDeObrigatoriedade(valor);

  if (emBranco !== undefined) {
    return emBranco;
  }

  return FORMATO_DE_EMAIL.test(valor.trim()) ? undefined : MESSAGES.VALIDATION.EMAIL_INVALID;
}

/**
 * A senha NAO passa por `.trim()` antes de ser medida — espaço e caractere valido
 * de senha, e apara-lo mudaria em silencio o segredo escolhido. Mesma decisao do
 * `passwordSchema` do backend.
 *
 * A obrigatoriedade e verificada sobre a string CRUA: uma senha de oito espaços
 * e uma senha ruim, nao uma senha ausente.
 */
function erroDeSenhaNova(valor: string): string | undefined {
  if (valor === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  return valor.length < TAMANHO_MINIMO_DA_SENHA
    ? MESSAGES.VALIDATION.PASSWORD_TOO_SHORT
    : undefined;
}

/**
 * Igualdade entre senha e confirmacao — RN-12 em codigo.
 *
 * Este e o UNICO lugar do sistema que conhece a confirmacao de senha: ela nao
 * existe no `RegistrationInput`, nao existe no corpo do `POST /auth/register` e
 * nao existe no schema do backend (que reprova qualquer chave extra). A
 * comparacao acontece aqui e o valor morre no estado do formulario.
 *
 * A divergencia so e reportada quando a confirmacao esta PREENCHIDA: com o campo
 * vazio a mensagem correta e "Este campo é obrigatório.", e emitir
 * "As senhas não coincidem." para um campo em branco culparia o usuario por algo
 * que ele ainda nao fez.
 */
function erroDeConfirmacaoDeSenha(senha: string, confirmacao: string): string | undefined {
  if (confirmacao === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  return senha === confirmacao ? undefined : MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH;
}

/**
 * RN-03 — remove os espacos das extremidades e colapsa sequencias de espacos
 * internos em um unico espaco. `"  Cão   Pastor "` vira `"Cão Pastor"`, com dez
 * caracteres para efeito de contagem (CT-10 / CA-07).
 *
 * PRESERVA caixa e acentos: o nome e exibido como o administrador digitou.
 *
 * Esta copia ESPELHA a regra do servidor e nao a substitui. Ela e o SEGUNDO dos
 * dois passos que fazem a contagem local bater com a do backend ANTES da
 * requisicao — sem ela, `"  Ov  "` seria medido com seis caracteres aqui e com
 * dois la, e a tela recusaria um nome que o servidor aceitaria. Sozinha ela NAO
 * basta para contar: o primeiro passo, a remocao dos invisiveis, esta em
 * `higienizarNomeDeEspecie`, e e aquela funcao — nao esta — que quem for medir
 * caracteres deve chamar.
 *
 * O texto ENVIADO continua sendo o que o usuario digitou, e e o backend que grava
 * a forma normalizada: normalizar antes de enviar deslocaria a autoridade sobre a
 * RN-03 para o cliente, onde ela nao pode ser garantida.
 *
 * E EXATAMENTE DUAS OPERACOES, como o `normalizeSpeciesName` do
 * `species-name.ts` do backend — este e o contrato literal da RN-03, e nada
 * alem dele entra aqui. A higienizacao dos caracteres invisiveis, que a spec nao
 * preve, fica em `higienizarNomeDeEspecie` e roda ANTES desta funcao, no mesmo
 * arranjo de duas camadas que o backend usa entre `species-name.ts` e
 * `species.validators.ts`. Quem precisa da contagem que o servidor fara deve
 * chamar aquela, e nao esta.
 */
export function normalizeSpeciesName(bruto: string): string {
  return bruto.trim().replace(SEQUENCIA_DE_ESPACOS, ' ');
}

/**
 * A BORDA: remove os caracteres invisiveis e so entao normaliza — a mesma ordem
 * do `higienizar` do backend (`species.validators.ts`). E este valor, e nao o da
 * funcao acima, que `erroDeNomeDeEspecie` mede.
 *
 * A ORDEM E O PONTO, nao um detalhe de estilo. O `\s` do JavaScript casa
 * `U+FEFF`: normalizar primeiro converteria o BOM em ESPACO em vez de remove-lo,
 * e um nome de sessenta caracteres alternando letra e BOM sairia com noventa
 * aqui contra sessenta no servidor. Os demais code points nao sao branco nenhum,
 * sobrevivem intactos ao colapso e cada um soma 1 a um total que o servidor nao
 * conta.
 *
 * Sem esta funcao a divergencia corre na direcao proibida — recusar no cliente o
 * que o servidor aceita —, que o comentario de `FORMATO_DE_EMAIL` acima ja
 * declara ser o pior defeito possivel nesta camada. Aqui seria pior ainda: o
 * caractere e invisivel, entao o usuario ve um nome dentro do limite ser
 * recusado por tamanho e nao tem o que apagar.
 */
function higienizarNomeDeEspecie(bruto: string): string {
  return normalizeSpeciesName(bruto.replace(CARACTERES_INVISIVEIS, ''));
}

/**
 * Precedencia IDENTICA a do `speciesNameSchema` do backend, e com `return`
 * explicito entre os degraus: um nome em branco recebe "Este campo é
 * obrigatório." e nao "no mínimo 2 caracteres.", porque o problema que o usuario
 * precisa resolver primeiro e o de preencher. As duas camadas so produzem a
 * mesma mensagem para a mesma entrada se a ordem for a mesma.
 *
 * A medicao acontece sobre o valor JA higienizado e normalizado, e nao sobre o
 * texto cru — `"   "` chega aqui como `""` e cai no degrau da obrigatoriedade
 * (CT-03).
 *
 * DIVERGENCIA QUE PERMANECE — UMA SO, e deliberada: o backend mede tambem o
 * comprimento da CHAVE de unicidade (`speciesNameKey`, `species.validators.ts`),
 * porque `toLowerCase()` pode AUMENTAR a string — `İ` (U+0130) vira dois code
 * units, e sessenta deles cabem em `name` mas estouram os sessenta de
 * `name_normalized`. Reproduzir isso aqui traria para dentro da tela uma regra
 * de PERSISTENCIA do servidor, sobre uma coluna que o cliente nao conhece.
 *
 * Ela corre na direcao SEGURA: deixa passar um nome que o servidor recusa, e o
 * caso volta como `VALIDATION_ERROR` com exatamente a mensagem que esta funcao
 * emitiria — custa uma viagem de rede e nada mais. A direcao oposta, recusar
 * aqui o que o servidor aceita, e a que nao pode existir; e por isso que a
 * higienizacao dos invisiveis E replicada, em `higienizarNomeDeEspecie`.
 *
 * Fora essa medicao da chave, os dois lados produzem a mesma mensagem para a
 * mesma entrada: mesma higienizacao, mesma normalizacao, mesma ordem entre as
 * duas, mesmos limites e mesma precedencia entre os tres degraus.
 */
function erroDeNomeDeEspecie(bruto: string): string | undefined {
  const nome = higienizarNomeDeEspecie(bruto);

  if (nome === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  if (nome.length < TAMANHO_MINIMO_DO_NOME_DE_ESPECIE) {
    return MESSAGES.VALIDATION.NAME_TOO_SHORT;
  }

  return nome.length > TAMANHO_MAXIMO_DO_NOME_DE_ESPECIE
    ? MESSAGES.VALIDATION.NAME_TOO_LONG
    : undefined;
}

export interface LoginFormValues {
  readonly email: string;
  readonly password: string;
}

/**
 * Valores do formulario de cadastro, INCLUINDO a confirmacao de senha.
 *
 * Tipo proprio, e nao `RegistrationInput` acrescido de um campo: sao coisas
 * diferentes de proposito. `RegistrationInput` e o que TRAFEGA; este e o que o
 * usuario digitou. Reaproveitar o primeiro aqui abriria a porta para alguem
 * passar o objeto do formulario inteiro ao `register()` — o defeito exato que a
 * RN-12 proibe.
 */
export interface RegisterFormValues {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirmation: string;
}

/**
 * Valida o formulario de login.
 *
 * O TAMANHO MINIMO DA SENHA NAO SE APLICA AQUI, e a omissao e deliberada. Uma
 * senha de sete caracteres na tela de login deve produzir
 * "E-mail ou senha incorretos." como qualquer outra credencial errada:
 * responder "A senha deve ter pelo menos 8 caracteres." informaria a quem sonda
 * o sistema qual e o formato aceito e, para uma conta antiga com senha mais
 * curta, bloquearia o login em vez de recusar a credencial. E a mesma decisao do
 * `loginSchema` do backend, que exige apenas conteudo.
 */
export function validateLoginForm(values: LoginFormValues): FieldErrors {
  return {
    ...erroDoCampo('email', erroDeEmail(values.email)),
    ...erroDoCampo('password', erroDeObrigatoriedade(values.password)),
  };
}

/**
 * Valida o formulario de cadastro por completo — quatro campos numa passada.
 *
 * TODAS as regras sao avaliadas, e nao apenas a primeira que falha: um
 * formulario que aponta um problema por vez obriga o usuario a submeter quatro
 * vezes para descobrir os quatro erros. Cada campo recebe no maximo UMA
 * mensagem, porque e o que cabe abaixo do campo.
 */
export function validateRegisterForm(values: RegisterFormValues): FieldErrors {
  return {
    ...erroDoCampo('name', erroDeObrigatoriedade(values.name)),
    ...erroDoCampo('email', erroDeEmail(values.email)),
    ...erroDoCampo('password', erroDeSenhaNova(values.password)),
    ...erroDoCampo(
      'passwordConfirmation',
      erroDeConfirmacaoDeSenha(values.password, values.passwordConfirmation),
    ),
  };
}

/**
 * Valida o formulario de um campo so de e-mail — o pedido de novo link de
 * confirmacao. Existe para que a tela de confirmacao nao tenha de reimplementar
 * obrigatoriedade e formato por conta propria.
 */
export function validateEmailOnlyForm(email: string): FieldErrors {
  return erroDoCampo('email', erroDeEmail(email));
}

/**
 * Valores do formulario de nome de especie — um objeto de um campo so, e nao a
 * string crua.
 *
 * A forma existe para casar com a chave do mapa devolvido: o erro sai como
 * `{ name: ... }`, que e exatamente o `field` que o `details` do
 * `VALIDATION_ERROR` do backend usa. Com as duas origens produzindo a mesma
 * chave, a tela tem UM caminho de exibicao de erro de campo.
 */
export interface SpeciesNameFormValues {
  readonly name: string;
}

/**
 * Valida o nome da especie — a MESMA funcao para a criacao e para a edicao em
 * linha.
 *
 * Uma so, e nao uma por tela: as duas operacoes tem contrato de validacao
 * identico (o `PATCH` do backend reusa o `speciesNameSchema` do `POST` pelo
 * mesmo motivo), e uma segunda copia divergiria da primeira na primeira revisao
 * de limite.
 *
 * ESTA CAMADA NAO E A AUTORIDADE. Ela nao verifica unicidade — a RN-04 depende
 * do que ja esta gravado e so o servidor sabe — nem substitui a validacao do
 * `speciesNameSchema`. O que ela entrega e resposta imediata e, nos casos CT-03,
 * CT-04 e CT-07, a AUSENCIA de requisicao.
 */
export function validateSpeciesNameForm(values: SpeciesNameFormValues): FieldErrors {
  return erroDoCampo('name', erroDeNomeDeEspecie(values.name));
}

/* ------------------------------------------------------------------------- */
/*  MODULE-002 / FEATURE-002 — formulário de animal                           */
/* ------------------------------------------------------------------------- */

/**
 * Valores do formulário de animal, todos como TEXTO — é o que os controles
 * produzem, e converter antes de validar esconderia justamente o caso vazio.
 *
 * `state` está aqui porque o formulário o tem, mas **não** é validado no envio:
 * ele existe só para reduzir a lista de cidades, e o que trafega é a cidade
 * (RN-26a). Validar o estado criaria um segundo campo obrigatório que o contrato
 * não conhece.
 */
export interface AnimalFormValues {
  readonly name: string;
  readonly speciesId: string;
  readonly size: string;
  readonly sex: string;
  readonly cityId: string;
  readonly birthDate: string;
  readonly description: string;
}

function erroDeNomeDeAnimal(bruto: string): string | undefined {
  const normalizado = bruto.replace(SEQUENCIA_DE_ESPACOS, ' ').trim();

  if (normalizado === '') {
    return MESSAGES.VALIDATION.FIELD_REQUIRED;
  }

  if (normalizado.length < TAMANHO_MINIMO_DO_NOME_DE_ANIMAL) {
    return MESSAGES.VALIDATION.ANIMAL_NAME_TOO_SHORT;
  }

  if (normalizado.length > TAMANHO_MAXIMO_DO_NOME_DE_ANIMAL) {
    return MESSAGES.VALIDATION.ANIMAL_NAME_TOO_LONG;
  }

  return undefined;
}

/**
 * A descrição é OPCIONAL: vazia não é erro (RN-22). O limite é contado sobre o
 * texto já normalizado quanto a espaços, como no `descricaoSchema` do backend —
 * contar o texto cru faria os dois lados discordarem sobre um texto colado com
 * espaços repetidos.
 */
function erroDeDescricao(bruto: string): string | undefined {
  const normalizado = bruto.replace(SEQUENCIA_DE_ESPACOS, ' ').trim();

  return normalizado.length > TAMANHO_MAXIMO_DA_DESCRICAO
    ? MESSAGES.VALIDATION.DESCRIPTION_TOO_LONG
    : undefined;
}

/**
 * Data de nascimento — OPCIONAL, e comparada em DATA PURA.
 *
 * =============== A COMPARAÇÃO É POR TEXTO, E ISSO É DELIBERADO ===============
 *
 * `AAAA-MM-DD` ordena lexicograficamente na mesma ordem cronológica, então
 * comparar as strings dá o mesmo resultado que comparar datas — sem construir
 * `Date` nenhum. Construir um `Date` a partir de `"2022-11-05"` produz meia-noite
 * UTC, e ler o dia a oeste de Greenwich devolve o dia anterior: a validação
 * recusaria "hoje" como futura durante as três primeiras horas de cada dia no
 * Brasil.
 *
 * ================= ESTA VERIFICAÇÃO É APENAS RETORNO IMEDIATO =================
 *
 * O "hoje" usado aqui é o do RELÓGIO DO NAVEGADOR, que pode estar em qualquer
 * fuso ou simplesmente errado. A recusa que vale é a do servidor, feita em
 * America/Sao_Paulo (RN-19). Replicar aqui a lógica de fuso do backend criaria
 * duas implementações da mesma regra, que divergiriam em silêncio — e a
 * divergência apareceria como um formulário que aceita o que o servidor recusa.
 */
function erroDeDataDeNascimento(valor: string, hoje: string): string | undefined {
  if (valor === '') {
    return undefined;
  }

  if (valor > hoje) {
    return MESSAGES.VALIDATION.BIRTH_DATE_IN_FUTURE;
  }

  const limite = new Date(`${hoje}T00:00:00Z`);

  limite.setUTCFullYear(limite.getUTCFullYear() - IDADE_MAXIMA_EM_ANOS);

  /**
   * `toISOString().slice(0, 10)` sobre um `Date` construído e lido inteiramente
   * em UTC: nenhum fuso local participa da conta, e o resultado é a mesma data
   * pura de trinta anos atrás em qualquer máquina.
   */
  return valor < limite.toISOString().slice(0, 10)
    ? MESSAGES.VALIDATION.BIRTH_DATE_TOO_OLD
    : undefined;
}

/** Data local do navegador em `AAAA-MM-DD`, sem passar por UTC. */
function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${String(agora.getFullYear())}-${mes}-${dia}`;
}

/**
 * Valida o formulário de animal — a MESMA função para o cadastro e para a edição.
 *
 * Uma só, e não uma por modo: o `PATCH` do backend reusa o schema do `POST`, e
 * uma segunda cópia divergiria da primeira na primeira revisão de limite.
 *
 * `hoje` entra por parâmetro, com o relógio do navegador como padrão: é o que
 * permite exercitar as bordas da janela de 30 anos sem congelar o relógio do
 * processo de teste.
 */
export function validateAnimalForm(
  values: AnimalFormValues,
  hoje: string = hojeLocal(),
): FieldErrors {
  return {
    ...erroDoCampo('name', erroDeNomeDeAnimal(values.name)),
    ...erroDoCampo('speciesId', erroDeObrigatoriedade(values.speciesId)),
    ...erroDoCampo('size', erroDeObrigatoriedade(values.size)),
    ...erroDoCampo('sex', erroDeObrigatoriedade(values.sex)),
    ...erroDoCampo('cityId', erroDeObrigatoriedade(values.cityId)),
    ...erroDoCampo('birthDate', erroDeDataDeNascimento(values.birthDate, hoje)),
    ...erroDoCampo('description', erroDeDescricao(values.description)),
  };
}

/** Acucar de leitura para `Object.keys(erros).length > 0` nos pontos de submissao. */
export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
