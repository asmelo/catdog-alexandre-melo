# TASK-BACKEND-002 — Listar e criar espécies (`GET` / `POST /api/species`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-species-list-create`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 2 of 11 — Domínio Species: Listagem e Criação
**Generated**: `2026-08-25`

---

## Context

Primeira fatia com endpoint funcional: `GET /api/species` (HU-03) e `POST /api/species` (HU-02), com as regras RN-01 a RN-06, RN-11, RN-12, RN-13 e RN-16. Esta task monta as rotas em `/api/species` e é a **primeira consumidora do `authorizeRole('admin')`** — o middleware existe e está testado desde a FEATURE-002, mas nenhuma rota o montava ainda.

---

## Scope

**In:** Mapper, repositório de `Species`, validadores Zod, os dois services (listar e criar), a fábrica de controller, o arquivo de rotas e a montagem em `src/routes/index.ts`.

**Out:** Nada de renomeação (TASK-BACKEND-003) nem de exclusão (TASK-BACKEND-004) — os métodos de repositório dessas duas operações **não** entram aqui, para que o slice não carregue código morto. Não alterar `prisma/schema.prisma` (TASK-BACKEND-001). Não acrescentar limitador de taxa a nenhuma rota — decisão registrada no changelog (Decisão 7). Não implementar paginação, filtro nem ordenação configurável (RN-12). Não expor `nameNormalized` na API. Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/species/mappers/species.mapper.ts` | projeção pública |
| `create` | `src/domains/species/repositories/species.repository.ts` | acesso a species |
| `create` | `src/domains/species/species.validators.ts` | schemas Zod |
| `create` | `src/domains/species/services/list-species.service.ts` | regra de listagem |
| `create` | `src/domains/species/services/create-species.service.ts` | regra de criação |
| `create` | `src/domains/species/species.controller.ts` | camada HTTP |
| `create` | `src/domains/species/species.routes.ts` | declara rotas |
| `modify` | `src/routes/index.ts` | monta /api/species |

---

## Implementation

> **Reference pattern**: `src/domains/auth/` inteiro é o molde de camadas — `auth.validators.ts`, `repositories/user.repository.ts`, `auth.controller.ts` (fábrica `createAuthController`) e `auth.routes.ts`. O `src/domains/auth/mappers/user.mapper.ts` é o molde do mapper.

### `src/domains/species/mappers/species.mapper.ts` *(create)*
- Interface `PublicSpecies { id; name; createdAt: string; updatedAt: string }` e função `toPublicSpecies(species: Species): PublicSpecies`.
- `nameNormalized` **não** entra na projeção — é detalhe de persistência. Como em `user.mapper.ts`, campo que não existe no tipo não vaza por descuido de serialização.
- Datas saem como ISO-8601 (`.toISOString()`), coerentes com o exemplo da spec (`"2026-08-25T13:40:12.481Z"`). Converter aqui e não deixar para o `res.json` torna o contrato explícito no tipo.

### `src/domains/species/repositories/species.repository.ts` *(create)*
- Interface `SpeciesRepository` no domínio + `PrismaSpeciesRepository` recebendo `Prisma.TransactionClient` no construtor, com `withTransaction(executor)` — mesmo formato de `refresh-token.repository.ts`.
- Métodos **deste slice apenas**: `listAll(): Promise<Species[]>`, `findByNameKey(nameNormalized): Promise<Species | null>`, `create(data: { name; nameNormalized }): Promise<Species>`.
- `listAll` usa `orderBy: { nameNormalized: 'asc' }` — é a RN-11 em uma linha: a coluna já está em minúsculas, então a ordenação do Postgres ignora caixa sem depender de `mode: 'insensitive'` nem de collation do ambiente (CT-13 / CT-14).
- Nada aqui lança erro HTTP; ausência é `null`.
- **Não** declarar `update`, `delete` nem `countAnimalsBySpecies` — eles chegam nas tasks 003 e 004.

### `src/domains/species/species.validators.ts` *(create)*
- `speciesNameSchema`: `z.string()` com `.transform(normalizeSpeciesName)` aplicado **antes** das medições, seguido de `.refine`/`.superRefine` que produzem, nesta ordem de precedência:
  1. vazio após normalizar → `MESSAGES.NAME_REQUIRED` (cobre `""` e `"   "`, CT-02/CT-03);
  2. comprimento < 2 → `MESSAGES.NAME_TOO_SHORT` (CT-04);
  3. comprimento > 60 → `MESSAGES.NAME_TOO_LONG` (CT-07).
  A ordem importa: sem ela, `"   "` reportaria "mínimo 2 caracteres" em vez de obrigatoriedade, contrariando a tabela de mensagens.
- `createSpeciesSchema = z.object({ name: speciesNameSchema }).strict()` — o `.strict()` é o que produz `400 VALIDATION_ERROR` para chave extra no corpo (CT-33), mesmo tratamento já adotado em `registerSchema`. Ajustar a mensagem da chave extra para `MESSAGES.FIELD_NOT_ALLOWED`.
- Tipos derivam por `z.infer`; não criar arquivos de DTO.
- Como o schema já normaliza, o service e o repositório recebem o nome **pronto** — não normalizar de novo em nenhuma camada abaixo.

### `src/domains/species/services/list-species.service.ts` *(create)*
- Classe com `execute(): Promise<ReadonlyArray<PublicSpecies>>`. Dependência única injetada: `SpeciesRepository`.
- Sem argumentos e sem ramo de "lista vazia": cadastro vazio devolve `[]` e o controller responde `200 { items: [] }` — nunca `404` (CT-15).

### `src/domains/species/services/create-species.service.ts` *(create)*
- Dependência injetada: `SpeciesRepository`. `execute(input: { name: string }): Promise<PublicSpecies>`.
- Passos: `chave = speciesNameKey(input.name)` → `findByNameKey(chave)` → se existir, lança `SpeciesNameAlreadyExistsError` (RN-06) → senão `create({ name: input.name, nameNormalized: chave })`.
- **Obrigatório**: envolver o `create` em `try/catch` e traduzir `PrismaClientKnownRequestError` com `code === 'P2002'` para o **mesmo** `SpeciesNameAlreadyExistsError`. Sem isso, duas criações simultâneas do mesmo nome produziriam uma `409` e uma `500` — a RN-16 e o CT-12 exigem que as duas origens do conflito respondam idêntico. A consulta prévia existe para o caso comum; a tradução do `P2002` é a que fecha a janela de corrida.
- Não usar `$transaction`: é uma escrita única e a garantia de unicidade é do índice, não de leitura-e-escrita atômica.
- **Não** usar `new Date()` — `createdAt`/`updatedAt` vêm dos defaults do schema.

### `src/domains/species/species.controller.ts` *(create)*
- Fábrica `createSpeciesController(dependencias?: SpeciesControllerDependencies)` no mesmo formato de `createAuthController()`: instancia repositório e services **uma vez**, na montagem, nunca por requisição.
- Dois handlers finos: `list` → `200 { items }`; `create` → `201` com o `PublicSpecies` **plano** (sem envelope), coerente com a "Representação da espécie" da spec.
- O envelope `{ items }` é aplicado no controller e não no service: é decisão de formato HTTP. Registrar em comentário que este é o **primeiro endpoint de coleção do projeto** e que `{ items: [...] }` passa a ser o padrão de coleção — array puro não admite metadados futuros e a chave `data` não existe em nenhum ponto do contrato atual (Decisão 8 do changelog).
- Sem `try/catch`: `express-async-errors` encaminha ao `error-handler.middleware.ts`, único ponto que monta corpo de erro.

### `src/domains/species/species.routes.ts` *(create)*
- `export const speciesRoutes: Router`.
- Ordem dos middlewares, obrigatória em toda rota do arquivo: `authenticate` → `authorizeRole('admin')` → `validateRequest(...)` → handler. `authorizeRole` **depois** de `authenticate` porque ele lê `req.authUser`; montado antes, ele lança `SessionExpiredError` (401) e a rota nunca autorizaria ninguém.
- `GET /` → `authenticate`, `authorizeRole('admin')`, `controller.list`. Sem `validateRequest`: a rota não aceita corpo, parâmetro nem query (RN-12).
- `POST /` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ body: createSpeciesSchema })`, `controller.create`.
- Comentário obrigatório: **sem limitador de taxa** nesta feature, e por quê (CRUD administrativo autenticado, sem credencial e sem envio de e-mail — Decisão 7).

