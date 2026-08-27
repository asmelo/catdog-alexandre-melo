# TASK-BACKEND-009 — `PATCH /api/animals/:id/status` e `DELETE /api/animals/:id`

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-009-backend-animals-status-delete`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 9 of 18 — Domínio Animais: Status e Exclusão
**Generated**: `2026-08-25`

---

## Context

Fecha a escrita do domínio com duas operações que a spec faz questão de manter separadas do `PATCH` genérico. A alteração de status é **endpoint próprio** (RN-16) porque tem conjunto de campos disjunto do restante do animal — misturá-los obrigaria um único tratador a validar duas gramáticas diferentes e decidir, a cada requisição, qual se aplica. A exclusão é definitiva e apaga também os arquivos do armazenamento (RN-37), com uma exceção deliberada: falha ao apagar arquivo **não** reverte a operação (RN-40).

---

## Scope

**In:** Schema de alteração de status, service de alteração de status com bloqueio otimista, service de exclusão com remoção dos objetos, handlers e rotas dos dois endpoints.

**Out:** Nenhuma transição automática de status. A vinculação entre pedidos e status do animal — marcar Reservado quando um pedido é aberto — pertence ao módulo de pedidos e é explicitamente fora de escopo (RN-17). Nenhuma restrição de ordem entre status (RN-15). Nenhuma inativação, arquivamento, lixeira ou recuperação: a exclusão é definitiva e o status Indisponível atende quem quer só tirar o animal da vitrine (RN-45). Não tocar em espécie nem em cidade. Sem testes (TASK-BACKEND-011).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Alterar status | `ChangeAnimalStatusService.execute()` |
| Excluir animal | `DeleteAnimalService.execute()` |
| Arquivo remanescente (RN-40) | log estruturado com os `objectPath` remanescentes, sem reverter a operação |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/animals/animals.validators.ts` | schema de status |
| `create` | `src/domains/animals/services/change-animal-status.service.ts` | regra de status |
| `create` | `src/domains/animals/services/delete-animal.service.ts` | regra de exclusão |
| `modify` | `src/domains/animals/repositories/animal.repository.ts` | exclusão e status |
| `modify` | `src/domains/animals/animals.controller.ts` | dois handlers |
| `modify` | `src/domains/animals/animals.routes.ts` | duas rotas |

---

## Implementation

> **Reference pattern**: `update-animal.service.ts` (TASK-BACKEND-008) já resolve o bloqueio otimista — `updateIfUnchanged` devolvendo contagem e a distinção `404`/`409` pelo `findById` posterior. Reusar, não reimplementar.

### `src/domains/animals/animals.validators.ts` *(modify)*
- `changeStatusBodySchema` construído com `objetoSemCamposExtras`: `{ status: <um dos quatro valores em minúsculas>, updatedAt: <data e hora ISO> }`. **Não** usar `.strict()`: o `unrecognized_keys` do Zod sai com `path: []` — que o `validationErrorFromZodError` reduz a `field: ""` — e com a mensagem em inglês `"Unrecognized key(s) in object: 'name'"`; são dois defeitos contra a tabela de falhas da spec, que exige `field: "<chave>"` e a frase em PT-BR.
- Este endpoint recebe **`application/json`**, não multipart — é o único de escrita da feature que continua sob o `express.json({ limit: '10kb' })` já existente. Não montar o middleware de upload nele.
- `status` ausente, vazio, nulo, numérico ou fora da lista produz o mesmo `400` com `details: [{ field: "status", message: "Selecione uma opção válida." }]` — os quatro casos, sem ramificação de mensagem (CT-72).
- Qualquer outra chave, inclusive `name`, cai na recusa de `objetoSemCamposExtras` com `details: [{ field: "name", message: "Campo não permitido nesta requisição." }]` (CT-75, RN-46).

### `src/domains/animals/services/change-animal-status.service.ts` *(create)*
- Altera **exclusivamente** o status. Nenhum outro campo do animal é lido do corpo nem gravado (RN-16, CT-69).
- **Qualquer** transição entre os quatro valores é aceita, sem ordem obrigatória e sem confirmação (RN-15). Não implementar máquina de estados — a alternativa de exigir passagem por Reservado antes de Adotado foi descartada **por enquanto**, porque nada coloca um animal em Reservado automaticamente enquanto o módulo de pedidos não existir, e a regra obrigaria o administrador a encenar uma reserva para registrar uma adoção real. A restrição volta à mesa quando o módulo de pedidos existir.
- Enviar o status que o animal **já possui** responde `200` sem efeito colateral — não é erro. A interface, ainda assim, não envia a requisição nesse caso (RN-15, CT-71).
- Bloqueio otimista por `updatedAt`, com a mesma distinção `404`/`409` da edição (RN-47, CT-67).
- Devolve `toAnimalResponse` do animal atualizado.

