import type { ReactElement } from 'react';

/**
 * Tela de especies (`/admin/especies`), renderizada dentro do `AdminLayout`.
 *
 * CASCA VAZIA POR CONTRATO desta task: ela existe para que a rota resolva e para
 * que o redirecionamento de `/admin` seja verificavel ja agora — sem uma folha
 * montada, `/admin` levaria a uma tela em branco ou a 404. A linha de criacao, a
 * lista e os estados de carregamento/vazio/erro chegam na TASK-FRONTEND-009, que
 * substitui este arquivo.
 *
 * O `<h1>` ja e DEFINITIVO: "Especies" e contrato de interface (CA-02) e nao muda
 * quando o conteudo chegar.
 *
 * `<h1>` e nao `<h2>`: o `AdminLayout` fornece os landmarks (`header`, `nav`,
 * `main`) e nenhum cabecalho, portanto o primeiro nivel da pagina pertence a ela.
 */
export function SpeciesPage(): ReactElement {
  return <h1 className="text-2xl font-extrabold text-ink">Espécies</h1>;
}
