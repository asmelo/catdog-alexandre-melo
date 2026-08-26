# TASK-FRONTEND-006 — Rota pública `/animais`, layout da vitrine e acesso pelo layout do cliente

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-006-frontend-public-route-layout`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 6 of 11 — Roteamento público e cabeçalho
**Generated**: `2026-08-25`

---

## Context

A vitrine é a **primeira rota com conteúdo fora de todas as guardas** da aplicação. As três existentes falham por motivos distintos: `ProtectedRoute` manda ao login quem não tem sessão, `RoleRoute allow={['cliente']}` expulsa o `admin`, e `PublicOnlyRoute` expulsa quem tem sessão. Rota pública é a **ausência** de guarda, não uma guarda nova (Decisão A). Esta task é o ponto de maior risco de regressão da feature: mexe na árvore de rotas e em um layout coberto por testes.

---

## Scope

**In:** `ROUTE_PATHS.SHOWCASE = '/animais'`; `ShowcaseLayout` (cabeçalho público); bloco de rota em `app-routes.tsx` fora de todas as guardas; item de navegação para a vitrine no `ClientLayout`; página da vitrine como elemento placeholder que a TASK-FRONTEND-010 substitui.

**Out:**
- **Não alterar a raiz `/`.** Ela continua decidindo o destino por role dentro do `ProtectedRoute`. Movê-la é recomendação de acompanhamento registrada na Decisão A, explicitamente **fora do escopo** (CT-118, QA-61).
- Não criar guarda "pública" nova — uma guarda que não guarda nada é ruído.
- Não reaproveitar nem modificar `ClientLayout` como layout da vitrine: ele é layout de área autenticada e condicionar metade do seu conteúdo à existência de sessão quebraria a verificação de ausência de controle administrativo que ele já carrega.
- Não tocar em `ProtectedRoute`, `RoleRoute`, `PublicOnlyRoute`, `AdminLayout`, `AuthLayout` nem em `homePathForRole`/`toInternalPath`/`buildRedirectState`.
- Não implementar filtros, grade, cartão ou chamada de API (TASK-FRONTEND-007 a 010).
- Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/routes/route-paths.ts` | caminho da vitrine |
| `create` | `src/layouts/showcase-layout.tsx` | cabeçalho público |
| `create` | `src/pages/showcase/showcase-page.tsx` | placeholder da vitrine |
| `modify` | `src/routes/app-routes.tsx` | bloco fora das guardas |
| `modify` | `src/layouts/client-layout.tsx` | item de navegação |

---

## Implementation

### `src/routes/route-paths.ts` *(modify)*
- Acrescentar `SHOWCASE: '/animais'` ao objeto `as const`. **Uma linha, e nada mais neste arquivo.**
- PT-BR pela convenção já congelada e aplicada duas vezes neste módulo (`/admin/especies`, `/admin/animais`). A captura mostra `/animals`; a decisão é `/animais` (Decisão 3 do changelog).
- **Não** acrescentar a vitrine a `HOME_POR_ROLE`: ela não é home de perfil nenhum, e incluí-la mudaria o destino pós-login — regressão silenciosa na FEATURE-002 do MODULE-001.

### `src/layouts/showcase-layout.tsx` *(create)*
**Reference pattern**: `src/layouts/client-layout.tsx` — header claro (`bg-surface-card border-b border-hairline`), `CatDogLogo`, landmarks semânticos (`<header>`, `<main>`), `<Outlet />`.

**Diferenças em relação à referência**:
- **Sem `<nav>`**: a captura mostra o cabeçalho da vitrine sem itens de navegação.
- O layout lê `useAuth()` e ramifica em **três** estados, não dois:
  - `status === 'bootstrapping'` → **nada** à direita. Não exibir identificação de ninguém antes de saber que há sessão, e não piscar entre as duas alternativas (RN-06, CT-07).
  - `status === 'anonymous'` → "Entrar" (`ROUTE_PATHS.LOGIN`) e "Criar conta" (`ROUTE_PATHS.REGISTER`).
  - `status === 'authenticated'` → **nome** do usuário + botão "Sair".
