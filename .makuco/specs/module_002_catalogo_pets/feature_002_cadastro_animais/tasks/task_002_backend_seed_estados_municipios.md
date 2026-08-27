# TASK-BACKEND-002 — Carga inicial de estados e municípios (recorte oficial do IBGE embarcado)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-seed-estados-municipios`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 2 of 18 — Fundação: Dados de Apoio
**Generated**: `2026-08-25`

---

## Context

Semeia as 27 unidades federativas e os cerca de 5.600 municípios brasileiros a partir de um recorte oficial do IBGE **embarcado no repositório como arquivo de dados**. A Decisão A da spec é o que esta task materializa: o IBGE continua sendo a **origem** do dado, mas como recorte aplicado na carga, nunca como dependência em tempo de execução (RN-27).

---

## Scope

**In:** Arquivo de dados com estados e municípios, módulo de carga idempotente e reexecutável, integração ao seed existente.

**Out:** Nenhuma chamada HTTP, em nenhum momento — nem no seed, nem em script auxiliar, nem em tempo de execução. Nenhum endpoint (TASK-BACKEND-005). Nenhuma tela de manutenção de estados e cidades: são dados de apoio, mantidos por carga (declarado fora de escopo pela spec). Não alterar o seed do usuário administrador entregue pela FEATURE-002 do MODULE-001 — apenas acrescentar a nova carga ao lado dele.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `prisma/data/brazilian-states-cities.json` | recorte IBGE embarcado |
| `create` | `prisma/seeds/geography.seed.ts` | carga idempotente |
| `modify` | `prisma/seed.ts` | invoca a nova carga |
| `modify` | `package.json` | gatilho `db:seed:geography` |

