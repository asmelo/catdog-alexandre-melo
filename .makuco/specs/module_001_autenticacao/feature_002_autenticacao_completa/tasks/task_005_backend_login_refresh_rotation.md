# TASK-BACKEND-005 — Login, access token e rotação de refresh token

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-005-backend-login-refresh-rotation`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 5 of 13 — Domínio Auth: Sessão
**Generated**: `2026-08-19`

---

## Context

Implementa HU-03 (login) e HU-04 (renovação de sessão) com as regras RN-01, RN-05, RN-06 e RN-07. O núcleo de risco é a **rotação com detecção de reuso**: todo refresh token é de uso único e a reapresentação de um token já rotacionado deve invalidar a família inteira da sessão.

---

## Scope

**In:** Emissão/verificação do access token JWT, mapper `User` → DTO público, repositório de `RefreshToken` com revogação por família, services de login/refresh/logout, helper de cookie de sessão, schema de login, e a extensão de controller e rotas.

**Out:** Não implementar os middlewares `authenticate`/`authorizeRole` nem `GET /api/auth/me` (TASK-BACKEND-006). Sem rate limit ainda (TASK-BACKEND-006). Não alterar registro, confirmação ou reenvio (TASK-BACKEND-004). Não alterar `prisma/schema.prisma`. Não implementar controle de sessões por dispositivo nem revogação manual pelo usuário — explicitamente fora do escopo da feature. Sem testes (TASK-BACKEND-007).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Fazer login | `LoginService.execute()` |
| Renovar sessão | `RefreshSessionService.execute()` |
| Rotação de token (RN-06) | `RefreshTokenRevokedReason.ROTATED` |
| Reutilização indevida (RN-07) | `RefreshTokenRevokedReason.REUSE_DETECTED` |
| Sessão do usuário | conjunto de `RefreshToken` com o mesmo `familyId` |
| Sessão expirada | `SessionExpiredError` → `401 SESSION_EXPIRED` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/auth/tokens/access-token.service.ts` | assina e verifica JWT |
| `create` | `src/domains/auth/errors/session.errors.ts` | erros de sessão |
| `create` | `src/domains/auth/mappers/user.mapper.ts` | User para DTO público |
| `create` | `src/domains/auth/repositories/refresh-token.repository.ts` | acesso e revogação |
| `create` | `src/domains/auth/session-cookie.ts` | opções do cookie |
| `create` | `src/domains/auth/services/login.service.ts` | regra de login |
| `create` | `src/domains/auth/services/refresh-session.service.ts` | rotação e reuso |
| `create` | `src/domains/auth/services/logout.service.ts` | encerra sessão |
| `modify` | `src/domains/auth/auth.validators.ts` | adiciona loginSchema |
| `modify` | `src/domains/auth/auth.controller.ts` | handlers de sessão |
| `modify` | `src/domains/auth/auth.routes.ts` | rotas de sessão |
| `modify` | `package.json` | adiciona jsonwebtoken |

---

## Implementation

> **Reference pattern**: os services, repositórios e erros criados na TASK-BACKEND-004 são o molde exato (injeção por construtor, interface de repositório declarada no domínio, erro nomeado pela regra violada). Só as divergências abaixo importam.

### `src/domains/auth/tokens/access-token.service.ts` *(create)*
- Encapsula `jsonwebtoken` — **nenhum outro arquivo pode importá-lo**.
- `signAccessToken(user): string` e `verifyAccessToken(token): AccessTokenClaims` (o `verify` é consumido pela TASK-BACKEND-006).
- Claims exatas: `sub` (uuid do usuário), `role` (`"admin"` | `"cliente"` — **lowercase**), `typ: "access"`, `iss: env.JWT_ISSUER`, `aud: env.JWT_AUDIENCE`, `exp` por `env.JWT_ACCESS_TTL` (15m). HS256.
- **Sem e-mail e sem nome no token** — minimiza PII em trânsito e em log; o frontend hidrata o usuário pela resposta do login/refresh.
- `typ: "access"` é verificado no `verify` e rejeitado se divergente: impede que qualquer outro token assinado com o mesmo segredo seja aceito como credencial de acesso.
- O `verify` deve validar `issuer` e `audience` explicitamente, não só a assinatura.

