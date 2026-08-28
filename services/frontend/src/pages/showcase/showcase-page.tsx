import type { ReactElement } from 'react';

/**
 * A VITRINE PUBLICA (`/animais`).
 *
 * PLACEHOLDER neste slice: so o titulo. A TASK-FRONTEND-010 substitui o conteudo,
 * e a estrutura de ROTAS nao muda de novo quando isso acontecer — a rota ja e
 * montavel e verificavel isoladamente agora. E o mesmo procedimento adotado entre
 * as TASK-FRONTEND-016 e 017 da FEATURE-002 deste modulo.
 */
export function ShowcasePage(): ReactElement {
  // TODO(TASK-FRONTEND-010): barra de filtros, grade de cartões e paginação.
  return <h1 className="text-[1.35rem] font-extrabold text-ink">Animais para adoção</h1>;
}
