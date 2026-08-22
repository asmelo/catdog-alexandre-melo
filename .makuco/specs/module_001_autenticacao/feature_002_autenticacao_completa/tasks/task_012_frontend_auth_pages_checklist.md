# Makuco Codegen Checklist: TASK-FRONTEND-012 — Telas de login, cadastro e confirmação de conta

**Purpose**: Validar as quatro telas do fluxo de autenticação, as duas homes mínimas, o catálogo de textos e as funções de validação, mais a substituição dos placeholders no roteador. Cada item abaixo reflete uma verificação **efetivamente executada**; o que não foi executável neste ambiente está marcado `[~]` (não aplicável) ou `[!]` (bloqueado) com a justificativa, e **nunca** como concluído.
**Created**: 2026-08-22
**Feature**: [spec_context.md](../spec_context.md)
**Prompt Plan**: [task_012_frontend_auth_pages.md](./task_012_frontend_auth_pages.md)

**Legenda**: `[x]` verificado e aprovado · `[~]` não aplicável a este slice (com justificativa) · `[!]` bloqueado por ambiente (com justificativa)

**Ambiente de verificação**: Node **v20.20.2** / npm **10.8.2** (`nvm use 20`, coerente com `.nvmrc` e com `engines: {node: ">=20 <21"}`). Backend **real** compilado (`npm run build` → porta 3333) contra o **Supabase real**, com `RATE_LIMIT_ENABLED=false` para que as ACs medissem `401`/`403`/`409` e não `429`. Frontend no dev server do Vite (5173) com proxy de mesma origem e **`StrictMode` ligado**. Navegador Chromium via Playwright. Nenhuma dependência foi adicionada ao `package.json`.

> **Leia primeiro — os cinco fatos que mais importam neste checklist:**
>
> 1. **Os 16 critérios de aceite foram comprovados por verificação executável no navegador**, ponta a ponta contra o backend real, com dois perfis reais (`cliente` e `admin`, a role promovida no banco).
> 2. **A obrigação herdada da TASK-FRONTEND-011 (PENDÊNCIA-E) está cumprida e provada nas duas direções**: `readRedirectTarget` é usado, um `state.from` legítimo é honrado e um `state.from` hostil é descartado em favor da home da role. Detalhe na seção *Security Check*.
> 3. **A guarda de `StrictMode` da tela de confirmação foi provada por experimento controlado**, não por inspeção: com a guarda, **1** chamada a `POST /auth/confirm-email`; com a guarda temporariamente neutralizada, **2** chamadas (`200` seguido de `409`) e a tela exibindo o falso "Este link de confirmação já foi utilizado.". O arquivo foi restaurado byte a byte (`diff` idêntico).
> 4. **A cobertura automatizada é 0%** — é escopo da TASK-FRONTEND-013. As 56 asserções do harness de funções puras e as medições no navegador são reprodutíveis mas **não versionadas**. Ver RISCO-A.
> 5. **SonarQube inacessível** e **`complexity-check` devolveu medição vazia**. Nenhuma métrica desses dois é citada em lugar algum deste documento.

---

## Quality Tools

- [x] **Compilador**: `npm run build` (`tsc --noEmit && vite build`) → **0 erros**, executado 3 vezes (após a implementação, após a restauração do experimento e após o ajuste de comentários). 67 módulos transformados.
- [~] **Linters**: o projeto **não tem ESLint nem Prettier** — não há `.eslintrc*`, `eslint.config*` nem `.prettierrc*`, e `eslint` não consta das dependências de `services/frontend/package.json`. O `quality-check` do MCP é baseado em ESLint e portanto não tem o que executar. A verificação de estilo disponível é o compilador em modo estrito, acima. Não é lacuna introduzida por esta task.
- [x] **Rigor do compilador confirmado por inspeção do código**: zero ocorrências de `any`, `as any`, `@ts-ignore` e `@ts-expect-error` nos nove arquivos (grep sobre `src/`). O `tsconfig.json` em vigor tem `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` e `noFallthroughCasesInSwitch`.
  - **Divergência de premissa registrada**: o `tsconfig.json` **não** tem `exactOptionalPropertyTypes` (conferido no arquivo). O código foi escrito como se tivesse — nenhuma prop opcional recebe `undefined` explícito; a passagem de erro de campo usa `errosDeCampo.campo ?? ''`, apoiada no contrato já documentado do `TextField` ("trata string vazia como ausência de erro"). Ligar a flag no futuro não exigirá mudança nestes arquivos. O `tsconfig.json` não foi alterado por estar fora da tabela *Files*.
