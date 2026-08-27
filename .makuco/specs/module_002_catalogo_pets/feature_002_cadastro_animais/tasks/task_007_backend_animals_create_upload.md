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

**Out:** Edição, alteração de status e exclusão (TASK-BACKEND-008 e 009). `status` **não** é campo aceito no corpo: o animal nasce Disponível pelo default do schema (RN-14). Nenhum redimensionamento, recorte, compressão ou correção de orientação de imagem. Não alterar o mapper nem o repositório de leitura além dos métodos de escrita acrescentados. Sem testes — toda a suíte, **inclusive** a que trava a concorrência do RNF-13 contra uma regressão para o laço serial, é da TASK-BACKEND-011. Esta task entrega e mede o comportamento; ela não deixa o teste que o guarda.

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
| `modify` | `src/domains/animals/errors/animal-image.errors.ts` | erro de arquivo vazio |
| `create` | `src/domains/animals/animal-name.ts` | normalização do nome |
| `modify` | `src/domains/geography/repositories/state.repository.ts` | resolver cidade por id |
| `modify` | `src/utils/age.ts` | data civil do produto |
| `modify` | `src/domains/animals/repositories/animal.repository.ts` | métodos de escrita |
| `create` | `src/domains/animals/services/store-animal-images.service.ts` | pipeline de imagens |
| `create` | `src/domains/animals/services/create-animal.service.ts` | regra de cadastro |
| `modify` | `src/domains/animals/animals.controller.ts` | handler de criação |
| `modify` | `src/domains/animals/animals.routes.ts` | rota POST com multipart |

---

## Implementation

> **Reference pattern**: `src/domains/auth/services/register-user.service.ts` mostra o padrão de service com dependências injetadas, `$transaction` e efeito externo tratado fora dela. A diferença estrutural aqui é o sentido: lá o efeito externo (e-mail) pode falhar sem derrubar o caso de uso; aqui ele **derruba** e precisa ser desfeito.

### `src/domains/animals/animals.validators.ts` *(modify)*
- `createAnimalBodySchema` sobre os campos do `POST` da spec: `name`, `speciesId`, `size`, `sex`, `cityId`, `birthDate?`, `description?`, `acceptsOtherAnimals?`, `needsLargeSpace?`.
- A recusa de chave extra **não** é `.strict()`: é `.passthrough()` mais um `superRefine` que emite um problema por chave desconhecida, com o `path` preenchido. O `unrecognized_keys` do Zod sai com `path: []`, o `validationErrorFromZodError` faz `path.join('.')` e o cliente receberia `details: [{ field: "", message: "Unrecognized key(s) in object: 'extra'" }]` — campo vazio **e** texto em inglês, reprovando o CT-13 e a RNF-22.
- **Todo campo obrigatório trata `""` como ausente**, e isto é regra e não detalhe: o `<select>` sem escolha e o `<input>` em branco viajam no `FormData` com a chave presente e valor vazio, e não omitida. Um schema que só olhasse `undefined` responderia "Identificador inválido." para `speciesId=""`, o texto inglês do Zod para `size=""`, "mínimo 2 caracteres" para `name="   "`, recusaria `birthDate=""` — campo **opcional** apenas não preenchido — e recusaria `acceptsOtherAnimals=""` em vez de fazê-lo nascer `false` (RN-24). Nenhum desses cinco desfechos corresponde à tabela "Mensagens ao Usuário" da spec, que fixa "Este campo é obrigatório." para campo obrigatório em branco (CT-03, CT-09). Nada é afrouxado: `"sim"`, `"1"` e `"TRUE"` continuam saindo como opção inválida. **Não simplificar para `.uuid()` ou `.min(2)` encadeados** — o defeito só aparece com o formulário vazio, que é o caso que ninguém testa a olho.
- **Todo campo chega como texto**, porque o corpo é multipart. Booleanos vêm como `"true"`/`"false"` e precisam de `z.enum(['true','false']).transform(...)` com default `false` — `z.boolean()` recusaria a string e produziria erro incompreensível para o administrador (RN-24).
- `name`: `.trim()` mais uma transformação que **colapsa sequências de espaços internos em um só** (`replace(/\s+/g, ' ')`), depois `.min(2)` e `.max(60)`. A ordem importa: validar antes de normalizar recusaria `"  Theo  "` de 8 caracteres por engano, e aceitaria um nome que após colapso ficaria com 1 caractere (RN-03, RN-04, CT-07).
- `nameNormalized` é derivado do `name` já normalizado, em minúsculas — usado **só** para ordenar (RN-41). Não é `@unique`: dois animais podem se chamar "Theo" (RN-05).
- `size` e `sex` são `z.enum` sobre os valores **em minúsculas e sem acento** do contrato (`pequeno|medio|grande`, `macho|femea`), convertidos para o literal do enum Prisma na fronteira do service.
- A mensagem desses dois campos exige `errorMap`, e **não** `invalid_type_error`: um valor fora do conjunto emite `invalid_enum_value`, que o `invalid_type_error` não alcança — só `undefined` chega como `invalid_type`. Sem o mapa, `size: "gigante"` responderia o texto inglês do Zod ("Invalid enum value. Expected 'pequeno' | 'medio' | 'grande', received 'gigante'"), reprovando o CT-12. E `""` também chega como `invalid_enum_value`, e não como ausência: por isso o mapa inspeciona o `received` para separar "Este campo é obrigatório." de "Selecione uma opção válida.".
- `birthDate` é **opcional** (RN-18): um animal resgatado frequentemente chega sem essa informação, e exigi-la produziria datas inventadas.
- `cityId` é obrigatório, e com ele a localização inteira: estado e cidade são obrigatórios (RN-25), mas apenas a cidade trafega.
- `birthDate`: `AAAA-MM-DD`; recusar futura e anterior a 30 anos **comparando no fuso America/Sao_Paulo**, com o `now` vindo de `~/utils/clock.ts`. Com o servidor em UTC, às 22h em São Paulo já é o dia seguinte em UTC, e uma comparação ingênua recusaria a data de hoje como futura. A data de hoje é sempre aceita (RN-19, CT-16).
- `description`: opcional, `.trim()`, `.max(1000)` contado **após** a normalização (RN-23).
- `status` **não** existe no schema. Enviá-lo cai na recusa de chave não prevista e produz "Campo não permitido nesta requisição." (RN-14, CT-14).
- Qualquer chave não prevista produz `400` com `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` (RN-46, CT-13).

