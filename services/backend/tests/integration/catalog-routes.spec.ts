import { UserRole, UserStatus } from '@prisma/client';
import request, { type Response } from 'supertest';
import { z } from 'zod';

/**
 * Substitui o cliente Prisma pelo duble em memoria ANTES de qualquer import do
 * `app`: as fabricas dos controllers rodam no import dos arquivos de rota. Ele
 * atende as rotas de AUTENTICACAO e as ADMINISTRATIVAS desta suite; o catalogo
 * usa o fake da porta, injetado abaixo.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

/**
 * O UNICO colaborador injetado no catalogo e o REPOSITORIO. Os tres services, o
 * controller, os middlewares, o validador e o `app.ts` sao os de producao — e e
 * isso que faz o contrato de query, o envelope de erro, o `Cache-Control` e a
 * AUSENCIA de autenticacao serem exercitados de fato.
 */
jest.mock('~/domains/catalog/catalog.controller', () => {
  const real = jest.requireActual<typeof import('~/domains/catalog/catalog.controller')>(
    '~/domains/catalog/catalog.controller',
  );

  return {
    ...real,
    createCatalogController: (): CatalogController =>
      real.createCatalogController(dependenciasDeTeste()),
  };
});

import {
  CatalogController,
  type CatalogControllerDependencies,
} from '~/domains/catalog/catalog.controller';
import { ListAvailableCitiesService } from '~/domains/catalog/services/list-available-cities.service';
import { ListAvailableSpeciesService } from '~/domains/catalog/services/list-available-species.service';
import { ListPublicAnimalsService } from '~/domains/catalog/services/list-public-animals.service';
import { hashPassword } from '~/utils/password-hasher';

import {
  armazemDoCatalogo,
  InMemoryPublicCatalogRepository,
} from '../fakes/in-memory-public-catalog.repository';
import { armazemDeUsuarios, reiniciarPrismaDouble } from '../fakes/prisma-double';

import { app } from '~/app';

/**
 * Contrato HTTP da VITRINE PUBLICA.
 *
 * O que se verifica aqui e o que o navegador de um visitante ANONIMO recebe:
 * status, envelope de erro, cabecalho de cache e — sobretudo — a AUSENCIA de
 * `401`/`403`. Nenhuma requisicao desta suite envia `Authorization`, exceto as
 * tres que existem justamente para comparar os corpos por role.
 *
 * Declaracao de FUNCAO e nao `const`: ela e chamada pela fabrica dublada durante
 * o `require` do `~/app`, que o Jest posiciona acima das declaracoes de modulo.
 */
function dependenciasDeTeste(): CatalogControllerDependencies {
  const repositorio = new InMemoryPublicCatalogRepository(armazemDoCatalogo);

  return {
    listPublicAnimals: new ListPublicAnimalsService(repositorio),
    listAvailableSpecies: new ListAvailableSpeciesService(repositorio),
    listAvailableCities: new ListAvailableCitiesService(repositorio),
  };
}

const SENHA = 'Senha123!';

const envelopeDeErroSchema = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z
          .array(z.object({ field: z.string(), message: z.string() }).strict())
          .optional(),
      })
      .strict(),
  })
  .strict();

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
}

async function tokenDe(role: UserRole): Promise<string> {
  const email = role === UserRole.ADMIN ? 'admin@catdog.com' : 'ana@exemplo.com';

  armazemDeUsuarios.semear({
    email,
    role,
    status: UserStatus.ACTIVE,
    passwordHash: await hashPassword(SENHA),
    emailConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const resposta = await request(app).post('/api/auth/login').send({ email, password: SENHA });

  return z.object({ accessToken: z.string().min(1) }).parse(resposta.body).accessToken;
}

const ENDPOINTS_PUBLICOS = [
  '/api/catalog/animals',
  '/api/catalog/species',
  '/api/catalog/cities',
] as const;

beforeEach(() => {
  reiniciarPrismaDouble();
  armazemDoCatalogo.restaurar();
});

describe('CA-01: os três endpoints são PÚBLICOS', () => {
  it.each(ENDPOINTS_PUBLICOS)('CT-02/CT-106: %s responde 200 sem credencial', async (caminho) => {
    // Arrange & Act — nenhum cabeçalho `Authorization`.
    const resposta = await request(app).get(caminho);

    // Assert — o critério é sobre NUNCA responder 401 nem 403, e um `expect(200)`
    // sozinho não registra essa intenção.
    expect([401, 403]).not.toContain(resposta.status);
    expect(resposta.status).toBe(200);
  });

  it('CT-04: anônimo, `cliente` e `admin` recebem corpos IDÊNTICOS', async () => {
    // Arrange
    armazemDoCatalogo.semear({ name: 'Theo' });

    const tokenCliente = await tokenDe(UserRole.CLIENTE);
    const tokenAdmin = await tokenDe(UserRole.ADMIN);

    // Act
    const anonimo = await request(app).get('/api/catalog/animals');
    const cliente = await request(app)
      .get('/api/catalog/animals')
      .set('Authorization', `Bearer ${tokenCliente}`);
    const admin = await request(app)
      .get('/api/catalog/animals')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    // Assert — a vitrine não tem representação privilegiada (RN-03, CA-03).
    expect(anonimo.body).toEqual(cliente.body);
    expect(cliente.body).toEqual(admin.body);
  });

  it.each(ENDPOINTS_PUBLICOS)('CT-110: %s responde com `Cache-Control: no-store`', async (caminho) => {
    // Um cache exibiria animal já adotado a novo interessado.
    const resposta = await request(app).get(caminho);

    expect(resposta.headers['cache-control']).toBe('no-store');
  });
});

describe('CT-24/QA-49: `status` é INEXPRIMÍVEL na query', () => {
  it.each(['status=adotado', 'status=disponivel', 'status='])(
    '?%s responde 400 apontando o campo',
    async (query: string) => {
      // Act
      const resposta = await request(app).get(`/api/catalog/animals?${query}`);

      // Assert — não há regra dizendo "status é proibido": o campo não existe no
      // schema, e o guarda de chaves extras o recusa.
      expect(resposta.status).toBe(400);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos informados.',
          details: [{ field: 'status', message: 'Campo não permitido nesta requisição.' }],
        },
      });
    },
  );

  it('CT-87: parâmetro inventado também é recusado', async () => {
    const resposta = await request(app).get('/api/catalog/animals?ordenacao=nome');

    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details?.[0]?.field).toBe('ordenacao');
  });
});

