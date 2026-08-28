# TASK-FRONTEND-011 — Suíte de testes da vitrine e regressão das guardas

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-011-frontend-showcase-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 11 of 11 — Testes do frontend
**Generated**: `2026-08-25`

---

## Context

Fecha a feature com cobertura de 80% e a rastreabilidade CT ↔ teste no frontend. A vitrine é exercitada nos **três** estados de sessão — ausente, presente e em restauração — com o serviço de API dublado. Além dos testes próprios, esta task carrega os itens de regressão da entrega: a árvore de rotas e o layout do cliente foram alterados, e é o ponto de maior risco declarado pela spec.

---

## Scope

**In:** Specs co-locados de `showcase-layout`, `animal-card`, `animal-image`, `format-age`, `showcase-filters`, `showcase-filter-bar` e `showcase-page`; ampliação dos specs existentes de `app-routes` e `client-layout` com os casos de regressão.

**Out:**
- Não alterar arquivos de `src/` para "facilitar teste" — reportar em vez de refatorar por conta própria.
- Nenhuma requisição real: `tests/setup.ts` já bloqueia `fetch`. O dublê é do **módulo `catalog-api`**, não do `fetch`.
- Nada de `fireEvent`: **sempre `userEvent`**, convenção do projeto.
- Sem testes de backend (TASK-BACKEND-005) e sem E2E — fora do escopo do projeto.
- Não reescrever `tests/auth-harness.tsx`; **estendê-lo** se precisar de um estado novo, sem quebrar os cinco specs que já o usam.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/layouts/showcase-layout.spec.tsx` | três estados de sessão |
| `create` | `src/components/catalog/animal-card.spec.tsx` | conteúdo e segurança do cartão |
| `create` | `src/utils/format-age.spec.ts` | concordância da idade |
| `create` | `src/pages/showcase/showcase-filters.spec.ts` | tolerância do endereço |
| `create` | `src/pages/showcase/showcase-page.spec.tsx` | estados, paginação e sequência |
| `modify` | `src/routes/app-routes.spec.tsx` | regressão das guardas |
| `modify` | `src/layouts/client-layout.spec.tsx` | item novo sem controle admin |

---

## Implementation

**Reference pattern**: `src/routes/app-routes.spec.tsx` e `src/contexts/auth/auth-provider.spec.tsx` — `renderizarComSessao(ui, { sessao, rota })`, `userEvent`, consultas por papel e por nome acessível.

**Decisões já fechadas**:

- **Dublar `~/services/api/catalog-api`** com `jest.mock` de módulo, devolvendo promessas controladas. Dublar `fetch` faria os testes verificarem o cliente HTTP em vez da tela, e o `setup.ts` já o bloqueia de propósito.
- Consultar por **papel e nome acessível** (`getByRole('combobox', { name: 'Espécie' })`), nunca por classe CSS nem por `data-testid`. Os critérios de acessibilidade desta feature — rótulo associado, grade como lista, nome do animal como título — só se verificam assim, e um `testid` os faria passar sem serem verdade.

### `src/layouts/showcase-layout.spec.tsx` *(create)*
- CT-05 (anônimo: logotipo, "Entrar", "Criar conta"; nenhuma identificação), CT-06 (autenticado: nome; **asserção explícita de que o e-mail do usuário não está no documento**), CT-07 (`bootstrapping`: nenhuma das duas alternativas no DOM), CT-08 (sair mantém em `/animais`), CT-09 (nome acessível "Sair", ícone não anunciado).
- CT-06 precisa afirmar a **ausência** do e-mail, e não apenas a presença do nome: o defeito que a RN-06 previne é exibir o e-mail, e um teste que só verifique o nome passaria com os dois na tela.

### `src/components/catalog/animal-card.spec.tsx` *(create)*
- CT-10 (cartão completo conforme a captura), CT-11 (imagem de capa), CT-12 (sem imagem → marcador substituto), CT-13 (`onError` → marcador substituto, sem laço), CT-14 (sem descrição → área ausente do DOM), CT-15 (descrição longa: texto **completo** no documento).
- **CT-16 e CT-17 são os testes de segurança da tela**: descrição e nomes contendo `<script>alert(1)</script>` e `<img src=x onerror=alert(1)>` aparecem literalmente como texto. Afirmar as duas coisas: o texto literal presente **e** `container.querySelector('script')`/`querySelector('img[onerror]')` nulos. Só a primeira asserção passaria mesmo com injeção parcial.
- CT-130 (nenhum `button` nem `a` dentro do cartão), CT-120/CT-121/CT-122 (lista com contagem, nome como título de nível abaixo do da página, ícone não anunciado, `alt` = "Foto de {nome}").

### `src/utils/format-age.spec.ts` *(create)*
- CT-58 (`null` → "Idade não informada"), CT-66 ("1 ano", singular — e **não** "1 ano(s)"), "3 anos", CT-67 ("5 meses"), "1 mês", CT-68 ("Menos de 1 mês").

### `src/pages/showcase/showcase-filters.spec.ts` *(create)*
- Funções puras, sem React. CT-81 (endereço em PT-BR), CT-85 (só o aplicado deixa parâmetro), CT-86 (cinco valores inválidos descartados sem lançar), CT-87 (parâmetro desconhecido ignorado), CT-59/CT-60 (`0` preservado, ausente e vazio como não aplicado), CT-53 (UUID válido fora das opções permanece).
- Afirmar que `parseShowcaseFilters` **nunca lança**, para qualquer entrada — inclusive `URLSearchParams` com chaves repetidas e valores absurdos. É o contrato da RN-49.

### `src/pages/showcase/showcase-page.spec.tsx` *(create)*
- Os cinco estados da grade: CT-94 (carregando com barra utilizável), CT-95 (falha com nova tentativa), CT-91 (catálogo vazio), CT-92 (vazio com filtros + ação), CT-93 (catálogo vazio **e** filtros → vale a de filtros).
- CT-97 (resumo singular/plural e ausência sem filtro), CT-72/CT-73/CT-75 (paginação oculta, visível e extremos), CT-76 (página além da última sem erro), CT-79 (filtro repõe página 1).
- **CT-36** — respostas fora de ordem: resolver a segunda promessa **antes** da primeira e afirmar que o conteúdo exibido é o da segunda. É o teste que prova a sequência da TASK-FRONTEND-010; sem ele o defeito só aparece em produção, sob rede lenta.
- **CT-35** — dez caracteres digitados com `userEvent` e timers falsos: **uma única** chamada a `listPublicAnimals`.
- **CT-07 / RN-04** — com `status: 'bootstrapping'`, afirmar que `listPublicAnimals` **já foi chamada**. É a asserção que impede alguém de "otimizar" a página esperando o bootstrap e tornando a vitrine dependente de sessão.
- CT-04 — a mesma consulta nos três estados de sessão produz o **mesmo** DOM da grade.
- CT-96 — a consulta de opções rejeitada não impede a grade de renderizar.
- CT-124 — a região viva anuncia a quantidade após a aplicação de um filtro.

### `src/routes/app-routes.spec.tsx` *(modify)*
- Acrescentar, **sem alterar nenhum caso existente**: CT-113 (`/animais` sem sessão monta, sem redirecionamento), `/animais` com `admin` e com `cliente` também monta, CT-114 (`/minha-area` e `/admin/animais` sem sessão continuam indo ao login), CT-115 (perfil errado continua redirecionado), CT-118 (raiz inalterada nos três estados), e a 404 global continua alcançável, inclusive para `/animais/algo`.
- CT-118 é o caso mais fácil de quebrar sem perceber e o mais barato de verificar — a raiz não foi tocada de propósito.

### `src/layouts/client-layout.spec.tsx` *(modify)*
- CT-116 (existe item de navegação apontando para `/animais` e ele funciona) e CT-117 (**nenhum controle administrativo no DOM** — a verificação já existente continua valendo após o acréscimo). Manter as duas no mesmo arquivo torna visível que uma não pode passar às custas da outra.

---

## Acceptance Criteria

- [ ] **Given** a suíte completa, **When** `npm test -- --coverage`, **Then** cobertura ≥ 80% em statements, branches, functions e lines nos arquivos entregues pelas TASK-FRONTEND-006 a 010.
- [ ] **Given** os nomes dos testes, **When** listados, **Then** cada CT de frontend da spec aparece pelo seu identificador em ao menos um `it(...)`.
- [ ] **Given** a suíte, **When** executada, **Then** nenhum teste usa `fireEvent` e nenhum dispara requisição real.
- [ ] **Given** os specs já existentes (`app-routes`, `role-route`, `route-paths`, `auth-provider`, `http-client`, `api-error`, `validation`, `password-field`), **When** executados após esta entrega, **Then** continuam verdes **sem alteração de caso existente** (regressão FEATURE-002 do MODULE-001).
- [ ] **Given** o teste de CT-16, **When** o cartão passa a inserir a descrição como HTML, **Then** ele **falha**.
- [ ] **Given** o teste de CT-06, **When** o cabeçalho passa a exibir o e-mail, **Then** ele **falha**.
- [ ] **Given** o teste de CT-07 / RN-04, **When** a página passa a esperar o fim do bootstrap para consultar, **Then** ele **falha**.
- [ ] **Given** o teste de CT-36, **When** a sequência de descarte é removida, **Then** ele **falha**.
- [ ] **Given** o teste de CT-119, **When** um rótulo é trocado por `placeholder`, **Then** ele **falha** — a consulta é por nome acessível.
- [ ] **Given** a suíte inteira, **When** executada em ordens diferentes, **Then** o resultado é o mesmo — nenhum teste depende de estado deixado por outro.
- [ ] **Given** o Quality Gate do Sonar, **When** avaliado, **Then** aprovado sem bloqueadores e com zero issues de segurança Blocker/Critical.
- [ ] **Given** `package.json`, **When** comparado ao anterior à feature, **Then** continua com exatamente três dependências de execução e nenhuma dependência de desenvolvimento nova (CA-55).

---

## Dependencies

- **Requires**: TASK-FRONTEND-006 a 010 (toda a vitrine); infraestrutura de testes já entregue pela TASK-FRONTEND-013 da FEATURE-002 do MODULE-001 (`jest.config.ts`, `tests/setup.ts`, `tests/auth-harness.tsx`).
- **Blocks**: nenhuma. Encerra a feature.

---

## Revisão — 2026-08-28

**Status**: APROVADO

**Frontend: 681 testes, 42 suítes, 0 falha. Backend: 732 testes, 0 falha.** `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos.

