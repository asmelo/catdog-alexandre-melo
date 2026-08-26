import { Prisma, UserRole, UserStatus } from '@prisma/client';
import request, { type Response, type Test } from 'supertest';
import { z } from 'zod';

/**
 * Substitui o cliente Prisma pelo duble em memoria ANTES de qualquer import do
 * `app`, exatamente como em `auth-routes.spec.ts`: as fabricas
 * `createAuthController()` e `createSpeciesController()` rodam no import dos
 * respectivos arquivos de rota e ja constroem os repositorios em cima dele.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

/**
 * DECISAO SOBRE O PARAMETRO `dependencias?` DE `createSpeciesController`.
 *
 * Ele foi criado pela TASK-BACKEND-004 anunciando este teste, e ate aqui nao
 * tinha nenhum chamador alcancavel: `species.routes.ts` chama a fabrica sem
 * argumento no import do modulo. As duas saidas coerentes eram usa-lo ou
 * remove-lo; esta suite USA, e a razao e que so ele torna a CAMADA 1 da RN-09
 * verificavel pelo HTTP.
 *
 * O motivo, em concreto: `PrismaSpeciesUsageCounter` responde `0` sem consultar
 * o banco, porque a tabela `animals` nao existe. Nenhum estado do duble de
 * Prisma consegue faze-lo responder outra coisa. Sem injetar a contagem, o
 * `409 SPECIES_IN_USE` produzido pela verificacao da aplicacao (CT-24 / CT-32)
 * nao teria como sair por nenhum dos quatro endpoints — restaria apenas a
 * traducao do `P2003`, que e a CAMADA 2 e um caminho diferente do codigo.
 *
 * O que e injetado e o MINIMO: o repositorio continua sendo o
 * `PrismaSpeciesRepository` real sobre o cliente dublado, e os quatro services
 * sao os de producao. So o contador troca. Assim a composicao real continua
 * rodando inteira (repositorio, transacao, services, controller, middlewares e
 * `app.ts`) e o unico ponto substituido e a porta que hoje nao tem
 * implementacao de verdade.
 *
 * O ramo DEFAULT da fabrica (sem dependencias, o de producao) nao fica sem
 * teste: ele tem um caso proprio no fim deste arquivo.
 */
jest.mock('~/domains/species/species.controller', () => {
  const real = jest.requireActual<typeof import('~/domains/species/species.controller')>(
    '~/domains/species/species.controller',
  );

  return {
    ...real,
    createSpeciesController: (): SpeciesController =>
      real.createSpeciesController(dependenciasDeTeste()),
  };
});

// A partir daqui os imports veem o cliente dublado. A ORDEM importa: tudo de que
// `dependenciasDeTeste` precisa e carregado ANTES de `~/app`, porque e o import
// do `app` que dispara a fabrica dublada acima.
import { prisma } from '~/infra/prisma/prisma-client';

import { PrismaSpeciesRepository } from '~/domains/species/repositories/species.repository';
import { CreateSpeciesService } from '~/domains/species/services/create-species.service';
import { DeleteSpeciesService } from '~/domains/species/services/delete-species.service';
import { ListSpeciesService } from '~/domains/species/services/list-species.service';
import { RenameSpeciesService } from '~/domains/species/services/rename-species.service';
import {
  SpeciesController,
  type SpeciesControllerDependencies,
} from '~/domains/species/species.controller';
import { hashPassword } from '~/utils/password-hasher';

import { contadorDeUsoDeEspecies } from '../fakes/fake-species-usage-counter';
import {
  INSTANTE_DE_ATUALIZACAO,
  INSTANTE_DE_CRIACAO,
} from '../fakes/in-memory-species.repository';
import {
  armazemDeEspecies,
  armazemDeRefreshTokens,
  armazemDeUsuarios,
  reiniciarPrismaDouble,
  simularVinculoDeAnimalNoBanco,
} from '../fakes/prisma-double';

import { app } from '~/app';

/**
 * Contrato HTTP das rotas de `/api/species`.
 *
 * CT-21 (cancelar a edicao em linha) e CT-23 (cancelar a confirmacao de exclusao)
 * caem dentro da faixa que o *Context* da task declara, mas NAO tem superficie no
 * backend: sao interacoes de tela e pertencem a TASK-FRONTEND-011. Ficam
 * registrados aqui como exclusao deliberada, e nao como esquecimento.
 *
 * Aqui NAO se testa regra de negocio — ela e coberta pelos specs unitarios dos
 * services. O que se verifica e o que o frontend consome: status, `code` e
 * `message` exatos do envelope, o envelope de colecao `{ items }`, a ausencia de
 * `nameNormalized` na representacao publica, e a autorizacao de cada endpoint.
 *
 * Declaracao de funcao (e nao `const`): ela e chamada pela fabrica dublada
 * durante o `require` do `~/app`, que o Jest posiciona acima das declaracoes de
 * modulo. Um `const` estaria na zona morta temporal nesse instante.
 */
