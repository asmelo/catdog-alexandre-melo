import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { Animal, Paginated } from '~/domains/animals/animal.types';
import { AnimaisListPage } from '~/pages/admin/animais/animais-list-page';
import { ApiError } from '~/services/api/api-error';
import * as animalsApi from '~/services/api/animals-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Tela de listagem de animais (TASK-FRONTEND-016, verificada por TASK-FRONTEND-018).
 *
 * AS FUNCOES DE API SAO DUBLADAS, e nao o `fetch`: o objeto aqui e a TELA — quais
 * estados ela mostra, o que ela envia e quando. O que sai no `fetch` (URL, verbo,
 * corpo) e assunto de `animals-api.spec.ts`, que dubla um nivel abaixo. A guarda
 * de rede do `tests/setup.ts` continua ativa e reprovaria qualquer requisicao que
 * escapasse dos dublês.
 */

jest.mock('~/services/api/animals-api');

const apiDublada = jest.mocked(animalsApi);

const THEO: Animal = {
  id: 'a1111111-1111-4111-8111-111111111111',
  name: 'Theo',
  species: { id: 'e1', name: 'Cachorro' },
  size: 'grande',
  sex: 'macho',
  status: 'disponivel',
  birthDate: '2022-11-05',
  ageInYears: 3,
  description: null,
  acceptsOtherAnimals: false,
  needsLargeSpace: true,
  city: { id: 'c1', name: 'Boa Esperança', stateUf: 'ES' },
  images: [],
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

function animal(ajustes: Partial<Animal> & { readonly id: string }): Animal {
  return { ...THEO, ...ajustes };
}

function pagina(
  itens: ReadonlyArray<Animal>,
  ajustes: { readonly page?: number; readonly pageSize?: number; readonly total?: number } = {},
): Paginated<Animal> {
  return {
    items: itens,
    pagination: {
      page: ajustes.page ?? 1,
      pageSize: ajustes.pageSize ?? 20,
      total: ajustes.total ?? itens.length,
    },
  };
}

/** Observa a rota corrente, para verificar a navegação de "Cadastrar" e "Editar". */
function RotaAtual(): ReactElement {
  const local = useLocation();

  return <span data-testid="rota">{local.pathname}</span>;
}

function renderizar(): void {
  render(
    <MemoryRouter initialEntries={['/admin/animais']}>
      <RotaAtual />
      <Routes>
        <Route path="/admin/animais" element={<AnimaisListPage />} />
        <Route path="/admin/animais/novo" element={<p>formulário de cadastro</p>} />
        <Route path="/admin/animais/:id/editar" element={<p>formulário de edição</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * A célula de uma coluna, pelo ÍNDICE da ordem declarada em `COLUNAS`.
 *
 * Necessário porque o rótulo da situação aparece DUAS vezes na linha — no selo e
 * como `<option>` do campo de alteração —, e uma busca por texto solto encontra as
 * duas. Escopar pela célula também verifica, de quebra, que o valor está na coluna
 * certa: um `getByText` passaria mesmo se LOCALIZAÇÃO e ESPÉCIE trocassem de lugar.
 */
const COLUNA = {
  ANIMAL: 0,
  ESPECIE: 1,
  PORTE: 2,
  LOCALIZACAO: 3,
  STATUS: 4,
  ALTERAR_STATUS: 5,
  ACOES: 6,
} as const;

function celula(linha: HTMLElement, indice: number): HTMLElement {
  const celulas = within(linha).getAllByRole('cell');
  const alvo = celulas[indice];

  if (alvo === undefined) {
    throw new Error(`A linha não tem célula no índice ${String(indice)}.`);
  }

  return alvo;
}

function linhaDe(nome: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(nome) });
}

/** Espera a listagem sair do estado de carregando. */
async function aguardarLista(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: MESSAGES.ANIMALS.LOADING_LABEL })).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  apiDublada.listAnimals.mockResolvedValue(pagina([THEO]));
});

