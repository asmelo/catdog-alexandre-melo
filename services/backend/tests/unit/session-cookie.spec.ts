import type { Response } from 'express';
import { mockDeep } from 'jest-mock-extended';

import { comAmbiente } from '../helpers/ambiente';

/**
 * Atributos do cookie de refresh. São contrato de SEGURANÇA e mudam de valor
 * conforme o ambiente — em produção o cookie precisa sair `Secure`, e é o único
 * lugar onde `COOKIE_DOMAIN` tem efeito. A suíte de integração observa a postura
 * de desenvolvimento (sem HTTPS); este spec cobre a de produção, que não tem como
 * ser exercitada pela mesma execução.
 */

const SETE_DIAS_EM_MS = 7 * 24 * 60 * 60 * 1000;

describe('session-cookie', () => {
  it('sem COOKIE_DOMAIN o atributo `domain` fica AUSENTE, e não `undefined`', async () => {
    // Arrange — ausente é mais estreito: o cookie fica restrito ao host exato que
    // o emitiu. (Também é o que o `exactOptionalPropertyTypes` exige.)
    await comAmbiente({ COOKIE_DOMAIN: undefined }, async () => {
      const { buildRefreshCookieOptions } = await import('~/domains/auth/session-cookie');

      // Act
      const opcoes = buildRefreshCookieOptions();

      // Assert
      expect('domain' in opcoes).toBe(false);
      expect(opcoes).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: SETE_DIAS_EM_MS,
      });
    });
  });

  it('com COOKIE_DOMAIN definido o atributo é declarado', async () => {
    // Arrange
    await comAmbiente({ COOKIE_DOMAIN: '.catdog.com' }, async () => {
      const { buildRefreshCookieOptions } = await import('~/domains/auth/session-cookie');

      // Act & Assert
      expect(buildRefreshCookieOptions().domain).toBe('.catdog.com');
    });
  });

  it('a postura de produção sai `Secure` e com o SameSite configurado', async () => {
    // Arrange
    await comAmbiente(
      { COOKIE_SECURE: 'true', COOKIE_SAME_SITE: 'strict' },
      async () => {
        const { buildRefreshCookieOptions } = await import('~/domains/auth/session-cookie');

        // Act & Assert
        expect(buildRefreshCookieOptions()).toMatchObject({
          secure: true,
          sameSite: 'strict',
          httpOnly: true,
        });
      },
    );
  });

  it('a remoção usa a MESMA tripla (nome, domínio, caminho) da criação, e sem `maxAge`', async () => {
    // Arrange — o navegador identifica um cookie por essa tripla: com caminho ou
    // domínio diferentes, a "remoção" cria um cookie vazio ao lado do original em
    // vez de apagar qualquer coisa.
    await comAmbiente({ COOKIE_DOMAIN: '.catdog.com', COOKIE_SECURE: 'true' }, async () => {
      const { buildRefreshCookieOptions, clearRefreshCookie, REFRESH_COOKIE_NAME } =
        await import('~/domains/auth/session-cookie');
      const criacao = buildRefreshCookieOptions();
      const resposta = mockDeep<Response>();

      // Act
      clearRefreshCookie(resposta);

      // Assert
      expect(resposta.clearCookie.mock.calls).toEqual([
        [
          REFRESH_COOKIE_NAME,
          {
            httpOnly: criacao.httpOnly,
            secure: criacao.secure,
            sameSite: criacao.sameSite,
            path: criacao.path,
            domain: criacao.domain,
          },
        ],
      ]);
    });
  });
});
