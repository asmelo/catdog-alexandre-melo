# Stack de Tecnologia

> **Como preencher:** registre todas as tecnologias, ferramentas e sistemas utilizados neste projeto. O objetivo é que qualquer desenvolvedor novo saiba exatamente com o que vai trabalhar antes de configurar o ambiente.
> **Caminho:** `02-systems/{sistema}/architecture/tech-stack.md`

---

## Linguagem e Runtime

| Item | Tecnologia | Versão | Observação |
|---|---|---|---|
| Linguagem principal | TypeScript | 5.x | Linguagem principal do front-end e do back-end para manter consistência no projeto |
| Runtime / Plataforma | Node.js | 20 LTS | Executa o back-end e as ferramentas do projeto |
| Gerenciador de pacotes | npm | 10.x | Gerenciamento simples e amplamente suportado pela comunidade |

---

## Frameworks e Bibliotecas Principais

| Camada | Framework / Biblioteca | Versão | Finalidade |
|---|---|---|---|
| Backend | Express | 4.x | Servidor web e camada de APIs para pets, pedidos, login e painel administrativo |
| Frontend | React | 18.x | Construção da vitrine pública e da área administrativa |
| Frontend / Build | Vite | 5.x | Ambiente rápido de desenvolvimento e build da aplicação web |
| ORM / Acesso a dados | Prisma | 5.x | Mapeamento e acesso ao Supabase com consultas mais simples e produtivas |
| Estilização | Tailwind CSS | 3.x | Criação de interface simples, bonita e responsiva com facilidade de manutenção |
| Testes | Jest | 29.x | Testes automatizados de lógica de negócio e regras principais |

---

## Banco de Dados

| Tipo | Tecnologia | Versão | Uso no sistema |
|---|---|---|---|
| Relacional | Supabase | — | Armazena pets, dados internos do pet, pedidos, etapas do fluxo e dados de contato do cliente |
| Cache | Não utilizado inicialmente | — | O sistema não exige cache no cenário atual |
| Busca | Não utilizado inicialmente | — | A busca será atendida pelas consultas no próprio Supabase e pelos filtros da aplicação |

---

## Infraestrutura e Cloud

| Item | Tecnologia | Observação |
|---|---|---|
| Cloud provider | Render ou Railway | Opções simples e com camada gratuita ou baixo custo para hospedar a aplicação |
| Containers | Docker | Facilita subir o ambiente local e padronizar a execução do projeto |
| Orquestração | Não utilizada inicialmente | O sistema é pequeno e não precisa de orquestração complexa |
| CI/CD | GitHub Actions | Automatiza validações básicas e deploy, com configuração simples e gratuita para início |
| Monitoramento | Logs da plataforma de hospedagem | Solução inicial suficiente para acompanhar execução e erros sem custo extra |

---

## Sistemas e Componentes Externos

> Registre todos os sistemas de terceiros, APIs externas e componentes compartilhados da organização que este sistema consome ou com os quais se integra.

| Sistema / Componente | Tipo | Finalidade | Como integra |
|---|---|---|---|
| Supabase | Serviço de banco | Persistência dos dados da aplicação | Conexão via Prisma e Supabase client |
| GitHub | Repositório / CI | Hospedagem do código e automação básica de entrega | Integração via push e GitHub Actions |
| Render ou Railway | Plataforma de deploy | Hospedagem do front-end/back-end e do banco, quando aplicável | Deploy a partir do repositório Git |

---

## Ferramentas de Desenvolvimento

| Ferramenta | Finalidade |
|---|---|
| VS Code | IDE principal |
| Postman ou Insomnia | Testes e validação das APIs |
| Docker Desktop | Execução local padronizada do ambiente |
| Git | Controle de versão |

