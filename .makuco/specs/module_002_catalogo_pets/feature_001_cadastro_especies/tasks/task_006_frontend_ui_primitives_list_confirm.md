# TASK-FRONTEND-006 — Primitivas de interface: lista, ações por ícone, estados e confirmação destrutiva

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-006-frontend-ui-primitives-list-confirm`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 6 of 11 — Base de componentes compartilhados
**Generated**: `2026-08-25`

---

## Context

A base de componentes do projeto tem 7 peças e todas servem a formulários de autenticação: **não existem** lista/tabela, botão de ícone, estado vazio, indicador de carregamento, confirmação de ação destrutiva nem aviso temporário de sucesso. Esta task cria essas primitivas em `src/components/ui/`, genéricas o bastante para a feature seguinte do módulo reusá-las, e é pré-requisito de toda a tela de espécies.

---

## Scope

**In:** `DataList`, `IconButton`, `EmptyState`, `LoadingIndicator`, `ErrorState`, `ConfirmDialog` e `StatusMessage`, todos em `src/components/ui/`, mais os ícones de lápis e lixeira.

**Out:** Nenhum componente aqui conhece "espécie" — nada de `SpeciesList` nem de texto da feature nas props default. Não instalar biblioteca (`react-select`, `radix`, `headlessui`, `clsx`, `react-modal`): as dependências de runtime continuam sendo exatamente `react`, `react-dom` e `react-router-dom`. Não usar plugin de Tailwind nem acrescentar token a `tailwind.config.js` — a paleta existente cobre todos os estados. Não criar a tela nem tocar em `src/pages/` (TASK-FRONTEND-009 e 010). Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/data-list.tsx` | lista genérica com linhas |
| `create` | `src/components/ui/icon-button.tsx` | ação por ícone acessível |
| `create` | `src/components/ui/icons.tsx` | lápis e lixeira |
| `create` | `src/components/ui/feedback-states.tsx` | vazio, carregando, erro |
| `create` | `src/components/ui/confirm-dialog.tsx` | confirmação destrutiva |
| `create` | `src/components/ui/status-message.tsx` | aviso de resultado |

---

## Implementation

> **Reference pattern**: `src/components/ui/text-field.tsx` (props `readonly`, `sr-only` para rótulo, spread condicional de atributos ARIA, classes Tailwind em constante de módulo) e `src/components/ui/alert-message.tsx` (mapa `Readonly<Record<variante, classes>>` e `role="alert"`).

### `src/components/ui/data-list.tsx` *(create)*
- Componente genérico: `DataList<T>({ items, getKey, renderRow, ariaLabel })`. Renderiza `<ul>` com um `<li>` por item; o conteúdo da linha é responsabilidade de quem chama.
- `<ul>`/`<li>` e **não** `<table>`: a lista tem uma única coluna de dado e duas ações — uma tabela de uma coluna acrescenta semântica de grade que o leitor de tela anuncia sem que exista grade. `aria-label` na `<ul>` nomeia a região.
- Cada `<li>` usa `flex items-center justify-between gap-4` com `border-b border-hairline` entre linhas (`last:border-b-0`), `bg-surface-card`, `rounded-card` no contêiner. Altura mínima de linha `min-h-[56px]`, que já acomoda alvos de toque de 44px.
- `getKey` obrigatório e tipado — nunca usar o índice do array como `key`: com a lista reordenando após renomear, o índice remontaria linhas erradas e o foco saltaria.

### `src/components/ui/icon-button.tsx` *(create)*
- `IconButton({ label, icon, onClick, disabled, variant })` — renderiza `<button type="button">` com o ícone em `aria-hidden` e o texto em `<span className="sr-only">{label}</span>`.
- `label` é **obrigatório** e é prop de string, não opcional com default: é ele que satisfaz o RNF-07 (nome acessível identificando ação **e** o item — quem chama passa `"Editar espécie Gato"`).
- Área clicável mínima de 44×44 (`h-11 w-11 inline-flex items-center justify-center rounded-field`) — RNF-06/alvos de toque.
- Foco visível por `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple`, no mesmo estilo já usado em `admin-layout.tsx`.
- Variantes `default` (ícone `ink-mid`, hover `bg-brand-purple-light`) e `danger` (ícone `brand-orange-dark`, hover `bg-surface-input`). A cor **não** é o único indicador: o nome acessível carrega o significado.

### `src/components/ui/icons.tsx` *(create)*
- `PencilIcon` e `TrashIcon` como SVG inline, `focusable="false"` e `aria-hidden="true"`, `currentColor` no `stroke`/`fill`, tamanho controlado por prop `size` (default 18).
- SVG inline e não pacote de ícones: acrescentar `lucide-react` ou similar levaria as dependências de runtime de 3 para 4 por dois desenhos.

### `src/components/ui/feedback-states.tsx` *(create)*
- Três componentes pequenos no mesmo arquivo, porque são declarações sem lógica e sempre aparecem juntos no mesmo ponto da tela:
  - `EmptyState({ message })` — `<p>` centralizado em `text-ink-mid`, dentro do mesmo cartão da lista.
  - `LoadingIndicator({ label })` — marcação com `role="status"` e o texto em `sr-only`, mais um pulsar puramente decorativo por `animate-pulse`. `role="status"` (e não `role="alert"`) porque carregamento é informação educada, que não deve interromper o leitor de tela.
  - `ErrorState({ message, onRetry, retryLabel })` — mensagem mais um `<button>` de nova tentativa. `onRetry` é obrigatório: um estado de erro sem saída é o defeito que este componente existe para impedir.
- Nenhum dos três traz texto embutido — toda string chega por prop, vinda do catálogo do consumidor.

### `src/components/ui/confirm-dialog.tsx` *(create)*
- `ConfirmDialog({ open, title, description, confirmLabel, cancelLabel, onConfirm, onCancel, isSubmitting })`. Retorno antecipado `null` quando `open === false` — montar e desmontar, e não esconder por CSS.
- Marcação: overlay `fixed inset-0 bg-ink/40` + painel com `role="dialog"`, `aria-modal="true"` e `aria-labelledby`/`aria-describedby` apontando para o título e a descrição.
- Comportamento de teclado, obrigatório e todo implementado à mão (não há biblioteca de diálogo no projeto):
  - foco move para o botão de confirmar ao abrir (`useEffect` + `ref`);
  - `Escape` chama `onCancel`;
  - `Tab`/`Shift+Tab` circulam **apenas** entre confirmar e cancelar (armadilha de foco sobre dois elementos conhecidos — não é preciso varrer o DOM);
  - ao fechar, o foco volta ao elemento que tinha foco antes da abertura (guardar em `ref` no momento da montagem).
  Sem isso o RNF-06/CT-37 não se sustenta: um diálogo modal sem armadilha de foco deixa o teclado navegar a lista atrás dele.
- O botão de confirmar usa a variante de perigo (borda/fundo `brand-orange`) e o de cancelar é neutro; **cancelar é o primeiro na ordem de leitura** para que o Enter acidental não destrua nada.
- `isSubmitting` desabilita os dois botões.

