# TASK-FRONTEND-010 — Edição em linha e exclusão com confirmação

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-010-frontend-species-inline-edit-delete`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 10 of 11 — Tela de espécies (parte 2: renomear e excluir)
**Generated**: `2026-08-25`

---

## Context

Fecha as HU-04, HU-05 e HU-06 na interface. A edição acontece **na própria linha**, sem tela nem janela intermediária, e apenas uma linha pode estar em edição por vez. A exclusão exige confirmação explícita nomeando a espécie — e o desfecho de espécie em uso é recusa com mensagem do servidor, nunca remoção otimista da lista.

---

## Scope

**In:** O modo de edição de `species-row.tsx`, o controle de qual linha está em edição, a confirmação de exclusão e o tratamento dos desfechos de `PATCH` e `DELETE` na página.

**Out:** Não criar componente de UI novo — `ConfirmDialog`, `IconButton` e `StatusMessage` já existem (TASK-FRONTEND-006). Não alterar `use-species-collection.ts` além de consumir `substituir` e `remover`, que já foram entregues com a assinatura definitiva. Não alterar `species-api.ts`, `validation.ts` nem `messages.ts` (TASK-FRONTEND-008). Não implementar exclusão em massa, desfazer, arquivamento nem migração de animais entre espécies (RN-10 e "O que Não Deve Ser Feito"). Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/pages/admin/species/species-row.tsx` | modo de edição |
| `create` | `src/pages/admin/species/delete-species-dialog.tsx` | confirmação de exclusão |
| `modify` | `src/pages/admin/species-page.tsx` | orquestra edição e exclusão |

---

## Implementation

> **Reference pattern**: `species-row.tsx` e `species-create-form.tsx` da TASK-FRONTEND-009 — o formulário de edição reusa o mesmo `TextField`, a mesma `validateSpeciesNameForm` e a mesma ramificação por `ApiError.code` do formulário de criação.

### `src/pages/admin/species/species-row.tsx` *(modify)*
- Acrescentar as props `isEditing`, `onStartEdit`, `onCancelEdit`, `onSave`, `onDelete`, `isSubmitting`.
- **Modo de exibição** (`isEditing === false`): o que já existe — nome mais os dois `IconButton`.
- **Modo de edição** (`isEditing === true`): `<form onSubmit>` com o `TextField` preenchido com o nome atual e dois botões — salvar e cancelar — **no lugar** dos ícones de lápis e lixeira. Submeter com Enter e cancelar com `Escape` no campo (CT-37).
- Foco no campo ao entrar em edição, via `useEffect` com `ref`, com o cursor no fim do texto: o administrador entra em edição para ajustar o nome, não para reescrevê-lo (HU-04 cenário 1).
- O estado do texto digitado vive **na linha**, não na página: assim cancelar é simplesmente desmontar o modo de edição e o nome original volta sem nenhuma cópia de segurança (CT-21 / CA-12).
- Validação local antes de chamar `onSave`, com a mesma precedência de mensagens da criação. Erro de campo aparece sob o campo e **a linha permanece em edição** (CT-19).
- `isSubmitting` desabilita salvar e cancelar.
- O erro vindo da API é recebido por prop e exibido dentro da linha — a linha não chama a API sozinha, quem chama é a página. Manter a linha sem acesso a `species-api` é o que permite testá-la sem espionar `fetch`.

### `src/pages/admin/species/delete-species-dialog.tsx` *(create)*
- Casca fina sobre o `ConfirmDialog`: recebe `species: Species | null`, `isSubmitting`, `onConfirm`, `onCancel`.
- Retorno antecipado `null` quando `species === null` — o diálogo existe no DOM apenas enquanto há uma espécie escolhida.
- `description={MESSAGES.SPECIES.deleteConfirmation(species.name)}`, produzindo `Excluir a espécie “Gato”? Esta ação não pode ser desfeita.` — o nome da espécie no texto é exigência do CA-13, e a função do catálogo é a única fonte da frase.
- `confirmLabel` e `cancelLabel` do catálogo; o botão de confirmar usa a variante de perigo já definida no `ConfirmDialog`.

### `src/pages/admin/species-page.tsx` *(modify)*
- Estado novo: `idEmEdicao: string | null`, `especieParaExcluir: Species | null`, `operacaoEmAndamento: boolean` e `erroDaLinha: string | null`.
- **Apenas uma linha em edição por vez** (RN da seção "Ação 2"): `idEmEdicao` é um único valor, não um conjunto. Acionar o lápis de outra linha simplesmente troca o valor — a edição anterior é encerrada sem gravar, que é exatamente o comportamento pedido no HU-04 cenário 8. Não pedir confirmação para descartar a edição anterior.
- **Salvar renomeação**: `renameSpecies(id, nome)` → sucesso: `substituir(species)` (o hook reinsere na posição alfabética correta), sair do modo de edição, exibir `UPDATE_SUCCESS`. Erro ramificado por `code`:
  - `VALIDATION_ERROR` → distribuir `details` com `fieldErrorsOf`, linha permanece em edição;
  - `SPECIES_NAME_ALREADY_EXISTS` → exibir `erro.message` na linha, **linha permanece em edição**, nenhum dos dois registros muda na lista (CT-18);
  - `SPECIES_NOT_FOUND` → exibir `erro.message`, **sair do modo de edição e chamar `recarregar()`** — a espécie sumiu por ação de outra pessoa e insistir na edição de um registro inexistente não leva a lugar nenhum (CT-20 / HU-04 cenário 7);
  - outro → `MESSAGES.FORM.UNEXPECTED_ERROR`.
- **Excluir**: o lápis abre edição, a lixeira apenas **seleciona** `especieParaExcluir` — nenhuma requisição parte daí. A chamada só acontece na confirmação (CA-13: não há exclusão em um único acionamento).
  - Cancelar → `especieParaExcluir = null`, nenhuma requisição, a espécie permanece na lista (CT-23 / CT-10 do roteiro de QA).
  - Confirmar → `deleteSpecies(id)`. Sucesso: `remover(id)`, fechar o diálogo, exibir `DELETE_SUCCESS`.
  - `SPECIES_IN_USE` → exibir `erro.message` ("Não é possível excluir esta espécie porque existem animais vinculados a ela."), **fechar o diálogo** e **manter a espécie na lista** (CT-24 / CA-14).
  - `SPECIES_NOT_FOUND` → exibir `erro.message`, fechar o diálogo e `recarregar()` (CT-27 / CA-17).
