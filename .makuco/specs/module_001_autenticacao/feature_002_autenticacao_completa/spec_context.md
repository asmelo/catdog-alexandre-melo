# FEATURE-002 — Autenticação Completa

---

## Grupo 1 — Identificação

**Feature:** FEATURE-002 — Autenticação Completa (registro, login, refresh token, permissionamento por role)
**Módulo:** MODULE-001 — Autenticação
**Status:** Rascunho
**Criado por:** Makuco Specify Agent — 2026-05-27
**Aprovado por:** _A preencher_

---

## Objetivo da Feature

O sistema CatDog precisa identificar quem está acessando a plataforma para proteger o painel administrativo e personalizar a experiência conforme o perfil do usuário. Esta feature resolve a ausência de controle de acesso, permitindo que novos usuários se registrem, confirmem sua identidade por e-mail e façam login de forma segura. Após o login, o sistema redireciona o usuário para a área correta conforme sua role (`admin` ou `cliente`) e mantém a sessão ativa com renovação segura de tokens. O benefício direto é proteger as operações administrativas de acesso indevido e oferecer ao cliente uma experiência personalizada desde o primeiro acesso.

---

## Grupo 2 — Contexto

### Quem Acessa

| Perfil / Permissão | Nível de acesso | Observação |
|---|---|---|
| Visitante (não autenticado) | Acesso às telas de registro e login | Não acessa áreas protegidas |
| cliente | Acesso à área do cliente após login | Redirecionado para área específica do cliente; layout próprio |
| admin | Acesso total ao painel administrativo | Redirecionado para painel admin; layout diferenciado com controles de gestão |

---

### Premissas

- O sistema ainda não possui código implementado — esta spec é a referência inaugural para toda a implementação de autenticação.
- O serviço de envio de e-mail deve estar configurado e disponível no ambiente antes da ativação do fluxo de confirmação de conta.
- O template visual de e-mail (`reference.html`) com identidade visual da CatDog (roxo `#7c3aed`, laranja `#e05a1e`, fonte Nunito) será usado como base para todos os e-mails transacionais.
- Usuários registrados sem confirmação de e-mail não conseguem fazer login.
- Senhas são armazenadas apenas como hash — nunca em texto plano.
- O banco de dados utilizado é Supabase (PostgreSQL via Prisma).

---

### Dependências

| Dependência | Tipo | Status | Impacto se não resolvida |
|---|---|---|---|
| Configuração da conta Gmail com App Password para envio via SMTP | Infraestrutura | Pendente | Impede o envio do e-mail de confirmação de conta, bloqueando o registro |
| Definição do endereço Gmail remetente (ex.: noreply@gmail.com) | Decisão operacional | Pendente | E-mails podem cair em spam ou não ser entregues sem remetente configurado |
| Configuração do banco Supabase | Infraestrutura | Pendente | Impede o armazenamento de usuários, tokens e roles |
| Template de e-mail de confirmação | Recurso visual | Disponível em `.makuco/resources/reference.html` | Sem template, o e-mail fica sem identidade visual |

---

### Referências e Insumos

**Protótipo / Wireframe:**
- Arquivo local: sem wireframe formal — o `reference.html` serve como referência visual para o e-mail e para a identidade do formulário de login/registro

**Artefatos consultados:**
- `.makuco/resources/reference.html` — template visual com identidade CatDog (roxo, laranja, Nunito)
- `.makuco/overview/project_goal_context.md` — perfis de usuário (Administrador, Cliente/Adotante)
- `.makuco/overview/glossary_context.md` — definições de Administrador, Cliente, Adotante
- `.makuco/codebase/architecture.md` — decisão de roles `admin` e `cliente`, rotação de refresh token
- `.makuco/codebase/stack.md` — TypeScript, Node.js, Express, Prisma, Supabase, React 18, Vite, Tailwind

**Tabelas de banco de dados:** `Usuario`, `RefreshToken` — a definir conforme modelo de dados desta spec
**MCPs utilizados:** Não aplicável nesta feature
**SKILLs utilizados:** Não aplicável nesta feature

---

## Grupo 3 — Comportamento

### Histórias de Usuário

---

#### HU-01 — Registro de novo usuário

Um visitante acessa a tela de registro, preenche nome, e-mail, senha e confirmação de senha, e submete o formulário. O sistema valida os dados, cria a conta com status pendente de confirmação e envia um e-mail com link de ativação. O visitante é informado de que deve verificar seu e-mail antes de fazer login.

