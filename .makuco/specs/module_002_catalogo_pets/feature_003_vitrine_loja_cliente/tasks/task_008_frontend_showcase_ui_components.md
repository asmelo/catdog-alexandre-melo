# TASK-FRONTEND-008 — Cartão do animal, grade, etiquetas, imagem com marcador substituto e estados vazios

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-008-frontend-showcase-ui-components`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 8 of 11 — Componentes de apresentação da vitrine
**Generated**: `2026-08-25`

---

## Context

A base de componentes do projeto tem sete peças, todas de formulário de autenticação. **Não existem** cartão, grade, etiqueta, estado vazio, esqueleto de carregamento nem imagem com marcador substituto. Esta task os cria, todos com os recursos já presentes — nenhuma biblioteca de componentes é adotada (CA-55). Componentes de apresentação puros: recebem dados por props e não buscam nada.

---

## Scope

**In:** `AnimalCard`, `AnimalGrid`, `Badge`, `AnimalImage`, `EmptyState`, `CardSkeleton` e o formatador de idade `formatAge`.

**Out:**
- Nenhuma chamada de API, nenhum estado de servidor, nenhum `useEffect` de busca — os componentes recebem tudo por props (TASK-FRONTEND-010 os alimenta).
- Nenhum botão de ação no cartão, nem sob sessão. O módulo de Pedidos não existe e a captura também não mostra botão (RN-08, CA-48, CT-130).
- Nenhum link de detalhe: a página de detalhe está fora de escopo. O `id` já vem na projeção e é o gancho registrado — mas **nada** navega a partir do cartão nesta feature.
- Não implementar a barra de filtros nem a paginação (TASK-FRONTEND-009/010).
- Não truncar descrição em JavaScript nem `slice` de texto: a truncagem é **puramente CSS** (RN-61).
- Sem testes (TASK-FRONTEND-011).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/catalog/animal-card.tsx` | cartão do animal |
| `create` | `src/components/catalog/animal-grid.tsx` | grade semântica responsiva |
| `create` | `src/components/ui/badge.tsx` | etiqueta reaproveitável |
| `create` | `src/components/catalog/animal-image.tsx` | imagem com marcador substituto |
| `create` | `src/components/ui/empty-state.tsx` | dois estados de vazio |
| `create` | `src/components/catalog/card-skeleton.tsx` | esqueleto de carregamento |
| `create` | `src/utils/format-age.ts` | rótulo de idade em PT-BR |
| `modify` | `src/utils/messages.ts` | textos da vitrine |

---

## Implementation

### `src/utils/format-age.ts` *(create)*
- `formatAge(ageInYears: number | null, ageInMonths: number | null): string`, consumindo os **dois** campos que o backend já devolve. A tela **não** recalcula idade a partir de data alguma — o servidor calcula no fuso `America/Sao_Paulo` e recalcular no navegador contradiria a RN-37 (é por isso que `birthDate` está fora da projeção).
- Tabela de saída (RN-38, RN-39, Decisão 11):

| Condição | Rótulo |
|---|---|
| `ageInYears === null` | `Idade não informada` |
| `ageInYears >= 1` | `1 ano` / `N anos` |
| `ageInMonths >= 1` | `1 mês` / `N meses` |
| `ageInMonths === 0` | `Menos de 1 mês` |

- Concordância correta em todos os casos. A captura exibe "3 ano(s)"; esta spec corrige, pelo mesmo princípio que já corrigiu "Total: 1 animais" na FEATURE-002 deste módulo (CT-66, QA-31).

### `src/utils/messages.ts` *(modify)*
- Acrescentar os textos **de interface pura** desta tela: título, opções neutras dos filtros, aviso do filtro de idade, "Limpar filtros", resumo de resultados (singular e plural), as duas mensagens de vazio, falha ao carregar as opções e o padrão de texto alternativo `Foto de {nome}`.
- **Não** replicar aqui as mensagens que o backend devolve — o texto do limitador de taxa chega em `ApiError.message` e duplicá-lo criaria duas fontes de verdade para a mesma frase. "Não foi possível carregar os animais. Tente novamente." e "Ocorreu um erro inesperado. Tente novamente." já existem no catálogo; reaproveitar, não recriar.

### `src/components/ui/badge.tsx` *(create)*
**Reference pattern**: `src/components/ui/submit-button.tsx` — componente de apresentação puro, props tipadas, classes de token.
- Props: `children` e `tone` (`'species' | 'trait'`). A etiqueta de espécie e as três de característica têm pesos visuais diferentes na captura.
- `<span>` com texto legível **sempre**: espécie, sexo, porte e idade nunca são comunicados só por cor (RNF-28, CT-125).
- Contraste mínimo 4.5:1 sobre o fundo escolhido, com os tokens `brand.*` / `ink.*`. O projeto tem histórico de divergir deliberadamente do mockup por contraste e documentar a divergência — seguir o mesmo procedimento se algum par de cores da captura não atingir o mínimo (RNF-27).