### `src/domains/animals/repositories/animal.repository.ts` *(modify)*
- Acrescentar `create(data, tx)` e `createImages(animalId, images, tx)`, ambos aceitando o cliente transacional para participarem da mesma transação.
- **Não** criar `withTransaction<T>(fn)`: a TASK-BACKEND-006 já entregou `withTransaction(executor: Prisma.TransactionClient): AnimalRepository` na interface `AnimalRepository`, e uma segunda assinatura com o mesmo nome conflitaria com ela. Quem **abre** a transação é o service, com um `PrismaClient` injetado só para isso — precedente do projeto em `register-user.service.ts`, `delete-species.service.ts` e `confirm-email.service.ts`. O repositório recebe o `tx` e se religa a ele.

### `src/domains/animals/services/store-animal-images.service.ts` *(create)*
- Recebe `ImageStoragePort` e produz, a partir dos arquivos em memória, a lista `{ imageId, objectPath, publicUrl, contentType, sizeBytes }`.
- Ordem de verificação **por arquivo**, e a ordem importa porque cada passo produz mensagem diferente: tamanho 0 ⇒ "O arquivo enviado está vazio." (`400`); assinatura binária não é JPEG nem PNG ⇒ `415 ANIMAL_IMAGE_TYPE_NOT_ALLOWED`; acima de 5 MB ⇒ `413 ANIMAL_IMAGE_TOO_LARGE`.
- **Validar todos os arquivos antes de enviar qualquer um.** Enviar durante a validação faria um envio com a quinta imagem inválida deixar quatro objetos órfãos no balde.
- **Os envios ao armazenamento são CONCORRENTES, não em série (RNF-13).** Depois de todos os arquivos validados, disparar os até cinco envios de uma vez (`Promise.all` / `Promise.allSettled` sobre a lista já validada). O laço com `await` dentro — a implementação óbvia — **viola o RNF-13**, e a aritmética é esta:
  - **Orçamento**: o RNF-13 dá **30 s ao envio inteiro**, do primeiro byte à resposta, e **não** por objeto.
  - **Tempo limite por chamada**: o adaptador da TASK-BACKEND-004 aplica `AbortSignal.timeout` de **20 s a CADA chamada** ao armazenamento (`TEMPO_LIMITE_MS`, em `src/infra/storage/supabase-image-storage.ts`). Esse teto é premissa desta task, não uma escolha a rediscutir aqui: ele existe para que uma requisição pendurada não segure a transação do banco e a conexão do pooler.
  - **Em série**: 5 × 20 s = **100 s** no pior caso — **3,3× acima** dos 30 s do RNF-13.
  - **Em paralelo**: o pior caso é o do objeto mais lento, ~20 s, deixando ~10 s de folga no orçamento para validação, transação e resposta. **É a concorrência que faz o teto de 20 s caber no RNF-13**, e a decisão é do service, porque a porta trata de uma chamada por vez.
- **Concorrência e compensação se combinam nesta ordem:** aguardar o **desfecho de todos** os envios disparados (`Promise.allSettled`, ou um `Promise.all` cujo `catch` só compensa depois de todas as promessas assentarem) e **só então** remover. Compensar assim que a primeira rejeição chega deixaria os envios ainda em voo terminarem **depois** da remoção, e cada um deles viraria um objeto órfão — exatamente o que o CT-55 existe para barrar.
- **Compensação obrigatória:** se o envio da enésima imagem falhar, remover os objetos das anteriores **daquele envio** antes de propagar o erro. É isso que faz o CT-55 passar — falha na terceira de cinco não deixa arquivo remanescente (RN-39, RNF-06, CA-24).
- Falha do armazenamento propaga `ImageStorageUnavailableError` (`503`), nunca um erro do fornecedor.
- O caminho de cada objeto vem de `buildAnimalImageObjectPath` — o nome do arquivo enviado não é parâmetro em ponto algum (RN-52).

