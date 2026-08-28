import type { ReactElement } from 'react';

import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import type { Animal } from '~/domains/animals/animal.types';
import { MESSAGES } from '~/utils/messages';

interface AnimalDeleteDialogProps {
  /** `null` = nenhum animal escolhido, e portanto nenhum diálogo no DOM. */
  readonly animal: Animal | null;
  readonly isSubmitting: boolean;
  readonly onConfirm: (animal: Animal) => void;
  readonly onCancel: () => void;
}

/**
 * Confirmacao de exclusao de animal.
 *
 * Casca fina sobre o `ConfirmDialog` da FEATURE-001, exatamente como o
 * `DeleteSpeciesDialog`: nenhum comportamento de dialogo e reimplementado aqui, e
 * o que ela acrescenta e so o vocabulario do animal.
 *
 * RETORNO ANTECIPADO `null`, e nao `open={false}`: a montagem E o estado de
 * aberto. O `ConfirmDialog` so devolve o foco a quem o abriu na LIMPEZA do
 * efeito, que roda ao desmontar — mante-lo montado e fechado deixaria no DOM um
 * `role="dialog"` de um animal que ja nao esta escolhido, e o foco nunca voltaria
 * para o botao "Excluir" da linha.
 *
 * A DESCRICAO SAI DO CATALOGO, pela funcao `deleteConfirmation`, porque o CA-33
 * compara o texto caractere a caractere — aspas curvas inclusas.
 */
export function AnimalDeleteDialog({
  animal,
  isSubmitting,
  onConfirm,
  onCancel,
}: AnimalDeleteDialogProps): ReactElement | null {
  if (animal === null) {
    return null;
  }

  return (
    <ConfirmDialog
      open
      title={MESSAGES.ANIMALS.rowActionLabel(MESSAGES.ANIMALS.DELETE_ACTION, animal.name)}
      description={MESSAGES.ANIMALS.deleteConfirmation(animal.name)}
      confirmLabel={MESSAGES.ANIMALS.DELETE_ACTION}
      cancelLabel={MESSAGES.ANIMALS.CANCEL_BUTTON}
      isSubmitting={isSubmitting}
      onConfirm={() => {
        onConfirm(animal);
      }}
      onCancel={onCancel}
    />
  );
}
