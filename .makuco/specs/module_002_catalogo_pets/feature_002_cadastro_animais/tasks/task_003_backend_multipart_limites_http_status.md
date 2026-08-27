# TASK-BACKEND-003 — Leitura de `multipart/form-data`, limites de corpo e validação de imagem por assinatura binária

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-003-backend-multipart-limites-http-status`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 3 of 18 — Fundação: Entrada de Arquivos
**Generated**: `2026-08-25`

---

## Context

Hoje o **único** leitor de corpo montado é `express.json({ limit: '10kb' })` — não existe `express.urlencoded`, nem `raw`, nem parser multipart, nem dependência que leia arquivo. Esta task acrescenta a leitura de `multipart/form-data` **restrita às rotas de animal**, os limites que a RN-51 exige e a apuração do formato real por assinatura binária (RN-34), que é o que barra o SVG da RN-53. É trabalho de infraestrutura transversal: mexe em `src/app.ts`, no catálogo de status HTTP e no `package.json`.

---

## Scope

**In:** Dependências de leitura de multipart e de detecção de tipo por conteúdo; middleware de upload com limites próprios; acréscimo de `PAYLOAD_TOO_LARGE` (413) e `UNSUPPORTED_MEDIA_TYPE` (415) ao catálogo de status; subclasses de erro para os dois; utilitário de validação de imagem por assinatura binária; tradução das falhas do parser para o envelope de erro em PT-BR.

**Out:** Não montar o middleware em rota alguma — quem o monta são as TASK-BACKEND-007 e TASK-BACKEND-008. Não falar com o armazenamento de objetos (TASK-BACKEND-004). Nenhuma regra de negócio de animal: aqui a validação é de **arquivo**, não de animal. **Não alterar o `express.json({ limit: '10kb' })` existente** — o teto de 10 KB continua valendo para todas as demais rotas, e isso é item de regressão da spec. Não redimensionar, recortar, comprimir nem rotacionar imagem (fora de escopo declarado); em particular, **não** instalar `sharp`.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Corpo maior que o permitido (RN-51) | `RequestBodyTooLargeError` → `413 REQUEST_BODY_TOO_LARGE` |
| Imagem acima de 5 MB (RN-32) | `AnimalImageTooLargeError` → `413 ANIMAL_IMAGE_TOO_LARGE` |
| Formato não aceito (RN-31, RN-34, RN-53) | `AnimalImageTypeNotAllowedError` → `415 ANIMAL_IMAGE_TYPE_NOT_ALLOWED` |
| Arquivo vazio (RN-54) | `ValidationError` com `code` `VALIDATION_ERROR` e mensagem "O arquivo enviado está vazio." |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `package.json` | multer e file-type |
| `modify` | `src/shared/http/http-status.ts` | acrescenta 413 e 415 |
| `modify` | `src/shared/errors/http-errors.ts` | subclasses 413 e 415 |
| `create` | `src/infra/upload/upload-limits.ts` | limites numéricos nomeados |
| `create` | `src/infra/upload/image-signature.ts` | tipo real por conteúdo |
| `create` | `src/middlewares/upload-animal-images.middleware.ts` | leitura de multipart |
| `create` | `src/domains/animals/errors/animal-image.errors.ts` | erros de imagem |

---

## Implementation

> **Reference pattern**: `src/middlewares/validate-request.middleware.ts` mostra como um middleware traduz falha de entrada em erro de domínio sem montar corpo de resposta; `src/shared/errors/http-errors.ts` mostra que a subclasse fixa **apenas** o `statusCode` e recebe `code` de quem lança. `src/middlewares/error-handler.middleware.ts` continua sendo o **único** ponto que monta corpo de erro — nenhum arquivo desta task responde diretamente.

### `package.json` *(modify)*
- Acrescentar `multer` (leitura de multipart, armazenamento **em memória**) e `file-type` (assinatura binária), mais `@types/multer` em desenvolvimento.
- Armazenamento em memória, e não em disco: o contêiner tem sistema de arquivos efêmero e o arquivo seguiria direto para o armazenamento de objetos de qualquer forma — gravar em `/tmp` só criaria lixo e um caminho de falha a mais.
- **Não** instalar `sharp` nem qualquer biblioteca de processamento de imagem.
- `file-type` recente é ESM puro; se o `ts-jest`/CommonJS do projeto não o resolver, fixar a última versão CommonJS em vez de mudar o formato de módulo do backend inteiro — mudar o módulo é decisão de arquitetura fora desta task.

### `src/shared/http/http-status.ts` *(modify)*
- Acrescentar `PAYLOAD_TOO_LARGE: 413` e `UNSUPPORTED_MEDIA_TYPE: 415`, mantendo a ordem numérica crescente do objeto.
- O comentário do arquivo declara que a lista é curta de propósito, com um código por regra que a aplicação realmente produz: as duas regras passam a existir agora, e nenhuma outra entrada é acrescentada "por completude".

### `src/shared/errors/http-errors.ts` *(modify)*
- Duas subclasses no mesmo formato das existentes, recebendo `message` e `code` do chamador: `PayloadTooLargeError` (413) e `UnsupportedMediaTypeError` (415).

### `src/infra/upload/upload-limits.ts` *(create)*
- Constantes nomeadas, um único ponto de verdade consumido pelo middleware, pelos services e pelos testes: `MAX_IMAGES_PER_ANIMAL = 5`, `MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024`, `MAX_REQUEST_BODY_BYTES` dimensionado para cinco imagens de 5 MB **mais** os campos de texto e a sobrecarga das fronteiras do multipart (usar `MAX_IMAGES_PER_ANIMAL * MAX_IMAGE_SIZE_BYTES + 1 MB`, não um `26214400` mágico).
- `ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const`.

### `src/infra/upload/image-signature.ts` *(create)*
- `detectImageMimeType(buffer: Buffer): Promise<'image/jpeg' | 'image/png' | null>` — lê os bytes iniciais com `file-type` e devolve `null` para qualquer outra coisa.
- A decisão vem **exclusivamente** do conteúdo. A extensão do nome e o `mimetype` declarado na parte multipart são controlados por quem envia e não entram na decisão em nenhuma hipótese (RN-34).
- `null` para SVG é o comportamento correto e é o objetivo da regra: SVG não tem assinatura binária, é XML, e um SVG servido de um balde de leitura pública executaria script no navegador de quem abrisse a imagem (RN-53). Não acrescentar SVG à lista "só para o navegador exibir".
- Buffer vazio (0 byte) devolve `null`; quem chama distingue os dois casos pelo tamanho, para produzir "O arquivo enviado está vazio." em vez de "Apenas imagens JPEG ou PNG são aceitas." (RN-54).

### `src/middlewares/upload-animal-images.middleware.ts` *(create)*
- Exporta um middleware montável apenas nas rotas que aceitam arquivo: `multer({ storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: MAX_IMAGES_PER_ANIMAL + 1, fieldSize: ..., } }).array('images', MAX_IMAGES_PER_ANIMAL + 1)`.
- O limite de arquivos é **`+ 1` de propósito**: o parser precisa aceitar a sexta imagem para que a regra de negócio possa recusá-la com `ANIMAL_IMAGE_LIMIT_EXCEEDED` em PT-BR (RN-50). Cortada pelo parser, a recusa chegaria como erro genérico do multer e o frontend não teria `code` para ramificar.
- Envolver a chamada e traduzir `MulterError` para os erros próprios **antes** de chamar `next`: `LIMIT_FILE_SIZE` → `AnimalImageTooLargeError`; corpo total acima de `MAX_REQUEST_BODY_BYTES` → `RequestBodyTooLargeError`; `LIMIT_UNEXPECTED_FILE` → `ValidationError` com `field` igual ao nome do campo recebido e "Campo não permitido nesta requisição.".
- Sem essa tradução, cinco arquivos de 5 MB produzem exatamente a falha que só aparece em produção: um erro genérico do servidor de borda que o frontend não sabe traduzir (RN-51).
- Rejeitar `Content-Type` que não seja `multipart/form-data` nessas rotas com `UnsupportedMediaTypeError`.
- Não validar quantidade, conteúdo nem regra de negócio aqui — isso é do service, porque o limite de cinco vale sobre o **estado final** do animal e o middleware não conhece o animal (RN-50).

### `src/domains/animals/errors/animal-image.errors.ts` *(create)*
- `AnimalImageTooLargeError` (413 / `ANIMAL_IMAGE_TOO_LARGE`), `RequestBodyTooLargeError` (413 / `REQUEST_BODY_TOO_LARGE`), `AnimalImageTypeNotAllowedError` (415 / `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`), `AnimalImageLimitExceededError` (400 / `ANIMAL_IMAGE_LIMIT_EXCEEDED`).
- Cada uma fixa `message` e `code`, sem parâmetro no construtor. Nome da classe = regra violada.
- As mensagens são as literais da tabela "Mensagens ao Usuário" da spec, copiadas caractere a caractere.

---

## Acceptance Criteria

- [ ] **Given** uma rota qualquer que **não** seja de animal, **When** um corpo JSON acima de 10 KB é enviado, **Then** a recusa é exatamente a de antes desta task — o teto de 10 KB permanece intocado (regressão declarada pela spec).
- [ ] **Given** um arquivo de 5 MB exatos, **When** o middleware o processa, **Then** ele passa; **Given** 5 MB + 1 byte, **Then** a falha traduzida é `413 ANIMAL_IMAGE_TOO_LARGE` com "Cada imagem deve ter no máximo 5 MB." (CT-50).
- [ ] **Given** cinco arquivos de 5 MB no mesmo envio, **When** o corpo total excede `MAX_REQUEST_BODY_BYTES`, **Then** a resposta é `413 REQUEST_BODY_TOO_LARGE` com a mensagem de negócio em PT-BR, e **não** uma página ou erro genérico do servidor de borda (CT-54, CA-23).
- [ ] **Given** um SVG com script embutido renomeado para `.jpg` e declarado como `image/jpeg`, **When** `detectImageMimeType` o analisa, **Then** devolve `null` (CT-53, RN-53).
- [ ] **Given** um GIF, um PDF e um executável renomeados para `.jpg` com `mimetype` declarado `image/jpeg`, **When** analisados, **Then** os três devolvem `null` (CT-52, CA-21, RNF-02).
- [ ] **Given** um JPEG válido renomeado para `.txt` com `mimetype` declarado `text/plain`, **When** analisado, **Then** devolve `image/jpeg` — a decisão é do conteúdo, nos dois sentidos (RN-34).
- [ ] **Given** um arquivo de 0 byte, **When** analisado, **Then** o resultado permite distinguir "vazio" de "formato não aceito" (CT-51, RN-54).
- [ ] **Given** seis arquivos válidos, **When** o middleware os processa, **Then** ele **não** corta o sexto — os seis chegam ao service, que é quem recusa com mensagem de negócio (RN-50).
- [ ] **Given** `HTTP_STATUS`, **When** lido, **Then** contém `PAYLOAD_TOO_LARGE: 413` e `UNSUPPORTED_MEDIA_TYPE: 415` e nenhum outro código novo.
- [ ] Nenhum arquivo desta task escreve em `res` — o `error-handler.middleware.ts` continua sendo o único a montar corpo de erro.

---

## Dependencies

- **Requires**: nenhuma task desta feature. Depende apenas do que já existe (`AppError`, `error-handler`, `HTTP_STATUS`).
- **Blocks**: TASK-BACKEND-007 e TASK-BACKEND-008 (montam o middleware e consomem `detectImageMimeType`), TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 9 (4 modificados, 5 criados — dos quais 2 fora da tabela *Files*)

#### Resumo

A apuração de formato por assinatura binária está correta e foi verificada por execução em toda a matriz exigida (RN-34, RN-53, CT-51 a CT-53); a mitigação do GHSA-5v7r-6r5c-r473 sustenta-se e foi comprovada nos dois sentidos. O bloqueio é outro: **falhas do parser que não são `MulterError` escapam para o ramo genérico 500**, contrariando o critério declarado da própria task e o comentário que o arquivo escreve sobre si mesmo.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | major | `src/middlewares/upload-animal-images.middleware.ts` | L204, L209 | requisito / bug | A tradução só intercepta `erro instanceof MulterError`. Falhas do parser entregues como `Error` cru caem em `proximo(erro)` e viram **500 `INTERNAL_ERROR`** + `console.error`. Verificado por execução: `Content-Type: multipart/form-data` **sem `boundary`** → 500; corpo truncado no meio de uma parte → 500; cabeçalho de parte malformado → 500. Origem: `node_modules/multer/lib/make-middleware.js:139-141` (construtor do Busboy lança `Multipart: Boundary not found`) e `:252` (`busboy.on('error')`) | Traduzir também o não-`MulterError`: no callback, qualquer erro que não seja `AppError` vira erro de negócio (`ValidationError` / `UnsupportedMediaTypeError`) antes do `next` |
| 2 | minor | `src/middlewares/upload-animal-images.middleware.ts` | L84-L87 | clean code | O comentário afirma que "NENHUM caminho do parser escape para o ramo generico" e que "um cabecalho multipart hostil ... nao pode produzir 500" — propriedade que o achado #1 desmente por execução | Corrigir o comentário junto com o achado #1; comentário deve ser honesto sobre o que o código garante |
| 3 | minor | `src/middlewares/upload-animal-images.middleware.ts` | L110 | padrão / UX | `LIMIT_FIELD_VALUE` mapeado para `RequestBodyTooLargeError`. Verificado: campo `description` com 20 000 caracteres → 413 "Envie menos imagens ou imagens menores." — orienta o administrador a mexer nas imagens quando o problema é um campo de texto | Mapear `LIMIT_FIELD_VALUE` para `ValidationError` com `field` igual a `erro.field` |
| 4 | minor | `src/middlewares/upload-animal-images.middleware.ts` | L188 | padrão / rastreabilidade | `code` `UNSUPPORTED_MEDIA_TYPE` é o **décimo** código novo; o changelog (L194) enumera exatamente **nove** e a spec não prevê `code` nem texto para Content-Type errado. É também o único `code` desta task escrito como literal inline, enquanto os outros quatro são encapsulados em classe de erro | Manter a decisão (ver Julgamento #4) e **atualizar o changelog**; encapsular numa classe `UnsupportedRequestMediaTypeError` no mesmo formato das demais |
| 5 | minor | `src/domains/animals/animals.messages.ts` | — | escopo / plano | Criado fora da tabela *Files* desta task. `TASK-BACKEND-006` o declara como `create` e instrui explicitamente "As demais entram nos slices de escrita — **não antecipar**"; esta task antecipa 5 chaves de imagem | Manter o arquivo (ver Julgamento #2) e corrigir o plano: `TASK-BACKEND-006` passa a `modify` |
| 6 | minor | — | — | dependência | A justificativa registrada para não atualizar `file-type` está factualmente errada num ponto: `file-type@22` de fato exige `node >=22`, mas **`21.3.1`–`21.3.4` já estão corrigidas** (advisory: `>=13.0.0 <21.3.1`) e declaram `engines.node >= 20`, compatível com o `>=20 <21` do projeto. O bloqueio real é **exclusivamente** ESM, não o engine | Corrigir o comentário de `image-signature.ts:42-46`: o motivo é o formato de módulo, e a linha 21.x corrigida deixa de ser inalcançável no dia em que o backend migrar para ESM |
| 7 | suggestion | `src/domains/animals/animals.messages.ts` | L23 | código morto | `IMAGE_FILE_EMPTY` declarada e não consumida por nenhum arquivo desta fatia | Aceitável como catálogo; consumida pela TASK-BACKEND-007 |
| 8 | suggestion | `src/middlewares/upload-animal-images.middleware.ts` | L136-L138 | testabilidade | A guarda `listenerCount('error') === 0` é ramo inalcançável: `req.is()` e o `is(req, ['multipart'])` do multer usam o mesmo `type-is`/`hasbody`, então o 415 já barra antes. Fica como ramo sem cobertura | Remover a guarda ou documentar como defesa deliberada |
| 9 | suggestion | `src/middlewares/upload-animal-images.middleware.ts` | — | object calisthenics | 215 linhas, acima da diretriz de ~150 por entidade | Extrair a contagem de bytes do corpo para `src/infra/upload/request-body-counter.ts` |

#### A vulnerabilidade da dependência — apuração das três alegações

`npm audit`: 1 moderate, `file-type@16.5.4`, **GHSA-5v7r-6r5c-r473**, faixa `>=13.0.0 <21.3.1`.

**A vulnerabilidade é real e alcançável na versão crua.** Construí um ASF malformado (GUID `30 26 B2 75 8E 66 CF 11 A6 D9` + sub-cabeçalho de tamanho zero) e chamei `fromBuffer` diretamente: **travou indefinidamente** (`timeout 12s`, exit 124). O laço está em `node_modules/file-type/core.js:1076-1103` — com `header.size = 0`, `payload = 0 - 24 = -24`, e `tokenizer.ignore(-24)` devolve a posição exatamente os 24 bytes que `readHeader()` havia avançado: o `while` nunca progride. Não é teórico: um único envio pendura o event loop do processo Node para sempre.

| Alegação | Veredicto | Evidência |
|---|---|---|
| A linha atual de `file-type` é ESM e não resolve sob este Jest | **VERIFICADA** | `file-type@21.3.4` instalado sob alias: `await import()` falhou com `MODULE_NOT_FOUND`. O pacote é `type: module`, **sem `main`**, com `exports` só nas condições `import` / `module-sync` / `default`. Mecanismo provado no emit do `tsc`: com `module: commonjs`, `await import(x)` é rebaixado para `Promise.resolve().then(() => require(x))` — o resolver CJS ignora `exports.import` |
| `file-type@22` exige `node >=22` contra o `>=20 <21` do projeto | **VERIFICADA, porém incompleta** | `22.0.2` → `engines.node >= 22`. Mas `21.3.1`–`21.3.4` estão **fora** da faixa do advisory e declaram `engines.node >= 20` — compatíveis. O engine do v22 não é o bloqueio; ESM é (achado #6) |
| O pré-filtro torna o parser de ASF inalcançável e só **estreita** a entrada | **VERIFICADA nos dois sentidos** | (a) `detectImageMimeType` no mesmo ASF que trava o parser cru devolve `null` em **0 ms** — `image-signature.ts:81-83` retorna antes de `fromBuffer` (L85). (b) O pré-filtro **não alarga nem estreita**: os bytes que ele confere são **idênticos aos próprios checks do `file-type`** — `core.js:140` `check([0xFF, 0xD8, 0xFF])` e `core.js:965` os 8 bytes do PNG. Comparei `fromBuffer` cru contra `detectImageMimeType` em toda a matriz e em buffers sintéticos com prefixo aceito: nenhuma divergência |

**Conclusão**: a mitigação sustenta-se e é adequada. O `file-type` continua sendo a decisão final (o arquivo passa pelos dois testes), e nenhuma entrada que não seja JPEG ou PNG alcança qualquer parser da biblioteca. O achado #6 é apenas a correção do registro do motivo. Recomendo anotar a exceção do `npm audit` com esta apuração para que a próxima rodada não reabra a discussão.

#### O ponto de segurança central — verificado por execução

Matriz executada com arquivos construídos por mim, todos com nome e `Content-Type` mentindo sobre o conteúdo:

| Entrada | `file-type` cru | `detectImageMimeType` | Exigido | |
|---|---|---|---|---|
| JPEG real, nome `.txt`, declarado `text/plain` | `image/jpeg` | **`image/jpeg`** | aceito (RN-34) | OK |
| PNG real | `image/png` | **`image/png`** | aceito | OK |
| SVG **com `<script>`**, renomeado `.jpg`, declarado `image/jpeg` | `application/xml` | **`null`** | recusado (CT-53, RN-53) | OK |
| SVG sem prólogo XML, com `<script>` | `undefined` | **`null`** | recusado | OK |
| GIF renomeado `.jpg` | `image/gif` | **`null`** | recusado (CT-52) | OK |
| PDF renomeado `.jpg` | `application/pdf` | **`null`** | recusado (CT-52) | OK |
| Executável ELF renomeado `.jpg` | `undefined` | **`null`** | recusado (CA-21, RNF-02) | OK |
| Arquivo de 0 byte | — | **`null`** (curto-circuito em L75-77) | recusado (CT-51, RN-54) | OK |
| ASF malformado (GHSA) | **trava para sempre** | **`null`** em 0 ms | não alcança o parser | OK |

**SVG não aparece em nenhuma lista de formatos aceitos**: `ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg","image/png"]` (`upload-limits.ts:57`), verificado em tempo de execução contra `/svg|xml/i`. A decisão é exclusivamente do conteúdo, nos dois sentidos.

