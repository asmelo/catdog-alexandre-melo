# Glossário do Projeto

> **Como preencher:** liste os termos do negócio em ordem alfabética. Use linguagem consistente com o produto. Evite termos técnicos internos sem definição clara.
> **Caminho:** `02-systems/{sistema}/context/glossary.md`

---

## Termos do Domínio

| Termo | Tradução livre / Sinônimo | Definição | Evitar |
|---|---|---|---|
| Adaptação | Fase de adaptação | Período em que o cliente já está com o pet e o sistema registra o acompanhamento da adaptação. No CatDog, essa fase dura cerca de 3 meses. | Tratá-la como uma etapa automática do sistema ou como processo sem acompanhamento |
| Administrador | Responsável interno | Pessoa que cadastra pets, visualiza pedidos e atualiza o andamento do processo no painel. | Usuário genérico, operador sem função definida |
| Avaliação do espaço físico | Verificação do ambiente | Etapa em que o ambiente do cliente é avaliado para verificar se está adequado ao pet. | Inspeção técnica automatizada ou validação sem participação humana |
| Cliente | Interessado | Pessoa que navega pelo catálogo, aplica filtros e registra um pedido de interesse em um ou mais pets. | Visitante, lead, usuário anônimo |
| Chip | Identificação interna do pet | Número de identificação do animal usado para controle operacional interno. Não é exibido na vitrine pública. | Código público, dado de exibição, etiqueta comercial |
| Concluído | Finalizado | Status final do pedido, indicando que o processo foi encerrado no sistema. | Cancelado, arquivado, pendente |
| Entrevista | Entrevista | Etapa em que o administrador aprofunda a avaliação do cliente e do interesse demonstrado no pet. | Conversa informal sem registro, etapa automática |
| Filtro | Refinamento de busca | Recurso usado pelo cliente para localizar pets conforme sua preferência. | Busca técnica, consulta interna |
| Pedido | Solicitação de interesse | Registro do interesse do cliente em um ou mais pets, com os dados necessários para o acompanhamento no sistema. | Mensagem solta, contato informal, conversa no WhatsApp |
| Pet | Animal disponível | Animal cadastrado no sistema e disponível para divulgação no catálogo e recebimento de pedidos. | Produto, item, anúncio genérico |
| Proprietário | Responsável pelo pet | Pessoa responsável pelo pet, com contato registrado apenas para uso interno da operação. | Tutor, dono, cliente |
| Vitrine | Catálogo público | Área pública da plataforma onde os pets aparecem para o cliente com as informações principais de visualização. | Painel interno, inventário, área administrativa |

---

## Status e Ciclos de Vida

### Pedido

| Status | Descrição | Transições permitidas |
|---|---|---|
| Contato Inicial | Primeira etapa do fluxo do pedido após o registro da solicitação. | Pode avançar para Entrevista |
| Entrevista | Etapa de aprofundamento da avaliação do cliente e do interesse no pet. | Pode avançar para Avaliação do espaço físico |
| Avaliação do espaço físico | Etapa de verificação do ambiente do cliente antes da continuidade do processo. | Pode avançar para Adaptação |
| Adaptação | Etapa em que o cliente já está com o pet e o período de adaptação é acompanhado. Dura cerca de 3 meses. | Pode avançar para Concluído |
| Concluído | Status final do pedido. O processo foi encerrado no sistema. | Não possui transições seguintes |

---

## Relações Entre Termos

- Um **Cliente** registra um **Pedido** para um ou mais **Pets**.
- O **Administrador** acompanha e atualiza o status de cada **Pedido**.
- A **Vitrine** exibe apenas os dados públicos do **Pet**.
- O **Chip** e o contato do **Proprietário** são dados internos do **Pet**.
- O **Pedido** percorre os status **Contato Inicial**, **Entrevista**, **Avaliação do espaço físico**, **Adaptação** e **Concluído**.
- A etapa de **Adaptação** indica que o cliente já está com o pet e o período de acompanhamento está em andamento.

---

## Siglas e Abreviações

| Sigla / Abreviação | Significado | Observação |
|---|---|---|
| Não há siglas definidas para o projeto | — | A operação evita o uso de siglas e a comunicação deve priorizar termos completos |

---

## Histórico de Alterações

| Versão | Data | Alteração | Responsável |
|---|---|---|---|
| 1.0 | 2026-05-22 | Criação inicial do glossário do CatDog com termos do domínio, status do pedido e relações entre conceitos | Assistente Makuco |
