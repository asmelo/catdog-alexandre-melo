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

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 5 (1 modificado, 4 criados) + 4 arquivos de referência do domínio `auth` e `shared/errors`

#### Resumo

Os 11 critérios de aceite estão implementados e foram verificados por execução, não por leitura: as 8 mensagens do catálogo batem caractere a caractere com a spec, a normalização e a chave de unicidade passam nos 9 casos derivados dos CAs, as três classes de erro produzem 409/404/409 com os `code` e mensagens literais, e o SQL da migration é idêntico ao que o `prisma migrate diff` gera a partir do schema — sem drift e sem tocar em nenhuma tabela existente. Nenhum achado `critical` ou `major`. Os achados abaixo são de robustez e de contrato entre documentos, todos não bloqueantes; três deles apontam trabalho para a TASK-BACKEND-002, não correção nesta.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/domains/species/species.messages.ts` | L21, L30 | requisito / contrato | `NAME_REQUIRED` e `FIELD_NOT_ALLOWED` reproduzem caractere a caractere textos que já existem em `src/domains/auth/auth.messages.ts` (`FIELD_REQUIRED` L16 e `UNEXPECTED_FIELD` L39). O último critério de aceite exige que o catálogo "não duplique texto já existente no domínio auth" — lido ao pé da letra, está violado. A seção `## Implementation`, porém, lista as duas entradas como **obrigatórias** e restringe a proibição de cópia apenas a "Você não tem permissão…" e "Sua sessão expirou…". A contradição é do contrato, não da implementação, que seguiu a instrução mais específica. | Reconciliar os dois trechos da task: ou reescrever o critério de aceite para nomear só os dois textos transversais, ou promover os dois textos genéricos para um catálogo compartilhado (`~/shared/messages`) consumido pelos dois domínios. Não alterar o código antes dessa decisão. |
| 2 | minor | `src/domains/species/species-name.ts` | L52 | robustez de contrato | `speciesNameKey(nomeNormalizado: string)` aceita qualquer `string`. Nada no tipo impede chamá-la com o texto cru: `speciesNameKey('  Gato  ')` devolve `'  gato  '`, que persistido em `name_normalized` faria "Gato" e " Gato " coexistirem, quebrando a RN-04 em silêncio. A dependência "o argumento já passou por `normalizeSpeciesName`" existe hoje só no comentário. | Marcar o tipo de retorno de `normalizeSpeciesName` e o parâmetro de `speciesNameKey` com um branded type (`type NormalizedSpeciesName = string & { readonly __brand: unique symbol }`). Torna o erro impossível em tempo de compilação sem mudar o comportamento nem divergir do contrato da task (que proíbe renormalizar dentro de `speciesNameKey`). |
| 3 | minor | `prisma/schema.prisma` / `migration.sql` | L106, L118 / L4-L5 | bug latente (limite) | `name` e `name_normalized` são ambos `VarChar(60)`, mas `toLowerCase()` pode **aumentar** o comprimento da string: 60 × `'İ'` (U+0130) ocupa 60 caracteres em `name` e 120 em `name_normalized`. O `INSERT` seria recusado pelo Postgres (22001) e chegaria ao cliente como 500, não como erro de validação. Caso extremo e improvável no domínio, mas o teto físico está declarado aqui. | Não alterar o schema (a spec fixa os 60). Cobrir na TASK-BACKEND-002: o validador Zod deve medir também `speciesNameKey(normalizeSpeciesName(valor)).length` contra 60, devolvendo `NAME_TOO_LONG`. Registrar o caso na TASK-BACKEND-005. |
| 4 | minor | `src/domains/species/species-name.ts` | L23 | robustez (unicode) | `/\s+/g` cobre espaço, tabulação, quebra de linha, NBSP (U+00A0) e BOM (U+FEFF), mas **não** cobre caracteres de largura zero como U+200B. `"Ga​to"` sobrevive intacto à normalização e produz chave distinta de `"gato"`, permitindo duas espécies visualmente idênticas na lista. Não é desvio do contrato — a task especifica `/\s+/g` e o resultado está correto para o que ela pede. | Tratar na TASK-BACKEND-002: rejeitar (ou remover) caracteres de largura zero e de controle no validador, antes de chamar a normalização. Cobrir na TASK-BACKEND-005. |
| 5 | suggestion | `prisma/schema.prisma` | L100-L127 | padrão | Os comentários `///` do bloco `Species` usam PT-BR **com** acentos, enquanto as linhas 1-98 do mesmo arquivo e todos os comentários dos arquivos TS do projeto (inclusive os três criados nesta task) usam PT-BR **sem** acentos. Divergência de estilo dentro do mesmo arquivo. Não é desvio de contrato: a task manda copiar o bloco da spec literalmente, "inclusive os comentários `///`". | Se a ausência de acento em comentário for convenção deliberada do projeto, registrá-la em `.makuco/codebase/conventions.md` e uniformizar o bloco em uma passagem futura. Caso contrário, ignorar. |
| 6 | suggestion | `.makuco/codebase/*.md` | — | documentação | Os sete arquivos de conhecimento do projeto ainda afirmam "projeto em pré-implementação", "`services/backend` e `services/frontend` existem mas estão vazios" e "nomenclatura de arquivos ainda não definida" — desatualizados desde a FEATURE-002. Convenções hoje reais e verificáveis (constantes de módulo em PT-BR, `MESSAGES` por domínio, erros de domínio em `errors/*.errors.ts`, path alias `~/`) não estão registradas. Fora do escopo desta task. | Rodar `makuco-project-research` antes da TASK-BACKEND-002 para que os próximos agentes não inferem padrão a partir do código. |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 11 de 11 critérios implementados. Verificados por execução (`ts-node` sobre os módulos reais), não por inspeção:

