# TASK-FRONTEND-007 — Navegação lateral administrativa, rota `/admin/especies` e redirecionamento de `/admin`

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-007-frontend-admin-sidebar-routes`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 7 of 11 — Layout e rotas da área administrativa
**Generated**: `2026-08-25`

---

## Context

A captura de tela é a fonte da verdade do layout desta feature e mostra uma navegação **lateral** com "Animais" e "Espécies" — enquanto `admin-layout.tsx` implementa hoje uma topbar horizontal roxa com um único item, "Painel". Esta task troca o arranjo e aposenta o "Painel", o que altera um layout compartilhado e mexe no destino do redirecionamento pós-login por role entregue pela FEATURE-002. É a task de maior risco de regressão da feature (CA-01b / CT-39).

---

## Scope

**In:** Reescrita do `AdminLayout` como sidebar, novo caminho em `ROUTE_PATHS`, rota `/admin/especies` no roteador, redirecionamento de `/admin` para a primeira área administrativa disponível e a página de espécies como **casca vazia** (placeholder) para que a rota exista.

**Out:** Não implementar o conteúdo da tela de espécies — a casca criada aqui é substituída pela TASK-FRONTEND-009 e nada além do título entra nela. Não criar a tela de animais: o item de navegação "Animais" existe, mas o seu destino ainda não tem página (ver decisão abaixo). Não alterar `ClientLayout`, `AuthLayout`, `ProtectedRoute`, `PublicOnlyRoute` nem `RoleRoute`. Não alterar `homePathForRole` — o pós-login continua apontando para `/admin`. Não excluir `admin-home-page.tsx` nesta task. Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/routes/route-paths.ts` | caminhos administrativos novos |
| `modify` | `src/layouts/admin-layout.tsx` | navegação lateral |
| `modify` | `src/routes/app-routes.tsx` | rota e redirecionamento |
| `create` | `src/pages/admin/species-page.tsx` | casca da tela |
| `delete` | `src/pages/admin/admin-home-page.tsx` | item "Painel" aposentado |

---

## Implementation

> **Reference pattern**: o próprio `src/layouts/admin-layout.tsx` (uso de `NavLink`, `useAuth`, botão "Sair", landmarks reais) e `src/routes/app-routes.tsx` (hierarquia de guardas e catch-all por área).

### `src/routes/route-paths.ts` *(modify)*
- Acrescentar `ADMIN_SPECIES: '/admin/especies'` e `ADMIN_ANIMALS: '/admin/animais'` a `ROUTE_PATHS`.
- Em PT-BR por coerência com os demais caminhos de interface do produto (`/cadastro`, `/minha-area`, `/confirmar-email`). A captura mostra `/admin/species`, que seria a única exceção em inglês do conjunto — Decisão 1 do changelog. **As rotas da API continuam em inglês (`/api/species`)**; os dois vocabulários não se misturam.
- Acrescentar a constante `ADMIN_DEFAULT_PATH = ROUTE_PATHS.ADMIN_SPECIES`, com comentário: é o destino de `/admin` **enquanto a feature de animais não existir**; a feature seguinte muda esta linha, e só ela.
- `ADMIN_HOME` **permanece** `/admin` e `homePathForRole('admin')` continua devolvendo `/admin`. Alterar o valor devolvido por `homePathForRole` quebraria o `PublicOnlyRoute`, o `RoleRoute` e a tela de login de uma vez.

### `src/layouts/admin-layout.tsx` *(modify)*
- Trocar a moldura por `flex min-h-screen`: `<aside>` fixa à esquerda (largura `w-56`, `bg-brand-purple text-white`) e `<main>` ocupando o resto.
- Dentro do `<aside>`: a placa branca com o `CatDogLogo` (manter — o wordmark é `text-ink` fixo e sobre roxo reprova o WCAG; a justificativa já está no arquivo e continua valendo), o `<nav aria-label="Navegação administrativa">` em coluna, e o bloco de identidade + "Sair" empurrado para o rodapé por `mt-auto`.
- Dois `NavLink` e **apenas** dois, na ordem da captura: "Animais" → `ROUTE_PATHS.ADMIN_ANIMALS`; "Espécies" → `ROUTE_PATHS.ADMIN_SPECIES`. O item "Painel" desaparece.
- Reaproveitar `classesDoItemDeNavegacao` (o `NavLink` continua marcando `aria-current="page"` sozinho, e o anel de foco branco sobre roxo continua sendo a escolha certa) ajustando apenas as classes de largura/alinhamento para a orientação vertical. Não trocar o mecanismo de estado ativo por comparação manual de `pathname`.
- "Animais" aponta para uma rota que ainda não tem página. Renderizá-lo como `NavLink` normal é o comportamento correto e exigido pelo CA-01/CT-40 (o item precisa estar visível na navegação); o destino cai no catch-all administrativo e mostra a 404 do projeto, que é a informação honesta enquanto a feature não existe. **Não** desabilitar o item, **não** escondê-lo e **não** apontá-lo para `/admin/especies`.
- Manter `<header>`/`<nav>`/`<main>` como landmarks reais e o texto "Administrador" + nome do usuário — ele é consultado pelos testes de redirecionamento por role da FEATURE-002 (CA-10 daquela feature) e removê-lo quebraria a regressão.

