import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { ToggleField } from '~/components/ui/toggle-field';

/**
 * Alternancia liga/desliga (TASK-FRONTEND-014).
 *
 * O criterio que este arquivo protege e o que se perde primeiro numa reescrita
 * "com `div` e `role=switch`": a operacao por ESPACO e o anuncio do estado sem
 * nada escrito a mao. Os dois vem do `<input type="checkbox">` nativo, e e por
 * isso que o componente nao o substitui.
 */

describe('ToggleField', () => {
  it('é anunciado como alternância, com o rótulo associado', () => {
    render(
      <ToggleField
        id="aceita"
        label="Aceita outros animais"
        checked={false}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Aceita outros animais' })).toBeInTheDocument();
  });

  it('o estado é lido do DOM, e não apenas da cor (RNF-17)', () => {
    // Arrange & Act
    const { rerender } = render(
      <ToggleField id="aceita" label="Aceita outros animais" checked={false} onChange={() => undefined} />,
    );

    // Assert — desligado e ligado são distinguíveis por quem não enxerga cor.
    expect(screen.getByRole('switch')).not.toBeChecked();

    rerender(
      <ToggleField id="aceita" label="Aceita outros animais" checked onChange={() => undefined} />,
    );

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('a barra de ESPAÇO com o controle focado chama `onChange` com `true`', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(
      <ToggleField
        id="aceita"
        label="Aceita outros animais"
        checked={false}
        onChange={aoMudar}
      />,
    );

    // Act
    await usuario.tab();

    expect(screen.getByRole('switch')).toHaveFocus();

    await usuario.keyboard(' ');

    // Assert
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it('NÃO guarda estado próprio: sem a prop mudar, o controle não alterna', async () => {
    // Arrange — é isto que faz o "Cancelar" do formulário funcionar: o estado é
    // de quem monta, e sai da tela junto com ele.
    const usuario = userEvent.setup();

    render(
      <ToggleField
        id="aceita"
        label="Aceita outros animais"
        checked={false}
        onChange={() => undefined}
      />,
    );

    // Act
    await usuario.click(screen.getByRole('switch'));

    // Assert
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('ligado, o espaço chama `onChange` com `false`', async () => {
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<ToggleField id="aceita" label="Aceita" checked onChange={aoMudar} />);

    await usuario.tab();
    await usuario.keyboard(' ');

    expect(aoMudar).toHaveBeenCalledWith(false);
  });

  it('o clique no RÓTULO também alterna — a linha inteira é alvo', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<ToggleField id="aceita" label="Aceita outros animais" checked={false} onChange={aoMudar} />);

    // Act
    await usuario.click(screen.getByText('Aceita outros animais'));

    // Assert
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it('desabilitado, não alterna e sai da interação', async () => {
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(
      <ToggleField id="aceita" label="Aceita" checked={false} disabled onChange={aoMudar} />,
    );

    await usuario.click(screen.getByRole('switch'));

    expect(aoMudar).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('controlado de verdade: com estado do chamador, alterna nos dois sentidos', async () => {
    // Arrange
    const usuario = userEvent.setup();

    function Harness(): ReactElement {
      const [ligado, setLigado] = useState(false);

      return <ToggleField id="aceita" label="Aceita" checked={ligado} onChange={setLigado} />;
    }

    render(<Harness />);

    // Act & Assert
    await usuario.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toBeChecked();

    await usuario.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
});