- Tabela `species` com `id` uuid PK, `name` varchar(60), `name_normalized` varchar(60) único, `created_at`/`updated_at` timestamptz(3) — confere no `migration.sql` (L2-L13) e no schema (L102-L130).
- Unicidade no banco (RN-16/CA-09): `CREATE UNIQUE INDEX "species_name_normalized_key"` presente; `'réptil'` e `'reptil'` são chaves distintas — confirmado em runtime (`speciesNameKey('Réptil') !== speciesNameKey('Reptil')` → `true`).
- `normalizeSpeciesName("  Cão   Pastor ")` → `"Cão Pastor"`; `normalizeSpeciesName("   ")` → `""`; tabulação e quebra de linha também colapsam. 
- `speciesNameKey` sobre `" Gato "`, `"gato"` e `"GATO"` → os três produzem `"gato"`.
- Erros instanciados: `SpeciesNameAlreadyExistsError` 409 / `SPECIES_NAME_ALREADY_EXISTS`, `SpeciesNotFoundError` 404 / `SPECIES_NOT_FOUND`, `SpeciesInUseError` 409 / `SPECIES_IN_USE`; os três são `instanceof AppError`, `isOperational === true` e **não** possuem `details` como propriedade própria.
- Catálogo sem nenhuma das três mensagens de sucesso e sem "Você não tem permissão…" / "Sua sessão expirou…" (a única ocorrência da palavra "sucesso" no arquivo está no comentário que explica a ausência). Achado #1 registra a ressalva sobre os dois textos genéricos.
- `animals Animal[]` permanece comentado (L127) e nenhum arquivo do slice importa `@prisma/client`. Achados: #1.

**Pass 2 — Diff Analysis**: Nenhum achado. `git diff --name-only HEAD` devolve exatamente `services/backend/prisma/schema.prisma`; os outros quatro arquivos são novos e não rastreados. O diff do schema é aditivo puro (+32 / -0), começando na L96 — `User`, `EmailConfirmationToken`, `RefreshToken` e os três enums intactos. `prisma/seed.ts`, `src/routes/index.ts`, `src/config/env.ts` e `.env.example` sem qualquer alteração (`git diff HEAD` vazio para os quatro). O `migration.sql` contém apenas `CREATE TABLE "species"` e `CREATE UNIQUE INDEX` — nenhum `ALTER TABLE`. Confirmado ainda que o SQL entregue é **idêntico** ao que `prisma migrate diff --from-empty --to-schema-datamodel` produz para o modelo, ou seja, não há drift entre schema e migration. Nome da pasta `20260826124117_create_species`: sufixo correto e timestamp posterior a `20260820145655_init`. Os commits `1ac3417` e `5cb04f1` (`.gitignore` e handoff) são anteriores ao slice e não tocam em código — não configuram scope creep.

**Pass 3 — Code Practices**: Achados #2. SRP respeitada nos três arquivos; uma única responsabilidade por módulo e uma única indentação por função; nenhum `else`; nenhum número mágico (o 60 vive no schema e na mensagem, não no código de normalização); nenhuma cadeia de acesso. Nomenclatura conferida contra o padrão real do projeto: `SEQUENCIA_DE_ESPACOS` segue a convenção de constante de módulo em PT-BR já usada em `rate-limit.middleware.ts`, `session-cookie.ts` e `auth.validators.ts`; os parâmetros `bruto`/`nomeNormalizado` seguem `erro`/`detalhes`/`problema` de `http-errors.ts`. `MESSAGES` como nome do export coincide com `auth.messages.ts` — é o padrão do projeto, não colisão. Sobre Object Calisthenics: a ausência de um value object `SpeciesName` é imposição do contrato (a task especifica duas funções puras), e o mesmo padrão de módulo-função já existe em `session-cookie.ts`; o achado #2 propõe o ganho de segurança de tipo sem quebrar essa escolha. Linguagem ubíqua alinhada: `Species`/`SpeciesName…`, nome de exceção = regra violada, domínio em inglês e textos ao usuário em PT-BR.

