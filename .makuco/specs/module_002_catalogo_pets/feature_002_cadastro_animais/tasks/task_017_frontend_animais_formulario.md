# TASK-FRONTEND-017 — Formulário de cadastro e edição de animal

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-017-frontend-animais-formulario`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 17 of 18 — Tela de Formulário
**Generated**: `2026-08-25`

---

## Context

Entrega `/admin/animais/novo` e `/admin/animais/:id/editar` — o mesmo formulário nos dois modos, com o arranjo de duas colunas da captura. Dois comportamentos exigem cuidado além do trivial: o **encadeamento estado → cidade**, em que apenas a cidade trafega e a UF é derivada dela (RN-26a), e o **descarte de respostas fora de ordem** quando o administrador troca de estado em sequência rápida (RN-57). A captura flagra o campo Cidade em "Carregando cidades...", o que confirma que o estado de carregamento é parte do contrato de interface.

---

## Scope

**In:** Validação local do formulário, formulário de cadastro e edição, encadeamento estado → cidade com guarda de corrida, montagem do `FormData` com `keepImageIds`, tratamento de erro por `code` e substituição do marcador de rota.

**Out:** **Nenhum campo de status no formulário** (RN-16). Nenhuma primitiva de interface nova — se algo faltar, reportar em vez de improvisar fora da base de componentes. Não criar endpoint de espécies: reusar a listagem da FEATURE-001. Não adotar biblioteca de formulário nem de validação por schema: o padrão em vigor é função pura por formulário devolvendo mapa de erros por campo, e a spec declara que essa decisão de arquitetura não é tomada aqui. Sem testes (TASK-FRONTEND-018).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/utils/validation.ts` | validação do formulário |
| `create` | `src/pages/admin/animais/use-state-cities.ts` | encadeamento com guarda |
| `create` | `src/pages/admin/animais/animal-form-page.tsx` | cadastro e edição |
| `modify` | `src/routes/app-routes.tsx` | substitui o marcador |

---

## Implementation

> **Reference pattern**: `src/pages/auth/register-page.tsx` é o molde de formulário — `useState` por campo, `validateXForm(values)` devolvendo `Record<string, string>`, distribuição de `details` da API pelos campos com `fieldErrorsOf`, botão desabilitado durante a requisição. `src/utils/validation.ts` já define o formato das funções puras.

### `src/utils/validation.ts` *(modify)*
- `validateAnimalForm(values): Record<string, string>` — obrigatoriedade de Nome, Espécie, Porte, Sexo, Estado e Cidade com "Este campo é obrigatório."; nome entre 2 e 60 após normalização de espaços; descrição até 1000; data de nascimento não futura e não anterior a 30 anos.
- **A comparação de data usa a data local do navegador apenas para retorno imediato.** A recusa que vale é a do servidor, feita no fuso America/Sao_Paulo — não replicar aqui a lógica de fuso, que divergiria em silêncio (RN-19, RN-33).
- Função pura, sem React, no mesmo formato das existentes.
- **Estado não entra na validação de envio**: ele existe só para reduzir a lista de cidades. O que é obrigatório enviar é a cidade (RN-26a).

### `src/pages/admin/animais/use-state-cities.ts` *(create)*
- Hook que expõe `{ states, cities, isLoadingCities, citiesError, selectedUf, selectUf, retryCities }`.
- **Guarda de corrida obrigatória:** guardar a UF da requisição em uma `ref` e, ao chegar a resposta, aplicá-la **apenas** se ainda for a UF escolhida. Trocar "PR" e depois "ES" com a resposta de "PR" chegando por último deve deixar valendo a lista de "ES" (RN-57, CT-38). Sem essa guarda, o campo mostra cidades do Paraná com "ES" selecionado — e o administrador grava a cidade errada acreditando que gravou a certa.
- Trocar de estado **descarta a cidade escolhida**. É essa combinação — só a cidade trafega, mais o descarte na troca — que torna "Campo Magro - ES" impossível de representar em vez de um erro a validar (RN-26a, CT-37, CA-17).
- Falha ao carregar cidades **nunca** se apresenta como campo de seleção vazio, que se leria como "este estado não tem cidades". Apresenta-se como falha, com "Não foi possível carregar as cidades. Tente novamente." e nova tentativa, e o restante do formulário continua preenchível (RN-58, CT-39, CA-16).
- Na edição, a cidade gravada permanece selecionada enquanto a lista carrega, e **continua exibida como escolhida mesmo se não constar da lista ativa** — cidade renomeada ou reorganizada não é apagada em silêncio; o administrador só perde aquele valor se escolher outro deliberadamente (RN-56, CT-40, CT-41, CA-47).

