import {
  AnimalSex,
  AnimalSize,
  AnimalStatus,
  type Animal,
  type AnimalImage,
  type Prisma,
} from '@prisma/client';

import type {
  AnimalPage,
  AnimalPageRequest,
  AnimalRepository,
  AnimalWithRelations,
  CreateAnimalData,
  CreateAnimalImageData,
  UpdateAnimalData,
} from '~/domains/animals/repositories/animal.repository';
import { normalizeForSearch } from '~/utils/text-normalizer';

import type { ArmazemDeEspecies } from './in-memory-species.repository';
import type { ArmazemDeGeografia } from './in-memory-geography.repository';
import { comoPromessa, proximoUuid, type Restauravel } from './restauravel';

/**
 * Armazem em memoria de `animals` e `animal_images` (TASK-BACKEND-011).
 *
 * TRES comportamentos precisam ser reproduzidos fielmente, senao os testes passam
 * e a producao quebra:
 *
 *   1. `atualizarSeInalterado` devolve `0` quando o `updatedAt` esperado nao bate.
 *      E o que sustenta o bloqueio otimista da RN-52; um armazem que ignorasse a
 *      marca faria o CT-66 passar sem que o `where` do `updateMany` existisse.
 *   2. A ordenacao da listagem aplica os TRES criterios (`nameNormalized` asc,
 *      `createdAt` desc, `id` asc). Ordenar so por nome faria o CT-26 passar por
 *      acidente e a paginacao continuar nao deterministica em producao.
 *   3. `remover` apaga em cascata as imagens do animal, como faz o
 *      `onDelete: Cascade` da chave estrangeira.
 *
 * Um QUARTO comportamento e reproduzido pelo mesmo motivo: `@updatedAt` avanca o
 * relogio da linha a cada gravacao. Sem isso a segunda gravacao com a marca
 * ANTIGA passaria, e o conflito do CT-66 nunca apareceria.
 */

export const INSTANTE_DE_CRIACAO_DO_ANIMAL = new Date('2026-02-01T12:00:00.000Z');
export const INSTANTE_DE_ATUALIZACAO_DO_ANIMAL = new Date('2026-02-02T12:00:00.000Z');

export interface DadosDeAnimalDeTeste {
  readonly id?: string;
  readonly name?: string;
  readonly nameNormalized?: string;
  readonly nameSearch?: string;
  readonly speciesId: string;
  readonly cityId: string;
  readonly size?: AnimalSize;
  readonly sex?: AnimalSex;
  readonly status?: AnimalStatus;
  readonly birthDate?: Date | null;
  readonly description?: string | null;
  readonly acceptsOtherAnimals?: boolean;
  readonly needsLargeSpace?: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface DadosDeImagemDeTeste {
  readonly id?: string;
  readonly animalId: string;
  readonly storagePath?: string;
  readonly position?: number;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly createdAt?: Date;
}

const TAMANHO_PADRAO_DA_IMAGEM = 1024;

export function montarAnimal(dados: DadosDeAnimalDeTeste): Animal {
  const name = dados.name ?? 'Theo';

  return {
    id: dados.id ?? proximoUuid(),
    name,
    nameNormalized: dados.nameNormalized ?? name.toLowerCase(),
    /**
     * Derivado pela FUNCAO DE PRODUCAO, e nao por uma normalizacao escrita a mao
     * aqui: uma copia da regra no dublê passaria a divergir dela na primeira
     * revisao, e a busca da vitrine seria testada contra a regra errada.
     */
    nameSearch: dados.nameSearch ?? normalizeForSearch(name),
    speciesId: dados.speciesId,
    cityId: dados.cityId,
    size: dados.size ?? AnimalSize.MEDIO,
    sex: dados.sex ?? AnimalSex.MACHO,
    status: dados.status ?? AnimalStatus.DISPONIVEL,
    birthDate: dados.birthDate ?? null,
    description: dados.description ?? null,
    acceptsOtherAnimals: dados.acceptsOtherAnimals ?? false,
    needsLargeSpace: dados.needsLargeSpace ?? false,
    createdAt: dados.createdAt ?? INSTANTE_DE_CRIACAO_DO_ANIMAL,
    updatedAt: dados.updatedAt ?? INSTANTE_DE_ATUALIZACAO_DO_ANIMAL,
  };
}

export function montarImagem(dados: DadosDeImagemDeTeste): AnimalImage {
  const id = dados.id ?? proximoUuid();

  return {
    id,
    animalId: dados.animalId,
    storagePath: dados.storagePath ?? `animals/${dados.animalId}/${id}.jpg`,
    position: dados.position ?? 0,
    contentType: dados.contentType ?? 'image/jpeg',
    sizeBytes: dados.sizeBytes ?? TAMANHO_PADRAO_DA_IMAGEM,
    createdAt: dados.createdAt ?? INSTANTE_DE_CRIACAO_DO_ANIMAL,
  };
}

/**
 * Erro de FK ausente. Nao e o `PrismaClientKnownRequestError` de verdade porque o
 * servico NUNCA deve chegar aqui: ele verifica especie e cidade antes. Se este
 * erro aparecer numa suite, o que ele denuncia e a verificacao que faltou.
 */
function vinculoInexistente(entidade: string, id: string): Error {
  return new Error(
    `Armazem de animais: ${entidade} ${id} nao existe. ` +
      'O service deveria ter recusado antes de gravar.',
  );
}

/** Ordem completa da listagem: nome, depois criacao mais recente, depois id. */
function porNomeCriacaoEId(um: Animal, outro: Animal): number {
  if (um.nameNormalized !== outro.nameNormalized) {
    return um.nameNormalized < outro.nameNormalized ? -1 : 1;
  }

  if (um.createdAt.getTime() !== outro.createdAt.getTime()) {
    return outro.createdAt.getTime() - um.createdAt.getTime();
  }

  return um.id < outro.id ? -1 : 1;
}

function porPosicao(uma: AnimalImage, outra: AnimalImage): number {
  return uma.position - outra.position;
}

export class ArmazemDeAnimais implements Restauravel {
  constructor(
    private readonly especies: ArmazemDeEspecies,
    private readonly geografia: ArmazemDeGeografia,
  ) {}

