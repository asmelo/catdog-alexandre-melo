# TASK-FRONTEND-015 — Campo de envio de imagens com pré-visualização e preparo até o "Salvar"

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-015-frontend-image-upload-field`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 15 of 18 — Base de Componentes
**Generated**: `2026-08-25`

---

## Context

Entrega o componente da área de imagens do formulário, com o rótulo literal, as miniaturas com "x" de remoção, o botão "Escolher arquivos" e o texto ao lado. O comportamento que governa o desenho é a RN-49: **nada é gravado no armazenamento nem removido dele antes do "Salvar"**. O "x" de uma imagem já gravada marca-a para remoção; "Cancelar" descarta a marcação. Um "Cancelar" que não desfizesse a remoção de uma foto seria uma armadilha, já que a captura o apresenta como saída legítima do formulário.

---

## Scope

**In:** Componente controlado que recebe as imagens já gravadas e as escolhidas, devolve o estado final ao formulário, exibe miniaturas com remoção, respeita o limite sobre o estado final e libera as URLs de pré-visualização.

**Out:** Nenhuma chamada de API e nenhuma montagem de `FormData` — o componente devolve estado, e quem monta o corpo e envia é o formulário (TASK-FRONTEND-017). Nenhuma reordenação por arrastar: a spec define a ordem como "mantidas na ordem em que aparecem, recém-enviadas depois", e arrastar não é exigido por nenhum CA. Nenhum recorte, redimensionamento, compressão ou correção de orientação — declarado fora de escopo, com a limitação de fotos deitadas registrada e aceita. Nenhum indicador de progresso de envio: o progresso é do formulário, que é quem faz a requisição (RNF-13).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Imagem já gravada | `{ kind: 'stored'; id: string; url: string }` |
| Imagem em preparo (RN-49) | `{ kind: 'staged'; localId: string; file: File; previewUrl: string }` |
| Estado final (RN-50) | `items.length`, somando gravadas mantidas e em preparo |
| Imagem de capa (RN-35) | `items[0]` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/image-upload-field.tsx` | envio com pré-visualização |
| `create` | `src/domains/animals/animal-images.ts` | tipos e regras do preparo |

---

## Implementation

> **Reference pattern**: `src/components/ui/text-field.tsx` para a anatomia rótulo/controle/erro e para o formato das props controladas.

### `src/domains/animals/animal-images.ts` *(create)*
- Tipo `AnimalImageItem` como união discriminada de `stored` e `staged`. A união é o que permite ao formulário derivar, sem ambiguidade, `keepImageIds` (os `stored` que sobraram, na ordem) e os arquivos a enviar (os `staged`, na ordem).
- Funções puras, sem React, testáveis isoladamente: `remainingSlots(items)`, `canAcceptFiles(items, quantidade)`, `appendFiles(items, files)`, `removeItem(items, key)`.
- Lista vazia é estado válido e não é erro: o animal pode ter de zero a cinco imagens (RN-30).
- `MAX_IMAGES = 5` e `MAX_IMAGE_BYTES = 5 * 1024 * 1024` declarados aqui, uma vez. As verificações no navegador existem **apenas** para retorno imediato e não são consideradas garantia: quem chama a API diretamente recebe a mesma recusa do servidor (RN-33).