### `src/pages/admin/animais/animal-form-page.tsx` *(create)*
- Um componente para os dois modos, distinguidos pela presença de `:id`: título "Cadastrar Animal" ou "Editar Animal".
- Arranjo em duas colunas na ordem da captura: Nome / Data de nascimento; Espécie / Porte; Sexo / Estado; Cidade em largura inteira; Descrição em largura inteira; as duas alternâncias lado a lado; imagens. Asterisco em Nome, Espécie, Porte, Sexo, Estado e Cidade (CA-09).
- Rodapé com "Cancelar" (secundário) e "Salvar" (primário), alinhados à direita.
- Espécies carregadas de `GET /api/species`, da FEATURE-001.
- Na edição, carregar por `getAnimal(id)` e **guardar o `updatedAt` recebido** — é o token de concorrência que volta no envio (RN-47).
- `<form onSubmit>` real, para permitir envio com Enter e para que a validação nativa e o foco funcionem (RNF-16).
- Validar localmente **antes** de chamar a API: todos os campos com problema são sinalizados **de uma vez** e o foco vai para o primeiro deles (CT-09, CA-12).
- **Montagem do `FormData`**: campos de texto sempre; booleanos como `"true"`/`"false"`; `birthDate` e `description` omitidos quando vazios, e não enviados como string vazia — string vazia seria um valor, e um valor inválido; cada arquivo em preparo como `images`; na edição, `keepImageIds` como texto JSON com os ids das imagens gravadas **na ordem em que aparecem** (RN-35), e `updatedAt`.
- `status` **nunca** entra no `FormData` — nem no cadastro, nem na edição (CT-14, CT-68).
- Botão "Salvar" desabilitado durante a requisição; o segundo acionamento é ignorado e apenas um animal é criado (CT-93).
- Indicação de progresso durante a espera do envio de imagens grandes, e a operação conclui ou falha com mensagem em até 30 segundos (RNF-13, CT-97).
- "Cancelar" volta à listagem sem gravar nada e **sem remover imagem alguma** — a marcação de remoção é descartada junto com o formulário (CT-59, CT-65, CA-25).
- Tratamento de erro **por `code`**, nunca pelo texto: `VALIDATION_ERROR` → distribuir `details` pelos campos; `SPECIES_NOT_FOUND`, `CITY_NOT_FOUND`, `ANIMAL_NOT_FOUND` → mensagem da API em alerta, e no caso do animal voltar à listagem atualizada; `ANIMAL_STALE_UPDATE` → mensagem da API, formulário permanece aberto com tudo preenchido; `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TOO_LARGE`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `REQUEST_BODY_TOO_LARGE`, `IMAGE_STORAGE_UNAVAILABLE` → mensagem da API junto à área de imagens.
- **Em qualquer falha, o formulário preserva tudo o que o administrador havia preenchido**, inclusive as imagens em preparo. Perder um formulário longo por um `503` é o defeito que faz o administrador desistir da tela (CT-55, HU-05 cenário 11).
- Sucesso → "Animal cadastrado com sucesso." ou "Animal atualizado com sucesso." e volta à listagem já atualizada.

