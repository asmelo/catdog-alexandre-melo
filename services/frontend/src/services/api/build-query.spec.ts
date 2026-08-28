import { buildQuery } from '~/services/api/build-query';

describe('buildQuery', () => {
  it('sem nenhum parâmetro, devolve texto vazio — e não um "?" solto', () => {
    expect(buildQuery({})).toBe('');
  });

  it('com um parâmetro, devolve "?chave=valor"', () => {
    expect(buildQuery({ page: 2 })).toBe('?page=2');
  });

  it('com vários parâmetros, preserva a ordem de declaração', () => {
    expect(buildQuery({ page: 2, pageSize: 20 })).toBe('?page=2&pageSize=20');
  });

  it('OMITE a chave `undefined` em vez de enviá-la vazia', () => {
    // `?page=` chegaria ao `listAnimalsQuerySchema` como texto vazio, que o
    // `z.coerce.number()` transforma em `0` — fora da faixa aceita. O resultado
    // seria `400` exatamente no caso em que a intenção era "use o padrão".
    expect(buildQuery({ page: undefined })).toBe('');
    expect(buildQuery({ page: undefined, pageSize: 20 })).toBe('?pageSize=20');
  });

  it('escapa o valor em vez de concatená-lo cru', () => {
    // O caso que a concatenação manual quebra: o primeiro município com acento
    // ou espaço no nome.
    expect(buildQuery({ cidade: 'Boa Esperança' })).toBe('?cidade=Boa+Esperan%C3%A7a');
  });

  it('trata o número zero como valor presente, e não como ausente', () => {
    // `0` é falsy. Um descarte escrito com `if (valor)` o perderia em silêncio, e
    // o defeito só apareceria no primeiro parâmetro que aceitasse zero.
    expect(buildQuery({ skip: 0 })).toBe('?skip=0');
  });

  it('texto vazio é enviado, porque é um valor — só `undefined` significa ausência', () => {
    expect(buildQuery({ busca: '' })).toBe('?busca=');
  });
});