### `src/routes/app-routes.tsx` *(modify)*
- Dentro do bloco `RoleRoute allow={ROLES_ADMIN}` → `Route path={ROUTE_PATHS.ADMIN_HOME} element={<AdminLayout />}`:
  - trocar o `index` de `<AdminHomePage />` por `<Navigate to={ADMIN_DEFAULT_PATH} replace />`;
  - acrescentar `<Route path="especies" element={<SpeciesPage />} />` como filha.
- O redirecionamento fica **dentro** do `AdminLayout` e do `RoleRoute`, e não solto: assim o visitante sem sessão e o `cliente` continuam sendo tratados pelas guardas antes de qualquer redirecionamento, exatamente como hoje.
- `replace` no `Navigate` é obrigatório: sem ele, o botão "voltar" do navegador devolve o usuário a `/admin`, que redireciona de novo, prendendo-o num laço.
- O catch-all `<Route path={`${ROUTE_PATHS.ADMIN_HOME}/*`} element={<NotFoundPage />} />` **permanece** e **continua depois** da rota filha — invertê-lo faria `/admin/especies` cair na 404.
- Remover o import de `AdminHomePage`.

### `src/pages/admin/species-page.tsx` *(create)*
- Casca mínima: `<h1>Espécies</h1>` e nada mais. Existe para que a rota resolva e o redirecionamento seja verificável já nesta task; o conteúdo chega na TASK-FRONTEND-009.
- O `<h1>` já é definitivo — o título "Espécies" é contrato de interface (CA-02) e não muda depois.

### `src/pages/admin/admin-home-page.tsx` *(delete)*
- Aposentada junto com o item "Painel": `/admin` deixa de renderizar página e passa a redirecionar. Manter o arquivo criaria uma página inalcançável e um falso ponto de entrada para a próxima feature.

---

## Acceptance Criteria

- [ ] **Given** sessão de `admin`, **When** `/admin/especies` é aberto, **Then** a navegação lateral exibe exatamente dois itens — "Animais" e "Espécies" — e "Espécies" tem `aria-current="page"` (CA-01 / CT-40).
- [ ] **Given** a área administrativa em qualquer rota, **When** o DOM é consultado, **Then** **não** existe nenhum item de navegação chamado "Painel".
- [ ] **Given** sessão de `admin`, **When** `/admin` é acessado, **Then** o usuário chega a `/admin/especies` com a tela renderizada — sem página em branco e sem 404 (CA-01b / CT-39 / HU-01 cenário 5).
- [ ] **Given** o redirecionamento acima, **When** o botão "voltar" do navegador é acionado, **Then** o usuário **não** volta a `/admin` (o `replace` eliminou a entrada do histórico).
- [ ] **Given** login bem-sucedido com role `admin`, **When** o redirecionamento pós-login executa, **Then** o destino continua sendo `/admin` e o usuário termina em `/admin/especies` — `homePathForRole` não foi alterada (regressão FEATURE-002).
- [ ] **Given** login bem-sucedido com role `cliente`, **When** o redirecionamento pós-login executa, **Then** o destino continua sendo `/minha-area` e o `ClientLayout` renderiza inalterado.
- [ ] **Given** sessão de `cliente`, **When** `/admin/especies` é acessado diretamente, **Then** o usuário é redirecionado para `/minha-area` e **nenhum** conteúdo administrativo aparece no DOM (CA-19 / CT-28).
- [ ] **Given** ausência de sessão, **When** `/admin/especies` é acessado, **Then** o usuário é redirecionado para `/login` (CT-29).
- [ ] **Given** sessão de `admin`, **When** `/admin/inexistente` é acessado, **Then** a `NotFoundPage` é exibida dentro da guarda administrativa — o catch-all continua funcionando.
- [ ] **Given** a área administrativa, **When** navegada apenas por teclado, **Then** os dois itens da navegação e o botão "Sair" são alcançáveis com anel de foco visível (RNF-06).
- [ ] `src/pages/admin/admin-home-page.tsx` não existe mais e nenhum arquivo o importa.
- [ ] `src/routes/protected-route.tsx`, `public-only-route.tsx` e `role-route.tsx` estão byte a byte iguais aos de antes desta task.

---

## Dependencies

- **Requires**: FEATURE-002 (roteador, guardas, layouts, `useAuth`).
- **Blocks**: TASK-FRONTEND-009 (substitui a casca `species-page.tsx`), TASK-FRONTEND-011 (testes de rota, de guarda e a regressão de redirecionamento por role).