> **Emenda (2026-08-27, achado #1 da Rodada de Revisão 1)** — `package.json` foi acrescentado à tabela após a entrega. A tabela original previu o gatilho errado: supôs que o gancho `prisma.seed` bastasse. Ele não basta, porque esse gancho está ocupado pelo provisionamento do administrador, que é deliberadamente autoritativo e reescreve `passwordHash`, `role`, `status` e `emailConfirmedAt` a cada execução. Atualizar o recorte municipal — operação que se repete a cada mudança na divisão territorial — não pode custar uma reescrita da conta do administrador. Daí o script `db:seed:geography`, uma linha puramente aditiva que não toca o gancho `prisma.seed` nem o script `db:seed`. A exigência da tabela original (`seed.ts` chama `seedGeography`) continua valendo: são dois gatilhos, não uma substituição.

---

## Implementation

> **Reference pattern**: `prisma/seed.ts` já executa a carga do administrador inicial e define o estilo (idempotência por `upsert`, log do que foi criado, `prisma.$disconnect()` no fim).

### `prisma/data/brazilian-states-cities.json` *(create)*
**Diferenças em relação ao referencial:** não há referencial — é arquivo novo.
- Formato: `{ "states": [{ "uf": "AC", "name": "Acre", "cities": [{ "ibgeCode": 1200013, "name": "Acrelândia" }] }] }`.
- Exatamente 27 estados. Nomes de municípios com a acentuação oficial.
- `ibgeCode` é o código do município de 7 dígitos — a identidade estável pela qual uma futura atualização do recorte casa registros (RN-27, Decisão A).
- Arquivo versionado no repositório. Registrar no topo do JSON, em campo `_source`, a origem e a data do recorte, para que a próxima atualização saiba de onde veio.
- Carregar por `import` estático com `resolveJsonModule`, ou por `readFileSync` com caminho resolvido a partir de `__dirname` — **nunca** por caminho relativo ao diretório de trabalho, que difere entre `npm run seed` e execução de CI.

### `prisma/seeds/geography.seed.ts` *(create)*
- Exporta `seedGeography(prisma: PrismaClient): Promise<{ statesCreated: number; citiesCreated: number }>`.
- `upsert` de estado por `uf` e de cidade por `ibgeCode` — **casar por código oficial, jamais por nome**. Município renomeado é o mesmo município; casar por nome criaria um registro duplicado e deixaria animais apontando para o registro velho.
- Reexecutável sem efeito colateral: rodar duas vezes seguidas produz exatamente o mesmo estado do banco (é o que o critério de aceite verifica).
- Inserir em lotes (`createMany` com `skipDuplicates` para a primeira carga, ou `upsert` em blocos de algumas centenas). Um `upsert` por município em série custa ~5.600 idas ao banco e torna o seed inviável em CI.
- `stateId` de cada cidade vem do estado já semeado na mesma execução — resolver o mapa `uf → id` uma única vez e reutilizar, em vez de consultar por cidade.

### `prisma/seed.ts` *(modify)*
- Chamar `seedGeography(prisma)` **antes** da carga do administrador ou depois, indiferente — não há dependência entre as duas. Manter as duas em sequência, no mesmo `main()`, com log de quantos registros cada uma criou.

---

## Acceptance Criteria

- [ ] **Given** o banco vazio, **When** o seed é executado, **Then** `states` tem exatamente 27 linhas e `cities` tem o total do recorte, com "Campo Magro" pertencente a "PR" e "Boa Esperança" pertencente a "ES".
- [ ] **Given** o seed já executado, **When** ele é executado uma segunda vez, **Then** a contagem de `states` e de `cities` não muda e nenhum erro de chave duplicada ocorre.
- [ ] **Given** um município cujo nome mudou no recorte novo, **When** o seed é reexecutado, **Then** a linha existente é **atualizada** pelo `ibgeCode`, mantendo o mesmo `id` — animais vinculados continuam apontando para o mesmo registro.
- [ ] **Given** toda a rede externa bloqueada, **When** o seed é executado, **Then** ele conclui normalmente (RN-27, RNF-15).
- [ ] **Given** o seed concluído, **When** o administrador inicial é consultado, **Then** ele continua existindo com as mesmas credenciais — a carga nova não interferiu na existente.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (tabelas `states` e `cities`).
- **Blocks**: TASK-BACKEND-005 (endpoints não têm o que devolver sem a carga), TASK-BACKEND-007 (cadastro exige `cityId` existente), TASK-BACKEND-011.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 4 arquivos (`prisma/data/brazilian-states-cities.json`, `prisma/seeds/geography.seed.ts`, `prisma/seed.ts`, `package.json`)

#### Resumo

A carga de estados e municípios foi verificada por reprodução, não apenas por leitura: a segunda execução não emite uma única escrita, o snapshot completo de `cities` sai idêntico byte a byte (ids inclusive), uma divergência forçada de nome e de estado é corrigida pelo `ibgeCode` preservando o mesmo `id`, e um recorte adulterado derruba a carga antes de qualquer comando no banco. Os cinco critérios de aceite estão implementados, não há achado `critical` nem `major`, e todos os dados e arquivos tocados durante a revisão foram restaurados ao estado original.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `package.json` | L23 | escopo | Arquivo alterado fora da tabela *Files* da task, com o script `db:seed:geography`. A alteração é de uma linha, puramente aditiva: não toca o gancho `prisma.seed` nem o script `db:seed` | Manter a mudança e **corrigir a tabela *Files*** desta task para incluir `modify package.json` — o desvio é o registro que está faltando, não o código |
| 2 | minor | `prisma/seed.ts` | L148–L152 | bug | Com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` ausentes, `credenciaisDoAdmin()` lança e `executarSeed()` aborta **antes** de `seedGeography`. Em CI ou ambiente novo sem essas variáveis, `npm run db:seed` deixa `states` e `cities` vazias — dado que bloqueia TASK-BACKEND-005 e TASK-BACKEND-007. A task declara que "não há dependência entre as duas"; a ordem escolhida cria uma, no caminho de falha | Envolver cada carga em seu próprio tratamento de erro (ou inverter a ordem), para que a falha de uma não impeça a outra. Hoje só o gatilho dedicado `npm run db:seed:geography` contorna |
| 3 | minor | `prisma/seeds/geography.seed.ts` | L263–L272 | desempenho | `Promise.all` sobre um lote de até 1.000 `update` concorrentes. O Prisma enfileira no pool, mas sob o pooler do Supabase um recorte com muitas renomeações pode encostar no `pool_timeout` padrão de 10 s e falhar com `P2024` | Limitar a concorrência das correções (serializar, ou lotes de 20–50), como já é feito implicitamente nas inserções via `createMany` |
| 4 | minor | `prisma/seeds/geography.seed.ts` | L207, L274 | correção | `statesCreated`/`citiesCreated` devolvem `ausentes.length`, e não o `count` retornado por `createMany`. Com `skipDuplicates`, o número informado pode superar o realmente inserido. Afeta apenas o log | Somar o `count` devolvido por cada `createMany` |
| 5 | suggestion | `prisma/seeds/geography.seed.ts` | L217–L275 | prática | `semearMunicipios` tem ~59 linhas e quatro responsabilidades (montar desejados, diferenciar, inserir, corrigir), acima do limite de ~20 linhas do Object Calisthenics | Extrair `montarMunicipiosDesejados`, `inserirAusentes` e `corrigirDivergentes` |
| 6 | suggestion | `prisma/seeds/geography.seed.ts` | L73, L82–L114 | validação | A validação cobre truncamento no **nível da federação** (27 UFs) e repetição de `ibgeCode`, mas não truncamento **dentro** de uma UF: um recorte com MG contendo 1 município passa (`cities.min(1)`). Como a carga nunca apaga, o efeito seria silencioso — nada seria escrito e a tabela ficaria desatualizada sem aviso | Acrescentar um piso ao total de municípios do recorte (ou por UF) e falhar com mensagem legível |
| 7 | suggestion | `prisma/seeds/geography.seed.ts` | L34–L42 | clareza | O bloco JSDoc que explica a decisão de casar por `ibgeCode` está posicionado como documentação de `CODIGO_IBGE_MINIMO`, constante que ele não descreve | Mover a explicação para o cabeçalho do módulo e deixar sobre as constantes um comentário sobre o que elas são |
| 8 | suggestion | `prisma/seeds/geography.seed.ts` | L7 | acoplamento | `~/infra/prisma/prisma-client` é importado no topo, mas usado só dentro do bloco `require.main`. O import tem efeito colateral (constrói o `PrismaClient` e dispara a validação de `env`) mesmo quando `seed.ts` só quer a função. Hoje é inofensivo — `tests/setup.ts` já injeta uma `DATABASE_URL` sintética | Trazer o singleton por `require` dentro do bloco autoexecutável, isolando o efeito colateral do caminho de biblioteca |
| 9 | suggestion | `jest.config.ts` | L—(`collectCoverageFrom`) | teste | `collectCoverageFrom` cobre `src/**/*.ts`; `prisma/seeds/geography.seed.ts` vive fora de `src/` e ficará **fora da métrica de cobertura** mesmo depois dos testes da TASK-BACKEND-011 | Registrar na TASK-BACKEND-011 a inclusão de `prisma/seeds/**/*.ts` em `collectCoverageFrom` |
| 10 | suggestion | `package.json` | L23 | dependência | O novo script invoca `ts-node`, que não é dependência direta — resolve transitivamente via `ts-node-dev`. É o mesmo padrão já usado pelo gancho `prisma.seed`, então não é regressão | Promover `ts-node` a `devDependency` explícita, em task própria, junto com o gancho existente |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 5 de 5 critérios de aceite implementados e **reproduzidos**.

- **CA-1 (27 UFs, total do recorte, Campo Magro/PR, Boa Esperança/ES)** — `states = 27`, `cities = 5571`. O recorte tem 5.570 municípios mais Brasília/DF, e o DF **tem** cidade (`ibgeCode 5300108`, `Brasília`), que é o que o formulário exige. Contagem por UF conferida contra a divisão oficial (MG 853, SP 645, RS 497, BA 417, PR 399, SC 295, GO 246, PI 224, PB 223, MA 217, PE 185, CE 184, RN 167, PA 144, MT 142, TO 139, AL 102, RJ 92, MS 79, ES 78, SE 75, AM 62, RO 52, AC 22, AP 16, RR 15, DF 1). No banco: `Campo Magro → PR (Paraná)`, `ibgeCode 4104253`; `Boa Esperança` existe em `ES (3201001)`, além das homônimas em `MG (3107109)` e `PR (4103008)` — as três coexistem porque o casamento é por código, não por nome. 702 municípios com `ã` confirmam a acentuação oficial preservada. O caminho de criação foi exercitado dentro de uma transação revertida: apagados 25 municípios e a UF `AC`, `seedGeography` devolveu `{"statesCreated":1,"citiesCreated":25}` e recompôs 27/5571 com as associações corretas.
- **CA-2 (reexecução sem mudança)** — 2ª execução: `0 estado(s) e 0 municipio(s) criados`, e o log de comandos mostra **apenas dois `SELECT`** — nenhum `INSERT`, nenhum `UPDATE`. Snapshot completo de `cities` (`id`, `ibgeCode`, `name`, `stateId`, 5.571 linhas) e de `states` comparado por `cmp` contra o da execução anterior: **idêntico byte a byte, ids inclusive**. Nenhum erro de chave duplicada.
- **CA-3 (renomeação corrigida mantendo o `id`)** — `Campo Magro` (id `84738077-a82d-4233-87e6-6022e993f647`) foi forçado para `Campo Magro ADULTERADO` **e** movido para `SP`, e `Paraná` para `Parana ADULTERADO`. A reexecução emitiu exatamente um `UPDATE ... WHERE ibge_code = $3` e um `UPDATE ... WHERE uf = $2`, restaurando nome e estado **com o mesmo `id`**, sem duplicata e sem delete+insert. `cmp` contra o snapshot original: idêntico.
- **CA-4 (rede externa bloqueada)** — não há chamada HTTP em lugar nenhum do entregável (ver Pass 5). A carga lê apenas o arquivo local.
- **CA-5 (administrador intacto)** — depois de todas as execuções da carga, a linha do admin permanece `passwordHash` iniciando em `$2b$12$olc3DKh7gddmz`, `role ADMIN`, `status ACTIVE`, `updatedAt 2026-08-24T20:25:25.528Z`, `emailConfirmedAt 2026-08-24T20:25:23.301Z` — inalterada, inclusive `updatedAt`.

**Pass 2 — Diff Analysis**: Achado #1. Os três arquivos da tabela *Files* foram criados/modificados como indicado. Uma quarta alteração fora da tabela: `package.json`, uma linha, o script `db:seed:geography`. Nenhum outro arquivo tocado (`git status` mostra exatamente 2 modificados e 2 não rastreados). Nenhuma formatação em massa, nenhum arquivo do "Scope — Out" alterado, nenhum script de download commitado. O JSON não é ignorado pelo `.gitignore` (`git check-ignore` retorna 1) e está formatado com um município por linha, ordenado por UF e por nome — diff legível numa futura atualização do recorte.

**Pass 3 — Code Practices**: Achados #5, #7. Sem `any` no código (as três ocorrências do termo são texto de comentário explicando justamente que o `any` do `JSON.parse` é eliminado pelo Zod). Comentários sem acento, mensagens de log sem acento — consistente com todo o backend, onde a acentuação fica nas mensagens ao usuário final (`src/domains/auth/auth.messages.ts`) e não nos logs de operador (`src/middlewares/error-handler.middleware.ts`, `src/index.ts`). Early return e guarda no lugar de `else` em `lerRecorte` e em `semearMunicipios`. Nomes sem abreviação. Números mágicos extraídos (`TOTAL_DE_UNIDADES_FEDERATIVAS`, `TAMANHO_DO_LOTE`, `CODIGO_IBGE_MINIMO/MAXIMO`). Injeção de dependência respeitada: `seedGeography(prisma)` recebe o cliente, não o instancia — foi o que permitiu exercitá-la dentro de uma transação revertida nesta revisão. Nomenclatura interna em português com contrato exportado em inglês (`seedGeography`, `statesCreated`, `citiesCreated`) reproduz o padrão já estabelecido em `prisma/seed.ts` e casa com a linguagem ubíqua do schema (`states`, `cities`, `ibgeCode`).

**Pass 4 — Testing Review**: Achado #9. Esta task não entrega testes por definição (são da TASK-BACKEND-011) — não é achado. `npm test` continua verde: 20 suítes, 270 testes. `npm run typecheck` sai com 0 nos três projetos, incluindo `tsconfig.seed.json`, que é quem cobre `prisma/**/*.ts`. Registrado apenas que o arquivo, por viver fora de `src/`, cairá fora da métrica de cobertura quando os testes chegarem.

**Pass 5 — Security Review**: Nenhum achado. Superfície de ataque nula: sem entrada de usuário, sem rede, sem segredo.

- **A03 (Injection)**: nenhuma interpolação em SQL — o log de comandos mostra tudo parametrizado (`WHERE "ibge_code" = $3`). O recorte é dado do próprio repositório e ainda assim passa por Zod antes de qualquer uso.
- **A10 / RN-27 (chamada externa)**: **confirmado que não existe nenhuma**, no entregável inteiro. `grep` por `fetch`, `axios`, `undici`, `node-fetch`, `http(s)://`, `curl` e `XMLHttpRequest` sobre `prisma/**` só casa dentro do campo `_source` do JSON — que é **documentação da procedência** (`base`, `endpoints`, `dataDoRecorte`), string inerte, nunca dereferenciada por código. Não há diretório `scripts/`, nem script de download commitado em lugar nenhum do repositório. A execução com o recorte truncado prova o ponto por outro ângulo: a carga falha lendo o arquivo local, sem tentar buscar nada.
- **A02 (Cryptographic Failures)**: nenhum segredo, nenhuma credencial, nenhum dado pessoal no arquivo ou no módulo. A carga não lê nem escreve em `users`.
- **A06 (Componentes)**: nenhuma dependência nova — `zod@^3.24.1` já era dependência do projeto.
- **A09 (Logging)**: falha registrada com mensagem legível e `process.exitCode = 1`, sem `catch` vazio e sem PII no log. O `prisma:query` verboso vem de `src/infra/prisma/prisma-client.ts` e é restrito a não-produção — pré-existente, fora do escopo.
- Demais itens (A01, A04, A05, A07, A08) não se aplicam: o módulo não tem fronteira de confiança, não expõe endpoint e não desserializa entrada não confiável.

**Pass 6 — Bug Detection**: Achados #2, #3, #4, #6. Verificações que **passaram**:

- **Validação antes da escrita** — confirmado por teste destrutivo com restauração. Recorte truncado para 26 UFs: a carga falha com `o recorte deve conter exatamente 27 unidades federativas`, saída 1, e **nenhum comando é emitido ao banco — nem um `SELECT`**. Prova adicional: uma cidade havia sido adulterada no banco de propósito antes da execução, e continuou adulterada depois do abort, ou seja, não houve escrita alguma. Recorte com `ibgeCode` repetido (4104253 injetado em SP): falha com `codigo IBGE repetido no recorte: 4104253`, saída 1, mesma ausência de escrita. Arquivo restaurado (md5 idêntico ao entregue).
- **Resolução de caminho por `__dirname`** — confirmado. Execução a partir da raiz do monorepo (cwd diferente de `services/backend`) localizou o recorte e concluiu normalmente. A mensagem de erro do teste anterior imprime o caminho absoluto resolvido, que aponta para `prisma/data/` independentemente do cwd. Como `tsconfig.seed.json` é `noEmit` e o seed roda por `ts-node`, não existe cópia em `dist/` para o `__dirname` errar.
- **O bloco autoexecutável não dispara no import** — confirmado por sonda: um arquivo que apenas importa `./seeds/geography.seed` executa até o fim sem emitir **nenhum** comando ao banco. `require.main === module` funciona porque o projeto é `"type": "commonjs"`.
- **Sem `delete` + `insert`** — a divergência é resolvida por `UPDATE`; o `id` sobrevive. Correto também por outra razão: `animals.city_id` é `onDelete: Restrict`, então um delete nem passaria com animais vinculados.
- **Sem vazamento de recurso** — `seedGeography` não desconecta (quem abriu o cliente é quem fecha); o bloco autoexecutável fecha no `.finally`. Não há duplicação de `PrismaClient`: `seed.ts` e `geography.seed.ts` importam o mesmo singleton.
- **Sem `catch` vazio, sem coerção implícita, sem off-by-one** — `emLotes` usa `inicio < itens.length` com `slice`, correto nas bordas; comparações são estritas; `stateId` ausente aborta com mensagem explícita antes de montar qualquer `createMany`.
- **Limite de parâmetros** — lote de 1.000 municípios × 3 colunas = 3.000 parâmetros, muito abaixo do teto do PostgreSQL.

**Pass 7 — Project Patterns**: Achados #8, #10. Nome de arquivo `geography.seed.ts` segue o sufixo por papel já usado em `src` (`*.service.ts`, `*.messages.ts`, `*.routes.ts`). Ordem de imports (builtins do Node → externos → alias `~/` → relativos) igual à do restante do backend. Tratamento de erro no mesmo estilo de `prisma/seed.ts`: `process.exitCode` em vez de `process.exit`, mensagem sem stack, `$disconnect` no `finally`. Log com o prefixo `[catdog-backend]`. Fluxo de dependência sem inversão de camada e sem ciclo — o seed depende de `~/infra`, nunca o contrário. `tsconfig.seed.json` já cobria `prisma/**/*.ts`, então o novo arquivo entra no `typecheck` sem ajuste.

#### Decisões declaradas — parecer

1. **`package.json` fora da tabela *Files*** — **justificado**. A tabela previu o gatilho errado. O gancho `prisma.seed` já pertence a um provisionamento deliberadamente autoritativo, que reescreve `passwordHash`, `role`, `status` e `emailConfirmedAt` a cada execução; atualizar o recorte municipal — operação que se repete a cada mudança na divisão territorial — não pode custar uma reescrita da conta do administrador. A saída de dois gatilhos resolve exatamente isso, mantendo a exigência da tabela (`seed.ts` chama `seedGeography`) intacta. O desvio é de uma linha aditiva, não altera comportamento existente e foi verificado nos dois sentidos: `db:seed:geography` roda só a geografia, e o import por `seed.ts` não dispara o bloco autoexecutável. Registrado como #1 só para a tabela ser corrigida.
2. **Aquisição do recorte por captura única, sem script commitado** — **correta e verificada**. Não há chamada HTTP em nenhum ponto do entregável (ver Pass 5). O campo `_source` documenta origem, endpoints e data do recorte sem criar dependência: é a informação que a próxima atualização precisa e que, sem ela, se perderia. Não commitar o script de download é defensável — um script de download versionado é um convite a alguém rodá-lo em CI —, e o `_source` cumpre o papel de rastreabilidade que ele teria.
3. **Sem transação interativa sobre os ~5.600 inserts** — **aceito**. O argumento está certo: o timeout padrão do `$transaction` é de 5 s e a carga completa não cabe nele sob o pooler. E a justificativa vale porque a idempotência é real, não alegada: verifiquei que uma reexecução completa não escreve nada e que ela reconstrói exatamente o que falta. Uma carga interrompida no meio se resolve rodando de novo. Cada lote é atômico por si. A ressalva é a concorrência de 1.000 `update` do achado #3, que é questão de pool, não de atomicidade.
4. **Zod em vez de `import` estático com `resolveJsonModule`** — **correta, e por razão melhor do que a alegada**. A economia no `tsc` é real (o compilador infere o tipo literal do JSON em cada um dos três projetos), mas o ganho principal é outro: com `import` estático o arquivo entra no binário sem verificação alguma, e um recorte truncado semearia meia federação em silêncio. O Zod é o que transforma corrupção do recorte em falha barulhenta antes da primeira escrita — comprovado nos dois testes de adulteração. A task admitia as duas formas; esta é a mais defensável.
5. **5571 municípios** — **número correto**. 5.570 municípios mais Brasília/DF, que é o que o formulário precisa para que o DF não apareça sem cidade. Contagem por UF conferida contra a divisão oficial, sem código repetido e sem código fora da faixa de 7 dígitos.
6. **Ordem no `seed.ts`: admin primeiro, geografia depois** — **aceita, com a ressalva do achado #2**. A task declara a ordem indiferente e nenhum critério de aceite depende dela. A justificativa (o admin destrava o acesso; a geografia é dado de apoio reexecutável sozinho) é razoável. O que a escolha introduz é um acoplamento no caminho de falha que a task supunha não existir: sem `SEED_ADMIN_*`, a geografia não roda.

#### Veredicto

> **APROVADO** — os 5 critérios de aceite estão implementados e foram reproduzidos, não apenas lidos. Nenhum achado `critical` ou `major`. Os 4 achados `minor` e 6 `suggestion` ficam registrados para tratamento oportuno e **não bloqueiam** o fechamento da TASK; recomenda-se tratar #1 (corrigir a tabela *Files*) junto com o commit desta entrega e levar #9 para a TASK-BACKEND-011.
>
> **Integridade do ambiente após a revisão**: banco restaurado ao estado exato de baseline — snapshots de `cities` (5.571 linhas) e `states` (27) idênticos por `cmp` ao capturado antes da revisão, ids inclusive; `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `animals` 0, `animal_images` 0; linha do administrador inalterada. Recorte JSON restaurado (md5 `725f85f9b487cd2d26c4a6128368765e`, idêntico ao entregue). Sondas temporárias removidas; `git status` mostra exatamente os 4 arquivos da entrega.

---

### Rodada de Revisão 2 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 4 arquivos (`prisma/data/brazilian-states-cities.json`, `prisma/seeds/geography.seed.ts`, `prisma/seed.ts`, `package.json`)
**Escopo**: verificação das correções dos achados #1–#4 da Rodada 1 e regressão do que a Rodada 1 aprovou.

#### Resumo

Três das quatro correções estão certas e foram medidas, não lidas: a composição das cargas (#2) foi reproduzida nos quatro cenários de falha e se comporta exatamente como declarado, os contadores (#4) passaram a somar o `count` real, e a tabela *Files* (#1) foi emendada. A quarta (#3) **não funciona**: o lote de 25 foi calibrado contra o `pool_timeout` de 10 s ignorando o `connection_limit=1` que está na mesma string de conexão, e o `P2024` que o achado pedia para eliminar foi **reproduzido duas vezes**, com apenas 50 municípios divergentes, saída 1 e correção aplicada pela metade. Sob uma única conexão o tamanho do lote é irrelevante: 25 e 1.000 falham no mesmo ponto. Nada do que a Rodada 1 aprovou regrediu, e todo o ambiente foi restaurado ao baseline exato.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 11 | major | `prisma/seeds/geography.seed.ts` | L54–L63, L296–L305 | bug | `TAMANHO_DO_LOTE_DE_CORRECOES = 25` **não resolve o achado #3**. Com o `.env` do projeto (`connection_limit=1`, `pool_timeout=10`) e 50 municípios divergentes, a carga falha com `P2024 — Timed out fetching a new connection from the connection pool`, saída 1, após aplicar só 13–14 das 50 correções. Reproduzido duas vezes. Latência medida: **933 ms por `update`**; sob `Promise.all` com **uma** conexão o 25º comando espera ~22,4 s por uma conexão, **2,24× o `pool_timeout`**. O limiar de falha (~11 correções) é ditado por latência e timeout, **não** pelo tamanho do lote: 25 e 1.000 quebram no mesmo ponto, então a mudança é inerte para este modo de falha. O JSDoc em L54–L63 ("limita a concorrencia a um punhado de conexoes por vez") descreve um mecanismo que não existe sob `connection_limit=1` — há sempre exatamente uma conexão | **Serializar as correções** (`for … await`, lote 1). Com uma conexão o `Promise.all` não dá ganho algum de throughput — o pool serializa de qualquer forma — e só consome o orçamento do `pool_timeout`. 50 correções em série custam ~47 s, preço irrelevante para operação de manutenção. Se a concorrência for mantida, o lote precisa ser `≤ floor(pool_timeout / latência)` e passa a depender de duas variáveis de ambiente, o que é frágil. Corrigir o JSDoc junto |
| 12 | suggestion | `prisma/seed.ts` | L167–L213 | design | `CargaDoSeed` (`nome` + `executar`) não tem como expressar dependência entre cargas. Hoje está correto — as duas são genuinamente independentes —, mas uma carga futura que dependa de outra rodaria mesmo após a predecessora falhar, produzindo um erro secundário confuso em vez de ser pulada | Não criar salvaguarda agora (seria especulativo, YAGNI). Quando surgir a terceira carga, acrescentar um campo `dependeDe?: string` e pular quem tem predecessora em `falharam` — o laço já tem a lista pronta para isso |

**Achados da Rodada 1 — situação após a correção**

| # | Rodada 1 | Situação | Evidência |
|---|---|---|---|
| 1 | minor / escopo | **Resolvido** | `package.json` na tabela *Files* (L32) com a nota de emenda (L34) |
| 2 | minor / bug | **Resolvido** | Quatro cenários reproduzidos abaixo |
| 3 | minor / desempenho | **Não resolvido — escalado para `major` (#11)** | `P2024` reproduzido, saída 1 |
| 4 | minor / correção | **Resolvido** | Duplo de teste com `count` forçado |
| 5–10 | suggestion | Seguem abertos por decisão declarada | — |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 5 de 5 critérios de aceite seguem implementados. Nenhuma regressão. CA-3 (renomeação corrigida mantendo o `id`) passa para renomeações isoladas, mas ver #11 quanto ao volume: a operação que a própria Emenda descreve como recorrente ("a cada mudança na divisão territorial") quebra acima de ~11 municípios renomeados.

**Pass 2 — Diff Analysis**: Nenhum achado. `git status` mostra exatamente os mesmos 4 arquivos da entrega (2 modificados, 2 não rastreados) mais o próprio arquivo da task. Nenhum arquivo novo, nenhuma formatação em massa, nada do "Scope — Out" tocado. O `package.json` continua com uma única linha aditiva, sem tocar o gancho `prisma.seed` nem o script `db:seed`.

**Pass 3 — Code Practices**: Nenhum achado novo. A extração de `cargaDoAdministrador`/`cargaDaGeografia` **melhorou** o `executarSeed`: cada função faz uma coisa, e o laço de composição tem um nível de indentação. `CargaDoSeed` como interface nomeada em vez de tupla anônima é acerto de clareza. O #5 da Rodada 1 (tamanho de `semearMunicipios`) segue aberto por decisão. Ressalva registrada em #11: um JSDoc que descreve mecanismo inexistente é pior que a ausência dele, porque transmite ao próximo mantenedor o mesmo modelo mental errado que produziu o defeito.

**Pass 4 — Testing Review**: Nenhum achado novo. Esta task não entrega testes por definição (TASK-BACKEND-011). Gates reproduzidos por mim: `npm run typecheck` **saída 0** nos três projetos; `npm test` **20 suítes / 270 testes, saída 0**. O #9 da Rodada 1 (`collectCoverageFrom`) segue endereçado à TASK-BACKEND-011.

**Pass 5 — Security Review**: Nenhum achado. Superfície inalterada pela correção: sem entrada de usuário, sem rede, sem segredo. A composição nova não introduz fronteira de confiança. **A09 (Logging)**: a mudança é positiva — a falha de cada carga é nomeada no `stderr` e o resumo relança; nenhum `catch` vazio, nenhum PII, nenhuma stack. **A03**: nada de novo em SQL; o recorte segue validado por Zod antes de qualquer uso. **A10 / RN-27**: nenhuma chamada de rede introduzida.

**Pass 6 — Bug Detection**: Achado #11. Verificações executadas contra o banco e contra duplo de teste:

- **#2 — cenário A (sem `SEED_ADMIN_*`)**: apaguei 5 municípios antes de rodar, para que a geografia tivesse escrita real a fazer. Resultado: `Carga "administrador" falhou: … defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD …`, em seguida `Geografia semeada: 0 estado(s) e 5 municipio(s) criados`, resumo `1 de 2 carga(s) falharam (administrador)`, **saída 1**, `INSERT=1 UPDATE=0`. A geografia **carrega de fato**, não apenas executa. O admin não sofreu escrita — a verificação de credenciais aborta antes.
- **#2 — cenário B (tudo presente)**: `Administrador provisionado` + `Geografia semeada: 0 e 0`, **saída 0**.
- **#2 — cenário C (as duas falham)**: sem `SEED_ADMIN_*` e com o recorte truncado para 26 UFs. As duas mensagens saem nomeadas, resumo `2 de 2 carga(s) falharam (administrador, geografia)`, **saída 1**, e **zero comandos ao banco — nem um `SELECT`**. Confirma de novo que o Zod derruba antes de qualquer escrita.
- **#2 — cenário D (geografia falha, admin passa)**: `Administrador provisionado` (`INSERT=1` em `users`), `Carga "geografia" falhou: Recorte … invalido`, resumo `1 de 2 (geografia)`, **saída 1**. Em nenhum dos quatro caminhos o erro é engolido.
- **#3 — concorrência medida, não lida**: duplo de teste injetado em `seedGeography(prisma)` (possível porque o cliente é parâmetro). Com os 5.571 municípios divergentes, **máximo de 25 `city.update` em voo**; com os 27 estados divergentes, **máximo de 25 `state.update` em voo** — a disciplina foi mesmo estendida ao laço de estados. `createMany` de municípios permanece em `[1000, 1000, 1000, 1000, 1000, 571]`, soma 5.571, lote máximo 1.000.
- **#3 — o limite de 25 não basta**: contra o banco real, 50 municípios adulterados. `npm run db:seed:geography` falhou com `P2024` apontando `geography.seed.ts:299`, `(Current connection pool timeout: 10, connection limit: 1)`, **saída 1**, 14 `UPDATE` aplicados na 1ª tentativa e 13 na 2ª. Latência aferida: 25 `update` **em série** levam 23.332 ms (média 933 ms). Ver #11.
- **#4 — contadores**: duplo de teste com `createMany` devolvendo `count` forçado (7 por lote de municípios, 3 para estados) sobre 6 lotes. `seedGeography` retornou `{"statesCreated":3,"citiesCreated":42}` — exatamente `3` e `6 × 7`. Se ainda usasse `ausentes.length`, teria retornado `27` e `5571`. Corrigido de fato.
- **Idempotência (regressão)**: duas execuções consecutivas de `db:seed:geography` emitiram **2 `SELECT` e nenhum `INSERT`/`UPDATE`/`DELETE`** cada, log `0 estado(s) e 0 municipio(s) criados`, saída 0.
- **Casamento por `ibgeCode` e preservação de `id` (regressão)**: dos 50 municípios adulterados, **os 50 mantiveram o `id` original**; os 26 que o seed alcançou voltaram ao nome exato do baseline. A UF `AC`, adulterada junto, foi corrigida por `update` (o laço de estados processa só os divergentes, 1 no caso, então não encostou no limite).
- **Resolução por `__dirname` (regressão)**: `seedGeography` executada com `process.cwd() === '/'` concluiu normalmente.
- **Recuperação parcial**: a falha do #11 deixa a correção pela metade e o processo em saída 1; a reexecução avança mais ~13 por vez. Converge, mas um recorte com 200 renomeações exigiria ~16 execuções.

**Pass 7 — Project Patterns**: Nenhum achado novo. Nomes de arquivo, ordem de imports, prefixo `[catdog-backend]`, `process.exitCode` em vez de `process.exit`, mensagem sem stack e `$disconnect` no `finally` seguem no padrão do backend. Comentários e logs sem acento, coerente com o restante. A mensagem do `catch` final passou de "Seed do administrador falhou" para "Seed falhou", o que é correto agora que ele cobre duas cargas.

#### Decisões declaradas — parecer

1. **Lista de cargas nomeadas em vez de `Promise.allSettled`** — **correta**. Execução sequencial é a escolha certa sob `connection_limit=1` (com uma conexão, paralelizar cargas só cria contenção), o log fica determinístico e a composição é extensível. Os quatro cenários confirmam que o erro não é engolido em caminho nenhum. Ironicamente, é o mesmo raciocínio que falta em #11: o autor aplicou "uma conexão, então sequencial" na composição das cargas e não o aplicou nos `update`.
2. **`TAMANHO_DO_LOTE_DE_CORRECOES = 25` como "chute informado"** — **não aceitável, e a medição derruba**. Não é questão de faltar medição por rigor: o número está errado por um fator de ~2,5 no ambiente que o próprio `.env` configura, e o modo de falha que ele deveria eliminar foi reproduzido. O erro de raciocínio é localizável — calibrou-se contra o `pool_timeout` ignorando o `connection_limit=1` que está na mesma string de conexão. Com uma conexão, concorrência N não divide a espera, multiplica: o N-ésimo comando espera `(N−1) × latência`. Ver #11.
3. **Separar `TAMANHO_DO_LOTE_DE_CORRECOES` de `TAMANHO_DO_LOTE`** — **correta em princípio**. As duas constantes governam grandezas distintas (uma limita concorrência, a outra parâmetros por comando) e merecem nomes distintos. O defeito está no valor e no comentário, não na separação.
4. **Estender a disciplina ao laço de estados** — **correta**. A Rodada 1 não flagrou e deveria ter flagrado: são 27 `update` possíveis, acima do limiar de ~11. Medido em 25 em voo no máximo. O valor herda o defeito de #11, mas o alcance é pequeno (renomeação de UF é rara).
5. **Isolamento troca "para no primeiro erro" por "roda tudo e reporta o conjunto"** — **correta, sem salvaguarda agora**. É exatamente o que o achado #2 pedia, e as duas cargas são de fato independentes. O alerta do agente é legítimo mas prematuro: criar hoje um mecanismo de dependência para um caso que não existe é especulação. Registrado como #12 com a mitigação barata para quando a terceira carga aparecer.
6. **Contadores pelo `count` real** — **correta**. Comprovada por duplo de teste, não por leitura.

#### Ponto declarado pelo agente — registro e correção

O agente declarou que rodar `npm run db:seed` (cenário B) mudou **`admin.updatedAt`** de `2026-08-24T20:25:25.528Z` para `2026-08-27T14:22:41.905Z`. **A declaração está incompleta**: mudaram **três** campos, não um.

| Campo | Rodada 1 | Baseline desta rodada | Por quê |
|---|---|---|---|
| `passwordHash` | `$2b$12$olc3DKh7gddmz…` | `$2b$12$/RoMmbC/nQ0xY…` | reescrito pelo `update` do `upsert` (bcrypt, salt novo a cada execução) |
| `emailConfirmedAt` | `2026-08-24T20:25:23.301Z` | `2026-08-27T14:22:40.720Z` | reescrito pelo `update` do `upsert` |
| `updatedAt` | `2026-08-24T20:25:25.528Z` | `2026-08-27T14:22:41.905Z` | `@updatedAt` do Prisma |

**Nada além disso mudou** — confirmado por comparação do snapshot completo de `users`: `id`, `name`, `email`, `role`, `status` e `createdAt` inalterados; `users` segue 2. E é **exatamente o comportamento projetado**: o bloco `update` do `prisma.user.upsert` (L106–L111 de `prisma/seed.ts`) escreve `passwordHash`, `role`, `status` e `emailConfirmedAt` por design — o provisionamento é deliberadamente autoritativo, como a Emenda e o próprio JSDoc de `provisionarAdmin` declaram. `role` e `status` não *aparecem* alterados apenas porque já valiam `ADMIN`/`ACTIVE`. Não é achado; é a razão de existir do gatilho `db:seed:geography`, e o episódio a ilustra bem.

**O provisionamento do administrador em si não foi alterado.** O diff de `prisma/seed.ts` não toca `credenciaisDoAdmin`, `provisionarAdmin` nem `avisarSobreAdminsExtras`: a única mudança é o corpo do antigo `executarSeed` ter sido renomeado para `cargaDoAdministrador`, mais a mensagem do `catch` final. Nenhuma linha com `upsert`, `hashPassword`, `UserRole` ou `UserStatus` aparece no diff.

#### Veredicto

> **REPROVADA** — 1 achado `major` (#11). As correções de #1, #2 e #4 estão certas e foram reproduzidas; a de #3 **não funciona** e o `P2024` que ela deveria eliminar foi reproduzido duas vezes, com saída 1 e escrita parcial, no ambiente que o `.env` do projeto configura. Encaminhar ao `makuco-codegen` para serializar as correções (`TAMANHO_DO_LOTE_DE_CORRECOES = 1`, ou laço `for … await` sem `Promise.all`) e corrigir o JSDoc de L54–L63, que documenta um mecanismo inexistente sob `connection_limit=1`. O `TAMANHO_DO_LOTE = 1_000` do `createMany` **não deve ser tocado** — está medido e correto. O achado #12 é `suggestion` e não bloqueia.
>
> **Integridade do ambiente após a revisão**: banco restaurado ao baseline **exato** — snapshots de `states` (27), `cities` (5.571) e `users` (2) idênticos por `cmp`, **ids inclusive**, incluindo a linha do administrador (restaurada por SQL cru, já que `updatedAt` é `@updatedAt`) e os 5 municípios apagados no cenário A (recriados com o `id` original). Contagens finais: `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571, `animals` 0, `animal_images` 0. `.env` restaurado e conferido por md5 (`37f2e71185603a7ef52cae3e796d3cf4`); recorte JSON restaurado e conferido por md5 (`725f85f9b487cd2d26c4a6128368765e`); `package.json`, `seed.ts` e `geography.seed.ts` com md5 idêntico ao do início da revisão. Sondas temporárias removidas; `git status` mostra exatamente os 4 arquivos da entrega mais este arquivo de task.

---

### Rodada de Revisão 3 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 4 arquivos (`prisma/data/brazilian-states-cities.json`, `prisma/seeds/geography.seed.ts`, `prisma/seed.ts`, `package.json`)
**Escopo**: verificação da correção do achado `major` #11 da Rodada 2 e regressão de tudo o que as Rodadas 1 e 2 aprovaram.

#### Resumo

O achado #11 está **resolvido e medido nos dois sentidos**: o cenário que a Rodada 2 usou para reprovar — 50 municípios adulterados — agora corrige **as 50**, sem `P2024`, com saída 0 e os 50 `id` preservados; e a serialização foi aferida por instrumentação, não por leitura, com **máximo de 1 escrita em voo** nos dois laços de correção. O `createMany` não foi contaminado: continua em `[1000, 1000, 1000, 1000, 1000, 571]`. O JSDoc novo foi conferido cláusula por cláusula contra medição independente e **está factualmente correto**, inclusive na afirmação mais forte ("25 e 1.000 quebram no mesmo ponto"), reproduzida em experimento somente-leitura. Nenhuma regressão. Dois achados novos, ambos `suggestion`, e nenhum deles no código: um corrige a rota de escape declarada pelo agente, que não funciona como enunciada; o outro pede atribuição de origem a um número no comentário.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 13 | suggestion | — (decisão declarada) | — | desempenho | O agente declara que, se o tempo da carga incomodar, "o caminho é **aumentar `connection_limit`**, não repor concorrência no laço". **Aumentar `connection_limit` sozinho não muda nada**: um laço `for … await` emite um comando por vez e usa exatamente uma conexão, independentemente do tamanho do pool. A rota de escape real exige as **duas** coisas — `connection_limit=N` **e** concorrência limitada a `C ≤ N` —, e é justamente aí que ela deixa de ser frágil: com `C ≤ N` não há fila, então o `pool_timeout` nunca entra na conta e o limiar deixa de depender da latência | Não mudar o código. Corrigir o enunciado da rota de escape onde ele for registrado, para que quem esbarrar no tempo total não suba o `connection_limit`, não veja ganho nenhum e conclua que a medição estava errada. O JSDoc **não** contém essa afirmação — ela está só no relato do agente |
| 14 | suggestion | `prisma/seeds/geography.seed.ts` | L288, L292 | clareza | O comentário atribui `connection_limit=1` à "propria string de conexao do projeto" (correto — está no `.env`) e, três linhas depois, cita "o `pool_timeout` de 10 s" sem atribuição. O `pool_timeout` **não** está na string de conexão: 10 s é o default do Prisma (confirmado: `Current connection pool timeout: 10, connection limit: 1`). Como o defeito da Rodada 2 foi exatamente uma descalibração entre esses dois números, um leitor que for procurar o `10` no `.env` e não achar fica sem saber se o comentário está desatualizado | Nomear a origem de cada valor: `connection_limit=1` vem do `.env`, `pool_timeout=10 s` é o default do Prisma (e por isso muda se alguém acrescentar `pool_timeout` à string) |

**Achados anteriores — situação**

| # | Origem | Situação | Evidência |
|---|---|---|---|
| 11 | Rodada 2 / `major` | **Resolvido** | 50/50 corrigidos, saída 0, zero `P2024`; concorrência máxima medida = 1; constante `TAMANHO_DO_LOTE_DE_CORRECOES` inexistente em `prisma/` e `src/`; nenhum `Promise.all` no arquivo |
| 1, 2, 4 | Rodada 1 / `minor` | Seguem resolvidos | Sem regressão (Passes 1, 2 e 6) |
| 3 | Rodada 1 / `minor` | **Resolvido** (via #11) | — |
| 5–10 | Rodada 1 / `suggestion` | Abertos por decisão | — |
| 12 | Rodada 2 / `suggestion` | Aberto por decisão (YAGNI) | — |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 5 de 5 critérios de aceite implementados, todos reproduzidos nesta rodada. A ressalva que a Rodada 2 abriu sobre **CA-3** está **encerrada**: a renomeação em volume, que era o modo de falha, agora conclui inteira.

- **CA-1** — caminho de criação exercitado contra o banco real, dentro de `prisma.$transaction` revertida: apagados o estado `AC` e 25 municípios (22 do `AC` + 3 de `RR`), `seedGeography(tx)` devolveu `{"statesCreated":1,"citiesCreated":25}` e recompôs `states 27` / `cities 5571`, com `Campo Magro → PR` e `Brasília → DF`. Transação revertida; snapshot pós-teste idêntico ao baseline.
- **CA-2** — duas execuções consecutivas de `db:seed:geography`: `0 estado(s) e 0 municipio(s) criados`, saída 0, e **apenas 2 `SELECT`** cada (`INSERT=0 UPDATE=0 DELETE=0`). Os 8 comandos por execução são os dois `SELECT` mais `BEGIN`/`DEALLOCATE ALL`/`COMMIT` de cada um — nenhuma escrita.
- **CA-3** — 50 municípios adulterados (`ibgeCode 1100015`…`1101708`). Resultado: **saída 0**, `UPDATE` em `cities` = **50**, `INSERT` = 0, `P2024` = **0**, duração 49,3 s. Conferência linha a linha: **50/50 com o `id` original preservado** e 50/50 restaurados ao nome exato do baseline. `cmp` do snapshot completo de `cities` (5.571 linhas, com `id`) contra o baseline: **idêntico**.
- **CA-4** — nenhuma chamada de rede introduzida ou remanescente; a carga lê apenas o arquivo local (Pass 5).
- **CA-5** — ver Pass 6, item "provisionamento do administrador".

**Pass 2 — Diff Analysis**: Nenhum achado. `git status` na raiz do monorepo mostra exatamente `package.json` e `prisma/seed.ts` modificados, `prisma/data/` e `prisma/seeds/` não rastreados, mais este arquivo de task. `git diff --numstat`: `package.json` `+2 −1`, `prisma/seed.ts` `+81 −2`. Nenhum arquivo fora da tabela *Files*, nenhuma formatação em massa, nada do "Scope — Out" tocado.

**Pass 3 — Code Practices**: Achado #14. A remoção de `TAMANHO_DO_LOTE_DE_CORRECOES` é a decisão certa e foi feita do jeito certo — **removida, não deixada em 1**. Uma constante que não governa grandeza nenhuma é pior que a ausência dela: nomeia um mecanismo inexistente e convida o próximo mantenedor a "ajustar o valor". O que substituiu a constante é a única coisa que de fato governa o laço — um `await` por iteração — mais o comentário que explica por que não há o que ajustar. A fronteira entre as duas grandezas ficou explícita e cruzada nos dois sentidos: o JSDoc de `TAMANHO_DO_LOTE` (L47–L57) declara que vale "APENAS para o `createMany`" e remete ao laço de correção; o laço (L281–L303) explica a outra grandeza. `semearMunicipios` continua acima do limite de ~20 linhas do Object Calisthenics — achado #5 da Rodada 1, aberto por decisão; o crescimento desta rodada é de comentário, não de lógica. Nomes sem abreviação, sem `else`, guarda no lugar de aninhamento, nenhum número mágico novo.

**Pass 4 — Testing Review**: Nenhum achado novo. Esta task não entrega testes por definição (TASK-BACKEND-011). Gates reproduzidos por mim, com as sondas já removidas: `npm run typecheck` **saída 0** nos três projetos (`tsc --noEmit`, `tsconfig.seed.json`, `tsconfig.test.json`); `npm test` **20 suítes / 270 testes, saída 0**. O #9 da Rodada 1 (`collectCoverageFrom`) segue endereçado à TASK-BACKEND-011.

**Pass 5 — Security Review**: Nenhum achado. A correção é uma troca de forma de despacho e a remoção de uma constante — não cria fronteira de confiança, não lê entrada de usuário, não toca segredo, não introduz dependência. **A03**: nenhuma interpolação em SQL; o `update` continua parametrizado por `ibgeCode`. **A10 / RN-27**: `grep` por `fetch`, `axios`, `undici`, `node-fetch`, `http(s)://`, `curl` e `XMLHttpRequest` sobre o entregável segue casando apenas dentro do campo `_source` do JSON, string inerte nunca dereferenciada. **A09 (Logging)**: melhora real e mensurável — o modo de falha anterior era `P2024` com **escrita parcial** e saída 1; agora a operação conclui inteira ou não começa. Uma carga que abortava no meio deixava o banco num estado que só o log dizia qual era. **A02, A06, A08**: sem segredo, sem dependência nova, sem desserialização de entrada não confiável. A01, A04, A05, A07 não se aplicam.

**Pass 6 — Bug Detection**: Nenhum achado novo no código. Tudo abaixo foi medido nesta rodada.

- **Serialização é real, não declarada** — duplo de teste injetado em `seedGeography(prisma)` (possível porque o cliente é parâmetro), contando escritas **em voo**. Com todos os 5.571 municípios divergentes e as 27 UFs divergentes: `city.update` **total 5571, máximo em voo 1**; `state.update` **total 27, máximo em voo 1**. Os dois laços estão serializados, não só o dos municípios.
- **`createMany` intocado** — mesmo duplo, forçando o caminho de criação: `city.createMany` em **6 lotes `[1000, 1000, 1000, 1000, 1000, 571]`** (soma 5.571), `state.createMany` em **1 lote de 27**. A serialização não contaminou o loteamento. Confirmado também contra o banco real na transação revertida do CA-1.
- **A afirmação central do JSDoc, verificada de forma independente** — experimento **somente-leitura** contra o mesmo pooler (`SELECT pg_sleep(1)::text` sob `Promise.allSettled`, sem tocar dado): lote de **25** → **6 sucessos**; lote de **200** → **6 sucessos**; os demais falham com `P2024 — Current connection pool timeout: 10, connection limit: 1`. **Idêntico ponto de quebra nos dois lotes** — é exatamente a afirmação "25 e 1.000 quebram no mesmo ponto", e ela se sustenta. Controle em série: **25/25 sucessos em 46,2 s**, zero falhas. A fórmula do comentário também fecha: com latência de ~1,85 s medida nesse experimento, `pool_timeout / latência = 10 / 1,85 ≈ 5,4`, e sobrevivem 6.
- **Latência real do `update`** — `(49.283 ms − 5.195 ms de execução sem escrita) / 50 = **881 ms por `update`**`. O JSDoc diz "~900 ms" e "~1 s por municipio renomeado": correto. O limiar `pool_timeout / latência = 10 / 0,9 ≈ 11` também: os 933 ms da Rodada 2 e os 881 ms desta rodada são a mesma ordem de grandeza, e a diferença entre o "~11" teórico e os 13–14 observados na Rodada 2 é a variação da latência sob concorrência, não erro de raciocínio.
- **Idempotência (regressão)** — coberta em CA-2: duas execuções, zero escritas.
- **Casamento por `ibgeCode` e preservação de `id` (regressão)** — 50/50 e, no cenário A abaixo, mais 3/3. Nenhum `delete` + `insert` em lugar nenhum; `cities` e `states` não têm `updatedAt`, então a correção é integralmente reversível e o `cmp` byte a byte prova que foi.
- **Zod derrubando antes de escrever (regressão)** — cenário C abaixo: **zero comandos ao banco, nem um `SELECT`**.
- **Resolução por `__dirname` (regressão)** — `process.chdir('/')` antes de carregar o módulo; `seedGeography` concluiu normalmente com `cwd = /`.
- **Contadores vindos do `count` real (regressão)** — com o duplo devolvendo `count: 0`, `seedGeography` retornou `{"statesCreated":0,"citiesCreated":0}` embora houvesse 27 estados e 5.571 municípios "a inserir". Se ainda usasse `ausentes.length`, teria retornado 27 e 5571.
- **Isolamento das duas cargas — os quatro cenários, reproduzidos**:
  - **A (sem `SEED_ADMIN_*`, recorte íntegro, com trabalho real para a geografia)** — 3 municípios adulterados antes de rodar. Saída: `Carga "administrador" falhou: … defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD …`, depois `Geografia semeada: 0 e 0`, resumo `1 de 2 carga(s) falharam (administrador)`, **saída 1**, `UPDATE=3 INSERT=0`. A geografia **carrega de fato** e os 3 voltaram ao baseline com o `id` original. **Zero escrita em `users`**.
  - **B (tudo presente)** — `Administrador provisionado` + `Geografia semeada: 0 e 0`, **saída 0**.
  - **C (as duas falham)** — sem `SEED_ADMIN_*` e recorte truncado para 26 UFs: as duas mensagens saem nomeadas, resumo `2 de 2 carga(s) falharam (administrador, geografia)`, **saída 1**, `TOTAL_QUERY=0` — **nenhum comando ao banco**.
  - **D (admin passa, geografia falha)** — `Administrador provisionado`, `Carga "geografia" falhou: Recorte … invalido`, resumo `1 de 2 (geografia)`, **saída 1**. Em nenhum caminho o erro é engolido.
- **Provisionamento do administrador — não foi tocado, e a linha voltou intacta** — o diff de `prisma/seed.ts` não contém **nenhuma** linha com `upsert`, `hashPassword`, `UserRole`, `UserStatus`, `passwordHash`, `emailConfirmedAt` ou `NOME_DO_ADMIN`; a única mudança em torno do admin é o corpo do antigo `executarSeed` ter virado `cargaDoAdministrador`. **Correção ao relato do agente**: a afirmação de que o cenário A roda "com zero escritas no banco" é verdadeira **apenas quando a geografia também não tem o que fazer** — com trabalho real, o cenário A escreve na geografia (3 `UPDATE` aqui) e continua sem escrever em `users`, que é a parte que importa. E `npm run db:seed` (cenário B) reescreve `passwordHash`, `emailConfirmedAt` e `updatedAt` do admin **por projeto**, como as Rodadas 1 e 2 já registraram — é a razão de existir do gatilho `db:seed:geography`. Restaurei a linha por SQL cru; `cmp` de `users` contra o baseline: **idêntico**.

**Pass 7 — Project Patterns**: Nenhum achado novo. Sem `Promise.all` no arquivo. `TAMANHO_DO_LOTE` presente em exatamente duas linhas: a definição (L57) e o `for` do `createMany` (L275). Nome de arquivo, ordem de imports, prefixo `[catdog-backend]`, `process.exitCode` em vez de `process.exit`, mensagem sem stack e `$disconnect` no `finally` seguem no padrão do backend. Comentários e logs sem acento, acentuação reservada às mensagens ao usuário final. Linguagem ubíqua preservada: contrato exportado em inglês (`seedGeography`, `statesCreated`, `citiesCreated`, `ibgeCode`), interior em português, igual a `prisma/seed.ts`.

#### Decisões declaradas — parecer

1. **Remover `TAMANHO_DO_LOTE_DE_CORRECOES` em vez de deixá-la em 1** — **correta, e é a melhor parte desta entrega**. A Rodada 2 ofereceu as duas saídas ("`= 1`, ou laço `for … await` sem `Promise.all`") e o agente escolheu a que não deixa resíduo. Uma constante fixada em 1 continuaria dizendo, pelo nome, que existe um lote a calibrar — exatamente o modelo mental que produziu o defeito. Não sobrou identificador nenhum sustentando a ideia errada: `grep` sobre `prisma/` e `src/` não encontra a constante.
2. **Serializar os dois laços, não só o dos municípios** — **correta**. São 27 `update` possíveis em `semearEstados`, acima do limiar. Medido: máximo 1 em voo nos dois.
3. **Não tocar `TAMANHO_DO_LOTE = 1_000`** — **correta**. Era a instrução explícita da Rodada 2 e foi cumprida: o loteamento do `createMany` continua idêntico, medido em `[1000×5, 571]`.
4. **Registrar a fronteira entre as duas grandezas no JSDoc** — **correta**. É o que evita a próxima descalibração: o comentário de `TAMANHO_DO_LOTE` diz o que ele **não** governa e remete ao laço de correção, e o laço explica por que lotear não resolve. Ressalva menor em #14 quanto à origem do `pool_timeout`.
5. **Medição independente da latência (~820 ms)** — **confirmada**. Medi 881 ms; a Rodada 2 mediu 933 ms. Três medições na mesma ordem de grandeza, tomadas por caminhos diferentes.

#### Julgamento do risco declarado — tempo linear nas renomeações

**Aceitável. Não merece tratamento agora.** O argumento do agente está certo no essencial e errado num detalhe, que corrijo em #13.

O que sustenta a aceitação:

- **O caminho que cresce linearmente não é o caminho de CI nem o de ambiente novo.** Banco vazio produz `divergentes = []` e a carga inteira sai em 6 `createMany` — foi o que medi. O custo de ~881 ms só incide sobre **municípios que mudaram de nome ou de estado** num recorte já semeado.
- **A grandeza real é de unidades, não de centenas.** O laço só roda para o delta entre dois recortes. Mudança de divisão territorial no Brasil é rara e pontual; um recorte novo típico traz um punhado de renomeações, não 500. Os ~7,3 min de 500 renomeações são um limite hipotético, e mesmo o pior caso concebível — os 5.571 divergentes — daria ~82 min de operação **offline**, conduzida por um operador que sabe o que está rodando.
- **A alternativa não existe neste ambiente.** Concorrência sob `connection_limit=1` não é "mais rápida com risco": é **mais lenta e quebrada**, porque a fila consome o `pool_timeout` sem ganhar throughput nenhum. Medi isso: 25 comandos concorrentes entregam 6; 25 em série entregam 25.
- **A idempotência deixou de ser plano de recuperação e virou rede de segurança.** Antes, uma carga com 200 renomeações exigia ~16 execuções para convergir. Agora converge **em uma**; a idempotência cobre apenas interrupção externa (queda de rede, `Ctrl+C`), que é o papel correto dela.
- **Lento e correto é o trade-off certo aqui.** A operação não está em caminho de requisição, não bloqueia deploy e não tem SLA. O que ela não pode é terminar com metade dos municípios corrigidos — e era exatamente isso que acontecia.

O detalhe a corrigir (#13): **subir `connection_limit` sozinho não acelera nada**, porque um laço `for … await` usa uma conexão por vez seja o pool de 1 ou de 20. A rota de escape correta é `connection_limit=N` **junto com** concorrência limitada a `C ≤ N` — e nessa configuração ela é sólida, porque sem fila o `pool_timeout` sai da equação e o limiar deixa de depender da latência. Vale registrar assim para que, no dia em que o tempo incomodar, ninguém suba o `connection_limit`, não veja ganho e conclua que a análise estava errada. Nada disso muda hoje: enquanto a string de conexão disser `connection_limit=1`, a série é a única forma correta.

#### Veredicto

> **APROVADA** — o achado `major` #11 está resolvido, e resolvido pela medição: 50/50 municípios corrigidos com saída 0 e zero `P2024` no cenário exato que reprovou a Rodada 2, concorrência máxima de **1** aferida por instrumentação nos dois laços de correção, `createMany` preservado em lotes de 1.000, e o JSDoc novo verificado cláusula por cláusula — inclusive a afirmação "25 e 1.000 quebram no mesmo ponto", reproduzida em experimento somente-leitura que devolveu **6 sucessos em ambos os lotes**. Nenhuma regressão nos cinco critérios de aceite, na idempotência, no isolamento das duas cargas, no casamento por `ibgeCode`, na resolução por `__dirname` ou nos contadores. Gates verdes: `typecheck` saída 0 nos três projetos, `npm test` 20 suítes / 270 testes. Os dois achados novos (#13, #14) são `suggestion`, nenhum deles bloqueia, e nenhum dos dois é defeito de código — #13 corrige uma rota de escape declarada que não funciona como enunciada e #14 pede atribuição de origem a um número no comentário. Os achados #5–#10 e #12 seguem abertos por decisão.
>
> **O que as tasks dependentes herdam.**
>
> **TASK-BACKEND-005 (endpoints de estados e municípios)** herda um dado pronto e estável: 27 `states` e 5.571 `cities`, com `id` (uuid) que **sobrevive a qualquer recarga** — a correção por `update` casada por `ibgeCode` é o que garante isso, e foi provado 50 vezes nesta rodada. Consequências diretas para o desenho dos endpoints: (a) `ibgeCode` é a identidade de negócio estável e o `id` é estável na prática — os dois podem ser expostos sem medo de troca entre execuções do seed; (b) **nomes de município se repetem entre UFs** (`Boa Esperança` existe em ES, MG e PR, com três `ibgeCode` distintos), então a listagem de cidades **precisa** ser escopada por estado e nenhuma busca pode assumir unicidade de nome — o índice `@@index([stateId, name])` existe exatamente para essa consulta; (c) o DF **tem** município (`Brasília`, `ibgeCode 5300108`), então não há UF sem cidade e o formulário nunca cai num combo vazio; (d) os nomes carregam a **acentuação oficial**, então filtro por texto precisa decidir explicitamente se é sensível a acento — herdar isso sem decidir produz busca que não acha "Brasilia"; (e) nenhuma dependência de rede: os endpoints leem só o banco (RN-27 preservado).
>
> **TASK-BACKEND-011 (testes)** herda um módulo **testável por construção** e um mapa do que precisa ser coberto. `seedGeography(prisma)` recebe o cliente como parâmetro, e nesta rodada usei isso de três formas que a task pode reaproveitar tal e qual: duplo de teste em memória, transação revertida contra o banco real, e sonda de concorrência. O que a suíte deve travar, em ordem de risco: (1) **serialização dos dois laços de correção** — é a regressão mais provável e a mais silenciosa, porque um `Promise.all` reintroduzido passa em qualquer teste funcional e só quebra em volume; o teste é contar escritas **em voo** e exigir máximo 1; (2) **loteamento do `createMany` em 1.000** — asserção sobre os tamanhos dos lotes, `[1000×5, 571]` para o recorte atual; (3) **contadores vindos do `count` real** — duplo devolvendo `count` forçado, divergente de `ausentes.length`; (4) **Zod abortando antes de qualquer comando**, com recorte truncado e recorte com `ibgeCode` repetido; (5) **idempotência** — segunda execução com zero escritas; (6) **`update` preservando o `id`**, jamais `delete` + `insert`; (7) **resolução por `__dirname`** com `cwd` diferente. Dois pontos operacionais: o **#9 da Rodada 1 continua valendo** — `collectCoverageFrom` cobre `src/**/*.ts` e `prisma/seeds/**/*.ts` precisa ser acrescentado, senão a suíte nova nasce fora da métrica; e os testes **não devem escrever no Supabase real**, porque cada escrita custa ~880 ms medidos — o caminho é duplo de teste, e transação revertida só onde a integração com o banco for o objeto do teste.
>
> **Integridade do ambiente após a revisão**: banco restaurado ao baseline **exato** — snapshots completos de `cities` (5.571 linhas, com `id`), `states` (27) e `users` (2) **idênticos por `cmp`**, incluindo a linha do administrador, restaurada por SQL cru com `password_hash`, `email_confirmed_at`, `created_at` e `updated_at` originais (`updated_at` é `@updatedAt` e não voltaria por um `update` comum). Contagens finais conferidas: `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571, `animals` 0, `animal_images` 0. `.env` restaurado e conferido por md5 (`37f2e71185603a7ef52cae3e796d3cf4`); recorte JSON restaurado e conferido por md5 (`725f85f9b487cd2d26c4a6128368765e`); `package.json`, `prisma/seed.ts` e `prisma/seeds/geography.seed.ts` com md5 idêntico ao do início desta rodada (`d67744ed…`, `0bc81057…`, `5732c95d…`). Todas as sondas temporárias removidas; `git status` na raiz mostra exatamente os 4 arquivos da entrega mais este arquivo de task.