describe('cabeçalho e conteúdo da linha', () => {
  it('CA-02: título "Animais" e botão "Cadastrar Animal"', async () => {
    renderizar();
    await aguardarLista();

    expect(screen.getByRole('heading', { name: 'Animais', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar Animal' })).toBeInTheDocument();
  });

  it('CT-23/CA-03/CA-04/CA-05: as sete colunas, "Boa Esperança - ES" e o selo "Disponível"', async () => {
    renderizar();
    await aguardarLista();

    const cabecalhos = screen.getAllByRole('columnheader').map((celula) => celula.textContent);

    expect(cabecalhos).toEqual([
      'ANIMAL',
      'ESPÉCIE',
      'PORTE',
      'LOCALIZAÇÃO',
      'STATUS',
      'ALTERAR STATUS',
      'AÇÕES',
    ]);

    const linha = linhaDe('Theo');

    expect(celula(linha, COLUNA.ANIMAL)).toHaveTextContent('Theo');
    expect(celula(linha, COLUNA.ESPECIE)).toHaveTextContent('Cachorro');
    expect(celula(linha, COLUNA.PORTE)).toHaveTextContent('Grande');
    // A UF vem da cidade, e não de campo próprio do animal.
    expect(celula(linha, COLUNA.LOCALIZACAO)).toHaveTextContent('Boa Esperança - ES');
    // O selo, e não a `<option>` de mesmo texto no campo da coluna seguinte.
    expect(celula(linha, COLUNA.STATUS)).toHaveTextContent('Disponível');
  });

  it('CT-31: a miniatura é a imagem de `position` 0', async () => {
    apiDublada.listAnimals.mockResolvedValue(
      pagina([
        animal({
          id: THEO.id,
          images: [
            { id: 'i0', url: 'https://exemplo/capa.jpg', position: 0 },
            { id: 'i1', url: 'https://exemplo/outra.jpg', position: 1 },
          ],
        }),
      ]),
    );

    renderizar();
    await aguardarLista();

    expect(screen.getByRole('img', { name: 'Foto de Theo' })).toHaveAttribute(
      'src',
      'https://exemplo/capa.jpg',
    );
  });

  it('CT-32: sem imagens, a linha continua legível e nenhuma imagem é anunciada', async () => {
    renderizar();
    await aguardarLista();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Theo')).toBeInTheDocument();
  });

  it('CT-33/CA-46: Disponível sem foto exibe a pendência e NÃO bloqueia ação nenhuma', async () => {
    renderizar();
    await aguardarLista();

    expect(screen.getByText(MESSAGES.ANIMALS.PHOTO_PENDING)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Theo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Excluir Theo' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Alterar status de Theo' })).toBeEnabled();
  });

  it('a pendência de foto NÃO aparece quando o animal já foi adotado', async () => {
    apiDublada.listAnimals.mockResolvedValue(pagina([animal({ id: THEO.id, status: 'adotado' })]));

    renderizar();
    await aguardarLista();

    expect(screen.queryByText(MESSAGES.ANIMALS.PHOTO_PENDING)).not.toBeInTheDocument();
  });
});

describe('rodapé de contagem (CT-24, CA-06)', () => {
  it.each([
    { total: 0, esperado: 'Nenhum animal cadastrado' },
    { total: 1, esperado: 'Total: 1 animal' },
    { total: 2, esperado: 'Total: 2 animais' },
  ])('com $total animais, o rodapé diz "$esperado"', async ({ total, esperado }) => {
    const itens = Array.from({ length: total }, (_, i) => animal({ id: `id-${String(i)}` }));

    apiDublada.listAnimals.mockResolvedValue(pagina(itens, { total }));

    renderizar();
    await aguardarLista();

    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('CA-08: o total exibido é o GERAL, e não o da página', async () => {
    const vinte = Array.from({ length: 20 }, (_, i) => animal({ id: `id-${String(i)}` }));

    apiDublada.listAnimals.mockResolvedValue(pagina(vinte, { total: 45 }));

    renderizar();
    await aguardarLista();

    expect(screen.getByText('Total: 45 animais')).toBeInTheDocument();
  });
});

describe('paginação', () => {
  it('CT-27/CA-07: com o total cabendo numa página, NENHUM controle aparece no DOM', async () => {
    renderizar();
    await aguardarLista();

    expect(screen.queryByRole('navigation', { name: /Paginação/ })).not.toBeInTheDocument();
  });

  it('CT-26/CA-08: 45 animais em três páginas, cada um exibido exatamente uma vez', async () => {
    const usuario = userEvent.setup();

    function loteDa(paginaPedida: number): Paginated<Animal> {
      const inicio = (paginaPedida - 1) * 20;
      const tamanho = paginaPedida === 3 ? 5 : 20;

      return pagina(
        Array.from({ length: tamanho }, (_, i) =>
          animal({ id: `id-${String(inicio + i)}`, name: `Animal ${String(inicio + i)}` }),
        ),
        { page: paginaPedida, total: 45 },
      );
    }

    apiDublada.listAnimals.mockImplementation((params) =>
      Promise.resolve(loteDa(params?.page ?? 1)),
    );

    renderizar();
    await aguardarLista();

    const vistos = new Set<string>();

    function registrarPagina(): void {
      for (const celula of screen.getAllByText(/^Animal \d+$/)) {
        expect(vistos.has(celula.textContent ?? '')).toBe(false);
        vistos.add(celula.textContent ?? '');
      }
    }

    registrarPagina();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));
    await aguardarLista();
    registrarPagina();

    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));
    await aguardarLista();
    registrarPagina();

    expect(vistos.size).toBe(45);
    // O rodapé continua informando o total geral em qualquer página.
    expect(screen.getByText('Total: 45 animais')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('a paginação é do SERVIDOR: trocar de página refaz a consulta', async () => {
    const usuario = userEvent.setup();
    const quarenta = Array.from({ length: 20 }, (_, i) => animal({ id: `id-${String(i)}` }));

    apiDublada.listAnimals.mockResolvedValue(pagina(quarenta, { total: 45 }));

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(apiDublada.listAnimals).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    });
  });
});

