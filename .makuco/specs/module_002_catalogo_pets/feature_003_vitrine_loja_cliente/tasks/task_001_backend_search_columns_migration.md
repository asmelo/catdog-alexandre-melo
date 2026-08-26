# TASK-BACKEND-001 — Colunas de busca sem acento, índice da vitrine e normalizador compartilhado

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-001-backend-search-columns-migration`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 1 of 11 — Fundação de dados da vitrine
**Generated**: `2026-08-25`

---

## Context

A vitrine precisa de busca insensível a acentos, e o construtor de consultas do Prisma oferece `mode: 'insensitive'` para caixa mas **não** para diacríticos (Decisão B da spec). Esta task entrega a base de dados dessa busca: duas colunas persistidas `name_search`, o índice composto que sustenta a ordenação da vitrine, e o normalizador que produz os dois lados da comparação. Nenhum endpoint é criado aqui.

---

## Scope

**In:** `normalizeForSearch` em `src/utils/text-normalizer.ts`; `nameSearch` em `Animal` e em `City` no schema Prisma; índice `@@index([status, createdAt, id])` em `Animal`; migration aditiva com backfill reexecutável; gravação de `nameSearch` no caminho de escrita de animal da FEATURE-002 e na carga inicial de municípios.

**Out:**
- Não tocar em `nameNormalized` de `Animal` nem em nenhuma consulta que o use. Ele é **minúsculo mas preserva acentos de propósito** e serve à ordenação alfabética administrativa (RN-41 da FEATURE-002 deste módulo). Confundir os dois quebra aquela feature em silêncio, sem quebrar nenhum teste dela.
- Não expor `nameSearch` em nenhum mapper, DTO ou resposta — nem pública nem administrativa.
- Não criar domínio `catalog`, endpoint, validador ou consulta de busca (TASK-BACKEND-002 a 004).
- Não remover, renomear ou alterar nenhuma coluna, tabela, índice ou enum existente.
- Sem testes (TASK-BACKEND-005).

---

## Ubiquitous Language

| Termo de negócio | Mapeamento em código |
|---|---|
| Busca livre (texto comparado a nome do animal **ou** nome da cidade) | `normalizeForSearch(texto)` comparado a `animals.name_search` e `cities.name_search` |
| Nome normalizado para ordenação (acentos preservados) | `Animal.nameNormalized` — **não é** `nameSearch` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/utils/text-normalizer.ts` | normalizador sem diacríticos |
| `modify` | `prisma/schema.prisma` | duas colunas e índice |
| `create` | `prisma/migrations/<timestamp>_catalog_search_columns/migration.sql` | migração aditiva com backfill |
| `modify` | `src/domains/animals/services/create-animal.service.ts` | grava nameSearch |
| `modify` | `src/domains/animals/services/update-animal.service.ts` | grava nameSearch |
| `modify` | `prisma/seed-locations.ts` | preenche nameSearch de cidades |

> Os nomes dos dois services e do seed de localidades são os entregues pela FEATURE-002 deste módulo; se a nomenclatura final divergir, alterar **todo** caminho que grave `Animal.name` e a carga de `cities`, sem exceção.

---

## Implementation

### `src/utils/text-normalizer.ts` *(create)*
**Reference pattern**: `src/utils/clock.ts` — módulo de funções puras, sem estado, sem dependência externa.

**Diferenças / decisões já fechadas**:
- `normalizeForSearch(valor: string): string` = colapsar espaços internos e aparar as extremidades → `normalize('NFD')` → remover a faixa de marcas combinantes (`/\p{Diacritic}/gu` ou `/[̀-ͯ]/g`) → `toLowerCase()`. Sem `normalize('NFC')` de volta: o resultado já não tem marca a recompor.
- "Cão Pastor" → `cao pastor`; "São Paulo" → `sao paulo`; `"  campo   magro  "` → `campo magro`.
- **A mesma função normaliza os dois lados da comparação** — a coluna gravada e o texto que o visitante digitou. É essa simetria, e não a collation do Postgres, que torna a busca determinística e reproduzível em teste (RN-23, RN-26).
- Nenhuma dependência nova: `String.prototype.normalize` é da plataforma (CA-55).
- Exportar também a constante de colapso de espaços se a FEATURE-002 já tiver uma equivalente — **reaproveitar, nunca duplicar** a normalização de espaços que ela aplica a `Animal.name`.

### `prisma/schema.prisma` *(modify)*
- `Animal`: `nameSearch String @map("name_search") @db.VarChar(60)` e `@@index([status, createdAt, id])`.
- `City`: `nameSearch String @map("name_search") @db.VarChar(120)`.
- Comentários `///` obrigatórios em ambas, no estilo já usado no arquivo, declarando: (a) que a coluna serve **apenas** à busca da vitrine; (b) que **não substitui** `nameNormalized`; (c) que não é exposta por nenhuma API. A regra fora do schema fica invisível para quem ler só o modelo.
- O `@@index([status])` já existente em `Animal` **permanece** — ele serve às consultas administrativas por status. O índice novo cobre filtro + ordenação + desempate da vitrine em um só passo (RN-09, RN-14, RN-15).
- Larguras espelham as dos nomes de origem (60 e 120): a normalização nunca alonga a cadeia.

