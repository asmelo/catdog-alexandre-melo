# TASK-BACKEND-007 — Suíte de testes do backend e cobertura no Sonar

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-007-backend-test-suite`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 7 of 13 — Testes do Backend
**Generated**: `2026-08-19`

---

## Context

Fecha o critério de aceite de qualidade da spec no lado servidor: cobertura mínima de 80% e rastreabilidade direta entre os casos de teste CT-01..CT-15 e os testes automatizados. A configuração do Sonar na raiz do repositório hoje só tem `projectKey`/`projectName`/`host` — sem `sonar.sources` e sem caminho de cobertura, o Quality Gate não mede nada.

---

## Scope

**In:** Config do Jest, setup de testes, fakes em memória dos três repositórios, `FakeMailer`, specs unitários dos services de registro/confirmação/rotação, spec de integração HTTP com `supertest`, e a configuração de cobertura no `sonar-project.properties`.

**Out:** Não alterar nenhum arquivo de `src/` para "facilitar teste" — se algo não for testável, reportar em vez de refatorar por conta própria. Não usar banco real nem SMTP real: nenhum teste abre socket. Sem testes de frontend (TASK-FRONTEND-013). Sem E2E — explicitamente fora do escopo do projeto.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `jest.config.ts` | config e thresholds |
| `create` | `tests/setup.ts` | env determinística |
| `create` | `tests/fakes/in-memory-user.repository.ts` | fake de users |
| `create` | `tests/fakes/in-memory-token.repositories.ts` | fakes dos dois tokens |
| `create` | `tests/fakes/fake-mailer.ts` | captura e-mails enviados |
| `create` | `src/domains/auth/services/register-user.service.spec.ts` | HU-01 |
| `create` | `src/domains/auth/services/confirm-email.service.spec.ts` | HU-02 |
| `create` | `src/domains/auth/services/refresh-session.service.spec.ts` | HU-04 |
| `create` | `tests/integration/auth-routes.spec.ts` | contrato HTTP |
| `modify` | `package.json` | deps e script test |
| `modify` | `../../sonar-project.properties` (raiz do repo) | sources e cobertura |

---

## Implementation

> **Reference pattern**: as interfaces de repositório declaradas em `src/domains/auth/repositories/` (TASK-BACKEND-004/005) e a `MailerPort` (TASK-BACKEND-003) — são elas que tornam os fakes possíveis sem mockar Prisma nem Nodemailer.

### `jest.config.ts` *(create)*
- `preset: 'ts-jest'`, `testEnvironment: 'node'`, `roots: ['<rootDir>/src', '<rootDir>/tests']`.
- `moduleNameMapper: { '^~/(.*)$': '<rootDir>/src/$1' }` — sem isso o alias `~/` não resolve sob Jest.
- `setupFilesAfterEach`/`setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']`.
- `collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/*.d.ts', '!src/**/*.routes.ts', '!src/**/*.spec.ts']` — `index.ts` (listen) e arquivos de rota (declaração pura) não têm lógica a cobrir e distorceriam a métrica.
- `coverageThreshold` global em 80 para statements/branches/functions/lines; `coverageReporters: ['text', 'lcov']` — o `lcov` é o que o Sonar consome.

### `tests/setup.ts` *(create)*
- Define as env vars determinísticas antes de qualquer import de `~/config/env`: `JWT_ACCESS_SECRET` fixo de 32+ chars, `RATE_LIMIT_ENABLED=false`, `BCRYPT_COST=4` (custo 12 tornaria a suíte lenta demais; o custo real é responsabilidade da config, não do teste), TTLs conhecidos.
- Congelar o tempo por padrão com `jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'))` — os TTLs de 24 h e 7 dias precisam ser determinísticos.

### `tests/fakes/*.ts` *(create)*
- Implementações em memória das **interfaces** `UserRepository`, `EmailConfirmationTokenRepository`, `RefreshTokenRepository` (array interno + os mesmos contratos de retorno, incluindo o `count` do compare-and-swap) e `FakeMailer implements MailerPort` acumulando as mensagens em `sentMessages`.
- Os fakes precisam reproduzir fielmente dois comportamentos, senão os testes passam e a produção quebra: (1) `consume`/`markRotated` retornam `0` quando o registro já estava consumido/revogado; (2) `revokeFamily` afeta **todos** os registros do `familyId` ainda não revogados.
- **Não** usar `jest.mock` de módulo para os repositórios — o ponto de usar interfaces é injetar implementação real de teste.

