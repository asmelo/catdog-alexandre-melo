# Makuco Specification Quality Checklist: Cadastro de Espécies (área administrativa)

**Purpose**: Verificar se a especificação da FEATURE-001 do MODULE-002 atende aos critérios de qualidade de conteúdo, completude de requisitos e prontidão para implementação.
**Created**: 2026-08-25
**Feature**: [spec_context.md](../spec_context.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — **aprovado com ressalva declarada**, ver Notas
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — **vale para os Grupos 1 a 3**, ver Notas
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

## Notes

### Ressalva sobre os dois itens de "implementation details"

As seções **Contrato de API** e **Modelo de Dados** contêm, deliberadamente, detalhe de implementação — endpoints, códigos de status, códigos de erro e o modelo Prisma. Elas foram **exigidas explicitamente no contrato de criação desta spec**, que pediu o mesmo nível de rigor da FEATURE-002 acrescido de contrato de API, modelo de dados e cenários de QA. Os itens são marcados como aprovados porque:

- os Grupos 1 a 3 (Identificação, Contexto e Comportamento) permanecem inteiramente em linguagem de negócio e são legíveis por stakeholder não técnico;
- nenhuma regra de negócio depende de leitura das seções técnicas — cada RN é autossuficiente e as seções técnicas apenas materializam o que as RN já determinam;
- o detalhe técnico está confinado a duas seções nomeadas, e não espalhado pelo documento.

Se a spec for apresentada a público não técnico, as duas seções podem ser omitidas sem perda de compreensão do comportamento.

### Decisões tomadas sem consulta ao responsável do produto

A execução autônoma foi autorizada no contrato de criação. Nove decisões foram tomadas e estão registradas em ALT-001 do changelog, com justificativa individual: caminho da tela em PT-BR, caminho da API em inglês, verbo `PATCH`, reorganização da navegação administrativa, sensibilidade a acentos na unicidade, coluna normalizada persistida, ausência de limitador de taxa, envelope de coleção e proteção da exclusão em duas camadas.

### Ponto de atenção que sobrevive à aprovação desta spec

A RN-08 — bloqueio da exclusão de espécie com animais vinculados — é a regra mais importante do documento e **não pode ser verificada contra dados reais enquanto a entidade Animal não existir**. A spec trata isso explicitamente na subseção "Como a RN-08 é verificada antes de a entidade Animal existir" e transforma a verificação pendente em item de regressão vinculado à feature seguinte. Enquanto essa reexecução não acontecer, a regra está coberta apenas por duplo de teste. Este é o principal risco residual da feature e deve ser acompanhado na entrega do Cadastro de pets.

### Divergências entre a captura de tela e o sistema implementado

A captura usada como fonte da verdade diverge do estado atual em quatro pontos (arranjo da navegação, itens da navegação, destino de `/admin` e idioma do caminho da tela). Todos estão tabelados na spec e registrados no changelog. A divergência de maior impacto é o destino de `/admin`, porque ele é o alvo do redirecionamento por role da FEATURE-002 — por isso há critério de aceite próprio (CA-01b), caso de teste próprio (CT-39) e item de regressão dedicado.

### Escopo explicitamente excluído

Dez exclusões estão listadas na seção "O que Não Deve Ser Feito", entre elas: cadastro de animais, listagem pública de espécies, inativação/lixeira, migração de animais antes da exclusão, atributos além do nome, busca/filtro/paginação, importação em lote e auditoria de alterações.
