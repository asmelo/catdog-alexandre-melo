# TASK-FRONTEND-007 — Serviço de API do catálogo e montagem da cadeia de parâmetros

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-007-frontend-catalog-api-service`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 7 of 11 — Camada de acesso à API pública
**Generated**: `2026-08-25`

---

## Context

Três funções, uma por endpoint público, no formato já estabelecido por `auth-api.ts`. Duas decisões da spec vivem inteiras aqui: a cadeia de parâmetros é montada **neste arquivo**, e não no cliente HTTP compartilhado (Decisão E); e as chamadas da vitrine **não podem entrar no ciclo de renovação de sessão** (RN-05).

---

## Scope

**In:** `src/services/api/catalog-api.ts` com `listPublicAnimals`, `listCatalogSpecies` e `listCatalogCities`; os tipos do contrato público.

**Out:**
- **Não alterar nenhuma linha de `src/services/api/http-client.ts`** (Decisão E, CA-55). Ele abriga a fila single-flight de renovação e é o ponto de maior risco de regressão do frontend. A FEATURE-002 deste módulo o alterou porque envio de arquivo não tem alternativa; cadeia de parâmetros tem.
- Não tratar erro, não desembrulhar a resposta de sucesso, não guardar estado, não fazer debounce, não descartar resposta fora de ordem — tudo isso é da tela (TASK-FRONTEND-009/010).
- Não traduzir parâmetro de PT-BR para inglês aqui: este módulo recebe os filtros **já saneados e já em inglês**. A tradução do endereço da página é da TASK-FRONTEND-009.
- Não criar uma segunda função de query string se a FEATURE-002 deste módulo já tiver entregue uma — **reaproveitar, coordenar, não duplicar**.
- Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/services/api/catalog-api.ts` | uma função por endpoint |

---

## Implementation

### `src/services/api/catalog-api.ts` *(create)*
**Reference pattern**: `src/services/api/auth-api.ts` — uma função por endpoint, `import type` para os tipos, `request<T>` do `http-client`, nenhum `try/catch`, nenhum estado.

**Decisões já fechadas**:

- **Tipos do contrato**, espelhando a projeção pública campo a campo (o conjunto é fechado — RN-57):
  `PublicAnimal = { id; name; species: { id; name }; size: 'pequeno'|'medio'|'grande'; sex: 'macho'|'femea'; ageInYears: number | null; ageInMonths: number | null; description: string | null; acceptsOtherAnimals: boolean; needsLargeSpace: boolean; city: { name; stateUf }; coverImageUrl: string | null }`.
  `CatalogSpeciesOption = { id; name }`; `CatalogCityOption = { id; name; stateUf }`.
  `PaginatedResponse<T> = { items: readonly T[]; pagination: { page; pageSize; total } }`.
  Sob `exactOptionalPropertyTypes`, campos anuláveis são `| null`, **não** `?` — o backend envia a chave com valor `null`, não a omite.

- **Cadeia de parâmetros com `URLSearchParams`**, jamais concatenação de texto. A busca desta feature é justamente por texto acentuado e com espaços; concatenar erra a codificação (Decisão E).

- **Parâmetro vazio, `undefined`, `null` ou cadeia vazia não é acrescentado.** Um filtro não aplicado não deixa parâmetro (RN-35, RN-48). Cuidado explícito com `maxAgeYears`: `0` é valor válido e um teste de veracidade (`if (valor)`) o descartaria — comparar contra `undefined`, nunca por falsidade.

- **`skipRefresh: true` em todas as três chamadas** (RN-05, CA-04). O `RequestOptions` do cliente HTTP já oferece a opção — nenhuma alteração nele é necessária. Sem ela, uma credencial vencida no navegador faria a vitrine disparar renovação de sessão e, na falha, redirecionar o visitante para o login: a vitrine é pública e não pode depender do desfecho de nenhuma renovação (CT-03, RNF-13, QA-01).

