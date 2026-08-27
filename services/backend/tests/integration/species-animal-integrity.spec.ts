import { randomUUID } from 'node:crypto';

import {
  AnimalSex,
  AnimalSize,
  Prisma,
  type PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request, { type Response } from 'supertest';
import { z } from 'zod';

/**
 * QUITACAO DA DIVIDA DA FEATURE-001 — TASK-BACKEND-010 (CT-81 a CT-86).
 *
 * ================== O QUE ESTA SUITE E ==================
 *
 * A FEATURE-001 deste modulo entregou a sua regra mais importante — "especie com
 * animais vinculados nao pode ser excluida" (RN-08 / RN-09) — verificavel APENAS
 * por duble, porque a entidade Animal nao existia. Nenhum teste verde daquela
 * feature diz uma palavra sobre integridade referencial real.
 *
 * Agora a entidade existe, a tabela existe e a chave estrangeira existe. Esta
 * suite REEXECUTA aqueles criterios contra a tabela real e a constraint real do
 * Postgres. A correspondencia entre as duas numeracoes e um para um:
 *
 *   | aqui  | FEATURE-001 | o que reexecuta                                  |
 *   |-------|-------------|--------------------------------------------------|
 *   | CT-81 | CT-24       | 409 SPECIES_IN_USE com animal vinculado           |
 *   | CT-82 | CT-25       | contagens intactas, nenhum animal orfao           |
 *   | CT-83 | CT-26       | removido o vinculo, a exclusao conclui            |
 *   | CT-84 | CT-32       | a recusa vale fora da interface                   |
 *   | CT-85 | —           | CAMADA 2: o proprio Postgres recusa (23503)       |
 *   | CT-86 | —           | RN-29: cidade referenciada nao e removida         |
 *
 * O CT-85 tem DOIS casos, e a divisao e de assunto: o primeiro mede que o
 * Postgres RECUSA (`23503`, constraint nomeada, nada apagado); o segundo — o
 * `CT-85 (CA-36)` — mede que essa recusa CHEGA AO CLIENTE como
 * `409 SPECIES_IN_USE`, e nao como `500`. O segundo so tem valor se a camada 1
 * comprovadamente nao decidir antes, e por isso ele e o unico caso da suite que
 * orquestra tres sessoes e espera por condicoes observadas no catalogo do
 * Postgres em vez de por tempo.
 *
 * ================== NENHUM DUBLE, E ESSE E O PONTO (CA-38) ==================
 *
 * Este arquivo NAO usa `prisma-double`, NAO usa `FakeSpeciesUsageCounter` e NAO
 * injeta dependencias no `createSpeciesController`. O grafo de producao roda
 * inteiro — `app.ts`, middlewares, controller, services, `PrismaSpeciesRepository`
 * e `PrismaSpeciesUsageCounter` — sobre o cliente Prisma ligado ao banco de
 * verdade por `tests/helpers/banco-real.ts`. Um duble em qualquer camada
 * reproduziria a lacuna que esta task existe para fechar.
 *
 * Onde o duble CONTINUA sendo a escolha certa esta registrado em
 * `delete-species.service.spec.ts`: as regras do service (ordem das
 * verificacoes, mensagem, transacao) nao ganham nada indo a rede.
 *
 * ================== DADOS ==================
 *
 * A suite cria tudo o que usa, com nomes MARCADOS por execucao (ver
 * `MARCA_DA_EXECUCAO`), e remove tudo ao final. A marca existe porque o banco de
 * desenvolvimento e compartilhado: sem ela, apagar a especie "Cachorro" ao fim
 * de uma execucao levaria junto a especie "Cachorro" que outra pessoa cadastrou
 * a mao. A LIMPEZA RESPEITA A ORDEM DE DEPENDENCIA — imagens, animais, especies —, e nao
 * por elegancia: uma limpeza que apagasse especies primeiro falharia pela mesma
 * chave estrangeira que a suite esta verificando. Falhar ali seria sinal de que
 * a FK funciona, nao de que o teste esta errado.
 *
 * A cidade usada pelos animais tambem e criada pela suite, e nao sorteada entre
 * as 5571 do recorte do IBGE: o CT-86 tenta EXCLUIR uma cidade, e um defeito na
 * FK `animals_city_id_fkey` apagaria um municipio de verdade do cadastro de
 * apoio. A constraint exercitada e exatamente a mesma.
 */
import { abrirSessaoParalela, prisma } from '../helpers/banco-real';

jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../helpers/banco-real')>('../helpers/banco-real'),
);

import { hashPassword } from '~/utils/password-hasher';

// Depois do `jest.mock`: e o import do `app` que dispara
// `createSpeciesController()` e monta o grafo sobre o cliente acima.
import { app } from '~/app';

/**
 * Timeout PROPRIO desta suite, acima dos 15 s do `jest.config.ts`.
 *
 * Ela e a unica que fala com o banco de verdade, e o `DATABASE_URL` do projeto
 * aponta para o pooler do Supabase com `connection_limit=1`: cada comando e uma
 * ida a rede e todos saem em fila. Um caso que monta especie, animal e imagem,
 * chama a API e confere o estado depois nao cabe nos 15 s do resto da suite,
 * que roda inteira sobre dubles em memoria.
 *
 * O numero e folga de latencia, e nao licenca para teste lento: NENHUM caso
 * daqui espera por tempo. O CT-85 (CA-36), que precisa de uma ordem exata entre
 * duas sessoes, espera por CONDICOES OBSERVADAS no catalogo do Postgres — ver
 * `esperarPelaCondicao` e o comentario do proprio caso.
 */
jest.setTimeout(60_000);

