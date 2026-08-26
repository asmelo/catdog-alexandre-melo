# FEATURE-001 — Cadastro de Espécies (área administrativa)

---

## Grupo 1 — Identificação

**Feature:** FEATURE-001 — Cadastro de Espécies (criar, listar, renomear e excluir espécies na área administrativa)
**Módulo:** MODULE-002 — Catálogo de pets
**Status:** Rascunho
**Criado por:** Makuco Specify Agent — 2026-08-25
**Aprovado por:** _A preencher_

---

## Objetivo da Feature

O catálogo de pets da CatDog precisa classificar cada animal por espécie, e hoje essa informação não existe em lugar nenhum do sistema. Esta feature entrega ao administrador uma tela dedicada onde ele mantém a lista de espécies aceitas pela plataforma — criando, renomeando e excluindo entradas — de forma que o cadastro de animais e, mais adiante, os filtros da vitrine pública passem a escolher de uma lista controlada em vez de texto livre. O valor direto é consistência: sem uma lista única, "Gato", "gato" e "Felino" conviveriam no catálogo e quebrariam qualquer filtro, contagem ou agrupamento. O beneficiário imediato é o administrador; o beneficiário final é o cliente, que só encontra o pet que procura se a classificação for confiável.

---

## Grupo 2 — Contexto

### Quem Acessa

| Perfil / Permissão | Nível de acesso | Observação |
|---|---|---|
| admin | Total (criar, listar, renomear, excluir) | Único perfil autorizado. A verificação de permissão que vale é a do servidor; o guard de rota do frontend é conveniência de navegação |
| cliente | Nenhum | Usuário autenticado com role `cliente` que tente acessar a tela é redirecionado para a sua própria área; a API recusa a chamada |
| Visitante (não autenticado) | Nenhum | Redirecionado para a tela de login; a API recusa a chamada |

---

### Premissas

- A FEATURE-002 (Autenticação Completa) está implementada e funcional: existem sessão, roles `admin` / `cliente`, guard de rota por role no frontend e verificação de permissão no servidor.
- O usuário já está autenticado como `admin` ao acessar esta funcionalidade.
- O banco Supabase (PostgreSQL, acesso via Prisma) já está configurado e recebendo migrations — a migration inaugural do projeto já foi aplicada.
- O envelope de erro da API já está congelado pela FEATURE-002 no formato `{ error: { code, message, details? } }` e esta feature não o altera.
- A área administrativa já existe como layout próprio, com navegação e ação de sair.
- O volume esperado de espécies é da ordem de dezenas de registros, nunca milhares — é uma tabela de apoio, não um cadastro de massa.
- A entidade **Animal** ainda não existe no sistema; ela é entregue pela feature seguinte deste mesmo módulo. Esta spec define desde já o comportamento da exclusão de espécie referenciada por animais, para que a regra não precise ser retroencaixada depois.

---

### Dependências

| Dependência | Tipo | Status | Impacto se não resolvida |
|---|---|---|---|
| FEATURE-002 — Autenticação Completa (sessão, role `admin`, verificação de permissão no servidor) | FEATURE-002 | Resolvida | Sem ela não há como restringir a tela ao administrador — a feature inteira fica exposta |
| Layout administrativo com navegação lateral | Decisão de interface (desta spec) | Pendente — entregue por esta feature | Sem o item de navegação, a tela existe mas não é alcançável pela interface |
| Componentes de lista, de confirmação de ação destrutiva e de aviso de sucesso | Base de componentes de interface | Pendente — criados por esta feature | Nenhum deles existe hoje; sem eles não há como exibir a lista nem confirmar a exclusão |
| Entidade Animal com vínculo obrigatório a Espécie | Feature seguinte do MODULE-002 | Pendente | Enquanto não existir, a regra de bloqueio de exclusão (RN-08) não tem o que barrar na prática; a guarda precisa nascer junto com o vínculo, sob pena de animais órfãos |
| Banco Supabase com migrations aplicadas | Infraestrutura | Resolvida | Impede a persistência das espécies |

---

### Referências e Insumos

**Protótipo / Wireframe:**
- Arquivo local: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/assets/current-state-admin-especies.png` — captura de tela da aplicação exibida em reunião, usada como fonte da verdade do layout desta feature.

**Prints de referência (estado atual):**
- Mesmo arquivo acima. Na captura, uma janela de vídeo, a barra do navegador, a barra de favoritos e um pop-up de notificação do sistema operacional sobrepõem parte da tela — nenhum deles faz parte do produto. O pop-up cobre a **primeira linha da lista de espécies**, cujo conteúdo é, portanto, desconhecido; as linhas legíveis são "Gato" e "Sapo".

**O que a captura estabelece como contrato de interface:**

| Elemento | Conteúdo observado |
|---|---|
| Navegação lateral | Dois itens: "Animais" e "Espécies", com "Espécies" em estado ativo (destaque roxo) |
| Título da página | "Espécies" |
| Linha de criação | Campo de texto com placeholder "Nome de espécie" seguido do botão "Criar" à direita |
| Lista | Uma linha por espécie: nome à esquerda; dois ícones à direita — lápis (editar) e lixeira (excluir) |
| Edição | Ocorre na própria linha (edição em linha), sem tela ou janela intermediária |
| Ordenação observada | "Gato" antes de "Sapo" — compatível com ordenação alfabética crescente |

**Divergências entre a captura e o estado atual da aplicação — e como esta spec as resolve:**

| Ponto | Estado atual implementado | Captura | Decisão desta spec |
|---|---|---|---|
| Arranjo da navegação administrativa | Barra horizontal no topo da área administrativa | Navegação lateral à esquerda | Adotar a navegação lateral da captura |
| Itens da navegação | Um único item, "Painel", apontando para a home administrativa | Dois itens: "Animais" e "Espécies" | Adotar "Animais" e "Espécies". O item "Painel" é aposentado da navegação |
| Destino do endereço `/admin` | Página inicial administrativa, e destino do redirecionamento por role após o login | Não representado na captura | `/admin` continua respondendo e passa a redirecionar para a primeira área administrativa disponível. Enquanto a feature de animais não existir, redireciona para a tela de espécies. Isto preserva o redirecionamento pós-login por role entregue pela FEATURE-002 |
| Endereço da tela | `/admin/species` | — | `/admin/especies`, por coerência com os demais caminhos de interface do produto, todos em PT-BR |

Todas as quatro decisões estão registradas no changelog desta feature.

**Componentes de interface ainda inexistentes no projeto:** a base de componentes reutilizáveis atual cobre apenas formulários de autenticação (campo de texto, campo de senha, erro de campo, alerta, botão de envio). **Não existem** componentes de lista/tabela, de confirmação de ação destrutiva, nem de aviso temporário de sucesso. Esta feature precisa criá-los, e eles serão reaproveitados pelas features seguintes do módulo.

**Artefatos consultados:**
- `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md` — convenções de numeração de RN/CA/RNF, formato de mensagens e critérios de aceite
- `.makuco/product/scope_features_context.md` — módulo "Catálogo de pets" e a feature "Cadastro de pets com dados internos e de vitrine", consumidora direta desta
- `.makuco/overview/glossary_context.md` — termos "Pet", "Administrador", "Vitrine"
- `.makuco/resources/reference.html` — identidade visual CatDog (roxo `#7c3aed`, laranja `#e05a1e`, fonte Nunito)
- `MAKUCO.md` e `.makuco/codebase/` — stack, arquitetura em camadas, regras de código

