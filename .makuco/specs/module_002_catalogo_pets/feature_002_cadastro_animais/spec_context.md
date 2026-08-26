# FEATURE-002 — Cadastro de Animais (área administrativa)

---

## Grupo 1 — Identificação

**Feature:** FEATURE-002 — Cadastro de Animais (criar, listar, editar, excluir animais e alterar o status de adoção na área administrativa)
**Módulo:** MODULE-002 — Catálogo de pets
**Status:** Rascunho
**Criado por:** Makuco Specify Agent — 2026-08-25
**Aprovado por:** _A preencher_

> **Desambiguação de numeração:** neste documento, "FEATURE-002 do MODULE-001" é a Autenticação Completa e "FEATURE-001 do MODULE-002" é o Cadastro de Espécies. Referências a "esta feature" significam sempre a FEATURE-002 do MODULE-002.

---

## Objetivo da Feature

O catálogo da CatDog só existe se os animais existirem. A FEATURE-001 deste módulo entregou a lista controlada de espécies, mas não há nada para classificar: nenhum animal é cadastrado hoje, e a divulgação continua acontecendo por mensagens avulsas. Esta feature entrega ao administrador a tela onde ele mantém os animais da plataforma — cadastrando, editando, excluindo e marcando em que ponto do processo de adoção cada um está — com fotos, características de convivência e localização. O beneficiário imediato é o administrador, que passa a ter um cadastro único e confiável; o beneficiário final é o cliente, porque a vitrine pública e a filtragem por preferência, features seguintes deste módulo, leem exatamente estes dados. Sem esta feature, o módulo inteiro fica sem conteúdo e a FEATURE-001 permanece com a sua regra mais importante — o bloqueio de exclusão de espécie em uso — verificada apenas por duplo de teste.

---

## Grupo 2 — Contexto

### Quem Acessa

| Perfil / Permissão | Nível de acesso | Observação |
|---|---|---|
| admin | Total (criar, listar, consultar, editar, alterar status, excluir) | Único perfil autorizado. A verificação de permissão que vale é a do servidor; o guard de rota do frontend é conveniência de navegação |
| cliente | Nenhum | Usuário autenticado com role `cliente` que tente acessar a tela é redirecionado para a sua própria área; a API recusa a chamada |
| Visitante (não autenticado) | Nenhum | Redirecionado para a tela de login; a API recusa a chamada |

A vitrine pública, onde o cliente enxerga os animais sem autenticação, é feature seguinte deste módulo e **não** é escopo desta spec. Nenhum endpoint criado aqui é anônimo.

---

### Premissas

- A FEATURE-002 do MODULE-001 (Autenticação Completa) está implementada e funcional: sessão, roles `admin` / `cliente`, guard de rota por role no frontend e verificação de permissão no servidor.
- A FEATURE-001 deste módulo (Cadastro de Espécies) está entregue **antes** desta: a tabela de espécies existe, o endpoint de listagem de espécies responde e a navegação administrativa lateral com os itens "Animais" e "Espécies" já foi criada por ela.
- O usuário já está autenticado como `admin` ao acessar esta funcionalidade.
- O envelope de erro da API está congelado no formato `{ error: { code, message, details? } }` e esta feature não o altera; ela apenas acrescenta novos `code`.
- O envelope de coleção `{ items: [...] }` foi estabelecido pela FEATURE-001 deste módulo e é reaproveitado aqui.
- Os componentes de lista, de confirmação de ação destrutiva e de aviso temporário de sucesso passaram a existir na base compartilhada com a FEATURE-001 e são reaproveitados por esta feature.
- O banco é PostgreSQL hospedado no Supabase, e o projeto Supabase já provisiona o serviço de armazenamento de objetos — os schemas de armazenamento existem, embora nenhum ponto do código os utilize hoje.
- O ambiente de execução previsto para a aplicação tem sistema de arquivos efêmero: qualquer arquivo gravado no disco do contêiner desaparece no próximo reinício ou implantação.
- O produto não contrata serviço pago para esta feature.
- O volume esperado é da ordem de dezenas a poucas centenas de animais — é o catálogo de uma operação pequena, não um marketplace.
- O módulo de pedidos, que consumirá o status do animal, ainda não existe. Esta spec define os estados possíveis, mas apenas a transição **manual** feita pelo administrador.

---

### Dependências

| Dependência | Tipo | Status | Impacto se não resolvida |
|---|---|---|---|
| FEATURE-002 do MODULE-001 — Autenticação Completa (sessão, role `admin`, verificação no servidor) | FEATURE | Resolvida | Sem ela não há como restringir a tela ao administrador — a feature inteira fica exposta |
| FEATURE-001 do MODULE-002 — Cadastro de Espécies (tabela de espécies, listagem, navegação lateral) | FEATURE | Pendente — precede esta | Sem a lista de espécies o campo "Espécie" do formulário não tem o que oferecer, e o vínculo obrigatório não pode ser criado. Esta feature **não pode** ser iniciada antes |
| Armazenamento de objetos do Supabase habilitado, com balde dedicado e credencial de serviço disponível ao backend | Infraestrutura | Pendente — provisionada por esta feature | Sem ele não há onde guardar as imagens; o cadastro fica sem fotos e a vitrine, sem conteúdo visual |
| Tabelas de Estado e Cidade semeadas a partir do recorte oficial do IBGE | Decisão técnica (desta spec) | Pendente — entregue por esta feature | Sem elas os campos "Estado" e "Cidade" não têm origem de dados e a validação de servidor do par UF/cidade é impossível |
| Componente de alternância (liga/desliga) e componente de envio de imagens com pré-visualização | Base de componentes de interface | Pendente — criados por esta feature | Nenhum dos dois existe hoje; sem eles o formulário não é construível |
| Leitura de corpo `multipart/form-data` no backend | Decisão técnica (desta spec) | Pendente — entregue por esta feature | A API hoje só lê JSON; sem isso não há como receber arquivo |

---

### Referências e Insumos

**Protótipo / Wireframe:** não há protótipo. A fonte da verdade do layout são três capturas de tela da aplicação, exibidas em reunião e arquivadas junto desta spec.

**Prints de referência (estado atual):**
- `assets/cadastra_animais_admin.png` — a listagem de animais
- `assets/cadastra_animais_admin_form.png` — o formulário de edição, topo
- `assets/cadastra_animais_admin_form_2.png` — o mesmo formulário, rolado até o fim

Nas três capturas, a barra de endereço do navegador, as abas e a barra de favoritos aparecem em volta da aplicação e **não fazem parte do produto**. Um detalhe é relevante e está registrado adiante: as duas capturas do formulário são do mesmo momento de uso, e a primeira flagra o campo "Cidade" exibindo "Carregando cidades..." enquanto a segunda já o mostra resolvido em "Campo Magro".

**O que a captura da listagem estabelece como contrato de interface:**

| Elemento | Conteúdo observado |
|---|---|
| Navegação lateral | Itens "Animais" e "Espécies", com "Animais" em estado ativo (destaque roxo) |
| Título da página | "Animais" |
| Ação primária | Botão roxo "Cadastrar Animal", alinhado à direita, na mesma altura do título |
| Colunas da tabela | ANIMAL, ESPÉCIE, PORTE, LOCALIZAÇÃO, STATUS, ALTERAR STATUS, AÇÕES |
| Coluna ANIMAL | Miniatura da imagem à esquerda do nome ("Theo") |
| Coluna LOCALIZAÇÃO | "Boa Esperança - ES" — cidade e sigla do estado separadas por hífen |
| Coluna STATUS | Selo verde com o texto "Disponível" — somente leitura |
| Coluna ALTERAR STATUS | Campo de seleção dentro da própria linha, exibindo o status atual |
| Coluna AÇÕES | Dois botões de texto: "Editar" e "Excluir" |
| Rodapé da tabela | "Total: 1 animais" |

**O que as capturas do formulário estabelecem como contrato de interface:**

| Elemento | Conteúdo observado |
|---|---|
| Título da página | "Editar Animal" |
| Endereço | `/admin/animals/c7066355-5591-4a6f-a3f8-2a9ee727b2d0/edit` — o identificador do animal é um UUID |
| Arranjo | Duas colunas de campos, com "Cidade" e "Descrição" ocupando a largura inteira |
| Campos com asterisco (obrigatórios) | Nome, Espécie, Porte, Sexo, Estado, Cidade |
| Campos sem asterisco (opcionais) | Data de nascimento, Descrição |
| Nome | Campo de texto — valor observado "Theo" |
| Data de nascimento | Seletor de data nativo — valor observado 05/11/2022 |
| Espécie | Campo de seleção — valor observado "Cachorro" |
| Porte | Campo de seleção — valor observado "Grande" |
| Sexo | Campo de seleção — valor observado "Macho" |
| Estado | Campo de seleção — valor observado "PR" (sigla, não nome por extenso) |
| Cidade | Campo de seleção de largura inteira — observado em dois momentos: "Carregando cidades..." e "Campo Magro" |
| Descrição | Área de texto de várias linhas — valor observado "Theo" |
| Alternâncias | "Aceita outros animais" (ligada, roxa) e "Precisa de espaço grande" (desligada), lado a lado |
| Envio de imagens | Rótulo literal "Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)"; duas miniaturas já enviadas, cada uma com um "x" vermelho no canto superior direito; botão roxo "Escolher arquivos" seguido do texto "Nenhum arquivo escolhido" |
| Rodapé do formulário | Botões "Cancelar" (secundário) e "Salvar" (primário roxo), alinhados à direita |

**Divergências entre as capturas e as convenções em vigor — e como esta spec as resolve:**

| Ponto | Captura | Convenção em vigor | Decisão desta spec |
|---|---|---|---|
| Endereço da listagem | `/admin/animals` | Caminhos de interface em PT-BR (`/cadastro`, `/minha-area`, `/admin/especies`) | `/admin/animais` |
| Endereço do formulário | `/admin/animals/:id/edit` | Idem | `/admin/animais/:id/editar`, e `/admin/animais/novo` para o cadastro |
| Contagem no rodapé | "Total: 1 animais" | — | Corrigida para concordância: "Total: 1 animal" no singular e "Total: N animais" no plural |
| Verbo de alteração | — | O CORS em vigor não libera `PUT` | `PATCH` para editar e para alterar status |

Todas as decisões acima estão registradas no changelog desta feature.

**Artefatos consultados:**
- `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md` — vínculo com espécie, RN-08/RN-09, convenções de rota e de envelope, pendência de regressão herdada
- `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/changelog_context.md` — decisões já tomadas e que esta spec não renegocia
- `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md` — numeração de RN/CA/RNF/CT, envelope de erro, formato de mensagens
- `.makuco/product/scope_features_context.md` — módulos "Catálogo de pets", "Pedido do cliente" e "Gestão de pedidos", origem das etapas do processo de adoção
- `.makuco/overview/glossary_context.md` — termos "Pet", "Administrador", "Vitrine"
- `.makuco/resources/reference.html` — identidade visual CatDog (roxo `#7c3aed`, laranja `#e05a1e`, fonte Nunito)
- `MAKUCO.md` e `.makuco/codebase/` — stack, arquitetura em camadas, convenções de código

**Tabelas de banco de dados:** `animals`, `animal_images`, `states` e `cities` (todas novas, definidas nesta spec). A tabela `species`, da FEATURE-001 deste módulo, passa a ser referenciada de forma restritiva.
**MCPs utilizados:** Não aplicável nesta feature
**SKILLs utilizados:** Não aplicável nesta feature

---

### Termos Novos no Glossário

| Termo | Definição | Evitar |
|---|---|---|
| Animal | Pet cadastrado no catálogo, classificado por uma espécie e descrito por nome, porte, sexo, localização, características de convivência e imagens. É a entidade que o cliente enxerga na vitrine e sobre a qual abre pedido. | Bicho, item, produto |
| Porte | Faixa de tamanho do animal adulto, escolhida em lista fechada: Pequeno, Médio ou Grande. | Tamanho, peso |
| Status do animal | Situação do animal no ciclo de adoção: Disponível, Reservado, Adotado ou Indisponível. Não confundir com o status do **pedido**, que descreve as etapas do atendimento e pertence a outro módulo. | Situação, etapa, fase |
| Idade | Número de anos completos entre a data de nascimento do animal e a data atual. É **derivada**, nunca digitada nem armazenada. | Idade cadastrada, campo idade |
| Localização | Par cidade e estado onde o animal se encontra, exibido como "Cidade - UF". | Endereço, região |
| Imagem de capa | Primeira imagem do animal na ordem definida pelo administrador. É a miniatura exibida na listagem e a imagem principal da vitrine. | Foto de perfil, avatar |

---

## Grupo 3 — Comportamento

### Histórias de Usuário

---

#### HU-01 — Acessar a área de animais

O administrador autenticado aciona o item "Animais" na navegação lateral da área administrativa. A aplicação exibe a tela de animais com o título "Animais", o botão "Cadastrar Animal" à direita e a lista dos animais já cadastrados. O item acionado fica visivelmente marcado como ativo. Quem não é administrador não alcança a tela.

**Pode ser testada independentemente:** Sim — autenticar como `admin` e verificar que o item existe, leva à tela e fica ativo; depois autenticar como `cliente` e verificar o redirecionamento; depois acessar a mesma rota sem sessão e verificar o redirecionamento para o login.

**Cenários de aceite:**

1. **Dado** que o usuário está autenticado com role `admin`, **quando** aciona o item "Animais" na navegação administrativa, **então** a tela de animais é exibida com o título "Animais" e o item fica marcado como ativo.
2. **Dado** que o usuário está autenticado com role `cliente`, **quando** tenta acessar o endereço da tela de animais, **então** é redirecionado para a sua própria área e nenhum conteúdo administrativo é exibido.
3. **Dado** que não há sessão ativa, **quando** o endereço da tela de animais é acessado, **então** o usuário é redirecionado para a tela de login.
4. **Dado** que o administrador está na tela de animais, **quando** observa a navegação lateral, **então** vê também o item "Espécies", da FEATURE-001 deste módulo, que continua funcionando.
5. **Dado** que o administrador está na tela de animais, **quando** observa a área do título, **então** vê o botão "Cadastrar Animal" alinhado à direita.

---

#### HU-02 — Listar animais cadastrados

Ao abrir a tela, o administrador vê todos os animais cadastrados, um por linha, com miniatura, nome, espécie, porte, localização, status, o campo de alteração rápida de status e as ações de editar e excluir. O rodapé informa quantos animais existem. Quando não há nenhum animal, a tela informa isso explicitamente.

**Pode ser testada independentemente:** Sim — cadastrar alguns animais, abrir a tela e conferir as sete colunas e a contagem; depois esvaziar o cadastro e conferir a mensagem de lista vazia.

**Cenários de aceite:**

1. **Dado** que existem animais cadastrados, **quando** o administrador abre a tela, **então** a tabela exibe as colunas ANIMAL, ESPÉCIE, PORTE, LOCALIZAÇÃO, STATUS, ALTERAR STATUS e AÇÕES.
2. **Dado** que um animal possui imagens, **quando** a linha é exibida, **então** a miniatura mostrada é a imagem de capa, à esquerda do nome.
3. **Dado** que um animal não possui nenhuma imagem, **quando** a linha é exibida, **então** um marcador visual neutro ocupa o lugar da miniatura e a linha continua legível.
4. **Dado** que um animal está na cidade "Boa Esperança" do estado "ES", **quando** a linha é exibida, **então** a coluna LOCALIZAÇÃO apresenta "Boa Esperança - ES".
5. **Dado** que um animal está com status Disponível, **quando** a linha é exibida, **então** a coluna STATUS apresenta um selo verde com o texto "Disponível" e a coluna ALTERAR STATUS apresenta um campo de seleção já posicionado em "Disponível".
6. **Dado** que existe exatamente um animal cadastrado, **quando** a lista é exibida, **então** o rodapé apresenta "Total: 1 animal".
7. **Dado** que existem três animais cadastrados, **quando** a lista é exibida, **então** o rodapé apresenta "Total: 3 animais".
8. **Dado** que não existe nenhum animal cadastrado, **quando** o administrador abre a tela, **então** a mensagem "Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima." é exibida e o botão "Cadastrar Animal" continua disponível.
9. **Dado** que a lista está sendo carregada, **quando** a tela é aberta, **então** um indicador de carregamento ocupa o lugar da tabela, sem que o título e o botão de cadastro desapareçam.
10. **Dado** que a consulta à lista falha, **quando** a tela é aberta, **então** a mensagem "Não foi possível carregar os animais. Tente novamente." é exibida com a possibilidade de nova tentativa.
11. **Dado** que o total de animais cadastrados não excede o tamanho da página, **quando** a lista é exibida, **então** nenhum controle de navegação entre páginas é apresentado — é o caso da captura, com um único animal.
12. **Dado** que existem mais animais do que cabem em uma página, **quando** a lista é exibida, **então** os controles de navegação entre páginas são apresentados e o rodapé continua informando o total geral, e não o total da página.
13. **Dado** que existem 45 animais cadastrados no mesmo instante, **quando** o administrador percorre todas as páginas, **então** os 45 animais aparecem exatamente uma vez cada, sem repetição e sem omissão.
14. **Dado** que um animal está com status Disponível e não possui nenhuma imagem, **quando** a linha é exibida, **então** um indicador discreto de pendência de foto acompanha a linha, sem impedir nenhuma ação.

