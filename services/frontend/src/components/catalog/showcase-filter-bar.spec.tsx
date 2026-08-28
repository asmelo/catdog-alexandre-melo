import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { ShowcaseFilterBar } from '~/components/catalog/showcase-filter-bar';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type ShowcaseFilters,
} from '~/pages/showcase/showcase-filters';
import { MESSAGES } from '~/utils/messages';

/**
 * A barra de sete controles.
 *
 * O criterio mais importante e o de ACESSIBILIDADE: a captura identifica a busca
 * e a cidade apenas por texto de apoio, e texto de apoio nao e rotulo — some ao
 * primeiro caractere digitado e deixa o campo preenchido sem identificacao.
 */

const UUID_VALIDO = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const ESPECIES = [
  { id: 'e1', name: 'Cachorro' },
  { id: 'e2', name: 'Gato' },
];

const CIDADES = [
  { id: 'c1', name: 'Campo Magro', stateUf: 'PR' },
  { id: 'c2', name: 'Boa Esperança', stateUf: 'ES' },
];

/** Harness controlado: com `filters` fixo, a barra nunca refletiria a mudança. */
function Harness({
  inicial = EMPTY_FILTERS,
  aoMudar,
  ...resto
}: {
  readonly inicial?: ShowcaseFilters;
  readonly aoMudar?: (filtros: ShowcaseFilters) => void;
  readonly speciesError?: boolean;
  readonly cityError?: boolean;
}): ReactElement {
  const [filtros, setFiltros] = useState(inicial);

  return (
    <ShowcaseFilterBar
      filters={filtros}
      onChange={(novos) => {
        setFiltros(novos);
        aoMudar?.(novos);
      }}
      speciesOptions={ESPECIES}
      cityOptions={CIDADES}
      hasActiveFilters={hasActiveFilters(filtros)}
      onClear={() => {
        setFiltros(EMPTY_FILTERS);
        aoMudar?.(EMPTY_FILTERS);
      }}
      {...resto}
    />
  );
}

describe('CT-119/CA-51: rótulos visíveis e associados', () => {
  it('os seis controles são alcançados pelo RÓTULO, não pelo texto de apoio', () => {
    // Arrange & Act
    render(<Harness />);

    // Assert — `getByLabelText` só encontra o que tem `<label>` de verdade.
    for (const rotulo of ['Buscar', 'Espécie', 'Porte', 'Sexo', 'Idade máxima', 'Cidade']) {
      expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
    }
  });

  it('os rótulos aparecem na ordem da captura, seguidos de "Limpar filtros"', () => {
    // Arrange & Act
    render(<Harness />);

    const rotulos = [...document.querySelectorAll('label')].map((item) => item.textContent);

    // Assert
    expect(rotulos).toEqual(['Buscar', 'Espécie', 'Porte', 'Sexo', 'Idade máxima', 'Cidade']);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('o rótulo da espécie é "Espécie", e não "Animal" como na captura', () => {
    // É o termo do glossário do produto (Decisão 18).
    render(<Harness />);

    expect(screen.getByLabelText('Espécie')).toBeInTheDocument();
    expect(screen.queryByLabelText('Animal')).not.toBeInTheDocument();
  });
});

describe('estado inicial', () => {
  it('os quatro campos de seleção exibem a opção neutra', () => {
    render(<Harness />);

    for (const neutro of [
      'Todas as espécies',
      'Todos os portes',
      'Todos os sexos',
      'Todas as cidades',
    ]) {
      expect(screen.getByRole('option', { name: neutro })).toBeInTheDocument();
    }
  });

  it('CT-90: "Limpar filtros" está NO DOM, visível e desabilitado', () => {
    // Ocultá-lo faria a linha saltar quando o primeiro filtro fosse aplicado.
    render(<Harness />);

    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  it('com filtro aplicado, o botão fica habilitado', () => {
    render(<Harness inicial={{ ...EMPTY_FILTERS, busca: 'theo' }} />);

    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeEnabled();
  });
});

describe('CT-35/RN-52: o atraso vale só para o que é DIGITADO', () => {
  it('dez caracteres em sequência acionam o callback UMA única vez', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness aoMudar={aoMudar} />);

    // Act
    await usuario.type(screen.getByLabelText('Buscar'), 'theozinho');

    // Assert — sem a espera, dez requisições sairiam e nove seriam descartadas; e
    // a busca por conteúdo em qualquer posição é a consulta mais cara do catálogo.
    await waitFor(() => {
      expect(aoMudar).toHaveBeenCalledTimes(1);
    });
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ busca: 'theozinho' }));
  });

  it('uma escolha em campo de seleção aciona o callback IMEDIATAMENTE', async () => {
    // Arrange — atrasar uma escolha discreta é latência sem ganho.
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness aoMudar={aoMudar} />);

    // Act
    await usuario.selectOptions(screen.getByLabelText('Espécie'), 'e2');

    // Assert — sem `waitFor`: a chamada já aconteceu.
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ especie: 'e2' }));
  });
});

