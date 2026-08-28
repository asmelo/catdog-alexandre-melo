import {
  ANIMAL_SEX_LABELS,
  ANIMAL_SIZE_LABELS,
  ANIMAL_STATUS_LABELS,
} from '~/domains/animals/animal-labels';
import type { AnimalSex, AnimalSize, AnimalStatus } from '~/domains/animals/animal.types';

/**
 * Os rotulos sao contrato de interface: e o `medio → "Médio"` que separa o
 * vocabulario que trafega do que o administrador le. Um rotulo errado nao quebra
 * nada — apenas exibe a palavra errada para sempre.
 */

describe('rótulos de animal', () => {
  it('traduz cada porte do contrato para o rótulo acentuado', () => {
    const portes: ReadonlyArray<AnimalSize> = ['pequeno', 'medio', 'grande'];

    expect(portes.map((porte) => ANIMAL_SIZE_LABELS[porte])).toEqual([
      'Pequeno',
      'Médio',
      'Grande',
    ]);
  });

  it('traduz cada sexo do contrato para o rótulo acentuado', () => {
    const sexos: ReadonlyArray<AnimalSex> = ['macho', 'femea'];

    expect(sexos.map((sexo) => ANIMAL_SEX_LABELS[sexo])).toEqual(['Macho', 'Fêmea']);
  });

  it('traduz cada situação do contrato para o rótulo acentuado', () => {
    const situacoes: ReadonlyArray<AnimalStatus> = [
      'disponivel',
      'reservado',
      'adotado',
      'indisponivel',
    ];

    expect(situacoes.map((situacao) => ANIMAL_STATUS_LABELS[situacao])).toEqual([
      'Disponível',
      'Reservado',
      'Adotado',
      'Indisponível',
    ]);
  });

  it('os três mapas cobrem o conjunto fechado inteiro, sem chave sobrando', () => {
    // A cobertura em falta é pega pelo COMPILADOR (os mapas são
    // `Record<União, string>`). O que este caso pega é o oposto: uma chave a mais,
    // sobrevivente de um valor removido do contrato, que o tipo aceitaria em
    // silêncio se o `Record` fosse parcial.
    expect(Object.keys(ANIMAL_SIZE_LABELS)).toHaveLength(3);
    expect(Object.keys(ANIMAL_SEX_LABELS)).toHaveLength(2);
    expect(Object.keys(ANIMAL_STATUS_LABELS)).toHaveLength(4);
  });
});