---

#### HU-03 — Cadastrar um animal

O administrador aciona "Cadastrar Animal" e chega a um formulário vazio, com o mesmo arranjo de campos da edição. Preenche os campos obrigatórios, opcionalmente a data de nascimento, a descrição, as alternâncias e as imagens, e aciona "Salvar". O sistema valida tudo no servidor, grava o animal com status Disponível e volta para a listagem, onde o novo animal já aparece.

**Pode ser testada independentemente:** Sim — abrir o formulário de cadastro, preencher o mínimo obrigatório, salvar e verificar que o animal aparece na listagem e persiste após recarregar a página.

**Cenários de aceite:**

1. **Dado** que o administrador está na listagem, **quando** aciona "Cadastrar Animal", **então** o formulário de cadastro é exibido com o título "Cadastrar Animal" e todos os campos vazios.
2. **Dado** que todos os campos obrigatórios estão preenchidos com valores válidos, **quando** o administrador aciona "Salvar", **então** o animal é criado com status Disponível, a mensagem "Animal cadastrado com sucesso." é exibida e a aplicação volta para a listagem com o animal presente.
3. **Dado** que o campo Nome está vazio, **quando** o administrador aciona "Salvar", **então** a mensagem "Este campo é obrigatório." é exibida junto ao campo Nome e nada é criado.
4. **Dado** que os campos Espécie, Porte, Sexo, Estado ou Cidade não foram escolhidos, **quando** o administrador aciona "Salvar", **então** cada campo pendente exibe "Este campo é obrigatório." e nada é criado.
5. **Dado** que o administrador deixou Data de nascimento e Descrição em branco e não enviou nenhuma imagem, **quando** aciona "Salvar", **então** o animal é criado normalmente — os três são opcionais.
6. **Dado** que o formulário tem erros de validação em mais de um campo, **quando** o administrador aciona "Salvar", **então** todos os campos com problema são sinalizados de uma vez e o foco vai para o primeiro deles.
7. **Dado** que a requisição de gravação está em andamento, **quando** o administrador aciona "Salvar" novamente, **então** o segundo acionamento é ignorado e apenas um animal é criado.
8. **Dado** que o administrador preencheu o formulário, **quando** aciona "Cancelar", **então** volta para a listagem e nada é gravado.
9. **Dado** que já existe um animal chamado "Theo", **quando** o administrador cadastra outro animal chamado "Theo", **então** o cadastro é aceito — o nome do animal não é único.

---

#### HU-04 — Escolher estado e cidade

O administrador escolhe o estado em uma lista de siglas. O campo Cidade, que até então não tem opções, passa a oferecer as cidades daquele estado. Enquanto a lista de cidades é obtida, o campo informa que está carregando e não aceita escolha. Trocar o estado descarta a cidade escolhida antes.

**Pode ser testada independentemente:** Sim — abrir o formulário, escolher um estado, verificar que o campo Cidade sai do estado vazio, passa por "Carregando cidades..." e chega povoado apenas com cidades daquele estado; depois trocar o estado e verificar que a cidade escolhida foi descartada.

**Cenários de aceite:**

1. **Dado** que nenhum estado foi escolhido, **quando** o formulário é aberto para cadastro, **então** o campo Cidade está desabilitado e exibe "Escolha primeiro o estado".
2. **Dado** que o administrador escolheu o estado "PR", **quando** a lista de cidades está sendo obtida, **então** o campo Cidade exibe "Carregando cidades..." e não aceita escolha.
3. **Dado** que a lista de cidades do estado "PR" foi obtida, **quando** o campo Cidade é aberto, **então** ele oferece apenas cidades do Paraná, em ordem alfabética, e "Campo Magro" está entre elas.
4. **Dado** que o administrador havia escolhido "Campo Magro" no estado "PR", **quando** troca o estado para "ES", **então** a cidade escolhida é descartada, o campo Cidade volta a ficar vazio e passa a oferecer apenas cidades do Espírito Santo.
5. **Dado** que o administrador abre o formulário de edição de um animal que já tem estado e cidade, **quando** a tela termina de carregar, **então** o estado aparece escolhido e o campo Cidade aparece com a cidade correta já selecionada, sem exigir nova escolha.
6. **Dado** que a lista de cidades não pôde ser obtida, **quando** o administrador tenta escolher a cidade, **então** a mensagem "Não foi possível carregar as cidades. Tente novamente." é exibida com a possibilidade de nova tentativa, e o restante do formulário continua preenchível.
7. **Dado** que a lista de estados é exibida, **quando** o administrador a abre, **então** ela oferece as 27 unidades federativas do Brasil, identificadas pela sigla, em ordem alfabética.

---

#### HU-05 — Enviar, organizar e remover imagens do animal

No formulário, o administrador escolhe arquivos de imagem. Cada arquivo escolhido aparece como miniatura, com um "x" que o remove. O sistema aceita no máximo cinco imagens por animal, apenas JPEG e PNG, de até 5 MB cada, e verifica isso no servidor — não apenas no navegador. A primeira imagem da ordem é a capa.

**Pode ser testada independentemente:** Sim — enviar imagens válidas e conferir as miniaturas e a capa; tentar enviar uma sexta imagem, um arquivo de outro tipo e um arquivo grande demais, inclusive burlando o navegador e chamando a API diretamente, e conferir a recusa em todos os casos.

**Cenários de aceite:**

1. **Dado** que o formulário está aberto, **quando** o administrador observa a área de imagens, **então** vê o rótulo "Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)", o botão "Escolher arquivos" e o texto "Nenhum arquivo escolhido".
2. **Dado** que o administrador escolheu dois arquivos JPEG válidos, **quando** a escolha é concluída, **então** duas miniaturas são exibidas, cada uma com um "x" de remoção, e o texto ao lado do botão passa a informar quantos arquivos foram escolhidos.
3. **Dado** que o animal já possui duas imagens gravadas, **quando** o administrador aciona o "x" de uma delas e salva, **então** aquela imagem deixa de existir para o animal e a outra permanece.
4. **Dado** que o administrador acionou o "x" de uma imagem gravada, **quando** aciona "Cancelar" em vez de salvar, **então** nenhuma imagem é removida.
5. **Dado** que o animal já possui cinco imagens, **quando** o administrador tenta acrescentar mais uma, **então** a mensagem "É permitido no máximo 5 imagens por animal." é exibida e nenhuma imagem é acrescentada.
6. **Dado** que o administrador escolheu um arquivo que não é JPEG nem PNG, **quando** o formulário é enviado, **então** a mensagem "Apenas imagens JPEG ou PNG são aceitas." é exibida e nenhuma imagem daquele envio é gravada.
7. **Dado** que o administrador escolheu um arquivo maior que 5 MB, **quando** o formulário é enviado, **então** a mensagem "Cada imagem deve ter no máximo 5 MB." é exibida e nenhuma imagem daquele envio é gravada.
8. **Dado** que um arquivo com extensão `.jpg` na verdade não é uma imagem JPEG nem PNG, **quando** o formulário é enviado, **então** o servidor recusa o arquivo pelo seu conteúdo real, e não pela extensão nem pelo tipo declarado.
9. **Dado** que a requisição é feita diretamente à API, fora da interface, **quando** ela contém seis imagens, uma imagem de tipo não aceito ou uma imagem grande demais, **então** é recusada exatamente como seria pela tela — a proteção não depende do navegador.
10. **Dado** que o animal possui imagens, **quando** a listagem é exibida, **então** a miniatura da linha é a primeira imagem na ordem do animal.
11. **Dado** que a gravação das imagens no armazenamento falha, **quando** o administrador aciona "Salvar", **então** a mensagem "Não foi possível salvar as imagens. Tente novamente." é exibida, **nenhuma** alteração do animal é gravada, nenhum arquivo daquele envio permanece no armazenamento e o formulário preserva tudo o que o administrador havia preenchido.
12. **Dado** que o animal possui três imagens gravadas, **quando** o administrador tenta acrescentar mais três, **então** a interface recusa antes do envio e informa quantas imagens ainda cabem.
13. **Dado** que o animal possui cinco imagens gravadas, **quando** o administrador remove três e acrescenta três, **então** o envio é aceito, porque o limite vale sobre o estado final, que volta a ser cinco.
14. **Dado** que o administrador escolheu um arquivo SVG renomeado para `.jpg`, **quando** o formulário é enviado, **então** o arquivo é recusado pela assinatura binária, e não pelo nome — um SVG servido de um balde público executaria script no navegador de quem o abrisse.
15. **Dado** que o administrador escolheu um arquivo de 0 byte, **quando** o formulário é enviado, **então** o arquivo é recusado como imagem inválida.
16. **Dado** que o administrador enviou cinco imagens de 5 MB de uma vez, **quando** o corpo da requisição excede o limite total, **então** a recusa chega como mensagem de negócio em PT-BR, e não como erro genérico do servidor de borda.
17. **Dado** que o administrador removeu a imagem de capa e salvou, **quando** a listagem é exibida, **então** a miniatura da linha passa a ser a imagem seguinte na ordem.
18. **Dado** que o administrador enviou um arquivo cujo nome contém `../`, emoji ou centenas de caracteres, **quando** a imagem é gravada, **então** o caminho do arquivo no armazenamento é gerado pela aplicação e não é influenciado pelo nome enviado.

---

#### HU-06 — Editar um animal

O administrador aciona "Editar" na linha do animal. O formulário abre com o título "Editar Animal" e todos os campos preenchidos com os valores atuais, incluindo estado, cidade, alternâncias e imagens. Ele altera o que precisa e aciona "Salvar".

**Pode ser testada independentemente:** Sim — cadastrar um animal, editá-lo alterando cada campo, salvar e verificar que os novos valores persistem após recarregar a página e que o identificador do animal não mudou.

**Cenários de aceite:**

1. **Dado** que a listagem exibe o animal "Theo", **quando** o administrador aciona "Editar" naquela linha, **então** o formulário abre com o título "Editar Animal" e todos os campos preenchidos com os valores atuais do animal.
2. **Dado** que o formulário de edição está aberto, **quando** o administrador altera o nome e salva, **então** o novo nome é gravado, a mensagem "Animal atualizado com sucesso." é exibida e a aplicação volta para a listagem já atualizada.
3. **Dado** que o formulário de edição está aberto, **quando** o administrador aciona "Cancelar", **então** volta para a listagem e nenhuma alteração é gravada.
4. **Dado** que o administrador limpa o campo Nome, **quando** salva, **então** a mensagem "Este campo é obrigatório." é exibida, o formulário permanece aberto e nada é gravado.
5. **Dado** que outra pessoa excluiu o animal enquanto o formulário estava aberto, **quando** o administrador salva, **então** a mensagem "Animal não encontrado." é exibida e a aplicação volta para a listagem atualizada.
6. **Dado** que o administrador troca a espécie do animal para outra existente, **quando** salva, **então** a nova espécie é gravada e a listagem passa a exibi-la.
7. **Dado** que a espécie escolhida foi excluída por outra pessoa enquanto o formulário estava aberto, **quando** o administrador salva, **então** a mensagem "Espécie não encontrada." é exibida e nada é gravado.
8. **Dado** que o formulário de edição está aberto, **quando** o administrador observa os campos, **então** **não** encontra campo de status — o status é alterado apenas pela listagem, conforme a HU-07.
9. **Dado** que o administrador abriu o formulário de edição em uma aba e alterou o status do mesmo animal em outra, **quando** salva o formulário, **então** a mensagem "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." é exibida e nenhuma das duas alterações é perdida em silêncio.

---

#### HU-07 — Alterar o status do animal pela listagem

Na própria linha da listagem, o administrador escolhe outro status no campo da coluna ALTERAR STATUS. A alteração é aplicada imediatamente, sem abrir o formulário completo e sem exigir confirmação, e o selo da coluna STATUS passa a refletir o novo valor.

**Pode ser testada independentemente:** Sim — alterar o status de um animal pela listagem e verificar que o selo muda, que o valor persiste após recarregar a página e que nenhum outro dado do animal foi alterado.

**Cenários de aceite:**

1. **Dado** que um animal está com status Disponível, **quando** o administrador escolhe "Adotado" no campo da coluna ALTERAR STATUS, **então** o status é gravado, o selo da coluna STATUS passa a exibir "Adotado" e a mensagem "Status atualizado com sucesso." é exibida.
2. **Dado** que a alteração de status está em andamento, **quando** o administrador tenta escolher outro valor, **então** o campo fica indisponível até a conclusão.
3. **Dado** que a alteração de status falha, **quando** a resposta chega, **então** o campo volta ao valor anterior e a mensagem "Não foi possível atualizar o status. Tente novamente." é exibida.
4. **Dado** que o administrador alterou o status de um animal, **quando** consulta o mesmo animal no formulário de edição, **então** nenhum outro dado do animal foi alterado.
5. **Dado** que o campo da coluna ALTERAR STATUS é aberto, **quando** o administrador observa as opções, **então** vê exatamente "Disponível", "Reservado", "Adotado" e "Indisponível".
6. **Dado** que o administrador escolhe o mesmo status que o animal já tem, **quando** a escolha é feita, **então** nenhuma requisição desnecessária é enviada e nada muda.
7. **Dado** que o animal foi excluído por outra pessoa, **quando** o administrador altera o status daquela linha, **então** a mensagem "Animal não encontrado." é exibida e a lista é atualizada, sem deixar linha fantasma.
8. **Dado** que o animal foi alterado por outra pessoa desde que a lista foi carregada, **quando** o administrador altera o status daquela linha, **então** a alteração é recusada por conflito, o campo volta ao valor anterior e a lista é atualizada.
9. **Dado** que a requisição de alteração de status é feita diretamente à API com um valor inexistente, como "VENDIDO", texto vazio ou número, **quando** ela chega ao servidor, **então** é recusada por validação e nada é alterado.

---

#### HU-08 — Excluir um animal

O administrador aciona "Excluir" na linha do animal. O sistema pede confirmação explícita, nomeando o animal e avisando que a ação não pode ser desfeita. Confirmada a exclusão, o animal e as suas imagens deixam de existir.

**Pode ser testada independentemente:** Sim — cadastrar um animal com imagens, excluí-lo e verificar que ele some da lista, não retorna após recarregar a página e que as suas imagens deixaram de ser acessíveis.

**Cenários de aceite:**

1. **Dado** que a listagem exibe o animal "Theo", **quando** o administrador aciona "Excluir" naquela linha, **então** uma confirmação é exibida com o texto "Excluir o animal “Theo”? Esta ação não pode ser desfeita."
2. **Dado** que a confirmação está sendo exibida, **quando** o administrador confirma, **então** o animal é excluído, some da lista, a contagem do rodapé é atualizada e a mensagem "Animal excluído com sucesso." é exibida.
3. **Dado** que a confirmação está sendo exibida, **quando** o administrador cancela, **então** nenhuma ação é executada e o animal permanece na lista.
4. **Dado** que o animal excluído possuía imagens, **quando** a exclusão é concluída, **então** os registros das imagens deixam de existir e os arquivos correspondentes são removidos do armazenamento.
5. **Dado** que outra pessoa já excluiu o mesmo animal, **quando** o administrador confirma a exclusão, **então** a mensagem "Animal não encontrado." é exibida e a lista é atualizada.
6. **Dado** que a exclusão foi concluída, **quando** o administrador recarrega a página, **então** o animal continua ausente da lista.
7. **Dado** que um animal é excluído, **quando** a espécie que o classificava é consultada, **então** ela continua existindo — excluir animal nunca apaga espécie.

---

#### HU-09 — Integridade entre animal e espécie verificada contra dados reais

Com a entidade Animal passando a existir, a regra mais importante da FEATURE-001 deste módulo — não excluir uma espécie que classifica algum animal — deixa de ser verificável apenas por duplo de teste e passa a ser exercitada contra dados reais. Esta história existe para que essa verificação seja entregue por esta feature, e não adiada indefinidamente.

**Pode ser testada independentemente:** Sim — cadastrar um animal vinculado a uma espécie, tentar excluir essa espécie pela tela de espécies e pela API, verificar a recusa e a integridade do animal; depois excluir o animal e verificar que a espécie passa a poder ser excluída.

**Cenários de aceite:**

1. **Dado** que existe um animal real vinculado à espécie "Cachorro", **quando** o administrador tenta excluir "Cachorro" na tela de espécies, **então** a mensagem "Não é possível excluir esta espécie porque existem animais vinculados a ela." é exibida e a espécie permanece cadastrada.
2. **Dado** que a exclusão da espécie foi recusada, **quando** o administrador consulta a listagem de animais, **então** o animal continua existindo, ainda vinculado à mesma espécie, e nenhum dado dele mudou.
3. **Dado** que a exclusão da espécie é solicitada diretamente à API, fora da interface, **quando** existem animais vinculados, **então** é recusada da mesma forma.
4. **Dado** que o administrador excluiu o único animal vinculado a "Cachorro", **quando** tenta excluir "Cachorro" novamente, **então** a exclusão é concluída normalmente.
5. **Dado** que a verificação da aplicação fosse contornada por qualquer motivo, **quando** a remoção da espécie chegasse ao banco com animais ainda vinculados, **então** o próprio banco recusaria a operação — nenhum animal é apagado e nenhum animal fica sem espécie.
6. **Dado** que os casos CT-24, CT-25, CT-26 e CT-32 da FEATURE-001 deste módulo estavam verificados apenas por duplo de teste, **quando** esta feature é concluída, **então** os quatro foram reexecutados contra dados reais e aprovados.

