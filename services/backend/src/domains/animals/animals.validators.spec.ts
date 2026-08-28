import type { ZodError, ZodType, ZodTypeDef } from 'zod';

import { MESSAGES } from '~/domains/animals/animals.messages';
import {
  animalIdParamsSchema,
  changeStatusBodySchema,
  createAnimalBodySchema,
  listAnimalsQuerySchema,
  updateAnimalBodySchema,
} from '~/domains/animals/animals.validators';
import { validationErrorFromZodError } from '~/shared/errors/http-errors';
import * as clock from '~/utils/clock';

/**
 * Validacao de FORMULARIO das rotas de animal (CT-03 a CT-09, CT-12 a CT-17,
 * CT-21, CT-22, CT-28, CT-72, CT-75 e CT-92).
 *
 * Este e o unico lugar onde as mensagens em PT-BR sao comparadas CARACTERE A
 * CARACTERE contra a constante do modulo de mensagens: elas sao contrato com a
 * interface, que as exibe sem reescrever nada. Um teste que aceitasse "qualquer
 * erro no campo nome" nao perceberia a troca de "minimo 2 caracteres" por
 * "obrigatorio", que muda o que o administrador entende que precisa fazer.
 *
 * O corpo chega de `multipart/form-data`, entao TODO campo e string — inclusive
 * as alternancias e a data. Testar com booleanos e numeros nativos mediria um
 * contrato que a rota nao tem.
 */

interface Problema {
  readonly field: string;
  readonly message: string;
}

function problemas(erro: ZodError): ReadonlyArray<Problema> {
  return validationErrorFromZodError(erro).details ?? [];
}

function recusa(
  esquema: ZodType<unknown, ZodTypeDef, unknown>,
  valor: unknown,
): ReadonlyArray<Problema> {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    throw new Error(
      `Esperava recusa, mas o schema aceitou: ${JSON.stringify(resultado.data)}`,
    );
  }

  return problemas(resultado.error);
}

function aceita<Saida>(
  esquema: ZodType<Saida, ZodTypeDef, unknown>,
  valor: unknown,
): Saida {
  const resultado = esquema.safeParse(valor);

  if (!resultado.success) {
    throw new Error(
      `Esperava aceitacao, mas o schema recusou: ${JSON.stringify(problemas(resultado.error))}`,
    );
  }

  return resultado.data;
}

/** Corpo minimo e valido do cadastro, no formato em que o multipart entrega. */
const CORPO_VALIDO = {
  name: 'Theo',
  speciesId: '11111111-1111-4111-8111-111111111111',
  cityId: '22222222-2222-4222-8222-222222222222',
  size: 'grande',
  sex: 'macho',
} as const;

const CORPO_DE_EDICAO = {
  ...CORPO_VALIDO,
  updatedAt: '2026-08-25T12:00:00.000Z',
  keepImageIds: '[]',
} as const;

/** Fixa o relogio do produto no dia usado pelos casos de data. */
function fixarHoje(instante: string): void {
  jest.spyOn(clock, 'now').mockReturnValue(new Date(instante));
}

describe('createAnimalBodySchema — nome (RN-03 a RN-05)', () => {
  it('CT-03: nome vazio responde "Este campo é obrigatório."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, { ...CORPO_VALIDO, name: '' });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'name',
      message: MESSAGES.FIELD_REQUIRED,
    });
  });

  it('CT-03: nome so com espacos e tratado como vazio, e nao como "minimo 2 caracteres"', () => {
    // Arrange — a normalizacao roda ANTES da medicao, e e ela que permite ao
    // validador dizer "obrigatorio" em vez de reclamar do tamanho.
    const encontrados = recusa(createAnimalBodySchema, { ...CORPO_VALIDO, name: '   ' });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'name',
      message: MESSAGES.FIELD_REQUIRED,
    });
  });

  it('CT-04: nome de 1 caractere responde "O nome do animal deve ter no mínimo 2 caracteres."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, { ...CORPO_VALIDO, name: 'T' });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'name',
      message: 'O nome do animal deve ter no mínimo 2 caracteres.',
    });
  });

  it('CT-05: nomes de exatamente 2 e de exatamente 60 caracteres sao aceitos', () => {
    // Arrange & Act
    const doisCaracteres = aceita(createAnimalBodySchema, { ...CORPO_VALIDO, name: 'Th' });
    const sessentaCaracteres = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      name: 'T'.repeat(60),
    });

    // Assert
    expect(doisCaracteres.name).toBe('Th');
    expect(sessentaCaracteres.name).toHaveLength(60);
  });

  it('CT-06: nome de 61 caracteres responde "O nome do animal deve ter no máximo 60 caracteres."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      name: 'T'.repeat(61),
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'name',
      message: 'O nome do animal deve ter no máximo 60 caracteres.',
    });
  });

  it('CT-07: "  Theo   Junior " e normalizado para "Theo Junior", preservando caixa e acentos', () => {
    // Arrange & Act
    const corpo = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      name: '  Theo   Junior ',
    });
    const comAcento = aceita(createAnimalBodySchema, { ...CORPO_VALIDO, name: ' Nêga  Fulô ' });

    // Assert
    expect(corpo.name).toBe('Theo Junior');
    expect(comAcento.name).toBe('Nêga Fulô');
  });

  it('CT-06: o limite de 60 vale para o nome NORMALIZADO, e nao para o texto colado', () => {
    // Arrange — 60 caracteres uteis separados por sequencias de espacos: depois da
    // normalizacao o nome cabe, e recusa-lo faria o administrador contar espacos.
    const nome = `${'T'.repeat(30)}     ${'A'.repeat(29)}`;

    // Act
    const corpo = aceita(createAnimalBodySchema, { ...CORPO_VALIDO, name: nome });

    // Assert
    expect(corpo.name).toHaveLength(60);
  });
});