**Pode ser testada independentemente:** Sim — basta acessar a tela de registro, preencher os dados válidos e verificar que o e-mail de confirmação é enviado e que o login é bloqueado enquanto a conta não for confirmada.

**Cenários de aceite:**

1. **Dado** que o visitante está na tela de registro e preenche todos os campos corretamente com e-mail ainda não cadastrado, **quando** submete o formulário, **então** o sistema cria a conta com status "pendente de confirmação", exibe a mensagem "Verifique seu e-mail para ativar sua conta." e envia o e-mail de confirmação.
2. **Dado** que o visitante preenche um e-mail já cadastrado, **quando** submete o formulário, **então** o sistema exibe a mensagem "Este e-mail já está em uso."
3. **Dado** que a senha e a confirmação de senha são diferentes, **quando** submete o formulário, **então** o sistema exibe a mensagem "As senhas não coincidem." sem criar a conta.
4. **Dado** que o visitante deixa algum campo obrigatório em branco, **quando** submete o formulário, **então** o sistema indica o campo faltante e não prossegue.
5. **Dado** que a senha informada tem menos de 8 caracteres, **quando** submete o formulário, **então** o sistema exibe a mensagem "A senha deve ter pelo menos 8 caracteres."

---

#### HU-02 — Confirmação de conta via e-mail

O visitante recebe o e-mail de confirmação e clica no link. O sistema valida o token do link, ativa a conta e informa que o cadastro está completo e que ele já pode fazer login.

**Pode ser testada independentemente:** Sim — basta registrar uma conta, acessar o link do e-mail e verificar que a conta muda para status ativo e que o login passa a ser permitido.

**Cenários de aceite:**

1. **Dado** que o link de confirmação é válido e ainda não expirou, **quando** o visitante clica no link, **então** o sistema ativa a conta e exibe a mensagem "Conta confirmada! Faça login para continuar."
2. **Dado** que o link de confirmação já expirou, **quando** o visitante clica no link, **então** o sistema exibe a mensagem "Este link de confirmação expirou. Solicite um novo e-mail de confirmação."
3. **Dado** que o link de confirmação já foi usado anteriormente, **quando** o visitante tenta usá-lo novamente, **então** o sistema exibe a mensagem "Este link de confirmação já foi utilizado."

---

#### HU-03 — Login com e-mail e senha

O usuário com conta ativa acessa a tela de login, informa e-mail e senha, e submete. O sistema autentica o usuário, gera um access token e um refresh token, e redireciona para a área correspondente à sua role.

**Pode ser testada independentemente:** Sim — basta usar uma conta ativa com role definida e verificar o redirecionamento correto e a geração dos tokens.

**Cenários de aceite:**

1. **Dado** que o usuário tem conta ativa com role `admin`, **quando** faz login com credenciais corretas, **então** é redirecionado para o painel administrativo com layout de admin.
2. **Dado** que o usuário tem conta ativa com role `cliente`, **quando** faz login com credenciais corretas, **então** é redirecionado para a área do cliente com layout de cliente.
3. **Dado** que o usuário informa senha incorreta, **quando** submete o formulário, **então** o sistema exibe a mensagem "E-mail ou senha incorretos." sem indicar qual campo está errado.
4. **Dado** que o usuário ainda não confirmou o e-mail, **quando** tenta fazer login, **então** o sistema exibe a mensagem "Sua conta ainda não foi confirmada. Verifique seu e-mail."
5. **Dado** que o e-mail informado não existe no sistema, **quando** submete o formulário, **então** o sistema exibe a mensagem "E-mail ou senha incorretos." (mesma mensagem do cenário de senha incorreta, para não revelar se o e-mail existe).

---

#### HU-04 — Renovação de sessão com refresh token

Quando o access token do usuário expira, o sistema usa o refresh token armazenado para emitir um novo par de tokens (access token + refresh token novo), invalidando o token anterior. O usuário permanece logado sem precisar fazer login novamente.

**Pode ser testada independentemente:** Sim — basta simular a expiração do access token e verificar que um novo par de tokens é gerado, que o refresh token anterior é invalidado e que o usuário continua com a sessão ativa.

**Cenários de aceite:**