function dependenciasDeTeste(): SpeciesControllerDependencies {
  const especies = new PrismaSpeciesRepository(prisma);

  return {
    listSpecies: new ListSpeciesService(especies),
    createSpecies: new CreateSpeciesService(especies),
    renameSpecies: new RenameSpeciesService(especies),
    deleteSpecies: new DeleteSpeciesService(especies, contadorDeUsoDeEspecies, prisma),
  };
}

const SENHA = 'Senha123!';
const NOME_DO_COOKIE = 'catdog_rt';

/** UUID bem formado que nao corresponde a especie nenhuma. */
const UUID_INEXISTENTE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const especiePublicaSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

const colecaoSchema = z.object({ items: z.array(especiePublicaSchema) }).strict();

const envelopeDeErroSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

let hashDaSenha = '';

beforeAll(async () => {
  // Um unico hash bcrypt reaproveitado por toda a suite: cada `hashPassword` e
  // trabalho deliberadamente caro e o que os testes precisam e de um hash VALIDO.
  hashDaSenha = await hashPassword(SENHA);
});

beforeEach(() => {
  reiniciarPrismaDouble();
  // Reiniciado AQUI e nao dentro de `reiniciarPrismaDouble`: o contador nao tem
  // nada a ver com Prisma, e acopla-lo ao duble do cliente faria todo spec
  // unitario que importa `criarPrismaComTransacao` — inclusive os do dominio
  // auth — instanciar um singleton que so esta suite usa.
  contadorDeUsoDeEspecies.limpar();
});

// --------------------------------------------------------------------------
// Auxiliares
// --------------------------------------------------------------------------

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
}

function colecao(resposta: Response): z.infer<typeof colecaoSchema> {
  return colecaoSchema.parse(resposta.body);
}

/**
 * Nomeia a QUAL cliente um colaborador foi ligado dentro da transação, no mesmo
 * molde de `origemDoExecutor` em `delete-species.service.spec.ts`. Fora do corpo
 * do teste de propósito: a asserção continua sendo uma comparação única, e o que
 * a função acrescenta é a legibilidade da FALHA — os dois candidatos são objetos
 * grandes que o Jest não imprime de forma útil, e dizer "cliente global (FORA da
 * transação)" é o que transforma um mutante morto em diagnóstico.
 */
function ligacaoDoExecutor(recebido: unknown): string {
  if (recebido === prisma) {
    return 'cliente global (FORA da transação)';
  }

  if (recebido === undefined) {
    return '`withTransaction` não foi chamado';
  }

  return 'executor da transação';
}

/**
 * `code` do erro do Prisma, ou a descrição do que veio no lugar. Estreita o
 * `unknown` do `catch` por `instanceof` e não por `as` (o projeto proíbe a
 * coerção), e faz a falha dizer o que de fato chegou.
 */
function codigoDoErroDePrisma(motivo: unknown): string {
  if (motivo instanceof Prisma.PrismaClientKnownRequestError) {
    return motivo.code;
  }

  return `não é erro conhecido do Prisma: ${String(motivo)}`;
}

function especie(resposta: Response): z.infer<typeof especiePublicaSchema> {
  return especiePublicaSchema.parse(resposta.body);
}

