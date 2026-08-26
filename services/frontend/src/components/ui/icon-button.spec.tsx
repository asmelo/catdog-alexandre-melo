import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IconButton } from '~/components/ui/icon-button';
import { PencilIcon, TrashIcon } from '~/components/ui/icons';

/**
 * Specs do botao de acao representado por icone (CT-38 / RNF-07).
 *
 * O QUE ESTE ARQUIVO PROTEGE e o NOME ACESSIVEL, e nada de aparencia. Um botao
 * so de icone e mudo para quem nao ve a tela: o `label` e a unica coisa que o
 * leitor de tela tem para anunciar, e um `<svg>` que escapasse da arvore de
 * acessibilidade passaria a competir com ele.
 *
 * NENHUMA asserção sobre classe de cor. As variantes `default` e `danger` ainda
 * estao em movimento (a captura de tela e a paleta divergem, ver o comentario do
 * `species-row.tsx`), e um `expect` sobre `text-brand-orange-dark` transformaria
 * a proxima decisao de produto em teste vermelho. O que e contrato aqui e o nome
 * acessivel e o `aria-hidden` do desenho.
 *
 * O `label` e passado como o teste precisa: quem compoe `${verbo} ${nome}` e o
 * `SpeciesRow`, e essa composicao e verificada em `species-row.spec.tsx`.
 */

const ROTULO = 'Editar espécie Gato';

describe('IconButton — nome acessivel', () => {
  it('CT-38: o botao e encontrado pelo nome acessivel composto, e nao por classe ou posicao', () => {
    // Arrange
    render(<IconButton label={ROTULO} icon={<PencilIcon />} onClick={jest.fn()} />);

    // Act
    const botao = screen.getByRole('button', { name: ROTULO });

    // Assert
    expect(botao).toBeInTheDocument();
    // `type="button"` explicito: o default do HTML e `submit`, e a linha da lista
    // pode acabar dentro de um `<form>` — o clique no lapis enviaria o formulario.
    expect(botao).toHaveAttribute('type', 'button');
  });

  it('CT-38: o desenho fica FORA da arvore de acessibilidade, para nao competir com o rotulo', () => {
    // Arrange
    const { container } = render(
      <IconButton label={ROTULO} icon={<PencilIcon />} onClick={jest.fn()} />,
    );

    // Act
    const desenho = container.querySelector('svg');

    // Assert
    expect(desenho).not.toBeNull();
    expect(desenho).toHaveAttribute('aria-hidden', 'true');
    // O `focusable="false"` neutraliza o Edge legado, que insere SVG na ordem de
    // tabulacao por conta propria: o alvo focavel precisa ser o `<button>`.
    expect(desenho).toHaveAttribute('focusable', 'false');
    // O ENVOLTORIO tambem esconde o desenho: `icon` e um `ReactNode` de
    // terceiros e o botao nao pode depender de o chamador ter lembrado disso.
    expect(desenho?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('CT-38: o rotulo tambem sai como dica de ferramenta, para quem usa mouse', () => {
    // Arrange
    const { container } = render(
      <IconButton label={ROTULO} icon={<TrashIcon />} onClick={jest.fn()} variant="danger" />,
    );

    // Act
    const dica = container.querySelector(`[title="${ROTULO}"]`);

    // Assert
    // O `title` mora no span `aria-hidden`, e nao no `<button>`: no botao ele
    // viraria a DESCRICAO acessivel e varios leitores anunciariam o rotulo duas
    // vezes (nome e depois descricao).
    expect(dica).not.toBeNull();
    expect(dica).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: ROTULO })).not.toHaveAttribute('title');
  });

  it('dois botoes da mesma acao sao distinguiveis pelo nome da especie', () => {
    // Arrange
    render(
      <>
        <IconButton label="Editar Gato" icon={<PencilIcon />} onClick={jest.fn()} />
        <IconButton label="Editar Cachorro" icon={<PencilIcon />} onClick={jest.fn()} />
      </>,
    );

    // Act
    const botoes = screen.getAllByRole('button');

    // Assert
    // E o ponto do RNF-07: "Editar" repetido em cada linha nao identifica nada, e
    // a lista viraria uma sequencia de botoes homonimos.
    expect(botoes).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Editar Gato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Cachorro' })).toBeInTheDocument();
  });
});

describe('IconButton — acionamento', () => {
  it('CT-37: o botao e acionavel por teclado, sem nenhum tratador escrito a mao', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoClicar = jest.fn();

    render(<IconButton label={ROTULO} icon={<PencilIcon />} onClick={aoClicar} />);

    // Act
    await usuario.tab();
    await usuario.keyboard('{Enter}');

    // Assert
    // `<button>` de verdade responde a Enter e Espaco de graca — e o que faz o
    // RNF-06 valer sem codigo de teclado proprio.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ROTULO }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('desabilitado, o botao nao aciona o callback nem entra na tabulacao', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoClicar = jest.fn();

    render(<IconButton label={ROTULO} icon={<PencilIcon />} onClick={aoClicar} disabled />);

    // Act
    await usuario.click(screen.getByRole('button', { name: ROTULO }));

    // Assert
    expect(screen.getByRole('button', { name: ROTULO })).toBeDisabled();
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('o padrao e HABILITADO: a prop ausente nao pode virar um botao morto', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoClicar = jest.fn();

    render(<IconButton label={ROTULO} icon={<PencilIcon />} onClick={aoClicar} />);

    // Act
    await usuario.click(screen.getByRole('button', { name: ROTULO }));

    // Assert
    // O componente normaliza `disabled === true`; um repasse cru deixaria
    // `undefined` chegar ao atributo e o comportamento dependeria do navegador.
    expect(screen.getByRole('button', { name: ROTULO })).toBeEnabled();
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });
});
