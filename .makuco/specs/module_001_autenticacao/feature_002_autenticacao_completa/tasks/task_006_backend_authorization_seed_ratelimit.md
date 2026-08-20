# TASK-BACKEND-006 — Autenticação de rotas, permissionamento por role, rate limit e seed do admin

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-006-backend-authorization-seed-ratelimit`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 6 of 13 — Autorização e Fechamento do Backend
**Generated**: `2026-08-19`

---

## Context

Fecha o backend entregando a verificação de permissão **no servidor** exigida por RN-10: middleware de autenticação, guarda por role (RN-08), `GET /api/auth/me` para o frontend hidratar a sessão, throttling nos endpoints de credencial e o seed do administrador único. É o último slice do backend.

---

## Scope

**In:** Tipagem de `req.authUser`, `authenticate` e `authorizeRole`, limiters nomeados, `prisma/seed.ts`, endpoint `GET /api/auth/me` e aplicação dos limiters nas rotas de credencial.

**Out:** Não criar rotas de negócio (pets, pedidos) — apenas os middlewares que elas usarão depois. Não implementar CRUD nem promoção de usuários, e **não** aceitar `role` em nenhum body (fora do escopo da feature). Não alterar a lógica de login/refresh (TASK-BACKEND-005) nem de registro (TASK-BACKEND-004). Sem testes (TASK-BACKEND-007). Nada de frontend.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/shared/types/express.d.ts` | tipa req.authUser |
| `create` | `src/middlewares/authenticate.middleware.ts` | valida Bearer token |
| `create` | `src/middlewares/authorize-role.middleware.ts` | guarda por role |
| `create` | `src/middlewares/rate-limit.middleware.ts` | limiters nomeados |
| `create` | `prisma/seed.ts` | provisiona admin único |
| `modify` | `src/domains/auth/auth.controller.ts` | handler de /me |
| `modify` | `src/domains/auth/auth.routes.ts` | rota /me e limiters |
| `modify` | `package.json` | rate-limit e script seed |

---

## Implementation

> **Reference pattern**: `src/middlewares/validate-request.middleware.ts` (TASK-BACKEND-002) para o formato de middleware-fábrica; `src/domains/auth/tokens/access-token.service.ts` (TASK-BACKEND-005) para verificação do JWT.

### `src/shared/types/express.d.ts` *(create)*
- `declare global { namespace Express { interface Request { authUser?: AuthUser } } }` com `AuthUser = { id: string; role: 'admin' | 'cliente' }`.
- Precisa de `export {}` no fim para o arquivo ser tratado como módulo, e o `tsconfig` deve incluí-lo. Sem isso, `req.authUser` vira erro de compilação e alguém "resolve" com `any` — o que é proibido.
- Guardar **apenas** id e role: é o que a claim carrega. Qualquer dado a mais viraria cache implícito e desatualizado do usuário.

### `src/middlewares/authenticate.middleware.ts` *(create)*
- Lê `Authorization`, exige o prefixo `Bearer ` (case-sensitive), extrai o token.
- Ausente, malformado, assinatura inválida, expirado, `typ` diferente de `access`, ou `iss`/`aud` divergentes → **todos** lançam `SessionExpiredError` (`401 SESSION_EXPIRED`). Mensagem única e reaproveitada da spec: distinguir os motivos entregaria informação de reconhecimento a um atacante.
- Sucesso: popula `req.authUser = { id: claims.sub, role: claims.role }` e chama `next()`.
- **Não** consultar o banco a cada requisição: o access token vive 15 min e a revogação real acontece na camada de refresh. Ir ao banco aqui anularia o ganho do JWT.

### `src/middlewares/authorize-role.middleware.ts` *(create)*
- Fábrica variádica `authorizeRole(...allowed: Array<'admin' | 'cliente'>)`.
- Sem `req.authUser` (middleware usado fora de ordem) → `SessionExpiredError`. Role fora da lista → `ForbiddenError('Você não tem permissão para acessar este recurso.', 'FORBIDDEN')`.
- Esta é a materialização de RN-10: a decisão do frontend é conveniência de UX; a decisão que vale é esta.

### `src/middlewares/rate-limit.middleware.ts` *(create)*
- `express-rate-limit` v7 com store em memória (instância única; o projeto tem volume baixíssimo por decisão arquitetural). Todos os limiters viram no-op quando `env.RATE_LIMIT_ENABLED === false` — necessário para os testes de integração não caírem em `429`.

| Limiter | Janela / limite | Chave |
|---|---|---|
| `loginLimiter` | 15 min / 5 | IP + e-mail normalizado do body |
| `registerLimiter` | 60 min / 5 | IP |
| `resendLimiter` | 60 min / 3 | IP + e-mail |
| `refreshLimiter` | 1 min / 20 | IP |

- Handler de estouro deve responder no **envelope padrão** (`429 TOO_MANY_REQUESTS`, mensagem "Muitas tentativas. Aguarde alguns minutos e tente novamente."), não no JSON default da lib.
- Justificativa de escopo: RN-05 protege contra enumeração, mas não contra força bruta; endpoint de autenticação sem throttling é achado recorrente de Sonar/OWASP e o critério de aceite da spec exige zero issues de segurança Blocker/Critical.

