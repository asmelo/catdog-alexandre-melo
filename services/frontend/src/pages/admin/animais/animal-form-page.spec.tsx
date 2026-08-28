import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { Animal } from '~/domains/animals/animal.types';
import { AnimalFormPage } from '~/pages/admin/animais/animal-form-page';
import { ApiError } from '~/services/api/api-error';
import * as animalsApi from '~/services/api/animals-api';
import * as geographyApi from '~/services/api/geography-api';
import * as speciesApi from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

/**
 * Formulario de cadastro e edicao (TASK-FRONTEND-017, verificado por TASK-FRONTEND-018).
 *
 * As tres camadas de API sao dubladas; o que se observa aqui e a TELA. O corpo
 * multipart e inspecionado a partir do `FormData` que o dublê recebeu — e assim
 * que os criterios sobre `keepImageIds`, sobre a ausencia de `status` e sobre a
 * omissao dos opcionais vazios ficam verificados sobre o valor real, e nao sobre
 * o que a tela aparenta.
 */

jest.mock('~/services/api/animals-api');
jest.mock('~/services/api/geography-api');
jest.mock('~/services/api/species-api');

const animais = jest.mocked(animalsApi);
const geografia = jest.mocked(geographyApi);
const especies = jest.mocked(speciesApi);

const ID_DO_ANIMAL = 'a1111111-1111-4111-8111-111111111111';

