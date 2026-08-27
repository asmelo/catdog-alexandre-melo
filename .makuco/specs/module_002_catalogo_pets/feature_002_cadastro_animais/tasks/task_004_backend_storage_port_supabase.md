# TASK-BACKEND-004 — Porta de armazenamento de objetos e adaptador do Supabase Storage

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-004-backend-storage-port-supabase`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 4 of 18 — Fundação: Saída de Rede
**Generated**: `2026-08-25`

---

## Context

O backend hoje não faz **nenhuma** chamada HTTP de saída: a única saída de rede além do Postgres é o SMTP, isolado atrás de `MailerPort`. Esta task cria a segunda porta — e a primeira sobre HTTP — no mesmo formato, para que os services de animal nunca conheçam o fornecedor e os testes possam substituí-lo por um duplo (Decisão B). O caminho do objeto é **sempre gerado pela aplicação** (RN-52): o nome do arquivo enviado nunca o compõe.

---

## Scope

**In:** Variáveis de ambiente do armazenamento no `env.ts` e no `.env.example`; dependência do cliente Supabase; interface `ImageStoragePort`; adaptador `SupabaseImageStorage`; gerador do caminho do objeto; duplo em memória para testes.

**Out:** Nenhum service de animal chama a porta aqui (TASK-BACKEND-007 em diante). Nenhuma leitura de imagem passa pela API — o navegador busca o objeto direto no armazenamento pela URL pública, e esta porta **não** ganha método de download. Não gerar URL assinada de escrita para o navegador: a Decisão B descartou explicitamente o envio direto, que tiraria a validação do servidor. Não criar o balde por código — provisionamento é infraestrutura, e a task apenas documenta o que precisa existir.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Armazenamento de objetos | `ImageStoragePort` |
| Caminho do objeto (RN-52) | `buildAnimalImageObjectPath(animalId, imageId, extension)` |
| Armazenamento indisponível (RN-39) | `ImageStorageUnavailableError` → `503 IMAGE_STORAGE_UNAVAILABLE` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `package.json` | cliente do Supabase |
| `modify` | `src/config/env.ts` | variáveis do armazenamento |
| `modify` | `.env.example` | replica as variáveis |
| `modify` | `src/shared/http/http-status.ts` | acrescenta 503 |
| `create` | `src/infra/storage/image-storage.port.ts` | contrato de saída |
| `create` | `src/infra/storage/supabase-image-storage.ts` | adaptador Supabase |
| `create` | `src/infra/storage/object-path.ts` | caminho gerado |
| `create` | `tests/fakes/fake-image-storage.ts` | duplo em memória |

---

## Implementation

> **Reference pattern**: `src/infra/mail/mailer.port.ts` + `src/infra/mail/nodemailer-mailer.ts` são o modelo exato de porta e adaptador, incluindo o estilo do comentário que declara o que o contrato promete e o que não promete. `tests/fakes/fake-mailer.ts` é o modelo do duplo.

### `src/config/env.ts` *(modify)*
**Diferenças em relação ao referencial:**
- Três variáveis novas no bloco do schema: `SUPABASE_URL` (`z.string().url()`), `SUPABASE_SERVICE_ROLE_KEY` (`z.string().min(1)`), `SUPABASE_STORAGE_BUCKET` (`z.string().min(1).default('animal-images')`).
- **Obrigatórias, sem `.optional()`**: a ausência derruba o boot com mensagem legível, que é o comportamento já estabelecido pelo arquivo. Um backend que sobe sem credencial de armazenamento só falha no primeiro cadastro com foto, em produção.
- Este continua sendo o **único** ponto do backend que lê `process.env` — o adaptador recebe `env`, nunca lê `process.env` por conta própria.

### `.env.example` *(modify)*
- Replicar as três com valor de exemplo e **sem segredo real**. `SUPABASE_SERVICE_ROLE_KEY` recebe um placeholder e um comentário de uma linha: é credencial de escrita, vive apenas no servidor e nunca é entregue ao navegador (RNF-04, CA-44).

### `src/shared/http/http-status.ts` *(modify)*
- Acrescentar `SERVICE_UNAVAILABLE: 503`, mantendo a ordem crescente. É o status que a RN-39 produz.

### `src/infra/storage/image-storage.port.ts` *(create)*
- ```ts
  interface StoredImageInput { readonly objectPath: string; readonly content: Buffer; readonly contentType: string; }
  interface ImageStoragePort {
    upload(input: StoredImageInput): Promise<{ readonly publicUrl: string }>;
    remove(objectPaths: ReadonlyArray<string>): Promise<void>;
  }
  ```
- `remove` recebe **lista**: a exclusão de um animal apaga até cinco objetos, e o desfazimento de um envio parcial apaga os que já subiram. Uma remoção por chamada multiplicaria idas à rede no caminho de compensação, que é justamente onde o custo importa.
- O contrato **não** promete leitura: nenhuma imagem passa pela API.
- Declarar no comentário que `upload` rejeita em qualquer falha e que quem chama decide o efeito — na gravação a alteração é desfeita por inteiro (RN-39), na remoção a operação **não** é revertida (RN-40). A porta não decide isso.
- Erro `ImageStorageUnavailableError` (503 / `IMAGE_STORAGE_UNAVAILABLE`, "Não foi possível salvar as imagens. Tente novamente.") declarado aqui ou em `src/domains/animals/errors/animal-image.errors.ts`, junto dos demais erros de imagem — **um** dos dois, não os dois.

### `src/infra/storage/object-path.ts` *(create)*
- `buildAnimalImageObjectPath(animalId: string, imageId: string, contentType: string): string` → `animals/${animalId}/${imageId}${extensaoDoContentType}`.
- A extensão vem do **content type apurado por assinatura** (TASK-BACKEND-003), nunca da extensão do nome enviado.
- O nome do arquivo do administrador **não entra na função** — não é parâmetro. Nomes com `../`, com emoji ou com 300 caracteres não têm como influenciar o caminho porque não chegam até aqui (RN-52, RNF-03, CT-57).
- `animalId` e `imageId` são UUIDs gerados pela aplicação; nenhum é escapado ou saneado, porque nenhum vem de entrada do usuário.

### `src/infra/storage/supabase-image-storage.ts` *(create)*
- Classe `SupabaseImageStorage implements ImageStoragePort`, recebendo o `StorageClient` de `@supabase/storage-js` por injeção no construtor — instanciado uma única vez na composição, não por requisição.

> **Emenda — 2026-08-27 (Revisão 1, achado #1).** Esta linha e o critério de aceite correspondente prescreviam `SupabaseClient` de `@supabase/supabase-js`. **Essa dependência derruba o boot em produção**, e por isso ambas passaram a prescrever `StorageClient` de `@supabase/storage-js`.
>
> **Evidência** — reproduzida de forma independente pelo revisor sob `node v20.20.2`, com `@supabase/supabase-js@2.109.0` instalado limpo: `createClient('https://exemplo.supabase.co', 'chave-falsa')` lança
>
> ```
> Node.js 20 detected without native WebSocket support.
>     at WebSocketFactory.getWebSocketConstructor (websocket-factory.js:103)
>     at RealtimeClient._initializeOptions → new RealtimeClient → _initRealtimeClient → createClient
> ```
>
> **Causa** — `realtime-js/dist/main/lib/websocket-factory.js` L63-69 devolve `type: 'unsupported'` **incondicionalmente** quando `nodeVersion < 22`, e `getWebSocketConstructor` transforma isso em `throw`. Medido: `2.105.0` constrói, `2.109.0` só constrói a partir do Node 23. O `engines` deste serviço é `>=20 <21`, logo a queda é certa, não provável.
>
> **Agravante que precisa estar registrado** — `@supabase/supabase-js@2.109.0` declara `engines: node >=20.0.0`. O `npm install` **não emite aviso algum**: a incompatibilidade não aparece na instalação nem na compilação, só no primeiro `import`, em execução.
>
> **Por que `@supabase/storage-js` serve** — é do mesmo fornecedor e do **mesmo monorepo** (`repository.directory: packages/core/storage-js`, `homepage: github.com/supabase/supabase-js/tree/master/packages/core/storage-js`), declara o **mesmo** `engines: node >=20.0.0` e expõe a mesma API de armazenamento (`from(balde).upload/remove/getPublicUrl`) sem arrastar o `realtime-js` — subsistema que este produto nunca usa. Fixar `supabase-js` em `2.105.0` foi descartado por deixar uma armadilha para o próximo `npm update`, e acrescentar `ws` foi descartado por ser dependência de execução a serviço de um subsistema morto neste produto.
- `upload` usa `upsert: false` e `contentType` explícito. `upsert: false` é intencional: o caminho contém um UUID novo a cada imagem, então colisão significa defeito, e sobrescrever silenciosamente esconderia o defeito.
- Traduzir qualquer erro do cliente para `ImageStorageUnavailableError`. O código de erro do fornecedor não vaza para o service — é isso que mantém o domínio ignorante do Supabase.
- Aplicar tempo limite explícito na chamada (`AbortSignal.timeout`), coerente com o RNF-13, que dá 30 segundos ao envio inteiro. Sem tempo limite, uma requisição pendurada segura a transação do banco.
- `remove` que falha na exclusão **rejeita normalmente**; quem trata a compensação é o service (RN-40).
- Os arquivos vivem **fora do sistema de arquivos do contêiner** (RN-38), que é efêmero e os perderia a cada implantação. Nenhum caminho desta task escreve em disco local, nem como cache.
- Balde com **leitura pública e escrita restrita à credencial de serviço** — registrar como comentário no topo, junto do nome esperado do balde; é pré-requisito de infraestrutura, não código.

### `tests/fakes/fake-image-storage.ts` *(create)*
- Implementação em memória, guardando `Map<objectPath, StoredImageInput>`, com gatilhos de falha programáveis: `failUploadOnNthCall(n)` e `failRemove()`.
- O gatilho por enésima chamada é o que torna o CT-55 executável — falhar ao gravar a **terceira** de cinco imagens e verificar que nada sobra no armazenamento.

---

## Acceptance Criteria

- [ ] **Given** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_STORAGE_BUCKET` ausente, **When** a aplicação inicia, **Then** o boot é derrubado com mensagem legível nomeando a variável faltante.
- [ ] **Given** um arquivo cujo nome é `../../../etc/passwd.jpg`, com emoji e 300 caracteres, **When** o caminho do objeto é gerado, **Then** ele é `animals/<uuid-do-animal>/<uuid-da-imagem>.jpg` e não contém nenhum trecho do nome enviado nem escapa do prefixo do animal (CT-57, CA-27).
- [ ] **Given** um JPEG cujo nome termina em `.png`, **When** o caminho é gerado, **Then** a extensão vem do tipo apurado por assinatura, não do nome.
- [ ] **Given** o armazenamento respondendo erro, **When** `upload` é chamado, **Then** a rejeição é `ImageStorageUnavailableError` com `503 IMAGE_STORAGE_UNAVAILABLE` e "Não foi possível salvar as imagens. Tente novamente." (CT-56).
- [ ] **Given** o adaptador, **When** o código é inspecionado, **Then** ele não lê `process.env` diretamente e nenhum service fora de `src/infra/storage/` importa `@supabase/storage-js` — nem, em hipótese alguma, `@supabase/supabase-js`, cujo `createClient` derruba o boot sob o Node 20 deste serviço (ver a emenda de 2026-08-27 na seção *Implementation*).
- [ ] **Given** o pacote entregue ao navegador e qualquer resposta da API, **When** inspecionados, **Then** não contêm a chave de serviço do armazenamento (CT-96, CA-44).
- [ ] **Given** `ImageStoragePort`, **When** a interface é lida, **Then** ela não possui método de download ou de leitura de imagem.

