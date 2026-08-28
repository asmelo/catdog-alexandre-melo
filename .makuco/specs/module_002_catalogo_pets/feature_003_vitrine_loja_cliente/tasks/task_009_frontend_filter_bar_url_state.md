# TASK-FRONTEND-009 — Barra de filtros e estado da vitrine no endereço da página

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-009-frontend-filter-bar-url-state`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 9 of 11 — Filtros e estado compartilhável
**Generated**: `2026-08-25`

---

## Context

A barra de sete controles e a tradução entre o endereço da página — **em PT-BR**, porque endereço é interface visível — e os parâmetros da API, em inglês. A regra que governa esta task é "**a tela tolera, a API recusa**" (RN-49/RN-50): um link estragado por um app de mensagens precisa mostrar o catálogo, e não uma tela de erro; o rigor que protege qualquer consumidor fica no servidor, já entregue.

---

## Scope

**In:** `showcase-filters.ts` (tipo dos filtros + leitura tolerante da query string + escrita + tradução para a API); `ShowcaseFilterBar`; o hook de atraso da digitação.

**Out:**
- Nenhuma chamada de API e nenhum estado de resultado — a barra recebe as opções por props e notifica mudanças por callback (TASK-FRONTEND-010 orquestra).
- Não implementar a grade, a paginação, os estados de vazio nem o resumo de resultados (TASK-FRONTEND-008/010).
- **Não adotar biblioteca de formulário nem de schema.** O padrão do projeto é função pura devolvendo mapa de erros por campo (CA-55).
- Não replicar no cliente a validação do servidor como garantia: as checagens da tela existem para retorno imediato e para tolerar link estragado (RN-49, CA-35).
- Sem testes (TASK-FRONTEND-011).

---

## Ubiquitous Language

| Termo de negócio | Endereço da página (PT-BR) | Parâmetro da API (inglês) |
|---|---|---|
| Busca livre | `busca` | `search` |
| Espécie | `especie` | `speciesId` |
| Porte | `porte` | `size` |
| Sexo | `sexo` | `sex` |
| Idade máxima | `idadeMax` | `maxAgeYears` |
| Cidade | `cidade` | `cityId` |
| Página | `pagina` | `page` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/pages/showcase/showcase-filters.ts` | leitura e escrita do endereço |
| `create` | `src/components/catalog/showcase-filter-bar.tsx` | os sete controles |
| `create` | `src/utils/use-debounced-value.ts` | atraso da digitação |

---

## Implementation

### `src/pages/showcase/showcase-filters.ts` *(create)*
**Reference pattern**: `src/utils/validation.ts` — funções puras, sem React, sem efeito colateral. Mesmo padrão, aplicado a `URLSearchParams` em vez de a campos de formulário.

**Decisões já fechadas**:
- `ShowcaseFilters = { busca: string; especie: string | null; porte: AnimalSize | null; sexo: AnimalSex | null; idadeMax: number | null; cidade: string | null; pagina: number }`. Estado da tela em PT-BR; a tradução acontece na fronteira.
- `parseShowcaseFilters(params: URLSearchParams): ShowcaseFilters` — **tolerante por desenho** (RN-49, CA-35):
  - `busca` acima de 120 caracteres → truncada; só espaços → vazia;
  - `especie`/`cidade` fora do formato UUID → descartados. **Um UUID bem formado é mantido mesmo que não esteja entre as opções** — quem decide que não existe é o servidor, e ele responde `200` vazio, nunca `404` (RN-51, RN-33);
  - `porte`/`sexo` fora do conjunto → descartados;
  - `idadeMax` negativo, fracionário, não numérico ou acima de 30 → descartado. **`0` é preservado** (RN-41);
  - `pagina` não numérica ou menor que 1 → `1`; **maior que a última existente é preservada** — a grade vem vazia com a mensagem de nenhum resultado, e não erro (RN-20, CT-76);
  - parâmetro desconhecido → ignorado;
  - **em nenhuma circunstância esta função lança.** Ela sempre devolve um estado renderizável (CT-86, CT-87, QA-39).