### `src/components/ui/status-message.tsx` *(create)*
- `StatusMessage({ variant, children })`, com `role="status"` e `aria-live="polite"`.
- Distinto do `AlertMessage` existente e **sem** substituí-lo: `AlertMessage` usa `role="alert"` (assertivo), correto para erro de formulário que interrompe; o resultado de uma operação concluída deve ser anunciado sem interromper (RNF-09). Reusar a mesma paleta por variante de `alert-message.tsx` para que as duas peças pareçam a mesma família.
- Como o `role` implica região viva, o componente precisa ser **montado quando a mensagem surge** — não renderizado vazio e depois preenchido, mesma observação já registrada em `alert-message.tsx`.

---

## Acceptance Criteria

- [ ] **Given** `DataList` com três itens, **When** renderizado, **Then** produz uma `<ul>` com `aria-label` e exatamente três `<li>`, e nenhuma `<table>` aparece no DOM.
- [ ] **Given** `IconButton` sem `label`, **When** compilado, **Then** o TypeScript recusa — `label` é obrigatório.
- [ ] **Given** `IconButton label="Editar espécie Gato"`, **When** consultado por `getByRole('button', { name: 'Editar espécie Gato' })`, **Then** é encontrado, e o `<svg>` está `aria-hidden` (RNF-07 / CT-38).
- [ ] **Given** `ConfirmDialog open={false}`, **When** renderizado, **Then** **nada** existe no DOM — verificado por ausência, não por estilo.
- [ ] **Given** `ConfirmDialog open`, **When** montado, **Then** o foco está no botão de confirmar e o painel tem `role="dialog"` com `aria-modal="true"`.
- [ ] **Given** o diálogo aberto, **When** `Tab` é pressionado repetidamente, **Then** o foco circula apenas entre cancelar e confirmar; **When** `Escape` é pressionado, **Then** `onCancel` é chamado e `onConfirm` não (CT-37).
- [ ] **Given** o diálogo fechado após abertura, **When** o foco é inspecionado, **Then** ele voltou ao elemento que o tinha antes.
- [ ] **Given** `LoadingIndicator`, **When** renderizado, **Then** existe um elemento com `role="status"` cujo nome acessível é o `label` recebido.
- [ ] **Given** `ErrorState`, **When** renderizado, **Then** existe um botão de nova tentativa acionável por teclado que chama `onRetry`.
- [ ] **Given** `StatusMessage`, **When** renderizado, **Then** o elemento tem `role="status"` e `aria-live="polite"` — e o `AlertMessage` existente permanece com `role="alert"`, sem alteração.
- [ ] `services/frontend/package.json` tem exatamente as mesmas três dependências de runtime de antes desta task.
- [ ] Nenhum arquivo desta task importa de `~/pages`, de `~/services/api` ou do catálogo de mensagens — as primitivas não conhecem o domínio.

---

## Dependencies

- **Requires**: FEATURE-002 (tokens de `tailwind.config.js`, componentes existentes como referência de estilo).
- **Blocks**: TASK-FRONTEND-009 e TASK-FRONTEND-010 (a tela é montada com estas peças), TASK-FRONTEND-011 (testes).

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 6 arquivos criados (`src/components/ui/`: `icons.tsx`, `icon-button.tsx`, `data-list.tsx`, `feedback-states.tsx`, `status-message.tsx`, `confirm-dialog.tsx`)

#### Resumo

Os **12 critérios de aceite passam**, verificados por execução (suíte de sondagem temporária, 18 casos, removida ao fim da revisão) e não por leitura. O escopo foi respeitado à risca: nenhum arquivo existente foi alterado, as dependências de runtime continuam sendo exatamente `react`, `react-dom` e `react-router-dom`, `tailwind.config.js` está intocado e `src/services/api/http-client.ts` não foi tocado. O achado que bloqueia é um: a armadilha de foco do `ConfirmDialog` só vale enquanto o foco já está dentro do painel — bastam um clique na sobreposição ou o próprio `isSubmitting` para o teclado voltar a percorrer a página atrás do modal, que é exatamente a falha que a task cita como razão de o componente existir.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | major | `src/components/ui/confirm-dialog.tsx` | L101-L126, L141 | acessibilidade / bug | A armadilha de foco depende de o foco estar dentro do painel, porque `onKeyDown` vive no `<div role="dialog">` e eventos só borbulham até ele a partir de descendentes. **Verificado por execução**: após um clique na sobreposição, `document.activeElement` vira `<body>`, `Escape` deixa de chamar `onCancel` (0 chamadas) e `Tab` leva o foco para um botão **atrás** do diálogo. O mesmo vale ao abrir já com `isSubmitting` (`focus()` em botão desabilitado é no-op — foco ficou em `BODY`) e, no navegador real, no instante em que `isSubmitting` desabilita os dois botões após o clique em confirmar (o navegador tira o foco de elemento desabilitado; o jsdom não, e é por isso que a suíte atual não pegaria). Com `aria-modal="true"` declarado, o componente promete à tecnologia assistiva um isolamento que ele não entrega — RNF-06 / CT-37. | Mover o `onKeyDown` para o `<div>` da sobreposição (L129), que envolve tudo, **e** acrescentar rede de segurança no ramo de `Tab`: quando `document.activeElement` não for nenhum dos dois botões, focar o de cancelar. Garantir também que sempre exista um focável enquanto `isSubmitting` — manter cancelar habilitado ou dar `tabIndex={-1}` ao painel e focá-lo. |
| 2 | minor | `src/components/ui/confirm-dialog.tsx` | L37 | acessibilidade / contraste | `hover:bg-brand-orange` reintroduz exatamente a combinação que a divergência de cor foi criada para evitar. **Medido**: branco sobre `#e05a1e` = **3.72:1**, abaixo do WCAG AA 1.4.3 (4.5:1). O estado de repouso (`bg-brand-orange-dark`, **4.85:1**) passa; o de hover reprova. O SC 1.4.3 vale para o texto em qualquer estado. | Trocar o hover por uma variação que permaneça ≥ 4.5:1 (escurecer a partir de `brand-orange-dark`, ou alterar apenas borda/sombra no hover mantendo o fundo). |
| 3 | minor | `src/components/ui/confirm-dialog.tsx` | L102-L107 | comportamento | `Escape` chama `onCancel` mesmo com `isSubmitting`. A redação da task não condiciona, mas o comportamento não é o desejável: a requisição destrutiva já está em voo e o `onCancel` fecha o diálogo sobre uma operação que o consumidor não tem mais como cancelar — o `isSubmitting` existe justamente para congelar as duas saídas, e ele já congela as outras duas (os dois botões). **Verificado**: hoje o problema está mascarado pelo achado #1 — com ambos os botões desabilitados o `Escape` nem alcança o tratador (0 chamadas de `onCancel`). | `if (evento.key === 'Escape') { evento.stopPropagation(); if (!isSubmitting) { onCancel(); } return; }` |
| 4 | minor | `src/components/ui/feedback-states.tsx` / `confirm-dialog.tsx` | L91 / L17 | padrão | Indicador de foco diverge da convenção dominante do projeto. O botão de nova tentativa do `ErrorState` é clone estilístico do botão secundário de `src/pages/auth/login-page.tsx` L30 (`rounded-field border-[1.5px] border-brand-purple … hover:bg-brand-purple-light`), mas usa `focus-visible:outline …` enquanto todas as páginas, o `client-layout.tsx` e os campos usam `focus-visible:shadow-focus-ring focus-visible:outline-none`. A task prescreveu a técnica de `outline` **apenas** para o `IconButton` (e ali ela é correta). | Usar `shadow-focus-ring` nos botões sobre cartão branco, como os irmãos visuais, ou registrar a decisão de unificar a técnica em toda a base. |
| 5 | suggestion | `src/components/ui/feedback-states.tsx` / `data-list.tsx` | L29 / L51 | duplicação | A moldura do cartão (`rounded-card bg-surface-card shadow-card`) está duplicada em dois arquivos sem constante compartilhada. Como a razão de ela existir nos estados de feedback é ser **idêntica** à do `DataList`, uma alteração em um dos lados diverge em silêncio. | Extrair para um módulo de classes compartilhadas quando a próxima task tocar os dois arquivos. |
| 6 | suggestion | `src/components/ui/feedback-states.tsx` | L26-L27 | comentário | O comentário afirma que sem a moldura o bloco pularia "de tamanho e de fundo". O fundo e o arredondamento de fato passam a casar, mas **a altura não**: o cartão de feedback é `py-10` fixo e a lista cresce com `min-h-[56px]` por linha. O salto de altura permanece. | Ajustar o comentário para o que a moldura realmente resolve (fundo, raio e sombra), sem prometer estabilidade de altura. |
| 7 | suggestion | `src/components/ui/status-message.tsx` | L22-L26, L49 | duplicação | A duplicação em relação ao `alert-message.tsx` é maior do que o mapa de paleta: a className base (`rounded-field border-[1.5px] px-4 py-3 text-[0.82rem] font-semibold`) é byte a byte igual à L41 daquele arquivo. A decisão está correta sob a restrição de escopo (o arquivo não exporta o mapa e a task proíbe alterá-lo), mas é dívida registrada. | Extrair paleta e className base quando `alert-message.tsx` for legitimamente aberto por outra task. |
| 8 | suggestion | `src/components/ui/feedback-states.tsx` | L84-L96 | acessibilidade | `ErrorState` sem `role="alert"`. **Verificado**: 0 elementos com `role="alert"` no DOM renderizado. Não é exigido pela task e é defensável como primitiva neutra, mas o RNF-09 pede que o resultado de cada operação seja percebido sem navegar até ele. | Dependência explícita para TASK-FRONTEND-009/010: quem monta a tela precisa anunciar a falha de carregamento (via `StatusMessage`/`AlertMessage`), senão o RNF-09 fica descoberto no caminho de erro. |
| 9 | suggestion | `src/components/ui/icon-button.tsx` | L69 | acessibilidade | `title={label}` duplica um nome que o `sr-only` já produz por conteúdo. **Verificado**: o nome acessível resolve para o `label` (o `title` é ignorado no cálculo do nome), mas vários leitores de tela anunciam `title` como **descrição** — o rótulo tende a ser lido duas vezes. | Manter (a dica de ferramenta para quem usa mouse tem valor real) e registrar o efeito colateral; reavaliar se o CT-38 apontar leitura duplicada. |

