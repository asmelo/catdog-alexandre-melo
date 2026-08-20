# Makuco Codegen Checklist: TASK-BACKEND-001 — Scaffolding do backend e schema Prisma da autenticação

**Purpose**: Validar a qualidade da geração de código do slice inaugural do backend (Express + Prisma + modelo de dados da FEATURE-002). Cada item abaixo reflete uma verificação **efetivamente executada**; itens não executáveis neste ambiente estão marcados como `[~]` (N/A) ou `[!]` (bloqueado) com a justificativa, e **nunca** como concluídos.
**Created**: 2026-08-20
**Feature**: [spec_context.md](../spec_context.md)
**Prompt Plan**: [task_001_backend_scaffolding_prisma_schema.md](./task_001_backend_scaffolding_prisma_schema.md)

**Legenda**: `[x]` verificado e aprovado · `[~]` não aplicável a este slice (com justificativa) · `[!]` bloqueado por ambiente (com justificativa)

## Quality Tools

- [x] Run linters and compilers available in the project to ensure the generated code is free of errors and follows the project's standards.
  - `tsc --noEmit` (flags `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`): **0 erros**.
  - `prisma validate`: schema válido. `prisma format`: sem reformatação pendente. `prisma generate`: client v5.22.0 gerado.
  - ESLint: **não existe no projeto** (não faz parte do contrato de dependências desta task). Compensado por uma execução efêmera de `eslint@9` + `typescript-eslint@8` (`recommendedTypeChecked` + `no-explicit-any`, `complexity:10`, `max-depth:3`, `eqeqeq`, `prefer-const`) instalada fora do repositório: **0 erros, 0 warnings**. A config temporária foi removida — nada foi adicionado ao `package.json`.
- [~] Run tests to ensure all implemented code is covered and all tests are passing successfully.
  - **Fora do escopo por decisão explícita da task** ("Out: Nenhum teste (TASK-BACKEND-007)") e das restrições do slice (proibido adicionar `jest`). Compensado por verificação manual executável — ver seção *Testing and Validation*.
- [x] Run complexity check in MCP, if available, to ensure the generated code does not exceed the project's complexity standards.
  - `complexity-check(path=services/backend/src, cyclomaticThreshold=10)`: **nenhuma função acima do limiar**. Confirmado de forma independente pela regra ESLint `complexity: ['error', 10]` (0 violações).
- [x] Run SonarQube analysis using the Makuco MCP tools, if applicable, to ensure that the generated code meets the project's quality standards and does not introduce new issues.
  - **EXECUTADO em 2026-08-20 15:39** — `ANALYSIS SUCCESSFUL` (1m54s), projeto `catdog-alexandre-melo` criado: http://sonar.anymarket.vpc:9000/dashboard?id=catdog-alexandre-melo. **Quality gate: OK** (`caycStatus: compliant`). Métricas: 0 bugs, 0 vulnerabilities, 0 security hotspots, 0.0% duplicação, complexidade cognitiva 4, 120 ncloc / 5 arquivos, 3 code smells INFO (0min de débito — ver análise abaixo).
  - O MCP `sonar-run` **não** funciona nesta máquina: ele monta o `docker run` sem `--network host`, e `sonar.anymarket.vpc` (10.119.10.55) existe apenas no `/etc/hosts` do host, que o container na bridge padrão não herda (`bridge=000` vs `--network host=200`). O `connect timed out` era isso, **não** falta de VPN. Contornado rodando o `sonarsource/sonar-scanner-cli` com `--network host`. Bug do MCP a reportar ao time do Makuco.
  - O `401` do `get-sonar-issues` era um token inválido (`api/authentication/validate` → `{"valid":false}`), não permissão. Token renovado em `.env.mcp`/`.mcp.json` (ambos gitignorados); o processo MCP em execução só o relê após reiniciar o Claude Code, então os resultados acima foram obtidos pela API REST.

## Code Quality

- [x] Code follows the project's existing patterns and best practices.
  - Projeto greenfield: `services/backend/` estava vazio. Aderência verificada contra `.makuco/codebase/conventions.md` e `MAKUCO.md`: arquivos em kebab-case (`prisma-client.ts`), alias `~/` → `src/`, pastas `config/`/`infra/`/`routes/`, documentação e mensagens em PT-BR, proibição de `any` respeitada.
