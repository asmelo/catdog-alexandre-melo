# TASK-FRONTEND-013 — Camada de API do domínio, tipos e catálogo de textos

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-013-frontend-api-layer-textos`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 13 of 18 — Fundação do Frontend
**Generated**: `2026-08-25`

---

## Context

Entrega a camada que as duas telas consomem: uma função por endpoint, os tipos do contrato, os rótulos acentuados dos conjuntos fechados e os textos puramente de interface. É a fatia que traduz `"medio"` do contrato em "Médio" na tela — os rótulos acentuados são responsabilidade da interface, e o contrato trafega em minúsculas e sem acento.

---

## Scope

**In:** `animals-api.ts`, `geography-api.ts`, tipos do domínio, rótulos de porte/sexo/status, novos caminhos de rota e os textos puramente de interface acrescentados ao catálogo existente.

**Out:** Não tratar erro nem guardar estado nas funções de API — elas chamam `request` e devolvem; quem ramifica por `code` é a tela, como já faz `auth-api.ts`. **Não duplicar no catálogo do frontend nenhuma mensagem que o backend devolve** — `ApiError.message` já chega pronto em PT-BR. Não criar endpoint de espécies: a listagem vem da FEATURE-001 e o seu contrato não é alterado. Nenhum componente e nenhuma tela (TASK-FRONTEND-014 em diante).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Porte / Sexo / Status no contrato | `'pequeno' \| 'medio' \| 'grande'`, `'macho' \| 'femea'`, `'disponivel' \| 'reservado' \| 'adotado' \| 'indisponivel'` |
| Rótulos exibidos | `ANIMAL_SIZE_LABELS`, `ANIMAL_SEX_LABELS`, `ANIMAL_STATUS_LABELS` |
| Envelope paginado | `Paginated<T> = { items: T[]; pagination: { page; pageSize; total } }` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/services/api/animals-api.ts` | seis endpoints de animal |
| `create` | `src/services/api/geography-api.ts` | estados e cidades |
| `create` | `src/domains/animals/animal.types.ts` | tipos do contrato |
| `create` | `src/domains/animals/animal-labels.ts` | rótulos acentuados |
| `modify` | `src/utils/messages.ts` | textos de interface |
| `modify` | `src/routes/route-paths.ts` | três caminhos novos |

---

## Implementation

> **Reference pattern**: `src/services/api/auth-api.ts` é o molde exato — uma função por endpoint, sem `try/catch`, sem estado, sem React. `src/utils/messages.ts` já declara a convenção de não reescrever mensagem vinda da API.

### `src/domains/animals/animal.types.ts` *(create)*
- Tipos derivados **do contrato**, não do Prisma: `AnimalSize`, `AnimalSex`, `AnimalStatus` como uniões de literais em minúsculas e sem acento; `Animal`, `AnimalImage`, `AnimalCity`, `AnimalSpecies`; `Paginated<T>`.
- `birthDate: string | null` (`AAAA-MM-DD`) e `ageInYears: number | null`. Os dois nulos são independentes e ambos precisam ser tratados — `ageInYears: null` significa "não informada", nunca zero (RN-21).
- `updatedAt: string` é obrigatório no tipo: é o token de concorrência que a edição e a alteração de status devolvem ao servidor. Torná-lo opcional deixaria a tela compilar sem enviá-lo, e o erro apareceria só como `400` em produção.
- Proibido `any`. `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` estão ligados — indexar `images[0]` produz `AnimalImage | undefined` e isso precisa ser tratado, não silenciado com `!`.

### `src/domains/animals/animal-labels.ts` *(create)*
- Três mapas `as const` de valor do contrato para rótulo acentuado: `medio → "Médio"`, `femea → "Fêmea"`, `disponivel → "Disponível"`, e assim por diante.
- Tipar como `Record<AnimalSize, string>` (e equivalentes) para que acrescentar um valor ao contrato sem acrescentar o rótulo quebre a compilação, em vez de exibir `undefined` na tabela.

### `src/services/api/animals-api.ts` *(create)*
- `listAnimals({ page, pageSize })` → `request<Paginated<Animal>>('/animals' + buildQuery({...}))`.
- `getAnimal(id)` → `request<Animal>(`/animals/${id}`)`.
- `createAnimal(formData: FormData)` → `request<Animal>('/animals', { method: 'POST', body: formData })`.
- `updateAnimal(id, formData: FormData)` → `request<Animal>(..., { method: 'PATCH', body: formData })`.
- `changeAnimalStatus(id, { status, updatedAt })` → `request<Animal>(..., { method: 'PATCH', body: { status, updatedAt } })` — **JSON**, este endpoint não é multipart.
- `deleteAnimal(id)` → `request<void>(..., { method: 'DELETE' })`.
- **A montagem do `FormData` não acontece aqui.** Ela é da tela, que conhece os arquivos em preparo e a ordem das imagens; a função de API apenas transporta. Montá-la aqui obrigaria a camada de API a conhecer o estado do formulário.
- `PATCH` e nunca `PUT`: o CORS em vigor não libera `PUT`.

