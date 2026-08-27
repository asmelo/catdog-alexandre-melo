# TASK-BACKEND-005 — Endpoints de estados e cidades

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-005-backend-estados-cidades-endpoints`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 5 of 18 — Domínio Geografia
**Generated**: `2026-08-25`

---

## Context

Entrega `GET /api/states` e `GET /api/states/:uf/cities`, que alimentam os campos Estado e Cidade do formulário. É a primeira fatia vertical completa da feature e serve de molde para as seguintes. Ambos respondem **a partir do banco semeado**, sem nenhuma chamada externa em tempo de execução (RN-27, RNF-15), e ambos exigem sessão e role `admin` — nenhum endpoint desta feature é anônimo (RN-02).

---

## Scope

**In:** Repositório de estados e cidades, dois services, controller, rotas, validador do parâmetro `uf`, catálogo de mensagens do domínio, erro `STATE_NOT_FOUND` e montagem em `/api/states`.

**Out:** Nenhuma escrita — não há criação, edição nem exclusão de estado ou cidade, e nenhuma tela de manutenção. Nenhum endpoint de animal (TASK-BACKEND-006 em diante). Nenhum limitador de taxa (decisão registrada na spec). Não paginar: 27 estados e os municípios de uma UF cabem em uma resposta, e a paginação da RN-42 vale para animais.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Unidade federativa | `State`, exposta no contrato como `{ uf, name }` |
| Município | `City`, exposta como `{ id, name }` |
| Sigla inexistente | `StateNotFoundError` → `404 STATE_NOT_FOUND` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/geography/geography.messages.ts` | catálogo PT-BR |
| `create` | `src/domains/geography/geography.validators.ts` | schema do parâmetro uf |
| `create` | `src/domains/geography/errors/geography.errors.ts` | erro de estado |
| `create` | `src/domains/geography/repositories/state.repository.ts` | acesso a states/cities |
| `create` | `src/domains/geography/services/list-states.service.ts` | caso de uso listar UFs |
| `create` | `src/domains/geography/services/list-cities-by-state.service.ts` | caso de uso listar cidades |
| `create` | `src/domains/geography/geography.controller.ts` | camada HTTP |
| `create` | `src/domains/geography/geography.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/states |

---

## Implementation

> **Reference pattern**: `src/domains/auth/` inteiro é o molde de camadas — `routes → controller (fábrica `create<X>Controller()`) → service (classe por caso de uso, `execute()`) → repository (interface-porta + `Prisma<X>Repository`)`. O contrato de camadas vale aqui integralmente: controller lê `req`, chama **um** service e responde; service não conhece `req`/`res`/status; repository fala Prisma e devolve entidade ou `null`, nunca lança erro HTTP.

### `src/domains/geography/geography.messages.ts` *(create)*
- Objeto `as const` com `STATE_NOT_FOUND: 'Estado não encontrado.'` e `INVALID_IDENTIFIER: 'Identificador inválido.'`, literais da tabela de mensagens da spec.

### `src/domains/geography/geography.validators.ts` *(create)*
- O estado é identificado pela **sigla de duas letras** da unidade federativa (RN-25), e é assim que ele trafega no caminho.
- `listCitiesParamsSchema`: `{ uf: z.string().superRefine(medirSigla).transform(v => v.toUpperCase()) }`, com mensagem `INVALID_IDENTIFIER` no `field` `uf`. `medirSigla` mede o comprimento, faz **early return** se ele falhar, e só então testa `/^[A-Za-z]{2}$/` — no máximo **um** `addIssue` por caminho.
- **Por que não a cadeia `.length(2).regex(...)`**: ela **acumula** as `issues`. Medido por execução no Zod **3.25.76** (a versão instalada; o `package.json` declara `^3.24.1`): para `"PARANA"` — e igualmente para `""` e `"A"` — os dois checks falham, e `validationErrorFromZodError` (`src/shared/errors/http-errors.ts:113`) mapeia `issues` uma a uma, produzindo `details: [{ field: "uf", ... }, { field: "uf", ... }]`: **a mesma mensagem duas vezes**, e o campo marcado duas vezes na interface. O critério de aceite deste próprio documento cita `"PARANA"` nominalmente e exige `details` com **um** item — seguir a cadeia reprovaria o critério da mesma task. O `superRefine` com early return fixa a precedência e mantém uma mensagem por campo.
- É o **mesmo remédio, pela mesma razão**, já aplicado em `medirNome` no domínio de espécies (`src/domains/species/species.validators.ts:57-62`, montado em `:105`) — não é invenção desta task, é o padrão do projeto para campo com mais de uma regra e uma só mensagem por vez.
- A normalização para maiúsculas fica **no schema** — é o ponto único, e o repositório assume que a sigla já chega normalizada.
- Sigla de duas letras que não existe é `404`, e **não** `400`: o formato está correto, o recurso é que não existe. A distinção é do contrato da spec.

### `src/domains/geography/repositories/state.repository.ts` *(create)*
- Interface `StateRepository` + `PrismaStateRepository` com `PrismaClient` injetado.
- Métodos: `listAll(): Promise<ReadonlyArray<State>>` ordenado por `uf` crescente; `findByUf(uf): Promise<State | null>`; `listCitiesByStateId(stateId): Promise<ReadonlyArray<City>>` ordenado por `name` crescente.
- Ordenação no banco, não em memória: a lista de municípios de SP passa de 600 itens.
- `findByUf` devolve `null` quando não existe — ausência **não** é erro nesta camada.

### `src/domains/geography/services/list-states.service.ts` *(create)*
- `execute(): Promise<{ items: ReadonlyArray<{ uf: string; name: string }> }>`.
- Projeta explicitamente `uf` e `name` — **não** devolve a entidade inteira. O `id` do estado não é exposto porque o contrato identifica o estado pela sigla, e expor identificador que ninguém usa é superfície a mais (coerente com a RN-59).

### `src/domains/geography/services/list-cities-by-state.service.ts` *(create)*
- `findByUf` → `null` ⇒ `StateNotFoundError`; senão `listCitiesByStateId`.
- Projeta `{ id, name }`. `stateId` e `ibgeCode` não vão para a resposta.
- Estado que existe e não tem nenhuma cidade responde `200` com `items: []`, nunca `404` — é o mesmo princípio da lista vazia da listagem de animais.

### `src/domains/geography/geography.controller.ts` *(create)*
- Fábrica `createGeographyController(deps)` com dois handlers finos, ambos `200`. Sem `try/catch` — `express-async-errors` encaminha ao error handler.
- Instanciação das dependências na fábrica ou em `geography.routes.ts`; nunca dentro do handler, a cada requisição.

### `src/domains/geography/geography.routes.ts` *(create)*
- `GET /` → `authenticate` → `authorizeRole('admin')` → `controller.listStates`.
- `GET /:uf/cities` → `authenticate` → `authorizeRole('admin')` → `validateRequest({ params: listCitiesParamsSchema })` → `controller.listCities`.
- **`'admin'` em minúsculas, nunca `'ADMIN'`.** São dois vocabulários distintos para a mesma role: `'ADMIN'` é o valor do **enum do banco** (`UserRole`, convenção de enum do Postgres/Prisma) e só existe até `PAPEL_PUBLICO` traduzi-lo (`src/domains/auth/mappers/user.mapper.ts:34-36`); `'admin'` é o **literal público**, do contrato, do JWT e das rotas. `authorizeRole` recebe `AuthRole`, que é `['admin','cliente'] as const` (`user.mapper.ts:13-15`), então `authorizeRole('ADMIN')` **não compila**. `species.routes.ts:45,51,69,87` já usa `'admin'`. É confusão que se repete: em rota, é sempre o literal público.
- Apenas sessão ativa com role `admin` alcança qualquer um dos dois. A verificação que vale é a do servidor; o controle de rota do frontend é conveniência de navegação e não protege nada (RN-01).
- **A ordem é obrigatória: autenticar antes de autorizar.** Invertida, `authorizeRole` leria `req.user` indefinido e o resultado dependeria de como o middleware trata a ausência — 403 onde deveria ser 401, ou pior.
- Esta feature e a FEATURE-001 são as primeiras a montar `authorizeRole`, que existe e está testado mas nunca foi montado por rota alguma.

### `src/routes/index.ts` *(modify)*
- `router.use('/states', geographyRoutes)`. Uma linha; nenhuma outra alteração no arquivo.

---

## Acceptance Criteria

- [ ] **Given** sessão de `admin`, **When** `GET /api/states`, **Then** responde `200` com exatamente 27 itens `{ uf, name }` ordenados pela sigla (CT-42).
- [ ] **Given** sessão de `admin`, **When** `GET /api/states/PR/cities`, **Then** responde `200` com apenas cidades do Paraná, ordenadas por nome, com "Campo Magro" presente, e nenhum item traz `stateId` ou `ibgeCode` (CT-36).
- [ ] **Given** `uf` em minúsculas (`pr`), **When** consultado, **Then** a resposta é idêntica à de `PR`.
- [ ] **Given** `uf: "XX"`, **When** consultado, **Then** `404 STATE_NOT_FOUND` com "Estado não encontrado." (CT-43).
- [ ] **Given** `uf: "PARANA"` ou `uf: "P1"`, **When** consultado, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "uf", message: "Identificador inválido." }]`.
- [ ] **Given** requisição sem sessão a qualquer um dos dois endpoints, **When** processada, **Then** `401 SESSION_EXPIRED`; **Given** sessão com role `cliente`, **Then** `403 FORBIDDEN` (CT-89, CT-90, CA-40).
- [ ] **Given** toda a rede externa bloqueada, **When** os dois endpoints são chamados, **Then** ambos respondem normalmente — nenhuma chamada de saída é feita (CT-44, CA-18, RNF-15).
- [ ] **Given** o código dos dois services, **When** inspecionado, **Then** nenhum importa `PrismaClient` diretamente e nenhum monta corpo de resposta.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (tabelas), TASK-BACKEND-002 (dados semeados — sem eles os endpoints respondem vazio), `authenticate.middleware.ts` e `authorize-role.middleware.ts` já existentes.
- **Blocks**: TASK-FRONTEND-013 (camada de API consome estes contratos), TASK-FRONTEND-017 (campos Estado e Cidade), TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 9 (8 criados + 1 modificado)

