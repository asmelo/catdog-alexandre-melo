import type { RequestHandler } from 'express';

import type { ListCitiesParams } from '~/domains/geography/geography.validators';
import { PrismaStateRepository } from '~/domains/geography/repositories/state.repository';
import {
  ListCitiesByStateService,
  type ListCitiesByStateResult,
} from '~/domains/geography/services/list-cities-by-state.service';
import {
  ListStatesService,
  type ListStatesResult,
} from '~/domains/geography/services/list-states.service';
import { prisma } from '~/infra/prisma/prisma-client';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Camada HTTP do dominio de geografia: le a requisicao, chama UM service e
 * responde. Nenhum acesso a Prisma e nenhuma regra de negocio aqui — os dois
 * handlers sao literalmente uma chamada e um `json`.
 *
 * Sem `try/catch`: o `express-async-errors` (ligado no `app.ts`) encaminha a
 * rejeicao ao `error-handler.middleware.ts`, unico ponto autorizado a montar
 * corpo de resposta de erro. E por isso que o `404 STATE_NOT_FOUND` do
 * `ListCitiesByStateService` nao aparece em lugar nenhum deste arquivo.
 */

/** `GET /` nao tem parametro de caminho. */
type SemParametros = Record<string, never>;

type ManipuladorDeEstados = RequestHandler<SemParametros, ListStatesResult, unknown>;

/**
 * A forma dos parametros vem do `z.infer` do `listCitiesParamsSchema`, e nao de
 * um `{ uf: string }` escrito de novo: a garantia em tempo de execucao e do
 * `validateRequest` montado na rota, que parseia e REATRIBUI `req.params` — e
 * derivar o tipo do mesmo schema e o que mantem as duas pontas presas. Se o
 * schema deixar de normalizar para maiusculas, o tipo acompanha.
 *
 * Os dois handlers declaram o corpo da requisicao como `unknown` porque nenhuma
 * das rotas aceita corpo.
 */
type ManipuladorDeCidades = RequestHandler<
  ListCitiesParams,
  ListCitiesByStateResult,
  unknown
>;

/**
 * Dependencias em um objeto, no mesmo formato de `SpeciesControllerDependencies`.
 * O parametro opcional da fabrica existe para que os testes de rota da
 * TASK-BACKEND-011 injetem services sobre um repositorio em memoria.
 */
export interface GeographyControllerDependencies {
  readonly listStates: ListStatesService;
  readonly listCitiesByState: ListCitiesByStateService;
}

export class GeographyController {
  constructor(private readonly services: GeographyControllerDependencies) {}

  /**
   * Propriedades com arrow function, e nao metodos: `geographyRoutes.get(..., c.listStates)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   *
   * O envelope `{ items }` chega PRONTO do service e e repassado sem
   * reembrulhar: montar `{ items: resultado.items }` aqui colocaria a mesma
   * decisao de formato em duas camadas.
   */
  readonly listStates: ManipuladorDeEstados = async (_requisicao, resposta) => {
    const estados = await this.services.listStates.execute();

    resposta.status(HTTP_STATUS.OK).json(estados);
  };

  /**
   * Le exatamente `params.uf` e chama UM service. A decisao entre `200` e
   * `404 STATE_NOT_FOUND` e inteira do `ListCitiesByStateService` — o controller
   * nao consulta o banco, nao testa se o estado existe e nao monta corpo de
   * erro.
   *
   * A sigla ja chega em maiusculas: quem normalizou foi o
   * `listCitiesParamsSchema` no `validateRequest`, e nao ha `toUpperCase()` aqui
   * que possa divergir dele.
   */
  readonly listCities: ManipuladorDeCidades = async (requisicao, resposta) => {
    const cidades = await this.services.listCitiesByState.execute({
      uf: requisicao.params.uf,
    });

    resposta.status(HTTP_STATUS.OK).json(cidades);
  };
}

/**
 * Fabrica de composicao, executada UMA vez no import das rotas. Instanciar
 * repositorio e services dentro do handler recriaria o grafo a cada requisicao.
 *
 * Os dois services compartilham a MESMA instancia de repositorio: a porta nao
 * guarda estado — so o client do Prisma — e duas instancias seriam duas coisas
 * iguais com nomes diferentes.
 */
export function createGeographyController(
  dependencias?: GeographyControllerDependencies,
): GeographyController {
  if (dependencias !== undefined) {
    return new GeographyController(dependencias);
  }

  const states = new PrismaStateRepository(prisma);

  return new GeographyController({
    listStates: new ListStatesService(states),
    listCitiesByState: new ListCitiesByStateService(states),
  });
}
