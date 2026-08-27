# TASK-BACKEND-001 — Modelo de dados: enumerações, estados, cidades, animais e imagens

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-001-backend-schema-animais-estados-cidades`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 1 of 18 — Fundação: Modelo de Dados
**Generated**: `2026-08-25`

---

## Context

Cria as três enumerações e as quatro tabelas novas da feature (`states`, `cities`, `animals`, `animal_images`) e **ativa a relação inversa `animals Animal[]`** que a FEATURE-001 deste módulo deixou comentada no modelo `Species` — é ela que faz a chave estrangeira restritiva existir de fato e torna a contagem de animais vinculados uma consulta real. O bloco Prisma da seção "Modelo de Dados" da spec é literal: copiar campo a campo, incluindo os comentários `///`, que registram o porquê de cada decisão irreversível.

---

## Scope

**In:** Enumerações `AnimalSize`, `AnimalSex` e `AnimalStatus`; modelos `State`, `City`, `Animal` e `AnimalImage`; ativação da relação inversa em `Species`; migration correspondente.

**Out:** Nenhuma carga de dados — os 27 estados e os municípios entram na TASK-BACKEND-002. Nenhum repositório, service, rota ou mapper (TASK-BACKEND-005 em diante). Não alterar coluna alguma de `users`, `refresh_tokens`, `email_confirmation_tokens` ou `species` — `species` apenas **ganha** a relação inversa, que não gera DDL. Não acrescentar coluna de idade, de autoria/auditoria, de chip, de contato do proprietário ou de raça.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Porte | `enum AnimalSize { PEQUENO, MEDIO, GRANDE }` |
| Sexo | `enum AnimalSex { MACHO, FEMEA }` |
| Status do animal | `enum AnimalStatus { DISPONIVEL, RESERVADO, ADOTADO, INDISPONIVEL }` |
| Unidade federativa | `model State` → `states` |
| Município | `model City` → `cities` |
| Imagem de capa | `AnimalImage.position == 0` |
| Marca de última alteração (token de concorrência) | `Animal.updatedAt` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `prisma/schema.prisma` | enums e quatro modelos |
| `create` | `prisma/migrations/<timestamp>_animals_states_cities/migration.sql` | DDL gerada |

---

## Implementation

> **Reference pattern**: os modelos `User` e `Species` já presentes em `prisma/schema.prisma` definem as convenções físicas (PascalCase/camelCase mapeados por `@@map`/`@map` para snake_case plural, `id` `uuid`, datas `@db.Timestamptz(3)`) e o precedente de literal de enum em PT-BR sem acento (`UserRole.CLIENTE`).

### `prisma/schema.prisma` *(modify)*
**Diferenças em relação ao referencial:**
- As três enumerações são conjuntos fechados definidos pelo domínio (RN-11, RN-12, RN-13), e não tabelas de apoio: só mudam por decisão de produto acompanhada de mudança de comportamento. A própria navegação lateral da captura é a evidência — ela tem "Animais" e "Espécies", e não "Portes" ou "Sexos".
- `Animal.speciesId` é **não anulável**: não existe animal sem espécie em nenhum momento do ciclo de vida (RN-07). É essa não anulabilidade, somada ao `Restrict`, que torna `SetNull` inexprimível.
- `Animal.id` é `uuid` gerado pelo banco, estável: editar não o altera e o identificador de um animal excluído nunca é reaproveitado (RN-06).
- Transcrever o bloco Prisma da seção "Modelo de Dados" da spec **na íntegra**, incluindo os comentários `///`. Eles não são decoração: cada um registra uma decisão que um `prisma format` futuro não pode apagar sem perder o motivo.
- `Animal.species` → `onDelete: Restrict`. `Cascade` e `SetNull` são **proibidos** neste vínculo (RN-09) — herdado das RN-08/RN-09 da FEATURE-001 e não renegociável nesta task nem em nenhuma outra.
- `Animal.city` → `onDelete: Restrict` pelo mesmo motivo estrutural (RN-29): manutenção no cadastro de apoio não pode produzir animal sem localização.
- `AnimalImage.animal` → `onDelete: Cascade`. Isto **não** contradiz o item acima: a proibição de cascata vale exclusivamente para animal → espécie. A imagem não tem existência própria fora do animal (RN-55).
- `Animal.nameNormalized` **não** é `@unique` — diverge deliberadamente de `Species.nameNormalized`. Lá garante unicidade; aqui existe apenas para ordenar ignorando caixa (RN-05, RN-41).
- Índice `@@index([nameNormalized, createdAt, id])` cobre os três critérios da ordenação da RN-41. O terceiro campo é obrigatório: sem um critério que nunca empata, dois animais cadastrados no mesmo instante trocam de posição entre páginas e um registro aparece duas vezes enquanto outro some.
- `AnimalImage` usa `@@index([animalId, position])`, e **não** `@@unique`. Uma restrição de unicidade seria verificada a cada comando e reordenar imagens dentro de uma transação passaria por estados intermediários com posição repetida. A unicidade da ordem é responsabilidade do service.
- **Nenhuma coluna de idade** existe em `Animal` (RN-20). Idade persistida envelhece em silêncio e passa a mentir; ela é derivada a cada resposta.
- `Animal.birthDate` é `@db.Date` — data pura, sem hora e sem fuso.
- `City.ibgeCode` é `@unique`: é a identidade estável pela qual a carga inicial casa registros numa futura atualização do recorte, em vez de casar por nome.
- Em `Species`, **descomentar** `animals Animal[]`. É a única alteração no modelo entregue pela FEATURE-001.
- `AnimalStatus` recebe o comentário `///` afirmando que **não** espelha as cinco etapas do Pedido (RN-17a) — são máquinas de estado com donos diferentes, e duplicar as etapas dentro do animal garantiria divergência.

