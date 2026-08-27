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
| 007 frontend sidebar e rotas admin | **concluída** — aprovada na rodada 1; correção visual + rodada 2 | typecheck exit 0; 12 suítes / 160 testes | `c1a17c6` |
| 008 frontend camada de API e validação | **concluída** — aprovada na rodada 1 (2 minor), corrigida, aprovada na rodada 2 | typecheck exit 0; 12 suítes / 160 testes | `c2d2167` |
| 009 frontend tela de espécies (listar/criar) | **concluída** — aprovada na rodada 1 (3 minor), corrigida, aprovada na rodada 2 | typecheck exit 0; 12 suítes / 160 testes | `917398c` |
| 010 frontend edição em linha e exclusão | **concluída** — reprovada na rodada 1 (2 major), aprovada na rodada 2, mais acabamento | typecheck exit 0; 12 suítes / 160 testes | `7d01817` |
| 011 frontend suíte de testes | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; **19 suítes / 306 testes**; cobertura **99.70 / 98.62 / 100 / 99.70** | ver `git log` |

### FEATURE-001 — FECHADA ✅

**11/11 tasks concluídas, revisadas e commitadas.** Totais no fechamento:

| Serviço | Suítes | Testes | Cobertura (stmts / branch / funcs / lines) |
|---|---|---|---|
| backend | 20 | 270 | 99.58 / 95.45 / 100 / 99.58 |
| frontend | 19 | 306 | 99.70 / 98.62 / 100 / 99.70 |
| **total** | **39** | **576** | ambos acima do gate de 80% |

O código de produção da feature está em **100% de branch** nos dois serviços.

**TASK-BACKEND-001** — entregou `schema.prisma` (modelo `Species`), migration `20260826124117_create_species`,
`species.messages.ts`, `errors/species.errors.ts` e `species-name.ts`. Migration aplicada no Supabase de dev;
`users`/`refresh_tokens`/`email_confirmation_tokens` preservados (2 / 8 / 1). Achados minor da revisão foram
transferidos para a TASK-BACKEND-002 (limite de 60 chars após `toLowerCase()`; `U+200B` não coberto por `\s+`).

### FEATURE-002 — Cadastro de animais (em andamento)

| Task | Status | Testes | Commit |
|---|---|---|---|
| 001 backend schema animais/estados/cidades | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 20 suítes / 270 testes | `6e7910f` |
| 002 backend carga de estados e municípios | **concluída** — 3 rodadas (1 reprovação), aprovada na 3ª | typecheck exit 0; 20 suítes / 270 testes; **27 UFs / 5571 municípios** carregados | `a396314` |
| 003 backend multipart, limites e assinatura | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; **21 suítes / 282 testes** | `78359ad` |
| 004 backend porta de armazenamento + Supabase | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; **24 suítes / 314 testes**; `src/infra/storage` em 100% | `0445a29` |
| 005 backend endpoints de estados e cidades | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 24 suítes / 314 testes | `4e799d3` |
| 006 backend leitura de animais, paginação e idade | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; 24 suítes / 314 testes | `febeb92` |
| 007 backend criação de animal com upload | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 24 suítes / 314 testes | ver `git log` |

**F2/TASK-BACKEND-001** — enums `AnimalSize`/`AnimalSex`/`AnimalStatus` e modelos `State`, `City`, `Animal`,
`AnimalImage`; relação inversa `animals Animal[]` ativada em `Species`. Migration
`20260827133551_animals_states_cities` aplicada no Supabase de dev.

**As duas FKs críticas foram conferidas no catálogo do Postgres, não no arquivo de migration:**
`animals.species_id` é `ON DELETE RESTRICT` (`confdeltype = 'r'`) e `animal_images.animal_id` é `ON DELETE CASCADE`
(`confdeltype = 'c'`). Exercitadas de fato em transação revertida: excluir espécie com animal vinculado falha com
`23503` sem apagar nem orfanar nada; excluir animal com 2 imagens apaga as 2. **A dívida da TASK-BACKEND-010 tem
contra o que rodar.**

Armadilha do RN-05 evitada: `animals.name_normalized` **não** é único (dois animais podem ter o mesmo nome), ao
contrário do de espécies. Nenhum índice único sobre a coluna.

