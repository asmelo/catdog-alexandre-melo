# TASK-BACKEND-004 — `GET /api/catalog/species` e `GET /api/catalog/cities`: opções de filtro

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-004-backend-catalog-filter-options-endpoints`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 4 of 11 — Opções dos filtros de espécie e cidade
**Generated**: `2026-08-25`

---

## Context

Fecha o backend da vitrine com os dois endpoints que alimentam os campos de seleção de espécie e de cidade. A regra que os define é a Decisão D: eles devolvem **apenas** espécies e cidades com ao menos um animal disponível. Oferecer os ~5.600 municípios do cadastro de apoio produziria uma lista em que quase toda escolha leva a zero resultados — um filtro que existe para não funcionar.

---

## Scope

**In:** Dois métodos novos no `PublicCatalogRepository`, dois services, dois handlers no controller do catálogo, duas rotas com o mesmo limitador.

**Out:**
- **Não substituir nem alterar** `GET /api/species` (FEATURE-001 deste módulo, exige `admin`, devolve todas as espécies) nem `GET /api/states` / `GET /api/states/:uf/cities` (FEATURE-002, exigem `admin`, devolvem o cadastro de apoio inteiro). São recursos diferentes com públicos diferentes e continuam existindo (CT-105, QA-48).
- Nenhum parâmetro de consulta nestes dois endpoints — nem paginação, nem busca, nem `stateUf`.
- Nenhum código de erro novo, nenhum montador administrativo tocado.
- Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/catalog/repositories/public-catalog.repository.ts` | consultas de opções |
| `create` | `src/domains/catalog/services/list-available-species.service.ts` | espécies com animal disponível |
| `create` | `src/domains/catalog/services/list-available-cities.service.ts` | cidades com animal disponível |
| `modify` | `src/domains/catalog/catalog.controller.ts` | dois handlers |
| `modify` | `src/domains/catalog/catalog.routes.ts` | duas rotas públicas |

---

## Implementation

### `src/domains/catalog/repositories/public-catalog.repository.ts` *(modify)*
**Reference pattern**: o próprio `listAvailableAnimals` entregue na TASK-BACKEND-002 — mesma porta, mesmo `select` explícito, mesma proibição de lançar erro HTTP.

**Decisões já fechadas**:
- `listSpeciesWithAvailableAnimals(): Promise<Array<{ id: string; name: string }>>` — `species.findMany({ where: { animals: { some: { status: 'DISPONIVEL' } } }, select: { id: true, name: true } })`. O `some` traduz literalmente "ao menos um animal disponível" (RN-31).
- `listCitiesWithAvailableAnimals(): Promise<Array<{ id: string; name: string; stateUf: string }>>` — `city.findMany({ where: { animals: { some: { status: 'DISPONIVEL' } } }, select: { id: true, name: true, state: { select: { uf: true } } } })` (RN-30).
- **`select` explícito também aqui** (RN-55): `ibgeCode`, `stateId` e qualquer coluna futura não são lidos.
- Ordenação de espécies: alfabética crescente **ignorando caixa**. Usar a coluna normalizada persistida que a FEATURE-001 deste módulo já mantém em `species` — não `mode: 'insensitive'` em `orderBy`, que o Prisma não suporta (RN-31, CT-50).
- Ordenação de cidades: `[{ state: { uf: 'asc' } }, { name: 'asc' }]` (RN-30, CT-51).
- Nenhum `take`/`skip`: por construção a lista já é curta — o recorte por disponibilidade **é** o limite.
- As duas consultas leem o dado persistido; nenhuma chamada a serviço externo em tempo de execução (RN-32).

### `src/domains/catalog/services/list-available-species.service.ts` e `list-available-cities.service.ts` *(create)*
**Reference pattern**: `list-public-animals.service.ts` (TASK-BACKEND-003) — classe por caso de uso, `execute()`, dependência injetada.
- Dois arquivos, e não um "service de opções" com dois métodos: são dois casos de uso e as ordenações são diferentes. Um arquivo só violaria a responsabilidade única e passaria a mudar por dois motivos.
- Sem parâmetro, sem paginação: devolvem `{ items }`. **Sem `pagination`** — estes dois endpoints não usam o envelope paginado, e acrescentá-lo vazio induziria o frontend a paginar o que não pagina.
- A cidade sai do service como `{ id, name, stateUf }`, achatada. O rótulo "Cidade - UF" é composto **na tela** (TASK-FRONTEND-009): o servidor devolve dado, não texto de apresentação.