  private animais: Animal[] = [];

  private imagens: AnimalImage[] = [];

  /**
   * Relogio da coluna `@updatedAt`. Avanca UM milissegundo por gravacao em vez de
   * ler o relogio real: duas gravacoes no mesmo milissegundo produziriam a mesma
   * marca, e o conflito otimista deixaria de ser observavel de forma determinista.
   */
  private ultimaMarca = INSTANTE_DE_ATUALIZACAO_DO_ANIMAL.getTime();

  get linhas(): ReadonlyArray<Animal> {
    return this.animais;
  }

  get linhasDeImagem(): ReadonlyArray<AnimalImage> {
    return this.imagens;
  }

  limpar(): void {
    this.animais = [];
    this.imagens = [];
    this.ultimaMarca = INSTANTE_DE_ATUALIZACAO_DO_ANIMAL.getTime();
  }

  private proximaMarca(): Date {
    this.ultimaMarca += 1;

    return new Date(this.ultimaMarca);
  }

  semear(dados: DadosDeAnimalDeTeste): AnimalWithRelations {
    const animal = montarAnimal(dados);

    this.animais.push(animal);

    return this.comRelacoes(animal);
  }

  semearImagem(dados: DadosDeImagemDeTeste): AnimalImage {
    const imagem = montarImagem(dados);

    this.imagens.push(imagem);

    return imagem;
  }

  imagensDe(animalId: string): ReadonlyArray<AnimalImage> {
    return this.imagens
      .filter((imagem) => imagem.animalId === animalId)
      .sort(porPosicao);
  }

  private comRelacoes(animal: Animal): AnimalWithRelations {
    const especie = this.especies.buscarPorId(animal.speciesId);

    if (especie === null) {
      throw vinculoInexistente('a especie', animal.speciesId);
    }

    const cidade = this.geografia.buscarCidadePorId(animal.cityId);

    if (cidade === null) {
      throw vinculoInexistente('a cidade', animal.cityId);
    }

    const estado = this.geografia.buscarEstadoPorId(cidade.stateId);

    if (estado === null) {
      throw vinculoInexistente('o estado da cidade', cidade.stateId);
    }

    return {
      ...animal,
      species: especie,
      city: { ...cidade, state: estado },
      images: [...this.imagensDe(animal.id)],
    };
  }

  listarPaginado(pagina: AnimalPageRequest): AnimalPage {
    const ordenados = [...this.animais].sort(porNomeCriacaoEId);

    return {
      items: ordenados
        .slice(pagina.skip, pagina.skip + pagina.take)
        .map((animal) => this.comRelacoes(animal)),
      total: this.animais.length,
    };
  }

  buscarPorId(id: string): AnimalWithRelations | null {
    const animal = this.animais.find((candidato) => candidato.id === id);

    return animal === undefined ? null : this.comRelacoes(animal);
  }

