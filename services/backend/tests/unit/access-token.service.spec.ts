import { sign } from 'jsonwebtoken';

import { signAccessToken, verifyAccessToken } from '~/domains/auth/tokens/access-token.service';

import { comAmbiente } from '../helpers/ambiente';

/**
 * Único arquivo do projeto autorizado a importar `jsonwebtoken`. Os caminhos
 * felizes já são exercitados pelo login e pelo `/me`; o que este spec cobre são as
 * falhas de CONFIGURAÇÃO e de CONTRATO, que não têm rota HTTP capaz de alcançá-las
 * e cujo desfecho errado seria grave: um TTL malformado faria o `jsonwebtoken`
 * assinar um token SEM `exp`, isto é, um access token eterno.
 */

const SEGREDO_DE_TESTE = 'segredo-de-teste-deterministico-com-mais-de-32-chars';
const ID_DO_USUARIO = '33333333-3333-4333-8333-333333333333';

describe('access-token.service', () => {
  describe('signAccessToken', () => {
    it('assina com `sub`, `role`, `typ`, `iss` e `aud`, e deriva `expiresIn` do próprio token', () => {
      // Arrange & Act
      const assinado = signAccessToken({ id: ID_DO_USUARIO, role: 'admin' });

      // Assert — `expiresIn` vem de `exp - iat` do token, e não de um parser de
      // duração paralelo que poderia divergir do `ms`.
      expect(verifyAccessToken(assinado.accessToken)).toMatchObject({
        sub: ID_DO_USUARIO,
        role: 'admin',
        typ: 'access',
        iss: 'catdog-api',
        aud: 'catdog-web',
      });
      expect(assinado.expiresIn).toBe(900);
    });

    it('o token NÃO carrega nome nem e-mail do usuário', () => {
      // Arrange & Act — o JWT viaja em cada requisição e para em log de proxy.
      const assinado = signAccessToken({ id: ID_DO_USUARIO, role: 'cliente' });
      const claims = verifyAccessToken(assinado.accessToken);

      // Assert
      expect(Object.keys(claims).sort()).toEqual([
        'aud',
        'exp',
        'iat',
        'iss',
        'role',
        'sub',
        'typ',
      ]);
    });

    it('TTL em segundos é refletido em `expiresIn`', async () => {
      // Arrange & Act
      await comAmbiente({ JWT_ACCESS_TTL: '1h' }, async () => {
        const tokens = await import('~/domains/auth/tokens/access-token.service');

        // Assert
        expect(tokens.signAccessToken({ id: ID_DO_USUARIO, role: 'cliente' }).expiresIn).toBe(
          3600,
        );
      });
    });

    it('TTL fora do formato do `ms` FALHA ALTO em vez de assinar um token eterno', async () => {
      // Arrange
      await comAmbiente({ JWT_ACCESS_TTL: 'quinze minutos' }, async () => {
        const tokens = await import('~/domains/auth/tokens/access-token.service');

        // Act & Assert — sem esta validação o `ms` devolveria `undefined` e o
        // token sairia sem `exp`.
        expect(() => tokens.signAccessToken({ id: ID_DO_USUARIO, role: 'cliente' })).toThrow(
          /JWT_ACCESS_TTL tem valor invalido/,
        );
      });
    });

    it('`JWT_ACCESS_SECRET` ausente FALHA ALTO nomeando a variável', async () => {
      // Arrange
      await comAmbiente({ JWT_ACCESS_SECRET: undefined }, async () => {
        const tokens = await import('~/domains/auth/tokens/access-token.service');

        // Act & Assert
        expect(() => tokens.signAccessToken({ id: ID_DO_USUARIO, role: 'admin' })).toThrow(
          /JWT_ACCESS_SECRET nao esta definida/,
        );
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('recusa token assinado com outro segredo', () => {
      // Arrange
      const forjado = sign({ role: 'admin', typ: 'access' }, 'outro-segredo-qualquer', {
        algorithm: 'HS256',
        subject: ID_DO_USUARIO,
        issuer: 'catdog-api',
        audience: 'catdog-web',
        expiresIn: '15m',
      });

      // Act & Assert
      expect(() => verifyAccessToken(forjado)).toThrow();
    });

    it('recusa token de outro emissor mesmo com o segredo correto', () => {
      // Arrange — staging apontando para o mesmo `.env` produziria um token
      // criptograficamente válido e ainda assim ilegítimo aqui.
      const deOutroAmbiente = sign({ role: 'admin', typ: 'access' }, SEGREDO_DE_TESTE, {
        algorithm: 'HS256',
        subject: ID_DO_USUARIO,
        issuer: 'outra-api',
        audience: 'catdog-web',
        expiresIn: '15m',
      });

      // Act & Assert
      expect(() => verifyAccessToken(deOutroAmbiente)).toThrow();
    });

    it('recusa token com `typ` divergente', () => {
      // Arrange — sem o discriminador, qualquer outro token assinado com o mesmo
      // segredo (um futuro token de troca de senha) seria aceito como credencial.
      const outroProposito = sign(
        { role: 'admin', typ: 'password-reset' },
        SEGREDO_DE_TESTE,
        {
          algorithm: 'HS256',
          subject: ID_DO_USUARIO,
          issuer: 'catdog-api',
          audience: 'catdog-web',
          expiresIn: '15m',
        },
      );

      // Act & Assert
      expect(() => verifyAccessToken(outroProposito)).toThrow(
        /claims fora do contrato esperado/,
      );
    });

    it('recusa role que o mapper nunca produziria (o enum do banco, em MAIÚSCULAS)', () => {
      // Arrange
      const roleDoBanco = sign({ role: 'ADMIN', typ: 'access' }, SEGREDO_DE_TESTE, {
        algorithm: 'HS256',
        subject: ID_DO_USUARIO,
        issuer: 'catdog-api',
        audience: 'catdog-web',
        expiresIn: '15m',
      });

      // Act & Assert
      expect(() => verifyAccessToken(roleDoBanco)).toThrow(
        /claims fora do contrato esperado/,
      );
    });

    it('recusa token já vencido', () => {
      // Arrange
      const vencido = sign({ role: 'cliente', typ: 'access' }, SEGREDO_DE_TESTE, {
        algorithm: 'HS256',
        subject: ID_DO_USUARIO,
        issuer: 'catdog-api',
        audience: 'catdog-web',
        expiresIn: '-1s',
      });

      // Act & Assert
      expect(() => verifyAccessToken(vencido)).toThrow();
    });
  });
});