- [!] **SonarQube**: bloqueado. `sonar-run` falhou com `Failed to query server version: Call to URL [http://sonar.anymarket.vpc:9000/api/v2/analysis/version] failed: null` — o host não é alcançável deste ambiente, como nas TASK-BACKEND-004 a TASK-FRONTEND-011. **Nenhuma métrica de Sonar é citada neste documento.**
- [!] **`complexity-check` (MCP)**: executado sobre `services/frontend/src` com limiar 10 e devolveu **medição vazia** (`filePath: ""`, `functionName: "Não identificado"`, todas as métricas em 0) — o mesmo defeito registrado nas tasks anteriores. Não serve como evidência e nenhum número dele é citado. A verificação de tamanho/ramificação foi feita por leitura (ver *Code Quality*).
- [x] **Harness de funções puras**: 56 asserções, **56 passaram, 0 falharam**. As funções foram empacotadas com o esbuild do próprio projeto (alias `~/` resolvido) e exercitadas em Node, sem React nem navegador. **Não versionado** — ver RISCO-A.

---

## Code Quality

- [x] **Segue os padrões do projeto**: `PascalCase` no componente exportado e `kebab-case` no arquivo; identificadores internos em PT-BR e API exportada em inglês (`validateLoginForm`, `hasFieldErrors`), como em `homePathForRole`/`fieldErrorsOf`; import de tipo por `import type`; comentário explicando o *porquê* da decisão e não o *que* o código faz.
- [x] **Livre de erros de compilação** — ver *Quality Tools*.
- [x] **Nenhum componente de UI novo foi criado.** As telas montam exclusivamente `AuthCard`, `TextField`, `PasswordField`, `SubmitButton`, `AlertMessage` (TASK-FRONTEND-009). O botão secundário de reenvio da tela de login e os botões-link são elementos locais de página, no mesmo padrão que os layouts da TASK-FRONTEND-011 já usam para o botão "Sair" — não são abstrações de design system e não vivem em `src/components/ui/`.
  - **Nada faltou** no design system para cumprir os 16 critérios. Registro para a próxima task: um `<button>` secundário e um `<a>` com aparência de botão aparecem agora em três páginas com classes repetidas; se surgir um quarto uso, promovê-los a componente passa a valer mais do que a duplicação. Não foi feito aqui por ser explicitamente fora do escopo.
- [x] **Nenhuma cor literal introduzida.** Grep por `#RRGGBB` nos nove arquivos: zero ocorrências (as únicas do `src/` estão no SVG do logo e em comentários de arquivos das tasks 009/011). Toda cor vem de token (`brand-*`, `ink*`, `surface-*`, `hairline`, `shadow-focus-ring`), preservando os ajustes de acessibilidade das TASK-FRONTEND-009 e 011.
- [x] **Sem duplicação de texto entre cliente e servidor.** O catálogo cobre apenas texto estático e validação local. Verificado por asserção: nenhuma das seis mensagens que a API devolve ("E-mail ou senha incorretos.", "Este e-mail já está em uso.", "Sua conta ainda não foi confirmada…", "Conta confirmada!…", "Este link de confirmação expirou…", "…já foi utilizado.") existe em `MESSAGES`. As telas exibem `ApiError.message` / `MessageResponse.message`.
  - Os oito literais que **são** replicados do backend estão isolados numa constante à parte (`TEXTOS_COMPARTILHADOS_COM_O_BACKEND`) com a justificativa individual de por que cada um é necessário sem resposta da API. Não é duplicação por descuido, é duplicação nomeada e delimitada.
