import type { ReactElement } from 'react';

import type { Animal } from '~/domains/animals/animal.types';
import { MESSAGES } from '~/utils/messages';

interface AnimalThumbnailProps {
  readonly animal: Animal;
}

const CLASSES_DA_MOLDURA =
  'h-10 w-10 shrink-0 rounded-lg border-[1.5px] border-hairline object-cover';

/**
 * Miniatura da coluna ANIMAL.
 *
 * A CAPA E `images[0]`, e nao "a primeira que vier": o backend devolve as imagens
 * ordenadas por `position`, e a de posicao 0 e a capa (RN-35). Reordenar aqui —
 * por data, por id, por qualquer coisa — faria a miniatura da listagem divergir
 * da capa que o formulario mostra.
 *
 * `images[0]` e `AnimalImage | undefined` sob `noUncheckedIndexedAccess`, e o
 * `undefined` e um caso REAL e comum: o animal pode ser cadastrado sem foto
 * nenhuma (RN-30). Tratado com marcador neutro, nunca silenciado com `!`.
 *
 * ============ O INDICADOR DE PENDENCIA E SINALIZACAO, NAO BLOQUEIO ============
 *
 * Ele aparece quando o animal esta DISPONIVEL e nao tem imagem — a combinacao que
 * atrapalha a vitrine. Um animal adotado sem foto nao interessa a ninguem, e por
 * isso as duas condicoes andam juntas (RN-60, CT-33, CA-46).
 *
 * Nenhuma acao da linha e desabilitada por causa dele: o administrador cadastra o
 * animal em campo e fotografa depois.
 */
export function AnimalThumbnail({ animal }: AnimalThumbnailProps): ReactElement {
  const capa = animal.images[0];
  const semFoto = capa === undefined;
  const pendenciaDeFoto = semFoto && animal.status === 'disponivel';

  return (
    <span className="relative inline-flex">
      {capa === undefined ? (
        /*
          Marcador neutro DECORATIVO (`aria-hidden`): a ausencia de foto ja e dita
          pelo indicador de pendencia quando importa, e um texto alternativo do
          tipo "sem imagem" repetido em toda linha vira ruido no leitor de tela. A
          linha continua legivel porque o nome do animal esta ao lado (CT-32).
        */
        <span aria-hidden="true" className={`${CLASSES_DA_MOLDURA} block bg-surface-input`} />
      ) : (
        <img src={capa.url} alt={MESSAGES.ANIMALS.thumbnailAlt(animal.name)} className={CLASSES_DA_MOLDURA} />
      )}

      {pendenciaDeFoto && (
        <>
          {/* Glifo decorativo; quem anuncia e o texto oculto ao lado. */}
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[0.6rem] font-extrabold text-amber-900"
          >
            !
          </span>
          <span className="sr-only">{MESSAGES.ANIMALS.PHOTO_PENDING}</span>
        </>
      )}
    </span>
  );
}
