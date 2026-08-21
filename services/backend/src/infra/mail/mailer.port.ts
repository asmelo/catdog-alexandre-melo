/**
 * Mensagem pronta para envio. `html` e `text` sao ambos obrigatorios: o corpo
 * alternativo em texto puro nao e enfeite — sem ele o Gmail penaliza a
 * entregabilidade, e o remetente desta aplicacao e uma conta `@gmail.com`
 * comum, ja no limite do que os filtros toleram.
 */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * Porta de saida de e-mail (inversao de dependencia).
 *
 * Os services de dominio dependem DESTA interface e nunca de `nodemailer`.
 * E o que permite injetar um duble nos testes e trocar o Gmail por um provedor
 * transacional editando um unico arquivo de infraestrutura.
 *
 * O contrato nao promete entrega, apenas aceitacao pelo servidor de saida: a
 * promise resolve quando o SMTP aceitou a mensagem, e rejeita em qualquer falha
 * — cabe a quem chama decidir se a falha derruba o caso de uso.
 */
export interface MailerPort {
  send(message: MailMessage): Promise<void>;
}
