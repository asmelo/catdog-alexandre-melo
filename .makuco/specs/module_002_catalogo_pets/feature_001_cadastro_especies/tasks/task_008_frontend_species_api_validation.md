# TASK-FRONTEND-008 — Camada de API de espécies, validação de formulário e catálogo de textos

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-008-frontend-species-api-validation`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 8 of 11 — Camada de dados do frontend
**Generated**: `2026-08-25`

---

## Context

Entrega o material que as duas telas da feature consomem: uma função por endpoint de `/api/species`, a validação local do nome e os textos estáticos em PT-BR. Nenhum componente entra aqui. O ponto de disciplina é o catálogo: mensagem que o backend devolve **não** pode ser duplicada em `messages.ts` — a interface ramifica por `code` e exibe o `message` que veio da API.

---

## Scope

**In:** `src/services/api/species-api.ts`, extensão de `src/utils/validation.ts` com a validação do nome de espécie e extensão de `src/utils/messages.ts` com os textos que **só** existem na tela.

**Out:** Nenhum componente, página ou estado de React. Não tratar erro dentro de `species-api.ts` — o `ApiError` sobe para a tela, como em `auth-api.ts`. Não desembrulhar o `{ items }` da listagem (ver decisão abaixo). Não alterar `http-client.ts`, `api-error.ts` nem `access-token-store.ts`. Não copiar para `messages.ts` nenhuma frase que o backend já devolve. Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/services/api/species-api.ts` | quatro endpoints de espécie |
| `modify` | `src/utils/validation.ts` | validação do nome |
| `modify` | `src/utils/messages.ts` | textos da tela |

---

## Implementation

> **Reference pattern**: `src/services/api/auth-api.ts` (uma função por endpoint, sem estado e sem tratamento de erro), `src/utils/validation.ts` (funções puras devolvendo `FieldErrors`) e o cabeçalho de `src/utils/messages.ts` (a regra de não duplicar texto do backend está escrita lá).

### `src/services/api/species-api.ts` *(create)*
- Tipos: `Species { id; name; createdAt; updatedAt }` e `SpeciesListResponse { items: ReadonlyArray<Species> }`.
- Quatro funções, todas sobre `request<T>` de `~/services/api/http-client`:
  - `listSpecies(): Promise<SpeciesListResponse>` → `request('/species')`;
  - `createSpecies(name: string): Promise<Species>` → `POST /species`, corpo `{ name }`;
  - `renameSpecies(id: string, name: string): Promise<Species>` → `PATCH /species/${id}`, corpo `{ name }`;
  - `deleteSpecies(id: string): Promise<void>` → `DELETE /species/${id}`.
- **`listSpecies` devolve o envelope inteiro, não `items`** — mesma decisão de `auth-api.ts`, que não desembrulha sucesso. O envelope existe justamente para ganhar metadados no futuro; desembrulhar aqui obrigaria a mudar a assinatura no dia em que isso acontecer.
- Corpo montado campo a campo (`body: { name }`), nunca `body: valores`: o backend recusa qualquer chave extra com `400 VALIDATION_ERROR` (RN-13), e copiar explicitamente faz o compilador barrar a mudança antes de o servidor barrar a requisição — mesma justificativa registrada em `register`.
- **Não** passar `skipRefresh`: os quatro endpoints exigem `Authorization` e um `401` aqui é exatamente o gatilho legítimo de renovação de sessão.
- `deleteSpecies` é `Promise<void>` porque o contrato é `204 No Content` — o `request` já trata resposta sem corpo (`logout` faz o mesmo).
- Interpolar o `id` direto no caminho é seguro: ele vem de um item da lista devolvida pela própria API, nunca de entrada do usuário, e o backend rejeita com `400` o que não for UUID. Nenhum construtor de query string é necessário — a listagem não tem parâmetros (RN-12), e o `http-client` não oferece um.

### `src/utils/validation.ts` *(modify)*
- Acrescentar `normalizeSpeciesName(bruto: string): string` (trim + colapso de espaços internos) e `validateSpeciesNameForm(values: { name: string }): FieldErrors`, com a mesma precedência de mensagens do backend: vazio após normalizar → obrigatório; `< 2` → mínimo; `> 60` → máximo.
- A normalização local **espelha** a RN-03 do servidor e não a substitui: ela existe para que a contagem de caracteres bata com a do backend antes da requisição. O servidor continua sendo a autoridade — o texto enviado é o que o usuário digitou, e é o backend que grava a forma normalizada.
- Manter as funções puras (sem React), como as três já existentes — é isso que as torna testáveis isoladamente e reutilizáveis pela criação e pela edição em linha.
- Devolver o mesmo formato de mapa `campo → mensagem` que `fieldErrorsOf(apiError)` produz a partir de `details[]`, para que a tela use um caminho único de exibição de erro de campo.

### `src/utils/messages.ts` *(modify)*
- Acrescentar um bloco `SPECIES` com **apenas** o que não existe em nenhuma resposta da API:
  - `PAGE_TITLE: 'Espécies'`, `NAME_PLACEHOLDER: 'Nome de espécie'`, `CREATE_BUTTON: 'Criar'`, `SAVE_BUTTON`, `CANCEL_BUTTON`, `EDIT_ACTION`/`DELETE_ACTION` (usados para compor o nome acessível dos ícones), `LIST_LABEL`;
  - `CREATE_SUCCESS: 'Espécie criada com sucesso.'`, `UPDATE_SUCCESS: 'Espécie atualizada com sucesso.'`, `DELETE_SUCCESS: 'Espécie excluída com sucesso.'` — as três são **texto de tela**: `POST` devolve o recurso e `DELETE` devolve `204`, então nenhuma resposta as carrega;
  - `EMPTY_LIST: 'Nenhuma espécie cadastrada ainda. Crie a primeira acima.'` e `LOAD_ERROR: 'Não foi possível carregar as espécies. Tente novamente.'` — nascem de ausência de resposta útil, não de corpo de erro;
  - `LOADING_LABEL`, `RETRY_BUTTON`;
  - `deleteConfirmation(nome: string): string` devolvendo `` `Excluir a espécie “${nome}”? Esta ação não pode ser desfeita.` `` — **função** e não template solto, porque a frase interpola o nome e precisa sair idêntica em toda chamada. Usar as **aspas curvas** `“ ”` da spec, não `" "`.
- Reusar `MESSAGES.VALIDATION.FIELD_REQUIRED` existente para o campo em branco; acrescentar apenas `NAME_TOO_SHORT` e `NAME_TOO_LONG` ao bloco `VALIDATION`, com os literais da spec.
- **Não** acrescentar nenhuma mensagem que a própria API devolva. São **sete**, nomeadas aqui pela chave de origem para que nem esta task as transcreva: do `species.messages.ts` do backend, `NAME_ALREADY_EXISTS` (`code` `SPECIES_NAME_ALREADY_EXISTS`), `SPECIES_NOT_FOUND` (`code` homônimo), `SPECIES_IN_USE` (`code` homônimo), `INVALID_ID` e `FIELD_NOT_ALLOWED` (estas duas chegam dentro do `details` de um `VALIDATION_ERROR`); dos middlewares transversais, `FORBIDDEN` e `SESSION_EXPIRED`. Todas chegam prontas em `ApiError.message` e a tela ramifica pelo `code`, nunca pelo texto (CA-22).
- Registrar essa lista em comentário com o mesmo **propósito** do bloco "O QUE NÃO ESTÁ AQUI" já presente no arquivo — dizer o que não está ali e por quê —, identificando cada mensagem pela **chave de origem** e pelo **`code`**, **sem transcrever a frase**.

> **Emenda de 2026-08-26 — rodada de revisão 1, decisão 2.** A redação original desta seção mandava registrar a lista "no mesmo **formato** do bloco 'O QUE NÃO ESTÁ AQUI'", e aquele bloco (`messages.ts` L12-20) **transcreve as frases literalmente**. Seguida à risca, ela levaria as frases de `NAME_ALREADY_EXISTS`, `SPECIES_NOT_FOUND` e `SPECIES_IN_USE` para dentro de `messages.ts` e **reprovaria o critério de aceite 11**, que exige **zero** ocorrências dessas três buscas no arquivo — isto é, a task reprovava a implementação correta. Emendado: "formato" vira **propósito**, e o registro passa a ser por chave de origem e `code`, sem transcrição.
>
> A lista original também estava **incompleta**: omitia `INVALID_ID` e `FIELD_NOT_ALLOWED`, que o backend igualmente devolve (dentro do `details` de um `VALIDATION_ERROR`, `species.validators.ts`). A implementação as acrescentou por conta própria — **e isso está correto**: são sete mensagens a não duplicar, não cinco. A contagem "sete" registrada no comentário de `messages.ts` é a certa.

