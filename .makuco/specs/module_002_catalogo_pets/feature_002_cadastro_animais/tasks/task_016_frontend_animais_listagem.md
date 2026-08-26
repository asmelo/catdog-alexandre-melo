# TASK-FRONTEND-016 — Tela de listagem de animais

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-016-frontend-animais-listagem`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 16 of 18 — Tela de Listagem
**Generated**: `2026-08-25`

---

## Context

Entrega `/admin/animais` com as sete colunas da captura, a alteração de status na própria linha, a exclusão com confirmação e a paginação. O item "Animais" da navegação lateral já existe desde a FEATURE-001 apontando para tela inexistente — esta task lhe dá destino, **sem** tocar no componente de navegação.

---

## Scope

**In:** Selo de status, controles de paginação, miniatura com marcador neutro e indicador de pendência de foto, a tela de listagem com os seus quatro estados (carregando, vazio, erro, com dados), a alteração de status na linha, a exclusão com confirmação, e o registro das três rotas no roteador.

**Out:** **Não alterar a navegação lateral administrativa** — ela foi entregue pela FEATURE-001 com os itens "Animais" e "Espécies", e duplicar essa mudança criaria conflito. Não criar componente de lista/tabela, de confirmação de ação destrutiva nem de aviso de sucesso: os três vêm da FEATURE-001 e são reaproveitados. Nenhuma busca, filtro ou ordenação configurável (RN-42b). Nenhum campo de status no formulário — a alteração é exclusiva desta tela (RN-16). O formulário em si é da TASK-FRONTEND-017. Sem testes (TASK-FRONTEND-018).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/status-badge.tsx` | selo colorido de status |
| `create` | `src/components/ui/pagination.tsx` | navegação entre páginas |
| `create` | `src/pages/admin/animais/animal-thumbnail.tsx` | miniatura e marcador |
| `create` | `src/pages/admin/animais/animal-status-select.tsx` | alteração na linha |
| `create` | `src/pages/admin/animais/animais-list-page.tsx` | tela de listagem |
| `modify` | `src/routes/app-routes.tsx` | registra as três rotas |

---

## Implementation

> **Reference pattern**: os componentes de lista, de confirmação de ação destrutiva e de aviso de sucesso entregues pela FEATURE-001 são o material de construção — reusá-los, e reportar em vez de improvisar se algum não existir. `src/pages/auth/login-page.tsx` é o molde de tela que consome API, trata `ApiError` por `code` e desabilita ação durante requisição.

### `src/components/ui/status-badge.tsx` *(create)*
- Quatro variantes: verde para "Disponível", âmbar para "Reservado", cinza para "Adotado" e vermelho suave para "Indisponível".
- **O texto do status é sempre exibido**, nunca só a cor. Um selo que comunica o estado apenas por cor é invisível para quem não distingue as duas primeiras (RNF-17, CA-42).
- Contraste do texto em no mínimo 4.5:1 sobre o fundo do selo, nos quatro casos (RNF-18).
- Somente leitura: sem `onClick`, sem `role="button"`.

### `src/components/ui/pagination.tsx` *(create)*
- Props: `page`, `pageSize`, `total`, `onPageChange`.
- **Renderiza `null` quando `total <= pageSize`.** É por isso que a captura, com um único animal, não exibe controle nenhum e mesmo assim está em conformidade (RN-42a, CT-27).
- Botões com nome acessível, `aria-current` na página atual e desabilitação nos extremos.

### `src/pages/admin/animais/animal-thumbnail.tsx` *(create)*
- Exibe `animal.images[0]?.url`. Sem imagens, um marcador visual neutro ocupa o lugar e a linha continua legível (CT-32).
- `alt` descritivo com o nome do animal; o marcador neutro é decorativo e recebe `alt=""`.
- Quando o status é `disponivel` **e** não há imagem, acrescentar um indicador discreto de pendência de foto, com texto acessível. É sinalização, não bloqueio: o administrador cadastra o animal em campo e fotografa depois (RN-60, CT-33, CA-46).
- `images[0]` é `AnimalImage | undefined` sob `noUncheckedIndexedAccess` — tratar, não silenciar com `!`.

