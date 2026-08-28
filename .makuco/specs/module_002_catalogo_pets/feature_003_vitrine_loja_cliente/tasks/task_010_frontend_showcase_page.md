# TASK-FRONTEND-010 — Página da vitrine: orquestração, paginação e estados

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-010-frontend-showcase-page`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 10 of 11 — Tela completa
**Generated**: `2026-08-25`

---

## Context

Substitui o placeholder da TASK-FRONTEND-006 pela vitrine completa: busca os dados, decide entre os cinco estados da grade, pagina e anuncia mudanças. Duas obrigações não têm equivalente no resto do produto: a grade **não pode esperar a restauração da sessão** para carregar (RN-04), e respostas que chegam fora de ordem precisam ser descartadas por sequência, porque o cliente HTTP em uso **não oferece cancelamento** (RN-53).

---

## Scope

**In:** `showcase-page.tsx` completa — orquestração das três consultas, sequência anti-resposta-obsoleta, controles de paginação, resumo de resultados, os cinco estados da grade e a região viva de anúncio.

**Out:**
- Não alterar `showcase-layout.tsx`, `app-routes.tsx`, `route-paths.ts` nem `client-layout.tsx` (TASK-FRONTEND-006 os entregou).
- Não alterar `catalog-api.ts` nem `http-client.ts` (TASK-FRONTEND-007, Decisão E).
- Não reimplementar cartão, grade, etiqueta, estado vazio, esqueleto ou barra de filtros (TASK-FRONTEND-008/009) — esta task **compõe**.
- **Nada de rolagem infinita nem de "carregar mais"** (RN-18, Decisão C): sem posição compartilhável por link, sem observação de interseção — que a base de dependências não possui —, com a última página inalcançável por teclado, e sem voltar a um resultado já visto.
- Nenhuma ordenação configurável pelo visitante (RN-16).
- Nenhuma biblioteca de estado de servidor. `useState` + `useEffect` bastam (CA-55).
- Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/pages/showcase/showcase-page.tsx` | tela completa |
| `create` | `src/pages/showcase/use-public-animals.ts` | consulta com sequência |
| `create` | `src/pages/showcase/use-filter-options.ts` | opções de espécie e cidade |

---

## Implementation

### `src/pages/showcase/use-public-animals.ts` *(create)*
**Reference pattern**: `src/contexts/auth/auth-provider.tsx` — efeito que dispara requisição, estado discriminado, limpeza no desmonte.

**Decisões já fechadas**:
- Estado discriminado por união, não por três booleanos independentes: `{ tipo: 'carregando' } | { tipo: 'pronto'; items; pagination } | { tipo: 'erro'; mensagem }`. Booleanos soltos permitem `carregando && erro` simultâneos, que é como uma tela passa a exibir dois estados ao mesmo tempo.
- **Descarte de resposta obsoleta por sequência** (RN-53, CA-18, CT-36): um contador em `useRef` é incrementado a cada disparo; a resposta só é aplicada se a sua sequência ainda for a maior. O cliente HTTP não oferece `AbortSignal` e esta feature **não** o altera — o descarte é da tela. É o mesmo princípio já adotado na RN-57 da FEATURE-002 deste módulo para a lista de cidades.
- O efeito depende dos filtros **já traduzidos** por `toApiFilters` — não do objeto de estado inteiro, que muda de identidade a cada render.
- **A consulta dispara na montagem, sem ler `status` de sessão** (RN-04, CA-04, CT-07). Nada neste hook lê `useAuth()`. Uma vitrine que espera o bootstrap para carregar deixa de ser pública na prática.
- Falha → `{ tipo: 'erro' }` com a mensagem do `ApiError` quando ela vier do backend (é o caso do `429`), e o texto de catálogo "Não foi possível carregar os animais. Tente novamente." quando não vier. Nunca ramificar pelo texto de `message` — só por `code` (RN-67, CA-39, CT-95, CT-108).
- Expor `retry()`, que reincrementa a sequência e redispara.

