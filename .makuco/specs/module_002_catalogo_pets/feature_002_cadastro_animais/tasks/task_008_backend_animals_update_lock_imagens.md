# TASK-BACKEND-008 — `PATCH /api/animals/:id`: edição, bloqueio otimista e reconciliação de imagens

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-008-backend-animals-update-lock-imagens`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 8 of 18 — Domínio Animais: Edição
**Generated**: `2026-08-25`

---

## Context

Entrega a edição do animal, que acrescenta ao cadastro dois mecanismos próprios: o **bloqueio otimista** por `updatedAt` (RN-47) e a **reconciliação de imagens** por `keepImageIds` (RN-35, RN-36, RN-50). A situação de concorrência não é hipotética — o mesmo animal é editável pelo formulário e alterável pela listagem ao mesmo tempo, em abas diferentes, e sem a guarda a última gravação apaga a anterior sem que ninguém perceba.

---

## Scope

**In:** Schema de edição com `updatedAt` e `keepImageIds`, service de edição com bloqueio otimista e reconciliação de imagens, erro `ANIMAL_STALE_UPDATE`, handler e rota `PATCH /api/animals/:id`.

**Out:** `status` continua **não** sendo aceito — é operação própria, da TASK-BACKEND-009 (RN-16). Exclusão de animal (TASK-BACKEND-009). Não reimplementar a validação de arquivo nem o envio ao armazenamento: `StoreAnimalImagesService` e o schema de campos vêm da TASK-BACKEND-007 e são reusados. Sem testes (TASK-BACKEND-011).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Editar animal | `UpdateAnimalService.execute()` |
| Registro alterado por outra pessoa (RN-47) | `AnimalStaleUpdateError` → `409 ANIMAL_STALE_UPDATE` |
| Imagens que permanecem, na ordem desejada (RN-35) | campo `keepImageIds` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.validators.ts` | schema de edição |
| `modify` | `src/domains/animals/errors/animal.errors.ts` | erro de conflito |
| `modify` | `src/domains/animals/repositories/animal.repository.ts` | atualização condicional |
| `create` | `src/domains/animals/services/update-animal.service.ts` | regra de edição |
| `modify` | `src/domains/animals/animals.controller.ts` | handler de edição |
| `modify` | `src/domains/animals/animals.routes.ts` | rota PATCH |

---

## Implementation

> **Reference pattern**: `create-animal.service.ts` (TASK-BACKEND-007) é o molde direto — mesma injeção, mesma transação, mesmo pipeline de imagens. O `consume` com compare-and-swap de `email-confirmation-token.repository.ts` é o precedente do projeto para atualização condicional que devolve contagem.

### `src/domains/animals/animals.validators.ts` *(modify)*
- `updateAnimalBodySchema` = os campos de `createAnimalBodySchema`, mais:
  - `updatedAt`: obrigatório, data e hora ISO. É o token de concorrência lido no `GET` (RN-47).
  - `keepImageIds`: obrigatório, **texto contendo uma lista JSON de UUIDs**, com `transform` que faz o `JSON.parse` e valida cada item. É texto porque o corpo é multipart — um array real não trafega. Lista vazia (`"[]"`) é válida e significa "remover todas".
- `.strict()` mantido; `status` continua ausente do schema (RN-16, CT-68).
- **Por que o token viaja no corpo e não em `If-Match`:** o CORS em vigor libera apenas `Content-Type` e `Authorization`. Usar cabeçalho exigiria alterar configuração transversal fora do escopo — o mesmo raciocínio que já levou a spec a preferir `PATCH` a `PUT`.

### `src/domains/animals/repositories/animal.repository.ts` *(modify)*
- `updateIfUnchanged(id, expectedUpdatedAt, data, tx): Promise<number>` — `updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data })` devolvendo `count`.
- **Compare-and-swap, e a contagem é o resultado que importa**: `count === 0` significa que o registro mudou (ou sumiu) entre a leitura e a gravação. Um `update` simples sobrescreveria em silêncio, que é exatamente a perda que a RN-47 existe para impedir.
- `count === 0` **não distingue** "não existe" de "mudou" — quem distingue é o service, com um `findById` posterior: ausente ⇒ `404 ANIMAL_NOT_FOUND`; presente ⇒ `409 ANIMAL_STALE_UPDATE`.
- Acrescentar `findImagesByAnimalId(animalId, tx)`, `deleteImagesByIds(ids, tx)` e `updateImagePosition(id, position, tx)`.

