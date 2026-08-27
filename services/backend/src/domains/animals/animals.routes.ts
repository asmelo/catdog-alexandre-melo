import { Router } from 'express';

import { createAnimalsController } from '~/domains/animals/animals.controller';
import {
  animalIdParamsSchema,
  listAnimalsQuerySchema,
} from '~/domains/animals/animals.validators';
import { authenticate } from '~/middlewares/authenticate.middleware';
import { authorizeRole } from '~/middlewares/authorize-role.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de animais, montadas em `/api/animals`.
 *
 * NENHUMA e anonima (RN-01, RN-02): so administrador autenticado lista ou
 * consulta animais. A exposicao publica do catalogo e a feature de vitrine,
 * ainda nao especificada — abrir a listagem agora criaria um endpoint publico
 * que nenhuma spec pediu e que so seria notado quando ja estivesse em uso, ainda
 * por cima devolvendo a representacao ADMINISTRATIVA em vez da projecao publica
 * que a RN-59 exige.
 *
 * ORDEM OBRIGATORIA dos middlewares nas duas rotas:
 * `authenticate` -> `authorizeRole('admin')` -> `validateRequest` -> handler.
 *
 * 1. `authorizeRole` DEPOIS de `authenticate` porque ele le `req.authUser`;
 *    montado antes, encontraria a identidade ausente, lancaria
 *    `SessionExpiredError` (401) e a rota nunca autorizaria ninguem — nem o
 *    admin (RN-01, CA-40).
 * 2. `validateRequest` por ultimo: quem nao pode operar o recurso nao paga o
 *    parsing do schema, e um `cliente` recebe 403 mesmo pedindo `pageSize=999`,
 *    sem que a resposta revele a faixa aceita.
 *
 * `authorizeRole('admin')` em MINUSCULAS e nao `'ADMIN'`: `AuthRole` e o tipo
 * publico produzido por `toAuthenticatedUser`, que traduz o enum `UserRole` do
 * banco (`ADMIN`) para o literal do contrato de API (`'admin'`) — o mesmo
 * literal que ja aparece em `species.routes.ts` e em `geography.routes.ts`.
 * `'ADMIN'` NAO COMPILA.
 *
 * SEM LIMITADOR DE TAXA nas duas rotas (Decisao 14 do changelog): os limitadores
 * do projeto protegem endpoints de credencial contra forca bruta e contra uso do
 * servidor como ferramenta de spam. Nenhum dos dois riscos existe aqui — sao
 * duas leituras autenticadas — e limitar castigaria o administrador que percorre
 * as paginas da listagem.
 *
 * As rotas de ESCRITA (`POST /`, `PATCH /:id`, `PATCH /:id/status`,
 * `DELETE /:id`) entram neste mesmo arquivo nas TASK-BACKEND-007 a 009, com o
 * middleware de multipart no meio da cadeia. O arquivo esta preparado para
 * recebe-las; nenhuma e declarada aqui.
 */

const controller = createAnimalsController();

export const animalsRoutes: Router = Router();

/**
 * `GET /api/animals` — listagem paginada (RN-41, RN-42).
 *
 * COM `validateRequest`, ao contrario de `speciesRoutes.get('/')` e
 * `geographyRoutes.get('/')`, que deliberadamente nao validam nada. A diferenca
 * e que aqui a query TEM significado: `page` e `pageSize` precisam ser coagidos
 * de texto para numero e precisam receber os padroes da RN-42, e e o
 * `validateRequest` que reatribui o resultado sobre `req.query` para que o
 * controller leia numeros.
 *
 * `validateRequest` recebe SO `query`: a rota nao aceita corpo nem parametro de
 * caminho, e declarar um schema de corpo aqui faria um cliente que enviasse `{}`
 * receber `400` em vez de ter o corpo ignorado.
 */
animalsRoutes.get(
  '/',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ query: listAnimalsQuerySchema }),
  controller.list,
);

/**
 * `GET /api/animals/:id` — consulta por identificador.
 *
 * O `params` entra no `validateRequest` porque e o `issue.path` que vira o
 * `field` do `details`: e o que faz `"abc"` sair como `400` apontando
 * `field: "id"` (CT-92) em vez de chegar ao repositorio e virar um `WHERE` sobre
 * coluna `uuid` que o Postgres recusa — entrada invalida virando 500.
 */
animalsRoutes.get(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: animalIdParamsSchema }),
  controller.get,
);