### `src/pages/admin/animais/animal-status-select.tsx` *(create)*
- `SelectField` posicionado no status atual, com as quatro opções e os rótulos acentuados de `animal-labels.ts` (CT-70, CA-05).
- Escolher o **mesmo** status **não envia requisição** e nada muda (CT-71, RN-16).
- Durante a requisição o campo fica desabilitado; nenhuma segunda escolha é aceita (HU-07 cenário 2).
- Atualização **otimista com reversão**: aplicar o novo valor na hora e, em caso de falha, voltar ao anterior exibindo "Não foi possível atualizar o status. Tente novamente." (CT-74).
- Ramificar por `code`, nunca pelo texto: `ANIMAL_NOT_FOUND` → mensagem da API e **recarregar a lista**, para não deixar linha fantasma (CT-73); `ANIMAL_STALE_UPDATE` → mensagem da API, reverter o campo e recarregar a lista (CT-67); qualquer outro → mensagem genérica de falha e reverter.
- Enviar sempre o `updatedAt` que veio na linha carregada — é o token de concorrência (RN-47).

### `src/pages/admin/animais/animais-list-page.tsx` *(create)*
- Título "Animais" e botão primário "Cadastrar Animal" alinhado à direita, na mesma altura (CA-02).
- Colunas, nesta ordem: ANIMAL, ESPÉCIE, PORTE, LOCALIZAÇÃO, STATUS, ALTERAR STATUS, AÇÕES (CA-03).
- LOCALIZAÇÃO monta `"{cidade} - {UF}"` a partir de `animal.city` — "Boa Esperança - ES". A UF vem da cidade, não de campo próprio (CA-04).
- Rodapé com a contagem vinda de `pagination.total`, com a concordância correta. **O total é o geral, não o da página** (RN-43, CA-06, CT-24).
- **Quatro estados**: carregando (indicador no lugar da tabela, com título e botão de cadastro **permanecendo visíveis**); vazio ("Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima." com o botão disponível); erro ("Não foi possível carregar os animais. Tente novamente." com ação de nova tentativa); com dados (CT-29, CT-30).
- Paginação server-side: `page` no estado da tela, repassado a `listAnimals`. Trocar de página recarrega do servidor — nunca fatiar em memória, que quebraria o total e a determinística da RN-41.
- Exclusão: acionar "Excluir" abre a confirmação da FEATURE-001 com o texto literal `Excluir o animal “{nome}”? Esta ação não pode ser desfeita.`, com as aspas curvas. Cancelar não executa nada (CT-77). Confirmar chama `deleteAnimal`, exibe "Animal excluído com sucesso.", recarrega a lista e atualiza a contagem (CT-76). `ANIMAL_NOT_FOUND` → mensagem da API e recarga (CT-78).
- Toda escrita reflete na listagem em menos de 1 segundo em conexão padrão (RNF-12) — recarregar a página inteira após uma alteração de status ou uma exclusão é o que faz esse orçamento estourar; recarregar apenas a listagem, não.
- Após excluir o último item de uma página que não é a primeira, voltar uma página em vez de exibir uma página vazia.
- Mensagens de sucesso e de erro em região `aria-live`, para serem percebidas por leitor de tela sem exigir navegação até elas (RNF-19).
- Botões "Editar" e "Excluir" de cada linha com nome acessível identificando **o animal**, não apenas a ação: numa tabela, cinco botões "Excluir" idênticos são inúteis para quem navega por lista de controles (RNF-17, CT-95).

### `src/routes/app-routes.tsx` *(modify)*
- Registrar `/admin/animais`, `/admin/animais/novo` e `/admin/animais/:id/editar` dentro do bloco já protegido por `ProtectedRoute` + `RoleRoute` de `admin`, reusando as guardas existentes.
- As duas rotas de formulário apontam para o componente da TASK-FRONTEND-017; até lá, deixar o marcador `// TODO(TASK-FRONTEND-017)` no lugar, no mesmo padrão que a FEATURE-002 do MODULE-001 usou.

---

## Acceptance Criteria