### `src/domains/auth/errors/session.errors.ts` *(create)*
- `InvalidCredentialsError` → `401 INVALID_CREDENTIALS`, mensagem "E-mail ou senha incorretos.".
- `AccountNotConfirmedError` → `403 ACCOUNT_NOT_CONFIRMED`, mensagem "Sua conta ainda não foi confirmada. Verifique seu e-mail.".
- `SessionExpiredError` → `401 SESSION_EXPIRED`, mensagem "Sua sessão expirou. Faça login novamente.".

### `src/domains/auth/mappers/user.mapper.ts` *(create)*
- `toAuthenticatedUser(user)` → `{ id, name, email, role }` com `role` convertido de `UserRole.ADMIN`/`CLIENTE` para `"admin"`/`"cliente"`.
- Ponto **único** de conversão do enum: o banco usa UPPERCASE (convenção Postgres/Prisma), o contrato da API e do JWT usa lowercase (literal usado em toda a spec e nos paths de rota). Espalhar `.toLowerCase()` pelo código criaria duas fontes de verdade.
- Nunca expor `passwordHash`, `status` ou timestamps nesse DTO.

### `src/domains/auth/repositories/refresh-token.repository.ts` *(create)*
- Interface + implementação Prisma. Métodos: `create({ userId, familyId, tokenHash, expiresAt })`, `findByTokenHash(tokenHash)`, `revokeById(id, reason, replacedById?)`, `revokeFamily(familyId, reason): Promise<number>`, `markRotated(id, replacedById)`.
- `revokeFamily` é **um único** `updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt, revokedReason } })` — coberto pelo índice `(family_id, revoked_at)`. Não caminhar a cadeia `replacedById`: seria O(n) round-trips com risco de ciclo.
- `markRotated` usa **compare-and-swap**: `updateMany({ where: { id, revokedAt: null }, data: { revokedAt, revokedReason: 'ROTATED', replacedById } })` retornando `count`. É este `count` que impede rotação dupla sob concorrência.

### `src/domains/auth/session-cookie.ts` *(create)*
- Constante `REFRESH_COOKIE_NAME = 'catdog_rt'` e função `buildRefreshCookieOptions()`.
- Opções: `httpOnly: true`, `secure: env.COOKIE_SECURE`, `sameSite: env.COOKIE_SAME_SITE`, `domain: env.COOKIE_DOMAIN || undefined`, `path: '/api/auth'`, `maxAge` derivado de `REFRESH_TOKEN_TTL_DAYS`.
- `path: '/api/auth'` é deliberado: o cookie não acompanha nenhuma chamada de negócio, reduzindo a superfície de exposição.
- Exportar também `clearRefreshCookie(res)` — deve usar **exatamente** os mesmos `path`/`domain`/`sameSite`, senão o navegador não remove o cookie.

### `src/domains/auth/services/login.service.ts` *(create)*
- Passos: `findByEmail` → **mesmo quando o usuário não existe, executar `verifyPassword(senha, DUMMY_PASSWORD_HASH)`** e então lançar `InvalidCredentialsError`. Sem essa comparação-fantasma, o tempo de resposta revela se o e-mail existe e RN-05/RNF-03 ficam cumpridos só na aparência.
- Senha inválida → `InvalidCredentialsError` (mesma mensagem, mesmo status, mesmo `code` do caso anterior — CT-11 e CT-12 são indistinguíveis por design).
- `status !== ACTIVE` → `AccountNotConfirmedError` (RN-01). Verificar o status **depois** de validar a senha, para não revelar existência de conta a quem não sabe a senha.
- Sucesso: gera `familyId` novo (`crypto.randomUUID()`), cria o `RefreshToken` (guardando só o hash) e assina o access token. Retorna `{ accessToken, expiresIn, user, refreshToken: raw }` — o `raw` só trafega até o controller, que o transforma em cookie.