const ESPECIES = [
  { id: 'e1', name: 'Cachorro', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'e2', name: 'Gato', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const ESTADOS = [
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'PR', name: 'Paraná' },
];

const CIDADES_PR = [
  { id: 'c-campo-magro', name: 'Campo Magro' },
  { id: 'c-curitiba', name: 'Curitiba' },
];

const CIDADES_ES = [{ id: 'c-boa-esperanca', name: 'Boa Esperança' }];

const THEO: Animal = {
  id: ID_DO_ANIMAL,
  name: 'Theo',
  species: { id: 'e1', name: 'Cachorro' },
  size: 'grande',
  sex: 'macho',
  status: 'disponivel',
  birthDate: '2022-11-05',
  ageInYears: 3,
  description: 'Theo',
  acceptsOtherAnimals: true,
  needsLargeSpace: false,
  city: { id: 'c-campo-magro', name: 'Campo Magro', stateUf: 'PR' },
  images: [
    { id: 'img-0', url: 'https://exemplo/0.jpg', position: 0 },
    { id: 'img-1', url: 'https://exemplo/1.jpg', position: 1 },
  ],
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};

function RotaAtual(): ReactElement {
  const local = useLocation();

  return <span data-testid="rota">{local.pathname}</span>;
}

function renderizar(rota: string): void {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <RotaAtual />
      <Routes>
        <Route path="/admin/animais" element={<p>listagem</p>} />
        <Route path="/admin/animais/novo" element={<AnimalFormPage />} />
        <Route path="/admin/animais/:id/editar" element={<AnimalFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Espera o formulário sair da carga inicial. */
async function aguardarFormulario(): Promise<void> {
  expect(await screen.findByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON })).toBeEnabled();
}

/** O corpo multipart que o dublê recebeu, como pares chave/valor. */
function corpoEnviado(chamada: FormData): ReadonlyArray<readonly [string, FormDataEntryValue]> {
  return [...chamada.entries()];
}

function valoresDe(corpo: FormData, chave: string): ReadonlyArray<FormDataEntryValue> {
  return corpo.getAll(chave);
}

function arquivo(nome: string, bytes = 100): File {
  return new File([new Uint8Array(bytes)], nome, { type: 'image/jpeg' });
}

beforeEach(() => {
  especies.listSpecies.mockResolvedValue({ items: ESPECIES });
  geografia.listStates.mockResolvedValue({ items: ESTADOS });
  geografia.listCitiesByState.mockImplementation((uf) =>
    Promise.resolve({ items: uf === 'PR' ? CIDADES_PR : CIDADES_ES }),
  );
  animais.getAnimal.mockResolvedValue(THEO);
  animais.createAnimal.mockResolvedValue(THEO);
  animais.updateAnimal.mockResolvedValue(THEO);

  let contador = 0;

  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => `blob:preview-${String((contador += 1))}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: jest.fn() });
});

describe('modo de cadastro', () => {
  it('CT-22/CT-68/CA-09: título, campos vazios, alternâncias desligadas e NENHUM campo de status', async () => {
    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    expect(screen.getByRole('heading', { name: 'Cadastrar Animal', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('');
    expect(screen.getByLabelText(/^Espécie/)).toHaveValue('');
    expect(screen.getByRole('switch', { name: 'Aceita outros animais' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Precisa de espaço grande' })).not.toBeChecked();

    // RN-16: a situação só muda pela coluna ALTERAR STATUS da listagem.
    expect(screen.queryByLabelText(/[Ss]tatus/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/[Ss]itua/)).not.toBeInTheDocument();
  });

  it('CA-09: os seis campos obrigatórios têm a obrigatoriedade anunciada por TEXTO', async () => {
    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    // Nome, Espécie, Porte, Sexo, Estado e Cidade — e apenas eles.
    expect(screen.getAllByText('(obrigatório)')).toHaveLength(6);
  });

  it('CT-09/CA-12: formulário vazio sinaliza TODOS os obrigatórios de uma vez, foca o primeiro e NÃO envia', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    // Cinco campos validados (o Estado não é campo do contrato — RN-26a).
    expect(screen.getAllByText('Este campo é obrigatório.')).toHaveLength(5);
    expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
    expect(animais.createAnimal).not.toHaveBeenCalled();
  });

  it('CT-34: sem estado escolhido, Cidade está desabilitada exibindo "Escolha primeiro o estado"', async () => {
    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    const cidade = screen.getByLabelText(/^Cidade/);

    expect(cidade).toBeDisabled();
    expect(within(cidade).getByRole('option', { name: 'Escolha primeiro o estado' })).toBeInTheDocument();
  });

  it('CT-35/CT-36: escolhido "PR", exibe "Carregando cidades..." e depois só cidades do Paraná', async () => {
    const usuario = userEvent.setup();
    let liberar = (): void => undefined;

    geografia.listCitiesByState.mockImplementation(
      () =>
        new Promise((resolver) => {
          liberar = () => {
            resolver({ items: CIDADES_PR });
          };
        }),
    );

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');

    const cidade = screen.getByLabelText(/^Cidade/);

    expect(within(cidade).getByRole('option', { name: 'Carregando cidades...' })).toBeInTheDocument();
    expect(cidade).toBeDisabled();

    liberar();

    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });

    expect(screen.getByRole('option', { name: 'Campo Magro' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Boa Esperança' })).not.toBeInTheDocument();
  });

  it('CT-37/CA-15/CA-17: trocar de estado DESCARTA a cidade escolhida', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });

    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');
    expect(screen.getByLabelText(/^Cidade/)).toHaveValue('c-campo-magro');

    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'ES');

    // "Campo Magro - ES" fica IMPOSSÍVEL de representar, em vez de ser um erro a
    // validar depois.
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toHaveValue('');
    });
    expect(screen.queryByRole('option', { name: 'Campo Magro' })).not.toBeInTheDocument();
  });

  it('CT-38/RN-57: a resposta obsoleta de "PR" chegando por último é DESCARTADA', async () => {
    const usuario = userEvent.setup();
    const liberadores = new Map<string, () => void>();

    geografia.listCitiesByState.mockImplementation(
      (uf) =>
        new Promise((resolver) => {
          liberadores.set(uf, () => {
            resolver({ items: uf === 'PR' ? CIDADES_PR : CIDADES_ES });
          });
        }),
    );

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'ES');

    // A resposta de ES chega primeiro; a de PR, depois — a ordem que quebra.
    liberadores.get('ES')?.();
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });

    liberadores.get('PR')?.();

    // Sem a guarda, o campo passaria a listar municípios do Paraná com "ES"
    // selecionado — e o administrador gravaria a cidade errada em silêncio.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Boa Esperança' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: 'Campo Magro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Curitiba' })).not.toBeInTheDocument();
  });

  it('CT-39/CA-16: falha ao carregar cidades exibe a mensagem com nova tentativa, e NUNCA campo vazio', async () => {
    const usuario = userEvent.setup();

    geografia.listCitiesByState.mockRejectedValueOnce(new Error('rede caiu'));

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');

    expect(
      await screen.findByText('Não foi possível carregar as cidades. Tente novamente.'),
    ).toBeInTheDocument();
    // Um campo de seleção vazio se leria como "este estado não tem cidades".
    expect(screen.getByLabelText(/^Cidade/)).toBeDisabled();
    // O restante do formulário continua preenchível.
    expect(screen.getByLabelText(/^Nome/)).toBeEnabled();

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.RETRY_BUTTON }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    expect(screen.getByRole('option', { name: 'Campo Magro' })).toBeInTheDocument();
  });

  it('CT-02/CA-11/CA-17: só os obrigatórios — sem data, descrição nem imagens — conclui, com `cityId` e SEM estado nem status', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo');
    await usuario.selectOptions(screen.getByLabelText(/^Espécie/), 'e1');
    await usuario.selectOptions(screen.getByLabelText(/^Porte/), 'grande');
    await usuario.selectOptions(screen.getByLabelText(/^Sexo/), 'macho');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    await waitFor(() => {
      expect(animais.createAnimal).toHaveBeenCalledTimes(1);
    });

    const corpo = animais.createAnimal.mock.calls[0]?.[0] as FormData;
    const chaves = corpoEnviado(corpo).map(([chave]) => chave);

    expect(corpo.get('cityId')).toBe('c-campo-magro');
    expect(corpo.get('acceptsOtherAnimals')).toBe('false');
    // Vazios são OMITIDOS, e não enviados como texto vazio — texto vazio é um
    // valor, e um valor inválido.
    expect(chaves).not.toContain('birthDate');
    expect(chaves).not.toContain('description');
    expect(chaves).not.toContain('images');
    // RN-26a: só a cidade trafega. E `status` nunca (CT-14).
    expect(chaves).not.toContain('state');
    expect(chaves).not.toContain('stateUf');
    expect(chaves).not.toContain('status');
    // O cadastro não envia token de concorrência.
    expect(chaves).not.toContain('updatedAt');
    expect(chaves).not.toContain('keepImageIds');
  });

  it('CT-93: dois acionamentos em sequência criam apenas UM animal', async () => {
    const usuario = userEvent.setup();
    let liberar = (): void => undefined;

    animais.createAnimal.mockImplementation(
      () =>
        new Promise((resolver) => {
          liberar = () => {
            resolver(THEO);
          };
        }),
    );

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo');
    await usuario.selectOptions(screen.getByLabelText(/^Espécie/), 'e1');
    await usuario.selectOptions(screen.getByLabelText(/^Porte/), 'grande');
    await usuario.selectOptions(screen.getByLabelText(/^Sexo/), 'macho');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');

    const salvar = screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON });

    await usuario.click(salvar);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVING })).toBeDisabled();
    });

    liberar();

    await waitFor(() => {
      expect(animais.createAnimal).toHaveBeenCalledTimes(1);
    });
  });

  it('sucesso volta à listagem com a mensagem de cadastro', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo');
    await usuario.selectOptions(screen.getByLabelText(/^Espécie/), 'e1');
    await usuario.selectOptions(screen.getByLabelText(/^Porte/), 'grande');
    await usuario.selectOptions(screen.getByLabelText(/^Sexo/), 'macho');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    await waitFor(() => {
      expect(screen.getByTestId('rota')).toHaveTextContent('/admin/animais');
    });
  });
});

describe('modo de edição', () => {
  it('CT-40: carrega o animal, estado e cidade corretos, e o título muda', async () => {
    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    expect(screen.getByRole('heading', { name: 'Editar Animal', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Theo');
    expect(screen.getByLabelText(/^Data de nascimento/)).toHaveValue('2022-11-05');
    expect(screen.getByLabelText(/^Estado/)).toHaveValue('PR');

    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toHaveValue('c-campo-magro');
    });

    expect(screen.getByRole('switch', { name: 'Aceita outros animais' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Precisa de espaço grande' })).not.toBeChecked();
  });

  it('CT-41/CA-47: cidade gravada fora da lista ativa continua escolhida, e não some em silêncio', async () => {
    // A cidade do animal não está mais no recorte devolvido pelo servidor.
    geografia.listCitiesByState.mockResolvedValue({ items: CIDADES_PR.slice(1) });

    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toHaveValue('c-campo-magro');
    });
    // Sem isto, o `<select>` ficaria com valor sem `<option>` casando, o navegador
    // o exibiria em branco e o animal seria salvo sem localização.
    expect(screen.getByRole('option', { name: 'Campo Magro' })).toBeInTheDocument();
  });

  it('CT-58/CT-61: `keepImageIds` traz só o mantido, na ordem exibida, e o arquivo novo vai em `images`', async () => {
    const usuario = userEvent.setup();

    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    // Remove a capa; a segunda imagem assume a posição 0.
    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 2' }));
    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [arquivo('nova.jpg')]);

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    await waitFor(() => {
      expect(animais.updateAnimal).toHaveBeenCalledTimes(1);
    });

    const [idEnviado, corpo] = animais.updateAnimal.mock.calls[0] as [string, FormData];

    expect(idEnviado).toBe(ID_DO_ANIMAL);
    expect(corpo.get('keepImageIds')).toBe(JSON.stringify(['img-1']));
    expect(valoresDe(corpo, 'images')).toHaveLength(1);
    // Token de concorrência da RN-47.
    expect(corpo.get('updatedAt')).toBe(THEO.updatedAt);
    // CT-68: nem na edição.
    expect(corpoEnviado(corpo).map(([chave]) => chave)).not.toContain('status');
  });

  it('CT-59/CT-65/CA-25: "Cancelar" volta à listagem SEM remover imagem alguma', async () => {
    const usuario = userEvent.setup();

    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Remover imagem 1 de 2' }));
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.CANCEL_BUTTON }));

    // Nenhuma escrita: a marcação de remoção é descartada junto com o formulário.
    expect(animais.updateAnimal).not.toHaveBeenCalled();
    expect(animais.deleteAnimal).not.toHaveBeenCalled();
    expect(screen.getByTestId('rota')).toHaveTextContent('/admin/animais');
  });
});

describe('tratamento de erro por `code`', () => {
  async function preencherMinimo(usuario: ReturnType<typeof userEvent.setup>): Promise<void> {
    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo');
    await usuario.selectOptions(screen.getByLabelText(/^Espécie/), 'e1');
    await usuario.selectOptions(screen.getByLabelText(/^Porte/), 'grande');
    await usuario.selectOptions(screen.getByLabelText(/^Sexo/), 'macho');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');
  }

  it('CT-66/CA-29: `ANIMAL_STALE_UPDATE` exibe a mensagem da API e PRESERVA tudo o que estava preenchido', async () => {
    const usuario = userEvent.setup();

    animais.updateAnimal.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'ANIMAL_STALE_UPDATE',
        message: 'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
      }),
    );

    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    await usuario.clear(screen.getByLabelText(/^Nome/));
    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo Editado');
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    expect(
      await screen.findByText(
        'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
      ),
    ).toBeInTheDocument();

    // O formulário permanece aberto, com tudo preenchido.
    expect(screen.getByTestId('rota')).toHaveTextContent(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Theo Editado');
    expect(screen.getByLabelText(/^Data de nascimento/)).toHaveValue('2022-11-05');
  });

  it('CT-55/CT-56: `IMAGE_STORAGE_UNAVAILABLE` fica JUNTO à área de imagens e preserva as em preparo', async () => {
    const usuario = userEvent.setup();

    animais.createAnimal.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'IMAGE_STORAGE_UNAVAILABLE',
        message: 'Não foi possível salvar as imagens. Tente novamente.',
      }),
    );

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await preencherMinimo(usuario);
    await usuario.upload(screen.getByLabelText('Escolher arquivos'), [arquivo('a.jpg')]);
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    expect(
      await screen.findByText('Não foi possível salvar as imagens. Tente novamente.'),
    ).toBeInTheDocument();
    // Perder um formulário longo por um 503 é o defeito que faz o administrador
    // desistir da tela.
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Theo');
    expect(screen.getByRole('button', { name: 'Remover imagem 1 de 1' })).toBeInTheDocument();
  });

  it('`VALIDATION_ERROR` distribui os `details` pelos campos', async () => {
    const usuario = userEvent.setup();

    animais.createAnimal.mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Verifique os campos informados.',
        details: [{ field: 'name', message: 'O nome do animal deve ter no mínimo 2 caracteres.' }],
      }),
    );

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await preencherMinimo(usuario);
    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    expect(
      await screen.findByText('O nome do animal deve ter no mínimo 2 caracteres.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nome/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('`ANIMAL_NOT_FOUND` volta à listagem em vez de manter o formulário sobre um animal inexistente', async () => {
    const usuario = userEvent.setup();

    animais.updateAnimal.mockRejectedValue(
      new ApiError({ status: 404, code: 'ANIMAL_NOT_FOUND', message: 'Animal não encontrado.' }),
    );

    renderizar(`/admin/animais/${ID_DO_ANIMAL}/editar`);
    await aguardarFormulario();

    await usuario.click(screen.getByRole('button', { name: MESSAGES.ANIMALS.SAVE_BUTTON }));

    await waitFor(() => {
      expect(screen.getByTestId('rota')).toHaveTextContent('/admin/animais');
    });
  });
});

describe('teclado (CT-94, CA-42)', () => {
  it('o envio funciona com Enter a partir de um campo de texto', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    await usuario.type(screen.getByLabelText(/^Nome/), 'Theo');
    await usuario.selectOptions(screen.getByLabelText(/^Espécie/), 'e1');
    await usuario.selectOptions(screen.getByLabelText(/^Porte/), 'grande');
    await usuario.selectOptions(screen.getByLabelText(/^Sexo/), 'macho');
    await usuario.selectOptions(screen.getByLabelText(/^Estado/), 'PR');
    await waitFor(() => {
      expect(screen.getByLabelText(/^Cidade/)).toBeEnabled();
    });
    await usuario.selectOptions(screen.getByLabelText(/^Cidade/), 'c-campo-magro');

    screen.getByLabelText(/^Nome/).focus();
    await usuario.keyboard('{Enter}');

    await waitFor(() => {
      expect(animais.createAnimal).toHaveBeenCalledTimes(1);
    });
  });

  it('as alternâncias são acionáveis por teclado', async () => {
    const usuario = userEvent.setup();

    renderizar('/admin/animais/novo');
    await aguardarFormulario();

    const alternancia = screen.getByRole('switch', { name: 'Aceita outros animais' });

    alternancia.focus();
    await usuario.keyboard(' ');

    expect(alternancia).toBeChecked();
  });
});
