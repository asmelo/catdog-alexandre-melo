# Detalhamento do Escopo Macro do Projeto

> **Como preencher:** descreva a visão geral do produto, liste os módulos na ordem em que serão entregues e detalhe as features de cada um. Para cada feature, escreva pelo menos 3 linhas — o que faz, para quem serve e qual valor entrega.
> **Caminho:** `02-systems/{sistema}/product/scope-features.md`
> **Próximo passo:** com este documento aprovado, cada feature vira uma spec em `specs/{modulo}/{feature}.md` gerada pelo `makuco-specify`.

---

## Visão Geral do Produto

CatDog é uma plataforma para divulgar pets disponíveis e organizar pedidos de interesse em um fluxo único, substituindo o controle disperso feito por mensagens. O produto centraliza o catálogo dos animais, permite que o cliente encontre pets conforme sua preferência e entrega ao administrador um painel para acompanhar cada pedido por etapas. O estado desejado é uma operação mais clara, visual e confiável, com menos perda de informação e mais agilidade no acompanhamento comercial.

---

## Roadmap

> Liste os módulos na sequência em que serão entregues. Preencha após definir os módulos abaixo — serve para alinhar o time e stakeholders em uma leitura rápida.

| Ordem | Módulo | O que entrega ao negócio |
|---|---|---|
| 1 | Catálogo de pets | Organiza a vitrine dos pets e torna a divulgação mais clara para o cliente |
| 2 | Pedido do cliente | Estrutura a solicitação de interesse e concentra os dados necessários para atendimento |
| 3 | Gestão de pedidos no painel administrativo | Dá ao administrador controle sobre os pedidos e o avanço das etapas do processo |
| 4 | Acompanhamento de status da compra | Permite registrar a evolução do atendimento até a finalização do pedido |

---

## Módulos e Features

---

### Módulo: Catálogo de pets

Este módulo concentra a vitrine pública dos animais disponíveis para consulta. Ele é usado principalmente pelo cliente, que precisa visualizar rapidamente os pets e filtrar opções de acordo com sua preferência, e pelo administrador, que mantém os cadastros atualizados. O valor entregue é uma exposição mais organizada, bonita e fácil de consumir do que a comunicação solta por mensagens.

#### Feature: Cadastro de pets com dados internos e de vitrine

Permite ao administrador cadastrar cada pet com informações de exibição e dados internos de controle. Na vitrine, o cliente vê raça, foto, idade e sexo, enquanto o sistema também guarda dados internos como contato do proprietário e número do chip.
Esses dados internos não fazem parte da experiência principal do cliente, mas são importantes para a operação e para o controle do animal. A feature precisa separar claramente o que é público do que é restrito à gestão interna.

#### Feature: Listagem pública dos pets disponíveis

Exibe os pets cadastrados em formato de catálogo para navegação pelo cliente. A listagem deve privilegiar uma leitura rápida e objetiva, facilitando a comparação entre os animais disponíveis.
É uma feature voltada ao cliente final, mas também serve como vitrine comercial do negócio. Seu valor está em tornar os pets mais fáceis de descobrir e apresentar a oferta de forma profissional.

#### Feature: Filtragem de pets por preferência

Permite que o cliente encontre pets com base em critérios de interesse, reduzindo o esforço de navegação. A filtragem deve apoiar a busca por perfil desejado sem exigir conhecimento prévio do catálogo completo.
Essa funcionalidade é essencial para transformar a vitrine em uma experiência útil, porque ajuda o cliente a chegar mais rápido nos pets que fazem sentido para seu interesse. Também reduz o volume de solicitações genéricas para o administrador.

---

### Módulo: Pedido do cliente

Este módulo organiza o envio de interesse do cliente a partir do catálogo. Ele coleta as informações necessárias para que o administrador consiga dar continuidade ao atendimento sem depender de conversas perdidas em outros canais. O valor entregue é transformar intenção em pedido estruturado, com rastreabilidade mínima para acompanhamento posterior.

#### Feature: Criação de pedido com um ou mais pets

Permite ao cliente enviar um pedido contendo um ou mais pets de interesse. O pedido deve registrar o nome do cliente, telefone para contato e endereço, além da relação com os pets selecionados.
Essa feature serve para consolidar o interesse do cliente em um registro único, facilitando o atendimento pelo administrador. O fato de aceitar mais de um pet no mesmo pedido atende cenários em que o cliente tenha mais de uma opção em aberto.

