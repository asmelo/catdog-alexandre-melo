# TASK-BACKEND-006 — Leitura de animais: listagem paginada, consulta por identificador e idade derivada

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-006-backend-animals-read-paginacao-idade`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 6 of 18 — Domínio Animais: Leitura
**Generated**: `2026-08-25`

---

## Context

Entrega `GET /api/animals` (paginado no servidor desde a primeira entrega, RN-42) e `GET /api/animals/:id`, mais o mapper que produz a representação do animal do contrato — incluindo `ageInYears`, **calculado a cada resposta e jamais persistido** (RN-20). O mapper criado aqui é o único ponto que serializa animal em toda a feature, e é ele que torna a projeção explícita da RN-59 uma restrição estrutural em vez de uma recomendação.

---

## Scope

**In:** Repositório de animais (leitura), mapper da representação do animal, utilitário de idade no fuso America/Sao_Paulo, services de listagem e de consulta, controller, rotas, validadores de paginação e de `id`, catálogo de mensagens do domínio, erro `ANIMAL_NOT_FOUND` e montagem em `/api/animals`.

**Out:** Nenhuma escrita (TASK-BACKEND-007 a TASK-BACKEND-009). Nenhuma busca, filtro ou ordenação configurável — pertencem à feature de filtragem da vitrine (RN-42b). Nenhum endpoint anônimo nem projeção pública da vitrine: aqui só existe a representação administrativa; a projeção pública é da feature seguinte, e esta task apenas deixa o mapper pronto para que ela não serialize a entidade inteira.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Idade (RN-20) | `calculateAgeInYears(birthDate, now)` → campo `ageInYears`, `null` quando não há data |
| Animal inexistente (RN-44) | `AnimalNotFoundError` → `404 ANIMAL_NOT_FOUND` |
| Página de resultados | envelope `{ items, pagination: { page, pageSize, total } }` |
| Imagem de capa (RN-35) | `images[0]`, sempre `position` 0 |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.messages.ts` | acrescenta chaves de leitura |
| `create` | `src/domains/animals/animals.validators.ts` | schemas de leitura |
| `create` | `src/domains/animals/errors/animal.errors.ts` | erros do animal |
| `create` | `src/utils/age.ts` | idade em anos completos |
| `create` | `src/domains/animals/repositories/animal.repository.ts` | acesso a animals |
| `create` | `src/domains/animals/mappers/animal.mapper.ts` | representação do contrato |
| `create` | `src/domains/animals/services/list-animals.service.ts` | listagem paginada |
| `create` | `src/domains/animals/services/get-animal.service.ts` | consulta por id |
| `create` | `src/domains/animals/animals.controller.ts` | camada HTTP |
| `create` | `src/domains/animals/animals.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/animals |
| `modify` | `src/infra/storage/object-path.ts` | URL pública derivada |

> **Sobre `object-path.ts`** *(emenda da Rodada 1)*: a spec exige `url` na representação do animal, mas a tabela `animal_images` guarda `storage_path` — a URL pública precisa ser **derivada**. A TASK-BACKEND-007 proíbe alterar o mapper, então a derivação tinha de nascer aqui, e o lugar certo é o módulo que já conhece a forma dos caminhos do fornecedor. **Custo registrado**: o módulo era **puro** e passou a importar `~/config/env` para ler `SUPABASE_URL`/`SUPABASE_STORAGE_BUCKET`; a partir daqui, qualquer uso de `buildAnimalImageObjectPath` **fora do processo da aplicação** (um script, um teste isolado) carrega e valida o `env` inteiro e exige `SUPABASE_URL` definida. Alternativa para uma fatia futura, se o acoplamento incomodar: receber a base como parâmetro, ou expô-la por um módulo de configuração de storage, mantendo o `object-path` puro.

---

## Implementation

> **Reference pattern**: `src/domains/geography/` (TASK-BACKEND-005) é a fatia vertical mais próxima e recém-criada; `src/domains/auth/mappers/user.mapper.ts` é o modelo do mapper; `src/utils/clock.ts` é obrigatório — **nenhum arquivo desta task instancia `new Date()`**, porque os testes de idade fixam o instante.

### `src/domains/animals/animals.messages.ts` *(modify)*
- **O arquivo JÁ EXISTE — não recriar.** A `TASK-BACKEND-003` precisou criá-lo: o invariante do projeto manda todo texto exibido ao usuário viver em `<dominio>.messages.ts` (precedentes: `auth.messages.ts`, `species.messages.ts`), e a entrada de arquivos daquela fatia já produz texto ao usuário. Ele hoje carrega `VALIDATION_GUARD`, `FIELD_NOT_ALLOWED`, `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `ANIMAL_IMAGE_TOO_LARGE`, `IMAGE_FILE_EMPTY`, `REQUEST_BODY_TOO_LARGE` e `UNSUPPORTED_MEDIA_TYPE`. Sobrescrevê-lo apagaria as mensagens que o middleware de upload consome e derrubaria a suíte da 003.
- **ACRESCENTAR** ao objeto existente **quatro** chaves de leitura: `ANIMAL_NOT_FOUND`, `INVALID_IDENTIFIER`, `INVALID_PAGE` e `INVALID_PAGE_SIZE`. `VALIDATION_GUARD` ("Verifique os campos informados.") **já está lá** — reusar, não duplicar.
- As duas chaves de paginação **não constam** da tabela "Mensagens ao Usuário" da spec, que só fixa a mensagem-guarda para essa falha, e ainda assim são obrigatórias: o `details` do contrato exige **um texto por campo**, e a guarda não serve para isso. Sem elas, o default do Zod entrega ao administrador o literal inglês `"Expected number, received nan"` — texto em outro idioma exibido ao usuário, que a **RNF-22** (Idioma) proíbe. *(A rastreabilidade correta é RNF-22; a RNF-12 é "Escritas refletem rapidamente", de Desempenho.)*
- As demais entram nos slices de escrita — não antecipar.

### `src/domains/animals/animals.validators.ts` *(create)*
- `listAnimalsQuerySchema`: `page` e `pageSize` coagidos da query (`z.coerce.number`), com `.default(1)` e `.default(20)` **por fora** da coerção — é o `.default()` que intercepta o parâmetro ausente antes do parse, em vez de deixá-lo virar `Number(undefined)`, que é `NaN`.
- **Cada campo declara `invalid_type_error`**: `z.coerce.number({ invalid_type_error: MESSAGES.INVALID_PAGE })` e o análogo com `INVALID_PAGE_SIZE`. A coerção não lança, ela produz `NaN` — e quem reprova `NaN` é o **próprio `ZodNumber`**, antes de qualquer refinamento, porque `ZodEffects` só roda depois que o tipo base passa. Sem esse parâmetro, `?page=abc`, `?page=true`, `?page=null` e o `?page=1&page=2` (que o Express entrega como array) respondem `400` com `"Expected number, received nan"`, em inglês (RNF-22). **Um `superRefine` sozinho não alcança esse caminho.** `required_error` não acompanha: o `.default()` já consumiu o `undefined`, e a chave seria configuração morta.
- Faixa e formato ficam em **`superRefine` com *early return*** — e não na cadeia `.int().min(1)`, que **acumula** os problemas e faria `?page=-1.5` sair com a mesma mensagem duas vezes no mesmo `field`. Mesmo remédio já aplicado em `medirNome` (espécies) e `medirSigla` (geografia).
- **Sem `.strict()`.** Duas razões: o `unrecognized_keys` do Zod sai com `path: []`, e `validationErrorFromZodError` faz `path.join('.')` — o cliente receberia `details: [{ field: "" }]`, que não marca campo nenhum; e o contrato **não pede a recusa** — o precedente testado do projeto é o oposto (`tests/integration/species-routes.spec.ts:515`, *"a rota ignora query string em vez de recusá-la"*), então `?ordenar=nome` responderia `400` em `/api/animals` e `200` em `/api/species` para o mesmo cliente. O `z.object` sem modificador já **descarta** a chave desconhecida: ela é ignorada, não aceita. A recusa de chave extra continua valendo integralmente no **corpo das escritas** (RN-46), com a fábrica `.passthrough()` + `superRefine` das fatias seguintes.
- `animalIdParamsSchema`: `{ id: z.string().uuid() }` com mensagem `INVALID_IDENTIFIER` no `field` `id`.
- `pageSize: 0` e `pageSize: 101` são `400` — a faixa é fechada nos dois extremos (CT-28).

