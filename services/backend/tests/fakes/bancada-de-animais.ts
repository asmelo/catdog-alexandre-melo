import type { City, PrismaClient, Species, State } from '@prisma/client';
import type { DeepMockProxy } from 'jest-mock-extended';

import { ChangeAnimalStatusService } from '~/domains/animals/services/change-animal-status.service';
import {
  CreateAnimalService,
  type CreateAnimalInput,
} from '~/domains/animals/services/create-animal.service';
import { DeleteAnimalService } from '~/domains/animals/services/delete-animal.service';
import { GetAnimalService } from '~/domains/animals/services/get-animal.service';
import { ListAnimalsService } from '~/domains/animals/services/list-animals.service';
import { StoreAnimalImagesService } from '~/domains/animals/services/store-animal-images.service';
import {
  UpdateAnimalService,
  type UpdateAnimalInput,
} from '~/domains/animals/services/update-animal.service';

import { FakeImageStorage } from './fake-image-storage';
import {
  ArmazemDeAnimais,
  InMemoryAnimalRepository,
} from './in-memory-animal.repository';
import {
  ArmazemDeGeografia,
  InMemoryStateRepository,
} from './in-memory-geography.repository';
import {
  ArmazemDeEspecies,
  InMemorySpeciesRepository,
} from './in-memory-species.repository';
import { criarPrismaComTransacao } from './prisma-double';

/**
 * Bancada dos specs de animal (TASK-BACKEND-011).
 *
 * Monta de uma vez o grafo que TODOS os services de animal precisam — tres
 * armazens em memoria, o armazenamento falso e um cliente Prisma cujo
 * `$transaction` desfaz os armazens quando a callback lanca. Existe para que cada
 * spec comece pelo caso que ele testa, e nao por trinta linhas de montagem
 * repetidas cinco vezes.
 *
 * A semente padrao e a da captura de tela usada como fonte da verdade: um
 * cachorro em Boa Esperanca - ES.
 */

export const ESPECIE_PADRAO = 'Cachorro';
export const UF_PADRAO = 'ES';
export const CIDADE_PADRAO = 'Boa Esperanca';

/** UUID bem formado que nao corresponde a registro nenhum. */
export const UUID_INEXISTENTE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

export interface BancadaDeAnimais {
  readonly especies: ArmazemDeEspecies;
  readonly geografia: ArmazemDeGeografia;
  readonly animais: ArmazemDeAnimais;
  readonly armazenamento: FakeImageStorage;
  readonly prisma: DeepMockProxy<PrismaClient>;
  readonly repositorioDeAnimais: InMemoryAnimalRepository;
  readonly imagens: StoreAnimalImagesService;
  readonly especie: Species;
  readonly estado: State;
  readonly cidade: City;
  readonly createAnimal: CreateAnimalService;
  readonly updateAnimal: UpdateAnimalService;
  readonly changeAnimalStatus: ChangeAnimalStatusService;
  readonly deleteAnimal: DeleteAnimalService;
  readonly listAnimals: ListAnimalsService;
  readonly getAnimal: GetAnimalService;
}

export function montarBancada(): BancadaDeAnimais {
  const especies = new ArmazemDeEspecies();
  const geografia = new ArmazemDeGeografia();
  const animais = new ArmazemDeAnimais(especies, geografia);
  const armazenamento = new FakeImageStorage();

  const prisma = criarPrismaComTransacao(especies, geografia, animais);

  const repositorioDeAnimais = new InMemoryAnimalRepository(animais);
  const repositorioDeEspecies = new InMemorySpeciesRepository(especies);
  const repositorioDeGeografia = new InMemoryStateRepository(geografia);
  const imagens = new StoreAnimalImagesService(armazenamento);

  const especie = especies.semear({ name: ESPECIE_PADRAO });
  const estado = geografia.semearEstado({ uf: UF_PADRAO, name: 'Espirito Santo' });
  const cidade = geografia.semearCidade({ stateId: estado.id, name: CIDADE_PADRAO });

  return {
    especies,
    geografia,
    animais,
    armazenamento,
    prisma,
    repositorioDeAnimais,
    imagens,
    especie,
    estado,
    cidade,
    createAnimal: new CreateAnimalService(
      repositorioDeAnimais,
      repositorioDeEspecies,
      repositorioDeGeografia,
      imagens,
      prisma,
    ),
    updateAnimal: new UpdateAnimalService(
      repositorioDeAnimais,
      repositorioDeEspecies,
      repositorioDeGeografia,
      imagens,
      prisma,
    ),
    changeAnimalStatus: new ChangeAnimalStatusService(repositorioDeAnimais),
    deleteAnimal: new DeleteAnimalService(repositorioDeAnimais, imagens),
    listAnimals: new ListAnimalsService(repositorioDeAnimais),
    getAnimal: new GetAnimalService(repositorioDeAnimais),
  };
}

/** Entrada minima e valida do cadastro, com os obrigatorios da bancada. */
export function entradaDeCadastro(
  bancada: BancadaDeAnimais,
  ajustes: Partial<CreateAnimalInput> = {},
): CreateAnimalInput {
  return {
    name: 'Theo',
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
    size: 'grande',
    sex: 'macho',
    birthDate: null,
    description: null,
    acceptsOtherAnimals: false,
    needsLargeSpace: false,
    images: [],
    ...ajustes,
  };
}

/** Entrada minima e valida da edicao, apontando para um animal ja gravado. */
export function entradaDeEdicao(
  bancada: BancadaDeAnimais,
  id: string,
  expectedUpdatedAt: Date,
  ajustes: Partial<UpdateAnimalInput> = {},
): UpdateAnimalInput {
  return {
    id,
    expectedUpdatedAt,
    name: 'Theo',
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
    size: 'grande',
    sex: 'macho',
    birthDate: null,
    description: null,
    acceptsOtherAnimals: false,
    needsLargeSpace: false,
    keepImageIds: [],
    images: [],
    ...ajustes,
  };
}
