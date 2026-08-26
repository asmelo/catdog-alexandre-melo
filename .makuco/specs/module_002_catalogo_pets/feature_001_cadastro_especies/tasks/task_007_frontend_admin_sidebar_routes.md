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

**Out:** Não implementar o conteúdo da tela de espécies — a casca criada aqui é substituída pela TASK-FRONTEND-009 e nada além do título entra nela. Não criar a tela de animais: o item de navegação "Animais" existe, mas o seu destino ainda não tem página (ver decisão abaixo). Não alterar `ClientLayout`, `AuthLayout`, `ProtectedRoute`, `PublicOnlyRoute` nem `RoleRoute`. Não alterar `homePathForRole` — o pós-login continua apontando para `/admin`. Sem testes (TASK-FRONTEND-011).

> **EMENDA — 2026-08-26 (achado 9 da Rodada 1).** Esta seção dizia "Não excluir `admin-home-page.tsx` nesta task", contradizendo três outras seções da própria task: a tabela `Files` (`delete`), o bullet `src/pages/admin/admin-home-page.tsx` *(delete)* do `Implementation` e o penúltimo critério de aceite ("não existe mais e nenhum arquivo o importa"). **A exclusão está correta — três seções contra uma**, e a frase contrária foi removida daqui. O arquivo é aposentado junto com o item "Painel": `/admin` deixa de renderizar página e passa a redirecionar; mantê-lo criaria uma página inalcançável e um falso ponto de entrada para a próxima feature.

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
- Trocar a moldura por `flex min-h-screen`: a coluna de navegação fixa à esquerda (largura `w-56`) e `<main>` ocupando o resto.
- A coluna é **clara**: `bg-surface-card`, separada do conteúdo por `border-r border-hairline` — a mesma moldura do `client-layout.tsx`, só que na vertical. Nenhum token novo; `tailwind.config.js` não é tocado.
- Dentro da coluna: o `CatDogLogo` **direto sobre o fundo claro, sem placa**, o `<nav aria-label="Navegação administrativa">` em coluna, e o bloco de identidade + "Sair" empurrado para o rodapé por `mt-auto`.

> **EMENDA — 2026-08-26 (achado 6 da Rodada 1).** A redação anterior deste bullet pedia `<aside>` com `bg-brand-purple text-white` e mandava **manter a placa branca** sob o logo. Ela pressupunha **fundo roxo**: a placa existia só para salvar o wordmark `text-ink` fixo (`#1e1b2e` sobre `#7c3aed` rende 2.78:1 e reprova o AA), e a exceção do anel de foco branco existia só porque o `shadow-focus-ring` some sobre roxo. A captura `assets/current-state-admin-especies.png` mostra o oposto — barra **branca** com fio à direita, logo direto sobre o branco e apenas o item **ativo** numa pílula roxa. A **L13 declara a captura como fonte da verdade do layout desta feature**, e essa declaração explícita de autoridade é mais específica que a prosa deste bullet: **a captura prevalece**. Caem juntas a placa branca do logo e a exceção do anel branco (ver bullet de `classesDoItemDeNavegacao` abaixo). Sobre o fundo claro o wordmark rende 16.78:1, e o motivo que criara a placa deixou de existir.
- Dois `NavLink` e **apenas** dois, na ordem da captura: "Animais" → `ROUTE_PATHS.ADMIN_ANIMALS`; "Espécies" → `ROUTE_PATHS.ADMIN_SPECIES`. O item "Painel" desaparece.
- Reaproveitar `classesDoItemDeNavegacao` (o `NavLink` continua marcando `aria-current="page"` sozinho) ajustando as classes de largura/alinhamento para a orientação vertical **e as cores para o fundo claro**: item **ativo** = pílula `bg-brand-purple` com `text-white`; item **inativo** = sem fundo, `text-ink-mid`. O anel de foco é o **padrão da base** (`focus-visible:shadow-focus-ring focus-visible:outline-none`) — a exceção do anel branco caiu junto com o fundo roxo. Não trocar o mecanismo de estado ativo por comparação manual de `pathname`.
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

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 5 (4 alterados, 1 criado, 1 excluído)

#### Resumo

