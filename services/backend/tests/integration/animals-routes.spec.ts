import { UserRole, UserStatus } from '@prisma/client';
import request, { type Response, type Test } from 'supertest';
import { z } from 'zod';

/**
 * Substitui o cliente Prisma pelo duble em memoria ANTES de qualquer import do
 * `app`, como em `auth-routes.spec.ts` e `species-routes.spec.ts`: as fabricas
 * dos controllers rodam no import dos arquivos de rota e ja constroem os
 * repositorios em cima dele.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

/**
 * DECISAO SOBRE O QUE E INJETADO — E SOBRE O QUE NAO E.
 *
 * O UNICO colaborador substituido e o ARMAZENAMENTO DE OBJETOS. O motivo e
 * simples e nao tem alternativa: o `SupabaseImageStorage` fala HTTP com um balde
 * que nao existe fora de producao, e a task proibe qualquer teste desta suite de
 * abrir socket para ele.
 *
 * Tudo o mais e producao de verdade: `PrismaAnimalRepository`,
 * `PrismaSpeciesRepository` e `PrismaStateRepository` REAIS sobre o cliente
 * dublado, os seis services reais, o controller real, os middlewares reais e o
 * `app.ts` real. E o que faz o `orderBy` de tres criterios, o `where` com a marca
 * de alteracao e o `include` das relacoes serem exercitados de fato — o duble de
 * Prisma recusa qualquer consulta diferente da combinada em vez de devolver
 * linhas em silencio.
 *
 * O ramo DEFAULT da fabrica (o de producao, que constroi o cliente do Supabase)
 * tem um caso proprio no fim deste arquivo.
 */
jest.mock('~/domains/animals/animals.controller', () => {
  const real = jest.requireActual<typeof import('~/domains/animals/animals.controller')>(
    '~/domains/animals/animals.controller',
  );

  return {
    ...real,
    createAnimalsController: (): AnimalsController =>
      real.createAnimalsController(dependenciasDeTeste()),
  };
});

// A partir daqui os imports veem o cliente dublado. A ORDEM importa: tudo de que
// `dependenciasDeTeste` precisa e carregado ANTES de `~/app`, porque e o import
// do `app` que dispara a fabrica dublada acima.
import { prisma } from '~/infra/prisma/prisma-client';

import {
  AnimalsController,
  createAnimalsController,
  type AnimalsControllerDependencies,
} from '~/domains/animals/animals.controller';
import { PrismaAnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { ChangeAnimalStatusService } from '~/domains/animals/services/change-animal-status.service';
import { CreateAnimalService } from '~/domains/animals/services/create-animal.service';
import { DeleteAnimalService } from '~/domains/animals/services/delete-animal.service';
import { GetAnimalService } from '~/domains/animals/services/get-animal.service';
import { ListAnimalsService } from '~/domains/animals/services/list-animals.service';
import { StoreAnimalImagesService } from '~/domains/animals/services/store-animal-images.service';
import { UpdateAnimalService } from '~/domains/animals/services/update-animal.service';
import { PrismaStateRepository } from '~/domains/geography/repositories/state.repository';
import { PrismaSpeciesRepository } from '~/domains/species/repositories/species.repository';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_ANIMAL } from '~/infra/upload/upload-limits';
import { hashPassword } from '~/utils/password-hasher';

import { armazenamentoDeAnimais } from '../fakes/fake-image-storage';
import {
  armazemDeAnimais,
  armazemDeEspecies,
  armazemDeGeografia,
  armazemDeUsuarios,
  reiniciarPrismaDouble,
} from '../fakes/prisma-double';
import {
  jpegBuffer,
  pngBuffer,
  svgBuffer,
} from '../fixtures/image-fixtures';

import { app } from '~/app';

/**
 * Contrato HTTP das rotas de `/api/animals` (CT-13, CT-14, CT-75, CT-89 a CT-92).
 *
 * Aqui NAO se testa regra de negocio — ela e coberta pelos specs unitarios dos
 * services e dos validadores. O que se verifica e o que o frontend consome:
 * status, `code` e `message` exatos do envelope, o corpo `multipart/form-data`
 * montado com `.field()` e `.attach()`, e a autorizacao de CADA endpoint.
 *
 * Declaracao de FUNCAO (e nao `const`): ela e chamada pela fabrica dublada
 * durante o `require` do `~/app`, que o Jest posiciona acima das declaracoes de
 * modulo. Um `const` estaria na zona morta temporal nesse instante.
 */