### `src/domains/animals/services/create-animal.service.ts` *(create)*
- Dependências injetadas: `AnimalRepository`, `SpeciesRepository` (da FEATURE-001), `StateRepository` (para a cidade), `StoreAnimalImagesService` e `PrismaClient` — este último **apenas** para abrir a `$transaction`, seguindo o precedente de `register-user.service.ts` e `delete-species.service.ts`.
- **Não** injetar um `Clock`: esse tipo não existe no projeto. `~/utils/clock.ts` exporta a **função** `now()`, importada diretamente, e o padrão de teste é `jest.spyOn(clock, 'now')` — o mesmo já registrado em `age.ts`.
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
- `POST /` → `authenticate` → `authorizeRole('admin')` → `uploadAnimalImages` → `validateRequest({ body: createAnimalBodySchema })` → `controller.create`.
- Os dois nomes são literais e não aproximações: `AuthRole` vem de `AUTH_ROLES = ['admin','cliente']`, então `authorizeRole('ADMIN')` **não compila** (`TS2345`); e o export do middleware é `uploadAnimalImages` — não existe `uploadAnimalImagesMiddleware` no projeto.
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
- [ ] **Given** cinco imagens válidas e um armazenamento que leva o teto de 20 s por chamada, **When** `POST /api/animals` é processado, **Then** os cinco envios ocorrem **concorrentemente** e o tempo total do envio fica dentro dos 30 s do RNF-13 — e não nos 100 s que um laço em série produziria (RNF-13).
  - O **comportamento** é entregue e verificado nesta task, por medição com duplo: `maximoEmVoo = 5`, os cinco `inicio:` antes do primeiro `fim:`, e o tempo total do concorrente contra o do laço serial equivalente sob a mesma carga.
  - O **artefato de teste permanente** — o duplo que registra a sobreposição das chamadas e que precisa **falhar** se a implementação voltar a ser serial — pertence à **TASK-BACKEND-011**, junto com o resto da suíte. Esta linha existia como critério desta task e contradizia o próprio *Scope — Out* ("Sem testes"); a contradição se resolve aqui, e a TASK-BACKEND-011 herda a exigência de que o teste seja capaz de reprovar a versão serial.
- [ ] **Given** o armazenamento indisponível, **Then** `503 IMAGE_STORAGE_UNAVAILABLE` com "Não foi possível salvar as imagens. Tente novamente." e o banco permanece consistente (CT-56, RNF-14).
- [ ] **Given** nomes de arquivo com `../`, emoji e 300 caracteres, **When** gravados, **Then** os caminhos são `animals/<id>/<uuid>.<ext>` e nenhum contém trecho do nome enviado (CT-57, CA-27).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — e nesse caso o corpo de 25 MB **não** chega a ser lido (CA-40).
- [ ] **Given** as mesmas violações enviadas por chamada direta à API, fora da interface, **When** processadas, **Then** as respostas são idênticas às do fluxo pela tela (CT-91, CA-22).

---

## Dependencies

- **Requires**: TASK-BACKEND-003 (multipart, limites, assinatura binária), TASK-BACKEND-004 (`ImageStoragePort`, caminho do objeto), TASK-BACKEND-006 (repositório, mapper, controller, rotas, mensagens), FEATURE-001 do MODULE-002 (`SpeciesRepository` e `SPECIES_NOT_FOUND`).
- **Blocks**: TASK-BACKEND-008 (reusa `StoreAnimalImagesService` e o schema), TASK-FRONTEND-017, TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 12 (3 criados, 9 alterados) + 10 arquivos de contexto lidos por inteiro (middleware de multipart, adaptador do armazenamento, porta, assinatura binária, limites, mapper, `validateRequest`, `authorizeRole`, `error-handler`, `app.ts`)

#### Resumo

O cadastro está implementado por inteiro e a decisão que governa a task — concorrência com compensação — foi **reproduzida e medida**, não apenas lida: os cinco envios partem no mesmo tique (`maximoEmVoo === 5`), 62 ms contra 302 ms do laço serial equivalente, e na falha do meio a remoção só começa depois que os cinco envios assentaram, sem deixar objeto órfão. Não há achado `critical` nem `major`. Os cinco achados `minor` são de precisão de comentário, de completude de `details` e de ordenação determinística da resposta — nenhum bloqueia. Nove alegações do agente foram verificadas uma a uma: **oito procedem** e exigem emenda no texto desta task; **uma não procede como formulada** (item 3), embora a implementação escolhida continue correta por outro motivo.

#### Como a concorrência foi verificada