A task foi implementada por inteiro: `/admin` redireciona para `/admin/especies`, a navegação lateral traz exatamente "Animais" e "Espécies" na ordem da captura, o item "Painel" desapareceu do DOM e as guardas por role continuam byte a byte iguais. Os 12 critérios de aceite foram verificados **por execução**, não por leitura. A edição de `src/routes/app-routes.spec.tsx` — fora da tabela de arquivos — foi auditada asserção por asserção: **nenhum teste perdeu poder de detecção e nenhum caso foi removido**. Nada de `critical` nem de `major`; 2 achados `minor` e 7 `suggestion`, todos endereçados às tasks 009/011.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | minor | `src/utils/messages.ts` | L164-167 | código morto | `MESSAGES.ADMIN_HOME` (`TITLE: 'Painel administrativo'`, `GREETING`) ficou órfão: o único consumidor era `admin-home-page.tsx`, excluído aqui. `grep -rn "ADMIN_HOME" src/` confirma que sobraram apenas `ROUTE_PATHS.ADMIN_HOME` e a própria declaração. Não editar o arquivo foi a decisão certa — ele não está na tabela desta task. | Remover o bloco na TASK-FRONTEND-009, junto com a criação de `MESSAGES.SPECIES` (ver achado 2). Acrescentar o arquivo à tabela daquela task. |
| 2 | minor | `src/pages/admin/species-page.tsx` | L19 | padrão | `<h1 className="...">Espécies</h1>` grava o texto de tela no JSX, enquanto o padrão vigente centraliza títulos em `MESSAGES` — `client-home-page.tsx:25` usa `{MESSAGES.CLIENT_HOME.TITLE}` e a própria página excluída usava `{MESSAGES.ADMIN_HOME.TITLE}`. O `Implementation` desta task pediu o literal (`<h1>Espécies</h1>`), então o agente seguiu o contrato; a divergência é da task em relação ao projeto, não do agente em relação à task. | Na TASK-FRONTEND-009, ao substituir a casca, mover o título para `MESSAGES.SPECIES.TITLE` no mesmo commit que remove `MESSAGES.ADMIN_HOME`. |
| 3 | suggestion | `src/layouts/admin-layout.tsx` | L21-22 | documentação | O comentário afirma "branco sobre roxo rende 5.94:1". O valor real é **5.70:1** (`#ffffff` sobre `#7c3aed`, WCAG 2.1 relative luminance). O número já vinha errado do arquivo anterior e foi reendossado na reescrita. Não altera a conclusão — 5.70:1 passa folgadamente do mínimo de 3:1 do SC 1.4.11. | Corrigir para `5.70:1`. Sobre o item ativo (`bg-brand-purple-hover`, `#6d28d9`) o anel branco rende 7.10:1 — também pode ser citado. |
| 4 | suggestion | `src/routes/app-routes.spec.tsx` | L145 | teste | O vazamento da navegação administrativa na área do cliente passou a ser verificado só por `queryByRole('link', { name: 'Espécies' })`; o item "Animais" não é nomeado. Não é perda de cobertura: o laço de L147-149 (`href` de nenhum link contém `/admin`) captura `/admin/animais`. | Na TASK-FRONTEND-011, nomear os dois itens explicitamente, por simetria com a navegação de dois itens. |
| 5 | suggestion | `src/layouts/admin-layout.tsx` | L80-85 | comportamento | Os dois `NavLink` não levam `end` — o link "Painel" anterior levava, porque `/admin` é prefixo de tudo. Hoje é inofensivo (verificado: `aria-current` só em "Espécies" na rota de espécies) e será desejável quando a TASK-FRONTEND-010 abrir estados aninhados. Mudança não declarada no plano, sem impacto. | Nenhuma ação. Registrado para que a TASK-010 não a leia como esquecimento. |
| 6 | suggestion | `src/layouts/admin-layout.tsx` | L74 | design | A barra lateral é integralmente roxa (`bg-brand-purple text-white`), como o `Implementation` mandou. A captura em `assets/current-state-admin-especies.png` mostra uma barra **branca** com o item ativo numa pílula roxa — e é ela a fonte da verdade declarada do layout. O agente seguiu o texto da task, que é o contrato; a divergência é entre a task e a captura. | Confirmar com o produto antes de a TASK-FRONTEND-009 fechar a tela. Se a captura vencer, cai junto a placa branca do logo e a exceção do anel de foco branco (achado 3) — as duas existem por causa do fundo roxo. |
| 7 | suggestion | `src/layouts/admin-layout.tsx` | L73-74 | design | "`<aside>` **fixa** à esquerda" foi cumprido como coluna flex de `w-56`, não como `position: fixed/sticky`: a barra rola junto com a página. Com a lista de espécies longa (TASK-009), a navegação sai da tela. | Avaliar `sticky top-0 h-screen` na TASK-FRONTEND-009, quando existir conteúdo alto o bastante para o efeito aparecer. |
| 8 | suggestion | `src/layouts/admin-layout.tsx` | L115 | design | O `<main>` perdeu `mx-auto max-w-5xl` (agora `w-full flex-1`): o conteúdo passa a ocupar toda a largura restante. Consequência natural do arranjo lateral e não proibida pela task, mas é uma mudança de moldura que a task não menciona. | Decidir a largura do conteúdo na TASK-FRONTEND-009, que constrói a tela real. |
| 9 | suggestion | (arquivo desta task) | seção `Implementation` | contrato | Contradição interna **confirmada**: o bullet 1 pede "`<aside>` fixa à esquerda" e o bullet 2 "Dentro do `<aside>`", enquanto o bullet 6 pede "Manter `<header>`/`<nav>`/`<main>` como landmarks reais". Também há contradição entre `Scope — Out` ("Não excluir `admin-home-page.tsx` nesta task") e a tabela `Files` (`delete`), o `Implementation` e o penúltimo critério de aceite ("não existe mais"). | Emendar o texto da task para que a próxima leitura não relitigue as duas escolhas. A exclusão do arquivo está certa: três seções contra uma. |

#### Auditoria da edição fora de escopo — `src/routes/app-routes.spec.tsx`

O arquivo **não** consta da tabela `Files`. A alegação de que o gate não fecharia sem ele procede: as 6 asserções quebradas afirmavam exatamente o comportamento que esta task aposenta. A questão que importa não é *se* podia editar, é *se enfraqueceu*. Não enfraqueceu.

**Prova de que nada foi removido** (contagem independente do diff, `HEAD` vs. árvore de trabalho):

| Métrica | Antes | Depois |
|---|---|---|
| Casos (`it(`) | 29 | **29** |
| Blocos (`describe(`) | 5 | **5** |
| Asserções (`expect(`) | 53 | **53** |
| Linhas | 349 | 354 |

As 18 remoções são 6 asserções + 4 títulos + 4 linhas de um comentário + 4 asserções restantes — **zero linhas `it(`**, zero `expect(` líquidos. As 23 inserções cobrem as mesmas 18 linhas mais 5 linhas líquidas de comentário. As paridades 29/29 e 53/53 fecham a questão: nenhum caso e nenhuma asserção foram suprimidos.

**Veredicto por asserção alterada:**