### `src/domains/auth/services/refresh-session.service.ts` *(create)*
Algoritmo obrigatório, nesta ordem:
1. Sem token bruto → `SessionExpiredError`.
2. `findByTokenHash(hashToken(raw))` → `null` ⇒ `SessionExpiredError` (não há família a revogar: o token nunca existiu).
3. **Detecção de reuso (RN-07)** — se `revokedAt != null`, **qualquer** que seja o motivo (inclusive `ROTATED`): `revokeFamily(familyId, 'REUSE_DETECTED')`, emitir `logger.warn({ event: 'refresh_token_reuse_detected', userId, familyId, ip, userAgent })` e lançar `SessionExpiredError`. O log alimenta a métrica de auditoria definida na spec.
4. `expiresAt <= now()` → `revokeById(id, 'EXPIRED')` e `SessionExpiredError`.
5. Usuário inexistente ou `status !== ACTIVE` → `revokeFamily(familyId, 'ACCOUNT_DISABLED')` e `SessionExpiredError`.
6. **Rotação atômica** em `prisma.$transaction`: (a) `markRotated(old.id, novoId)` — se `count === 0`, outra requisição venceu a corrida: abortar e tratar como reuso (passo 3); (b) `create` do novo token com **o mesmo `familyId`**, novo hash e `expiresAt = now + REFRESH_TOKEN_TTL_DAYS`; (c) gravar `replacedById` no antigo.
7. Assinar novo access token e retornar `{ accessToken, expiresIn, user, refreshToken: raw }`.
- O TTL do refresh é **deslizante** (reinicia a cada rotação) — é o comportamento que sustenta "o usuário permanece logado" de HU-04. Não implementar teto absoluto de família nesta versão.
- Todos os desfechos de falha retornam a **mesma** `SessionExpiredError`: o cliente não deve distinguir expirado de reuso detectado.

### `src/domains/auth/services/logout.service.ts` *(create)*
- Se houver token bruto e ele for encontrado, `revokeFamily(familyId, 'LOGOUT')`. Se não houver, ou não for encontrado, **retorna normalmente**.
- Idempotente: logout nunca falha, nunca lança.

### `src/domains/auth/auth.validators.ts` *(modify)*
- Adicionar `loginSchema`: `email` (mesma regra de normalização do registro) e `password` `z.string().min(1, MESSAGES.FIELD_REQUIRED)`. **Não** aplicar `.min(8)` no login — a regra de tamanho é de cadastro; aplicá-la aqui devolveria erro de validação em vez de "E-mail ou senha incorretos.", revelando o formato da senha armazenada.

### `src/domains/auth/auth.controller.ts` *(modify)*
- `login`: chama o service, `res.cookie(REFRESH_COOKIE_NAME, raw, buildRefreshCookieOptions())` e responde `200 { accessToken, expiresIn, user }`. **O refresh token nunca vai no corpo da resposta.**
- `refresh`: lê `req.cookies[REFRESH_COOKIE_NAME]`, chama o service, seta o novo cookie e responde `200 { accessToken, expiresIn, user }`. Em erro, o handler global responde — mas o cookie precisa ser **limpo** antes de propagar: capturar, `clearRefreshCookie(res)` e relançar.
- `logout`: chama o service, `clearRefreshCookie(res)` e responde `204` sem corpo.

### `src/domains/auth/auth.routes.ts` *(modify)*
- `POST /login` (com `validateRequest({ body: loginSchema })`), `POST /refresh` (sem validação de body — a credencial é o cookie), `POST /logout`.

### `package.json` *(modify)*
- Adicionar `jsonwebtoken` e `@types/jsonwebtoken` (dev).

---

## Acceptance Criteria

