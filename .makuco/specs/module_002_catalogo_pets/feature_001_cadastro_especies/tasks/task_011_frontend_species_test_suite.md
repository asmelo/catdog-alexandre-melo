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

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES (uma linha)
**Arquivos revisados**: 9 arquivos de teste entregues + 12 arquivos de produção da feature (lidos por inteiro, não pelo diff)

#### Resumo

A suíte foi verificada por **teste de mutação executado do zero**, não pela tabela do agente: as 13 mutações que ele alega ter rodado foram refeitas (13/13 detectadas, confere) e outras **47 mutações minhas** foram acrescentadas (37 detectadas, 10 sobreviventes, das quais 3 são mutantes equivalentes). As três alegações fortes sobre `act()`, sobre a medição `mockResolvedValue` e sobre o contrato de fonte dos invisíveis foram **medidas de novo e confirmadas** — inclusive contra a hipótese do revisor humano, que está errada. O achado que bloqueia é único e vale uma linha: um teste que **passa pelo motivo errado**, exatamente o modo de falha que esta revisão existia para caçar.

#### Números conferidos por mim (medidos, não relatados)

| Medida | Valor | Como foi obtido |
|---|---|---|
| `npm run typecheck` | exit 0 | execução direta |
| Suíte | 19 suítes / 300 testes, verde | `npx jest` |
| Cobertura | **99.70 / 98.34 / 100 / 99.70** | `npx jest --coverage` |
| Avisos de `act()` — hoje | **0** | contagem no log completo |
| Avisos de `act()` — antes da task | **5** | suíte reconstruída no estado do HEAD (12 suítes / 160 testes) |
| `fireEvent` fora de comentário | **0** (6 ocorrências, todas em comentário: 3 novas + 3 pré-existentes) | `grep -rn` em `src/` e `tests/` |
| `: any` / `as any` | **0** | `grep -rn` |
| Asserções de classe de cor | **0** (as duas ocorrências de `bg-brand`/`text-brand` estão em comentário) | `grep -rn` |
| CT-xx cobertos | **32 de 32** declarados + CT-34 de bônus, nenhum ausente | mapeamento dos títulos contra a tabela da spec |
| Arquivos de produção alterados | **0** | `git status`; `jest.config.ts`, `tests/setup.ts` e `tests/auth-harness.tsx` intocados |

