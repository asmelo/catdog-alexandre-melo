# Arquitetura

> Status do projeto: pré-implementação. Baseado em `.makuco/architecture/architecture_definition_context.md`.

## Padrão Adotado

Monólito em camadas — front-end e back-end no mesmo repositório.

## Organização Planejada

```
services/
  backend/   — API Express, regras de negócio, autenticação, persistência
  frontend/  — React + Vite, vitrine pública e área administrativa
```

## Fluxo de Dados (planejado)

Requisição HTTP → Express Router → Controller → Service (regras de negócio) → Repository (Prisma) → Supabase

## Áreas Funcionais

| Área | Descrição |
|---|---|
| Vitrine pública | Catálogo de pets acessível sem autenticação |
| Área administrativa | Painel protegido por login para gerenciar pets e pedidos |
| API de pedidos | Recebimento e acompanhamento de pedidos do cliente |
| Autenticação | Login com email e senha, roles, refresh token |

## Decisões Consolidadas

- Aplicação web única — não separar em múltiplos serviços
- Banco Supabase — não trocar sem ADR
- Autenticação com roles `admin` e `adotante` — redirecionamento e layout baseados na role
- Não reutilizar o mesmo refresh token (rotação de tokens)