### `prisma/migrations/<timestamp>_catalog_search_columns/migration.sql` *(create)*
- Ordem obrigatória: `ADD COLUMN ... NULL` → `UPDATE` de backfill → `SET NOT NULL` → `CREATE INDEX`. Adicionar já como `NOT NULL` sem default falha em base com registros.
- Backfill em SQL puro, com `unaccent` **proibido** (a extensão não está habilitada e habilitá-la é justamente a alternativa recusada). Usar `lower(translate(regexp_replace(btrim(name), '\s+', ' ', 'g'), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))` — cobre integralmente o repertório PT-BR de `species`, `animals` e do recorte IBGE de `cities`.
- Reexecutável: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, e o `UPDATE` de backfill restrito a `WHERE name_search IS NULL` na segunda passagem.
- **Nada de `DROP`, `ALTER COLUMN TYPE` ou `RENAME`** neste arquivo (CA-56).

### `src/domains/animals/services/create-animal.service.ts` e `update-animal.service.ts` *(modify)*
- Onde hoje se calcula `nameNormalized`, calcular **também** `nameSearch: normalizeForSearch(nome)` e persistir na mesma operação. `nameNormalized` continua sendo calculado exatamente como está — não trocar a sua implementação pela nova função.
- Esta é a **única** alteração desta feature em código entregue pela FEATURE-002 deste módulo, e tem item de regressão próprio.

### `prisma/seed-locations.ts` *(modify)*
- A carga dos municípios passa a gravar `nameSearch` junto de `name`, casando por `ibgeCode` como já faz. A carga é idempotente: reexecutá-la corrige registros anteriores à migração.
- `City.nameSearch` **não** é recalculado em runtime por nenhum service — não há tela de manutenção de município.

---

## Acceptance Criteria

- [ ] **Given** `normalizeForSearch`, **When** recebe `"  São   PAULO "`, `"Cão"`, `"José"`, **Then** devolve `"sao paulo"`, `"cao"`, `"jose"` (RN-23, RN-26).
- [ ] **Given** `normalizeForSearch`, **When** recebe `"   "`, **Then** devolve `""` — cadeia vazia é o sinal de "busca não aplicada" consumido pela TASK-BACKEND-003 (RN-26).
- [ ] **Given** um animal cadastrado com nome acentuado, **When** o registro é lido no banco, **Then** `name_search` está preenchido sem acento e em minúsculas, e `name_normalized` continua **com** os acentos (CT-132, regressão FEATURE-002).
- [ ] **Given** um animal existente, **When** o administrador o renomeia, **Then** `name_search` é reescrito na mesma gravação (CT-132, QA-62).
- [ ] **Given** uma base com animais e cidades criados **antes** desta migração, **When** a migração roda, **Then** todos ficam com `name_search` preenchido e nenhum permanece nulo (CT-133, CA-56).
- [ ] **Given** a migração já aplicada, **When** ela é executada uma segunda vez, **Then** conclui sem erro e sem alterar dado algum.
- [ ] **Given** a resposta de `GET /api/animals` e a de qualquer endpoint administrativo, **When** as chaves são inspecionadas, **Then** `nameSearch` / `name_search` não aparece em nenhuma delas (CT-134).
- [ ] **Given** a listagem administrativa de animais, **When** é ordenada alfabeticamente, **Then** a ordem é **idêntica** à anterior a esta task — ela continua usando `nameNormalized` (regressão FEATURE-002).
- [ ] **Given** o schema após a migração, **When** os índices de `animals` são listados, **Then** existem tanto `[status]` quanto `[status, createdAt, id]`.
- [ ] **Given** o `package.json` antes e depois, **When** comparado, **Then** nenhuma dependência foi acrescentada (CA-55).
- [ ] `npx prisma migrate deploy` e `npm run typecheck` concluem com 0 erros.

---

## API Notes

Nenhum endpoint é criado, alterado ou removido nesta task. `GET /api/animals`, `GET /api/species`, `GET /api/states` e `GET /api/states/:uf/cities` mantêm caminho, autorização, contrato e mensagens.

---

## Dependencies

- **Requires**: FEATURE-002 do MODULE-002 completa — tabelas `animals`, `animal_images`, `states`, `cities`, enums `AnimalSize`/`AnimalSex`/`AnimalStatus`, services de escrita de animal e carga inicial de municípios. **Esta feature não pode ser iniciada antes dela.**
- **Blocks**: TASK-BACKEND-002 (a consulta da vitrine lê `name_search` e depende do índice), TASK-BACKEND-003, TASK-BACKEND-005.
