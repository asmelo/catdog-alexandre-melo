import type {
  AnimalImage,
  AnimalSex,
  AnimalSize,
  AnimalStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

/**
 * Porta de acesso a `animals`. Como nos repositorios dos dominios auth, species
 * e geography, os services dependem da INTERFACE e nao do Prisma — e o que
 * permite um duble em memoria nos testes da TASK-BACKEND-011 sem simular o
 * client inteiro.
 *
 * O repositorio NAO lanca erro HTTP: ausencia e `null`, e quem decide se `null`
 * e um problema e o service.
 *
 * A TASK-BACKEND-007 acrescentou a CRIACAO (`create` e `createImages`) e a
 * TASK-BACKEND-008 acrescentou a EDICAO (`updateIfUnchanged`, `deleteImagesByIds`
 * e `updateImagePosition`); a TASK-BACKEND-009 acrescentou a ALTERACAO DE STATUS
 * (`updateStatusIfUnchanged`) e a EXCLUSAO (`deleteById`).
 */

/**
 * Relacoes SEMPRE carregadas junto com o animal, porque a representacao do
 * contrato precisa das tres: `species` (id e nome), `city` com o seu `state`
 * (para derivar `stateUf`) e `images`.
 *
 * A CIDADE VEM PELO VINCULO, e isso nao e detalhe: nome de municipio se REPETE
 * entre unidades federativas — "Boa Esperança" existe em ES (IBGE 3201001), MG
 * (3107109) e PR (4103008), entre os 5.571 carregados. Qualquer resolucao por
 * nome atravessaria as fronteiras de UF e exibiria a sigla errada; o `include`
 * segue a chave estrangeira e so pode trazer o estado daquela cidade.
 *
 * `images` ja sai ORDENADO POR `position` do banco (RN-35): a capa e a posicao
 * `0`, e o indice `@@index([animalId, position])` do schema e exatamente este
 * par. Ordenar em memoria duplicaria a regra num segundo lugar.
 *
 * `as const` e obrigatorio, e nao estilo: sem ele o `species: true` alargaria
 * para `boolean` e o `AnimalGetPayload` abaixo deixaria de saber que as relacoes
 * estao presentes, devolvendo um tipo sem elas.
 */
const INCLUIR_RELACOES = {
  species: true,
  city: { include: { state: true } },
  images: { orderBy: { position: 'asc' } },
} as const;

/**
 * A linha de `animals` com as tres relacoes resolvidas. E o tipo que o mapper
 * consome — e o UNICO tipo de animal que sai deste arquivo, para que nenhum
 * chamador receba um animal sem `city.state` e descubra isso em producao.
 */
export type AnimalWithRelations = Prisma.AnimalGetPayload<{
  include: typeof INCLUIR_RELACOES;
}>;

/**
 * RN-41, os TRES criterios, nesta ordem exata.
 *
 * 1. `nameNormalized asc` — alfabetica ignorando a caixa. A coluna ja esta em
 *    minusculas, entao a comparacao nao depende de `mode: 'insensitive'`.
 *
 *    A ORDEM E A DO BANCO e ela ja e a correta: medido neste projeto — Postgres
 *    17.6, provider ICU, `en_US.UTF-8` —, o `ORDER BY` e por LOCALE e nao
 *    binario, entao devolve `Ágil, Cão, Cavalo, Gato, Zebra`. Nenhum `sort` em
 *    memoria deve ser acrescentado sobre este retorno: um `sort()` sem
 *    `localeCompare` reintroduziria a ordenacao binaria, que daria
 *    `Cavalo, Cão, Gato, Zebra, Ágil` — todos os nomes acentuados depois do `Z`.
 *
 * 2. `createdAt desc` — empate de nome resolvido pelo cadastro mais recente.
 *
 * 3. `id asc` — DESEMPATE FINAL OBRIGATORIO, e o mais importante dos tres.
 *    Sem um criterio que nunca empata, dois animais cadastrados no mesmo
 *    instante podem trocar de posicao entre uma consulta e a seguinte, e o
 *    percurso das paginas passa a exibir um registro duas vezes enquanto outro
 *    desaparece (RNF-08, CT-26). O defeito nao aparece em cadastro pequeno nem
 *    em teste de uma pagina so.
 *
 * O trio casa PARCIALMENTE com o indice `@@index([nameNormalized, createdAt, id])`
 * do schema, e a ressalva importa: o indice e todo ASC e o segundo criterio aqui
 * e `createdAt DESC`, entao ele nao entrega a ordem final pronta. O plano real,
 * verificado por `EXPLAIN` neste banco, e `Incremental Sort`
 * (`Presorted Key: name_normalized`) sobre `Index Only Scan` — o indice presorta
 * pelo primeiro criterio e apenas o desempate DENTRO de cada nome e ordenado por
 * cima. Sem impacto pratico: os grupos por nome sao minusculos, e a ordenacao
 * incremental nunca precisa materializar a tabela inteira.
 *
 * ATENCAO — `nameNormalized` de ANIMAL nao e a mesma coisa que o de ESPECIE,
 * apesar do nome igual: la e chave de UNICIDADE (`@unique`) e aqui e chave de
 * ORDENACAO, deliberadamente sem `@unique`, porque dois animais podem se chamar
 * "Theo" (RN-05). Ele tambem NAO e um campo de busca: acentos sao PRESERVADOS
 * ("caçula" continua com cedilha), e so a caixa e removida.
 */
const ORDENACAO_DA_LISTAGEM: Prisma.AnimalOrderByWithRelationInput[] = [
  { nameNormalized: 'asc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

/** Recorte da pagina, ja calculado pelo caso de uso a partir de `page`/`pageSize`. */
export interface AnimalPageRequest {
  readonly skip: number;
  readonly take: number;
}

/**
 * Itens da pagina mais o total de registros da COLECAO INTEIRA (nao o da
 * pagina): e ele que a interface usa para decidir se exibe controles de
 * navegacao (RN-42a).
 */
export interface AnimalPage {
  readonly items: ReadonlyArray<AnimalWithRelations>;
  readonly total: number;
}

/**
 * Linha de `animals` pronta para o `INSERT`. E a forma da TABELA, e nao a do
 * pedido do administrador: `nameNormalized` ja vem derivado, `size` e `sex` ja
 * sao os literais do enum do banco e `birthDate` ja e a data civil em UTC. O
 * repositorio nao normaliza, nao traduz vocabulario e nao le relogio.
 *
 * `id` E PARAMETRO e nao fica a cargo do `@default(uuid())` do schema. A razao e
 * o caminho do objeto no armazenamento: `animals/<id>/<uuid>.<ext>` precisa do
 * identificador do animal ANTES do `INSERT`, porque as imagens sobem antes da
 * transacao (RN-52). Deixar o banco gerar obrigaria a inverter a ordem — gravar o
 * animal, subir as imagens e so entao gravar as linhas de imagem —, o que
 * manteria a transacao aberta durante ate 20 s de rede por objeto.
 *
 * `status` NAO entra: o animal nasce `DISPONIVEL` pelo default do schema (RN-14),
 * e um parametro aqui seria a porta pela qual o cadastro escolheria o estado
 * inicial.
 */
export interface CreateAnimalData {
  readonly id: string;
  readonly name: string;
  readonly nameNormalized: string;
  /**
   * Chave de BUSCA da vitrine: minuscula e SEM acento (RN-23). Distinta de
   * `nameNormalized`, que preserva os acentos porque serve a ordenacao.
   */
  readonly nameSearch: string;
  readonly speciesId: string;
  readonly cityId: string;
  readonly size: AnimalSize;
  readonly sex: AnimalSex;
  readonly birthDate: Date | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
}

/**
 * Colunas de `animals` que a EDICAO regrava. E `CreateAnimalData` menos `id`, e
 * a subtracao e a RN-06 escrita no tipo: o identificador do animal e estavel, e
 * um campo aqui seria a porta pela qual uma edicao poderia renomear o recurso que
 * ela edita — inclusive apontando para o de outra pessoa.
 *
 * `status` continua ausente pelo mesmo motivo do cadastro (RN-16): a alteracao de
 * status e operacao propria, com endpoint proprio.
 *
 * `updatedAt` tambem NAO entra, e a ausencia e o oposto de um esquecimento:
 * ele e o TOKEN de bloqueio otimista e quem o regrava e o `@updatedAt` do schema,
 * automaticamente, a cada `updateMany` — verificado contra o banco deste projeto.
 * Deixar quem chama escolher a marca nova seria deixar o cliente fixar o token
 * que a proxima gravacao vai exigir.
 */
export interface UpdateAnimalData {
  readonly name: string;
  readonly nameNormalized: string;
  /**
   * Chave de BUSCA da vitrine: minuscula e SEM acento (RN-23). Distinta de
   * `nameNormalized`, que preserva os acentos porque serve a ordenacao.
   */
  readonly nameSearch: string;
  readonly speciesId: string;
  readonly cityId: string;
  readonly size: AnimalSize;
  readonly sex: AnimalSex;
  readonly birthDate: Date | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
}

/**
 * Linha de `animal_images` pronta para o `INSERT`.
 *
 * `storagePath` ja vem de `buildAnimalImageObjectPath` e `contentType` ja vem da
 * assinatura binaria — o repositorio nao gera caminho nem apura formato. `id` e
 * parametro pelo mesmo motivo do animal: ele ja compoe o caminho do objeto que
 * subiu, e deixar o banco gerar outro faria a linha apontar para lugar nenhum.
 *
 * `position` e a ordem de envio, base ZERO. A posicao `0` e a capa (RN-35).
 */
export interface CreateAnimalImageData {
  readonly id: string;
  readonly storagePath: string;
  readonly position: number;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface AnimalRepository {
  /**
   * Uma pagina da listagem administrativa, na ordenacao da RN-41, mais o total.
   *
   * Colecao vazia devolve `{ items: [], total: 0 }` — nunca `null`: pagina sem
   * itens e um estado legitimo do recurso, inclusive quando o `skip` passa do
   * total.
   */
  listPaginated(pagina: AnimalPageRequest): Promise<AnimalPage>;
  /**
   * Consulta pela chave primaria, com as mesmas relacoes da listagem. Ausencia e
   * `null` — e o service que decide se isso e um problema (RN-44).
   */
  findById(id: string): Promise<AnimalWithRelations | null>;
  /**
   * Grava a linha do animal e devolve o registro JA com as tres relacoes
   * resolvidas — a mesma forma que a leitura entrega, para que a resposta do
   * `POST` passe pelo MESMO `toAnimalResponse` da consulta e nenhuma serializacao
   * seja duplicada.
   *
   * `images` vem vazio deste metodo, e sempre: as linhas de imagem sao gravadas
   * logo em seguida por `createImages`, dentro da mesma transacao.
   */
  create(data: CreateAnimalData): Promise<AnimalWithRelations>;
  /**
   * Grava as linhas de `animal_images` do animal `animalId` e devolve as linhas
   * gravadas, na ordem em que foram entregues.
   *
   * Devolve as linhas (e nao apenas a contagem) porque quem chama precisa delas
   * para montar a resposta sem uma segunda leitura do animal inteiro — releitura
   * que, dentro da transacao, custaria mais uma ida ao banco por cadastro.
   *
   * Lista vazia e chamada VALIDA e devolve `[]` sem tocar o banco: um animal com
   * zero imagem e um cadastro legitimo (RN-30), nao um caso de contingencia.
   */
  createImages(
    animalId: string,
    images: ReadonlyArray<CreateAnimalImageData>,
  ): Promise<ReadonlyArray<AnimalImage>>;
  /**
   * RN-47 — atualizacao CONDICIONAL (compare-and-swap): regrava as colunas de
   * `data` SOMENTE se `updatedAt` ainda for `expectedUpdatedAt`, e devolve
   * quantas linhas foram afetadas.
   *
   * A CONTAGEM E O RESULTADO QUE IMPORTA, e e por isso que o metodo nao devolve
   * o animal: `count === 0` significa que o registro mudou (ou sumiu) entre a
   * leitura que alimentou o formulario e esta gravacao. Um `update` simples por
   * `id` sobrescreveria em silencio — exatamente a perda que a RN-47 existe para
   * impedir. Mesmo desenho do `consume` de
   * `email-confirmation-token.repository.ts`, que e o precedente do projeto para
   * atualizacao condicional que devolve contagem.
   *
   * `count === 0` NAO distingue "nao existe" de "mudou", e o repositorio nao
   * tenta distinguir: ele nao lanca erro HTTP e nao sabe o que cada desfecho
   * significa para quem chama. Quem separa `404 ANIMAL_NOT_FOUND` de
   * `409 ANIMAL_STALE_UPDATE` e o service, com uma releitura posterior.
   *
   * O `updatedAt` novo NAO e parametro: o `@updatedAt` do schema o grava sozinho
   * neste `updateMany` — verificado contra o banco deste projeto (Postgres 17.6,
   * Prisma 5.22): a marca depois da gravacao e diferente da anterior, e a mesma
   * condicao repetida com a marca antiga devolve `0` sem alterar nada.
   */
  updateIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: UpdateAnimalData,
  ): Promise<number>;
  /**
   * RN-16 / RN-47 — atualizacao CONDICIONAL do STATUS, e SOMENTE dele.
   *
   * Assinatura propria em vez de reusar `updateIfUnchanged` com um
   * `UpdateAnimalData` de status: aquele metodo regrava as dez colunas do animal,
   * e quem chamasse teria de MONTAR os nove outros valores a partir de uma
   * leitura anterior so para regrava-los identicos. Alem de custar a leitura, isso
   * abriria uma janela real de perda — os valores viriam de um instante ANTERIOR
   * a gravacao, entao uma alteracao concorrente que tivesse ocorrido depois
   * daquela leitura seria sobrescrita pela propria alteracao de status. Com
   * `data: { status }` o `UPDATE` toca UMA coluna e nenhum outro campo pode ser
   * alterado por este caminho (RN-16, CT-69, CA-30).
   *
   * O `updatedAt` novo NAO e parametro, exatamente como em `updateIfUnchanged`: o
   * `@updatedAt` do schema o regrava sozinho neste `updateMany` — e por isso a
   * alteracao de status gira o MESMO token que a edicao consome, e as duas
   * operacoes disputam a mesma trava otimista em vez de terem cada uma a sua.
   *
   * `count === 0` continua NAO distinguindo "nao existe" de "mudou": o
   * repositorio nao lanca erro HTTP. Quem separa `404` de `409` e o service, com
   * a mesma releitura da edicao.
   */
  updateStatusIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    status: AnimalStatus,
  ): Promise<number>;
  /**
   * RN-37 / RN-45 — apaga a linha do animal e devolve quantas apagou (`0` ou `1`).
   *
   * As linhas de `animal_images` vao junto pela CASCATA declarada no schema
   * (RN-55): nao ha `DELETE` de imagem a emitir aqui, e emiti-lo duplicaria em
   * codigo uma garantia que ja esta no banco. Os OBJETOS no armazenamento nao sao
   * tocados por este metodo e nao teriam como ser — a porta de persistencia nao
   * conhece o armazenamento; quem os remove e o service, depois desta chamada
   * (RN-40).
   *
   * A ESPECIE e a CIDADE nao sao afetadas em hipotese alguma (RN-10): os dois
   * vinculos sao RESTRITIVOS e apontam do animal PARA elas, entao apagar o animal
   * apenas remove a referencia (CT-80, CA-35).
   *
   * A contagem e o resultado que importa, pelo mesmo motivo de
   * `updateIfUnchanged`: uma exclusao concorrente entre a leitura e este comando
   * devolve `0`, e e assim que o segundo administrador recebe `404` em vez de um
   * `204` para uma exclusao que ele nao fez.
   */
  deleteById(id: string): Promise<number>;
  /**
   * RN-36 — apaga as linhas de `animal_images` cujos identificadores foram
   * removidos do formulario, e devolve quantas apagou.
   *
   * Apaga apenas o REGISTRO. O objeto correspondente no armazenamento e removido
   * por quem chama, DEPOIS do commit: a remocao nao participa da transacao e nao
   * pode ser desfeita por ela.
   *
   * Lista vazia e chamada VALIDA e devolve `0` sem tocar o banco — uma edicao que
   * nao remove nenhuma imagem e o caso comum.
   */
  deleteImagesByIds(ids: ReadonlyArray<string>): Promise<number>;
  /**
   * RN-35 — reposiciona UMA imagem mantida na ordem final escolhida pelo
   * administrador.
   *
   * Uma imagem por chamada, e nao um lote: cada linha recebe uma posicao
   * DIFERENTE, entao nao ha `updateMany` a fazer — seriam no maximo cinco
   * `UPDATE` de qualquer forma. A tabela nao tem restricao de unicidade sobre
   * `(animalId, position)` exatamente para que a reordenacao possa passar por
   * estados intermediarios com posicao repetida dentro da transacao (ver o
   * comentario do `@@index` no schema); verificado contra o banco deste projeto.
   */
  updateImagePosition(id: string, position: number): Promise<void>;
  /**
   * Mesma porta ligada a uma transacao em andamento.
   *
   * Nenhum caso de uso desta fatia abre transacao interativa — as duas
   * operacoes sao leituras. Existe porque e o contrato de porta do projeto e
   * porque os consumidores previstos sao as escritas (TASK-BACKEND-007 a 009):
   * elas releem o animal DENTRO da mesma transacao que o grava, e um repositorio
   * construido com o client global executaria fora dela, deixando a atomicidade
   * so aparente.
   */
  withTransaction(executor: Prisma.TransactionClient): AnimalRepository;
}

/**
 * Capacidade de executar um LOTE atomico de consultas.
 *
 * Existe como tipo proprio porque `Prisma.TransactionClient` — o tipo do
 * construtor, comum ao client completo e ao `tx` de uma transacao interativa —
 * NAO possui `$transaction`: ele e um `Omit` que retira exatamente esse metodo,
 * justamente para impedir transacao aninhada. Sem este segundo parametro, o
 * `listPaginated` nao teria como pedir o lote.
 */
type ExecutorDeLote = Pick<PrismaClient, '$transaction'>;

/**
 * `Prisma.TransactionClient` e nao `PrismaClient` no primeiro parametro: e o
 * tipo comum aos dois — o client completo satisfaz a interface (ela e um `Omit`
 * dele) e o `tx` da transacao interativa tambem.
 *
 * O segundo parametro e o mesmo client, quando ha um capaz de abrir lote. Na
 * composicao da aplicacao ele e passado (`new PrismaAnimalRepository(prisma,
 * prisma)`); em `withTransaction` ele e `null`, porque ali JA SE ESTA dentro de
 * uma transacao aberta por quem chamou e um lote aninhado seria recusado pelo
 * proprio Prisma.
 */
export class PrismaAnimalRepository implements AnimalRepository {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly lote: ExecutorDeLote | null = null,
  ) {}

  /**
   * Itens e total em UMA `$transaction`, e nao duas idas soltas ao banco.
   *
   * Contados fora do lote, um cadastro concorrente entre o `findMany` e o
   * `count` produziria um `total` incoerente com a pagina devolvida — a
   * interface exibiria "Total: 41 animais" ao lado de uma pagina montada quando
   * havia 40, e o ultimo animal apareceria ou sumiria conforme o momento.
   *
   * As duas consultas sao construidas ANTES do `await`: `PrismaPromise` e
   * preguicosa e so emite comando quando resolvida, o que e precisamente o que
   * permite entrega-las ao lote em vez de executa-las.
   */
  async listPaginated(pagina: AnimalPageRequest): Promise<AnimalPage> {
    const consultaDeItens = this.db.animal.findMany({
      skip: pagina.skip,
      take: pagina.take,
      orderBy: ORDENACAO_DA_LISTAGEM,
      include: INCLUIR_RELACOES,
    });

    /**
     * `count` SEM `where`: o total do contrato e o de animais cadastrados, e a
     * listagem nao oferece busca nem filtro (RN-42b). Quando a feature de
     * filtragem da vitrine chegar, o filtro tera de entrar nos DOIS lugares — um
     * `count` que ignorasse o `where` do `findMany` e o defeito classico de
     * paginacao filtrada.
     */
    const consultaDoTotal = this.db.animal.count();

    if (this.lote === null) {
      // Ja estamos dentro de uma transacao aberta por quem chamou: as duas
      // consultas correm nela, e pedir um lote aqui seria transacao aninhada.
      return { items: await consultaDeItens, total: await consultaDoTotal };
    }

    const [items, total] = await this.lote.$transaction([consultaDeItens, consultaDoTotal]);

    return { items, total };
  }

  /**
   * `findUnique` e nao `findUniqueOrThrow`: o "nao encontrado" da RN-44 e uma
   * resposta prevista do recurso, e nao uma falha de infraestrutura. Deixar o
   * Prisma lancar aqui obrigaria o service a inspecionar codigo de erro do ORM
   * para produzir um `404` que ele ja sabe produzir a partir de `null`.
   *
   * O `id` chega JA validado como UUID por `animalIdParamsSchema`; o repositorio
   * nao revalida formato.
   */
  async findById(id: string): Promise<AnimalWithRelations | null> {
    return this.db.animal.findUnique({ where: { id }, include: INCLUIR_RELACOES });
  }

  /**
   * O `data` lista os campos um a um em vez de repassar o objeto recebido: e o
   * que impede uma chave inesperada de virar coluna gravada caso a forma de
   * `CreateAnimalData` cresca. Mesmo cuidado ja registrado em
   * `species.repository.ts`.
   *
   * `status` nao aparece — vem do `@default(DISPONIVEL)` do schema (RN-14) —, e
   * `createdAt`/`updatedAt` tampouco: quem os grava e o proprio Prisma, entao
   * nenhum `new Date()` participa do cadastro.
   *
   * A referencia a especie e a cidade e feita por `speciesId`/`cityId` diretos e
   * nao por `connect`: as duas chaves ja foram resolvidas pelo caso de uso, e o
   * `connect` emitiria um `SELECT` a mais por relacao para reconferir o que ja se
   * sabe. A integridade continua garantida — a FK RESTRITIVA do schema recusa o
   * `INSERT` se a especie ou a cidade sumirem entre a leitura e a gravacao.
   */
  async create(data: CreateAnimalData): Promise<AnimalWithRelations> {
    return this.db.animal.create({
      data: {
        id: data.id,
        name: data.name,
        nameNormalized: data.nameNormalized,
        nameSearch: data.nameSearch,
        speciesId: data.speciesId,
        cityId: data.cityId,
        size: data.size,
        sex: data.sex,
        birthDate: data.birthDate,
        description: data.description,
        acceptsOtherAnimals: data.acceptsOtherAnimals,
        needsLargeSpace: data.needsLargeSpace,
      },
      include: INCLUIR_RELACOES,
    });
  }

  /**
   * `createManyAndReturn` e nao `createMany`: o `createMany` devolve apenas
   * `{ count }`, e quem chama precisa das linhas (com o `createdAt` que so o
   * banco conhece) para montar a resposta. Tambem nao e um `create` por imagem —
   * cinco idas ao banco DENTRO da transacao, com o pooler de conexao unica do
   * Supabase, sao cinco vezes mais tempo com ela aberta.
   *
   * A ORDEM DO RETORNO NAO E CONTRATO. Este metodo devolve o que o `RETURNING`
   * do `INSERT` devolveu, e o padrao SQL nao promete que isso seja a ordem dos
   * dados enviados — o Postgres o faz na pratica, e e so isso. Quem PRECISA da
   * ordem por `position` a estabelece: a leitura pelo `orderBy` do `include`
   * (`INCLUIR_RELACOES`, acima) e o cadastro por um `sort` explicito sobre as no
   * maximo cinco linhas (`create-animal.service.ts`). Nao apoie a resposta na
   * ordem observada aqui.
   *
   * A saida EXPLICITA na lista vazia nao e microtimizacao: `createManyAndReturn`
   * com `data: []` emite um `INSERT ... VALUES` sem tuplas, que o Postgres recusa
   * com erro de sintaxe. Um animal sem imagem (RN-30) viraria 500.
   */
  async createImages(
    animalId: string,
    images: ReadonlyArray<CreateAnimalImageData>,
  ): Promise<ReadonlyArray<AnimalImage>> {
    if (images.length === 0) {
      return [];
    }

    return this.db.animalImage.createManyAndReturn({
      data: images.map((imagem) => ({
        id: imagem.id,
        animalId,
        storagePath: imagem.storagePath,
        position: imagem.position,
        contentType: imagem.contentType,
        sizeBytes: imagem.sizeBytes,
      })),
    });
  }

  /**
   * `updateMany` e nao `update`, e a escolha e a razao de o metodo existir: o
   * `update` do Prisma exige um filtro UNICO e lanca `P2025` quando nada casa,
   * transformando um conflito de concorrencia previsto — que o contrato responde
   * com `409` — em excecao de infraestrutura a inspecionar por codigo de erro. O
   * `updateMany` aceita `updatedAt` no `where` e devolve `{ count }`, que e
   * exatamente a informacao de que o service precisa.
   *
   * O `data` lista as colunas uma a uma, e nao repassa o objeto recebido: e o que
   * impede uma chave inesperada de virar coluna gravada caso a forma de
   * `UpdateAnimalData` cresca. Mesmo cuidado ja aplicado em `create`.
   */
  async updateIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: UpdateAnimalData,
  ): Promise<number> {
    const resultado = await this.db.animal.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: {
        name: data.name,
        nameNormalized: data.nameNormalized,
        nameSearch: data.nameSearch,
        speciesId: data.speciesId,
        cityId: data.cityId,
        size: data.size,
        sex: data.sex,
        birthDate: data.birthDate,
        description: data.description,
        acceptsOtherAnimals: data.acceptsOtherAnimals,
        needsLargeSpace: data.needsLargeSpace,
      },
    });

    return resultado.count;
  }

  /**
   * `data: { status }` e SO isso: nenhuma outra coluna aparece, entao nao existe
   * caminho por onde este metodo pudesse alterar outro campo do animal, nem que
   * a forma de `UpdateAnimalData` cresca (RN-16).
   *
   * `updateMany` e nao `update`, pela MESMA razao de `updateIfUnchanged`: o
   * `update` exige filtro unico, e `updatedAt` no `where` nao e unico; alem disso
   * ele lanca `P2025` quando nada casa, transformando o conflito de concorrencia
   * previsto — que o contrato responde com `409` — em excecao do ORM a inspecionar
   * por codigo de erro.
   *
   * Enviar o status que o animal JA POSSUI e uma chamada valida e devolve `1`: o
   * `where` casa a linha, o Postgres conta a linha como atualizada mesmo quando o
   * valor gravado e identico, e o `@updatedAt` gira. E o que faz a RN-15 valer sem
   * ramo especial — reenviar o status atual responde `200` — enquanto mantem a
   * trava otimista intacta: com um token vencido, o `where` nao casa e a resposta
   * e `409` mesmo que o status enviado seja o que ja esta la.
   */
  async updateStatusIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    status: AnimalStatus,
  ): Promise<number> {
    const resultado = await this.db.animal.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: { status },
    });

    return resultado.count;
  }

  /**
   * `deleteMany` e nao `delete`, pela mesma razao que levou `updateIfUnchanged` a
   * `updateMany`: o `delete` lanca `P2025` quando a linha nao existe, e "o animal
   * ja tinha sido excluido" e um desfecho PREVISTO do contrato (`404`, RN-44,
   * CT-78) — nao uma falha de infraestrutura a reconhecer por codigo de erro do
   * ORM. O `deleteMany` devolve `{ count }`, que e exatamente o que o service
   * precisa, e mantem de pe a regra de que o repositorio nunca lanca erro HTTP.
   *
   * SEM `where` de imagem: a cascata de `animal_images` e do BANCO (RN-55).
   */
  async deleteById(id: string): Promise<number> {
    const resultado = await this.db.animal.deleteMany({ where: { id } });

    return resultado.count;
  }

  /**
   * A saida explicita na lista vazia evita um `DELETE ... WHERE id IN ()` inutil
   * dentro da transacao — a edicao que nao remove imagem nenhuma e o caso comum, e
   * uma ida ao banco por edicao, com o pooler de conexao unica do Supabase, e
   * tempo de transacao aberta que nao compra nada.
   */
  async deleteImagesByIds(ids: ReadonlyArray<string>): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const resultado = await this.db.animalImage.deleteMany({
      where: { id: { in: [...ids] } },
    });

    return resultado.count;
  }

  async updateImagePosition(id: string, position: number): Promise<void> {
    await this.db.animalImage.update({ where: { id }, data: { position } });
  }

  withTransaction(executor: Prisma.TransactionClient): AnimalRepository {
    return new PrismaAnimalRepository(executor);
  }
}
