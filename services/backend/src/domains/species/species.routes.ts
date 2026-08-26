import { Router } from 'express';

import { createSpeciesController } from '~/domains/species/species.controller';
import {
  createSpeciesSchema,
  renameSpeciesSchema,
  speciesIdParamSchema,
} from '~/domains/species/species.validators';
import { authenticate } from '~/middlewares/authenticate.middleware';
import { authorizeRole } from '~/middlewares/authorize-role.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de especies, montadas em `/api/species`. Primeiras rotas do projeto a
 * usar o `authorizeRole` — o middleware existe e esta testado desde a
 * FEATURE-002, mas nenhuma rota o montava ainda.
 *
 * ORDEM OBRIGATORIA dos middlewares em toda rota deste arquivo:
 * `authenticate` -> `authorizeRole('admin')` -> `validateRequest` -> handler.
 *
 * 1. `authorizeRole` DEPOIS de `authenticate` porque ele le `req.authUser`;
 *    montado antes, encontraria a identidade ausente, lancaria
 *    `SessionExpiredError` (401) e a rota nunca autorizaria ninguem — nem o
 *    admin (RN-01 / CT-30 / CT-31).
 * 2. `validateRequest` por ultimo: quem nao pode operar o recurso nao paga o
 *    parsing do schema, e um `cliente` recebe 403 mesmo enviando corpo
 *    invalido, sem que a resposta revele o formato aceito.
 *
 * SEM LIMITADOR DE TAXA em nenhuma rota (Decisao 7 do changelog): os limitadores
 * do projeto protegem endpoints de credencial contra forca bruta e contra uso do
 * servidor como ferramenta de spam. Nenhum dos dois riscos existe aqui — e um
 * CRUD administrativo autenticado, de baixo volume e sem envio de e-mail — e
 * limitar castigaria o administrador que cadastra varias especies em sequencia.
 */

const controller = createSpeciesController();

export const speciesRoutes: Router = Router();

/**
 * HU-03. Sem `validateRequest`: a rota nao aceita corpo, parametro de caminho
 * nem query (RN-12). Declarar um schema vazio faria um cliente que enviasse
 * `?page=1` receber 400 em vez de simplesmente ter o parametro ignorado.
 */
speciesRoutes.get('/', authenticate, authorizeRole('admin'), controller.list);

/** HU-02. */
speciesRoutes.post(
  '/',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ body: createSpeciesSchema }),
  controller.create,
);

/**
 * HU-04. `PATCH` e nao `PUT` (Decisao 3 do changelog): o nome e o unico atributo
 * mutavel do recurso, o que caracteriza alteracao parcial, e o `src/config/cors.ts`
 * em vigor nao libera `PUT` — adota-lo exigiria reabrir uma decisao transversal
 * fora do escopo desta feature. Nenhuma rota `PUT` e declarada aqui.
 *
 * O `params` entra no `validateRequest` junto com o `body`: e o que faz um
 * identificador malformado sair como `400` apontando `field: "id"` em vez de
 * chegar ao repositorio (CT-34).
 */
speciesRoutes.patch(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: speciesIdParamSchema, body: renameSpeciesSchema }),
  controller.rename,
);

/**
 * HU-05 / HU-06. Responde `204` sem corpo no sucesso e `409 SPECIES_IN_USE`
 * quando a especie tem animais vinculados (RN-08) — a guarda vive no servidor e
 * vale identicamente para chamadas feitas fora da interface (CT-32 / CA-15).
 *
 * `validateRequest` recebe SO `params`: a rota nao aceita corpo, e declarar um
 * schema de corpo aqui faria um cliente que enviasse `{}` receber `400` em vez
 * de simplesmente ter o corpo ignorado. O `speciesIdParamSchema` e o mesmo do
 * `PATCH`, e nao uma segunda declaracao: e ele que faz um identificador
 * malformado sair como `400` apontando `field: "id"` (CT-34).
 */
speciesRoutes.delete(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: speciesIdParamSchema }),
  controller.remove,
);
