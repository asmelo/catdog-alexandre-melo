import express, { type Express } from 'express';
import request from 'supertest';

import { authenticate } from '~/middlewares/authenticate.middleware';
import { authorizeRole } from '~/middlewares/authorize-role.middleware';
import { errorHandlerMiddleware } from '~/middlewares/error-handler.middleware';
import { signAccessToken } from '~/domains/auth/tokens/access-token.service';
import type { AuthRole } from '~/domains/auth/mappers/user.mapper';

/**
 * RN-10 — a decisão de permissão que VALE é a do servidor (CT-16).
 *
 * `authorizeRole` já existe e está exportado, mas NENHUMA rota da FEATURE-002 o
 * monta: `GET /api/auth/me` leva só `authenticate`, porque ambas as roles
 * consultam a si mesmas. Ele é a guarda transversal das features seguintes
 * (pets, pedidos), e é por isso que ganha teste próprio em vez de ficar sem
 * cobertura até a primeira rota de negócio existir.
 *
 * O app aqui é um Express mínimo justamente para exercitar a MONTAGEM, incluindo
 * o caso de composição errada (guarda sem `authenticate` antes dela).
 */

const ID_DO_USUARIO = '22222222-2222-4222-8222-222222222222';

function appProtegido(...permitidas: ReadonlyArray<AuthRole>): Express {
  const aplicacao = express();

  aplicacao.get(
    '/admin',
    authenticate,
    authorizeRole(...permitidas),
    (_requisicao, resposta) => {
      resposta.status(200).json({ conteudo: 'restrito' });
    },
  );
  aplicacao.use(errorHandlerMiddleware);

  return aplicacao;
}

function tokenDe(role: AuthRole): string {
  return signAccessToken({ id: ID_DO_USUARIO, role }).accessToken;
}

describe('authorizeRole', () => {
  it('role permitida acessa o recurso normalmente', async () => {
    // Arrange
    const aplicacao = appProtegido('admin');

    // Act
    const resposta = await request(aplicacao)
      .get('/admin')
      .set('Authorization', `Bearer ${tokenDe('admin')}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ conteudo: 'restrito' });
  });

  it('CT-16: `cliente` em rota exclusiva de `admin` recebe 403 e o conteúdo restrito NÃO é exibido', async () => {
    // Arrange
    const aplicacao = appProtegido('admin');

    // Act
    const resposta = await request(aplicacao)
      .get('/admin')
      .set('Authorization', `Bearer ${tokenDe('cliente')}`);

    // Assert — 403 e não 401: a credencial está correta e o servidor sabe quem é
    // o usuário; o que falta é permissão. Um 401 faria o cliente tentar renovar a
    // sessão num laço, porque um access token novo não muda a role.
    expect(resposta.status).toBe(403);
    expect(resposta.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para acessar este recurso.',
      },
    });
    expect(JSON.stringify(resposta.body)).not.toContain('restrito');
  });

  it('a fábrica aceita mais de uma role permitida', async () => {
    // Arrange
    const aplicacao = appProtegido('admin', 'cliente');

    // Act
    const resposta = await request(aplicacao)
      .get('/admin')
      .set('Authorization', `Bearer ${tokenDe('cliente')}`);

    // Assert
    expect(resposta.status).toBe(200);
  });

  it('CT-17: sem credencial o `authenticate` já responde 401, antes da verificação de role', async () => {
    // Arrange
    const aplicacao = appProtegido('admin');

    // Act
    const resposta = await request(aplicacao).get('/admin');

    // Assert
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Sua sessão expirou. Faça login novamente.',
      },
    });
  });

  it('guarda montada FORA de ordem (sem `authenticate`) responde 401, e nunca acesso liberado', async () => {
    // Arrange — erro de composição de rota não deve virar acesso livre nem 500
    // com vazamento de stack.
    const aplicacao = express();

    aplicacao.get('/admin', authorizeRole('admin'), (_requisicao, resposta) => {
      resposta.status(200).json({ conteudo: 'restrito' });
    });
    aplicacao.use(errorHandlerMiddleware);

    // Act
    const resposta = await request(aplicacao)
      .get('/admin')
      .set('Authorization', `Bearer ${tokenDe('admin')}`);

    // Assert
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Sua sessão expirou. Faça login novamente.',
      },
    });
  });
});