### `src/components/catalog/animal-image.tsx` *(create)*
- Props `{ src: string | null; animalName: string }`.
- `src === null` → marcador substituto neutro, **decorativo**: `aria-hidden="true"` e sem texto alternativo que gere anúncio redundante (RNF-24, CT-122).
- `src` presente → `<img>` com `alt={`Foto de ${animalName}`}` (RNF-24), `loading="lazy"` (RNF-20, CT-127) e `onError` que **troca o estado interno para o marcador substituto**. Nunca o ícone de imagem quebrada do navegador (RN-63, CT-13). A vitrine é a face pública do produto e uma imagem quebrada nela custa mais que a ausência de imagem.
- O `onError` precisa ser idempotente e **não** pode reatribuir `src` do próprio elemento — trocar o `src` no handler pode redisparar `onError` em laço. Trocar o **estado do React** e deixar o React remontar.
- Altura fixa em ambos os caminhos: o cartão sem foto mantém a mesma altura dos demais e a grade não fica serrilhada (RN-62, CT-12).
- Nenhum redimensionamento nem CDN: a imagem é a mesma do armazenamento, exibida menor — limitação já registrada pela FEATURE-002 deste módulo.

### `src/components/catalog/animal-card.tsx` *(create)*
- Props: `{ animal: PublicAnimal }` (tipo da TASK-FRONTEND-007). Nada mais — nem `onClick`, nem `canDelete`, nem role.
- Estrutura, de cima para baixo (CA-08, CT-10):
  1. `AnimalImage` ocupando a largura do cartão;
  2. linha com o nome em destaque à esquerda e `Badge tone="species"` alinhada à direita, na mesma altura;
  3. localização `"{city.name} - {city.stateUf}"` precedida do ícone de marcador, `aria-hidden="true"` — a localização é legível como texto sem depender do ícone (RNF-23, CT-121). O ícone é decorativo e **não abre mapa nenhum**;
  4. três `Badge tone="trait"` em sequência: sexo, porte e idade, nessa ordem;
  5. descrição, **ausente do DOM** quando `description === null` (CT-14).
- Rótulos exibidos em PT-BR acentuado — "Macho"/"Fêmea", "Pequeno"/"Médio"/"Grande" — enquanto o contrato trafega minúsculas sem acento. O mapa de tradução é constante de módulo, não `if` espalhado (RN-65).
- **Semântica** (RNF-23, CT-121): `<article>` ou `<li>` conforme a grade; o nome do animal em `<h2>` — um nível abaixo do `<h1>` "Animais para adoção" da página.
- Descrição: `line-clamp` por CSS. O texto **completo** permanece no documento e acessível à tecnologia assistiva; nada é cortado em JavaScript (RN-61, CA-45, CT-15).
- **Conteúdo do administrador é sempre texto** — nome, espécie, cidade e descrição entram como filhos JSX. Em nenhum ponto desta feature existe `dangerouslySetInnerHTML` (RN-60, CA-44, CT-16, CT-17, QA-09). O React escapa por padrão; a regra existe para que ninguém "melhore" a renderização depois.
- **Nenhum botão, nenhum link, nenhum `onClick`** (CA-48, CT-130).

### `src/components/catalog/animal-grid.tsx` *(create)*
- Props `{ animals: readonly PublicAnimal[] }`.
- `<ul>` com um `<li>` por cartão e `aria-label` informando a contagem — a grade é anunciada como lista com o seu tamanho (RNF-22, CT-120, QA-55).
- Colunas por breakpoint do Tailwind: 1 / 2 / 3 / 4 (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) — as três quantidades que tornam 12 uma página sem fila incompleta (RN-17, RNF-29, CT-126).
- Em nenhuma largura a página rola horizontalmente nem o conteúdo do cartão é cortado (CA-54, QA-52).
- `key={animal.id}`, jamais índice: com paginação, índice reaproveita nó entre páginas diferentes.

### `src/components/ui/empty-state.tsx` *(create)*
- Props `{ message: string; action?: ReactNode }`. **Um componente, dois usos** — a diferença entre os dois estados de vazio é a mensagem e a presença da ação, e a decisão de qual exibir é da página (TASK-FRONTEND-010), não deste componente.
- Catálogo vazio → "Nenhum animal disponível para adoção no momento. Volte em breve!", **sem** ação (CT-91).
- Sem resultado com filtros → "Nenhum animal encontrado com os filtros aplicados.", **com** a ação "Limpar filtros" (CT-92).

### `src/components/catalog/card-skeleton.tsx` *(create)*
- Blocos neutros com a mesma geometria do cartão, dentro da mesma grade, para que o layout não salte quando os dados chegam.
- `aria-hidden="true"`: o anúncio do carregamento é responsabilidade da região viva da página (TASK-FRONTEND-010), e um esqueleto anunciado duplicaria a fala.
- Respeitar `prefers-reduced-motion`: sem animação quando o visitante a desativou.

---

## Acceptance Criteria

