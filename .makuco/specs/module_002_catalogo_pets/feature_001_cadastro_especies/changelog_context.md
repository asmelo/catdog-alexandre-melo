# Alterações da Feature — RF-001 Cadastro de Espécies (área administrativa)

> **Como preencher:** registre aqui toda alteração realizada após a aprovação inicial da spec. Cada entrada deve descrever o que mudou, por que mudou e quem autorizou. Não edite entradas anteriores — apenas adicione novas.
> **Caminho:** `02-systems/{sistema}/specs/{modulo}/{feature}/changelog.md`

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
Nada em relação a uma versão anterior — esta é a spec inaugural da feature. A entrada existe para registrar as decisões tomadas na ausência do responsável do produto, todas em pontos onde a captura de tela usada como fonte da verdade divergia do estado implementado do sistema ou era omissa.

**Decisão 1 — Endereço da tela: `/admin/especies` e não `/admin/species`**

**Antes:** a captura de tela mostra a aplicação em `localhost:3000/admin/species`.
**Depois:** a spec adota `/admin/especies`.
**Por quê:** todos os caminhos de interface já definidos no produto estão em PT-BR (`/cadastro`, `/minha-area`, `/confirmar-email`, `/verifique-seu-email`), e o arquivo que os concentra declara explicitamente que a URL é interface visível ao usuário e por isso está em PT-BR de propósito. Manter `/admin/species` criaria a única exceção em inglês do conjunto.

**Decisão 2 — Caminho da API em inglês: `/api/species`**

**Antes:** não havia definição.
**Depois:** as rotas da API usam `/api/species`, enquanto as rotas da interface usam `/admin/especies`.
**Por quê:** a separação já existe no produto — a interface usa `/cadastro` enquanto a API correspondente é `/api/auth/register`. A spec apenas torna a convenção explícita em vez de inventar uma terceira.

**Decisão 3 — Verbo de renomeação: `PATCH` e não `PUT`**

**Antes:** não havia definição.
**Depois:** a renomeação usa `PATCH /api/species/:id`.
**Por quê:** o nome é o único atributo mutável do recurso, o que caracteriza alteração parcial; e a configuração de CORS em vigor no backend não libera o verbo `PUT`, de modo que adotá-lo exigiria alterar uma decisão transversal fora do escopo desta feature.

**Decisão 4 — Navegação administrativa: lateral, com "Animais" e "Espécies", sem "Painel"**

**Antes:** a área administrativa implementada tem uma barra horizontal no topo com um único item de navegação, "Painel", que aponta para a home administrativa em `/admin` — destino do redirecionamento por role após o login.
**Depois:** a navegação passa a ser lateral e exibe exatamente dois itens, "Animais" e "Espécies", conforme a captura. O item "Painel" é aposentado da navegação e o endereço `/admin` passa a redirecionar para a primeira área administrativa disponível — enquanto a feature de animais não existir, para a tela de espécies.
**Por quê:** a captura é a fonte da verdade do layout desta feature e mostra sem ambiguidade uma navegação lateral com dois itens e nenhum item "Painel". O redirecionamento de `/admin` é a forma de adotar a captura sem quebrar o redirecionamento pós-login por role entregue pela FEATURE-002, que continua apontando para `/admin`.

**Decisão 5 — Unicidade insensível a caixa e sensível a acentos**

**Antes:** o contrato da feature exigia nome único de forma insensível a maiúsculas e minúsculas, sem se pronunciar sobre acentos.
**Depois:** RN-04 e RN-05 — a comparação ignora maiúsculas, minúsculas e diferenças de espaçamento, mas **é sensível a acentos**: "Réptil" e "Reptil" podem coexistir.
**Por quê:** tornar a regra também insensível a acentos exigiria depender da configuração de collation do banco ou de uma extensão do PostgreSQL, o que faria o comportamento variar por ambiente e deixaria a regra não verificável por teste determinístico. Sensibilidade a acentos é o comportamento previsível, e o risco real de duplicata no domínio é de caixa, não de acentuação.