- **Remoção da lista só depois da resposta de sucesso.** Nada de atualização otimista: remover a linha antes da confirmação do servidor faria a espécie sumir da tela num cenário `SPECIES_IN_USE`, contradizendo o CA-14 exatamente no caso que a feature existe para proteger.
- As mensagens de operação usam o mesmo `StatusMessage` já montado na página; erro de operação inteira usa `AlertMessage` de erro (`role="alert"`), porque interrompe e exige decisão.

---

## Acceptance Criteria

- [ ] **Given** a lista exibindo "Sapo", **When** o lápis daquela linha é acionado, **Then** a linha entra em modo de edição com o campo preenchido com "Sapo", o foco nele, e os ícones de lápis e lixeira são **substituídos** pelas ações de salvar e cancelar — sem abrir tela ou janela (CA-10 / HU-04 cenário 1).
- [ ] **Given** uma linha em edição, **When** o lápis de outra linha é acionado, **Then** a primeira sai de edição sem gravar e a segunda entra — apenas uma linha em edição por vez (HU-04 cenário 8).
- [ ] **Given** uma linha em edição com o texto alterado, **When** cancelar é acionado, **Then** a linha volta ao modo de exibição com o nome original e **nenhuma** requisição é disparada (CT-21 / CA-12).
- [ ] **Given** uma linha em edição, **When** `Escape` é pressionado no campo, **Then** o efeito é o mesmo de cancelar.
- [ ] **Given** nome válido e não utilizado, **When** salvo, **Then** a linha volta ao modo de exibição com o novo nome, a lista é reordenada se necessário e "Espécie atualizada com sucesso." é exibida (CT-16 / HU-04 cenário 2).
- [ ] **Given** a espécie "gato", **When** renomeada para "Gato" e salva, **Then** a API responde sucesso e **nenhuma** mensagem de conflito é exibida (CT-17 / CA-11).
- [ ] **Given** o campo limpo, **When** salvo, **Then** exibe "Este campo é obrigatório.", a linha **permanece em edição** e nenhuma requisição é disparada (CT-19).
- [ ] **Given** existem "Gato" e "Sapo", **When** "Sapo" é renomeada para "gato" e a API responde `409`, **Then** exibe "Já existe uma espécie com este nome.", a linha permanece em edição e **nenhum** dos dois nomes muda na lista (CT-18).
- [ ] **Given** a API respondendo `404 SPECIES_NOT_FOUND` ao salvar, **When** a renomeação falha, **Then** exibe "Espécie não encontrada.", a linha sai de edição e a lista é recarregada (CT-20 / CA-17).
- [ ] **Given** a lixeira de uma linha acionada, **When** o diálogo abre, **Then** o texto exibido é exatamente `Excluir a espécie “{nome}”? Esta ação não pode ser desfeita.` e **nenhuma** requisição foi disparada (CA-13 / HU-05 cenário 1).
- [ ] **Given** o diálogo aberto, **When** cancelado, **Then** ele desaparece do DOM, nenhuma requisição é feita e a espécie permanece na lista (CT-23).
- [ ] **Given** o diálogo aberto, **When** confirmado e a API responde `204`, **Then** a espécie some da lista, o diálogo fecha e "Espécie excluída com sucesso." é exibida (CT-22 / CA-16).
- [ ] **Given** o diálogo aberto, **When** confirmado e a API responde `409 SPECIES_IN_USE`, **Then** exibe "Não é possível excluir esta espécie porque existem animais vinculados a ela." e a espécie **continua** na lista (CT-24 / CA-14).
- [ ] **Given** o diálogo aberto, **When** confirmado e a API responde `404`, **Then** exibe "Espécie não encontrada." e a lista é recarregada (CT-27).
- [ ] **Given** qualquer operação em andamento, **When** o usuário aciona o mesmo botão de novo, **Then** ele está desabilitado e nenhuma segunda requisição parte.
- [ ] **Given** a tela navegada apenas por teclado, **When** o percurso completo é feito, **Then** editar, salvar, cancelar, excluir e confirmar são todos alcançáveis e acionáveis, e o foco não escapa do diálogo enquanto ele está aberto (CT-37 / CA-21).
- [ ] Nenhum ponto do código remove ou altera um item da lista **antes** da resposta de sucesso da API.
- [ ] Nenhuma ramificação compara `ApiError.message` com texto literal (CA-22).

---

## Dependencies

- **Requires**: TASK-FRONTEND-009 (página, hook e linha de exibição), TASK-FRONTEND-006 (`ConfirmDialog`, `IconButton`, `StatusMessage`), TASK-FRONTEND-008 (`renameSpecies`, `deleteSpecies`, catálogo), TASK-BACKEND-003 e TASK-BACKEND-004 (endpoints em execução).
- **Blocks**: TASK-FRONTEND-011 (testes das telas).

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 3 modificados/criados + 8 de dependência lidos por inteiro (`confirm-dialog.tsx`, `use-species-collection.ts`, `species-api.ts`, `api-error.ts`, `validation.ts`, `messages.ts`, `icon-button.tsx`, `alert-message.tsx`/`status-message.tsx`)

#### Resumo

