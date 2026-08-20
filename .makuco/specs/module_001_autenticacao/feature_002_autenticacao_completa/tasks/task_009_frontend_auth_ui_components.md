# TASK-FRONTEND-009 — Componentes de UI do fluxo de autenticação

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-009-frontend-auth-ui-components`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 9 of 13 — Componentes de UI
**Generated**: `2026-08-19`

---

## Context

Constrói os componentes reutilizáveis que compõem o card de autenticação do mockup `.makuco/resources/reference.html` — logo, fundo de pegadas, card, campos, botão e mensagens. Todos consomem exclusivamente os tokens do `tailwind.config.js`; nenhum valor de cor ou raio pode ser escrito literalmente aqui.

---

## Scope

**In:** `CatDogLogo`, `PawBackground`, `AuthCard`, `TextField`, `PasswordField` (com toggle de olho), `SubmitButton`, `FieldError`, `AlertMessage`.

**Out:** Nenhuma página, formulário concreto ou chamada de API (TASK-FRONTEND-012). Nenhum layout ou rota (TASK-FRONTEND-011). Nenhum estado global (TASK-FRONTEND-010). **Não** criar o link "Esqueceu sua senha?" — recuperação de senha está fora do escopo da feature (ver nota de decisão abaixo). Não instalar biblioteca de componentes nem de ícones: os SVGs vêm do `reference.html`. Sem testes (TASK-FRONTEND-013).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/catdog-logo.tsx` | logotipo SVG |
| `create` | `src/components/ui/paw-background.tsx` | fundo de pegadas |
| `create` | `src/components/ui/auth-card.tsx` | card de autenticação |
| `create` | `src/components/ui/text-field.tsx` | campo de texto |
| `create` | `src/components/ui/password-field.tsx` | campo com toggle |
| `create` | `src/components/ui/submit-button.tsx` | botão primário |
| `create` | `src/components/ui/field-error.tsx` | erro por campo |
| `create` | `src/components/ui/alert-message.tsx` | mensagem de formulário |

---

## Implementation

> **Reference pattern**: `.makuco/resources/reference.html` — os blocos `.logo`, `.paws/.paw`, `.card`, `.field input`, `.eye-btn`, `.btn-submit` e `.signup` são o contrato visual. Os tokens equivalentes já existem no `tailwind.config.js` (TASK-FRONTEND-008): use `bg-brand-purple`, `rounded-field`, `shadow-card` etc., **nunca** `#7c3aed` literal.

### `src/components/ui/catdog-logo.tsx` *(create)*
- Porta o SVG do mockup (elipses laranja do corpo/orelhas/cabeça, olhos brancos, focinho `brand.orange-dark`, rabo em `path`) mantendo `viewBox="0 0 40 40"`.
- Props: `{ size?: number }` (default 36, como no mockup). Acompanhado do texto "CatDog" em `font-extrabold text-[1.45rem] tracking-[-0.3px] text-ink`.
- Acessibilidade: `role="img"` + `<title>CatDog</title>` dentro do SVG. As cores ficam em `fill` literal **apenas dentro do SVG** (é ilustração, não estilo de layout).

### `src/components/ui/paw-background.tsx` *(create)*
- Porta o SVG de pegada do mockup e o distribui em posições percentuais.
- **Divergência obrigatória do mockup**: as 16 posições e as rotações devem ser uma **constante literal**, não `Math.random()`. Aleatoriedade em render quebra snapshot de teste e produz layout diferente a cada montagem.
- Container: `fixed inset-0 z-0 pointer-events-none` com `aria-hidden="true"` — é decoração pura e não pode entrar na árvore de acessibilidade nem capturar clique.
- Cor e opacidade por token: `text-paw opacity-[0.18]` com o SVG em `fill-current`.

### `src/components/ui/auth-card.tsx` *(create)*
- Props: `{ title: string; subtitle?: string; children: ReactNode }`.
- Classes: `relative z-10 w-full max-w-card bg-surface-card rounded-card shadow-card p-card animate-fadeUp`. O `z-10` é o que mantém o card acima das pegadas.
- Renderiza `CatDogLogo` centralizado, `<h1>` com o `title` (`text-[1.35rem] font-extrabold text-ink`) e o `subtitle` (`text-[0.82rem] font-semibold text-ink-muted`), depois `children`.
- O `<h1>` é obrigatório e único por página — é a âncora de navegação por cabeçalho do leitor de tela.

### `src/components/ui/text-field.tsx` *(create)*
- Props: `{ id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>`.
- **Divergência obrigatória do mockup**: o mockup usa apenas `placeholder`. Aqui todo campo tem `<label htmlFor={id}>` de verdade — visualmente oculto (classe `sr-only`) para preservar o visual, mas presente no DOM. Placeholder não é rótulo: some ao digitar e não é lido de forma confiável (RNF-05).
- Input: `w-full bg-surface-input border-[1.5px] border-hairline rounded-field px-4 py-[13px] text-[0.875rem] font-semibold text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-brand-purple focus:shadow-focus-ring`.
- Quando `error` está presente: `aria-invalid="true"`, `aria-describedby={`${id}-error`}` e borda em `border-brand-orange`. Sem `error`, **não** emitir os atributos ARIA.

