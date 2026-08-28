import type { AuthRole } from '~/contexts/auth/auth.types';

/**
 * Todos os caminhos da aplicacao, em um lugar so.
 *
 * Em PT-BR de proposito: o produto e PT-BR e a URL e interface visivel ao
 * usuario. `as const` faz cada valor ser um tipo literal, entao um erro de
 * digitacao em `<Navigate to={...}>` nao compila.
 *
 * `CONFIRM_EMAIL` NAO pode ser renomeado sem mudar o backend junto: o
 * `send-confirmation-mail.service.ts` monta o link como
 * `${APP_WEB_URL}/confirmar-email?token=...`, e `APP_WEB_URL` cai no default
 * `http://localhost:5173`. Divergir aqui quebra a HU-02 em producao sem quebrar
 * nenhum teste — o e-mail sai, o usuario clica e chega numa 404.
 */
export const ROUTE_PATHS = {
  ROOT: '/',
  LOGIN: '/login',
  REGISTER: '/cadastro',
  CHECK_EMAIL: '/verifique-seu-email',
  CONFIRM_EMAIL: '/confirmar-email',
  ADMIN_HOME: '/admin',
  ADMIN_ANIMALS: '/admin/animais',
  ADMIN_ANIMALS_NEW: '/admin/animais/novo',
  /**
   * Caminho com PARAMETRO, para declarar a rota. Para NAVEGAR ate um animal
   * concreto use `adminAnimalEditPath(id)` — interpolar `:id` a mao no ponto de
   * uso e o que produz um `/admin/animais/:id/editar` literal na barra de
   * endereco quando alguem esquece a substituicao.
   */
  ADMIN_ANIMALS_EDIT: '/admin/animais/:id/editar',
  ADMIN_SPECIES: '/admin/especies',
  CLIENT_HOME: '/minha-area',
} as const;

/**
 * Caminho de edicao de um animal concreto.
 *
 * Existe para que `ADMIN_ANIMALS_EDIT` — que carrega o `:id` literal porque e a
 * DECLARACAO da rota — nunca seja usado como destino de navegacao. Sao usos
 * diferentes do mesmo caminho, e o compilador nao distingue os dois: `<Navigate
 * to={ROUTE_PATHS.ADMIN_ANIMALS_EDIT}>` compila e leva o usuario para uma pagina
 * inexistente.
 *
 * `encodeURIComponent` porque o `id` vem de dado, e nao de literal. Ele e um UUID
 * hoje, mas quem escreve o caminho nao tem como garantir isso no ponto de uso.
 */
export function adminAnimalEditPath(id: string): string {
  return `/admin/animais/${encodeURIComponent(id)}/editar`;
}

/**
 * Destino de `/admin`, que deixou de renderizar pagina propria e passou a
 * redirecionar para a primeira area administrativa disponivel.
 *
 * Aponta para as especies ENQUANTO A FEATURE DE ANIMAIS NAO EXISTIR. A feature
 * seguinte do modulo muda esta linha — e so ela: `ADMIN_HOME` continua sendo
 * `/admin` e `homePathForRole('admin')` continua devolvendo `/admin`, porque o
 * `PublicOnlyRoute`, o `RoleRoute` e a tela de login dependem desse valor.
 */
export const ADMIN_DEFAULT_PATH = ROUTE_PATHS.ADMIN_SPECIES;

/**
 * Chaves finitas (nao e assinatura de indice), portanto o acesso abaixo devolve
 * `string` e nao `string | undefined` mesmo sob `noUncheckedIndexedAccess` — e o
 * compilador cobra uma entrada nova aqui se uma role for acrescentada ao
 * `AuthRole`.
 */
const HOME_POR_ROLE: Readonly<Record<AuthRole, string>> = {
  admin: ROUTE_PATHS.ADMIN_HOME,
  cliente: ROUTE_PATHS.CLIENT_HOME,
};

/**
 * Destino de quem esta autenticado. Materializa a RN-09: o destino e decidido
 * EXCLUSIVAMENTE pela role que veio no token.
 *
 * DEFINICAO UNICA, por exigencia de aceite. Tres consumidores dependem dela — o
 * pos-login (TASK-FRONTEND-012), o `PublicOnlyRoute` e o `RoleRoute` — e tres
 * copias do mesmo `switch` divergiriam no primeiro perfil novo, cada uma
 * mandando o usuario para um lugar diferente.
 */