---

### Regras de Negócio

**Acesso**

- **RN-01:** Apenas usuários autenticados com role `admin` podem listar, consultar, cadastrar, editar, alterar o status ou excluir animais. A verificação de permissão que vale é a do servidor; o controle de rota do frontend existe apenas como conveniência de navegação e não protege nada.
- **RN-02:** Nenhum endpoint desta feature é anônimo, inclusive os de estados e cidades. A exposição pública de animais é escopo da feature de vitrine, ainda não especificada.

**Identificação do animal**

- **RN-03:** O nome do animal é obrigatório e, depois de removidos os espaços das extremidades, deve ter no mínimo 2 e no máximo 60 caracteres.
- **RN-04:** O nome é gravado como digitado quanto a maiúsculas, minúsculas e acentos, aplicando-se apenas duas normalizações de forma: remoção dos espaços das extremidades e colapso de sequências de espaços internos em um único espaço.
- **RN-05:** O nome do animal **não é único**. Dois animais podem se chamar "Theo" — são indivíduos distintos, e exigir unicidade seria arbitrário. Isso diverge deliberadamente da espécie, cujo nome é único porque é um rótulo de classificação, não de indivíduo.
- **RN-06:** O identificador do animal é estável: editar não o altera, e o identificador de um animal excluído nunca é reaproveitado.

**Espécie**

- **RN-07:** Todo animal tem exatamente uma espécie, obrigatória, escolhida entre as espécies cadastradas pela FEATURE-001 deste módulo. Não existe animal sem espécie, em nenhum momento do ciclo de vida.
- **RN-08:** A espécie informada precisa existir no momento da gravação. Se não existir, a operação é recusada como "espécie não encontrada" e nada é gravado.
- **RN-09:** O vínculo do animal com a espécie é declarado com comportamento **restritivo** na integridade referencial do banco. `Cascade` e `SetNull` são **proibidos** neste vínculo: o primeiro apagaria animais silenciosamente ao excluir uma espécie e o segundo produziria animais sem classificação. Esta regra é herdada das RN-08 e RN-09 da FEATURE-001 deste módulo e **não é renegociável** por esta spec.
- **RN-10:** Excluir um animal nunca afeta a sua espécie. A espécie continua cadastrada, ainda que fique sem nenhum animal vinculado.

**Porte, sexo e status**

- **RN-11:** O porte é obrigatório e pertence a um conjunto fechado de três valores: Pequeno, Médio e Grande. Qualquer outro valor é recusado.
- **RN-12:** O sexo é obrigatório e pertence a um conjunto fechado de dois valores: Macho e Fêmea. Qualquer outro valor é recusado.
- **RN-13:** O status do animal é obrigatório e pertence a um conjunto fechado de quatro valores, com o seguinte significado de negócio:
  - **Disponível** — o animal está apto a ser exibido na vitrine e a receber pedidos de interesse.
  - **Reservado** — existe pedido de interesse em andamento para este animal; ele não deve receber novos pedidos.
  - **Adotado** — o processo de adoção foi concluído e o animal saiu do catálogo ativo.
  - **Indisponível** — o animal está temporariamente fora da vitrine por decisão do administrador (tratamento veterinário, documentação pendente ou qualquer motivo operacional), sem que exista pedido em andamento.
- **RN-14:** Um animal recém-cadastrado nasce com status **Disponível**. O status não é escolhido no formulário de cadastro.
- **RN-15:** Qualquer transição entre os quatro status é permitida ao administrador, sem ordem obrigatória e sem confirmação. **Decisão deliberada, com prazo de validade:** a alternativa considerada era exigir a passagem por Reservado antes de Adotado, para que nenhuma adoção acontecesse sem pedido registrado. Ela foi descartada **por enquanto** porque o módulo de pedidos não existe: nada coloca um animal em Reservado automaticamente, e a regra obrigaria o administrador a encenar uma reserva manual para poder registrar uma adoção real. Encenar estado é pior do que não travar. A restrição volta à mesa quando o módulo de pedidos existir, e está registrada como pendência na seção de escopo diferido.
- **RN-16:** A alteração de status é uma **operação própria**, distinta da edição do animal. Ela é feita pela listagem, altera exclusivamente o status e não aceita nenhum outro campo. O formulário de edição não oferece o campo de status.
- **RN-17:** Nenhuma transição de status é automática nesta feature. A vinculação entre pedidos e status do animal — por exemplo, marcar Reservado quando um pedido é aberto — pertence ao módulo de pedidos e é explicitamente fora de escopo aqui.
- **RN-17a:** O status do animal **não espelha** as cinco etapas do pedido (Contato Inicial, Entrevista, Avaliação do espaço físico, Adaptação, Concluído). São duas máquinas de estado com donos diferentes: o pedido descreve o andamento de um atendimento, o animal descreve a disponibilidade de um indivíduo. Duplicar as etapas dentro do animal garantiria divergência entre as duas.
- **RN-17b:** **Pendência registrada para o módulo de pedidos.** Quando o pedido existir, um animal referenciado por algum pedido não poderá ser excluído, e o vínculo de pedido para animal deverá nascer com integridade referencial **restritiva**, jamais em cascata. Esta regra é escrita agora, antes de a entidade Pedido existir, precisamente porque a FEATURE-001 deste módulo precisou escrever a sua equivalente tarde e conviveu com uma regra verificável apenas por duplo de teste. Repetir o mesmo erro em silêncio seria pior do que cometê-lo pela primeira vez.

**Data de nascimento e idade**

- **RN-18:** A data de nascimento é **opcional**. Um animal resgatado frequentemente chega sem essa informação, e exigi-la produziria datas inventadas.
- **RN-19:** Quando informada, a data de nascimento não pode ser futura nem anterior a 30 anos da data atual. O limite superior é uma barreira de sanidade contra erro de digitação de ano, folgada em relação à longevidade de cães e gatos. **A comparação com "hoje" é feita no fuso America/Sao_Paulo, e não no fuso do processo:** com o servidor em UTC, às 22h em São Paulo já é o dia seguinte em UTC, e uma comparação ingênua recusaria como futura a data de hoje. A data de hoje é sempre aceita.
- **RN-20:** A idade do animal é **derivada** e corresponde ao número de anos completos entre a data de nascimento e a data atual. Ela **nunca é digitada e nunca é armazenada**: uma idade persistida envelheceria em silêncio e passaria a mentir sem que nada no sistema acusasse.
- **RN-21:** Quando a data de nascimento não foi informada, a idade é ausente — e ausente é diferente de zero. A interface exibe "Idade não informada" e a API devolve a idade como nula.
- **RN-22:** A idade é calculada a partir do relógio do servidor no fuso America/Sao_Paulo, para que o resultado não dependa do fuso do contêiner nem do navegador de quem consulta.

**Descrição e características de convivência**

- **RN-23:** A descrição é opcional e aceita no máximo 1000 caracteres, contados após a remoção dos espaços das extremidades.
- **RN-24:** O animal possui dois indicadores de convivência, ambos obrigatórios do ponto de vista do dado e sempre presentes: "aceita outros animais" e "precisa de espaço grande". Cada um assume apenas verdadeiro ou falso, nunca ausente, e ambos nascem falsos no cadastro.

**Localização**

- **RN-25:** O estado e a cidade são obrigatórios. O estado é identificado pela sigla de duas letras da unidade federativa.
- **RN-26:** A cidade informada precisa existir. Se não existir, a operação é recusada como "cidade não encontrada" e nada é gravado.
- **RN-26a:** O estado **não é enviado** ao servidor junto com o animal: o que trafega é apenas a cidade, e o estado é o estado daquela cidade. Assim o par incoerente — gravar "Campo Magro - ES" porque o administrador trocou o estado sem trocar a cidade — deixa de ser um erro a validar e passa a ser **impossível de representar** no contrato. Tornar o estado inválido inexprimível é mais forte do que validá-lo. O campo Estado do formulário existe apenas para reduzir a lista de cidades oferecida, e é responsabilidade da interface descartar a cidade escolhida quando o estado muda (RN-57).
- **RN-27:** A lista de estados e a lista de cidades são servidas pela própria aplicação, a partir de dados semeados no banco com base no recorte oficial das unidades federativas e municípios brasileiros. **O caminho do formulário não faz chamada a serviço externo em tempo de execução**, para que a indisponibilidade de terceiros não impeça o cadastro de animais.
- **RN-28:** A localização do animal é registrada como vínculo com a cidade cadastrada, e não como texto livre. O estado do animal é o estado daquela cidade, e não um dado independente que possa divergir dela.
- **RN-29:** O vínculo do animal com a cidade é restritivo: uma cidade referenciada por algum animal não pode ser removida do cadastro de apoio. Não há tela para remover cidades — a restrição existe para que uma manutenção de dados não produza animal sem localização.

**Imagens**

- **RN-30:** Um animal possui de **zero a cinco** imagens. Zero é válido: o administrador pode cadastrar o animal e enviar as fotos depois.
- **RN-31:** São aceitos exclusivamente os formatos **JPEG** e **PNG**.
- **RN-32:** Cada imagem tem no máximo **5 MB**.
- **RN-33:** O limite de cinco imagens, o formato e o tamanho são verificados **no servidor**. As restrições equivalentes no navegador — o filtro de tipos do seletor de arquivos e a checagem de tamanho antes do envio — existem apenas para dar retorno imediato ao administrador e **não são consideradas garantia**: quem chama a API diretamente recebe exatamente a mesma recusa.
- **RN-34:** O formato é determinado pelo **conteúdo real do arquivo**, e não pela extensão do nome nem pelo tipo declarado na requisição, ambos controlados por quem envia.
- **RN-35:** As imagens de um animal são ordenadas, e a **primeira da ordem é a imagem de capa** — a miniatura da listagem e a imagem principal da vitrine. A ordem é definida pelo administrador: as imagens mantidas preservam a ordem em que aparecem no formulário, e as recém-enviadas entram depois delas, na ordem de envio.
- **RN-36:** Na edição, uma imagem que o administrador removeu do formulário deixa de existir para o animal ao salvar. Cancelar a edição não remove nada.
- **RN-37:** Excluir um animal remove os registros das suas imagens e também os arquivos correspondentes do armazenamento. Não há imagem de animal inexistente no produto.
- **RN-38:** As imagens são guardadas em serviço de armazenamento de objetos, **fora do sistema de arquivos do contêiner da aplicação**, que é efêmero e perderia os arquivos a cada implantação.
- **RN-39:** A gravação de um animal é atômica em relação às suas imagens: ou o animal e as suas imagens são gravados, ou nada é gravado. Uma falha no armazenamento das imagens desfaz a alteração do animal.
- **RN-40:** Se a remoção de um arquivo do armazenamento falhar depois de o banco já ter sido atualizado, a operação **não** é revertida — o registro já não existe, portanto nenhum ponto do produto exibe aquela imagem. O arquivo remanescente é registrado no log como pendência de limpeza. O produto prefere um arquivo órfão invisível a uma exclusão que falha para o administrador.

**Listagem e integridade**

- **RN-41:** A listagem é ordenada alfabeticamente de forma crescente pelo nome, ignorando maiúsculas e minúsculas; empates de nome são desempatados pela data de cadastro mais recente e, persistindo o empate, pelo identificador do animal. **O desempate final pelo identificador é obrigatório e não é detalhe:** sem um critério que nunca empata, dois animais cadastrados no mesmo instante podem trocar de posição entre uma página e outra, fazendo um registro aparecer duas vezes e outro desaparecer.
- **RN-42:** A listagem **é paginada no servidor desde a primeira entrega**, com tamanho de página padrão de 20 registros e máximo de 100. O argumento que dispensou a paginação na FEATURE-001 deste módulo — dezenas de registros em tabela de apoio — **não se transfere**: o animal é a entidade de maior volume do produto e cresce sem teto. Acrescentar paginação depois quebraria o contrato do endpoint e os testes que já o consomem.
- **RN-42a:** A resposta da listagem informa, além dos itens, a página atual, o tamanho da página e o total de registros. A interface administrativa só apresenta controles de navegação entre páginas **quando o total excede o tamanho da página** — por isso a captura, com um único animal, não exibe nenhum controle e mesmo assim está em conformidade.
- **RN-42b:** A listagem não oferece busca nem filtro. Ambos pertencem à feature de filtragem da vitrine.
- **RN-43:** A listagem informa o total de animais cadastrados, com concordância correta em todos os casos: "Nenhum animal cadastrado" para zero, "Total: 1 animal" para um e "Total: N animais" para dois ou mais. A captura exibe "Total: 1 animais", que é defeito de concordância visível na própria fonte da verdade e está corrigido por esta regra.
- **RN-44:** Operações de consulta, edição, alteração de status ou exclusão sobre um animal inexistente são recusadas como "não encontrado", sem distinguir se o registro nunca existiu ou se já foi excluído.
- **RN-45:** A exclusão de animal é definitiva. Não há inativação, arquivamento nem lixeira, e o registro não é recuperável pela aplicação. O status Indisponível atende quem quer apenas tirar o animal da vitrine sem perder o cadastro.
- **RN-46:** Nenhum campo além dos previstos é aceito no corpo das requisições de cadastro, edição e alteração de status.

**Concorrência**

- **RN-47:** A edição e a alteração de status usam **bloqueio otimista**: quem grava informa a marca de última alteração que leu, e a gravação é recusada se o registro tiver mudado nesse meio-tempo. A situação não é hipotética — o mesmo animal é editável pelo formulário e alterável pela listagem ao mesmo tempo, em abas diferentes, e sem essa guarda a última gravação apaga a anterior sem que ninguém perceba.
- **RN-48:** Recusada uma gravação por conflito de concorrência, nada é alterado e o administrador é informado de que o registro mudou, para reabrir e refazer a alteração sobre a versão atual.

**Preparo e envio de imagens**

- **RN-49:** As imagens escolhidas no formulário ficam **em preparo no navegador** até o administrador acionar "Salvar". Nada é gravado no armazenamento e nada é removido dele antes disso. Um botão "Cancelar" que não desfizesse a remoção de uma foto seria uma armadilha, já que a captura o apresenta como saída legítima do formulário.
- **RN-50:** O limite de cinco imagens é verificado sobre o **estado final** do animal, e não sobre o que está sendo enviado: três imagens já gravadas mais três novas é recusado, porque somariam seis; e cinco existentes das quais três são removidas, mais três novas, é aceito, porque o estado final volta a ser cinco. A interface informa quantas ainda cabem antes de deixar o administrador enviar.
- **RN-51:** O corpo da requisição de cadastro e de edição tem tamanho total máximo próprio, dimensionado para cinco imagens de 5 MB mais os campos de texto. Ultrapassá-lo produz **mensagem de negócio em PT-BR**, nunca o erro genérico do servidor de borda — cinco arquivos de 5 MB somam 25 MB e essa é exatamente a falha que só aparece em produção, com o frontend recebendo um erro que não sabe traduzir.
- **RN-52:** O nome do arquivo enviado pelo administrador **nunca** é usado para compor o caminho do objeto no armazenamento. O caminho é gerado pela aplicação a partir do identificador do animal e de um identificador próprio da imagem. Nomes com `../`, com emoji ou com centenas de caracteres, portanto, não têm como influenciar onde o arquivo é gravado.
- **RN-53:** Formatos que carregam código executável são recusados, e o caso concreto a barrar é o **SVG**: um SVG aceito e servido a partir de um balde de leitura pública executaria script no navegador de quem abrisse a imagem. A verificação por assinatura binária da RN-34 é o que barra o SVG e qualquer outro formato disfarçado de `.jpg`.
- **RN-54:** Arquivo de tamanho zero é recusado como imagem inválida.
- **RN-55:** O vínculo entre animal e imagem é declarado **em cascata**: excluído o animal, os registros das suas imagens vão junto. Isto **não** contradiz a proibição de cascata da RN-09, que se refere exclusivamente ao vínculo entre animal e espécie. A distinção é de propriedade: a imagem não tem existência própria fora do animal e mantê-la produziria lixo permanente, enquanto a espécie existe independentemente e sobrevive a qualquer animal.

**Localização — casos de manutenção e de corrida**

- **RN-56:** Se a cidade gravada em um animal deixar de constar na lista ativa — por renomeação ou reorganização municipal —, o formulário de edição continua exibindo a cidade gravada como escolhida, em vez de apagá-la em silêncio. O administrador só perde aquele valor se escolher outro deliberadamente.
- **RN-57:** Quando o administrador troca de estado mais de uma vez em sequência rápida, a interface descarta respostas que chegam fora de ordem. Vale sempre a lista de cidades do estado escolhido por último, e nunca a de uma consulta anterior que demorou mais para responder.
- **RN-58:** Uma falha ao obter as cidades **nunca** é apresentada como campo de seleção vazio, que se leria como "este estado não tem cidades". A falha é apresentada como falha, com possibilidade de nova tentativa.

**Separação entre o que é público e o que é interno**

