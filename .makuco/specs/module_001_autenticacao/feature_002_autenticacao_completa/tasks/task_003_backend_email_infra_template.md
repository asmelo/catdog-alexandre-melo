# TASK-BACKEND-003 — Infraestrutura de e-mail e template de confirmação de conta

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-003-backend-email-infra-template`
**Spec**: `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md`
**Part**: 3 of 13 — Infraestrutura de E-mail
**Generated**: `2026-08-19`

---

## Context

Entrega a porta de envio de e-mail (Gmail SMTP via Nodemailer com App Password) e o template de confirmação de conta com a identidade visual da CatDog exigida por RN-11 / RNF-06. A referência visual é `.makuco/resources/reference.html`, que é uma página web com CSS moderno — **precisa ser reescrita para HTML de e-mail**, não copiada.

---

## Scope

**In:** `MailerPort` (abstração), implementação Nodemailer, renderizador de template com escape, e os arquivos `account-confirmation.html` + `.txt`.

**Out:** Nenhum serviço de domínio chama o mailer neste slice — o disparo no registro é da TASK-BACKEND-004. Não implementar fila, retry ou agendamento (mensageria é proibida por decisão arquitetural). Não criar outros templates (recuperação de senha está fora do escopo da feature). Sem testes (TASK-BACKEND-007).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/infra/mail/mailer.port.ts` | abstração de envio |
| `create` | `src/infra/mail/nodemailer-mailer.ts` | implementação SMTP Gmail |
| `create` | `src/infra/mail/template-renderer.ts` | injeta variáveis com escape |
| `create` | `src/infra/mail/templates/account-confirmation.html` | e-mail identidade CatDog |
| `create` | `src/infra/mail/templates/account-confirmation.txt` | fallback texto puro |
| `modify` | `package.json` | adiciona nodemailer |

---

## Implementation

> **Reference pattern**: `.makuco/resources/reference.html` para a identidade visual (cores, tipografia, formato do card e do botão) — **apenas como referência de aparência**. Estilo de módulo: `src/utils/password-hasher.ts` (TASK-BACKEND-002), que isola uma lib externa atrás de funções nomeadas.

### `src/infra/mail/mailer.port.ts` *(create)*
- `export interface MailerPort { send(message: MailMessage): Promise<void> }` e `export interface MailMessage { to: string; subject: string; html: string; text: string }`.
- Existe para inverter a dependência (SOLID-D): os services de domínio dependem desta interface, nunca de `nodemailer`. É o que permite o `FakeMailer` nos testes e a troca futura por provedor transacional editando um arquivo.

### `src/infra/mail/nodemailer-mailer.ts` *(create)*
- `export class NodemailerMailer implements MailerPort`, recebendo o transporter por **injeção no construtor** (não instanciar internamente).
- Fábrica `createGmailTransport()` no mesmo arquivo: `nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } })`. `pool: false` — o volume é baixíssimo e pool ocioso derruba a conexão do Gmail.
- Remetente montado de `env.MAIL_FROM_NAME` + `env.MAIL_FROM_ADDRESS` no formato `"CatDog" <endereco@gmail.com>`.
- **Único arquivo do projeto autorizado a importar `nodemailer`.**
- Falha de envio deve **propagar** a exceção — a decisão de engolir e seguir é do service de registro (TASK-BACKEND-004), não da infraestrutura.

### `src/infra/mail/template-renderer.ts` *(create)*
- `renderTemplate(templateName: string, variables: Record<string, string>): { html: string; text: string }` — lê `templates/<name>.html` e `<name>.txt`, substitui `{{chave}}`.
- **Escape HTML obrigatório** de todo valor injetado no `.html` (`&`, `<`, `>`, `"`, `'`): o `userName` vem do cadastro e sem escape vira injeção no cliente de e-mail. O `.txt` não escapa.
- Placeholder sem valor correspondente → **lançar erro**, nunca renderizar `{{userName}}` cru para o usuário.
- Ler os arquivos com `path.join(__dirname, 'templates', ...)` e cachear em memória após a primeira leitura. Sem dependência de template engine — Handlebars/EJS não se justifica para um template.
- **Atenção de build**: `tsc` não copia `.html`/`.txt` para `dist/`. O script `copy:templates` criado na TASK-BACKEND-001 passa a ser obrigatório a partir daqui — sem ele o e-mail quebra só em produção.

### `src/infra/mail/templates/account-confirmation.html` *(create)*
Variáveis: `{{userName}}`, `{{confirmationUrl}}`, `{{expirationHours}}`, `{{supportEmail}}`.

Adaptação obrigatória do `reference.html` para clientes de e-mail — o mockup usa recursos que **não** funcionam em e-mail:

| No `reference.html` | Problema em e-mail | O que fazer |
|---|---|---|
| `<style>` no head com variáveis CSS (`--purple`) | Gmail remove `<style>`; variáveis CSS não existem | **Todos os estilos inline**, cores como literais hex |
| `display:flex`, `gap`, `position:absolute` | Sem suporte (engine Word do Outlook) | Layout 100% em tabelas aninhadas com `role="presentation"` |
| `box-shadow: 0 8px 40px ...` do card | Ignorado em praticamente todos | Trocar por `border: 1px solid #e4e2f0` |
| `<button class="btn-submit">` | Botão não é clicável em e-mail | **Bulletproof button**: `<table><tr><td bgcolor="#7c3aed" style="border-radius:14px"><a href="{{confirmationUrl}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:800;text-decoration:none">Confirmar minha conta</a></td></tr></table>` |
| Nunito via `<link>` do Google Fonts | Gmail/Outlook não carregam webfont | Stack inline `font-family:'Nunito','Trebuchet MS','Segoe UI',Arial,Helvetica,sans-serif` em **cada** elemento de texto; manter o `<link>` no head para Apple Mail/Thunderbird, que carregam |
| Pegadas geradas por `<script>` | Sem JS; SVG e `data:` URI bloqueados | **Omitir as pegadas** — exigiriam PNG hospedado publicamente, fora do escopo |
| Logo SVG inline | Idem | Logotipo tipográfico: `<span style="color:#e05a1e">Cat</span><span style="color:#7c3aed">Dog</span>`, peso 800 |

Cores que **devem** aparecer literalmente (é o critério verificável de RNF-06): fundo externo `#dde0ea`, card `#ffffff`, botão `#7c3aed`, "Cat" do logo `#e05a1e`, título `#1e1b2e`, texto secundário `#9896b0`, borda `#e4e2f0`. Raio do botão `14px` e do card `22px` (degradam para canto reto no Outlook — aceitável).

Estrutura e conteúdo: largura fixa `600px` centralizada, `<meta name="viewport">`, saudação "Olá, {{userName}}!", frase de contexto, botão, aviso "Este link expira em {{expirationHours}} horas.", **a URL também em texto puro** ("Se o botão não funcionar, copie e cole este endereço:" + `{{confirmationUrl}}`) e rodapé com `{{supportEmail}}` e a nota de que o e-mail pode ser ignorado se o cadastro não foi solicitado. Nenhuma requisição externa além do `<link>` da fonte; nenhum `<script>`.

### `src/infra/mail/templates/account-confirmation.txt` *(create)*
- Mesma mensagem em texto puro, com a URL completa em linha própria. Enviado em `text:` — melhora a entregabilidade e reduz a chance de o Gmail classificar como spam (risco real com remetente `@gmail.com`).

### `package.json` *(modify)*
- Adicionar `nodemailer` e `@types/nodemailer` (dev).

---

## Acceptance Criteria

- [ ] **Given** `renderTemplate('account-confirmation', { userName, confirmationUrl, expirationHours, supportEmail })`, **When** executado, **Then** retorna `html` e `text` sem nenhuma sequência `{{` remanescente.
- [ ] **Given** `userName = '<script>alert(1)</script>'`, **When** renderizado, **Then** o `html` contém a forma escapada (`&lt;script&gt;`) e não a tag executável.
- [ ] **Given** uma variável exigida pelo template ausente do objeto, **When** renderizado, **Then** lança erro — não produz saída com placeholder cru.
- [ ] **Given** o HTML renderizado, **When** inspecionado, **Then** contém os literais `#7c3aed`, `#e05a1e` e `#dde0ea`, não contém nenhuma tag `<script>`, e todo estilo visual está em atributos `style=` inline (nenhuma classe CSS aplicada via `<style>`).
- [ ] **Given** o HTML renderizado, **When** procurado o link, **Then** `{{confirmationUrl}}` aparece **duas** vezes: no `href` do botão e como texto copiável.
- [ ] **Given** um `MailerPort` fake injetado, **When** `send` é chamado, **Then** a mensagem tem `to`, `subject`, `html` e `text` preenchidos — `text` nunca vazio.
- [ ] **Given** o SMTP recusa a conexão, **When** `NodemailerMailer.send` é chamado, **Then** a exceção **propaga** (a infraestrutura não decide engolir).
- [ ] **Given** `npm run build`, **When** concluído, **Then** `dist/infra/mail/templates/account-confirmation.html` e `.txt` existem.
- [ ] Busca por `nodemailer` no `src/` retorna ocorrência apenas em `src/infra/mail/nodemailer-mailer.ts`.
- [ ] Verificação manual de RNF-06: enviar o e-mail real para uma caixa Gmail e conferir que o botão roxo, o logotipo bicolor e o fundo claro aparecem como no `reference.html`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (`config/env.ts` com as chaves `SMTP_*`/`MAIL_FROM_*`, script `copy:templates`), TASK-BACKEND-002 (hierarquia `AppError`).
- **Blocks**: TASK-BACKEND-004 (registro e reenvio disparam o e-mail de confirmação).
- **Infra pendente** (registrada na spec): conta Gmail remetente criada com App Password de 16 caracteres — sem ela o slice compila e testa com fake, mas o envio real não pode ser homologado.
