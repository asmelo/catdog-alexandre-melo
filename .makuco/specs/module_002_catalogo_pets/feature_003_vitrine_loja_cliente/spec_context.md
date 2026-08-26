# FEATURE-003 — Vitrine da Loja (visão do cliente)

---

## Grupo 1 — Identificação

**Feature:** FEATURE-003 — Vitrine da Loja (catálogo público de animais disponíveis para adoção, com busca, filtros e grade de cartões)
**Módulo:** MODULE-002 — Catálogo de pets
**Status:** Rascunho
**Criado por:** Makuco Specify Agent — 2026-08-25
**Aprovado por:** _A preencher_

> **Desambiguação de numeração:** neste documento, "FEATURE-002 do MODULE-001" é a Autenticação Completa; "FEATURE-001 do MODULE-002" é o Cadastro de Espécies; "FEATURE-002 do MODULE-002" é o Cadastro de Animais. Referências a "esta feature" significam sempre a FEATURE-003 do MODULE-002.

---

## Objetivo da Feature

As duas features anteriores deste módulo construíram o cadastro: a FEATURE-001 entregou a lista controlada de espécies e a FEATURE-002 entregou os animais, com fotos, características de convivência e localização. Tudo isso existe hoje **apenas atrás do login do administrador** — o cliente continua sem nenhuma forma de ver o que está disponível para adoção. Esta feature entrega a primeira tela do produto voltada ao público: uma vitrine que lista os animais disponíveis em cartões com foto, nome, espécie, localização, sexo, porte e idade, e que permite ao visitante estreitar a lista por busca livre e por cinco filtros combináveis. O beneficiário é o cliente — o adotante — que passa a encontrar um animal por conta própria em vez de depender de mensagens avulsas; e o beneficiário indireto é a operação, porque cada animal cadastrado passa a ter alcance real. Sem esta feature, o módulo inteiro é um cadastro sem público, e o valor das duas features anteriores fica represado.

Esta é também a feature em que a separação entre o que é público e o que é interno — exigida pelo escopo aprovado do produto e escrita na RN-59 da FEATURE-002 deste módulo antes de existir qualquer campo interno — deixa de ser uma regra preventiva e passa a ser **exercitada de verdade**. É aqui que a projeção explícita de campos públicos precisa provar que funciona.

---

## Grupo 2 — Contexto

### Quem Acessa

| Perfil / Permissão | Nível de acesso | Observação |
|---|---|---|
| Visitante (não autenticado) | Leitura total da vitrine | **Acesso pleno e sem sessão.** É o perfil primário desta feature: o adotante chega pelo link antes de ter conta |
| cliente | Leitura total da vitrine | Vê exatamente o mesmo conteúdo do visitante. A sessão altera **apenas o cabeçalho** da página, nunca a lista, os filtros ou os dados de cada animal |
| admin | Leitura total da vitrine | Idem. O administrador não recebe nenhum controle adicional nesta tela; a manutenção do catálogo continua sendo a FEATURE-002 deste módulo |

**Resolução da tensão entre a captura e o escopo do produto.** A captura de tela usada como fonte da verdade mostra, no canto superior direito, o e-mail de um usuário autenticado e um controle "Sair", o que sugere uma tela restrita a quem tem sessão. O `MAKUCO.md` do projeto afirma o oposto: *"Public catalog: no authentication required"*. A tensão é resolvida a favor do escopo do produto, e não da captura, pelas razões abaixo:

1. A captura registra **o estado da sessão de quem tirou a captura**, não uma exigência da tela. Quem estava logado veria o cabeçalho autenticado em qualquer página, pública ou não.
2. Exigir sessão na vitrine inverteria o funil do produto: o visitante precisaria criar conta e confirmar e-mail **antes** de saber se existe algum animal do seu interesse. A FEATURE-002 do MODULE-001 estabeleceu um cadastro com confirmação por e-mail — uma barreira desproporcional para quem só quer olhar.
3. O escopo aprovado descreve a vitrine como o ponto de entrada do cliente. Um catálogo que não pode ser compartilhado por link com quem ainda não tem conta não é uma vitrine.

**Portanto:** o catálogo é **público**. O cabeçalho da página é o único elemento que se adapta à presença de sessão. As consequências dessa decisão sobre a árvore de rotas do frontend estão detalhadas na seção "Impacto Técnico Transversal" e registradas no changelog.

---

### Premissas

- A FEATURE-002 do MODULE-001 (Autenticação Completa) está implementada: sessão, roles `admin` / `cliente`, guardas de rota e verificação de permissão no servidor. Esta feature **não** a utiliza para proteger nada, mas depende dela para saber se há sessão e montar o cabeçalho.
- A FEATURE-001 deste módulo (Cadastro de Espécies) está entregue: a tabela `species` existe e é referenciada pelos animais.
- A FEATURE-002 deste módulo (Cadastro de Animais) está entregue **antes** desta. Dela vêm: as tabelas `animals`, `animal_images`, `states` e `cities`; as enumerações de porte, sexo e status; o armazenamento de objetos com as imagens; e a paginação de servidor com o envelope `{ items, pagination }`.
- Existem animais cadastrados com status `DISPONIVEL` — sem eles a vitrine é uma tela de estado vazio.
- O envelope de erro `{ error: { code, message, details? } }` está congelado e esta feature não o altera. Ela também **não acrescenta nenhum código de erro novo**.
- O volume esperado permanece o declarado pela FEATURE-002 deste módulo: dezenas a poucas centenas de animais.
- As imagens são servidas diretamente pelo armazenamento de objetos, com leitura pública, e não passam pela API (decisão B da FEATURE-002 deste módulo).
- O módulo de Pedidos, que receberá a demonstração de interesse do cliente, **não existe**. Esta feature entrega a vitrine e registra o gancho; o pedido é feature futura.

---

### Dependências

| Dependência | Tipo | Status | Impacto se não resolvida |
|---|---|---|---|
| FEATURE-002 do MODULE-002 — Cadastro de Animais (tabelas, enumerações, imagens, localização) | FEATURE | Pendente — precede esta | Sem ela não há o que exibir. Esta feature **não pode** ser iniciada antes |
| FEATURE-001 do MODULE-002 — Cadastro de Espécies (tabela `species`, nome da espécie) | FEATURE | Pendente — precede a FEATURE-002 | Sem ela o cartão não tem espécie e o filtro de espécie não tem opções |
| FEATURE-002 do MODULE-001 — Autenticação Completa (contexto de sessão, `logout`) | FEATURE | Resolvida | Sem ela o cabeçalho não sabe se há sessão. **Não** é dependência de acesso: a vitrine funciona sem sessão nenhuma |
| Rota pública montada fora das guardas `ProtectedRoute` / `RoleRoute` | Decisão de arquitetura (desta spec) | Pendente — entregue por esta feature | A tela existiria mas seria inalcançável sem login, contrariando o escopo do produto |
| Colunas de busca sem acento em `animals` e em `cities` | Decisão técnica (desta spec) | Pendente — entregue por esta feature | Sem elas a busca insensível a acentos é impossível de expressar pelo construtor de consultas em uso |
| Componentes de cartão, grade, selo/etiqueta, estado vazio, imagem com marcador substituto e esqueleto de carregamento | Base de componentes de interface | Pendente — criados por esta feature | Nenhum existe hoje; sem eles a tela não é construível |
| Componentes de campo de seleção e de paginação | Base de componentes de interface | Pendente — **criados pela FEATURE-002 deste módulo** e reaproveitados aqui | Se a FEATURE-002 não os entregar, esta feature precisa criá-los, dobrando o esforço |
| Limitador de taxa aplicável a endpoint anônimo | Infraestrutura já existente | Resolvida — mecanismo existe, usado hoje nos endpoints de credencial | Sem ele, o primeiro endpoint anônimo de leitura do produto fica sem nenhuma contenção |

---

### Referências e Insumos

**Protótipo / Wireframe:** não há protótipo. A fonte da verdade do layout é uma captura de tela da aplicação, arquivada junto desta spec.

**Prints de referência (estado atual):**
- `assets/vitrine-cliente-current-state.png` — a vitrine com um único animal cadastrado.

Na captura, a barra de endereço do navegador, as abas, a barra de favoritos e um pop-up do sistema operacional na borda inferior aparecem em volta da aplicação e **não fazem parte do produto**.

**O que a captura estabelece como contrato de interface:**

| Elemento | Conteúdo observado |
|---|---|
| Endereço | `/animals` |
| Cabeçalho | Fundo claro. À esquerda, o logotipo CatDog. À direita, o e-mail do usuário autenticado e um controle "Sair" com ícone. **Sem itens de navegação** |
| Título da página | "Animais para adoção" |
| Barra de filtros | Painel branco de largura inteira, com os controles em uma única linha |
| Filtro 1 | Campo de busca, largo, com o texto de apoio "Busque por nome ou cidade" |
| Filtro 2 | Rótulo "Animal"; campo de seleção exibindo "Todas as espécies" |
| Filtro 3 | Rótulo "Porte"; campo de seleção exibindo "Todos os portes" |
| Filtro 4 | Rótulo "Sexo"; campo de seleção exibindo "Todos os sexos" |
| Filtro 5 | Rótulo "Idade Máxima"; campo com o texto de apoio "Idade máxima" |
| Filtro 6 | Campo "Cidade" |
| Ação | Botão "Limpar filtros", ao fim da barra |
| Grade | Cartões. Apenas um visível, porque só há um animal cadastrado |
| Cartão — imagem | Foto grande ocupando o topo inteiro do cartão |
| Cartão — nome | "Theo", em destaque, à esquerda |
| Cartão — espécie | Etiqueta "Cachorro", alinhada à direita, na mesma altura do nome |
| Cartão — localização | Ícone de marcador de mapa seguido de "Campo Magro - PR" |
| Cartão — características | Três etiquetas menores em sequência: "Macho", "Grande", "3 ano(s)" |
| Cartão — descrição | Uma linha de texto ao fim do cartão |
| Ausente da captura | Qualquer botão de ação no cartão; qualquer controle de paginação; qualquer contagem de resultados |

**Divergências entre a captura e as convenções em vigor — e como esta spec as resolve:**

| # | Ponto | Captura | Convenção ou princípio em vigor | Decisão desta spec |
|---|---|---|---|---|
| 1 | Endereço da tela | `/animals` | Caminhos de interface em PT-BR (`/cadastro`, `/minha-area`, `/admin/especies`, `/admin/animais`) | `/animais` |
| 2 | Identificação no cabeçalho | E-mail do usuário | O `ClientLayout` em vigor exibe o **nome**; e o e-mail é dado pessoal | Exibir o **nome**. Ver RN-06 |
| 3 | Rótulo do filtro de espécie | "Animal" | O glossário do produto define o termo **Espécie** | Rótulo "Espécie". Ver "Requisitos Funcionais" e a Decisão 18 do changelog |
| 4 | Etiqueta de idade | "3 ano(s)" | A FEATURE-002 deste módulo já corrigiu "Total: 1 animais" por concordância | "3 anos" / "1 ano" / "5 meses" / "Menos de 1 mês" / "Idade não informada". Ver RN-38 e RN-39 |
| 5 | Rótulos dos campos de busca e de cidade | Apenas texto de apoio dentro do campo | Texto de apoio **não é rótulo** — exigência de acessibilidade | Todo controle recebe rótulo visível e associado. Ver RNF-21 e CA-51 |
| 6 | Natureza do campo "Cidade" | Ambígua na captura — aparenta campo de texto | Um campo de texto de cidade duplicaria a busca livre, que já procura por cidade | Campo de **seleção** de lista controlada. Ver RN-28 e RN-29 |
| 7 | Exigência de sessão | Cabeçalho autenticado | `MAKUCO.md`: catálogo público sem autenticação | Tela e endpoints **públicos**. Ver "Quem Acessa" e RN-01 |

Todas as sete decisões estão registradas no changelog desta feature.

**Contratos herdados que esta spec NÃO renegocia:**

- Rotas de interface em PT-BR; rotas de API em inglês.
- `PATCH` no lugar de `PUT` — irrelevante aqui, porque esta feature é somente leitura, mas registrado para que nenhuma escrita seja introduzida por engano.
- **Somente animais com status `DISPONIVEL` aparecem na vitrine** (RN-13 da FEATURE-002 deste módulo).
- **A idade é sempre derivada da data de nascimento e nunca persistida** (RN-20 da FEATURE-002 deste módulo), calculada no fuso `America/Sao_Paulo` (RN-22 daquela spec).
- **Animal sem imagem é válido** (RN-30 daquela spec).
- **A localização vem sempre do dado persistido** — cidade e sigla do estado, sem chamada a serviço externo em tempo de renderização (RN-27 e RN-28 daquela spec).
- **A resposta pública é montada por projeção explícita de campos públicos, jamais serializando a entidade** (RN-59 daquela spec e CA-45 daquela spec, que a nomeia como restrição vinculante para esta feature).
- Envelope de coleção `{ items, pagination: { page, pageSize, total } }`, com `pageSize` máximo de 100.
- Envelope de erro `{ error: { code, message, details? } }`, com o frontend ramificando por `code` e nunca pelo texto de `message`.

**Artefatos consultados:**
- `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md` — modelo de dados de Animal, RN-13 a RN-22, RN-27 a RN-29, RN-41 a RN-43, RN-59; contrato de `GET /api/animals`; decisões A, B e C
- `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/changelog_context.md` — decisões congeladas que esta spec herda
- `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md` — envelope de coleção, precedente da coluna normalizada persistida, convenção de rota
- `.makuco/specs/module_001_autenticacao/feature_002_autenticacao_completa/spec_context.md` — envelope de erro, numeração, guardas de rota
- `MAKUCO.md` — "Public catalog: no authentication required"
- `services/frontend/src/routes/route-paths.ts`, `services/frontend/src/routes/app-routes.tsx`, `services/frontend/src/layouts/client-layout.tsx` — árvore de rotas, guardas e cabeçalho em vigor
- `.makuco/resources/reference.html` e `tailwind.config.js` — identidade visual CatDog

**Tabelas de banco de dados:** `animals`, `animal_images`, `species`, `cities` e `states` — **todas já existentes**. Esta feature **não cria nenhuma tabela**; ela acrescenta duas colunas e um índice, de forma aditiva. Ver "Modelo de Dados".
**MCPs utilizados:** Não aplicável nesta feature
**SKILLs utilizados:** Não aplicável nesta feature

---

### Termos Novos no Glossário

| Termo | Definição | Evitar |
|---|---|---|
| Vitrine | Tela pública que lista os animais disponíveis para adoção, acessível sem sessão. É o ponto de entrada do cliente no produto. | Catálogo administrativo, listagem, loja |
| Cartão do animal | Unidade visual da vitrine: foto de capa, nome, espécie, localização, sexo, porte, idade e descrição de um animal. | Item, linha, tile |
| Projeção pública | Conjunto fechado e explicitamente enumerado de campos que a vitrine devolve para cada animal. Nada fora dele sai da API pública, ainda que exista na entidade. | Serialização, DTO genérico |
| Filtro aplicado | Filtro cujo valor é diferente de vazio e que, portanto, participa da consulta. Distingue-se do filtro apenas visível. | Filtro preenchido |
| Busca livre | Texto digitado pelo visitante, comparado ao nome do animal **ou** ao nome da cidade. Distinta do filtro de cidade, que é escolha de lista controlada. | Pesquisa, query |

---

## Grupo 3 — Comportamento

### Histórias de Usuário

---

#### HU-01 — Ver a vitrine sem ter conta

Um visitante recebe o endereço da vitrine e o abre. A página carrega e exibe o título "Animais para adoção", a barra de filtros e a grade de cartões dos animais disponíveis. Em nenhum momento é pedido login, e nenhum conteúdo fica escondido atrás de sessão.

**Pode ser testada independentemente:** Sim — abrir o endereço sem nenhuma sessão, com o armazenamento do navegador limpo, e verificar que a lista de animais é exibida por inteiro, sem redirecionamento para a tela de login.

**Cenários de aceite:**

1. **Dado** que não há sessão ativa, **quando** o visitante abre o endereço da vitrine, **então** a página é exibida com o título "Animais para adoção", a barra de filtros e a grade de cartões — sem redirecionamento.
2. **Dado** que não há sessão ativa, **quando** a vitrine solicita a lista de animais, **então** a resposta é bem-sucedida e nenhuma requisição de renovação de sessão é disparada.
3. **Dado** que existe uma sessão **expirada** no navegador, **quando** o visitante abre a vitrine, **então** a lista é exibida normalmente, o visitante **não** é levado ao login e a vitrine não depende do desfecho de nenhuma renovação de sessão.
4. **Dado** que o visitante está autenticado com role `cliente`, **quando** abre a vitrine, **então** vê exatamente a mesma lista, os mesmos filtros e os mesmos dados de cartão que um visitante sem sessão.
5. **Dado** que o visitante está autenticado com role `admin`, **quando** abre a vitrine, **então** vê exatamente o mesmo conteúdo — nenhum controle administrativo é oferecido nesta tela.
6. **Dado** que o visitante compartilha o endereço da vitrine com outra pessoa, **quando** essa pessoa o abre sem ter conta, **então** ela vê a mesma vitrine.

---

#### HU-02 — Reconhecer-se no cabeçalho quando há sessão

O cabeçalho da vitrine é claro, traz o logotipo CatDog à esquerda e se adapta à presença de sessão: sem sessão, oferece o caminho para entrar ou criar conta; com sessão, identifica quem está logado e oferece a saída. A adaptação é **exclusivamente** do cabeçalho — o conteúdo da vitrine não muda.

**Pode ser testada independentemente:** Sim — abrir a vitrine sem sessão e com sessão e comparar o cabeçalho e o conteúdo.

**Cenários de aceite:**

1. **Dado** que não há sessão ativa, **quando** o cabeçalho é exibido, **então** ele traz o logotipo CatDog à esquerda e, à direita, as ações de entrar e de criar conta.
2. **Dado** que há sessão ativa, **quando** o cabeçalho é exibido, **então** ele traz o logotipo à esquerda e, à direita, o **nome** do usuário e o controle "Sair".
3. **Dado** que o usuário aciona "Sair", **quando** a saída é concluída, **então** ele permanece na vitrine, o cabeçalho volta ao estado sem sessão e a lista de animais continua sendo exibida.
4. **Dado** que a sessão ainda está sendo restaurada ao abrir a página, **quando** o cabeçalho é exibido, **então** ele não pisca entre os dois estados nem exibe o nome de ninguém antes de saber que há sessão, e **a grade de animais já é carregada** sem esperar por essa decisão.
5. **Dado** que o cabeçalho exibe o controle "Sair" com um ícone, **quando** um leitor de tela o percorre, **então** anuncia "Sair" — o ícone é decorativo e não acrescenta anúncio.
6. **Dado** que o visitante aciona o logotipo CatDog, **quando** a navegação ocorre, **então** ele permanece na vitrine.

---

#### HU-03 — Ver as informações de cada animal no cartão

Cada animal disponível é apresentado em um cartão com foto de capa no topo, nome em destaque, etiqueta da espécie alinhada à direita, localização com ícone de marcador, três etiquetas de característica — sexo, porte e idade — e a descrição.

**Pode ser testada independentemente:** Sim — cadastrar um animal com todos os dados, abrir a vitrine e conferir cada elemento do cartão contra o cadastro.

**Cenários de aceite:**