describe('createAnimalBodySchema — obrigatorios e conjuntos fechados', () => {
  it.each(['name', 'speciesId', 'cityId', 'size', 'sex'])(
    'CT-09: omitir `%s` responde "Este campo é obrigatório." nesse campo',
    (campo: string) => {
      // Arrange
      const corpo: Record<string, unknown> = { ...CORPO_VALIDO };

      delete corpo[campo];

      // Act
      const encontrados = recusa(createAnimalBodySchema, corpo);

      // Assert
      expect(encontrados).toContainEqual({
        field: campo,
        message: MESSAGES.FIELD_REQUIRED,
      });
    },
  );

  it('CT-09: com todos os obrigatorios ausentes, TODOS sao sinalizados de uma vez', () => {
    // Arrange — e nao um por requisicao: o administrador precisa ver a lista
    // inteira do que falta em uma unica tentativa.

    // Act
    const encontrados = recusa(createAnimalBodySchema, {});

    // Assert
    expect(encontrados.map((problema) => problema.field).sort()).toEqual([
      'cityId',
      'name',
      'sex',
      'size',
      'speciesId',
    ]);
    expect(
      encontrados.every((problema) => problema.message === MESSAGES.FIELD_REQUIRED),
    ).toBe(true);
  });

  it('CT-12: porte e sexo fora da lista respondem "Selecione uma opção válida."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      size: 'gigante',
      sex: 'outro',
    });

    // Assert — "opcao invalida" e nao "obrigatorio": o campo foi preenchido, so
    // que com um valor que nao existe.
    expect(encontrados).toEqual(
      expect.arrayContaining([
        { field: 'size', message: MESSAGES.INVALID_OPTION },
        { field: 'sex', message: MESSAGES.INVALID_OPTION },
      ]),
    );
  });

  it('CT-09 / CT-12: campo de escolha enviado VAZIO e "obrigatorio", e nao "opcao inválida"', () => {
    // Arrange — e o que o formulario envia quando a pessoa nao escolheu nada.

    // Act
    const encontrados = recusa(createAnimalBodySchema, { ...CORPO_VALIDO, size: '' });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'size',
      message: MESSAGES.FIELD_REQUIRED,
    });
  });

  it('CT-09: identificador de especie malformado responde "Identificador inválido."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      speciesId: 'nao-e-um-uuid',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'speciesId',
      message: MESSAGES.INVALID_IDENTIFIER,
    });
  });

  it('CT-13: chave nao prevista no corpo responde "Campo não permitido nesta requisição."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      apelido: 'Theozinho',
    });

    // Assert — o campo apontado e o INTRUSO, e nao a raiz do corpo.
    expect(encontrados).toContainEqual({
      field: 'apelido',
      message: MESSAGES.FIELD_NOT_ALLOWED,
    });
  });

  it('CT-14: `status` no corpo do CADASTRO e recusado como campo nao permitido', () => {
    // Arrange — o animal nasce Disponivel (RN-14). Aceitar o campo aqui deixaria
    // cadastrar um animal ja "Adotado", sem nenhum registro de como chegou la.

    // Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      status: 'adotado',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'status',
      message: MESSAGES.FIELD_NOT_ALLOWED,
    });
  });
});

