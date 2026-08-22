import { UserRole, UserStatus } from '@prisma/client';
import request, { type Response } from 'supertest';
import { z } from 'zod';

import { hashPassword } from '~/utils/password-hasher';
import { hashToken } from '~/utils/secure-token';

/**
 * Substitui o cliente Prisma pelo dublê em memória ANTES de qualquer import do
 * `app`: a fábrica `createAuthController()` roda no import de `auth.routes.ts` e
 * já constrói os repositórios em cima dele.
 *
 * O dublê é do CLIENTE, não dos repositórios — trocar os repositórios exigiria
 * alterar a fábrica, que é código de `src/`, e este slice não altera `src/`.
 * A consequência é boa: a composição real roda inteira (repositórios Prisma,
 * transações, services, controller, middlewares e o `app.ts`), e o único ponto
 * dublado é a borda do banco.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

// A partir daqui os imports veem o cliente dublado.
import { app } from '~/app';

import {
  armazemDeRefreshTokens,
  armazemDeTokensDeConfirmacao,
  armazemDeUsuarios,
  reiniciarPrismaDouble,
} from '../fakes/prisma-double';

/**
 * Contrato HTTP das rotas de `/api/auth`.
 *
 * Aqui NÃO se testa regra de negócio — ela é coberta pelos specs unitários dos
 * services. O que se verifica é o que o frontend consome: status, `code` e
 * `message` exatos do envelope, presença de `details` só na validação, atributos
 * do `Set-Cookie`, e a uniformidade das respostas de falha.
 */

const SENHA = 'Senha123!';
const CAMINHO_DO_COOKIE = '/api/auth';
const NOME_DO_COOKIE = 'catdog_rt';

/**
 * O corpo é validado por schema em vez de acesso solto a `resposta.body` (que o
 * `superagent` tipa como `any`): a asserção passa a ser sobre a FORMA do contrato,
 * e um campo novo ou um tipo trocado falha aqui em vez de passar em silêncio.
 */
const usuarioPublicoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'cliente']),
});

const sessaoSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: usuarioPublicoSchema,
});

const envelopeDeErroSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

let hashDaSenha = '';

beforeAll(async () => {
  // Um único hash bcrypt reaproveitado por toda a suíte: cada `hashPassword` é
  // trabalho deliberadamente caro, e o que os testes precisam é de um hash VÁLIDO
  // que case com `SENHA`.
  hashDaSenha = await hashPassword(SENHA);
});

beforeEach(() => {
  reiniciarPrismaDouble();
});

// --------------------------------------------------------------------------
// Auxiliares
// --------------------------------------------------------------------------

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
}

function sessao(resposta: Response): z.infer<typeof sessaoSchema> {
  return sessaoSchema.parse(resposta.body);
}

/**
 * Lê o `Set-Cookie` sem deixar o `any` de `resposta.headers` entrar no fluxo: o
 * valor é recebido como `unknown` e estreitado por verificação de tipo.
 */
function cookiesDefinidos(resposta: Response): ReadonlyArray<string> {
  const cabecalhos: unknown = resposta.headers;

  if (typeof cabecalhos !== 'object' || cabecalhos === null) {
    return [];
  }

  const valor: unknown = Reflect.get(cabecalhos, 'set-cookie');

  if (Array.isArray(valor)) {
    return valor.filter((item): item is string => typeof item === 'string');
  }

  return typeof valor === 'string' ? [valor] : [];
}

function cookieDeRefresh(resposta: Response): string {
  const encontrado = cookiesDefinidos(resposta).find((cookie) =>
    cookie.startsWith(`${NOME_DO_COOKIE}=`),
  );

  if (encontrado === undefined) {
    throw new Error(
      `Resposta sem cookie ${NOME_DO_COOKIE}: ${cookiesDefinidos(resposta).join(' | ')}`,
    );
  }

  return encontrado;
}

/** Só o par `nome=valor`, que é o que o navegador reenvia. */
function paraEnvio(cookie: string): string {
  return cookie.split(';')[0] ?? '';
}

