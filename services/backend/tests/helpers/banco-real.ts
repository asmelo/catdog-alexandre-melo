import fs from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { parse } from 'dotenv';

/**
 * Cliente Prisma ligado ao BANCO DE VERDADE, para a unica suite que precisa
 * dele: `tests/integration/species-animal-integrity.spec.ts`.
 *
 * ================== POR QUE ESTE ARQUIVO EXISTE ==================
 *
 * `tests/setup.ts` aponta `DATABASE_URL` para um endereco morto e neutraliza o
 * `dotenv` de proposito: nenhum teste que escape de um duble pode escrever no
 * banco do projeto. Essa protecao esta certa e NAO e afrouxada aqui — ela
 * continua valendo para as outras 24 suites, que seguem sem tocar a rede.
 *
 * A TASK-BACKEND-010 e a excecao declarada. Ela quita a divida da FEATURE-001:
 * a regra "especie com animais vinculados nao pode ser excluida" nasceu
 * verificavel apenas por duble, porque a entidade Animal nao existia. O ponto
 * inteiro da quitacao e tocar a tabela real e a chave estrangeira real — um
 * duble aqui reproduziria exatamente a lacuna que a task existe para fechar.
 *
 * ================== COMO A EXCECAO E CONTIDA ==================
 *
 * 1. `process.env.DATABASE_URL` NAO e tocado nem lido. A URL vem de
 *    `DATABASE_URL_INTEGRATION` — uma chave que `tests/setup.ts` nao define e que
 *    nenhum outro modulo consulta — ou, na sua ausencia, do arquivo `.env` lido
 *    com `dotenv.parse`. Nos dois casos ela e entregue ao construtor por
 *    `datasourceUrl`. Assim a `DATABASE_URL` morta do `tests/setup.ts` continua no
 *    ambiente, e qualquer outro cliente que alguem venha a construir continua
 *    indo para lugar nenhum.
 * 2. O acesso e por IMPORT EXPLICITO. Nenhuma suite recebe este cliente sem
 *    pedir por ele, e o unico pedido esta na suite de integridade.
 * 3. A suite que o usa cria os proprios dados, com nomes proprios, e os remove
 *    ao final na ordem de dependencia (imagens, animais, especies).
 *
 * ================== AS DUAS ORIGENS DA URL ==================
 *
 * `DATABASE_URL_INTEGRATION` vem PRIMEIRO, e ela existe para o CI: o
 * `.github/workflows/backend-ci.yml` levanta um Postgres descartavel como
 * `services:` do job, aplica as migrations e semeia a geografia, e aponta esta
 * variavel para ele. Sem essa porta a suite so teria como origem um arquivo
 * `gitignore`d, que no CI nunca existe — e o job quebraria no primeiro import.
 *
 * O arquivo `.env` continua sendo a origem na maquina do desenvolvedor, onde e
 * ele quem tem a URL do banco do projeto.
 */

/** `services/backend/.env` — dois niveis acima de `tests/helpers/`. */
const CAMINHO_DO_ENV = path.resolve(__dirname, '..', '..', '.env');

/**
 * Nome deliberadamente DIFERENTE de `DATABASE_URL`.
 *
 * `tests/setup.ts` sobrescreve `DATABASE_URL` com um endereco morto para que
 * nenhum teste fugido escreva no banco do projeto, e essa protecao nao pode ser
 * afrouxada para acomodar o CI. Uma chave propria deixa as duas coisas verdadeiras
 * ao mesmo tempo: o ambiente continua apontando para lugar nenhum, e a unica
 * suite autorizada a tocar banco tem por onde receber um banco descartavel.
 */
const VARIAVEL_DO_BANCO_DE_INTEGRACAO = 'DATABASE_URL_INTEGRATION';

/**
 * Falha ALTO e no primeiro import, em vez de pular a suite.
 *
 * Um `describe.skip` silencioso quando nao ha banco devolveria a suite verde sem
 * ter tocado banco nenhum — que e precisamente a forma de a divida ficar em
 * aberto de novo, agora com a aparencia de quitada. Se esta suite nao pode rodar,
 * quem executou precisa saber disso por uma mensagem que diga o que falta, e nao
 * por um numero de testes que ninguem confere. Vale igualmente no CI: um job que
 * perdesse o servico de Postgres tem de ficar VERMELHO.
 */
function urlDoBancoReal(): string {
  const doAmbiente = process.env[VARIAVEL_DO_BANCO_DE_INTEGRACAO];

  if (doAmbiente !== undefined && doAmbiente !== '') {
    return doAmbiente;
  }

  if (!fs.existsSync(CAMINHO_DO_ENV)) {
    throw new Error(
      'A suite de integridade referencial exige o banco real e nao encontrou nem ' +
        `\`${VARIAVEL_DO_BANCO_DE_INTEGRACAO}\` no ambiente nem o arquivo ${CAMINHO_DO_ENV}. ` +
        'Copie `.env.example` para `.env` e preencha `DATABASE_URL`, ou exporte ' +
        `\`${VARIAVEL_DO_BANCO_DE_INTEGRACAO}\` apontando para um banco descartavel.`,
    );
  }

  const url = parse(fs.readFileSync(CAMINHO_DO_ENV)).DATABASE_URL;

  if (url === undefined || url === '') {
    throw new Error(
      `${CAMINHO_DO_ENV} nao define \`DATABASE_URL\`, e a suite de integridade referencial ` +
        'nao pode ser verificada sobre duble — e a tabela e a chave estrangeira reais que ela mede.',
    );
  }

  return url;
}

/**
 * `log: ['error']` e nao os `['query', 'error', 'warn']` do cliente de
 * desenvolvimento: a suite emite dezenas de comandos e o log de query afogaria
 * a saida do Jest sem acrescentar nada a nenhuma assercao.
 */
export const prisma: PrismaClient = new PrismaClient({
  log: ['error'],
  datasourceUrl: urlDoBancoReal(),
});

/**
 * Sessao ADICIONAL, com pool proprio, para os casos que precisam de mais de uma
 * conexao simultanea ao mesmo banco.
 *
 * Nao e capricho: a `DATABASE_URL` deste projeto usa o pooler do Supabase com
 * `connection_limit=1`. Enquanto o `DeleteSpeciesService` mantem a transacao
 * dele aberta, o cliente acima nao tem uma segunda conexao para emprestar — um
 * comando concorrente emitido por ele esperaria pela conexao que a propria
 * transacao esta segurando e expiraria. Com clientes separados, as sessoes sao
 * de fato sessoes distintas, que e o que a corrida da RN-09 exige para ser
 * reproduzida em vez de encenada.
 *
 * O CT-85 (CA-36) abre DUAS: a que insere o animal sem comitar e a que OBSERVA o
 * catalogo do Postgres (`pg_locks`, `pg_stat_activity`) enquanto as outras duas
 * estao ocupadas — uma bloqueada e a outra segurando o bloqueio.
 *
 * Quem constroi e responsavel por chamar `$disconnect()`.
 */
export function abrirSessaoParalela(): PrismaClient {
  return new PrismaClient({ log: ['error'], datasourceUrl: urlDoBancoReal() });
}
