import { StorageApiError, StorageClient } from '@supabase/storage-js';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import { ImageStorageUnavailableError } from '~/domains/animals/errors/animal-image.errors';
import { ImageStorageDefectError } from '~/infra/storage/image-storage.port';
import {
  createSupabaseStorageClient,
  SupabaseImageStorage,
} from '~/infra/storage/supabase-image-storage';
import { AppError } from '~/shared/errors/app-error';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Único arquivo do projeto autorizado a importar o cliente do Supabase
 * (TASK-BACKEND-004).
 *
 * Nenhum teste aqui abre socket nem usa credencial real: o cliente de armazenamento é
 * INJETADO no construtor e aqui chega dublado. É esse o motivo de o cliente ser
 * injetado em vez de instanciado dentro da classe — `createSupabaseStorageClient()`
 * lê `env` e monta um cliente de rede, e um construtor que fizesse isso tornaria a
 * classe impossível de exercitar sem balde de verdade.
 */

/** Derivado do próprio cliente para não depender de um tipo interno do pacote. */
type BaldeDeArmazenamento = ReturnType<StorageClient['from']>;

const BALDE = 'animal-images-de-teste';
const CAMINHO = 'animals/c7066355-5591-4a6f-a3f8-2a9ee727b2d0/9f1b4e2a-0c37-4d55-9e88-1a2b3c4d5e6f.jpg';
const URL_PUBLICA = `https://projeto-de-teste.supabase.co/storage/v1/object/public/${BALDE}/${CAMINHO}`;

const ENTRADA = {
  objectPath: CAMINHO,
  content: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  contentType: 'image/jpeg',
} as const;

/**
 * O erro REAL do fornecedor, e não um objeto parecido: `StorageError` declara
 * `__isStorageError` como `protected`, então só a classe de verdade prova que o
 * adaptador trata o que o Supabase realmente devolve. O adaptador NUNCA deixa
 * nada disto atravessar — nem a mensagem, nem o `statusCode`, nem o nome da
 * classe — e é isso que os testes abaixo verificam.
 */
const ERRO_DO_FORNECEDOR = new StorageApiError('Bucket not found', 404, '404');

type RespostaDeUpload = Awaited<ReturnType<BaldeDeArmazenamento['upload']>>;

/**
 * Resposta que o cliente NÃO deveria conseguir produzir: ele promete `data` OU
 * `error`. O tipo declarado torna isso inexprimível, e é justamente essa promessa
 * que o defeito viola — daí a conversão, que existe só para poder testá-lo.
 */
const RESPOSTA_SEM_DATA_E_SEM_ERRO = {
  data: null,
  error: null,
} as unknown as RespostaDeUpload;

/** Narrowing sem `as`: falha que não for `AppError` derruba o teste com a causa real. */
function comoAppError(falha: unknown): AppError {
  if (!(falha instanceof AppError)) {
    throw new Error(`Esperado AppError, veio: ${String(falha)}`);
  }

  return falha;
}

interface Cenario {
  readonly cliente: DeepMockProxy<StorageClient>;
  readonly balde: DeepMockProxy<BaldeDeArmazenamento>;
  readonly armazenamento: SupabaseImageStorage;
}

function montarCenario(): Cenario {
  const cliente = mockDeep<StorageClient>();
  const balde = mockDeep<BaldeDeArmazenamento>();

  cliente.from.mockReturnValue(balde);
  balde.getPublicUrl.mockReturnValue({ data: { publicUrl: URL_PUBLICA } });

  return { cliente, balde, armazenamento: new SupabaseImageStorage(cliente, BALDE) };
}

function respostaDeUploadBemSucedido(): { data: { id: string; path: string; fullPath: string }; error: null } {
  return { data: { id: 'id-do-objeto', path: CAMINHO, fullPath: `${BALDE}/${CAMINHO}` }, error: null };
}

