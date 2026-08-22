# Alterações da Feature — RF-002 Autenticação Completa

> **Como preencher:** registre aqui toda alteração realizada após a aprovação inicial da spec. Cada entrada deve descrever o que mudou, por que mudou e quem autorizou. Não edite entradas anteriores — apenas adicione novas.
> **Caminho:** `02-systems/{sistema}/specs/{modulo}/{feature}/changelog.md`

---

## Versão atual da spec

**Versão:** v1.1
**Spec original aprovada em:** _YYYY-MM-DD por Nome_
**Última alteração:** 2026-08-22 (ALT-002 — registro de decisão; o corpo da spec **não** foi editado)

---

## Histórico de Alterações

---

### ALT-001 — Decisões de produto: role padrão e serviço de e-mail

**Data:** 2026-05-27
**Solicitado por:** Responsável do produto
**Realizado por:** Makuco Specify Agent
**Aprovado por:** _A preencher_

**O que mudou:**
Duas decisões tomadas pelo responsável do produto foram incorporadas à spec:
1. A role padrão para usuários não-administradores passou de `adotante` para `cliente`.
2. O serviço de envio de e-mail foi definido como Gmail via SMTP do Google (Nodemailer com App Password), substituindo a dependência marcada como "Pendente / a definir".

**Antes:**
- Todas as referências à role não-administradora usavam o termo `adotante` (textos, regras de negócio, cenários de aceite, casos de teste, critérios de aceite e seção de permissões).
- A dependência de envio de e-mail era descrita como "Configuração do serviço de envio de e-mail — Decisão técnica / Infraestrutura — Pendente" e "Definição do domínio de envio de e-mail (remetente) — Decisão técnica — Pendente".
- A tabela de Integrações listava apenas "Serviço de envio de e-mail" sem identificar o provedor.

**Depois:**
- Todas as ocorrências de `adotante` foram substituídas por `cliente` em todo o documento (Objetivo, Quem Acessa, Referências, HU-03, HU-05, RN-08, Requisitos Funcionais, Validações, CT-10, CT-16, CA-10, "O que Não Deve Ser Feito").
- A dependência de serviço de e-mail foi atualizada para "Configuração da conta Gmail com App Password para envio via SMTP" e "Definição do endereço Gmail remetente".
- A tabela de Integrações foi atualizada para identificar "Gmail via SMTP do Google (Nodemailer com App Password)" como o sistema externo.

**Por que mudou:**
Decisões tomadas pelo responsável do produto após a criação da spec v1.0, consolidando a nomenclatura de role e o provedor de e-mail transacional.

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Objetivo da Feature | Texto atualizado para refletir a role `cliente` |
| Quem Acessa | Linha da role não-administradora renomeada de `adotante` para `cliente` |
| Dependências | Duas entradas atualizadas para refletir Gmail SMTP com App Password |
| Referências e Insumos | Menção à decisão de roles atualizada |
| HU-03 / HU-05 | Cenários de aceite atualizados de `adotante` para `cliente` |
| Regras de Negócio (RN-08) | Role descrita como `admin` ou `cliente` |
| Requisitos Funcionais | Validações e regras condicionais atualizadas |
| Integrações | Provedor de e-mail identificado (Gmail SMTP / Nodemailer) |
| Casos de Teste (CT-10, CT-16) | Role atualizada para `cliente` |
| Critérios de Aceite (CA-10) | Role atualizada para `cliente` |
| O que Não Deve Ser Feito | Role listada como `admin` / `cliente` |

**Seções da spec atualizadas:** Objetivo da Feature, Quem Acessa, Dependências, Referências e Insumos, HU-03, HU-05, Regras de Negócio, Requisitos Funcionais (Ações 3 e 5, Validações), Integrações, Casos de Teste, Critérios de Aceite, O que Não Deve Ser Feito

---

### ALT-002 — Mensagens ao usuário não previstas na tabela da spec (decisão de implementação)

**Data:** 2026-08-22
**Solicitado por:** Contrato da TASK-BACKEND-004 ("registrar no changelog da spec como decisão")
**Realizado por:** Makuco Code-Gen — TASK-BACKEND-004
**Aprovado por:** _A preencher_

