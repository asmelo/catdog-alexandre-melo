# TASK-BACKEND-004 — Registro de usuário, confirmação de conta e reenvio

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-004-backend-register-confirm-email`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 4 of 13 — Domínio Auth: Registro e Confirmação
**Generated**: `2026-08-19`

---

## Context

Implementa HU-01 (registro) e HU-02 (confirmação de conta por e-mail) com as regras RN-02, RN-03, RN-04, RN-12 e RN-13. O endpoint de reenvio entra junto porque a própria spec instrui o usuário a "Solicite um novo e-mail de confirmação" — sem ele, o cenário de link expirado (CT-07) é um beco sem saída.

---

## Scope

**In:** Catálogo de mensagens PT-BR, schemas Zod de registro/confirmação/reenvio, erros de domínio dessas regras, repositórios de `User` e `EmailConfirmationToken`, os três services, controller e rotas correspondentes, montagem em `/api/auth`.

**Out:** Nada de login, JWT, refresh token ou logout (TASK-BACKEND-005). Nenhum middleware de autenticação/autorização ou rate limit (TASK-BACKEND-006) — as rotas deste slice ficam públicas e sem throttling até lá. Não alterar `prisma/schema.prisma`. Não implementar recuperação de senha (fora do escopo da feature). O campo "confirmação de senha" **não** é aceito no body (RN-12) — a validação é exclusivamente do frontend. Sem testes (TASK-BACKEND-007).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Registrar conta | `RegisterUserService.execute()` |
| Confirmar conta via link | `ConfirmEmailService.execute()` |
| Reenviar e-mail de confirmação | `ResendConfirmationService.execute()` |
| E-mail já em uso (RN-13) | `EmailAlreadyInUseError` → `409 EMAIL_ALREADY_IN_USE` |
| Link expirado (RN-02) | `ConfirmationTokenExpiredError` → `410 CONFIRMATION_TOKEN_EXPIRED` |
| Link já utilizado (RN-03) | `ConfirmationTokenAlreadyUsedError` → `409 CONFIRMATION_TOKEN_ALREADY_USED` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/auth/auth.messages.ts` | catálogo PT-BR |
| `create` | `src/domains/auth/auth.validators.ts` | schemas Zod |
| `create` | `src/domains/auth/errors/registration.errors.ts` | erros de domínio |
| `create` | `src/domains/auth/repositories/user.repository.ts` | acesso a users |
| `create` | `src/domains/auth/repositories/email-confirmation-token.repository.ts` | acesso a tokens |
| `create` | `src/domains/auth/services/register-user.service.ts` | regra de registro |
| `create` | `src/domains/auth/services/confirm-email.service.ts` | regra de confirmação |
| `create` | `src/domains/auth/services/resend-confirmation.service.ts` | regra de reenvio |
| `create` | `src/domains/auth/auth.controller.ts` | camada HTTP |
| `create` | `src/domains/auth/auth.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/auth |

---

## Implementation

> **Reference pattern**: `src/middlewares/validate-request.middleware.ts` e `src/shared/errors/http-errors.ts` (TASK-BACKEND-002) definem como validar e como lançar. `src/infra/mail/mailer.port.ts` (TASK-BACKEND-003) define como enviar e-mail.
>
> **Contrato de camadas** (vale para todos os arquivos deste slice): Controller lê `req`, chama **um** service e responde — não acessa Prisma nem decide regra. Service orquestra a regra e lança erro de domínio — não conhece `req`/`res`/status HTTP. Repository fala Prisma e retorna entidade ou `null` — não lança erro HTTP.

### `src/domains/auth/auth.messages.ts` *(create)*
- Objeto `as const` com as strings **exatas** da tabela "Mensagens ao Usuário" da spec. Copiar caractere a caractere, incluindo acentos e ponto final — os critérios de aceite comparam texto literal.
- Três mensagens **não** previstas na spec e necessárias aqui (registrar no changelog da spec como decisão): `CONFIRMATION_TOKEN_INVALID: 'Link de confirmação inválido.'`, `RESEND_GENERIC: 'Se houver uma conta pendente para este e-mail, enviamos um novo link de confirmação.'`, `FIELD_REQUIRED: 'Este campo é obrigatório.'`.

### `src/domains/auth/auth.validators.ts` *(create)*
- `registerSchema`: `name` string `.trim().min(2).max(100)`; `email` string `.trim().toLowerCase().email()` `.max(254)`; `password` string `.min(8, MESSAGES.PASSWORD_TOO_SHORT).max(72)`.
  - `.toLowerCase()` no schema é o **ponto único de normalização** — o repositório assume que o e-mail já chega normalizado.
  - `.max(72)` porque bcrypt trunca silenciosamente acima de 72 bytes; sem o limite, duas senhas diferentes passariam a autenticar uma à outra.
  - Usar `.strict()` para **rejeitar** `confirmPassword` se enviado (RN-12).
- `confirmEmailSchema`: `{ token: z.string().min(32) }`.
- `resendConfirmationSchema`: `{ email: <mesma regra de e-mail> }`.
- Tipos derivam por `z.infer` — não criar arquivos de DTO duplicando o schema.

### `src/domains/auth/errors/registration.errors.ts` *(create)*
- Quatro classes estendendo as subclasses HTTP da TASK-BACKEND-002, cada uma fixando `message` (do catálogo) e `code`: `EmailAlreadyInUseError` (Conflict/`EMAIL_ALREADY_IN_USE`), `ConfirmationTokenInvalidError` (BadRequest/`CONFIRMATION_TOKEN_INVALID`), `ConfirmationTokenExpiredError` (Gone/`CONFIRMATION_TOKEN_EXPIRED`), `ConfirmationTokenAlreadyUsedError` (Conflict/`CONFIRMATION_TOKEN_ALREADY_USED`).
- Nome da classe = regra violada (convenção de linguagem ubíqua). Sem parâmetros no construtor.

### `src/domains/auth/repositories/user.repository.ts` *(create)*
- Interface `UserRepository` **declarada no domínio** + implementação `PrismaUserRepository` que recebe o `PrismaClient` por injeção. A interface é o que permite fakes em memória nos testes sem mockar Prisma.
- Métodos deste slice: `findByEmail(email): Promise<User | null>`, `findById(id)`, `create(data: { name; email; passwordHash }): Promise<User>`, `activate(userId, confirmedAt): Promise<void>`.
- `create` **não** aceita `role` como parâmetro — o auto-registro sempre produz `CLIENTE` pelo default do schema. Aceitar `role` do exterior abriria escalonamento de privilégio via body.

### `src/domains/auth/repositories/email-confirmation-token.repository.ts` *(create)*
- Interface + implementação Prisma. Métodos: `create({ userId, tokenHash, expiresAt })`, `findByTokenHash(tokenHash)`, `consume(id, consumedAt): Promise<number>`, `invalidatePendingByUser(userId)`.
- `consume` faz **compare-and-swap**: `updateMany({ where: { id, consumedAt: null }, data: { consumedAt } })` e retorna `count`. Retornar a contagem é essencial — `count === 0` significa que outra requisição consumiu primeiro, e o service trata como "já utilizado". Um `update` simples criaria janela de corrida em duplo clique no link.

### `src/domains/auth/services/register-user.service.ts` *(create)*
- Dependências injetadas no construtor: `UserRepository`, `EmailConfirmationTokenRepository`, `MailerPort`, `PrismaClient` (só para `$transaction`).
- Passos: `findByEmail` → se existir (qualquer status, RN-13) lança `EmailAlreadyInUseError`; `hashPassword`; `generateOpaqueToken()` + `hashToken()`; `expiresAt = addHours(now(), env.EMAIL_CONFIRMATION_TTL_HOURS)`.
- Criação de `User` + `EmailConfirmationToken` dentro de **um** `prisma.$transaction` — conta sem token seria uma conta impossível de ativar.
- **Envio do e-mail acontece depois do commit**, fora da transação. Se o SMTP falhar: logar `error` estruturado e **ainda assim retornar sucesso**. Justificativa: a tabela de Integrações da spec manda "registrar falha internamente" e permitir reenvio manual; derrubar o cadastro por indisponibilidade do Gmail perderia a conta já criada. Sem retry/fila (mensageria proibida).
- URL do link: `${env.APP_WEB_URL}/confirmar-email?token=${rawToken}` — aponta para o **frontend**, nunca para a API.
- O service **nunca** retorna o token bruto ao chamador.

### `src/domains/auth/services/confirm-email.service.ts` *(create)*
- Ordem de verificação obrigatória (produz mensagens diferentes): `findByTokenHash(hashToken(raw))` → `null` ⇒ `ConfirmationTokenInvalidError`; `consumedAt != null` ⇒ `ConfirmationTokenAlreadyUsedError` (RN-03); `expiresAt <= now()` ⇒ `ConfirmationTokenExpiredError` (RN-02).
- Checar "já consumido" **antes** de "expirado": um token usado e depois vencido deve reportar "já utilizado", que é a informação acionável para o usuário.
- Em `$transaction`: `consume(...)` → se `count === 0`, tratar como `ConfirmationTokenAlreadyUsedError`; depois `activate(userId, now())` gravando `status = ACTIVE` e `emailConfirmedAt`.

### `src/domains/auth/services/resend-confirmation.service.ts` *(create)*
- Busca o usuário; se não existir **ou** já estiver `ACTIVE`, **retorna normalmente sem enviar nada** — a resposta é sempre a mesma para não permitir enumeração de e-mails (coerente com RN-05).
- Se pendente: `invalidatePendingByUser(userId)` antes de emitir o novo token, para que só exista um link válido por vez; então cria o token e envia o e-mail pelo mesmo caminho do registro.

### `src/domains/auth/auth.controller.ts` *(create)*
- Três handlers finos: `register` → `201 { message: MESSAGES.REGISTER_SUCCESS }`; `confirmEmail` → `200 { message: MESSAGES.CONFIRMATION_SUCCESS }`; `resendConfirmation` → `202 { message: MESSAGES.RESEND_GENERIC }`.
- Sem `try/catch`: `express-async-errors` (ligado na TASK-BACKEND-001) encaminha a rejeição ao error handler.
- Instanciação das dependências fica em uma pequena fábrica neste arquivo ou em `auth.routes.ts` — não instanciar repositório/serviço dentro do handler a cada requisição.

### `src/domains/auth/auth.routes.ts` *(create)*
- `POST /register` → `validateRequest({ body: registerSchema })` → `controller.register`.
- `POST /confirm-email` → `validateRequest({ body: confirmEmailSchema })` → `controller.confirmEmail`.
- `POST /confirmation/resend` → `validateRequest({ body: resendConfirmationSchema })` → `controller.resendConfirmation`.
- Rotas de login/refresh/logout/me são adicionadas neste mesmo arquivo pelos slices seguintes.

### `src/routes/index.ts` *(modify)*
- Ativar `router.use('/auth', authRoutes)` no lugar do comentário deixado na TASK-BACKEND-001.

---

## Acceptance Criteria

- [ ] **Given** body válido com e-mail não cadastrado, **When** `POST /api/auth/register`, **Then** responde `201 { message: "Verifique seu e-mail para ativar sua conta." }`, cria `User` com `status = PENDING_CONFIRMATION` e `role = CLIENTE`, cria um `EmailConfirmationToken` com `expiresAt ≈ now + 24h`, e envia um e-mail contendo `/confirmar-email?token=`.
- [ ] **Given** e-mail já cadastrado (em qualquer status), **When** `POST /api/auth/register`, **Then** responde `409 EMAIL_ALREADY_IN_USE` com "Este e-mail já está em uso." e **nenhum** novo usuário é criado (RN-13).
- [ ] **Given** senha com 7 caracteres, **When** registro, **Then** `400 VALIDATION_ERROR` com `details` apontando `password` e "A senha deve ter pelo menos 8 caracteres."; **Given** senha com exatamente 8, **Then** o cadastro é criado (CT-18).
- [ ] **Given** `name` vazio, **When** registro, **Then** `400` com `details` apontando o campo `name`.
- [ ] **Given** body contendo `confirmPassword`, **When** registro, **Then** `400 VALIDATION_ERROR` — o campo nunca é persistido nem aceito (RN-12).
- [ ] **Given** e-mail informado como `"ANA@Exemplo.com "`, **When** registro e depois consulta no banco, **Then** o valor persistido é `"ana@exemplo.com"`.
- [ ] **Given** o SMTP indisponível, **When** registro com dados válidos, **Then** ainda responde `201`, o `User` permanece criado e a falha aparece no log.
- [ ] **Given** token válido e não expirado, **When** `POST /api/auth/confirm-email`, **Then** `200` com "Conta confirmada! Faça login para continuar.", `status = ACTIVE` e `emailConfirmedAt` preenchido.
- [ ] **Given** o mesmo token usado uma segunda vez, **When** confirmado, **Then** `409 CONFIRMATION_TOKEN_ALREADY_USED` e o usuário permanece `ACTIVE` — nenhum efeito colateral (RN-03).
- [ ] **Given** token com `expiresAt` no passado, **When** confirmado, **Then** `410 CONFIRMATION_TOKEN_EXPIRED` e o usuário permanece `PENDING_CONFIRMATION` (RN-02).
- [ ] **Given** token inexistente, **When** confirmado, **Then** `400 CONFIRMATION_TOKEN_INVALID`.
- [ ] **Given** duas confirmações simultâneas com o mesmo token, **When** processadas, **Then** exatamente uma responde `200` e a outra `409` — nunca duas `200`.
- [ ] **Given** e-mail de conta pendente, **When** `POST /api/auth/confirmation/resend`, **Then** `202`, o token anterior fica invalidado e um novo e-mail é enviado.
- [ ] **Given** e-mail inexistente **ou** de conta já ativa, **When** reenvio, **Then** a resposta é `202` com a **mesma** mensagem genérica e **nenhum** e-mail é enviado.
- [ ] Nenhuma resposta da API contém o token bruto de confirmação.

---

## API Notes

- `POST /api/auth/register` — body `{ name, email, password }` → `201 { message }`. Erros: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_IN_USE`.
- `POST /api/auth/confirm-email` — body `{ token }` → `200 { message }`. Erros: `400 CONFIRMATION_TOKEN_INVALID`, `409 CONFIRMATION_TOKEN_ALREADY_USED`, `410 CONFIRMATION_TOKEN_EXPIRED`.
- `POST /api/auth/confirmation/resend` — body `{ email }` → **sempre** `202 { message }`.
- **Por que o link do e-mail aponta para o frontend e a confirmação é `POST`**: um `GET` no backend seria disparado por scanners de segurança e pelo pré-fetch de clientes de e-mail, **consumindo o token de uso único antes do clique do usuário** e produzindo um falso "Este link de confirmação já foi utilizado.".

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (schema Prisma, `env`, `routes/index.ts`), TASK-BACKEND-002 (`ValidationError`/`ConflictError`/`GoneError`, `validateRequest`, `password-hasher`, `secure-token`, `clock`), TASK-BACKEND-003 (`MailerPort`, template `account-confirmation`).
- **Blocks**: TASK-BACKEND-005 (reusa `UserRepository`, `auth.controller.ts`, `auth.routes.ts` e o catálogo de mensagens), TASK-BACKEND-007 (testes destes fluxos), TASK-FRONTEND-012 (telas de registro e confirmação consomem estes contratos).