#### Julgamento das decisões declaradas pelo agente

1. **Divergência de cor (`brand-orange-dark` no confirmar)** — **ACEITA**. Medição refeita de forma independente: branco sobre `#e05a1e` = **3.716:1** (reprova AA), branco sobre `#c44a10` = **4.845:1** (aprova). A alegação sobre o `field-error.tsx` é **verdadeira**: L12-L16 daquele arquivo registra a medição idêntica ("3.72:1 … 4.85:1"). `brand-orange-dark` é token pré-existente (`tailwind.config.js` L38, o focinho do logo) — nenhuma cor nova. E o precedente é de projeto, não isolado: a mesma troca por acessibilidade já foi feita no `field-error.tsx`, no `alert-message.tsx` (L13-L21) e nos próprios tokens `hairline` e `focus-ring`. **Acessibilidade justifica divergir da letra da task** quando a letra produz uma reprovação de norma, o token usado já existe e a divergência fica documentada no ponto de uso — as três condições estão satisfeitas. A ressalva é o achado #2: a divergência é desfeita no hover.
2. **`LoadingIndicator` com `aria-label` E `sr-only`** — **ALEGAÇÃO VERIFICADA E VERDADEIRA; ambos são necessários.** Sondagem: `<div role="status"><span>Somente conteudo</span></div>` **não** é encontrado por `getByRole('status', { name: 'Somente conteudo' })`. O papel `status` é `nameFrom: author` na especificação ARIA — não compõe nome a partir do conteúdo. Sem o `aria-label`, o AC "cujo nome acessível é o `label` recebido" falharia; sem o texto `sr-only`, a região viva seria montada vazia e não haveria anúncio. Nenhum dos dois é redundante.
3. **`<span aria-hidden="true">` em volta do `icon` + `title`** — **ACEITA** quanto ao span: `icon` é `ReactNode` de terceiros e o botão não pode depender de o chamador ter escondido o desenho; verificado que nada com `role="img"` vaza para o nome acessível. Quanto ao `title`, ver sugestão #9.
4. **Moldura de cartão nos três estados de feedback** — **ACEITA com ressalva** (sugestões #5 e #6): a moldura resolve fundo/raio/sombra, não o salto de altura que o comentário promete.
5. **`StatusMessage` duplicando a paleta** — **ACEITA**. A restrição é real e foi verificada: `alert-message.tsx` não exporta o mapa e a task proíbe alterá-lo; o `AlertMessage` permanece intocado com `role="alert"`. Dívida registrada na sugestão #7.
6. **`Escape` com `isSubmitting`** — **REJEITADA** (achado #3). A leitura literal é defensável, mas o comportamento desejável é ignorar `Escape` enquanto a operação destrutiva está em voo.
7. **`ErrorState` sem `role="alert"`** — **ACEITA** como primitiva neutra, com a dependência da sugestão #8 repassada à TASK-FRONTEND-009/010.

#### Verificações especiais solicitadas — todas por execução

| Verificação | Resultado |
|---|---|
| `ConfirmDialog` desmonta com `open={false}` | ✅ `container.innerHTML === ''`; `queryByRole('dialog')` nulo |
| `role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-describedby` | ✅ presentes e resolvendo |
| Foco inicial no botão de confirmar | ✅ `document.activeElement` === botão "Excluir" |
| Armadilha de foco (`Tab` / `Shift+Tab`) a partir do foco inicial | ✅ Excluir → Cancelar → Excluir; `Shift+Tab` → Cancelar |
| Armadilha de foco após o foco sair do painel | ❌ **falha** — ver achado #1 |
| `Escape` chama `onCancel` e não `onConfirm` | ✅ 1 e 0 chamadas |
| Devolução do foco ao gatilho ao fechar | ✅ volta ao botão "Abrir" — inclusive sob `<StrictMode>` (que está ligado em `src/main.tsx`) e em abre/fecha/reabre consecutivos |
| Nome acessível do `IconButton` | ✅ `getByRole('button', { name: 'Editar espécie Gato' })` encontra; `<svg>` com `aria-hidden="true"` e `focusable="false"` |
| `DataList` é `<ul>`/`<li>` e não `<table>` | ✅ `getByRole('list', { name })` com 3 `listitem`; `querySelector('table')` nulo |
| `getKey` obrigatório e tipado | ✅ TS2741 ao omitir (`Property 'getKey' is missing`) |
| `label` do `IconButton` obrigatório (AC #2) | ✅ TS2741 ao omitir (`Property 'label' is missing`) |
| Nenhum import de `~/pages`, `~/services/api` ou catálogo de mensagens | ✅ os 6 arquivos importam **apenas** de `'react'` |
| `src/services/api/http-client.ts` intocado | ✅ ausente do `git status`; sem diff contra HEAD |
| Dependências de runtime inalteradas | ✅ exatamente `react`, `react-dom`, `react-router-dom`; `package.json` fora do `git status` |
| `tailwind.config.js` sem token novo | ✅ arquivo fora do `git status`; todas as classes usadas (`hairline`, `rounded-card`, `rounded-field`, `shadow-card`, `max-w-card`, `brand-orange-dark`, `brand-purple-light`, `surface-input`, `ink/40`) já existiam |
| Proibição de `any` | ✅ nenhuma ocorrência |
| Comentários de `.tsx` sem acento | ✅ nenhum caractere acentuado nos 6 arquivos |
| Texto de tela com acento | ✅ n/a por construção — **nenhuma** das primitivas embute texto; toda string chega por prop |
| Gates | ✅ `npm run typecheck` exit 0; `npm test` **12 suítes / 160 testes**, idêntico à baseline |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12 critérios de aceite implementados**, todos confirmados por execução (tabela acima). Nenhum achado de requisito. O achado #1 não reprova nenhum AC — o AC de `Tab` exercita o caminho a partir do foco inicial, que funciona — mas descumpre a razão declarada na seção *Implementation* ("Sem isso o RNF-06/CT-37 não se sustenta").

**Pass 2 — Diff Analysis**: Nenhum achado. Os 6 arquivos da tabela *Files* foram criados, todos como não rastreados; **nenhum arquivo existente foi modificado** (o único item modificado no repositório é `.makuco/handoff/implementacao-module-002.md`, registro do orquestrador, fora do escopo de código). Nada de `src/pages/`, nada em `tailwind.config.js`, nada em `package.json`, nada em `http-client.ts`. Sem scope creep e sem formatação em massa.

**Pass 3 — Code Practices**: Achados #5, #6, #7. Uma responsabilidade por componente; funções curtas (o maior arquivo, `confirm-dialog.tsx`, tem 179 linhas em um único componente com um `useEffect` e um tratador de teclado); nomes sem abreviação e em português maiúsculo para constantes de módulo, aderente ao precedente (`CLASSES_POR_VARIANTE` em `alert-message.tsx`, `CLASSES_BASE_DO_INPUT` em `text-field.tsx`); guarda de retorno antecipado sem `else`; sem números mágicos soltos (os literais de estilo estão em constantes de módulo nomeadas); comentários explicando o **porquê**, não o **quê** — com a única imprecisão do achado #6. Injeção de dependência por props em toda parte: nenhuma primitiva instancia colaborador nem conhece domínio.

**Pass 4 — Testing Review**: Nenhum achado. A task declara explicitamente "Sem testes (TASK-FRONTEND-011)" e o `AlertMessage`/suíte existente permanece verde (12 suítes / 160 testes, baseline idêntica). A verificação de comportamento desta revisão foi feita por suíte de sondagem temporária, executada e **removida** — nenhum arquivo de teste foi deixado no repositório. Fica registrado para a TASK-FRONTEND-011 que os casos que expõem o achado #1 (foco fora do painel, `isSubmitting`) precisam entrar na suíte, e que **o jsdom não reproduz o blur automático de elemento desabilitado** — o teste precisa forçar `blur()` ou clicar na sobreposição para exercitar o caminho real.

**Pass 5 — Security Review**: Nenhum achado. Primitivas puramente de apresentação, sem fronteira de confiança: nenhuma entrada de usuário alcança consulta, comando, URL ou log. Varredura confirmou ausência de `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `fetch`, `localStorage`/`sessionStorage`, `href` e `window.location` nos 6 arquivos. `children`, `renderRow`, `icon`, `label` e `title` são renderizados pelo React, que escapa texto e valor de atributo por padrão (A03 coberto). Sem segredo, sem dependência nova (A02/A06 — `package.json` inalterado). A01, A04, A07-A10 não se aplicam a componentes sem estado compartilhado nem acesso a recurso.

**Pass 6 — Bug Detection**: Achados #1 e #3. Demais verificações, todas negativas: sem acesso a possível `null` desprotegido (`refDoBotaoDeConfirmar.current?.focus()` e `refDoElementoFocadoAntes.current?.focus()` usam encadeamento opcional); ordem dos hooks estável — os três `useRef`, o `useEffect` e os dois `useId` vêm **antes** do retorno antecipado (L63-L91 antes de L97), e a função `aoTeclar` declarada após o `return null` é içada, sem TDZ; sem vazamento de recurso — o `useEffect` devolve limpeza e não registra ouvinte global; sem `==` (só `===`); sem `catch` vazio; sem off-by-one (a armadilha usa comparação de identidade entre dois refs, não índice); sem estado inconsistente — o componente não muta nada. O ciclo montar → desmontar → montar do `<StrictMode>` foi exercitado e **não** corrompe o alvo de devolução do foco, porque a limpeza restaura o foco antes de a segunda montagem ler `document.activeElement`.

**Pass 7 — Project Patterns**: Achado #4. Fora dele: os arquivos estão em `src/components/ui/`, em kebab-case, com um componente principal por arquivo (a exceção de `feedback-states.tsx` e `icons.tsx` é prescrita pela task); tipos de props locais e não exportados, `readonly` em todos os campos e retorno anotado como `ReactElement`, iguais a `text-field.tsx` e `alert-message.tsx`; classes Tailwind em constante de módulo; `Readonly<Record<variante, string>>` para paleta, idêntico ao precedente. Fluxo de dependência correto: as primitivas não importam nada além de `react`, portanto não há inversão de camada nem ciclo. Linguagem ubíqua respeitada — `DataList`, `IconButton`, `ConfirmDialog`, `EmptyState`, `LoadingIndicator`, `ErrorState`, `StatusMessage` são termos genéricos de interface e **nenhum** carrega vocabulário de domínio, que é exatamente o que a seção *Scope — Out* exige.

#### Veredicto

> **NECESSITA CORREÇÕES** — 0 critical, **1 major** (#1), 3 minor (#2, #3, #4), 5 suggestion (#5-#9).
>
> Os 12 critérios de aceite passam e o escopo foi respeitado integralmente. O bloqueio é o achado #1, em `services/frontend/src/components/ui/confirm-dialog.tsx` L101-L126 e L141: a armadilha de foco tem furo verificado por execução, e é ela que sustenta o RNF-06/CT-37 — o mesmo argumento que a própria task usa para exigi-la. Recomenda-se corrigir #1 junto com #2 e #3, que vivem no mesmo arquivo e no mesmo caminho de código. Encaminhar ao `makuco-codegen` antes de fechar a TASK.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: **APROVADA**
**Arquivos revisados**: 6 arquivos (`services/frontend/src/components/ui/`: `icons.tsx`, `icon-button.tsx`, `data-list.tsx`, `feedback-states.tsx`, `status-message.tsx`, `confirm-dialog.tsx`)

#### Resumo

O achado major da rodada 1 está **fechado nas três entradas**, verificado por execução e não por leitura (suíte de sondagem temporária de 23 casos, criada, executada e removida — `git status` final não a contém). Os 12 critérios de aceite foram reexecutados e **nenhum regrediu**, inclusive sob `<StrictMode>`. Os minor #2 e #6 estão corrigidos e as sugestões #4(comentário), #7 e #9 estão atendidas. Sobrevive um único achado, o minor #4 da rodada 1 (técnica do indicador de foco), cuja justificativa é **rejeitada no mérito** — mas `minor` não bloqueia, por isso a task é aprovada.

#### Reprodução por execução dos três cenários do major (achado #1 da rodada 1)

Nenhum resultado abaixo vem de relato do agente; todos vêm de execução.

| Cenário | Passos executados | Resultado medido |
|---|---|---|
| **A — clique na sobreposição** | abrir → `click` na sobreposição | `document.activeElement` === **a própria sobreposição** (`DIV.fixed inset-0 z-50 …`), **não** `<body>`. O `tabIndex={-1}` cumpre o que promete. |
| **A — `Escape` depois do clique** | abrir → `click` na sobreposição → `{Escape}` | `onCancel` chamado **1 vez** (era 0 na rodada 1). |
| **A — `Tab` depois do clique** | abrir → `click` na sobreposição → 11 × `Tab` / `Shift+Tab` | Sobreposição → Cancelar → Excluir → Cancelar → … O foco **nunca** alcançou "Atras A", "Atras B" ou "Abrir". Assertiva de contenção (`painel.contains` ∪ `sobreposição.contains`) verdadeira nas 11 tabulações. |
| **B — abertura já com `isSubmitting`** | montar com `isSubmitting` → `click` em "Abrir" | Foco em `DIV[role="dialog"]` (o painel), **não** em `BODY`. |
| **B — `Tab` com `isSubmitting`** | 6 × `Tab` | Foco permanece no painel nas 6; nenhum elemento de fora alcançado. |
| **B — `Escape` com `isSubmitting`** | `{Escape}` | `onCancel` **não** chamado — minor #3 corrigido. |
| **C — foco perdido simulado** | `rerender` para `isSubmitting` **e** `blur()` explícito no **mesmo `act()`** | Foco reposicionado em `DIV[role="dialog"]`. O efeito dependente de `isSubmitting` reage à transição, como alegado. |
| **C — `Tab` após o blur simulado** | `Tab` | Contenção verdadeira; não escapou. |

**Conclusão do item 1**: em nenhum dos três cenários o `Tab` alcança elemento fora do diálogo. **Achado #1 da rodada 1 — RESOLVIDO.**

#### Não regressão dos 12 critérios de aceite (item 2)

| AC | Verificação executada | Resultado |
|---|---|---|
| 1 — `DataList` | `getByRole('list', { name })` + 3 `listitem` + `querySelector('table')` | ✅ `UL`, 3 `LI`, `table` nulo |
| 2 — `label` obrigatório | `tsc --noEmit` com `<IconButton>` sem `label` | ✅ **TS2741** `Property 'label' is missing` |
| 3 — nome acessível do `IconButton` | `getByRole('button', { name: 'Editar especie Gato' })` + `toHaveAccessibleName` | ✅ encontrado; `<svg>` com `aria-hidden="true"` e `focusable="false"` |
| 4 — desmontagem com `open={false}` | `container.innerHTML` + `queryByRole('dialog')` | ✅ `''` e nulo |
| 5 — foco inicial + `aria-modal` | `activeElement` + atributos + `toHaveAccessibleName`/`Description` | ✅ foco em "Excluir"; `aria-modal="true"`; nome "Excluir especie"; descrição "Nao pode ser desfeito." |
| 6 — ciclo `Tab`/`Shift+Tab` + `Escape` | 4 tabulações a partir do foco inicial + `{Escape}` | ✅ Excluir → Cancelar → Excluir → Cancelar → Excluir; `Escape` fecha e `onConfirm` não é chamado |
| 7 — devolução de foco | fechar por `Escape` | ✅ volta ao botão "Abrir" |
| 7 — **sob `<StrictMode>`** | abre/fecha/reabre/fecha dentro de `<StrictMode>` | ✅ devolve ao gatilho nas duas voltas; a dupla montagem do StrictMode **não** corrompe o alvo |
| 8 — `LoadingIndicator` | `getByRole('status', { name: 'Carregando especies' })` | ✅ encontrado |
| 9 — `ErrorState` | `Tab` até o botão + `{Enter}` | ✅ focável por teclado; `onRetry` chamado 1 vez |
| 10 — `StatusMessage` | `role` + `aria-live` | ✅ `status` + `polite`; `AlertMessage` segue `role="alert"` intocado |
| 11 — dependências de runtime | `package.json` | ✅ exatamente `react`, `react-dom`, `react-router-dom` |
| 12 — sem import de domínio | imports dos 6 arquivos | ✅ todos importam **apenas** de `'react'` |

`getKey` obrigatório também confirmado por `tsc` (**TS2741** `Property 'getKey' is missing`). **12 de 12 — nenhuma regressão.**

#### Verificação da alegação sobre o `title` (item 3)

Verificado por execução em `services/frontend/src/components/ui/icon-button.tsx` L89-L95:

- `<button>` **não** tem mais o atributo `title` (`expect(botao).not.toHaveAttribute('title')` ✅).
- O `title` está no `<span aria-hidden="true" class="inline-flex h-full w-full …">`, com o valor do `label` ✅.
- **Nome acessível** continua sendo o `label` (`toHaveAccessibleName('Excluir especie Gato')` ✅) — vem do `<span className="sr-only">`.
- **Descrição acessível vazia** (`toHaveAccessibleDescription('')` ✅; `aria-describedby` ausente). O efeito colateral da sugestão #9 (rótulo lido duas vezes) está eliminado.
- **A dica de ferramenta continua existindo**: o atributo `title` permanece no DOM e a renderização da tooltip é comportamento visual do navegador, independente da árvore de acessibilidade. O `h-full w-full` faz a área da dica cobrir os 44×44 do alvo de toque, e não apenas os 18px do desenho.

**Alegação do agente — VERDADEIRA em todos os pontos. Sugestão #9 — ATENDIDA.**

#### Medição de contraste do novo hover (item 4)

Medições independentes (WCAG 2.1, luminância relativa), sobre `services/frontend/src/components/ui/confirm-dialog.tsx` L44-L45:

| Estado do botão de confirmar | Combinação | Medido | Critério | Situação |
|---|---|---|---|---|
| Repouso — texto | branco / `brand-orange-dark` `#c44a10` | **4.845:1** | SC 1.4.3 ≥ 4.5:1 | ✅ |
| **Hover — texto** | branco / `brand-orange-dark` (fundo **inalterado**) | **4.845:1** | SC 1.4.3 ≥ 4.5:1 | ✅ |
| Repouso — borda | `brand-orange-dark` / cartão branco | 4.845:1 | SC 1.4.11 ≥ 3:1 | ✅ |
| **Hover — borda** | `ink` `#1e1b2e` / fundo laranja | **3.463:1** | SC 1.4.11 ≥ 3:1 | ✅ |
| Hover — borda vs. cartão | `ink` / branco | 16.781:1 | SC 1.4.11 ≥ 3:1 | ✅ |
| Delta hover↔repouso da borda | `ink` / `brand-orange-dark` | 3.463:1 | mudança perceptível | ✅ |
| Foco — contorno | `brand-purple` / cartão branco (o `outline-offset-2` põe o contorno **fora** da caixa, sobre o cartão) | 5.699:1 | SC 1.4.11 ≥ 3:1 | ✅ |
| Cancelar (repouso / hover) | `ink` / branco · `ink` / `surface-input` | 16.781:1 · 15.743:1 | SC 1.4.3 | ✅ |

Referência: o `brand-orange` puro (`#e05a1e`) que o hover antigo reintroduzia rende **3.716:1** — a reprovação medida na rodada 1. **Nenhum estado do botão de confirmar sai da conformidade.** O estado desabilitado (`disabled:opacity-60`) é dispensado pelo SC 1.4.3 (componentes inativos) e usa exatamente o mesmo mecanismo já presente em `submit-button.tsx` L28 e `login-page.tsx` L30. **Minor #2 — RESOLVIDO, sem token novo.**

#### Efeito colateral do `tabIndex={-1}` na sobreposição (item 5)

| Verificação | Resultado medido |
|---|---|
| Entra na ordem de tabulação? | ❌ **Não.** 6 tabulações consecutivas a partir do foco inicial visitaram `Cancelar → Excluir → Cancelar → Excluir → Cancelar → Excluir`. Nem a sobreposição nem o painel aparecem na sequência — `tabindex="-1"` os torna focáveis por script/clique, nunca por `Tab`. |
| Cria armadilha nova? | ❌ **Não.** Uma vez focada por clique, a sobreposição é abandonada no `Tab` seguinte (vai para "Cancelar"). Não há estado em que o foco fique preso nela. |
| Clique no painel (não em botão) | Focar o `<h2>` do título leva o foco ao `DIV[role="dialog"]` (o painel também tem `tabIndex={-1}`), que está dentro da árvore que escuta o teclado — o `Tab` seguinte vai para "Cancelar". Sem furo. |
| Foco visível na sobreposição | `focus:outline-none` é aceitável: a sobreposição não é componente de interface e nunca recebe foco por teclado, então o SC 2.4.7 não se aplica a ela. |
| Desmontagem | A sobreposição desmonta junto com o diálogo (`open === false` retorna `null`), portanto não sobrevive ao fechamento — o que era a objeção ao ouvinte global em `document`. **Recusa do ouvinte global: ACEITA**, com a ressalva do achado #11 abaixo. |

#### Escopo (item 6)

| Verificação | Resultado |
|---|---|
| `src/services/api/http-client.ts` intocado | ✅ ausente do `git status`; `git diff -- services/frontend` vazio |
| `src/components/ui/alert-message.tsx` intocado | ✅ idem — segue com `role="alert"` |
| `tailwind.config.js` intocado | ✅ idem; nenhum token novo (`hairline`, `rounded-card`, `rounded-field`, `shadow-card`, `max-w-card`, `brand-orange-dark`, `brand-purple-light`, `surface-input`, `ink`, `ink/40` já existiam) |
| `package.json` intocado | ✅ idem; dependências de runtime = `react`, `react-dom`, `react-router-dom` |
| Dependência nova | ✅ nenhuma |
| Teste permanente criado | ✅ nenhum — a task proíbe ("Sem testes (TASK-FRONTEND-011)") e nenhum `.spec` novo existe |
| Sonda deixada para trás | ✅ nenhuma — `git status` final lista **exatamente** os 6 arquivos da tabela *Files*, mais nada em `services/frontend` |
| Arquivo existente modificado | ✅ nenhum. Os dois itens `M` do repositório são `.makuco/handoff/implementacao-module-002.md` e este próprio arquivo de task |
| Proibição de `any` | ✅ nenhuma ocorrência |
| Comentários de `.tsx` sem acento | ✅ nenhum caractere acentuado nos 6 arquivos |
| `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `fetch` / storage / `window.location` | ✅ nenhum |
| Gates | ✅ `npm run typecheck` **exit 0** (dois projetos); `npm test` **12 suítes / 160 testes**, baseline idêntica |

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 10 | minor | `src/components/ui/feedback-states.tsx` / `confirm-dialog.tsx` | L97 / L17 | padrão | **Achado #4 da rodada 1, não corrigido.** A justificativa do agente é **rejeitada no mérito**: das duas saídas oferecidas, a saída (a) — usar `shadow-focus-ring` nos botões sobre cartão branco — exigia editar **apenas arquivos criados por esta task** e não tocava um byte da base existente, portanto não excedia escopo algum. O botão do `ErrorState` é clone estilístico de `login-page.tsx` L30 e não tem defesa técnica para divergir: medido, o contorno roxo sobre o cartão branco rende 5.699:1 e o anel também funcionaria ali. A contagem atual da base é **8 × `shadow-focus-ring`** contra **3 × `outline-brand-purple`** — e os três são exatamente os introduzidos por esta task (só um deles, o `IconButton`, foi prescrito). Os 2 × `outline-white` do `admin-layout.tsx` têm justificativa própria (barra roxa, onde o anel roxo sumiria). Não bloqueia: `minor` não impede o fechamento da task. | Registrar comentário no ponto de uso (`feedback-states.tsx` L97 e `confirm-dialog.tsx` L17) explicando a escolha, como já é feito em `icon-button.tsx` L24-L26 — hoje as duas divergências estão **sem** registro. E abrir decisão explícita de unificar a técnica em toda a base, que é a saída (b), fora do escopo desta task. |
| 11 | suggestion | `src/components/ui/confirm-dialog.tsx` | L143-L185 | acessibilidade | **Furo residual, fora do contrato.** Verificado por execução: um `blur()` programático **sem** transição de `isSubmitting` e **sem** clique deixa o foco em `BODY`, o `keydown` deixa de borbulhar até a sobreposição e o `Tab` seguinte alcança o botão "Abrir", **fora** do diálogo. Não é caminho alcançável pelo usuário — a sobreposição cobre a viewport inteira (todo clique a atinge), o painel e ela são focáveis, e a transição de `isSubmitting` tem efeito próprio. É o preço documentado da recusa do ouvinte global em `document`, e a recusa continua sendo a decisão certa (a sobreposição desmonta com o diálogo; o ouvinte global sobreviveria a uma limpeza falha). | Nenhuma ação nesta task. Registrar como limitação conhecida e reavaliar se algum consumidor vier a mover foco por script enquanto o diálogo está aberto. |
| 12 | suggestion | `src/components/ui/confirm-dialog.tsx` | L153, L168 | acessibilidade / dependência | **Consequência direta da correção do minor #3, e ela é correta — mas cria dependência para quem consome.** Enquanto `isSubmitting` é verdadeiro o diálogo passa a não ter **nenhuma** saída: os dois botões estão desabilitados, o `Escape` é ignorado (L153) e o `preventDefault()` do `Tab` é incondicional (L168), com o foco preso ao painel. É o comportamento desejado para uma operação transitória, mas se o consumidor **não** devolver `isSubmitting` a `false` em algum caminho (erro de rede, timeout, promessa rejeitada sem tratamento), o usuário de teclado fica preso sem saída — o que aí sim seria uma armadilha de teclado no sentido do SC 2.1.2. Além disso, ao focar o painel o leitor de tela reanuncia título e descrição ("Excluir espécie / Não pode ser desfeito"), que **não** dizem que há operação em curso. | Dependência explícita para **TASK-FRONTEND-009/010**: (a) garantir `isSubmitting = false` em **todos** os caminhos de saída da exclusão, inclusive falha e timeout; (b) sinalizar o progresso ao usuário enquanto a operação corre (`LoadingIndicator` ou texto na descrição do diálogo), para que o reanúncio do painel diga o que está acontecendo. |

**Achados da rodada 1 — situação**

| Rodada 1 | Severidade | Situação na rodada 2 |
|---|---|---|
| #1 armadilha de foco | major | ✅ **RESOLVIDO** — três cenários reproduzidos por execução |
| #2 contraste do hover | minor | ✅ **RESOLVIDO** — 4.845:1 em todos os estados; borda a 3.463:1 |
| #3 `Escape` com `isSubmitting` | minor | ✅ **RESOLVIDO** — `onCancel` não chamado; `stopPropagation()` mantido incondicional. Gera o achado #12 |
| #4 técnica do indicador de foco | minor | ❌ **NÃO CORRIGIDO** — justificativa rejeitada; vira achado #10 (segue `minor`, não bloqueia) |
| #5 moldura de cartão duplicada | suggestion | ⏳ dívida mantida, sem regressão |
| #6 comentário da moldura | suggestion | ✅ **ATENDIDO** — `feedback-states.tsx` L29-L33 agora diz explicitamente que a moldura **não** estabiliza a altura |
| #7 duplicação com `alert-message.tsx` | suggestion | ✅ **ATENDIDO** — `status-message.tsx` L19-L25 registra os **dois** pontos; confirmado que a className base é byte a byte igual à L41 do `alert-message.tsx` |
| #8 `ErrorState` sem `role="alert"` | suggestion | ⏳ dependência mantida para TASK-FRONTEND-009/010 |
| #9 `title` no `<button>` | suggestion | ✅ **ATENDIDO** — verificado por execução (seção do item 3) |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12 critérios de aceite implementados e sem regressão**, todos reconfirmados por execução (tabela do item 2), incluindo os dois negativos de tipo (`TS2741` para `label` e para `getKey`). Nenhum achado de requisito. A razão declarada na seção *Implementation* ("Sem isso o RNF-06/CT-37 não se sustenta") agora **se sustenta**: a armadilha de foco resiste aos três caminhos que a rodada 1 demonstrou furados.

**Pass 2 — Diff Analysis**: Nenhum achado. `git diff -- services/frontend` vazio contra `HEAD`: **nenhum arquivo rastreado foi alterado**. Os 6 arquivos da tabela *Files* existem como não rastreados e nada além deles aparece em `services/frontend`. Sem scope creep, sem formatação em massa, sem sonda residual.

**Pass 3 — Code Practices**: Nenhum achado novo. A correção acrescentou uma função auxiliar (`primeiroBotaoHabilitado`, L54-L60), com nome sem abreviação, um único nível de indentação, sem `else` e retorno explícito de `null` no caso vazio — nada de obsessão por primitivo nem de número mágico. O segundo `useEffect` (L123-L133) é declarado separado do primeiro **de propósito**, com o motivo registrado no comentário L117-L122, e isso é o correto pela regra da responsabilidade única: um efeito captura a origem do foco, o outro o posiciona. `confirm-dialog.tsx` cresceu de 179 para **263 linhas**, acima do ~150 da Regra 7 de Object Calisthenics — mas **149 dessas linhas não são comentário nem linha em branco**, e o arquivo continua sendo um componente com dois efeitos e um tratador. A densidade de comentário é alta por decisão consistente do projeto (o `tailwind.config.js` e o `jest.config.ts` seguem o mesmo padrão) e os comentários explicam o **porquê**, não o **quê**. Sem violação. Linguagem ubíqua respeitada: os identificadores acrescentados (`refDoPainel`, `primeiroBotaoHabilitado`, `focoAtual`, `proximo`, `alvo`, `painel`) são vocabulário de interface, sem termo de domínio — exatamente o que a seção *Scope — Out* exige.

**Pass 4 — Testing Review**: Nenhum achado. A task declara "Sem testes (TASK-FRONTEND-011)" e nenhum arquivo de teste permanente foi criado. A baseline segue idêntica: **12 suítes / 160 testes**, todos verdes. A verificação desta rodada foi feita por duas suítes de sondagem temporária (23 casos, estrutura AAA, sem lógica condicional no corpo, mocks por `jest.fn()` e `clearMocks` do projeto), **executadas e removidas** — confirmado no `git status` final. O que a TASK-FRONTEND-011 precisa herdar está na seção própria abaixo.

**Pass 5 — Security Review**: Nenhum achado. A correção não abriu nenhuma fronteira de confiança nova. Varredura nos 6 arquivos: sem `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `fetch`, `localStorage`/`sessionStorage`, `href`, `window.location` ou ouvinte global. As três únicas referências a `document` (`confirm-dialog.tsx` L104, L170, L182) são leituras de `document.activeElement` e uma chamada a `Node.contains` — não escrevem no DOM e não alcançam consulta, comando, URL ou log. O `title={label}` migrado para o `<span>` é atributo renderizado pelo React, que escapa valor de atributo por padrão (A03 coberto). Sem segredo, sem dependência nova (A02/A06 — `package.json` inalterado). A01, A04, A05, A07-A10 não se aplicam a componentes de apresentação sem estado compartilhado nem acesso a recurso.

**Pass 6 — Bug Detection**: Achados #11 e #12, ambos `suggestion` e ambos fora do contrato do componente. Demais verificações, todas negativas: acesso a possível `null` sempre protegido (`alvo?.focus()`, `proximo?.focus()`, `refDoElementoFocadoAntes.current?.focus()`, e a guarda explícita `painel !== null` na L182); ordem dos hooks estável — os dois `useId`, os quatro `useRef` e os **dois** `useEffect` vêm todos antes do retorno antecipado (L86-L133 antes de L139), e o segundo efeito não é condicional; `aoTeclar` declarada após o `return null` continua içada, sem TDZ; sem vazamento de recurso — o efeito de captura devolve limpeza e o novo efeito não registra nada que precise ser desfeito; sem `==`; sem `catch` vazio; sem off-by-one (a armadilha compara identidade entre dois refs, não índice); sem estado inconsistente. O ciclo montar → desmontar → montar do `<StrictMode>` foi reexercitado com o segundo efeito presente e **continua devolvendo o foco ao gatilho** em abre/fecha/reabre consecutivos — a dupla execução do efeito de `isSubmitting` é idempotente, porque `focus()` no elemento já focado é no-op.

**Pass 7 — Project Patterns**: Achado #10. Fora dele: arquivos em `src/components/ui/`, kebab-case, um componente principal por arquivo (as exceções de `feedback-states.tsx` e `icons.tsx` são prescritas pela task); tipos de props locais e não exportados, `readonly` em todos os campos, retorno anotado como `ReactElement`; classes Tailwind em constante de módulo nomeada em português maiúsculo, aderente a `CLASSES_POR_VARIANTE` de `alert-message.tsx` e `CLASSES_BASE_DO_INPUT` de `text-field.tsx`; `Readonly<Record<variante, string>>` para paleta. Fluxo de dependência correto: as primitivas importam **apenas** de `'react'`, portanto não há inversão de camada nem ciclo.

#### Veredicto

> **APROVADA** — 0 critical, 0 major, 1 minor (#10), 2 suggestion (#11, #12).
>
> O achado major da rodada 1 está fechado em `services/frontend/src/components/ui/confirm-dialog.tsx` **L210-L211** (tratador de teclado e `tabIndex={-1}` na sobreposição), **L225** (`tabIndex={-1}` no painel), **L123-L133** (efeito dependente de `isSubmitting`) e **L178-L184** (rede de segurança no ramo de `Tab`) — os três cenários foram reproduzidos por execução e em nenhum deles o `Tab` alcança elemento fora do diálogo. Os minor #2 (`confirm-dialog.tsx` **L44-L45**) e #3 (**L153**) estão corrigidos e medidos. As sugestões #4, #7 e #9 estão atendidas.
>
> Sobrevive o minor #10 (`feedback-states.tsx` **L97** e `confirm-dialog.tsx` **L17**), cuja justificativa é rejeitada no mérito — a saída (a) cabia inteira dentro dos arquivos desta task. Como `minor` não bloqueia o fechamento, a task é **aprovada** com o achado registrado como dívida de padrão, e a recomendação mínima é acrescentar o comentário de decisão no ponto de uso.

#### O que a TASK-FRONTEND-011 precisa herdar desta task

Casos que **têm** de entrar na suíte permanente, porque cada um deles cobre um furo que já esteve presente e foi corrigido — sem eles a regressão volta em silêncio:

1. **`should_manter_o_foco_no_dialogo_when_a_sobreposicao_e_clicada`** — abrir, `click` na sobreposição, assertar que `document.activeElement` é a **sobreposição** e não `<body>`, depois `Tab` e assertar que o foco caiu em "Cancelar". Cobre a entrada 1 do major.
2. **`should_chamar_onCancel_when_escape_e_pressionado_apos_clique_na_sobreposicao`** — o `Escape` que a rodada 1 media em **0 chamadas**.
3. **`should_focar_o_painel_when_o_dialogo_abre_ja_com_isSubmitting`** — assertar `activeElement === getByRole('dialog')`. Cobre a entrada 2.
4. **⚠️ `should_devolver_o_foco_ao_dialogo_when_isSubmitting_desabilita_os_botoes`** — **o caso crítico.** O **jsdom não reproduz o blur automático de elemento desabilitado**: um teste ingênuo (só `rerender` para `isSubmitting`) **passaria mesmo com a falha presente**, porque o foco permaneceria no botão desabilitado. O teste **precisa** forçar `blur()` explícito do `document.activeElement` **dentro do mesmo `act()` do `rerender`**, para reproduzir o que o navegador real faz. Sem essa precaução o teste é um falso verde e a suíte deixa de proteger a entrada 3 do major.
5. **`should_nao_chamar_onCancel_when_escape_e_pressionado_com_isSubmitting`** — protege a correção do minor #3.
6. **Contenção sob tabulação repetida** — laço de ao menos 6 `Tab` assertando a cada volta que `activeElement` está contido no painel **ou** na sobreposição; a asserção de contenção é mais robusta que a de identidade e pega qualquer futuro elemento focável acrescentado ao diálogo.
7. **A sobreposição e o painel fora da ordem de tabulação** — assertar que uma sequência de `Tab` visita apenas "Cancelar" e "Excluir", nunca a sobreposição nem o painel. Protege contra alguém "consertar" o `tabIndex={-1}` para `0`.
8. **`should_manter_a_descricao_acessivel_vazia_when_o_IconButton_e_renderizado`** — `toHaveAccessibleName(label)` **e** `toHaveAccessibleDescription('')`, mais a asserção de que o `<button>` **não** tem `title` e o `<span aria-hidden>` **tem**. Protege a correção da sugestão #9 nos dois sentidos (o rótulo não volta a ser lido duas vezes **e** a dica de ferramenta não desaparece).
9. **Devolução de foco sob `<StrictMode>`** — `src/main.tsx` liga o `StrictMode`, então o ciclo montar → desmontar → montar é o que roda em desenvolvimento; testar só fora dele deixa metade do comportamento sem cobertura. Incluir abre/fecha/**reabre**/fecha.
10. **Ausência total no DOM com `open={false}`** — asserção por **ausência** (`container.innerHTML === ''`), nunca por estilo, para que ninguém troque a desmontagem por `hidden`/`display:none`.
11. **Nota de infraestrutura**: `userEvent.tab()` só respeita a armadilha porque o `preventDefault()` do componente é honrado pelo `@testing-library/user-event`. Um teste escrito com `fireEvent.keyDown` **não** move foco nenhum e daria verde sem exercitar nada — a suíte precisa usar `userEvent`, não `fireEvent`, para todos os casos de tabulação.
12. **Dependência herdada do achado #12**, quando a tela de espécies for testada: cobrir o caminho de **falha** da exclusão e assertar que `isSubmitting` volta a `false`, de modo que o diálogo recupere suas saídas de teclado.