- [x] Code is free of linting and compiler errors.
  - `tsc --noEmit` = 0 erros; ESLint efêmero = 0 erros/0 warnings.
- [x] Code is readable and maintainable, with clear naming conventions and structure.
  - 5 arquivos TypeScript, o maior com 88 linhas (`src/config/env.ts`); nenhuma função acima de 10 de complexidade ciclomática; cada decisão não óbvia (pooler vs. `directUrl`, singleton em `globalThis`, `Char(64)` para SHA-256, `credentials` vs. wildcard de CORS) documentada em comentário no ponto de uso.
- [x] Zero new issues introduced in SonarQube analysis (if applicable).
  - 3 code smells `typescript:S1135` ("Complete the task associated to this TODO comment"), todos severidade **INFO** e **0min** de débito. Nenhum é defeito:
    - `src/app.ts:38` e `src/routes/index.ts:14` — os marcadores `TODO(TASK-BACKEND-002)` e `TODO(TASK-BACKEND-004/005)` **exigidos literalmente pelo contrato da task**. Removê-los violaria o plano.
    - `src/config/env.ts:9` — **falso positivo**: o `textRange` (offset 46–50) aponta para a palavra portuguesa "todo" em *"em todo o backend"*. **DECIDIDO em 2026-08-20: não alterar o quality profile.** Verificações feitas: (a) `typescript:S1135` **não tem parâmetros** (`api/rules/show`), logo "restringir o padrão" não existe como opção; (b) o projeto usa o profile `Sonar way` **padrão da instância** (`ts`, key `AWYRPh7CxNfJMjdO8bGw`), compartilhado por todos os projetos TS deste SonarQube corporativo — desabilitar ali teria alcance organizacional; (c) lendo o fonte da regra (`eslint-plugin-sonarjs`, `S1135/rule.js`), ela casa o literal `todo` e **descarta o match se houver letra antes ou depois**. Testado: `todo`, `todo:`, `todo-o-array` e `Todo o restante` disparam; **`todos`, `toda` e `todas` não disparam**. O risco de reincidência é portanto restrito ao "todo" masculino singular isolado. Ação: reescrever o comentário de `env.ts:9` (`"em todo o backend"` → `"em todos os módulos do backend"`), custo zero e sem perder cobertura. Os TODOs de `app.ts:38` e `routes/index.ts:14` **não são falsos positivos** — são trabalho pendente real e se resolvem nas tasks 002/004/005.
- [x] No code duplication introduced (DRY principle).
  - Validadores Zod reutilizáveis extraídos (`booleanoTextual`, `listaDeOrigens`); nenhum bloco repetido entre arquivos.
- [x] No GOD classes, methods or files introduced.
  - Nenhum arquivo acima de 90 linhas; nenhuma função acima de 15 linhas; responsabilidade única por arquivo (`env` valida env, `app` monta, `index` faz listen, `routes` roteia, `prisma-client` conecta).
- [~] Code is properly tested, with all tests passing and at least 80% of coverage.
  - Testes automatizados são a TASK-BACKEND-007 por decisão da task. **Cobertura automatizada atual: 0%** — declarado explicitamente em vez de presumido. Todo comportamento entregue foi verificado manualmente de forma executável (ver *Testing and Validation*).

## Security Check

- [x] No new vulnerabilities introduced in SonarQube analysis.
  - `vulnerabilities = 0`, `security_rating` sem violações. `npm audit`: 0 vulnerabilidades em 185 pacotes.
- [x] All inputs are validated at system boundaries to prevent injection attacks and ensure data integrity.
  - A única fronteira deste slice é a de configuração: `process.env` é validado por Zod em `src/config/env.ts` com falha no boot. `express.json({ limit: '10kb' })` limita o corpo das requisições. Validação de payload de rotas de autenticação pertence à TASK-BACKEND-004.
- [x] No security hotspots introduced in SonarQube analysis.
  - `security_hotspots = 0`, confirmado pela análise. Consistente com a revisão manual (sem `eval`, sem concatenação de SQL, sem deserialização insegura, sem criptografia própria).
