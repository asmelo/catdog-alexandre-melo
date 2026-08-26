# TASK-BACKEND-005 — Suíte de testes do domínio Species

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-005-backend-species-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 5 of 11 — Testes do backend
**Generated**: `2026-08-25`

---

## Context

Fecha o backend da feature cobrindo os CT-01 a CT-15, CT-16 a CT-27 e CT-30 a CT-34 com testes automatizados, mais a regressão exigida sobre a FEATURE-002. É aqui que a RN-08 se torna verificável antes de a entidade `Animal` existir: o duplo de `SpeciesUsageCounter` responde diferente de zero e exercita CT-24, CT-25 e CT-32 sem tabela de animais.

---

## Scope

**In:** Dublês em memória de `SpeciesRepository` e `SpeciesUsageCounter`, extensão do duplo de Prisma com o armazém de espécies, specs unitários dos quatro services (co-locados) e a suíte de integração HTTP das quatro rotas.

**Out:** Não alterar nenhum arquivo de `src/domains/species/` — se um teste exigir mudança de produção, reportar em vez de ajustar o código para passar. Não alterar `jest.config.ts` (os `roots`, o `moduleNameMapper` e o limiar de 80% já cobrem o novo domínio) nem `tests/setup.ts`. Não escrever teste de acessibilidade, de tela ou de desempenho (RNF-04 a RNF-10 são verificados no frontend ou em homologação). Não subir banco real: a suíte roda contra o duplo de Prisma, como a de autenticação.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `tests/fakes/in-memory-species.repository.ts` | dublê de repositório |
| `create` | `tests/fakes/fake-species-usage-counter.ts` | dublê de contagem |
| `modify` | `tests/fakes/prisma-double.ts` | armazém de espécies |
| `create` | `src/domains/species/services/create-species.service.spec.ts` | CT de criação |
| `create` | `src/domains/species/services/rename-species.service.spec.ts` | CT de renomeação |
| `create` | `src/domains/species/services/delete-species.service.spec.ts` | CT de exclusão |
| `create` | `src/domains/species/species-name.spec.ts` | CT de normalização |
| `create` | `tests/integration/species-routes.spec.ts` | CT das quatro rotas |

---

## Implementation

> **Reference pattern**: `tests/fakes/in-memory-user.repository.ts` (dublê à mão, PT-BR, com `Restauravel`), `src/domains/auth/services/register-user.service.spec.ts` (spec de service co-locado) e `tests/integration/auth-routes.spec.ts` (supertest sobre o `app`).
>
> **Estilo obrigatório em todos os arquivos**: `describe('<Sujeito>')` + `it('<CT-NN>: <asserção em PT-BR>')`, corpo dividido por `// Arrange`, `// Act`, `// Assert`. Cada teste rastreia explicitamente o CT e a RN que verifica. Nenhum `any`.

