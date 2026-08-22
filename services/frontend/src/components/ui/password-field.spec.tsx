import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';

import { PasswordField } from '~/components/ui/password-field';

/**
 * Specs do campo de senha.
 *
 * TODAS as interacoes por `userEvent`, e nao `fireEvent`. So o primeiro reproduz
 * a sequencia real de eventos do navegador (pointerdown, mousedown, focus,
 * pointerup, mouseup, click) e o movimento de foco. `fireEvent.click` dispara um
 * unico evento sintetico: um botao que submetesse por foco ou por `keydown`
 * passaria nele e falharia no navegador.
 */

const ROTULO = 'Senha';
const ID_DO_CAMPO = 'campo-de-senha';
const MENSAGEM_DE_ERRO = 'Este campo é obrigatório.';

function campo(): HTMLInputElement {
  return screen.getByLabelText(ROTULO);
}

function botaoDoOlho(nomeAcessivel: string): HTMLElement {
  return screen.getByRole('button', { name: nomeAcessivel });
}

describe('PasswordField — alternancia de visibilidade', () => {
  it('o olho alterna type entre password e text e inverte o aria-label', async () => {
    const usuario = userEvent.setup();

    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} />);

    expect(campo()).toHaveAttribute('type', 'password');
    // O rotulo descreve a ACAO disponivel, nao o estado atual: com a senha
    // oculta, a acao e "Mostrar senha".
    expect(botaoDoOlho('Mostrar senha')).toHaveAttribute('aria-pressed', 'false');

    await usuario.click(botaoDoOlho('Mostrar senha'));

    expect(campo()).toHaveAttribute('type', 'text');
    expect(botaoDoOlho('Ocultar senha')).toHaveAttribute('aria-pressed', 'true');

    await usuario.click(botaoDoOlho('Ocultar senha'));

    expect(campo()).toHaveAttribute('type', 'password');
    expect(botaoDoOlho('Mostrar senha')).toBeInTheDocument();
  });

  it('o valor digitado sobrevive a alternancia', async () => {
    const usuario = userEvent.setup();

    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} />);

    await usuario.type(campo(), 'SenhaValida1');
    await usuario.click(botaoDoOlho('Mostrar senha'));

    // A troca e de `type`, nao de elemento: se o React remontasse o input, o
    // valor se perderia e o usuario reveria um campo vazio.
    expect(campo()).toHaveValue('SenhaValida1');
  });

  it('clicar no olho dentro de um form NAO submete o formulario', async () => {
    const usuario = userEvent.setup();
    const aoSubmeter = jest.fn((evento: FormEvent) => {
      evento.preventDefault();
    });

    render(
      <form onSubmit={aoSubmeter}>
        <PasswordField id={ID_DO_CAMPO} label={ROTULO} />
        <button type="submit">Entrar</button>
      </form>,
    );

    await usuario.click(botaoDoOlho('Mostrar senha'));

    /**
     * Sem `type="button"` o padrao HTML de um `<button>` dentro de `<form>` e
     * `submit`: clicar no olho enviaria o formulario. E o erro classico deste
     * componente.
     */
    expect(aoSubmeter).not.toHaveBeenCalled();

    // Controle do teste: o formulario SUBMETE quando deve, entao a asserção acima
    // nao esta passando por um form que nunca submeteria.
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(aoSubmeter).toHaveBeenCalledTimes(1);
  });
});

describe('PasswordField — acessibilidade', () => {
  it('com error, o input recebe aria-invalid e aria-describedby apontando para a mensagem', () => {
    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} error={MENSAGEM_DE_ERRO} />);

    const entrada = campo();

    expect(entrada).toHaveAttribute('aria-invalid', 'true');
    expect(entrada).toHaveAttribute('aria-describedby', `${ID_DO_CAMPO}-error`);

    // O `aria-describedby` aponta para um elemento QUE EXISTE e que carrega o
    // texto: um id pendurado num elemento ausente nao e anunciado por nada.
    const mensagem = document.getElementById(`${ID_DO_CAMPO}-error`);

    expect(mensagem).not.toBeNull();
    expect(mensagem).toHaveTextContent(MENSAGEM_DE_ERRO);
  });

  it('sem error, os dois atributos estao AUSENTES e nao vazios', () => {
    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} />);

    const entrada = campo();

    // Ausencia, e nao `aria-invalid="false"`: e o que o criterio de aceite cobra.
    expect(entrada).not.toHaveAttribute('aria-invalid');
    expect(entrada).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(MENSAGEM_DE_ERRO)).toBeNull();
  });

  it('error como string vazia e tratado como ausencia de erro', () => {
    // Bibliotecas de formulario devolvem `''` para campo valido, e as telas do
    // projeto passam `errosDeCampo.password ?? ''` — marcar como invalido um campo
    // correto seria o defeito.
    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} error="" />);

    expect(campo()).not.toHaveAttribute('aria-invalid');
  });

  it('o rotulo e recuperavel por getByLabelText mesmo estando visualmente oculto', () => {
    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} placeholder="Informar a sua senha" />);

    const rotulo = screen.getByText(ROTULO);

    // `sr-only` esconde da tela SEM remover do DOM nem da arvore de
    // acessibilidade — por isso `getByLabelText` acha o campo. Placeholder nao e
    // rotulo: ele desaparece ao primeiro caractere digitado.
    expect(rotulo).toHaveClass('sr-only');
    expect(rotulo.tagName).toBe('LABEL');
    expect(campo()).toHaveAttribute('id', ID_DO_CAMPO);
    expect(campo()).toHaveAttribute('placeholder', 'Informar a sua senha');
  });

  it('os icones sao decorativos: o nome acessivel vem so do aria-label do botao', () => {
    render(<PasswordField id={ID_DO_CAMPO} label={ROTULO} />);

    const svg = botaoDoOlho('Mostrar senha').querySelector('svg');

    // Sem `aria-hidden`, o leitor de tela anunciaria a imagem ao lado do rotulo do
    // botao, duplicando a informacao.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
