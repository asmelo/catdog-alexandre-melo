# TASK-FRONTEND-008 — Camada de API de espécies, validação de formulário e catálogo de textos

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-008-frontend-species-api-validation`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 8 of 11 — Camada de dados do frontend
**Generated**: `2026-08-25`

---

## Context

Entrega o material que as duas telas da feature consomem: uma função por endpoint de `/api/species`, a validação local do nome e os textos estáticos em PT-BR. Nenhum componente entra aqui. O ponto de disciplina é o catálogo: mensagem que o backend devolve **não** pode ser duplicada em `messages.ts` — a interface ramifica por `code` e exibe o `message` que veio da API.

---

## Scope

**In:** `src/services/api/species-api.ts`, extensão de `src/utils/validation.ts` com a validação do nome de espécie e extensão de `src/utils/messages.ts` com os textos que **só** existem na tela.

**Out:** Nenhum componente, página ou estado de React. Não tratar erro dentro de `species-api.ts` — o `ApiError` sobe para a tela, como em `auth-api.ts`. Não desembrulhar o `{ items }` da listagem (ver decisão abaixo). Não alterar `http-client.ts`, `api-error.ts` nem `access-token-store.ts`. Não copiar para `messages.ts` nenhuma frase que o backend já devolve. Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/services/api/species-api.ts` | quatro endpoints de espécie |
| `modify` | `src/utils/validation.ts` | validação do nome |
| `modify` | `src/utils/messages.ts` | textos da tela |

---

## Implementation

> **Reference pattern**: `src/services/api/auth-api.ts` (uma função por endpoint, sem estado e sem tratamento de erro), `src/utils/validation.ts` (funções puras devolvendo `FieldErrors`) e o cabeçalho de `src/utils/messages.ts` (a regra de não duplicar texto do backend está escrita lá).

### `src/services/api/species-api.ts` *(create)*
- Tipos: `Species { id; name; createdAt; updatedAt }` e `SpeciesListResponse { items: ReadonlyArray<Species> }`.
- Quatro funções, todas sobre `request<T>` de `~/services/api/http-client`:
  - `listSpecies(): Promise<SpeciesListResponse>` → `request('/species')`;
  - `createSpecies(name: string): Promise<Species>` → `POST /species`, corpo `{ name }`;
  - `renameSpecies(id: string, name: string): Promise<Species>` → `PATCH /species/${id}`, corpo `{ name }`;
  - `deleteSpecies(id: string): Promise<void>` → `DELETE /species/${id}`.
- **`listSpecies` devolve o envelope inteiro, não `items`** — mesma decisão de `auth-api.ts`, que não desembrulha sucesso. O envelope existe justamente para ganhar metadados no futuro; desembrulhar aqui obrigaria a mudar a assinatura no dia em que isso acontecer.
- Corpo montado campo a campo (`body: { name }`), nunca `body: valores`: o backend recusa qualquer chave extra com `400 VALIDATION_ERROR` (RN-13), e copiar explicitamente faz o compilador barrar a mudança antes de o servidor barrar a requisição — mesma justificativa registrada em `register`.
- **Não** passar `skipRefresh`: os quatro endpoints exigem `Authorization` e um `401` aqui é exatamente o gatilho legítimo de renovação de sessão.
- `deleteSpecies` é `Promise<void>` porque o contrato é `204 No Content` — o `request` já trata resposta sem corpo (`logout` faz o mesmo).
- Interpolar o `id` direto no caminho é seguro: ele vem de um item da lista devolvida pela própria API, nunca de entrada do usuário, e o backend rejeita com `400` o que não for UUID. Nenhum construtor de query string é necessário — a listagem não tem parâmetros (RN-12), e o `http-client` não oferece um.

### `src/utils/validation.ts` *(modify)*
- Acrescentar `normalizeSpeciesName(bruto: string): string` (trim + colapso de espaços internos) e `validateSpeciesNameForm(values: { name: string }): FieldErrors`, com a mesma precedência de mensagens do backend: vazio após normalizar → obrigatório; `< 2` → mínimo; `> 60` → máximo.
- A normalização local **espelha** a RN-03 do servidor e não a substitui: ela existe para que a contagem de caracteres bata com a do backend antes da requisição. O servidor continua sendo a autoridade — o texto enviado é o que o usuário digitou, e é o backend que grava a forma normalizada.
- Manter as funções puras (sem React), como as três já existentes — é isso que as torna testáveis isoladamente e reutilizáveis pela criação e pela edição em linha.
- Devolver o mesmo formato de mapa `campo → mensagem` que `fieldErrorsOf(apiError)` produz a partir de `details[]`, para que a tela use um caminho único de exibição de erro de campo.

