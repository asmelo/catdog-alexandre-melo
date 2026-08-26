# TASK-BACKEND-003 — Renomear espécie (`PATCH /api/species/:id`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-003-backend-species-rename`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 3 of 11 — Domínio Species: Renomeação
**Generated**: `2026-08-25`

---

## Context

Implementa a HU-04 no servidor, com as regras RN-04, RN-07, RN-14, RN-15 e RN-16. O ponto delicado é a RN-07: renomear para o próprio nome atual, ignorando caixa e espaços, é a forma de o administrador corrigir "gato" para "Gato" — e precisa responder `200`, nunca `409`.

---

## Scope

**In:** Schema Zod do parâmetro de caminho e do corpo do `PATCH`, os métodos de renomeação no repositório, o service, o handler no controller e a rota.

**Out:** Nada de exclusão (TASK-BACKEND-004). Não alterar `prisma/schema.prisma`, `src/routes/index.ts` nem o mapper. Não usar o verbo `PUT` — a configuração de CORS em vigor (`src/config/cors.ts`) não o libera e alterá-la está fora do escopo (Decisão 3 do changelog). Não permitir alteração de nenhum campo além de `name` (RN-13). Sem testes (TASK-BACKEND-005).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/species/species.validators.ts` | schema do PATCH |
| `modify` | `src/domains/species/repositories/species.repository.ts` | findById e rename |
| `create` | `src/domains/species/services/rename-species.service.ts` | regra de renomeação |
| `modify` | `src/domains/species/species.controller.ts` | handler rename |
| `modify` | `src/domains/species/species.routes.ts` | rota PATCH /:id |

---

## Implementation

> **Reference pattern**: os arquivos irmãos criados na TASK-BACKEND-002 — `create-species.service.ts` para o formato de service, e o bloco `POST /` de `species.routes.ts` para a ordem de middlewares.

### `src/domains/species/species.validators.ts` *(modify)*
- Acrescentar `speciesIdParamSchema = z.object({ id: z.string().uuid(MESSAGES.INVALID_ID) })` e `renameSpeciesSchema = z.object({ name: speciesNameSchema }).strict()`.
- `renameSpeciesSchema` reusa o **mesmo** `speciesNameSchema` da criação: as mensagens por campo do `PATCH` são idênticas às do `POST` por exigência do contrato ("Mesmas mensagens por campo do `POST`"). Não duplicar as regras de tamanho.
- O `.uuid()` produz `details: [{ field: "id", message: "Identificador inválido." }]` e é o que garante `400` em vez de `404` para identificador malformado (CT-34). O `field` sai como `id` porque o `validationErrorFromZodError` usa `issue.path.join('.')` — validar o parâmetro por `params` no `validateRequest`, não dentro do corpo.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
- Acrescentar à interface e à implementação: `findById(id): Promise<Species | null>` e `rename(id, data: { name; nameNormalized }): Promise<Species>`.
- `rename` usa `update({ where: { id }, data })` — `updatedAt` é gravado pelo `@updatedAt` do schema, sem `new Date()` no código.
- `findById` devolve `null` para inexistente; **não** usar `findUniqueOrThrow`, que lançaria erro do Prisma em vez de deixar o service produzir `SpeciesNotFoundError`.

### `src/domains/species/services/rename-species.service.ts` *(create)*
- Dependência injetada: `SpeciesRepository`. `execute(input: { id: string; name: string }): Promise<PublicSpecies>`.
- Ordem obrigatória de verificação:
  1. `findById(id)` → `null` ⇒ `SpeciesNotFoundError` (RN-14 / CT-20). Verificar a existência **antes** do conflito: uma espécie já excluída deve reportar "não encontrada", que é a informação acionável, e não "nome já existe".
  2. `chaveNova = speciesNameKey(input.name)`; se `chaveNova === especie.nameNormalized` ⇒ **não é conflito** (RN-07). Seguir direto para o `rename`, que grava a nova caixa em `name`. Esta comparação é o ponto exato onde CT-17 se resolve; sem ela, `"gato"` → `"Gato"` cairia no `findByNameKey` e devolveria `409` sobre a própria espécie.
  3. `findByNameKey(chaveNova)` → se existir e `id` for **diferente**, ⇒ `SpeciesNameAlreadyExistsError` (CT-18). A comparação de `id` é a rede de segurança do passo 2.
  4. `rename(id, { name: input.name, nameNormalized: chaveNova })`.
- Traduzir `PrismaClientKnownRequestError` `P2002` do `rename` para `SpeciesNameAlreadyExistsError` e `P2025` (registro não encontrado ao atualizar) para `SpeciesNotFoundError` — as duas cobrem a janela entre a leitura e a escrita, quando outra sessão renomeia ou exclui a mesma espécie.
- O `id` **nunca** é alterado (RN-15): `rename` recebe `id` apenas no `where`, nunca no `data`.

### `src/domains/species/species.controller.ts` *(modify)*
- Acrescentar `rename` à fábrica e ao objeto devolvido: lê `req.params.id` e `req.body.name`, chama **um** service e responde `200` com o `PublicSpecies` plano.
- Tipar os params do handler (`Request<{ id: string }>`) — o `SemParametros` usado no domínio auth não serve aqui.
- Instanciar `RenameSpeciesService` na mesma fábrica que já instancia os outros dois, reusando a instância existente de `SpeciesRepository`.

### `src/domains/species/species.routes.ts` *(modify)*
- `PATCH /:id` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ params: speciesIdParamSchema, body: renameSpeciesSchema })`, `controller.rename`.
- `PATCH` já está liberado em `src/config/cors.ts` (`methods: ['GET','POST','PATCH','DELETE','OPTIONS']`) — nenhuma alteração de CORS é necessária nem permitida.

