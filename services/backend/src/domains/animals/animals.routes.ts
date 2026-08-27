import { Router } from 'express';

import { createAnimalsController } from '~/domains/animals/animals.controller';
import {
  animalIdParamsSchema,
  createAnimalBodySchema,
  listAnimalsQuerySchema,
} from '~/domains/animals/animals.validators';
import { authenticate } from '~/middlewares/authenticate.middleware';
import { authorizeRole } from '~/middlewares/authorize-role.middleware';
import { uploadAnimalImages } from '~/middlewares/upload-animal-images.middleware';
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
 * A TASK-BACKEND-007 declarou o `POST /`, primeira rota de ESCRITA e primeira do
 * projeto inteiro a montar o leitor de multipart; `PATCH /:id`,
 * `PATCH /:id/status` e `DELETE /:id` entram neste mesmo arquivo nas
 * TASK-BACKEND-008 e 009.
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

/**
 * `POST /api/animals` — cadastro com ate cinco imagens (RN-30, RN-39, RN-46).
 *
 * A ORDEM DOS CINCO MIDDLEWARES E OBRIGATORIA, e cada posicao resolve um defeito
 * concreto:
 *
 * 1. `authenticate` — identifica quem esta chamando.
 * 2. `authorizeRole('admin')` — DEPOIS dele, porque le `req.authUser`; montado
 *    antes, encontraria a identidade ausente e lancaria 401 para todo mundo,
 *    inclusive o admin.
 * 3. `uploadAnimalImages` — DEPOIS da autorizacao, e este e o ponto do CA-40: um
 *    `cliente` recebe `403` sem que o servidor leia os 25 MB do corpo. Montado
 *    antes, a aplicacao pagaria a leitura inteira de um envio que ela ja sabia
 *    que ia recusar, e um usuario sem permissao teria como consumir banda e
 *    memoria do processo a vontade.
 * 4. `validateRequest` — DEPOIS do multipart, e esta e a inversao que quebraria
 *    todo cadastro valido: e o leitor de multipart que POPULA `req.body` com os
 *    campos de texto do formulario. Validado antes, o schema leria um corpo vazio
 *    e responderia "Este campo é obrigatório." para os cinco campos obrigatorios
 *    de uma requisicao perfeita.
 * 5. `controller.create`.
 *
 * `authorizeRole('admin')` em MINUSCULAS, como nas duas rotas de leitura acima:
 * `'ADMIN'` e o literal do enum `UserRole` do BANCO, e o tipo `AuthRole` do
 * contrato de API nao o admite — `'ADMIN'` NAO COMPILA.
 *
 * `validateRequest` recebe SO `body`: a rota nao tem parametro de caminho, e
 * declarar um schema de query faria um cadastro com `?origem=tela` receber `400`.
 *
 * SEM LIMITADOR DE TAXA (Decisao 14 do changelog): os limitadores do projeto
 * protegem endpoints de credencial, e o consumo desta rota ja esta contido pelos
 * limites de quantidade, de tamanho por arquivo e de tamanho total do corpo, que
 * o middleware de multipart aplica antes de qualquer regra de negocio.
 */
animalsRoutes.post(
  '/',
  authenticate,
  authorizeRole('admin'),
  uploadAnimalImages,
  validateRequest({ body: createAnimalBodySchema }),
  controller.create,
);