| Linha | Antes → Depois | Poder de detecção |
|---|---|---|
| L70 | título "ve o painel" → "cai na primeira area administrativa" | **Inalterado.** Só título; o antigo passou a mentir. |
| L77 | `rotaAtual() === ADMIN_HOME` → `=== ADMIN_SPECIES` | **Aumentado.** Antes bastava não redirecionar; agora exige que o `Navigate` exista e aponte para o caminho certo. Falha se o `index` voltar a renderizar página. |
| L78 | `heading level 1` "Painel administrativo" → "Espécies" | **Inalterado.** Continua `getByRole` (não `queryBy`), logo continua sendo o guarda de `<h1>` **único** por página — falha com 0 ou 2+ `h1`. Só mudou o texto esperado. |
| L83 | `getByText('Você está autenticado como administrador, {nome}.')` → `getByText(USUARIO_ADMIN.name)` | **Preservado.** A frase antiga vinha de `admin-home-page.tsx`, que deixou de existir — não havia como mantê-la. A propriedade guardada ("o que se vê é a sessão de quem autenticou, não uma tela estática") migrou para o `{user.name}` do layout, que vem de `useAuth()`. Não é técnica nova: L211 (**intocada**) já usava `queryByText(USUARIO_ADMIN.name)` para afirmar a ausência do nome quando `user` é `null`. O par L83/L211 ficou mais coerente do que era. Falha se o layout trocar o nome por constante ou soltar o `<span>`. |
| L92 | `link 'Painel'` tem `aria-current` → `link 'Espécies'` | **Aumentado.** O teste monta em `/admin`; a asserção agora só passa depois do redirecionamento, cobrindo-o de graça. |
| L145 | `queryByRole('link', 'Painel')` nulo → `'Espécies'` | **Restaurado.** "Painel" não existe mais em lugar nenhum: a asserção antiga tinha virado **vacuamente verdadeira** e passaria mesmo com a navegação administrativa inteira vazando na área do cliente. Trocar pelo nome vivo devolve o poder que a asserção tinha. Ver achado 4 para o resíduo de "Animais". |
| L156 | `queryByText('Painel administrativo')` nulo → `'Espécies'` | **Restaurado.** Mesmo raciocínio: o título antigo morreu com a página; a asserção antiga não podia mais falhar. |
| L161 | título "devolvido ao painel" → "devolvido a area administrativa" | **Inalterado.** Só título. |
| L166 | `rotaAtual() === ADMIN_HOME` → `=== ADMIN_SPECIES` | **Preservado.** Observa o fim de uma cadeia de dois saltos (`RoleRoute` → `/admin` → `/admin/especies`) em vez do primeiro. Continua falhando se a guarda parar de devolver o admin (o resultado seria `/minha-area`). A invariante "`homePathForRole('admin') === '/admin'`" não ficou desguarnecida: `route-paths.spec.ts:21` e `:28` a afirmam diretamente e **não** foram tocados. |
| L180-186 | comentário sobre o item inativo reescrito | **Inalterado.** A premissa antiga ("cada layout tem uma única rota filha, o `NavLink` está sempre ativo") ficou falsa com dois itens; a nova é verdadeira. Nenhuma asserção envolvida. |
| L192 | `link 'Painel'` sem `aria-current` → `'Espécies'` | **Inalterado.** Mesma montagem (`/admin/outra-tela`), mesma asserção negativa, item vivo no lugar do morto. |
| L235 | `rotaAtual() === ADMIN_HOME` → `=== ADMIN_SPECIES` | **Preservado.** `PublicOnlyRoute`: mesma cadeia de dois saltos, mesma detecção de guarda quebrada. |
| L269/L271 | título + `rotaAtual()` da raiz | **Preservado.** Idem. |
| L299 | `queryByText('Painel administrativo')` nulo → `'Espécies'` | **Restaurado.** Teste de `bootstrapping` em `/admin`: a asserção antiga era vacuamente verdadeira; a nova aponta para texto vivo. A asserção vizinha de L297 (`rotaAtual() === ADMIN_HOME`, provando que **não** há redirecionamento durante o bootstrap) permaneceu intocada — e é ela que garante que o `Navigate` não atropela o splash. |

**Conclusão da auditoria**: 4 asserções ganharam poder, 6 mantiveram, 4 tiveram poder **restaurado** (estavam vacuamente verdadeiras), 4 linhas eram título e 4 eram comentário. **Nenhuma regressão silenciosa de cobertura.** A edição fora de escopo fica registrada como desvio da tabela `Files` — sem severidade, porque a alternativa (deixar o gate vermelho) seria pior e nenhuma outra task cobria esses arquivos antes da TASK-FRONTEND-011.

#### Verificação por execução

Sonda temporária montando `<App />` sob o harness de sessão, executada e **removida** ao fim (`src/routes/zz-probe-review-007.spec.tsx` não existe mais; `git status` limpo fora dos 5 arquivos da task):

| Verificação | Resultado |
|---|---|
| `/admin` → `/admin/especies`, com `<h1>Espécies</h1>` renderizado | PASSOU |
| `<h1>` único na árvore administrativa (`getAllByRole('heading', {level:1})` = 1) | PASSOU |
| `/admin/animais` → 404 administrativa ("Página não encontrada"), fora do `AdminLayout` | PASSOU (armadilha conhecida, não é achado) |
| Escape da 404: o link de retorno aponta para `/admin`, que redireciona — o admin não fica preso | PASSOU |
| `/admin/especies` **não** cai no catch-all | PASSOU |
| Navegação com exatamente 2 itens, ordem `['Animais','Espécies']`, `href` `['/admin/animais','/admin/especies']` | PASSOU |
| Nenhuma ocorrência da string "Painel" no DOM administrativo | PASSOU |
| `aria-current="page"` só em "Espécies" em `/admin/especies`; "Animais" sem o atributo | PASSOU |
| Landmarks: `banner` = 1, `main` = 1, `navigation` nomeada "Navegação administrativa" = 1, `complementary` = 0 | PASSOU |
| Cliente em `/admin/especies` → `/minha-area`, sem "Administrador" nem "Espécies" no DOM (CA-19/CT-28) | PASSOU |
| Visitante em `/admin/especies` → `/login` (CT-29) | PASSOU |
| Admin em `/minha-area` → `/admin/especies` | PASSOU |
| `/admin/inexistente` → 404 dentro da guarda | PASSOU |
| Ordem de tabulação `['Animais','Espécies','Sair']`, os três com `focus-visible:outline-white` | PASSOU (RNF-06) |
| `replace`: pilha `['/admin/inexistente','/admin']`, `navigate(-1)` devolve a `/admin/inexistente` e **não** a `/admin` | PASSOU |