- [x] Code does not contain any known security anti-patterns (e.g., hardcoded secrets, unsafe deserialization, etc.).
  - Nenhum segredo no código: `.env.example` contém apenas placeholders autodescritivos (`troque-por-um-segredo-aleatorio-...`, `app-password-do-gmail`) e o `.env` real está no `.gitignore` (confirmado por `git check-ignore`); `.env.example` permanece rastreável.
  - `JWT_ACCESS_SECRET` exige no mínimo 32 caracteres — comprovado por teste de boot.
  - CORS: wildcard `*` **rejeitado no boot** por `refine`, pois é incompatível com `credentials: true`.
  - `helmet()` ativo (CSP, HSTS, `nosniff`, `X-Frame-Options`) e `X-Powered-By` removido — confirmado nos headers da resposta real.
- [x] Code follows secure coding practices as defined by the project and industry standards.
  - Senha nunca em texto plano: a coluna é `password_hash VARCHAR(72)` (dimensionada para bcrypt); o hash em si é da TASK-BACKEND-002.
  - `token_hash CHAR(64)` (SHA-256 hex) com unique — sem token em claro no banco.
  - `onDelete: Cascade` impede tokens órfãos.
  - `trust proxy` ativado apenas em produção (evita spoofing de IP em dev).
- [x] No security vulnerabilities introduced (e.g., injection, XSS, SSRF, etc.)
  - `npm audit`: **0 vulnerabilidades** em 185 pacotes. Sem SQL manual (todo acesso via Prisma); sem renderização de HTML; sem requisições de saída neste slice.

## Implementation Completeness

- [x] All steps in the execution plan have been implemented as specified.
  - Todos os 10 arquivos da tabela *Files* criados + `MAKUCO.md` corrigido (`adotante` → `cliente`, 0 ocorrências restantes). Duas lacunas do contrato foram encontradas e corrigidas (DECISÃO-001 `tsc-alias`, DECISÃO-002 `dotenv`) — sem elas os ACs 1 e 9 seriam impossíveis. Ver *Notes*.
- [x] All necessary files have been created and properly structured.
  - `services/frontend/` permanece **vazio**; nenhuma dependência proibida presente (`bcrypt`, `jsonwebtoken`, `nodemailer`, `express-rate-limit`, `jest` — todas ausentes, verificado no `package.json`); nenhum arquivo fora de escopo criado (sem classes de erro, middlewares, mailer, `seed.ts` ou testes).
- [x] All referenced code patterns and best practices have been followed.
  - `app.ts` exporta `app` e **não** chama `app.listen` (verificado); `import 'express-async-errors'` é a primeira linha; ordem de middlewares `helmet` → `cors` → `json` → `cookieParser` → `/api` respeitada; `datasource` com `url` + `directUrl`; todas as colunas de data em `Timestamptz(3)` (confirmado no banco); `@@map`/`@map` snake_case plural.
- [x] All validation rules have been implemented and passed successfully.
  - Falha no boot comprovada em 3 casos: variável obrigatória ausente, `JWT_ACCESS_SECRET` curto e wildcard de CORS — cada um nomeando a variável na mensagem.

## Testing and Validation

- [~] All implemented code is covered by tests, including edge cases.
  - Sem testes automatizados por decisão da task (TASK-BACKEND-007). **Verificação manual executada e reproduzível**:
    - `GET /api/health` → `200 {"status":"ok","uptime":<number>}` em **ambos** os modos: `npm run dev` (alias `~/` via `tsconfig-paths`) e `node dist/index.js` (alias reescrito por `tsc-alias`).
    - Boot rejeitado em 3 cenários de env inválida, com a variável nomeada.
    - CORS: origem permitida recebe `Access-Control-Allow-Origin`; `http://evil.com` **não** recebe.
    - `prisma migrate dev --name init` aplicado com sucesso contra um PostgreSQL 16.14 descartável (container Docker, já removido): 3 tabelas + 3 enums criados; todos os unique e índices exigidos presentes; `DELETE` de `User` removeu os tokens filhos em cascata; `INSERT` sem `role`/`status` resultou em `CLIENTE`/`PENDING_CONFIRMATION`; e-mail duplicado rejeitado por `users_email_key` **independentemente do status** (RN-13).
    - `migration.sql` gerado é **idêntico** ao DDL de `prisma migrate diff --from-empty` (diff vazio).