describe('os quatro estados da tela', () => {
  it('carregando: o indicador ocupa o lugar da tabela e o cabeçalho PERMANECE visível', async () => {
    apiDublada.listAnimals.mockImplementation(() => new Promise(() => undefined));

    renderizar();

    expect(screen.getByRole('status', { name: MESSAGES.ANIMALS.LOADING_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // O que a tela NÃO pode fazer é piscar por inteiro e sumir com a única ação.
    expect(screen.getByRole('heading', { name: 'Animais' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar Animal' })).toBeInTheDocument();
  });

  it('CT-29: lista vazia exibe a frase da spec e o botão de cadastro continua disponível', async () => {
    apiDublada.listAnimals.mockResolvedValue(pagina([]));

    renderizar();
    await aguardarLista();

    expect(
      screen.getByText('Nenhum animal cadastrado ainda. Cadastre o primeiro no botão acima.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar Animal' })).toBeEnabled();
  });

  it('CT-30: falha na consulta exibe a mensagem com ação de nova tentativa, que refaz a consulta', async () => {
    const usuario = userEvent.setup();

    apiDublada.listAnimals.mockRejectedValueOnce(new Error('rede caiu'));

    renderizar();
    await aguardarLista();

    expect(
      screen.getByText('Não foi possível carregar os animais. Tente novamente.'),
    ).toBeInTheDocument();

    apiDublada.listAnimals.mockResolvedValue(pagina([THEO]));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.RETRY_BUTTON }));

    expect(await screen.findByText('Theo')).toBeInTheDocument();
  });
});

describe('alteração de status na linha', () => {
  it('CT-69/CA-30: escolher "Adotado" atualiza o selo e avisa o sucesso', async () => {
    const usuario = userEvent.setup();

    apiDublada.changeAnimalStatus.mockResolvedValue(animal({ id: THEO.id, status: 'adotado' }));
    apiDublada.listAnimals
      .mockResolvedValueOnce(pagina([THEO]))
      .mockResolvedValue(pagina([animal({ id: THEO.id, status: 'adotado' })]));

    renderizar();
    await aguardarLista();

    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Alterar status de Theo' }),
      'adotado',
    );

    expect(await screen.findByText('Status atualizado com sucesso.')).toBeInTheDocument();
    expect(apiDublada.changeAnimalStatus).toHaveBeenCalledWith(THEO.id, {
      status: 'adotado',
      // O token de concorrência é o `updatedAt` da linha carregada (RN-47).
      updatedAt: THEO.updatedAt,
    });

    await waitFor(() => {
      expect(celula(linhaDe('Theo'), COLUNA.STATUS)).toHaveTextContent('Adotado');
    });
  });

  it('CT-71: escolher o status JÁ VIGENTE não envia requisição nenhuma', async () => {
    const usuario = userEvent.setup();

    renderizar();
    await aguardarLista();

    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Alterar status de Theo' }),
      'disponivel',
    );

    // A asserção é sobre o DUBLÊ, e não sobre a tela: o que a regra proíbe é a
    // escrita, não a mudança visual (que aqui nem existe).
    expect(apiDublada.changeAnimalStatus).not.toHaveBeenCalled();
  });

  it('CT-74: falha genérica reverte o campo e exibe a mensagem da feature', async () => {
    const usuario = userEvent.setup();

    apiDublada.changeAnimalStatus.mockRejectedValue(new Error('rede caiu'));

    renderizar();
    await aguardarLista();

    const campo = screen.getByRole('combobox', { name: 'Alterar status de Theo' });

    await usuario.selectOptions(campo, 'reservado');

    expect(
      await screen.findByText('Não foi possível atualizar o status. Tente novamente.'),
    ).toBeInTheDocument();
    // Reversão: o campo volta ao que o servidor ainda tem.
    await waitFor(() => {
      expect(campo).toHaveValue('disponivel');
    });
  });

  it('CT-73: `ANIMAL_NOT_FOUND` exibe a mensagem da API e RECARREGA a lista', async () => {
    const usuario = userEvent.setup();

    apiDublada.changeAnimalStatus.mockRejectedValue(
      new ApiError({ status: 404, code: 'ANIMAL_NOT_FOUND', message: 'Animal não encontrado.' }),
    );
    apiDublada.listAnimals.mockResolvedValueOnce(pagina([THEO])).mockResolvedValue(pagina([]));

    renderizar();
    await aguardarLista();

    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Alterar status de Theo' }),
      'reservado',
    );

    expect(await screen.findByText('Animal não encontrado.')).toBeInTheDocument();
    // Sem a recarga, a linha fantasma continuaria na tela.
    await waitFor(() => {
      expect(screen.queryByText('Theo')).not.toBeInTheDocument();
    });
  });

  it('CT-67: `ANIMAL_STALE_UPDATE` exibe a mensagem da API, reverte e recarrega', async () => {
    const usuario = userEvent.setup();

    apiDublada.changeAnimalStatus.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'ANIMAL_STALE_UPDATE',
        message: 'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
      }),
    );

    renderizar();
    await aguardarLista();

    const campo = screen.getByRole('combobox', { name: 'Alterar status de Theo' });

    await usuario.selectOptions(campo, 'reservado');

    expect(
      await screen.findByText(
        'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(campo).toHaveValue('disponivel');
    });
    expect(apiDublada.listAnimals).toHaveBeenCalledTimes(2);
  });
});

