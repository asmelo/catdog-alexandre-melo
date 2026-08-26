# Handoff — Implementação MODULE-002 (catálogo de pets)

**Início**: 2026-08-26
**Orquestrador**: sessão Claude Code (main)
**Escopo**: 40 tasks em 3 features, execução estritamente sequencial.

## Ambiente

- Node: `nvm use 20` obrigatório (default da máquina é v23.10.0; v20.20.2 instalado).
- Gates por task: `npm test` + `npm run typecheck` no serviço afetado, cobertura mínima 80%.

## Ordem das features

1. `feature_001_cadastro_especies` — 11 tasks
2. `feature_002_cadastro_animais` — 18 tasks
3. `feature_003_vitrine_loja_cliente` — 11 tasks

## Progresso

### FEATURE-001 — Cadastro de espécies

| Task | Status | Testes | Commit |
|---|---|---|---|
| 001 backend species model/migration | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 15 suítes / 138 testes | `a605360` |
| 002 backend species list/create | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 15 suítes / 138 testes | `a410112` |
| 003 backend species rename | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; 15 suítes / 138 testes | `ba5ae3c` |
| 004 backend species delete + guarda de uso | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 15 suítes / 138 testes | `1207ece` |
| 005 backend suíte de testes | **concluída** — 3 rodadas de revisão (2 reprovações), aprovada na 3ª | typecheck exit 0; **20 suítes / 270 testes**; cobertura **99.58 / 95.45 / 100 / 99.58**, domínio species em 100/100/100/100 | `76ea63d` |
| 006 frontend primitivas de UI | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; 12 suítes / 160 testes (baseline do frontend, intacta) | `148aa31` |
| 007 frontend sidebar e rotas admin | **concluída** — aprovada na rodada 1; correção visual + rodada 2 | typecheck exit 0; 12 suítes / 160 testes | ver `git log` |

**TASK-BACKEND-001** — entregou `schema.prisma` (modelo `Species`), migration `20260826124117_create_species`,
`species.messages.ts`, `errors/species.errors.ts` e `species-name.ts`. Migration aplicada no Supabase de dev;
`users`/`refresh_tokens`/`email_confirmation_tokens` preservados (2 / 8 / 1). Achados minor da revisão foram
transferidos para a TASK-BACKEND-002 (limite de 60 chars após `toLowerCase()`; `U+200B` não coberto por `\s+`).

## Decisões fora da spec

- **TASK-BACKEND-001** — catálogo de mensagens exporta `MESSAGES` (e não `SPECIES_MESSAGES`), espelhando `auth.messages.ts`. A task não nomeia o export.
- **TASK-BACKEND-001** — os comentários `///` do modelo `Species` no `schema.prisma` saíram acentuados (bloco literal da spec), enquanto o resto do arquivo usa PT-BR sem diacrítico.
- **TASK-BACKEND-001** — contradição interna do contrato resolvida a favor da seção `## Implementation`: o critério de aceite proíbe duplicar texto de `auth.messages.ts`, mas a seção de implementação lista `NAME_REQUIRED` e `FIELD_NOT_ALLOWED` como obrigatórias, e as duas repetem texto do auth. Implementado como a seção de implementação manda; fica como dois pontos de manutenção para o mesmo texto.
- **TASK-BACKEND-001** — o `@@index([nameNormalized])` foi removido conforme a linha 58 da task (redundante com o `@unique` em Postgres). O primeiro agente havia mantido o índice; corrigido por agente de correção, com rollback pontual da migration no banco de dev (só a tabela `species`, que estava vazia).

**TASK-BACKEND-002** — entregou mapper, repositório, validadores, `list`/`create` services, controller, rotas e
o registro de `/species` em `src/routes/index.ts`. Quatro desvios declarados, os quatro aceitos na revisão:
`.passthrough()` + `superRefine` no lugar de `.strict()` (é o padrão real do `auth.validators.ts`, e o `.strict()`
produziria `field: ""`, quebrando o CT-33); higienização de caracteres invisíveis no validador; medição de
`speciesNameKey(nome)` contra o limite de 60; `withTransaction` sem consumidor (exigido pela própria task).

**TASK-BACKEND-003** — entregou `PATCH /api/species/:id` (validadores, `rename` no repositório, `rename-species.service.ts`,
controller e rota). **Reprovada na rodada 1**: ao extrair a fábrica `objetoSemCamposExtras`, o agente usou `chave in forma`,
que consulta a cadeia de protótipos — `toString`, `constructor`, `valueOf`, `hasOwnProperty` e `isPrototypeOf` passavam pela
guarda de chave extra, quebrando a RN-13 desta task e **regredindo o CT-33 já aprovado na 002**. Corrigido para
`Object.hasOwn(forma, chave)` e reconferido por execução nos dois schemas. Rodada 2 aprovou.