function semearContaAtiva(dados: { email: string; role: UserRole }): void {
  armazemDeUsuarios.semear({
    email: dados.email,
    role: dados.role,
    status: UserStatus.ACTIVE,
    passwordHash: hashDaSenha,
    emailConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

/** Abre sessao pelo caminho de producao (login) e devolve o access token. */
async function tokenDe(role: UserRole): Promise<string> {
  const email = role === UserRole.ADMIN ? 'admin@catdog.com' : 'ana@exemplo.com';

  semearContaAtiva({ email, role });

  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email, password: SENHA });

  return z.object({ accessToken: z.string().min(1) }).parse(resposta.body).accessToken;
}

type Metodo = 'get' | 'post' | 'patch' | 'delete';

interface EndpointDeEspecies {
  readonly nome: string;
  readonly metodo: Metodo;
  readonly caminho: string;
}

/**
 * Os QUATRO endpoints da feature. A RNF-01 exige um caso por endpoint por
 * situacao, e nao um teste que cubra uma rota: e a lista completa que prova que
 * nenhuma delas ficou sem guarda.
 */
const ENDPOINTS: ReadonlyArray<EndpointDeEspecies> = [
  { nome: 'GET /api/species', metodo: 'get', caminho: '/api/species' },
  { nome: 'POST /api/species', metodo: 'post', caminho: '/api/species' },
  {
    nome: 'PATCH /api/species/:id',
    metodo: 'patch',
    caminho: `/api/species/${UUID_INEXISTENTE}`,
  },
  {
    nome: 'DELETE /api/species/:id',
    metodo: 'delete',
    caminho: `/api/species/${UUID_INEXISTENTE}`,
  },
];

/** Despacho sem indexar o agente por string, que traria `any` para o fluxo. */
function chamar(endpoint: EndpointDeEspecies): Test {
  const agente = request(app);

  switch (endpoint.metodo) {
    case 'get':
      return agente.get(endpoint.caminho);
    case 'post':
      return agente.post(endpoint.caminho);
    case 'patch':
      return agente.patch(endpoint.caminho);
    case 'delete':
      return agente.delete(endpoint.caminho);
  }
}

async function criarEspecie(token: string, name: string): Promise<Response> {
  return request(app)
    .post('/api/species')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
}

// --------------------------------------------------------------------------

describe('Autorização dos quatro endpoints de /api/species', () => {
  it.each(ENDPOINTS)(
    'CT-31: $nome sem credencial responde 401 SESSION_EXPIRED (RN-01 / CA-18)',
    async (endpoint: EndpointDeEspecies) => {
      // Arrange & Act
      const resposta = await chamar(endpoint);

      // Assert — a recusa vem antes de qualquer validação de corpo: quem não se
      // identificou não descobre o formato aceito pela rota.
      expect(resposta.status).toBe(401);
      expect(envelopeDeErro(resposta)).toEqual({
        error: { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Faça login novamente.' },
      });
    },
  );

  it.each(ENDPOINTS)(
    'CT-30: $nome com sessão de `cliente` responde 403 FORBIDDEN (RN-01 / CA-18)',
    async (endpoint: EndpointDeEspecies) => {
      // Arrange
      const token = await tokenDe(UserRole.CLIENTE);

      // Act
      const resposta = await chamar(endpoint).set('Authorization', `Bearer ${token}`);

      // Assert — 403 e não 401: a credencial está correta e o que falta é
      // permissão. Um 401 faria o cliente tentar renovar a sessão num laço.
      expect(resposta.status).toBe(403);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para acessar este recurso.',
        },
      });
    },
  );

  it('CT-30: o `cliente` recebe 403 mesmo enviando corpo inválido — a permissão é verificada antes', async () => {
    // Arrange — `authorizeRole` é montado ANTES do `validateRequest`.
    const token = await tokenDe(UserRole.CLIENTE);

    // Act
    const resposta = await request(app)
      .post('/api/species')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'chave errada' });

    // Assert
    expect(resposta.status).toBe(403);
    expect(envelopeDeErro(resposta).error.code).toBe('FORBIDDEN');
  });

  it('CT-31: token adulterado é tratado como ausência de sessão, e não como falta de permissão', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}x`);

    // Assert
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta).error.code).toBe('SESSION_EXPIRED');
  });
});

describe('GET /api/species', () => {
  it('CT-13: as espécies saem em ordem alfabética crescente (RN-11)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    armazemDeEspecies.semear({ name: 'Sapo' });
    armazemDeEspecies.semear({ name: 'Gato' });
    armazemDeEspecies.semear({ name: 'Cachorro' });

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(colecao(resposta).items.map((item) => item.name)).toEqual([
      'Cachorro',
      'Gato',
      'Sapo',
    ]);
  });

  it('CT-14: a ordenação ignora maiúsculas e minúsculas — "Cachorro" antes de "gato"', async () => {
    // Arrange — a ordenação vem da coluna já minúscula; ordenar por `name` com
    // collation `C` colocaria todas as maiúsculas antes de qualquer minúscula e
    // "gato" cairia no fim da lista.
    const token = await tokenDe(UserRole.ADMIN);

    armazemDeEspecies.semear({ name: 'gato' });
    armazemDeEspecies.semear({ name: 'Cachorro' });

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(colecao(resposta).items.map((item) => item.name)).toEqual(['Cachorro', 'gato']);
  });

  it('CT-14: a ordem alfabética se mantém depois de uma renomeação (a lista é reordenada)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    armazemDeEspecies.semear({ name: 'Cachorro' });

    const sapo = armazemDeEspecies.semear({ name: 'Sapo' });

    // Act — "Sapo" vira "Aranha" e deve passar para a frente de "Cachorro".
    await request(app)
      .patch(`/api/species/${sapo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Aranha' });

    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(colecao(resposta).items.map((item) => item.name)).toEqual(['Aranha', 'Cachorro']);
  });

  it('CT-13: o acentuado ordena POR LOCALE, como o `ORDER BY name_normalized` do banco', async () => {
    // Arrange — "Ágil" antes de "Zebra". Este é o caso discriminante da
    // ordenação, e a ordem que ele fixa foi MEDIDA no banco, não suposta.
    //
    // Consulta feita no Supabase de desenvolvimento na rodada 2 de revisão desta
    // task (PostgreSQL 17.6, `datlocprovider = 'i'` — ICU —, `datcollate =
    // en_US.UTF-8`, e `species.name_normalized` com collation "default", sem
    // `COLLATE` explícito):
    //
    //   SELECT name FROM species ORDER BY name_normalized ASC
    //     -> Ágil, Cão, Cavalo, Gato, Zebra
    //
    // `localeCompare('pt-BR')` devolve exatamente essa ordem. A comparação
    // BINÁRIA de code units — a premissa que esta suíte adotava antes da
    // medição, e que fixava aqui `['Zebra', 'Ágil']` — devolveria `Cavalo, Cão,
    // Gato, Zebra, Ágil`, o inverso do banco para todo nome acentuado. A
    // premissa foi refutada e a expectativa passou a ser a do banco.
    //
    // O QUE CONTINUA SENDO PREMISSA: a migração de `species` não declara
    // `COLLATE`, então a ordem é propriedade do AMBIENTE e não do schema — em um
    // Postgres provisionado com libc `C` o mesmo `ORDER BY` devolveria `Cavalo,
    // ..., Ágil`. Declarar o `COLLATE` é task de produção própria. Enquanto ela
    // não existe, é ESTE teste que reprova se o ambiente mudar: com nomes ASCII
    // (`cachorro`/`gato`/`sapo`) os dois critérios coincidem e a divergência
    // passaria despercebida, e é por isso que o caso usa nomes acentuados.
    const token = await tokenDe(UserRole.ADMIN);

    armazemDeEspecies.semear({ name: 'Ágil' });
    armazemDeEspecies.semear({ name: 'Zebra' });

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(colecao(resposta).items.map((item) => item.name)).toEqual(['Ágil', 'Zebra']);
  });

  it('CT-15: cadastro vazio responde 200 com `items: []` — nunca 404', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — a coleção vazia é estado legítimo do recurso; quem transforma
    // isso na mensagem de lista vazia é o frontend.
    expect(resposta.status).toBe(200);
    expect(colecao(resposta)).toEqual({ items: [] });
  });

  it('CT-13: o corpo é o envelope `{ items }` e NENHUM item expõe `nameNormalized`', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    armazemDeEspecies.semear({ name: 'Gato' });

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — a chave de unicidade é detalhe de persistência. O `.strict()` dos
    // schemas já reprovaria um campo extra; a asserção textual cobre o caso de
    // ele viajar aninhado em qualquer lugar do corpo.
    expect(Object.keys(resposta.body as object)).toEqual(['items']);
    expect(JSON.stringify(resposta.body)).not.toContain('nameNormalized');
    expect(Object.keys(colecao(resposta).items[0] ?? {}).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'updatedAt',
    ]);
  });

  it('CT-13: `createdAt` e `updatedAt` saem com os VALORES da linha, e não trocados um pelo outro', async () => {
    // Arrange — a linha semeada tem os dois instantes DISTINTOS de propósito.
    // Com eles iguais, os dois campos da representação pública ficam
    // INTERCAMBIÁVEIS: trocar `createdAt` por `updatedAt` em `species.mapper.ts`
    // não reprovaria nada, porque nenhum valor os distinguiria e as demais
    // asserções olham só o conjunto de chaves e o formato ISO.
    //
    // Os instantes vêm das constantes do dublê e não de `new Date()`, para que a
    // asserção compare a string ISO-8601 exata.
    const token = await tokenDe(UserRole.ADMIN);
    const gato = armazemDeEspecies.semear({ name: 'Gato' });

    // Act
    const resposta = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — a representação pública inteira, por VALOR.
    expect(colecao(resposta).items).toEqual([
      {
        id: gato.id,
        name: 'Gato',
        createdAt: INSTANTE_DE_CRIACAO.toISOString(),
        updatedAt: INSTANTE_DE_ATUALIZACAO.toISOString(),
      },
    ]);
  });

  it('a rota ignora query string em vez de recusá-la — a listagem não aceita parâmetros (RN-12)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/species?page=1&q=gato')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
  });
});