- [ ] **Given** conta `ACTIVE` com role `admin` e credenciais corretas, **When** `POST /api/auth/login`, **Then** `200` com `{ accessToken, expiresIn: 900, user }`, `user.role === "admin"`, e um `Set-Cookie: catdog_rt` com `HttpOnly` e `Path=/api/auth`.
- [ ] **Given** conta `ACTIVE` com role `cliente`, **When** login correto, **Then** `user.role === "cliente"` e a claim `role` do JWT decodificado também é `"cliente"`.
- [ ] **Given** senha incorreta **e** given e-mail inexistente, **When** login, **Then** ambos respondem `401 INVALID_CREDENTIALS` com "E-mail ou senha incorretos." — status, `code` e mensagem idênticos (CT-11 ≡ CT-12).
- [ ] **Given** conta com `status = PENDING_CONFIRMATION` e senha correta, **When** login, **Then** `403 ACCOUNT_NOT_CONFIRMED` e nenhum token é emitido (RN-01).
- [ ] **Given** o corpo da resposta de login, **When** inspecionado, **Then** não contém o refresh token nem `passwordHash`; o JWT decodificado não contém `email` nem `name`.
- [ ] **Given** refresh token válido, **When** `POST /api/auth/refresh`, **Then** `200` com novo `accessToken`, novo `Set-Cookie`, o token anterior fica `revokedAt != null` com `revokedReason = 'ROTATED'` (RNF-02), e o novo registro compartilha o **mesmo `familyId`** (RN-06).
- [ ] **Given** um refresh token já rotacionado, **When** reapresentado, **Then** `401 SESSION_EXPIRED`, **todos** os tokens daquele `familyId` ficam com `revokedAt != null` e `revokedReason = 'REUSE_DETECTED'`, e um log `refresh_token_reuse_detected` é emitido (RN-07 / CT-15).
- [ ] **Given** a família revogada por reuso, **When** o token mais recente (legítimo) é apresentado, **Then** também responde `401 SESSION_EXPIRED` — a sessão inteira caiu.
- [ ] **Given** refresh token com `expiresAt` no passado, **When** apresentado, **Then** `401 SESSION_EXPIRED` e o cookie é limpo na resposta.
- [ ] **Given** requisição de refresh sem cookie, **When** processada, **Then** `401 SESSION_EXPIRED` — sem stack trace e sem 500.
- [ ] **Given** dois refresh simultâneos com o mesmo token, **When** processados, **Then** exatamente um responde `200`; o outro responde `401` e a família é revogada — nunca dois `200`.
- [ ] **Given** usuário logado, **When** `POST /api/auth/logout`, **Then** `204`, cookie limpo e todos os tokens da família com `revokedReason = 'LOGOUT'`; **When** chamado de novo sem cookie, **Then** ainda `204`.
- [ ] **Given** o cookie de refresh, **When** inspecionado no navegador, **Then** `document.cookie` **não** o expõe (flag `HttpOnly` efetiva).
- [ ] Busca por `jsonwebtoken` no `src/` retorna ocorrência apenas em `src/domains/auth/tokens/access-token.service.ts`.

---

## API Notes

- `POST /api/auth/login` — body `{ email, password }` → `200 { accessToken, expiresIn, user }` + `Set-Cookie`. Erros: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_NOT_CONFIRMED`.
- `POST /api/auth/refresh` — sem body; credencial é o cookie `catdog_rt` → `200 { accessToken, expiresIn, user }` + novo `Set-Cookie`. Único erro: `401 SESSION_EXPIRED` (cobre ausente, inválido, expirado e reuso — indistinguíveis por design).
- `POST /api/auth/logout` — sem body → `204`, sem corpo. Nunca falha.
- **Transporte do refresh em cookie `httpOnly`, não no corpo**: é a única opção que combina imunidade a XSS com sessão sobrevivendo ao F5. O CSRF residual é inócuo — o endpoint não altera estado de negócio e a resposta é ilegível para outra origem por CORS. Exige `credentials: 'include'` no cliente e proxy `/api` no dev server do Vite.

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (`password-hasher` com `DUMMY_PASSWORD_HASH`, `secure-token`, `clock`, erros HTTP), TASK-BACKEND-004 (`UserRepository`, `auth.controller.ts`, `auth.routes.ts`, `auth.messages.ts`).
- **Blocks**: TASK-BACKEND-006 (`authenticate` usa `verifyAccessToken`; `/me` usa o mapper), TASK-BACKEND-007 (testes de sessão), TASK-FRONTEND-010 (o cliente HTTP depende deste contrato congelado).