**TASK-BACKEND-004** — entregou `DELETE /api/species/:id` com guarda de uso em duas camadas. A contagem de vínculo
mora numa porta própria, `repositories/species-usage-counter.ts`, que **hoje devolve 0 sem emitir consulta** porque a
entidade `Animal` ainda não existe. Ordem dentro da transação: `findById` (404) → `countAnimalsBySpecies` (409) →
`deleteById` como última operação, com `catch` traduzindo `P2003` → `SpeciesInUseError` e `P2025` → `SpeciesNotFoundError`.

## A dívida que a TASK-010 da feature de animais tem que quitar

Está contraída e documentada em `services/backend/src/domains/species/repositories/species-usage-counter.ts`.
São **quatro** edições, todas contidas nesse arquivo (a lista saiu com três na primeira versão; o quarto item foi
acrescentado depois da revisão, porque sem ele o `noUnusedLocals` derruba o build com `TS6133`):

  a. `constructor(_executor: Prisma.TransactionClient) {}` → `constructor(private readonly db: Prisma.TransactionClient) {}`
  b. `async countAnimalsBySpecies(_speciesId: string)` → `(speciesId: string)`
  c. corpo `return NENHUM_ANIMAL_CADASTRADO;` → `return this.db.animal.count({ where: { speciesId } });`
  d. **remover a constante `NENHUM_ANIMAL_CADASTRADO`**, que fica órfã

Nenhum ponto de instanciação muda. Além disso, a TASK-010 precisa: FK `animals.species_id` declarada com
`onDelete: Restrict` (**nunca `Cascade`**), e a reexecução dos critérios contra a tabela e a constraint reais —
CT-24/25/26/32 na numeração da feature de espécies, **CT-81 a CT-86 na numeração da feature de animais**. São os
mesmos critérios em dois espaços de numeração; não são conjuntos diferentes.

**TASK-BACKEND-005** — suíte de testes do backend da feature. **Reprovada duas vezes.** As revisões usaram
**teste de mutação** em vez de aceitar a cobertura, e as duas acharam coisa real:
- rodada 1: o teste da RN-09 não discriminava nada, porque o dublê de Prisma entregava `tx === cliente` —
  trocar `withTransaction(tx)` por `withTransaction(this.prisma)` na produção deixava 249/249 verdes;
- rodada 2: a **premissa de ordenação binária foi medida contra o banco e refutada** (ver seção abaixo). O teste
  discriminante pedido na rodada 1 tinha entrado antes da medição e prendia a ordem **errada** por escrito.

Aprovada na rodada 3 com todos os mutantes de controle morrendo. Fecha a FEATURE-001 do backend.

## Achado de arquitetura: a ordenação de nomes acentuados é por LOCALE, não binária

Medido contra o banco Supabase de dev na revisão da TASK-BACKEND-005 (rodada 2), pela `DIRECT_URL`:

    PostgreSQL 17.6 | datlocprovider = 'i' (ICU) | datcollate = en_US.UTF-8
    species.name_normalized -> collation "default" (sem COLLATE explícito)
    SELECT name FROM species ORDER BY name_normalized ASC  ->  Ágil, Cão, Cavalo, Gato, Zebra

Comparação **binária** daria `Cavalo, Cão, Gato, Zebra, Ágil`. O banco ordena por locale, e o resultado
coincide com `localeCompare('pt-BR')`. **A premissa binária que circulava nas tasks é falsa.**

Alcance do erro, corrigido ou a corrigir:

- `tests/fakes/in-memory-species.repository.ts` e `tests/integration/species-routes.spec.ts` — o teste chegou a
  prender a ordem **errada** por escrito; corrigido na rodada 3.
- Seção `## Implementation` da própria TASK-BACKEND-005, que mandava desligar o `localeCompare` — corrigida.
- **TASK-FRONTEND-009 desta feature, ~L44**, que afirma ser a comparação binária "exatamente o critério do
  `ORDER BY` do servidor" — corrigida antes de a task ser implementada.
- **FEATURE-003 (vitrine), RN-30 / CT-51** — cidades do filtro ordenadas por nome, com acentos. **Conferir ao
  chegar lá.** A ordenação principal da vitrine (RN-14, `createdAt` desc) e o cálculo de idade **não** são
  afetados: nenhum dos dois compara texto.
- A migration de `species` **não declara `COLLATE`**, então a ordem continua sendo propriedade do ambiente.
  Mudar isso exigiria migration nova; fica registrado, não corrigido.

## Dívida encontrada fora do escopo — registrar em `technical-debt.md` quando a TASK-010 da feature de animais criar o arquivo

