# TASK-BACKEND-001 — Scaffolding do backend e schema Prisma da autenticação

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-001-backend-scaffolding-prisma-schema`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 1 of 13 — Backend Scaffolding + Modelo de Dados
**Generated**: `2026-08-19`

---

## Context

`services/backend/` está vazio — este é o slice inaugural do projeto e cria o esqueleto Express + Prisma e o modelo de dados completo da FEATURE-002 (`User`, `EmailConfirmationToken`, `RefreshToken`). Nenhuma regra de negócio é implementada aqui: o entregável verificável é `npm run dev` subindo, `GET /api/health` respondendo `200` e `prisma migrate dev` criando as três tabelas.

---

## Scope

**In:** Manifests (`package.json`, `tsconfig.json`, `.gitignore`), validação de env com Zod, cliente Prisma singleton, `schema.prisma` com os 3 modelos e 3 enums, montagem do Express (`app.ts`) separada do listen (`index.ts`), router raiz com `/api/health`, e a correção da divergência `adotante` → `cliente` em `MAKUCO.md`.

**Out:** Nenhuma rota de autenticação (TASK-BACKEND-004/005). Nenhuma classe de erro, middleware de erro/validação ou util de hash (TASK-BACKEND-002). Nada de mailer (TASK-BACKEND-003). Nenhum middleware de autenticação/autorização nem `prisma/seed.ts` (TASK-BACKEND-006). Nenhum teste (TASK-BACKEND-007). Não criar nada em `services/frontend/`. Não rodar `prisma migrate deploy` contra Supabase de produção.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Administrador | `UserRole.ADMIN` |
| Cliente | `UserRole.CLIENTE` (mantido em PT-BR — é o literal do contrato da spec e do glossário; **não** traduzir para `CUSTOMER`) |
| Conta pendente de confirmação | `UserStatus.PENDING_CONFIRMATION` |
| Conta ativa | `UserStatus.ACTIVE` |
| Link de confirmação de e-mail | `EmailConfirmationToken` |
| Token de renovação | `RefreshToken` |
| Sessão / família de tokens | `RefreshToken.familyId` |
| Reutilização indevida de token | `RefreshTokenRevokedReason.REUSE_DETECTED` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `package.json` | deps e scripts |
| `create` | `tsconfig.json` | strict + alias `~/` |
| `create` | `.gitignore` | ignora node_modules/dist |
| `create` | `.env.example` | contrato de env vars |
| `create` | `prisma/schema.prisma` | modelo de dados auth |
| `create` | `src/config/env.ts` | env tipada e validada |
| `create` | `src/infra/prisma/prisma-client.ts` | singleton PrismaClient |
| `create` | `src/app.ts` | montagem do Express |
| `create` | `src/index.ts` | bootstrap/listen |
| `create` | `src/routes/index.ts` | router raiz + health |
| `modify` | `../../MAKUCO.md` (raiz do repo) | corrige role `adotante` |

---

## Implementation

> **Reference pattern**: não existe — projeto greenfield. As decisões abaixo são o contrato; nada pode ser inferido de código existente.

### `package.json` *(create)*
- `"name": "catdog-backend"`, `"private": true`, `"type": "commonjs"` — CommonJS deliberado: `ts-jest` e `express-async-errors` são estáveis nele, e ESM exigiria extensões `.js` em todo import.
- Dependências: `express@^4`, `@prisma/client@^5`, `zod@^3`, `cors`, `helmet`, `cookie-parser`, `express-async-errors`.
- Dev: `typescript@^5`, `prisma@^5`, `ts-node-dev`, `@types/*` (node, express, cors, cookie-parser), `tsconfig-paths`.
- **Não** adicionar `bcrypt`, `jsonwebtoken`, `nodemailer`, `express-rate-limit`, `jest` — cada um entra no slice que o usa.
- Scripts: `dev` (`ts-node-dev -r tsconfig-paths/register src/index.ts`), `build` (`tsc && npm run copy:templates`), `copy:templates` (`cp -r src/infra/mail/templates dist/infra/mail/ 2>/dev/null || true` — placeholder; a pasta só existe a partir da TASK-BACKEND-003, e sem esta cópia o e-mail quebra apenas em produção), `start` (`node dist/index.js`), `typecheck` (`tsc --noEmit`), `prisma:generate`, `prisma:migrate` (`prisma migrate dev`).
- `"engines": { "node": ">=20 <21" }`.

### `tsconfig.json` *(create)*
- `"target": "ES2022"`, `"module": "commonjs"`, `"outDir": "dist"`, `"rootDir": "src"`.
- Obrigatórios pela regra "proibido `any`": `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `forceConsistentCasingInFileNames: true`.
- `"baseUrl": "."`, `"paths": { "~/*": ["src/*"] }` — o alias `~/` → `src/` é regra de projeto (`MAKUCO.md`); em runtime depende de `tsconfig-paths/register`, já no script `dev`.

### `.gitignore` *(create)*
- `node_modules/`, `dist/`, `.env`, `coverage/`. **Nunca** ignorar `.env.example`.

### `.env.example` *(create)*
Todas as chaves com valor de exemplo e comentário de uma linha. Chaves consumidas já nesta task: `NODE_ENV`, `PORT=3333`, `DATABASE_URL`, `DIRECT_URL`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`. Declarar também, para o contrato ficar completo desde já (consumidas nos slices seguintes): `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_ISSUER=catdog-api`, `JWT_AUDIENCE=catdog-web`, `REFRESH_TOKEN_TTL_DAYS=7`, `EMAIL_CONFIRMATION_TTL_HOURS=24`, `BCRYPT_COST=12`, `APP_WEB_URL=http://localhost:5173`, `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax`, `COOKIE_DOMAIN=`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_NAME=CatDog`, `MAIL_FROM_ADDRESS`, `RATE_LIMIT_ENABLED=true`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

### `prisma/schema.prisma` *(create)*
- `datasource db` com **`url = env("DATABASE_URL")` e `directUrl = env("DIRECT_URL")`** — o pooler do Supabase (porta 6543, `?pgbouncer=true&connection_limit=1`) não suporta as prepared statements que o `migrate` exige; sem `directUrl` a migration falha.
- Enums: `UserRole { ADMIN CLIENTE }`, `UserStatus { PENDING_CONFIRMATION ACTIVE }`, `RefreshTokenRevokedReason { ROTATED LOGOUT REUSE_DETECTED EXPIRED ACCOUNT_DISABLED }`.
- Convenção física: modelo `PascalCase` + campo `camelCase` no Prisma, mapeados por `@@map`/`@map` para tabela `snake_case` plural e coluna `snake_case`.
- **Todas** as colunas de data usam `@db.Timestamptz(3)` — os TTLs de 24 h e 7 dias não podem depender do timezone do container.

```prisma
model User {
  id               String     @id @default(uuid()) @db.Uuid
  name             String     @db.VarChar(100)
  email            String     @unique @db.VarChar(254)
  passwordHash     String     @map("password_hash") @db.VarChar(72)
  role             UserRole   @default(CLIENTE)
  status           UserStatus @default(PENDING_CONFIRMATION)
  emailConfirmedAt DateTime?  @map("email_confirmed_at") @db.Timestamptz(3)
  createdAt        DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime   @updatedAt      @map("updated_at") @db.Timestamptz(3)
  emailConfirmationTokens EmailConfirmationToken[]
  refreshTokens           RefreshToken[]
  @@index([status])
  @@map("users")
}

model EmailConfirmationToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash") @db.Char(64)
  expiresAt  DateTime  @map("expires_at")  @db.Timestamptz(3)
  consumedAt DateTime? @map("consumed_at") @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, consumedAt])
  @@map("email_confirmation_tokens")
}

model RefreshToken {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @map("user_id")   @db.Uuid
  familyId      String    @map("family_id") @db.Uuid
  tokenHash     String    @unique @map("token_hash") @db.Char(64)
  expiresAt     DateTime  @map("expires_at") @db.Timestamptz(3)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  revokedAt     DateTime? @map("revoked_at") @db.Timestamptz(3)
  revokedReason RefreshTokenRevokedReason? @map("revoked_reason")
  replacedById  String?   @unique @map("replaced_by_id") @db.Uuid
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([familyId, revokedAt])
  @@index([userId])
  @@map("refresh_tokens")
}
```

Decisões de modelagem que o agente **não** deve "otimizar":
- `familyId` é o mecanismo de invalidação de sessão (RN-07): permite `UPDATE ... WHERE family_id = ? AND revoked_at IS NULL` atômico. `replacedById` existe **só** para auditoria da cadeia de rotação — não usar para revogar.
- `tokenHash` é `Char(64)` porque guarda SHA-256 hex, não bcrypt: os tokens têm 256 bits de entropia (não precisam de KDF lento) e o lookup precisa ser por igualdade indexada.
- `status` e `emailConfirmedAt` coexistem de propósito: `status` é a regra consultada por RN-01 e é extensível; `emailConfirmedAt` é o fato auditável exigido pela métrica de conversão da spec.
- `email` é `@unique` global, sem filtro por status (RN-13). A normalização para lowercase é responsabilidade do validator Zod (TASK-BACKEND-004), não do banco.

### `src/config/env.ts` *(create)*
- Schema Zod sobre `process.env`, com `.parse()` executado **no import** — falha de env derruba o boot com mensagem legível em vez de gerar `undefined` em produção.
- Exporta um único objeto `env` congelado (`Object.freeze`) e tipado por `z.infer`. Coerções explícitas: `z.coerce.number()` para `PORT`/`SMTP_PORT`/`BCRYPT_COST`/TTLs numéricos; `z.enum(['true','false']).transform(v => v === 'true')` para os booleanos; `CORS_ALLOWED_ORIGINS` via `.transform(v => v.split(',').map(s => s.trim()))` → `string[]`.
- `JWT_ACCESS_SECRET` com `.min(32)`. Nesta task as chaves ainda não consumidas podem ser `.optional()`; os slices seguintes as tornam obrigatórias.
- **Nenhum outro arquivo pode ler `process.env` diretamente** — é o ponto único de acesso.

### `src/infra/prisma/prisma-client.ts` *(create)*
- Exporta uma instância única de `PrismaClient`. Guardar em `globalThis` sob uma chave nomeada quando `env.NODE_ENV !== 'production'` — sem isso, o hot-reload do `ts-node-dev` abre uma conexão nova a cada salvamento e estoura o limite do Supabase.
- `log` condicional: `['query','error','warn']` em dev, `['error']` em produção.

### `src/app.ts` *(create)*
- Exporta `const app: Express` e **não chama `app.listen`** — a separação é o que permite os testes de integração com `supertest` (TASK-BACKEND-007). Quebrar isso quebra o slice de testes.
- Primeira linha do arquivo: `import 'express-async-errors';` — sem ele, Express 4 não captura rejeição de handler `async` e o erro vira timeout silencioso em vez de resposta 500.
- Ordem obrigatória: `helmet()` → `cors(corsOptions)` → `express.json({ limit: '10kb' })` → `cookieParser()` → `app.use('/api', router)`. Middlewares de `notFound`/`errorHandler` entram na TASK-BACKEND-002 — deixar um comentário `// TODO(TASK-BACKEND-002)` no ponto exato, depois das rotas.
- `app.set('trust proxy', 1)` quando `NODE_ENV === 'production'` — necessário no Render para cookie `Secure` e para o rate limit ler o IP real.
- Opções de CORS inline neste slice (o arquivo `config/cors.ts` é da TASK-BACKEND-002): `{ origin: env.CORS_ALLOWED_ORIGINS, credentials: true }`. `credentials: true` é obrigatório e **incompatível com `origin: '*'`** — nunca usar wildcard.

### `src/index.ts` *(create)*
- Único arquivo com `app.listen(env.PORT)`. Loga a porta e o `NODE_ENV`.
- Registrar handlers de `unhandledRejection` e `uncaughtException` que logam e encerram com código 1.

### `src/routes/index.ts` *(create)*
- `Router` raiz. Nesta task apenas `GET /health` → `200 { status: 'ok', uptime: process.uptime() }`.
- Deixar comentado o ponto de montagem `// router.use('/auth', authRoutes)` para as TASK-BACKEND-004/005.

### `MAKUCO.md` *(modify — raiz do repositório)*
- Substituir as duas ocorrências de `adotante` por `cliente` (seções "What is CatDog?" e "Key Patterns"). A spec v1.1 / ALT-001 é a decisão vigente e o glossário do projeto só define "Cliente"; sem esta correção agentes de código futuros gerarão `UserRole.ADOTANTE`.

---

## Acceptance Criteria

- [ ] **Given** `.env` preenchido a partir de `.env.example`, **When** `npm run dev`, **Then** o servidor sobe e `GET /api/health` responde `200 { status: "ok", uptime: <number> }`.
- [ ] **Given** uma variável obrigatória ausente ou `JWT_ACCESS_SECRET` com menos de 32 caracteres, **When** o processo inicia, **Then** falha no boot com erro do Zod nomeando a variável — o servidor **não** sobe.
- [ ] **Given** `DATABASE_URL` e `DIRECT_URL` válidos, **When** `npx prisma migrate dev`, **Then** são criadas as tabelas `users`, `email_confirmation_tokens`, `refresh_tokens` e os 3 tipos enum.
- [ ] **Given** o schema aplicado, **When** inspecionado no banco, **Then** existem: unique em `users.email`, unique em `email_confirmation_tokens.token_hash`, unique em `refresh_tokens.token_hash`, unique em `refresh_tokens.replaced_by_id`, índice em `refresh_tokens(family_id, revoked_at)`, índice em `users(status)`.
- [ ] **Given** um `User` deletado, **When** a operação ocorre, **Then** seus registros em ambas as tabelas de token são removidos em cascata.
- [ ] **Given** um `User` criado sem informar `role`/`status`, **When** persistido, **Then** `role = CLIENTE` e `status = PENDING_CONFIRMATION`.
- [ ] **Given** dois `User` com o mesmo `email`, **When** o segundo é inserido, **Then** o banco rejeita por violação de unique, independentemente do `status` de ambos.
- [ ] `npm run typecheck` termina com 0 erros e nenhum arquivo contém o tipo `any`.
- [ ] `import { env } from '~/config/env'` resolve tanto em `npm run dev` quanto após `npm run build`.
- [ ] Busca por `process.env` no `src/` retorna ocorrências **apenas** em `src/config/env.ts`.
- [ ] `app.ts` não contém `listen` e `MAKUCO.md` não contém mais a palavra `adotante`.

---

## Dependencies

- **Requires**: nenhuma — é o slice inaugural do backend. Bloqueia-se apenas por infraestrutura externa: projeto Supabase provisionado com `DATABASE_URL`/`DIRECT_URL` disponíveis.
- **Blocks**: TASK-BACKEND-002 (transversais), TASK-BACKEND-003 (mailer), TASK-BACKEND-004 (registro/confirmação), TASK-BACKEND-005 (login/refresh), TASK-BACKEND-006 (autorização/seed), TASK-BACKEND-007 (testes).