Correção ao enunciado da revisão: `validation.spec.ts` tinha **15** testes no HEAD, não 16 — passou de **15 → 31** (+16). `app-routes.spec.tsx` 29 → 38 confere.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | **major** | `services/frontend/src/utils/validation.spec.ts` | L411-426 (e L396-409) | teste que passa pelo motivo errado | O teste chamado *"o BOM é REMOVIDO e não convertido em espaço: a ordem entre os dois passos é o ponto"* **não detecta a inversão da ordem**. Medido: mutar `higienizarNomeDeEspecie` para `normalizeSpeciesName(bruto).replace(CARACTERES_INVISIVEIS, '')` deixa a suíte inteira **verde (300/300)**. Motivo: `'Ga﻿to'` sai como `'Gato'` (4) no correto e `'Ga to'` (5) no mutante — **os dois são nomes válidos**, e a única asserção é `toEqual({})`. O teste vizinho de 60 caracteres usa **U+200B** como separador, que `\s` não casa, e por isso também não distingue (60 nos dois casos). A garantia que os dois testes anunciam não existe. | Trocar o separador do teste de 60 caracteres de `U+200B` para **`U+FEFF`**: medido, o correto dá 60 e o mutante dá **119** → `NAME_TOO_LONG` mata o mutante. Alternativamente, assertar o valor higienizado (`'Gato'`, e não apenas `{}`). |
| 2 | minor | `services/frontend/src/components/ui/confirm-dialog.spec.tsx` | L120 | asserção cega | A asserção que dá nome ao teste do CA-13 — `expect(screen.queryByRole('dialog')).toBeNull()` — é **cega ao modo de falha que o CA-13 proíbe**. Medido com um mutante fiel (diálogo montado com `display:none` + `aria-hidden` em vez de desmontado): a **L120 passa**; quem mata o mutante é a L121 (`queryByText(TITULO)`). `*ByRole` filtra por padrão o que está fora da árvore de acessibilidade. O comportamento está protegido hoje, mas pela linha errada — uma "limpeza de asserções redundantes" derrubaria o CA-13 em silêncio. | `expect(container.querySelector('[role="dialog"]')).toBeNull()` ou `queryByRole('dialog', { hidden: true })`. |
| 3 | minor | `services/frontend/src/pages/admin/species-page.tsx` | L387 | mutante sobrevivente / branch descoberto | Remover a guarda `if (!haDialogoDeExclusao.current)` deixa a suíte verde (300/300). É o **único branch descoberto da produção da feature** — é ele que puxa a cobertura de branches para 98.34%. A guarda existe para impedir armadilha de teclado (tirar o foco de dentro do `aria-modal` faz o `Escape` deixar de fechar o diálogo — SC 2.1.2 / CA-21 / RNF-06), e o cenário gêmeo (diálogo aberto com `PATCH` em voo) **está** coberto. | Um teste com o diálogo de exclusão aberto e uma renomeação retida resolvendo `404`, afirmando que o foco permanece dentro do diálogo e que `Escape` continua fechando. |
| 4 | minor | `services/frontend/src/pages/admin/species/use-species-collection.ts` | L168 | mutante sobrevivente | Remover `escritasDesdeAPartida.current = []` da partida da listagem deixa a suíte verde. Escritas de um intervalo anterior passam a ser reaplicadas sobre retratos futuros do servidor — o próprio comentário de produção (L146-149) descreve o defeito. | Teste com duas listagens em sequência, onde a escrita local do primeiro intervalo não pode reaparecer sobre o segundo retrato. |
| 5 | minor | `services/frontend/src/pages/admin/species-page.tsx` | L283 | mutante sobrevivente | Remover `setErroDaLinha(null)` de `trocarEdicao` deixa a suíte verde. Defeito observável: o `409` que caiu sob o campo da linha A reaparece sob o campo da linha B quando o usuário troca de linha — acusando de conflito um nome que não foi enviado (o comentário de produção L281-283 descreve exatamente isso). | Teste de página: erro de conflito na linha A → acionar o lápis da linha B → o campo de B não pode exibir mensagem alguma. |
| 6 | minor | `services/frontend/src/pages/admin/species-page.tsx` | L79 | mutante sobrevivente | Trocar `fieldErrorsOf(erro).name ?? erro.message` por `erro.message` deixa a suíte verde. O `VALIDATION_ERROR` com `details[].field === 'name'` **na renomeação** não é exercitado — só o caso do `id` (CT-34). O fluxo de criação cobre o caminho análogo (`species-create-form.spec.tsx` L306). | Um `PATCH` respondendo `400 VALIDATION_ERROR` com `details: [{ field: 'name', ... }]`, afirmando que a mensagem do `details` vence a do envelope. |
| 7 | minor | `services/frontend/src/pages/admin/species-page.tsx` | L415, L488 | mutante sobrevivente | Remover `setResultado(null)` do início de `salvarRenomeacao` e de `confirmarExclusao` deixa a suíte verde nos dois casos. A mesma garantia **é** afirmada para a criação (`species-create-form.spec.tsx` L116-131, `aoResultar.mock.calls[0]?.[0]).toBeNull()`); o RNF-09 (reanúncio da região viva em duas operações iguais seguidas) depende dela nas três. | Estender a asserção existente aos dois outros fluxos — por exemplo, duas exclusões seguidas exigindo que o `StatusMessage` desmonte entre elas. |
| 8 | minor | `services/frontend/src/components/ui/confirm-dialog.spec.tsx` | L226-229 | comentário factualmente falso | O comentário afirma: *"Sem este `blur()` explícito ... o teste passaria mesmo com a falha presente"*. **Medido: é falso.** Removido o `blur()`, o teste continua passando com a produção correta **e continua falhando** sob a mutação `useEffect(..., [open])`. O agente admite isso no relatório, mas deixou a afirmação no código — onde ela vira premissa da próxima task. | Reescrever para o que é verdade: o `blur()` faz o teste modelar o navegador (que desfoca o elemento desabilitado) em vez de depender da inércia do jsdom; ele **não** é o que dá poder discriminante ao teste. |
| 9 | minor | `services/frontend/src/utils/validation.spec.ts` | L315-349 | acoplamento entre serviços | A suíte do **frontend** passou a depender do caminho `services/backend/src/domains/species/species.validators.ts`. Medido: com o arquivo ausente, dois testes falham com **`ENOENT` cru** — a mensagem explicativa do autor só cobre "constante não encontrada", não "arquivo não encontrado". Hoje nada quebra (não há CI de frontend nem `Dockerfile` de frontend; só existe `.github/workflows/backend-ci.yml`). O risco é latente: o dia em que houver pipeline ou imagem só-frontend (checkout esparso, `COPY services/frontend`), a suíte quebra por motivo que não é o dela. **Julgamento: o teste vale o que custa** — é a única coisa que impede a deriva silenciosa de uma regra deliberadamente duplicada, e a mutação prova que ele funciona nos dois sentidos —, mas o acoplamento precisa ser explícito. | Envolver a leitura e falhar com a mensagem de contrato quando o arquivo não existir; registrar o acoplamento em `.makuco/codebase/testing.md`. |
| 10 | minor | os 9 arquivos entregues | — | desvio de critério de aceite | **32** dos ~131 `it()` novos não começam por identificador de caso, contra o critério *"o título começa pelo identificador do caso de teste da spec"*. São justamente os testes de ramos residuais que **não têm CT correspondente** (ex.: `confirm-dialog.spec.tsx` L125, L318, L365; `species-api.spec.ts` L110, L174, L202, L248; `validation.spec.ts` L359, L372, L396, L411, L428). Inventar identificadores seria pior. | Não retro-ajustar: emendar o critério para "quando o teste mapeia um caso da spec". Registrado como desvio consciente. |
| 11 | suggestion | `services/frontend/src/components/ui/confirm-dialog.spec.tsx` | L176 | diretiva morta | `// eslint-disable-next-line no-await-in-loop` num projeto **sem ESLint**. | Remover, ou manter só se o ESLint entrar no projeto. |
| 12 | suggestion | `confirm-dialog.spec.tsx` L175; `species-create-form.spec.tsx` L218 | — | `makuco-testing-practices` §2/§8 | `for` e `if` dentro do corpo do teste ("no logic in tests"). Nos dois casos são justificados (o laço **é** o teste de tabulação; o `if` evita `userEvent.type` com string vazia). | Nenhuma ação; registro para não virar precedente. |
| 13 | suggestion | `services/frontend/src/pages/admin/species-page.spec.tsx` | 1233 linhas | tamanho | É o maior spec do repositório. Os `describe` de concorrência (L776-955) e de sequenciamento (L1043-1154) são autocontidos. | Considerar `species-page.concorrencia.spec.tsx` na primeira task que abrir o arquivo por motivo próprio. |
| 14 | suggestion | `.makuco/codebase/testing.md` | L13 | documentação | Continua no estado de rascunho (*"a definir durante implementação"*) depois de 13 tasks que impuseram convenção de título, marcadores AAA e proibição de `fireEvent`. É por isso que a convenção só existe dentro de cada arquivo de task. | Consolidar a convenção efetiva e o acoplamento do achado #9. |

#### Mutantes equivalentes (verificados; NÃO são achados)

Registrados para que ninguém volte a caçá-los:

- `species-page.tsx` L307 — `minhaGravacao < jaAplicada` → `<=`: **equivalente**. As sequências de escrita são estritamente crescentes e únicas por gravação; a igualdade nunca ocorre.
- `icon-button.tsx` L66 — `disabled={disabled === true}` → `disabled={disabled}`: **equivalente em execução** (o React descarta `undefined`). Observação lateral: o comentário de produção justifica a normalização por `exactOptionalPropertyTypes`, que **não está ligado no frontend** — a justificativa é de outro projeto. Fora do escopo desta task (TASK-FRONTEND-006).
- `confirm-dialog.tsx` L158 — remover `evento.stopPropagation()`: sobrevive, **sem efeito observável na aplicação atual** (não há ouvinte de `Escape` atrás do modal). Vira defeito real no dia em que houver.

#### Verificação das alegações fortes

**1. Diagnóstico dos avisos de `act()` — o AGENTE ESTÁ CERTO; a hipótese do revisor humano está errada.**
Reconstruí o estado pré-task (removi os 7 specs novos, `git checkout` nos 2 modificados): **12 suítes / 160 testes / exatamente 5 avisos**. Os cinco são idênticos e todos rastreiam para `src/routes/app-routes.spec.tsx:52` (`renderizar` → `renderizarComSessao`), disparados por `setStatus('erro')` em `use-species-collection.ts:203` — ou seja, a `SpeciesPage` montando em `/admin`, o `fetch` sendo barrado por `tests/setup.ts`, e a rejeição caindo numa microtarefa posterior ao corpo síncrono do teste. Rodando **o arquivo pré-task isolado**: 29 testes, **5 avisos**. Não há interação entre suítes.
A medição de "zero isolado" quase certamente foi feita sobre o arquivo **entregue**: rodei-o isolado e dá **38 testes / 0 avisos**. As duas medições estão corretas — são de arquivos diferentes.

**2. A correção sugerida piorava — CONFIRMADO, com o número exato.**
Sobre o arquivo pré-task de 29 testes, acrescentando `jest.mock` de `species-api` com `mockResolvedValue({ items: [] })`: **10 avisos** (era 5). Com `new Promise(() => undefined)` no mesmo arquivo: **0**. A explicação também confere — a promessa já resolvida agenda o `.then`, e as duas atualizações da resolução (`setSpecies` + `setStatus('pronto')`) escapam do `act` síncrono do `render`, contra uma só da rejeição. (Sobre o arquivo entregue, de 38 testes, a mesma substituição dá 18, consistente com o maior número de montagens.)

**3. Teste de contrato de fonte dos invisíveis — CONFIRMADO nos dois sentidos.**
Acrescentei `᠎` ao **backend** (`species.validators.ts` L40): **2 testes falham**, e o segundo imprime `+ "U+180E"` — nomeia o code point divergente, como alegado. Acrescentei `᠎` ao **frontend**: os mesmos 2 falham. O risco de acoplamento está no achado #9 — julgado aceitável, mas exige tratamento do `ENOENT` e registro em `.makuco/codebase/testing.md`.

**4. Item 4 da herança (o `blur()`) — a admissão é honesta e a medição confere; o comentário no código, não.** Ver achado #8. A postura no relatório é correta; o que sobrou errado foi a prosa dentro do teste.

**5. Nenhum teste existente foi enfraquecido — CONFIRMADO.**
`validation.spec.ts`: **zero linhas removidas**; os hunks são `+3` no topo (imports de `node:fs`/`node:path`), `+2` nomes no bloco de import existente e `+282` acrescentadas após a L151. Os 15 testes anteriores estão byte a byte iguais.
`app-routes.spec.tsx`: as **únicas 2 linhas removidas** são duas linhas de import substituídas por versões ampliadas. Nenhum corpo de `it` pré-existente foi tocado; o acréscimo é um `jest.mock`, uma const, uma linha no `beforeEach` e 211 linhas no fim. Observação sem gravidade: o `jest.mock('~/services/api/species-api')` muda o *ambiente* dos testes antigos (a tela deixa de cair em `ErrorState` e fica em carga) — a mudança é necessária para zerar os avisos e nenhuma asserção existente depende do desfecho da listagem.
Nota metodológica sobre o AAA: 32 testes de `app-routes.spec.tsx` não têm marcadores `// Arrange`/`// Act`/`// Assert`, mas **todos** estão nas linhas ≤377, isto é, são pré-existentes e a task proíbe alterá-los. Entre os testes novos, só quatro usam `// Act & Assert` combinado (`species-page.spec.tsx` L971, `species-api.spec.ts` L307 e L318, `validation.spec.ts` L272) — variante legítima.

**6. Nenhum arquivo de produção alterado — CONFIRMADO.** `git status` fecha em 2 modificados + 7 não rastreados, todos `*.spec.*`. `jest.config.ts`, `tests/setup.ts` e `tests/auth-harness.tsx` intocados; `MonitorDeLocalizacao` já era exportado no HEAD (`auth-harness.tsx:113`), então o novo uso não exigiu tocar o harness. Todas as 60 mutações que apliquei foram revertidas e os 9 arquivos entregues estão idênticos ao estado em que os encontrei.

#### Herança — cumprida integralmente