- **`src/domains/auth/auth.validators.ts`, fábrica `objetoSemCamposExtras`**: usa `chave in forma`, que consulta a
  cadeia de protótipos. Chaves como `toString`, `constructor`, `valueOf`, `hasOwnProperty` e `isPrototypeOf` passam
  pela guarda de "campo não permitido" no domínio `auth`. Correção é uma palavra (`Object.hasOwn(forma, chave)`),
  mas o domínio `auth` está fora do escopo das tasks do MODULE-002. Descoberto na revisão da TASK-BACKEND-003, que
  encontrou o mesmo furo introduzido em `species` (lá foi corrigido).

- **Os quatro services de `auth` que abrem transação** têm o mesmo mutante da RN-09 sobrevivendo: trocar
  `withTransaction(tx)` por `withTransaction(this.prisma)` não quebra teste nenhum. **Não é regressão** — antes da
  TASK-BACKEND-005 isso era literalmente indetectável, porque o dublê de Prisma entregava `tx === cliente`. Foi essa
  task que tornou a regra observável pela primeira vez, sem que ninguém ainda a observe no domínio `auth`.
- **`__proto__` como chave de corpo** (`{"name":"Gato","__proto__":"x"}`) responde 201/200 em vez de 400: o `superRefine` roda
  sobre a saída do `.passthrough()` e o Zod monta o objeto por atribuição, então `__proto__` some antes do laço. **Não é
  regressão** — o bloco inline da TASK-BACKEND-002 tinha o mesmo desfecho, e a poluição de protótipo foi testada e não ocorre
  (`Object.prototype` permanece limpo). Desvio da letra da RN-13 sem impacto observável. Tratar junto com a dívida do `auth`.

**TASK-FRONTEND-006** — seis primitivas de UI em `services/frontend/src/components/ui/`: `icons.tsx`,
`icon-button.tsx`, `data-list.tsx`, `feedback-states.tsx`, `status-message.tsx`, `confirm-dialog.tsx`.
**Reprovada na rodada 1**: a armadilha de foco do `ConfirmDialog` só funcionava com o foco já dentro do painel —
clicar na sobreposição ou abrir com `isSubmitting` jogava o foco no `<body>`, e aí `Escape` parava de funcionar e
`Tab` alcançava botões atrás do diálogo, apesar do `aria-modal="true"`. O furo tinha três entradas independentes,
todas fechadas. Aprovada na rodada 2.

Divergência de cor aceita: a task pede `brand-orange` no botão de confirmar, medido em **3.72:1** (reprova WCAG AA);
usado `brand-orange-dark` (**4.845:1**), token que já existia. O hover foi para `border-ink`, porque devolver o
laranja claro desfazia a correção.

**TASK-FRONTEND-007** — sidebar administrativa com "Animais" e "Espécies", `/admin` redirecionando para
`/admin/especies`, casca de `species-page.tsx`, e `admin-home-page.tsx` aposentada. Editou também
`app-routes.spec.tsx`, que **não está na tabela de arquivos da task** — a revisão auditou asserção por asserção
e confirmou que nenhum teste perdeu poder (29 `it`, 53 `expect`, antes e depois); quatro asserções que estavam
**vacuamente verdadeiras** tiveram o poder restaurado.

**Contradição interna da task, decidida pelo orquestrador:** a L13 declara a captura de tela fonte da verdade do
layout, mas a L49 descrevia o interior do `<aside>` pressupondo **fundo roxo**. Abri a captura: a barra é **branca**,
com o item ativo numa pílula roxa e o logo sobre branco sem placa. **A captura venceu** — a L13 é mais específica e
mais autoritativa sobre layout. A barra foi realinhada e o texto da task, emendado. Caíram junto a placa branca do
logo e a exceção do anel de foco branco, que só existiam por causa do fundo roxo. Se a barra roxa for a preferência
real do produto, é reversível.

## Achados a repassar para tasks futuras

- **TASK-FRONTEND-011 — não asserte classes de cor.** O par ativo/inativo da sidebar ainda está em movimento
  (ícones, fundo do `<main>`, peso do fio). Um `expect` sobre `bg-brand-purple` transformaria a próxima decisão de
  produto em teste vermelho. Asserte `aria-current` e `href`, que são contrato.
- **TASK-FRONTEND-009 — o fundo do `<main>`** está em `surface-canvas` (`#dde0ea`) enquanto a captura mostra
  `#fafafc`. Mudá-lo obriga a incluir `tailwind.config.js` na tabela de arquivos, porque o token é compartilhado com
  o `ClientLayout`. Decisão da 009.
- **TASK-FRONTEND-009 — a sidebar está sem ícones de propósito**, não por esquecimento: `icons.tsx` só tem
  `PencilIcon` e `TrashIcon`, e a captura mostra pegada e etiqueta. Criar os ícones é task própria sobre a primitiva.