Gates: `npm run typecheck` → exit **0**. `npx jest` → **160 passaram, 0 falharam** (baseline intacta).

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12** critérios implementados, todos confirmados por execução (tabela acima). `homePathForRole` intocada; `ADMIN_HOME` continua `/admin`; `admin-home-page.tsx` excluído e sem nenhum importador (`grep -rn "admin-home-page\|AdminHomePage" src/ tests/` → vazio); `protected-route.tsx`, `public-only-route.tsx` e `role-route.tsx` com `git diff HEAD --stat` **vazio**. Sem achados.

**Pass 2 — Diff Analysis**: os 5 arquivos da tabela foram tocados como indicado. **Um arquivo fora da tabela** foi editado — `src/routes/app-routes.spec.tsx` — auditado por inteiro na seção acima e liberado. Nada mais fora de escopo: `http-client.ts`, `client-layout.tsx`, `auth-layout.tsx`, `src/components/ui/*` (primitivas da TASK-FRONTEND-006), `package.json`, `package-lock.json` e `tailwind.config.js` com diff **vazio** — nenhuma dependência nova, nenhum token novo. Sem formatação em massa. Achado: 9 (contradições no texto da própria task).

**Pass 3 — Code Practices**: `admin-layout.tsx` com 120 linhas (< 150) e uma responsabilidade; `classesDoItemDeNavegacao` com um nível de indentação, sem `else`, e nome idêntico ao de `client-layout.tsx:14` — simetria preservada. `species-page.tsx` é função pura de 3 linhas. Retornos explícitos (`: ReactElement`, `: string`) em toda parte, `import type` correto, alias `~/` em todos os imports. **Zero `any`** nos cinco arquivos. `ADMIN_DEFAULT_PATH` sem anotação está **correto**: `ROUTE_PATHS` é `as const`, então o tipo inferido é o literal `'/admin/especies'`; anotar `: string` alargaria o tipo e perderia informação, e nenhuma outra constante exportada do arquivo é anotada. Comentários explicam o *porquê* (redirecionamento dentro da guarda, `replace` obrigatório, exceção do anel de foco) e não o *quê*. Achados: 2, 5, 8.

**Pass 4 — Testing Review**: a task exclui testes do escopo ("Sem testes — TASK-FRONTEND-011"), então não há suíte nova a avaliar. A edição da suíte existente foi auditada asserção por asserção e não enfraqueceu nada. Estrutura AAA, nomes descritivos e ausência de lógica nos corpos foram mantidos nas linhas tocadas; nenhum estado mutável compartilhado foi introduzido. **Comportamento novo ainda sem teste próprio**, a ser coberto pela TASK-FRONTEND-011: (a) navegação com exatamente dois itens, na ordem da captura; (b) `href` de "Animais" apontando para `/admin/animais`; (c) valor de `ADMIN_DEFAULT_PATH`; (d) `/admin/especies` não caindo no catch-all; (e) o `replace` do `Navigate` observado pelo "voltar". Os cinco foram verificados por sonda nesta revisão e passam — a lacuna é de suíte permanente, não de comportamento. Achado: 4.

**Pass 5 — Security Review**: OWASP Top 10 aplicado aos arquivos alterados e aos que deles dependem. **Nenhum achado.** A mudança é de roteamento e apresentação: não cruza fronteira de confiança, não constrói consulta, não trata entrada do usuário, não toca `http-client.ts` nem qualquer chamada de API. A01 — as guardas de acesso (`ProtectedRoute`/`RoleRoute`) estão byte a byte iguais e continuam **antes** do `Navigate` na hierarquia, verificado por execução (cliente e visitante barrados em `/admin/especies`); a autorização real permanece no servidor e não foi alterada. A02/A05 — sem segredos, sem configuração nova. A06 — sem dependência nova (`package-lock.json` sem diff). O `<Link>` da `NotFoundPage`, agora alcançável por clique em "Animais", usa `homePathForRole` sobre constantes de `ROUTE_PATHS` e nunca valor vindo da URL — segue fora do alcance da advisory de open redirect do `react-router` (GHSA-wrjc-x8rr-h8h6).

**Pass 6 — Bug Detection**: leitura integral dos cinco arquivos. `user !== null` explícito antes de `{user.name}`, sem `!` nem `?.` (o teste de L203-212 cobre `user: null` e continua verde). Sem `==`, sem laço, sem índice, sem recurso a liberar, sem `catch` vazio; `void logout()` mantido com a justificativa original. Laço de redirecionamento descartado por execução: o `replace` remove `/admin` do histórico e o "voltar" devolve à entrada anterior. Ordem das rotas verificada: a filha `especies` precede o catch-all `/admin/*`, e inverter faria `/admin/especies` cair na 404 — não está invertida. **Nenhum bug encontrado.**