| Item | Situação | Evidência |
|---|---|---|
| `userEvent` em todo caso de tabulação | ✅ | 6 ocorrências de `fireEvent`, **todas em comentário** (3 novas, 3 pré-existentes em `password-field.spec.tsx`) |
| Concorrência com promessa retida (2 *major* da 010) | ✅ | `species-page.spec.tsx` L777 (409 abandonado) e L812 (sucesso tardio); mutações A04 e A05 detectadas |
| Concorrência nas duas gravações da mesma espécie | ✅ | L881; mutação A01 detectada |
| Foco nos ramos de 404 com a listagem também retida | ✅ | L620 (CT-20) e L749 (CT-27) usam `reter()`; A06 e A07 detectadas |
| Ordenação com par acentuado | ✅ | L438 (`Ágil`/`Zebra` entre `Cão`, `Cavalo`, `Gato`); A08 detectada |
| CT-21 e CT-23 | ✅ | `species-page.spec.tsx` L598 e L699; `species-row.spec.tsx` L298 |
| Zero asserção de classe de cor | ✅ | grep limpo |
| Não-desembrulho do `{ items }` | ✅ | `species-api.spec.ts` L110-127 |
| Erro do formulário de criação por `role="alert"` | ✅ | `species-page.spec.tsx` L478-502; mutação R04 detectada (7 testes caem) |
| Os cinco comportamentos da 007, com o `replace` | ✅ | A12 (`Navigate` sem `replace`), A13 (`/admin` sem `index`), R31 (`NavLink`→`<a>`), R34 (sem catch-all), R39 ("Animais"→especies) — **todas detectadas** |

#### Detalhes por passagem

