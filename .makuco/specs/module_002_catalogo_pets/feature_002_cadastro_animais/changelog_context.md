# Alterações da Feature — RF-002 Cadastro de Animais (área administrativa)

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
Nada em relação a uma versão anterior — esta é a spec inaugural da feature. A entrada registra as decisões tomadas na ausência do responsável do produto, em pontos onde as capturas de tela usadas como fonte da verdade eram omissas, divergiam das convenções em vigor ou divergiam do escopo aprovado do produto.

---

**Decisão 1 — Endereços da interface em PT-BR**

**Antes:** as capturas mostram a aplicação em `/admin/animals` e `/admin/animals/:id/edit`.
**Depois:** a spec adota `/admin/animais`, `/admin/animais/novo` e `/admin/animais/:id/editar`.
**Por quê:** todos os caminhos de interface do produto estão em PT-BR, e a FEATURE-001 deste módulo já resolveu a mesma divergência da mesma forma ao adotar `/admin/especies` em vez de `/admin/species`. Manter o inglês criaria a única exceção do conjunto. As rotas de API seguem em inglês (`/api/animals`), como a convenção já separada exige.

---

**Decisão 2 — `PATCH` em vez de `PUT`, e token de concorrência no corpo em vez de cabeçalho**

**Antes:** não havia definição.
**Depois:** a edição usa `PATCH /api/animals/:id` e a alteração de status usa `PATCH /api/animals/:id/status`; o token de bloqueio otimista viaja como campo do corpo, e não no cabeçalho `If-Match`.
**Por quê:** a configuração de CORS em vigor não libera o verbo `PUT` e libera apenas os cabeçalhos `Content-Type` e `Authorization`. Tanto `PUT` quanto `If-Match` exigiriam alterar uma decisão transversal fora do escopo desta feature. É o mesmo raciocínio já registrado na FEATURE-001 deste módulo.

---

**Decisão 3 — Estados e cidades vêm de tabela própria semeada, e não do IBGE em tempo de execução**

**Antes:** o encadeamento estado → cidade observado nas capturas sugeria consumo direto do serviço de dados abertos do IBGE.
**Depois:** tabelas `states` e `cities` no próprio banco, semeadas a partir de um recorte oficial do IBGE embarcado no repositório, servidas por `GET /api/states` e `GET /api/states/:uf/cities`.

**Alternativas descartadas:**

| Alternativa | Motivo da recusa |
|---|---|
| Frontend consultando o IBGE diretamente | Deixaria o servidor sem fonte para validar a cidade recebida, contrariando a exigência de validação de servidor para todos os campos; colocaria um terceiro no caminho crítico do formulário; introduziria a primeira URL externa do frontend, que hoje só conhece a própria API |
| Backend intermediando o IBGE, com cache | Introduziria a primeira chamada HTTP de saída do backend, que hoje não possui cliente HTTP, URL base configurável, tempo limite nem política de nova tentativa. Criaria um modo de falha novo — IBGE fora do ar impedindo o cadastro de animal — para obter um dado que quase nunca muda |
| Cidade e estado como texto livre | Reintroduziria exatamente o problema que a FEATURE-001 deste módulo resolveu para espécies: variações de grafia da mesma cidade quebrando qualquer filtro por localização |

**Consequências aceitas:** o recorte precisa ser atualizado manualmente quando houver mudança na divisão municipal brasileira, o que é raro e depende de lei; a carga inicial acrescenta 27 estados e cerca de 5.600 municípios, volume irrelevante para o banco. Em troca, a validação é local, os testes são determinísticos e o formulário funciona sem rede externa.

**Decisão acessória:** o estado **não trafega** para o servidor junto com o animal. Apenas a cidade é enviada, e o estado é derivado dela. Isso torna o par cidade/estado incoerente — o clássico "Campo Magro - ES" — **impossível de representar** no contrato, em vez de um erro a validar.

---

**Decisão 4 — Imagens no armazenamento de objetos do Supabase, enviadas através da API**

**Antes:** não havia definição. O banco é Supabase e os schemas de armazenamento existem, mas nenhum ponto do código os usa.
**Depois:** balde dedicado no armazenamento de objetos do Supabase, com leitura pública e escrita restrita à credencial de serviço, mantida apenas no servidor. O navegador envia os arquivos para a API, que valida e só então grava.

**Alternativas descartadas:**