**Tabelas de banco de dados:** `species` (nova, definida nesta spec). A tabela `animals`, da feature seguinte, passará a referenciá-la.
**MCPs utilizados:** Não aplicável nesta feature
**SKILLs utilizados:** Não aplicável nesta feature

---

### Termos Novos no Glossário

| Termo | Definição | Evitar |
|---|---|---|
| Espécie | Classificação biológica do pet, mantida pelo administrador em lista controlada e usada para categorizar animais no catálogo e na vitrine. Exemplos: Gato, Cachorro, Sapo. | Raça (a raça é subdivisão da espécie e não é escopo desta feature), tipo, categoria |

---

## Grupo 3 — Comportamento

### Histórias de Usuário

---

#### HU-01 — Acessar a área de espécies

O administrador autenticado encontra o item "Espécies" na navegação da área administrativa e o aciona. A aplicação exibe a tela de espécies com o título "Espécies", a linha de criação e a lista das espécies já cadastradas. O item acionado fica visivelmente marcado como ativo na navegação. Quem não é administrador não alcança a tela.

**Pode ser testada independentemente:** Sim — basta autenticar como `admin` e verificar que o item de navegação existe, leva à tela e fica marcado como ativo; depois autenticar como `cliente` e verificar o redirecionamento; depois chamar a mesma rota sem sessão e verificar o redirecionamento para o login.

**Cenários de aceite:**

1. **Dado** que o usuário está autenticado com role `admin`, **quando** aciona o item "Espécies" na navegação administrativa, **então** a tela de espécies é exibida com o título "Espécies" e o item fica marcado como ativo.
2. **Dado** que o usuário está autenticado com role `cliente`, **quando** tenta acessar o endereço da tela de espécies, **então** é redirecionado para a sua própria área e nenhum conteúdo da tela administrativa é exibido.
3. **Dado** que não há sessão ativa, **quando** o endereço da tela de espécies é acessado, **então** o usuário é redirecionado para a tela de login.
4. **Dado** que o administrador está na tela de espécies, **quando** observa a navegação lateral, **então** vê também o item "Animais", que pertence à feature seguinte do módulo.
5. **Dado** que o usuário acabou de fazer login com role `admin`, **quando** é redirecionado para a área administrativa, **então** chega a uma tela administrativa funcional, sem página em branco e sem erro de rota não encontrada.

---

#### HU-02 — Criar espécie

O administrador digita o nome da espécie no campo com placeholder "Nome de espécie" e aciona "Criar". O sistema valida e grava a espécie, limpa o campo, informa o sucesso e passa a exibir a nova espécie na lista, já na posição alfabética correta.

**Pode ser testada independentemente:** Sim — basta abrir a tela, criar uma espécie com nome válido e verificar que ela aparece na lista e persiste após recarregar a página.

**Cenários de aceite:**

1. **Dado** que o campo contém um nome válido ainda não cadastrado, **quando** o administrador aciona "Criar", **então** a espécie é criada, o campo é limpo, a mensagem "Espécie criada com sucesso." é exibida e a espécie aparece na lista em ordem alfabética.
2. **Dado** que o campo está vazio ou contém apenas espaços, **quando** o administrador aciona "Criar", **então** a mensagem "Este campo é obrigatório." é exibida junto ao campo e nada é criado.
3. **Dado** que o campo contém um único caractere, **quando** o administrador aciona "Criar", **então** a mensagem "O nome da espécie deve ter no mínimo 2 caracteres." é exibida e nada é criado.
4. **Dado** que o campo contém mais de 60 caracteres, **quando** o administrador aciona "Criar", **então** a mensagem "O nome da espécie deve ter no máximo 60 caracteres." é exibida e nada é criado.
5. **Dado** que já existe a espécie "Gato", **quando** o administrador tenta criar "gato", "GATO" ou " Gato ", **então** a mensagem "Já existe uma espécie com este nome." é exibida, nada é criado e a lista permanece inalterada.
6. **Dado** que o administrador digitou " Cão   Pastor " com espaços nas extremidades e espaços repetidos no meio, **quando** aciona "Criar", **então** a espécie é gravada como "Cão Pastor".
7. **Dado** que a requisição de criação está em andamento, **quando** o administrador aciona "Criar" novamente, **então** o segundo acionamento é ignorado e apenas uma espécie é criada.

---

#### HU-03 — Listar espécies

Ao abrir a tela, o administrador vê todas as espécies cadastradas, uma por linha, em ordem alfabética, cada uma com o seu nome e as ações de editar e excluir. Quando não há nenhuma espécie, a tela informa isso explicitamente em vez de exibir uma área vazia sem explicação.

**Pode ser testada independentemente:** Sim — basta cadastrar espécies fora de ordem alfabética, abrir a tela e verificar a ordem e a presença das ações em cada linha; depois esvaziar o cadastro e verificar a mensagem de lista vazia.

**Cenários de aceite:**

1. **Dado** que existem as espécies "Sapo", "Gato" e "Cachorro", **quando** o administrador abre a tela, **então** elas são exibidas na ordem "Cachorro", "Gato", "Sapo".
2. **Dado** que existem as espécies "gato" e "Cachorro", **quando** a lista é exibida, **então** a ordenação ignora maiúsculas e minúsculas e "Cachorro" aparece antes de "gato".
3. **Dado** que não existe nenhuma espécie cadastrada, **quando** o administrador abre a tela, **então** a mensagem "Nenhuma espécie cadastrada ainda. Crie a primeira acima." é exibida e a linha de criação continua disponível.
4. **Dado** que a lista está sendo carregada, **quando** a tela é aberta, **então** um indicador de carregamento é exibido no lugar da lista, sem que a linha de criação desapareça.
5. **Dado** que a consulta à lista falha, **quando** a tela é aberta, **então** a mensagem "Não foi possível carregar as espécies. Tente novamente." é exibida com a possibilidade de nova tentativa.
6. **Dado** que existem espécies cadastradas, **quando** a lista é exibida, **então** cada linha apresenta o nome da espécie e as duas ações — editar e excluir.

---

#### HU-04 — Renomear espécie

O administrador aciona o ícone de lápis de uma linha. A linha passa para o modo de edição, exibindo o nome atual em um campo editável com as ações de salvar e cancelar. Ao salvar, o novo nome é validado e gravado; ao cancelar, nada muda. A edição acontece na própria linha, sem janela ou tela intermediária.

**Pode ser testada independentemente:** Sim — basta criar uma espécie, renomeá-la e verificar que o novo nome persiste após recarregar a página e que o identificador da espécie não mudou.

**Cenários de aceite:**

1. **Dado** que a lista exibe a espécie "Sapo", **quando** o administrador aciona o lápis daquela linha, **então** a linha entra em modo de edição com o campo já preenchido com "Sapo" e o foco posicionado nele.
2. **Dado** que a linha está em edição e o administrador digitou um nome válido e não utilizado, **quando** salva, **então** o novo nome é gravado, a linha volta ao modo de exibição, a mensagem "Espécie atualizada com sucesso." é exibida e a lista é reordenada se necessário.
3. **Dado** que a linha está em edição, **quando** o administrador cancela, **então** a linha volta ao modo de exibição com o nome original e nada é gravado.
4. **Dado** que a linha está em edição, **quando** o administrador limpa o campo e salva, **então** a mensagem "Este campo é obrigatório." é exibida, a linha permanece em edição e nada é gravado.
5. **Dado** que existem "Gato" e "Sapo", **quando** o administrador renomeia "Sapo" para "gato", **então** a mensagem "Já existe uma espécie com este nome." é exibida, a linha permanece em edição e nenhum dos dois registros é alterado.
6. **Dado** que a espécie se chama "Gato", **quando** o administrador salva o mesmo nome com outra caixa ("GATO") ou com espaços nas extremidades, **então** a operação é aceita como renomeação da própria espécie, sem erro de conflito.
7. **Dado** que outra pessoa excluiu a espécie enquanto a linha estava aberta em edição, **quando** o administrador salva, **então** a mensagem "Espécie não encontrada." é exibida e a lista é atualizada.
8. **Dado** que apenas uma linha pode estar em edição por vez, **quando** o administrador aciona o lápis de uma segunda linha, **então** a edição anterior é encerrada sem gravar e a nova linha entra em edição.