1. **Dado** o animal "Theo", cachorro, macho, porte grande, em Campo Magro/PR, nascido em 05/11/2022, com foto e descrição, **quando** a vitrine é exibida com o relógio em 25/08/2026, **então** o cartão apresenta a foto no topo, "Theo" em destaque, a etiqueta "Cachorro" à direita, "Campo Magro - PR" precedido do ícone de marcador, as etiquetas "Macho", "Grande" e "3 anos", e a descrição.
2. **Dado** que o animal possui mais de uma imagem, **quando** o cartão é exibido, **então** a imagem apresentada é a **de capa** — a primeira na ordem definida pelo administrador.
3. **Dado** que o animal não possui nenhuma imagem, **quando** o cartão é exibido, **então** um marcador substituto neutro ocupa o lugar da foto, o cartão mantém a mesma altura dos demais e todas as demais informações continuam presentes.
4. **Dado** que o endereço da imagem de capa existe mas o arquivo não pode ser carregado, **quando** o cartão é exibido, **então** o mesmo marcador substituto é apresentado — nunca o ícone de imagem quebrada do navegador.
5. **Dado** que o animal não possui data de nascimento, **quando** o cartão é exibido, **então** a etiqueta de idade apresenta "Idade não informada" e as etiquetas de sexo e porte permanecem.
6. **Dado** que o animal não possui descrição, **quando** o cartão é exibido, **então** a área de descrição simplesmente não aparece e o cartão continua alinhado aos demais da grade.
7. **Dado** que a descrição é longa, **quando** o cartão é exibido, **então** ela é truncada visualmente, sem que o texto completo seja removido do documento — a truncagem é apenas de apresentação.
8. **Dado** que a descrição de um animal contém `<script>alert(1)</script>` ou `<img src=x onerror=alert(1)>`, **quando** o cartão é exibido, **então** os caracteres aparecem **literalmente como texto** e nenhum script é executado.
9. **Dado** que o animal tem menos de um ano, **quando** o cartão é exibido, **então** a etiqueta de idade apresenta a idade em **meses completos**.
10. **Dado** que a vitrine é exibida em uma tela estreita, **quando** a grade é montada, **então** os cartões passam a uma única coluna e nenhum conteúdo é cortado nem exige rolagem horizontal da página.

---

#### HU-04 — Ver apenas os animais disponíveis

O visitante vê exclusivamente animais com status Disponível. Animais Reservados, Adotados ou Indisponíveis não aparecem na vitrine, não são contados no total e não podem ser alcançados por nenhum parâmetro da consulta.

**Pode ser testada independentemente:** Sim — cadastrar um animal em cada um dos quatro status e verificar que apenas o Disponível é devolvido, e que não existe nenhuma forma de pedir os outros.

**Cenários de aceite:**

1. **Dado** que existem quatro animais, um em cada status, **quando** a vitrine é exibida, **então** apenas o animal Disponível aparece e o total de resultados é 1.
2. **Dado** que existe um animal Reservado, **quando** a vitrine é exibida, **então** ele não aparece em nenhuma página da grade.
3. **Dado** que existe um animal Adotado, **quando** a vitrine é exibida, **então** ele não aparece em nenhuma página da grade.
4. **Dado** que existe um animal Indisponível, **quando** a vitrine é exibida, **então** ele não aparece em nenhuma página da grade.
5. **Dado** que um animal Disponível aparece na vitrine, **quando** o administrador altera o status dele para Adotado, **então** a próxima consulta à vitrine já não o traz — sem necessidade de expirar nenhum cache.
6. **Dado** que um animal Adotado volta a Disponível, **quando** a vitrine é consultada de novo, **então** ele volta a aparecer.
7. **Dado** que a consulta pública é feita com um parâmetro `status`, **quando** ela chega ao servidor, **então** é recusada por campo não permitido — o status não é escolhível pelo público em hipótese alguma.
8. **Dado** que a resposta pública de um animal é inspecionada, **quando** as suas chaves são listadas, **então** `status` não está entre elas.

---

#### HU-05 — Buscar por nome ou por cidade

O visitante digita no campo de busca. A vitrine passa a exibir apenas os animais cujo **nome** ou cuja **cidade** contenham o texto digitado, sem exigir acerto de maiúsculas, de acentos ou de posição dentro da palavra.

**Pode ser testada independentemente:** Sim — cadastrar animais com nomes e cidades conhecidos, digitar trechos de cada um e conferir o conjunto devolvido.

**Cenários de aceite:**

1. **Dado** que existe o animal "Theo", **quando** o visitante busca por "the", **então** "Theo" aparece na grade.
2. **Dado** que existe o animal "Theo" em "Campo Magro", **quando** o visitante busca por "magro", **então** "Theo" aparece — a busca também procura na cidade.
3. **Dado** que existe o animal "José" em "São Paulo", **quando** o visitante busca por "jose" ou por "sao paulo", **então** ambos encontram — a busca ignora acentos.
4. **Dado** que existe o animal "Theo", **quando** o visitante busca por "THEO" ou "tHeO", **então** ele aparece — a busca ignora maiúsculas e minúsculas.
5. **Dado** que existe o animal "Bidu", **quando** o visitante busca por "id", **então** "Bidu" aparece — a busca casa em qualquer posição, não apenas no começo.
6. **Dado** que o visitante digita "theo campo", **quando** a busca é aplicada, **então** nada é encontrado — o texto é procurado inteiro, e não quebrado em palavras independentes.
7. **Dado** que o visitante digita apenas espaços, **quando** a busca é aplicada, **então** ela é tratada como busca vazia e a lista completa volta a ser exibida.
8. **Dado** que a busca não encontra nada, **quando** a grade é exibida, **então** a mensagem de nenhum resultado com filtros aplicados é apresentada, junto da ação de limpar filtros.
9. **Dado** que o visitante está digitando, **quando** ele acrescenta letras rapidamente, **então** apenas uma consulta é enviada ao fim da digitação, e não uma por tecla.
10. **Dado** que duas consultas foram disparadas em sequência rápida e a primeira responde depois da segunda, **quando** as respostas chegam, **então** prevalece sempre a da **última** consulta disparada, e a resposta obsoleta é descartada.

---

#### HU-06 — Estreitar a lista por espécie, porte, sexo, idade máxima e cidade

Ao lado da busca, o visitante dispõe de cinco filtros: espécie, porte, sexo, idade máxima e cidade. Cada um começa em "todos". Escolhidos, eles se somam entre si e à busca, sempre restringindo a lista.

**Pode ser testada independentemente:** Sim — cadastrar animais que se distingam em cada dimensão e verificar o conjunto devolvido para cada filtro isolado e para todos combinados.

**Cenários de aceite:**

1. **Dado** que nenhum filtro foi escolhido, **quando** a vitrine é exibida, **então** todos os animais disponíveis aparecem e cada campo de seleção exibe a sua opção "todos".
2. **Dado** que o visitante escolhe a espécie "Cachorro", **quando** a lista é atualizada, **então** apenas cachorros disponíveis aparecem.
3. **Dado** que o visitante escolhe o porte "Grande", **quando** a lista é atualizada, **então** apenas animais de porte grande aparecem.
4. **Dado** que o visitante escolhe o sexo "Fêmea", **quando** a lista é atualizada, **então** apenas fêmeas aparecem.
5. **Dado** que o visitante escolhe a cidade "Campo Magro - PR", **quando** a lista é atualizada, **então** apenas animais daquela cidade aparecem.
6. **Dado** que o visitante informa idade máxima 2, **quando** a lista é atualizada, **então** aparecem apenas animais com dois anos completos ou menos.
7. **Dado** que o visitante preenche os cinco filtros e a busca ao mesmo tempo, **quando** a lista é atualizada, **então** aparecem apenas os animais que satisfazem **todos** os critérios simultaneamente.
8. **Dado** que o visitante limpa um dos filtros voltando-o para "todos", **quando** a lista é atualizada, **então** aquele critério deixa de restringir e os demais continuam valendo.
9. **Dado** que o visitante aciona "Limpar filtros", **quando** a ação é concluída, **então** a busca e os cinco filtros voltam ao estado inicial, a lista completa é exibida e o endereço da página volta a não conter nenhum parâmetro de filtro.
10. **Dado** que nenhum filtro está aplicado, **quando** o visitante observa o botão "Limpar filtros", **então** ele está visível e **desabilitado**, sem mudar o arranjo da barra.
11. **Dado** que o visitante altera qualquer filtro estando na página 3, **quando** a lista é atualizada, **então** ele volta para a página 1.
12. **Dado** que a combinação escolhida não encontra nenhum animal, **quando** a grade é exibida, **então** a mensagem de nenhum resultado com filtros aplicados é apresentada, e não a mensagem de catálogo vazio.

---

#### HU-07 — Entender por que a busca e o filtro de cidade coexistem

A barra oferece, ao mesmo tempo, uma busca livre que procura por cidade e um filtro de cidade. Eles não são redundantes: a busca é texto livre e aproximada, o filtro é escolha exata de uma lista controlada. Os dois se combinam por E.

**Pode ser testada independentemente:** Sim — usar cada um isoladamente e depois os dois juntos, com valores coerentes e com valores conflitantes.

**Cenários de aceite:**

1. **Dado** que o visitante abre o filtro de cidade, **quando** as opções são exibidas, **então** ele vê uma lista de cidades identificadas como "Cidade - UF", em ordem, e **apenas cidades que possuem ao menos um animal disponível**.
2. **Dado** que existem animais em duas cidades, **quando** o filtro de cidade é aberto, **então** exatamente essas duas cidades são oferecidas — e não as milhares de cidades do cadastro de apoio.
3. **Dado** que o visitante escolhe a cidade "Campo Magro - PR", **quando** a lista é atualizada, **então** o critério é de **igualdade exata** com aquela cidade, e uma cidade de nome parecido em outro estado não é incluída.
4. **Dado** que o visitante busca por "campo" e escolhe a cidade "Campo Magro - PR", **quando** a lista é atualizada, **então** aparecem apenas os animais de Campo Magro cujo nome **ou** cidade contenham "campo" — os dois critérios se somam, e a redundância entre eles é inofensiva.
5. **Dado** que o visitante busca por "curitiba" e escolhe a cidade "Campo Magro - PR", **quando** a lista é atualizada, **então** nada é encontrado, porque nenhum animal satisfaz os dois critérios ao mesmo tempo — e a mensagem de nenhum resultado com filtros aplicados é exibida.
6. **Dado** que o último animal de uma cidade deixa de estar disponível, **quando** o filtro de cidade é aberto de novo, **então** aquela cidade já não é oferecida.
7. **Dado** que o visitante chegou por um link cuja cidade escolhida não está mais entre as oferecidas, **quando** a página carrega, **então** o filtro continua aplicado e a cidade escolhida é apresentada no campo, para que ele veja e possa removê-la — em vez de sumir em silêncio.

---

#### HU-08 — Filtrar por idade máxima sabendo o que isso exclui

O visitante informa uma idade máxima em anos. A vitrine passa a exibir apenas animais cuja idade derivada seja igual ou menor. Animais **sem data de nascimento** são excluídos enquanto esse filtro estiver aplicado, e a tela informa isso.

**Pode ser testada independentemente:** Sim — cadastrar animais de idades conhecidas e um sem data de nascimento, aplicar o filtro e conferir o conjunto devolvido e a mensagem de apoio.

**Cenários de aceite:**

1. **Dado** que existe um animal de 3 anos e outro de 5, **quando** o visitante informa idade máxima 3, **então** apenas o de 3 anos aparece.
2. **Dado** que existe um animal cujo aniversário de 4 anos é **hoje**, **quando** o visitante informa idade máxima 3, **então** ele **não** aparece — ele já completou 4.
3. **Dado** que existe um animal cujo aniversário de 4 anos é **amanhã**, **quando** o visitante informa idade máxima 3, **então** ele **aparece** — ainda tem 3 anos completos.
4. **Dado** que existe um animal **sem data de nascimento**, **quando** o filtro de idade máxima é aplicado com qualquer valor, **então** ele **não** aparece.
5. **Dado** que existe um animal **sem data de nascimento**, **quando** o filtro de idade máxima **não** está aplicado, **então** ele aparece normalmente, com a etiqueta "Idade não informada".
6. **Dado** que o campo de idade máxima está visível, **quando** o visitante o observa, **então** encontra um texto de apoio informando que animais sem data de nascimento não aparecem enquanto o filtro estiver em uso.
7. **Dado** que o visitante informa idade máxima 0, **quando** a lista é atualizada, **então** aparecem apenas animais com menos de um ano completo — e 0 é um valor válido, não é "sem filtro".
8. **Dado** que o visitante apaga o conteúdo do campo de idade máxima, **quando** a lista é atualizada, **então** o filtro deixa de ser aplicado e os animais sem data de nascimento voltam a aparecer.
9. **Dado** qualquer resultado devolvido com idade máxima N, **quando** a idade exibida em cada cartão é conferida, **então** nenhuma delas é maior que N — o critério do filtro e a idade apresentada nunca divergem.

---

#### HU-09 — Navegar entre páginas de resultados

A vitrine traz os animais em páginas. Enquanto o total couber em uma página, nenhum controle de navegação aparece — é o caso da captura, com um único animal. Havendo mais, o visitante navega entre as páginas, e nenhum animal se repete nem desaparece.

**Pode ser testada independentemente:** Sim — cadastrar mais animais do que cabem em uma página, percorrer todas e conferir que o conjunto dos identificadores é exatamente o esperado.

**Cenários de aceite:**

1. **Dado** que existe apenas um animal disponível, **quando** a vitrine é exibida, **então** nenhum controle de navegação entre páginas é apresentado.
2. **Dado** que o total de animais disponíveis excede o tamanho da página, **quando** a vitrine é exibida, **então** os controles de navegação entre páginas são apresentados abaixo da grade.
3. **Dado** que existem 45 animais disponíveis criados no mesmo instante, **quando** o visitante percorre todas as páginas, **então** os 45 aparecem exatamente uma vez cada, sem repetição e sem omissão.
4. **Dado** que o visitante está na primeira página, **quando** observa os controles, **então** a ação de página anterior está desabilitada; na última página, a de página seguinte está desabilitada.
5. **Dado** que o visitante navega para a página 2, **quando** o endereço da página é observado, **então** ele registra a página atual e pode ser compartilhado.
6. **Dado** que o visitante está na página 2 e recarrega a página, **quando** ela termina de carregar, **então** ele continua na página 2, com os mesmos filtros.
7. **Dado** que o visitante está na página 3 e um filtro é alterado, **quando** a lista é atualizada, **então** ele volta para a página 1.
8. **Dado** que o endereço informa uma página maior que a última existente, **quando** a página carrega, **então** a grade é exibida vazia com a mensagem de nenhum resultado, sem erro e sem tela quebrada.
9. **Dado** que o visitante troca de página, **quando** a nova página é apresentada, **então** a rolagem volta ao topo da grade, para que ele não comece a nova página no meio.

---

#### HU-10 — Compartilhar e recuperar o estado dos filtros pelo endereço

O estado da busca, dos cinco filtros e da página vive no endereço da página. Um link copiado reproduz exatamente a mesma vitrine em outro navegador, e recarregar a página não perde nada.

**Pode ser testada independentemente:** Sim — aplicar filtros, copiar o endereço, abrir em uma janela limpa e comparar a barra de filtros e a grade.

**Cenários de aceite:**

1. **Dado** que o visitante aplicou busca, espécie, porte, sexo, idade máxima e cidade, **quando** observa o endereço da página, **então** todos os valores aplicados estão registrados nele.
2. **Dado** que o endereço com filtros é aberto em uma janela sem sessão e sem histórico, **quando** a página carrega, **então** a barra de filtros já aparece preenchida com aqueles valores e a grade já vem filtrada.
3. **Dado** que o visitante recarrega a página com filtros aplicados, **quando** ela termina de carregar, **então** nada é perdido.
4. **Dado** que o visitante aciona o botão de voltar do navegador após alterar um filtro, **quando** a navegação ocorre, **então** o estado anterior dos filtros é restaurado e a grade acompanha.
5. **Dado** que um filtro está vazio, **quando** o endereço é montado, **então** ele **não** carrega o parâmetro correspondente — o endereço só registra o que está de fato aplicado.
6. **Dado** que o endereço traz um valor inválido — idade negativa, texto onde se espera número, identificador de espécie que não existe ou porte fora da lista —, **quando** a página carrega, **então** aquele filtro é descartado, o endereço é corrigido e **a vitrine é exibida normalmente**, sem tela de erro.
7. **Dado** que o endereço traz um parâmetro desconhecido, **quando** a página carrega, **então** ele é ignorado e removido, sem afetar os demais.
8. **Dado** que o visitante aciona "Limpar filtros", **quando** a ação é concluída, **então** o endereço volta a ser o da vitrine sem nenhum parâmetro.

---

#### HU-11 — Entender os dois estados de "não há nada aqui"

Uma grade vazia tem duas causas diferentes e o visitante precisa distingui-las: ou o catálogo inteiro não tem nenhum animal disponível, ou os filtros que ele aplicou não encontraram nada. As mensagens são diferentes e a segunda oferece saída.

**Pode ser testada independentemente:** Sim — esvaziar o catálogo e conferir a primeira mensagem; repovoar e aplicar um filtro impossível para conferir a segunda.

**Cenários de aceite:**

1. **Dado** que não existe nenhum animal disponível e nenhum filtro está aplicado, **quando** a vitrine é exibida, **então** a mensagem "Nenhum animal disponível para adoção no momento. Volte em breve!" é apresentada, sem ação de limpar filtros.
2. **Dado** que existem animais disponíveis mas os filtros aplicados não encontram nenhum, **quando** a grade é exibida, **então** a mensagem "Nenhum animal encontrado com os filtros aplicados." é apresentada, acompanhada da ação "Limpar filtros".
3. **Dado** que o visitante aciona "Limpar filtros" a partir do estado vazio com filtros, **quando** a ação é concluída, **então** a grade volta a exibir os animais disponíveis.
4. **Dado** que o catálogo está vazio **e** filtros estão aplicados, **quando** a grade é exibida, **então** vale a mensagem de filtros aplicados — ela é a que oferece uma ação útil ao visitante.
5. **Dado** que a lista está sendo carregada, **quando** a tela é exibida, **então** um indicador de carregamento ocupa o lugar da grade, **a barra de filtros permanece visível e utilizável**, e nenhuma das duas mensagens de vazio é apresentada.
6. **Dado** que a consulta à lista falha, **quando** a tela é exibida, **então** a mensagem "Não foi possível carregar os animais. Tente novamente." é apresentada com a possibilidade de nova tentativa, e não uma das mensagens de vazio.
7. **Dado** que a consulta das opções de filtro falha, **quando** a tela é exibida, **então** a grade continua sendo carregada e exibida, e os campos de seleção afetados informam a falha em vez de aparecerem vazios.

---

#### HU-12 — Garantir que nenhum dado interno escape pela vitrine

A resposta pública de cada animal contém um conjunto fechado e explicitamente enumerado de campos. Um campo novo acrescentado à entidade Animal — hoje, o número do chip e o contato do proprietário estão diferidos, mas previstos no escopo aprovado — **não** aparece na vitrine por padrão.

**Pode ser testada independentemente:** Sim — inspecionar as chaves da resposta pública e, em seguida, acrescentar um campo à entidade e verificar que a resposta não muda.

**Cenários de aceite:**

1. **Dado** que a resposta pública de um animal é inspecionada, **quando** as suas chaves são listadas, **então** elas são **exatamente** o conjunto definido na projeção pública — nem uma a mais, nem uma a menos.
2. **Dado** que um campo novo é acrescentado à entidade Animal, **quando** a vitrine é consultada de novo, **então** a resposta permanece **idêntica**, sem o campo novo.
3. **Dado** que a resposta pública é inspecionada, **quando** se procura por `status`, `birthDate`, `createdAt`, `updatedAt` ou pelo identificador da cidade, **então** nenhum deles está presente.
4. **Dado** que a resposta pública é inspecionada, **quando** o objeto de espécie é observado, **então** ele possui exatamente identificador e nome, e o objeto de cidade possui exatamente nome e sigla do estado.
5. **Dado** que a montagem da resposta pública é lida no código, **quando** se procura por serialização da entidade inteira, **então** não existe nenhuma — os campos são listados um a um, e a consulta ao banco também seleciona apenas as colunas necessárias.
6. **Dado** que a projeção pública devolve apenas o endereço da imagem de capa, **quando** um animal com cinco imagens é consultado, **então** a resposta traz um único endereço de imagem, e não a lista inteira.

