import { env } from '~/config/env';
import type { AllowedImageMimeType } from '~/infra/upload/upload-limits';

/**
 * RN-52 — o caminho do objeto no armazenamento e SEMPRE gerado pela aplicacao.
 *
 * O nome do arquivo enviado pelo administrador nao e parametro desta funcao, e a
 * ausencia e a propria garantia: `../../../etc/passwd.jpg`, um nome com emoji ou
 * um nome de 300 caracteres nao tem como influenciar onde o arquivo e gravado
 * porque nao chega ate aqui (RNF-03, CT-57, CA-27). Nada e escapado ou saneado, e
 * nem precisa ser — os dois unicos componentes variaveis sao UUID gerados pela
 * aplicacao, nenhum deles vindo de entrada do usuario.
 *
 * O prefixo por animal (`animals/<id>/`) nao e enfeite de organizacao: e ele que
 * torna a limpeza dos objetos de um animal excluido uma operacao sobre um prefixo
 * conhecido (RN-37), em vez de uma busca no balde inteiro.
 */

/**
 * A extensao vem do TIPO APURADO POR ASSINATURA (`detectImageMimeType`), nunca do
 * nome enviado: um JPEG chamado `foto.png` e gravado como `.jpg`, e e o conteudo
 * real que manda (RN-34).
 *
 * O parametro e tipado como `AllowedImageMimeType`, e nao como `string`, de
 * proposito. Assim nao existe ramo de contingencia para "tipo desconhecido" — ele
 * e INEXPRIMIVEL, e o compilador obriga quem acrescentar um formato aceito em
 * `ALLOWED_IMAGE_MIME_TYPES` a decidir a extensao aqui, no mesmo commit. Um
 * `string` com `?? '.bin'` produziria silenciosamente objetos sem extensao util no
 * dia em que a lista crescesse.
 */
const EXTENSAO_POR_TIPO: Record<AllowedImageMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export function buildAnimalImageObjectPath(
  animalId: string,
  imageId: string,
  contentType: AllowedImageMimeType,
): string {
  return `animals/${animalId}/${imageId}${EXTENSAO_POR_TIPO[contentType]}`;
}

/**
 * Caminho publico do balde de leitura publica, no formato da API de
 * armazenamento do Supabase. E o mesmo prefixo que `getPublicUrl` do
 * `storage-js` monta, e por isso a URL devolvida aqui e IDENTICA a que o
 * `SupabaseImageStorage.upload` devolve para o mesmo objeto.
 */
const PREFIXO_DE_LEITURA_PUBLICA = 'storage/v1/object/public';

/**
 * URL publica de um objeto ja gravado, a partir do caminho guardado em
 * `animal_images.storage_path`.
 *
 * POR QUE ELA E DERIVADA E NAO PERSISTIDA: a tabela guarda o CAMINHO, nao a URL
 * (ver `AnimalImage.storagePath` no schema). Gravar a URL inteira congelaria o
 * dominio do armazenamento dentro de cada linha, e trocar de projeto Supabase —
 * ou de fornecedor — exigiria reescrever todas as linhas de `animal_images` em
 * vez de mudar uma variavel de ambiente.
 *
 * POR QUE VIVE EM `src/infra/storage/` E NAO NO MAPPER DO DOMINIO: o formato
 * `.../storage/v1/object/public/<balde>/<caminho>` e vocabulario do FORNECEDOR.
 * Escrito no mapper, trocar o Supabase mexeria em `src/domains/`, contrariando o
 * isolamento que `image-storage.port.ts` declara. O mapper importa esta funcao e
 * continua ignorante de quem guarda os arquivos.
 *
 * NAO e metodo da `ImageStoragePort`: a porta e a superficie de SAIDA usada
 * pelas escritas, e a leitura da vitrine nem sequer passa pela API (o navegador
 * busca o objeto direto). Acrescentar um metodo la obrigaria todo duble de teste
 * a implementa-lo para um caminho que nao exercita a rede.
 *
 * Nada e escapado, e nao precisa ser: os dois componentes variaveis do caminho
 * sao UUID gerados pela aplicacao mais uma extensao de uma lista fechada
 * (`buildAnimalImageObjectPath`), todos ja seguros em URL. Nome de arquivo
 * enviado pelo administrador nunca chega ate aqui (RN-52).
 */
export function buildPublicObjectUrl(objectPath: string): string {
  // A barra final e comum em variavel de ambiente copiada do painel e produziria
  // `//storage/v1` na URL montada — mesma limpeza feita em
  // `createSupabaseStorageClient`.
  const base = env.SUPABASE_URL.replace(/\/+$/, '');

  return `${base}/${PREFIXO_DE_LEITURA_PUBLICA}/${env.SUPABASE_STORAGE_BUCKET}/${objectPath}`;
}