/**
 * Senha SORTEADA a cada execucao, e nenhuma assercao depende do valor.
 *
 * A suite cria um ADMINISTRADOR ATIVO no banco compartilhado e so o remove no
 * `afterAll`. Uma execucao interrompida (Ctrl+C, timeout, cancelamento de job)
 * deixa essa conta para tras; com senha literal no repositorio, ela ficaria
 * sendo uma conta privilegiada de senha publicamente conhecida ate a proxima
 * execucao passar pelo `beforeAll`. Sorteada, o residuo continua indesejado mas
 * deixa de ser utilizavel.
 */
const SENHA = `Senha1!${randomUUID()}`;
const EMAIL_DO_ADMIN = 'admin.integridade.task010@catdog.test';

/**
 * MARCA das especies desta suite, e a razao dela e concreta.
 *
 * A limpeza apagava `species` por nome global — e "Cachorro" e exatamente o nome
 * que alguem semearia a mao no banco de desenvolvimento compartilhado. Apagar o
 * que a suite nao criou e efeito colateral, nao limpeza.
 *
 * O prefixo `[T010-` e ESTAVEL e o sufixo e SORTEADO por execucao: o prefixo e o
 * que permite varrer residuo de uma execucao anterior interrompida sem tocar em
 * nada de ninguem, e o sorteio e o que impede que essa varredura de partida
 * alcance registros de outra execucao.
 */
const PREFIXO_DAS_ESPECIES_DA_SUITE = '[T010-';
const MARCA_DA_EXECUCAO = `${PREFIXO_DAS_ESPECIES_DA_SUITE}${randomUUID().slice(0, 8)}]`;

/**
 * "Cachorro" e o nome literal do CT-24 da FEATURE-001, e e ele que o CT-81
 * reexecuta. "Peixe" e a especie LIVRE que precisa conviver com a ocupada no
 * mesmo banco — sem ela, um bug que recusasse toda exclusao passaria despercebido.
 *
 * A marca entra no fim e nao no comeco: a listagem da regressao afirma a ORDEM
 * alfabetica da RN-11, e um prefixo comum a todas as especies a destruiria.
 */
const ESPECIE_OCUPADA = `Cachorro ${MARCA_DA_EXECUCAO}`;
const ESPECIE_LIVRE = `Peixe ${MARCA_DA_EXECUCAO}`;
const ESPECIE_RENOMEADA = `Cachorro doméstico ${MARCA_DA_EXECUCAO}`;

/**
 * Fora da faixa de 7 digitos do IBGE: nao colide com nenhum municipio real.
 *
 * E tambem, na pratica, o EXCLUSAO MUTUA desta suite: `ibge_code` e `@unique`, e
 * duas execucoes simultaneas contra o mesmo banco falhariam alto aqui, no
 * `beforeAll`, em vez de produzirem vermelho por interferencia. No CI cada
 * execucao tem um Postgres proprio, entao a situacao nao aparece la.
 */
const CODIGO_IBGE_DA_CIDADE_DE_TESTE = 9999999;
const NOME_DA_CIDADE_DE_TESTE = 'Cidade de Teste TASK-BACKEND-010';

/**
 * Sondagem da corrida do CT-85. NAO sao pausas: sao o intervalo entre duas
 * perguntas ao catalogo do Postgres e o prazo alem do qual a pergunta deixa de
 * ser feita e o caso falha dizendo qual condicao nunca ocorreu.
 *
 * A versao anterior deste caso esperava por TEMPO (700 ms e 1500 ms) e passava
 * ate com a camada 2 apagada do codigo de producao — era incapaz de ficar
 * vermelho pelo motivo que anunciava. Duas causas somadas, e a segunda e a que
 * nenhuma pausa consertaria:
 *
 *   1. cada ida ao pooler custa 1-2 s, entao os dois prazos eram consumidos
 *      antes de a requisicao chegar a contagem;
 *   2. o objeto do supertest e um THENABLE PREGUICOSO — a requisicao nem sequer
 *      partia enquanto ninguem chamasse `.then()`. Guardada numa variavel e
 *      aguardada so no fim, ela saia DEPOIS do comite da sessao paralela, a
 *      contagem da camada 1 via 1 e era a camada 1 que respondia `409`.
 *
 * A correcao ataca as duas: espera-se por condicao observada, e a requisicao e
 * DISPARADA explicitamente antes da observacao (ver o caso).
 *
 * O `timeout` da sessao que insere e maior do que a soma dos dois prazos: a
 * transacao dela fica aberta de proposito durante toda a observacao.
 */
const INTERVALO_ENTRE_SONDAGENS_MS = 50;
const PRAZO_MAXIMO_DA_OBSERVACAO_MS = 15_000;
const OPCOES_DE_TRANSACAO_DA_SESSAO_PARALELA = { maxWait: 10_000, timeout: 60_000 } as const;

/** Codigo SQLSTATE do Postgres para violacao de chave estrangeira. */
const VIOLACAO_DE_CHAVE_ESTRANGEIRA = '23503';
/**
 * SQLSTATE de `NOWAIT` que encontrou a linha ja bloqueada por outra sessao. E o
 * sinal, e nao um erro: e assim que a suite OBSERVA o `FOR KEY SHARE` que o
 * `INSERT` da sessao paralela tomou sobre a linha da especie.
 */
const BLOQUEIO_INDISPONIVEL = '55P03';
/** Como o Prisma reporta o `23503` vindo do seu proprio motor de consulta. */
const P2003 = 'P2003';
/**
 * Nomes das duas restricoes medidas, como o Prisma os devolve em
 * `meta.field_name`. Sao afirmados LITERALMENTE de proposito: uma migration que
 * recriasse a chave com outra acao (`Cascade`, `SetNull`) ou sobre outra coluna
 * mudaria este texto, e o teste reprovaria em vez de continuar verde medindo
 * outra constraint.
 */
const FK_DE_ESPECIE = 'animals_species_id_fkey (index)';
const FK_DE_CIDADE = 'animals_city_id_fkey (index)';

const envelopeDeErroSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

const especiePublicaSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const colecaoSchema = z.object({ items: z.array(especiePublicaSchema) }).strict();

