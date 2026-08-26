# TASK-BACKEND-001 — Modelo `Species`, migration, catálogo de mensagens, erros e normalização de nome

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-001-backend-species-model-migration`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 1 of 11 — Fundação do domínio Species
**Generated**: `2026-08-25`

---

## Context

Cria a base do domínio `species`: a tabela, o vocabulário PT-BR e a função de normalização de nome. Nenhum endpoint entra aqui — este slice existe porque as três decisões estruturais da feature (coluna `name_normalized` persistida como chave de unicidade, unicidade sensível a acento, e normalização de espaços como ponto único) precisam estar congeladas antes de qualquer caso de uso. É a primeira migration do projeto depois de `20260820145655_init`.

---

## Scope

**In:** Modelo Prisma `Species`, migration SQL correspondente, `species.messages.ts`, `species.errors.ts` e o módulo puro de normalização de nome.

**Out:** Nenhum repositório, service, controller ou rota (TASK-BACKEND-002 a 004). Não criar a tabela `animals` nem qualquer coluna de vínculo — a entidade Animal é da feature seguinte do módulo. Não alterar `users`, `email_confirmation_tokens`, `refresh_tokens` nem os três enums existentes. Não tocar em `src/routes/index.ts`. Não acrescentar carga inicial (`prisma/seed.ts` fica intacto — o cadastro nasce vazio, RN-15/HU-03). Sem testes (TASK-BACKEND-005).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Espécie | `model Species` / tabela `species` |
| Nome da espécie (como exibido) | `Species.name` |
| Chave de unicidade do nome (RN-04/RN-05) | `Species.nameNormalized` → coluna `name_normalized` |
| Já existe espécie com este nome (RN-06) | `SpeciesNameAlreadyExistsError` → `409 SPECIES_NAME_ALREADY_EXISTS` |
| Espécie não encontrada (RN-14) | `SpeciesNotFoundError` → `404 SPECIES_NOT_FOUND` |
| Espécie com animais vinculados (RN-08) | `SpeciesInUseError` → `409 SPECIES_IN_USE` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `prisma/schema.prisma` | modelo Species |
| `create` | `prisma/migrations/20260825120000_create_species/migration.sql` | tabela species |
| `create` | `src/domains/species/species.messages.ts` | catálogo PT-BR |
| `create` | `src/domains/species/errors/species.errors.ts` | erros de domínio |
| `create` | `src/domains/species/species-name.ts` | normalização RN-03/RN-04 |

---

## Implementation

> **Reference pattern**: `prisma/schema.prisma` (modelos `User` / `RefreshToken`) para convenção física; `src/domains/auth/auth.messages.ts` para o catálogo; `src/domains/auth/errors/registration.errors.ts` para os erros de domínio.

### `prisma/schema.prisma` *(modify)*
- Acrescentar o modelo `Species` exatamente como a seção "Modelo de Dados" da spec o declara — inclusive os comentários `///`, que são a documentação da regra dentro do schema.
- `name String @db.VarChar(60)` e `nameNormalized String @unique @map("name_normalized") @db.VarChar(60)`; `createdAt`/`updatedAt` em `@db.Timestamptz(3)`; `@@index([nameNormalized])`; `@@map("species")`.
- A relação `animals Animal[]` fica **comentada**, com a nota de que a feature seguinte deve declarar o lado inverso com `onDelete: Restrict`. Descomentá-la aqui não compila (o modelo `Animal` não existe) e criar o modelo `Animal` está fora do escopo.
- O `@unique` em `nameNormalized` já produz índice; o `@@index([nameNormalized])` da spec é redundante em Postgres. **Manter apenas o `@unique`** e registrar o desvio em comentário `///`: dois índices sobre a mesma coluna custam escrita e não rendem leitura. Este é o único ponto em que a implementação diverge do bloco literal da spec.

### `prisma/migrations/20260825120000_create_species/migration.sql` *(create)*
- Gerar por `npx prisma migrate dev --name create_species` e **conferir** que o SQL resultante contém apenas `CREATE TABLE "species"` e `CREATE UNIQUE INDEX` sobre `name_normalized`. Se aparecer qualquer `ALTER TABLE` sobre `users`, `email_confirmation_tokens` ou `refresh_tokens`, o schema foi editado além do previsto — desfazer.
- Renomear a pasta gerada para o timestamp acima só se a geração produzir nome diferente é desnecessário: aceitar o timestamp que o Prisma gerar, desde que o sufixo seja `_create_species`. O caminho na tabela acima é ilustrativo do formato.

### `src/domains/species/species.messages.ts` *(create)*
- Objeto `as const` com as strings **exatas** da tabela "Mensagens ao Usuário" da spec, copiadas caractere a caractere (acentos, aspas curvas e ponto final inclusos) — os critérios de aceite comparam texto literal.
- Entradas obrigatórias: `NAME_REQUIRED: 'Este campo é obrigatório.'`, `NAME_TOO_SHORT: 'O nome da espécie deve ter no mínimo 2 caracteres.'`, `NAME_TOO_LONG: 'O nome da espécie deve ter no máximo 60 caracteres.'`, `NAME_ALREADY_EXISTS: 'Já existe uma espécie com este nome.'`, `SPECIES_NOT_FOUND: 'Espécie não encontrada.'`, `SPECIES_IN_USE: 'Não é possível excluir esta espécie porque existem animais vinculados a ela.'`, `INVALID_ID: 'Identificador inválido.'`, `FIELD_NOT_ALLOWED: 'Campo não permitido nesta requisição.'`.
- **Não** replicar aqui "Você não tem permissão para acessar este recurso." nem "Sua sessão expirou. Faça login novamente." — elas já existem em `authorize-role.middleware.ts` e no domínio auth, e uma segunda cópia divergiria na primeira revisão de texto.
- **Não** incluir as mensagens de sucesso ("Espécie criada com sucesso." e as duas irmãs): elas são texto de tela e não saem em nenhuma resposta desta API (`POST` devolve o recurso, `DELETE` devolve `204`). Elas vivem no catálogo do frontend (TASK-FRONTEND-008).

