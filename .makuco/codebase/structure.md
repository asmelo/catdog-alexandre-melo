# Estrutura

> Status do projeto: pré-implementação. Os diretórios `services/backend` e `services/frontend` existem mas estão vazios. Estrutura planejada com base em MAKUCO.md e decisões de arquitetura.

## Layout de Alto Nível

```
catdog-alexandre-melo/
  services/
    backend/     — API Express (vazio — pré-implementação)
    frontend/    — React + Vite (vazio — pré-implementação)
  .makuco/       — documentação e especificações Makuco
  sonar-project.properties
  MAKUCO.md
```

## Estrutura Planejada — Backend

```
services/backend/src/
  index.ts          — ponto de entrada, inicialização do servidor Express
  domains/          — lógica de negócio por domínio (auth, pets, pedidos...)
  utils/            — helpers e utilitários compartilhados
  config/           — configuração e variáveis de ambiente
```

## Estrutura Planejada — Frontend

```
services/frontend/src/
  pages/            — páginas da aplicação (vitrine, login, admin...)
  components/       — componentes React reutilizáveis
  contexts/         — contextos React (AuthContext etc.)
  utils/            — helpers e utilitários
```

## Path Aliases

- `~/` → `src/` (configurado em tsconfig.json — a implementar)

## Monorepo

Projeto com dois serviços no mesmo repositório (`services/backend`, `services/frontend`), mas sem workspaces npm configurados ainda.