### `prisma/migrations/<timestamp>_animals_states_cities/migration.sql` *(create)*
**Diferenças em relação ao referencial:**
- Gerar por `npx prisma migrate dev --name animals_states_cities`, não escrever à mão.
- Conferir no SQL gerado, antes de commitar: `ON DELETE RESTRICT` nas duas FKs de `animals` e `ON DELETE CASCADE` na FK de `animal_images`. É o artefato que a TASK-BACKEND-010 exercita contra o Postgres real.
- O SQL não pode conter `ALTER TABLE ... ALTER COLUMN` sobre tabelas preexistentes. Se contiver, o schema divergiu do banco antes desta task e isso precisa ser resolvido, não acomodado.

---

## Acceptance Criteria

- [ ] **Given** a migration aplicada, **When** o schema do banco é inspecionado, **Then** existem as tabelas `states`, `cities`, `animals` e `animal_images` e os tipos `AnimalSize`, `AnimalSex` e `AnimalStatus` com os literais em maiúsculas e sem acento.
- [ ] **Given** um animal vinculado a uma espécie, **When** um `DELETE` é executado **diretamente no banco** sobre aquela espécie, **Then** o Postgres recusa a operação por violação de chave estrangeira, nenhum animal é apagado e nenhum animal fica com `species_id` nulo (CT-85, CA-36).
- [ ] **Given** um animal vinculado a uma cidade, **When** um `DELETE` é executado diretamente no banco sobre aquela cidade, **Then** a operação é recusada (CT-86, RN-29).
- [ ] **Given** um animal com duas imagens, **When** o animal é removido diretamente no banco, **Then** as duas linhas de `animal_images` são removidas junto (RN-55).
- [ ] **Given** a tabela `animals`, **When** as colunas são listadas, **Then** **não** existe coluna de idade, de autoria, de chip, de contato do proprietário nem de raça (RN-20).
- [ ] **Given** dois animais com o mesmo `name`, **When** ambos são inseridos, **Then** os dois são gravados — `name_normalized` não possui índice único (RN-05).
- [ ] **Given** o modelo `Species`, **When** o schema é lido, **Then** `animals Animal[]` está ativo e `npx prisma validate` passa.
- [ ] **Given** a migration aplicada, **When** as suítes de autenticação e de espécies são executadas, **Then** continuam verdes — nenhuma coluna existente foi alterada.

---

## Dependencies

- **Requires**: FEATURE-001 do MODULE-002 concluída (modelo `Species` e a sua migration no banco).
- **Blocks**: TASK-BACKEND-002 (carga precisa das tabelas), TASK-BACKEND-005 a TASK-BACKEND-010 (tudo consulta estes modelos), TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 2 (`services/backend/prisma/schema.prisma`, `services/backend/prisma/migrations/20260827133551_animals_states_cities/migration.sql`)
**Verificação contra o banco**: sim — catálogo do Postgres e comportamento real, via `DIRECT_URL` (5432)

#### Resumo

