# TASK-FRONTEND-008 — Scaffolding do frontend e design system a partir do reference.html

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-008-frontend-scaffolding-design-tokens`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 8 of 13 — Scaffolding e Design System
**Generated**: `2026-08-19`

---

## Context

`services/frontend/` está vazio. Este slice cria o esqueleto React 18 + Vite 5 + Tailwind 3 e — o que realmente importa — traduz os design tokens do mockup `.makuco/resources/reference.html` para `tailwind.config.js`, de modo que todos os slices seguintes construam a identidade CatDog usando classes utilitárias em vez de CSS solto.

---

## Scope

**In:** Manifests e configs (Vite com proxy `/api`, TypeScript com alias `~/`, Tailwind, PostCSS), `index.html` com a fonte Nunito, folha de estilos base, acesso tipado a `import.meta.env`, e o shell da aplicação (`main.tsx`, `App.tsx`).

**Out:** Nenhum componente de UI (TASK-FRONTEND-009). Nenhuma rota, guard ou layout (TASK-FRONTEND-011). Nenhuma chamada de API ou contexto de autenticação (TASK-FRONTEND-010). Nenhuma página (TASK-FRONTEND-012). Sem Jest (TASK-FRONTEND-013). Não copiar o CSS do `reference.html` para dentro do projeto — ele é referência de valores, não código a reaproveitar. Não tocar em `services/backend/`.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `package.json` | deps e scripts |
| `create` | `vite.config.ts` | alias e proxy /api |
| `create` | `tsconfig.json` | strict + alias `~/` |
| `create` | `tailwind.config.js` | design tokens CatDog |
| `create` | `postcss.config.js` | pipeline tailwind |
| `create` | `.gitignore` | ignora node_modules/dist |
| `create` | `index.html` | shell e fonte Nunito |
| `create` | `src/styles/index.css` | camadas tailwind |
| `create` | `src/config/env.ts` | isola import.meta.env |
| `create` | `src/main.tsx` | monta React |
| `create` | `src/App.tsx` | raiz da aplicação |

---

## Implementation

> **Reference pattern**: `.makuco/resources/reference.html` é a fonte **normativa** dos valores visuais (cores, raios, sombras, tipografia, animação). Todo valor abaixo foi extraído dele — não improvisar tons próximos.

### `package.json` *(create)*
- Deps: `react@^18`, `react-dom@^18`, `react-router-dom@^6`. Dev: `vite@^5`, `@vitejs/plugin-react`, `typescript@^5`, `tailwindcss@^3`, `postcss`, `autoprefixer`, `@types/react`, `@types/react-dom`.
- **Não** adicionar `axios` — o wrapper de `fetch` da TASK-FRONTEND-010 cobre a necessidade sem dependência extra. Nada de Jest aqui.
- Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck`.
- Acompanha `.gitignore` com `node_modules/`, `dist/`, `.env`, `coverage/`.

### `vite.config.ts` *(create)*
- Plugin React; `resolve.alias`: `'~'` → `path.resolve(__dirname, 'src')` — o alias precisa existir **nos dois lugares** (aqui e no `tsconfig`), senão compila e quebra em runtime.
- `server.proxy`: `'/api'` → `http://localhost:3333`, `changeOrigin: true`. Isto é o que faz o cookie de refresh funcionar em desenvolvimento **como mesma origem**, evitando `SameSite=None` e toda a dor de cookie cross-site local.
- `server.port: 5173` — precisa bater com `CORS_ALLOWED_ORIGINS` e `APP_WEB_URL` do backend.

