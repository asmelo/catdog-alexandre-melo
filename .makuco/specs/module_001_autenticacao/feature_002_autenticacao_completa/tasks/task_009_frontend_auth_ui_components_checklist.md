# Makuco Codegen Checklist: TASK-FRONTEND-009 — Componentes de UI do fluxo de autenticação

**Purpose**: Validar a qualidade da geração dos 8 componentes reutilizáveis do card de autenticação (React 18 + Tailwind 3, sobre os tokens da TASK-FRONTEND-008). Cada item abaixo reflete uma verificação **efetivamente executada**; itens não executáveis neste ambiente estão marcados como `[~]` (N/A) ou `[!]` (bloqueado) com a justificativa, e **nunca** como concluídos.
**Created**: 2026-08-22
**Feature**: [spec_context.md](../spec_context.md)
**Prompt Plan**: [task_009_frontend_auth_ui_components.md](./task_009_frontend_auth_ui_components.md)

**Legenda**: `[x]` verificado e aprovado · `[~]` não aplicável a este slice (com justificativa) · `[!]` bloqueado por ambiente (com justificativa)

**Ambiente de verificação**: Node **v20.20.2** / npm **10.8.2** (`nvm use 20`, coerente com `.nvmrc` e com `engines: {node: ">=20 <21"}`). Navegador via Playwright (Chromium), servidor Vite de desenvolvimento na 5173 com uma **página de sondagem temporária** em `src/App.tsx` (ver DECISÃO-004 e *Notes*). Nenhuma dependência foi adicionada ao `package.json`.

---

## Quality Tools

- [x] Run linters and compilers available in the project to ensure the generated code is free of errors and follows the project's standards.
  - `npm run typecheck` (`tsc --noEmit`, com `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`): **0 erros**.
  - `npm run build` (`tsc --noEmit && vite build`): **0 erros**, 31 módulos transformados, `dist/` gerado — `index.html` 1.20 kB, CSS **11.64 kB**, JS 143.18 kB.
    - O CSS saiu de **6.99 kB** (baseline da TASK-FRONTEND-008) para **11.64 kB**: o crescimento é o conjunto de utilitários novos dos 8 componentes. O JS ficou **idêntico** (143.18 kB, 31 módulos) porque nenhuma página os importa ainda — os componentes entram no bundle nas TASK-FRONTEND-011/012. O `tsc` os cobre de todo modo, porque o `tsconfig.json` tem `include: ["src"]`.
    - Confirmado por `grep` no CSS **gerado** (não na config) que as classes novas foram emitidas: `border-[1.5px]`, `text-brand-orange-dark`, `text-paw`, `opacity-[0.18]`, `h-11`, `w-11`, `pb-9`, `shadow-focus-ring`, `sr-only`, `bg-brand-purple-light` — **10 de 10 presentes**.
  - ESLint: **não existe no projeto** (a suíte e as ferramentas de teste são a TASK-FRONTEND-013). O MCP `quality-check` confirmou a ausência (`ESLint couldn't find an eslint.config.(js|mjs|cjs)`) e **reproduziu os três bugs já registrados na TASK-FRONTEND-008**: comando montado como `npx eslint eslint --fix services/frontend/src/components` — nome do binário duplicado, `--fix` passado **incondicionalmente** mesmo sem o parâmetro `fix` (chamada de *verificação* que reescreveria fontes), e `tsc` invocado da raiz do repositório, onde não há TypeScript ("This is not the tsc command you are looking for"). Inócuo aqui só porque não há config de ESLint.
  - **Compensação executada**: toolchain efêmera instalada **fora do repositório** (no diretório de trabalho da sessão) — `eslint@9` + `typescript-eslint@8` (`recommendedTypeChecked` + `stylisticTypeChecked`) + `eslint-plugin-react@7` + `eslint-plugin-react-hooks@5` + `eslint-plugin-jsx-a11y@6` + `eslint-plugin-sonarjs@4`, mais `complexity:10`, `max-depth:3`, `eqeqeq`, `prefer-const`, `no-console`, `no-explicit-any`. Config impressa por `--print-config`: **437 regras ativas** (279 sonarjs, 64 @typescript-eslint, 34 jsx-a11y, 24 react). Executada **sem `--fix`**, sobre `src/` inteiro.
    - **Achado corrigido (2)**: `sonarjs/todo-tag` (**S1135**) em `paw-background.tsx:52` e `text-field.tsx:26` — falso positivo sobre a palavra portuguesa "todo" ("engoliria **todo** clique", "Aqui **todo** campo tem um `<label>`"). Reescrito para "qualquer clique" e "cada campo". Reexecutado: **0 achados sonarjs**.
    - **Achado recusado (5 novos + 1 preexistente)**: `@typescript-eslint/consistent-type-definitions` nos `type` de props (`alert-message`, `auth-card`, `catdog-logo`, `field-error`, `paw-background`) e no `env.ts` da TASK-FRONTEND-008. É a **mesma opinião do preset *stylistic* já deliberadamente recusada na DECISÃO-005 da TASK-FRONTEND-008**; recusá-la de novo é coerência, não desleixo (ver DECISÃO-006). `text-field`, `password-field` e `submit-button` não são sinalizados porque usam tipo de interseção, que `interface` não expressa trivialmente.
    - **Zero** achados de tipagem (as quatro regras `no-unsafe-*` do preset *typeChecked*), **zero** de acessibilidade (34 regras `jsx-a11y`), **zero** de hooks, **zero** de complexidade ou profundidade.
    - A configuração efêmera nunca esteve dentro do repositório — foi apontada por `--config` a partir do diretório da sessão, com `cwd` no serviço. Nada foi adicionado ao `package.json`.

- [~] Run tests to ensure all implemented code is covered and all tests are passing successfully.
  - **Não aplicável a este slice, por escopo explícito da task** ("Sem testes (TASK-FRONTEND-013)"). Não existe runner de teste no `services/frontend/package.json` — só `dev`, `build`, `preview`, `typecheck`.
  - **Cobertura automatizada destes 8 componentes: 0%.** Declarado sem rodeio. A verificação de comportamento foi feita por **medição em navegador real** (ver *Testing and Validation*), o que não substitui suíte de regressão. A TASK-FRONTEND-013 é a dependente declarada.