### `src/routes/app-routes.tsx` *(modify)*
- Substituir o marcador `// TODO(TASK-FRONTEND-017)` deixado pela TASK-FRONTEND-016 pelo componente do formulário, nas duas rotas.

---

## Acceptance Criteria

- [ ] **Given** "Cadastrar Animal" acionado, **When** o formulário abre, **Then** o título é "Cadastrar Animal", todos os campos estão vazios, as duas alternâncias estão desligadas e **não existe campo de status no DOM** (CT-22, CT-68, CA-09).
- [ ] **Given** o formulário vazio, **When** "Salvar" é acionado, **Then** todos os obrigatórios exibem "Este campo é obrigatório." **de uma vez**, o foco vai ao primeiro e **nenhuma requisição é enviada** (CT-09, CA-12).
- [ ] **Given** nenhum estado escolhido, **When** o formulário abre, **Then** o campo Cidade está desabilitado exibindo "Escolha primeiro o estado" (CT-34).
- [ ] **Given** "PR" escolhido e a resposta pendente, **Then** o campo Cidade exibe "Carregando cidades..." e não aceita escolha; **When** a resposta chega, **Then** oferece apenas cidades do Paraná, em ordem alfabética, com "Campo Magro" presente (CT-35, CT-36).
- [ ] **Given** "Campo Magro"/"PR" escolhido, **When** o estado muda para "ES", **Then** a cidade escolhida é descartada e a lista passa a ser a do Espírito Santo — é impossível enviar "Campo Magro" com "ES" (CT-37, CA-15, CA-17).
- [ ] **Given** "PR" e depois "ES" escolhidos em sequência rápida, **When** a resposta de "PR" chega **depois** da de "ES", **Then** prevalece a lista de "ES" e a resposta obsoleta é descartada (CT-38, RN-57).
- [ ] **Given** a consulta de cidades falhando, **When** o administrador tenta escolher, **Then** exibe "Não foi possível carregar as cidades. Tente novamente." com nova tentativa, **nunca** um campo vazio, e o restante do formulário continua preenchível (CT-39, CA-16).
- [ ] **Given** a edição de um animal com cidade gravada, **When** a tela carrega, **Then** estado e cidade aparecem corretos, e a cidade permanece selecionada enquanto a lista carrega (CT-40).
- [ ] **Given** uma cidade gravada que não consta mais da lista ativa, **When** o formulário abre, **Then** ela continua exibida como escolhida e não é apagada em silêncio (CT-41, CA-47).
- [ ] **Given** o corpo montado no cadastro, **When** inspecionado, **Then** contém `cityId` e **não** contém nenhum campo de estado nem `status` (CA-17, CT-14).
- [ ] **Given** a edição com duas imagens, uma removida e uma nova escolhida, **When** salvo, **Then** `keepImageIds` traz apenas o id mantido, na ordem exibida, e um arquivo é enviado em `images` (CT-58, CT-61).
- [ ] **Given** o "x" de uma imagem gravada acionado e "Cancelar" em seguida, **When** o formulário é reaberto, **Then** as duas imagens continuam lá — nenhuma foi removida (CT-59, CA-25).
- [ ] **Given** "Salvar" acionado duas vezes em sequência rápida, **When** processado, **Then** apenas um animal é criado e o botão fica desabilitado durante a requisição (CT-93).
- [ ] **Given** a API respondendo `409 ANIMAL_STALE_UPDATE`, **When** o erro chega, **Then** exibe a mensagem da API, o formulário permanece aberto e **tudo o que estava preenchido é preservado** (CT-66, CA-29).
- [ ] **Given** a API respondendo `503 IMAGE_STORAGE_UNAVAILABLE`, **When** o erro chega, **Then** exibe a mensagem da API junto à área de imagens e o formulário preserva o que foi preenchido (CT-55, CT-56).
- [ ] **Given** apenas os obrigatórios preenchidos, sem data, sem descrição e sem imagens, **When** salvo, **Then** o cadastro conclui normalmente (CT-02, CA-11).
- [ ] **Given** navegação apenas por teclado, **When** o formulário é percorrido, **Then** todos os campos, as alternâncias, a escolha e a remoção de imagens e os dois botões são alcançáveis e acionáveis, e o envio funciona com Enter (CT-94, CA-42).
- [ ] **Given** o código desta task, **When** o `package.json` é comparado, **Then** nenhuma dependência foi acrescentada.