- **RN-59:** As respostas voltadas ao público — a vitrine, feature seguinte deste módulo — são montadas por **projeção explícita dos campos públicos**, jamais serializando a entidade Animal inteira. Esta feature não possui nenhum campo interno hoje, e é exatamente por isso que a regra precisa nascer agora: quando o número do chip e o contato do proprietário entrarem, como o escopo aprovado do produto prevê, eles não vazarão por padrão apenas porque alguém devolveu o objeto inteiro. A regra é uma restrição vinculante para a feature de vitrine.
- **RN-60:** A listagem administrativa sinaliza, de forma discreta, animais com status Disponível que ainda não possuem nenhuma imagem. É sinalização, não bloqueio: o administrador cadastra o animal em campo e fotografa depois, e impedir o cadastro sem foto atrapalharia a operação real.

---

### Requisitos Funcionais

#### O que o sistema exibe ao ser acessado

**Tela de listagem (`/admin/animais`)**

1. **Navegação administrativa lateral**, à esquerda, com os itens "Animais" e "Espécies", sendo "Animais" o item ativo enquanto esta tela está aberta.
2. **Título da página:** "Animais", com o botão primário **"Cadastrar Animal"** alinhado à direita, na mesma altura.
3. **Tabela** com as colunas, nesta ordem: ANIMAL, ESPÉCIE, PORTE, LOCALIZAÇÃO, STATUS, ALTERAR STATUS, AÇÕES.
   - **ANIMAL:** miniatura da imagem de capa à esquerda, nome do animal à direita. Sem imagens, um marcador visual neutro ocupa o lugar da miniatura. Animal com status Disponível e sem nenhuma imagem recebe um indicador discreto de pendência de foto (RN-60).
   - **ESPÉCIE:** nome da espécie vinculada.
   - **PORTE:** "Pequeno", "Médio" ou "Grande".
   - **LOCALIZAÇÃO:** "Cidade - UF", como em "Boa Esperança - ES".
   - **STATUS:** selo colorido, somente leitura — verde para "Disponível", âmbar para "Reservado", cinza para "Adotado" e vermelho suave para "Indisponível".
   - **ALTERAR STATUS:** campo de seleção na própria linha, posicionado no status atual, com as quatro opções.
   - **AÇÕES:** botões "Editar" e "Excluir".
4. **Rodapé da tabela** com a contagem total (RN-43) e, apenas quando o total excede o tamanho da página, os controles de navegação entre páginas.
5. **Estado de carregamento:** indicador no lugar da tabela; o título e o botão "Cadastrar Animal" permanecem visíveis.
6. **Estado vazio:** "Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima.", com o botão de cadastro disponível.
7. **Estado de falha:** "Não foi possível carregar os animais. Tente novamente.", com ação de nova tentativa.

**Tela de formulário (`/admin/animais/novo` e `/admin/animais/:id/editar`)**

Título "Cadastrar Animal" ou "Editar Animal" conforme o caso. Campos em duas colunas, na ordem observada nas capturas:

| Posição | Campo | Tipo | Obrigatório |
|---|---|---|---|
| Linha 1, esquerda | Nome | Texto | Sim |
| Linha 1, direita | Data de nascimento | Seletor de data | Não |
| Linha 2, esquerda | Espécie | Seleção | Sim |
| Linha 2, direita | Porte | Seleção | Sim |
| Linha 3, esquerda | Sexo | Seleção | Sim |
| Linha 3, direita | Estado | Seleção (sigla) | Sim |
| Linha 4, largura inteira | Cidade | Seleção | Sim |
| Linha 5, largura inteira | Descrição | Área de texto | Não |
| Linha 6 | "Aceita outros animais" e "Precisa de espaço grande" | Alternâncias, lado a lado | Sempre presentes, iniciam desligadas |
| Linha 7 | Imagens | Envio com pré-visualização | Não |

A área de imagens exibe o rótulo literal **"Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)"**, as miniaturas das imagens já escolhidas ou já gravadas — cada uma com um "x" de remoção no canto superior direito —, o botão "Escolher arquivos" e, ao lado dele, "Nenhum arquivo escolhido" enquanto não houver escolha.

O rodapé do formulário traz **"Cancelar"** (secundário) e **"Salvar"** (primário), alinhados à direita. **Não existe campo de status no formulário** (RN-16).

#### Ações disponíveis

**Ação 1 — Cadastrar animal**

O administrador aciona "Cadastrar Animal", preenche o formulário e aciona "Salvar".
- Se todos os obrigatórios forem válidos → o animal é criado com status Disponível, exibe "Animal cadastrado com sucesso." e a aplicação volta à listagem.
- Se algum obrigatório estiver ausente → cada campo pendente exibe "Este campo é obrigatório."; todos são sinalizados de uma vez e o foco vai ao primeiro; nada é criado.
- Se a espécie escolhida não existir mais → exibe "Espécie não encontrada."; nada é criado.
- Se a cidade escolhida não existir → exibe "Cidade não encontrada."; nada é criado.
- Se alguma imagem violar quantidade, formato ou tamanho → exibe a mensagem correspondente; **nada** é criado e nenhum arquivo permanece no armazenamento.
- Enquanto a gravação estiver em andamento → "Salvar" fica desabilitado.

**Ação 2 — Escolher estado e, em seguida, cidade**

- Sem estado escolhido → o campo Cidade fica desabilitado, exibindo "Escolha primeiro o estado".
- Estado escolhido, cidades sendo obtidas → o campo Cidade exibe "Carregando cidades..." e não aceita escolha.
- Cidades obtidas → o campo oferece apenas cidades daquele estado, em ordem alfabética.
- Estado trocado → a cidade escolhida é descartada e a lista é substituída (RN-26a).
- Estado trocado mais de uma vez em sequência rápida → vale a lista do último estado escolhido; respostas fora de ordem são descartadas (RN-57).
- Falha ao obter as cidades → exibe "Não foi possível carregar as cidades. Tente novamente." com nova tentativa; **nunca** um campo vazio (RN-58).

**Ação 3 — Escolher, remover e ordenar imagens**

- Arquivo válido escolhido → miniatura acrescentada ao fim da ordem, com "x" de remoção.
- "x" acionado → a miniatura sai da ordem. Se a imagem já estava gravada, ela só deixa de existir ao salvar (RN-49).
- Estado final acima de cinco imagens → recusado antes do envio, informando quantas ainda cabem (RN-50).
- "Cancelar" acionado → nada é gravado e nada é removido.

**Ação 4 — Editar animal**

O administrador aciona "Editar", altera o que precisa e aciona "Salvar".
- Se tudo for válido → as alterações são gravadas, exibe "Animal atualizado com sucesso." e volta à listagem.
- Se o animal não existir mais → exibe "Animal não encontrado." e volta à listagem atualizada.
- Se o animal tiver sido alterado por outra pessoa → exibe "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." e nada é gravado (RN-47).
- "Cancelar" → volta à listagem sem gravar.

**Ação 5 — Alterar status pela listagem**

- Status diferente escolhido → gravado imediatamente, o selo é atualizado e exibe "Status atualizado com sucesso."
- Mesmo status escolhido → nenhuma requisição é enviada e nada muda (RN-16).
- Requisição em andamento → o campo fica indisponível.
- Falha → o campo volta ao valor anterior e exibe "Não foi possível atualizar o status. Tente novamente."
- Animal inexistente → exibe "Animal não encontrado." e a lista é atualizada.
- Conflito de concorrência → exibe "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." e a lista é atualizada.

**Ação 6 — Excluir animal**

O administrador aciona "Excluir".
- Confirmação exibida: "Excluir o animal “{nome}”? Esta ação não pode ser desfeita."
  - Cancelado → nenhuma ação é executada.
  - Confirmado → o animal e os registros das suas imagens são removidos, os arquivos são apagados do armazenamento, a contagem é atualizada e exibe "Animal excluído com sucesso."
  - Confirmado e o animal já não existe → exibe "Animal não encontrado." e a lista é atualizada.

---

#### Validações e Restrições

| Campo | Regra |
|---|---|
| Nome | Obrigatório; 2 a 60 caracteres após normalização de espaços; não é único (RN-05) |
| Espécie | Obrigatória; precisa existir no momento da gravação |
| Porte | Obrigatório; um entre Pequeno, Médio, Grande |
| Sexo | Obrigatório; um entre Macho, Fêmea |
| Cidade | Obrigatória; precisa existir. O estado é derivado dela e não trafega |
| Data de nascimento | Opcional; não futura no fuso America/Sao_Paulo; não anterior a 30 anos |
| Descrição | Opcional; no máximo 1000 caracteres após normalização de espaços |
| Aceita outros animais | Sempre presente; verdadeiro ou falso; inicia falso |
| Precisa de espaço grande | Sempre presente; verdadeiro ou falso; inicia falso |
| Status | Não aceito no cadastro nem na edição; alterado só pela operação própria; um entre os quatro valores |
| Imagens | 0 a 5 no estado final; apenas JPEG e PNG por assinatura binária; 1 byte a 5 MB cada; corpo total limitado |

Restrições adicionais:
- Toda validação acima é executada **no servidor**. As checagens equivalentes no navegador servem apenas para retorno imediato (RN-33).
- Nenhum campo além dos previstos é aceito no corpo das requisições.
- A exclusão exige confirmação explícita — não há exclusão em um único acionamento.
- A tela inteira e todos os endpoints são acessíveis apenas ao perfil `admin`.

---

#### Mensagens ao Usuário

| Condição | Mensagem |
|---|---|
| Animal cadastrado com sucesso | "Animal cadastrado com sucesso." |
| Animal atualizado com sucesso | "Animal atualizado com sucesso." |
| Status atualizado com sucesso | "Status atualizado com sucesso." |
| Animal excluído com sucesso | "Animal excluído com sucesso." |
| Campo obrigatório em branco | "Este campo é obrigatório." |
| Nome com menos de 2 caracteres | "O nome do animal deve ter no mínimo 2 caracteres." |
| Nome com mais de 60 caracteres | "O nome do animal deve ter no máximo 60 caracteres." |
| Descrição acima do limite | "A descrição deve ter no máximo 1000 caracteres." |
| Data de nascimento futura | "A data de nascimento não pode ser futura." |
| Data de nascimento muito antiga | "Informe uma data de nascimento dos últimos 30 anos." |
| Porte, sexo ou status fora da lista | "Selecione uma opção válida." |
| Espécie inexistente | "Espécie não encontrada." _(texto já definido pela FEATURE-001 deste módulo)_ |
| Cidade inexistente | "Cidade não encontrada." |
| Animal inexistente | "Animal não encontrado." |
| Conflito de concorrência | "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." |
| Acima de 5 imagens | "É permitido no máximo 5 imagens por animal." |
| Formato de imagem não aceito | "Apenas imagens JPEG ou PNG são aceitas." |
| Imagem acima de 5 MB | "Cada imagem deve ter no máximo 5 MB." |
| Arquivo vazio | "O arquivo enviado está vazio." |
| Corpo da requisição grande demais | "O envio ultrapassou o tamanho máximo permitido. Envie menos imagens ou imagens menores." |
| Falha ao gravar imagens | "Não foi possível salvar as imagens. Tente novamente." |
| Confirmação antes de excluir | "Excluir o animal “{nome}”? Esta ação não pode ser desfeita." |
| Lista vazia | "Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima." |
| Falha ao carregar a lista | "Não foi possível carregar os animais. Tente novamente." |
| Falha ao carregar as cidades | "Não foi possível carregar as cidades. Tente novamente." |
| Cidade sem estado escolhido | "Escolha primeiro o estado" |
| Cidades em carregamento | "Carregando cidades..." |
| Idade sem data de nascimento | "Idade não informada" |
| Acesso sem permissão | "Você não tem permissão para acessar este recurso." _(texto já existente)_ |
| Sessão expirada | "Sua sessão expirou. Faça login novamente." _(texto já existente)_ |
| Falha inesperada | "Ocorreu um erro inesperado. Tente novamente." _(texto já existente)_ |

Conforme a convenção já vigente no frontend, mensagens produzidas pelo backend **não** são duplicadas no catálogo de textos da interface — elas chegam prontas na resposta de erro. Apenas os textos puramente de interface ("Carregando cidades...", "Escolha primeiro o estado", "Idade não informada", rótulos e confirmação) vivem no catálogo do frontend.

---

#### Integrações

Esta feature introduz **uma** dependência externa em tempo de execução, e a introduz deliberadamente restrita ao caminho de escrita.

| Sistema externo | O que é enviado | O que é recebido | Em caso de falha |
|---|---|---|---|
| Armazenamento de objetos do Supabase | Arquivos de imagem, no cadastro e na edição; pedidos de remoção, na exclusão | Confirmação da gravação e caminho do objeto | **Na gravação:** a alteração do animal é desfeita por inteiro e o administrador recebe "Não foi possível salvar as imagens. Tente novamente." (RN-39). **Na remoção:** a operação **não** é revertida; o arquivo remanescente é registrado no log como pendência de limpeza (RN-40) |

**O que esta feature deliberadamente não integra:** o serviço de dados abertos do IBGE. Estados e cidades vêm de tabelas próprias do banco, semeadas a partir do recorte oficial. A decisão e as alternativas descartadas estão registradas no changelog.

**Leitura das imagens:** o navegador busca as imagens diretamente no armazenamento, pela URL do objeto. Elas **não** passam pela API — nem no cadastro administrativo, nem na vitrine.

---

### Contrato de API

Todos os endpoints exigem sessão ativa e role `admin` (RN-01, RN-02) e respondem erro no envelope já congelado:

```
{ "error": { "code": "STRING_ESTAVEL", "message": "texto em PT-BR", "details": [ { "field": "nome.do.campo", "message": "texto" } ] } }
```

`details` só existe em falhas de validação. O frontend ramifica sempre por `code`, nunca pelo texto de `message`.

**Convenções herdadas e mantidas:** rotas de API em inglês (`/api/animals`), rotas de interface em PT-BR (`/admin/animais`); `PATCH` em vez de `PUT`, porque o CORS em vigor não libera `PUT`; envelope de coleção `{ items: [...] }`.

**Valores de conjunto fechado no contrato.** Porte, sexo e status trafegam em **minúsculas e sem acento** — `"pequeno"`, `"medio"`, `"grande"`, `"macho"`, `"femea"`, `"disponivel"`, `"reservado"`, `"adotado"`, `"indisponivel"` —, seguindo o precedente já em vigor de `role`, que é `UserRole.ADMIN` no banco e `"admin"` no contrato. Os rótulos acentuados em PT-BR ("Médio", "Fêmea", "Disponível") são responsabilidade da interface.

**Representação do animal** devolvida pelos endpoints que retornam recurso:

```json
{
  "id": "c7066355-5591-4a6f-a3f8-2a9ee727b2d0",
  "name": "Theo",
  "species": { "id": "6f6d2b4e-6f7e-4d3f-9c1a-1f2b3c4d5e6f", "name": "Cachorro" },
  "size": "grande",
  "sex": "macho",
  "status": "disponivel",
  "birthDate": "2022-11-05",
  "ageInYears": 3,
  "description": "Theo",
  "acceptsOtherAnimals": true,
  "needsLargeSpace": false,
  "city": { "id": "…", "name": "Campo Magro", "stateUf": "PR" },
  "images": [
    { "id": "…", "url": "https://…/animals/c7066355…/1a2b3c.jpg", "position": 0 },
    { "id": "…", "url": "https://…/animals/c7066355…/4d5e6f.png", "position": 1 }
  ],
  "createdAt": "2026-08-25T13:40:12.481Z",
  "updatedAt": "2026-08-25T13:40:12.481Z"
}
```

- `birthDate` é data pura (`AAAA-MM-DD`), sem hora e sem fuso — uma data de nascimento não tem horário.
- `ageInYears` é **calculado a cada resposta** e é `null` quando `birthDate` é `null` (RN-20, RN-21).
- `images` vem sempre ordenado por `position`; `position` 0 é a capa (RN-35).
- `updatedAt` é também o **token de concorrência** exigido de volta na edição e na alteração de status (RN-47).

**Por que o token de concorrência viaja no corpo e não em cabeçalho:** o cabeçalho convencional para isso seria `If-Match`, mas o CORS em vigor libera apenas `Content-Type` e `Authorization`. Usar cabeçalho exigiria alterar uma configuração transversal fora do escopo desta feature — o mesmo raciocínio que já levou a spec anterior a preferir `PATCH` a `PUT`.

---

#### `GET /api/animals` — listar animais

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetros | `page` (inteiro ≥ 1, padrão 1), `pageSize` (inteiro entre 1 e 100, padrão 20) |
| Sucesso | `200 OK` |

```json
{
  "items": [ { "id": "…", "name": "Theo", "species": { "…": "…" }, "…": "…" } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1 }
}
```

O envelope `{ items: [...] }` da FEATURE-001 deste módulo é **estendido de forma aditiva** com `pagination` — quem já consome `items` não é afetado. Ordenação conforme a RN-41. Lista vazia responde `200` com `items: []` e `total: 0` — nunca `404`.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `page` ou `pageSize` fora da faixa | 400 | `VALIDATION_ERROR` | "Verifique os campos informados." |
| Sem sessão / token inválido ou vencido | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Sessão válida com role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |

---