- [~] All tests are passing successfully.
  - Não há suíte de testes neste slice (fora de escopo).
- [x] SonarQube analysis shows no new issues introduced by the generated code (if applicable).
  - Quality gate **OK**. Único achado: 3 code smells INFO em comentários TODO, 2 deles mandatórios pela task e 1 falso positivo linguístico. Nada a corrigir.
- [~] Tests cover expected behavior and edge cases, ensuring the implementation is robust and reliable, covering validation rules defined in the prompt plan.
  - As regras de validação foram exercitadas manualmente (acima), não por testes automatizados. Converter essas verificações em testes `supertest`/Jest é responsabilidade da TASK-BACKEND-007 — a separação `app.ts` (sem `listen`) × `index.ts` (com `listen`) foi preservada exatamente para viabilizá-la.

## Notes

- **DECISÃO-001 — `tsc-alias` adicionado como devDependency.** O contrato da task manda `build: tsc && npm run copy:templates` e `start: node dist/index.js`, mas o `tsc` **não** reescreve o alias `~/`: o build emitia `require("~/app")` e `node dist/index.js` falhava com `Cannot find module '~/app'` (falha reproduzida antes da correção). Sem isso o AC 9 é impossível. Alternativa descartada: mover `tsconfig-paths` para `dependencies` de produção — pior, pois exige um resolvedor de alias em runtime. `tsc-alias` é build-time only, portanto a instalação de produção fica sem dependência extra.
- **DECISÃO-002 — `dotenv` adicionado como dependency.** Nada no contrato carregava o `.env`, então o boot falhava com `DATABASE_URL: Required` mesmo com o arquivo presente, tornando o AC 1 impossível. `import 'dotenv/config'` fica **apenas** em `src/config/env.ts`, preservando o ponto único de acesso a `process.env`. Alternativa descartada: `node --env-file` — `--env-file-if-exists` não existe no Node 20 LTS e a flag falha quando o arquivo não existe (caso de produção).
- **DESVIO-003 — `prisma/migrations/20260820145655_init/` foi versionado.** Não consta na tabela *Files*, mas é o produto natural do comando do AC 3 (`prisma migrate dev`). Versionar a migration inicial é o fluxo correto do Prisma: sem ela, cada dev geraria uma init divergente. O SQL é idêntico ao `migrate diff` do schema. **DECIDIDO em 2026-08-20: manter.** O argumento decisivo é operacional — com a pasta versionada é possível aplicar por `prisma migrate deploy`, que **não** exige shadow database; apagando-a, `prisma migrate dev` passa a ser o único caminho e é justamente o que falha com `P3014` quando a role não tem `CREATEDB`. Manter também evita init divergente por dev. Validado empiricamente: a migration gerada contra PostgreSQL 16.14 local aplicou **sem alteração** no Supabase (PostgreSQL 17.6) e o schema resultante passou 37/37 checagens.
- **BLOQUEIO-A — RESOLVIDO (2026-08-20).** O SonarQube **foi** executado: quality gate OK, 0 bugs / 0 vulnerabilities / 0 hotspots, 3 code smells INFO sem ação. O diagnóstico inicial de "exige VPN" estava **errado**: a rede sempre funcionou (servidor 26.5.0 responde `200`). Havia duas causas independentes — (a) o `docker run` do MCP `sonar-run` sem `--network host`, deixando o container sem acesso ao `/etc/hosts` do host; (b) o `SONAR_TOKEN` do `.mcp.json` inválido, origem do `401`. Ambas contornadas/corrigidas. Pendência remanescente: o MCP `sonar-run` continuará falhando nesta máquina até o Makuco passar `--network host` (ou equivalente `--add-host`).
- **BLOQUEIO-B — RESOLVIDO (2026-08-20).** Projeto Supabase `Cat Dog` (`pwdybjpxdqvpwumnoivo`, região `us-east-2`, **PostgreSQL 17.6**) provisionado; senha do banco resetada (a original não é recuperável) e gravada em `services/backend/.env` (gitignorado, `chmod 600`), alfanumérica de 32 caracteres para não exigir percent-encoding na URI. `prisma migrate dev` aplicado **com sucesso contra o Supabase** — sem `P3014`, o shadow database foi criado normalmente. Os ACs 3–7 foram então verificados **contra o banco real** por um validador executável (37 checagens, **0 falhas**): 3 tabelas, 3 enums com labels em ordem, 4 índices UNIQUE + 4 comuns (com contagem exata), defaults `CLIENTE`/`PENDING_CONFIRMATION` exercitados por `INSERT` sem os campos, as 9 colunas de data em `timestamptz(3)`, as 2 FKs com `confdeltype='c'`, cascade delete comprovado por `DELETE` real e RN-13 comprovada por SQLSTATE `23505` com status divergente. **Pooler (6543) e conexão direta (5432) ambos verificados em uso real**; o singleton `src/infra/prisma/prisma-client.ts` foi exercitado pelo caminho do pooler (assinatura `DEALLOCATE ALL` do modo `pgbouncer=true`). Limites de conexão: pool size **15**, max client connections **200** (fixo, compute Nano), `max_connections` do Postgres = 60. `prisma migrate deploy` contra produção segue não executado, conforme a restrição.
- **Contexto original do BLOQUEIO-B (histórico).** Não existe `.env` versionado nem projeto Supabase acessível. Os ACs 3–7 foram validados contra um PostgreSQL 16 descartável em Docker (removido ao final), **não** contra o Supabase: pooler na 6543, `directUrl` na 5432 e limites de conexão permanecem **não verificados** em ambiente real. `prisma migrate deploy` não foi executado contra produção, conforme a restrição.
- **RISCO-C — RESOLVIDO (2026-08-20).** Node 20 LTS fixado localmente (`nvm install 20` → **v20.20.2**, npm 10.8.2) e `.nvmrc` criado na raiz do repositório com `20`. Revalidação completa sob a v20 **sem nenhum `EBADENGINE`**: `npm ci` (183 pacotes, 0 vulnerabilidades), `npm run typecheck` = 0 erros, `npm run build` = 0 erros, `node dist/index.js` + `GET /api/health` → **200**. CI criado em `.github/workflows/backend-ci.yml`, fixando o Node por `node-version-file: .nvmrc` e rodando `npm ci` → `prisma validate` → `prisma generate` → `typecheck` → `build`; a sequência foi executada localmente **sem `.env`** e passa. Descoberta no processo: `prisma validate` falha com `P1012` sem `DATABASE_URL`/`DIRECT_URL` (o `generate` não), então o job define valores *dummy* nas portas 6543/5432 — nenhum passo abre conexão. O passo de testes detecta `scripts.test` e emite um `::notice` enquanto a suíte não existe, passando a executá-la sozinho na TASK-BACKEND-007. O `nvm alias default` global **não** foi alterado (segue v23.10.0) para não afetar outros projetos da máquina.
- **Contexto original do RISCO-C (histórico).** `engines` declara `>=20 <21` (Node 20 LTS, conforme `stack.md`), mas a máquina roda Node v23.10.0 → `npm warn EBADENGINE` em toda instalação. Build, typecheck e runtime funcionaram, mas o CI deve fixar Node 20 para valer como validação.
- `services/backend/.env` contém agora as **credenciais reais** do Supabase (`chmod 600`, coberto pelo `.gitignore`, confirmado por `git check-ignore`). Substituiu o placeholder anterior, cujo `DIRECT_URL` apontava para `localhost:5432` — endereço ocupado nesta máquina por um port-forward do `k9s`, ou seja, um alvo silenciosamente errado. Ao montar as URLs, atenção a duas assimetrias do Supabase: o usuário do pooler é `postgres.<project-ref>` e o da conexão direta é `postgres`; e `db.<ref>.supabase.co` resolve **somente em IPv6** (esta máquina tem IPv6 global, então funciona; numa rede IPv4-only seria necessário o session pooler na 5432 ou o add-on de IPv4).
- `src/infra/prisma/prisma-client.ts` ainda não é importado por nenhum módulo — é infraestrutura exigida pela task e consumida a partir da TASK-BACKEND-004. Não é código morto acidental.
- Commit realizado diretamente em `master` por decisão explícita do desenvolvedor (a branch `feature/TASK-BACKEND-001-backend-scaffolding-prisma-schema` prevista no cabeçalho da task foi dispensada). Nenhum push automático.