describe('POST /api/species', () => {
  it('CT-01: nome válido e inédito responde 201 com a espécie criada', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await criarEspecie(token, 'Cachorro');

    // Assert — 201 com o recurso PLANO, sem envelope: o `{ items }` é do
    // endpoint de coleção, não do recurso individual.
    expect(resposta.status).toBe(201);
    expect(especie(resposta).name).toBe('Cachorro');
    expect(armazemDeEspecies.linhas).toHaveLength(1);
    expect(armazemDeEspecies.linhas[0]?.nameNormalized).toBe('cachorro');
  });

  it('CT-10: " Cão   Pastor " é gravado e devolvido como "Cão Pastor" (RN-03 / CA-07)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await criarEspecie(token, ' Cão   Pastor ');

    // Assert
    expect(resposta.status).toBe(201);
    expect(especie(resposta).name).toBe('Cão Pastor');
  });

  it('CT-02: nome vazio responde 400 VALIDATION_ERROR com `details` apontando o campo', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await criarEspecie(token, '');

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.code).toBe('VALIDATION_ERROR');
    expect(envelopeDeErro(resposta).error.message).toBe('Verifique os campos informados.');
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'Este campo é obrigatório.' },
    ]);
    expect(armazemDeEspecies.linhas).toHaveLength(0);
  });

  it('CT-04 / CT-07: as mensagens de mínimo e de máximo saem uma por campo, sem acumular', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const curto = await criarEspecie(token, 'G');
    const longo = await criarEspecie(token, 'A'.repeat(61));

    // Assert
    expect(envelopeDeErro(curto).error.details).toEqual([
      { field: 'name', message: 'O nome da espécie deve ter no mínimo 2 caracteres.' },
    ]);
    expect(envelopeDeErro(longo).error.details).toEqual([
      { field: 'name', message: 'O nome da espécie deve ter no máximo 60 caracteres.' },
    ]);
  });

  it('CT-07: nome de 60 caracteres cuja chave passa de 60 responde 400, e não 500', async () => {
    // Arrange — `İ` (U+0130) vira dois code units em minúsculo: o nome cabe no
    // `VARCHAR(60)` de `name` e a chave derivada NÃO cabe no de
    // `name_normalized`. Sem a segunda medição do validador, a requisição
    // atravessaria a validação e morreria no `INSERT`.
    const token = await tokenDe(UserRole.ADMIN);
    const nome = '\u0130'.repeat(60);

    // Act
    const resposta = await criarEspecie(token, nome);

    // Assert
    expect(nome).toHaveLength(60);
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.code).toBe('VALIDATION_ERROR');
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'O nome da espécie deve ter no máximo 60 caracteres.' },
    ]);
    expect(armazemDeEspecies.linhas).toHaveLength(0);
  });

  it('CT-08 / RN-04: "Ga<U+200B>to" com "Gato" já cadastrado responde 409 — o invisível não cria nome novo', async () => {
    // Arrange — o espaço de largura zero é indistinguível na tela. Sem a remoção
    // feita pelo validador, ele produziria outra chave de unicidade e o cadastro
    // passaria a exibir duas linhas visualmente idênticas.
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Gato');

    // Act
    const resposta = await criarEspecie(token, 'Ga\u200Bto');

    // Assert
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'SPECIES_NAME_ALREADY_EXISTS',
        message: 'Já existe uma espécie com este nome.',
      },
    });
    expect(armazemDeEspecies.linhas).toHaveLength(1);
  });

  it('CT-02: nome feito só de caracteres invisíveis responde 400 obrigatório, e nada é criado', async () => {
    // Arrange — dois U+200B passariam pelo mínimo de 2 caracteres se não fossem
    // removidos, e uma espécie de nome invisível entraria no cadastro.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await criarEspecie(token, '\u200B\u200B');

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'Este campo é obrigatório.' },
    ]);
    expect(armazemDeEspecies.linhas).toHaveLength(0);
  });

  it('CT-33: chave não prevista no corpo responde 400 nomeando a chave, e nada é criado (RN-13)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .post('/api/species')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gato', ordem: 1 });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'ordem', message: 'Campo não permitido nesta requisição.' },
    ]);
    expect(armazemDeEspecies.linhas).toHaveLength(0);
  });

  it('CT-08 / CT-09: nome duplicado em outra caixa ou com espaços responde 409 e a lista não muda', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Gato');

    // Act
    const outraCaixa = await criarEspecie(token, 'gato');
    const comEspacos = await criarEspecie(token, '  Gato  ');

    // Assert
    for (const resposta of [outraCaixa, comEspacos]) {
      expect(resposta.status).toBe(409);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'SPECIES_NAME_ALREADY_EXISTS',
          message: 'Já existe uma espécie com este nome.',
        },
      });
    }
    expect(armazemDeEspecies.linhas).toHaveLength(1);
  });

  it('CT-11: "Reptil" convive com "Réptil" — a unicidade é sensível a acento (RN-05)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Réptil');

    // Act
    const resposta = await criarEspecie(token, 'Reptil');

    // Assert
    expect(resposta.status).toBe(201);
    expect(armazemDeEspecies.linhas).toHaveLength(2);
  });

  it('CT-01: a espécie criada aparece na listagem já na posição alfabética correta', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Sapo');

    // Act
    await criarEspecie(token, 'Cachorro');

    const lista = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(colecao(lista).items.map((item) => item.name)).toEqual(['Cachorro', 'Sapo']);
  });
});

