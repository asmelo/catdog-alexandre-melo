import 'express-async-errors';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { corsOptions } from '~/config/cors';
import { env } from '~/config/env';
import { errorHandlerMiddleware } from '~/middlewares/error-handler.middleware';
import { notFoundMiddleware } from '~/middlewares/not-found.middleware';
import { router } from '~/routes';

/**
 * Montagem do Express, deliberadamente separada do `listen` (em `src/index.ts`):
 * e essa separacao que permite os testes de integracao com supertest
 * (TASK-BACKEND-007).
 */

export const app: Express = express();

if (env.NODE_ENV === 'production') {
  // Necessario no Render para o cookie `Secure` e para o rate limit ler o IP real.
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', router);

// A ordem importa: `notFound` precisa vir DEPOIS das rotas (para so ser
// alcancado quando nenhuma casou) e ANTES do `errorHandler` (que e quem
// transforma o erro lancado por ele na resposta 404). Invertida, toda rota
// inexistente responderia 500.
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);
