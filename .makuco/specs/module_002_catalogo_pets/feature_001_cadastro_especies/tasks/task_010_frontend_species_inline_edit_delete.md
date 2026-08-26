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
