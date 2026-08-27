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
- A recusa de campo não previsto continua sendo a de `objetoSemCamposExtras` (`.passthrough()` + `superRefine` + `Object.hasOwn`), reusada do cadastro — `.strict()` não é usado em lugar nenhum do backend e produziria `field: ""` (o `unrecognized_keys` do Zod sai com `path: []`), reprovando o CT-68. `status` continua ausente do schema (RN-16, CT-68).
- **Por que o token viaja no corpo e não em `If-Match`:** o CORS em vigor libera apenas `Content-Type` e `Authorization`. Usar cabeçalho exigiria alterar configuração transversal fora do escopo — o mesmo raciocínio que já levou a spec a preferir `PATCH` a `PUT`.

### `src/domains/animals/repositories/animal.repository.ts` *(modify)*
- `updateIfUnchanged(id, expectedUpdatedAt, data): Promise<number>` — `updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data })` devolvendo `count`.
- **Sem parâmetro `tx` nas assinaturas.** A porta liga-se à transação por `withTransaction(executor): AnimalRepository`, entregue na TASK-BACKEND-006: o caso de uso pede ao repositório uma instância presa à transação e chama nela os mesmos métodos. Um `tx` por método seria um segundo mecanismo de transação convivendo com o primeiro.
- **Compare-and-swap, e a contagem é o resultado que importa**: `count === 0` significa que o registro mudou (ou sumiu) entre a leitura e a gravação. Um `update` simples sobrescreveria em silêncio, que é exatamente a perda que a RN-47 existe para impedir.
- `count === 0` **não distingue** "não existe" de "mudou" — quem distingue é o service, com um `findById` **dentro da mesma transação**: ausente ⇒ `404 ANIMAL_NOT_FOUND`; presente ⇒ `409 ANIMAL_STALE_UPDATE`. **Dentro** e não depois, por dois motivos medidos: sob READ COMMITTED cada comando da transação interativa enxerga um instantâneo novo, então a releitura já vê o commit de quem gravou antes; e reler fora exigiria um erro-sentinela só para carregar o estado através da fronteira do `$transaction`.
- Acrescentar `deleteImagesByIds(ids)` e `updateImagePosition(id, position)`. **Sem `findImagesByAnimalId`**: `findById` já devolve `images` ordenadas por `position`, e o caso de uso lê o animal de qualquer forma.
- **Restrição herdada pela TASK-BACKEND-009 e pelas fatias seguintes.** Dispensar a releitura das imagens dentro da transação só é seguro por um invariante: **toda** mutação de `animal_images` passa pela linha de `animals` e portanto gira o token de `updatedAt` — hoje as três mutações estão confinadas ao repositório e nenhuma é alcançável fora do cadastro (que cria a própria linha do animal) ou da edição (que sempre executa `updateIfUnchanged`). Qualquer operação futura que altere imagem sem tocar a linha de `animals` — endpoint de imagem isolado, reordenação dedicada — invalida a reconciliação feita fora da transação e passa a exigir a releitura das imagens dentro dela.

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
- `PATCH /:id` → `authenticate` → `authorizeRole('admin')` → `uploadAnimalImagesMiddleware` → `validateRequest({ params: animalIdParamsSchema, body: updateAnimalBodySchema })` → `controller.update`. Mesma ordem obrigatória do `POST`.

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

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 9 (1 criado, 8 modificados)
**Verificação**: contra o Postgres real do projeto (17.6, Prisma 5.22), com duplo de armazenamento. Todas as sondas removidas e o banco restaurado ao estado inicial (`users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571, `animals` 0, `animal_images` 0).

#### Resumo

A entrega implementa os treze critérios de aceite. Os dois mecanismos centrais — o bloqueio otimista da RN-47 e a reconciliação de imagens da RN-35/RN-36/RN-50 — foram reproduzidos contra o banco real e se comportam como o arquivo descreve, inclusive nos casos adversariais. As quatro alegações de que o texto da task não funciona **procedem todas as quatro**, e as quatro exigem emenda no texto. Nenhum achado `critical` ou `major`; três achados `minor`/`suggestion`, nenhum deles bloqueante.

---

#### O bloqueio otimista — medido contra o banco real

| # | O que foi medido | Resultado |
|---|---|---|
| M1 | `@updatedAt` é aplicado pelo `updateMany`? | **Sim.** `count = 1`; `t0 = 2026-08-27T20:11:26.405Z` → `t1 = 2026-08-27T20:11:28.874Z`. A trava destrava sozinha; o token **não** deve ser parâmetro, e a ausência dele em `UpdateAnimalData` está correta. |
| M2 | Mesma condição com marca antiga | `count = 0`, nome e `updatedAt` **inalterados**. |
| M3 | Round-trip `toISOString()` × `timestamptz(3)` | **Casa exatamente.** A coluna guarda `2026-08-27T20:11:26.405000` — os microssegundos são zeros à direita do milissegundo, sem resíduo. `updateMany` com `new Date(iso)` devolve `count = 1`. |
| M4 | Token truncado (sem milissegundos) | `count = 0` → `409`. Confirma o que o comentário de `FORMATO_DE_DATA_E_HORA` afirma: é limitação conhecida e o desfecho é o correto. |
| M5 | Token com deslocamento `-03:00` do mesmo instante | `count = 1`. Aceitar `±HH:MM` além de `Z` não abre buraco: o instante é o mesmo. |
| M6 | READ COMMITTED dentro da transação interativa | Leitura inicial `"ZZPROBE descricao"`, commit alheio em outra conexão, releitura **na mesma transação** → `"ZZPROBE C0"`. **A releitura dentro da transação enxerga o commit de quem gravou antes.** A justificativa do agente para contrariar o "posterior" do texto está correta. |
| M7 | CT-66 — duas gravações **simultâneas** com o mesmo token, dois clientes Prisma | A = `200`, B = `409 ANIMAL_STALE_UPDATE`. Exatamente uma venceu; o nome final é o da vencedora. |
| M8 | CT-64 — animal excluído **entre** a leitura e a gravação | `404 ANIMAL_NOT_FOUND`, e **não** `409`. A distinção por releitura funciona nas duas pontas. |

A escolha de `updateMany` sobre `update` é a correta e pelo motivo alegado: `update` exige filtro único e lança `P2025`, transformando um conflito previsto pelo contrato em exceção de infraestrutura.

---

#### As duas garantias herdadas da 007 — medidas **pelo caminho da edição**

| # | O que foi medido | Resultado |
|---|---|---|
| G1 | RNF-13 — cinco imagens de 100 ms pelo `UpdateAnimalService` | `maximoEmVoo = 5`; os cinco `inicio:` no mesmo milissegundo (7201–7202 ms) e os cinco `fim:` em 7302 ms. **101 ms contra os ≥500 ms do serial.** A edição não introduziu caminho serial próprio — é a mesma instância de `StoreAnimalImagesService`, compartilhada pela fábrica do controller. |
| G2 | Compensação espera **todos** terminarem — falha da mais rápida entre cinco (20/60/100/140/180 ms) | Os cinco `fim:` (4751, 4791, 4830, 4870, 4911 ms) precedem o único `remove:` (4911 ms). 4 enviados, 4 removidos, **0 órfãos**. Nenhuma imagem existente do animal foi tocada. |

O `allSettled` está intacto e é ele que produz G2.

---

#### A assimetria das imagens — casos construídos

| # | Caso | Resultado |
|---|---|---|
| I1 | Transação desfeita (`409`) com 2 imagens **novas já enviadas** | `409 ANIMAL_STALE_UPDATE`; 2 enviados, 2 removidos, **0 órfãos**; nome, imagens e alternâncias do animal **inalterados** (RN-48). |
| I2 | Remoção falhando **depois do commit** (RN-40) | Resposta `200`, edição gravada, `remove` tentado uma vez, erro **logado e não propagado**. |
| I3 | Substituição parcial: mantém 3 reordenadas + 2 novas | `positions = 0,1,2,3,4`; a ordem final é a de `keepImageIds` seguida da ordem de envio; os 2 objetos removidos são apagados **depois** do commit (`remove:` em 8334 ms, muito após o commit). |
| I4 | Remover todas (`keepImageIds = "[]"`, sem arquivos) | 0 imagens restantes, 5 objetos apagados, **animal permanece**. |
| I5 | CT-48 — 3 gravadas + 3 novas | `400 ANIMAL_IMAGE_LIMIT_EXCEEDED`, **com zero uploads disparados**. O limite sobre o estado final é aferido antes de tocar a rede. |
| I6 | CT-49b — 5 gravadas, mantém 2, +3 novas | Aceito; o animal fica com 5; `positions = 0,1,2,3,4`. |
| I7 | CT-62 — `keepImageIds` com imagem de **outro** animal | `400 VALIDATION_ERROR` com `details = [{"field":"keepImageIds","message":"Imagem não encontrada."}]`; **zero uploads**; nada alterado. |
| I8 | Espécie / cidade inexistente | `404 SPECIES_NOT_FOUND` / `404 CITY_NOT_FOUND`, **zero uploads**, nada gravado. |
| I9 | CT-63 — todos os campos alterados | Todos gravados; `id` estável; `nameNormalized = "zzprobe renomeado ácido"` (**acento preservado**, só a caixa removida); `status` preservado como `DISPONIVEL`; `resposta.updatedAt` idêntico ao token novo do banco. |

---

#### As quatro alegações — todas procedem

**1. "`.strict()` mantido" — o texto da task está duplamente errado.** Verificado: `git grep '\.strict()'` não devolve nada em `services/backend/src`; a 007 usa `objetoSemCamposExtras` (`.passthrough()` + `superRefine` + `Object.hasOwn`), e o próprio arquivo da 007 já registra na L103 que a instrução foi retirada na Rodada 1 daquela review. Medido: `{...corpo, status: 'ADOTADO'}` → `status=Campo não permitido nesta requisição.` — com `field` preenchido, como o CT-68 exige. Com `.strict()` o `unrecognized_keys` do Zod sai com `path: []` e o `field` viraria `""`. **Alegação procede.**

**2. `authorizeRole('ADMIN')` não compila.** Medido, com o código de erro exato: `src/…(2,32): error TS2345: Argument of type '"ADMIN"' is not assignable to parameter of type '"admin" | "cliente"'.` (`AUTH_ROLES` em `user.mapper.ts` L13). **Alegação procede.**

**3. Assinaturas com `tx` por método contrariam a porta entregue.** Verificado em `HEAD`: `withTransaction(executor): AnimalRepository` já existia em `animal.repository.ts` (L208 da declaração, L366 da implementação) desde a TASK-BACKEND-006. Acrescentar um `tx` por método criaria um segundo mecanismo de transação convivendo com o primeiro. **Alegação procede.**

**4. `findImagesByAnimalId` é desnecessário — e o argumento de segurança se sustenta.** `findById` já traz `images` com `orderBy: { position: 'asc' }` via `INCLUIR_RELACOES`, e o caso de uso lê o animal de qualquer forma. O argumento foi **auditado, e não apenas aceito**: toda mutação de `animal_images` no projeto está confinada a `animal.repository.ts` (L435 `createManyAndReturn`, L494 `deleteMany`, L502 `update`), e nenhuma delas é alcançável fora de dois caminhos — o cadastro, que cria a própria linha de `animals`, e a edição, que sempre executa `updateIfUnchanged` (e M1 provou que ela sempre gira o token). Não existe hoje caminho que altere imagem sem tocar a linha do animal, e M7 mostra que se existisse a gravação sairia `409`. **Alegação procede** — com a ressalva registrada no achado #4 abaixo.

---

#### Decisões de julgamento — avaliadas

- **`updatedAt` exige fuso explícito.** Correto e necessário. Medido: `"2026-08-27T20:14:43.604"` → `400` "Informe a data e hora da última alteração no formato ISO 8601."; `"2026"` → `400` pelo mesmo caminho. Sem a âncora, `new Date("2026")` é 1º de janeiro e sairia `409`, mandando o administrador recarregar por causa de um erro de digitação. Ver, porém, o achado #1.
- **`keepImageIds` repetido é recusado, não deduplicado.** Correto. A lista **é** a ordem final e `position` 0 é a capa; deduplicar devolveria menos imagens do que o administrador listou, e aceitar faria a soma da RN-50 contar a mesma imagem duas vezes. Medido: `400` "Cada imagem mantida deve aparecer uma única vez na lista."
- **`""` é ausente, `"[]"` é "remover todas".** Correto, e é a decisão mais importante das três. Medido: `""` → `400` "Este campo é obrigatório."; `"[]"` → aceito e remove todas (I4). Tratá-los como iguais faria um formulário que não montou o campo apagar todas as imagens do animal em silêncio.

---

#### Verificação especial

| Item | Resultado |
|---|---|
| 27 chaves em `animals.messages.ts`, as 22 anteriores intactas | **Confirmado.** Contadas 27. O `git diff` do arquivo mostra exatamente duas alterações: a linha de cabeçalho de comentário (que não é chave) e o bloco de 5 chaves apensado após a linha 149. Nenhuma das 22 chaves anteriores foi tocada; o arquivo **não** foi recriado. |
| Controller não acessa Prisma e chama exatamente UM service | **Confirmado.** `animals.controller.ts` L227 chama só `this.services.updateAnimal.execute(...)`. O `prisma` aparece apenas na fábrica `createAnimalsController`, que é o padrão já estabelecido pela 006/007. |
| Repositório não lança erro HTTP | **Confirmado.** `updateIfUnchanged` devolve `count`, `deleteImagesByIds` devolve `count`, `findById` devolve `null`. |
| `""` tratado como ausente | **Confirmado** em `updatedAt` e em `keepImageIds`. |
| `z.enum` com `errorMap` | **Confirmado** — `conjuntoFechado` reusado por `CAMPOS_DO_ANIMAL`, sem cópia. |
| `Object.hasOwn` e nunca `in` | **Confirmado.** Medido: `constructor`, `toString` e `hasOwnProperty` como chave do corpo → todos `400` "Campo não permitido nesta requisição.". |
| `authorizeRole('admin')` | **Confirmado** em `animals.routes.ts` L172-179, e na ordem obrigatória `authenticate → authorizeRole → uploadAnimalImages → validateRequest → controller.update`. |
| `nameNormalized` preserva acento e não é único | **Confirmado** no banco (I9) e no schema (`@db.VarChar(60)` sem `@unique`, L190). |
| Proibido `any` | **Confirmado.** Nenhuma ocorrência em código; a única aparição é prosa em comentário explicando por que `Array.isArray` sobre `unknown` foi contornado. |
| Comentários sem acento, strings ao usuário com acento | **Confirmado.** As poucas ocorrências acentuadas em comentário são citações literais de mensagens ao usuário, entre aspas — mesmo estilo já usado na 007. |
| `typecheck` | Exit 0 (`tsc --noEmit` + seed + test). |
| Suíte de testes | 24 suítes, **314 testes**, 0 falhas. |
| CORS não libera `PUT` nem cabeçalho próprio | **Confirmado** em `src/config/cors.ts` L17-18: `methods` sem `PUT`, `allowedHeaders` só `Content-Type` e `Authorization`. A justificativa de `PATCH` + token no corpo está factualmente ancorada (Decisão 2 do changelog). |

---

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/domains/animals/animals.validators.ts` | L535, L556 | validação | `updatedAt` com data de calendário inexistente passa. Medido: `"2026-02-30T00:00:00.000Z"` satisfaz `FORMATO_DE_DATA_E_HORA`, e `new Date` **não** devolve `NaN` — o V8 transborda para `2026-03-02T00:00:00Z`. O token vira um instante diferente e o desfecho é `409 ANIMAL_STALE_UPDATE` em vez do `400` que o critério de aceite "`updatedAt` ausente ou malformado ⇒ `400`" pede. É exatamente o modo de falha que o comentário da L549-557 diz estar prevenido: a âncora barra `"2026"`, mas não o transbordo de calendário. Inconsistente com `dataDeNascimentoSchema` (L462-467), que **rejeita** `"2024-02-30"` porque `comoDataCivilUtc` confere o calendário. | Conferir o calendário depois de construir a `Date` — reserializar e comparar com o texto normalizado, ou reusar a checagem que `comoDataCivilUtc` já faz — antes de aceitar o token. Sem impacto de dados: o caminho só é alcançável por chamada direta à API (RN-33), já que a interface reenvia o `toISOString()` do `GET`. |
| 2 | minor | `src/domains/animals/services/store-animal-images.service.ts` (uso em `update-animal.service.ts` L215) | L272 | observabilidade | A remoção pós-commit reusa `compensar`, e com ela reusa o texto do log `"[animal-images] falha ao remover objetos apos envio desfeito; limpeza pendente"`. Medido (I2): uma edição **gravada com sucesso** cujo apagamento pós-commit falha registra que um envio foi desfeito — o que não aconteceu. Quem investigar o log procurará por uma gravação revertida que não existe. | Dar linha própria ao caminho pós-commit, ou passar um argumento de contexto a `compensar` que distinga "envio desfeito" de "imagens removidas na edição". O comportamento (logar sem propagar) está correto e é o que a RN-40 manda. |
| 3 | suggestion | `src/domains/animals/repositories/animal.repository.ts` | L489, L501 | robustez | `deleteImagesByIds` e `updateImagePosition` filtram apenas por `id` de imagem, sem escopo por `animalId`. **Não é explorável hoje** — auditado: os identificadores sempre vêm de `reconciliarImagens`, que só produz imagens do animal lido, e `keepImageIds` de imagem alheia é barrado antes (I7). | Acrescentar `animalId` ao `where` das duas. Torna impossível, e não apenas improvável, que um chamador futuro apague ou reposicione imagem de outro animal. |
| 4 | suggestion | `src/domains/animals/services/update-animal.service.ts` | L430-453 | invariante | A dispensa de `findImagesByAnimalId` repousa sobre um invariante hoje verdadeiro: **toda** mutação de `animal_images` passa pela linha de `animals`. O comentário de `reconciliarImagens` o registra, mas ele é uma restrição sobre código **futuro**, não sobre o atual. | Registrar o invariante como restrição explícita da TASK-BACKEND-009 e das fatias seguintes: qualquer operação que altere imagem sem tocar a linha de `animals` (endpoint de imagem isolado, reordenação dedicada) invalida a reconciliação feita fora da transação e exige releitura das imagens dentro dela. |
| 5 | suggestion | `src/domains/animals/services/update-animal.service.ts` | L133-139 | prática de código | Cinco dependências no construtor (Object Calisthenics, regra 8: no máximo 2). Registrado apenas: espelha `CreateAnimalService` campo a campo, e a consistência entre os dois caminhos de escrita vale mais aqui do que a regra. | Nenhuma ação nesta task. |

---

#### Detalhes por passagem

**Pass 1 — Task Compliance**: 13 de 13 critérios de aceite **implementados**, todos com evidência medida contra o banco real (tabelas acima). Nenhum achado.

**Pass 2 — Diff Analysis**: os 6 arquivos de `## Files` foram criados/modificados como indicado. Dois arquivos **além** da lista: `animals.messages.ts` (5 chaves apensadas — indispensável, e a task cita os textos sem listar o arquivo) e `create-animal.service.ts` (apenas `export` em `PORTE_PERSISTIDO`/`SEXO_PERSISTIDO`, evitando duas cópias do mesmo vocabulário). Nenhum dos dois é `Scope — Out`. `status` continua fora do schema, exclusão de animal não foi antecipada e nenhum teste foi entregue (são da 011) — o escopo foi respeitado. Nenhuma formatação em massa, nenhum arquivo alheio tocado. Nenhum achado.

**Pass 3 — Code Practices**: sem `else`, sem número mágico (`MAX_IMAGES_PER_ANIMAL` vem de `upload-limits.ts`), nomes sem abreviação, dependências injetadas, guardas por early return. Comentários explicam o **porquê**. Um nível de indentação por método exceto `reconciliarImagens` e `reposicionar` (dois, ambos `for` + `if` de guarda). Achado #5.

**Pass 4 — Testing Review**: esta task **não entrega testes** por escopo explícito (são da TASK-BACKEND-011). A suíte existente permanece verde (24 suítes, 314 testes). Registrado como pendência da 011, não como achado desta task: os caminhos aqui medidos manualmente — CT-66 concorrente, CT-64, CT-62, CT-48/CT-49b, RN-40 pós-commit e a compensação com todos os envios assentados — são exatamente os que a 011 precisa cobrir, e nenhum deles é alcançável por teste que não simule concorrência real ou não use duplo de armazenamento com atraso configurável.

**Pass 5 — Security Review**: **nenhum achado `critical` ou `major`.**
- **A01** — `authenticate` + `authorizeRole('admin')` antes de qualquer leitura de corpo; `403` para `cliente` sem que os 25 MB sejam lidos. `id` conferido como UUID por `animalIdParamsSchema`. Sem IDOR: o recurso é global à administração e a pertinência das imagens é conferida contra o animal (I7).
- **A03** — nenhuma interpolação: `updateMany`/`deleteMany`/`update` do Prisma, todos parametrizados. `keepImageIds` passa por `JSON.parse` e cada item por `FORMATO_DE_UUID` antes de virar `where`.
- **A04** — o limite da RN-50 é aferido sobre o estado final e antes do envio (I5); o bloqueio otimista impede a sobrescrita silenciosa; os caminhos negativos (falha de envio, conflito, ausência) não deixam recurso inconsistente (I1, G2).
- **A05/A09** — sem stack ao cliente; o único `console.error` novo não carrega PII, só caminhos de objeto. Ver achado #2 quanto ao texto.
- **A08** — o tipo da imagem continua apurado por assinatura binária, e o caminho do objeto nunca deriva do nome enviado (RN-52, herdado da 007 sem alteração).
- **A06** — nenhuma dependência nova.
- Sem limitador de taxa neste endpoint, coerente com a Decisão 14 do changelog e com o `POST`. Registrado, não é achado desta task.

**Pass 6 — Bug Detection**: lidos por inteiro os 5 arquivos alterados e os 2 de que dependem (`store-animal-images.service.ts`, `create-animal.service.ts`). Sem `null`/`undefined` desprotegido (`atual === null`, `atualizado === null` e `porIdentificador.get(...) === undefined` todos guardados). Sem condição de corrida: M6/M7/M8 demonstram que a única leitura-modificação-escrita do fluxo é serializada pelo bloqueio da linha de `animals`. Sem vazamento de recurso: a transação fecha nos dois desfechos e o `catch` de `persistir` alcança **todas** as saídas de falha. Sem `catch` vazio — o único é o de `compensar`, que loga por decisão de contrato (RN-40). Sem off-by-one: `position` sequencial de 0 e deslocamento das novas igual a `mantidas.length`, medido em I3/I6 (`0,1,2,3,4`). Sem coerção frouxa. Sem lógica invertida. Sem estado inconsistente: I1 confirma que nada é gravado quando a condição é recusada. Achados #1 e #2.

**Pass 7 — Project Patterns**: estrutura de pastas, nomenclatura, fluxo de dependência (service → porta, nunca → Prisma), tratamento de erro por classes de domínio e catálogo de mensagens centralizado — todos alinhados a `.makuco/codebase/conventions.md` e ao que a 006/007 estabeleceram. Linguagem ubíqua respeitada: `UpdateAnimalService.execute()` para "editar animal", `AnimalStaleUpdateError` para "registro alterado por outra pessoa", `keepImageIds` para "imagens que permanecem". Achados #3 e #4.

---

#### Emendas necessárias no texto desta task

As quatro se sustentaram sob medição e devem ser aplicadas. **Nenhuma emenda é proposta com base em alegação não sustentada.**

1. **`## Implementation` › `animals.validators.ts`** — trocar "`.strict()` mantido" por: "A recusa de campo não previsto continua sendo a de `objetoSemCamposExtras` (`.passthrough()` + `superRefine` + `Object.hasOwn`), reusada do cadastro. `.strict()` não é usado em lugar nenhum do backend e produziria `field: ""`, reprovando o CT-68."
2. **`## Implementation` › `animals.routes.ts`** — trocar `authorizeRole('ADMIN')` por `authorizeRole('admin')`. `AuthRole` é `'admin' | 'cliente'`; `'ADMIN'` é o literal do enum do banco e não compila (`TS2345`, reproduzido).
3. **`## Implementation` › `animal.repository.ts`** — retirar o parâmetro `tx` das quatro assinaturas. A porta entregue liga-se à transação por `withTransaction(executor): AnimalRepository`, presente desde a TASK-BACKEND-006; um `tx` por método seria um segundo mecanismo convivendo com o primeiro.
4. **`## Implementation` › `animal.repository.ts`** — retirar `findImagesByAnimalId(animalId, tx)`. `findById` já devolve `images` ordenadas por `position`, e o caso de uso lê o animal de qualquer forma. Acrescentar, em contrapartida, a restrição para as fatias seguintes descrita no achado #4.
5. **`## Implementation` › `animal.repository.ts`** — trocar "com um `findById` **posterior**" por "com um `findById` **dentro da mesma transação**", e registrar o motivo medido: sob READ COMMITTED cada comando da transação interativa enxerga um instantâneo novo, então a releitura já vê o commit de quem gravou antes (M6). Fora da transação seria necessário um erro-sentinela para atravessar a fronteira do `$transaction`.

#### Veredicto

> **APROVADA** — os 13 critérios de aceite estão implementados e verificados contra o banco real; nenhum achado `critical` ou `major`. Os achados **#1** e **#2** são `minor` e não bloqueiam o fechamento; **#3**, **#4** e **#5** são `suggestion`. As cinco emendas de texto acima corrigem a task, e não a implementação.
