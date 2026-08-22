# ADR-001 — Administrador único provisionado por seed, com senha em hash

**Status**: Aceito
**Data**: 2026-08-22
**Contexto de origem**: TASK-BACKEND-006 (`.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/tasks/task_006_backend_authorization_seed_ratelimit.md`)
**Decisores**: implementação da FEATURE-002 (autenticação completa)

---

## Contexto

`.makuco/architecture/tech_restrictions_context.md` registra duas entradas que, lidas ao pé da letra, conflitam com o modelo de autenticação da FEATURE-002:

- Restrição de ambiente **"Apenas um administrador"**: *"A empresa tem um único usuário administrativo fixo, sem gestão de múltiplos perfis"* → *"A autenticação pode ser simples, sem cadastro de usuários ou hierarquias de acesso"*.
- Decisão não reversível **"Login fixo para o administrador"**: *"Criar gestão completa de usuários seria excesso de complexidade para o caso de uso atual"*.

A expressão "login fixo" admite uma leitura literal — credenciais embutidas em configuração e comparadas em texto, sem tabela de usuários — que é incompatível com o que a spec da feature exige:

- **RN-08**: todo usuário tem exatamente uma role (`admin` ou `cliente`);
- **RN-10**: a verificação de permissão acontece no servidor;
- **RNF-01 / CA-13**: senhas armazenadas **exclusivamente** como hash irreversível, verificável por auditoria do banco;
- o auto-registro de clientes já exige a tabela `users`, com `role` e `status`.

## Decisão

O administrador é um **registro real na tabela `users`**, com `role = ADMIN`, `status = ACTIVE`, `emailConfirmedAt` preenchido e senha persistida **apenas** como hash bcrypt (custo 12, mesmo `hashPassword` do registro de clientes).

Esse registro é criado **exclusivamente** por `services/backend/prisma/seed.ts` (`npm run db:seed`), a partir de `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`. O script é idempotente (`upsert` pela coluna única `email`), aborta com mensagem explícita se qualquer uma das duas variáveis faltar, e não embute senha padrão no código.

Continua valendo, e é o que preserva o espírito da restrição:

- **não existe cadastro de administrador**: o auto-registro sempre produz `CLIENTE` (default do schema, e `role` não é parâmetro de `UserRepository.create`);
- **não existe promoção de usuário**: nenhum endpoint da feature aceita `role` em corpo, query ou parâmetro de caminho;
- **não existe gestão de usuários**: sem CRUD, sem convite, sem hierarquia de permissões — só duas roles fixas;
- o administrador não passa pelo fluxo de confirmação por e-mail: é provisionamento operacional, não cadastro.

## Alternativas consideradas

1. **Credenciais em variável de ambiente, comparadas em texto, sem registro no banco** ("login fixo" literal). Rejeitada: viola RNF-01/CA-13 (a senha existiria em texto na configuração e nos logs de deploy), impediria o `authenticate`/`authorizeRole` de tratar admin e cliente pelo mesmo mecanismo (seriam dois caminhos de autenticação em paralelo, um deles sem hash, sem sessão e sem rotação de refresh token) e deixaria o administrador sem `id`, o que quebra a chave estrangeira de qualquer registro futuro que precise apontar para quem executou uma ação.
2. **Endpoint administrativo de promoção de usuário a `admin`.** Rejeitada: cria exatamente a "gestão completa de usuários" que a decisão de arquitetura proíbe, e abre a superfície de escalonamento de privilégio que a task fecha.
3. **Hash da senha do admin gerado à mão e colado em uma variável de ambiente.** Rejeitada: satisfaz RNF-01, mas transfere para o operador a geração do hash (custo bcrypt errado passa silenciosamente) e ainda deixa o admin fora da tabela, com as mesmas consequências da alternativa 1.

## Consequências

**Positivas**

- Um único mecanismo de autenticação e de autorização para as duas roles: mesma verificação de senha, mesmo access token, mesma rotação de refresh token, mesma guarda de rota no servidor (RN-10).
- RNF-01 / CA-13 atendidos sem exceção: auditando `users.password_hash` não há uma linha em texto plano.
- Trocar a senha do administrador é reexecutar o seed; o script é autoritativo e reafirma senha, role e status.

**Negativas / a vigiar**

- `SEED_ADMIN_PASSWORD` passa pelo ambiente de execução do seed. Ela **não** vai para o `.env` versionado (o arquivo está no `.gitignore`) e não é impressa pelo script, mas quem roda o seed vê a senha no histórico do shell se a passar inline.
- Nada no banco impede fisicamente um segundo `ADMIN` (não há constraint parcial de unicidade por role). O seed **detecta e avisa** quando encontra outro administrador, mas não apaga nem rebaixa ninguém — decisão destrutiva não pertence a um script de provisionamento. Se a unicidade precisar ser garantida pelo banco, o caminho é um índice único parcial (`CREATE UNIQUE INDEX ... WHERE role = 'ADMIN'`), que exigiria migration própria e não foi feito nesta task.
- O texto da restrição continua dizendo "login fixo". Este ADR é o registro de que a implementação divergiu da letra e por quê; a leitura correta da restrição passa a ser "um único administrador, provisionado por operação, sem cadastro nem gestão de usuários".