describe('createAnimalBodySchema — data de nascimento (RN-18 / RN-19 / RNF-10)', () => {
  it('CT-15: data de amanha responde "A data de nascimento não pode ser futura."', () => {
    // Arrange
    fixarHoje('2026-08-25T12:00:00.000Z');

    // Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      birthDate: '2026-08-26',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'birthDate',
      message: 'A data de nascimento não pode ser futura.',
    });
  });

  it('CT-16: as 22h de Sao Paulo (01h do dia seguinte em UTC) a data de HOJE e aceita', () => {
    // Arrange — o defeito que so aparece a noite: com o processo em UTC, ja e dia
    // 26, e uma comparacao ingenua recusaria "2026-08-25" como futura.
    fixarHoje('2026-08-26T01:00:00.000Z');

    // Act
    const corpo = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      birthDate: '2026-08-25',
    });

    // Assert
    expect(corpo.birthDate).toEqual(new Date('2026-08-25T00:00:00.000Z'));
  });

  it('CT-16: as 22h de Sao Paulo, a data de AMANHA no fuso do produto continua sendo futura', () => {
    // Arrange — o contraponto do caso anterior: fixar o fuso nao pode ter
    // afrouxado a regra.
    fixarHoje('2026-08-26T01:00:00.000Z');

    // Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      birthDate: '2026-08-26',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'birthDate',
      message: 'A data de nascimento não pode ser futura.',
    });
  });

  it('CT-17: data de 31 anos atras responde "Informe uma data de nascimento dos últimos 30 anos."', () => {
    // Arrange
    fixarHoje('2026-08-25T12:00:00.000Z');

    // Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      birthDate: '1995-08-24',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'birthDate',
      message: 'Informe uma data de nascimento dos últimos 30 anos.',
    });
  });

  it('CT-17: a data de exatamente 30 anos atras ainda e aceita', () => {
    // Arrange — o limite e inclusivo; recusa-lo tiraria um dia de quem faz
    // aniversario hoje.
    fixarHoje('2026-08-25T12:00:00.000Z');

    // Act
    const corpo = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      birthDate: '1996-08-25',
    });

    // Assert
    expect(corpo.birthDate).toEqual(new Date('1996-08-25T00:00:00.000Z'));
  });

  it.each(['25/08/2026', '2026-8-5', '2026-02-30', 'ontem'])(
    'CT-15: a data "%s" responde "Informe a data de nascimento no formato AAAA-MM-DD."',
    (texto: string) => {
      // Arrange
      fixarHoje('2026-08-25T12:00:00.000Z');

      // Act
      const encontrados = recusa(createAnimalBodySchema, {
        ...CORPO_VALIDO,
        birthDate: texto,
      });

      // Assert — "2026-02-30" tem a FORMA certa e nao existe no calendario; sem a
      // verificacao do instante ele viraria 2 de marco em silencio.
      expect(encontrados).toContainEqual({
        field: 'birthDate',
        message: 'Informe a data de nascimento no formato AAAA-MM-DD.',
      });
    },
  );

  it('CT-20: data de nascimento ausente ou vazia vira `null`, e nao erro', () => {
    // Arrange & Act
    const ausente = aceita(createAnimalBodySchema, CORPO_VALIDO);
    const vazia = aceita(createAnimalBodySchema, { ...CORPO_VALIDO, birthDate: '' });

    // Assert
    expect(ausente.birthDate).toBeNull();
    expect(vazia.birthDate).toBeNull();
  });
});

describe('createAnimalBodySchema — descricao e alternancias', () => {
  it('CT-21: descricao de 1000 caracteres e aceita e a de 1001 e recusada', () => {
    // Arrange & Act
    const noLimite = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      description: 'a'.repeat(1000),
    });
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      description: 'a'.repeat(1001),
    });

    // Assert
    expect(noLimite.description).toHaveLength(1000);
    expect(encontrados).toContainEqual({
      field: 'description',
      message: 'A descrição deve ter no máximo 1000 caracteres.',
    });
  });

  it('CT-21: descricao ausente ou so com espacos vira `null`', () => {
    // Arrange & Act
    const ausente = aceita(createAnimalBodySchema, CORPO_VALIDO);
    const emBranco = aceita(createAnimalBodySchema, { ...CORPO_VALIDO, description: '   ' });

    // Assert — `null` e nao string vazia: a coluna e opcional e a interface
    // distingue "sem descricao" de "descricao vazia".
    expect(ausente.description).toBeNull();
    expect(emBranco.description).toBeNull();
  });

  it('CT-22: as alternancias ausentes chegam ao service como `false`', () => {
    // Arrange & Act
    const corpo = aceita(createAnimalBodySchema, CORPO_VALIDO);

    // Assert
    expect(corpo.acceptsOtherAnimals).toBe(false);
    expect(corpo.needsLargeSpace).toBe(false);
  });

  it('CT-22: `"true"` liga a alternancia e `"false"` a desliga', () => {
    // Arrange — chegam como TEXTO, porque o corpo e multipart.

    // Act
    const ligada = aceita(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      acceptsOtherAnimals: 'true',
      needsLargeSpace: 'false',
    });

    // Assert
    expect(ligada.acceptsOtherAnimals).toBe(true);
    expect(ligada.needsLargeSpace).toBe(false);
  });

  it('CT-12: alternancia com valor fora do par responde "Selecione uma opção válida."', () => {
    // Arrange & Act
    const encontrados = recusa(createAnimalBodySchema, {
      ...CORPO_VALIDO,
      acceptsOtherAnimals: 'talvez',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'acceptsOtherAnimals',
      message: MESSAGES.INVALID_OPTION,
    });
  });
});

