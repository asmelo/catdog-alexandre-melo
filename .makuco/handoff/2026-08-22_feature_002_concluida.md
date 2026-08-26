# FEATURE-002 — Autenticação Completa: encerramento

**Data**: 2026-08-22
**Estado**: **13 de 13 tasks concluídas e commitadas.** 19 commits, todos locais.

---

## Não existe próxima task

Verificado: `.makuco/specs/module_001_autenticacao/feature_001_.../tasks/` está **vazio**
(a FEATURE-001 foi superada pela 002), e as demais features previstas em
`.makuco/product/scope_features_context.md` — cadastro de pets, vitrine, filtragem,
pedidos, fluxo de processo — **não têm nenhum arquivo de task escrito**.

Gerar essas tasks é trabalho de especificação (`makuco-specify` / `makuco-prompt`) e
envolve decisão de escopo e produto. **Não foi feito**, porque implementar feature sem
task especificada seria inventar contrato.

---

## Verificação final executada nesta sessão

| Verificação | Resultado |
|---|---|
| Backend: suíte | **138 testes, 15 suítes** · 99,47% / 93,75% / 100% / 99,47% |
| Frontend: suíte | **160 testes, 12 suítes** · 99,74% / 98,68% / 100% / 99,74% |
| Backend: typecheck + build | 0 erros |
| Frontend: typecheck + build | 0 erros |
| Smoke ponta a ponta no Supabase real | **10 de 10** |

O smoke exercitou o fluxo inteiro da feature contra o banco real: registro (HU-01) →
confirmação por e-mail (HU-02) → login (HU-03) → `/me` autenticado (RN-10) → rotação de
refresh (HU-04 / RN-06) → detecção de reuso (RN-07), confirmando que a família reusada é
inteiramente revogada **e** que uma sessão não relacionada permanece ativa.

Banco ao final: **0 usuários, 0 refresh tokens** — nada ficou para trás.

---

## Pendências que exigem decisão ou acesso humano

### 1. Não existe remote (bloqueia o CI)

Os 19 commits são locais. O workflow `.github/workflows/backend-ci.yml` está correto e
foi testado localmente, mas **nunca executou** — não há repositório remoto.

### 2. `SONAR_TOKEN` precisa ser rotacionado

Vazou em texto claro pela mensagem de erro do MCP `sonar-run`, que ecoa o `docker run`
completo. Documentado em `2026-08-20_bug_makuco_mcp_sonar_run.md`.

### 3. Quality Gate do Sonar nunca executou (9 tasks seguidas)

`sonar.anymarket.vpc:9000` não responde — a rota chegou a existir via `tun0`, mas o
handshake TCP expira. Nenhuma métrica de Sonar foi citada em nenhum checklist, por
decisão de honestidade.

**O escopo do `sonar-project.properties` foi corrigido nesta sessão** (frontend incluído
em `sonar.sources`/`sonar.tests`, mais o `index.html`, que fica fora de `src/`), mas
**NÃO foi validado por scan real** — diferente do commit `5d69a2e`, que foi. Validado
apenas: sintaxe de properties e existência dos 5 caminhos. **Rodar o scanner é o primeiro
passo quando o servidor voltar.**

Comando que funciona nesta máquina:

```bash
docker run --rm --network host \
  -e SONAR_HOST_URL=http://sonar.anymarket.vpc:9000 -e SONAR_TOKEN="$SONAR_TOKEN" \
  -e SONAR_USER_HOME=/tmp/sonar-cache -v /tmp/sonar-cache:/tmp/sonar-cache \
  -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli
```

Sem `--user` (a imagem redireciona o working dir para `/tmp/.scannerwork`, do uid 1000) e
com o cache em `chmod -R a+rwX`. Primeira execução ~20 min.

### 4. Conta Gmail com App Password — bloqueia homologação

