# TASK-BACKEND-004 — Excluir espécie com bloqueio por vínculo (`DELETE /api/species/:id`)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-004-backend-species-delete-usage-guard`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 4 of 11 — Domínio Species: Exclusão e guarda de integridade
**Generated**: `2026-08-25`

---

## Context

Implementa as HU-05 e HU-06 e as regras RN-08, RN-09, RN-10 e RN-14. É o slice central da integridade da feature: a exclusão de espécie referenciada por animais é recusada em **duas camadas independentes, ambas obrigatórias**. A entidade `Animal` ainda não existe — a contagem de vínculos entra como **dependência declarada do caso de uso**, com implementação real que responde zero e um duplo de teste que responde diferente de zero (seção "Como a RN-08 é verificada antes de a entidade Animal existir" da spec).

---

## Scope

**In:** A porta `SpeciesUsageCounter` com a sua implementação provisória, o método de exclusão no repositório, o service de exclusão dentro de transação, o handler no controller e a rota `DELETE`.

**Out:** **Não criar o modelo `Animal`, a tabela `animals`, nem qualquer chave estrangeira.** A migration da FK restritiva pertence à feature seguinte do módulo — o que esta task entrega é o ponto de extensão e a tradução do erro do banco quando essa FK existir. Não implementar inativação, arquivamento, lixeira ou recuperação (RN-10). Não implementar migração de animais entre espécies. Não alterar `prisma/schema.prisma` nem `src/routes/index.ts`. Sem testes (TASK-BACKEND-005).

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Quantidade de animais vinculados a uma espécie | `SpeciesUsageCounter.countAnimalsBySpecies(speciesId): Promise<number>` |
| Espécie em uso (RN-08) | `SpeciesInUseError` → `409 SPECIES_IN_USE` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/domains/species/repositories/species-usage-counter.ts` | porta de contagem |
| `modify` | `src/domains/species/repositories/species.repository.ts` | método delete |
| `create` | `src/domains/species/services/delete-species.service.ts` | regra de exclusão |
| `modify` | `src/domains/species/species.controller.ts` | handler remove |
| `modify` | `src/domains/species/species.routes.ts` | rota DELETE /:id |

---

## Implementation

> **Reference pattern**: `src/domains/auth/repositories/user.repository.ts` (interface-porta + impl Prisma + `withTransaction`) e `src/domains/auth/services/confirm-email.service.ts` (uso de `$transaction` com repositórios transacionais).

### `src/domains/species/repositories/species-usage-counter.ts` *(create)*
- Interface `SpeciesUsageCounter { countAnimalsBySpecies(speciesId: string): Promise<number>; withTransaction(executor: Prisma.TransactionClient): SpeciesUsageCounter }`.
- Implementação `PrismaSpeciesUsageCounter` que, **enquanto a tabela `animals` não existir**, responde `0` sem tocar o banco.
- O arquivo carrega um comentário `TODO` explícito, no formato já usado no projeto para pendências entre slices, dizendo: a feature de Cadastro de pets **deve** substituir o corpo por `this.db.animal.count({ where: { speciesId } })` e **não pode ser considerada concluída** sem que a FK `species_id` exista com `onDelete: Restrict` e sem que CT-24, CT-25, CT-26 e CT-32 sejam reexecutados contra dados reais.
- Ser uma porta separada de `SpeciesRepository`, e não mais um método dele, é deliberado (segregação de interfaces): a contagem pertence ao agregado Animal, e juntá-las obrigaria a implementação em memória do repositório de espécies a fingir conhecer animais. É esta separação que torna o duplo de teste trivial.
- **Não** declarar tipo, modelo ou import de `Animal` aqui — `@prisma/client` não exporta esse símbolo e o arquivo não compilaria.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
- Acrescentar `deleteById(id): Promise<void>` à interface e à implementação, usando `delete({ where: { id } })`.
- Não usar `deleteMany`: ele responde `count: 0` silenciosamente para id inexistente, e o service precisa distinguir esse caso para produzir `404`.

### `src/domains/species/services/delete-species.service.ts` *(create)*
- Dependências injetadas: `SpeciesRepository`, `SpeciesUsageCounter` e `PrismaClient` (apenas para `$transaction`). `execute(input: { id: string }): Promise<void>`.
- Todo o corpo roda dentro de **um** `prisma.$transaction`, com os dois colaboradores rebindados por `withTransaction(tx)`. A verificação e a exclusão precisam ver o mesmo instantâneo: fora da transação, um animal criado entre a contagem e o `delete` produziria exatamente o animal órfão que a RN-09 proíbe.
- Ordem obrigatória dentro da transação:
  1. `findById(id)` → `null` ⇒ `SpeciesNotFoundError` (RN-14 / CT-27).
  2. `countAnimalsBySpecies(id)` → `> 0` ⇒ `SpeciesInUseError` (RN-08 / CT-24). **Camada 1** — é ela que produz a mensagem correta em PT-BR.
  3. `deleteById(id)`.
- **Camada 2**: envolver o `deleteById` em `try/catch` e traduzir `PrismaClientKnownRequestError` com `code === 'P2003'` (violação de chave estrangeira) para o **mesmo** `SpeciesInUseError`, e `P2025` para `SpeciesNotFoundError`. O `P2003` só passa a ocorrer quando a FK restritiva existir, na feature seguinte — a tradução nasce agora para que a guarda não precise ser retroencaixada depois, e para que uma falha da camada 1 não vire `500`.
- Lançar o erro **de dentro** da callback do `$transaction`: é isso que aborta a transação e garante que nada foi removido quando a resposta é `409`.
- Comentário obrigatório: exclusão em cascata e anulação de vínculo são **proibidas** por esta spec, em qualquer camada.
- **Não** usar `new Date()` — a operação não grava instante nenhum (RN-10: a exclusão é definitiva, não há `deletedAt`).

### `src/domains/species/species.controller.ts` *(modify)*
- Acrescentar `remove` à fábrica: lê `req.params.id`, chama **um** service e responde `204` **sem corpo** (`res.status(HTTP_STATUS.NO_CONTENT).send()`).
- `NO_CONTENT` já existe em `src/shared/http/http-status.ts`; nenhum status novo precisa ser acrescentado lá nesta feature.
- Instanciar `DeleteSpeciesService` na mesma fábrica, injetando o `PrismaSpeciesUsageCounter`. Manter o parâmetro de dependências da fábrica aberto para que os testes injetem um contador duplo sem tocar em Prisma.

### `src/domains/species/species.routes.ts` *(modify)*
- `DELETE /:id` → `authenticate`, `authorizeRole('admin')`, `validateRequest({ params: speciesIdParamSchema })`, `controller.remove`. Sem schema de corpo: a rota não aceita corpo.

---

## Acceptance Criteria

- [ ] **Given** uma espécie sem animais vinculados e sessão de `admin`, **When** `DELETE /api/species/:id`, **Then** responde `204` sem corpo, o registro deixa de existir e um `GET /api/species` seguinte não o traz (CT-22 / CA-16).
- [ ] **Given** o contador de vínculos respondendo `1` para a espécie `"Gato"`, **When** `DELETE`, **Then** responde `409 SPECIES_IN_USE` com "Não é possível excluir esta espécie porque existem animais vinculados a ela." e a espécie **continua** cadastrada (CT-24 / RN-08).
- [ ] **Given** o cenário anterior, **When** a transação é inspecionada após a resposta, **Then** a contagem de espécies é idêntica à de antes e nenhuma escrita foi confirmada (CT-25 / RNF-02).
- [ ] **Given** o contador de vínculos voltando a responder `0` para a mesma espécie, **When** `DELETE` é repetido, **Then** responde `204` e a espécie é removida (CT-26).
- [ ] **Given** o contador de vínculos respondendo `0` mas o banco recusando a remoção com `P2003`, **When** `DELETE`, **Then** a resposta é `409 SPECIES_IN_USE` — o mesmo `code` e a mesma mensagem da camada de aplicação, nunca `500` (RN-09 / CA-15).
- [ ] **Given** um `id` de espécie já excluída, **When** `DELETE`, **Then** `404 SPECIES_NOT_FOUND` com "Espécie não encontrada." (CT-27 / RN-14).
- [ ] **Given** `id` fora do formato UUID, **When** `DELETE`, **Then** `400 VALIDATION_ERROR` com `details: [{ field: "id", message: "Identificador inválido." }]` (CT-34).
- [ ] **Given** requisição sem sessão, **Then** `401 SESSION_EXPIRED`; **Given** sessão de `cliente`, **Then** `403 FORBIDDEN` — e em nenhum dos dois casos algum registro é removido (CT-30 / CT-31 / CT-32 / CA-18 / RN-01).
- [ ] **Given** a exclusão recusada por vínculo feita **diretamente à API**, sem passar pela interface, **When** processada, **Then** o desfecho é idêntico ao da tela — a proteção não depende do frontend (CT-32 / CA-15).
- [ ] `species-usage-counter.ts` não importa nem referencia o símbolo `Animal`, e a implementação Prisma provisória responde `0` sem consultar o banco.
- [ ] Nenhum arquivo do projeto declara `onDelete: Cascade` ou `onDelete: SetNull` apontando para `Species`.

---

## API Notes

- `DELETE /api/species/:id` → `204 No Content`, sem corpo. Erros: `400 VALIDATION_ERROR`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `404 SPECIES_NOT_FOUND`, `409 SPECIES_IN_USE`.
- **Pendência contratual herdada pela feature seguinte (Cadastro de pets)**: FK `animals.species_id` com `onDelete: Restrict`, substituição do corpo de `PrismaSpeciesUsageCounter` pela contagem real, e reexecução de CT-24, CT-25, CT-26 e CT-32 contra dados reais. Enquanto isso não ocorrer, a RN-08 está verificada apenas por duplo de teste — risco residual registrado na spec.

---

## Dependencies

- **Requires**: TASK-BACKEND-002 (repositório, controller, rotas), TASK-BACKEND-003 (`speciesIdParamSchema`), TASK-BACKEND-001 (`SpeciesInUseError`, `SpeciesNotFoundError`).
- **Blocks**: TASK-BACKEND-005 (testes), TASK-FRONTEND-010 (exclusão com confirmação consome este contrato). **Bloqueia por contrato** a conclusão da feature de Cadastro de pets, conforme as pendências acima.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADA
**Arquivos revisados**: 5 (2 criados, 3 modificados)

#### Resumo

Os 11 critérios de aceite estão implementados ou preparados exatamente como o contrato exige: ordem obrigatória dentro da transação respeitada, duas camadas de guarda com `code` e mensagem impossíveis de divergir, erros lançados de dentro da callback, ponto de troca da contagem isolado em um único arquivo e nenhuma propagação de exclusão para o agregado Animal. `npm run typecheck` sai em 0 e `npm test` roda 15 suítes / 138 testes verdes, sem regressão nos endpoints das TASK-BACKEND-002 e 003. Nenhum achado `critical` ou `major`. Um achado `minor` (documentação de handoff incompleta) e quatro `suggestion`.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/domains/species/repositories/species-usage-counter.ts` | L45, L50-54 | documentação / handoff | O `TODO` enumera três mudanças para a feature seguinte (trocar o corpo, restaurar `private readonly db`, renomear `_speciesId`), mas a lista está **incompleta**: falta remover `const NENHUM_ANIMAL_CADASTRADO = 0` (L45). Assim que o corpo virar `this.db.animal.count(...)`, a constante fica sem nenhuma referência e o `noUnusedLocals` do `tsconfig.json` **reprova o build** com `TS6133: 'NENHUM_ANIMAL_CADASTRADO' is declared but its value is never read` — reproduzido nesta revisão com `tsc --noUnusedLocals`. Não é um bug do código de hoje, é uma instrução de handoff que erra por omissão | Acrescentar um item 4 ao `TODO`: "remover a constante `NENHUM_ANIMAL_CADASTRADO`, que fica sem uso e quebra o `typecheck`" |
| 2 | suggestion | `src/domains/species/services/delete-species.service.ts` | L82-86 | comentário / precisão técnica | O comentário afirma que contagem e exclusão "precisam ver o MESMO instantaneo" e atribui à transação a garantia contra o animal órfão. No isolamento padrão do Prisma em Postgres (READ COMMITTED) a transação sozinha **não** fecha essa janela: um animal inserido e confirmado por outra sessão entre a contagem e o `DELETE` não seria visto pela contagem. Quem de fato fecha a janela é a **camada 2** — o `FOR KEY SHARE` que o `INSERT` toma sobre a linha da espécie faz o `DELETE` bloquear e depois falhar com `P2003`, já traduzido aqui. O desfecho está correto; o texto credita a garantia à camada errada | Ajustar o comentário para atribuir a atomicidade real à FK restritiva (reforçando por que as duas camadas são obrigatórias), ou avaliar `SELECT ... FOR UPDATE` na TASK-010 |
| 3 | suggestion | `src/domains/species/species.controller.ts` | L145 | padrão | `.send()` no `204` diverge de `auth.controller.ts:269`, que usa `.end()` no mesmo status. Verificado empiricamente no Express 4.22.2: as duas formas produzem resposta **byte a byte idêntica** (204, sem `Content-Type`, sem `Content-Length`, corpo vazio). A task escreve `.send()` literalmente e prevalece | Nenhuma ação obrigatória. Se a consistência intra-projeto for desejada, padronizar `.end()` nos dois pontos em uma task de higiene |
| 4 | suggestion | `src/domains/species/services/delete-species.service.ts` | L31 | comentário | O comentário cita `confirm-email.service.ts` e `refresh-session.service.ts` como origem de `{ maxWait: 10000, timeout: 15000 }`, mas `resend-confirmation.service.ts:20` também usa os mesmos valores. A lista está correta, só incompleta | Citar os três arquivos, ou trocar por "mesmos valores adotados nos services transacionais do domínio auth" |
| 5 | suggestion | `src/domains/species/services/delete-species.service.ts` | — | observabilidade (OWASP A09) | A exclusão é uma mutação destrutiva sobre entidade de catálogo e não emite log de auditoria (quem excluiu, qual espécie, quando). Não é desvio: `create-species.service.ts` e `rename-species.service.ts` também não logam, e o projeto ainda não tem padrão de log de mutação (`.makuco/codebase/concerns.md` registra apenas "logs da plataforma de hospedagem") | Decisão transversal, fora do escopo desta task. Registrar como candidato a ADR quando o padrão de auditoria for definido |