### `src/routes/index.ts` *(modify)*
- Uma linha: `router.use('/species', speciesRoutes)`, abaixo de `router.use('/auth', authRoutes)`. Nada mais neste arquivo muda.

---

## Acceptance Criteria

- [ ] **Given** sessão de `admin` e três espécies `"Sapo"`, `"Gato"`, `"Cachorro"`, **When** `GET /api/species`, **Then** responde `200 { items: [...] }` na ordem `"Cachorro"`, `"Gato"`, `"Sapo"` (CT-13).
- [ ] **Given** as espécies `"gato"` e `"Cachorro"`, **When** `GET /api/species`, **Then** `"Cachorro"` vem antes de `"gato"` — a ordenação ignora caixa (CT-14 / RN-11).
- [ ] **Given** cadastro vazio, **When** `GET /api/species`, **Then** responde `200 { "items": [] }` — nunca `404` (CT-15).
- [ ] **Given** qualquer resposta dos dois endpoints, **When** o corpo é inspecionado, **Then** nenhum objeto contém a chave `nameNormalized`, e cada espécie traz exatamente `id`, `name`, `createdAt`, `updatedAt`.
- [ ] **Given** `{ "name": "Cachorro" }`, **When** `POST /api/species`, **Then** responde `201` com a espécie criada e o registro persiste com `name_normalized = 'cachorro'` (CT-01).
- [ ] **Given** `{ "name": "" }` ou `{ "name": "   " }`, **When** `POST`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "name", message: "Este campo é obrigatório." }]` e nada é criado (CT-02 / CT-03).
- [ ] **Given** `{ "name": "G" }`, **Then** `400` com "O nome da espécie deve ter no mínimo 2 caracteres." (CT-04); **Given** `{ "name": "Ov" }`, **Then** `201` (CT-05).
- [ ] **Given** nome com exatamente 60 caracteres, **Then** `201` (CT-06); **Given** 61 caracteres, **Then** `400` com "O nome da espécie deve ter no máximo 60 caracteres." (CT-07 / RN-02).
- [ ] **Given** a espécie `"Gato"` já cadastrada, **When** `POST` com `"gato"`, `"GATO"` ou `"  Gato  "`, **Then** `409 SPECIES_NAME_ALREADY_EXISTS` com "Já existe uma espécie com este nome." e a contagem de espécies não muda (CT-08 / CT-09).
- [ ] **Given** `{ "name": " Cão   Pastor " }`, **When** `POST`, **Then** o `name` persistido e devolvido é `"Cão Pastor"`, e a medição de tamanho, a gravação e a comparação de unicidade usaram esse mesmo valor normalizado (CT-10 / RN-03 / CA-07).
- [ ] **Given** `"Réptil"` já cadastrada, **When** `POST` com `"Reptil"`, **Then** `201` — as duas coexistem (CT-11 / RN-05).
- [ ] **Given** duas requisições concorrentes com o mesmo nome, **When** processadas, **Then** exatamente uma responde `201` e a outra responde `409 SPECIES_NAME_ALREADY_EXISTS` — nunca `500` e nunca duas `201` (CT-12 / RN-16 / CA-09).
- [ ] **Given** `{ "name": "Gato", "descricao": "x" }`, **When** `POST`, **Then** `400 VALIDATION_ERROR` apontando a chave extra e nada é criado (CT-33 / RN-13).
- [ ] **Given** requisição sem `Authorization`, **When** `GET` ou `POST /api/species`, **Then** `401 SESSION_EXPIRED` com "Sua sessão expirou. Faça login novamente." (CT-31 / RNF-01).
- [ ] **Given** sessão válida com role `cliente`, **When** `GET` ou `POST /api/species`, **Then** `403 FORBIDDEN` com "Você não tem permissão para acessar este recurso." e nada é criado (CT-30 / RN-01 / CA-18).
- [ ] Todas as respostas de erro dos dois endpoints saem como `{ error: { code, message, details? } }`, montadas exclusivamente pelo `error-handler.middleware.ts` (RNF-11 / CA-22).
- [ ] `GET /api/health` e todas as rotas de `/api/auth` continuam respondendo exatamente como antes.

---

## API Notes

- `GET /api/species` → `200 { items: PublicSpecies[] }`. Sem parâmetros, sem paginação.
- `POST /api/species` — body `{ name }` → `201 PublicSpecies`. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `409 SPECIES_NAME_ALREADY_EXISTS`.
- **Por que `{ items }` e não array puro**: é o primeiro endpoint de coleção do projeto e vira o padrão. Um array puro impede acrescentar metadados sem quebrar quem já consome.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (modelo `Species`, migration, `species.messages.ts`, `species.errors.ts`, `species-name.ts`); FEATURE-002 (`authenticate`, `authorizeRole`, `validateRequest`, `error-handler`, `prisma-client`).
- **Blocks**: TASK-BACKEND-003 e TASK-BACKEND-004 (reusam repositório, controller e `species.routes.ts`), TASK-BACKEND-005 (testes), TASK-FRONTEND-008 (a camada de API consome estes contratos).

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 8 (7 criados + `src/routes/index.ts`), mais os arquivos de referência do domínio `auth`, os middlewares transversais e `shared/errors/`

#### Resumo

Os oito arquivos entregues cumprem os 17 critérios de aceite e respeitam todas as invariantes de arquitetura do projeto. Os quatro desvios declarados pelo agente foram julgados individualmente: **os quatro são aceitos**, um deles (o `.passthrough()`) com a alegação sobre `auth.validators.ts` **verificada e confirmada no código real**. Nenhum achado `critical` ou `major`. Os achados abaixo são de duplicação, superfície inalcançável e precisão de comentário — nenhum bloqueia o fechamento da task.

#### Julgamento dos desvios declarados

**Desvio 1 — `.passthrough()` + `superRefine` no lugar de `.strict()`: ACEITO.**
A alegação sobre o `auth.validators.ts` **confere**. `src/domains/auth/auth.validators.ts` L88-114 traz a função `objetoSemCamposExtras`, que usa exatamente `.passthrough()` + `superRefine` emitindo `unrecognized_keys` com `path: [chave]`, e o comentário L88-94 registra a mesma razão, citando nominalmente esta task. A justificativa técnica também confere na cadeia inteira: `validationErrorFromZodError` (`src/shared/errors/http-errors.ts` L73) monta `field: problema.path.join('.')`, e o `unrecognized_keys` nativo do Zod sai com `path: []` — com `.strict()` a resposta seria `details: [{ field: "" }]`, que contradiz tanto o critério de aceite do CT-33 quanto a tabela de contrato da spec (`spec_context.md` L417: `field: "<chave>"`). O `.strict()` pedido pela task **quebraria** o critério de aceite da própria task. Desvio correto, e a mensagem usada é a `MESSAGES.FIELD_NOT_ALLOWED` exigida. Nada é afrouxado: `.passthrough()` deixa a chave sobreviver ao parse apenas para que o `superRefine` a reprove com o `path` preenchido.

**Desvio 2 — higienização de caracteres invisíveis: ACEITO, com duas ressalvas registradas (achados #2 e #3).**
O **lugar está certo**. `normalizeSpeciesName` (`species-name.ts` L34-36) é o contrato literal da RN-03 — "exatamente duas operações" — e mantê-lo intacto foi a decisão adequada; a higienização vive em `species.validators.ts` L40-44, na borda HTTP, aplicada *antes* daquele contrato. É o mesmo posicionamento que o domínio auth usa para o e-mail (`emailSchema`, `auth.validators.ts` L49-53, normaliza no validador e não no repositório), portanto é padrão de projeto e não invenção.
O **comportamento silencioso é aceitável**: a RN-03 já apara e colapsa espaços em silêncio, então remover um zero-width space não introduz uma categoria nova de surpresa — introduz um caso a mais da mesma categoria. O argumento do agente sobre a mensagem inexistente procede: recusar exigiria um texto fora da tabela "Mensagens ao Usuário", e inventá-lo violaria o contrato literal declarado em `species.messages.ts` L4-5. Remover é o desfecho que corresponde ao que o administrador enxergou ao digitar, e é o que preserva a RN-04, cujo objetivo é justamente impedir duas linhas visualmente idênticas no cadastro.

**Desvio 3 — medir também `speciesNameKey(nome)`: ACEITO. A reutilização da mensagem é adequada.**
A ameaça é real e foi verificada: `'İ'` (U+0130) em `toLowerCase()` produz dois pontos de código (`i` + U+0307) tanto na contagem do JavaScript quanto na do Postgres, então 60 desses caracteres cabem em `name` e estouram `name_normalized VARCHAR(60)` (`prisma/schema.prisma` L118) — sem a segunda medição, uma entrada apenas longa demais viraria `500` em vez de `400`, contrariando a tabela de falhas da spec. A reutilização da `NAME_TOO_LONG` é a escolha correta: é a única mensagem do catálogo para "não cabe em 60", e ela continua verdadeira, porque o nome informado de fato não pode ser gravado dentro do limite. Registrado como achado #6 apenas a imprecisão residual (o usuário digitou 60 e lê "no máximo 60"), sem recomendação de mudança — não existe mensagem melhor dentro do contrato.

**Desvio 4 — `withTransaction` sem consumidor: NÃO É CÓDIGO MORTO. Aceito.**
Não é sequer um desvio: a própria task o exige em `## Implementation`, primeiro item de `species.repository.ts` ("com `withTransaction(executor)` — mesmo formato de `refresh-token.repository.ts`"). É preparação legítima e necessária para a TASK-BACKEND-004: a RN-09 obriga a verificação de vínculo e a exclusão a acontecerem na **mesma** transação, e o método é o que impede que um repositório construído com o client global execute fora dela. Declará-lo depois mudaria a assinatura da interface no meio da feature, com as tasks 003 e 004 já dependendo dela. O padrão é idêntico ao de `user.repository.ts` L34 e `refresh-token.repository.ts` L59.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/domains/species/species.validators.ts` | L123-143 | duplicação | O bloco `.passthrough()` + `superRefine` que recusa chaves extras é uma cópia da função `objetoSemCamposExtras` de `auth.validators.ts` L96-115, com a diferença de checar `chave !== 'name'` em vez de `!(chave in forma)`. A mensagem também está duplicada como literal: `UNEXPECTED_FIELD` (`auth.messages.ts` L39) e `FIELD_NOT_ALLOWED` (`species.messages.ts` L30) têm o mesmo texto. Este é o segundo domínio a precisar do padrão, e a TASK-BACKEND-003 faria a terceira cópia | Promover a fábrica genérica para `~/shared/validation/` e consumi-la nos dois domínios. Não fazer nesta task: a extração toca `src/domains/auth/`, que está fora do escopo declarado |
| 2 | minor | `src/domains/species/species.validators.ts` | L23-40 | segurança / consistência | A classe `CARACTERES_INVISIVEIS` é mais estreita do que o comentário que a acompanha afirma ("caracteres invisíveis que o `\s` não reconhece"). Ficam de fora os controles bidirecionais U+202A-U+202E e os isolates U+2066-U+2069, que também são invisíveis, também escapam ao `\s` e são o vetor real de falsificação visual em lista (um U+202E gravado no nome inverte a exibição do texto seguinte no painel administrativo). A RN-04 continua parcialmente exposta ao mesmo risco de duplicata visualmente idêntica que a remoção existe para fechar | Estender a classe com `\u202A-\u202E` e `\u2066-\u2069`, ou reescrever o comentário para declarar o escopo real ("largura zero e junção", não "invisíveis"). Sem impacto em nenhum critério de aceite |
| 3 | minor | `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/changelog_context.md` | — | processo | A higienização de caracteres invisíveis é comportamento de produção não previsto pela spec e não registrado no changelog da feature, que é o local declarado para decisões fechadas. Hoje ela existe apenas como comentário em `species.validators.ts` L22-38 — quem ler a spec não saberá que o nome gravado pode diferir do enviado por um caractere que o contrato não menciona | Abrir ALT-002 no `changelog_context.md` registrando a decisão, o motivo (RN-04) e o efeito observável. Não é trabalho de código e não bloqueia esta task |
| 4 | minor | `src/domains/species/species.controller.ts` | L84-89 | padrão | O parâmetro `dependencias?` não tem chamador alcançável: `species.routes.ts` L32 sempre invoca `createSpeciesController()` sem argumentos, e a estratégia de teste de rota já estabelecida no projeto (`tests/integration/auth-routes.spec.ts` L8-21) dubla o módulo `~/infra/prisma/prisma-client`, não a fábrica — o comentário daquele arquivo diz explicitamente que "trocar os repositórios exigiria alterar a fábrica, que é código de `src/`". A justificativa do comentário L47-48 ("para que os testes da TASK-BACKEND-005 injetem services") contradiz o padrão vigente. Prescrito pela própria task, portanto não é erro de implementação | Decidir na TASK-BACKEND-005: ou os testes de rota passam a usar o parâmetro, ou ele é removido. Enquanto isso, é superfície pública sem consumidor |
| 5 | suggestion | `src/domains/species/repositories/species.repository.ts` | L62-67 | comentário | O comentário afirma que a ordenação não depende "da collation do ambiente" e vale "em qualquer maquina". Verdadeiro para a insensibilidade a caixa, que é garantida pela coluna já estar em minúsculas; falso para acentos — a posição relativa de "cão" e "cavalo" ainda varia entre collation `C` e ICU/`pt_BR.UTF-8`. A spec não se pronuncia sobre a ordenação de acentuados (RN-11 fala apenas de caixa), então não há violação de regra | Restringir a afirmação do comentário à caixa |
| 6 | suggestion | `src/domains/species/species.validators.ts` | L58-87 | contrato | Duas imprecisões de contagem sem efeito prático: (a) no caso U+0130 o usuário digita 60 caracteres e lê "no máximo 60 caracteres" — é a menos ruim das opções disponíveis no catálogo, ver julgamento do Desvio 3; (b) `nome.length` conta unidades UTF-16 enquanto `VARCHAR(60)` conta caracteres, então nomes com caracteres do plano astral (emoji) são recusados antes do limite real da coluna. A direção do erro é a segura — nunca produz `500` | Nenhuma ação. Registrado para que a TASK-BACKEND-005 não escreva um caso de teste esperando o comportamento oposto |
| 7 | suggestion | `src/domains/species/services/create-species.service.ts` | L37-78 | observabilidade | Criação de espécie é mutação de dado por perfil privilegiado e não emite registro de auditoria (quem criou, quando). Consistente com o resto do projeto, que hoje só tem o `console.error` do error handler, e `concerns.md` registra "logs da plataforma de hospedagem" como solução inicial suficiente — portanto não é divergência de padrão | Nenhuma ação nesta feature. Item para quando o projeto definir estratégia de logging estruturado |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **17 de 17 critérios implementados.** Verificados um a um contra o código:
- Ordenação `"Cachorro" < "Gato" < "Sapo"` e `"Cachorro" < "gato"` (CT-13/CT-14) — `orderBy: { nameNormalized: 'asc' }`, `species.repository.ts` L70.
- Cadastro vazio devolve `200 { items: [] }` (CT-15) — `list-species.service.ts` L26-30 não tem ramo de lista vazia e o controller responde `200` incondicionalmente.
- Nenhuma resposta contém `nameNormalized`; a projeção tem exatamente `id`, `name`, `createdAt`, `updatedAt` — `species.mapper.ts` L20-33, campos enumerados explicitamente.
- `POST` grava `name_normalized` (CT-01), precedência obrigatório → mínimo → máximo (CT-02 a CT-07), unicidade insensível a caixa (CT-08/CT-09), normalização `" Cão   Pastor "` → `"Cão Pastor"` (CT-10), coexistência de `"Réptil"`/`"Reptil"` (CT-11, garantida por `speciesNameKey` não aplicar `NFD`), tradução do `P2002` (CT-12), chave extra com `field: "<chave>"` (CT-33) — todos presentes.
- `401`/`403` (CT-30/CT-31) vêm dos middlewares transversais montados nas duas rotas.
- Envelope de erro exclusivo do `error-handler.middleware.ts` — nenhum dos oito arquivos monta corpo de erro; os services lançam `AppError`.
- `/api/health` e `/api/auth` intactos — `npm test` verde, 15 suítes / 138 testes, incluindo `tests/integration/auth-routes.spec.ts` e `app.spec.ts`.
Uma nota, sem achado: com corpo simultaneamente inválido **e** com chave extra (`{ "name": "", "x": 1 }`), o `superRefine` externo não roda porque o parse do objeto interno já falhou, e `details` traz só o erro de `name`. Comportamento idêntico ao do `registerSchema` e fora do que os critérios de aceite descrevem — o CT-33 usa nome válido.