---

#### HU-13 — Demonstrar interesse por um animal (fronteira desta feature)

O escopo aprovado prevê um módulo de Pedidos em que o cliente demonstra interesse por um animal. Ele **não existe** e **não é entregue aqui**. Esta história existe para nomear a fronteira de forma explícita e registrar o gancho, em vez de deixar a lacuna implícita.

**Pode ser testada independentemente:** Sim — verificar que nenhum cartão oferece ação e que nada nesta feature escreve no cadastro.

**Cenários de aceite:**

1. **Dado** que a vitrine é exibida, **quando** um cartão é observado, **então** ele **não** apresenta nenhum botão de ação — coerente com a captura, que também não apresenta.
2. **Dado** que a vitrine é usada por completo, **quando** as requisições são observadas, **então** todas são de leitura; esta feature não altera nenhum registro do cadastro.
3. **Dado** que a vitrine é usada por um `cliente` autenticado, **quando** os cartões são observados, **então** eles são iguais aos de um visitante — a sessão não habilita nenhuma ação nesta feature.
4. **Dado** que a projeção pública devolve o identificador do animal, **quando** o módulo de Pedidos existir, **então** ele terá do cartão tudo o que precisa para abrir um pedido, sem que a projeção pública precise ganhar campo interno.

---

### Regras de Negócio

**Acesso público**

- **RN-01:** A vitrine e os endpoints que a alimentam são **públicos**: respondem sem sessão, sem cabeçalho de autorização e sem qualquer verificação de permissão. Nenhum deles monta a autenticação nem a verificação de role. Esta é a primeira superfície de leitura anônima do produto fora do fluxo de autenticação.
- **RN-02:** Nenhum endpoint desta feature responde `401` ou `403` em circunstância alguma. Uma resposta `401` vinda da vitrine é defeito, não comportamento.
- **RN-03:** A presença de sessão **não altera** o conjunto de animais devolvido, os filtros oferecidos nem os campos de cada animal. Um visitante anônimo, um `cliente` e um `admin` recebem exatamente a mesma resposta para a mesma consulta.
- **RN-04:** A vitrine **não depende do estado da sessão para carregar**. A grade é solicitada assim que a página monta, sem esperar a restauração da sessão. Uma sessão expirada, uma renovação que falhou ou a ausência total de credencial produzem a mesma vitrine funcionando.
- **RN-05:** Uma requisição da vitrine **nunca** dispara renovação de sessão nem redirecionamento para a tela de login, ainda que exista uma credencial vencida no navegador. O tratamento de sessão expirada em vigor no cliente HTTP não se aplica ao caminho da vitrine.
- **RN-06:** O cabeçalho da vitrine é o **único** elemento sensível à sessão. Sem sessão, ele oferece as ações de entrar e de criar conta. Com sessão, exibe o **nome** do usuário e a ação "Sair". **A captura exibe o e-mail; esta spec adota o nome**, por dois motivos: o e-mail é dado pessoal e esta é, por definição do produto, uma página pública, passível de ser vista por terceiros sobre o ombro do usuário; e o `ClientLayout` já em produção exibe o nome, de modo que exibir o e-mail aqui criaria duas identificações diferentes para o mesmo usuário na mesma aplicação. Se o nome estiver ausente, nada é exibido no lugar — o e-mail **não** é usado como alternativa.
- **RN-07:** Sair a partir da vitrine mantém o usuário **na vitrine**. Ele não é levado ao login: acabou de sair de uma tela que não exige sessão, e expulsá-lo dela seria incoerente.
- **RN-08:** Esta feature é **exclusivamente de leitura**. Nenhum endpoint dela cria, altera ou remove qualquer registro. Nenhuma ação da tela escreve no cadastro.

**Visibilidade dos animais**

- **RN-09:** A vitrine exibe **apenas** animais com status `DISPONIVEL`. Os status `RESERVADO`, `ADOTADO` e `INDISPONIVEL` são invisíveis ao público, individualmente e sem exceção. Regra herdada da RN-13 da FEATURE-002 deste módulo e não renegociável.
- **RN-10:** O status **não é parâmetro** da consulta pública. Enviá-lo é recusado como campo não permitido. Tornar o status inexprimível no contrato é mais forte do que validá-lo: não existe requisição, malformada ou maliciosa, capaz de pedir um animal indisponível.
- **RN-11:** A restrição por status é aplicada **na consulta ao banco**, e não filtrando em memória o resultado de uma consulta mais ampla. Isso é obrigatório para que o total de registros e a paginação estejam corretos, e não apenas o conteúdo da página exibida.
- **RN-12:** A resposta da vitrine reflete o estado corrente do cadastro. **Não há camada de cache** entre o banco e a resposta, e a resposta não é armazenável por intermediários. Um animal que passa a Adotado desaparece da vitrine na consulta seguinte. Um cache aqui exibiria animais já adotados a novos interessados — o pior defeito possível nesta tela.
- **RN-13:** O status **não integra** a projeção pública. Todo animal devolvido está disponível por construção; devolver o campo seria redundante e convidaria um consumidor futuro a exibi-lo numa tela que jamais deve mostrar os outros três valores.

**Ordenação e paginação**

- **RN-14:** A ordenação padrão da vitrine é **decrescente pela data de cadastro** — os animais cadastrados mais recentemente aparecem primeiro. A vitrine tem propósito diferente da listagem administrativa da FEATURE-002 deste módulo, que é alfabética: lá o administrador procura um animal que ele sabe existir; aqui o visitante descobre animais que não conhece, e dar visibilidade a quem acabou de entrar no catálogo é o comportamento correto para uma vitrine.
- **RN-15:** O critério de desempate é o **identificador do animal**, em ordem crescente. Ele é obrigatório e não é detalhe: sem um critério que nunca empata, dois animais cadastrados no mesmo instante podem trocar de posição entre uma página e outra, fazendo um registro aparecer duas vezes e outro desaparecer. Como o identificador é único, a ordenação completa é total e determinística.
- **RN-16:** A vitrine **não oferece ordenação configurável**. Um seletor de ordenação não aparece na captura e multiplicaria as combinações a testar sem benefício demonstrado neste momento.
- **RN-17:** A vitrine é **paginada no servidor**, reaproveitando o envelope já congelado `{ items, pagination: { page, pageSize, total } }`. O tamanho de página padrão é **12** e o máximo é **100**. O padrão difere dos 20 da listagem administrativa porque a unidade aqui é o cartão, não a linha de tabela: 12 é divisível por 2, 3 e 4, que são as quantidades de colunas da grade nos três tamanhos de tela, de modo que nenhuma página termina em fila incompleta. O máximo de 100 é mantido idêntico ao já congelado.
- **RN-18:** A vitrine **não usa rolagem infinita**. A alternativa foi considerada e descartada por quatro motivos: ela é incompatível com a RN-46, que exige o estado da tela registrado no endereço da página, porque não há posição de rolagem compartilhável; exigiria observação de interseção e acumulação de estado no cliente, que a base de dependências do frontend não possui; tornaria a última página inalcançável por teclado e por leitor de tela; e impediria o visitante de voltar a um resultado já visto sem recarregar tudo.
- **RN-19:** Os controles de navegação entre páginas só são apresentados **quando o total excede o tamanho da página**. A captura, com um único animal, não exibe controle nenhum e, por esta regra, está em conformidade.
- **RN-20:** Uma página além da última existente responde com sucesso e lista vazia, nunca com erro. O visitante vê a mensagem de nenhum resultado, e não uma tela quebrada.
- **RN-21:** Ao trocar de página, a apresentação é reposicionada no topo da grade, para que o visitante comece a nova página pelo primeiro cartão.

**Busca livre**

- **RN-22:** A busca livre compara o texto digitado com o **nome do animal** e com o **nome da cidade** do animal, e devolve o animal se **qualquer um dos dois** casar. É uma disjunção entre dois campos, e não duas buscas separadas.
- **RN-23:** A comparação da busca é **insensível a maiúsculas e minúsculas** e **insensível a acentos**: "jose" encontra "José", "SAO PAULO" encontra "São Paulo", "cão" encontra "cao". A insensibilidade a acentos é obtida por comparação entre valores já reduzidos a minúsculas e sem marcas diacríticas, e **não** depende da configuração de ordenação do banco de dados — a mesma escolha, e pelo mesmo motivo, que a FEATURE-001 deste módulo fez ao persistir uma coluna normalizada em vez de confiar na collation.
- **RN-24:** A comparação da busca é por **conteúdo em qualquer posição**: "id" encontra "Bidu" e "magro" encontra "Campo Magro". Não há exigência de casar o começo da palavra.
- **RN-25:** O texto da busca é tratado como **uma única sequência**, não quebrada em palavras independentes. "theo campo" procura literalmente essa sequência e não encontra um animal chamado "Theo" na cidade "Campo Magro". A regra é declarada explicitamente para que ninguém assuma busca por termos; ela mantém o comportamento determinístico e previsível para quem digita o nome de um animal ou de uma cidade.
- **RN-26:** Antes da comparação, o texto da busca tem os espaços das extremidades removidos e as sequências de espaços internos colapsadas em um único espaço — a mesma normalização de forma já aplicada aos nomes gravados. Uma busca que sobre vazia após essa normalização é tratada como **busca não aplicada**.
- **RN-27:** A busca é limitada a **120 caracteres**, que é o tamanho máximo de um nome de cidade — o maior dos dois campos comparados. Texto acima disso é recusado por validação na API.

**Filtro de cidade e sua distinção da busca**

- **RN-28:** O **filtro de cidade** é uma escolha de lista controlada e compara por **igualdade exata** com a cidade do animal, identificada por identificador — e não por nome. Duas cidades homônimas em estados diferentes são, portanto, distinguidas sem ambiguidade.
- **RN-29:** A busca livre e o filtro de cidade **não são redundantes** e coexistem por desenho: a busca é texto livre, aproximada, e serve a quem não sabe exatamente o que procura; o filtro é escolha exata, determinística e compartilhável por link. Os dois se combinam por E. Uma combinação redundante ("campo" + Campo Magro) é aceita e inofensiva; uma combinação contraditória ("curitiba" + Campo Magro) devolve lista vazia, que é a resposta correta.
- **RN-30:** A lista de cidades oferecida no filtro contém **apenas cidades com ao menos um animal disponível**, apresentadas como "Cidade - UF" e ordenadas pela sigla do estado e, dentro dela, pelo nome da cidade. Oferecer as milhares de cidades do cadastro de apoio produziria uma lista impraticável em que quase toda escolha levaria a zero resultados.
- **RN-31:** A mesma regra vale para a lista de espécies do filtro: **apenas espécies com ao menos um animal disponível** são oferecidas, em ordem alfabética. As duas listas são derivadas do estado corrente do catálogo a cada consulta.
- **RN-32:** As listas de espécies e de cidades vêm do **dado persistido**, sem nenhuma chamada a serviço externo em tempo de execução. Regra herdada da RN-27 da FEATURE-002 deste módulo.
- **RN-33:** Se um filtro chegar pelo endereço da página com um valor que existe no cadastro mas **não está entre as opções oferecidas** — porque o último animal daquela espécie ou cidade deixou de estar disponível —, o filtro **permanece aplicado** e o valor é apresentado no campo de seleção como opção adicional, para que o visitante o veja e possa removê-lo. Apagar a escolha em silêncio esconderia do visitante o motivo de a lista estar vazia. Mesmo princípio da RN-56 da FEATURE-002 deste módulo.

**Filtros de conjunto fechado e combinação**

- **RN-34:** Os filtros de **porte** e de **sexo** aceitam exclusivamente os valores dos conjuntos fechados já congelados: `pequeno`, `medio`, `grande` e `macho`, `femea`. Qualquer outro valor é recusado por validação na API.
- **RN-35:** Todos os filtros, incluindo a busca, combinam entre si por **E**. Cada filtro vazio é neutro e não participa da consulta. Preencher todos ao mesmo tempo é operação válida e devolve a interseção de todos os critérios.
- **RN-36:** Alterar qualquer filtro ou a busca **repõe a paginação na primeira página**. Sem essa regra, um visitante na página 3 que estreita os filtros ficaria em uma página que passou a não existir e veria uma grade vazia sem entender por quê.

**Idade derivada e filtro de idade**

- **RN-37:** A idade é **derivada da data de nascimento e nunca persistida**, calculada a partir do relógio do servidor no fuso `America/Sao_Paulo`. Regra herdada das RN-20 e RN-22 da FEATURE-002 deste módulo e não renegociável: uma idade gravada envelheceria em silêncio e passaria a mentir.
- **RN-38:** A idade é apresentada em **anos completos** quando o animal tem um ano ou mais, e em **meses completos** quando tem menos de um ano. Abaixo de um mês completo, a apresentação é "Menos de 1 mês". Isto **estende de forma aditiva** a RN-20 da FEATURE-002 deste módulo, que a define apenas em anos: a idade em anos continua existindo com exatamente o mesmo significado, e a idade em meses é acrescentada porque um filhote de dois meses exibido como "0 anos" é informação inútil para quem adota, e a diferença entre dois e dez meses é decisiva na escolha. A captura exibe "3 ano(s)"; esta spec corrige a concordância para "3 anos" e "1 ano", pelo mesmo princípio que já corrigiu "Total: 1 animais" na FEATURE-002 deste módulo.
- **RN-39:** Quando não há data de nascimento, a idade é **ausente — e ausente é diferente de zero**. A apresentação é "Idade não informada". Regra herdada da RN-21 da FEATURE-002 deste módulo.
- **RN-40:** A idade incrementa **no aniversário**. Um animal cujo aniversário é hoje já conta o ano completo; um cujo aniversário é amanhã ainda não. Para nascidos em 29 de fevereiro, o aniversário em ano não bissexto é **1º de março** — o ano só se completa depois de 28 de fevereiro.
- **RN-41:** O filtro de **idade máxima** aceita um inteiro de **0 a 30**. O limite superior espelha a barreira de sanidade já aplicada à data de nascimento pela RN-19 da FEATURE-002 deste módulo. O valor **0 é válido e significativo**: seleciona os animais com menos de um ano completo. Valor ausente ou vazio significa filtro não aplicado; não é o mesmo que 0.
- **RN-42:** **Um animal sem data de nascimento é excluído sempre que o filtro de idade máxima estiver aplicado.** Não se pode afirmar que ele satisfaz o critério, e incluí-lo produziria resultados que contradizem o próprio filtro. Decisão tomada na FEATURE-002 deste módulo e transportada para cá deliberadamente. Sem o filtro aplicado, ele aparece normalmente.
- **RN-43:** A tela informa a consequência da RN-42 junto ao campo de idade máxima, em texto de apoio permanente. Um visitante que filtra por idade e perde metade do catálogo sem saber por quê é um defeito de produto, ainda que o comportamento esteja correto.
- **RN-44:** O filtro de idade máxima é resolvido **na consulta ao banco**, por comparação sobre a data de nascimento, e não filtrando em memória após a consulta. Filtrar depois produziria um total de registros e uma paginação incorretos.
- **RN-45:** **A idade que o filtro usa e a idade que o cartão exibe são sempre a mesma.** Todo animal devolvido sob idade máxima N tem, no próprio cartão, idade menor ou igual a N — inclusive em datas de fronteira. Esta é a invariante que qualquer divergência de aritmética entre o filtro e a apresentação viola, e é por isso que ela é escrita como regra e verificada como critério de aceite próprio.

**Estado da tela no endereço da página**

- **RN-46:** O estado da busca, dos cinco filtros e da página vive no **endereço da página**, na sua cadeia de parâmetros. Um endereço copiado reproduz a mesma vitrine em outro navegador, recarregar a página não perde nada e o botão de voltar do navegador funciona. Manter esse estado apenas em memória tornaria o resultado de uma busca incompartilhável, que é justamente o que um visitante quer fazer ao encontrar um animal.
- **RN-47:** Os parâmetros do endereço da página são escritos em **PT-BR**, seguindo a mesma convenção dos caminhos de interface — o endereço é interface visível ao usuário. Os parâmetros da **API** permanecem em inglês, seguindo a convenção já congelada. A tradução entre os dois é responsabilidade da tela.
- **RN-48:** Somente os filtros **aplicados** aparecem no endereço. Um filtro vazio não deixa parâmetro, e "Limpar filtros" devolve o endereço da vitrine sem nenhum parâmetro.
- **RN-49:** Valores inválidos vindos do endereço da página — idade negativa, texto onde se espera número, identificador malformado, porte fora da lista, parâmetro desconhecido — são **descartados pela tela**, que corrige o endereço e **exibe a vitrine normalmente**. Um link compartilhado que chegou adulterado ou truncado deve mostrar o catálogo, não uma tela de erro.
- **RN-50:** A **API**, ao contrário da tela, **recusa** valores inválidos com erro de validação. As duas posturas são deliberadamente diferentes e cada uma protege uma coisa: a tolerância da tela protege o visitante de um link estragado; o rigor da API impede que um filtro pare de filtrar em silêncio para qualquer consumidor, inclusive um que não seja esta tela.
- **RN-51:** Um identificador **bem formado mas inexistente** em espécie ou cidade não é erro: a consulta responde com sucesso e lista vazia. A espécie pode ter sido excluída depois de o link ser compartilhado, e um erro de recurso não encontrado afirmaria que a vitrine não existe, o que é falso. Isto difere deliberadamente da escrita administrativa, onde uma espécie inexistente é recusada, porque lá o identificador é uma referência obrigatória e aqui é um critério de seleção.
- **RN-52:** A busca é enviada com atraso deliberado após a digitação, e não a cada tecla. Alterações nos campos de seleção são aplicadas imediatamente.
- **RN-53:** Respostas que chegam **fora de ordem** são descartadas: vale sempre a resposta da última consulta disparada. Como o cliente HTTP em uso não oferece cancelamento de requisição, o descarte é feito por comparação de sequência na própria tela. Mesmo princípio já adotado na RN-57 da FEATURE-002 deste módulo para a lista de cidades.

**Projeção pública**

- **RN-54:** A resposta pública de cada animal é montada por **projeção explícita**, campo a campo, e **jamais** por serialização da entidade. Restrição vinculante herdada da RN-59 e do CA-45 da FEATURE-002 deste módulo. Esta é a feature em que a regra é de fato exercitada.
- **RN-55:** A proteção da RN-54 é aplicada em **duas camadas independentes, ambas obrigatórias**: a consulta ao banco seleciona explicitamente apenas as colunas necessárias, de modo que uma coluna nova sequer é lida; e a montagem da resposta enumera explicitamente as chaves, de modo que um campo que chegasse à camada de dados ainda assim não sairia. A duplicidade é o que faz um campo interno futuro — número do chip, contato do proprietário — não vazar por padrão nem por esquecimento nem por engano.
- **RN-56:** A montagem da resposta pública vive em **arquivo próprio**, separado da montagem administrativa. Compartilhar um único montador entre a área administrativa e a vitrine faria de cada campo acrescentado ao lado administrativo um vazamento em potencial.
- **RN-57:** O conjunto de chaves da resposta pública é **fechado e verificado por igualdade**, e não por continência: o critério de aceite compara o conjunto exato de chaves de cada item, de modo que acrescentar um campo à entidade quebre o teste em vez de passar despercebido.
- **RN-58:** A projeção pública devolve **apenas o endereço da imagem de capa**, e não a lista de imagens. O cartão exibe uma imagem; devolver cinco endereços por cartão multiplicaria a resposta sem uso. A galeria completa pertence à página de detalhe, escopo diferido.
- **RN-59:** Não integram a projeção pública, por decisão explícita: o **status** (RN-13), a **data de nascimento** (o público consome a idade derivada, e devolver a data permitiria recalcular a idade no fuso do navegador, contradizendo a RN-37), as **datas de criação e alteração** (a de alteração é o token de bloqueio otimista da RN-47 da FEATURE-002 deste módulo e não tem por que chegar a leitor anônimo), o **identificador da cidade** dentro do animal (o filtro obtém os identificadores da própria lista de cidades) e a **lista completa de imagens** (RN-58).