function dependenciasDeTeste(): AnimalsControllerDependencies {
  const animals = new PrismaAnimalRepository(prisma, prisma);
  const especies = new PrismaSpeciesRepository(prisma);
  const geografia = new PrismaStateRepository(prisma);
  const imagens = new StoreAnimalImagesService(armazenamentoDeAnimais);

  return {
    listAnimals: new ListAnimalsService(animals),
    getAnimal: new GetAnimalService(animals),
    createAnimal: new CreateAnimalService(animals, especies, geografia, imagens, prisma),
    updateAnimal: new UpdateAnimalService(animals, especies, geografia, imagens, prisma),
    changeAnimalStatus: new ChangeAnimalStatusService(animals),
    deleteAnimal: new DeleteAnimalService(animals, imagens),
  };
}

const SENHA = 'Senha123!';

/** UUID bem formado que nao corresponde a registro nenhum. */
const UUID_INEXISTENTE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const imagemPublicaSchema = z
  .object({ id: z.string().uuid(), url: z.string().url(), position: z.number().int() })
  .strict();

const animalPublicoSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    species: z.object({ id: z.string().uuid(), name: z.string() }).strict(),
    size: z.enum(['pequeno', 'medio', 'grande']),
    sex: z.enum(['macho', 'femea']),
    status: z.enum(['disponivel', 'reservado', 'adotado', 'indisponivel']),
    birthDate: z.string().nullable(),
    ageInYears: z.number().int().nullable(),
    description: z.string().nullable(),
    acceptsOtherAnimals: z.boolean(),
    needsLargeSpace: z.boolean(),
    city: z
      .object({ id: z.string().uuid(), name: z.string(), stateUf: z.string().length(2) })
      .strict(),
    images: z.array(imagemPublicaSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

const paginaDeAnimaisSchema = z
  .object({
    items: z.array(animalPublicoSchema),
    pagination: z
      .object({ page: z.number(), pageSize: z.number(), total: z.number() })
      .strict(),
  })
  .strict();

const envelopeDeErroSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
      })
      .strict(),
  })
  .strict();

let hashDaSenha = '';
let speciesId = '';
let cityId = '';

beforeAll(async () => {
  // Um unico hash bcrypt reaproveitado por toda a suite.
  hashDaSenha = await hashPassword(SENHA);
});

beforeEach(() => {
  reiniciarPrismaDouble();
  armazenamentoDeAnimais.limpar();

  speciesId = armazemDeEspecies.semear({ name: 'Cachorro' }).id;

  const estado = armazemDeGeografia.semearEstado({ uf: 'ES', name: 'Espirito Santo' });

  cityId = armazemDeGeografia.semearCidade({
    stateId: estado.id,
    name: 'Boa Esperanca',
  }).id;
});

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
}

