# Preocupações Transversais

> Status do projeto: pré-implementação. Baseado nos requisitos da feature de autenticação e em `.makuco/architecture/tech_restrictions_context.md`.

## Autenticação e Autorização

- Autenticação por email e senha
- Roles definidas: `admin` e `adotante`
- Uso de access token + refresh token (rotação obrigatória — não reutilizar o mesmo refresh token)
- Redirecionamento pós-login baseado na role do usuário
- Layout diferente por role
- Área administrativa acessível apenas para role `admin`
- Vitrine pública acessível sem autenticação

## Validação de Entrada

- Abordagem ainda não definida no código (projeto pré-implementação)
- Candidatos: Zod (alinhado ao ecossistema TypeScript)

## Segurança

- Dados de contato do cliente visíveis apenas no painel administrativo
- Dados internos do pet (chip, contato do proprietário) não expostos na vitrine pública
- Senhas nunca armazenadas em texto plano

## E-mail Transacional

- E-mail de confirmação de conta enviado no registro do usuário
- Template de referência visual em `.makuco/resources/reference.html` (estilo CatDog: roxo, laranja, fonte Nunito, fundo com pegadas)

## Logging e Monitoramento

- Logs da plataforma de hospedagem (Render ou Railway) — solução inicial suficiente