- [x] Run complexity check in MCP, if available, to ensure the generated code does not exceed the project's complexity standards.
  - `complexity-check(path=services/frontend/src/components, cyclomaticThreshold=10)`: **nenhuma função acima do limiar**. A resposta é o registro degenerado (`filePath: ""`, `functionName: "Não identificado"`, valores 0) que a TASK-FRONTEND-008 já identificou como o formato de "nada encontrado" deste MCP.
  - Confirmado de forma independente pelas regras `complexity: ['error', 10]` e `max-depth: ['error', 3]` do ESLint efêmero: **0 violações**. O componente mais ramificado é o `PasswordField` (três ternários de estado) e o `TextField` (dois), muito abaixo do limiar.

- [!] Run SonarQube analysis using the Makuco MCP tools, if applicable, to ensure that the generated code meets the project's quality standards and does not introduce new issues.
  - **NÃO EXECUTADO — servidor inacessível em 2026-08-22. Nenhuma métrica de SonarQube é declarada neste checklist, porque nenhuma foi medida.**
  - Diagnóstico preciso, executado (mesmo estado das TASK-BACKEND-004..007 e TASK-FRONTEND-008): a VPN **está ativa** (`tun0` UP, `src 10.200.52.90`), o nome **resolve** (`sonar.anymarket.vpc` → `10.119.10.55`) e **existe rota** (`via 10.200.52.1 dev tun0`). O que falha é o **handshake TCP na porta 9000**: `/dev/tcp/sonar.anymarket.vpc/9000` expira (exit 124 em 8s) e `curl http://sonar.anymarket.vpc:9000/api/system/status` devolve `status=000` após 15s. Não é DNS, não é ausência de VPN — é o servidor ou um filtro no caminho não aceitando conexão.
  - **Compensação executada**: `eslint-plugin-sonarjs@4` — a implementação das regras JS/TS usadas pelo próprio analisador do SonarQube — perfil `recommended`, **279 regras**, com informação de tipos, sobre `src/**/*.{ts,tsx}`: **0 achados** (após corrigir os 2 falsos positivos de S1135).
  - **Limite honesto da compensação**: o plugin cobre as regras de código. **Não** entrega quality gate, cobertura, densidade de duplicação nem security hotspots. Esses quatro permanecem **não medidos**.

---

## Code Quality

- [x] Code follows the project's existing patterns and best practices.
  - Arquivos em **kebab-case** (8/8, exatamente os nomes da tabela *Files*), componentes em **PascalCase**, **export nomeado** em 100% dos casos (`grep "export default"` em `src/`: **0**).
  - Alias `~/` em 3/3 imports internos (`text-field` → `field-error`, `auth-card` → `catdog-logo`, `password-field` → `text-field`). Nenhum import relativo do tipo `./` entre componentes.
  - Comentários em **PT-BR sem acento**; textos visíveis ao usuário **com acento** ("Mostrar senha", "Ocultar senha", "Aguarde…"). Verificado por leitura e confirmado no navegador (o subtítulo "Digite os seus dados de acesso no campo abaixo" e a mensagem "Informe o seu nome completo." renderizaram com acentuação correta).
  - Spread condicional para atributos opcionais, replicando o padrão do backend em `error-handler.middleware.ts:35` (`...(erro.details === undefined ? {} : { details: erro.details })`). Aplicado em três pontos: ARIA de erro no `TextField`, `aria-busy` no `SubmitButton`, `error` repassado pelo `PasswordField`.
  - Tipos de props com `readonly` em todos os campos; `Readonly<Record<...>>` no mapa de variantes do `AlertMessage`.

- [x] Code is free of linting and compiler errors.
  - `tsc --noEmit` = **0 erros**. ESLint efêmero = **0 erros de correção** (6 preferências estilísticas recusadas, justificadas na DECISÃO-006). `eslint-plugin-sonarjs` (279 regras) = **0 achados**. `jsx-a11y` (34 regras) = **0 achados**.
  - Proibidos, medidos por `grep` em `src/components/`: `any` **0**, `as any` **0**, `: any` **0**, `any[]` **0**, `Array<any>` **0**, `@ts-ignore` **0**, `@ts-expect-error` **0**, asserção não-nula (`!`) **0**, `dangerouslySetInnerHTML` **0**.
  - `Math.random` e `innerHTML` aparecem **1 vez cada**, ambas **dentro de comentário JSDoc** explicando por que NÃO são usadas (`paw-background.tsx:16`, `password-field.tsx:62`). Nenhum uso executável — confirmado por inspeção das duas linhas.
  - Console do navegador na sondagem: **3 mensagens, 0 erros, 0 avisos** (`browser_console_messages(level=warning, all=true)`). Nenhum aviso de `key`, de prop desconhecida no DOM ou de hook.

- [x] Code is readable and maintainable, with clear naming conventions and structure.
  - 488 linhas em 8 arquivos: 27 (`field-error`) a 103 (`password-field`). Nenhum arquivo acima de 110 linhas; boa parte de cada arquivo é documentação de decisão.
  - Comentários **apenas em decisões não óbvias, no ponto de uso**: por que `type="button"` (AC 5), por que `right-[1px]` (a aritmética 14 + 9 − 22 do alvo de 44px), por que `pb-9` sobre `p-card`, por que rotação literal em vez de `Math.random()`, por que o wordmark é `aria-hidden`, por que `''` conta como ausência de erro. Nenhum comentário narrando o óbvio.
  - Nomes de identificadores locais em PT-BR consistentes com o backend (`senhaVisivel`, `mensagemDeErro`, `temErro`, `atributosDeErro`, `classesDoInput`, `POSICOES_DAS_PEGADAS`, `CLASSES_POR_VARIANTE`).

- [!] Zero new issues introduced in SonarQube analysis (if applicable).
  - **Bloqueado**: servidor inacessível (diagnóstico completo no item de SonarQube em *Quality Tools*). Nenhum número é afirmado.
  - Melhor evidência disponível: **0 achados** nas 279 regras do `eslint-plugin-sonarjs` sobre `src/`.