| Critério de aceite | Resultado |
|---|---|
| Cobertura ≥ 80% nos arquivos das TASK-FRONTEND-006 a 010 | **Atingido em todos.** Nove dos treze em **100%** nas quatro métricas; o menor é `showcase-page.tsx` com 96,42/100/87,5/96,29 |
| Cada CT de frontend citado por um `it` | **Confirmado.** Os 65 CT da lista têm ocorrência |
| Nenhum `fireEvent` e nenhuma requisição real | **Confirmado por varredura** nos specs desta feature; o dublê é do **módulo** `catalog-api`, e a guarda de rede do `setup.ts` segue ativa |
| Specs pré-existentes verdes, sem alteração de caso | **Confirmado.** Em `app-routes.spec.tsx` só houve **acréscimo**; os demais não foram tocados |
| CT-16 falha se a descrição virar HTML | **Verificado por mutação: 1 falha** |
| CT-06 falha se o cabeçalho exibir o e-mail | **Verificado por mutação: 3 falhas** |
| CT-07/RN-04 falha se a página esperar o bootstrap | **Coberto de duas formas:** a página é renderizada **sem `AuthContext`** (se lesse `useAuth()`, o hook lançaria) e há um caso com `status: 'bootstrapping'` afirmando que a consulta já partiu |
| CT-36 falha sem a sequência de descarte | **Verificado por mutação: 1 falha** |
| CT-119 falha se um rótulo virar `placeholder` | **Verificado por mutação: 7 falhas** |
| Resultado igual em ordens diferentes | **Confirmado em 6 execuções** com `--runInBand --randomize` — depois de corrigir um vazamento, abaixo |
| Três dependências de execução, nenhuma de desenvolvimento nova | **Confirmado:** 3 e 21, as mesmas |

