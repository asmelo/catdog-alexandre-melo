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
| 001 backend species model/migration | **concluída** — revisão aprovada (0 critical, 0 major) | typecheck exit 0; 15 suítes / 138 testes | ver `git log` |

**TASK-BACKEND-001** — entregou `schema.prisma` (modelo `Species`), migration `20260826124117_create_species`,
`species.messages.ts`, `errors/species.errors.ts` e `species-name.ts`. Migration aplicada no Supabase de dev;
`users`/`refresh_tokens`/`email_confirmation_tokens` preservados (2 / 8 / 1). Achados minor da revisão foram
transferidos para a TASK-BACKEND-002 (limite de 60 chars após `toLowerCase()`; `U+200B` não coberto por `\s+`).

## Decisões fora da spec

- **TASK-BACKEND-001** — catálogo de mensagens exporta `MESSAGES` (e não `SPECIES_MESSAGES`), espelhando `auth.messages.ts`. A task não nomeia o export.
- **TASK-BACKEND-001** — os comentários `///` do modelo `Species` no `schema.prisma` saíram acentuados (bloco literal da spec), enquanto o resto do arquivo usa PT-BR sem diacrítico.
- **TASK-BACKEND-001** — contradição interna do contrato resolvida a favor da seção `## Implementation`: o critério de aceite proíbe duplicar texto de `auth.messages.ts`, mas a seção de implementação lista `NAME_REQUIRED` e `FIELD_NOT_ALLOWED` como obrigatórias, e as duas repetem texto do auth. Implementado como a seção de implementação manda; fica como dois pontos de manutenção para o mesmo texto.
- **TASK-BACKEND-001** — o `@@index([nameNormalized])` foi removido conforme a linha 58 da task (redundante com o `@unique` em Postgres). O primeiro agente havia mantido o índice; corrigido por agente de correção, com rollback pontual da migration no banco de dev (só a tabela `species`, que estava vazia).

## Achados a repassar para tasks futuras

- **Para a TASK-BACKEND-002/003 (criação e renomeação):** em Postgres, a violação de índice único aborta a transação inteira (`25P02 current transaction is aborted` no statement seguinte ao `23505`). Se o service capturar o `P2002` **dentro** de uma transação interativa para convertê-lo em `SpeciesNameAlreadyExistsError`, nenhuma consulta posterior roda naquela transação. O `INSERT` precisa ser a última operação da transação, ou o tratamento do conflito fica fora dela. A RN-16 continua garantida pelo banco — muda só a forma de traduzir o erro.

## Problemas / pendências

- Três tentativas iniciais da TASK-BACKEND-001 morreram com `API Error: 529 Overloaded` (sobrecarga transitória do servidor). Trabalho parcial revertido a cada queda; a quarta tentativa concluiu. Sem impacto no resultado.
