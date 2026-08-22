import request from 'supertest';

import { comAmbiente } from '../helpers/ambiente';

/**
 * Montagem do Express. Deliberadamente separada do `listen` (que vive em
 * `src/index.ts`) — é essa separação que torna a suíte de integração possível.
 *
 * O que este spec cobre e a integração não alcança: a configuração `trust proxy`,
 * que só existe em produção e é indispensável no Render para o cookie `Secure` e
 * para o rate limit ler o IP real em vez do IP do proxy.
 */
describe('app', () => {
  it('em produção confia em UM proxy à frente', async () => {
    // Arrange — o valor `1` é exatamente o que passa entre os dois avisos do
    // `express-rate-limit` (`UNEXPECTED_X_FORWARDED_FOR` com `false` e
    // `PERMISSIVE_TRUST_PROXY` com `true`).
    await comAmbiente({ NODE_ENV: 'production' }, async () => {
      const { app } = await import('~/app');

      // Act & Assert
      expect(app.get('trust proxy')).toBe(1);
    });
  });

  it('fora de produção NÃO confia em proxy: o `X-Forwarded-For` é forjável e é ignorado', async () => {
    // Arrange
    await comAmbiente({ NODE_ENV: 'test' }, async () => {
      const { app } = await import('~/app');

      // Act & Assert
      expect(app.get('trust proxy')).toBeFalsy();
    });
  });

  it('responde com os cabeçalhos de segurança do helmet e recusa corpo acima de 10 kB', async () => {
    // Arrange
    const { app } = await import('~/app');
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const saudavel = await request(app).get('/api/health');
    const corpoGrande = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'a'.repeat(20000) }));

    // Assert
    expect(saudavel.get('X-Content-Type-Options')).toBe('nosniff');
    // O `entity.too.large` do body-parser cai no ramo genérico do error handler,
    // pelo mesmo motivo do JSON malformado (defeito pré-existente documentado na
    // suíte de integração): ele não é `AppError` nem `ZodError`.
    expect(corpoGrande.status).toBe(500);
    expect(log).toHaveBeenCalled();
  });
});