describe('exclusão', () => {
  it('CT-77/CA-33: a confirmação traz o texto literal e CANCELAR não executa nada', async () => {
    const usuario = userEvent.setup();

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Excluir Theo' }));

    expect(
      screen.getByText('Excluir o animal “Theo”? Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.CANCEL_BUTTON }));

    expect(apiDublada.deleteAnimal).not.toHaveBeenCalled();
    expect(screen.getByText('Theo')).toBeInTheDocument();
  });

  it('CT-76: confirmar exclui, avisa o sucesso e atualiza a contagem', async () => {
    const usuario = userEvent.setup();

    apiDublada.deleteAnimal.mockResolvedValue(undefined);
    apiDublada.listAnimals
      .mockResolvedValueOnce(pagina([THEO]))
      .mockResolvedValue(pagina([], { total: 0 }));

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Excluir Theo' }));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: MESSAGES.ANIMALS.DELETE_ACTION,
      }),
    );

    expect(await screen.findByText('Animal excluído com sucesso.')).toBeInTheDocument();
    expect(apiDublada.deleteAnimal).toHaveBeenCalledWith(THEO.id);

    await waitFor(() => {
      expect(screen.getByText('Nenhum animal cadastrado')).toBeInTheDocument();
    });
  });

  it('CT-78: `ANIMAL_NOT_FOUND` na exclusão exibe a mensagem da API e recarrega', async () => {
    const usuario = userEvent.setup();

    apiDublada.deleteAnimal.mockRejectedValue(
      new ApiError({ status: 404, code: 'ANIMAL_NOT_FOUND', message: 'Animal não encontrado.' }),
    );
    apiDublada.listAnimals.mockResolvedValueOnce(pagina([THEO])).mockResolvedValue(pagina([]));

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Excluir Theo' }));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: MESSAGES.ANIMALS.DELETE_ACTION,
      }),
    );

    expect(await screen.findByText('Animal não encontrado.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Theo')).not.toBeInTheDocument();
    });
  });

  it('excluir o último item de uma página não-primeira volta uma página', async () => {
    const usuario = userEvent.setup();
    const vinte = Array.from({ length: 20 }, (_, i) => animal({ id: `id-${String(i)}` }));

    apiDublada.deleteAnimal.mockResolvedValue(undefined);
    apiDublada.listAnimals.mockImplementation((params) => {
      const paginaPedida = params?.page ?? 1;

      return Promise.resolve(
        paginaPedida === 2
          ? pagina([animal({ id: 'ultimo', name: 'Último' })], { page: 2, total: 21 })
          : pagina(vinte, { page: 1, total: 21 }),
      );
    });

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Excluir Último' }));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: MESSAGES.ANIMALS.DELETE_ACTION,
      }),
    );

    // Sem o recuo, o administrador ficaria olhando uma tabela vazia com
    // "Total: 20 animais" no rodapé.
    await waitFor(() => {
      expect(apiDublada.listAnimals).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
    });
  });
});

