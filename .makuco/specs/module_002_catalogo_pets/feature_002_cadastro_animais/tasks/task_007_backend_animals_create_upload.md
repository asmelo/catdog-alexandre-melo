# TASK-BACKEND-007 — `POST /api/animals`: cadastro com imagens, atomicidade e validação de servidor

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-007-backend-animals-create-upload`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 7 of 18 — Domínio Animais: Cadastro
**Generated**: `2026-08-25`

---

## Context

Entrega o cadastro de animal em `multipart/form-data`, com de zero a cinco imagens gravadas no armazenamento de objetos. O ponto que governa o desenho é a RN-39: **ou o animal e as suas imagens são gravados, ou nada é gravado** — e "nada" inclui o armazenamento, que não participa da transação do banco e por isso exige compensação explícita. Toda validação vale igualmente para quem chama a API fora da interface (RN-33).

---

## Scope

**In:** Schema de criação, pipeline de validação e gravação de imagens, service de cadastro, handler e rota `POST /api/animals` com o middleware de multipart montado, e as mensagens de erro correspondentes.

**Out:** Edição, alteração de status e exclusão (TASK-BACKEND-008 e 009). `status` **não** é campo aceito no corpo: o animal nasce Disponível pelo default do schema (RN-14). Nenhum redimensionamento, recorte, compressão ou correção de orientação de imagem. Não alterar o mapper nem o repositório de leitura além dos métodos de escrita acrescentados. Sem testes (TASK-BACKEND-011).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Cadastrar animal | `CreateAnimalService.execute()` |
| Espécie inexistente (RN-08) | `SpeciesNotFoundError` → `404 SPECIES_NOT_FOUND` (reusado da FEATURE-001) |
| Cidade inexistente (RN-26) | `CityNotFoundError` → `404 CITY_NOT_FOUND` |
| Acima de cinco imagens (RN-50) | `AnimalImageLimitExceededError` → `400 ANIMAL_IMAGE_LIMIT_EXCEEDED` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.messages.ts` | mensagens de escrita |
| `modify` | `src/domains/animals/animals.validators.ts` | schema de criação |
| `modify` | `src/domains/animals/errors/animal.errors.ts` | erro de cidade |
| `modify` | `src/domains/animals/repositories/animal.repository.ts` | métodos de escrita |
| `create` | `src/domains/animals/services/store-animal-images.service.ts` | pipeline de imagens |
| `create` | `src/domains/animals/services/create-animal.service.ts` | regra de cadastro |
| `modify` | `src/domains/animals/animals.controller.ts` | handler de criação |
| `modify` | `src/domains/animals/animals.routes.ts` | rota POST com multipart |

---

## Implementation

> **Reference pattern**: `src/domains/auth/services/register-user.service.ts` mostra o padrão de service com dependências injetadas, `$transaction` e efeito externo tratado fora dela. A diferença estrutural aqui é o sentido: lá o efeito externo (e-mail) pode falhar sem derrubar o caso de uso; aqui ele **derruba** e precisa ser desfeito.

### `src/domains/animals/animals.validators.ts` *(modify)*
- `createAnimalBodySchema` `.strict()` sobre os campos do `POST` da spec: `name`, `speciesId`, `size`, `sex`, `cityId`, `birthDate?`, `description?`, `acceptsOtherAnimals?`, `needsLargeSpace?`.
- **Todo campo chega como texto**, porque o corpo é multipart. Booleanos vêm como `"true"`/`"false"` e precisam de `z.enum(['true','false']).transform(...)` com default `false` — `z.boolean()` recusaria a string e produziria erro incompreensível para o administrador (RN-24).
- `name`: `.trim()` mais uma transformação que **colapsa sequências de espaços internos em um só** (`replace(/\s+/g, ' ')`), depois `.min(2)` e `.max(60)`. A ordem importa: validar antes de normalizar recusaria `"  Theo  "` de 8 caracteres por engano, e aceitaria um nome que após colapso ficaria com 1 caractere (RN-03, RN-04, CT-07).
- `nameNormalized` é derivado do `name` já normalizado, em minúsculas — usado **só** para ordenar (RN-41). Não é `@unique`: dois animais podem se chamar "Theo" (RN-05).
- `size` e `sex` são `z.nativeEnum`-equivalentes sobre os valores **em minúsculas e sem acento** do contrato (`pequeno|medio|grande`, `macho|femea`), com a mensagem "Selecione uma opção válida.", convertidos para o literal do enum Prisma na fronteira do service.
- `birthDate` é **opcional** (RN-18): um animal resgatado frequentemente chega sem essa informação, e exigi-la produziria datas inventadas.
- `cityId` é obrigatório, e com ele a localização inteira: estado e cidade são obrigatórios (RN-25), mas apenas a cidade trafega.
- `birthDate`: `AAAA-MM-DD`; recusar futura e anterior a 30 anos **comparando no fuso America/Sao_Paulo**, com o `now` vindo de `~/utils/clock.ts`. Com o servidor em UTC, às 22h em São Paulo já é o dia seguinte em UTC, e uma comparação ingênua recusaria a data de hoje como futura. A data de hoje é sempre aceita (RN-19, CT-16).
- `description`: opcional, `.trim()`, `.max(1000)` contado **após** a normalização (RN-23).
- `status` **não** existe no schema. Enviá-lo cai no `.strict()` e produz "Campo não permitido nesta requisição." (RN-14, CT-14).
- Qualquer chave não prevista produz `400` com `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` (RN-46, CT-13).

