# TASK-FRONTEND-012 — Telas de login, cadastro e confirmação de conta

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-012-frontend-auth-pages`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 12 of 13 — Telas de Autenticação
**Generated**: `2026-08-19`

---

## Context

Monta as quatro telas do fluxo de autenticação usando os componentes da TASK-FRONTEND-009 e o contexto da TASK-FRONTEND-010, mais as homes mínimas de cada role. Os textos em PT-BR são contrato: os da tela de login vêm do `.makuco/resources/reference.html` e os de erro vêm da tabela "Mensagens ao Usuário" da spec — devem aparecer literalmente.

---

## Scope

**In:** Catálogo de mensagens do cliente, regras de validação de formulário, páginas de login, cadastro, aviso de verificação de e-mail e resultado da confirmação, homes de `admin` e `cliente`, e a substituição dos placeholders no roteador.

**Out:** Não criar componentes de UI novos — se algo faltar, reportar em vez de improvisar fora do design system. Não implementar recuperação de senha nem o link "Esqueceu sua senha?" (fora do escopo). Não implementar conteúdo real do painel administrativo nem da área do cliente — as homes são mínimas e servem ao teste de redirecionamento. Não alterar guardas ou layouts (TASK-FRONTEND-011). Sem testes (TASK-FRONTEND-013).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/utils/messages.ts` | textos PT-BR |
| `create` | `src/utils/validation.ts` | validação de formulário |
| `create` | `src/pages/auth/login-page.tsx` | tela de login |
| `create` | `src/pages/auth/register-page.tsx` | tela de cadastro |
| `create` | `src/pages/auth/check-email-page.tsx` | aviso pós-cadastro |
| `create` | `src/pages/auth/confirm-email-page.tsx` | resultado da confirmação |
| `create` | `src/pages/admin/admin-home-page.tsx` | home do admin |
| `create` | `src/pages/client/client-home-page.tsx` | home do cliente |
| `modify` | `src/routes/app-routes.tsx` | substitui placeholders |

---

## Implementation

> **Reference pattern**: `.makuco/resources/reference.html` é o modelo literal da tela de login (títulos, placeholders, rótulo do botão, link de cadastro). Os componentes de `src/components/ui/` (TASK-FRONTEND-009) e `useAuth` (TASK-FRONTEND-010) são o material de construção.

### `src/utils/messages.ts` *(create)*
- Objeto `as const` com as strings da tabela "Mensagens ao Usuário" da spec, copiadas caractere a caractere (acentos e ponto final inclusos), mais os textos do mockup: `"Bem vindo!"`, `"Digite os seus dados de acesso no campo abaixo"`, `"Informar o seu e-mail"`, `"Informar a sua senha"`, `"Entrar"`, `"Não tem uma conta?"`, `"Cadastre-se"`.
- As mensagens vindas da API **não** são reescritas aqui: `ApiError.message` já chega pronto em PT-BR. Este catálogo cobre apenas o texto estático e a validação local.

### `src/utils/validation.ts` *(create)*
- Funções puras de validação de formulário, retornando mapa `campo → mensagem`: obrigatoriedade, formato de e-mail, senha com no mínimo 8 caracteres, e **igualdade entre senha e confirmação**.
- A confirmação de senha é validada **exclusivamente aqui, no cliente** (RN-12) e nunca é enviada à API. Manter estas funções puras (sem React) é o que as torna testáveis isoladamente.

### `src/pages/auth/login-page.tsx` *(create)*
- `AuthCard` com título `"Bem vindo!"` e subtítulo `"Digite os seus dados de acesso no campo abaixo"`.
- `TextField` de e-mail (`type="email"`, `autoComplete="email"`, placeholder `"Informar o seu e-mail"`) e `PasswordField` (`autoComplete="current-password"`, placeholder `"Informar a sua senha"`).
- `SubmitButton` com rótulo `"Entrar"`; abaixo, `"Não tem uma conta? Cadastre-se"` com `<Link>` para `/cadastro`. **Sem** o link "Esqueceu sua senha?" do mockup.
- Envolver os campos em um `<form onSubmit>` real — é o que permite submeter com Enter (RNF-05). Não usar `onClick` no botão.
- No sucesso: navegar para `homePathForRole(user.role)`, ou para `location.state.from` quando existir (RN-09 / HU-05 / CT-09 / CT-10).
- Tratamento de erro por `ApiError.code`: `INVALID_CREDENTIALS` → `AlertMessage` de erro com a mensagem da API; `ACCOUNT_NOT_CONFIRMED` → alerta **mais** um botão "Reenviar e-mail de confirmação" chamando `authApi.resendConfirmation`; `VALIDATION_ERROR` → distribuir `details` pelos campos.
- Botão desabilitado durante a requisição (`isLoading`), evitando submissão duplicada.

### `src/pages/auth/register-page.tsx` *(create)*
- Campos: Nome completo, E-mail, Senha, Confirmação de senha — nesta ordem, com `autoComplete` adequado (`name`, `email`, `new-password`, `new-password`).
- Validação local **antes** de chamar a API: campo em branco → `"Este campo é obrigatório."`; senha curta → `"A senha deve ter pelo menos 8 caracteres."`; divergência → `"As senhas não coincidem."` **sem** disparar requisição.
- Payload enviado: apenas `{ name, email, password }`.
- Sucesso → navegar para `/verifique-seu-email`. Erro `EMAIL_ALREADY_IN_USE` → alerta com "Este e-mail já está em uso." **mantendo o formulário preenchido** (exigência explícita da spec) — não limpar os campos.
- Link "Já tenho conta" para `/login`.