#### Decisões declaradas — julgamento

**1. `limits.fileSize = MAX_IMAGE_SIZE_BYTES + 1` — ACEITA.** Confirmado no código e por execução. `node_modules/busboy/lib/types/multipart.js:476` é literalmente `if (fileSize === fileSizeLimit)`: o corte dispara quando o contador **atinge** o limite, não quando o ultrapassa. Com o valor cru, um arquivo de exatamente 5 MB seria truncado e recusado, e o CT-50 falharia. Com `+ 1`, 5 MB passa e 5 MB + 1 byte responde `413 ANIMAL_IMAGE_TOO_LARGE` — exatamente o que o critério exige. O comentário de `upload-animal-images.middleware.ts:53-63` descreve o mecanismo com precisão.

**2. `animals.messages.ts` fora da tabela *Files* — ACEITA, com correção no plano.** O invariante existe e tem dois precedentes no repositório (`src/domains/auth/auth.messages.ts`, `src/domains/species/species.messages.ts`); inlinar os literais em `animal-image.errors.ts` violaria o padrão do projeto e espalharia texto de usuário. Porém a `TASK-BACKEND-006` declara o arquivo como `create` e instrui "não antecipar" as mensagens de imagem — **`TASK-BACKEND-006` precisa passar a `modify`** e sua instrução de conteúdo precisa ser ajustada, senão a próxima fatia recria o arquivo e perde estas chaves. Registrado como achado #5.

