# TASK-FRONTEND-009 — Tela de espécies: listagem, estados de carga e criação

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-009-frontend-species-page-list-create`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 9 of 11 — Tela de espécies (parte 1: ler e criar)
**Generated**: `2026-08-25`

---

## Context

Substitui a casca de `species-page.tsx` pela tela real das HU-02 e HU-03: título, linha de criação, lista ordenada e os três estados de carga (carregando, vazio, falha). A edição em linha e a exclusão chegam na task seguinte, e a linha da lista já nasce preparada para recebê-las.

---

## Scope

**In:** O hook de estado da coleção de espécies, o formulário de criação, a linha de exibição da lista e a montagem da página.

**Out:** Não implementar edição em linha nem exclusão (TASK-FRONTEND-010) — `species-row.tsx` renderiza os dois ícones de ação, mas eles ficam sem handler nesta task e recebem comportamento na próxima. Não criar componente de UI novo: se algo faltar, reportar em vez de improvisar fora do que a TASK-FRONTEND-006 entregou. Não alterar `admin-layout.tsx`, `app-routes.tsx` nem `route-paths.ts` (TASK-FRONTEND-007). Não alterar `species-api.ts`, `validation.ts` nem `messages.ts` (TASK-FRONTEND-008). Não ordenar a lista no cliente (ver decisão abaixo). Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/pages/admin/species/use-species-collection.ts` | estado da coleção |
| `create` | `src/pages/admin/species/species-create-form.tsx` | linha de criação |
| `create` | `src/pages/admin/species/species-row.tsx` | linha da lista |
| `modify` | `src/pages/admin/species-page.tsx` | monta a tela |

---

## Implementation

> **Reference pattern**: `src/pages/auth/login-page.tsx` (formulário com `useState` por campo, validação local antes da chamada, botão desabilitado durante a requisição, ramificação por `ApiError.code`) e `src/pages/auth/confirm-email-page.tsx` (chamada única no mount com `ref` de controle sob `StrictMode`).

### `src/pages/admin/species/use-species-collection.ts` *(create)*
- Hook com `useState` por fatia — `species`, `status` (`'carregando' | 'pronto' | 'erro'`) — e as funções `recarregar()`, `adicionar(species)`, `substituir(species)`, `remover(id)`.
- `recarregar` chama `speciesApi.listSpecies()` e guarda `resposta.items`. Chamada única no mount por `useRef` de controle: o `StrictMode` do React 18 monta duas vezes em desenvolvimento, e sem a trava a tela dispararia duas listagens — mesmo cuidado já registrado em `confirm-email-page.tsx`.
- `adicionar`/`substituir`/`remover` mutam a cópia local **sem** refazer a listagem: o RNF-05 pede reflexo em menos de 1 segundo, e uma ida extra ao servidor a cada escrita dobraria o custo de uma tela que a própria spec descreve como de dezenas de registros.
- **A lista não é ordenada no cliente.** `adicionar` e `substituir` inserem na posição correta comparando por `nome.toLowerCase().localeCompare(outro, 'pt-BR')` — é esse o critério que reproduz o `ORDER BY name_normalized` do servidor. Uma ordem diferente da do backend faria a posição do item recém-criado divergir após o próximo recarregamento (RN-11 / CA-04 / CT-13 / CT-14).
  > **Correção da rodada 2 de revisão da TASK-BACKEND-005.** Este item afirmava o contrário — comparação binária de string, "exatamente o critério do `ORDER BY` do servidor". A afirmação é **falsa** e foi refutada por medição no banco de desenvolvimento (Supabase, PostgreSQL 17.6, `datlocprovider = 'i'` — ICU —, `datcollate = en_US.UTF-8`, coluna sem `COLLATE` explícito): `ORDER BY name_normalized ASC` devolve `Ágil, Cão, Cavalo, Gato, Zebra`, a ordem de `localeCompare('pt-BR')`; a comparação binária devolveria `Cavalo, Cão, Gato, Zebra, Ágil`, jogando todo nome acentuado para o fim. Com nomes ASCII os dois critérios coincidem e a divergência passaria despercebida — com `"Cão"`, `"Réptil"` ou `"Pássaro"`, que a própria spec usa, não. A TASK-FRONTEND-010 herda a mesma correção.
