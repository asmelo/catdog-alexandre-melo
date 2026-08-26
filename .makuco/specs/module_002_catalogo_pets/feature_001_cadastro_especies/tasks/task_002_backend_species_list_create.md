# TASK-BACKEND-002 — Listar e criar espécies (`GET` / `POST /api/species`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-species-list-create`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 2 of 11 — Domínio Species: Listagem e Criação
**Generated**: `2026-08-25`

---

## Context

Primeira fatia com endpoint funcional: `GET /api/species` (HU-03) e `POST /api/species` (HU-02), com as regras RN-01 a RN-06, RN-11, RN-12, RN-13 e RN-16. Esta task monta as rotas em `/api/species` e é a **primeira consumidora do `authorizeRole('admin')`** — o middleware existe e está testado desde a FEATURE-002, mas nenhuma rota o montava ainda.

---

## Scope

**In:** Mapper, repositório de `Species`, validadores Zod, os dois services (listar e criar), a fábrica de controller, o arquivo de rotas e a montagem em `src/routes/index.ts`.

**Out:** Nada de renomeação (TASK-BACKEND-003) nem de exclusão (TASK-BACKEND-004) — os métodos de repositório dessas duas operações **não** entram aqui, para que o slice não carregue código morto. Não alterar `prisma/schema.prisma` (TASK-BACKEND-001). Não acrescentar limitador de taxa a nenhuma rota — decisão registrada no changelog (Decisão 7). Não implementar paginação, filtro nem ordenação configurável (RN-12). Não expor `nameNormalized` na API. Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/species/mappers/species.mapper.ts` | projeção pública |
| `create` | `src/domains/species/repositories/species.repository.ts` | acesso a species |
| `create` | `src/domains/species/species.validators.ts` | schemas Zod |
| `create` | `src/domains/species/services/list-species.service.ts` | regra de listagem |
| `create` | `src/domains/species/services/create-species.service.ts` | regra de criação |
| `create` | `src/domains/species/species.controller.ts` | camada HTTP |
| `create` | `src/domains/species/species.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/species |

---

## Implementation

> **Reference pattern**: `src/domains/auth/` inteiro é o molde de camadas — `auth.validators.ts`, `repositories/user.repository.ts`, `auth.controller.ts` (fábrica `createAuthController`) e `auth.routes.ts`. O `src/domains/auth/mappers/user.mapper.ts` é o molde do mapper.

### `src/domains/species/mappers/species.mapper.ts` *(create)*
- Interface `PublicSpecies { id; name; createdAt: string; updatedAt: string }` e função `toPublicSpecies(species: Species): PublicSpecies`.
- `nameNormalized` **não** entra na projeção — é detalhe de persistência. Como em `user.mapper.ts`, campo que não existe no tipo não vaza por descuido de serialização.
- Datas saem como ISO-8601 (`.toISOString()`), coerentes com o exemplo da spec (`"2026-08-25T13:40:12.481Z"`). Converter aqui e não deixar para o `res.json` torna o contrato explícito no tipo.

### `src/domains/species/repositories/species.repository.ts` *(create)*
- Interface `SpeciesRepository` no domínio + `PrismaSpeciesRepository` recebendo `Prisma.TransactionClient` no construtor, com `withTransaction(executor)` — mesmo formato de `refresh-token.repository.ts`.
- Métodos **deste slice apenas**: `listAll(): Promise<Species[]>`, `findByNameKey(nameNormalized): Promise<Species | null>`, `create(data: { name; nameNormalized }): Promise<Species>`.
- `listAll` usa `orderBy: { nameNormalized: 'asc' }` — é a RN-11 em uma linha: a coluna já está em minúsculas, então a ordenação do Postgres ignora caixa sem depender de `mode: 'insensitive'` nem de collation do ambiente (CT-13 / CT-14).
- Nada aqui lança erro HTTP; ausência é `null`.
- **Não** declarar `update`, `delete` nem `countAnimalsBySpecies` — eles chegam nas tasks 003 e 004.

### `src/domains/species/species.validators.ts` *(create)*
- `speciesNameSchema`: `z.string()` com `.transform(normalizeSpeciesName)` aplicado **antes** das medições, seguido de `.refine`/`.superRefine` que produzem, nesta ordem de precedência:
  1. vazio após normalizar → `MESSAGES.NAME_REQUIRED` (cobre `""` e `"   "`, CT-02/CT-03);
  2. comprimento < 2 → `MESSAGES.NAME_TOO_SHORT` (CT-04);
  3. comprimento > 60 → `MESSAGES.NAME_TOO_LONG` (CT-07).
  A ordem importa: sem ela, `"   "` reportaria "mínimo 2 caracteres" em vez de obrigatoriedade, contrariando a tabela de mensagens.