**Pass 7 — Project Patterns**: nomes de arquivo em kebab-case (`species-page.tsx`), componentes em PascalCase, `SpeciesPage` sob `src/pages/admin/` conforme `structure.md`. Linguagem ubíqua respeitada: o domínio fala inglês no código (`SpeciesPage`, `ADMIN_SPECIES`, `ADMIN_ANIMALS`, `ADMIN_DEFAULT_PATH`) e a URL de interface fala PT-BR (`/admin/especies`), exatamente a separação da Decisão 1 do changelog — sem misturar com `/api/species`. `end`/`aria-current` continuam vindo do roteador, sem comparação manual de `pathname`. Comentários **sem acento** e texto de tela **com acento** nos quatro arquivos, verificado por varredura. Achados: 1, 2, 3, 6, 7.

#### Veredicto

> **APROVADA** — 12 de 12 critérios de aceite implementados e verificados por execução; `typecheck` exit 0 e 160/160 testes verdes; guardas por role byte a byte iguais; **nenhum achado `critical` ou `major`**.
>
> A edição de `src/routes/app-routes.spec.tsx` (fora da tabela `Files`) foi auditada linha a linha: 29 casos e 53 asserções antes e depois, nenhum caso removido, **nenhuma asserção enfraquecida** — 4 ganharam poder de detecção, 4 tiveram poder restaurado de um estado vacuamente verdadeiro.
>
> Os 2 achados `minor` (1 — `MESSAGES.ADMIN_HOME` órfão; 2 — título hardcoded) e os 7 `suggestion` **não bloqueiam** o fechamento desta task e ficam endereçados às TASK-FRONTEND-009 e TASK-FRONTEND-011. Os achados 6 e 9 pedem decisão humana (cor da barra lateral × captura; emenda das contradições internas do texto da task) e não têm correção de código atribuída ao `makuco-codegen`.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 1 arquivo de código alterado nesta rodada (`src/layouts/admin-layout.tsx`) + reverificação dos 5 arquivos da tabela `Files` e do texto emendado da task

#### Resumo

A correção visual foi conferida contra a captura pelo próprio revisor — imagem aberta, pixels amostrados, contrastes recalculados por execução — e **bate**: barra `#ffffff` com fio à direita, logo direto sobre o branco sem placa, "Animais" inativo em texto escuro sem fundo, "Espécies" ativo em pílula roxa com texto branco. As três medições declaradas pelo agente conferem ao centésimo. As duas ressalvas que ele registrou como dívida herdada **são de fato herdadas** — a alegação foi checada no código real, arquivo por arquivo. Nada regrediu: 12/12 critérios de aceite continuam válidos por execução, `app-routes.spec.tsx` não sofreu nova edição (29 `it` / 53 `expect` / 354 linhas, idênticos à auditoria da rodada 1) e o escopo permanece fechado. **0 `critical`, 0 `major`**; 6 achados `suggestion`, todos endereçados às TASK-FRONTEND-009 e 011.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 10 | suggestion | `src/layouts/admin-layout.tsx` + (texto desta task) | L56 / EMENDA achado 6 | documentação | O valor **`2.78:1`** para `#1e1b2e` sobre `#7c3aed` está errado: o cálculo WCAG 2.1 dá **2.93:1**. O número é **pré-existente** (`HEAD:admin-layout.tsx` L38) e foi carregado para o comentário novo **e para o texto da emenda**. A conclusão não muda — 2.93:1 continua reprovando o AA (4.5:1) e o motivo da placa continua válido. É a única afirmação factualmente errada que as emendas introduziram. | Corrigir para `2.93:1` nos dois lugares na TASK-FRONTEND-009. Registro positivo: a rodada 1 apontou `5.94:1` (real 5.70:1) e `15.74:1` (real 16.78:1) e **os dois foram corrigidos** nesta rodada. |
| 11 | suggestion | `src/layouts/admin-layout.tsx` | L87 | design | O fundo do conteúdo é `bg-surface-canvas` = **`#dde0ea`**, um cinza-azulado nítido; a captura mostra **`#fafafc`** (amostrado em três pontos do painel direito), quase branco. Contra a barra branca isso rende 1.32:1 na implementação e ~1.02:1 na captura — por isso a captura **precisa** do fio divisor e a implementação, não. É divergência real da fonte da verdade declarada, mas o token vem do `--bg` do `reference.html` e é o mesmo do `client-layout.tsx:38`: trocá-lo aqui divergiria da área do cliente, e trocá-lo no tema afeta todas as telas. Fora do alcance desta task, que não menciona o fundo do `<main>`. | Decidir na TASK-FRONTEND-009, quando a tela real existir. Se a captura vencer de novo, é token novo (ou reuso de `surface-card`), e a decisão pertence ao design system — não ao layout. |
| 12 | suggestion | `src/layouts/admin-layout.tsx` | L92-97 | design | A captura mostra um **ícone à esquerda de cada rótulo** (pegada em "Animais", etiqueta em "Espécies") — confirmado no recorte ampliado. A implementação vai sem ícone. A justificativa do agente confere: `~/components/ui/icons.tsx` entrega apenas `PencilIcon` e `TrashIcon` (TASK-FRONTEND-006) e nenhum dos dois representa animal ou espécie; desenhar primitiva de interface fora da task que a governa seria o desvio maior. Decisão correta. | A TASK-FRONTEND-009/011 herda "**sem ícones**" como estado atual. Se o produto quiser os ícones da captura, é task própria sobre `icons.tsx`, não emenda de layout. |
| 13 | suggestion | `src/layouts/admin-layout.tsx` | L88-91 | design | A captura mostra um **fio horizontal sob o bloco da marca**, separando o logo da navegação. A implementação usa só `gap-6`, sem régua. Puramente cosmético e não citado por nenhum critério de aceite. | Avaliar na TASK-FRONTEND-009 junto com o resto da moldura. |
| 14 | suggestion | `src/layouts/admin-layout.tsx` | L100-122 | design | A captura **não mostra** o bloco de identidade ("Administrador" + nome) nem o botão "Sair" no rodapé da barra — o círculo escuro com "N" no canto inferior é overlay do navegador, não da aplicação. A implementação os mantém, e **está certa**: o `Implementation` manda manter explicitamente e o texto é consultado pelo CA-10 da FEATURE-002. Aqui a prosa da task vence a captura porque a captura é fonte da verdade **do layout**, não do inventário de controles, e há critério de aceite dependente. | Nenhuma ação. Registrado para que a TASK-009 não leia a ausência na captura como pedido de remoção — removê-los quebra a regressão da FEATURE-002. |
| 15 | suggestion | `src/layouts/admin-layout.tsx` | L88 | design | O fio da coluna é `border-hairline` = `#8e87b5` (3.34:1 sobre branco); na captura o divisor é `~#f1f1f1` (~1.06:1), muito mais leve. A implementação é **mais pesada** que a captura de propósito: `hairline` foi escurecido por acessibilidade em decisão documentada no `tailwind.config.js` (L37-55), e usar o valor da captura reprovaria o SC 1.4.11. Divergência correta. | Nenhuma ação. |