- [x] No code duplication introduced (DRY principle).
  - O risco real deste slice era duplicar a marcação do campo entre `TextField` e `PasswordField` — inclusive a lógica de `aria-invalid`/`aria-describedby`/`<label>`, que é exatamente o que os ACs 2 e 3 cobram. **Não foi duplicada**: o `PasswordField` é um invólucro fino do `TextField` e injeta o botão pelo slot `trailing` (ver DECISÃO-001). A lógica de acessibilidade do campo existe em **um** lugar.
  - A string de classes do input existe uma única vez (`CLASSES_BASE_DO_INPUT`). Os SVGs do olho existem uma vez cada, como componentes locais.
  - `sonarjs/no-identical-functions` e `sonarjs/no-duplicate-string` (ambas no perfil `recommended` executado): **0 achados**.

- [x] No GOD classes, methods or files introduced.
  - 8 arquivos, um componente exportado cada (mais dois componentes de ícone privados no `password-field.tsx`, não exportados). Nenhuma função com mais de ~35 linhas de corpo. Complexidade ciclomática máxima bem abaixo de 10 (medido).

- [~] Code is properly tested, with all tests passing and at least 80% of coverage.
  - **Não aplicável — testes estão fora do escopo declarado desta task** (TASK-FRONTEND-013). **Cobertura automatizada: 0%.** Ver o item de testes em *Quality Tools*.

---

## Security Check

- [!] No new vulnerabilities introduced in SonarQube analysis.
  - **Bloqueado** (servidor inacessível). Sem número afirmado. Compensado por 279 regras sonarjs: 0 achados.

- [~] All inputs are validated at system boundaries to prevent injection attacks and ensure data integrity.
  - **Não aplicável a este slice**: estes 8 componentes são apresentação pura. Não há fronteira de sistema aqui — nenhuma chamada de API, nenhum parsing, nenhum acesso a `import.meta.env`, nenhum estado global. A validação de formulário é a TASK-FRONTEND-012 e a validação de servidor já está nas TASK-BACKEND-004/005.
  - O que **é** verificável e foi verificado: todo texto chega ao DOM por interpolação JSX (escapada pelo React). **Zero** `dangerouslySetInnerHTML` e **zero** manipulação de `innerHTML` — divergência deliberada do `reference.html`, que troca `innerHTML` do SVG do olho. Registrado no comentário de `password-field.tsx:62`.

- [!] No security hotspots introduced in SonarQube analysis.
  - **Bloqueado** (servidor inacessível). Security hotspots são categoria própria do SonarQube e **não** têm equivalente no `eslint-plugin-sonarjs`: permanecem **não medidos**.

- [x] Code does not contain any known security anti-patterns (e.g., hardcoded secrets, unsafe deserialization, etc.).
  - `grep` por segredo, token, chave, senha em literal: nada. O único literal sensível por nome é `autocomplete="current-password"` na sondagem temporária (já removida) — atributo HTML, não segredo.
  - Nenhuma desserialização, nenhum `eval`, nenhum `new Function`, nenhum `href` dinâmico, nenhuma navegação. O `PasswordField` mantém o valor da senha no DOM apenas como `value` do input controlado pelo consumidor; nada é logado (`no-console`: 0 achados).
  - Alternar `type="password"` → `type="text"` expõe a senha na tela por ação **explícita** do usuário, com `aria-pressed` refletindo o estado. É o comportamento pedido pela task; o estado é interno e volta a `password` a cada montagem.

- [x] Code follows secure coding practices as defined by the project and industry standards.
  - Sem `any`, sem asserção não-nula, sem `@ts-ignore` — a checagem de tipos permanece a rede de segurança. As quatro regras `no-unsafe-*` do preset *typeChecked*: 0 achados.
  - `npm audit` reporta **4 vulnerabilidades** nas majors prescritas pelo `stack.md` (Vite 5, React Router 6). **Não corrigidas por decisão** — risco aceito e registrado na TASK-FRONTEND-008; corrigir exigiria subir major fora do contrato da spec. **Este slice não adicionou nenhuma dependência**, portanto não alterou essa superfície.

- [x] No security vulnerabilities introduced (e.g., injection, XSS, SSRF, etc.).
  - XSS: única superfície plausível seria injeção de markup; eliminada por construção (0 `dangerouslySetInnerHTML`, 0 `innerHTML`, 100% do texto via JSX). O `AlertMessage` recebe `ReactNode` como filho, renderizado pelo React, não como string de HTML.
  - SSRF/injeção: sem rede e sem query neste slice. Nada a introduzir.

---

## Implementation Completeness

- [x] All steps in the execution plan have been implemented as specified.
  - Os 8 componentes do *Scope* existem e foram exercitados em navegador. Detalhamento por AC em *Testing and Validation*.
  - **Fora do escopo, respeitado e verificado**: nenhuma página, nenhum formulário concreto, nenhuma rota, nenhum layout, nenhum estado global, nenhuma chamada de API. `src/App.tsx` foi restaurado ao conteúdo original (prova de restauração no fim deste checklist). Nenhum arquivo criado fora de `src/components/ui/`.
  - **Link "Esqueceu sua senha?" NÃO criado**, conforme a decisão registrada na própria task: a spec enumera só e-mail, senha, "Entrar" e link para registro, e recuperação de senha está em "O que Não Deve Ser Feito" (`spec_context.md:289`). Expor caminho morto é pior que a ausência. `grep "Esqueceu"` em `src/`: **0**.
  - **Nenhuma dependência nova**: `package.json` e `package-lock.json` inalterados (`git status` os lista como não modificados). Zero biblioteca de ícones, zero biblioteca de componentes — os 3 SVGs (logo, olho aberto, olho cortado) e o da pegada vieram do `reference.html`.