function animal(resposta: Response): z.infer<typeof animalPublicoSchema> {
  return animalPublicoSchema.parse(resposta.body);
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

interface EndpointDeAnimais {
  readonly nome: string;
  readonly metodo: Metodo;
  readonly caminho: string;
}

/**
 * Os SEIS endpoints da feature. A RNF-01 exige um caso por endpoint por situacao,
 * e nao um teste que cubra uma rota: e a lista completa que prova que nenhuma
 * delas ficou sem guarda.
 */
const ENDPOINTS: ReadonlyArray<EndpointDeAnimais> = [
  { nome: 'GET /api/animals', metodo: 'get', caminho: '/api/animals' },
  {
    nome: 'GET /api/animals/:id',
    metodo: 'get',
    caminho: `/api/animals/${UUID_INEXISTENTE}`,
  },
  { nome: 'POST /api/animals', metodo: 'post', caminho: '/api/animals' },
  {
    nome: 'PATCH /api/animals/:id',
    metodo: 'patch',
    caminho: `/api/animals/${UUID_INEXISTENTE}`,
  },
  {
    nome: 'PATCH /api/animals/:id/status',
    metodo: 'patch',
    caminho: `/api/animals/${UUID_INEXISTENTE}/status`,
  },
  {
    nome: 'DELETE /api/animals/:id',
    metodo: 'delete',
    caminho: `/api/animals/${UUID_INEXISTENTE}`,
  },
];

/** Despacho sem indexar o agente por string, que traria `any` para o fluxo. */
function chamar(endpoint: EndpointDeAnimais): Test {
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

/** Campos obrigatorios do cadastro, no formato que o multipart entrega. */
function camposDoCadastro(
  ajustes: Readonly<Record<string, string>> = {},
): Readonly<Record<string, string>> {
  return { name: 'Theo', speciesId, cityId, size: 'grande', sex: 'macho', ...ajustes };
}

function cadastrar(
  token: string,
  campos: Readonly<Record<string, string>> = camposDoCadastro(),
): Test {
  const envio = request(app).post('/api/animals').set('Authorization', `Bearer ${token}`);

  for (const [campo, valor] of Object.entries(campos)) {
    void envio.field(campo, valor);
  }

  return envio;
}

// --------------------------------------------------------------------------

describe('Autorização dos seis endpoints de /api/animals (RNF-01)', () => {
  it.each(ENDPOINTS)(
    'CT-90: $nome sem credencial responde 401 SESSION_EXPIRED (CA-40)',
    async (endpoint: EndpointDeAnimais) => {
      // Arrange & Act
      const resposta = await chamar(endpoint);

      // Assert — a recusa vem antes de qualquer leitura de corpo: quem não se
      // identificou não descobre nem o formato aceito pela rota.
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
    'CT-89: $nome com sessão de `cliente` responde 403 FORBIDDEN (CA-40)',
    async (endpoint: EndpointDeAnimais) => {
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

  it('CT-89: o `cliente` recebe 403 antes mesmo de o corpo multipart ser lido', async () => {
    // Arrange — `authorizeRole` é montado ANTES do `uploadAnimalImages`, e é isso
    // que impede alguém sem permissão de gastar a banda do servidor com 25 MB.
    const token = await tokenDe(UserRole.CLIENTE);

    // Act
    const resposta = await request(app)
      .post('/api/animals')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Theo')
      .attach('images', jpegBuffer(2048), 'foto.jpg');

    // Assert
    expect(resposta.status).toBe(403);
    expect(armazenamentoDeAnimais.uploadCount).toBe(0);
  });
});

describe('POST /api/animals', () => {
  it('CT-01: cadastra por multipart e responde 201 com a representação pública', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token);

    // Assert
    expect(resposta.status).toBe(201);

    const criado = animal(resposta);

    expect(criado.name).toBe('Theo');
    expect(criado.status).toBe('disponivel');
    expect(criado.city).toEqual({ id: cityId, name: 'Boa Esperanca', stateUf: 'ES' });
    expect(criado.images).toEqual([]);
    // O schema é `strict()`: `nameNormalized` ou qualquer campo interno que
    // vazasse para a resposta faria esta leitura falhar (RN-59).
  });

  it('CT-45: cadastra com duas imagens e devolve as URLs públicas na ordem de envio', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token)
      .attach('images', jpegBuffer(4096), 'primeira.jpg')
      .attach('images', pngBuffer(4096), 'segunda.png');

    // Assert
    expect(resposta.status).toBe(201);

    const criado = animal(resposta);

    expect(criado.images.map((imagem) => imagem.position)).toEqual([0, 1]);
    expect(criado.images[0]?.url).toMatch(
      /^https:\/\/projeto-de-teste\.supabase\.co\/storage\/v1\/object\/public\/animal-images\/animals\//,
    );
    expect(armazenamentoDeAnimais.storedPaths).toHaveLength(2);
  });

  it('CT-13: campo não previsto no corpo responde 400 apontando o campo intruso', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token, camposDoCadastro({ apelido: 'Theozinho' }));

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'apelido', message: 'Campo não permitido nesta requisição.' }],
      },
    });
    expect(armazemDeAnimais.linhas).toEqual([]);
  });

  it('CT-14: `status` no cadastro responde 400 e o animal NÃO é criado', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token, camposDoCadastro({ status: 'adotado' }));

    // Assert — o animal nasce Disponível (RN-14) e não há como escolher outro.
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'status', message: 'Campo não permitido nesta requisição.' },
    ]);
    expect(armazemDeAnimais.linhas).toEqual([]);
  });

  it('CT-10: espécie inexistente responde 404 e nenhuma imagem chega ao armazenamento', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(
      token,
      camposDoCadastro({ speciesId: UUID_INEXISTENTE }),
    ).attach('images', jpegBuffer(2048), 'foto.jpg');

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'SPECIES_NOT_FOUND', message: 'Espécie não encontrada.' },
    });
    expect(armazenamentoDeAnimais.uploadCount).toBe(0);
  });

  it('a rota de cadastro recusa corpo que não seja multipart com 415', async () => {
    // Arrange — o formulário envia arquivos; um JSON aqui é erro de integração e
    // precisa dizer o que fazer, e não estourar no parser.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .post('/api/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Theo' });

    // Assert
    expect(resposta.status).toBe(415);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Envie os dados do animal como multipart/form-data.',
      },
    });
  });
});