describe('PATCH /api/species/:id', () => {
  it('CT-16: renomeação válida responde 200 com o recurso atualizado e o MESMO id (RN-15)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Sapo'));

    // Act
    const resposta = await request(app)
      .patch(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perereca' });

    // Assert
    expect(resposta.status).toBe(200);
    expect(especie(resposta)).toMatchObject({ id: criada.id, name: 'Perereca' });
  });

  it('CT-17: salvar o mesmo nome em outra caixa responde 200, e não 409 (RN-07)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'gato'));

    // Act
    const resposta = await request(app)
      .patch(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'GATO' });

    // Assert
    expect(resposta.status).toBe(200);
    expect(especie(resposta).name).toBe('GATO');
  });

  it('CT-18: renomear para o nome de outra espécie responde 409 e nada é gravado', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Gato');

    const sapo = especie(await criarEspecie(token, 'Sapo'));

    // Act
    const resposta = await request(app)
      .patch(`/api/species/${sapo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'gato' });

    // Assert
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta).error.code).toBe('SPECIES_NAME_ALREADY_EXISTS');
    expect(armazemDeEspecies.buscarPorId(sapo.id)?.name).toBe('Sapo');
  });

  it('CT-20: renomear espécie inexistente responde 404 "Espécie não encontrada." (RN-14)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .patch(`/api/species/${UUID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perereca' });

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'SPECIES_NOT_FOUND', message: 'Espécie não encontrada.' },
    });
  });

  it('CT-34: identificador malformado responde 400 apontando `id`, e não 404', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .patch('/api/species/nao-e-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perereca' });

    // Assert — sem o schema de `params`, o texto arbitrário chegaria ao Prisma e
    // sairia como 500.
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'id', message: 'Identificador inválido.' },
    ]);
  });

  it('CT-19: nome vazio na renomeação responde 400 com a mesma mensagem do POST', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Sapo'));

    // Act
    const resposta = await request(app)
      .patch(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'Este campo é obrigatório.' },
    ]);
    expect(armazemDeEspecies.buscarPorId(criada.id)?.name).toBe('Sapo');
  });
});

