import { Router, type Request, type Response } from 'express';

/**
 * Router raiz montado em `/api`.
 * Neste slice expoe apenas o health check, que NAO toca o banco de dados —
 * ele responde a liveness do processo, nao a disponibilidade do Postgres.
 */
export const router: Router = Router();

router.get('/health', (_requisicao: Request, resposta: Response) => {
  resposta.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// TODO(TASK-BACKEND-004/005): router.use('/auth', authRoutes);
