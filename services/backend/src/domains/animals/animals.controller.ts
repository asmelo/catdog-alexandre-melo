import type { RequestHandler } from 'express';

import type {
  AnimalIdParams,
  ListAnimalsQuery,
} from '~/domains/animals/animals.validators';
import type { AnimalResponse } from '~/domains/animals/mappers/animal.mapper';
import { PrismaAnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { GetAnimalService } from '~/domains/animals/services/get-animal.service';
import {
  ListAnimalsService,
  type ListAnimalsResult,
} from '~/domains/animals/services/list-animals.service';
import { prisma } from '~/infra/prisma/prisma-client';
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
 * Os handlers de escrita entram neste mesmo arquivo nas TASK-BACKEND-007 a 009.
 */

/** `GET /` nao tem parametro de caminho. */
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

  return new AnimalsController({
    listAnimals: new ListAnimalsService(animals),
    getAnimal: new GetAnimalService(animals),
  });
}