**F2/TASK-BACKEND-002** — carga de 27 UFs e 5571 municípios a partir de recorte versionado (321 KB), sem nenhuma
chamada HTTP. Idempotente: casa por `ibgeCode`, corrige por `update` preservando o `id`, e a segunda execução emite
dois `SELECT` e zero escritas. Validação Zod derruba a carga **antes** de qualquer escrita se o recorte vier
truncado — provado adulterando uma cidade no banco e confirmando que ela continuou adulterada após o abort.

**Dois gatilhos, por causa do gancho ocupado:** `seedGeography` é chamada pelo `prisma/seed.ts`, e existe também um
`npm run db:seed:geography` dedicado, protegido por `require.main`. Sem o segundo, atualizar o recorte municipal
obrigaria a reescrever a conta do administrador junto.

**Bug corrigido:** a falha do seed do admin impedia a geografia de rodar — em CI, `npm run db:seed` deixaria
`states` e `cities` vazias, bloqueando as tasks 005 e 007. As cargas passaram a ser isoladas, sem engolir erro:
cada falha é nomeada em `stderr` e o processo termina com saída diferente de zero.

**Reprovada na rodada 2 — a correção de concorrência era INERTE.** O lote de 25 foi calibrado contra o
`pool_timeout` de 10 s **ignorando o `connection_limit=1` da mesma string de conexão**. Com uma conexão,
concorrência não divide a espera, **multiplica**: medido ~880-930 ms por `update`, então o 25º comando espera ~22 s
contra um teto de 10. Lotes de 25 e de 1.000 quebram no mesmo ponto — verificado por experimento independente com
`pg_sleep` (25 concorrentes → 6 sucessos; 200 concorrentes → 6 sucessos; em série → 25 de 25). **Resolvido
serializando** (`for … await`). Custa ~1 s por município renomeado e conclui inteiro, em vez de abortar na metade.

**F2/TASK-BACKEND-003** — leitura de `multipart/form-data` restrita às rotas de animal, limites de corpo, os status
413/415, e apuração de formato **por assinatura binária**. `src/app.ts` **intocado**: o middleware é exportado mas
não montado — quem monta são as tasks 007/008. `express.json({ limit: '10kb' })` continua o único leitor global.

Matriz de segurança verificada com arquivos construídos: JPEG real com nome `.txt` e `Content-Type: text/plain` é
**aceito**; SVG com `<script>` renomeado para `.jpg` e declarado `image/jpeg` dá **`null`**. Idem GIF, PDF, ELF,
ZIP, WEBP, TIFF, BMP, GZIP, JPEG truncado e arquivo de 0 byte. **SVG não entrou em lista nenhuma** — é o caso que a
regra existe para barrar, porque servido de balde público executaria script no navegador de quem abrisse a imagem.

**Reprovada na rodada 1:** a tradução só interceptava `MulterError`, mas **todo o busboy sinaliza falha de leitura
com `Error` cru** — corpo sem `boundary`, truncado ou com cabeçalho de parte malformado viravam **500**. Corrigido
traduzindo por origem. A rodada 2 construiu **23 vetores novos** de corpo malformado por outros ângulos: nenhum
produz 500, nenhum emite log.

Achado próprio do agente, não óbvio: o busboy corta quando o contador **atinge** o limite
(`if (fileSize === fileSizeLimit)`), então configurar 5 MB cru **recusava um arquivo de exatamente 5 MB**, que a
spec manda aceitar. Daí o `+ 1` no limite.

**Dependência com vulnerabilidade conhecida:** `file-type@16.5.4` carrega o GHSA-5v7r-6r5c-r473 (laço infinito no
parser de ASF). A revisão construiu o ASF malformado e confirmou que **no cru o parser trava para sempre**. A
mitigação é um pré-filtro pelas assinaturas de JPEG/PNG que torna o parser inalcançável — verificado nos dois
sentidos: não alarga nem estreita a entrada. O bloqueio para subir de versão é **exclusivamente ESM** (a 21.3.1+ já
está corrigida e aceita Node 20); a saída definitiva é o backend migrar para ESM, não subir de versão.
`npm audit` segue reportando 1 moderate.