**Apresentação, imagens e conteúdo do administrador**

- **RN-60:** A descrição, o nome do animal, o nome da espécie e o nome da cidade são conteúdo escrito pelo administrador e renderizado ao público. Todos são apresentados **como texto**, jamais interpretados como marcação. Não há, em nenhum ponto desta tela, inserção de conteúdo como HTML.
- **RN-61:** A descrição é **truncada visualmente** no cartão, por apresentação, sem que o texto seja removido do documento. O conteúdo completo permanece disponível à tecnologia assistiva. Truncar no servidor descartaria informação de forma irreversível para uma limitação puramente visual.
- **RN-62:** **Animal sem imagem é válido** e o cartão exibe um marcador substituto neutro, mantendo a mesma altura dos demais cartões. Regra herdada da RN-30 da FEATURE-002 deste módulo.
- **RN-63:** Uma imagem cujo endereço existe mas cujo carregamento falha recai no **mesmo marcador substituto**, nunca no ícone de imagem quebrada do navegador. A vitrine é a face pública do produto e uma imagem quebrada nela é mais custosa do que a ausência de imagem.
- **RN-64:** A **localização vem sempre do dado persistido** — nome da cidade e sigla do estado —, apresentada como "Cidade - UF". Nenhuma consulta a serviço externo ocorre em tempo de renderização. Regra herdada das RN-27 e RN-28 da FEATURE-002 deste módulo.
- **RN-65:** Os rótulos exibidos ao visitante para porte, sexo e espécie são os acentuados em PT-BR — "Médio", "Fêmea" —, enquanto o contrato trafega os valores em minúsculas sem acento. Convenção já congelada pela FEATURE-002 deste módulo.

**Contenção de uso**

- **RN-66:** Os endpoints públicos desta feature recebem **limitação de taxa por origem**. O argumento que dispensou o limitador nas duas features anteriores deste módulo — operação administrativa autenticada, de baixo volume — **não se transfere**: estes são os primeiros endpoints de leitura anônimos e expostos do produto, e a busca por conteúdo em qualquer posição é a consulta mais cara do catálogo. O limite é generoso o bastante para não atrapalhar navegação humana, inclusive com vários visitantes atrás de uma mesma saída de rede. O mecanismo já existe no projeto, usado hoje nos endpoints de credencial; esta feature o aplica, não o cria.
- **RN-67:** A recusa por excesso de requisições chega como mensagem de negócio em PT-BR, no envelope de erro já vigente, e a tela a apresenta com possibilidade de nova tentativa — nunca como tela em branco.

---

### Requisitos Funcionais

#### O que o sistema exibe ao ser acessado

**Tela da vitrine (`/animais`)** — pública, alcançável sem sessão.

1. **Cabeçalho claro**, de largura inteira, sem itens de navegação:
   - À esquerda, o logotipo **CatDog**, que aponta para a própria vitrine.
   - À direita, conforme a sessão:
     - **Sem sessão:** as ações "Entrar" e "Criar conta", apontando para as telas de login e de cadastro.
     - **Com sessão:** o **nome** do usuário e o controle "Sair", com ícone decorativo à esquerda do texto.
     - **Durante a restauração da sessão:** nenhuma das duas alternativas é apresentada, para que o cabeçalho não pisque nem exiba identificação de ninguém antes de saber que há sessão. A grade, ainda assim, já é carregada.
2. **Título da página:** "Animais para adoção".
3. **Barra de filtros**, em painel claro de largura inteira, com sete controles nesta ordem:

| Posição | Rótulo visível | Tipo | Texto de apoio dentro do campo | Estado inicial |
|---|---|---|---|---|
| 1 | Buscar | Campo de texto | "Busque por nome ou cidade" | Vazio |
| 2 | Espécie | Seleção | — | "Todas as espécies" |
| 3 | Porte | Seleção | — | "Todos os portes" |
| 4 | Sexo | Seleção | — | "Todos os sexos" |
| 5 | Idade máxima | Campo numérico | "Idade máxima" | Vazio |
| 6 | Cidade | Seleção | — | "Todas as cidades" |
| 7 | — | Botão "Limpar filtros" | — | Visível e desabilitado |

   Abaixo do campo de idade máxima, em texto de apoio permanente: "Animais sem data de nascimento não aparecem quando este filtro é usado." (RN-43)

4. **Resumo de resultados**, exibido **apenas quando há ao menos um filtro aplicado**: "N animais encontrados", com concordância correta no singular. Sem filtro aplicado, nenhum resumo é exibido — como na captura.
5. **Grade de cartões**, com uma coluna em tela estreita, duas em tela média, três em tela larga e quatro em tela muito larga. Cada cartão apresenta, de cima para baixo:
   - **Imagem de capa**, ocupando a largura do cartão. Sem imagem, ou com imagem que não carrega, um marcador substituto neutro de mesma altura.
   - **Nome do animal**, em destaque, à esquerda; **etiqueta da espécie**, alinhada à direita, na mesma altura.
   - **Localização**, precedida de um ícone de marcador de mapa decorativo, no formato "Cidade - UF".
   - **Três etiquetas de característica**, em sequência: sexo, porte e idade.
   - **Descrição**, truncada visualmente. Ausente a descrição, a área não aparece.
   - **Nenhum botão de ação** (RN-08, HU-13).
6. **Controles de navegação entre páginas**, abaixo da grade, **somente quando o total excede o tamanho da página**.
7. **Estado de carregamento:** indicador no lugar da grade; a barra de filtros permanece visível e utilizável.
8. **Estado de catálogo vazio:** "Nenhum animal disponível para adoção no momento. Volte em breve!", sem ação de limpar filtros.
9. **Estado de nenhum resultado com filtros:** "Nenhum animal encontrado com os filtros aplicados.", com a ação "Limpar filtros".
10. **Estado de falha de carregamento:** "Não foi possível carregar os animais. Tente novamente.", com ação de nova tentativa.

#### Ações disponíveis

**Ação 1 — Buscar por nome ou cidade**

O visitante digita no campo de busca.
- Se o texto, após normalização, não for vazio → a consulta é enviada com atraso após a digitação, a página volta para 1 e a grade passa a exibir apenas animais cujo nome **ou** cidade contenham o texto (RN-22 a RN-26).
- Se o texto sobrar vazio → o filtro deixa de ser aplicado e o parâmetro sai do endereço da página.
- Se respostas chegarem fora de ordem → prevalece a da última consulta disparada (RN-53).
- Se nada for encontrado → estado de nenhum resultado com filtros.

**Ação 2 — Escolher espécie, porte, sexo ou cidade**

O visitante escolhe uma opção em um dos quatro campos de seleção.
- Escolha diferente de "todos" → a consulta é enviada imediatamente, a página volta para 1 e o critério passa a restringir por igualdade.
- Escolha de volta para "todos" → o critério deixa de restringir e o parâmetro sai do endereço.
- Opções de espécie e de cidade → apenas as que possuem ao menos um animal disponível (RN-30, RN-31).
- Valor vindo do endereço que não está entre as opções → permanece aplicado e é apresentado como opção adicional (RN-33).
- Falha ao obter as opções de um campo → o campo informa a falha em vez de aparecer vazio, e a grade continua sendo carregada (HU-11, cenário 7).

**Ação 3 — Informar idade máxima**

O visitante digita um número inteiro no campo de idade máxima.
- Inteiro entre 0 e 30 → a consulta é enviada com atraso após a digitação, a página volta para 1, e passam a aparecer apenas animais com idade derivada menor ou igual ao valor. **Animais sem data de nascimento deixam de aparecer** (RN-42).
- Campo esvaziado → o filtro deixa de ser aplicado e os animais sem data de nascimento voltam a aparecer.
- Valor fora da faixa, negativo ou não numérico digitado na tela → não é enviado; o campo sinaliza o problema e a grade mantém o último resultado válido.
- Valor fora da faixa vindo do endereço da página → descartado, endereço corrigido, vitrine exibida normalmente (RN-49).

**Ação 4 — Limpar filtros**

O visitante aciona "Limpar filtros".
- Se houver ao menos um filtro aplicado → busca e os cinco filtros voltam ao estado inicial, a página volta para 1, o endereço volta a não conter parâmetro nenhum e a grade exibe a lista completa.
- Se nenhum filtro estiver aplicado → o botão está desabilitado e a ação não é acionável.

**Ação 5 — Navegar entre páginas**

O visitante aciona um controle de página.
- Página válida → a grade passa a exibir aquela página, o endereço a registra e a apresentação volta ao topo da grade.
- Primeira página → a ação de página anterior fica desabilitada; última página → a de página seguinte fica desabilitada.
- Página além da última → grade vazia com a mensagem de nenhum resultado, sem erro (RN-20).

**Ação 6 — Entrar, criar conta ou sair pelo cabeçalho**

- Sem sessão → "Entrar" leva à tela de login e "Criar conta" à de cadastro.
- Com sessão → "Sair" encerra a sessão e **mantém o visitante na vitrine**, com o cabeçalho voltando ao estado sem sessão e a grade permanecendo carregada (RN-07).

---

#### Validações e Restrições

| Parâmetro | Regra na API | Regra na tela |
|---|---|---|
| Busca | Texto; até 120 caracteres após normalização; acima disso, recusada por validação | Normaliza espaços; vazia após normalização equivale a não aplicada |
| Espécie | Identificador no formato UUID; malformado é recusado por validação; inexistente devolve lista vazia | Valor não reconhecido vindo do endereço é descartado |
| Porte | Um entre `pequeno`, `medio`, `grande`; qualquer outro é recusado | Idem |
| Sexo | Um entre `macho`, `femea`; qualquer outro é recusado | Idem |
| Idade máxima | Inteiro de 0 a 30; negativo, fracionário, não numérico ou acima de 30 é recusado | Idem; campo aceita apenas dígitos |
| Cidade | Identificador no formato UUID; malformado é recusado; inexistente devolve lista vazia | Idem |
| Página | Inteiro maior ou igual a 1; padrão 1; fora da faixa é recusado | Idem |
| Tamanho da página | Inteiro de 1 a 100; padrão 12; fora da faixa é recusado | A tela não o expõe ao visitante |
| Status | **Não é parâmetro.** Enviá-lo é recusado como campo não permitido (RN-10) | A tela nunca o envia |
| Qualquer outro parâmetro | Recusado como campo não permitido | Ignorado e removido do endereço |

Restrições adicionais:
- Toda validação acima é executada **no servidor**; as checagens equivalentes na tela existem para retorno imediato e para tolerar links estragados, e não são garantia (RN-49, RN-50).
- Esta feature é somente leitura: nenhuma das suas rotas aceita escrita (RN-08).
- Nenhuma rota desta feature monta autenticação ou verificação de permissão (RN-01).

---

#### Mensagens ao Usuário

| Condição | Mensagem |
|---|---|
| Título da página | "Animais para adoção" |
| Texto de apoio da busca | "Busque por nome ou cidade" |
| Opção neutra de espécie | "Todas as espécies" |
| Opção neutra de porte | "Todos os portes" |
| Opção neutra de sexo | "Todos os sexos" |
| Opção neutra de cidade | "Todas as cidades" |
| Texto de apoio da idade máxima | "Idade máxima" |
| Aviso permanente do filtro de idade | "Animais sem data de nascimento não aparecem quando este filtro é usado." |
| Ação de limpar | "Limpar filtros" |
| Resumo de resultados, singular | "1 animal encontrado" |
| Resumo de resultados, plural | "N animais encontrados" |
| Catálogo sem nenhum animal disponível | "Nenhum animal disponível para adoção no momento. Volte em breve!" |
| Nenhum resultado com filtros aplicados | "Nenhum animal encontrado com os filtros aplicados." |
| Falha ao carregar a grade | "Não foi possível carregar os animais. Tente novamente." _(texto já definido pela FEATURE-002 deste módulo)_ |
| Falha ao carregar as opções de um filtro | "Não foi possível carregar as opções. Tente novamente." |
| Idade sem data de nascimento | "Idade não informada" _(texto já definido pela FEATURE-002 deste módulo)_ |
| Idade abaixo de um mês | "Menos de 1 mês" |
| Idade em meses | "1 mês" / "N meses" |
| Idade em anos | "1 ano" / "N anos" |
| Texto alternativo da foto | "Foto de {nome}" |
| Cabeçalho sem sessão | "Entrar" e "Criar conta" |
| Cabeçalho com sessão | "Sair" |
| Excesso de requisições | _Texto já produzido pelo limitador em vigor, devolvido pelo backend_ |
| Falha inesperada | "Ocorreu um erro inesperado. Tente novamente." _(texto já existente)_ |

Conforme a convenção em vigor no frontend, **mensagem devolvida pelo backend não é duplicada no catálogo de textos da interface**. Nesta feature, praticamente todos os textos acima são de interface pura — a vitrine quase não exibe texto vindo da API, porque os seus únicos erros esperados são falha de rede e excesso de requisições.

---

#### Integrações

Esta feature **não introduz nenhuma dependência externa nova em tempo de execução**.

| Sistema externo | O que é enviado | O que é recebido | Em caso de falha |
|---|---|---|---|
| Armazenamento de objetos do Supabase | Nada. O navegador solicita diretamente o endereço público da imagem de capa | O arquivo da imagem | O cartão recai no marcador substituto neutro (RN-63). A grade, os filtros e todos os demais dados continuam funcionando |

**O que esta feature deliberadamente não integra:**
- Nenhum serviço de terceiros no caminho de leitura. Estados, cidades, espécies, portes e sexos vêm do banco (RN-32).
- Nenhum serviço de análise, de recomendação ou de mapas. O ícone de localização é decorativo e não abre mapa nenhum.
- Nenhuma rede de distribuição de conteúdo nem cache intermediário sobre a resposta da vitrine (RN-12).

---

### Contrato de API

Três endpoints novos, **todos públicos e todos somente leitura**, sob o prefixo `/api/catalog`. Erros seguem o envelope já congelado:

```
{ "error": { "code": "STRING_ESTAVEL", "message": "texto em PT-BR", "details": [ { "field": "nome.do.campo", "message": "texto" } ] } }
```

**Convenções herdadas e mantidas:** rotas de API em inglês (`/api/catalog/...`), rota de interface em PT-BR (`/animais`); envelope de coleção `{ items, pagination }`; valores de conjunto fechado em minúsculas sem acento; o frontend ramifica por `code`, nunca pelo texto de `message`.

**Por que um prefixo próprio, e não a reutilização de `GET /api/animals`.** O endpoint administrativo existente exige sessão e role `admin` e devolve a representação completa do animal. Fazer a mesma rota responder de duas formas conforme a presença de sessão colocaria a projeção pública e a administrativa a um `if` de distância uma da outra: qualquer defeito na verificação de permissão passaria a expor a representação completa a qualquer visitante. Rotas separadas, montadores separados e consultas separadas (RN-55, RN-56) tornam esse acidente impossível de acontecer por engano. O custo é uma rota a mais; o benefício é que o vazamento deixa de depender de um acerto de fluxo de controle.

**Nenhum código de erro novo é criado por esta feature.** Ela produz apenas `VALIDATION_ERROR`, já existente, e o código de excesso de requisições já produzido pelo limitador em vigor. Nenhuma colisão é possível com os 13 códigos de autenticação nem com os acrescentados pelas FEATURE-001 e FEATURE-002 deste módulo.

---

#### Projeção pública do animal — conjunto fechado de campos

Este é o contrato central desta feature. As chaves abaixo são **exatamente** as devolvidas por item, em qualquer resposta da vitrine.

```json
{
  "id": "c7066355-5591-4a6f-a3f8-2a9ee727b2d0",
  "name": "Theo",
  "species": { "id": "6f6d2b4e-6f7e-4d3f-9c1a-1f2b3c4d5e6f", "name": "Cachorro" },
  "size": "grande",
  "sex": "macho",
  "ageInYears": 3,
  "ageInMonths": 45,
  "description": "Dócil, brincalhão e acostumado com crianças.",
  "acceptsOtherAnimals": true,
  "needsLargeSpace": false,
  "city": { "name": "Campo Magro", "stateUf": "PR" },
  "coverImageUrl": "https://…/animals/c7066355…/1a2b3c.jpg"
}
```

| Chave | Tipo | Nulo? | Observação |
|---|---|---|---|
| `id` | texto (UUID) | Não | Único identificador exposto. É o gancho para o módulo de Pedidos e para a página de detalhe diferida |
| `name` | texto | Não | Como o administrador gravou |
| `species` | objeto | Não | Exatamente `{ id, name }`. O `id` alimenta o filtro de espécie |
| `size` | texto | Não | `pequeno` \| `medio` \| `grande` |
| `sex` | texto | Não | `macho` \| `femea` |
| `ageInYears` | inteiro | **Sim** | Anos completos. `null` quando não há data de nascimento (RN-39) |
| `ageInMonths` | inteiro | **Sim** | Meses completos. `null` quando não há data de nascimento. Existe para a apresentação abaixo de um ano (RN-38) |
| `description` | texto | **Sim** | Texto integral, sem truncagem no servidor (RN-61) |
| `acceptsOtherAnimals` | booleano | Não | |
| `needsLargeSpace` | booleano | Não | |
| `city` | objeto | Não | Exatamente `{ name, stateUf }`. **Sem identificador** (RN-59) |
| `coverImageUrl` | texto | **Sim** | Endereço da imagem de posição 0. `null` quando o animal não tem imagem (RN-58, RN-62) |

**Ausentes por decisão explícita** (RN-59), e cuja presença em qualquer resposta é defeito:

| Campo ausente | Motivo |
|---|---|
| `status` | Todo item é `disponivel` por construção; devolvê-lo convidaria a exibi-lo numa tela que nunca deve mostrar os outros três valores |
| `birthDate` | O público consome a idade derivada. Devolver a data permitiria recalculá-la no fuso do navegador, contradizendo a RN-37 |
| `createdAt` | Critério interno de ordenação, sem valor para o visitante |
| `updatedAt` | É o token de bloqueio otimista da RN-47 da FEATURE-002 deste módulo. Não tem por que chegar a leitor anônimo |
| `city.id` | O filtro de cidade obtém os identificadores de `GET /api/catalog/cities` |
| `speciesId`, `cityId` no nível raiz | Substituídos pelos objetos aninhados |
| `images` (lista completa) | O cartão exibe uma imagem. A galeria pertence à página de detalhe, diferida (RN-58) |
| Qualquer campo interno futuro — número do chip, contato do proprietário | Não é lido pela consulta nem enumerado pelo montador (RN-55) |

---

#### `GET /api/catalog/animals` — listar os animais disponíveis

| Item | Valor |
|---|---|
| Autorização | **Nenhuma.** Rota pública; não monta autenticação nem verificação de permissão (RN-01) |
| Contenção | Limitação de taxa por origem (RN-66) |
| Sucesso | `200 OK` |

Parâmetros de consulta, todos opcionais:

| Parâmetro | Tipo | Padrão | Faixa / conjunto | Efeito |
|---|---|---|---|---|
| `search` | texto | — | até 120 caracteres | Casa em `name` **ou** no nome da cidade, sem acento e sem caixa, em qualquer posição (RN-22 a RN-27) |
| `speciesId` | UUID | — | — | Igualdade exata |
| `size` | texto | — | `pequeno` \| `medio` \| `grande` | Igualdade exata |
| `sex` | texto | — | `macho` \| `femea` | Igualdade exata |
| `maxAgeYears` | inteiro | — | 0 a 30 | Idade derivada menor ou igual. **Exclui animais sem data de nascimento** (RN-42) |
| `cityId` | UUID | — | — | Igualdade exata |
| `page` | inteiro | 1 | ≥ 1 | Página |
| `pageSize` | inteiro | **12** | 1 a 100 | Tamanho da página (RN-17) |

Corpo de sucesso:

```json
{
  "items": [ { "id": "…", "name": "Theo", "…": "…" } ],
  "pagination": { "page": 1, "pageSize": 12, "total": 1 }
}
```

