import type { RequestHandler, Response } from 'express';

import type { PaginatedResult, PublicAnimal } from '~/domains/catalog/catalog.types';
import type { ListPublicAnimalsQuery } from '~/domains/catalog/catalog.validators';
import type { AvailableCitiesResult } from '~/domains/catalog/services/list-available-cities.service';
import { ListAvailableCitiesService } from '~/domains/catalog/services/list-available-cities.service';
import type { AvailableSpeciesResult } from '~/domains/catalog/services/list-available-species.service';
import { ListAvailableSpeciesService } from '~/domains/catalog/services/list-available-species.service';
import { ListPublicAnimalsService } from '~/domains/catalog/services/list-public-animals.service';
import { PrismaPublicCatalogRepository } from '~/domains/catalog/repositories/public-catalog.repository';
import { prisma } from '~/infra/prisma/prisma-client';
import { HTTP_STATUS } from '~/shared/http/http-status';

/** A rota nao tem parametro de caminho. `never` torna `req.params.x` inexprimivel. */
type SemParametros = Record<string, never>;

/**
 * O QUARTO GENERICO (a query) fica de FORA, e a query e lida pelo auxiliar
 * abaixo — mesma solucao ja adotada em `animals.controller.ts` e pelo mesmo
 * motivo: o `RequestHandler` do Express declara a query como `ParsedQs`
 * (`Record<string, string | string[] | ...>`), e sob `exactOptionalPropertyTypes`
 * ela nao e atribuivel ao tipo de SAIDA do schema, que tem numeros e uniões
 * fechadas. Fixar o quarto generico faz o proprio `router.get(...)` recusar o
 * handler.
 */
type ManipuladorDeListagem = RequestHandler<SemParametros, PaginatedResult<PublicAnimal>, unknown>;

/**
 * A query JA VALIDADA, JA COAGIDA e JA REATRIBUIDA sobre `req.query` pelo
 * `validateRequest`. A conversao e a fronteira entre o que o Express declara e o
 * que o schema garante — e ela e segura porque a rota NAO EXISTE sem o
 * `validateRequest` na frente (ver `catalog.routes.ts`).
 *
 * Nenhuma validacao acontece aqui, e nenhuma pode: revalidar no controller
 * colocaria a regra em dois lugares, e o dia em que os dois divergissem o
 * comportamento dependeria de qual foi consultado.
 */
function queryJaValidada(query: unknown): ListPublicAnimalsQuery {
  return query as ListPublicAnimalsQuery;
}

/**
 * Os dois endpoints de OPCOES nao tem query nenhuma — nem paginacao, nem busca,
 * nem `stateUf`. Por isso o terceiro e o quarto genericos ficam `unknown`: um
 * schema declarado aqui faria um visitante que enviasse `?x=1` receber `400` em
 * vez de ter o parametro ignorado.
 */
type ManipuladorDeOpcoesDeEspecie = RequestHandler<SemParametros, AvailableSpeciesResult, unknown>;
type ManipuladorDeOpcoesDeCidade = RequestHandler<SemParametros, AvailableCitiesResult, unknown>;

export interface CatalogControllerDependencies {
  readonly listPublicAnimals: ListPublicAnimalsService;
  readonly listAvailableSpecies: ListAvailableSpeciesService;
  readonly listAvailableCities: ListAvailableCitiesService;
}

/**
 * Controlador da vitrine publica.
 *
 * Sem acesso a Prisma e sem regra: le a query JA VALIDADA e reatribuida pelo
 * `validateRequest`, chama o service e responde. Erros vao ao `next()` — o
 * `error-handler.middleware.ts` continua sendo o unico lugar do projeto que monta
 * corpo de erro.
 */
export class CatalogController {
  constructor(private readonly services: CatalogControllerDependencies) {}

  /**
   * Propriedades com arrow function, e nao metodos: `router.get(..., c.listAnimals)`
   * passaria o metodo desacoplado da instancia e `this` chegaria `undefined`.
   */
  readonly listAnimals: ManipuladorDeListagem = async (requisicao, resposta) => {
    const pagina = await this.services.listPublicAnimals.execute(
      queryJaValidada(requisicao.query),
    );

    naoArmazenar(resposta);

    resposta.status(HTTP_STATUS.OK).json(pagina);
  };

  /**
   * `GET /api/catalog/species` — as especies que TEM animal disponivel.
   *
   * Catalogo sem nenhum animal disponivel responde `200 { items: [] }`, e nunca
   * `404`: "nao ha opcao a oferecer" e um estado legitimo da vitrine, nao um
   * recurso ausente.
   */
  readonly listSpecies: ManipuladorDeOpcoesDeEspecie = async (_requisicao, resposta) => {
    const opcoes = await this.services.listAvailableSpecies.execute();

    naoArmazenar(resposta);

    resposta.status(HTTP_STATUS.OK).json(opcoes);
  };

  /**
   * `GET /api/catalog/cities` — as cidades que TEM animal disponivel.
   *
   * O `no-store` importa especialmente aqui: a lista e derivada do estado
   * CORRENTE do catalogo, e uma cidade cujo ultimo animal saiu de disponivel
   * precisa sumir da consulta seguinte (RN-30, CT-52). Uma resposta em cache
   * continuaria oferecendo um filtro que ja nao devolve nada.
   */
  readonly listCities: ManipuladorDeOpcoesDeCidade = async (_requisicao, resposta) => {
    const opcoes = await this.services.listAvailableCities.execute();

    naoArmazenar(resposta);

    resposta.status(HTTP_STATUS.OK).json(opcoes);
  };
}

/**
 * `Cache-Control: no-store` em TODA resposta da vitrine (RN-12, CA-12, CT-110).
 *
 * Nao e cautela genérica: o dado desta tela muda por acao do administrador em
 * outra aba, e um cache — do navegador, de um proxy corporativo ou de uma CDN —
 * exibiria animal JA ADOTADO a um novo interessado. E o pior defeito possivel
 * nesta tela: o visitante se interessa, entra em contato e descobre que o animal
 * ja tem lar, e a loja perde a confianca dele.
 *
 * `no-store` e nao `no-cache`: o segundo PERMITE guardar e apenas exige
 * revalidacao, o que ainda deixa a copia no disco de um quiosque compartilhado.
 */
function naoArmazenar(resposta: Response): void {
  resposta.setHeader('Cache-Control', 'no-store');
}

/**
 * Fabrica de composicao, executada UMA vez no import das rotas. Instanciar
 * repositorio e service dentro do handler recriaria o grafo a cada requisicao.
 */
export function createCatalogController(
  dependencias?: CatalogControllerDependencies,
): CatalogController {
  if (dependencias !== undefined) {
    return new CatalogController(dependencias);
  }

  const catalogo = new PrismaPublicCatalogRepository(prisma);

  /**
   * Os tres services compartilham a MESMA instancia de repositorio: a porta nao
   * guarda estado — so o client do Prisma — e tres instancias seriam tres coisas
   * iguais com nomes diferentes.
   */
  return new CatalogController({
    listPublicAnimals: new ListPublicAnimalsService(catalogo),
    listAvailableSpecies: new ListAvailableSpeciesService(catalogo),
    listAvailableCities: new ListAvailableCitiesService(catalogo),
  });
}
