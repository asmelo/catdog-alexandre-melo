import { env } from '~/config/env';
import { MESSAGES } from '~/domains/auth/auth.messages';
import type { MailerPort } from '~/infra/mail/mailer.port';
import { renderTemplate } from '~/infra/mail/template-renderer';

/**
 * Monta e envia o e-mail do link de confirmacao.
 *
 * Existe como colaborador proprio porque DOIS casos de uso precisam do mesmo
 * envio — o registro (HU-01) e o reenvio (HU-02/CT-07) — e duplicar a montagem
 * da URL, a renderizacao do template e a politica de falha nos dois services
 * seria a unica alternativa.
 */

const TEMPLATE_DE_CONFIRMACAO = 'account-confirmation';

/**
 * O mailer chega como FABRICA, nao como instancia: `createGmailTransport()`
 * exige as variaveis de SMTP e derruba o processo se faltarem, e a fabrica do
 * controller e executada no import das rotas. Com a instancia pronta no
 * construtor, o backend deixaria de subir em qualquer ambiente sem conta de
 * e-mail configurada — exatamente a propriedade que a TASK-BACKEND-003 tomou o
 * cuidado de preservar. Adiar a construcao para o primeiro envio transforma
 * "SMTP ausente" em falha de envio (logada, cadastro mantido) em vez de falha de
 * boot. O nodemailer sem `pool` abre uma conexao por mensagem de qualquer forma,
 * portanto reaproveitar o transporte nao economizaria conexao.
 */
export type MailerProvider = () => MailerPort;

export interface ConfirmationMailInput {
  readonly name: string;
  readonly email: string;
  /** Token em claro: vai para o e-mail e NUNCA para resposta HTTP ou log. */
  readonly rawToken: string;
}

/**
 * Aponta para o FRONTEND (`APP_WEB_URL`), nunca para a API: quem abre o link e
 * um navegador, e a confirmacao em si e um POST disparado pela tela.
 *
 * A barra final e removida porque `APP_WEB_URL` vem de configuracao e
 * "http://host/" produziria "http://host//confirmar-email".
 */
function montarUrlDeConfirmacao(rawToken: string): string {
  const base = env.APP_WEB_URL.replace(/\/+$/, '');

  return `${base}/confirmar-email?token=${encodeURIComponent(rawToken)}`;
}

/**
 * O template exige `supportEmail` e o projeto NAO tem variavel de e-mail de
 * suporte (ver checklist desta task): o endereco remetente e reaproveitado, que
 * e para onde o usuario escreveria ao responder a mensagem. Quando
 * `MAIL_FROM_ADDRESS` esta ausente, o envio nao teria como acontecer de
 * qualquer maneira — `createGmailTransport()` cobra a mesma variavel — e falhar aqui, antes
 * de abrir conexao, produz uma mensagem que aponta a causa. Sem `!`, sem `as`.
 */
function enderecoDeSuporte(): string {
  const remetente = env.MAIL_FROM_ADDRESS;

  if (remetente === undefined) {
    throw new Error(
      'MAIL_FROM_ADDRESS nao esta definida: ela e usada como endereco de contato ' +
        'do e-mail de confirmacao (placeholder {{supportEmail}} do template). ' +
        'Defina-a em .env (referencia: .env.example).',
    );
  }

  return remetente;
}

export class SendConfirmationMailService {
  constructor(private readonly criarMailer: MailerProvider) {}

  /**
   * PROPAGA a excecao. Tolerar a falha e decisao de cada caso de uso (o registro
   * responde 201 mesmo assim), e engoli-la aqui tiraria essa escolha de quem tem
   * o contexto para faze-la.
   */
  async execute(entrada: ConfirmationMailInput): Promise<void> {
    const { html, text } = renderTemplate(TEMPLATE_DE_CONFIRMACAO, {
      userName: entrada.name,
      confirmationUrl: montarUrlDeConfirmacao(entrada.rawToken),
      expirationHours: String(env.EMAIL_CONFIRMATION_TTL_HOURS),
      supportEmail: enderecoDeSuporte(),
    });

    await this.criarMailer().send({
      to: entrada.email,
      subject: MESSAGES.CONFIRMATION_MAIL_SUBJECT,
      html,
      text,
    });
  }
}

/**
 * Politica de falha de envio, compartilhada pelo registro e pelo reenvio: a
 * tabela de Integracoes da spec manda "registrar falha internamente" e permitir
 * reenvio manual. Derrubar o cadastro por indisponibilidade do Gmail perderia
 * uma conta que ja esta gravada e confirmada no banco.
 *
 * Registra `userId` e nunca o e-mail nem o token: log e destino de baixo
 * controle de acesso.
 */
export function logConfirmationMailFailure(userId: string): (motivo: unknown) => void {
  return (motivo: unknown): void => {
    console.error('[catdog-backend] Falha no envio do e-mail de confirmacao de conta:', {
      evento: 'confirmation_mail_send_failed',
      userId,
      motivo,
    });
  };
}