- Apenas animais com status `DISPONIVEL`, filtrados na própria consulta (RN-09, RN-11).
- Ordenados por data de cadastro decrescente, desempatados pelo identificador crescente (RN-14, RN-15).
- Lista vazia responde `200` com `items: []` e `total: 0` — nunca `404`.
- `total` é o total **após** todos os filtros, e não o total do catálogo.
- A resposta não é armazenável por intermediários (RN-12).

| Falha | Status | `code` | Observação |
|---|---|---|---|
| Parâmetro fora da faixa ou do conjunto (`page`, `pageSize`, `maxAgeYears`, `size`, `sex`, `search` acima de 120) | 400 | `VALIDATION_ERROR` | `details` aponta o parâmetro |
| `speciesId` ou `cityId` fora do formato UUID | 400 | `VALIDATION_ERROR` | `details: [{ field: "speciesId", message: "Identificador inválido." }]` |
| Parâmetro não previsto, **incluindo `status`** | 400 | `VALIDATION_ERROR` | `details: [{ field: "<chave>", message: "Campo não permitido nesta requisição." }]` (RN-10) |
| Excesso de requisições da mesma origem | 429 | _código já produzido pelo limitador em vigor_ | Mensagem de negócio em PT-BR (RN-67) |

**Não existe resposta `401` nem `403` neste endpoint** (RN-02). Um `speciesId` ou `cityId` bem formado mas inexistente responde `200` com lista vazia, e **não** `404` (RN-51).

---

#### `GET /api/catalog/species` — opções do filtro de espécie

| Item | Valor |
|---|---|
| Autorização | Nenhuma. Rota pública |
| Parâmetros | Nenhum |
| Sucesso | `200 OK` |

```json
{ "items": [ { "id": "6f6d2b4e-…", "name": "Cachorro" }, { "id": "…", "name": "Gato" } ] }
```

Apenas espécies com **ao menos um animal disponível**, em ordem alfabética crescente ignorando maiúsculas e minúsculas (RN-31). Catálogo sem animais disponíveis responde `200` com `items: []`.

Este endpoint **não substitui** e **não altera** `GET /api/species`, da FEATURE-001 deste módulo, que continua exigindo role `admin` e continua devolvendo todas as espécies. São recursos diferentes com públicos diferentes.

| Falha | Status | `code` |
|---|---|---|
| Excesso de requisições da mesma origem | 429 | _código do limitador em vigor_ |

---

#### `GET /api/catalog/cities` — opções do filtro de cidade

| Item | Valor |
|---|---|
| Autorização | Nenhuma. Rota pública |
| Parâmetros | Nenhum |
| Sucesso | `200 OK` |

```json
{ "items": [ { "id": "…", "name": "Campo Magro", "stateUf": "PR" } ] }
```

Apenas cidades com **ao menos um animal disponível** (RN-30), ordenadas pela sigla do estado e, dentro dela, pelo nome da cidade. A tela as apresenta como "Cidade - UF".

Este endpoint **não substitui** e **não altera** `GET /api/states` nem `GET /api/states/:uf/cities`, da FEATURE-002 deste módulo, que continuam exigindo role `admin` e continuam devolvendo o cadastro de apoio inteiro para alimentar o formulário administrativo.

| Falha | Status | `code` |
|---|---|---|
| Excesso de requisições da mesma origem | 429 | _código do limitador em vigor_ |

---

#### Endpoints existentes que esta feature NÃO altera

`GET /api/animals`, `GET /api/animals/:id`, `POST /api/animals`, `PATCH /api/animals/:id`, `PATCH /api/animals/:id/status`, `DELETE /api/animals/:id`, `GET /api/species`, `POST /api/species`, `PATCH /api/species/:id`, `DELETE /api/species/:id`, `GET /api/states`, `GET /api/states/:uf/cities` e todos os endpoints de autenticação permanecem **exatamente** como estão: mesmo caminho, mesma autorização, mesmo contrato, mesmas mensagens.

---

### Decisões de Arquitetura

Seis pontos precisavam ser fechados para que esta spec fosse implementável. Cada um está registrado abaixo com as alternativas descartadas, e replicado no changelog.

---

#### Decisão A — A vitrine é pública, e isso muda a árvore de rotas do frontend

Decidido em favor do escopo do produto, contra a leitura literal da captura. As consequências não são cosméticas.

A árvore de rotas em vigor tem **toda** rota com conteúdo dentro de `ProtectedRoute`, e as áreas por perfil ainda dentro de `RoleRoute`. A área do cliente vive em `/minha-area`, sob `ProtectedRoute` + `RoleRoute allow={['cliente']}`, com um catch-all próprio dentro da guarda. **Uma rota pública não pode ficar sob nenhuma dessas guardas**, e por três motivos distintos:

| Guarda | Por que não serve |
|---|---|
| `ProtectedRoute` | Manda ao login quem não tem sessão — exatamente o visitante que esta feature existe para atender |
| `RoleRoute allow={['cliente']}` | Além de exigir sessão, expulsaria o `admin`, que também deve poder ver a vitrine |
| `PublicOnlyRoute` | Expulsaria quem **tem** sessão, invertendo o defeito. Ela existe para login e cadastro, não para conteúdo público |

**Escolhido:** a vitrine é montada **fora de todas as guardas**, ao lado das rotas já públicas de verificação e confirmação de e-mail, com um **layout próprio** — o cabeçalho público —, e antes do catch-all global.

| Alternativa | Por que foi descartada |
|---|---|
| Montar a vitrine sob `/minha-area` | Ficaria atrás de `ProtectedRoute` + `RoleRoute`, tornando o catálogo inacessível a quem não tem conta |
| Reaproveitar o `ClientLayout` | Ele é o layout de uma área autenticada, com item de navegação "Minha área" e botão de sair sempre presente. Reaproveitá-lo obrigaria a condicionar metade do seu conteúdo à existência de sessão, e ele é arquivo já coberto por testes que verificam justamente a ausência de controles indevidos |
| Criar uma guarda "pública" nova | Uma guarda que não guarda nada é ruído. Rota pública é a **ausência** de guarda |
| Mover a vitrine para a raiz `/` | Alteraria o redirecionamento da raiz, que hoje decide o destino por role dentro do `ProtectedRoute` e é ponto sensível de regressão já sinalizado. Fica registrado como recomendação de acompanhamento, **fora do escopo desta feature** |

**Consequências declaradas:** um caminho novo em `ROUTE_PATHS`; um bloco de rota novo em `app-routes.tsx`, fora das guardas; um layout novo; e um item de navegação acrescentado ao `ClientLayout`, sem o qual o cliente autenticado não teria como chegar à vitrine pela aplicação. Todos estão detalhados em "Impacto Técnico Transversal" e cobertos por itens de regressão.

---

#### Decisão B — Busca insensível a acentos por coluna persistida, não por extensão do banco

A busca precisa ignorar acentos. O construtor de consultas em uso oferece insensibilidade a **caixa**, mas não a **acentos**.

| Alternativa | Por que foi descartada |
|---|---|
| Extensão de remoção de acentos do banco, aplicada na consulta | Exigiria consulta em SQL cru fora do construtor em uso, quebrando o padrão de repositório do projeto; exigiria habilitar uma extensão no banco gerenciado; e tornaria o resultado dependente da configuração do servidor, o que os testes não conseguem fixar |
| Comparar em memória, após buscar tudo | Quebraria a paginação e o total de registros, que passariam a ser calculados sobre um conjunto já truncado. É o defeito que a RN-11 e a RN-44 proíbem explicitamente |
| Aceitar busca sensível a acentos | "Jose" não encontraria "José" e "sao paulo" não encontraria "São Paulo" — em PT-BR isso não é um detalhe, é a maioria dos casos reais |

**Escolhido:** colunas de busca **persistidas**, contendo o nome já reduzido a minúsculas e sem marcas diacríticas, uma em `animals` e uma em `cities`, mantidas pela aplicação a cada escrita e preenchidas por migração para os registros existentes. É exatamente o precedente que a FEATURE-001 deste módulo estabeleceu ao persistir a coluna normalizada em vez de depender de índice sobre expressão ou de collation.

**Limitação conhecida e aceita:** a busca por conteúdo em qualquer posição não se beneficia de índice comum. No volume declarado pela FEATURE-002 deste módulo — dezenas a poucas centenas de animais —, a varredura é irrelevante. **Gatilho de revisão registrado:** ultrapassados alguns milhares de animais disponíveis, a decisão volta à mesa e a alternativa natural é um índice de trigramas. Registrar o gatilho agora é o que impede a decisão de virar defeito de desempenho surpresa.

---

#### Decisão C — Paginação de servidor mantida, rolagem infinita recusada

A captura não exibe controle de paginação, mas ela tem um único animal — e a RN-19 explica por que isso é conforme. O que precisava ser decidido é o **mecanismo**.

| Alternativa | Por que foi descartada |
|---|---|
| Rolagem infinita | Incompatível com a RN-46: não há posição de rolagem compartilhável por link, e a feature inteira aposta em endereço compartilhável. Exigiria observação de interseção e acumulação de estado que a base de dependências do frontend não possui. Tornaria a última página inalcançável por teclado e por leitor de tela. E impediria voltar a um resultado já visto sem recarregar tudo |
| Trazer tudo de uma vez | Contraria o envelope paginado já congelado e cresce sem teto junto com o catálogo |
| Botão "Carregar mais" | Meio-termo que herda o pior dos dois: continua sem endereço compartilhável por posição e ainda exige controle manual |

**Escolhido:** paginação de servidor, mesmo envelope, mesmo máximo de 100, com padrão de **12** pela geometria da grade (RN-17). Controles apresentados apenas quando necessários (RN-19).

---

#### Decisão D — Opções de filtro derivadas do catálogo disponível

Os filtros de espécie e de cidade poderiam oferecer o cadastro inteiro.

| Alternativa | Por que foi descartada |
|---|---|
| Oferecer todas as cidades do cadastro de apoio | São cerca de 5.600 municípios. Uma lista impraticável em que quase toda escolha levaria a zero resultados — um filtro que existe para não funcionar |
| Oferecer todas as espécies cadastradas | Mesmo problema em escala menor: escolher uma espécie sem nenhum animal disponível produz uma tela vazia sem explicar por quê |
| Reaproveitar os endpoints administrativos | Eles exigem role `admin` e a vitrine é anônima; e devolvem o cadastro inteiro, que é o problema acima |

**Escolhido:** dois endpoints públicos próprios que devolvem apenas espécies e cidades **com ao menos um animal disponível**, derivadas do estado corrente do catálogo a cada consulta (RN-30, RN-31), com a salvaguarda da RN-33 para valores que chegam pelo endereço e saíram da lista.

---

#### Decisão E — Cadeia de parâmetros montada no serviço de API da vitrine, sem tocar no cliente HTTP

O cliente HTTP compartilhado do frontend não possui construtor de cadeia de parâmetros.

| Alternativa | Por que foi descartada |
|---|---|
| Estender o cliente HTTP para aceitar parâmetros de consulta | Ele é arquivo transversal que abriga a fila de renovação de sessão, já apontado como o ponto de maior risco de regressão do frontend. Alterá-lo para a conveniência de um único consumidor é desproporcional. A FEATURE-002 deste módulo o alterou porque envio de arquivo **não tem** alternativa; cadeia de parâmetros tem |
| Concatenar texto à mão | Erra na codificação de acentos e de espaços — e a busca desta feature é justamente por texto com acento |

**Escolhido:** a cadeia de parâmetros é montada no serviço de API da vitrine, com o utilitário padrão do navegador, omitindo parâmetros vazios, e o caminho já pronto é entregue ao cliente HTTP. **Esta feature não altera nenhuma linha do cliente HTTP.** Se um segundo domínio precisar do mesmo, a promoção para o cliente compartilhado é feita então, com um segundo caso de uso real justificando o risco.

---

#### Decisão F — Limitação de taxa aplicada, contrariando o precedente das duas features anteriores

As FEATURE-001 e FEATURE-002 deste módulo dispensaram o limitador de taxa, e ambas registraram o mesmo motivo: operação administrativa, autenticada, de baixo volume, sem envio de e-mail. **Esse motivo não se transfere para esta feature**, e repeti-lo por inércia seria o erro:

- estes são os primeiros endpoints **anônimos de leitura** do produto fora do fluxo de autenticação;
- a busca por conteúdo em qualquer posição é, por construção (Decisão B), a consulta mais cara do catálogo e não se beneficia de índice;
- não há credencial a exigir, portanto não há nada além do limitador contendo repetição automatizada.

**Escolhido:** aplicar o mecanismo de limitação **já existente no projeto** aos três endpoints públicos, com limite generoso o bastante para não atrapalhar navegação humana nem vários visitantes atrás de uma mesma saída de rede. Nenhum mecanismo novo é criado, nenhum código de erro novo é inventado, e a recusa chega como mensagem de negócio em PT-BR (RN-67).

---

### Modelo de Dados

Esta feature **não cria nenhuma tabela e não redefine a entidade Animal**. O modelo é o entregue pela FEATURE-002 deste módulo — `Animal`, `AnimalImage`, `Species`, `State`, `City` e as enumerações `AnimalSize`, `AnimalSex` e `AnimalStatus` — reaproveitado integralmente. As alterações abaixo são **aditivas** e estão registradas no changelog por tocarem modelos entregues por outra spec.

**Alteração 1 — coluna de busca sem acento em `Animal`** (Decisão B, RN-23):

```prisma
model Animal {
  // … todos os campos entregues pela FEATURE-002 deste modulo permanecem inalterados …

  /// Nome em minusculas e SEM marcas diacriticas, usado APENAS pela busca
  /// livre da vitrine (RN-23). NAO substitui `nameNormalized`, que continua
  /// servindo a ordenacao alfabetica da listagem administrativa (RN-41 da
  /// FEATURE-002 deste modulo) e que PRESERVA acentos de proposito.
  /// Persistida, e nao expressao em consulta, pelo mesmo motivo ja registrado
  /// na FEATURE-001 deste modulo: o construtor de consultas nao declara indice
  /// sobre expressao, e deixar a regra fora do schema a tornaria invisivel.
  /// NAO e exposta pela API, nem publica nem administrativa.
  nameSearch String @map("name_search") @db.VarChar(60)

  /// Cobre a ordenacao e o recorte da vitrine em um so indice: filtra por
  /// status, ordena por data de cadastro decrescente e desempata pelo id
  /// (RN-09, RN-14, RN-15). O indice `@@index([status])` ja existente
  /// permanece, servindo as consultas administrativas por status.
  @@index([status, createdAt, id])
}
```

**Alteração 2 — coluna de busca sem acento em `City`** (RN-22, RN-23):

```prisma
model City {
  // … todos os campos entregues pela FEATURE-002 deste modulo permanecem inalterados …

  /// Nome do municipio em minusculas e SEM marcas diacriticas. Existe porque a
  /// busca livre procura tambem pela cidade (RN-22) e "sao paulo" precisa
  /// encontrar "Sao Paulo" grafado com acento.
  /// Preenchida na carga inicial e NAO exposta pela API.
  nameSearch String @map("name_search") @db.VarChar(120)
}
```

**Regra de normalização das duas colunas.** O valor é obtido do nome já normalizado quanto a espaços, decomposto em forma canônica, tendo as marcas diacríticas removidas e sendo reduzido a minúsculas. "Cão Pastor" produz "cao pastor"; "São Paulo" produz "sao paulo". A mesma função normaliza **o texto da busca** antes da comparação, de modo que os dois lados da comparação passam pela mesma transformação — condição necessária para que o resultado seja determinístico e não dependa da configuração do banco.

**Manutenção:** a coluna de `Animal` é recalculada em toda gravação de animal, junto de `nameNormalized`, e a de `City` é preenchida pela carga inicial já existente. Nenhuma das duas é editável pelo administrador e nenhuma das duas é exposta por qualquer endpoint.

**Migração:** acrescenta as duas colunas e o índice composto, e **preenche as colunas para os registros existentes**. Nenhuma coluna existente é alterada ou removida, nenhuma tabela é criada e nenhum comportamento entregue pelas features anteriores muda. A migração é reexecutável.

**Consulta da vitrine — obrigações que o modelo impõe:**

1. A seleção de colunas é **explícita** e lista apenas o necessário para a projeção pública (RN-55). Colunas internas futuras não são sequer lidas.
2. O recorte por `status = DISPONIVEL`, a busca, todos os filtros e o filtro de idade fazem parte da **mesma consulta**, junto da contagem total (RN-11, RN-44).
3. A imagem de capa é obtida pela imagem de `position` 0 do animal; ausente, o campo é nulo (RN-58, RN-62).
4. O filtro de idade máxima é expresso como comparação sobre a data de nascimento, derivada do instante corrente obtido pelo utilitário de relógio do projeto no fuso `America/Sao_Paulo` — nunca instanciando a data diretamente, para que os testes possam fixar o relógio (RN-37, RN-40, RN-45).

---

### Impacto Técnico Transversal

**Backend**

| Ponto | Situação atual | O que esta feature exige |
|---|---|---|
| Domínio novo | Não existe domínio de catálogo público | Criar `src/domains/catalog/` no padrão em vigor: rotas, controlador por fábrica, um serviço por caso de uso, repositório por porta, montador próprio e validadores. Mais uma linha montando o domínio no índice de rotas |
| Rota sem autenticação | O verificador de permissão e a autenticação são montados por rota | As rotas do catálogo **simplesmente não os montam**. Não há mecanismo novo — há a ausência deliberada de dois, e um caso de teste que prova que nenhuma resposta `401` ou `403` sai daqui |
| Montador público | Existe apenas o montador administrativo do animal | Criar montador **próprio e separado** (RN-56), com entrada tipada estritamente pelo recorte de colunas da consulta |
| Limitação de taxa | Mecanismo existe, aplicado a endpoints de credencial | Aplicá-lo aos três endpoints públicos, com limite próprio (Decisão F). Nenhum mecanismo novo |
| Catálogo de códigos de estado HTTP | Deliberadamente curto | Verificar se o código de excesso de requisições já consta; se não, acrescentá-lo, pela mesma regra de "um código por regra que a aplicação realmente produz" |
| Códigos de erro | 13 de autenticação + os das duas features anteriores deste módulo | **Nenhum código novo.** Apenas `VALIDATION_ERROR` e o do limitador |
| Relógio | O projeto exige o utilitário próprio em vez de instanciar a data | O cálculo da idade em anos e em meses e o filtro de idade máxima usam o utilitário, no fuso `America/Sao_Paulo`. **Importa especialmente aqui**, porque duas regras de fronteira dependem dele (RN-40, RN-45) |
| Escritas de animal | Gravam `nameNormalized` | Passam a gravar também `nameSearch` (Decisão B). É a **única** alteração desta feature em código entregue pela FEATURE-002 deste módulo, e tem item de regressão próprio |
| Dependências | — | **Nenhuma dependência nova.** A remoção de marcas diacríticas é obtida com a normalização de texto já disponível na plataforma |

**Frontend**