**F2/TASK-BACKEND-004** — `ImageStoragePort`, adaptador do Supabase Storage, gerador de caminho de objeto e duplo
em memória. `src/infra/storage` em **100%** nas quatro métricas. Nenhum teste abre socket — verificado derrubando
`net.Socket.prototype.connect`, `tls.connect` e `dns.lookup`: 27/27 passam.

**A dependência que a task prescrevia derrubaria o boot.** `@supabase/supabase-js@2.109` monta um `RealtimeClient`
que exige WebSocket nativo (Node 22+), contra o `engines: >=20 <21` deste serviço. Reproduzido de forma
independente pelas duas pontas. **Agravante:** o pacote declara `engines: node >=20.0.0`, então o `npm install`
**não avisa nada** — a queda só aparece no primeiro import. Trocado por `@supabase/storage-js`, mesmo monorepo,
mesmo `engines`, sem arrastar o `realtime-js`. **O texto da task foi emendado.**

Erro do fornecedor não vaza para o service: construtor sem parâmetro, e teste assertando que `message` e `code` não
contêm "Bucket not found", "404" nem "Storage".

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

**TASK-FRONTEND-008** — `services/api/species-api.ts` (as quatro funções sobre `request`), validação de formulário
em `utils/validation.ts` e o bloco `SPECIES` em `utils/messages.ts`. Removeu de passagem o `MESSAGES.ADMIN_HOME`
órfão, que a TASK-FRONTEND-007 tinha deixado ao aposentar a página de painel — **pendência da 007 encerrada aqui**.

`listSpecies` devolve o envelope `{ items }` **inteiro**, não o array: desembrulhar casaria o formato do `GET` com o
do `POST` por conveniência e obrigaria a mudar todos os chamadores quando o envelope ganhar o primeiro metadado,
que é a razão declarada de ele existir. A 009 já esperava isso.

**Corrigido na rodada 2 — divergência não declarada, na direção ruim:** a validação local não higienizava
caracteres invisíveis antes de normalizar, então **recusava no cliente nomes que o servidor aceita**. O caso pior:
`\s` do JavaScript **casa** `U+FEFF`, então a normalização o convertia em espaço em vez de removê-lo, e um nome de
60 caracteres era medido como 90. Replicado o arranjo de duas camadas do backend (`higienizar` → `normalizar`).
A revisão refez a comparação por exaustão — **709.483 entradas**, incluindo varredura completa do BMP — e achou
**uma única divergência**, a declarada e deliberada: a medição de `speciesNameKey` (caso `U+0130`), que corre na
direção segura (servidor mais estrito, mesma mensagem de volta, custo de uma viagem de rede).

**TASK-FRONTEND-009** — `use-species-collection.ts`, `species-create-form.tsx`, `species-row.tsx` e a tela em
`species-page.tsx`. **Corrigida uma corrida real**, achada pela revisão lendo o código: `recarregar` não sequenciava
a requisição em voo, então um `POST` que concluísse durante um `GET` pendente era apagado pela resposta atrasada —
a espécie sumia da lista com "criada com sucesso" ainda na tela.

A revisão sugeriu número de sequência; o agente de correção **contestou e estava certo**, e o revisor se retratou
depois de reproduzir os dois lados: quem envelhece a resposta não é uma listagem mais nova, é a **escrita** do meio
do voo — a listagem continua sendo a mais recente e passa pelo teste de identidade. A solução tem duas peças:
número de sequência (cobre listagem × listagem, que a 010 pode abrir) **mais** reaplicação das escritas locais
ocorridas depois da partida da listagem em voo. Reaplicar, e não descartar a resposta obsoleta, porque descartar
salvaria a espécie criada mas jogaria fora as outras que a listagem trouxe.

**TASK-FRONTEND-011** — suíte de testes do frontend: 7 specs novos e 2 ampliados, sem alterar nenhum arquivo de
produção. Levou a suíte de 12/160 para 19/306 e **zerou os 5 avisos de `act()`**.

Diagnóstico dos avisos, que três hipóteses anteriores erraram (**a minha inclusive**): eles sempre foram de
`app-routes.spec.tsx`. Eu medi o arquivo **depois** da correção e obtive zero, e concluí errado que era interação
entre suítes. A causa real: `/admin` passou a renderizar `SpeciesPage`, que dispara `GET /api/species` no mount;
sem dublê a guarda de rede lança, e o `setStatus('erro')` do `.catch` cai fora do `act`. A correção que a revisão
sugeriu (`mockResolvedValue({ items: [] })`) **piorava** — medido: 10 avisos em vez de 5, porque promessa já
resolvida agenda o `.then` e as **duas** atualizações escapam, contra **uma** da rejeição. A solução foi devolver
promessa **pendente**, que nunca agenda continuação.

