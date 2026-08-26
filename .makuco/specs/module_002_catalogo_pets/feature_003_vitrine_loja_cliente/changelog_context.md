# Alterações da Feature — RF-003 Vitrine da Loja (visão do cliente)

> **Como preencher:** registre aqui toda alteração realizada após a aprovação inicial da spec. Cada entrada deve descrever o que mudou, por que mudou e quem autorizou. Não edite entradas anteriores — apenas adicione novas.

---

## Versão atual da spec

**Versão:** v1.0
**Spec original aprovada em:** _YYYY-MM-DD por Nome_
**Última alteração:** 2026-08-25

---

## Histórico de Alterações

---

### ALT-001 — Decisões tomadas na criação da spec v1.0

**Data:** 2026-08-25
**Solicitado por:** Contrato de criação da feature (execução autônoma autorizada pelo responsável do produto)
**Realizado por:** Makuco Specify Agent
**Aprovado por:** _A preencher_

**O que mudou:**
Nada em relação a uma versão anterior — esta é a spec inaugural da feature. A entrada registra as decisões tomadas na ausência do responsável do produto, em pontos onde a captura de tela usada como fonte da verdade era omissa, divergia das convenções em vigor, divergia do escopo aprovado do produto, ou onde o precedente das duas features anteriores do módulo não se transferia.

---

**Decisão 1 — A vitrine é PÚBLICA, contrariando a leitura literal da captura**

**Antes:** a captura exibe, no canto superior direito, o e-mail de um usuário autenticado e um controle "Sair", sugerindo tela restrita a quem tem sessão. O `MAKUCO.md` afirma o oposto: *"Public catalog: no authentication required"*.
**Depois:** a vitrine e os três endpoints que a alimentam são públicos. Nenhum responde `401` ou `403`. A presença de sessão altera **apenas** o cabeçalho.

**Por quê:**
1. A captura registra o estado da sessão de quem a tirou, não uma exigência da tela — quem estava logado veria o cabeçalho autenticado em qualquer página do produto.
2. Exigir sessão inverteria o funil: o visitante precisaria criar conta e confirmar e-mail antes de saber se existe algum animal do seu interesse. O cadastro com confirmação por e-mail entregue pela FEATURE-002 do MODULE-001 é barreira desproporcional para quem só quer olhar.
3. Um catálogo que não pode ser compartilhado por link com quem ainda não tem conta não é uma vitrine.

**Impacto na árvore de rotas do frontend — a consequência mais cara desta decisão:**

Toda rota com conteúdo hoje está dentro de `ProtectedRoute`, e as áreas por perfil ainda dentro de `RoleRoute`. `/minha-area` está sob `ProtectedRoute` + `RoleRoute allow={['cliente']}`. **Nenhuma dessas guardas serve para uma rota pública:**

| Guarda | Por que não serve |
|---|---|
| `ProtectedRoute` | Manda ao login quem não tem sessão — exatamente o visitante que a feature existe para atender |
| `RoleRoute allow={['cliente']}` | Além de exigir sessão, expulsaria o `admin` |
| `PublicOnlyRoute` | Expulsaria quem **tem** sessão, invertendo o defeito. Ela existe para login e cadastro, não para conteúdo público |

**Alternativas descartadas:**

| Alternativa | Motivo da recusa |
|---|---|
| Montar a vitrine sob `/minha-area` | Ficaria atrás de `ProtectedRoute` + `RoleRoute`, tornando o catálogo inacessível a quem não tem conta |
| Reaproveitar o `ClientLayout` | É o layout de uma área autenticada, com item "Minha área" e botão de sair sempre presentes. Reaproveitá-lo obrigaria a condicionar metade do seu conteúdo à existência de sessão, e ele é arquivo já coberto por testes que verificam justamente a ausência de controles indevidos |
| Criar uma guarda "pública" nova | Uma guarda que não guarda nada é ruído. Rota pública é a **ausência** de guarda |
| Mover a vitrine para a raiz `/` | Alteraria o redirecionamento por perfil da raiz, ponto sensível de regressão já sinalizado pelas specs anteriores. **Registrado como recomendação de acompanhamento, fora do escopo desta feature** |

