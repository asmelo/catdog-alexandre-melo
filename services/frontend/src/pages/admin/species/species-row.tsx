import type { ReactElement } from 'react';

import { IconButton } from '~/components/ui/icon-button';
import { PencilIcon, TrashIcon } from '~/components/ui/icons';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

type SpeciesRowProps = {
  readonly species: Species;
  /**
   * OPCIONAIS nesta task e ja na assinatura final. A TASK-FRONTEND-010 liga os
   * dois a edicao em linha e a exclusao; declara-los agora evita que ela precise
   * reabrir este arquivo so para trocar a forma das props, e mantem os dois
   * icones da captura visiveis desde ja (CA-03).
   */
  readonly onEdit?: (especie: Species) => void;
  readonly onDelete?: (especie: Species) => void;
};

/**
 * Linha de EXIBICAO da lista de especies: nome a esquerda, lapis e lixeira a
 * direita, nessa ordem.
 *
 * APRESENTACAO PURA — nenhum `useState`, nenhuma chamada de API. O modo de edicao
 * chega na TASK-FRONTEND-010 e sera um ramo deste mesmo componente; a linha
 * precisa continuar sendo a peca que so sabe desenhar, para que a task seguinte
 * acrescente estado em UM lugar.
 *
 * O `<li>` e a moldura vem do `DataList` — a linha entrega apenas o conteudo.
 *
 * VARIANTES DOS DOIS BOTOES: `default` no lapis e `danger` na lixeira.
 *
 * A CAPTURA NAO USA NENHUMA COR DA MARCA nos dois icones — medido pixel a pixel
 * em `assets/current-state-admin-especies.png`, nos tres pares de icones da
 * lista:
 *
 * - lapis: o pixel mais saturado de cada linha fica entre `(116,144,186)` e
 *   `(130,147,198)`, matiz 216 a 227 — um AZUL-ARDOSIA, com o verde sempre
 *   ACIMA do vermelho;
 * - lixeira: `(174,79,98)` no mais saturado, matiz 348 nas tres linhas — um
 *   VERMELHO-ROSADO, com o azul entre 98 e 115.
 *
 * Nenhum dos dois tem token CatDog correspondente. `brand.purple` (`#7c3aed`) e
 * matiz 262 com o verde MUITO abaixo do vermelho (58 contra 124), o inverso do
 * que o lapis mostra; `brand.orange-dark` (`#c44a10`) e matiz 19 com o azul
 * quase nulo (16), contra os ~100 da lixeira. A divergencia nao e artefato do
 * antialiasing sobre o cartao branco: misturar uma cor com branco multiplica a
 * saturacao e a distancia entre canais pelo mesmo fator e PRESERVA o matiz
 * exatamente, entao 216-227 nao pode ser um 262 desbotado.
 *
 * Sem token equivalente, `default` (`ink.mid`) e `danger` (`brand.orange-dark`)
 * sao os vizinhos mais proximos dentro do que a TASK-FRONTEND-006 entregou, e o
 * `default` ainda ganha contraste sobre o cartao branco. Criar variante nova
 * exigiria alterar `src/components/ui/icon-button.tsx`, fora do escopo desta
 * task — e NAO HA "variante roxa da captura" a reproduzir, porque a captura
 * nunca mostrou uma. O roxo da marca entra aqui so pelo `hover` e pelo anel de
 * foco, ambos vindos do proprio `IconButton`.
 */
export function SpeciesRow({ species, onEdit, onDelete }: SpeciesRowProps): ReactElement {
  return (
    <>
      <span className="font-semibold text-ink">{species.name}</span>

      {/*
        O nome acessivel de cada acao inclui o NOME DA ESPECIE, e e este ponto
        que satisfaz o RNF-07 / CT-38: "Editar" repetido em cada linha nao
        identifica nada para quem navega por leitor de tela, e a lista viraria
        uma sequencia de botoes homonimos.

        A composicao e `${verbo} ${nome}` — "Editar Gato" —, e nao "Editar
        espécie Gato": os literais do catalogo sao verbos soltos exatamente por
        isso, conforme o comentario de `MESSAGES.SPECIES.EDIT_ACTION`.
      */}
      <span className="flex shrink-0 items-center gap-1">
        <IconButton
          label={`${MESSAGES.SPECIES.EDIT_ACTION} ${species.name}`}
          icon={<PencilIcon />}
          onClick={() => {
            // Encadeamento opcional em vez de um `noop` compartilhado: sem
            // handler, o clique nao faz nada de proposito — a acao chega na
            // TASK-FRONTEND-010 e nao ha comportamento provisorio a inventar.
            onEdit?.(species);
          }}
        />
        <IconButton
          label={`${MESSAGES.SPECIES.DELETE_ACTION} ${species.name}`}
          icon={<TrashIcon />}
          variant="danger"
          onClick={() => {
            onDelete?.(species);
          }}
        />
      </span>
    </>
  );
}