#### Resumo

Os oito arquivos do domínio `geography` e as duas linhas acrescentadas a `src/routes/index.ts` foram lidos por inteiro e verificados **por execução** — contra o banco real (27 estados / 5.571 municípios, sem alteração) e contra a pilha HTTP completa via `supertest`. Os oito critérios de aceite estão implementados e observados. As sete decisões declaradas pelo agente procedem; **duas delas contradizem o texto desta task, e é o texto que precisa ser emendado**, não o código. Nenhum achado `critical` ou `major`.

#### Evidência de execução

Sonda HTTP sobre `~/app` com dublê mínimo do Prisma (removida ao fim da revisão):

| Requisição | Resultado observado | Toques no banco |
|---|---|---|
| `GET /api/states` sem sessão | `401 SESSION_EXPIRED` | nenhum |
| `GET /api/states` role `cliente` | `403 FORBIDDEN` | nenhum |
| `GET /api/states` role `admin` | `200 {"items":[{"uf","name"}]}` | `state.findMany` |
| `GET /api/states/PR/cities` admin | `200 {"items":[{"id","name"}]}` | `findUnique:PR` + `city.findMany` |
| `GET /api/states/pr/cities` admin | idêntico a `PR` (chega `PR` ao repositório) | `findUnique:PR` + `city.findMany` |
| `GET /api/states/XX/cities` admin | `404 STATE_NOT_FOUND` — "Estado não encontrado." | `findUnique:XX` apenas |
| `GET /api/states/PARANA/cities` admin | `400 VALIDATION_ERROR`, `details` com **1** item `{field:"uf"}` | nenhum |
| `GET /api/states/P1/cities` admin | `400`, `details` com 1 item | nenhum |
| **`GET /api/states/PARANA/cities` role `cliente`** | **`403 FORBIDDEN`, e não `400`** | nenhum |
| `GET /api/states/PARANA/cities` sem sessão | `401 SESSION_EXPIRED` | nenhum |

