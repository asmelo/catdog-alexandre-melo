import { formatAge } from '~/utils/format-age';

/**
 * O rotulo de idade.
 *
 * Duas coisas sao verificadas aqui, e as duas ja foram defeito em algum lugar
 * deste produto: a CONCORDANCIA (a captura exibe "3 ano(s)") e a distincao entre
 * `null` e `0` — que a interface precisa mostrar de formas diferentes.
 */

describe('formatAge', () => {
  it.each([
    { anos: null, meses: null, esperado: 'Idade não informada' },
    { anos: 1, meses: 12, esperado: '1 ano' },
    { anos: 3, meses: 45, esperado: '3 anos' },
    { anos: 0, meses: 5, esperado: '5 meses' },
    { anos: 0, meses: 1, esperado: '1 mês' },
    { anos: 0, meses: 0, esperado: 'Menos de 1 mês' },
  ])('anos=$anos meses=$meses → "$esperado"', ({ anos, meses, esperado }) => {
    expect(formatAge(anos, meses)).toBe(esperado);
  });

  it('`null` e `0` produzem rótulos DIFERENTES', () => {
    // `null` é "ninguém sabe"; `0` é "menos de um mês de vida". Um `?? 0`
    // transformaria idade desconhecida em recém-nascido.
    expect(formatAge(null, null)).not.toBe(formatAge(0, 0));
  });

  it('a concordância é correta em todos os casos — a captura exibe "3 ano(s)"', () => {
    // Mesmo princípio que já corrigiu "Total: 1 animais" na FEATURE-002: a
    // captura é fonte da verdade, mas um defeito de concordância nela é defeito.
    expect(formatAge(1, null)).toBe('1 ano');
    expect(formatAge(2, null)).toBe('2 anos');
    expect(formatAge(0, 1)).toBe('1 mês');
    expect(formatAge(0, 2)).toBe('2 meses');
  });

  it('`ageInYears` nulo vence, mesmo com meses informados', () => {
    // Os dois vêm juntos do backend; se por algum motivo divergirem, "não
    // informada" é a leitura segura.
    expect(formatAge(null, 5)).toBe('Idade não informada');
  });

  it('meses nulo com anos zero cai em "Menos de 1 mês", sem quebrar', () => {
    expect(formatAge(0, null)).toBe('Menos de 1 mês');
  });
});