| Alternativa | Motivo da recusa |
|---|---|
| Sistema de arquivos do contêiner | A hospedagem prevista tem disco efêmero: as fotos desapareceriam a cada implantação e reinício, e o defeito só apareceria depois do primeiro deploy |
| Bytes da imagem em coluna do PostgreSQL | Cinco imagens de até 5 MB por animal consumiriam a cota do banco em poucas dezenas de cadastros; toda leitura passaria pela aplicação e pelo agrupador de conexões; cada cópia de segurança carregaria os binários junto |
| Serviço de armazenamento ou CDN contratado à parte | O produto não contrata serviço pago para esta feature |
| Envio direto do navegador com URL assinada | Tiraria a validação de formato e tamanho do controle do servidor — exatamente a garantia que a spec exige — e exigiria entregar credencial de envio ao cliente |

**Consequência reconhecida:** esta é a **primeira chamada HTTP de saída do backend**, o mesmo custo que levou a Decisão 3 a recusar o IBGE. A diferença que justifica o tratamento distinto é o caminho: o armazenamento só é acionado nas escritas de animal, feitas por um administrador que pode repetir a tentativa, enquanto o IBGE estaria no caminho de leitura de toda abertura de formulário. E, para imagens, alguma dependência externa é inescapável — o disco local não serve. A integração é isolada atrás de uma porta própria, no mesmo formato já usado pelo envio de e-mail.

**Validação no servidor, deliberadamente redundante com o navegador:** limite de cinco imagens sobre o **estado final** do animal, formato apurado por **assinatura binária** e não por extensão ou tipo declarado, tamanho de 1 byte a 5 MB por arquivo e limite de tamanho total do corpo. O SVG é barrado nominalmente: aceito e servido de um balde de leitura pública, executaria script no navegador de quem o abrisse. O caminho do objeto é sempre gerado pela aplicação, nunca derivado do nome do arquivo enviado.

---

**Decisão 5 — Porte, sexo e status como enumerações, não como tabelas de apoio**

**Antes:** não havia definição.
**Depois:** enumerações no banco, no padrão já usado por `UserRole` e `UserStatus`, com literais em PT-BR sem acento (`PEQUENO`/`MEDIO`/`GRANDE`, `MACHO`/`FEMEA`, `DISPONIVEL`/`RESERVADO`/`ADOTADO`/`INDISPONIVEL`), seguindo o precedente de `CLIENTE`. Os rótulos acentuados exibidos ao administrador vivem na interface, e o contrato da API trafega os valores em minúsculas, como já faz `role`.
**Por quê:** espécie ganhou tela e tabela próprias porque é uma lista **que o administrador mantém**. Porte, sexo e status não são: são conjuntos fechados definidos pelo domínio, que só mudam por decisão de produto acompanhada de mudança de comportamento. A própria navegação lateral das capturas é a evidência — tem "Animais" e "Espécies", e não "Portes" ou "Sexos". Descartado incluir "não informado" em porte e sexo, porque ambos são obrigatórios e são critério de decisão do cliente na vitrine.

---

**Decisão 6 — Quatro status, sem espelhar as etapas do pedido, e com transições livres por ora**

**Antes:** as capturas mostram apenas o valor "Disponível".
**Depois:** quatro status — Disponível, Reservado, Adotado e Indisponível —, com o significado de negócio de cada um definido na RN-13. O animal nasce Disponível e o status **não** aparece no formulário: é alterado apenas pela listagem, por endpoint próprio.
**Por quê da separação do endpoint:** a alteração de status tem regra própria e conjunto de campos disjunto do restante do animal. Misturá-la ao `PATCH` genérico obrigaria um único tratador a validar duas gramáticas diferentes e a decidir, a cada requisição, qual se aplica.
**Por quê de não espelhar o pedido:** o módulo de pedidos define cinco etapas (Contato Inicial, Entrevista, Avaliação do espaço físico, Adaptação, Concluído). Duplicá-las dentro do animal criaria duas máquinas de estado com donos diferentes e garantiria divergência entre elas.

**Ponto em que esta spec divergiu da recomendação da análise de requisitos:** foi recomendado restringir as transições, proibindo em especial ir de Disponível direto para Adotado, para que nenhuma adoção acontecesse sem pedido registrado. A spec **adota transições livres por enquanto**, porque o módulo de pedidos não existe: nada coloca um animal em Reservado automaticamente, e a regra obrigaria o administrador a encenar uma reserva manual para registrar uma adoção real. Encenar estado é pior do que não travar. A restrição está registrada como pendência a reavaliar quando o módulo de pedidos existir.

---

**Decisão 7 — Idade derivada, jamais persistida**

