# Objetivo do Projeto

> **Como preencher:** substitua os blocos em _itálico_ pelo conteúdo real. Remova as instruções após preencher. Seja direto — evite textos genéricos.
> **Caminho:** `02-systems/{sistema}/context/project-goal.md`

---

## Identificação do Sistema

**Nome do sistema:** CatDog

**Status:** Draft

**Repositório de código:** Não informado

**Última atualização:** 2026-05-22 — Assistente Makuco

### Ambientes

| Ambiente | URL |
|---|---|
| Desenvolvimento | Não informado |
| Homologação | Não informado |
| Produção | Não informado |

---

## Problema a Ser Resolvido

> Descreva o problema atual de forma clara e objetiva. Responda: o que está errado ou faltando hoje? Qual é a causa raiz? Quem sofre com isso? Evite soluções aqui — foque apenas no problema.

**Situação atual:** A divulgação dos pets e o acompanhamento dos pedidos acontecem hoje principalmente pelo WhatsApp. Isso dificulta mostrar os animais de forma organizada para os clientes e torna o acompanhamento dos pedidos confuso para o administrador, que precisa lidar com muitas conversas paralelas e pode perder o controle do andamento de cada solicitação.

**Causa raiz:** O processo depende de comunicação não estruturada em conversas de WhatsApp, sem catálogo centralizado de pets, sem organização dos pedidos em um painel único e sem um fluxo claro para acompanhar as etapas da compra.

**Impacto:** Clientes têm dificuldade para encontrar e comparar os pets disponíveis. O administrador perde tempo organizando informações espalhadas em mensagens, corre o risco de esquecer pedidos e não consegue acompanhar de forma confiável em que etapa cada compra está.

---

## Objetivo do Projeto

> Use linguagem mensurável quando possível: "reduzir X em Y%", "eliminar etapa Z", "permitir que o usuário faça W". Evite objetivos vagos como "melhorar a experiência".

**Onde devemos chegar com o projeto entregue:** A plataforma deve permitir divulgar os pets de forma organizada, receber pedidos em um fluxo único e dar ao administrador uma visão clara do andamento de cada solicitação, com uma experiência simples, bonita e fácil de usar.

- Centralizar o catálogo de pets em uma interface própria para divulgação ao cliente.
- Permitir que o cliente filtre os pets disponíveis e envie pedidos sem depender de conversas soltas no WhatsApp.
- Oferecer ao administrador um painel simples para visualizar pedidos, acessar dados de contato e marcar manualmente as etapas concluídas do processo de compra.
- Reduzir a confusão operacional causada pelo atendimento espalhado em múltiplas conversas.

---

## Visão Geral do Sistema

### Propósito

> Para que serve este sistema? Qual problema ele resolve? Descreva de forma que qualquer pessoa — ou agente de IA — entenda o sistema sem contexto prévio.

CatDog é uma plataforma de adoção/venda de pets que centraliza a divulgação dos animais disponíveis e organiza os pedidos feitos pelos clientes. O sistema substitui o controle manual feito em conversas de WhatsApp por um catálogo navegável e um painel administrativo para acompanhamento do processo. A proposta é facilitar a vitrine dos pets para o cliente e dar mais controle operacional ao administrador. O sistema não executa a logística da compra dentro da aplicação; ele acompanha o status das etapas à medida que elas são concluídas fora dela.

### Público-Alvo e Usuários

**Perfil 1 — Cliente/Interessado no pet**
Descrição: pessoa que navega pelos pets disponíveis e demonstra interesse em um animal.
_O que faz e quando faz: acessa o catálogo, filtra os pets conforme sua preferência e envia um pedido de interesse/compra._

**Perfil 2 — Administrador da loja**
Descrição: responsável por cadastrar os pets, receber pedidos e acompanhar o andamento de cada solicitação.
_O que faz e quando faz: cadastra e atualiza os pets, visualiza pedidos recebidos, consulta os dados de contato do cliente e marca as etapas do processo como concluídas._

**Perfil 3 — Responsável pelo atendimento comercial/operacional**
Descrição: pessoa que pode atuar junto ao administrador na gestão dos pedidos e no acompanhamento do relacionamento com o cliente.
_O que faz e quando faz: acompanha solicitações, apoia o contato com o cliente e atualiza o status operacional quando necessário._

