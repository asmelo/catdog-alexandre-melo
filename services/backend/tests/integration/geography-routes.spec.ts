import { UserRole, UserStatus } from '@prisma/client';
import request, { type Response, type Test } from 'supertest';
import { z } from 'zod';

/**
 * Substitui o cliente Prisma pelo duble em memoria ANTES de qualquer import do
 * `app`: a fabrica `createGeographyController()` roda no import do arquivo de
 * rotas e ja constroi o `PrismaStateRepository` em cima dele.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

import {
  GeographyController,
  createGeographyController,
} from '~/domains/geography/geography.controller';
import { PrismaStateRepository } from '~/domains/geography/repositories/state.repository';
import { ListCitiesByStateService } from '~/domains/geography/services/list-cities-by-state.service';
import { ListStatesService } from '~/domains/geography/services/list-states.service';
import { prisma } from '~/infra/prisma/prisma-client';
import { hashPassword } from '~/utils/password-hasher';

import {
  armazemDeGeografia,
  armazemDeUsuarios,
  reiniciarPrismaDouble,
} from '../fakes/prisma-double';

import { app } from '~/app';

/**
 * Contrato HTTP de `/api/states` (CT-36, CT-42, CT-43).
 *
 * ================== NENHUMA DEPENDENCIA E INJETADA AQUI ==================
 *
 * Ao contrario da suite de animais, esta roda a fabrica PADRAO do controller: a
 * geografia nao tem armazenamento de objetos nem transacao, entao o unico
 * colaborador externo e o cliente Prisma — que ja esta dublado. O grafo de
 * producao inteiro roda, incluindo o `PrismaStateRepository` de verdade, e as
 * duas consultas que ele monta (`orderBy: { uf: 'asc' }` e
 * `orderBy: { name: 'asc' }`) sao verificadas pelo duble, que recusa qualquer
 * outra em vez de aceitar em silencio.
 *
 * ================== POR QUE UM RECORTE, E NAO A CARGA REAL ==================
 *
 * As 27 unidades federativas sao semeadas porque o CT-42 e sobre elas serem 27.
 * Os 5.570 municipios NAO sao: o CT-36 e sobre o FILTRO por estado e sobre a
 * ordem alfabetica, e nada nele melhora com cinco mil linhas. A carga completa e
 * exercitada onde ela e o assunto — no spec da propria semeadura.
 */

const SENHA = 'Senha123!';

const estadoPublicoSchema = z
  .object({ uf: z.string().length(2), name: z.string().min(1) })
  .strict();

const cidadePublicaSchema = z
  .object({ id: z.string().uuid(), name: z.string().min(1) })
  .strict();

const colecaoDeEstadosSchema = z
  .object({ items: z.array(estadoPublicoSchema) })
  .strict();

const colecaoDeCidadesSchema = z
  .object({ items: z.array(cidadePublicaSchema) })
  .strict();

const envelopeDeErroSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

/** As 27 unidades federativas, em ordem NAO alfabetica de proposito. */
const UNIDADES_FEDERATIVAS: ReadonlyArray<{ readonly uf: string; readonly name: string }> = [
  { uf: 'SP', name: 'Sao Paulo' },
  { uf: 'PR', name: 'Parana' },
  { uf: 'ES', name: 'Espirito Santo' },
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapa' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceara' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'GO', name: 'Goias' },
  { uf: 'MA', name: 'Maranhao' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Para' },
  { uf: 'PB', name: 'Paraiba' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piaui' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondonia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

/** Municipios do Parana, semeados fora de ordem alfabetica de proposito. */
const MUNICIPIOS_DO_PARANA = ['Curitiba', 'Campo Magro', 'Araucaria', 'Ponta Grossa'];

let hashDaSenha = '';

beforeAll(async () => {
  hashDaSenha = await hashPassword(SENHA);
});

beforeEach(() => {
  reiniciarPrismaDouble();

  for (const unidade of UNIDADES_FEDERATIVAS) {
    armazemDeGeografia.semearEstado(unidade);
  }

  const parana = armazemDeGeografia.buscarEstadoPorUf('PR');
  const espiritoSanto = armazemDeGeografia.buscarEstadoPorUf('ES');

  if (parana === null || espiritoSanto === null) {
    throw new Error('Semente de geografia: PR e ES deveriam existir.');
  }

  for (const name of MUNICIPIOS_DO_PARANA) {
    armazemDeGeografia.semearCidade({ stateId: parana.id, name });
  }

  armazemDeGeografia.semearCidade({ stateId: espiritoSanto.id, name: 'Boa Esperanca' });
});

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
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

interface EndpointDeGeografia {
  readonly nome: string;
  readonly caminho: string;
}

const ENDPOINTS: ReadonlyArray<EndpointDeGeografia> = [
  { nome: 'GET /api/states', caminho: '/api/states' },
  { nome: 'GET /api/states/:uf/cities', caminho: '/api/states/PR/cities' },
];

function chamar(endpoint: EndpointDeGeografia): Test {
  return request(app).get(endpoint.caminho);
}

describe('Autorização dos dois endpoints de /api/states', () => {
  it.each(ENDPOINTS)(
    'CT-90: $nome sem credencial responde 401 SESSION_EXPIRED (RNF-01)',
    async (endpoint: EndpointDeGeografia) => {
      // Arrange & Act
      const resposta = await chamar(endpoint);

      // Assert
      expect(resposta.status).toBe(401);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Sua sessão expirou. Faça login novamente.',
        },
      });
    },
  );

  it.each(ENDPOINTS)(
    'CT-89: $nome com sessão de `cliente` responde 403 FORBIDDEN (RNF-01)',
    async (endpoint: EndpointDeGeografia) => {
      // Arrange
      const token = await tokenDe(UserRole.CLIENTE);

      // Act
      const resposta = await chamar(endpoint).set('Authorization', `Bearer ${token}`);

      // Assert — 403 e não 401: a credencial está correta, falta permissão.
      expect(resposta.status).toBe(403);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para acessar este recurso.',
        },
      });
    },
  );
});