### `src/pages/showcase/use-filter-options.ts` *(create)*
- Carrega espécies e cidades **uma vez na montagem**, em paralelo, com estados de erro **independentes** por lista.
- **A falha aqui não bloqueia a grade** (CA-39, CT-96, HU-11 cenário 7): a grade continua carregando e sendo exibida; apenas o campo afetado informa a falha. São três consultas independentes e um `Promise.all` único faria uma derrubar as outras — usar `Promise.allSettled` ou efeitos separados.
- Recarregar as opções quando os filtros mudam **não** é requisito: as listas derivam do catálogo disponível, não do recorte filtrado (RN-30, RN-31).

### `src/pages/showcase/showcase-page.tsx` *(modify)*
**Reference pattern**: `src/pages/auth/login-page.tsx` — composição de componentes, estado local, sem lógica de rede inline.

**Estrutura**:
1. `<h1>Animais para adoção</h1>` (CA-07).
2. `<ShowcaseFilterBar />` com as opções e os erros dos hooks.
3. **Resumo de resultados** — exibido **apenas** quando `hasActiveFilters` é verdadeiro: "1 animal encontrado" / "N animais encontrados", com concordância. Sem filtro aplicado, **nenhum** resumo, como na captura (CT-97, CT-44).
4. Grade / estado, nesta ordem de decisão — a ordem **é** a regra:
   - `carregando` → `CardSkeleton`, com a barra de filtros permanecendo visível e utilizável, e **nenhuma** das duas mensagens de vazio (CA-38, CT-94);
   - `erro` → mensagem de falha com ação de **nova tentativa**, e **nunca** uma das mensagens de vazio (CA-39, CT-95);
   - `pronto` e `items.length > 0` → `AnimalGrid`;
   - `pronto`, vazio e **com** filtros aplicados → "Nenhum animal encontrado com os filtros aplicados." + ação "Limpar filtros" (CT-92);
   - `pronto`, vazio e **sem** filtros → "Nenhum animal disponível para adoção no momento. Volte em breve!", **sem** ação (CT-91).
   - **O ramo "com filtros" é avaliado antes do de catálogo vazio**: com o catálogo vazio *e* filtros aplicados, vale a mensagem de filtros, que é a que oferece ação útil ao visitante (CA-37, CT-93).
5. Paginação abaixo da grade, **somente quando `total > pageSize`** (RN-19, CA-14, CT-72, CT-73). Com um único animal — o caso da captura — nenhum controle aparece.
6. Região viva (`aria-live="polite"`, `aria-atomic`) anunciando a mudança de resultado: a quantidade quando há resultados e a mensagem quando não há (RNF-26, CA-53, CT-124, QA-56). Uma única região; duas competem e o leitor de tela perde uma.

**Decisões já fechadas**:
- Troca de página → **rolagem de volta ao topo da grade**, e não ao topo do documento: o visitante começa a nova página pelo primeiro cartão, com a barra de filtros ainda à vista (RN-21, CT-80, QA-34). `scrollIntoView` sobre uma `ref` da grade, respeitando `prefers-reduced-motion`.
- Primeira página → ação de anterior desabilitada; última → ação de seguinte desabilitada. Desabilitar, não ocultar (CT-75).
- Página além da última → o servidor responde `200` com lista vazia; a tela exibe a mensagem de nenhum resultado, **sem erro e sem tela quebrada** (CA-15, RN-20, CT-76).
- `pageSize` **não** é exposto ao visitante. O padrão de 12 vem do servidor (RN-17).
- **Nada nesta página lê `useAuth()`.** A sessão altera apenas o cabeçalho, que é do layout (RN-03, RN-06). Um `if (user)` aqui seria a porta de entrada para a divergência que a CA-03 proíbe.
- A página é **exclusivamente de leitura**: nenhum `POST`, `PATCH` ou `DELETE` é disparado por nenhuma interação (RN-08, CA-48, CT-131).