**Teste de contrato de fonte** implementado em três camadas: comparação textual do literal `CARACTERES_INVISIVEIS`
lido dos **dois** serviços, varredura comportamental do BMP inteiro comparando as regexes code point a code point,
e casos de fronteira. Validado por mutação: acrescentar um code point ao backend derruba os testes, e um deles
**nomeia** o code point divergente.

**TASK-FRONTEND-010** — edição em linha, diálogo de exclusão e a ligação dos dois com o hook. As duas armadilhas
antecipadas pela revisão da 009 foram fechadas na primeira tentativa (nada otimista; foco indo para o `<h1>` em vez
do `<body>` quando a linha que abriu o diálogo desaparece).

**Reprovada na rodada 1** por dois `major` de mesma raiz: `operacaoEmAndamento` era bandeira única para duas
operações independentes, sem checagem de identidade na resolução. Com um `PATCH` em voo, o `409` que chegava depois
pintava o erro **sob o campo de outra linha**, e o diálogo de exclusão abria já sem saída pelo teclado. A revisão
achou pela **assimetria**: a linha já recebia a bandeira estreitada por identidade, o diálogo não.

Corrigido decompondo a bandeira em contador de sessão + duas bandeiras, e separando **efeito de operação**
(aplicado sempre — descartar jogaria fora gravação durável no servidor) de **efeito de sessão** (só se a sessão
ainda for a corrente). A comparação por `id` foi recusada com razão: sair de uma linha e voltar a ela produz
rascunho novo com o mesmo `id`, e a gravação antiga pousaria na sessão errada.

**Acabamento depois da aprovação:** a regra "efeito de operação sempre" é correta entre espécies distintas e
**se inverte entre duas gravações da mesma espécie** — o comentário a apresentava como universal, e foi isso que
escondeu o caso. Resolvido com sequência de **escrita** por espécie (o marcador só avança no sucesso: gravação que
falhou não mudou nada no servidor e não pode barrar o retrato de uma escrita anterior que deu certo).

**F2/TASK-BACKEND-005** — domínio `geography` novo (catálogo, erros, validadores, repositório, dois services,
controller, rotas) e `src/routes/index.ts` com **+2 linhas**. Verificado contra o banco real: `Boa Esperança`
aparece **uma vez em cada** UF (ES/MG/PR) com três `id` distintos; `DF` traz `Brasília`; e a ordem devolvida bate
com `localeCompare('pt-BR')` e **não** com a binária — no PR, `Ângulo` aparece entre `Andirá` e `Antonina`, e a
comparação binária o empurraria para depois do `Z`.

A não-unicidade de nome é inofensiva **por construção**: a única leitura de `cities` é `where: { stateId }`, e
nenhum ponto do código consulta cidade por nome. Ordenação toda no banco, zero `sort()` em memória — um `sort()`
reintroduziria a comparação binária que o banco já evita.

**Sem filtro por texto nesta task**, então a decisão sobre sensibilidade a acento **não foi tomada** e fica pendente
para quem introduzir busca de município. Registro do que importa: o índice é `(stateId, name)` sobre a coluna
**acentuada**, então um `unaccent` futuro **não** o usaria.

**F2/TASK-BACKEND-006** — `GET /api/animals` (paginado) e `GET /api/animals/:id`, com repositório, mapper,
validadores, dois services, controller e rotas, mais `src/utils/age.ts`.

**A armadilha do `nameNormalized` foi respeitada:** zero `normalize(`/`NFD`/`deburr`, zero `sort()`, zero
`localeCompare`, e a coluna só aparece como chave de `orderBy` — nunca em `where`, nunca em `findUnique`. O aviso
está registrado no repositório e no `schema.prisma`.