---

#### HU-05 — Excluir espécie sem animais vinculados

O administrador aciona o ícone de lixeira de uma linha. O sistema pede confirmação explícita, nomeando a espécie e avisando que a ação não pode ser desfeita. Confirmada a exclusão, a espécie deixa de existir e some da lista.

**Pode ser testada independentemente:** Sim — basta criar uma espécie sem vínculos, excluí-la e verificar que ela some da lista e não retorna após recarregar a página.

**Cenários de aceite:**

1. **Dado** que a lista exibe uma espécie sem animais vinculados, **quando** o administrador aciona a lixeira, **então** uma confirmação é exibida com o texto "Excluir a espécie “{nome}”? Esta ação não pode ser desfeita."
2. **Dado** que a confirmação está sendo exibida, **quando** o administrador confirma, **então** a espécie é excluída, some da lista e a mensagem "Espécie excluída com sucesso." é exibida.
3. **Dado** que a confirmação está sendo exibida, **quando** o administrador cancela, **então** nenhuma ação é executada e a espécie permanece na lista.
4. **Dado** que outra pessoa já excluiu a mesma espécie, **quando** o administrador confirma a exclusão, **então** a mensagem "Espécie não encontrada." é exibida e a lista é atualizada.
5. **Dado** que a exclusão foi concluída, **quando** o administrador recarrega a página, **então** a espécie continua ausente da lista.

---

#### HU-06 — Bloqueio de exclusão de espécie com animais vinculados

O administrador tenta excluir uma espécie que já classifica pelo menos um animal cadastrado. O sistema recusa a operação com uma mensagem explícita, não remove a espécie e não toca em nenhum animal. Não existe exclusão em cascata: animais nunca são apagados nem ficam sem espécie por causa desta tela.

**Pode ser testada independentemente:** Sim — basta ter uma espécie referenciada por ao menos um animal, tentar excluí-la e verificar que a espécie continua existindo, que a contagem de animais não muda e que nenhum animal ficou sem espécie.

**Cenários de aceite:**

1. **Dado** que existe pelo menos um animal vinculado à espécie "Gato", **quando** o administrador confirma a exclusão de "Gato", **então** a mensagem "Não é possível excluir esta espécie porque existem animais vinculados a ela." é exibida e a espécie permanece na lista.
2. **Dado** que a exclusão foi recusada por vínculo, **quando** o administrador consulta os animais, **então** nenhum animal foi removido, desvinculado ou alterado.
3. **Dado** que o administrador removeu todos os animais vinculados a "Gato", **quando** tenta excluir "Gato" novamente, **então** a exclusão é concluída normalmente.
4. **Dado** que a exclusão é solicitada diretamente à API, sem passar pela tela, **quando** existem animais vinculados, **então** a operação é recusada da mesma forma — a proteção não depende da interface.

---

### Regras de Negócio

- **RN-01:** Apenas usuários autenticados com role `admin` podem criar, listar, renomear ou excluir espécies. A verificação de permissão que vale é a do servidor; o controle de rota do frontend existe apenas como conveniência de navegação e não protege nada.
- **RN-02:** O nome da espécie é obrigatório e, depois de removidos os espaços das extremidades, deve ter no mínimo 2 e no máximo 60 caracteres.
- **RN-03:** O nome é gravado **como digitado** quanto a maiúsculas, minúsculas e acentos, aplicando-se apenas duas normalizações de forma: remoção dos espaços das extremidades e colapso de sequências de espaços internos em um único espaço. "  Cão   Pastor " é gravado como "Cão Pastor".
- **RN-04:** Não podem existir duas espécies com o mesmo nome. A comparação de unicidade é **insensível a maiúsculas e minúsculas** e feita sobre o nome já normalizado pela RN-03: "Gato", "gato", "GATO" e " Gato " são o mesmo nome.
- **RN-05:** A comparação de unicidade é **sensível a acentos**: "Réptil" e "Reptil" são nomes distintos e podem coexistir. Decisão tomada para manter a regra determinística e verificável sem depender de configuração de collation do banco.
- **RN-06:** A tentativa de criar uma espécie com nome já existente é recusada com erro de conflito explícito. Nada é criado e a lista permanece inalterada.
- **RN-07:** Renomear uma espécie para um nome que, pela comparação da RN-04, é o seu **próprio nome atual** é operação válida e não caracteriza conflito — é assim que o administrador corrige apenas a caixa das letras ("gato" para "Gato").
- **RN-08:** **Uma espécie referenciada por pelo menos um animal não pode ser excluída.** A operação é recusada com erro explícito, a espécie permanece cadastrada e nenhum animal é removido, desvinculado ou alterado. **Não existe exclusão em cascata de animais a partir da exclusão de espécie, em nenhuma hipótese.**
- **RN-09:** A verificação da RN-08 acontece no servidor e é reforçada pela integridade referencial do banco de dados, que recusa a remoção de uma espécie ainda referenciada. As duas camadas são obrigatórias: a verificação da aplicação existe para produzir a mensagem correta ao usuário, e a restrição do banco existe para que uma falha de código não consiga produzir um animal sem espécie.
- **RN-10:** A exclusão de espécie sem vínculos é definitiva. Não há inativação, arquivamento nem lixeira, e o registro não é recuperável pela aplicação.
- **RN-11:** A listagem devolve **todas** as espécies cadastradas, ordenadas alfabeticamente de forma crescente pelo nome, ignorando maiúsculas e minúsculas.
- **RN-12:** A listagem não é paginada nem filtrada. O volume esperado é de dezenas de registros e paginar uma lista desse tamanho só acrescentaria passos ao administrador.
- **RN-13:** A espécie possui exatamente um atributo de negócio: o nome. Qualquer outro dado (descrição, imagem, porte, ordem de exibição) está fora do escopo desta feature.
- **RN-14:** Operações de renomeação ou exclusão sobre uma espécie inexistente são recusadas como "não encontrada", sem distinguir se o registro nunca existiu ou se já foi excluído.
- **RN-15:** O identificador da espécie é estável: renomear não o altera, e o identificador de uma espécie excluída nunca é reaproveitado por outra.
- **RN-16:** A garantia de unicidade da RN-04 é assegurada por restrição do próprio banco de dados, e não apenas por consulta prévia. Duas criações simultâneas do mesmo nome resultam em exatamente uma espécie criada e uma recusa por conflito.

---

### Requisitos Funcionais

#### O que o sistema exibe ao ser acessado

A tela de espécies é uma página da área administrativa, alcançada pelo item "Espécies" da navegação administrativa. Ao ser aberta, ela exibe:

1. **Navegação administrativa lateral**, à esquerda do conteúdo, com os itens "Animais" e "Espécies", sendo "Espécies" marcado como o item ativo enquanto esta tela está aberta. O item "Animais" pertence à feature seguinte do módulo — ele é exibido na navegação, mas o conteúdo da tela de animais não é escopo desta spec. O endereço `/admin`, destino do redirecionamento por role após o login, continua respondendo e leva o administrador à primeira área administrativa disponível.
2. **Título da página:** "Espécies".
3. **Linha de criação:** um campo de texto com o placeholder "Nome de espécie", seguido à direita pelo botão "Criar".
4. **Lista de espécies:** uma linha por espécie cadastrada, ordenada alfabeticamente. Cada linha exibe o nome à esquerda e, à direita, duas ações representadas por ícones — lápis (editar) e lixeira (excluir).
5. **Estado de carregamento:** enquanto a lista é buscada, um indicador de carregamento ocupa o lugar da lista. A linha de criação permanece visível.
6. **Estado vazio:** quando não existe nenhuma espécie, a mensagem "Nenhuma espécie cadastrada ainda. Crie a primeira acima." ocupa o lugar da lista.
7. **Estado de falha de carregamento:** quando a consulta falha, a mensagem "Não foi possível carregar as espécies. Tente novamente." é exibida com a ação de tentar novamente.

#### Ações disponíveis

**Ação 1 — Criar espécie**

O administrador preenche o campo "Nome de espécie" e aciona "Criar".

Regras condicionais:
- Se o nome for válido e ainda não existir → a espécie é criada, o campo é limpo e volta a receber o foco, a mensagem "Espécie criada com sucesso." é exibida e a lista é atualizada com a nova espécie na posição alfabética correta.
- Se o campo estiver vazio ou contiver apenas espaços → exibe "Este campo é obrigatório." e nada é criado.
- Se o nome tiver menos de 2 caracteres após a normalização → exibe "O nome da espécie deve ter no mínimo 2 caracteres." e nada é criado.
- Se o nome tiver mais de 60 caracteres após a normalização → exibe "O nome da espécie deve ter no máximo 60 caracteres." e nada é criado.
- Se já existir espécie com o mesmo nome pela comparação da RN-04 → exibe "Já existe uma espécie com este nome.", mantém o texto digitado no campo e não altera a lista.
- Enquanto a criação estiver em andamento → o botão "Criar" fica desabilitado, impedindo submissão duplicada.

**Ação 2 — Entrar em modo de edição de uma linha**

O administrador aciona o ícone de lápis de uma linha.

Regras condicionais:
- Se nenhuma outra linha estiver em edição → a linha entra em edição, exibindo o nome atual em campo editável, com foco no campo e com as ações de salvar e cancelar no lugar dos ícones de lápis e lixeira.
- Se outra linha já estiver em edição → a edição anterior é encerrada sem gravar e a nova linha entra em edição.

**Ação 3 — Salvar renomeação**

O administrador confirma a edição da linha.

Regras condicionais:
- Se o nome for válido e não pertencer a outra espécie → o novo nome é gravado, a linha volta ao modo de exibição, exibe "Espécie atualizada com sucesso." e a lista é reordenada se necessário.
- Se o nome for, pela comparação da RN-04, o próprio nome atual da espécie → a operação é aceita normalmente (RN-07).
- Se o nome estiver vazio, curto demais ou longo demais → exibe a mensagem de validação correspondente, mantém a linha em edição e não grava.
- Se o nome pertencer a outra espécie → exibe "Já existe uma espécie com este nome.", mantém a linha em edição e não grava.
- Se a espécie não existir mais → exibe "Espécie não encontrada." e a lista é recarregada.
- Enquanto a gravação estiver em andamento → as ações de salvar e cancelar ficam desabilitadas.

**Ação 4 — Cancelar edição**

O administrador cancela a edição da linha.
- A linha volta ao modo de exibição com o nome original. Nenhuma ação é executada.

**Ação 5 — Excluir espécie**

O administrador aciona o ícone de lixeira de uma linha.

Regras condicionais:
- O sistema pede confirmação explícita com o texto "Excluir a espécie “{nome}”? Esta ação não pode ser desfeita."
  - Se cancelado: nenhuma ação é executada.
  - Se confirmado e a espécie não tiver animais vinculados → a espécie é excluída, some da lista e exibe "Espécie excluída com sucesso."
  - Se confirmado e a espécie tiver ao menos um animal vinculado → exibe "Não é possível excluir esta espécie porque existem animais vinculados a ela."; a espécie permanece na lista e **nenhum animal é alterado**.
  - Se confirmado e a espécie não existir mais → exibe "Espécie não encontrada." e a lista é recarregada.

---

#### Validações e Restrições

- O campo **Nome de espécie** é obrigatório, tanto na criação quanto na renomeação.
- O campo **Nome de espécie** aceita no mínimo 2 e no máximo 60 caracteres, contados após a remoção dos espaços das extremidades.
- O campo **Nome de espécie** aceita letras (com acentos), espaços, hífen e apóstrofo. Não há exigência de formato além dos limites de tamanho.
- Espaços nas extremidades são removidos e sequências de espaços internos são reduzidas a um único espaço antes de qualquer validação, gravação ou comparação.
- O botão "Criar" e as ações de salvar da edição em linha ficam desabilitados enquanto a respectiva requisição está em andamento.
- A tela inteira e cada uma das suas ações são acessíveis apenas ao perfil `admin`.
- Nenhum campo além do nome é aceito no corpo das requisições de criação e renomeação.
- A exclusão exige confirmação explícita do administrador — não há exclusão em um único acionamento.
- Apenas uma linha pode estar em modo de edição por vez.

---

#### Mensagens ao Usuário

| Condição | Mensagem |
|---|---|
| Espécie criada com sucesso | "Espécie criada com sucesso." |
| Espécie renomeada com sucesso | "Espécie atualizada com sucesso." |
| Espécie excluída com sucesso | "Espécie excluída com sucesso." |
| Campo obrigatório em branco | "Este campo é obrigatório." |
| Nome com menos de 2 caracteres | "O nome da espécie deve ter no mínimo 2 caracteres." |
| Nome com mais de 60 caracteres | "O nome da espécie deve ter no máximo 60 caracteres." |
| Nome já cadastrado (criação ou renomeação) | "Já existe uma espécie com este nome." |
| Espécie inexistente (renomeação ou exclusão) | "Espécie não encontrada." |
| Exclusão bloqueada por animais vinculados | "Não é possível excluir esta espécie porque existem animais vinculados a ela." |
| Confirmação antes de excluir | "Excluir a espécie “{nome}”? Esta ação não pode ser desfeita." |
| Lista vazia | "Nenhuma espécie cadastrada ainda. Crie a primeira acima." |
| Falha ao carregar a lista | "Não foi possível carregar as espécies. Tente novamente." |
| Acesso sem permissão (role `cliente` chamando a API) | "Você não tem permissão para acessar este recurso." _(texto já existente no sistema)_ |
| Sessão expirada | "Sua sessão expirou. Faça login novamente." _(texto já existente no sistema)_ |
| Falha inesperada | "Ocorreu um erro inesperado. Tente novamente." _(texto já existente no sistema)_ |

---

#### Integrações

Esta feature não consome nem alimenta nenhum sistema externo. Todo o comportamento é resolvido entre a interface administrativa, a API da própria aplicação e o banco de dados.

---

### Contrato de API

Todos os endpoints abaixo exigem sessão ativa e role `admin`. Todos respondem erro no envelope já congelado pela FEATURE-002:

```
{ "error": { "code": "STRING_ESTAVEL", "message": "texto em PT-BR", "details": [ { "field": "nome.do.campo", "message": "texto" } ] } }
```

O campo `details` só existe em falhas de validação. O frontend ramifica sempre por `code`, nunca comparando o texto de `message`.