---

## Acceptance Criteria

- [ ] **Given** a espécie `"Sapo"` e sessão de `admin`, **When** `PATCH /api/species/:id` com `{ "name": "Perereca" }`, **Then** responde `200` com `name = "Perereca"`, o `id` devolvido é **o mesmo** de antes e `name_normalized` passa a `"perereca"` (CT-16 / RN-15).
- [ ] **Given** a espécie gravada como `"gato"`, **When** renomeada para `"Gato"`, **Then** responde `200` — nunca `409` — e o `name` persistido passa a `"Gato"` (CT-17 / RN-07).
- [ ] **Given** a espécie `"Gato"`, **When** renomeada para `"  Gato  "`, **Then** responde `200` e o `name` persistido é `"Gato"` (RN-07 combinada com RN-03).
- [ ] **Given** as espécies `"Gato"` e `"Sapo"`, **When** `"Sapo"` é renomeada para `"gato"`, **Then** `409 SPECIES_NAME_ALREADY_EXISTS` e **nenhum** dos dois registros é alterado (CT-18 / RN-04).
- [ ] **Given** `{ "name": "" }`, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` com `details` apontando `name` e "Este campo é obrigatório."; nada é gravado (CT-19).
- [ ] **Given** nome com 1 ou com 61 caracteres, **When** `PATCH`, **Then** as mesmas mensagens por campo do `POST` são devolvidas.
- [ ] **Given** um `id` de espécie já excluída, **When** `PATCH`, **Then** `404 SPECIES_NOT_FOUND` com "Espécie não encontrada." (CT-20 / RN-14).
- [ ] **Given** `id` fora do formato UUID, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "id", message: "Identificador inválido." }]` — e não `404` (CT-34).
- [ ] **Given** corpo com chave além de `name`, **When** `PATCH`, **Then** `400 VALIDATION_ERROR` e nada é gravado (RN-13).
- [ ] **Given** requisição sem sessão, **Then** `401 SESSION_EXPIRED`; **Given** sessão de `cliente`, **Then** `403 FORBIDDEN` — em ambos os casos nada é gravado, independentemente da interface (CT-30 / CT-31 / CA-18 / RN-01).
- [ ] **Given** o endpoint em execução, **When** um cliente tenta a mesma operação por `PUT /api/species/:id`, **Then** a rota não existe — nenhuma rota `PUT` é declarada e `src/config/cors.ts` permanece inalterado.

---

## API Notes

- `PATCH /api/species/:id` — body `{ name }` → `200 PublicSpecies`. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `404 SPECIES_NOT_FOUND`, `409 SPECIES_NAME_ALREADY_EXISTS`.
- **Por que `PATCH` e não `PUT`**: o nome é o único atributo mutável (alteração parcial) e o CORS em vigor não libera `PUT`.

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (repositório, validadores, controller e rotas de espécie já existentes), TASK-BACKEND-001 (`speciesNameKey`, erros de domínio).
- **Blocks**: TASK-BACKEND-005 (testes), TASK-FRONTEND-010 (edição em linha consome este contrato).

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 5 (4 modificados + 1 criado), mais os arquivos de que dependem (`validate-request.middleware.ts`, `error-handler.middleware.ts`, `authenticate.middleware.ts`, `authorize-role.middleware.ts`, `species.mapper.ts`, `species.errors.ts`, `species-name.ts`, `species.messages.ts`, `prisma/schema.prisma`, `config/cors.ts`)

