import { AnimalStatus } from '@prisma/client';

import {
  AnimalNotFoundError,
  AnimalStaleUpdateError,
} from '~/domains/animals/errors/animal.errors';
import type { PublicAnimalStatus } from '~/domains/animals/mappers/animal.mapper';
import { STATUS_PERSISTIDO } from '~/domains/animals/services/change-animal-status.service';

import {
  montarBancada,
  UUID_INEXISTENTE,
  type BancadaDeAnimais,
} from '../../../../tests/fakes/bancada-de-animais';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-07 — alteracao de status (CT-69 a CT-73).
 *
 * A spec adota TRANSICOES LIVRES por ora (Decisao 6 da ALT-001): as doze
 * transicoes entre os quatro status sao validas, inclusive ir de Disponivel
 * direto para Adotado. A recomendacao de restringi-las esta registrada como
 * pendencia do modulo de pedidos, que ainda nao existe — e enquanto nao existir,
 * travar obrigaria o administrador a encenar uma reserva para registrar uma
 * adocao real.
 *
 * Por isso as doze estao aqui uma a uma, como `it.each`: e a lista completa que
 * documenta a decisao e que denunciaria uma restricao introduzida sem discussao.
 */

const STATUS_PUBLICOS: ReadonlyArray<PublicAnimalStatus> = [
  'disponivel',
  'reservado',
  'adotado',
  'indisponivel',
];

interface Transicao {
  readonly de: PublicAnimalStatus;
  readonly para: PublicAnimalStatus;
}

const TRANSICOES: ReadonlyArray<Transicao> = STATUS_PUBLICOS.flatMap((de) =>
  STATUS_PUBLICOS.filter((para) => para !== de).map((para) => ({ de, para })),
);

let bancada: BancadaDeAnimais;

beforeEach(() => {
  reiniciarSequenciaDeUuid();
  bancada = montarBancada();
});

function semearAnimal(status: AnimalStatus = AnimalStatus.DISPONIVEL): {
  readonly id: string;
  readonly updatedAt: Date;
} {
  const animal = bancada.animais.semear({
    name: 'Theo',
    speciesId: bancada.especie.id,
    cityId: bancada.cidade.id,
    status,
  });

  return { id: animal.id, updatedAt: animal.updatedAt };
}

describe('ChangeAnimalStatusService', () => {
  it('CT-70: as doze transicoes entre os quatro status sao todas aceitas (RN-15)', () => {
    // Arrange & Act & Assert — a propria lista e a asserção: quatro status
    // combinados dois a dois, sem repeticao, dao exatamente doze pares.
    expect(TRANSICOES).toHaveLength(12);
  });

  it.each(TRANSICOES)(
    'CT-70: a transicao de $de para $para e aceita',
    async ({ de, para }: Transicao) => {
      // Arrange
      const animal = semearAnimal(STATUS_PERSISTIDO[de]);

      // Act
      const atualizado = await bancada.changeAnimalStatus.execute({
        id: animal.id,
        expectedUpdatedAt: animal.updatedAt,
        status: para,
      });

      // Assert
      expect(atualizado.status).toBe(para);
      expect(bancada.animais.linhas[0]?.status).toBe(STATUS_PERSISTIDO[para]);
    },
  );

  it('CT-69: alterar o status nao altera NENHUM outro dado do animal', async () => {
    // Arrange — e a razao de o endpoint ser separado do `PATCH` generico: aqui o
    // conjunto de campos e disjunto do restante do animal.
    const animal = bancada.animais.semear({
      name: 'Theo',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
      description: 'Muito docil.',
      acceptsOtherAnimals: true,
    });
    const imagem = bancada.animais.semearImagem({ animalId: animal.id });

    // Act
    const atualizado = await bancada.changeAnimalStatus.execute({
      id: animal.id,
      expectedUpdatedAt: animal.updatedAt,
      status: 'adotado',
    });

    // Assert
    expect(atualizado.status).toBe('adotado');
    expect(atualizado.name).toBe('Theo');
    expect(atualizado.description).toBe('Muito docil.');
    expect(atualizado.acceptsOtherAnimals).toBe(true);
    expect(atualizado.images.map((registro) => registro.id)).toEqual([imagem.id]);
  });

  it('CT-71: reenviar o status ja vigente responde 200 sem efeito colateral', async () => {
    // Arrange — a interface nao envia a requisicao neste caso, mas a API precisa
    // aceita-la: quem chama direto nao pode receber erro por gravar o mesmo valor.
    const animal = semearAnimal(AnimalStatus.RESERVADO);

    // Act
    const atualizado = await bancada.changeAnimalStatus.execute({
      id: animal.id,
      expectedUpdatedAt: animal.updatedAt,
      status: 'reservado',
    });

    // Assert
    expect(atualizado.status).toBe('reservado');
    expect(bancada.animais.linhas).toHaveLength(1);
  });

  it('CT-73: alterar o status de animal ja excluido responde 404 ANIMAL_NOT_FOUND', async () => {
    // Arrange & Act
    const recusa = bancada.changeAnimalStatus.execute({
      id: UUID_INEXISTENTE,
      expectedUpdatedAt: new Date('2026-02-02T12:00:00.000Z'),
      status: 'adotado',
    });

    // Assert — 404 e nao 409: nao ha conflito com ninguem, a linha sumiu.
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 404,
      code: 'ANIMAL_NOT_FOUND',
      message: 'Animal não encontrado.',
    });
  });

  it('CT-67: marca de alteracao antiga responde 409 ANIMAL_STALE_UPDATE', async () => {
    // Arrange — o mesmo animal alterado em outra aba entre a leitura e o envio.
    const animal = semearAnimal();

    await bancada.changeAnimalStatus.execute({
      id: animal.id,
      expectedUpdatedAt: animal.updatedAt,
      status: 'reservado',
    });

    // Act
    const recusa = bancada.changeAnimalStatus.execute({
      id: animal.id,
      expectedUpdatedAt: animal.updatedAt,
      status: 'adotado',
    });

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalStaleUpdateError);
    await expect(recusa).rejects.toMatchObject({
      statusCode: 409,
      code: 'ANIMAL_STALE_UPDATE',
      message: 'Este animal foi alterado por outra pessoa. Recarregue e refaça a alteração.',
    });
    // O valor gravado pela primeira alteracao permanece.
    expect(bancada.animais.linhas[0]?.status).toBe(AnimalStatus.RESERVADO);
  });

  it('CT-73: animal excluido ENTRE a gravacao e a releitura responde 404', async () => {
    // Arrange — a corrida rara: o `updateMany` alterou uma linha e ela sumiu antes
    // do `findById`. O ramo existe para que a resposta nao seja um 500.
    const animal = semearAnimal();

    jest
      .spyOn(bancada.repositorioDeAnimais, 'findById')
      .mockResolvedValueOnce(null);

    // Act
    const recusa = bancada.changeAnimalStatus.execute({
      id: animal.id,
      expectedUpdatedAt: animal.updatedAt,
      status: 'adotado',
    });

    // Assert
    await expect(recusa).rejects.toBeInstanceOf(AnimalNotFoundError);
  });
});
