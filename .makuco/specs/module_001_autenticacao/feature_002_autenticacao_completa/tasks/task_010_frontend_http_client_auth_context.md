# TASK-FRONTEND-010 — Cliente HTTP com refresh single-flight e contexto de autenticação

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-010-frontend-http-client-auth-context`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 10 of 13 — Camada de API e Sessão
**Generated**: `2026-08-19`

---

## Context

Implementa o lado cliente de HU-04: um wrapper de `fetch` que renova a sessão automaticamente quando o access token expira, e o `AuthProvider` que sustenta o estado da sessão. O ponto crítico é a **fila single-flight**: mais de uma chamada simultânea a `/auth/refresh` faria o backend interpretar reuso de token e derrubar a sessão do usuário legítimo (RN-07).

---

## Scope

**In:** Tipo de erro da API, guarda em memória do access token, wrapper de `fetch` com retry único e fila de refresh, funções de chamada dos endpoints de auth, e o contexto/provider/hook de autenticação.

**Out:** Nenhuma rota, guard ou layout (TASK-FRONTEND-011). Nenhuma página ou formulário (TASK-FRONTEND-012). Não montar o provider em `main.tsx` — isso acontece junto do roteador na TASK-FRONTEND-011. **Não** persistir token em `localStorage`/`sessionStorage` em hipótese alguma. Não instalar axios nem react-query. Sem testes (TASK-FRONTEND-013).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Sessão expirada | `ApiError` com `code === 'SESSION_EXPIRED'` → `onSessionExpired()` |
| Renovar sessão | `authApi.refresh()` → `POST /auth/refresh` |
| Usuário autenticado | `AuthUser = { id, name, email, role: 'admin' \| 'cliente' }` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/services/api/api-error.ts` | erro tipado da API |
| `create` | `src/services/api/access-token-store.ts` | token só em memória |
| `create` | `src/services/api/http-client.ts` | fetch com refresh |
| `create` | `src/services/api/auth-api.ts` | chamadas de auth |
| `create` | `src/contexts/auth/auth.types.ts` | contratos do contexto |
| `create` | `src/contexts/auth/auth-context.ts` | createContext |
| `create` | `src/contexts/auth/auth-provider.tsx` | estado da sessão |
| `create` | `src/contexts/auth/use-auth.ts` | hook de consumo |

---

## Implementation

> **Reference pattern**: o contrato HTTP congelado nas TASK-BACKEND-004/005/006 é a fonte de verdade — envelope de erro `{ error: { code, message, details? } }`, `POST /auth/login` respondendo `{ accessToken, expiresIn, user }` e o refresh transportado em cookie `httpOnly`. `src/config/env.ts` (TASK-FRONTEND-008) fornece `apiBaseUrl`.

### `src/services/api/api-error.ts` *(create)*
- `export class ApiError extends Error` com `status: number`, `code: string`, `details?: Array<{ field: string; message: string }>`.
- Helper `fieldErrorsOf(error): Record<string, string>` para os formulários mapearem `details` por campo sem repetir a lógica.
- `code` é o discriminador de fluxo (ex.: `ACCOUNT_NOT_CONFIRMED` habilita o CTA de reenvio); `message` já vem em PT-BR pronto para exibição — **nunca** montar texto de erro a partir do status.

### `src/services/api/access-token-store.ts` *(create)*
- Variável de módulo com `getAccessToken()`, `setAccessToken(token)`, `clearAccessToken()`.
- **Fora do estado do React** de propósito: evita re-render a cada renovação e impede que o token apareça em devtools de estado ou em serialização acidental.
- **Nunca** tocar em `localStorage`/`sessionStorage`: token em storage é roubável por XSS. O custo aceito é que um F5 exige um round-trip de refresh — coberto pelo estado `bootstrapping`.

### `src/services/api/http-client.ts` *(create)*
- `request<T>(path, options?): Promise<T>` com `credentials: 'include'` **sempre** (é o que envia o cookie de refresh) e `Authorization: Bearer <token>` quando houver token.
- Toda resposta não-ok é convertida em `ApiError` a partir do envelope; `204` retorna `undefined` sem tentar parsear JSON.
- **Fila single-flight** — a regra mais importante do arquivo:
```
1. resposta = fetch(...)
2. se status !== 401  OU  path é '/auth/refresh'  OU  options.skipRefresh → retorna/lança
3. se já existe refreshPromise pendente → aguarda ELA (não dispara outra)
   senão → refreshPromise = authApi.refresh().finally(() => { refreshPromise = null })
4. await refreshPromise
   ├─ sucesso → setAccessToken(novo) → repete o request original UMA vez
   └─ falha   → clearAccessToken(); onSessionExpired(); lança ApiError SESSION_EXPIRED
```
- Regras não negociáveis: **no máximo um** `POST /auth/refresh` em voo por aba; retry **uma única** vez (nunca laço); refresh apenas **reativo** a `401` (nada de timer proativo, que multiplicaria rotações); `/auth/refresh` e `/auth/login` nunca entram no ciclo.
- Expor `setOnSessionExpired(callback)` — o cliente HTTP não pode importar o roteador nem o contexto (criaria dependência circular); ele apenas avisa quem registrou.

