import type { RequestHandler } from 'express';

import type { PublicSpecies } from '~/domains/species/mappers/species.mapper';
import { PrismaSpeciesRepository } from '~/domains/species/repositories/species.repository';
import { CreateSpeciesService } from '~/domains/species/services/create-species.service';
import { ListSpeciesService } from '~/domains/species/services/list-species.service';
import type { CreateSpeciesBody } from '~/domains/species/species.validators';
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

/** Nenhuma rota deste slice tem parametro de caminho. */
type SemParametros = Record<string, never>;

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

/**
 * Dependencias em um objeto, no mesmo formato de `AuthControllerDependencies`.
 * O parametro opcional da fabrica existe para que os testes de rota da
 * TASK-BACKEND-005 injetem services sobre um repositorio em memoria.
 */
export interface SpeciesControllerDependencies {
  readonly listSpecies: ListSpeciesService;
  readonly createSpecies: CreateSpeciesService;
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
  });
}
