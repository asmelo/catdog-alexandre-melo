# TASK-FRONTEND-013 — Suíte de testes do frontend

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-013-frontend-test-suite`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 13 of 13 — Testes do Frontend
**Generated**: `2026-08-19`

---

## Context

Fecha a FEATURE-002 cobrindo o lado cliente com Jest 29 + Testing Library, atingindo os 80% exigidos pelo critério de qualidade da spec. Dois pontos concentram o risco e precisam de teste dedicado: a **fila single-flight** do refresh e o **redirecionamento por role** (CT-16 / CT-17).

---

## Scope

**In:** Configuração do Jest para o ambiente Vite/JSX, mock do módulo de env, e specs de `http-client`, `AuthProvider`, `RoleRoute`, `PasswordField` e da tela de login.

**Out:** Não alterar código de `src/` para acomodar teste — reportar se algo não for testável. Não usar Vitest (a stack fixada é Jest 29; trocar exigiria ADR). Sem E2E, sem teste de regressão visual, sem chamada real de rede. Não alterar `sonar-project.properties` — a TASK-BACKEND-007 já declarou os dois caminhos de cobertura.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `jest.config.ts` | config jsdom e thresholds |
| `create` | `babel.config.cjs` | transform TSX |
| `create` | `tests/setup.ts` | matchers e limpeza |
| `create` | `tests/env-mock.ts` | substitui import.meta.env |
| `create` | `src/services/api/http-client.spec.ts` | fila single-flight |
| `create` | `src/contexts/auth/auth-provider.spec.tsx` | bootstrap e sessão |
| `create` | `src/routes/role-route.spec.tsx` | CT-16 e CT-17 |
| `create` | `src/components/ui/password-field.spec.tsx` | toggle e acessibilidade |
| `create` | `src/pages/auth/login-page.spec.tsx` | fluxo de login |
| `modify` | `package.json` | deps e script test |

---

## Implementation

> **Reference pattern**: `services/backend/jest.config.ts` e `services/backend/tests/` (TASK-BACKEND-007) para o estilo de config, nomeação por ID de caso de teste e uso de dublês explícitos. As divergências abaixo existem porque o ambiente é jsdom + Vite.

### `jest.config.ts` *(create)*
- `testEnvironment: 'jsdom'`; transform por **`babel-jest`**, não `ts-jest`. Motivo: `ts-jest` com JSX e ESM do Vite é fonte recorrente de atrito, e o type-check já é feito por `tsc --noEmit` no build — duplicá-lo no runner só deixa a suíte lenta.
- `moduleNameMapper` com três entradas obrigatórias: `'^~/(.*)$' → '<rootDir>/src/$1'`; `'\\.(css|less|scss)$' → 'identity-obj-proxy'`; **`'^~/config/env$' → '<rootDir>/tests/env-mock.ts'`**.
- A terceira é estrutural, não conveniência: `import.meta.env` é **erro de sintaxe** sob a transformação CommonJS do Jest. Só funciona porque a TASK-FRONTEND-008 confinou esse acesso em um único módulo.
- `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!src/**/*.d.ts', '!src/**/*.spec.{ts,tsx}']`; `coverageThreshold` global em 80; `coverageReporters: ['text','lcov']`.

### `babel.config.cjs` *(create)*
- `@babel/preset-env` com `targets: { node: 'current' }`, `@babel/preset-react` com `runtime: 'automatic'`, e `@babel/preset-typescript`.
- Extensão `.cjs` de propósito — evita conflito caso o `package.json` passe a declarar `"type": "module"`.

### `tests/setup.ts` *(create)*
- Importa `@testing-library/jest-dom`; `afterEach(cleanup)`; reseta o `access-token-store` e limpa mocks de `fetch` entre testes para não vazar estado de sessão de um teste para outro.

### `tests/env-mock.ts` *(create)*
- Exporta `env = { apiBaseUrl: '/api' }`, com a mesma forma do módulo real — se o contrato divergir, os testes passam e a aplicação quebra.

### `src/services/api/http-client.spec.ts` *(create)*
- `fetch` dublado com `jest.spyOn(global, 'fetch')`, montando filas de respostas por chamada.
- Cenários obrigatórios: `401` seguido de refresh bem-sucedido repete o request original **uma** vez; **três** requisições concorrentes em `401` disparam **exatamente um** `POST /auth/refresh` (asserção sobre a contagem de chamadas — é o teste que protege contra a falsa detecção de reuso do RN-07); refresh falho limpa o token, dispara `onSessionExpired` uma única vez e propaga `SESSION_EXPIRED`; `401` no próprio `/auth/refresh` não recursa; retry que também recebe `401` não tenta uma terceira vez; toda requisição usa `credentials: 'include'`.
- Para o teste de concorrência, resolver a promise do refresh manualmente (deferred) — sem controlar o tempo, o teste passa por acidente.

