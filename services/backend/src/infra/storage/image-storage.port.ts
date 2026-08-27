/**
 * Imagem pronta para gravacao. `objectPath` NUNCA e escolhido por quem envia: ele
 * sai de `buildAnimalImageObjectPath`, que nao recebe o nome do arquivo como
 * parametro (RN-52). `contentType` e o tipo APURADO POR ASSINATURA
 * (`detectImageMimeType`), nunca a extensao do nome nem o `mimetype` declarado na
 * parte multipart, ambos escritos por quem envia (RN-34).
 */
export interface StoredImageInput {
  readonly objectPath: string;
  readonly content: Buffer;
  readonly contentType: string;
}

/**
 * Porta de saida do armazenamento de objetos (inversao de dependencia).
 *
 * Segunda porta do backend, ao lado da `MailerPort`, e a primeira sobre HTTP. Os
 * services de animal dependem DESTA interface e nunca do cliente do Supabase.
 * E o que permite injetar um duble nos testes (`tests/fakes/fake-image-storage.ts`)
 * e trocar o fornecedor editando um unico arquivo de infraestrutura.
 *
 * O contrato NAO promete leitura, e a ausencia e deliberada: nenhuma imagem passa
 * pela API. O navegador busca o objeto direto no armazenamento pela URL publica,
 * entao um metodo de download aqui so criaria um caminho de banda e de latencia
 * que o produto nao usa. Nada nesta porta escreve no sistema de arquivos do
 * conteiner, que e efemero e perderia os arquivos a cada implantacao (RN-38).
 *
 * `upload` REJEITA em qualquer falha, e quem chama decide o efeito: na gravacao a
 * alteracao do animal e desfeita por inteiro (RN-39); na remocao a operacao NAO e
 * revertida e o arquivo remanescente vira pendencia de limpeza no log (RN-40). A
 * porta nao decide isso — decidir aqui tiraria do dominio uma escolha que e de
 * negocio, exatamente como a `MailerPort` deixa a tolerancia a falha de e-mail
 * para o caso de uso.
 */
export interface ImageStoragePort {
  upload(input: StoredImageInput): Promise<{ readonly publicUrl: string }>;

  /**
   * Recebe LISTA, e nao um caminho por chamada: a exclusao de um animal apaga ate
   * cinco objetos e o desfazimento de um envio parcial apaga os que ja subiram.
   * Uma remocao por chamada multiplicaria idas a rede justamente no caminho de
   * compensacao, que e onde o custo importa — e onde a lentidao aparece depois de
   * o administrador ja ter visto uma falha.
   */
  remove(objectPaths: ReadonlyArray<string>): Promise<void>;
}

/**
 * Defeito de programacao NOSSO dentro de um adaptador desta porta — jamais falha
 * do fornecedor, que e sinalizada com `ImageStorageUnavailableError`.
 *
 * O QUE A FIACAO ATUAL FAZ COM ELE:
 *
 * Nao e `AppError`, entao o `error-handler.middleware.ts` o joga no ramo generico
 * — 500 `INTERNAL_ERROR`, com a stack indo para o `console.error` do servidor e o
 * cliente recebendo mensagem generica. E onde um bug nosso deve mesmo aparecer, e
 * isso vale INDEPENDENTEMENTE do construtor nativo que a classe estenda.
 *
 * POR QUE ESTENDE `TypeError` MESMO ASSIM — redundancia defensiva, e nao a peca
 * que fecha algum buraco:
 *
 * `upload-animal-images.middleware.ts` tem um filtro (`traduzirFalhaDaLeitura`)
 * que traduz para 415 `MultipartBodyRequiredError` tudo o que nao seja `AppError`,
 * `MulterError` ou um dos quatro construtores de `DEFEITOS_DE_PROGRAMACAO`
 * (`TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`). Um adaptador desta
 * porta NUNCA ATRAVESSA esse filtro: ele so e alcancado pelo callback que o
 * proprio multer invoca, logo so enxerga o que o multer entrega ali. O adaptador
 * roda depois, ja no handler da rota, e o `next(erro)` de la segue PARA A FRENTE,
 * direto ao `error-handler`, sem reentrar naquele callback. Nao existe hoje
 * caminho pelo qual um defeito deste adaptador vire 415.
 *
 * A heranca cobre o caso que ainda NAO existe: um adaptador desta porta chamado de
 * DENTRO do pipeline de leitura do multipart. Ali, um `new Error(...)` cru cairia
 * no ramo de 415 — a aplicacao esconderia um bug proprio e ainda diria ao
 * administrador que a culpa e do arquivo que ele enviou. Estender `TypeError`
 * mantem o sinal distinguivel para aquele filtro sem toca-lo e sem duplicar a
 * lista dos quatro construtores em mais um arquivo; o nome proprio da classe
 * continua legivel na stack e no log, que e o que `TypeError` cru sozinho nao
 * daria. Custo zero, portanto fica.
 *
 * NAO e usada para falha de rede nem para erro devolvido pelo fornecedor: essas
 * sao 503, porque o pedido estava correto e nao ha bug a corrigir.
 */
export class ImageStorageDefectError extends TypeError {
  constructor(message: string) {
    super(message);

    this.name = new.target.name;

    // Mesma razao do `AppError`: sem isto o `instanceof` da subclasse falharia se
    // o alvo de compilacao voltasse a rebaixar `extends`.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
