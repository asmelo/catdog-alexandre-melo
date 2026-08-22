/**
 * Recarrega módulos com um `process.env` diferente.
 *
 * Existe porque `src/config/env.ts` valida `process.env` NO IMPORT e congela o
 * resultado (`Object.freeze`): depois disso não há como alterar uma variável para
 * exercitar o outro ramo. Os comportamentos que dependem de configuração —
 * o rate limit ligado, o SMTP completo, uma env inválida derrubando o boot — só
 * podem ser testados reentrando no módulo.
 *
 * `jest.resetModules()` roda ANTES e DEPOIS: antes para que o `env` novo seja
 * lido, depois para que o próximo teste do arquivo volte a ver o registro limpo.
 * As variáveis originais são restauradas mesmo se a callback lançar.
 */
export async function comAmbiente<T>(
  variaveis: Readonly<Record<string, string | undefined>>,
  carregar: () => Promise<T>,
): Promise<T> {
  const anteriores = new Map<string, string | undefined>();

  for (const [chave, valor] of Object.entries(variaveis)) {
    anteriores.set(chave, process.env[chave]);

    if (valor === undefined) {
      delete process.env[chave];
    } else {
      process.env[chave] = valor;
    }
  }

  jest.resetModules();

  try {
    return await carregar();
  } finally {
    for (const [chave, valor] of anteriores) {
      if (valor === undefined) {
        delete process.env[chave];
      } else {
        process.env[chave] = valor;
      }
    }

    jest.resetModules();
  }
}