**Pass 2 — Diff Analysis**: Nenhum achado. `git status` mostra exatamente os 7 arquivos novos previstos em `## Files` e um único arquivo modificado; `git diff --stat` confirma `src/routes/index.ts | 2 ++` — o `import` e o `router.use('/species', speciesRoutes)` abaixo do `/auth`, nada mais. Nenhum `PATCH`, `DELETE` nem contagem de animais; `update`, `delete` e `countAnimalsBySpecies` estão ausentes da interface do repositório, como o escopo exige. `prisma/schema.prisma` intocado. Nenhum limitador de taxa. Nenhuma formatação em massa e nenhum arquivo fora do escopo. Sem scope creep, com a única ressalva do achado #3 (higienização não prevista pela spec, julgada e aceita no Desvio 2).

**Pass 3 — Code Practices**: Achado #1. Fora dele: injeção de dependência por construtor sobre a **interface** `SpeciesRepository` nos dois services (DIP); um motivo de mudança por arquivo (SRP), com o envelope `{ items }` no controller e a regra no service; um nível de indentação por função, sem nenhum `else`, com early return em `medirNome` e na fábrica; números mágicos extraídos (`TAMANHO_MINIMO_DO_NOME`, `TAMANHO_MAXIMO_DO_NOME`, `HTTP_STATUS`); nenhuma abreviação; arquivos entre 34 e 146 linhas; comentários explicando o **porquê** e não o **quê**. As duas regex com flag `/g` são usadas só em `.replace()`, que reinicia `lastIndex` — sem o bug de estado que `/g` causa em `.test()`. Ubiquitous language: termos de domínio em inglês (`speciesNameKey`, `PublicSpecies`, `SpeciesNameAlreadyExistsError`) e identificadores auxiliares em PT-BR (`higienizar`, `medirNome`, `chave`, `criada`) — exatamente o recorte já praticado em `auth.validators.ts` e `register-user.service.ts`.

