import { render, screen } from '@testing-library/react';

import { TextareaField } from '~/components/ui/textarea-field';

describe('TextareaField', () => {
  it('o contador é aria-live="polite", nunca assertive', () => {
    // Arrange & Act
    render(
      <TextareaField
        id="descricao"
        label="Descrição"
        maxLength={1000}
        showCounter
        value="abc"
        onChange={() => undefined}
      />,
    );

    // Assert — `assertive` interromperia o leitor de tela a cada tecla digitada e
    // tornaria o campo inutilizável.
    expect(screen.getByText('3/1000 caracteres')).toHaveAttribute('aria-live', 'polite');
  });

  it('sem `showCounter`, nenhum contador é renderizado', () => {
    // Arrange & Act
    render(
      <TextareaField
        id="descricao"
        label="Descrição"
        maxLength={1000}
        value="abc"
        onChange={() => undefined}
      />,
    );

    // Assert
    expect(screen.queryByText('3/1000 caracteres')).not.toBeInTheDocument();
  });

  it('aplica maxLength no elemento, como conveniência — sem substituir a validação', () => {
    // Arrange & Act
    render(
      <TextareaField
        id="descricao"
        label="Descrição"
        maxLength={1000}
        value=""
        onChange={() => undefined}
      />,
    );

    // Assert — o limite da RN-23 vale sobre o texto JÁ NORMALIZADO e quem recusa
    // é o servidor: um texto colado com espaços repetidos passa aqui e reprova lá.
    expect(screen.getByLabelText('Descrição')).toHaveAttribute('maxlength', '1000');
  });

  it('com erro, associa a mensagem ao campo', () => {
    // Arrange & Act
    render(
      <TextareaField
        id="descricao"
        label="Descrição"
        error="A descrição deve ter no máximo 1000 caracteres."
        value=""
        onChange={() => undefined}
      />,
    );

    // Assert
    const campo = screen.getByLabelText('Descrição');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'descricao-error');
  });
});
