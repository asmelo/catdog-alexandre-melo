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