---

## Dependencies

- **Requires**: TASK-BACKEND-003 (o content type apurado por assinatura é o que define a extensão do caminho).
- **Blocks**: TASK-BACKEND-007, TASK-BACKEND-008, TASK-BACKEND-009 (as três chamam a porta), TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADA — condicionada a duas emendas de TEXTO (nenhuma linha de código a alterar)
**Arquivos revisados**: 15 (4 criados + 3 specs novas + 8 alterados)

#### Resumo

A porta, o adaptador, o gerador de caminho e o dublê estão implementados e cobertos; `typecheck` sai limpo, a suíte fecha em 24 suítes / 314 testes e `src/infra/storage/` está em 100% de statements, branches, funções e linhas. O desvio de dependência (`@supabase/storage-js` no lugar de `@supabase/supabase-js`) foi **verificado de forma independente sob Node 20 e se confirma por inteiro** — a dependência que a task prescreve derruba o boot. Os dois achados que restam são emendas ao **texto** de arquivos de spec, não correções de código.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | major | `.makuco/.../task_004_backend_storage_port_supabase.md` | L86, L106 | requisito / texto da task | A task prescreve `SupabaseClient` de `@supabase/supabase-js`. **Verificado sob Node 20.20.2: `createClient` de `@supabase/supabase-js@2.109.0` lança `Node.js 20 detected without native WebSocket support`** em `getWebSocketConstructor` ← `RealtimeClient._initializeOptions` ← `new RealtimeClient` ← `_initRealtimeClient` ← `createClient`. O `engines` do serviço é `>=20 <21`. A dependência prescrita **derruba o boot em produção**. Agravante: `supabase-js@2.109.0` declara `engines: node >=20.0.0`, ou seja, o `npm install` não emite aviso algum — a falha só aparece no primeiro `import`. Confirmado também que **2.105.0 constrói e 2.109.0 lança**, exatamente como o agente mediu. | **Emendar o texto da task**: trocar `SupabaseClient` / `@supabase/supabase-js` por `StorageClient` / `@supabase/storage-js` em L86 e no CA correspondente (L106), registrando o motivo. O código entregue está **correto e não deve ser alterado**. |
| 2 | major | `.makuco/.../task_007_backend_animals_create_upload.md` | — | requisito (RNF-13) | O teto de 20 s por chamada (`supabase-image-storage.ts` L64) só cabe no orçamento de 30 s do RNF-13 **se os envios forem concorrentes**. O alerta está bem argumentado, mas vive **apenas** no comentário de `TEMPO_LIMITE_MS`. A TASK-BACKEND-007 não menciona `paralelo`, `concorrência`, `RNF-13`, `tempo limite` nem `Promise.all` — verificado por grep, zero ocorrências. A implementação óbvia (laço com `await`) produz 100 s no pior caso, 3,3× acima do RNF-13, e nenhum teste barra isso. | **Emendar o texto da TASK-BACKEND-007** com a restrição explícita: os envios ao armazenamento são concorrentes, e o teto de 20 s por objeto é a premissa que sustenta o RNF-13. Nada a mudar aqui. |
| 3 | minor | `src/infra/storage/image-storage.port.ts` | L52-71 | documentação / precisão | A justificativa de `ImageStorageDefectError extends TypeError` afirma como **fato** que um `new Error(...)` cru "viraria um 415 silencioso". **Isso não procede na fiação atual**: `traduzirFalhaDaLeitura` (`upload-animal-images.middleware.ts` L163-177) só enxerga o que o multer entrega pelo próprio callback; o adaptador roda depois, no handler da rota, e o `next(err)` de lá segue **para frente**, para o `error-handler`, sem nunca reentrar naquele callback. A medida é defensiva inofensiva, mas a afirmação é falsa num código cujos comentários são deliberadamente normativos. | Reescrever o bloco como precaução ("caso um adaptador venha a ser chamado de dentro do pipeline de leitura"), não como consequência. O mesmo vale para o comentário do teste em `supabase-image-storage.spec.ts` L197-207. |
| 4 | minor | `src/domains/animals/errors/animal-image.errors.ts` / `spec_context.md` | L111 / L1056 | linguagem ubíqua | O mesmo conceito tem dois nomes: a porta e o gerador usam `objectPath` / `buildAnimalImageObjectPath`; o modelo Prisma da spec usa `storagePath`. A checklist de linguagem ubíqua proíbe exatamente isso ("um termo com dois nomes diferentes"). Herdado da spec, não introduzido aqui — o agente seguiu a task à risca. | Reconciliar na TASK-BACKEND-007, quando o service ligar os dois lados. Escolher **um** dos dois e registrar no glossário. |
| 5 | minor | `.makuco/.../task_004_backend_storage_port_supabase.md` | L35-47 | escopo / texto da task | A tabela *Files* não lista `src/shared/errors/http-errors.ts`, `src/domains/animals/animals.messages.ts` nem `src/domains/animals/errors/animal-image.errors.ts`, embora a própria seção *Implementation* (L77) autorize explicitamente alojar `ImageStorageUnavailableError` no último — o que torna os outros dois consequência inevitável. Não há scope creep real: nenhum arquivo fora dessa cadeia foi tocado, e `ServiceUnavailableError` (`http-errors.ts` L93-97) é a base mínima para o 503 já previsto em `http-status.ts`. | Completar a tabela *Files* na mesma emenda do achado #1. Decisão declarada nº 1 do agente: **aceita**. |
| 6 | minor | `services/backend/.env` | — | operacional | As três variáveis passaram a ser obrigatórias sem `.optional()` (comportamento correto e exigido pelo CA #1), mas o `.env` real do serviço **não as contém** — verificado, zero ocorrências de `SUPABASE`. O `npm run dev` local passa a morrer no boot até que sejam preenchidas. O arquivo **não foi tocado** por esta entrega nem por esta revisão, o que está certo. | Preencher o `.env` local a partir do `.env.example` antes do próximo `dev`. Não é defeito de código. |
| 7 | minor | `src/infra/storage/supabase-image-storage.ts` | L89-102 | requisito parcial | O CA e a *Implementation* pedem o cliente "instanciado uma única vez na composição". A fábrica existe e o cliente é injetado no construtor (L114-117), mas `createSupabaseStorageClient()` **não é chamada em lugar nenhum** de `src/` — a composição só nasce com o controller de animais. Consistente com o padrão do projeto (`NodemailerMailer` é composto em `auth.controller.ts:286`) e com o *Scope — Out* desta task. | Verificar a instância única na revisão da TASK-BACKEND-007. |
| 8 | suggestion | `src/infra/storage/supabase-image-storage.ts` | L76-77 | robustez | `fetchComTempoLimite` espalha `...opcoes` e **depois** sobrescreve `signal`, descartando qualquer sinal que o chamador tenha passado. Hoje é inerte — verificado no `.d.cts` da 2.109 que `upload(path, fileBody, fileOptions?)` e `remove(paths)` não aceitam `FetchParameters`. Mas `download` e `list` aceitam, e um uso futuro perderia o sinal em silêncio. | Compor os dois sinais (`AbortSignal.any([...])`) em vez de sobrescrever. |
| 9 | suggestion | `src/infra/storage/supabase-image-storage.ts` | L223-233 | tratamento de erro | Um defeito **nosso** que estoure de dentro da chamada ao cliente (argumento malformado levando a `TypeError` na biblioteca) é capturado por `executar` e vira 503 em vez de 500. O agente reconheceu e escolheu conscientemente o outro lado do trade-off, que é o correto: queda de rede é o caso comum e não pode virar 500 sem `code`. Risco residual baixo — `StoredImageInput` é tipado e `content` é `Buffer`. | Nenhuma ação. Registrado por completude. |
| 10 | suggestion | `services/backend/package-lock.json` | — | A06 — dependência nova | `@supabase/storage-js@2.109.0` traz `iceberg-js@0.8.1` (cliente do Apache Iceberg REST Catalog, também da Supabase, MIT) como dependência de **execução**, exigida logo na linha 1 do bundle CJS. Superfície que este produto nunca usa. `npm audit --omit=dev` não reporta advisory algum para ela; a única moderate é a pré-existente do `file-type@16.x`. | Nenhuma ação. Anotar no inventário de dependências. |
| 11 | suggestion | `src/infra/storage/supabase-image-storage.ts` | L116 | injeção de dependência | O parâmetro `bucket` tem valor padrão `env.SUPABASE_STORAGE_BUCKET`, o que acopla a classe ao módulo `env` no import, ainda que não a `process.env`. Divergência leve do padrão do `NodemailerMailer`, onde nada do `env` entra no construtor. | Considerar exigir o balde explicitamente na composição. |

#### Verificações especiais solicitadas

**1. O desvio da dependência — CONFIRMADO.** Reproduzido sob `node v20.20.2` com `@supabase/supabase-js@2.109.0` instalado limpo: `createClient('https://exemplo.supabase.co', 'chave-falsa')` lança `Node.js 20 detected without native WebSocket support.`, com a pilha exata alegada (`getWebSocketConstructor` → `_initializeOptions` → `new RealtimeClient` → `_initRealtimeClient` → `createClient`). O mesmo script com `@supabase/supabase-js@2.105.0` **constrói** e devolve `c.storage` funcional; sob `node v23.10.0` a 2.109 também constrói. A causa está em `realtime-js/dist/main/lib/websocket-factory.js` L63-69: `nodeVersion < 22` retorna `type: 'unsupported'` incondicionalmente, e `getWebSocketConstructor` transforma isso em `throw`. **A alegação do agente é verdadeira em cada detalhe, incluindo os números de versão.** As duas alternativas descartadas estão bem descartadas: fixar 2.105 deixa uma armadilha para o próximo `npm update`, e `ws` é dependência de execução para um subsistema que este produto nunca usa. `@supabase/storage-js` é do mesmo fornecedor e do mesmo monorepo (`homepage: github.com/supabase/supabase-js/tree/master/packages/core/storage-js`) e declara `engines: node >=20.0.0` — compatível com o `>=20 <21` do serviço. **Consequência formal: o texto da task precisa ser emendado (achado #1).**

**2. A armadilha da TASK-003 — resolvida, mas por um caminho que a justificativa descreve errado.** Um defeito do adaptador **vira 500 e não 415**: `ImageStorageDefectError` não é `AppError`, então cai no ramo genérico do `error-handler.middleware.ts` (L60-64), que responde `INTERNAL_SERVER_ERROR` com `console.error` da stack. Isso é verdade **independentemente** de estender `TypeError`, porque o adaptador nunca atravessa `traduzirFalhaDaLeitura` — ver achado #3. A herança é redundância defensiva, não a peça que fecha o buraco.

**3. Sobreposição perigosa entre "defeito nativo nosso" e "falha de rede" — CONFIRMADO QUE NÃO EXISTE.** As duas classificações vivem em regiões disjuntas da pilha e nenhuma consegue ver os erros da outra: `ehDefeitoDeProgramacao` (middleware L136-138) só recebe o que o multer entrega pelo seu callback; `executar` (adaptador L223-233) só recebe o que a chamada ao cliente lança. Além disso, `ImageStorageDefectError` é lançado **fora** do `try` (L161 e L152, depois do `await`), logo não há como ser engolido pelo envelope de 503. O teste `'a falha do fornecedor NÃO é confundida com defeito nosso'` (L220-232) trava o outro sentido, assertando `not.toBeInstanceOf(TypeError)` no 503. A decisão de mandar `TypeError: fetch failed` e `TimeoutError` para 503 está certa: são falhas da conversa, não bugs a corrigir.

**4. Vazamento do código do fornecedor — NÃO VAZA.** `ImageStorageUnavailableError` (`animal-image.errors.ts` L111-115) tem construtor **sem parâmetro**: não há por onde `message`, `statusCode` ou nome de classe do Supabase entrarem. O diagnóstico do fornecedor vai só para `console.error` (adaptador L147, L200, L229). O teste de L145-161 assere `message` sem `Bucket not found`, `code` sem `404` e o par serializado sem `Storage`, usando o `StorageApiError` **real** do pacote — e não um objeto parecido, o que importa porque `__isStorageError` é `protected`.

**5. Boot cai sem credenciais, com mensagem legível — CONFIRMADO.** `env.ts` L95-108 monta `Variaveis de ambiente invalidas. Corrija as chaves abaixo em .env (referencia: .env.example)` seguido de uma linha por chave. Quatro testes novos em `tests/unit/env.spec.ts` cobrem: URL ausente, credencial ausente, URL malformada, **todas as faltantes nomeadas de uma vez** e o default do balde.

**6. A suíte não abre socket — CONFIRMADO EMPIRICAMENTE.** As três specs novas foram reexecutadas com uma sonda que derruba `net.Socket.prototype.connect`, `tls.connect`, `dns.lookup` e `dns.promises.lookup`: **27/27 passaram**, nenhuma tentativa de rede. O `StorageClient` chega dublado por `mockDeep` e o teste de tempo limite espiona `globalThis.fetch` com `mockRejectedValue`. `clearMocks: true` (jest.config) mais `jest.restoreAllMocks()` no `afterEach` de `tests/setup.ts` L125-132 garantem que nem o espião de `fetch` nem o de `console.error` vazem entre testes. **A sonda foi apagada.**

**7. Segredo — LIMPO.** `SUPABASE_SERVICE_ROLE_KEY` no `.env.example` é `cole-aqui-a-service-role-key-do-painel`, com o comentário de uma linha exigido (RNF-04, CA-44). O `.env` real **não foi tocado** — nem pela entrega, nem por esta revisão. `tests/setup.ts` usa `chave-de-teste-sem-valor-real`. Nenhuma ocorrência de `SERVICE_ROLE` ou `service_role` em `services/frontend/` (CA-44 / CT-96 satisfeito no que esta task alcança).

**8. Cliente injetado — SIM (composição pendente).** Construtor recebe `StorageClient` (L114-117); a fábrica é separada (L89-102) e nada dentro da classe lê `process.env`. A instância única na composição fica para a TASK-BACKEND-007 — ver achado #7.

**9. `animals.messages.ts` ACRESCENTADO, não recriado — CONFIRMADO.** O diff é `+3 −0`: três linhas (um comentário de seção, a chave e uma linha em branco). O arquivo tem agora 9 chaves; as 8 da TASK-003 estão todas intactas.

**10. `any` / acentuação — CONFORMES.** Zero ocorrências de `any` nos cinco arquivos novos (fora de `expect.any`, que é API do Jest). `src/infra/storage/*.ts` não contém **nenhum** caractere acentuado nos comentários, e as mensagens ao usuário em `animals.messages.ts` são acentuadas. Os arquivos de `tests/` usam comentários acentuados, seguindo a convenção de fato do diretório (`tests/fakes/restauravel.ts`, `tests/setup.ts`).

#### Decisões declaradas — julgamento

1. **`ServiceUnavailableError` em `http-errors.ts`, fora da tabela *Files*** — **ACEITA**. É a base mínima do 503 que a própria task manda acrescentar em `http-status.ts`, e replica a forma das irmãs do arquivo. A omissão é da tabela, não da decisão (achado #5).
2. **`buildAnimalImageObjectPath` recebe `AllowedImageMimeType` em vez de `string`** — **ACEITA, e é a melhor decisão da entrega**. Elimina o ramo de contingência tornando o caso impossível de exprimir: `Record<AllowedImageMimeType, string>` obriga quem acrescentar um formato a `ALLOWED_IMAGE_MIME_TYPES` a decidir a extensão no mesmo commit, com erro de compilação. Um `string` com fallback produziria objetos sem extensão útil em silêncio. Alinha-se ao *wrap primitives* da Object Calisthenics e ao contrato da TASK-003.
3. **Timeout de 20 s enxertado no `fetch`** — **MECANISMO ACEITO, ALERTA MAL ALOJADO**. Verifiquei o `.d.cts` da 2.109: `upload(path, fileBody, fileOptions?)` e `remove(paths)` **não** aceitam `FetchParameters`, e `FileOptions` tem exatamente `cacheControl`, `contentType`, `upsert`, `duplex`, `metadata`, `headers` — a alegação do agente está correta ao pé da letra, e o `fetch` do cliente é de fato o único ponto de enxerto. `AbortSignal` sobre `Promise.race` é a escolha certa: o race devolveria o controle mas deixaria o socket vivo. **20 s é adequado** — 5 MB em 20 s equivale a ~2 Mbps de upstream, um piso realista, e sob concorrência sobra folga de 10 s no orçamento do RNF-13. O alerta sobre os 100 s em série está bem argumentado, mas **não está bem registrado**: vive só num comentário do adaptador, e a TASK-BACKEND-007 não diz uma palavra sobre concorrência (achado #2).

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 7 de 7 critérios de aceite implementados. O CA #5 é atendido no espírito (nenhum service fora de `src/infra/storage/` importa cliente do Supabase) mas cita o pacote errado — achado #1.
**Pass 2 — Diff Analysis**: Sem scope creep. Nenhum arquivo do *Scope — Out* tocado: nenhum service de animal chama a porta, não há método de download na interface, não há URL assinada de escrita e não há criação de balde por código. Três arquivos alterados fora da tabela *Files*, todos na cadeia autorizada pela *Implementation* — achado #5.
**Pass 3 — Code Practices**: Sem achados de SOLID. DIP exemplar (a porta é a abstração, o cliente é injetado); ISP respeitado (interface de dois métodos, sem leitura); SRP mantido (a porta não decide compensação). Object Calisthenics: uma indentação por método, nenhum `else`, duas variáveis de instância em `SupabaseImageStorage`, nomes sem abreviação, sem magic numbers (`TEMPO_LIMITE_MS` nomeado). Linguagem ubíqua: achado #4.
**Pass 4 — Testing Review**: 27 testes novos, todos AAA explícito, um comportamento por teste, sem condicional em corpo de teste, sem estado mutável compartilhado, dublês criados dentro de cada cenário (`montarCenario()`). Cobertura de `src/infra/storage/` em **100%** nas quatro métricas. Sem achados.
**Pass 5 — Security Review**: Sem achados critical ou major. A02 — nenhum segredo em código; placeholder no `.env.example`; `.env` real intocado; chave ausente do frontend. A05 — o erro do fornecedor não chega ao cliente; o diagnóstico fica no log do servidor. A06 — achado #10 (informativo). A09 — os `console.error` do adaptador registram o objeto de erro cru do cliente; nos modos de falha do `storage-js` isso não carrega cabeçalhos (portanto não carrega a credencial), mas vale manter a vigilância se o fornecedor mudar o formato do erro. A10 — sem SSRF: a URL do armazenamento vem de `env`, nunca de entrada do usuário, e o caminho do objeto é gerado (RN-52).
**Pass 6 — Bug Detection**: Sem null/undefined desprotegido (`data`/`error` verificados explicitamente contra `null`). Sem race condition (sem estado compartilhado no adaptador). Sem vazamento de recurso — o `AbortSignal` de fato aborta a requisição. Sem off-by-one. Sem coerção insegura (`!==`/`===` em todas as comparações). Sem `catch` vazio — todo caminho de erro loga e relança. Lista vazia tratada antes da ida à rede. Achados #8 e #9 (ambos `suggestion`). Uma nota de robustez: `this.client.from(this.bucket)` na L120 fica **fora** do `try`, então um estouro ali escaparia sem tradução — risco desprezível, o método é síncrono e puro.
**Pass 7 — Project Patterns**: Estrutura (`src/infra/<fornecedor>/<porta>.port.ts` + adaptador) idêntica a `src/infra/mail/`. Nomenclatura kebab-case. `~/` usado em todos os imports de produção. Tratamento de erro pelo `AppError` + `error-handler`, sem responder de dentro do adaptador. Logging com o prefixo `[catdog-backend]` já estabelecido. Sem dependência circular: o adaptador importa o erro do domínio; o domínio não importa nada de `src/infra/storage/`. Sem achados.

#### Veredicto

> **APROVADA.** Nenhuma correção de código. Zero achados `critical`; os dois `major` são **emendas de texto** em arquivos de spec, e o código entregue está certo justamente por divergir do que um deles diz:
>
> 1. **O texto desta task precisa ser emendado.** A verificação independente sob Node 20 confirma que `@supabase/supabase-js@2.109.0` — a dependência que L86 e L106 prescrevem — **derruba o boot da aplicação**, e o faz sem que o `npm install` avise, porque o pacote declara `engines: node >=20.0.0`. Trocar por `StorageClient` de `@supabase/storage-js` foi a decisão correta, e é o texto que está errado, não a implementação.
> 2. **O texto da TASK-BACKEND-007 precisa ser emendado** com a exigência de envios concorrentes, sem a qual o teto de 20 s por objeto viola o RNF-13 por 3,3×.
>
> Feitas as duas emendas, a TASK-BACKEND-004 está pronta para fechar.
