# Alterações da Feature — RF-002 Autenticação Completa

> **Como preencher:** registre aqui toda alteração realizada após a aprovação inicial da spec. Cada entrada deve descrever o que mudou, por que mudou e quem autorizou. Não edite entradas anteriores — apenas adicione novas.
> **Caminho:** `02-systems/{sistema}/specs/{modulo}/{feature}/changelog.md`

---

## Versão atual da spec

**Versão:** v1.1
**Spec original aprovada em:** _YYYY-MM-DD por Nome_
**Última alteração:** 2026-05-27

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

> Adicione novas entradas seguindo o mesmo padrão. Nunca edite ou remova entradas anteriores.