### Contexto de Mercado e Posicionamento

**Contexto de mercado:** O sistema atua no segmento de pet shop/criadores/lojas que comercializam ou divulgam pets e precisam organizar a exposição dos animais e o atendimento aos interessados.

**Posicionamento:** A plataforma se posiciona como uma solução simples e amigável para apresentar os pets em formato de catálogo e organizar os pedidos em um painel administrativo, reduzindo a dependência de atendimento desestruturado por mensagens.

**Público-alvo de mercado:** Lojas de pets, criadores, canis, gatis ou negócios semelhantes que precisam divulgar animais e gerir pedidos de clientes com pouca complexidade operacional.

### Contexto de Uso pelo Cliente

O cliente usa o sistema como canal principal para visualizar os pets disponíveis e iniciar um pedido de interesse. No dia a dia, o administrador cadastra os animais na plataforma, o cliente navega pelos itens filtrando conforme sua preferência e realiza o pedido. Depois disso, o administrador acompanha o pedido no painel interno, acessa as informações de contato do cliente e marca no sistema as etapas concluídas do processo de compra. A logística da negociação e da entrega acontece fora da aplicação, enquanto o sistema serve como ponto central de divulgação e controle de status.

---

## Contexto de Negócio

**Sobre o negócio:** O projeto atende um negócio do setor pet que precisa organizar a vitrine de animais disponíveis e estruturar o acompanhamento de pedidos para evitar perda de informação e desorganização no atendimento.

**Domínio e segmento:** Varejo/serviços do mercado pet, com foco em divulgação de pets e gestão do fluxo comercial de interesse, pedido e finalização da compra.

**Processo atual (como as pessoas fazem hoje):** O administrador divulga os pets e conversa com clientes por WhatsApp. Os interessados pedem informações por mensagens, o atendimento acontece em múltiplas conversas paralelas e o acompanhamento de pedidos é feito de forma manual e descentralizada.

**Restrições e regras de negócio relevantes:** A logística da compra é tratada fora da aplicação; no sistema, o administrador apenas registra o andamento das etapas concluídas. O cliente navega apenas pelos pets disponíveis. O pedido deve ficar vinculado a um pet e a um contato de cliente para permitir acompanhamento posterior. O fluxo de etapas do pedido precisa refletir o progresso real da negociação até a finalização.

---

## Escopo Macro do Projeto

> Liste os grandes blocos de entrega: módulos, epics ou grandes funcionalidades. Apenas títulos — o detalhamento fica em `product/scope-features.md`. Ordene por prioridade ou sequência de entrega.

| # | Módulo / Epic | Prioridade |
|---|---|---|
| 1 | Catálogo de pets | Alta |
| 2 | Busca e filtros de pets | Alta |
| 3 | Solicitação de interesse/pedido do cliente | Alta |
| 4 | Painel administrativo de pedidos e acompanhamento de etapas | Alta |

---

## Escopo Negativo do Projeto

> Liste explicitamente o que este projeto NÃO vai fazer. Isso é tão importante quanto o escopo positivo — evita retrabalho e alinhamentos tardios.

| O que não será feito | Motivo |
|---|---|
| Gerenciar toda a logística da compra dentro do sistema | O processo operacional acontece fora da aplicação; o sistema apenas acompanha o status das etapas |
| Substituir o atendimento humano por automação completa | O administrador ainda precisa acessar contatos e conduzir o relacionamento com o cliente |
| Fazer o pedido via WhatsApp como canal principal | O objetivo é centralizar o processo na plataforma, não manter o fluxo desestruturado atual |

---

## Pessoas e Interesses (Stakeholders)

> Liste todas as pessoas com papel relevante no projeto — quem decide, quem aprova, quem usa e quem é afetado.

| Nome | Empresa / Área | Papel no Projeto |
|---|---|---|
| Alexandre Melo | Produto / Negócio | Responsável pelo projeto |
| Administrador da loja | Operação | Usuário principal do painel administrativo |
| Cliente interessado no pet | Cliente final | Usuário que navega no catálogo e envia pedidos |

---

> **Próximo passo:** com este documento preenchido e revisado, acione o `makuco-specify` referenciando este arquivo para gerar as specs de cada módulo listado no Escopo Macro.