Sonda instrumentada sobre `StoreAnimalImagesService`, com duplo da `ImageStoragePort` registrando `inicio`/`fim`/`remove` por objeto e contando envios em voo. Apagada ao fim da revisão. Nenhum registro foi criado no banco — as contagens conferidas ao final batem exatamente com a linha de base (`users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571, `animals` 0, `animal_images` 0).

| Verificação | Resultado medido |
|---|---|
| Envios simultâneos em voo (5 arquivos, 60 ms cada) | `maximoEmVoo = 5` |
| `inicio:` registrados antes do primeiro `fim:` | 5 de 5 |
| Tempo total concorrente | **62 ms** |
| Tempo do laço serial equivalente, mesma carga | **302 ms** (4,9×) |
| **Caso que quebra** — falha da 3ª de 5, durações 120/200/**20**/260/320 ms (a que falha é a **mais rápida**) | os 5 `fim:` ocorrem em @21…@321; o primeiro `remove` em **@322**, depois de todos. 4 objetos removidos, **0 sobrando** |
| Primeira rejeição **posicional** vs. temporal — pos. 5 falha em 10 ms, pos. 2 falha em 200 ms | propaga a **da posição 2**. A ordem da resposta não depende do escalonamento |
| Falha da própria remoção (RN-40) | erro original (`ImageStorageUnavailableError`, 503) repropaga; a falha da faxina vira `console.error`, não derruba a resposta |
| Zero imagem | `[]` sem tocar a rede |

O caso do meio é o que prova a escolha de `allSettled`: com `Promise.all`, a compensação teria disparado em @21 ms — quando **quatro envios ainda estavam em voo** — e os quatro terminariam depois da remoção, virando exatamente os órfãos que o CT-55 existe para barrar.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | tabela *Files* desta task | — | contrato | **Quatro** arquivos tocados fora da tabela, e não um: `src/domains/animals/animal-name.ts` (create), `src/domains/animals/errors/animal-image.errors.ts` (modify), `src/domains/geography/repositories/state.repository.ts` (modify) e `src/utils/age.ts` (modify). Todos são aditivos — nenhuma linha de comportamento existente foi removida — e todos são justificados. O defeito está no texto da task, não no código | Acrescentar as quatro linhas à tabela *Files* |
| 2 | minor | `src/domains/animals/animals.validators.ts` | L274-281 | comentário | A justificativa de `medirNomeDoAnimal` afirma que "a cadeia `.min(2).max(60)` ACUMULA: `""` falharia no minimo e ... produziria dois itens de `details`". **Falso, reproduzido com Zod 3.25.76**: `z.string().min(2).max(60).safeParse('')` produz **exatamente um** problema, e mínimo e máximo nunca disparam juntos sobre o mesmo comprimento. O `superRefine` continua sendo a escolha certa, mas por outro motivo — o que já está escrito duas linhas abaixo (precedência de três mensagens, com `""` respondendo "Este campo é obrigatório." em vez de "mínimo 2 caracteres", mais a segunda medição sobre `toLowerCase().length`) | Remover a frase sobre acúmulo e manter a justificativa correta. A acumulação real existe em `medirPagina` (`.int().min(1)` sobre `-1.5` produz dois problemas — reproduzido), e é de lá que o raciocínio foi transportado por engano |
| 3 | minor | `src/domains/animals/animals.validators.ts` | L527-546 | validação | Quando **algum campo declarado também falha**, os problemas de chave extra somem de `details`. Reproduzido: `{ name, speciesId, sex, cityId, extra: '1' }` (sem `size`) responde apenas `size=Este campo é obrigatório.`, sem citar `extra`. Causa: `ZodObject` devolve `INVALID` assim que um campo aborta, e o `superRefine` de objeto de `objetoSemCamposExtras` nunca roda. O CT-13 e o CT-14 passam (enviam corpo válido salvo a chave extra) e a RN-46 continua honrada — a requisição é recusada e nada é criado —, mas `details` fica incompleto | Registrar a limitação no comentário, ou mover a varredura de chaves desconhecidas para um `z.preprocess` que rode antes do parse dos campos |
| 4 | minor | `src/domains/animals/services/store-animal-images.service.ts` | L59, L235 | dado morto | `StoredAnimalImage.publicUrl` é produzido a cada envio e **nunca consumido**: `comoLinhasDeImagem` persiste só `storagePath`, e `toAnimalResponse` deriva a URL por `buildPublicObjectUrl`. Verificado por varredura — não há leitor de `.publicUrl` fora deste arquivo | Remover o campo, ou registrar no comentário qual consumidor da TASK-BACKEND-008 o exige |
| 5 | minor | `src/domains/animals/services/create-animal.service.ts` | L253 | correção | A ordem de `images` na resposta do `POST` depende de `createManyAndReturn` devolver as linhas na ordem de entrada (`INSERT ... RETURNING`), e **não** de um `orderBy: { position: 'asc' }`. O comentário do mapper (`animal.mapper.ts` L174-177) afirma "A ORDEM VEM DO BANCO (`orderBy` do `include`)", verdade no caminho de leitura e falso neste, onde `persistir` monta `{ ...animal, images: [...imagens] }`. O Postgres devolve na ordem de inserção na prática, mas o padrão SQL não garante, e a spec fixa "`images` vem sempre ordenado por `position`" | Ordenar por `position` em `persistir` (no máximo cinco itens) ou montar o array a partir da lista já ordenada de `comoLinhasDeImagem` |
| 6 | suggestion | `src/domains/animals/animals.validators.ts` | L327-333 | mensagem | `name` chegando como array (chave repetida no multipart) responde "Este campo é obrigatório." — o campo foi enviado, só que duas vezes. Alcançável apenas fora da interface (RN-33) | Aceitável como está; o próprio arquivo já aplica esse raciocínio a `description`. Se mudar, mudar nos dois |
| 7 | suggestion | `src/domains/animals/services/create-animal.service.ts` | L106-112 | prática | Cinco dependências de construtor (Object Calisthenics, regra 8: no máximo duas). É o padrão vigente do projeto (`register-user.service.ts`, `delete-species.service.ts`) e cada uma é uma colaboração distinta e necessária | Sem ação. Registrado como desvio consciente |
| 8 | suggestion | `src/domains/animals/animals.routes.ts` | L124-127 | segurança | Ausência de limitador de taxa no único endpoint de escrita que aceita 25 MB. Coberto pela Decisão 14 do changelog e contido pelos limites de quantidade, de tamanho por arquivo e de corpo total, aplicados antes de qualquer regra de negócio; com um único administrador provisionado, o risco é desprezível | Sem ação nesta task. Reavaliar quando houver mais de um administrador |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 20 de 20 critérios de aceite implementados. Reproduzidos individualmente: `201` com `status: "disponivel"` e `images: []`; `"  Theo   Junior "` → `"Theo Junior"`; nomes de 1/2/60/61 com as três mensagens exatas do contrato; quatro obrigatórios ausentes produzindo **um** item de `details` por campo, todos de uma vez; `SPECIES_NOT_FOUND` e `CITY_NOT_FOUND` **antes** de qualquer envio; `size: "gigante"` e `sex: "outro"` → "Selecione uma opção válida."; `status` e `stateId` → "Campo não permitido nesta requisição." com o `field` correto; data de amanhã, 31 anos e hoje-às-22h-de-São-Paulo (relógio fixado em `2026-08-27T01:00:00Z`, processo em UTC no dia 27, data civil de SP no dia 26 — **aceita**, e `2026-08-27` recusada como futura); descrição 1000/1001; alternâncias ausentes nascendo `false`; `position` 0..n na ordem de envio; seis imagens recusadas **antes** de qualquer consulta e de qualquer envio; SVG, GIF e executável renomeados recusados por assinatura (415); 0 byte → "O arquivo enviado está vazio." (400); falha da terceira de cinco sem objeto remanescente; armazenamento indisponível → 503 `IMAGE_STORAGE_UNAVAILABLE`. Achados: nenhum de requisito.

Ressalva de contrato, não de código: o critério de aceite do RNF-13 exige "um teste com um duplo que registre a sobreposição das chamadas ... precisa **falhar** se a implementação voltar a ser serial", enquanto o *Scope — Out* da mesma task diz "Sem testes (TASK-BACKEND-011)". As duas frases se contradizem. O comportamento existe e foi medido nesta revisão; o artefato de teste pertence à TASK-BACKEND-011. Ver emenda **E-10**.

**Pass 2 — Diff Analysis**: 801 inserções e 19 remoções nos nove arquivos alterados; as 19 remoções são **exclusivamente** de comentário de cabeçalho ("Escopo desta fatia: SO LEITURA", "Os schemas de escrita entram nas TASK-BACKEND-007 a 009") reescrito para refletir a nova fatia. Nenhuma linha de comportamento existente removida. `animals.messages.ts`: as **13** chaves anteriores estão intactas (`VALIDATION_GUARD`, `FIELD_NOT_ALLOWED`, `ANIMAL_NOT_FOUND`, `INVALID_IDENTIFIER`, `INVALID_PAGE`, `INVALID_PAGE_SIZE`, `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `ANIMAL_IMAGE_TOO_LARGE`, `IMAGE_FILE_EMPTY`, `REQUEST_BODY_TOO_LARGE`, `IMAGE_STORAGE_UNAVAILABLE`, `UNSUPPORTED_MEDIA_TYPE`), com texto idêntico; **9** novas acrescentadas ao fim; total **22**. O arquivo **não** foi recriado — o diff é apêndice mais três linhas de comentário do cabeçalho. `animal.repository.ts` não teve o caminho de leitura tocado (`listPaginated` e `findById` intactos), como o *Scope — Out* exige, e o mapper não foi alterado. `app.ts` intocado: `express.json({ limit: '10kb' })` continua global e o multipart é montado **apenas** na rota `POST /api/animals` — nenhuma outra rota importa `uploadAnimalImages`. Achados: #1 (arquivos fora da tabela *Files*).