> Os achados **1, 2, 4, 5, 7 e 8** da rodada 1 seguem abertos e endereçados às TASK-FRONTEND-009 e 011. O achado **3** (5.94:1 → 5.70:1) foi **corrigido** nesta rodada. Os achados **6** (cor da barra) e **9** (contradições internas do texto) foram **resolvidos** — o 6 pela correção de código, o 9 pelas duas emendas.

#### Conferência da captura — feita pelo revisor, não herdada

Imagem aberta e pixels amostrados em `assets/current-state-admin-especies.png` (1023×511):

| Elemento | Captura (amostrado) | Implementação | Bate? |
|---|---|---|---|
| Fundo da barra lateral | `#ffffff` (x=20/70, y=50..300) | `bg-surface-card` = `#ffffff` | **Sim** |
| Fio à direita da barra | presente em x≈145 (`#f1f1f1`) | `border-r border-hairline` | **Sim** (peso difere — achado 15) |
| Logo sobre a barra | ícone laranja + wordmark escuro, **sem placa** | `<CatDogLogo size={28} />` direto no `<header>` | **Sim** |
| Item inativo "Animais" | texto escuro, **sem fundo** | `text-ink-mid`, sem `bg` | **Sim** |
| Item ativo "Espécies" | **pílula roxa** preenchida, texto branco, cantos ~`rounded-field` | `bg-brand-purple text-white rounded-field` | **Sim** |
| Sublinhado no item ativo | **ausente** | `underline` removido; ativo marcado por pílula + `aria-current` | **Sim** (igual ao `ClientLayout`) |
| Ordem dos itens | "Animais" acima de "Espécies" | idem | **Sim** |
| Fundo do conteúdo | `#fafafc` | `#dde0ea` | **Não** — achado 11 |
| Ícones nos itens | pegada + etiqueta | ausentes | **Não** — achado 12 |
| Fio sob a marca | presente | ausente | **Não** — achado 13 |
| Identidade + "Sair" no rodapé | ausentes | presentes | **Não, e correto** — achado 14 |

#### Medições de contraste — recalculadas por execução (WCAG 2.1 relative luminance)

| Par | Alegado | **Medido** | Veredicto |
|---|---|---|---|
| `ink-mid` `#4b4869` sobre a barra branca (item inativo) | 8.64:1 | **8.64:1** | **Confere.** Passa AA (4.5:1) com folga. |
| Branco sobre `brand-purple` `#7c3aed` (pílula ativa) | 5.70:1 | **5.70:1** | **Confere.** Passa AA. |
| Anel de foco (roxo a 80% composto sobre branco) × barra branca | 3.98:1 | **3.97:1** | **Confere** (arredondamento). Passa o SC 1.4.11 (3:1). |

Contexto medido além do declarado: wordmark `ink` sobre branco **16.78:1** (era 2.93:1 sobre o roxo — o motivo da placa de fato desapareceu); branco sobre `purple-hover` `#6d28d9` **7.10:1**; `brand-purple` sobre `purple-light` no hover do inativo **4.80:1**; pílula roxa × barra branca **5.70:1** (o item ativo é distinguível por forma **e** por contraste, não só por cor).

#### Julgamento das duas ressalvas — alegação de herança verificada no código

**Ressalva A — anel de foco a 1.44:1 contra a pílula roxa por dentro.** Medição confirmada (o agente reportou 1.43:1; arredondamento). Alegação de herança **procede**: `shadow-focus-ring` é `0 0 0 3px rgba(124,58,237,.80)`, sombra de *spread* desenhada **fora** da caixa, e o mesmo par anel-sobre-roxo já existe, com `git diff HEAD` **vazio** em todos, em `client-layout.tsx:59` (botão "Sair"), `not-found-page.tsx:70`, `check-email-page.tsx:10`, `confirm-email-page.tsx:34` e `components/ui/submit-button.tsx:28` — o próprio botão "Sair" do `AdminLayout` já o trazia antes desta task. Acrescente-se que a fronteira que governa o SC 1.4.11 é a **externa**, contra a barra branca, e essa rende **3.97:1** — passa. A borda interna só entraria em jogo sob o SC 2.4.13 (AAA), fora da meta do projeto. **Dívida do design system, não achado desta task.**

