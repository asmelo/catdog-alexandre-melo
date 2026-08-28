import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { SelectField, type SelectOption } from '~/components/ui/select-field';

/**
 * Campo de selecao (TASK-FRONTEND-014).
 *
 * O que se verifica aqui e a ANATOMIA e a acessibilidade — a associacao do
 * rotulo, o anuncio da obrigatoriedade, o par `aria-invalid`/`aria-describedby` e
 * a operacao por teclado. O comportamento de abrir e escolher e do `<select>`
 * nativo, e e por confiar nele que este componente nao reimplementa nada disso.
 */

const OPCOES: ReadonlyArray<SelectOption> = [
  { value: 'pequeno', label: 'Pequeno' },
  { value: 'medio', label: 'Médio' },
  { value: 'grande', label: 'Grande' },
];

describe('SelectField', () => {
  it('associa o rótulo ao `<select>` e anuncia a obrigatoriedade por TEXTO', () => {
    // Arrange & Act
    render(
      <SelectField
        id="porte"
        label="Porte"
        required
        options={OPCOES}
        value=""
        onChange={() => undefined}
      />,
    );

    // Assert — um asterisco sozinho é lido como "asterisco" ou ignorado; quem
    // anuncia é o texto ao lado, visualmente oculto.
    const campo = screen.getByLabelText(/^Porte/);

    expect(campo.tagName).toBe('SELECT');
    expect(campo).toHaveAttribute('id', 'porte');
    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
  });

  it('sem `required`, nenhuma marcação de obrigatoriedade é emitida', () => {
    render(
      <SelectField id="porte" label="Porte" options={OPCOES} value="" onChange={() => undefined} />,
    );

    expect(screen.queryByText('(obrigatório)')).not.toBeInTheDocument();
  });

  it('com erro, emite `aria-invalid` e aponta o `FieldError` por `aria-describedby`', () => {
    // Arrange & Act
    render(
      <SelectField
        id="porte"
        label="Porte"
        error="Este campo é obrigatório."
        options={OPCOES}
        value=""
        onChange={() => undefined}
      />,
    );

    // Assert
    const campo = screen.getByLabelText('Porte');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'porte-error');
    expect(screen.getByText('Este campo é obrigatório.')).toHaveAttribute('id', 'porte-error');
  });

  it('erro vazio conta como AUSÊNCIA de erro, e não como erro sem texto', () => {
    // Bibliotecas de formulário devolvem `''` para campo válido; emitir
    // `aria-invalid="true"` nesse caso marcaria como inválido um campo correto.
    render(
      <SelectField
        id="porte"
        label="Porte"
        error=""
        options={OPCOES}
        value=""
        onChange={() => undefined}
      />,
    );

    const campo = screen.getByLabelText('Porte');

    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo).not.toHaveAttribute('aria-describedby');
  });

  it('CT-34: desabilitado com placeholder exibe o texto e não aceita escolha', () => {
    // Arrange & Act — o estado "desabilitado sem estado escolhido" da HU-04.
    render(
      <SelectField
        id="cidade"
        label="Cidade"
        disabled
        options={[]}
        placeholder="Escolha primeiro o estado"
        value=""
        onChange={() => undefined}
      />,
    );

    // Assert
    expect(screen.getByLabelText('Cidade')).toBeDisabled();
    expect(
      screen.getByRole('option', { name: 'Escolha primeiro o estado' }),
    ).toBeInTheDocument();
  });

  it('a opção do placeholder é `disabled`: ela exibe o vazio, mas não é escolhível de volta', () => {
    // Sem isso o usuário desfaz uma escolha obrigatória e o formulário passa a
    // enviar texto vazio.
    render(
      <SelectField
        id="porte"
        label="Porte"
        options={OPCOES}
        placeholder="Selecione"
        value="medio"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('option', { name: 'Selecione' })).toBeDisabled();
  });

  it('exibe todas as opções recebidas, na ordem em que chegam', () => {
    render(
      <SelectField
        id="porte"
        label="Porte"
        options={OPCOES}
        value=""
        onChange={() => undefined}
      />,
    );

    expect(screen.getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Pequeno',
      'Médio',
      'Grande',
    ]);
  });

  it('RNF-16: é possível focar, escolher e confirmar apenas com o teclado', async () => {
    // Arrange — harness controlado: com `value` fixo o campo nunca refletiria a
    // escolha e o teste mediria o próprio teste.
    const usuario = userEvent.setup();

    function Harness(): ReactElement {
      const [porte, setPorte] = useState('');

      return (
        <SelectField
          id="porte"
          label="Porte"
          options={OPCOES}
          placeholder="Selecione"
          value={porte}
          onChange={(evento) => {
            setPorte(evento.target.value);
          }}
        />
      );
    }

    render(<Harness />);

    // Act
    await usuario.tab();

    expect(screen.getByLabelText('Porte')).toHaveFocus();

    await usuario.selectOptions(screen.getByLabelText('Porte'), 'grande');

    // Assert
    expect(screen.getByLabelText('Porte')).toHaveValue('grande');
  });

  it('`labelHidden` tira o rótulo da tela mas o MANTÉM na árvore de acessibilidade', () => {
    // É o que o campo da coluna ALTERAR STATUS usa: o cabeçalho da coluna é o
    // rótulo visível, mas sem `<label>` próprio o controle seria anunciado apenas
    // como "caixa de combinação", sem dizer de qual animal.
    render(
      <SelectField
        id="status-a1"
        label="Alterar status de Theo"
        labelHidden
        options={OPCOES}
        value="pequeno"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Alterar status de Theo' })).toBeInTheDocument();
    expect(screen.getByText('Alterar status de Theo')).toHaveClass('sr-only');
  });

  it('é sempre controlado: `value` ausente não faz o React alternar para não controlado', () => {
    // Arrange — sem o `value ?? ''` do componente, o React trata o campo como NÃO
    // controlado enquanto `value` for `undefined` e avisa no console assim que ele
    // passar a existir; junto com o aviso vem um campo que para de responder ao
    // estado. O `console.error` é a única forma de observar isso: o React não
    // expõe o aviso de outro jeito.
    const avisos = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act — com placeholder, a opção vazia existe e `''` é um valor selecionável.
    const { rerender } = render(
      <SelectField
        id="porte"
        label="Porte"
        options={OPCOES}
        placeholder="Selecione"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Porte')).toHaveValue('');

    rerender(
      <SelectField
        id="porte"
        label="Porte"
        options={OPCOES}
        placeholder="Selecione"
        value="grande"
        onChange={() => undefined}
      />,
    );

    // Assert
    expect(screen.getByLabelText('Porte')).toHaveValue('grande');
    expect(avisos).not.toHaveBeenCalled();
  });
});
