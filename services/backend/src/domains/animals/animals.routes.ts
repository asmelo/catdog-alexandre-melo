import { Router } from 'express';

import { createAnimalsController } from '~/domains/animals/animals.controller';
import {
  animalIdParamsSchema,
  changeStatusBodySchema,
  createAnimalBodySchema,
  listAnimalsQuerySchema,
  updateAnimalBodySchema,
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
 * projeto inteiro a montar o leitor de multipart; a TASK-BACKEND-008 declarou o
 * `PATCH /:id`; a TASK-BACKEND-009 declarou o `PATCH /:id/status` e o
 * `DELETE /:id`, as duas UNICAS rotas de escrita da feature que NAO montam o
 * leitor de multipart.
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

/**
 * `PATCH /api/animals/:id/status` — alteracao do status do animal (RN-15, RN-16,
 * RN-46, RN-47).
 *
 * DECLARADA ANTES do `PATCH /:id` porque o caminho e mais especifico. A ordem NAO
 * e load-bearing neste roteador — verificado: `/:id` casa UM segmento e nao
 * alcanca `/abc/status`, entao invertida a declaracao o resultado e o mesmo —, mas
 * ela e a ordem correta a manter: bastaria alguem trocar `/:id` por `/:id*` ou por
 * uma expressao regular mais larga para que a rota generica passasse a engolir a
 * especifica, e o defeito apareceria como "alterar status esta editando o animal".
 *
 * QUATRO MIDDLEWARES, E NAO CINCO: `uploadAnimalImages` NAO E MONTADO AQUI, e
 * esta e a diferenca em relacao ao `POST /` e ao `PATCH /:id`. O corpo desta rota
 * e `application/json` (contrato da spec), e este e o unico endpoint de ESCRITA da
 * feature que continua sob o `express.json({ limit: '10kb' })` ja montado no
 * `app.ts`. Montar o leitor de multipart aqui faria toda alteracao de status
 * legitima ser recusada com `415` antes de o schema ver o corpo — o middleware
 * recusa `Content-Type` que nao seja `multipart/form-data`.
 *
 * A ordem dos quatro e a mesma das demais rotas, e pelas mesmas razoes:
 *
 * 1. `authenticate` — identifica quem esta chamando.
 * 2. `authorizeRole('admin')` — DEPOIS dele, porque le `req.authUser`; montado
 *    antes, lancaria 401 para todo mundo, inclusive o admin (CA-40).
 * 3. `validateRequest` — por ultimo antes do handler: quem nao pode operar o
 *    recurso nao paga o parsing do schema.
 * 4. `controller.changeStatus`.
 *
 * `authorizeRole('admin')` em MINUSCULAS. O texto da TASK-BACKEND-009 pedia
 * `'ADMIN'` ate a emenda 2 da rodada de revisao 1: `'ADMIN'` e o literal do enum
 * `UserRole` do BANCO e NAO COMPILA aqui, porque o tipo `AuthRole` do contrato de
 * API nao o admite (verificado: TS2345). Mesma observacao ja registrada nas rotas
 * acima.
 *
 * `validateRequest` recebe `params` E `body`: o `id` do caminho precisa ser
 * conferido como UUID para que `"abc"` responda `400` apontando `field: "id"`
 * (CT-92) em vez de virar um `WHERE` sobre coluna `uuid` que o Postgres recusa.
 *
 * SEM LIMITADOR DE TAXA, como nas demais (Decisao 14 do changelog).
 */
animalsRoutes.patch(
  '/:id/status',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: animalIdParamsSchema, body: changeStatusBodySchema }),
  controller.changeStatus,
);

