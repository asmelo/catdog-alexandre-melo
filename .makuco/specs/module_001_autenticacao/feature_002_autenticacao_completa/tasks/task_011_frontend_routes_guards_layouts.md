# TASK-FRONTEND-011 — Rotas, guardas por role e layouts por perfil

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-011-frontend-routes-guards-layouts`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 11 of 13 — Roteamento e Layouts
**Generated**: `2026-08-19`

---

## Context

Implementa HU-05: roteamento com guardas que redirecionam por role e layouts distintos para `admin` e `cliente`. As guardas são **conveniência de UX** — a autorização que vale é a do servidor (RN-10), já entregue na TASK-BACKEND-006; nenhum dado sensível pode depender apenas destas verificações.

---

## Scope

**In:** Constantes de path e a função de home por role, `ProtectedRoute`, `RoleRoute`, `PublicOnlyRoute`, os três layouts, página 404, e a montagem do roteador com o `AuthProvider`.

**Out:** Nenhuma página de autenticação ou home de perfil (TASK-FRONTEND-012) — o roteador deste slice deixa os pontos de montagem preparados. Nenhum componente de UI novo (TASK-FRONTEND-009). Não implementar navegação do catálogo, pets ou pedidos — outras features. Sem testes (TASK-FRONTEND-013).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/routes/route-paths.ts` | paths e home por role |
| `create` | `src/routes/protected-route.tsx` | exige autenticação |
| `create` | `src/routes/role-route.tsx` | exige role específica |
| `create` | `src/routes/public-only-route.tsx` | bloqueia já autenticado |
| `create` | `src/routes/app-routes.tsx` | mapa de rotas |
| `create` | `src/layouts/auth-layout.tsx` | moldura das telas auth |
| `create` | `src/layouts/admin-layout.tsx` | layout administrativo |
| `create` | `src/layouts/client-layout.tsx` | layout do cliente |
| `create` | `src/pages/errors/not-found-page.tsx` | rota inexistente |
| `modify` | `src/App.tsx` | renderiza o roteador |
| `modify` | `src/main.tsx` | monta router e provider |

---

## Implementation

> **Reference pattern**: `src/contexts/auth/use-auth.ts` (TASK-FRONTEND-010) fornece `status` e `user`; `src/components/ui/*` (TASK-FRONTEND-009) fornece `PawBackground` e `CatDogLogo`; os tokens do Tailwind (TASK-FRONTEND-008) fornecem todas as cores.

### `src/routes/route-paths.ts` *(create)*
- Objeto `as const` com todos os paths em PT-BR (o produto é PT-BR e a URL é interface): `LOGIN: '/login'`, `REGISTER: '/cadastro'`, `CHECK_EMAIL: '/verifique-seu-email'`, `CONFIRM_EMAIL: '/confirmar-email'`, `ADMIN_HOME: '/admin'`, `CLIENT_HOME: '/minha-area'`, `ROOT: '/'`.
- `CONFIRM_EMAIL` precisa casar **exatamente** com o link montado pelo backend (`${APP_WEB_URL}/confirmar-email?token=...`). Divergir aqui quebra HU-02 em produção sem quebrar nenhum teste.
- `homePathForRole(role)`: `'admin' → ADMIN_HOME`, `'cliente' → CLIENT_HOME`. Materializa RN-09 (o destino pós-login é determinado exclusivamente pela role vinda do token). Função **única**, usada pelo pós-login, pelo `PublicOnlyRoute` e pelo `RoleRoute` — três implementações do mesmo redirecionamento divergiriam com o tempo.

### `src/routes/protected-route.tsx` *(create)*
- `status === 'bootstrapping'` → renderiza um splash simples (logo + indicador), **nunca** redireciona. Redirecionar durante o bootstrap é o bug clássico que desloga o usuário a cada F5.
- `status === 'anonymous'` → `<Navigate to={LOGIN} state={{ from: location }} replace />`. O `replace` evita que o botão "voltar" recaia na rota protegida; o `state.from` permite retomar o destino após o login.
- Autenticado → `<Outlet />`.

### `src/routes/role-route.tsx` *(create)*
- Props `{ allow: Array<'admin' | 'cliente'> }`. Role fora da lista → `<Navigate to={homePathForRole(user.role)} replace />`.
- **Redirecionar para a área da própria role, não exibir 403**: é o comportamento literal exigido pela spec (CT-16). O conteúdo restrito não pode ser renderizado nem por um instante — decidir **antes** de montar os filhos, nunca esconder com CSS.
- Assume `ProtectedRoute` acima na árvore; se `user` for `null`, redirecionar para login em vez de quebrar.

### `src/routes/public-only-route.tsx` *(create)*
- Autenticado → `<Navigate to={homePathForRole(user.role)} replace />`. Atende à regra da spec de que login e cadastro redirecionam automaticamente quem já está autenticado.
- Durante `bootstrapping`, renderizar o splash — não deixar o formulário de login piscar para quem já tem sessão.