1. **Dado** que o access token expirou e o refresh token ainda é válido, **quando** o sistema detecta a expiração, **então** emite um novo access token e um novo refresh token, invalidando o refresh token anterior.
2. **Dado** que o refresh token foi utilizado anteriormente (já rotacionado), **quando** alguém tenta usá-lo novamente, **então** o sistema recusa e encerra a sessão do usuário por suspeita de reutilização indevida.
3. **Dado** que o refresh token expirou, **quando** o sistema tenta renovar a sessão, **então** o usuário é redirecionado para a tela de login com a mensagem "Sua sessão expirou. Faça login novamente."

---

#### HU-05 — Redirecionamento e layout baseados na role

Após o login, o sistema exibe layouts e rotas distintas conforme a role do usuário. O usuário `admin` vê o painel de gestão; o usuário `cliente` vê sua área personalizada. Rotas protegidas verificam a role antes de renderizar o conteúdo.

**Pode ser testada independentemente:** Sim — basta acessar rotas protegidas com cada role e verificar que a renderização correta é feita e que o acesso a rotas de outra role é bloqueado.

**Cenários de aceite:**

1. **Dado** que o usuário autenticado tem role `admin`, **quando** acessa a aplicação, **então** o layout exibido é o de administrador com navegação e controles de gestão visíveis.
2. **Dado** que o usuário autenticado tem role `cliente`, **quando** acessa a aplicação, **então** o layout exibido é o de cliente, sem acesso a controles administrativos.
3. **Dado** que um usuário com role `cliente` tenta acessar uma rota exclusiva de `admin`, **quando** a rota é carregada, **então** o sistema redireciona para a área do cliente sem exibir o conteúdo restrito.
4. **Dado** que um usuário não autenticado tenta acessar qualquer rota protegida, **quando** a rota é carregada, **então** o sistema redireciona para a tela de login.

---

### Regras de Negócio

- **RN-01:** Um usuário só pode fazer login se sua conta estiver com status "ativo" (confirmação de e-mail concluída).
- **RN-02:** O link de confirmação de e-mail tem validade de 24 horas a partir do envio. Após esse prazo, o token é inválido e um novo e-mail deve ser solicitado.
- **RN-03:** O link de confirmação de e-mail é de uso único. Após utilização, o token é invalidado imediatamente.
- **RN-04:** Senhas devem ter no mínimo 8 caracteres.
- **RN-05:** Mensagens de erro no login nunca indicam se o e-mail existe ou não no sistema — sempre exibir "E-mail ou senha incorretos."
- **RN-06:** O refresh token é descartado após cada uso — um novo refresh token é emitido junto com o novo access token (rotação de refresh token).
- **RN-07:** Se um refresh token já rotacionado for apresentado novamente, o sistema deve invalidar todos os tokens da sessão daquele usuário (proteção contra reutilização indevida / token theft).
- **RN-08:** Todo usuário tem exatamente uma role: `admin` ou `cliente`. A role é definida no momento do cadastro ou por atribuição administrativa.
- **RN-09:** O redirecionamento pós-login é determinado exclusivamente pela role registrada no token de sessão.
- **RN-10:** A verificação de permissão para rotas protegidas deve ocorrer no servidor — não apenas no frontend.
- **RN-11:** O e-mail de confirmação de conta deve usar o template visual da CatDog (roxo `#7c3aed`, laranja `#e05a1e`, fonte Nunito), conforme o arquivo `reference.html`.
- **RN-12:** O campo "confirmação de senha" não é persistido — existe apenas para validação no formulário de registro, no lado do cliente.
- **RN-13:** Não é possível registrar dois usuários com o mesmo endereço de e-mail, independentemente do status da conta.

---

### Requisitos Funcionais

#### O que o sistema exibe ao ser acessado

**Tela de registro:** formulário com os campos Nome completo, E-mail, Senha e Confirmação de senha, botão "Criar conta" e link para a tela de login ("Já tenho conta").

**Tela de login:** formulário com os campos E-mail e Senha, botão "Entrar" e link para a tela de registro ("Criar conta").

**Tela de confirmação de e-mail (pós-registro):** mensagem informando que um e-mail foi enviado e que o usuário deve verificar sua caixa de entrada para ativar a conta.

**Tela de resultado de confirmação:** exibida ao clicar no link do e-mail — informa sucesso na ativação ou erro (link expirado / já utilizado), com link para login.

