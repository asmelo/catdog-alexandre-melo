# TASK-FRONTEND-011 — Suíte de testes da feature no frontend

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-011-frontend-species-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 11 of 11 — Testes do frontend
**Generated**: `2026-08-25`

---

## Context

Fecha a feature cobrindo os casos de interface (CT-01 a CT-11, CT-13 a CT-24, CT-27, CT-28, CT-29, CT-35 a CT-40) e a regressão obrigatória sobre a FEATURE-002 — a navegação administrativa mudou e `/admin`, destino do redirecionamento pós-login por role, passou a redirecionar.

---

## Scope

**In:** Specs co-locados das primitivas de UI novas, da validação, da camada de API, da linha da lista, do formulário de criação, da página inteira e das rotas/layout administrativo, mais a regressão de redirecionamento por role.

**Out:** Não alterar nenhum arquivo de produção — se um teste exigir mudança, reportar em vez de ajustar o código para passar. Não alterar `jest.config.*`, `tests/setup.ts` nem `tests/auth-harness.tsx` além de, se necessário, exportar um novo dublê de sessão com role `admin` (o `USUARIO_ADMIN` já existe). Não escrever teste de contraste, de desempenho ou visual (RNF-04, RNF-05, RNF-08 e RNF-10 são verificados em homologação — QA-22). Não usar `fireEvent`.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/confirm-dialog.spec.tsx` | foco, Escape, ausência |
| `create` | `src/components/ui/icon-button.spec.tsx` | nome acessível |
| `create` | `src/services/api/species-api.spec.ts` | método, caminho, corpo |
| `create` | `src/utils/validation.spec.ts` (estender) | validação do nome |
| `create` | `src/pages/admin/species/species-create-form.spec.tsx` | criação e erros |
| `create` | `src/pages/admin/species/species-row.spec.tsx` | edição em linha |
| `create` | `src/pages/admin/species-page.spec.tsx` | tela completa |
| `create` | `src/layouts/admin-layout.spec.tsx` | navegação lateral |
| `modify` | `src/routes/app-routes.spec.tsx` | rota e redirecionamento |

---

## Implementation

> **Reference pattern**: `src/pages/auth/login-page.spec.tsx` e `src/routes/app-routes.spec.tsx` — uso de `renderizarComSessao(ui, { sessao, rota })`, `userEvent` e `jest.spyOn(globalThis, 'fetch')`.
>
> **Regras não negociáveis do ambiente**: `fetch` real é bloqueado por `tests/setup.ts`, então toda chamada de rede precisa de `jest.spyOn(globalThis, 'fetch')` ou `jest.mock('~/services/api/species-api')`. Sempre `userEvent`, nunca `fireEvent`. Specs co-locados em `src/`, nomeados `*.spec.tsx`. Títulos no formato `it('<CT-NN>: <asserção em PT-BR>')`, corpo em `// Arrange` / `// Act` / `// Assert`. Proibido `any`.

### `src/components/ui/confirm-dialog.spec.tsx` *(create)*
- `open={false}` → asserção de **ausência no DOM** (`queryByRole('dialog')` nulo), não de visibilidade.
- Foco inicial no botão de confirmar; `Escape` chama `onCancel` e não `onConfirm`; `Tab` em laço não alcança nenhum elemento fora do diálogo; foco devolvido ao gatilho após fechar (CT-37).

### `src/components/ui/icon-button.spec.tsx` *(create)*
- `getByRole('button', { name: 'Editar espécie Gato' })` encontra o botão, e o `<svg>` está `aria-hidden` (CT-38 / RNF-07).

### `src/services/api/species-api.spec.ts` *(create)*
- Um teste por função verificando método, caminho e corpo exato pela chamada capturada no espião de `fetch`.
- Teste explícito de que `listSpecies` devolve `{ items }` sem desembrulhar e de que nenhuma função usa `PUT`.
- Teste de que o `ApiError` de um `409` **sobe** — a função rejeita em vez de resolver.

### `src/utils/validation.spec.ts` *(estender o arquivo existente)*
- Testes de tabela para `validateSpeciesNameForm`: `""`, `"   "`, `"G"`, `"Ov"`, 60 caracteres, 61 caracteres, `" Cão   Pastor "` (CT-02 a CT-07 e CT-10).
- Não recriar o arquivo — acrescentar um `describe` novo ao que já cobre login e cadastro.

### `src/pages/admin/species/species-create-form.spec.tsx` *(create)*
- CT-01 (sucesso: campo limpo, foco de volta, callback chamado), CT-02, CT-03, CT-04, CT-07 (sem requisição nos quatro últimos — asserção sobre o espião de `fetch` **não** ter sido chamado), CT-08/CT-09 (`409` com texto preservado no campo), CT-35 (duplo clique → uma requisição só, botão desabilitado).
- Submissão por Enter no campo, sem clique (CT-37).