As três armadilhas antecipadas pela revisão da TASK-FRONTEND-009 estão **todas fechadas**, e cada uma foi confirmada **por execução**, não por leitura. Os 18 critérios de aceite estão implementados. A reprovação vem de outro lugar: `operacaoEmAndamento` é uma bandeira **única e global** para duas operações independentes, e nenhum dos dois tratadores verifica, ao resolver, se a operação que ele iniciou ainda é a operação corrente. Disso saem dois defeitos reproduzidos em execução — uma renomeação tardia que contamina a linha que entrou em edição depois dela, e uma armadilha de teclado real (SC 2.1.2, nível A) no diálogo de exclusão. Os dois vivem inteiramente dentro de `species-page.tsx`, que está na tabela *Files*.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | major | `src/pages/admin/species-page.tsx` | L198-223 (L182, L209-211) | bug / estado inconsistente | `salvarRenomeacao` não verifica, ao resolver, se `idEmEdicao` ainda é a espécie que ela gravou. **Reproduzido:** com o `PATCH` de "Sapo" em voo, o lápis de "Gato" é acionado; o `409` que chega depois renderiza "Já existe uma espécie com este nome." **sob o campo de Gato** — exatamente o defeito que o comentário de `iniciarEdicao` (L147-149) afirma prevenir. Com sucesso tardio, o `setIdEmEdicao(null)` da L210 **expulsa Gato do modo de edição e descarta o rascunho digitado**, contrariando o CA "a segunda entra". | Capturar a identidade da operação na partida e descartar a própria resolução se ela ficou obsoleta. O padrão já existe na base, no arquivo irmão: o contador `listagemMaisRecente` de `use-species-collection.ts` resolve esta mesma classe de corrida. |
| 2 | major | `src/pages/admin/species-page.tsx` | L373 (raiz em L106) | acessibilidade / bug | `isSubmitting={operacaoEmAndamento}` entrega ao diálogo uma bandeira que **pertence também à renomeação**. **Reproduzido:** com o `PATCH` de "Sapo" em voo, a lixeira de "Gato" abre o diálogo já com os **dois botões desabilitados** e o `Escape` recusado pelo `ConfirmDialog` — o foco estaciona no painel e **não há nenhuma saída**. Armadilha de teclado (SC 2.1.2, nível A) contra CA-21/RNF-06. Sem `timeout` em `http-client.ts`, uma requisição pendurada torna a armadilha ilimitada. A assimetria denuncia o descuido: o lado da **linha** já recebe a bandeira estreitada (L302, `operacaoEmAndamento && especie.id === idEmEdicao`); o lado do **diálogo** não. | Separar as bandeiras (`renomeacaoEmAndamento` / `exclusaoEmAndamento`), ou estreitar a do diálogo do mesmo modo que a da linha já é estreitada na L302. |
| 3 | minor | `src/pages/admin/species-page.tsx` | L187-192 e L254-256 | acessibilidade | O risco declarado pelo agente está **subestimado em dois pontos**. (a) Na renomeação `SPECIES_NOT_FOUND` o foco **nunca chega a ser devolvido**: `recarregar()` põe `status` em `'carregando'` no mesmo lote, a `DataList` inteira desmonta na mesma renderização e o lápis que receberia o foco já não existe — medido `activeElement === <body>` **antes** de a listagem responder, não depois. (b) O **mesmo** acontece na exclusão `404` (L254-256), desfecho que não foi declarado: ali `devolverFocoAoTitulo()` só é chamado no ramo de sucesso. | Chamar `devolverFocoAoTitulo()` nos dois ramos `SPECIES_NOT_FOUND`. **Não exige sinal de conclusão de `recarregar` nem tocar em `use-species-collection.ts`**: o `<h1>` vive fora de `regiaoDaLista()` e sobrevive tanto ao estado de carga quanto ao recarregamento. A correção é integralmente interna a `species-page.tsx`. |
| 4 | minor | `src/pages/admin/species-page.tsx` | L356-361 | escopo | Efeito colateral **confirmado por execução**: o `onResult({ variant: 'error' })` que o `SpeciesCreateForm` já emitia (L98 daquele arquivo) agora sai como `role="alert"` com `aria-live` implícito assertivo, onde a TASK-FRONTEND-009 entregava `role="status" aria-live="polite"`. Nenhum arquivo fora da tabela *Files* foi tocado e o texto não mudou, mas é mudança de comportamento em caminho pré-existente e aprovado. | Manter (ver *Julgamentos*), **registrar em `changelog_context.md`** e entregar explicitamente à TASK-FRONTEND-011, cujos testes do fluxo de criação precisam consultar `role="alert"`. |
| 5 | suggestion | `src/pages/admin/species/species-row.tsx` | L48-49 | padrão | Cópia **derivada** — e não idêntica — das classes do botão de cancelar do `ConfirmDialog` (acrescenta `w-full`, `py-3`, `text-[0.95rem]`). Cópia derivada é pior que cópia idêntica: uma alteração em `confirm-dialog.tsx` não deixaria rastro óbvio aqui. Dívida registrada no próprio arquivo e coerente com o precedente `status-message.tsx` ↔ `alert-message.tsx`. | Extrair as duas na primeira task que abrir `confirm-dialog.tsx` por motivo legítimo próprio. |
| 6 | suggestion | `src/pages/admin/species/species-row.tsx` | L293 | manutenibilidade | "O lápis é o PRIMEIRO `<button>` do wrapper" é premissa **posicional**: inverter a ordem dos dois ícones passaria a focar a lixeira sem nada reprovar. | Substituir os dois `querySelector` quando `IconButton`/`TextField` ganharem `forwardRef`. |
| 7 | suggestion | `src/pages/admin/species-page.tsx` | L360 | clareza | Com o ramo de erro desviado para `AlertMessage`, o `StatusMessage` desta página só é renderizado com `'success'`. `variant={resultado.variant}` virou indireção sem alcance. | `variant="success"` literal. |
| 8 | suggestion | `src/pages/admin/species-page.tsx` | L126 | convenção | Comentário com acento (`"Espécies, cabeçalho de nível 1"`). É citação de texto de tela, e há precedente pré-existente no mesmo arquivo (L74, L265), então não é violação da regra "comentário sem acento". Registrado apenas para que a exceção continue sendo consciente. | Nenhuma ação obrigatória. |

#### Verificação das três armadilhas — **por execução**

