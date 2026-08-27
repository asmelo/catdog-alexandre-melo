# TASK-BACKEND-010 — Integridade referencial: quitação da dívida da FEATURE-001 e registro da dívida do módulo de Pedidos

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-010-backend-integridade-especie-pedidos`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 10 of 18 — Integridade Referencial
**Generated**: `2026-08-25`

---

## Context

A FEATURE-001 deste módulo entregou a sua regra mais importante — "espécie com animais vinculados não pode ser excluída" — verificável **apenas por duplo de teste**, porque a entidade Animal não existia. A HU-09 e o CA-38 fazem desta quitação **condição de conclusão** desta feature, e não um item desejável: a contagem passa a ser real e os CT-24, CT-25, CT-26 e CT-32 daquela spec são reexecutados contra a tabela real e a chave estrangeira real do Postgres. A segunda metade da task existe pelo mesmo motivo invertido: registrar a dívida equivalente do módulo de Pedidos **antes** de contraí-la (RN-17b).

---

## Scope

**In:** Substituição da consulta de contagem de animais vinculados pela implementação real; tradução da violação de chave estrangeira do Postgres para `409 SPECIES_IN_USE`; suíte de integração que exercita as duas camadas contra o banco real; registro documentado da dívida de integridade do módulo de Pedidos.

**Out:** Não alterar o contrato, a mensagem, o `code` nem o status do `DELETE /api/species/:id` — o desfecho é o mesmo que a FEATURE-001 especificou, apenas passa a ser produzido por dados reais. Não criar entidade, tabela, endpoint ou coluna de Pedido: a dívida é **registrada**, não implementada. Não relaxar nem contornar a FK `Restrict` de animal para espécie em nenhuma hipótese, inclusive em fixture de teste.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Espécie com animais vinculados (RN-08 da FEATURE-001) | `SpeciesInUseError` → `409 SPECIES_IN_USE` |
| Violação de chave estrangeira do Postgres | `PrismaClientKnownRequestError` com `code === 'P2003'` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/species/repositories/species.repository.ts` | contagem real de animais |
| `modify` | `src/domains/species/services/delete-species.service.ts` | traduz violação de FK |
| `create` | `tests/integration/species-animal-integrity.spec.ts` | quitação contra dados reais |
| `create` | `.makuco/codebase/technical-debt.md` | dívida do módulo de Pedidos |

---

## Implementation

> **Reference pattern**: a seção "Como a RN-08 é verificada antes de a entidade Animal existir" da spec da FEATURE-001 descreve exatamente esta transição e é o contrato desta task. Os nomes concretos de arquivo do domínio de espécies vêm da implementação daquela feature — se divergirem dos listados acima, seguir os reais e manter o mesmo escopo.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
**Diferenças em relação ao referencial:**
- A consulta de animais vinculados, que hoje devolve zero fixo porque a tabela não existia, passa a executar `prisma.animal.count({ where: { speciesId } })`.
- **A assinatura do método não muda.** É o que garante que os testes já escritos na FEATURE-001, que a substituem por um duplo, continuem válidos sem alteração — eles verificam a regra, e esta task troca apenas a fonte do número.
- Remover o comentário que declarava a implementação provisória. Deixá-lo faria a próxima pessoa duvidar de qual é o comportamento real.

### `src/domains/species/services/delete-species.service.ts` *(modify)*
- A primeira camada permanece como está: contar dentro da mesma transação da exclusão e, havendo ao menos um animal, lançar `SpeciesInUseError`. É esta camada que produz a mensagem correta em PT-BR.
- Acrescentar a **segunda camada**: capturar `P2003` na exclusão e traduzi-lo para o **mesmo** `SpeciesInUseError`. As duas camadas são obrigatórias (RN-09 da FEATURE-001) e independentes — se a verificação da aplicação falhar por qualquer motivo, o banco recusa e o administrador recebe a mesma resposta em vez de um `500`.
- Não trocar uma camada pela outra "porque o banco já garante". A FK garante a integridade; ela não produz mensagem de negócio.
- Nenhuma remoção em cascata de animais, em nenhuma hipótese, e nenhum animal fica com espécie nula em consequência desta operação.

### `tests/integration/species-animal-integrity.spec.ts` *(create)*
- Suíte supertest contra o **banco real**, no formato de `tests/integration/auth-routes.spec.ts`. Nenhum duplo de repositório: é a ausência de duplo que quita a dívida (CA-37).
- Nomear cada caso `it('<CT-NN>: <asserção em PT-BR>')`, referenciando os CTs desta spec **e** os da FEATURE-001 que estão sendo reexecutados.
- Casos obrigatórios:
  - **CT-81** — animal real vinculado a "Cachorro"; `DELETE /api/species/:id` responde `409 SPECIES_IN_USE` com "Não é possível excluir esta espécie porque existem animais vinculados a ela." e a espécie permanece (reexecuta o CT-24 da FEATURE-001).
  - **CT-82** — após o CT-81, a contagem de espécies e a de animais estão inalteradas e nenhum animal tem `species_id` nulo (reexecuta o CT-25).
  - **CT-83** — excluído o único animal vinculado, a exclusão da espécie conclui normalmente (reexecuta o CT-26).
  - **CT-84** — a mesma exclusão chamada diretamente à API, fora da interface, é recusada da mesma forma (reexecuta o CT-32).
  - **CT-85** — `prisma.species.delete` executado **direto no banco**, contornando o service, com animal vinculado: o Postgres recusa por violação de FK; nenhum animal é apagado e nenhum fica sem espécie. Este é o caso que prova a segunda camada e o único que precisa desviar da API de propósito.
  - **CT-86** — remoção de cidade referenciada por animal é recusada pela integridade referencial (RN-29).
- Reexecutar, na mesma suíte ou marcando como regressão, os cenários de **criação, renomeação e listagem** de espécies, que passam a conviver com registros referenciados — é exigência explícita da seção de regressão da spec.
- Limpeza entre casos respeitando a ordem de dependência: animais antes de espécies. Uma limpeza que apague espécies primeiro falha pela própria FK que a suíte está verificando — e falhar ali é sinal de que a FK funciona, não de que o teste está errado.

