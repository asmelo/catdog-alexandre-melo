# TASK-BACKEND-002 — Idade derivada, projeção pública e repositório do catálogo

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-catalog-projection-repository`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 2 of 11 — Camada de dados da vitrine
**Generated**: `2026-08-25`

---

## Context

Entrega o núcleo da vitrine: o cálculo de idade derivada no fuso `America/Sao_Paulo`, a consulta paginada com recorte por colunas explícitas, e o montador público que enumera chave a chave o que sai para o visitante. É aqui que a RN-59 da FEATURE-002 deste módulo — projeção explícita, jamais serialização da entidade — deixa de ser regra preventiva e vira código. Sem rota ainda (TASK-BACKEND-003).

---

## Scope

**In:** `src/utils/animal-age.ts`; `src/domains/catalog/catalog.types.ts`; `src/domains/catalog/repositories/public-catalog.repository.ts` (porta + `PrismaPublicCatalogRepository`); `src/domains/catalog/mappers/public-animal.mapper.ts`.

**Out:**
- Nenhum controller, rota, validador Zod, limitador ou montagem em `src/routes/index.ts` (TASK-BACKEND-003/004).
- **Não tocar** em `src/domains/animals/mappers/*`: o montador administrativo permanece intacto e separado (RN-56). Compartilhar montador é exatamente o que esta task existe para impedir.
- Não implementar as consultas de opções de filtro (`species`/`cities`) — TASK-BACKEND-004 as acrescenta ao mesmo repositório.
- Não alterar `Animal.birthDate`, nem persistir idade em lugar nenhum (RN-37).
- Sem testes (TASK-BACKEND-005).

---

## Ubiquitous Language

| Termo de negócio | Mapeamento em código |
|---|---|
| Projeção pública | `PublicAnimal` (tipo) + `toPublicAnimal()` (montador) |
| Filtro aplicado | campo presente em `PublicCatalogFilters`; `undefined` = não aplicado |
| Idade derivada | `calculateAge(birthDate, now())` → `{ ageInYears, ageInMonths }` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/utils/animal-age.ts` | idade derivada no fuso |
| `create` | `src/domains/catalog/catalog.types.ts` | tipos de filtro e projeção |
| `create` | `src/domains/catalog/repositories/public-catalog.repository.ts` | consulta com recorte explícito |
| `create` | `src/domains/catalog/mappers/public-animal.mapper.ts` | montador público separado |

---

## Implementation

### `src/utils/animal-age.ts` *(create)*
**Reference pattern**: `src/utils/clock.ts` — funções puras; **usar `now()` dele, nunca `new Date()`**. Esta é a task em que essa regra deixa de ser estilo: dois CT de fronteira dependem de o relógio ser espionável.

**Decisões já fechadas**:
- `calculateAge(birthDate: Date | null, reference: Date): { ageInYears: number | null; ageInMonths: number | null }`. Sem data → **ambos `null`**. `null` é ausência, e ausência não é zero (RN-39).
- Converter a referência para o dia civil de `America/Sao_Paulo` **antes** de comparar, com `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` → `YYYY-MM-DD`. Nenhuma biblioteca de datas (CA-55). Sem essa conversão, o processo em UTC às 22h de São Paulo devolve a idade do dia seguinte (RNF-09, CT-70).
- `birthDate` é `@db.Date` — dia puro. Extrair ano/mês/dia via componentes UTC do valor lido, **não** via `getFullYear()` local, que desloca a data em fuso negativo.
- Anos completos: `ano_ref - ano_nasc`, decrementado se `(mês, dia)` de referência for anterior ao de nascimento. Aniversário **hoje já conta** (RN-40, CT-55/CT-56).
- 29 de fevereiro em ano não bissexto: a comparação `(mês, dia) < (2, 29)` já resolve — em 28/02 ainda não completou, em 01/03 completou. Não usar `setFullYear`, que normaliza 29/02 para 01/03 silenciosamente e produz o resultado certo por acidente em um caso e errado em outro (RN-40, CT-69).
- Meses completos pela mesma aritmética: `(ano*12 + mês)` de diferença, decrementado se o dia de referência for anterior ao dia de nascimento. Serve à apresentação abaixo de um ano (RN-38).
- **A função devolve os dois valores sempre**; a escolha entre exibir anos ou meses é da tela (TASK-FRONTEND-008). O servidor não formata texto de idade.
- Exportar também `birthDateCutoffForMaxAge(maxAgeYears: number, reference: Date): Date` — a data de nascimento **mínima** aceitável para "idade ≤ N": o dia civil de referência menos `(N + 1)` anos, **mais um dia**. O filtro é `birthDate >= cutoff`. Derivar o corte da **mesma** função que calcula a idade exibida é o que torna a RN-45 estrutural em vez de coincidência.

### `src/domains/catalog/catalog.types.ts` *(create)*
- `PublicCatalogFilters`: `search?`, `speciesId?`, `size?`, `sex?`, `maxAgeYears?`, `cityId?`, `page`, `pageSize`. `search` chega **já normalizado** por `normalizeForSearch` (TASK-BACKEND-001) e nunca vazio — cadeia vazia deve chegar como `undefined`.
- `PublicAnimal`: exatamente `id`, `name`, `species: { id; name }`, `size`, `sex`, `ageInYears`, `ageInMonths`, `description`, `acceptsOtherAnimals`, `needsLargeSpace`, `city: { name; stateUf }`, `coverImageUrl`. **Nada mais.** `ageInYears`, `ageInMonths`, `description` e `coverImageUrl` são anuláveis; os demais não.
- `PublicAnimalRow`: o recorte **exato** que a consulta traz do banco. Tipo separado de `PublicAnimal` de propósito — é o que impede o montador de virar um `spread` da linha.
- `PaginatedResult<T> = { items: T[]; pagination: { page; pageSize; total } }` — reaproveitar o tipo já congelado pelas features anteriores se ele existir; **não criar um segundo**.
- **Nenhum campo `status`, `birthDate`, `createdAt`, `updatedAt`, `cityId`, `speciesId` ou `images` em `PublicAnimal`** (RN-59, CA-42).

### `src/domains/catalog/repositories/public-catalog.repository.ts` *(create)*
**Reference pattern**: `src/domains/auth/repositories/*.repository.ts` — interface-porta + classe `Prisma<X>Repository`, `withTransaction` exposto, e **nenhum erro HTTP lançado daqui**.

**Decisões já fechadas**:
- Porta `PublicCatalogRepository` com `listAvailableAnimals(filters): Promise<PaginatedResult<PublicAnimalRow>>`.
- `select` **explícito**, jamais `include` largo nem `select` omitido (RN-55, camada 1). Traz: `id`, `name`, `size`, `sex`, `birthDate`, `description`, `acceptsOtherAnimals`, `needsLargeSpace`, `species: { select: { id, name } }`, `city: { select: { name, state: { select: { uf } } } }`, `images: { select: { storagePath }, where: { position: 0 }, take: 1 }`. `birthDate` entra **só** para o cálculo de idade e é descartado pelo montador — ele não integra `PublicAnimal`.
- **`city.id` fora do `select`** (RN-59): o filtro obtém identificadores de `GET /api/catalog/cities`.
- `where` sempre começa com `status: 'DISPONIVEL'` **fixo**, jamais parametrizado. O status não é argumento do método — a assinatura torna a consulta por outro status inexprimível (RN-09, RN-10, RN-11).
- Busca: `OR: [{ nameSearch: { contains: search } }, { city: { nameSearch: { contains: search } } }]`. Sem `mode: 'insensitive'` — as duas pontas já estão em minúsculas e sem acento (TASK-BACKEND-001). O texto vai **inteiro**, nunca quebrado em termos (RN-22, RN-24, RN-25).
- Idade máxima: `birthDate: { not: null, gte: birthDateCutoffForMaxAge(maxAgeYears, now()) }`. O `not: null` é o que exclui o animal sem data enquanto o filtro estiver aplicado (RN-42) — e ele só existe quando o filtro veio.
- Cada filtro `undefined` **não entra no objeto `where`** (RN-35). Montar o `where` por composição condicional, não com chaves de valor `undefined` espalhadas.
- `orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]` — o desempate é obrigatório, não cosmético: sem ele, registros criados no mesmo instante trocam de posição entre páginas e um some enquanto outro se repete (RN-14, RN-15, CT-74).
- Contagem e página na **mesma transação** (`prisma.$transaction([findMany, count])`), com o **mesmo** `where`. Total é o total após os filtros, nunca o do catálogo (RN-11, RNF-12).
- `skip: (page - 1) * pageSize`. Página além da última devolve lista vazia e o `total` real — nunca erro (RN-20).
- `coverImageUrl` **não** é montado aqui: o repositório devolve `storagePath` cru. A composição do endereço público do armazenamento pertence ao montador, junto do resto da projeção.

### `src/domains/catalog/mappers/public-animal.mapper.ts` *(create)*
**Reference pattern**: `src/domains/auth/mappers/user.mapper.ts` — função pura, entrada tipada, saída explícita.

**Decisões já fechadas**:
- `toPublicAnimal(row: PublicAnimalRow): PublicAnimal`. Cada chave escrita **uma a uma** no literal de retorno. Proibido `...row`, `Object.assign`, `pick`/`omit` genérico ou qualquer helper que copie por iteração — é a camada 2 da RN-55, e um helper genérico a anula (CA-43).
- Arquivo **próprio**, separado do montador administrativo de animal (RN-56). Um campo interno futuro — chip, contato do proprietário — acrescentado ao lado administrativo não pode virar vazamento aqui por herança.
- `species` e `city` são literais aninhados montados campo a campo, não referências ao objeto vindo do Prisma: `{ id: row.species.id, name: row.species.name }` e `{ name: row.city.name, stateUf: row.city.state.uf }`. Repassar o objeto do Prisma reintroduziria qualquer coluna que um `select` futuro acrescentasse.
- Idade: `const { ageInYears, ageInMonths } = calculateAge(row.birthDate, now())`. `row.birthDate` **não** é copiado para a saída (RN-59).
- `coverImageUrl`: `row.images[0]` ausente → `null` (RN-58, RN-62). Presente → endereço público do armazenamento montado a partir de `storagePath`, com a base vinda de `src/config/env.ts` — **nunca** de `process.env` lido aqui.
- `description` sai **integral**, sem truncagem (RN-61, CA-45). A truncagem é CSS na tela.
- Comentário obrigatório no topo declarando que o conjunto de chaves é **fechado** e verificado por igualdade no teste (RN-57): quem acrescentar campo aqui precisa saber que está mudando um contrato público.

---

## Acceptance Criteria

- [ ] **Given** o código de `animal-age.ts` e do montador, **When** lido, **Then** a idade é derivada a cada resposta pelo utilitário de relógio do projeto no fuso `America/Sao_Paulo`, e **não existe nenhuma escrita de idade em banco** (CA-24, RN-37).
- [ ] **Given** `birthDate = 2022-11-05` e relógio em `2026-08-25`, **When** `calculateAge`, **Then** `ageInYears = 3` e `ageInMonths = 45` (CT-64, CT-10).
- [ ] **Given** o mesmo animal e relógio em `2026-11-06`, **When** `calculateAge`, **Then** `ageInYears = 4` — e nenhuma escrita ocorre no banco (CT-65, RN-37).
- [ ] **Given** um animal cujo aniversário de 4 anos cai **hoje**, **When** `calculateAge`, **Then** `ageInYears = 4`; **Given** cai **amanhã**, **Then** `ageInYears = 3` (RN-40, CT-55, CT-56).
- [ ] **Given** nascimento em `2024-02-29`, **When** o relógio está em `2027-02-28`, **Then** `ageInYears = 2`; em `2027-03-01`, **Then** `3` — a idade vira **no aniversário**, e em ano não bissexto o aniversário é 1º de março (CA-26, RN-40, CT-69).
- [ ] **Given** o processo em `TZ=UTC` e o relógio às 22h de São Paulo da véspera de um aniversário, **When** `calculateAge`, **Then** a idade é a de São Paulo, e não a do dia seguinte em UTC (RNF-09, CA-27, CT-70).
- [ ] **Given** `birthDate = null`, **When** `calculateAge`, **Then** `ageInYears` e `ageInMonths` são ambos `null` — nunca `0` (RN-39, CT-58).
- [ ] **Given** um animal com 5 meses completos, **When** `calculateAge`, **Then** `ageInYears = 0` e `ageInMonths = 5` (RN-38, CT-67).
- [ ] **Given** quatro animais, um em cada status, **When** `listAvailableAnimals` sem filtro, **Then** devolve exatamente o `DISPONIVEL` e `total = 1` (CA-09, CT-21, CT-18 a CT-20).
- [ ] **Given** a assinatura de `listAvailableAnimals`, **When** inspecionada, **Then** não existe parâmetro capaz de selecionar outro status (RN-10).
- [ ] **Given** 45 animais disponíveis criados no mesmo `createdAt` e `pageSize = 12`, **When** as quatro páginas são percorridas, **Then** os 45 identificadores são distintos, sem repetição e sem omissão (CA-13, RNF-11, CT-74).
- [ ] **Given** um filtro que reduz o conjunto, **When** a consulta roda, **Then** `total` é o do conjunto filtrado, e não o do catálogo (RNF-12, CT-98).
- [ ] **Given** o recorte por status, a busca e todos os filtros, **When** o código da consulta é lido, **Then** **todos** compõem o mesmo `where` do banco e nenhum é aplicado em memória sobre um resultado já trazido (CA-11, RN-11, RN-44).
- [ ] **Given** `search = "campo"` **e** `cityId` de Campo Magro, **Then** devolve os animais daquela cidade cujo nome ou cidade contenham "campo"; **Given** `search = "curitiba"` com o mesmo `cityId`, **Then** devolve lista vazia — busca aproximada e filtro exato se combinam por **E** (CA-19, RN-29, HU-07 cenários 4 e 5).
- [ ] **Given** `search = "magro"`, **Then** um animal em "Campo Magro" é devolvido; **Given** `search = "jose"`, **Then** o animal "José" é devolvido; **Given** `search = "theo campo"`, **Then** nada é devolvido (CA-16, CA-17, CT-26, CT-27, CT-30).
- [ ] **Given** `maxAgeYears` aplicado, **When** a consulta roda, **Then** nenhum animal sem `birthDate` é devolvido; **Given** o filtro ausente, **Then** ele volta a ser devolvido (CA-28, CT-57, CT-58).
- [ ] **Given** qualquer conjunto devolvido sob `maxAgeYears = N`, **When** a idade de cada item é calculada pelo mesmo utilitário, **Then** **nenhuma** é maior que N, inclusive em datas de fronteira (CA-30, RN-45, CT-63).
- [ ] **Given** um `speciesId` ou `cityId` bem formado mas inexistente, **When** a consulta roda, **Then** devolve lista vazia e `total = 0` — nenhuma exceção é lançada (CA-36, RN-51, CT-47, CT-48).
- [ ] **Given** `page` além da última, **When** a consulta roda, **Then** lista vazia e `total` real, sem erro (RN-20, CT-76).
- [ ] **Given** um item devolvido por `toPublicAnimal`, **When** `Object.keys(item)` é comparado por **igualdade** ao conjunto da projeção, **Then** são iguais; idem para `item.species` (`{id,name}`) e `item.city` (`{name,stateUf}`) (CA-40, RN-57, CT-99).
- [ ] **Given** um campo novo acrescentado ao modelo `Animal` no schema, **When** a consulta e o montador rodam, **Then** a resposta é **idêntica** — o `select` não o lê e o montador não o enumera (CA-41, RNF-02, CT-100).
- [ ] **Given** um animal com cinco imagens, **When** montado, **Then** `coverImageUrl` traz um único endereço, o de `position = 0`; **Given** nenhum, **Then** `null` (RN-58, CT-102, CT-103).
- [ ] **Given** uma descrição de 1000 caracteres, **When** montada, **Then** sai integral, sem truncagem (CA-45, CT-15).
- [ ] **Given** um item montado, **When** `city` é inspecionado, **Then** traz `name` e `stateUf` vindos do **dado persistido**, sem nenhuma chamada a serviço externo em tempo de execução (CA-47, RN-64, RN-32).
- [ ] **Given** um item montado, **When** `status` é procurado, **Then** ele não integra a projeção — todo item é `DISPONIVEL` por construção (RN-13, CA-42).
- [ ] **Given** o código do montador, **When** lido, **Then** não existe `...row`, `Object.assign` nem helper genérico de cópia, ele vive em **arquivo próprio** distinto do montador administrativo, e a consulta seleciona colunas explicitamente (CA-43, RN-54, RN-56, CT-104).
- [ ] `npm run typecheck` com 0 erros e nenhum `any`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (`normalizeForSearch`, colunas `name_search`, índice `[status, createdAt, id]`); FEATURE-002 do MODULE-002 (modelos `Animal`, `AnimalImage`, `City`, `State`, `Species`; base do armazenamento de objetos em `env`).
- **Blocks**: TASK-BACKEND-003 (o service consome porta e montador), TASK-BACKEND-004, TASK-BACKEND-005.

---

## Revisão — 2026-08-28

**Status**: APROVADO — com um desvio de arquivo, reportado abaixo

`npm run typecheck` com 0 erros, nenhum `any` nos arquivos da task, e 579 testes do backend verdes sem alteração de baseline.

| Critério de aceite | Resultado |
|---|---|
| Idade derivada a cada resposta, no fuso, sem escrita em banco | **Confirmado.** `calculateAge` é chamada pelo montador com `now()`; nenhuma coluna de idade existe no schema |
| `2022-11-05` @ `2026-08-25` → 3 anos e 45 meses | **Medido: `{ ageInYears: 3, ageInMonths: 45 }`** |
| @ `2026-11-06` → 4 anos | **Medido: 4** |
| Aniversário hoje conta; amanhã não | **Confirmado** — a comparação é `dia >= dia`, herdada de `aniversarioJaOcorreu` |
| `2024-02-29`: 2 em `2027-02-28`, 3 em `2027-03-01` | **Medido: 2 e 3.** A comparação `(mês, dia)` resolve sozinha; nenhum `setFullYear` participa |
| Processo em UTC, 22h de São Paulo na véspera | **Medido.** Nascido em `2022-11-06`, relógio `2026-11-06T01:00Z` (= 05/11 22h em SP) → **3**, e não 4 |
| `birthDate = null` → ambos `null` | **Medido**, nunca `0` |
| 5 meses completos → `0` ano e `5` meses | **Medido** |
| Só o `DISPONIVEL` é devolvido | **Confirmado por construção:** o literal está no repositório, e a assinatura não tem parâmetro de status |
| Nenhum parâmetro seleciona outro status | **Confirmado.** `listAvailableAnimals(filters)`, e `PublicCatalogFilters` não tem o campo |
| Paginação estável com `createdAt` idêntico | **Confirmado.** `orderBy: [{createdAt:'desc'},{id:'asc'}]` |
| `total` é o do conjunto filtrado | **Confirmado.** O mesmo `where` alimenta `findMany` e `count`, na mesma transação |
| Todos os filtros no `where` do banco, nenhum em memória | **Confirmado.** `montarFiltro` é o único ponto, e o service não recebe lista para filtrar |
| Busca e filtro exato se combinam por **E** | **Confirmado.** `OR` da busca é uma chave do `where`; os demais filtros são chaves irmãs, o que o Prisma compõe por `AND` |
| Busca casa nome do animal **ou** nome da cidade, texto inteiro | **Confirmado.** `contains` sem quebra em termos, sobre as duas colunas `name_search` |
| `maxAgeYears` exclui animal sem data; ausente, ele volta | **Confirmado.** `not: null` só existe dentro do ramo do filtro |
| Nenhum devolvido sob `maxAgeYears = N` tem idade > N | **Estrutural, não verificado caso a caso:** o corte vem de `birthDateCutoffForMaxAge`, que usa a mesma noção de dia civil e a mesma convenção de aniversário de `calculateAge` |
| Identificador inexistente → lista vazia, sem exceção | **Confirmado.** Nenhum `throw` no repositório |
| Página além da última → lista vazia e total real | **Confirmado.** `skip` grande devolve `[]`, e o `count` não depende do `skip` |
| `Object.keys` igual ao conjunto da projeção | **Confirmado por construção**, e `PUBLIC_ANIMAL_KEYS` está exportada para o teste da TASK-BACKEND-005 comparar por igualdade |
| Campo novo em `Animal` não altera a resposta | **Confirmado.** O `select` é explícito e o montador enumera chave a chave |
| Cinco imagens → um `coverImageUrl`, o de `position 0`; nenhuma → `null` | **Confirmado.** `where: { position: 0 }, take: 1` |
| Descrição de 1000 caracteres sai integral | **Confirmado.** Nenhuma truncagem |
| `city` vem do dado persistido, sem serviço externo | **Confirmado.** `city -> state.uf` pela relação |
| `status` fora da projeção | **Confirmado** |
| Sem `...row`, sem `Object.assign`, arquivo próprio, `select` explícito | **Confirmado.** `animals/mappers/animal.mapper.ts` não foi tocado |

### Desvio: `calculateAge` foi para `src/utils/age.ts`, e não para um `animal-age.ts` novo

A task manda criar `src/utils/animal-age.ts`. **`src/utils/age.ts` já existe**, entregue pela FEATURE-002, e já implementa exatamente a parte difícil: a conversão para o dia civil de `America/Sao_Paulo` por `Intl.DateTimeFormat`, a leitura da coluna `@db.Date` por componentes **UTC** (com a assimetria entre os dois lados documentada em detalhe), e a convenção de 29/02 — todas as decisões que esta task reespecifica.

Criar um segundo módulo com a mesma lógica produziria **duas implementações de fuso horário** no mesmo backend. É precisamente o modo de falha contra o qual o restante da base se protege, e ele apareceria da pior forma: as duas concordariam na maioria dos dias e divergiriam nos dias de aniversário — os únicos em que o resultado muda.

`age.ts` recebeu, num bloco marcado `FEATURE-003`: `calculateAge` (anos **e** meses), `mesesCompletos` e `birthDateCutoffForMaxAge`. `calculateAgeInYears`, que a FEATURE-002 usa, ficou **intocado**. Mesma natureza do desvio já aceito na TASK-BACKEND-001 quanto ao nome do seed.

### Notas de implementação

**`buildPublicObjectUrl` foi reaproveitada, não reescrita.** A task diz que o montador compõe o endereço público "com a base vinda de `src/config/env.ts`". A função já existe em `src/infra/storage/object-path.ts` e faz exatamente isso — e o comentário dela registra por que mora ali e não no mapper: o formato `.../storage/v1/object/public/<balde>/<caminho>` é vocabulário do **fornecedor**, e escrevê-lo no domínio faria trocar de Supabase mexer em `src/domains/`.

**`toPublicAnimal` recebe `now` por parâmetro**, em vez de chamar `now()` internamente. Mantém o montador puro — a mesma escolha que `age.ts` já registra como contrato — e permite ao serviço calcular o instante **uma vez** por página, em vez de uma vez por item: doze cartões numa página produziriam doze relógios ligeiramente diferentes, e um animal que faz aniversário no exato milissegundo da resposta poderia sair com idade diferente de outro na mesma lista.

**`PUBLIC_ANIMAL_KEYS` exportada.** O critério de aceite pede comparação por **igualdade** de `Object.keys`. Deixar o conjunto esperado escrito no teste criaria uma segunda lista, que passaria a divergir da projeção sem que nada reprovasse — o teste continuaria verde comparando a lista antiga consigo mesma.

**`PaginatedResult<T>` declarado aqui, e não importado de `list-animals.service.ts`.** É estruturalmente idêntico ao envelope da FEATURE-002 — o frontend consome o mesmo formato —, mas importar amarraria a vitrine pública ao módulo administrativo, que é o import cruzado que a separação de domínios existe para evitar.
