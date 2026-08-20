import { app } from '~/app';
import { env } from '~/config/env';

/**
 * Unico ponto do backend que abre o socket HTTP.
 */

process.on('unhandledRejection', (motivo: unknown) => {
  console.error('[catdog-backend] Promise rejeitada sem tratamento:', motivo);
  process.exit(1);
});

process.on('uncaughtException', (erro: Error) => {
  console.error('[catdog-backend] Excecao nao capturada:', erro);
  process.exit(1);
});

app.listen(env.PORT, () => {
  console.info(
    `[catdog-backend] Servidor ouvindo na porta ${env.PORT} (NODE_ENV=${env.NODE_ENV})`,
  );
});