### `src/domains/species/errors/species.errors.ts` *(create)*
- Três classes sem parâmetro de construtor, cada uma fixando `message` (do catálogo acima) e `code`, estendendo as subclasses de `~/shared/errors/http-errors`:
  - `SpeciesNameAlreadyExistsError` → `ConflictError` / `SPECIES_NAME_ALREADY_EXISTS`
  - `SpeciesNotFoundError` → `NotFoundError` / `SPECIES_NOT_FOUND`
  - `SpeciesInUseError` → `ConflictError` / `SPECIES_IN_USE`
- Os três `code` são novos no contrato e **não colidem** com os 13 já existentes do domínio auth. `FORBIDDEN` e `SESSION_EXPIRED` continuam sendo produzidos pelos middlewares transversais e não ganham classe nova.
- Nome da classe = regra violada (convenção de linguagem ubíqua já adotada em `registration.errors.ts`).

### `src/domains/species/species-name.ts` *(create)*
- Módulo puro, sem import de Prisma, Express ou Zod. Duas funções exportadas:
  - `normalizeSpeciesName(bruto: string): string` — RN-03: `trim()` e colapso de qualquer sequência de espaços internos em um único espaço. **Preserva caixa e acentos**: `"  Cão   Pastor "` → `"Cão Pastor"`.
  - `speciesNameKey(nomeNormalizado: string): string` — RN-04/RN-05: `toLowerCase()` sobre o valor já normalizado. **Nenhuma remoção de diacrítico** — `"Réptil"` e `"Reptil"` produzem chaves distintas e podem coexistir. Não usar `normalize('NFD')` nem substituição de acentos aqui; fazê-lo inverteria a RN-05.
- Usar `toLowerCase()` e não `toLocaleLowerCase()`: o resultado precisa ser idêntico independentemente do locale do processo, porque ele é **persistido** e comparado por igualdade no banco.
- O colapso de espaços deve tratar também tabulação e quebra de linha (`/\s+/g` → `' '`), não apenas o espaço simples — o campo do frontend aceita colagem de texto.
- Comentário obrigatório no arquivo explicando que este é o **ponto único** de normalização do domínio: o validador Zod (TASK-BACKEND-002) o aplica antes de medir o tamanho, e o repositório assume que o valor já chega normalizado.

---

## Acceptance Criteria

- [ ] **Given** o schema atualizado, **When** `npx prisma migrate dev` é executado sobre um banco com a migration `20260820145655_init` aplicada, **Then** a tabela `species` é criada com as colunas `id` (uuid, PK), `name` (varchar 60), `name_normalized` (varchar 60, único), `created_at` e `updated_at` (timestamptz(3)), e **nenhuma** tabela existente é alterada.
- [ ] **Given** a migration aplicada, **When** dois `INSERT` são feitos com `name_normalized = 'gato'`, **Then** o segundo é recusado pelo banco por violação de índice único — a unicidade é do banco, não de consulta prévia (RN-16 / CA-09).
- [ ] **Given** a migration aplicada, **When** dois `INSERT` são feitos com `name_normalized = 'réptil'` e `'reptil'`, **Then** os dois são aceitos (RN-05).
- [ ] **Given** a coluna `name` declarada `@db.VarChar(60)`, **When** o schema é lido, **Then** o teto físico coincide com o limite de negócio de 60 caracteres, e o piso de 2 é responsabilidade do validador (RN-02).
- [ ] **Given** `normalizeSpeciesName("  Cão   Pastor ")`, **Then** retorna exatamente `"Cão Pastor"` — e é este resultado, e não o texto cru, que as camadas acima validam, gravam e comparam (RN-03 / CA-07 / CT-10).
- [ ] **Given** `normalizeSpeciesName("   ")`, **Then** retorna string vazia — é este resultado que permite ao validador reportar "Este campo é obrigatório." em vez de "mínimo 2 caracteres" (CT-03).
- [ ] **Given** `speciesNameKey(normalizeSpeciesName(" Gato "))`, `speciesNameKey("gato")` e `speciesNameKey("GATO")`, **Then** os três produzem `"gato"` (RN-04 / CT-08 / CT-09).
- [ ] **Given** `speciesNameKey("Réptil")` e `speciesNameKey("Reptil")`, **Then** os resultados são **diferentes** (RN-05 / CT-11).
- [ ] **Given** as três classes de erro instanciadas, **When** inspecionadas, **Then** `statusCode` vale 409/404/409 e `code` vale `SPECIES_NAME_ALREADY_EXISTS` / `SPECIES_NOT_FOUND` / `SPECIES_IN_USE`, com as mensagens literais da spec.
- [ ] `species.messages.ts` **não** contém nenhuma das mensagens de sucesso da tela nem duplica texto já existente no domínio auth.
- [ ] O modelo `Species` **não** declara relação com `Animal` de forma ativa, e nenhum arquivo do slice importa `@prisma/client` procurando por `Animal`.

---

## Dependencies

- **Requires**: FEATURE-002 concluída (migration `20260820145655_init` aplicada, `AppError` e subclasses HTTP disponíveis em `~/shared/errors/http-errors`).
- **Blocks**: TASK-BACKEND-002, TASK-BACKEND-003, TASK-BACKEND-004 (todas dependem do modelo, do catálogo e da normalização), TASK-BACKEND-005 (testes).