describe('CT-91: as restrições de imagem valem fora da interface (RN-33)', () => {
  it('CT-91: seis imagens em chamada direta respondem "É permitido no máximo 5 imagens por animal."', async () => {
    // Arrange — o navegador barra a sexta; quem chama a API direto, não.
    const token = await tokenDe(UserRole.ADMIN);
    const envio = cadastrar(token);

    for (let indice = 0; indice <= MAX_IMAGES_PER_ANIMAL; indice += 1) {
      void envio.attach('images', jpegBuffer(2048), `foto-${String(indice)}.jpg`);
    }

    // Act
    const resposta = await envio;

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'ANIMAL_IMAGE_LIMIT_EXCEEDED',
        message: 'É permitido no máximo 5 imagens por animal.',
      },
    });
    expect(armazenamentoDeAnimais.uploadCount).toBe(0);
  });

  it('CT-91: SVG renomeado para `.jpg` responde 415 e nunca chega ao balde público', async () => {
    // Arrange — declarado como `image/jpeg` e com extensão `.jpg`: só a
    // assinatura binária o distingue.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token).attach(
      'images',
      svgBuffer(),
      { filename: 'foto.jpg', contentType: 'image/jpeg' },
    );

    // Assert
    expect(resposta.status).toBe(415);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'ANIMAL_IMAGE_TYPE_NOT_ALLOWED',
        message: 'Apenas imagens JPEG ou PNG são aceitas.',
      },
    });
    expect(armazenamentoDeAnimais.storedPaths).toEqual([]);
  });

  it('CT-91: arquivo de 6 MB responde 413 "Cada imagem deve ter no máximo 5 MB."', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token).attach(
      'images',
      jpegBuffer(6 * 1024 * 1024),
      'grande.jpg',
    );

    // Assert
    expect(resposta.status).toBe(413);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'ANIMAL_IMAGE_TOO_LARGE',
        message: 'Cada imagem deve ter no máximo 5 MB.',
      },
    });
  });

  it('CT-50: a imagem de exatamente 5 MB é aceita pela chamada direta', async () => {
    // Arrange — o contraponto: o limite não pode estar cortando um byte antes.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await cadastrar(token).attach(
      'images',
      jpegBuffer(MAX_IMAGE_SIZE_BYTES),
      'no-limite.jpg',
    );

    // Assert
    expect(resposta.status).toBe(201);
    expect(animal(resposta).images).toHaveLength(1);
  });
});