#### `GET /api/animals/:id` — consultar um animal

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetro de caminho | `id` — UUID |
| Sucesso | `200 OK` com a representação do animal |

Alimenta o formulário de edição, inclusive `updatedAt`, que volta como token de concorrência.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `id` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "id", message: "Identificador inválido." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Animal inexistente (RN-44) | 404 | `ANIMAL_NOT_FOUND` | "Animal não encontrado." |

---

#### `POST /api/animals` — cadastrar animal

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Tipo de conteúdo | `multipart/form-data` |
| Sucesso | `201 Created` com o animal criado |

Campos do corpo:

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `name` | texto | Sim | 2 a 60 caracteres após normalização |
| `speciesId` | texto (UUID) | Sim | |
| `size` | texto | Sim | `pequeno` \| `medio` \| `grande` |
| `sex` | texto | Sim | `macho` \| `femea` |
| `cityId` | texto (UUID) | Sim | O estado é derivado dela (RN-26a) |
| `birthDate` | texto (`AAAA-MM-DD`) | Não | |
| `description` | texto | Não | até 1000 caracteres |
| `acceptsOtherAnimals` | texto `"true"`/`"false"` | Não | padrão `false` |
| `needsLargeSpace` | texto `"true"`/`"false"` | Não | padrão `false` |
| `images` | arquivo, repetível | Não | 0 a 5 arquivos |

`status` **não** é aceito: o animal nasce Disponível (RN-14). Qualquer chave não prevista é recusada com `400 VALIDATION_ERROR`.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| Campo obrigatório ausente ou inválido | 400 | `VALIDATION_ERROR` | "Verifique os campos informados." + `details` por campo |
| Campo não previsto no corpo | 400 | `VALIDATION_ERROR` | `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` |
| Acima de 5 imagens | 400 | `ANIMAL_IMAGE_LIMIT_EXCEEDED` | "É permitido no máximo 5 imagens por animal." |
| Arquivo de 0 byte | 400 | `VALIDATION_ERROR` | "O arquivo enviado está vazio." |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Espécie inexistente (RN-08) | 404 | `SPECIES_NOT_FOUND` | "Espécie não encontrada." |
| Cidade inexistente (RN-26) | 404 | `CITY_NOT_FOUND` | "Cidade não encontrada." |
| Imagem acima de 5 MB | 413 | `ANIMAL_IMAGE_TOO_LARGE` | "Cada imagem deve ter no máximo 5 MB." |
| Corpo total acima do limite (RN-51) | 413 | `REQUEST_BODY_TOO_LARGE` | "O envio ultrapassou o tamanho máximo permitido. Envie menos imagens ou imagens menores." |
| Formato de imagem não aceito (RN-31, RN-34, RN-53) | 415 | `ANIMAL_IMAGE_TYPE_NOT_ALLOWED` | "Apenas imagens JPEG ou PNG são aceitas." |
| Armazenamento indisponível (RN-39) | 503 | `IMAGE_STORAGE_UNAVAILABLE` | "Não foi possível salvar as imagens. Tente novamente." |

---

#### `PATCH /api/animals/:id` — editar animal

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Tipo de conteúdo | `multipart/form-data` |
| Parâmetro de caminho | `id` — UUID |
| Sucesso | `200 OK` com o animal atualizado |

Mesmos campos do `POST`, mais dois:

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `updatedAt` | texto (data e hora) | Sim | Token de concorrência lido no `GET` (RN-47) |
| `keepImageIds` | texto (lista JSON de UUID) | Sim | Identificadores das imagens que permanecem, **na ordem desejada**. Lista vazia remove todas |

Ordem final das imagens: primeiro as de `keepImageIds`, na ordem informada; depois as de `images`, na ordem de envio. A soma das duas não pode passar de cinco (RN-50). Toda imagem gravada que não estiver em `keepImageIds` é removida (RN-36). `status` continua não sendo aceito (RN-16).

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| Validação de campo, incluindo `id` malformado | 400 | `VALIDATION_ERROR` | Mesmas mensagens por campo do `POST` |
| `keepImageIds` com identificador que não pertence a este animal | 400 | `VALIDATION_ERROR` | `details: [{ field: "keepImageIds", message: "Imagem não encontrada." }]` |
| Estado final acima de 5 imagens (RN-50) | 400 | `ANIMAL_IMAGE_LIMIT_EXCEEDED` | "É permitido no máximo 5 imagens por animal." |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Animal inexistente (RN-44) | 404 | `ANIMAL_NOT_FOUND` | "Animal não encontrado." |
| Espécie inexistente | 404 | `SPECIES_NOT_FOUND` | "Espécie não encontrada." |
| Cidade inexistente | 404 | `CITY_NOT_FOUND` | "Cidade não encontrada." |
| Registro alterado por outra pessoa (RN-47) | 409 | `ANIMAL_STALE_UPDATE` | "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." |
| Imagem acima de 5 MB / corpo total acima do limite | 413 | `ANIMAL_IMAGE_TOO_LARGE` / `REQUEST_BODY_TOO_LARGE` | Conforme o `POST` |
| Formato de imagem não aceito | 415 | `ANIMAL_IMAGE_TYPE_NOT_ALLOWED` | "Apenas imagens JPEG ou PNG são aceitas." |
| Armazenamento indisponível | 503 | `IMAGE_STORAGE_UNAVAILABLE` | "Não foi possível salvar as imagens. Tente novamente." |

---

#### `PATCH /api/animals/:id/status` — alterar o status do animal

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Tipo de conteúdo | `application/json` |
| Parâmetro de caminho | `id` — UUID |
| Sucesso | `200 OK` com o animal atualizado |

```json
{ "status": "adotado", "updatedAt": "2026-08-25T13:40:12.481Z" }
```

Endpoint **separado** do `PATCH` genérico por decisão explícita (RN-16): a alteração de status tem regra própria e conjunto de campos disjunto do restante do animal. Misturá-los obrigaria um único tratador a validar duas gramáticas diferentes e a decidir, a cada requisição, qual delas se aplica. Nenhum campo além de `status` e `updatedAt` é aceito.

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `status` ausente, vazio, nulo, numérico ou fora da lista | 400 | `VALIDATION_ERROR` | `details: [{ field: "status", message: "Selecione uma opção válida." }]` |
| `id` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "id", message: "Identificador inválido." }]` |
| Campo não previsto no corpo | 400 | `VALIDATION_ERROR` | `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Animal inexistente | 404 | `ANIMAL_NOT_FOUND` | "Animal não encontrado." |
| Registro alterado por outra pessoa | 409 | `ANIMAL_STALE_UPDATE` | "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." |

Enviar o status que o animal já possui responde `200` sem efeito colateral — não é erro (RN-15). A interface, ainda assim, não envia a requisição nesse caso.

---

#### `DELETE /api/animals/:id` — excluir animal

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetro de caminho | `id` — UUID |
| Sucesso | `204 No Content`, sem corpo |

Remove o animal, os registros das suas imagens e os arquivos correspondentes do armazenamento (RN-37). A espécie e a cidade vinculadas **não** são afetadas (RN-10).

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `id` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "id", message: "Identificador inválido." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Animal inexistente (RN-44) | 404 | `ANIMAL_NOT_FOUND` | "Animal não encontrado." |

Falha ao remover os arquivos do armazenamento **não** altera a resposta: o `204` é devolvido, porque o registro já não existe e nenhum ponto do produto exibe aquela imagem. O arquivo remanescente é registrado no log (RN-40).

---

#### `GET /api/states` — listar unidades federativas

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Sucesso | `200 OK` |

```json
{ "items": [ { "uf": "AC", "name": "Acre" }, { "uf": "AL", "name": "Alagoas" } ] }
```

Sempre 27 itens, ordenados pela sigla. Falhas: `401 SESSION_EXPIRED`, `403 FORBIDDEN`.

---

#### `GET /api/states/:uf/cities` — listar cidades de uma unidade federativa

| Item | Valor |
|---|---|
| Autorização | Sessão ativa + role `admin` |
| Parâmetro de caminho | `uf` — sigla de duas letras |
| Sucesso | `200 OK` |

```json
{ "items": [ { "id": "…", "name": "Campo Magro" } ] }
```

Ordenado alfabeticamente pelo nome. Respondido a partir do banco, sem chamada a serviço externo (RN-27).

| Falha | Status | `code` | Mensagem |
|---|---|---|---|
| `uf` fora do formato de duas letras | 400 | `VALIDATION_ERROR` | `details: [{ field: "uf", message: "Identificador inválido." }]` |
| Sem sessão | 401 | `SESSION_EXPIRED` | "Sua sessão expirou. Faça login novamente." |
| Role `cliente` | 403 | `FORBIDDEN` | "Você não tem permissão para acessar este recurso." |
| Sigla inexistente | 404 | `STATE_NOT_FOUND` | "Estado não encontrado." |

---

#### Reaproveitamento de `GET /api/species`

O campo Espécie do formulário é alimentado pelo endpoint de listagem de espécies já entregue pela FEATURE-001 deste módulo. Esta feature **não** cria endpoint próprio de espécies e **não** altera aquele contrato.

---

#### Sobre limitação de taxa

Os endpoints desta feature **não** recebem limitador de taxa, pelo mesmo motivo já registrado na FEATURE-001: os limitadores existentes protegem endpoints de credencial contra força bruta e contra uso do servidor como ferramenta de spam, e nenhum dos dois riscos se aplica a um CRUD administrativo autenticado e de baixo volume. O envio de imagens acrescenta um consumo de banda e de armazenamento que, em tese, justificaria proteção; ele já está contido pelos limites de cinco imagens, de 5 MB por arquivo e de tamanho total do corpo, todos verificados no servidor, e o acesso é restrito a um administrador autenticado. Decisão registrada no changelog e revisável se o número de administradores crescer.

---

### Decisões de Arquitetura

Três pontos desta feature não estavam decididos em lugar nenhum do produto e precisavam ser fechados para que a spec fosse implementável. Cada um está registrado abaixo com as alternativas descartadas, e replicado no changelog.

---

#### Decisão A — Origem dos estados e cidades: tabela própria semeada, não consumo do IBGE em tempo de execução

O encadeamento estado → cidade sugere naturalmente o serviço de dados abertos do IBGE. A spec **não** o consome em tempo de execução.

| Alternativa | Por que foi descartada |
|---|---|
| **Frontend consultando o IBGE diretamente** | Colocaria um terceiro no caminho crítico do formulário e, pior, deixaria o servidor **sem fonte para validar** a cidade recebida: ele passaria a confiar em um identificador cuja origem não conhece, contrariando a exigência de validação de servidor para todos os campos. Introduziria ainda a primeira URL externa do frontend, que hoje só conhece a própria API |
| **Backend fazendo intermediação do IBGE, com cache** | Introduziria a **primeira chamada HTTP de saída do backend**. Hoje o serviço não possui cliente HTTP, URL base configurável, tempo limite nem política de nova tentativa — a única saída de rede além do banco é o envio de e-mail, isolado atrás de uma porta própria. Seria arquitetura nova inteira, com um novo modo de falha (IBGE fora do ar = cadastro de animal impedido) e latência de primeira chamada, para obter um dado que quase nunca muda |
| **Texto livre para cidade e estado** | Reintroduziria exatamente o problema que a FEATURE-001 deste módulo resolveu para espécies: "Curitiba", "curitiba" e "Ctba" conviveriam e quebrariam qualquer filtro por localização na vitrine |

**Escolhido:** tabelas `states` e `cities` no próprio banco, semeadas a partir de um recorte oficial do IBGE embarcado no repositório como dado de carga inicial. O IBGE continua sendo a **origem** do dado — mas como recorte aplicado na carga, não como dependência em tempo de execução.

Consequências aceitas e registradas: o recorte precisa ser atualizado manualmente quando houver mudança na divisão municipal brasileira, o que é raro e depende de lei; e a carga inicial acrescenta 27 estados e cerca de 5.600 municípios ao banco, volume irrelevante para o PostgreSQL. Em troca, a validação do par cidade/estado é uma consulta local, os testes são determinísticos, o formulário funciona sem rede externa e o desenvolvimento local não depende de terceiros.

---

#### Decisão B — Armazenamento das imagens: armazenamento de objetos do Supabase

| Alternativa | Por que foi descartada |
|---|---|
| **Sistema de arquivos do contêiner** | A hospedagem prevista tem disco efêmero: os arquivos desapareceriam a cada implantação e a cada reinício. As fotos do catálogo sumiriam sozinhas, e o defeito só apareceria depois do primeiro deploy |
| **Bytes da imagem em coluna do PostgreSQL** | Cinco imagens de até 5 MB por animal consumiriam a cota do banco em poucas dezenas de cadastros; toda leitura de imagem passaria pela aplicação e pelo agrupador de conexões, transformando a vitrine em carga sobre o banco; e cada cópia de segurança carregaria os binários junto |
| **Serviço de armazenamento ou CDN contratado à parte** | O produto não contrata serviço pago para esta feature |

**Escolhido:** o armazenamento de objetos do próprio Supabase, já parte da infraestrutura contratada — os schemas de armazenamento existem no banco, apenas nunca foram usados. Balde dedicado, com leitura pública e escrita restrita à credencial de serviço, mantida apenas no servidor.

**Fluxo de envio:** o navegador envia os arquivos para a **API da aplicação**, que valida e só então grava no armazenamento.

| Alternativa de fluxo | Por que foi descartada |
|---|---|
| **Envio direto do navegador com URL assinada** | Tiraria a validação de formato e tamanho do controle do servidor — exatamente a garantia que esta spec exige — e exigiria entregar credencial de envio ao cliente |

Consequência reconhecida: esta é a **primeira chamada HTTP de saída do backend**, o mesmo custo que levou a Decisão A a recusar o IBGE. A diferença que justifica o tratamento distinto é o **caminho**: o armazenamento só é acionado nas operações de escrita de animal, feitas por um administrador que pode repetir a tentativa, enquanto o IBGE estaria no caminho de leitura de toda abertura de formulário. E, para as imagens, alguma dependência externa é inescapável — o disco local não serve. A integração é isolada atrás de uma porta própria, no mesmo formato já usado pelo envio de e-mail, para que o restante do código não conheça o fornecedor e os testes possam substituí-lo por um duplo.

---

#### Decisão C — Porte, sexo e status como enumerações, não como tabelas de apoio

Espécie ganhou tela e tabela próprias porque é uma lista **que o administrador mantém**. Porte, sexo e status não são: são conjuntos fechados, definidos pelo domínio, que só mudam por decisão de produto acompanhada de mudança de comportamento. A própria navegação lateral das capturas é a evidência — ela tem "Animais" e "Espécies", e não "Portes" ou "Sexos".

**Escolhido:** enumerações no banco, no mesmo padrão já usado por `UserRole` e `UserStatus`, com literais em PT-BR sem acento (`PEQUENO`, `MEDIO`, `GRANDE`, `MACHO`, `FEMEA`, `DISPONIVEL`, `RESERVADO`, `ADOTADO`, `INDISPONIVEL`), seguindo o precedente de `CLIENTE`. Os rótulos acentuados exibidos ao administrador — "Médio", "Fêmea", "Disponível" — vivem na interface.

Descartado incluir "não informado" em porte ou sexo: os dois campos são obrigatórios e a vitrine usa ambos como critério de decisão do cliente.

---

### Modelo de Dados

Convenções físicas herdadas: modelo em PascalCase e campos em camelCase, mapeados por `@@map` / `@map` para tabela snake_case plural e coluna snake_case; identificador `uuid`; colunas de data e hora em `Timestamptz(3)`.