#### Feature: Captura de dados de contato e endereço

Coleta os dados necessários para que o administrador possa retomar o contato e conduzir o processo fora da aplicação. As informações mínimas informadas são nome, telefone e endereço do cliente.
Esses dados são importantes porque o fluxo comercial não termina dentro do sistema; ele continua fora dele, com contato direto entre as partes. A feature dá suporte ao acompanhamento operacional sem obrigar o cliente a repetir informações em múltiplas conversas.

---

### Módulo: Gestão de pedidos no painel administrativo

Este módulo oferece ao administrador uma visão centralizada dos pedidos recebidos e permite acompanhar cada solicitação em detalhes. Ele resolve a dor de perder informações em conversas paralelas e dá ao negócio um ponto único para controlar o andamento comercial. O valor é mais organização, menos retrabalho e mais segurança para a operação.

#### Feature: Visualização da lista de pedidos

Apresenta ao administrador todos os pedidos recebidos em uma lista de consulta rápida. A lista deve permitir identificar quais solicitações estão abertas e quais já avançaram no processo.
Essa feature serve como ponto de entrada da operação diária do administrador, reduzindo a necessidade de procurar informações em outras ferramentas. Ela é a base para priorização e acompanhamento do atendimento.

#### Feature: Detalhamento de um pedido

Permite abrir um pedido específico e ver seus dados completos, incluindo os pets associados e as informações do cliente. O administrador precisa enxergar o contexto do pedido sem depender de anotações externas.
A feature serve para apoiar a tomada de ação durante o atendimento e dar clareza sobre o histórico da solicitação. Seu valor está em concentrar em uma tela o que antes ficava espalhado em mensagens.

#### Feature: Atualização de status do pedido

Permite ao administrador marcar a etapa atual do pedido conforme o processo avança. As etapas definidas são: Contato Inicial, Entrevista, Avaliação do espaço físico, Adaptação e Concluído.
Essa feature reflete o andamento real do processo comercial e operacional, sem automatizar a logística em si. Ela é importante para que o administrador saiba exatamente em que fase cada pedido está e para que a operação fique rastreável.

#### Feature: Finalização do pedido

Registra quando o processo de compra foi concluído e o pedido pode ser encerrado. A finalização deve indicar que as etapas anteriores foram cumpridas e que o ciclo daquele pedido terminou.
Essa feature serve para fechar o fluxo no sistema e evitar que pedidos concluídos continuem aparecendo como ativos. Ela ajuda a manter o painel limpo e confiável para acompanhamento dos casos em andamento.

---

### Módulo: Acompanhamento de status da compra

Este módulo consolida a progressão do pedido ao longo do processo definido pelo negócio. Ele é usado pelo administrador para registrar fases relevantes da negociação e evitar que o andamento dependa apenas de memória ou mensagens externas. O valor é dar transparência e controle sobre o ciclo da compra até sua conclusão.

#### Feature: Fluxo de etapas do processo

Estrutura o pedido em etapas sequenciais que representam o avanço real do atendimento. As fases são: Contato Inicial, Entrevista, Avaliação do espaço físico, Adaptação e Concluído.
A feature serve para alinhar a operação ao fluxo real do negócio, permitindo que o administrador registre cada marco no momento adequado. Isso reduz ambiguidades sobre o estágio de cada pedido e ajuda a manter consistência operacional.

#### Feature: Registro manual de avanço entre etapas

Permite que o administrador atualize o pedido manualmente sempre que uma fase for concluída fora do sistema. O produto não automatiza a negociação; apenas registra o progresso informado pela equipe.
Essa abordagem é importante porque a maior parte da operação acontece fora da aplicação. O valor da feature está em transformar um processo informal em um acompanhamento rastreável dentro da plataforma.

---

## Fora do Escopo

> Liste o que foi explicitamente excluído. Registrar o que não será feito evita discussões recorrentes e alinhamentos tardios.

| Item excluído | Motivo |
|---|---|
| Automatizar toda a negociação e logística da compra dentro do sistema | O fluxo operacional continuará acontecendo fora da aplicação, com o sistema apenas acompanhando as etapas |
| Substituir o contato humano com o cliente | O atendimento e a negociação continuam dependendo do administrador |
| Tornar os dados internos dos pets visíveis publicamente | Campos como contato do proprietário e número do chip são informações de gestão interna |
