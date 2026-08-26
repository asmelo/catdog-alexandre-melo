# TASK-BACKEND-003 — `GET /api/catalog/animals`: rota pública, validação estrita e limitador

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-003-backend-catalog-animals-endpoint`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 3 of 11 — Endpoint público da vitrine
**Generated**: `2026-08-25`

---

## Context

Expõe a camada de dados da TASK-BACKEND-002 como o primeiro endpoint **anônimo de leitura** do produto fora do fluxo de autenticação. Duas coisas o distinguem de tudo o que já existe no backend: ele **não monta** `authenticate` nem `authorizeRole` (a ausência é o mecanismo — RN-01), e ele **recebe limitador de taxa**, contrariando o precedente das duas features anteriores deste módulo (Decisão F).

---

## Scope

**In:** `catalog.validators.ts` (Zod estrito), `catalog.messages.ts`, `services/list-public-animals.service.ts`, `catalog.controller.ts`, `catalog.routes.ts` com `GET /animals`, `catalogLimiter` em `rate-limit.middleware.ts`, e uma linha `router.use('/catalog', catalogRoutes)` em `src/routes/index.ts`.

**Out:**
- **Nenhum código de erro novo.** Só `VALIDATION_ERROR` (já existente) e `TOO_MANY_REQUESTS` (já produzido pelo limitador). Não criar `catalog.errors.ts` (CA-50).
- Não montar `authenticate` nem `authorizeRole` em nenhuma rota deste arquivo, nem "por garantia".
- Não implementar `/catalog/species` nem `/catalog/cities` (TASK-BACKEND-004) — mas o arquivo de rotas já nasce com o `Router` que as receberá.
- Não alterar nenhum endpoint existente, nenhum limitador existente e nenhuma mensagem existente.
- Nenhum verbo de escrita: o `Router` do catálogo só declara `GET` (RN-08).
- Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/catalog/catalog.validators.ts` | schema estrito da query |
| `create` | `src/domains/catalog/catalog.messages.ts` | textos de validação |
| `create` | `src/domains/catalog/services/list-public-animals.service.ts` | caso de uso da listagem |
| `create` | `src/domains/catalog/catalog.controller.ts` | fábrica do controlador |
| `create` | `src/domains/catalog/catalog.routes.ts` | rotas públicas |
| `modify` | `src/middlewares/rate-limit.middleware.ts` | limitador do catálogo |
| `modify` | `src/routes/index.ts` | monta /catalog |

---

## Implementation

### `src/domains/catalog/catalog.validators.ts` *(create)*
**Reference pattern**: `src/domains/auth/auth.validators.ts` (schemas Zod) + `src/middlewares/validate-request.middleware.ts` (fábrica de validação).

**Decisões já fechadas**:
- `listPublicAnimalsQuerySchema` é `z.object({...}).strict()`. **O `.strict()` é a materialização da RN-10**: `status` não precisa ser proibido por nome — ele simplesmente não existe no schema, e qualquer chave não prevista cai em "Campo não permitido nesta requisição.". Tornar o status inexprimível é mais forte do que validá-lo (CA-10, RNF-04, CT-24).
- Se o `validateRequest` em vigor só valida `body`, estendê-lo para aceitar `query` — **sem** alterar o comportamento de `body` de nenhuma rota existente. Alternativa aceitável: validar `req.query` dentro do controller e delegar o erro ao `next()`. O que **não** é aceitável é o controller ramificar por validação a mão.
- Campos: `search` `z.string().trim().max(120)` → transformar com `normalizeForSearch` e mapear cadeia vazia para `undefined` (RN-26, RN-27, CT-31 a CT-34). `speciesId`/`cityId` `z.string().uuid()`. `size` `z.enum(['pequeno','medio','grande'])`. `sex` `z.enum(['macho','femea'])`. `maxAgeYears` `z.coerce.number().int().min(0).max(30)`. `page` `z.coerce.number().int().min(1).default(1)`. `pageSize` `z.coerce.number().int().min(1).max(100).default(12)`. Todos `.optional()` exceto os dois com `default`.
- **`maxAgeYears` só é opcional, nunca com default**: `0` é valor válido e significativo ("menos de um ano"), e ausência significa "não aplicado". Um default de `0` inverteria o filtro (RN-41, CT-59, CT-60).
- `z.coerce.number()` aceita `"3.5"` como `3.5`; o `.int()` é o que recusa. Não trocar por `parseInt`, que truncaria em silêncio (CT-61).
- Cadeia vazia em `size`/`sex` é **recusada**, não tratada como ausência: o frontend omite o parâmetro quando o filtro não está aplicado (CT-45).
- Os valores do contrato são minúsculos sem acento; a conversão para o enum do Prisma (`PEQUENO`, `MACHO`) acontece no service, não aqui.
- Mapear `speciesId`/`cityId` malformado para `details: [{ field: "speciesId", message: "Identificador inválido." }]` (CT-49).