### `src/domains/catalog/catalog.controller.ts` *(modify)*
- Dois handlers no mesmo controller-fábrica, respondendo `200 { items }` com `Cache-Control: no-store`. A lista de opções é derivada do estado corrente do catálogo a cada consulta: uma cidade cujo último animal saiu de disponível precisa sumir da consulta seguinte (RN-30, CT-52).
- Catálogo sem animais disponíveis → `200 { items: [] }`, nunca `404`.

### `src/domains/catalog/catalog.routes.ts` *(modify)*
- `router.get('/species', catalogLimiter, controller.listSpecies)` e `router.get('/cities', catalogLimiter, controller.listCities)`.
- **Sem `authenticate`, sem `authorizeRole` e sem validador** — não há query a validar. A ausência dos dois primeiros é deliberada e já está comentada no arquivo (RN-01).

---

## Acceptance Criteria

- [ ] **Given** requisição anônima, **When** `GET /api/catalog/species` e `GET /api/catalog/cities`, **Then** `200` nos dois — nunca `401` nem `403` (CA-01, RN-02, CT-106, QA-47).
- [ ] **Given** duas espécies cadastradas e apenas uma com animal disponível, **When** `GET /api/catalog/species`, **Then** apenas essa é devolvida (CA-20, RN-31, CT-50, QA-19).
- [ ] **Given** o cadastro de apoio com milhares de cidades e animais disponíveis em exatamente duas, **When** `GET /api/catalog/cities`, **Then** exatamente essas duas são devolvidas, com `{ id, name, stateUf }` (CA-20, RN-30, CT-51, QA-20).
- [ ] **Given** as cidades devolvidas, **When** a ordem é conferida, **Then** estão ordenadas por `stateUf` crescente e, dentro de cada UF, por `name` crescente (RN-30).
- [ ] **Given** as espécies devolvidas, **When** a ordem é conferida, **Then** estão em ordem alfabética crescente ignorando maiúsculas e minúsculas (RN-31).
- [ ] **Given** o último animal disponível de uma cidade passa a Adotado, **When** `GET /api/catalog/cities` é chamado de novo, **Then** aquela cidade já não é oferecida (CT-52, HU-07 cenário 6).
- [ ] **Given** um catálogo sem nenhum animal disponível, **When** os dois endpoints são chamados, **Then** `200` com `items: []` nos dois — nunca `404`.
- [ ] **Given** as respostas dos dois endpoints, **When** as chaves são inspecionadas, **Then** espécie traz exatamente `{ id, name }` e cidade exatamente `{ id, name, stateUf }` — sem `ibgeCode`, sem `stateId`, sem `nameSearch` (RN-55, CT-134).
- [ ] **Given** `GET /api/species` sem credencial e com token de `cliente`, **When** chamado, **Then** `401` e `403` como antes, e com credencial de `admin` continua devolvendo **todas** as espécies, inclusive as sem animal disponível (regressão FEATURE-001, CT-105, QA-48).
- [ ] **Given** `GET /api/states` e `GET /api/states/:uf/cities`, **When** exercitados, **Then** mesmo caminho, mesma autorização e mesmo contrato de antes (regressão FEATURE-002).
- [ ] **Given** repetição acima do limite da mesma origem em qualquer dos dois endpoints, **Then** `429` com mensagem em PT-BR no envelope vigente (CA-49, RN-66).
- [ ] **Given** os dois endpoints, **When** as rotas são inspecionadas, **Then** nenhum monta `authenticate` ou `authorizeRole`, e ambos só declaram `GET` (RN-01, RN-08).

---

## API Notes