---

## Acceptance Criteria

- [ ] **Given** nenhuma sessão, **When** `/animais` carrega, **Then** o título, a barra de filtros e a grade são exibidos, e a consulta à listagem parte sem esperar a restauração da sessão (CA-01, CA-04, RN-04, CT-01, CT-07, QA-01).
- [ ] **Given** uma credencial vencida no navegador, **When** a vitrine carrega, **Then** a grade é exibida normalmente, nenhuma renovação de sessão é disparada e nenhum redirecionamento ocorre (CA-04, RN-05, CT-03, RNF-13).
- [ ] **Given** a mesma consulta como visitante, como `cliente` e como `admin`, **When** a grade renderiza, **Then** a lista, os filtros e os campos de cada cartão são **idênticos** nos três casos (CA-03, RN-03, CT-04, QA-05).
- [ ] **Given** duas consultas disparadas em sequência rápida e a **primeira** respondendo por último, **When** as respostas chegam, **Then** prevalece a da **última** consulta disparada e a obsoleta é descartada (CA-18, RN-53, CT-36).
- [ ] **Given** um filtro aplicado com 1 e com 3 resultados, **When** o resumo renderiza, **Then** exibe "1 animal encontrado" e "3 animais encontrados"; **Given** nenhum filtro aplicado, **Then** nenhum resumo está no DOM (CT-97, CT-44).
- [ ] **Given** um filtro que reduz o conjunto, **When** o resumo renderiza, **Then** a contagem é a do conjunto filtrado, e não a do catálogo (CT-98, RNF-12).
- [ ] **Given** a consulta pendente, **When** a tela renderiza, **Then** o esqueleto ocupa o lugar da grade, a barra de filtros permanece visível e utilizável, e **nenhuma** das duas mensagens de vazio está no DOM (CA-38, CT-94).
- [ ] **Given** a consulta falhando, **When** a tela renderiza, **Then** exibe "Não foi possível carregar os animais. Tente novamente." com ação de nova tentativa, e **nenhuma** mensagem de vazio (CA-39, CT-95).
- [ ] **Given** um `429` do limitador, **When** a tela renderiza, **Then** apresenta a mensagem em PT-BR devolvida pelo backend com possibilidade de nova tentativa — nunca tela em branco (RN-67, CT-108, QA-50).
- [ ] **Given** a falha ao carregar as opções de um filtro, **When** a tela renderiza, **Then** a grade **continua sendo carregada e exibida** e apenas o campo afetado informa a falha (CA-39, CT-96).
- [ ] **Given** catálogo sem nenhum animal disponível e nenhum filtro aplicado, **Then** "Nenhum animal disponível para adoção no momento. Volte em breve!", **sem** ação de limpar filtros (CA-37, CT-91, QA-42).
- [ ] **Given** animais disponíveis e filtros que não encontram nenhum, **Then** "Nenhum animal encontrado com os filtros aplicados." **com** a ação "Limpar filtros" (CA-37, CT-92, QA-43).
- [ ] **Given** catálogo vazio **e** filtros aplicados, **Then** vale a mensagem de filtros aplicados (CA-37, CT-93).
- [ ] **Given** o estado vazio com filtros, **When** "Limpar filtros" é acionado, **Then** a grade volta a exibir os animais disponíveis (CT-92, QA-44).
- [ ] **Given** um único animal disponível, **When** a tela renderiza, **Then** **nenhum** controle de navegação entre páginas está no DOM (CA-14, RN-19, CT-72).
- [ ] **Given** total acima do tamanho da página, **When** a tela renderiza, **Then** os controles aparecem abaixo da grade; na primeira página a ação de anterior está desabilitada e na última a de seguinte (CT-73, CT-75).
- [ ] **Given** `pagina` além da última existente, **When** a página carrega, **Then** a grade vem vazia com a mensagem de nenhum resultado, **sem erro** (CA-15, CT-76).
- [ ] **Given** a lista rolada, **When** o visitante troca de página, **Then** a apresentação volta ao **topo da grade** (RN-21, CT-80, QA-34).
- [ ] **Given** um leitor de tela ativo, **When** um filtro é aplicado, **Then** a mudança de resultado é anunciada, incluindo a quantidade e os estados de vazio (CA-53, RNF-26, CT-124, QA-56).
- [ ] **Given** toda a tela exercitada, **When** as requisições são observadas, **Then** todas são `GET` e nenhum registro do cadastro é alterado (CA-48, RN-08, CT-131).
- [ ] **Given** o código desta página, **When** inspecionado, **Then** não há chamada a `useAuth()` nem qualquer ramo condicionado à presença de sessão (RN-03, CA-03).
- [ ] **Given** apenas o teclado, **When** a tela é percorrida, **Then** busca, cinco filtros, "Limpar filtros", paginação e as ações do cabeçalho são alcançáveis e acionáveis em ordem coerente (CA-53, RNF-25, CT-123, QA-53).
- [ ] **Given** toda a rede externa bloqueada exceto a própria API, **When** a vitrine é usada, **Then** grade, filtros e paginação continuam funcionando — nenhuma dependência externa está no caminho de leitura de dados (RNF-15, CT-112).
- [ ] **Given** 500 animais disponíveis, **When** a vitrine abre, **Then** a primeira página é exibida em menos de 2 segundos; **When** busca e os cinco filtros são aplicados, **Then** a grade atualiza em menos de 2 segundos (RNF-17, RNF-18, CT-128, CT-129).
- [ ] **Given** `package.json`, **When** comparado, **Then** continua com exatamente três dependências de execução (CA-55).
- [ ] `npm run typecheck` com 0 erros, sem `any`.