**A task prescrevia um cálculo de idade ERRADO** — confirmado por execução contra o banco. Ela manda tratar
`birthDate` como data civil no fuso de São Paulo, mas a coluna é `@db.Date` e chega como **meia-noite UTC**:
converter devolveria o dia anterior, e a idade viraria **um ano mais cedo todo 31/12**, passando despercebida nos
outros 364 dias. Implementada a assimetria (`now` por `Intl` no fuso; `birthDate` por `getUTC*`) e **o texto da
task foi emendado**, para que a próxima fatia não "corrija" o código certo para a prescrição errada.

**Reprovada na rodada 1:** `?page=abc` devolvia `"Expected number, received nan"` **em inglês**. O `superRefine`
só roda depois que o tipo base passa, e `Number('abc')` é `NaN` — reprovado antes, tornando o ramo inalcançável.
Corrigido com `invalid_type_error` no tipo base; a mesma linha fechou **quatro caminhos adicionais** em inglês que
a revisão não tinha listado. A rodada 2 varreu ~61 formas de query e 7 de `:id`: nenhum texto em inglês restou.

**Acabamento:** `?page=1e19` respondia **500** — o `skip` estourava o inteiro de 64 bits. Resolvido **saturando o
`skip`**, e não pondo teto em `page`: o teto mudaria a regra declarada de que página além do total responde `200`
com lista vazia, e desenharia a fronteira num detalhe de armazenamento em vez de numa regra de negócio.

Verificações da revisão que valem registro: 500 animais percorridos em 25 páginas por HTTP com **500 ids
distintos**, `EXPLAIN` do plano real, e log do Prisma confirmando `BEGIN → findMany → COUNT → COMMIT` através do
pgbouncer.

**F2/TASK-BACKEND-007** — `POST /api/animals` com upload, o pipeline de imagens, o cálculo de `nameNormalized` e a
primeira montagem do middleware de multipart em rota. `animals.messages.ts` foi de **13 para 22 chaves**, só por
apêndice.

**A exigência de concorrência foi cumprida e medida:** `maximoEmVoo = 5`, 62 ms contra ~302 ms do laço serial. E o
caso que importa foi construído pela revisão — falha da imagem **mais rápida** entre cinco de durações diferentes
(120/200/**20**/260/320 ms): o primeiro `remove` acontece em @322 ms, **depois** dos cinco `fim:`, com **zero
órfãos**. Com `Promise.all` a compensação teria disparado em @21 ms com quatro envios ainda em voo, produzindo
exatamente os órfãos que o CT-55 barra.

**Oito das nove alegações do agente de que a task prescreve algo que não funciona procederam** e viraram emenda no
texto. **Uma NÃO procedeu:** `.min(2).max(60)` produz **um** problema, não dois — mínimo e máximo nunca disparam
juntos sobre o mesmo comprimento. O `superRefine` continua certo por outras razões (precedência de três mensagens e
a segunda medição sobre `toLowerCase().length`, onde `'İ'×60` mede 60 e vira 120). **O comentário foi corrigido e
a task NÃO foi emendada com a afirmação falsa.**

Corrigido também um segundo comentário normativo que afirmava mecanismo inexistente: o repositório dizia que o
`RETURNING` "preserva a ordem dos dados enviados" — comportamento observado do Postgres, não contrato SQL. A ordem
das imagens no `POST` passou a ser garantida por `sort` explícito.

## ⚠️ AÇÃO DO DONO DO PROJETO — o backend não sobe sem credencial de armazenamento