### Um defeito de produto encontrado pela escrita dos testes

O caso "voltar um campo de seleção ao neutro" **não passava**, e a causa não era o teste: o `SelectField` renderiza a opção de `placeholder` como `<option value="" disabled>`.

No formulário de cadastro o `disabled` é correto — "Selecione" não é um valor válido, e poder escolhê-lo de volta faria o administrador desfazer um campo obrigatório. **Na vitrine é o contrário**: "Todas as espécies" **é** um valor válido, e significa "filtro não aplicado". Com ele desabilitado, quem escolhesse "Gato" **nunca mais conseguiria remover só aquele filtro** — teria de usar "Limpar filtros" e perder os outros junto.

Corrigido na barra, e não no `SelectField`: as opções neutras passaram a ser opções **de verdade**, antepostas à lista, e o `placeholder` deixou de ser usado ali. O primitivo compartilhado, que quatro telas administrativas já usam, ficou intocado.

### Um vazamento entre testes, encontrado pela execução aleatorizada

O caso de `prefers-reduced-motion` sobrescrevia `window.matchMedia` **globalmente** e não o restaurava. Quando a ordem o colocava antes do caso do `smooth`, este via `matches: true` e recebia `auto` — falhando em **três de seis** execuções.

`window.matchMedia` e `Element.prototype.scrollIntoView` são globais do ambiente, e não estado de componente: o `cleanup` do `tests/setup.ts` não os desfaz. Acrescentado `afterEach` que restaura o descritor original de ambos. Seis execuções aleatorizadas seguidas, todas verdes.