**Escolhido:** bloco de rota novo **fora de todas as guardas**, ao lado das rotas já públicas de verificação e confirmação de e-mail, antes do catch-all global; caminho novo em `ROUTE_PATHS`; layout público novo; e item de navegação acrescentado ao `ClientLayout`, sem o qual o cliente autenticado não teria como chegar à vitrine pela aplicação. Os três últimos são alterações em arquivos cobertos por testes e têm itens de regressão próprios.

---

**Decisão 2 — Cabeçalho exibe o NOME, e não o e-mail da captura**

**Antes:** a captura exibe o e-mail do usuário autenticado.
**Depois:** o cabeçalho da vitrine exibe o **nome**. Se o nome estiver ausente, nada é exibido no lugar — o e-mail não é usado como alternativa.

**Por quê:** dois motivos independentes. O e-mail é dado pessoal, e esta é, por definição do produto, uma página pública, passível de ser vista por terceiros sobre o ombro do usuário ou em tela compartilhada. E o `ClientLayout` já em produção exibe o nome: exibir o e-mail aqui criaria duas identificações diferentes para o mesmo usuário dentro da mesma aplicação. A captura mostra o e-mail porque foi assim que se construiu, não porque isso tenha sido decidido.

---

**Decisão 3 — Caminho da tela e parâmetros do endereço em PT-BR; API em inglês**

**Antes:** a captura mostra `/animals`.
**Depois:** a tela é `/animais` e os parâmetros do endereço são escritos em PT-BR. Os endpoints são `/api/catalog/animals`, `/api/catalog/species` e `/api/catalog/cities`, em inglês.

**Por quê:** convenção já congelada e aplicada duas vezes neste módulo — `/admin/especies` em vez de `/admin/species`, `/admin/animais` em vez de `/admin/animals`. O endereço é interface visível ao usuário, e o próprio módulo de caminhos do frontend documenta essa escolha. Manter o inglês aqui criaria a única exceção do conjunto. Os parâmetros do endereço seguem a mesma lógica pelo mesmo motivo, e a tradução para os parâmetros em inglês da API é responsabilidade da tela.

---

**Decisão 4 — Prefixo de API próprio para o catálogo público, em vez de reutilizar `GET /api/animals`**

**Antes:** não havia definição.
**Depois:** três endpoints novos sob `/api/catalog`, com consulta, montador e validadores próprios.

**Por quê:** fazer a mesma rota responder de duas formas conforme a presença de sessão colocaria a projeção pública e a administrativa a um `if` de distância uma da outra — qualquer defeito na verificação de permissão passaria a expor a representação completa do animal a qualquer visitante. Rotas, consultas e montadores separados tornam esse acidente impossível de acontecer por engano. O custo é uma rota a mais; o benefício é que o vazamento deixa de depender de um acerto de fluxo de controle.

Consequência positiva registrada: **nenhum código de erro novo é criado por esta feature.** Ela produz apenas `VALIDATION_ERROR`, já existente, e o código do limitador de taxa em vigor.

---

**Decisão 5 — Busca insensível a acentos por coluna persistida, e não por extensão do banco**

**Antes:** não havia busca em lugar nenhum do produto — a listagem administrativa da FEATURE-002 deste módulo explicitamente não a oferece.
**Depois:** duas colunas novas — `name_search` em `animals` e em `cities` — contendo o nome já em minúsculas e sem marcas diacríticas, mantidas pela aplicação e preenchidas por migração para os registros existentes. A mesma função normaliza o texto da busca antes da comparação.

**Alternativas descartadas:**

