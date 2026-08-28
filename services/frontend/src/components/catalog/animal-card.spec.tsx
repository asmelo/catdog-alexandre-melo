import { act, render, screen, within } from '@testing-library/react';

import { AnimalCard } from '~/components/catalog/animal-card';
import { AnimalGrid } from '~/components/catalog/animal-grid';
import type { PublicAnimal } from '~/services/api/catalog-api';

/**
 * O cartao da vitrine.
 *
 * Alem do conteudo, este arquivo protege tres AUSENCIAS: nenhuma acao dentro do
 * cartao, nenhum anuncio dos elementos decorativos e nenhuma execucao de conteudo
 * vindo do administrador.
 */

const THEO: PublicAnimal = {
  id: 'a1111111-1111-4111-8111-111111111111',
  name: 'Theo',
  species: { id: 'e1', name: 'Cachorro' },
  size: 'grande',
  sex: 'macho',
  ageInYears: 3,
  ageInMonths: 45,
  description: 'Dócil, brincalhão e acostumado com crianças.',
  acceptsOtherAnimals: true,
  needsLargeSpace: false,
  city: { name: 'Campo Magro', stateUf: 'PR' },
  coverImageUrl: 'https://exemplo/capa.jpg',
};

function animal(ajustes: Partial<PublicAnimal> = {}): PublicAnimal {
  return { ...THEO, ...ajustes };
}