**Antes:** o formulário coleta apenas data de nascimento, mas a vitrine exibe idade em anos e filtra por idade máxima.
**Depois:** a idade é calculada a cada resposta, em anos completos, a partir do relógio do servidor no fuso America/Sao_Paulo. Nenhuma coluna de idade existe. Sem data de nascimento, a idade é **ausente** — e ausente é diferente de zero: a interface exibe "Idade não informada" e a API devolve nulo.
**Por quê:** uma idade persistida envelheceria em silêncio e passaria a mentir sem que nada no sistema acusasse. O fuso é fixado porque, com o processo em UTC, às 22h em São Paulo já é o dia seguinte em UTC, e uma comparação ingênua recusaria a data de hoje como futura — defeito que só apareceria à noite, em produção.
**Decisão transportada para a feature de vitrine:** animal sem data de nascimento é **excluído** quando o filtro de idade máxima é aplicado, porque não é possível afirmar que satisfaz o critério. Registrado aqui para que não vire comportamento acidental lá.

---

**Decisão 8 — Paginação no servidor desde a primeira entrega**

**Antes:** a FEATURE-001 deste módulo dispensou paginação com o argumento de que espécies são dezenas de registros em tabela de apoio.
**Depois:** a listagem de animais é paginada no servidor, com página padrão de 20 e máxima de 100. O envelope `{ items: [...] }` é estendido **de forma aditiva** com `pagination`, sem alterar `items`. A interface só exibe controles de navegação quando o total excede o tamanho da página — por isso a captura, com um único animal, não os mostra e mesmo assim está em conformidade.
**Por quê:** o argumento da FEATURE-001 não se transfere. O animal é a entidade de maior volume do produto e cresce sem teto, e acrescentar paginação depois quebraria o contrato do endpoint e os testes que já o consomem. A ordenação recebeu desempate explícito por identificador, sem o qual dois animais cadastrados no mesmo instante poderiam trocar de posição entre páginas, fazendo um aparecer duas vezes e outro sumir.

---

**Decisão 9 — Bloqueio otimista na edição e na alteração de status**

**Antes:** não havia definição.
**Depois:** quem grava informa a marca de última alteração que leu, e a gravação é recusada com conflito explícito se o registro tiver mudado nesse meio-tempo.
**Por quê:** a situação não é hipotética. O mesmo animal é editável pelo formulário e alterável pela listagem ao mesmo tempo, em abas diferentes — é a configuração exata das capturas. Sem essa guarda, a última gravação apaga a anterior sem que ninguém perceba.

---

**Decisão 10 — Imagens em preparo até o "Salvar"**

**Antes:** não havia definição.
**Depois:** nada é gravado no armazenamento nem removido dele antes do acionamento de "Salvar". O "x" da miniatura marca a imagem para remoção; "Cancelar" descarta a marcação.
**Por quê:** a captura apresenta "Cancelar" como saída legítima do formulário. Um "Cancelar" que não desfizesse a remoção de uma foto seria uma armadilha para o administrador.

---

**Decisão 11 — Cascata permitida entre animal e imagem, proibida entre animal e espécie**

**Antes:** a FEATURE-001 deste módulo proibiu nominalmente `Cascade` e `SetNull`.
**Depois:** a proibição é mantida **integralmente** para o vínculo animal → espécie, que nasce restritivo. O vínculo animal → imagem, ao contrário, é declarado **em cascata**.
**Por quê:** a distinção é de propriedade. A espécie existe independentemente e sobrevive a qualquer animal, então apagá-la em cascata destruiria dado alheio. A imagem não tem existência própria fora do animal, e mantê-la produziria lixo permanente no balde. A distinção está escrita explicitamente na spec para que ninguém leia a proibição da FEATURE-001 como global.

---

**Decisão 12 — Concordância da contagem corrigida em relação à captura**

**Antes:** a captura exibe "Total: 1 animais".
**Depois:** "Nenhum animal cadastrado" para zero, "Total: 1 animal" para um e "Total: N animais" para dois ou mais.
**Por quê:** é defeito de concordância visível na própria fonte da verdade. Reproduzi-lo por fidelidade à captura seria entregar o defeito de propósito.

---

**Decisão 13 — Três elementos do escopo aprovado deliberadamente diferidos**

**Antes:** o escopo aprovado do produto descreve, para o cadastro de pets, o número do chip, o contato do proprietário e a raça. Nenhum dos três aparece nas capturas.
**Depois:** os três ficam **fora** desta entrega, registrados como escopo diferido com condição de entrada.