| Alternativa | Motivo da recusa |
|---|---|
| Extensão de remoção de acentos do banco, aplicada na consulta | Exigiria SQL cru fora do construtor de consultas em uso, quebrando o padrão de repositório do projeto; exigiria habilitar uma extensão no banco gerenciado; e tornaria o resultado dependente da configuração do servidor, que os testes não conseguem fixar |
| Comparar em memória, após buscar tudo | Quebraria a paginação e o total de registros, calculados sobre um conjunto já truncado |
| Aceitar busca sensível a acentos | "Jose" não encontraria "José" e "sao paulo" não encontraria "São Paulo". Em PT-BR isso não é detalhe, é a maioria dos casos reais |

**Por quê:** é exatamente o precedente que a FEATURE-001 deste módulo estabeleceu ao persistir uma coluna normalizada em vez de depender de índice sobre expressão ou de collation.

**Ponto de atenção declarado:** a coluna **não** substitui `nameNormalized`, que continua servindo à ordenação alfabética da listagem administrativa e que **preserva acentos de propósito**. São duas colunas com finalidades distintas na mesma tabela, e confundi-las alteraria a ordenação administrativa.

**Limitação conhecida e gatilho de revisão:** busca por conteúdo em qualquer posição não se beneficia de índice comum. No volume declarado — dezenas a poucas centenas de animais —, a varredura é irrelevante. Ultrapassados alguns milhares de animais disponíveis, a decisão volta à mesa e a alternativa natural é um índice de trigramas. O gatilho é registrado agora para que a decisão não vire defeito de desempenho surpresa.

---

**Decisão 6 — Paginação de servidor mantida; rolagem infinita recusada; página padrão de 12**

**Antes:** a captura não exibe controle de paginação — mas ela tem um único animal.
**Depois:** paginação de servidor, mesmo envelope `{ items, pagination }` já congelado, mesmo máximo de 100, tamanho padrão **12**, com controles apresentados apenas quando o total excede o tamanho da página.

**Alternativas descartadas:**

| Alternativa | Motivo da recusa |
|---|---|
| Rolagem infinita | Incompatível com a decisão de manter o estado da tela no endereço da página: não há posição de rolagem compartilhável. Exigiria observação de interseção e acumulação de estado que a base de dependências do frontend não possui. Tornaria a última página inalcançável por teclado e por leitor de tela. E impediria voltar a um resultado já visto sem recarregar tudo |
| Trazer tudo de uma vez | Contraria o envelope paginado já congelado e cresce sem teto |
| Botão "Carregar mais" | Herda o pior dos dois: continua sem endereço compartilhável por posição e ainda exige controle manual |

**Por que 12 e não os 20 da listagem administrativa:** a unidade aqui é o cartão, não a linha de tabela. 12 é divisível por 2, 3 e 4, que são as quantidades de colunas da grade nos três tamanhos de tela, de modo que nenhuma página termina em fila incompleta. O máximo de 100 é mantido idêntico ao já congelado.

---

**Decisão 7 — Ordenação por data de cadastro decrescente, desempatada pelo identificador**

**Antes:** não havia definição. A listagem administrativa da FEATURE-002 deste módulo é alfabética.
**Depois:** a vitrine ordena por data de cadastro decrescente, com desempate pelo identificador do animal em ordem crescente.

**Por quê:** as duas telas têm propósitos diferentes. Na administrativa, o administrador procura um animal que ele **sabe** existir, e o alfabeto é o índice certo. Na vitrine, o visitante **descobre** animais que não conhece, e dar visibilidade a quem acabou de entrar no catálogo é o comportamento correto. O desempate pelo identificador é obrigatório e não é detalhe: sem um critério que nunca empata, dois animais cadastrados no mesmo instante podem trocar de posição entre uma página e outra, fazendo um registro aparecer duas vezes e outro desaparecer. Um índice composto novo cobre o recorte por status, a ordenação e os dois critérios em uma só estrutura.

---

**Decisão 8 — Filtro de cidade é seleção de lista controlada, distinta da busca livre**