### `src/domains/animals/services/delete-animal.service.ts` *(create)*
- `findById` ⇒ `null` ⇒ `AnimalNotFoundError` (RN-44, CT-78).
- Coletar os `storagePath` das imagens **antes** de apagar as linhas — depois do `delete` em cascata, não há mais como saber quais objetos remover.
- Apagar o animal; as linhas de `animal_images` vão junto pela cascata declarada no schema (RN-55). Não apagar imagem por imagem à mão: seria duplicar em código uma garantia que já está no banco.
- **Depois do `DELETE`**, chamar `this.images.compensar(caminhos, 'animalExcluido')`. Não há commit a esperar: a exclusão é **um** comando e a cascata é do próprio `DELETE`. Não chamar `imageStorage.remove` direto — `compensar` é o ponto único onde moram o `catch` e a frase de log da RN-40, e a chamada direta à porta duplicaria os dois. Falha aqui **não** reverte nada: registrar log estruturado com os caminhos remanescentes como pendência de limpeza e responder `204` assim mesmo. O **nível** do registro é o de `compensar`, compartilhado com as TASK-BACKEND-007 e 008, e esta task não o fixa. O registro já não existe e nenhum ponto do produto exibe aquela imagem — o produto prefere um arquivo órfão invisível a uma exclusão que falha para o administrador (RN-40, CT-79).
- A espécie e a cidade vinculadas **não** são tocadas em nenhuma hipótese. Excluir animal nunca apaga espécie (RN-10, CT-80, CA-35).
- A exclusão é definitiva: sem coluna de exclusão lógica, sem cópia em outra tabela (RN-45).

### `src/domains/animals/animals.controller.ts` e `animals.routes.ts` *(modify)*
- `changeStatus` → `200` com a representação do animal. `remove` → `204` **sem corpo**.
- `PATCH /:id/status` → `authenticate` → `authorizeRole('admin')` → `validateRequest({ params, body: changeStatusBodySchema })` → handler.
- `DELETE /:id` → `authenticate` → `authorizeRole('admin')` → `validateRequest({ params })` → handler.
- Declarar `PATCH /:id/status` **antes** de `PATCH /:id` no arquivo. A ordem é **defensiva, não load-bearing**: medido no Express 4.22.2, `/:id` casa **um** segmento e não alcança `/abc/status`, então a rota genérica não engoliria a específica hoje. Declarar a mais específica primeiro protege de uma mudança futura no padrão das rotas.

---

## Acceptance Criteria

- [ ] **Given** um animal Disponível, **When** `PATCH /api/animals/:id/status` com `"adotado"` e o `updatedAt` corrente, **Then** `200`, o status gravado é `ADOTADO` e **nenhum outro campo do animal mudou** (CT-69, CA-30).
- [ ] **Given** as doze transições possíveis entre os quatro status, **When** executadas, **Then** todas são aceitas (CT-70, CA-31, RN-15).
- [ ] **Given** o status que o animal já possui, **When** enviado, **Then** `200` sem efeito colateral e sem erro (CT-71).
- [ ] **Given** `"VENDIDO"`, `""`, `null` e `42` como `status`, **When** enviados, **Then** os quatro respondem `400` com `details: [{ field: "status", message: "Selecione uma opção válida." }]` e nada é alterado (CT-72, CA-32).
- [ ] **Given** o corpo contendo `name` além de `status`, **Then** `400` por campo não permitido (CT-75).
- [ ] **Given** o animal alterado por outra pessoa desde a leitura, **When** o status é alterado com o token antigo, **Then** `409 ANIMAL_STALE_UPDATE` e nada é gravado (CT-67).
- [ ] **Given** o animal já excluído, **When** o status é alterado, **Then** `404 ANIMAL_NOT_FOUND` (CT-73, CA-39).
- [ ] **Given** um animal com duas imagens, **When** `DELETE /api/animals/:id`, **Then** `204` sem corpo, o animal e as duas linhas de `animal_images` deixam de existir e os dois objetos são removidos do armazenamento (CT-76, CA-34).
- [ ] **Given** o armazenamento recusando a remoção, **When** a exclusão é processada, **Then** a resposta continua `204`, o animal permanece excluído e os caminhos remanescentes aparecem no log como pendência de limpeza (CT-79, RN-40).
- [ ] **Given** um animal excluído, **When** a sua espécie é consultada, **Then** ela continua cadastrada e inalterada (CT-80, CA-35).
- [ ] **Given** um `id` inexistente, **When** excluído, **Then** `404 ANIMAL_NOT_FOUND`; **Given** um `id` que não é UUID, **Then** `400` apontando o campo `id` (CT-78, CT-92).
- [ ] **Given** requisição sem sessão, **Then** `401`; **Given** role `cliente`, **Then** `403` — nos dois endpoints (CA-40).