- [ ] **Given** um `admin` autenticado, **When** o item "Animais" é acionado, **Then** a tela abre com o título "Animais", o botão "Cadastrar Animal" à direita e o item marcado como ativo (CA-01, CA-02).
- [ ] **Given** um animal "Theo", cachorro, grande, em Boa Esperança/ES, Disponível, **When** a linha é exibida, **Then** as sete colunas aparecem, LOCALIZAÇÃO mostra "Boa Esperança - ES" e o selo verde mostra "Disponível" (CT-23, CA-03, CA-04, CA-05).
- [ ] **Given** um animal com duas imagens, **Then** a miniatura é a de `position` 0; **Given** um animal sem imagens, **Then** um marcador neutro ocupa o lugar e a linha continua legível (CT-31, CT-32, CA-26).
- [ ] **Given** um animal Disponível sem imagem, **When** a linha é exibida, **Then** o indicador de pendência de foto aparece e **nenhuma ação da linha é bloqueada** (CT-33, CA-46).
- [ ] **Given** 0, 1 e 2 animais, **When** o rodapé é exibido, **Then** apresenta "Nenhum animal cadastrado", "Total: 1 animal" e "Total: 2 animais" (CT-24, CA-06).
- [ ] **Given** um total menor ou igual ao tamanho da página, **When** a lista é exibida, **Then** **nenhum** controle de paginação aparece no DOM (CT-27, CA-07).
- [ ] **Given** 45 animais e `pageSize` 20, **When** as três páginas são percorridas, **Then** cada animal aparece exatamente uma vez e o rodapé continua informando o total geral (CT-26, CA-08).
- [ ] **Given** a lista carregando, **When** a tela é aberta, **Then** o indicador ocupa o lugar da tabela e o título e o botão de cadastro **permanecem visíveis**.
- [ ] **Given** a consulta falhando, **Then** exibe "Não foi possível carregar os animais. Tente novamente." com ação de nova tentativa (CT-30).
- [ ] **Given** um animal Disponível, **When** "Adotado" é escolhido na coluna ALTERAR STATUS, **Then** o selo passa a "Adotado", exibe "Status atualizado com sucesso." e **nenhum outro dado do animal muda** (CT-69, CA-30).
- [ ] **Given** o status já vigente escolhido de novo, **When** a escolha ocorre, **Then** **nenhuma requisição é enviada** (CT-71).
- [ ] **Given** a alteração de status falhando, **Then** o campo volta ao valor anterior e exibe "Não foi possível atualizar o status. Tente novamente." (CT-74).
- [ ] **Given** o animal excluído em outra aba, **When** o status é alterado, **Then** exibe "Animal não encontrado." e a lista é recarregada, sem deixar linha fantasma (CT-73).
- [ ] **Given** "Excluir" acionado, **Then** a confirmação exibe `Excluir o animal “Theo”? Esta ação não pode ser desfeita.`; cancelar não executa nada e confirmar remove o animal, atualiza a contagem e exibe "Animal excluído com sucesso." (CT-76, CT-77, CA-33).
- [ ] **Given** um usuário com role `cliente`, **When** a rota é acessada, **Then** ele é redirecionado para a sua área e **nenhum conteúdo administrativo aparece no DOM**; **Given** nenhuma sessão, **Then** redireciona para o login (CT-87, CT-88, CA-41).
- [ ] **Given** navegação apenas por teclado, **When** a tela é percorrida, **Then** listar, alterar status, editar, excluir e confirmar são alcançáveis e acionáveis (CT-94, CA-42).
- [ ] **Given** um leitor de tela, **When** a linha é percorrida, **Then** os botões e o selo são anunciados identificando a ação e o animal (CT-95).

---

## Dependencies

- **Requires**: TASK-FRONTEND-013 (API, tipos, rótulos, rotas), TASK-FRONTEND-014 (`SelectField`), FEATURE-001 do MODULE-002 (navegação lateral, componente de lista, confirmação, aviso de sucesso), TASK-BACKEND-006 e TASK-BACKEND-009.
- **Blocks**: TASK-FRONTEND-017 (as rotas do formulário são registradas aqui), TASK-FRONTEND-018.
