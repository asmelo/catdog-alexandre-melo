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