### `src/domains/catalog/catalog.messages.ts` *(create)*
**Reference pattern**: `src/domains/auth/auth.messages.ts`.
- Só os textos de validação deste domínio. **Não** replicar "Muitas tentativas. Aguarde alguns minutos e tente novamente." — ela já vive no limitador e duplicá-la criaria duas fontes de verdade para a mesma frase.

### `src/domains/catalog/services/list-public-animals.service.ts` *(create)*
**Reference pattern**: `src/domains/auth/services/*.service.ts` — uma classe por caso de uso, dependências injetadas por construtor, um método `execute()`.

**Decisões já fechadas**:
- `execute(query)` → traduz `size`/`sex` para os enums do Prisma, chama `listAvailableAnimals`, mapeia cada linha por `toPublicAnimal` e devolve `{ items, pagination }`.
- **Nenhuma regra de negócio nova aqui**: o recorte por status, a ordenação e os filtros já vivem na consulta (TASK-BACKEND-002). O service não filtra em memória nem recorta lista — fazer isso quebraria `total` e paginação (RN-11, RN-44).
- Não lança erro de domínio: as únicas falhas possíveis são validação (antes) e limitador (antes).

### `src/domains/catalog/catalog.controller.ts` *(create)*
**Reference pattern**: `src/domains/auth/auth.controller.ts` — fábrica `createCatalogController(deps)`, handlers assíncronos, **sem acesso a Prisma e sem regra**.
- O handler responde `200` com o envelope `{ items, pagination }` e define `Cache-Control: no-store` na resposta (RN-12, CA-12, CT-110). Um cache aqui exibiria animal já adotado a novo interessado — o pior defeito possível nesta tela.
- Erros vão ao `next()`; o `error-handler.middleware.ts` continua sendo o **único** lugar que monta corpo de erro.

### `src/domains/catalog/catalog.routes.ts` *(create)*
**Reference pattern**: `src/domains/auth/auth.routes.ts`.

**Decisões já fechadas**:
- `router.get('/animals', catalogLimiter, validarQuery(listPublicAnimalsQuerySchema), controller.listAnimals)`.
- **A ausência de `authenticate` e de `authorizeRole` é deliberada e precisa de comentário explícito no arquivo** — sem ele, a próxima pessoa a ler as rotas conclui que faltou e "corrige" (RN-01, RN-02, CA-01).
- O limitador vem **antes** do validador, pela mesma razão já registrada em `auth.routes.ts`: a requisição abusiva é barrada sem custo de parsing de schema.
- Apenas `GET`. Nenhum `POST`, `PATCH` ou `DELETE` neste `Router`, hoje ou depois (RN-08, CA-48).

### `src/middlewares/rate-limit.middleware.ts` *(modify)*
- Acrescentar `export const catalogLimiter` usando a fábrica `criarLimitador` já existente. **Nenhum mecanismo novo**: mesma `MemoryStore`, mesmo `standardHeaders: false`, mesmo desligamento por `RATE_LIMIT_ENABLED`, mesmo `TooManyRequestsError` no envelope padrão (Decisão F, RN-66, RN-67).
- Janela e limite: **60 requisições por minuto por IP**, chave default da lib (o IP já tratado para IPv6). Não usar chave com corpo — a requisição é `GET` sem corpo.
- Comentário obrigatório justificando por que o argumento que dispensou o limitador nas FEATURE-001/002 deste módulo **não se transfere**: aqui não há credencial a exigir, é leitura anônima, e a busca por conteúdo em qualquer posição é a consulta mais cara do catálogo e não se beneficia de índice (Decisão B).
- Dimensionamento: 60/min cobre folgadamente a navegação humana com digitação e troca de filtros, inclusive vários visitantes atrás de uma mesma saída de rede (CT-109, RNF-05).

### `src/routes/index.ts` *(modify)*
- Uma linha: `router.use('/catalog', catalogRoutes)`. Nada mais neste arquivo muda.

---

## Acceptance Criteria