- [x] All necessary files have been created and properly structured.
  - 8 de 8 arquivos da tabela *Files*, todos em `services/frontend/src/components/ui/`, nenhum extra:

  | Arquivo | Linhas |
  |---|---|
  | `catdog-logo.tsx` | 60 |
  | `paw-background.tsx` | 82 |
  | `auth-card.tsx` | 44 |
  | `text-field.tsx` | 79 |
  | `password-field.tsx` | 103 |
  | `submit-button.tsx` | 47 |
  | `field-error.tsx` | 27 |
  | `alert-message.tsx` | 46 |

  - `git status` final: exatamente `services/frontend/src/components/` (novo) + este checklist. **Nada mais.** `services/backend/`, `tailwind.config.js` e `sonar-project.properties` intocados.

- [x] All referenced code patterns and best practices have been followed.
  - `reference.html` conferido valor por valor no **estilo computado do navegador**, não na config: `.card` → `padding: 44px 44px 36px`, `border-radius: 22px`, `max-width: 420px`, `background: rgb(255,255,255)`, `z-index: 10`, `animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both`. `.field input` → `padding: 13px 16px`, `font-size: 14px`, `border-radius: 14px`, `background: rgb(248,247,252)`, borda declarada `border-width: 1.5px` no CSS gerado. `.paw` → `opacity: 0.18`, `fill: rgb(176,174,200)`, SVG 56×56 (`h-14 w-14`). `.btn-submit` → `background: rgb(124,58,237)`, `color: rgb(255,255,255)`, `box-shadow: rgba(124,58,237,0.3) 0px 4px 16px`, `border-radius: 14px`. `.logo` → gap 9px, wordmark `1.45rem`/800/`-0.3px`. Fonte Nunito em todos os elementos medidos.
  - Nota de medição: o Chrome reporta `border-top-width: 1px` como **valor usado** para uma borda declarada de `1.5px` (arredondamento para pixel de dispositivo a DPR 1). A **declaração** está correta — `grep` no CSS gerado: `.border-\[1\.5px\]{border-width:1.5px}`. O mockup se comporta igual.
  - **OBSERVAÇÃO-A da TASK-FRONTEND-008 endereçada**: `spacing.card` é um valor único de 44px, mas o `.card` do mockup usa `padding: 44px 44px 36px`. O `AuthCard` aplica `p-card pb-9` e o navegador confirmou `padding: 44px 44px 36px`. Nenhum token novo foi necessário — e `tailwind.config.js` não foi tocado.

- [x] All validation rules have been implemented and passed successfully.
  - Este slice tem uma única regra de validação própria: **quando exibir os atributos ARIA de erro**. Implementada por spread condicional e comprovada nos dois sentidos no navegador (AC 3, medição abaixo). Adicionalmente, `''` é tratado como ausência de erro — bibliotecas de formulário devolvem string vazia para campo válido, e emitir `aria-invalid="true"` aí marcaria como inválido um campo correto.
  - A validação de conteúdo dos campos (formato de e-mail, força de senha, confirmação) é da TASK-FRONTEND-012, não deste slice.

---

## Testing and Validation

- [~] All implemented code is covered by tests, including edge cases.
  - **Não aplicável**: testes fora do escopo (TASK-FRONTEND-013). **Cobertura automatizada: 0%.** O que segue é medição em navegador real, não suíte de regressão.

- [~] All tests are passing successfully.
  - **Não aplicável**: não há suíte. Não existe runner no `package.json` do frontend.

- [!] SonarQube analysis shows no new issues introduced by the generated code (if applicable).
  - **Bloqueado** (servidor inacessível). Sem número afirmado.

