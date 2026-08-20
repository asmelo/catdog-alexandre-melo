# Convenções

> Status do projeto: pré-implementação. Convenções definidas com base em MAKUCO.md e decisões de arquitetura.

## Linguagem

- Projeto em Português (BR): prompts, mensagens de erro, comentários e documentação em português
- Código (variáveis, funções, arquivos) pode seguir inglês técnico — a ser definido durante implementação

## TypeScript

- Proibido uso de `any` — sempre tipagem precisa
- Path alias `~/` mapeia para `src/`

## Nomenclatura de Arquivos

- Ainda não definida formalmente — projeto pré-implementação
- Padrão esperado: kebab-case para arquivos, PascalCase para componentes React

## Estrutura de Pastas (planejada)

```
src/
  domains/   — lógica de negócio organizada por domínio
  utils/     — utilitários e helpers compartilhados
  config/    — configurações e variáveis de ambiente
  index.ts   — ponto de entrada da aplicação
```

## Commits

- Convenção ainda não formalizada — a ser definida durante onboarding do time
