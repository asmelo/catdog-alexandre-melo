import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { DateField } from '~/components/ui/date-field';

/**
 * O criterio que este arquivo existe para proteger e um so: o valor NAO passa por
 * `Date` em ponto nenhum. E uma regressao facil de introduzir — alguem acrescenta
 * uma formatacao "para exibir bonito" — e que so aparece a oeste de Greenwich,
 * isto e, para todos os usuarios do produto.
 */

describe('DateField', () => {
  it('preserva AAAA-MM-DD exatamente, sem conversão de fuso', () => {
    // Arrange & Act
    render(
      <DateField
        id="nascimento"
        label="Data de nascimento"
        value="2022-11-05"
        onChange={() => undefined}
      />,
    );

    // Assert — `new Date('2022-11-05')` é meia-noite UTC, e ler o dia em
    // America/Sao_Paulo devolveria 04. O componente não toca no texto.
    expect(screen.getByLabelText('Data de nascimento')).toHaveValue('2022-11-05');
  });

  it('a ida e a volta pelo campo preservam a data digitada', async () => {
    // Arrange — harness CONTROLADO de verdade. Com `value` fixo, o input nunca
    // reflete o que foi digitado e o teste mediria o harness, não o componente.
    const usuario = userEvent.setup();

    function Harness(): ReactElement {
      const [data, setData] = useState('');

      return (
        <DateField
          id="nascimento"
          label="Data de nascimento"
          value={data}
          onChange={(evento) => {
            setData(evento.target.value);
          }}
        />
      );
    }

    render(<Harness />);

    // Act
    await usuario.type(screen.getByLabelText('Data de nascimento'), '2022-11-05');

    // Assert — o valor volta idêntico ao digitado: nenhuma normalização, nenhum
    // deslocamento de um dia.
    expect(screen.getByLabelText('Data de nascimento')).toHaveValue('2022-11-05');
  });

  it('é um input de data nativo, sem biblioteca nem máscara', () => {
    // Arrange & Act
    render(<DateField id="nascimento" label="Data de nascimento" onChange={() => undefined} />);

    // Assert
    expect(screen.getByLabelText('Data de nascimento')).toHaveAttribute('type', 'date');
  });

  it('marca a obrigatoriedade por TEXTO, e não apenas pelo asterisco', () => {
    // Arrange & Act
    render(
      <DateField id="nascimento" label="Data de nascimento" required onChange={() => undefined} />,
    );

    // Assert — um asterisco sozinho é lido como "asterisco" ou ignorado.
    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
  });

  it('com erro, associa a mensagem ao campo por aria-describedby', () => {
    // Arrange & Act
    render(
      <DateField
        id="nascimento"
        label="Data de nascimento"
        error="Data inválida."
        onChange={() => undefined}
      />,
    );

    // Assert
    const campo = screen.getByLabelText('Data de nascimento');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'nascimento-error');
    expect(screen.getByText('Data inválida.')).toHaveAttribute('id', 'nascimento-error');
  });

  it('sem erro, NÃO emite aria-invalid nem aria-describedby', () => {
    // Arrange & Act — `''` conta como ausência de erro: bibliotecas de formulário
    // devolvem texto vazio para campo válido.
    render(
      <DateField id="nascimento" label="Data de nascimento" error="" onChange={() => undefined} />,
    );

    // Assert
    const campo = screen.getByLabelText('Data de nascimento');

    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo).not.toHaveAttribute('aria-describedby');
  });
});