---

## Acceptance Criteria

- [ ] **Given** `listSpecies()`, **When** chamada, **Then** dispara `GET` para `/species` sem query string e devolve o objeto `{ items }` **sem** desembrulhar.
- [ ] **Given** `createSpecies("Gato")`, **When** chamada, **Then** o corpo enviado é exatamente `{"name":"Gato"}` — nenhuma chave adicional.
- [ ] **Given** `renameSpecies(id, "Gato")`, **When** chamada, **Then** o método é `PATCH` e o caminho é `/species/${id}` — nenhuma função do arquivo usa `PUT`.
- [ ] **Given** `deleteSpecies(id)`, **When** a API responde `204` sem corpo, **Then** a promessa resolve sem erro de parsing.
- [ ] **Given** a API respondendo `409`, **When** qualquer função é chamada, **Then** o `ApiError` **sobe** para quem chamou — nenhuma função de `species-api.ts` contém `try/catch`.
- [ ] **Given** `validateSpeciesNameForm({ name: "   " })`, **Then** devolve `{ name: "Este campo é obrigatório." }` (CT-03).
- [ ] **Given** `validateSpeciesNameForm({ name: "G" })`, **Then** `{ name: "O nome da espécie deve ter no mínimo 2 caracteres." }`; **Given** `"Ov"`, **Then** mapa vazio (CT-04 / CT-05).
- [ ] **Given** nome com 61 caracteres, **Then** `{ name: "O nome da espécie deve ter no máximo 60 caracteres." }`; **Given** exatamente 60, **Then** mapa vazio (CT-06 / CT-07 / RN-02).
- [ ] **Given** `" Cão   Pastor "`, **When** normalizado localmente, **Then** o resultado é `"Cão Pastor"` e tem 10 caracteres para efeito de contagem — a contagem local usa a forma normalizada, igual à do servidor (CT-10 / CA-07).
- [ ] **Given** `MESSAGES.SPECIES.deleteConfirmation("Gato")`, **Then** devolve exatamente `Excluir a espécie “Gato”? Esta ação não pode ser desfeita.` com aspas curvas (CA-13).
- [ ] **Given** `src/utils/messages.ts`, **When** buscado por "Já existe uma espécie", "Espécie não encontrada" ou "animais vinculados", **Then** nenhuma ocorrência é encontrada.
- [ ] `src/services/api/http-client.ts` e `src/services/api/api-error.ts` estão inalterados.

---

## API Notes

- Base já resolvida pelo `http-client` — os caminhos passados são relativos a `/api`.
- `GET /species` → `{ items }`; `POST /species` → `201` recurso plano; `PATCH /species/:id` → `200` recurso plano; `DELETE /species/:id` → `204` sem corpo.
- **Códigos que a tela ramifica**: `VALIDATION_ERROR` (distribuir `details` pelos campos via `fieldErrorsOf`), `SPECIES_NAME_ALREADY_EXISTS`, `SPECIES_NOT_FOUND`, `SPECIES_IN_USE`, `FORBIDDEN`, `SESSION_EXPIRED`. Sempre por `code`, nunca pelo texto de `message` (CA-22).

---

## Dependencies

- **Requires**: TASK-BACKEND-002 a 004 (contratos publicados), FEATURE-002 (`request`, `ApiError`, `fieldErrorsOf`).
- **Blocks**: TASK-FRONTEND-009 e TASK-FRONTEND-010 (as telas consomem estas funções), TASK-FRONTEND-011 (testes).

---

## Code Review

### Rodada de Revisão 1 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 3 arquivos entregues (`src/services/api/species-api.ts`, `src/utils/validation.ts`, `src/utils/messages.ts`) + 6 arquivos de contexto lidos por inteiro (`http-client.ts`, `auth-api.ts`, `api-error.ts`, `species.messages.ts`, `species-name.ts`, `species.validators.ts` do backend)

#### Resumo

Os **12 critérios de aceite** estão implementados e foram verificados por execução, não por leitura: `typecheck` exit 0, `npm test` **12 suítes / 160 testes** (baseline intacta) e uma sonda temporária que executou os CT-03 a CT-07, CT-10 e CA-13 contra as funções reais (sonda removida; árvore de trabalho contém apenas os 3 arquivos da task). A camada de API bate **exatamente** com o contrato do backend, incluindo a ausência de `nameNormalized` no tipo e o `204` que não passa pelo `json()`. Nenhum achado `critical` ou `major`. Dois `minor` e quatro `suggestion`, nenhum bloqueante.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/utils/validation.ts` | L150-152 e L164-168 | divergência de contrato / precisão de comentário | A cópia local da RN-03 **não reproduz o `higienizar` do backend**, que remove `U+00AD`, `U+200B–U+200F`, `U+2060` e `U+FEFF` **antes** de normalizar (`species.validators.ts:41-45`). O comentário de `erroDeNomeDeEspecie` afirma precedência "IDÊNTICA a do `speciesNameSchema`" e declara **uma única** omissão (a medição da chave), o que induz o leitor — e a TASK-FRONTEND-011 — a concluir equivalência no resto. **Medido**: `"A"×60 + U+200B` → local 61 (`NAME_TOO_LONG`), servidor 60 (**aceita**); `"A"×59 + U+2060×2` → local 61, servidor 59 (**aceita**); `"a﻿b"×30` → local **90**, servidor 60 (**aceita**), porque `\s` do JS casa `U+FEFF` e o converte em espaço em vez de removê-lo. É a direção que o próprio arquivo (comentário de `FORMATO_DE_EMAIL`, L50-53) declara ser "o pior defeito possível nesta camada": recusar no cliente o que o servidor aceitaria, e por caractere invisível o usuário não tem como contornar | Ou replicar `CARACTERES_INVISIVEIS` antes de `normalizeSpeciesName` (3 linhas, e as duas camadas voltam a concordar), ou — se a escolha for não replicar — corrigir o comentário para listar **as duas** omissões e dizer explicitamente que a divergência dos invisíveis é *client-stricter*, ao contrário da do `U+0130`. A segunda opção é suficiente para não bloquear |
| 2 | minor | `src/utils/messages.ts` | L252-266 (e L2, header) | escopo | Remoção do bloco `MESSAGES.ADMIN_HOME` (`TITLE: 'Painel administrativo'`, `GREETING: 'Você está autenticado como administrador'`) e reescrita do cabeçalho do arquivo e do comentário de `CLIENT_HOME`. É limpeza da **TASK-FRONTEND-007** (decisão 4 do changelog) executada sob a 008: a seção `Implementation` só manda **acrescentar**, e `## Files` justifica a modificação como "textos da tela". A remoção em si está **correta e verificada** — `git grep MESSAGES.ADMIN_HOME HEAD -- services/frontend/src` retorna vazio | Registrar a remoção no handoff/changelog atribuindo-a à decisão 4, para que o histórico da 007 não fique com um item de limpeza pendente sem rastro. Não desfazer |
| 3 | suggestion | `src/services/api/species-api.ts` | L101 | primitive obsession / assinatura frágil | `renameSpecies(id: string, name: string)` — dois posicionais do mesmo tipo. `renameSpecies(nome, id)` **compila**, e o defeito só aparece como `400 VALIDATION_ERROR` em runtime. `createSpecies`/`deleteSpecies` não têm o problema (um argumento só) | Objeto nomeado (`renameSpecies({ id, name })`) ou tipo *branded* para o identificador. Fora do escopo desta task; vale como padrão para o dia em que a segunda entidade do módulo chegar |
| 4 | suggestion | `src/services/api/species-api.ts` | L101, L114 | segurança (A03, defesa em profundidade) | `` `/species/${id}` `` sem `encodeURIComponent`. A justificativa registrada está **certa hoje** (o `id` vem de um item da lista da própria API e o backend recusa não-UUID com `400`), mas a garantia é *do chamador*, não da assinatura: um `id` vindo de `useParams` no futuro reescreveria o caminho | `encodeURIComponent(id)` — custo zero, e transfere a garantia do chamador para a função |
| 5 | suggestion | `src/utils/messages.ts` | L232 | linguagem ubíqua | `UPDATE_SUCCESS` para a operação que o resto do sistema chama de **renomear** (`renameSpecies`, `PATCH`, CT-16 "Renomear espécie", changelog decisão 3). O literal `'Espécie atualizada com sucesso.'` é congelado pela tabela da spec e **não pode mudar**; a divergência é só da chave. **A chave foi prescrita pela própria task**, então não é desvio do agente | `RENAME_SUCCESS`, mantendo o literal intacto. Exige corrigir a seção `Implementation` desta task junto |
| 6 | suggestion | `src/utils/validation.ts` | arquivo (288 linhas, era 188) | SRP / tamanho de entidade | O módulo passou a servir dois domínios: formulários de autenticação (FEATURE-002) e nome de espécie (MODULE-002). Ainda coeso — todas as funções produzem `FieldErrors` —, mas cruzou a faixa de ~150 linhas da diretriz e cresce a cada feature nova | Quando a terceira entidade chegar, extrair `species-validation.ts` reexportando `FieldErrors`/`erroDoCampo`. Prematuro agora |