| Ponto | Situação atual | O que esta feature exige |
|---|---|---|
| Árvore de rotas | Toda rota com conteúdo está sob `ProtectedRoute` | Um bloco novo **fora de todas as guardas**, antes do catch-all global (Decisão A), e um caminho novo em `ROUTE_PATHS` |
| Layout | Existem `AuthLayout`, `AdminLayout` e `ClientLayout` | Um layout público novo: cabeçalho claro, logotipo, e à direita as ações de entrar/criar conta ou o nome e "Sair" (RN-06) |
| Acesso à vitrine por quem tem sessão | O `ClientLayout` só oferece "Minha área" | Acrescentar um item de navegação apontando para a vitrine. **Alteração em arquivo coberto por testes** — item de regressão próprio |
| Componentes de interface | Sete componentes, todos de formulário de autenticação | **Novos nesta feature:** cartão do animal, grade, etiqueta/selo, estado vazio, imagem com marcador substituto, esqueleto de carregamento, barra de filtros e cabeçalho público. **Reaproveitados da FEATURE-002 deste módulo:** campo de seleção, paginação, campo de texto. Se aquela feature não os entregar, eles entram no escopo desta e o esforço dobra |
| Serviço de API | Existe apenas o de autenticação | Criar `services/api/catalog-api.ts` no mesmo formato: uma função por endpoint, sem estado, sem tratamento de erro, sem desembrulhar a resposta de sucesso |
| Cliente HTTP | Sem construtor de cadeia de parâmetros, sem cancelamento, sem tempo limite | **Não é alterado** (Decisão E). A cadeia é montada no serviço de API; o descarte de respostas fora de ordem é feito por sequência na tela (RN-53), já que não há cancelamento |
| Validação | Funções puras devolvendo mapa de erros por campo | Mesmo padrão: uma função pura que recebe os parâmetros do endereço e devolve os filtros já saneados (RN-49). Nenhuma biblioteca de formulário ou de schema é adotada |
| Catálogo de textos | Mensagem do backend não é duplicada ali | Quase todos os textos desta tela são de interface pura e entram no catálogo. Os do backend — apenas o do limitador — não |
| Estilos | Tokens já declarados, sem plugins | Reaproveitar roxo, laranja, tons de tinta, superfícies, cantos arredondados e a fonte do produto. Nenhum plugin novo |
| Dependências | Exatamente três de execução | **Nenhuma dependência nova.** Cartão, grade, etiqueta, esqueleto e paginação são construídos com os recursos já presentes; adotar biblioteca de componentes, de estado de servidor ou de datas seria decisão de arquitetura que esta spec **não** toma |
| Testes | Specs ao lado do código, com dublagem do contexto de sessão e requisições reais bloqueadas | A vitrine é exercitada nos três estados de sessão — ausente, presente e em restauração — com o serviço de API dublado |

---

### Requisitos Não Funcionais

| ID | Tipo | Requisito | Critério mensurável |
|---|---|---|---|
| RNF-01 | Segurança | Nenhum dado interno sai pela projeção pública | O conjunto de chaves de cada item da resposta é **exatamente** o definido, verificado por igualdade e não por continência, inclusive nos objetos aninhados de espécie e de cidade |
| RNF-02 | Segurança | Campo novo na entidade não vaza | Acrescentado um campo à entidade Animal, a resposta pública permanece byte a byte a mesma |
| RNF-03 | Segurança | Conteúdo do administrador nunca é interpretado como marcação | Descrição, nome do animal, nome da espécie e nome da cidade contendo `<script>` e `<img src=x onerror=…>` aparecem literalmente como texto e nenhum script executa |
| RNF-04 | Segurança | Status é inexprimível na consulta pública | Requisição com o parâmetro `status`, em qualquer valor, é recusada por campo não permitido |
| RNF-05 | Segurança | Endpoints públicos contidos por limitação de taxa | Repetição acima do limite configurado responde `429` com mensagem em PT-BR; abaixo dele, a navegação humana nunca é interrompida |
| RNF-06 | Correção | Somente animais disponíveis são exibidos | Com um animal em cada um dos quatro status, a vitrine devolve exatamente um item e `total` igual a 1; cada um dos três status restantes é verificado ausente individualmente |
| RNF-07 | Correção | Idade sempre coerente com a data corrente | Com o relógio fixado em datas diferentes, a mesma data de nascimento produz idades diferentes, sem nenhuma escrita no banco |
| RNF-08 | Correção | Idade correta na virada do aniversário | Com o aniversário fixado em hoje, a idade já conta o ano; fixado em amanhã, ainda não. Verificado inclusive para nascimento em 29 de fevereiro |
| RNF-09 | Correção | Idade independente do fuso do processo | Com o processo em UTC e o relógio às 22h de São Paulo, a idade exibida é a de São Paulo, e não a do dia seguinte em UTC |
| RNF-10 | Correção | Filtro de idade e idade exibida nunca divergem | Para todo resultado devolvido com idade máxima N, a idade exibida em cada cartão é menor ou igual a N — verificado em datas de fronteira |
| RNF-11 | Integridade | Paginação determinística | Com 45 animais disponíveis criados no mesmo instante, percorrer todas as páginas devolve 45 identificadores distintos, sem repetição e sem omissão |
| RNF-12 | Integridade | Total coerente com os filtros | O total informado é sempre o total após todos os filtros, e não o do catálogo; verificado com filtro que reduz o conjunto |
| RNF-13 | Disponibilidade | A vitrine não depende de sessão | Com o armazenamento do navegador limpo, com sessão válida e com sessão expirada, a vitrine carrega e exibe a mesma lista; nenhuma renovação de sessão é disparada e nenhum redirecionamento ocorre |
| RNF-14 | Disponibilidade | A vitrine não depende do armazenamento de imagens | Com o armazenamento de objetos fora do ar, a grade, os filtros e todos os dados textuais continuam funcionando; os cartões exibem o marcador substituto |
| RNF-15 | Disponibilidade | Nenhuma dependência externa no caminho de leitura de dados | Com toda a rede externa bloqueada exceto a própria API, a vitrine, os filtros e a paginação continuam funcionando |
| RNF-16 | Atualidade | Resposta sem cache | Alterado o status de um animal, a consulta seguinte já reflete a mudança; a resposta não é armazenável por intermediários |
| RNF-17 | Desempenho | A grade é percebida como imediata | Com 500 animais disponíveis, a primeira página é exibida em menos de 2 segundos em conexão padrão |
| RNF-18 | Desempenho | Busca e filtros respondem rapidamente | Com 500 animais disponíveis, aplicar busca e os cinco filtros atualiza a grade em menos de 2 segundos |
| RNF-19 | Desempenho | Digitação não gera uma consulta por tecla | Digitar dez caracteres em sequência dispara uma única consulta |
| RNF-20 | Desempenho | Imagens fora da área visível não competem pelo carregamento | As imagens dos cartões abaixo da dobra são carregadas de forma adiada |
| RNF-21 | Acessibilidade | Todo controle de filtro possui rótulo visível e associado | Cada um dos seis controles da barra é alcançado por leitor de tela pelo seu rótulo; **nenhum** depende de texto de apoio como rótulo |
| RNF-22 | Acessibilidade | A grade tem estrutura semântica de lista | O conjunto de cartões é anunciado como lista com a sua contagem, e cada cartão é um item |
| RNF-23 | Acessibilidade | Cada cartão tem estrutura semântica própria | O nome do animal é um título de nível abaixo do título da página; ícones decorativos não são anunciados; a localização é legível como texto sem depender do ícone |
| RNF-24 | Acessibilidade | Imagens com texto alternativo significativo | Fotos de animais têm texto alternativo identificando o animal; o marcador substituto é decorativo e não gera anúncio redundante |
| RNF-25 | Acessibilidade | Tela inteiramente operável por teclado | Busca, os cinco filtros, limpar filtros, navegação entre páginas e as ações do cabeçalho são alcançáveis e acionáveis sem mouse, em ordem de foco coerente com a leitura |
| RNF-26 | Acessibilidade | Mudança de resultado é percebida sem depender de visão | A atualização da grade após busca ou filtro é anunciada, incluindo a quantidade de resultados e os estados de vazio |
| RNF-27 | Acessibilidade | Contraste conforme WCAG 2.1 AA | Texto a no mínimo 4.5:1 e indicadores de componente a no mínimo 3:1, incluindo as etiquetas de espécie e de característica e o texto sobre a área da imagem |
| RNF-28 | Acessibilidade | Nenhuma informação comunicada apenas por cor | Espécie, sexo, porte e idade são legíveis como texto nas etiquetas |
| RNF-29 | Responsividade | A vitrine funciona de telefone a monitor largo | A grade passa de uma a quatro colunas conforme a largura; em nenhuma largura a página exige rolagem horizontal nem corta conteúdo do cartão |
| RNF-30 | Usabilidade | Identidade visual CatDog | Roxo `#7c3aed`, laranja `#e05a1e` e a fonte do produto, com os tokens já declarados na configuração de estilos |
| RNF-31 | Consistência | Erros no envelope já vigente | 100% das respostas de erro saem como `{ error: { code, message, details? } }`, sem nenhum código novo e sem colidir com os existentes |
| RNF-32 | Idioma | Interface e mensagens em PT-BR | Nenhum texto exibido ao visitante em outro idioma, incluindo os parâmetros visíveis no endereço da página |
| RNF-33 | Compartilhabilidade | O estado da vitrine cabe em um link | Um endereço com busca, os cinco filtros e a página, aberto em navegador limpo e sem sessão, reproduz exatamente a mesma vitrine |

---

### O que Não Deve Ser Feito

**Fora de escopo por decisão desta spec:**

- Esta feature **não** implementa página de detalhe do animal. A captura mostra apenas a grade e nenhum cartão oferece caminho para uma tela individual. Ver "Escopo diferido" adiante — a lacuna é reconhecida, nomeada e ganchada, não esquecida.
- Esta feature **não** implementa demonstração de interesse, pedido, favoritos, contato ou qualquer ação sobre o animal. O cartão não tem botão, exatamente como a captura.
- Esta feature **não** altera nenhum status de animal, nem direta nem indiretamente. Ela é somente leitura (RN-08).
- Esta feature **não** implementa ordenação configurável pelo visitante (RN-16).
- Esta feature **não** implementa rolagem infinita nem "carregar mais" (RN-18, Decisão C).
- Esta feature **não** implementa filtro por raça, por características de convivência, por faixa de idade mínima nem por estado isolado da cidade. Os filtros são exatamente os seis da captura.
- Esta feature **não** exibe o status do animal ao público, em nenhum formato (RN-13).
- Esta feature **não** implementa a página inicial pública do produto nem altera o comportamento da raiz do endereço, que continua decidindo o destino por perfil. Registrado como recomendação de acompanhamento na Decisão A.
- Esta feature **não** implementa mapa, geolocalização, cálculo de distância nem ordenação por proximidade. O ícone de localização é decorativo.
- Esta feature **não** implementa compartilhamento em redes sociais, prévia de link, mapa do site nem qualquer otimização para mecanismos de busca. São candidatos legítimos para uma vitrine pública e ficam registrados como trabalho futuro.
- Esta feature **não** implementa cache, rede de distribuição de conteúdo nem redimensionamento de imagem. A imagem do cartão é a mesma imagem de capa do armazenamento, exibida menor (limitação já registrada pela FEATURE-002 deste módulo).
- Esta feature **não** adota nenhuma dependência nova, nem no backend nem no frontend.
- Esta feature **não** altera o cliente HTTP compartilhado do frontend (Decisão E).
- Esta feature **não** altera nenhum endpoint, contrato, mensagem ou tela entregues pelas FEATURE-001 e FEATURE-002 deste módulo, nem pela FEATURE-002 do MODULE-001. As únicas alterações em código de terceiros são as três declaradas em "Impacto Técnico Transversal": a gravação da coluna de busca, o item de navegação do layout do cliente e o bloco novo na árvore de rotas.

**Escopo diferido — reconhecido, nomeado e ganchado:**

| Elemento | Por que não entra agora | Gancho já entregue por esta feature | Condição para entrar |
|---|---|---|---|
| **Página de detalhe do animal** | A captura mostra apenas a grade, sem nenhum caminho para uma tela individual, e a fonte da verdade é ela. Reconhece-se, porém, que a descrição truncada no cartão **sugere que há mais a ver** — é por isso que a lacuna está aqui, e não omitida | A projeção pública já devolve o `id` do animal e a descrição **integral**, sem truncagem no servidor (RN-61). A truncagem é puramente visual, portanto nada foi perdido | Feature candidata do módulo, com spec própria. Ela acrescenta um endpoint público de consulta por identificador com a galeria completa de imagens — que a RN-58 deliberadamente deixou fora da listagem — e transforma o cartão em elemento navegável |
| **Demonstrar interesse / abrir pedido** | O módulo de Pedidos não existe. A captura não mostra botão de ação no cartão | A projeção pública devolve o `id` do animal, que é tudo o que um pedido precisa referenciar. Nenhum campo interno precisará ser acrescentado à projeção para isso | Quando o módulo de Pedidos existir. Três restrições já ficam registradas: a ação só é oferecida para animais disponíveis; ela exige sessão com role `cliente`; e ela **não** altera o status do animal a partir desta tela — a transição pertence ao módulo de Pedidos (RN-17 da FEATURE-002 deste módulo) |
| **Filtro por raça** | A raça não existe no cadastro. A FEATURE-002 deste módulo já a registrou como feature candidata do módulo, com spec própria | Nenhum — depende de a raça existir primeiro | Depois de a raça entrar no cadastro como lista controlada dependente de espécie |
| **Número do chip e contato do proprietário na vitrine** | São campos internos diferidos, e o contato é dado pessoal de terceiro sujeito à LGPD | **O gancho aqui é uma proteção, não uma abertura:** as RN-54 a RN-57 garantem que, quando esses campos entrarem no cadastro, eles **não** apareçam na vitrine por padrão | Nunca entram na projeção pública sem decisão explícita de base legal e de visibilidade |
| **Otimização para mecanismos de busca e prévia de link** | Fora do escopo da entrega e sem exigência declarada | O endereço da vitrine já é compartilhável e reproduz o estado (RN-46) | Trabalho futuro, provavelmente junto da página de detalhe |

**Pendências herdadas que esta feature mantém abertas:** a regra registrada na RN-17b da FEATURE-002 deste módulo — animal referenciado por algum pedido não pode ser excluído, com integridade referencial restritiva no vínculo — continua valendo para o módulo de Pedidos. Esta feature não a quita e não a altera; apenas confirma que ela segue pendente.

---

## Grupo 4 — Validação

### Casos de Teste