describe('DELETE /api/species/:id', () => {
  it('CT-22: espécie sem vínculos responde 204 sem corpo e some da lista (RN-10)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    const lista = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — nem o recurso removido, nem mensagem de sucesso: o aviso
    // "Espécie excluída com sucesso." é texto de interface.
    expect(resposta.status).toBe(204);
    expect(resposta.text).toBe('');
    expect(colecao(lista).items).toEqual([]);
  });

  it('CT-27: excluir espécie inexistente responde 404 "Espécie não encontrada." (RN-14)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${UUID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'SPECIES_NOT_FOUND', message: 'Espécie não encontrada.' },
    });
  });

  it('CT-34: identificador malformado responde 400 apontando `id`', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .delete('/api/species/123')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'id', message: 'Identificador inválido.' },
    ]);
  });

  it('CT-24 / CT-32 [SOBRE DUBLÊ]: espécie com animais vinculados responde 409 SPECIES_IN_USE (camada 1 da RN-09)', async () => {
    // Arrange — a contagem é injetada pelo dublê porque a entidade `Animal` não
    // existe: nenhum estado do banco simulado consegue produzir "1 animal
    // vinculado" hoje. A TASK-010 da feature de Cadastro de pets reexecuta este
    // caso contra a tabela real.
    //
    // CT-32: a chamada é feita DIRETO à API, sem passar pela tela — a proteção
    // não depende da interface.
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    contadorDeUsoDeEspecies.definirContagem(criada.id, 1);

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'SPECIES_IN_USE',
        message:
          'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
      },
    });
  });

  it('CT-25 [SOBRE DUBLÊ]: recusada a exclusão, a espécie continua na listagem (RNF-02)', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    contadorDeUsoDeEspecies.definirContagem(criada.id, 1);

    // Act
    await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    const lista = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — asserção sobre o estado observável pelo cliente, e não sobre a
    // chamada interna.
    expect(colecao(lista).items.map((item) => item.name)).toEqual(['Gato']);
  });

  it('CT-26 [SOBRE DUBLÊ]: removidos os vínculos, a mesma exclusão responde 204', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    contadorDeUsoDeEspecies.definirContagem(criada.id, 1);

    const bloqueada = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Act
    contadorDeUsoDeEspecies.definirContagem(criada.id, 0);

    const concluida = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(bloqueada.status).toBe(409);
    expect(concluida.status).toBe(204);
  });

  it('CA-15 [SOBRE DUBLÊ]: violação `P2003` do banco sai como 409 SPECIES_IN_USE, nunca 500 (camada 2 da RN-09)', async () => {
    // Arrange — aqui a camada 1 AUTORIZA (contador em 0) e quem recusa é a
    // integridade referencial, simulada pelo gancho do dublê de Prisma. É o
    // comportamento que a FK `animals.species_id` com `onDelete: Restrict` vai
    // produzir de verdade na feature seguinte.
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    simularVinculoDeAnimalNoBanco(criada.id);

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    const lista = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert — mesmo `code` e mesma mensagem da camada 1: as duas origens são
    // indistinguíveis para o cliente.
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'SPECIES_IN_USE',
        message:
          'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
      },
    });
    expect(colecao(lista).items.map((item) => item.name)).toEqual(['Gato']);
  });

  it('RN-09 [SOBRE DUBLÊ]: pelo HTTP, o repositório e o contador rodam no EXECUTOR da transação, e não no cliente global', async () => {
    // Arrange — a propriedade que o `$transaction` de `DubleDePrisma` declara
    // essencial (entregar à callback um objeto DISTINTO de `this`) só estava
    // observada no caminho de `criarPrismaComTransacao`, que é o dos specs
    // unitários. Aqui ela é observada no caminho da integração: se o dublê
    // voltasse a entregar `this`, `tx` e o cliente global seriam o mesmo objeto,
    // nenhuma asserção sobre o argumento de `withTransaction(...)` conseguiria
    // distinguir os dois, e a RN-09 deixaria de ser observável por este arquivo
    // — em silêncio, com a suíte inteira verde.
    //
    // O espião é do PROTÓTIPO porque a instância de `PrismaSpeciesRepository`
    // nasce dentro de `dependenciasDeTeste()`, durante o import do `~/app`, e
    // não é alcançável daqui. Nenhuma implementação é substituída: o espião só
    // registra o argumento.
    const token = await tokenDe(UserRole.ADMIN);
    const criada = especie(await criarEspecie(token, 'Gato'));

    const repositorioNaTransacao = jest.spyOn(
      PrismaSpeciesRepository.prototype,
      'withTransaction',
    );
    const contadorNaTransacao = jest.spyOn(contadorDeUsoDeEspecies, 'withTransaction');

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${criada.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert — comparados por NOME e não por `toBe`: os dois candidatos são
    // objetos grandes que o Jest não imprime de forma útil, e a mensagem
    // precisa nomear o defeito.
    expect(resposta.status).toBe(204);
    expect({
      repositorio: ligacaoDoExecutor(repositorioNaTransacao.mock.calls[0]?.[0]),
      contador: ligacaoDoExecutor(contadorNaTransacao.mock.calls[0]?.[0]),
    }).toEqual({
      repositorio: 'executor da transação',
      contador: 'executor da transação',
    });
  });

  it('[SOBRE DUBLÊ] o `species.delete` avalia a AUSÊNCIA da linha antes do vínculo: id inexistente marcado no gancho responde `P2025`, e não `P2003`', async () => {
    // Arrange — a ordem reproduz a do Postgres: a linha do `where` é localizada
    // antes de qualquer constraint ser avaliada. Invertida, um id inexistente
    // marcado no gancho sairia como `409 SPECIES_IN_USE` em vez de `404` — que é
    // exatamente o que o comentário de `prisma-double.ts` afirma, e que até aqui
    // nenhum caso observava.
    //
    // A asserção é sobre o DELEGATE e não sobre o endpoint de propósito:
    // `delete-species.service.ts` faz um `findById` antes da escrita, então pelo
    // HTTP o `404` viria da pré-checagem e a ordem interna do dublê nunca seria
    // exercitada. É o único ponto desta suíte que fala com o dublê diretamente,
    // e a razão está aqui registrada.
    simularVinculoDeAnimalNoBanco(UUID_INEXISTENTE);

    // Act
    const motivo = await prisma.species
      .delete({ where: { id: UUID_INEXISTENTE } })
      .catch((erro: unknown) => erro);

    // Assert
    expect(codigoDoErroDePrisma(motivo)).toBe('P2025');
  });
});