describe('updateAnimalBodySchema — marca de alteracao e imagens mantidas', () => {
  it('CT-66: a marca de alteracao ausente responde "Este campo é obrigatório."', () => {
    // Arrange
    const corpo: Record<string, unknown> = { ...CORPO_DE_EDICAO };

    delete corpo['updatedAt'];

    // Act
    const encontrados = recusa(updateAnimalBodySchema, corpo);

    // Assert — sem ela nao ha bloqueio otimista possivel, entao ela e obrigatoria.
    expect(encontrados).toContainEqual({
      field: 'updatedAt',
      message: MESSAGES.FIELD_REQUIRED,
    });
  });

  it.each(['2026-08-25', '25/08/2026T12:00:00Z', '2026-02-30T12:00:00.000Z', 'agora'])(
    'CT-66: a marca "%s" responde "Informe a data e hora da última alteração no formato ISO 8601."',
    (texto: string) => {
      // Arrange & Act
      const encontrados = recusa(updateAnimalBodySchema, {
        ...CORPO_DE_EDICAO,
        updatedAt: texto,
      });

      // Assert
      expect(encontrados).toContainEqual({
        field: 'updatedAt',
        message: 'Informe a data e hora da última alteração no formato ISO 8601.',
      });
    },
  );

  it('CT-66: a marca valida chega ao service como `Date`', () => {
    // Arrange & Act
    const corpo = aceita(updateAnimalBodySchema, CORPO_DE_EDICAO);

    // Assert
    expect(corpo.updatedAt).toEqual(new Date('2026-08-25T12:00:00.000Z'));
  });

  it('CT-62: `keepImageIds` que nao e lista JSON de identificadores e recusado', () => {
    // Arrange & Act
    const encontrados = recusa(updateAnimalBodySchema, {
      ...CORPO_DE_EDICAO,
      keepImageIds: 'nao-e-json',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'keepImageIds',
      message: 'Informe as imagens mantidas como uma lista JSON de identificadores.',
    });
  });

  it('CT-61: identificador repetido em `keepImageIds` e recusado', () => {
    // Arrange — a lista e a ORDEM das imagens; um identificador repetido nao tem
    // como ser resolvido em uma posicao unica.
    const identificador = '33333333-3333-4333-8333-333333333333';

    // Act
    const encontrados = recusa(updateAnimalBodySchema, {
      ...CORPO_DE_EDICAO,
      keepImageIds: JSON.stringify([identificador, identificador]),
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'keepImageIds',
      message: 'Cada imagem mantida deve aparecer uma única vez na lista.',
    });
  });

  it('CT-61: `keepImageIds` valido chega ao service como lista, na ordem informada', () => {
    // Arrange
    const primeiro = '33333333-3333-4333-8333-333333333333';
    const segundo = '44444444-4444-4444-8444-444444444444';

    // Act
    const corpo = aceita(updateAnimalBodySchema, {
      ...CORPO_DE_EDICAO,
      keepImageIds: JSON.stringify([segundo, primeiro]),
    });

    // Assert
    expect(corpo.keepImageIds).toEqual([segundo, primeiro]);
  });

  it('CT-14: `status` no corpo da EDICAO tambem e campo nao permitido (RN-16)', () => {
    // Arrange & Act
    const encontrados = recusa(updateAnimalBodySchema, {
      ...CORPO_DE_EDICAO,
      status: 'adotado',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'status',
      message: MESSAGES.FIELD_NOT_ALLOWED,
    });
  });
});

