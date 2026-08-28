import { useState, type ReactElement } from 'react';

import { MESSAGES } from '~/utils/messages';

interface AnimalImageProps {
  readonly src: string | null;
  readonly animalName: string;
}

/**
 * ALTURA FIXA nos dois caminhos.
 *
 * E o que impede a grade de ficar serrilhada: um cartao sem foto com altura menor
 * desalinharia a fila inteira, e o defeito so apareceria quando o primeiro animal
 * fosse cadastrado sem imagem (RN-62, CT-12).
 */
const CLASSES_DA_MOLDURA = 'h-44 w-full overflow-hidden rounded-t-card bg-surface-input';

/**
 * Marcador substituto. DECORATIVO: `aria-hidden`, porque o nome do animal ja esta
 * no cartao e "sem imagem" repetido em toda linha vira ruido no leitor de tela
 * (RNF-24, CT-122).
 */
function MarcadorSubstituto(): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={`${CLASSES_DA_MOLDURA} flex items-center justify-center`}
    >
      <svg
        width={44}
        height={44}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-paw"
      >
        <circle cx="11" cy="4" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="4" cy="8" r="2" />
        <circle cx="7" cy="4" r="2" />
        <path d="M8 13.5c0-1.9 1.6-3.5 3.5-3.5S15 11.6 15 13.5c0 1.4-.8 2-1.4 2.8-.5.7-.6 1.7-1.6 1.7s-1.1-1-1.6-1.7c-.6-.8-1.4-1.4-1.4-2.8Z" />
      </svg>
    </div>
  );
}

/**
 * Foto de capa do cartao, com marcador substituto.
 *
 * ============ POR QUE O `onError` TROCA ESTADO, E NAO `src` ============
 *
 * Reatribuir `event.currentTarget.src` no handler dispara um carregamento novo —
 * que pode falhar de novo e chamar o `onError` outra vez, em LACO. Trocar o
 * estado do React e deixa-lo remontar o marcador substituto encerra o assunto
 * numa unica passagem, e o `falhou` ja verdadeiro torna o handler idempotente.
 *
 * O ICONE DE IMAGEM QUEBRADA DO NAVEGADOR NUNCA APARECE (RN-63, CT-13). A vitrine
 * e a face publica do produto, e uma imagem quebrada nela custa mais do que a
 * ausencia de imagem — que ao menos parece deliberada.
 *
 * `loading="lazy"`: numa pagina de doze cartoes, as imagens abaixo da dobra so
 * sao buscadas quando o visitante rola ate elas (RNF-20, CT-127).
 */
export function AnimalImage({ src, animalName }: AnimalImageProps): ReactElement {
  const [falhou, setFalhou] = useState(false);

  if (src === null || falhou) {
    return <MarcadorSubstituto />;
  }

  return (
    <img
      src={src}
      alt={MESSAGES.SHOWCASE.photoAlt(animalName)}
      loading="lazy"
      onError={() => {
        setFalhou(true);
      }}
      className={`${CLASSES_DA_MOLDURA} object-cover`}
    />
  );
}
