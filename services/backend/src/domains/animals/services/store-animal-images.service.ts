import { randomUUID } from 'node:crypto';

import {
  AnimalImageEmptyError,
  AnimalImageTooLargeError,
  AnimalImageTypeNotAllowedError,
} from '~/domains/animals/errors/animal-image.errors';
import type { ImageStoragePort } from '~/infra/storage/image-storage.port';
import { buildAnimalImageObjectPath } from '~/infra/storage/object-path';
import { detectImageMimeType } from '~/infra/upload/image-signature';
import {
  MAX_IMAGE_SIZE_BYTES,
  type AllowedImageMimeType,
} from '~/infra/upload/upload-limits';

/**
 * Pipeline de VALIDACAO e GRAVACAO das imagens de um animal no armazenamento de
 * objetos (RN-31, RN-32, RN-34, RN-39, RN-52, RN-54, RNF-13).
 *
 * Nao conhece o banco, nao abre transacao e nao decide status HTTP: recebe os
 * arquivos que o multipart deixou em memoria e devolve as linhas que o
 * repositorio vai gravar. E reusado pela edicao (TASK-BACKEND-008), que envia
 * imagens novas para um animal que ja existe.
 *
 * As DUAS invariantes deste arquivo, nesta ordem:
 *
 * 1. NENHUM byte sobe antes de TODOS os arquivos estarem validados;
 * 2. NENHUM objeto e removido antes de TODOS os envios disparados terem
 *    assentado.
 *
 * Violar (1) deixa quatro objetos orfaos quando a quinta imagem e invalida.
 * Violar (2) deixa orfao cada envio que ainda estava em voo no instante da
 * compensacao — ver `enviarTodas`.
 */

/**
 * Um arquivo como o multer o entregou: o conteudo em memoria e o tamanho que ele
 * contou.
 *
 * O NOME DO ARQUIVO NAO ESTA AQUI, e a ausencia e a RN-52 materializada no tipo:
 * `../../../etc/passwd.jpg`, um nome com emoji ou um nome de 300 caracteres nao
 * tem como influenciar onde o objeto e gravado porque nunca entra neste service
 * (CT-57, CA-27). O `mimetype` declarado na parte multipart tambem nao entra: ele
 * e escrito por quem envia, e quem decide o formato e a assinatura binaria
 * (RN-34).
 *
 * `sizeBytes` vem do contador do parser e nao de `content.length` porque e ele
 * que sera persistido; os dois coincidem, e o parametro deixa a origem explicita.
 */
export interface AnimalImageUpload {
  readonly content: Buffer;
  readonly sizeBytes: number;
}

/**
 * Imagem ja gravada no armazenamento, pronta para virar linha de `animal_images`.
 *
 * SEM `publicUrl`, e a ausencia e deliberada: a porta devolve o endereco publico
 * a cada envio, mas quem persiste guarda `storagePath` (a coluna e o CAMINHO, nao
 * o endereco) e quem responde deriva a URL com `buildPublicObjectUrl`, no mapper.
 * Carregar o endereco ate aqui criaria uma SEGUNDA origem para ele, que passaria
 * a divergir do mapper no dia em que o balde ou o prefixo publico mudassem.
 */
export interface StoredAnimalImage {
  readonly imageId: string;
  readonly objectPath: string;
  readonly contentType: AllowedImageMimeType;
  readonly sizeBytes: number;
}

/** Arquivo aprovado, com caminho e identificador ja sorteados, esperando o envio. */
interface ImagemPreparada {
  readonly imageId: string;
  readonly objectPath: string;
  readonly content: Buffer;
  readonly contentType: AllowedImageMimeType;
  readonly sizeBytes: number;
}

/**
 * Por que os objetos estao sendo removidos — ver `FALHA_DE_REMOCAO`. Conjunto
 * FECHADO: um chamador novo tem de escolher uma das duas causas, e nao pode
 * inventar uma frase de log propria fora deste arquivo.
 */
export type CausaDaRemocao = 'envioDesfeito' | 'imagensSubstituidas';

const ARQUIVO_VAZIO_BYTES = 0;