### `src/utils/age.ts` *(create)*
- `calculateAgeInYears(birthDate: Date | null, now: Date): number | null`.
- `null` quando `birthDate` é `null`. **`null` é diferente de `0`** — zero significa "menos de um ano", e confundir os dois faz a interface exibir "0 anos" para um animal cuja idade ninguém sabe (RN-21).
- A comparação é entre **duas datas civis**, nunca por subtração de milissegundos — mas as duas datas chegam de origens diferentes e por isso são lidas de formas **deliberadamente assimétricas**:
  - **`now` é um instante real** (o relógio) e precisa ser convertido para a data civil do produto: `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. Sem isso, com o processo em UTC, às 22h em São Paulo já é o dia seguinte e o aniversário seria antecipado (RN-22, RNF-10).
  - **`birthDate` já É uma data civil** e **não** passa por essa conversão. A coluna é `@db.Date` e o driver a materializa como a **meia-noite UTC** daquele dia — verificado contra o banco: `SELECT '2023-01-01'::date` chega como `2023-01-01T00:00:00.000Z`. Logo, ela é lida por `getUTCFullYear` / `getUTCMonth` / `getUTCDate`.
- **A assimetria é o ponto, não um descuido — não "corrigir" para tratar os dois campos igual.** Converter `birthDate` para o fuso do produto devolveria a meia-noite UTC como o **dia anterior** (21h do dia 31/12 em SP), e a idade viraria **um ano mais cedo, todo 31/12**, passando despercebida nos outros 364 dias. Comprovado por execução na Rodada 1: nascimento **01/01/2023**, relógio em **31/12/2025 23h (SP)** → leitura assimétrica devolve **2** (correto); lendo `birthDate` também por `Intl` no fuso SP devolveria **3**.
- Nascido em **29/02** completa ano em **01/03** nos anos não bissextos (`0` em 28/02/2025, `1` em 01/03/2025). Convenção alinhada ao uso civil brasileiro; nenhuma regra da spec a fixa, então ela fica registrada no comentário da função que decide o aniversário.
- Anos **completos**: quem nasceu em 05/11/2022 tem 3 anos em 25/08/2026 e 4 em 06/11/2026.
- Função pura, sem `new Date()` interno — o `now` é sempre injetado por quem chama, a partir de `~/utils/clock.ts`.

### `src/domains/animals/repositories/animal.repository.ts` *(create)*
- Interface `AnimalRepository` + `PrismaAnimalRepository`. Métodos desta fatia: `listPaginated({ skip, take }): Promise<{ items; total }>` e `findById(id)`, ambos com `include` de `species`, `city` (com `state`) e `images` ordenadas por `position`.
- Ordenação **exatamente** `[{ nameNormalized: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]`. Os três critérios são obrigatórios: sem o desempate final pelo identificador, dois animais cadastrados no mesmo instante trocam de posição entre páginas, e um registro aparece duas vezes enquanto outro desaparece (RN-41, RNF-08).
- `listPaginated` devolve itens e total em **uma** `$transaction` com `findMany` + `count`, para que os dois enxerguem o mesmo instantâneo. Contados fora, um cadastro concorrente produz um total incoerente com a página.
- Ausência é `null`; o repositório não lança erro HTTP.

### `src/domains/animals/mappers/animal.mapper.ts` *(create)*
- `toAnimalResponse(animal, now): AnimalResponse` produzindo **exatamente** o objeto do bloco "Representação do animal" da spec.
- **Projeção campo a campo, explícita.** Proibido `...animal` ou qualquer forma de espalhar a entidade. Hoje não existe campo interno — e é exatamente por isso que a regra nasce agora: quando o número do chip e o contato do proprietário entrarem, eles não vazarão por padrão só porque alguém devolveu o objeto inteiro (RN-59, CA-45).
- `birthDate` sai como `AAAA-MM-DD`, sem hora e sem fuso. Uma data de nascimento não tem horário, e serializar `Date` em ISO com `Z` faria a interface exibir o dia anterior para quem está a oeste de Greenwich.
- `ageInYears` vem de `calculateAgeInYears`, nunca de coluna.
- `city` sai como `{ id, name, stateUf }` — a UF é **derivada** da cidade, e não um campo independente que possa divergir dela (RN-28).
- `images` sempre ordenado por `position`; `position` 0 é a capa.
- `updatedAt` é serializado porque é o token de concorrência que a edição e a alteração de status exigem de volta (RN-47).

### `src/domains/animals/services/list-animals.service.ts` *(create)*
- `execute({ page, pageSize })` → `skip = min((page - 1) * pageSize, Number.MAX_SAFE_INTEGER)`. A saturação atende o achado #9 da Rodada 2: sem ela o produto estoura o inteiro de 64 bits do `skip` e o Prisma recusa a consulta, transformando `?page=1e19` em `500`. O teto fica no `skip` e **não** em `page` para não introduzir um limite que a spec não pede e que quebraria a linha seguinte.
- Devolve `{ items: items.map(a => toAnimalResponse(a, now())), pagination: { page, pageSize, total } }`.
- Lista vazia é `200` com `items: []` e `total: 0`, **nunca** `404`.
- Página além do total responde `200` com `items: []` e o `total` real — não é erro.

### `src/domains/animals/services/get-animal.service.ts` *(create)*
- `findById` → `null` ⇒ `AnimalNotFoundError`. A mensagem não distingue "nunca existiu" de "já foi excluído" (RN-44).

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(create)*
- Fábrica `createAnimalsController(deps)`; dois handlers `200`.
- Apenas `admin` autenticado lista ou consulta animais (RN-01); nenhum endpoint desta feature é anônimo (RN-02).
- `GET /` e `GET /:id`, ambos `authenticate` → `authorizeRole('ADMIN')` → `validateRequest(...)` → handler. Autenticar antes de autorizar.
- As rotas de escrita entram neste mesmo arquivo nas TASK-BACKEND-007 a 009 — deixar o arquivo preparado para recebê-las, sem criá-las.
- **Uma conversão de tipo sobre `req.query` no handler é inevitável** — registrado para que ninguém a trate como preguiça: reproduzido na Rodada 1 que um handler com a query já tipada **não compila** (TS2769) quando montado ao lado de `authenticate`/`authorizeRole`, enquanto a mesma rota sem as guardas compila. A alternativa seria repetir `listAnimalsQuerySchema.parse` no controller, duplicando o parse que o `validateRequest` já fez.

### `src/routes/index.ts` *(modify)*
- `router.use('/animals', animalsRoutes)`.

---

## Acceptance Criteria

- [ ] **Given** três animais chamados "theo", "Bidu" e "Amora", **When** `GET /api/animals`, **Then** a ordem é "Amora", "Bidu", "theo" — alfabética ignorando maiúsculas e minúsculas (CT-25).
- [ ] **Given** 45 animais com o mesmo `createdAt`, **When** as três páginas de `pageSize: 20` são percorridas, **Then** retornam 45 identificadores distintos, sem repetição e sem omissão (CT-26, CA-08, RNF-08).
- [ ] **Given** o cadastro vazio, **When** `GET /api/animals`, **Then** `200` com `items: []` e `pagination.total: 0` (CT-29).
- [ ] **Given** `pageSize: 0` e `pageSize: 101`, **When** consultados, **Then** ambos respondem `400 VALIDATION_ERROR` (CT-28).
- [ ] **Given** um animal nascido em 05/11/2022 e o relógio fixado em 25/08/2026, **When** consultado, **Then** `ageInYears` é `3`; **Given** o relógio fixado em 06/11/2026, **Then** é `4`, e **nenhuma escrita no banco ocorre entre as duas consultas** (CT-18, CT-19, CA-14, RNF-09).
- [ ] **Given** um animal sem data de nascimento, **When** consultado, **Then** `birthDate` e `ageInYears` são ambos `null` — nunca `0` (CT-20, RN-21).
- [ ] **Given** o processo em UTC e o relógio às 22h de São Paulo, **When** a idade de um animal nascido hoje é calculada, **Then** o resultado é `0` e não `-1` nem erro (RNF-10).
- [ ] **Given** um animal com duas imagens, **When** consultado, **Then** `images` vem ordenado por `position` e `images[0].position` é `0` (CT-31).
- [ ] **Given** a saída do mapper, **When** comparada ao bloco de representação da spec, **Then** os nomes e tipos de campo coincidem exatamente e **nenhum** campo extra da entidade aparece (CA-45, RNF-23).
- [ ] **Given** um `id` que não é UUID, **When** `GET /api/animals/:id`, **Then** `400` com `details: [{ field: "id", message: "Identificador inválido." }]` (CT-92).
- [ ] **Given** um `id` UUID inexistente, **When** consultado, **Then** `404 ANIMAL_NOT_FOUND` com "Animal não encontrado." (CA-39).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — nos dois endpoints (CA-40).
- [ ] **Given** 500 animais cadastrados, **When** a primeira página é consultada, **Then** a resposta chega em menos de 2 segundos — os índices da RN-41 são o que sustenta isso, e um `include` sem índice em `species`/`city` é o defeito que só aparece com volume (CT-98, RNF-11).
- [ ] **Given** o código desta task, **When** inspecionado, **Then** não há nenhuma ocorrência de `new Date()`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (modelos), TASK-BACKEND-002 (cidades para o `include`), TASK-BACKEND-005 (molde da fatia vertical e `authorizeRole` já montado).
- **Blocks**: TASK-BACKEND-007 a TASK-BACKEND-009 (reusam repositório, mapper, controller, rotas e catálogo), TASK-FRONTEND-013, TASK-FRONTEND-016, TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 12 (11 da tabela *Files* + `src/infra/storage/object-path.ts`)

#### Resumo

A fatia está correta no que é difícil: o cálculo de idade, a ordenação no banco, a paginação transacional e a projeção explícita do mapper foram todos verificados **por execução contra o banco real** e passam. Reprovada por **um achado major**: a query `?page=abc` responde `400` com a mensagem em inglês `"Expected number, received nan"`, violando o RNF-22 — exatamente a falha que as duas chaves de mensagem acrescentadas alegavam impedir. O texto desta task precisa de **quatro emendas**, uma delas porque ela **prescreve um cálculo de idade errado** e a implementação, corretamente, não a obedeceu.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | major | `src/domains/animals/animals.validators.ts` | L46-56, L59-69, L100-106 | requisito (RNF-22) | `?page=abc`, `?pageSize=abc` e `?page=1&page=2` respondem `400` com `details[0].message` = `"Expected number, received nan"` — texto em inglês exibido ao usuário. O `superRefine` só roda **depois** que o tipo base passa; `Number('abc')` é `NaN` e o próprio `ZodNumber` já reprova com a mensagem default, então o ramo `!Number.isInteger(valor)` é **inalcançável para `NaN`** (continua alcançável para `1.5` e `Infinity`). Isso derruba a justificativa registrada em `animals.messages.ts:50-57` para a existência de `INVALID_PAGE`/`INVALID_PAGE_SIZE`. | `z.coerce.number({ invalid_type_error: MESSAGES.INVALID_PAGE, required_error: MESSAGES.INVALID_PAGE })` nos dois campos. Uma linha por campo; o resto do desenho fica como está. |
| 2 | minor | `src/domains/animals/animals.messages.ts` | L54 | rastreabilidade | Cita **RNF-12** para justificar texto em PT-BR. O RNF-12 é *"Escritas refletem rapidamente"* (Desempenho). O requisito de idioma é o **RNF-22** (`spec_context.md:1139`). | Trocar a citação para RNF-22. |
| 3 | minor | `src/domains/animals/repositories/animal.repository.ts` | L72-73 | comentário falso | *"o Postgres percorre o indice ja na ordem pedida, sem passo de ordenacao"*. O índice é `(name_normalized, created_at, id)` **todo ASC** e a consulta pede `created_at DESC`. `EXPLAIN` real: `Incremental Sort` (`Presorted Key: name_normalized`) sobre `Index Only Scan`. | Corrigir o texto: o índice presorta pelo primeiro critério e o desempate é ordenado por cima. Sem impacto prático — os grupos por nome são minúsculos. |
| 4 | minor | `src/domains/animals/animals.validators.ts` | L35-38 | comentário falso | *"`?page=abc` ... os dois checks falham e ... produziria a MESMA mensagem duas vezes"*. Verificado: `?page=abc` produz **um** issue, não dois. A acumulação real acontece com `?page=-1.5`. | Trocar o exemplo para `?page=-1.5`. A escolha pelo `superRefine` continua defensável. |
| 5 | minor | `src/infra/storage/object-path.ts` | L1, L78-85 | escopo | 12º arquivo, fora da tabela *Files*. A necessidade procede e a localização está certa (a forma da URL é vocabulário do fornecedor), mas o módulo, antes puro, passou a importar `~/config/env` — qualquer teste de `buildAnimalImageObjectPath` agora carrega e valida o `env` inteiro. | Emendar a tabela *Files* (ver Emendas). Considerar receber a base como parâmetro ou expô-la por um módulo de configuração de storage, mantendo o `object-path` puro. |
| 6 | suggestion | `src/utils/age.ts` | L108-114 | regra não documentada | Nascido em 29/02 completa ano em **01/03** nos anos não bissextos (verificado: `0` em 28/02/2025, `1` em 01/03/2025). Convenção defensável e alinhada ao uso civil brasileiro, mas nenhuma regra da spec a fixa e o arquivo não a menciona. | Registrar a convenção no comentário de `aniversarioJaOcorreu`. |
| 7 | suggestion | `src/domains/animals/animals.validators.ts` | L101 | robustez | `page` não tem teto: `?page=9007199254740991` responde `200` (verificado). Deep-offset puro. A spec não exige teto e o custo é irrelevante no volume atual. | Nenhuma ação exigida; registrar como conhecido. |
| 8 | suggestion | `src/domains/animals/animals.controller.ts` | L67-69 | tipagem | A conversão é **inevitável** (reproduzido: TS2769 apenas na rota montada ao lado de `authenticate`/`authorizeRole`; a mesma rota sem as guardas compila). Ainda assim é uma promessa não verificada em tempo de execução. | Manter. Opcionalmente, `listAnimalsQuerySchema.parse` no controller trocaria a conversão por uma verificação — ao custo de duplicar o parse. |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 14 de 14 critérios verificáveis nesta fatia estão implementados; 1 deles com defeito colateral (achado #1). Verificados **por execução**:

| Critério | Verificação executada | Resultado |
|---|---|---|
| CT-25 — ordem "Amora", "Bidu", "theo" | 7 animais semeados no banco real, `listPaginated` | `Ágil \| Amora \| Bidu \| caçula \| Cão \| Cavalo \| theo` — ✅ |
| CT-26 / CA-08 / RNF-08 — 45 ids distintos | 500 animais, mesmo `createdAt`, 25 páginas de 20 percorridas via HTTP | **500 ids distintos**, sem repetição nem omissão — ✅ |
| CT-29 — cadastro vazio | `GET /api/animals` | `200 {"items":[],"pagination":{"page":1,"pageSize":20,"total":0}}` — ✅ |
| Página além do total | `GET /api/animals?page=9` | `200`, `items: []`, `total` real — ✅ |
| CT-28 — `pageSize` 0 e 101 | HTTP | ambos `400 VALIDATION_ERROR`, `field: "pageSize"`; `pageSize=100` → `200` — ✅ |
| CT-18/CT-19/CA-14/RNF-09 — idade 3 → 4 | `calculateAgeInYears` com relógio fixo | 05/11/2022: `3` em 25/08/2026, `4` em 06/11/2026, `4` no próprio 05/11/2026, `3` em 04/11/2026 — ✅, sem escrita no banco |
| CT-20 / RN-21 — sem data de nascimento | mapper | `birthDate: null` **e** `ageInYears: null` (nunca `0`) — ✅ |
| RNF-10 — 22h de São Paulo, processo em UTC | `now = 2026-08-27T01:00Z`, nasc. 2026-08-26 | `0` (não `-1`, não erro) — ✅ |
| CT-31 — `images` por `position` | 2 imagens inseridas fora de ordem (position 1 antes de 0) | resposta traz `position` 0 primeiro — ✅ |
| CA-45 / RNF-23 — projeção campo a campo | comparação com `spec_context.md:642-665` | nomes, tipos e **ordem** coincidem; nenhum `...animal`; ficam de fora `nameNormalized`, `speciesId`, `cityId`, `storagePath`, `contentType`, `sizeBytes` — ✅ |
| CT-92 — `id` não-UUID | `GET /api/animals/abc` | `400`, `details: [{field:"id", message:"Identificador inválido."}]` — ✅ |
| CA-39 — UUID inexistente | HTTP | `404 ANIMAL_NOT_FOUND` / `"Animal não encontrado."` — ✅ |
| CA-40 — 401 e 403 nos dois endpoints | HTTP, 4 combinações | sem sessão → `401 SESSION_EXPIRED`; role `cliente` → `403 FORBIDDEN` — ✅ |
| CT-98 / RNF-11 — 500 animais < 2 s | 500 animais reais, 5 medições a quente | **~2230 ms** — ver nota abaixo |
| Nenhum `new Date()` | `grep -rn "new Date()" src/` | só dentro de comentários nos arquivos desta task; a única ocorrência real do projeto é `src/utils/clock.ts:11` — ✅ |

> **Nota sobre CT-98**: a medição **não** reprova a implementação. O RTT medido até o banco (`SELECT 1`, 6 amostras) é de **~800 ms** a partir da máquina de desenvolvimento contra o pooler remoto — qualquer endpoint que faça três idas ao banco estoura 2 s nessa topologia. O plano usa o índice, o lote são duas instruções, e o custo restante é o carregamento das relações. O critério é de "conexão padrão" (aplicação junto do banco) e deve ser medido pela TASK-BACKEND-011 nessa condição.

**Pass 2 — Diff Analysis**: 11 dos 11 arquivos da tabela criados/modificados como indicado. `animals.messages.ts` `+45/−3` (as 3 deleções são de comentário; as 8 chaves da 003, a 1 da 004 e as 4 novas estão todas presentes — 13 chaves). Nada do `## Scope — Out` foi tocado: nenhuma rota de escrita, nenhum endpoint anônimo, nenhuma busca/filtro/ordenação configurável, nenhum teste (são da 011). Um arquivo fora da tabela — achado #5. Sem formatação em massa e sem arquivo alheio modificado.

**Pass 3 — Code Practices**: Nenhum achado bloqueante. `SemParametros`, `AnimalPageRequest`, `AnimalPage`, `DataCivil` e os três `Record<Enum, Publico>` cumprem bem o papel de evitar obsessão por primitivo; nenhum método passa de um nível de indentação; nenhum `else`; nenhum número mágico (`PAGINA_PADRAO`, `TAMANHO_DE_PAGINA_*`, `FIM_DA_DATA_CIVIL`, `PREFIXO_DE_LEITURA_PUBLICA`). Injeção de dependência por construtor em repositório, services e controller. `PrismaAnimalRepository` tem 2 variáveis de instância. Zero `any` nos arquivos da task; `typecheck` sai `0` (`tsc --noEmit` + `tsconfig.seed.json` + `tsconfig.test.json`). Acentos em comentário aparecem apenas dentro de literais citados ("Idade não informada", "Boa Esperança", "Médio") — mesmo padrão já presente em `auth.validators.ts:61` e em outros 12 arquivos do projeto; não é desvio. Nomenclatura de domínio em inglês (`AnimalNotFoundError`, `toAnimalResponse`, `calculateAgeInYears`, `listPaginated`), auxiliares internos em PT-BR — idêntico ao precedente de `species` e `geography`.

**Pass 4 — Testing Review**: Nenhum achado. Esta task **não entrega testes por contrato** (são da TASK-BACKEND-011) e nenhum arquivo de teste foi criado. A suíte existente permanece verde: **24 suítes / 314 testes / 0 falhas**. Nenhum teste anterior foi alterado.

**Pass 5 — Security Review**: Nenhum achado critical ou major.
- **A01** — as duas rotas montam `authenticate` → `authorizeRole('admin')` → `validateRequest`, nessa ordem. Verificado por execução: `401` sem sessão e `403` com role `cliente`, nos dois endpoints. Sem IDOR: o recurso é administrativo e não há escopo por usuário nesta feature.
- **A02** — `buildPublicObjectUrl` usa `SUPABASE_URL` e `SUPABASE_STORAGE_BUCKET` (públicos) e **não** toca `SUPABASE_SERVICE_ROLE_KEY`; a credencial de escrita não atravessa a resposta.
- **A03** — todo acesso é por Prisma parametrizado; nenhum `$queryRaw*` em código de produção. A interpolação em `buildPublicObjectUrl` recebe `storage_path`, que a RN-52 garante ser gerado pela aplicação (UUID + extensão de lista fechada).
- **A05** — corpo de erro montado só pelo `error-handler`; o `404` não distingue "nunca existiu" de "excluído" (RN-44), e o `403` não revela a faixa de `pageSize` aceita porque o `validateRequest` vem depois da autorização.
- **A09** — nenhum log com PII, token ou segredo introduzido.
- Sem limitador de taxa nas duas rotas, conforme Decisão 14 do changelog — leitura autenticada, sem risco de força bruta nem de spam.

**Pass 6 — Bug Detection**: Achado #1. Além dele, verificados sem defeito:
- **`calculateAgeInYears`, virada do ano** (o erro que passaria 364 dias por ano): nascimento 01/01/2023 → **2 anos** às 12h de 31/12/2025 (SP), **2 anos** às 23h de 31/12/2025 (SP), **3 anos** às 00h30 de 01/01/2026 (SP). Correto. O contrafactual foi executado: lendo `birthDate` também por `Intl` no fuso SP, `2023-01-01T00:00:00.000Z` vira `2022-12-31` e a mesma consulta em 31/12/2025 devolveria **3** — um ano cedo. A materialização foi confirmada contra o banco: `SELECT '2023-01-01'::date` chega ao driver como `2023-01-01T00:00:00.000Z`. **A assimetria da implementação está certa e o texto da task está errado.**
- **`now()` chamado uma vez por página**: `list-animals.service.ts:88`, fora do `map`. Confirmado.
- **`listPaginated` em uma transação**: log do Prisma na requisição real mostra `BEGIN` → `findMany` → `COUNT` → `COMMIT`. Funciona através do pgbouncer.
- **Repositório não lança erro HTTP**: `findById` devolve `null`; quem lança é `GetAnimalService`.
- **Controller não toca Prisma** e chama exatamente um service por handler.
- **`include` de cidade pelo vínculo**: as três "Boa Esperança" (MG 3107109, ES 3201001, PR 4103008) existem no banco; a resposta trouxe a UF da cidade vinculada por FK. Nenhuma resolução por nome em lugar nenhum.
- **Coerção e bordas**: `?page=1.5` → `400` PT-BR; `?page=Infinity` → `400` PT-BR; `?page=` → `400` PT-BR; `?pageSize=-5` → `400` PT-BR; `?page=2e1` → `200 page=20`; `?page=9007199254740991` → `200` sem estouro. Nenhum `500`.
- **Sem vazamento de recurso, sem `catch` vazio, sem estado mutável compartilhado, sem `==`.** `lerParte` lança `TypeError` (500 com stack) em vez de devolver idade calculada sobre `NaN` — decisão correta.

**Pass 7 — Project Patterns**: Achados #3, #5. A fatia espelha `src/domains/geography/` arquivo a arquivo; `createAnimalsController(dependencias?)` é o mesmo formato de `createGeographyController` e `createSpeciesController`, inclusive quanto a importar o `prisma` global no módulo do controller. `Prisma.TransactionClient` é de fato `Omit<DefaultPrismaClient, ITXClientDenyList>` (`node_modules/.prisma/client/index.d.ts:1523`), o que **confirma** a necessidade do segundo parâmetro do repositório para abrir o lote. O `.strict()` ausente está alinhado ao projeto e não ao texto da task: `speciesRoutes.get('/')` tem teste dedicado afirmando que query desconhecida é **ignorada** — `tests/integration/species-routes.spec.ts:515`, *"a rota ignora query string em vez de recusá-la"* —, e `?ordenar=nome` em `/api/animals` respondeu `200`, como o precedente exige. A recusa produziria mesmo `field: ""`: reproduzido, `unrecognized_keys` sai com `path: []` e `validationErrorFromZodError` faz `path.join('.')` (`src/shared/errors/http-errors.ts:114`). Mesma razão já registrada em `auth.validators.ts:88` e `species.validators.ts:110`.

#### A armadilha do módulo — `nameNormalized` ≠ `name_search`

**Respeitada integralmente.** Verificado:

- **Nenhuma remoção de acento** em lugar nenhum: `grep` por `normalize(`, `NFD`, `NFKD`, `̀`, `deburr` e `latinize` nos 12 arquivos não retorna nada.
- **Nenhuma ordenação em memória**: nenhum `.sort(` e nenhum `localeCompare` — a única menção a `localeCompare` é o comentário que explica por que **não** acrescentá-lo (`animal.repository.ts:60`).
- **Nenhuma suposição de unicidade**: `nameNormalized` só aparece como chave de `orderBy` (`animal.repository.ts:82`); nunca em `where`, nunca em `findUnique`.
- **A ordem é por locale e não binária**, confirmado contra o banco real: PostgreSQL 17.6, `datlocprovider = 'i'` (ICU), `datcollate = en_US.UTF-8`, coluna com collation `default`. Amostra ordenada pelo banco: `agil, ágil, cacula, caçula, cao, cão, cavalo, gato, zebra`. Na listagem real: `Ágil | Amora | Bidu | caçula | Cão | Cavalo | theo` — os acentuados caem no lugar certo, não depois do `Z`.
- **O aviso está registrado onde alguém o lê**: `animal.repository.ts:75-79` (bloco `ATENCAO`, diferenciando chave de ordenação × chave de unicidade e afirmando que acentos são preservados) e `prisma/schema.prisma:186-190`.

#### Emendas necessárias no texto desta task

1. **`### src/utils/age.ts` — obrigatória e a mais importante.** O texto atual manda fazer *"a comparação sobre a data civil no fuso America/Sao_Paulo, obtida por `Intl.DateTimeFormat`"*. Isso está **certo para `now` e errado para `birthDate`**, e a implementação corretamente desobedeceu. Substituir por: *"O `now` é convertido para a data civil de São Paulo por `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. O `birthDate` **não** passa por essa conversão: a coluna é `@db.Date` e o driver a materializa como a meia-noite UTC daquele dia, então ela é lida por `getUTCFullYear`/`getUTCMonth`/`getUTCDate`. A assimetria é deliberada — converter `birthDate` para o fuso do produto devolveria o dia anterior e a idade viraria um ano cedo, todo 31/12."* Comprovação executada: nascimento 01/01/2023, relógio em 31/12/2025 (SP) → implementação `2`, prescrição da task `3`.
2. **Tabela `## Files`.** Acrescentar a 12ª linha: `modify | src/infra/storage/object-path.ts | URL publica derivada`. A spec exige `url` na representação, a tabela guarda `storage_path` e a TASK-007 proíbe alterar o mapper — o arquivo é necessário e está no lugar certo.
3. **`### src/domains/animals/animals.messages.ts`.** Autorizar quatro chaves em vez de duas: `ANIMAL_NOT_FOUND`, `INVALID_IDENTIFIER`, `INVALID_PAGE` e `INVALID_PAGE_SIZE`, com a justificativa citando o **RNF-22** (idioma) e não o RNF-12. O `details` do contrato exige um texto por campo, e a mensagem-guarda da spec não serve para isso.
4. **`### src/domains/animals/animals.validators.ts`.** Duas correções: (a) remover a exigência nominal de `.strict()` — ele produz `field: ""` e contraria o precedente testado em `species-routes.spec.ts:515`; registrar que a recusa de chave extra continua valendo no **corpo** das escritas (RN-46); (b) trocar `page`/`pageSize` `z.coerce.number().int().min(1)...` pela forma que de fato atende o RNF-22: `z.coerce.number({ invalid_type_error: MESSAGES.INVALID_PAGE })` + `superRefine` com *early return*.
5. **`### src/domains/animals/animals.controller.ts` (opcional, mas recomendada).** Registrar que uma conversão de tipo sobre `req.query` é inevitável: reproduzido que um handler com query tipada **não compila** ao lado de `authenticate`/`authorizeRole` (TS2769), enquanto a mesma rota sem as guardas compila.

#### Veredicto

> **REPROVADA — NECESSITA CORREÇÕES.** 0 critical, 1 major (#1: `GET /api/animals?page=abc` devolve `"Expected number, received nan"` ao usuário, violando o RNF-22), 4 minor e 3 suggestions.
>
> O achado #1 é uma linha por campo em `src/domains/animals/animals.validators.ts:101-105`. Os demais achados são de comentário e de rastreabilidade e não bloqueiam.
>
> **O cálculo de idade está correto e o texto desta task está errado** — a emenda 1 é obrigatória antes de fechar a task, sob pena de a próxima fatia "corrigir" a implementação certa para a prescrição errada.
>
> Encaminhar ao `makuco-codegen` para o achado #1 e as emendas 1 a 4.

**Verificação e limpeza**: banco restaurado ao estado inicial exato após os testes de volume — `users 2 | refresh_tokens 8 | email_confirmation_tokens 1 | species 0 | states 27 | cities 5571 | animals 0 | animal_images 0`. Nenhum arquivo de código alterado pela revisão; `git status` contém apenas os 11 arquivos da entrega mais `object-path.ts`.

---

### Rodada de Revisão 2 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 12 (11 da tabela *Files* + `src/infra/storage/object-path.ts`), mais o texto desta task

#### Resumo

O achado **major** da Rodada 1 está **resolvido**: os três caminhos citados — `?page=abc`, `?pageSize=abc` e `?page=1&page=2` — respondem `400 VALIDATION_ERROR` com **exatamente um** item em `details`, em **PT-BR** e no `field` correto. Reverifiquei por execução, sem confiar na tabela do autor: montei o `validateRequest` + `errorHandler` reais sobre um Express real e percorri **61 formas de query** e **7 formas de `:id`**. **Nenhuma** produziu texto em inglês. Os quatro caminhos que o autor afirma ter descoberto por conta própria (`?pageSize=1&pageSize=2`, `?page=true`, `?page=null`, `?page[x]=1`) conferem, e outros **quarenta e poucos** que ele não listou também. Nada do que a Rodada 1 aprovou regrediu — idade, ordenação por locale, `include` por vínculo, `now()` único, `findMany`+`count` na mesma transação e paginação sem repetição foram todos reexecutados contra o banco real. As cinco emendas no texto estão aplicadas e são **factualmente corretas**, incluindo a da idade, que era a crítica.

Um achado **novo**, `minor`, que a Rodada 1 registrou pela metade: `page` sem teto não responde `200` sempre — acima do inteiro de 64 bits ele responde **`500`**.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 9 | minor | `src/domains/animals/services/list-animals.service.ts` + `animals.validators.ts` | L77 / L118-121 | bug (violação de limite) | `page` não tem teto e `skip = (page - 1) * pageSize` estoura o inteiro de 64 bits. Verificado por HTTP com o controller, os services e o repositório **reais**: `?page=1e19`, `?page=470000000000000000` e `?page=99999999999999999999` respondem **`500 INTERNAL_ERROR`**, porque o Prisma lança `PrismaClientValidationError` — *"Unable to fit value 2e+21 into a 64-bit signed integer for field `skip`"*. O limiar exato é `skip > 2^63−1`: `?page=460000000000000000` ainda responde `200`; `?page=470000000000000000` já responde `500`. O corpo devolvido é o genérico do `error-handler` (nenhum vazamento), mas a stack completa vai para o log e **entrada de usuário vira falha de infraestrutura** — exatamente o desfecho que `animalIdParamsSchema` existe para evitar no `:id`, conforme o comentário em `animals.validators.ts:137-139`. A Rodada 1 registrou este espaço como suggestion #7 com *"responde `200` (verificado)"*; isso é verdade só até `9007199254740991`, que foi o único valor testado lá. | Dar teto a `page` em `medirPagina`, com a mesma mensagem `INVALID_PAGE` (o texto — *"inteiro maior ou igual a 1"* — já não descreve teto nenhum, então um teto exigiria também rever a frase, ou usar um segundo texto). Alternativa de menor toque: validar o `skip` resultante. Não bloqueia: nenhum critério de aceite pede teto, a interface nunca produz o valor e não há vazamento. |
| 10 | suggestion | `src/domains/animals/animals.validators.ts` | L118-125 | robustez | O achado colateral que o autor declarou — `?page[]=1` passa como `page=1` — **procede e é mais amplo do que ele descreveu**: `?page[0]=1`, `?page[1]=1` e `?pageSize[]=2` têm o mesmo desfecho, porque o `qs` compacta o array de um item e `Number(['1']) === 1`. **Julgamento: aceitável, sem ação.** O resultado é idêntico ao de `?page=1`, o valor que chega ao service é o número `1`, não há `500`, não há divergência de contrato e o array de dois itens (`?page[]=1&page[]=2`) é corretamente recusado em PT-BR. Nenhum cliente legítimo produz a forma. | Nenhuma. Registrado como conhecido. |
| 11 | suggestion | — (relato, não código) | — | rastreabilidade | A afirmação de que *"`animals` era o único uso de `z.coerce.number` do projeto"* é **falsa**: `src/config/env.ts` tem cinco (`PORT`, `REFRESH_TOKEN_TTL_DAYS`, `EMAIL_CONFIRMATION_TTL_HOURS`, `BCRYPT_COST`, `SMTP_PORT`) e `tests/unit/validate-request.middleware.spec.ts` outras três. A **conclusão** sobrevive — o `env` é validado no *boot* e o texto do Zod vai para o log do processo, não para o usuário, então o RNF-22 não o alcança —, mas a varredura que a sustentava não foi exaustiva. Não está escrito em nenhum arquivo de código, então não há o que corrigir na entrega. | Nenhuma ação nesta task. |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: os 14 critérios verificáveis desta fatia continuam implementados, agora **sem** o defeito colateral do achado #1. Nada mudou nas verificações da Rodada 1 que eu não tenha reexecutado (ver Pass 6).

**Pass 2 — Diff Analysis**: `git status` traz exatamente os 12 arquivos da entrega (11 da tabela emendada + `object-path.ts`) e o texto desta task. Nenhum arquivo novo, nenhum arquivo alheio, nenhuma formatação em massa. `animals.messages.ts` continua **modificado** (`+49/−3`), **não recriado**, e carrega as **13 chaves**: `VALIDATION_GUARD`, `FIELD_NOT_ALLOWED`, `ANIMAL_NOT_FOUND`, `INVALID_IDENTIFIER`, `INVALID_PAGE`, `INVALID_PAGE_SIZE`, `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `ANIMAL_IMAGE_TOO_LARGE`, `IMAGE_FILE_EMPTY`, `REQUEST_BODY_TOO_LARGE`, `IMAGE_STORAGE_UNAVAILABLE`, `UNSUPPORTED_MEDIA_TYPE`. A suíte da 003 e da 004 continua verde, o que é a prova de que nada foi apagado.

**Pass 3 — Code Practices**: nenhum achado novo. A correção acrescentou **duas linhas de configuração** e reescreveu comentário; não alterou estrutura. `typecheck` sai `0` (`tsc --noEmit` + `tsconfig.seed.json` + `tsconfig.test.json`), reexecutado por mim.

**Pass 4 — Testing Review**: nenhum achado. A task não entrega testes por contrato (são da TASK-BACKEND-011) e nenhum arquivo de teste foi criado ou alterado. Suíte reexecutada: **314 testes, 0 falhas**.

**Pass 5 — Security Review**: nenhum achado novo. A correção não toca autenticação, autorização, consulta ao banco nem montagem de corpo de erro. O `500` do achado #9 devolve o corpo genérico `INTERNAL_ERROR` — verificado literalmente na resposta — e **não** vaza a mensagem do Prisma, o nome da tabela nem a stack para o cliente (A05 respeitado; o diagnóstico fica no log do servidor, como o `error-handler.middleware.ts:60-64` prescreve).

**Pass 6 — Bug Detection**: achado #9. Tudo o mais foi reexecutado e passa.

##### 6.1 — Os três casos do major, refeitos do zero

Express real + `validateRequest` real + `errorHandlerMiddleware` real; resposta HTTP lida do corpo, não do schema.

| Query | Status | `details` |
|---|---|---|
| `?page=abc` | `400 VALIDATION_ERROR` | **1 item** — `{"field":"page","message":"A página deve ser um número inteiro maior ou igual a 1."}` |
| `?pageSize=abc` | `400 VALIDATION_ERROR` | **1 item** — `{"field":"pageSize","message":"O tamanho da página deve ser um número inteiro entre 1 e 100."}` |
| `?page=1&page=2` | `400 VALIDATION_ERROR` | **1 item** — `{"field":"page", …}` (o Express entrega `['1','2']`, `Number(...)` é `NaN`) |

##### 6.2 — Os quatro caminhos que ele diz ter achado, mais os que ele não achou

Os quatro conferem. Ataquei por ângulos que ele não tentou — literais de linguagem, pontuação, espaço em branco codificado, caractere invisível, notação hexadecimal e científica, aninhamento de chave, e as duas mesmas falhas simultâneas. **Nenhuma resposta em inglês, em lugar nenhum.**

| Caso | Resultado |
|---|---|
| `?pageSize=1&pageSize=2`, `?page=true`, `?page=null`, `?page[x]=1` | `400`, 1 item, PT-BR — os quatro declarados, confirmados |
| `?page=undefined`, `?page=NaN`, `?page=1n` | `400`, 1 item, PT-BR |
| `?page=,` · `?page=1,2` · `?page=1%2C` · `?page=.5` | `400`, 1 item, PT-BR |
| `?page=%20` · `?page=+` · `?page=%09` · `?page=%00` · `?page=%E2%80%8B1` (espaço de largura zero) | `400`, 1 item, PT-BR |
| `?page=[1]` · `?page={"a":1}` · `?page[a][b]=1` · `?page[]=1&page[]=2` · `?page[]=` | `400`, 1 item, PT-BR |
| `?page=abc&pageSize=abc` · `?page=true&pageSize=false` | `400`, **2 itens** — um por campo, cada um no seu `field`. Correto: são duas falhas distintas, não a mesma duas vezes |
| `?page=0x10` → `200 page=16` · `?page=2e1` → `200 page=20` · `?page=1e2`/`100.0` em `pageSize` → `200 pageSize=100` | coerção numérica do JavaScript; sem defeito e sem inglês |
| `?page=9007199254740993` → `200 page=9007199254740992` | perda de precisão silenciosa do `Number`; inofensiva (página vazia) |
| `?PAGE=2`, `?ordenar=nome`, `?page=1&ordenar=x` | `200` com os padrões — chave desconhecida **ignorada**, como o precedente de `species` exige |
| `:id` — `abc`, `123`, `%20`, `../../etc` codificado, 200 caracteres | `400`, 1 item, `{"field":"id","message":"Identificador inválido."}` |

Registro de um caminho em inglês que **existe mas é inalcançável**: `listAnimalsQuerySchema.safeParse(undefined)` devolve `[{path: [], message: "Required"}]`, que sairia como `details: [{field: ""}]`. O `z.object` externo não declara `required_error`. Não é achado: no Express 4 `req.query` é **sempre** um objeto (`{}` no mínimo), e o `validateRequest` só é alcançado por rota montada. Fica anotado para o caso de alguém um dia desligar o *query parser*.

##### 6.3 — Julgamento sobre a ausência do `required_error`

**A alegação dele procede.** Verificado por execução, não por leitura: `.default()` produz um `ZodDefault` **por fora** do `ZodEffects`, e o `ZodDefault` substitui o `undefined` **antes** de chamar o tipo interno — o `ZodNumber` nunca recebe entrada ausente.

| Entrada | Resultado |
|---|---|
| `{}` | `ok {"page":1,"pageSize":20}` |
| `{ page: undefined }` | `ok {"page":1,"pageSize":20}` |
| `{ pageSize: undefined }` | `ok {"page":1,"pageSize":20}` |
| `Object.create(null)` (sem protótipo) | `ok {"page":1,"pageSize":20}` |
| `{ page: null }` | `400` PT-BR (`Number(null)` é `0`, reprovado pela faixa — não pelo tipo) |

`required_error` seria de fato configuração morta. A distinção que ele faz para `species`/`geography` está certa: lá o campo é obrigatório e não tem `.default()`.

##### 6.4 — Nenhum `200` virou `400`, nenhum `400` virou `200`

Confirmei os nove casos de sucesso que ele lista e acrescentei os meus. `invalid_type_error` só troca **texto**; não altera que valores passam pelo tipo. O conjunto de status é idêntico ao da Rodada 1:

`?page=1.5`, `?page=Infinity`, `?page=-Infinity`, `?page=1e400`, `?page=`, `?pageSize=`, `?page=0`, `?page=-1`, `?page=-1.5`, `?pageSize=0`, `?pageSize=101` → **`400`** (todos PT-BR, 1 item).
`` (sem query), `?page=1`, `?pageSize=1`, `?pageSize=100`, `?page=01`, `?page=1.0`, `?page=1.`, `?page= 3 `, `?page=%2b1`, `?page=2e1`, `?page=0x10`, `?ordenar=nome`, `?page=9007199254740991` → **`200`**.
Único desfecho fora desses dois: os valores do achado #9, que respondem **`500`** — e já respondiam antes da correção, porque nada nesse caminho foi tocado.

##### 6.5 — Regressões: nenhuma

Reexecutado contra o **banco real**, com 45 animais semeados, uma espécie temporária e duas imagens fora de ordem.

| Item aprovado na Rodada 1 | Reverificação | Resultado |
|---|---|---|
| Ordenação por locale (CT-25) | listagem completa | `Ágil \| Amora \| Bidu \| caçula \| Cão \| Cavalo \| theo …` — acentuados no lugar certo, ordem do banco, nenhum `sort` em memória |
| Paginação sem repetição nem omissão (CT-26, RNF-08) | 3 páginas de 20 sobre 45 registros com o **mesmo `createdAt`** | 45 itens, **45 ids distintos**; e a sequência é **idêntica** em duas passadas consecutivas — o desempate por `id` está segurando |
| Página além do total | `page=9` | `200`, `items: []`, `total: 45` real |
| `findMany` + `count` na mesma transação | log de SQL do Prisma | `BEGIN` → `SELECT animals` → relações → `SELECT COUNT(*)` → `COMMIT` |
| `include` por vínculo | animal em "Boa Esperança" (existe em MG, ES e PR) | `city.stateUf` veio `MG`, a UF da cidade vinculada por FK |
| `images` por `position` (CT-31) | duas imagens inseridas com `position` 1 antes de 0 | resposta traz `position` 0 primeiro; `url` derivada de `storage_path` |
| Projeção campo a campo (CA-45, RNF-23) | chaves da saída do mapper | `id, name, species, size, sex, status, birthDate, ageInYears, description, acceptsOtherAnimals, needsLargeSpace, city, images, createdAt, updatedAt` — exatas, na ordem da spec, nada a mais |
| `now()` uma vez por página | `list-animals.service.ts:88`, fora do `map` | confirmado por leitura e pelo comportamento |
| `null` ≠ `0` (CT-20, RN-21) | animal sem data | `birthDate: null` **e** `ageInYears: null` |
| Nenhum `new Date()` | `grep -rn` em `src/` | só em comentários; a única ocorrência real do projeto continua sendo `src/utils/clock.ts:11` |

##### 6.6 — Idade: os quatro casos pedidos, refeitos

| Caso | Resultado |
|---|---|
| Virada 31/12 → 01/01 (nasc. 01/01/2023) | 12h de 31/12/2025 SP → **2**; 23h de 31/12/2025 SP → **2**; 23h59min59s de 31/12/2025 SP → **2**; 00h30 de 01/01/2026 SP → **3**. A assimetria segura a virada. |
| O próprio aniversário (nasc. 05/11/2022) | 25/08/2026 → **3**; 04/11/2026 → **3**; **05/11/2026 → 4**; 06/11/2026 → **4** |
| Bissexto (nasc. 29/02/2024) | 28/02/2025 → **0**; 01/03/2025 → **1**; 29/02/2028 → **4**. Convenção "completa em 01/03" agora registrada no comentário de `aniversarioJaOcorreu` (achado #6 da Rodada 1, atendido) |
| Data futura | nasc. 2030 em 2026 → **−4**; nasc. amanhã → **−1**. Negativo deliberado e documentado: a RN-19 recusa data futura na gravação, então um negativo denuncia linha corrompida em vez de disfarçá-la de recém-nascido |
| RNF-10 — 22h em SP com o processo em UTC | nasc. hoje → **0**, não `−1`, não erro |
| Contorno (nasc. 31/12/2023, relógio 31/12/2025 23h SP) | **2** — o par (mês, dia) empata e o `>=` conta o ano; correto |

A materialização de `@db.Date` como meia-noite UTC foi reconfirmada **pelo próprio ciclo de ida e volta**: gravei `2022-11-05`, li de volta, e o mapper produziu `"2022-11-05"` com `ageInYears` coerente — o que só acontece se `getUTC*` for a leitura certa.

**Pass 7 — Project Patterns**: nenhum achado novo. Os comentários falsos apontados na Rodada 1 (achados #3 e #4) foram corrigidos: `animal.repository.ts:72-79` agora descreve o `Incremental Sort` sobre `Index Only Scan` e diz que o índice presorta só pelo primeiro critério; `animals.validators.ts:35-40` trocou o exemplo para `?page=-1.5`. **Verifiquei a acumulação alegada**: `z.coerce.number().int().min(1)` sobre `-1.5` produz de fato **dois** *issues* (`"Expected integer, received float"` + `"Number must be greater than or equal to 1"`) e sobre `abc` produz **um**. O comentário agora está certo e a escolha pelo `superRefine` continua justificada.

#### Julgamento dos dois pontos declarados

**1. `?page[]=1` (array de um item) passa como `page=1` — aceitável, sem ação.** Confirmado, e mais amplo do que ele descreveu: vale também para `?page[0]=1`, `?page[1]=1` e `?pageSize[]=2`. Ainda assim é inofensivo — `Number(['1']) === 1`, o service recebe o número, a resposta é a mesma de `?page=1`, e o array de dois itens é recusado corretamente em PT-BR. Fechar essa porta custaria um `z.union` ou um `preprocess` para recusar `Array.isArray`, e a única coisa que mudaria é a resposta a uma query que nenhum cliente produz. **Concordo com a decisão de não tratar.** Registrado como achado #10, `suggestion`.

**2. `species.validators.ts:97` citando RNF-12 — ele errou o diagnóstico, mas acertou a decisão de não tocar.**

A numeração de RNF é **por feature**, não global. Em `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md:557`:

> `| RNF-12 | Idioma | Interface e mensagens em PT-BR | Nenhum texto exibido ao usuário em outro idioma, incluindo mensagens de validação |`

`species` pertence à FEATURE-001. Naquele contexto **RNF-12 É o requisito de idioma**, e a citação em `species.validators.ts:97` — e a igual em `create-species.service.spec.ts:103` — está **correta**. Não há nada a corrigir, nem por esta task nem por outra. **Não corrigir, por ninguém.**

O que estava errado era a citação em `animals.messages.ts`, porque *animals* é FEATURE-002, onde RNF-12 é "Escritas refletem rapidamente" e o idioma é RNF-22 — e essa já foi corrigida. Fica a lição de higiene, para uma fatia futura e não para esta: comentário que cita RNF de outra feature deveria trazer o prefixo (`RNF-22 da FEATURE-002`), porque o mesmo número significa três coisas diferentes nas três features deste módulo — na FEATURE-003, RNF-12 é "Total coerente com os filtros" e RNF-22 é "A grade tem estrutura semântica de lista".

#### As cinco emendas no texto da task

Todas aplicadas e **factualmente corretas**. Confirmei uma a uma, sem confiar no relato:

1. **`src/utils/age.ts` — a crítica.** O texto novo descreve a leitura assimétrica exatamente como o código a implementa, e a implementação é a **certa**: reexecutei a virada do ano e a prescrição antiga daria **3** onde a resposta correta é **2**. A emenda cumpre o que precisava cumprir — impedir que a próxima fatia "conserte" o código certo. ✅
2. **Tabela `## Files`** — 12ª linha presente, com a nota de custo do acoplamento a `~/config/env`. ✅
3. **`animals.messages.ts`** — quatro chaves autorizadas e a rastreabilidade trocada para **RNF-22**, que é de fato "Idioma" em `spec_context.md:1139` desta feature. ✅
4. **`animals.validators.ts`** — (a) exigência de `.strict()` removida e a razão registrada; (b) a forma prescrita agora é `z.coerce.number({ invalid_type_error })` + `superRefine` com *early return*, que é literalmente o que o código faz. A observação sobre `required_error` está correta e eu a verifiquei em 6.3. ✅
5. **`animals.controller.ts`** — **reproduzi o TS2769**. Um handler tipado com `ListAnimalsQuery` compila sozinho (`router.get('/', h)` passa) e **falha** montado ao lado das guardas: *"Type 'ParsedQs' is missing the following properties from type '{ page: number; pageSize: number; }'"*. A conversão é mesmo inevitável. ✅

#### Achados da Rodada 1 — situação

| # | Severidade | Situação |
|---|---|---|
| 1 | major | **Resolvido e verificado** (6.1, 6.2) |
| 2 | minor | **Resolvido** — `animals.messages.ts` cita RNF-22 |
| 3 | minor | **Resolvido** — comentário do índice descreve o `Incremental Sort` |
| 4 | minor | **Resolvido e verificado** — exemplo trocado para `?page=-1.5`, acumulação confirmada por execução |
| 5 | minor | **Resolvido** — 12ª linha na tabela *Files*, com o custo registrado |
| 6 | suggestion | **Atendido** — convenção do 29/02 no comentário de `aniversarioJaOcorreu` |
| 7 | suggestion | **Substituído pelo achado #9** — o comportamento real é pior do que "responde `200`" |
| 8 | suggestion | **Mantido** — a conversão continua e continua justificada (reproduzida nesta rodada) |

#### Veredicto

> **APROVADA.** 0 critical, 0 major. 1 minor (#9 — `?page=1e19` responde `500`), 2 suggestions (#10, #11).
>
> Nenhum achado desta rodada bloqueia o fechamento. O #9 não viola critério de aceite nenhum — a spec só fixa `page ≥ 1` —, não vaza informação e não é alcançável pela interface; mas é entrada de usuário virando `500`, e deve entrar como caso de teste na **TASK-BACKEND-011** (hoje `?page=1e19` → `500`) para que a decisão de dar ou não teto a `page` seja tomada de olhos abertos, e não descoberta em produção.
>
> **O cálculo de idade e o texto desta task agora concordam, e ambos estão certos.**

#### O que as TASK-007/008/009 e a TASK-011 herdam

**As fatias de escrita (007 a 009) herdam prontos e não devem recriar:**

- `PrismaAnimalRepository` com `withTransaction`, `AnimalWithRelations` e `INCLUIR_RELACOES` — as escritas releem o animal **dentro** da mesma transação, e é para isso que `withTransaction` existe. O segundo parâmetro do construtor (`ExecutorDeLote`) é `null` ali de propósito: lote aninhado é recusado pelo Prisma.
- `toAnimalResponse` — **ponto único** de serialização e **proibido de alterar**. A projeção campo a campo não é estilo: é o que impede o chip e o contato do proprietário de vazarem por padrão quando entrarem (RN-59).
- `animals.messages.ts` com **13 chaves** — **estender, nunca recriar**. As de escrita (`ANIMAL_STALE_UPDATE`, `CITY_NOT_FOUND`, …) entram por acréscimo, como esta fatia fez.
- `animal.errors.ts` — mesmo formato, construtor sem parâmetro, nome pela regra violada.
- `animals.routes.ts` e `animals.controller.ts` preparados para receber `POST /`, `PATCH /:id`, `PATCH /:id/status` e `DELETE /:id`, com a ordem `authenticate` → `authorizeRole('admin')` → `validateRequest` → handler já estabelecida.
- `buildPublicObjectUrl` em `src/infra/storage/object-path.ts`.
- **O padrão de validação que esta rodada consolidou**: para qualquer campo coagido, a mensagem PT-BR vai no **tipo base** (`invalid_type_error`), porque o `superRefine` roda depois e não alcança `NaN`; faixa e formato vão no `superRefine` com *early return*, para não duplicar item em `details`. Esse é o molde para os campos numéricos das escritas.
- **Atenção ao que NÃO é precedente**: a ausência de `.strict()` vale para a **query de leitura**. No **corpo** das escritas a recusa de chave extra continua obrigatória (RN-46), com a fábrica `.passthrough()` + `superRefine` — e é lá que `FIELD_NOT_ALLOWED` é consumida.

**A TASK-BACKEND-011 (testes) herda a lista do que precisa cobrir:**

- A tabela de bordas de query desta rodada — em especial que **toda** falha de `page`/`pageSize` sai em PT-BR, com **um** item por campo e o `field` certo; e que duas falhas simultâneas saem como **dois** itens, um por campo.
- A assimetria da idade, com os quatro cortes: virada 31/12→01/01, o próprio dia do aniversário, o 29/02 em ano não bissexto e a data futura devolvendo negativo.
- A paginação estável: 45 registros com o mesmo `createdAt`, três páginas, **duas passadas**, ids idênticos na mesma ordem.
- **CT-98 / RNF-11 medido com a aplicação junto do banco** — a medição da Rodada 1 (~2230 ms) foi dominada por ~800 ms de RTT até o *pooler* remoto e não julga a implementação.
- **Novo**: o achado #9, **já corrigido** nesta task por saturação do `skip` em `list-animals.service.ts` (`Math.min(..., Number.MAX_SAFE_INTEGER)`), sem teto em `page` e sem tocar em nenhuma das 13 chaves de mensagem. O que a 011 deve fixar: `?page=1e19`, `?page=9007199254740991`, `?page=460000000000000000`, `?page=470000000000000000` e `?page=99999999999999999999` respondem **`200`** com `items: []` e o `total` real — nunca `500` e nunca `400`, porque "página além do total" é resposta de negócio em qualquer magnitude.

**Verificação e limpeza**: todas as sondas desta revisão foram apagadas (`git status` traz apenas os 12 arquivos da entrega e o texto desta task). Banco restaurado ao estado inicial exato — `users 2 | refresh_tokens 8 | email_confirmation_tokens 1 | species 0 | states 27 | cities 5571 | animals 0 | animal_images 0`. Nenhum arquivo de código alterado pela revisão. `typecheck` `0`; suíte **314 testes / 0 falhas**.
