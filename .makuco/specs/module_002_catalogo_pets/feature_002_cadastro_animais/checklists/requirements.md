# Makuco Specification Quality Checklist: FEATURE-002 — Cadastro de Animais (área administrativa)

**Purpose**: Avaliar a qualidade da spec `spec_context.md` antes da sua aprovação, verificando completude, testabilidade, ausência de ambiguidade e delimitação de escopo.
**Created**: 2026-08-25
**Feature**: [spec_context.md](../spec_context.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — **aprovado com adaptação registrada**, ver Nota 1
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — Grupos 1 a 3, até "Requisitos Funcionais", são integralmente em linguagem de negócio
- [x] All mandatory sections completed — exceto o Grupo 5, que o próprio template manda preencher após a revisão de escopo

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — nenhum marcador presente; as lacunas foram fechadas por decisão registrada no changelog, não por marcador aberto
- [x] Requirements are testable and unambiguous — ver Nota 2 (uma falha corrigida na iteração 1)
- [x] Success criteria are measurable — as sete métricas do "Critério de Sucesso da Feature" têm baseline, meta e forma de medição
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined — 9 histórias de usuário, todas com cenários no formato Dado/Quando/Então
- [x] Edge cases are identified — 99 casos de teste, dos quais 33 classificados como Borda
- [x] Scope is clearly bounded — seção "O que Não Deve Ser Feito", com bloco próprio de escopo diferido e condição de entrada de cada item
- [x] Dependencies and assumptions identified — 6 dependências com status e impacto; 11 premissas

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — 65 regras de negócio, 47 critérios de aceite e 99 casos de teste; ver Nota 3 (duas falhas corrigidas na iteração 1)
- [x] User scenarios cover primary flows — acessar, listar, cadastrar, localizar, enviar imagens, editar, alterar status, excluir e integridade com espécie
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — ver Nota 1

## Notes

**Nota 1 — Sobre "no implementation details".**
Este item é aprovado **com adaptação deliberada e registrada**, e não por complacência. O padrão de spec deste projeto, estabelecido pela spec de autenticação e confirmado pela FEATURE-001 deste módulo, inclui explicitamente contrato de API e modelo de dados dentro da spec. O contrato desta feature exigiu nominalmente "contrato de API completo, modelo Prisma". O conteúdo técnico está **confinado** às seções designadas — "Decisões de Arquitetura", "Contrato de API", "Modelo de Dados" e "Impacto Técnico Transversal" — e os Grupos 1 a 3, até "Requisitos Funcionais", permanecem legíveis por quem não é desenvolvedor.
Fornecedores são nomeados (Supabase, IBGE) porque a feature exigia decidir e justificar a origem dos dados de localidade e o destino das imagens; omitir os nomes tornaria as decisões inverificáveis.

**Nota 2 — Falha detectada e corrigida na iteração 1: caso de teste ambíguo.**
O CT-49 original misturava, em uma única linha, duas aritméticas contraditórias do limite de imagens ("5 − 2 + 3 = 6 é recusado; 5 − 3 + 3 = 5 é aceito"), tornando o resultado esperado impossível de interpretar. A mesma aritmética errada aparecia na RN-50 e no cenário 13 da HU-05, que afirmavam ser aceito remover duas de cinco imagens e acrescentar três — o que resultaria em seis, acima do limite.
**Correção aplicada:** o CT-49 foi dividido em CT-49a (estado final de 6, recusado) e CT-49b (estado final de 5, aceito); a RN-50 e o cenário 13 da HU-05 foram reescritos com a aritmética correta.

**Nota 3 — Falha detectada e corrigida na iteração 1: duas regras sem critério de aceite.**
A RN-60 (indicador de pendência de foto em animais Disponíveis sem imagem) e a RN-56 (cidade gravada que deixou de constar na lista ativa permanece exibida) possuíam caso de teste, mas nenhum critério de aceite correspondente, ficando fora da lista de verificação de conclusão da feature.
**Correção aplicada:** acrescentados o CA-46 e o CA-47.

**Nota 4 — Sobre a citação de identificadores de regra nos casos de teste.**
Os casos de teste citam o identificador da regra apenas quando a rastreabilidade é crítica — integridade com espécie, limites de imagem, concorrência e idade derivada. Nos demais, a cobertura é por conteúdo, seguindo a convenção já adotada pela FEATURE-001 deste módulo. Uma verificação por conteúdo confirmou que todas as 65 regras possuem ao menos um caso de teste ou critério de aceite correspondente.

**Nota 5 — Pendência que esta spec herda e quita.**
A FEATURE-001 deste módulo entregou a sua regra mais importante — não excluir espécie com animais vinculados — verificável apenas por duplo de teste, porque a entidade Animal não existia. Esta spec trata a reexecução daqueles casos contra dados reais como **entrega obrigatória**, e não como regressão opcional: CT-81 a CT-85, CA-37, CA-38, QA-28 a QA-31 e o primeiro item da seção de regressão.

**Nota 6 — Pendência equivalente registrada preventivamente.**
A mesma situação se repetirá com o módulo de pedidos, cuja regra de integridade com animal nascerá não exercitável com dados reais. A RN-17b e o último item da seção de regressão registram a dívida **antes** de ela ser contraída.

**Resultado da validação:** aprovado na iteração 1, após a correção de três defeitos (um caso de teste ambíguo, duas regras sem critério de aceite). Nenhum item permanece reprovado.
