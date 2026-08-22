import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { errorHandlerMiddleware } from '~/middlewares/error-handler.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Fábrica de validação Zod. As rotas da FEATURE-002 só declaram `body`, então
 * `query` e `params` — que existem no contrato do middleware e serão usados pelas
 * features de listagem — ficariam sem exercício algum.
 *
 * O ponto que este spec protege é a REATRIBUIÇÃO: validar sem reatribuir deixa o
 * controller lendo o dado cru, e as transformações declaradas no schema
 * (normalizar e-mail, coagir número de query string) não valeriam nada.
 */

function appQueValidaEDevolve(esquemas: Parameters<typeof validateRequest>[0]): Express {
  const aplicacao = express();

  aplicacao.use(express.json());
  aplicacao.post('/alvo/:id', validateRequest(esquemas), (requisicao, resposta) => {
    // `req.body` e tipado como `any` pelo Express; a atribuicao para `unknown`
    // impede esse `any` de entrar no fluxo do teste.
    const body: unknown = requisicao.body;

    resposta
      .status(200)
      .json({ body, query: requisicao.query, params: requisicao.params });
  });
  aplicacao.use(errorHandlerMiddleware);

  return aplicacao;
}

describe('validateRequest', () => {
  it('REATRIBUI o corpo transformado: o handler lê o valor normalizado, não o cru', async () => {
    // Arrange
    const aplicacao = appQueValidaEDevolve({
      body: z.object({ email: z.string().trim().toLowerCase() }),
    });

    // Act
    const resposta = await request(aplicacao)
      .post('/alvo/1')
      .send({ email: '  ANA@Exemplo.com  ' });

    // Assert
    expect(resposta.status).toBe(200);
    expect(z.object({ body: z.object({ email: z.string() }) }).parse(resposta.body).body)
      .toEqual({ email: 'ana@exemplo.com' });
  });

  it('valida e coage a query string, reatribuindo o resultado', async () => {
    // Arrange — a query chega sempre como texto; sem a coerção o handler
    // compararia `'2' > 10` como string.
    const aplicacao = appQueValidaEDevolve({
      query: z.object({ pagina: z.coerce.number().int().positive() }),
    });

    // Act
    const resposta = await request(aplicacao).post('/alvo/1?pagina=3');

    // Assert
    expect(resposta.status).toBe(200);
    expect(
      z.object({ query: z.object({ pagina: z.number() }) }).parse(resposta.body).query,
    ).toEqual({ pagina: 3 });
  });

  it('query inválida responde 400 no envelope de validação', async () => {
    // Arrange
    const aplicacao = appQueValidaEDevolve({
      query: z.object({ pagina: z.coerce.number().int().positive('deve ser positiva') }),
    });

    // Act
    const resposta = await request(aplicacao).post('/alvo/1?pagina=-2');

    // Assert
    expect(resposta.status).toBe(400);
    expect(resposta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'pagina', message: 'deve ser positiva' }],
      },
    });
  });

  it('valida os parâmetros de caminho', async () => {
    // Arrange
    const aplicacao = appQueValidaEDevolve({
      params: z.object({ id: z.string().uuid('identificador invalido') }),
    });

    // Act
    const invalido = await request(aplicacao).post('/alvo/nao-e-uuid');
    const valido = await request(aplicacao).post(
      '/alvo/44444444-4444-4444-8444-444444444444',
    );

    // Assert
    expect(invalido.status).toBe(400);
    expect(valido.status).toBe(200);
  });

  it('a primeira seção que falha interrompe: body inválido não chega a validar a query', async () => {
    // Arrange — o Zod já agrega todos os problemas da própria seção, e body +
    // query inválidos na mesma requisição é caso marginal.
    const aplicacao = appQueValidaEDevolve({
      body: z.object({ nome: z.string({ required_error: 'nome faltando' }) }),
      query: z.object({ pagina: z.coerce.number() }),
    });

    // Act
    const resposta = await request(aplicacao).post('/alvo/1?pagina=abc').send({});

    // Assert — só o problema do corpo aparece.
    expect(resposta.status).toBe(400);
    expect(resposta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'nome', message: 'nome faltando' }],
      },
    });
  });
});

describe('errorHandlerMiddleware', () => {
  it('converte um `ZodError` CRU (lançado fora do `validateRequest`) no envelope de validação', async () => {
    // Arrange — schemas parseados dentro de services ou jobs não passam pelo
    // middleware e chegariam ao handler como `ZodError`.
    const aplicacao = express();

    aplicacao.get('/alvo', () => {
      z.object({ quantidade: z.number({ required_error: 'quantidade faltando' }) }).parse(
        {},
      );
    });
    aplicacao.use(errorHandlerMiddleware);

    // Act
    const resposta = await request(aplicacao).get('/alvo');

    // Assert
    expect(resposta.status).toBe(400);
    expect(resposta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'quantidade', message: 'quantidade faltando' }],
      },
    });
  });

  it('erro não previsto responde mensagem genérica e o diagnóstico vai só para o log', async () => {
    // Arrange — vazar `erro.message` ou a stack entregaria detalhe de
    // implementação a quem chamou.
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const aplicacao = express();

    aplicacao.get('/alvo', () => {
      throw new Error('senha do banco: super-secreta');
    });
    aplicacao.use(errorHandlerMiddleware);

    // Act
    const resposta = await request(aplicacao).get('/alvo');

    // Assert
    expect(resposta.status).toBe(500);
    expect(resposta.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro inesperado. Tente novamente.',
      },
    });
    expect(JSON.stringify(resposta.body)).not.toContain('super-secreta');
    expect(log).toHaveBeenCalled();
  });
});