### `src/utils/messages.ts` *(modify)*
- Acrescentar um bloco `SPECIES` com **apenas** o que não existe em nenhuma resposta da API:
  - `PAGE_TITLE: 'Espécies'`, `NAME_PLACEHOLDER: 'Nome de espécie'`, `CREATE_BUTTON: 'Criar'`, `SAVE_BUTTON`, `CANCEL_BUTTON`, `EDIT_ACTION`/`DELETE_ACTION` (usados para compor o nome acessível dos ícones), `LIST_LABEL`;
  - `CREATE_SUCCESS: 'Espécie criada com sucesso.'`, `UPDATE_SUCCESS: 'Espécie atualizada com sucesso.'`, `DELETE_SUCCESS: 'Espécie excluída com sucesso.'` — as três são **texto de tela**: `POST` devolve o recurso e `DELETE` devolve `204`, então nenhuma resposta as carrega;
  - `EMPTY_LIST: 'Nenhuma espécie cadastrada ainda. Crie a primeira acima.'` e `LOAD_ERROR: 'Não foi possível carregar as espécies. Tente novamente.'` — nascem de ausência de resposta útil, não de corpo de erro;
  - `LOADING_LABEL`, `RETRY_BUTTON`;
  - `deleteConfirmation(nome: string): string` devolvendo `` `Excluir a espécie “${nome}”? Esta ação não pode ser desfeita.` `` — **função** e não template solto, porque a frase interpola o nome e precisa sair idêntica em toda chamada. Usar as **aspas curvas** `“ ”` da spec, não `" "`.
- Reusar `MESSAGES.VALIDATION.FIELD_REQUIRED` existente para o campo em branco; acrescentar apenas `NAME_TOO_SHORT` e `NAME_TOO_LONG` ao bloco `VALIDATION`, com os literais da spec.
- **Não** acrescentar: "Já existe uma espécie com este nome.", "Espécie não encontrada.", "Não é possível excluir esta espécie porque existem animais vinculados a ela.", "Você não tem permissão para acessar este recurso." nem "Sua sessão expirou. Faça login novamente." — todas chegam prontas em `ApiError.message`. Registrar essa lista em comentário, no mesmo formato do bloco "O QUE NÃO ESTÁ AQUI" já presente no arquivo.

---

## Acceptance Criteria

- [ ] **Given** `listSpecies()`, **When** chamada, **Then** dispara `GET` para `/species` sem query string e devolve o objeto `{ items }` **sem** desembrulhar.
- [ ] **Given** `createSpecies("Gato")`, **When** chamada, **Then** o corpo enviado é exatamente `{"name":"Gato"}` — nenhuma chave adicional.
- [ ] **Given** `renameSpecies(id, "Gato")`, **When** chamada, **Then** o método é `PATCH` e o caminho é `/species/${id}` — nenhuma função do arquivo usa `PUT`.
- [ ] **Given** `deleteSpecies(id)`, **When** a API responde `204` sem corpo, **Then** a promessa resolve sem erro de parsing.
- [ ] **Given** a API respondendo `409`, **When** qualquer função é chamada, **Then** o `ApiError` **sobe** para quem chamou — nenhuma função de `species-api.ts` contém `try/catch`.
- [ ] **Given** `validateSpeciesNameForm({ name: "   " })`, **Then** devolve `{ name: "Este campo é obrigatório." }` (CT-03).
- [ ] **Given** `validateSpeciesNameForm({ name: "G" })`, **Then** `{ name: "O nome da espécie deve ter no mínimo 2 caracteres." }`; **Given** `"Ov"`, **Then** mapa vazio (CT-04 / CT-05).
- [ ] **Given** nome com 61 caracteres, **Then** `{ name: "O nome da espécie deve ter no máximo 60 caracteres." }`; **Given** exatamente 60, **Then** mapa vazio (CT-06 / CT-07 / RN-02).
- [ ] **Given** `" Cão   Pastor "`, **When** normalizado localmente, **Then** o resultado é `"Cão Pastor"` e tem 10 caracteres para efeito de contagem — a contagem local usa a forma normalizada, igual à do servidor (CT-10 / CA-07).
- [ ] **Given** `MESSAGES.SPECIES.deleteConfirmation("Gato")`, **Then** devolve exatamente `Excluir a espécie “Gato”? Esta ação não pode ser desfeita.` com aspas curvas (CA-13).
- [ ] **Given** `src/utils/messages.ts`, **When** buscado por "Já existe uma espécie", "Espécie não encontrada" ou "animais vinculados", **Then** nenhuma ocorrência é encontrada.
- [ ] `src/services/api/http-client.ts` e `src/services/api/api-error.ts` estão inalterados.

---

## API Notes

- Base já resolvida pelo `http-client` — os caminhos passados são relativos a `/api`.
- `GET /species` → `{ items }`; `POST /species` → `201` recurso plano; `PATCH /species/:id` → `200` recurso plano; `DELETE /species/:id` → `204` sem corpo.
- **Códigos que a tela ramifica**: `VALIDATION_ERROR` (distribuir `details` pelos campos via `fieldErrorsOf`), `SPECIES_NAME_ALREADY_EXISTS`, `SPECIES_NOT_FOUND`, `SPECIES_IN_USE`, `FORBIDDEN`, `SESSION_EXPIRED`. Sempre por `code`, nunca pelo texto de `message` (CA-22).

---

## Dependencies

- **Requires**: TASK-BACKEND-002 a 004 (contratos publicados), FEATURE-002 (`request`, `ApiError`, `fieldErrorsOf`).
- **Blocks**: TASK-FRONTEND-009 e TASK-FRONTEND-010 (as telas consomem estas funções), TASK-FRONTEND-011 (testes).