**Ressalva B — tinta de hover `brand-purple-light` a 1.19:1 contra o branco.** Medição confirmada. Alegação de herança **procede**: `hover:bg-brand-purple-light` sobre superfície branca já existe, com diff **vazio**, em `client-layout.tsx:16` (item de navegação do cliente — o par simétrico exato), `login-page.tsx:30`, `components/ui/icon-button.tsx:41` e `components/ui/feedback-states.tsx:102`. E o hover não é o único sinal: o rótulo muda junto para `text-brand-purple`, que rende **4.80:1** sobre a própria tinta — o estado é perceptível por texto, não apenas por fundo. **Dívida do design system, não achado desta task.**

#### Verificação por execução

Sonda temporária montando `<App />` sob o harness de sessão, executada e **removida** (`src/routes/zz-probe-review-r2.spec.tsx` não existe mais; `git status` limpo fora dos arquivos da task) — **18/18 passaram**:

| Verificação | Resultado |
|---|---|
| `/admin` → `/admin/especies`, `<h1>Espécies</h1>` renderizado e `<h1>` **único** na árvore | PASSOU |
| `ADMIN_DEFAULT_PATH`, `ADMIN_HOME`, `ADMIN_ANIMALS` e `homePathForRole` (admin e cliente) com os valores do contrato | PASSOU |
| Navegação com **exatamente 2** itens, ordem `['Animais','Espécies']`, `href` `['/admin/animais','/admin/especies']` | PASSOU |
| `aria-current="page"` só em "Espécies"; "Animais" sem o atributo; string "Painel" ausente do DOM | PASSOU |
| Landmarks: `banner`=1, `main`=1, `navigation` nomeada=1, `complementary`=**0** | PASSOU |
| Barra com `bg-surface-card` + `border-r border-hairline`; "Administrador", nome do usuário e botão "Sair" dentro do `banner` | PASSOU |
| Ativo com `bg-brand-purple`+`text-white` e **sem `underline`**; inativo `text-ink-mid` sem fundo; ambos com `focus-visible:shadow-focus-ring`; **nenhum `outline-white` no DOM** | PASSOU |
| Logo filho direto do `<header>` — sem placa intermediária | PASSOU |
| `/admin/animais` → 404 administrativa, fora do `AdminLayout` | PASSOU (decisão transitória, não é achado) |
| `/admin/especies` **não** cai no catch-all | PASSOU |
| `/admin/inexistente` → 404 dentro da guarda | PASSOU |
| Cliente em `/admin/especies` → `/minha-area`, sem "Administrador", "Espécies" ou "Animais" no DOM (CA-19/CT-28) | PASSOU |
| Visitante em `/admin/especies` → `/login` (CT-29) | PASSOU |
| Admin na raiz → `/admin/especies`; cliente na raiz → `/minha-area` com `ClientLayout` intacto | PASSOU |
| Ordem de tabulação `['Animais','Espécies','Sair']` (RNF-06) | PASSOU |
| `admin-home-page` não resolve como módulo | PASSOU |

**Gates**: `tsc --noEmit` → **exit 0, zero erros**. `npx jest` → **12 suítes, 160 testes, 160 passaram, 0 falharam** — baseline idêntica à da rodada 1, nenhum teste precisou de ajuste.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12** critérios de aceite reverificados por execução após a correção; nenhum regrediu. As emendas não criaram critério novo nem revogaram nenhum. Sem achados.

**Pass 2 — Diff Analysis**: apenas `src/layouts/admin-layout.tsx` mudou nesta rodada (90 inserções / 53 remoções). `src/routes/app-routes.spec.tsx` **não sofreu nova edição** — 23/18 no `numstat`, 29 `it(`, 53 `expect(`, 5 `describe(` e 354 linhas, exatamente os números auditados na rodada 1 (`HEAD`: 29/53/5/349). Escopo fechado, com `git diff HEAD` **vazio** em `tailwind.config.js`, `package.json`, `package-lock.json`, `services/api/http-client.ts`, `src/components/` inteiro, `protected-route.tsx`, `public-only-route.tsx`, `role-route.tsx`, `client-layout.tsx`, `auth-layout.tsx`, `utils/messages.ts` e `src/pages/auth/`. **Nenhum token novo, nenhuma dependência nova.** Sem formatação em massa. Sem achados.

**Pass 3 — Code Practices**: `admin-layout.tsx` com 130 linhas (< 150) e responsabilidade única. `classesDoItemDeNavegacao` continua com um nível de indentação, sem `else` (ternário de retorno único), sem número mágico e com o mesmo nome do par em `client-layout.tsx:14` — a simetria entre os dois layouts foi **preservada e reforçada** pela correção, já que agora ambos partem de superfície clara. Tipos de retorno explícitos, `import type`, alias `~/`, zero `any`. O comentário novo explica o **porquê** (por que a captura venceu, por que a placa caiu, por que o anel voltou ao padrão, por que não há ícones) e não o **quê**. Sem achados.

**Pass 4 — Testing Review**: a task exclui testes do escopo. A suíte existente não foi tocada nesta rodada e segue verde em 160/160 — a correção é puramente de classes de apresentação e nenhuma asserção dependia das cores antigas, o que é por si um sinal de que a suíte testa comportamento e não estilo. As lacunas de suíte permanente listadas na rodada 1 (dois itens de navegação, `href` de "Animais", `ADMIN_DEFAULT_PATH`, `/admin/especies` fora do catch-all, o `replace`) continuam endereçadas à TASK-FRONTEND-011 — as cinco foram reverificadas por sonda aqui e passam. Sem achados novos.

**Pass 5 — Security Review**: OWASP Top 10 reaplicado. **Nenhum achado.** A correção mexe exclusivamente em strings de classe CSS e na estrutura de um `<header>`: não cruza fronteira de confiança, não constrói consulta, não trata entrada, não toca `http-client.ts` nem chamada de API. A01 — as três guardas seguem com diff **vazio** e continuam **antes** do `Navigate` na hierarquia, reconfirmado por execução (cliente e visitante barrados em `/admin/especies`). A02/A05 — sem segredo, sem configuração. A06 — `package-lock.json` sem diff, nenhuma dependência introduzida.

