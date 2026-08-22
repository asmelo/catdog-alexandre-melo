import { comAmbiente } from '../helpers/ambiente';

/**
 * Instância única de `PrismaClient`.
 *
 * O construtor do Prisma NÃO abre conexão — ela nasce no primeiro comando, que
 * nenhum teste emite (a suíte de integração substitui este módulo por um dublê em
 * memória). Este spec importa o módulo REAL para verificar a única regra que ele
 * tem: o reaproveitamento da instância em `globalThis` fora de produção, sem o
 * qual o hot-reload do `ts-node-dev` abriria uma conexão nova a cada salvamento e
 * estouraria o limite do pooler do Supabase (`connection_limit=1`).
 *
 * `DATABASE_URL` aponta para `127.0.0.1:1` (ver `tests/setup.ts`): sintaticamente
 * válida — o construtor valida o esquema da string — e sem serviço algum atrás.
 */
describe('infra/prisma/prisma-client', () => {
  it('fora de produção guarda a instância em `globalThis` e a REUTILIZA no próximo import', async () => {
    // Arrange
    const primeira = await comAmbiente({ NODE_ENV: 'test' }, async () => {
      const modulo = await import('~/infra/prisma/prisma-client');

      return modulo.prisma;
    });

    // Act — registro de módulos limpo: sem o cache em `globalThis` isto
    // construiria um cliente novo.
    const segunda = await comAmbiente({ NODE_ENV: 'test' }, async () => {
      const modulo = await import('~/infra/prisma/prisma-client');

      return modulo.prisma;
    });

    // Assert
    expect(segunda).toBe(primeira);
  });

  it('em produção NÃO guarda a instância no escopo global', async () => {
    // Arrange — em produção o processo sobe uma vez e não há hot-reload; manter a
    // referência global apenas estenderia o tempo de vida do objeto.
    const chaveGlobal = 'catdogPrismaClient';
    const anterior: unknown = Reflect.get(globalThis, chaveGlobal);

    Reflect.deleteProperty(globalThis, chaveGlobal);

    try {
      // Act
      await comAmbiente({ NODE_ENV: 'production' }, async () => {
        await import('~/infra/prisma/prisma-client');
      });

      // Assert
      expect(Reflect.has(globalThis, chaveGlobal)).toBe(false);
    } finally {
      if (anterior !== undefined) {
        Reflect.set(globalThis, chaveGlobal, anterior);
      }
    }
  });
});