### `src/routes/app-routes.tsx` *(create)*
- `<Routes>` declarativo. Estrutura:
  - `PublicOnlyRoute` → `AuthLayout` → `/login`, `/cadastro`
  - público → `AuthLayout` → `/verifique-seu-email`, `/confirmar-email`
  - `ProtectedRoute` → `RoleRoute allow={['admin']}` → `AdminLayout` → `/admin/*`
  - `ProtectedRoute` → `RoleRoute allow={['cliente']}` → `ClientLayout` → `/minha-area/*`
  - `/` → redireciona para a home da role ou para `/login`
  - `*` → `NotFoundPage`
- `/confirmar-email` é **público de propósito**: quem clica no link do e-mail ainda não tem sessão.
- Neste slice as folhas de `/login`, `/cadastro`, `/verifique-seu-email`, `/confirmar-email`, `/admin` e `/minha-area` ficam como elementos placeholder com `// TODO(TASK-FRONTEND-012)`; a TASK-FRONTEND-012 substitui cada um pela página real. Assim este slice é executável e verificável isoladamente.

### `src/layouts/auth-layout.tsx` *(create)*
- `min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-surface-canvas` com `<PawBackground />` e `<Outlet />` — reproduz a moldura do `reference.html`.
- Padding lateral responsivo para que o card de 420px não encoste na borda em telas pequenas.

### `src/layouts/admin-layout.tsx` *(create)*
- Topbar `bg-brand-purple text-white` com `CatDogLogo`, navegação de gestão e identificação do perfil ("Administrador") + botão "Sair" chamando `logout`.
- `<main>` com `<Outlet />`. Usar landmarks semânticos (`<header>`, `<nav>`, `<main>`) — não `<div>` genérica.

### `src/layouts/client-layout.tsx` *(create)*
- Header claro (`bg-surface-card border-b border-hairline`) com logo, nome do usuário e "Sair".
- **Nenhum** controle administrativo pode existir neste layout, nem oculto (CA-10): a ausência deve ser no DOM.

### `src/pages/errors/not-found-page.tsx` *(create)*
- Mensagem em PT-BR e link de retorno: para a home da role quando autenticado, para `/login` quando não.

### `src/App.tsx` *(modify)*
- Substituir o placeholder da TASK-FRONTEND-008 por `<AppRoutes />`.

### `src/main.tsx` *(modify)*
- Envolver na ordem: `<BrowserRouter>` → `<AuthProvider>` → `<App />`. O provider precisa estar **dentro** do router, porque as guardas e o tratamento de sessão expirada usam hooks de navegação.

---

## Acceptance Criteria

- [ ] **Given** usuário não autenticado, **When** acessa `/admin` ou `/minha-area`, **Then** é redirecionado para `/login` e nenhum conteúdo protegido é renderizado (CT-17).
- [ ] **Given** usuário `cliente` autenticado, **When** acessa `/admin`, **Then** é redirecionado para `/minha-area` e o conteúdo administrativo **não** aparece no DOM em nenhum momento (CT-16).
- [ ] **Given** usuário `admin` autenticado, **When** acessa `/admin`, **Then** vê o `AdminLayout` com a navegação de gestão.
- [ ] **Given** usuário `cliente` autenticado, **When** inspeciona o DOM da sua área, **Then** não existe nenhum controle administrativo — ausente, não escondido por CSS (CA-10).
- [ ] **Given** usuário autenticado, **When** acessa `/login` ou `/cadastro`, **Then** é redirecionado para a home da sua role.
- [ ] **Given** sessão válida e um F5 em `/admin`, **When** a página recarrega, **Then** aparece o splash de bootstrap e o usuário **permanece** em `/admin` — não é enviado para `/login`.
- [ ] **Given** `/confirmar-email?token=abc`, **When** acessado sem sessão, **Then** a rota renderiza normalmente (é pública) e o parâmetro `token` continua acessível.
- [ ] **Given** um redirecionamento de guarda, **When** o usuário clica em "voltar", **Then** não retorna para a rota bloqueada (efeito do `replace`).
- [ ] **Given** um path inexistente, **When** acessado, **Then** renderiza a página 404 com link de retorno coerente com o estado de autenticação.
- [ ] **Given** a sessão expira durante o uso (refresh falha), **When** o evento dispara, **Then** o usuário é levado a `/login` com a mensagem "Sua sessão expirou. Faça login novamente.".
- [ ] `homePathForRole` tem uma única definição no código.

---

## Authorization

- `admin` → `/admin/*`; acesso a `/minha-area/*` redireciona para `/admin`.
- `cliente` → `/minha-area/*`; acesso a `/admin/*` redireciona para `/minha-area`.
- Não autenticado → apenas `/login`, `/cadastro`, `/verifique-seu-email`, `/confirmar-email`.
- Estas guardas são de experiência. A negativa efetiva é do backend (`authenticate` + `authorizeRole`) — nenhuma decisão de exibir dado sensível pode se apoiar apenas nelas.

---

## Dependencies

- **Requires**: TASK-FRONTEND-010 (`useAuth`, `status`, `user`, tratamento de sessão expirada), TASK-FRONTEND-009 (`PawBackground`, `CatDogLogo`), TASK-FRONTEND-008 (tokens).
- **Blocks**: TASK-FRONTEND-012 (as páginas substituem os placeholders deste roteador), TASK-FRONTEND-013.
