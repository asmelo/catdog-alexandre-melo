# TASK-BACKEND-002 — Transversais: erros, envelope HTTP, validação e utilitários

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-cross-cutting-errors-utils`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 2 of 13 — Transversais do Backend
**Generated**: `2026-08-19`

---

## Context

Cria a base transversal que todos os slices de domínio consomem: hierarquia de erros, o **único** ponto que serializa o envelope de erro HTTP, middleware de validação Zod e os utilitários de hash de senha, geração de token e relógio. Nenhuma regra de negócio da FEATURE-002 é implementada aqui — este slice só entrega as ferramentas.

---

## Scope

**In:** `AppError` + subclasses HTTP, constantes de status, `error-handler` e `not-found` middlewares, `validate-request` middleware, `password-hasher`, `secure-token`, `clock`, `config/cors.ts`, e a ligação desses middlewares no `app.ts`.

**Out:** Nenhum erro de domínio nomeado (`EmailAlreadyInUseError` etc. pertencem à TASK-BACKEND-004/005). Nenhum schema Zod de rota — só o middleware genérico. Não tocar em `prisma/schema.prisma` nem em `config/env.ts`. Nada de mailer, JWT, rate limit ou autenticação. Sem testes (TASK-BACKEND-007).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/shared/http/http-status.ts` | constantes de status |
| `create` | `src/shared/errors/app-error.ts` | classe base de erro |
| `create` | `src/shared/errors/http-errors.ts` | subclasses por semântica HTTP |
| `create` | `src/middlewares/error-handler.middleware.ts` | serializa envelope de erro |
| `create` | `src/middlewares/not-found.middleware.ts` | rota inexistente |
| `create` | `src/middlewares/validate-request.middleware.ts` | validação Zod genérica |
| `create` | `src/utils/password-hasher.ts` | encapsula bcrypt |
| `create` | `src/utils/secure-token.ts` | gera e hasheia tokens |
| `create` | `src/utils/clock.ts` | tempo injetável |
| `create` | `src/config/cors.ts` | opções de CORS |
| `modify` | `src/app.ts` | liga middlewares e cors |
| `modify` | `package.json` | adiciona bcrypt |

---

## Implementation

> **Reference pattern**: `src/config/env.ts` e `src/app.ts` (TASK-BACKEND-001) — mesmo estilo de módulo: export nomeado, sem classe utilitária estática, sem default export.

