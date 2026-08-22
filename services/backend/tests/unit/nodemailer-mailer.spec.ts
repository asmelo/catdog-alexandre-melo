import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { Transporter } from 'nodemailer';

import type { MailMessage } from '~/infra/mail/mailer.port';
import { NodemailerMailer } from '~/infra/mail/nodemailer-mailer';

import { comAmbiente } from '../helpers/ambiente';

/**
 * Único arquivo do projeto autorizado a importar `nodemailer` (TASK-BACKEND-003).
 *
 * Nenhum teste aqui abre socket: `createTransport` do nodemailer NÃO conecta (a
 * conexão nasce no primeiro `sendMail`), e o `sendMail` é exercitado contra um
 * transporter dublado. A suíte roda com `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`
 * ausentes de propósito, então o caminho de erro é o default do ambiente.
 */

const MENSAGEM: MailMessage = {
  to: 'ana@exemplo.com',
  subject: 'Confirme sua conta na CatDog',
  html: '<p>ola</p>',
  text: 'ola',
};

const SMTP_COMPLETO = {
  SMTP_HOST: 'smtp.exemplo.invalido',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'conta@exemplo.invalido',
  SMTP_PASSWORD: 'app-password-de-teste',
  MAIL_FROM_ADDRESS: 'noreply@catdog.test',
  MAIL_FROM_NAME: 'CatDog',
} as const;

describe('createGmailTransport', () => {
  it('falha nomeando TODAS as variáveis de SMTP ausentes de uma vez', async () => {
    // Arrange
    await comAmbiente(
      { SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASSWORD: undefined },
      async () => {
        const { createGmailTransport } = await import('~/infra/mail/nodemailer-mailer');

        // Act & Assert — descobrir uma variável faltante por tentativa custaria
        // três reinícios de aplicação.
        expect(() => createGmailTransport()).toThrow(
          /SMTP_HOST, SMTP_USER, SMTP_PASSWORD/,
        );
      },
    );
  });

  it('falha também quando só o endereço remetente está ausente', async () => {
    // Arrange
    await comAmbiente({ ...SMTP_COMPLETO, MAIL_FROM_ADDRESS: undefined }, async () => {
      const { createGmailTransport } = await import('~/infra/mail/nodemailer-mailer');

      // Act & Assert
      expect(() => createGmailTransport()).toThrow(/MAIL_FROM_ADDRESS/);
    });
  });

  it('com o SMTP completo constrói o transporte com o remetente default, SEM abrir conexão', async () => {
    // Arrange
    await comAmbiente({ ...SMTP_COMPLETO }, async () => {
      const { createGmailTransport } = await import('~/infra/mail/nodemailer-mailer');

      // Act — `createTransport` só monta o objeto; a conexão nasce no primeiro
      // `sendMail`, que este teste não chama.
      const transporte = createGmailTransport();

      // Assert
      expect(transporte.options).toMatchObject({
        host: SMTP_COMPLETO.SMTP_HOST,
        port: 465,
        secure: true,
      });
      // `pool` é deliberadamente omitido: o default do nodemailer já é sem pool.
      expect(transporte.options).not.toHaveProperty('pool');
    });
  });
});

describe('NodemailerMailer', () => {
  it('repassa `to`, `subject`, `html` e `text` ao transporter e nada mais', async () => {
    // Arrange — o remetente vai como default do TRANSPORTE, não em cada envio.
    const transporter = transporterDublado();
    const mailer = new NodemailerMailer(transporter);

    // Act
    await mailer.send(MENSAGEM);

    // Assert — a asserção é sobre `.mock.calls` (e não sobre a referência do
    // método) para não desvincular `sendMail` do transporte: um método passado
    // solto perde o `this`, e é exatamente o erro que o `authenticate` das rotas
    // evita usando arrow function no controller.
    expect(transporter.sendMail.mock.calls).toEqual([
      [
        {
          to: MENSAGEM.to,
          subject: MENSAGEM.subject,
          html: MENSAGEM.html,
          text: MENSAGEM.text,
        },
      ],
    ]);
  });

  it('PROPAGA a falha de envio: decidir se ela derruba o caso de uso é do domínio', async () => {
    // Arrange — infraestrutura que engolisse o erro transformaria uma caixa de
    // entrada vazia em falha silenciosa.
    const indisponivel = new Error('550 mailbox unavailable');
    const transporter = transporterDublado();

    transporter.sendMail.mockRejectedValue(indisponivel);

    const mailer = new NodemailerMailer(transporter);

    // Act & Assert
    await expect(mailer.send(MENSAGEM)).rejects.toThrow(indisponivel);
  });
});

/**
 * `mockDeep<Transporter>` e não um objeto literal: o construtor exige o
 * `Transporter` do nodemailer, que tem dezenas de membros, e montar um dublê
 * estrutural exigiria um cast — que este projeto proíbe. O `DeepMockProxy` é
 * aceito pelo tipo e, se o `NodemailerMailer` passar a chamar outro método do
 * transporte, isso aparece como mock não configurado em vez de erro obscuro.
 *
 * Injetar o transporte (em vez de construí-lo dentro da classe) é justamente o
 * que torna o `NodemailerMailer` exercitável sem rede.
 */
function transporterDublado(): DeepMockProxy<Transporter> {
  const transporter = mockDeep<Transporter>();

  transporter.sendMail.mockResolvedValue(undefined);

  return transporter;
}