### `src/services/api/geography-api.ts` *(create)*
- `listStates()` → `request<{ items: State[] }>('/states')`; `listCitiesByState(uf)` → `request<{ items: City[] }>(`/states/${uf}/cities`)`.
- Sem cache e sem memoização: a decisão de descartar respostas fora de ordem é da tela (RN-57), e um cache aqui a esconderia.

### `src/utils/messages.ts` *(modify)*
- Acrescentar **apenas** os textos puramente de interface, copiados caractere a caractere da tabela da spec: `"Carregando cidades..."`, `"Escolha primeiro o estado"`, `"Idade não informada"`, `"Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima."`, `"Não foi possível carregar os animais. Tente novamente."`, `"Não foi possível carregar as cidades. Tente novamente."`, `"Não foi possível atualizar o status. Tente novamente."`, `"Animal cadastrado com sucesso."`, `"Animal atualizado com sucesso."`, `"Status atualizado com sucesso."`, `"Animal excluído com sucesso."`, `"Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)"`, `"Escolher arquivos"`, `"Nenhum arquivo escolhido"`, `"Cadastrar Animal"`, `"Editar Animal"`, `"Animais"`, `"Salvar"`, `"Cancelar"`, e o molde de confirmação `"Excluir o animal “{nome}”? Esta ação não pode ser desfeita."` com as aspas curvas literais.
- Acrescentar as funções de concordância da contagem: zero → `"Nenhum animal cadastrado"`, um → `"Total: 1 animal"`, vários → `"Total: N animais"`. A captura exibe "Total: 1 animais", que é defeito de concordância na própria fonte da verdade e está corrigido por decisão da spec (RN-43).
- **Não** acrescentar: "Animal não encontrado.", "Espécie não encontrada.", "Cidade não encontrada.", "É permitido no máximo 5 imagens por animal.", "Apenas imagens JPEG ou PNG são aceitas.", "Cada imagem deve ter no máximo 5 MB.", "O arquivo enviado está vazio.", "Este animal foi alterado por outra pessoa...", "Não foi possível salvar as imagens...". Todas vêm do backend prontas. Duplicá-las cria duas verdades que divergem no primeiro ajuste de texto.
- Todo texto exibido ao usuário está em PT-BR, sem exceção, incluindo validação e falhas de envio de imagem (RNF-22).
- Exceção justificada: os textos de validação local ("Este campo é obrigatório.", limites de nome e descrição) **entram**, porque a validação de formulário acontece antes de qualquer requisição.

### `src/routes/route-paths.ts` *(modify)*
- `ADMIN_ANIMAIS: '/admin/animais'`, `ADMIN_ANIMAIS_NOVO: '/admin/animais/novo'`, `ADMIN_ANIMAIS_EDITAR: '/admin/animais/:id/editar'`, mais um auxiliar que monta o caminho de edição a partir do id.
- Caminhos de interface em PT-BR e de API em inglês — a captura mostra `/admin/animals/:id/edit`, que diverge do padrão em vigor no produto e foi corrigida por decisão da spec.

---

## Acceptance Criteria

- [ ] **Given** `listAnimals({ page: 2, pageSize: 50 })`, **When** chamada, **Then** a URL requisitada é `/animals?page=2&pageSize=50`.
- [ ] **Given** `createAnimal(formData)`, **When** chamada, **Then** o corpo passado ao cliente é o próprio `FormData` e nenhum `Content-Type` é definido pela camada de API.
- [ ] **Given** `changeAnimalStatus`, **When** chamada, **Then** o corpo é JSON contendo exatamente `status` e `updatedAt` — nenhum outro campo.
- [ ] **Given** qualquer função de `animals-api.ts` recebendo erro, **When** o erro sobe, **Then** ele chega ao chamador como `ApiError` sem ter sido capturado nem reescrito.
- [ ] **Given** o catálogo de mensagens, **When** comparado à tabela da spec, **Then** nenhuma mensagem produzida pelo backend aparece duplicada nele.
- [ ] **Given** as contagens 0, 1 e 2, **When** o rodapé é montado, **Then** produz "Nenhum animal cadastrado", "Total: 1 animal" e "Total: 2 animais" (CT-24, CA-06).
- [ ] **Given** `ANIMAL_STATUS_LABELS`, **When** um valor for acrescentado a `AnimalStatus` sem o rótulo correspondente, **Then** a compilação falha.
- [ ] **Given** o código desta task, **When** verificado pelo TypeScript e pelo ESLint, **Then** não há nenhum `any` e nenhum `!` de asserção de não-nulo.