/** Silencia o diagnóstico que o adaptador manda para o log do servidor. */
function silenciarLog(): jest.SpyInstance {
  return jest.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('SupabaseImageStorage.upload', () => {
  it('grava no balde configurado e devolve a URL pública do objeto', async () => {
    // Arrange
    const { balde, cliente, armazenamento } = montarCenario();
    balde.upload.mockResolvedValue(respostaDeUploadBemSucedido());

    // Act
    const resultado = await armazenamento.upload(ENTRADA);

    // Assert
    expect(cliente.from).toHaveBeenCalledWith(BALDE);
    expect(resultado).toEqual({ publicUrl: URL_PUBLICA });
  });

  it('envia o `contentType` explícito e `upsert: false`', async () => {
    // Arrange — `upsert: false` é intencional: o caminho contém um UUID novo a
    // cada imagem, então colisão significa defeito, e sobrescrever em silêncio
    // esconderia esse defeito.
    const { balde, armazenamento } = montarCenario();
    balde.upload.mockResolvedValue(respostaDeUploadBemSucedido());

    // Act
    await armazenamento.upload(ENTRADA);

    // Assert
    expect(balde.upload).toHaveBeenCalledWith(CAMINHO, ENTRADA.content, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('CT-56 — erro devolvido pelo armazenamento vira 503 IMAGE_STORAGE_UNAVAILABLE', async () => {
    // Arrange
    const log = silenciarLog();
    const { balde, armazenamento } = montarCenario();
    balde.upload.mockResolvedValue({ data: null, error: ERRO_DO_FORNECEDOR });

    // Act
    const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

    // Assert
    expect(falha).toBeInstanceOf(ImageStorageUnavailableError);
    expect(falha).toBeInstanceOf(AppError);

    const erro = comoAppError(falha);
    expect(erro.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(erro.code).toBe('IMAGE_STORAGE_UNAVAILABLE');
    expect(erro.message).toBe('Não foi possível salvar as imagens. Tente novamente.');

    // O diagnóstico do fornecedor vai para o log do servidor, e não para a resposta.
    expect(log).toHaveBeenCalledWith(expect.any(String), ERRO_DO_FORNECEDOR);
  });

  it('o código de erro do fornecedor NÃO vaza para quem chama', async () => {
    // Arrange — é isto que mantém o domínio ignorante do Supabase: trocar de
    // fornecedor não pode mudar nada fora de `src/infra/storage/`.
    silenciarLog();
    const { balde, armazenamento } = montarCenario();
    balde.upload.mockResolvedValue({ data: null, error: ERRO_DO_FORNECEDOR });

    // Act
    const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

    // Assert
    const erro = comoAppError(falha);
    expect(erro.message).not.toContain('Bucket not found');
    expect(erro.code).not.toContain('404');
    expect(erro.name).toBe('ImageStorageUnavailableError');
    expect(JSON.stringify({ code: erro.code, message: erro.message })).not.toContain('Storage');
  });

  it('exceção lançada pelo cliente também vira 503, e não 500', async () => {
    // Arrange — o `storage-js` embrulha a maioria das falhas em `{ error }`, mas
    // RELANÇA o que não for `StorageError`: o `TypeError: fetch failed` do undici e
    // o `TimeoutError` do `AbortSignal.timeout` saem por aqui. Queda de rede é o
    // caso mais comum de todos e precisa continuar sendo o 503 do CT-56.
    silenciarLog();
    const { balde, armazenamento } = montarCenario();
    balde.upload.mockRejectedValue(new TypeError('fetch failed'));

    // Act
    const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

    // Assert
    expect(falha).toBeInstanceOf(ImageStorageUnavailableError);
    expect(comoAppError(falha).statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
  });

  describe('defeito próprio do adaptador', () => {
    it('resposta sem `data` e sem `error` é defeito NOSSO, não indisponibilidade', async () => {
      // Arrange — o cliente promete `data` OU `error`. Nenhum dos dois é contrato
      // violado, e contrato violado não é 503: não há nova tentativa que resolva.
      const { balde, armazenamento } = montarCenario();
      balde.upload.mockResolvedValue(RESPOSTA_SEM_DATA_E_SEM_ERRO);

      // Act
      const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

      // Assert
      expect(falha).toBeInstanceOf(ImageStorageDefectError);
      expect(falha).not.toBeInstanceOf(AppError);
      expect(falha).toBeInstanceOf(Error);
      expect((falha instanceof Error ? falha.name : '')).toBe('ImageStorageDefectError');
    });

    it('é `instanceof TypeError`, e é isso que o impede de virar um 415 silencioso', async () => {
      // Arrange — `upload-animal-images.middleware.ts` separa "corpo hostil" de
      // "defeito de programação nosso" filtrando por QUATRO construtores nativos
      // (`DEFEITOS_DE_PROGRAMACAO`); tudo o que fica de fora dessa lista ele traduz
      // para 415 `UNSUPPORTED_MEDIA_TYPE`. Um defeito deste adaptador sinalizado
      // com `new Error(...)` cru seria, portanto, escondido atrás de um 415 que
      // ainda culparia o arquivo enviado pelo administrador.
      //
      // Esta é a asserção que trava esse buraco. Se alguém reescrever
      // `ImageStorageDefectError extends Error`, ela quebra — e é para quebrar.
      const DEFEITOS_DE_PROGRAMACAO = [TypeError, RangeError, ReferenceError, SyntaxError];

      const { balde, armazenamento } = montarCenario();
      balde.upload.mockResolvedValue(RESPOSTA_SEM_DATA_E_SEM_ERRO);

      // Act
      const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

      // Assert
      expect(falha).toBeInstanceOf(TypeError);
      expect(DEFEITOS_DE_PROGRAMACAO.some((tipo) => falha instanceof tipo)).toBe(true);
    });

    it('a falha do fornecedor NÃO é confundida com defeito nosso', async () => {
      // Arrange — o outro lado da mesma linha: 503 não pode virar 500.
      silenciarLog();
      const { balde, armazenamento } = montarCenario();
      balde.upload.mockResolvedValue({ data: null, error: ERRO_DO_FORNECEDOR });

      // Act
      const falha: unknown = await armazenamento.upload(ENTRADA).catch((motivo: unknown) => motivo);

      // Assert
      expect(falha).not.toBeInstanceOf(ImageStorageDefectError);
      expect(falha).not.toBeInstanceOf(TypeError);
    });
  });
});

describe('SupabaseImageStorage.remove', () => {
  it('apaga a lista inteira em UMA chamada', async () => {
    // Arrange — uma remoção por chamada multiplicaria idas à rede justamente no
    // caminho de compensação (RN-39, RN-40).
    const { balde, armazenamento } = montarCenario();
    balde.remove.mockResolvedValue({ data: [], error: null });
    const caminhos = [CAMINHO, 'animals/a/b.png', 'animals/a/c.png'];

    // Act
    await armazenamento.remove(caminhos);

    // Assert
    expect(balde.remove).toHaveBeenCalledTimes(1);
    expect(balde.remove).toHaveBeenCalledWith(caminhos);
  });

  it('lista vazia não vira requisição', async () => {
    // Arrange — "nada subiu" é caso corriqueiro do caminho de compensação.
    const { cliente, balde, armazenamento } = montarCenario();

    // Act
    await armazenamento.remove([]);

    // Assert
    expect(balde.remove).not.toHaveBeenCalled();
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it('RN-40 — falha na remoção REJEITA normalmente, sem compensar por conta própria', async () => {
    // Arrange — quem decide não reverter é o service; a porta apenas informa.
    silenciarLog();
    const { balde, armazenamento } = montarCenario();
    balde.remove.mockResolvedValue({ data: null, error: ERRO_DO_FORNECEDOR });

    // Act
    const falha: unknown = await armazenamento.remove([CAMINHO]).catch((motivo: unknown) => motivo);

    // Assert
    expect(falha).toBeInstanceOf(ImageStorageUnavailableError);
    expect(comoAppError(falha).code).toBe('IMAGE_STORAGE_UNAVAILABLE');
  });

  it('não altera a lista recebida', async () => {
    // Arrange — o cliente pede `string[]` mutável e a porta declara `ReadonlyArray`.
    const { balde, armazenamento } = montarCenario();
    balde.remove.mockResolvedValue({ data: [], error: null });
    const caminhos: ReadonlyArray<string> = [CAMINHO];

    // Act
    await armazenamento.remove(caminhos);

    // Assert
    expect(caminhos).toEqual([CAMINHO]);
    expect(balde.remove.mock.calls[0]?.[0]).not.toBe(caminhos);
  });
});

describe('SupabaseImageStorage — contrato de configuração', () => {
  it('usa o balde de `env` quando nenhum é informado, sem ler `process.env`', async () => {
    // Arrange — `src/config/env.ts` continua sendo o único ponto que lê o ambiente.
    const cliente = mockDeep<StorageClient>();
    const balde = mockDeep<BaldeDeArmazenamento>();
    cliente.from.mockReturnValue(balde);
    balde.getPublicUrl.mockReturnValue({ data: { publicUrl: URL_PUBLICA } });
    balde.upload.mockResolvedValue(respostaDeUploadBemSucedido());

    // Act
    await new SupabaseImageStorage(cliente).upload(ENTRADA);

    // Assert — o valor vem de `tests/setup.ts`, não de credencial real.
    expect(cliente.from).toHaveBeenCalledWith('animal-images');
  });
});

describe('createSupabaseStorageClient', () => {
  /**
   * A fábrica NÃO abre socket: `createClient` só monta o cliente, exatamente como
   * `createTransport` do nodemailer. A conexão nasceria na primeira chamada — e a
   * única chamada feita aqui é contra um `fetch` espionado, que nunca sai da
   * máquina.
   */
  it('monta o cliente a partir de `env`, sem ler `process.env` e sem abrir socket', () => {
    // Act
    const cliente = createSupabaseStorageClient();

    // Assert
    expect(cliente).toBeInstanceOf(StorageClient);
    expect(typeof cliente.from).toBe('function');
  });

  it('aplica `AbortSignal.timeout` em CADA chamada ao armazenamento', async () => {
    // Arrange — `FileOptions` do `storage-js` não tem campo `signal`, então o
    // único enxerto real do tempo limite é o `fetch` do cliente. Sem ele, uma
    // requisição pendurada segura a transação do banco até o socket morrer
    // sozinho, o que pode não acontecer nunca (RNF-13).
    const espiao = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));

    const cliente = createSupabaseStorageClient();

    // Act — a rejeição é esperada; o que importa é o que chegou ao `fetch`.
    await cliente
      .from('animal-images')
      .upload('animals/a/b.jpg', Buffer.from([0xff]))
      .catch(() => undefined);

    // Assert
    expect(espiao).toHaveBeenCalled();

    const opcoes = espiao.mock.calls[0]?.[1];
    expect(opcoes?.signal).toBeInstanceOf(AbortSignal);
    expect(opcoes?.signal?.aborted).toBe(false);
  });
});
