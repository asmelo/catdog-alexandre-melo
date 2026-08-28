import { render, screen } from '@testing-library/react';

import { TextInputField } from '~/components/ui/text-input-field';

/**
 * O membro da familia do `FieldShell` que a TASK-FRONTEND-017 precisou criar: o
 * campo de texto de uma linha com rotulo VISIVEL e marcacao de obrigatoriedade.
 *
 * O `TextField` do fluxo de autenticacao nao serve — o rotulo dele e `sr-only`
 * por decisao do mockup de login e ele nao tem asterisco.
 */

describe('TextInputField', () => {
  it('rótulo VISÍVEL associado ao campo, ao contrário do `TextField`', () => {
    render(<TextInputField id="name" label="Nome" onChange={() => undefined} />);

    const rotulo = screen.getByText('Nome');

    expect(rotulo).not.toHaveClass('sr-only');
    expect(rotulo).toHaveAttribute('for', 'name');
    expect(screen.getByLabelText('Nome')).toHaveAttribute('type', 'text');
  });

  it('com `required`, anuncia a obrigatoriedade por texto e marca o campo', () => {
    render(<TextInputField id="name" label="Nome" required onChange={() => undefined} />);

    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
  });

  it('sem `required`, nenhuma marcação é emitida', () => {
    render(<TextInputField id="apelido" label="Apelido" onChange={() => undefined} />);

    expect(screen.queryByText('(obrigatório)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Apelido')).not.toBeRequired();
  });

  it('com erro, associa a mensagem por `aria-describedby`', () => {
    render(
      <TextInputField
        id="name"
        label="Nome"
        error="Este campo é obrigatório."
        onChange={() => undefined}
      />,
    );

    const campo = screen.getByLabelText('Nome');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('sem erro, NÃO emite os atributos de erro', () => {
    render(<TextInputField id="name" label="Nome" onChange={() => undefined} />);

    const campo = screen.getByLabelText('Nome');

    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo).not.toHaveAttribute('aria-describedby');
  });
});
