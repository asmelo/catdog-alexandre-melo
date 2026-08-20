# Retomada de sessão — pendências pós TASK-BACKEND-001

> Cole o conteúdo da seção **PROMPT** abaixo em uma nova sessão do Claude Code,
> a partir de `/home/alexandre.melo@db1.com.br/Projetos/catdog-alexandre-melo`.
> Gerado em 2026-08-20 por Claude Opus 5.

---

## PROMPT

Projeto: **CatDog** (`/home/alexandre.melo@db1.com.br/Projetos/catdog-alexandre-melo`), branch `master`.
Contexto no `MAKUCO.md` e em `.makuco/codebase/`. Fale comigo em português.

### Onde paramos

A **TASK-BACKEND-001** (scaffolding do backend + schema Prisma da FEATURE-002) foi
implementada pelo agente `makuco-codegen`, validada e commitada. Working tree limpo,
dois commits em `master` (nada foi pushado):

```
5d66511  feat(auth): implementa scaffolding do backend e schema Prisma (TASK-BACKEND-001)
0374592  chore: adiciona scaffolding Makuco e documentacao do projeto CatDog
```

Artefatos de referência, leia antes de agir:
- Task: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/tasks/task_001_backend_scaffolding_prisma_schema.md`
- Checklist preenchido (estado real de cada AC): `..._task_001_backend_scaffolding_prisma_schema_checklist.md` no mesmo diretório
- Spec da feature: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`

O que **já** está verificado: `tsc --noEmit` 0 erros, `prisma validate` ok,
`GET /api/health` → 200 em dev e após build, `process.env` só em `src/config/env.ts`,
zero `any`, SonarQube quality gate **OK** (0 bugs / 0 vulns / 0 hotspots).

### Pendência A — Validar o schema contra o Supabase real (a mais importante)

Os critérios de aceite 3 a 7 da task (tabelas, índices, unicidade, cascade, defaults)
foram validados contra um **PostgreSQL 16 local descartável em Docker**, não contra o
Supabase. Seguem **não verificados**: o pooler na porta 6543, o `directUrl` na 5432 e
os limites de conexão.

Existe um `services/backend/.env` **temporário com placeholders** (gitignorado,
`DATABASE_URL` apontando para host inexistente). Preciso substituir pelos valores reais
do meu projeto Supabase e então:

```bash
cd services/backend
# preencher DATABASE_URL (pooler 6543, ?pgbouncer=true&connection_limit=1)
#         e DIRECT_URL   (direta 5432)
npx prisma migrate dev
```

Depois confirme no banco: as 3 tabelas (`users`, `email_confirmation_tokens`,
`refresh_tokens`), os 3 enums, os 4 índices unique + 4 índices comuns, o cascade
delete, os defaults `CLIENTE` / `PENDING_CONFIRMATION`, e a unicidade de `email`
independente de `status` (RN-13).

**Decisão pendente (DESVIO-003)**: existe `prisma/migrations/20260820145655_init/`
gerada contra o Postgres local e **já commitada**. Não constava na tabela *Files* da
task. Ou mantemos (fluxo padrão do Prisma, evita init divergente por dev) ou apagamos
e regeneramos contra o Supabase. Me recomende uma e explique o trade-off antes de mexer.

### Pendência B — Node 20 e criação do CI

`services/backend/package.json` declara `engines: { node: ">=20 <21" }` (conforme
`.makuco/codebase/stack.md`, linha 10: Node.js 20 LTS), mas esta máquina roda
**v23.10.0** → `npm warn EBADENGINE` em toda instalação. Tudo funcionou, mas a
validação local não vale como prova.

Estado atual verificado:
- `nvm` instalado em `~/.nvm/nvm.sh`, porém **só a v23.10.0** está instalada
- **não existe `.nvmrc`** nem pin via `volta`
- **não existe `.github/`** — o CI ainda não foi criado (o `stack.md` prevê GitHub Actions)

O que eu quero:
1. Fixar Node 20 localmente (`nvm install 20` + `.nvmrc`) e revalidar
   `npm ci && npm run typecheck && npm run build` sob a v20.
2. Criar o workflow de CI em `.github/workflows/`, com Node 20 fixo, rodando
   typecheck + build. Testes entram na TASK-BACKEND-007 — deixe o passo preparado
   mas não invente suíte agora.

### Pendência C — Bug do MCP `sonar-run` nesta máquina