describe('CT-79/CA-23: toda mudança repõe a página em 1', () => {
  it.each([
    { campo: 'seleção', acao: async (u: ReturnType<typeof userEvent.setup>) => u.selectOptions(screen.getByLabelText('Porte'), 'grande') },
    { campo: 'busca', acao: async (u: ReturnType<typeof userEvent.setup>) => u.type(screen.getByLabelText('Buscar'), 'x') },
  ])('mudar $campo estando na página 3 volta para a 1', async ({ acao }) => {
    // Arrange — filtrar na página 3 mostraria a página 3 de um conjunto novo, que
    // quase sempre está vazia.
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness inicial={{ ...EMPTY_FILTERS, pagina: 3 }} aoMudar={aoMudar} />);

    // Act
    await acao(usuario);

    // Assert
    await waitFor(() => {
      expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ pagina: 1 }));
    });
  });
});

describe('CT-53/RN-33: valor aplicado fora das opções', () => {
  it('a espécie do endereço que não está na lista vira opção ADICIONAL selecionada', () => {
    // Arrange & Act — sumir em silêncio esconderia do visitante o motivo de a
    // lista estar vazia: ele veria "Todas as espécies" e nenhum resultado.
    render(<Harness inicial={{ ...EMPTY_FILTERS, especie: UUID_VALIDO }} />);

    // Assert
    expect(screen.getByLabelText('Espécie')).toHaveValue(UUID_VALIDO);
    expect(
      screen.getByRole('option', { name: MESSAGES.SHOWCASE.FILTER_UNLISTED }),
    ).toBeInTheDocument();
  });

  it('a cidade conhecida NÃO ganha opção adicional', () => {
    render(<Harness inicial={{ ...EMPTY_FILTERS, cidade: 'c1' }} />);

    expect(screen.getByLabelText('Cidade')).toHaveValue('c1');
    expect(
      screen.queryByRole('option', { name: MESSAGES.SHOWCASE.FILTER_UNLISTED }),
    ).not.toBeInTheDocument();
  });

  it('a cidade é apresentada como "Cidade - UF", e o valor é o id', () => {
    render(<Harness />);

    expect(screen.getByRole('option', { name: 'Campo Magro - PR' })).toHaveValue('c1');
  });
});

describe('CT-96/CA-39: falha ao carregar as opções', () => {
  it('o campo afetado exibe o aviso em vez de aparecer vazio, e a barra segue utilizável', () => {
    // Arrange & Act
    render(<Harness speciesError />);

    // Assert
    expect(screen.getAllByText(MESSAGES.SHOWCASE.OPTIONS_LOAD_ERROR)).toHaveLength(1);
    expect(screen.getByLabelText('Buscar')).toBeEnabled();
    expect(screen.getByLabelText('Cidade')).toBeEnabled();
  });
});