Os oito critérios de aceite foram verificados; todos passam. O bloco Prisma entregue é **idêntico ao bloco literal da spec**, comentários `///` incluídos (diff normalizado por espaços: zero divergências em 124 linhas). As quatro chaves estrangeiras foram conferidas no catálogo do Postgres e exercitadas por `DELETE` real: `animals→species` e `animals→cities` recusam com `23503`, `animal_images→animals` apaga em cascata. Nenhum achado `critical` ou `major`.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | suggestion | `prisma/schema.prisma` | L132, L139 | padrão | Dois comentários `///` do bloco novo carregam acento ("ver Decisão C", "o campo é obrigatório") enquanto os outros 30 do mesmo bloco são sem acento. **Não é desvio do agente**: os dois vieram literalmente da spec, e a task exige transcrição literal. O bloco preexistente de `Species` (FEATURE-001) também é acentuado, então o arquivo já era inconsistente | Corrigir na origem (bloco "Modelo de Dados" da spec), não nesta task. Alterar aqui quebraria a exigência de literalidade e criaria divergência spec↔código |
| 2 | suggestion | `prisma/migrations/.../migration.sql` | L87, L90, L93, L96 | integridade | As quatro FKs saíram com `ON UPDATE CASCADE` (default do Prisma, não declarável no schema). É inerte — os PKs são `uuid` que nunca mudam —, mas quem ler o SQL procurando por "Cascade proibido" (RN-09) vai encontrar a palavra nas FKs de `animals` | Registrar como esperado. A proibição da RN-09 é sobre `ON DELETE`, e as duas FKs de `animals` estão `ON DELETE RESTRICT`. Ponto de atenção para a leitura do SQL na TASK-BACKEND-010 |
| 3 | suggestion | `prisma/schema.prisma` | L238, L241, L202 | robustez | `AnimalImage.position` e `AnimalImage.sizeBytes` são `INTEGER` com sinal, sem `CHECK` — valores negativos são representáveis no banco. Igualmente, `description VarChar(1000)` estoura com `22001` se o service não validar antes. A spec atribui explicitamente essas validações ao service (RN-23, RN-32, RN-35 e a nota do `@@index` em vez de `@@unique`) | Nenhuma ação nesta task. Garantir a validação de faixa nas TASK-BACKEND-007 e TASK-BACKEND-008, para que o erro chegue como 400 mapeado e não como falha de constraint |
| 4 | suggestion | `prisma/schema.prisma` | L132–L152 | organização | O arquivo passa a ter dois grupos de enums: os de autenticação no topo (L20–L41) e os do catálogo (L132–L152) junto dos seus modelos, ao final. **Decisão julgada correta**: o layout de fato do arquivo é "um bloco por feature" (`Species` já foi acrescentada ao final pela FEATURE-001), a ordem é a do bloco literal da spec, e agrupar no topo separaria a enum do único modelo que a usa | Manter. Se o arquivo crescer mais, documentar a convenção "um bloco por feature" em `.makuco/codebase/conventions.md` |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 8 de 8 critérios de aceite implementados e verificados contra o banco real, não contra o arquivo de migration.

| Critério | Evidência |
|---|---|
| Tabelas e tipos criados | `information_schema.tables` traz `states`, `cities`, `animals`, `animal_images`. `pg_enum`: `AnimalSize {PEQUENO, MEDIO, GRANDE}`, `AnimalSex {MACHO, FEMEA}`, `AnimalStatus {DISPONIVEL, RESERVADO, ADOTADO, INDISPONIVEL}` — maiúsculas, sem acento |
| CT-85 / CA-36 — `DELETE` de espécie com animal vinculado | Recusado: `23503 — update or delete on table "species" violates foreign key constraint "animals_species_id_fkey" on table "animals"`. Após a recusa: espécie remanescente = 1, animal remanescente = 1, `species_id` não nulo = 1. **Nenhum animal apagado, nenhum animal órfão** |
| CT-86 / RN-29 — `DELETE` de cidade com animal vinculado | Recusado: `23503` em `animals_city_id_fkey`. Verificado também o vínculo lateral: `DELETE` de estado com cidade vinculada recusa com `23503` em `cities_state_id_fkey` |
| RN-55 — `DELETE` de animal com duas imagens | Imagens antes = 2, depois = 0. Cascata real |
| RN-20 — colunas de `animals` | 14 colunas: `id, name, name_normalized, species_id, city_id, size, sex, status, birth_date, description, accepts_other_animals, needs_large_space, created_at, updated_at`. **Sem idade, sem autoria, sem chip, sem contato do proprietário, sem raça** |
| RN-05 — dois animais com o mesmo nome | Ambos gravados (`count = 2` com `name_normalized = 'rex'`). `pg_indexes` sobre `animals`: `animals_pkey` (único, sobre `id`) e quatro índices **não únicos**; `pg_constraint` não traz nenhum `contype='u'`. **Não existe índice único sobre `name_normalized`** |
| `Species.animals` ativo + `prisma validate` | `animals Animal[]` descomentado; `prisma validate` → "The schema at prisma/schema.prisma is valid" |
| Suítes verdes | `npm run typecheck` exit 0; `npm test` → 20 suítes, 270 testes, todos passando (baseline intacta, reexecutado por mim) |

