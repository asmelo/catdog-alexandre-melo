# Gestão do Projeto e Ciclo de Desenvolvimento

> **Como preencher:** registre aqui como o projeto é gerenciado — onde o trabalho vive, como está organizado e como o time opera no dia a dia. Qualquer pessoa que entre no projeto deve conseguir entender o fluxo de trabalho lendo este documento.
> **Caminho:** `02-systems/{sistema}/management/project-management.md`

---

## Plataforma de Gestão

**Plataforma:** Não definida / Não aplicável
**URL / Acesso:** Não aplicável
**Como solicitar acesso:** Não aplicável, pois o projeto não utiliza ferramenta formal de gestão

---

## Modelo de Organização do Trabalho

> Defina o significado de cada nível da hierarquia de trabalho neste projeto. Sem essa definição, cada pessoa interpreta os conceitos de forma diferente.

| Nível | Nome utilizado | O que representa | Exemplo |
|---|---|---|---|
| 1 — mais alto | Entrega | Macroetapa do projeto que agrupa uma parte relevante da construção do sistema | Infraestrutura definida |
| 2 | Fase | Conjunto de atividades relacionadas dentro de uma entrega | Implementação do backend |
| 3 | Atividade | Trabalho executável dentro de uma fase | Criar rotas de pedidos |
| 4 — mais baixo | Tarefa técnica | Passo pontual necessário para concluir uma atividade | Configurar conexão com Supabase |

---

## Tamanho e Critérios de um PBI

> O tamanho máximo de um PBI define o ritmo de entrega e a capacidade de revisão do time. Estabeleça limites claros para evitar PBIs que duram semanas.

**Tamanho máximo:** Como não há método formal de gestão, o trabalho deve ser quebrado em tarefas pequenas o suficiente para serem concluídas com clareza e sem depender de longos ciclos de acompanhamento.

**Um bom PBI deve:**
- Ter objetivo único e facilmente compreensível
- Poder ser concluído e validado sem depender de uma entrega maior inteira
- Entregar valor visível ou reduzir risco técnico de forma clara
- Ser simples o bastante para ser desenvolvido sem cerimônia formal de refinamento

**Um PBI deve ser quebrado quando:**
- Abranger mais de uma responsabilidade principal
- Exigir mudanças grandes demais para validar de uma vez
- Ficar difícil de entender ou testar como uma entrega isolada
- Misturar front-end, back-end e banco em um único item sem necessidade

---

## Modelo de Desenvolvimento

**Metodologia:** Não definida formalmente

**Duração do ciclo:** Fluxo contínuo, sem sprints fixas

**Início do ciclo:** Não aplicável

---

## Cerimônias e Rituais

> Liste apenas as cerimônias que este time realmente pratica. Remova as que não se aplicam.

| Cerimônia | Frequência | Duração | Objetivo |
|---|---|---|---|
| Não há cerimônias formais | — | — | O projeto será conduzido de forma simples, sem ritual de gestão estruturado |

---

## Fluxo de Status

> Defina os status que um item percorre desde a criação até a entrega. Mapeie exatamente como está configurado na plataforma de gestão.

| Status | Descrição | Quem move para cá |
|---|---|---|
| Planejado | Entrega ou atividade identificada para ser executada | Alexandre Simões de Melo |
| Em execução | Trabalho em andamento | Alexandre Simões de Melo |
| Concluído | Entrega finalizada e validada no contexto do projeto | Alexandre Simões de Melo |

---

## Definição de Pronto (Definition of Done)

> Um item só pode ser marcado como Done quando todos os critérios abaixo forem atendidos. Esta lista é do time — ajuste conforme a realidade do projeto.

- A funcionalidade foi implementada sem pendências conhecidas
- O fluxo principal foi testado manualmente e funciona no cenário previsto
- Os dados são persistidos corretamente quando aplicável
- A interface ou comportamento esperado está acessível para uso real
- Não há quebra de navegação entre vitrine e painel administrativo, quando aplicável

---

## Acompanhamento e Monitoramento

**Responsável pelo acompanhamento:** Alexandre Simões de Melo

**Métricas acompanhadas:**

| Métrica | O que mede | Onde é acompanhada | Frequência |
|---|---|---|---|
| Entregas concluídas | Quantidade de fases do projeto já finalizadas | No próprio contexto do projeto e no código | Conforme avanço do desenvolvimento |
| Pendências abertas | Itens que ainda precisam ser implementados ou ajustados | No acompanhamento manual do responsável | Conforme necessidade |
| Fluxo funcional | Se a vitrine, o login e o painel seguem operando como esperado | Validação manual durante o desenvolvimento | Sempre que uma etapa é concluída |

**Reporte para stakeholders:** Não há rotina formal de reporte. O acompanhamento será feito diretamente pelo responsável pelo projeto, sem cerimônias, cadência fixa ou ferramenta específica de gestão.
