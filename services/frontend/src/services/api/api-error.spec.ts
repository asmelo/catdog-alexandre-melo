import { ApiError, fieldErrorsOf } from '~/services/api/api-error';

describe('ApiError', () => {
  it('carrega status, code e message, e nomeia a si mesmo', () => {
    const erro = new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });

    expect(erro).toBeInstanceOf(Error);
    // `name` explicito: o default seria `Error`, e e este nome que aparece no
    // console e no relatorio de erro do navegador.
    expect(erro.name).toBe('ApiError');
    expect(erro.message).toBe('E-mail ou senha incorretos.');
    expect(erro.status).toBe(401);
    expect(erro.code).toBe('INVALID_CREDENTIALS');
  });

  it('sem details, a propriedade fica AUSENTE e nao presente com undefined', () => {
    const erro = new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Erro.' });

    // A distincao importa: `fieldErrorsOf` consulta `erro.details === undefined`,
    // e `'details' in erro` e o que diferencia os dois casos ao inspecionar.
    expect('details' in erro).toBe(false);
  });
});

describe('fieldErrorsOf', () => {
  it('converte details no mapa campo -> mensagem que os formularios consomem', () => {
    const erro = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [
        { field: 'email', message: 'Informe um e-mail válido.' },
        { field: 'password', message: 'A senha deve ter pelo menos 8 caracteres.' },
      ],
    });

    expect(fieldErrorsOf(erro)).toEqual({
      email: 'Informe um e-mail válido.',
      password: 'A senha deve ter pelo menos 8 caracteres.',
    });
  });

  it('a PRIMEIRA ocorrencia de cada campo vence', () => {
    const erro = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [
        { field: 'email', message: 'primeira' },
        { field: 'email', message: 'segunda' },
      ],
    });

    // Exibir duas mensagens no mesmo input e impossivel, e a primeira e a mais
    // especifica na ordem em que o Zod reporta.
    expect(fieldErrorsOf(erro)).toEqual({ email: 'primeira' });
  });

  it('trata __proto__ como chave de dado comum, sem acionar o setter do prototipo', () => {
    const erro = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [{ field: '__proto__', message: 'valor hostil' }],
    });

    const mapa = fieldErrorsOf(erro);

    /**
     * `Map` + `Object.fromEntries` em vez de `mapa[campo] = ...` nao e estilo:
     * `fromEntries` define PROPRIEDADE DE DADOS mesmo para `__proto__`, enquanto a
     * escrita direta acionaria o setter do prototipo e poderia contaminar objetos
     * nao relacionados.
     */
    expect(Object.getOwnPropertyDescriptor(mapa, '__proto__')?.value).toBe('valor hostil');
    expect(Object.prototype).not.toHaveProperty('valor hostil');
    expect(Object.getPrototypeOf(mapa)).toBe(Object.prototype);
  });

  it('devolve mapa vazio para erro sem details, para erro comum e para valor qualquer', () => {
    // Quem estava tratando um erro nao pode ser interrompido por um segundo erro:
    // dai devolver `{}` e nao lancar.
    expect(fieldErrorsOf(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Erro.' }))).toEqual({});
    expect(fieldErrorsOf(new TypeError('falha de programacao'))).toEqual({});
    expect(fieldErrorsOf(undefined)).toEqual({});
    expect(fieldErrorsOf('texto')).toEqual({});
  });
});
