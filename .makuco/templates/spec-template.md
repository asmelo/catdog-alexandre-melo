# FEATURE-[ID] — [Nome da Feature]

---

## Grupo 1 — Identificação

**Feature:** _FEATURE-[ID] — Nome curto e único da funcionalidade_
**Módulo:** _MODULE-[ID] — Nome do módulo (conforme product/scope_features_context.md)_
**Status:** _Rascunho / Em revisão / Aprovado_
**Criado por:** _Nome — YYYY-MM-DD_
**Aprovado por:** _Nome — YYYY-MM-DD_

---

## Objetivo da Feature

> Em 3-5 linhas: qual problema esta feature resolve, quem se beneficia e qual o valor entregue ao negócio. É o critério de decisão para qualquer dúvida de escopo.

_Descreva o objetivo da feature._

---

## Grupo 2 — Contexto

### Quem Acessa

> Liste exatamente os perfis ou permissões que habilitam o acesso. Termos vagos não são válidos.

| Perfil / Permissão | Nível de acesso | Observação |
|---|---|---|
| _Nome exato do perfil_ | _Leitura / Escrita / Total_ | _Restrições específicas_ |

---

### Premissas

- _Ex: O usuário já está autenticado ao acessar esta funcionalidade._
- _Ex: O módulo MODULE-[ID] já está implementado e funcional._

---

### Dependências

| Dependência | Tipo | Status | Impacto se não resolvida |
|---|---|---|---|
| _Nome_ | _FEATURE-[ID] / API / Decisão técnica_ | _Resolvida / Pendente_ | _O que bloqueia_ |

---

### Referências e Insumos

**Protótipo / Wireframe:**
- Arquivo local: _`specs/{modulo}/{feature}/assets/prototype-v1.png`_
- Link externo: _URL do Figma (opcional)_

**Prints de referência (estado atual):**
- _`specs/{modulo}/{feature}/assets/current-state.png`_

**Artefatos consultados:**
- _Ex: overview/glossary_context.md — termos relevantes_
- _Ex: discovery/interviews/YYYY_MM_DD_nome_context.md_
- _Ex: Link para documentação de API externa_

**Tabelas de banco de dados:** _Ex: Order, Order_Item — conforme ERD em architecture/diagrams/erd/_
**MCPs utilizados:** _Ex: MCP de autenticação — ver shared-components/integrations/auth/_
**SKILLs utilizados:** _Ex: SKILL de geração de PDF_

---

## Grupo 3 — Comportamento

### Histórias de Usuário

> Cada história deve ser independentemente testável — implementada sozinha, deve entregar valor observável.

---

#### HU-01 — [Título breve]

_Descreva o fluxo do usuário em linguagem de negócio._

**Pode ser testada independentemente:** _Descreva como._

**Cenários de aceite:**

1. **Dado** _[estado inicial]_, **quando** _[ação]_, **então** _[resultado esperado]_
2. **Dado** _[estado inicial]_, **quando** _[ação]_, **então** _[resultado esperado]_

---

#### HU-02 — [Título breve]

_Descreva o fluxo do usuário em linguagem de negócio._

**Pode ser testada independentemente:** _Descreva como._

**Cenários de aceite:**

1. **Dado** _[estado inicial]_, **quando** _[ação]_, **então** _[resultado esperado]_

---

### Regras de Negócio

- **RN-01:** _Regra de negócio. Ex: "Um Pedido só pode ser cancelado se estiver no status Confirmado."_
- **RN-02:** _Regra de negócio._

---

### Requisitos Funcionais

#### O que o sistema exibe ao ser acessado

_Descreva o estado inicial — o que o usuário vê antes de executar qualquer ação._

#### Ações disponíveis

**Ação 1 — [Nome]**

_Descrição declarativa do que acontece._

Regras condicionais:
- Se _[condição A]_ → _[resultado]_
- Se _[condição B]_ → _[resultado]_
  - Se confirmado: _[resultado]_
  - Se cancelado: _nenhuma ação é executada_

---

#### Validações e Restrições

- _[Campo X]_ é obrigatório.
- _[Campo Y]_ aceita no mínimo _[N]_ e no máximo _[N]_ caracteres.
- _[Botão Z]_ não é exibido para o perfil _[X]_.

---

#### Mensagens ao Usuário

| Condição | Mensagem |
|---|---|
| _Quando ocorre_ | _'Texto exato exibido ao usuário'_ |

---

#### Integrações

| Sistema externo | O que é enviado | O que é recebido | Em caso de falha |
|---|---|---|---|
| _Nome_ | _Dado ou chamada_ | _Resposta esperada_ | _Comportamento_ |

---

### Requisitos Não Funcionais

| ID | Tipo | Requisito | Critério mensurável |
|---|---|---|---|
| RNF-01 | _Ex: Desempenho_ | _Descrição_ | _Ex: < 2s com 1000 usuários_ |

---

### O que Não Deve Ser Feito

- _Ex: Esta feature não realiza exclusão de registros — apenas inativação._

---

## Grupo 4 — Validação

### Casos de Teste

| ID | Cenário | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CT-01 | _Descrição_ | _Entrada_ | _Resultado_ | _Positivo / Negativo / Borda_ |

---

### Critérios de Aceite

**Comportamento e entrega:**
- [ ] _CA-01: O sistema exibe [elemento] quando [condição]._
- [ ] _CA-02: O usuário consegue [ação] em menos de [tempo]._

**Regressão:**
- [ ] _[Feature FEATURE-[ID]] — [motivo do risco de impacto]_

**Qualidade de código (SonarQube):**
- [ ] Quality Gate aprovado sem bloqueadores
- [ ] Cobertura de testes: mínimo de _[X]%_ nas classes alteradas
- [ ] Zero issues de segurança (Severity: Blocker ou Critical)

---

### Critério de Sucesso da Feature

| Métrica | Baseline atual | Meta após entrega | Como será medida |
|---|---|---|---|
| _Ex: Usuários que completam o fluxo_ | _Ex: 0_ | _Ex: >70%_ | _Ex: Analytics_ |

---

## Grupo 5 — Estimativa

> Preencha após o escopo completo estar definido e revisado.

**Use Points gerados:** _Número estimado_
**Estimativa de custo:** _Valor estimado ou faixa_