- Nenhuma das três funções envia cabeçalho `Authorization`, e nenhuma exige que exista access token. `status === 'anonymous'` é o caso normal.

- Caminhos: `/catalog/animals?<query>`, `/catalog/species`, `/catalog/cities`. Prefixo `/api` conforme a base já configurada em `~/config/env`.

- `listPublicAnimals(filters)` recebe um objeto com as chaves **em inglês** do contrato — `search`, `speciesId`, `size`, `sex`, `maxAgeYears`, `cityId`, `page`, `pageSize` — e devolve `Promise<PaginatedResponse<PublicAnimal>>`. As chaves são copiadas **uma a uma** para a query, e não iteradas genericamente: o backend recusa qualquer parâmetro não previsto com `400`, então um campo que vazasse do estado da tela quebraria a listagem em vez de ser ignorado. É o mesmo motivo pelo qual `register` em `auth-api.ts` copia campo a campo em vez de repassar o objeto.

- `pageSize` **não** é enviado quando a tela usa o padrão: o servidor já usa 12. Enviá-lo redundantemente polui a chamada sem ganho.

- Proibido `any` e proibido `as` sobre a resposta: os tipos declarados **são** o contrato; se ele mudar, a mudança é deliberada e aparece aqui.

---

## Acceptance Criteria

- [ ] **Given** filtros com `search: 'são paulo'`, **When** a chamada é montada, **Then** a query traz `search=s%C3%A3o+paulo` corretamente codificado, e nenhuma concatenação manual existe no arquivo.
- [ ] **Given** filtros com `maxAgeYears: 0`, **When** a query é montada, **Then** `maxAgeYears=0` **está presente** — `0` é filtro aplicado, não ausência (RN-41, CT-59).
- [ ] **Given** filtros com `search: ''`, `speciesId: undefined` e `size: undefined`, **When** a query é montada, **Then** nenhum dos três aparece na cadeia (RN-35, RN-48).
- [ ] **Given** nenhum filtro e `page: 1`, **When** a query é montada, **Then** ela fica vazia ou traz apenas `page=1` — nunca parâmetros de valor vazio.
- [ ] **Given** um access token vencido presente no armazenamento, **When** qualquer das três funções é chamada e o servidor responde, **Then** **nenhuma** requisição a `/auth/refresh` é disparada e nenhum redirecionamento ao login ocorre (CA-04, RN-05, CT-03, RNF-13).
- [ ] **Given** ausência total de sessão, **When** as três funções são chamadas, **Then** todas completam normalmente e nenhum cabeçalho `Authorization` é enviado (CA-01).
- [ ] **Given** o backend responder erro, **When** a chamada falha, **Then** o `ApiError` **sobe** para quem chamou — nenhuma das três funções o captura.
- [ ] **Given** uma resposta de sucesso, **When** devolvida, **Then** o envelope `{ items, pagination }` chega intacto a quem chamou, sem desembrulhar.
- [ ] **Given** `src/services/api/http-client.ts`, **When** comparado ao estado anterior, **Then** é **byte a byte o mesmo arquivo** (CA-55, Decisão E).
- [ ] **Given** `package.json`, **When** comparado, **Then** continua com exatamente três dependências de execução (CA-55).
- [ ] `npm run typecheck` com 0 erros, sem `any` e sem `as` sobre resposta de rede.

---

## API Notes

- `GET /api/catalog/animals` — query opcional `search` (≤120), `speciesId` (UUID), `size`, `sex`, `maxAgeYears` (0–30), `cityId` (UUID), `page` (padrão 1), `pageSize` (padrão 12, máx 100). Sucesso `200 { items, pagination }`.
- `GET /api/catalog/species` → `200 { items: [{ id, name }] }`. Sem parâmetros e **sem** `pagination`.
- `GET /api/catalog/cities` → `200 { items: [{ id, name, stateUf }] }`. Sem parâmetros e **sem** `pagination`.
- Os três são públicos e **nunca** respondem `401` nem `403`. Erros possíveis: `400 VALIDATION_ERROR` (só na listagem) e `429`.
- Identificador bem formado mas inexistente → `200` com lista vazia, nunca `404` (RN-51).