### `src/shared/http/http-status.ts` *(create)*
- Objeto `as const` com apenas os status usados no projeto: `OK 200`, `CREATED 201`, `ACCEPTED 202`, `NO_CONTENT 204`, `BAD_REQUEST 400`, `UNAUTHORIZED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `CONFLICT 409`, `GONE 410`, `TOO_MANY_REQUESTS 429`, `INTERNAL_SERVER_ERROR 500`.
- Existe para eliminar números mágicos — nenhum outro arquivo pode escrever `res.status(409)` literal.

### `src/shared/errors/app-error.ts` *(create)*
- `export abstract class AppError extends Error` com propriedades **readonly**: `statusCode: number`, `code: string`, `details?: ReadonlyArray<{ field: string; message: string }>`.
- `isOperational = true` — distingue erro previsto de bug. O handler usa isso para decidir entre responder a mensagem real e responder a genérica.
- Construtor deve chamar `Object.setPrototypeOf(this, new.target.prototype)` — sem isso `instanceof` falha para subclasses quando o target é ES5/ES2022 com `extends Error`.
- `code` é `SCREAMING_SNAKE_CASE` e é o **discriminador estável** consumido pelo frontend; `message` é PT-BR pronto para exibição.

### `src/shared/errors/http-errors.ts` *(create)*
- Cinco subclasses finas, uma por semântica HTTP: `ValidationError` (400, único que popula `details`), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `GoneError` (410).
- Agrupadas em **um** arquivo de propósito: são declarações de 3–5 linhas sem lógica; seis arquivos separados seriam ruído. Os erros **de domínio** (que carregam regra) ganham arquivo próprio nos slices seguintes.
- Cada subclasse recebe `(message: string, code: string, details?)` e fixa apenas o `statusCode` — o `code` vem de quem lança, porque um mesmo status serve a várias regras.

### `src/middlewares/error-handler.middleware.ts` *(create)*
- Assinatura de 4 argumentos `(err, req, res, next)` — Express só reconhece error handler pela aridade; remover o `next` não usado quebra o middleware.
- Envelope **único** para 100% dos erros:
```jsonc
{ "error": { "code": "EMAIL_ALREADY_IN_USE", "message": "Este e-mail já está em uso.", "details": [ { "field": "password", "message": "..." } ] } }
```
`details` só aparece em `VALIDATION_ERROR`.
- Ramos, nesta ordem: (1) `err instanceof ZodError` → converte para `ValidationError`; (2) `err instanceof AppError` → responde `err.statusCode` com `err.code`/`err.message`; (3) qualquer outro → **loga o erro completo com stack** e responde `500 { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro inesperado. Tente novamente.' }`. Nunca vazar `err.message` ou stack de erro não tratado para o cliente.
- É o **único** arquivo do projeto autorizado a montar resposta de erro.

### `src/middlewares/not-found.middleware.ts` *(create)*
- Lança `NotFoundError('Recurso não encontrado.', 'ROUTE_NOT_FOUND')` para cair no handler acima — assim rota inexistente também responde no envelope padrão, e não no HTML default do Express.

### `src/middlewares/validate-request.middleware.ts` *(create)*
- Fábrica `validateRequest(schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema })` retornando um `RequestHandler`.
- **Reatribui** o valor parseado (`req.body = result.data`) — é isso que faz as transformações do schema (ex.: `email` em lowercase) valerem no controller. Validar sem reatribuir é o erro clássico aqui.
- Ao falhar, mapeia `ZodError.issues` para `details: [{ field: issue.path.join('.'), message: issue.message }]` e lança `ValidationError(...)` com `code: 'VALIDATION_ERROR'` e mensagem `'Verifique os campos informados.'` — as mensagens por campo vêm dos schemas, não daqui.

### `src/utils/password-hasher.ts` *(create)*
- Exporta `hashPassword(plain: string): Promise<string>` e `verifyPassword(plain: string, hash: string): Promise<boolean>`.
- **Único arquivo do projeto autorizado a importar `bcrypt`** — a troca por `bcryptjs` (caso o build nativo falhe no Docker Alpine do Render) deve custar a edição de um arquivo.
- Custo vem de `env.BCRYPT_COST` (12) — ~250-350 ms no Node 20, folgado dentro do RNF-04 (login percebido em menos de 3 s). Não elevar o custo sem medir esse orçamento. Exportar também `DUMMY_PASSWORD_HASH`: um hash bcrypt fixo, gerado uma vez e embutido como constante, usado no login contra usuário inexistente para igualar o tempo de resposta (RN-05/RNF-03 só se sustentam se o canal de timing também for fechado).

### `src/utils/secure-token.ts` *(create)*
- `generateOpaqueToken(): string` → `crypto.randomBytes(32).toString('base64url')` (256 bits). `Math.random` é proibido aqui.
- `hashToken(raw: string): string` → `crypto.createHash('sha256').update(raw).digest('hex')`, 64 chars, casando com `@db.Char(64)` do schema.
- SHA-256 e não bcrypt: o segredo já tem alta entropia (não precisa de KDF lento) e a busca precisa ser `WHERE token_hash = ?` sobre índice único — bcrypt tornaria o lookup O(n).

### `src/utils/clock.ts` *(create)*
- `now(): Date`, `addHours(date, hours): Date`, `addDays(date, days): Date`. Sem dependência externa.
- Existe para que os TTLs (24 h de confirmação, 7 dias de refresh) sejam testáveis sem `jest.useFakeTimers` em todo teste. Services devem usar estas funções em vez de `new Date()`.

### `src/config/cors.ts` *(create)*
- Exporta `corsOptions: CorsOptions` com `origin: env.CORS_ALLOWED_ORIGINS` (array), `credentials: true`, `methods: ['GET','POST','PATCH','DELETE','OPTIONS']`, `allowedHeaders: ['Content-Type','Authorization']`.
- `credentials: true` é obrigatório para o cookie de refresh e é **incompatível com `origin: '*'`**.

### `src/app.ts` *(modify)*
- Trocar as opções de CORS inline por `corsOptions` importado.
- No lugar do `// TODO(TASK-BACKEND-002)` deixado após as rotas, registrar, **nesta ordem**: `app.use(notFoundMiddleware)` e depois `app.use(errorHandlerMiddleware)`. Inverter a ordem faz toda rota inexistente responder 500.

### `package.json` *(modify)*
- Adicionar `bcrypt` (dependência) e `@types/bcrypt` (dev). Nenhuma outra.

---

## Acceptance Criteria

- [ ] **Given** uma rota que lança `ConflictError('Este e-mail já está em uso.', 'EMAIL_ALREADY_IN_USE')`, **When** chamada, **Then** a resposta é `409` com corpo exatamente `{ "error": { "code": "EMAIL_ALREADY_IN_USE", "message": "Este e-mail já está em uso." } }` e sem a chave `details`.
- [ ] **Given** um schema exigindo senha de 8 caracteres, **When** o body envia 7, **Then** responde `400` com `code: "VALIDATION_ERROR"` e `details` contendo `{ field: "password", message: "A senha deve ter pelo menos 8 caracteres." }`.
- [ ] **Given** um schema com `email` transformado para lowercase, **When** o cliente envia `"ANA@Exemplo.com"`, **Then** o handler seguinte lê `req.body.email === "ana@exemplo.com"`.
- [ ] **Given** um handler que lança `new Error('detalhe interno com segredo')`, **When** processado, **Then** a resposta é `500 { error: { code: "INTERNAL_ERROR", message: "Ocorreu um erro inesperado. Tente novamente." } }` — a string original não aparece no corpo, e aparece no log com stack.
- [ ] **Given** `GET /api/rota-inexistente`, **When** chamada, **Then** responde `404` com `code: "ROUTE_NOT_FOUND"` no envelope padrão (não HTML).
- [ ] **Given** a mesma senha hasheada duas vezes, **When** comparados os hashes, **Then** são diferentes entre si e `verifyPassword` retorna `true` para ambos; para senha errada retorna `false`.
- [ ] **Given** duas chamadas a `generateOpaqueToken()`, **When** comparadas, **Then** os valores diferem e cada `hashToken(...)` produz exatamente 64 caracteres hexadecimais, estável para a mesma entrada.
- [ ] **Given** uma origem fora de `CORS_ALLOWED_ORIGINS`, **When** faz preflight, **Then** o navegador bloqueia; e a resposta **nunca** contém `Access-Control-Allow-Origin: *`.
- [ ] Busca por `require('bcrypt')`/`from 'bcrypt'` no `src/` retorna ocorrência apenas em `src/utils/password-hasher.ts`.
- [ ] Busca por `res.status(` com literal numérico no `src/` retorna zero ocorrências fora de `error-handler.middleware.ts`.
- [ ] `npm run typecheck` com 0 erros; nenhum `any` introduzido.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (`app.ts`, `config/env.ts`, `tsconfig` com alias `~/`, `package.json`).
- **Blocks**: TASK-BACKEND-003 (mailer usa `AppError`), TASK-BACKEND-004 (validators, hash de senha, `secure-token`, `clock`), TASK-BACKEND-005 (rotação usa `secure-token` e `clock`), TASK-BACKEND-006 (middlewares de auth lançam `UnauthorizedError`/`ForbiddenError`).