### `src/domains/animals/services/update-animal.service.ts` *(create)*
- Ordem: `findById` ⇒ `null` ⇒ `AnimalNotFoundError`; validar espécie e cidade como no cadastro; reconciliar imagens; gravar em transação com atualização condicional.
- **Reconciliação de imagens:**
  - Todo id de `keepImageIds` precisa pertencer **a este animal**. Id válido de imagem alheia é `400` com `details: [{ field: "keepImageIds", message: "Imagem não encontrada." }]` — nunca `404`, porque o recurso da requisição é o animal, que existe (CT-62).
  - Estado final = `keepImageIds.length + arquivos.length`. Acima de `MAX_IMAGES_PER_ANIMAL` ⇒ `AnimalImageLimitExceededError`. O limite vale sobre o **estado final**, não sobre o envio: 3 gravadas + 3 novas é recusado (soma 6), e 5 gravadas menos 3 removidas + 3 novas é aceito (volta a 5) (RN-50, CT-48, CT-49a, CT-49b).
  - Ordem final: primeiro as de `keepImageIds` **na ordem informada**, depois as recém-enviadas na ordem de envio. `position` é reatribuído sequencialmente de 0 — a primeira é a capa (RN-35, CT-60, CT-61).
  - Toda imagem gravada ausente de `keepImageIds` é removida do banco e o objeto correspondente é apagado do armazenamento (RN-36, CT-58).
- **Enviar as novas imagens antes de abrir a transação**, pelo mesmo motivo do cadastro; falha durante o envio compensa os objetos daquele envio e propaga (RN-39).
- **Apagar os objetos das imagens removidas só depois do commit.** Antes, uma transação abortada deixaria o registro apontando para um objeto que já não existe — um animal com foto quebrada é pior do que um objeto órfão invisível.
- Ao final: `updateIfUnchanged` com o `updatedAt` recebido. `count === 0` ⇒ compensar os objetos recém-enviados e responder `409` ou `404` conforme a distinção acima. **Nada é alterado** (RN-48).
- O identificador do animal **nunca** muda na edição (RN-06): ele não é campo do schema de entrada e não aparece no `data` do `update`.
- Devolve `toAnimalResponse(animalAtualizado, now())`, com `updatedAt` novo — é o token que o cliente precisa para a próxima gravação.

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(modify)*
- Handler `update` respondendo `200`.
- `PATCH /:id` → `authenticate` → `authorizeRole('ADMIN')` → `uploadAnimalImagesMiddleware` → `validateRequest({ params: animalIdParamsSchema, body: updateAnimalBodySchema })` → `controller.update`. Mesma ordem obrigatória do `POST`.

---

## Acceptance Criteria

- [ ] **Given** alterações em nome, espécie, porte, sexo, cidade, data, descrição e nas duas alternâncias, **When** salvo, **Then** todos os valores são gravados e o `id` do animal permanece o mesmo (CT-63, CA-28).
- [ ] **Given** duas gravações sobre o mesmo animal, a segunda com o `updatedAt` lido antes da primeira, **When** processadas, **Then** a primeira é aplicada e a segunda responde `409 ANIMAL_STALE_UPDATE` com "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.", **e nada da segunda é gravado** (CT-66, CA-29, RNF-07).
- [ ] **Given** o animal excluído entre a leitura e a gravação, **When** salvo, **Then** `404 ANIMAL_NOT_FOUND` — e não `409` (CT-64).
- [ ] **Given** o corpo contendo `status`, **When** enviado, **Then** `400` por campo não permitido (CT-68, RN-16).
- [ ] **Given** um animal com duas imagens e `keepImageIds` com apenas a segunda, **When** salvo, **Then** a primeira deixa de existir no banco, o seu objeto é apagado do armazenamento, a segunda permanece e passa a ter `position` 0 (CT-58, CT-60, CA-26).
- [ ] **Given** `keepImageIds` com as mesmas imagens em ordem invertida, **When** salvo, **Then** a ordem gravada corresponde à informada e `images[0]` é a nova capa (CT-61).
- [ ] **Given** `keepImageIds` contendo o id de uma imagem de **outro** animal, **When** salvo, **Then** `400` com `details` apontando `keepImageIds` e nada é alterado (CT-62).
- [ ] **Given** 3 imagens gravadas e 3 novas enviadas com todas mantidas, **Then** `400 ANIMAL_IMAGE_LIMIT_EXCEEDED`; **Given** 5 gravadas, 2 mantidas e 3 novas, **Then** aceito e o animal fica com 5 (CT-48, CT-49a, CT-49b, CA-20).
- [ ] **Given** `keepImageIds` como `"[]"` e nenhum arquivo, **When** salvo, **Then** todas as imagens do animal são removidas e o animal permanece (RN-36).
- [ ] **Given** falha no armazenamento durante o envio das novas imagens, **When** processada, **Then** nenhuma alteração do animal é gravada, **nenhuma imagem existente é removida** e nenhum objeto daquele envio permanece (CT-55, CA-24).
- [ ] **Given** espécie ou cidade inexistente no momento da gravação, **Then** `404 SPECIES_NOT_FOUND` ou `404 CITY_NOT_FOUND` e nada é gravado.
- [ ] **Given** `updatedAt` ausente ou malformado, **Then** `400 VALIDATION_ERROR` apontando o campo.
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` (CA-40).

---

## Dependencies

- **Requires**: TASK-BACKEND-007 (`StoreAnimalImagesService`, schema de campos, `CityNotFoundError`), TASK-BACKEND-006 (repositório, mapper, rotas).
- **Blocks**: TASK-FRONTEND-017, TASK-BACKEND-011.