describe('navegação', () => {
  it('"Cadastrar Animal" leva a /admin/animais/novo', async () => {
    const usuario = userEvent.setup();

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Cadastrar Animal' }));

    expect(screen.getByTestId('rota')).toHaveTextContent('/admin/animais/novo');
  });

  it('"Editar" leva ao caminho de edição do animal da linha', async () => {
    const usuario = userEvent.setup();

    renderizar();
    await aguardarLista();

    await usuario.click(screen.getByRole('button', { name: 'Editar Theo' }));

    expect(screen.getByTestId('rota')).toHaveTextContent(`/admin/animais/${THEO.id}/editar`);
  });
});

describe('teclado (CT-94, CA-42)', () => {
  it('listar, alterar status, editar e excluir são alcançáveis e acionáveis por teclado', async () => {
    const usuario = userEvent.setup();

    renderizar();
    await aguardarLista();

    const campoDeStatus = screen.getByRole('combobox', { name: 'Alterar status de Theo' });
    const editar = screen.getByRole('button', { name: 'Editar Theo' });
    const excluir = screen.getByRole('button', { name: 'Excluir Theo' });

    campoDeStatus.focus();
    await usuario.tab();
    expect(editar).toHaveFocus();

    await usuario.tab();
    expect(excluir).toHaveFocus();

    await usuario.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