- [x] **Sem GOD classes/métodos/arquivos** (por leitura, já que o `complexity-check` não mediu). O maior arquivo é `confirm-email-page.tsx` (247 linhas, das quais ~90 de comentário). As funções de decisão são curtas e de retorno antecipado: `tratarFalhaDeLogin` tem 3 ramos, `estadoDaFalha` 3, `tituloDoEstado` 3, `aoSubmeter` (login) 2 mais o `try/catch`. Nenhum `switch` nem ternário encadeado.
- [x] **Ramificação por `code`, nunca por `message` nem por `status`**, nas três telas que tratam erro — o contrato definido pelo `ApiError` da TASK-FRONTEND-010.
- [x] **Nenhum arquivo fora da tabela *Files* foi tocado.** `git status`: 8 arquivos novos + `app-routes.tsx` modificado + este checklist. Guardas, layouts, componentes, cliente HTTP, `tailwind.config.js`, `tsconfig.json`, `services/backend/` e `sonar-project.properties` intactos.
- [x] **Os 7 marcadores `TODO(TASK-FRONTEND-012)` foram removidos** junto com os seis placeholders, os parágrafos de diagnóstico e os `data-testid` (PENDÊNCIA-G da 011). Grep por `TODO|FIXME|XXX|HACK` em `src/`: nenhuma pendência. Com eles saiu a futura sinalização do S1135.
- [x] **Risco de falso positivo S1135 tratado preventivamente**: as duas ocorrências de "todo" (masculino singular) que eu havia escrito em comentários foram reescritas ("de todo modo" → "mesmo assim"; "todo `to` aqui" → "cada `to` aqui"). Zero ocorrências restantes nos nove arquivos. É o mesmo falso positivo já corrigido sete vezes neste projeto.
- [x] **A estrutura de rotas não mudou** — apenas os elementos das folhas. É o que mantém válidas as 23 medições de guarda da TASK-FRONTEND-011 sem refazê-las.
- [ ] **Cobertura de testes ≥ 80%: NÃO ATENDIDO — a cobertura automatizada é 0%.** Não há framework de teste instalado no frontend e a suíte é escopo declarado da TASK-FRONTEND-013 ("Sem testes" consta do *Scope/Out* desta task). Marcado como não atendido em vez de `[~]` porque é uma lacuna real do repositório, e não uma pergunta inaplicável.

---

## Security Check

- [x] **OBRIGAÇÃO HERDADA DA TASK-FRONTEND-011 (PENDÊNCIA-E) — CUMPRIDA.** O destino pós-login é `readRedirectTarget(location.state, homePathForRole(usuario.role))`.
  - **Prova no código**: `readRedirectTarget` é importado e chamado em `login-page.tsx:146`. Grep em `src/`: **nenhuma** leitura crua de `state.from` fora da própria implementação da função em `route-paths.ts:135`. Existem exatamente dois `navigate()` nas páginas — um recebe o destino revalidado, o outro uma constante de `ROUTE_PATHS`.
  - **Prova de que o valor legítimo é honrado** (e não engolido pelo fallback): visitante anônimo abriu `/admin/relatorios?periodo=2026`; a guarda gravou `history.state.usr = { from: "/admin/relatorios?periodo=2026" }`; após o login como `admin` o navegador terminou em **`/admin/relatorios?periodo=2026`** — e não em `/admin`, que é a home da role. Isso também descarta empiricamente a corrida que eu suspeitava entre o `navigate` da tela e o `PublicOnlyRoute`.
  - **Prova de que o valor hostil é descartado**: injetei `{ from: "/\\evil.com" }` — o vetor exato da GHSA-wrjc-x8rr-h8h6 — diretamente em `history.state.usr`, na forma que o react-router lê, e recarreguei a página; o `state` **sobreviveu à recarga** (confirmando que o cenário descrito no comentário é real, não hipotético). Após o login, o destino foi **`http://localhost:5173/admin`**, com `location.origin` inalterado. O open redirect não é alcançável pelo caminho do consumidor.
  - **Tabela hostil completa** exercitada contra a função no harness: `//evil.com`, `/\evil.com`, `/\t\evil.com`, `/\n//evil.com`, `/\r\evil.com`, `https://evil.com`, `http://evil.com`, `javascript:alert(1)`, `data:text/html,…`, `evil.com`, `\\evil.com`, `/ /evil.com`, `''`, `/` — **14 vetores, todos reduzidos ao fallback**; mais 8 formas de `state` inválido (`null`, `undefined`, string crua, número, objeto sem `from`, `from` não-string, `from` nulo, array). Dois caminhos internos legítimos preservados, inclusive com query e hash.