/**
 * `PATCH /api/animals/:id` — edicao com bloqueio otimista e reconciliacao de
 * imagens (RN-35, RN-36, RN-46, RN-47, RN-50).
 *
 * `PATCH` e nao `PUT`, e a escolha nao e estilistica: a configuracao de CORS em
 * vigor nao libera o verbo `PUT` (Decisao 2 do changelog). Pelo mesmo motivo o
 * token de concorrencia viaja no CORPO e nao em `If-Match` — o CORS libera apenas
 * os cabecalhos `Content-Type` e `Authorization`, e usar um cabecalho proprio
 * exigiria alterar configuracao transversal fora do escopo desta feature.
 *
 * A MESMA ORDEM OBRIGATORIA do `POST`, com `params` a mais no `validateRequest`:
 *
 * 1. `authenticate` — identifica quem esta chamando.
 * 2. `authorizeRole('admin')` — DEPOIS dele, porque le `req.authUser`.
 * 3. `uploadAnimalImages` — DEPOIS da autorizacao (CA-40): um `cliente` recebe
 *    `403` sem que o servidor leia os 25 MB do corpo.
 * 4. `validateRequest` — DEPOIS do multipart, que e quem POPULA `req.body` com os
 *    campos de texto do formulario. Invertida, a ordem faria toda edicao valida
 *    responder "Este campo é obrigatório." para os campos obrigatorios.
 * 5. `controller.update`.
 *
 * `validateRequest` recebe `params` E `body`, ao contrario do `POST`: o `id` do
 * caminho precisa ser conferido como UUID para que `"abc"` responda `400`
 * apontando `field: "id"` em vez de chegar ao repositorio e virar um `WHERE`
 * sobre coluna `uuid` que o Postgres recusa — entrada invalida virando 500. E o
 * mesmo motivo pelo qual o `GET /:id` o declara.
 *
 * `authorizeRole('admin')` em MINUSCULAS, como em todas as rotas acima: `'ADMIN'`
 * e o literal do enum `UserRole` do BANCO, e o tipo `AuthRole` do contrato de API
 * nao o admite — `'ADMIN'` NAO COMPILA (verificado: TS2345).
 *
 * SEM LIMITADOR DE TAXA, pela mesma razao do `POST` (Decisao 14 do changelog).
 */
animalsRoutes.patch(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  uploadAnimalImages,
  validateRequest({ params: animalIdParamsSchema, body: updateAnimalBodySchema }),
  controller.update,
);

/**
 * `DELETE /api/animals/:id` — exclusao definitiva do animal (RN-37, RN-44,
 * RN-45, RN-55).
 *
 * TRES MIDDLEWARES, o menor conjunto de todas as rotas de escrita da feature.
 * `uploadAnimalImages` nao entra pelo motivo mais simples possivel — a rota nao
 * aceita corpo — e `express.json` sequer chega a parsear nada.
 *
 * `validateRequest` recebe SO `params`: declarar um schema de corpo faria um
 * cliente que enviasse `{}` receber `400` em vez de ter o corpo ignorado. Mesma
 * decisao ja registrada em `speciesRoutes.delete('/:id')`. O
 * `animalIdParamsSchema` e o MESMO das rotas acima, e nao uma segunda declaracao:
 * e ele que faz um identificador malformado sair como `400` apontando
 * `field: "id"` (CT-92) em vez de chegar ao repositorio.
 *
 * SEM token de bloqueio otimista, ao contrario das duas rotas de `PATCH`: o
 * contrato do `DELETE` nao tem corpo, e a decisao "este animal nao deve mais
 * existir" nao fica errada porque outro campo mudou nesse meio-tempo. Ver
 * `delete-animal.service.ts`.
 *
 * `authorizeRole('admin')` em MINUSCULAS — o texto da task pedia `'ADMIN'` ate a
 * emenda 2 da rodada de revisao 1, e `'ADMIN'` NAO COMPILA (verificado: TS2345).
 *
 * SEM LIMITADOR DE TAXA (Decisao 14 do changelog).
 */
animalsRoutes.delete(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validateRequest({ params: animalIdParamsSchema }),
  controller.remove,
);