---

## Dependencies

- **Requires**: TASK-BACKEND-008 (`updateIfUnchanged` e a distinção `404`/`409`), TASK-BACKEND-004 (`ImageStoragePort.remove`), TASK-BACKEND-006 (repositório, mapper, rotas).
- **Blocks**: TASK-BACKEND-010 (a exclusão de animal é o que libera a exclusão da espécie no CT-83), TASK-FRONTEND-016, TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 9 (2 criados, 7 alterados)

#### Resumo

Os dois endpoints estão implementados e conferem com o contrato da spec (linhas 797-845 de `spec_context.md`) em todos os desfechos medidos: `200`/`400`/`401`/`403`/`404`/`409` na alteração de status e `204`/`400`/`401`/`403`/`404` na exclusão. O invariante que a TASK-BACKEND-008 herdou — toda mutação de `animal_images` passa pela linha de `animals` — foi auditado no repositório e **continua de pé**. Os objetos do armazenamento são de fato removidos na exclusão, a recusa do balde não derruba a resposta, e a trava otimista do status usa a mesma coluna e o mesmo token da edição. Nenhum achado `critical` ou `major`.

Das cinco alegações de que a task não funciona, **as cinco procedem** — todas medidas, nenhuma aceita por afirmação. A exceção do `statusSchema` ao invariante de `""` não só se justifica: ela é **obrigatória**, sob pena de contrariar o CT-72.

#### Medições realizadas

