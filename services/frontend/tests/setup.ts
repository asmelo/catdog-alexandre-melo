import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

import { clearAccessToken } from '~/services/api/access-token-store';
import {
  markSessionRestored,
  setOnSessionExpired,
  setSessionRefresher,
} from '~/services/api/http-client';

/**
 * Setup executado antes de CADA arquivo de teste (`setupFilesAfterEnv`).
 *
 * O problema que este arquivo resolve nao e ergonomia, e vazamento de estado. O
 * frontend guarda tres coisas FORA do React, em variavel de modulo, por decisao
 * arquitetural das tasks 008 e 010:
 *
 * - o access token (`access-token-store`, deliberadamente fora de `localStorage`);
 * - o renovador de sessao e o aviso de expiracao registrados no `http-client`;
 * - a promessa da fila single-flight, que na FALHA fica retida de proposito
 *   (trava de sessao encerrada) e so sai com `markSessionRestored()`.
 *
 * Nenhuma dessas tres coisas e desfeita por `cleanup()`. Sem a limpeza abaixo, um
 * teste que derruba a sessao deixaria a fila travada e o proximo teste falharia
 * por um motivo que nao e o dele — e o resultado passaria a depender da ordem de
 * execucao, exatamente o que a AC #8 proibe.
 */
afterEach(() => {
  // Desmonta as arvores montadas por `render`, disparando os efeitos de limpeza
  // (e portanto o `setSessionRefresher(null)` do `AuthProvider`).
  cleanup();

  // Desfaz `jest.spyOn`. Complementa o `clearMocks` do `jest.config.ts`, que
  // apenas esvazia o historico de chamadas sem devolver a implementacao original.
  jest.restoreAllMocks();

  clearAccessToken();
  setSessionRefresher(null);
  setOnSessionExpired(null);
  markSessionRestored();
});

/**
 * Mensagem da guarda de rede. Texto explicito porque, se ela aparecer, e ela que
 * vai apontar o teste que esqueceu de dublar o `fetch`.
 */
const REDE_PROIBIDA =
  'Chamada real de rede em teste: nenhum spy de `fetch` estava instalado. ' +
  'Dubla o `fetch` no teste (jest.spyOn(globalThis, "fetch")).';

/**
 * GUARDA DE REDE — a AC #2 em codigo, e nao apenas em promessa.
 *
 * Duas razoes para existir, e as duas sao praticas:
 *
 * 1. `jsdom` NAO implementa `fetch`, e o `jest-environment-jsdom` nao empresta o
 *    `fetch` global do Node 20. Sem esta atribuicao, `jest.spyOn(globalThis,
 *    'fetch')` falha com "Cannot spy on the fetch property because it is not a
 *    function" — nao ha o que espionar.
 * 2. Um teste que exercite um caminho de rede nao previsto encontra uma funcao
 *    que LANCA, e nao um `fetch` de verdade. A falha aparece como erro do teste
 *    em vez de uma requisicao silenciosa saindo da maquina. E por isso que a
 *    suite passa identica com e sem rede.
 *
 * Reinstalada a cada teste porque o `restoreAllMocks` do `afterEach` devolve a
 * propriedade ao valor anterior ao spy. `configurable: true` e obrigatorio: sem
 * ele o `jest.spyOn` nao consegue redefinir a propriedade.
 */
beforeEach(() => {
  Object.defineProperty(globalThis, 'fetch', {
    value: () => {
      throw new Error(REDE_PROIBIDA);
    },
    writable: true,
    configurable: true,
  });
});
