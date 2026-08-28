import { MESSAGES } from '~/utils/messages';

/**
 * Tipos e regras do PREPARO de imagens do formulario de animal.
 *
 * =================== A REGRA QUE GOVERNA O ARQUIVO ===================
 *
 * RN-49: nada e gravado no armazenamento nem removido dele antes do "Salvar". O
 * "x" de uma imagem ja gravada apenas a tira desta lista; ela so deixa de existir
 * quando o formulario envia. E o "Cancelar" descarta a lista inteira, marcacoes
 * inclusive — um "Cancelar" que nao desfizesse a remocao de uma foto seria uma
 * armadilha, ja que a captura o apresenta como saida legitima do formulario.
 *
 * Tudo aqui e FUNCAO PURA, sem React e sem rede. A aritmetica do limite mora
 * neste arquivo justamente para poder ser testada sem montar componente: e a
 * parte que a propria spec ja teve de corrigir uma vez, e uma correcao futura no
 * componente nao pode reintroduzir o erro sem que nada reprove.
 */

/** RN-30 / RN-50. Declarados UMA vez; o componente e o formulario leem daqui. */
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Tipos que o formulario aceita. O servidor apura por assinatura binaria (RN-34). */
const TIPOS_ACEITOS: ReadonlySet<string> = new Set(['image/jpeg', 'image/png']);

/** Imagem que JA existe no armazenamento. Sai da lista, mas so some ao salvar. */
export interface StoredAnimalImageItem {
  readonly kind: 'stored';
  readonly id: string;
  readonly url: string;
}

/**
 * Imagem escolhida nesta sessao do formulario e ainda NAO enviada.
 *
 * `previewUrl` e criada UMA vez, no momento em que o item entra na lista, e
 * viaja dentro dele. Cria-la durante a renderizacao produziria uma URL nova a
 * cada render, vazaria todas as anteriores e faria a miniatura piscar.
 */
export interface StagedAnimalImageItem {
  readonly kind: 'staged';
  /** Identidade local: o `File` nao tem id, e dois arquivos podem ter o mesmo nome. */
  readonly localId: string;
  readonly file: File;
  readonly previewUrl: string;
}

/**
 * UNIAO DISCRIMINADA, e nao um objeto com campos opcionais. E ela que permite ao
 * formulario derivar sem ambiguidade as duas listas que o envio precisa: os
 * `keepImageIds` (os `stored` que sobraram, na ordem) e os arquivos a enviar (os
 * `staged`, na ordem). Com campos opcionais, "gravada sem url" e "em preparo sem
 * arquivo" seriam estados representaveis, e alguem teria de checar os dois.
 */
export type AnimalImageItem = StoredAnimalImageItem | StagedAnimalImageItem;

/** Chave estavel de um item, para `key` de lista e para remocao. */
export function itemKey(item: AnimalImageItem): string {
  return item.kind === 'stored' ? item.id : item.localId;
}

/** Quantas imagens ainda cabem, considerando o ESTADO FINAL (RN-50). */
export function remainingSlots(items: ReadonlyArray<AnimalImageItem>): number {
  return Math.max(0, MAX_IMAGES - items.length);
}

export function canAcceptFiles(
  items: ReadonlyArray<AnimalImageItem>,
  quantidade: number,
): boolean {
  return items.length + quantidade <= MAX_IMAGES;
}

export interface RejectedFile {
  readonly fileName: string;
  readonly reason: string;
}

export interface AppendResult {
  /** A lista resultante. Igual a de entrada quando nada foi aceito. */
  readonly items: ReadonlyArray<AnimalImageItem>;
  /** Arquivos recusados, cada um com o motivo — sinalizados PELO NOME. */
  readonly rejected: ReadonlyArray<RejectedFile>;
  /**
   * Recusa do LOTE inteiro por estouro do limite. Distinta de `rejected`: ali
   * cada arquivo foi julgado por si; aqui nenhum foi sequer avaliado, porque a
   * quantidade nao cabe no estado final (RN-50, CT-48).
   */
  readonly limitError?: string;
}