- [x] **RN-12 / AC #16 — a confirmação de senha nunca trafega.** Provado inspecionando o corpo da requisição real, não o código: o único `POST /api/auth/register` disparado no cadastro bem-sucedido levou `{"name":…,"email":…,"password":…}`, com `Object.keys(body)` = `["name","email","password"]`. Nenhum corpo de nenhuma requisição da sessão casou com `/confirm/i`. A confirmação vive apenas no estado do formulário e no `RegisterFormValues`, tipo deliberadamente separado do `RegistrationInput` que trafega.
- [x] **RN-05 / RNF-03 — as mensagens de login não revelam existência de e-mail.** Senha incorreta (CT-11) e e-mail inexistente (CT-12) produziram a **mesma** string, `"E-mail ou senha incorretos."`, comparada por igualdade. Em nenhum dos dois casos algum campo recebeu `aria-invalid` ou mensagem — a tela não indica qual campo estaria errado. O botão de reenvio **não** aparece nesses casos: ele é condicionado a `ACCOUNT_NOT_CONFIRMED`, o único código que confirma que a conta existe.
  - Consequência considerada: a validação local de login **não** aplica o mínimo de 8 caracteres, de propósito. Uma senha curta recebe "E-mail ou senha incorretos." como qualquer credencial errada, em vez de um erro de validação que informaria o formato aceito a quem sonda. Mesma decisão do `loginSchema` do backend, e coberta por duas asserções.
- [x] **Nenhum segredo no código.** Sem chave, token ou credencial nos nove arquivos. As credenciais do harness de e-mail (`smtp.harness.invalid`, senha de fachada) existiram apenas como variáveis de ambiente na linha de comando, fora do repositório.
- [x] **Nenhum dado da URL é renderizado como conteúdo.** O `token` da query string é usado exclusivamente como corpo de requisição, nunca impresso na tela — ao contrário do placeholder da TASK-FRONTEND-011, que o exibia para diagnóstico. A tela de aviso pós-cadastro **não** exibe o e-mail digitado (nem por `state`, nem por query), o que a mantém fora de uso como refletor de texto arbitrário.
- [x] **Fronteira de validação correta.** A validação do cliente é resposta imediata ao usuário e produz a ausência de requisição exigida pelos CT-03/CT-04; a validação que vale é a do servidor (`auth.validators.ts`). Isso está escrito no topo de `validation.ts` para que ninguém a trate como controle de segurança.
- [x] **`npm audit`: as 4 vulnerabilidades pré-existentes nas majors do `stack.md` não foram corrigidas**, conforme instrução explícita. Nenhuma dependência foi adicionada, removida ou atualizada — `package.json` e `package-lock.json` intactos.
- [!] **Hotspots e vulnerabilidades do SonarQube**: não avaliáveis, servidor inacessível. Não afirmo ausência de achados de uma ferramenta que não executou.

---

## Implementation Completeness

