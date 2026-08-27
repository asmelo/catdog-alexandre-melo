import { Router } from 'express';

import { createGeographyController } from '~/domains/geography/geography.controller';
import { listCitiesParamsSchema } from '~/domains/geography/geography.validators';
import { authenticate } from '~/middlewares/authenticate.middleware';
import { authorizeRole } from '~/middlewares/authorize-role.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas de geografia, montadas em `/api/states`.
 *
 * NENHUMA das duas e anonima (RN-02). Sao dado de apoio, nao dado publico: a
 * vitrine, onde o cliente enxerga animais sem autenticacao, e feature seguinte
 * deste modulo e nao foi especificada. Abrir a lista de municipios agora
 * "porque e dado do IBGE" criaria um endpoint publico que nenhuma spec pediu e
 * que so seria notado quando ja estivesse em uso.
 *
 * ORDEM OBRIGATORIA dos middlewares nas duas rotas:
 * `authenticate` -> `authorizeRole('admin')` -> `validateRequest` -> handler.
 *
 * 1. `authorizeRole` DEPOIS de `authenticate` porque ele le `req.authUser`;
 *    montado antes, encontraria a identidade ausente, lancaria
 *    `SessionExpiredError` (401) e a rota nunca autorizaria ninguem — nem o
 *    admin (RN-01).
 * 2. `validateRequest` por ultimo: quem nao pode operar o recurso nao paga o
 *    parsing do schema, e um `cliente` recebe 403 mesmo mandando uma sigla
 *    invalida, sem que a resposta revele o formato aceito.
 *
 * `authorizeRole('admin')` em minusculas e nao `'ADMIN'`: `AuthRole` e o tipo
 * publico produzido por `toAuthenticatedUser`, que traduz o enum `UserRole` do
 * banco (`ADMIN`) para o literal do contrato de API (`'admin'`) — o mesmo
 * literal que ja aparece em `species.routes.ts`. `'ADMIN'` nao compila.
 *
 * SEM LIMITADOR DE TAXA nas duas rotas (Decisao 14 do changelog): os limitadores
 * do projeto protegem endpoints de credencial contra forca bruta e contra uso do
 * servidor como ferramenta de spam. Nenhum dos dois riscos existe aqui — sao
 * duas leituras autenticadas de tabela de apoio — e limitar castigaria o
 * administrador que troca de estado varias vezes no formulario.
 */

const controller = createGeographyController();

export const geographyRoutes: Router = Router();

/**
 * `GET /api/states` — as 27 unidades federativas.
 *
 * Sem `validateRequest`: a rota nao aceita corpo, parametro de caminho nem
 * query. Declarar um schema vazio faria um cliente que enviasse `?page=1`
 * receber 400 em vez de simplesmente ter o parametro ignorado — mesma decisao ja
 * registrada em `speciesRoutes.get('/')`.
 */
geographyRoutes.get('/', authenticate, authorizeRole('admin'), controller.listStates);

/**
 * `GET /api/states/:uf/cities` — os municipios daquela unidade federativa.
 *
 * O `params` entra no `validateRequest` porque e o `issue.path` que vira o
 * `field` do `details`: e o que faz `"PARANA"` sair como `400` apontando
 * `field: "uf"` em vez de chegar ao repositorio e virar uma consulta que nunca
 * casa. E tambem o unico ponto que normaliza a sigla para maiusculas, o que faz
 * `pr` responder exatamente como `PR`.
 *
 * `validateRequest` recebe SO `params`: a rota nao aceita corpo, e declarar um
 * schema de corpo aqui faria um cliente que enviasse `{}` receber `400` em vez
 * de ter o corpo ignorado.
 */
geographyRoutes.get(
  '/:uf/cities',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: listCitiesParamsSchema }),
  controller.listCities,
);