**Antes:** a captura mostra, na mesma barra, um campo de busca com o texto de apoio "Busque por nome ou cidade" **e** um campo "Cidade" de natureza ambígua, que aparenta ser de texto.
**Depois:** a busca é texto livre e o filtro de cidade é **seleção de lista controlada**, comparando por igualdade exata de identificador. Os dois se combinam por E.

**Por quê:** um campo de texto de cidade ao lado de uma busca que já procura por cidade seria genuinamente redundante — dois controles fazendo a mesma coisa, com o segundo sem nenhuma vantagem sobre o primeiro. Como seleção, ele passa a oferecer o que a busca não oferece: escolha exata, sem ambiguidade entre cidades homônimas de estados diferentes, determinística e compartilhável por link. A redundância entre os dois numa combinação como "campo" + Campo Magro é aceita e inofensiva; uma combinação contraditória devolve lista vazia, que é a resposta correta.

---

**Decisão 9 — Opções de filtro derivadas do catálogo disponível, e não do cadastro inteiro**

**Antes:** não havia definição.
**Depois:** os endpoints públicos de espécies e de cidades devolvem **apenas** valores com ao menos um animal disponível, derivados do estado corrente do catálogo a cada consulta.

**Por quê:** o cadastro de apoio tem cerca de 5.600 municípios. Oferecê-los todos produziria uma lista impraticável em que quase toda escolha levaria a zero resultados — um filtro que existe para não funcionar. O mesmo vale, em escala menor, para espécies sem nenhum animal disponível. Os endpoints administrativos não servem para isso: exigem role `admin` e devolvem o cadastro inteiro, que é justamente o problema.

**Salvaguarda associada:** um valor que chega pelo endereço da página e não está mais entre as opções **permanece aplicado** e é apresentado no campo como opção adicional, para que o visitante o veja e possa removê-lo. Apagar a escolha em silêncio esconderia dele o motivo de a lista estar vazia. Mesmo princípio da RN-56 da FEATURE-002 deste módulo.

---

**Decisão 10 — Estado dos filtros no endereço da página, com tolerância na tela e rigor na API**

**Antes:** não havia definição.
**Depois:** busca, cinco filtros e página vivem nos parâmetros do endereço. Valores inválidos vindos do endereço são **descartados pela tela**, que corrige o endereço e exibe a vitrine normalmente; a **API recusa** os mesmos valores por validação.

**Por quê o estado no endereço:** um link copiado reproduz a mesma vitrine em outro navegador, recarregar não perde nada e o botão de voltar funciona. Manter o estado só em memória tornaria o resultado de uma busca incompartilhável — justamente o que um visitante quer fazer ao encontrar um animal.

**Por quê as duas posturas diferentes, que à primeira vista parecem incoerentes:** elas protegem coisas diferentes. A tolerância da tela protege o visitante de um link estragado, truncado por um aplicativo de mensagens ou adulterado: um catálogo público deve mostrar o catálogo, não uma tela de erro. O rigor da API impede que um filtro pare de filtrar em silêncio para qualquer consumidor, inclusive um que não seja esta tela. A consequência aceita é que o `400` da API nunca chega ao visitante por este caminho — e isso é intencional.

**Decisão acessória:** identificador de espécie ou de cidade **bem formado mas inexistente** responde com sucesso e lista vazia, e **não** com recurso não encontrado. A espécie pode ter sido excluída depois de o link ser compartilhado, e um `404` afirmaria que a vitrine não existe, o que é falso. Isto difere deliberadamente da escrita administrativa, onde uma espécie inexistente é recusada — lá o identificador é referência obrigatória, aqui é critério de seleção.

---

**Decisão 11 — Idade em meses abaixo de um ano, e concordância corrigida**