### `src/domains/animals/repositories/animal.repository.ts` *(modify)*
- Acrescentar `create(data, tx)` e `createImages(animalId, images, tx)`, ambos aceitando o cliente transacional para participarem da mesma transação.
- Expor `withTransaction<T>(fn: (tx) => Promise<T>): Promise<T>` — é o repositório, e não o service, quem conhece o Prisma.

### `src/domains/animals/services/store-animal-images.service.ts` *(create)*
- Recebe `ImageStoragePort` e produz, a partir dos arquivos em memória, a lista `{ imageId, objectPath, publicUrl, contentType, sizeBytes }`.
- Ordem de verificação **por arquivo**, e a ordem importa porque cada passo produz mensagem diferente: tamanho 0 ⇒ "O arquivo enviado está vazio." (`400`); assinatura binária não é JPEG nem PNG ⇒ `415 ANIMAL_IMAGE_TYPE_NOT_ALLOWED`; acima de 5 MB ⇒ `413 ANIMAL_IMAGE_TOO_LARGE`.
- **Validar todos os arquivos antes de enviar qualquer um.** Enviar durante a validação faria um envio com a quinta imagem inválida deixar quatro objetos órfãos no balde.
- **Compensação obrigatória:** se o envio da enésima imagem falhar, remover os objetos das anteriores **daquele envio** antes de propagar o erro. É isso que faz o CT-55 passar — falha na terceira de cinco não deixa arquivo remanescente (RN-39, RNF-06, CA-24).
- Falha do armazenamento propaga `ImageStorageUnavailableError` (`503`), nunca um erro do fornecedor.
- O caminho de cada objeto vem de `buildAnimalImageObjectPath` — o nome do arquivo enviado não é parâmetro em ponto algum (RN-52).

### `src/domains/animals/services/create-animal.service.ts` *(create)*
- Dependências injetadas: `AnimalRepository`, `SpeciesRepository` (da FEATURE-001), `StateRepository` (para a cidade), `StoreAnimalImagesService`, `ImageStoragePort`, `Clock`.
- Um animal possui de **zero a cinco** imagens, e zero é válido: o administrador cadastra o animal em campo e envia as fotos depois (RN-30).
- Ordem: contar imagens ⇒ acima de `MAX_IMAGES_PER_ANIMAL` ⇒ `AnimalImageLimitExceededError` (o estado final de um cadastro é o próprio envio, RN-50); espécie inexistente ⇒ `SpeciesNotFoundError`; cidade inexistente ⇒ `CityNotFoundError`; então validar e enviar as imagens; então gravar em transação.
- **Validar espécie e cidade antes de tocar no armazenamento**: falhar depois do envio significaria compensar objetos que nunca precisariam ter subido.
- `status` é sempre `DISPONIVEL` — vem do default do schema, não de parâmetro (RN-14).
- `stateId` **não** é recebido nem gravado: o estado do animal é o estado da sua cidade. O par incoerente "Campo Magro - ES" não é validado, é **inexprimível** no contrato (RN-26a, RN-28, CA-17).
- Gravação em **uma** `$transaction`: `create` do animal + `createImages` com `position` sequencial a partir de 0, na ordem de envio. A primeira é a capa (RN-35).
- Se a transação falhar **depois** de as imagens terem subido, remover os objetos enviados. O banco desfaz sozinho; o armazenamento não (RN-39).
- Devolve `toAnimalResponse(animalCriado, now())` — a mesma projeção da leitura, sem duplicar a serialização.

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(modify)*
- Handler `create` respondendo `201` com a representação do animal.
- `POST /` → `authenticate` → `authorizeRole('ADMIN')` → `uploadAnimalImagesMiddleware` → `validateRequest({ body: createAnimalBodySchema })` → `controller.create`.
- **A ordem é obrigatória:** o multipart precisa ser lido antes da validação, porque é ele que popula `req.body` com os campos de texto; validar antes leria um corpo vazio e recusaria todo cadastro válido. E ele vem depois da autorização para que um `cliente` não consiga fazer o servidor ler 25 MB antes de receber `403`.

---

## Acceptance Criteria

