import type { AnimalSex, AnimalSize, AnimalStatus } from '~/domains/animals/animal.types';

/**
 * Traducao do vocabulario do CONTRATO para o rotulo exibido.
 *
 * O contrato trafega em minusculas e sem acento (`'medio'`, `'femea'`,
 * `'disponivel'`); a tela mostra "Médio", "Fêmea", "Disponível". A acentuacao e
 * responsabilidade da interface, e este arquivo e o unico lugar em que ela
 * acontece — espalhar `size === 'medio' ? 'Médio' : ...` pelas telas produziria
 * grafias divergentes na primeira tela nova.
 *
 * TIPADOS COMO `Record<Uniao, string>`, e nao inferidos do literal: e o que faz
 * acrescentar um valor ao contrato SEM acrescentar o rotulo quebrar a
 * COMPILACAO. Com o tipo inferido, o valor novo apareceria como `undefined` na
 * tabela e ninguem saberia por que.
 */

export const ANIMAL_SIZE_LABELS: Readonly<Record<AnimalSize, string>> = {
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
};

export const ANIMAL_SEX_LABELS: Readonly<Record<AnimalSex, string>> = {
  macho: 'Macho',
  femea: 'Fêmea',
};

export const ANIMAL_STATUS_LABELS: Readonly<Record<AnimalStatus, string>> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  adotado: 'Adotado',
  indisponivel: 'Indisponível',
};