### `src/contexts/auth/auth-provider.spec.tsx` *(create)*
- Refresh de bootstrap com sucesso → `status` termina `'authenticated'` com `user`; com falha → `'anonymous'` e **nenhuma** mensagem de erro exibida.
- `login` popula usuário e token; `logout` limpa o estado mesmo quando a API rejeita; `useAuth` fora do provider lança erro.
- Verificar que o access token não aparece em `localStorage` nem em `sessionStorage` após o login.

### `src/routes/role-route.spec.tsx` *(create)*
- Renderizar com `MemoryRouter` e um provider de autenticação dublado.
- `it('CT-16: cliente acessando rota de admin é redirecionado para a área do cliente')` — asserção por **ausência no DOM** do conteúdo administrativo, nunca por estilo ou visibilidade.
- `it('CT-17: usuário não autenticado em rota protegida é redirecionado para o login')`.
- Terceiro caso: `status === 'bootstrapping'` renderiza o splash e **não** redireciona — é a regressão que desloga o usuário a cada F5.

### `src/components/ui/password-field.spec.tsx` *(create)*
- `userEvent` alternando o botão do olho: `type` muda `password` ↔ `text`, `aria-label` alterna "Mostrar senha"/"Ocultar senha".
- Dentro de um `<form>` com `onSubmit` espionado, clicar no olho **não** submete.
- Com `error`, o input tem `aria-invalid="true"` e `aria-describedby` apontando para a mensagem; sem `error`, os atributos estão ausentes.
- O `<label>` é recuperável por `getByLabelText` — prova de que o rótulo existe no DOM mesmo estando visualmente oculto.

### `src/pages/auth/login-page.spec.tsx` *(create)*
- `authApi` dublado. Cenários nomeados por ID: CT-09 (admin → `/admin`), CT-10 (cliente → `/minha-area`), CT-11 e CT-12 (ambos exibem "E-mail ou senha incorretos." — asserção sobre o texto literal), CT-13 (conta não confirmada exibe a mensagem e o botão de reenvio).
- Um teste adicional garante que o botão fica `disabled` durante a requisição e que dois cliques disparam **uma** chamada.
- Todas as interações via `userEvent` (não `fireEvent`) — só ele reproduz foco, teclado e a sequência real de eventos.

### `package.json` *(modify)*
- Dev deps: `jest@^29`, `jest-environment-jsdom`, `babel-jest`, `@babel/preset-env`, `@babel/preset-react`, `@babel/preset-typescript`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `identity-obj-proxy`, `@types/jest`.
- Scripts: `test`, `test:cov`, `test:watch`.

---

## Acceptance Criteria

- [ ] **Given** a suíte, **When** `npm run test:cov`, **Then** todos os testes passam e as quatro métricas ficam ≥ 80% — o comando **falha** se alguma cair abaixo.
- [ ] **Given** a suíte, **When** executada sem rede, **Then** passa integralmente: nenhuma chamada real de `fetch` escapa dos dublês.
- [ ] **Given** o teste de concorrência do `http-client`, **When** executado, **Then** afirma que `POST /auth/refresh` foi chamado **exatamente uma vez** para três requisições concorrentes em `401`.
- [ ] **Given** os nomes dos testes, **When** listados, **Then** existe um `it` referenciando CT-09, CT-10, CT-11, CT-12, CT-13, CT-16 e CT-17.
- [ ] **Given** o teste de CT-16, **When** executado, **Then** a asserção é de ausência do conteúdo no DOM (`queryBy...` retornando `null`), não de estilo.
- [ ] **Given** os testes de CT-11 e CT-12, **When** comparados, **Then** ambos afirmam exatamente o mesmo texto na tela.
- [ ] **Given** `npm run test:cov`, **When** concluído, **Then** `coverage/lcov.info` existe e é lido pelo `sonar.javascript.lcov.reportPaths` já configurado.
- [ ] **Given** a suíte, **When** executada duas vezes em ordem aleatória, **Then** o resultado é idêntico.
- [ ] **Given** o Quality Gate do Sonar sobre os dois serviços, **When** executado, **Then** aprova sem bloqueadores e sem issue de segurança Blocker/Critical.
- [ ] Nenhum arquivo de `src/` foi alterado por este slice.

---

## Dependencies

- **Requires**: TASK-FRONTEND-008 a TASK-FRONTEND-012 concluídas; TASK-BACKEND-007 (que já declarou `sonar.javascript.lcov.reportPaths` para os dois serviços).
- **Blocks**: nenhuma. É o último slice da FEATURE-002.