**Armadilha 1 — nenhuma escrita local otimista: FECHADA.**
Reproduzido com as duas requisições retidas em voo, não apenas com a asserção do agente.
- `DELETE` retido: "Gato" permanece na lista, o diálogo permanece montado. Só após a liberação a linha some, o diálogo fecha e `role="status"` traz "Espécie excluída com sucesso.". `remover(especie.id)` está **depois** do `await` (L241→L243).
- `PATCH` retido: a lista permanece `["Gato", "Sapo"]`, "Anta" não existe em lugar nenhum do DOM. Após o `200`, a lista sai `["Anta", "Gato"]` — reinserção alfabética correta. `substituir(atualizada)` está **depois** do `await` (L204→L209).
- Corolário verificado: como toda escrita passa pelo `escrever` do hook (que a **registra para reaplicação** sobre a listagem em voo), uma remoção otimista não seria apenas visual — seria reaplicada sobre o próximo retrato do servidor e a espécie reapareceria. O código não incorre nisso.

**Armadilha 2 — o destino de foco sobrevive à exclusão: FECHADA.**
- Exclusão bem-sucedida: `document.activeElement` é o `<h1>Espécies</h1>`, **não** o `<body>`. Verificado inclusive no caso extremo em que a lista fica **vazia** e vira `EmptyState` — o `<h1>` sobrevive e retém o foco.
- Desfechos em que a lixeira **sobrevive**, com a devolução nativa do `ConfirmDialog` intacta: cancelamento por botão, cancelamento por `Escape` a partir de percurso só-teclado, e `SPECIES_IN_USE` — nos três o foco volta ao botão "Excluir Gato", e no `SPECIES_IN_USE` a espécie permanece na lista com a mensagem do servidor em `role="alert"`.
- Mecanismo confirmado: `devolverFocoAoTitulo()` (L246) roda **antes** da renderização que remove a linha, então a limpeza do `ConfirmDialog` cai sobre nó já destacado e é no-op — é o que o comentário da L131-139 descreve, e é o que acontece.
- Ressalva: ver achado #3 — o destino **não** sobrevive nos dois ramos `SPECIES_NOT_FOUND`.

**Armadilha 3 — `isSubmitting` volta a `false` em `finally`: FECHADA nos dois tratadores.**
Verificado em caminhos de **falha**, não só de sucesso: após falha inesperada da renomeação, "Salvar" e "Cancelar" voltam habilitados e o `Escape` volta a sair da edição; após falha inesperada da exclusão, o diálogo reabre com os dois botões habilitados e fecha por `Escape`. Os `finally` das L214-222 e L257-259 cobrem todo desfecho.
**Mas** a armadilha de teclado que a #3 existia para impedir aparece por outra porta — achado #2. Não é `finally` preso; é bandeira compartilhada entre duas operações independentes.

#### Julgamentos pedidos