export class StoreAnimalImagesService {
  constructor(private readonly storage: ImageStoragePort) {}

  /**
   * Valida TUDO, envia TUDO em paralelo e devolve as imagens gravadas na MESMA
   * ordem em que foram recebidas — e a ordem que vira `position` 0 a 4, com a
   * primeira como capa (RN-35).
   *
   * Lista vazia devolve `[]` sem tocar a rede: zero imagem e cadastro valido
   * (RN-30).
   */
  async execute(
    animalId: string,
    arquivos: ReadonlyArray<AnimalImageUpload>,
  ): Promise<ReadonlyArray<StoredAnimalImage>> {
    const preparadas = await this.prepararTodas(animalId, arquivos);

    return this.enviarTodas(preparadas);
  }

  /**
   * VALIDA TODOS OS ARQUIVOS ANTES DE ENVIAR QUALQUER UM.
   *
   * Validar e enviar no mesmo laco faria um envio com a quinta imagem invalida
   * deixar QUATRO objetos orfaos no balde: os quatro primeiros ja teriam subido
   * quando a recusa acontecesse, e nao ha animal no banco a que eles pertencam
   * para uma limpeza futura encontrar.
   *
   * O laco e SEQUENCIAL de proposito, ao contrario do envio: aqui nao ha rede — e
   * leitura de cabecalho de buffer em memoria, na casa dos microssegundos — e a
   * sequencia e o que garante que o PRIMEIRO arquivo invalido decida a mensagem.
   * Um `Promise.all` sobre a validacao faria a resposta depender de qual
   * rejeicao chegasse primeiro, e o mesmo envio poderia responder 413 ou 415
   * conforme o escalonamento.
   */
  private async prepararTodas(
    animalId: string,
    arquivos: ReadonlyArray<AnimalImageUpload>,
  ): Promise<ReadonlyArray<ImagemPreparada>> {
    const preparadas: ImagemPreparada[] = [];

    for (const arquivo of arquivos) {
      preparadas.push(await this.preparar(animalId, arquivo));
    }

    return preparadas;
  }

  /**
   * A ORDEM DAS TRES VERIFICACOES E CONTRATO, porque cada passo produz uma
   * mensagem diferente para o administrador:
   *
   * 1. tamanho zero  ⇒ 400 "O arquivo enviado está vazio." (RN-54, CT-51);
   * 2. assinatura    ⇒ 415 "Apenas imagens JPEG ou PNG são aceitas."
   *                    (RN-31/RN-34/RN-53, CT-52, CT-53);
   * 3. acima de 5 MB ⇒ 413 "Cada imagem deve ter no máximo 5 MB." (RN-32).
   *
   * O tamanho zero vem ANTES da assinatura porque `detectImageMimeType` devolve
   * `null` tanto para um buffer vazio quanto para um GIF: invertida, a ordem
   * mandaria o administrador procurar problema de FORMATO num arquivo que na
   * verdade nao subiu.
   *
   * O tamanho maximo vem DEPOIS da assinatura porque a pergunta "isto e mesmo uma
   * imagem?" precede "esta imagem cabe?": um executavel de 6 MB renomeado para
   * `.jpg` deve ser recusado por NAO SER IMAGEM (415), e nao por ser grande
   * demais (413), que insinuaria que uma versao menor dele seria aceita.
   *
   * O caminho do objeto sai de `buildAnimalImageObjectPath`, que nao recebe o nome
   * do arquivo em ponto algum, e a extensao vem do tipo APURADO — um JPEG chamado
   * `foto.png` e gravado como `.jpg` (RN-34, RN-52).
   */
  private async preparar(
    animalId: string,
    arquivo: AnimalImageUpload,
  ): Promise<ImagemPreparada> {
    if (arquivo.sizeBytes === ARQUIVO_VAZIO_BYTES) {
      throw new AnimalImageEmptyError();
    }

    const contentType = await detectImageMimeType(arquivo.content);

    if (contentType === null) {
      throw new AnimalImageTypeNotAllowedError();
    }

    if (arquivo.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new AnimalImageTooLargeError();
    }

    const imageId = randomUUID();

    return {
      imageId,
      objectPath: buildAnimalImageObjectPath(animalId, imageId, contentType),
      content: arquivo.content,
      contentType,
      sizeBytes: arquivo.sizeBytes,
    };
  }

