import { Prisma, type PrismaClient, type User } from '@prisma/client';

import { env } from '~/config/env';
import { EmailAlreadyInUseError } from '~/domains/auth/errors/registration.errors';
import type {
  CreateEmailConfirmationTokenInput,
  EmailConfirmationTokenRepository,
} from '~/domains/auth/repositories/email-confirmation-token.repository';
import type {
  CreateUserInput,
  UserRepository,
} from '~/domains/auth/repositories/user.repository';
import {
  logConfirmationMailFailure,
  type SendConfirmationMailService,
} from '~/domains/auth/services/send-confirmation-mail.service';
import { addHours, now } from '~/utils/clock';
import { hashPassword } from '~/utils/password-hasher';
import { generateOpaqueToken, hashToken } from '~/utils/secure-token';

/**
 * HU-01 — registro de conta com status pendente e envio do link de confirmacao.
 */

export interface RegisterUserInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/**
 * `findByEmail` fecha a janela comum, mas nao a corrida: dois registros
 * simultaneos com o mesmo e-mail passam pela consulta juntos e o segundo bate na
 * constraint `users_email_key`. Traduzir o `P2002` do Prisma para o erro de
 * dominio faz os dois caminhos responderem o mesmo `409 EMAIL_ALREADY_IN_USE`
 * exigido pela RN-13 — sem isso, o perdedor da corrida receberia 500.
 *
 * O alvo e inspecionado para nao capturar a colisao de `token_hash` (unique
 * tambem), que seria um problema completamente diferente.
 */
function violaUnicidadeDeEmail(motivo: unknown): boolean {
  if (!(motivo instanceof Prisma.PrismaClientKnownRequestError) || motivo.code !== 'P2002') {
    return false;
  }

  // O Postgres devolve em `target` o nome do indice (`users_email_key`) ou a
  // lista de campos. `unknown` e inspecionado por tipo, sem stringificacao.
  const alvo: unknown = motivo.meta?.target;

  if (typeof alvo === 'string') {
    return alvo.includes('email');
  }

  if (Array.isArray(alvo)) {
    return alvo.some((campo) => typeof campo === 'string' && campo.includes('email'));
  }

  // Alvo nao identificavel: assume e-mail. As duas unicidades alcancadas por
  // esta transacao sao `users.email` e `token_hash`, e uma colisao de token de
  // 256 bits nao acontece — responder 409 e melhor que esconder a corrida da
  // RN-13 atras de um 500.
  return true;
}

export class RegisterUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: EmailConfirmationTokenRepository,
    private readonly confirmationMail: SendConfirmationMailService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(entrada: RegisterUserInput): Promise<void> {
    // RN-13: bloqueia em QUALQUER status, inclusive conta pendente de
    // confirmacao — quem perdeu o e-mail usa o reenvio, nao um novo cadastro.
    const jaCadastrado = await this.users.findByEmail(entrada.email);

    if (jaCadastrado !== null) {
      throw new EmailAlreadyInUseError();
    }

    const rawToken = generateOpaqueToken();

    const usuario = await this.criarContaPendente(
      {
        name: entrada.name,
        email: entrada.email,
        passwordHash: await hashPassword(entrada.password),
      },
      {
        tokenHash: hashToken(rawToken),
        expiresAt: addHours(now(), env.EMAIL_CONFIRMATION_TTL_HOURS),
      },
    );

    // FORA da transacao e depois do commit: um envio dentro dela manteria a
    // transacao aberta durante um round-trip de SMTP e, pior, um rollback
    // posterior deixaria o usuario com um link para uma conta inexistente.
    await this.confirmationMail
      .execute({ name: usuario.name, email: usuario.email, rawToken })
      .catch(logConfirmationMailFailure(usuario.id));
  }

  /**
   * Usuario e token na MESMA transacao: uma conta sem token seria uma conta
   * impossivel de ativar, e o reenvio ainda nao existiria para socorre-la.
   */
  private async criarContaPendente(
    dadosDoUsuario: CreateUserInput,
    dadosDoToken: Omit<CreateEmailConfirmationTokenInput, 'userId'>,
  ): Promise<User> {
    return this.prisma
      .$transaction(async (tx) => {
        const usuario = await this.users.withTransaction(tx).create(dadosDoUsuario);

        await this.tokens.withTransaction(tx).create({
          userId: usuario.id,
          tokenHash: dadosDoToken.tokenHash,
          expiresAt: dadosDoToken.expiresAt,
        });

        return usuario;
      },
        {
          // `maxWait` default do Prisma e 2 s. O DATABASE_URL desta aplicacao
          // usa o pooler do Supabase com `connection_limit=1`, entao
          // transacoes concorrentes se enfileiram por UMA conexao: medido em
          // 4 cadastros simultaneos, o quarto estourava os 2 s e o Prisma
          // lancava `P2028` ("Unable to start a transaction in the given
          // time"), que virava 500 para uma requisicao legitima. Esperar mais
          // e melhor que falhar; `timeout` limita a transacao em si.
          maxWait: 10000,
          timeout: 15000,
        },
      )
      .catch((motivo: unknown) => {
        if (violaUnicidadeDeEmail(motivo)) {
          throw new EmailAlreadyInUseError();
        }

        throw motivo;
      });
  }
}