**Pass 4 — Testing Review**: Cobertura de 0% nos 7 arquivos novos, **esperado e não bloqueante**: o `## Scope — Out` desta task exclui testes explicitamente e a TASK-BACKEND-005 os entrega. Registrado que o piso de 80% de statements e 100% em mutação de dado **ainda não é atendido** — esta fatia não deve ir a produção antes da 005. A suíte existente permanece verde (15/138), portanto não há regressão. Dois pontos para a 005: o dublê `tests/fakes/prisma-double.ts` ainda não tem o modelo `species`; e o achado #4 precisa ser resolvido (usar o parâmetro da fábrica ou removê-lo).

**Pass 5 — Security Review**: Nenhum achado `critical` ou `major`.
- **A01** — as duas rotas montam `authenticate` → `authorizeRole('admin')` antes de qualquer handler (`species.routes.ts` L41 e L44-50). Não há IDOR possível: nenhuma rota deste slice recebe identificador, e a listagem não é escopada por usuário por definição da RN-01. Sem escalonamento horizontal ou vertical.
- **A03** — todo acesso passa pelo Prisma com objetos de filtro (`findMany`, `findUnique`, `create`); nenhuma interpolação de string, nenhum `$queryRaw`, nenhum `exec`. Nenhum log interpola entrada do usuário.
- **A02 / A05** — nenhum segredo, nenhuma leitura de `process.env` fora de `config/env.ts` (verificado por varredura no diretório), e o `error-handler.middleware.ts` L60-64 responde mensagem genérica sem stack para erro não previsto.
- **A04** — ausência de limitador é decisão fechada (Decisão 7 do changelog) e o risco é aceito: a operação exige credencial de `admin`, não envia e-mail e não é caminho de credencial. O `POST` custa duas idas ao banco por requisição, sem amplificação.
- **A06** — nenhuma dependência nova.
- **A07 / A08 / A10** — sem superfície: nenhuma desserialização de entrada não confiável, nenhum upload, nenhuma URL construída a partir de entrada do usuário.
- **A09** — achado #7 (`suggestion`).
- Validação de entrada por allowlist na borda: o corpo aceita exclusivamente `name`, e `express.json` já limita o tamanho da carga no `app.ts`.