**Convenção de caminho — decisão registrada:** as rotas da **API** seguem o vocabulário técnico em inglês já usado pela FEATURE-002 (`/api/auth/register`, `/api/auth/confirm-email`), portanto `/api/species`. As rotas da **interface** seguem o vocabulário PT-BR já usado em `ROUTE_PATHS` (`/cadastro`, `/minha-area`, `/confirmar-email`), portanto `/admin/especies`. A captura de tela mostra `/admin/species`, que diverge do padrão em vigor no produto; a spec adota `/admin/especies` por coerência. Decisão registrada no changelog desta feature.

**Representação da espécie** devolvida por todos os endpoints que retornam recurso:

```json
{
  "id": "6f6d2b4e-6f7e-4d3f-9c1a-1f2b3c4d5e6f",
  "name": "Gato",
  "createdAt": "2026-08-25T13:40:12.481Z",
  "updatedAt": "2026-08-25T13:40:12.481Z"
}
```

O nome normalizado usado internamente para garantir a unicidade **não é exposto** pela API — ele é detalhe de persistência, não informação de negócio.

---

#### `GET /api/species` — listar espécies

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Corpo da requisição | Nenhum |
| Parâmetros | Nenhum — sem paginação, sem filtro (RN-12) |
| Sucesso | `200 OK` |

Corpo de sucesso:

```json
{ "items": [ { "id": "…", "name": "Cachorro", "createdAt": "…", "updatedAt": "…" } ] }
```

Este é o **primeiro endpoint de coleção do projeto** — não existe precedente de listagem a copiar. O envelope `{ items: [...] }` é usado em vez de um array puro para que a lista possa ganhar metadados no futuro sem quebrar quem já a consome, e passa a ser o padrão de coleção para as features seguintes. Lista vazia responde `200` com `items: []` — nunca `404`.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| Sem sessão / token inválido ou vencido | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Sessão válida com role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |

---

#### `POST /api/species` — criar espécie

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Sucesso | `201 Created` com a espécie criada |

Corpo da requisição:

```json
{ "name": "Gato" }
```

Qualquer chave além de `name` é recusada com `400 VALIDATION_ERROR`, seguindo o mesmo tratamento de campo não previsto já adotado no registro de usuário.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| Nome ausente, vazio ou só com espaços | 400 | `VALIDATION_ERROR` | "Verifique os campos informados." + `details: [{ field: "name", message: "Este campo é obrigatório." }]` |
| Nome com menos de 2 caracteres | 400 | `VALIDATION_ERROR` | `details: [{ field: "name", message: "O nome da espécie deve ter no mínimo 2 caracteres." }]` |
| Nome com mais de 60 caracteres | 400 | `VALIDATION_ERROR` | `details: [{ field: "name", message: "O nome da espécie deve ter no máximo 60 caracteres." }]` |
| Campo não previsto no corpo | 400 | `VALIDATION_ERROR` | `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Nome já cadastrado (RN-04) | 409 | `SPECIES_NAME_ALREADY_EXISTS` | "Já existe uma espécie com este nome." |

O `409` é produzido tanto pela verificação prévia quanto pela violação da restrição de unicidade do banco (RN-16) — nas duas origens o `code` e a mensagem são idênticos, para que duas criações simultâneas do mesmo nome não gerem respostas diferentes.

---

#### `PATCH /api/species/:id` — renomear espécie

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetro de caminho | `id` — identificador da espécie, no formato UUID |
| Sucesso | `200 OK` com a espécie atualizada |

`PATCH` e não `PUT`, por dois motivos independentes: o nome é o único atributo mutável, o que torna a operação uma alteração parcial do recurso; e a configuração de CORS em vigor não libera o verbo `PUT`, de modo que adotá-lo exigiria alterar uma decisão transversal já tomada, fora do escopo desta feature.

Corpo da requisição:

```json
{ "name": "Gato doméstico" }
```

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `id` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "id", message: "Identificador inválido." }]` |
| Nome inválido | 400 | `VALIDATION_ERROR` | Mesmas mensagens por campo do `POST` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Espécie inexistente (RN-14) | 404 | `SPECIES_NOT_FOUND` | "Espécie não encontrada." |
| Nome pertencente a outra espécie (RN-04) | 409 | `SPECIES_NAME_ALREADY_EXISTS` | "Já existe uma espécie com este nome." |

Renomear para o próprio nome atual, comparado pela regra da RN-04, responde `200` — nunca `409` (RN-07).

---

#### `DELETE /api/species/:id` — excluir espécie

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetro de caminho | `id` — identificador da espécie, no formato UUID |
| Sucesso | `204 No Content`, sem corpo |

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `id` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "id", message: "Identificador inválido." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Espécie inexistente (RN-14) | 404 | `SPECIES_NOT_FOUND` | "Espécie não encontrada." |
| **Espécie com animais vinculados (RN-08)** | **409** | **`SPECIES_IN_USE`** | **"Não é possível excluir esta espécie porque existem animais vinculados a ela."** |

O `409 SPECIES_IN_USE` é o desfecho central da integridade desta feature. Ele é produzido por duas camadas independentes, ambas obrigatórias (RN-09):

1. **Verificação da aplicação**, executada dentro da mesma transação da exclusão: conta os animais vinculados e, havendo ao menos um, recusa a operação. É esta camada que produz a mensagem correta em PT-BR.
2. **Restrição de integridade referencial do banco**, com comportamento **restritivo** na chave estrangeira de animal para espécie. Se a primeira camada falhar por qualquer motivo, o banco recusa a remoção e a violação é traduzida para o mesmo `409 SPECIES_IN_USE`.

**Nunca** há remoção em cascata de animais, e nenhum animal fica com espécie nula em consequência desta operação.

---

#### Como a RN-08 é verificada antes de a entidade Animal existir

A entidade Animal é entregue pela feature seguinte deste módulo. Isso cria uma janela em que a regra mais importante desta spec não teria como ser exercitada, e a spec resolve essa janela de forma explícita para que a guarda não seja adiada e depois esquecida:

1. **Agora, nesta feature:** a contagem de animais vinculados é modelada como uma **dependência declarada do caso de uso de exclusão** — uma consulta que responde quantos animais referenciam a espécie. Enquanto a feature de animais não existir, a implementação real dessa consulta responde zero, e os testes automatizados a substituem por um duplo que responde um valor diferente de zero. É assim que os casos CT-24, CT-25 e CT-32 são executáveis desde já: eles verificam que, **havendo vínculo, a exclusão é recusada com `409 SPECIES_IN_USE` e nada é removido**, sem depender da tabela de animais.
2. **Na feature seguinte:** a consulta passa a contar de verdade na tabela de animais, e a chave estrangeira restritiva é criada junto com a tabela. Os mesmos casos de teste passam a rodar contra dados reais, sem alteração do comportamento especificado aqui.

**Condição de aceite desta divisão:** a feature de animais **não pode** ser considerada concluída sem que a chave estrangeira restritiva exista e sem que os casos CT-24, CT-25, CT-26 e CT-32 tenham sido reexecutados contra dados reais. Esta condição está repetida na seção de regressão dos critérios de aceite.

---

#### Sobre limitação de taxa

Os quatro endpoints **não** recebem limitador de taxa. Os limitadores existentes no projeto protegem endpoints de credencial contra força bruta e contra uso do servidor como ferramenta de spam; nenhum dos dois riscos se aplica a um CRUD administrativo autenticado, de baixo volume e sem envio de e-mail. Limitar aqui castigaria o administrador que cadastra várias espécies em sequência. Decisão registrada no changelog.

---

### Modelo de Dados