A TASK-004 tornou `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **obrigatórias, sem `.optional()`** — é o que a task
manda, e é deliberado: um backend que sobe sem credencial de armazenamento só falha no primeiro cadastro com foto,
em produção. O boot agora cai com mensagem nomeando as chaves faltantes.

**O que está travado até o provisionamento:** `npm run dev`, `npm run db:seed` e `npm run db:seed:geography`.
**O que NÃO está travado:** a suíte de testes (o `tests/setup.ts` injeta valores de fantasia e nenhum teste abre
socket) e, portanto, o andamento das tasks.

**Falta também criar o balde `animal-images`** com leitura pública e escrita restrita à service role.

Nenhuma chave foi inventada e o `.env` real não foi tocado; o `.env.example` recebeu placeholder.

## Padrão observado: tasks escritas antes do código prescrevem coisas que não sobrevivem ao projeto real

Quatro casos até aqui, todos resolvidos divergindo da task e **emendando o texto dela**, para que a próxima leitura
não reintroduza o erro:

1. `.strict()` do Zod produz `field: ""` (o `unrecognized_keys` sai com `path: []`) — FEATURE-001.
2. `@supabase/supabase-js` derruba o boot no Node 20 e o `npm install` não avisa — F2/TASK-004.
3. `authorizeRole('ADMIN')` **não compila**: `'ADMIN'` é o enum do banco, `'admin'` é o literal público — F2/TASK-005.
4. A cadeia `.length(2).regex(...)` **acumula** e produz `details` com a mesma mensagem duas vezes — ou seja,
   **a seção de implementação reprovaria o critério de aceite do mesmo documento** — F2/TASK-005.

## Achados a repassar para tasks futuras

- **A numeração de RNF é POR FEATURE.** Um agente diagnosticou errado que `species.validators.ts:97` citava a RNF
  errada — na FEATURE-001 a RNF-12 **é** "Idioma — mensagens em PT-BR", e a citação está correta. Na FEATURE-002 a
  equivalente é a RNF-22. Não "unifique" essas citações.
- **F2/TASK-BACKEND-011 — `tests/fakes/prisma-double.ts` não conhece os delegates `animal`, `state` nem `city`.**
  Ou estende o duplo, ou injeta pelas fábricas `createAnimalsController` / `createGeographyController`. **Armadilha
  do segundo caminho:** a fábrica roda no import das rotas, então o duplo precisa ser *function declaration*
  hoisted, não `class` declarada depois do `import { app }`.
- **F2/TASK-BACKEND-011 — o `?page=1e19` NÃO responde mais 500**, então não escreva teste esperando isso.

- **F2/TASK-BACKEND-011 — `tests/fakes/prisma-double.ts` não tem os modelos `state` nem `city`.** Ou estende o
  duplo, ou injeta pelo parâmetro `dependencias?` da fábrica. **Armadilha do segundo caminho (já provada):** a
  fábrica roda no import de `geography.routes.ts`, então o duplo precisa ser criado por *function declaration*
  hoisted, não por `class` declarada depois do `import { app }` — senão cai na zona morta temporal.
- **F2/TASK-BACKEND-011 — `PrismaStateRepository.withTransaction` nasce sem chamador** e ficará descoberto.
- **Verificar "nenhuma linha executável mudou" em arquivo NOVO não funciona com `git show HEAD:`** — o arquivo é
  untracked, o git não tem baseline, e a checagem retorna vazio dando falso positivo. Use cópia reconstruída ou
  compare o JS emitido com `--removeComments`.
- **Emenda pendente na TASK-005**, fora do escopo autorizado da correção: a L91 ainda afirma que `authorizeRole`
  "nunca foi montado por rota alguma" — falso, `species.routes.ts` o monta em quatro pontos.

- **F2/TASK-BACKEND-007 — EXIGÊNCIA DE CONCORRÊNCIA, já emendada no texto da task.** O adaptador tem timeout de
  **20 s por chamada**. Cinco envios **em série somam 100 s — 3,3× acima dos 30 s do RNF-13**. A implementação óbvia
  (laço com `await`) estoura o requisito e **nenhum teste barrava**: o aviso vivia só num comentário do adaptador,
  e o grep na task não achava `paralelo`, `concorrência`, `RNF-13` nem `Promise.all`. Foi acrescentada a exigência
  explícita mais um critério de aceite que exige teste registrando sobreposição das chamadas.
  **Interação que a concorrência cria com o CT-55:** é preciso **aguardar o desfecho de todos** os envios
  disparados antes de compensar — compensar na primeira rejeição deixaria os envios em voo terminarem depois da
  remoção, cada um virando objeto órfão.
- **F2/TASK-BACKEND-007 — emendar a justificativa do teste** em `tests/unit/supabase-image-storage.spec.ts`
  (~L197-207). O nome do teste afirma que estender `TypeError` "impede virar um 415 silencioso" — **não procede na
  fiação atual**: o adaptador nunca atravessa `traduzirFalhaDaLeitura`, roda depois no handler, e cai no ramo
  genérico do `error-handler` (500) independentemente do construtor. A asserção continua válida; a justificativa é
  que está errada. Deixado para a 007 **de propósito**, porque é lá que a rota é montada e a fiação muda.

- **F2/TASK-BACKEND-004 — ARMADILHA DIRETA, herdada da 003.** A tradução de falhas do multipart filtra "defeito de
  programação" por **quatro construtores** (`TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`), não por
  origem. A 004 pluga o adaptador de armazenamento **na mesma tubulação**: um defeito dele sinalizado com
  `new Error(...)` viraria **415 silencioso** — o inverso exato do bug que reprovou a 003. Se o adaptador puder
  falhar por defeito próprio, ele precisa sinalizar de forma distinguível.
- **F2/TASK-BACKEND-007/008 — dívida da 003:** `LIMIT_FIELD_VALUE` produz `RequestBodyTooLargeError`, que orienta o
  administrador a "enviar menos imagens" quando o problema é um **campo de texto**. Reproduzido (campo de 200 KB).
  Não alcançável por administrador real hoje (o `description` tem teto de 1000 chars contra 16 KB do campo), mas
  fica registrado.
- **F2/TASK-BACKEND-011 — cobertura de ramos do middleware de upload está em 69,56%.** O contador de bytes e dois
  ramos de tradução **não têm teste**; foram verificados por sonda, então uma regressão futura passa despercebida.
- **ENCERRAMENTO DA FEATURE-002 — pendência:** o `code` `UNSUPPORTED_MEDIA_TYPE` é o **décimo** código novo, contra
  os nove enumerados no changelog, e não está na tabela de mensagens do `spec_context.md`. Não bloqueia nenhuma
  task; **bloqueia o fechamento da feature.**

- **F2/TASK-BACKEND-005 — nomes de município SE REPETEM entre UFs** (`Boa Esperança` existe em ES, MG e PR). A
  listagem precisa ser escopada por estado, e nenhuma busca pode assumir unicidade de nome — o índice
  `@@index([stateId, name])` existe para isso. O DF tem município (`Brasília`, 5300108). Os nomes têm acentuação
  oficial, então filtro por texto precisa **decidir explicitamente** se é sensível a acento.
- **F2/TASK-BACKEND-011 — o teste mais importante do seed é o de SERIALIZAÇÃO.** Um `Promise.all` reintroduzido
  passa em qualquer teste funcional e só quebra em volume; o modo de detectar é **contar escritas em voo** (máximo
  tem que ser 1). Cobrir também: loteamento do `createMany` em 1.000, contadores vindos do `count` real, Zod
  abortando antes do primeiro comando, idempotência, `update` preservando `id`, e resolução por `__dirname`.
  `collectCoverageFrom` precisa ganhar `prisma/seeds/**/*.ts`. Os testes **não devem escrever no Supabase real** —
  cada escrita custa ~880 ms medidos.
- **Simular ausência de variável de ambiente: `DOTENV_CONFIG_PATH` NÃO basta.** O `@prisma/client` carrega o `.env`
  vizinho ao schema por conta própria e repõe os valores antes de `src/config/env.ts` rodar. O único jeito fiel é
  trocar o próprio `.env` — e restaurá-lo depois, conferindo por md5. Vale para a TASK-004, que introduz as
  variáveis do Supabase Storage.
- **F2/TASK-BACKEND-002 — o gancho `prisma.seed` JÁ ESTÁ OCUPADO.** `package.json` registra `prisma.seed` apontando
  para `prisma/seed.ts`, que faz `upsert` do administrador reescrevendo `passwordHash`, `role`, `status` e
  `emailConfirmedAt`. **A carga de estados e municípios não pode ser pendurada nele sem pensar.** Foi por isso que a
  TASK-001 precisou de `--skip-seed` ao gerar a migration: sem a flag, gerar migration reescreve a linha do admin.

- **TASK-FRONTEND-010 — DUAS ARMADILHAS CONCRETAS, as duas achadas na revisão da 009:**
  1. **Toda escrita local tem que passar por `escrever`** em `use-species-collection.ts`. Chamar `setSpecies`
     direto reintroduz a corrida corrigida. A regra **não está protegida por nada além de comentário**. E ela
     repousa numa pré-condição não enunciada: toda escrita registrada já precisa estar **durável no servidor**.
     **Exclusão otimista quebraria** — a escrita seria zerada na partida da listagem seguinte e o item
     **reapareceria** na lista.
  2. **O `ConfirmDialog` precisa de cuidado extra na exclusão.** O cleanup dele (`confirm-dialog.tsx:118-124`)
     devolve o foco chamando `focus()` no elemento que o abriu — que é a lixeira **da linha que acabou de ser
     excluída**. A linha desmonta no mesmo instante, o `focus()` cai sobre elemento já destacado do DOM e o foco
     vai para o `<body>`: exatamente o defeito que aquele comentário diz evitar. É o primeiro fluxo do projeto em
     que quem abre o diálogo desaparece ao confirmar.
- **TASK-FRONTEND-011 — os 5 avisos de `act()` NÃO vêm de um arquivo isolado.** As revisões das tasks 009 e 010
  os atribuíram a `app-routes.spec.tsx` e a `register-page.spec.tsx` respectivamente; **as duas atribuições estão
  erradas**. Verifiquei: rodado sozinho, `npx jest src/routes/app-routes.spec.tsx` emite **zero** avisos, e
  `register-page.spec.tsx` também. Eles só aparecem na execução completa da suíte, o que aponta interação entre
  suítes e não um arquivo culpado. **Diagnostique antes de aplicar a correção sugerida abaixo** — ela pode não ser
  suficiente.
- **TASK-FRONTEND-011 — os testes dos dois major da 010 são de CONCORRÊNCIA** e exigem promessa retida em voo; as
  asserções de foco nos ramos de 404 só são observáveis com a listagem também retida. Um teste sequencial comum
  passa sem exercitar nada. O cenário do `finally` obsoleto é o que protege a lógica de virar um
  `setSequenciaEmGravacao(null)` cego numa refatoração futura.
- **TASK-FRONTEND-011 — o erro do formulário de criação mudou de papel ARIA:** saía `role="status"`/`polite` na 009
  e agora sai `role="alert"`. Consulte por `role="alert"`. Mudança aceita na revisão (papel semanticamente melhor),
  texto inalterado.
- **TASK-FRONTEND-011 — BLOQUEANTE, e é regressão que a 009 causou:** `app-routes.spec.tsx` declara na L31-33 que
  dubla `auth-api` porque "nenhuma requisição pode escapar". A árvore agora monta `SpeciesPage`, que chama
  `species-api` **sem dublê** — a invariante do próprio arquivo deixou de ser cumprida, sustentada só pelo `fetch`
  que lança em `tests/setup.ts`. Daí os 5 avisos de `act()`. Correção: `jest.mock('~/services/api/species-api')`
  ao lado da L34 e `mockResolvedValue({ items: [] })` no `beforeEach` da L44. **Uma guarda de `montado` não
  silencia o aviso** — o React 18 já descarta essas atualizações; o componente ainda está montado quando o
  `.catch` dispara.
- **TASK-FRONTEND-011 — teste de contrato de fonte para os caracteres invisíveis.** A regra de higienização existe
  agora **duas vezes** (backend e frontend) e nada no build cruza os dois arquivos. Fixar um caso de fronteira
  (`"A"×60 + U+200B`) **não basta**: o modo de deriva provável é o servidor **acrescentar** um code point, e aí o
  teste segue verde enquanto a divergência volta calada, na direção proibida. O tratamento devido é ler
  `services/backend/src/domains/species/species.validators.ts` e **comparar o literal da regex** com o do frontend —
  falha quando qualquer um dos dois lados muda. Módulo compartilhado foi descartado com razão: não há workspace na
  raiz, e exigiria um terceiro pacote para eliminar três linhas.
- **TASK-FRONTEND-009/010 — para contar caracteres use `higienizarNomeDeEspecie`, nunca `normalizeSpeciesName`.**
  A segunda é a RN-03 pura e **não** higieniza invisíveis; usá-la num contador `n/60` sob o campo reintroduz a
  divergência que a rodada 2 fechou.
- **TASK-FRONTEND-010 — fixe a forma do rótulo acessível.** A 008 assume que o `IconButton` compõe
  `${EDIT_ACTION} ${nome}` (verbo solto + nome) para satisfazer o RNF-07. É contrato **implícito**: se a 010 montar
  de outro jeito, o requisito quebra sem nada reprovar.
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
