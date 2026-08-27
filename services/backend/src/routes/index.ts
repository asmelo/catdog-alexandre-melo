import { Router, type Request, type Response } from 'express';

import { animalsRoutes } from '~/domains/animals/animals.routes';
import { authRoutes } from '~/domains/auth/auth.routes';
import { geographyRoutes } from '~/domains/geography/geography.routes';
import { speciesRoutes } from '~/domains/species/species.routes';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Router raiz montado em `/api`.
 * O health check NAO toca o banco de dados — ele responde a liveness do
 * processo, nao a disponibilidade do Postgres.
 */
export const router: Router = Router();

router.get('/health', (_requisicao: Request, resposta: Response) => {
  resposta.status(HTTP_STATUS.OK).json({ status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/species', speciesRoutes);
router.use('/states', geographyRoutes);
router.use('/animals', animalsRoutes);