#### Ações disponíveis

**Ação 1 — Registrar conta**

O visitante preenche os campos do formulário e clica em "Criar conta".

Regras condicionais:
- Se todos os campos forem válidos e o e-mail não estiver em uso → o sistema cria a conta com status "pendente de confirmação", envia o e-mail de confirmação e exibe a tela informativa de verificação de e-mail.
- Se o e-mail já estiver cadastrado → exibe "Este e-mail já está em uso." e mantém o formulário preenchido.
- Se a senha e a confirmação não coincidirem → exibe "As senhas não coincidem." sem criar a conta.
- Se a senha tiver menos de 8 caracteres → exibe "A senha deve ter pelo menos 8 caracteres."
- Se qualquer campo obrigatório estiver em branco → indica o campo faltante sem prosseguir.

**Ação 2 — Confirmar conta via link de e-mail**

O visitante clica no link recebido por e-mail.

Regras condicionais:
- Se o token for válido e não expirado → ativa a conta e exibe mensagem de sucesso com link para login.
- Se o token estiver expirado → exibe "Este link de confirmação expirou. Solicite um novo e-mail de confirmação."
- Se o token já tiver sido usado → exibe "Este link de confirmação já foi utilizado."

**Ação 3 — Fazer login**

O usuário preenche e-mail e senha e clica em "Entrar".

Regras condicionais:
- Se as credenciais forem válidas e a conta estiver ativa → gera access token e refresh token, redireciona para a área correspondente à role do usuário.
- Se as credenciais forem inválidas (qualquer dos campos incorretos) → exibe "E-mail ou senha incorretos." sem indicar qual campo está errado.
- Se a conta existir mas não estiver confirmada → exibe "Sua conta ainda não foi confirmada. Verifique seu e-mail."

**Ação 4 — Renovar sessão (refresh token)**

Ocorre automaticamente quando o access token expira.

Regras condicionais:
- Se o refresh token for válido e não expirado → emite novo access token e novo refresh token; invalida o refresh token anterior.
- Se o refresh token for inválido ou já tiver sido utilizado → encerra a sessão e redireciona para a tela de login com a mensagem "Sua sessão expirou. Faça login novamente."

**Ação 5 — Acessar rota protegida**

O usuário autenticado navega pela aplicação.

Regras condicionais:
- Se a role do usuário corresponde à rota acessada → renderiza o conteúdo normalmente.
- Se a role do usuário não corresponde à rota (ex.: `cliente` tentando acessar área de `admin`) → redireciona para a área correta da role do usuário.
- Se o usuário não está autenticado → redireciona para a tela de login.

---

#### Validações e Restrições

- O campo **Nome completo** é obrigatório. Aceita mínimo de 2 e máximo de 100 caracteres.
- O campo **E-mail** é obrigatório e deve ser um endereço de e-mail válido (formato padrão com @ e domínio).
- O campo **Senha** é obrigatório e deve ter no mínimo 8 caracteres.
- O campo **Confirmação de senha** é obrigatório e deve ser idêntico ao campo Senha.
- O botão "Criar conta" e o botão "Entrar" ficam desabilitados enquanto a requisição está em andamento, para evitar submissões duplicadas.
- Rotas da área administrativa são acessíveis apenas para usuários com role `admin`.
- Rotas da área do cliente são acessíveis apenas para usuários com role `cliente`.
- Rotas de registro e login redirecionam automaticamente para a área correta caso o usuário já esteja autenticado.

---

#### Mensagens ao Usuário

| Condição | Mensagem |
|---|---|
| Registro bem-sucedido | "Verifique seu e-mail para ativar sua conta." |
| E-mail já cadastrado | "Este e-mail já está em uso." |
| Senhas não coincidem | "As senhas não coincidem." |
| Senha com menos de 8 caracteres | "A senha deve ter pelo menos 8 caracteres." |
| Campo obrigatório em branco | "Este campo é obrigatório." (exibido abaixo do campo) |
| Link de confirmação válido | "Conta confirmada! Faça login para continuar." |
| Link de confirmação expirado | "Este link de confirmação expirou. Solicite um novo e-mail de confirmação." |
| Link de confirmação já utilizado | "Este link de confirmação já foi utilizado." |
| Login com credenciais inválidas | "E-mail ou senha incorretos." |
| Conta não confirmada tentando login | "Sua conta ainda não foi confirmada. Verifique seu e-mail." |
| Sessão expirada (refresh token inválido) | "Sua sessão expirou. Faça login novamente." |