### `src/pages/auth/check-email-page.tsx` *(create)*
- Tela informativa com "Verifique seu e-mail para ativar sua conta.", orientação para checar a caixa de entrada e spam, e link para `/login`.
- Não expõe o e-mail digitado se a página for acessada diretamente (sem estado de navegação) — apenas o texto genérico.

### `src/pages/auth/confirm-email-page.tsx` *(create)*
- Lê `token` da query string (`useSearchParams`) e chama `authApi.confirmEmail` **uma única vez** no mount — usar `ref` de controle, porque o `StrictMode` do React 18 monta duas vezes em desenvolvimento e a segunda chamada consumiria o token e exibiria falso "já utilizado" (RN-03).
- Sem `token` na URL → estado de erro imediato, sem chamar a API.
- Quatro estados de tela: carregando; sucesso → "Conta confirmada! Faça login para continuar." + link para `/login`; `CONFIRMATION_TOKEN_EXPIRED` → mensagem da API + campo de e-mail e botão para solicitar novo link; `CONFIRMATION_TOKEN_ALREADY_USED` / `CONFIRMATION_TOKEN_INVALID` → mensagem da API + link para `/login`.

### `src/pages/admin/admin-home-page.tsx` e `client-home-page.tsx` *(create)*
- Mínimas e distinguíveis: título identificando a área e o nome do usuário. Existem para tornar os redirecionamentos por role verificáveis; o conteúdo real é de outras features.

### `src/routes/app-routes.tsx` *(modify)*
- Substituir cada placeholder `// TODO(TASK-FRONTEND-012)` pelo componente de página correspondente.

---

## Acceptance Criteria

- [ ] **Given** a tela de login, **When** renderizada, **Then** exibe "Bem vindo!", "Digite os seus dados de acesso no campo abaixo", os dois campos com os placeholders do mockup, o botão "Entrar" e o link "Cadastre-se" — e **não** exibe "Esqueceu sua senha?".
- [ ] **Given** credenciais válidas de `admin`, **When** submetido, **Then** navega para `/admin` com o layout administrativo; **Given** credenciais de `cliente`, **Then** navega para `/minha-area` (CT-09 / CT-10).
- [ ] **Given** senha incorreta **ou** e-mail inexistente, **When** submetido, **Then** exibe "E-mail ou senha incorretos." em `AlertMessage`, sem indicar qual campo está errado, e permanece na tela.
- [ ] **Given** conta não confirmada, **When** login, **Then** exibe "Sua conta ainda não foi confirmada. Verifique seu e-mail." e um botão de reenvio do e-mail.
- [ ] **Given** a requisição de login em andamento, **When** o usuário clica novamente, **Then** o botão está desabilitado e nenhuma segunda requisição é disparada.
- [ ] **Given** o formulário de login, **When** navegado só por teclado, **Then** é possível preencher e submeter com Enter, sem mouse (RNF-05).
- [ ] **Given** cadastro com senha e confirmação diferentes, **When** submetido, **Then** exibe "As senhas não coincidem." e **nenhuma** requisição é enviada (CT-03).
- [ ] **Given** cadastro com senha de 7 caracteres, **When** submetido, **Then** exibe "A senha deve ter pelo menos 8 caracteres." (CT-04); **Given** exatamente 8, **Then** a requisição é enviada (CT-18).
- [ ] **Given** cadastro com o campo Nome em branco, **When** submetido, **Then** exibe "Este campo é obrigatório." abaixo do campo Nome (CT-05).
- [ ] **Given** cadastro com e-mail já usado, **When** a API responde `409`, **Then** exibe "Este e-mail já está em uso." e os campos preenchidos **permanecem** com os valores digitados (CT-02).
- [ ] **Given** cadastro bem-sucedido, **When** concluído, **Then** navega para `/verifique-seu-email` exibindo "Verifique seu e-mail para ativar sua conta." (CT-01).
- [ ] **Given** `/confirmar-email?token=valido`, **When** aberta, **Then** exibe "Conta confirmada! Faça login para continuar." e link para login (CT-06).
- [ ] **Given** a mesma página em `StrictMode`, **When** montada em desenvolvimento, **Then** `POST /auth/confirm-email` é chamado **exatamente uma vez**.
- [ ] **Given** token expirado, **When** aberta, **Then** exibe "Este link de confirmação expirou. Solicite um novo e-mail de confirmação." e oferece reenvio (CT-07); **Given** token já usado, **Then** exibe "Este link de confirmação já foi utilizado." (CT-08).
- [ ] **Given** `/confirmar-email` sem query `token`, **When** aberta, **Then** exibe erro sem chamar a API.
- [ ] Nenhuma requisição de cadastro contém o campo de confirmação de senha.

---

## Dependencies

- **Requires**: TASK-FRONTEND-011 (roteador, guardas, layouts), TASK-FRONTEND-010 (`useAuth`, `authApi`, `ApiError`), TASK-FRONTEND-009 (componentes), TASK-BACKEND-004 e TASK-BACKEND-005 (endpoints em execução para validação ponta a ponta).
- **Blocks**: TASK-FRONTEND-013 (testes das telas).