Verificação adicional, não pedida mas relevante para a dívida: `DELETE` de espécie **sem** animais vinculados conclui sem erro (CT-83 sustentado pela constraint real).

**Pass 2 — Diff Analysis**: Nenhum achado.
- `git status` na raiz: **exatamente** `M services/backend/prisma/schema.prisma` e `?? .../migrations/20260827133551_animals_states_cities/migration.sql`. Nada fora dos dois arquivos do `## Files`.
- `git status --porcelain services/backend/src` vazio → **`species-usage-counter.ts` não foi tocado**. As quatro edições do seu `TODO` seguem pendentes para a TASK-BACKEND-010, como manda o plano.
- **Decisão 3 confirmada**: diffstat é `126 insertions(+), 1 deletion(-)`. A única deleção é `-  // animals Animal[]`, substituída por `+  animals Animal[]`. Nenhum modelo preexistente foi reformatado pelo `prisma format` — a aritmética fecha: 125 linhas do bloco novo + 1 linha alterada. **Nada da FEATURE-001 mudou além de descomentar a relação inversa.**
- Migration: nenhum `ALTER TABLE ... ALTER COLUMN` sobre tabela preexistente. Só `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` e `ADD CONSTRAINT`.
- Sem `drift`: `prisma migrate status` → "Database schema is up to date!"; `prisma migrate diff` datasource↔datamodel → "No difference detected."

**Pass 3 — Code Practices**: Nenhum achado. Artefato declarativo (schema Prisma + DDL), sem função, classe ou fluxo de controle. Proibição de `any` não se aplica — nenhum `.ts` foi tocado. Nomes completos, sem abreviação (`nameNormalized`, `acceptsOtherAnimals`, `needsLargeSpace`); `ibgeCode` e `uf` são siglas do domínio, admitidas pela regra de linguagem ubíqua.

**Pass 4 — Testing Review**: Não se aplica. A task não entrega testes (são da TASK-BACKEND-011) e não entrega código executável, logo não há linha nova a cobrir. O que era exigível — a baseline continuar verde — foi verificado: 20 suítes / 270 testes.

**Pass 5 — Security Review**: Nenhum achado.
- **A02**: `services/backend/.env` confirmado ignorado por `services/backend/.gitignore:8`. Nenhuma credencial, URL de conexão ou segredo no `migration.sql` (varredura por `password|secret|key=|postgres(ql)://`: zero ocorrências).
- **A01/A03/A04**: sem endpoint, sem query dinâmica, sem entrada de usuário nesta entrega.
- Ponto **positivo** de privacidade: a ausência de `owner_contact` (dado pessoal de terceiro, Decisão 13) é uma decisão de LGPD que nasce aplicada no nível físico — não há coluna para vazar.
- `description VarChar(1000)` e `storage_path VarChar(255)` impõem teto de tamanho no próprio banco, defesa em profundidade sobre a validação de aplicação.

**Pass 6 — Bug Detection**: Nenhum achado bloqueante. Arquivos lidos por inteiro. Analisado, item a item:
- **Armadilha do `name_normalized`** (a apontada como conhecida do módulo): o comentário `///` entregue diz literalmente "usado APENAS para ordenar ignorando caixa (RN-41)" e "Deliberadamente NAO e `@unique`". Nada na DDL remove acento e nada cria unicidade — confirmado no catálogo. A confusão com o `name_search` da vitrine **não** ocorreu.
- **Ordenação instável / registro duplicado entre páginas**: `animals_name_normalized_created_at_id_idx` existe com os três campos na ordem correta; o desempate final por `id` está presente.
- **Estado inconsistente**: `species_id` e `city_id` são `NOT NULL` **e** `RESTRICT` — a combinação torna `SetNull` inexprimível, como a task exige. Confirmado: `is_nullable = NO` nas duas colunas.
- **Off-by-one / coerção**: `birth_date` é `DATE` puro (sem fuso), coerente com a Decisão 7. `size_bytes INTEGER` comporta o limite de 5 MB com folga (5.242.880 contra 2.147.483.647) — o tipo está correto, ver achado #3 apenas quanto ao sinal.
- **Vazamento de recurso / cascata indevida**: a cascata está **só** em `animal_images→animals`; não vazou para `animals→species`. Verificado no catálogo, não no arquivo: `confdeltype = 'c'` apenas em `animal_images_animal_id_fkey`; `'r'` em `animals_species_id_fkey`, `animals_city_id_fkey` e `cities_state_id_fkey`.