```prisma
/// Faixa de tamanho do animal adulto (RN-11). Conjunto fechado — ver Decisão C.
enum AnimalSize {
  PEQUENO
  MEDIO
  GRANDE
}

/// Sexo do animal (RN-12). Sem "nao informado": o campo é obrigatório.
enum AnimalSex {
  MACHO
  FEMEA
}

/// Situacao do animal no ciclo de adocao (RN-13).
/// NAO espelha as etapas do Pedido — sao maquinas de estado distintas (RN-17a).
enum AnimalStatus {
  DISPONIVEL
  RESERVADO
  ADOTADO
  INDISPONIVEL
}

/// Unidade federativa. Dado de apoio semeado a partir do recorte oficial do
/// IBGE (Decisao A). Nao ha tela de manutencao.
model State {
  id   String @id @default(uuid()) @db.Uuid
  uf   String @unique @db.Char(2)
  name String @db.VarChar(60)

  cities City[]

  @@map("states")
}

/// Municipio. `ibgeCode` guarda o codigo oficial para que uma futura
/// atualizacao do recorte case por identidade estavel, e nao por nome.
model City {
  id       String @id @default(uuid()) @db.Uuid
  stateId  String @map("state_id") @db.Uuid
  name     String @db.VarChar(120)
  ibgeCode Int    @unique @map("ibge_code")

  state   State    @relation(fields: [stateId], references: [id], onDelete: Restrict)
  animals Animal[]

  @@index([stateId, name])
  @@map("cities")
}

/// Animal do catalogo. FEATURE-002 do MODULE-002 — Catalogo de pets.
model Animal {
  id String @id @default(uuid()) @db.Uuid
  /// Nome como o administrador digitou, normalizado quanto a espacos (RN-04).
  name String @db.VarChar(60)
  /// Nome em minusculas, usado APENAS para ordenar ignorando caixa (RN-41).
  /// Deliberadamente NAO e `@unique`: nome de animal se repete (RN-05).
  /// Mesmo mecanismo da FEATURE-001, com finalidade diferente — la garante
  /// unicidade, aqui garante ordenacao estavel.
  nameNormalized String @map("name_normalized") @db.VarChar(60)

  speciesId String @map("species_id") @db.Uuid
  cityId    String @map("city_id") @db.Uuid

  size   AnimalSize
  sex    AnimalSex
  status AnimalStatus @default(DISPONIVEL)

  /// Data pura, sem hora e sem fuso (RN-18, RN-19). A idade NAO e persistida
  /// (RN-20): idade gravada envelhece em silencio e passa a mentir.
  birthDate   DateTime? @map("birth_date") @db.Date
  description String?   @db.VarChar(1000)

  acceptsOtherAnimals Boolean @default(false) @map("accepts_other_animals")
  needsLargeSpace     Boolean @default(false) @map("needs_large_space")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  /// Tambem e o token de bloqueio otimista da RN-47.
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  /// RESTRITIVO, jamais Cascade ou SetNull (RN-09). Herdado das RN-08/RN-09 da
  /// FEATURE-001 deste modulo e nao renegociavel: Cascade apagaria animais em
  /// silencio ao excluir uma especie e SetNull produziria animal sem classificacao.
  species Species @relation(fields: [speciesId], references: [id], onDelete: Restrict)
  /// Restritivo pelo mesmo motivo: manutencao no cadastro de apoio nao pode
  /// produzir animal sem localizacao (RN-29).
  city    City    @relation(fields: [cityId], references: [id], onDelete: Restrict)

  images AnimalImage[]

  /// Cobre a ordenacao da RN-41 inteira, incluindo os dois criterios de desempate.
  @@index([nameNormalized, createdAt, id])
  @@index([speciesId])
  @@index([cityId])
  @@index([status])
  @@map("animals")
}

/// Imagem do animal. O arquivo vive no armazenamento de objetos; aqui fica o
/// registro que o localiza e o ordena (Decisao B).
model AnimalImage {
  id       String @id @default(uuid()) @db.Uuid
  animalId String @map("animal_id") @db.Uuid
  /// Caminho do objeto, SEMPRE gerado pela aplicacao (RN-52). O nome do arquivo
  /// enviado pelo administrador nunca compoe este valor.
  storagePath String @map("storage_path") @db.VarChar(255)
  /// Posicao na ordem. 0 e a capa (RN-35).
  position    Int
  /// Tipo real, apurado por assinatura binaria (RN-34), nao pelo tipo declarado.
  contentType String @map("content_type") @db.VarChar(30)
  sizeBytes   Int    @map("size_bytes")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  /// EM CASCATA, e isto NAO contradiz a RN-09: a proibicao de cascata vale para
  /// o vinculo animal→especie. A imagem nao tem existencia propria fora do
  /// animal, e mante-la produziria lixo permanente no balde (RN-55).
  animal Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)

  /// Indice, e NAO restricao de unicidade sobre (animalId, position): a
  /// restricao seria verificada a cada comando, e reordenar imagens dentro de
  /// uma transacao passaria por estados intermediarios com posicao repetida.
  /// A unicidade da ordem e responsabilidade do servico.
  @@index([animalId, position])
  @@map("animal_images")
}
```

**Alteração obrigatória no modelo existente:** o modelo `Species`, entregue pela FEATURE-001 deste módulo, possui a relação inversa `animals Animal[]` deixada comentada à espera desta feature. Ela precisa ser **descomentada** — é ela que torna a contagem de animais vinculados uma consulta real e permite que a chave estrangeira restritiva exista de fato.

**Migration:** cria as enumerações `AnimalSize`, `AnimalSex` e `AnimalStatus` e as tabelas `states`, `cities`, `animals` e `animal_images`. Nenhuma coluna de tabela existente é alterada; `species` apenas passa a ser referenciada. A migration é acompanhada de uma **carga inicial** dos 27 estados e dos municípios brasileiros, idempotente e reexecutável, casando registros pelo código oficial do IBGE.

---

### Impacto Técnico Transversal

Esta feature toca pontos fora do seu próprio domínio. Cada item abaixo é trabalho declarado, não detalhe de implementação, e vários deles são pré-requisito para que a tela sequer funcione.

**Backend**

| Ponto | Situação atual | O que esta feature exige |
|---|---|---|
| Leitura do corpo da requisição | O único leitor montado é o de JSON, com teto de 10 KB | Acrescentar leitura de `multipart/form-data` para as rotas de animal, com limites próprios de tamanho por arquivo, de quantidade e de corpo total (RN-51). O teto de 10 KB do leitor de JSON permanece para as demais rotas |
| Catálogo de códigos de estado HTTP | Não contempla 413 nem 415 | Acrescentar os dois. O arquivo é deliberadamente curto, com um código por regra que a aplicação realmente produz, e estas duas regras passam a existir |
| Verificação de permissão por role | O verificador existe e está testado, mas **nenhuma rota o monta** | Esta feature e a FEATURE-001 deste módulo são as primeiras a montá-lo. A ordem de montagem importa: autenticar antes de autorizar |
| Configuração por ambiente | Não há nenhuma variável de armazenamento | Acrescentar as variáveis do armazenamento de objetos no único ponto do backend que lê o ambiente, com validação que derruba a inicialização se estiverem ausentes, e replicá-las no arquivo de exemplo |
| Saída de rede | Só existe o envio de e-mail, isolado atrás de uma porta | Acrescentar o armazenamento de objetos como segunda porta, no mesmo formato, para que os testes possam substituí-lo por um duplo |
| Dependências | Não há biblioteca de leitura de multipart, de detecção de tipo por assinatura nem cliente do Supabase | Três adições declaradas, a registrar no changelog |
| Relógio | O projeto exige o utilitário de relógio próprio em vez de instanciar a data diretamente | O cálculo da idade e a validação da data de nascimento usam o utilitário, para que os testes possam fixar o instante |

**Frontend**

| Ponto | Situação atual | O que esta feature exige |
|---|---|---|
| Cliente HTTP | O corpo é **sempre** convertido em JSON e o cabeçalho de tipo de conteúdo é **sempre** definido; não há tratamento de formulário com arquivos | Alterar o cliente para aceitar corpo de formulário com arquivos, deixando o navegador definir o cabeçalho. É arquivo transversal, que abriga a fila de renovação de sessão — trabalho próprio, com testes próprios, e **não** um detalhe da tela |
| Componentes de interface | Existem apenas campo de texto, campo de senha, erro de campo, alerta, botão de envio e os elementos do cartão de autenticação | São **novos**: tabela, campo de seleção, área de texto, alternância, envio de imagens com pré-visualização, seletor de data, selo de status, diálogo de confirmação e paginação. A lista, o diálogo de confirmação e o aviso de sucesso já nascem na FEATURE-001 deste módulo e são reaproveitados |
| Validação de formulário | Não há biblioteca de formulário nem de schema; o padrão é uma função pura por formulário devolvendo um mapa de erros por campo, no mesmo formato que a leitura do erro da API produz | Seguir o padrão existente. Adotar biblioteca de formulário seria decisão de arquitetura a registrar no changelog, e esta spec **não** a toma |
| Navegação administrativa | Barra horizontal com um único item, "Painel" | Já substituída pela navegação lateral com "Animais" e "Espécies" na FEATURE-001 deste módulo. Esta feature apenas passa a atender o item "Animais", que lá foi entregue apontando para tela ainda inexistente |
| Catálogo de textos | Mensagem devolvida pelo backend não pode ser duplicada no catálogo do frontend | Apenas os textos puramente de interface entram no catálogo |

---

### Requisitos Não Funcionais

| ID | Tipo | Requisito | Critério mensurável |
|---|---|---|---|
| RNF-01 | Segurança | Autorização verificada no servidor em todos os endpoints | Cada endpoint desta feature responde 401 sem sessão e 403 com role `cliente` — um caso automatizado por endpoint por situação |
| RNF-02 | Segurança | Formato de imagem apurado por conteúdo, nunca por extensão ou tipo declarado | Um SVG, um GIF e um executável renomeados para `.jpg`, com tipo declarado `image/jpeg`, são todos recusados com 415 |
| RNF-03 | Segurança | Caminho do objeto no armazenamento imune ao nome enviado | Arquivos com `../`, emoji e 300 caracteres no nome são gravados em caminho gerado pela aplicação, sem escapar do prefixo do animal |
| RNF-04 | Segurança | Credencial de escrita do armazenamento nunca chega ao navegador | Inspeção do pacote entregue ao cliente e das respostas da API não revela credencial de armazenamento |
| RNF-05 | Integridade | Nenhum animal órfão ou removido por causa da exclusão de espécie | Tentativa de excluir espécie em uso mantém inalteradas a contagem de espécies e a de animais, e nenhum animal fica sem espécie — verificado **contra dados reais**, não com duplo |
| RNF-06 | Integridade | Gravação de animal atômica em relação às imagens | Falha ao gravar a terceira de cinco imagens deixa o banco no estado anterior e não deixa arquivo remanescente daquele envio |
| RNF-07 | Integridade | Escrita concorrente não é perdida em silêncio | Duas gravações simultâneas sobre o mesmo animal resultam em uma aplicada e uma recusada com conflito explícito |
| RNF-08 | Integridade | Paginação determinística | Com 45 animais criados no mesmo instante, percorrer todas as páginas devolve 45 identificadores distintos, sem repetição e sem omissão |
| RNF-09 | Correção | Idade sempre coerente com a data corrente | Com o relógio fixado em datas diferentes, a mesma data de nascimento produz idades diferentes, sem nenhuma escrita no banco |
| RNF-10 | Correção | Data de nascimento independente do fuso do processo | Com o processo em UTC e o relógio às 22h de São Paulo, a data de hoje é aceita como data de nascimento |
| RNF-11 | Desempenho | A listagem é percebida como imediata | Com 500 animais cadastrados, a primeira página é exibida em menos de 2 segundos em conexão padrão |
| RNF-12 | Desempenho | Escritas refletem rapidamente | Cadastrar sem imagens, editar ou alterar status reflete na listagem em menos de 1 segundo em conexão padrão |
| RNF-13 | Desempenho | Envio de imagens com retorno visível | O envio de cinco imagens de 5 MB conclui ou falha com mensagem em até 30 segundos, com indicação de progresso durante a espera |
| RNF-14 | Resiliência | Indisponibilidade do armazenamento não corrompe o cadastro | Com o armazenamento fora do ar, o cadastro falha com 503 e mensagem em PT-BR, e o banco permanece consistente |
| RNF-15 | Resiliência | Nenhuma dependência externa no caminho de leitura do formulário | Com toda a rede externa bloqueada, abrir o formulário, listar estados, listar cidades e listar espécies continua funcionando |
| RNF-16 | Acessibilidade | Tela e formulário inteiramente operáveis por teclado | Listar, cadastrar, editar, alterar status, excluir e confirmar são alcançáveis e acionáveis sem mouse, incluindo o envio e a remoção de imagens |
| RNF-17 | Acessibilidade | Controles por ícone e por cor possuem nome acessível | O "x" de cada miniatura, os botões da linha e o selo de status são anunciados identificando a ação e o animal; o status nunca é comunicado **apenas** por cor |
| RNF-18 | Acessibilidade | Contraste conforme WCAG 2.1 AA | Texto a no mínimo 4.5:1 e indicadores de componente a no mínimo 3:1, incluindo os quatro selos de status |
| RNF-19 | Acessibilidade | Resultado de cada operação é anunciado | Mensagens de sucesso e de erro são percebidas por leitor de tela sem exigir navegação até elas |
| RNF-20 | Usabilidade | Identidade visual CatDog | Roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito, conforme a referência visual do projeto, usando os tokens já declarados na configuração de estilos |
| RNF-21 | Consistência | Erros no envelope já vigente | 100% das respostas de erro saem como `{ error: { code, message, details? } }`, com `code` estável em SCREAMING_SNAKE_CASE e sem colidir com os códigos já existentes |
| RNF-22 | Idioma | Interface e mensagens em PT-BR | Nenhum texto exibido ao usuário em outro idioma, incluindo validação e falhas de envio de imagem |
| RNF-23 | Privacidade | Respostas públicas montadas por projeção explícita | A montagem da resposta da vitrine lista os campos públicos um a um; nenhum ponto serializa a entidade inteira (RN-59) |

---

### O que Não Deve Ser Feito

**Fora de escopo por decisão desta spec:**

- Esta feature **não** implementa a vitrine pública, a listagem para o cliente nem a filtragem por preferência — são features seguintes deste módulo. Nenhum endpoint criado aqui é anônimo.
- Esta feature **não** implementa nada do módulo de pedidos, e nenhuma transição de status é disparada por pedido (RN-17).
- Esta feature **não** implementa busca, filtro ou ordenação configurável na listagem administrativa (RN-42b).
- Esta feature **não** implementa inativação, arquivamento, lixeira ou recuperação de animais excluídos. O status Indisponível atende quem quer apenas tirar o animal da vitrine (RN-45).
- Esta feature **não** apaga nem altera espécies em nenhuma circunstância (RN-10).
- Esta feature **não** oferece tela de manutenção de estados e cidades. São dados de apoio, semeados e mantidos por carga.
- Esta feature **não** registra histórico de auditoria de quem cadastrou, editou ou alterou o status de cada animal. Com um único administrador provisionado por carga inicial, uma coluna de autoria seria constante.
- Esta feature **não** implementa cadastro em lote, importação de planilha nem carga inicial de animais.
- Esta feature **não** redimensiona, recorta, comprime nem gera versões reduzidas das imagens. A miniatura da listagem é a própria imagem de capa exibida em tamanho menor.
- **Limitação conhecida e aceita:** fotos tiradas em celular que carregam a orientação apenas nos metadados podem aparecer deitadas, porque nenhuma rotação é aplicada. Corrigir isso exigiria processamento de imagem no servidor, fora do escopo desta entrega. Está registrado para não voltar como defeito surpresa.
- Esta feature **não** altera o envelope de erro, o fluxo de autenticação nem qualquer contrato entregue pela FEATURE-002 do MODULE-001.
- Esta feature **não** adota biblioteca de formulário nem de validação por schema no frontend. O padrão em vigor — função pura por formulário devolvendo mapa de erros por campo — é mantido.

**Escopo diferido — previsto no escopo aprovado do produto e deliberadamente não entregue agora:**

O documento de escopo do produto descreve, para o cadastro de pets, três elementos que **não** aparecem em nenhuma das capturas. Eles não estão sendo esquecidos; estão sendo adiados com registro.

| Elemento | Previsto no escopo aprovado | Por que não entra agora | Condição para entrar |
|---|---|---|---|
| **Número do chip** | "dados internos como contato do proprietário e número do chip" | Ausente das capturas, que são a fonte da verdade da entrega | Entra como campo opcional, restrito ao administrador e **nunca** serializado em resposta pública — o que a RN-59 já garante estruturalmente |
| **Contato do proprietário** | Mesma passagem do escopo | Além de ausente das capturas, é **dado pessoal de terceiro**, sujeito à LGPD | Exige decisão prévia de base legal, prazo de retenção e visibilidade. Acrescentá-lo sem essa decisão criaria passivo de privacidade |
| **Raça** | "na vitrine, o cliente vê raça, foto, idade e sexo" | Ausente das capturas e **estruturalmente caro**: como texto livre inutilizaria o filtro da vitrine ("Vira-lata", "vira lata", "SRD" conviveriam); como lista controlada dependente de espécie, é uma feature do porte da FEATURE-001 inteira | Deve ser tratada como **feature candidata do módulo**, com spec própria, e não como campo esquecido deste formulário |

A separação entre o que é público e o que é interno, exigida explicitamente pelo escopo aprovado, **nasce implementada** mesmo sem nenhum campo interno existir hoje: é a RN-59, e é o que garante que chip e contato não vazem por padrão quando entrarem.

**Pendência registrada para o módulo de pedidos:** a regra "animal referenciado por algum pedido não pode ser excluído" precisa nascer com integridade referencial restritiva no vínculo de pedido para animal (RN-17b). Está escrita aqui, antes de a entidade existir, porque foi exatamente essa omissão que fez a FEATURE-001 deste módulo conviver com a sua regra mais importante verificável apenas por duplo de teste.

---

## Grupo 4 — Validação

### Casos de Teste