A espécie entra como um novo modelo Prisma seguindo as convenções físicas já estabelecidas na FEATURE-002: modelo em PascalCase e campos em camelCase no Prisma, mapeados por `@@map` / `@map` para tabela e colunas em snake_case, identificador `uuid` e colunas de data em `Timestamptz(3)`.

```prisma
/// Espécie do pet, mantida pelo administrador em lista controlada.
/// FEATURE-001 do MODULE-002 — Catálogo de pets.
model Species {
  id     String @id @default(uuid()) @db.Uuid
  /// Nome como o administrador digitou, já normalizado quanto a espaços (RN-03).
  /// É este valor que a API expõe e a interface exibe.
  name   String @db.VarChar(60)
  /// Chave de unicidade da RN-04: `name` em minúsculas, com espaços já
  /// colapsados. Coluna persistida e não índice funcional, porque o Prisma não
  /// declara índice sobre expressão no schema — deixar a regra fora do schema a
  /// tornaria invisível para quem lê o modelo.
  /// Acentos são PRESERVADOS aqui: "réptil" e "reptil" são chaves distintas (RN-05).
  /// NÃO é exposta pela API.
  nameNormalized String   @unique @map("name_normalized") @db.VarChar(60)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  /// Preenchido pela feature seguinte do módulo. É esta relação que a RN-08
  /// protege: a exclusão de uma espécie com animais vinculados é recusada.
  // animals Animal[]

  /// Ordenação alfabética da RN-11 sem varredura da tabela.
  @@index([nameNormalized])
  @@map("species")
}
```

**Consequência obrigatória para a feature seguinte (Cadastro de pets):** o modelo `Animal` deve declarar o vínculo com espécie de forma **restritiva**, e não em cascata:

```prisma
species   Species @relation(fields: [speciesId], references: [id], onDelete: Restrict)
speciesId String  @map("species_id") @db.Uuid
```

`onDelete: Restrict` é a segunda camada da RN-09. Trocá-lo por `Cascade` apagaria animais silenciosamente ao excluir uma espécie, e trocá-lo por `SetNull` produziria animais sem classificação — os dois são desfechos proibidos por esta spec.

**Migration:** cria a tabela `species` com o índice único sobre `name_normalized`. Nenhuma tabela existente é alterada. Não há carga inicial de dados — o cadastro nasce vazio e o estado vazio da tela está previsto na HU-03.

---

### Requisitos Não Funcionais

| ID | Tipo | Requisito | Critério mensurável |
|---|---|---|---|
| RNF-01 | Segurança | Autorização verificada no servidor em todos os endpoints | Cada um dos quatro endpoints responde 401 sem sessão e 403 com role `cliente` — verificável por teste automatizado, um caso por endpoint por situação |
| RNF-02 | Integridade | Nenhum animal órfão ou removido por causa da exclusão de espécie | Após tentativa de excluir espécie em uso: a contagem de espécies e a de animais permanecem inalteradas e nenhum animal tem espécie nula — verificável por teste automatizado |
| RNF-03 | Integridade | Unicidade garantida pelo banco, e não apenas por consulta prévia | Duas criações simultâneas do mesmo nome resultam em exatamente uma espécie criada e uma resposta de conflito — verificável por teste de concorrência |
| RNF-04 | Desempenho | A lista de espécies é percebida como imediata | Com 200 espécies cadastradas, a lista é exibida em menos de 2 segundos em conexão padrão |
| RNF-05 | Desempenho | Cada operação de escrita reflete na lista rapidamente | Criar, renomear ou excluir reflete na lista em menos de 1 segundo em conexão padrão |
| RNF-06 | Acessibilidade | Tela inteiramente operável por teclado | Criar, editar, salvar, cancelar e excluir são alcançáveis e acionáveis sem uso de mouse, incluindo a confirmação de exclusão |
| RNF-07 | Acessibilidade | Ações representadas por ícone possuem nome acessível | Os controles de editar e excluir de cada linha são anunciados por leitor de tela identificando a ação e a espécie correspondente |
| RNF-08 | Acessibilidade | Contraste conforme WCAG 2.1 AA | Texto a no mínimo 4.5:1 e indicadores de componente a no mínimo 3:1 sobre o respectivo fundo |
| RNF-09 | Acessibilidade | Resultado de cada operação é anunciado | As mensagens de sucesso e de erro são percebidas por leitor de tela sem exigir navegação até elas |
| RNF-10 | Usabilidade | Identidade visual CatDog | A tela usa roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito, conforme `reference.html` — verificável visualmente |
| RNF-11 | Consistência | Erros no envelope já vigente | 100% das respostas de erro dos quatro endpoints saem como `{ error: { code, message, details? } }`, com `code` estável em SCREAMING_SNAKE_CASE |
| RNF-12 | Idioma | Interface e mensagens em PT-BR | Nenhum texto exibido ao usuário em outro idioma, incluindo mensagens de validação |

---

### O que Não Deve Ser Feito

- Esta feature **não** implementa a tela de animais nem o cadastro de pets — o item "Animais" da navegação pertence à feature seguinte do módulo.
- Esta feature **não** expõe espécies na vitrine pública nem cria endpoint sem autenticação para consultá-las. A listagem pública, quando existir, é escopo da feature de catálogo.
- Esta feature **não** implementa inativação, arquivamento, lixeira ou recuperação de espécies excluídas — a exclusão permitida é definitiva (RN-10).
- Esta feature **não** apaga nem desvincula animais em nenhuma circunstância. Exclusão em cascata a partir da espécie é explicitamente proibida (RN-08).
- Esta feature **não** oferece migração de animais de uma espécie para outra antes da exclusão. O administrador que quiser excluir uma espécie em uso precisa tratar os animais primeiro, pela feature de animais.
- Esta feature **não** implementa raça, porte, descrição, imagem, ordem de exibição manual ou qualquer outro atributo da espécie além do nome (RN-13).
- Esta feature **não** implementa busca, filtro, paginação ou ordenação configurável na lista (RN-12).
- Esta feature **não** implementa criação em lote, importação de arquivo nem carga inicial de espécies.
- Esta feature **não** registra histórico de auditoria de quem criou, renomeou ou excluiu cada espécie.
- Esta feature **não** altera o envelope de erro, o fluxo de autenticação nem qualquer contrato entregue pela FEATURE-002.

---

## Grupo 4 — Validação

### Casos de Teste

