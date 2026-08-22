import { SendConfirmationMailService } from '~/domains/auth/services/send-confirmation-mail.service';

import { FakeMailer } from '../fakes/fake-mailer';
import { comAmbiente } from '../helpers/ambiente';

/**
 * Montagem do e-mail de confirmação, compartilhada pelo registro (HU-01) e pelo
 * reenvio (HU-02/CT-07).
 *
 * O que este spec cobre e os outros não alcançam: a construção do LINK (que
 * aponta para o frontend, não para a API) e a exigência de `MAIL_FROM_ADDRESS`,
 * usada como endereço de contato do template.
 */

const ENTRADA = {
  name: 'Ana Silva',
  email: 'ana@exemplo.com',
  rawToken: 'token-em-claro-com-caracteres/especiais+e=iguais',
} as const;

describe('SendConfirmationMailService', () => {
  it('o link aponta para o FRONTEND e leva o token codificado na query', async () => {
    // Arrange — quem abre o link é um navegador; a confirmação em si é um POST
    // disparado pela tela.
    const mailer = new FakeMailer();
    const servico = new SendConfirmationMailService(() => mailer);

    // Act
    await servico.execute({ ...ENTRADA });

    // Assert
    const esperado = `http://localhost:5173/confirmar-email?token=${encodeURIComponent(
      ENTRADA.rawToken,
    )}`;

    expect(mailer.ultimaMensagem?.text).toContain(esperado);
    expect(mailer.ultimaMensagem?.html).toContain(esperado);
    expect(mailer.ultimaMensagem?.subject).toBe('Confirme sua conta na CatDog');
    expect(mailer.ultimaMensagem?.to).toBe(ENTRADA.email);
  });

  it('a barra final de APP_WEB_URL não produz barra dupla no link', async () => {
    // Arrange — `APP_WEB_URL` vem de configuração; "http://host/" geraria
    // "http://host//confirmar-email".
    await comAmbiente({ APP_WEB_URL: 'http://localhost:5173/' }, async () => {
      const { SendConfirmationMailService: Servico } = await import(
        '~/domains/auth/services/send-confirmation-mail.service'
      );
      const mailer = new FakeMailer();

      // Act
      await new Servico(() => mailer).execute({ ...ENTRADA });

      // Assert
      expect(mailer.ultimaMensagem?.text).toContain('http://localhost:5173/confirmar-email');
      expect(mailer.ultimaMensagem?.text).not.toContain('5173//');
    });
  });

  it('o mailer é construído PREGUIÇOSAMENTE, só no primeiro envio', async () => {
    // Arrange — a fábrica do controller roda no import das rotas; com a instância
    // pronta no construtor, o backend deixaria de subir em qualquer ambiente sem
    // conta de e-mail configurada.
    const fabrica = jest.fn(() => new FakeMailer());
    const servico = new SendConfirmationMailService(fabrica);

    // Assert — nada construído ainda.
    expect(fabrica).not.toHaveBeenCalled();

    // Act
    await servico.execute({ ...ENTRADA });

    // Assert
    expect(fabrica).toHaveBeenCalledTimes(1);
  });

  it('`MAIL_FROM_ADDRESS` ausente falha ANTES de abrir conexão, nomeando a variável', async () => {
    // Arrange — o template exige `supportEmail` e o projeto não tem variável de
    // e-mail de suporte; o remetente é reaproveitado.
    await comAmbiente({ MAIL_FROM_ADDRESS: undefined }, async () => {
      const { SendConfirmationMailService: Servico } = await import(
        '~/domains/auth/services/send-confirmation-mail.service'
      );
      const mailer = new FakeMailer();

      // Act & Assert
      await expect(new Servico(() => mailer).execute({ ...ENTRADA })).rejects.toThrow(
        /MAIL_FROM_ADDRESS nao esta definida/,
      );
      expect(mailer.sentMessages).toHaveLength(0);
    });
  });

  it('PROPAGA a falha de envio: tolerá-la é decisão de cada caso de uso', async () => {
    // Arrange
    const mailer = new FakeMailer();

    mailer.falharComoSmtpIndisponivel();

    // Act & Assert
    await expect(
      new SendConfirmationMailService(() => mailer).execute({ ...ENTRADA }),
    ).rejects.toThrow(/SMTP indisponivel/);
  });
});