  criar(dados: CreateAnimalData): AnimalWithRelations {
    const instante = this.proximaMarca();

    const animal = montarAnimal({
      ...dados,
      status: AnimalStatus.DISPONIVEL,
      createdAt: instante,
      updatedAt: instante,
    });

    this.animais.push(animal);

    return this.comRelacoes(animal);
  }

  criarImagens(
    animalId: string,
    imagens: ReadonlyArray<CreateAnimalImageData>,
  ): ReadonlyArray<AnimalImage> {
    return imagens.map((imagem) =>
      this.semearImagem({
        id: imagem.id,
        animalId,
        storagePath: imagem.storagePath,
        position: imagem.position,
        contentType: imagem.contentType,
        sizeBytes: imagem.sizeBytes,
      }),
    );
  }

  private gravarSeInalterado(
    id: string,
    esperado: Date,
    alterar: (atual: Animal) => Animal,
  ): number {
    const atual = this.animais.find((candidato) => candidato.id === id);

    if (atual === undefined || atual.updatedAt.getTime() !== esperado.getTime()) {
      return 0;
    }

    const alterado: Animal = { ...alterar(atual), updatedAt: this.proximaMarca() };

    this.animais = this.animais.map((animal) => (animal.id === id ? alterado : animal));

    return 1;
  }

  atualizarSeInalterado(id: string, esperado: Date, dados: UpdateAnimalData): number {
    return this.gravarSeInalterado(id, esperado, (atual) => ({ ...atual, ...dados }));
  }

  atualizarStatusSeInalterado(id: string, esperado: Date, status: AnimalStatus): number {
    return this.gravarSeInalterado(id, esperado, (atual) => ({ ...atual, status }));
  }

  removerPorId(id: string): number {
    if (!this.animais.some((animal) => animal.id === id)) {
      return 0;
    }

    this.animais = this.animais.filter((animal) => animal.id !== id);
    // Cascata da chave estrangeira: a imagem nao existe fora do animal (RN-45).
    this.imagens = this.imagens.filter((imagem) => imagem.animalId !== id);

    return 1;
  }

  removerImagensPorIds(ids: ReadonlyArray<string>): number {
    const alvos = new Set(ids);
    const antes = this.imagens.length;

    this.imagens = this.imagens.filter((imagem) => !alvos.has(imagem.id));

    return antes - this.imagens.length;
  }

  atualizarPosicaoDaImagem(id: string, position: number): void {
    this.imagens = this.imagens.map((imagem) =>
      imagem.id === id ? { ...imagem, position } : imagem,
    );
  }

  capturarEstado(): () => void {
    const animais = [...this.animais];
    const imagens = [...this.imagens];

    return () => {
      this.animais = animais;
      this.imagens = imagens;
    };
  }
}

export class InMemoryAnimalRepository implements AnimalRepository {
  constructor(private readonly armazem: ArmazemDeAnimais) {}

  listPaginated(pagina: AnimalPageRequest): Promise<AnimalPage> {
    return comoPromessa(() => this.armazem.listarPaginado(pagina));
  }

  findById(id: string): Promise<AnimalWithRelations | null> {
    return comoPromessa(() => this.armazem.buscarPorId(id));
  }

  create(data: CreateAnimalData): Promise<AnimalWithRelations> {
    return comoPromessa(() => this.armazem.criar(data));
  }

  createImages(
    animalId: string,
    images: ReadonlyArray<CreateAnimalImageData>,
  ): Promise<ReadonlyArray<AnimalImage>> {
    return comoPromessa(() => this.armazem.criarImagens(animalId, images));
  }

  updateIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: UpdateAnimalData,
  ): Promise<number> {
    return comoPromessa(() =>
      this.armazem.atualizarSeInalterado(id, expectedUpdatedAt, data),
    );
  }

  updateStatusIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    status: AnimalStatus,
  ): Promise<number> {
    return comoPromessa(() =>
      this.armazem.atualizarStatusSeInalterado(id, expectedUpdatedAt, status),
    );
  }

  deleteById(id: string): Promise<number> {
    return comoPromessa(() => this.armazem.removerPorId(id));
  }

  deleteImagesByIds(ids: ReadonlyArray<string>): Promise<number> {
    return comoPromessa(() => this.armazem.removerImagensPorIds(ids));
  }

  updateImagePosition(id: string, position: number): Promise<void> {
    return comoPromessa(() => {
      this.armazem.atualizarPosicaoDaImagem(id, position);
    });
  }

  withTransaction(_executor: Prisma.TransactionClient): AnimalRepository {
    return this;
  }
}