**Pass 3 — Code Practices**: nenhum `any` nos doze arquivos; a única conversão é `valores as unknown as [Valor, ...Valor[]]` em `conjuntoFechado`, exigida pelo genérico de tupla do `z.enum` e sem alargamento de tipo. Controller sem Prisma na classe — a fábrica `createAnimalsController`, no nível do módulo, faz a composição, exatamente como `createSpeciesController`; o handler `create` chama **um** service e nada mais. Repositório sem erro HTTP: ausência é `null`, e quem decide é o service. Linguagem ubíqua alinhada (`CreateAnimalService.execute`, `SpeciesNotFoundError`, `CityNotFoundError`, `AnimalImageLimitExceededError`), com o vocabulário público (`pequeno`/`medio`/`grande`) traduzido para o enum do banco por `Record` exaustivo, e não por `switch` com ramo default. Comentários em prosa sem acento; os acentos que aparecem são citações verbatim de literais do contrato ("Este campo é obrigatório.", "Boa Esperança", "Ágil") e de rótulos da interface — a mesma convenção já vigente em `state.repository.ts` desde a TASK-BACKEND-005. Achados: #2, #4, #7.

**Pass 4 — Testing Review**: esta task não entrega testes por decisão do próprio *Scope — Out*; a suíte pertence à TASK-BACKEND-011. A suíte existente permanece verde e **inalterada** — 24 suítes, 314 testes, 0 falhas —, e `npm run typecheck` (três projetos: aplicação, seeds e testes) sai com código 0. Nenhum arquivo de teste foi criado, alterado ou removido pela entrega. As sondas desta revisão foram apagadas e a suíte reexecutada depois da remoção, com o mesmo resultado. Achados: nenhum; ressalva de contrato registrada no Pass 1 e na emenda **E-10**.

**Pass 5 — Security Review**: OWASP Top 10 aplicado aos doze arquivos e aos que eles consomem. **A01** — `authenticate` → `authorizeRole('admin')` precede tudo nas três rotas; não há IDOR possível num `create`. **A02** — nenhum segredo no código; a credencial do armazenamento sai de `env` e nunca atravessa a resposta. **A03** — todo acesso é Prisma parametrizado; o caminho do objeto é `animals/<uuid>/<uuid>.<ext>`, composto só de identificadores gerados pela aplicação e de uma extensão de lista fechada; o nome do arquivo enviado **não existe no tipo** `AnimalImageUpload` — a RN-52 está materializada na assinatura, não numa sanitização que alguém pode esquecer; os dois `console.error` interpolam apenas caminhos gerados pela aplicação e o objeto de erro, sem entrada crua do usuário (sem injeção de log). **A04** — fluxos negativos explícitos: falha de envio compensa, falha de transação compensa, falha de compensação vira log. **A05** — o `error-handler` é o único ponto que monta corpo de erro; 500 sai genérico, sem stack. **A08** — formato apurado por assinatura binária com pré-filtro próprio antes do `file-type`; SVG, GIF e `MZ` renomeados para `.jpg` com `mimetype: image/jpeg` recusados com 415 (reproduzido); um executável de 6 MB sai como **415 e não 413**, ordem correta. Verificado também que `Object.hasOwn` (e não `in`) fecha o caminho de `constructor`/`toString` como nome de campo — os dois são recusados com "Campo não permitido nesta requisição." (reproduzido) — e que `__proto__` nunca vira chave própria do corpo reconstruído pelo Zod, portanto não há poluição de protótipo. **A09** — a pendência de limpeza é registrada com os caminhos afetados, sem PII e sem segredo. **A10** — nenhuma URL construída a partir de entrada do usuário. **A06** — esta task não introduz dependência nova. Achados: nenhum `critical`, nenhum `major`; #8 como endurecimento sem caminho de exploração.

