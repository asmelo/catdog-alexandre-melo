import { Router } from 'express';

import { createCatalogController } from '~/domains/catalog/catalog.controller';
import { listPublicAnimalsQuerySchema } from '~/domains/catalog/catalog.validators';
import { catalogLimiter } from '~/middlewares/rate-limit.middleware';
import { validateRequest } from '~/middlewares/validate-request.middleware';

/**
 * Rotas da VITRINE PUBLICA, montadas em `/api/catalog`.
 *
 * ============================================================================
 * A AUSENCIA DE `authenticate` E DE `authorizeRole` E DELIBERADA
 * ============================================================================
 *
 * NAO FALTOU NADA. Este e o unico conjunto de rotas do projeto que atende
 * visitante ANONIMO, e e o proposito da feature: o cliente ve os animais
 * disponiveis sem criar conta (RN-01, RN-02, CA-01).
 *
 * Este comentario existe porque todo o resto do backend monta as duas guardas, e
 * quem ler este arquivo depois de ler `animals.routes.ts` vai concluir que houve
 * esquecimento — e "corrigir". Acrescentar `authenticate` aqui nao produziria um
 * erro visivel em desenvolvimento: produziria uma vitrine que responde `401` para
 * todo visitante, isto e, a feature inteira desligada.
 *
 * O que protege o dado NAO e autenticacao, e sim o recorte: a consulta so
 * enxerga `DISPONIVEL` (o status nao e parametro da porta) e a projecao enumera
 * chave a chave o que sai. Um administrador autenticado que chame este endpoint
 * recebe EXATAMENTE o mesmo corpo que um anonimo (RN-03, CA-03).
 *
 * ============================ SOMENTE `GET` ============================
 *
 * Nenhum `POST`, `PATCH` ou `DELETE` neste `Router`, hoje ou depois (RN-08,
 * CA-48). A vitrine e leitura; qualquer escrita pertence a area administrativa,
 * atras das guardas.
 */

const controller = createCatalogController();

export const catalogRoutes: Router = Router();

/**
 * `GET /api/catalog/animals` — a listagem da vitrine.
 *
 * ORDEM DOS MIDDLEWARES: limitador ANTES do validador, pela mesma razao ja
 * registrada em `auth.routes.ts` — a requisicao abusiva e barrada sem pagar o
 * parsing do schema. Aqui o argumento e mais forte do que la: o schema desta rota
 * normaliza texto e coage seis parametros, e um atacante mandando query invalida
 * de proposito nem seria contado se a validacao viesse primeiro.
 *
 * `validateRequest` recebe SO `query`: a rota nao aceita corpo nem parametro de
 * caminho, e declarar um schema de corpo faria um cliente que enviasse `{}`
 * receber `400` em vez de ter o corpo ignorado.
 */
catalogRoutes.get(
  '/animals',
  catalogLimiter,
  validateRequest({ query: listPublicAnimalsQuerySchema }),
  controller.listAnimals,
);

/**
 * `GET /api/catalog/species` e `GET /api/catalog/cities` — as opcoes dos dois
 * campos de selecao da vitrine.
 *
 * SEM `validateRequest` nos dois, ao contrario da listagem: eles nao aceitam
 * parametro nenhum — nem paginacao, nem busca, nem `stateUf`. Declarar um schema
 * vazio faria um visitante que enviasse `?x=1` receber `400` em vez de ter o
 * parametro ignorado, e e a mesma decisao ja registrada em `speciesRoutes.get('/')`
 * e em `geographyRoutes.get('/')`.
 *
 * COM o mesmo `catalogLimiter`: sao publicas como a listagem, e a janela de
 * 60/min por IP e compartilhada entre as tres — o que corresponde ao uso real,
 * ja que a tela carrega as opcoes junto da primeira pagina.
 *
 * SEM `authenticate` e SEM `authorizeRole`, pelo motivo registrado no topo deste
 * arquivo. Sao `GET` e apenas `GET`.
 */
catalogRoutes.get('/species', catalogLimiter, controller.listSpecies);

catalogRoutes.get('/cities', catalogLimiter, controller.listCities);