| # | O que foi medido | Como | Resultado |
|---|---|---|---|
| M1 | Invariante de `animal_images` | Varredura de TODAS as mutações Prisma em `animal.repository.ts` | 6 mutações no arquivo: `animal.create` (L444), `animal.updateMany` (L518 edição, L560 **status**), `animal.deleteMany` (L579 **exclusão**), `animalImage.deleteMany` (L595), `animalImage.update` (L603). As 3 de imagem são **as mesmas da 008, inalteradas** pelo diff. A 009 não acrescentou nenhuma mutação de `animal_images`. **Invariante intacto.** |
| M2 | Exclusão feliz, banco real + duplo de balde | Espécie + animal + 2 linhas de `animal_images` criados no Supabase; `DeleteAnimalService` real | Animal apagado; 2 linhas de imagem apagadas pela cascata; `storage.remove` chamado **1 vez** com **exatamente os 2 `storagePath`**; espécie preservada e `updatedAt` dela inalterado |
| M3 | Balde recusando (CT-79, RN-40) | Duplo cujo `remove` rejeita com `ImageStorageUnavailableError` | `execute` **não lançou**; animal **permanece excluído**; **1** registro de log, contendo a frase `...de animal excluido; limpeza pendente` e o payload `{ objectPaths: [2 caminhos] }` |
| M4 | Exclusão de `id` inexistente | UUID válido sem linha | `AnimalNotFoundError` (404) e `remove` **não** chamado |
| M5 | Status: gravação e isolamento (CT-69, CA-30) | Token corrente, `disponivel → adotado` | `status = ADOTADO`; `createdAt` intacto; **os 9 demais campos** intactos; `updatedAt` girou; a linha de imagem sobreviveu |
| M6 | RN-15 / CT-71 — reenviar o mesmo status | Token novo, mesmo `adotado` | Resolve (200), token **girou de novo**, nada além dele mudou |
| M7 | Trava otimista, token vencido (CT-67) | Token pré-alteração | `AnimalStaleUpdateError` (409); linha **byte a byte** igual à anterior; `updateStatusIfUnchanged` chamado direto devolveu **`count = 0`** |
| M8 | 404 vs 409 (CT-73, CA-39) | Status sobre UUID inexistente | `AnimalNotFoundError`, e não conflito |
| M9 | As 12 transições (CT-70, CA-31) | Laço sobre os 4×3 pares, no banco real | **12 de 12 aceitas** |
| M10 | CT-72 — as quatro entradas inválidas | HTTP real (supertest + `app`) com `status` ausente, `""`, `null`, `42` e `"VENDIDO"` | **Os cinco** devolvem `400` com `details: [{ field: "status", message: "Selecione uma opção válida." }]` — mensagem **idêntica, sem ramificação** |
| M11 | CT-75 — chave extra | Corpo com `name` além de `status` | `400` com `details: [{ field: "name", message: "Campo não permitido nesta requisição." }]` |
| M12 | `.strict()` do Zod | `z.object({...}).strict()` com chave extra | `path: []` ⇒ `path.join('.')` = `""`; mensagem `"Unrecognized key(s) in object: 'name'"` — **dois defeitos, confirmados** |
| M13 | `conjuntoFechado` sobre as cinco entradas | Réplica exata do `errorMap` de `animals.validators.ts` L265 | `undefined` e `""` saem como **"Este campo é obrigatório."** — reusá-lo **quebraria o CT-72** |
| M14 | `authorizeRole('ADMIN')` | Substituição **nas linhas de chamada** 183 e 258 (não no comentário) + `tsc --noEmit` | `error TS2345: Argument of type '"ADMIN"' is not assignable to parameter of type '"admin" \| "cliente"'` nas duas linhas. **Restaurado; `git diff --stat` de volta a +84 −2** |
| M15 | Ordem das rotas | Express **4.22.2** (instalado), roteador com `/:id` declarado **antes** de `/:id/status` | `PATCH /abc` → `/:id`; `PATCH /abc/status` → `/:id/status`. `/:id` **não** engole dois segmentos — a ordem **não é load-bearing**, e a medição do agente procede |
| M16 | `DELETE` responde 204 sem corpo | HTTP real | `204`, `text` vazio, **sem `content-type` e sem `content-length`** |
| M17 | CT-92 e CA-40 | `id = "abc"` e sessões ausente/`cliente`, **nos dois endpoints** | `400 field:"id"`; `401 SESSION_EXPIRED`; `403 FORBIDDEN` — 6 de 6 |
| M18 | Estado do banco | Contagens antes e depois da sonda | `users 2, species 0, states 27, cities 5571, animals 0, animal_images 0` — **restaurado**. Sondas apagadas |

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `services/store-animal-images.service.ts` | L331 | requisito (letra da task) | A task pede `warn` **duas vezes** (tabela de Ubiquitous Language e `delete-animal.service.ts` no Implementation). Entregue `console.error`. Medido: o log sai em `console.error`, nunca em `console.warn`. A spec (RN-40, L412; CT-79, L1262) diz apenas "registrado no log", **sem fixar nível**, e o critério de aceite está satisfeito | Emendar o texto da task (ver "Emendas necessárias"). A divergência se sustenta: `compensar` é ponto ÚNICO com um só `console.error` para as três causas — mudar só nesta partiria a política em dois níveis; mudar em todas alteraria comportamento já aprovado nas 007/008. Se a política de log vier a ser formalizada, unificar numa task própria |
| 2 | suggestion | `services/delete-animal.service.ts` | L90-L112 | bug (janela estreita) | Entre o `findById` e o `deleteById` uma edição concorrente pode trocar as imagens do animal. Os `caminhos` coletados seriam os ANTIGOS: os objetos novos ficariam órfãos e a remoção incidiria sobre objetos que a edição já apagou. Janela de milissegundos, dentro da mesma requisição, e a ordem é a que a própria task prescreve | Registrar como pendência conhecida. A alternativa — ler as imagens dentro de uma transação com o `DELETE` — custa outra ida ao pooler `connection_limit=1` para fechar uma janela que não altera resposta nenhuma. Não bloqueia |
| 3 | suggestion | `animals.validators.ts` | L923 | prática de código | `statusSchema` repete a fórmula `z.enum(valores as unknown as [...], { errorMap })` que `conjuntoFechado` (L265) já encapsula. A dupla asserção via `unknown` aparece agora em dois lugares | Extrair um `conjuntoFechadoComMensagemUnica(valores, mensagem)` ao lado de `conjuntoFechado`, deixando a asserção exigida pela assinatura do `z.enum` do Zod 3 em um só ponto |
| 4 | suggestion | `services/delete-animal.service.ts` | — | segurança (A09) | Exclusão definitiva de entidade — mutação destrutiva e irreversível (RN-45) — não emite nenhum registro de auditoria: não há log de "quem excluiu o quê e quando". O único log do caminho é o da falha de limpeza | Consistente com 006/007/008 e com `concerns.md` ("logs da plataforma de hospedagem — solução inicial suficiente"). Fora do escopo desta task; registrar para quando a política de observabilidade for definida |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12 critérios de aceite implementados e verificados** (M2 a M11, M16, M17). Nenhum parcial, nenhum ausente. O `Scope — Out` foi respeitado: não há máquina de estados, não há transição automática, não há exclusão lógica nem lixeira, espécie e cidade não são tocadas, e nenhum teste foi entregue (correto — são da TASK-BACKEND-011). Achado: #1 (letra da task sobre nível de log, sem contrariar critério de aceite).

