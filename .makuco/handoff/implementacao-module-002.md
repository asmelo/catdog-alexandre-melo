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
| 003 backend species rename | **concluída** — reprovada na rodada 1 (1 major), aprovada na rodada 2 | typecheck exit 0; 15 suítes / 138 testes | ver `git log` |

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

## Dívida encontrada fora do escopo — registrar em `technical-debt.md` quando a TASK-010 da feature de animais criar o arquivo

- **`src/domains/auth/auth.validators.ts`, fábrica `objetoSemCamposExtras`**: usa `chave in forma`, que consulta a
  cadeia de protótipos. Chaves como `toString`, `constructor`, `valueOf`, `hasOwnProperty` e `isPrototypeOf` passam
  pela guarda de "campo não permitido" no domínio `auth`. Correção é uma palavra (`Object.hasOwn(forma, chave)`),
  mas o domínio `auth` está fora do escopo das tasks do MODULE-002. Descoberto na revisão da TASK-BACKEND-003, que
  encontrou o mesmo furo introduzido em `species` (lá foi corrigido).

- **`__proto__` como chave de corpo** (`{"name":"Gato","__proto__":"x"}`) responde 201/200 em vez de 400: o `superRefine` roda
  sobre a saída do `.passthrough()` e o Zod monta o objeto por atribuição, então `__proto__` some antes do laço. **Não é
  regressão** — o bloco inline da TASK-BACKEND-002 tinha o mesmo desfecho, e a poluição de protótipo foi testada e não ocorre
  (`Object.prototype` permanece limpo). Desvio da letra da RN-13 sem impacto observável. Tratar junto com a dívida do `auth`.

## Achados a repassar para tasks futuras

- **Para a TASK-BACKEND-003:** o bloco anti-chave-extra de `species.validators.ts` já é a segunda cópia do `objetoSemCamposExtras` do auth. Não faça a terceira — reuse o que existe em species.
- **Para a TASK-BACKEND-005:** acrescentar o modelo `species` ao `tests/fakes/prisma-double.ts`; decidir entre usar ou remover o parâmetro `dependencias?` de `createSpeciesController` (hoje sem chamador — a estratégia real de teste do projeto dubla o módulo `~/infra/prisma/prisma-client`); a corrida do CT-12 e a ordenação dos CT-13/CT-14 estão verificadas só por leitura estática até lá.
- **Para a TASK-BACKEND-002/003 (criação e renomeação):** em Postgres, a violação de índice único aborta a transação inteira (`25P02 current transaction is aborted` no statement seguinte ao `23505`). Se o service capturar o `P2002` **dentro** de uma transação interativa para convertê-lo em `SpeciesNameAlreadyExistsError`, nenhuma consulta posterior roda naquela transação. O `INSERT` precisa ser a última operação da transação, ou o tratamento do conflito fica fora dela. A RN-16 continua garantida pelo banco — muda só a forma de traduzir o erro.

## Problemas / pendências

- Três tentativas iniciais da TASK-BACKEND-001 morreram com `API Error: 529 Overloaded` (sobrecarga transitória do servidor). Trabalho parcial revertido a cada queda; a quarta tentativa concluiu. Sem impacto no resultado.