describe('CT-71/CA-29: o aviso do filtro de idade', () => {
  it('é PERMANENTE e associado ao campo por `aria-describedby`', () => {
    // Arrange & Act — não é tooltip nem condicional. O filtro omite quem não tem
    // data de nascimento, e sem dizê-lo o visitante conclui que o animal sumiu.
    render(<Harness />);

    // Assert
    const campo = screen.getByLabelText('Idade máxima');

    expect(campo).toHaveAttribute('aria-describedby', 'idadeMax-hint');
    expect(screen.getByText(MESSAGES.SHOWCASE.MAX_AGE_HINT)).toHaveAttribute('id', 'idadeMax-hint');
  });
});

describe('idade máxima fora da faixa', () => {
  it('sinaliza o problema e NÃO envia o valor', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness aoMudar={aoMudar} />);

    // Act
    await usuario.type(screen.getByLabelText('Idade máxima'), '99');

    // Assert — a grade mantém o último resultado válido.
    expect(await screen.findByText(MESSAGES.SHOWCASE.INVALID_MAX_AGE)).toBeInTheDocument();
    expect(screen.getByLabelText('Idade máxima')).toHaveAttribute('aria-invalid', 'true');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('um valor válido é enviado depois do atraso', async () => {
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness aoMudar={aoMudar} />);

    await usuario.type(screen.getByLabelText('Idade máxima'), '3');

    await waitFor(() => {
      expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ idadeMax: 3 }));
    });
  });
});

describe('CT-89: limpar filtros', () => {
  it('devolve busca e os cinco filtros ao estado inicial', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(
      <Harness
        inicial={{ ...EMPTY_FILTERS, busca: 'theo', porte: 'grande', pagina: 3 }}
        aoMudar={aoMudar}
      />,
    );

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    // Assert
    expect(aoMudar).toHaveBeenCalledWith(EMPTY_FILTERS);
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    expect(screen.getByLabelText('Porte')).toHaveValue('');
  });
});

describe('CT-123/CA-53: teclado', () => {
  it('os sete controles são alcançáveis em ordem coerente com a leitura', async () => {
    // Arrange
    const usuario = userEvent.setup();

    render(<Harness inicial={{ ...EMPTY_FILTERS, busca: 'theo' }} />);

    const esperados = [
      screen.getByLabelText('Buscar'),
      screen.getByLabelText('Espécie'),
      screen.getByLabelText('Porte'),
      screen.getByLabelText('Sexo'),
      screen.getByLabelText('Idade máxima'),
      screen.getByLabelText('Cidade'),
      screen.getByRole('button', { name: 'Limpar filtros' }),
    ];

    // Act & Assert — nenhum controle personalizado sem papel: os sete são
    // elementos nativos.
    for (const controle of esperados) {
      await usuario.tab();
      expect(controle).toHaveFocus();
    }
  });
});

describe('voltar um campo de seleção ao neutro', () => {
  it.each([
    { campo: 'Porte', inicial: { porte: 'grande' as const }, chave: 'porte' },
    { campo: 'Sexo', inicial: { sexo: 'macho' as const }, chave: 'sexo' },
    { campo: 'Espécie', inicial: { especie: 'e1' }, chave: 'especie' },
    { campo: 'Cidade', inicial: { cidade: 'c1' }, chave: 'cidade' },
  ])('escolher a opção neutra em $campo devolve `null`, e não texto vazio', async ({ campo, inicial, chave }) => {
    // Arrange — o `''` do `<select>` precisa virar `null` no estado; deixá-lo como
    // texto vazio faria `hasActiveFilters` continuar verdadeiro e o botão
    // "Limpar filtros" ficar habilitado sem filtro nenhum.
    const usuario = userEvent.setup();
    const aoMudar = jest.fn();

    render(<Harness inicial={{ ...EMPTY_FILTERS, ...inicial }} aoMudar={aoMudar} />);

    // Act
    await usuario.selectOptions(screen.getByLabelText(campo), '');

    // Assert
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ [chave]: null }));
  });
});
