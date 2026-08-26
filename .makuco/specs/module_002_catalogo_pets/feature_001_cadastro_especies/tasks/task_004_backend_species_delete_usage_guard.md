# TASK-BACKEND-004 — Excluir espécie com bloqueio por vínculo (`DELETE /api/species/:id`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-004-backend-species-delete-usage-guard`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 4 of 11 — Domínio Species: Exclusão e guarda de integridade
**Generated**: `2026-08-25`

---

## Context

Implementa as HU-05 e HU-06 e as regras RN-08, RN-09, RN-10 e RN-14. É o slice central da integridade da feature: a exclusão de espécie referenciada por animais é recusada em **duas camadas independentes, ambas obrigatórias**. A entidade `Animal` ainda não existe — a contagem de vínculos entra como **dependência declarada do caso de uso**, com implementação real que responde zero e um duplo de teste que responde diferente de zero (seção "Como a RN-08 é verificada antes de a entidade Animal existir" da spec).

---

## Scope

**In:** A porta `SpeciesUsageCounter` com a sua implementação provisória, o método de exclusão no repositório, o service de exclusão dentro de transação, o handler no controller e a rota `DELETE`.

**Out:** **Não criar o modelo `Animal`, a tabela `animals`, nem qualquer chave estrangeira.** A migration da FK restritiva pertence à feature seguinte do módulo — o que esta task entrega é o ponto de extensão e a tradução do erro do banco quando essa FK existir. Não implementar inativação, arquivamento, lixeira ou recuperação (RN-10). Não implementar migração de animais entre espécies. Não alterar `prisma/schema.prisma` nem `src/routes/index.ts`. Sem testes (TASK-BACKEND-005).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Quantidade de animais vinculados a uma espécie | `SpeciesUsageCounter.countAnimalsBySpecies(speciesId): Promise<number>` |
| Espécie em uso (RN-08) | `SpeciesInUseError` → `409 SPECIES_IN_USE` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/species/repositories/species-usage-counter.ts` | porta de contagem |
| `modify` | `src/domains/species/repositories/species.repository.ts` | método delete |
| `create` | `src/domains/species/services/delete-species.service.ts` | regra de exclusão |
| `modify` | `src/domains/species/species.controller.ts` | handler remove |
| `modify` | `src/domains/species/species.routes.ts` | rota DELETE /:id |

---

## Implementation

> **Reference pattern**: `src/domains/auth/repositories/user.repository.ts` (interface-porta + impl Prisma + `withTransaction`) e `src/domains/auth/services/confirm-email.service.ts` (uso de `$transaction` com repositórios transacionais).

### `src/domains/species/repositories/species-usage-counter.ts` *(create)*
- Interface `SpeciesUsageCounter { countAnimalsBySpecies(speciesId: string): Promise<number>; withTransaction(executor: Prisma.TransactionClient): SpeciesUsageCounter }`.
- Implementação `PrismaSpeciesUsageCounter` que, **enquanto a tabela `animals` não existir**, responde `0` sem tocar o banco.
- O arquivo carrega um comentário `TODO` explícito, no formato já usado no projeto para pendências entre slices, dizendo: a feature de Cadastro de pets **deve** substituir o corpo por `this.db.animal.count({ where: { speciesId } })` e **não pode ser considerada concluída** sem que a FK `species_id` exista com `onDelete: Restrict` e sem que CT-24, CT-25, CT-26 e CT-32 sejam reexecutados contra dados reais.
- Ser uma porta separada de `SpeciesRepository`, e não mais um método dele, é deliberado (segregação de interfaces): a contagem pertence ao agregado Animal, e juntá-las obrigaria a implementação em memória do repositório de espécies a fingir conhecer animais. É esta separação que torna o duplo de teste trivial.
- **Não** declarar tipo, modelo ou import de `Animal` aqui — `@prisma/client` não exporta esse símbolo e o arquivo não compilaria.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
- Acrescentar `deleteById(id): Promise<void>` à interface e à implementação, usando `delete({ where: { id } })`.
- Não usar `deleteMany`: ele responde `count: 0` silenciosamente para id inexistente, e o service precisa distinguir esse caso para produzir `404`.

### `src/domains/species/services/delete-species.service.ts` *(create)*
- Dependências injetadas: `SpeciesRepository`, `SpeciesUsageCounter` e `PrismaClient` (apenas para `$transaction`). `execute(input: { id: string }): Promise<void>`.
- Todo o corpo roda dentro de **um** `prisma.$transaction`, com os dois colaboradores rebindados por `withTransaction(tx)`. A verificação e a exclusão precisam ver o mesmo instantâneo: fora da transação, um animal criado entre a contagem e o `delete` produziria exatamente o animal órfão que a RN-09 proíbe.
- Ordem obrigatória dentro da transação:
  1. `findById(id)` → `null` ⇒ `SpeciesNotFoundError` (RN-14 / CT-27).
  2. `countAnimalsBySpecies(id)` → `> 0` ⇒ `SpeciesInUseError` (RN-08 / CT-24). **Camada 1** — é ela que produz a mensagem correta em PT-BR.
  3. `deleteById(id)`.
- **Camada 2**: envolver o `deleteById` em `try/catch` e traduzir `PrismaClientKnownRequestError` com `code === 'P2003'` (violação de chave estrangeira) para o **mesmo** `SpeciesInUseError`, e `P2025` para `SpeciesNotFoundError`. O `P2003` só passa a ocorrer quando a FK restritiva existir, na feature seguinte — a tradução nasce agora para que a guarda não precise ser retroencaixada depois, e para que uma falha da camada 1 não vire `500`.
- Lançar o erro **de dentro** da callback do `$transaction`: é isso que aborta a transação e garante que nada foi removido quando a resposta é `409`.
- Comentário obrigatório: exclusão em cascata e anulação de vínculo são **proibidas** por esta spec, em qualquer camada.
- **Não** usar `new Date()` — a operação não grava instante nenhum (RN-10: a exclusão é definitiva, não há `deletedAt`).

### `src/domains/species/species.controller.ts` *(modify)*
- Acrescentar `remove` à fábrica: lê `req.params.id`, chama **um** service e responde `204` **sem corpo** (`res.status(HTTP_STATUS.NO_CONTENT).send()`).
- `NO_CONTENT` já existe em `src/shared/http/http-status.ts`; nenhum status novo precisa ser acrescentado lá nesta feature.
- Instanciar `DeleteSpeciesService` na mesma fábrica, injetando o `PrismaSpeciesUsageCounter`. Manter o parâmetro de dependências da fábrica aberto para que os testes injetem um contador duplo sem tocar em Prisma.

### `src/domains/species/species.routes.ts` *(modify)*
- `DELETE /:id` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ params: speciesIdParamSchema })`, `controller.remove`. Sem schema de corpo: a rota não aceita corpo.

