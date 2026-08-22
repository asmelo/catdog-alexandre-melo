# Makuco Codegen Checklist: TASK-FRONTEND-013 — Suíte de testes do frontend

**Purpose**: Validar a suíte de testes do frontend da FEATURE-002 (Jest 29 + jsdom + Testing Library + `babel-jest`, dublês explícitos de `fetch` e do módulo de env). Cada item abaixo reflete uma verificação **efetivamente executada**; o que não foi executável neste ambiente está marcado `[~]` (não aplicável) ou `[!]` (bloqueado) com a justificativa, e **nunca** como concluído. Nenhuma métrica não medida é citada.
**Created**: 2026-08-22
**Feature**: [spec_context.md](../spec_context.md)
**Prompt Plan**: [task_013_frontend_test_suite.md](./task_013_frontend_test_suite.md)

**Legenda**: `[x]` verificado e aprovado · `[~]` não aplicável a este slice (com justificativa) · `[!]` bloqueado por ambiente (com justificativa) · `[ ]` não atendido (com justificativa)

**Ambiente de verificação**: Node **v20.20.2** / npm **10.8.2** (`nvm use 20`, coerente com `.nvmrc` e com `engines: {node: ">=20 <21"}`). Jest **29.7.0** · jest-environment-jsdom **29.7.0** · babel-jest **29.7.0** · @testing-library/react **16.3.2** · @testing-library/user-event **14.6.6** · @testing-library/jest-dom **6.9.1** · identity-obj-proxy **3.0.0** · TypeScript **5.7.x** · Vite **5.4.21** · React **18.3.1** · react-router-dom **6.28.x**. **Nenhuma chamada de rede real** em nenhuma execução — provado, ver AC #2. **Nenhum servidor** (backend, banco, Sonar) foi usado: esta é uma suíte inteiramente de dublês.

> **Leia primeiro — os seis fatos que mais importam neste checklist:**
>
> 1. **Cobertura final medida: 99,74% statements (395/396), 98,68% branches (225/228), 100% functions (115/115), 99,74% lines (393/394).** 12 suítes, **160 testes, 160 passando, 0 falhando**, em ~4,8 s. O comando **falha** abaixo do limite — provado por execução, não assumido.
> 2. **Os 5 specs prescritos pela tabela *Files* NÃO alcançam os 80%, e o número real está registrado**: 62 testes, **60,10% / 56,57% / 59,13% / 59,89%** — as quatro métricas abaixo do limite, `exit 1`. Foi preciso criar **7 specs além da tabela**, registrado como DESVIO-080. Mesmo caminho da TASK-BACKEND-007 (que foi de 60% para 93,75% de branches por desvio análogo).
> 3. **CONFLITO 1 resolvido e a quebra foi reproduzida antes da correção**: sem `exclude` no `tsconfig.json`, `tsc --noEmit` acusa **582 erros** (`Cannot find name 'describe'/'it'/'expect'`) e o `npm run build` para de passar. Com `exclude` + `tsconfig.test.json`, build **0 erros** e `typecheck` **0 erros nos dois projetos**. Ver DESVIO-078.
> 4. **CONFLITO 2: a AC #9 é impossível como escrita, por DUAS causas independentes**, e ambas estão documentadas com precisão na seção *Testing and Validation*. `sonar-project.properties` **não foi editado**, conforme a instrução. AC #9 marcada `[!]`.
> 5. **Os dois testes de concorrência do `http-client` foram validados por MUTAÇÃO CONTROLADA**, não por inspeção: neutralizando a fila single-flight, `POST /auth/refresh` sobe de **1 para 3**; limpando a fila também na falha (o defeito real da TASK-FRONTEND-010), sobe de **1 para 2** e `onSessionExpired` de **1 para 2**. O arquivo foi restaurado e o `git diff` sobre `src/` está **vazio**.
> 6. **SonarQube inacessível** (nona task seguida) e **`complexity-check` devolveu medição vazia**. **Nenhuma métrica desses dois é citada em lugar algum deste documento.**

---

## Quality Tools

