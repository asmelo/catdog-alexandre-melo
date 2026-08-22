declare global {
  /**
   * Complementa a `ImportMetaEnv` de `vite/client`, cuja assinatura de indice
   * aceita qualquer chave sem tipo definido. Declarar a chave aqui da tipo
   * preciso (`string | undefined`) ao unico acesso a `import.meta.env` do
   * projeto, dispensando conversao de tipo no ponto de leitura.
   */
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }
}

export type Env = {
  readonly apiBaseUrl: string;
};

/**
 * Ponto UNICO de leitura de `import.meta.env` em todos os modulos do frontend.
 *
 * Restricao arquitetural, nao estilistica: `import.meta` e erro de SINTAXE sob a
 * transformacao CommonJS do Jest, e concentrar o acesso aqui permite mapear
 * este modulo para um mock na TASK-FRONTEND-013. Espalhar `import.meta.env`
 * pelo codigo inviabiliza a suite de testes inteira.
 *
 * O default `/api` faz o proxy do dev server do Vite atender sem `.env` local;
 * em producao define-se `VITE_API_BASE_URL` com a URL absoluta da API.
 */
export const env: Env = Object.freeze({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
});
