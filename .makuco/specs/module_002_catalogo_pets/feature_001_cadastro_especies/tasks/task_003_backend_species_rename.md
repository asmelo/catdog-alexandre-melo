# TASK-BACKEND-003 — Renomear espécie (`PATCH /api/species/:id`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-003-backend-species-rename`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 3 of 11 — Domínio Species: Renomeação
**Generated**: `2026-08-25`

---

## Context

Implementa a HU-04 no servidor, com as regras RN-04, RN-07, RN-14, RN-15 e RN-16. O ponto delicado é a RN-07: renomear para o próprio nome atual, ignorando caixa e espaços, é a forma de o administrador corrigir "gato" para "Gato" — e precisa responder `200`, nunca `409`.

---

## Scope

**In:** Schema Zod do parâmetro de caminho e do corpo do `PATCH`, os métodos de renomeação no repositório, o service, o handler no controller e a rota.

**Out:** Nada de exclusão (TASK-BACKEND-004). Não alterar `prisma/schema.prisma`, `src/routes/index.ts` nem o mapper. Não usar o verbo `PUT` — a configuração de CORS em vigor (`src/config/cors.ts`) não o libera e alterá-la está fora do escopo (Decisão 3 do changelog). Não permitir alteração de nenhum campo além de `name` (RN-13). Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/species/species.validators.ts` | schema do PATCH |
| `modify` | `src/domains/species/repositories/species.repository.ts` | findById e rename |
| `create` | `src/domains/species/services/rename-species.service.ts` | regra de renomeação |
| `modify` | `src/domains/species/species.controller.ts` | handler rename |
| `modify` | `src/domains/species/species.routes.ts` | rota PATCH /:id |

---

## Implementation

> **Reference pattern**: os arquivos irmãos criados na TASK-BACKEND-002 — `create-species.service.ts` para o formato de service, e o bloco `POST /` de `species.routes.ts` para a ordem de middlewares.

### `src/domains/species/species.validators.ts` *(modify)*
- Acrescentar `speciesIdParamSchema = z.object({ id: z.string().uuid(MESSAGES.INVALID_ID) })` e `renameSpeciesSchema = z.object({ name: speciesNameSchema }).strict()`.
- `renameSpeciesSchema` reusa o **mesmo** `speciesNameSchema` da criação: as mensagens por campo do `PATCH` são idênticas às do `POST` por exigência do contrato ("Mesmas mensagens por campo do `POST`"). Não duplicar as regras de tamanho.
- O `.uuid()` produz `details: [{ field: "id", message: "Identificador inválido." }]` e é o que garante `400` em vez de `404` para identificador malformado (CT-34). O `field` sai como `id` porque o `validationErrorFromZodError` usa `issue.path.join('.')` — validar o parâmetro por `params` no `validateRequest`, não dentro do corpo.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
- Acrescentar à interface e à implementação: `findById(id): Promise<Species | null>` e `rename(id, data: { name; nameNormalized }): Promise<Species>`.
- `rename` usa `update({ where: { id }, data })` — `updatedAt` é gravado pelo `@updatedAt` do schema, sem `new Date()` no código.
- `findById` devolve `null` para inexistente; **não** usar `findUniqueOrThrow`, que lançaria erro do Prisma em vez de deixar o service produzir `SpeciesNotFoundError`.

### `src/domains/species/services/rename-species.service.ts` *(create)*
- Dependência injetada: `SpeciesRepository`. `execute(input: { id: string; name: string }): Promise<PublicSpecies>`.
- Ordem obrigatória de verificação:
  1. `findById(id)` → `null` ⇒ `SpeciesNotFoundError` (RN-14 / CT-20). Verificar a existência **antes** do conflito: uma espécie já excluída deve reportar "não encontrada", que é a informação acionável, e não "nome já existe".
  2. `chaveNova = speciesNameKey(input.name)`; se `chaveNova === especie.nameNormalized` ⇒ **não é conflito** (RN-07). Seguir direto para o `rename`, que grava a nova caixa em `name`. Esta comparação é o ponto exato onde CT-17 se resolve; sem ela, `"gato"` → `"Gato"` cairia no `findByNameKey` e devolveria `409` sobre a própria espécie.
  3. `findByNameKey(chaveNova)` → se existir e `id` for **diferente**, ⇒ `SpeciesNameAlreadyExistsError` (CT-18). A comparação de `id` é a rede de segurança do passo 2.
  4. `rename(id, { name: input.name, nameNormalized: chaveNova })`.
- Traduzir `PrismaClientKnownRequestError` `P2002` do `rename` para `SpeciesNameAlreadyExistsError` e `P2025` (registro não encontrado ao atualizar) para `SpeciesNotFoundError` — as duas cobrem a janela entre a leitura e a escrita, quando outra sessão renomeia ou exclui a mesma espécie.
- O `id` **nunca** é alterado (RN-15): `rename` recebe `id` apenas no `where`, nunca no `data`.

### `src/domains/species/species.controller.ts` *(modify)*
- Acrescentar `rename` à fábrica e ao objeto devolvido: lê `req.params.id` e `req.body.name`, chama **um** service e responde `200` com o `PublicSpecies` plano.
- Tipar os params do handler (`Request<{ id: string }>`) — o `SemParametros` usado no domínio auth não serve aqui.
- Instanciar `RenameSpeciesService` na mesma fábrica que já instancia os outros dois, reusando a instância existente de `SpeciesRepository`.

### `src/domains/species/species.routes.ts` *(modify)*
- `PATCH /:id` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ params: speciesIdParamSchema, body: renameSpeciesSchema })`, `controller.rename`.
- `PATCH` já está liberado em `src/config/cors.ts` (`methods: ['GET','POST','PATCH','DELETE','OPTIONS']`) — nenhuma alteração de CORS é necessária nem permitida.