#### Decisões declaradas — parecer

**1. `listSpecies` devolve o envelope `{ items }` — CORRETA, e a alegação de "surpresa para a 009" NÃO se confirma.**
A decisão 8 do changelog diz literalmente que o envelope existe porque "um array puro não admite metadados sem quebrar quem já o consome" — desembrulhar aqui anularia a razão de ele existir. E **não há surpresa alguma**: `task_009_...md` L42 já manda "`recarregar` chama `speciesApi.listSpecies()` e guarda `resposta.items`", e `task_011_...md` L56 já pede "teste explícito de que `listSpecies` devolve `{ items }` sem desembrulhar". As duas tasks a jusante foram escritas sobre este contrato. Está bem documentada — em três lugares.
**A alegação sobre o `auth-api.ts` procede**, com uma ressalva de precisão: nenhuma das sete funções daquele arquivo desembrulha campo de resposta de sucesso — `register`, `confirmEmail` e `resendConfirmation` devolvem `MessageResponse` (`{ message }`) inteiro em vez da string, e `login`/`refresh` devolvem `SessionResponse` inteiro. A postura ("o tipo de retorno é o corpo da resposta, verbatim") é a mesma. O que `auth-api.ts` **não** oferece é precedente de *envelope de coleção* — ele não tem nenhum, como a própria decisão 8 registra ("o projeto não possui nenhum endpoint de coleção"). O precedente citado é de postura, não de forma; a decisão não depende dele para se sustentar.

**2. Contradição interna da task — CONFIRMADA, e a resolução está CORRETA.**
A contradição é real e verificável: a seção `Implementation` manda registrar as mensagens "em comentário, no mesmo formato do bloco 'O QUE NÃO ESTÁ AQUI' já presente no arquivo", e aquele bloco (`messages.ts` L12-20) **transcreve literalmente** — "E-mail ou senha incorretos.", "Este e-mail já está em uso.", "Sua conta ainda não foi confirmada. Verifique seu e-mail." etc. Seguir o formato à risca transcreveria "Já existe uma espécie com este nome.", "Espécie não encontrada." e "Não é possível excluir esta espécie porque existem animais vinculados a ela.", e o critério de aceite 11 exige **zero** ocorrências dessas três buscas. As duas instruções não podem ser satisfeitas ao mesmo tempo para 3 das 5 frases listadas (as outras 2 — `FORBIDDEN` e `SESSION_EXPIRED` — não estão na busca do CA-11, e "Sua sessão expirou. Faça login novamente." aliás já vive legitimamente em `TEXTOS_COMPARTILHADOS_COM_O_BACKEND` L77).
A resolução — nomear pela **chave de origem** e pelo `code` (`messages.ts` L27-43) — satisfaz o CA-11 (verificado: `grep` retorna 0, e 0 também no `src/` inteiro), preserva a **função** do bloco original (dizer o que não está ali e por quê) e ainda **melhora sobre a task**: acrescenta `INVALID_ID` e `FIELD_NOT_ALLOWED`, que a `Implementation` esqueceu e que o backend também devolve, dentro do `details` de um `VALIDATION_ERROR`. Sete frases, e o comentário diz "sete". A justificativa registrada em L29-30 ("transcrevê-las, ainda que em comentário, é o primeiro passo para alguém copiar uma delas para dentro do catálogo") é o argumento certo.
**Pendência de texto, não de código**: a seção `Implementation` desta task deve ser corrigida para dizer "no mesmo *propósito* do bloco 'O QUE NÃO ESTÁ AQUI', nomeando as mensagens pela chave de origem e pelo `code` — sem transcrevê-las, por força do CA-11". Do jeito que está, ela reprova a implementação correta.

**3. Remoção de `MESSAGES.ADMIN_HOME` — alegação PROCEDE; a contagem está ligeiramente errada e a atribuição de task, também.**
Verificado: `git grep "MESSAGES.ADMIN_HOME" HEAD -- services/frontend/src` retorna **vazio** — não havia consumidor no commit anterior. As ocorrências restantes de `ADMIN_HOME` são **28** (não 25; eram 26 antes desta entrega, e 2 das 28 são o comentário novo que a própria remoção deixou em `messages.ts` L257-260). Todas são `ROUTE_PATHS.ADMIN_HOME` — o caminho, que segue vivo em `route-paths.ts:22` e é usado por `app-routes.tsx`, `role-route.spec.tsx`, `app-routes.spec.tsx`, `route-paths.spec.ts` e `login-page.spec.tsx` — exceto a definição em `route-paths.ts:22`, um comentário em `route-paths.ts:33` e o comentário novo. A divergência de contagem é imaterial; a conclusão está certa. O que fica é o achado **#2**: a limpeza é da 007, feita sob a 008.

**4. Segunda medição de tamanho do backend não reproduzida — decisão CORRETA, e pelo motivo certo.**
`speciesNameKey(nome).length > 60` (`species.validators.ts` L83-86) torna o **servidor mais estrito** que o cliente. Medido: `"İ"×60` → cliente 60 (aceita e envia), servidor mede a chave em **120** e devolve `400 VALIDATION_ERROR` com `NAME_TOO_LONG` — exatamente o literal que a função local emitiria. O custo é **uma viagem de rede** e a mensagem que chega é a correta. Replicar a regra traria uma regra de persistência do servidor (`VARCHAR(60)` sobre `name_normalized`) para dentro do cliente, que não tem como saber que ela existe. Decisão aprovada sem ressalva — **ela é a que está bem argumentada**. O problema não é essa omissão: é a **outra**, não declarada, do achado #1, que corre na direção oposta.

**5. Não normalizar antes de enviar — CORRETA.**
Coerente com a RN-03, que é regra do servidor ("o nome é *gravado* como digitado, aplicando-se apenas duas normalizações de forma"), e com o desenho do backend, onde `species.validators.ts` é o "ÚNICO ponto de normalização" e o `validateRequest` reatribui o resultado sobre `req.body`. Normalizar no cliente criaria uma segunda autoridade sobre a RN-03 sem nenhum mecanismo que a mantivesse alinhada — e, na prática, esconderia o achado #1 em vez de resolvê-lo, porque a forma enviada passaria a ser a forma medida localmente. Enviar o texto cru é o que mantém o servidor como autoridade e o erro visível.

