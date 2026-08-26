# Makuco Specification Quality Checklist: Vitrine da Loja (visão do cliente)

**Purpose**: Verificar se a especificação da FEATURE-003 do MODULE-002 atende aos critérios de qualidade de conteúdo, completude de requisitos e prontidão para implementação.
**Created**: 2026-08-25
**Feature**: [spec_context.md](../spec_context.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — **aprovado com ressalva declarada**, ver Notas
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — **vale para os Grupos 1 a 3 até as Regras de Negócio**, ver Notas
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — **aprovado com ressalva declarada**, ver Notas

## Notas

### Volume e continuidade da numeração

13 histórias de usuário, 67 regras de negócio, 33 requisitos não funcionais, 134 casos de teste, 56 critérios de aceite e 62 cenários de QA. A numeração de RN, RNF, CT, CA e QA foi verificada como **contínua e sem lacunas nem duplicidades**.

### Iteração 1 de validação — itens reprovados e corrigidos

Cinco defeitos foram encontrados na primeira passagem e corrigidos antes da aprovação. Todos sob "Requirements are testable and unambiguous", e todos da mesma classe: **referência cruzada apontando para a regra errada**. Estão registrados em ALT-002 do changelog.

1. Divergência #3 da tabela de divergências (rótulo "Animal" → "Espécie") apontava para RN-24, que trata de busca por conteúdo em qualquer posição.
2. Divergência #4 (etiqueta de idade) apontava para RN-36, que trata de reposição de página ao alterar filtro.
3. Divergência #5 (rótulos visíveis e associados) apontava para RN-49, que trata de valores inválidos vindos do endereço.
4. Divergência #6 (natureza do campo Cidade) apontava para RN-25 e RN-26, que tratam de busca como sequência única e de normalização de espaços.
5. A RN-38 introduzia a idade em meses sem declarar a sua relação com a RN-20 da FEATURE-002 deste módulo, que define a idade apenas em anos. Sem essa declaração, a regra podia ser lida como **substituição** de uma regra congelada, e não como extensão aditiva.

O quinto item é o mais relevante: os quatro primeiros eram erros de ponteiro, enquanto este podia induzir a alteração de um contrato herdado.

### Ressalva sobre os dois itens de "implementation details"

As seções **Contrato de API**, **Decisões de Arquitetura**, **Modelo de Dados** e **Impacto Técnico Transversal** contêm, deliberadamente, detalhe de implementação — endpoints, códigos de status, colunas de banco, índices e arquivos do frontend. Elas foram **exigidas explicitamente no contrato de criação desta spec**, que pediu o mesmo nível de rigor das duas features anteriores acrescido de contrato de API completo, modelo de dados e cenários de QA. Os itens são marcados como aprovados pelos mesmos três motivos já registrados nas FEATURE-001 e FEATURE-002 deste módulo:

- os Grupos 1 e 2 e as histórias de usuário permanecem inteiramente em linguagem de negócio e são legíveis por stakeholder não técnico;
- nenhuma regra de negócio depende de leitura das seções técnicas — cada RN é autossuficiente e as seções técnicas apenas materializam o que as RN já determinam;
- o detalhe técnico está confinado a quatro seções nomeadas e contíguas, e não espalhado pelo documento.

### Decisões tomadas sem consulta ao responsável do produto

A execução autônoma foi autorizada no contrato de criação. **Vinte decisões** foram tomadas e estão registradas em ALT-001 do changelog, com justificativa individual e alternativas descartadas. As quatro de maior impacto:

1. **A vitrine é pública** (Decisão 1), resolvendo a contradição entre a captura de tela, que mostra um cabeçalho autenticado, e o `MAKUCO.md`, que declara o catálogo público. A decisão tem consequência estrutural: exige um bloco de rota **fora** de `ProtectedRoute`, `RoleRoute` e `PublicOnlyRoute`, um layout novo e uma alteração no layout do cliente. É a decisão de maior blast radius da spec.
2. **Prefixo de API próprio** (Decisão 4), em vez de fazer `GET /api/animals` responder de duas formas conforme a sessão. Sem isso, a projeção pública e a administrativa ficariam a um `if` de distância uma da outra.
3. **Limitação de taxa aplicada** (Decisão 14), contrariando o precedente das duas features anteriores do módulo. O motivo que as levou a dispensar o limitador — operação administrativa autenticada de baixo volume — não se transfere para o primeiro endpoint anônimo de leitura do produto.
4. **Colunas de busca persistidas sem acento** (Decisão 5), que são a única alteração desta feature em tabelas entregues por outra spec.

### Divergências entre a captura de tela e o que a spec entrega

Sete divergências estão tabeladas na spec e registradas no changelog. A de maior impacto é a exigência de sessão (item 7 da tabela), porque muda a árvore de rotas. As demais — caminho em PT-BR, nome em vez de e-mail no cabeçalho, rótulo "Espécie" em vez de "Animal", concordância da etiqueta de idade, rótulos visíveis e associados e campo Cidade como seleção — seguem precedentes já estabelecidos no módulo: correção de defeito de concordância visível na fonte da verdade, e divergência deliberada por acessibilidade.

### Pontos de atenção que sobrevivem à aprovação desta spec

1. **Dependência de sequenciamento com a FEATURE-002 deste módulo.** Aquela spec declara que **ela** cria os componentes de campo de seleção e de paginação; esta os reaproveita. Se a FEATURE-002 não os entregar, eles entram no escopo desta e o esforço de frontend cresce de forma relevante. Está declarado na tabela de dependências e em "Impacto Técnico Transversal".
2. **A alteração da árvore de rotas é o maior risco de regressão da entrega.** Ela toca `app-routes.tsx`, `route-paths.ts` e `client-layout.tsx`, todos cobertos por testes que verificam justamente o comportamento das guardas e a ausência de controles administrativos na área do cliente. Há itens de regressão dedicados.
3. **Duas colunas com nomes parecidos e finalidades opostas na mesma tabela.** `name_normalized` preserva acentos e serve à ordenação alfabética administrativa; `name_search` remove acentos e serve à busca da vitrine. Confundi-las alteraria silenciosamente a ordenação da listagem administrativa. A distinção está comentada no modelo e registrada na Decisão 5.
4. **Limitação de desempenho com gatilho de revisão declarado.** A busca por conteúdo em qualquer posição não se beneficia de índice comum. Irrelevante no volume declarado; registrada com o limiar a partir do qual a decisão volta à mesa.
5. **Comportamento da raiz do endereço não foi alterado.** Um visitante que digita apenas o domínio continua caindo no login, o que é discutível para um produto cujo catálogo é público. A alteração foi deliberadamente deixada fora de escopo pelo seu blast radius sobre o redirecionamento por perfil, e está registrada como recomendação de acompanhamento na Decisão A da spec e na Decisão 1 do changelog. **É a lacuna de produto mais visível que sobrevive a esta entrega.**

### Escopo explicitamente excluído

Quinze exclusões estão listadas em "O que Não Deve Ser Feito", entre elas: página de detalhe do animal, demonstração de interesse, ordenação configurável, rolagem infinita, filtro por raça, exibição de status ao público, alteração da raiz do endereço, mapa e geolocalização, otimização para mecanismos de busca, cache e redimensionamento de imagem, e qualquer dependência nova.

Cinco delas estão em "Escopo diferido", cada uma com o **gancho já entregue** e a **condição para entrar**. As duas mais importantes:

- **Página de detalhe:** a descrição truncada no cartão sugere que há mais a ver, e a lacuna é reconhecida em vez de omitida. O gancho é que a projeção pública já devolve o identificador do animal e a descrição **integral** — a truncagem é puramente visual, portanto nada foi perdido no servidor.
- **Campos internos na vitrine:** aqui o gancho é uma **proteção, e não uma abertura**. As RN-54 a RN-57 garantem que número do chip e contato do proprietário, quando entrarem no cadastro, não apareçam na vitrine por padrão — em duas camadas independentes, a seleção explícita de colunas e a enumeração explícita de chaves, verificadas por igualdade de conjunto e não por continência.

### Pendências herdadas que esta feature não quita

A regra registrada na RN-17b da FEATURE-002 deste módulo — animal referenciado por algum pedido não pode ser excluído, com integridade referencial restritiva no vínculo de pedido para animal — **continua pendente** e pertence ao módulo de Pedidos. Esta feature não a quita, não a altera e a confirma como aberta nos critérios de regressão.