| ID | Cenário | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CT-01 | Abrir a vitrine sem nenhuma sessão | Armazenamento do navegador limpo | A grade é exibida com os animais disponíveis; nenhum redirecionamento para o login | Positivo |
| CT-02 | Consultar a listagem pública sem cabeçalho de autorização | Requisição anônima | `200` com os animais disponíveis; **nunca** `401` nem `403` | Positivo |
| CT-03 | Abrir a vitrine com sessão expirada no navegador | Credencial vencida presente | A grade é exibida normalmente; nenhuma renovação de sessão é disparada; nenhum redirecionamento ocorre | Borda |
| CT-04 | Vitrine vista por `cliente` e por `admin` | Mesma consulta nos três estados de sessão | As três respostas são idênticas em itens, filtros e campos | Positivo |
| CT-05 | Cabeçalho sem sessão | Visitante anônimo | Logotipo à esquerda; "Entrar" e "Criar conta" à direita; nenhuma identificação de usuário | Positivo |
| CT-06 | Cabeçalho com sessão | Usuário autenticado | Logotipo à esquerda; **nome** do usuário e "Sair" à direita; o e-mail **não** é exibido | Positivo |
| CT-07 | Cabeçalho durante a restauração da sessão | Sessão em restauração | Nenhuma das duas alternativas é exibida; a grade **já é carregada** sem esperar | Borda |
| CT-08 | Sair a partir da vitrine | Usuário autenticado aciona "Sair" | Permanece na vitrine; o cabeçalho volta ao estado sem sessão; a grade continua exibida | Positivo |
| CT-09 | Nome acessível do controle de sair | Leitor de tela sobre o cabeçalho | Anuncia "Sair"; o ícone é decorativo e não gera anúncio próprio | Positivo |
| CT-10 | Cartão completo conforme a captura | "Theo", cachorro, macho, grande, Campo Magro/PR, nascido em 05/11/2022, com foto e descrição; relógio em 25/08/2026 | Foto no topo; "Theo" em destaque; etiqueta "Cachorro" à direita; "Campo Magro - PR" com ícone; etiquetas "Macho", "Grande" e "3 anos"; descrição presente | Positivo |
| CT-11 | Imagem do cartão é a de capa | Animal com três imagens | A imagem exibida é a de posição 0 | Positivo |
| CT-12 | Animal sem nenhuma imagem | Animal válido sem imagem | Marcador substituto neutro no lugar da foto; cartão com a mesma altura dos demais; todas as demais informações presentes | Borda |
| CT-13 | Imagem que não carrega | Endereço de imagem inacessível | Mesmo marcador substituto; **nunca** o ícone de imagem quebrada do navegador | Negativo |
| CT-14 | Animal sem descrição | Animal válido sem descrição | A área de descrição não aparece; o cartão permanece alinhado aos demais | Borda |
| CT-15 | Descrição longa | Descrição de 1000 caracteres | Truncada **visualmente**; o texto completo permanece no documento e acessível à tecnologia assistiva | Borda |
| CT-16 | **Descrição com carga de script** | Descrição contendo `<script>alert(1)</script>` e `<img src=x onerror=alert(1)>` | Os caracteres aparecem literalmente como texto; nenhum script é executado; nenhum elemento é criado a partir do conteúdo | Negativo |
| CT-17 | Nome, espécie e cidade com carga de script | Nome do animal e da espécie com marcação | Renderizados literalmente como texto | Negativo |
| CT-18 | **Animal Reservado não aparece** | Um animal com status Reservado | Ausente de todas as páginas; não contado no total | Negativo |
| CT-19 | **Animal Adotado não aparece** | Um animal com status Adotado | Ausente de todas as páginas; não contado no total | Negativo |
| CT-20 | **Animal Indisponível não aparece** | Um animal com status Indisponível | Ausente de todas as páginas; não contado no total | Negativo |
| CT-21 | Quatro status simultâneos | Um animal em cada um dos quatro status | Exatamente um item devolvido, o Disponível; `total` igual a 1 | Positivo |
| CT-22 | Mudança de status reflete de imediato | Animal Disponível passa a Adotado | A consulta seguinte já não o traz, sem expirar cache | Positivo |
| CT-23 | Retorno à disponibilidade | Animal Adotado volta a Disponível | Volta a aparecer na consulta seguinte | Positivo |
| CT-24 | **Parâmetro `status` é recusado** | `?status=adotado`, `?status=disponivel`, `?status=` | `400` por campo não permitido nos três casos; nada é devolvido | Negativo |
| CT-25 | Busca por trecho do nome | Existe "Theo"; busca "the" | "Theo" aparece | Positivo |
| CT-26 | Busca por trecho da cidade | "Theo" em "Campo Magro"; busca "magro" | "Theo" aparece | Positivo |
| CT-27 | **Busca insensível a acentos** | "José" em "São Paulo"; buscas "jose" e "sao paulo" | Ambas encontram | Positivo |
| CT-28 | Busca insensível a maiúsculas | Existe "Theo"; buscas "THEO" e "tHeO" | Ambas encontram | Positivo |
| CT-29 | Busca em qualquer posição | Existe "Bidu"; busca "id" | "Bidu" aparece | Borda |
| CT-30 | Busca não é quebrada em palavras | "Theo" em "Campo Magro"; busca "theo campo" | Nada é encontrado — a sequência é procurada inteira | Borda |
| CT-31 | Busca só com espaços | Busca "   " | Tratada como não aplicada; a lista completa é exibida | Borda |
| CT-32 | Busca com espaços internos repetidos | Busca "campo   magro" | Encontra "Campo Magro" — os espaços internos são colapsados | Borda |
| CT-33 | Busca acima do limite | Texto de 121 caracteres | `400` por validação | Negativo |
| CT-34 | Busca de exatamente 120 caracteres | Texto de 120 caracteres | Aceita normalmente | Borda |
| CT-35 | **Consulta única após digitação** | Dez caracteres digitados em sequência rápida | Uma única consulta é enviada | Borda |
| CT-36 | **Respostas fora de ordem** | Duas consultas em sequência; a primeira responde por último | Prevalece a da última consulta disparada; a obsoleta é descartada | Borda |
| CT-37 | Filtro de espécie | Espécie "Cachorro" escolhida | Apenas cachorros disponíveis | Positivo |
| CT-38 | Filtro de porte | Porte "Grande" escolhido | Apenas animais de porte grande | Positivo |
| CT-39 | Filtro de sexo | Sexo "Fêmea" escolhido | Apenas fêmeas | Positivo |
| CT-40 | Filtro de cidade | Cidade "Campo Magro - PR" escolhida | Apenas animais daquela cidade, por igualdade exata de identificador | Positivo |
| CT-41 | Cidades homônimas em estados diferentes | Duas cidades de mesmo nome em UFs distintas | Escolher uma não traz os animais da outra | Borda |
| CT-42 | **Todos os filtros e a busca juntos** | Busca, espécie, porte, sexo, idade máxima e cidade preenchidos | Apenas os animais que satisfazem **todos** os critérios | Positivo |
| CT-43 | **Cada filtro vazio é neutro** | Cada um dos seis filtros omitido, um por vez, com os demais preenchidos | O critério omitido deixa de restringir; os demais continuam valendo | Borda |
| CT-44 | Nenhum filtro aplicado | Consulta sem parâmetros de filtro | Todos os animais disponíveis, paginados; nenhum resumo de resultados exibido | Positivo |
| CT-45 | Porte fora do conjunto | `size=gigante`, `size=`, `size=1` | `400` por validação nos três casos | Negativo |
| CT-46 | Sexo fora do conjunto | `sex=outro` | `400` por validação | Negativo |
| CT-47 | **Espécie inexistente mas bem formada** | UUID válido de espécie já excluída | `200` com lista vazia — **nunca** `404` | Borda |
| CT-48 | **Cidade inexistente mas bem formada** | UUID válido de cidade sem animais | `200` com lista vazia | Borda |
| CT-49 | Identificador malformado | `speciesId=abc`, `cityId=123` | `400` por validação apontando o parâmetro | Negativo |
| CT-50 | Opções do filtro de espécie | Duas espécies cadastradas, uma sem animal disponível | Apenas a espécie com animal disponível é oferecida | Positivo |
| CT-51 | **Opções do filtro de cidade** | Cadastro de apoio com milhares de cidades; animais em duas delas | Exatamente duas cidades oferecidas, como "Cidade - UF", ordenadas por UF e nome | Positivo |
| CT-52 | Cidade sai da lista de opções | Último animal de uma cidade deixa de estar disponível | Aquela cidade já não é oferecida na consulta seguinte | Borda |
| CT-53 | **Valor aplicado fora das opções** | Endereço com cidade que saiu da lista | O filtro permanece aplicado e a cidade é apresentada no campo como opção adicional; não some em silêncio | Borda |
| CT-54 | Filtro de idade máxima | Animais de 3 e de 5 anos; idade máxima 3 | Apenas o de 3 anos | Positivo |
| CT-55 | **Aniversário hoje** | Animal que completa 4 anos hoje; idade máxima 3 | **Não** aparece — já completou 4 | Borda |
| CT-56 | **Aniversário amanhã** | Animal que completa 4 anos amanhã; idade máxima 3 | **Aparece** — ainda tem 3 anos completos | Borda |
| CT-57 | **Animal sem data de nascimento com filtro de idade** | Animal sem data; idade máxima 5 | **Não** aparece | Borda |
| CT-58 | Animal sem data de nascimento sem filtro de idade | Animal sem data; filtro não aplicado | Aparece, com a etiqueta "Idade não informada" | Positivo |
| CT-59 | Idade máxima igual a 0 | `maxAgeYears=0` | Apenas animais com menos de um ano completo; 0 é valor válido | Borda |
| CT-60 | Idade máxima ausente e vazia | Parâmetro omitido e parâmetro vazio | Filtro não aplicado nos dois casos; distinto de 0 | Borda |
| CT-61 | Idade máxima fora da faixa | `maxAgeYears=-1`, `=31`, `=3.5`, `=abc` | `400` por validação nos quatro casos | Negativo |
| CT-62 | Idade máxima de exatamente 30 | `maxAgeYears=30` | Aceita normalmente | Borda |
| CT-63 | **Coerência entre filtro e idade exibida** | Conjunto variado de datas de nascimento, incluindo fronteiras; idade máxima N | **Toda** idade exibida nos cartões devolvidos é menor ou igual a N | Positivo |
| CT-64 | Idade em anos completos | Nascimento em 05/11/2022; relógio em 25/08/2026 | Etiqueta "3 anos" | Positivo |
| CT-65 | Idade recalculada com o relógio adiantado | Mesmo animal; relógio em 06/11/2026 | Etiqueta "4 anos"; nenhuma escrita no banco | Borda |
| CT-66 | Concordância da idade em anos | Animal com exatamente 1 ano | Etiqueta "1 ano", no singular — e não "1 ano(s)" | Borda |
| CT-67 | **Idade abaixo de um ano em meses** | Animal com 5 meses completos | Etiqueta "5 meses" | Borda |
| CT-68 | Idade abaixo de um mês | Animal nascido há 10 dias | Etiqueta "Menos de 1 mês" | Borda |
| CT-69 | **Nascimento em 29 de fevereiro** | Nascido em 29/02/2024; relógio em 28/02/2027 e em 01/03/2027 | 2 anos no primeiro caso e 3 no segundo — o ano se completa em 1º de março | Borda |
| CT-70 | **Idade no fuso correto** | Processo em UTC; relógio às 22h de São Paulo na véspera do aniversário | A idade é a de São Paulo, e não a do dia seguinte em UTC | Borda |
| CT-71 | Aviso do filtro de idade | Campo de idade máxima visível | Texto de apoio permanente informando que animais sem data de nascimento não aparecem com o filtro | Positivo |
| CT-72 | Paginação oculta com poucos animais | Um animal disponível | Nenhum controle de navegação entre páginas — conforme a captura | Borda |
| CT-73 | Paginação visível | Total acima do tamanho da página | Controles apresentados abaixo da grade | Positivo |
| CT-74 | **Paginação determinística** | 45 animais disponíveis criados no mesmo instante, tamanho de página 12 | As quatro páginas devolvem 45 identificadores distintos, sem repetição e sem omissão | Borda |
| CT-75 | Extremos da paginação | Primeira e última páginas | Ação de anterior desabilitada na primeira; de seguinte desabilitada na última | Borda |
| CT-76 | Página além da última | `page=99` com 1 página existente | `200` com lista vazia; a tela exibe a mensagem de nenhum resultado, sem erro | Borda |
| CT-77 | Tamanho de página fora da faixa | `pageSize=0` e `pageSize=101` | `400` por validação em ambos | Negativo |
| CT-78 | Tamanho de página padrão | Parâmetro omitido | 12 itens por página | Positivo |
| CT-79 | Filtro repõe a página | Visitante na página 3 altera um filtro | Volta para a página 1 | Borda |
| CT-80 | Rolagem ao trocar de página | Troca de página com a lista rolada | A apresentação volta ao topo da grade | Positivo |
| CT-81 | **Filtros registrados no endereço** | Busca e os cinco filtros aplicados | Todos os valores aplicados constam do endereço da página, com parâmetros em PT-BR | Positivo |
| CT-82 | **Endereço reproduz a vitrine** | Endereço com filtros aberto em navegador limpo e sem sessão | A barra de filtros já vem preenchida e a grade já vem filtrada | Positivo |
| CT-83 | Recarregar preserva o estado | Filtros aplicados e página recarregada | Nada é perdido, inclusive a página atual | Positivo |
| CT-84 | Botão de voltar do navegador | Filtro alterado e depois botão de voltar | O estado anterior dos filtros é restaurado e a grade acompanha | Positivo |
| CT-85 | Filtro vazio não polui o endereço | Filtros parcialmente preenchidos | Apenas os aplicados deixam parâmetro no endereço | Borda |
| CT-86 | **Valores inválidos vindos do endereço** | `?idadeMax=-5&porte=gigante&especie=abc&pagina=xyz&desconhecido=1` | Todos descartados; endereço corrigido; **a vitrine é exibida normalmente**, sem tela de erro | Negativo |
| CT-87 | Parâmetro desconhecido no endereço | Parâmetro extra na tela | Ignorado e removido, sem afetar os demais filtros | Negativo |
| CT-88 | **Tolerância da tela contra rigor da API** | Mesmos valores inválidos, enviados diretamente à API | A API responde `400` por validação, enquanto a tela exibe a vitrine — as duas posturas coexistem por desenho | Negativo |
| CT-89 | Limpar filtros | Busca e cinco filtros aplicados; ação acionada | Tudo volta ao estado inicial; página 1; endereço sem parâmetro; lista completa exibida | Positivo |
| CT-90 | Limpar filtros sem filtros aplicados | Nenhum filtro aplicado | O botão está visível e **desabilitado**; o arranjo da barra não muda | Borda |
| CT-91 | **Estado de catálogo vazio** | Nenhum animal disponível; nenhum filtro aplicado | "Nenhum animal disponível para adoção no momento. Volte em breve!"; sem ação de limpar filtros | Borda |
| CT-92 | **Estado de nenhum resultado com filtros** | Animais disponíveis existem; filtros não encontram nenhum | "Nenhum animal encontrado com os filtros aplicados." com a ação "Limpar filtros" | Borda |
| CT-93 | Catálogo vazio com filtros aplicados | Nenhum animal disponível **e** filtros aplicados | Vale a mensagem de filtros aplicados, que é a que oferece ação útil | Borda |
| CT-94 | Estado de carregamento | Consulta pendente | Indicador no lugar da grade; a barra de filtros permanece visível e utilizável; nenhuma mensagem de vazio | Positivo |
| CT-95 | Falha ao carregar a grade | Consulta indisponível | "Não foi possível carregar os animais. Tente novamente." com nova tentativa; nenhuma mensagem de vazio | Negativo |
| CT-96 | Falha ao carregar as opções de um filtro | Consulta de opções indisponível | O campo informa a falha em vez de aparecer vazio; **a grade continua sendo carregada e exibida** | Negativo |
| CT-97 | Resumo de resultados | Filtro aplicado com 1 e com 3 resultados | "1 animal encontrado" e "3 animais encontrados"; sem filtro aplicado, nenhum resumo | Borda |
| CT-98 | Total após filtros | Filtro que reduz o conjunto | O total informado é o do conjunto filtrado, e não o do catálogo | Positivo |
| CT-99 | **Conjunto exato de chaves da resposta pública** | Um animal completo consultado | O conjunto de chaves de cada item é comparado por **igualdade** ao definido; `species` tem exatamente `{id,name}`; `city` tem exatamente `{name,stateUf}` | Positivo |
| CT-100 | **Campo novo na entidade não vaza** | Campo interno acrescentado à entidade Animal | A resposta pública permanece idêntica, sem o campo novo | Negativo |
| CT-101 | **Campos internos ausentes** | Resposta pública inspecionada | `status`, `birthDate`, `createdAt`, `updatedAt`, `city.id`, `speciesId`, `cityId` e `images` não estão presentes | Negativo |
| CT-102 | Somente a imagem de capa | Animal com cinco imagens | A resposta traz um único endereço de imagem, o da posição 0 | Borda |
| CT-103 | Endereço de imagem nulo | Animal sem imagem | O campo de imagem de capa é nulo; a tela exibe o marcador substituto | Borda |
| CT-104 | Montador público separado | Leitura do código | Existe montador próprio da vitrine, distinto do administrativo; a consulta seleciona colunas explicitamente | Positivo |
| CT-105 | Endpoints administrativos inalterados | Endpoints das features anteriores exercitados | Mesmo caminho, mesma autorização, mesmo contrato e mesmas mensagens de antes | Positivo |
| CT-106 | **Endpoint público não exige sessão** | Os três endpoints públicos sem credencial | `200` nos três; nenhum responde `401` nem `403` | Positivo |
| CT-107 | Endpoint administrativo continua exigindo sessão | `GET /api/animals` sem credencial e com role `cliente` | `401` e `403`, como antes — a vitrine não afrouxou nada | Negativo |
| CT-108 | **Limitação de taxa** | Repetição acima do limite a partir da mesma origem | `429` com mensagem de negócio em PT-BR; a tela apresenta a falha com nova tentativa | Negativo |
| CT-109 | Navegação humana não é interrompida | Uso normal da vitrine, com digitação e troca de filtros | Nenhuma resposta `429` | Positivo |
| CT-110 | Resposta sem cache | Consulta repetida após alteração de status | A alteração é refletida de imediato; a resposta não é armazenável por intermediários | Positivo |
| CT-111 | **Vitrine sem armazenamento de imagens** | Armazenamento de objetos fora do ar | Grade, filtros e dados textuais funcionam; todos os cartões exibem o marcador substituto | Negativo |
| CT-112 | Vitrine sem rede externa | Toda rede externa bloqueada exceto a própria API | Vitrine, filtros e paginação continuam funcionando | Positivo |
| CT-113 | **Rota pública fora das guardas** | Endereço da vitrine acessado sem sessão | A tela monta; não passa por nenhuma guarda de sessão ou de perfil | Positivo |
| CT-114 | Rotas protegidas continuam protegidas | `/minha-area` e `/admin/animais` sem sessão | Continuam redirecionando para o login, como antes | Negativo |
| CT-115 | Perfil errado continua barrado | `cliente` em rota de admin e `admin` em rota de cliente | Continuam sendo redirecionados, como antes | Negativo |
| CT-116 | Item de navegação para a vitrine | Cliente autenticado no layout do cliente | Existe um item apontando para a vitrine e ele funciona | Positivo |
| CT-117 | Layout do cliente sem controle administrativo | Cliente autenticado | Nenhum controle administrativo aparece — a verificação já existente continua valendo após a alteração | Negativo |
| CT-118 | Raiz do endereço inalterada | Raiz acessada sem sessão e com cada perfil | Comportamento idêntico ao anterior | Positivo |
| CT-119 | **Rótulos associados de verdade** | Leitor de tela sobre os seis controles da barra | Cada um é alcançado pelo seu rótulo visível; nenhum depende de texto de apoio como rótulo | Positivo |
| CT-120 | Grade como lista semântica | Leitor de tela sobre a grade | Anunciada como lista com a sua contagem; cada cartão é um item | Positivo |
| CT-121 | Estrutura do cartão | Leitor de tela sobre um cartão | O nome do animal é um título de nível abaixo do título da página; o ícone de localização não é anunciado; a localização é legível como texto | Positivo |
| CT-122 | Texto alternativo das imagens | Cartões com e sem foto | A foto tem texto alternativo identificando o animal; o marcador substituto é decorativo e não gera anúncio redundante | Positivo |
| CT-123 | **Operação completa por teclado** | Navegação apenas por teclado | Busca, cinco filtros, limpar filtros, paginação e ações do cabeçalho são alcançáveis e acionáveis, em ordem de foco coerente | Positivo |
| CT-124 | Mudança de resultado anunciada | Filtro aplicado com leitor de tela ativo | A atualização da grade é anunciada, incluindo a quantidade e os estados de vazio | Positivo |
| CT-125 | Contraste | Inspeção das etiquetas e do texto sobre a área da imagem | Texto a no mínimo 4.5:1 e indicadores a no mínimo 3:1 | Positivo |
| CT-126 | Grade responsiva | Larguras de telefone, tablet, notebook e monitor largo | Uma, duas, três e quatro colunas; nenhuma rolagem horizontal da página; nenhum conteúdo cortado | Positivo |
| CT-127 | Carregamento adiado das imagens | Grade com mais cartões do que cabem na tela | As imagens abaixo da dobra são carregadas de forma adiada | Positivo |
| CT-128 | Desempenho da grade com volume | 500 animais disponíveis | Primeira página exibida em menos de 2 segundos | Positivo |
| CT-129 | Desempenho da busca com volume | 500 animais disponíveis; busca e cinco filtros aplicados | Grade atualizada em menos de 2 segundos | Positivo |
| CT-130 | Cartão sem botão de ação | Qualquer cartão, com e sem sessão | Nenhum botão de ação presente; a sessão não habilita nada | Positivo |
| CT-131 | Feature é somente leitura | Toda a tela exercitada | Todas as requisições são de leitura; nenhum registro do cadastro é alterado | Positivo |
| CT-132 | Coluna de busca preenchida na gravação | Animal cadastrado e depois renomeado | A coluna de busca sem acento é gravada e atualizada em ambas as operações | Positivo |
| CT-133 | Migração preenche os registros existentes | Base com animais e cidades anteriores à migração | Todos ficam com a coluna de busca preenchida; a busca os encontra | Positivo |
| CT-134 | Colunas de busca não são expostas | Respostas pública e administrativa inspecionadas | Nenhuma das duas colunas aparece em qualquer resposta | Negativo |

---

### Critérios de Aceite

**Comportamento e entrega:**