---

## Acceptance Criteria

- [ ] **Given** a espécie `"Sapo"` e sessão de `admin`, **When** `PATCH /api/species/:id` com `{ "name": "Perereca" }`, **Then** responde `200` com `name = "Perereca"`, o `id` devolvido é **o mesmo** de antes e `name_normalized` passa a `"perereca"` (CT-16 / RN-15).
- [ ] **Given** a espécie gravada como `"gato"`, **When** renomeada para `"Gato"`, **Then** responde `200` — nunca `409` — e o `name` persistido passa a `"Gato"` (CT-17 / RN-07).
- [ ] **Given** a espécie `"Gato"`, **When** renomeada para `"  Gato  "`, **Then** responde `200` e o `name` persistido é `"Gato"` (RN-07 combinada com RN-03).
- [ ] **Given** as espécies `"Gato"` e `"Sapo"`, **When** `"Sapo"` é renomeada para `"gato"`, **Then** `409 SPECIES_NAME_ALREADY_EXISTS` e **nenhum** dos dois registros é alterado (CT-18 / RN-04).
- [ ] **Given** `{ "name": "" }`, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` com `details` apontando `name` e "Este campo é obrigatório."; nada é gravado (CT-19).
- [ ] **Given** nome com 1 ou com 61 caracteres, **When** `PATCH`, **Then** as mesmas mensagens por campo do `POST` são devolvidas.
- [ ] **Given** um `id` de espécie já excluída, **When** `PATCH`, **Then** `404 SPECIES_NOT_FOUND` com "Espécie não encontrada." (CT-20 / RN-14).
- [ ] **Given** `id` fora do formato UUID, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "id", message: "Identificador inválido." }]` — e não `404` (CT-34).
- [ ] **Given** corpo com chave além de `name`, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` e nada é gravado (RN-13).
- [ ] **Given** requisição sem sessão, **Then** `401 SESSION_EXPIRED`; **Given** sessão de `cliente`, **Then** `403 FORBIDDEN` — em ambos os casos nada é gravado, independentemente da interface (CT-30 / CT-31 / CA-18 / RN-01).
- [ ] **Given** o endpoint em execução, **When** um cliente tenta a mesma operação por `PUT /api/species/:id`, **Then** a rota não existe — nenhuma rota `PUT` é declarada e `src/config/cors.ts` permanece inalterado.

---

## API Notes

- `PATCH /api/species/:id` — body `{ name }` → `200 PublicSpecies`. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `404 SPECIES_NOT_FOUND`, `409 SPECIES_NAME_ALREADY_EXISTS`.
- **Por que `PATCH` e não `PUT`**: o nome é o único atributo mutável (alteração parcial) e o CORS em vigor não libera `PUT`.

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (repositório, validadores, controller e rotas de espécie já existentes), TASK-BACKEND-001 (`speciesNameKey`, erros de domínio).
- **Blocks**: TASK-BACKEND-005 (testes), TASK-FRONTEND-010 (edição em linha consome este contrato).