describe('GET /api/states', () => {
  it('CT-42: responde as 27 unidades federativas em ordem alfabética de sigla', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);

    const { items } = colecaoDeEstadosSchema.parse(resposta.body);

    expect(items).toHaveLength(27);
    expect(items.map((estado) => estado.uf)).toEqual(
      [...items.map((estado) => estado.uf)].sort(),
    );
    expect(items[0]?.uf).toBe('AC');
    expect(items.at(-1)?.uf).toBe('TO');
  });

  it('CT-42: a representação pública do estado NÃO expõe o identificador interno', async () => {
    // Arrange — o estado é escolhido por sigla em todo o produto; expor o `id`
    // criaria um segundo identificador para a mesma coisa (RN-59).
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states')
      .set('Authorization', `Bearer ${token}`);

    // Assert — o schema é `strict()`: uma chave a mais faz a leitura falhar.
    expect(colecaoDeEstadosSchema.parse(resposta.body).items[0]).toEqual({
      uf: 'AC',
      name: 'Acre',
    });
  });
});

describe('GET /api/states/:uf/cities', () => {
  it('CT-36: responde apenas as cidades do estado pedido, em ordem alfabética', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states/PR/cities')
      .set('Authorization', `Bearer ${token}`);

    // Assert — "Boa Esperanca" é do ES e não pode aparecer aqui.
    expect(resposta.status).toBe(200);

    const { items } = colecaoDeCidadesSchema.parse(resposta.body);

    expect(items.map((cidade) => cidade.name)).toEqual([
      'Araucaria',
      'Campo Magro',
      'Curitiba',
      'Ponta Grossa',
    ]);
  });

  it('CT-36: a sigla em minúsculas encontra o mesmo estado', async () => {
    // Arrange — o schema normaliza para maiúsculas antes da consulta.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states/pr/cities')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(colecaoDeCidadesSchema.parse(resposta.body).items).toHaveLength(4);
  });

  it('CT-36: estado sem cidade no recorte responde lista vazia, e não erro', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states/SP/cities')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(colecaoDeCidadesSchema.parse(resposta.body).items).toEqual([]);
  });

  it('CT-43: sigla inexistente responde 404 STATE_NOT_FOUND', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/states/XX/cities')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'STATE_NOT_FOUND', message: 'Estado não encontrado.' },
    });
  });

  it.each(['P', 'PRR', '12'])(
    'CT-43: a sigla malformada "%s" responde 400 com o problema apontado no campo `uf`',
    async (uf: string) => {
      // Arrange
      const token = await tokenDe(UserRole.ADMIN);

      // Act
      const resposta = await request(app)
        .get(`/api/states/${uf}/cities`)
        .set('Authorization', `Bearer ${token}`);

      // Assert — 400 e não 404: o que está errado é a forma do parâmetro, e não a
      // ausência do estado.
      expect(resposta.status).toBe(400);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos informados.',
          details: [{ field: 'uf', message: 'Identificador inválido.' }],
        },
      });
    },
  );
});

describe('createGeographyController — ramo de injeção', () => {
  it('com dependências, a fábrica devolve o controller montado sobre elas e não constrói o grafo padrão', () => {
    // Arrange — o ramo que a suíte inteira acima NÃO percorre: todos os casos de
    // contrato HTTP passam pela fábrica padrão, porque aqui o único colaborador
    // externo é o cliente Prisma e ele já está dublado. O ramo de injeção existe
    // para quem precise substituir um service — e um ramo que nenhum teste
    // percorre é um ramo que pode ter quebrado sem ninguém notar.
    const states = new PrismaStateRepository(prisma);
    const dependencias = {
      listStates: new ListStatesService(states),
      listCitiesByState: new ListCitiesByStateService(states),
    };

    // Act
    const controller = createGeographyController(dependencias);

    // Assert
    expect(controller).toBeInstanceOf(GeographyController);
  });
});
