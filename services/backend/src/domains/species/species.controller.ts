import type { RequestHandler } from 'express';

import type { PublicSpecies } from '~/domains/species/mappers/species.mapper';
import { PrismaSpeciesRepository } from '~/domains/species/repositories/species.repository';
import { CreateSpeciesService } from '~/domains/species/services/create-species.service';
import { ListSpeciesService } from '~/domains/species/services/list-species.service';
import { RenameSpeciesService } from '~/domains/species/services/rename-species.service';
import type {
  CreateSpeciesBody,
  RenameSpeciesBody,
  SpeciesIdParams,
} from '~/domains/species/species.validators';
import { prisma } from '~/infra/prisma/prisma-client';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Camada HTTP do dominio de especies: le a requisicao, chama UM service e
 * responde. Nenhum acesso a Prisma e nenhuma regra de negocio aqui.
 *
 * Sem `try/catch`: o `express-async-errors` (ligado no `app.ts`) encaminha a
 * rejeicao ao `error-handler.middleware.ts`, unico ponto autorizado a montar
 * corpo de resposta de erro.
 */

/** As rotas de colecao (`GET /` e `POST /`) nao tem parametro de caminho. */
type SemParametros = Record<string, never>;

/**
 * Parametros das rotas de recurso individual. O `SemParametros` do restante do
 * arquivo (e do dominio auth) nao serve aqui: ele declara que NENHUMA chave
 * existe em `req.params`, e ler `id` dele nao compilaria.
 *
 * A forma vem do `z.infer` do `speciesIdParamSchema`, e nao de um `{ id: string }`
 * escrito de novo: a garantia em tempo de execucao e do `validateRequest`
 * montado na rota, que parseia e REATRIBUI `req.params` — derivar o tipo do
 * mesmo schema e o que mantem as duas pontas presas.
 */
type ParametrosDeEspecie = SpeciesIdParams;

/**
 * Envelope de colecao. Este e o PRIMEIRO endpoint de colecao do projeto, e
 * `{ items: [...] }` passa a ser o padrao para os proximos (Decisao 8 do
 * changelog): um array puro nao admite metadados futuros sem quebrar quem ja
 * consome, e a chave `data` nao existe em nenhum ponto do contrato atual.
 *
 * O envelope e aplicado AQUI e nao no service porque e decisao de formato HTTP —
 * o caso de uso devolve a colecao de especies, nada mais.
 */
interface RespostaDeColecao {
  readonly items: ReadonlyArray<PublicSpecies>;
}

type ManipuladorDeLista = RequestHandler<SemParametros, RespostaDeColecao, unknown>;

/**
 * O tipo do corpo vem do `z.infer` do schema. A garantia em tempo de execucao e
 * do `validateRequest` montado na rota, que parseia e REATRIBUI `req.body` antes
 * do handler — declarar o generico e o que evita ler `req.body` como `any`.
 */
type ManipuladorDeCriacao = RequestHandler<SemParametros, PublicSpecies, CreateSpeciesBody>;

/** `PATCH /:id`: o identificador vem do caminho e o nome novo, do corpo. */
type ManipuladorDeRenomeacao = RequestHandler<
  ParametrosDeEspecie,
  PublicSpecies,
  RenameSpeciesBody
>;

/**
 * Dependencias em um objeto, no mesmo formato de `AuthControllerDependencies`.
 * O parametro opcional da fabrica existe para que os testes de rota da
 * TASK-BACKEND-005 injetem services sobre um repositorio em memoria.
 */
export interface SpeciesControllerDependencies {
  readonly listSpecies: ListSpeciesService;
  readonly createSpecies: CreateSpeciesService;
  readonly renameSpecies: RenameSpeciesService;
}

export class SpeciesController {
  constructor(private readonly services: SpeciesControllerDependencies) {}

  /**
   * Propriedades com arrow function, e nao metodos: `speciesRoutes.get(..., c.list)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   */
  readonly list: ManipuladorDeLista = async (_requisicao, resposta) => {
    const items = await this.services.listSpecies.execute();

    resposta.status(HTTP_STATUS.OK).json({ items });
  };

  /**
   * 201 com o recurso PLANO, sem envelope: e a "Representacao da especie" do
   * contrato da spec. O envelope `{ items }` e do endpoint de colecao, nao do
   * recurso individual.
   */
  readonly create: ManipuladorDeCriacao = async (requisicao, resposta) => {
    const especie = await this.services.createSpecies.execute(requisicao.body);

    resposta.status(HTTP_STATUS.CREATED).json(especie);
  };

  /**
   * HU-04. `200` com o recurso ATUALIZADO e plano, na mesma representacao do
   * `POST` — e o que permite a interface substituir a linha da lista pelo que
   * voltou, sem recarregar a colecao inteira.
   *
   * Le exatamente `params.id` e `body.name` e chama UM service: a decisao entre
   * `200`, `404` e `409` e inteira do `RenameSpeciesService`, e o desfecho de
   * erro sai pelo `error-handler.middleware.ts`.
   */
  readonly rename: ManipuladorDeRenomeacao = async (requisicao, resposta) => {
    const especie = await this.services.renameSpecies.execute({
      id: requisicao.params.id,
      name: requisicao.body.name,
    });

    resposta.status(HTTP_STATUS.OK).json(especie);
  };
}

/**
 * Fabrica de composicao, executada UMA vez no import das rotas. Instanciar
 * repositorio e services dentro do handler recriaria o grafo a cada requisicao.
 */
export function createSpeciesController(
  dependencias?: SpeciesControllerDependencies,
): SpeciesController {
  if (dependencias !== undefined) {
    return new SpeciesController(dependencias);
  }

  const species = new PrismaSpeciesRepository(prisma);

  return new SpeciesController({
    listSpecies: new ListSpeciesService(species),
    createSpecies: new CreateSpeciesService(species),
    renameSpecies: new RenameSpeciesService(species),
  });
}