function valorDoCookie(cookie: string): string {
  return paraEnvio(cookie).slice(`${NOME_DO_COOKIE}=`.length);
}

/**
 * Cria a conta diretamente no armazém, já ativa.
 *
 * O caminho de produção para chegar a uma conta ativa é registro → e-mail →
 * confirmação, e ele É exercitado nos testes de registro e de confirmação. Aqui a
 * linha é semeada porque o objetivo é o contrato do LOGIN, e reencenar dois
 * fluxos antes de cada asserção acoplaria estes testes a regras de outro caso de
 * uso. Para a role `admin` não existe outro caminho: o auto-registro sempre
 * produz `CLIENTE` (decisão de segurança da TASK-BACKEND-004) e o admin nasce do
 * seed operacional.
 */
function semearContaAtiva(dados: { email: string; role: UserRole }): string {
  return armazemDeUsuarios.semear({
    email: dados.email,
    role: dados.role,
    status: UserStatus.ACTIVE,
    passwordHash: hashDaSenha,
    emailConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
  }).id;
}

async function logar(email: string): Promise<Response> {
  return request(app).post('/api/auth/login').send({ email, password: SENHA });
}

// --------------------------------------------------------------------------

describe('Contrato do envelope e rotas de infraestrutura', () => {
  it('GET /api/health responde 200 sem tocar o banco', async () => {
    // Arrange & Act
    const resposta = await request(app).get('/api/health');

    // Assert
    expect(resposta.status).toBe(200);
    expect(z.object({ status: z.literal('ok') }).parse(resposta.body).status).toBe('ok');
  });

  it('rota inexistente sai no MESMO envelope de erro das demais falhas, não no HTML do Express', async () => {
    // Arrange & Act
    const resposta = await request(app).get('/api/rota-que-nao-existe');

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Recurso não encontrado.' },
    });
  });

  it('`details` aparece SOMENTE em erro de validação, com um item por campo', async () => {
    // Arrange — nome ausente e e-mail inválido na mesma requisição.
    // Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nao-e-email', password: SENHA });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.code).toBe('VALIDATION_ERROR');
    expect(envelopeDeErro(resposta).error.message).toBe('Verifique os campos informados.');
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'Este campo é obrigatório.' },
      { field: 'email', message: 'Informe um e-mail válido.' },
    ]);
  });

  it('erro que não é de validação NÃO traz `details`', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha-errada' });

    // Assert — a chave precisa estar AUSENTE, não presente com `undefined`.
    expect(Object.keys(envelopeDeErro(resposta).error)).toEqual(['code', 'message']);
  });

  it('RN-12: `confirmPassword` no corpo do registro é recusado com o campo apontado', async () => {
    // Arrange & Act — a confirmação de senha é validação de formulário e nunca
    // chega ao servidor.
    const resposta = await request(app).post('/api/auth/register').send({
      name: 'Ana Silva',
      email: 'ana@exemplo.com',
      password: SENHA,
      confirmPassword: SENHA,
    });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'confirmPassword', message: 'Campo não permitido nesta requisição.' },
    ]);
    expect(armazemDeUsuarios.linhas).toHaveLength(0);
  });

  it('DEFEITO PRÉ-EXISTENTE (documentado, não corrigido aqui): JSON malformado responde 500 em vez de 400', async () => {
    // Arrange — o `express.json()` lança um `SyntaxError` que já carrega
    // `status: 400`, mas o `error-handler.middleware.ts` só reconhece `AppError` e
    // `ZodError`, então a requisição cai no ramo genérico.
    //
    // Este teste AFIRMA O COMPORTAMENTO ATUAL de propósito. Corrigir exigiria
    // alterar `src/middlewares/error-handler.middleware.ts`, e o critério de
    // aceite #9 desta task proíbe alterar `src/`. Quando a correção entrar, ESTE
    // teste falha — e é assim que ele avisa que o contrato mudou.
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":"x",');

    // Assert
    expect(resposta.status).toBe(500);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro inesperado. Tente novamente.',
      },
    });
    expect(log).toHaveBeenCalled();
  });
});