### `src/services/api/auth-api.ts` *(create)*
- Uma função por endpoint, tipadas: `register`, `confirmEmail`, `resendConfirmation`, `login`, `refresh`, `logout`, `me`.
- `register` envia **apenas** `{ name, email, password }` — o campo de confirmação de senha nunca trafega (RN-12).
- `refresh` e `login` devem ser chamados com `skipRefresh: true` para não recursar.
- Nenhuma função aqui trata erro: elas propagam `ApiError` para quem chamou decidir a UI.

### `src/contexts/auth/auth.types.ts` *(create)*
```ts
type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';
interface AuthUser { id: string; name: string; email: string; role: 'admin' | 'cliente' }
interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login(input: { email: string; password: string }): Promise<AuthUser>;
  logout(reason?: 'user' | 'session-expired'): Promise<void>;
  register(input: { name: string; email: string; password: string }): Promise<void>;
}
```
- O terceiro estado `bootstrapping` é **obrigatório**: no F5 o token em memória some e o provider precisa tentar o refresh **antes** de os guards decidirem. Sem ele, todo usuário logado é jogado para `/login` a cada reload.

### `src/contexts/auth/auth-context.ts` *(create)*
- `createContext<AuthContextValue | null>(null)`. O `null` inicial é o que permite ao hook detectar uso fora do provider.

### `src/contexts/auth/auth-provider.tsx` *(create)*
- No mount (uma única vez): tenta `authApi.refresh()`; sucesso ⇒ guarda o token, seta `user` e `status = 'authenticated'`; falha ⇒ `status = 'anonymous'` **sem** exibir erro (usuário nunca logado é o caso normal, não uma falha).
- Registra `setOnSessionExpired(...)` no efeito de mount, limpando o registro no unmount: zera o usuário, define `status = 'anonymous'` e marca o motivo `session-expired` para a UI mostrar "Sua sessão expirou. Faça login novamente.".
- `login` chama a API, guarda o token no store e retorna o `AuthUser` — quem navega é a página, não o provider (mantém o provider desacoplado do roteador).
- `logout` chama a API, limpa store e estado; **nunca lança**, mesmo se a chamada falhar — o usuário local precisa sair de qualquer forma.
- `register` apenas encaminha para a API: registro **não** autentica (a conta nasce pendente de confirmação).
- Memoizar o objeto de contexto com `useMemo` — sem isso todo consumidor re-renderiza a cada render do provider.

### `src/contexts/auth/use-auth.ts` *(create)*
- Hook que lança erro explícito ("useAuth deve ser usado dentro de AuthProvider") quando o contexto é `null`, em vez de devolver `undefined` e quebrar longe da causa.

---

## Acceptance Criteria

- [ ] **Given** uma requisição autenticada que recebe `401`, **When** o refresh tem sucesso, **Then** o request original é repetido uma vez com o novo token e o chamador recebe o resultado sem perceber a renovação.
- [ ] **Given** três requisições simultâneas que recebem `401`, **When** processadas, **Then** `POST /auth/refresh` é chamado **exatamente uma vez** e as três são repetidas após a mesma promise resolver.
- [ ] **Given** o refresh falha com `SESSION_EXPIRED`, **When** processado, **Then** o token em memória é limpo, `onSessionExpired` dispara uma única vez e o chamador recebe `ApiError` com `code === 'SESSION_EXPIRED'`.
- [ ] **Given** o próprio `POST /auth/refresh` responde `401`, **When** processado, **Then** **não** há tentativa de refresh recursiva.
- [ ] **Given** uma requisição que recebe `401` e cujo retry também recebe `401`, **When** processada, **Then** não há terceira tentativa.
- [ ] **Given** qualquer requisição, **When** inspecionada, **Then** inclui `credentials: 'include'`.
- [ ] **Given** login bem-sucedido, **When** inspecionados `localStorage` e `sessionStorage`, **Then** não contêm o access token nem o refresh token.
- [ ] **Given** resposta `400` com `details`, **When** convertida, **Then** `ApiError.details` preserva os pares campo/mensagem e `fieldErrorsOf` produz o mapa por campo.
- [ ] **Given** resposta `204` do logout, **When** processada, **Then** resolve sem erro de parsing de JSON.
- [ ] **Given** o app montado com cookie de sessão válido, **When** carrega, **Then** `status` passa por `'bootstrapping'` e termina em `'authenticated'` com `user` preenchido; **Given** sem cookie, **Then** termina em `'anonymous'` sem mensagem de erro.
- [ ] **Given** `useAuth()` chamado fora do `AuthProvider`, **When** executado, **Then** lança erro com mensagem explícita.
- [ ] **Given** `logout` e a API indisponível, **When** chamado, **Then** o estado local é limpo mesmo assim e nenhuma exceção vaza.

---

## Dependencies

- **Requires**: TASK-FRONTEND-008 (`config/env.ts`, alias), TASK-BACKEND-005 (contrato de `/login`, `/refresh`, `/logout` congelado), TASK-BACKEND-006 (`GET /auth/me`). Este é o ponto de junção entre as duas trilhas paralelas.
- **Blocks**: TASK-FRONTEND-011 (guards leem `status`/`user`), TASK-FRONTEND-012 (páginas chamam `login`/`register`), TASK-FRONTEND-013.