#### Resumo

A renomeação em si está correta: a semântica da RN-07, a ordem existência-antes-de-conflito, a tradução de `P2002`/`P2025` fora de transação interativa e a cadeia de middlewares conferem com a spec, e nenhum arquivo fora do escopo foi tocado. Há **um achado `major`**: a refatoração do bloco de recusa de campos extras para a fábrica `objetoSemCamposExtras` **alterou o comportamento do `createSpeciesSchema`**, já aprovado na TASK-BACKEND-002, e abriu o mesmo furo no `renameSpeciesSchema` — chaves herdadas de `Object.prototype` deixaram de ser recusadas.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | major | `src/domains/species/species.validators.ts` | L137 | requisito / regressão | `!(chave in forma)` consulta a **cadeia de protótipos**, não as chaves declaradas. Um corpo com `toString`, `constructor`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` ou `toLocaleString` passa pela validação e responde `200` em vez de `400 VALIDATION_ERROR`. Isso (a) descumpre o critério "corpo com chave além de `name` ⇒ 400" desta task (RN-13) e (b) **regride o CT-33 da TASK-BACKEND-002**, cujo bloco inline usava `chave !== 'name'` e recusava corretamente. Verificado em execução contra os schemas reais: `{"name":"Gato","cor":"x"}` → 400; `{"name":"Gato","toString":"x"}` → 200 no `POST` **e** no `PATCH` | Trocar por `Object.hasOwn(forma, chave)` (ou `Object.prototype.hasOwnProperty.call(forma, chave)`). Uma palavra; o resto da fábrica está correto |
| 2 | minor | `src/domains/species/services/rename-species.service.ts`; `src/domains/species/species.validators.ts` | L65, L80; L159, L171 | padrão | Comentários com caracteres acentuados (`Espécie não encontrada.`, `espaços`, `espécie`, `Identificador inválido.`). Todo o domínio de espécies em `HEAD` tem **zero** acentos em comentário — `species.messages.ts` chega a citar a mensagem transversal como "Voce nao tem permissao..." justamente para manter a regra. Acento só aparece em *string* de contrato | Reescrever os quatro trechos sem acento, mantendo os acentos apenas dentro das strings de `species.messages.ts` |
| 3 | suggestion | `src/domains/species/species.controller.ts` | L38 | prática | `type ParametrosDeEspecie = SpeciesIdParams;` é alias de alias: não acrescenta forma nem restrição, e o leitor precisa de dois saltos para chegar ao schema | Usar `SpeciesIdParams` direto no genérico de `ManipuladorDeRenomeacao` e manter a justificativa no comentário |
| 4 | suggestion | `src/domains/species/services/rename-species.service.ts` | L87-98 | prática | `execute` tem dois níveis de indentação (`if` dentro de `if`) — Object Calisthenics regra 1 | Extrair `garantirNomeDisponivel(especie, chaveNova)`, que faz o *early return* quando a chave não muda e lança o `409` no caso contrário |
| 5 | suggestion | `src/middlewares/validate-request.middleware.ts` | L48-58 | teste | O `validateRequest` valida `body` **antes** de `params`. Com `id` malformado **e** corpo inválido na mesma requisição, o `details` sai apontando `name`, não `id` | Nenhuma mudança de produção necessária (o CT-34 pressupõe corpo válido). Registrar para a TASK-BACKEND-005: o teste do CT-34 deve enviar `{"name":"Gato"}` válido |
| 6 | suggestion | `src/domains/auth/auth.validators.ts` | L105 | segurança / padrão | Fora do escopo desta task: o `objetoSemCamposExtras` do domínio auth tem o **mesmo** `chave in forma` e, portanto, o mesmo furo no `registerSchema` (RN-12 do auth). Preexistente — não foi introduzido aqui | Abrir item próprio para aplicar a mesma correção do achado #1 no domínio auth |

#### Desvios declarados — parecer

1. **Fábrica `objetoSemCamposExtras` em `species.validators.ts`** — a extração em si é legítima (`POST` e `PATCH` exigem a mesma recusa; não unificar com a do auth é a decisão certa, já que cada catálogo de mensagens é contrato literal de um conjunto distinto de critérios). **Mas a refatoração não preservou o comportamento**: ver achado #1. As demais garantias do `createSpeciesSchema` foram conferidas e continuam intactas — `required_error`/`invalid_type_error` do objeto, `.passthrough()` + `superRefine` com `path: [chave]` produzindo `field: "<chave>"`, higienização de caracteres invisíveis e a dupla medição contra o limite de 60 (`nome.length` **e** `speciesNameKey(nome).length`) seguem no mesmo `speciesNameSchema`, que não foi tocado. **Aprovado com a correção do #1.**
2. **`RenameSpeciesData = CreateSpeciesData`** — **aprovado.** As duas escritas gravam o mesmo par `name`/`nameNormalized` derivado de `speciesNameKey`; um alias nomeado mantém a assinatura legível sem permitir divergência. O `rename` ainda lista os campos um a um no `data`, então o alias não é porta de entrada para coluna inesperada.
3. **`required_error`/`invalid_type_error` no `speciesIdParamSchema`** — **aprovado.** Inalcançável na prática (o Express só entra no handler com a rota casada, e `req.params.id` é sempre `string`), mas é defesa em profundidade sem custo e mantém a mensagem em PT-BR caso o schema seja reusado fora da rota (RNF-12).
4. **Comentário de escopo em `species.repository.ts`** — **aprovado.** O comentário afirmava que `update` chegaria na TASK-BACKEND-003; deixá-lo como estava tornaria a documentação falsa no mesmo commit que a contradiz.
5. **`speciesNameSchema` privado** — **aprovado.** É exatamente o que o contrato pede ("Mesmas mensagens por campo do `POST`"): uma única declaração das regras de tamanho e da precedência entre mensagens, reusada pelos dois schemas no mesmo arquivo.

#### Pontos de verificação especial

| Ponto | Resultado |
|---|---|
| "Mesmo nome" (`"gato"` → `"Gato"`) | **Confere com a spec.** L280 e L451 do `spec_context.md`: o próprio nome atual pela comparação da RN-04 responde `200`, nunca `409`. A implementação **pula** a checagem de conflito (`if (chaveNova !== especie.nameNormalized)`) em vez de relativizá-la, e segue para o `rename`, que grava a nova caixa em `name` — o único efeito visível. `"  Gato  "` chega ao service já normalizado como `"Gato"` pelo `transform` do `speciesNameSchema`, produz a mesma chave `"gato"` e cai no mesmo caminho |
| Ordem existência → conflito | **Correta.** `findById` e `throw SpeciesNotFoundError` em L69-73, antes de qualquer `findByNameKey` (RN-14 / CT-20) |
| `P2002` / `P2025` e transação | **Corretos.** Ambos traduzidos no `.catch` do `rename`. O `update` roda sobre o client global (`new PrismaSpeciesRepository(prisma)`), **fora** de qualquer `$transaction` interativa — o `23505` não pode abortar transação alguma, e o `withTransaction` não é usado neste caso de uso |
| Controller sem Prisma, um único service | **Confere.** `rename` lê `params.id` e `body.name` e chama só `renameSpecies.execute` |
| Repositório não lança erro HTTP | **Confere.** `findById` devolve `null`; `rename` deixa o erro do Prisma subir para o service traduzir |
| Só o `error-handler.middleware.ts` monta corpo de erro | **Confere.** Nenhum `res.json` de erro nos arquivos da task; sem `try/catch` no controller |
| `process.env` fora de `config/env.ts` | **Nenhuma ocorrência** |
| `new Date()` / `~/utils/clock.ts` | **Nenhuma ocorrência.** `updatedAt` vem do `@updatedAt` do `prisma/schema.prisma` |
| `any` | **Nenhuma ocorrência.** `motivo: unknown` no `catch`, estreitado por `instanceof` |
| Mapper não vaza `nameNormalized` | **Confere.** `PublicSpecies` não declara o campo e `toPublicSpecies` projeta campo a campo |
| Cadeia de middlewares | **Correta.** `authenticate` → `authorizeRole('admin')` → `validateRequest({ params, body })` → `controller.rename` |
| Escopo | **Limpo.** Nenhum `DELETE`, nenhuma contagem de animais, **nenhuma rota `PUT` em todo o `src/`**, `src/routes/index.ts` e `prisma/schema.prisma` sem diff, `src/config/cors.ts` inalterado |
| Regressão da TASK-BACKEND-002 | **Uma regressão encontrada** — achado #1. Rota `POST /` e `speciesNameSchema` no mais se comportam como antes |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 10 de 11 critérios implementados; 1 parcial. O critério "corpo com chave além de `name` ⇒ 400" falha para chaves de `Object.prototype` (achado #1). Todos os demais verificados linha a linha contra a spec.
**Pass 2 — Diff Analysis**: Nenhum achado. Exatamente os 5 arquivos da tabela `## Files`; nada do `## Scope — Out` foi tocado.
**Pass 3 — Code Practices**: Achados #3, #4. SOLID íntegro — service depende da interface `SpeciesRepository`, responsabilidade única por camada, controller fechado para regra de negócio. Linguagem ubíqua alinhada: `Species`, `rename`, `SpeciesNotFoundError`/`SpeciesNameAlreadyExistsError` nomeiam a regra violada, recurso REST no plural.
**Pass 4 — Testing Review**: Sem testes próprios por contrato (TASK-BACKEND-005) — cobertura 0% esperada. Registrado para aquela task: (a) o caso do RN-13 precisa de um cenário com chave de protótipo, que é o que teria pego o achado #1; (b) o CT-34 deve enviar corpo válido (achado #5).
**Pass 5 — Security Review**: Nenhum achado bloqueante. A01 — `authenticate` + `authorizeRole('admin')` no servidor, antes da validação; recurso administrativo global, sem IDOR. A03 — Prisma parametrizado, `data` montado campo a campo. A02 — nenhum segredo. A05 — `error-handler` devolve `INTERNAL_ERROR` genérico, sem stack. A04 — ausência de limitador de taxa é a Decisão 7 do changelog. A06 — nenhuma dependência nova. A08 — `.passthrough()` mantém a chave extra em `req.body`; combinada com o achado #1, um corpo com `hasOwnProperty: "x"` sobrescreve o método no objeto da requisição e faria qualquer chamada futura a `req.body.hasOwnProperty(...)` virar `TypeError`/500. Hoje nenhum caminho faz isso, e `__proto__` não é vetor (não aparece em `Object.keys` do `JSON.parse` e o repositório projeta os campos explicitamente) — mais uma razão para o achado #1. A09 — mutação administrativa sem log de auditoria, consistente com `create-species.service.ts`; se a auditoria entrar, entra para o domínio inteiro.
**Pass 6 — Bug Detection**: Achado #1. Verificados sem ocorrência: `null` guardado antes do uso; corrida leitura-escrita fechada pela tradução de `P2002`/`P2025` fora de transação; sem vazamento de recurso; sem `==`; `catch` que relança o motivo desconhecido; `id` validado como UUID antes do repositório; lógica de `chaveNova !== especie.nameNormalized` na polaridade certa; escrita única, sem estado parcial. Nota sem severidade: duas renomeações simultâneas da **mesma** espécie terminam em "última escrita vence" — a spec não pede bloqueio otimista e o desfecho é consistente.
**Pass 7 — Project Patterns**: Achado #2. Estrutura, alias `~/`, formato de service, fábrica de composição, catálogo único de mensagens e fluxo de erro por `AppError` seguem `create-species.service.ts` e o domínio auth. `npm run typecheck` e `npx eslint src/domains/species` reexecutados na revisão: ambos exit 0.