- [ ] **Given** o animal "Theo" — cachorro, macho, grande, Campo Magro/PR, `ageInYears: 3` —, **When** o cartão renderiza, **Then** apresenta a foto no topo, "Theo" em destaque, a etiqueta "Cachorro" à direita, "Campo Magro - PR" com ícone, as etiquetas "Macho", "Grande" e "3 anos", e a descrição (CA-08, CT-10, QA-06).
- [ ] **Given** `coverImageUrl === null`, **When** o cartão renderiza, **Then** o marcador substituto ocupa o lugar da foto, o cartão mantém a mesma altura dos demais e todas as demais informações continuam presentes (CA-46, RN-62, CT-12, QA-07).
- [ ] **Given** um `coverImageUrl` cuja imagem falha ao carregar, **When** o `onError` dispara, **Then** o mesmo marcador substituto é exibido — o ícone de imagem quebrada do navegador **nunca** aparece, e o handler não entra em laço (CA-46, RN-63, CT-13, QA-51).
- [ ] **Given** o armazenamento de objetos inteiramente fora do ar, **When** a grade renderiza, **Then** todos os cartões exibem o marcador substituto e **todos os dados textuais continuam presentes** (RNF-14, CT-111, QA-51).
- [ ] **Given** um cartão, **When** a localização é lida, **Then** é `"{cidade} - {UF}"` vinda do dado devolvido pela API, sem nenhuma consulta a serviço externo em tempo de renderização, e o ícone de marcador não abre mapa nenhum (CA-47, RN-64, QA-06).
- [ ] **Given** `ageInYears: null`, **Then** a etiqueta é "Idade não informada"; **Given** `1`, **Then** "1 ano"; **Given** `3`, **Then** "3 anos"; **Given** `ageInYears: 0, ageInMonths: 5`, **Then** "5 meses"; **Given** `ageInMonths: 0`, **Then** "Menos de 1 mês" (CA-25, CT-58, CT-66, CT-67, CT-68, QA-30, QA-31).
- [ ] **Given** `description === null`, **When** o cartão renderiza, **Then** a área de descrição **não está no DOM** e o cartão permanece alinhado aos demais (CT-14).
- [ ] **Given** uma descrição de 1000 caracteres, **When** o cartão renderiza, **Then** ela é truncada apenas visualmente e o texto **completo** permanece no documento (CA-45, RN-61, CT-15).
- [ ] **Given** descrição, nome do animal, nome da espécie ou nome da cidade contendo `<script>alert(1)</script>` e `<img src=x onerror=alert(1)>`, **When** o cartão renderiza, **Then** os caracteres aparecem **literalmente como texto**, nenhum script executa e nenhum elemento é criado a partir do conteúdo (CA-44, RNF-03, CT-16, CT-17, QA-09).
- [ ] **Given** o código de todos os componentes desta task, **When** inspecionado, **Then** não existe nenhuma ocorrência de `dangerouslySetInnerHTML` (RN-60).
- [ ] **Given** qualquer cartão, com e sem sessão, **When** o DOM é inspecionado, **Then** não existe nenhum `<button>` nem `<a>` dentro dele (CA-48, CT-130).
- [ ] **Given** a grade com N cartões, **When** percorrida por leitor de tela, **Then** é anunciada como lista com a contagem N, e cada cartão é um item cujo nome do animal é um título de nível abaixo do título da página (CA-52, RNF-22, RNF-23, CT-120, CT-121, QA-55).
- [ ] **Given** o ícone de localização e o marcador substituto, **When** percorridos por leitor de tela, **Then** nenhum dos dois gera anúncio (RNF-24, CT-121, CT-122).
- [ ] **Given** um cartão com foto, **When** o `alt` é lido, **Then** é "Foto de {nome do animal}" (RNF-24, CT-122).
- [ ] **Given** larguras de telefone, tablet, notebook e monitor largo, **When** a grade renderiza, **Then** exibe 1, 2, 3 e 4 colunas, sem rolagem horizontal da página e sem cortar conteúdo do cartão (CA-54, RNF-29, CT-126, QA-52).
- [ ] **Given** uma grade com mais cartões do que cabem na tela, **When** renderizada, **Then** as imagens abaixo da dobra trazem `loading="lazy"` (RNF-20, CT-127).
- [ ] **Given** as etiquetas e o texto sobre a área da imagem, **When** o contraste é medido, **Then** texto ≥ 4.5:1 e indicadores ≥ 3:1; qualquer divergência deliberada em relação à captura está documentada junto do token (RNF-27, CT-125, QA-57).
- [ ] **Given** `package.json`, **When** comparado, **Then** nenhuma dependência nova (CA-55).
- [ ] `npm run typecheck` com 0 erros, sem `any`.

---

## Dependencies

- **Requires**: TASK-FRONTEND-007 (tipo `PublicAnimal`); tokens do Tailwind e os sete componentes existentes (FEATURE-002 do MODULE-001).
- **Blocks**: TASK-FRONTEND-010 (a página compõe estes componentes), TASK-FRONTEND-011.
