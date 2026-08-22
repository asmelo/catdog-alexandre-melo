import type { MailMessage, MailerPort } from '~/infra/mail/mailer.port';

import { comoPromessa } from './restauravel';

/**
 * Dublê da porta de saída de e-mail. Acumula as mensagens em memória em vez de
 * abrir SMTP — é o que sustenta o critério "nenhum teste abre socket" sem
 * abandonar as asserções sobre o e-mail (assunto, destinatário, link e corpo).
 *
 * Implementa `MailerPort` de verdade: se a interface mudar, isto quebra na
 * compilação, e não em silêncio na execução.
 */
export class FakeMailer implements MailerPort {
  private readonly mensagens: MailMessage[] = [];

  /** Falha injetada, para exercitar a política de "cadastro criado mesmo assim". */
  private falha: Error | null = null;

  get sentMessages(): ReadonlyArray<MailMessage> {
    return this.mensagens;
  }

  get ultimaMensagem(): MailMessage | undefined {
    return this.mensagens.at(-1);
  }

  /**
   * Passa a rejeitar todo envio seguinte. Reproduz a indisponibilidade do Gmail
   * pelo mesmo caminho do real: `NodemailerMailer.send` PROPAGA a exceção e é o
   * caso de uso que decide tolerá-la.
   */
  falharComoSmtpIndisponivel(motivo = 'SMTP indisponivel no ambiente de teste'): void {
    this.falha = new Error(motivo);
  }

  limpar(): void {
    this.mensagens.length = 0;
    this.falha = null;
  }

  /**
   * A falha injetada sai como REJEIÇÃO da promessa, e não como exceção síncrona:
   * é o que o `NodemailerMailer` real faz, e é a forma que os `.catch()` dos
   * casos de uso esperam.
   */
  send(message: MailMessage): Promise<void> {
    return comoPromessa(() => {
      if (this.falha !== null) {
        throw this.falha;
      }

      this.mensagens.push(message);
    });
  }
}
