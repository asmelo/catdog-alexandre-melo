import { renderTemplate } from '~/infra/mail/template-renderer';

/**
 * Renderizador dos templates de e-mail (TASK-BACKEND-003).
 *
 * O caminho felizardo já é exercitado pelo registro; o que este spec cobre é o
 * ESCAPE (a única defesa contra injeção de HTML no corpo do e-mail) e as falhas
 * de programação, que são `Error` comum de propósito — um `AppError` faria o error
 * handler responder a mensagem interna como se fosse erro previsto.
 */

const TEMPLATE = 'account-confirmation';

const VARIAVEIS = {
  userName: 'Ana Silva',
  confirmationUrl: 'http://localhost:5173/confirmar-email?token=abc',
  expirationHours: '24',
  supportEmail: 'noreply@catdog.test',
} as const;

describe('renderTemplate', () => {
  it('renderiza os dois corpos e substitui todos os placeholders', () => {
    // Arrange & Act
    const { html, text } = renderTemplate(TEMPLATE, { ...VARIAVEIS });

    // Assert — nenhum `{{...}}` sobrando em nenhum dos dois corpos.
    expect(html).toContain('Ana Silva');
    expect(html).toContain(VARIAVEIS.confirmationUrl);
    expect(text).toContain(VARIAVEIS.confirmationUrl);
    expect(html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
    expect(text).not.toMatch(/\{\{\s*\w+\s*\}\}/);
  });

  it('escapa HTML no corpo `.html` e NÃO escapa no `.txt`', () => {
    // Arrange — um nome com marcação é a via de injeção: ele vem do formulário
    // de registro.
    const nomeHostil = '<script>alert("x")</script> & \'aspas\'';

    // Act
    const { html, text } = renderTemplate(TEMPLATE, { ...VARIAVEIS, userName: nomeHostil });

    // Assert
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    // No texto puro escapar faria o usuário ler `&amp;` literalmente e quebraria
    // a URL copiável.
    expect(text).toContain('<script>');
  });

  it('o escape de `&` acontece PRIMEIRO, sem escapar duas vezes as entidades geradas', () => {
    // Arrange & Act
    const { html } = renderTemplate(TEMPLATE, { ...VARIAVEIS, userName: '<a & b>' });

    // Assert — a ordem errada produziria `&amp;lt;`.
    expect(html).toContain('&lt;a &amp; b&gt;');
    expect(html).not.toContain('&amp;lt;');
  });

  it('nome de template fora da lista branca é recusado antes de tocar o disco', () => {
    // Arrange & Act & Assert — impede que um `../` escape do diretório de
    // templates.
    expect(() => renderTemplate('../../../etc/passwd', { ...VARIAVEIS })).toThrow(
      /Nome de template invalido/,
    );
    expect(() => renderTemplate('Account_Confirmation', { ...VARIAVEIS })).toThrow(
      /Nome de template invalido/,
    );
  });

  it('template inexistente falha com mensagem que aponta o `copy:templates`', () => {
    // Arrange & Act & Assert — o ENOENT cru não indicaria a causa provável.
    expect(() => renderTemplate('template-que-nao-existe', { ...VARIAVEIS })).toThrow(
      /copy:templates/,
    );
  });

  it('placeholder sem valor é tratado como BUG e falha, em vez de vazar `{{chave}}` para o usuário', () => {
    // Arrange — `Error` comum e não `AppError`: cai no ramo genérico do error
    // handler (500 + log de stack), sem publicar a mensagem interna.
    const semUserName = {
      confirmationUrl: VARIAVEIS.confirmationUrl,
      expirationHours: VARIAVEIS.expirationHours,
      supportEmail: VARIAVEIS.supportEmail,
    };

    // Act & Assert
    expect(() => renderTemplate(TEMPLATE, semUserName)).toThrow(
      /Variavel "userName" exigida pelo template/,
    );
  });

  it('a segunda renderização do mesmo template usa o cache e produz o mesmo resultado', () => {
    // Arrange — os arquivos são estáticos; reler a cada e-mail seria I/O
    // síncrono no caminho de uma requisição HTTP.
    const primeira = renderTemplate(TEMPLATE, { ...VARIAVEIS });

    // Act
    const segunda = renderTemplate(TEMPLATE, { ...VARIAVEIS });

    // Assert
    expect(segunda.html).toBe(primeira.html);
    expect(segunda.text).toBe(primeira.text);
  });
});
