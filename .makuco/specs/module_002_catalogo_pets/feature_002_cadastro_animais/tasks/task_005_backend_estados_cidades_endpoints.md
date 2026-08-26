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
- `listCitiesParamsSchema`: `{ uf: z.string().length(2).regex(/^[A-Za-z]{2}$/).transform(v => v.toUpperCase()) }`, com mensagem `INVALID_IDENTIFIER` no `field` `uf`.
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
- `GET /` → `authenticate` → `authorizeRole('ADMIN')` → `controller.listStates`.
- `GET /:uf/cities` → `authenticate` → `authorizeRole('ADMIN')` → `validateRequest({ params: listCitiesParamsSchema })` → `controller.listCities`.
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