### `src/components/ui/image-upload-field.tsx` *(create)*
- Componente **controlado**: recebe `items` e `onChange`. Nenhum estado de imagem vive dentro dele — é o formulário que precisa do estado final para montar o envio e para o "Cancelar" descartar tudo.
- Rótulo literal: `"Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)"`. Botão `"Escolher arquivos"` e, ao lado, `"Nenhum arquivo escolhido"` enquanto não houver escolha, passando a informar a quantidade depois (CA-19, CT-45).
- `<input type="file" multiple accept="image/jpeg,image/png">` visualmente oculto, acionado pelo botão — mas **oculto por classe, jamais por `display: none`**, para permanecer focável por teclado. A remoção e a escolha precisam ser alcançáveis sem mouse (RNF-16, CT-94).
- Miniatura de cada item com um "x" no canto superior direito. O "x" é um `<button>` com nome acessível que **identifica a imagem e a ação** — "Remover imagem 2 de 3" —, nunca um ícone sem texto alternativo (RNF-17, CT-95).
- **Limite sobre o estado final**: antes de aceitar arquivos, verificar `items.length + novos.length <= 5`. Excedendo, recusar **antes do envio** e informar quantas ainda cabem — "Você já tem 3 imagens; ainda cabem 2." (RN-50, CT-48, CA-20).
- Verificar tipo e tamanho no cliente para retorno imediato, sinalizando o arquivo recusado pelo nome. Isso não dispensa nada: o servidor apura o formato por assinatura binária e recusa igualmente (RN-33, RN-34).
- **`URL.createObjectURL` para cada `staged`, com `URL.revokeObjectURL` na remoção e no desmonte.** Sem a revogação, cada abertura do formulário retém os blobs até a aba ser fechada — cinco imagens de 5 MB por edição é vazamento visível na prática, não teórico.
- Criar a URL **uma vez**, no momento em que o item entra na lista, e guardá-la no próprio item. Criar durante a renderização produz uma URL nova a cada render, vaza todas as anteriores e faz a miniatura piscar.
- Remover um `stored` **não** chama a API: apenas o tira da lista. Ele só deixa de existir quando o formulário salva (RN-49, CT-59).
- Nenhum arquivo é enviado por este componente, em nenhuma circunstância.

---

## Acceptance Criteria

- [ ] **Given** o campo recém-aberto sem imagens, **When** renderizado, **Then** exibe o rótulo literal, o botão "Escolher arquivos" e o texto "Nenhum arquivo escolhido" (CA-19).
- [ ] **Given** dois arquivos JPEG válidos escolhidos, **When** a escolha conclui, **Then** duas miniaturas aparecem, cada uma com o seu "x", e o texto ao lado informa a quantidade escolhida (CT-45).
- [ ] **Given** três itens na lista, **When** três novos arquivos são escolhidos, **Then** nenhum é aceito e a mensagem informa quantos ainda cabem (CT-48, CA-20).
- [ ] **Given** cinco itens, **When** três são removidos e três novos escolhidos, **Then** os três são aceitos e a lista volta a ter cinco (CT-49b).
- [ ] **Given** uma imagem já gravada, **When** o seu "x" é acionado, **Then** ela sai da lista e **nenhuma requisição é feita** (CT-59, RN-49).
- [ ] **Given** o item na posição 0 removido, **When** a lista é lida, **Then** o item seguinte passa a ocupar a posição 0 — a capa acompanha (CT-60, CA-26).
- [ ] **Given** um item em preparo removido, **When** a remoção ocorre, **Then** `URL.revokeObjectURL` é chamado para a sua URL de pré-visualização; **Given** o componente desmontado, **Then** todas as URLs em preparo são revogadas.
- [ ] **Given** o componente renderizado duas vezes com os mesmos itens, **When** as URLs de pré-visualização são comparadas, **Then** são as mesmas — nenhuma URL nova é criada por renderização.
- [ ] **Given** navegação apenas por teclado, **When** o usuário percorre o campo, **Then** consegue alcançar o botão de escolha e cada "x", e acioná-los (RNF-16, CT-94).
- [ ] **Given** um leitor de tela sobre as miniaturas, **When** um "x" é focado, **Then** o nome anunciado identifica a ação e qual imagem (RNF-17, CT-95).
- [ ] **Given** um arquivo de 6 MB ou de tipo não aceito escolhido, **When** a escolha ocorre, **Then** o arquivo é sinalizado como recusado pelo nome e não entra na lista — sem impedir que os demais entrem.
- [ ] **Given** o código do componente, **When** inspecionado, **Then** ele não importa nada de `src/services/api/`.

---

## Dependencies

- **Requires**: nenhuma task desta feature.
- **Blocks**: TASK-FRONTEND-017 (o formulário consome os itens para montar `keepImageIds` e os arquivos).
