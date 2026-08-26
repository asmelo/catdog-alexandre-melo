# TASK-FRONTEND-012 — Cliente HTTP: envio de formulário com arquivos e construtor de query string

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-012-frontend-http-client-formdata-query`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 12 of 18 — Fundação do Frontend
**Generated**: `2026-08-25`

---

## Context

`src/services/api/http-client.ts` hoje converte **todo** corpo em `JSON.stringify` e define **sempre** `Content-Type: application/json`; não há ramo para `FormData` nem forma de omitir o cabeçalho, e não existe construtor de query string para a listagem paginada. Este é o arquivo transversal de maior risco da entrega: ele abriga a fila single-flight de renovação de sessão, cujo comportamento na falha foi medido e é deliberado. A task existe separada exatamente por isso — é trabalho próprio, com testes próprios, e não um detalhe da tela.

---

## Scope

**In:** Ramo de `FormData` no envio, cabeçalho de tipo de conteúdo omitido nesse caso, construtor de query string, e a extensão da suíte de testes do módulo.

**Out:** **Não alterar nada da fila de renovação** — `refreshSession`, `executarRenovacao`, `markSessionRestored`, `setSessionRefresher`, `setOnSessionExpired`, a trava da promessa rejeitada e o conjunto `CAMINHOS_FORA_DO_CICLO` ficam byte a byte como estão. Não acrescentar tempo limite, `AbortSignal`, indicador de progresso de envio nem política de nova tentativa: nenhum é exigido por esta feature e cada um mexeria no fluxo do `401`. Nenhuma função de domínio aqui (TASK-FRONTEND-013). Não importar `auth-api`, o contexto ou o roteador — a inversão por registro documentada no topo do arquivo é o que mantém o grafo de imports em árvore.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/services/api/http-client.ts` | aceita FormData |
| `create` | `src/services/api/build-query.ts` | monta query string |
| `modify` | `src/services/api/http-client.spec.ts` | cobre os ramos novos |

---

## Implementation

> **Reference pattern**: o próprio `http-client.ts`. Cada comentário longo do arquivo registra uma decisão medida — leia antes de editar e não remova nenhum.

### `src/services/api/http-client.ts` *(modify)*
**Diferenças em relação ao referencial:**
- `RequestOptions.body` passa a aceitar `unknown | FormData`. Atualizar o comentário do campo: "Serializado como JSON, exceto `FormData`, enviado como está."
- `montarCabecalhos` passa a receber o corpo, não um booleano: define `Content-Type: application/json` **apenas** quando há corpo e ele **não** é `FormData`.
- Com `FormData`, o cabeçalho tem de ser **omitido**, jamais definido como `multipart/form-data`. O navegador precisa gerá-lo por conta própria porque ele inclui o `boundary`, um valor aleatório por requisição. Definido à mão, o cabeçalho sai sem `boundary` e o servidor não consegue separar as partes — a requisição falha com erro de parser, não com erro de negócio.
- `executarFetch` passa `body: opcoes.body` diretamente quando é `FormData`, e `JSON.stringify(opcoes.body)` no caso contrário. `Accept: application/json` e `credentials: 'include'` continuam em todas as requisições.
- Detectar com `opcoes.body instanceof FormData`. Em jsdom `FormData` é global e a checagem funciona nos testes.
- **O corpo é enviado duas vezes no caminho do `401`**, porque `executarFetch` é chamado de novo após a renovação. Isso continua correto com `FormData`: o objeto é reserializado a cada `fetch`, ao contrário de um `Blob` consumido ou de um stream, que na segunda tentativa iriam vazios. É a razão de o contrato aceitar **`FormData`** e não um corpo já serializado — não trocar por conveniência.
- Consequência aceita e registrada em comentário: um envio de 25 MB que pega a sessão vencida sobe os arquivos duas vezes. É o preço de manter a retentativa única existente, e é preferível a fazer o administrador refazer o formulário.
- Nenhuma outra linha do arquivo muda.

### `src/services/api/build-query.ts` *(create)*
- `buildQuery(params: Record<string, string | number | undefined>): string` → `""` quando não há parâmetro definido, `"?page=2&pageSize=20"` caso contrário.
- Omitir chaves `undefined` em vez de enviá-las vazias: `?page=` faria o backend recusar por validação em vez de aplicar o padrão.
- Usar `URLSearchParams` — escapar à mão é o tipo de código que funciona até a primeira cidade com acento.
- Arquivo separado, e não uma função dentro do `http-client.ts`: manter a superfície do arquivo de risco intocada além do necessário é o ponto.

### `src/services/api/http-client.spec.ts` *(modify)*
- Acrescentar, sem alterar nenhum caso existente: corpo `FormData` enviado como está e **sem** `Content-Type` nos cabeçalhos; corpo objeto continuando com `Content-Type: application/json` e `JSON.stringify`; `FormData` reenviado corretamente na segunda tentativa após `401` + renovação bem-sucedida; `buildQuery` com zero, um e vários parâmetros e com valor `undefined`.

---

## Acceptance Criteria

- [ ] **Given** `body` sendo `FormData`, **When** a requisição é enviada, **Then** o `fetch` recebe o próprio `FormData` como corpo e os cabeçalhos **não** contêm `Content-Type`.
- [ ] **Given** `body` sendo um objeto comum, **When** enviado, **Then** o comportamento é idêntico ao de antes desta task: `JSON.stringify` e `Content-Type: application/json`.
- [ ] **Given** requisição sem corpo, **When** enviada, **Then** nenhum `Content-Type` é definido — como já era.
- [ ] **Given** uma requisição com `FormData` que recebe `401` e uma renovação bem-sucedida, **When** a segunda tentativa parte, **Then** ela leva o mesmo `FormData`, com os arquivos presentes, e **não** um corpo vazio.
- [ ] **Given** três requisições concorrentes que recebem `401`, **When** processadas, **Then** ocorre **exatamente um** `POST /auth/refresh` e **um** disparo de `onSessionExpired` — o comportamento medido da fila permanece inalterado.
- [ ] **Given** uma renovação que falha, **When** uma quarta requisição recebe `401` em seguida, **Then** ela **não** dispara nova renovação — a trava da promessa rejeitada continua valendo.
- [ ] **Given** `buildQuery({ page: 2, pageSize: 20 })`, **Then** `"?page=2&pageSize=20"`; **Given** `{ page: undefined }`, **Then** `""`.
- [ ] **Given** a suíte de autenticação do frontend, **When** executada após esta task, **Then** continua verde sem alteração de arquivo (regressão declarada como o ponto de maior risco da entrega).
- [ ] **Given** o `git diff` de `http-client.ts`, **When** revisado, **Then** ele toca apenas `RequestOptions`, `montarCabecalhos` e `executarFetch` — nenhuma linha da fila de renovação foi alterada ou removida.

---

## Dependencies

- **Requires**: nenhuma task desta feature.
- **Blocks**: TASK-FRONTEND-013 (a camada de API depende de `FormData` e de `buildQuery`), e por transitividade as telas.