**6. Literais que a spec não fixa — APROVADOS.**
`SAVE_BUTTON: 'Salvar'`, `CANCEL_BUTTON: 'Cancelar'`, `LIST_LABEL: 'Espécies cadastradas'`, `LOADING_LABEL: 'Carregando espécies…'` e `RETRY_BUTTON: 'Tentar novamente'` cobrem CA-10, CA-20, CT-36 e RNF-09 sem contradizer nada da spec. `LOADING_LABEL` usa reticências de um caractere (`…`), igual a `FORM.SENDING: 'Enviando…'` — consistente com o catálogo existente.
`EDIT_ACTION`/`DELETE_ACTION` como verbos soltos: **decisão certa**. O RNF-07 e o CA-21 exigem que o ícone seja anunciado identificando "a ação **e** a espécie", e a composição `${EDIT_ACTION} ${nome}` produz "Editar Gato" / "Excluir Gato", que atende. A alternativa "Editar espécie" produziria "Editar espécie Gato", que só soa aceitável por acidente de concordância — o comentário L219-226 registra exatamente esse raciocínio. **Ressalva de acompanhamento**: a composição é contrato implícito entre este catálogo e a TASK-FRONTEND-010; se ela montar o nome acessível de outra forma, o RNF-07 quebra sem que nada aqui reprove. A `task_010` deve fixar a forma `${EDIT_ACTION} ${nome}` explicitamente.

**7. `createdAt`/`updatedAt` como `string` — CORRETO.**
É o que trafega em JSON. Tipar como `Date` seria mentira de tipo: `JSON.parse` devolve string e o campo chegaria como `string` com tipo `Date`, um erro que só apareceria na primeira chamada a `.getTime()`. Nenhuma tela da feature exibe data (a spec não lista coluna de data em CA-03). Converter na borda só se justifica quando alguém formata — e ninguém formata.

#### Verificações especiais solicitadas

| Verificação | Resultado |
|---|---|
| Mensagens do backend **não** duplicadas no catálogo | **OK.** Conferidas uma a uma contra `services/backend/src/domains/species/species.messages.ts`: `NAME_ALREADY_EXISTS`, `SPECIES_NOT_FOUND`, `SPECIES_IN_USE`, `INVALID_ID` e `FIELD_NOT_ALLOWED` — **nenhuma** presente em `messages.ts` nem em `src/` inteiro. `FORBIDDEN` ("Você não tem permissão para acessar este recurso.") também ausente. `SESSION_EXPIRED` presente, mas é preexistente (L77) e justificada pelo caso em que a resposta já foi consumida pelo cliente HTTP |
| Textos duplicados legitimamente são idênticos caractere a caractere | **OK, conferido por comparação de codepoints.** `NAME_TOO_SHORT`, `NAME_TOO_LONG` e `FIELD_REQUIRED` (contra `NAME_REQUIRED` do backend): os três batem exatamente, acentos e ponto final inclusos. As três são verificadas **antes** da requisição (CT-03/CT-04/CT-07), então nenhuma resposta as carrega — a duplicação é a legítima |
| Nenhuma função com `try`/`catch` que engula o `ApiError` | **OK.** As três ocorrências de `try`/`catch`/`PUT` em `species-api.ts` estão **todas dentro de comentários** (L10, L93, L95). As quatro funções são `return request<T>(...)` de uma linha — o `ApiError` sobe intacto e a 009/010 pode ramificar por `code` |
| `http-client.ts` intocável (fila single-flight) | **OK.** `git diff --stat` de `http-client.ts`, `api-error.ts` e `access-token-store.ts` retorna **vazio**. A fila `renovacaoEmVoo` e a trava de sessão encerrada estão como a TASK-FRONTEND-005 as deixou |
| `request`, `ApiError` e `fieldErrorsOf` reusados, não recriados | **OK.** `species-api.ts` tem **um único import**: `request` de `~/services/api/http-client`. Não importa nem redefine `ApiError`, não define tratamento de erro, e `fieldErrorsOf` não é tocado. `validateSpeciesNameForm` devolve `FieldErrors` — o **mesmo tipo** que `fieldErrorsOf` produz, com a mesma chave `name` que o `details[].field` do backend usa, o que dá à tela um caminho único de exibição |
| Ordenação por locale, não binária | **OK.** `species-api.ts` L45-51 documenta a ordenação e diz `localeCompare` explicitamente, com o exemplo `Ágil, Cão, Cavalo, Gato, Zebra` — que é **exatamente** a saída medida contra o banco na rodada 2 da TASK-BACKEND-005 (Supabase, PostgreSQL 17.6, provider ICU, `en_US.UTF-8`). A premissa binária refutada **não sobreviveu** em nenhum ponto desta entrega. Nada aqui ordena de fato (a ordenação é do backend, `species.repository.ts:101`); o comentário apenas orienta a 009/010, e orienta certo |
| Proibido `any`; PT-BR; comentários sem acento, tela com acento | **OK.** Zero `any` nos três arquivos. Todo texto de tela em PT-BR com acentuação correta. Nos comentários **acrescentados**, os únicos caracteres acentuados estão dentro de literais citados como dado (`"Cão Pastor"`, `"Este campo é obrigatório."`, `` `İ` ``, `"Editar espécie"`, `` `Ágil, Cão, ...` ``) — mesmo tratamento já praticado no arquivo antes desta entrega (`validation.ts` L83) e a única forma de citar o dado sem falsificá-lo |

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12** critérios de aceite implementados, verificados por execução:

| CA | Verificação | Resultado |
|---|---|---|
| 1 | `listSpecies` → `GET /species`, sem query, devolve `{ items }` | `species-api.ts:69-71` — `request<SpeciesListResponse>('/species')`, método default `GET`, sem opções |
| 2 | `createSpecies("Gato")` → corpo exatamente `{"name":"Gato"}` | `species-api.ts:87` — `body: { name }`, campo a campo |
| 3 | `PATCH /species/${id}`; nenhuma função usa `PUT` | `species-api.ts:102`; `PUT` só aparece em comentário (L93, L95) |
| 4 | `deleteSpecies` resolve em `204` sem erro de parsing | `species-api.ts:115` (`request<void>`) + `http-client.ts` `interpretar` retorna `undefined as T` antes do `json()` |
| 5 | `ApiError` sobe; nenhuma função com `try/catch` | Nenhuma ocorrência em código; as 4 funções são `return request(...)` |
| 6 | `{ name: "   " }` → obrigatório | **Executado**: `{"name":"Este campo é obrigatório."}` |
| 7 | `"G"` → mínimo; `"Ov"` → `{}` | **Executado**: `{"name":"O nome da espécie deve ter no mínimo 2 caracteres."}` / `{}` |
| 8 | 61 → máximo; 60 → `{}` | **Executado**: `{"name":"O nome da espécie deve ter no máximo 60 caracteres."}` / `{}` |
| 9 | `" Cão   Pastor "` → `"Cão Pastor"`, 10 caracteres | **Executado**: `"Cão Pastor"`, `length === 10` |
| 10 | `deleteConfirmation("Gato")` com aspas curvas | **Executado**: `Excluir a espécie “Gato”? Esta ação não pode ser desfeita.` — `U+201C`/`U+201D` confirmados por codepoint |
| 11 | `grep` das 3 frases em `messages.ts` → 0 | **0 ocorrências** em `messages.ts` e **0 em `src/` inteiro** |
| 12 | `http-client.ts` e `api-error.ts` inalterados | `git diff --stat` vazio |

**Pass 2 — Diff Analysis**: Achado **#2**. Os 3 arquivos de `## Files` foram criados/modificados exatamente como indicado, e **nenhum outro**: `git status --porcelain` devolve os 3 e nada mais. Nada de `Scope — Out` foi tocado — nenhum componente, página ou estado de React; `http-client.ts`, `api-error.ts` e `access-token-store.ts` com diff vazio; nenhum teste acrescentado (correto, são da 011). Sem formatação em massa: as 8 linhas removidas de `messages.ts` são o bloco `ADMIN_HOME` e 4 linhas de comentário, e nada mais. A única expansão de escopo é a do achado #2, dentro de arquivo já em escopo.

**Pass 3 — Code Practices**: Achados **#3**, **#5**, **#6**. SOLID: SRP respeitado (`species-api.ts` é só transporte; `validation.ts` só regras puras; `messages.ts` só literais) e DIP no ponto que importa — `species-api.ts` depende de `request`, não de `fetch`. Calisthenics: `erroDeNomeDeEspecie` tem **um** nível de indentação com *early return* em cada degrau e **zero** `else` — a mesma forma do `medirNome` do backend, que é o que faz as duas camadas produzirem a mesma mensagem para a mesma entrada. Sem abreviação (`normalizeSpeciesName`, `validateSpeciesNameForm`, `TAMANHO_MAXIMO_DO_NOME_DE_ESPECIE`). Sem números mágicos: `2` e `60` são constantes nomeadas com a RN citada. Sem *dot chaining* que exponha estrutura. Linguagem ubíqua: `Species`, `listSpecies`, `createSpecies`, `renameSpecies` (e não `updateSpecies` — casa com "renomear" da spec e com a decisão 3 do changelog), `deleteSpecies` — verbo + objeto, alinhados à spec. Única divergência de vocabulário é a do achado #5, e ela foi prescrita pela task.