### `src/components/ui/password-field.tsx` *(create)*
- Reaproveita a estrutura do `TextField`; alterna `type` entre `password` e `text` por estado interno.
- Botão do olho: `type="button"` (sem isso ele submete o formulário), posicionado `absolute right-[14px] top-1/2 -translate-y-1/2`, cor `text-ink-muted hover:text-brand-purple`.
- Acessibilidade: `aria-label` alternando entre "Mostrar senha" e "Ocultar senha", mais `aria-pressed` refletindo o estado. Deve permanecer no tab order e ser acionável por `Enter`/`Espaço`.
- Os dois ícones (olho aberto / olho cortado) são os SVGs do mockup, alternados por render condicional — **não** manipular `innerHTML` como faz o `reference.html`.
- Área de toque mínima de 44×44px (padding no botão), mesmo com o ícone de 18px.

### `src/components/ui/submit-button.tsx` *(create)*
- Props: `{ isLoading: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>`.
- `type="submit"`, `disabled={isLoading || props.disabled}` — a spec exige explicitamente que o botão fique desabilitado durante a requisição para evitar submissão duplicada.
- Classes: `w-full rounded-field py-[14px] bg-brand-purple text-white text-[0.95rem] font-extrabold tracking-[0.3px] shadow-button transition hover:bg-brand-purple-hover hover:shadow-button-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`.
- Enquanto `isLoading`, trocar o rótulo por um texto de progresso e expor `aria-busy="true"`.

### `src/components/ui/field-error.tsx` *(create)*
- Props: `{ id: string; message: string }`. Renderiza `<p id={id} className="mt-1 text-[0.75rem] font-semibold text-brand-orange">`.
- Laranja da marca como cor de erro: reaproveita a identidade sem introduzir um vermelho fora do design system. A mensagem nunca é o único indicador — anda junto de `aria-invalid` no campo.

### `src/components/ui/alert-message.tsx` *(create)*
- Props: `{ variant: 'success' | 'error' | 'info'; children: ReactNode }`. `role="alert"` — é o que faz o leitor de tela anunciar "E-mail ou senha incorretos." sem o usuário procurar.
- Paleta por variante usando os tokens: `success` sobre `brand.purple-light` com texto `ink`; `error` com borda/texto `brand.orange`; `info` neutro com `hairline` e `ink.mid`.

---

## Acceptance Criteria

- [ ] **Given** `AuthCard` renderizado, **When** inspecionado, **Then** exibe o logotipo, um único `<h1>` com o título, o subtítulo e os filhos, com a animação `fadeUp` aplicada.
- [ ] **Given** qualquer `TextField`, **When** inspecionado o DOM, **Then** existe um `<label>` associado por `htmlFor`/`id` — mesmo quando visualmente oculto.
- [ ] **Given** `TextField` com `error`, **When** renderizado, **Then** o input tem `aria-invalid="true"` e `aria-describedby` apontando para o `FieldError` correspondente; **Given** sem `error`, **Then** nenhum dos dois atributos está presente.
- [ ] **Given** `PasswordField`, **When** o botão do olho é acionado, **Then** o `type` alterna `password` ↔ `text`, o ícone troca e o `aria-label` passa de "Mostrar senha" para "Ocultar senha".
- [ ] **Given** `PasswordField` dentro de um `<form>`, **When** o botão do olho é clicado, **Then** o formulário **não** é submetido.
- [ ] **Given** navegação apenas por teclado, **When** o usuário percorre o card com Tab, **Then** alcança todos os campos, o botão do olho e o botão de submit, e consegue submeter com Enter (RNF-05).
- [ ] **Given** `SubmitButton` com `isLoading`, **When** renderizado, **Then** está `disabled`, com `aria-busy="true"`, e cliques não disparam `onClick`.
- [ ] **Given** `PawBackground` montado duas vezes, **When** comparado o DOM, **Then** as posições das pegadas são idênticas; o container tem `aria-hidden="true"` e não intercepta cliques.
- [ ] **Given** `AlertMessage`, **When** renderizado, **Then** possui `role="alert"`.
- [ ] **Given** os textos sobre seus fundos (`ink` sobre branco, branco sobre `brand.purple`, `brand.orange` sobre branco), **When** medido o contraste, **Then** todos atingem no mínimo 4.5:1 (WCAG AA). Se `ink.muted` sobre `surface.input` não atingir, usar `ink.mid` para texto informativo e reportar.
- [ ] Busca por `#7c3aed`, `#e05a1e` ou `#dde0ea` nos arquivos `.tsx` retorna ocorrências **apenas** dentro dos SVGs de ilustração.

---

## Dependencies

- **Requires**: TASK-FRONTEND-008 (tokens do Tailwind, alias `~/`, folha base).
- **Blocks**: TASK-FRONTEND-011 (layouts usam `PawBackground` e `CatDogLogo`), TASK-FRONTEND-012 (páginas montam os formulários com estes componentes), TASK-FRONTEND-013 (testes de componente).

> **Decisão registrada — link "Esqueceu sua senha?"**: presente no `reference.html`, **omitido** nesta entrega. A seção "Tela de login" da spec enumera apenas e-mail, senha, botão "Entrar" e link para registro, e recuperação de senha está explicitamente fora do escopo. Expor um caminho morto é pior que a ausência. Os estilos equivalentes (`text-[0.8rem] font-bold text-brand-purple hover:text-brand-purple-hover hover:underline`) já são alcançáveis pelos tokens quando a feature de recuperação existir.
