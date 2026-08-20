# Makuco

O Makuco é um framework para desenvolvimento assistido por IA, projetado para facilitar fases de especificação, planejamento e codificação, focando em qualidade das entregas.

## MAKUCO.md

O arquivo `./MAKUCO.md` é onde ficaram as instruções principais, informações, arquitetura e regras do projeto, para que os agentes do Makuco possam aprender e se adaptar ao projeto, garantindo que as entregas estejam alinhadas com os padrões do projeto e atendam às necessidades do projeto.

## Estrutura [makuco](./makuco)

- **resources**: Pasta destinada a armazenar arquivos de recursos que os agentes podem utilizar para aprender e se adaptar ao projeto.
    Esses arquivos podem conter informações sobre padrões de código, melhores práticas, convenções de nomenclatura, arquitetura do projeto, estrutura de pastas,
    exemplos de código e qualquer outro conhecimento relevante que possa ajudar os agentes a gerar código alinhado com os padrões do projeto.
- **templates**: Pasta com templates para que os agentes possam gerar arquivos seguindo um formato pré-definido, garantindo consistência e aderência às melhores práticas do projeto.
- **scripts**: Pasta com scripts de automação.

## Agentes

- **Makuco Codegen**: Agente responsável por receber um plano de execução detalhado e gerar código seguindo o plano, buscando por melhores práticas e padrões de código do projeto.
- **Makuco Specify**: Agente responsável por receber uma tarefa geral e criar um plano de execução detalhado.
- **Makuco Prompt**: Agente responsável por receber uma tarefa e criar prompts detalhados para cada passo do plano de execução.

## Unidades

Temos configurações específicas com arquivos por unidade, para que os agentes possam adaptar suas entregas e se especializar de acordo com as necessidades de cada unidade.

## Configuração Makuco (MCP e SonarQube)

**Requisitos**:

- Chave SSH para acesso ao repositório do MCP.

1. Acesse o arquivo `mcp.json` e configure as credenciais:
    - `SONAR_URL`: URL do SonarQube utilizado para análise de código
    - *Atenção*: o Sonar é chamado via API, então é necessário garantir que a URL esteja correta e acessível para que as análises de código possam ser realizadas com sucesso. Ex: `https://sonar.lughy.com.br`
    - `SONAR_TOKEN`: Token do tipo `User Token  para acessar o SonarQube
    - *Atenção*: o token é utilizado para autenticar as requisições feitas para a API do SonarQube, garantindo que apenas usuários autorizados possam acessar as informações e funcionalidades do SonarQube. Certifique-se de utilizar um token válido e com as permissões adequadas para garantir o funcionamento correto das análises de código.

2. É necessário que seu projeto tenha um arquivo `sonar-project.properties` configurado corretamente para que as análises de código possam ser realizadas com sucesso. Certifique-se de configurar esse arquivo de acordo com as necessidades do seu projeto e as diretrizes do SonarQube.

## Como utilizar?

1. Se desejar adicione recursos em `./makuco/resources` para que os agentes possam aprender e se adaptar ao seu projeto.
2. Selecione o agente `makuco-specify` na sua IA generativa.
    - Você pode solicitar via chat o requisito, ou, criar um arquivo explicando a tarefa geral e colocando o caminho do arquivo no campo de input de dados do agente.
    - Você deve especificar a tarefa de forma clara e detalhada, com informações como, o que deve ser feito, qual é o objetivo, quais são as restrições, qual é o contexto do projeto, e qualquer outra informação relevante.
    - O agente irá criar os requisitos[./makuco/specs/]
3. Selecione o agente `makuco-prompt` para criar os prompts detalhados para cada passo do plano de execução.
    - Referencie a especificação criada pelo agente `makuco-specify` para criar os prompts.
    - Solicite a criação do planejamento.
4. Selecione o agente `makuco-codegen` para gerar o código.
    - Referencie uma parte por vez do planejamento gerado em `makuco-prompt` para gerar o código.

## Boas práticas

- Forneça o máximo de detalhes possível ao criar a tarefa geral para o agente `makuco-specify`, para que ele possa criar um plano de execução detalhado e alinhado com as necessidades do projeto.
- Revise os requisitos criados pelo agente `makuco-specify` e faça ajustes, se necessário, para garantir que eles estejam claros, completos e alinhados com as necessidades do projeto.
- Utilize um chat para cada planejamento gerado pelo agente `makuco-prompt`, para garantir uma janela de contexto adequada para a geração de código pelo agente `makuco-codegen`.
- Se você estiver utilizando o Copilot, após cada geração de código, crie um chat novo, apague o antigo e de um reload no VSCode.
    - O VSCode utiliza a memória em cache para o Copilot, e isso pode fazer com que ele perca o contexto do projeto e gere códigos desalinhados com os padrões do projeto. Criar um chat novo e dar reload no VSCode ajuda a limpar essa memória em cache e garantir que o Copilot utilize o contexto atualizado do projeto para gerar códigos alinhados com os padrões do projeto.

## Workflow Recomendado - Spec-Driven Development

1. Crie uma tarefa geral clara e detalhada para o agente `makuco-specify`.
    - Podendo ser em um arquivo .md ou diretamente no campo de input de dados do agente.
2. O agente `makuco-specify` cria um plano de execução detalhado, dividido em etapas e subetapas, para atender à tarefa geral.
    - Revise os requisitos criados, essa parte é fundamental para garantir que o plano de execução esteja alinhado com as necessidades do projeto.
    - A especificação é peça fundamental para garantir a qualidade das entregas, pois é a partir dela que os outros agentes irão trabalhar.
3. Referencie a especificação criada pelo agente `makuco-specify` para o agente `makuco-prompt`, para criar os prompts detalhados para cada passo do plano de execução.
4. Para cada passo do plano de execução, referencie o prompt criado pelo agente `makuco-prompt` para o agente `makuco-codegen`, para gerar o código.
5. Revise o código gerado, teste e valide se ele atende aos requisitos definidos na especificação criada pelo agente `makuco-specify`.
6. Caso haja falhas na validação, corrija os requisitos na especificação criada pelo agente `makuco-specify`, e repita o processo de geração de prompts e código até que todas as etapas do plano de execução sejam concluídas com sucesso.