---

## Dependencies

- **Requires**: TASK-BACKEND-003 e TASK-BACKEND-004 (os três endpoints em contrato); `http-client.ts` com `request` e `RequestOptions.skipRefresh` (FEATURE-002 do MODULE-001).
- **Coordena com**: FEATURE-002 deste módulo, que enfrenta a mesma ausência de construtor de query string no cliente HTTP. Se ela já tiver entregue um utilitário de montagem, **reaproveitá-lo**; se não, o deste arquivo é o primeiro e a promoção para o cliente compartilhado só acontece quando houver um segundo caso de uso real.
- **Blocks**: TASK-FRONTEND-009, TASK-FRONTEND-010, TASK-FRONTEND-011.

---

## Revisão — 2026-08-28

**Status**: APROVADO

**546 testes, 36 suítes, 0 falha.** `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos, sem `any` e sem `as` sobre resposta de rede.

| Critério de aceite | Resultado |
|---|---|
| `search: 'são paulo'` sai como `search=s%C3%A3o+paulo` | **Confirmado**, e a releitura por `URLSearchParams` devolve `"são paulo"` |
| `maxAgeYears: 0` **está presente** | **Confirmado.** A comparação é contra `undefined`, nunca por veracidade |
| `''` e `undefined` não viram parâmetro | **Confirmado.** A URL sai sem query nenhuma |
| Sem filtro / só `page: 1` | **Confirmado**: URL limpa e `?page=1` |
| Token vencido não dispara `/auth/refresh` | **Confirmado nas três funções**, pelo efeito: um `401` produz **uma única** requisição, e nenhuma para `/auth/refresh` |
| Sem sessão, nenhuma envia `Authorization` | **Confirmado nas três** |
| O `ApiError` sobe | **Confirmado** |
| O envelope chega intacto | **Confirmado** nas duas formas — `{items, pagination}` e `{items}` |
| `http-client.ts` byte a byte igual | **Confirmado:** `git diff` vazio |
| Três dependências de execução | **Confirmado** |

### O construtor de query foi REAPROVEITADO, não duplicado

A task prevê o caso: "se a FEATURE-002 já tiver entregue um utilitário de montagem, reaproveitá-lo". Ela entregou — `src/services/api/build-query.ts`, na TASK-FRONTEND-012 —, e é ele que monta a cadeia aqui. Nenhuma segunda implementação foi criada.

Uma diferença de contrato precisou de tratamento local: o `buildQuery` **preserva** a cadeia vazia, deliberadamente — para ele, texto vazio é um valor, e há teste da FEATURE-002 fixando isso. Para a vitrine não é: `?search=` chegaria ao backend como busca por texto vazio. A conversão `'' → undefined` mora em `textoOuAusente`, **no catalog-api**, e não no utilitário compartilhado — mudá-lo quebraria o contrato que a outra feature congelou.

### Nota sobre o `skipRefresh`

Ele é a decisão central da task e não é observável no nível do `fetch`. O teste verifica o **efeito**: um `401` produz exatamente **uma** chamada, e nenhuma para `/auth/refresh`. Sem a opção, o cliente HTTP faria a renovação, a falha dela dispararia o `onSessionExpired` registrado pelo `AuthProvider`, e o visitante seria mandado ao login — de dentro da única tela do produto que não exige sessão.

### Arquivo de teste escrito aqui

`catalog-api.spec.ts` não consta da tabela da TASK-FRONTEND-011, que dubla o **módulo** `catalog-api` nas telas. Sem este spec, nenhum teste observaria a URL emitida, a codificação dos parâmetros nem o `skipRefresh` — os quatro critérios centrais da task ficariam sem verificação em lugar nenhum. É o mesmo par que a FEATURE-002 já tem em `animals-api.ts` + `animals-api.spec.ts`.