Vale o registro: a instabilidade não apareceu em nenhuma execução normal. Apareceu porque o critério de aceite pede execução em ordens diferentes — e foi o próprio critério que pegou o defeito que ele existe para pegar.

### O que esta task entregou, e o que já vinha pronto

Os sete arquivos da tabela foram escritos nas tasks que os exigiam, porque os critérios daquelas eram comportamentais e não havia como aprová-las sem eles — cada review registra isso. Esta task fechou os vãos:

| Acréscimo | Por quê |
|---|---|
| CT-04 e CT-07 sob os três estados de sessão | A grade é comparada por `innerHTML` nos três: a vitrine não tem representação privilegiada |
| `parseShowcaseFilters` nunca lança | Sete entradas absurdas — chaves repetidas, `NaN`, percent-encoding quebrado, 5000 caracteres, emoji. É o contrato da RN-49, e ele só vale verificado |
| `use-filter-options.spec.ts` | As guardas de desmonte dos dois hooks e a independência entre as consultas de opções |
| Rolagem ao topo da grade (CT-80) | Com `prefers-reduced-motion` nos dois sentidos |
| Opção neutra selecionável nos quatro campos | O caso que encontrou o defeito acima |
| CT-11, CT-126 e a citação de CT-121/CT-122 | Vãos de rastreabilidade |

### Fora do escopo, registrado

`src/config/env.ts` segue em 0% de cobertura. É do MODULE-001, **não** foi tocado por esta feature, e está a zero porque `tests/env-mock.ts` substitui o módulo inteiro em toda a suíte — o mecanismo que permite os testes rodarem sem variáveis de ambiente. Já registrado na TASK-FRONTEND-018 da FEATURE-002.
