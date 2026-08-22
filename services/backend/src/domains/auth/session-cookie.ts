import type { CookieOptions, Response } from 'express';

import { env } from '~/config/env';

/**
 * Transporte do refresh token: cookie `HttpOnly`, nunca o corpo da resposta.
 *
 * E a unica combinacao que da imunidade a XSS (JavaScript da pagina nao le o
 * valor) e ainda faz a sessao sobreviver ao F5, o que `localStorage` daria
 * apenas ao custo de ficar legivel por qualquer script injetado.
 */

export const REFRESH_COOKIE_NAME = 'catdog_rt';

/**
 * Escopo deliberadamente estreito: o cookie NAO acompanha nenhuma chamada de
 * negocio (`/api/produtos`, `/api/pedidos`), so as rotas de sessao. Menos
 * requisicoes carregando a credencial de longa duracao, menor a superficie de
 * vazamento em log de proxy e em extensao de navegador.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Atributos de IDENTIDADE do cookie. O navegador identifica um cookie pela
 * tripla (nome, dominio, caminho): se a remocao usar caminho ou dominio
 * diferentes da criacao, ela cria um cookie vazio ao lado do original em vez de
 * apagar qualquer coisa. Extrair a base e o que impede as duas funcoes de
 * divergirem com o tempo.
 */
function atributosBase(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: REFRESH_COOKIE_PATH,
    // Espalhamento condicional, e nao `domain: env.COOKIE_DOMAIN || undefined`:
    // `COOKIE_DOMAIN` e opcional e o `exactOptionalPropertyTypes` do projeto
    // recusa `undefined` explicito em propriedade opcional. Ausente e o
    // comportamento desejado — sem `Domain`, o cookie fica restrito ao host
    // exato que o emitiu, que e mais estreito do que qualquer dominio declarado.
    ...(env.COOKIE_DOMAIN === undefined ? {} : { domain: env.COOKIE_DOMAIN }),
  };
}

export function buildRefreshCookieOptions(): CookieOptions {
  return {
    ...atributosBase(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * MILISSEGUNDOS_POR_DIA,
  };
}

/**
 * Remove o cookie de sessao. Usado no logout e tambem em QUALQUER falha da
 * renovacao: manter no navegador um refresh token que o servidor ja recusa faria
 * o cliente insistir num loop de 401 em vez de mandar o usuario ao login.
 */
export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, atributosBase());
}