describe('faixas e conjuntos da query', () => {
  it.each(['size=gigante', 'size=', 'size=1'])('CT-45: ?%s responde 400', async (query: string) => {
    expect((await request(app).get(`/api/catalog/animals?${query}`)).status).toBe(400);
  });

  it('CT-46: `sex=outro` responde 400', async () => {
    expect((await request(app).get('/api/catalog/animals?sex=outro')).status).toBe(400);
  });

  it.each(['maxAgeYears=-1', 'maxAgeYears=31', 'maxAgeYears=3.5', 'maxAgeYears=abc'])(
    'CT-61/CT-62: ?%s responde 400',
    async (query: string) => {
      expect((await request(app).get(`/api/catalog/animals?${query}`)).status).toBe(400);
    },
  );

  it.each(['maxAgeYears=0', 'maxAgeYears=30'])('CT-62: ?%s responde 200', async (query: string) => {
    expect((await request(app).get(`/api/catalog/animals?${query}`)).status).toBe(200);
  });

  it('CT-33: busca de 120 caracteres responde 200; CT-34: 121 responde 400', async () => {
    expect((await request(app).get(`/api/catalog/animals?search=${'a'.repeat(120)}`)).status).toBe(200);
    expect((await request(app).get(`/api/catalog/animals?search=${'a'.repeat(121)}`)).status).toBe(400);
  });

  it.each(['speciesId=abc', 'cityId=123'])('CT-49: ?%s responde 400 apontando o parâmetro', async (query: string) => {
    // Act
    const resposta = await request(app).get(`/api/catalog/animals?${query}`);
    const campo = query.split('=')[0];

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: campo, message: 'Identificador inválido.' },
    ]);
  });

  it.each(['pageSize=0', 'pageSize=101'])('CT-77: ?%s responde 400', async (query: string) => {
    expect((await request(app).get(`/api/catalog/animals?${query}`)).status).toBe(400);
  });

  it('CT-78: sem `pageSize`, a página tem 12 itens', async () => {
    // Arrange
    for (let indice = 0; indice < 20; indice += 1) {
      armazemDoCatalogo.semear({ name: `Animal ${String(indice)}` });
    }

    // Act
    const resposta = await request(app).get('/api/catalog/animals');

    // Assert
    expect(resposta.body.pagination).toEqual({ page: 1, pageSize: 12, total: 20 });
    expect(resposta.body.items).toHaveLength(12);
  });

  it('CT-76: página além da última responde 200 com lista vazia', async () => {
    armazemDoCatalogo.semear({ name: 'Theo' });

    const resposta = await request(app).get('/api/catalog/animals?page=99');

    expect(resposta.status).toBe(200);
    expect(resposta.body.items).toEqual([]);
    expect(resposta.body.pagination.total).toBe(1);
  });

  it('CT-47: identificador bem formado inexistente responde 200 com lista vazia — nunca 404', async () => {
    const resposta = await request(app).get(
      '/api/catalog/animals?speciesId=00000000-0000-4000-8000-000000000000',
    );

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 12, total: 0 },
    });
  });
});