**O que mudou:**
Nada no corpo da spec — `spec_context.md` **não foi editado**. Esta entrada registra as strings voltadas ao usuário que a implementação do registro/confirmação precisou criar porque a tabela "Mensagens ao Usuário" não as prevê. Todas vivem em um único catálogo (`services/backend/src/domains/auth/auth.messages.ts`).

**Antes:**
A tabela "Mensagens ao Usuário" cobre 11 condições: registro bem-sucedido, e-mail já cadastrado, senhas não coincidem, senha curta, campo obrigatório em branco, link válido, link expirado, link já utilizado, credenciais inválidas, conta não confirmada e sessão expirada.

**Depois:**
Acrescentadas ao catálogo de implementação (sem alterar a spec):

| Chave | Texto | Por que era inevitável |
|---|---|---|
| `CONFIRMATION_TOKEN_INVALID` | "Link de confirmação inválido." | A spec prevê link expirado e link já utilizado, mas não token inexistente/adulterado — que é o caso mais comum de link truncado por cliente de e-mail. |
| `RESEND_GENERIC` | "Se houver uma conta pendente para este e-mail, enviamos um novo link de confirmação." | O endpoint de reenvio não existe na spec, mas o texto dela manda "Solicite um novo e-mail de confirmação". A mensagem é deliberadamente ambígua para não revelar se o e-mail existe (mesmo espírito da RN-05). |
| `REQUEST_BODY_INVALID` | "Corpo da requisição inválido." | Corpo que não é objeto JSON. |
| `UNEXPECTED_FIELD` | "Campo não permitido nesta requisição." | Recusa de `confirmPassword` e de qualquer campo extra (RN-12). |
| `NAME_TOO_SHORT` / `NAME_TOO_LONG` | "O nome deve ter no mínimo 2 caracteres." / "...no máximo 100 caracteres." | A spec fixa os limites 2 e 100 sem dar o texto; sem eles o Zod responderia em inglês. |
| `EMAIL_INVALID` / `EMAIL_TOO_LONG` | "Informe um e-mail válido." / "O e-mail deve ter no máximo 254 caracteres." | Idem: a spec exige e-mail válido sem definir a mensagem. |
| `PASSWORD_TOO_LONG` | "A senha deve ter no máximo 72 caracteres." | Limite técnico do bcrypt, ausente da spec. |
| `PASSWORD_TOO_LONG_IN_BYTES` | "A senha é muito longa. Acentos e emojis ocupam mais de um caractere — use uma senha mais curta." | O bcrypt trunca em 72 **bytes** e uma senha acentuada estoura os bytes com menos de 72 caracteres — repetir "72 caracteres" seria enganoso para quem digitou exatamente 72. |
| `CONFIRMATION_MAIL_SUBJECT` | "Confirme sua conta na CatDog" | Assunto do e-mail transacional, não previsto em nenhuma tabela. |

**Correção de premissa do plano da task:** a TASK-BACKEND-004 lista `FIELD_REQUIRED` ("Este campo é obrigatório.") como uma das três mensagens "não previstas na spec". Ela **está** na tabela da spec ("Campo obrigatório em branco"). Logo, as mensagens realmente novas de negócio são **duas**, não três — o restante da lista acima é vocabulário de validação de campo.

**Por que mudou:**
Cada string acima é exibida ao usuário final. Sem catalogá-las, o backend responderia mensagens em inglês do Zod (ex.: "String must contain at least 2 character(s)") num produto declaradamente PT-BR.

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Mensagens ao Usuário | A tabela da spec fica incompleta em relação ao que a API responde; recomenda-se absorver as linhas acima na próxima revisão do documento. |
| TASK-FRONTEND-012 | As telas de registro/confirmação passam a poder exibir essas mensagens vindas do backend; o frontend continua ramificando por `code`, não por texto. |
| Nenhuma regra de negócio | Nenhuma RN foi alterada, criada ou reinterpretada. |

**Seções da spec atualizadas:** nenhuma — entrada apenas de registro de decisão.

---

> Adicione novas entradas seguindo o mesmo padrão. Nunca edite ou remova entradas anteriores.
