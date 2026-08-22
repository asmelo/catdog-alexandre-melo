import { UserRole, UserStatus } from '@prisma/client';

import { env } from '~/config/env';
import { prisma } from '~/infra/prisma/prisma-client';
import { now } from '~/utils/clock';
import { hashPassword } from '~/utils/password-hasher';

/**
 * Provisionamento do administrador unico.
 *
 * Este script e o UNICO caminho pelo qual um usuario `ADMIN` passa a existir: o
 * auto-registro sempre produz `CLIENTE` (default do schema, e `role` nao e
 * parametro do `UserRepository.create`) e nenhum endpoint desta feature aceita
 * `role` no corpo. E assim que a restricao de arquitetura "apenas um
 * administrador / login fixo" conversa com o modelo de roles da spec (RN-08):
 * nao existe cadastro de administrador nem promocao de usuario, existe
 * provisionamento operacional.
 *
 * O admin NAO passa pelo fluxo de confirmacao por e-mail (RN-01/RN-02): ele
 * nasce `ACTIVE` com `emailConfirmedAt` preenchido, porque nao ha visitante para
 * confirmar nada — quem o cria e quem opera o sistema.
 */

/**
 * O nome nao vem de variavel de ambiente porque nao e credencial e nao muda
 * comportamento nenhum: e rotulo de exibicao. Uma terceira variavel de seed
 * seria mais uma coisa para faltar no deploy.
 */
const NOME_DO_ADMIN = 'Administrador CatDog';

interface CredenciaisDoAdmin {
  readonly email: string;
  readonly password: string;
}

/**
 * `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` sao `.optional()` no
 * `src/config/env.ts` — e precisam continuar sendo, porque o backend tem de
 * subir sem elas (o app nunca le essas variaveis; so este script le). O
 * estreitamento para `string` e feito aqui, com verificacao explicita e sem `!`
 * nem `as`, e a mensagem NOMEIA as variaveis ausentes.
 *
 * A verificacao vem ANTES de qualquer escrita: seed abortado nao deixa registro
 * pela metade. E nao existe senha default no codigo — um seed com fallback
 * embutido criaria, no primeiro deploy esquecido, um administrador com senha
 * publicamente conhecida.
 */
function credenciaisDoAdmin(): CredenciaisDoAdmin {
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;

  const ausentes = [
    ...(email === undefined ? ['SEED_ADMIN_EMAIL'] : []),
    ...(password === undefined ? ['SEED_ADMIN_PASSWORD'] : []),
  ];

  if (email === undefined || password === undefined) {
    throw new Error(
      `Seed do administrador abortado: defina ${ausentes.join(' e ')} em .env ` +
        '(referencia: .env.example) e rode de novo. Nenhum registro foi criado ou alterado. ' +
        'A senha precisa ter no minimo 8 caracteres.',
    );
  }

  return { email, password };
}

/**
 * `upsert` pelo e-mail (que e `@unique`) e o que torna o seed idempotente: rodar
 * duas vezes reprovisiona o MESMO usuario em vez de criar um segundo
 * administrador. A operacao e deliberadamente autoritativa — reexecutar reafirma
 * senha, role e status —, entao o script serve tambem para recuperar o acesso
 * caso a conta tenha sido desativada ou a senha perdida.
 *
 * A senha e persistida apenas como hash bcrypt (RNF-01 / CA-13), pelo mesmo
 * `hashPassword` do registro: nada de fluxo paralelo de hash para o admin.
 */
async function provisionarAdmin(credenciais: CredenciaisDoAdmin): Promise<string> {
  const instante = now();
  const passwordHash = await hashPassword(credenciais.password);

  const admin = await prisma.user.upsert({
    where: { email: credenciais.email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailConfirmedAt: instante,
    },
    create: {
      name: NOME_DO_ADMIN,
      email: credenciais.email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailConfirmedAt: instante,
    },
  });

  console.info(
    `[catdog-backend] Administrador provisionado: ${admin.email} ` +
      `(id=${admin.id}, role=${admin.role}, status=${admin.status}).`,
  );

  return admin.id;
}

/**
 * A restricao de arquitetura fala em UM administrador. O seed nao apaga nem
 * rebaixa ninguem — decisao destrutiva nao pertence a um script de
 * provisionamento —, mas tambem nao deixa a divergencia passar em silencio: se
 * houver outro `ADMIN` (por exemplo, um e-mail de seed trocado entre deploys), o
 * aviso diz quantos sao para que a limpeza seja uma decisao consciente de quem
 * opera.
 */
async function avisarSobreAdminsExtras(idProvisionado: string): Promise<void> {
  const extras = await prisma.user.count({
    where: { role: UserRole.ADMIN, id: { not: idProvisionado } },
  });

  if (extras > 0) {
    console.warn(
      `[catdog-backend] Atencao: existem ${extras} outro(s) usuario(s) com role ADMIN ` +
        'alem do provisionado agora. A arquitetura preve um unico administrador — ' +
        'revise manualmente qual deve permanecer.',
    );
  }
}

async function executarSeed(): Promise<void> {
  const idProvisionado = await provisionarAdmin(credenciaisDoAdmin());

  await avisarSobreAdminsExtras(idProvisionado);
}

/**
 * `process.exitCode` em vez de `process.exit(1)`: o codigo de saida precisa ser
 * diferente de zero para o `prisma db seed` e o CI acusarem a falha, mas
 * encerrar o processo na hora abortaria o `$disconnect` e deixaria a conexao do
 * pooler pendurada.
 *
 * Do erro sai apenas a mensagem, sem stack: a falha esperada deste script e
 * configuracao ausente, e uma stack de 20 linhas esconderia o nome da variavel
 * que falta.
 */
void executarSeed()
  .catch((motivo: unknown) => {
    console.error(
      '[catdog-backend] Seed do administrador falhou:',
      motivo instanceof Error ? motivo.message : motivo,
    );

    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