**Pass 4 — Testing Review**: Nenhum achado. Esta task não entrega testes por decisão explícita do escopo (`Out: Sem testes — TASK-BACKEND-005`). Registrado para a TASK-BACKEND-005 que os achados #3 e #4 precisam virar caso de teste, além dos 9 casos já cobertos pelos critérios de aceite. Gate independente: `tsc --noEmit` exit 0.

**Pass 5 — Security Review**: Nenhum achado. A superfície do slice não cruza fronteira de confiança: não há handler, rota, consulta nem I/O. A03 — a migration é DDL estático, sem interpolação; nenhum arquivo monta SQL. A02 — nenhum segredo, nenhum dado sensível; `name` é dado público de catálogo. A01 — a autorização `admin` é responsabilidade das TASK-BACKEND-003/004; nada aqui a antecipa ou enfraquece. A05 — nenhuma leitura de `process.env` fora de `config/env.ts`; as classes de erro fixam mensagem PT-BR de negócio e **não** montam corpo de resposta nem vazam detalhe interno, deixando o envelope para o `error-handler`. A09 — nenhum log introduzido, portanto nenhum vazamento de PII. Os três `code` novos não colidem com nenhum dos 13 já existentes no projeto. Nenhuma dependência nova foi adicionada.

**Pass 6 — Bug Detection**: Achados #3, #4. Lido o conteúdo integral dos quatro arquivos e do bloco novo do schema, mais os arquivos dos quais eles dependem (`app-error.ts`, `http-errors.ts`). Sem null/undefined não tratado (ambas as funções são totais sobre `string`, e o `strict` do projeto impede `undefined` no ponto de chamada); sem race condition, recurso ou `catch` vazio — não há estado, I/O nem `try`; sem coerção insegura (`===` não aparece porque não há comparação); sem lógica invertida — o sentido de cada regra foi confirmado por execução, incluindo a preservação de acento da RN-05, que é o ponto onde uma inversão passaria despercebida. Os dois achados são de fronteira (limite físico da coluna e caracteres de largura zero), ambos endereçáveis na camada de validação da task seguinte. Confirmado que não existe `normalize(`, `NFD` nem `toLocaleLowerCase` em nenhum ponto do slice — as duas únicas ocorrências dessas palavras são os comentários que explicam por que elas **não** estão lá.

**Pass 7 — Project Patterns**: Achados #5, #6. Estrutura alinhada ao domínio de referência: `species.messages.ts` na raiz do domínio espelha `auth.messages.ts`; `errors/species.errors.ts` espelha `errors/registration.errors.ts`; `species-name.ts` como módulo puro na raiz espelha `session-cookie.ts`. Imports absolutos por `~/` mesmo dentro do próprio domínio, como em `registration.errors.ts`. Fluxo de dependência correto e sem ciclo: `species.errors` → `species.messages` + `shared/errors/http-errors`; `species-name` não importa nada. Convenção física do Prisma respeitada (modelo PascalCase, campo camelCase, `@@map`/`@map` para snake_case, `@db.Timestamptz(3)`, `uuid` + `@db.Uuid`), e o `migration.sql` reproduz o estilo de coluna do `20260820145655_init` (`created_at` com `DEFAULT CURRENT_TIMESTAMP`, `updated_at` sem default). `prisma validate` passa e `prisma format` é idempotente sobre o arquivo. A remoção deliberada do `@@index([nameNormalized])` está aplicada e justificada em comentário `///` (L113-L117), conforme instruído — **não** é achado.

#### Veredicto

> **APROVADO** — os 11 critérios de aceite estão implementados e verificados por execução, nenhum achado `critical` ou `major`, nenhum arquivo fora do escopo alterado. Os achados #1 a #6 são não bloqueantes: #1 pede uma decisão de contrato entre a spec e a task antes de qualquer mudança de código; #2 é um endurecimento de tipo aplicável a qualquer momento; #3 e #4 são trabalho da TASK-BACKEND-002 (validador) com cobertura na TASK-BACKEND-005; #5 e #6 são higiene de documentação. A task pode ser fechada e as TASK-BACKEND-002, 003, 004 e 005 estão desbloqueadas.