---

## Dependencies

- **Requires**: TASK-FRONTEND-012 (`FormData` e `buildQuery`), TASK-BACKEND-005 e TASK-BACKEND-006 (contratos publicados).
- **Blocks**: TASK-FRONTEND-016 e TASK-FRONTEND-017.

---

## Revisão — 2026-08-28

**Status**: APROVADO — com um desvio de nomenclatura registrado abaixo

| Critério de aceite | Resultado |
|---|---|
| `listAnimals({ page: 2, pageSize: 50 })` → `/animals?page=2&pageSize=50` | **Confirmado.** Asserção sobre a URL que o `fetch` recebe (`/api/animals?page=2&pageSize=50`), não sobre o caminho lógico |
| `createAnimal` passa o próprio `FormData`, sem `Content-Type` | **Confirmado.** `toBe` sobre o mesmo objeto e `not.toHaveProperty('Content-Type')` |
| `changeAnimalStatus` envia JSON com exatamente `status` e `updatedAt` | **Confirmado** com `toEqual` sobre o corpo inteiro — `toMatchObject` deixaria passar chave extra, que o backend recusa com 400 (CT-75) |
| `ApiError` sobe sem captura nem reescrita | **Confirmado** com `ANIMAL_STALE_UPDATE`: `status`, `code` e `message` chegam como vieram |
| Nenhuma mensagem do backend duplicada no catálogo | **Confirmado por teste**, e não por leitura: `messages.spec.ts` varre os textos do bloco `ANIMALS` (incluindo o que as duas funções produzem) contra os 8 literais do `animals.messages.ts` |
| Contagem 0, 1 e 2 | **Confirmado.** "Nenhum animal cadastrado", "Total: 1 animal", "Total: 2 animais" |
| Rótulo faltando quebra a compilação | **Confirmado por construção:** os três mapas são `Readonly<Record<União, string>>`. Um caso extra cobre o inverso — chave sobrando, que o tipo aceitaria em silêncio |
| Sem `any` e sem `!` | **Confirmado.** `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos; nenhuma asserção de não-nulo nos 6 arquivos |

Suíte do frontend: **344 testes, 23 suítes, 0 falha.**

### Desvio de nomenclatura, deliberado

A task pede as chaves `ADMIN_ANIMAIS`, `ADMIN_ANIMAIS_NOVO` e `ADMIN_ANIMAIS_EDITAR`. Foram criadas como **`ADMIN_ANIMALS_NEW`** e **`ADMIN_ANIMALS_EDIT`**, ao lado do `ADMIN_ANIMALS` que já existia desde a FEATURE-001.

A razão: a regra que a própria task enuncia é "caminhos de interface em PT-BR e de API em inglês", e ela é sobre o **valor** do caminho — que está em PT-BR (`/admin/animais/novo`, `/admin/animais/:id/editar`), como pedido. O **nome da chave** segue outra convenção, em vigor no arquivo inteiro: `ADMIN_HOME`, `ADMIN_SPECIES`, `CHECK_EMAIL`, `CLIENT_HOME`. Adotar `ADMIN_ANIMAIS` criaria a única chave em português do conjunto — e obrigaria a renomear o `ADMIN_ANIMALS` existente, que já tem três consumidores (`admin-layout.tsx` e dois specs).

### Notas de implementação

- `adminAnimalEditPath(id)` acompanha `ADMIN_ANIMALS_EDIT` porque os dois usos do mesmo caminho — declarar a rota (com `:id` literal) e navegar até um animal — são indistinguíveis para o compilador. Sem o auxiliar, `<Navigate to={ROUTE_PATHS.ADMIN_ANIMALS_EDIT}>` compila e leva o usuário a uma página inexistente. Aplica `encodeURIComponent` porque o `id` vem de dado, não de literal.
- `ADMIN_DEFAULT_PATH` **não** foi alterado nesta task. O comentário dele prevê a mudança para animais, mas ela pertence à task que publica a tela — mudá-lo agora apontaria `/admin` para uma rota que ainda não existe.
- `animals-api.spec.ts` não consta da tabela de arquivos da task, e a TASK-FRONTEND-018 também não o prevê. Foi criado porque quatro dos oito critérios de aceite são sobre o que sai no `fetch`, e não há onde verificá-los depois: a 018 dubla as funções de API, então nenhum teste dela observa a URL nem o corpo real. É o mesmo par que a FEATURE-001 já tinha (`species-api.ts` + `species-api.spec.ts`).