- [x] Tests cover expected behavior and edge cases, ensuring the implementation is robust and reliable, covering validation rules defined in the prompt plan.
  - Lido como **"os critérios de aceite foram verificados por execução"**. **11 de 11 comprovados**, todos por medição em Chromium via Playwright sobre o Vite dev server, exceto o AC 10 (cálculo) e o AC 11 (`grep`). Nenhum foi aceito por leitura de código.

  1. **AC 1 — `AuthCard` exibe logo, um único `<h1>`, subtítulo, filhos, com `fadeUp`.** `[x]` Medido no DOM: `document.querySelectorAll('h1').length` = **1**; texto = `"Bem vindo!"`; subtítulo = `"Digite os seus dados de acesso no campo abaixo"`; `svg[role=img] > title` = `"CatDog"` com `role="img"`; filhos presentes (`<form>` renderizado). Estilo computado do `<section>`: `animationName: fadeUp`, `animationDuration: 0.55s`, `animationTimingFunction: cubic-bezier(0.22, 1, 0.36, 1)`, `animationFillMode: both`, `zIndex: 10`, `padding: 44px 44px 36px`, `borderRadius: 22px`, `maxWidth: 420px`, `backgroundColor: rgb(255, 255, 255)`.

  2. **AC 2 — todo campo tem `<label>` associado por `htmlFor`/`id`.** `[x]` Varredura de **3/3** inputs: para cada `input[id]` existe `label[for=id]` com o texto esperado ("E-mail", "Nome completo", "Senha"), classe `sr-only`, e estilo computado de ocultação visual `position: absolute; width: 1px; height: 1px; clip: rect(0px, 0px, 0px, 0px); overflow: hidden`. Presente no DOM, invisível na tela — que é exatamente o requisito.

  3. **AC 3 — ARIA de erro presente com `error`, AUSENTE sem `error`.** `[x]` Verificado **nos dois sentidos**, com `hasAttribute`, não com leitura de valor:
     - campo com erro (`#nome`): `hasAttribute('aria-invalid')` = **true**, valor `"true"`; `hasAttribute('aria-describedby')` = **true**, valor `"nome-error"`; o alvo **existe** (`getElementById('nome-error')` ≠ null) e contém o texto `"Informe o seu nome completo."`; borda computada `rgb(224, 90, 30)` = `brand.orange`.
     - campos sem erro (`#email`, `#senha`): `hasAttribute('aria-invalid')` = **false** e `hasAttribute('aria-describedby')` = **false** — atributos **ausentes**, não string vazia. Borda `rgb(228, 226, 240)` = `hairline`.

  4. **AC 4 — botão do olho alterna `type`, ícone e `aria-label`.** `[x]` Antes do clique: `input.type = "password"`, `aria-label = "Mostrar senha"`, `aria-pressed = "false"`, ícone com 1 `<path>` + 1 `<circle>` + 0 `<line>`. Depois do clique real: `input.type = "text"`, `aria-label = "Ocultar senha"`, `aria-pressed = "true"`, ícone com 2 `<path>` + 0 `<circle>` + **1 `<line>`** (o traço do olho cortado). Os três sinais mudaram juntos.

  5. **AC 5 — clicar no olho dentro de um `<form>` NÃO submete.** `[x]` A sondagem contava submissões em `<p data-testid="envios">`. Antes do clique no olho: `"1"` (do teste de Enter do AC 6). Depois do clique: **`"1"`** — inalterado. Confirmado `type="button"` no atributo do botão. Este é o erro clássico do componente e ele **não** ocorre.

  6. **AC 6 — navegação só por teclado alcança tudo e submete com Enter.** `[x]` Ordem de foco capturada por listener `focusin` durante **6 pressionamentos de Tab** a partir do `<body>`: `input#email` → `input#nome` → `input#senha` → `button[type=button][aria-label="Mostrar senha"]` → `button[type=submit]` "Entrar" → `button` "remontar" (controle da sondagem). O `SubmitButton` desabilitado (`isLoading`) foi **corretamente saltado** — 6 Tabs alcançaram 6 elementos e o botão desabilitado não aparece na sequência. Submissão por **Enter** com foco em `#email`: contador de envios foi de `"0"` para **`"1"`**. Ativação do botão do olho por **Espaço** com foco nele (`document.activeElement === botão` = true): `type` voltou a `password`, `aria-label` a `"Mostrar senha"`, `aria-pressed` a `"false"`, e envios permaneceu `"1"`. Anel de foco do botão preservado (`outline: auto 1px rgb(11, 87, 208)` — o padrão do navegador, não removido).

  7. **AC 7 — `SubmitButton` com `isLoading` está `disabled`, com `aria-busy="true"`, e cliques não disparam `onClick`.** `[x]` Medido: `disabled = true`, `aria-busy = "true"`, rótulo trocado para `"Aguarde…"`, `opacity: 0.6` computado. `document.elementFromPoint` no centro do botão devolve o próprio botão (não há sobreposição escondendo-o), e dois cliques (no botão e no elemento do ponto) deixaram o contador `onClick` em **`0` → `0`**. Nota de honestidade: cliques disparados por `HTMLElement.click()`, que nos navegadores não executa os passos de ativação em controle de formulário desabilitado — reproduz o no-op do usuário. Um `dispatchEvent` sintético **contornaria** essa checagem e seria um teste falso; não foi usado. O salto no tab order (AC 6) é a prova complementar de que o controle está inerte.

  8. **AC 8 — `PawBackground` montado duas vezes produz DOM idêntico; `aria-hidden`; não intercepta cliques.** `[x]` Verificado com **remontagem real**, não re-render: a sondagem trocava a `key` do componente, forçando desmontagem e nova montagem.
     - **Prova de que houve montagem nova**: nó capturado antes ≠ nó depois (`noB !== window.__noA` = **true**) e o nó antigo saiu do documento (`!document.contains(window.__noA)` = **true**).
     - **DOM idêntico**: `outerHTML` byte a byte igual (**9142 = 9142 bytes**, comparação de igualdade = **true**), 16 pegadas nas duas montagens, e os 16 atributos `style` idênticos (`left: 5%; top: 5%; transform: rotate(-22deg);` …). Um `Math.random()` teria produzido 16 rotações diferentes.
     - `aria-hidden = "true"`, `pointerEvents: none`, `position: fixed`, `zIndex: 0`.
     - **Não intercepta cliques, medido por hit-testing**: `document.elementFromPoint` no centro de 6 pegadas devolveu `main`, `main`, `main`, `section`, `p`, `main` — **nenhum** dos alvos está dentro da camada de pegadas (`paws.contains(alvo)` = false nos 6). O botão de submit permanece clicável, como o AC 6 e o AC 5 já demonstraram na prática.

  9. **AC 9 — `AlertMessage` possui `role="alert"`.** `[x]` `querySelectorAll('[role=alert]')` devolveu **3** elementos, um por variante, com os textos esperados. Cores computadas por variante: `success` = texto `rgb(30,27,46)` sobre `rgb(237,233,254)` com borda `rgb(124,58,237)`; `error` = texto `rgb(30,27,46)` sobre `rgb(248,247,252)` com borda `rgb(224,90,30)`; `info` = texto `rgb(75,72,105)` sobre `rgb(255,255,255)` com borda `rgb(228,226,240)`.

  10. **AC 10 — contraste WCAG AA.** `[x]` **Calculado**, par por par, pela fórmula de luminância relativa da WCAG 2.1. Tabela completa e decisões na seção *Contraste* abaixo. **Três pares que a task prescrevia reprovam AA e foram trocados**; um par continua reprovando por decisão consciente e está declarado.

  11. **AC 11 — hex apenas dentro dos SVGs de ilustração.** `[x]` `grep -rn "#7c3aed\|#e05a1e\|#dde0ea" --include=*.tsx src/`: **6 ocorrências**, todas justificadas — 5 são `fill`/`stroke` **dentro do SVG do logo** em `catdog-logo.tsx` (ilustração, permitido pela task) e 1 é **comentário** em `field-error.tsx:12` documentando a decisão de contraste. `#7c3aed` e `#dde0ea`: **0 ocorrências**. Busca ampliada por **qualquer** `#[0-9a-fA-F]{3,8}` nos `.tsx`: 9 ocorrências, as mesmas 6 mais `#fff` (×2, olhos) e `#c44a10` (focinho) — **todas dentro do SVG do logo**. **Zero hex em qualquer `className`.** As cores da pegada e do olho nem aparecem: usam `fill-current`/`currentColor` sobre `text-paw` e `text-ink-mid`.

---

## Contraste (AC 10) — medição completa

Calculado pela fórmula WCAG 2.1 (luminância relativa sRGB, `(L_claro + 0.05) / (L_escuro + 0.05)`), sobre os valores exatos do `tailwind.config.js`. Limiar aplicado: **4.5:1** para texto e **3:1** para elemento não-textual (SC 1.4.11).