Sonda de leitura contra o banco real (Postgres 17.6 / ICU / `en_US.UTF-8`), exercitando `PrismaStateRepository` + os dois services de produção:

- `listStates` → 27 itens, chaves exatamente `['uf','name']`, ordem `AC,AL,AM,AP,BA,CE,DF,...,SP,TO` (crescente por sigla), `DF` presente.
- `Boa Esperança` aparece **exatamente uma vez** em ES (78 municípios), MG (853) e PR (399), com **três `id` distintos**.
- `DF` → 1 município, `Brasília`, `ibgeCode` 5300108.
- PR → 399 itens, chaves exatamente `['id','name']` (sem `stateId`, sem `ibgeCode`), `Campo Magro` presente.
- **Ordenação**: a sequência devolvida pelo banco é **idêntica** à de `localeCompare('pt-BR')` e **diferente** da comparação binária. Vizinhança do banco: `Anahy, Andirá, Ângulo, Antonina, Antônio Olinto`; a binária produziria `Anahy, Andirá, Antonina, Antônio Olinto, Apucarana`, com `Ângulo` empurrado para depois de `Z`. A afirmação do agente confere.
- Contagens ao final: `states` 27, `cities` 5571, `users` 2, `species` 0 — **dados inalterados**; todas as consultas foram de leitura.