### `.makuco/codebase/technical-debt.md` *(create)*
- Documento curto, com uma entrada por dívida de integridade conhecida, no mesmo tom dos demais arquivos de `.makuco/codebase/`.
- **Entrada 1 — quitada por esta task:** a regra de exclusão de espécie da FEATURE-001, com a data e o link para esta task e para a suíte de integração. Registrar como quitada, não apagar: o histórico é o que impede a dívida de ser recontraída por desconhecimento.
- **Entrada 2 — contraída antes de existir:** quando o módulo de Pedidos existir, o vínculo de pedido para animal precisa nascer como chave estrangeira **`Restrict`, jamais `Cascade` nem `SetNull`**, e a regra "animal referenciado por algum pedido não pode ser excluído" precisa ser verificada **contra dados reais**, não com duplo. Consequência declarada: `DeleteAnimalService` ganhará a mesma estrutura de duas camadas de `DeleteSpeciesService`, e o módulo de Pedidos **não poderá ser considerado concluído** sem isso (RN-17b).
- Escrever a Entrada 2 agora é o ponto da task. Ela é escrita antes de a entidade existir precisamente porque foi a omissão equivalente que fez a FEATURE-001 conviver com a sua regra mais importante verificável apenas por duplo. Repetir o mesmo erro em silêncio, sabendo dele, seria pior do que cometê-lo pela primeira vez.
- Referenciar o arquivo em `MAKUCO.md` com uma linha, para que ele seja encontrado sem busca.

---

## Acceptance Criteria

- [ ] **Given** um animal real vinculado à espécie "Cachorro", **When** `DELETE /api/species/:id`, **Then** `409 SPECIES_IN_USE` com a mensagem literal da FEATURE-001, a espécie permanece cadastrada e **nenhum animal é removido, desvinculado ou alterado** (CT-81, CA-37).
- [ ] **Given** a exclusão recusada, **When** as contagens de `species` e de `animals` são conferidas, **Then** ambas estão inalteradas e nenhuma linha de `animals` tem `species_id` nulo (CT-82, RNF-05).
- [ ] **Given** o único animal vinculado excluído, **When** a espécie é excluída novamente, **Then** a operação conclui normalmente (CT-83).
- [ ] **Given** a exclusão chamada diretamente à API, fora da interface, **When** há animais vinculados, **Then** a recusa é idêntica (CT-84).
- [ ] **Given** a verificação da aplicação contornada — `delete` executado direto no Prisma —, **When** há animal vinculado, **Then** o Postgres recusa a operação, o erro é traduzido para `409 SPECIES_IN_USE` quando chega pela API, e nenhum animal é apagado (CT-85, CA-36).
- [ ] **Given** uma cidade referenciada por algum animal, **When** removida, **Then** a operação é recusada pela integridade referencial (CT-86, RN-29).
- [ ] **Given** a suíte de integração desta task, **When** o código é inspecionado, **Then** ela **não** usa nenhum duplo de repositório de espécie ou de animal — a quitação depende disso (CA-38).
- [ ] **Given** os fluxos de criar, renomear e listar espécies, **When** reexecutados com registros já referenciados por animais, **Then** continuam funcionando como antes (regressão declarada).
- [ ] **Given** `.makuco/codebase/technical-debt.md`, **When** lido, **Then** contém a dívida da FEATURE-001 marcada como quitada e a dívida do módulo de Pedidos registrada com a exigência de FK `Restrict` e de verificação contra dados reais (RN-17b).

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (a FK `Restrict` real e a relação inversa ativada), TASK-BACKEND-007 (criar animal real para a fixture), TASK-BACKEND-009 (excluir o animal para liberar o CT-83), FEATURE-001 do MODULE-002 implementada.
- **Blocks**: nenhuma task. **Bloqueia a conclusão da feature**: sem esta task, a CA-38 fica em aberto e a FEATURE-002 não pode ser considerada entregue.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 8 (5 alterados, 3 criados)

#### Resumo

A dívida herdada da FEATURE-001 **está quitada**: os CT-24, CT-25, CT-26 e CT-32 foram reexecutados
contra a tabela `animals` real e a chave estrangeira `animals_species_id_fkey` real, sem nenhum dublê
no caminho, e isso foi **provado por experimento**, não aceito por leitura. Duas coisas, porém,
impedem a aprovação: o segundo caso do CT-85 — o que declara provar a tradução da camada 2 para
`409 SPECIES_IN_USE` na API (CA-36) — **passa mesmo com a camada 2 removida do código de produção**,
e a suíte **quebra o CI** na próxima abertura de PR.

#### Provas construídas (não é leitura de código)

| # | Prova | Método | Resultado |
|---|---|---|---|
| P1 | A suíte toca o banco de verdade | `DATABASE_URL` apontada para `127.0.0.1:1` e suíte reexecutada | **Falha alto** — `Can't reach database server`, 4 casos vermelhos. Não pula, não fica verde. `.env` restaurado e conferido por `md5sum` |
| P2 | A FK é afirmada pelo NOME | `ALTER TABLE animals RENAME CONSTRAINT animals_species_id_fkey TO fk_animals_species_sonda` (continua `RESTRICT`, continua `P2003`) | **CT-85 reprovou**: `Expected: "animals_species_id_fkey (index)"` / `Received: "fk_animals_species_sonda (index)"`. A afirmação é do nome, não do código |
| P3 | Uma migration `Cascade` reprovaria | FK recriada com o **mesmo nome** e `ON DELETE CASCADE` | **CT-85 (1º caso) reprovou.** Constraint restaurada para `ON DELETE RESTRICT` e conferida em `pg_constraint` |
| P4 | Os 2 testes reescritos ganharam poder | 4 mutantes em `species-usage-counter.ts` | **Todos mortos**: filtro em outra coluna (`cityId`) ✔, `findMany().length` ✔, `return this` ✔, **nova instância ligada ao client global** ✔ — este último a versão anterior do teste **não** pegava |
| P5 | **O CT-85 (CA-36) prova a camada 2?** | `violaChaveEstrangeira` alterada para `return false` (camada 2 **removida**) e o caso reexecutado **4 vezes** | **4/4 VERDE.** Depois, sonda instrumentada: `SONDA-CAMADA1 contagem=1` e a camada 2 **nunca chamada**. O teste passa pela camada 1 |
| P6 | Gates declarados | `npm run typecheck`; `npx jest` | `typecheck exit=0`; **25 suítes / 323 testes**, 0 falhas, ~95 s |