**3. `tests/unit/upload-animal-images.middleware.spec.ts` fora da tabela *Files* — ACEITA.** Confirmei o argumento: a `TASK-BACKEND-011` puxa da 003 apenas `detectImageMimeType` (`tests/unit/image-signature.spec.ts`) e cobre o middleware só indiretamente pelo contrato HTTP; **nenhuma task do plano possui teste unitário do middleware**. Sem este spec, a tradução de erros — que é o núcleo desta task — ficaria sem exercício. O spec segue AAA, nomes descrevem comportamento, sem lógica condicional no corpo, sem estado mutável compartilhado (cada teste constrói sua própria aplicação).

**4. `code` `UNSUPPORTED_MEDIA_TYPE` com mensagem nova — ACEITA, com dívida de documentação.** A spec não define **nada** para Content-Type errado: o token `UNSUPPORTED_MEDIA_TYPE` não aparece em `spec_context.md` nem no changelog, e todos os 415 da spec são exclusivamente a regra de formato de imagem. Mas a própria task (L82) manda recusar com `UnsupportedMediaTypeError`, e a L65 diz que a subclasse recebe `message` e `code` de quem lança — logo algum código precisa ser inventado. Reusar `ANIMAL_IMAGE_TYPE_NOT_ALLOWED` diria ao frontend que o **arquivo** tem formato errado quando o problema é o **envelope**: seria mentir sobre a regra violada, e o frontend ramifica por `code`. A escolha está certa; falta atualizar o changelog (achado #4).

**5. Recusa por tamanho pelo caminho de erro do multer — ACEITA e comprovada.** `make-middleware.js:56-69` confirma o mecanismo: em `done(err)` o multer chama `drainStream(req)` + `req.resume()` e só então aguarda `end`/`error`/`close` antes do `next(err)`, com o comentário do próprio pacote citando EPIPE. Verifiquei o caminho ponta a ponta em `Transfer-Encoding: chunked` sem `Content-Length` — seis arquivos de 4,5 MB (nenhum estoura o limite por arquivo, a soma estoura o corpo) → **`413 REQUEST_BODY_TOO_LARGE` com a mensagem PT-BR**, sem reset de conexão e sem 500. A rede de segurança do contador por byte funciona, e o `req.pipe(busboy)` síncrono em `make-middleware.js:261` confirma que nenhum pedaço se perde.

#### Verificação especial

| Item | Resultado |
|---|---|
| Nenhuma falha do parser escapa para o 500 | **REPROVADO** — achado #1 |
| Nenhuma linha dos arquivos novos escreve em `res` | OK — `resposta` só é repassada ao handler do multer; `error-handler.middleware.ts` segue como único a montar corpo de erro |
| Middleware não montado em lugar nenhum | OK — `uploadAnimalImages` só é referenciado pelo próprio arquivo e pelo spec |
| `express.json({ limit: '10kb' })` continua o único leitor global | OK — `app.ts:29`, e `src/app.ts` genuinamente intocado (`git status --porcelain` vazio) |
| `app.spec.ts`, auth e species sem mudança de comportamento | OK — as duas modificações em `src/` são **puramente aditivas** (`http-status.ts` +2/-0, `http-errors.ts` +23/-0) |
| `LIMIT_FILE_COUNT` produz mensagem de negócio | OK — 8 arquivos → `400 ANIMAL_IMAGE_LIMIT_EXCEEDED` "É permitido no máximo 5 imagens por animal."; "Too many files" nunca chega ao cliente |
| Seis arquivos não são cortados | OK — os seis chegam ao handler (RN-50) |
| Proibido `any` | OK — nenhuma ocorrência |
| Comentários sem acento | OK — nos 7 arquivos de `src/`. Os acentos do spec acompanham o padrão já vigente nos specs existentes |
| Strings ao usuário idênticas caractere a caractere | OK — as 7 literais conferidas contra `spec_context.md`, todas presentes nos dois lados e em NFC |

#### Gates

`npm run typecheck` exit 0. `npm test` exit 0 — **21 suítes / 278 testes**, 0 falhas (baseline 20/270; a suíte nova traz 8 testes). Banco conferido e **intacto**: `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571. Sondas removidas; `git status` idêntico ao do início da revisão.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 9 de 10 critérios implementados e verificados por execução. O critério "nenhuma falha do parser escapa para o ramo genérico" falha — achado #1.
**Pass 2 — Diff Analysis**: 2 arquivos criados fora da tabela *Files* — achados #5 e #7 (ambos julgados aceitáveis). `src/app.ts` intocado, conforme `Scope — Out`. Nenhum arquivo fora do escopo modificado. Sem formatação em massa.
**Pass 3 — Code Practices**: achados #2, #9. SOLID respeitado: fonte única de limites, erros de domínio sem parâmetro, `image-signature` com responsabilidade única. Sem `else`, sem número mágico, guard clauses corretas. Linguagem ubíqua alinhada (nome da classe = regra violada).
**Pass 4 — Testing Review**: achado #8 (ramo inalcançável). AAA presente, nomes descrevem comportamento, sem condicional no corpo, sem estado compartilhado, cobertura global ≥80% mantida.
**Pass 5 — Security Review**: **A08** (validação de upload por magic bytes) — implementado corretamente e verificado por execução, incluindo o vetor SVG/XSS da RN-53. **A06** (componente vulnerável) — vulnerabilidade real, mitigação verificada e sustentada; achado #6 corrige o registro do motivo. **A05** (misconfiguration) — achado #1 produz `console.error` + 500 a cada requisição malformada, um vetor barato de ruído de log. **A04** — teto de memória correto (`files: 6` × 5 MB limitado pelo teto de corpo de 26 MB, com corte antes de qualquer byte quando o `Content-Length` já excede). Sem A01/A02/A03/A07/A09/A10 aplicáveis: nenhum arquivo desta task toca banco, credencial, log de PII ou URL externa.
**Pass 6 — Bug Detection**: achado #1 (falha não tratada escapando) e #3 (mensagem desalinhada da causa). Sem null/undefined desprotegido, sem race, sem vazamento de recurso (o multer drena e desconecta o busboy), sem coerção insegura, sem `catch` vazio, sem estado parcial.
**Pass 7 — Project Patterns**: achado #4 (código inline fora do padrão de encapsulamento em classe). Estrutura de pastas, nomenclatura, fluxo de dependência e envelope de erro alinhados ao projeto. A referência a `species.errors.ts` no comentário é válida — o arquivo existe em `src/domains/species/errors/species.errors.ts`.

#### Veredicto

> **NECESSITA CORREÇÕES** — 0 critical, 1 major (achado #1), 5 minor, 3 suggestion.
>
> O bloqueio é único e localizado: `src/middlewares/upload-animal-images.middleware.ts` **L204** e **L209**. Falhas do parser que não são `MulterError` — `boundary` ausente, corpo truncado, cabeçalho de parte malformado — chegam ao cliente como `500 INTERNAL_ERROR`, sem `code` para o frontend ramificar, que é precisamente a falha que a RN-51 existe para impedir e que o comentário das L84-L87 afirma estar coberta.
>
> A apuração de formato por assinatura binária, a mitigação do GHSA-5v7r-6r5c-r473, o `+ 1` do `fileSize` e a recusa por tamanho pelo caminho de erro do multer estão **corretos e comprovados por execução** — nenhum deles precisa mudar. Encaminhar ao `makuco-codegen` para o achado #1 (e, na mesma passada, #2, #3, #4 e #6). Corrigir a tabela *Files* da `TASK-BACKEND-006` (`create` → `modify`) e acrescentar `UNSUPPORTED_MEDIA_TYPE` ao changelog antes de fechar a TASK.

---

### Rodada de Revisão 2 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 9 (4 modificados, 5 criados) + 2 arquivos de plano emendados

#### Resumo

O achado `major` da rodada 1 está **fechado e comprovado por execução**: nenhum dos 26 vetores de corpo malformado que construí — os três do parecer anterior mais 23 novos — produz `500`, e todos produzem **zero** `console.error`. A tradução por origem é sólida, e a alegação central sobre a natureza dos erros do parser foi **verificada instrumentando o multer cru**: todo `busboy`/`multer` entrega `Error` **exatamente** (cadeia de protótipo `Error<Object`), nunca subclasse nativa. Restam quatro `minor` e quatro `suggestion`, nenhum bloqueante.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/middlewares/upload-animal-images.middleware.ts` | L134-L137, L172-L174 | robustez / plano | O ramo 3 é uma **lista de exclusão** de quatro construtores nativos, e não uma linha entre origens. Verificado por injeção no mesmo caminho de falha: `Error` cru → **415, logs=0**; `class X extends Error` → **415, logs=0**. Hoje não há caminho vivo (o `memoryStorage` é do próprio multer, não há `fileFilter`), mas a `TASK-BACKEND-004` pluga um adaptador de armazenamento nesta mesma tubulação: um defeito dele sinalizado com `new Error(...)` chegaria ao cliente como 415 **sem uma linha de log** — o inverso exato do bug da rodada 1 | Registrar o invariante no comentário e repassá-lo às 004/007/008: **tudo que rodar dentro da tubulação do multer sinaliza defeito com tipo nativo ou com `AppError`** |
| 2 | minor | `src/middlewares/upload-animal-images.middleware.ts` | L110-L113 | padrão / UX | **Pendência #3 da rodada 1, em aberto e reproduzida**: campo `description` com 200 000 caracteres → `413 REQUEST_BODY_TOO_LARGE` "Envie menos imagens ou imagens menores." O problema é um campo de texto | Mapear `LIMIT_FIELD_VALUE` para `ValidationError` com `field` igual a `erro.field` |
| 3 | minor | `spec_context.md` | — | rastreabilidade | **Pendência #4 da rodada 1, parte em aberto.** `UNSUPPORTED_MEDIA_TYPE` continua ausente da tabela "Mensagens ao Usuário" e do changelog; `git status` confirma `spec_context.md` intocado. A parte de encapsulamento **foi** resolvida (`MultipartBodyRequiredError`) | Fechar antes do encerramento da FEATURE, não desta task — exige autorização para editar `spec_context.md` |
| 4 | minor | `tests/unit/upload-animal-images.middleware.spec.ts` | — | teste | O **contador de bytes** (L217-L219), que é a rede de segurança do envio `chunked`, e os ramos L113-L118 não têm teste na suíte. Cobertura de ramos do arquivo: **69,56%**. Verifiquei os dois por sonda; a suíte não os verifica, então uma regressão futura passa despercebida | Acrescentar um teste `Transfer-Encoding: chunked` sem `Content-Length` (6 × 4,6 MB) — é o único caminho que exercita o contador |
| 5 | suggestion | `src/domains/animals/animals.messages.ts` | L34 | UX | "Envie os dados do animal como multipart/form-data." só é verdade para o `Content-Type` errado. Para corpo truncado, manda trocar um formato que o chamador já usou certo | Texto que cubra os dois lados do envelope |
| 6 | suggestion | `src/middlewares/upload-animal-images.middleware.ts` | L195-L197 | testabilidade | **Achado #8 da rodada 1, inalterado.** Confirmei o mecanismo: a guarda de 415 usa `req.is('multipart/form-data')`, **mais estrita** que o `is(req, ['multipart'])` do multer, então o `next()` silencioso do multer é inalcançável. Ramo sem cobertura (L196) | Manter como defesa deliberada (já documentada) ou remover |
| 7 | suggestion | `src/infra/upload/image-signature.ts` | — | segurança (A08) | A apuração por assinatura aceita **poliglota**: `FF D8 FF` + `<script>alert(1)</script>` → `image/jpeg`; assinatura PNG + lixo → `image/png`. É inerente à RN-34 e **não** é defeito desta task | Repassar à `TASK-BACKEND-004`/`007`: o balde precisa servir com o `Content-Type` **apurado** e `X-Content-Type-Options: nosniff`, e jamais rederivar o tipo de `originalname` |
| 8 | suggestion | — (`src/app.ts`, `Scope — Out`) | — | fora de escopo | JSON acima de 10 KB em rota não-animal → `500 INTERNAL_ERROR` + `console.error` (verificado). É **exatamente** o comportamento anterior a esta task, então o critério de regressão está cumprido; é lacuna pré-existente do projeto, da mesma classe que a RN-51 proíbe nas rotas de animal | Registrar para task futura. **Não corrigir aqui** — `Scope — Out` proíbe tocar no `express.json` |

#### Situação dos achados da rodada 1

| # rodada 1 | Situação | Evidência |
|---|---|---|
| **#1 major** — falha do parser escapando para 500 | **RESOLVIDO** | 26 vetores, nenhum 500, `logs=0` em todos |
| #2 minor — comentário desonesto | **RESOLVIDO** | O comentário L30-L39 agora descreve o que o código de fato garante, e a descrição bate com o comportamento medido |
| #3 minor — `LIMIT_FIELD_VALUE` | **EM ABERTO** | Achado #2 acima |
| #4 minor — `code` inline + changelog | **PARCIAL** | Classe `MultipartBodyRequiredError` criada (encapsulamento OK); changelog em aberto — achado #3 |
| #5 minor — `animals.messages.ts` fora da tabela | **RESOLVIDO** | Tabela *Files* da `TASK-BACKEND-006` emendada `create` → `modify` |
| #6 minor — motivo errado do `file-type` | **RESOLVIDO** | `image-signature.ts:48-59` agora diz que o bloqueio é ESM, que `21.3.1`+ está fora da faixa do aviso e declara `node >= 20` |
| #7 suggestion — `IMAGE_FILE_EMPTY` sem consumidor | Inalterado | Consumida pela `TASK-BACKEND-007` |
| #8 suggestion — guarda `listenerCount` | Inalterado | Achado #6 acima |
| #9 suggestion — 215 linhas | **RESOLVIDO em substância** | 272 linhas, das quais **109 de código** e 163 de comentário/branco; nenhuma função acima de 20 linhas |

#### Vetores de corpo malformado — executados

Os três do parecer anterior, refeitos, e 23 novos construídos por mim. **Nenhum 500. `console.error` = 0 em todos.**

| Vetor | Resultado |
|---|---|
| **V1** `multipart/form-data` sem `boundary` | `415` `UNSUPPORTED_MEDIA_TYPE`, logs=0 |
| **V2** corpo truncado no meio de uma parte | `415` `UNSUPPORTED_MEDIA_TYPE`, logs=0 |
| **V3** cabeçalho de parte malformado (espaço antes dos dois-pontos) | `415` `UNSUPPORTED_MEDIA_TYPE`, logs=0 |
| N1 `boundary=` vazio | `415`, logs=0 |
| N2 `boundary=""` | `200`, 0 arquivos |
| N3 `Content-Type` malformado (`multipart/form-data;;;boundary`) | `415`, logs=0 |
| N4 corpo de 0 byte | `415`, logs=0 |
| N5 apenas o terminador `--B--` | `200`, 0 arquivos |
| N6 corpo sem nenhuma ocorrência da fronteira | `415`, logs=0 |
| N7 parte sem `Content-Disposition` | `200`, 0 arquivos |
| N8 `Content-Disposition` sem `name` | `400` `VALIDATION_ERROR`, campo `images` |
| N9 `CRLF` trocado por `LF` em todo o envelope | `415`, logs=0 |
| N10 bytes nulos binários no corpo da parte | `415`, logs=0 |
| N11 cabeçalho de parte de 100 KB | `415`, logs=0 |
| N12 3 000 pares de cabeçalho numa parte | `415`, logs=0 |
| N13 `Content-Transfer-Encoding: base64` | `200`, 1 arquivo (bytes crus — barrado depois pela assinatura) |
| N14 `boundary` de 200 caracteres | `200`, 1 arquivo |
| N15 nome de campo com 60 níveis de aninhamento | `200`, 0 arquivos |
| N16 `charset` inválido no `Content-Type` | `200`, 1 arquivo |
| N17 5 000 campos de texto | `200` |
| **N18 campo de texto de 200 KB** | `413` `REQUEST_BODY_TOO_LARGE` — **achado #2** |
| N19 `multipart/mixed` | `415`, logs=0 |
| N20 sem `Content-Type` | `415`, logs=0 |
| N21 `filename` com `../../etc/passwd` | `200`; `originalname` chega como **`passwd`** — o multer já remove o caminho |
| N22 duas partes, a segunda truncada | `415`, logs=0 |
| N23 `boundary` com metacaracteres de regex (`a.*+?[]()b`) | `415`, logs=0 |

#### A alegação sobre o ramo 3 — verificada instrumentando o parser cru

Montei um `multer` com **a mesma configuração** do middleware e capturei, para cada vetor, a cadeia de protótipo do erro entregue ao callback:

| Erro entregue | Cadeia de protótipo | `instanceof TypeError/RangeError/ReferenceError/SyntaxError` |
|---|---|---|
| `Multipart: Boundary not found` | `Error<Object` | todos **false** |
| `Unexpected end of form` (4 ocorrências) | `Error<Object` | todos **false** |
| `Malformed part header` (2 ocorrências) | `Error<Object` | todos **false** |
| `Unexpected field` | `MulterError<Error<Object` | todos **false** |
| `Field value too long` | `MulterError<Error<Object` | todos **false** |

Confere com o código-fonte: `busboy/lib/types/multipart.js:233,398,588,605,612`, `busboy/lib/index.js:9,36,53` e `multer/lib/make-middleware.js:120,124,129` usam `new Error(...)` **exatamente**; `multer/lib/multer-error.js:23` faz `util.inherits(MulterError, Error)`, herança direta de `Error`. **A alegação do agente está correta: o parser nunca entrega subclasse nativa de `Error`.**

E o ramo 3 funciona nos dois sentidos, verificado por injeção no mesmo caminho de falha (`requisicao.emit('error', ...)`):

| Erro injetado | Resposta | `console.error` |
|---|---|---|
| `TypeError` | **500 `INTERNAL_ERROR`** | **1** |
| `RangeError` | **500 `INTERNAL_ERROR`** | **1** |
| `ReferenceError` | **500 `INTERNAL_ERROR`** | **1** |
| `SyntaxError` | **500 `INTERNAL_ERROR`** | **1** |
| `Error` cru | 415 `UNSUPPORTED_MEDIA_TYPE` | 0 |
| `class X extends Error` | 415 `UNSUPPORTED_MEDIA_TYPE` | 0 |
| `Error` com `code: 'ECONNRESET'` | 415 `UNSUPPORTED_MEDIA_TYPE` | 0 |

A linha é **real** para o defeito de programação típico e **não** virou `catch` universal. As duas últimas linhas da tabela são o achado #1: é lista de exclusão, não linha de origem.

#### O ramo 1 é necessário — verificado

O `AppError` devolvido intacto é carga estrutural, e não defesa hipotética. Sem ele, o `RequestBodyTooLargeError` que o contador emite em `requisicao` não é `MulterError` nem defeito nativo, e cairia no ramo 4 — o 413 viraria 415.

| Caminho | Resultado |
|---|---|
| `Content-Length` declarado acima do teto (6 × 5 MB) | **`413 REQUEST_BODY_TOO_LARGE`** em PT-BR, logs=0 |
| `Transfer-Encoding: chunked` **sem** `Content-Length` (6 × 4,6 MB = 27,6 MB > 26 MB) | **`413 REQUEST_BODY_TOO_LARGE`** em PT-BR, logs=0, sem reset de conexão |
| `chunked` com 7 × 4 MB (soma abaixo do teto, quantidade acima) | `400 ANIMAL_IMAGE_LIMIT_EXCEEDED` — a regra de negócio ganha do contador, como deve |

#### Recusa por tamanho e matriz de segurança — sem regressão

| Item exigido | Resultado |
|---|---|
| 5 MB exato aceito | **`200`**, `buffer.length = 5242880` |
| 5 MB + 1 byte recusado | **`413 ANIMAL_IMAGE_TOO_LARGE`** "Cada imagem deve ter no máximo 5 MB.", logs=0 |
| SVG com `<script>` (com e sem prólogo XML) | **`null`** |
| GIF, PDF, ELF | **`null`** |
| Arquivo de 0 byte | **`null`** (curto-circuito antes do parser) |
| JPEG real, nome `.txt`, `text/plain` | **`image/jpeg`** — a decisão é do conteúdo nos dois sentidos |
| ASF malformado (GHSA-5v7r-6r5c-r473) | **`null` em 0 ms** — não alcança o parser vulnerável |
| ZIP/JAR, WEBP, TIFF, BMP, GZIP, JPEG truncado em 2 bytes | **`null`** (seis vetores novos) |
| `ALLOWED_IMAGE_MIME_TYPES` | `["image/jpeg","image/png"]` — SVG ausente |

Dois vetores novos passam e **devem** passar, por serem a natureza da RN-34: poliglota `FF D8 FF` + `<script>` → `image/jpeg`, e assinatura PNG + lixo → `image/png`. É achado #7, endereçado ao consumidor do balde, não a esta task.

#### Julgamento do reúso do `code` `UNSUPPORTED_MEDIA_TYPE`

**É honesto.** A regra violada é genuinamente a mesma nos dois casos — o que chegou não é um envelope `multipart/form-data` legível — e, do ponto de vista do frontend, **a ramificação é idêntica**: em nenhum dos dois há campo a marcar, passo a refazer ou dado a corrigir; resta exibir a mensagem. Um `code` distinto por variação do parser ofereceria uma bifurcação que nenhuma tela conseguiria acionar. Inventar `MALFORMED_MULTIPART_BODY` seria o décimo-primeiro código com zero consumidor.

**Dois pontos ficam registrados, ambos sem peso de bloqueio:**

1. O que **de fato** ficou indistinguível não é o `code`, é a **mensagem** (achado #5): "Envie os dados do animal como multipart/form-data" é verdade para quem mandou JSON e é desorientadora para quem mandou multipart e teve o corpo cortado. A população atingida é pequena — corpo truncado quase sempre significa conexão interrompida, e nesse caso a resposta nem chega — mas o texto é o único ponto do envelope em que o reúso mente.
2. `415` para corpo corrompido é defensável (RFC 9110 §15.5.16 admite o 415 decidido por inspeção direta do conteúdo) e é a leitura que já sustenta o `AnimalImageTypeNotAllowedError`. Vale notar a divergência: o próprio `body-parser` do projeto responde `400` para JSON corrompido. Como o projeto não tem código de "corpo malformado" e a task manda usar `UnsupportedMediaTypeError`, a escolha do agente é internamente coerente. **Não reabrir.**

#### Verificação especial

| Item | Resultado |
|---|---|
| Nenhuma falha do parser escapa para o 500 | **OK** — 26 vetores, achado #1 da rodada 1 fechado |
| `src/app.ts` intocado | **OK** — `git status --porcelain src/app.ts` vazio, arquivo byte a byte idêntico |
| `express.json({ limit: '10kb' })` continua o único leitor global | **OK** — `app.ts:29`; não há `urlencoded`, `raw` nem `text` |
| Teto de 10 KB inalterado em rota não-animal | **OK** — JSON de 20 KB em `/api/auth/login` produz a recusa **idêntica** à anterior a esta task (achado #8 registra a lacuna pré-existente) |
| Nenhuma linha dos arquivos da task escreve em `res` | **OK** — a única ocorrência de `resposta.` em todo o conjunto é dentro de um comentário do `http-status.ts` |
| Middleware não montado em rota alguma | **OK** — `uploadAnimalImages` só aparece no próprio arquivo e no spec |
| Emenda da tabela *Files* da `TASK-BACKEND-006` | **OK e correta** — `create` → `modify`; as 8 chaves que a emenda enumera batem **exatamente** com o conteúdo de `animals.messages.ts`, e a instrução "não antecipar" foi reescrita sem introduzir afirmação errada |
| Proibido `any` | OK — nenhuma ocorrência |
| Comentários sem acento nos arquivos de `src/` | OK — nenhum acento em linha de comentário |
| Literais ao usuário conferidas contra a spec | OK — as 6 da tabela "Mensagens ao Usuário" presentes caractere a caractere; a 7ª (`UNSUPPORTED_MEDIA_TYPE`) é a do achado #3 |
| `filename` com travessia de caminho | OK — `../../etc/passwd` chega como `passwd` |

#### Gates

`npm run typecheck` **exit 0**. `npm test` **exit 0** — **21 suítes / 282 testes**, 0 falhas (baseline da rodada 1: 21/278; +4). `npm run test:cov` **exit 0** com os limiares globais de 80% ativos. Banco **não tocado** em nenhum momento: a suíte roda com `DATABASE_URL` apontando para host inalcançável (`tests/setup.ts`) e nenhuma sonda abriu conexão. **Todas as cinco sondas foram apagadas**; `git status` idêntico ao do início desta rodada.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **10 de 10 critérios implementados** e verificados por execução, incluindo o que reprovou na rodada 1. O critério do teto de 10 KB é cumprido estruturalmente (`src/app.ts` intocado) e confirmado por execução.
**Pass 2 — Diff Analysis**: nenhum arquivo novo fora do escopo desde a rodada 1. As duas emendas de plano (`TASK-BACKEND-006`) são corretas. `src/app.ts` e `spec_context.md` intocados. Sem formatação em massa.
**Pass 3 — Code Practices**: achado #9 da rodada 1 resolvido em substância (109 linhas de código). Um nível de indentação por função, sem `else`, sem número mágico, guardas no topo, fonte única de limites. `traduzirFalhaDaLeitura` devolve `unknown` — honesto, porque o ramo 3 devolve o erro original sem estreitar o tipo. Linguagem ubíqua alinhada: `MultipartBodyRequiredError` nomeia a regra violada, não o status.
**Pass 4 — Testing Review**: achados #4 e #6. AAA presente nos quatro testes novos, nomes descrevem comportamento, `jest.restoreAllMocks()` do `tests/setup.ts` desfaz os espiões de `console.error` entre testes (sem vazamento de estado). Os laços `for` de montagem ficam na seção *Arrange*, não em asserção. `image-signature.ts` segue em 0% de cobertura — dívida **planejada**, pertence à `TASK-BACKEND-011`.
**Pass 5 — Security Review**: **A05** — o vetor de ruído de log da rodada 1 está **fechado**: 26 corpos hostis, zero `console.error`. **A08** — validação por magic bytes correta e ampliada (18 vetores); achado #7 repassa a limitação inerente ao consumidor do balde. **A06** — mitigação do GHSA-5v7r-6r5c-r473 reconfirmada (`null` em 0 ms no ASF que trava o parser cru) e o registro do motivo corrigido. **A04** — teto de memória correto nos dois caminhos (`Content-Length` e `chunked`). Achado #1 é defesa em profundidade, não exploração. Sem A01/A02/A03/A07/A09/A10 aplicáveis.
**Pass 6 — Bug Detection**: achados #1 e #2. Sem null/undefined desprotegido; sem race (o contador é montado no mesmo tique do `req.pipe(busboy)`); sem vazamento (`pararDeContar()` roda no callback em todos os caminhos, inclusive de erro); sem coerção insegura (`Number.isFinite` guarda o `Content-Length`); sem `catch` vazio; sem estado parcial.
**Pass 7 — Project Patterns**: nenhum achado novo. `code` inline encapsulado em classe (achado #4 da rodada 1), estrutura de pastas, envelope de erro e fluxo de dependência alinhados. `error-handler.middleware.ts` segue como único ponto que monta corpo de erro.

#### Pendências declaradas — julgamento

- **#3 (`LIMIT_FIELD_VALUE`)** — **não bloqueia**. `description` tem no máximo 1000 caracteres pela spec e o teto do campo é 16 KB: nenhum administrador real alcança o caminho. Passa a ser **dívida das 007/008**, que é onde `description` vira campo de verdade — enquanto ela existir, um texto acima de 16 KB devolve 413 em vez de erro de campo.
- **#4, parte (changelog)** — **não bloqueia esta task**. O `code` e o texto já estão codificados em `animals.messages.ts` com comentário explicando a ausência, e o spec do middleware afirma os dois literalmente. É dívida de rastreabilidade que **bloqueia o encerramento da FEATURE**, não o desta fatia, e depende de autorização para editar `spec_context.md` — que o agente corretamente não tomou por conta própria.

#### Veredicto

> **APROVADA** — 0 critical, 0 major, 4 minor, 4 suggestion.
>
> O bloqueio único da rodada 1 está fechado e a correção foi **verificada por execução independente**, não pelo relato: 26 vetores de corpo malformado, nenhum 500, zero `console.error`; a natureza dos erros do parser confirmada instrumentando o multer cru; os ramos 1 e 3 confirmados necessários e funcionais nos dois sentidos. A apuração por assinatura binária, a recusa por tamanho nos dois caminhos (`Content-Length` e `chunked`) e a mitigação do GHSA seguem corretas e sem regressão.

#### O que as próximas tasks herdam

**`TASK-BACKEND-007` e `TASK-BACKEND-008` (montagem do middleware):**

1. Montar `uploadAnimalImages` **por rota**, nunca em `app.use`. Globalmente, ele mudaria o comportamento de toda rota que hoje só aceita JSON.
2. Montá-lo **antes** do `validate-request`: os campos de `req.body` só existem depois que o multipart foi lido.
3. **Não** envolver o middleware em `try/catch` próprio. Toda falha já chega ao `next` como `AppError` com `code`; qualquer captura extra desfaz a garantia da RN-51.
4. O middleware entrega **até 6 arquivos** de propósito. É o service que recusa o sexto com `AnimalImageLimitExceededError` sobre o **estado final** do animal — o parser só produz esse erro a partir do sétimo.
5. `detectImageMimeType` é a **única** fonte de verdade do formato. Nunca `file.mimetype`, nunca `file.originalname`. E o arquivo de 0 byte distingue-se por `file.size === 0`, **não** pelo retorno `null`: ele produz `MESSAGES.IMAGE_FILE_EMPTY` (RN-54), que é a chave hoje sem consumidor.
6. `animals.messages.ts` **já existe** com 8 chaves — acrescentar, jamais recriar (a `TASK-BACKEND-006` já foi emendada).
7. **Achado #1**: qualquer código que passe a rodar dentro da tubulação do multer (armazenamento customizado da 004, `fileFilter`) precisa sinalizar defeito com tipo nativo ou `AppError` — `new Error(...)` cru vira 415 silencioso.
8. **Achado #2**: `description` acima de 16 KB nunca alcança o validador; devolve 413. Se as 007/008 quiserem mensagem de campo, o achado #2 precisa ser corrigido antes.

**`TASK-BACKEND-004` (armazenamento de objetos):**

9. **Achado #7**: gravar e servir com o `Content-Type` **apurado por `detectImageMimeType`**, mais `X-Content-Type-Options: nosniff`. Um poliglota JPEG+`<script>` passa pela assinatura por definição — o que impede o dano é o balde não deixar o navegador farejar o tipo.
10. Não usar `file.originalname` como chave do objeto. O multer já remove o caminho (`../../etc/passwd` → `passwd`), mas a chave deve ser gerada, não derivada do que o cliente enviou.

**`TASK-BACKEND-011` (suíte de testes):**

11. `tests/unit/image-signature.spec.ts` continua por criar e `image-signature.ts` está em **0% de cobertura**. A matriz mínima é a executada nesta rodada: JPEG real com nome `.txt`, PNG, SVG com `<script>` (com e sem prólogo), GIF, PDF, ELF, 0 byte, poliglota, ASF malformado, ZIP, WEBP, TIFF, BMP, GZIP, JPEG truncado em 2 bytes.
12. **Achado #4**: acrescentar o teste do contador de bytes em `Transfer-Encoding: chunked` sem `Content-Length` — é o único caminho que exercita a rede de segurança, e hoje ela não tem teste.
13. Contrato do 415 a afirmar no teste de integração: `UNSUPPORTED_MEDIA_TYPE` cobre **os dois** casos (Content-Type errado **e** envelope corrompido), e ambos com **zero** `console.error`.