**Pass 6 — Bug Detection**: os doze arquivos foram lidos por inteiro, não só o diff. Ausência de `null` tratada em toda parte (`findById`/`findCityById` → erro de domínio; `req.files` com `Array.isArray`, e não `?? []`, porque o tipo do multer é união). Corrida entre envio e compensação **eliminada por construção** e verificada por medição, incluindo o caso adversarial em que a falha é o envio mais rápido. Vazamento de recurso: a lista vazia não vira requisição nem em `compensar` nem em `remove`; `createImages` sai antes de emitir `INSERT ... VALUES` sem tuplas, que o Postgres recusaria. `off-by-one`: o `+ 1` do corte do parser (`fileSize` do busboy é exclusivo) faz 5 MB exatos passarem e 5 MB + 1 byte reprovar — reproduzido nos dois lados; o `MAX_IMAGES_PER_ANIMAL + 1` deixa a sexta imagem chegar para que a recusa saia com `code` de negócio. Coerção: nenhuma comparação `==`; datas comparadas como **texto ISO**, sem passar por `Date` e portanto sem passar por fuso. Erro engolido: o único `catch` que não repropaga é o da compensação, e é a RN-40 escrita. Estado inconsistente: a compensação cobre os dois pontos — falha no envio e falha na transação depois do envio (reproduzido: dois objetos enviados, dois removidos, conjuntos idênticos, e o erro original repropagado). Achados: #3, #5, #6.

**Pass 7 — Project Patterns**: estrutura por domínio respeitada (`domains/animals/{services,repositories,errors,mappers}`), arquivos em kebab-case, alias `~/`, mensagens PT-BR num catálogo único por domínio sem import cruzado, erros nomeando a regra violada e não o status, fluxo Router → Controller → Service → Repository → Prisma sem inversão. A leitura do relógio continua concentrada em `~/utils/clock.ts`, e a nova `productCivilDateOf` coloca a regra de fuso do RN-19 no mesmo módulo que já a aplica ao RN-22, em vez de abrir uma segunda leitura dentro do validador. Achados: nenhum.

---

### Emendas obrigatórias no texto desta task

As nove alegações do agente foram verificadas uma a uma. **Oito procedem** e exigem emenda; **uma não procede como formulada**.

