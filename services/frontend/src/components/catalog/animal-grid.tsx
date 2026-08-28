import type { ReactElement } from 'react';

import { AnimalCard } from '~/components/catalog/animal-card';
import type { PublicAnimal } from '~/services/api/catalog-api';
import { MESSAGES } from '~/utils/messages';

interface AnimalGridProps {
  readonly animals: readonly PublicAnimal[];
}

/**
 * A grade da vitrine.
 *
 * ============ `<ul>`/`<li>`, E COM A CONTAGEM NO NOME ============
 *
 * A grade e uma LISTA, e o leitor de tela a anuncia como tal — com quantos itens
 * ela tem. Sem isso, quem navega por audio percorre doze cartoes sem saber quando
 * acaba (RNF-22, CT-120).
 *
 * ============ AS QUATRO LARGURAS SAO 1 / 2 / 3 / 4 ============
 *
 * Nao e escolha estetica: 12 — o tamanho de pagina do contrato — e divisivel por
 * 1, 2, 3 e 4, entao NENHUMA das quatro larguras termina com fila incompleta
 * (RN-17, RNF-29, CT-126). Cinco colunas deixariam dois cartoes orfaos na ultima
 * fila em todo carregamento.
 *
 * `key={animal.id}`, jamais indice: com paginacao, o indice reaproveita o mesmo
 * no do DOM entre paginas diferentes — a imagem do animal anterior fica no lugar
 * ate a nova carregar.
 */
export function AnimalGrid({ animals }: AnimalGridProps): ReactElement {
  return (
    <ul
      aria-label={MESSAGES.SHOWCASE.gridLabel(animals.length)}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {animals.map((animal) => (
        <li key={animal.id} className="h-full">
          <AnimalCard animal={animal} />
        </li>
      ))}
    </ul>
  );
}