**Antes:** a captura exibe a etiqueta "3 ano(s)". A RN-20 da FEATURE-002 deste módulo define a idade apenas em anos completos, e a representação da API traz apenas `ageInYears`.
**Depois:** a projeção pública traz `ageInYears` **e** `ageInMonths`, ambos derivados e ambos nulos quando não há data de nascimento. A apresentação é "N anos" a partir de um ano, "N meses" abaixo disso, "Menos de 1 mês" abaixo de um mês e "Idade não informada" sem data.

**Por quê:** um filhote de dois meses exibido como "0 anos" é informação inútil para quem adota, e a diferença entre dois e dez meses é decisiva na escolha. O acréscimo é **aditivo** — `ageInYears` continua existindo com exatamente o mesmo significado, e a RN-20 daquela spec não é alterada, apenas complementada para a apresentação pública.

A correção de "3 ano(s)" para "3 anos" e "1 ano" segue o mesmo princípio que já levou a FEATURE-002 deste módulo a corrigir "Total: 1 animais" para "Total: 1 animal": defeito de concordância visível na própria fonte da verdade não é contrato a preservar.

---

**Decisão 12 — Animal sem data de nascimento é excluído pelo filtro de idade máxima, com aviso na tela**

**Antes:** decisão tomada na FEATURE-002 deste módulo e transportada para cá deliberadamente pelo contrato de criação desta spec.
**Depois:** mantida integralmente, **sem divergência**. Um animal sem data de nascimento não aparece enquanto o filtro de idade máxima estiver aplicado, e aparece normalmente quando ele não está.

**Por quê:** não se pode afirmar que ele satisfaz o critério. Incluí-lo produziria resultados que contradizem o próprio filtro — um visitante que pediu "até 2 anos" veria animais de idade desconhecida, possivelmente idosos.

**Acréscimo desta spec:** a tela informa a consequência em texto de apoio permanente junto ao campo. Um visitante que filtra por idade e perde metade do catálogo sem saber por quê é um defeito de produto, ainda que o comportamento esteja correto. A regra estava certa; faltava dizê-la ao usuário.

**Invariante associada, escrita como regra e verificada como critério de aceite próprio:** a idade que o filtro usa e a idade que o cartão exibe são sempre a mesma. Todo animal devolvido sob idade máxima N tem, no próprio cartão, idade menor ou igual a N — inclusive em datas de fronteira. É a invariante que qualquer divergência de aritmética entre o filtro e a apresentação viola.

---

**Decisão 13 — Regra de aniversário para nascidos em 29 de fevereiro**

**Antes:** não havia definição. A FEATURE-002 deste módulo fixou o fuso `America/Sao_Paulo` mas não tratou o caso.
**Depois:** o aniversário de quem nasceu em 29 de fevereiro, em ano não bissexto, é **1º de março**.

**Por quê:** o ano só se completa **depois** de 28 de fevereiro, e "anos completos" é a definição de idade já congelada. Adotar 28 de fevereiro faria o animal completar o ano um dia antes de ter vivido o ano inteiro. Sem essa regra escrita, cada implementação escolheria uma das duas e o filtro de idade e a idade exibida poderiam divergir em um dia por ano — exatamente o tipo de defeito que só aparece uma vez a cada quatro anos e que ninguém consegue reproduzir.

---

**Decisão 14 — Limitação de taxa APLICADA, contrariando o precedente das duas features anteriores do módulo**

**Antes:** as FEATURE-001 e FEATURE-002 deste módulo dispensaram o limitador, ambas registrando o mesmo motivo: operação administrativa, autenticada, de baixo volume, sem envio de e-mail.
**Depois:** os três endpoints públicos recebem limitação de taxa por origem, reaproveitando o mecanismo já existente no projeto.

**Por quê o precedente não se transfere:** ele se apoiava em três atributos que esta feature não tem. Estes são os primeiros endpoints **anônimos de leitura** do produto fora do fluxo de autenticação; a busca por conteúdo em qualquer posição é, por construção da Decisão 5, a consulta mais cara do catálogo e não se beneficia de índice; e não há credencial a exigir, portanto não há nada além do limitador contendo repetição automatizada. Repetir a dispensa por inércia seria o erro.

