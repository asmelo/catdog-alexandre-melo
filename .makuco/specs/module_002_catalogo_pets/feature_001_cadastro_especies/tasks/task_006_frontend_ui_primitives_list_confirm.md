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