  /**
   * OS ENVIOS SAO CONCORRENTES, E NAO EM SERIE (RNF-13). E a decisao mais
   * consequente deste arquivo, e a aritmetica e esta:
   *
   * - o RNF-13 da 30 s ao envio INTEIRO, do primeiro byte a resposta, e nao por
   *   objeto;
   * - o adaptador da TASK-BACKEND-004 aplica `AbortSignal.timeout` de 20 s a CADA
   *   chamada (`TEMPO_LIMITE_MS`, em `src/infra/storage/supabase-image-storage.ts`),
   *   para que uma requisicao pendurada nao segure a transacao e a conexao do
   *   pooler. Esse teto e premissa, e nao escolha a rediscutir aqui;
   * - EM SERIE, o pior caso e 5 x 20 s = 100 s — 3,3x acima do orcamento;
   * - EM PARALELO, o pior caso e o do objeto mais lento, ~20 s, deixando ~10 s de
   *   folga para validacao, transacao e resposta.
   *
   * E a concorrencia que faz o teto de 20 s caber no RNF-13, e a decisao e do
   * SERVICE porque a porta trata de uma chamada por vez. O laco com `await`
   * dentro — a implementacao obvia — viola o requisito sem que nenhuma asercao de
   * resultado perceba: o desfecho dela e identico, so o relogio muda.
   *
   * `allSettled` E NAO `all`, E ESTA E A SEGUNDA METADE DA DECISAO. `Promise.all`
   * rejeita na PRIMEIRA rejeicao, com os demais envios ainda em voo; compensar ali
   * removeria apenas o que ja tivesse subido, e cada envio que terminasse DEPOIS
   * da remocao viraria um objeto orfao — o CT-55 passaria a falhar por um motivo
   * novo, introduzido pela propria correcao. Com `allSettled` a compensacao so
   * comeca quando NENHUM envio esta mais em andamento, entao a lista de objetos a
   * remover e completa e definitiva (RN-39, RNF-06, CA-24).
   *
   * A ordem do `allSettled` acompanha a ordem da entrada, e e dela que sai o
   * `position` sequencial da RN-35.
   */
  private async enviarTodas(
    preparadas: ReadonlyArray<ImagemPreparada>,
  ): Promise<ReadonlyArray<StoredAnimalImage>> {
    const desfechos = await Promise.allSettled(
      preparadas.map(async (imagem) => this.enviar(imagem)),
    );

    const gravadas = desfechos.flatMap((desfecho) =>
      desfecho.status === 'fulfilled' ? [desfecho.value] : [],
    );

    if (gravadas.length === desfechos.length) {
      return gravadas;
    }

    await this.compensar(
      gravadas.map((imagem) => imagem.objectPath),
      'envioDesfeito',
    );

    throw primeiraFalha(desfechos);
  }

  private async enviar(imagem: ImagemPreparada): Promise<StoredAnimalImage> {
    /**
     * O `publicUrl` que a porta devolve e DESCARTADO de proposito — ver
     * `StoredAnimalImage`. O que interessa do envio e ele ter acontecido; o
     * endereco publico se deriva do caminho quando a resposta e montada.
     */
    await this.storage.upload({
      objectPath: imagem.objectPath,
      content: imagem.content,
      contentType: imagem.contentType,
    });

    return {
      imageId: imagem.imageId,
      objectPath: imagem.objectPath,
      contentType: imagem.contentType,
      sizeBytes: imagem.sizeBytes,
    };
  }