**Pass 6 — Bug Detection**: leitura integral do arquivo alterado e dos que dele dependem. O guarda `user !== null` antes de `{user.name}` permanece, sem `!` e sem `?.`. Sem `==`, sem laço, sem índice, sem recurso a liberar, sem `catch` vazio; o `void logout()` mantém a justificativa original. Uma armadilha específica do Tailwind foi **corretamente evitada e documentada** (L26-29): as ramificações ativa e inativa não compartilham utilitários de `hover`, porque a cascata resolveria `hover:text-white` × `hover:text-brand-purple` pela ordem da folha gerada e não pela ordem da string — empilhar os dois daria um vencedor que o arquivo não controla. **Nenhum bug encontrado.**

**Pass 7 — Project Patterns**: a moldura clara `bg-surface-card` + `border-hairline` é literalmente a do `client-layout.tsx`, agora na vertical — a correção **aproximou** o layout administrativo do padrão do projeto em vez de afastá-lo. Nenhum token fora de `tailwind.config.js`, nenhuma cor literal fora do SVG do logo. Linguagem ubíqua intacta: domínio em inglês no código (`SpeciesPage`, `ADMIN_SPECIES`, `ADMIN_ANIMALS`), URL de interface em PT-BR (`/admin/especies`), sem mistura com `/api/species`. Comentários sem acento e texto de tela com acento, conforme a convenção. Achados: 10, 11, 12, 13, 15.

#### O que a TASK-FRONTEND-009 e a TASK-FRONTEND-011 herdam

**TASK-FRONTEND-009 (fecha a tela de espécies)** — cinco decisões desta task chegam abertas ou fixadas:

1. **Fundo do `<main>`**: fica em `surface-canvas` `#dde0ea`; a captura mostra `#fafafc`. **Decisão pendente e é da 009** (achado 11). O token é compartilhado com o `ClientLayout` — mudá-lo não é edição de layout, é mudança de design system, e exige incluir `tailwind.config.js` na tabela `Files` daquela task.
2. **Sem ícones nos itens de navegação** (achado 12): estado atual e deliberado, porque `icons.tsx` só tem `PencilIcon`/`TrashIcon`. A 009 herda "sem ícones" — não é esquecimento a corrigir de passagem. Querer os ícones da captura é task própria sobre a primitiva.
3. **Identidade + "Sair" continuam na barra** (achado 14): a captura não os mostra, mas o CA-10 da FEATURE-002 depende deles. **Não remover.**
4. **Largura e ancoragem do conteúdo**: o `<main>` perdeu `mx-auto max-w-5xl` (rodada 1, achado 8) e a barra não é `sticky` (achado 7). Com a lista de espécies real, os dois efeitos finalmente aparecem — é na 009 que se decidem.
5. **Título e mensagens**: mover `Espécies` para `MESSAGES.SPECIES.TITLE` e remover o `MESSAGES.ADMIN_HOME` órfão no mesmo commit (rodada 1, achados 1 e 2), acrescentando `src/utils/messages.ts` à tabela `Files`. Corrigir de passagem o `2.78:1` → `2.93:1` do achado 10.

**TASK-FRONTEND-011 (suíte de testes)** — herda cinco comportamentos hoje sem teste permanente, todos verdes por sonda: navegação com **exatamente dois** itens na ordem da captura; `href` de "Animais" apontando para `/admin/animais`; valor de `ADMIN_DEFAULT_PATH`; `/admin/especies` **não** caindo no catch-all; e o `replace` do `Navigate` observado pelo "voltar". Some-se a simetria pedida no achado 4 da rodada 1 (nomear os **dois** itens na asserção de não-vazamento na área do cliente). **Não** testar classes de cor: o par ativo/inativo é decisão de design ainda em movimento (achados 11 a 13) e uma asserção sobre `bg-brand-purple` transformaria a próxima decisão de produto em teste vermelho — teste o `aria-current` e o `href`, que são contrato.

#### Veredicto

> **APROVADA** — a correção visual bate com a captura nos quatro pontos que a rodada 1 pôs em jogo (barra branca, logo sem placa, inativo em texto escuro, ativo em pílula roxa), conferidos pelo revisor na própria imagem. As três medições de contraste declaradas **conferem por execução** (8.64:1, 5.70:1, 3.97:1) e todas passam os limiares aplicáveis. As duas ressalvas de contraste são **dívida herdada do design system** — a alegação foi verificada no código e procede: `client-layout.tsx`, `submit-button.tsx`, `icon-button.tsx`, `feedback-states.tsx`, `login-page.tsx`, `not-found-page.tsx`, `check-email-page.tsx` e `confirm-email-page.tsx` já trazem os dois pares, todos com diff vazio.
>
> Nada regrediu: 12/12 critérios de aceite reverificados por execução, landmarks e guardas intactos, `app-routes.spec.tsx` sem nova edição (29/53/354, idênticos), escopo fechado, nenhum token e nenhuma dependência novos. `typecheck` exit 0 e 160/160 testes verdes. As duas emendas ao texto da task **eliminam** as contradições internas apontadas na rodada 1 e são factualmente corretas, com uma única exceção documentada no achado 10 (`2.78:1` deveria ser `2.93:1` — número pré-existente, conclusão inalterada).
>
> **0 `critical`, 0 `major`.** Os 6 achados `suggestion` (10 a 15) **não bloqueiam** o fechamento da task e ficam endereçados às TASK-FRONTEND-009 e 011, junto com os 6 achados da rodada 1 ainda abertos. A TASK-FRONTEND-007 está **encerrada**.