**Pass 2 — Diff Analysis**: Nenhum achado. Os 6 arquivos do `## Files` foram criados/alterados como indicado. Três arquivos **além** da lista foram tocados, e os três se justificam e são mínimos: `update-animal.service.ts` (+12 −1 — apenas o `export` de `conflitoOuAusencia` e o comentário que explica o reuso, a própria função **não** foi reescrita, como a task manda); `store-animal-images.service.ts` (+20 −5 — a terceira causa `animalExcluido` no tipo fechado, a frase no `Record` e comentário; **`compensar`, `primeiraFalha` e o `Promise.allSettled` não foram tocados**, então as garantias de envio concorrente e de compensação esperando todos da 007/008 não regrediram); `animals.messages.ts` (**só comentário**). Sem formatação em massa, sem scope creep.

**Pass 3 — Code Practices**: Nenhum achado bloqueante. SRP respeitado — cada service tem um caso de uso e um `execute`. DIP respeitado — `ChangeAnimalStatusService` recebe **só** o repositório (não tem acesso a armazenamento, espécie ou cidade, capacidades que a RN-16 lhe nega) e `DeleteAnimalService` recebe as duas portas que usa. Object Calisthenics: um nível de indentação por método via guarda + saída antecipada; **nenhum `else`** nos dois arquivos novos; 1 e 2 variáveis de instância; 148 e 146 linhas com a esmagadora maioria em comentário — os corpos executáveis têm 42 e 56 linhas. `STATUS_PERSISTIDO` como `Record` fechado em vez de `switch` torna um status novo erro de compilação. Sem número mágico, sem literal solto. **Zero `any`** nos 9 arquivos. Comentários sem acento e strings ao usuário com acento: conferido nos dois arquivos novos. Achado: #3.

**Pass 4 — Testing Review**: Não aplicável por escopo — o `Scope — Out` diz "Sem testes (TASK-BACKEND-011)" e nenhum foi entregue, corretamente. A suíte existente continua verde: **24 suítes / 314 testes, 0 falhas**, e `npm run typecheck` (três projetos: build, seed e testes) sai com **exit 0**. Registrado como **dívida rastreada, não como achado**: os dois services novos hoje têm 0% de cobertura, e os CT-69 a CT-80 só existem como medição desta revisão. A TASK-BACKEND-011 tem de cobri-los.

**Pass 5 — Security Review**: Nenhum achado `critical` ou `major`. **A01** — os dois endpoints exigem `authenticate` **antes** de `authorizeRole('admin')` (ordem correta: invertida, o admin também levaria 401) e a autorização é servidor-adentro; medido `401` sem sessão e `403` com role `cliente` nos dois. Não há IDOR: o domínio é administrativo e não tem propriedade por usuário. **A03** — nenhuma interpolação: `updateMany`/`deleteMany` do Prisma são parametrizados; nenhum `queryRaw` no arquivo. O `id` é validado como UUID **antes** do repositório (CT-92 medido). **A05** — o erro devolvido ao cliente é envelope com `code`/`message`, sem stack e sem erro do ORM. **A08** — o `DELETE` não aceita corpo e não desserializa nada. **A09** — logs sem PII, sem segredo e sem token; o payload é `{ objectPaths, motivo }`. Achado: #4 (ausência de log de auditoria da exclusão, `suggestion`). **A04** — sem limitador de taxa no `DELETE`, coberto pela Decisão 14 do changelog; sem token de concorrência no `DELETE`, coberto pelo contrato da spec (o `DELETE` não tem corpo). Nenhum dos dois é achado.