**Decisão 6 — Unicidade implementada por coluna normalizada persistida**

**Antes:** não havia definição.
**Depois:** o modelo declara uma coluna `name_normalized` com restrição de unicidade, preenchida pela aplicação com o nome em minúsculas e com espaços já colapsados. A coluna não é exposta pela API.
**Por quê:** o ORM em uso não declara índice sobre expressão no próprio schema, então um índice funcional sobre `lower(name)` viveria apenas no arquivo de migration e ficaria invisível para quem lê o modelo — exatamente a regra que mais importa nesta feature. A coluna persistida mantém a regra visível no schema e dispensa extensão do banco.

**Decisão 7 — Sem limitador de taxa nos endpoints da feature**

**Antes:** não havia definição.
**Depois:** os quatro endpoints não recebem limitador de taxa.
**Por quê:** os limitadores existentes protegem endpoints de credencial contra força bruta e contra uso do servidor como ferramenta de spam. Nenhum dos dois riscos se aplica a um CRUD administrativo autenticado, de baixo volume e sem envio de e-mail. Limitar aqui penalizaria o administrador que cadastra várias espécies em sequência.

**Decisão 8 — Envelope de coleção `{ items: [...] }`**

**Antes:** o projeto não possui nenhum endpoint de coleção — não há precedente de listagem a copiar.
**Depois:** a listagem responde `{ items: [...] }`, que passa a ser o padrão de coleção do projeto.
**Por quê:** um array puro não admite metadados sem quebrar quem já o consome. O envelope escolhido não usa a chave `data`, que não existe em nenhum ponto do contrato atual — todas as respostas de sucesso hoje são objetos planos.

**Decisão 9 — Exclusão bloqueada em duas camadas, nunca em cascata**

**Antes:** o contrato da feature exigia bloquear a exclusão de espécie com animais vinculados, com erro explícito e sem cascata.
**Depois:** RN-08 e RN-09 — a verificação acontece no servidor, dentro da mesma transação da exclusão, **e** é reforçada pela integridade referencial do banco, com a chave estrangeira de animal para espécie declarada como restritiva. As duas camadas são obrigatórias.
**Por quê:** a verificação da aplicação existe para produzir a mensagem correta em PT-BR; a restrição do banco existe para que uma falha de código não consiga produzir um animal sem espécie. Uma camada só não cobre o outro risco. A spec registra ainda que a feature seguinte do módulo **não** pode declarar esse vínculo em cascata nem com anulação — os dois desfechos são explicitamente proibidos.

**Impacto:**

| Área impactada | Descrição do impacto |
|---|---|
| Rotas da interface | Novo caminho `/admin/especies`; `/admin` passa a redirecionar em vez de renderizar a home administrativa |
| Layout administrativo | Navegação migra de barra horizontal com um item para navegação lateral com dois itens; item "Painel" aposentado |
| FEATURE-002 — Autenticação | O redirecionamento pós-login por role continua apontando para `/admin`, cujo comportamento muda. Regressão obrigatória nos cenários de redirecionamento por role |
| Contrato da API | Quatro endpoints novos e cinco códigos de erro novos: `SPECIES_NAME_ALREADY_EXISTS`, `SPECIES_NOT_FOUND`, `SPECIES_IN_USE`, além do uso inaugural de `FORBIDDEN` por rota de negócio. O envelope de erro não muda |
| Banco de dados | Nova tabela de espécies com coluna normalizada e restrição de unicidade. Nenhuma tabela existente é alterada |
| Feature seguinte (Cadastro de pets) | Fica vinculada por contrato: o vínculo de animal com espécie deve ser restritivo, nunca em cascata nem com anulação |
| Componentes de interface | Lista, confirmação de ação destrutiva e aviso de sucesso passam a existir na base compartilhada |

**Seções da spec atualizadas:** documento inteiro — spec inaugural da feature.

---

> Adicione novas entradas seguindo o mesmo padrão. Nunca edite ou remova entradas anteriores.
