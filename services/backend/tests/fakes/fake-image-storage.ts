import { ImageStorageUnavailableError } from '~/domains/animals/errors/animal-image.errors';
import type { ImageStoragePort, StoredImageInput } from '~/infra/storage/image-storage.port';

import { comoPromessa } from './restauravel';

/**
 * Dublê da porta de armazenamento de objetos. Guarda os objetos em memória em vez
 * de falar com o Supabase — é o que permite exercitar os casos de uso de animal
 * sem credencial real, sem rede e sem balde de verdade, mantendo as asserções que
 * importam (o que subiu, com que caminho, com que tipo, e o que sobrou depois de
 * uma falha).
 *
 * Implementa `ImageStoragePort` de verdade: se a interface mudar, isto quebra na
 * compilação, e não em silêncio na execução.
 *
 * Falha SEMPRE com `ImageStorageUnavailableError`, que é exatamente o que o
 * `SupabaseImageStorage` lança. Um dublê que rejeitasse com `Error` cru deixaria a
 * suíte passar sobre um contrato que a implementação real não cumpre.
 */
export class FakeImageStorage implements ImageStoragePort {
  private readonly objetos = new Map<string, StoredImageInput>();

  /**
   * Base fictícia da URL pública. É `https://` de propósito: a asserção "a URL
   * gravada é a pública do objeto" deve enxergar algo com a mesma forma da real.
   */
  private readonly basePublica = 'https://armazenamento-de-teste.local/animal-images';

  /** Contador de chamadas de `upload`, base do gatilho por enésima chamada. */
  private envios = 0;

  /**
   * Número da chamada de `upload` que deve falhar, ou `null` para nenhuma.
   *
   * É este gatilho que torna o CT-55 EXECUTÁVEL: falhar ao gravar a terceira de
   * cinco imagens e verificar que nada sobra no armazenamento e que nada foi
   * gravado no banco. Sem ele, só seria possível testar "falha na primeira", que
   * não exercita a compensação dos objetos que já subiram.
   */
  private envioQueFalha: number | null = null;

  private removeFalha = false;

  get storedPaths(): ReadonlyArray<string> {
    return [...this.objetos.keys()];
  }

  get storedObjects(): ReadonlyArray<StoredImageInput> {
    return [...this.objetos.values()];
  }

  get uploadCount(): number {
    return this.envios;
  }

  objetoEm(objectPath: string): StoredImageInput | undefined {
    return this.objetos.get(objectPath);
  }

  /** `n` é 1 para a primeira chamada. */
  failUploadOnNthCall(n: number): void {
    this.envioQueFalha = n;
  }

  failRemove(): void {
    this.removeFalha = true;
  }

  limpar(): void {
    this.objetos.clear();
    this.envios = 0;
    this.envioQueFalha = null;
    this.removeFalha = false;
  }

  /**
   * A falha sai como REJEIÇÃO da promessa, e não como exceção síncrona: é o que o
   * adaptador real faz, e é a forma que o `try/catch` dos casos de uso espera.
   */
  upload(input: StoredImageInput): Promise<{ readonly publicUrl: string }> {
    return comoPromessa(() => {
      this.envios += 1;

      if (this.envios === this.envioQueFalha) {
        throw new ImageStorageUnavailableError();
      }

      /**
       * Reproduz o `upsert: false` do adaptador real: caminho repetido é defeito,
       * não sobrescrita silenciosa. Um dublê que aceitasse a repetição esconderia
       * um gerador de caminho quebrado.
       */
      if (this.objetos.has(input.objectPath)) {
        throw new ImageStorageUnavailableError();
      }

      this.objetos.set(input.objectPath, input);

      return { publicUrl: `${this.basePublica}/${input.objectPath}` };
    });
  }

  remove(objectPaths: ReadonlyArray<string>): Promise<void> {
    return comoPromessa(() => {
      if (this.removeFalha) {
        throw new ImageStorageUnavailableError();
      }

      for (const caminho of objectPaths) {
        this.objetos.delete(caminho);
      }
    });
  }
}