---

## Acceptance Criteria

- [ ] **Given** uma espécie sem animais vinculados e sessão de `admin`, **When** `DELETE /api/species/:id`, **Then** responde `204` sem corpo, o registro deixa de existir e um `GET /api/species` seguinte não o traz (CT-22 / CA-16).
- [ ] **Given** o contador de vínculos respondendo `1` para a espécie `"Gato"`, **When** `DELETE`, **Then** responde `409 SPECIES_IN_USE` com "Não é possível excluir esta espécie porque existem animais vinculados a ela." e a espécie **continua** cadastrada (CT-24 / RN-08).
- [ ] **Given** o cenário anterior, **When** a transação é inspecionada após a resposta, **Then** a contagem de espécies é idêntica à de antes e nenhuma escrita foi confirmada (CT-25 / RNF-02).
- [ ] **Given** o contador de vínculos voltando a responder `0` para a mesma espécie, **When** `DELETE` é repetido, **Then** responde `204` e a espécie é removida (CT-26).
- [ ] **Given** o contador de vínculos respondendo `0` mas o banco recusando a remoção com `P2003`, **When** `DELETE`, **Then** a resposta é `409 SPECIES_IN_USE` — o mesmo `code` e a mesma mensagem da camada de aplicação, nunca `500` (RN-09 / CA-15).
- [ ] **Given** um `id` de espécie já excluída, **When** `DELETE`, **Then** `404 SPECIES_NOT_FOUND` com "Espécie não encontrada." (CT-27 / RN-14).
- [ ] **Given** `id` fora do formato UUID, **When** `DELETE`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "id", message: "Identificador inválido." }]` (CT-34).
- [ ] **Given** requisição sem sessão, **Then** `401 SESSION_EXPIRED`; **Given** sessão de `cliente`, **Then** `403 FORBIDDEN` — e em nenhum dos dois casos algum registro é removido (CT-30 / CT-31 / CT-32 / CA-18 / RN-01).
- [ ] **Given** a exclusão recusada por vínculo feita **diretamente à API**, sem passar pela interface, **When** processada, **Then** o desfecho é idêntico ao da tela — a proteção não depende do frontend (CT-32 / CA-15).
- [ ] `species-usage-counter.ts` não importa nem referencia o símbolo `Animal`, e a implementação Prisma provisória responde `0` sem consultar o banco.
- [ ] Nenhum arquivo do projeto declara `onDelete: Cascade` ou `onDelete: SetNull` apontando para `Species`.

---

## API Notes

- `DELETE /api/species/:id` → `204 No Content`, sem corpo. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `404 SPECIES_NOT_FOUND`, `409 SPECIES_IN_USE`.
- **Pendência contratual herdada pela feature seguinte (Cadastro de pets)**: FK `animals.species_id` com `onDelete: Restrict`, substituição do corpo de `PrismaSpeciesUsageCounter` pela contagem real, e reexecução de CT-24, CT-25, CT-26 e CT-32 contra dados reais. Enquanto isso não ocorrer, a RN-08 está verificada apenas por duplo de teste — risco residual registrado na spec.

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (repositório, controller, rotas), TASK-BACKEND-003 (`speciesIdParamSchema`), TASK-BACKEND-001 (`SpeciesInUseError`, `SpeciesNotFoundError`).
- **Blocks**: TASK-BACKEND-005 (testes), TASK-FRONTEND-010 (exclusão com confirmação consome este contrato). **Bloqueia por contrato** a conclusão da feature de Cadastro de pets, conforme as pendências acima.