**Pass 4 — Testing Review**: **Sem achados** — esta task não entrega testes por contrato explícito (`Scope — Out`: "Sem testes (TASK-FRONTEND-011)"). Baseline confirmada intacta: **12 suítes / 160 testes**, todos passando, `typecheck` exit 0. Registro para a **TASK-FRONTEND-011**, que herda a cobertura: as quatro funções de `species-api.ts`, `normalizeSpeciesName` e `validateSpeciesNameForm` estão **hoje sem nenhum teste**; a `task_011` já cobre `listSpecies` devolvendo `{ items }` e a ausência de `PUT` (L56). Vale acrescentar um caso de fronteira para o achado #1 — se a decisão for replicar o `higienizar`, um caso `"A"×60 + U+200B`; se for não replicar, nenhum teste é devido, apenas o comentário corrigido.

**Pass 5 — Security Review**: Achado **#4** (`suggestion`), nenhum `critical`/`major`. A01: nada aqui decide autorização — a RN-01 é do servidor, e a camada apenas transporta o `Authorization` que o `http-client` injeta; a omissão de `skipRefresh` nas quatro funções está **certa** e é o oposto do caso do `login`. A02: nenhum segredo, token ou credencial no código; o access token nunca é tocado por este módulo. A03: única superfície é a interpolação do `id` no caminho (achado #4); nenhum HTML, `innerHTML`, `eval` ou construção de query por concatenação — `deleteConfirmation` interpola o nome numa string que o React renderiza como texto. A05: nenhuma configuração, nenhum `console` e nenhum vazamento de detalhe interno — o `message` exibido é o que o backend enviou. A06: **nenhuma dependência nova** (`species-api.ts` tem um único import interno). A07: o ciclo de renovação foi **preservado sem alteração**. A08: nenhuma desserialização de entrada não confiável além do `json()` já existente no `http-client`. A09: nenhum log acrescentado, portanto nenhum PII logado. A10: nenhuma URL construída a partir de entrada do usuário — os quatro caminhos são literais com um `id` vindo da própria API.

**Pass 6 — Bug Detection**: Achado **#1** — o único defeito real encontrado, e ele foi **medido**, não inferido. Varredura completa dos três arquivos por inteiro: sem acesso a possível `null`/`undefined` (nenhum dos três arquivos desreferencia nada opcional); sem *race condition* (as quatro funções são sem estado e sem variável de módulo — todo o estado compartilhado vive no `http-client`, intocado); sem vazamento de recurso (nenhuma conexão, timer ou stream); sem *off-by-one* — `< 2` e `> 60` conferidos nas quatro fronteiras por execução (1/2 e 60/61); sem coerção insegura (nenhum `==` nos três arquivos); sem *error swallowing* (nenhum `catch`); sem lógica invertida (a precedência dos três degraus reproduz a do `medirNome` do backend, degrau a degrau); sem estado inconsistente (nenhuma mutação parcial — `MESSAGES` é `as const` e as funções de validação são puras). O achado #1 não é nenhuma dessas classes: é divergência de fronteira entre duas implementações da mesma regra, e por isso só aparece comparando os dois lados.

**Pass 7 — Project Patterns**: **Sem achados.** `.makuco/codebase/conventions.md`: zero `any` ✓, alias `~/` usado em todos os imports ✓, kebab-case nos arquivos ✓, PT-BR em documentação e mensagens ✓. Arquitetura: `species-api.ts` está em `src/services/api/` junto de `auth-api.ts`, com a **mesma forma** (uma função por endpoint, sem estado, sem tratamento de erro, tipos de resposta exportados no topo) — o grafo de imports continua uma árvore, sem ciclo: `species-api` → `http-client` → (`api-error`, `access-token-store`, `config/env`). Tratamento de erro consistente com o resto do projeto: o `ApiError` sobe e a tela ramifica por `code` (CA-22 / RNF-11). Logging: o projeto não loga no frontend e a entrega não inaugura isso.

#### Veredicto

> **APROVADO** — os 12 critérios de aceite implementados e verificados por execução, `typecheck` exit 0, 160/160 testes passando, `http-client.ts` intocado, zero achados `critical` ou `major`.
>
> Nenhum dos 6 achados bloqueia o fechamento. Os dois `minor` são de **precisão de documentação e de rastreabilidade**, não de comportamento entregue: o **#1** pede que o comentário de `erroDeNomeDeEspecie` pare de afirmar equivalência com o backend enquanto existe uma segunda divergência não declarada — e ela corre na direção *client-stricter*, ao contrário da que a task declarou; o **#2** pede que a limpeza da TASK-007 seja registrada onde pertence.
>
> **Correção devida na própria task, não no código**: a seção `Implementation` contém uma contradição confirmada com o critério de aceite 11 e, como está escrita, reprovaria a implementação correta. Ver a decisão 2 acima para o texto substituto.
>
> **Herdam desta rodada**: a **TASK-FRONTEND-010** deve fixar a composição `${EDIT_ACTION} ${nome}` explicitamente (contrato implícito do RNF-07); a **TASK-FRONTEND-011** herda a cobertura integral das seis funções entregues.

---

### Rodada de Revisão 2 — 2026-08-26

**Revisor**: makuco-reviewer
**Status**: APROVADO
**Arquivos revisados**: 3 entregues (`src/services/api/species-api.ts`, `src/utils/validation.ts`, `src/utils/messages.ts`) + 4 de contexto lidos por inteiro (`species.validators.ts`, `species-name.ts`, `species.messages.ts` do backend, `task_011_...md`)

#### Resumo

A correção do achado #1 da rodada 1 foi **refeita do zero por medição, não conferida contra o relato**: as duas camadas foram executadas lado a lado sobre **709.483 entradas** — os casos nomeados no pedido, um fuzz de 7.000 strings sobre um alfabeto de brancos/invisíveis/expansores de caixa, a **varredura exaustiva de todo o BMP** (253.948 casos: cada code point isolado, interno, na fronteira 60 e na 61) e uma varredura dos planos astrais e surrogates isolados (455.535 casos). Resultado: **uma única divergência em 709.483**, e é a declarada (`U+0130`, servidor mais estrito). As três regressões nomeadas na rodada 1 desapareceram, a ordem higienizar → normalizar foi confirmada como **necessária** por inversão, e `CARACTERES_INVISIVEIS` é byte a byte idêntico ao do backend. Nenhum achado `critical` ou `major`. Dois `minor` e dois `suggestion`, nenhum bloqueante.

#### Achados