/**
 * `count(*)` do Postgres e `bigint`, e o driver o entrega como `BigInt` do
 * JavaScript. O tipo declara isso em vez de fingir `number`: e a conversao
 * explicita em `fotografar` que evita comparar `1n` com `1` e ver a assercao
 * falhar sem que nada esteja errado.
 */
interface LinhaDaFotografia {
  readonly especies: bigint;
  readonly animais: bigint;
  readonly imagens: bigint;
  readonly animais_sem_especie: bigint;
}

/**
 * Duas contagens do catalogo do Postgres, tambem `bigint` pelo mesmo motivo de
 * `LinhaDaFotografia`. Aqui a comparacao e feita direto contra `0n`, sem
 * conversao: nenhum dos dois numeros aparece em mensagem nem em assercao.
 */
interface LinhaDaEspera {
  readonly comandos_esperando: bigint;
  readonly pedidos_nao_concedidos: bigint;
}

interface Fotografia {
  readonly especies: number;
  readonly animais: number;
  readonly imagens: number;
  readonly animaisSemEspecie: number;
}

let token = '';
let cidadeId = '';

// --------------------------------------------------------------------------
// Ciclo de vida
// --------------------------------------------------------------------------

beforeAll(async () => {
  await limparResiduosDaSuite();

  const estado = await prisma.state.findFirst({ orderBy: { uf: 'asc' } });

  if (estado === null) {
    throw new Error('O recorte do IBGE nao esta semeado: `states` vazia.');
  }

  const cidade = await prisma.city.create({
    data: {
      name: NOME_DA_CIDADE_DE_TESTE,
      ibgeCode: CODIGO_IBGE_DA_CIDADE_DE_TESTE,
      stateId: estado.id,
    },
  });

  cidadeId = cidade.id;

  await prisma.user.create({
    data: {
      name: 'Admin da suite de integridade',
      email: EMAIL_DO_ADMIN,
      passwordHash: await hashPassword(SENHA),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  // Sessao aberta pelo caminho de PRODUCAO (login), uma unica vez: o token vale
  // 15 min e refaze-lo por teste so acrescentaria idas a rede.
  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL_DO_ADMIN, password: SENHA });

  token = z.object({ accessToken: z.string().min(1) }).parse(resposta.body).accessToken;
});

afterEach(async () => {
  await limparDadosDoCatalogo();
});

afterAll(async () => {
  await limparResiduosDaSuite();
  // Sem isto o Jest fecharia com o aviso de handle aberto e o processo penduraria.
  await prisma.$disconnect();
});

// --------------------------------------------------------------------------
// CT-81 a CT-84 — a regra da FEATURE-001, agora sobre dados reais
// --------------------------------------------------------------------------

describe('DELETE /api/species/:id sobre o banco real', () => {
  it('CT-81 (reexecuta o CT-24): espécie com animal vinculado responde 409 SPECIES_IN_USE e permanece cadastrada', async () => {
    // Arrange — animal REAL, linha real na tabela `animals`, apontando para a
    // espécie por `species_id`. Nenhuma contagem é configurada em lugar nenhum:
    // quem responde "1" é o `SELECT count(*)` de `PrismaSpeciesUsageCounter`.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    const animalId = await criarAnimal(especieId, 'Theo');

    // Act
    const resposta = await excluirEspecie(especieId);

    // Assert — status, `code` e mensagem LITERAL da FEATURE-001.
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta)).toEqual({
      error: {
        code: 'SPECIES_IN_USE',
        message:
          'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
      },
    });

    // A espécie PERMANECE, e o animal permanece vinculado a ela: a recusa não
    // pode ter apagado, desvinculado nem alterado nada (CA-37).
    await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.not.toBeNull();
    await expect(
      prisma.animal.findUnique({ where: { id: animalId }, select: { speciesId: true } }),
    ).resolves.toEqual({ speciesId: especieId });
  });

  it('CT-82 (reexecuta o CT-25): recusada a exclusão, as contagens ficam inalteradas e nenhum animal fica sem espécie', async () => {
    // Arrange — a fotografia é tirada com o vínculo já montado, para que a
    // comparação isole o efeito da exclusão recusada e nada mais.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    await criarAnimal(especieId, 'Theo');
    const antes = await fotografar();

    // Act
    const resposta = await excluirEspecie(especieId);

    // Assert
    expect(resposta.status).toBe(409);
    await expect(fotografar()).resolves.toEqual(antes);
    // Redundante com o campo da fotografia e escrito assim de propósito: é a
    // asserção que nomeia o desfecho proibido pela RN-09 (RNF-05).
    expect(antes.animaisSemEspecie).toBe(0);
  });

  it('CT-83 (reexecuta o CT-26): excluído o único animal vinculado, a exclusão da espécie conclui com 204', async () => {
    // Arrange
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    const animalId = await criarAnimal(especieId, 'Theo');
    await expect(excluirEspecie(especieId)).resolves.toMatchObject({ status: 409 });

    // Act — o vínculo cai pela API, como o cenário 4 da HU-09 descreve ("o
    // administrador excluiu o animal"), e não por um atalho de banco. É a
    // TASK-BACKEND-009 que as Dependencies desta task nomeiam como o que libera
    // o CT-83, e é o `DELETE /api/animals/:id` dela que precisa liberá-lo.
    //
    // A justificativa do balde ausente vale para a CRIAÇÃO do animal, que exige
    // upload; na exclusão a RN-40 engole a falha de armazenamento e este animal
    // não tem nenhuma imagem, então `compensar([])` sequer toca a rede.
    //
    // A espécie não é tocada por esta chamada: os dois vínculos apontam DO
    // animal para ela e são restritivos.
    const remocaoDoAnimal = await request(app)
      .delete(`/api/animals/${animalId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(remocaoDoAnimal.status).toBe(204);
    await expect(prisma.animal.findUnique({ where: { id: animalId } })).resolves.toBeNull();

    const resposta = await excluirEspecie(especieId);

    // Assert — 204 SEM corpo.
    expect(resposta.status).toBe(204);
    expect(resposta.body).toEqual({});
    await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.toBeNull();
  });

  it('CT-84 (reexecuta o CT-32): a mesma exclusão chamada direto à API, fora da interface, é recusada de forma idêntica', async () => {
    // Arrange — nenhuma listagem antes, nenhum estado de tela: o identificador
    // vem de fora e a requisição se anuncia como vinda de outra origem. Se a
    // guarda vivesse na interface, ESTE seria o caminho que passaria.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    await criarAnimal(especieId, 'Theo');

    // Act
    const resposta = await request(app)
      .delete(`/api/species/${especieId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'https://cliente-de-linha-de-comando.invalido')
      .set('User-Agent', 'curl/8.0.0');

    // Assert — byte a byte o mesmo desfecho do CT-81.
    expect(resposta.status).toBe(409);
    expect(envelopeDeErro(resposta).error.code).toBe('SPECIES_IN_USE');
    await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.not.toBeNull();
  });
});