### Specs unitários dos services *(create)*
- Um `describe` por service; cada `it` nomeado pelo ID do caso de teste da spec, para rastreabilidade direta — ex.: `it('CT-15: reutilização de refresh token rotacionado encerra a sessão', ...)`.
- `register-user.service.spec.ts` cobre CT-01, CT-02, CT-04, CT-18 + o ramo de falha de SMTP (cadastro permanece criado e o service não lança).
- `confirm-email.service.spec.ts` cobre CT-06, CT-07, CT-08, o token inexistente, e a corrida (`consume` retornando 0 ⇒ "já utilizado").
- `refresh-session.service.spec.ts` cobre CT-14, CT-15, refresh expirado, conta desativada, e — o teste mais importante do slice — **verifica que após reuso nenhum token da família permanece utilizável**: todos com `revokedAt != null`, os que ainda estavam ativos com `revokedReason = 'REUSE_DETECTED'`, e os já revogados preservando o motivo original (o token reapresentado permanece `ROTATED`). Verificar também que o token legítimo mais recente passa a ser rejeitado — é ele que prova que a sessão inteira caiu.
- Padrão AAA explícito; asserções sobre a mensagem PT-BR literal quando ela é o contrato.

### `tests/integration/auth-routes.spec.ts` *(create)*
- `supertest` contra o `app` importado de `~/app` — é isto que exige que `app.ts` não chame `listen` (TASK-BACKEND-001).
- Prisma dublado com `jest-mock-extended` (`mockDeep<PrismaClient>()`) ou com os fakes injetados via fábrica; mailer sempre `FakeMailer`.
- Cobre o **contrato HTTP**, não a regra (já coberta nos unitários): status codes, `code` e `message` exatos do envelope de erro, presença de `details` só em `VALIDATION_ERROR`, presença e flags do `Set-Cookie` no login, limpeza do cookie no logout, e `401` uniforme nos quatro modos de falha do refresh.
- Incluir explicitamente o teste que compara as respostas de CT-11 e CT-12 e assegura que são **byte a byte idênticas**.

### `package.json` *(modify)*
- Dev deps: `jest@^29`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `jest-mock-extended`.
- Scripts: `test` (`jest`), `test:cov` (`jest --coverage`), `test:watch`.

### `sonar-project.properties` *(modify — raiz do repositório)*
- Acrescentar `sonar.sources=services/backend/src,services/frontend/src`, `sonar.tests=services/backend/tests,services/frontend/tests`, `sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/prisma/migrations/**`, `sonar.test.inclusions=**/*.spec.ts,**/*.spec.tsx`, `sonar.javascript.lcov.reportPaths=services/backend/coverage/lcov.info,services/frontend/coverage/lcov.info`.
- Declarar os dois caminhos de cobertura já agora evita ter que reabrir este arquivo na TASK-FRONTEND-013; o Sonar ignora relatório ausente.

---

## Acceptance Criteria

- [ ] **Given** a suíte completa, **When** `npm run test:cov`, **Then** todos os testes passam e as quatro métricas de cobertura ficam ≥ 80% — o comando **falha** se qualquer uma cair abaixo.
- [ ] **Given** a suíte, **When** executada duas vezes seguidas e em ordem aleatória, **Then** o resultado é idêntico (sem dependência de ordem, relógio real ou estado compartilhado).
- [ ] **Given** a suíte, **When** executada sem rede e sem `DATABASE_URL` real, **Then** passa integralmente — nenhum teste abre conexão de banco ou SMTP.
- [ ] **Given** os nomes dos testes, **When** listados, **Then** existe pelo menos um `it` referenciando cada um dos IDs CT-01, CT-02, CT-04, CT-06, CT-07, CT-08, CT-09, CT-10, CT-11, CT-12, CT-13, CT-14, CT-15, CT-18.
- [ ] **Given** o teste de reuso de refresh token, **When** executado, **Then** afirma que **todos** os registros do `familyId` ficaram com `revokedAt != null` — os que estavam ativos com `revokedReason = 'REUSE_DETECTED'` e os já revogados preservando o motivo original — e que o token legítimo mais recente também passa a ser rejeitado.
  > **Nota (corrigido em 2026-08-22):** a redação anterior exigia `REUSE_DETECTED` em *todos* os tokens. Isso é incompatível com o `revokeFamily` implementado na TASK-BACKEND-005 (`where: { familyId, revokedAt: null }`), cuja AC #7 foi corrigida pelo mesmo motivo: o token que dispara a detecção já está revogado como `ROTATED` e o filtro o exclui por construção. Um teste escrito na letra anterior falharia contra a implementação já validada, ou levaria a "corrigir" código correto — sobrescrever o `ROTATED` destruiria a informação de que aquele token foi legitimamente rotacionado.
- [ ] **Given** os testes de CT-11 e CT-12, **When** comparadas as respostas, **Then** status, `code` e `message` são idênticos.
- [ ] **Given** `npm run test:cov`, **When** concluído, **Then** `coverage/lcov.info` existe e é referenciado por `sonar.javascript.lcov.reportPaths`.
- [ ] **Given** o Quality Gate do Sonar, **When** executado, **Then** aprova sem bloqueadores e sem issue de segurança Blocker/Critical.
- [ ] Nenhum arquivo de `src/` foi alterado por este slice.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 a TASK-BACKEND-006 concluídas (todo o comportamento sob teste precisa existir).
- **Blocks**: nenhuma task de implementação. É o portão de qualidade do backend antes da integração com o frontend.