---

## Dependencies

- **Requires**: TASK-FRONTEND-006 (rota, layout e placeholder), TASK-FRONTEND-007 (`catalog-api`), TASK-FRONTEND-008 (cartão, grade, estados, esqueleto, `formatAge`), TASK-FRONTEND-009 (barra de filtros, `parseShowcaseFilters`, `toApiFilters`, `hasActiveFilters`) e, através dela, o componente `Pagination` da **FEATURE-002 deste módulo**.
- **Blocks**: TASK-FRONTEND-011.

---

## Revisão — 2026-08-28

**Status**: APROVADO

**658 testes, 41 suítes, 0 falha.** `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos, sem `any`. Três dependências de execução, as mesmas.

| Critério de aceite | Resultado |
|---|---|
| A consulta parte na montagem, sem esperar a sessão (CT-07) | **Confirmado da forma mais forte possível:** o spec renderiza a página **sem `AuthContext`**. Se ela lesse `useAuth()`, o hook lançaria |
| Credencial vencida não dispara renovação (CT-03) | **Confirmado na TASK-FRONTEND-007**, pelo `skipRefresh` das três chamadas |
| Corpos idênticos para visitante, `cliente` e `admin` (CT-04) | **Confirmado por construção:** não há `useAuth()` nem ramo condicionado a sessão nesta página nem nos dois hooks |
| Resposta obsoleta descartada por sequência (CT-36) | **Confirmado** com dois resolvedores manuais: a busca "gato" resolve **depois** de "ga", e prevalece "ga" |
| Resumo com 1 e com 3; ausente sem filtro (CT-97, CT-44) | **Confirmado** |
| Contagem do conjunto filtrado (CT-98) | **Confirmado** |
| Carregando: esqueleto, barra utilizável, sem mensagem de vazio (CT-94) | **Confirmado** |
| Falha com nova tentativa, sem mensagem de vazio (CT-95) | **Confirmado**, e a nova tentativa recarrega |
| `429` com a mensagem do backend (CT-108) | **Confirmado.** A frase vem do `ApiError`, e a ramificação é por `code` |
| Falha de opções não bloqueia a grade (CT-96) | **Confirmado:** a grade renderiza e só o campo afetado informa |
| Catálogo vazio sem filtros, **sem** ação (CT-91) | **Confirmado.** O único "Limpar filtros" no DOM é o da barra, desabilitado |
| Vazio com filtros, **com** ação (CT-92) | **Confirmado**, e a ação faz a grade voltar |
| Catálogo vazio **e** filtros → mensagem de filtros (CT-93) | **Confirmado** |
| Um único animal: nenhum controle de paginação (CT-72) | **Confirmado** |
| Controles com extremos desabilitados (CT-73, CT-75) | **Confirmado** |
| Página além da última: vazio sem erro (CT-76) | **Confirmado** |
| Troca de página volta ao topo da grade (CT-80) | **Confirmado por construção:** `scrollIntoView` sobre a `ref` da grade, respeitando `prefers-reduced-motion` |
| Região viva anuncia a mudança (CT-124) | **Confirmado:** existe **exatamente uma** `[aria-live]`, `polite` e `aria-atomic`, e ela anuncia também os vazios |
| Só `GET`; nenhuma escrita (CT-131) | **Confirmado:** o módulo dublado expõe apenas as três funções de leitura |
| Nenhum `useAuth()` nem ramo por sessão | **Confirmado por varredura:** as duas ocorrências do termo são comentários que registram a proibição |
| Endereço com filtros preenche a barra e vai à consulta (CT-82) | **Confirmado** |
| Endereço estragado exibe a vitrine normalmente (CT-86) | **Confirmado:** a consulta parte como `{ page: 1 }` |
| Nenhuma dependência nova | **Confirmado** |

### Notas de implementação

**Estado discriminado por união, e não três booleanos.** Com `carregando`, `erro` e `dados` soltos, a combinação `carregando && erro` é **representável** — e é assim que uma tela passa a exibir o esqueleto e a mensagem de falha ao mesmo tempo. Aqui ela não existe.

**A sequência mora em `useRef`, não em estado.** O valor precisa ser lido pelo closure da resposta no instante em que ela **chega**, e não no da renderização em que a requisição partiu. É o mesmo princípio da guarda de corrida das cidades na FEATURE-002.

**`replace` para filtro, `push` para página.** Cada tecla digitada na busca criaria uma entrada no histórico, e desfazer uma palavra exigiria dez cliques no botão de voltar. Trocar de página, ao contrário, é um passo que o visitante espera poder desfazer.

**Duas consultas de opções em promessas separadas, e não num `Promise.all`.** Um `all` faria uma falha nas cidades derrubar as espécies **e** — se a grade estivesse junto — esconder a vitrine inteira, que é o oposto do que a CA-39 pede.

**A ordem dos cinco ramos é a regra, e está escrita no comentário.** Em particular, "vazio **com** filtros" é avaliado antes de "catálogo vazio": com os dois verdadeiros, vale a mensagem de filtros — a única que dá ao visitante algo a fazer.

### Um ajuste que a escrita dos testes exigiu

Onze casos falharam por encontrarem o **mesmo texto duas vezes**: a região viva repete, de propósito, o que a tela mostra. A duplicação é o comportamento correto — é o mecanismo que anuncia a mudança de resultado —, e o que estava errado era a asserção. Os casos passaram a usar um auxiliar `visivel()`, que filtra o que está dentro de `[aria-live]` e afirma sobre o que o visitante **vê**. O caso da própria região viva continua afirmando sobre ela.

### Arquivo de teste escrito aqui

`showcase-page.spec.tsx` consta da TASK-FRONTEND-011. Foi escrito nesta task porque o descarte de resposta obsoleta e a ordem de decisão dos cinco estados são as duas obrigações que a task declara não terem equivalente no resto do produto — e nenhuma das duas é verificável por leitura.