### `src/pages/admin/species/species-row.spec.tsx` *(create)*
- Modo de exibição: nome e dois botões com nome acessível composto (CT-38).
- Entrada em edição: campo preenchido e com foco; ícones de lápis e lixeira **ausentes** do DOM no modo de edição.
- CT-19 (campo vazio: mensagem, linha permanece em edição, `onSave` não chamado), CT-21 (cancelar restaura), `Escape` equivalente a cancelar.

### `src/pages/admin/species-page.spec.tsx` *(create)*
- Cobertura da orquestração, com `fetch` espionado por cenário:
  - CT-13 e CT-14: ordem dos nomes no DOM;
  - CT-15: estado vazio com a linha de criação ainda presente;
  - CT-36: estado de erro e o botão de nova tentativa refazendo a chamada;
  - CT-16, CT-17, CT-18, CT-20: os quatro desfechos do `PATCH`, cada um com a asserção do que **permanece** inalterado;
  - CT-22, CT-23, CT-24, CT-27: os quatro desfechos do `DELETE`. **CT-24 é o teste mais importante do arquivo**: `409 SPECIES_IN_USE` → a mensagem aparece e a espécie **continua** no DOM;
  - CT-11: "Réptil" e "Reptil" coexistindo na lista;
  - montagem em `StrictMode` → `GET /api/species` chamado exatamente uma vez;
  - RNF-09: as mensagens de sucesso aparecem dentro de um elemento `role="status"`.
- Um teste de percurso completo por teclado, do campo de criação até a confirmação de exclusão, sem nenhum `click` de mouse (CT-37 / CA-21).

### `src/layouts/admin-layout.spec.tsx` *(create)*
- CT-40: exatamente dois itens de navegação, "Animais" e "Espécies", e "Espécies" com `aria-current="page"` quando a rota é `/admin/especies`.
- Asserção de **ausência** de qualquer item chamado "Painel".
- Presença do texto "Administrador" e do nome do usuário — é o que os testes de redirecionamento por role da FEATURE-002 consultam.

### `src/routes/app-routes.spec.tsx` *(modify)*
- Acrescentar, sem remover nada do que já existe:
  - CT-39: sessão de `admin` na rota `/admin` → a tela de espécies renderiza, sem página em branco e sem 404 (CA-01b);
  - CT-28: sessão de `cliente` em `/admin/especies` → redirecionado para `/minha-area` e **nenhum** conteúdo administrativo no DOM (CA-19);
  - CT-29: sem sessão em `/admin/especies` → redirecionado para `/login`;
  - `/admin/inexistente` com sessão de `admin` → `NotFoundPage`, confirmando que o catch-all continua depois da rota filha.
- **Regressão obrigatória da FEATURE-002**: os testes existentes de redirecionamento por role, de acesso a rota protegida sem sessão e de renovação de sessão precisam continuar passando **sem alteração no seu corpo**. Se algum deles exigir edição, a mudança de layout quebrou contrato e o caso é de reportar, não de reescrever o teste.

---

## Acceptance Criteria

- [ ] **Given** `npm test` em `services/frontend`, **When** a suíte roda, **Then** todos os testes passam e a cobertura global permanece ≥ 80% em statements, branches, functions e lines.
- [ ] **Given** a suíte, **When** cada `it` é lido, **Then** o título começa pelo identificador do caso de teste da spec e o corpo está dividido em `// Arrange`, `// Act`, `// Assert`.
- [ ] **Given** a suíte, **When** buscada por `fireEvent`, **Then** nenhuma ocorrência é encontrada.
- [ ] **Given** a suíte, **When** buscada por `: any` ou `as any`, **Then** nenhuma ocorrência é encontrada.
- [ ] **Given** os testes de validação local, **When** executados, **Then** cada um assevera que o espião de `fetch` **não** foi chamado (CT-02, CT-03, CT-04, CT-07, CT-19, CT-23).
- [ ] **Given** o cenário `409 SPECIES_IN_USE`, **When** a exclusão é confirmada, **Then** a mensagem aparece e a linha da espécie **continua** presente no DOM (CT-24 / CA-14).
- [ ] **Given** o cenário `404 SPECIES_NOT_FOUND` na renomeação, **When** salvo, **Then** a lista é recarregada — uma segunda chamada a `GET /api/species` é observada (CT-20).
- [ ] **Given** `ConfirmDialog` fechado, **When** consultado, **Then** o `role="dialog"` está **ausente** do DOM — verificado por ausência, não por estilo (CA-13).
- [ ] **Given** a suíte de autenticação existente, **When** executada após esta task, **Then** passa sem nenhuma alteração no corpo dos seus testes (regressão FEATURE-002 / CA-01b).
- [ ] **Given** o percurso completo por teclado, **When** executado, **Then** criar, editar, salvar, cancelar, excluir e confirmar são acionados sem nenhuma chamada de clique de mouse (CT-37 / CA-21).
- [ ] Nenhum arquivo de produção foi modificado por esta task.

---

## Dependencies

- **Requires**: TASK-FRONTEND-006 a TASK-FRONTEND-010 (toda a interface da feature implementada).
- **Blocks**: nenhuma task de implementação. É pré-requisito do Quality Gate do Sonar da feature.