**Pass 6 — Bug Detection**: Nenhum achado. Lido o conteúdo integral dos 8 arquivos e dos módulos de que dependem.
- **Corrida** (RN-16 / CT-12): a janela entre `findByNameKey` e `create` está fechada pela tradução do `P2002` em `create-species.service.ts` L67-73, e o `catch` está **fora de transação interativa** — a task proíbe `$transaction` aqui e o código obedece. O ponto levantado na revisão procede e está tratado: em Postgres o `23505` aborta a transação inteira e qualquer comando seguinte falharia com `25P02`, então capturar o `P2002` só é seguro fora dela, que é o caso. O `.catch((motivo: unknown) => ...)` reproduz o formato de `register-user.service.ts` L136-142. Como `species` tem um único índice único, dispensar a inspeção de `meta.target` (que o auth faz por ter dois alvos) é correto e está justificado no comentário L24-29.
- **Nulo/indefinido**: `findByNameKey` devolve `Species | null` e é testado com `!== null` explícito; `species.createdAt`/`updatedAt` são `DateTime` não anuláveis no schema, então o `.toISOString()` do mapper não pode falhar.
- **Coerção**: nenhuma comparação com `==`; `motivo.code === 'P2002'` é estrita e precedida do `instanceof`.
- **Swallowing**: o `catch` do service relança o motivo original quando não é `P2002` (L72). Nenhum bloco vazio.
- **Estado inconsistente**: a criação é uma escrita única, sem mutação parcial possível.
- **Vazamento de recurso**: nenhum handle, timer ou conexão aberto — o client Prisma é o singleton compartilhado.
- **Off-by-one / lógica invertida**: os três limites de `medirNome` usam os operadores corretos (`=== 0`, `< 2`, `> 60`), coerentes com os critérios "`Ov` → 201" e "60 caracteres → 201".
- **Sem `new Date()`** em nenhum dos arquivos novos: `createdAt`/`updatedAt` vêm dos defaults do schema, como a task exige. Sem `any` e sem `as any` — `npm run typecheck` sai 0 com `exactOptionalPropertyTypes` ligado.

