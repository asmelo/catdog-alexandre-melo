import { useState, type ChangeEvent, type ReactElement } from 'react';

import { SelectField } from '~/components/ui/select-field';
import { ANIMAL_STATUS_LABELS } from '~/domains/animals/animal-labels';
import type { Animal, AnimalStatus } from '~/domains/animals/animal.types';
import { ApiError } from '~/services/api/api-error';
import * as animalsApi from '~/services/api/animals-api';
import { MESSAGES } from '~/utils/messages';

/**
 * As quatro situacoes, na ordem do ciclo de adocao, com os rotulos acentuados
 * (CT-70, CA-05). Constante de modulo e nao literal no JSX: um array novo por
 * render mudaria a prop `options` por identidade sem mudar de valor.
 */
const OPCOES_DE_SITUACAO: ReadonlyArray<{ readonly value: AnimalStatus; readonly label: string }> =
  (['disponivel', 'reservado', 'adotado', 'indisponivel'] as const).map((situacao) => ({
    value: situacao,
    label: ANIMAL_STATUS_LABELS[situacao],
  }));

export type StatusChangeOutcome =
  | { readonly kind: 'success'; readonly animal: Animal }
  | { readonly kind: 'failure'; readonly message: string; readonly reloadList: boolean };

interface AnimalStatusSelectProps {
  readonly animal: Animal;
  readonly onOutcome: (resultado: StatusChangeOutcome) => void;
  /** Desabilita durante uma operacao da PAGINA (uma exclusao, por exemplo). */
  readonly disabled?: boolean;
}

/**
 * Decide a mensagem e se a lista precisa ser recarregada, SEMPRE pelo `code` e
 * nunca pelo texto (CA-22).
 *
 * Os dois casos que exigem recarga tem a mesma causa: a linha na tela nao
 * corresponde mais ao banco. Deixa-la como esta produziria uma linha fantasma —
 * o administrador continuaria vendo (e tentando operar) um animal que outra aba
 * ja excluiu ou alterou.
 */
function desfechoDaFalha(motivo: unknown): StatusChangeOutcome {
  if (motivo instanceof ApiError) {
    if (motivo.code === 'ANIMAL_NOT_FOUND' || motivo.code === 'ANIMAL_STALE_UPDATE') {
      return { kind: 'failure', message: motivo.message, reloadList: true };
    }

    return { kind: 'failure', message: motivo.message, reloadList: false };
  }

  /**
   * Falha que nao virou `ApiError` — defeito de programacao nesta tela. Nao ha
   * `message` do backend a exibir, e a frase generica da feature e a correta.
   */
  return { kind: 'failure', message: MESSAGES.ANIMALS.STATUS_UPDATE_ERROR, reloadList: false };
}

/**
 * Coluna ALTERAR STATUS da listagem.
 *
 * ==================== ATUALIZACAO OTIMISTA COM REVERSAO ====================
 *
 * O campo assume o valor escolhido IMEDIATAMENTE e volta ao anterior se a
 * requisicao falhar (CT-74). O estado local existe exclusivamente para isso:
 * `animal.status` continua sendo a verdade, e o valor otimista some assim que a
 * pagina recarrega a linha com o dado novo.
 *
 * ============= ESCOLHER O MESMO STATUS NAO ENVIA REQUISICAO =============
 *
 * CT-71 / RN-16. A comparacao e contra o valor EXIBIDO, e nao contra
 * `animal.status`: durante uma alteracao otimista os dois divergem, e comparar
 * com o do servidor faria a segunda escolha do mesmo valor disparar uma segunda
 * escrita.
 *
 * O `updatedAt` enviado e sempre o da LINHA CARREGADA (`animal.updatedAt`), e nao
 * um valor guardado localmente: e ele o token de concorrencia da RN-47, e usar
 * qualquer outra coisa faria o backend recusar toda alteracao com `409`.
 */
export function AnimalStatusSelect({
  animal,
  onOutcome,
  disabled,
}: AnimalStatusSelectProps): ReactElement {
  const [situacaoOtimista, setSituacaoOtimista] = useState<AnimalStatus | null>(null);
  const [enviando, setEnviando] = useState(false);

  const situacaoExibida = situacaoOtimista ?? animal.status;

  async function alterar(novaSituacao: AnimalStatus): Promise<void> {
    setSituacaoOtimista(novaSituacao);
    setEnviando(true);

    try {
      const atualizado = await animalsApi.changeAnimalStatus(animal.id, {
        status: novaSituacao,
        updatedAt: animal.updatedAt,
      });

      onOutcome({ kind: 'success', animal: atualizado });
    } catch (motivo: unknown) {
      // Reversao: o campo volta ao que o servidor ainda tem.
      setSituacaoOtimista(null);
      onOutcome(desfechoDaFalha(motivo));
    } finally {
      setEnviando(false);
    }
  }

  function aoEscolher(evento: ChangeEvent<HTMLSelectElement>): void {
    const escolhida = evento.target.value as AnimalStatus;

    if (escolhida === situacaoExibida) {
      return;
    }

    void alterar(escolhida);
  }

  return (
    <SelectField
      id={`status-${animal.id}`}
      /*
        Rotulo VISUALMENTE OCULTO: o cabecalho da coluna ja diz "ALTERAR STATUS"
        para quem enxerga, mas um `<select>` sem rotulo proprio e anunciado apenas
        como "caixa de combinação" por quem navega por lista de controles — sem
        dizer de qual animal.
      */
      label={MESSAGES.ANIMALS.rowActionLabel(MESSAGES.ANIMALS.CHANGE_STATUS_ACTION, animal.name)}
      labelHidden
      options={OPCOES_DE_SITUACAO}
      value={situacaoExibida}
      // Durante a requisicao nenhuma segunda escolha e aceita (HU-07 cenario 2).
      disabled={enviando || disabled === true}
      onChange={aoEscolher}
    />
  );
}