Portões: `npm run typecheck` sai 0; `npx jest` → **24 suítes / 314 testes**, todas verdes (baseline intacta — esta task não entrega testes, eles são da TASK-BACKEND-011).

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `.../tasks/task_005_...md` (esta task) | seção `Implementation` → `geography.routes.ts` | texto da task | A task escreve `authorizeRole('ADMIN')`. `AuthRole` é `(typeof AUTH_ROLES)[number]` sobre `['admin','cliente']` (`src/domains/auth/mappers/user.mapper.ts:13-15`); `'ADMIN'` é o valor do enum `UserRole` do banco, traduzido para `'admin'` por `PAPEL_PUBLICO` (`user.mapper.ts:34-36`). `'ADMIN'` **não compila**. A entrega usa `'admin'` (`geography.routes.ts:53,71`), igual a `species.routes.ts:45,51,69,87`. | **Emendar o texto da task**: trocar `authorizeRole('ADMIN')` por `authorizeRole('admin')` nas duas linhas da seção `Implementation`. O código está correto. |
| 2 | minor | `.../tasks/task_005_...md` (esta task) | seção `Implementation` → `geography.validators.ts` | texto da task | A task prescreve `z.string().length(2).regex(/^[A-Za-z]{2}$/)`. Verificado por execução no Zod 3.25.76 instalado: a cadeia **acumula** as `issues` e `validationErrorFromZodError` (`http-errors.ts:113`) mapeia uma a uma, produzindo `details: [{field:"uf",...},{field:"uf",...}]` — a **mesma mensagem duas vezes** — para `"PARANA"`, `""` e `"A"`. O critério de aceite desta task cita `"PARANA"` nominalmente e exige `details` com **um** item, logo a cadeia prescrita **falharia o próprio critério**. O `superRefine` com early return entregue (`geography.validators.ts:48-58`) produz exatamente um item em todos os casos. | **Emendar o texto da task**: substituir a cadeia por `superRefine` com precedência explícita, ou registrar a divergência como decisão. O código está correto. |
| 3 | minor | `src/domains/geography/repositories/state.repository.ts` | L65, L131 | cobertura | `withTransaction` nasce **sem chamador**: nenhum ponto do produto abre transação sobre esta porta hoje (`grep withTransaction src/` confirma que os 5 outros repositórios têm chamador e este não). É o contrato de porta uniforme do projeto — está em `user.repository.ts:34`, `refresh-token.repository.ts:59`, `email-confirmation-token.repository.ts:34`, `species.repository.ts:81` e `species-usage-counter.ts:37` —, então mantê-lo é coerente; mas hoje é código morto e ficará descoberto. | Não corrigir aqui. **Registrar na TASK-BACKEND-011** que `PrismaStateRepository.withTransaction` precisa de caso próprio, ou aceitá-lo explicitamente como linha não coberta. O consumidor previsto (gravação do animal, TASK-BACKEND-007) o alcançará. |
| 4 | minor | `src/domains/geography/geography.validators.ts` | L33 | comentário | O comentário afirma "verificado contra o Zod 3.24 em uso". A versão instalada é **3.25.76** (`node_modules/zod/package.json`); o `package.json` declara `^3.24.1`. O comportamento descrito foi reconfirmado nesta revisão na 3.25.76, então a **conclusão** está certa e só o número está errado. | Ajustar o número da versão no comentário, ou remover a versão e deixar só o comportamento. |
| 5 | suggestion | `src/domains/geography/services/list-states.service.ts` | L42-44 | padrão | Envelope `{items}` montado no **service**; `species.controller.ts:100` monta no controller e `ListSpeciesService.execute` devolve `ReadonlyArray<PublicSpecies>` puro. Divergência real entre os dois domínios, mas a assinatura foi **fixada por esta task** (`Promise<{ items: ReadonlyArray<{ uf; name }> }>`) e o resultado — controller sem decisão de formato — é defensável. | Aceitar. Se a intenção for uniformizar, é decisão transversal e não desta task; registrar no changelog qual dos dois é o padrão dali em diante. |
| 6 | suggestion | `src/domains/geography/services/list-states.service.ts` / `list-cities-by-state.service.ts` | L25-28 / L26-29 | padrão | Sem `mappers/`: `PublicState` e `PublicCity` vivem nos arquivos de service, enquanto `species` tem `mappers/species.mapper.ts` e `auth` tem `mappers/user.mapper.ts`. A tabela `## Files` desta task **não lista mapper**, e o motivo de existir do mapper de espécies — converter `Date` para ISO-8601 — não se aplica: `State` e `City` só têm `string`/`Int`, e a projeção é seleção pura de campos. | Aceitar. Se `geography` ganhar uma terceira projeção ou uma conversão de tipo, extrair para `mappers/geography.mapper.ts` nessa ocasião. |
| 7 | suggestion | `src/domains/geography/repositories/state.repository.ts` | L25-66 | design | Uma porta para as duas tabelas. Procede: não existe leitura de `cities` fora do escopo de um estado neste contrato — nem "buscar cidade por id", nem "listar todas", nem consulta por nome —, e os dois métodos são sempre chamados em sequência pelo mesmo caso de uso. | Aceitar. Reavaliar quando a TASK-BACKEND-007 precisar resolver a cidade por `id` ao gravar o animal: se ali nascer uma leitura de `cities` desacoplada do estado, o momento de separar as portas é aquele. |
| 8 | suggestion | `src/domains/geography/geography.messages.ts`, `geography.validators.ts`, `state.repository.ts`, `list-cities-by-state.service.ts` | messages L14,19,20,26; validators L25,66; repository L80,106,120-122; service L75 | convenção | Comentários com caracteres acentuados, onde os arquivos de produção do projeto mantêm comentários em ASCII. Todas as ocorrências são **citação de literal** (mensagens do contrato, nomes de município reais, `ÇE`), e há precedente em `src/domains/auth/auth.validators.ts:61`. Não é violação clara. | Aceitar, ou padronizar a citação de literais em comentários numa passada transversal. Nenhum efeito funcional. |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **8 de 8 critérios implementados**, todos observados por execução (tabela acima). O oitavo — "nenhum service importa `PrismaClient` e nenhum monta corpo de resposta" — confere: os dois services importam apenas `type StateRepository` e, no caso de cidades, `StateNotFoundError`; nenhum toca `res`, `status` ou `json`. O sétimo (rede externa bloqueada) confere estruturalmente: `grep -rn "fetch\|axios\|http://\|https://\|node:http\|supabase"` sobre `src/domains/geography/` não retorna **nada**. Achados: #1, #2 (ambos contra o **texto** da task, não contra o código).