- [x] **Os 9 arquivos da tabela *Files*** foram criados/modificados, e nenhum outro.
- [x] `src/utils/messages.ts` — catálogo `as const`, com os 7 literais do mockup e as frases da tabela da spec conferidos caractere a caractere por asserção.
- [x] `src/utils/validation.ts` — funções puras, sem React, retornando mapa `campo → mensagem` na mesma forma que `fieldErrorsOf` produz (um só estado de erros por tela).
- [x] `src/pages/auth/login-page.tsx` — `<form onSubmit>` real, `readRedirectTarget`, ramificação por `code`, reenvio condicionado a `ACCOUNT_NOT_CONFIRMED`, sem "Esqueceu sua senha?".
- [x] `src/pages/auth/register-page.tsx` — quatro campos na ordem do plano, `autoComplete` correto (`name`, `email`, `new-password`, `new-password`), validação local antes da rede, payload de três campos, formulário preservado no erro.
- [x] `src/pages/auth/check-email-page.tsx` — informativa, sem estado e sem rede.
- [x] `src/pages/auth/confirm-email-page.tsx` — quatro estados em união discriminada, guarda de chamada única, sem chamada quando falta o `token`.
- [x] `src/pages/admin/admin-home-page.tsx` e `src/pages/client/client-home-page.tsx` — mínimas e distinguíveis (título + nome do usuário).
- [x] `src/routes/app-routes.tsx` — placeholders substituídos, imports mortos removidos, comentário de estrutura atualizado.
- [x] **Desvio de desenho registrado**: a guarda de chamada única compara o **token já processado** (`useRef<string | null>`) em vez de usar um booleano, como o plano sugeria. Um booleano bloquearia também a troca legítima de token (segundo link aberto com a página montada e a instância reaproveitada pelo React); comparar o valor bloqueia a repetição e permite o token novo. Comportamento sob `StrictMode` idêntico, e medido.
- [x] **Decisão registrada — a tela de aviso pós-cadastro não tem botão de reenvio.** O reenvio exige o endereço, e pedi-lo a quem acabou de se cadastrar sugere que o cadastro falhou. Ele existe nos dois lugares com motivo concreto: login com conta pendente e confirmação com link expirado. Ambos verificados em execução.
- [x] **Decisão registrada — três títulos na tela de confirmação** ("Confirmando sua conta", "Conta confirmada", "Não foi possível confirmar") em vez de um fixo. O `AuthCard` monta o único `<h1>` da página, que é a primeira coisa anunciada pelo leitor de tela; um título fixo obrigaria o usuário a ouvir o corpo para saber o desfecho.
- [x] **Rótulos e placeholders da tela de cadastro são extrapolação declarada.** O `reference.html` só cobre o login. Seguem a forma dos dois placeholders que ele define ("Informar o seu…") para que as telas não pareçam escritas por pessoas diferentes. Nenhum literal da spec foi inventado.

---

## Testing and Validation

### Os 16 critérios de aceite — todos comprovados por execução