**Pass 6 — Bug Detection**: Lido o conteúdo **integral** dos 9 arquivos, não só o diff. Nenhum bug `major`. Verificados e **descartados**: nulo não tratado (as três guardas de `null`/`count === 0` estão presentes e a segunda no `delete` **não** é redundante — cobre exclusão concorrente entre a leitura e o comando, medido em M4); engolimento de erro (o único `catch` é o da RN-40, deliberado e com log); coerção insegura (não há `==` nos arquivos novos); lógica invertida (`count === 0` medido nos dois sentidos, M7 e M12); estado inconsistente (a exclusão tem **um só** comando de escrita, e a cascata é do banco). Achado: #2 (janela estreita entre leitura e `DELETE`, `suggestion`).

**Pass 7 — Project Patterns**: Nenhum achado. Estrutura e nomes seguem `services/<verbo>-<entidade>.service.ts` das 006/007/008. Fluxo de dependência respeitado: controller → service → repositório → Prisma, **sem inversão** — o controller **não acessa Prisma** (o `prisma` aparece só na fábrica `createAnimalsController`, que é a raiz de composição já estabelecida) e chama **exatamente um** service por handler; o **repositório não lança erro HTTP** (`updateStatusIfUnchanged` e `deleteById` devolvem contagem, `findById` devolve `null`). Tratamento de erro pelo `error-handler.middleware.ts`, como todo desfecho do projeto. Ubiquitous language da task honrada: `ChangeAnimalStatusService.execute()` e `DeleteAnimalService.execute()` existem com esses nomes. Alias `~/` e proibição de `any` respeitados (`conventions.md`).

#### As cinco alegações — veredicto individual

| # | Alegação | Veredicto | Evidência |
|---|---|---|---|
| 1 | `.strict()` produz `field: ""` **e** mensagem em inglês | **PROCEDE — os dois defeitos** | M12: `path: []` e `"Unrecognized key(s) in object: 'name'"`. O `objetoSemCamposExtras` entregue produz `field: "name"` com a frase PT-BR (M11), que é o que a tabela de falhas da spec exige |
| 2 | `authorizeRole('ADMIN')` não compila (TS2345) | **PROCEDE** | M14, medido **nas linhas de chamada 183 e 258**, não no comentário. O aviso do agente sobre a primeira ocorrência textual estar num comentário é correto e foi respeitado |
| 3 | Não há commit a esperar; `compensar` em vez de `storage.remove` | **PROCEDE** | A exclusão é **um** comando (`deleteMany`, L579) e a cascata é do próprio `DELETE` (schema L247, `onDelete: Cascade`). Não há `$transaction` a comitar. E `compensar` é de fato o ponto único do `catch` + frase de log da RN-40 — chamar `storage.remove` direto duplicaria os dois |
| 4 | Nível `warn` mantido como `console.error` | **DIVERGÊNCIA CONSCIENTE — ACEITA** | Ver achado #1. A spec não fixa nível; o CT-79 exige que "os caminhos apareçam no log", e M3 mostra que aparecem, com os `objectPaths`. O argumento do ponto único se sustenta na leitura do código |
| 5 | A ordem `/:id/status` antes de `/:id` não é falsa, é não load-bearing | **PROCEDE** | M15, medido no Express **4.22.2** instalado, com a declaração invertida. E a task foi cumprida à letra assim mesmo: L181 (`/:id/status`) antes de L222 (`/:id`) |

#### O ponto de tensão — julgado

O invariante do projeto ("`""` conta como ausente") **não se aplica aqui, e a exceção é obrigatória, não preferencial**.

M13 mede o que aconteceria com o reuso de `conjuntoFechado`: `status` ausente e `status: ""` sairiam como **"Este campo é obrigatório."**, enquanto `null`, `42` e `"VENDIDO"` sairiam como "Selecione uma opção válida.". Isso é **exatamente a ramificação que o CT-72 e a tabela de falhas da spec (L813) proíbem** — os quatro casos têm de produzir a mesma `details`. Um `statusSchema` próprio não era uma escolha estética: era o único caminho para o critério de aceite.