---

## Dependencies

- **Requires**: TASK-FRONTEND-013 (API, tipos, rótulos), TASK-FRONTEND-014 (primitivas), TASK-FRONTEND-015 (campo de imagens), TASK-FRONTEND-016 (rotas registradas), TASK-BACKEND-005, TASK-BACKEND-007 e TASK-BACKEND-008, FEATURE-001 do MODULE-002 (`GET /api/species`).
- **Blocks**: TASK-FRONTEND-018.

---

## Revisão — 2026-08-28

**Status**: APROVADO — com uma primitiva a mais, reportada abaixo

Suíte do frontend: **441 testes, 29 suítes, 0 falha**. `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos. `package.json` sem diff — **três** dependências de execução, as mesmas.

| Critério de aceite | Resultado |
|---|---|
| Cadastro: título, campos vazios, alternâncias desligadas, sem status no DOM (CT-22, CT-68, CA-09) | **Confirmado.** Duas buscas independentes por rótulo de status/situação não encontram nada |
| Vazio: todos os obrigatórios de uma vez, foco no primeiro, sem requisição (CT-09, CA-12) | **Confirmado.** Cinco mensagens simultâneas — o Estado **não** entra, porque não é campo do contrato (RN-26a) — e o foco vai para "Nome" |
| Cidade desabilitada com "Escolha primeiro o estado" (CT-34) | **Confirmado** |
| "Carregando cidades..." e depois só cidades do PR (CT-35, CT-36) | **Confirmado** com a resposta retida manualmente, e não por temporização — o estado intermediário é observado de verdade |
| Trocar de estado descarta a cidade (CT-37, CA-15, CA-17) | **Confirmado.** "Campo Magro - ES" fica impossível de representar, e não é um erro a validar |
| Resposta obsoleta descartada (CT-38, RN-57) | **Confirmado** com dois resolvedores manuais, invertendo a ordem de chegada: prevalece a lista de "ES" e nenhuma cidade do PR aparece |
| Falha de cidades com nova tentativa, nunca campo vazio (CT-39, CA-16) | **Confirmado**, e o resto do formulário continua preenchível; a nova tentativa recarrega |
| Edição: estado e cidade corretos (CT-40) | **Confirmado** |
| Cidade gravada fora da lista ativa continua escolhida (CT-41, CA-47) | **Confirmado.** Sem isso o `<select>` ficaria com valor sem `<option>` casando e o navegador o exibiria em branco |
| Corpo com `cityId`, sem estado e sem status (CA-17, CT-14) | **Confirmado sobre o `FormData` real** que o dublê recebeu, e não sobre o que a tela aparenta |
| `keepImageIds` na ordem exibida, arquivo novo em `images` (CT-58, CT-61) | **Confirmado.** Removida a capa, sobra `["img-1"]` e um arquivo |
| "x" + "Cancelar" não remove nada (CT-59, CA-25) | **Confirmado**: nenhuma chamada de escrita, e volta à listagem |
| Dois "Salvar" criam um animal (CT-93) | **Confirmado** com a requisição retida: o botão fica desabilitado e a segunda submissão é ignorada |
| `409 ANIMAL_STALE_UPDATE` preserva tudo (CT-66, CA-29) | **Confirmado.** Formulário aberto, nome editado e data ainda lá |
| `503 IMAGE_STORAGE_UNAVAILABLE` junto às imagens, preservando o preenchido (CT-55, CT-56) | **Confirmado**, inclusive a imagem em preparo |
| Só obrigatórios conclui (CT-02, CA-11) | **Confirmado**, com `birthDate`, `description` e `images` **omitidos** — não enviados vazios |
| Teclado: campos, alternâncias, imagens, botões e Enter (CT-94, CA-42) | **Confirmado** |
| Nenhuma dependência acrescentada | **Confirmado** |

### Uma primitiva a mais, e por quê

A task manda **reportar** em vez de improvisar se faltar primitiva. Faltou: **campo de texto de uma linha com rótulo VISÍVEL e marcação de obrigatoriedade**.

O `TextField` existente não serve, e não é questão de estilo: o rótulo dele é `sr-only` por decisão de layout do `reference.html` (registrada no próprio componente), e ele não tem asterisco, porque nenhum campo do fluxo de autenticação precisava. A captura mostra "Nome *" **acima** do campo, e o CA-09 exige a obrigatoriedade anunciada. Acrescentar as duas coisas ao `TextField` mudaria a anatomia de um componente usado por quatro telas de autenticação já aprovadas.

Criado `src/components/ui/text-input-field.tsx` — **dentro** da base de componentes e sobre o mesmo `FieldShell` de `SelectField`, `TextareaField` e `DateField`. É o quarto membro de uma família de três que a TASK-FRONTEND-014 montou; a lacuna é do plano dela, não desta task. Nenhuma linha do `TextField` foi tocada.

### Decisões de implementação

**1. `useStateCities` guarda a UF em `ref`, não em estado.** O valor precisa ser lido pelo closure da resposta no instante em que ela **chega**, não no da renderização em que a requisição partiu. Um estado daria ao closure o valor de quando ele foi criado — que é exatamente o valor obsoleto que a guarda existe para descartar.

**2. A cidade gravada é acrescentada às opções quando não consta da lista.** A alternativa — deixar o `<select>` com um valor que nenhuma `<option>` casa — faz o navegador exibi-lo em branco, e o administrador salva o animal sem perceber que perdeu a localização.

**3. Comparação de data por TEXTO, sem construir `Date`.** `AAAA-MM-DD` ordena lexicograficamente na mesma ordem cronológica. Construir `Date` a partir de `"2022-11-05"` produz meia-noite UTC, e ler o dia a oeste de Greenwich devolve o anterior: a validação recusaria "hoje" como futura durante as três primeiras horas de cada dia no Brasil. O limite de 30 anos é o único ponto que usa `Date`, e o faz inteiramente em UTC (`setUTCFullYear` + `toISOString`), sem fuso local na conta.

**4. `hoje` entra por parâmetro em `validateAnimalForm`,** com o relógio do navegador como padrão: permite exercitar as bordas da janela de 30 anos sem congelar o relógio do processo de teste.

**5. Foco no primeiro erro pela ordem do DOM,** e não pela ordem das chaves do mapa: é a ordem em que o administrador percorre o formulário, e mandar o foco para o terceiro campo quando o primeiro também está errado faria a tela rolar para trás.

**6. A mensagem de sucesso viaja no `state` da navegação** e é lida pela listagem. A leitura confere o formato campo a campo em vez de converter com `as`: `location.state` é controlado pelo histórico do navegador, e qualquer página pode empurrar qualquer coisa ali.

**7. `marcaDeAlteracao` em `ref`.** O token de concorrência não participa de nenhuma renderização; como estado provocaria um render a mais por carga.

### Observação

`RNF-13` pede indicação de progresso durante o envio de imagens grandes. O que existe é o botão em estado "Salvando…" com `aria-busy` — sem barra de percentual, porque a TASK-FRONTEND-012 proíbe explicitamente acrescentar indicador de progresso de envio ao cliente HTTP ("nenhum é exigido por esta feature e cada um mexeria no fluxo do `401`"). Uma barra real exigiria `XMLHttpRequest` ou streams de requisição, fora do escopo das duas tasks.