describe('changeStatusBodySchema', () => {
  const CORPO_DE_STATUS = {
    status: 'adotado',
    updatedAt: '2026-08-25T12:00:00.000Z',
  } as const;

  it.each(['disponivel', 'reservado', 'adotado', 'indisponivel'])(
    'CT-70: o status "%s" e aceito',
    (status: string) => {
      // Arrange & Act
      const corpo = aceita(changeStatusBodySchema, { ...CORPO_DE_STATUS, status });

      // Assert
      expect(corpo.status).toBe(status);
    },
  );

  it.each([
    { rotulo: 'VENDIDO em maiusculas', status: 'VENDIDO' },
    { rotulo: 'texto vazio', status: '' },
    { rotulo: 'nulo', status: null },
    { rotulo: 'numero', status: 3 },
  ])(
    'CT-72: o status $rotulo responde "Selecione uma opção válida."',
    ({ status }: { readonly status: unknown }) => {
      // Arrange & Act
      const encontrados = recusa(changeStatusBodySchema, { ...CORPO_DE_STATUS, status });

      // Assert — inclusive "DISPONIVEL" em maiusculas: o contrato trafega os
      // valores em minusculas, e aceitar as duas formas criaria duas gramaticas.
      expect(encontrados).toContainEqual({
        field: 'status',
        message: MESSAGES.INVALID_OPTION,
      });
    },
  );

  it('CT-75: campo extra no corpo do status responde "Campo não permitido nesta requisição."', () => {
    // Arrange — o endpoint de status tem conjunto de campos disjunto do restante
    // do animal: aceitar `name` aqui seria uma segunda porta de edicao, sem
    // bloqueio otimista sobre os demais campos.

    // Act
    const encontrados = recusa(changeStatusBodySchema, {
      ...CORPO_DE_STATUS,
      name: 'Theo Renomeado',
    });

    // Assert
    expect(encontrados).toContainEqual({
      field: 'name',
      message: MESSAGES.FIELD_NOT_ALLOWED,
    });
  });
});

describe('listAnimalsQuerySchema', () => {
  it('sem parametros, a pagina 1 com 20 itens e o padrao', () => {
    // Arrange & Act
    const consulta = aceita(listAnimalsQuerySchema, {});

    // Assert
    expect(consulta).toEqual({ page: 1, pageSize: 20 });
  });

  it('os parametros chegam como TEXTO e sao convertidos para numero', () => {
    // Arrange & Act
    const consulta = aceita(listAnimalsQuerySchema, { page: '3', pageSize: '50' });

    // Assert
    expect(consulta).toEqual({ page: 3, pageSize: 50 });
  });

  it.each(['0', '101', '-1', '2.5', 'muitos'])(
    'CT-28: `pageSize` "%s" responde "O tamanho da página deve ser um número inteiro entre 1 e 100."',
    (pageSize: string) => {
      // Arrange & Act
      const encontrados = recusa(listAnimalsQuerySchema, { pageSize });

      // Assert
      expect(encontrados).toContainEqual({
        field: 'pageSize',
        message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.',
      });
    },
  );

  it('CT-28: `pageSize` 1 e 100 sao os extremos aceitos', () => {
    // Arrange & Act
    const minimo = aceita(listAnimalsQuerySchema, { pageSize: '1' });
    const maximo = aceita(listAnimalsQuerySchema, { pageSize: '100' });

    // Assert
    expect(minimo.pageSize).toBe(1);
    expect(maximo.pageSize).toBe(100);
  });

  it.each(['0', '-3', '1.5', 'primeira'])(
    'CT-28: `page` "%s" responde "A página deve ser um número inteiro maior ou igual a 1."',
    (page: string) => {
      // Arrange & Act
      const encontrados = recusa(listAnimalsQuerySchema, { page });

      // Assert
      expect(encontrados).toContainEqual({
        field: 'page',
        message: 'A página deve ser um número inteiro maior ou igual a 1.',
      });
    },
  );
});

describe('animalIdParamsSchema', () => {
  it.each(['abc', '123', '00000000-0000-0000-0000-000000000000-extra', ''])(
    'CT-92: o identificador "%s" responde "Identificador inválido."',
    (id: string) => {
      // Arrange & Act
      const encontrados = recusa(animalIdParamsSchema, { id });

      // Assert
      expect(encontrados).toContainEqual({
        field: 'id',
        message: MESSAGES.INVALID_IDENTIFIER,
      });
    },
  );

  it('CT-92: um UUID bem formado e aceito', () => {
    // Arrange & Act
    const parametros = aceita(animalIdParamsSchema, {
      id: '11111111-1111-4111-8111-111111111111',
    });

    // Assert
    expect(parametros.id).toBe('11111111-1111-4111-8111-111111111111');
  });
});