Nenhum mecanismo novo é criado, nenhum código de erro novo é inventado, e o limite é generoso o bastante para não atrapalhar navegação humana nem vários visitantes atrás de uma mesma saída de rede.

---

**Decisão 15 — Cadeia de parâmetros montada no serviço de API da vitrine, sem tocar no cliente HTTP**

**Antes:** o cliente HTTP compartilhado do frontend não possui construtor de cadeia de parâmetros, não possui cancelamento de requisição e não possui tempo limite.
**Depois:** a cadeia é montada no serviço de API da vitrine, com o utilitário padrão do navegador, omitindo parâmetros vazios. **Esta feature não altera nenhuma linha do cliente HTTP.**

**Por quê:** o cliente HTTP é arquivo transversal que abriga a fila de renovação de sessão, já apontado pela FEATURE-002 deste módulo como o ponto de maior risco de regressão do frontend. Alterá-lo para a conveniência de um único consumidor é desproporcional. Aquela feature o alterou porque envio de arquivo **não tem** alternativa; cadeia de parâmetros tem. Se um segundo domínio precisar do mesmo, a promoção para o cliente compartilhado é feita então, com um segundo caso de uso real justificando o risco.

**Consequência declarada:** sem cancelamento de requisição, o descarte de respostas que chegam fora de ordem é feito por comparação de sequência na própria tela. Mesmo princípio já adotado na RN-57 daquela feature para a lista de cidades.

---

**Decisão 16 — Página de detalhe do animal fora de escopo, com o gancho registrado**

**Antes:** a captura mostra apenas a grade, sem nenhum caminho para uma tela individual.
**Depois:** a página de detalhe é **explicitamente fora de escopo**, registrada como feature candidata do módulo.

**Por quê:** a fonte da verdade não a mostra, e inventá-la sem referência seria escopo não solicitado. Reconhece-se, porém, que a **descrição truncada no cartão sugere que há mais a ver** — é por isso que a lacuna está registrada, e não omitida.

**Gancho já entregue por esta feature:** a projeção pública devolve o `id` do animal e a descrição **integral**, sem truncagem no servidor; a truncagem é puramente visual e o texto completo permanece disponível à tecnologia assistiva. Nada foi perdido. Quando a feature de detalhe existir, ela acrescenta um endpoint público de consulta por identificador com a galeria completa de imagens — que a projeção da listagem deliberadamente deixou de fora — e transforma o cartão em elemento navegável.

---

**Decisão 17 — Demonstração de interesse fora de escopo, com as restrições futuras já registradas**

**Antes:** o escopo aprovado do produto prevê um módulo de Pedidos. Ele não existe. A captura não mostra botão de ação no cartão.
**Depois:** nenhum cartão oferece ação, e a feature é exclusivamente de leitura.

**Gancho e restrições registrados agora, antes de a entidade Pedido existir:** a projeção pública devolve o `id` do animal, que é tudo o que um pedido precisa referenciar — nenhum campo interno precisará ser acrescentado à projeção para isso. Quando o módulo existir, três restrições já valem: a ação só é oferecida para animais disponíveis; ela exige sessão com role `cliente`; e ela **não** altera o status do animal a partir desta tela, porque a transição pertence ao módulo de Pedidos (RN-17 da FEATURE-002 deste módulo).

Escrever isto agora repete deliberadamente o que a FEATURE-002 deste módulo fez na sua RN-17b, e pelo mesmo motivo: foi a omissão equivalente que fez a FEATURE-001 conviver com a sua regra mais importante verificável apenas por duplo de teste.

---

**Decisão 18 — Rótulos de filtro corrigidos e sempre visíveis e associados**

