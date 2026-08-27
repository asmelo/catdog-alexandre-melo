import type { Request, RequestHandler } from 'express';

import type {
  AnimalIdParams,
  ChangeStatusBody,
  CreateAnimalBody,
  ListAnimalsQuery,
  UpdateAnimalBody,
} from '~/domains/animals/animals.validators';
import type { AnimalResponse } from '~/domains/animals/mappers/animal.mapper';
import { PrismaAnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { ChangeAnimalStatusService } from '~/domains/animals/services/change-animal-status.service';
import { CreateAnimalService } from '~/domains/animals/services/create-animal.service';
import { DeleteAnimalService } from '~/domains/animals/services/delete-animal.service';
import { GetAnimalService } from '~/domains/animals/services/get-animal.service';
import {
  ListAnimalsService,
  type ListAnimalsResult,
} from '~/domains/animals/services/list-animals.service';
import {
  StoreAnimalImagesService,
  type AnimalImageUpload,
} from '~/domains/animals/services/store-animal-images.service';
import { UpdateAnimalService } from '~/domains/animals/services/update-animal.service';
import { PrismaStateRepository } from '~/domains/geography/repositories/state.repository';
import { PrismaSpeciesRepository } from '~/domains/species/repositories/species.repository';
import { prisma } from '~/infra/prisma/prisma-client';
import {
  createSupabaseStorageClient,
  SupabaseImageStorage,
} from '~/infra/storage/supabase-image-storage';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Camada HTTP do dominio de animais: le a requisicao, chama UM service e
 * responde. Nenhum acesso a Prisma e nenhuma regra de negocio aqui — os dois
 * handlers desta fatia sao literalmente uma chamada e um `json`.
 *
 * Sem `try/catch`: o `express-async-errors` (ligado no `app.ts`) encaminha a
 * rejeicao ao `error-handler.middleware.ts`, unico ponto autorizado a montar
 * corpo de resposta de erro. E por isso que o `404 ANIMAL_NOT_FOUND` do
 * `GetAnimalService` nao aparece em lugar nenhum deste arquivo.
 *
 * A TASK-BACKEND-007 acrescentou o handler de CRIACAO, a TASK-BACKEND-008 o de
 * EDICAO e a TASK-BACKEND-009 os de ALTERACAO DE STATUS e de EXCLUSAO.
 */

/** `GET /` e `POST /` nao tem parametro de caminho. */
type SemParametros = Record<string, never>;

/**
 * As formas de `params` e `query` vem do `z.infer` dos schemas, e nao de
 * `{ id: string }` / `{ page: number }` escritos de novo: a garantia em tempo de
 * execucao e do `validateRequest` montado na rota, que parseia e REATRIBUI
 * `req.params` e `req.query` — derivar os tipos dos mesmos schemas e o que
 * mantem as duas pontas presas. Se o padrao de `pageSize` mudar, o tipo
 * acompanha.
 *
 * Os dois handlers declaram o corpo da requisicao como `unknown` porque nenhuma
 * das duas rotas aceita corpo.
 */
type ManipuladorDeLista = RequestHandler<SemParametros, ListAnimalsResult, unknown>;

type ManipuladorDeConsulta = RequestHandler<AnimalIdParams, AnimalResponse, unknown>;

/**
 * O corpo do `POST` chega JA parseado e REATRIBUIDO por `createAnimalBodySchema`
 * dentro do `validateRequest`, entao o handler le `name` como texto normalizado,
 * `birthDate` como `Date | null` e as alternancias como booleanos — nada de
 * `Boolean(req.body.x)` nem `new Date(...)` aqui.
 */
type ManipuladorDeCriacao = RequestHandler<SemParametros, AnimalResponse, CreateAnimalBody>;

/**
 * A edicao le as DUAS pontas: o `id` do CAMINHO e os campos do corpo. O
 * identificador nao esta no corpo e nao pode estar (RN-06) — e por isso que o
 * generico de params e `AnimalIdParams`, o mesmo da consulta, e nao
 * `SemParametros`.
 *
 * `updatedAt` chega como `Date` e `keepImageIds` como lista de texto ja
 * decodificada do JSON: quem converteu foi o `updateAnimalBodySchema` dentro do
 * `validateRequest`, e nao ha `new Date(...)` nem `JSON.parse(...)` aqui.
 */
type ManipuladorDeEdicao = RequestHandler<AnimalIdParams, AnimalResponse, UpdateAnimalBody>;

/**
 * A alteracao de status le o `id` do CAMINHO e os DOIS unicos campos do corpo.
 *
 * O corpo chega de `application/json` — e nao de `multipart/form-data`, como as
 * duas escritas acima —, entao `req.body` foi montado pelo
 * `express.json({ limit: '10kb' })` do `app.ts` e parseado por
 * `changeStatusBodySchema` dentro do `validateRequest`. `updatedAt` ja e uma
 * `Date`; nao ha `new Date(...)` aqui.
 */
type ManipuladorDeStatus = RequestHandler<AnimalIdParams, AnimalResponse, ChangeStatusBody>;

/**
 * `DELETE /:id`: o identificador vem do caminho e o sucesso e `204` SEM CORPO,
 * dai o `void` no lugar do tipo de resposta — mesma forma de
 * `species.controller.ts`. O corpo da requisicao e `unknown` e nao um schema: a
 * rota nao aceita corpo.
 */
type ManipuladorDeExclusao = RequestHandler<AnimalIdParams, void, unknown>;

/**
 * Traduz os arquivos que o `uploadAnimalImages` deixou em `req.files` para a
 * forma que o service consome. E TRADUCAO DE TRANSPORTE, e nao regra: nenhuma
 * validacao de tamanho, de formato ou de quantidade acontece aqui.
 *
 * O NOME DO ARQUIVO E O `mimetype` DECLARADOS SAO DESCARTADOS neste ponto, e e
 * deliberado: os dois sao escritos por quem envia, e nao ha camada adiante que
 * possa usa-los por engano se eles nao atravessarem a fronteira (RN-34, RN-52).
 *
 * `Array.isArray` e a checagem correta e nao um `?? []`: o tipo de `req.files` do
 * `@types/multer` e a uniao entre o array de `.array()` e o mapa por campo de
 * `.fields()`, mais `undefined` quando a requisicao nao trouxe arquivo nenhum —
 * o `[]` cobre os dois casos que nao sao a lista, e "nenhuma imagem" e um
 * cadastro perfeitamente valido (RN-30).
 */
function imagensEnviadas(arquivos: Request['files']): ReadonlyArray<AnimalImageUpload> {
  if (!Array.isArray(arquivos)) {
    return [];
  }

  return arquivos.map((arquivo) => ({
    content: arquivo.buffer,
    sizeBytes: arquivo.size,
  }));
}

/**
 * Le a query JA VALIDADA. NAO valida, nao coage e nao aplica padrao — tudo isso
 * ja aconteceu no `listAnimalsQuerySchema` dentro do `validateRequest`, que
 * parseou e REATRIBUIU `req.query` antes do handler. Repetir qualquer parte
 * disso aqui colocaria regra de validacao no controller.
 *
 * A conversao de tipo e a contraparte exata do `as Request['query']` que o
 * `validate-request.middleware.ts` executa ao reatribuir, e as duas sao as duas
 * metades do mesmo aperto de mao. Ela e inevitavel: o `@types/express` fixa
 * `req.query` como `ParsedQs` (tudo texto), e um handler declarado com outra
 * forma de query NAO PODE ser montado ao lado de `authenticate` e
 * `authorizeRole`, que sao `RequestHandler` com os genericos padrao — a
 * inferencia da rota colapsa em `ParsedQs` e o `router.get` e recusado
 * (verificado: TS2769).
 *
 * O parametro e `unknown` e nao `ParsedQs` de proposito: assim a conversao e uma
 * so, explicita e localizada, em vez do `as unknown as` duplo que a incompatibi-
 * lidade entre `string` e `number` exigiria no ponto de uso.
 */
function paginacaoJaValidada(query: unknown): ListAnimalsQuery {
  return query as ListAnimalsQuery;
}

/**
 * Dependencias em um objeto, no mesmo formato de
 * `GeographyControllerDependencies`. O parametro opcional da fabrica existe para
 * que os testes de rota da TASK-BACKEND-011 injetem services sobre um
 * repositorio em memoria.
 */
export interface AnimalsControllerDependencies {
  readonly listAnimals: ListAnimalsService;
  readonly getAnimal: GetAnimalService;
  readonly createAnimal: CreateAnimalService;
  readonly updateAnimal: UpdateAnimalService;
  readonly changeAnimalStatus: ChangeAnimalStatusService;
  readonly deleteAnimal: DeleteAnimalService;
}

export class AnimalsController {
  constructor(private readonly services: AnimalsControllerDependencies) {}

  /**
   * Propriedades com arrow function, e nao metodos: `animalsRoutes.get(..., c.list)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   *
   * O envelope `{ items, pagination }` chega PRONTO do service e e repassado sem
   * reembrulhar: monta-lo aqui colocaria a mesma decisao de formato em duas
   * camadas.
   *
   * `page` e `pageSize` ja chegam como NUMERO e ja com o padrao aplicado — quem
   * coagiu e aplicou foi o `listAnimalsQuerySchema` no `validateRequest`, e nao
   * ha `Number(...)` nem `?? 20` aqui que possa divergir dele.
   */
  readonly list: ManipuladorDeLista = async (requisicao, resposta) => {
    const { page, pageSize } = paginacaoJaValidada(requisicao.query);

    const pagina = await this.services.listAnimals.execute({ page, pageSize });

    resposta.status(HTTP_STATUS.OK).json(pagina);
  };

  /**
   * Le exatamente `params.id` e chama UM service. A decisao entre `200` e
   * `404 ANIMAL_NOT_FOUND` e inteira do `GetAnimalService` — o controller nao
   * consulta o banco, nao testa se o animal existe e nao monta corpo de erro.
   */
  readonly get: ManipuladorDeConsulta = async (requisicao, resposta) => {
    const animal = await this.services.getAnimal.execute({ id: requisicao.params.id });

    resposta.status(HTTP_STATUS.OK).json(animal);
  };

  /**
   * `201` com a representacao do animal criado (CT-01, CT-02, CA-10, CA-11).
   *
   * UM service e nada mais. Toda a regra — limite de imagens, existencia de
   * especie e de cidade, envio concorrente ao armazenamento, transacao e
   * compensacao — vive no `CreateAnimalService`; aqui ha apenas a leitura do
   * corpo ja validado, a traducao dos arquivos e o status da resposta.
   *
   * Os desfechos de falha (`400`, `404`, `413`, `415`, `503`) nao aparecem em
   * lugar nenhum deste metodo: os services lancam subclasse de `AppError` e o
   * `error-handler.middleware.ts` continua sendo o unico ponto que monta corpo de
   * resposta de erro.
   */
  readonly create: ManipuladorDeCriacao = async (requisicao, resposta) => {
    const corpo = requisicao.body;

    const animal = await this.services.createAnimal.execute({
      name: corpo.name,
      speciesId: corpo.speciesId,
      cityId: corpo.cityId,
      size: corpo.size,
      sex: corpo.sex,
      birthDate: corpo.birthDate,
      description: corpo.description,
      acceptsOtherAnimals: corpo.acceptsOtherAnimals,
      needsLargeSpace: corpo.needsLargeSpace,
      images: imagensEnviadas(requisicao.files),
    });

    resposta.status(HTTP_STATUS.CREATED).json(animal);
  };

  /**
   * `200` com a representacao do animal ATUALIZADO, inclusive o `updatedAt` novo
   * — que e o token que o cliente precisa para a proxima gravacao (RN-47).
   *
   * UM service e nada mais, como no `create`. O bloqueio otimista, a distincao
   * entre `409 ANIMAL_STALE_UPDATE` e `404 ANIMAL_NOT_FOUND`, a reconciliacao das
   * imagens, a transacao e as duas compensacoes vivem inteiros no
   * `UpdateAnimalService`; aqui ha a leitura do `id` do caminho, a leitura do
   * corpo ja validado, a traducao dos arquivos e o status da resposta.
   *
   * `imagensEnviadas` e a MESMA funcao do cadastro: os arquivos chegam pelo mesmo
   * campo `images` e passam pelo mesmo middleware. Na edicao eles sao apenas as
   * imagens NOVAS — as que permanecem viajam como identificadores em
   * `keepImageIds`, e nunca sao reenviadas.
   */
  readonly update: ManipuladorDeEdicao = async (requisicao, resposta) => {
    const corpo = requisicao.body;

    const animal = await this.services.updateAnimal.execute({
      id: requisicao.params.id,
      expectedUpdatedAt: corpo.updatedAt,
      name: corpo.name,
      speciesId: corpo.speciesId,
      cityId: corpo.cityId,
      size: corpo.size,
      sex: corpo.sex,
      birthDate: corpo.birthDate,
      description: corpo.description,
      acceptsOtherAnimals: corpo.acceptsOtherAnimals,
      needsLargeSpace: corpo.needsLargeSpace,
      keepImageIds: corpo.keepImageIds,
      images: imagensEnviadas(requisicao.files),
    });

    resposta.status(HTTP_STATUS.OK).json(animal);
  };

  /**
   * `200` com a representacao do animal, inclusive o `updatedAt` NOVO — que e o
   * token que a listagem precisa para a proxima alteracao daquela linha (RN-47).
   *
   * UM service e nada mais, e aqui isso e a propria RN-16: o handler repassa
   * EXATAMENTE `status` e `expectedUpdatedAt`, e nao ha nenhum outro campo do
   * animal a repassar porque nenhum outro existe no corpo. `changeStatusBodySchema`
   * recusou qualquer chave a mais antes de chegar aqui (CT-69, CT-75, CA-30).
   *
   * A decisao entre `200`, `404 ANIMAL_NOT_FOUND` e `409 ANIMAL_STALE_UPDATE` e
   * inteira do `ChangeAnimalStatusService` — o controller nao consulta o banco,
   * nao compara marca de alteracao e nao monta corpo de erro.
   */
  readonly changeStatus: ManipuladorDeStatus = async (requisicao, resposta) => {
    const corpo = requisicao.body;

    const animal = await this.services.changeAnimalStatus.execute({
      id: requisicao.params.id,
      expectedUpdatedAt: corpo.updatedAt,
      status: corpo.status,
    });

    resposta.status(HTTP_STATUS.OK).json(animal);
  };

  /**
   * `204` SEM CORPO (CT-76, CA-34). `.send()` sem argumento e nao `.json(...)`: o
   * `204` nao carrega representacao, e devolver o animal recem-excluido convidaria
   * a interface a exibir um recurso que ja nao existe.
   *
   * UM service e nada mais. A coleta dos caminhos das imagens antes da exclusao, a
   * cascata das linhas, a remocao dos objetos e a tolerancia a falha dela vivem
   * inteiras no `DeleteAnimalService`; o `404` do animal inexistente sai pelo
   * `error-handler.middleware.ts`, como todo desfecho de erro do projeto.
   */
  readonly remove: ManipuladorDeExclusao = async (requisicao, resposta) => {
    await this.services.deleteAnimal.execute({ id: requisicao.params.id });

    resposta.status(HTTP_STATUS.NO_CONTENT).send();
  };
}

/**
 * Fabrica de composicao, executada UMA vez no import das rotas. Instanciar
 * repositorio e services dentro do handler recriaria o grafo a cada requisicao.
 *
 * Os dois services compartilham a MESMA instancia de repositorio: a porta nao
 * guarda estado — so o client do Prisma — e duas instancias seriam duas coisas
 * iguais com nomes diferentes.
 *
 * O `prisma` e passado DUAS VEZES de proposito: o primeiro parametro e o
 * executor das consultas (tipado como `Prisma.TransactionClient`, o tipo comum
 * ao client e ao `tx`) e o segundo e a capacidade de abrir um LOTE atomico, que
 * so o client completo possui. Ver `ExecutorDeLote` no repositorio.
 */
export function createAnimalsController(
  dependencias?: AnimalsControllerDependencies,
): AnimalsController {
  if (dependencias !== undefined) {
    return new AnimalsController(dependencias);
  }

  const animals = new PrismaAnimalRepository(prisma, prisma);

  /**
   * O adaptador REAL do armazenamento e montado aqui, e o cliente de rede e
   * construido UMA vez no import — nunca por requisicao, o que jogaria fora o
   * `keep-alive` das conexoes justamente num envio de ate 25 MB.
   *
   * Os testes nao passam por este ramo: eles entram pelo parametro `dependencias`
   * com o `FakeImageStorage`, que implementa a mesma porta e nunca toca a rede.
   */
  const storage = new SupabaseImageStorage(createSupabaseStorageClient());

  /**
   * As tres portas de escrita sao construidas UMA vez e compartilhadas pelo
   * cadastro e pela edicao: nenhuma delas guarda estado — so o client do Prisma e
   * o cliente de rede do armazenamento — e duas instancias seriam duas coisas
   * iguais com nomes diferentes. Compartilhar o `StoreAnimalImagesService` e o que
   * mantem o pipeline de validacao e envio literalmente o mesmo nos dois caminhos.
   */
  const especies = new PrismaSpeciesRepository(prisma);
  const geografia = new PrismaStateRepository(prisma);
  const imagens = new StoreAnimalImagesService(storage);

  return new AnimalsController({
    listAnimals: new ListAnimalsService(animals),
    getAnimal: new GetAnimalService(animals),
    createAnimal: new CreateAnimalService(animals, especies, geografia, imagens, prisma),
    updateAnimal: new UpdateAnimalService(animals, especies, geografia, imagens, prisma),

    /**
     * A alteracao de status recebe SO o repositorio: ela nao toca imagem, nao
     * resolve especie nem cidade e nao abre transacao (RN-16). Passar as outras
     * portas aqui daria a este caso de uso acesso a capacidades que ele nao deve
     * ter.
     *
     * A exclusao recebe o repositorio e o MESMO `StoreAnimalImagesService` que o
     * cadastro e a edicao compartilham: e nele que mora `compensar`, o ponto unico
     * onde "remover objetos, engolir a falha e registrar a pendencia" esta escrito
     * (RN-40).
     */
    changeAnimalStatus: new ChangeAnimalStatusService(animals),
    deleteAnimal: new DeleteAnimalService(animals, imagens),
  });
}