- **`user.name`, jamais `user.email`** (RN-06, Decisão 2). A captura exibe o e-mail; esta spec adota o nome por dois motivos independentes: e-mail é dado pessoal numa página pública, passível de ser vista por terceiros sobre o ombro; e o `ClientLayout` já exibe o nome, então o e-mail aqui criaria duas identificações para o mesmo usuário na mesma aplicação. Nome ausente → **nada** no lugar; o e-mail **não** é alternativa.
- `logout()` **sem navegação**: quem sai permanece em `/animais` (RN-07, CT-08). Nenhum `navigate` neste componente — a rota é pública e expulsar quem acabou de sair de uma tela que não exige sessão é incoerente. O `logoutReason` do contexto não é lido aqui.
- O logotipo aponta para `ROUTE_PATHS.SHOWCASE`, não para `/` (HU-02 cenário 6).
- O botão "Sair" traz ícone **decorativo**: `aria-hidden="true"` no SVG e o texto "Sair" como conteúdo acessível. O leitor de tela anuncia "Sair", uma vez só (CT-09, RNF-23).
- **`status === 'anonymous'` é o caso normal desta tela, não erro.** Nada aqui pode tratar ausência de sessão como falha.
- Contraste: reaproveitar os tokens de `tailwind.config.js` (`brand.purple`, `ink.*`, `surface.*`, `hairline`, `shadow-focus-ring`). Nenhum plugin, nenhuma cor literal.

### `src/pages/showcase/showcase-page.tsx` *(create)*
- Neste slice, apenas o título `<h1>Animais para adoção</h1>` e um `// TODO(TASK-FRONTEND-010)`. Assim a rota é montável e verificável isoladamente, e a estrutura de rotas não muda de novo quando a página real chegar — é o mesmo procedimento adotado entre as TASK-FRONTEND-011 e 012 da FEATURE-002 do MODULE-001.

### `src/routes/app-routes.tsx` *(modify)*
- Um bloco novo, **fora** de `PublicOnlyRoute`, de `ProtectedRoute` e de `RoleRoute`, ao lado das rotas já públicas de `/verifique-seu-email` e `/confirmar-email`, e **antes** do catch-all `*`:

```tsx
<Route element={<ShowcaseLayout />}>
  <Route path={ROUTE_PATHS.SHOWCASE} element={<ShowcasePage />} />
</Route>
```

- Comentário obrigatório no arquivo explicando **por que** o bloco está fora das guardas e por que nenhuma das três serve. Sem ele, a próxima pessoa a ler a árvore conclui que faltou uma guarda e "corrige" — restaurando exatamente o defeito que a Decisão A eliminou.
- O bloco **não** ganha catch-all próprio: `/animais/qualquer-coisa` deve cair no `*` global e renderizar a 404, e não uma vitrine vazia. Isto difere de `/admin/*` e `/minha-area/*`, que têm catch-all **dentro** da guarda por um motivo que não se aplica aqui — lá o catch-all existe para manter a área inteira atrás da guarda.
- A ordem dos demais blocos não muda. A raiz `/` permanece dentro do `ProtectedRoute`.

### `src/layouts/client-layout.tsx` *(modify)*
- Acrescentar **um** `NavLink` para `ROUTE_PATHS.SHOWCASE` na `<nav>` já existente, com o rótulo "Animais para adoção", usando `classesDoItemDeNavegacao`. Sem ele o cliente autenticado não tem como chegar à vitrine pela aplicação (CT-116, QA-59).
- **Nada mais deste arquivo muda.** A regra central dele continua valendo: nenhum controle administrativo existe aqui, nem oculto, nem desabilitado, nem escondido por CSS — a ausência é no DOM. O item novo aponta para uma rota pública, não administrativa (CT-117, QA-60, CA-10 da FEATURE-002 do MODULE-001).
- `end` no `NavLink` de "Minha área" continua necessário para que ele não fique ativo quando a vitrine estiver.