### `prisma/seed.ts` *(create)*
- Cria (ou atualiza por `upsert` no e-mail) **um** usuário com `role: ADMIN`, `status: ACTIVE` e `emailConfirmedAt: now()` a partir de `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, usando `hashPassword`.
- O admin **não** passa pelo fluxo de confirmação por e-mail — é provisionamento operacional.
- Abortar com mensagem clara se as duas variáveis não estiverem definidas. Nunca embutir senha default no código.
- Isto concilia a restrição "apenas um administrador / login fixo" de `.makuco/architecture/tech_restrictions_context.md` com o modelo de roles da spec: o auto-registro só produz `cliente`, e admin só existe por seed. **Recomenda-se registrar um ADR curto** para essa divergência (a restrição fala em "login fixo"; aqui há usuário real com senha em hash).

### `src/domains/auth/auth.controller.ts` *(modify)*
- Handler `me`: lê `req.authUser.id`, busca pelo `UserRepository`, responde `200` com o DTO do `user.mapper` acrescido de `status`. Se o usuário não existir mais (deletado com token ainda válido) → `SessionExpiredError`.

### `src/domains/auth/auth.routes.ts` *(modify)*
- `GET /me` com `authenticate` (sem `authorizeRole` — ambas as roles podem consultar a si mesmas).
- Aplicar os limiters: `registerLimiter` em `POST /register`, `loginLimiter` em `POST /login`, `resendLimiter` em `POST /confirmation/resend`, `refreshLimiter` em `POST /refresh`. Cada limiter vem **antes** do `validateRequest`, para que a requisição abusiva seja barrada sem custo de parsing.

### `package.json` *(modify)*
- Adicionar `express-rate-limit`; adicionar `"prisma": { "seed": "ts-node -r tsconfig-paths/register prisma/seed.ts" }` e o script `db:seed`.

---

## Acceptance Criteria

- [ ] **Given** access token válido, **When** `GET /api/auth/me`, **Then** `200 { id, name, email, role, status }` com `role` em lowercase e **sem** `passwordHash`.
- [ ] **Given** requisição sem header `Authorization`, **When** rota protegida, **Then** `401 SESSION_EXPIRED`.
- [ ] **Given** token expirado, token com assinatura adulterada, e token válido mas com `typ` diferente de `access`, **When** enviados, **Then** os três respondem `401 SESSION_EXPIRED` com mensagem idêntica.
- [ ] **Given** header `Authorization` sem o prefixo `Bearer`, **When** enviado, **Then** `401 SESSION_EXPIRED` — nunca `500`.
- [ ] **Given** usuário `cliente` autenticado, **When** acessa rota protegida por `authorizeRole('admin')`, **Then** `403 FORBIDDEN` e **nenhum** dado do recurso é retornado no corpo (RN-10).
- [ ] **Given** usuário `admin` autenticado, **When** acessa a mesma rota, **Then** `200`.
- [ ] **Given** `RATE_LIMIT_ENABLED=true` e 6 tentativas de login para o mesmo IP+e-mail em 15 min, **When** a sexta chega, **Then** `429 TOO_MANY_REQUESTS` no envelope padrão de erro.
- [ ] **Given** `RATE_LIMIT_ENABLED=false`, **When** os mesmos limites são excedidos, **Then** nenhuma resposta `429`.
- [ ] **Given** `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` definidos, **When** `npm run db:seed`, **Then** existe exatamente um usuário `role = ADMIN`, `status = ACTIVE`, com `passwordHash` bcrypt (nunca a senha em texto — RNF-01 / CA-13) e login funcional; rodar o seed duas vezes **não** cria duplicata.
- [ ] **Given** as variáveis de seed ausentes, **When** `npm run db:seed`, **Then** falha com mensagem explícita e não cria nada.
- [ ] **Given** um body de registro contendo `"role": "admin"`, **When** enviado, **Then** o usuário criado tem `role = CLIENTE` (ou a requisição é rejeitada pelo `.strict()`) — nunca é possível escalar privilégio pelo cadastro.
- [ ] `npm run typecheck` com 0 erros e `req.authUser` tipado sem `any`.

---

## Authorization

- `admin` → único perfil com acesso às rotas do painel administrativo; provisionado exclusivamente por `prisma/seed.ts`.
- `cliente` → role atribuída automaticamente a todo auto-registro; acesso apenas à área do cliente.
- Visitante (sem token) → apenas registro, confirmação, reenvio e login.
- Ambas as roles → `GET /api/auth/me` sobre o próprio usuário.
- A role **nunca** é aceita por entrada do usuário em nenhum endpoint desta feature.

---

## Dependencies

- **Requires**: TASK-BACKEND-005 (`verifyAccessToken`, `user.mapper`, `SessionExpiredError`), TASK-BACKEND-004 (`UserRepository`, controller/rotas), TASK-BACKEND-002 (`ForbiddenError`, envelope de erro).
- **Blocks**: TASK-BACKEND-007 (testes de autorização), TASK-FRONTEND-010 (`GET /me` é o bootstrap da sessão no cliente).
