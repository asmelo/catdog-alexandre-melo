import path from 'node:path';

/**
 * Ambiente determinístico da suíte. Executa como `setupFilesAfterEnv`, ou seja,
 * ANTES do primeiro import do arquivo de teste — e é isso que garante que
 * `src/config/env.ts` (que valida `process.env` no import e congela o resultado)
 * leia estes valores e não os da máquina do desenvolvedor.
 */

/**
 * Neutraliza o `import 'dotenv/config'` de `src/config/env.ts`.
 *
 * Sem isto o `.env` REAL do serviço seria carregado: ele traz a `DATABASE_URL` do
 * Supabase de produção do projeto, e um teste que escapasse do dublê de Prisma
 * escreveria no banco de verdade. O `dotenv` não sobrescreve chave já definida,
 * mas DEFINE as que faltam — apontar o caminho para um arquivo inexistente é o
 * que fecha essa porta por completo, em vez de depender de listar cada chave
 * aqui. O `dotenv` trata arquivo ausente como resultado com `error`, sem lançar.
 */
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, '.env.inexistente-de-proposito');
process.env.DOTENV_CONFIG_QUIET = 'true';

process.env.NODE_ENV = 'test';
process.env.PORT = '3333';

/**
 * URL sintaticamente válida e apontando para lugar nenhum: o construtor do
 * `PrismaClient` valida o esquema da string (`postgresql://`) e recusaria um
 * valor de fantasia, mas NÃO abre conexão — o Prisma conecta de forma preguiçosa,
 * no primeiro comando. Nenhum teste chega a emitir comando: o cliente é dublado.
 */
const URL_DE_BANCO_INEXISTENTE =
  'postgresql://usuario:senha@127.0.0.1:1/catdog_test?schema=public';

process.env.DATABASE_URL = URL_DE_BANCO_INEXISTENTE;
process.env.DIRECT_URL = URL_DE_BANCO_INEXISTENTE;

process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';

/** 54 caracteres — o schema exige no mínimo 32 e o valor precisa ser estável. */
process.env.JWT_ACCESS_SECRET = 'segredo-de-teste-deterministico-com-mais-de-32-chars';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_ISSUER = 'catdog-api';
process.env.JWT_AUDIENCE = 'catdog-web';

/** TTLs da spec: 7 dias de refresh (RN-06) e 24 h do link (RN-02). */
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.EMAIL_CONFIRMATION_TTL_HOURS = '24';

/**
 * Custo 4 (o mínimo aceito pelo schema) e não os 12 de produção: o bcrypt dobra
 * de tempo a cada incremento, e medido nesta máquina o hash cai de ~220 ms para
 * ~4 ms. A suíte faz dezenas de hashes; com custo 12 ela passaria de 30 s sem
 * testar nada de diferente. O custo REAL é responsabilidade da configuração de
 * ambiente, não do teste — nenhuma asserção depende deste número.
 */
process.env.BCRYPT_COST = '4';

process.env.APP_WEB_URL = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';

process.env.MAIL_FROM_NAME = 'CatDog';
process.env.MAIL_FROM_ADDRESS = 'noreply@catdog.test';

/**
 * `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD` ficam DELIBERADAMENTE ausentes.
 *
 * É a garantia estrutural do critério "nenhum teste abre socket de SMTP": mesmo
 * que algum caminho chegue a `createGmailTransport()`, ele lança
 * "Configuracao de SMTP incompleta" ANTES de construir o transporte — não existe
 * host para onde conectar. Os testes que precisam observar o e-mail usam o
 * `FakeMailer`, que implementa a `MailerPort` e nunca toca a rede.
 */
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;

/**
 * O limitador fica desligado por padrão: os limites reais são 5 logins por
 * 15 min e 3 reenvios por hora, e a suíte de integração dispara dezenas de
 * requisições nas mesmas rotas — com ele ligado, os testes passariam a falhar
 * por `429` em vez de exercitar a regra que pretendem testar.
 *
 * O middleware NÃO fica sem teste por isso: `tests/unit/rate-limit.middleware.spec.ts`
 * recarrega o módulo com `RATE_LIMIT_ENABLED=true` e exercita o bloqueio.
 */
process.env.RATE_LIMIT_ENABLED = 'false';

delete process.env.COOKIE_DOMAIN;
delete process.env.SEED_ADMIN_EMAIL;
delete process.env.SEED_ADMIN_PASSWORD;

/**
 * O tempo NÃO é congelado globalmente, e a decisão é medida.
 *
 * `jest.useFakeTimers()` no setup falsifica também `process.nextTick` e
 * `setImmediate`, de que dependem o `bcrypt` (trabalho assíncrono na threadpool
 * do libuv) e o servidor efêmero que o `supertest` levanta — a suíte trava sem
 * mensagem. Onde o instante importa, cada teste espiona a fonte de tempo única do
 * projeto (`jest.spyOn(clock, 'now')` sobre `~/utils/clock`), que é justamente o
 * motivo pelo qual esse módulo existe. Assim o determinismo é local, explícito e
 * não interfere no laço de eventos.
 */

afterEach(() => {
  /**
   * `clearMocks` do `jest.config.ts` zera as chamadas registradas, mas NÃO desfaz
   * um `jest.spyOn` — sem este `restoreAllMocks`, um relógio congelado num teste
   * continuaria congelado nos seguintes do mesmo arquivo, e a suíte passaria a
   * depender da ordem (o critério de aceite #2 proíbe exatamente isso).
   */
  jest.restoreAllMocks();
});