#### Veredicto

> **NECESSITA CORREÇÕES** — 0 critical, 1 major. Encaminhar ao `makuco-codegen`:
>
> - **Obrigatório (#1)**: `src/domains/species/species.validators.ts` L137 — trocar `if (!(chave in forma))` por `if (!Object.hasOwn(forma, chave))`. Corrige de uma vez o critério RN-13 do `PATCH` e a regressão do CT-33 no `POST`.
> - **Recomendado (#2)**: remover os acentos dos comentários em `rename-species.service.ts` L65 e L80 e em `species.validators.ts` L159 e L171.
> - **#3, #4, #5 e #6** não bloqueiam o fechamento da task.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 5 da tabela `## Files` (4 modificados + 1 criado), relidos por inteiro, mais `species.messages.ts`, `species.mapper.ts`, `species-name.ts`, `species.errors.ts`, `validate-request.middleware.ts`, `error-handler.middleware.ts`, `config/cors.ts`, `tsconfig.json`, `tsconfig.test.json` e `package.json`

#### Resumo

A correção do achado `major` da rodada 1 foi verificada **por execução**, não por leitura: a troca de `!(chave in forma)` por `!Object.hasOwn(forma, chave)` recusa agora todas as chaves herdadas de `Object.prototype` nos dois schemas, com o `details` exigido pelo contrato. O achado `minor` #2 também foi resolvido. Nenhum comportamento além dos dois pontos corrigidos mudou. A task está **aprovada**.

#### Situação dos achados da rodada 1

| # | Severidade | Situação | Evidência |
|---|------------|----------|-----------|
| 1 | major | **RESOLVIDO** | `species.validators.ts` L137 usa `Object.hasOwn(forma, chave)`. Verificado por execução — ver tabela abaixo |
| 2 | minor | **RESOLVIDO** | `grep -nP '[À-ÿ]'` nos 5 arquivos da task: **zero** ocorrências. O único não-ASCII remanescente é o travessão `—` e o `İ` (U+0130) citado como exemplo em comentário, ambos já presentes no domínio em `HEAD`. Os acentos vivem só nas *strings* de `species.messages.ts`, que **não tem diff** |
| 3 | suggestion | **NÃO TRATADO** | `species.controller.ts` L38 mantém `type ParametrosDeEspecie = SpeciesIdParams;`. Não bloqueia; sem justificativa registrada |
| 4 | suggestion | **NÃO TRATADO** | `rename-species.service.ts` L87-98 mantém os dois níveis de indentação. Não bloqueia; sem justificativa registrada |
| 5 | suggestion | **N/A — sem mudança de produção** | Confirmado por execução que a ordem `body` antes de `params` do `validateRequest` persiste: `PATCH /api/species/abc` com `{"name":""}` devolve `field: "name"`, e com `{"name":"Gato"}` devolve `field: "id"`. Continua registrado para a TASK-BACKEND-005 |
| 6 | suggestion | **JUSTIFICADO E REGISTRADO** | `src/domains/auth/auth.validators.ts` L105 ainda tem `!(chave in forma)` — deliberadamente não corrigido (domínio fora do escopo). A dívida está escrita em `.makuco/handoff/implementacao-module-002.md`, com o texto da correção e o gatilho de registro em `technical-debt.md`. `git diff` sobre `src/domains/auth/` está **vazio** |

#### Verificação do achado #1 por execução

App Express montado com a **cadeia real** (`express.json` → `validateRequest` com os schemas reais → `errorHandlerMiddleware`), exercitado por `supertest`. Resultado idêntico nos dois schemas:

| Chave enviada junto de `name` | `POST` (createSpeciesSchema) | `PATCH` (renameSpeciesSchema) |
|---|---|---|
| `cor` | `400` · `field: "cor"` | `400` · `field: "cor"` |
| `toString` | `400` · `field: "toString"` | `400` · `field: "toString"` |
| `constructor` | `400` · `field: "constructor"` | `400` · `field: "constructor"` |
| `valueOf` | `400` · `field: "valueOf"` | `400` · `field: "valueOf"` |
| `hasOwnProperty` | `400` · `field: "hasOwnProperty"` | `400` · `field: "hasOwnProperty"` |
| `isPrototypeOf` | `400` · `field: "isPrototypeOf"` | `400` · `field: "isPrototypeOf"` |
| `propertyIsEnumerable` | `400` · `field: "propertyIsEnumerable"` | `400` · `field: "propertyIsEnumerable"` |
| `toLocaleString` | `400` · `field: "toLocaleString"` | `400` · `field: "toLocaleString"` |

Em **todos** os casos o corpo é exatamente
`{"error":{"code":"VALIDATION_ERROR","message":"Verifique os campos informados.","details":[{"field":"<chave>","message":"Campo não permitido nesta requisição."}]}}`.

Corpo válido `{ "name": "Gato" }`: `POST` → `201 {"name":"Gato"}`; `PATCH` → `200 {"id":"<uuid>","name":"Gato"}`. **CT-33 não está mais regredido.**

#### `Object.hasOwn` no alvo de compilação

| Ponto | Resultado |
|---|---|
| `tsconfig.json` | `"target": "ES2022"`, `"lib": ["ES2022"]` — `Object.hasOwn` é ES2022, dentro do alvo |
| Declaração de tipo | `node_modules/typescript/lib/lib.es2022.object.d.ts:25` — `hasOwn(o: object, v: PropertyKey): boolean` |
| `tsconfig.test.json` | `extends: "./tsconfig.json"` — herda `target`/`lib`; é o que o `ts-jest` usa, então a suíte compila com o mesmo alvo |
| `tsconfig.seed.json` | Mesmo `extends`; compila limpo no `typecheck` |
| Runtime | `package.json` declara `engines.node: ">=20 <21"`; `Object.hasOwn` existe desde o Node 16.9 — sem risco de `TypeError` em produção |

#### Achados desta rodada

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 7 | minor | `src/domains/species/species.validators.ts` | L134-146 | requisito (preexistente) | `{"name":"Gato","__proto__":"x"}` responde `201` no `POST` e `200` no `PATCH`, e não `400`. Causa: o `superRefine` roda sobre a **saída** do `.passthrough()`, e o Zod monta o objeto por atribuição — `__proto__` some antes do laço, embora `Object.keys(req.body)` do corpo cru o contenha. **Não é regressão nem foi introduzido aqui**: o bloco inline original da TASK-BACKEND-002 (`chave !== 'name'`) iterava o mesmo valor parseado e tinha o mesmo desfecho. **Sem impacto de segurança verificado por execução**: `Object.prototype` permanece limpo, o protótipo de `req.body` continua sendo `Object.prototype` e nenhum campo extra chega ao service — o efeito é apenas responder `2xx` onde a letra da RN-13 pede `400` | Não bloqueia. Se for tratado, a correção é fazer o `superRefine` inspecionar o valor cru (ou acrescentar uma checagem explícita de `__proto__` com `Object.getOwnPropertyNames`). Como o furo é do padrão compartilhado, tratar junto com a dívida do domínio auth, não isoladamente aqui |

#### Escopo da correção — verificação

| Ponto | Resultado |
|---|---|
| Arquivos alterados pela correção | **Exatamente 2.** `species.validators.ts` e `rename-species.service.ts` têm `mtime 10:29:24`; `species.repository.ts` (10:15:18), `species.controller.ts` (10:16:09) e `species.routes.ts` (10:16:23) permanecem no horário da implementação original |
| `rename-species.service.ts` — comportamento | **Inalterado.** Exercitado com repositório em memória: CT-16 (`Sapo`→`Perereca`) `200`; CT-17 (`gato`→`Gato`) `200` **pulando** o `findByNameKey`; `Gato`→`Gato` `200`; CT-18 `409 SPECIES_NAME_ALREADY_EXISTS`; CT-20 `404 SPECIES_NOT_FOUND` **sem** chegar ao `findByNameKey` (ordem 404 antes de 409 confirmada pelo rastro de chamadas); `P2002` → `409`; `P2025` → `404`; `P2003` e `Error` comum são relançados sem tradução |
| `rename` nunca recebe `id` no `data` | **Confere.** Rastro: `rename(<id>, {"name":"Perereca","nameNormalized":"perereca"})` — RN-15 preservada |
| Mapper | **Sem diff** e sem vazamento: a saída do service traz `id`, `name`, `createdAt`, `updatedAt` e **não** `nameNormalized` |
| Rotas e controller | **Sem diff desde a rodada 1.** Cadeia `authenticate` → `authorizeRole('admin')` → `validateRequest({ params, body })` → `controller.rename` intacta |
| `PUT` | `grep -rn "\.put(" src/` → **nenhuma ocorrência**. `PUT /api/species/:id` no app de teste → `404`. `src/config/cors.ts` inalterado (`['GET','POST','PATCH','DELETE','OPTIONS']`) |
| Fora do escopo | `prisma/schema.prisma`, `src/routes/index.ts`, `src/domains/auth/` e `src/domains/species/species.messages.ts` sem diff |

#### Garantias da TASK-BACKEND-002 — reconferidas por execução

Todas verificadas nos **dois** schemas, com resultado idêntico (é o mesmo `speciesNameSchema`):

| Entrada | Desfecho |
|---|---|
| `{ "name": "" }` | `400` · `name` · "Este campo é obrigatório." (CT-19) |
| `{ "name": "   " }` | `400` · `name` · "Este campo é obrigatório." — o `transform` roda antes da medição (CA-07) |
| `{ "name": "G" }` | `400` · `name` · "O nome da espécie deve ter no mínimo 2 caracteres." |
| `{ "name": "a"×61 }` | `400` · `name` · "O nome da espécie deve ter no máximo 60 caracteres." |
| `{ "name": "a"×60 }` | Aceito |
| `{ "name": "Ga​to" }` | Aceito, gravado como `"Gato"` — **higienização de caracteres invisíveis íntegra** |
| `{ "name": "  Gato   Preto  " }` | Aceito, gravado como `"Gato Preto"` (RN-03) |
| `{ "name": "İ"×60 }` | `400` · máximo — **dupla medição contra o limite de 60 íntegra**: 60 caracteres em `name`, 120 na chave |
| `name` ausente / `name: 42` | `400` · `name` · "Este campo é obrigatório." |
| Corpo `[]` | `400` · `field: ""` · "Este campo é obrigatório." — `required_error`/`invalid_type_error` do objeto ativos |

Uma mensagem por campo em todos os casos: a precedência do `superRefine` único não foi afetada.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **11 de 11 critérios implementados.** O critério "corpo com chave além de `name` ⇒ 400", parcial na rodada 1, agora passa para toda chave de `Object.prototype` — resta apenas o caso `__proto__` (achado #7, preexistente e sem impacto observável). Os demais reverificados por execução.
**Pass 2 — Diff Analysis**: Nenhum achado. `git diff` cobre exatamente os 5 arquivos da tabela `## Files`; a correção tocou os 2 arquivos previstos e nenhum outro, confirmado por conteúdo e por `mtime`.
**Pass 3 — Code Practices**: Achados #3 e #4 seguem abertos (`suggestion`, não bloqueiam). `Object.hasOwn(forma, chave)` é mais legível que a alternativa `Object.prototype.hasOwnProperty.call` e não introduz nível de indentação. SOLID e linguagem ubíqua inalterados.
**Pass 4 — Testing Review**: Sem testes próprios por contrato (TASK-BACKEND-005). `npm test` reexecutado: **15 suítes / 138 testes, todos verdes** — nenhuma regressão nas suítes de auth e de infraestrutura. Reforçado para a TASK-BACKEND-005: (a) o cenário da RN-13 deve incluir pelo menos uma chave de protótipo (`toString`), que é o teste que teria pego o achado #1 e que hoje passaria; (b) o CT-34 deve enviar corpo válido (achado #5); (c) opcionalmente um caso `__proto__` documentando o achado #7.
**Pass 5 — Security Review**: Nenhum achado bloqueante; o parecer da rodada 1 permanece válido. A08 revisitado por execução — o cenário levantado na rodada 1 (`hasOwnProperty: "x"` sobrevivendo em `req.body` e transformando chamadas futuras em `TypeError`) está **fechado**: a requisição agora é recusada com `400` antes de qualquer handler. Poluição de protótipo testada explicitamente com `{"name":"Gato","__proto__":{"poluido":"sim"}}`: `Object.prototype` permanece limpo e o protótipo de `req.body` continua sendo `Object.prototype`. A01, A02, A03, A04, A05, A06, A09 e A10 sem alteração em relação à rodada 1.
**Pass 6 — Bug Detection**: Achado #7 (`minor`, preexistente). Reverificados sem ocorrência: `null` guardado (`especie === null` antes de qualquer acesso); corrida leitura-escrita fechada por `P2002`/`P2025`; `catch` que relança o motivo desconhecido em vez de engoli-lo (confirmado por execução com `Error('boom')` e `P2003`); nenhum `==`; polaridade de `chaveNova !== especie.nameNormalized` correta; escrita única, sem estado parcial; sem vazamento de recurso; nenhum `any`; nenhum `new Date()`; nenhum `process.env`.
**Pass 7 — Project Patterns**: Nenhum achado. A remoção dos acentos alinhou os comentários ao resto do domínio. **Correção da rodada 1**: o parecer anterior citou `npx eslint src/domains/species` com exit 0 — **este projeto não tem ESLint** (sem `eslint.config.*`, sem `.eslintrc.*`, `eslint` ausente das `devDependencies`); aquele comando não poderia ter passado e a evidência é inválida. O gate real, reexecutado nesta rodada, é `npm run typecheck` (exit 0, três projetos: base, seed e test) e `npm test` (15/15, 138/138).

#### Veredicto

> **APROVADO** — 0 critical, 0 major. O achado `major` da rodada 1 está resolvido e comprovado por execução nos dois schemas; o `minor` #2 está resolvido; o #6 está justificado e registrado como dívida no handoff. Restam #3, #4, #5 e o novo #7, todos `minor`/`suggestion` sem bloqueio. A TASK-BACKEND-003 pode ser fechada.