describe('CT-10/CA-08: conteúdo do cartão', () => {
  it('apresenta foto, nome, espécie, localização, as três características e a descrição', () => {
    // Arrange & Act
    render(<AnimalCard animal={animal()} />);

    // Assert
    expect(screen.getByRole('img', { name: 'Foto de Theo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
    expect(screen.getByText('Cachorro')).toBeInTheDocument();
    expect(screen.getByText('Campo Magro - PR')).toBeInTheDocument();
    expect(screen.getByText('Macho')).toBeInTheDocument();
    expect(screen.getByText('Grande')).toBeInTheDocument();
    expect(screen.getByText('3 anos')).toBeInTheDocument();
    expect(screen.getByText(/Dócil, brincalhão/)).toBeInTheDocument();
  });

  it('CA-47: a localização vem do dado da API, sem consulta a serviço externo', () => {
    // A guarda de rede do `tests/setup.ts` reprovaria qualquer `fetch`.
    render(<AnimalCard animal={animal({ city: { name: 'Vitória', stateUf: 'ES' } })} />);

    expect(screen.getByText('Vitória - ES')).toBeInTheDocument();
  });

  it('CT-121/CT-122: o ícone de localização NÃO gera anúncio e não é um link para mapa', () => {
    // Arrange & Act
    const { container } = render(<AnimalCard animal={animal()} />);

    // Assert
    const icones = container.querySelectorAll('svg');

    for (const icone of icones) {
      expect(icone).toHaveAttribute('aria-hidden', 'true');
    }

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('CT-14: sem descrição, a área NÃO está no DOM', () => {
    // Arrange & Act — um `<p></p>` vazio desalinharia o cartão em relação aos
    // vizinhos.
    const { container } = render(<AnimalCard animal={animal({ description: null })} />);

    // Assert
    expect(screen.queryByText(/Dócil/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('p')).toHaveLength(1); // só a localização
  });

  it('CT-15/CA-45: descrição de 1000 caracteres fica INTEIRA no documento', () => {
    // Arrange — a truncagem é CSS; nada é cortado em JavaScript.
    const longa = 'a'.repeat(1000);

    // Act
    render(<AnimalCard animal={animal({ description: longa })} />);

    // Assert — o texto completo permanece acessível à tecnologia assistiva.
    const descricao = screen.getByText(longa);

    expect(descricao.textContent).toHaveLength(1000);
    expect(descricao).toHaveClass('line-clamp-3');
  });

  it.each([
    { anos: null, meses: null, esperado: 'Idade não informada' },
    { anos: 1, meses: 12, esperado: '1 ano' },
    { anos: 0, meses: 5, esperado: '5 meses' },
    { anos: 0, meses: 0, esperado: 'Menos de 1 mês' },
  ])('CT-58/CT-66/CT-67/CT-68: idade $esperado aparece como etiqueta', ({ anos, meses, esperado }) => {
    render(<AnimalCard animal={animal({ ageInYears: anos, ageInMonths: meses })} />);

    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('traduz o vocabulário do contrato para o rótulo acentuado', () => {
    render(<AnimalCard animal={animal({ sex: 'femea', size: 'medio' })} />);

    expect(screen.getByText('Fêmea')).toBeInTheDocument();
    expect(screen.getByText('Médio')).toBeInTheDocument();
  });
});

describe('CT-12/CT-13/CA-46: a imagem', () => {
  it('CT-12/CT-122: sem `coverImageUrl`, o marcador substituto ocupa o lugar sem ser anunciado', () => {
    // Arrange & Act
    render(<AnimalCard animal={animal({ coverImageUrl: null })} />);

    // Assert — nenhuma imagem é anunciada, e o cartão segue completo.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
    expect(screen.getByText('Campo Magro - PR')).toBeInTheDocument();
  });

  it('CT-13: quando a imagem falha, o marcador substituto entra — sem laço', () => {
    // Arrange
    render(<AnimalCard animal={animal()} />);

    const imagem = screen.getByRole('img', { name: 'Foto de Theo' });

    // Act — a falha de carregamento de imagem NÃO é uma interação do usuário, e o
    // `userEvent` não a modela: o evento é do navegador. Daí o `dispatchEvent`
    // nativo dentro de `act`, que é o que permite ao React processar a troca de
    // estado do `onError`. A convenção "sempre `userEvent`" vale para interação.
    act(() => {
      imagem.dispatchEvent(new Event('error'));
    });

    // Assert — o ícone de imagem quebrada do navegador nunca aparece.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
  });

  it('CT-11: com `coverImageUrl`, a foto de capa é exibida com o endereço recebido', () => {
    // Arrange & Act
    render(<AnimalCard animal={animal({ coverImageUrl: 'https://exemplo/capa.jpg' })} />);

    // Assert
    expect(screen.getByRole('img', { name: 'Foto de Theo' })).toHaveAttribute(
      'src',
      'https://exemplo/capa.jpg',
    );
  });

  it('CT-127: a imagem é carregada preguiçosamente', () => {
    render(<AnimalCard animal={animal()} />);

    expect(screen.getByRole('img', { name: 'Foto de Theo' })).toHaveAttribute('loading', 'lazy');
  });
});

describe('CT-16/CT-17/CA-44: conteúdo do administrador é sempre TEXTO', () => {
  it.each([
    { campo: 'nome', dados: { name: '<script>alert(1)</script>' } },
    { campo: 'espécie', dados: { species: { id: 'e1', name: '<img src=x onerror=alert(1)>' } } },
    { campo: 'cidade', dados: { city: { name: '<script>alert(1)</script>', stateUf: 'PR' } } },
    { campo: 'descrição', dados: { description: '<img src=x onerror=alert(1)>' } },
  ])('$campo com marcação aparece LITERALMENTE, e nenhum elemento é criado', ({ dados }) => {
    // Arrange & Act
    const { container } = render(<AnimalCard animal={animal(dados as Partial<PublicAnimal>)} />);

    // Assert — nenhum `<script>` e nenhuma imagem além da capa legítima.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    // A única `<img>` é a capa legítima, com o `alt` que o componente monta.
    expect(container.querySelectorAll('img')).toHaveLength(1);
    // E o texto aparece LITERALMENTE. Só esta asserção passaria mesmo com
    // injeção parcial — por isso as três juntas.
    expect(container.textContent).toContain('alert(1)');
  });
});

describe('CT-130/CA-48: nenhuma ação dentro do cartão', () => {
  it('não existe `<button>` nem `<a>`, com ou sem sessão', () => {
    // Arrange & Act — o cartão não recebe role nem sessão: as props são
    // `{ animal }` e nada mais, então não há o que variar.
    const { container } = render(<AnimalCard animal={animal()} />);

    // Assert
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('CT-120/RNF-22: a grade', () => {
  it('é anunciada como lista, com a contagem no nome', () => {
    // Arrange & Act
    render(
      <AnimalGrid animals={[animal({ id: 'a1' }), animal({ id: 'a2', name: 'Luna' })]} />,
    );

    // Assert — sem a contagem, quem navega por áudio percorre os cartões sem
    // saber quando acaba.
    const lista = screen.getByRole('list', { name: '2 animais disponíveis' });

    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
  });

  it('com um único animal, a contagem concorda no singular', () => {
    render(<AnimalGrid animals={[animal()]} />);

    expect(screen.getByRole('list', { name: '1 animal disponível' })).toBeInTheDocument();
  });

  it('CT-121: cada cartão é um item da lista, com o nome em nível abaixo do título da página', () => {
    render(<AnimalGrid animals={[animal()]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Theo' })).toBeInTheDocument();
  });
});

describe('CT-126/RNF-29: a grade responsiva', () => {
  it('declara 1, 2, 3 e 4 colunas — as quatro divisões exatas de 12', () => {
    // Arrange & Act — não é escolha estética: 12 é o tamanho de página do
    // contrato, e as quatro larguras o dividem sem deixar fila incompleta. Cinco
    // colunas deixariam dois cartões órfãos na última fila em todo carregamento.
    render(<AnimalGrid animals={[animal({ id: 'a1' })]} />);

    // Assert
    const lista = screen.getByRole('list');

    expect(lista).toHaveClass('grid-cols-1');
    expect(lista).toHaveClass('sm:grid-cols-2');
    expect(lista).toHaveClass('lg:grid-cols-3');
    expect(lista).toHaveClass('xl:grid-cols-4');
  });
});