**Antes:** a captura rotula o filtro de espécie como "Animal" e apresenta os campos de busca e de cidade apenas com texto de apoio dentro do campo.
**Depois:** o filtro de espécie é rotulado "Espécie", e **todos** os seis controles da barra recebem rótulo visível e associado. Os textos de apoio da captura são mantidos como textos de apoio, não como rótulos.

**Por quê:** "Animal" como rótulo de um seletor de espécies, numa tela em que cada cartão **é** um animal, é ativamente confuso, e o glossário do produto define o termo Espécie. É defeito da mesma classe que "Total: 1 animais", já corrigido pela feature anterior. Quanto aos rótulos, texto de apoio não é rótulo: ele desaparece assim que o usuário digita e não é anunciado de forma confiável por tecnologia assistiva. O projeto tem histórico de divergir deliberadamente do que foi construído por razão de acessibilidade — as divergências de contraste WCAG já documentadas na configuração de estilos e nos layouts são o precedente.

---

**Decisão 19 — Sem cache sobre a resposta da vitrine**

**Antes:** não havia definição.
**Depois:** não há camada de cache entre o banco e a resposta, e a resposta não é armazenável por intermediários.

**Por quê:** um animal que passa a Adotado precisa desaparecer da vitrine na consulta seguinte. Um cache aqui exibiria animais já adotados a novos interessados — o pior defeito possível nesta tela, porque produz contato humano frustrado e desgasta a operação. As imagens, que são objetos estáticos servidos pelo armazenamento, seguem o comportamento normal de cache do navegador; a decisão vale para a resposta de dados.

---

**Decisão 20 — Nenhuma dependência nova, no backend nem no frontend**

**Antes:** o frontend tem exatamente três dependências de execução e o backend não possui biblioteca de busca, de datas ou de componentes.
**Depois:** **zero** dependências novas.

**Por quê:** cartão, grade, etiqueta, esqueleto de carregamento e paginação são construíveis com os recursos já presentes; a remoção de marcas diacríticas é obtida com a normalização de texto já disponível na plataforma; e a cadeia de parâmetros usa o utilitário padrão do navegador. Adotar biblioteca de componentes, de estado de servidor, de formulário ou de datas seria decisão de arquitetura de porte próprio, e esta spec **não** a toma — pelo mesmo raciocínio já registrado pela FEATURE-002 deste módulo ao recusar biblioteca de formulário.

---

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Árvore de rotas do frontend | Bloco de rota novo **fora** de `ProtectedRoute`, `RoleRoute` e `PublicOnlyRoute`, antes do catch-all global; caminho novo em `ROUTE_PATHS` |
| Layouts do frontend | Layout público novo; item de navegação acrescentado ao `ClientLayout` — arquivo coberto por testes |
| Componentes de interface | Novos: cartão, grade, etiqueta, estado vazio, imagem com marcador substituto, esqueleto e cabeçalho público. Reaproveitados da FEATURE-002 deste módulo: campo de seleção, paginação, campo de texto |
| Serviços de API do frontend | Arquivo novo para o catálogo. **O cliente HTTP compartilhado não é alterado** |
| Backend | Domínio novo de catálogo público, com rotas que deliberadamente **não** montam autenticação nem verificação de permissão; montador público separado do administrativo; limitação de taxa aplicada |
| Contrato de API | Três endpoints públicos novos. **Nenhum código de erro novo.** Nenhum endpoint existente é alterado |
| Banco de dados | Duas colunas novas (`animals.name_search` e `cities.name_search`) e um índice composto em `animals`. Migração preenche os registros existentes. Nenhuma coluna existente é alterada ou removida |
| Caminho de escrita de animal | Passa a gravar também a coluna de busca. **Única alteração em código entregue pela FEATURE-002 deste módulo**, com item de regressão próprio |
| Casos de teste | 134 casos, entre eles os de fronteira de aniversário, 29 de fevereiro, fuso horário, determinismo da paginação, conjunto exato de chaves da resposta pública e conteúdo do administrador com carga de script |
| Escopo diferido | Página de detalhe, demonstração de interesse, filtro por raça, campos internos na vitrine e otimização para mecanismos de busca — todos registrados com gancho e condição de entrada |