**Pass 1 — Task Compliance**: 10 de 11 critérios plenamente implementados. Todos os 32 CT-xx declarados cobertos, cobertura ≥ 80% nos quatro eixos, zero `fireEvent`, zero `any`, ausência de requisição afirmada nos seis casos de validação local, CT-24 e CT-20 conforme cobrado, CA-13 por ausência, regressão da FEATURE-002 intacta, percurso por teclado completo, zero arquivos de produção alterados. Desvio parcial: critério do formato do título (achado #10).
**Pass 2 — Diff Analysis**: Nenhum achado. Os 9 caminhos da tabela *Files* batem exatamente; nada fora do escopo foi tocado; nenhuma formatação em massa; nenhum arquivo de `Scope — Out` modificado.
**Pass 3 — Code Practices**: Achados #12, #13. Helpers bem fatorados (`reter`, `instalarRede`, `emSequencia`, `chamadasDe`, `linhaEmEdicao`), guardas com `throw` explicativo fora do corpo dos testes, zero números mágicos, nomes descritivos. Nomenclatura PT-BR nos identificadores de teste segue a convenção já estabelecida em toda a suíte (`login-page.spec.tsx`, `http-client.spec.ts`) e os termos de domínio permanecem em inglês (`Species`, `listSpecies`) — sem desvio de linguagem ubíqua.
**Pass 4 — Testing Review**: Achados #1 a #8, #10 a #13. **Escore de mutação: 50 de 60 mutações detectadas** (13/13 do agente + 37/47 minhas); das 10 sobreviventes, 3 são equivalentes e 7 são lacunas reais. Cobertura de linha/branch acima do piso; caminhos críticos (exclusão bloqueada, guarda por role, sequenciamento de escrita) em 100%.
**Pass 5 — Security Review**: Nenhum achado de OWASP. A mudança é exclusivamente de teste: sem segredo embutido, sem entrada de usuário, sem caminho construído dinamicamente. O `readFileSync` de `validation.spec.ts` usa caminho estático derivado de `__dirname` (sem travessia) e o `new RegExp` construído a partir dele consome conteúdo do próprio repositório, versionado e revisado — não é fronteira de confiança. A regex reconstruída é uma classe de caracteres, sem retrocesso catastrófico. O acoplamento resultante é achado de arquitetura (#9), não de segurança.
**Pass 6 — Bug Detection**: Nenhum defeito na produção. As sete lacunas dos achados #3 a #7 são de **cobertura**, não de comportamento: em todos os casos o código de produção está correto e é a suíte que não o defende.
**Pass 7 — Project Patterns**: Achado #14. Specs co-locados em `src/`, nomeados `*.spec.ts(x)`, `sonar.test.inclusions` já os filtra do escopo de `sonar.sources` — tudo alinhado com `sonar-project.properties`.

#### Veredicto

> **REPROVADA por uma linha.** O bloqueio é o achado **#1**, em `services/frontend/src/utils/validation.spec.ts:401`: trocar o separador `U+200B` por **`U+FEFF`** no teste dos 60 caracteres. Com essa troca, a inversão de ordem em `higienizarNomeDeEspecie` passa a ser detectada (60 contra 119 caracteres medidos). Enquanto isso não acontecer, dois testes anunciam — pelo nome e pelo comentário — uma garantia que **não existe**, e é justamente esse o modo de falha que uma cobertura de 99,70% não revela.
>
> Recomendo tratar junto, na mesma passada, os achados **#2** (uma linha, `confirm-dialog.spec.tsx:120`) e **#8** (reescrever o comentário falso). Os demais são `minor`/`suggestion` e não bloqueiam.
>
> Fora esse ponto, a entrega é de qualidade alta e incomum: 37 das 47 mutações que eu mesmo inventei foram mortas, incluindo dez que o agente não tentou (exclusão otimista, `SPECIES_IN_USE` genérico, ordem dos degraus da região da lista, `remover` por `name`, `<h1>` sem `tabIndex`, precedência invertida do erro da linha, off-by-one nos dois limites de tamanho, `PATCH`→`PUT`, aspas retas na confirmação, "Animais" apontando para espécies).

#### A FEATURE-001 está pronta para fechar?

**Sim, assim que a linha do achado #1 for corrigida.** Não há pendência de implementação: os 32 casos de interface estão cobertos, a regressão da FEATURE-002 passa sem alteração de corpo, e nenhum arquivo de produção foi tocado por esta task.

**Pendências que atravessam para a feature de animais** — todas já existentes, nenhuma criada aqui:

1. **A da própria spec, e é a mais importante:** CT-24, CT-25, CT-26 e CT-32 estão verificados **apenas por duplo de teste**. A RN-08 (guarda de uso) só passa a valer de verdade quando o vínculo animal↔espécie existir como chave estrangeira restritiva. A feature de animais **não pode ser considerada concluída** sem reexecutar esses quatro casos contra dados reais (registrado no bloco *Regressão* do `spec_context.md`).
2. **`/admin/animais` hoje cai no catch-all 404, por decisão deliberada.** Isso está **fixado por teste** em `admin-layout.spec.tsx:74-75` (`href` igual a `/admin/animais`) e em `app-routes.spec.tsx:536`. Quando a rota ganhar página, esses dois testes mudam — é mudança esperada, não regressão.
3. **`ADMIN_DEFAULT_PATH` está fixado em `/admin/especies`** por `app-routes.spec.tsx:501-514`, que assere a constante **e** o literal. Se a feature de animais tornar `/admin/animais` o destino padrão de `/admin`, esse teste muda junto — o próprio comentário dele antecipa isso.
4. **Acoplamento frontend→backend** do achado #9: precisa estar em `.makuco/codebase/testing.md` antes de alguém desenhar um pipeline ou uma imagem só-frontend.
5. **`.makuco/codebase/testing.md` ainda é rascunho** (achado #14) — a convenção de teste do projeto continua existindo só dentro dos arquivos de task.
6. **Cobertura de branch em 98.34%** rastreia para o único branch descoberto da feature (achado #3). Fechá-lo leva a feature a 100% de branch na sua própria produção.


---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 9 arquivos de teste + 12 arquivos de produção da feature (relidos por inteiro)

#### Resumo

A rodada 1 reprovou por uma linha e listou seis lacunas de mutação. **Nada aqui foi aceito por relato.** As duas provas do bloqueio foram refeitas do zero, as seis mutações fechadas foram reaplicadas uma a uma, os três mutantes equivalentes foram reexaminados no código, e outras **dez mutações minhas** foram acrescentadas — cinco para atacar especificamente os seis testes novos por um ângulo diferente do que o agente usou, e cinco para procurar sobreviventes fora deles. **21 mutações nesta rodada: 18 mortas, 3 sobreviventes — exatamente os três equivalentes, e a equivalência dos três foi confirmada por leitura do código, não por observação de que sobreviveram.** O bloqueio está resolvido; nenhum achado novo de severidade `major` ou `critical`.

#### Números conferidos por mim (medidos, não relatados)

| Medida | Valor | Como foi obtido |
|---|---|---|
| `npm run typecheck` | exit 0 | execução direta |
| Suíte do frontend | **19 suítes / 306 testes**, verde | `npx jest` |
| Suíte do backend (fechamento da feature) | **20 suítes / 270 testes**, verde | `npx jest` em `services/backend` |
| Cobertura do frontend | **99.70 / 98.62 / 100 / 99.70** | `npx jest --coverage` |
| Branches da produção da feature | **100%** em `species-page.tsx`, `use-species-collection.ts`, `species-api.ts`, `validation.ts`, `icon-button.tsx` | tabela de cobertura |
| Avisos de `act()` | **0** | contagem no log completo |
| `fireEvent` fora de comentário | **0** (6 ocorrências, todas em prosa de comentário) | `grep -rn` em `src/` e `tests/` |
| `: any` / `as any` | **0** | `grep -rn` |
| `validation.spec.ts` | **+295 / −0** | `git diff --numstat` |
| `app-routes.spec.tsx` | **+244 / −2** — as duas removidas são as **mesmas** duas linhas de `import` substituídas por versões ampliadas | `git diff -U0` |
| Arquivos de produção alterados | **0** | `git diff --name-only HEAD` filtrando `*.spec.*` |

Branch global subiu **98.34 → 98.62**. A subida rastreia inteiramente para `species-page.tsx`, que foi de 98.x para **100%** — e o branch que fechou é o `if (!haDialogoDeExclusao.current)` do achado #3 da rodada 1, fechado pelo teste **novo** da L994 (provado pela mutação M3 abaixo). Não há asserção afrouxada em lugar nenhum: as onze mutações da rodada 1 que reapliquei por amostragem continuam matando os mesmos testes.

#### 1. As duas provas do bloqueio — REFEITAS, as duas confirmadas

**Major #1 — `higienizarNomeDeEspecie` com a ordem invertida.**
Apliquei `normalizeSpeciesName(bruto).replace(CARACTERES_INVISIVEIS, '')` em `validation.ts:198` e rodei a suíte inteira: **1 falha em 306**, e é o teste dos sessenta caracteres (`validation.spec.ts:399`). O separador é `U+FEFF` (linha 409), o `\s` o converte em espaço antes que o `replace` possa removê-lo, o nome sai com 119 caracteres e cai em `NAME_TOO_LONG`. **O major está resolvido: a garantia que os dois testes anunciam agora existe.** O comentário das L402-407 explica por que o code point *é* o teste, e a explicação confere com a medição.

**#2 — mutante fiel do `ConfirmDialog`.**
Montei o mutante que a rodada 1 pediu: removi o `return null` e mantive o diálogo no DOM com `aria-hidden={!open}` e `style={{ display: 'none' }}`. Resultado: **1 falha em 15** no arquivo, e ela é na **L126 — `expect(dialogo).toBeNull()`, a asserção que dá nome ao teste**, com o `role="dialog"` inteiro impresso no diff. A L127 (`queryByText`) nem chega a ser avaliada. Antes, quem matava era a linha vizinha; agora é a linha certa, sozinha. Resolvido.

**#8 — o comentário do `blur()`.** Reescrito (`confirm-dialog.spec.tsx:230-238`) e agora factualmente correto: diz que o `blur()` **modela o navegador** e explicita que a mutação `useEffect(..., [open])` é detectada com ou sem ele. Resolvido.

#### 2. As seis mutações fechadas — refeitas, uma a uma

Cada uma foi aplicada isolada, com a suíte inteira rodando depois e reversão em seguida. **Em todas as seis, a falha é única, é no teste que o agente aponta, e é na asserção que dá nome ao teste.**

| Mutação | Alvo na produção | Testes que caem | Linha da asserção |
|---|---|---|---|
| M3 | remover a guarda `if (!haDialogoDeExclusao.current)` (`species-page.tsx:387`) | 1 — `CA-21: com o dialogo de exclusao ABERTO, o 404 de uma renomeacao nao rouba o foco do modal` | `species-page.spec.tsx:1032` |
| M4 | remover `escritasDesdeAPartida.current = []` da partida (`use-species-collection.ts:168`) | 1 — `CT-01: a escrita local de um intervalo ANTERIOR nao reaparece sobre a listagem seguinte` | `:1348` |
| M5 | remover `setErroDaLinha(null)` de `trocarEdicao` (`:283`) | 1 — `CT-18: o erro de conflito da linha A NAO acompanha o usuario para a linha B` | `:609` |
| M6 | `fieldErrorsOf(erro).name ?? erro.message` → `erro.message` (`:79`) | 1 — `CT-18: na renomeacao, o VALIDATION_ERROR do CAMPO vence a mensagem do envelope` | `:1416` |
| M7a | remover `setResultado(null)` de `salvarRenomeacao` (`:415`) | 1 — `RNF-09: a renomeacao seguinte DESMONTA o aviso da anterior antes de partir` | `:713` |
| M7b | remover `setResultado(null)` de `confirmarExclusao` (`:488`) | 1 — `RNF-09: a exclusao seguinte DESMONTA o aviso da anterior antes de partir` | `:878` |

#### 3. Os três mutantes equivalentes — confirmados, e por leitura do código

Sobreviver não prova equivalência. Os três foram reaplicados (sobrevivem: 306/306 nos três) **e** justificados no código:

- **`minhaGravacao < jaAplicada` → `<=`** (`species-page.tsx:307`). **Equivalente.** Há **um único** ponto de incremento (`:412-413`) e **uma única** chamada de `registrarRetratoSeForOMaisNovo` (`:447`) em todo o arquivo — verificado por `grep`. `minhaGravacao` é portanto estritamente crescente e irrepetível, e `jaAplicada` só assume `0` ou um valor **anterior** de `minhaGravacao`. A igualdade é inalcançável, e `minhaGravacao ≥ 1 > 0` cobre o caso do mapa vazio.
- **`disabled={disabled === true}` → `disabled={disabled}`** (`icon-button.tsx:66`). **Equivalente.** A prop é declarada `readonly disabled?: boolean` (`:16`), então o domínio é `boolean | undefined`, e o React omite o atributo tanto para `undefined` quanto para `false`. (A observação lateral da rodada 1 continua valendo: a justificativa do comentário invoca `exactOptionalPropertyTypes`, que não está ligado no frontend. Fora de escopo — TASK-FRONTEND-006.)
- **remover `evento.stopPropagation()` do `Escape`** (`confirm-dialog.tsx:158`). **Equivalente hoje.** Confirmado pela árvore, não pela suíte: `DeleteSpeciesDialog` é renderizado como **irmão** de `regiaoDaLista()` (`species-page.tsx:642`), fora de qualquer `SpeciesRow`. O `onKeyDown` da linha (`species-row.tsx:181`) não é ancestral do diálogo na árvore React, então não existe a quem propagar. Vira defeito real no dia em que um ouvinte de `Escape` viver acima do diálogo.

#### 4. Caça a teste que passa pelo motivo errado — dez mutações minhas, nenhuma sobrevivente

Ataquei os seis testes novos por ângulos que o agente **não** usou, para separar "mata a mutação que o autor escolheu" de "defende o comportamento":

| Mutação minha | O que faz | Resultado |
|---|---|---|
| X1 | guarda **invertida** (`if (haDialogoDeExclusao.current)`) em vez de removida | morta — CA-21 **e** CT-20 |
| X6 | `haDialogoDeExclusao.current = false` sempre (encanamento quebrado, e não a guarda) | morta — CA-21 |
| X2 | precedência **invertida**: `erro.message ?? fieldErrorsOf(erro).name` | morta — CT-18 do `details` |
| X3 | limpeza sutil: `setErroDaLinha(null)` só quando `especieId === null` (limpa ao sair, não ao trocar) | morta — CT-18 linha A→B |
| X4 | zeragem sob condição falsa, mantendo a da chegada | morta — CT-01 do intervalo anterior |
| Z1 | remover o ramo `SPECIES_NAME_ALREADY_EXISTS` | morta — 3 testes |
| Z2 | remover o registro do retrato mais novo | morta — CT-16 de concorrência |
| Z4 | remover `escolherParaExcluir(null)` do sucesso da exclusão | morta — CT-22 e CT-37 |
| Z5 | remover a guarda de listagem obsoleta do `.catch` | morta — CT-36 |
| Z8 | `devolverFocoAoTitulo` como no-op | morta — 4 testes |

**A dúvida específica do enunciado — os testes de RNF-09 realmente exigem a segunda operação retida em voo?** Sim, e é verificável nos dois sentidos. A asserção que mata M7a/M7b (`:713` e `:878`) é avaliada **antes** do `await segundaGravacao.concluir(...)` / `await segundaExclusao.concluir(...)`, isto é, dentro da janela entre a partida e o desfecho. As duas operações produzem **o mesmo texto** (`UPDATE_SUCCESS`, `DELETE_SUCCESS`), então uma versão com as duas concluídas em sequência ficaria verde com a falha presente — e o comentário do próprio teste (`:869-871`) diz exatamente isso. A retenção não é decoração: é o que torna a limpeza observável.

Registro também que o teste da M5 se defende explicitamente do modo de falha vizinho: a L598 exige que o conflito tenha **pousado** antes da troca de linha, "sem isso o teste ficaria verde por nunca ter havido erro nenhum para carregar adiante".

Além disso, reapliquei duas mutações clássicas da rodada 1 como controle de regressão: `PATCH`→`PUT` em `species-api.ts` (**17 testes caem**) e `localeCompare` → comparação binária (**CT-13 cai**). Nenhuma asserção foi enfraquecida entre as rodadas.

#### 5. Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | minor | `services/frontend/src/utils/validation.spec.ts` | L419-437 | título que promete mais do que o teste entrega | O teste *"o BOM e REMOVIDO e nao convertido em espaco: **a ordem entre os dois passos e o ponto**"* **continua cego à inversão da ordem**. Medido: sob o mutante invertido, a suíte inteira acusa **uma** falha, e é a do teste vizinho — este passa. Sob a inversão, `'Ga﻿to'` sai como `'Ga to'` (5 caracteres, válido) e `toEqual({})` continua verdadeiro; a asserção acrescentada nesta rodada (`normalizeSpeciesName(comBom)` → `'Ga to'`) mede a função **não mutada** e por isso também não distingue. A garantia agora existe na suíte — o teste dos 60 caracteres a entrega —, mas o título deste segue anunciando poder que ele não tem, e é assim que uma premissa falsa atravessa para a próxima task (mesma classe do achado #8 da rodada 1). | Renomear para o que ele de fato afirma (que o BOM não invalida o nome e que o texto enviado não é normalizado pelo cliente), **ou** acrescentar a asserção discriminante — p. ex. afirmar o comprimento medido, não só o mapa vazio. Não bloqueia: o comportamento está protegido pelo vizinho. |
| 2 | minor | `services/frontend/src/utils/validation.spec.ts` | L331-348 | acoplamento frontend→backend *(herdado, #9 da rodada 1 — parcialmente aberto)* | O `readFileSync` de `species.validators.ts` continua **sem tratamento de `ENOENT`**: a mensagem de contrato só cobre "constante não encontrada". Com o arquivo do backend ausente (checkout esparso, imagem só-frontend, `COPY services/frontend`), dois testes quebram com erro cru de sistema de arquivos, por motivo que não é o deles. O agente deixou explicitamente em aberto por estar fora do que foi autorizado — o registro está correto, a pendência continua. | Envolver a leitura e falhar com a mensagem de contrato; registrar o acoplamento em `.makuco/codebase/testing.md`. **Deve ser resolvido antes de existir qualquer pipeline ou imagem só-frontend** — não antes de fechar esta feature. |
| 3 | suggestion | `services/frontend/src/utils/validation.spec.ts` | L415 | asserção frouxa | `expect(comInvisiveis.length).toBeGreaterThan(60)` é uma guarda de sanidade sobre um valor conhecido e exato (119). Não é o que mata o mutante — quem mata é o `toEqual({})` da L416 —, mas afirmar o número exato deixaria o comentário das L402-407 verificado pelo próprio teste. | `expect(comInvisiveis.length).toBe(119)`. |
| 4 | suggestion | `services/frontend/src/components/ui/confirm-dialog.spec.tsx` | L182 | diretiva morta *(herdado, #11)* | `// eslint-disable-next-line no-await-in-loop` num projeto sem ESLint. Ganhou uma justificativa (`-- a ordem das tabulacoes E o teste`), o que melhora a leitura, mas a diretiva segue sem efeito. | Remover, ou manter só se o ESLint entrar no projeto. |
| 5 | suggestion | `.makuco/codebase/testing.md` | L3, L11-15 | documentação *(herdado, #14)* | Continua em rascunho — *"pré-implementação"*, *"a definir durante implementação"* — depois de 11 tasks que impuseram convenção de título, marcadores AAA, specs co-locados, proibição de `fireEvent` e de `any`. A convenção efetiva do projeto só existe dentro dos arquivos de task. | Consolidar antes da primeira task de teste da feature de animais, junto com o achado #2. |

Os achados #3, #4, #5, #6, #7, #10, #12 e #13 da rodada 1 estão **fechados ou registrados como desvio consciente** e não se repetem aqui.

#### 6. Detalhes por passagem

**Pass 1 — Task Compliance**: **11 de 11 critérios de aceite atendidos.** A suíte passa com cobertura ≥ 80% nos quatro eixos; zero `fireEvent`, zero `any`; ausência de requisição afirmada nos seis casos de validação local; CT-24 e CT-20 conforme cobrado; **CA-13 agora verificado por ausência de nó, e não por consulta cega ao papel**; regressão da FEATURE-002 intacta; percurso completo por teclado; nenhum arquivo de produção tocado. O desvio parcial do formato de título (achado #10 da rodada 1) permanece registrado como consciente, conforme a própria recomendação de não retro-ajustar — e os **seis testes novos todos começam por identificador** (`CA-21`, `CT-01`, `CT-18`, `CT-18`, `RNF-09`, `RNF-09`).
**Pass 2 — Diff Analysis**: Nenhum achado. Os 9 caminhos da tabela *Files* batem; nada fora do escopo foi tocado; `validation.spec.ts` continua **+295/−0** e `app-routes.spec.tsx` **+244/−2**, com as duas remoções sendo as mesmas duas linhas de `import` substituídas. Nenhum corpo de `it` pré-existente foi alterado — o último hunk é puramente aditivo, a partir da L354 do arquivo original.
**Pass 3 — Code Practices**: Nenhum achado novo. Os seis testes novos reaproveitam os helpers já estabelecidos (`reter`, `instalarRede`, `emSequencia`, `linhaEmEdicao`, `nomesNaLista`), mantêm AAA marcado e não introduzem lógica no corpo. `species-page.spec.tsx` passou de 1233 para **1467 linhas** — a sugestão #13 da rodada 1 (extrair os `describe` de concorrência e de sequenciamento) fica ainda mais razoável, mas segue sem urgência e sem motivo próprio para abrir o arquivo.
**Pass 4 — Testing Review**: Achados #1, #2, #3, #4. **Escore de mutação desta rodada: 18 de 21** — as 3 sobreviventes são os equivalentes confirmados por leitura do código. Somando com a rodada 1: **68 de 81 mutações detectadas, 3 equivalentes, 0 lacunas reais em aberto**.
**Pass 5 — Security Review**: Nenhum achado de OWASP. A mudança desta rodada é de teste e de comentário. O `readFileSync` continua com caminho estático derivado de `__dirname`, sem travessia, e o `new RegExp` reconstruído consome conteúdo versionado do próprio repositório — não é fronteira de confiança. O acoplamento resultante é achado de arquitetura (#2), não de segurança.
**Pass 6 — Bug Detection**: Nenhum defeito na produção. As 21 mutações desta rodada não revelaram comportamento incorreto: em todos os casos o código está certo e a suíte o defende. As sete lacunas de cobertura da rodada 1 estão fechadas.
**Pass 7 — Project Patterns**: Achado #5. Specs co-locados, nomeados `*.spec.ts(x)`, `sonar.test.inclusions` filtrando-os de `sonar.sources` — tudo alinhado. Linguagem ubíqua preservada: identificadores de teste em PT-BR, termos de domínio em inglês (`Species`, `listSpecies`, `renameSpecies`).

#### 7. Estado do repositório ao final desta revisão

**Todas as 21 mutações foram revertidas.** `git diff --name-only HEAD` filtrando `*.spec.*` devolve **vazio**: nenhum arquivo de produção foi alterado. `git status` fecha em 2 modificados + 7 não rastreados, todos `*.spec.*`, mais este arquivo de task. Última execução após a reversão: **19 suítes / 306 testes verdes, 0 avisos de `act()`**.

#### Veredicto

> **APROVADA.** O bloqueio da rodada 1 está resolvido e a correção foi **medida, não aceita**: a inversão de ordem em `higienizarNomeDeEspecie` agora derruba exatamente um teste, e a asserção que dá nome ao teste do CA-13 agora falha sozinha sob o mutante fiel. As seis lacunas de mutação foram fechadas por seis testes novos, cada um matando a sua mutação pela asserção certa e resistindo a mais cinco ataques por ângulos diferentes. Os três mutantes equivalentes são equivalentes de fato, confirmados no código. Nenhum achado `critical` ou `major`. Os cinco achados remanescentes são `minor`/`suggestion`, quatro deles herdados e conscientemente deixados em aberto.

#### A FEATURE-001 está pronta para fechar?

**Sim. Está pronta para fechar agora.**

As 11 tasks estão aprovadas. As duas suítes estão verdes — **backend 20/270, frontend 19/306, 39 suítes e 576 testes no total**. A produção da feature está em **100% de cobertura de branch** nos seus próprios arquivos; o que sobra descoberto no frontend é `env.ts` (restrição estrutural pré-existente), `http-client.ts:338` e `confirm-dialog.tsx:117` (pré-existente, TASK-FRONTEND-006). Nenhum arquivo de produção foi tocado por esta task. Nenhum dos cinco achados desta rodada bloqueia: os achados **#2** e **#5** são dívida de **documentação e de infraestrutura futura**, não de comportamento — o acoplamento existe, funciona, está medido nos dois sentidos e agora está registrado em dois pareceres; ele só passa a doer quando alguém desenhar um pipeline ou uma imagem só-frontend, e é aí que precisa estar resolvido, não antes.

**O que atravessa para a feature de animais:**

1. **A dívida principal, e ela continua exatamente como estava: CT-24, CT-25, CT-26 e CT-32 estão verificados APENAS POR DUBLÊ DE TESTE.** A contagem de animais vinculados é hoje uma dependência declarada do caso de uso de exclusão cuja implementação real responde zero; são os dublês que respondem valor diferente de zero. A RN-08 só passa a valer de verdade quando o vínculo animal↔espécie existir como **chave estrangeira restritiva** no Postgres (RN-09 exige as duas camadas: a verificação da aplicação, que produz a mensagem, e a restrição do banco, que impede o animal órfão quando o código falha). Está escrito em `spec_context.md` L480-487 e repetido na seção de regressão dos critérios de aceite (L656). **A task de exclusão/integridade da feature de animais — a TASK-010 daquela feature — tem de reexecutar os quatro casos contra a tabela real e a constraint real, e a feature de animais não pode ser considerada concluída sem isso.** Nenhum teste desta task substitui essa verificação, e nenhum dos 576 testes verdes hoje diz nada sobre integridade referencial real.
2. **`/admin/animais` cai no catch-all 404 por decisão deliberada**, e isso está **fixado por teste** em `admin-layout.spec.tsx:74-75` e `app-routes.spec.tsx:536`. Quando a rota ganhar página, esses dois testes mudam — mudança esperada, não regressão.
3. **`ADMIN_DEFAULT_PATH` está fixado em `/admin/especies`** por `app-routes.spec.tsx:501-514`, que assere a constante **e** o literal. Se `/admin/animais` virar o destino padrão de `/admin`, esse teste muda junto.
4. **Acoplamento frontend→backend do teste de contrato de fonte** (achado #2): tratar o `ENOENT` e registrar em `.makuco/codebase/testing.md` **antes** de existir pipeline ou imagem só-frontend.
5. **`.makuco/codebase/testing.md` ainda é rascunho** (achado #5): consolidar a convenção efetiva antes da primeira task de teste da feature de animais, para que ela não continue existindo só dentro dos arquivos de task.
6. **`species-page.spec.tsx` está com 1467 linhas.** Extrair os `describe` de concorrência e de sequenciamento na primeira task que abrir o arquivo por motivo próprio.
7. **`exactOptionalPropertyTypes` desligado no frontend** enquanto `icon-button.tsx:63-66` justifica a normalização por ele. Divergência entre comentário e configuração, sem efeito em execução — TASK-FRONTEND-006.