- `createSpeciesSchema = z.object({ name: speciesNameSchema }).strict()` — o `.strict()` é o que produz `400 VALIDATION_ERROR` para chave extra no corpo (CT-33), mesmo tratamento já adotado em `registerSchema`. Ajustar a mensagem da chave extra para `MESSAGES.FIELD_NOT_ALLOWED`.
- Tipos derivam por `z.infer`; não criar arquivos de DTO.
- Como o schema já normaliza, o service e o repositório recebem o nome **pronto** — não normalizar de novo em nenhuma camada abaixo.

### `src/domains/species/services/list-species.service.ts` *(create)*
- Classe com `execute(): Promise<ReadonlyArray<PublicSpecies>>`. Dependência única injetada: `SpeciesRepository`.
- Sem argumentos e sem ramo de "lista vazia": cadastro vazio devolve `[]` e o controller responde `200 { items: [] }` — nunca `404` (CT-15).

### `src/domains/species/services/create-species.service.ts` *(create)*
- Dependência injetada: `SpeciesRepository`. `execute(input: { name: string }): Promise<PublicSpecies>`.
- Passos: `chave = speciesNameKey(input.name)` → `findByNameKey(chave)` → se existir, lança `SpeciesNameAlreadyExistsError` (RN-06) → senão `create({ name: input.name, nameNormalized: chave })`.
- **Obrigatório**: envolver o `create` em `try/catch` e traduzir `PrismaClientKnownRequestError` com `code === 'P2002'` para o **mesmo** `SpeciesNameAlreadyExistsError`. Sem isso, duas criações simultâneas do mesmo nome produziriam uma `409` e uma `500` — a RN-16 e o CT-12 exigem que as duas origens do conflito respondam idêntico. A consulta prévia existe para o caso comum; a tradução do `P2002` é a que fecha a janela de corrida.
- Não usar `$transaction`: é uma escrita única e a garantia de unicidade é do índice, não de leitura-e-escrita atômica.
- **Não** usar `new Date()` — `createdAt`/`updatedAt` vêm dos defaults do schema.

### `src/domains/species/species.controller.ts` *(create)*
- Fábrica `createSpeciesController(dependencias?: SpeciesControllerDependencies)` no mesmo formato de `createAuthController()`: instancia repositório e services **uma vez**, na montagem, nunca por requisição.
- Dois handlers finos: `list` → `200 { items }`; `create` → `201` com o `PublicSpecies` **plano** (sem envelope), coerente com a "Representação da espécie" da spec.
- O envelope `{ items }` é aplicado no controller e não no service: é decisão de formato HTTP. Registrar em comentário que este é o **primeiro endpoint de coleção do projeto** e que `{ items: [...] }` passa a ser o padrão de coleção — array puro não admite metadados futuros e a chave `data` não existe em nenhum ponto do contrato atual (Decisão 8 do changelog).
- Sem `try/catch`: `express-async-errors` encaminha ao `error-handler.middleware.ts`, único ponto que monta corpo de erro.

