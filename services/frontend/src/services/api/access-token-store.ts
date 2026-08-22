/**
 * Guarda do access token — variavel de modulo, viva apenas enquanto a aba
 * existir.
 *
 * DUAS proibicoes deliberadas, e as duas tem consequencia visivel:
 *
 * 1. **Nunca `localStorage` nem `sessionStorage`.** Token em storage e legivel
 *    por qualquer script injetado na pagina, e uma unica falha de XSS entregaria
 *    a sessao inteira. O preco aceito e que um F5 apaga o token — coberto pelo
 *    estado `bootstrapping` do `AuthProvider`, que troca o cookie `HttpOnly` de
 *    refresh por um access token novo antes de os guards decidirem qualquer
 *    coisa. O refresh token, esse, nunca passa por aqui: ele vive so no cookie
 *    `catdog_rt` (`HttpOnly`, `Path=/api/auth`), inacessivel ao JavaScript.
 * 2. **Fora do estado do React.** Renovar a sessao acontece dentro do ciclo de
 *    uma requisicao qualquer; se o token fosse estado, cada renovacao
 *    re-renderizaria a arvore inteira sem nenhuma mudanca visual. Fora do React,
 *    o token tambem nao aparece na arvore de componentes das devtools nem em
 *    serializacao acidental de props.
 */

let tokenEmMemoria: string | null = null;

export function getAccessToken(): string | null {
  return tokenEmMemoria;
}

export function setAccessToken(token: string): void {
  tokenEmMemoria = token;
}

export function clearAccessToken(): void {
  tokenEmMemoria = null;
}