// --------------------------------------------------------------------------
// CT-85 e CT-86 — a CAMADA 2: o proprio Postgres
// --------------------------------------------------------------------------

describe('Integridade referencial do Postgres', () => {
  it('CT-85: `prisma.species.delete` direto no banco, contornando o service, é recusado pela FK — e nenhum animal é apagado', async () => {
    // Arrange — este é o ÚNICO caso que desvia da API de propósito. Ele mede o
    // que sobra quando a camada 1 (a verificação da aplicação) é retirada do
    // caminho: se a FK fosse `Cascade`, o animal sumiria aqui em silêncio; se
    // fosse `SetNull`, ele ficaria sem classificação. As duas são proibidas.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    const animalId = await criarAnimal(especieId, 'Theo');
    await criarImagem(animalId);

    // Act
    const motivo = await capturar(() => prisma.species.delete({ where: { id: especieId } }));

    // Assert — o Prisma reporta `P2003` e NOMEIA a constraint que recusou.
    expect(codigoDoPrisma(motivo)).toBe(P2003);
    expect(constraintDoPrisma(motivo)).toBe(FK_DE_ESPECIE);

    // E o mesmo `DELETE` emitido como SQL CRU, sem o motor de consulta no
    // caminho, devolve o SQLSTATE literal do Postgres. É esta asserção — e não
    // o `P2003`, que é vocabulário do ORM — que prova que a recusa vem do banco.
    const motivoCru = await capturar(() =>
      prisma.$executeRaw`DELETE FROM species WHERE id = ${especieId}::uuid`,
    );

    expect(sqlstateCru(motivoCru)).toBe(VIOLACAO_DE_CHAVE_ESTRANGEIRA);

    // Nada foi apagado e nada ficou órfão.
    await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.not.toBeNull();
    await expect(
      prisma.animal.findUnique({ where: { id: animalId }, select: { speciesId: true } }),
    ).resolves.toEqual({ speciesId: especieId });
    await expect(prisma.animalImage.count({ where: { animalId } })).resolves.toBe(1);
  });

  it('CT-85 (CA-36): sob a corrida da RN-09 quem responde é a CAMADA 2, e o `P2003` chega ao cliente como 409 SPECIES_IN_USE', async () => {
    // Arrange — a tradução da camada 2 só é alcançável quando a camada 1 NÃO
    // decide antes, e com dados reais isso tem exatamente uma causa: a corrida
    // que a RN-09 descreve. Ela é REPRODUZIDA aqui, e não encenada com dublê.
    //
    // Três sessões de verdade, sobre o mesmo banco:
    //   sessão B abre uma transação, INSERE o animal e NÃO comita;
    //   sessão A (a API) conta zero — o `INSERT` pendente é invisível para ela —
    //     e emite o `DELETE`, que BLOQUEIA: o `INSERT` tomou `FOR KEY SHARE`
    //     sobre a linha da espécie;
    //   sessão O apenas OBSERVA o catálogo do Postgres e decide quando cada
    //     etapa aconteceu de fato;
    //   sessão B comita; o `DELETE` acorda, a verificação de integridade
    //     enxerga o animal recém-comitado e o Postgres recusa com `23503`.
    //
    // POR QUE UM OBSERVADOR, E NÃO PAUSAS. A ordem acima é o teste inteiro: se
    // a sessão B comitar antes de a camada 1 contar, a contagem devolve 1, quem
    // responde `409` é a camada 1 e o caso passa a medir o que já mede o CT-81.
    // Foi o que aconteceu com a versão por tempo deste caso — ela passava até
    // com `violaChaveEstrangeira` devolvendo `false`. Tempo não é ordem; o
    // catálogo do Postgres é, e é ele quem responde as duas perguntas abaixo.
    //
    // A terceira sessão é obrigatória: enquanto A está bloqueada dentro da
    // transação dela, o cliente da aplicação não tem uma segunda conexão para
    // emprestar (`connection_limit=1`), e qualquer pergunta feita por ele
    // esperaria pela conexão que a própria transação está segurando.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    const sessaoQueInsere = abrirSessaoParalela();
    const observador = abrirSessaoParalela();

    let liberarComite = (): void => undefined;
    const comitePendente = new Promise<void>((resolver) => {
      liberarComite = resolver;
    });

    // Declarados FORA do `try` para que o `finally` consiga encerrar os dois
    // mesmo quando uma asserção falha no meio. Uma transação deixada aberta
    // segurando o bloqueio faria o `afterEach` seguinte esperar por ela, e a
    // suíte inteira travaria em vez de reportar a falha.
    const insercaoNaoComitada = sessaoQueInsere.$transaction(
      async (tx) => {
        await tx.animal.create({ data: dadosDeAnimal(especieId, 'Theo') });
        await comitePendente;
      },
      OPCOES_DE_TRANSACAO_DA_SESSAO_PARALELA,
    );

    let exclusaoEmCurso: Promise<Response> | undefined;

    try {
      // CONDIÇÃO 1 — o `INSERT` já tomou `FOR KEY SHARE` sobre a linha da
      // espécie. Só depois disso a exclusão pode começar; antes, ela não teria
      // em que bloquear e a corrida não existiria.
      await esperarPelaCondicao(
        'o INSERT da sessão paralela tomar `FOR KEY SHARE` sobre a linha da espécie',
        () => linhaDeEspecieBloqueada(observador, especieId),
      );

      // O `.then` NÃO é decoração: o objeto devolvido por `request(app)` é um
      // THENABLE PREGUIÇOSO, e o supertest só dispara a requisição quando
      // alguém chama `.then()`. Guardá-lo numa variável, como fazia a versão
      // anterior deste caso, deixava a exclusão PARADA até o `await` lá
      // embaixo — isto é, até DEPOIS do comite da sessão paralela. Era essa a
      // causa raiz do falso verde: quando a requisição finalmente saía, o
      // animal já estava comitado, a contagem da camada 1 devolvia 1 e quem
      // respondia `409` era a camada 1. Nenhuma pausa, por maior que fosse,
      // consertaria isso.
      exclusaoEmCurso = excluirEspecie(especieId).then((resposta) => resposta);

      // CONDIÇÃO 2 — o `DELETE` da API já está DORMINDO no bloqueio de linha.
      // É esta observação que prova a ordem: o `DELETE` é a última operação da
      // transação do service, logo a contagem da camada 1 JÁ RODOU.
      await esperarPelaCondicao(
        'o DELETE da API bloquear no lock da linha da espécie',
        () => exclusaoBloqueadaEmLock(observador),
      );

      // ASSERÇÃO POSITIVA DE QUE FOI A CAMADA 2 QUE RESPONDEU.
      //
      // Medida AGORA, com a exclusão parada no bloqueio e a sessão B ainda sem
      // comitar: nenhuma sessão enxerga animal vinculado a esta espécie. A
      // contagem da camada 1 rodou antes deste instante, em READ COMMITTED e
      // portanto sobre um instantâneo igualmente anterior ao comite — ela viu o
      // mesmo zero e NÃO lançou. O `409` que chegar depois disto não tem como
      // ter vindo da camada 1.
      await expect(observador.animal.count({ where: { speciesId: especieId } })).resolves.toBe(0);

      // Act — o comite da sessão B é o que desbloqueia o `DELETE`.
      liberarComite();
      await insercaoNaoComitada;
      const resposta = await exclusaoEmCurso;

      // Assert — 409 com o MESMO `code` e a MESMA mensagem da camada 1, nunca
      // 500. Sem a tradução do `P2003` em `delete-species.service.ts`, o
      // `PrismaClientKnownRequestError` sobe até o tratador de erros e esta
      // asserção vê `500 INTERNAL_ERROR`.
      expect(resposta.status).toBe(409);
      expect(envelopeDeErro(resposta)).toEqual({
        error: {
          code: 'SPECIES_IN_USE',
          message:
            'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
        },
      });

      // O animal comitado pela sessão B sobreviveu, e a espécie também.
      await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.not.toBeNull();
      await expect(prisma.animal.count({ where: { speciesId: especieId } })).resolves.toBe(1);
    } finally {
      // Idempotente: se o caso chegou ao fim, a promessa já está resolvida e
      // estas três linhas não fazem nada. Se ele falhou antes, são elas que
      // devolvem o banco a um estado em que a limpeza consegue rodar.
      liberarComite();
      await insercaoNaoComitada.catch(() => undefined);
      await exclusaoEmCurso?.catch(() => undefined);
      await sessaoQueInsere.$disconnect();
      await observador.$disconnect();
    }
  });

  it('CT-86 (RN-29): remoção de cidade referenciada por um animal é recusada pela integridade referencial', async () => {
    // Arrange — mesmo motivo da espécie: manutenção no cadastro de apoio não
    // pode produzir animal sem localização.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    await criarAnimal(especieId, 'Theo');

    // Act
    const motivo = await capturar(() => prisma.city.delete({ where: { id: cidadeId } }));

    // Assert
    expect(codigoDoPrisma(motivo)).toBe(P2003);
    expect(constraintDoPrisma(motivo)).toBe(FK_DE_CIDADE);
    await expect(prisma.city.findUnique({ where: { id: cidadeId } })).resolves.not.toBeNull();
  });

  it('a cascata de `animal_images` NÃO contradiz a RN-09: excluir o animal leva as imagens dele junto', async () => {
    // Arrange — as duas ações de FK do módulo, lado a lado, para que a
    // diferença fique registrada: `animals.species_id` é RESTRICT e
    // `animal_images.animal_id` é CASCADE. A imagem não tem existência própria
    // fora do animal (RN-55); o animal tem existência própria fora da espécie.
    const especieId = await criarEspecie(ESPECIE_OCUPADA);
    const animalId = await criarAnimal(especieId, 'Theo');
    await criarImagem(animalId);
    await criarImagem(animalId);
    await expect(prisma.animalImage.count({ where: { animalId } })).resolves.toBe(2);

    // Act
    await prisma.animal.delete({ where: { id: animalId } });

    // Assert
    await expect(prisma.animalImage.count({ where: { animalId } })).resolves.toBe(0);
    await expect(prisma.species.findUnique({ where: { id: especieId } })).resolves.not.toBeNull();
  });
});