E o motivo do invariante desaparece neste endpoint. `conjuntoFechado` ramifica porque os campos do formulário chegam por `multipart/form-data`, onde um `<select>` sem escolha viaja como `""` e é campo não preenchido. Aqui o transporte é `application/json`: `null` chega como `null` e `42` como `42` (medido em M10 — os tipos sobrevivem), não há formulário do outro lado, e qualquer valor fora dos quatro é chamada direta à API. **Exceção justificada.**

#### Verificação especial

| Item | Resultado |
|---|---|
| 27 chaves em `animals.messages.ts`, arquivo não recriado | **Confirmado.** Contadas 27. O `git diff` do arquivo tem **um único hunk** (`@@ -11,8 +11,24 @@`), inteiramente dentro do comentário de cabeçalho: `+18 −2`, nenhuma linha de chave tocada |
| Controller não acessa Prisma e chama exatamente UM service | **Confirmado.** `changeStatus` chama só `this.services.changeAnimalStatus.execute(...)`; `remove` chama só `this.services.deleteAnimal.execute(...)`. `prisma` só na fábrica (L334) |
| Repositório não lança erro HTTP | **Confirmado.** `updateStatusIfUnchanged` → `number`; `deleteById` → `number`. O `deleteMany`/`updateMany` (e não `delete`/`update`) evita o `P2025`, mantendo o desfecho previsto fora do caminho de exceção do ORM |
| `DELETE` responde 204 com corpo vazio | **Confirmado.** M16 — `204`, corpo vazio, sem `content-type` e sem `content-length`. `.send()` sem argumento, e não `.json(...)` |
| Espécie preservada na exclusão do animal | **Confirmado no banco real.** M2 — a espécie continua cadastrada com `name` e `updatedAt` idênticos após a exclusão. As FKs `species` e `city` são `onDelete: Restrict` e apontam **do** animal **para** elas (schema L214/L217): apagar o animal só remove a referência (CT-80, CA-35). Isto é o que libera o CT-83 da TASK-BACKEND-010 |
| Garantias da 007/008 não regrediram | **Confirmado.** `Promise.allSettled` (L226), `primeiraFalha` e o corpo de `compensar` estão **fora do diff**. Envios concorrentes continuam esperando **todos** antes de compensar. Suíte inteira verde |
| Invariante da 008 | **Confirmado por varredura própria** (M1), não por aceitação. A 009 não criou nenhum caminho que altere `animal_images` sem passar pela linha de `animals`: a alteração de status é `data: { status }` sobre uma coluna e **gira** o token; a exclusão remove a própria linha de `animals`. A reconciliação da 008 **permanece válida** |
| Proibido `any`; comentários sem acento; strings ao usuário com acento | **Confirmado** nos 9 arquivos |
| Sondas | **Apagadas.** `sonda-009.ts`, `tests/integration/sonda-009.spec.ts` e os arquivos temporários removidos; `git status` de volta a 7 modificados + 2 não rastreados |
| Branch | **Observação de processo, não achado.** A task declara `feature/TASK-BACKEND-009-...`; o trabalho está em `main`, não commitado — igual a todas as tasks anteriores desta feature (`git log`) |

#### Emendas de texto necessárias na TASK

Todas apoiadas em medição. **Nenhuma emenda é proposta a partir de alegação que não se sustentou.**

1. `## Implementation` → `animals.validators.ts`, 1º item: trocar **"`changeStatusBodySchema` `.strict()`"** por "`changeStatusBodySchema` construído com `objetoSemCamposExtras`". Razão medida (M12): `.strict()` devolve `path: []` — que o `validationErrorFromZodError` transforma em `field: ""` — e mensagem em inglês, contrariando a tabela de falhas da spec, que exige `field: "<chave>"` e a frase PT-BR.
2. `## Implementation` → `animals.controller.ts` e `animals.routes.ts`, 2º e 3º itens: trocar **`authorizeRole('ADMIN')`** por **`authorizeRole('admin')`** nas duas ocorrências. Razão medida (M14): `'ADMIN'` é o literal do enum `UserRole` do banco e não compila contra `AuthRole` (`TS2345`).
3. `## Implementation` → `delete-animal.service.ts`, 3º item: trocar **"Depois do commit, chamar `imageStorage.remove(caminhos)`"** por "Depois do `DELETE`, chamar `this.images.compensar(caminhos, 'animalExcluido')`". Razão: não existe commit — a exclusão é um comando único e a cascata é do próprio `DELETE`; e a política de "engolir a falha e registrar a pendência" da RN-40 tem ponto único em `compensar`.
4. `## Ubiquitous Language`, 3ª linha, **e** `## Implementation` → `delete-animal.service.ts`, 3º item: trocar **"log `warn` estruturado"** por "log estruturado com os `objectPath`", alinhando com a RN-40 da spec, que não fixa nível. **Alternativa igualmente válida:** manter o `warn` no texto e abrir uma task para unificar o nível nas três causas de `compensar` — o que **não** se sustenta é pedir `warn` só neste caminho, porque `compensar` é ponto único compartilhado com as 007/008.