describe('GET /api/animals', () => {
  it('CT-29: cadastro vazio responde 200 com lista vazia e total 0', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get('/api/animals')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(paginaDeAnimaisSchema.parse(resposta.body)).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
  });

  it('CT-25: a listagem sai em ordem alfabética e o envelope traz `pagination`', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    for (const name of ['theo', 'Bidu', 'Amora']) {
      await cadastrar(token, camposDoCadastro({ name }));
    }

    // Act
    const resposta = await request(app)
      .get('/api/animals')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    const pagina = paginaDeAnimaisSchema.parse(resposta.body);

    expect(pagina.items.map((registro) => registro.name)).toEqual([
      'Amora',
      'Bidu',
      'theo',
    ]);
    expect(pagina.pagination).toEqual({ page: 1, pageSize: 20, total: 3 });
  });

  it('CT-28: `pageSize` fora da faixa responde 400 com a mensagem do campo', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const zero = await request(app)
      .get('/api/animals?pageSize=0')
      .set('Authorization', `Bearer ${token}`);
    const acima = await request(app)
      .get('/api/animals?pageSize=101')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect([zero.status, acima.status]).toEqual([400, 400]);
    expect(envelopeDeErro(zero).error.details).toEqual([
      {
        field: 'pageSize',
        message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.',
      },
    ]);
  });

  it('CT-26: a paginação percorre todos os registros sem repetir nem omitir', async () => {
    // Arrange — todos com o MESMO nome: os dois primeiros critérios de ordenação
    // empatam e só o desempate por identificador torna a paginação determinística.
    const token = await tokenDe(UserRole.ADMIN);

    for (let indice = 0; indice < 7; indice += 1) {
      await cadastrar(token, camposDoCadastro({ name: 'Theo' }));
    }

    // Act
    const primeira = await request(app)
      .get('/api/animals?page=1&pageSize=3')
      .set('Authorization', `Bearer ${token}`);
    const segunda = await request(app)
      .get('/api/animals?page=2&pageSize=3')
      .set('Authorization', `Bearer ${token}`);
    const terceira = await request(app)
      .get('/api/animals?page=3&pageSize=3')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    const vistos = [primeira, segunda, terceira].flatMap((resposta) =>
      paginaDeAnimaisSchema.parse(resposta.body).items.map((registro) => registro.id),
    );

    expect(vistos).toHaveLength(7);
    expect(new Set(vistos).size).toBe(7);
  });
});

describe('GET /api/animals/:id', () => {
  it('CT-23: devolve o animal com espécie, cidade e estado', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    const resposta = await request(app)
      .get(`/api/animals/${criado.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(200);
    expect(animal(resposta)).toEqual(criado);
  });

  it('CT-64: animal inexistente responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .get(`/api/animals/${UUID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta)).toEqual({
      error: { code: 'ANIMAL_NOT_FOUND', message: 'Animal não encontrado.' },
    });
  });
});

describe('PATCH /api/animals/:id', () => {
  it('CT-63: edita por multipart e responde 200 com o animal atualizado', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Theo Junior')
      .field('speciesId', speciesId)
      .field('cityId', cityId)
      .field('size', 'pequeno')
      .field('sex', 'femea')
      .field('updatedAt', criado.updatedAt)
      .field('keepImageIds', '[]');

    // Assert
    expect(resposta.status).toBe(200);

    const atualizado = animal(resposta);

    expect(atualizado.id).toBe(criado.id);
    expect(atualizado.name).toBe('Theo Junior');
    expect(atualizado.size).toBe('pequeno');
  });

  it('CT-60/CT-61: `keepImageIds` remove a imagem de fora da lista e reordena as que ficam', async () => {
    // Arrange — três imagens, gravadas nas posições 0, 1 e 2 na ordem de envio.
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(
      await cadastrar(token)
        .attach('images', jpegBuffer(2048), 'capa.jpg')
        .attach('images', pngBuffer(2048), 'meio.png')
        .attach('images', jpegBuffer(2048), 'fim.jpg'),
    );

    const [capa, meio, fim] = criado.images;

    expect(criado.images.map((imagem) => imagem.position)).toEqual([0, 1, 2]);

    // Act — mantém DUAS, na ordem invertida: a do meio vira capa e a capa antiga
    // desce para a segunda posição. A terceira fica de fora e deve sumir.
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Theo')
      .field('speciesId', speciesId)
      .field('cityId', cityId)
      .field('size', 'grande')
      .field('sex', 'macho')
      .field('updatedAt', criado.updatedAt)
      .field('keepImageIds', JSON.stringify([meio?.id, capa?.id]));

    // Assert — o estado final segue a ordem de `keepImageIds`, com `position`
    // sequencial a partir de zero (RN-35), e não a ordem em que estavam gravadas.
    // É este caso que exercita `deleteImagesByIds` com lista NÃO vazia e
    // `updateImagePosition` no repositório real — a edição que só troca campos de
    // texto não passa por nenhum dos dois.
    expect(resposta.status).toBe(200);

    const atualizado = animal(resposta);

    expect(atualizado.images.map((imagem) => imagem.id)).toEqual([meio?.id, capa?.id]);
    expect(atualizado.images.map((imagem) => imagem.position)).toEqual([0, 1]);
    expect(atualizado.images.some((imagem) => imagem.id === fim?.id)).toBe(false);
    expect(armazemDeAnimais.linhasDeImagem).toHaveLength(2);
  });

  it('CT-66: a segunda edição com a marca antiga responde 409 ANIMAL_STALE_UPDATE', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    const editar = (nome: string): Test =>
      request(app)
        .patch(`/api/animals/${criado.id}`)
        .set('Authorization', `Bearer ${token}`)
        .field('name', nome)
        .field('speciesId', speciesId)
        .field('cityId', cityId)
        .field('size', 'grande')
        .field('sex', 'macho')
        .field('updatedAt', criado.updatedAt)
        .field('keepImageIds', '[]');

    // Act
    await editar('Theo da Aba 1');
    const segunda = await editar('Theo da Aba 2');

    // Assert
    expect(segunda.status).toBe(409);
    expect(envelopeDeErro(segunda)).toEqual({
      error: {
        code: 'ANIMAL_STALE_UPDATE',
        message:
          'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
      },
    });
  });
});

