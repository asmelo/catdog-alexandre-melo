# Prompt de implementação — MODULE-002 (catálogo de pets)

> Cole o conteúdo a partir de "Você é o **orquestrador**" numa sessão nova do
> Claude Code, na raiz do projeto. Gerado em 2026-08-26, depois de as três
> features do módulo terem sido especificadas e quebradas em 40 tasks.

---


Você é o **orquestrador** da implementação do MODULE-002 (catálogo de pets) deste projeto. São 40 tasks já especificadas. Leve do início ao fim, sozinho.

**Não me peça aprovação em nenhuma etapa.** Decida o que precisar decidir. Só me interrompa se houver bloqueio real que impeça continuar (credencial ausente, decisão de produto que nenhuma spec cobre, spec internamente contraditória) — e, mesmo aí, faça primeiro tudo o que não depende da resposta.

## O seu papel: orquestrar, não implementar

**Você não escreve código de produção nem de teste.** Toda implementação e toda revisão acontece em subagente. O seu trabalho é: escolher a próxima task, delegar, conferir o resultado, commitar, e seguir para a seguinte.

Regras da orquestração, e elas não são flexíveis:

1. **Uma feature após a outra.** Só comece a próxima quando a anterior estiver 100% concluída, testada, revisada e commitada.
2. **Uma task após a outra.** Estritamente sequencial, na ordem declarada. **Nunca rode duas tasks em paralelo**, mesmo quando parecerem independentes.
3. **Sempre um agente NOVO para cada task.** Não reaproveite agente entre tasks, não continue um agente anterior por mensagem. Cada task começa com contexto limpo — é isso que evita que decisão da task 3 contamine a task 11.
4. **Um agente novo também para cada revisão**, e outro novo para cada rodada de correção.
5. **Mantenha o seu próprio contexto enxuto.** Não leia os `spec_context.md` inteiros (são 700 a 1400 linhas cada) nem os arquivos de código. Passe os **caminhos** para o agente e deixe que ele leia. Você só precisa do título da task e da seção `Dependencies` dela para montar a delegação e saber a ordem.

## Onde está o trabalho

`.makuco/specs/module_002_catalogo_pets/`

| Ordem | Feature | Tasks |
|---|---|---|
| 1º | `feature_001_cadastro_especies` | 11 (`task_001` a `task_011`) |
| 2º | `feature_002_cadastro_animais` | 18 (`task_001` a `task_018`) |
| 3º | `feature_003_vitrine_loja_cliente` | 11 (`task_001` a `task_011`) |

Cada feature tem `spec_context.md` (fonte da verdade), `changelog_context.md` (decisões de arquitetura já tomadas, com as alternativas descartadas), `checklists/requirements.md`, `assets/` (capturas do produto) e `tasks/`.

**A ordem entre features não é preferência:** animais depende da tabela `species`, do `GET /api/species` e da sidebar que espécies entrega; a vitrine depende do `SelectField` e do `Pagination` que animais entrega. Fora dessa ordem, o escopo das tasks de frontend infla — e as próprias tasks avisam isso.

Dentro de cada feature, a ordem está na seção `Dependencies` de cada task. Siga-a, mas **sem paralelizar**, mesmo onde a task disser que há paralelismo possível.

## O ciclo de cada task

Para **cada** task, nesta ordem:

**1. Delegue a implementação para um `makuco-codegen` novo.** No prompt do agente, inclua:
- o caminho do arquivo da task, mandando lê-lo por inteiro;
- o caminho do `spec_context.md` e do `changelog_context.md` da feature, mandando ler **antes** de escrever código — as decisões dos changelogs estão fechadas e justificadas, e não devem ser reabertas;
- a instrução de rodar teste e typecheck do serviço afetado antes de se declarar pronto;
- a instrução de que ele **não** delegue subagentes de recon (o contexto necessário está nos arquivos indicados);
- a instrução de escrever os arquivos incrementalmente, para que uma queda não perca tudo.

**2. Confira o resultado você mesmo**, sem confiar apenas no relato do agente:
```bash
# backend
cd services/backend && npm test && npm run typecheck
# frontend
cd services/frontend && npm test && npm run typecheck
```
Node 20 é obrigatório (`engines: >=20 <21`). Se `node -v` mostrar outra versão, `nvm use 20` primeiro. Cobertura mínima de 80% nos dois serviços é **gate**, não sugestão. Se o agente disse que passou e não passou, trate como task não concluída.

**3. Delegue a revisão para um `makuco-reviewer` novo.** Ele revisa contra a task e a spec e escreve o parecer no próprio arquivo da task.