Nota sobre o limiar: só um elemento se qualificaria como *large text* (limiar relaxado de 3:1) — o `<h1>` a 1.35rem/800, que dá **21.6px em negrito** e portanto excede os 18.66px-bold da definição. Cobrei **4.5:1 dele também**, por folga; ele passa com 16.78:1 de qualquer modo. Todo o resto da interface é texto normal (0.75rem a 0.95rem) e o limiar de 4.5:1 é obrigatório.

| Primeiro plano | Fundo | Tipo | Ratio | Limiar | Resultado | Onde |
|---|---|---|---|---|---|---|
| `ink` #1e1b2e | `surface.card` #ffffff | texto | **16.78** | 4.5 | PASSA | `<h1>` do `AuthCard`; texto do `AlertMessage` success/error |
| `ink` #1e1b2e | `surface.input` #f8f7fc | texto | **15.74** | 4.5 | PASSA | valor digitado no input; **ADOTADO** no `AlertMessage` error |
| `ink` #1e1b2e | `brand.purple-light` #ede9fe | texto | **14.13** | 4.5 | PASSA | `AlertMessage` success |
| `white` #ffffff | `brand.purple` #7c3aed | texto | **5.70** | 4.5 | PASSA | rótulo do `SubmitButton` |
| `white` #ffffff | `brand.purple-hover` #6d28d9 | texto | **7.10** | 4.5 | PASSA | rótulo do `SubmitButton` em hover |
| `brand.orange` #e05a1e | `surface.card` #ffffff | texto | **3.72** | 4.5 | **REPROVA** | **PRESCRITO pela task**: `FieldError` — descartado |
| `brand.orange-dark` #c44a10 | `surface.card` #ffffff | texto | **4.85** | 4.5 | PASSA | **ADOTADO**: `FieldError` |
| `brand.orange` #e05a1e | `brand.purple-light` #ede9fe | texto | **3.13** | 4.5 | **REPROVA** | **PRESCRITO pela task**: variante `error` do `AlertMessage` — descartado |
| `brand.orange-dark` #c44a10 | `brand.purple-light` #ede9fe | texto | **4.08** | 4.5 | **REPROVA** | alternativa avaliada para o `AlertMessage` error — também descartada |
| `ink.muted` #9896b0 | `surface.card` #ffffff | texto | **2.87** | 4.5 | **REPROVA** | **PRESCRITO pela task**: subtítulo do `AuthCard` — descartado |
| `ink.mid` #4b4869 | `surface.card` #ffffff | texto | **8.64** | 4.5 | PASSA | **ADOTADO**: subtítulo do `AuthCard`; `AlertMessage` info |
| `ink.muted` #9896b0 | `surface.input` #f8f7fc | texto | **2.69** | 4.5 | **REPROVA** | **PRESCRITO pela task**: placeholder — descartado |
| `ink.mid` #4b4869 | `surface.input` #f8f7fc | texto | **8.11** | 4.5 | PASSA | **ADOTADO**: placeholder |
| `brand.purple` #7c3aed | `surface.card` #ffffff | texto | **5.70** | 4.5 | PASSA | hover do ícone do olho sobre o cartão |
| `ink.muted` #9896b0 | `surface.input` #f8f7fc | não-texto | **2.69** | 3.0 | **REPROVA** | **PRESCRITO pela task**: ícone do olho — descartado |
| `ink.mid` #4b4869 | `surface.input` #f8f7fc | não-texto | **8.11** | 3.0 | PASSA | **ADOTADO**: ícone do olho |
| `brand.purple` #7c3aed | `surface.input` #f8f7fc | não-texto | **5.35** | 3.0 | PASSA | borda de foco do input (lado interno) |
| `brand.purple` #7c3aed | `surface.card` #ffffff | não-texto | **5.70** | 3.0 | PASSA | borda de foco do input (lado externo) |
| `brand.orange` #e05a1e | `surface.input` #f8f7fc | não-texto | **3.49** | 3.0 | PASSA | borda de erro do input; borda do `AlertMessage` error |
| `brand.purple` #7c3aed | `brand.purple-light` #ede9fe | não-texto | **4.80** | 3.0 | PASSA | borda do `AlertMessage` success |
| `hairline` #e4e2f0 | `surface.input` #f8f7fc | não-texto | **1.20** | 3.0 | **REPROVA** | borda de repouso do input — **reprovação aceita, ver abaixo** |
| `hairline` #e4e2f0 | `surface.card` #ffffff | não-texto | **1.28** | 3.0 | **REPROVA** | borda do `AlertMessage` info — **reprovação aceita, ver abaixo** |
| `paw` #b0aec8 | `surface.canvas` #dde0ea | não-texto | **1.64** | 3.0 | (isento) | pegadas decorativas — SC 1.4.11 isenta decoração sem informação |

### Decisões tomadas

