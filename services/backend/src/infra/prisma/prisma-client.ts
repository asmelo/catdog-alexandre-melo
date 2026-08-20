import { Prisma, PrismaClient } from '@prisma/client';

import { env } from '~/config/env';

/**
 * Instancia unica de PrismaClient.
 * Fora de producao ela e guardada em `globalThis`: sem isso, o hot-reload do
 * ts-node-dev abriria uma conexao nova a cada salvamento e estouraria o limite
 * de conexoes do Supabase.
 */

type GlobalComPrisma = typeof globalThis & {
  catdogPrismaClient?: PrismaClient;
};

const escopoGlobal = globalThis as GlobalComPrisma;

const niveisDeLog: Prisma.LogLevel[] =
  env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'];

const criarPrismaClient = (): PrismaClient => new PrismaClient({ log: niveisDeLog });

export const prisma: PrismaClient = escopoGlobal.catdogPrismaClient ?? criarPrismaClient();

if (env.NODE_ENV !== 'production') {
  escopoGlobal.catdogPrismaClient = prisma;
}