// --------------------------------------------------------------------------
// Regressao declarada — os fluxos da FEATURE-001 convivendo com registros
// ja referenciados por animais
// --------------------------------------------------------------------------

describe('Regressão da FEATURE-001 com espécies já referenciadas', () => {
  it('criar, renomear e listar continuam funcionando com uma espécie em uso no mesmo banco', async () => {
    // Arrange — a espécie ocupada existe e tem animal vinculado. Tudo o que
    // segue precisa se comportar como antes: a guarda é da EXCLUSÃO, e não uma
    // trava sobre o recurso.
    const ocupadaId = await criarEspecie(ESPECIE_OCUPADA);
    await criarAnimal(ocupadaId, 'Theo');

    // Act / Assert — criação (HU-02).
    const criada = await request(app)
      .post('/api/species')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: ESPECIE_LIVRE });

    expect(criada.status).toBe(201);
    const livre = especiePublicaSchema.parse(criada.body);
    expect(livre.name).toBe(ESPECIE_LIVRE);

    // Act / Assert — renomeação da espécie EM USO (HU-04). Ter animais
    // vinculados não impede renomear: nenhum vínculo é rompido por isso.
    const renomeada = await request(app)
      .patch(`/api/species/${ocupadaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: ESPECIE_RENOMEADA });

    expect(renomeada.status).toBe(200);
    expect(especiePublicaSchema.parse(renomeada.body).name).toBe(ESPECIE_RENOMEADA);

    // Act / Assert — listagem ordenada (HU-03 / RN-11).
    const listada = await request(app)
      .get('/api/species')
      .set('Authorization', `Bearer ${token}`);

    expect(listada.status).toBe(200);

    // A assercao e sobre AS ESPECIES DESTA EXECUCAO, e nao sobre o conteudo da
    // tabela. `species` e compartilhada: a primeira especie cadastrada pela tela
    // reprovaria um `toEqual` sobre a lista inteira, e o caso ficaria vermelho
    // por um motivo alheio ao que ele mede — falso vermelho sobre a suite que
    // sustenta a divida.
    //
    // O filtro NAO afrouxa a assercao. Ele preserva a ordem em que a API
    // devolveu os itens, entao a ordem alfabetica da RN-11 continua sendo
    // afirmada entre as duas especies desta execucao; e continua sendo um
    // `toEqual`, entao a renomeacao que nao persistisse, a especie que sumisse
    // da listagem ou uma terceira especie criada por engano pela suite reprovam
    // aqui do mesmo jeito.
    const nomesListadosDestaExecucao = colecaoSchema
      .parse(listada.body)
      .items.map((item) => item.name)
      .filter((name) => name.includes(MARCA_DA_EXECUCAO));

    expect(nomesListadosDestaExecucao).toEqual([ESPECIE_RENOMEADA, ESPECIE_LIVRE]);

    // A espécie LIVRE, criada neste mesmo banco, é excluída normalmente: a
    // guarda distingue as duas e não recusa por precaução.
    await expect(excluirEspecie(livre.id)).resolves.toMatchObject({ status: 204 });
  });
});

// --------------------------------------------------------------------------
// Auxiliares
// --------------------------------------------------------------------------

function envelopeDeErro(resposta: Response): z.infer<typeof envelopeDeErroSchema> {
  return envelopeDeErroSchema.parse(resposta.body);
}

/** Criacao pelo caminho de PRODUCAO: `POST /api/species`, sem atalho de banco. */
async function criarEspecie(name: string): Promise<string> {
  const resposta = await request(app)
    .post('/api/species')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });

  if (resposta.status !== 201) {
    throw new Error(`Falha ao criar a especie "${name}": ${resposta.status} ${resposta.text}`);
  }

  return especiePublicaSchema.parse(resposta.body).id;
}

function excluirEspecie(id: string): Promise<Response> {
  return request(app).delete(`/api/species/${id}`).set('Authorization', `Bearer ${token}`);
}

/**
 * Animal REAL, criado direto pelo Prisma e nao por `POST /api/animals`.
 *
 * Nao e um atalho para fugir da regra: o cadastro de animal exige upload de
 * imagem ao armazenamento de objetos, e o balde nao existe neste ambiente. O que
 * esta suite precisa e da LINHA em `animals` apontando para `species_id` — e ela
 * e escrita pelo banco de verdade, com a chave estrangeira de verdade. Nenhum
 * duble de repositorio entra no caminho (CA-38).
 */
async function criarAnimal(speciesId: string, name: string): Promise<string> {
  const animal = await prisma.animal.create({
    data: dadosDeAnimal(speciesId, name),
    select: { id: true },
  });

  return animal.id;
}

/**
 * Linha de `animals` pronta para o `INSERT`. Extraida porque o CT-85 precisa
 * inseri-la pela SESSAO PARALELA, e uma segunda copia dos campos faria as duas
 * sessoes divergirem na primeira coluna acrescentada ao modelo.
 */
function dadosDeAnimal(speciesId: string, name: string): Prisma.AnimalUncheckedCreateInput {
  return {
    id: randomUUID(),
    name,
    nameNormalized: name.toLowerCase(),
    speciesId,
    cityId: cidadeId,
    size: AnimalSize.MEDIO,
    sex: AnimalSex.MACHO,
    birthDate: null,
    description: null,
    acceptsOtherAnimals: false,
    needsLargeSpace: false,
  };
}

/**
 * Pausa real, e nao `jest.advanceTimersByTime`: o que se espera aqui e o
 * Postgres adquirir e liberar um bloqueio de linha, que e trabalho de outro
 * processo e nao anda com o relogio falso do Jest.
 *
 * Uso UNICO: o intervalo entre duas sondagens de `esperarPelaCondicao`. Nenhum
 * caso desta suite espera por tempo para decidir nada.
 */
function esperar(milissegundos: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, milissegundos);
  });
}

/**
 * Espera ate a condicao OBSERVADA ocorrer, ou falha nomeando qual nao ocorreu.
 *
 * A diferenca em relacao a uma pausa nao e de precisao, e de significado: uma
 * pausa afirma "provavelmente ja aconteceu" e continua verde quando nao
 * aconteceu; isto afirma "aconteceu, e eu vi". Esgotado o prazo, o caso falha —
 * e falha dizendo o que faltou, em vez de medir outra coisa em silencio.
 */
async function esperarPelaCondicao(
  descricao: string,
  condicao: () => Promise<boolean>,
): Promise<void> {
  const limite = Date.now() + PRAZO_MAXIMO_DA_OBSERVACAO_MS;

  while (Date.now() < limite) {
    if (await condicao()) {
      return;
    }

    await esperar(INTERVALO_ENTRE_SONDAGENS_MS);
  }

  throw new Error(
    `A condicao observada nunca ocorreu em ${PRAZO_MAXIMO_DA_OBSERVACAO_MS} ms: ${descricao}.`,
  );
}

/**
 * A linha da especie esta bloqueada por outra sessao?
 *
 * `pg_locks` NAO responde isso: bloqueio de LINHA vive no cabecalho da propria
 * tupla, e o que aparece no catalogo de locks e apenas o `RowShareLock` sobre a
 * RELACAO — que nao distingue qual linha nem qual especie. A pergunta precisa
 * ser feita a linha, e a forma de faze-la sem esperar por ela e pedir um
 * bloqueio conflitante com `NOWAIT`:
 *
 *   - `FOR UPDATE` conflita com o `FOR KEY SHARE` que o `INSERT` do animal toma
 *     sobre a especie referenciada;
 *   - `NOWAIT` faz o Postgres recusar na hora, com `55P03`, em vez de dormir.
 *
 * Enquanto a linha esta livre a sondagem apenas a bloqueia por um instante — o
 * comando sai fora de transacao explicita, entao o bloqueio e liberado no
 * mesmo comite implicito.
 */
async function linhaDeEspecieBloqueada(
  observador: PrismaClient,
  especieId: string,
): Promise<boolean> {
  try {
    await observador.$queryRaw`SELECT 1 FROM species WHERE id = ${especieId}::uuid FOR UPDATE NOWAIT`;

    return false;
  } catch (motivo: unknown) {
    if (sqlstateCru(motivo) === BLOQUEIO_INDISPONIVEL) {
      return true;
    }

    throw motivo;
  }
}

/**
 * Ha alguma sessao DORMINDO num bloqueio para mexer em `species`?
 *
 * Duas perguntas ao catalogo, e as duas precisam ser verdadeiras:
 *   1. `pg_stat_activity` mostra um comando ATIVO, de outra sessao, cujo texto
 *      cita `species` e cuja espera e do tipo `Lock` — nao `Client` (ocioso),
 *      nao `IO`;
 *   2. `pg_locks` registra ao menos um pedido NAO CONCEDIDO, que e a mesma
 *      espera vista do outro lado.
 *
 * Na corrida do CT-85 so existe um comando nessa situacao: o `DELETE` que o
 * `DeleteSpeciesService` emitiu como ULTIMA operacao da transacao dele. Ve-lo
 * bloqueado e, portanto, saber que a contagem da camada 1 ja terminou.
 */
async function exclusaoBloqueadaEmLock(observador: PrismaClient): Promise<boolean> {
  const [linha] = await observador.$queryRaw<ReadonlyArray<LinhaDaEspera>>`
    SELECT (SELECT count(*) FROM pg_stat_activity a
             WHERE a.pid <> pg_backend_pid()
               AND a.state = 'active'
               AND a.wait_event_type = 'Lock'
               AND a.query ILIKE '%species%')          AS comandos_esperando,
           (SELECT count(*) FROM pg_locks l
             WHERE NOT l.granted)                      AS pedidos_nao_concedidos
  `;

  if (linha === undefined) {
    throw new Error('A consulta ao catalogo de bloqueios voltou sem nenhuma linha.');
  }

  return linha.comandos_esperando > 0n && linha.pedidos_nao_concedidos > 0n;
}

async function criarImagem(animalId: string): Promise<void> {
  const posicao = await prisma.animalImage.count({ where: { animalId } });

  await prisma.animalImage.create({
    data: {
      id: randomUUID(),
      animalId,
      storagePath: `animals/${animalId}/${randomUUID()}.webp`,
      position: posicao,
      contentType: 'image/webp',
      sizeBytes: 1024,
    },
  });
}

/**
 * Contagens do ESCOPO DA SUITE, mais UMA pergunta global.
 *
 * O recorte nao e economia: o CT-82 afirma que a exclusao recusada nao mexeu em
 * nada, e fotografar o banco inteiro fazia essa afirmacao depender tambem de
 * ninguem mais estar escrevendo — no banco de desenvolvimento compartilhado,
 * uma escrita de outra sessao entre as duas fotografias produzia vermelho sem
 * que nada da regra estivesse errado. As linhas da suite sao identificadas pela
 * marca da execucao (especies) e pela cidade que a propria suite criou (animais
 * e imagens).
 *
 * `animais_sem_especie` fica GLOBAL de proposito, e e a unica que fica: ela nao
 * conta o que a suite fez, ela afirma o desfecho que a RN-09 proibe em qualquer
 * lugar da tabela. Um animal orfao fora do recorte continua sendo o defeito que
 * este caso existe para pegar.
 */
async function fotografar(): Promise<Fotografia> {
  /**
   * UMA consulta, e nao quatro contagens em `Promise.all`. O `DATABASE_URL`
   * deste projeto usa o pooler com `connection_limit=1`: quatro comandos
   * "paralelos" disputariam a mesma conexao e sairiam em fila, pagando quatro
   * idas a rede para responder o que uma unica linha responde.
   *
   * Em SQL CRU tambem por conteudo, e nao so por desempenho: `species_id` e NOT
   * NULL no schema, entao `animais_sem_especie` deveria ser sempre 0 — e afirmar
   * isso pelo Prisma seria afirmar o que se quis modelar, nao o que esta
   * gravado. A pergunta e feita a coluna do banco, que e o que a RN-09 protege.
   */
  const marca = `%${MARCA_DA_EXECUCAO}%`;

  const [linha] = await prisma.$queryRaw<ReadonlyArray<LinhaDaFotografia>>`
    SELECT (SELECT count(*) FROM species s
             WHERE s.name LIKE ${marca})                              AS especies,
           (SELECT count(*) FROM animals a
             WHERE a.city_id = ${cidadeId}::uuid)                     AS animais,
           (SELECT count(*) FROM animal_images i
             JOIN animals a ON a.id = i.animal_id
             WHERE a.city_id = ${cidadeId}::uuid)                     AS imagens,
           (SELECT count(*) FROM animals WHERE species_id IS NULL)    AS animais_sem_especie
  `;

  if (linha === undefined) {
    throw new Error('A fotografia do banco voltou sem nenhuma linha.');
  }

  return {
    especies: Number(linha.especies),
    animais: Number(linha.animais),
    imagens: Number(linha.imagens),
    animaisSemEspecie: Number(linha.animais_sem_especie),
  };
}

/** Devolve o motivo da rejeicao em vez de deixa-lo derrubar o teste. */
async function capturar(acao: () => Promise<unknown>): Promise<unknown> {
  try {
    await acao();
  } catch (motivo: unknown) {
    return motivo;
  }

  throw new Error('A operacao concluiu, mas a integridade referencial deveria te-la recusado.');
}

/**
 * `code` do erro do Prisma, ou a descricao do que veio no lugar. Estreita o
 * `unknown` por `instanceof` e nao por `as` (o projeto proibe a coercao), e faz
 * a falha dizer o que de fato chegou.
 */
function codigoDoPrisma(motivo: unknown): string {
  if (motivo instanceof Prisma.PrismaClientKnownRequestError) {
    return motivo.code;
  }

  return `nao e erro conhecido do Prisma: ${String(motivo)}`;
}

/**
 * Restricao que recusou a operacao, como o Prisma a reporta em
 * `meta.field_name`. E o nome da constraint no catalogo do Postgres — mais
 * especifico que o `P2003`, que so diz "alguma chave estrangeira".
 */
function constraintDoPrisma(motivo: unknown): string {
  if (!(motivo instanceof Prisma.PrismaClientKnownRequestError)) {
    return `nao e erro conhecido do Prisma: ${String(motivo)}`;
  }

  const nome: unknown = motivo.meta?.['field_name'];

  return typeof nome === 'string' ? nome : `sem field_name em meta: ${JSON.stringify(motivo.meta)}`;
}

/**
 * SQLSTATE CRU que o Postgres devolveu.
 *
 * So aparece quando o comando sai por `$executeRaw`: no caminho do motor de
 * consulta o Prisma traduz o erro e substitui o codigo do banco pelo seu
 * (`P2003`). O SQL cru e a unica forma de afirmar, dentro da suite, que o
 * numero que o Postgres devolve e literalmente `23503` — e nao a interpretacao
 * que o ORM faz dele.
 */
function sqlstateCru(motivo: unknown): string {
  if (!(motivo instanceof Prisma.PrismaClientKnownRequestError)) {
    return `nao e erro conhecido do Prisma: ${String(motivo)}`;
  }

  const codigo: unknown = motivo.meta?.['code'];

  return typeof codigo === 'string' ? codigo : `sem SQLSTATE em meta: ${JSON.stringify(motivo.meta)}`;
}

/**
 * ORDEM DE DEPENDENCIA, e nao ordem alfabetica: imagens, animais e so entao
 * especies. Invertida, a propria FK que a suite verifica derrubaria a limpeza.
 */
async function limparDadosDoCatalogo(): Promise<void> {
  await prisma.animalImage.deleteMany({ where: { animal: { cityId: cidadeId } } });
  await prisma.animal.deleteMany({ where: { cityId: cidadeId } });
  await prisma.species.deleteMany({ where: { name: { contains: MARCA_DA_EXECUCAO } } });
}

/**
 * Devolve o banco ao estado anterior a suite. Roda ANTES do primeiro teste
 * tambem, e nao so depois do ultimo: uma execucao interrompida no meio (Ctrl+C,
 * timeout) deixaria residuo que faria a proxima execucao falhar por nome
 * duplicado — um desfecho que nao diria nada sobre a regra medida.
 *
 * As especies sao varridas pelo PREFIXO da suite, e nao pelo nome de negocio:
 * "Cachorro" e "Peixe" sao nomes que alguem semeia a mao no banco de
 * desenvolvimento, e apagar o que a suite nao criou seria efeito colateral.
 */
async function limparResiduosDaSuite(): Promise<void> {
  if (cidadeId !== '') {
    await limparDadosDoCatalogo();
  }

  await prisma.animalImage.deleteMany({
    where: { animal: { city: { ibgeCode: CODIGO_IBGE_DA_CIDADE_DE_TESTE } } },
  });
  await prisma.animal.deleteMany({
    where: { city: { ibgeCode: CODIGO_IBGE_DA_CIDADE_DE_TESTE } },
  });
  await prisma.species.deleteMany({
    where: { name: { contains: PREFIXO_DAS_ESPECIES_DA_SUITE } },
  });
  await prisma.city.deleteMany({ where: { ibgeCode: CODIGO_IBGE_DA_CIDADE_DE_TESTE } });

  // `refresh_tokens` e `email_confirmation_tokens` cairiam por cascata junto com
  // o usuario; sao removidos explicitamente para que a contagem final nao dependa
  // de uma acao de FK declarada em outro arquivo.
  await prisma.refreshToken.deleteMany({ where: { user: { email: EMAIL_DO_ADMIN } } });
  await prisma.emailConfirmationToken.deleteMany({ where: { user: { email: EMAIL_DO_ADMIN } } });
  await prisma.user.deleteMany({ where: { email: EMAIL_DO_ADMIN } });
}