| # | Critério | Como foi comprovado |
|---|---|---|
| 1 | Textos do mockup presentes; "Esqueceu sua senha?" ausente | Os 5 textos por `innerText` e os 2 placeholders por `input.placeholder`, todos por igualdade. `"Esqueceu sua senha"` ausente do **`innerHTML` inteiro** (ausência no DOM, não ocultação por CSS); busca por `/recuperar|esqueci|forgot/i` também vazia |
| 2 | `admin` → `/admin`; `cliente` → `/minha-area` | Dois logins reais. Admin terminou em `/admin` com `<h1>` "Painel administrativo" e a topbar "Navegação administrativa"; cliente em `/minha-area` com `<h1>` "Minha área" e "Navegação do cliente" (CT-09 / CT-10) |
| 3 | Senha errada **ou** e-mail inexistente → mesma mensagem, sem indicar o campo | Ver *Security Check*: string idêntica nos dois casos, `aria-invalid` ausente nos dois campos, permaneceu em `/login` (CT-11 / CT-12) |
| 4 | Conta não confirmada → mensagem + botão de reenvio | Login de conta `PENDING_CONFIRMATION` exibiu "Sua conta ainda não foi confirmada. Verifique seu e-mail." e o botão "Reenviar e-mail de confirmação". O reenvio foi **clicado**: respondeu com a frase genérica do `202` (CT-13) |
| 5 | Requisição em andamento → botão desabilitado, sem segunda requisição | Resposta atrasada em 2–3 s para tornar o estado observável. Em voo: `disabled=true`, `aria-busy="true"`, rótulo "Aguarde…". **Dois cliques adicionais no botão → 0 requisições novas**; **Enter durante o voo → 0 requisições novas** (o botão padrão desabilitado suprime a submissão implícita). Ver a ressalva medida em RISCO-C |
| 6 | Preencher e submeter só pelo teclado | Cadastro submetido com **Enter** no campo de confirmação (produziu o erro do CT-05) e login concluído com **Enter** no campo de senha, chegando a `/minha-area`. Sem mouse em nenhuma das duas |
| 7 | Senhas diferentes → mensagem e **nenhuma** requisição | "As senhas não coincidem." sob o campo de confirmação, **contador de `fetch` em 0** (CT-03) |
| 8 | 7 caracteres → mensagem; exatamente 8 → requisição enviada | 7 caracteres: "A senha deve ter pelo menos 8 caracteres.", **0 requisições** (CT-04). 8 caracteres ("Abc12345", o literal do CT-18): **1** `POST /api/auth/register` |
| 9 | Nome em branco → mensagem abaixo do campo Nome | "Este campo é obrigatório." em `#register-name-error`, ligado por `aria-describedby`, com `aria-invalid="true"` no input; o parágrafo é o irmão seguinte do wrapper do campo — ou seja, **abaixo dele** (CT-05) |
| 10 | `409` → mensagem e campos preenchidos **permanecem** | "Este e-mail já está em uso." e os **quatro** campos com os valores digitados intactos, verificados um a um por `input.value` (CT-02) |
| 11 | Cadastro concluído → `/verifique-seu-email` com a mensagem | Navegou para `/verifique-seu-email` exibindo "Verifique seu e-mail para ativar sua conta." (CT-01) |
| 12 | Token válido → "Conta confirmada!…" + link para login | Token real extraído do e-mail capturado. Tela: `<h1>` "Conta confirmada", alerta "Conta confirmada! Faça login para continuar." e link para `/login` (CT-06) |
| 13 | `StrictMode` → `POST /auth/confirm-email` exatamente **uma** vez | **1** chamada (`200`), medida no log de rede do navegador, em dois tokens diferentes. Provado como load-bearing pelo experimento controlado descrito no cabeçalho |
| 14 | Token expirado → mensagem + reenvio; já usado → mensagem | Expirado (`expiresAt` recuado 48 h no banco, `410`): "Este link de confirmação expirou. Solicite um novo e-mail de confirmação." + campo de e-mail e botão; o reenvio foi **submetido com Enter** e respondeu com a frase genérica (CT-07). Já usado (`409`): "Este link de confirmação já foi utilizado.", **sem** formulário de reenvio (CT-08) |
| 15 | `/confirmar-email` sem `token` → erro sem chamar a API | "Link de confirmação inválido." com **zero** requisições a `confirm-email` no log de rede (só o `refresh` de bootstrap, alheio à tela) |
| 16 | Nenhuma requisição de cadastro contém a confirmação de senha | Corpo real inspecionado: `["name","email","password"]`. Ver *Security Check* |

### Verificações além dos 16 critérios

