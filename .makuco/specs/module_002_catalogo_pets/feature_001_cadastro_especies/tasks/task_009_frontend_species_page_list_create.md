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

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 4 (os 4 da tabela *Files*, e nenhum outro)
**Gates medidos nesta revisão**: `npm run typecheck` exit 0; `npm test` exit 0 — 12 suítes, 160 testes, 0 falhas.

#### Resumo

Os 16 critérios de aceite estão implementados (16/16). Nenhum achado `critical` nem `major`. Confirmei, por medição direta na captura declarada fonte da verdade e por execução da suíte, cada uma das oito decisões declaradas e cada uma das armadilhas listadas. Três achados `minor` e cinco `suggestion` ficam registrados; nenhum bloqueia o fechamento da task, e dois deles (#1 e #2) precisam de dono explícito nas TASK-FRONTEND-010 e 011.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/pages/admin/species/use-species-collection.ts` | L117-132 | bug / corrida | `recarregar` não sequencia a requisição em voo. Se um `GET /api/species` ainda estiver em voo quando um `POST` concluir, o `.then` executa `setSpecies(resposta.items)` com um retrato tirado ANTES da criação e apaga a espécie recém-inserida por `adicionar`, enquanto "Espécie criada com sucesso." permanece na tela — contradição direta com CA-05. A janela é aberta de propósito pelo próprio contrato (HU-03 cenário 4 mantém a linha de criação visível durante `'carregando'`). A TASK-FRONTEND-010 alarga a janela ao ligar `substituir` e `remover` às mesmas escritas locais. | Token de sequência: `const requisicaoAtual = useRef(0)`; capturar `const minha = ++requisicaoAtual.current` antes da chamada e ignorar `.then`/`.catch` quando `minha !== requisicaoAtual.current`. Não bloqueia: o servidor está correto e um recarregamento cura. |
| 2 | minor | `src/routes/app-routes.spec.tsx` | L31-34 | teste / regressão | Cinco avisos `An update to SpeciesPage inside a test was not wrapped in act(...)`, introduzidos por esta task (a casca anterior de `species-page.tsx` não fazia chamada alguma, e a suíte estava limpa). Mais grave que o ruído: o próprio arquivo declara em L31-33 que dubla `auth-api` porque "nenhuma requisição pode escapar (AC #2)" — a árvore agora monta `SpeciesPage`, que chama `species-api` **sem dublê**, e a invariante daquele spec deixou de ser cumprida. Quem a sustenta hoje é só o `fetch` que lança de `tests/setup.ts`. | Pertence à TASK-FRONTEND-011, que é dona do arquivo: acrescentar `jest.mock('~/services/api/species-api')` ao lado da L34 e `mockResolvedValue({ items: [] })` para `listSpecies` no `beforeEach` da L44. Registrar como item **obrigatório** da 011, não como cortesia. |
| 3 | minor | `src/pages/admin/species/species-row.tsx` | L31-36 | documentação | O comentário afirma "A captura de tela mostra o lápis em roxo da marca". **Falso, medido na captura**: o pixel mais saturado do lápis é `(126,137,177)` — G ≥ R, um azul-ardósia, incompatível com `#7c3aed` (`brand.purple`), onde G ≪ R; e a lixeira é vermelho-rosado `(174,79,98)`, não `brand-orange-dark` `#c44a10`. A conclusão (não criar variante) continua certa; a premissa registrada no arquivo não. | Corrigir o comentário: a captura usa azul e vermelho genéricos, sem token CatDog correspondente; `default` e `danger` são os vizinhos mais próximos. Sem a correção, uma task futura vai tentar criar a "variante roxa" que a captura nunca mostrou. |
| 4 | suggestion | `src/pages/admin/species/species-create-form.tsx` | L200 | layout | `w-28` = 112px. Medido na captura, o botão "Criar" ocupa 36px de imagem na escala 0,652 → **≈55px CSS** (texto ≈32px + ~12px de folga de cada lado): cerca de metade. O bloco de 600px fecha mesmo assim porque o campo absorve a diferença (captura: campo ≈538 + `gap-3` 12 + botão ≈55 = 605). Não é quebra de contrato — a tabela "O que a captura estabelece como contrato de interface" (`spec_context.md` L65-75) registra apenas conteúdo, nunca geometria. | Se a fidelidade importar, `w-16` ou `w-[56px]` no mesmo wrapper — a técnica escolhida já é a correta (ver julgamento da decisão 4). |
| 5 | suggestion | `src/pages/admin/species-page.tsx` / `species-create-form.tsx` | L17-20 / L19-22 | duplicação | `ResultadoDaOperacao` declarado duas vezes. A justificativa registrada (ciclo de imports) só descarta o sentido formulário→página; o sentido página→formulário **já existe** (L6 da página) e não fecha ciclo. | `export type ResultadoDaOperacao` no formulário e `import type` na página. Risco atual é baixo: o TypeScript pega a divergência no ponto de atribuição de `setResultado` a `onResult`. |
| 6 | suggestion | `src/pages/admin/species-page.tsx` | L76 e L123 | a11y / teste | Durante `'carregando'` com aviso de resultado presente a página monta **dois** `role="status"` (o `LoadingIndicator` e o `StatusMessage`). Alcançável quando o usuário cria uma espécie durante a carga inicial. | A TASK-FRONTEND-011 não pode usar `getByRole('status')` sem qualificador nesta tela — usar `getByRole('status', { name: ... })` ou `getAllByRole`. |
| 7 | suggestion | `src/pages/admin/species/use-species-collection.ts` | L159-172 | modelagem | `substituir` é o mesmo objeto de função que `adicionar`. Consequência não registrada: `substituir(especie)` com um `id` **ausente** da lista insere em vez de falhar — ressuscita silenciosamente um item já removido. Cenário só existe a partir da 010. | Registrar a consequência no comentário; se a 010 precisar da distinção, separar então (não agora). |
| 8 | suggestion | `src/components/ui/text-field.tsx` | — | dívida | `TextField` não é `forwardRef`, o que obriga o formulário a devolver o foco por `document.getElementById` (`species-create-form.tsx` L139). | Dívida a pagar na primeira task que abrir `src/components/ui/text-field.tsx` por motivo próprio. A escolha nesta task está certa (ver julgamento da decisão 5). |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 16 de 16 critérios implementados. Título/placeholder/"Criar" (`species-page.tsx:105`, `species-create-form.tsx:176-201`); ordem do backend preservada pelo `DataList` e reproduzida localmente por `inserirEmOrdem`; nomes acessíveis compostos (`species-row.tsx:55,65`); os três estados de carga com a linha de criação fora da alternância (`species-page.tsx:74-126`, `113`); validação local antes de qualquer requisição (`species-create-form.tsx:109-117`); `409` preservando o texto digitado (L92-96); `disabled` durante o envio (L201); trava de `StrictMode` (`use-species-collection.ts:102,134-141`); `<form onSubmit>` real (L158); zero comparação de `message`; zero componente novo em `src/components/ui/`. Sem achados.

**Pass 2 — Diff Analysis**: `git status` na raiz do monorepo devolve exatamente `M services/frontend/src/pages/admin/species-page.tsx` e `?? services/frontend/src/pages/admin/species/`. Nada da seção *Out* foi tocado: `admin-layout.tsx`, `app-routes.tsx`, `route-paths.ts`, `species-api.ts`, `validation.ts`, `messages.ts`, `http-client.ts` e `src/components/ui/*` estão intactos. Sem scope creep. Sem achados.

**Pass 3 — Code Practices**: um nível de indentação por função, sem `else`, degraus por `return` antecipado (`species-page.tsx:74-101`, `species-create-form.tsx:85-99`). `regiaoDaLista()` é chamada como função e não montada como componente — correto, evita remontar a região a cada render. União literal em vez de dois booleanos (`use-species-collection.ts:27`), com o precedente citado. Nomes sem abreviação. Sem número mágico exceto o `600` do wrapper, extraído para constante nomeada e justificado. Achados: #5, #7.

**Pass 4 — Testing Review**: esta task não entrega testes (são da 011), então não há suíte própria a avaliar. O que a passagem produziu foi a regressão de sinal em `app-routes.spec.tsx`. Achados: #2, #6.

**Pass 5 — Security Review**: OWASP Top 10 aplicado aos 4 arquivos e às suas dependências diretas. **A01**: a tela vive atrás de `RoleRoute`/`ProtectedRoute` e a autorização real é do backend; nenhuma decisão de acesso é tomada aqui. **A03**: nenhuma interpolação em SQL, shell ou HTML; `species.name` e o `id` chegam da própria API e são renderizados como texto/atributo, escapados pelo React; nenhum `dangerouslySetInnerHTML`. **A02**: nenhum segredo, nenhum token manipulado. **A05**: nenhuma mensagem de erro do servidor vazando além do `message` que a spec manda exibir. **A09**: o `.catch` de `use-species-collection.ts:129` descarta o erro sem registro — **não é achado**: `src/` não tem uma única chamada a `console.*`, e `auth-provider.tsx:143` já engole do mesmo jeito; é a convenção em vigor. Demais itens (A04, A06, A07, A08, A10) sem superfície nestes arquivos. **Sem achados de segurança.**

**Pass 6 — Bug Detection**: li os quatro arquivos por inteiro, mais `http-client.ts`, `species-api.ts`, `validation.ts`, `api-error.ts` e os seis componentes de `ui/` consumidos. Nulos guardados (`errosDeCampo.name ?? ''`, `?.focus()`, `onEdit?.()`); sem off-by-one (`findIndex` + `slice`, sem indexação numérica, coerente com `noUncheckedIndexedAccess: true`); sem coerção frouxa (`===` em toda parte); sem `catch` vazio; sem vazamento de recurso; ordem dos degraus correta (`'erro'` antes de lista vazia). Uma única corrida encontrada. Achado: #1.

**Pass 7 — Project Patterns**: estrutura (`src/pages/admin/species/`), alias `~/`, `type`/`interface`, `readonly` nas props, JSDoc de intenção, catálogo `MESSAGES` como única fonte de texto de tela — tudo alinhado ao precedente de `login-page.tsx` e `confirm-email-page.tsx`. Linguagem ubíqua respeitada: `Species`/`species` no que atravessa a API, PT-BR no vocabulário interno da tela, exatamente como a base já faz. **Acentos em comentários**: os três casos de prosa acentuada (`de graça` L51, `alcançavel` L80, `combinações` L22) têm precedente literal na base — `login-page.tsx:115` traz `de graça`, `check-email-page.tsx:22` traz `alcançavel`, `confirm-email-page.tsx:16` traz `combinações`. Conforma. Achado: #3 (precisão do registro, não do padrão).

---

#### Julgamento do ponto levantado: os 5 avisos de `act(...)`

**1. A causa diagnosticada está certa — verificada.** Rodei a suíte e capturei o rastro: as cinco ocorrências apontam para `at setStatus (...)` seguido de `at src/pages/admin/species/use-species-collection.ts:130:9`, que é exatamente o `setStatus('erro')` do `.catch` de `recarregar`. `app-routes.spec.tsx` dubla apenas `~/services/api/auth-api` (L34); `species-api` é real, `http-client.request` é `async`, e o `fetch` que `tests/setup.ts:70-76` instala lança de forma síncrona — o que vira rejeição de promessa e leva o `.catch` a um microtask fora do `act`. São **5** e não 6 porque `o botao Sair do layout administrativo chama logout` (L95-102) usa `await userEvent.click`, cujo `asyncWrapper` do RTL drena os microtasks pendentes dentro do `act`. Os cinco emissores são os testes das L70, L86, L161, L232 e L269.

**2. É ruído de teste — e NÃO esconde atualização de estado após desmontagem.** Dois motivos independentes. Primeiro, nesses testes o componente **ainda está montado** quando o `.catch` dispara: o corpo do teste é síncrono, o `cleanup()` só roda no `afterEach`, e o microtask é drenado antes disso. Segundo, o React 18 removeu o aviso de "state update on an unmounted component" justamente porque essas atualizações passaram a ser descartadas em silêncio, sem vazamento. Consequência prática: **uma guarda de `montado` no hook não faria o aviso sumir**, e não haveria por que adicioná-la.

O que existe de real no hook eu encontrei lendo o código, não pelo aviso: é a **ausência de sequenciamento** do achado #1. Vale registrar o que **descartei** ao investigar: o duplo clique em "Tentar novamente" **não** produz corrida, porque o primeiro clique troca `status` para `'carregando'`, o `ErrorState` desmonta e o segundo clique não encontra botão. A única corrida alcançável é `POST` concluindo enquanto o `GET` ainda está em voo.

**3. Deixar para a 011 é aceitável quanto ao LUGAR, e inaceitável quanto ao REGISTRO.** O agente está certo em não editar `app-routes.spec.tsx`: o arquivo não está na tabela *Files*, e — ponto decisivo — **a correção não cabe em nenhum arquivo que a task autoriza**. Como demonstrado no item 2, não há mudança em `use-species-collection.ts` que remova o aviso sem distorcer o código de produção para conveniência de teste. Portanto não era escolha entre pagar agora e pagar depois: dentro do escopo de 009 não havia como pagar.

Mas a preocupação de mascaramento procede e é maior do que parecia. O ruído é **regressão desta task** (a casca anterior não chamava a API; a suíte estava limpa) e passa a ser a linha de base: quando a 010 introduzir a edição em linha, um `act(...)` legítimo vindo do modo de edição será indistinguível no rolar do console. E há um agravante que não é cosmético: `app-routes.spec.tsx` declara em L31-33 que dubla a API porque "nenhuma requisição pode escapar (AC #2)" — essa invariante **deixou de ser cumprida** com esta entrega. Não é um enfeite novo para a 011; é uma regra própria do arquivo da 011 que 009 quebrou.

**Decisão:** o achado #2 fica registrado como item **obrigatório e bloqueante da TASK-FRONTEND-011**, com o local exato: `src/routes/app-routes.spec.tsx`, `jest.mock('~/services/api/species-api')` ao lado da L34, e `mockResolvedValue({ items: [] })` para `listSpecies` no `beforeEach` da L44 — a mesma técnica e a mesma justificativa já usadas ali para `auth-api`. Alternativa aceita: envolver as asserções dos cinco testes em `await waitFor`. A 011 não pode fechar com a suíte emitindo `console.error`.

---

#### Julgamento das oito decisões declaradas

**1. Fundo do `<main>` — decisão CERTA, responsabilidade da TASK-FRONTEND-007.** Medi na captura: a área de conteúdo é exatamente `(250,250,252)` = `#fafafc`, enquanto `admin-layout.tsx:87` pinta `bg-surface-canvas` = `#dde0ea`. A divergência é real. A abstenção está certa por três razões, e a terceira o agente não usou: `admin-layout.tsx` está na seção *Out*; o token é compartilhado com o `ClientLayout`; e a tabela "O que a captura estabelece como contrato de interface" (`spec_context.md` L65-75) registra **apenas conteúdo** — nunca cor de fundo. Não há contrato quebrado, e sim fidelidade perdida. **Dono: TASK-FRONTEND-007**, que entregou o layout sob a mesma cláusula de "a captura é a fonte da verdade" e escolheu `surface-canvas` assim mesmo. Correção quando alguém reabrir aquele arquivo: token novo (`surface.canvas-admin`) ou valor direto no wrapper administrativo — nunca trocar o valor de `surface.canvas`, que repintaria a área do cliente. Registro em comentário: adequado.

**2. `max-w-[600px]` centrado — medição CONFERIDA e correta.** Refiz a medição na captura, em pixels: a barra lateral ocupa `x` 0-145 com o fio em `x=145`, ou seja 146px de imagem → escala `146 / 224 = 0,6518`, batendo com a alegação. O cartão da lista vai de `x=324` a `x=713` → 390px de imagem → **598px CSS**. Confirmação cruzada pela altura do botão: 22px de imagem ÷ 0,6518 = 33px, e `py-[14px]` + texto de 0,95rem rendem 51px CSS × 0,6518 = 33px. Centralização: o centro medido do bloco é `x=518,5`; com o `<main>` indo de 146 até a borda da janela do navegador (≈885, onde termina a barra de endereço — o que está à direita disso é a janela de vídeo sobreposta, que a própria spec manda desconsiderar em L63), o centro previsto é 515,5. Diferença de 3px. **Decisão certa e bem derivada.**

**3. `IconButton` com `default` no lápis — conclusão CERTA, premissa FALSA.** Ver achado #3. Não existe variante roxa e criá-la exigiria `src/components/ui/`, fora de escopo — a escolha está correta. Mas a captura não mostra lápis roxo; mostra azul-ardósia e lixeira vermelha, duas cores sem token CatDog. O comentário precisa ser corrigido para não induzir a 010 a criar uma variante inexistente na fonte da verdade.

**4. Largura pelo wrapper — alegação VERIFICADA e verdadeira.** Conferi a ordem do tema padrão do Tailwind: `theme.width` é `{ auto, ...theme('spacing'), ...frações, full, screen, ... }`, então a folha gerada emite `.w-auto`, depois `.w-28`, e `.w-full` **por último**. Com especificidade idêntica (uma classe cada), `w-full` vence qualquer coisa passada por `className` — inclusive `w-auto` e inclusive `w-28`. Constranger o pai é, de fato, a única rota determinística sem `tailwind-merge`. **Raciocínio correto.** O valor escolhido é que diverge da captura: achado #4.

**5. Foco por `document.getElementById` — ACEITÁVEL.** `TextField` não é `forwardRef` (`text-field.tsx:34-41`) e alterá-lo está fora do escopo. O `id` é constante de módulo, usado no `htmlFor`, no `<input>` e na devolução do foco; a tela monta um único formulário, então a busca é determinística. A ordem também está certa: o `focus()` roda antes do re-render provocado por `onCreated`/`onResult`, e o `<input>` não é remontado pela inserção do `StatusMessage`, então o foco sobrevive. Dívida registrada como achado #8.

**6. `adicionar` e `substituir` como a mesma implementação — ACEITÁVEL, com uma consequência não registrada.** A task manda exportar `substituir` e `remover` agora, então o código morto é contrato, não descuido. `inserirEmOrdem` removendo por `id` antes de inserir é o que torna a fusão legítima e ainda protege a criação contra duplicata de `id`. A consequência ausente do comentário é a do achado #7: sob o nome `substituir`, um `id` ausente insere em vez de falhar.

**7. Terceiro ramo com `UNEXPECTED_ERROR` — CERTO seguir a task.** A task prescreve o ramo literalmente, e a task é o contrato; divergir dela para imitar o `login-page.tsx` seria a escolha errada em uma revisão que cobra aderência. O custo é real e está bem descrito no próprio arquivo (L76-83): um `403 FORBIDDEN` — administrador cujo papel foi revogado no servidor com sessão ainda viva — perde a frase pronta do backend e recebe "Ocorreu um erro inesperado", sem pista de que perdeu permissão. É inconsistência de produto entre duas telas, não defeito desta entrega. **Encaminhamento: decidir no nível da spec** qual dos dois padrões vale para o projeto, e uniformizar em uma task própria. Registro no comentário: exemplar — descreve a divergência, o custo e por que é residual.

**8. `'erro'` vence lista vazia — CERTO.** Conferido em `species-page.tsx:74-91`: a ordem é `carregando` → `erro` → vazio → lista. Sem essa ordem, uma falha de carga afirmaria "Nenhuma espécie cadastrada ainda." sobre um cadastro que a tela não conseguiu consultar — mentira, e das piores, porque convida o administrador a recriar o que já existe.

---

#### Armadilhas — todas evitadas, verificadas uma a uma

| Armadilha | Verificação |
|---|---|
| Guarda `resposta.items` e não o envelope | ✓ `use-species-collection.ts:126` — `setSpecies(resposta.items)` |
| Ordenação por `localeCompare`, não binária | ✓ `use-species-collection.ts:56-58` — `localeCompare(..., 'pt-BR')` com `toLowerCase()` dos dois lados; zero uso de `<`/`>` sobre nomes |
| `normalizeSpeciesName` não usado para contar; sem contador | ✓ `grep -rn "normalizeSpeciesName" src/pages/admin/` → zero ocorrências |
| Rótulo acessível `${EDIT_ACTION} ${nome}` | ✓ `species-row.tsx:55` e `:65` — interpolação direta, produzindo "Editar Gato" / "Excluir Gato". Contrato implícito com a 008 preservado |
| `enviando` zerado em `finally` | ✓ `species-create-form.tsx:145-154` |
| `http-client.ts`, `~/components/ui/*` e artefatos da 007 intocados | ✓ `git status` na raiz lista somente os 4 arquivos da task |
| Ramificação por `code`, nunca por texto | ✓ `species-create-form.tsx:86` e `:92` — `erro.code === ...`; `grep` por `message ===`, `message ==` e `.message.includes` nos 4 arquivos → zero ocorrências. Também não há ramificação por `status` |
| Nenhuma mensagem do backend duplicada | ✓ a única frase do backend que aparece nos 4 arquivos está **dentro de um comentário** (`species-create-form.tsx:79`), não é renderizada e não pode vazar para a tela. `SPECIES_NAME_ALREADY_EXISTS` exibe `erro.message` (L93) |
| Trava de `StrictMode` que não trava "Tentar novamente" | ✓ `use-species-collection.ts:102` e `134-141` — o `useRef` guarda o **efeito de entrada**, não `recarregar`; o mesmo `recarregar` vai como `onRetry` em `species-page.tsx:83` e permanece invocável quantas vezes o usuário acionar |
| Proibido `any` | ✓ zero ocorrências de `: any`, `as any`, `<any>` |
| PT-BR; comentários sem acento, tela com acento | ✓ conforma ao precedente da base — ver Pass 7 |
| `<h1>` único | ✓ `species-page.tsx:105`, única ocorrência em `src/pages/admin/` |

#### Custo de acessibilidade dos dois ícones sem handler

**Confirmado que é o que a task manda**: a seção *Scope — Out* diz literalmente que `species-row.tsx` "renderiza os dois ícones de ação, mas eles ficam sem handler nesta task", e o critério de aceite 4 cobra os dois botões com nome acessível composto. O código cumpre exatamente isso, e `onEdit?.()`/`onDelete?.()` (L61 e L69) é a forma honesta — sem `noop` compartilhado, sem comportamento provisório inventado.

**Custo no intervalo, avaliado**: cada linha da lista acrescenta 2 paradas de tabulação que não levam a lugar nenhum. Quem navega por leitor de tela ouve "Editar Gato, botão", aciona, e **nada acontece** — nenhum estado muda, nenhuma região viva anuncia, nenhuma mensagem aparece. Não é reprovação direta de nenhum critério do WCAG 2.1 (não há SC que proíba um botão sem efeito), mas quebra a expectativa de que um controle anunciado como acionável faça algo, e o silêncio é indistinguível de um defeito. Numa lista de N espécies são 2N paradas mortas. **Recomendação: não expor esta tela a usuário nenhum — nem demonstração — antes de a TASK-FRONTEND-010 entrar.** As duas tasks formam uma unidade de release; 009 sozinha é entregável de repositório, não de produto.

#### Veredicto

> **APROVADA** — 16 de 16 critérios de aceite implementados, nenhum achado `critical` ou `major`, `typecheck` e `npm test` verdes (12 suítes / 160 testes). Os 3 achados `minor` e 5 `suggestion` ficam registrados sem bloquear o fechamento.
>
> **Dois itens saem daqui com dono obrigatório:**
> - **TASK-FRONTEND-011** — achado #2: dublar `~/services/api/species-api` em `src/routes/app-routes.spec.tsx` (ao lado da L34) e zerar os 5 `console.error`. Item bloqueante da 011; a invariante quebrada é do próprio arquivo dela.
> - **TASK-FRONTEND-010** — achado #1: ao ligar `substituir` e `remover`, sequenciar `recarregar` com token de requisição; e achado #3: corrigir a premissa do comentário de `species-row.tsx` antes de decidir a variante do lápis.
>
> **Não são achados desta task, e ficam encaminhados:** o fundo do `<main>` (dono: TASK-FRONTEND-007) e a divergência entre `UNEXPECTED_ERROR` aqui e `erro.message` no `login-page.tsx` (decisão de nível de spec).


---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 4 (os 4 da tabela *Files*), dos quais **2 alterados nesta rodada**
**Gates medidos nesta revisão**: `npm run typecheck` exit 0; `npm test` exit 0 — 12 suítes, 160 testes, 0 falhas; **5** avisos de `act(...)`, nem mais nem menos.

#### Resumo

Os dois achados endereçados (#1 e #3) estão corrigidos. O achado #1 foi corrigido **melhor do que a recomendação da rodada 1**: a contestação do agente procede, foi reproduzida em bancada e a recomendação que este revisor deu — número de sequência sozinho — está **errada** para o cenário que o próprio achado descreve. A técnica escolhida (sequência + reaplicação das escritas do intervalo) foi exercitada em onze cenários, incluindo os quatro buracos apontados como suspeitos, e nenhum deles se materializou. A medição de cor do novo comentário de `species-row.tsx` foi refeita pixel a pixel e confere. Nenhum dos 16 critérios de aceite regrediu. Nenhum achado `critical` nem `major`. Cinco `suggestion` novos, todos de registro ou de herança para as tasks seguintes.

#### O argumento do agente contra a recomendação da rodada 1

**Procede, e a recomendação da rodada 1 estava errada.** Reproduzi os dois lados em bancada, com `listSpecies` diferido e a escrita local disparada no meio do voo:

- **Réplica do que a rodada 1 recomendou** (só `const minha = ++requisicaoAtual.current` + teste de identidade na resolução): estado final `['Gato', 'Sapo']` — **a espécie criada desapareceu**. O motivo é exatamente o que o agente escreveu: quem envelhece a resposta não é uma listagem mais nova, é o `POST`. Não existe segunda listagem, `minha === requisicaoAtual.current` é verdadeiro, o `.then` passa pela guarda e `setSpecies(resposta.items)` sobrescreve com o retrato anterior à criação. O contador só sabe ordenar listagens entre si; a corrida do achado #1 é listagem × escrita, e ele é cego para ela.
- **Código entregue**: estado final `['Gato', 'Nova', 'Sapo']`, `status: 'pronto'` — a espécie criada permanece **e** as duas que a listagem trouxe também, na ordem alfabética correta.

O descarte do `AbortController` também está certo, e pelo motivo declarado: sem `signal` atravessando `speciesApi.listSpecies` até o `fetch` do `http-client.ts` — os dois fora de escopo — a requisição continuaria em voo e o descarte continuaria sendo feito na resolução. Seria este contador, com uma alocação a mais.

A escolha de **reaplicar** em vez de **descartar** a resposta obsoleta também se sustenta: descartar deixaria a lista com o único item que a escrita local inseriu até o próximo recarregamento, porque durante `'carregando'` o estado `species` está vazio. Medido: no cenário do achado, descartar produziria `['Nova']`; reaplicar produz `['Gato', 'Nova', 'Sapo']`.

#### Buracos investigados na técnica escolhida

Os quatro suspeitos levantados, mais três que encontrei lendo o código, todos exercitados:

| Cenário | Resultado medido | Veredicto |
|---|---|---|
| Retrato do servidor **já contém** a escrita (`POST` servido antes do `GET`) | `['Gato','Nova','Sapo']` — sem duplicata | `inserirEmOrdem` remove por `id` **antes** de inserir; f(f(x)) = f(x). Idempotente |
| `remover` reaplicado sobre lista que **já não tem** o item | `['Sapo']` | `filter` sobre `id` ausente é no-op. Idempotente |
| `remover` reaplicado sobre lista que **ainda tem** o item | `['Sapo']` | Correto |
| Falha da listagem com escrita pendente + "Tentar novamente" | `'erro'` → depois `['Gato','Nova','Sapo']` | Sem duplicata: a partida da nova listagem zera o registro **antes** de a requisição sair |
| Duas listagens concorrentes + escrita no meio | 1ª (ultrapassada) descartada inteira mantendo `'carregando'`; 2ª aplica `['Gato','Nova','Sapo']` | Correto — e o detalhe decisivo é que o `.then` descartado **retorna antes** de tocar em `escritasDesdeAPartida`. Se ele zerasse o registro, a escrita do intervalo seria perdida |
| Escrita **anterior** à partida da nova listagem | Não é reaplicada | Correto sob a pré-condição da suggestion #9 abaixo |
| Escrita depois de a resposta já ter chegado | `['Gato','Nova','Sapo']` | Correto |

**A alegação de idempotência das três escritas confere.** `adicionar` e `substituir` são a mesma função e `inserirEmOrdem` é idempotente por construção (filtra por `id` antes de inserir); `remover` é `filter`, idempotente por definição. Vale registrar que idempotência sozinha não bastaria: o `reduce` também precisa preservar **ordem**, e preserva — as escritas voltam na sequência em que foram registradas, então `adicionar(X)` seguido de `remover(X.id)` reproduz a ausência de X, e o inverso reproduz a presença. Verificado nos dois sentidos.

Um ponto que o comentário não diz e sustenta o resto: a reaplicação nunca pode "envelhecer" o retrato porque o objeto guardado na escrita é sempre **mais novo** que o do servidor — `onCreated(especie)` recebe a resposta do `POST`, que já é a forma normalizada pela RN-03. Vira pré-condição para a 010 (suggestion #9).

#### Invariantes reverificadas

- **"Tentar novamente" recarrega quantas vezes for acionado**: `listSpecies` chamado **4** vezes (1 de mount + 3 acionamentos). A trava de `useRef` continua guardando o efeito de entrada, não `recarregar` — o sequenciamento novo não a tocou.
- **`<StrictMode>` dispara o `GET` exatamente uma vez**: **1** chamada, medido com `wrapper: StrictMode`. Nota adicional: o `<StrictMode>` do React 18 invoca o atualizador funcional de `setSpecies` **duas vezes** em desenvolvimento para detectar impureza; `inserirEmOrdem` e `filter` são puros, então o novo `escrever` passa incólume por esse crivo.

#### Medição de cor de `species-row.tsx` — amostrada de novo

Amostrei eu mesmo os três pares de ícones em `assets/current-state-admin-especies.png` (1023×511), varrendo cada caixa e tomando o pixel de maior saturação HSV:

| | linha 1 | linha 2 | linha 3 |
|---|---|---|---|
| lápis | `(116,144,186)` matiz **216,0** | `(132,144,193)` matiz **228,2** | `(130,147,198)` matiz **225,0** |
| lixeira | `(123,67,76)` matiz **350,4** | `(135,67,83)` matiz **345,9** | `(174,79,98)` matiz **348,0** |

**O comentário está correto no que sustenta a decisão.** Em todos os pixels de lápis amostrados — dezenas, não três — o **verde está acima do vermelho**, sem uma única exceção. `brand.purple` `#7c3aed` é `(124,58,237)`, matiz 262,1, com o verde 58 contra o vermelho 124: a relação **invertida**. `brand.orange-dark` `#c44a10` é `(196,74,16)`, matiz 19,3, azul 16 — contra os 67 a 115 de azul medidos na lixeira.

**O argumento novo sobre mistura com branco também confere, e é o que fecha o caso.** Misturar `C` com branco por fator `t` dá `t·C + (1−t)·255` em cada canal, logo `R′−G′ = t·(R−G)`: as diferenças entre canais são todas multiplicadas pelo mesmo `t` e o matiz é preservado **exatamente**. Um roxo de matiz 262 desbotado sobre cartão branco continua matiz 262 — não há fator de mistura que o leve a 216. A premissa falsa da rodada 1 está corrigida e substituída por uma verdadeira.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 9 | suggestion | `src/pages/admin/species/use-species-collection.ts` | L147-150, L166-168 | contrato | A técnica inteira repousa numa pré-condição que nenhum comentário enuncia: **toda escrita registrada em `escrever` já está durável no servidor**. É ela que legitima zerar `escritasDesdeAPartida` na partida — o registro é descartado porque o retrato que vem a caminho já o contém. Uma escrita **otimista** (remover da lista antes de o `DELETE` resolver) seria descartada na partida e o item **voltaria** no retrato do servidor. Hoje o único chamador respeita a regra por acaso (`onCreated` roda depois do `await createSpecies`). | Enunciar a pré-condição no comentário de `escritasDesdeAPartida`: `adicionar`/`substituir`/`remover` só podem ser chamados **depois** de a requisição correspondente resolver, e sempre com o objeto que o servidor devolveu — nunca com o que o usuário digitou. Item de herança da TASK-FRONTEND-010. |
| 10 | suggestion | `src/pages/admin/species/use-species-collection.ts` | L216-231 | proteção | A regra "toda escrita local passa por `escrever`" está guardada **só por comentário**. `setSpecies` continua no escopo do corpo do hook; uma edição futura que o chame direto reintroduz o achado #1 em silêncio, sem `typecheck` vermelho e sem teste vermelho. | A proteção real é um teste de regressão, não um comentário: a TASK-FRONTEND-011 deve incluir o cenário "listagem em voo + escrita local + resposta antiga chega depois" (`listSpecies` diferido, `adicionar`, resolver com o retrato anterior, esperar a criada **e** as demais). É o único guarda que quebra quando alguém contorna `escrever`. |
| 11 | suggestion | `src/pages/admin/species/use-species-collection.ts` | L249-254 | modelagem | O achado #7 da rodada 1 (`substituir` com `id` ausente insere em vez de falhar) fica **amplificado** pela reaplicação: a ressurreição agora acontece também por cima do retrato do servidor. Cenário: administrador A renomeia a espécie X enquanto o administrador B a exclui; o `GET` volta sem X, a reaplicação recoloca X, e ela persiste até o próximo recarregamento. Só alcançável a partir da 010 e só com dois atores. | Manter a decisão (uma implementação para os dois nomes). Se a 010 precisar da distinção, separar lá — e registrar a consequência no comentário junto com a pré-condição da #9. |
| 12 | suggestion | `src/pages/admin/species/species-row.tsx` | L37-41 | precisão | O intervalo declarado para o lápis (`(116,144,186)` a `(130,147,198)`, "matiz 216 a 227") é um fio mais apertado do que a medição sustenta: pela mesma métrica, a linha 2 dá `(132,144,193)`, matiz 228,2 — fora dos dois limites. E "o azul entre 98 e 115" na lixeira vale para os pixels escolhidos, mas o ícone tem pixels saturados com azul em 67 e 83. Nenhuma das duas imprecisões toca a conclusão. | Alargar para "matiz 216 a 228" e "azul entre 67 e 115", ou declarar a janela de amostragem. O argumento que decide o caso (verde acima do vermelho em todos os pixels, e mistura com branco preserva o matiz) não depende do intervalo. |
| 13 | suggestion | `src/pages/admin/species/use-species-collection.ts` | L198-204 | limpeza | O `.catch` não zera `escritasDesdeAPartida`: as closures do intervalo sobrevivem até a partida da listagem seguinte. **Sem consequência funcional** — verificado: a próxima `recarregar` zera na partida, antes de a requisição sair, e o retrato que chega já contém aquelas escritas. Custo é só retenção de memória entre a falha e a próxima tentativa. | Nenhuma ação. Registrado para que uma leitura futura não "conserte" isso achando que há perda de escrita, e nem se convença de que zerar no `.catch` mudaria alguma coisa: os dois caminhos produzem o mesmo estado final. |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 16 de 16 critérios continuam implementados; **nenhuma regressão**. Os únicos critérios sob risco eram os que o hook sustenta, e os quatro foram remedidos em bancada: ordem alfabética preservada (`['Gato','Nova','Sapo']` em todos os cenários, CT-13/CT-14/CA-04); a espécie criada aparece na posição correta mesmo com listagem em voo (CT-01/CA-05) — que passou de *frágil* a *garantido*; "Tentar novamente" refaz a chamada quantas vezes for acionado (CT-36); `StrictMode` dispara uma única listagem. Os demais doze vivem em `species-create-form.tsx` e `species-page.tsx`, **não tocados nesta rodada** (mtime `15:12` e `15:13`, contra `15:37` e `15:38` dos dois corrigidos). Sem achados.

**Pass 2 — Diff Analysis**: `git status` na raiz devolve exatamente `M services/frontend/src/pages/admin/species-page.tsx` e `?? services/frontend/src/pages/admin/species/` — o mesmo da rodada 1, mais o próprio arquivo da task. Como os três arquivos novos são não rastreados, confirmei o alcance da correção por mtime: `use-species-collection.ts` `15:38:59` e `species-row.tsx` `15:37:49` mudaram; `species-create-form.tsx` `15:12:41` e `species-page.tsx` `15:13:40` não. `http-client.ts` (`18:18` de 22/08), `species-api.ts` (`15:03`), `validation.ts`, `messages.ts`, `app-routes.spec.tsx` e todo `src/components/ui/` (`13:xx` ou anterior) estão intactos. **Nenhuma sonda deixada para trás**: `grep` por `console.`, `debugger`, `TODO`, `FIXME` em `src/pages/admin/` → zero; a sonda de bancada que este revisor criou foi apagada e `git status` voltou ao mesmo conteúdo. Sem achados.

**Pass 3 — Code Practices**: o hook cresceu de ~180 para 271 linhas, mas o **código** são 97 linhas — a razão comentário/código está alta e é a da base. Um nível de indentação por função; sem `else`; `escrever` é ponto único com responsabilidade única declarada no nome; `EscritaLocal` encapsula a operação em vez do resultado, o que é o que permite aplicar e reaplicar com uma declaração só. Nomes sem abreviação e no vocabulário PT-BR interno já estabelecido. `useCallback` com dependências corretas (`escrever` estável em `[]`, os dois consumidores em `[escrever]`), sem quebrar a identidade estável que `onRetry` exige. Zero `any`. Achados: #10, #11, #13.

**Pass 4 — Testing Review**: esta task não entrega testes. Reproduzi os cenários por sonda temporária (11 casos, todos verdes), já apagada. A suíte oficial segue em 12 suítes / 160 testes / 0 falhas. Os **5** avisos de `act(...)` continuam sendo 5 e continuam saindo do mesmo lugar — conferi as cinco pilhas, todas em `SpeciesPage` a partir de `species-page.tsx:55`, ou seja o `setStatus('erro')` do `.catch` de `recarregar`, agora atrás da guarda de sequência. O achado #2 da rodada 1 permanece aberto e com dono: TASK-FRONTEND-011. Achado: #10.

**Pass 5 — Security Review**: OWASP Top 10 reaplicado sobre a diferença. A correção não abre superfície nova: não há nova fronteira de confiança, nenhuma entrada nova, nenhuma renderização nova. O que mudou é estado em memória do cliente. **A03/A02/A05/A10** sem superfície nova. **A01**: nada mudou na autorização, que continua sendo do backend. **A09**: o `.catch` continua descartando o erro sem registro — pelo mesmo motivo que a rodada 1 aceitou (não há uma única chamada a `console.*` em `src/`, e `auth-provider.tsx:143` já engole igual); segue não sendo achado. **A08**: a reaplicação usa objetos que vieram da própria API, nunca desserialização de entrada não confiável. **Sem achados de segurança.**

**Pass 6 — Bug Detection**: li os dois arquivos alterados por inteiro e reli os outros dois, mais `species-api.ts` e o `ConfirmDialog` que a 010 vai usar. Nulos guardados; sem off-by-one (`findIndex` + `slice`, `filter`, `reduce` — nenhuma indexação numérica, coerente com `noUncheckedIndexedAccess`); sem coerção frouxa; sem `catch` vazio; sem vazamento de recurso. O `reduce` tem tipo explícito (`reduce<ReadonlyArray<Species>>`), o que é o certo aqui — sem ele o acumulador herdaria o tipo de `resposta.items` e a reaplicação inferiria mutabilidade. Nenhuma escrita nova em estado depois de desmontagem foi introduzida. A corrida do achado #1 não é mais alcançável por nenhum dos caminhos que exercitei. Achados: #9, #11, #13.

**Pass 7 — Project Patterns**: estrutura, alias `~/`, `readonly` nas props, JSDoc de intenção que explica o **porquê** e não o **quê**, catálogo `MESSAGES` como única fonte de texto. A união literal e o `useRef` de trava seguem os precedentes citados (`confirm-email-page.tsx`, `AuthProvider`). Linguagem ubíqua respeitada: `Species` no que atravessa a API, PT-BR no vocabulário interno. Os dois comentários novos declaram medição verificável em vez de afirmação — que é justamente o que a rodada 1 cobrou. Achado: #12.

---

#### O que a TASK-FRONTEND-010 herda

**1. Regra nova e obrigatória: toda escrita local passa por `escrever`.** As três operações do hook já passam; a 010 não deve criar uma quarta que chame `setSpecies` direto. **A regra NÃO está protegida por nada além de comentário** — `setSpecies` continua no escopo do corpo do hook, o `typecheck` não a conhece e nenhum teste a cobra hoje. A proteção real é o teste de regressão da suggestion #10, e ele é da 011. Até ele existir, a única defesa é a leitura.

**2. Pré-condição das escritas (suggestion #9), que é o item mais fácil de quebrar na 010.** `remover(id)` só pode ser chamado **depois** de `deleteSpecies` resolver, e `substituir(especie)` só com o objeto que o `PATCH` devolveu. Exclusão otimista — tirar da lista ao confirmar o diálogo e só então chamar a API — quebra o esquema: a escrita seria zerada na partida da listagem seguinte e o item **reapareceria**. O `ConfirmDialog` já entrega a peça certa para fazer do jeito certo: `isSubmitting`.

**3. `ConfirmDialog` precisa de cuidado extra, e por um motivo que esta técnica torna imediato.** O `cleanup` do efeito de `open` (`confirm-dialog.tsx:118-124`) devolve o foco chamando `refDoElementoFocadoAntes.current?.focus()` — e esse elemento é a **lixeira da linha que acabou de ser excluída**. Como `remover` é escrita local, a linha desmonta no mesmo instante em que o diálogo fecha, e o `focus()` cai sobre um elemento já destacado do DOM: no-op silencioso, foco no `<body>`, exatamente o defeito que o comentário daquele arquivo diz estar evitando. É o **primeiro** fluxo do projeto em que quem abriu o diálogo desaparece ao confirmar — o `ConfirmDialog` não foi escrito para isso. A 010 precisa mandar o foco para um alvo que sobreviva: o `<h1>`, a região da lista ou o próprio `StatusMessage` do resultado. Isso vale para o caminho de **confirmação**; no de **cancelamento** a devolução atual está correta e deve continuar.

**4. Herança da rodada 1 que continua de pé.** Achado #3 (comentário do lápis): **resolvido nesta rodada**, a 010 não precisa mais decidir variante — não há "roxo da captura" a reproduzir. Achado #7, agora amplificado pela reaplicação: ver suggestion #11. Achado #6: durante `'carregando'` com aviso presente a tela já monta dois `role="status"`; com o diálogo da 010 no ar os seletores de teste precisam de qualificador.

#### Veredicto

> **APROVADA** — a correção do achado #1 é sólida e melhor do que a que este revisor havia recomendado; a do achado #3 confere na medição. 16 de 16 critérios de aceite seguem implementados, nenhum regrediu. `typecheck` exit 0, `npm test` exit 0 (12 suítes / 160 testes), 5 avisos de `act(...)` — o mesmo número, dos mesmos emissores.
>
> **Retratação registrada:** a recomendação do achado #1 na rodada 1 — número de sequência sozinho — **não conserta o defeito que o próprio achado descreve**, e isso foi demonstrado em bancada (`['Gato','Sapo']`: a espécie criada some). A contestação do agente estava certa em cada ponto, inclusive no descarte do `AbortController` e na escolha de reaplicar em vez de descartar.
>
> **Nada novo bloqueia.** Cinco `suggestion` (#9 a #13), todas de registro ou herança.
>
> **Continuam com dono obrigatório:**
> - **TASK-FRONTEND-011** — achado #2 da rodada 1 (dublar `~/services/api/species-api` em `src/routes/app-routes.spec.tsx` e zerar os 5 `console.error`), **mais** a suggestion #10: o teste de regressão da corrida, que é o único guarda real da regra de `escrever`.
> - **TASK-FRONTEND-010** — a pré-condição da suggestion #9 (escrever só depois de o servidor confirmar, com o objeto do servidor), a suggestion #11 (`substituir` com `id` ausente) e a devolução de foco do `ConfirmDialog` sobre uma linha que deixou de existir.
>
> **Continuam encaminhados, e não são desta task:** o fundo do `<main>` (dono: TASK-FRONTEND-007) e a divergência entre `UNEXPECTED_ERROR` aqui e `erro.message` no `login-page.tsx` (decisão de nível de spec).