| # | Alegação | Veredicto | Evidência | Onde emendar |
|---|---|---|---|---|
| E-1 | `authorizeRole('ADMIN')` não compila | **PROCEDE** | Sonda de compilação: `TS2345: Argument of type '"ADMIN"' is not assignable to parameter of type '"admin" \| "cliente"'`. `AuthRole` sai de `AUTH_ROLES = ['admin','cliente']` (`user.mapper.ts` L13-15) | *Implementation* → `animals.controller.ts` e `animals.routes.ts`, na cadeia de middlewares: trocar `authorizeRole('ADMIN')` por `authorizeRole('admin')` |
| E-2 | `.strict()` produziria `field: ""` | **PROCEDE** | Reproduzido: `z.object({...}).strict()` emite `unrecognized_keys` com `path: []`; `validationErrorFromZodError` faz `path.join('.')` e o cliente recebe `details: [{ field: "", message: "Unrecognized key(s) in object: 'extra'" }]` — campo vazio **e texto em inglês**, reprovando o CT-13 e a RNF-22 | *Implementation* → `animals.validators.ts`, primeiro marcador: substituir "`createAnimalBodySchema` `.strict()`" por "objeto com `.passthrough()` + `superRefine` que emite um problema por chave desconhecida, com `path` preenchido". Ajustar também o marcador de `status` ("Enviá-lo cai no `.strict()`") |
| E-3 | `.min(2).max(60)` encadeados acumulam, reprovando o CT-09 | **NÃO PROCEDE como formulada** | Reproduzido com Zod 3.25.76: `z.string().min(2).max(60).safeParse('')` produz **um** problema, não dois; mínimo e máximo são mutuamente exclusivos sobre um mesmo comprimento. A acumulação real acontece com `.int().min(1)` sobre número (`-1.5` → dois problemas), que é o caso de `medirPagina`, não o do nome | **Nenhuma emenda na task.** O texto atual ("`.min(2)` e `.max(60)`") não está errado como requisito. O que precisa mudar é o **comentário do código** (achado #2): o `superRefine` continua justificado pela precedência de três mensagens e pela segunda medição sobre `toLowerCase().length`, e não por acúmulo |
| E-4 | `invalid_type_error` não alcança valor fora de enum | **PROCEDE** | Reproduzido: `z.enum([...], { invalid_type_error })` sobre `"gigante"` emite `invalid_enum_value` com o default inglês `"Invalid enum value. Expected 'pequeno' \| 'medio' \| 'grande', received 'gigante'"`; `""` produz o mesmo código. Só `undefined` alcança `invalid_type`. O `errorMap` era necessário | *Implementation* → `animals.validators.ts`, marcador de `size`/`sex`: registrar `errorMap` e explicitar que `""` chega como `invalid_enum_value` (e não `invalid_type`), razão de o mapa inspecionar `received` para separar "Este campo é obrigatório." de "Selecione uma opção válida." |
| E-5 | `withTransaction<T>(fn)` conflita com o já entregue na 006 | **PROCEDE** | `HEAD:animal.repository.ts` L133 e L217 já declaram `withTransaction(executor: Prisma.TransactionClient): AnimalRepository`, e a assinatura faz parte da interface `AnimalRepository`. Precedente de injeção de `PrismaClient` só para abrir transação confirmado em `register-user.service.ts` L70/L113, `delete-species.service.ts` L78/L108 e `confirm-email.service.ts` L34/L58 | *Implementation* → `animal.repository.ts`: remover o marcador "Expor `withTransaction<T>(fn)` — é o repositório, e não o service, quem conhece o Prisma", porque ele contradiz o que a 006 já entregou **e** o precedente do projeto. Acrescentar `PrismaClient` à lista de dependências injetadas de `create-animal.service.ts`, com a nota de que ele entra **apenas** para abrir a transação |
| E-6 | `StateRepository` não tinha como resolver cidade por `id` | **PROCEDE** | `HEAD:state.repository.ts` expunha só `listAll`, `findByUf`, `listCitiesByStateId` e `withTransaction`. `listCitiesByStateId` exigiria o estado, que o contrato do animal deliberadamente não recebe (RN-26a) | Tabela *Files* → acrescentar `modify` / `src/domains/geography/repositories/state.repository.ts` / "resolver cidade por id" |
| E-7 | O export é `uploadAnimalImages` | **PROCEDE** | `upload-animal-images.middleware.ts` L238: `export const uploadAnimalImages: RequestHandler`. Não existe `uploadAnimalImagesMiddleware` no projeto | *Implementation* → `animals.routes.ts`: trocar `uploadAnimalImagesMiddleware` por `uploadAnimalImages` na cadeia |
| E-8 | `Clock` injetado não existe no projeto | **PROCEDE** | Varredura por `interface Clock`/`type Clock`/`class Clock` em `src/`: nenhuma ocorrência. `~/utils/clock.ts` exporta a **função** `now()`, e o padrão de teste documentado é `jest.spyOn(clock, 'now')` (registrado em `age.ts` L5) | *Implementation* → `create-animal.service.ts`: remover `Clock` da lista de dependências injetadas e registrar que o instante vem de `import { now } from '~/utils/clock'` |
| E-9 | Não havia classe para arquivo de 0 byte | **PROCEDE** | `HEAD:animal-image.errors.ts` tinha seis classes, nenhuma para tamanho zero, embora `MESSAGES.IMAGE_FILE_EMPTY` já existisse desde a TASK-BACKEND-003 | Tabela *Files* → acrescentar `modify` / `src/domains/animals/errors/animal-image.errors.ts` / "erro de arquivo vazio" |
| E-10 | *(não alegado pelo agente — achado da revisão)* | — | O critério de aceite do RNF-13 exige um teste com duplo que falhe se a implementação voltar a ser serial; o *Scope — Out* diz "Sem testes (TASK-BACKEND-011)". As duas frases se contradizem | *Acceptance Criteria* → marcar o critério do RNF-13 como verificado pela TASK-BACKEND-011, **ou** abrir exceção explícita no *Scope — Out* para esse único teste |
| E-11 | *(não alegado pelo agente — achado da revisão)* | — | `src/domains/animals/animal-name.ts` foi **criado** e `src/utils/age.ts` foi **alterado** (`productCivilDateOf`, 29 linhas, zero remoções), ambos fora da tabela *Files*. Os dois são justificados: o primeiro isola a normalização do nome do animal da de espécie (finalidades opostas — ordenação × unicidade); o segundo mantém a regra de fuso do produto em um único módulo, compartilhada entre RN-19 e RN-22 | Tabela *Files* → acrescentar `create` / `src/domains/animals/animal-name.ts` / "normalizacao do nome" e `modify` / `src/utils/age.ts` / "data civil do produto" |

---

### Verificações especiais solicitadas

| Ponto | Resultado |
|---|---|
| `nameNormalized` **preserva acento** | ✅ `"  Caçula   Ágil "` → `name = "Caçula Ágil"`, `nameNormalized = "caçula ágil"`. Nenhuma ocorrência de `normalize(`, `NFD`, `NFC` ou `deburr` em `animal-name.ts`; `toLowerCase()` e **não** `toLocaleLowerCase()`, correto porque o valor é persistido e não pode variar com o locale do contêiner |
| `nameNormalized` nunca vem do cliente | ✅ Derivado em `create-animal.service.ts` L236; não existe no `createAnimalBodySchema`, e enviá-lo cai na recusa de chave não prevista |
| `nameNormalized` não é único | ✅ `prisma/schema.prisma` L190 sem `@unique` (contraste deliberado com `Species.nameNormalized`, L118, que tem) |
| Espécie e cidade resolvidas por `id` | ✅ `species.findById(speciesId)` e `geography.findCityById(cityId)`. Nenhuma resolução por nome — e a cidade **precisa** ser por `id`, porque "Boa Esperança" existe em ES, MG e PR entre os 5.571 municípios carregados |
| ...e **antes** de tocar o armazenamento | ✅ Reproduzido: espécie inexistente → `SpeciesNotFoundError` com `enviados = 0`; cidade inexistente → `CityNotFoundError` com `enviados = 0`. Ordem registrada de chamadas no caminho feliz: `species.findById` → `geography.findCityById` → `prisma.$transaction` → `repo.create` → `repo.createImages` |
| Seis imagens recusadas antes de tudo | ✅ Reproduzido: `AnimalImageLimitExceededError` com **zero** consultas e zero envios |
| Transação falha com imagens já no balde | ✅ Reproduzido: 2 enviados, 2 removidos, conjuntos idênticos, e o erro original (`P2003`) repropagado sem ser mascarado |
| Falha da própria remoção vira log (RN-40) | ✅ Reproduzido: `console.error` chamado, `ImageStorageUnavailableError` original repropagado, resposta não derrubada pela faxina |
| Middleware de multipart não vazou | ✅ Importado em **um** único ponto (`animals.routes.ts` L11), montado **só** no `POST /`. `app.ts` intocado, `express.json({ limit: '10kb' })` segue global |
| SVG renomeado para `.jpg` | ✅ 415 "Apenas imagens JPEG ou PNG são aceitas." — recusado pelos bytes. GIF e `MZ...` idem. Executável de 6 MB sai **415**, não 413 |
| Arquivo de 0 byte | ✅ 400 "O arquivo enviado está vazio.", verificado **antes** da assinatura (senão sairia como problema de formato) |
| Todos validados antes de qualquer envio | ✅ Reproduzido: quinta imagem inválida entre quatro válidas → `enviados = 0` |
| Controller sem Prisma, um único service | ✅ A classe `AnimalsController` não referencia Prisma; a fábrica de composição no nível do módulo o faz, igual a `createSpeciesController`. `create` chama exatamente um service |
| Repositório não lança erro HTTP | ✅ `findById`/`findCityById` devolvem `null`; nenhuma subclasse de `AppError` importada nos repositórios |
| 22 chaves de mensagem, 13 intactas | ✅ Conferido chave a chave contra `HEAD`. Arquivo estendido por apêndice; **não** recriado |
| Proibido `any` | ✅ Zero ocorrências nos doze arquivos |
| Comentários sem acento / strings com acento | ✅ A prosa dos comentários é sem acento; os acentos presentes são citações verbatim de literais do contrato e de nomes próprios, seguindo a convenção já vigente desde a TASK-BACKEND-005 |
| Gates | ✅ `npm run typecheck` (3 projetos) exit 0; `npx jest` 24 suítes / 314 testes / 0 falhas, antes e depois da remoção das sondas |
| Banco restaurado | ✅ Nada foi criado — as sondas usam duplos. Contagens finais idênticas à linha de base, incluindo `species = 0` e `animals = 0` |

---

### Ponto que a task não previu — `<select>` sem escolha viaja como `""`

**Julgamento: a decisão do agente está correta e é obrigatória.** O `FormData` de um `<select>` sem escolha e de um `<input>` em branco envia a chave com valor `""`, e não omite a chave. Um schema que só olhasse `undefined` responderia:

- `speciesId=""` → "Identificador inválido." em vez de "Este campo é obrigatório.";
- `size=""` → `invalid_enum_value` com o texto inglês do Zod;
- `name="   "` → "O nome do animal deve ter no mínimo 2 caracteres." em vez de obrigatoriedade;
- `birthDate=""` → "Informe a data de nascimento no formato AAAA-MM-DD." para um campo **opcional** simplesmente não preenchido;
- `acceptsOtherAnimals=""` → recusa, quando a RN-24 manda nascer `false`.

Nenhum desses cinco desfechos corresponde à tabela "Mensagens ao Usuário" da spec, que fixa "Este campo é obrigatório." para "campo obrigatório em branco" (CT-03, CT-09). Reproduzido o tratamento entregue: corpo com os cinco obrigatórios em branco devolve **cinco** itens de `details`, um por campo, todos com "Este campo é obrigatório."; `birthDate=""` sai `null`; as duas alternâncias em branco saem `false`; `description=""` sai `null` e não string vazia gravada. Nada é afrouxado — `"sim"`, `"1"` e `"TRUE"` continuam sendo recusados como opção inválida, e `"   "` num identificador é aparado antes da medição.

**Emenda recomendada** (*Implementation* → `animals.validators.ts`): acrescentar um marcador registrando que **todo campo obrigatório trata `""` como ausente**, porque o `<select>` sem escolha viaja como string vazia; sem essa regra escrita, a próxima revisão que "simplificar" para `.uuid()` ou `.min(2)` encadeados reintroduz o defeito, e ele só aparece com o formulário vazio — o caso que ninguém testa a olho.

---

#### Veredicto

> **APROVADA** — 0 achados `critical`, 0 `major`. A concorrência do RNF-13 e a compensação do RN-39/CT-55 foram reproduzidas e medidas, inclusive no caso adversarial em que o envio que falha é o mais rápido dos cinco: nenhum objeto órfão, e a rejeição que propaga é a **posicional**, não a temporal. Os cinco achados `minor` (`animals.validators.ts` L274-281 e L527-546; `store-animal-images.service.ts` L59/L235; `create-animal.service.ts` L253; tabela *Files*) não bloqueiam o fechamento e ficam registrados para a TASK-BACKEND-008, que reusa este mesmo pipeline.
>
> **Condição de fechamento:** aplicar as emendas **E-1, E-2, E-4, E-5, E-6, E-7, E-8, E-9, E-10 e E-11** no texto desta task. São dez correções de contrato, não de código — sem elas, a próxima revisão volta a reprovar uma implementação correta por divergir de um texto que descreve um projeto que não existe. A alegação **E-3** foi verificada e **não procede**: a emenda cabível ali é no comentário do código (achado #2), e não no texto da task.