- [x] **CT-16 revalidado com as homes reais**: `cliente` autenticado abriu `/admin` e terminou em `/minha-area`; "Painel administrativo" e "Navegação administrativa" **não** existem no `innerHTML`. Era o propósito declarado das homes mínimas — tornar o redirecionamento por role verificável.
- [x] **`PublicOnlyRoute` continua correto com as telas reais**: recarregar `/login` com sessão válida levou à home da role em vez de mostrar o formulário.
- [x] **Logout pelas duas áreas** devolveu à tela de login real, agora sem os parágrafos de diagnóstico dos placeholders.
- [x] **Console do navegador sem exceção de JavaScript** em toda a sessão. As linhas `[ERROR]` do log são registros de status HTTP da camada de rede (os `401`/`403`/`409`/`410` que os próprios casos de teste provocaram) e `ERR_CONNECTION_REFUSED` de antes do dev server subir. Os dois únicos avisos são os *future flags* do react-router, pré-existentes da TASK-FRONTEND-011.
- [x] **Banco limpo ao final**: as 6 contas de teste usaram o sufixo reconhecível `.t012@exemplo.com` e foram apagadas. Estado final medido: **0 usuários, 0 tokens de confirmação, 0 refresh tokens** — igual ao estado inicial.
- [x] **Ambiente limpo**: `.playwright-mcp/` removido da raiz (o diretório é gerado a cada snapshot; já é a quinta ocorrência registrada no projeto) e nenhum `.png`/`.jpg` na raiz. Backend e dev server encerrados após confirmar por `ps` que ambos eram os processos que **eu** iniciei — o `ps` anterior ao início mostrava zero processos Node, portanto nenhum servidor do desenvolvedor foi tocado. Nenhum commit e nenhum push; as mudanças estão no *working tree*.
- [x] **Nenhum arquivo de `services/backend/` foi editado** para obter contas `ACTIVE`. Foi usada a receita já validada nas tasks 010/011: um script de carga substitui `createGmailTransport` no objeto `exports` do módulo **compilado** antes de `dist/index.js` ser requerido, e o transporte falso grava a mensagem em disco. `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD` foram passados por linha de comando — o `dotenv` não sobrescreve `process.env` já preenchido, então o `.env` do desenvolvedor permaneceu intocado. A receita funcionou de primeira, com a correção que a 011 documentou.

### O que NÃO foi verificado

- [ ] **A mensagem "Sua sessão expirou. Faça login novamente." na tela de login não foi exercitada ponta a ponta.** Ela **está implementada** (ramo `logoutReason === 'session-expired'`, cumprindo a nota que o placeholder da TASK-FRONTEND-011 deixou) e o literal está conferido por asserção contra a tabela da spec, mas o caminho que a produz não é alcançável neste ambiente em tempo razoável: `logoutReason` só vale `session-expired` quando um `401` chega **depois** de o bootstrap ter concluído, e nenhuma tela deste slice dispara requisição autenticada. Como o access token é um JWT de 15 minutos, revogar a família no banco não invalida o token em memória — seria preciso esperar a expiração ou ter uma rota autenticada em uso. **Não está entre os 16 critérios desta task**; fica nomeado para a TASK-FRONTEND-013, que pode cobri-lo em teste montando o contexto com `logoutReason` já definido.
- [ ] **Cobertura automatizada: 0%.** Ver RISCO-A.
- [ ] **Acessibilidade**: os atributos que os componentes já garantiam (`aria-invalid`, `aria-describedby`, `role="alert"`, `role="status"`, `<label>` real, `<h1>` único por página) foram observados no DOM das telas novas, mas **nenhuma auditoria automatizada (axe/Lighthouse) foi executada** e **nenhum contraste novo foi medido** — nenhuma cor nova foi introduzida, então os valores medidos nas tasks 009 e 011 continuam valendo sem recálculo.
- [ ] **Navegador único**: apenas Chromium via Playwright. Nada foi verificado em Firefox ou WebKit.

---

## Riscos e pendências

