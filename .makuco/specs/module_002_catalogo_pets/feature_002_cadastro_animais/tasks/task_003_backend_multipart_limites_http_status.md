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