describe('POST /api/auth/register', () => {
  /**
   * O envio de e-mail é a única coisa que este fluxo faz fora do banco, e ele
   * FALHA de propósito neste ambiente: `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`
   * não existem, então `createGmailTransport()` lança antes de abrir qualquer
   * conexão. É a garantia estrutural de que nenhum teste toca a rede — e o
   * caminho exercitado é justamente a política da spec: falha registrada,
   * cadastro mantido.
   */
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('CT-01: registro com dados válidos responde 201 com "Verifique seu e-mail para ativar sua conta."', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: 'ana@exemplo.com', password: SENHA });

    // Assert
    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({
      message: 'Verifique seu e-mail para ativar sua conta.',
    });
    expect(armazemDeUsuarios.linhas[0]).toMatchObject({
      email: 'ana@exemplo.com',
      role: UserRole.CLIENTE,
      status: UserStatus.PENDING_CONFIRMATION,
    });
  });

  it('CT-01: a resposta do registro NÃO carrega o token de confirmação nem o hash da senha', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: 'ana@exemplo.com', password: SENHA });

    // Assert — o único caminho para o token é o e-mail.
    const corpo = JSON.stringify(resposta.body);

    expect(corpo).not.toContain(armazemDeTokensDeConfirmacao.linhas[0]?.tokenHash ?? 'x');
    expect(corpo).not.toContain(SENHA);
    expect(cookiesDefinidos(resposta)).toHaveLength(0);
  });

  it('CT-02: e-mail já cadastrado responde 409 "Este e-mail já está em uso."', async () => {
    // Arrange — RN-13: vale em qualquer status, inclusive conta pendente.
    armazemDeUsuarios.semear({ email: 'ana@exemplo.com' });

    // Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Outra Pessoa', email: 'ana@exemplo.com', password: SENHA });

    // Assert
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'EMAIL_ALREADY_IN_USE', message: 'Este e-mail já está em uso.' },
    });
  });

  it('CT-04: senha de 7 caracteres responde 400 "A senha deve ter pelo menos 8 caracteres."', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: 'ana@exemplo.com', password: 'Abc1234' });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'password', message: 'A senha deve ter pelo menos 8 caracteres.' },
    ]);
    expect(armazemDeUsuarios.linhas).toHaveLength(0);
  });

  it('CT-18: senha de exatamente 8 caracteres é aceita e a conta é criada', async () => {
    // Arrange & Act — borda inferior da RN-04.
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: 'ana@exemplo.com', password: 'Abc12345' });

    // Assert
    expect(resposta.status).toBe(201);
    expect(armazemDeUsuarios.linhas).toHaveLength(1);
  });

  it('o e-mail é normalizado antes de chegar ao banco (RN-13)', async () => {
    // Arrange & Act — sem a normalização, "ANA@Exemplo.com " criaria uma segunda
    // conta ao lado de "ana@exemplo.com".
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: '  ANA@Exemplo.com  ', password: SENHA });

    const segunda = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Silva', email: 'ana@exemplo.com', password: SENHA });

    // Assert
    expect(armazemDeUsuarios.linhas[0]?.email).toBe('ana@exemplo.com');
    expect(segunda.status).toBe(409);
  });
});