describe('Envelope de erro das rotas de espécies (RNF-11 / CA-22)', () => {
  it('`details` aparece SOMENTE em falha de validação', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Gato');

    // Act
    const validacao = await criarEspecie(token, '');
    const conflito = await criarEspecie(token, 'gato');
    const ausente = await request(app)
      .delete(`/api/species/${UUID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`);
    const semSessao = await request(app).get('/api/species');

    // Assert — a chave precisa estar AUSENTE, e não presente com `undefined`.
    expect(Object.keys(envelopeDeErro(validacao).error).sort()).toEqual([
      'code',
      'details',
      'message',
    ]);
    for (const resposta of [conflito, ausente, semSessao]) {
      expect(Object.keys(envelopeDeErro(resposta).error)).toEqual(['code', 'message']);
    }
  });

  it('todos os `code` da feature saem em SCREAMING_SNAKE_CASE e são estáveis', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    await criarEspecie(token, 'Gato');

    // Act
    const codigos = [
      envelopeDeErro(await criarEspecie(token, '')).error.code,
      envelopeDeErro(await criarEspecie(token, 'gato')).error.code,
      envelopeDeErro(
        await request(app)
          .delete(`/api/species/${UUID_INEXISTENTE}`)
          .set('Authorization', `Bearer ${token}`),
      ).error.code,
      envelopeDeErro(await request(app).get('/api/species')).error.code,
    ];

    // Assert
    expect(codigos).toEqual([
      'VALIDATION_ERROR',
      'SPECIES_NAME_ALREADY_EXISTS',
      'SPECIES_NOT_FOUND',
      'SESSION_EXPIRED',
    ]);
    for (const codigo of codigos) {
      expect(codigo).toMatch(/^[A-Z][A-Z_]*$/);
    }
  });
});