/** Como o item em preparo e construido. Injetado para que o teste nao precise de jsdom. */
export interface StagedFactory {
  readonly createLocalId: () => string;
  readonly createPreviewUrl: (file: File) => string;
}

function motivoDaRecusa(file: File): string | undefined {
  if (!TIPOS_ACEITOS.has(file.type)) {
    return MESSAGES.ANIMALS.IMAGE_TYPE_REJECTED;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return MESSAGES.ANIMALS.IMAGE_TOO_LARGE_REJECTED;
  }

  if (file.size === 0) {
    return MESSAGES.ANIMALS.IMAGE_EMPTY_REJECTED;
  }

  return undefined;
}

/**
 * Acrescenta arquivos a lista, aplicando o limite SOBRE O ESTADO FINAL.
 *
 * A ORDEM DAS DUAS VERIFICACOES importa e e o ponto do CT-48: o limite e
 * conferido ANTES de qualquer arquivo ser avaliado individualmente. Fosse ao
 * contrario, um lote de tres arquivos sobre uma lista de tres aceitaria os dois
 * primeiros e recusaria o terceiro — o usuario teria metade do que escolheu e
 * nenhuma explicacao coerente.
 *
 * A checagem de tipo e tamanho e apenas RETORNO IMEDIATO, e nao garantia: quem
 * chama a API diretamente recebe a mesma recusa do servidor, que apura o formato
 * por assinatura binaria (RN-33, RN-34).
 */
export function appendFiles(
  items: ReadonlyArray<AnimalImageItem>,
  files: ReadonlyArray<File>,
  fabrica: StagedFactory,
): AppendResult {
  if (files.length === 0) {
    return { items, rejected: [] };
  }

  if (!canAcceptFiles(items, files.length)) {
    return {
      items,
      rejected: [],
      limitError: MESSAGES.ANIMALS.imageLimitError(items.length, remainingSlots(items)),
    };
  }

  const aceitos: AnimalImageItem[] = [];
  const recusados: RejectedFile[] = [];

  for (const file of files) {
    const motivo = motivoDaRecusa(file);

    if (motivo === undefined) {
      aceitos.push({
        kind: 'staged',
        localId: fabrica.createLocalId(),
        file,
        previewUrl: fabrica.createPreviewUrl(file),
      });
    } else {
      recusados.push({ fileName: file.name, reason: motivo });
    }
  }

  return { items: [...items, ...aceitos], rejected: recusados };
}

/**
 * Remove por chave, PRESERVANDO A ORDEM dos demais.
 *
 * A preservacao e o que faz a capa acompanhar: removido o item da posicao 0, o
 * seguinte passa a ocupa-la, e e ele que vira a miniatura da listagem (RN-35,
 * CT-60, CA-26). Reordenar aqui — por data, por tipo, por qualquer coisa —
 * quebraria isso sem que nenhuma tela reclamasse.
 */
export function removeItem(
  items: ReadonlyArray<AnimalImageItem>,
  key: string,
): ReadonlyArray<AnimalImageItem> {
  return items.filter((item) => itemKey(item) !== key);
}

/** Os `stored` que sobraram, na ordem — e exatamente o `keepImageIds` do envio. */
export function keepImageIdsOf(items: ReadonlyArray<AnimalImageItem>): ReadonlyArray<string> {
  return items.filter((item): item is StoredAnimalImageItem => item.kind === 'stored')
    .map((item) => item.id);
}

/** Os arquivos em preparo, na ordem — as partes `images` do multipart. */
export function stagedFilesOf(items: ReadonlyArray<AnimalImageItem>): ReadonlyArray<File> {
  return items.filter((item): item is StagedAnimalImageItem => item.kind === 'staged')
    .map((item) => item.file);
}