  /**
   * As DUAS causas que levam objetos ja no balde a serem removidos, cada uma com
   * a sua frase de log.
   *
   * A politica de engolir-e-registrar continua morando em UM lugar so
   * (`compensar`); o que se distingue aqui e apenas o TEXTO, porque as duas causas
   * pedem investigacoes opostas:
   *
   * - `envioDesfeito` — a gravacao NAO aconteceu (transacao desfeita, conflito,
   *   animal ausente) e os objetos que sobraram sao de imagens que o produto nunca
   *   passou a referenciar;
   * - `imagensSubstituidas` — a gravacao ACONTECEU, e o que ficou para tras sao os
   *   objetos das imagens que a edicao trocou (RN-36, RN-40). Quem le o log nao
   *   deve sair a procura de um envio desfeito que nao existe.
   *
   * Frases inteiras e nao pedacos concatenados: cada uma continua sendo um literal
   * unico, localizavel por busca direta no codigo a partir da linha do log.
   */
  private static readonly FALHA_DE_REMOCAO: Readonly<Record<CausaDaRemocao, string>> = {
    envioDesfeito:
      '[animal-images] falha ao remover objetos apos envio desfeito; limpeza pendente',
    imagensSubstituidas:
      '[animal-images] falha ao remover objetos de imagens substituidas; limpeza pendente',
  };

  /**
   * Remove os objetos que subiram antes de a falha ser propagada (RN-39, CT-55).
   *
   * Publico porque o cadastro tambem precisa dele DEPOIS do envio: se a transacao
   * do banco falhar com as imagens ja no balde, o banco se desfaz sozinho e o
   * armazenamento nao. Ver `create-animal.service.ts`. A edicao o chama duas
   * vezes, com causas diferentes: para desfazer o envio quando a transacao cai, e
   * depois do commit para apagar os objetos das imagens substituidas.
   *
   * `causa` e OBRIGATORIA justamente para que nenhum chamador novo herde por
   * omissao a frase do caminho errado.
   *
   * A FALHA DA PROPRIA COMPENSACAO NAO PROPAGA, e isso e a RN-40: a remocao nao e
   * revertida e o objeto remanescente vira pendencia de limpeza no log. Deixa-la
   * propagar trocaria o erro que explica o que aconteceu — "não foi possível
   * salvar as imagens" — por um erro sobre a faxina, e o administrador leria uma
   * mensagem sobre uma operacao que ele nao pediu.
   */
  async compensar(
    objectPaths: ReadonlyArray<string>,
    causa: CausaDaRemocao,
  ): Promise<void> {
    if (objectPaths.length === 0) {
      return;
    }

    await this.storage.remove(objectPaths).catch((motivo: unknown) => {
      console.error(StoreAnimalImagesService.FALHA_DE_REMOCAO[causa], {
        objectPaths,
        motivo,
      });
    });
  }
}

/**
 * A PRIMEIRA rejeicao da lista, e nao uma inventada aqui.
 *
 * Preserva o erro que o adaptador ja traduziu — `ImageStorageUnavailableError`
 * (503), nunca o `StorageError` do fornecedor, que morre em
 * `src/infra/storage/` — e, com ele, preserva tambem o desfecho correto para um
 * defeito NOSSO: um `TypeError` vindo daqui continua saindo como 500 com stack no
 * log, em vez de ser disfarcado de indisponibilidade de terceiro. Envolver tudo
 * num 503 esconderia o bug e ainda convidaria o administrador a tentar de novo
 * uma operacao que jamais funcionaria.
 *
 * "Primeira" e a primeira POSICAO da lista e nao a primeira no tempo: com os
 * envios concorrentes nao existe ordem temporal estavel, e a posicional e a unica
 * que produz a mesma resposta para a mesma entrada.
 */
function primeiraFalha(desfechos: ReadonlyArray<PromiseSettledResult<unknown>>): unknown {
  for (const desfecho of desfechos) {
    if (desfecho.status === 'rejected') {
      return desfecho.reason;
    }
  }

  /**
   * Inalcancavel: so se chega aqui quando ha ao menos uma rejeicao. O `throw` de
   * um `TypeError` — e nao de um erro de dominio — e o que faz um eventual furo
   * na leitura acima aparecer como 500 com stack, e nunca como um 503 silencioso.
   */
  return new TypeError('Nenhuma rejeicao encontrada entre os envios ao armazenamento.');
}