| Elemento | Por que não entra agora | Condição para entrar |
|---|---|---|
| Número do chip | Ausente das capturas, que são a fonte da verdade da entrega | Campo opcional, restrito ao administrador, nunca serializado em resposta pública |
| Contato do proprietário | Ausente das capturas e, com agravante, **dado pessoal de terceiro** sujeito à LGPD | Exige decisão prévia de base legal, prazo de retenção e visibilidade. Acrescentá-lo sem essa decisão criaria passivo de privacidade |
| Raça | Ausente das capturas e estruturalmente cara: como texto livre inutilizaria o filtro da vitrine; como lista controlada dependente de espécie, é uma feature do porte da FEATURE-001 inteira | Deve virar **feature candidata do módulo**, com spec própria |

**Por quê registrar em vez de omitir:** o escopo aprovado não pode ser descartado em silêncio. A captura prevalece na entrega, mas cada divergência precisa estar rastreável.

**Decisão acessória, e a mais importante das três:** o escopo aprovado exige separar claramente o que é público do que é restrito à gestão interna. Como as capturas não trazem nenhum campo interno, essa separação não seria exercitada por acidente. A spec determina que ela **nasça implementada** mesmo assim — respostas voltadas ao público são montadas por projeção explícita dos campos públicos, jamais serializando a entidade inteira (RN-59). É o que garante que chip e contato não vazem por padrão quando entrarem.

---

**Decisão 14 — Sem limitador de taxa, sem biblioteca de formulário, sem processamento de imagem**

**Antes:** não havia definição.
**Depois:** três não-escopos declarados.
- **Sem limitador de taxa** nos endpoints da feature, pelo mesmo motivo já registrado na FEATURE-001: os limitadores existentes protegem endpoints de credencial, e nenhum dos riscos se aplica a um CRUD administrativo autenticado. O consumo do envio de imagens já está contido pelos limites de quantidade, de tamanho por arquivo e de tamanho total do corpo. Revisável se o número de administradores crescer.
- **Sem biblioteca de formulário ou de validação por schema no frontend**, que hoje tem exatamente três dependências de execução. O padrão em vigor — função pura por formulário devolvendo mapa de erros por campo, no mesmo formato que a leitura do erro da API produz — é mantido. Adotar biblioteca seria decisão de arquitetura, e esta spec não a toma.
- **Sem redimensionamento, recorte, compressão ou geração de versões reduzidas** das imagens. Consequência aceita e registrada como limitação conhecida: fotos de celular que carregam a orientação apenas nos metadados podem aparecer deitadas.

---

**Decisão 15 — Pendência de integridade registrada para o módulo de pedidos, antes de ele existir**

**Antes:** nada estava escrito a respeito.
**Depois:** a spec registra que, quando o pedido existir, um animal referenciado por algum pedido não poderá ser excluído, e que o vínculo de pedido para animal deve nascer com integridade referencial **restritiva**, jamais em cascata.
**Por quê:** foi exatamente essa omissão que fez a FEATURE-001 deste módulo conviver com a sua regra mais importante verificável apenas por duplo de teste, e essa dívida está sendo quitada agora, por esta feature. Repetir o mesmo erro em silêncio, sabendo dele, seria pior do que cometê-lo pela primeira vez.