- `toSearchParams(filters): URLSearchParams` — **só o que está aplicado** deixa parâmetro. `busca` vazia, filtro em `null` e `pagina === 1` não aparecem; "Limpar filtros" devolve o endereço sem nenhum parâmetro (RN-48, CA-33, CT-85, CT-89).
- `toApiFilters(filters)` — traduz para as chaves em inglês da TASK-FRONTEND-007. **Uma única função de tradução**, na fronteira; duas cópias divergiriam no primeiro filtro novo (RN-47).
- `hasActiveFilters(filters): boolean` — verdadeiro se qualquer um dos seis critérios está aplicado. Governa o botão "Limpar filtros", o resumo de resultados e a escolha entre as duas mensagens de vazio. **`pagina` não conta como filtro.**
- `EMPTY_FILTERS` como constante de módulo — o estado a que "Limpar filtros" retorna.
- A sincronização com o roteador usa `useSearchParams`, e a escrita é `replace` para alteração de filtro (o histórico não deve encher a cada tecla) e `push` para troca de página (o botão de voltar precisa voltar de página) — é o que faz CT-84 e CT-83 conviverem.
- O endereço é **corrigido** quando `parse` descarta algo: reescrever com `toSearchParams(parse(...))` no primeiro efeito, com `replace`, para que o link estragado não permaneça na barra de endereços (RN-49, CT-86, CT-87).

### `src/utils/use-debounced-value.ts` *(create)*
- `useDebouncedValue<T>(valor: T, atrasoMs: number): T`, com limpeza do temporizador no `useEffect`. 300–400 ms.
- Aplicado **apenas** a `busca` e a `idadeMax`, que são digitados. Campos de seleção aplicam **imediatamente** — atrasar uma escolha discreta é latência sem ganho (RN-52, CT-35, RNF-19, QA-18).
- Nenhuma dependência nova (CA-55).

### `src/components/catalog/showcase-filter-bar.tsx` *(create)*
**Reference pattern**: `src/components/ui/text-field.tsx` — rótulo associado por `htmlFor`/`id`, `FieldError` para mensagem de campo.

**Componentes reaproveitados** — declarados explicitamente porque a ordem de entrega importa:
- **campo de seleção** (`SelectField`) e **paginação** (`Pagination`) vêm da **FEATURE-002 deste módulo**. Se ela ainda não os tiver entregue, eles entram no escopo desta task e o esforço de frontend desta feature cresce substancialmente — é o risco declarado na tabela de dependências da spec;
- **campo de texto** (`TextField`) já existe na base atual.

**Estrutura e decisões já fechadas**:
- Painel branco de largura inteira, sete controles em uma linha em tela larga, empilhados em tela estreita (RNF-29):

| # | Rótulo **visível** | Tipo | Texto de apoio | Estado inicial |
|---|---|---|---|---|
| 1 | Buscar | texto | "Busque por nome ou cidade" | vazio |
| 2 | Espécie | seleção | — | "Todas as espécies" |
| 3 | Porte | seleção | — | "Todos os portes" |
| 4 | Sexo | seleção | — | "Todos os sexos" |
| 5 | Idade máxima | numérico | "Idade máxima" | vazio |
| 6 | Cidade | seleção | — | "Todas as cidades" |
| 7 | — | botão "Limpar filtros" | — | visível e **desabilitado** |

