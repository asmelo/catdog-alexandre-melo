import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '~/config/env';
import type { MailMessage, MailerPort } from '~/infra/mail/mailer.port';

/**
 * UNICO arquivo do projeto autorizado a importar `nodemailer`.
 *
 * O isolamento segue a mesma logica de `src/utils/password-hasher.ts`: se o
 * Gmail deixar de servir (limite diario de 500 mensagens, bloqueio por
 * reputacao) a troca por um provedor transacional custa a edicao deste arquivo
 * e de mais nenhum, porque todos os chamadores conhecem apenas `MailerPort`.
 */

/**
 * Chaves de SMTP que o `src/config/env.ts` declara como `.optional()`.
 *
 * Elas sao opcionais de proposito: o backend precisa subir em
 * desenvolvimento e no CI sem conta de e-mail configurada. O preco e que aqui
 * elas chegam como `string | undefined`, enquanto `createTransport` exige
 * `string` — por isso a exigencia e verificada neste ponto, e nao no boot.
 */
const CHAVES_SMTP_OBRIGATORIAS = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM_ADDRESS',
] as const;

/**
 * Monta o erro nomeando TODAS as chaves ausentes de uma vez, no mesmo espirito
 * da falha de boot de `src/config/env.ts`. Sem isso, quem configura o ambiente
 * descobriria uma variavel faltante por tentativa.
 */
function erroDeSmtpIncompleto(): Error {
  const ausentes = CHAVES_SMTP_OBRIGATORIAS.filter((chave) => env[chave] === undefined);

  return new Error(
    'Configuracao de SMTP incompleta: o envio de e-mail exige as variaveis ' +
      `${ausentes.join(', ')} definidas em .env (referencia: .env.example). ` +
      'Use uma App Password de 16 caracteres do Gmail em SMTP_PASSWORD, nunca a senha da conta.',
  );
}

/**
 * Estreita `string | undefined` para `string` sem `!`, `as` nem `any`. A
 * mensagem lancada e sempre a lista completa de ausentes, montada acima, e nao
 * apenas a chave que por acaso foi verificada primeiro.
 */
function exigirDefinida(valor: string | undefined): string {
  if (valor === undefined) {
    throw erroDeSmtpIncompleto();
  }

  return valor;
}

/**
 * Transporte SMTP do Gmail. Falha imediatamente se o ambiente nao estiver
 * configurado, em vez de construir um transporte quebrado que so acusaria o
 * problema no primeiro envio.
 *
 * `pool` nao e informado: o padrao do nodemailer ja e sem pool (a fabrica
 * decide por `if (options.pool)`), que e o que se quer aqui — o volume e
 * baixissimo e uma conexao de pool ociosa acaba derrubada pelo Gmail. O tipo
 * `SMTPTransport.Options` de `@types/nodemailer` nem declara a chave `pool`
 * (`SMTPPool.Options` a declara como o literal `true`), logo escrever
 * `pool: false` exigiria um cast — omitir e semanticamente identico e honesto.
 */
export function createGmailTransport(): Transporter {
  const remetente = `"${env.MAIL_FROM_NAME}" <${exigirDefinida(env.MAIL_FROM_ADDRESS)}>`;

  return nodemailer.createTransport(
    {
      host: exigirDefinida(env.SMTP_HOST),
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: exigirDefinida(env.SMTP_USER),
        pass: exigirDefinida(env.SMTP_PASSWORD),
      },
    },
    // O remetente vai como default do transporte, e nao em cada `sendMail`:
    // assim `NodemailerMailer` recebe apenas o transporter, como manda o
    // contrato, e a leitura de `env` fica confinada a esta fabrica.
    { from: remetente },
  );
}

export class NodemailerMailer implements MailerPort {
  /**
   * O transporter e injetado, nunca instanciado aqui: `createGmailTransport()`
   * abre conexao com o Gmail, e um construtor que fizesse isso tornaria a
   * classe impossivel de exercitar sem rede.
   */
  constructor(private readonly transporter: Transporter) {}

  /**
   * A excecao PROPAGA de proposito. Decidir se uma falha de envio derruba o
   * cadastro ou apenas registra um aviso e regra de negocio (TASK-BACKEND-004);
   * a infraestrutura que engolisse o erro tiraria essa escolha do dominio e
   * transformaria uma caixa de entrada vazia em falha silenciosa.
   */
  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
