# TASK-BACKEND-009 — `PATCH /api/animals/:id/status` e `DELETE /api/animals/:id`

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-009-backend-animals-status-delete`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 9 of 18 — Domínio Animais: Status e Exclusão
**Generated**: `2026-08-25`

---

## Context

Fecha a escrita do domínio com duas operações que a spec faz questão de manter separadas do `PATCH` genérico. A alteração de status é **endpoint próprio** (RN-16) porque tem conjunto de campos disjunto do restante do animal — misturá-los obrigaria um único tratador a validar duas gramáticas diferentes e decidir, a cada requisição, qual se aplica. A exclusão é definitiva e apaga também os arquivos do armazenamento (RN-37), com uma exceção deliberada: falha ao apagar arquivo **não** reverte a operação (RN-40).

---

## Scope

**In:** Schema de alteração de status, service de alteração de status com bloqueio otimista, service de exclusão com remoção dos objetos, handlers e rotas dos dois endpoints.

**Out:** Nenhuma transição automática de status. A vinculação entre pedidos e status do animal — marcar Reservado quando um pedido é aberto — pertence ao módulo de pedidos e é explicitamente fora de escopo (RN-17). Nenhuma restrição de ordem entre status (RN-15). Nenhuma inativação, arquivamento, lixeira ou recuperação: a exclusão é definitiva e o status Indisponível atende quem quer só tirar o animal da vitrine (RN-45). Não tocar em espécie nem em cidade. Sem testes (TASK-BACKEND-011).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Alterar status | `ChangeAnimalStatusService.execute()` |
| Excluir animal | `DeleteAnimalService.execute()` |
| Arquivo remanescente (RN-40) | log `warn` estruturado com o `objectPath`, sem reverter a operação |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.validators.ts` | schema de status |
| `create` | `src/domains/animals/services/change-animal-status.service.ts` | regra de status |
| `create` | `src/domains/animals/services/delete-animal.service.ts` | regra de exclusão |
| `modify` | `src/domains/animals/repositories/animal.repository.ts` | exclusão e status |
| `modify` | `src/domains/animals/animals.controller.ts` | dois handlers |
| `modify` | `src/domains/animals/animals.routes.ts` | duas rotas |

---

## Implementation

> **Reference pattern**: `update-animal.service.ts` (TASK-BACKEND-008) já resolve o bloqueio otimista — `updateIfUnchanged` devolvendo contagem e a distinção `404`/`409` pelo `findById` posterior. Reusar, não reimplementar.

### `src/domains/animals/animals.validators.ts` *(modify)*
- `changeStatusBodySchema` `.strict()`: `{ status: <um dos quatro valores em minúsculas>, updatedAt: <data e hora ISO> }`.
- Este endpoint recebe **`application/json`**, não multipart — é o único de escrita da feature que continua sob o `express.json({ limit: '10kb' })` já existente. Não montar o middleware de upload nele.
- `status` ausente, vazio, nulo, numérico ou fora da lista produz o mesmo `400` com `details: [{ field: "status", message: "Selecione uma opção válida." }]` — os quatro casos, sem ramificação de mensagem (CT-72).
- Qualquer outra chave, inclusive `name`, cai no `.strict()` com "Campo não permitido nesta requisição." (CT-75, RN-46).

### `src/domains/animals/services/change-animal-status.service.ts` *(create)*
- Altera **exclusivamente** o status. Nenhum outro campo do animal é lido do corpo nem gravado (RN-16, CT-69).
- **Qualquer** transição entre os quatro valores é aceita, sem ordem obrigatória e sem confirmação (RN-15). Não implementar máquina de estados — a alternativa de exigir passagem por Reservado antes de Adotado foi descartada **por enquanto**, porque nada coloca um animal em Reservado automaticamente enquanto o módulo de pedidos não existir, e a regra obrigaria o administrador a encenar uma reserva para registrar uma adoção real. A restrição volta à mesa quando o módulo de pedidos existir.
- Enviar o status que o animal **já possui** responde `200` sem efeito colateral — não é erro. A interface, ainda assim, não envia a requisição nesse caso (RN-15, CT-71).
- Bloqueio otimista por `updatedAt`, com a mesma distinção `404`/`409` da edição (RN-47, CT-67).
- Devolve `toAnimalResponse` do animal atualizado.

