# TASK-BACKEND-006 — Leitura de animais: listagem paginada, consulta por identificador e idade derivada

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-006-backend-animals-read-paginacao-idade`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 6 of 18 — Domínio Animais: Leitura
**Generated**: `2026-08-25`

---

## Context

Entrega `GET /api/animals` (paginado no servidor desde a primeira entrega, RN-42) e `GET /api/animals/:id`, mais o mapper que produz a representação do animal do contrato — incluindo `ageInYears`, **calculado a cada resposta e jamais persistido** (RN-20). O mapper criado aqui é o único ponto que serializa animal em toda a feature, e é ele que torna a projeção explícita da RN-59 uma restrição estrutural em vez de uma recomendação.

---

## Scope

**In:** Repositório de animais (leitura), mapper da representação do animal, utilitário de idade no fuso America/Sao_Paulo, services de listagem e de consulta, controller, rotas, validadores de paginação e de `id`, catálogo de mensagens do domínio, erro `ANIMAL_NOT_FOUND` e montagem em `/api/animals`.

**Out:** Nenhuma escrita (TASK-BACKEND-007 a TASK-BACKEND-009). Nenhuma busca, filtro ou ordenação configurável — pertencem à feature de filtragem da vitrine (RN-42b). Nenhum endpoint anônimo nem projeção pública da vitrine: aqui só existe a representação administrativa; a projeção pública é da feature seguinte, e esta task apenas deixa o mapper pronto para que ela não serialize a entidade inteira.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Idade (RN-20) | `calculateAgeInYears(birthDate, now)` → campo `ageInYears`, `null` quando não há data |
| Animal inexistente (RN-44) | `AnimalNotFoundError` → `404 ANIMAL_NOT_FOUND` |
| Página de resultados | envelope `{ items, pagination: { page, pageSize, total } }` |
| Imagem de capa (RN-35) | `images[0]`, sempre `position` 0 |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.messages.ts` | acrescenta chaves de leitura |
| `create` | `src/domains/animals/animals.validators.ts` | schemas de leitura |
| `create` | `src/domains/animals/errors/animal.errors.ts` | erros do animal |
| `create` | `src/utils/age.ts` | idade em anos completos |
| `create` | `src/domains/animals/repositories/animal.repository.ts` | acesso a animals |
| `create` | `src/domains/animals/mappers/animal.mapper.ts` | representação do contrato |
| `create` | `src/domains/animals/services/list-animals.service.ts` | listagem paginada |
| `create` | `src/domains/animals/services/get-animal.service.ts` | consulta por id |
| `create` | `src/domains/animals/animals.controller.ts` | camada HTTP |
| `create` | `src/domains/animals/animals.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/animals |

---

## Implementation

> **Reference pattern**: `src/domains/geography/` (TASK-BACKEND-005) é a fatia vertical mais próxima e recém-criada; `src/domains/auth/mappers/user.mapper.ts` é o modelo do mapper; `src/utils/clock.ts` é obrigatório — **nenhum arquivo desta task instancia `new Date()`**, porque os testes de idade fixam o instante.

### `src/domains/animals/animals.messages.ts` *(modify)*
- **O arquivo JÁ EXISTE — não recriar.** A `TASK-BACKEND-003` precisou criá-lo: o invariante do projeto manda todo texto exibido ao usuário viver em `<dominio>.messages.ts` (precedentes: `auth.messages.ts`, `species.messages.ts`), e a entrada de arquivos daquela fatia já produz texto ao usuário. Ele hoje carrega `VALIDATION_GUARD`, `FIELD_NOT_ALLOWED`, `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `ANIMAL_IMAGE_TOO_LARGE`, `IMAGE_FILE_EMPTY`, `REQUEST_BODY_TOO_LARGE` e `UNSUPPORTED_MEDIA_TYPE`. Sobrescrevê-lo apagaria as mensagens que o middleware de upload consome e derrubaria a suíte da 003.
- **ACRESCENTAR** ao objeto existente as chaves de leitura: `ANIMAL_NOT_FOUND` e `INVALID_IDENTIFIER`. `VALIDATION_GUARD` ("Verifique os campos informados.") **já está lá** — reusar, não duplicar.
- As demais entram nos slices de escrita — não antecipar.