- [ ] **Given** requisição sem cabeçalho `Authorization`, **When** `GET /api/catalog/animals`, **Then** `200` com os animais disponíveis — **nunca** `401` nem `403` (CA-01, RN-02, CT-02, CT-106).
- [ ] **Given** as mesmas consultas feitas anonimamente, com token de `cliente` e com token de `admin`, **When** comparadas, **Then** os três corpos são **idênticos** (CA-03, RN-03, CT-04).
- [ ] **Given** `?status=adotado`, `?status=disponivel` e `?status=`, **When** enviados, **Then** os três respondem `400 VALIDATION_ERROR` com `details[0].field = "status"` e mensagem de campo não permitido; nenhum item é devolvido (CA-10, RNF-04, CT-24, QA-49).
- [ ] **Given** um parâmetro qualquer não previsto (`?ordenacao=nome`), **When** enviado, **Then** `400 VALIDATION_ERROR` por campo não permitido (RN-16, CT-87 lado API).
- [ ] **Given** `size=gigante`, `size=` e `size=1`, **When** enviados, **Then** `400` nos três (RN-34, CT-45).
- [ ] **Given** `sex=outro`, **Then** `400` (CT-46).
- [ ] **Given** `maxAgeYears=-1`, `=31`, `=3.5` e `=abc`, **Then** `400` nos quatro; **Given** `=0` e `=30`, **Then** `200` (CA-31, CT-59, CT-61, CT-62).
- [ ] **Given** `maxAgeYears` omitido e `maxAgeYears=` vazio, **Then** o filtro não é aplicado nos dois casos — comportamento distinto de `=0` (CT-60).
- [ ] **Given** `search` com 120 caracteres, **Then** `200`; com 121, **Then** `400` (RN-27, CT-33, CT-34).
- [ ] **Given** `search="   "`, **Then** `200` com a lista completa — busca não aplicada (RN-26, CT-31).
- [ ] **Given** `search="campo   magro"`, **Then** encontra "Campo Magro" — espaços internos colapsados (CT-32).
- [ ] **Given** `speciesId=abc` e `cityId=123`, **Then** `400` com `details` apontando o parâmetro (CT-49).
- [ ] **Given** um `speciesId` UUID bem formado de espécie inexistente, **Then** `200` com `items: []` e `total: 0` — **nunca** `404` (CA-36, RN-51, CT-47, CT-48).
- [ ] **Given** `pageSize=0` e `pageSize=101`, **Then** `400`; **Given** o parâmetro omitido, **Then** 12 itens por página (CA-14, RN-17, CT-77, CT-78).
- [ ] **Given** `page=99` com uma única página existente, **Then** `200` com `items: []`, sem erro (RN-20, CT-76).
- [ ] **Given** busca, espécie, porte, sexo, idade máxima e cidade enviados juntos, **Then** apenas os animais que satisfazem **todos** os critérios (CA-22, CT-42); **Given** cada um omitido por vez, **Then** o critério omitido deixa de restringir (CT-43).
- [ ] **Given** o status de um animal alterado na área administrativa, **When** a consulta pública é repetida, **Then** a mudança já é refletida e a resposta traz `Cache-Control: no-store` (CA-12, RN-12, CT-22, CT-23, CT-110).
- [ ] **Given** `RATE_LIMIT_ENABLED=true` e repetição acima de 60/min da mesma origem, **Then** `429` no envelope `{ error: { code, message } }` com mensagem em PT-BR; **Given** `RATE_LIMIT_ENABLED=false`, **Then** nenhum `429` (CA-49, RN-66, RN-67, CT-108).
- [ ] **Given** uso humano normal da vitrine — digitação e troca de filtros —, **Then** nenhuma resposta `429` (CT-109).
- [ ] **Given** o catálogo de códigos de erro antes e depois desta task, **When** comparado, **Then** é o mesmo — nenhum código novo (CA-50, RNF-31).
- [ ] **Given** `GET /api/animals` sem credencial e com token de `cliente`, **Then** `401` e `403` como antes — a existência da rota pública não afrouxou nada (CT-107, CT-105, QA-48).
- [ ] **Given** o `Router` do catálogo, **When** inspecionado, **Then** só declara verbos `GET` e nenhum middleware de autenticação ou de role (RN-01, RN-08).

---

## API Notes

- **Endpoint**: `GET /api/catalog/animals` — público, somente leitura, `200 OK`.
- **Query** (todos opcionais): `search` (≤120), `speciesId` (UUID), `size` (`pequeno|medio|grande`), `sex` (`macho|femea`), `maxAgeYears` (0–30), `cityId` (UUID), `page` (≥1, padrão 1), `pageSize` (1–100, padrão 12).
- **Sucesso**: `{ items: PublicAnimal[], pagination: { page, pageSize, total } }`.
- **Erros**: `400 VALIDATION_ERROR` (faixa, conjunto, formato ou campo não permitido); `429 TOO_MANY_REQUESTS`. **Não existe `401` nem `403` neste endpoint.**

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (porta `PublicCatalogRepository`, `toPublicAnimal`, tipos), TASK-BACKEND-001 (`normalizeForSearch`).
- **Blocks**: TASK-BACKEND-004 (acrescenta rotas ao mesmo `Router` e controller), TASK-BACKEND-005, TASK-FRONTEND-007.
