# Restrições e Decisões Técnicas

> **Como preencher:** registre aqui o que não deve ser usado neste projeto e por quê. Restrições sem justificativa são ignoradas — registre o motivo com clareza.
> **Caminho:** `02-systems/{sistema}/architecture/tech-restrictions.md`
> **Importante:** restrições que exigem mais contexto ou que divergem dos padrões organizacionais devem virar um ADR em `architecture/adr/`.

---

## Tecnologias Proibidas

> Liste tecnologias, bibliotecas, frameworks ou abordagens que não devem ser usados neste projeto, independentemente do contexto.

| O que não usar | Motivo | Alternativa recomendada |
|---|---|---|
| Microserviços | Aumentam bastante a complexidade de implementação, deploy e manutenção para um sistema pequeno e de pouco uso | Monólito em camadas em um único projeto |
| Mensageria assíncrona | Não há necessidade de fila/eventos para o fluxo atual de pets e pedidos | Processamento síncrono no back-end |
| Banco NoSQL | O domínio é relacional, com pets, pedidos, etapas e contatos, o que combina melhor com modelagem relacional | Supabase |
| Biblioteca paga de UI ou serviços pagos obrigatórios | O objetivo é manter o projeto simples, barato e fácil de reproduzir | Ferramentas e bibliotecas gratuitas |

---

## Restrições de Ambiente

> Limitações impostas pelo ambiente do cliente, infraestrutura existente ou políticas da organização.

| Restrição | Descrição | Impacto no projeto |
|---|---|---|
| Apenas um administrador | A empresa tem um único usuário administrativo fixo, sem gestão de múltiplos perfis | A autenticação pode ser simples, sem cadastro de usuários ou hierarquias de acesso |
| Pouco volume de uso | O sistema é de uso restrito e não precisa suportar grandes picos de tráfego | Não há necessidade de escalabilidade avançada, cache dedicado ou orquestração complexa |
| Implantação simples | O time quer facilidade de implementação e operação | A arquitetura deve evitar componentes desnecessários e priorizar um deploy direto |

---

## Restrições de Segurança e Compliance

> Requisitos obrigatórios de segurança, privacidade ou regulação que condicionam as decisões técnicas.

| Requisito | Descrição | Como é atendido |
|---|---|---|
| Proteção do acesso administrativo | Apenas o administrador deve acessar o painel interno | Login obrigatório para a área administrativa, com sessão protegida |
| Dados de contato do cliente | Telefone e endereço são dados sensíveis no contexto operacional | Exibir essas informações somente no painel administrativo |
| Controle de dados internos do pet | Contato do proprietário e número do chip não devem ser públicos | Separação entre dados de vitrine e dados internos no cadastro |

---

## Decisões Tomadas e Não Reverter

> Escolhas técnicas já feitas e consolidadas que não devem ser questionadas sem um ADR. Diferente de proibições — são decisões que já custaram tempo e que reverter teria custo alto.

| Decisão | Contexto | Por que não reverter |
|---|---|---|
| Aplicação web única com front-end e back-end no mesmo projeto | Definição inicial do sistema para simplificar implementação e manutenção | Separar em projetos diferentes aumentaria a complexidade sem trazer benefício real para o cenário atual |
| Banco Supabase | Escolha alinhada ao domínio relacional do produto | Trocar para outro modelo exigiria retrabalho de modelagem e acesso aos dados |
| Login fixo para o administrador | O sistema será usado por apenas uma empresa com um único administrador | Criar gestão completa de usuários seria excesso de complexidade para o caso de uso atual |