- [x] **Compilador / type-check**: `npm run typecheck` (agora com **dois** projetos: `tsc --noEmit` + `tsc -p tsconfig.test.json`) → **0 erros**. As flags estritas do projeto valem também para os specs: `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
  - Percurso honesto: a primeira execução acusou **1 erro** (`TS2345` — o default `rota = ROUTE_PATHS.ADMIN_HOME` inferia o tipo literal `"/admin"` e recusava qualquer outro caminho). Corrigido com anotação explícita `rota: string`, **não** silenciado.
- [x] **Build de produção**: `npm run build` (`tsc --noEmit && vite build`) → **exit 0**, 67 módulos transformados, 3 arquivos em `dist/`.
  - **Nenhum spec no bundle**: `find dist -name "*spec*" -o -name "*test*"` = **vazio**.
  - **Prova de que a suíte não tocou o artefato de produção**: os hashes de conteúdo saíram **idênticos** aos do `dist/` que já existia antes deste slice — `index-BSZelqyX.css` e `index-C3z7PY__.js`. Byte por byte, o bundle é o mesmo.
- [x] **Testes**: `npm run test:cov` → **12 suítes, 160 testes, 160 passando, 0 falhando**, ~4,8 s, **exit 0**. Números de cobertura na seção *Testing and Validation*.
- [~] **Linters**: o repositório **não tem ESLint nem Prettier em nenhum dos dois serviços**. Verificado: não existe `.eslintrc*` nem `eslint.config.*` em nenhum nível (busca em todo o repo, fora de `node_modules`), não há chave `eslintConfig` em nenhum `package.json`, e `eslint` não consta das dependências nem de `services/frontend` nem de `services/backend`. Mesma constatação da TASK-FRONTEND-012. **Não é lacuna introduzida por esta task.**
  - **Observação registrada**: o checklist da TASK-BACKEND-007 cita um `npm run lint` no backend com 28 erros corrigidos; esse script e essa dependência **não existem na árvore hoje** (conferido). A única análise estática disponível no repositório é o compilador em modo estrito.
  - O `quality-check` do MCP foi executado e é coerente com isso: a etapa ESLint falhou com `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` (exit 2) e a etapa `npx tsc --noEmit --allowJs` saiu **exit 0**.
- [!] **SonarQube**: bloqueado, como nas TASK-BACKEND-004 a TASK-FRONTEND-012. Diagnóstico executado nesta task:
  - `getent hosts sonar.anymarket.vpc` resolve (`10.119.10.55`) e existe rota (`10.119.10.55 via 10.200.52.1 dev tun0 src 10.200.52.90`) — a VPN está de pé;
  - `curl --max-time 12` pelo nome e `curl --max-time 25` pelo IP: **os dois `exit 28`, `http=000`** — nenhum handshake TCP;
  - `/dev/tcp/10.119.10.55/9000` com `timeout 10`: **exit 124** (estouro), porta não responde;
  - `sonar-run` (MCP): `EXECUTION FAILURE` — `Failed to query server version: Call to URL [http://sonar.anymarket.vpc:9000/api/v2/analysis/version] failed: null`. O scanner leu `/usr/src/sonar-project.properties` e parou **antes** de indexar qualquer arquivo.
  - **Nenhuma métrica de Sonar é citada neste documento.** `get-sonar-issues` não foi executado porque não há análise a consultar.
- [!] **`complexity-check` (MCP)**: executado sobre `services/frontend/src` com limiar 10 e devolveu **medição vazia** (`filePath: ""`, `functionName: "Não identificado"`, `linesOfCode: 0`, `cyclomaticComplexity: 0`, `tokenCount: 0`) — o mesmo defeito registrado desde a task 007. **Não serve como evidência e nenhum número dele é citado.** A verificação de tamanho e ramificação foi feita por leitura (ver *Code Quality*).
- [x] **`npm audit`**: **4 vulnerabilidades** (1 high, 3 moderate) em `esbuild`, `react-router`, `react-router-dom` e `vite` — as majors fixadas no `stack.md`. **Deliberadamente NÃO corrigidas**, conforme a restrição da task. As 429 dependências acrescentadas por este slice **não introduziram nenhuma vulnerabilidade nova**: o total permanece 4, e os quatro pacotes são os mesmos de antes.

---

## Code Quality

- [x] **Segue o padrão de config do precedente**. `jest.config.ts` do frontend espelha `services/backend/jest.config.ts` no que é comum — `roots` cobrindo os dois lugares com arquivo de teste, `RAIZ_DO_MONOREPO` calculada de `__dirname`, `projectRoot` no reporter de lcov, `coverageThreshold` global em 80, `clearMocks: true`, `testTimeout` folgado, e comentário explicando cada decisão. As divergências são as que o ambiente exige (`testEnvironment: 'jsdom'`, `babel-jest` em vez de `ts-jest`, `moduleNameMapper` com três entradas).
- [x] **Nomeação por ID de caso de teste**, como a task 007 estabeleceu: os `it()` que correspondem a caso da spec começam pelo ID (`CT-09:`, `CT-16:` …). Ver AC #4.
- [x] **Dublês explícitos, nunca implícitos**. `jest.spyOn(globalThis, 'fetch')` com roteador por URL; `jest.mock('~/services/api/auth-api')` onde a tela chama a API direto; dublê do **contexto** (não do provider) onde o objeto de teste é a guarda. Nenhum dublê automático silencioso: `beforeEach` sempre define a implementação, porque o automock devolve `undefined` e a falha apareceria como `Cannot read properties of undefined (reading 'then')` — erro do dublê, não do código.
- [x] **Sem `any`, sem supressão de tipo**. Zero ocorrências de `any`, `as any`, `@ts-ignore` e `@ts-expect-error` nos 18 arquivos criados. As **três** conversões existentes são `as unknown as Response`, nos três construtores de resposta falsa de `http-client.spec.ts` (`respostaJson`, `respostaSemConteudo`, `respostaSemEnvelope`), e estão comentadas: o `jsdom` não implementa a Fetch API e o módulo sob teste lê exatamente três propriedades (`ok`, `status`, `json`).
- [x] **DRY**: `tests/auth-harness.tsx` existe para não duplicar o provider dublado e o monitor de rota em quatro specs (`role-route`, `login-page`, `register-page`, `app-routes`). Cinco cópias divergiriam no primeiro campo novo de `AuthContextValue` — e a divergência apareceria como um teste que passa afirmando o contrato errado. Ver DESVIO-081.
  - No mesmo espírito, o texto da AC #6 vive numa **constante única** (`MENSAGEM_DE_CREDENCIAL_INVALIDA`) consumida pelos dois testes, em vez de duas literais.
- [x] **Nenhum arquivo GOD**. O maior spec é `http-client.spec.ts` com **672 linhas / 24 testes** — e é o arquivo que concentra a regra mais delicada do frontend (fila single-flight, RN-07, trava de sessão encerrada). Ele está dividido em **3 `describe`** por assunto (requisição base, tradução de erro, renovação de sessão) e nenhum teste passa de ~60 linhas. Os outros 11 specs vão de 88 a 434 linhas. Nenhuma função auxiliar tem mais de um nível de aninhamento além do corpo.
- [x] **Nenhuma duplicação de literal de mensagem**. Os specs comparam contra `MESSAGES` (o catálogo de `~/utils/messages`) onde o texto é do catálogo, e contra constante local onde o texto vem da API. Copiar as frases para dentro dos testes criaria uma segunda fonte de verdade — exatamente o que o catálogo existe para evitar.
- [x] **S1135 (falso positivo de "todo")**: varredura executada nos 18 arquivos, **4 ocorrências** de `todo` masculino singular isolado em comentário encontradas (`babel.config.cjs`, `jest.config.ts`, `auth-provider.spec.tsx`, `http-client.spec.ts`) e **todas reescritas** para `cada` / `os acessos` / `os erros`. Nova varredura: **0 ocorrências**. Também **0** marcadores `TODO`/`FIXME`/`XXX`/`HACK`.
- [x] **Zero avisos de React no log da suíte**. A primeira execução acusou um `Warning: An update to AuthProvider inside a test was not wrapped in act(...)` (originado em `aoExpirarSessao?.()` dentro de `executarRenovacao`); corrigido envolvendo a chamada de `refreshSession()` em `act()`, **não** silenciando o console. O aviso não é cosmético: ele sinalizava uma atualização de estado que o teste não esperava, e portanto uma asserção que poderia correr antes do re-render.
  - Permanecem apenas os dois `React Router Future Flag Warning` (`v7_startTransition`, `v7_relativeSplatPath`) — informativos da biblioteca, não do código, e **não** suprimidos: silenciá-los esconderia avisos futuros de verdade.

---

## Security Check

- [x] **Nenhum segredo nos arquivos criados**. Os únicos valores parecidos com credencial são literais evidentes de teste (`'access-token-do-login'`, `'token-de-teste'`, `'SenhaValida1'`, `'Abc12345'`), nenhum deles com forma de segredo real e nenhum lido de ambiente.
- [x] **A proibição de token em storage é TESTADA, não só documentada**. `auth-provider.spec.tsx` percorre **todas** as chaves de `localStorage` e `sessionStorage` após um login bem-sucedido e afirma (a) que os dois estão vazios e (b) que nenhum valor contém o access token — e que o token continua acessível de onde deve estar, a memória do módulo. A verificação é por varredura e não por chave provável (`getItem('accessToken')`), que passaria caso o token fosse gravado com outro nome.
- [x] **A mitigação da GHSA-wrjc-x8rr-h8h6 (open redirect do `react-router@6.30.6`) ganhou suíte própria**. `route-paths.spec.ts` cobre `toInternalPath`, `buildRedirectState` e `readRedirectTarget` com os vetores reais: `https://evil.com`, `evil.com`, `javascript:alert(1)`, `//evil.com`, `///evil.com`, `/\evil.com`, `/admin\..\evil` e os três caracteres que o navegador **remove** antes de resolver a URL (`\t`, `\n`, `\r`) mais espaço. Também afirma que `readRedirectTarget` **revalida** em vez de confiar no `state` de navegação — que é dado de entrada, preservado pelo `history` entre recargas.
- [x] **Defesa contra enumeração de contas verificada estruturalmente**. CT-11 e CT-12 asseguram a mesma frase por **construção** (constante compartilhada), não por atenção do leitor. Uma divergência de um único caractere entre os dois casos é impossível de introduzir sem editar a constante, que serve aos dois.
- [x] **`fieldErrorsOf` testado contra poluição de protótipo**. `api-error.spec.ts` passa `field: '__proto__'` e afirma que o resultado tem uma **propriedade de dados** com esse nome, que `Object.prototype` **não** foi contaminado e que o protótipo do mapa continua sendo `Object.prototype` — provando a escolha de `Map` + `Object.fromEntries` sobre escrita direta em objeto literal.
- [x] **CA-10 (nenhum controle administrativo na área do cliente) afirmado por ausência no DOM**, incluindo uma varredura de **todos** os `<a>` renderizados confirmando que nenhum `href` contém `/admin`. Detalhe na AC #5.
- [x] **Nenhuma vulnerabilidade nova**: `npm audit` permanece em 4, nos mesmos quatro pacotes de antes deste slice.
- [~] **Hotspots e vulnerabilidades do SonarQube**: não avaliáveis — servidor inacessível (ver *Quality Tools*). Nada é afirmado sobre eles.

---

## Implementation Completeness

- [x] **Os 10 arquivos da tabela *Files* foram entregues**, com os conteúdos prescritos:

  | Ação | Caminho | Situação |
  |---|---|---|
  | create | `jest.config.ts` | jsdom, `babel-jest`, 3 entradas de `moduleNameMapper`, `collectCoverageFrom` prescrito, thresholds 80 |
  | create | `babel.config.cjs` | `preset-env` (`node: 'current'`), `preset-react` (`runtime: 'automatic'`), `preset-typescript` |
  | create | `tests/setup.ts` | `jest-dom`, `cleanup`, reset do access-token-store, reset dos registros do `http-client`, **guarda de rede** |
  | create | `tests/env-mock.ts` | `env = { apiBaseUrl: '/api' }`, **tipado com o `Env` do módulo real** |
  | create | `src/services/api/http-client.spec.ts` | 24 testes; concorrência com **deferred** |
  | create | `src/contexts/auth/auth-provider.spec.tsx` | 13 testes; bootstrap, sessão, storage |
  | create | `src/routes/role-route.spec.tsx` | 6 testes; CT-16, CT-17, `bootstrapping` |
  | create | `src/components/ui/password-field.spec.tsx` | 8 testes; toggle e acessibilidade |
  | create | `src/pages/auth/login-page.spec.tsx` | 15 testes; CT-09 a CT-13 |
  | modify | `package.json` | 11 devDeps prescritas + 2 justificadas; scripts `test`, `test:cov`, `test:watch` |

- [x] **Todos os cenários obrigatórios do `http-client` estão cobertos**, um por um: `401` + refresh OK repete o original **uma** vez; **três** concorrentes → **um** refresh; refresh falho limpa token + `onSessionExpired` uma vez + propaga `SESSION_EXPIRED`; `401` no próprio `/auth/refresh` não recursa; retry que também recebe `401` não tenta uma terceira vez; `credentials: 'include'` em toda requisição (inclusive com corpo).
  - Acrescentados por serem caminhos reais não listados: `401` em `/auth/login` é final; query string não burla a lista de caminhos fora do ciclo; `skipRefresh` desliga a renovação; renovador que lança erro **comum** ainda produz `SESSION_EXPIRED`; sem renovador registrado o `401` é sessão encerrada; `markSessionRestored` libera a trava; base de API com barra final não produz barra dupla.
- [x] **`auth-provider`**: bootstrap OK → `authenticated` com `user`; bootstrap falho → `anonymous` **sem** mensagem de erro (`queryByRole('alert')` nulo) e com `logoutReason` nulo; `login` popula usuário e token; `logout` limpa o estado **mesmo com a API rejeitando**; `useAuth` fora do provider lança a mensagem exata; token ausente de `localStorage`/`sessionStorage`. Acrescentados: guarda de `StrictMode` (**1** refresh), reaplicação do usuário a cada renovação, `register` não autentica, `session-expired` só depois do bootstrap concluído, renovação que responde **após o unmount** não toca estado.
- [x] **`role-route`**: `MemoryRouter` + provider dublado, CT-16 por ausência no DOM, CT-17, e o terceiro caso — `bootstrapping` renderiza o splash e **não** redireciona.
- [x] **`password-field`**: `userEvent` alternando o olho (`type` `password`↔`text`, `aria-label` "Mostrar senha"/"Ocultar senha", `aria-pressed`); clicar no olho dentro de `<form>` **não** submete, **com teste de controle** provando que o mesmo formulário submete quando deve; com `error` há `aria-invalid="true"` + `aria-describedby` apontando para um elemento que **existe** e carrega o texto; sem `error` os dois atributos estão **ausentes**; `error=''` é tratado como ausência; o `<label>` é recuperável por `getByLabelText` e tem classe `sr-only`.
- [x] **`login-page`**: CT-09, CT-10, CT-11, CT-12, CT-13 (com o reenvio exercitado até a mensagem de resposta), o teste de duplo clique, e todas as interações por `userEvent`.
- [x] **Scripts**: `test`, `test:cov`, `test:watch` criados; `typecheck` estendido para os dois projetos. `build`, `dev` e `preview` **inalterados**.

---

## Testing and Validation

### Cobertura — os números reais

Medição do `npm run test:cov` (relatório `json-summary` para as frações exatas; o `text` no terminal traz os mesmos percentuais):

| Métrica | Valor | Fração | Limite (AC #1) |
|---|---|---|---|
| Statements | **99,74%** | 395/396 | ≥ 80% ✔ |
| Branches | **98,68%** | 225/228 | ≥ 80% ✔ |
| Functions | **100%** | 115/115 | ≥ 80% ✔ |
| Lines | **99,74%** | 393/394 | ≥ 80% ✔ |

**Os 5 specs prescritos, medidos isoladamente antes de qualquer acréscimo** (62 testes, todos passando):

| Métrica | Com os 5 specs | Limite | Situação |
|---|---|---|---|
| Statements | **60,10%** | ≥ 80% | ✘ |
| Branches | **56,57%** | ≥ 80% | ✘ |
| Functions | **59,13%** | ≥ 80% | ✘ |
| Lines | **59,89%** | ≥ 80% | ✘ |

`exit 1`, com as quatro mensagens `coverage threshold for X not met`. O que faltava eram os arquivos que os 5 specs não alcançam: `confirm-email-page.tsx` (0%), `register-page.tsx` (0%), `app-routes.tsx` (0%), os três layouts (0%), as duas homes (0%), `not-found-page.tsx` (0%), `check-email-page.tsx` (0%), `public-only-route.tsx` (0%), `paw-background.tsx` (0%), `App.tsx` (0%), `auth-api.ts` (0%), `validation.ts` (50%) e `route-paths.ts` (58,82%). Fechar essa lista é o DESVIO-080.

**Os únicos dois arquivos abaixo de 100%**, e os motivos:

- `src/config/env.ts` — **0/1 statements, 0/2 branches**. **Não é cobrível nesta suíte, por construção**: é justamente o módulo substituído pelo `moduleNameMapper`, porque `import.meta` é **erro de sintaxe** sob a transformação CommonJS. Ele nunca é carregado, então não há como executá-lo. Foi mantido em `collectCoverageFrom` de propósito — ver DECISAO-087.
- `src/services/api/http-client.ts` — **41/42 branches**. O ramo não coberto é o `?? caminho` de `const semQuery = caminho.split('?')[0] ?? caminho` (linha 338). É **inalcançável por construção**: `String.prototype.split` sempre devolve ao menos um elemento, e o `??` existe só para satisfazer `noUncheckedIndexedAccess`. Ver DESCOBERTA-088.

`src/contexts/auth/auth.types.ts` não aparece no relatório de frações: é módulo **só de tipos**, sem nenhum statement, e não entra no denominador.

### Os 10 critérios de aceite

- [x] **AC #1 — `npm run test:cov`: todos passam e as quatro métricas ≥ 80%, com o comando falhando abaixo.**
  - 12 suítes, **160 testes, 160 passando, 0 falhando**, exit 0. Quatro métricas na tabela acima, todas ≥ 80%.
  - **A falha abaixo do limite foi provada, não assumida**: com `--coverageThreshold '{"global":{...100}}'` o comando saiu **exit 1** com `threshold for statements (100%) not met: 99.74%`, `branches (100%) not met: 98.68%` e `lines (100%) not met: 99.74%`.
- [x] **AC #2 — a suíte passa integralmente sem rede; nenhuma chamada real escapa dos dublês.**
  - Executada dentro de namespace de rede isolado: `unshare -rn sh -c 'ip link set lo up; exec node ./node_modules/.bin/jest'` → **12 suítes, 160 testes, 160 passando**, exit 0, ~5,2 s.
  - **Sanidade do isolamento conferida** (sem isso a execução não provaria nada): dentro do namespace, `ip -brief addr` mostra apenas `lo` e a resolução de `registry.npmjs.org` **falha**. O `ip link set lo up` foi necessário porque `unshare -rn` deixa o loopback **DOWN** por padrão — nota de método herdada da TASK-BACKEND-007.
  - **A garantia é estrutural, não disciplinar.** `tests/setup.ts` instala em `beforeEach` um `globalThis.fetch` **que lança**. Motivo duplo: (a) o `jsdom` não implementa `fetch` e o `jest-environment-jsdom` não empresta o do Node 20, então sem essa atribuição o próprio `jest.spyOn(globalThis, 'fetch')` falharia com "Cannot spy on the fetch property because it is not a function"; (b) qualquer caminho de rede não previsto encontra uma função que lança em vez de um `fetch` de verdade.
  - **A guarda foi provada por experimento**, com dois testes temporários (criados, executados e removidos): `expect(() => globalThis.fetch('https://exemplo.invalido')).toThrow(/Chamada real de rede em teste/)` **passou**, e um `request()` sem dublê devolveu `{ code: 'NETWORK_ERROR', status: 0 }` — ou seja, a guarda é atingida e o `executarFetch` a traduz, sem que nada saia da máquina.
- [x] **AC #3 — o teste de concorrência afirma `POST /auth/refresh` chamado exatamente uma vez para três requisições concorrentes em `401`.**
  - `it('RN-07: tres requisicoes concorrentes em 401 disparam EXATAMENTE UM POST /auth/refresh')`. A asserção é `expect(chamadasPara(espiao, '/api/auth/refresh')).toHaveLength(1)` — contagem sobre as chamadas **reais de `fetch`** filtradas por URL, não sobre invocações de um dublê de conveniência: o renovador registrado passa pelo próprio `request`.
  - **A resolução do refresh é manual (deferred)**, não temporizada. O `fetch` de `/api/auth/refresh` devolve uma promessa que só resolve quando o teste decide, e a asserção acontece **depois** de uma cessão de macrotask que garante as microtasks drenadas — portanto os três `401` estão comprovadamente na fila no momento da contagem. Sem isso o teste passaria por acidente e deixaria de passar no primeiro ambiente mais lento.
  - Ao liberar o deferred: **1** refresh, **3** primeiras tentativas, **3** retries — 6 chamadas na rota protegida, verificadas.
  - **MUTAÇÃO CONTROLADA confirmando que o teste guarda**: trocando `renovacaoEmVoo ??= executarRenovacao()` por `renovacaoEmVoo = executarRenovacao()`, o teste falha com `Expected length: 1 / Received length: 3` — exatamente o cenário que o backend real mediu como `200,401,401,401` com a família de tokens revogada. **3 testes falharam** nessa mutação.
  - **Segunda mutação, o defeito real da TASK-FRONTEND-010**: acrescentando `renovacaoEmVoo = null` ao `catch` de `executarRenovacao` (fila limpa também na falha), o teste de refresh-que-falha-rápido falha com **2** refreshes e `onSessionExpired` chamado **2** vezes, em vez de 1 e 1. **2 testes falharam.** É o teste `it('RN-07: refresh que falha RAPIDO com tres 401 concorrentes mantem UM refresh e UM onSessionExpired')`, que resolve o primeiro `401`, deixa a renovação falhar **antes** dos outros dois voltarem e só então libera os dois restantes — a condição exata em que o defeito se manifestava.
  - `src/services/api/http-client.ts` foi **restaurado** após os dois experimentos: `git diff -- services/frontend/src` está **vazio**.
- [x] **AC #4 — existe um `it` referenciando CT-09, CT-10, CT-11, CT-12, CT-13, CT-16 e CT-17.**
  - Varredura executada sobre os títulos de `it()` dos 12 specs. **Os sete presentes**: CT-09 (2 testes), CT-10 (2), CT-11 (1), CT-12 (1), CT-13 (1), CT-16 (2), CT-17 (2).
  - Cobertos **além** dos sete exigidos, como efeito dos specs acrescentados: CT-01, CT-03, CT-04, CT-05, CT-06, CT-07, CT-08 e CT-18.
- [x] **AC #5 — o teste de CT-16 afirma ausência no DOM (`queryBy...` devolvendo `null`), não estilo.**
  - `role-route.spec.tsx`: `expect(screen.queryByText(TEXTO_ADMINISTRATIVO)).toBeNull()`.
  - `app-routes.spec.tsx` (mesmo caso sobre a árvore completa): `expect(screen.queryByText('Painel administrativo')).toBeNull()` e `expect(screen.queryByText(MARCADOR_DE_ADMIN)).toBeNull()`.
  - **Zero asserções de estilo ou visibilidade** nos dois testes — e em toda a suíte: varredura de `toBeVisible`, `toHaveStyle`, `visibility` e `display` sobre os 18 arquivos devolve **1** ocorrência textual, num **comentário** de `role-route.spec.tsx` que explica por que `not.toBeVisible()` seria errado (passaria com o conteúdo presente e apenas oculto). `toMatchSnapshot`: **0**.
  - Reforço no mesmo espírito, em `app-routes.spec.tsx`: além da ausência do texto e da navegação administrativa, **todos** os `<a>` da área do cliente são percorridos e nenhum `href` contém `/admin`.
- [x] **AC #6 — CT-11 e CT-12 afirmam exatamente o mesmo texto.**
  - Os dois testes usam `expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_DE_CREDENCIAL_INVALIDA)`, com **a mesma constante** — `'E-mail ou senha incorretos.'`. Verificado por extração dos corpos dos dois testes: a asserção de texto de cada um referencia o identificador, não uma literal. Divergência de um caractere é impossível por construção.
- [x] **AC #7 — `coverage/lcov.info` existe e é lido pelo `sonar.javascript.lcov.reportPaths` já configurado.**
  - Arquivo gerado por `npm run test:cov`: **15.801 bytes, 35 registros `SF:`**. O `reportPaths` já commitado aponta `services/frontend/coverage/lcov.info` (a TASK-BACKEND-007 declarou os dois caminhos) — nada a alterar.
  - **A parte que importa foi verificada, não presumida**: os **35/35** caminhos `SF:` estão prefixados com `services/frontend/`, **todos os 35 resolvem** a partir da raiz do repositório (**0** inexistentes) e **0** são absolutos. Sem o `projectRoot` do reporter, o `istanbul` escreveria `SF:src/App.tsx` (relativo a `services/frontend`, o `cwd`), o scanner procuraria `<raiz>/src/App.tsx` e importaria **zero** cobertura **em silêncio** — Quality Gate verde com cobertura inexistente. É a DESCOBERTA-062 da TASK-BACKEND-007, aqui reaplicada e reconferida.
  - **Pegadinha reproduzida nesta task**: `npx jest --coverage --coverageReporters=lcov` na linha de comando **substitui** o array do config e perde a opção — o relatório saiu com `SF:src/App.tsx`. **O comando que vale é `npm run test:cov`.**
  - `sonar.test.inclusions` já contempla `**/*.spec.tsx` (declarado pela task 007), portanto os 12 specs, que vivem **dentro** de `src/`, não entrariam no denominador da cobertura como código de produção.
- [x] **AC #8 — executada duas vezes em ordem aleatória, o resultado é idêntico.**
  - `npx jest --randomize --seed=20260822 --verbose --runInBand` → **160/160**, exit 0.
  - `npx jest --randomize --seed=777 --verbose --runInBand` → **160/160**, exit 0.
  - **As duas ordens foram efetivamente diferentes** (comparação da sequência dos 160 títulos: `ordem diferente = True`, `mesmo conjunto = True`; primeira divergência no índice 0 — run 1 começa por `CT-11: login com senha incorreta…`, run 2 por `validacao local que reprova NAO chama a API`). Sem essa comparação, duas execuções "aleatórias" idênticas não provariam nada.
  - A independência de ordem tem causa identificada e endereçada: o frontend guarda três coisas **fora** do React em variável de módulo (access token; renovador e callback de expiração registrados no `http-client`; a promessa da fila single-flight, que na falha fica **retida** de propósito). Nenhuma é desfeita por `cleanup()`. O `afterEach` de `tests/setup.ts` zera as três chamando as funções que os próprios módulos expõem.
- [!] **AC #9 — Quality Gate do Sonar sobre os dois serviços, sem bloqueadores e sem issue de segurança Blocker/Critical: BLOQUEADO. Duas causas independentes, e nenhuma delas é corrigível dentro do escopo desta task.**

  **Causa 1 — configuração incompleta: o frontend não está no escopo da análise.** A task afirma que "a TASK-BACKEND-007 já declarou os dois caminhos de cobertura", e isso é **verdade apenas para `sonar.javascript.lcov.reportPaths`**, que lista `services/backend/coverage/lcov.info,services/frontend/coverage/lcov.info`. Mas o arquivo commitado declara:

  ```
  sonar.sources=services/backend/src
  sonar.tests=services/backend/tests
  ```

  Só o backend. **O código do frontend não seria analisado**, então "Quality Gate sobre os dois serviços" não se cumpre nem com o servidor de pé — o relatório de cobertura do frontend seria lido e descartado, porque não há arquivo no escopo a que associá-lo. As linhas que faltam, exatamente:

  | Propriedade | Valor hoje | Valor necessário |
  |---|---|---|
  | `sonar.sources` | `services/backend/src` | `services/backend/src,services/frontend/src` |
  | `sonar.tests` | `services/backend/tests` | `services/backend/tests,services/frontend/tests` — **ou** o padrão de spec, já que os 12 specs deste slice vivem em `services/frontend/src`, não em `tests/` |

  **Por que a 007 declarou só o backend, e por que isso era correto na época**: o DESVIO-063 dela registra que `services/frontend/` estava **vazio** e que o scanner **aborta** (`The folder ... does not exist`) quando um caminho de `sonar.sources`/`sonar.tests` não existe — declarar os dois valeria uma análise que nunca roda. Esse impedimento **deixou de existir**: `services/frontend/src` e `services/frontend/tests` agora existem. (O comportamento de aborto não foi re-medido nesta task, porque o scanner nem chega a indexar arquivos sem servidor; é herdado da medição da 007 e está citado como tal.)

  **Detalhe que a instrução pediu para registrar**: `services/frontend/src` **não cobre `index.html`**, que fica na **raiz do serviço** (`services/frontend/index.html`, conferido). Ele ficaria fora da análise mesmo depois de o `sonar.sources` incluir o frontend — o perfil `Web` do Sonar não veria o único HTML da SPA. Cobri-lo exigiria declarar também `services/frontend` (ou o arquivo), decisão que **não** foi tomada aqui.

  **`sonar-project.properties` NÃO foi editado**, conforme a restrição explícita da task. `git status` confirma: o arquivo não consta entre os modificados.

  **Causa 2 — servidor inacessível.** Nona task consecutiva. Diagnóstico completo na seção *Quality Tools*: DNS resolve, rota existe via `tun0`, e os três testes de conectividade (curl 12 s pelo nome, curl 25 s pelo IP, `/dev/tcp` com `timeout 10`) terminam em estouro sem handshake TCP; `sonar-run` falha em `Failed to query server version`.

  **Consequência honesta**: nada é afirmado sobre Quality Gate, issues, hotspots, duplicação ou cobertura importada. Os itens de Sonar dos blocos *Code Quality*, *Security Check* e *Testing and Validation* estão todos marcados `[~]` ou `[!]`.
- [x] **AC #10 — nenhum arquivo de `src/` foi alterado por este slice.**
  - `git diff --stat -- services/frontend/src` → **vazio**. Nenhum arquivo rastreado de `src/` foi modificado.
  - Os 12 `.spec.ts`/`.spec.tsx` dentro de `src/` aparecem como `??` (não rastreados) no `git status`: são **criação**, não alteração — e é a própria tabela *Files* da task que manda colocá-los ali.
  - Os dois experimentos de mutação sobre `http-client.ts` foram revertidos por cópia do backup, e a ausência de diff acima é a confirmação.
  - Os arquivos modificados são **três**, todos fora de `src/`: `package.json`, `tsconfig.json` (DESVIO-078) e `package-lock.json` (consequência do `npm install`).
  - **Nada foi refatorado para viabilizar teste.** Um ponto encontrado e **reportado em vez de corrigido**: `src/config/env.ts` é intestável nesta suíte por construção (ver DECISAO-087). Nenhum outro ponto de `src/` se mostrou intestável — os 33 arquivos restantes ficaram em 100% nas quatro métricas, com a única exceção do ramo inalcançável da DESCOBERTA-088.

### Verificações além dos 10 critérios

- [x] **O `exclude` do `tsconfig.json` é necessário, e a quebra foi reproduzida.** Removendo-o temporariamente, `npx tsc --noEmit` saiu **exit 2 com 582 erros**, começando por `TS2593: Cannot find name 'describe'. Do you need to install type definitions for a test runner?` e `TS2304: Cannot find name 'expect'`. Restaurado: **0 erros**.
- [x] **`babel.config.cjs` não afeta o build de produção — verificado no código da ferramenta, não presumido.** `@vitejs/plugin-react@4.7.0` chama o Babel com `babelrc: false` e `configFile: false` (linhas 308-309 de `dist/index.cjs`), portanto não lê o arquivo. Se lesse, `targets: { node: 'current' }` emitiria CommonJS dentro do bundle do navegador. Confirmação independente: os hashes de `dist/` saíram idênticos aos de antes do slice.
- [x] **A extensão `.cjs` é obrigatória, não preferência**: `services/frontend/package.json` declara `"type": "module"`, então um `babel.config.js` seria carregado como ESM e o `module.exports` lançaria `module is not defined`.
- [x] **O dublê de env tem a mesma forma do módulo real, garantida pelo compilador.** `tests/env-mock.ts` importa o tipo `Env` de `~/config/env` e anota a exportação com ele. Acrescentar um campo em `src/config/env.ts` faz o `npm run typecheck` (projeto `tsconfig.test.json`) reprovar **no dublê**, em vez de a divergência aparecer no deploy — que é o cenário em que "os testes passam e a aplicação quebra".
- [x] **A ordem das entradas do `moduleNameMapper` é significativa e está correta**: `^~/config/env$` vem **antes** de `^~/(.*)$`. O Jest para no primeiro padrão que casa; invertida, o genérico capturaria o módulo de env e o dublê nunca seria usado — a suíte falharia por erro de sintaxe em `import.meta`.
- [x] **`setImmediate` não existe no `jest-environment-jsdom` do Jest 29.** Descoberto por execução: os dois testes de concorrência falharam com `ReferenceError: setImmediate is not defined`. Trocado por `setTimeout(resolver, 0)`, que também roda depois de a fila de microtasks esvaziar. Ver DECISAO-085.
- [x] **`userEvent`, nunca `fireEvent`.** Verificado: **zero USOS** de `fireEvent` e **zero** de `dispatchEvent` nos 12 specs. As 4 ocorrências textuais dos dois identificadores estão todas **em comentários** que explicam por que são evitados (2 em `password-field.spec.tsx`, 1 em `login-page.spec.tsx`, 1 em `register-page.spec.tsx`) — nenhuma é chamada. Nos dois testes de duplo clique (login e cadastro) as tentativas extras são `usuario.click()` e `usuario.type(..., '{Enter}')`. Um `form.dispatchEvent(new Event('submit'))` **não** passa pela verificação de `disabled` do navegador e produziria uma segunda chamada — o teste "descobriria" um defeito que não existe no uso real. É o risco levantado pela TASK-FRONTEND-012, e ele foi evitado por construção.
- [x] **O botão de submissão é consultado por papel + rótulo, sob os dois rótulos.** Percurso honesto: a primeira versão do teste de duplo clique falhou com `Unable to find role="button" and name "Entrar"` — o `SubmitButton` troca o texto por "Aguarde…" durante a requisição, exatamente no instante que o teste precisa observar. Corrigido com uma consulta por `/^(Entrar|Aguarde…)$/`, mantendo a consulta na linguagem do usuário em vez de recorrer a seletor de CSS.
- [x] **Nenhum snapshot.** `Snapshots: 0 total`. Cada asserção nomeia a propriedade que verifica; nenhum teste passa por comparação de árvore inteira.
- [x] **Volume entregue**: 18 arquivos, **3.571 linhas**, **160 testes**. Distribuição por spec: `http-client` 24, `app-routes` 29, `login-page` 15, `validation` 15, `route-paths` 15, `auth-provider` 13, `confirm-email-page` 12, `register-page` 10, `password-field` 8, `auth-api` 7, `api-error` 6, `role-route` 6.

### O que NÃO foi verificado

- [~] **Quality Gate, issues, hotspots e duplicação do SonarQube** — servidor inacessível e escopo de análise incompleto. Ver AC #9.
- [~] **Complexidade ciclomática pelo MCP** — `complexity-check` devolveu medição vazia. A avaliação de tamanho e ramificação foi por leitura.
- [~] **Comportamento em navegador real** — fora do escopo (a task exclui E2E e regressão visual). A verificação ponta a ponta em Chromium foi feita na TASK-FRONTEND-012 e não é refeita aqui.
- [~] **Integração real com o backend** — esta é uma suíte de dublês, e a AC #2 exige justamente que nenhuma requisição saia.
- [ ] **O comportamento de aborto do scanner com caminho inexistente não foi re-medido nesta task.** É citado como herança da medição da TASK-BACKEND-007 (DESVIO-063), e não como observação própria: sem servidor, o scanner falha antes de indexar arquivos.
- [ ] **A cobertura do frontend nunca foi importada pelo Sonar.** O `lcov.info` está correto e os 35 caminhos resolvem da raiz do repositório, mas isso é uma verificação de **formato** feita localmente. Que o Sonar de fato associe esses caminhos a arquivos do projeto só se confirma com uma análise executada — e nenhuma foi.

---

## Decisões e desvios

- **DESVIO-078 — `tsconfig.test.json` criado e `tsconfig.json` ajustado (dois arquivos fora da tabela *Files*).** A tabela manda **cinco** specs dentro de `src/` (foram doze), e o `tsconfig.json` tinha `include: ["src"]` **sem nenhum `exclude`**, com `build` = `tsc --noEmit && vite build`. A consequência foi **reproduzida** antes da correção: **582 erros** de `tsc`, todos `Cannot find name 'describe'/'it'/'expect'` — globais de `@types/jest`, ausentes do `types: ["vite/client"]` do projeto de produção. O `npm run build` pararia de passar, quebrando a AC #1 da TASK-FRONTEND-008. O `vite build` em si nunca empacotaria os specs (não são alcançáveis de `main.tsx`); o problema é exclusivamente do `tsc`. Três saídas foram consideradas: mover os specs para `tests/` (sairia da tabela *Files*, que este projeto respeitou em todos os slices, e contrariaria o texto da task); acrescentar `"jest"` ao `types` do projeto de produção (faria o build de produção depender de tipos de teste); ou **excluir os specs do projeto de build e criar um projeto próprio para eles** — escolhida, e é exatamente o padrão que a TASK-BACKEND-007 estabeleceu no backend. Resultado medido: build **0 erros** com hashes de bundle idênticos aos anteriores, `typecheck` **0 erros nos dois projetos**, e os specs type-checked com as mesmas flags estritas do código de produção. **`tsconfig.json` não está em `src/`**, portanto alterá-lo não viola a AC #10 — mesma leitura da DECISAO-056.
- **DECISAO-079 — o script `build` foi mantido como estava.** Poderia ter passado a chamar `npm run typecheck` (verificando também os specs no build), mas o precedente do backend é explícito: lá o `build` não type-checa testes e o `typecheck` roda os projetos todos. Manter a simetria evita que um erro de tipo em teste derrube um build de produção.
- **DESVIO-080 — sete specs além da tabela *Files*, por medição e não por preferência.** Os 5 prescritos entregam **60,10% / 56,57% / 59,13% / 59,89%** — as quatro métricas abaixo do limite da AC #1. Acrescentados: `validation.spec.ts`, `route-paths.spec.ts`, `api-error.spec.ts`, `auth-api.spec.ts`, `register-page.spec.tsx`, `confirm-email-page.spec.tsx` e `app-routes.spec.tsx`. A escolha não foi por tamanho de arquivo: `route-paths` e `api-error` cobrem **segurança** (open redirect da GHSA-wrjc-x8rr-h8h6 e poluição de protótipo), `validation` e `auth-api` cobrem **contratos** (RN-04, RN-12, `skipRefresh`), e `app-routes` cobre o que **nenhum teste de unidade observaria**: propriedades da hierarquia de rotas, como `/admin/inexistente` mandar o visitante ao login em vez de exibir a 404. Resultado: **99,74% / 98,68% / 100% / 99,74%**. Mesmo caminho da TASK-BACKEND-007, que foi de 60% para 93,75% de branches por desvio análogo.
- **DESVIO-081 — `tests/auth-harness.tsx` criado (arquivo fora da tabela *Files*).** Quatro specs precisam de um `AuthContext` dublado e de uma forma de observar a rota atual. Quatro cópias divergiriam no primeiro campo novo de `AuthContextValue`, e a divergência apareceria como teste que passa afirmando o contrato errado. O harness dubla o **contexto**, não o `AuthProvider`: o provider tem bootstrap, efeito de mount, registro no cliente HTTP e fila de renovação — tudo isso é objeto de `auth-provider.spec.tsx` e seria ruído num teste de guarda. Ele também expõe as três funções dubladas ao lado do valor, evitando a conversão `valor.login as jest.Mock` (que o compilador não verifica) em cada asserção.
- **DESVIO-082 — duas devDeps além da lista prescrita: `ts-node` e `@types/node`.** As onze da task foram todas instaladas. As duas extras são **exigência mecânica** do `jest.config.ts` em TypeScript: o Jest precisa de `ts-node` para carregar um config `.ts`, e o arquivo usa `node:path` + `__dirname` para calcular o `projectRoot` do reporter de lcov — a correção sem a qual a AC #7 é cumprida na letra e a cobertura no Sonar é 0% (DESCOBERTA-062). A alternativa de passar `projectRoot: '../..'` foi recusada: `path.relative` resolveria contra o `cwd`, reintroduzindo a fragilidade que o `__dirname` existe para eliminar. Nenhuma das duas entra no bundle (`devDependencies`, e o Vite não as importa) e nenhuma acrescentou vulnerabilidade: `npm audit` segue em 4, nos mesmos pacotes.
- **DECISAO-083 — `sonar-project.properties` não foi tocado, mesmo sabendo que a AC #9 não fecha sem ele.** A restrição da task é explícita e foi respeitada. O que faltaria está documentado linha a linha na AC #9, com as duas causas separadas (configuração incompleta e servidor inacessível), a razão histórica de a 007 ter declarado só o backend, o fato de esse impedimento ter deixado de existir, e a ressalva de que `services/frontend/src` não cobre o `index.html` da raiz do serviço. Fica como pendência explícita para quem tiver o arquivo no escopo.
- **DECISAO-084 — guarda de rede em `tests/setup.ts`, em vez de confiar em disciplina.** A AC #2 poderia ser "atendida" apenas dublando o `fetch` em cada teste. Um `globalThis.fetch` que **lança** transforma a exigência em propriedade do ambiente: um caminho de rede não previsto falha o teste em vez de emitir uma requisição silenciosa. Bônus não previsto no plano: é o que torna `jest.spyOn(globalThis, 'fetch')` possível, já que o `jsdom` não define `fetch`.
- **DECISAO-085 — `setTimeout(…, 0)` em vez de `setImmediate` para ceder o controle.** Descoberto por execução, não por leitura: o `jest-environment-jsdom` do Jest 29 não injeta `setImmediate` e os dois testes de concorrência falharam com `ReferenceError`. `setTimeout` é macrotask igualmente, roda depois de a fila de microtasks esvaziar, e não exige polyfill.
- **DECISAO-086 — `http-client.spec.ts` usa imports estáticos, sem `jest.resetModules` por teste.** Recarregar o módulo funcionaria para isolar o estado, mas produziria uma classe `ApiError` nova por teste e todo `instanceof` passaria a comparar identidades diferentes — falha confusa por um motivo que não é o do teste. O estado de módulo é zerado pelo `afterEach` de `tests/setup.ts`, chamando as três funções que o próprio módulo expõe (`setSessionRefresher(null)`, `setOnSessionExpired(null)`, `markSessionRestored()`). A única exceção é o bloco que troca o dublê de `~/config/env`, isolado num `describe` próprio que desfaz a troca no `afterEach` — e as duas execuções em ordem aleatória confirmam que não há vazamento.
- **DECISAO-087 — `src/config/env.ts` foi MANTIDO em `collectCoverageFrom`, a 0%.** Acrescentar `'!src/config/env.ts'` elevaria os números e **esconderia** um fato relevante: existe um módulo do projeto que esta suíte não pode executar, por decisão arquitetural da própria suíte (é o módulo substituído pelo `moduleNameMapper`, porque `import.meta` é erro de sintaxe sob CommonJS). O custo de mantê-lo é 1 statement e 2 branches — as métricas ficam em 99,74% e 98,68%, muito acima do limite. Cobertura declarada baixa é melhor do que cobertura inflada por exclusão.
- **DESCOBERTA-088 — um ramo de `http-client.ts` é inalcançável por construção.** O `?? caminho` de `const semQuery = caminho.split('?')[0] ?? caminho` (linha 338) nunca executa: `String.prototype.split` sempre devolve ao menos um elemento. O `??` existe apenas para satisfazer `noUncheckedIndexedAccess`. É o único ramo não coberto de todo o `src/` fora do `env.ts`. **Reportado, não "corrigido"**: mexer no arquivo violaria a AC #10, e o operador está certo — é a análise de fluxo do TypeScript que não sabe o que a especificação do `split` garante.
- **OBSERVACAO-089 — o repositório não tem ESLint em nenhum dos dois serviços.** Verificado por busca de `.eslintrc*` / `eslint.config.*` em todo o repo, por ausência de chave `eslintConfig` nos `package.json` e por ausência da dependência `eslint`. O `quality-check` do MCP, sendo baseado em ESLint, não tem o que executar (sua etapa `tsc` saiu exit 0). Registrado porque o checklist da TASK-BACKEND-007 cita um `npm run lint` no backend que **não existe na árvore hoje** — não é lacuna deste slice, mas é uma divergência entre registro e código que vale ser vista.

---

## Riscos e pendências

- **PENDÊNCIA-A — o frontend continua fora do escopo do SonarQube.** É a única AC não atendida (AC #9) e o conserto é de **duas linhas** em `sonar-project.properties` (`sonar.sources` e `sonar.tests`), mais a decisão sobre incluir `services/frontend/index.html`. Não foi feito porque a task proíbe editar o arquivo. Enquanto não for feito, "Quality Gate sobre os dois serviços" não é uma afirmação verificável, mesmo com o servidor de volta.
- **RISCO-B — o `lcov.info` do frontend nunca passou por um scanner de verdade.** O formato foi conferido localmente (35/35 caminhos resolvem da raiz), mas a associação efetiva no Sonar só se confirma numa análise executada. A pegadinha do `--coverageReporters` na linha de comando fica registrada: quem rodar cobertura por fora do `npm run test:cov` regenera o relatório com caminhos que o scanner não resolve, **em silêncio**.
- **RISCO-C — `babel-jest` não verifica tipos.** Diferente do backend (onde o `ts-jest` type-checa os specs na própria execução), aqui a única verificação de tipos dos testes é o `npm run typecheck`. Como o `build` **não** o chama (DECISAO-079), um erro de tipo em spec passa despercebido por quem só rodar `npm run build` e `npm test`. Mitigação sugerida a quem cuidar do CI: rodar `npm run typecheck` no pipeline, não apenas `build` e `test`.
- **RISCO-D — dois avisos de future flag do `react-router` no log.** `v7_startTransition` e `v7_relativeSplatPath`, informativos, **não** suprimidos de propósito: silenciá-los esconderia avisos futuros de verdade. Eles antecipam mudanças de comportamento na v7 que afetarão as guardas e os catch-all de `/admin/*` e `/minha-area/*`.
- **RISCO-E — a suíte não substitui verificação em navegador.** Ela é de dublês por exigência da AC #2. Comportamentos que dependem de CSS real (o `disabled:cursor-not-allowed`, o anel de foco, o contraste medido nas tasks 009/011) e do motor de layout continuam cobertos apenas pela verificação manual da TASK-FRONTEND-012.

---

## Notes

- **Nenhum commit e nenhum push foram feitos**: tudo permanece no working tree, em `master`, e nenhuma branch foi criada.
- **Nenhum subagente foi invocado.** Nenhum Playwright foi usado nesta task, portanto não há `.playwright-mcp/` nem screenshot a remover da raiz (conferido: o `git status` não mostra nada disso).
- **Arquivos modificados (3)**: `services/frontend/package.json`, `services/frontend/tsconfig.json`, `services/frontend/package-lock.json`. **Nenhum** em `src/`, **nenhum** em `services/backend/`, e `sonar-project.properties` **intacto**.
- **Arquivos criados (18)**: `jest.config.ts`, `babel.config.cjs`, `tsconfig.test.json`, `tests/setup.ts`, `tests/env-mock.ts`, `tests/auth-harness.tsx` e os 12 specs em `src/`.
- **`dist/` e `coverage/` são artefatos gerados durante a validação e estão no `.gitignore`.** `coverage/lcov.info` é mantido de propósito, porque é o insumo da AC #7. O `dist/` foi regerado e saiu com os mesmos hashes de conteúdo de antes do slice — evidência de que a suíte não tocou o artefato de produção.
- **Comando único para reproduzir tudo**: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20; cd services/frontend; npm ci && npm run typecheck && npm run build && npm run test:cov`.