- `remover` e `substituir` são exportados agora, ainda sem consumidor, porque a TASK-FRONTEND-010 os usa e mudar a assinatura do hook depois obrigaria a mexer nesta task de novo.
- Erro na listagem coloca `status` em `'erro'` sem lançar — a tela decide o que exibir. Não guardar a mensagem do `ApiError` aqui: a falha de carga exibe o texto do catálogo (`LOAD_ERROR`), que é orientação de ação e não repetição do erro do servidor.

### `src/pages/admin/species/species-create-form.tsx` *(create)*
- `<form onSubmit>` real, e não `onClick` no botão: é o que permite criar apertando Enter no campo (RNF-06 / CT-37).
- `TextField` com `placeholder={MESSAGES.SPECIES.NAME_PLACEHOLDER}` e `label` `sr-only` — o componente existente já força um `<label>` real, e o placeholder sozinho não é rótulo.
- `SubmitButton` com o texto `"Criar"`, à direita do campo (`flex items-start gap-3`), conforme a captura.
- Fluxo do envio: `validateSpeciesNameForm` **antes** de qualquer requisição → se houver erro, exibir sob o campo e **não** chamar a API; senão `createSpecies(nome)` com o botão desabilitado enquanto a promessa não resolve.
- Sucesso: limpar o campo, **devolver o foco a ele**, chamar `onCreated(species)` e emitir `CREATE_SUCCESS` — nesta ordem. O foco de volta ao campo é o que permite cadastrar várias espécies em sequência sem tocar no mouse.
- Erro: ramificar por `ApiError.code` — `VALIDATION_ERROR` → distribuir `details` com `fieldErrorsOf`; `SPECIES_NAME_ALREADY_EXISTS` → exibir `erro.message` **mantendo o texto digitado no campo** (exigência explícita da spec: a lista não muda e o usuário precisa poder corrigir o que escreveu); qualquer outro → `MESSAGES.FORM.UNEXPECTED_ERROR`.
- A desabilitação do botão durante a requisição é o mecanismo de CT-35: um segundo acionamento não dispara segunda requisição. Não usar `debounce`.

### `src/pages/admin/species/species-row.tsx` *(create)*
- Recebe `species` e dois callbacks opcionais nesta task (`onEdit`, `onDelete`) e renderiza: nome à esquerda (`font-semibold text-ink`), `IconButton` de lápis e `IconButton` de lixeira à direita, nesta ordem.
- Nome acessível de cada ação composto com o nome da espécie: `` `${MESSAGES.SPECIES.EDIT_ACTION} ${species.name}` `` e o equivalente para excluir. É este ponto que satisfaz o RNF-07/CT-38 — "Editar" sozinho, repetido em cada linha, não identifica o item.
- A linha é apenas apresentação: nenhum `useState` e nenhuma chamada de API aqui. O modo de edição chega na TASK-FRONTEND-010 e será um ramo deste componente.

### `src/pages/admin/species-page.tsx` *(modify)*
- Substituir a casca por: `<h1>Espécies</h1>` (`MESSAGES.SPECIES.PAGE_TITLE`), o `SpeciesCreateForm`, o `StatusMessage` de resultado (montado apenas quando há mensagem) e a região da lista.
- A região da lista alterna entre exatamente três estados, e **a linha de criação permanece visível nos três** (HU-03 cenários 3 e 4):
  - `'carregando'` → `LoadingIndicator` com `MESSAGES.SPECIES.LOADING_LABEL`;
  - `'pronto'` e lista vazia → `EmptyState` com `EMPTY_LIST`;
  - `'pronto'` e lista com itens → `DataList` de `SpeciesRow`, com `getKey={(s) => s.id}`;
  - `'erro'` → `ErrorState` com `LOAD_ERROR`, `onRetry={recarregar}` e `retryLabel={RETRY_BUTTON}`.