---

## Acceptance Criteria

- [ ] **Given** nenhuma sessão e o armazenamento do navegador limpo, **When** `/animais` é aberto, **Then** a página monta e exibe o título "Animais para adoção" — **sem** redirecionamento para `/login` (CA-01, CA-02, CT-01, CT-113, QA-01).
- [ ] **Given** um usuário `admin` autenticado, **When** abre `/animais`, **Then** a página monta e **não** é redirecionado para `/admin` (CA-02, CT-04, QA-05).
- [ ] **Given** um usuário `cliente` autenticado, **When** abre `/animais`, **Then** a página monta e **não** é redirecionado para `/minha-area` (CA-02).
- [ ] **Given** `status === 'anonymous'`, **When** o cabeçalho renderiza, **Then** traz o logotipo à esquerda e "Entrar" e "Criar conta" à direita, e **nenhuma** identificação de usuário (CA-05, CT-05, QA-02).
- [ ] **Given** `status === 'authenticated'`, **When** o cabeçalho renderiza, **Then** exibe `user.name` e "Sair"; **e o e-mail do usuário não aparece em lugar nenhum do documento** (CA-05, RN-06, CT-06, QA-03).
- [ ] **Given** `status === 'bootstrapping'`, **When** o cabeçalho renderiza, **Then** nem "Entrar"/"Criar conta" nem nome/"Sair" estão no DOM (CT-07).
- [ ] **Given** um usuário autenticado em `/animais`, **When** aciona "Sair", **Then** permanece em `/animais`, o cabeçalho volta ao estado sem sessão e nenhuma navegação ocorre (CA-06, RN-07, CT-08, QA-04).
- [ ] **Given** o botão "Sair", **When** percorrido por leitor de tela, **Then** anuncia "Sair" uma única vez — o ícone é `aria-hidden` (CT-09).
- [ ] **Given** o logotipo do cabeçalho, **When** acionado, **Then** o visitante permanece em `/animais` (HU-02 cenário 6).
- [ ] **Given** `/minha-area` e `/admin/animais` sem sessão, **When** acessados, **Then** continuam redirecionando para `/login` exatamente como antes (CT-114, QA-58).
- [ ] **Given** `cliente` em rota de admin e `admin` em rota de cliente, **When** acessadas, **Then** continuam sendo redirecionados como antes (CT-115).
- [ ] **Given** a raiz `/` sem sessão, como `cliente` e como `admin`, **When** acessada, **Then** o comportamento é **idêntico** ao anterior a esta entrega (CT-118, QA-61).
- [ ] **Given** um caminho inexistente e também `/animais/algo`, **When** acessados, **Then** a 404 global renderiza — o catch-all continua alcançável após a inserção do bloco.
- [ ] **Given** um `cliente` autenticado no `ClientLayout`, **When** o DOM é inspecionado, **Then** existe um item de navegação para `/animais` **e** continua não existindo nenhum controle administrativo (CT-116, CT-117, QA-59, QA-60).
- [ ] **Given** os specs já existentes `app-routes.spec.tsx`, `role-route.spec.tsx` e `route-paths.spec.ts`, **When** executados após esta task, **Then** continuam verdes.
- [ ] **Given** `package.json`, **When** comparado ao anterior, **Then** nenhuma dependência nova (CA-55).

---

## Authorization

Nenhuma. `/animais` é pública por decisão de produto: visitante, `cliente` e `admin` veem a mesma tela. A sessão altera **apenas** o cabeçalho (RN-03). Nenhuma guarda de rota é montada sobre ela, e nenhum endpoint que ela consome exige credencial.

---

## Dependencies

- **Requires**: FEATURE-002 do MODULE-001 (`useAuth` com `status`/`user`/`logout`, `ROUTE_PATHS`, `CatDogLogo`, tokens do Tailwind, `ClientLayout`, `app-routes.tsx`).
- **Blocks**: TASK-FRONTEND-010 (a página real substitui o placeholder desta rota), TASK-FRONTEND-011.