- **Todo controle tem rótulo visível e associado de verdade.** A captura usa apenas texto de apoio na busca e na cidade; **texto de apoio não é rótulo** e placeholder some ao digitar (RNF-21, CA-51, CT-119, QA-54, Decisão 18).
- O rótulo do filtro de espécie é "**Espécie**", não "Animal" como na captura: é o termo do glossário do produto (Decisão 18).
- O campo de cidade é **seleção de lista controlada**, não campo de texto. Um campo de texto de cidade duplicaria a busca livre, que já procura por cidade (RN-28, RN-29, divergência #6 da spec).
- Abaixo do campo de idade máxima, texto de apoio **permanente** — não condicional, não tooltip: "Animais sem data de nascimento não aparecem quando este filtro é usado." Associado ao campo por `aria-describedby` (RN-43, CA-29, CT-71, QA-27).
- Opções de espécie e de cidade vêm por props (`CatalogSpeciesOption[]` / `CatalogCityOption[]`). Cidade é apresentada como `"{name} - {stateUf}"`; o valor submetido é o `id` (RN-28, RN-30, CT-51).
- **RN-33 — valor aplicado fora das opções**: se `especie` ou `cidade` do endereço não estiver na lista recebida, a barra acrescenta uma **opção adicional** com aquele valor selecionado, em vez de deixar o campo em branco. Sumir em silêncio esconderia do visitante o motivo de a lista estar vazia (CA-21, CT-53, HU-07 cenário 7).
- **Falha ao carregar as opções**: a prop de erro faz o campo afetado exibir "Não foi possível carregar as opções. Tente novamente." em vez de aparecer vazio. A barra continua utilizável e a grade não é bloqueada por isso (CA-39, CT-96, HU-11 cenário 7).
- "Limpar filtros" fica **visível e desabilitado** quando `hasActiveFilters` é falso, sem mudar o arranjo da barra — nada de ocultar o botão, que faria a linha saltar (CT-90, QA-41).
- Toda alteração de filtro ou de busca **repõe `pagina` em 1** (RN-36, CA-23, CT-79, QA-32). A reposição vive na função que aplica a mudança, não espalhada por sete manipuladores.
- Idade máxima: `inputMode="numeric"`, aceita apenas dígitos. Valor digitado fora de 0–30 **não é enviado**; o campo sinaliza o problema com `FieldError` e a grade mantém o último resultado válido (Ação 3 da spec).
- A barra permanece **visível e utilizável durante o carregamento** da grade — nunca desabilitada em bloco (RN-... estado de carregamento, CA-38, CT-94).
- Operável inteiramente por teclado, em ordem de foco coerente com a leitura (RNF-25, CT-123, QA-53). Nenhum controle personalizado sem papel: usar `<select>`, `<input>` e `<button>` nativos.

---

## Acceptance Criteria

- [ ] **Given** a barra renderizada, **When** percorrida por leitor de tela, **Then** cada um dos seis controles é alcançado pelo seu **rótulo visível**, e nenhum depende do texto de apoio como rótulo (CA-51, RNF-21, CT-119, QA-54).
- [ ] **Given** a barra renderizada, **When** os rótulos são lidos, **Then** são "Buscar", "Espécie", "Porte", "Sexo", "Idade máxima" e "Cidade", nessa ordem, seguidos de "Limpar filtros" (CA-07, CT-... ordem da captura).
- [ ] **Given** nenhum filtro aplicado, **When** os campos de seleção são observados, **Then** exibem "Todas as espécies", "Todos os portes", "Todos os sexos" e "Todas as cidades" (HU-06 cenário 1).
- [ ] **Given** nenhum filtro aplicado, **When** "Limpar filtros" é observado, **Then** está **no DOM**, visível e desabilitado, e o arranjo da barra é idêntico ao com filtros (CT-90, QA-41).
- [ ] **Given** busca e os cinco filtros aplicados, **When** o endereço é observado, **Then** traz `busca`, `especie`, `porte`, `sexo`, `idadeMax`, `cidade` e `pagina` **em PT-BR** — o estado da tela vive no endereço, não apenas em memória (CA-32, RN-46, RN-47, CT-81, QA-35).
- [ ] **Given** filtros parcialmente preenchidos, **When** o endereço é montado, **Then** apenas os aplicados deixam parâmetro (CA-33, RN-48, CT-85).
- [ ] **Given** um endereço com filtros aberto em janela limpa e sem sessão, **When** a página carrega, **Then** a barra já vem preenchida com aqueles valores (CA-32, CT-82, QA-36).
- [ ] **Given** `?idadeMax=-5&porte=gigante&especie=abc&pagina=xyz&desconhecido=1`, **When** a página carrega, **Then** todos os cinco são descartados, o endereço é corrigido e a vitrine é exibida **normalmente**, sem tela de erro (CA-35, RN-49, CT-86, CT-87, QA-39).
- [ ] **Given** os mesmos valores enviados **diretamente à API**, **When** a requisição chega, **Then** ela responde `400` — as duas posturas coexistem por desenho (CA-35, RN-50, CT-88).
- [ ] **Given** `?idadeMax=0`, **When** a página carrega, **Then** o filtro é aplicado com valor `0` — não descartado (RN-41, CT-59).
- [ ] **Given** `?especie=<UUID válido de espécie inexistente>`, **When** a página carrega, **Then** o filtro **permanece aplicado** e é apresentado no campo como opção adicional (CA-21, RN-33, CT-53).
- [ ] **Given** o visitante na página 3, **When** altera qualquer filtro, **Then** `pagina` volta a 1 (CA-23, RN-36, CT-79, QA-32).
- [ ] **Given** dez caracteres digitados em sequência rápida na busca, **When** o atraso decorre, **Then** o callback de mudança é acionado **uma única vez** (CA-18, RN-52, RNF-19, CT-35, QA-18).
- [ ] **Given** uma escolha em qualquer campo de seleção, **When** feita, **Then** o callback é acionado **imediatamente**, sem atraso (RN-52).
- [ ] **Given** filtros aplicados, **When** "Limpar filtros" é acionado, **Then** busca e os cinco filtros voltam ao estado inicial, `pagina` volta a 1 e o endereço fica **sem nenhum parâmetro** (CA-33, CT-89, QA-40).
- [ ] **Given** um filtro alterado, **When** o botão de voltar do navegador é acionado, **Then** o estado anterior dos filtros é restaurado (CA-34, CT-84, QA-38).
- [ ] **Given** filtros aplicados, **When** a página é recarregada, **Then** nada é perdido, inclusive a página atual (CA-34, CT-83, QA-37).
- [ ] **Given** a falha ao carregar as opções de espécie ou de cidade, **When** a barra renderiza, **Then** o campo afetado exibe "Não foi possível carregar as opções. Tente novamente." em vez de aparecer vazio (CA-39, CT-96).
- [ ] **Given** o campo de idade máxima, **When** observado, **Then** o texto de apoio permanente sobre animais sem data de nascimento está presente e associado ao campo (CA-29, RN-43, CT-71, QA-27).
- [ ] **Given** a grade em carregamento, **When** a barra é observada, **Then** ela permanece visível e utilizável (CA-38, CT-94).
- [ ] **Given** apenas o teclado, **When** a barra é percorrida, **Then** os sete controles são alcançáveis e acionáveis em ordem coerente com a leitura (CA-53, RNF-25, CT-123, QA-53).
- [ ] **Given** `package.json`, **When** comparado, **Then** nenhuma dependência nova (CA-55).

---

## Dependencies

- **Requires**: TASK-FRONTEND-007 (tipos e chaves da API); **FEATURE-002 deste módulo** — componentes `SelectField` e `Pagination`. **Se aquela feature não os tiver entregue quando esta começar, criá-los entra no escopo desta task**, e é o principal risco de esforço do frontend desta feature; `TextField` e `FieldError` já existem (FEATURE-002 do MODULE-001).
- **Blocks**: TASK-FRONTEND-010, TASK-FRONTEND-011.

---

## Revisão — 2026-08-28

**Status**: APROVADO

**634 testes, 40 suítes, 0 falha.** `tsc --noEmit` e `tsc -p tsconfig.test.json` limpos. Três dependências de execução, as mesmas.

| Critério de aceite | Resultado |
|---|---|
| Cada controle alcançado pelo **rótulo visível** (CT-119) | **Confirmado.** `getByLabelText` encontra os seis — ele só acha o que tem `<label>` de verdade |
| Rótulos na ordem da captura, seguidos de "Limpar filtros" | **Confirmado** lendo os `<label>` do DOM em ordem |
| Opções neutras nos quatro campos de seleção | **Confirmado** |
| "Limpar filtros" no DOM, visível e desabilitado (CT-90) | **Confirmado**, e habilitado com filtro aplicado |
| Endereço em PT-BR com os sete parâmetros (CT-81) | **Confirmado** pela ida e volta `toSearchParams` → `parse` |
| Só o aplicado deixa parâmetro (CT-85) | **Confirmado** |
| Endereço com filtros preenche a barra (CT-82) | **Confirmado** |
| Endereço inteiramente estragado não lança (CT-86, CT-87) | **Confirmado.** Os cinco descartados, estado renderizável, sem tela de erro |
| Os mesmos valores na API respondem 400 (CT-88) | **Confirmado no backend**, em `catalog-routes.spec.ts` — as duas posturas coexistem por desenho |
| `?idadeMax=0` é aplicado (CT-59) | **Confirmado** nos três pontos: leitura, escrita e tradução |
| UUID de espécie inexistente permanece e vira opção adicional (CT-53) | **Confirmado** nos dois níveis |
| Mudar filtro na página 3 repõe em 1 (CT-79) | **Confirmado** para seleção **e** para busca |
| Dez caracteres → um único callback (CT-35) | **Confirmado** |
| Escolha em seleção → callback imediato | **Confirmado**, sem `waitFor` |
| "Limpar filtros" devolve o endereço sem parâmetro (CT-89) | **Confirmado** |
| Falha ao carregar opções (CT-96) | **Confirmado.** O campo afetado exibe o aviso e a barra segue utilizável |
| Aviso permanente do filtro de idade (CT-71) | **Confirmado**, associado por `aria-describedby` |
| Barra utilizável durante o carregamento (CT-94) | **Confirmado por construção:** nenhuma prop de `loading` chega à barra, então não há como desabilitá-la em bloco |
| Sete controles alcançáveis por teclado, em ordem (CT-123) | **Confirmado** com sete `tab` em sequência |
| Nenhuma dependência nova | **Confirmado** |

### `SelectField` e `Pagination` estavam prontos

A task declara como principal risco de esforço a possibilidade de a FEATURE-002 não ter entregue os dois componentes. **Ela entregou** — `SelectField` na TASK-FRONTEND-014 e `Pagination` na TASK-FRONTEND-016 —, e os dois foram reaproveitados sem alteração. O `labelHidden` que o `SelectField` ganhou na 016 não é usado aqui: nesta barra **todos** os rótulos são visíveis.

### Notas de implementação

**A reposição de `pagina` vive em um lugar só.** Espalhada por sete manipuladores, o sétimo esqueceria — e o defeito apareceria como "filtrei e a lista veio vazia", na página 3 de um conjunto de uma página.

**A opção adicional para valor fora da lista não inventa nome.** A tela não conhece o nome do registro que saiu das opções, então o rótulo diz o que se sabe: "Filtro aplicado (fora da lista atual)". Deixar o campo em branco mostraria "Todas as espécies" selecionado com zero resultados — uma combinação que não faz sentido para o visitante.

**O campo de idade recusa localmente sem impedir o resto.** Valor fora de 0–30 sinaliza com `FieldError`, não é enviado, e a grade mantém o último resultado válido. Campo vazio é "filtro não aplicado", e **não** erro.

**Dois `useEffect` com dependência reduzida, e o motivo está no comentário.** `filters` e `onChange` mudam de identidade a cada render do pai; incluí-los nas dependências reenviaria a busca em laço. O gatilho é o valor atrasado, e só ele.

### Arquivos de teste escritos aqui

`showcase-filters.spec.ts` consta da TASK-FRONTEND-011; `showcase-filter-bar.spec.tsx` não consta de nenhuma. Os dois foram escritos aqui porque a tolerância a endereço estragado é a regra central desta task — a promessa de que a função **nunca lança** só vale verificada — e porque os critérios de acessibilidade dos rótulos são o desvio deliberado em relação à captura, que precisa de rede desde já.