describe('POST /api/auth/confirm-email', () => {
  const TOKEN_EM_CLARO = 'token-de-confirmacao-com-mais-de-32-caracteres';

  /**
   * A linha do token é semeada com `hashToken(TOKEN_EM_CLARO)` porque o valor em
   * claro só existiria no e-mail, e o envio não acontece neste ambiente (sem
   * SMTP, por decisão de isolamento). O caminho que importa aqui — do token em
   * claro recebido no corpo até a ativação da conta — é o real.
   */
  function semearTokenDe(idDoUsuario: string, expiresAt: Date, consumedAt?: Date): void {
    armazemDeTokensDeConfirmacao.semear({
      userId: idDoUsuario,
      tokenHash: hashToken(TOKEN_EM_CLARO),
      expiresAt,
      ...(consumedAt === undefined ? {} : { consumedAt }),
    });
  }

  function idDeContaPendente(): string {
    return armazemDeUsuarios.semear({
      email: 'ana@exemplo.com',
      status: UserStatus.PENDING_CONFIRMATION,
    }).id;
  }

  it('CT-06: link válido responde 200 "Conta confirmada! Faça login para continuar." e ativa a conta', async () => {
    // Arrange
    semearTokenDe(idDeContaPendente(), new Date(Date.now() + 60 * 60 * 1000));

    // Act
    const resposta = await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: TOKEN_EM_CLARO });

    // Assert
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      message: 'Conta confirmada! Faça login para continuar.',
    });
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.ACTIVE);
  });

  it('CT-07: link expirado responde 410 "Este link de confirmação expirou. Solicite um novo e-mail de confirmação."', async () => {
    // Arrange — RN-02.
    semearTokenDe(idDeContaPendente(), new Date(Date.now() - 60 * 60 * 1000));

    // Act
    const resposta = await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: TOKEN_EM_CLARO });

    // Assert
    expect(resposta.status).toBe(410);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'CONFIRMATION_TOKEN_EXPIRED',
        message:
          'Este link de confirmação expirou. Solicite um novo e-mail de confirmação.',
      },
    });
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.PENDING_CONFIRMATION);
  });

  it('CT-08: link já utilizado responde 409 "Este link de confirmação já foi utilizado."', async () => {
    // Arrange — RN-03: uso único.
    semearTokenDe(
      idDeContaPendente(),
      new Date(Date.now() + 60 * 60 * 1000),
      new Date(Date.now() - 60 * 1000),
    );

    // Act
    const resposta = await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: TOKEN_EM_CLARO });

    // Assert
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'CONFIRMATION_TOKEN_ALREADY_USED',
        message: 'Este link de confirmação já foi utilizado.',
      },
    });
  });

  it('CT-08: token desconhecido responde 400 CONFIRMATION_TOKEN_INVALID, sem `details`', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: TOKEN_EM_CLARO });

    // Assert — `code` próprio (e não VALIDATION_ERROR) para o frontend
    // distinguir "link quebrado" de "campo inválido".
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'CONFIRMATION_TOKEN_INVALID',
        message: 'Link de confirmação inválido.',
      },
    });
  });

  it('token curto demais é barrado na validação, antes de qualquer ida ao banco', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: 'curto' });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/confirmation/resend', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('conta pendente recebe 202 e o link anterior é invalidado (no máximo um válido por vez)', async () => {
    // Arrange
    const idDoUsuario = armazemDeUsuarios.semear({
      email: 'ana@exemplo.com',
      status: UserStatus.PENDING_CONFIRMATION,
    }).id;

    armazemDeTokensDeConfirmacao.semear({
      userId: idDoUsuario,
      tokenHash: hashToken('token-antigo-de-confirmacao-com-32-caracteres'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Act
    const resposta = await request(app)
      .post('/api/auth/confirmation/resend')
      .send({ email: 'ana@exemplo.com' });

    // Assert
    expect(resposta.status).toBe(202);
    expect(resposta.body).toEqual({
      message:
        'Se houver uma conta pendente para este e-mail, enviamos um novo link de confirmação.',
    });
    expect(armazemDeTokensDeConfirmacao.linhas).toHaveLength(2);
    expect(armazemDeTokensDeConfirmacao.linhas[0]?.consumedAt).not.toBeNull();
    expect(armazemDeTokensDeConfirmacao.linhas[1]?.consumedAt).toBeNull();
  });

  it('e-mail desconhecido e conta já ativa respondem EXATAMENTE o mesmo que a conta pendente', async () => {
    // Arrange — qualquer diferença de status, corpo ou mensagem transformaria o
    // endpoint em verificador de e-mails cadastrados (mesmo espírito da RN-05).
    semearContaAtiva({ email: 'ativa@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const desconhecido = await request(app)
      .post('/api/auth/confirmation/resend')
      .send({ email: 'ninguem@exemplo.com' });
    const jaAtiva = await request(app)
      .post('/api/auth/confirmation/resend')
      .send({ email: 'ativa@exemplo.com' });

    // Assert
    expect(desconhecido.status).toBe(202);
    expect(jaAtiva.status).toBe(desconhecido.status);
    expect(JSON.stringify(jaAtiva.body)).toBe(JSON.stringify(desconhecido.body));
    // Nada foi emitido em nenhum dos dois casos.
    expect(armazemDeTokensDeConfirmacao.linhas).toHaveLength(0);
  });
});

describe('POST /api/auth/login', () => {
  it('CT-09: login de `admin` responde 200 com a role em minúsculas no corpo e no access token', async () => {
    // Arrange — a role decide o redirecionamento (RN-09), então ela é contrato.
    semearContaAtiva({ email: 'admin@catdog.com', role: UserRole.ADMIN });

    // Act
    const resposta = await logar('admin@catdog.com');

    // Assert
    expect(resposta.status).toBe(200);
    expect(sessao(resposta).user).toMatchObject({
      email: 'admin@catdog.com',
      role: 'admin',
    });
    expect(sessao(resposta).expiresIn).toBe(900);
  });

  it('CT-10: login de `cliente` responde 200 com role `cliente`', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const resposta = await logar('ana@exemplo.com');

    // Assert
    expect(resposta.status).toBe(200);
    expect(sessao(resposta).user.role).toBe('cliente');
  });

  it('CT-09: o refresh token sai APENAS no cookie HttpOnly, com escopo restrito às rotas de sessão', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const resposta = await logar('ana@exemplo.com');
    const cookie = cookieDeRefresh(resposta);

    // Assert — HttpOnly dá imunidade a XSS; o Path estreito evita que a
    // credencial de longa duração acompanhe chamadas de negócio.
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain(`Path=${CAMINHO_DO_COOKIE}`);
    expect(cookie).toContain('SameSite=Lax');
    // COOKIE_SECURE=false no ambiente de teste (não há HTTPS).
    expect(cookie).not.toContain('Secure');
    // Nenhum `Domain`: o cookie fica restrito ao host exato que o emitiu.
    expect(cookie).not.toContain('Domain=');
    // O corpo NÃO traz o refresh token.
    expect(JSON.stringify(resposta.body)).not.toContain(valorDoCookie(cookie));
  });

  it('CT-11: senha incorreta responde 401 "E-mail ou senha incorretos."', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha-errada' });

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' },
    });
    expect(cookiesDefinidos(resposta)).toHaveLength(0);
  });

  it('CT-12: e-mail inexistente responde 401 com a MESMA mensagem de CT-11', async () => {
    // Arrange & Act
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: SENHA });

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.message).toBe('E-mail ou senha incorretos.');
  });

  it('CT-11 e CT-12: as duas respostas são IDÊNTICAS em status, `code` e `message` (RN-05 / RNF-03)', async () => {
    // Arrange — é isto que impede o endpoint de virar oráculo de e-mails
    // cadastrados.
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    // Act
    const senhaIncorreta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha-errada' });
    const emailInexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: SENHA });

    // Assert
    expect(emailInexistente.status).toBe(senhaIncorreta.status);
    expect(JSON.stringify(emailInexistente.body)).toBe(JSON.stringify(senhaIncorreta.body));
    expect(cookiesDefinidos(emailInexistente)).toEqual(cookiesDefinidos(senhaIncorreta));
  });

  it('CT-13: conta não confirmada responde 403 "Sua conta ainda não foi confirmada. Verifique seu e-mail."', async () => {
    // Arrange — RN-01. É 403 e não 401: a credencial está correta, falta a
    // confirmação, e o frontend oferece o reenvio só neste caso.
    armazemDeUsuarios.semear({
      email: 'ana@exemplo.com',
      status: UserStatus.PENDING_CONFIRMATION,
      passwordHash: hashDaSenha,
    });

    // Act
    const resposta = await logar('ana@exemplo.com');

    // Assert
    expect(resposta.status).toBe(403);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'ACCOUNT_NOT_CONFIRMED',
        message: 'Sua conta ainda não foi confirmada. Verifique seu e-mail.',
      },
    });
  });

  it('CT-13: a conta não confirmada só é revelada DEPOIS de a senha conferir', async () => {
    // Arrange — responder "conta não confirmada" com senha errada revelaria a
    // existência da conta a quem não a conhece.
    armazemDeUsuarios.semear({
      email: 'ana@exemplo.com',
      status: UserStatus.PENDING_CONFIRMATION,
      passwordHash: hashDaSenha,
    });

    // Act
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha-errada' });

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('senha curta no login recebe 401, e não erro de validação de tamanho', async () => {
    // Arrange & Act — contar o mínimo aqui informaria o formato aceito a quem
    // está sondando, e bloquearia contas antigas com senha mais curta.
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: 'curta' });

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('POST /api/auth/refresh', () => {
  async function abrirSessao(): Promise<string> {
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    return paraEnvio(cookieDeRefresh(await logar('ana@exemplo.com')));
  }

  it('CT-14: refresh com cookie válido responde 200, emite novo cookie e invalida o anterior', async () => {
    // Arrange
    const cookieDoLogin = await abrirSessao();

    // Act
    const resposta = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieDoLogin);

    // Assert
    expect(resposta.status).toBe(200);
    expect(sessao(resposta).user.email).toBe('ana@exemplo.com');

    const cookieNovo = paraEnvio(cookieDeRefresh(resposta));

    expect(cookieNovo).not.toBe(cookieDoLogin);
    expect(armazemDeRefreshTokens.linhas).toHaveLength(2);
    expect(armazemDeRefreshTokens.linhas[0]?.revokedReason).toBe('ROTATED');
    expect(armazemDeRefreshTokens.linhas[1]?.revokedAt).toBeNull();
  });

  it('CT-15: reapresentar o cookie já rotacionado responde 401 e limpa o cookie do navegador', async () => {
    // Arrange
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const cookieDoLogin = await abrirSessao();

    await request(app).post('/api/auth/refresh').set('Cookie', cookieDoLogin);

    // Act
    const reuso = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieDoLogin);

    // Assert — manter no navegador um token que o servidor já recusa faria o
    // cliente insistir num laço de 401 em vez de ir para o login.
    expect(reuso.status).toBe(401);
    expect(envelopeDeErro(reuso)).toEqual({
      error: { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Faça login novamente.' },
    });
    expect(cookieDeRefresh(reuso)).toContain(`${NOME_DO_COOKIE}=;`);
    // A sessão inteira caiu: nenhum token da família continua ativo.
    expect(armazemDeRefreshTokens.linhas.every((token) => token.revokedAt !== null)).toBe(
      true,
    );
  });

  it('CT-15: os quatro modos de falha da renovação respondem 401 uniforme e indistinguível', async () => {
    // Arrange — cookie ausente, desconhecido, vencido e reapresentado. Distinguir
    // esses casos entregaria a um atacante a informação de que o token roubado já
    // foi usado pela vítima.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const cookieDoLogin = await abrirSessao();

    await request(app).post('/api/auth/refresh').set('Cookie', cookieDoLogin);

    const vencido = armazemDeRefreshTokens.semear({
      userId: armazemDeUsuarios.linhas[0]?.id ?? '',
      tokenHash: hashToken('refresh-vencido'),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    // Act
    const respostas = [
      await request(app).post('/api/auth/refresh'),
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${NOME_DO_COOKIE}=token-que-nunca-existiu`),
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${NOME_DO_COOKIE}=refresh-vencido`),
      await request(app).post('/api/auth/refresh').set('Cookie', cookieDoLogin),
    ];

    // Assert
    for (const resposta of respostas) {
      expect(resposta.status).toBe(401);
      expect(JSON.stringify(resposta.body)).toBe(
        JSON.stringify({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Sua sessão expirou. Faça login novamente.',
          },
        }),
      );
    }

    // O vencido foi revogado como EXPIRED — efeito diferente, resposta igual.
    expect(
      armazemDeRefreshTokens.linhas.find((token) => token.id === vencido.id)?.revokedReason,
    ).toBe('EXPIRED');
  });

  it('cookie vazio é tratado como ausente, e não como token inválido', async () => {
    // Arrange & Act — leitura defensiva do cookie no controller.
    const resposta = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${NOME_DO_COOKIE}=`);

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.code).toBe('SESSION_EXPIRED');
  });
});

describe('POST /api/auth/logout', () => {
  it('logout com sessão aberta responde 204 sem corpo, limpa o cookie e revoga a família', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    const cookie = paraEnvio(cookieDeRefresh(await logar('ana@exemplo.com')));

    // Act
    const resposta = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    // Assert
    expect(resposta.status).toBe(204);
    expect(resposta.text).toBe('');
    expect(cookieDeRefresh(resposta)).toContain(`${NOME_DO_COOKIE}=;`);
    expect(armazemDeRefreshTokens.linhas[0]?.revokedReason).toBe('LOGOUT');
  });

  it('logout é idempotente: sem cookie, com cookie desconhecido e repetido, sempre 204', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    const cookie = paraEnvio(cookieDeRefresh(await logar('ana@exemplo.com')));

    // Act
    const semCookie = await request(app).post('/api/auth/logout');
    const desconhecido = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `${NOME_DO_COOKIE}=token-que-nunca-existiu`);
    const primeiro = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    const segundo = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    // Assert — o resultado observável do logout é o mesmo em qualquer estado.
    for (const resposta of [semCookie, desconhecido, primeiro, segundo]) {
      expect(resposta.status).toBe(204);
    }
    // O segundo logout altera zero linhas e o motivo original é preservado.
    expect(armazemDeRefreshTokens.linhas[0]?.revokedReason).toBe('LOGOUT');
  });
});

describe('GET /api/auth/me', () => {
  async function accessTokenDe(email: string, role: UserRole): Promise<string> {
    semearContaAtiva({ email, role });

    return sessao(await logar(email)).accessToken;
  }

  it('CT-09: com access token válido responde 200 com o usuário corrente', async () => {
    // Arrange
    const token = await accessTokenDe('admin@catdog.com', UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // Assert — assimetria DELIBERADA do contrato, registrada na TASK-BACKEND-006:
    // `role` sai em minúsculas (contrato do JWT e das rotas) e `status` sai no
    // vocabulário do enum, em MAIÚSCULAS. O frontend precisa comparar 'ACTIVE'.
    expect(resposta.status).toBe(200);
    expect(
      usuarioPublicoSchema.extend({ status: z.literal('ACTIVE') }).parse(resposta.body),
    ).toMatchObject({ email: 'admin@catdog.com', role: 'admin', status: 'ACTIVE' });
  });

  it('CT-17: sem cabeçalho Authorization responde 401 SESSION_EXPIRED', async () => {
    // Arrange & Act
    const resposta = await request(app).get('/api/auth/me');

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Faça login novamente.' },
    });
  });

  it('CT-17: header malformado, esquema errado e token adulterado respondem o MESMO 401', async () => {
    // Arrange — distinguir os motivos entregaria a um atacante o sinal que ele
    // procura ("este token existiu e venceu" ≠ "nunca foi válido").
    const token = await accessTokenDe('ana@exemplo.com', UserRole.CLIENTE);

    // Act
    const respostas = [
      await request(app).get('/api/auth/me').set('Authorization', token),
      await request(app).get('/api/auth/me').set('Authorization', 'Basic abc'),
      await request(app).get('/api/auth/me').set('Authorization', 'Bearer '),
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}x`),
      await request(app).get('/api/auth/me').set('Authorization', 'bearer minusculo'),
    ];

    // Assert
    for (const resposta of respostas) {
      expect(resposta.status).toBe(401);
      expect(envelopeDeErro(resposta).error.code).toBe('SESSION_EXPIRED');
    }
  });

  it('conta apagada com token ainda dentro da validade responde 401, e não 404', async () => {
    // Arrange — do ponto de vista do cliente a sessão acabou; um 404 o faria
    // tratar como "recurso inexistente" em vez de mandar o usuário ao login.
    const token = await accessTokenDe('ana@exemplo.com', UserRole.CLIENTE);

    armazemDeUsuarios.limpar();

    // Act
    const resposta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.code).toBe('SESSION_EXPIRED');
  });
});