**Emenda opcional (precisão, não correção):** o 4º item de `animals.routes.ts` justifica a ordem "para que o caminho mais específico case primeiro". M15 mostra que, no Express 4.22.2, `/:id` não alcança `/abc/status` — a ordem é correta a manter, mas por robustez futura, não porque a rota genérica engoliria a específica hoje. A **instrução** está certa e foi cumprida; só a **razão** é imprecisa.

#### Veredicto

> **APROVADO** — 12 de 12 critérios de aceite implementados e medidos contra o banco real e contra o `app` HTTP. **0 critical, 0 major.** Um achado `minor` (nível de log divergente da letra da task, sem contrariar a spec nem critério de aceite) e três `suggestion`, nenhum bloqueante. O invariante herdado da TASK-BACKEND-008 foi auditado independentemente e **continua de pé** — a reconciliação de imagens daquela task permanece válida. A TASK pode ser fechada após as emendas de texto acima, que corrigem o **enunciado** e não o código.

---

### Emendas aplicadas — 2026-08-27

Aplicadas ao **enunciado** desta task (`## Ubiquitous Language` e `## Implementation`), sem tocar no código aprovado:

| # | Onde | O que mudou |
|---|---|---|
| 1 | `## Implementation` → `animals.validators.ts`, 1º e 4º itens | `.strict()` → `objetoSemCamposExtras`, com a razão medida (`path: []` ⇒ `field: ""` **e** mensagem em inglês) |
| 2 | `## Implementation` → rotas, 2º e 3º itens | `authorizeRole('ADMIN')` → `authorizeRole('admin')`, nas **duas** ocorrências |
| 3 | `## Implementation` → `delete-animal.service.ts`, 3º item | "Depois do commit, chamar `imageStorage.remove`" → "Depois do `DELETE`, chamar `this.images.compensar(caminhos, 'animalExcluido')`" |
| 4 | `## Ubiquitous Language`, 3ª linha, **e** `## Implementation` → `delete-animal.service.ts`, 3º item | "log `warn` estruturado" → "log estruturado com os `objectPath`". O nível fica com `compensar`, ponto único compartilhado com as TASKs 007 e 008, e **não** é fixado por esta task. Alternativa registrada e descartada: manter `warn` no texto e abrir task para unificar as três causas |
| opcional | `## Implementation` → rotas, 4º item | A **instrução** (declarar `/:id/status` antes de `/:id`) permanece; só a **razão** foi corrigida — medido no Express 4.22.2, `/:id` casa um segmento e não engole `/abc/status`, então a ordem é defensiva, não load-bearing |

**Achado #3 (`suggestion`) resolvido no código.** A dupla asserção `as unknown as` foi **eliminada nos dois pontos** — `statusSchema` (L902) e `conjuntoFechado` (L265) —, sem `any` e sem mudança de comportamento: o `z.enum` do Zod 3.25.76 tem sobrecarga para tupla imutável (`<U extends string, T extends Readonly<[U, ...U[]]>>(values: T) => ZodEnum<Writeable<T>>`), então o `readonly` das constantes é aceito direto e o tipo resultante é o mesmo que a asserção produzia. Não foi necessário extrair `conjuntoFechadoComMensagemUnica`: sem asserção, não há mais fórmula a compartilhar, e o `statusSchema` continua separado — como o CT-72 exige. Razão registrada em comentário no próprio `statusSchema`, para que a asserção não volte. Gate: `npm run typecheck` exit 0 e **24 suítes / 314 testes**, sem alteração de baseline.

Comentários de código que citavam o texto da task (`animals.routes.ts` L169 e L251, `animals.validators.ts` L923) tiveram o tempo verbal ajustado para apontar a emenda; nenhuma outra linha de código foi tocada. Achados #2 e #4 permanecem abertos como `suggestion`, por decisão de escopo.

