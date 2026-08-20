# Integrações

> Status do projeto: pré-implementação. Baseado em `.makuco/architecture/tech_stack_context.md`.

## Banco de Dados

| Sistema | Tipo | Finalidade | Como integra |
|---|---|---|---|
| Supabase | PostgreSQL gerenciado | Persistência de todos os dados | Conexão via Prisma + Supabase client |

## Infraestrutura

| Sistema | Finalidade | Integração |
|---|---|---|
| GitHub | Repositório e CI | GitHub Actions para build e deploy |
| Render ou Railway | Hospedagem | Deploy via push ao repositório Git |
| Docker | Containers | Ambiente local padronizado |

## E-mail Transacional

- Serviço de envio de e-mail: ainda não definido (ex: Resend, SendGrid, Nodemailer com SMTP)
- Template de referência: `.makuco/resources/reference.html`
- Uso: confirmação de conta no registro de usuário

## Serviços Não Utilizados

- Cache dedicado (Redis etc.) — não necessário no cenário atual
- Fila de mensagens (RabbitMQ, Kafka etc.) — proibido por decisão arquitetural
- Autenticação OAuth/SSO — não planejada; autenticação própria com email/senha