| # | Severidade | Arquivo | Linha | Categoria | Descrição | Recomendação |
|---|------------|---------|-------|-----------|-----------|--------------|
| 1 | minor | `src/services/api/species-api.ts` | L82-84 | precisão de comentário / risco declarado 2 | Comentário de `createSpecies` afirma: "A normalizacao local (`normalizeSpeciesName`) serve para contar caracteres antes da requisicao". Depois da correção isso ficou **falso**: quem conta é `higienizarNomeDeEspecie`, e `normalizeSpeciesName` passou a ser explicitamente a função crua que **não** deve ser usada para medir (`validation.ts` L163-169). O comentário não é um detalhe estale qualquer — ele é **o vetor exato do segundo risco declarado**: aponta, por nome, a função errada como "a que conta", e um contador `n/60` construído a partir dele reabre a divergência que esta rodada fechou | Trocar a citação por `validateSpeciesNameForm` (a função pública que de fato mede) ou, se o ponto for a forma, dizer "a higienização local"; o `species-api.ts` não deve nomear nenhuma das duas internas |
| 2 | minor | `src/utils/validation.ts` L47-57 + `services/backend/src/domains/species/species.validators.ts` L22-40 | — | duplicação sem detector / risco declarado 1 | O conjunto de code points existe em duas cópias e **nada cruza os dois arquivos**. A mitigação proposta pelo agente — fixar `"A"×60 + U+200B` como teste de fronteira na TASK-FRONTEND-011 — **é insuficiente, e a insuficiência é demonstrável**: esse teste prende o cliente ao code point que ele já trata. Se o servidor **acrescentar** um code point ao conjunto (é o modo de deriva mais provável, já que o comentário do backend descreve a lista como aberta), o teste continua verde e a divergência volta calada — na direção proibida, cliente mais estrito | Teste de contrato de **fonte**, não de comportamento: um caso na suíte da 011 que leia `services/backend/src/domains/species/species.validators.ts` e afirme que o literal de `CARACTERES_INVISIVEIS` é idêntico ao do frontend. Falha quando **qualquer um dos dois lados** muda, que é a propriedade que o teste de fronteira não tem. Não há workspace npm na raiz (`services/backend` e `services/frontend` são pacotes independentes), então módulo compartilhado exigiria um terceiro pacote — desproporcional. **Responsabilidade**: escrever o teste é da **TASK-FRONTEND-011**; mantê-lo verde ao mexer no conjunto é de quem editar `species.validators.ts` |
| 3 | suggestion | `src/utils/validation.ts` | L171 | assinatura frágil / risco declarado 2 | `normalizeSpeciesName` continua exportada e é a função crua. A exportação **está justificada** — o critério de aceite 9 exige observar o resultado da normalização (`" Cão   Pastor "` → `"Cão Pastor"`, 10 caracteres), e isso não é observável através de `validateSpeciesNameForm`, que só devolve mensagem. Logo, não é caso de deixar de exportar. O que resta é que o nome não avisa: `normalizeSpeciesName` soa como "a normalização", e é a metade dela | Renomear para algo que declare a parcialidade (`aplicarFormaDaRN03`) ou anotar `@deprecated`-de-uso no TSDoc dizendo em uma linha, antes do parágrafo longo, "não use para contar: use `validateSpeciesNameForm`". O parágrafo L163-169 já diz isso, mas no fim de um bloco de sete linhas — quem abre o autocompletar não o lê |
| 4 | suggestion | `src/utils/validation.ts` | arquivo (343 linhas, eram 288 na rodada 1) | SRP / tamanho de entidade | O achado #6 da rodada 1 permanece e **piorou 19%**: a correção acrescentou 55 linhas, quase todas de comentário legítimo. O módulo serve dois domínios e o bloco de espécies já é o maior do arquivo | Inalterado: extrair `species-validation.ts` quando a terceira entidade chegar. Prematuro agora |

#### Verificações solicitadas — resultado

**1. Comparação local × servidor, refeita por medição.** Duas sondas independentes: a do servidor executou `createSpeciesSchema.safeParse` real (via `ts-node` + `tsconfig-paths` do backend); a do cliente executou `validateSpeciesNameForm` real (via a suíte Jest do frontend). Ambas removidas ao fim. Casos nomeados no pedido:

| Entrada | Servidor | Cliente | Se a ordem fosse invertida |
|---|---|---|---|
| `"A"×60 + U+200B` | aceita (60) | **aceita (60)** | 60 |
| `"A"×59 + U+2060×2` | aceita (59) | **aceita (59)** | 59 |
| `("a" + U+FEFF + "b")×30` | aceita (60) | **aceita (60)** | **90 → recusa** |
| `"A"×60` (controle) | aceita | aceita | — |
| `"A"×61` (controle) | máximo | máximo | — |
| `U+200B×5` (só invisíveis) | obrigatório | obrigatório | — |
| `U+00AD + U+200E` (só invisíveis) | obrigatório | obrigatório | — |
| `"a" + U+00AD + "b"` (interno não-branco) | aceita (2) | aceita (2) | — |
| `"a" + U+200E + "b"` (interno não-branco) | aceita (2) | aceita (2) | — |
| `"A"×60 + TAB + U+200B` (invisível **e** tabulação) | aceita (60) | **aceita (60)** | **61 → recusa** |
| `"A"×59 + U+FEFF + "B"` | aceita (60) | **aceita (60)** | **61 → recusa** |
| `"a" + U+FEFF + TAB + "b"` | aceita (3) | aceita (3) | 3 |
| `" Cão   Pastor "` (CT-10) | `"Cão Pastor"` (10) | aceita (10) | — |
| `"İ"×60` (U+0130) | **máximo** | **aceita** | — |

As três medições que a rodada 1 reportou como quebradas (61 vs 60, 61 vs 59 e **90** vs 60) agora batem. A `"a﻿b"×30`, que era a pior, mede 60 dos dois lados.

**2. `CARACTERES_INVISIVEIS` idêntico ao do backend.** Comparado por igualdade de string, e não por leitura: `/[­​-‏⁠﻿]/g` nos dois arquivos (`validation.ts:57`, `species.validators.ts:40`). **Idênticos**, incluindo a flag `g`, a ordem dos elementos da classe e a forma de escrita dos escapes. O corpo de `higienizarNomeDeEspecie` também é caractere a caractere o de `higienizar` (`normalizeSpeciesName(bruto.replace(CARACTERES_INVISIVEIS, ''))`), e `normalizeSpeciesName` é caractere a caractere o de `species-name.ts` — as três linhas que importam são cópias exatas.

**3. Ordem higienizar → normalizar: correta e NECESSÁRIA.** A inversão foi executada, não argumentada. Três dos casos medidos mudam de desfecho se invertida: `("a"+U+FEFF+"b")×30` sai de 60 para **90**, `"A"×60 + TAB + U+200B` e `"A"×59 + U+FEFF + "B"` saem de 60 para **61** — os três passam de aceitos a recusados, na direção proibida. O mecanismo é o que o comentário L180-185 descreve: `U+FEFF` é branco para o `\s` **e** para o `trim()` do JavaScript, então normalizar antes o converte em espaço em vez de removê-lo; `U+200B` não é branco, sobrevive ao `trim()` de cauda e passa a blindar a tabulação que o precede. O comentário está certo nos dois mecanismos.

**4. Terceira divergência não declarada: PROCURADA E NÃO EXISTE.** A rodada 1 achou a segunda comparando poucos casos, então esta rodada não comparou casos — comparou o espaço:

| Varredura | Casos | Cliente mais estrito (**proibido**) | Mensagem diferente | Servidor mais estrito |
|---|---|---|---|---|
| Casos nomeados no pedido | 24 | 0 | 0 | 1 (`U+0130`) |
| Fuzz determinístico (brancos, invisíveis, expansores de caixa, combinantes, surrogates, emoji, `U+180E`, `U+061C`, `U+2066/69`, `U+FFFC`) | 7.000 | 0 | 0 | 0 |
| **Exaustiva do BMP** — cada code point isolado, interno (`A×A`), na fronteira 60 (`"A"×59+X`) e na 61 (`"A"×60+X`) | 253.948 | **0** | **0** | **1** |
| Planos astrais amostrados + os 2.048 surrogates isolados | 455.535 | 0 | 0 | 0 |
| **Total** | **709.483** | **0** | **0** | **1** |

A única divergência de todo o BMP é `"A"×59 + U+0130` — 60 code units no nome, 61 na chave. É exatamente a declarada, e ela **corre na direção segura**: o cliente aceita, o servidor recusa com `NAME_TOO_LONG`, que é o mesmo literal que a função local emitiria. Custo: uma viagem de rede. Confirmado também que as mensagens são idênticas caractere a caractere nas 709.483 comparações — `FIELD_REQUIRED` do frontend contra `NAME_REQUIRED` do backend inclusive, que são chaves diferentes para o mesmo literal.

**Brinde metodológico**: as 709.483 chamadas rodaram **sequencialmente no mesmo processo**, reusando a mesma instância de `CARACTERES_INVISIVEIS`. Uma regex com flag `g` guarda `lastIndex` e é o defeito clássico dessa construção — `.replace()` reseta, `.test()` não. Zero divergência ao longo da sequência inteira descarta empiricamente a versão estatística desse bug nos dois lados.