- A mensagem de sucesso é guardada em estado da página e limpa a cada nova operação — não empilhar avisos. Como `StatusMessage` é região viva, montá-lo somente quando existe mensagem (renderizá-lo vazio e preencher depois não anuncia).

---

## Acceptance Criteria

- [ ] **Given** a tela aberta, **When** renderizada, **Then** exibe o título "Espécies", um campo com o placeholder "Nome de espécie" e o botão "Criar" à sua direita (CA-02).
- [ ] **Given** as espécies "Sapo", "Gato" e "Cachorro" devolvidas pela API, **When** a lista é exibida, **Then** a ordem no DOM é "Cachorro", "Gato", "Sapo" (CT-13).
- [ ] **Given** "gato" e "Cachorro", **When** a lista é exibida, **Then** "Cachorro" aparece antes de "gato" (CT-14 / CA-04).
- [ ] **Given** a lista com itens, **When** cada linha é inspecionada, **Then** ela apresenta o nome e dois botões cujos nomes acessíveis contêm a ação **e** o nome da espécie (CA-03 / CT-38).
- [ ] **Given** a listagem em andamento, **When** a tela é aberta, **Then** um elemento `role="status"` ocupa o lugar da lista e a linha de criação continua visível (HU-03 cenário 4).
- [ ] **Given** a API respondendo `{ items: [] }`, **When** a tela é aberta, **Then** exibe "Nenhuma espécie cadastrada ainda. Crie a primeira acima." e a linha de criação permanece disponível (CT-15 / CA-20).
- [ ] **Given** a listagem falhando, **When** a tela é aberta, **Then** exibe "Não foi possível carregar as espécies. Tente novamente." com um botão de nova tentativa que refaz a chamada (CT-36).
- [ ] **Given** nome válido e inédito, **When** "Criar" é acionado, **Then** a espécie aparece na lista na posição alfabética correta, o campo é limpo, o foco volta ao campo e "Espécie criada com sucesso." é exibida em região `role="status"` (CT-01 / CA-05 / RNF-09).
- [ ] **Given** o campo vazio ou só com espaços, **When** "Criar" é acionado, **Then** exibe "Este campo é obrigatório." junto ao campo e **nenhuma** requisição é disparada (CT-02 / CT-03).
- [ ] **Given** um único caractere, **Then** "O nome da espécie deve ter no mínimo 2 caracteres."; **Given** mais de 60, **Then** "O nome da espécie deve ter no máximo 60 caracteres." — em ambos, sem requisição (CT-04 / CT-07 / CA-06).
- [ ] **Given** a API respondendo `409 SPECIES_NAME_ALREADY_EXISTS`, **When** a criação falha, **Then** exibe "Já existe uma espécie com este nome.", o texto digitado **permanece** no campo e a lista não muda (CT-08 / CT-09 / CA-08).
- [ ] **Given** a criação em andamento, **When** "Criar" é acionado uma segunda vez, **Then** o botão está desabilitado e apenas **uma** requisição foi enviada (CT-35 / HU-02 cenário 7).
- [ ] **Given** a tela em `StrictMode`, **When** montada em desenvolvimento, **Then** `GET /api/species` é chamado **exatamente uma vez**.
- [ ] **Given** a tela navegada apenas por teclado, **When** o campo recebe foco e Enter é pressionado, **Then** a criação é submetida sem uso de mouse (CT-37).
- [ ] Nenhum arquivo desta task compara `ApiError.message` com texto literal — toda ramificação é por `code` (CA-22).
- [ ] Nenhum componente novo foi criado em `src/components/ui/`.

---

## Dependencies

- **Requires**: TASK-FRONTEND-006 (`DataList`, `IconButton`, ícones, `EmptyState`, `LoadingIndicator`, `ErrorState`, `StatusMessage`), TASK-FRONTEND-007 (rota `/admin/especies` e casca da página), TASK-FRONTEND-008 (`species-api`, `validateSpeciesNameForm`, catálogo), TASK-BACKEND-002 (endpoints em execução).
- **Blocks**: TASK-FRONTEND-010 (estende `species-row.tsx` e consome `substituir`/`remover` do hook), TASK-FRONTEND-011 (testes).
