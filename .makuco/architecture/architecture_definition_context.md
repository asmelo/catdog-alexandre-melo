# Definição de Arquitetura

> **Como preencher:** registre aqui o padrão arquitetural adotado para este sistema e a justificativa da escolha. Seja direto — o objetivo é que qualquer pessoa do time entenda como o sistema está estruturado e por que.
> **Caminho:** `02-systems/{sistema}/architecture/architecture-definition.md`
> **Divergências dos padrões organizacionais** devem ser registradas como ADR em `architecture/adr/`.

---

## Padrão Arquitetural Adotado

**Padrão:** Monólito em camadas

**Justificativa:** O CatDog será um sistema único, com front-end e back-end no mesmo projeto, para atender uma única empresa com baixa complexidade operacional. O domínio é enxuto, com cadastro de pets, vitrine pública, login administrativo e gestão de pedidos, o que torna desnecessária a divisão em múltiplos serviços. O monólito em camadas facilita a implementação, reduz custo de manutenção e acelera a entrega inicial.

---

## Como o Sistema está Organizado

O sistema será organizado como uma aplicação web única, com front-end e back-end no mesmo repositório e no mesmo projeto de entrega. A interface pública exibirá a vitrine dos pets, e a área administrativa ficará protegida por autenticação com usuário e senha fixos para o único administrador da empresa. O back-end concentrará as regras de negócio, o gerenciamento dos pedidos, a autenticação e a persistência dos dados no Supabase. O front-end consumirá essas regras e dados dentro da própria aplicação, com navegação entre vitrine e painel administrativo por links internos.

---

## Decisões Arquiteturais Importantes

| Decisão | O que foi decidido | Justificativa |
|---|---|---|
| Tipo de aplicação | Aplicação web | O produto precisa ser acessado por clientes e administrador via navegador, com vitrine pública e área administrativa |
| Estrutura do código | Front-end e back-end juntos em um único projeto | Simplifica a implementação e a manutenção para um sistema pequeno e de uso restrito |
| Autenticação administrativa | Login fixo com usuário e senha únicos para o administrador | A empresa possui apenas um administrador e não há necessidade inicial de gestão complexa de usuários |
| Banco de dados | Supabase | Banco relacional adequado para armazenar pets, pedidos, etapas do fluxo e dados de contato com consistência |
| Acesso entre áreas | Links para ir e voltar entre vitrine e painel administrativo | Facilita a navegação entre as duas partes principais do produto sem depender de fluxos complexos |

---

## Diagramas

**C1 — Contexto:** _`architecture/diagrams/c4/c1-context.png` — visão do sistema no ecossistema_
**C2 — Containers:** _`architecture/diagrams/c4/c2-containers.png` — principais blocos e tecnologias_
**C3 — Componentes:** _`architecture/diagrams/c4/c3-components.png` — organização interna_

---

> **Lembrete:** este documento descreve a intenção arquitetural. Quando houver divergência entre o que está aqui e o que está no código, o código deve ser corrigido — ou este documento deve ser atualizado com um ADR justificando a mudança.
