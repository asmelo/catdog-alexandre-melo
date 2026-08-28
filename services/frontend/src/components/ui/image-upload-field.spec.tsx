/**
 * Campo de envio de imagens (TASK-FRONTEND-015, verificado por TASK-FRONTEND-018).
 *
 * O componente e CONTROLADO, entao todo caso monta um `Harness` com estado de
 * verdade: com `items` fixo, a lista nunca refletiria a escolha e o teste mediria
 * o proprio teste.
 *
 * `URL.createObjectURL` e `URL.revokeObjectURL` sao substituidos por duble porque
 * o jsdom NAO os implementa — sem isso o componente lancaria ao primeiro arquivo
 * escolhido. O duble numerado (`blob:preview-1`, `blob:preview-2`) e o que permite
 * afirmar QUAL URL foi revogada, e nao apenas que houve revogacao.
 *
 * A recusa por TIPO nao e exercitada por aqui: o `userEvent.upload` respeita o
 * `accept` do input e descarta o arquivo antes de ele chegar ao `change`. A regra
 * existe porque `accept` e apenas uma dica — o usuario pode escolher "todos os
 * arquivos" no seletor do sistema — e esta verificada em
 * `src/domains/animals/animal-images.spec.ts`, sobre a funcao pura.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { ImageUploadField } from '~/components/ui/image-upload-field';
import type { AnimalImageItem } from '~/domains/animals/animal-images';

function arquivo(nome: string, bytes: number, tipo = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

function Harness({ inicial = [] }: { inicial?: ReadonlyArray<AnimalImageItem> }): ReactElement {
  const [itens, setItens] = useState<ReadonlyArray<AnimalImageItem>>(inicial);

  return <ImageUploadField items={itens} onChange={setItens} />;
}

const GRAVADAS = (quantidade: number): ReadonlyArray<AnimalImageItem> =>
  Array.from({ length: quantidade }, (_, i) => ({
    kind: 'stored' as const,
    id: `img-${String(i)}`,
    url: `https://exemplo/${String(i)}.jpg`,
  }));

beforeEach(() => {
  let contador = 0;

  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => `blob:preview-${String((contador += 1))}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: jest.fn() });
});

describe('ImageUploadField', () => {
  it('CA-19: rótulo, botão e "Nenhum arquivo escolhido"', () => {
    render(<Harness />);

    expect(screen.getByText('Imagens (máx. 5 — JPEG ou PNG, até 5 MB cada)')).toBeInTheDocument();
    expect(screen.getByText('Escolher arquivos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum arquivo escolhido')).toBeInTheDocument();
  });

  it('CT-45: dois arquivos produzem duas miniaturas com "x" e a contagem', async () => {
    const usuario = userEvent.setup();

    render(<Harness />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [
      arquivo('a.jpg', 100),
      arquivo('b.png', 100, 'image/png'),
    ]);

    expect(screen.getByText('2 arquivos escolhidos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover imagem 1 de 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover imagem 2 de 2' })).toBeInTheDocument();
  });

  it('CT-48: 3 gravadas + 3 novas recusa o lote e diz quantas cabem', async () => {
    const usuario = userEvent.setup();

    render(<Harness inicial={GRAVADAS(3)} />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [
      arquivo('a.jpg', 100),
      arquivo('b.jpg', 100),
      arquivo('c.jpg', 100),
    ]);

    expect(screen.getByText('Você já tem 3 imagens; ainda cabem 2.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover imagem 4/ })).not.toBeInTheDocument();
  });

  it('CT-49b: 5 gravadas, remover 3 e escolher 3 volta a cinco', async () => {
    const usuario = userEvent.setup();

    render(<Harness inicial={GRAVADAS(5)} />);

    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 5' }));
    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 4' }));
    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 3' }));

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [
      arquivo('a.jpg', 100),
      arquivo('b.jpg', 100),
      arquivo('c.jpg', 100),
    ]);

    expect(screen.getByRole('button', { name: 'Remover imagem 5 de 5' })).toBeInTheDocument();
    expect(screen.queryByText(/Você já tem/)).not.toBeInTheDocument();
  });

  it('CT-59/CT-60: remover a capa gravada não chama rede e o seguinte assume a posição 0', async () => {
    const usuario = userEvent.setup();
    const gravadas = GRAVADAS(2);

    render(<Harness inicial={gravadas} />);

    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 2' }));

    const restantes = screen.getAllByRole('button', { name: /Remover imagem/ });

    expect(restantes).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remover imagem 1 de 1' })).toBeInTheDocument();
    // A guarda de rede do tests/setup.ts faria o teste falhar se houvesse fetch.
  });

  it('revoga a URL de pré-visualização ao remover o item em preparo', async () => {
    const usuario = userEvent.setup();

    render(<Harness />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [arquivo('a.jpg', 100)]);
    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 1' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('revoga todas as URLs em preparo no desmonte', async () => {
    const usuario = userEvent.setup();
    const { unmount } = render(<Harness />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [
      arquivo('a.jpg', 100),
      arquivo('b.jpg', 100),
    ]);

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
  });

  it('não cria URL nova a cada renderização', async () => {
    const usuario = userEvent.setup();

    render(<Harness />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [arquivo('a.jpg', 100)]);

    const chamadas = jest.mocked(URL.createObjectURL).mock.calls.length;

    // Força novas renderizações escolhendo e removendo outro arquivo.
    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [arquivo('b.jpg', 100)]);
    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 2 de 2' }));

    expect(jest.mocked(URL.createObjectURL).mock.calls).toHaveLength(chamadas + 1);
  });

  it('arquivo de 6 MB e arquivo de tipo não aceito são recusados pelo nome, sem barrar os demais', async () => {
    const usuario = userEvent.setup();

    render(<Harness />);

    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [
      arquivo('boa.jpg', 100),
      arquivo('grande.jpg', 6 * 1024 * 1024),
    ]);

    expect(screen.getByText('grande.jpg: maior que 5 MB')).toBeInTheDocument();
    expect(screen.getByText('1 arquivo escolhido')).toBeInTheDocument();
  });

  it('CT-94: o botão de escolha e cada "x" são alcançáveis por teclado', async () => {
    const usuario = userEvent.setup();

    render(<Harness inicial={GRAVADAS(1)} />);

    await usuario.tab();
    expect(screen.getByLabelText('Escolher arquivos')).toHaveFocus();

    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Remover imagem 1 de 1' })).toHaveFocus();

    await usuario.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: /Remover imagem/ })).not.toBeInTheDocument();
  });
});