Sem `MAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD`, **o e-mail de
confirmação não sai**. O cadastro responde 201 e a falha vai para o log, por desenho
(AC #7 da TASK-BACKEND-004) — o efeito prático é que **o usuário se cadastra e nunca
recebe o link**, sem nada quebrar visivelmente. A RNF-06 (identidade visual do e-mail) e
a AC #10 da TASK-BACKEND-003 seguem não homologadas.

Recomendado também criar `MAIL_SUPPORT_ADDRESS`: hoje o `supportEmail` do template
reaproveita `MAIL_FROM_ADDRESS` por falta de variável própria (DECISÃO-018).

### 5. Administrador não existe no banco — RESOLVIDO em 2026-08-24

`SEED_ADMIN_EMAIL=admin@catdog.com` e `SEED_ADMIN_PASSWORD` foram gravadas em
`services/backend/.env` (não versionado) e o seed rodou contra o Supabase: existe hoje
exatamente um `role=ADMIN`, `status=ACTIVE`, `id=f096917d-68d7-47c4-aa92-854b47688962`.

A causa da pendência era só a ausência das duas variáveis — `credenciaisDoAdmin()` aborta
antes de qualquer escrita quando elas faltam. Para reprovisionar (o `upsert` é idempotente
e reafirma senha, role e status, servindo para recuperar acesso perdido):

```bash
cd services/backend && nvm use 20
npm run db:seed
```

### 6. Fila de refresh é por aba

Duas abas renovando no mesmo instante ainda derrubam a família (RN-07). A mitigação seria
`BroadcastChannel` ou Web Locks. Não é cenário raro: é o usuário com o app aberto em duas
abas.

---

## Débitos técnicos registrados (nenhum bloqueia)

| Item | Onde |
|---|---|
| JSON malformado e corpo > 10 kB respondem **500** em vez de 400/413 | `error-handler.middleware.ts` não trata `SyntaxError` do body-parser. Coberto por teste que afirma o comportamento **atual** |
| `/me` devolve `status` MAIÚSCULO e `role` minúsculo | Assimetria de contrato; normalizar é mudança de contrato |
| Variável de ambiente ausente reporta `Required` em inglês | `.min(1, 'e obrigatoria')` só vale para chave presente e vazia |
| `hairline` e anel de foco divergem do mockup | Deliberado, por WCAG: `#e4e2f0` dava 1,20:1 e o anel a 10% dava 1,16:1. Ver TASK-FRONTEND-009 |
| Nenhum ESLint em nenhum dos dois serviços | O único guarda de estilo é o `tsc` estrito. O checklist da TASK-BACKEND-007 cita um `npm run lint` que não existe na árvore |
| `npm audit`: 4 vulnerabilidades no frontend | Todas nas majors que o `stack.md` prescreve (Vite 5, React Router 6). As de `vite` afetam só o dev server |
| Submit por `dispatchEvent` burla a trava de duplo envio | Nenhuma interação humana produz esse evento. A trava correta seria `if (autenticando) return;` no início do handler |

---

## Bugs do ferramental Makuco a reportar

Documentados em `2026-08-20_bug_makuco_mcp_sonar_run.md`, e vale acrescentar:

- **`sonar-run`**: monta `docker run` sem `--network host`; ecoa o `SONAR_TOKEN` em claro
  na resposta; `targetPath` é sempre ignorado (o schema declara `targetPath`, o handler
  desestrutura `target`); e o mount fixo `-v /tmp/empty-mysql:/usr/src/mysql` cria um
  diretório `mysql/` **root-owned** na raiz do repositório.
- **`complexity-check`**: devolveu medição vazia (`filePath: ""`,
  `functionName: "Não identificado"`, zeros) em **todas** as tentativas, nos dois
  serviços.
- **`quality-check`**: monta `npx eslint eslint --fix ...` — binário duplicado e `--fix`
  **incondicional**, ou seja, uma chamada de *verificação* reescreveria fontes.