**Efeito colateral do `AlertMessage` (achado #4) — aceito, com registro.** Três razões: (a) a instrução da task diz "erro de operação inteira usa `AlertMessage` de erro (`role="alert"`)" — e o `UNEXPECTED_ERROR` do formulário de criação **é** erro de operação inteira pela mesma definição; (b) nenhum arquivo fora da tabela *Files* foi tocado — a mudança está no ramo de renderização da página, que é da task; (c) o papel novo é **semanticamente melhor**: `role="status"`/`polite` para um erro que interrompe o trabalho estava errado, e o RNF-09 pede que o resultado seja percebido sem navegação até ele. O que impede a aprovação silenciosa é só a disciplina: caminho pré-existente aprovado pela 009 mudou de papel ARIA, e a 011 escreverá os testes daquele fluxo. Declarado agora, fica correto.

**Título do diálogo `"Excluir Gato"` (mesmo nome acessível da lixeira) — aceito.** Não confunde na prática: com `aria-modal="true"` o fundo sai da árvore de acessibilidade, então o leitor nunca anuncia os dois nomes ao mesmo tempo; a transição sai como "Excluir Gato, diálogo" seguida da descrição do CA-13, que lê corretamente. Verificado: nome acessível = `"Excluir Gato"`, descrição = `Excluir a espécie “Gato”? Esta ação não pode ser desfeita.` — literal do catálogo, caractere a caractere. A alternativa exigiria chave nova em `messages.ts`, fora de escopo. **O custo real é de teste, e é herança da 011** (ver adiante).

**Devolução de foco ao lápis ao sair da edição — aceita, e a alegação sobre a guarda está CORRETA.** Construí uma contraprova isolada, sem tocar no arquivo, reproduzindo a estrutura (linha que sai da edição × linha que entra, como irmãs na mesma lista) e alternando apenas a guarda:

| Ordem | COM guarda | SEM guarda |
|---|---|---|
| linha que sai é a **1ª**, a que entra é a 2ª | foco no campo novo ✅ | foco no campo novo ✅ |
| linha que sai é a **2ª**, a que entra é a 1ª | foco no campo novo ✅ | **foco no lápis errado** ❌ |

A alegação "sem ela o defeito apareceria em metade dos casos, dependendo da posição alfabética" é **exatamente o que acontece**: os efeitos de irmãos rodam em ordem de árvore, e só quando a linha que sai roda **depois** da que entra é que ela rouba o foco. A guarda `document.activeElement !== document.body` é carga estrutural, não defensiva. E a adição está dentro do escopo por critério de aceite mesmo não estando por instrução: o CT-37 exige o percurso de teclado completo, e perder o foco para o `<body>` a cada cancelamento o quebraria. Verificado que não rouba foco em nenhum desfecho: após salvar, após cancelar por botão e após `Escape`, o foco é sempre "Editar Sapo".

**Diálogo fecha em todos os desfechos de falha — correto.** A mensagem vive na página, atrás da sobreposição; mantê-lo aberto esconderia a única explicação. Em `SPECIES_IN_USE` não há o que repetir — a repetição falharia igual. O custo (reabrir para tentar de novo após falha de rede) é menor que o de esconder a mensagem.

**`Escape` ignorado com a gravação em voo — correto em princípio.** Não há o que cancelar, e sair da edição deixaria a resposta chegar sobre uma linha já em exibição — que é o achado #1 por outro caminho. Espelha o próprio `ConfirmDialog`. O problema não é esta decisão; é a bandeira do achado #2.

**Classes duplicadas / `ref` + `querySelector`** — aceitos sob a restrição de escopo, rebaixados a sugestões (#5 e #6). O par de guardas `campo === null || campo === undefined` (L110) **não** é redundante: o encadeamento opcional produz genuinamente os dois tipos.

**Risco declarado (`SPECIES_NOT_FOUND`) — grave o suficiente para virar achado, e a responsabilidade é DESTA task.** Ver #3: o foco não é "devolvido corretamente e perdido depois", ele **nunca é devolvido**; e o mesmo vale para a exclusão `404`, que não foi declarada. A premissa de que fechar exigiria sinal de conclusão de `recarregar` está incorreta — o `<h1>` sobrevive ao estado de carga, e `devolverFocoAoTitulo()` nos dois ramos resolve inteiramente dentro de `species-page.tsx`. `use-species-collection.ts` continua fora de escopo e continua intocado.

#### Verificação especial

- **Ramificação por `code`**: ✅ quatro comparações, todas `erro.code === '...'` (L51, L61, L175, L181). Varredura por `.message ===`, `.status ===`, `includes`, `startsWith`, `match`: **nenhuma ocorrência**.
- **Nenhuma mensagem do backend duplicada**: ✅ varredura por literal PT-BR de erro nos três arquivos: **nenhum**. Tudo vem de `erro.message` ou de `MESSAGES`.
- **Rótulo `${verbo} ${nome}`**: ✅ preservado (`species-row.tsx` L324 e L331); confirmado por execução — `getByRole('button', { name: 'Excluir Gato' })` resolve.
- **Arquivos intocados**: ✅ `git status` acusa exatamente 2 modificados + 1 criado. `confirm-dialog.tsx`, `use-species-collection.ts`, `species-api.ts`, `validation.ts`, `messages.ts` e `http-client.ts` seguem no commit da 009/008/006.
- **Proibido `any`**: ✅ nenhuma ocorrência em `src/pages/admin/`.
- **`typecheck`**: ✅ exit 0 (dois projetos). **Suíte**: ✅ 160/160.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 18 de 18 critérios de aceite implementados e verificados por execução (incluindo os dois transversais: nenhuma escrita antes da resposta de sucesso; nenhuma ramificação por texto). Dois deles quebram sob concorrência — "a segunda linha entra" (achado #1) e CT-37/CA-21 (achado #2).
**Pass 2 — Diff Analysis**: Nenhum achado. Os três arquivos da tabela *Files* e só eles. Nada de `Scope — Out` foi tocado; nenhuma formatação em massa; nenhum arquivo alheio.
**Pass 3 — Code Practices**: Achados #5, #6, #7. SOLID respeitado — a linha valida e avisa, a página chama a API, o diálogo pergunta; nenhum dos dois componentes importa `species-api`. Extração de `FormularioDeEdicao` como componente próprio (e não ramo de `if`) é a decisão certa: o ciclo de vida do rascunho passa a ser o do componente, e cancelar vira desmontar. Funções pequenas, retorno antecipado, sem `else`, sem número mágico. Nomes em PT-BR consistentes com a base.
**Pass 4 — Testing Review**: Sem achados — a task **não entrega testes** por escopo explícito (são da TASK-FRONTEND-011). Os 160 testes existentes seguem verdes. A dívida de cobertura deste código está integralmente registrada na herança abaixo.
**Pass 5 — Security Review**: **Nenhum achado.** Superfície inteira revisada contra o OWASP Top 10. A01: nenhuma decisão de autorização acontece aqui — a tela vive atrás de `RoleRoute` e o servidor é a autoridade; nenhum identificador é construído no cliente (o `id` vem sempre do objeto `Species` que o servidor devolveu). A03: nenhuma interpolação em HTML cru, sem `dangerouslySetInnerHTML`; o nome da espécie e a `message` do servidor entram como texto pelo JSX, que escapa. A02/A05: nenhum segredo, nenhum dado sensível, nenhuma mensagem interna do servidor vazada além do texto de negócio já destinado ao usuário. A04: a exclusão exige confirmação explícita nomeando o recurso, e a proteção de espécie em uso é do servidor (CA-15) — a tela nunca a antecipa. A08/A09/A10: sem desserialização, sem log, sem URL construída de entrada do usuário.
**Pass 6 — Bug Detection**: Achados #1, #2, #3 — todos reproduzidos em execução, todos da mesma raiz (operação em voo sem identidade). Demais classes varridas sem achado: sem `catch` vazio (os três `catch` tratam e exibem); sem vazamento de recurso (os `finally` cobrem todo desfecho); sem coerção insegura (nenhum `==`); sem off-by-one; sem divisão; nenhum acesso a propriedade de valor possivelmente nulo sem guarda — `especieParaExcluir` é eliminado pelo retorno antecipado do diálogo, e o `onConfirm` recebe a espécie por parâmetro justamente para não reabrir o ramo impossível.
**Pass 7 — Project Patterns**: Achados #5, #8. Estrutura de pastas, nomenclatura de arquivo em kebab-case, alias `~/`, ordem de imports, tratamento de erro por `ApiError.code` e catálogo único de mensagens: todos alinhados. Linguagem ubíqua preservada — `Species`, `renameSpecies`, `deleteSpecies`, `SPECIES_IN_USE`, `SPECIES_NOT_FOUND` batem com o backend e com a spec; nenhum sinônimo novo introduzido.

#### Veredicto

> **REPROVADA — NECESSITA CORREÇÕES.** 0 critical, **2 major** (#1 e #2), 2 minor (#3 e #4), 4 sugestões.
>
> As três armadilhas antecipadas pela revisão da 009 estão **fechadas e comprovadas por execução** — a entrega é boa e a raiz do problema é única e local. Os dois `major` saem do mesmo lugar: `species-page.tsx` L106, uma bandeira `operacaoEmAndamento` global para duas operações independentes, sem identidade na resolução. O próprio arquivo já demonstra saber disso na L302, onde estreita a bandeira para a linha — falta fazer o mesmo do lado do diálogo (#2) e verificar a identidade na resolução dos dois tratadores (#1). O padrão de correção já existe na base, no arquivo irmão `use-species-collection.ts` (`listagemMaisRecente`).
>
> Encaminhar ao `makuco-codegen`. **Nenhuma correção exige sair de `species-page.tsx`** — nem a #3, cuja premissa declarada (precisaria de sinal de conclusão de `recarregar`) está incorreta. `use-species-collection.ts` permanece fora de escopo.

#### O que a TASK-FRONTEND-011 herda

1. **Colisão de nomes acessíveis no fluxo de exclusão.** O título do diálogo é `"Excluir Gato"`, idêntico ao rótulo da lixeira que o abriu; e `"Cancelar"`/`"Excluir"` existem simultaneamente na linha em edição e no diálogo. **Toda consulta do fluxo de exclusão precisa ser escopada** (`within(dialog)`, `within(list)`) — consulta global falha por múltiplos elementos. Verificado na prática durante esta revisão.
2. **O botão de salvar troca de rótulo em voo.** O `SubmitButton` vira `"Aguarde…"` com `aria-busy="true"` enquanto `isSubmitting`; `getByRole('button', { name: 'Salvar' })` deixa de resolver depois do clique.
3. **O campo de edição tem `id` determinístico** `species-edit-${species.id}` — é o gancho estável para distinguir a linha em edição do campo de criação, que compartilha o rótulo `"Nome de espécie"`.
4. **Cobrir os dois `major` com teste de regressão**, e são testes de concorrência: manter a promessa da API em voo e agir em outra linha antes de liberá-la. Sem isso, nem #1 nem #2 aparecem.
5. **O erro do fluxo de criação agora é `role="alert"`**, não `role="status"` (achado #4). Teste que assumir o comportamento da 009 reprovará por mudança deliberada.
6. **Asserções de foco são de primeira classe nesta tela**, não decoração: exclusão bem-sucedida → `<h1>`; cancelamento e `SPECIES_IN_USE` → a lixeira; saída da edição → o lápis. Enquanto o achado #3 não for corrigido, os dois ramos `SPECIES_NOT_FOUND` terminam no `<body>`.
7. **Sondas apagadas.** Nenhum arquivo de teste temporário permaneceu; `git status` acusa apenas os três arquivos da entrega.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 1 alterado nesta rodada (`species-page.tsx`) + os 2 da entrega relidos por inteiro + 4 de dependência (`confirm-dialog.tsx`, `use-species-collection.ts`, `species-api.ts`, `api-error.ts`)

#### Resumo

Os dois `major` da rodada 1 estão **fechados**, e o `minor` #3 também — os três **reproduzidos por execução**, com os dados exatos do parecer anterior, e nenhum aceito por leitura do relato. A decomposição da bandeira única em três coisas (identidade de sessão, sequência em gravação, bandeira de exclusão) resiste a todos os cenários de concorrência que consegui construir contra ela: 21 sondas, nenhuma derrubou o mecanismo central. Os quatro achados novos são de borda, todos `minor` ou `suggestion`, e nenhum reabre a classe de defeito da rodada 1.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 9 | minor | `src/pages/admin/species-page.tsx` | L308 | acessibilidade | `devolverFocoAoTitulo()` no ramo `SPECIES_NOT_FOUND` da renomeação é chamado **incondicionalmente**, inclusive quando o diálogo de exclusão está aberto. **Reproduzido:** `PATCH` de "Sapo" em voo → lixeira de "Gato" abre o diálogo (foco no "Excluir") → o `404` chega → o foco salta para o `<h1>`, **fora** da sobreposição `aria-modal="true"`, e o `Escape` deixa de fechar o diálogo (o tratador vive na sobreposição e o evento não sobe até ela). **Não é armadilha**: os dois botões seguem habilitados, o clique em "Cancelar" funciona e **3 tabulações** reengatam a armadilha de foco (medido: `input` de criação → "Criar" → "Cancelar" do diálogo). Mas durante essas três o teclado percorre conteúdo atrás de um modal. | Estreitar a chamada: `if (especieParaExcluir === null) { devolverFocoAoTitulo(); }`. Uma linha, dentro de `species-page.tsx`. |
| 10 | minor | `src/pages/admin/species-page.tsx` | L341 | bug / consistência | Duas gravações da **mesma** espécie na janela de voo: o efeito de operação aplicado sempre faz a resolução **obsoleta** sobrescrever a **mais nova**. **Reproduzido:** `PATCH`₁ envia "Anta", `PATCH`₂ envia "Zebra"; as respostas chegam na ordem ₂, ₁; a tela termina exibindo **"Anta"** enquanto o servidor guarda "Zebra". A regra "o servidor gravou, reflita" está certa entre espécies diferentes e **invertida** entre gravações da mesma espécie — a sequência é de **sessão**, não de escrita, e por isso não distingue as duas. | Fora do alcance proporcional desta task (exigiria sequência por escrita, ou `AbortController` atravessando `species-api.ts`/`http-client.ts`). Registrar e herdar. O `recarregar()` da RN-14 corrige na primeira recarga. |
| 11 | minor | `src/pages/admin/species-page.tsx` | L309 | UX / risco declarado | Risco declarado **confirmado**: `recarregar()` numa resolução obsoleta de `SPECIES_NOT_FOUND` desmonta a `DataList` e **descarta o rascunho** da linha que está em edição. Medido: rascunho "GatoZZZ" perdido; foco no `<h1>` durante a carga e de volta ao campo (com o nome original) quando a lista responde. | **Aceito.** A lista contém registro que não existe mais e a RN-14 manda recarregar; preservar o rascunho exigiria sinal de conclusão de `recarregar` — isto é, tocar `use-species-collection.ts`, fora de escopo. Herdar para a 011. |
| 12 | suggestion | `src/pages/admin/species-page.tsx` | L285, L295 | UX | A falha tardia no `AlertMessage` da página **não nomeia a espécie**. Reproduzido: renomeação de "Gato" conclui com sucesso, o `role="status"` exibe "Espécie atualizada com sucesso.", e a falha obsoleta de "Sapo" chega em seguida — o sucesso some e sobra "Já existe uma espécie com este nome.", sem indicação de a qual espécie se refere. | Fora de escopo (exigiria chave nova em `messages.ts`, TASK-FRONTEND-008). Registrar. |
| 13 | suggestion | `src/pages/admin/species-page.tsx` | L275-315 | padrão | `tratarFalhaDaRenomeacao(erro, edicaoAindaEMinha)` recebe **parâmetro booleano de comportamento**, e o ramo `SPECIES_NOT_FOUND` tem **dois níveis de indentação** (`if` dentro de `if`) — a única regressão de Object Calisthenics rule 1 do arquivo. O ponto de chamada compensa (`minhaEdicao === edicaoMaisRecente.current` é auto-explicativo). | Considerar dois tratadores (`...FalhaNaMinhaEdicao` / `...FalhaObsoleta`) se o ramo crescer. Nenhuma ação obrigatória. |

Os achados #5, #6, #7 e #8 da rodada 1 (sugestões) **continuam abertos** — todos em `species-row.tsx` e no `variant={resultado.variant}` da L523, e nenhum deles bloqueava. O #4 foi cumprido: o desvio do papel ARIA está registrado em comentário no próprio arquivo (L509-517) e entregue à 011.

#### Reexecução dos dois `major` — **por execução, com os dados do parecer anterior**

**Major #1 (identidade na resolução) — FECHADO.** `PATCH` de "Sapo" retido, lápis de "Gato" acionado, rascunho "Gatossss" digitado:
- `409` tardio: **nenhuma** ocorrência de "Já existe uma espécie com este nome." dentro da linha de Gato; o texto sai no `role="alert"` da página. Rascunho intacto, linha ainda em edição.
- Sucesso tardio (`200` com "Anta"): Gato **permanece** em edição, `value` segue "GatoX", e a lista passa a conter "Anta" com `role="status"` "Espécie atualizada com sucesso.". O efeito de operação sobreviveu à morte da sessão — que é o item 5 da pauta desta rodada, verificado.

**Major #2 (bandeira do diálogo) — FECHADO.** Com o `PATCH` de "Sapo" em voo, a lixeira de "Gato" abre o diálogo com **os dois botões habilitados**, foco no "Excluir", e o `Escape` fecha sem disparar `deleteSpecies`. A armadilha de teclado da rodada 1 não se reproduz.

**Minor #3 (foco nos dois ramos de 404) — FECHADO.** `document.activeElement` é o `<h1>Espécies</h1>` — nunca o `<body>` — na renomeação **e** na exclusão. A premissa corrigida (o `<h1>` vive fora de `regiaoDaLista()`) está certa nos dois pontos.

#### As três armadilhas originais — reconfirmadas

1. **Nenhuma escrita otimista.** `DELETE` retido: 2 itens na lista, diálogo montado; após a liberação, 1 item, diálogo fechado, `role="status"`. `PATCH` retido: lista inalterada até a resposta. `substituir`/`remover` seguem **depois** do `await`.
2. **Foco após exclusão bem-sucedida** → `<h1>`. Confirmado também com uma linha em edição atrás do diálogo: a linha **mantém** o modo de edição e o rascunho após o `204` de outra espécie.
3. **`isSubmitting` volta em `finally` nos caminhos de falha.** Renomeação: "Salvar" e "Cancelar" habilitados após falha inesperada. Exclusão: diálogo reabre com os dois botões habilitados.

#### Buracos procurados na técnica nova — o que resistiu

- **Duas gravações da mesma espécie na janela de voo**: a linha fica marcada como gravando pela sessão nova (risco declarado, confirmado) e o `finally` **obsoleto não solta os botões da corrente** — o atualizador funcional `(atual) => atual === minhaEdicao ? null : atual` faz exatamente o que promete. Verificado: após a resolução da gravação obsoleta, o botão da corrente segue "Aguarde…" e desabilitado. **O único defeito real deste cenário é o #10.**
- **Sequência presa**: impossível por construção — o contador só incrementa, então `sequenciaEmGravacao` nunca volta a coincidir com uma sessão encerrada. Nenhum arranjo deixou linha travada.
- **Sessão encerrada durante o `await` do `DELETE`**: o `DELETE` só parte da confirmação de um modal com armadilha de foco, e o alvo não troca no meio — a justificativa do booleano simples para a exclusão está **correta**. Com o `DELETE` em voo, os dois botões do diálogo ficam desabilitados e a linha em edição atrás dele permanece habilitada, mas inalcançável pelo teclado.
- **Resolução obsoleta de sucesso × corrente de falha (e vice-versa)**: a separação por efeito cobre. Sucesso obsoleto + falha corrente → lista atualizada e erro sob o campo da corrente. Falha obsoleta + sucesso corrente → sucesso aplicado e depois substituído pelo alerta da falha (achado #12, cosmético).
- **Erro obsoleto sob o campo errado**: não acontece. `trocarEdicao` limpa `erroDaLinha` e o canal é escolhido por `edicaoAindaEMinha`.

#### Julgamentos pedidos

**Falha tardia de renomeação no `AlertMessage` da página — DESFECHO CERTO.** A gravação falhou de verdade, o nome continua o antigo e silenciar faria o usuário acreditar ter gravado (RNF-09). O canal alternativo (campo da linha) é o defeito da rodada 1. Não há terceiro canal disponível sem sair do escopo. A única perda é a falta do nome da espécie na frase (#12), e ela vem de `messages.ts`, que a task não pode alterar.

**`recarregar()` obsoleto descartando o rascunho — INEVITÁVEL NESTE ESCOPO, e a alegação procede.** A lista contém um registro que o servidor já não tem; não recarregar contraria a RN-14. Preservar o rascunho exigiria adiar a troca de estado até a listagem responder, isto é, um sinal de conclusão em `use-species-collection.ts` — `Scope — Out`. O custo é assimétrico a favor de recarregar: o rascunho perdido é de uma linha que o usuário abriu segundos antes; a lista desatualizada mostraria uma espécie fantasma editável.

**Duas gravações simultâneas da mesma espécie — a marcação pela sessão nova está certa, mas o relato está incompleto.** O que o agente declarou (a linha fica marcada pela sessão nova) é benigno. O que ele **não** declarou é o #10: a resolução obsoleta sobrescreve a mais nova **na tela**. Não é `major` porque exige o encadeamento completo (gravar → sair da linha → voltar → gravar de novo antes da primeira resolver), a divergência é só de exibição e o próximo `recarregar` a corrige. Fica registrado porque a regra "efeito de operação sempre" é apresentada como universal no comentário da L332-340, e ela **não é** — ela vale entre espécies distintas.

#### Verificação especial

- **Escopo desta rodada**: ✅ apenas `species-page.tsx` alterado (mtime 16:34 contra 16:00/16:01 dos outros dois). `confirm-dialog.tsx`, `use-species-collection.ts`, `species-api.ts`, `validation.ts`, `messages.ts` e `http-client.ts` com `git diff` **vazio**.
- **Ramificação por `code`**: ✅ quatro comparações `erro.code === '...'` (L51, L61, L75, L82). Varredura por `.message ===`, `.status ===`, `includes`, `startsWith`, `match`, `==`, `!=`, `any`: **nenhuma ocorrência** nos três arquivos.
- **Nenhuma mensagem do backend duplicada**: ✅ nenhum literal PT-BR de erro nos três arquivos.
- **`typecheck`**: ✅ exit 0 (dois projetos). **Suíte**: ✅ 12 suítes / 160 testes. **Avisos de `act()`**: ✅ exatamente **5**, todos com origem em `src/pages/auth/register-page.spec.tsx` — nenhum vindo dos arquivos desta task.
- **Sondas**: ✅ apagadas. `git status` acusa 2 modificados + 1 não rastreado, exatamente a tabela *Files*.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 18 de 18 critérios implementados. Os dois que quebravam sob concorrência na rodada 1 — "a segunda linha entra" e CT-37/CA-21 — agora **passam por execução**. Nenhum critério regrediu.
**Pass 2 — Diff Analysis**: Nenhum achado. Um único arquivo alterado nesta rodada, dentro da tabela *Files*; nada de `Scope — Out` tocado; nenhuma formatação em massa.
**Pass 3 — Code Practices**: Achado #13 (parâmetro booleano de comportamento e dois níveis de indentação em `tratarFalhaDaRenomeacao`). No mais, a decomposição **melhora** o desenho: `SessaoDeEdicao` é o value object que a bandeira booleana não era (rule 3), `trocarEdicao` é ponto único de mutação, e `mensagemDoErroSobOCampo` separa a escolha da mensagem da escolha do canal — SRP aplicado no lugar certo. Linguagem ubíqua preservada (`Species`, `renameSpecies`, `SPECIES_NOT_FOUND`); os nomes novos em PT-BR seguem o precedente de `listagemMaisRecente`.
**Pass 4 — Testing Review**: Sem achados — a task **não entrega testes** por escopo explícito. A suíte existente segue verde e sem regressão. A dívida está integralmente na herança abaixo.
**Pass 5 — Security Review**: **Nenhum achado.** A correção é inteiramente de gerência de estado local — nenhuma superfície nova, nenhum import novo, nenhum identificador construído no cliente, nenhuma interpolação em HTML cru. A conclusão da rodada 1 sobre o OWASP Top 10 permanece válida sem alteração.
**Pass 6 — Bug Detection**: Achados #9, #10, #11. Demais classes varridas sem achado: nenhum `catch` vazio; `finally` cobrindo todo desfecho nos dois tratadores; nenhuma coerção insegura; nenhum off-by-one; nenhum acesso a propriedade possivelmente nula sem guarda; nenhuma sequência presa.
**Pass 7 — Project Patterns**: Nenhum achado novo. O contador de sequência é transposição fiel do padrão que `use-species-collection.ts` já estabeleceu no mesmo diretório, com a mesma justificativa registrada para não usar `AbortController`.

#### Veredicto

> **APROVADA.** 0 critical, **0 major**, 3 minor (#9, #10, #11), 2 sugestões novas (#12, #13) e as 4 sugestões abertas da rodada 1.
>
> Os dois `major` e o `minor` #3 da rodada 1 estão fechados e **comprovados por execução**, não por leitura. A técnica escolhida — sequência de sessão em `useRef`, separação entre efeito de operação e efeito de sessão, bandeiras independentes por operação — resistiu a 21 sondas de concorrência, incluindo as quatro que esta rodada foi encarregada de tentar. Os achados restantes são de borda, não bloqueiam a TASK e nenhum reabre a classe de defeito corrigida.
>
> Nenhum arquivo fora da tabela *Files* foi tocado. `use-species-collection.ts` permanece intocado.

#### O que a TASK-FRONTEND-011 herda (última task da feature)

Além dos 7 itens da rodada 1, que continuam valendo integralmente:

8. **Os testes de regressão dos dois `major` são de concorrência** e exigem a promessa da API retida em voo (`new Promise` com `resolve`/`reject` guardados). Sem reter, nem o defeito antigo nem a correção aparecem. Os cenários mínimos: (a) `409` tardio não pode renderizar sob o campo da linha nova; (b) sucesso tardio não pode expulsar a linha nova nem descartar seu rascunho; (c) o diálogo de exclusão abre com os dois botões **habilitados** e o `Escape` funcionando com um `PATCH` em voo.
9. **Asserção de foco nos dois ramos `SPECIES_NOT_FOUND`**: `document.activeElement` tem de ser o `<h1>`. Segurar a listagem em voo (`listSpecies` devolvendo promessa que nunca resolve) é o que torna o estado observável — depois que a lista responde, o campo remontado rouba o foco de volta e a asserção deixa de significar o que se quer medir.
10. **O `finally` obsoleto é cenário próprio**: duas gravações da mesma espécie, a primeira resolvendo depois — o botão da gravação corrente tem de continuar "Aguarde…" e desabilitado. É o teste que protege o atualizador funcional da L363 de virar `setSequenciaEmGravacao(null)` numa refatoração futura.
11. **Achados #9, #10 e #11 não têm teste de regressão nesta task.** Se a 011 quiser fixá-los como comportamento conhecido, que seja com nome explícito de limitação — nenhum deles é o desfecho desejado, apenas o aceito.
12. **A linha em edição sobrevive à exclusão de outra espécie** (rascunho incluído). Vale como caso de teste: é a garantia de que `remover` não desmonta a `DataList`.
13. **Um segundo acionamento do mesmo botão não dispara segunda requisição** (AC 15): verificar por `toHaveBeenCalledTimes(1)` após clicar no botão já desabilitado, e o `Escape` recusado durante a gravação.
