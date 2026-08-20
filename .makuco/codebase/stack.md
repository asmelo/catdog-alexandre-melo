# Stack

> Status do projeto: pré-implementação. Não há código-fonte ainda. Todas as informações abaixo derivam de `.makuco/architecture/tech_stack_context.md` e `.makuco/architecture/tech_restrictions_context.md`.

## Linguagem e Runtime

| Item | Tecnologia | Versão |
|---|---|---|
| Linguagem principal | TypeScript | 5.x |
| Runtime | Node.js | 20 LTS |
| Gerenciador de pacotes | npm | 10.x |

## Frameworks e Bibliotecas

| Camada | Tecnologia | Versão | Finalidade |
|---|---|---|---|
| Backend | Express | 4.x | Servidor HTTP e camada de APIs |
| Frontend | React | 18.x | Interface pública (vitrine) e área administrativa |
| Build | Vite | 5.x | Dev server e build do front-end |
| ORM | Prisma | 5.x | Acesso ao banco Supabase |
| Estilos | Tailwind CSS | 3.x | Estilização da interface |
| Testes | Jest | 29.x | Testes automatizados |

## Banco de Dados

| Tipo | Tecnologia | Uso |
|---|---|---|
| Relacional | Supabase (PostgreSQL) | Persistência de todos os dados do sistema |

## Infraestrutura

| Item | Tecnologia |
|---|---|
| Containers | Docker |
| CI/CD | GitHub Actions |
| Hospedagem | Render ou Railway |

## Tecnologias Proibidas

- Microserviços — usar monólito em camadas
- Mensageria assíncrona — usar processamento síncrono
- Banco NoSQL — usar Supabase
- Bibliotecas pagas de UI