O `mcp__makuco-mcp__sonar-run` **sempre falha aqui** com
`Failed to query server version: ... HTTP connect timed out`. Causa diagnosticada:
ele monta o `docker run` **sem `--network host`**, e `sonar.anymarket.vpc`
(`10.119.10.55`) existe apenas no `/etc/hosts` do host, que o container na bridge
padrão não herda. Comprovado: `bridge=000` vs `--network host=200`.

**Não é VPN e não é rede** — o servidor responde (SonarQube 26.5.0).

Workaround que funciona (análise sobe e cria o projeto):

```bash
docker run --rm --network host \
  -e SONAR_HOST_URL=http://sonar.anymarket.vpc:9000 \
  -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli \
  -Dsonar.sources=services/backend/src \
  -Dsonar.exclusions='**/node_modules/**,**/dist/**'
```

Leva ~10 min na primeira vez (baixa plugins). Dashboard:
`http://sonar.anymarket.vpc:9000/dashboard?id=catdog-alexandre-melo`

Ação: me ajude a redigir um report objetivo do bug para o time do Makuco.

### Pendência D — Regra S1135 gera falso positivo em PT-BR

A análise achou 3 code smells, todos `typescript:S1135` ("Complete the task associated
to this TODO comment"), severidade INFO, 0min de débito. **Nenhum é defeito**:

- `src/app.ts:38` e `src/routes/index.ts:14` — marcadores `TODO(TASK-BACKEND-002)` e
  `TODO(TASK-BACKEND-004/005)` **exigidos literalmente pelo contrato da task**.
  Não remover.
- `src/config/env.ts:9` — **falso positivo**: o `textRange` (offset 46–50) aponta para
  a palavra portuguesa "todo" em *"em todo o backend"*.

Como o `MAKUCO.md` manda escrever documentação em PT-BR e "todo/toda/todos" é palavra
corriqueira, isso vai reincidir conforme o código cresce. Quero decidir agora: desabilitar
S1135 no quality profile do projeto, restringir o padrão da regra, ou triar como
*won't fix* sistematicamente. Me dê uma recomendação.

### Pendência E — Confirmar que o token do Sonar carregou

Renovei o `SONAR_TOKEN` em `.env.mcp` e `.mcp.json` (ambos gitignorados), mas o processo
MCP da sessão anterior ainda usava o token antigo e retornava 401. Como esta é uma sessão
nova, deve estar resolvido. Confirme com uma chamada real:

```
mcp__makuco-mcp__get-sonar-issues(projectKey="catdog-alexandre-melo",
                                  filters={"issueStatuses":["OPEN"],"ps":100})
```

Se ainda vier 401, o token em `.mcp.json` não está sendo lido — investigue em vez de
contornar. Sugestão de higiene: hoje o token está **em texto claro** no `.mcp.json`;
avalie referenciá-lo por variável de ambiente.

### Depois das pendências

Seguir para a **TASK-BACKEND-002** (transversais: classes de erro, middlewares de
erro/validação, `config/cors.ts`, util de hash) com o agente `makuco-codegen`, mesmo
fluxo da 001: `create-codegen-checklist.sh` → knowledge chain → implementação → validação
→ `makuco-quality-gate`.

### Como quero que você trabalhe

- **Verifique, não presuma.** Na sessão anterior o agente reportou "Sonar bloqueado por
  VPN" e o diagnóstico real era outro (Docker sem `--network host` + token inválido).
  Rode os comandos e me mostre a saída.
- Se um critério não puder ser validado neste ambiente, diga explicitamente que não foi
  validado. **Não marque como concluído o que não foi executado.**
- Respeite o escopo dos slices: não implemente nada das tasks 002–013 enquanto resolve
  as pendências acima.
- Não commite nem faça push sem eu pedir. Se eu pedir, pode commitar direto em `master`
  (o repo usa Conventional Commits em PT-BR, precedente dos 2 commits atuais —
  `conventions.md` ainda registra a convenção como "a ser definida").
- Não chame subagentes sem eu pedir.

---

## Notas para mim (fora do prompt)

- Este arquivo **não** foi commitado. Apague ou versione conforme preferir.
- Nenhum segredo está aqui: o token vive só em `.env.mcp` / `.mcp.json`, ambos gitignorados.
- Auditoria do histórico já feita: zero tokens, zero `.env`, zero `node_modules`/`dist`
  nos 63 arquivos versionados.