Banco conferido antes e depois: `users` 2, `refresh_tokens` 8, `email_confirmation_tokens` 1,
`species` 0, `states` 27, `cities` 5571, `animals` 0, `animal_images` 0 — **idêntico**. Catálogo de
FKs idêntico (`animals_species_id_fkey` = `r`, `animals_city_id_fkey` = `r`,
`animal_images_animal_id_fkey` = `c`). Todas as sondas apagadas; `git diff --stat` idêntico ao inicial.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | major | `tests/integration/species-animal-integrity.spec.ts` | L347-L410 | requisito / teste | **Falso verde.** O caso `CT-85 (CA-36)` declara provar que o `P2003` da camada 2 chega ao cliente como `409`. Com `violaChaveEstrangeira` devolvendo `false` — camada 2 **inexistente** — ele passou **4/4**. A sonda instrumentada mostra `contagem=1`: a sessão paralela já havia comitado quando a contagem rodou, e quem respondeu `409` foi a **camada 1**. Com a FK em `Cascade` (P3) este mesmo caso também continuou verde. As pausas de 700 ms e 1500 ms são consumidas antes de a requisição chegar ao `count` (cada ida ao pooler do Supabase custa ~1-2 s). O critério de aceite "o erro é traduzido para `409 SPECIES_IN_USE` quando chega pela API (CT-85, CA-36)" **não está verificado contra dados reais** | Trocar as duas pausas por **condições observadas**, não por tempo: aguardar em laço até `pg_locks` mostrar o `FOR KEY SHARE` da sessão B sobre a linha da espécie, e até `pg_stat_activity` mostrar o `DELETE` em `wait_event_type='Lock'`, só então comitar. E acrescentar uma asserção **positiva** de que foi a camada 2 que respondeu, para que o caso não possa passar pela camada 1 |
| 2 | major | `.github/workflows/backend-ci.yml` / `tests/helpers/banco-real.ts` | L87 / L36-L56 | build | **O CI passa a falhar.** O workflow roda `npm test`; `banco-real.ts` lê o **arquivo** `services/backend/.env`, que é `gitignore`d e nunca é criado no CI. No primeiro import a suíte lança "…nao encontrou …/.env". O `DATABASE_URL` do workflow é dummy (`localhost:6543`) e sequer é consultado pelo helper. Na próxima abertura de PR o job fica vermelho | Dar ao CI um Postgres descartável (`services: postgres` + `prisma migrate deploy`) e fazer o helper aceitar `process.env.DATABASE_URL_INTEGRATION` antes de cair no `.env`, **mantendo a falha alta** quando nenhum dos dois existir. Não introduzir `describe.skip` — a recusa do agente nesse ponto está correta |
| 3 | minor | `tests/helpers/banco-real.ts` | L36-L67 | testabilidade | A URL vem **só** do arquivo `.env`. Não há como apontar a suíte para um banco descartável sem editar o arquivo, o que também amarra o achado #2 | Ler `process.env.DATABASE_URL_INTEGRATION ?? <arquivo .env>` |
| 4 | minor | `tests/integration/species-animal-integrity.spec.ts` | L688-L692, L700-L706 | dados | A limpeza apaga `species` **por nome global** (`Cachorro`, `Peixe`, `Cachorro doméstico`). No banco de desenvolvimento compartilhado isso remove registros que a suíte não criou — e "Cachorro" é justamente o nome que alguém semearia à mão. A cidade já é isolada por `ibgeCode` 9999999; as espécies não são | Marcar as espécies da suíte (sufixo próprio) ou apagar apenas os `id` criados na execução |
| 5 | minor | `tests/integration/species-animal-integrity.spec.ts` | L594-L625 (`fotografar`) | teste | O CT-82 fotografa o **banco inteiro**. Uma escrita concorrente de outra sessão — ou duas execuções simultâneas da suíte — produz vermelho falso | Restringir a fotografia ao escopo da suíte, mantendo global apenas a checagem `species_id IS NULL` |
| 6 | minor | `tests/integration/species-animal-integrity.spec.ts` | L86, L194-L204 | segurança (A07/A09) | A suíte cria um usuário **ADMIN ativo** com senha literal `Senha123!` no banco compartilhado e só o remove no `afterAll`. Execução interrompida (Ctrl+C, timeout, cancelamento de CI) deixa a conta privilegiada com senha conhecida até o `beforeAll` seguinte | Gerar a senha por execução (`randomUUID()`); nenhuma asserção depende do valor |
| 7 | minor | `tests/integration/species-animal-integrity.spec.ts` | L286 | requisito | O CT-83 remove o animal com `prisma.animal.delete`, não com `DELETE /api/animals/:id`. As Dependencies desta task nomeiam a TASK-BACKEND-009 como o que "libera o CT-83", e o cenário 4 da HU-09 diz "o administrador excluiu". A justificativa do balde ausente vale para a **criação** (upload), não para a exclusão — a RN-40 engole a falha de storage | Conduzir a remoção do CT-83 pela API |
| 8 | suggestion | `MAKUCO.md` | L3 | documentação | O arquivo, tocado por esta task, ainda abre com "Project is in pre-implementation stage — services/backend and services/frontend exist but are empty", quatro linhas acima do novo ponteiro para `technical-debt.md` | Atualizar a linha na próxima task que tocar o arquivo |
| 9 | suggestion | `package.json` | L15 | build | `npm test` passou de ~8 s para ~95 s e passou a exigir rede. Um script `test:integration` separado, **executado pelo CI como passo obrigatório**, preservaria o laço rápido do desenvolvedor sem tornar a suíte pulável | Só adotar junto com o achado #2, e nunca como `skip` condicional |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 8 de 9 critérios implementados e verificados. A correspondência com a
FEATURE-001 é **um para um e completa** — CT-81→CT-24, CT-82→CT-25, CT-83→CT-26, CT-84→CT-32; a
FEATURE-001 não tem nenhum outro CT sobre a regra de vínculo (CT-22/CT-23 afirmam a **ausência** de
vínculo, CT-27 é espécie inexistente). O critério do CT-85/CA-36 fica **parcialmente implementado**:
a metade "o Postgres recusa a operação e nenhum animal é apagado" está provada (P2, P3); a metade
"o erro é traduzido para `409` quando chega pela API" não está (achado #1).

**Pass 2 — Diff Analysis**: nenhum achado. `species-usage-counter.ts` é o nome real do arquivo que a
task listou como `species.repository.ts` — divergência **autorizada** pela nota de Implementation.
Os três arquivos alterados além da tabela `Files` são consequência direta e contida:
`delete-species.service.spec.ts` (os 2 testes que a task previa quebrar),
`delete-species.service.ts` e `species.controller.ts` (**apenas comentários** — conferido no diff).
`tests/helpers/banco-real.ts` é criação extra e justificada; `tests/helpers/` já existia. Nada de
`prisma/schema.prisma`, nada de migration, nada de `animals.messages.ts` (27 chaves intactas — o
arquivo não aparece no `git status`), nada fora do escopo, nenhuma entidade de Pedido criada.

**Pass 3 — Code Practices**: nenhum achado bloqueante. `PrismaSpeciesUsageCounter` tem **uma**
variável de instância, um nível de indentação, nenhum `else`, e `withTransaction` devolvendo
instância nova preserva a imutabilidade da porta. A constante órfã `NENHUM_ANIMAL_CADASTRADO`
sumiu, como a task exigia. Nenhum `any`, nenhum `@ts-ignore`, nenhum `as` de coerção — o
estreitamento de `unknown` é por `instanceof` em `codigoDoPrisma`, `constraintDoPrisma` e
`sqlstateCru`. Linguagem ubíqua alinhada: `SpeciesUsageCounter`, `countAnimalsBySpecies`,
`SpeciesInUseError`. Comentários explicam o **porquê**. Acentuação conforme a prática do projeto
(blocos JSDoc sem acento, comentários de corpo de teste e strings ao usuário com acento — igual a
`auth-routes.spec.ts` e `create-species.service.spec.ts`).

**Pass 4 — Testing Review**: achados #1, #5, #6, #7. AAA explícito em todos os 9 casos, nomes no
formato `CT-NN: <asserção>` exigido pela task, nenhum condicional em corpo de teste (os `if`
existentes estão em auxiliares e são guardas de falha alta), limpeza em `beforeAll`/`afterEach`/
`afterAll` na ordem imagens → animais → espécies. **Os 2 testes reescritos ganharam poder de
detecção, não perderam** (P4): a versão anterior — `not.toBe(contagem)` mais `resolves.toBe(0)` —
sobreviveria ao mutante "nova instância ligada ao client global"; a nova morre nele, porque a
asserção `expect(cliente.animal.count).not.toHaveBeenCalled()` pergunta **qual conexão** recebeu o
comando. O achado #1 é sobre um caso diferente e não contamina este julgamento.

**Pass 5 — Security Review**: achado #6. Sem injeção: `$queryRaw`/`$executeRaw` são **template tags
parametrizadas**, `$queryRawUnsafe` não é usado. Sem segredo em código; a URL vem do `.env`
`gitignore`d e o cliente usa `log: ['error']`, sem log de query. A exceção ao `tests/setup.ts` é
contida por import explícito e não toca `process.env`, preservando a proteção das outras 24 suítes.
Nenhuma dependência nova. Registre-se, porém, que o efeito colateral é real: `npm test` passou a
escrever no banco Supabase do projeto, que é o mesmo da aplicação — não há banco de teste separado
(ver achados #2, #3, #4).

**Pass 6 — Bug Detection**: nenhum achado adicional. `abrirSessaoParalela()` é desconectada em
`finally`; o cliente do módulo, em `afterAll`. `liberarComite` é reatribuída dentro do executor
síncrono da `Promise` — seguro. `BigInt` do `count(*)` é convertido explicitamente em `fotografar`.
A guarda `if (cidadeId !== '')` no `beforeAll` é inerte na primeira chamada, sem consequência.
**Verificação especial confirmada**: a cascata de `animal_images` **não** contradiz a RN-09 —
`animal_images_animal_id_fkey` é `c` e `animals_species_id_fkey` é `r`, conferido em `pg_constraint`,
e o teste dedicado exercita as duas direções. Regressão da FEATURE-001 confirmada verde: criar,
renomear e listar espécie funcionam com espécie em uso, e a espécie livre continua excluível.

**Pass 7 — Project Patterns**: achado #8. Suíte em `tests/integration/` no formato de
`auth-routes.spec.ts`; helper em `tests/helpers/`, diretório preexistente; `technical-debt.md` no
tom dos demais arquivos de `.makuco/codebase/` e referenciado em `MAKUCO.md`, como a task pedia.
O `technical-debt.md` é **acionável, não decorativo**: a DT-01 verifica a FK pelo catálogo
(`pg_constraint.confdeltype`) e não pelo arquivo de migration — **conferi e o valor `'r'` está
correto**; a DT-02 nomeia a ação de FK proibida, o método de verificação, a estrutura de duas
camadas que o `DeleteAnimalService` herdará e a condição de bloqueio do módulo; a DT-03 foi
**auditada e é verdadeira** — `auth.validators.ts` L105 usa `chave in forma` enquanto
`species.validators.ts` L137 e `animals.validators.ts` L778 já usam `Object.hasOwn`.

#### A dívida está QUITADA?

**A dívida da FEATURE-001 (CA-38), sim.** Os CT-24, CT-25, CT-26 e CT-32 estão reexecutados contra a
tabela real e a constraint real, sem dublê algum no caminho, e isso resiste a experimento: a suíte
**falha** quando o banco está inalcançável (P1), **reprova** se a constraint mudar de nome (P2) e
**reprova** se ela virar `Cascade` (P3). CA-36 (FK restritiva), CA-37 (recusa contra dados reais),
RN-29/CT-86 e a regressão declarada estão cobertos.

**Um critério continua apoiado em dublê**, e é preciso nomeá-lo: **a tradução do `P2003` para
`409 SPECIES_IN_USE` na resposta HTTP**. Ela segue verificada apenas pelo caso
`CA-15 [SOBRE DUBLÊ]` de `delete-species.service.spec.ts`, com um repositório falso que rejeita com
`P2003`. O caso `CT-85 (CA-36)` da suíte de integração declara cobri-la e **não cobre**: passou
4/4 com a camada 2 apagada do código de produção. Ele não é frágil no sentido de "às vezes fica
vermelho" — é pior: é **incapaz de ficar vermelho** pelo motivo que anuncia, e por isso fecha a
pergunta em vez de respondê-la. Essa não é a dívida herdada da FEATURE-001; é uma lacuna **nova**,
aberta por esta task, e que a própria task declara como critério de aceite.

#### Veredicto

> **REPROVADA** — 2 major (#1 falso verde do CT-85/CA-36, #2 CI quebrado), 5 minor, 2 suggestion.
> Nenhum critical. O código de produção está correto e a dívida herdada está quitada; o que falta é
> a verificação de um critério desta task e a viabilidade do pipeline. Encaminhar ao
> `makuco-codegen` para correção dos dois major antes de fechar a TASK. Os minor #4, #5 e #6
> deveriam entrar na mesma passagem, por tocarem os mesmos trechos.

---

## Correções da Rodada 1 — 2026-08-27

**Executor**: makuco-codegen
**Escopo**: os 2 `major` e os `minor` #3, #4, #5, #6 e #7. Nada do que foi aprovado
foi desfeito: as quatro edições do contador, os 2 testes reescritos de
`delete-species.service.spec.ts`, a afirmação literal do nome das FKs e o
`technical-debt.md` seguem como estavam.

### Major #1 — o falso verde do `CT-85 (CA-36)`

**A causa raiz não era só o tempo.** As pausas de 700 ms e 1500 ms de fato eram
consumidas antes de a requisição chegar à contagem, como a revisão apontou; mas
por baixo delas havia um defeito que **nenhuma pausa consertaria**: o objeto
devolvido por `request(app).delete(...)` é um **thenable preguiçoso**, e o
supertest só dispara a requisição quando alguém chama `.then()`. Guardada em
`const exclusaoEmCurso = excluirEspecie(...)` e aguardada apenas no fim, a
exclusão **partia depois** do comite da sessão paralela. Era por isso que a sonda
da revisão leu `contagem=1`: quando a camada 1 rodava, o animal já estava
comitado.

**O que passou a ser feito**, na ordem:

1. A sessão B abre transação, insere o animal e **não** comita.
2. **Condição 1 observada** — um `SELECT ... FOR UPDATE NOWAIT` emitido por uma
   **terceira sessão** (observadora) sobre a linha da espécie devolve `55P03`.
   `pg_locks` não serve para isto: bloqueio de linha vive no cabeçalho da tupla,
   e o catálogo só mostra o `RowShareLock` sobre a relação, que não distingue
   qual linha. Pedir um bloqueio conflitante com `NOWAIT` pergunta à linha.
3. A requisição de exclusão é **disparada de fato** (`.then(...)`), e não apenas
   construída.
4. **Condição 2 observada** — `pg_stat_activity` mostra um comando `active`, de
   outra sessão, citando `species`, com `wait_event_type = 'Lock'`, **e**
   `pg_locks` registra pedido não concedido. Como o `DELETE` é a **última**
   operação da transação do service, vê-lo dormindo no bloqueio é saber que a
   contagem da camada 1 já terminou.
5. **Asserção positiva** — com a exclusão parada e a sessão B ainda sem comitar,
   a sessão observadora conta **0** animais para aquela espécie. A camada 1 rodou
   antes desse instante, em READ COMMITTED: viu o mesmo zero e não lançou.
6. Só então o comite é liberado. O `409` que chega depois disso não tem como ter
   vindo da camada 1.

**Prova por mutação, que é o critério de pronto.** Com
`violaChaveEstrangeira` devolvendo `false` — camada 2 removida da produção — o
caso foi executado **4 vezes**:

| Rodada | Resultado | Evidência |
|---|---|---|
| 1 | ✕ falhou | `Expected: 409` / `Received: 500` |
| 2 | ✕ falhou | `Expected: 409` / `Received: 500` |
| 3 | ✕ falhou | `Expected: 409` / `Received: 500` |
| 4 | ✕ falhou | `Expected: 409` / `Received: 500` |

**4/4 vermelho.** O mutante foi revertido e o `git diff` de
`delete-species.service.ts` voltou a ser o mesmo `+6/-3` da entrega. Com a camada
2 no lugar, o log da execução verde mostra o `P2003` nascendo no código de
produção (`species.repository.ts:149`, `deleteById`) e saindo como `409`.

### Major #2 — o CI quebrado

- **`tests/helpers/banco-real.ts`** passou a ler `process.env.DATABASE_URL_INTEGRATION`
  **antes** do arquivo `.env`. Chave própria, e não `DATABASE_URL`: essa é
  sobrescrita por `tests/setup.ts` com um endereço morto, e essa proteção — que
  mantém as outras 24 suítes longe da rede — não podia ser afrouxada. **Nenhum
  `describe.skip` foi introduzido**; a falha continua alta quando não há nenhuma
  das duas origens.
- **`.github/workflows/backend-ci.yml`** ganhou um Postgres descartável
  (`services: postgres:17-alpine`, mesma família do 17.6 do Supabase, com
  health-check), `prisma migrate deploy` e `npm run db:seed:geography` — **nunca
  `db:seed`**, que é autoritativo sobre o administrador. O passo `Testes` deixou
  de ser condicional: a versão anterior passava em silêncio se `scripts.test`
  sumisse, que é a mesma forma de ficar verde sem medir nada.

**Provas do CI, executadas localmente contra um `postgres:17-alpine` em contêiner:**

| Prova | Resultado |
|---|---|
| `prisma migrate deploy` num banco vazio | 3 migrations aplicadas |
| `db:seed:geography` | `states` 27, `cities` 5571, **`users` 0** — o administrador não é tocado |
| Suíte inteira com `DATABASE_URL_INTEGRATION` apontada ao contêiner | **25 suítes / 323 testes, 0 falhas, 8,2 s** (banco local não paga a latência do pooler) |
| Banco descartável ao final | `users` 0, `species` 0, `animals` 0 — a suíte limpa o que cria |
| `DATABASE_URL_INTEGRATION` para `127.0.0.1:1` | **9 testes falham**, nenhum pulado — a variável é de fato consultada e a falha é alta |
| Sem a variável **e** sem o arquivo `.env` (a condição do CI antes desta correção) | suíte **falha no primeiro import** com a mensagem que nomeia as duas origens |

### Minor endereçados

- **#3** — origem da URL configurável (junto do #2).
- **#4** — as espécies da suíte passaram a ter uma **marca por execução**
  (`Cachorro [T010-xxxxxxxx]`); a limpeza de resíduo varre pelo prefixo estável
  `[T010-`. Um "Cachorro" semeado à mão não é mais apagado. A marca vai no fim do
  nome para não destruir a ordem alfabética que a regressão afirma (RN-11).
- **#5** — `fotografar` passou a contar o **escopo da suíte** (espécies pela
  marca, animais e imagens pela cidade que ela criou). A pergunta
  `species_id IS NULL` continua **global** de propósito: ela não conta o que a
  suíte fez, afirma o desfecho que a RN-09 proíbe em qualquer lugar da tabela.
- **#6** — a senha do administrador da suíte passou a ser **sorteada por
  execução**; nenhuma asserção depende do valor.
- **#7** — o CT-83 remove o animal por `DELETE /api/animals/:id`, como o cenário 4
  da HU-09 descreve, e não por atalho de banco. O animal do caso não tem imagem,
  então `compensar([])` sai sem tocar o armazenamento.

Também foi acrescentada uma rede de segurança no `finally` do CT-85 (CA-36): o
comite é liberado e as promessas pendentes são encerradas mesmo quando uma
asserção falha no meio, para que uma falha seja **reportada** em vez de travar a
suíte numa transação deixada aberta.

### Não endereçados

- **#8** (`MAKUCO.md` L3, pré-implementação) e **#9** (script `test:integration`
  separado) seguem como `suggestion`, fora do escopo desta correção.

---

## Code Review

### Rodada de Revisão 2 — 2026-08-27

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 10 (7 alterados, 3 criados)

#### Resumo

Os dois `major` da rodada 1 estão corrigidos, e as duas correções foram **provadas por
experimento, não aceitas por leitura**. O falso verde do `CT-85 (CA-36)` acabou: com a camada 2
removida do código de produção o caso ficou **vermelho 13 vezes em 13**, incluindo **4/4 contra o
mesmo Supabase em que a rodada 1 o viu passar 4/4 verde**. O CI foi executado ponta a ponta contra
um `postgres:17-alpine` descartável e fechou **25 suítes / 323 testes, exit 0**, sem `.env` e sem
nenhum `skip`. Nada do que a rodada 1 aprovou regrediu. Um `minor` novo foi encontrado, e ele
produz **falso vermelho**, não falso verde.

#### Provas construídas nesta rodada (todas por experimento)

| # | Prova | Método | Resultado |
|---|---|---|---|
| Q1 | **O `CT-85 (CA-36)` consegue ficar vermelho?** | `violaChaveEstrangeira` → `return false` (camada 2 removida). Executado em **três ambientes** | **13/13 VERMELHO**, sempre `Expected: 409 / Received: 500`: 6/6 no Postgres local, 3/3 sob latência artificial de 250 ms por pacote, **4/4 contra o Supabase real** — a condição exata da rodada 1. Mutante revertido, `md5` do arquivo de volta a `86d6bd77…`, diff de volta a `+6/-3` |
| Q1b | **Ele mede a camada 2, ou só "alguma coisa"?** | Mutante **inverso**: removida a **camada 1** (`if (vinculados >= …)`), camada 2 intacta | **3/3 VERDE.** O caso é específico: morre com a camada 2 apagada e sobrevive sem a camada 1. É o oposto exato do comportamento da rodada 1 |
| Q2 | **O thenable preguiçoso do supertest existe?** | Sonda independente: servidor HTTP contando requisições; `request(app).delete('/x')` guardado **sem** `.then()` | **CONFIRMADO.** Após 500 ms sem `.then()`: **0 requisições** chegaram ao servidor. Após o `await`: 1. Com `.then()` explícito: 1 em 500 ms. O diagnóstico de causa raiz do agente é **verdadeiro** — nenhuma pausa consertaria isso |
| Q3 | **`pg_locks` realmente não serve?** | `INSERT` de animal pendente numa sessão; catálogo consultado por outra; duas espécies irmãs (`SONDA-A` referenciada, `SONDA-B` não) | **CONFIRMADO.** `pg_locks`: **0** locks de tupla sobre `species`, apenas **2 de relação** — que não distinguem linha. O `FOR UPDATE NOWAIT` **distingue**: `SONDA-A` → `ERROR: could not obtain lock on row` (`55P03`); `SONDA-B` → retorna normalmente. A condição 1 está na técnica certa |
| Q4 | **Sobrou pausa carregando peso de sincronização?** | Varredura de `setTimeout`/`sleep` + instrumentação temporal de `esperarPelaCondicao` | **Não.** Único `setTimeout` é o intervalo entre sondagens. Medido: condição 1 satisfeita em **150 ms** (local) / **2729 ms** (Supabase) após 2 sondagens; condição 2 em **58 ms** / **1615 ms** — contra prazo de **15 000 ms**. Margem de 5× a 9× no ambiente mais lento. Nenhum caso decide por tempo |
| Q5a | **CI sem a variável e sem `.env`** | `.env` movido para fora; `DATABASE_URL_INTEGRATION` não definida | **Falha ALTA**: `exit=1`, `Tests: 0 total`, `Test suite failed to run`, mensagem nomeando as **duas** origens. **Nenhum skip** |
| Q5b | **CI no cenário exato do workflow** | `postgres:17-alpine` em contêiner + `prisma migrate deploy` (3 migrations) + `db:seed:geography`, **sem `.env`**, só `DATABASE_URL_INTEGRATION` | **25 suítes / 323 testes, exit 0, 6,4 s.** `db:seed:geography` deixou `states` 27, `cities` 5571 e **`users` 0** — o administrador não é tocado, como o workflow afirma |
| Q5c | **A variável é de fato consultada?** | `DATABASE_URL_INTEGRATION` para `127.0.0.1:1` | **9 testes falham, 0 pulados** |
| Q6a | **A FK é afirmada pelo NOME?** (regressão da rodada 1) | `RENAME CONSTRAINT animals_species_id_fkey → fk_sonda_rodada2`, mantendo `RESTRICT` | **CT-85 reprovou**: `Expected: "animals_species_id_fkey (index)"` / `Received: "fk_sonda_rodada2 (index)"`. Constraint restaurada |
| Q6b | **Uma migration `Cascade` reprovaria?** | FK recriada com o **mesmo nome** e `ON DELETE CASCADE` | **CT-85 reprovou — e o `CT-85 (CA-36)` TAMBÉM**, com `Expected: 409 / Received: 204`. **Ganho sobre a rodada 1**, em que o CA-36 continuava verde sob `Cascade`. FK restaurada para `RESTRICT` e conferida em `pg_constraint` |
| Q6c | **Os 4 mutantes do contador seguem mortos?** | filtro em `cityId`; `findMany().length`; `withTransaction` → `this`; nova instância ligada ao client global | **Todos mortos**: 2, 2, 7 e 7 testes vermelhos, respectivamente |
| Q7 | **Novo falso verde?** | Inspeção dos casos novos e dos minors #3–#7 + experimento | **Nenhum falso verde.** Um falso **vermelho** encontrado (achado #10) |

`npm run typecheck` → **exit 0**. `git diff --stat` idêntico ao inicial (464 inserções / 130 remoções).

Banco de desenvolvimento conferido antes e depois: `users` 2, `refresh_tokens` 8,
`email_confirmation_tokens` 1, `species` 0, `states` 27, `cities` 5571, `animals` 0,
`animal_images` 0 — **idêntico**. Catálogo de FKs idêntico (`animals_species_id_fkey` = `r`,
`animals_city_id_fkey` = `r`, `animal_images_animal_id_fkey` = `c`, `cities_state_id_fkey` = `r`).
`.env` restaurado e conferido por `md5sum` (`37f2e71185603a7ef52cae3e796d3cf4`, `SUCESSO`).
Contêiner removido, sondas apagadas, nenhum processo remanescente.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 10 | minor | `tests/integration/species-animal-integrity.spec.ts` | L641 | teste / dados | **Falso vermelho.** O caso de regressão afirma a listagem **global** de espécies com `toEqual([ESPECIE_RENOMEADA, ESPECIE_LIVRE])`. Qualquer espécie preexistente no banco reprova o caso. **Provado**: com uma única espécie `'Cachorro'` semeada à mão no banco, o caso reprovou (`Received +1`). Hoje só passa porque `species` = 0 no banco de desenvolvimento — quebra na primeira espécie cadastrada pela tela, que é o uso normal do produto. É o irmão dos minors #4 e #5, endereçados na limpeza e na fotografia mas não aqui. **A limpeza está correta**: a espécie semeada à mão sobreviveu à execução | Filtrar a listagem pela marca da execução antes do `toEqual` (`items.filter((i) => i.name.includes(MARCA_DA_EXECUCAO))`). A ordem alfabética da RN-11 se preserva sob filtro, então a asserção não perde poder |
| 11 | suggestion | `tests/integration/species-animal-integrity.spec.ts` | L800-L815 (`exclusaoBloqueadaEmLock`) | teste | A condição 2 é global em duas frentes: `pg_locks WHERE NOT granted` não filtra relação, e `query ILIKE '%species%'` casaria também com a contagem da camada 1 (`… WHERE species_id = …`). Num Postgres dedicado — que é o do CI — não há como confundir, e a mutação prova que não há falso verde. Num banco compartilhado, porém, ruído de outra sessão poderia satisfazer a condição antes da hora | Filtrar `l.relation = 'species'::regclass` e restringir a espera ao `DELETE` (`a.query ILIKE 'DELETE%'`) |
| 8 | suggestion | `MAKUCO.md` | L3 | documentação | Segue não endereçado, como a correção declarou. A linha ainda diz "Project is in pre-implementation stage — services/backend and services/frontend exist but are empty", quatro linhas acima do ponteiro novo para `technical-debt.md`. A afirmação é **factualmente falsa** hoje | Atualizar na próxima task que tocar o arquivo |
| 9 | suggestion | `package.json` | L15 | build | Segue não endereçado. `npm test` leva ~109 s contra o Supabase (6,4 s contra Postgres local). Um `test:integration` separado, obrigatório no CI, preservaria o laço rápido | Nunca como `skip` condicional |

Achados #1 a #7 da rodada 1: **#1 e #2 resolvidos e verificados**; **#3, #4, #5, #6 e #7 resolvidos**
(origem da URL configurável; espécies marcadas por execução com varredura pelo prefixo estável;
`fotografar` restrita ao escopo da suíte com `species_id IS NULL` mantida global de propósito; senha
sorteada por execução; CT-83 removendo o animal por `DELETE /api/animals/:id`).

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **9 de 9 critérios implementados e verificados contra dados reais.**
O critério que a rodada 1 deixou parcial — "o erro é traduzido para `409 SPECIES_IN_USE` quando
chega pela API (CT-85, CA-36)" — está agora **integralmente verificado** (Q1, Q1b, Q6b). A
correspondência com a FEATURE-001 foi reauditada contra a `spec_context.md` daquela feature e é
**um para um e completa**: a HU-06 tem exatamente quatro cenários de aceite — CT-24, CT-25, CT-26 e
CT-32 — e os quatro estão reexecutados como CT-81 a CT-84. CT-22 e CT-23 pertencem à HU-05
(exclusão **sem** vínculo) e CT-27 é espécie inexistente; nenhum CT da regra de vínculo ficou de fora.

**Pass 2 — Diff Analysis**: nenhum achado. Os arquivos alterados são os mesmos da rodada 1 mais
`.github/workflows/backend-ci.yml`, cuja alteração é a correção do major #2 e está contida no
job existente. Nada de `prisma/schema.prisma`, nada de migration nova, nenhuma entidade de Pedido
criada. `db:seed` perigoso ausente do workflow — apenas `db:seed:geography`, confirmado por
execução (`users` 0 ao final).

**Pass 3 — Code Practices**: nenhum achado. O código de produção não mudou em relação à rodada 1
além de comentários. `esperarPelaCondicao`, `linhaDeEspecieBloqueada` e `exclusaoBloqueadaEmLock`
são funções pequenas, de responsabilidade única, com nomes que dizem a pergunta que fazem; o
estreitamento de `unknown` continua por `instanceof`, sem `as` nem `any`. `SONDA`/número mágico
ausentes: `55P03`, `23503`, `P2003`, prazos e intervalos são todos constantes nomeadas.

**Pass 4 — Testing Review**: achados #10 e #11. Zero `describe.skip`, `it.skip`, `xit`,
`xdescribe`, `it.only`, `describe.only` e `test.todo` no arquivo — contados um a um. AAA explícito
nos 9 casos, nomes no formato `CT-NN: <asserção>`, nenhum condicional em corpo de teste. O
`finally` do CT-85 (CA-36) é idempotente e devolve o banco a um estado limpável mesmo quando uma
asserção falha no meio — verificado na prática: as 13 execuções vermelhas **reportaram a falha e
seguiram**, nenhuma travou a suíte numa transação aberta.

**Pass 5 — Security Review**: nenhum achado novo. O minor #6 da rodada 1 está resolvido — a senha
do administrador da suíte é sorteada por execução (`Senha1!${randomUUID()}`) e nenhuma asserção
depende do valor. `$queryRaw`/`$executeRaw` continuam sendo template tags parametrizadas;
`$queryRawUnsafe` não é usado no código entregue. Nenhum segredo no repositório: os valores do
workflow são declaradamente sem valor real e o `.env` segue `gitignore`d. A proteção do
`tests/setup.ts` sobre `DATABASE_URL` **não foi afrouxada** — a chave própria
`DATABASE_URL_INTEGRATION` foi a escolha certa, e as outras 24 suítes seguem sem tocar a rede
(comprovado: com a variável apontada para porta morta, apenas os 9 casos desta suíte falham).

**Pass 6 — Bug Detection**: nenhum achado. As três sessões do CT-85 (CA-36) são desconectadas no
`finally`; o cliente do módulo, no `afterAll`. `liberarComite` continua reatribuída dentro do
executor síncrono da `Promise`. `BigInt` convertido explicitamente. A ordem de limpeza
(imagens → animais → espécies) respeita a FK que a suíte verifica.

**Pass 7 — Project Patterns**: achado #8 (suggestion). O `technical-debt.md` foi reauditado e
segue **acionável**: a DT-01 traz data, link para esta task, link para a suíte e verifica a FK pelo
catálogo (`pg_constraint.confdeltype` = `'r'`) e não pelo arquivo de migration; a DT-02 nomeia
`Restrict` como obrigatório e `Cascade`/`SetNull` como proibidos, exige verificação contra dados
reais, descreve a estrutura de duas camadas que o `DeleteAnimalService` herdará e declara a
condição de bloqueio do módulo (RN-17b); a DT-03 **continua verdadeira** — `auth.validators.ts`
L105 ainda usa `chave in forma` enquanto `species.validators.ts` L137 e `animals.validators.ts`
L778 já usam `Object.hasOwn`. O ponteiro em `MAKUCO.md` existe e é substantivo.

#### Riscos declarados — julgamento

- **Duas execuções simultâneas contra o mesmo banco**: risco real e corretamente declarado. Vale
  registrar a mecânica exata: `limparResiduosDaSuite()` roda **antes** de a cidade ser criada, então
  a segunda execução apaga o resíduo da primeira **antes** de falhar no `ibge_code` único. A
  exclusão mútua é portanto tardia — ela impede a segunda execução de terminar, não de atrapalhar a
  primeira. É exatamente o que o agente relatou ter observado. No CI cada job tem Postgres próprio,
  e o cenário não aparece lá. **Aceito** como risco documentado, não como achado.
- **Minors #8 e #9 abertos como `suggestion`**: aceito.

#### A dívida está QUITADA?

**Sim — agora integralmente, e é a primeira vez que isso pode ser dito.**

A dívida herdada da FEATURE-001 já estava quitada na rodada 1: CT-24, CT-25, CT-26 e CT-32
reexecutados contra a tabela `animals` real e a constraint `animals_species_id_fkey` real, sem
dublê algum, resistindo a experimento — a suíte falha com o banco inalcançável, reprova se a
constraint mudar de nome e reprova se ela virar `Cascade`.

O que a rodada 1 apontou como **ainda apoiado em dublê** era a tradução do `P2003` para
`409 SPECIES_IN_USE` na resposta HTTP: o caso que declarava cobri-la passava 4/4 com a camada 2
apagada. **Esse ponto está fechado.** O `CT-85 (CA-36)` agora é **capaz de ficar vermelho pelo
motivo que anuncia** — 13/13, nos três ambientes, inclusive no mesmo Supabase onde antes ficava
verde — e é **específico**: sobrevive à remoção da camada 1 e morre com a remoção da camada 2.
A técnica que sustenta isso foi verificada de forma independente nos dois pontos em que o agente
apoiou o argumento: o thenable preguiçoso do supertest **existe** (0 requisições em 500 ms sem
`.then()`) e o `pg_locks` de fato **não** distingue a linha bloqueada (0 locks de tupla, só
`RowShareLock` de relação), enquanto o `FOR UPDATE NOWAIT` distingue.

**Nenhum critério de aceite desta task depende de dublê, e nenhum é incapaz de ficar vermelho.**

Para ser exato sobre o que segue verificado apenas por dublê e **não** é dívida desta task: o ramo
`P2025` de `delete-species.service.ts` — a corrida em que outra sessão exclui a espécie entre o
`findById` e o `DELETE` — é coberto por `delete-species.service.spec.ts:222` e por um caso
explicitamente marcado `[SOBRE DUBLÊ]` em `species-routes.spec.ts:1031`. Isso pertence à RN-14 /
CT-27 da FEATURE-001, não à regra de vínculo, não está entre os critérios de aceite desta task e
não foi contraído por ela. Fica **nomeado** aqui para que não seja descoberto por acidente depois.

#### Veredicto

> **APROVADA** — 0 critical, 0 major, 1 minor (#10, falso vermelho, não bloqueante), 3 suggestion.
> Os dois `major` da rodada 1 estão corrigidos e a correção foi provada por mutação repetida em
> três ambientes, incluindo aquele em que o defeito original se manifestava. A dívida obrigatória
> do módulo está **quitada**. O achado #10 deve entrar na próxima task que tocar a suíte: ele não
> pode produzir falso verde, mas quebra o CI da máquina do desenvolvedor assim que a primeira
> espécie for cadastrada pela tela.