---

#### Integrações

| Sistema externo | O que é enviado | O que é recebido | Em caso de falha |
|---|---|---|---|
| Gmail via SMTP do Google (Nodemailer com App Password) | Nome do destinatário, e-mail de destino, link de confirmação com token, template HTML da CatDog | Confirmação de entrega da mensagem | Registrar falha internamente; permitir que o usuário solicite reenvio do e-mail de confirmação manualmente |

---

### Requisitos Não Funcionais

| ID | Tipo | Requisito | Critério mensurável |
|---|---|---|---|
| RNF-01 | Segurança | Senhas armazenadas apenas como hash | 100% das senhas persistidas devem ser hash irreversível — verificável por auditoria do banco |
| RNF-02 | Segurança | Refresh token de uso único com rotação | Nenhum refresh token pode ser reutilizado após ser trocado — verificável por teste automatizado |
| RNF-03 | Segurança | Mensagens de erro no login não revelam existência de e-mail | A mensagem retornada deve ser idêntica para e-mail inexistente e senha incorreta |
| RNF-04 | Desempenho | Resposta do login percebida como imediata pelo usuário | O usuário completa o login e é redirecionado em menos de 3 segundos em conexão padrão |
| RNF-05 | Acessibilidade | Formulários navegáveis por teclado | Todos os campos e botões do fluxo de registro e login podem ser acessados e submetidos sem uso de mouse |
| RNF-06 | Usabilidade | E-mail de confirmação com identidade visual da CatDog | O e-mail exibido usa o template com cores roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito — verificável visualmente |

---

### O que Não Deve Ser Feito

- Esta feature não implementa login social (Google, Facebook, GitHub ou similares).
- Esta feature não implementa recuperação de senha — será escopo de feature futura.
- Esta feature não realiza o gerenciamento de usuários pelo painel administrativo (CRUD de usuários) — é escopo de feature separada.
- Esta feature não define autorização granular por permissão — apenas por role (`admin` / `cliente`).
- O campo "confirmação de senha" não deve ser enviado ao servidor — a validação ocorre exclusivamente no cliente.
- Não implementar múltiplas sessões simultâneas com controle por dispositivo — fora do escopo desta entrega.

---

## Grupo 4 — Validação

### Casos de Teste

| ID | Cenário | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CT-01 | Registro com todos os campos válidos e e-mail novo | Nome: "Ana Silva", E-mail: "ana@exemplo.com", Senha: "Senha123!", Confirmação: "Senha123!" | Conta criada, e-mail de confirmação enviado, tela de verificação exibida | Positivo |
| CT-02 | Registro com e-mail já existente | E-mail já cadastrado | Mensagem "Este e-mail já está em uso." exibida | Negativo |
| CT-03 | Registro com senhas diferentes | Senha: "Abc12345", Confirmação: "abc12345" | Mensagem "As senhas não coincidem." exibida | Negativo |
| CT-04 | Registro com senha de 7 caracteres | Senha: "Abc1234" | Mensagem "A senha deve ter pelo menos 8 caracteres." | Borda |
| CT-05 | Registro com campo Nome em branco | Nome: "" | Mensagem "Este campo é obrigatório." no campo Nome | Negativo |
| CT-06 | Confirmação de conta com link válido | Link com token válido e não expirado | Conta ativada, mensagem "Conta confirmada! Faça login para continuar." | Positivo |
| CT-07 | Confirmação com link expirado (mais de 24h) | Link com token expirado | Mensagem "Este link de confirmação expirou." exibida | Negativo |
| CT-08 | Confirmação com link já utilizado | Link com token já consumido | Mensagem "Este link de confirmação já foi utilizado." exibida | Negativo |
| CT-09 | Login com credenciais corretas e role `admin` | E-mail e senha válidos, role `admin` | Redirecionamento para painel administrativo com layout de admin | Positivo |
| CT-10 | Login com credenciais corretas e role `cliente` | E-mail e senha válidos, role `cliente` | Redirecionamento para área do cliente com layout de cliente | Positivo |
| CT-11 | Login com senha incorreta | Senha errada para e-mail válido | Mensagem "E-mail ou senha incorretos." exibida | Negativo |
| CT-12 | Login com e-mail inexistente | E-mail não cadastrado | Mensagem "E-mail ou senha incorretos." exibida (mesma mensagem que CT-11) | Negativo |
| CT-13 | Login com conta não confirmada | Conta com status "pendente de confirmação" | Mensagem "Sua conta ainda não foi confirmada. Verifique seu e-mail." | Negativo |
| CT-14 | Renovação de sessão com refresh token válido | Refresh token não expirado e não utilizado | Novo access token e novo refresh token emitidos; token anterior invalidado | Positivo |
| CT-15 | Tentativa de reutilização de refresh token rotacionado | Refresh token já usado anteriormente | Sessão encerrada; usuário redirecionado para login com mensagem "Sua sessão expirou." | Negativo |
| CT-16 | Acesso de `cliente` a rota de `admin` | Usuário autenticado com role `cliente` tentando acessar rota de admin | Redirecionamento para área do cliente, conteúdo administrativo não exibido | Negativo |
| CT-17 | Acesso de usuário não autenticado a rota protegida | Sem token de sessão | Redirecionamento para tela de login | Negativo |
| CT-18 | Registro com senha exatamente 8 caracteres | Senha: "Abc12345" | Conta criada normalmente | Borda |