- **RISCO-A — cobertura automatizada 0%.** As 56 asserções do harness e as medições no navegador **não são versionadas**: nada impede uma regressão futura na guarda de `StrictMode`, na tabela hostil de `readRedirectTarget`, na preservação dos campos no `409` ou na ausência de requisição nos CT-03/CT-04. Fechar isso é a TASK-FRONTEND-013.
- **RISCO-B — os casos de maior valor para a TASK-FRONTEND-013**, por quebrarem em silêncio: (1) a guarda de chamada única do `confirm-email`, cujo defeito se manifesta como uma mensagem *plausível* e não como um erro; (2) `validateRegisterForm` com a precedência obrigatoriedade → formato → tamanho → igualdade (é a ordem que decide se o usuário vê a mensagem certa); (3) o `catch` do cadastro **não** limpar os campos; (4) o consumo de `readRedirectTarget` com `state` hostil; (5) a ausência do mínimo de 8 caracteres na validação de login.
- **RISCO-C — a submissão programática por evento `submit` sintético não é barrada pelo botão desabilitado.** Medido: dois cliques no botão em voo produziram 0 requisições novas, e Enter também; mas um `form.dispatchEvent(new Event('submit'))` disparado por JavaScript passou e gerou uma segunda requisição de login. **Nenhuma interação humana produz esse evento** — o usuário submete por clique (barrado pelo `disabled`) ou por Enter (a submissão implícita do HTML passa pelo botão padrão, também barrado), e a AC #5 fala de clicar novamente. Registro porque um teste automatizado escrito com `dispatchEvent` mediria o contrário e pareceria acusar um defeito. Se um dia o formulário passar a ser submetido por código, a trava correta é uma guarda no início de `aoSubmeter` (`if (autenticando) return;`), não mais estado no botão.
- **RISCO-D — as duas homes são mínimas por contrato e não são conteúdo de produto.** Existem para tornar o redirecionamento por role verificável. Quem for implementar a área administrativa ou a área do cliente substitui o corpo delas; o `<h1>` e a leitura de `user` são o único contrato que outras verificações (CT-09/CT-10/CT-16) hoje dependem.
- **PENDÊNCIA-E — classes de botão secundário e de botão-link repetidas em três páginas.** Não foram promovidas a componente porque criar componente de UI é fora do escopo desta task. No quarto uso, promover.
- **PENDÊNCIA-F — `exactOptionalPropertyTypes` não está no `tsconfig.json`**, ao contrário do que a instrução desta task pressupunha. O código dos nove arquivos já está compatível com a flag. Ligá-la é uma decisão de quem puder editar o `tsconfig.json`, e pode acusar código das tasks anteriores.
- **PENDÊNCIA-G — o frontend não tem ESLint nem Prettier.** O `quality-check` do MCP fica sem efeito neste serviço (o backend tem os seus). Enquanto isso, o único guarda de estilo é o compilador em modo estrito.
- **RISCO-H — SonarQube inacessível desde a TASK-BACKEND-004.** Oito tasks seguidas sem análise estática de terceiro. Nada neste slice foi validado por ele.

---

## Notes

- **`RATE_LIMIT_ENABLED=false` foi usado nos testes de comportamento, deliberadamente.** Os limites reais medidos no backend (`login` 5/15 min por IP+e-mail, `register` 5/60 min por IP, `resend` 3/60 min por IP+e-mail) fariam as tentativas repetidas de credencial errada devolverem `429 TOO_MANY_REQUESTS` no lugar do `401` que a AC #3 exige — o teste mediria o limitador, não a tela. O `429` **não** foi exercitado nesta task; a tela o trata no mesmo ramo final que exibe `ApiError.message`, o que é comportamento herdado do contrato e não verificado aqui.
- **Contas de teste usadas** (todas removidas): `cliente.t012@` (cadastrada pela própria tela, confirmada pela rota real, role `cliente`), `admin.t012@` (role promovida a `ADMIN` no banco), `pendente.t012@` (mantida `PENDING_CONFIRMATION` para a AC #4), `expirado.t012@` (token recuado 48 h para o CT-07) e duas contas descartáveis do experimento de `StrictMode`.
- **O `StrictMode` permanece ligado** em `main.tsx`, intocado. Desligá-lo faria a AC #13 passar por acidente e esconderia a regressão em vez de evitá-la — foi justamente com ele ligado que o duplo consumo de token pôde ser medido.