**Seções da spec atualizadas:** documento inaugural — todas as seções foram criadas nesta versão.

---

### ALT-002 — Correção de qualidade na spec (iteração 1)

**Data:** 2026-08-25
**Solicitado por:** Validação automatizada de qualidade
**Realizado por:** Makuco Specify Agent
**Aprovado por:** _A preencher_

**O que mudou:**
Cinco defeitos encontrados na primeira passagem de validação de qualidade, todos sob o item "Requirements are testable and unambiguous" do checklist. Quatro são referências cruzadas apontando para a regra errada na tabela de divergências entre a captura e as convenções em vigor; o quinto é uma omissão de relação com regra herdada.

**Antes:**

| # | Defeito detectado |
|---|---|
| 1 | Divergência #3 (rótulo "Animal" → "Espécie") apontava para RN-24, que trata de busca por conteúdo em qualquer posição |
| 2 | Divergência #4 (etiqueta de idade) apontava para RN-36, que trata de reposição de página ao alterar filtro |
| 3 | Divergência #5 (rótulos visíveis e associados) apontava para RN-49, que trata de valores inválidos vindos do endereço |
| 4 | Divergência #6 (natureza do campo Cidade) apontava para RN-25 e RN-26, que tratam de busca como sequência única e de normalização de espaços |
| 5 | A RN-38 introduzia a idade em meses **sem declarar** a sua relação com a RN-20 da FEATURE-002 deste módulo, que define a idade apenas em anos completos |

**Depois:**

| # | Correção aplicada |
|---|---|
| 1 | Passa a apontar para "Requisitos Funcionais" e para a Decisão 18 desta entrada — a decisão do rótulo não é uma RN, é uma decisão de interface |
| 2 | Passa a apontar para RN-38 e RN-39, que de fato definem a apresentação da idade e o caso sem data de nascimento |
| 3 | Passa a apontar para RNF-21 e CA-51, que são onde a exigência de rótulo visível e associado está de fato escrita e verificada |
| 4 | Passa a apontar para RN-28 e RN-29, que definem o filtro de cidade por igualdade exata e a sua distinção da busca livre |
| 5 | A RN-38 passa a declarar explicitamente que **estende de forma aditiva** a RN-20 daquela spec: a idade em anos continua existindo com exatamente o mesmo significado, e a idade em meses é acrescentada para a apresentação pública |

**Por que mudou:**
Itens reprovados na validação de qualidade da spec (iteração 1). Os quatro primeiros são erros de ponteiro: uma referência cruzada errada faz o leitor procurar a justificativa de uma decisão na regra errada e concluir que a decisão não está justificada. O quinto é materialmente mais grave — sem a declaração de aditividade, a RN-38 podia ser lida como **substituição** de uma regra congelada por outra spec, e uma implementação que a lesse assim poderia remover a idade em anos da representação administrativa do animal, quebrando a FEATURE-002 deste módulo.

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Referências e Insumos — tabela de divergências | Quatro linhas corrigidas; nenhuma decisão de produto foi alterada |
| Regras de Negócio — RN-38 | Ganha a declaração de aditividade em relação à RN-20 da FEATURE-002 deste módulo. O comportamento especificado **não** mudou |
| Contrato de API | Nenhum. `ageInYears` e `ageInMonths` já estavam ambos definidos na projeção pública |
| Casos de teste e critérios de aceite | Nenhum. CT-64 a CT-68, CA-24 e CA-25 já cobriam o comportamento corretamente |

**Seções da spec atualizadas:** Grupo 2 — Referências e Insumos (tabela de divergências entre a captura e as convenções em vigor); Grupo 3 — Regras de Negócio (RN-38).

---

> Adicione novas entradas seguindo o mesmo padrão. Nunca edite ou remova entradas anteriores.
