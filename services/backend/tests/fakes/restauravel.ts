/**
 * Peças compartilhadas pelos dublês em memória.
 */

/**
 * Contrato mínimo que um armazém em memória cumpre para participar de uma
 * transação simulada.
 *
 * Existe por causa de UM comportamento que a suíte precisa observar: quando o
 * compare-and-swap da rotação perde a corrida, o `refresh-session.service.ts`
 * lança de dentro do `$transaction` para que o refresh token recém-criado
 * DESAPAREÇA com o rollback. Um dublê sem rollback deixaria essa linha viva e o
 * teste "nenhum token da família permanece utilizável" passaria a falhar por
 * defeito do dublê, não do código.
 */
export interface Restauravel {
  /** Captura o estado atual e devolve a função que o restaura. */
  capturarEstado(): () => void;
}

/**
 * UUIDs sequenciais e determinísticos no formato v4 (versão `4`, variante `8`),
 * exigido porque as colunas são `@db.Uuid` e o dublê de Prisma da integração
 * alimenta as mesmas linhas que o código de produção leria.
 *
 * `randomUUID` daria ids diferentes a cada execução e qualquer mensagem de falha
 * do Jest ficaria irreproduzível; a numeração crescente também deixa óbvia, na
 * leitura do teste, a ordem em que as linhas nasceram.
 */
let sequencia = 0;

export function proximoUuid(): string {
  sequencia += 1;

  return `00000000-0000-4000-8000-${String(sequencia).padStart(12, '0')}`;
}

/** Chamado entre testes para que os ids não dependam do que rodou antes. */
export function reiniciarSequenciaDeUuid(): void {
  sequencia = 0;
}

/**
 * Envolve uma operação SÍNCRONA do armazém na promessa que a porta declara.
 *
 * Existe por um motivo de fidelidade, não de estilo: `Promise.resolve().then(...)`
 * garante que uma falha do armazém saia como REJEIÇÃO da promessa, um tick
 * depois, exatamente como o Prisma faria. Um método marcado `async` teria o mesmo
 * efeito, mas seria um `async` sem nenhum `await` — e a alternativa ingênua
 * (`return Promise.resolve(this.armazem.criar(...))`) lançaria de forma
 * SÍNCRONA, o que nenhuma implementação real da porta faz e quebraria qualquer
 * chamador que só espera rejeição.
 */
export function comoPromessa<T>(operacao: () => T): Promise<T> {
  return Promise.resolve().then(operacao);
}

/**
 * Executa a callback com rollback: se ela lançar, cada armazém volta ao estado
 * anterior e o erro segue. É a semântica de `prisma.$transaction` que os services
 * deste domínio dependem.
 */
export async function executarComRollback<T>(
  armazens: ReadonlyArray<Restauravel>,
  executar: () => Promise<T>,
): Promise<T> {
  const desfazer = armazens.map((armazem) => armazem.capturarEstado());

  try {
    return await executar();
  } catch (motivo: unknown) {
    for (const restaurar of desfazer) {
      restaurar();
    }

    throw motivo;
  }
}
