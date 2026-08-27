import { StorageClient } from '@supabase/storage-js';

import { env } from '~/config/env';
import { ImageStorageUnavailableError } from '~/domains/animals/errors/animal-image.errors';
import {
  ImageStorageDefectError,
  type ImageStoragePort,
  type StoredImageInput,
} from '~/infra/storage/image-storage.port';

/**
 * UNICO arquivo do projeto autorizado a importar o cliente do Supabase.
 *
 * O isolamento segue a mesma logica de `nodemailer-mailer.ts`: todos os chamadores
 * conhecem apenas `ImageStoragePort`, entao trocar o fornecedor de armazenamento
 * custa a edicao deste arquivo e de mais nenhum. Nenhum service, controller ou
 * repositorio importa o cliente, e nenhum deles ve `StorageError`.
 *
 * POR QUE `@supabase/storage-js` E NAO `@supabase/supabase-js`:
 *
 * O `createClient` do `supabase-js` monta, junto com o cliente de armazenamento,
 * um cliente de realtime — e desde a versao 2.109 esse construtor LANCA em Node 20
 * ("Node.js 20 detected without native WebSocket support"), porque WebSocket so e
 * global a partir do Node 22. O `engines` deste servico e `>=20 <21`, entao o
 * `supabase-js` atual derrubaria o boot da aplicacao. Verificado: 2.105 constroi,
 * 2.109 lanca.
 *
 * As duas saidas descartadas e por que: fixar o `supabase-js` numa versao antiga
 * deixaria uma armadilha — o proximo `npm update` reintroduz uma queda de boot em
 * producao; acrescentar o pacote `ws` traria dependencia de execucao so para
 * satisfazer o realtime, que este produto nunca usa. O `storage-js` e o MESMO
 * fornecedor, na mesma linha de versao, publicado avulso e documentado pelo
 * proprio Supabase como "standalone import" — e e exatamente a unica superficie do
 * Supabase que este produto consome, ja que o banco vai por Prisma e a sessao e
 * JWT proprio. Sem WebSocket, sem auth, sem postgrest.
 *
 * PRE-REQUISITO DE INFRAESTRUTURA, nao de codigo. O balde precisa existir ANTES do
 * primeiro cadastro com foto, provisionado no painel do Supabase com:
 *
 *   - nome igual a `SUPABASE_STORAGE_BUCKET` (padrao `animal-images`);
 *   - LEITURA PUBLICA, porque o navegador busca a imagem direto pela URL publica,
 *     sem passar pela API;
 *   - ESCRITA RESTRITA a credencial de servico (`SUPABASE_SERVICE_ROLE_KEY`), que
 *     vive apenas no servidor e nunca e entregue ao navegador (RNF-04, CA-44).
 *
 * Criar o balde por codigo foi descartado: provisionamento e infraestrutura, e uma
 * aplicacao com permissao para criar balde tem permissao para apaga-lo.
 */

/**
 * Tempo limite de CADA chamada ao armazenamento.
 *
 * Sem tempo limite, uma requisicao pendurada segura a transacao do banco aberta
 * pelo caso de uso — e uma conexao do pooler junto com ela — ate o socket morrer
 * por conta propria, que pode nao acontecer nunca.
 *
 * O RNF-13 da 30 segundos ao ENVIO INTEIRO (ate cinco imagens de 5 MB), e nao a
 * cada objeto. 20 s por chamada e folgado para um PUT de 5 MB e mantem o envio
 * dentro do orcamento QUANDO OS OBJETOS SOBEM EM PARALELO. CONSEQUENCIA QUE A
 * TASK-BACKEND-007 HERDA: cinco envios em serie com esse teto somariam 100 s no
 * pior caso, muito alem do RNF-13 — a concorrencia dos envios e decisao do
 * service, nao da porta, e ela precisa ser tomada la.
 */
const TEMPO_LIMITE_MS = 20_000;

/**
 * `FileOptions` do `storage-js` NAO possui campo `signal` (verificado na 2.109:
 * cacheControl, contentType, upsert, duplex, metadata, headers). Aplicar
 * `AbortSignal.timeout` no `upload(...)` e, portanto, impossivel — o unico ponto
 * de enxerto real e o `fetch` do cliente.
 *
 * Fazer isso aqui e melhor do que um `Promise.race` no adaptador: o race
 * devolveria o controle no prazo mas deixaria a requisicao HTTP viva por tras,
 * segurando o socket. O `AbortSignal` ABORTA de verdade.
 */
const fetchComTempoLimite: typeof fetch = (entrada, opcoes) =>
  fetch(entrada, { ...opcoes, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });

/**
 * Fabrica do cliente, chamada UMA UNICA VEZ na composicao da aplicacao — nunca por
 * requisicao. Um cliente por requisicao jogaria fora o `keep-alive` das conexoes,
 * que e exatamente o que se quer preservar num envio de 25 MB.
 *
 * A credencial vai nos DOIS cabecalhos que a API de armazenamento do Supabase
 * espera, reproduzindo o que o `supabase-js` monta internamente: `apikey`
 * identifica o projeto e `Authorization` autentica a escrita. Sem o segundo, o
 * balde de escrita restrita recusaria o envio.
 */