**5. `normalizeSpeciesName` não mudou de comportamento.** Continua sendo `bruto.trim().replace(/\s+/g, ' ')` — as duas operações da RN-03 e nada mais, byte a byte igual ao `species-name.ts` do backend. A higienização foi para uma função **separada e não exportada**, exatamente como o backend separa `higienizar` (em `species.validators.ts`) de `normalizeSpeciesName` (em `species-name.ts`). O arranjo de duas camadas foi replicado na forma, não só no efeito: mesma divisão, mesma ordem, mesmo raciocínio registrado dos dois lados. O CT-10 continua verde (`" Cão   Pastor "` → `"Cão Pastor"`, 10).

**6. Comentário de precedência: factualmente verdadeiro dentro do escopo que delimita.** Três afirmações, três verificadas:
- *"Precedência IDÊNTICA a do `speciesNameSchema`"* — os três degraus, na mesma ordem, com `return` explícito entre eles, produzindo o mesmo literal. Verificado em 709.483 entradas: **zero** casos de mensagem diferente.
- *"DIVERGÊNCIA QUE PERMANECE — UMA SÓ"* — verdadeiro, e agora com lastro: uma em 709.483, em toda a extensão do BMP.
- *"Fora essa medição da chave, os dois lados produzem a mesma mensagem para a mesma entrada"* — verdadeiro. E o escopo é honesto: o comentário fala de `speciesNameSchema`, não do domínio inteiro. Unicidade (RN-04) fica de fora porque vive no service e não no schema, e a própria `validateSpeciesNameForm` declara essa lacuna no seu TSDoc ("Ela não verifica unicidade"). O texto **deixou de reivindicar mais do que entrega** — que era exatamente o defeito do achado #1 da rodada 1.

**7. Emenda no texto da task: correta, e não transcreve.** O `git diff` mostra que a linha antiga — a única do arquivo que transcrevia as cinco frases na seção normativa — foi **removida** e substituída por duas que nomeiam somente chave e `code`. A emenda acerta nos dois pontos que afirma:
- que `messages.ts` L12-20 transcreve literalmente: **confirmado**, o bloco lista "E-mail ou senha incorretos.", "Este e-mail já está em uso." e as demais do domínio auth;
- que `INVALID_ID` e `FIELD_NOT_ALLOWED` chegam dentro do `details` de um `VALIDATION_ERROR`: **confirmado na origem** — `INVALID_ID` sai do `speciesIdParamSchema` (validado como `params`, `field: "id"`) e `FIELD_NOT_ALLOWED` do `objetoSemCamposExtras`, ambos em `species.validators.ts`.
- que são **sete**: conferido contra o catálogo inteiro. `species.messages.ts` tem oito chaves; as três primeiras (`NAME_REQUIRED`, `NAME_TOO_SHORT`, `NAME_TOO_LONG`) são a duplicação **legítima** (verificadas antes da requisição, nenhuma resposta as carrega), as cinco restantes mais `FORBIDDEN` e `SESSION_EXPIRED` fecham sete. **Nenhuma oitava mensagem do domínio ficou de fora da lista.**

O critério de aceite 11 continua verde: `grep` das três frases devolve **0** em `messages.ts` e **0** em `services/frontend/src/` inteiro. A seção `Implementation` não transcreve mais nenhuma frase proibida. *(Observação, não achado: as três frases aparecem hoje neste arquivo dentro do bloco da **rodada 1**, como citação de evidência. O CA-11 tem escopo declarado em `messages.ts`, e o `spec_context.md` — fonte normativa dos literais — as transcreve em mais de vinte pontos por dever de ofício. Nada a corrigir.)*

**8. Escopo.** `git status --porcelain` devolve **quatro** entradas e nada mais: os três arquivos de `## Files` e este próprio arquivo de task. Verificados intocados: **o backend inteiro** (`git diff --stat -- services/backend` vazio), `http-client.ts`, `api-error.ts`, `access-token-store.ts`, `~/components/ui/*`, tudo da TASK-FRONTEND-007 (`route-paths.ts`, `app-routes.tsx`, `admin-layout.tsx`), `jest.config.ts`, `tsconfig*.json` e `tests/`. **Nenhuma dependência nova** — `git diff HEAD --stat` de `package.json`/`package-lock.json` vazio nos dois pacotes, e `species-api.ts` mantém o import único de `~/services/api/http-client`. **Nenhuma sonda deixada para trás**: as duas sondas desta rodada foram removidas antes de rodar os gates e `grep -rn "sonda-reviewer"` devolve vazio na árvore inteira.

**Gates, reexecutados por mim**: `npm run typecheck` → **exit 0** (os dois projetos, `tsconfig.json` e `tsconfig.test.json`); `npm test` → **12 suítes / 160 testes**, todos passando. Baseline intacta.

#### Riscos declarados — parecer

**Risco 1 — a regra de higienização existe duas vezes e nada cruza os dois arquivos. PROCEDE, e a mitigação proposta NÃO É SUFICIENTE.**

O risco é real: `services/backend` e `services/frontend` são pacotes npm independentes (não há `package.json` na raiz nem workspaces), então nenhum passo de build enxerga os dois `CARACTERES_INVISIVEIS` ao mesmo tempo.

A mitigação sugerida — fixar `"A"×60 + U+200B` como teste de fronteira na TASK-FRONTEND-011 — cobre **o modo de deriva errado**. Ela prende o cliente a um code point que ele já trata; o modo provável é o servidor **acrescentar** um code point (o próprio comentário do backend descreve a lista como uma enumeração aberta, "espaco de largura zero e seus vizinhos"), e nesse cenário o teste permanece verde enquanto a divergência volta — na direção proibida, cliente mais estrito, por caractere invisível que o usuário não tem como apagar. Ou seja: exatamente o defeito que esta rodada fechou reapareceria sem que nada reprovasse.

**Tratamento devido**: um teste de contrato de **fonte**. Um caso na suíte da 011 que leia `services/backend/src/domains/species/species.validators.ts`, extraia o literal de `CARACTERES_INVISIVEIS` e afirme igualdade com o do frontend. Custo: ~6 linhas e um `readFileSync`. Propriedade que o teste de fronteira não tem: **falha quando qualquer um dos dois lados muda**, e falha nomeando o arquivo que precisa acompanhar. O caso `"A"×60 + U+200B` continua valendo como teste de comportamento — os dois são complementares, não alternativos, e o de fronteira é o que documenta *por que* o conjunto existe.

**Responsabilidade**: escrever o teste é da **TASK-FRONTEND-011** (é o único ponto do plano onde teste de frontend é permitido; a 008 tem "sem testes" em `Scope — Out`). Mantê-lo verde é de quem editar o conjunto no backend — e a mensagem de falha deve dizer isso em texto, não deixar para o leitor deduzir. Módulo compartilhado é a solução estruturalmente correta e está **descartada com razão**: exigiria um terceiro pacote npm e uma etapa de build no monorepo para eliminar três linhas de duplicação.

**Risco 2 — `normalizeSpeciesName` continua exportada e é a função crua. PROCEDE, e já se materializou uma vez.**

Não é hipotético: `species-api.ts` L82-84 **já** aponta `normalizeSpeciesName` como "a normalização local que serve para contar caracteres antes da requisição". É o achado #1 desta rodada. O comentário foi escrito antes da correção e sobreviveu a ela, e é a primeira coisa que um autor de contador `n/60` vai ler, porque está no arquivo que ele vai abrir para chamar `createSpecies`.

Deixar de exportar **não** é o caminho: o critério de aceite 9 exige observar o resultado da normalização (`"Cão Pastor"`, 10 caracteres), e isso não é observável por `validateSpeciesNameForm`, que devolve mensagem e não texto. A exportação é devida. O que falta é o aviso chegar antes do uso — hoje ele existe, mas no sétimo parágrafo de um TSDoc de vinte linhas, e o autocompletar mostra a primeira. Ver achado #3.

#### Detalhes por Passagem

**Pass 1 — Task Compliance**: **12 de 12** critérios mantidos. Os quatro que a correção tocava foram reexecutados contra as funções reais: CA-6 (`"   "` → obrigatório), CA-7 (`"G"` → mínimo; `"Ov"` → `{}`), CA-8 (61 → máximo; 60 → `{}`) e CA-9 (`" Cão   Pastor "` → `"Cão Pastor"`, 10) — todos verdes, e agora também nas fronteiras com invisível, que antes não estavam. CA-11 verde (`grep` = 0). CA-12 verde (`git diff --stat` vazio). Os demais não foram tocados pela correção.