- **Imprecisão conhecida, não corrigida:** o comentário de `admin-layout.tsx` (~L56) diz que `ink` sobre
  `brand-purple` rende `2.78:1`; o valor real é `2.93:1`. O número é pré-existente (vinha do `HEAD`) e foi carregado
  adiante. A conclusão não muda — 2.93:1 também reprova o AA. Corrigir quando alguém abrir o arquivo por motivo próprio.
- **TASK-FRONTEND-011 — o jsdom não reproduz o blur automático de elemento desabilitado.** Um teste que só faça
  `rerender` para `isSubmitting` **passa mesmo com a falha de armadilha de foco presente** — o `blur()` explícito
  precisa estar dentro do mesmo `act()` do rerender. E `fireEvent.keyDown` não move foco nenhum: todo caso de
  tabulação tem que usar `userEvent`, ou a suíte fica verde sem exercitar nada.
- **TASK-FRONTEND-009/010 — o `ConfirmDialog` fica sem nenhuma saída durante `isSubmitting`** (dois botões
  desabilitados, `Escape` ignorado, `preventDefault()` do `Tab` incondicional). É correto para operação transitória,
  mas vira armadilha de teclado real (SC 2.1.2) se a tela **não devolver `isSubmitting` a `false`** em erro ou
  timeout. Garantir isso é responsabilidade de quem consome.
- **TASK-FRONTEND-011 — OBRIGATÓRIO, não é sugestão:** a L74 da task pede só "ordem dos nomes no DOM", sem critério
  e sem nome acentuado. **Com ASCII os dois critérios de ordenação coincidem** — foi exatamente essa coincidência que
  deixou a premissa errada sobreviver duas rodadas de revisão no backend. O teste precisa de par acentuado
  (`"Ágil"` / `"Zebra"`) assertando a posição de inserção do hook da TASK-FRONTEND-009. Sem isso o mesmo erro se
  repete no frontend sem ninguém notar.
- **TASK-FRONTEND-011:** cobrir CT-21 e CT-23, declarados fora do escopo do backend.

- **Para a TASK-BACKEND-003:** o bloco anti-chave-extra de `species.validators.ts` já é a segunda cópia do `objetoSemCamposExtras` do auth. Não faça a terceira — reuse o que existe em species.
- **Para a TASK-BACKEND-005:** acrescentar o modelo `species` ao `tests/fakes/prisma-double.ts`; decidir entre usar ou remover o parâmetro `dependencias?` de `createSpeciesController` (hoje sem chamador — a estratégia real de teste do projeto dubla o módulo `~/infra/prisma/prisma-client`); a corrida do CT-12 e a ordenação dos CT-13/CT-14 estão verificadas só por leitura estática até lá.
- **Para a TASK-BACKEND-002/003 (criação e renomeação):** em Postgres, a violação de índice único aborta a transação inteira (`25P02 current transaction is aborted` no statement seguinte ao `23505`). Se o service capturar o `P2002` **dentro** de uma transação interativa para convertê-lo em `SpeciesNameAlreadyExistsError`, nenhuma consulta posterior roda naquela transação. O `INSERT` precisa ser a última operação da transação, ou o tratamento do conflito fica fora dela. A RN-16 continua garantida pelo banco — muda só a forma de traduzir o erro.

## Divergência entre regra declarada e configuração real

`exactOptionalPropertyTypes` é declarada como regra não negociável do projeto, mas está ligada **apenas no
backend**. `services/frontend/tsconfig.json` tem `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters` e `noFallthroughCasesInSwitch` — **não** tem `exactOptionalPropertyTypes`. Ligá-la agora pode
quebrar o frontend de autenticação já em produção, então não foi ligada no meio do módulo. As tasks de frontend do
MODULE-002 estão sendo escritas para serem seguras sob a flag mesmo assim. **Decisão de ligar (e de arcar com o
ajuste no código existente) fica para o dono do projeto.**

## Duas tasks a abrir, fora do escopo do MODULE-002

1. **Regressão de atomicidade na FEATURE-002 (autenticação)** — os quatro services de auth que abrem transação têm o
   mutante da RN-09 sobrevivendo. O molde pronto é o `executorDaTransacaoDe` do novo `prisma-double.ts`, hoje usado
   só por `species`.
2. **Declarar `COLLATE` explícito na migration de `species`** — é a causa-raiz do achado de ordenação, que custou
   duas rodadas de revisão. Enquanto não for declarado, a ordem da RN-11 é propriedade do ambiente.

## Problemas / pendências

- Três tentativas iniciais da TASK-BACKEND-001 morreram com `API Error: 529 Overloaded` (sobrecarga transitória do servidor). Trabalho parcial revertido a cada queda; a quarta tentativa concluiu. Sem impacto no resultado.
