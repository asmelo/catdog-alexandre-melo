import 'express-async-errors';

import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from '~/config/env';
import { router } from '~/routes';

/**
 * Montagem do Express, deliberadamente separada do `listen` (em `src/index.ts`):
 * e essa separacao que permite os testes de integracao com supertest
 * (TASK-BACKEND-007).
 */

// `credentials: true` e obrigatorio para o cookie de refresh e e incompativel
// com `origin: '*'` — por isso a lista explicita de origens.
const opcoesDeCors: CorsOptions = {
  origin: [...env.CORS_ALLOWED_ORIGINS],
  credentials: true,
};

export const app: Express = express();

if (env.NODE_ENV === 'production') {
  // Necessario no Render para o cookie `Secure` e para o rate limit ler o IP real.
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors(opcoesDeCors));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', router);

// TODO(TASK-BACKEND-002): registrar aqui, apos as rotas, os middlewares
// `notFound` e `errorHandler`.