### `src/domains/species/species.routes.ts` *(create)*
- `export const speciesRoutes: Router`.
- Ordem dos middlewares, obrigatória em toda rota do arquivo: `authenticate` → `authorizeRole('admin')` → `validateRequest(...)` → handler. `authorizeRole` **depois** de `authenticate` porque ele lê `req.authUser`; montado antes, ele lança `SessionExpiredError` (401) e a rota nunca autorizaria ninguém.
- `GET /` → `authenticate`, `authorizeRole('admin')`, `controller.list`. Sem `validateRequest`: a rota não aceita corpo, parâmetro nem query (RN-12).
- `POST /` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ body: createSpeciesSchema })`, `controller.create`.
- Comentário obrigatório: **sem limitador de taxa** nesta feature, e por quê (CRUD administrativo autenticado, sem credencial e sem envio de e-mail — Decisão 7).

### `src/routes/index.ts` *(modify)*
- Uma linha: `router.use('/species', speciesRoutes)`, abaixo de `router.use('/auth', authRoutes)`. Nada mais neste arquivo muda.

---

## Acceptance Criteria

- [ ] **Given** sessão de `admin` e três espécies `"Sapo"`, `"Gato"`, `"Cachorro"`, **When** `GET /api/species`, **Then** responde `200 { items: [...] }` na ordem `"Cachorro"`, `"Gato"`, `"Sapo"` (CT-13).
- [ ] **Given** as espécies `"gato"` e `"Cachorro"`, **When** `GET /api/species`, **Then** `"Cachorro"` vem antes de `"gato"` — a ordenação ignora caixa (CT-14 / RN-11).
- [ ] **Given** cadastro vazio, **When** `GET /api/species`, **Then** responde `200 { "items": [] }` — nunca `404` (CT-15).
- [ ] **Given** qualquer resposta dos dois endpoints, **When** o corpo é inspecionado, **Then** nenhum objeto contém a chave `nameNormalized`, e cada espécie traz exatamente `id`, `name`, `createdAt`, `updatedAt`.
- [ ] **Given** `{ "name": "Cachorro" }`, **When** `POST /api/species`, **Then** responde `201` com a espécie criada e o registro persiste com `name_normalized = 'cachorro'` (CT-01).
- [ ] **Given** `{ "name": "" }` ou `{ "name": "   " }`, **When** `POST`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "name", message: "Este campo é obrigatório." }]` e nada é criado (CT-02 / CT-03).
- [ ] **Given** `{ "name": "G" }`, **Then** `400` com "O nome da espécie deve ter no mínimo 2 caracteres." (CT-04); **Given** `{ "name": "Ov" }`, **Then** `201` (CT-05).
- [ ] **Given** nome com exatamente 60 caracteres, **Then** `201` (CT-06); **Given** 61 caracteres, **Then** `400` com "O nome da espécie deve ter no máximo 60 caracteres." (CT-07 / RN-02).
- [ ] **Given** a espécie `"Gato"` já cadastrada, **When** `POST` com `"gato"`, `"GATO"` ou `"  Gato  "`, **Then** `409 SPECIES_NAME_ALREADY_EXISTS` com "Já existe uma espécie com este nome." e a contagem de espécies não muda (CT-08 / CT-09).
- [ ] **Given** `{ "name": " Cão   Pastor " }`, **When** `POST`, **Then** o `name` persistido e devolvido é `"Cão Pastor"`, e a medição de tamanho, a gravação e a comparação de unicidade usaram esse mesmo valor normalizado (CT-10 / RN-03 / CA-07).
- [ ] **Given** `"Réptil"` já cadastrada, **When** `POST` com `"Reptil"`, **Then** `201` — as duas coexistem (CT-11 / RN-05).
- [ ] **Given** duas requisições concorrentes com o mesmo nome, **When** processadas, **Then** exatamente uma responde `201` e a outra responde `409 SPECIES_NAME_ALREADY_EXISTS` — nunca `500` e nunca duas `201` (CT-12 / RN-16 / CA-09).
- [ ] **Given** `{ "name": "Gato", "descricao": "x" }`, **When** `POST`, **Then** `400 VALIDATION_ERROR` apontando a chave extra e nada é criado (CT-33 / RN-13).
- [ ] **Given** requisição sem `Authorization`, **When** `GET` ou `POST /api/species`, **Then** `401 SESSION_EXPIRED` com "Sua sessão expirou. Faça login novamente." (CT-31 / RNF-01).
- [ ] **Given** sessão válida com role `cliente`, **When** `GET` ou `POST /api/species`, **Then** `403 FORBIDDEN` com "Você não tem permissão para acessar este recurso." e nada é criado (CT-30 / RN-01 / CA-18).
- [ ] Todas as respostas de erro dos dois endpoints saem como `{ error: { code, message, details? } }`, montadas exclusivamente pelo `error-handler.middleware.ts` (RNF-11 / CA-22).
- [ ] `GET /api/health` e todas as rotas de `/api/auth` continuam respondendo exatamente como antes.

---

## API Notes

- `GET /api/species` → `200 { items: PublicSpecies[] }`. Sem parâmetros, sem paginação.
- `POST /api/species` — body `{ name }` → `201 PublicSpecies`. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `409 SPECIES_NAME_ALREADY_EXISTS`.
- **Por que `{ items }` e não array puro**: é o primeiro endpoint de coleção do projeto e vira o padrão. Um array puro impede acrescentar metadados sem quebrar quem já consome.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (modelo `Species`, migration, `species.messages.ts`, `species.errors.ts`, `species-name.ts`); FEATURE-002 (`authenticate`, `authorizeRole`, `validateRequest`, `error-handler`, `prisma-client`).
- **Blocks**: TASK-BACKEND-003 e TASK-BACKEND-004 (reusam repositório, controller e `species.routes.ts`), TASK-BACKEND-005 (testes), TASK-FRONTEND-008 (a camada de API consome estes contratos).