**4. Se a revisão apontar problema, delegue a correção para um `makuco-codegen` novo** (não o mesmo que implementou), rode os testes de novo e revise de novo. Repita até limpar. **Não acumule pendência para depois.**

**5. Commite a task individualmente.** Conventional Commits em PT-BR sem acento, com o identificador da task na mensagem — veja `git log` para o formato exato do projeto. Uma task por commit, nunca várias juntas.

**6. Registre o progresso** em `.makuco/handoff/implementacao-module-002.md`: task concluída, resultado dos testes, decisões tomadas fora da spec, problemas encontrados. Atualize a cada task.

Esse arquivo é a sua rede de segurança: se o seu contexto for resumido no meio do caminho, é por ele que você sabe onde estava. **Leia-o antes de escolher a próxima task**, sempre.

Ao final de **cada feature** (não a cada commit), suba para o remoto. Estamos em `main` e é o fluxo do projeto — commite direto nela.

## Contexto do projeto

- **Stack:** TypeScript 5 + Node 20. Backend Express 4 + Prisma 5 + Supabase Postgres em `services/backend`. Frontend React 18 + Vite 5 + Tailwind 3 em `services/frontend`. Jest 29 nos dois. Alias `~/` → `src/`.
- **A feature de autenticação já existe e funciona — não a refaça.** Ela é a referência de qualidade: `services/backend/src/domains/auth/` e as tasks de `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/tasks/`. Aponte isso para os agentes.
- **Regras não negociáveis:** proibido `any`; `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` ligados; documentação, mensagens de erro e UI em PT-BR.
- O `MAKUCO.md` ainda diz que os serviços estão vazios — está desatualizado, a autenticação está no ar. Se sobrar espaço no fim, atualizar é bem-vindo (delegando ao `makuco-project-research`).

## Invariantes de arquitetura declaradas no próprio código — repasse aos agentes

1. `error-handler.middleware.ts` é o **único** lugar autorizado a montar corpo de resposta de erro. O resto lança subclasse de `AppError`.
2. `src/config/env.ts` é o **único** ponto que lê `process.env`. Variável nova entra lá (Zod, derrubando o boot) e no `.env.example`.
3. Controller não acessa Prisma e não tem regra de negócio: chama exatamente **um** service.
4. Repositório nunca lança erro HTTP — ausência é `null`, e quem decide se `null` é problema é o service. E expõe `withTransaction(tx)`.
5. Texto ao usuário vive em `<dominio>.messages.ts`; o frontend ramifica por `code`, **nunca** por `message`. Não duplique no frontend mensagem que o backend devolve.
6. Use `~/utils/clock.ts` (`now()`, `addDays()`) em vez de `new Date()` — é o que permite os testes espionarem o relógio, e o cálculo de idade da vitrine depende disso.
7. `services/frontend/src/services/api/http-client.ts` tem fila single-flight de refresh: duas renovações simultâneas derrubam a família de tokens inteira. **Só a task 012 da feature de animais mexe nele**, e declara a fila como intocável byte a byte.

## Três armadilhas já mapeadas — repasse ao agente da task correspondente

- **`nameNormalized` (animais) ≠ `name_search` (vitrine).** O primeiro é minúsculo mas **preserva acentos**, de propósito, para a ordenação administrativa. Tratar os dois como a mesma coisa quebra a feature de animais sem nenhum teste acusar.
- **`Cascade` é proibido na FK Animal→Espécie, mas é o correto na FK Animal→Imagem.** A proibição não é global — imagem não tem vida própria fora do animal.
- **`/admin/animais` aparece na sidebar antes de existir a página** (decisão da task 007 de espécies). O link cai na 404 administrativa até animais entregar a tela. É transitório e esperado — não "conserte" apontando para outro lugar.

## Duas dívidas que são entrega obrigatória

1. **Task 010 da feature de animais** quita a dívida de espécies: a regra "espécie com animais vinculados não pode ser excluída" só pôde ser testada com dublê, porque Animal não existia. Precisa ser reexecutada contra a **tabela real e a constraint real do Postgres** (CT-81 a CT-86). **Não aceite dublê aqui** — confira você mesmo que o teste toca o banco.
2. A mesma task registra em `.makuco/codebase/technical-debt.md` a dívida equivalente do módulo de Pedidos **antes** de contraí-la. Não pule.

## O que eu quero no final

Um relato consolidado: tasks concluídas por feature, resultado dos testes e da cobertura por serviço, decisões tomadas fora da spec, e o que ficou pendente ou bloqueado com o motivo. Se alguma task não pôde ser concluída, quero saber qual e por quê — não uma versão parcial apresentada como pronta.