describe('PATCH /api/animals/:id/status', () => {
  it('CT-69: altera o status e responde 200 com o novo valor', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act — este endpoint recebe JSON, e não multipart: o conjunto de campos é
    // disjunto do restante do animal e não há arquivo envolvido.
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'adotado', updatedAt: criado.updatedAt });

    // Assert
    expect(resposta.status).toBe(200);
    expect(animal(resposta).status).toBe('adotado');
  });

  it('CT-75: campo extra no corpo do status responde 400 e nada é alterado', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'adotado', updatedAt: criado.updatedAt, name: 'Theo Renomeado' });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'name', message: 'Campo não permitido nesta requisição.' },
    ]);
    expect(armazemDeAnimais.linhas[0]?.name).toBe('Theo');
    expect(armazemDeAnimais.linhas[0]?.status).toBe('DISPONIVEL');
  });

  it('CT-72: status fora da lista responde 400 "Selecione uma opção válida."', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'vendido', updatedAt: criado.updatedAt });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'status', message: 'Selecione uma opção válida.' },
    ]);
  });

  it('CT-73: alterar o status de animal já excluído responde 404', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${UUID_INEXISTENTE}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'adotado', updatedAt: '2026-08-25T12:00:00.000Z' });

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta).error.code).toBe('ANIMAL_NOT_FOUND');
  });
});

