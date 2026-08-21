/**
 * Fonte unica de tempo do backend. Os services devem usar estas funcoes em vez de
 * `new Date()` para que os TTLs (24 h da confirmacao de e-mail, 7 dias do refresh
 * token) sejam verificaveis sem `jest.useFakeTimers` em cada teste.
 */

const MILISSEGUNDOS_POR_HORA = 60 * 60 * 1000;
const HORAS_POR_DIA = 24;

export function now(): Date {
  return new Date();
}

/**
 * Soma aritmetica sobre o epoch, e nao `setHours`: o prazo contratado e uma
 * duracao absoluta ("expira em 24 h"), que nao deve encurtar nem alongar na
 * virada do horario de verao.
 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MILISSEGUNDOS_POR_HORA);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * HORAS_POR_DIA);
}
