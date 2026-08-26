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
- Classe `SupabaseImageStorage implements ImageStoragePort`, recebendo o `SupabaseClient` por injeção no construtor — instanciado uma única vez na composição, não por requisição.
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
- [ ] **Given** o adaptador, **When** o código é inspecionado, **Then** ele não lê `process.env` diretamente e nenhum service fora de `src/infra/storage/` importa `@supabase/supabase-js`.
- [ ] **Given** o pacote entregue ao navegador e qualquer resposta da API, **When** inspecionados, **Then** não contêm a chave de serviço do armazenamento (CT-96, CA-44).
- [ ] **Given** `ImageStoragePort`, **When** a interface é lida, **Then** ela não possui método de download ou de leitura de imagem.

---

## Dependencies

- **Requires**: TASK-BACKEND-003 (o content type apurado por assinatura é o que define a extensão do caminho).
- **Blocks**: TASK-BACKEND-007, TASK-BACKEND-008, TASK-BACKEND-009 (as três chamam a porta), TASK-BACKEND-011.