| ID | Cenário | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CT-01 | Criar espécie com nome válido inédito | Nome: "Cachorro" | Espécie criada, campo limpo, mensagem "Espécie criada com sucesso.", espécie visível na lista | Positivo |
| CT-02 | Criar espécie com campo vazio | Nome: "" | "Este campo é obrigatório."; nada criado | Negativo |
| CT-03 | Criar espécie com apenas espaços | Nome: "   " | "Este campo é obrigatório."; nada criado | Borda |
| CT-04 | Criar espécie com 1 caractere | Nome: "G" | "O nome da espécie deve ter no mínimo 2 caracteres."; nada criado | Borda |
| CT-05 | Criar espécie com exatamente 2 caracteres | Nome: "Ov" | Espécie criada normalmente | Borda |
| CT-06 | Criar espécie com exatamente 60 caracteres | Nome com 60 caracteres | Espécie criada normalmente | Borda |
| CT-07 | Criar espécie com 61 caracteres | Nome com 61 caracteres | "O nome da espécie deve ter no máximo 60 caracteres."; nada criado | Borda |
| CT-08 | Criar espécie com nome duplicado em outra caixa | Existe "Gato"; entrada: "gato" | "Já existe uma espécie com este nome."; lista inalterada | Negativo |
| CT-09 | Criar espécie com nome duplicado cercado por espaços | Existe "Gato"; entrada: "  Gato  " | "Já existe uma espécie com este nome."; lista inalterada | Negativo |
| CT-10 | Normalização de espaços internos na criação | Nome: " Cão   Pastor " | Espécie gravada e exibida como "Cão Pastor" | Borda |
| CT-11 | Nomes que diferem apenas por acento coexistem | Existe "Réptil"; entrada: "Reptil" | Segunda espécie criada normalmente (RN-05) | Borda |
| CT-12 | Criação simultânea do mesmo nome | Duas requisições concorrentes com "Gato" | Exatamente uma espécie criada; a outra responde conflito | Borda |
| CT-13 | Listagem em ordem alfabética | Cadastradas "Sapo", "Gato", "Cachorro" | Exibidas na ordem "Cachorro", "Gato", "Sapo" | Positivo |
| CT-14 | Ordenação ignora maiúsculas e minúsculas | Cadastradas "gato" e "Cachorro" | "Cachorro" exibida antes de "gato" | Borda |
| CT-15 | Listagem sem nenhuma espécie | Cadastro vazio | "Nenhuma espécie cadastrada ainda. Crie a primeira acima."; resposta da API `200` com lista vazia | Borda |
| CT-16 | Renomear espécie com nome válido | "Sapo" renomeada para "Perereca" | Nome atualizado, "Espécie atualizada com sucesso.", identificador inalterado | Positivo |
| CT-17 | Renomear ajustando apenas a caixa das letras | "gato" renomeada para "Gato" | Operação aceita, sem erro de conflito (RN-07) | Borda |
| CT-18 | Renomear para nome de outra espécie | Existem "Gato" e "Sapo"; renomear "Sapo" para "gato" | "Já existe uma espécie com este nome."; nenhum dos dois alterado | Negativo |
| CT-19 | Renomear com campo vazio | Nome: "" | "Este campo é obrigatório."; linha permanece em edição; nada gravado | Negativo |
| CT-20 | Renomear espécie inexistente | Identificador de espécie já excluída | "Espécie não encontrada."; lista recarregada | Negativo |
| CT-21 | Cancelar edição em linha | Linha em edição com texto alterado; ação de cancelar | Nome original preservado; nada gravado | Positivo |
| CT-22 | Excluir espécie sem vínculos, confirmando | Espécie sem animais vinculados | Espécie removida, "Espécie excluída com sucesso.", ausente após recarregar | Positivo |
| CT-23 | Excluir espécie sem vínculos, cancelando a confirmação | Espécie sem animais vinculados | Nenhuma ação executada; espécie permanece na lista | Negativo |
| CT-24 | **Excluir espécie com animais vinculados** | Espécie "Gato" com 1 animal vinculado | "Não é possível excluir esta espécie porque existem animais vinculados a ela."; espécie permanece; nenhum animal alterado | Negativo |
| CT-25 | **Integridade após exclusão bloqueada** | Após CT-24 | Contagem de espécies e de animais inalteradas; nenhum animal com espécie nula | Negativo |
| CT-26 | Excluir espécie após remover os animais vinculados | Espécie "Gato" sem animais restantes | Exclusão concluída normalmente | Positivo |
| CT-27 | Excluir espécie inexistente | Identificador de espécie já excluída | "Espécie não encontrada."; lista recarregada | Negativo |
| CT-28 | Acesso à tela por usuário `cliente` | Sessão autenticada com role `cliente` | Redirecionado para a área do cliente; conteúdo administrativo não exibido | Negativo |
| CT-29 | Acesso à tela sem sessão | Sem sessão ativa | Redirecionado para a tela de login | Negativo |
| CT-30 | Chamada direta à API por `cliente` | Requisição autenticada como `cliente` a cada um dos quatro endpoints | Todos respondem 403 com "Você não tem permissão para acessar este recurso." | Negativo |
| CT-31 | Chamada direta à API sem sessão | Requisição sem credencial a cada um dos quatro endpoints | Todos respondem 401 com "Sua sessão expirou. Faça login novamente." | Negativo |
| CT-32 | **Exclusão via API direta com animais vinculados** | Requisição de exclusão feita fora da interface | Recusada da mesma forma; a proteção não depende da tela | Negativo |
| CT-33 | Campo não previsto no corpo da criação | Corpo com `name` e uma chave extra | Requisição recusada por validação; nada criado | Negativo |
| CT-34 | Identificador fora do formato esperado | Renomeação ou exclusão com identificador malformado | Recusada por validação, com o problema apontado no campo do identificador | Negativo |
| CT-35 | Submissão duplicada na criação | Dois acionamentos de "Criar" em sequência rápida | Apenas uma espécie criada; botão desabilitado durante a requisição | Borda |
| CT-36 | Falha ao carregar a lista | Consulta à lista indisponível | "Não foi possível carregar as espécies. Tente novamente." com opção de nova tentativa | Negativo |
| CT-37 | Operação completa por teclado | Navegação apenas por teclado | Criar, editar, salvar, cancelar, excluir e confirmar são todos alcançáveis e acionáveis | Positivo |
| CT-38 | Nome acessível dos ícones de ação | Leitor de tela sobre uma linha da lista | Os controles de editar e excluir são anunciados identificando a ação e a espécie | Positivo |
| CT-39 | Redirecionamento pós-login preservado | Login com role `admin` | Chega a uma tela administrativa funcional, sem página em branco nem rota não encontrada | Positivo |
| CT-40 | Navegação lateral com os dois itens | Tela de espécies aberta | Navegação lateral exibe "Animais" e "Espécies", com "Espécies" ativo | Positivo |

---

### Critérios de Aceite

**Comportamento e entrega:**
- [ ] CA-01: A área administrativa exibe uma navegação lateral com os itens "Animais" e "Espécies"; o item "Espécies" leva à tela de espécies e fica marcado como ativo enquanto ela está aberta.
- [ ] CA-01b: O redirecionamento por role após o login continua levando o administrador a uma tela administrativa funcional, sem página em branco e sem rota não encontrada.
- [ ] CA-02: A tela exibe o título "Espécies", um campo com o placeholder "Nome de espécie" e o botão "Criar" à sua direita.
- [ ] CA-03: A lista exibe uma linha por espécie, com o nome à esquerda e as ações de editar e excluir à direita.
- [ ] CA-04: A lista é ordenada alfabeticamente de forma crescente, ignorando maiúsculas e minúsculas.
- [ ] CA-05: Criar uma espécie com nome válido e inédito a persiste, limpa o campo, exibe "Espécie criada com sucesso." e a apresenta na lista na posição alfabética correta.
- [ ] CA-06: Nome vazio, com menos de 2 ou com mais de 60 caracteres é recusado com a mensagem correspondente e nada é criado.
- [ ] CA-07: Espaços nas extremidades são removidos e espaços internos repetidos são colapsados antes de validar, gravar e comparar.
- [ ] CA-08: Nomes que diferem apenas por maiúsculas, minúsculas ou espaços são tratados como o mesmo nome e o segundo cadastro é recusado com "Já existe uma espécie com este nome."
- [ ] CA-09: A unicidade é garantida por restrição do banco de dados — duas criações simultâneas do mesmo nome produzem exatamente uma espécie.
- [ ] CA-10: A edição de uma espécie acontece na própria linha da lista, sem tela ou janela intermediária, com as ações de salvar e cancelar.
- [ ] CA-11: Renomear para o próprio nome atual, ignorando caixa e espaços, é aceito e não produz erro de conflito.
- [ ] CA-12: Cancelar a edição restaura o nome original e não grava nada.
- [ ] CA-13: A exclusão exige confirmação explícita nomeando a espécie e avisando que a ação não pode ser desfeita.
- [ ] CA-14: **A exclusão de uma espécie com pelo menos um animal vinculado é recusada com "Não é possível excluir esta espécie porque existem animais vinculados a ela.", a espécie permanece cadastrada e nenhum animal é removido, desvinculado ou alterado.**
- [ ] CA-15: **A proteção do CA-14 é aplicada pelo servidor e reforçada pela integridade referencial do banco, valendo também para chamadas feitas fora da interface.**
- [ ] CA-16: A exclusão de espécie sem vínculos remove o registro definitivamente e ele não retorna após recarregar a página.
- [ ] CA-17: Renomear ou excluir uma espécie inexistente responde "Espécie não encontrada." e a lista é atualizada.
- [ ] CA-18: Os quatro endpoints recusam requisições sem sessão e requisições de usuários com role `cliente`, independentemente da interface.
- [ ] CA-19: Usuário `cliente` que acesse o endereço da tela é redirecionado para a sua própria área, sem que o conteúdo administrativo apareça.
- [ ] CA-20: O cadastro vazio exibe "Nenhuma espécie cadastrada ainda. Crie a primeira acima." e a linha de criação permanece disponível.
- [ ] CA-21: Toda a tela é operável por teclado e as ações representadas por ícone possuem nome acessível identificando a ação e a espécie.
- [ ] CA-22: Todas as respostas de erro saem no envelope `{ error: { code, message, details? } }` com `code` estável, e a interface ramifica por `code` e nunca pelo texto da mensagem.

