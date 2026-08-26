import type { ReactElement } from 'react';

import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';

type DeleteSpeciesDialogProps = {
  /** `null` = nenhuma especie escolhida, e portanto nenhum dialogo no DOM. */
  readonly species: Species | null;
  readonly isSubmitting: boolean;
  /**
   * Recebe a especie que o dialogo esta exibindo, em vez de nao receber nada.
   *
   * A pagina TEM o mesmo valor em `especieParaExcluir`, mas le-lo de la obrigaria
   * o tratador a conviver com um `Species | null` e a abrir uma guarda para um
   * `null` que nao pode acontecer — o dialogo so existe quando ha especie. Passar
   * o valor daqui elimina o ramo impossivel em vez de testa-lo.
   */
  readonly onConfirm: (especie: Species) => void;
  readonly onCancel: () => void;
};

/**
 * Confirmacao de exclusao de especie (HU-05 cenario 1 / CA-13).
 *
 * Casca fina sobre o `ConfirmDialog` da TASK-FRONTEND-006: o que ela acrescenta
 * e exclusivamente o vocabulario da especie — nenhum comportamento de dialogo e
 * reimplementado aqui.
 *
 * RETORNO ANTECIPADO `null`, e nao `open={false}`: a montagem E o estado de
 * aberto. Manter o dialogo montado e fechado deixaria no DOM um `role="dialog"`
 * de uma especie que ja nao esta escolhida, e o `ConfirmDialog` so devolve o foco
 * a quem o abriu na LIMPEZA do efeito — que roda ao desmontar. Ligar as duas
 * coisas mantem uma unica fonte de verdade: ha dialogo enquanto ha
 * `especieParaExcluir`.
 *
 * O `open` fixo em `true` e consequencia disso, e nao redundancia: abaixo desta
 * linha o dialogo sempre esta aberto.
 *
 * A DESCRICAO SAI DO CATALOGO, pela funcao `deleteConfirmation`, porque o CA-13
 * compara o texto caractere a caractere — incluindo as aspas curvas. Montar a
 * frase aqui criaria uma segunda origem para ela.
 *
 * O TITULO repete a composicao `${verbo} ${nome}` dos botoes de icone da linha
 * ("Excluir Gato"), e nao um literal novo: o dialogo passa a ter o MESMO nome
 * acessivel da lixeira que o abriu, e o catalogo de mensagens — que esta task nao
 * altera (TASK-FRONTEND-008) — nao possui chave de titulo de dialogo. DECISAO
 * sem respaldo explicito da task, registrada no relatorio.
 */
export function DeleteSpeciesDialog({
  species,
  isSubmitting,
  onConfirm,
  onCancel,
}: DeleteSpeciesDialogProps): ReactElement | null {
  if (species === null) {
    return null;
  }

  return (
    <ConfirmDialog
      open
      title={`${MESSAGES.SPECIES.DELETE_ACTION} ${species.name}`}
      description={MESSAGES.SPECIES.deleteConfirmation(species.name)}
      confirmLabel={MESSAGES.SPECIES.DELETE_ACTION}
      cancelLabel={MESSAGES.SPECIES.CANCEL_BUTTON}
      isSubmitting={isSubmitting}
      onConfirm={() => {
        onConfirm(species);
      }}
      onCancel={onCancel}
    />
  );
}