| ID | Cenário | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CT-01 | Cadastrar animal com todos os obrigatórios válidos | Nome, espécie, porte, sexo e cidade válidos | Animal criado com status Disponível; "Animal cadastrado com sucesso."; presente na listagem | Positivo |
| CT-02 | Cadastrar apenas com os obrigatórios | Sem data de nascimento, sem descrição, sem imagens | Animal criado normalmente | Positivo |
| CT-03 | Cadastrar com o campo Nome vazio | Nome: "" | "Este campo é obrigatório." no campo Nome; nada criado | Negativo |
| CT-04 | Cadastrar com nome de 1 caractere | Nome: "T" | "O nome do animal deve ter no mínimo 2 caracteres."; nada criado | Borda |
| CT-05 | Cadastrar com nome de exatamente 2 e de exatamente 60 caracteres | Dois cadastros | Ambos criados normalmente | Borda |
| CT-06 | Cadastrar com nome de 61 caracteres | Nome com 61 caracteres | "O nome do animal deve ter no máximo 60 caracteres."; nada criado | Borda |
| CT-07 | Normalização de espaços no nome | Nome: "  Theo   Junior " | Gravado e exibido como "Theo Junior" | Borda |
| CT-08 | Dois animais com o mesmo nome | Existe "Theo"; cadastrar "Theo" | Segundo animal criado normalmente — nome não é único (RN-05) | Positivo |
| CT-09 | Cadastrar sem escolher espécie, porte, sexo ou cidade | Cada obrigatório omitido, um por vez e todos juntos | Cada campo pendente sinalizado com "Este campo é obrigatório."; todos de uma vez; nada criado | Negativo |
| CT-10 | Cadastrar com espécie inexistente | Identificador de espécie já excluída | 404 "Espécie não encontrada."; nada criado | Negativo |
| CT-11 | Cadastrar com cidade inexistente | Identificador de cidade inválido | 404 "Cidade não encontrada."; nada criado | Negativo |
| CT-12 | Porte, sexo ou status fora da lista | `size: "gigante"`, `sex: "outro"`, `status: "vendido"` | 400 com "Selecione uma opção válida."; nada criado ou alterado | Negativo |
| CT-13 | Campo não previsto no corpo | Corpo com uma chave extra | 400 por validação; nada criado | Negativo |
| CT-14 | Tentar definir o status no cadastro | Corpo do cadastro com `status` | 400 por campo não permitido; animal não é criado com status escolhido | Negativo |
| CT-15 | Data de nascimento futura | Data de amanhã | "A data de nascimento não pode ser futura."; nada criado | Negativo |
| CT-16 | Data de nascimento de hoje, com o processo em UTC às 22h de São Paulo | Data de hoje | Aceita normalmente (RNF-10) | Borda |
| CT-17 | Data de nascimento com mais de 30 anos | Data de 31 anos atrás | "Informe uma data de nascimento dos últimos 30 anos."; nada criado | Borda |
| CT-18 | Idade derivada da data de nascimento | Nascimento em 05/11/2022, relógio fixado em 25/08/2026 | Idade devolvida como 3; nenhuma coluna de idade existe no banco | Positivo |
| CT-19 | Idade recalculada com o relógio adiantado | Mesmo animal, relógio fixado em 06/11/2026 | Idade devolvida como 4, sem nenhuma escrita no banco | Borda |
| CT-20 | Animal sem data de nascimento | Cadastro sem a data | Idade devolvida como nula; interface exibe "Idade não informada" | Borda |
| CT-21 | Descrição com exatamente 1000 e com 1001 caracteres | Dois envios | O primeiro é aceito; o segundo exibe "A descrição deve ter no máximo 1000 caracteres." | Borda |
| CT-22 | Alternâncias iniciam desligadas | Formulário de cadastro recém-aberto | "Aceita outros animais" e "Precisa de espaço grande" desligadas; animal criado com ambas falsas | Positivo |
| CT-23 | Listagem exibe as sete colunas e os dados da captura | Um animal "Theo", cachorro, grande, Boa Esperança - ES, Disponível | Colunas ANIMAL a AÇÕES presentes; localização "Boa Esperança - ES"; selo verde "Disponível" | Positivo |
| CT-24 | Contagem no rodapé com 0, 1 e 2 animais | Três estados do cadastro | "Nenhum animal cadastrado"; "Total: 1 animal"; "Total: 2 animais" | Borda |
| CT-25 | Ordenação alfabética ignorando maiúsculas e minúsculas | Cadastrados "theo", "Bidu", "Amora" | Exibidos "Amora", "Bidu", "theo" | Positivo |
| CT-26 | Paginação determinística com registros de mesmo instante | 45 animais criados no mesmo segundo, `pageSize` 20 | As três páginas devolvem 45 identificadores distintos, sem repetição e sem omissão | Borda |
| CT-27 | Controles de paginação ocultos com poucos registros | 1 animal cadastrado | Nenhum controle de navegação entre páginas é exibido; rodapé exibe "Total: 1 animal" | Borda |
| CT-28 | `pageSize` fora da faixa | `pageSize: 0` e `pageSize: 101` | 400 por validação em ambos | Negativo |
| CT-29 | Listagem vazia | Cadastro sem animais | "Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima."; API responde 200 com lista vazia e total 0 | Borda |
| CT-30 | Falha ao carregar a listagem | Consulta indisponível | "Não foi possível carregar os animais. Tente novamente." com nova tentativa | Negativo |
| CT-31 | Miniatura da listagem é a imagem de capa | Animal com duas imagens | A miniatura exibida é a de posição 0 | Positivo |
| CT-32 | Animal sem imagens na listagem | Animal sem nenhuma imagem | Marcador neutro no lugar da miniatura; linha permanece legível | Borda |
| CT-33 | Indicador de pendência de foto | Animal Disponível sem imagem | Indicador discreto na linha; nenhuma ação é bloqueada | Positivo |
| CT-34 | Cidade desabilitada antes de escolher o estado | Formulário de cadastro recém-aberto | Campo Cidade desabilitado, exibindo "Escolha primeiro o estado" | Positivo |
| CT-35 | Estado de carregamento das cidades | Estado "PR" escolhido, resposta pendente | Campo Cidade exibe "Carregando cidades..." e não aceita escolha | Borda |
| CT-36 | Cidades filtradas pelo estado | Estado "PR" | Apenas cidades do Paraná, em ordem alfabética, com "Campo Magro" presente | Positivo |
| CT-37 | Trocar o estado descarta a cidade escolhida | "Campo Magro"/"PR" escolhido; trocar para "ES" | Cidade descartada; lista substituída por cidades do Espírito Santo; impossível gravar "Campo Magro - ES" | Negativo |
| CT-38 | Trocas rápidas de estado com respostas fora de ordem | "PR" e depois "ES"; resposta de "PR" chega por último | Prevalece a lista de "ES"; a resposta obsoleta é descartada | Borda |
| CT-39 | Falha ao carregar as cidades | Consulta de cidades indisponível | "Não foi possível carregar as cidades. Tente novamente." com nova tentativa; **nunca** um campo de seleção vazio | Negativo |
| CT-40 | Cidade pré-selecionada na edição | Animal com cidade gravada | Estado e cidade aparecem corretos ao abrir; a cidade gravada permanece selecionada enquanto a lista carrega | Positivo |
| CT-41 | Cidade gravada ausente da lista ativa | Cidade removida do recorte | O formulário continua exibindo a cidade gravada como escolhida; nada é apagado em silêncio | Borda |
| CT-42 | Listagem de estados | Consulta de estados | 27 unidades federativas, identificadas por sigla, em ordem alfabética | Positivo |
| CT-43 | Sigla de estado inexistente | `uf: "XX"` | 404 "Estado não encontrado." | Negativo |
| CT-44 | Nenhuma chamada externa ao abrir o formulário | Rede externa bloqueada | Estados, cidades e espécies continuam sendo listados (RNF-15) | Positivo |
| CT-45 | Enviar imagens válidas | Duas imagens JPEG de 1 MB | Miniaturas exibidas; imagens gravadas na ordem de envio; a primeira é a capa | Positivo |
| CT-46 | Enviar exatamente 5 imagens | Cinco arquivos válidos | Todas aceitas | Borda |
| CT-47 | Enviar 6 imagens | Seis arquivos válidos | "É permitido no máximo 5 imagens por animal."; nenhuma gravada | Negativo |
| CT-48 | Limite sobre o estado final — excesso sem remoção | 3 gravadas + 3 novas (estado final 6) | Recusado; a interface informa quantas ainda cabem | Borda |
| CT-49a | Limite sobre o estado final — acima do limite | 5 gravadas, remover 2, acrescentar 3 (estado final 6) | Recusado com "É permitido no máximo 5 imagens por animal."; nada alterado | Borda |
| CT-49b | Limite sobre o estado final — dentro do limite | 5 gravadas, remover 3, acrescentar 3 (estado final 5) | Aceito; o animal permanece com 5 imagens | Borda |
| CT-50 | Imagem de exatamente 5 MB e de 5 MB + 1 byte | Dois envios | O primeiro é aceito; o segundo responde 413 "Cada imagem deve ter no máximo 5 MB." | Borda |
| CT-51 | Arquivo de 0 byte | Arquivo vazio com extensão `.jpg` | 400 "O arquivo enviado está vazio."; nada gravado | Borda |
| CT-52 | Arquivo de outro formato renomeado para `.jpg` | GIF, PDF e executável renomeados, com tipo declarado `image/jpeg` | 415 "Apenas imagens JPEG ou PNG são aceitas." nos três casos | Negativo |
| CT-53 | **SVG renomeado para `.jpg`** | SVG com script embutido, declarado como `image/jpeg` | 415; recusado pela assinatura binária; nunca chega ao balde de leitura pública | Negativo |
| CT-54 | Corpo total acima do limite | Cinco arquivos de 5 MB somando 25 MB | 413 com mensagem de negócio em PT-BR, e não erro genérico do servidor de borda | Borda |
| CT-55 | Falha no armazenamento durante o envio | Falha ao gravar a terceira de cinco imagens | Nada gravado no banco; nenhum arquivo daquele envio permanece no armazenamento; formulário preserva o que foi preenchido | Negativo |
| CT-56 | Armazenamento indisponível | Serviço de armazenamento fora do ar | 503 "Não foi possível salvar as imagens. Tente novamente."; banco consistente | Negativo |
| CT-57 | Nome de arquivo hostil | Nomes com `../`, emoji e 300 caracteres | Caminho do objeto gerado pela aplicação, dentro do prefixo do animal; o nome enviado não o influencia | Negativo |
| CT-58 | Remover imagem na edição | Animal com duas imagens; remover uma e salvar | A removida deixa de existir; a outra permanece; o arquivo é apagado do armazenamento | Positivo |
| CT-59 | Cancelar após remover imagem | Remover uma miniatura e acionar "Cancelar" | Nenhuma imagem é removida; nada é gravado (RN-49) | Negativo |
| CT-60 | Remover a imagem de capa | Animal com duas imagens; remover a de posição 0 | A imagem seguinte passa a ser a capa e a miniatura da listagem | Borda |
| CT-61 | Reordenar imagens mantidas | Ordem informada diferente da atual | A ordem gravada corresponde à informada; a primeira é a capa | Positivo |
| CT-62 | `keepImageIds` com imagem de outro animal | Identificador válido de imagem alheia | 400 por validação; nada alterado | Negativo |
| CT-63 | Editar animal alterando cada campo | Nome, espécie, porte, sexo, cidade, data, descrição e alternâncias | Todos gravados; "Animal atualizado com sucesso."; identificador do animal inalterado | Positivo |
| CT-64 | Editar animal inexistente | Identificador de animal já excluído | 404 "Animal não encontrado." | Negativo |
| CT-65 | Cancelar a edição | Campos alterados e "Cancelar" acionado | Nada gravado; volta à listagem | Negativo |
| CT-66 | **Conflito de concorrência na edição** | Duas gravações sobre o mesmo animal, a segunda com token antigo | A primeira é aplicada; a segunda responde 409 "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração." | Negativo |
| CT-67 | Conflito de concorrência na alteração de status | Status alterado em outra aba; token antigo | 409; o campo volta ao valor anterior; a lista é atualizada | Negativo |
| CT-68 | Formulário de edição não oferece status | Formulário aberto | Nenhum campo de status presente (RN-16) | Positivo |
| CT-69 | Alterar status pela listagem | De Disponível para Adotado | Status gravado; selo atualizado; "Status atualizado com sucesso."; nenhum outro dado do animal alterado | Positivo |
| CT-70 | Todas as transições de status | Cada uma das doze transições entre os quatro valores | Todas aceitas (RN-15) | Positivo |
| CT-71 | Escolher o status já vigente | Status atual escolhido de novo | Nenhuma requisição enviada pela interface; se enviada diretamente, 200 sem efeito colateral e sem erro | Borda |
| CT-72 | Status inválido pela API | `"VENDIDO"`, texto vazio, nulo e número | 400 "Selecione uma opção válida." nos quatro casos | Negativo |
| CT-73 | Alterar status de animal já excluído | Animal removido em outra aba | 404 "Animal não encontrado."; lista atualizada, sem linha fantasma | Negativo |
| CT-74 | Falha de rede na alteração de status | Requisição falha | Campo volta ao valor anterior; "Não foi possível atualizar o status. Tente novamente." | Negativo |
| CT-75 | Campo extra na alteração de status | Corpo com `name` além de `status` | 400 por campo não permitido; nada alterado | Negativo |
| CT-76 | Excluir animal confirmando | Animal com duas imagens | Animal removido; registros das imagens removidos; arquivos apagados do armazenamento; contagem atualizada | Positivo |
| CT-77 | Excluir animal cancelando a confirmação | Confirmação recusada | Nenhuma ação executada; animal permanece | Negativo |
| CT-78 | Excluir animal inexistente | Identificador já excluído | 404 "Animal não encontrado."; lista atualizada | Negativo |
| CT-79 | Falha ao apagar arquivo na exclusão | Armazenamento recusa a remoção | A exclusão é concluída com 204; o arquivo remanescente é registrado no log; nenhum ponto do produto exibe a imagem (RN-40) | Borda |
| CT-80 | Exclusão de animal não afeta a espécie | Animal excluído | A espécie continua cadastrada | Positivo |
| CT-81 | **Exclusão de espécie com animal real vinculado** | Espécie com um animal real cadastrado | "Não é possível excluir esta espécie porque existem animais vinculados a ela."; espécie permanece; nenhum animal alterado — **reexecução do CT-24 da FEATURE-001 contra dados reais** | Negativo |
| CT-82 | **Integridade após exclusão de espécie bloqueada** | Após CT-81 | Contagem de espécies e de animais inalteradas; nenhum animal sem espécie — **reexecução do CT-25 da FEATURE-001 contra dados reais** | Negativo |
| CT-83 | **Exclusão de espécie após remover os animais** | Espécie sem animais restantes | Exclusão concluída — **reexecução do CT-26 da FEATURE-001 contra dados reais** | Positivo |
| CT-84 | **Exclusão de espécie via API direta com animal vinculado** | Requisição fora da interface | Recusada da mesma forma — **reexecução do CT-32 da FEATURE-001 contra dados reais** | Negativo |
| CT-85 | **Chave estrangeira restritiva no banco** | Remoção da espécie tentada diretamente no banco, com animal vinculado | O banco recusa a operação; nenhum animal é apagado; nenhum animal fica sem espécie (RN-09) | Negativo |
| CT-86 | Cidade referenciada não pode ser removida | Remoção de cidade com animal vinculado | Recusada pela integridade referencial (RN-29) | Negativo |
| CT-87 | Acesso à tela por usuário `cliente` | Sessão com role `cliente` | Redirecionado para a área do cliente; conteúdo administrativo não exibido | Negativo |
| CT-88 | Acesso à tela sem sessão | Sem sessão ativa | Redirecionado para a tela de login | Negativo |
| CT-89 | Chamada direta à API por `cliente` | Requisição autenticada como `cliente` a cada endpoint desta feature | Todos respondem 403 "Você não tem permissão para acessar este recurso." | Negativo |
| CT-90 | Chamada direta à API sem sessão | Requisição sem credencial a cada endpoint | Todos respondem 401 "Sua sessão expirou. Faça login novamente." | Negativo |
| CT-91 | Restrições de imagem valem fora da interface | Requisição direta com 6 imagens, com SVG e com arquivo de 6 MB | Recusadas exatamente como pela tela (RN-33) | Negativo |
| CT-92 | Identificador malformado | Consulta, edição, status e exclusão com identificador inválido | 400 com o problema apontado no campo do identificador | Negativo |
| CT-93 | Submissão duplicada no cadastro | Dois acionamentos de "Salvar" em sequência rápida | Apenas um animal criado; botão desabilitado durante a requisição | Borda |
| CT-94 | Operação completa por teclado | Navegação apenas por teclado | Listar, cadastrar, editar, alterar status, excluir, confirmar, enviar e remover imagens são alcançáveis e acionáveis | Positivo |
| CT-95 | Nome acessível dos controles | Leitor de tela sobre a listagem e sobre as miniaturas | Botões da linha, "x" das miniaturas e selo de status são anunciados identificando a ação e o animal; status não é comunicado só por cor | Positivo |
| CT-96 | Credencial de armazenamento não vaza | Inspeção do pacote entregue ao navegador e das respostas da API | Nenhuma credencial de armazenamento presente | Negativo |
| CT-97 | Progresso durante envio longo | Cinco imagens grandes | Indicação de progresso durante a espera; conclusão ou falha com mensagem em até 30 segundos | Positivo |
| CT-98 | Desempenho da listagem com volume | 500 animais cadastrados | Primeira página exibida em menos de 2 segundos | Positivo |

---

### Critérios de Aceite