---

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Rotas da interface | Três caminhos novos: `/admin/animais`, `/admin/animais/novo` e `/admin/animais/:id/editar`. O item "Animais", entregue pela FEATURE-001 apontando para tela inexistente, passa a ter destino |
| Contrato da API | Oito endpoints novos e nove códigos de erro novos: `ANIMAL_NOT_FOUND`, `ANIMAL_STALE_UPDATE`, `ANIMAL_IMAGE_LIMIT_EXCEEDED`, `ANIMAL_IMAGE_TOO_LARGE`, `ANIMAL_IMAGE_TYPE_NOT_ALLOWED`, `REQUEST_BODY_TOO_LARGE`, `IMAGE_STORAGE_UNAVAILABLE`, `CITY_NOT_FOUND` e `STATE_NOT_FOUND`. O envelope de erro não muda. O envelope de coleção ganha `pagination` de forma aditiva |
| Códigos de estado HTTP | O catálogo do backend, deliberadamente curto, passa a incluir 413 e 415, que hoje não existem |
| Leitor de corpo da API | A aplicação hoje só lê JSON, com teto de 10 KB. Passa a ler `multipart/form-data` nas rotas de animal, com limites próprios. As demais rotas permanecem como estão |
| Verificação de permissão por role | O verificador existe e está testado, mas nenhuma rota o monta. Esta feature e a FEATURE-001 são as primeiras a montá-lo |
| Configuração por ambiente | Variáveis novas do armazenamento de objetos, no único ponto do backend que lê o ambiente, com validação que derruba a inicialização se ausentes, replicadas no arquivo de exemplo |
| Saída de rede do backend | Segunda porta de saída, ao lado do envio de e-mail — a primeira sobre HTTP |
| Dependências novas | Backend: leitura de multipart, detecção de tipo por assinatura binária e cliente do Supabase. Frontend: nenhuma |
| Cliente HTTP do frontend | Hoje converte todo corpo em JSON e sempre define o cabeçalho de tipo de conteúdo. Precisa aceitar formulário com arquivos. **É o ponto de maior risco da entrega**, por abrigar a fila de renovação de sessão |
| Componentes de interface | São novos: tabela, campo de seleção, área de texto, alternância, envio de imagens com pré-visualização, seletor de data, selo de status e paginação. Lista, confirmação e aviso de sucesso vêm da FEATURE-001 |
| Banco de dados | Três enumerações e quatro tabelas novas — `states`, `cities`, `animals` e `animal_images` —, mais carga inicial idempotente de estados e municípios. Nenhuma coluna existente é alterada |
| FEATURE-001 do MODULE-002 — Cadastro de Espécies | A relação inversa deixada comentada no modelo de espécie é ativada, e a pendência de regressão herdada (CT-24, CT-25, CT-26 e CT-32 verificados apenas por duplo de teste) é **quitada** com reexecução contra dados reais. É condição de conclusão desta feature |
| FEATURE-002 do MODULE-001 — Autenticação | Alterações no leitor de corpo da API e no cliente HTTP do frontend exigem regressão completa do fluxo de sessão |
| Módulo de pedidos (futuro) | Fica vinculado por contrato: vínculo de pedido para animal restritivo, nunca em cascata |
| Feature de vitrine (futura) | Fica vinculada por duas restrições: respostas públicas montadas por projeção explícita de campos, e exclusão dos animais sem data de nascimento quando o filtro de idade máxima é aplicado |

**Seções da spec atualizadas:** documento inteiro — spec inaugural da feature.

---

### ALT-002 — Correção de qualidade na spec (iteração 1)

**Data:** 2026-08-25
**Solicitado por:** Validação automatizada de qualidade
**Realizado por:** Makuco Specify Agent
**Aprovado por:** _A preencher_

**O que mudou:**
Três defeitos detectados na validação da spec contra o checklist de qualidade foram corrigidos. Nenhuma decisão de negócio foi alterada — as correções são de precisão e de rastreabilidade.

**Antes:** o CT-49 misturava, em uma única linha, duas aritméticas contraditórias do limite de imagens, tornando o resultado esperado impossível de interpretar. A mesma aritmética errada aparecia na RN-50 e no cenário 13 da HU-05, ambos afirmando que remover duas de cinco imagens e acrescentar três seria aceito — o que resultaria em seis imagens, acima do limite de cinco.
**Depois:** o CT-49 foi dividido em CT-49a (estado final de 6, recusado) e CT-49b (estado final de 5, aceito); a RN-50 e o cenário 13 da HU-05 foram reescritos com a aritmética correta; o CT-48 recebeu o estado final explícito no enunciado.

**Antes:** a RN-60 (indicador de pendência de foto) e a RN-56 (cidade gravada ausente da lista ativa) possuíam caso de teste, mas nenhum critério de aceite, ficando fora da lista de verificação de conclusão da feature.
**Depois:** acrescentados o CA-46 e o CA-47.

**Por que mudou:**
Itens reprovados na validação de qualidade da spec (iteração 1): "Requirements are testable and unambiguous" e "All functional requirements have clear acceptance criteria".

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Regras de Negócio / RN-50 | Enunciado do limite de imagens sobre o estado final corrigido, com os dois exemplos aritmeticamente coerentes |
| Histórias de Usuário / HU-05 | Cenário 13 reescrito |
| Casos de Teste / CT-48, CT-49 | CT-49 dividido em CT-49a e CT-49b; CT-48 com estado final explícito; bloco de correção redundante removido da seção |
| Critérios de Aceite | Dois critérios novos, CA-46 e CA-47, fechando a rastreabilidade das RN-60 e RN-56 |

**Seções da spec atualizadas:** Regras de Negócio, Histórias de Usuário (HU-05), Casos de Teste, Critérios de Aceite.

---

> Adicione novas entradas seguindo o mesmo padrão. Nunca edite ou remova entradas anteriores.