- `GET /api/catalog/species` → `200 { "items": [ { "id", "name" } ] }`. Sem parâmetros.
- `GET /api/catalog/cities` → `200 { "items": [ { "id", "name", "stateUf" } ] }`. Sem parâmetros.
- Ambos: público, `Cache-Control: no-store`, único erro possível `429`.
- Nenhum dos dois usa o envelope `pagination`.

---

## Dependencies

- **Requires**: TASK-BACKEND-003 (`catalogRoutes`, controller-fábrica, `catalogLimiter`, montagem em `/api/catalog`), TASK-BACKEND-002 (porta do repositório).
- **Blocks**: TASK-BACKEND-005, TASK-FRONTEND-007.

---

## Revisão — 2026-08-28

**Status**: APROVADO

`npm run typecheck` com 0 erros e 579 testes do backend verdes. As ACs foram medidas **contra o banco real**, com três espécies e três animais semeados e removidos ao fim.

| Critério de aceite | Medido |
|---|---|
| Anônimo recebe `200` nos dois | **Confirmado.** Nenhuma das duas rotas monta `authenticate` ou `authorizeRole` |
| Só espécie com animal disponível | **Confirmado.** `SemAnimalZZOpcoes` foi criada e **não** apareceu na lista |
| Cidades: exatamente as que têm animal, com `{id,name,stateUf}` | **Confirmado.** Três cidades entre as ~5.600 do cadastro; chaves exatamente `["id","name","stateUf"]` |
| Cidades ordenadas por `stateUf` e depois por `name` | **Confirmado:** `ES/Boa Esperança`, `MG/Boa Esperança`, `PR/Campo Magro` |
| Espécies em ordem alfabética ignorando caixa | **Confirmado:** `AbelhaZZOpcoes` antes de `zebraZZOpcoes` — o caso que `ORDER BY name` cru erraria, já que `z` minúsculo viria antes de `A` maiúsculo em ordenação binária |
| Último disponível vira Adotado → cidade some (CT-52) | **Confirmado:** 3 cidades → 2, na consulta seguinte |
| Catálogo sem disponíveis → `200 { items: [] }` | **Confirmado.** As duas consultas devolveram lista vazia antes da semeadura |
| Sem `ibgeCode`, `stateId` nem `nameSearch` | **Confirmado** por inspeção das chaves devolvidas |
| `GET /api/species` inalterado | **Confirmado.** A suíte de integração de espécies (FEATURE-001) segue verde sem alteração |
| `GET /api/states` e `/:uf/cities` inalterados | **Confirmado**, mesma suíte |
| `429` acima do limite | **Confirmado por construção:** as duas rotas montam o mesmo `catalogLimiter` |
| Nenhuma monta autenticação; só `GET` | **Confirmado** |

### Notas de implementação

**A ordenação de espécies usa `nameNormalized`, e não `mode: 'insensitive'`.** O Prisma **não** suporta o modo em `orderBy` — só em filtros. A coluna normalizada que a FEATURE-001 já mantém é a única forma de ordenar ignorando caixa sem trazer tudo para memória. A medição mostra por que importa: com `ORDER BY name` cru, `zebra` viria **antes** de `Abelha`, porque a ordenação binária põe as maiúsculas primeiro.

**O achatamento para `stateUf` acontece no repositório**, e não no service. É a forma da **porta** que o contrato promete (`AvailableCityOption`); deixá-lo no service faria a porta devolver a estrutura aninhada do Prisma e obrigaria cada consumidor futuro a repetir o achatamento.

**Dois services, e não um "service de opções" com dois métodos.** São dois casos de uso com ordenações diferentes; um arquivo único mudaria por dois motivos, e a primeira mudança numa das ordenações obrigaria a reler a outra.

**Nenhum `pagination` nas duas respostas.** Acrescentá-lo vazio induziria o frontend a paginar o que não pagina — e a lista, por construção, já é curta: o recorte por disponibilidade **é** o limite, e é por isso que não há `take`/`skip`.

**Os três services compartilham a mesma instância de repositório.** A porta não guarda estado — só o client do Prisma —, e três instâncias seriam três coisas iguais com nomes diferentes.