### `tsconfig.json` *(create)*
- `"jsx": "react-jsx"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ES2022"`, `"lib": ["ES2022","DOM","DOM.Iterable"]`, `"types": ["vite/client"]`.
- `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `noEmit: true`; `paths: { "~/*": ["src/*"] }`.

### `tailwind.config.js` *(create)*
- `content: ['./index.html', './src/**/*.{ts,tsx}']`.
- Tokens sob namespaces próprios (`brand`, `ink`, `surface`, `hairline`, `paw`) em vez de sobrescrever `purple`/`gray` — assim nenhuma escala padrão do Tailwind é destruída e cada token permanece rastreável até a variável CSS de origem.

```js
theme: { extend: {
  colors: {
    brand: { purple:'#7c3aed', 'purple-hover':'#6d28d9', 'purple-light':'#ede9fe',
             orange:'#e05a1e', 'orange-dark':'#c44a10' },
    ink:   { DEFAULT:'#1e1b2e', mid:'#4b4869', muted:'#9896b0' },
    surface:{ card:'#ffffff', input:'#f8f7fc', canvas:'#dde0ea' },
    hairline:'#e4e2f0',
    paw:'#b0aec8',
  },
  borderRadius: { field:'14px', card:'22px' },
  boxShadow: {
    card:'0 8px 40px rgba(100, 80, 180, 0.13)',
    button:'0 4px 16px rgba(124, 58, 237, 0.30)',
    'button-hover':'0 6px 20px rgba(124, 58, 237, 0.40)',
    'focus-ring':'0 0 0 3px rgba(124, 58, 237, 0.10)',
  },
  fontFamily: { sans: ['Nunito','system-ui','-apple-system','Segoe UI','Arial','sans-serif'] },
  keyframes: { fadeUp: { from:{opacity:'0',transform:'translateY(28px)'},
                         to:{opacity:'1',transform:'translateY(0)'} } },
  animation: { fadeUp:'fadeUp 0.55s cubic-bezier(.22,1,.36,1) both' },
  maxWidth: { card:'420px' },
  spacing:  { card:'44px' },
} }
```

Rastreabilidade com o mockup: `brand.purple` = `--purple` (botão, foco, links); `brand.purple-hover` = `--purple-hover`; `brand.orange` = `--orange` (logo); `ink.*` = `--text-dark`/`--text-mid`/`--text-muted`; `surface.canvas` = `--bg` (fundo da página); `surface.input` = `--input-bg`; `hairline` = `--border`; `borderRadius.field` = `--radius` (14px, inputs e botão); `borderRadius.card` = 22px do `.card`; `boxShadow.card` = `--shadow`; `animation.fadeUp` = keyframes `fadeUp` do card; `maxWidth.card`/`spacing.card` = `max-width:420px` e `padding:44px`.

### `postcss.config.js` *(create)*
- Apenas `tailwindcss` e `autoprefixer`.

### `index.html` *(create)*
- `<html lang="pt-BR">` — o produto é PT-BR e isso afeta leitores de tela e correção ortográfica.
- Preconnect + `<link>` do Google Fonts para **Nunito nos pesos 400, 600, 700 e 800** (exatamente os do mockup; o botão usa 800, os campos 600).
- `<title>CatDog</title>`, `<div id="root">`, `<script type="module" src="/src/main.tsx">`.

### `src/styles/index.css` *(create)*
- As três diretivas `@tailwind base/components/utilities`, nessa ordem.
- Em `@layer base`: `body { @apply font-sans bg-surface-canvas text-ink; }` e `html { -webkit-font-smoothing: antialiased; }`.
- Bloco `@media (prefers-reduced-motion: reduce)` zerando `animation`/`transition` — a animação `fadeUp` do card não pode ser imposta a quem pediu menos movimento.
- **Nenhuma** classe utilitária customizada aqui: os tokens já vivem no `tailwind.config.js`.

### `src/config/env.ts` *(create)*
- **Único** arquivo do projeto autorizado a ler `import.meta.env`. Exporta `env = { apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api' }`.
- Restrição arquitetural, não estilística: `import.meta` é erro de sintaxe sob a transformação CommonJS do Jest, e concentrar o acesso aqui permite mapear este módulo para um mock na TASK-FRONTEND-013. Espalhar `import.meta.env` inviabiliza a suíte de testes.
- Valor default `/api` faz o proxy do Vite funcionar em dev sem `.env` local; em produção define-se `VITE_API_BASE_URL` com a URL absoluta da API.

### `src/main.tsx` *(create)*
- `ReactDOM.createRoot(...).render(<StrictMode><App /></StrictMode>)`, importando `~/styles/index.css`.
- **Não** adicionar `BrowserRouter` nem provider de autenticação aqui — eles entram nas TASK-FRONTEND-010/011, e antecipá-los cria conflito de merge.

### `src/App.tsx` *(create)*
- Nesta task, apenas um placeholder que renderiza o card de exemplo com os tokens (fundo `surface-canvas`, card branco `rounded-card shadow-card p-card max-w-card animate-fadeUp`) — serve como prova visual de que o design system está funcionando e será substituído pelo roteador na TASK-FRONTEND-011.

---

## Acceptance Criteria

- [ ] **Given** o projeto instalado, **When** `npm run dev`, **Then** a aplicação sobe em `http://localhost:5173` e renderiza o placeholder sem erro no console.
- [ ] **Given** o backend rodando na 3333, **When** o app chama `/api/health` pelo dev server, **Then** a requisição é proxeada com sucesso e o navegador a trata como **mesma origem** (sem preflight CORS).
- [ ] **Given** o placeholder renderizado, **When** inspecionado, **Then** o fundo da página é `#dde0ea`, o card é branco com raio 22px e sombra `0 8px 40px rgba(100,80,180,0.13)`, e o texto usa a família Nunito.
- [ ] **Given** o card, **When** a página carrega, **Then** ele executa a animação `fadeUp` (opacidade 0→1 com deslocamento de 28px) uma única vez.
- [ ] **Given** o sistema com "reduzir movimento" ativo, **When** a página carrega, **Then** nenhuma animação é executada.
- [ ] **Given** as classes `bg-brand-purple`, `text-ink-muted`, `rounded-field`, `shadow-button`, `max-w-card`, `p-card` e `animate-fadeUp`, **When** usadas, **Then** todas resolvem para os valores do `reference.html`.
- [ ] **Given** `import { env } from '~/config/env'`, **When** compilado, **Then** o alias resolve tanto no `tsc --noEmit` quanto no build do Vite.
- [ ] **Given** uma busca por `import.meta.env` em `src/`, **When** executada, **Then** retorna ocorrências **apenas** em `src/config/env.ts`.
- [ ] **Given** `npm run build`, **When** executado, **Then** termina com 0 erros de tipo e gera `dist/`.
- [ ] Nenhum arquivo do projeto contém o tipo `any`; nenhum CSS do `reference.html` foi copiado literalmente.

---

## Dependencies

- **Requires**: nenhuma task. Pode ser executada **em paralelo** com todo o backend (TASK-BACKEND-001..007) — não depende de nenhum contrato de API.
- **Blocks**: TASK-FRONTEND-009 (componentes usam os tokens), TASK-FRONTEND-010, TASK-FRONTEND-011, TASK-FRONTEND-012, TASK-FRONTEND-013.