- [ ] **Given** `name`, `speciesId`, `size`, `sex` e `cityId` válidos e nenhuma imagem, **When** `POST /api/animals`, **Then** `201` com o animal criado, `status: "disponivel"` e `images: []` (CT-01, CT-02, CA-10, CA-11).
- [ ] **Given** `name: "  Theo   Junior "`, **When** criado, **Then** o valor persistido e devolvido é `"Theo Junior"` (CT-07).
- [ ] **Given** nomes de 1, 2, 60 e 61 caracteres, **When** criados, **Then** o de 1 responde "O nome do animal deve ter no mínimo 2 caracteres.", os de 2 e 60 são aceitos e o de 61 responde "O nome do animal deve ter no máximo 60 caracteres." (CT-04, CT-05, CT-06).
- [ ] **Given** já existir um animal "Theo", **When** outro "Theo" é criado, **Then** `201` — o nome não é único (CT-08, RN-05).
- [ ] **Given** `speciesId`, `size`, `sex` e `cityId` todos ausentes, **When** enviado, **Then** `400 VALIDATION_ERROR` com **um item de `details` por campo, todos de uma vez**, e nada é criado (CT-09, CA-12).
- [ ] **Given** `speciesId` de espécie já excluída, **Then** `404 SPECIES_NOT_FOUND`; **Given** `cityId` inexistente, **Then** `404 CITY_NOT_FOUND` — e nada é criado nos dois casos (CT-10, CT-11).
- [ ] **Given** `size: "gigante"` ou `sex: "outro"`, **When** enviado, **Then** `400` com "Selecione uma opção válida." (CT-12).
- [ ] **Given** o corpo contendo `status` ou qualquer chave não prevista, **When** enviado, **Then** `400` com `details` apontando a chave e "Campo não permitido nesta requisição."; nenhum animal é criado com o status escolhido (CT-13, CT-14).
- [ ] **Given** a data de amanhã, **Then** "A data de nascimento não pode ser futura."; **Given** 31 anos atrás, **Then** "Informe uma data de nascimento dos últimos 30 anos."; **Given** a data de hoje com o processo em UTC às 22h de São Paulo, **Then** aceita (CT-15, CT-16, CT-17, CA-13).
- [ ] **Given** descrição de 1000 caracteres, **Then** aceita; **Given** 1001, **Then** "A descrição deve ter no máximo 1000 caracteres." (CT-21).
- [ ] **Given** nenhum dos dois indicadores enviado, **When** criado, **Then** `acceptsOtherAnimals` e `needsLargeSpace` são ambos `false` e nunca nulos (CT-22, RN-24).
- [ ] **Given** cinco imagens válidas, **Then** todas gravadas com `position` 0 a 4 na ordem de envio; **Given** seis, **Then** `400 ANIMAL_IMAGE_LIMIT_EXCEEDED` e **nenhuma** gravada (CT-45, CT-46, CT-47, CA-20).
- [ ] **Given** um SVG, um GIF ou um executável renomeados para `.jpg` com `mimetype` declarado `image/jpeg`, **Then** `415 ANIMAL_IMAGE_TYPE_NOT_ALLOWED` e nada é criado (CT-52, CT-53, CA-21).
- [ ] **Given** um arquivo de 0 byte, **Then** `400` com "O arquivo enviado está vazio." (CT-51).
- [ ] **Given** o armazenamento falhando ao gravar a **terceira** de cinco imagens, **When** enviado, **Then** nenhum animal é criado no banco **e nenhum dos dois objetos já enviados permanece no armazenamento** (CT-55, CA-24, RNF-06).
- [ ] **Given** o armazenamento indisponível, **Then** `503 IMAGE_STORAGE_UNAVAILABLE` com "Não foi possível salvar as imagens. Tente novamente." e o banco permanece consistente (CT-56, RNF-14).
- [ ] **Given** nomes de arquivo com `../`, emoji e 300 caracteres, **When** gravados, **Then** os caminhos são `animals/<id>/<uuid>.<ext>` e nenhum contém trecho do nome enviado (CT-57, CA-27).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — e nesse caso o corpo de 25 MB **não** chega a ser lido (CA-40).
- [ ] **Given** as mesmas violações enviadas por chamada direta à API, fora da interface, **When** processadas, **Then** as respostas são idênticas às do fluxo pela tela (CT-91, CA-22).

---

## Dependencies

- **Requires**: TASK-BACKEND-003 (multipart, limites, assinatura binária), TASK-BACKEND-004 (`ImageStoragePort`, caminho do objeto), TASK-BACKEND-006 (repositório, mapper, controller, rotas, mensagens), FEATURE-001 do MODULE-002 (`SpeciesRepository` e `SPECIES_NOT_FOUND`).
- **Blocks**: TASK-BACKEND-008 (reusa `StoreAnimalImagesService` e o schema), TASK-FRONTEND-017, TASK-BACKEND-011.