### `src/domains/animals/services/delete-animal.service.ts` *(create)*
- `findById` ⇒ `null` ⇒ `AnimalNotFoundError` (RN-44, CT-78).
- Coletar os `storagePath` das imagens **antes** de apagar as linhas — depois do `delete` em cascata, não há mais como saber quais objetos remover.
- Apagar o animal; as linhas de `animal_images` vão junto pela cascata declarada no schema (RN-55). Não apagar imagem por imagem à mão: seria duplicar em código uma garantia que já está no banco.
- **Depois do commit**, chamar `imageStorage.remove(caminhos)`. Falha aqui **não** reverte nada: registrar `warn` estruturado com os caminhos remanescentes como pendência de limpeza e responder `204` assim mesmo. O registro já não existe e nenhum ponto do produto exibe aquela imagem — o produto prefere um arquivo órfão invisível a uma exclusão que falha para o administrador (RN-40, CT-79).
- A espécie e a cidade vinculadas **não** são tocadas em nenhuma hipótese. Excluir animal nunca apaga espécie (RN-10, CT-80, CA-35).
- A exclusão é definitiva: sem coluna de exclusão lógica, sem cópia em outra tabela (RN-45).

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(modify)*
- `changeStatus` → `200` com a representação do animal. `remove` → `204` **sem corpo**.
- `PATCH /:id/status` → `authenticate` → `authorizeRole('ADMIN')` → `validateRequest({ params, body: changeStatusBodySchema })` → handler.
- `DELETE /:id` → `authenticate` → `authorizeRole('ADMIN')` → `validateRequest({ params })` → handler.
- Declarar `PATCH /:id/status` **antes** de `PATCH /:id` no arquivo, para que o caminho mais específico case primeiro.

---

## Acceptance Criteria

- [ ] **Given** um animal Disponível, **When** `PATCH /api/animals/:id/status` com `"adotado"` e o `updatedAt` corrente, **Then** `200`, o status gravado é `ADOTADO` e **nenhum outro campo do animal mudou** (CT-69, CA-30).
- [ ] **Given** as doze transições possíveis entre os quatro status, **When** executadas, **Then** todas são aceitas (CT-70, CA-31, RN-15).
- [ ] **Given** o status que o animal já possui, **When** enviado, **Then** `200` sem efeito colateral e sem erro (CT-71).
- [ ] **Given** `"VENDIDO"`, `""`, `null` e `42` como `status`, **When** enviados, **Then** os quatro respondem `400` com `details: [{ field: "status", message: "Selecione uma opção válida." }]` e nada é alterado (CT-72, CA-32).
- [ ] **Given** o corpo contendo `name` além de `status`, **Then** `400` por campo não permitido (CT-75).
- [ ] **Given** o animal alterado por outra pessoa desde a leitura, **When** o status é alterado com o token antigo, **Then** `409 ANIMAL_STALE_UPDATE` e nada é gravado (CT-67).
- [ ] **Given** o animal já excluído, **When** o status é alterado, **Then** `404 ANIMAL_NOT_FOUND` (CT-73, CA-39).
- [ ] **Given** um animal com duas imagens, **When** `DELETE /api/animals/:id`, **Then** `204` sem corpo, o animal e as duas linhas de `animal_images` deixam de existir e os dois objetos são removidos do armazenamento (CT-76, CA-34).
- [ ] **Given** o armazenamento recusando a remoção, **When** a exclusão é processada, **Then** a resposta continua `204`, o animal permanece excluído e os caminhos remanescentes aparecem no log como pendência de limpeza (CT-79, RN-40).
- [ ] **Given** um animal excluído, **When** a sua espécie é consultada, **Then** ela continua cadastrada e inalterada (CT-80, CA-35).
- [ ] **Given** um `id` inexistente, **When** excluído, **Then** `404 ANIMAL_NOT_FOUND`; **Given** um `id` que não é UUID, **Then** `400` apontando o campo `id` (CT-78, CT-92).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — nos dois endpoints (CA-40).

---

## Dependencies

- **Requires**: TASK-BACKEND-008 (`updateIfUnchanged` e a distinção `404`/`409`), TASK-BACKEND-004 (`ImageStoragePort.remove`), TASK-BACKEND-006 (repositório, mapper, rotas).
- **Blocks**: TASK-BACKEND-010 (a exclusão de animal é o que libera a exclusão da espécie no CT-83), TASK-FRONTEND-016, TASK-BACKEND-011.