### `src/domains/animals/animals.validators.ts` *(create)*
- `listAnimalsQuerySchema`: `page` `z.coerce.number().int().min(1).default(1)`; `pageSize` `z.coerce.number().int().min(1).max(100).default(20)`. `.strict()`.
- `animalIdParamsSchema`: `{ id: z.string().uuid() }` com mensagem `INVALID_IDENTIFIER` no `field` `id`.
- `pageSize: 0` e `pageSize: 101` são `400` — a faixa é fechada nos dois extremos (CT-28).

### `src/utils/age.ts` *(create)*
- `calculateAgeInYears(birthDate: Date | null, now: Date): number | null`.
- `null` quando `birthDate` é `null`. **`null` é diferente de `0`** — zero significa "menos de um ano", e confundir os dois faz a interface exibir "0 anos" para um animal cuja idade ninguém sabe (RN-21).
- Comparação feita sobre a data civil no fuso **America/Sao_Paulo**, obtida por `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` — não por subtração de milissegundos e não pelo fuso do processo. Com o servidor em UTC, às 22h em São Paulo já é o dia seguinte em UTC (RN-22, RNF-10).
- Anos **completos**: quem nasceu em 05/11/2022 tem 3 anos em 25/08/2026 e 4 em 06/11/2026.
- Função pura, sem `new Date()` interno — o `now` é sempre injetado por quem chama, a partir de `~/utils/clock.ts`.

### `src/domains/animals/repositories/animal.repository.ts` *(create)*
- Interface `AnimalRepository` + `PrismaAnimalRepository`. Métodos desta fatia: `listPaginated({ skip, take }): Promise<{ items; total }>` e `findById(id)`, ambos com `include` de `species`, `city` (com `state`) e `images` ordenadas por `position`.
- Ordenação **exatamente** `[{ nameNormalized: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]`. Os três critérios são obrigatórios: sem o desempate final pelo identificador, dois animais cadastrados no mesmo instante trocam de posição entre páginas, e um registro aparece duas vezes enquanto outro desaparece (RN-41, RNF-08).
- `listPaginated` devolve itens e total em **uma** `$transaction` com `findMany` + `count`, para que os dois enxerguem o mesmo instantâneo. Contados fora, um cadastro concorrente produz um total incoerente com a página.
- Ausência é `null`; o repositório não lança erro HTTP.

### `src/domains/animals/mappers/animal.mapper.ts` *(create)*
- `toAnimalResponse(animal, now): AnimalResponse` produzindo **exatamente** o objeto do bloco "Representação do animal" da spec.
- **Projeção campo a campo, explícita.** Proibido `...animal` ou qualquer forma de espalhar a entidade. Hoje não existe campo interno — e é exatamente por isso que a regra nasce agora: quando o número do chip e o contato do proprietário entrarem, eles não vazarão por padrão só porque alguém devolveu o objeto inteiro (RN-59, CA-45).
- `birthDate` sai como `AAAA-MM-DD`, sem hora e sem fuso. Uma data de nascimento não tem horário, e serializar `Date` em ISO com `Z` faria a interface exibir o dia anterior para quem está a oeste de Greenwich.
- `ageInYears` vem de `calculateAgeInYears`, nunca de coluna.
- `city` sai como `{ id, name, stateUf }` — a UF é **derivada** da cidade, e não um campo independente que possa divergir dela (RN-28).
- `images` sempre ordenado por `position`; `position` 0 é a capa.
- `updatedAt` é serializado porque é o token de concorrência que a edição e a alteração de status exigem de volta (RN-47).

### `src/domains/animals/services/list-animals.service.ts` *(create)*
- `execute({ page, pageSize })` → `skip = (page - 1) * pageSize`.
- Devolve `{ items: items.map(a => toAnimalResponse(a, now())), pagination: { page, pageSize, total } }`.
- Lista vazia é `200` com `items: []` e `total: 0`, **nunca** `404`.
- Página além do total responde `200` com `items: []` e o `total` real — não é erro.

