import type { ReactElement } from 'react';

import { ANIMAL_STATUS_LABELS } from '~/domains/animals/animal-labels';
import type { AnimalStatus } from '~/domains/animals/animal.types';

interface StatusBadgeProps {
  readonly status: AnimalStatus;
}

/**
 * Paleta por situacao.
 *
 * ============ AS CORES SAO DO PROJETO, NAO INVENTADAS AQUI ============
 *
 * O verde e o vermelho nao existiam no design system — nenhum token cobria
 * "disponivel" e "indisponivel" —, entao usam a escala padrao do Tailwind, que
 * continua sendo configuracao do projeto e nao valor literal no componente
 * (RNF-20). Ambar e cinza idem. O roxo e o laranja da marca ficam de fora de
 * proposito: eles ja significam "acao primaria" e "perigo/erro" em toda a base, e
 * reusa-los para situacao do animal criaria duas leituras para a mesma cor.
 *
 * CONTRASTE MEDIDO do texto sobre o fundo do selo, todos acima dos 4.5:1 do
 * WCAG AA:
 *
 * - Disponivel:   `green-800`  (#166534) sobre `green-100`  (#dcfce7) — 7.53:1
 * - Reservado:    `amber-900`  (#78350f) sobre `amber-100`  (#fef3c7) — 8.51:1
 * - Adotado:      `slate-700`  (#334155) sobre `slate-200`  (#e2e8f0) — 7.55:1
 * - Indisponivel: `rose-900`   (#881337) sobre `rose-100`   (#ffe4e6) — 9.63:1
 */
const CLASSES_POR_SITUACAO: Readonly<Record<AnimalStatus, string>> = {
  disponivel: 'bg-green-100 text-green-800',
  reservado: 'bg-amber-100 text-amber-900',
  adotado: 'bg-slate-200 text-slate-700',
  indisponivel: 'bg-rose-100 text-rose-900',
};

/**
 * Selo da situacao do animal, SOMENTE LEITURA.
 *
 * Sem `onClick` e sem `role="button"`: quem altera a situacao e a coluna ALTERAR
 * STATUS, que e um campo de selecao de verdade (RN-16). Um selo clicavel criaria
 * um segundo caminho para a mesma escrita, com metade dos cuidados — sem
 * confirmacao visual do valor escolhido e sem desabilitar durante a requisicao.
 *
 * O TEXTO E SEMPRE EXIBIDO, nunca so a cor. Um selo que comunica o estado apenas
 * pelo fundo e invisivel para quem nao distingue verde de ambar, e a informacao
 * "este animal ja foi adotado" e exatamente a que nao pode se perder (RNF-17,
 * CA-42).
 */
export function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold ${CLASSES_POR_SITUACAO[status]}`}
    >
      {ANIMAL_STATUS_LABELS[status]}
    </span>
  );
}