---

### Critérios de Aceite

**Comportamento e entrega:**
- [ ] CA-01: O sistema cria a conta com status "pendente de confirmação" após registro com dados válidos e exibe a mensagem de verificação de e-mail.
- [ ] CA-02: O sistema envia o e-mail de confirmação com o template visual CatDog (roxo, laranja, fonte Nunito) ao e-mail informado no registro.
- [ ] CA-03: O link de confirmação ativa a conta quando válido e exibe mensagem de erro adequada quando expirado ou já utilizado.
- [ ] CA-04: O login com credenciais corretas redireciona o usuário para a área correspondente à sua role em menos de 3 segundos.
- [ ] CA-05: O login com credenciais inválidas exibe "E-mail ou senha incorretos." sem indicar qual campo está errado, independentemente de o e-mail existir ou não.
- [ ] CA-06: O login é bloqueado para contas com status "pendente de confirmação".
- [ ] CA-07: A renovação de sessão emite novo par de tokens e invalida o refresh token anterior a cada renovação.
- [ ] CA-08: A reutilização de um refresh token já rotacionado encerra a sessão do usuário.
- [ ] CA-09: Usuário `admin` acessa o painel administrativo com layout diferenciado de gestão.
- [ ] CA-10: Usuário `cliente` acessa a área do cliente com layout próprio, sem acesso a controles administrativos.
- [ ] CA-11: Tentativa de acesso a rota de outra role redireciona o usuário para sua própria área sem exibir o conteúdo restrito.
- [ ] CA-12: Usuário não autenticado tentando acessar rota protegida é redirecionado para a tela de login.
- [ ] CA-13: Senhas são armazenadas exclusivamente como hash — nenhuma senha em texto plano deve existir no banco.

**Regressão:**
- [ ] Não há features anteriores implementadas — esta é a feature inaugural. Sem impacto de regressão neste momento.

**Qualidade de código (SonarQube):**
- [ ] Quality Gate aprovado sem bloqueadores
- [ ] Cobertura de testes: mínimo de 80% nas classes alteradas
- [ ] Zero issues de segurança (Severity: Blocker ou Critical)

---

### Critério de Sucesso da Feature

| Métrica | Baseline atual | Meta após entrega | Como será medida |
|---|---|---|---|
| Usuários que completam o registro e confirmam e-mail | 0 (feature inexistente) | Mais de 90% dos usuários que iniciam o registro completam a confirmação | Registro de eventos de criação de conta e ativação |
| Usuários que fazem login sem contato com suporte | 0 (feature inexistente) | 100% dos logins bem-sucedidos sem necessidade de suporte | Ausência de chamados relacionados a problemas de acesso |
| Sessões expiradas por uso indevido de refresh token | 0 (feature inexistente) | 0 sessões comprometidas por reutilização de refresh token | Auditoria de logs de tentativas de reutilização de token |

---

## Grupo 5 — Estimativa

> Preencha após o escopo completo estar definido e revisado.

**Use Points gerados:** _A preencher_
**Estimativa de custo:** _A preencher_