**Pass 2 — Diff Analysis**: **Sem achados novos.** Quatro entradas em `git status --porcelain`, todas previstas. `Scope — Out` respeitado integralmente, incluindo o backend, os três arquivos de infraestrutura HTTP nomeados e a ausência de testes. A correção acrescentou **55 linhas a `validation.ts` e nada em mais lugar nenhum** — `messages.ts` e `species-api.ts` não foram tocados por ela (o achado #1 desta rodada é conteúdo herdado da rodada 1, não introduzido agora). Sem formatação em massa. O achado #2 da rodada 1 (registrar a remoção de `MESSAGES.ADMIN_HOME` no changelog/handoff) **segue em aberto** — verificado: `grep ADMIN_HOME` no `changelog_context.md` e em `.makuco/handoff/` devolve vazio. Não bloqueia, mas atravessou uma rodada.

**Pass 3 — Code Practices**: Achados **#3** e **#4**. SRP: a correção acertou a decisão de projeto — em vez de inchar `normalizeSpeciesName` com uma terceira operação (que teria quebrado o contrato literal da RN-03 e a paridade com `species-name.ts`), criou uma segunda função com uma responsabilidade própria e a manteve privada. É a mesma separação que o backend faz entre dois arquivos, e a justificativa registrada dos dois lados é a mesma. Calisthenics: `higienizarNomeDeEspecie` é uma expressão, um nível de indentação, zero `else`; `erroDeNomeDeEspecie` continua com um nível e três `return` explícitos. Sem abreviação, sem número mágico (`2` e `60` nomeados com a RN citada), sem `any`, sem `dot chaining`. Linguagem ubíqua: `higienizarNomeDeEspecie` é verbo + objeto e ecoa o `higienizar` do backend — a mesma palavra para o mesmo conceito nas duas camadas, que é o que a diretriz pede. Nomes de função em português convivendo com API pública em inglês é o padrão já estabelecido no arquivo (`erroDeEmail`, `erroDeSenhaNova`), não desvio desta entrega.

**Pass 4 — Testing Review**: **Sem achados** — `Scope — Out` diz "Sem testes (TASK-FRONTEND-011)" e a entrega respeita. Baseline reexecutada: **12 suítes / 160 testes**, `typecheck` exit 0. O que a **TASK-FRONTEND-011** herda está no fim deste parecer. Registro de método: nenhum dos 709.483 casos desta revisão foi deixado na árvore — as sondas viveram em `services/backend/sonda-reviewer.ts` e `services/frontend/tests/sonda-reviewer.spec.ts` e foram apagadas antes dos gates.

**Pass 5 — Security Review**: **Sem achados novos**; os `suggestion` #3 e #4 da rodada 1 (`renameSpecies` posicional, `encodeURIComponent`) seguem abertos e seguem não bloqueantes. A superfície nova é uma regex a mais aplicada a entrada do usuário, então A03 foi verificado nesse ângulo: `CARACTERES_INVISIVEIS` é uma classe de caracteres simples, sem quantificador aninhado e sem alternância — **não há ReDoS**, e o mesmo vale para `/\s+/g`. Ambas são consumidas por `.replace()`, não por `.test()`, então a flag `g` não carrega `lastIndex` entre chamadas; as 709.483 execuções sequenciais no mesmo processo confirmam isso na prática. A02: nada de segredo. A01: a camada continua sem decidir autorização. A06: nenhuma dependência nova. A09: nenhum log.

**Pass 6 — Bug Detection**: Achado **#1** (comentário incorreto; sem efeito em execução). Nenhum defeito de comportamento. A varredura desta rodada foi a comparação diferencial descrita acima, que é a classe de defeito que este código pode ter — as demais foram reconferidas e seguem negativas: sem `null`/`undefined` desreferenciado (as duas funções novas operam sobre `string` e devolvem `string`), sem estado (nenhuma variável de módulo mutável; as regex são `const` e usadas por `.replace()`), sem vazamento de recurso, sem `off-by-one` (as fronteiras 59/60/61 foram exercitadas contra **todo** code point do BMP, não contra amostras), sem coerção insegura, sem `catch`, sem lógica invertida — e a **ordem** entre as duas operações, que é a inversão silenciosa mais plausível aqui, foi testada explicitamente e reprova três casos se trocada.

**Pass 7 — Project Patterns**: **Sem achados.** `conventions.md`: zero `any`, alias `~/`, kebab-case, PT-BR nos textos de tela e comentários sem acento salvo em literal citado como dado. Arquitetura: nenhuma dependência nova, grafo de imports segue árvore. O padrão que a correção mais respeita não está em `conventions.md` e sim no backend: quando as duas camadas precisam concordar, elas concordam **pela mesma forma**, não só pelo mesmo resultado — duas funções, mesma ordem, mesma constante, mesmo raciocínio registrado. É o que torna a próxima divergência visível por leitura lado a lado, e foi por leitura lado a lado que a rodada 1 achou a primeira.

#### Veredicto

> **APROVADA** — o achado #1 da rodada 1 está **fechado por medição**, não por argumento: 709.483 entradas comparadas contra os dois módulos reais, **uma única divergência**, e é a declarada (`U+0130`), na direção segura. As três regressões nomeadas desapareceram, a ordem foi confirmada como necessária por inversão, o conjunto de code points é byte a byte o do backend, `normalizeSpeciesName` preservou o contrato da RN-03 e o comentário de precedência parou de reivindicar mais do que entrega. O achado #2 da rodada 1 foi resolvido no texto da task, corretamente e sem introduzir transcrição nova. `typecheck` exit 0, 160/160, backend intocado, nenhuma dependência nova, nenhuma sonda residual.
>
> Nenhum dos quatro achados desta rodada bloqueia. Os dois `minor` são de **precisão de documentação e de detecção de deriva** — o #1 porque um comentário sobrevivente aponta a função errada como "a que conta", o #2 porque a mitigação proposta para a duplicação não detecta o modo de deriva provável.
>
> **Herdam desta rodada:**
>
> **TASK-FRONTEND-009** — consome `validateSpeciesNameForm`, e é ela que decide se a API é chamada (CT-03/CT-04/CT-07). Herda: (a) a medição correta é a de `validateSpeciesNameForm`, **nunca** a de `normalizeSpeciesName` — se a tela exibir contador de caracteres, ele tem de sair da mesma medição, ou o contador dirá 61 enquanto a validação aceita; (b) o `name` enviado é o texto **cru** do campo, não a forma normalizada — o servidor é a autoridade sobre a RN-03; (c) `listSpecies()` devolve `{ items }`, sem desembrulhar.
>
> **TASK-FRONTEND-010** — herda o mesmo de (a) e (b), porque a edição em linha reusa `validateSpeciesNameForm`, e mais: fixar explicitamente a composição `${EDIT_ACTION} ${nome}` do nome acessível (contrato implícito do RNF-07, já apontado na rodada 1 e ainda não fixado no texto da 010).
>
> **TASK-FRONTEND-011** — herda três itens, o primeiro deles **novo e o mais importante**: (a) o **teste de contrato de fonte** do achado #2 — comparar o literal de `CARACTERES_INVISIVEIS` dos dois arquivos —, que é o único caso capaz de detectar a deriva do conjunto; (b) casos de fronteira com invisível em `validation.spec.ts`, no mínimo `"A"×60 + U+200B` (aceita), `("a"+U+FEFF+"b")×30` (aceita — é a que media 90 antes da correção) e `"A"×60 + TAB + U+200B` (aceita — é a que exercita a **ordem** das duas operações); a tabela hoje na `task_011` L60 tem só os casos ASCII e não pegaria nenhuma das três regressões; (c) a cobertura integral das seis funções entregues, que seguem sem nenhum teste.
>
> **Pendência de rastreabilidade que atravessou duas rodadas**: o achado #2 da rodada 1 — registrar a remoção de `MESSAGES.ADMIN_HOME` no changelog/handoff, atribuindo-a à decisão 4 da TASK-FRONTEND-007 — continua em aberto. Não bloqueia esta task; bloqueia o fechamento limpo do histórico da 007.