describe('DELETE /api/animals/:id', () => {
  it('CT-76: exclui o animal e responde 204 sem corpo', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(
      await cadastrar(token).attach('images', jpegBuffer(2048), 'foto.jpg'),
    );

    // Act
    const resposta = await request(app)
      .delete(`/api/animals/${criado.id}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(204);
    expect(resposta.body).toEqual({});
    expect(armazemDeAnimais.linhas).toEqual([]);
    expect(armazenamentoDeAnimais.storedPaths).toEqual([]);
  });

  it('CT-78: excluir animal inexistente responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .delete(`/api/animals/${UUID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(resposta.status).toBe(404);
    expect(envelopeDeErro(resposta).error.code).toBe('ANIMAL_NOT_FOUND');
  });

  it('CT-80: excluir o animal não remove a espécie', async () => {
    // Arrange
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    await request(app)
      .delete(`/api/animals/${criado.id}`)
      .set('Authorization', `Bearer ${token}`);

    const especies = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(z.object({ items: z.array(z.object({ id: z.string() })) }).parse(especies.body)
      .items).toHaveLength(1);
  });
});

describe('CT-92: identificador malformado nos quatro endpoints que recebem `:id`', () => {
  const IDENTIFICADOR_INVALIDO = 'nao-e-uuid';

  /**
   * Cada caso envia um corpo VALIDO, para que o unico problema da requisicao seja
   * o identificador. Nao e detalhe: o `validateRequest` verifica o corpo ANTES dos
   * parametros e lanca no primeiro esquema que falhar, entao um corpo incompleto
   * esconderia o erro do identificador — e o teste passaria medindo outra coisa.
   * Essa ordem tem um caso proprio logo abaixo.
   */
  interface CasoDeIdentificador {
    readonly nome: string;
    readonly enviar: (token: string) => Test;
  }

  const CASOS: ReadonlyArray<CasoDeIdentificador> = [
    {
      nome: 'GET /api/animals/:id',
      enviar: (token) =>
        request(app)
          .get(`/api/animals/${IDENTIFICADOR_INVALIDO}`)
          .set('Authorization', `Bearer ${token}`),
    },
    {
      nome: 'PATCH /api/animals/:id',
      enviar: (token) =>
        request(app)
          .patch(`/api/animals/${IDENTIFICADOR_INVALIDO}`)
          .set('Authorization', `Bearer ${token}`)
          .field('name', 'Theo')
          .field('speciesId', speciesId)
          .field('cityId', cityId)
          .field('size', 'grande')
          .field('sex', 'macho')
          .field('updatedAt', '2026-08-25T12:00:00.000Z')
          .field('keepImageIds', '[]'),
    },
    {
      nome: 'PATCH /api/animals/:id/status',
      enviar: (token) =>
        request(app)
          .patch(`/api/animals/${IDENTIFICADOR_INVALIDO}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'adotado', updatedAt: '2026-08-25T12:00:00.000Z' }),
    },
    {
      nome: 'DELETE /api/animals/:id',
      enviar: (token) =>
        request(app)
          .delete(`/api/animals/${IDENTIFICADOR_INVALIDO}`)
          .set('Authorization', `Bearer ${token}`),
    },
  ];

  it.each(CASOS)(
    'CT-92: $nome com identificador inválido responde 400 apontando o campo `id`',
    async ({ enviar }: CasoDeIdentificador) => {
      // Arrange
      const token = await tokenDe(UserRole.ADMIN);

      // Act
      const resposta = await enviar(token);

      // Assert — 400 e não 404: o que está errado é a forma do identificador, e
      // não a ausência do animal.
      expect(resposta.status).toBe(400);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos informados.',
          details: [{ field: 'id', message: 'Identificador inválido.' }],
        },
      });
    },
  );

  it('CT-92: com o corpo TAMBÉM inválido, quem é reportado é o corpo — o parâmetro fica para a próxima tentativa', async () => {
    // Arrange — comportamento vigente do `validateRequest`, que verifica corpo,
    // consulta e parâmetros NESSA ordem e lança no primeiro que falha. Registrado
    // como caso para que uma inversão futura seja uma decisão, e não um efeito
    // colateral: hoje a interface corrige os campos e só então descobre a URL.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${IDENTIFICADOR_INVALIDO}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'vendido', updatedAt: '2026-08-25T12:00:00.000Z' });

    // Assert
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.details).toEqual([
      { field: 'status', message: 'Selecione uma opção válida.' },
    ]);
  });
});

describe('Envelope de erro e catálogo de códigos (CA-43 / RNF-21)', () => {
  /** Os NOVE códigos declarados pela feature, mais o do corpo não-multipart. */
  const CODIGOS_DA_FEATURE = [
    'ANIMAL_NOT_FOUND',
    'ANIMAL_STALE_UPDATE',
    'ANIMAL_IMAGE_LIMIT_EXCEEDED',
    'ANIMAL_IMAGE_TOO_LARGE',
    'ANIMAL_IMAGE_TYPE_NOT_ALLOWED',
    'REQUEST_BODY_TOO_LARGE',
    'IMAGE_STORAGE_UNAVAILABLE',
    'CITY_NOT_FOUND',
    'STATE_NOT_FOUND',
  ] as const;

  /** Os códigos que já existiam antes desta feature, lidos do próprio código. */
  const CODIGOS_ANTERIORES = [
    'VALIDATION_ERROR',
    'SESSION_EXPIRED',
    'FORBIDDEN',
    'ROUTE_NOT_FOUND',
    'INTERNAL_ERROR',
    'TOO_MANY_REQUESTS',
    'INVALID_CREDENTIALS',
    'ACCOUNT_NOT_CONFIRMED',
    'EMAIL_ALREADY_IN_USE',
    'CONFIRMATION_TOKEN_INVALID',
    'CONFIRMATION_TOKEN_EXPIRED',
    'CONFIRMATION_TOKEN_ALREADY_USED',
    'SPECIES_NOT_FOUND',
    'SPECIES_NAME_ALREADY_EXISTS',
    'SPECIES_IN_USE',
  ] as const;

  it('CA-43: nenhum código novo colide com os que já existiam', () => {
    // Arrange
    const anteriores = new Set<string>(CODIGOS_ANTERIORES);

    // Act
    const colisoes = CODIGOS_DA_FEATURE.filter((codigo) => anteriores.has(codigo));

    // Assert — um código reaproveitado faria o frontend ramificar para a tela
    // errada, porque é por ele que a interface decide o que exibir.
    expect(colisoes).toEqual([]);
    expect(new Set(CODIGOS_DA_FEATURE).size).toBe(CODIGOS_DA_FEATURE.length);
  });

  it('RNF-21: toda resposta de erro da feature sai no envelope `{ error: { code, message } }`', async () => {
    // Arrange — uma resposta de cada família de erro que a feature produz.
    const token = await tokenDe(UserRole.ADMIN);

    // Act
    const respostas = [
      await request(app).get('/api/animals'),
      await request(app)
        .get(`/api/animals/${UUID_INEXISTENTE}`)
        .set('Authorization', `Bearer ${token}`),
      await request(app)
        .post('/api/animals')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Theo' }),
      await cadastrar(token, camposDoCadastro({ name: '' })),
      await cadastrar(token).attach('images', svgBuffer(), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      }),
      await request(app)
        .get('/api/states/XX/cities')
        .set('Authorization', `Bearer ${token}`),
    ];

    // Assert — o `strict()` do schema recusa qualquer chave fora do envelope, e o
    // `parse` recusa qualquer resposta que não o siga.
    for (const resposta of respostas) {
      expect(resposta.status).toBeGreaterThanOrEqual(400);
      expect(() => envelopeDeErro(resposta)).not.toThrow();
    }
  });
});

describe('Regressão declarada pela spec: o leitor de multipart não vazou', () => {
  it('a rota JSON de login continua recusando corpo acima de 10 kB', async () => {
    // Arrange — a feature acrescentou leitura de multipart às rotas de animal. Se
    // ela tivesse sido montada no `app` em vez de nas rotas, o teto de 10 kB do
    // `express.json` deixaria de valer para as demais rotas em silêncio.
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const resposta = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(20000), password: 'Senha123!' }));

    // Assert — o corpo é recusado pelo `express.json`. O status é 500 porque o
    // `entity.too.large` do body-parser não é `AppError` nem `ZodError` e cai no
    // ramo genérico do error handler — defeito PRÉ-EXISTENTE já documentado em
    // `tests/unit/app.spec.ts`, registrado aqui como o comportamento vigente. O
    // que este caso protege é que a requisição continua sendo RECUSADA.
    expect(resposta.status).toBe(500);
    expect(log).toHaveBeenCalled();
  });

  it('a rota JSON de status de animal também não aceita multipart', async () => {
    // Arrange — o inverso: só as duas rotas que recebem arquivo leem multipart.
    const token = await tokenDe(UserRole.ADMIN);
    const criado = animal(await cadastrar(token));

    // Act
    const resposta = await request(app)
      .patch(`/api/animals/${criado.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .field('status', 'adotado')
      .field('updatedAt', criado.updatedAt);

    // Assert — sem `express.json` para o multipart, o corpo chega vazio e a
    // validação recusa por campo obrigatório ausente.
    expect(resposta.status).toBe(400);
    expect(envelopeDeErro(resposta).error.code).toBe('VALIDATION_ERROR');
    expect(armazemDeAnimais.linhas[0]?.status).toBe('DISPONIVEL');
  });
});

describe('createAnimalsController — ramo de produção', () => {
  it('sem dependências, a fábrica monta o grafo de produção sem abrir socket', async () => {
    // Arrange — o ramo DEFAULT da fábrica, que é o usado por `animals.routes.ts`
    // em produção. Ele constrói o cliente do Supabase, que NÃO abre conexão no
    // construtor: a primeira requisição só sairia num `upload`, que este caso não
    // executa.

    // Act
    const controller = createAnimalsController();

    // Assert
    expect(controller).toBeInstanceOf(AnimalsController);
  });
});