#### Julgamento das decisões declaradas

**1 — `SpeciesUsageCounter` como porta própria e ponto de troca único: CONFIRMADO, com ressalva na lista de mudanças.**
O símbolo `Animal` não aparece como import, tipo nem modelo de client em nenhum ponto (`grep` sobre os 5 arquivos): as únicas ocorrências são prosa de comentário e o trecho de código *dentro* do `TODO`. O único ponto de instanciação em produção é `species.controller.ts:173`, e ele **não muda** na troca: `PrismaClient` é atribuível a `Prisma.TransactionClient` (a interface é um `Omit` dele — mesmo raciocínio já documentado em `species.repository.ts:85-87`), então guardar o parâmetro amanhã não invalida a chamada de hoje. O ponto de troca está de fato único e localizado.
**A lista de três mudanças, porém, não é completa** — falta a remoção de `NENHUM_ANIMAL_CADASTRADO` (achado #1). É uma quarta edição mecânica e obrigatória: sem ela o `typecheck` da TASK-010 falha. Correta no que afirma, incompleta no que omite.

**2 — `constructor(_executor: Prisma.TransactionClient) {}` sem guardar o client: ALEGAÇÃO VERIFICADA E VERDADEIRA.**
Reproduzido com `tsc --strict --noUnusedLocals --noUnusedParameters` sobre `class A { constructor(private readonly _db: string) {} ... }`: `error TS6138: Property '_db' is declared but its value is never read`. O prefixo `_` de fato **não** isenta propriedades de parâmetro, só parâmetros comuns (`_speciesId` em L93 passa). Guardar o client hoje quebraria `npm run typecheck` e exigiria `@ts-expect-error` ou uso artificial. A decisão está certa e a justificativa no comentário está tecnicamente correta.

**3 — `withTransaction` devolvendo instância nova em vez de `this`: CORRETO.**
Devolver `this` seria uma armadilha exatamente pelo motivo alegado: o comportamento é indistinguível hoje (o corpo ignora o executor) e passaria a ser silenciosamente errado quando a contagem virar real, rodando fora da transação aberta pelo service. Some-se que `PrismaSpeciesRepository.withTransaction` (L136+) já devolve instância nova — devolver `this` aqui criaria duas semânticas diferentes para o mesmo nome de método dentro do mesmo domínio. Mantida.

**4 — `OPCOES_DE_TRANSACAO = { maxWait: 10000, timeout: 15000 }`: VERIFICADO NO CÓDIGO REAL.**
Os três arquivos citados usam exatamente esses valores: `confirm-email.service.ts:23`, `resend-confirmation.service.ts:20` e `refresh-session.service.ts:28`, os três na mesma forma `const OPCOES_DE_TRANSACAO = { ... } as const`. `register-user.service.ts:132-133` usa os mesmos dois valores inline. Este é o primeiro `$transaction` do domínio de espécies e adotar o default de 2 s do Prisma sobre um pooler com `connection_limit=1` produziria `P2028` → `500` numa exclusão legítima. Conformidade com padrão existente, não scope creep. Aprovada.

**5 — `.send()` em vez de `.end()`: A TASK PREVALECE.**
A task escreve `res.status(HTTP_STATUS.NO_CONTENT).send()` literalmente (linha 74 do contrato) e a task é o contrato. Além disso as duas formas são equivalentes na prática — ver achado #3, com a verificação empírica. Aprovada.

**6 — `deleteById` devolvendo `void`: CORRETO.**
É exatamente o que o contrato pede (linha 58 da task) e a justificativa em `species.repository.ts:139-145` é sólida: a resposta é `204` sem corpo, expor a linha removida só convidaria alguém a devolvê-la. O uso de `delete` e não `deleteMany` está correto e o `P2025` resultante é traduzido no service (L140-142). Aprovada.

**7 — `VINCULOS_QUE_JA_BLOQUEIAM = 1` com `>=`: ACEITÁVEL.**
`vinculados >= 1` e `vinculados > 0` são idênticos para o inteiro não negativo que `count` devolve; não há mudança de comportamento em nenhum valor possível. A constante nomeada atende a regra "sem números mágicos" das práticas do projeto e faz a linha se ler como a RN-08. Sem achado.

**8 — Atualização do comentário de cabeçalho de `species.repository.ts`: CORRETA E NECESSÁRIA.**
O texto anterior dizia que `delete` e a contagem "chegam na TASK-BACKEND-004" — deixá-lo intacto tornaria o cabeçalho **falso** logo abaixo do método que esta task acrescenta. É manutenção de comentário num arquivo que a própria task marca como `modify`, não expansão de escopo. Aprovada.

#### Verificações especiais solicitadas

- **Ordem dentro da transação**: CONFIRMADA. `findById` (L107) → `countAnimalsBySpecies` (L118) → `deleteById` (L124), com a escrita como **última** operação e nada depois dela dentro da callback. É o que torna seguro capturar `P2003`: se houvesse qualquer comando após o `DELETE`, ele falharia com `25P02` e mascararia a tradução. O mesmo raciocínio já está registrado em `create-species.service.ts:58-66`, e o comentário de L88-93 o cita corretamente.
- **Duas camadas com `code` e mensagem idênticos**: CONFIRMADAS. Camada 1 em L120-122 e camada 2 em L136-138 lançam a **mesma classe** `SpeciesInUseError`, cujo construtor não aceita parâmetro (`species.errors.ts:45-49`) e fixa `MESSAGES.SPECIES_IN_USE` + `'SPECIES_IN_USE'` + `HTTP_STATUS.CONFLICT`. Divergência entre as duas camadas é estruturalmente impossível. A mensagem em `species.messages.ts` bate caractere a caractere com o critério de aceite: "Não é possível excluir esta espécie porque existem animais vinculados a ela." Nunca `500`: qualquer outro motivo é relançado (L144) e o `error-handler` cuida.
- **`Cascade` proibido na FK Animal→Espécie**: CONFIRMADO. Os únicos `onDelete: Cascade` do projeto são `email_confirmation_tokens.user_id` e `refresh_tokens.user_id` (`schema.prisma:73,93` e `migrations/20260820145655_init/migration.sql:77,80`), ambos apontando para `users`. Nenhuma FK aponta para `species` em nenhuma migration, e a relação `animals` no modelo `Species` segue comentada com a exigência de `onDelete: Restrict` registrada ao lado (`schema.prisma:122-127`). Nada no código propaga exclusão nessa direção.
- **Erros lançados de dentro da callback**: CONFIRMADO. `SpeciesNotFoundError` (L110), `SpeciesInUseError` (L121) e os dois relançamentos do `.catch` (L137, L141) estão todos no corpo do `async (tx) => {}`. Nenhum erro é capturado e convertido fora da transação, então a rejeição da callback é o que dispara o `ROLLBACK` (CT-25 / RNF-02).
- **Invariantes**: todas mantidas. Controller sem Prisma (só recebe o client na fábrica de composição e o repassa — mesmo padrão de `auth.controller.ts:282-296`, onde `ConfirmEmailService(users, tokens, prisma)` tem a assinatura análoga a `DeleteSpeciesService(species, speciesUsage, prisma)`) e `remove` chama exatamente **um** service. Repositório sem erro HTTP. Corpo de erro só no `error-handler`. Nenhum `process.env`, nenhum `new Date()` (as duas ocorrências do termo são texto de comentário negando o uso), nenhum `any` em nenhuma das cinco formas pesquisadas. Comentários `.ts` sem acento — verificado com `grep -P` sobre os cinco arquivos, zero ocorrências; as strings ao usuário em `species.messages.ts` seguem acentuadas.
- **Escopo**: respeitado. `git status` mostra exatamente os 5 arquivos da tabela *Files*. `prisma/schema.prisma`, `src/routes/index.ts` e `src/shared/http/http-status.ts` intocados. Nenhuma tabela `animals`, nenhum modelo `Animal`, nenhuma FK criada.
- **Regressão**: nenhuma. O diff do controller é puramente aditivo — `list`, `create` e `rename` não têm uma linha alterada, e os três services continuam construídos de forma idêntica na fábrica. `SpeciesControllerDependencies` ganhou um campo obrigatório, mas o único chamador de `createSpeciesController()` é `species.routes.ts:36`, sem argumentos. `GET`, `POST` e `PATCH` mantêm middlewares, schemas e status inalterados. 15 suítes / 138 testes verdes.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 11 de 11 critérios implementados ou preparados conforme o contrato. Os critérios de comportamento HTTP (204/409/404/400/401/403) dependem da suíte da TASK-BACKEND-005 para virarem evidência executada; o código que os produz está inteiro e correto. Os dois critérios estruturais (ausência do símbolo `Animal`; ausência de `Cascade`/`SetNull` apontando para `Species`) foram verificados diretamente e passam. Nenhum achado.
**Pass 2 — Diff Analysis**: nenhum achado. 5 arquivos, exatamente os da tabela *Files*, todos com a ação declarada. Sem reformatação em massa, sem arquivo fora de escopo, sem expansão de escopo.
**Pass 3 — Code Practices**: nenhum achado bloqueante. Segregação de interfaces aplicada de forma exemplar na separação `SpeciesUsageCounter` × `SpeciesRepository`; inversão de dependência respeitada (o service depende das duas portas, nunca do Prisma para consultar); um nível de indentação por método com early return e sem `else`; sem números mágicos (`VINCULOS_QUE_JA_BLOQUEIAM`, `NENHUM_ANIMAL_CADASTRADO`, `HTTP_STATUS.NO_CONTENT`); sem abreviação; comentários explicam o *porquê*, não o *o quê*. Linguagem ubíqua conferida contra a tabela da task: `countAnimalsBySpecies`, `SpeciesUsageCounter`, `SpeciesInUseError` → `409 SPECIES_IN_USE`, todos alinhados.
**Pass 4 — Testing Review**: sem achado — testes são o escopo declarado da TASK-BACKEND-005 e a cobertura 0% nos arquivos novos é esperada aqui. Registro para a próxima task: o desenho facilita os dublês exatamente como previsto (`SpeciesUsageCounter` é um objeto de dois métodos sem conhecimento de espécies), e o parâmetro opcional de `createSpeciesController` permite injetar o contador duplo sem tocar em Prisma. A cobertura de 100% em caminho crítico se aplica a `delete-species.service.ts` — os cinco desfechos (204, 409 camada 1, 409 camada 2 via `P2003`, 404 via `findById`, 404 via `P2025`) precisam de teste próprio.
**Pass 5 — Security Review**: nenhum achado `critical` ou `major`. A01 — `authenticate` → `authorizeRole('admin')` → `validateRequest` na ordem correta, sem IDOR possível (espécie é recurso global de catálogo, não pertence a usuário). A03 — todo acesso por Prisma parametrizado, nenhuma interpolação. A04 — operação destrutiva guardada em duas camadas e sem limitador de taxa por decisão registrada (Decisão 7 do changelog), aplicável a CRUD administrativo autenticado. A05 — nenhuma mensagem de erro vaza detalhe interno; o `P2003`/`P2025` do ORM nunca chega ao cliente. A02/A06/A07/A08/A10 — sem superfície nova. A09 — achado #5 (`suggestion`).
**Pass 6 — Bug Detection**: nenhum bug. `findById` guarda o `null` antes de qualquer uso; sem race condition não coberta (ver achado #2 — a janela existente é fechada pela camada 2, e o `P2025` cobre a exclusão concorrente entre leitura e escrita); sem vazamento de recurso (a transação é gerenciada pelo `$transaction` e sofre `ROLLBACK` em qualquer caminho de erro); sem off-by-one (`>= 1` idêntico a `> 0` no domínio de `count`); sem coerção insegura (`===` em todas as comparações, inclusive `especie === null`); sem `catch` vazio (`throw motivo` relança o desconhecido); sem estado inconsistente (a única escrita é a última operação e é atômica).
**Pass 7 — Project Patterns**: nenhum achado bloqueante. Estrutura de pastas, kebab-case nos arquivos, `~/` nos imports, porta + implementação Prisma + `withTransaction` no mesmo arquivo, service transacional com `OPCOES_DE_TRANSACAO`, erro de domínio nomeando a regra, tradução de código do Prisma no service e nunca no repositório, PT-BR sem acento em comentário `.ts` — todos conformes ao que já existe no domínio auth e nas TASK-BACKEND-001 a 003. Achados #3 e #4 são desvios cosméticos de consistência.

#### Veredicto

> **APROVADA** — os 11 critérios de aceite estão atendidos, nenhum achado `critical` ou `major`. As oito decisões declaradas pelo agente foram julgadas e todas se sustentam; as duas alegações técnicas verificáveis (TS6138 no parâmetro de propriedade privada; valores de `maxWait`/`timeout` replicados de três services do domínio auth) foram reproduzidas e são verdadeiras.
>
> O único achado `minor` (#1) é de documentação de handoff, não de código, e **não bloqueia esta task** — mas deve ser corrigido antes de a TASK-010 da feature de animais começar, sob pena de o `typecheck` dela falhar por uma constante órfã que o `TODO` não avisa remover. Ponto exato: `services/backend/src/domains/species/repositories/species-usage-counter.ts`, acrescentar item 4 ao bloco `TODO` das linhas 50-54, referindo a constante da linha 45.