### `src/domains/animals/services/get-animal.service.ts` *(create)*
- `findById` → `null` ⇒ `AnimalNotFoundError`. A mensagem não distingue "nunca existiu" de "já foi excluído" (RN-44).

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(create)*
- Fábrica `createAnimalsController(deps)`; dois handlers `200`.
- Apenas `admin` autenticado lista ou consulta animais (RN-01); nenhum endpoint desta feature é anônimo (RN-02).
- `GET /` e `GET /:id`, ambos `authenticate` → `authorizeRole('ADMIN')` → `validateRequest(...)` → handler. Autenticar antes de autorizar.
- As rotas de escrita entram neste mesmo arquivo nas TASK-BACKEND-007 a 009 — deixar o arquivo preparado para recebê-las, sem criá-las.

### `src/routes/index.ts` *(modify)*
- `router.use('/animals', animalsRoutes)`.

---

## Acceptance Criteria

- [ ] **Given** três animais chamados "theo", "Bidu" e "Amora", **When** `GET /api/animals`, **Then** a ordem é "Amora", "Bidu", "theo" — alfabética ignorando maiúsculas e minúsculas (CT-25).
- [ ] **Given** 45 animais com o mesmo `createdAt`, **When** as três páginas de `pageSize: 20` são percorridas, **Then** retornam 45 identificadores distintos, sem repetição e sem omissão (CT-26, CA-08, RNF-08).
- [ ] **Given** o cadastro vazio, **When** `GET /api/animals`, **Then** `200` com `items: []` e `pagination.total: 0` (CT-29).
- [ ] **Given** `pageSize: 0` e `pageSize: 101`, **When** consultados, **Then** ambos respondem `400 VALIDATION_ERROR` (CT-28).
- [ ] **Given** um animal nascido em 05/11/2022 e o relógio fixado em 25/08/2026, **When** consultado, **Then** `ageInYears` é `3`; **Given** o relógio fixado em 06/11/2026, **Then** é `4`, e **nenhuma escrita no banco ocorre entre as duas consultas** (CT-18, CT-19, CA-14, RNF-09).
- [ ] **Given** um animal sem data de nascimento, **When** consultado, **Then** `birthDate` e `ageInYears` são ambos `null` — nunca `0` (CT-20, RN-21).
- [ ] **Given** o processo em UTC e o relógio às 22h de São Paulo, **When** a idade de um animal nascido hoje é calculada, **Then** o resultado é `0` e não `-1` nem erro (RNF-10).
- [ ] **Given** um animal com duas imagens, **When** consultado, **Then** `images` vem ordenado por `position` e `images[0].position` é `0` (CT-31).
- [ ] **Given** a saída do mapper, **When** comparada ao bloco de representação da spec, **Then** os nomes e tipos de campo coincidem exatamente e **nenhum** campo extra da entidade aparece (CA-45, RNF-23).
- [ ] **Given** um `id` que não é UUID, **When** `GET /api/animals/:id`, **Then** `400` com `details: [{ field: "id", message: "Identificador inválido." }]` (CT-92).
- [ ] **Given** um `id` UUID inexistente, **When** consultado, **Then** `404 ANIMAL_NOT_FOUND` com "Animal não encontrado." (CA-39).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — nos dois endpoints (CA-40).
- [ ] **Given** 500 animais cadastrados, **When** a primeira página é consultada, **Then** a resposta chega em menos de 2 segundos — os índices da RN-41 são o que sustenta isso, e um `include` sem índice em `species`/`city` é o defeito que só aparece com volume (CT-98, RNF-11).
- [ ] **Given** o código desta task, **When** inspecionado, **Then** não há nenhuma ocorrência de `new Date()`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (modelos), TASK-BACKEND-002 (cidades para o `include`), TASK-BACKEND-005 (molde da fatia vertical e `authorizeRole` já montado).
- **Blocks**: TASK-BACKEND-007 a TASK-BACKEND-009 (reusam repositório, mapper, controller, rotas e catálogo), TASK-FRONTEND-013, TASK-FRONTEND-016, TASK-BACKEND-011.