**1. `FieldError` usa `brand.orange-dark` (#c44a10), não `brand.orange` (#e05a1e).** A task prescrevia `text-brand-orange`. Medido: **3.72:1**, reprova. E é o pior caso possível — cor de mensagem de erro em texto de **0.75rem (12px)**, o menor da interface, exatamente o que precisa ser legível. `brand.orange-dark` dá **4.85:1** e passa. Não é cor nova: já é token do design system (o focinho do logo). A borda do input permanece em `brand.orange`, onde é **elemento gráfico** e o limiar é 3:1 (3.49:1, passa) — o laranja da marca segue sendo o sinal de erro, só não é mais o texto.

**2. Subtítulo do `AuthCard` e placeholder usam `ink.mid`, não `ink.muted`.** A própria task já autorizava essa troca ("Se `ink.muted` sobre `surface.input` não atingir, usar `ink.mid` para texto informativo e reportar"). Reportando com números: `ink.muted` dá **2.87:1** sobre branco e **2.69:1** sobre `surface.input` — reprova nos dois. `ink.mid` dá **8.64:1** e **8.11:1**. Custo visual assumido: o placeholder fica visivelmente mais escuro que no mockup. Legibilidade acima de fidelidade cromática, com a identidade preservada (é um token da mesma família).

**3. Variante `error` do `AlertMessage` não usa laranja como texto — nenhum laranja serve.** A task prescrevia texto `brand.orange` sobre `brand.purple-light`: **3.13:1**, reprova. Testei a alternativa óbvia, `brand.orange-dark` sobre o mesmo fundo: **4.08:1**, **também reprova**. Conclusão medida: **não existe laranja do design system legível sobre o lilás**. Solução adotada, que mantém o laranja como **sinal** e não como texto: fundo `surface.input`, **borda** `brand.orange` (3.49:1, acima do mínimo de 3:1 para elemento não-textual) e **texto `ink`** (15.74:1). A cor também não é o único indicador — o conteúdo da mensagem carrega o significado (WCAG 1.4.1).

**4. Ícone do olho usa `ink.mid`, não `ink.muted` — divergência que a task não pediu.** A task prescrevia `text-ink-muted hover:text-brand-purple`. O ícone do olho é um **controle de interface**, não decoração: cai no SC 1.4.11 (Non-text Contrast, 3:1). `ink.muted` sobre `surface.input` dá **2.69:1** e reprova até esse limiar mais frouxo. `ink.mid` dá **8.11:1**. O hover em `brand.purple` foi mantido (5.35:1 sobre o campo).

### Reprovação aceita e declarada

**`hairline` (#e4e2f0) como borda de repouso do input: 1.20:1 sobre `surface.input`, e 1.28:1 sobre `surface.card` na borda do `AlertMessage` info. Ambas reprovam o SC 1.4.11 (3:1) e permanecem no código.** Por quê:

- Corrigir exigiria **alterar o token `hairline` no `tailwind.config.js`**, que esta task proíbe explicitamente ("Não toque em `tailwind.config.js`") e cuja rastreabilidade valor-a-valor até o `reference.html` foi certificada na TASK-FRONTEND-008. Escurecer a borda localmente, com valor fora do token, violaria a AC 11.
- A mitigação real, já presente: o campo **não** depende da borda para ser identificado — tem fundo `surface.input` distinto, placeholder legível a 8.11:1 e `<label>` associado no DOM. E o **estado de foco**, que é o que o SC 1.4.11 mais cobra, passa com folga (borda `brand.purple` a 5.35:1 interno / 5.70:1 externo, mais o anel de 3px).
- **Recomendação para a próxima task de design system**: revisitar o token `hairline` (ou introduzir um `hairline-strong`) para conformidade plena de 1.4.11. Registrado abaixo como PENDÊNCIA-A.

Nenhum outro par reprova. Nenhum número acima foi estimado — todos saíram do cálculo, e as cores efetivamente aplicadas foram reconferidas como **estilo computado no navegador** (`rgb(196, 74, 16)` no `FieldError`, `rgb(75, 72, 105)` no placeholder e no ícone do olho, `rgb(30, 27, 46)` no `AlertMessage` error).

---

## Notes

- **DECISÃO-001 — `TextField` ganhou uma prop `trailing?: ReactNode`, não prevista no plano.** O plano dizia que o `PasswordField` "reaproveita a estrutura do `TextField`", sem dizer como. Duas saídas existiam: (a) duplicar no `PasswordField` o wrapper, o `<label>` e a lógica de `aria-invalid`/`aria-describedby`; (b) dar ao `TextField` um slot para o botão. Escolhi (b). Razão de fundo: a lógica duplicada em (a) é **exatamente** o que os ACs 2 e 3 verificam — dois lugares para o mesmo requisito de acessibilidade divergirem no primeiro ajuste. Com (b), o `PasswordField` tem 0 linhas de ARIA e o comportamento medido nos ACs 2/3 vale automaticamente para o campo de senha. Custo: uma prop opcional a mais na superfície do `TextField`. `trailing` é destructurada e **nunca** chega ao DOM (nenhum aviso de prop desconhecida no console — 0 avisos).

- **DECISÃO-002 — o wordmark "CatDog" é `aria-hidden="true"`.** O plano manda o SVG do logo ter `role="img"` + `<title>CatDog</title>`, e manda o ícone vir "acompanhado do texto CatDog". Cumprir os dois literalmente faz o leitor de tela anunciar **"CatDog CatDog"**. Mantive o `role="img"` + `<title>` como prescrito (é o nome acessível quando o logo é usado sozinho, o que a TASK-FRONTEND-011 vai fazer em cabeçalhos de layout) e marquei o texto visível como `aria-hidden`. Remove a duplicata, não a informação: o nome acessível continua existindo, uma vez.

- **DECISÃO-003 — `CatDogLogo` não carrega margem externa; o `AuthCard` aplica o `mb-[22px]`.** O `.logo` do mockup tem `margin-bottom: 22px`, mas esse espaçamento é do cartão, não da marca. Embutir a margem no logo o tornaria inutilizável nos cabeçalhos de layout da TASK-FRONTEND-011, que precisam de outro espaçamento. O valor de 22px do mockup foi preservado — só mudou de dono.

- **DECISÃO-004 — verificação de navegador feita substituindo `src/App.tsx` por uma sondagem temporária, e restaurando.** Os 8 componentes não são importados por nenhuma página (não existe página ainda), então não entram no bundle e não há o que carregar no navegador. Uma página de sondagem **fora** do repositório não funcionaria: precisaria do pipeline do Vite, do alias `~/` e do Tailwind com o `content` deste serviço. Substituí o `App.tsx`, montei os 8 componentes com contadores de submissão e um botão de remontagem, medi tudo, e restaurei. **Prova de restauração**: `git checkout -- services/frontend/src/App.tsx`, seguido de `md5sum` = `1fbd79cb08c551369b95a08c8cee8bc8` — **idêntico** ao hash capturado antes de qualquer modificação — e `diff -q` contra a cópia guardada fora do repositório: sem diferença. `git status` final não lista `App.tsx`.

- **DECISÃO-005 — `SubmitButton` recebeu `loadingLabel?: string` com default `'Aguarde…'`.** O plano pede "trocar o rótulo por um texto de progresso" sem nomear o texto. Um default cobre o caso comum e a prop deixa a TASK-FRONTEND-012 usar "Entrando…" / "Criando conta…", que são mais informativos por tela. Sem a prop, cada página teria de reimplementar o botão para mudar uma palavra.

- **DECISÃO-006 — `type` mantido para os tipos de props, contrariando `@typescript-eslint/consistent-type-definitions` (6 achados).** Mesma recusa da DECISÃO-005 da TASK-FRONTEND-008, pelas mesmas duas razões: coerência com o `env.ts` e com o backend; e `interface` é **aberta a declaration merging**, `type` não — props de componente são contrato fechado. Três dos oito arquivos usam interseção (`type X = {...} & InputHTMLAttributes<...>`), que `interface` não expressa trivialmente, então convertê-los produziria estilos divergentes dentro da mesma pasta. A regra vem do preset *stylistic* de um linter que **não é política deste projeto** — não há ESLint no repositório.

- **DECISÃO-007 — `''` conta como ausência de erro no `TextField`.** Bibliotecas de formulário costumam devolver string vazia para campo válido. Se `''` fosse tratado como erro, o campo receberia `aria-invalid="true"` estando correto, e um `<p>` vazio entraria no DOM como descrição. Normalizar para `undefined` também deixa o TypeScript estreitar o tipo no ponto de renderização, dispensando checagem redundante.

- **DECISÃO-008 — `right-[1px]` no botão do olho, com a aritmética comentada no código.** O alvo de toque exigido é 44×44px (`h-11 w-11`), mas o mockup posiciona o ícone de 18px a 14px da borda, isto é, com centro a 14 + 9 = 23px. Uma caixa de 44px centrada nesse ponto começa a 23 − 22 = **1px** da borda. O número parece arbitrário sem a conta, por isso ela está no comentário. Medido no navegador: botão de **44×44px** com ícone de **18px**. O input ganhou `pr-[40px]` para o texto digitado não passar por baixo do ícone.

- **DECISÃO-009 — o botão do olho conserva o anel de foco padrão do navegador.** Não apliquei `outline-none` nele. O `shadow-focus-ring` do design system é `rgba(124,58,237,0.10)` — 10% de alfa, indicador de foco fraco demais para um controle sem borda própria. Medido com foco: `outline: auto 1px rgb(11, 87, 208)`, o anel nativo, visível. No input a troca é legítima porque **a borda inteira** muda para `brand.purple` (5.35:1), aí o anel é reforço, não o indicador.

- **OBSERVAÇÃO-A — as rotações das pegadas são literais, e isso é pré-requisito de duas tasks.** O `reference.html` sorteia `Math.random() * 60 - 30` por pegada. As 16 rotações agora são constantes na mesma faixa (−28 a +29 graus), com as **coordenadas do mockup preservadas**. Além do AC 8, isso é o que torna possível o snapshot da TASK-FRONTEND-013 e o que evita as pegadas "saltarem" na dupla montagem do `StrictMode`.

- **OBSERVAÇÃO-B — `prefers-reduced-motion` não foi duplicado por componente.** Já é tratado globalmente em `src/styles/index.css` por seletor universal com `animation: none !important`, verificado na TASK-FRONTEND-008. A única animação deste slice é o `animate-fadeUp` do `AuthCard`, coberto por aquele bloco. Repetir a media query por componente criaria duas fontes de verdade para a mesma preferência.

- **OBSERVAÇÃO-C — bordas de 1.5px são reportadas como 1px pelo navegador.** `getComputedStyle` devolve o **valor usado**, e o Chrome arredonda largura de borda para pixel de dispositivo (DPR 1). A **declaração** está correta no CSS gerado (`.border-\[1\.5px\]{border-width:1.5px}`) e o `reference.html` se comporta igual. Registrado para que a próxima medição não interprete isso como divergência do mockup.

- **PENDÊNCIA-A — token `hairline` reprova o SC 1.4.11 (1.20:1 / 1.28:1).** Detalhamento e mitigação na seção *Contraste*. Fora do escopo desta task, que proíbe alterar `tailwind.config.js`. Recomendação: avaliar um `hairline-strong` na próxima task de design system, ou aceitar formalmente a não conformidade em decisão de produto.

- **PENDÊNCIA-B — `sonar-project.properties` ainda não inclui `services/frontend/src`.** **Não alterado**, por não constar na tabela *Files* e por proibição explícita. Herdada da PENDÊNCIA-E da TASK-FRONTEND-008.

- **RISCO ACEITO — `npm audit`: 4 vulnerabilidades** nas majors prescritas pelo `stack.md` (Vite 5, React Router 6). Não corrigidas; risco já aceito e registrado na TASK-FRONTEND-008. **Este slice não adicionou nenhuma dependência**, portanto não alterou a superfície.

- **Estado do ambiente ao encerrar.**
  - Processo `vite` (5173) subido nesta sessão: **encerrado** (PIDs 1507060/1507061 identificados por `pgrep` e confirmados como iniciados por esta sessão antes do `kill`). Porta **5173 verificada livre** depois. Nenhum processo do desenvolvedor foi tocado.
  - **`.playwright-mcp/` foi criado na raiz do repositório** pelo servidor MCP (logs de console e snapshots de página) e **removido** — movido para fora do repositório. A screenshot de registro, que o Playwright gravou na raiz como `catdog-task009-sonda.png`, também foi movida para fora. É a mesma armadilha registrada na TASK-FRONTEND-008: nenhum dos dois está no `.gitignore`.
  - Varredura final de resíduos por `*.png`, `*.bak`, `.eslintcache`, `nohup.out`, `eslint.config.*` e `.playwright-mcp` no repositório (excluindo `node_modules` e o `coverage/` preexistente do backend): **nenhum**.
  - Toolchain efêmera de ESLint instalada **fora do repositório**; nada adicionado a `package.json` ou `package-lock.json`.
  - Navegador: a aba aberta por mim foi **fechada**; a aba do desenvolvedor (Supabase, índice 0) permaneceu **intacta** e o **viewport nunca foi alterado**.
  - `git status` final lista exatamente: `services/frontend/src/components/` (8 arquivos novos) + este checklist. **Nenhum commit e nenhum push foram feitos** — as mudanças estão no working tree, na branch `master`. Nenhuma branch criada. `services/backend/`, `tailwind.config.js` e `sonar-project.properties` sem qualquer modificação.
