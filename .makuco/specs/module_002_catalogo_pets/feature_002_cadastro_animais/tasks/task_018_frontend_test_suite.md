# TASK-FRONTEND-018 — Suíte de testes do frontend da feature

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-018-frontend-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 18 of 18 — Testes do Frontend
**Generated**: `2026-08-25`

---

## Context

Fecha o critério de qualidade no cliente: 80% de cobertura nos arquivos da feature e rastreabilidade direta entre os CT da spec e os testes. A infraestrutura — Jest com jsdom e babel-jest, `tests/setup.ts` bloqueando `fetch`, harness `renderizarComSessao` — já existe desde a FEATURE-002 do MODULE-001 e é reusada, não refundada.

---

## Scope

**In:** Specs das primitivas novas, do campo de imagens, das funções puras de validação e de preparo de imagens, da listagem e do formulário, mais os casos de guarda de rota por role.

**Out:** Nenhum teste de backend (TASK-BACKEND-011). Nenhum E2E — fora do escopo do projeto. Nenhum teste que faça requisição real: `fetch` continua bloqueado por `tests/setup.ts` e as funções de API são substituídas por duplos. Não alterar arquivo de `src/` para facilitar teste; se algo não for testável, reportar.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/select-field.spec.tsx` | primitivas de formulário |
| `create` | `src/components/ui/toggle-field.spec.tsx` | alternância acessível |
| `create` | `src/components/ui/image-upload-field.spec.tsx` | preparo de imagens |
| `create` | `src/domains/animals/animal-images.spec.ts` | limite estado final |
| `create` | `src/pages/admin/animais/animais-list-page.spec.tsx` | listagem completa |
| `create` | `src/pages/admin/animais/animal-form-page.spec.tsx` | formulário completo |
| `modify` | `src/utils/validation.spec.ts` | validação do animal |
| `modify` | `src/routes/app-routes.spec.tsx` | guardas das novas rotas |

---

## Implementation

> **Reference pattern**: `src/pages/auth/login-page.spec.tsx` e `src/routes/role-route.spec.tsx` definem o formato — `renderizarComSessao`, **sempre `userEvent`** e nunca `fireEvent`, asserção sobre o texto em PT-BR literal quando ele é o contrato, e `it('<CT-NN>: <asserção>')` para rastreabilidade.

### `src/domains/animals/animal-images.spec.ts` *(create)*
- As funções puras primeiro, porque são onde a aritmética do limite mora: CT-48 (3 gravadas + 3 novas recusado), CT-49a (5, remover 2, +3 recusado), CT-49b (5, remover 3, +3 aceito), CT-46 (exatamente 5 aceito), CT-47 (6 recusado).
- Testar a aritmética aqui, e não só pela tela, é o que impede que uma correção futura no componente reintroduza o erro que a própria spec já teve de corrigir na iteração de qualidade.

### `src/components/ui/image-upload-field.spec.tsx` *(create)*
- Rótulo e textos literais (CA-19); escolha de dois arquivos produzindo duas miniaturas com "x" (CT-45); remoção de item gravado **sem** requisição (CT-59); capa acompanhando a remoção do primeiro item (CT-60); nome acessível do "x" identificando a imagem (CT-95); operação completa por teclado (CT-94).
- Verificar a revogação das URLs de pré-visualização espionando `URL.revokeObjectURL` — em jsdom ele precisa ser substituído por duplo, porque não é implementado.

### `src/pages/admin/animais/animais-list-page.spec.tsx` *(create)*
- Sete colunas e dados da captura (CT-23); localização "Boa Esperança - ES" (CA-04); miniatura de capa e marcador neutro (CT-31, CT-32); indicador de pendência de foto (CT-33); contagem com 0, 1 e 2 (CT-24); paginação ausente com um animal e presente com muitos (CT-27); estados de carregando, vazio e falha (CT-29, CT-30); alteração de status com sucesso, com falha revertendo o campo, com `ANIMAL_NOT_FOUND` recarregando e com o mesmo status **não** disparando requisição (CT-69, CT-71, CT-73, CT-74); exclusão confirmada e cancelada (CT-76, CT-77).
- O caso do status já vigente é verificado pela **ausência de chamada** ao duplo da API — asserção sobre o duplo, não sobre a tela.

### `src/pages/admin/animais/animal-form-page.spec.tsx` *(create)*
- Formulário vazio sem campo de status (CT-68); todos os obrigatórios sinalizados de uma vez sem requisição (CT-09); cidade desabilitada, carregando e povoada (CT-34, CT-35, CT-36); troca de estado descartando a cidade (CT-37); **resposta fora de ordem descartada** (CT-38) — resolver a promessa de "PR" depois da de "ES" e afirmar que a lista exibida é a de "ES"; falha de cidades como falha, nunca campo vazio (CT-39); cidade pré-selecionada na edição e cidade ausente da lista ativa preservada (CT-40, CT-41); duplo clique em "Salvar" produzindo uma única requisição (CT-93); `409 ANIMAL_STALE_UPDATE` preservando o formulário (CT-66); corpo montado sem campo de estado e sem `status` (CA-17).
- Para o CT-38, controlar a resolução das promessas manualmente — `setTimeout` no teste torna o caso lento e intermitente, que é o pior defeito que uma suíte pode ter.
- Inspecionar o `FormData` enviado ao duplo da API para afirmar `keepImageIds` na ordem correta (CT-61).

### `src/routes/app-routes.spec.tsx` *(modify)*
- Acrescentar, sem alterar os casos existentes: `cliente` acessando `/admin/animais` é redirecionado para a sua área e o conteúdo administrativo **não está no DOM** — verificar por ausência, não por estilo ou visibilidade (CT-87, CA-41); sem sessão, redireciona para o login (CT-88).

### `src/utils/validation.spec.ts` *(modify)*
- `validateAnimalForm` com nome de 1, 2, 60 e 61 caracteres; descrição de 1000 e 1001; data futura e de 31 anos atrás; obrigatórios ausentes (CT-03 a CT-06, CT-15, CT-17, CT-21).

---

## Acceptance Criteria

- [ ] **Given** `npm test`, **When** executado, **Then** todas as suítes passam e a cobertura fica em 80% ou mais nos arquivos criados ou alterados por esta feature.
- [ ] **Given** a suíte completa, **When** executada, **Then** nenhum teste faz requisição real — o bloqueio de `fetch` de `tests/setup.ts` permanece ativo e nenhum teste o desliga.
- [ ] **Given** cada CT de frontend da spec (CT-03 a CT-06, CT-09, CT-15, CT-17, CT-21 a CT-24, CT-27, CT-29 a CT-41, CT-45 a CT-49b, CT-59 a CT-61, CT-66, CT-68, CT-69, CT-71, CT-73, CT-74, CT-76, CT-77, CT-87, CT-88, CT-93 a CT-95), **When** o nome dos testes é buscado, **Then** existe ao menos um `it` que o cita.
- [ ] **Given** o caso do CT-38, **When** executado dez vezes seguidas, **Then** passa nas dez — a ordem das promessas é controlada pelo teste, não pelo relógio.
- [ ] **Given** a suíte de autenticação do frontend, **When** executada após toda a feature, **Then** continua verde — em especial os testes do cliente HTTP e da fila de renovação.
- [ ] **Given** todos os testes de interação, **When** o código é inspecionado, **Then** usam `userEvent` e não `fireEvent`.
- [ ] **Given** o relatório de cobertura, **When** o Sonar o consome, **Then** o Quality Gate passa sem bloqueadores e sem issue de segurança Blocker ou Critical.

---

## Dependencies

- **Requires**: TASK-FRONTEND-012 a TASK-FRONTEND-017 (tudo o que é testado).
- **Blocks**: nenhuma task. Fecha o critério de qualidade do frontend.

---

## Revisão — 2026-08-28

**Status**: APROVADO

| Critério de aceite | Resultado |
|---|---|
| `npm test` verde e 80% nos arquivos da feature | **503 testes, 33 suítes, 0 falha.** Cobertura global 98,58% stmts / 95,17% branches / 99,09% funcs / 98,56% lines. **Nenhum** arquivo desta feature abaixo de 80% em nenhuma das quatro métricas |
| Nenhuma requisição real; a guarda de `fetch` permanece ativa | **Confirmado por varredura:** nenhum teste redefine `globalThis.fetch` fora de `jest.spyOn`, e nenhum desliga a guarda de `tests/setup.ts` |
| Todo CT de frontend citado por ao menos um `it` | **Confirmado.** Os 47 CT da lista do AC têm ocorrência; nenhum faltando |
| CT-38 estável em dez execuções | **10/10.** A ordem das promessas é controlada por resolvedores manuais guardados num `Map` — nenhum `setTimeout` participa |
| Suíte de autenticação verde depois da feature | **Confirmado**, cliente HTTP e fila de renovação inclusos. Também verde sob `--runInBand --randomize` |
| `userEvent`, nunca `fireEvent` | **Confirmado.** As quatro ocorrências de "fireEvent" em `src/` são **comentários** de specs anteriores explicando por que ele não é usado; nenhuma é chamada |
| Backend continua verde | **579 testes, 0 falha** |

### O que esta task entregou, e o que já vinha pronto

Seis dos oito arquivos da tabela foram escritos nas tasks que os exigiam, porque os critérios de aceite delas eram comportamentais e não havia como aprová-las sem eles — cada review registra isso:

| Arquivo | Onde foi escrito |
|---|---|
| `animal-images.spec.ts` | TASK-FRONTEND-015 |
| `image-upload-field.spec.tsx` | TASK-FRONTEND-015 |
| `animais-list-page.spec.tsx` | TASK-FRONTEND-016 |
| `app-routes.spec.tsx` (guardas das novas rotas) | TASK-FRONTEND-016 |
| `animal-form-page.spec.tsx` | TASK-FRONTEND-017 |
| `select-field.spec.tsx` | **esta task** |
| `toggle-field.spec.tsx` | **esta task** |
| `validation.spec.ts` (`validateAnimalForm`) | **esta task** |

Além dos previstos, esta task acrescentou três arquivos para fechar buracos de cobertura que a varredura encontrou: `use-state-cities.spec.ts`, `text-input-field.spec.tsx` e casos novos em `animais-list-page.spec.tsx`.

### Um defeito real encontrado pela varredura de cobertura

`useStateCities` calculava `statesError` e **o formulário nunca o lia**. Consequência: uma falha ao carregar os estados deixava o campo Estado silenciosamente vazio — exatamente o defeito que a RN-58 proíbe para as cidades ("nunca se apresenta como campo de seleção vazio, que se leria como *este estado não tem cidades*"), só que para os estados, onde a leitura seria a absurda "não há estados". O administrador ficaria sem entender por que não consegue escolher a cidade.

Corrigido: o hook ganhou `retryStates`, o formulário passou a exibir o mesmo aviso com nova tentativa que já usava para as cidades, e o bloco virou o componente `FalhaDeCarga`, compartilhado pelos dois casos — que têm contrato idêntico. Coberto por `use-state-cities.spec.ts`.

Vale o registro de método: o buraco não apareceu por leitura do código nem por teste falhando. Apareceu porque um ramo ficou descoberto, e perguntar "por que ninguém exercita este ramo?" levou a "porque ninguém o consome".

### Outras bordas que a varredura fez emergir

- **Resposta obsoleta que FALHA** (o espelho do CT-38 no caminho de erro): sem a guarda no `catch`, o campo passaria de povoado a "não foi possível carregar" sem que nada tivesse falhado para a UF corrente.
- **Reescolher a mesma UF**: sem a guarda, apagaria a cidade já escolhida.
- **`location.state` hostil**: cinco formas diferentes (ausente, texto solto, objeto sem a chave, mensagem numérica, mensagem vazia) são ignoradas. O estado da navegação é controlado pelo histórico do navegador, e um `as { message: string }` faria a tela renderizar o que viesse.
- **Falha de exclusão que não é `ApiError`**: mensagem genérica, e o animal continua na lista.
- **"Anterior" da paginação**: desabilitado na primeira página, funcional a partir da segunda.

### Fora do escopo, registrado

`src/config/env.ts` fica em 0% de cobertura. Ele é do MODULE-001, **não** foi tocado por esta feature, e está a zero porque `tests/env-mock.ts` substitui o módulo inteiro em toda a suíte — é o mecanismo que permite os testes rodarem sem variáveis de ambiente. Cobri-lo exigiria um teste que carregasse o módulo real, o que é assunto de uma task de dívida, não desta.