**Regressão:**
- [ ] FEATURE-002 — Autenticação Completa: esta feature adiciona a primeira rota que usa a verificação de permissão por role no servidor e altera a navegação da área administrativa. Reexecutar os cenários de redirecionamento por role, de acesso a rota protegida sem sessão e de renovação de sessão.
- [ ] Envelope de erro da API: novos códigos de erro são acrescentados ao contrato. Verificar que nenhuma resposta existente mudou de formato, de `code` ou de mensagem.
- [ ] Banco de dados: a migration acrescenta uma tabela nova e não altera `users`, `email_confirmation_tokens` nem `refresh_tokens`. Verificar que a autenticação continua funcionando após a migration.
- [ ] **Pendência vinculada à feature seguinte (Cadastro de pets):** ela não pode ser considerada concluída sem que o vínculo de animal com espécie exista como chave estrangeira restritiva e sem que os casos CT-24, CT-25, CT-26 e CT-32 sejam reexecutados contra dados reais. Enquanto isso não ocorrer, a RN-08 está verificada apenas por duplo de teste.

**Qualidade de código (SonarQube):**
- [ ] Quality Gate aprovado sem bloqueadores
- [ ] Cobertura de testes: mínimo de 80% nas classes alteradas
- [ ] Zero issues de segurança (Severity: Blocker ou Critical)

---

### Cenários de QA

Roteiro de homologação manual, a ser executado com um usuário `admin` e um usuário `cliente` já cadastrados e confirmados.

| # | Passo | Resultado esperado |
|---|---|---|
| QA-01 | Autenticar como `admin` e localizar o item "Espécies" na navegação administrativa | O item existe, é acionável e leva à tela de espécies, ficando marcado como ativo |
| QA-02 | Observar a tela recém-aberta com o cadastro vazio | Título "Espécies", campo "Nome de espécie", botão "Criar" e a mensagem de lista vazia |
| QA-03 | Criar "Sapo", depois "Gato", depois "Cachorro" | As três aparecem na lista, exibidas na ordem "Cachorro", "Gato", "Sapo" |
| QA-04 | Tentar criar "gato" | "Já existe uma espécie com este nome."; a lista continua com três itens |
| QA-05 | Tentar criar com o campo vazio e com um único caractere | Mensagens de obrigatoriedade e de mínimo de caracteres; nada criado |
| QA-06 | Criar " Cão   Pastor " com espaços sobrando | Gravada e exibida como "Cão Pastor" |
| QA-07 | Acionar o lápis de "Sapo", alterar para "Perereca" e salvar | A linha é atualizada na própria posição, mensagem de sucesso, lista reordenada |
| QA-08 | Acionar o lápis de "Gato", digitar "cachorro" e salvar | "Já existe uma espécie com este nome."; a linha permanece em edição |
| QA-09 | Acionar o lápis de "Gato", alterar o texto e cancelar | O nome original é restaurado; nada gravado |
| QA-10 | Acionar a lixeira de "Perereca" e cancelar a confirmação | A espécie permanece na lista |
| QA-11 | Acionar a lixeira de "Perereca" e confirmar | Removida da lista, mensagem de sucesso; permanece ausente após recarregar |
| QA-12 | **Cadastrar um animal vinculado a "Gato" e tentar excluir "Gato"** | **"Não é possível excluir esta espécie porque existem animais vinculados a ela."; "Gato" permanece na lista** |
| QA-13 | **Verificar a lista de animais após QA-12** | **O animal continua existindo, ainda vinculado a "Gato"; nada foi removido ou alterado** |
| QA-14 | **Excluir o animal e tentar excluir "Gato" novamente** | **A exclusão é concluída normalmente** |
| QA-15 | Sair, autenticar como `cliente` e acessar diretamente o endereço da tela de espécies | Redirecionado para a área do cliente; nenhum conteúdo administrativo exibido |
| QA-16 | Sem sessão, acessar diretamente o endereço da tela de espécies | Redirecionado para a tela de login |
| QA-17 | Autenticado como `cliente`, chamar diretamente cada um dos quatro endpoints da API | Todos recusam a chamada com a mensagem de falta de permissão |
| QA-18 | Sem credencial, chamar diretamente cada um dos quatro endpoints da API | Todos recusam a chamada com a mensagem de sessão expirada |
| QA-19 | **Chamar diretamente a exclusão de uma espécie com animais vinculados, fora da interface** | **Recusada com a mesma mensagem de vínculo; nada é removido** |
| QA-20 | Percorrer toda a tela usando apenas o teclado | Criar, editar, salvar, cancelar, excluir e confirmar são alcançáveis e acionáveis |
| QA-21 | Percorrer a lista com leitor de tela | As ações de editar e excluir são anunciadas identificando a ação e a espécie |
| QA-22 | Conferir cores e tipografia contra `reference.html` | Roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito aplicados |

---

### Critério de Sucesso da Feature

| Métrica | Baseline atual | Meta após entrega | Como será medida |
|---|---|---|---|
| Espécies duplicadas no cadastro (mesmo nome em caixas diferentes) | Não aplicável — não existe cadastro de espécies | 0 duplicatas | Consulta ao cadastro comparando os nomes de forma insensível a maiúsculas e minúsculas |
| Animais sem espécie ou removidos por exclusão de espécie | Não aplicável | 0 ocorrências | Verificação de integridade após cada tentativa de exclusão bloqueada |
| Administrador consegue cadastrar uma espécie sem apoio | 0 (feature inexistente) | 100% das tentativas concluídas sem contato com suporte | Ausência de chamados relacionados ao cadastro de espécies |
| Tempo para cadastrar uma espécie | Não aplicável | Menos de 15 segundos entre abrir a tela e ver a espécie na lista | Observação em homologação |

---

## Grupo 5 — Estimativa

> Preencha após o escopo completo estar definido e revisado.

**Use Points gerados:** _A preencher_
**Estimativa de custo:** _A preencher_