**Pass 2 — Diff Analysis**: Nenhum achado. `git status` mostra exatamente os 8 arquivos novos de `## Files` e `src/routes/index.ts` modificado com **+2 linhas** (`import { geographyRoutes }` na L4 e `router.use('/states', geographyRoutes)` na L21) — nada mais no arquivo. Nenhum arquivo de `## Scope — Out` foi tocado: **`animals.messages.ts` NÃO foi modificado** (não consta do diff nem dos untracked), nenhum endpoint de animal, nenhum limitador de taxa, nenhuma escrita, nenhuma paginação. Sem formatação em massa e sem scope creep.

**Pass 3 — Code Practices**: Nenhum achado bloqueante. SOLID: cada service tem um caso de uso e um colaborador; dependência sobre a interface `StateRepository` e nunca sobre `PrismaClient` (D); a porta expõe só o que os dois casos de uso usam (I). Object Calisthenics: **nenhum `else` em nenhum dos oito arquivos**; um nível de indentação por método; guard clause com early return em `medirSigla` (L49-53) e em `createGeographyController` (L105-107); no máximo **1** variável de instância por classe (`db`, `states`, `services`). Entidades pequenas — o maior arquivo tem 49 linhas de código (`geography.controller.ts`), o repositório tem 22. Clean Code: sem número mágico (`COMPRIMENTO_DA_SIGLA`, `HTTP_STATUS.OK`), sem status literal, comentários explicando **por que** e não **o quê**. Comparações estritas em todos os pontos (`estado === null`, `dependencias !== undefined`, `sigla.length !== ...`). `db` como nome do campo privado segue o precedente de `user.repository.ts:44` e `species.repository.ts:90`. Linguagem ubíqua: `State`/`City`/`uf` batem com a tabela desta task e com a RN-25; `StateNotFoundError` nomeia a regra violada, não o status; `listAll`/`findByUf`/`listCitiesByStateId` são verbo+objeto. `uf` é abreviação, mas é a sigla oficial e está documentada no vocabulário da task. Achados de nota: #4 (número de versão no comentário), #8 (acentuação em comentário).