**Pass 7 — Project Patterns**: Achados #1, #4 e #5. Fora deles, o alinhamento com `src/domains/auth/` é fiel: mesma divisão de pastas (`mappers/`, `repositories/`, `services/`, `errors/` e os arquivos `*.validators.ts`, `*.controller.ts`, `*.routes.ts` na raiz do domínio), arquivos em kebab-case, `Prisma.TransactionClient` no construtor do repositório com o comentário do porquê, interface no domínio e implementação Prisma no mesmo arquivo, fábrica de controller executada uma única vez no import das rotas (L32, igual a `auth.routes.ts` L33), handlers como propriedades com arrow function para preservar o `this`, imports sempre por alias `~/`, ausência de `try/catch` no controller apoiada no `express-async-errors` de `app.ts` L1, e comentários em PT-BR sem acentuação no código (mesma grafia do restante de `src/`). O fluxo de dependências respeita a arquitetura em camadas de `architecture.md`: rota → controller → service → repositório → Prisma, sem inversão e sem ciclo — o controller não importa o Prisma para uso nos handlers, apenas para compor o grafo na fábrica, exatamente como `createAuthController`.

#### Veredicto

> **APROVADO** — os 17 critérios de aceite estão implementados, os quatro desvios declarados foram julgados e aceitos (o `.passthrough()` com a alegação sobre `auth.validators.ts` confirmada no código), e não há achado `critical` nem `major`. Os sete achados registrados são `minor`/`suggestion` e não bloqueiam o fechamento.
>
> **Condição de fechamento da FEATURE**, não desta task: a fatia não deve ir a produção antes da TASK-BACKEND-005, que é quem prova por teste os comportamentos aqui verificados apenas por leitura estática — em especial a corrida do CT-12 e a ordenação dos CT-13/CT-14. A TASK-BACKEND-005 deve ainda resolver o achado #4 e acrescentar o modelo `species` ao `tests/fakes/prisma-double.ts`.