- [ ] CA-01: **A vitrine é pública: ela carrega e exibe a lista completa de animais disponíveis sem nenhuma sessão, e nenhum dos seus três endpoints responde `401` ou `403` em circunstância alguma.**
- [ ] CA-02: A vitrine é montada **fora** de `ProtectedRoute`, `RoleRoute` e `PublicOnlyRoute`, e as guardas existentes continuam protegendo as rotas que já protegiam.
- [ ] CA-03: A presença de sessão altera **apenas** o cabeçalho; a lista, os filtros e os campos de cada animal são idênticos para visitante, `cliente` e `admin`.
- [ ] CA-04: A vitrine carrega sem esperar a restauração da sessão, não dispara renovação de sessão e não redireciona para o login, inclusive com credencial vencida no navegador.
- [ ] CA-05: O cabeçalho exibe o logotipo à esquerda e, à direita, "Entrar" e "Criar conta" sem sessão, ou o **nome** do usuário e "Sair" com sessão. O e-mail não é exibido.
- [ ] CA-06: Sair a partir da vitrine mantém o visitante na vitrine, com o cabeçalho no estado sem sessão e a grade carregada.
- [ ] CA-07: A tela exibe o título "Animais para adoção" e a barra com busca, espécie, porte, sexo, idade máxima, cidade e "Limpar filtros", nessa ordem.
- [ ] CA-08: Cada cartão apresenta foto de capa no topo, nome em destaque, etiqueta da espécie à direita, localização "Cidade - UF" com ícone, as etiquetas de sexo, porte e idade, e a descrição.
- [ ] CA-09: **Apenas animais com status `DISPONIVEL` aparecem na vitrine. Reservado, Adotado e Indisponível são verificados ausentes, cada um individualmente.**
- [ ] CA-10: **O status não é parâmetro da consulta pública: enviá-lo é recusado como campo não permitido, em qualquer valor.**
- [ ] CA-11: A restrição por status, a busca e todos os filtros são aplicados na própria consulta ao banco, de modo que o total informado corresponda ao conjunto filtrado.
- [ ] CA-12: A resposta reflete o estado corrente: alterado o status de um animal, a consulta seguinte já o reflete, sem cache intermediário.
- [ ] CA-13: A ordenação é por data de cadastro decrescente, **desempatada pelo identificador**, e percorrer todas as páginas de um conjunto criado no mesmo instante devolve cada animal exatamente uma vez.
- [ ] CA-14: A vitrine é paginada no servidor com o envelope já congelado, tamanho padrão 12 e máximo 100, e os controles só aparecem quando o total excede o tamanho da página.
- [ ] CA-15: Uma página além da última responde com sucesso e lista vazia, e a tela exibe a mensagem de nenhum resultado, sem erro.
- [ ] CA-16: **A busca compara o texto com o nome do animal ou com o nome da cidade, insensível a maiúsculas e a acentos, casando em qualquer posição.**
- [ ] CA-17: O texto da busca é procurado como sequência única, e não quebrado em palavras independentes; busca vazia após normalização não é aplicada.
- [ ] CA-18: A digitação dispara uma única consulta, e respostas que chegam fora de ordem são descartadas em favor da última consulta disparada.
- [ ] CA-19: **A busca e o filtro de cidade coexistem sem redundância: a busca é texto livre e aproximada; o filtro é escolha exata por identificador. Os dois se combinam por E.**
- [ ] CA-20: Os filtros de espécie e de cidade oferecem **apenas** valores com ao menos um animal disponível, e a lista de cidades é apresentada como "Cidade - UF".
- [ ] CA-21: Um valor aplicado que saiu da lista de opções permanece aplicado e é apresentado no campo, em vez de sumir em silêncio.
- [ ] CA-22: **Todos os filtros combinam por E; cada filtro vazio é neutro; todos preenchidos ao mesmo tempo devolvem a interseção.**
- [ ] CA-23: Alterar qualquer filtro repõe a paginação na primeira página.
- [ ] CA-24: **A idade é derivada da data de nascimento a cada resposta, nunca persistida, calculada no fuso `America/Sao_Paulo` pelo utilitário de relógio do projeto.**
- [ ] CA-25: **A idade é apresentada em anos completos a partir de um ano, em meses completos abaixo disso, "Menos de 1 mês" abaixo de um mês, e "Idade não informada" quando não há data — com concordância correta em todos os casos.**
- [ ] CA-26: **A idade vira no aniversário: hoje já conta o ano, amanhã ainda não. Para nascidos em 29 de fevereiro, o aniversário em ano não bissexto é 1º de março.**
- [ ] CA-27: A idade é a do fuso de São Paulo, e não a do fuso do processo, verificado com o processo em UTC às 22h de São Paulo.
- [ ] CA-28: **Um animal sem data de nascimento é excluído sempre que o filtro de idade máxima estiver aplicado, e aparece normalmente quando ele não está.**
- [ ] CA-29: A tela informa, em texto de apoio permanente junto ao campo, a consequência do CA-28.
- [ ] CA-30: **O filtro de idade máxima e a idade exibida nunca divergem: todo animal devolvido com idade máxima N tem, no cartão, idade menor ou igual a N — inclusive em datas de fronteira.**
- [ ] CA-31: O filtro de idade máxima aceita inteiros de 0 a 30, com 0 significando "menos de um ano" e ausência significando "não aplicado".
- [ ] CA-32: **O estado da busca, dos cinco filtros e da página vive no endereço da página, com parâmetros em PT-BR, e um endereço copiado reproduz a mesma vitrine em navegador limpo e sem sessão.**
- [ ] CA-33: Apenas filtros aplicados deixam parâmetro no endereço, e "Limpar filtros" devolve o endereço sem nenhum parâmetro.
- [ ] CA-34: Recarregar a página e usar o botão de voltar do navegador preservam o estado dos filtros e da página.
- [ ] CA-35: **Valores inválidos vindos do endereço são descartados pela tela, que corrige o endereço e exibe a vitrine normalmente — enquanto a API recusa os mesmos valores por validação. As duas posturas coexistem por desenho.**
- [ ] CA-36: Identificador de espécie ou de cidade bem formado mas inexistente responde com sucesso e lista vazia, nunca com recurso não encontrado.
- [ ] CA-37: **O catálogo sem nenhum animal disponível e o resultado vazio por filtros exibem mensagens diferentes, e apenas a segunda oferece a ação de limpar filtros.**
- [ ] CA-38: O estado de carregamento mantém a barra de filtros visível e utilizável, e não é confundido com nenhum dos dois estados de vazio.
- [ ] CA-39: Falha ao carregar a grade exibe mensagem de falha com nova tentativa; falha ao carregar as opções de um filtro não impede a grade de carregar.
- [ ] CA-40: **O conjunto de chaves de cada item da resposta pública é exatamente o definido na projeção, verificado por igualdade e não por continência, incluindo os objetos aninhados de espécie e de cidade.**
- [ ] CA-41: **Um campo acrescentado à entidade Animal não aparece na resposta pública — a consulta não o lê e o montador não o enumera.**
- [ ] CA-42: **`status`, `birthDate`, `createdAt`, `updatedAt`, o identificador da cidade e a lista completa de imagens estão ausentes da resposta pública.**
- [ ] CA-43: A montagem da resposta pública vive em arquivo próprio, separado do montador administrativo, e a consulta seleciona colunas explicitamente.
- [ ] CA-44: **Descrição, nome do animal, nome da espécie e nome da cidade são apresentados como texto e nunca interpretados como marcação — verificado com carga de script.**
- [ ] CA-45: A descrição é truncada apenas visualmente; o texto completo permanece no documento e acessível à tecnologia assistiva, e o servidor devolve a descrição integral.
- [ ] CA-46: **Animal sem imagem é válido e o cartão exibe um marcador substituto neutro; imagem que não carrega recai no mesmo marcador, nunca no ícone de imagem quebrada.**
- [ ] CA-47: **A localização vem sempre do dado persistido — cidade e sigla do estado —, sem nenhuma consulta a serviço externo em tempo de renderização.**
- [ ] CA-48: **Nenhum cartão oferece botão de ação, e a feature é exclusivamente de leitura: nenhuma requisição dela altera qualquer registro.**
- [ ] CA-49: Os três endpoints públicos recebem limitação de taxa por origem, com recusa em PT-BR no envelope já vigente, e a navegação humana normal nunca é interrompida.
- [ ] CA-50: **Nenhum código de erro novo é criado; apenas `VALIDATION_ERROR` e o código já produzido pelo limitador em vigor são usados.**
- [ ] CA-51: Todo controle da barra de filtros possui rótulo visível e associado; nenhum usa texto de apoio como rótulo.
- [ ] CA-52: A grade é uma lista semântica com a sua contagem, cada cartão tem estrutura própria com o nome como título, e ícones decorativos não são anunciados.
- [ ] CA-53: Toda a tela é operável por teclado, em ordem de foco coerente, e a mudança de resultado é anunciada por tecnologia assistiva.
- [ ] CA-54: A grade passa de uma a quatro colunas conforme a largura, sem rolagem horizontal da página e sem cortar conteúdo do cartão.
- [ ] CA-55: **Nenhuma dependência nova é adicionada ao backend nem ao frontend, e o cliente HTTP compartilhado não é alterado.**
- [ ] CA-56: A migração acrescenta apenas duas colunas e um índice, preenche os registros existentes e não altera nem remove nada do que já existe.

**Regressão:**

- [ ] FEATURE-002 do MODULE-002 — Cadastro de Animais: esta feature acrescenta a gravação de uma coluna nova no caminho de escrita de animal e acrescenta um índice à tabela. Reexecutar cadastro, edição, alteração de status, exclusão, envio e remoção de imagens, listagem administrativa paginada e a ordenação alfabética da listagem — que continua usando a coluna normalizada com acentos, **não** a nova coluna de busca.
- [ ] FEATURE-001 do MODULE-002 — Cadastro de Espécies: `GET /api/species` continua exigindo role `admin` e continua devolvendo **todas** as espécies. O endpoint público de espécies é outro recurso e não o substitui. Reexecutar também a exclusão bloqueada de espécie em uso.
- [ ] FEATURE-002 do MODULE-001 — Autenticação Completa: esta feature altera a árvore de rotas do frontend e o layout do cliente. **É o ponto de maior risco desta entrega.** Reexecutar login, cadastro, confirmação de e-mail, renovação de sessão, redirecionamento por perfil após o login, acesso a rota protegida sem sessão, acesso a rota de perfil errado e o comportamento da raiz do endereço.
- [ ] Guardas de rota: verificar que `ProtectedRoute`, `RoleRoute` e `PublicOnlyRoute` continuam decidindo exatamente como antes, e que o catch-all global continua alcançável para endereços desconhecidos após a inserção do bloco público.
- [ ] Layout do cliente: a verificação já existente de que nenhum controle administrativo aparece na área do cliente continua valendo após o acréscimo do item de navegação para a vitrine.
- [ ] Endpoints administrativos: verificar que `GET /api/animals`, `GET /api/species`, `GET /api/states` e `GET /api/states/:uf/cities` continuam exigindo sessão e perfil, com o mesmo contrato — a existência de endpoints públicos não afrouxou nenhum deles.
- [ ] Envelope de erro: nenhum código novo é acrescentado. Verificar que nenhuma resposta existente mudou de formato, de código ou de mensagem.
- [ ] Banco de dados: a migração acrescenta duas colunas e um índice e preenche os registros existentes. Verificar que autenticação, cadastro de espécies e cadastro de animais continuam funcionando após a migração.
- [ ] **Pendência que permanece aberta:** a regra registrada na RN-17b da FEATURE-002 deste módulo — animal referenciado por pedido não pode ser excluído, com integridade referencial restritiva — continua pendente e é do módulo de Pedidos. Esta feature não a quita.

**Qualidade de código (SonarQube):**
- [ ] Quality Gate aprovado sem bloqueadores
- [ ] Cobertura de testes: mínimo de 80% nas classes alteradas
- [ ] Zero issues de segurança (Severity: Blocker ou Critical)

---

### Cenários de QA

Roteiro de homologação manual. Preparo: pelo menos duas espécies cadastradas; animais em cidades de estados diferentes; um animal em cada um dos quatro status; um animal sem data de nascimento; um animal sem imagem; um animal com descrição contendo marcação; um usuário `cliente` e um `admin` cadastrados e confirmados.

| # | Passo | Resultado esperado |
|---|---|---|
| QA-01 | Em uma janela anônima, sem nenhuma sessão, abrir o endereço da vitrine | A página abre com o título "Animais para adoção", a barra de filtros e a grade de cartões. **Nenhum pedido de login** |
| QA-02 | Observar o cabeçalho nessa janela anônima | Logotipo CatDog à esquerda; "Entrar" e "Criar conta" à direita; nenhuma identificação de usuário |
| QA-03 | Autenticar como `cliente` e voltar à vitrine | O conteúdo é idêntico ao da janela anônima; o cabeçalho passa a exibir o **nome** do usuário e "Sair". O e-mail **não** aparece |
| QA-04 | Acionar "Sair" a partir da vitrine | Permanece na vitrine; o cabeçalho volta ao estado sem sessão; a grade continua exibida |
| QA-05 | Autenticar como `admin` e abrir a vitrine | Mesmo conteúdo; nenhum controle administrativo é oferecido nesta tela |
| QA-06 | Conferir o cartão do animal completo contra o cadastro administrativo | Foto de capa, nome, etiqueta da espécie, "Cidade - UF" com ícone, etiquetas de sexo, porte e idade, e descrição — todos coerentes com o cadastro |
| QA-07 | Conferir o cartão do animal **sem imagem** | Marcador substituto neutro no lugar da foto; cartão com a mesma altura dos demais; demais informações presentes |
| QA-08 | Conferir o cartão do animal **sem data de nascimento** | Etiqueta "Idade não informada"; etiquetas de sexo e porte presentes |
| QA-09 | **Conferir o cartão do animal cuja descrição contém `<script>` e `<img onerror>`** | Os caracteres aparecem **literalmente como texto**; nenhuma janela de alerta abre; nada é executado |
| QA-10 | **Procurar na vitrine os animais Reservado, Adotado e Indisponível** | Nenhum dos três aparece, em nenhuma página |
| QA-11 | **Na área administrativa, marcar um animal exibido como Adotado; voltar à vitrine e recarregar** | Ele desaparece da vitrine imediatamente |
| QA-12 | **Voltar o mesmo animal para Disponível e recarregar a vitrine** | Ele volta a aparecer |
| QA-13 | Buscar por um trecho do nome de um animal | O animal aparece |
| QA-14 | Buscar por um trecho do nome da cidade de um animal | O animal aparece — a busca também procura na cidade |
| QA-15 | **Buscar sem acento por um nome ou cidade acentuados** ("jose", "sao paulo") | Encontra normalmente |
| QA-16 | Buscar em caixa alta e em caixa mista | Encontra nos dois casos |
| QA-17 | Buscar pelo nome de um animal seguido do nome da cidade dele, separados por espaço | **Nada é encontrado** — o texto é procurado como sequência única |
| QA-18 | Digitar rapidamente dez caracteres na busca | A grade atualiza uma única vez ao fim da digitação, e não a cada tecla |
| QA-19 | Abrir o filtro de espécie | Apenas espécies **com ao menos um animal disponível** são oferecidas |
| QA-20 | **Abrir o filtro de cidade** | Apenas as cidades **com ao menos um animal disponível** são oferecidas, como "Cidade - UF" — e não os milhares de municípios do cadastro |
| QA-21 | Escolher uma cidade e conferir a grade | Apenas animais daquela cidade |
| QA-22 | Buscar por um texto e escolher uma cidade **incompatível** com ele | Nenhum resultado, com a mensagem de filtros aplicados — os dois critérios se somam |
| QA-23 | Preencher busca, espécie, porte, sexo, idade máxima e cidade ao mesmo tempo | Apenas os animais que satisfazem **todos** os critérios |
| QA-24 | Voltar um filtro por vez para "todos" | Cada critério removido deixa de restringir; os demais continuam valendo |
| QA-25 | **Informar idade máxima e conferir a idade em cada cartão devolvido** | **Nenhuma idade exibida é maior que o valor informado** |
| QA-26 | **Aplicar o filtro de idade máxima e procurar o animal sem data de nascimento** | Ele **não** aparece |
| QA-27 | Ler o texto de apoio abaixo do campo de idade máxima | Informa que animais sem data de nascimento não aparecem enquanto o filtro estiver em uso |
| QA-28 | Esvaziar o campo de idade máxima | O filtro deixa de valer e o animal sem data de nascimento volta a aparecer |
| QA-29 | Informar idade máxima 0 | Apenas animais com menos de um ano completo |
| QA-30 | **Conferir a etiqueta de idade de um animal com menos de um ano** | A idade aparece em **meses**; abaixo de um mês, "Menos de 1 mês" |
| QA-31 | **Conferir a etiqueta de idade de um animal com exatamente um ano** | "1 ano", no singular — e não "1 ano(s)" |
| QA-32 | Estando na página 3, alterar um filtro | Volta para a página 1 |
| QA-33 | Cadastrar mais animais do que cabem em uma página e percorrer todas | Os controles aparecem; nenhum animal se repete nem desaparece entre as páginas |
| QA-34 | Trocar de página com a lista rolada | A apresentação volta ao topo da grade |
| QA-35 | **Aplicar vários filtros e copiar o endereço da página** | O endereço registra busca, filtros e página, com parâmetros em PT-BR |
| QA-36 | **Colar esse endereço em uma janela anônima, sem sessão** | A vitrine abre com a barra já preenchida e a grade já filtrada — exatamente como na origem |
| QA-37 | Recarregar a página com filtros aplicados | Nada é perdido, inclusive a página atual |
| QA-38 | Alterar um filtro e acionar o botão de voltar do navegador | O estado anterior é restaurado |
| QA-39 | **Adulterar o endereço com idade negativa, porte inexistente e um parâmetro desconhecido** | Os valores inválidos são descartados, o endereço é corrigido e **a vitrine é exibida normalmente**, sem tela de erro |
| QA-40 | Acionar "Limpar filtros" | Tudo volta ao estado inicial e o endereço fica sem nenhum parâmetro |
| QA-41 | Observar "Limpar filtros" sem nenhum filtro aplicado | Visível e **desabilitado**; o arranjo da barra não muda |
| QA-42 | **Deixar o catálogo sem nenhum animal disponível e abrir a vitrine** | "Nenhum animal disponível para adoção no momento. Volte em breve!", sem ação de limpar filtros |
| QA-43 | **Repovoar o catálogo e aplicar uma combinação de filtros impossível** | "Nenhum animal encontrado com os filtros aplicados.", com a ação "Limpar filtros" |
| QA-44 | Acionar "Limpar filtros" a partir desse estado | A grade volta a exibir os animais disponíveis |
| QA-45 | **Inspecionar a resposta da vitrine em uma ferramenta de rede** | As chaves de cada item são exatamente as da projeção; `status`, `birthDate`, `createdAt`, `updatedAt`, identificador de cidade e lista de imagens **não** estão presentes |
| QA-46 | Inspecionar a resposta de um animal com cinco imagens | Um único endereço de imagem, o da capa |
| QA-47 | **Chamar os três endpoints públicos sem nenhuma credencial** | Todos respondem com sucesso; nenhum responde `401` nem `403` |
| QA-48 | **Chamar `GET /api/animals` e `GET /api/species` sem credencial e como `cliente`** | Continuam recusando, exatamente como antes — a vitrine não afrouxou nada |
| QA-49 | **Enviar `status` como parâmetro à consulta pública** | Recusado por campo não permitido |
| QA-50 | Repetir a consulta pública muitas vezes em sequência a partir da mesma origem | Acima do limite, recusa em PT-BR com nova tentativa; em uso humano normal, nunca |
| QA-51 | Derrubar o acesso ao armazenamento de imagens e abrir a vitrine | Grade, filtros e dados textuais funcionam; os cartões exibem o marcador substituto |
| QA-52 | Abrir a vitrine em telefone, tablet, notebook e monitor largo | Uma, duas, três e quatro colunas; nenhuma rolagem horizontal; nenhum conteúdo cortado |
| QA-53 | **Percorrer toda a tela usando apenas o teclado** | Busca, cinco filtros, limpar filtros, paginação e ações do cabeçalho são alcançáveis e acionáveis, em ordem coerente |
| QA-54 | **Percorrer a barra de filtros com leitor de tela** | Cada controle é anunciado pelo seu rótulo visível; nenhum depende do texto de apoio |
| QA-55 | Percorrer a grade com leitor de tela | Anunciada como lista com a contagem; cada cartão tem o nome do animal como título; o ícone de localização não é anunciado |
| QA-56 | Aplicar um filtro com leitor de tela ativo | A mudança de resultado é anunciada, incluindo a quantidade |
| QA-57 | Conferir cores e tipografia contra a referência visual do projeto | Roxo `#7c3aed`, laranja `#e05a1e` e a fonte do produto; etiquetas e texto atendem ao contraste mínimo |
| QA-58 | **Sair da vitrine e acessar `/minha-area` e `/admin/animais` sem sessão** | Continuam redirecionando para o login, como antes |
| QA-59 | Autenticado como `cliente`, procurar o caminho para a vitrine dentro da aplicação | Existe um item de navegação apontando para ela e ele funciona |
| QA-60 | Autenticado como `cliente`, conferir a área do cliente | Nenhum controle administrativo aparece — como antes da alteração |
| QA-61 | Acessar a raiz do endereço sem sessão, como `cliente` e como `admin` | Comportamento idêntico ao anterior a esta entrega |
| QA-62 | **Renomear um animal na área administrativa e buscá-lo pelo novo nome na vitrine, sem acento** | Encontrado — a coluna de busca foi atualizada na gravação |

---

### Critério de Sucesso da Feature

| Métrica | Baseline atual | Meta após entrega | Como será medida |
|---|---|---|---|
| Formas de o cliente ver o catálogo sem ter conta | 0 — não existe nenhuma tela pública | 1 vitrine pública, alcançável por link | Abertura do endereço em navegador sem sessão |
| Animais não disponíveis exibidos ao público | Não aplicável | 0 ocorrências | Verificação com um animal em cada um dos quatro status, a cada entrega |
| Campos internos vazados pela vitrine | Não aplicável | 0 campos | Comparação por igualdade do conjunto de chaves da resposta pública, automatizada |
| Divergências entre o filtro de idade e a idade exibida | Não aplicável | 0 ocorrências | Verificação automatizada em datas de fronteira, incluindo aniversário no dia e 29 de fevereiro |
| Resultados de busca perdidos ou repetidos entre páginas | Não aplicável | 0 ocorrências | Percurso completo das páginas com registros de mesmo instante |
| Links de vitrine filtrada que não reproduzem o resultado | Não aplicável | 0 ocorrências | Abertura do endereço copiado em navegador limpo e sem sessão |
| Tempo para o visitante encontrar um animal por preferência | Não aplicável — não existe vitrine | Menos de 1 minuto entre abrir a vitrine e ver a lista filtrada | Observação em homologação |
| Dependências novas introduzidas | 3 no frontend, as já existentes no backend | 0 novas | Conferência dos manifestos de dependência antes e depois |

---

## Grupo 5 — Estimativa

> Preencha após o escopo completo estar definido e revisado.

**Use Points gerados:** _A preencher_
**Estimativa de custo:** _A preencher_