**Pass 4 — Testing Review**: **Fora do escopo desta task** por decisão explícita — os testes são da TASK-BACKEND-011, e nenhum arquivo `*.spec.ts` foi entregue nem alterado. A baseline permanece intacta: 24 suítes / 314 testes verdes, mesmo número de antes. O que esta revisão registra para a TASK-BACKEND-011: (a) `withTransaction` (achado #3) não tem chamador e ficará descoberto; (b) o parâmetro `dependencias?` de `createGeographyController` (`geography.controller.ts:103`) também nasce sem chamador alcançável, exatamente como aconteceu com `createSpeciesController` — e `tests/integration/species-routes.spec.ts` documenta o precedente de usá-lo; (c) `tests/fakes/prisma-double.ts` **não tem** os modelos `state` e `city`, então a suíte de integração de geografia precisará estendê-lo ou injetar por `dependencias?`.

**Pass 5 — Security Review**: Nenhum achado. **A01** — as duas rotas exigem `authenticate` + `authorizeRole('admin')`, verificado por HTTP: 401 sem sessão, 403 para `cliente`, nos dois endpoints; a checagem é do servidor e não há caminho anônimo. Não há IDOR: os dois recursos são dado de referência do IBGE, sem vínculo com usuário, e nada é escopado por identidade. **A02** — nenhum segredo, nenhum dado sensível, nenhuma criptografia envolvida. **A03** — Prisma parametrizado em todas as três consultas (`findMany`, `findUnique`, `findMany`), zero interpolação de string; `uf` passa por allowlist `^[A-Za-z]{2}$` antes de alcançar o banco; nenhum `console.log` interpola entrada do usuário. **A04** — sem limitador de taxa, mas é decisão declarada da spec (linha 890 do `spec_context.md`) e do changelog (Decisão 14), sobre duas leituras autenticadas de tabela de apoio. **A05** — corpo de erro montado só pelo `error-handler.middleware.ts:56`, sem stack e sem mensagem do ORM; o ramo genérico responde `INTERNAL_ERROR` opaco. **A06** — nenhuma dependência nova. **A07** — sem interação com sessão além de consumir `req.authUser` já publicado. **A08/A10** — sem desserialização de terceiro, sem upload, **sem nenhuma URL construída a partir de entrada** e sem qualquer saída de rede. **A09** — sem logging próprio; o `403` do `authorizeRole` sobe pelo handler central, comportamento idêntico ao de `species`.

**Pass 6 — Bug Detection**: Nenhum achado. Lidos os oito arquivos por inteiro, não só o diff. **Null/undefined**: o único `null` do caminho (`findByUf`) é tratado com guarda explícita antes de qualquer acesso a `estado.id` (`list-cities-by-state.service.ts:69-79`). **Não-unicidade de nome de município é inofensiva por construção**: `grep` confirma que a **única** leitura de `cities` no domínio é `where: { stateId }` (`state.repository.ts:128`) — **nenhum ponto consulta cidade por nome**, em lugar nenhum do código entregue. **Ordenação inteiramente no banco**: `grep -rn "\.sort(\|localeCompare" src/domains/geography/` retorna apenas **comentários**; não existe `sort()` em memória em nenhum dos oito arquivos, o que preserva a ordem por locale medida contra o banco real. **Camadas**: o repositório não lança erro HTTP (só `findUnique`/`findMany`, devolvendo entidade ou `null`) e é o service quem decide que `null` é problema. **Controller**: os dois handlers não acessam Prisma e chamam **exatamente um** service cada (`geography.controller.ts:70` e `:86`); o `import { prisma }` da L13 é consumido só pela fábrica de composição, exatamente como em `species.controller.ts:15,160`. **Regex sem flag `g`** (`geography.validators.ts:27`), então `.test()` não carrega `lastIndex` entre chamadas — o bug clássico não existe aqui. **Coerção**: `===`/`!==` em todos os pontos. **Swallowing**: nenhum `try/catch` no domínio. **Vazamento de recurso / race / off-by-one / estado inconsistente**: não se aplicam — as duas operações são leituras isoladas sobre o cliente Prisma compartilhado. **Decisão 7 (duas consultas) confirmada**: a sonda mostra que `XX` gasta **só** `state.findUnique` e nunca chega a `city.findMany`, enquanto `PR` faz as duas — é exatamente essa sequência que separa `404` de `200 {items:[]}`, indistinguíveis num `findMany` único pela sigla.

**Pass 7 — Project Patterns**: Nenhum achado bloqueante. A estrutura `domains/<dominio>/{errors,repositories,services}` + `<dominio>.{messages,validators,controller,routes}.ts` espelha `species` e `auth`. Nomenclatura de arquivo em kebab-case com sufixo de papel, alias `~/` em todos os imports, classes de erro herdando de `~/shared/errors/http-errors`, catálogo `as const`, fábrica `create<X>Controller(deps?)`, handlers como propriedades arrow, `HTTP_STATUS` em vez de literal — tudo alinhado. Fluxo de dependência sem inversão de camada e sem ciclo: `routes → controller → service → repository`, e o repositório é a única camada que conhece Prisma. **Ordem dos middlewares confirmada e igual à de `species.routes.ts:19`**: `authenticate` → `authorizeRole` → `validateRequest` → handler, provada pela sonda (`cliente` + sigla inválida → **403, não 400**, e sem toque no banco). Divergências deliberadas registradas nos achados #5, #6, #7.

> **Nota sobre o texto da task**: a seção `Implementation` afirma que "esta feature e a FEATURE-001 são as primeiras a montar `authorizeRole`, que existe e está testado mas **nunca foi montado por rota alguma**". A afirmação está desatualizada: `species.routes.ts` já o monta em quatro rotas (L45, L51, L69, L87), entregue e comitado pela FEATURE-001. Não afeta o código.

#### Veredicto

> **APROVADO** — os 8 critérios de aceite estão implementados e verificados por execução contra o banco real e contra a pilha HTTP completa. Nenhum achado `critical` ou `major`. Os 4 achados `minor` e os 4 `suggestion` não bloqueiam o fechamento da task.
>
> **Duas emendas necessárias no TEXTO desta task**, ambas na seção `## Implementation` — o código está correto e não deve ser alterado:
> 1. `geography.routes.ts` → `authorizeRole('ADMIN')` deve ler `authorizeRole('admin')` (achado #1).
> 2. `geography.validators.ts` → a cadeia `.length(2).regex(...)` deve ser substituída pela abordagem `superRefine` com precedência explícita, porque a cadeia prescrita **reprova o próprio critério de aceite** de `"PARANA"` (achado #2).
>
> **Um item a repassar à TASK-BACKEND-011**: `PrismaStateRepository.withTransaction` (`state.repository.ts:65,131`) não tem chamador e ficará descoberto; e `tests/fakes/prisma-double.ts` ainda não tem os modelos `state`/`city` (achado #3).