**Comportamento e entrega:**
- [ ] CA-01: O item "Animais" da navegação administrativa leva à tela de animais e fica marcado como ativo enquanto ela está aberta.
- [ ] CA-02: A tela exibe o título "Animais" e o botão "Cadastrar Animal" alinhado à direita.
- [ ] CA-03: A tabela apresenta as colunas ANIMAL, ESPÉCIE, PORTE, LOCALIZAÇÃO, STATUS, ALTERAR STATUS e AÇÕES, com a miniatura da imagem de capa à esquerda do nome.
- [ ] CA-04: A coluna LOCALIZAÇÃO apresenta a cidade e a sigla do estado no formato "Cidade - UF".
- [ ] CA-05: A coluna STATUS apresenta um selo somente leitura e a coluna ALTERAR STATUS um campo de seleção com os quatro status, ambos na mesma linha.
- [ ] CA-06: O rodapé apresenta a contagem total com concordância correta para zero, um e vários animais.
- [ ] CA-07: A listagem é paginada no servidor, e os controles de navegação só aparecem quando o total excede o tamanho da página.
- [ ] CA-08: Percorrer todas as páginas de um cadastro com registros de mesmo instante devolve cada animal exatamente uma vez.
- [ ] CA-09: O formulário apresenta os campos na ordem e com a obrigatoriedade das capturas, e **não** possui campo de status.
- [ ] CA-10: Cadastrar um animal com os obrigatórios válidos o persiste com status Disponível e o apresenta na listagem.
- [ ] CA-11: Data de nascimento, descrição e imagens são opcionais, e um animal sem nenhum dos três é cadastrado normalmente.
- [ ] CA-12: Todo campo obrigatório ausente é sinalizado de uma vez, com "Este campo é obrigatório.", e nada é gravado.
- [ ] CA-13: A data de nascimento futura ou anterior a 30 anos é recusada, e a data de hoje é aceita mesmo com o processo em fuso diferente do de São Paulo.
- [ ] CA-14: **A idade é derivada da data de nascimento a cada consulta, nunca é armazenada, e é ausente — não zero — quando a data não foi informada.**
- [ ] CA-15: Escolher o estado carrega as cidades daquele estado; trocar o estado descarta a cidade escolhida; trocas rápidas nunca deixam prevalecer uma resposta obsoleta.
- [ ] CA-16: Falha ao carregar as cidades é apresentada como falha com nova tentativa, nunca como campo de seleção vazio.
- [ ] CA-17: **O estado não é enviado ao servidor: apenas a cidade trafega, e o estado é derivado dela — um par cidade/estado incoerente é impossível de representar.**
- [ ] CA-18: A lista de estados e a de cidades são servidas pela própria aplicação, sem chamada a serviço externo em tempo de execução.
- [ ] CA-19: São aceitas de zero a cinco imagens por animal, apenas JPEG e PNG, de 1 byte a 5 MB cada.
- [ ] CA-20: **O limite de cinco vale sobre o estado final do animal, somando as imagens mantidas às recém-enviadas.**
- [ ] CA-21: **O formato é apurado pelo conteúdo real do arquivo — um SVG, um GIF ou um executável renomeados para `.jpg` são recusados.**
- [ ] CA-22: **Todas as restrições de imagem são aplicadas pelo servidor e valem igualmente para chamadas feitas fora da interface.**
- [ ] CA-23: Um envio que ultrapasse o tamanho total permitido produz mensagem de negócio em PT-BR, e não erro genérico do servidor de borda.
- [ ] CA-24: **A gravação do animal é atômica em relação às imagens: uma falha no armazenamento não deixa animal alterado nem arquivo remanescente.**
- [ ] CA-25: Nada é gravado no armazenamento nem removido dele antes do acionamento de "Salvar"; "Cancelar" não remove imagem alguma.
- [ ] CA-26: A primeira imagem da ordem é a capa e a miniatura da listagem; removida a capa, a seguinte assume o lugar.
- [ ] CA-27: O caminho do arquivo no armazenamento é gerado pela aplicação e não é influenciado pelo nome do arquivo enviado.
- [ ] CA-28: Editar um animal grava todos os campos alterados sem mudar o seu identificador.
- [ ] CA-29: **Uma gravação sobre um animal alterado por outra pessoa é recusada com conflito explícito, e nenhuma alteração é perdida em silêncio.**
- [ ] CA-30: A alteração de status é operação própria, feita pela listagem, que altera exclusivamente o status e não aceita nenhum outro campo.
- [ ] CA-31: Todas as transições entre os quatro status são aceitas, e escolher o status já vigente não produz erro.
- [ ] CA-32: Um status fora da lista é recusado por validação, inclusive quando enviado diretamente à API.
- [ ] CA-33: A exclusão exige confirmação explícita nomeando o animal e avisando que a ação não pode ser desfeita.
- [ ] CA-34: Excluir um animal remove os registros das suas imagens e apaga os arquivos correspondentes do armazenamento.
- [ ] CA-35: **Excluir um animal nunca apaga nem altera a sua espécie.**
- [ ] CA-36: **O vínculo entre animal e espécie é restritivo no banco; `Cascade` e `SetNull` não são usados nele em nenhuma hipótese.**
- [ ] CA-37: **A exclusão de uma espécie com pelo menos um animal real vinculado é recusada, a espécie permanece cadastrada e nenhum animal é removido, desvinculado ou alterado — verificado contra dados reais, e não com duplo de teste.**
- [ ] CA-38: **Os casos CT-24, CT-25, CT-26 e CT-32 da FEATURE-001 deste módulo foram reexecutados contra dados reais e aprovados, quitando a pendência herdada.**
- [ ] CA-39: Consultar, editar, alterar status ou excluir um animal inexistente responde "Animal não encontrado."
- [ ] CA-40: Todos os endpoints desta feature recusam requisições sem sessão e requisições de usuários com role `cliente`, independentemente da interface.
- [ ] CA-41: Usuário `cliente` que acesse o endereço da tela é redirecionado para a sua própria área, sem que o conteúdo administrativo apareça.
- [ ] CA-42: Toda a tela e todo o formulário são operáveis por teclado, e os controles por ícone possuem nome acessível; o status não é comunicado apenas por cor.
- [ ] CA-43: Todas as respostas de erro saem no envelope `{ error: { code, message, details? } }` com `code` estável, sem colidir com os códigos já existentes, e a interface ramifica por `code` e nunca pelo texto da mensagem.
- [ ] CA-44: A credencial de escrita do armazenamento não é entregue ao navegador em nenhuma circunstância.
- [ ] CA-45: **A montagem de resposta voltada ao público lista os campos públicos explicitamente, sem serializar a entidade Animal inteira** — restrição vinculante para a feature de vitrine.
- [ ] CA-46: A listagem sinaliza de forma discreta os animais com status Disponível que ainda não possuem nenhuma imagem, sem bloquear qualquer ação.
- [ ] CA-47: Uma cidade gravada em um animal que deixou de constar na lista ativa continua sendo exibida como escolhida no formulário de edição, em vez de ser apagada em silêncio.

**Regressão:**
- [ ] FEATURE-001 do MODULE-002 — Cadastro de Espécies: **quitação obrigatória da pendência herdada.** Os casos CT-24, CT-25, CT-26 e CT-32 daquela spec estavam verificados apenas por duplo de teste porque a entidade Animal não existia. Esta feature **não pode ser considerada concluída** sem que os quatro sejam reexecutados contra a tabela real e a chave estrangeira restritiva real, e sem que a relação inversa deixada comentada no modelo de espécie seja ativada. Reexecutar também os cenários de criação, renomeação e listagem de espécies, que passam a conviver com registros referenciados.
- [ ] FEATURE-002 do MODULE-001 — Autenticação Completa: esta feature acrescenta rotas que usam a verificação de permissão por role e altera o leitor de corpo da aplicação e o cliente HTTP do frontend. Reexecutar login, cadastro, confirmação de e-mail, renovação de sessão, redirecionamento por role e acesso a rota protegida sem sessão. **A alteração do cliente HTTP é o ponto de maior risco**, por abrigar a fila de renovação de sessão.
- [ ] Leitor de corpo da API: a leitura de `multipart/form-data` é acrescentada apenas para as rotas de animal. Verificar que as rotas que recebem JSON continuam com o teto de 10 KB e recusam corpos maiores como antes.
- [ ] Envelope de erro da API: novos códigos são acrescentados ao contrato e dois novos códigos de estado HTTP passam a existir. Verificar que nenhuma resposta existente mudou de formato, de `code` ou de mensagem.
- [ ] Banco de dados: a migration acrescenta enumerações e quatro tabelas novas e não altera colunas de tabelas existentes. Verificar que a autenticação e o cadastro de espécies continuam funcionando após a migration e a carga inicial.
- [ ] **Pendência registrada para o módulo de pedidos:** ele não poderá ser considerado concluído sem que o vínculo de pedido para animal exista como chave estrangeira restritiva e sem que a regra "animal com pedido não pode ser excluído" seja verificada contra dados reais.

**Qualidade de código (SonarQube):**
- [ ] Quality Gate aprovado sem bloqueadores
- [ ] Cobertura de testes: mínimo de 80% nas classes alteradas
- [ ] Zero issues de segurança (Severity: Blocker ou Critical)

---

### Cenários de QA

Roteiro de homologação manual, executado com um usuário `admin` e um usuário `cliente` já cadastrados e confirmados, e com pelo menos duas espécies cadastradas.

| # | Passo | Resultado esperado |
|---|---|---|
| QA-01 | Autenticar como `admin` e acionar "Animais" na navegação lateral | A tela de animais abre com o título "Animais", o botão "Cadastrar Animal" à direita e o item marcado como ativo |
| QA-02 | Observar a tela com o cadastro vazio | Mensagem de lista vazia; o botão de cadastro continua disponível |
| QA-03 | Acionar "Cadastrar Animal" e observar o formulário | Título "Cadastrar Animal"; campos na ordem das capturas; asterisco em Nome, Espécie, Porte, Sexo, Estado e Cidade; sem asterisco em Data de nascimento e Descrição; **sem campo de status** |
| QA-04 | Acionar "Salvar" com o formulário vazio | Todos os obrigatórios sinalizados de uma vez com "Este campo é obrigatório."; foco no primeiro; nada criado |
| QA-05 | Observar o campo Cidade antes de escolher o estado | Desabilitado, exibindo "Escolha primeiro o estado" |
| QA-06 | Escolher o estado "PR" e observar o campo Cidade | Passa por "Carregando cidades..." e chega povoado apenas com cidades do Paraná, com "Campo Magro" presente |
| QA-07 | Escolher "Campo Magro" e depois trocar o estado para "ES" | A cidade escolhida é descartada; a lista passa a oferecer apenas cidades do Espírito Santo |
| QA-08 | Preencher tudo, escolher "Boa Esperança - ES" e salvar sem imagens | "Animal cadastrado com sucesso."; volta à listagem; o animal aparece com status Disponível e indicador de pendência de foto |
| QA-09 | Conferir o rodapé com um animal cadastrado | "Total: 1 animal" — no singular |
| QA-10 | Cadastrar um segundo animal com o mesmo nome do primeiro | Aceito normalmente; o rodapé passa a exibir "Total: 2 animais" |
| QA-11 | Editar um animal e enviar duas imagens JPEG válidas, depois salvar | Miniaturas exibidas antes de salvar; após salvar, a miniatura da listagem passa a ser a primeira imagem; o indicador de pendência de foto some |
| QA-12 | Editar o animal, acionar o "x" de uma imagem e então acionar "Cancelar" | Nenhuma imagem é removida — reabrir a edição mostra as duas |
| QA-13 | Editar o animal, remover a primeira imagem e salvar | A segunda imagem passa a ser a capa e a miniatura da listagem |
| QA-14 | Tentar enviar seis imagens de uma vez | "É permitido no máximo 5 imagens por animal."; nenhuma gravada |
| QA-15 | Renomear um arquivo PDF ou SVG para `.jpg` e tentar enviá-lo | Recusado com "Apenas imagens JPEG ou PNG são aceitas." — a recusa é pelo conteúdo, não pela extensão |
| QA-16 | Tentar enviar uma imagem maior que 5 MB | "Cada imagem deve ter no máximo 5 MB." |
| QA-17 | Tentar enviar cinco imagens de 5 MB de uma vez | Mensagem de negócio em PT-BR sobre o tamanho do envio, e não uma tela de erro do servidor |
| QA-18 | Cadastrar um animal com data de nascimento de 05/11/2022 e consultar a idade exibida | Idade coerente com a data atual, em anos completos |
| QA-19 | Cadastrar um animal sem data de nascimento | "Idade não informada" onde a idade seria exibida |
| QA-20 | Tentar informar uma data de nascimento de amanhã e outra de 31 anos atrás | As duas recusadas com as mensagens correspondentes |
| QA-21 | Alterar o status de um animal pela coluna ALTERAR STATUS | O selo da coluna STATUS acompanha a mudança; "Status atualizado com sucesso."; recarregar a página mantém o novo status |
| QA-22 | Percorrer as quatro opções de status da mesma linha | Todas aceitas; nenhum outro dado do animal muda |
| QA-23 | Abrir a edição de um animal em uma aba, alterar o status dele em outra aba e então salvar a primeira | "Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração."; nada é perdido em silêncio |
| QA-24 | Acionar "Excluir" em um animal e cancelar a confirmação | O animal permanece na lista |
| QA-25 | Acionar "Excluir" no mesmo animal e confirmar | Removido da lista; "Animal excluído com sucesso."; a contagem é atualizada; permanece ausente após recarregar |
| QA-26 | Abrir a URL de uma imagem do animal excluído | A imagem não é mais servida |
| QA-27 | Conferir a tela de espécies após excluir o animal | A espécie que o classificava continua cadastrada |
| QA-28 | **Cadastrar um animal vinculado à espécie "Cachorro" e tentar excluir "Cachorro" na tela de espécies** | **"Não é possível excluir esta espécie porque existem animais vinculados a ela."; a espécie permanece na lista** |
| QA-29 | **Conferir a listagem de animais após QA-28** | **O animal continua existindo, ainda vinculado a "Cachorro"; nenhum dado dele mudou** |
| QA-30 | **Chamar diretamente a exclusão de "Cachorro" pela API, fora da interface** | **Recusada com a mesma mensagem; nada é removido** |
| QA-31 | **Excluir o animal e tentar excluir "Cachorro" novamente** | **A exclusão da espécie é concluída normalmente** |
| QA-32 | Cadastrar mais de 20 animais e percorrer as páginas da listagem | Os controles de navegação aparecem; nenhum animal se repete nem desaparece entre as páginas; o rodapé continua informando o total geral |
| QA-33 | Sair, autenticar como `cliente` e acessar diretamente o endereço da tela de animais | Redirecionado para a área do cliente; nenhum conteúdo administrativo exibido |
| QA-34 | Sem sessão, acessar diretamente o endereço da tela de animais | Redirecionado para a tela de login |
| QA-35 | Autenticado como `cliente`, chamar diretamente cada endpoint desta feature | Todos recusam com a mensagem de falta de permissão |
| QA-36 | Sem credencial, chamar diretamente cada endpoint desta feature | Todos recusam com a mensagem de sessão expirada |
| QA-37 | Enviar, fora da interface, uma requisição com seis imagens e outra com um SVG renomeado | Recusadas exatamente como seriam pela tela |
| QA-38 | Percorrer toda a tela e todo o formulário usando apenas o teclado | Listar, cadastrar, editar, alterar status, excluir, confirmar, escolher e remover imagens são alcançáveis e acionáveis |
| QA-39 | Percorrer a listagem com leitor de tela | Botões da linha, "x" das miniaturas e selo de status são anunciados identificando a ação e o animal |
| QA-40 | Conferir cores e tipografia contra a referência visual do projeto | Roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito aplicados; os quatro selos de status atendem ao contraste mínimo |
| QA-41 | Com a rede externa bloqueada, abrir o formulário de cadastro | Estados, cidades e espécies continuam sendo listados normalmente |

---

### Critério de Sucesso da Feature

| Métrica | Baseline atual | Meta após entrega | Como será medida |
|---|---|---|---|
| Animais cadastrados na plataforma | 0 — não existe cadastro de animais | Todo o catálogo em operação migrado para o sistema | Contagem na listagem administrativa |
| Animais sem espécie, ou removidos por exclusão de espécie | Não aplicável | 0 ocorrências | Verificação de integridade após cada tentativa de exclusão de espécie bloqueada |
| Pendência de regressão herdada da FEATURE-001 deste módulo | 4 casos verificados apenas por duplo de teste | 0 casos pendentes | Reexecução dos CT-24, CT-25, CT-26 e CT-32 daquela spec contra dados reais |
| Escritas concorrentes perdidas em silêncio | Não aplicável | 0 ocorrências | Teste de concorrência sobre edição e alteração de status |
| Imagens perdidas após implantação | Não aplicável | 0 ocorrências | Conferência das imagens do catálogo após cada implantação |
| Tempo para cadastrar um animal com fotos | Não aplicável | Menos de 3 minutos entre abrir o formulário e ver o animal na listagem | Observação em homologação |
| Administrador cadastra um animal sem apoio | 0 (feature inexistente) | 100% das tentativas concluídas sem contato com suporte | Ausência de chamados relacionados ao cadastro de animais |

---

## Grupo 5 — Estimativa

> Preencha após o escopo completo estar definido e revisado.

**Use Points gerados:** _A preencher_
**Estimativa de custo:** _A preencher_