describe('Regressão da FEATURE-002 — Autenticação Completa', () => {
  /**
   * A feature acrescenta a PRIMEIRA rota que usa `authorizeRole` no servidor.
   * Os critérios de aceite exigem reexecutar os cenários de acesso a rota
   * protegida sem sessão e de renovação de sessão, confirmando que nenhum `code`
   * nem mensagem existente mudou. `tests/integration/auth-routes.spec.ts`
   * continua rodando sem NENHUMA alteração — esta suíte não o toca.
   */
  it('rota protegida da autenticação continua respondendo 401 SESSION_EXPIRED sem sessão', async () => {
    // Arrange & Act
    const resposta = await request(app).get('/api/auth/me');

    // Assert — `code` e mensagem idênticos aos da FEATURE-002.
    expect(resposta.status).toBe(401);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Faça login novamente.' },
    });
  });

  it('a renovação de sessão continua emitindo cookie novo e revogando o anterior', async () => {
    // Arrange
    semearContaAtiva({ email: 'ana@exemplo.com', role: UserRole.CLIENTE });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@exemplo.com', password: SENHA });

    const cookieDoLogin = cookieDeRefresh(login);

    // Act
    const renovacao = await request(app).post('/api/auth/refresh').set('Cookie', cookieDoLogin);

    // Assert
    expect(renovacao.status).toBe(200);
    expect(cookieDeRefresh(renovacao)).not.toBe(cookieDoLogin);
    expect(armazemDeRefreshTokens.linhas).toHaveLength(2);
    expect(armazemDeRefreshTokens.linhas[0]?.revokedReason).toBe('ROTATED');
  });

  it('o `admin` mantém acesso às rotas da autenticação e às de espécies com a MESMA sessão', async () => {
    // Arrange — a role que o JWT carrega é a mesma consumida pelos dois
    // middlewares; um divergisse do outro e o admin perderia uma das duas áreas.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const perfil = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const especies = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(perfil.status).toBe(200);
    expect(especies.status).toBe(200);
  });

  it('rota inexistente sob /api continua saindo no mesmo envelope, e não em HTML do Express', async () => {
    // Arrange & Act — a montagem de `/api/species` não pode ter deslocado o
    // `not-found.middleware`.
    const resposta = await request(app).get('/api/species/extra/demais/nao-existe');

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta).error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('createSpeciesController — composição de produção', () => {
  it('sem dependências, a fábrica monta o grafo real e os quatro handlers ficam prontos', () => {
    // Arrange — o ramo DEFAULT da fábrica, que é o usado por
    // `species.routes.ts` em produção. O resto desta suíte injeta dependências
    // (ver a nota no topo do arquivo), então sem este caso o caminho real
    // ficaria sem nenhuma execução.
    const { createSpeciesController } = jest.requireActual<
      typeof import('~/domains/species/species.controller')
    >('~/domains/species/species.controller');

    // Act — a fábrica constrói `PrismaSpeciesRepository`,
    // `PrismaSpeciesUsageCounter` e os quatro services sobre o cliente (aqui,
    // o dublê). Nenhuma consulta é emitida: a composição não toca o banco.
    const controller = createSpeciesController();

    // Assert — os handlers precisam ser propriedades com arrow function; um
    // método comum chegaria à rota desacoplado da instância e `this` viria
    // `undefined` na primeira requisição.
    expect(controller).toBeInstanceOf(SpeciesController);
    for (const handler of [
      controller.list,
      controller.create,
      controller.rename,
      controller.remove,
    ]) {
      expect(typeof handler).toBe('function');
    }
  });
});

/**
 * Le o `Set-Cookie` sem deixar o `any` de `resposta.headers` entrar no fluxo, e
 * devolve so o par `nome=valor`, que e o que o navegador reenvia.
 */
function cookieDeRefresh(resposta: Response): string {
  const cabecalhos: unknown = resposta.headers;

  if (typeof cabecalhos !== 'object' || cabecalhos === null) {
    throw new Error('Resposta sem cabeçalhos.');
  }

  const valor: unknown = Reflect.get(cabecalhos, 'set-cookie');
  const cookies = Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];
  const encontrado = cookies.find((cookie) => cookie.startsWith(`${NOME_DO_COOKIE}=`));

  if (encontrado === undefined) {
    throw new Error(`Resposta sem cookie ${NOME_DO_COOKIE}: ${cookies.join(' | ')}`);
  }

  return encontrado.split(';')[0] ?? '';
}