**Pass 7 — Project Patterns**: Nenhum achado bloqueante (achados #1 e #4 são informativos).
- Convenções físicas herdadas respeitadas: PascalCase/camelCase mapeados por `@@map`/`@map` para snake_case plural, `id` `uuid`, datas `Timestamptz(3)`, literais de enum em PT-BR sem acento (precedente `UserRole.CLIENTE`).
- Migration gerada por ferramenta, não escrita à mão (padrão de nome e cabeçalhos `-- CreateTable` do Prisma).

#### Julgamento das decisões declaradas pelo agente

| # | Decisão | Veredicto | Base |
|---|---|---|---|
| 1 | `--skip-seed` acrescentado ao `migrate dev` | **Correta, e necessária** | Alegação **verificada**: `package.json:25` registra `prisma.seed`, então `migrate dev` roda `prisma/seed.ts`, que faz `prisma.user.upsert` com `update: { passwordHash, role, status, emailConfirmedAt }` — e `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` estão presentes no `.env`, então o seed teria executado. Reescreveria `password_hash`, `role`, `status`, `email_confirmed_at` e, por `@updatedAt`, `updated_at` da linha existente em `users`. O agente subdimensionou de leve o próprio argumento: omitiu `email_confirmed_at`. Os artefatos entregues são idênticos com ou sem a flag. Recomendação para o orquestrador: emendar o texto das tasks futuras, porque a carga de estados/municípios da TASK-BACKEND-002 **não** deve ser pendurada no gancho `prisma.seed`, hoje ocupado pelo provisionamento do administrador |
| 2 | Enums ao final, junto dos modelos | **Correta** | Ver achado #4 |
| 3 | `prisma format` executado | **Correta e comprovada** | Ver Pass 2. Realinhou apenas colunas dentro de `Animal` e `AnimalImage`; nenhum bloco preexistente reformatado |
| 4 | `description VarChar(1000)`, `size_bytes INTEGER` | **Corretas** | RN-23 fixa 1000 caracteres, e `varchar(n)` no Postgres conta caracteres, não bytes. RN-32 fixa 5 MB por imagem, que cabe em `INTEGER` com três ordens de grandeza de folga. Ver achado #3 quanto ao sinal |

#### Estado do banco após a revisão

Toda a verificação comportamental rodou dentro de uma transação com `SAVEPOINT`, revertida ao final de propósito. Contagens conferidas antes e depois, idênticas: `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 0, `cities` 0, `animals` 0, `animal_images` 0. As duas linhas de `users` foram comparadas campo a campo (`password_hash`, `role`, `status`, `updated_at`) antes e depois: **inalteradas**. Nenhum dado de teste ficou para trás e nada além do criado-e-revertido foi tocado.

#### Veredicto

> **APROVADA** — 8 de 8 critérios de aceite implementados e verificados contra o Postgres real. Zero achados `critical`, zero `major`; quatro `suggestion`, nenhum bloqueante.
>
> **A fundação da dívida obrigatória está sólida.** Conferido no catálogo (`pg_constraint`), não no arquivo de migration:
> - `animals_species_id_fkey` → `FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE RESTRICT` (`confdeltype = 'r'`), em `services/backend/prisma/schema.prisma:214` / `migration.sql:90`;
> - `animals_city_id_fkey` → `ON DELETE RESTRICT` (`confdeltype = 'r'`), em `schema.prisma:217` / `migration.sql:93`;
> - `animal_images_animal_id_fkey` → `ON DELETE CASCADE` (`confdeltype = 'c'`), em `schema.prisma:247` / `migration.sql:96`;
> - `cities_state_id_fkey` → `ON DELETE RESTRICT` (`confdeltype = 'r'`), em `schema.prisma:174` / `migration.sql:87`.
>
> E exercitada de fato: excluir espécie com animal vinculado falha com `23503` sem apagar nem orfanar animal; excluir animal com imagens remove as duas imagens. A TASK-BACKEND-010 tem contra o que reexecutar CT-81 a CT-86.