### `tests/fakes/in-memory-species.repository.ts` *(create)*
- `ArmazemDeEspecies implements Restauravel` + `InMemorySpeciesRepository implements SpeciesRepository`, com `withTransaction` devolvendo `this` — a transação não muda o comportamento em memória e fingir o contrário esconderia bugs em vez de revelá-los.
- Função `montarEspecie(dados = {})` no molde de `montarUsuario`, e `erroDeNomeDuplicado(): Prisma.PrismaClientKnownRequestError` com `code: 'P2002'` — é ela que permite testar o ramo de corrida do `create` e do `rename` sem banco.
- `listAll` deve ordenar por `nameNormalized` com `localeCompare('pt-BR')`, reproduzindo o `ORDER BY name_normalized ASC` do Postgres.
  > **Correção da rodada 2 — a instrução anterior estava factualmente errada.** Esta seção mandava manter `localeCompare` **desligado** e usar comparação binária de code units, alegando ser esse o critério do banco. A revisão da rodada 2 **mediu** a collation no banco de desenvolvimento (Supabase) em vez de supô-la: PostgreSQL 17.6, `datlocprovider = 'i'` (ICU), `datcollate = en_US.UTF-8`, e `species.name_normalized` com collation `"default"` — sem `COLLATE` explícito. `SELECT name FROM species ORDER BY name_normalized ASC` devolve `Ágil, Cão, Cavalo, Gato, Zebra`, que é exatamente o que `localeCompare('pt-BR')` produz; a comparação binária devolveria `Cavalo, Cão, Gato, Zebra, Ágil`. A premissa binária foi **refutada por medição contra o banco real** e o dublê passou a seguir o banco.
  >
  > O que **continua** sendo premissa: a migração de `species` não declara `COLLATE`, então a ordem é propriedade do **ambiente** e não do schema (um Postgres com libc `C` ordenaria diferente). Declarar o `COLLATE` é task de produção própria (achado #7 da rodada 2). Enquanto ela não existe, o dublê reproduz o que o ambiente em uso faz, e é o teste `CT-13` de `species-routes.spec.ts` (com `"Ágil"`/`"Zebra"`) que **reprova se o ambiente mudar**. Nomes ASCII não discriminam os dois critérios — por isso o caso usa acentuados.

### `tests/fakes/fake-species-usage-counter.ts` *(create)*
- Dublê controlável: `definirContagem(speciesId, quantidade)` e `countAnimalsBySpecies` devolvendo o valor definido (default `0`). `withTransaction` devolve `this`.
- É este arquivo que materializa a decisão da spec: a RN-08 é exercitada **sem** a entidade `Animal`. Comentário obrigatório apontando que ele deve continuar existindo depois da feature de animais, para os cenários de contagem que não se quer montar com dados reais.

### `tests/fakes/prisma-double.ts` *(modify)*
- Acrescentar `armazemDeEspecies` ao duplo e expor `species` (`findUnique`, `findMany`, `create`, `update`, `delete`) no `DubleDePrisma`, registrando o armazém em `reiniciarPrismaDouble()`.
- `create`/`update` devem **rejeitar** com o erro `P2002` quando `name_normalized` já existir no armazém — é o que torna CT-12 executável sem Postgres.
- `delete` deve rejeitar com `P2025` para id inexistente, e aceitar um gancho para simular `P2003` (a violação de FK que a feature de animais passará a produzir de verdade).

### `src/domains/species/services/create-species.service.spec.ts` *(create)*
- CT-01, CT-02, CT-03, CT-04, CT-05, CT-06, CT-07 (validação exercitada pelo schema, via `createSpeciesSchema.safeParse`), CT-08, CT-09, CT-10, CT-11.
- CT-12 em dois testes distintos e ambos obrigatórios: (a) conflito detectado pela consulta prévia; (b) conflito vindo do `P2002` do repositório. Os dois devem produzir `SpeciesNameAlreadyExistsError` com o mesmo `code` — é essa igualdade que a RN-16 exige.

### `src/domains/species/services/rename-species.service.spec.ts` *(create)*
- CT-16 (com asserção explícita de que o `id` devolvido é idêntico ao de entrada — RN-15), CT-17, CT-18, CT-19, CT-20.
- Teste dedicado para o ramo em que `findByNameKey` devolve a **própria** espécie: deve responder sucesso, e não conflito (RN-07). Sem ele, uma implementação que compare apenas as chaves e ignore o `id` passa despercebida.

### `src/domains/species/services/delete-species.service.spec.ts` *(create)*
- CT-22, CT-27 e os três cenários centrais:
  - **CT-24**: contador dublado em `1` → `SpeciesInUseError`;
  - **CT-25**: após CT-24, o armazém de espécies contém exatamente os mesmos registros de antes — asserção sobre o estado, não sobre a chamada;
  - **CT-26**: contador voltando a `0` → exclusão concluída.
- Teste do ramo `P2003`: contador em `0`, repositório rejeitando com `P2003` → o service responde `SpeciesInUseError` (mesmo `code` e mesma mensagem), nunca deixa o erro do Prisma escapar (RN-09 / CA-15).
- Teste de que o erro é lançado **de dentro** da transação (a callback do `$transaction` rejeita), usando `criarPrismaComTransacao`.

### `src/domains/species/species-name.spec.ts` *(create)*
- Testes de tabela para `normalizeSpeciesName` e `speciesNameKey`: espaços nas extremidades, espaços internos repetidos, tabulação, string só de espaços, preservação de caixa, preservação de acento e distinção `"Réptil"` / `"Reptil"` (RN-03 / RN-04 / RN-05 / CT-10 / CT-11).
- Spec **co-locado** em `src/` e não em `tests/unit/`: o módulo é regra de domínio, não infraestrutura transversal.

### `tests/integration/species-routes.spec.ts` *(create)*
- Supertest sobre o `app`, no molde de `auth-routes.spec.ts`.
- Cobertura obrigatória:
  - CT-13, CT-14, CT-15 no `GET`, incluindo a asserção de que o corpo é `{ items: [...] }` e de que **nenhum** item traz `nameNormalized`;
  - CT-01, CT-33 no `POST`;
  - CT-16, CT-20, CT-34 no `PATCH`;
  - CT-22, CT-24, CT-27, CT-32, CT-34 no `DELETE`, com o contador injetado por dublê na fábrica do controller;
  - **CT-30 e CT-31 como testes de tabela sobre os quatro endpoints**: um caso por endpoint sem `Authorization` (`401 SESSION_EXPIRED`) e um caso por endpoint com sessão de `cliente` (`403 FORBIDDEN`). Oito asserções no total — a RNF-01 pede um caso por endpoint por situação, e um teste só que cubra uma rota não satisfaz o critério.
- Asserção transversal: toda resposta de erro tem a forma `{ error: { code, message } }`, com `details` presente **apenas** nas falhas de validação (RNF-11 / CA-22).
- **Regressão da FEATURE-002** no mesmo arquivo ou em bloco `describe` próprio: reexecutar os cenários de acesso a rota protegida sem sessão e de renovação de sessão, confirmando que `tests/integration/auth-routes.spec.ts` continua passando sem alteração e que nenhum `code` ou mensagem existente mudou.

---

## Acceptance Criteria

- [ ] **Given** `npm test` na raiz de `services/backend`, **When** a suíte inteira roda, **Then** todos os testes passam e a cobertura global permanece ≥ 80% em statements, branches, functions e lines.
- [ ] **Given** a suíte, **When** cada `it` é lido, **Then** o título começa pelo identificador do caso de teste da spec (`CT-NN`) e o corpo está dividido em `// Arrange`, `// Act`, `// Assert`.
- [ ] **Given** os testes executados em ordem aleatória (`--randomize`), **When** repetidos, **Then** o resultado é idêntico — nenhum teste depende de estado deixado por outro.
- [ ] **Given** o dublê de contagem definido em `1`, **When** o service de exclusão é executado, **Then** `SpeciesInUseError` é lançado e o armazém de espécies permanece com o mesmo conteúdo (CT-24 / CT-25).
- [ ] **Given** o repositório rejeitando com `P2003`, **When** a exclusão é executada com contador em `0`, **Then** a resposta é `409 SPECIES_IN_USE` — o erro do Prisma nunca chega ao cliente (CA-15).
- [ ] **Given** o repositório rejeitando com `P2002`, **When** a criação é executada, **Then** a resposta é `409 SPECIES_NAME_ALREADY_EXISTS`, idêntica à do conflito detectado por consulta prévia (CT-12 / RN-16).
- [ ] **Given** a suíte de integração, **When** os quatro endpoints são chamados sem credencial e depois com sessão de `cliente`, **Then** existem 4 asserções de `401 SESSION_EXPIRED` e 4 de `403 FORBIDDEN` (CT-30 / CT-31 / CA-18 / RNF-01).
- [ ] **Given** a suíte de autenticação existente, **When** executada após esta task, **Then** passa sem nenhuma alteração nos seus arquivos, e nenhum `code` ou mensagem da FEATURE-002 mudou.
- [ ] Nenhum arquivo de `src/domains/species/` foi modificado por esta task.
- [ ] Nenhum teste usa `new Date()` diretamente para verificar instantes — o relógio é espionado por `~/utils/clock`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 a TASK-BACKEND-004 (todo o backend da feature implementado).
- **Blocks**: nenhuma task de implementação. É pré-requisito do Quality Gate do Sonar da feature.

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 8 (7 criados + 1 alterado), mais os 13 arquivos de produção de `src/domains/species/` lidos por inteiro e os arquivos dos quais eles dependem

#### Resumo

A suíte cobre os CT do backend com fidelidade real de dublê e sobrevive à verificação cética: a corrida do CT-12, a ordenação do CT-13/CT-14, a rede de segurança da RN-07 e a guarda da RN-08 foram todas confirmadas por **teste de mutação** (mutar a produção e verificar se a suíte reprova). O achado bloqueante é do mesmo tipo que o agente já havia encontrado sozinho: **um teste cujo título promete uma garantia que ele não verifica** — desta vez sobre a RN-09.

#### Método desta revisão

Cobertura alta não foi aceita como prova. Cada guarda relevante da produção foi **mutada** e a suíte reexecutada; um mutante que sobrevive é um comportamento que a suíte afirma cobrir e não cobre. Resultado (todos com o repositório restaurado ao final — `git status` confere: nenhum arquivo de produção alterado):

| Mutação aplicada na produção | Resultado |
|---|---|
| `rename`: remover `&& homonima.id !== especie.id` (RN-07) | **MORREU** (1 falha) — a rede de segurança é real |
| `repository.listAll`: `orderBy` por `name` em vez de `nameNormalized` | **MORREU** (11 falhas) — CT-13/CT-14 não passam por motivo errado |
| `delete`: `VINCULOS_QUE_JA_BLOQUEIAM` de 1 para 2 (RN-08) | **MORREU** (6 falhas) |
| `create`: desligar a consulta prévia de conflito | **MORREU** (1 falha) |
| `rename`: verificar conflito ANTES da existência (RN-14) | **MORREU** (1 falha) |
| `mapper`: expor `nameNormalized` | **MORREU** (17 falhas) |
| `delete`: `violaChaveEstrangeira` aceitar qualquer erro conhecido | **MORREU** (1 falha) |
| **`delete`: ligar o contador a `this.prisma` em vez de `tx` (quebra a RN-09)** | **SOBREVIVEU** — achado #1 |
| **`validators`: neutralizar a medição de `speciesNameKey(nome).length`** | **SOBREVIVEU** — achado #2 |
| **`validators`: neutralizar a remoção de caracteres invisíveis** | **SOBREVIVEU** — achado #3 |
| **`create`: `violaUnicidadeDoNome` aceitar qualquer erro conhecido** | **SOBREVIVEU** — achado #4 |
| **`rename`: `registroAusenteNaEscrita` aceitar qualquer erro conhecido** | **SOBREVIVEU** — achado #4 |
| **`delete`: `registroAusenteNaEscrita` aceitar qualquer erro conhecido** | **SOBREVIVEU** — achado #4 |
| **dublê: trocar a comparação binária por `localeCompare('pt-BR')`** | **SOBREVIVEU** — achado #5 |

Gate reexecutado nesta revisão: `npm run typecheck` **exit 0** (três projetos), `npm test` **20 suítes / 249 testes**, `npm run test:cov` **exit 0** com 99.58 / 95.45 / 100 / 99.58 e os 13 arquivos de `src/domains/species/**` em 100/100/100/100, `npx jest --randomize` **3× com 249/249**. ESLint e SonarQube **não** foram usados como evidência (o projeto não tem ESLint; o servidor do Sonar está fora de alcance).

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | **major** | `src/domains/species/services/delete-species.service.spec.ts` | L245-L261 | teste que não verifica o que promete | O teste `'RN-09: a contagem e a exclusão rodam com o MESMO executor da transação aberta pelo service'` assere apenas `toHaveBeenCalledTimes(1)` nos dois espiões. Trocar `this.usage.withTransaction(tx)` por `this.usage.withTransaction(this.prisma)` em `delete-species.service.ts:126` — que é **exatamente** a quebra da RN-09 que o título nomeia — deixa **249/249 verdes**. A causa raiz está no dublê: `criarPrismaComTransacao` (`prisma-double.ts:385`) e `DubleDePrisma.$transaction` (`prisma-double.ts:341`) entregam **o próprio cliente** como `tx`, então `tx === this.prisma` e nenhuma asserção sobre o argumento consegue discriminar. A suíte declara garantida a regra de integridade central da feature sem garanti-la | Fazer o `$transaction` dos dois dublês entregar à callback um executor **distinto** do cliente (um `mockDeep` filho, ou o mesmo mock com uma propriedade marcadora) e então asserir que os dois espiões receberam esse mesmo objeto. Enquanto isso não for feito, renomear o teste para o que ele realmente prova ("cada colaborador é rebindado exatamente uma vez") — o que a suíte não pode provar, ela não pode anunciar |
| 2 | minor | `src/domains/species/species.validators.ts` (produção) — lacuna em `create-species.service.spec.ts` / `species-routes.spec.ts` | L82-L87 | cobertura enganosa | O segundo operando do `\|\|` (`speciesNameKey(nome).length > TAMANHO_MAXIMO_DO_NOME`) nunca **dispara** em nenhum teste: CT-07 usa 61 caracteres ASCII, que já reprovam pelo primeiro operando. Substituir o limite por `99999` mantém 249/249 e a cobertura **continua marcando 100% de branches** — o Istanbul dá o operando por coberto assim que ele é *avaliado* uma vez. É o mesmo artefato do `&&` que o agente já havia identificado na RN-07, agora num `\|\|`. A guarda existe para impedir que um nome que só estoura os 60 caracteres **depois** do `toLowerCase()` (o `İ`, U+0130) vire 500 em vez de 400 | Acrescentar um caso com `'İ'.repeat(60)` esperando `NAME_TOO_LONG` no `safeParse` e o equivalente `400 VALIDATION_ERROR` via `POST /api/species` |
| 3 | minor | `src/domains/species/species.validators.ts` (produção) — lacuna nos specs | L40-L44 | comportamento não verificado | A remoção de `CARACTERES_INVISIVEIS` (espaço de largura zero, hífen suave, BOM) não tem nenhum teste. Trocar a regex por uma que nunca casa mantém 249/249, com 100% de statements no arquivo. A higienização existe para impedir que `"Ga​to"` produza uma chave de unicidade diferente de `"gato"` e o cadastro exiba duas linhas visualmente idênticas — a duplicata que a RN-04 existe para impedir | Dois casos: `"Ga​to"` com `"Gato"` já cadastrado deve responder `409 SPECIES_NAME_ALREADY_EXISTS`; `"​​"` deve responder `400` com "Este campo é obrigatório." |
| 4 | minor | `create-species.service.spec.ts` L343-L356; `rename-species.service.spec.ts` L269-L284; `delete-species.service.spec.ts` L209-L222 | — | teste negativo fraco | Os três testes "erro do Prisma que não é X continua subindo" rejeitam com um `Error` **comum**, o que exercita apenas a metade `instanceof` das guardas. Nenhum teste passa um `PrismaClientKnownRequestError` de código **não relacionado**. Consequência medida: degenerar `violaUnicidadeDoNome` (create) ou `registroAusenteNaEscrita` (rename e delete) para um `instanceof` puro **sobrevive** com 249/249 — um `P2028` (timeout de transação) ou `P1001` (banco inalcançável) seria reportado ao administrador como "Já existe uma espécie com este nome." ou "Espécie não encontrada.", e a suíte não notaria | Em cada um dos três, rejeitar com um `PrismaClientKnownRequestError` de código alheio (`P2028`) e asserir que ele sobe intacto. É o caso de maior valor entre os minor: protege contra mascarar indisponibilidade de banco como desfecho de negócio |
| 5 | suggestion | `tests/fakes/in-memory-species.repository.ts` | L119-L135 | fidelidade de dublê não observável | A comparação binária de `ordenarPorChave` está correta, mas **não é sustentada por nenhum teste**: trocá-la por `localeCompare('pt-BR')` mantém 249/249, porque CT-13/CT-14 usam só nomes ASCII (`cachorro`/`gato`/`sapo`) em que as duas ordenações concordam. Quem de fato impede CT-13/CT-14 de passar por motivo errado é a **conferência do `orderBy` no delegate `species.findMany`** (`prisma-double.ts:296-303`) — essa sim matou a mutação correspondente com 11 falhas. Ressalva: um caso discriminante (`"Cão"` vs `"Cavalo"`) só seria legítimo se a collation do banco de produção for confirmadamente binária/`C` — a revisão da TASK-BACKEND-002 já registrou que a ordem de acentuados varia por collation | Manter a escolha; reescrever o comentário para dizer que a comparação binária é uma **premissa declarada** sobre a collation, e não uma propriedade verificada, e adicionar o caso discriminante apenas depois de confirmar a collation de produção |
| 6 | minor | `tests/integration/species-routes.spec.ts` | L79-L90 (cabeçalho) | rastreabilidade | O *Context* da task declara cobertura de "CT-01 a CT-15, CT-16 a CT-27 e CT-30 a CT-34". **CT-21** (cancelar edição em linha) e **CT-23** (cancelar a confirmação de exclusão) estão dentro da faixa, não têm superfície no backend e não aparecem citados em lugar nenhum da suíte, nem como exclusão declarada | Uma linha no cabeçalho do arquivo registrando que CT-21 e CT-23 são exclusivamente de tela e pertencem à TASK-FRONTEND-011 |
| 7 | minor | `species-name.spec.ts` L25-L126, L140, L184; `delete-species.service.spec.ts` L173, L209, L245, L271, L284; `rename-species.service.spec.ts` L154, L269; `create-species.service.spec.ts` L343; `species-routes.spec.ts` L390, L817, L834, L877+ | — | critério de aceite literal | O CA exige que "o título começa pelo identificador do caso de teste da spec (`CT-NN`)". Cerca de 20 títulos começam por `RN-xx`, `CA-15` ou prosa livre, e o `it.each` de `species-name.spec.ts` renderiza 10 dos 15 títulos de tabela como `RN-03`/`RN-04`. A escolha é defensável — não existe CT na spec para "erro de infraestrutura continua subindo" — mas é desvio literal de um CA que a task marca como cumprido | Manter o comportamento e **registrar a exceção na task**, em vez de deixar o CA marcado como atendido sem ressalva |
| 8 | suggestion | `tests/integration/species-routes.spec.ts` | L506, L839, L869, L962 | prática de teste | Quatro laços `for` dentro de corpo de teste. As práticas de teste do projeto proíbem lógica no corpo do teste; na prática, quando um dos elementos falha a mensagem do Jest não diz qual | Trocar por `it.each` ou por asserções por item |
| 9 | suggestion | `tests/fakes/prisma-double.ts` | L360 | acoplamento entre dublês | `reiniciarPrismaDouble()` chama `contadorDeUsoDeEspecies.limpar()`. O dublê de Prisma passa a reiniciar um dublê que **não tem nada a ver com Prisma**, e todo spec unitário que importa `criarPrismaComTransacao` (inclusive os do domínio auth) passa a instanciar o singleton que só a suíte de integração usa | Reiniciar o contador no `beforeEach` da própria `species-routes.spec.ts`, ao lado de `reiniciarPrismaDouble()` |
| 10 | suggestion | `species-name.spec.ts` L148-L149, L167; `create-species.service.spec.ts` L62; `rename-species.service.spec.ts` L45, L55, L98 | padrão | Comentários com acento, divergindo da convenção "PT-BR sem acento em comentário `.ts`" cobrada nas rodadas das TASK-BACKEND-003 e 004 — **mas** alinhados ao precedente de toda a suíte existente (`auth-routes.spec.ts`, `register-user.service.spec.ts` e `tests/fakes/*` usam acento em comentário). Os dois dublês novos, por sua vez, têm zero acento. A regra nunca foi escrita | Decidir de uma vez em `.makuco/codebase/conventions.md` se a convenção alcança `tests/` e `*.spec.ts`, e uniformizar numa passagem própria — não re-litigar por task |
| 11 | suggestion | `rename-species.service.spec.ts` | L154-L180 | honestidade de marcação | É o teste **mais dependente de dublê** da suíte: para alcançar o ramo ele precisa de uma linha cuja chave contradiz o nome (`nameNormalized: 'chave-antiga'`) **e** de um `findByNameKey` dublado — combinação que nenhum caminho de produção consegue produzir, o que torna `homonima.id !== especie.id` inalcançável com dados consistentes. O comentário é honesto sobre isso, mas o teste não recebe a marca `[SOBRE DUBLÊ]` usada em CT-24/25/26/32 | Aplicar a mesma marca e registrar na task que o ramo é rede de segurança inalcançável, e não caminho de execução |

#### Verificações pedidas explicitamente — respostas

1. **Outros testes que passam pelo motivo errado**: sim, encontrados — achados **#1** (o mais grave, mesmo formato do que o agente achou sozinho, agora sobre a RN-09), **#2** (`||` do validador, o gêmeo exato do artefato de `&&` do Istanbul), **#3**, **#4** e **#5**. Todos comprovados por mutação, não por leitura.
2. **Fidelidade dos dublês / CT-13 e CT-14**: **confirmado, mas não pelo motivo anunciado**. A conferência de `orderBy: { nameNormalized: 'asc' }` no delegate `findMany` é o que segura os dois casos (mutação correspondente: 11 falhas). A ordenação binária do armazém, ao contrário do que o comentário afirma, não é observável por nenhum teste (achado #5).
3. **CT-12 (corrida)**: **correto**. A janela é real e foi verificada microtarefa a microtarefa: `comoPromessa` agenda o `findByNameKey` das duas execuções antes de qualquer `create`, então as duas leituras devolvem `null` e quem recusa a segunda é a constraint reproduzida pelo armazém. O desfecho asserido (1 cumprida, 1 `SpeciesNameAlreadyExistsError`, 1 linha) é exatamente o que a RNF-03 e a RN-16 exigem. A mutação que desliga a consulta prévia mata o CT-12 (a), confirmando que ele também não é decorativo.
4. **Uso de `dependencias?` em `createSpeciesController`**: **estratégia sólida, aprovada**. O acoplamento é mínimo e reversível: `PrismaSpeciesRepository` real sobre o cliente dublado, os quatro services de produção, os middlewares, o `app.ts` e a transação continuam rodando; só a porta que **não tem implementação de verdade hoje** é trocada. O ramo default da fábrica tem teste próprio (`species-routes.spec.ts:945-970`). A alternativa (remover o parâmetro) tornaria a camada 1 da RN-09 inverificável por HTTP, e a justificativa apresentada — `PrismaSpeciesUsageCounter` responde `0` sem tocar o banco, logo nenhum estado do dublê produz 409 — está correta, verificada no código.
5. **`dependenciasDeTeste` como declaração de função**: **necessário e correto** na posição em que está. Ela é invocada durante o `require('~/app')`, que o TypeScript emite **antes** de qualquer statement posterior ao bloco de imports; um `const` ali estaria na zona morta temporal. Registro para a próxima leitura: um `const` **acima** do import de `~/app` também funcionaria — a necessidade vem do layout escolhido, não de uma restrição inescapável do Jest. Não é contorno de outro problema.
6. **Marcação `[SOBRE DUBLÊ]`**: **presente e honesta** em CT-24, CT-25, CT-26, CT-32 e nos dois casos de `P2003`, tanto no spec unitário quanto no de integração, com o cabeçalho de `delete-species.service.spec.ts` explicando o que está e o que **não** está sobre dublê e amarrando a reexecução à TASK-010. Única ressalva de consistência: achado #11.
7. **FEATURE-002 intacta**: **confirmado**. `git status` mostra um único arquivo alterado em toda a task — `tests/fakes/prisma-double.ts`, +126/-0, **só adições**. `jest.config.ts`, `tests/setup.ts` e `tests/integration/auth-routes.spec.ts` sem diff. O bloco de regressão reexecuta 401 em rota protegida, rotação de refresh com revogação `ROTATED`, acesso cruzado do `admin` e envelope de rota inexistente. Nenhum `code` nem mensagem existente mudou.
8. **Independência de ordem**: **confirmado**. `npx jest --randomize` reexecutado 3× nesta revisão: 249/249 nas três.

**Invariantes**: nenhum `any`, `@ts-ignore` ou `as unknown as` nos oito arquivos nem em `tsconfig.test.json` (as duas ocorrências da palavra "any" são comentários explicando como ela foi evitada). `new Date()` só com literal fixo (`'2026-01-01T00:00:00.000Z'`), nunca para verificar instante — nenhum teste precisou espionar `~/utils/clock`, e não precisava: as datas vêm dos defaults do schema. Alias `~/` para produção e caminho relativo para `tests/`, idêntico ao precedente de `register-user.service.spec.ts`. **Zero arquivos de produção modificados** — reconferido após as mutações.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 9 de 10 critérios de aceite atendidos integralmente. O critério dos títulos `CT-NN` está parcialmente atendido (achado #7). Todos os itens obrigatórios da seção *Implementation* foram entregues, incluindo os dois testes distintos do CT-12, o teste dedicado da RN-07, os três cenários de CT-24/25/26, o ramo `P2003`, o erro lançado de dentro da transação, os testes de tabela CT-30/CT-31 com as 8 asserções exigidas, a asserção transversal do envelope e o bloco de regressão. Achados: #6, #7.

**Pass 2 — Diff Analysis**: nenhum achado. Os 7 arquivos criados e o 1 alterado são exatamente os da tabela *Files*, nem um a mais. `src/domains/species/` intocado (Scope — Out respeitado), `jest.config.ts` e `tests/setup.ts` intocados, `package.json` sem alteração (nenhuma dependência nova). Sem formatação em massa: o diff de `prisma-double.ts` é +126/-0.

**Pass 3 — Code Practices**: nenhum achado bloqueante. Responsabilidade única por dublê (armazém separado do repositório, contador separado do repositório — a segregação de interfaces que a produção declarou), injeção de dependência em todos os pontos, sem `else`, sem número mágico (`SEM_VINCULO`, `INSTANTE_DE_CRIACAO`, `NOME_COM_60_CARACTERES` nomeados), `ArmazemDeEspecies` com uma única variável de instância. Linguagem ubíqua conforme: domínio em inglês (`Species`, `countAnimalsBySpecies`), dublês em PT-BR como os já existentes (`ArmazemDeUsuarios` → `ArmazemDeEspecies`). `species-routes.spec.ts` com 995 linhas está no mesmo patamar do `auth-routes.spec.ts` (916) — precedente, não desvio. Achado cosmético: #10.

**Pass 4 — Testing Review**: AAA presente em todos os 92 testes novos (a forma `// Arrange & Act` aparece onde o ato é a própria construção, como no precedente do domínio auth). Estado reiniciado por `beforeEach` em todos os arquivos; nenhum estado mutável compartilhado entre testes — confirmado empiricamente com `--randomize` 3×. Mocks restaurados pelo `restoreAllMocks` de `tests/setup.ts` e zerados pelo `clearMocks` do `jest.config.ts`. Cobertura muito acima do piso. Achados: #2, #3, #4, #5, #8, #9, #11 — todos sobre a **qualidade** do que é asserido, não sobre a quantidade.

**Pass 5 — Security Review**: nenhum achado. Nenhuma dependência nova (A06). Nenhum segredo real: as credenciais são de teste e `tests/setup.ts` aponta o `dotenv` para um arquivo inexistente e a `DATABASE_URL` para `127.0.0.1:1`, de modo que nem um teste que escapasse do dublê alcançaria o Supabase de produção. Nenhum PII em log ou asserção. A suíte **reforça** o controle de acesso (A01): 8 asserções cobrindo os quatro endpoints sem sessão e com role `cliente`, mais o caso de token adulterado e o de corpo inválido com `cliente` (que prova a ordem `authenticate` → `authorizeRole` → `validateRequest`). A asserção de que `nameNormalized` não vaza em nenhum ponto do corpo (`JSON.stringify(...).not.toContain`) é controle de exposição de dado — matou a mutação correspondente com 17 falhas. Sem injeção, sem SSRF, sem desserialização de entrada não confiável.

**Pass 6 — Bug Detection**: nenhum defeito funcional nos dublês. Lido o conteúdo integral dos oito arquivos e dos arquivos de que dependem. Sem `null`/`undefined` não tratado (o `noUncheckedIndexedAccess` obriga o `?.` em todo índice, e ele está lá); sem `catch` vazio — os três `.catch((erro: unknown) => erro)` capturam para **asserir** sobre o erro, e o único `.catch(() => undefined)` (delete spec L131) é deliberado e o teste seguinte assere o estado; sem vazamento de recurso — nenhum socket, nenhum timer, nenhum handle; sem coerção insegura (`===` em toda comparação); sem estado inconsistente — `renomear` do armazém usa `map` + spread em vez de mutar no lugar, precisamente para que o `capturarEstado` por referência não preserve a alteração no rollback, e a ordem `P2025` antes de `P2002` em `renomear` e `buscarPorId` antes do gancho de `P2003` em `species.delete` reproduzem a ordem do Postgres (uma inversão faria id inexistente marcado responder 409 em vez de 404 — o comentário já registra isso). Um ramo morto sem consequência: `ordenarPorChave` devolve `0` para chaves iguais, situação que a constraint de unicidade impede.

**Pass 7 — Project Patterns**: nenhum achado bloqueante. Estrutura (`tests/fakes/`, `tests/integration/`, spec co-locado em `src/` para regra de domínio), kebab-case nos arquivos, `~/` para produção e relativo para `tests/`, `Restauravel` implementado pelo armazém novo como pelos três já existentes, `comoPromessa` reutilizado em vez de `async` sem `await`, `jest.mock` do cliente Prisma no mesmo molde de `auth-routes.spec.ts`, dublê no nível dos *delegates* e não dos repositórios — tudo conforme ao que já existe. Achado cosmético: #10.

#### Veredicto

> **NECESSITA CORREÇÕES** — 1 major, 5 minor, 5 suggestion.
>
> O bloqueio é **um só** e a correção é pequena: o achado **#1**, em `src/domains/species/services/delete-species.service.spec.ts:245-261`. Ou o dublê passa a entregar um executor distinto do cliente e o teste assere a identidade do argumento, ou o título deixa de prometer o que ele não prova. Um teste que anuncia garantir a RN-09 sem garanti-la é pior do que a ausência do teste, porque desliga a desconfiança de quem lê.
>
> Recomendado no mesmo passe, por serem baratos e de alto retorno: **#4** (trocar o `Error` comum por um `PrismaClientKnownRequestError` de código alheio nos três testes negativos — é o que impede indisponibilidade de banco de sair como mensagem de negócio) e **#2**/**#3** (dois casos de fronteira que cobrem guardas de produção hoje sem nenhum teste).
>
> Fora isso, a suíte é sólida e o restante da entrega está **aprovado**: escopo exato, nenhum arquivo de produção tocado, FEATURE-002 intacta, independência de ordem confirmada, marcação `[SOBRE DUBLÊ]` honesta e a decisão sobre `dependencias?` bem tomada.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: NECESSITA CORREÇÕES
**Arquivos revisados**: 8 da task (7 criados + 1 alterado), mais os 13 arquivos de produção de `src/domains/species/`, os 4 services de autenticação que abrem transação, `prisma/migrations/20260826124117_create_species/migration.sql` e o banco Supabase de desenvolvimento

#### Resumo

O achado bloqueante da rodada 1 foi **corrigido de verdade** — reverificado por mutação, não por relato: ligar qualquer um dos dois colaboradores ao cliente global agora reprova o teste da RN-09, e a mensagem de falha nomeia o defeito ("cliente global (FORA da transação)"). Os cinco minor também morreram, dois deles com folga maior do que a pedida. A pendência que esta rodada tinha de decidir foi decidida contra a implementação: **a premissa binária NÃO se confirma**. O banco real ordena por locale, e o teste `CT-13` que a correção acrescentou fixa exatamente a ordem oposta à que o `ORDER BY name_normalized` produz.

#### Método desta revisão

Cada ponto foi remutado do zero, com a produção restaurada ao final (`git status` confere: nenhum arquivo de produção, `jest.config.ts`, `tests/setup.ts`, `tsconfig.test.json` ou `package.json` alterado). Além disso foram procurados mutantes NOVOS, e a collation do banco foi medida em vez de suposta.

**A. Reverificação dos 6 pontos corrigidos**

| Mutação aplicada | Resultado |
|---|---|
| `delete`: `this.usage.withTransaction(tx)` → `withTransaction(this.prisma)` (a quebra literal da RN-09) | **MORREU** — 1 falha, `contador: "cliente global (FORA da transação)"` |
| `delete`: `this.species.withTransaction(tx)` → `withTransaction(this.prisma)` | **MORREU** — 1 falha, `repositorio: "cliente global (FORA da transação)"` |
| `validators`: `speciesNameKey(nome).length > 60` → `> 99999` (minor #2) | **MORREU** — 2 falhas (unitário + HTTP) |
| `validators`: `CARACTERES_INVISIVEIS` → regex que nunca casa (minor #3) | **MORREU** — 5 falhas |
| `create`: `violaUnicidadeDoNome` → `instanceof` puro (minor #4) | **MORREU** — 1 falha |
| `rename`: `violaUnicidadeDoNome` → `instanceof` puro | **MORREU** — 2 falhas |
| `rename`: `registroAusenteNaEscrita` → `instanceof` puro | **MORREU** — 1 falha |
| `delete`: `violaChaveEstrangeira` → `instanceof` puro | **MORREU** — 2 falhas |
| `delete`: `registroAusenteNaEscrita` → `instanceof` puro | **MORREU** — 1 falha |
| dublê: comparação binária → `localeCompare('pt-BR')` (minor #5) | **MORREU** — 1 falha (o novo CT-13) |
| `criarPrismaComTransacao`: voltar a entregar o próprio cliente | **MORREU** — 1 falha (`expect(executor).not.toBe(cliente)`) |

As **cinco** guardas de `PrismaClientKnownRequestError` do domínio morrem agora, e não só as três que o achado #4 nomeava. Correção acima do pedido.

**B. Varredura por mutantes novos** (14 mutações adicionais na produção de espécies, 4 nos services de auth, 4 nos dublês)

Morreram: `orderBy` `asc`→`desc` (12 falhas), `>=`→`>` na RN-08 (6), 201→200 (3), 204→200 (2), 200→201 no `PATCH` (2), envelope `{items}`→array puro (3 suítes), `trim()` removido (15), `toLowerCase()` removido (24), `.uuid()` do `:id` removido (3), desvio da RN-07 invertido (1), rede de segurança `homonima.id` removida (1), `withTransaction` do contador devolvendo `this` (1), `nome.length > 60`→`>=` (2).

Sobreviveram: achados **#2**, **#3**, **#4**, **#5** e **#6** abaixo. Dois mutantes quase-equivalentes foram descartados como não-achado: remover o desvio `chaveNova !== especie.nameNormalized` (a rede de segurança do `id` produz o mesmo desfecho) e remover a pré-checagem de existência do `delete` (a tradução do `P2025` produz o mesmo `404`).

**C. Collation do banco — medição, não suposição**

Consultado o Supabase de desenvolvimento pela `DIRECT_URL`, com **zero escrita persistida** (leituras de catálogo e um `INSERT`/`SELECT`/`ROLLBACK` dentro de transação interativa; `species` conferida em **0 linhas antes e depois**):

```
PostgreSQL 17.6
datcollate = en_US.UTF-8 | datctype = en_US.UTF-8 | datlocprovider = 'i'  (ICU)
species.name           -> collation "default"  (sem COLLATE explicito)
species.name_normalized-> collation "default"  (sem COLLATE explicito)

SELECT name FROM species ORDER BY name_normalized ASC   (dados revertidos)
  -> Ágil, Cão, Cavalo, Gato, Zebra
```

Comparação com os três critérios candidatos, sobre o mesmo conjunto:

| Critério | Ordem produzida |
|---|---|
| **Banco real (ICU, `default`)** | `ágil, cão, cavalo, gato, zebra` |
| Comparação binária (a premissa adotada) | `cavalo, cão, gato, zebra, ágil` |
| `localeCompare('pt-BR')` | `ágil, cão, cavalo, gato, zebra` |
| `ORDER BY ... COLLATE "C"` no próprio banco | `agil, cao, cavalo, cão, zebra, ágil` |

**Resposta à pendência: a premissa binária NÃO se confirma.** O banco ordena por locale, e é `localeCompare` — o critério que o comentário do dublê chama de errado — que reproduz o `ORDER BY` real.

**D. Gate**

`npm run typecheck` **exit 0** (três projetos). `npm test` **20 suítes / 260 testes**. `npm run test:cov` **exit 0**, global 99.58 / 95.45 / 100 / 99.58, os 13 arquivos de `src/domains/species/**` em **100/100/100/100**. `npx jest --randomize` **3× com 260/260**. ESLint e SonarQube não foram usados como evidência.

**E. FEATURE-002**

**138 testes**, todos verdes e **não enfraquecidos**. Contagem conferida suíte a suíte: 260 totais − 122 do domínio species (26 + 15 + 14 + 19 + 48) = 138. A troca de comportamento do `$transaction` é inerte para a autenticação e isso foi verificado no código, não presumido: nenhum dos quatro services toca o `tx` diretamente — ele só é repassado a `withTransaction(...)`, e os dublês de repositório devolvem `this`. `tests/integration/auth-routes.spec.ts`, `jest.config.ts` e `tests/setup.ts` **sem diff**. Ressalva registrada no achado #6.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | **major** | `services/backend/tests/fakes/in-memory-species.repository.ts` e `services/backend/tests/integration/species-routes.spec.ts` | L139-L166 (esp. L165) e L372-L400 (esp. L399) | fidelidade de dublê / teste que fixa o oposto do real | A premissa binária foi **medida e refutada**. O banco (Supabase, PostgreSQL 17.6, provider ICU, `en_US.UTF-8`, coluna sem `COLLATE` explícito) devolve `Ágil, Cão, Cavalo, Gato, Zebra`; a comparação binária de `ordenarPorChave` devolve `Cavalo, Cão, Gato, Zebra, Ágil`. O novo teste `CT-13: a ordem é a comparação BINÁRIA...` assere `['Zebra', 'Ágil']` — **exatamente o inverso** do que o `ORDER BY name_normalized` produz. A rodada 1 condicionou este caso a "apenas depois de confirmar a collation"; ele foi acrescentado antes, e a confirmação chegou contra ele. Com nomes ASCII (`cachorro`/`gato`/`sapo`) nada aparece; com `"Réptil"`, `"Pássaro"` ou `"Cão"` — nomes que a própria spec usa — o dublê e o banco divergem, que é precisamente o defeito que o comentário do arquivo diz existir para impedir | Trocar `ordenarPorChave` por `primeira.nameNormalized.localeCompare(segunda.nameNormalized, 'pt-BR')`, inverter a expectativa do CT-13 para `['Ágil', 'Zebra']` e reescrever os dois comentários (o do dublê e o do teste): o critério do banco é **por locale**, e o que resta de premissa é a collation do ambiente, não a comparação binária. Abrir follow-up para a TASK-FRONTEND-009 (item que manda comparar binariamente, arquivo `task_009_...md` L44) e para a TASK-FRONTEND-010 — as duas foram escritas sobre a premissa refutada e produziriam posição de inserção divergente do servidor |
| 2 | minor | `services/backend/src/domains/species/mappers/species.mapper.ts` (produção) — lacuna nos specs | L31-L32 | cobertura enganosa | Os dois instantes da representação pública são **intercambiáveis sem que nada reprove**: `createdAt: species.updatedAt.toISOString()` mantém 260/260, e `updatedAt: species.createdAt.toISOString()` também. Nenhum teste compara o **valor** dos dois campos — só o conjunto de chaves (`species-routes.spec.ts` L433-L438, `create-species.service.spec.ts` L255) e o formato ISO. A causa é o dublê: `montarEspecie` (`in-memory-species.repository.ts` L55-L56) grava o MESMO `INSTANTE_DE_CRIACAO` nos dois campos, então o cadastro inteiro roda com `createdAt === updatedAt` | Semear uma espécie com `createdAt` e `updatedAt` distintos e asserir os dois valores no `GET` — um caso só, e ele mata os dois mutantes |
| 3 | minor | `services/backend/src/domains/species/species.validators.ts` (produção) — lacuna em `create-species.service.spec.ts` | L40; lacuna em L188-L199 | cobertura parcial | Encolher `CARACTERES_INVISIVEIS` de `[­​-‏⁠﻿]` para `[­​⁠﻿]` mantém **260/260**: a faixa `U+200C`–`U+200F` (não-juntor, juntor e os dois marcadores de direção de texto) não é exercitada por nenhum caso. O teste que existe cobre `U+200B`, `U+00AD`, `U+2060` e `U+FEFF`, mas o comentário do teste diz "para que a lista não perca um membro em silêncio" — e ela pode perder quatro | Acrescentar `U+200C` e `U+200F` ao caso `RN-04: hífen suave, colador de palavras e BOM também são removidos`, ou trocá-lo por `it.each` sobre os sete code points da faixa |
| 4 | suggestion | `services/backend/tests/fakes/prisma-double.ts` | L352-L356 | propriedade de dublê não observável | Reverter o `$transaction` de `DubleDePrisma` para `executar(this)` mantém **260/260**. A propriedade que o comentário de L340-L350 declara essencial ("O EXECUTOR ENTREGUE A CALLBACK E UM OBJETO DISTINTO DE `this`") é protegida apenas no caminho de `criarPrismaComTransacao` — lá o mutante morre. O dublê da integração pode regredir em silêncio, e é o mesmo formato do achado #5 da rodada 1, que a correção aceitou consertar para a ordenação | Uma asserção de uma linha na suíte de integração, ou o mesmo `origemDoExecutor` aplicado sobre um dos endpoints, fecha os dois caminhos |
| 5 | suggestion | `services/backend/tests/fakes/prisma-double.ts` | L311-L332 | ordem de dublê não observável | Inverter a ordem do `species.delete` (avaliar o gancho `P2003` antes do `P2025`) mantém **260/260**, apesar de o comentário de L316-L320 declarar que a inversão faria "um id inexistente marcado no gancho responder `409` em vez de `404`". A afirmação está certa e não tem teste | Um caso que marque com `simularVinculoDeAnimalNoBanco` um UUID inexistente e espere `404` |
| 6 | minor | `services/backend/src/domains/auth/services/register-user.service.ts` L114/L116; `resend-confirmation.service.ts` L53; `confirm-email.service.ts` L59/L68; `refresh-session.service.ts` L130 | — | regra de atomicidade sem teste (FEATURE-002) | Os **quatro** services de autenticação têm o mutante equivalente ao da RN-09 **sobrevivendo**: trocar `withTransaction(tx)` por `withTransaction(this.prisma)` mantém 260/260 nos quatro. Não é regressão desta task — antes do novo dublê o mutante era literalmente indetectável (`tx === cliente`); a mudança de `prisma-double.ts` foi o que tornou a regra **observável** pela primeira vez, sem que ninguém ainda a observe. `register-user` grava usuário e token na mesma transação e `refresh-session` faz compare-and-swap: nos dois, a atomicidade só aparente é um defeito de dados, não de estilo | Fora do escopo desta task. Abrir tarefa de regressão da FEATURE-002 aplicando `executorDaTransacaoDe(cliente)` nos quatro specs, no molde de `delete-species.service.spec.ts` L289-L324 |
| 7 | minor | `services/backend/prisma/migrations/20260826124117_create_species/migration.sql` (produção) | L3-L4 | portabilidade | Nenhuma das duas colunas `VARCHAR(60)` declara `COLLATE`, então a ordem da RN-11 é **propriedade do ambiente** e não do schema: o mesmo código devolve `Ágil, Cão, Cavalo` no Supabase atual (ICU) e `Cavalo, Cão, ..., Ágil` em um Postgres provisionado com libc `C`. Fora do escopo desta task (é migração de produção), mas é a causa-raiz do achado #1: enquanto a collation não for declarada, qualquer dublê está reproduzindo uma escolha de infraestrutura em vez de uma regra | Nova task: declarar `COLLATE` explícito em `name_normalized` (e reavaliar `name`), fixando a ordem no schema. Enquanto isso, o dublê deve reproduzir o que o ambiente em uso faz — ver #1 |
| 8 | suggestion | `services/backend/tests/fakes/fake-species-usage-counter.ts` L64-L69; `tests/fakes/in-memory-species.repository.ts` L322-L325 | — | precisão de comentário | Os dois comentários dizem que sem o parâmetro `_executor` declarado "o spy só conseguiria contar chamadas". Verificado: remover o parâmetro **não** enfraquece o teste em silêncio — ele para de COMPILAR (`mock.calls[0]` vira tupla vazia e o `?.[0]` é erro de tipo; a suíte falha em "Test suite failed to run"). A garantia é melhor do que a descrita | Ajustar o texto: o parâmetro é o que dá tipo ao argumento registrado, e sua remoção é erro de compilação, não perda silenciosa |
| 9 | suggestion | este arquivo | — | rastreabilidade | O achado #7 da rodada 1 pedia **registrar na task** a exceção dos títulos que começam por `RN-xx`/`CA-15` em vez de `CT-NN`. O relato justificou a não-adoção, mas o arquivo da task continua sem o registro — e o critério de aceite correspondente segue marcado sem ressalva | Fica registrado por esta rodada (ver Pass 1); nada mais a fazer |

#### Verificações pedidas explicitamente — respostas

1. **Reteste de mutação dos 6 pontos**: feito do zero, sem confiar no relato. **Todos os 11 mutantes morreram**, incluindo os dois do major. `this.usage.withTransaction(tx)` → `withTransaction(this.prisma)` reprova o teste da RN-09 com diagnóstico nomeado, exatamente como exigido. O achado #4 foi corrigido com folga: as **cinco** guardas do domínio morrem, não só as três nomeadas.
2. **Mutantes sobreviventes novos**: sim — achados **#2** (as duas datas da representação pública são intercambiáveis), **#3** (metade da faixa de invisíveis), **#4** e **#5** (duas propriedades que os comentários do dublê declaram essenciais e nenhum teste observa) e **#6** (os quatro services de auth). Nenhum deles foi **causado** pela correção: a mudança do dublê compartilhado não enfraqueceu nenhuma asserção existente — os 11 mutantes de controle da rodada 1 continuam morrendo, e o único mutante que a mudança introduziu no próprio dublê (#4) é uma propriedade nova, não uma garantia perdida.
3. **FEATURE-002**: **138 testes verdes e não enfraquecidos**, com o motivo verificado no código e não presumido (nenhum dos quatro services toca `tx` fora de `withTransaction`, e os dublês de repositório devolvem `this`, logo a troca de identidade é inerte). Os quatro services abrem transação e os quatro têm o mutante de atomicidade sobrevivendo — situação **anterior** a esta task, agora observável: achado #6.
4. **`jest.config.ts` e `tests/setup.ts` intocados**: **confirmado**, `git diff` vazio nos dois, e também em `tsconfig.test.json`, `package.json` e em todo `src/`. O único arquivo alterado da task continua sendo `tests/fakes/prisma-double.ts` (+185/−2).
5. **Collation**: **refutada a premissa binária** — ver seção C e achados #1 e #7. Amplitude, como pedido: alcança a **TASK-FRONTEND-009** (L44 manda comparar binariamente "exatamente o critério do `ORDER BY` do servidor" — a afirmação é falsa) e a **TASK-FRONTEND-010**; alcança a **FEATURE-002 do módulo**, cuja listagem administrativa é alfabética sobre a mesma coluna normalizada; e alcança a **FEATURE-003 (vitrine)** no ponto em que ela ordena texto — a **RN-30 / CT-51**, que ordena as cidades do filtro "pela sigla do estado e, dentro dela, pelo nome da cidade", com nomes acentuados ("São Paulo") sujeitos à mesma divergência. A ordenação principal da vitrine (RN-14, `createdAt` decrescente com desempate por id) e o cálculo de idade **não** são afetados: nenhum dos dois compara texto. A RN-23 (busca insensível a acento por coluna normalizada) também não é afetada — ela trata de **igualdade**, não de ordem, e a decisão de não depender da collation lá continua correta.

**Invariantes**: nenhum `any`, `@ts-ignore`, `@ts-expect-error` ou `as unknown as` nos oito arquivos (as três ocorrências da palavra "any" são comentários explicando como ela foi evitada). Nenhum `new Date()` nos testes — a única citação é um comentário. Os dois dublês novos de `tests/fakes/` continuam **sem nenhum caractere acentuado**, conforme a convenção do diretório; os blocos novos de `prisma-double.ts` também. `~/utils/clock` continua desnecessário: as datas vêm dos defaults do schema.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: 9 de 10 critérios de aceite atendidos. O critério "o título começa pelo identificador `CT-NN`" segue **parcialmente atendido** — cerca de 20 títulos começam por `RN-xx`, `CA-15` ou prosa, para cenários que não têm CT correspondente na spec. **A exceção fica registrada aqui, por esta rodada**, encerrando o achado #7 da rodada 1 (achado #9 desta). Todos os itens obrigatórios da seção *Implementation* continuam entregues, e a instrução literal da seção sobre `localeCompare` desligado é justamente a que o achado #1 mostra estar errada — a task, e não só o código, precisa ser corrigida nesse ponto. Achados: #1, #9.

**Pass 2 — Diff Analysis**: nenhum achado. Escopo exato: 7 arquivos criados e 1 alterado, os mesmos da tabela *Files*. `src/` intocado (Scope — Out respeitado), `jest.config.ts`, `tests/setup.ts`, `tsconfig.test.json` e `package.json` sem diff. Nenhuma dependência nova.

**Pass 3 — Code Practices**: nenhum achado bloqueante. `origemDoExecutor` (`delete-species.service.spec.ts` L62-L72) é boa prática e não desvio: função nomeada fora do corpo do teste, três `return` e um nível de indentação, tipada com `unknown` e não `any`, e é ela que converte um mutante morto em diagnóstico legível. `executorDaTransacaoDe` falha alto com mensagem acionável em vez de devolver `undefined`. O `WeakMap` em vez de propriedade no mock preserva o tipo que os services recebem — decisão correta e bem justificada. Linguagem ubíqua conforme. Achado cosmético: #8.

**Pass 4 — Testing Review**: AAA presente nos 11 testes novos; estado reiniciado por `beforeEach`; independência de ordem reconfirmada com `--randomize` 3× (260/260 nas três). O contador passou a ser reiniciado no `beforeEach` da própria suíte de integração (L142-L147), fechando o achado #9 da rodada 1, e o `[SOBRE DUBLÊ]` foi aplicado ao teste da RN-07 (`rename-species.service.spec.ts` L155), fechando o #11. O cabeçalho de `species-routes.spec.ts` (L81-L86) registra CT-21 e CT-23 como exclusão deliberada, fechando o #6. Os quatro laços `for` permanecem (achado #8 da rodada 1, não adotado com justificativa). Achados: #2, #3, #4, #5.

**Pass 5 — Security Review**: nenhum achado. Nenhuma dependência nova (A06); nenhum segredo em código de teste — `tests/setup.ts` continua apontando o `dotenv` para arquivo inexistente e a `DATABASE_URL` para `127.0.0.1:1`, e `services/backend/.env` está coberto pelo `.gitignore` e não rastreado. Nenhum PII em asserção ou log. A suíte continua reforçando o A01 com as 8 asserções de `401`/`403` sobre os quatro endpoints e a asserção de não vazamento de `nameNormalized`. A consulta de collation feita nesta revisão foi somente-leitura, com a única escrita revertida por `ROLLBACK` e `species` conferida em 0 linhas antes e depois.

**Pass 6 — Bug Detection**: nenhum defeito funcional novo nos dublês. `new DubleDePrisma()` por transação é seguro porque a classe não tem estado próprio — todas as linhas vivem nos armazéns de módulo, então o executor lê e escreve exatamente as mesmas linhas e só a identidade muda; o rollback continua correto porque `executarComRollback` opera sobre `ARMAZENS`, e não sobre a instância. `ESPECIES_COM_VINCULO_NO_BANCO` é zerado em `reiniciarPrismaDouble`, sem vazamento entre testes. O `WeakMap` não retém os mocks além do tempo de vida do cliente. Sem `catch` vazio, sem coerção insegura, sem vazamento de recurso. O defeito real desta rodada não é de execução e sim de **fidelidade**: o achado #1.

**Pass 7 — Project Patterns**: nenhum achado bloqueante. Estrutura, nomenclatura, alias `~/` para produção e caminho relativo para `tests/`, `Restauravel` e o padrão de dublê no nível dos delegates — tudo conforme ao precedente. Achados: #7 (migração sem `COLLATE`, produção, fora do escopo desta task), #8.

#### Veredicto

> **NECESSITA CORREÇÕES** — 1 major, 3 minor, 4 suggestion, 1 encerrado nesta rodada.
>
> **O major da rodada 1 está resolvido e verificado**: a RN-09 deixou de ser uma regra anunciada e passou a ser uma regra observada, e a correção do achado #4 foi além do pedido. Os cinco minor morreram sob mutação. Nada foi enfraquecido: os 138 testes da FEATURE-002 seguem verdes e o dublê compartilhado não custou nenhuma asserção.
>
> O bloqueio novo é **um só**, e nasceu da resposta à pendência que esta rodada tinha de decidir: **achado #1**, em `services/backend/tests/fakes/in-memory-species.repository.ts:165` e `services/backend/tests/integration/species-routes.spec.ts:399`. A premissa binária foi medida contra o banco e **refutada** — o `ORDER BY name_normalized` devolve `Ágil, Cão, Cavalo, Gato, Zebra`, e o teste que a correção acrescentou fixa `['Zebra', 'Ágil']`. O caso discriminante era exatamente o que a rodada 1 pediu para adicionar **só depois** de confirmar a collation; adicionado antes, ele agora prende por escrito a ordem errada. A correção é de seis linhas em dois arquivos (`localeCompare('pt-BR')`, a expectativa invertida e os dois comentários reescritos), mas precisa vir acompanhada da correção da instrução na própria seção *Implementation* desta task e de follow-up para a TASK-FRONTEND-009 e a TASK-FRONTEND-010, escritas sobre a mesma premissa.
>
> Recomendados no mesmo passe, por serem de uma linha cada: **#2** (semear `createdAt` e `updatedAt` distintos — hoje os dois campos da representação pública são intercambiáveis) e **#3** (os quatro code points da faixa de invisíveis que nenhum caso alcança).
>
> Fora da task, mas registrados por afetarem o módulo inteiro: **#7** (a migração de `species` não declara `COLLATE`, e é essa omissão que torna a ordem uma propriedade do ambiente) e **#6** (os quatro services de autenticação têm o mesmo mutante da RN-09 sobrevivendo — situação anterior a esta task, que só agora é observável, graças precisamente ao dublê que ela entregou).

---

### Rodada de Revisão 3 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 8 da task (7 criados + 1 alterado), mais os 13 arquivos de produção de `src/domains/species/`, os 4 services de autenticação que abrem transação, a migração de `species`, as tasks 009, 010 e 011 da feature e o banco Supabase de desenvolvimento

#### Resumo

O bloqueio da rodada 2 está resolvido e a resolução foi **reverificada por medição independente**, não aceita por relato: o banco foi consultado de novo nesta rodada, a ordem `Ágil < Zebra` se confirmou, e a expectativa que o CT-13 agora fixa é exatamente a do `ORDER BY name_normalized`. Os cinco pontos que a correção alega ter fechado morrem sob mutação, cada um pelo teste que o nomeia. Nada foi enfraquecido: os 14 mutantes de controle das rodadas 1 e 2 continuam morrendo e os 138 testes da FEATURE-002 seguem verdes. Restam três mutantes sobreviventes novos, todos de **fidelidade de dublê** e todos de severidade não-bloqueante.

#### Método desta revisão

Nenhum número do relato foi aceito sem reexecução. Toda mutação foi aplicada e revertida programaticamente; ao final `git status` e `git diff --numstat` estão idênticos ao estado inicial (`tests/fakes/prisma-double.ts` +185/−2, os 7 arquivos novos não rastreados, nenhum arquivo de produção tocado).

**A. Remutação dos cinco pontos corrigidos** — todos MORRERAM, e todos pelo teste que os nomeia:

| Mutação aplicada | Resultado | Teste que reprovou |
|---|---|---|
| dublê: `ordenarPorChave` de volta à comparação binária de code units | **MORREU** (1 falha) | `CT-13: o acentuado ordena POR LOCALE...` — diff exibindo `Ágil`/`Zebra` invertidos |
| `species.mapper.ts`: trocar `createdAt` **e** `updatedAt` | **MORREU** (1 falha) | `CT-13: createdAt e updatedAt saem com os VALORES da linha` |
| `species.mapper.ts`: trocar **só** `createdAt` | **MORREU** (1 falha) | idem |
| `species.mapper.ts`: trocar **só** `updatedAt` | **MORREU** (1 falha) | idem |
| `validators`: regex de invisíveis sem `‌-‏` (o encolhimento exato do achado #3 da rodada 2) | **MORREU** (4 falhas) | quatro linhas do `it.each`, uma por code point |
| `validators`: regex sem `­` | **MORREU** (1 falha) | a linha `U+00AD` do `it.each` |
| `validators`: regex sem `‏` | **MORREU** (1 falha) | a linha `U+200F` |
| `validators`: regex sem `﻿` | **MORREU** (1 falha) | a linha `U+FEFF` |
| `validators`: regex que nunca casa | **MORREU** (12 falhas) | — |
| dublê: `$transaction` de `DubleDePrisma` de volta a `executar(this)` | **MORREU** (1 falha) | `RN-09 [SOBRE DUBLÊ]: pelo HTTP, o repositório e o contador rodam no EXECUTOR da transação` |
| dublê: inverter a ordem `P2025`/`P2003` em `species.delete` | **MORREU** (1 falha) | `[SOBRE DUBLÊ] o species.delete avalia a AUSÊNCIA da linha antes do vínculo` |

A tabela de invisíveis virou **exaustiva de verdade**: cada um dos oito code points é individualmente observável, e a mensagem do `it.each` nomeia qual sumiu. O achado #3 pedia dois code points; a correção entregou os oito, com o invisível no meio da palavra (nas extremidades o `trim()` mascararia parte deles).

**B. Reverificação dos 14 mutantes de controle das rodadas 1 e 2** — todos continuam MORRENDO. Nenhuma asserção foi perdida na troca:

`delete: usage.withTransaction(tx)→this.prisma` (2 falhas, agora unitário **e** HTTP) · `delete: species.withTransaction(tx)→this.prisma` (2) · `validators: speciesNameKey(nome).length > 99999` (2) · `create: violaUnicidadeDoNome→instanceof puro` (1) · `rename: violaUnicidadeDoNome→instanceof puro` (2) · `rename: registroAusenteNaEscrita→instanceof puro` (1) · `delete: violaChaveEstrangeira→instanceof puro` (2) · `delete: registroAusenteNaEscrita→instanceof puro` (1) · `criarPrismaComTransacao: voltar a entregar o cliente` (1) · `repository.listAll: orderBy name` (13) · `mapper: expor nameNormalized` (17) · `rename: neutralizar a rede de segurança homonima.id` (1) · `delete: VINCULOS_QUE_JA_BLOQUEIAM >= vira >` (6) · `species-name: trim() removido` (15) · `species-name: toLowerCase() removido` (24) · `dublê: armazém.criar não lança P2002` (1, o CT-12).

Os dois mutantes da RN-09 agora morrem **duas vezes** — o teste unitário e o novo teste HTTP —, o que é ganho direto da correção do minor #8.

**C. Collation — medida de novo, nesta rodada, e não herdada**

A premissa não foi aceita do parecer anterior. Nova consulta ao Supabase de desenvolvimento pela `DIRECT_URL`, com **zero escrita de qualquer espécie** (só catálogo e uma lista `VALUES` literal — nem `INSERT` nem transação; `species` conferida em **0 linhas**):

```
PostgreSQL 17.6 on x86_64-pc-linux-gnu
datcollate = en_US.UTF-8 | datctype = en_US.UTF-8 | datlocprovider = 'i'  (ICU)
species.name            -> collation "default"   (sem COLLATE explicito)
species.name_normalized -> collation "default"   (sem COLLATE explicito)

ORDER BY <default do banco>  -> agil, ágil, cão, cavalo, gato, pássaro, reptil, réptil, zebra
ORDER BY ... COLLATE "C"     -> agil, cavalo, cão, gato, pássaro, reptil, réptil, zebra, ágil
```

E, no runtime da suíte:

```
localeCompare('pt-BR')  -> ágil, águia, cão, cavalo, gato, ñandu, pássaro, reptil, réptil, zebra
ordenacao binaria       -> cavalo, cão, gato, pássaro, reptil, réptil, zebra, ágil, águia, ñandu
```

**A nova expectativa do CT-13 (`['Ágil', 'Zebra']`) bate com a ordem real do banco.** A binária produziria o inverso. Todas as afirmações factuais que a correção escreveu — versão 17.6, provider ICU, `en_US.UTF-8`, ausência de `COLLATE` nas duas colunas, `Ágil, Cão, Cavalo, Gato, Zebra` no banco e `Cavalo, Cão, Gato, Zebra, Ágil` na binária — foram **reconferidas uma a uma e estão corretas**.

**D. Gate** — `npm run typecheck` **exit 0** (três projetos). `npm test` **20 suítes / 270 testes**. `npm run test:cov` **exit 0**, global **99.58 / 95.45 / 100 / 99.58**, os 13 arquivos de `src/domains/species/**` em **100/100/100/100**. `npx jest --randomize` **3× com 270/270**. ESLint e SonarQube não foram usados como evidência.

**E. FEATURE-002** — **138 testes, verdes e não enfraquecidos.** Contagem conferida suíte a suíte com `--verbose`: 270 totais − 132 do domínio species (33 + 15 + 14 + 19 + 51) = **138**, o mesmo número da rodada 2 (species subiu de 122 para 132, +10 testes). A preocupação específica sobre os instantes distintos foi verificada e **não procede**: `INSTANTE_DE_CRIACAO` e `INSTANTE_DE_ATUALIZACAO` vivem em `in-memory-species.repository.ts`, são importados apenas por `species-routes.spec.ts`, e o `montarUsuario` do domínio auth tem os próprios instantes, intocados. Além disso, `tests/fakes/prisma-double.ts` — o **único** arquivo compartilhado alterado — continua em **+185/−2**, exatamente o diff que a rodada 2 revisou: a correção da rodada 3 não encostou nele. `auth-routes.spec.ts`, `jest.config.ts`, `tests/setup.ts`, `tsconfig.test.json`, `package.json` e `package-lock.json` **sem diff**.

**F. Varredura por mutantes sobreviventes novos** — 10 mutações adicionais sobre as áreas que a correção mexeu. Sobreviveram os achados **#1**, **#2** e **#3** abaixo. Dois foram descartados como **equivalentes** e ficam registrados para não voltarem como achado numa próxima leitura:

- `validators`: `nome.length > TAMANHO_MAXIMO_DO_NOME` → `> 99999` mantém 270/270. **Não é lacuna de teste**: `speciesNameKey` é `toLowerCase()`, que em Unicode nunca encurta uma string, então `chave.length >= nome.length` sempre e o segundo operando do `||` subsume o primeiro. O mutante é equivalente por redundância da produção, não por falta de asserção — e o limite continua guardado (`> 60` → `>= 60` morre com 2 falhas, medido na rodada 2).
- `ordenarPorChave`: trocar `'pt-BR'` por `'en-US'`, por `'sv'` ou por nenhuma tag mantém 270/270. Também equivalente: medido no runtime, os quatro produzem ordem idêntica para nomes latinos (`ágil, águia, cão, cavalo, gato, ñandu, pássaro, reptil, réptil, zebra`). Ver o achado #4, que é sobre o **texto** do comentário e não sobre o comportamento.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|---|---|---|---|---|---|
| 1 | minor | `services/backend/tests/fakes/in-memory-species.repository.ts` | L236-L245 (`ArmazemDeEspecies.criar`) | fidelidade de dublê não observável | A correção acrescentou a gravação explícita de `createdAt`/`updatedAt` **iguais** no `criar`, com comentário declarando o porquê ("no INSERT o `@default(now())` e o `@updatedAt` gravam o MESMO instante"). Trocar esse `updatedAt` por `INSTANTE_DE_ATUALIZACAO` mantém **270/270**: nenhum teste olha os instantes da espécie **criada**. O novo caso de valor (`species-routes.spec.ts` L487-L512) assere sobre uma linha **semeada**, não sobre uma criada pelo `POST`. É a mesma família dos achados #4 e #5 da rodada 2 — propriedade que o comentário declara essencial e que nenhum teste observa —, agora em código que a própria correção introduziu | Uma linha no CT-01 do `POST`: `expect(especie(resposta).createdAt).toBe(especie(resposta).updatedAt)`. Fecha o mutante e documenta, na representação pública, o que distingue uma espécie recém-criada de uma já renomeada |
| 2 | suggestion | `services/backend/tests/fakes/in-memory-species.repository.ts` | L276-L285 (`ArmazemDeEspecies.renomear`) | divergência declarada do banco | Fazer `renomear` passar a gravar `updatedAt` mantém **270/270** — nenhum teste observa `updatedAt` depois de um `PATCH`. Com os instantes agora distintos, a divergência ficou **visível**: o `@updatedAt` do Prisma real avança o campo em todo `UPDATE`, e o dublê deliberadamente não avança, de modo que a resposta do `PATCH` na suíte devolve `updatedAt === createdAt` — estado que o banco real nunca produz depois de uma renomeação. A justificativa registrada no comentário (não inventar um relógio que a aplicação não consulta) é sólida e a divergência é honesta; o que falta é o custo dela estar registrado onde o próximo leitor tropece | Acrescentar ao comentário que a consequência é a resposta do `PATCH` divergir do banco em `updatedAt`, e que verificar esse campo exige o relógio de `~/utils/clock`. Não vale abrir o dublê para um relógio só por isso |
| 3 | suggestion | `services/backend/tests/fakes/prisma-double.ts` | L288-L303 (`species.findMany`) | guarda de dublê não observável | Neutralizar a conferência de `orderBy` mantém **270/270**. A guarda **é** carga real — é ela, e não a comparação de nomes, que mata o mutante `orderBy: { name: 'asc' }` com 13 falhas —, mas a sua própria remoção é silenciosa: nenhum teste chama o delegate com uma ordenação diferente. É a terceira ocorrência da família que as rodadas 1 e 2 já trataram duas vezes (achados #4 e #5 da rodada 2), e a correção mostrou que fechá-la custa uma linha | Um caso no molde do que a correção acabou de escrever para a ordem `P2025`/`P2003`: `prisma.species.findMany({ orderBy: { nameNormalized: 'desc' } })` deve rejeitar |
| 4 | suggestion | `services/backend/tests/fakes/in-memory-species.repository.ts` | L158-L188 (comentário de `ordenarPorChave`) | precisão de comentário | O comentário registra a medição corretamente (`datcollate = en_US.UTF-8`) e em seguida afirma que "`localeCompare('pt-BR')` reproduz exatamente essa ordem". A afirmação é **verdadeira e foi verificada**, mas a tag pedida ao comparador (`pt-BR`) não é a locale medida (`en_US`): elas coincidem porque as duas herdam a colação raiz do ICU sem tailoring para o latino acentuado — o que também explica por que trocar a tag não reprova nada | Uma frase dizendo que a tag é indiferente para o alfabeto em uso (medido: `pt-BR`, `en-US`, `sv` e o default do runtime dão a mesma ordem) e que `pt-BR` está ali por ser a língua do produto, não por ser a locale do banco |
| 5 | suggestion | `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/tasks/task_009_frontend_species_page_list_create.md` | L44 | instrução assimétrica | A correção do texto está **factualmente certa** (reconferida contra o banco), mas escreve o comparador como `nome.toLowerCase().localeCompare(outro, 'pt-BR')` — o lado esquerdo em minúsculas e o direito não. Na prática o resultado não muda, porque o índice único sobre `name_normalized` impede duas espécies que difiram só na caixa e a diferença de caixa é terciária no ICU; mas o leitor da task não tem como derivar esse argumento, e um agente de código reproduziria a assimetria literalmente | Escrever `a.toLowerCase().localeCompare(b.toLowerCase(), 'pt-BR')`. É a forma que não pede raciocínio auxiliar para ser lida como correta |
| 6 | minor | `services/backend/src/domains/auth/services/register-user.service.ts` L114; `confirm-email.service.ts` L59 (e o mesmo padrão em `resend-confirmation.service.ts` L53 e `refresh-session.service.ts` L130) | — | regra de atomicidade sem teste (FEATURE-002) | **Carregado da rodada 2 (#6), reconferido e ainda aberto.** Trocar `withTransaction(tx)` por `withTransaction(this.prisma)` mantém 270/270 em `register-user` e em `confirm-email` (nos outros dois a formulação literal não compila, mas a lacuna é a mesma: `executorDaTransacaoDe` só é importado por `delete-species.service.spec.ts` — **nenhum** spec de autenticação assere a identidade do executor). Não é regressão desta task; ao contrário, foi ela que tornou a regra observável pela primeira vez | Fora do escopo. Task de regressão da FEATURE-002 aplicando `executorDaTransacaoDe(cliente)` nos quatro specs, no molde de `delete-species.service.spec.ts` L289-L324 |
| 7 | minor | `services/backend/prisma/migrations/20260826124117_create_species/migration.sql` | L3-L4 | portabilidade | **Carregado da rodada 2 (#7), reconferido e ainda aberto.** As duas colunas seguem sem `COLLATE` — reconfirmado no catálogo nesta rodada (`collation "default"` em `name` e em `name_normalized`). A ordem da RN-11 continua sendo propriedade do ambiente e não do schema. O dublê e o CT-13 hoje reproduzem o ambiente em uso e reprovam se ele mudar, que é o desfecho correto enquanto a omissão existir | Fora do escopo. Task de produção declarando `COLLATE` explícito em `name_normalized` (e reavaliando `name`) |
| 8 | suggestion | `services/backend/tests/fakes/fake-species-usage-counter.ts` | L64-L67 | precisão de comentário | **Carregado da rodada 2 (#8), parcialmente adotado.** O comentário gêmeo em `in-memory-species.repository.ts` foi ajustado; este ainda diz que sem o parâmetro `_executor` "o spy só conseguiria contar chamadas". Verificado de novo: remover o parâmetro é **erro de compilação**, não perda silenciosa — a garantia é melhor do que a descrita | Alinhar o texto ao do outro dublê |

#### Verificações pedidas explicitamente — respostas

1. **Remutação dos pontos corrigidos**: feita do zero, sem confiar no relato. **Os cinco morrem, cada um pelo teste que o nomeia** — ver a tabela A. Reverter `ordenarPorChave` para binária quebra o CT-13 com o diff exibindo `Ágil`/`Zebra` invertidos; trocar qualquer um dos dois instantes no mapper quebra (testei os três mutantes: os dois isolados e o cruzado); encolher a regex quebra na linha exata do code point removido; `executar(this)` quebra o novo teste HTTP; inverter `P2025`/`P2003` quebra o novo teste do delegate.
2. **CT-13 × ordem real do banco**: **confere**, e a medição foi refeita nesta rodada em vez de herdada. O `ORDER BY` sob a colação default devolve `ágil` antes de `zebra`; `COLLATE "C"` devolve o inverso. A expectativa `['Ágil', 'Zebra']` é a do banco.
3. **Mutantes sobreviventes novos**: sim, três — achados **#1** (o `criar` do armazém grava os dois instantes iguais e ninguém observa), **#2** (o `renomear` não avança `updatedAt` e ninguém observa) e **#3** (a conferência de `orderBy` do delegate). Os três são de **fidelidade de dublê**, nenhum é de produção, nenhum bloqueia. Dois outros mutantes foram descartados como equivalentes, com o motivo medido e registrado na seção F. **Nada foi enfraquecido**: os 14 controles das rodadas anteriores continuam morrendo, e dois deles passaram a morrer duas vezes.
4. **FEATURE-002**: **138 testes, verdes e não enfraquecidos** — ver a seção E. A preocupação com os instantes distintos foi verificada no código e não procede: as duas constantes são exclusivas do domínio species e o `prisma-double.ts` compartilhado está byte a byte no mesmo diff que a rodada 2 revisou.
5. **Escopo**: **confirmado por `git diff --numstat`**. Único arquivo rastreado alterado no backend: `tests/fakes/prisma-double.ts` (+185/−2). `jest.config.ts`, `tests/setup.ts`, `tsconfig.test.json`, `package.json` e `package-lock.json` **sem diff**; `src/domains/species/` sem nenhuma modificação — só os quatro `.spec.ts` novos, não rastreados. Nenhuma dependência nova.
6. **Correções de texto nas tasks 005 e 009**: **factualmente corretas**, conferidas afirmação por afirmação contra a medição desta rodada. A seção *Implementation* da 005 deixou de mandar desligar o `localeCompare` e registra a medição como evidência, distinguindo corretamente o que foi **refutado** (a premissa binária) do que **segue sendo premissa** (a ordem como propriedade do ambiente, porque a coluna não declara `COLLATE`). A L44 da 009 deixou de afirmar que a comparação binária é "exatamente o critério do `ORDER BY` do servidor". O diff da 005 não altera mais nada além desse item — nenhum critério de aceite foi silenciosamente afrouxado. Uma única imprecisão nova, de forma e não de fato: o achado **#5**. Varredura de amplitude reconferida: as demais ocorrências de "binária" no módulo são sobre assinatura de imagem (FEATURE-002), assunto sem relação; a `task_010` fala em "posição alfabética" sem afirmar critério e o comparador concreto vive na 009, já corrigida; a FEATURE-003 não fixa critério de comparação em lugar nenhum. **Nada mais a reabrir.**
7. **Independência de ordem**: **confirmada**, `npx jest --randomize` 3× com 270/270. O gancho `ESPECIES_COM_VINCULO_NO_BANCO`, que o novo teste do delegate usa, é zerado em `reiniciarPrismaDouble()` e a suíte de integração o chama no `beforeEach` — sem vazamento entre casos.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **10 de 10** critérios de aceite atendidos. O único que a rodada 2 deixou parcialmente atendido — "o título começa pelo identificador `CT-NN`" — permanece com a mesma exceção (cerca de 20 títulos começam por `RN-xx`, `CA-15` ou prosa, para cenários sem CT correspondente na spec), e essa exceção **já está registrada por escrito** no parecer da rodada 2, que era exatamente o que o achado #7 da rodada 1 pedia. Com o registro feito, o critério deixa de estar marcado sem ressalva e o item está encerrado. Todos os itens obrigatórios da seção *Implementation* continuam entregues, agora **inclusive** o do `localeCompare`, cuja instrução foi ela própria corrigida. Nenhum achado bloqueante.

**Pass 2 — Diff Analysis**: nenhum achado. Escopo exato — 7 arquivos criados e 1 alterado, os mesmos da tabela *Files*. `Scope — Out` respeitado integralmente: `src/domains/species/` sem nenhuma modificação de produção, `jest.config.ts` e `tests/setup.ts` intocados, nenhum banco real subido pela suíte. As duas alterações de arquivo `.md` fora da tabela *Files* (esta task e a `task_009`) são correção de instrução factualmente errada, não expansão de escopo — e foram explicitamente pedidas pelo parecer anterior.

**Pass 3 — Code Practices**: nenhum achado bloqueante. `ligacaoDoExecutor` (`species-routes.spec.ts` L174-L184) segue o mesmo padrão bem resolvido de `origemDoExecutor`: função nomeada fora do corpo do teste, três `return` com um nível de indentação, tipada com `unknown`, e é ela que converte um mutante morto em diagnóstico legível ("cliente global (FORA da transação)"). `codigoDoErroDePrisma` estreita o `unknown` do `catch` por `instanceof` em vez de `as`, e faz a falha dizer o que de fato chegou. A tabela `INVISIVEIS_REMOVIDOS` é constante nomeada com os oito code points um por linha e rótulo legível — o `it.each` nomeia qual membro sumiu, que é o que dá valor ao caso. Linguagem ubíqua conforme: domínio em inglês, dublês em PT-BR como os já existentes. Achados cosméticos: #4, #8.

**Pass 4 — Testing Review**: AAA presente nos testes novos; estado reiniciado por `beforeEach`; independência de ordem reconfirmada 3×. A qualidade subiu de forma mensurável nesta rodada: a asserção do CT-13 de datas passou a comparar a **representação pública inteira por valor** (`toEqual` sobre o objeto completo) em vez do conjunto de chaves, o caso de invisíveis virou tabela exaustiva com o caractere no meio da palavra, e as duas propriedades que os comentários do dublê declaravam essenciais ganharam observador. O único ponto do dublê que fala diretamente com o delegate (`prisma.species.delete`) é deliberado e tem a razão registrada no próprio teste — pelo HTTP a pré-checagem do service produziria o `404` e a ordem interna nunca seria exercitada. Cobertura muito acima do piso. Achados: #1, #2, #3.

**Pass 5 — Security Review**: nenhum achado. Nenhuma dependência nova (A06) — `package.json` e `package-lock.json` sem diff. Nenhum segredo em código de teste: `tests/setup.ts` continua apontando o `dotenv` para arquivo inexistente e a `DATABASE_URL` para `127.0.0.1:1`, de modo que nem um teste que escapasse do dublê alcançaria o Supabase; `services/backend/.env` está no `.gitignore` e não rastreado. Nenhum PII em asserção ou log. A suíte segue reforçando o A01 com as 8 asserções de `401`/`403` sobre os quatro endpoints, o caso de token adulterado, a ordem `authenticate → authorizeRole → validateRequest` e a asserção de não vazamento de `nameNormalized` (que continua matando o mutante correspondente com 17 falhas). A consulta de collation feita nesta revisão foi estritamente somente-leitura: catálogo e uma lista `VALUES` literal, **nenhum `INSERT` e nenhuma transação**, com `species` conferida em 0 linhas.

**Pass 6 — Bug Detection**: nenhum defeito funcional. Lido o conteúdo integral dos oito arquivos e da produção de que dependem. Os instantes distintos não introduzem acoplamento: `criar` sobrescreve os dois explicitamente, `renomear` preserva por spread e `semear` usa os defaults — não há caminho em que um teste veja um instante que não configurou. O gancho `ESPECIES_COM_VINCULO_NO_BANCO` é zerado no `reiniciarPrismaDouble`. Sem `catch` vazio, sem coerção insegura, sem vazamento de recurso, sem estado inconsistente. O que sobra são as três lacunas de **observação** dos achados #1 a #3 — nenhuma delas é erro de execução.

**Pass 7 — Project Patterns**: nenhum achado. Estrutura (`tests/fakes/`, `tests/integration/`, spec co-locado em `src/` para regra de domínio), kebab-case, alias `~/` para produção e caminho relativo para `tests/`, `Restauravel` implementado pelo armazém novo, dublê no nível dos delegates. Invariantes reconferidos: **zero** ocorrências de `any`, `@ts-ignore`, `@ts-expect-error` ou `as unknown as` nos oito arquivos (as três citações da palavra "any" são comentários explicando como ela foi evitada); **zero** `new Date()` em código (as três citações são comentários); os dois dublês novos de `tests/fakes/` continuam **sem nenhum caractere acentuado**, conforme a convenção do diretório.

#### Pendências que a TASK-FRONTEND-011 e o Quality Gate herdam

Nada aqui bloqueia esta task; são itens que precisam de dono para não se perderem.

1. **Para a TASK-FRONTEND-011 — o caso discriminante de ordenação é obrigatório.** A task diz hoje, na L74, apenas "CT-13 e CT-14: ordem dos nomes no DOM", sem fixar critério e sem exigir nome acentuado. Com nomes ASCII a comparação binária e a por locale **coincidem**, e foi exatamente essa coincidência que deixou a premissa errada sobreviver duas rodadas de revisão aqui. O `adicionar`/`substituir` da TASK-FRONTEND-009 precisa de pelo menos um caso com par acentuado (`"Ágil"`/`"Zebra"`, ou `"Cão"`/`"Cavalo"`) assertando a posição de inserção; sem ele, o hook pode regredir para binária em silêncio e a posição da espécie recém-criada divergirá do servidor no recarregamento seguinte (RN-11 / CA-04).
2. **Para a TASK-FRONTEND-011 — a assimetria do achado #5.** Se a implementação da 009 seguir a L44 literalmente, o comparador ficará com um lado em minúsculas e o outro não. É inócuo, mas o teste deve asserir a ordem observável e não a expressão, para não fixar a assimetria.
3. **Para a TASK-FRONTEND-011 — CT-21 e CT-23.** Declarados fora do backend no cabeçalho de `species-routes.spec.ts`; são exclusivamente de tela e precisam aparecer na suíte do frontend.
4. **Para o Quality Gate — duas tasks a abrir**, ambas fora do escopo desta e nenhuma delas bloqueando o fechamento da feature: a regressão de atomicidade da FEATURE-002 (achado #6) e a declaração de `COLLATE` na migração de `species` (achado #7). A segunda é a causa-raiz do que custou duas rodadas aqui: enquanto a colação não estiver no schema, a ordem continua sendo propriedade do ambiente, e quem avisa se o ambiente mudar é o CT-13 desta suíte.
5. **Para o Quality Gate — o gate real.** Medido nesta rodada e **verde**: `npm run typecheck` exit 0, `npm test` 20 suítes / 270 testes, `npm run test:cov` exit 0 com 99.58 / 95.45 / 100 / 99.58 e species em 100/100/100/100. ESLint e SonarQube não foram usados como evidência em nenhuma das três rodadas.

#### Veredicto

> **APROVADO** — 0 critical, 0 major. 3 minor e 5 suggestion, nenhum bloqueante.
>
> O major da rodada 2 está resolvido pelo motivo certo: a correção não escolheu um critério, ela **seguiu a medição**, e a medição foi refeita nesta rodada de forma independente e bateu. Reverter `ordenarPorChave` para binária agora reprova o CT-13, e o teste que fixa a ordem é o mesmo que reprovará se o ambiente mudar — a divergência virou decisão explícita em vez de efeito colateral silencioso. Os quatro minor da rodada 2 morreram, dois deles com folga: a tabela de invisíveis passou de dois code points pedidos a oito individualmente observáveis, e a RN-09 passou a ser verificada também pelo HTTP.
>
> A correção do texto acompanhou a do código — a seção *Implementation* desta task deixou de mandar o oposto do certo, e a afirmação falsa da TASK-FRONTEND-009 foi corrigida. É o que impedia o erro de renascer na próxima task escrita sobre ele.
>
> Os três achados novos são todos da mesma família e todos de dublê: uma propriedade que um comentário declara essencial e nenhum teste observa. Nenhum deles é regressão, nenhum custa mais que uma linha, e nenhum justifica uma quarta rodada. Ficam registrados para serem fechados quando alguém voltar a esses arquivos — ou nunca, se a decisão for consciente.