export function createSupabaseStorageClient(): StorageClient {
  // A barra final e comum em variavel de ambiente copiada do painel e produziria
  // `//storage/v1` na URL montada.
  const base = env.SUPABASE_URL.replace(/\/+$/, '');

  return new StorageClient(
    `${base}/storage/v1`,
    {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    fetchComTempoLimite,
  );
}

export class SupabaseImageStorage implements ImageStoragePort {
  /**
   * O cliente e INJETADO, nunca instanciado aqui. Pelo mesmo motivo do
   * `NodemailerMailer`: `createSupabaseStorageClient()` le `env` e monta um cliente
   * de rede, e um construtor que fizesse isso tornaria a classe impossivel de
   * exercitar sem credencial e sem socket.
   *
   * O adaptador NAO le `process.env`: quem le e `src/config/env.ts`, unico ponto
   * do backend autorizado a isso, e o resultado chega aqui ja pela fabrica.
   */
  constructor(
    private readonly client: StorageClient,
    private readonly bucket: string = env.SUPABASE_STORAGE_BUCKET,
  ) {}

  async upload(input: StoredImageInput): Promise<{ readonly publicUrl: string }> {
    const balde = this.client.from(this.bucket);

    const { data, error } = await this.executar(() =>
      balde.upload(input.objectPath, input.content, {
        contentType: input.contentType,

        /**
         * `upsert: false` e INTENCIONAL. O caminho contem um UUID novo a cada
         * imagem, entao uma colisao so pode significar defeito — e sobrescrever em
         * silencio esconderia esse defeito, apagando a imagem de outro animal sem
         * deixar rastro. Que a colisao chegue como falha e o comportamento desejado.
         */
        upsert: false,
      }),
    );

    if (error !== null) {
      /**
       * O erro do fornecedor MORRE AQUI. Nem `error.message`, nem o `statusCode`
       * do `StorageApiError`, nem a distincao entre "balde inexistente",
       * "credencial recusada" e "objeto duplicado" atravessam esta linha: o
       * dominio recebe uma unica regra violada — nao foi possivel gravar — e
       * continua ignorante de qual servico guarda os arquivos.
       *
       * O diagnostico nao se perde: ele vai para o log do servidor, que e onde
       * quem opera precisa dele, e nao para a resposta do administrador.
       */
      console.error('[catdog-backend] Falha ao gravar objeto no armazenamento:', error);

      throw new ImageStorageUnavailableError();
    }

    if (data === null) {
      /**
       * Contrato do cliente violado: ele promete `data` OU `error`, nunca nenhum
       * dos dois. Isto nao e falha do armazenamento — e defeito, nosso ou da
       * biblioteca, e por isso sai como `ImageStorageDefectError` (500 com stack no
       * log) e nao como 503. Ver o comentario da classe para por que ela estende
       * `TypeError`: sinalizada com `new Error(...)` cru, esta linha viraria um 415
       * silencioso culpando o arquivo que o administrador enviou.
       */
      throw new ImageStorageDefectError(
        'O cliente do armazenamento devolveu resposta sem `data` e sem `error` no upload.',
      );
    }

    /**
     * `getPublicUrl` NAO e leitura: e montagem de string a partir da URL base e do
     * caminho, sem ida a rede. A porta continua sem prometer download.
     */
    return { publicUrl: balde.getPublicUrl(data.path).data.publicUrl };
  }

  async remove(objectPaths: ReadonlyArray<string>): Promise<void> {
    /**
     * Lista vazia nao vira requisicao. O caminho de compensacao chama `remove` com
     * o que ja subiu, e "nada subiu" e um caso corriqueiro dele — uma ida a rede
     * para apagar zero objetos so acrescentaria latencia e um modo de falha novo
     * exatamente onde ja se esta tratando uma falha.
     */
    if (objectPaths.length === 0) {
      return;
    }

    /**
     * Copia porque `remove` do cliente pede `string[]` mutavel e a porta declara
     * `ReadonlyArray`. A copia tambem impede que a biblioteca altere a lista de
     * quem chamou.
     */
    const { error } = await this.executar(() =>
      this.client.from(this.bucket).remove([...objectPaths]),
    );

    if (error !== null) {
      /**
       * REJEITA normalmente, sem tentar compensar nada. Quem decide o efeito de uma
       * remocao que falhou e o service: pela RN-40 a operacao NAO e revertida, o
       * arquivo remanescente vira pendencia de limpeza e o administrador nao ve
       * erro. Decidir isso aqui tiraria do dominio uma escolha de negocio.
       */
      console.error('[catdog-backend] Falha ao remover objetos do armazenamento:', error);

      throw new ImageStorageUnavailableError();
    }
  }

  /**
   * Envelope UNICO das chamadas ao cliente.
   *
   * O `storage-js` devolve a falha em `{ data, error }` na maioria dos caminhos
   * (ele embrulha ate a falha de rede em `StorageUnknownError`), mas RELANCA o que
   * nao for `StorageError` — o `TypeError: fetch failed` do undici e o
   * `TimeoutError` do `AbortSignal.timeout` podem sair por aqui dependendo de onde
   * a falha ocorre. Sem este envelope, esses dois escapariam do adaptador com o
   * formato e o vocabulario do fornecedor.
   *
   * TUDO o que o cliente lanca vira 503, e a escolha e deliberada: no momento em
   * que a chamada ja partiu, o que falha e a conversa com o armazenamento. Tratar
   * um `TypeError` vindo DAQUI como defeito nosso transformaria a queda da rede —
   * o caso mais comum de todos — em 500 sem `code`, quebrando o CT-56. Os defeitos
   * proprios do adaptador sao os que ELE detecta, e sao lancados fora deste
   * envelope, com `ImageStorageDefectError`.
   */
  private async executar<T extends { readonly error: unknown }>(
    chamada: () => PromiseLike<T>,
  ): Promise<T> {
    try {
      return await chamada();
    } catch (falha) {
      console.error('[catdog-backend] Armazenamento de objetos inacessivel:', falha);

      throw new ImageStorageUnavailableError();
    }
  }
}