describe('opções de filtro', () => {
  it('CT-50: `/species` traz só as espécies com animal disponível, em ordem ignorando caixa', async () => {
    // Arrange
    armazemDoCatalogo.semear({ speciesId: 'e-z', speciesName: 'zebra' });
    armazemDoCatalogo.semear({ speciesId: 'e-a', speciesName: 'Abelha' });
    armazemDoCatalogo.semear({ speciesId: 'e-x', speciesName: 'Oculta', status: 'ADOTADO' });

    // Act
    const resposta = await request(app).get('/api/catalog/species');

    // Assert
    expect(resposta.body.items).toEqual([
      { id: 'e-a', name: 'Abelha' },
      { id: 'e-z', name: 'zebra' },
    ]);
  });

  it('CT-51: `/cities` traz `{id,name,stateUf}`, ordenado por UF e depois por nome', async () => {
    // Arrange
    armazemDoCatalogo.semear({ cityId: 'c-pr', cityName: 'Campo Magro', stateUf: 'PR' });
    armazemDoCatalogo.semear({ cityId: 'c-es', cityName: 'Vitória', stateUf: 'ES' });
    armazemDoCatalogo.semear({ cityId: 'c-es2', cityName: 'Boa Esperança', stateUf: 'ES' });

    // Act
    const resposta = await request(app).get('/api/catalog/cities');

    // Assert
    expect(resposta.body.items).toEqual([
      { id: 'c-es2', name: 'Boa Esperança', stateUf: 'ES' },
      { id: 'c-es', name: 'Vitória', stateUf: 'ES' },
      { id: 'c-pr', name: 'Campo Magro', stateUf: 'PR' },
    ]);
  });

  it('CT-52: a cidade sai da lista quando o último animal dela deixa de estar disponível', async () => {
    // Arrange
    const unico = armazemDoCatalogo.semear({ cityId: 'c-pr', cityName: 'Campo Magro' });

    expect((await request(app).get('/api/catalog/cities')).body.items).toHaveLength(1);

    // Act
    armazemDoCatalogo.alterarStatus(unico.id, 'ADOTADO');

    // Assert
    expect((await request(app).get('/api/catalog/cities')).body.items).toEqual([]);
  });

  it('catálogo sem disponíveis responde 200 com lista vazia nos dois — nunca 404', async () => {
    const especies = await request(app).get('/api/catalog/species');
    const cidades = await request(app).get('/api/catalog/cities');

    expect(especies.status).toBe(200);
    expect(cidades.status).toBe(200);
    expect(especies.body).toEqual({ items: [] });
    expect(cidades.body).toEqual({ items: [] });
  });

  it('os dois endpoints NÃO usam o envelope paginado', async () => {
    // Um `pagination` vazio induziria o frontend a paginar o que não pagina.
    expect((await request(app).get('/api/catalog/species')).body).not.toHaveProperty('pagination');
    expect((await request(app).get('/api/catalog/cities')).body).not.toHaveProperty('pagination');
  });
});

describe('CT-105/CT-107/QA-48: a vitrine NÃO afrouxou as rotas administrativas', () => {
  it.each(['/api/animals', '/api/species', '/api/states'])(
    '%s sem credencial continua respondendo 401',
    async (caminho: string) => {
      const resposta = await request(app).get(caminho);

      expect(resposta.status).toBe(401);
      expect(envelopeDeErro(resposta).error.code).toBe('SESSION_EXPIRED');
    },
  );

  it.each(['/api/animals', '/api/species', '/api/states'])(
    '%s com token de `cliente` continua respondendo 403',
    async (caminho: string) => {
      const token = await tokenDe(UserRole.CLIENTE);
      const resposta = await request(app).get(caminho).set('Authorization', `Bearer ${token}`);

      expect(resposta.status).toBe(403);
      expect(envelopeDeErro(resposta).error.code).toBe('FORBIDDEN');
    },
  );
});

describe('CT-134: `nameSearch` não aparece em resposta nenhuma', () => {
  it('nem na projeção pública, nem nas opções de filtro', async () => {
    // Arrange
    armazemDoCatalogo.semear({ name: 'Theo', storagePaths: ['animals/a1/capa.jpg'] });

    // Act
    const animais = await request(app).get('/api/catalog/animals');
    const especies = await request(app).get('/api/catalog/species');
    const cidades = await request(app).get('/api/catalog/cities');

    // Assert — varredura sobre o JSON serializado, que pega o campo em qualquer
    // profundidade.
    for (const resposta of [animais, especies, cidades]) {
      expect(JSON.stringify(resposta.body)).not.toContain('nameSearch');
      expect(JSON.stringify(resposta.body)).not.toContain('name_search');
    }
  });
});

describe('o Router do catálogo só declara GET (RN-08, CA-48)', () => {
  it.each(['post', 'patch', 'delete', 'put'] as const)('%s em /api/catalog/animals não casa rota', async (verbo) => {
    const resposta = await request(app)[verbo]('/api/catalog/animals');

    expect(resposta.status).toBe(404);
  });
});