export function homePathForRole(role: AuthRole): string {
  return HOME_POR_ROLE[role];
}

/**
 * Caracteres que NAO podem existir num caminho interno.
 *
 * `\\` cobre a barra invertida, que e o vetor da advisory GHSA-wrjc-x8rr-h8h6
 * (open redirect no `react-router@6.30.6`, bypass do CVE-2025-68470): `<Link>` e
 * `useNavigate` tratam `/\evil.com` como destino externo.
 *
 * `\s` cobre tabulacao, LF e CR — exatamente os tres caracteres que o navegador
 * REMOVE de uma URL antes de resolve-la. Sem eles na lista, `/\t\evil.com`
 * passaria pela validacao como caminho interno e viraria `/\evil.com` na hora da
 * navegacao. Espaco e demais espacos Unicode entram de graca e nao custam nada:
 * um caminho real chega sempre percent-encoded (`%20`).
 */
const CARACTERES_HOSTIS = /[\s\\]/;

/**
 * Reduz um destino de navegacao a um caminho INTERNO, ou descarta.
 *
 * Aceita apenas quem comeca com UMA barra. Rejeita:
 * - o que nao comeca com `/` (`https://evil.com`, `evil.com`, `javascript:...`);
 * - `//evil.com` — URL relativa a protocolo, que o navegador resolve como host
 *   externo. E tambem a forma NORMALIZADA de `/\evil.com`: o navegador troca a
 *   barra invertida por barra antes de a aplicacao ver o caminho, entao esta e a
 *   variante que chega de fato pela barra de enderecos;
 * - qualquer barra invertida ou caractere removido pelo navegador (ver acima).
 *
 * A sanitizacao acontece na CRIACAO do destino (dentro das guardas), nao no
 * consumo. E deliberado: quem cria e um lugar so, quem consome sao varios, e um
 * consumidor futuro que esqueca de validar herda algo que ja e seguro em vez de
 * abrir o buraco de novo.
 */
export function toInternalPath(candidato: string | null | undefined): string {
  if (typeof candidato !== 'string' || !candidato.startsWith('/')) {
    return ROUTE_PATHS.ROOT;
  }

  if (candidato.startsWith('//') || CARACTERES_HOSTIS.test(candidato)) {
    return ROUTE_PATHS.ROOT;
  }

  return candidato;
}

/**
 * O `state` que as guardas anexam ao redirecionar para o login, para que a tela
 * de login saiba de onde o usuario veio.
 */
export interface RedirectState {
  readonly from: string;
}

/** Subconjunto do `Location` do roteador que interessa aqui. Tipo estrutural para nao acoplar este modulo ao react-router. */
interface DestinoDeRetorno {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/**
 * Monta o `state.from` das guardas — JA sanitizado.
 *
 * Guarda o caminho como STRING, e nao o objeto `Location` inteiro como o plano
 * sugeria: um `Location` carrega o `pathname` cru (e o proprio `state` anterior)
 * e devolveria ao consumidor exatamente o valor nao validado que precisamos
 * eliminar. Uma string sanitizada nao tem como esconder nada.
 */
export function buildRedirectState(destino: DestinoDeRetorno): RedirectState {
  return { from: toInternalPath(`${destino.pathname}${destino.search}${destino.hash}`) };
}

/**
 * Le o destino de retorno de um `location.state` de origem desconhecida.
 *
 * Existe para a TASK-FRONTEND-012: o `state` de navegacao e dado de entrada
 * (qualquer pagina pode ter chamado `navigate(..., { state })`, e o `history` do
 * navegador o preserva entre recargas), portanto NAO pode ser lido como
 * `state.from` cru e passado direto ao `navigate`. Revalida em vez de confiar —
 * o custo e uma chamada e o beneficio e o open redirect nao voltar por um
 * caminho novo.
 */
export function readRedirectTarget(state: unknown, fallback: string): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return fallback;
  }

  const bruto: unknown = state.from;

  if (typeof bruto !== 'string') {
    return fallback;
  }

  const seguro = toInternalPath(bruto);

  // `ROOT` aqui significa "descartado" ou "veio da raiz". Nos dois casos o
  // destino melhor e o fallback (a home da role), nao a raiz — que so
  // redirecionaria para a home da role de novo.
  return seguro === ROUTE_PATHS.ROOT ? fallback : seguro;
}
