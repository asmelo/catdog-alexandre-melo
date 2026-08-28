import * as fs from 'node:fs';
import { resolve } from 'node:path';

/**
 * `readFileSync` e substituido por um duble que, POR PADRAO, delega ao modulo
 * real: todos os casos deste arquivo leem o recorte de verdade. So o `describe`
 * da validacao troca o conteudo, e apenas por UMA chamada.
 *
 * E `jest.mock` e nao `jest.spyOn` porque em Node 20 a propriedade `readFileSync`
 * de `node:fs` nao e configuravel — `spyOn` falha com "Cannot redefine property".
 */
jest.mock('node:fs', () => {
  const real = jest.requireActual<typeof import('node:fs')>('node:fs');

  return { ...real, readFileSync: jest.fn(real.readFileSync) };
});

/**
 * O cliente compartilhado e substituido pelo duble da semeadura ANTES de o modulo
 * do seed ser carregado — ele importa `prisma` de `~/infra/prisma/prisma-client`
 * no topo, para o caminho de linha de comando.
 *
 * E o que garante o criterio mais caro desta suite: NENHUMA escrita chega ao
 * Supabase real. Cada escrita medida contra o banco de verdade custa cerca de
 * 880 ms, e sao 5.597 linhas — a suite passaria de uma hora e ainda sujaria o
 * banco compartilhado.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-seed-double')>(
    '../fakes/prisma-seed-double',
  ),
);

import { prisma } from '~/infra/prisma/prisma-client';
import { normalizeForSearch } from '~/utils/text-normalizer';

import {
  prisma as duble,
  reiniciarDubleDaSemeadura,
} from '../fakes/prisma-seed-double';

import { seedGeography } from '../../prisma/seeds/geography.seed';

/**
 * Carga inicial de estados e municipios (TASK-BACKEND-002).
 *
 * ================== O TESTE QUE IMPORTA ==================
 *
 * O primeiro `describe` e o unico que nao pode faltar: a carga precisa ser
 * SERIALIZADA. Um `Promise.all` reintroduzido no laco dos lotes passa em qualquer
 * teste funcional — o resultado final e identico — e so quebra em volume, contra
 * o agrupador de conexoes do Supabase, em produção. A unica forma de detecta-lo
 * por teste e contar quantas escritas ficam EM VOO ao mesmo tempo: o maximo tem
 * que ser 1.
 *
 * ================== O RECORTE E O REAL ==================
 *
 * Estes testes leem o arquivo de verdade (`prisma/data/brazilian-states-cities.json`),
 * e nao uma amostra: o loteamento de 1.000, a contagem de 27 unidades federativas
 * e a resolucao do caminho so significam alguma coisa contra o recorte que sera
 * carregado em produção.
 */

const CAMINHO_DO_RECORTE = resolve(
  __dirname,
  '..',
  '..',
  'prisma',
  'data',
  'brazilian-states-cities.json',
);

const TOTAL_DE_UNIDADES_FEDERATIVAS = 27;
const TAMANHO_DO_LOTE = 1_000;

interface RecorteLido {
  readonly states: ReadonlyArray<{
    readonly uf: string;
    readonly name: string;
    readonly cities: ReadonlyArray<{ readonly ibgeCode: number; readonly name: string }>;
  }>;
}

function lerRecorteReal(): RecorteLido {
  const conteudo: unknown = JSON.parse(fs.readFileSync(CAMINHO_DO_RECORTE, 'utf-8'));

  if (
    typeof conteudo !== 'object' ||
    conteudo === null ||
    !('states' in conteudo) ||
    !Array.isArray(conteudo.states)
  ) {
    throw new Error('Recorte de teste: formato inesperado.');
  }

  return conteudo as RecorteLido;
}

const RECORTE = lerRecorteReal();

const TOTAL_DE_MUNICIPIOS = RECORTE.states.reduce(
  (soma, estado) => soma + estado.cities.length,
  0,
);

beforeEach(() => {
  reiniciarDubleDaSemeadura();
});

describe('seedGeography — serialização (o teste que o volume exige)', () => {
  it('emite no máximo UMA escrita em voo por vez — nunca um `Promise.all`', async () => {
    // Arrange — o banco começa vazio, que é o pior caso: 27 estados e 5.570
    // municípios para inserir.

    // Act
    await seedGeography(prisma);

    // Assert — o número é 1, e não "poucos": qualquer paralelismo faria este
    // contador subir. É o único sinal que distingue a carga serializada da
    // paralela, porque as duas produzem exatamente o mesmo banco no fim.
    expect(duble.maximoDeEscritasEmVoo).toBe(1);
  });

  it('mantém a serialização também quando há muitas linhas a ATUALIZAR', async () => {
    // Arrange — o outro laço de escrita: os `update` de renomeação, um por linha
    // divergente. Cem municípios com o nome trocado dariam cem `update` em voo se
    // o laço virasse `Promise.all`.
    await seedGeography(prisma);

    const divergentes = duble.linhasDeCidade.slice(0, 100);

    for (const cidade of divergentes) {
      await duble.city.update({
        where: { ibgeCode: cidade.ibgeCode },
        data: {
          name: `${cidade.name} (nome antigo)`,
          nameSearch: normalizeForSearch(`${cidade.name} (nome antigo)`),
          stateId: cidade.stateId,
        },
      });
    }

    duble.maximoDeEscritasEmVoo = 0;
    duble.comandos.length = 0;

    // Act
    await seedGeography(prisma);

    // Assert
    expect(duble.maximoDeEscritasEmVoo).toBe(1);
    expect(duble.comandos.filter((comando) => comando === 'city.update')).toHaveLength(100);
  });
});

describe('seedGeography — loteamento', () => {
  it('quebra a inserção de municípios em lotes de 1.000', async () => {
    // Arrange — 5.570 municípios em um único `createMany` produziriam uma
    // instrução com dezenas de milhares de parâmetros, acima do que o driver
    // aceita.

    // Act
    const resumo = await seedGeography(prisma);

    // Assert
    const lotesEsperados = Math.ceil(TOTAL_DE_MUNICIPIOS / TAMANHO_DO_LOTE);

    expect(duble.lotesDeCidades).toHaveLength(lotesEsperados);
    expect(duble.lotesDeCidades.every((tamanho) => tamanho <= TAMANHO_DO_LOTE)).toBe(true);
    expect(duble.lotesDeCidades.reduce((soma, tamanho) => soma + tamanho, 0)).toBe(
      TOTAL_DE_MUNICIPIOS,
    );
    expect(resumo.citiesCreated).toBe(TOTAL_DE_MUNICIPIOS);
  });

  it('os estados entram em uma única instrução, porque são 27', async () => {
    // Arrange & Act
    await seedGeography(prisma);

    // Assert
    expect(
      duble.comandos.filter((comando) => comando === 'state.createMany'),
    ).toHaveLength(1);
  });
});

describe('seedGeography — contadores', () => {
  it('o resumo vem do `count` devolvido pelo banco, e não do tamanho do que foi enviado', async () => {
    // Arrange — três estados e os municípios de um deles já existem. O
    // `skipDuplicates` faz o banco inserir MENOS linhas do que as enviadas, e é o
    // número do banco que precisa aparecer no resumo: contar `data.length`
    // relataria linhas que não foram criadas.
    const jaExistentes = RECORTE.states.slice(0, 3);

    for (const estado of jaExistentes) {
      const gravado = duble.semearEstado({ uf: estado.uf, name: estado.name });

      for (const cidade of estado.cities) {
        duble.semearCidade({
          stateId: gravado.id,
          name: cidade.name,
          nameSearch: normalizeForSearch(cidade.name),
          ibgeCode: cidade.ibgeCode,
        });
      }
    }

    const municipiosJaGravados = jaExistentes.reduce(
      (soma, estado) => soma + estado.cities.length,
      0,
    );

    // Act
    const resumo = await seedGeography(prisma);

    // Assert
    expect(resumo.statesCreated).toBe(TOTAL_DE_UNIDADES_FEDERATIVAS - 3);
    expect(resumo.citiesCreated).toBe(TOTAL_DE_MUNICIPIOS - municipiosJaGravados);
    expect(duble.linhasDeEstado).toHaveLength(TOTAL_DE_UNIDADES_FEDERATIVAS);
    expect(duble.linhasDeCidade).toHaveLength(TOTAL_DE_MUNICIPIOS);
  });

  it('a carga vazia relata 27 estados e todos os municípios do recorte', async () => {
    // Arrange & Act
    const resumo = await seedGeography(prisma);

    // Assert
    expect(resumo).toEqual({
      statesCreated: TOTAL_DE_UNIDADES_FEDERATIVAS,
      citiesCreated: TOTAL_DE_MUNICIPIOS,
    });
  });
});

describe('seedGeography — idempotência (RN-27)', () => {
  it('a segunda execução não cria nada e não altera nada', async () => {
    // Arrange
    const primeira = await seedGeography(prisma);
    const estadosDepoisDaPrimeira = [...duble.linhasDeEstado];

    // Act
    const segunda = await seedGeography(prisma);

    // Assert — é a garantia de que a carga pode ser reexecutada a cada
    // implantação sem duplicar município nenhum.
    expect(primeira.statesCreated).toBe(TOTAL_DE_UNIDADES_FEDERATIVAS);
    expect(segunda).toEqual({ statesCreated: 0, citiesCreated: 0 });
    expect(duble.linhasDeEstado).toEqual(estadosDepoisDaPrimeira);
    expect(duble.linhasDeCidade).toHaveLength(TOTAL_DE_MUNICIPIOS);
  });

  it('a segunda execução não emite escrita nenhuma', async () => {
    // Arrange
    await seedGeography(prisma);
    duble.comandos.length = 0;

    // Act
    await seedGeography(prisma);

    // Assert — só as leituras de comparação. Um `createMany` com lista vazia
    // continuaria sendo ida ao banco à toa.
    expect(duble.comandos).toEqual(['state.findMany', 'city.findMany']);
  });
});

describe('seedGeography — atualização preserva o identificador', () => {
  it('renomear um estado NÃO recria a linha: o `id` é o mesmo, e os municípios continuam ligados', async () => {
    // Arrange — se a carga apagasse e recriasse a linha, todo animal cadastrado
    // naquela cidade perderia a referência. O `update` existe para isso.
    await seedGeography(prisma);

    const antes = duble.linhasDeEstado.find((estado) => estado.uf === 'PR');

    if (antes === undefined) {
      throw new Error('Semente: o Paraná deveria existir.');
    }

    await duble.state.update({ where: { uf: 'PR' }, data: { name: 'Nome Antigo' } });

    // Act
    const resumo = await seedGeography(prisma);

    // Assert
    const depois = duble.linhasDeEstado.find((estado) => estado.uf === 'PR');

    expect(depois?.id).toBe(antes.id);
    expect(depois?.name).toBe(antes.name);
    expect(resumo.statesCreated).toBe(0);
  });

  it('renomear um município NÃO recria a linha: o `id` é o mesmo', async () => {
    // Arrange
    await seedGeography(prisma);

    const antes = duble.linhasDeCidade[0];

    if (antes === undefined) {
      throw new Error('Semente: deveria haver municípios.');
    }

    await duble.city.update({
      where: { ibgeCode: antes.ibgeCode },
      data: {
        name: 'Nome Antigo',
        nameSearch: normalizeForSearch('Nome Antigo'),
        stateId: antes.stateId,
      },
    });

    // Act
    await seedGeography(prisma);

    // Assert
    const depois = duble.linhasDeCidade.find(
      (cidade) => cidade.ibgeCode === antes.ibgeCode,
    );

    expect(depois).toEqual(antes);
  });
});

describe('seedGeography — validação do recorte antes de qualquer comando', () => {
  /**
   * Troca o conteudo do recorte por UMA leitura — que e exatamente quantas a
   * carga faz. Qualquer outra leitura de arquivo continua real.
   */
  function comRecorte(conteudo: string): void {
    jest.mocked(fs.readFileSync).mockImplementationOnce(() => conteudo);
  }

  it.each([
    { cenario: 'JSON inválido', conteudo: '{ nao e json' },
    { cenario: 'menos de 27 unidades federativas', conteudo: '{"states":[]}' },
    {
      cenario: 'sigla fora do padrão',
      conteudo: JSON.stringify({
        states: Array.from({ length: 27 }, (_, indice) => ({
          uf: `x${String(indice)}`,
          name: 'Estado',
          cities: [{ ibgeCode: 4_100_000 + indice, name: 'Cidade' }],
        })),
      }),
    },
    {
      cenario: 'código IBGE repetido',
      conteudo: JSON.stringify({
        states: RECORTE.states.map((estado) => ({
          uf: estado.uf,
          name: estado.name,
          cities: [{ ibgeCode: 4_100_000, name: 'Cidade' }],
        })),
      }),
    },
  ])(
    'recorte com $cenario aborta ANTES do primeiro comando',
    async ({ conteudo }: { readonly conteudo: string }) => {
      // Arrange
      comRecorte(conteudo);

      // Act
      const recusa = seedGeography(prisma);

      // Assert — a mensagem promete "nenhum registro foi criado ou alterado", e o
      // que prova a promessa é o log de comandos VAZIO: não basta não ter criado,
      // é preciso não ter ido ao banco.
      await expect(recusa).rejects.toThrow(
        /Recorte de estados e municipios invalido/,
      );
      await expect(recusa).rejects.toThrow(
        /Nenhum registro foi criado ou alterado/,
      );
      expect(duble.comandos).toEqual([]);
      expect(duble.linhasDeEstado).toEqual([]);
    },
  );

  it('a mensagem do recorte inválido nomeia o arquivo e o problema encontrado', async () => {
    // Arrange — quem executa a carga precisa saber O QUE corrigir, e não apenas
    // que ela falhou.
    comRecorte('{"states":[]}');

    // Act
    const recusa = seedGeography(prisma);

    // Assert
    await expect(recusa).rejects.toThrow(CAMINHO_DO_RECORTE);
    await expect(recusa).rejects.toThrow(
      'o recorte deve conter exatamente 27 unidades federativas',
    );
  });

  it('recorte com a MESMA sigla em dois estados aborta nomeando a sigla repetida', async () => {
    // Arrange — 27 unidades federativas, todas com sigla no formato certo e
    // códigos IBGE únicos: o único defeito é a repetição. Sem esta regra o
    // recorte passaria na contagem, o `createMany` gravaria 26 linhas em vez de
    // 27 por causa do `@unique` com `skipDuplicates`, e a carga terminaria em
    // silêncio com um estado faltando.
    const [primeiro, segundo] = RECORTE.states;

    expect(primeiro).toBeDefined();
    expect(segundo).toBeDefined();

    comRecorte(
      JSON.stringify({
        states: RECORTE.states.map((estado, indice) =>
          indice === 1 ? { ...estado, uf: primeiro?.uf } : estado,
        ),
      }),
    );

    // Act
    const recusa = seedGeography(prisma);

    // Assert
    await expect(recusa).rejects.toThrow(`UF repetida no recorte: ${String(primeiro?.uf)}`);
    expect(duble.comandos).toEqual([]);
  });

});

describe('seedGeography — resolução do caminho do recorte', () => {
  it('lê o recorte por `__dirname`, e não pelo diretório de trabalho do processo', async () => {
    // Arrange — a carga é executada por `npm run db:seed`, por `ts-node` direto e
    // por script de implantação, de diretórios diferentes. Um caminho relativo ao
    // `process.cwd()` funcionaria na máquina de quem escreveu e falharia no deploy.
    const diretorioOriginal = process.cwd();

    try {
      process.chdir('/');
      jest.resetModules();

      const recarregado =
        jest.requireActual<typeof import('../../prisma/seeds/geography.seed')>(
          '../../prisma/seeds/geography.seed',
        );

      // Act
      const resumo = await recarregado.seedGeography(prisma);

      // Assert
      expect(resumo.statesCreated).toBe(TOTAL_DE_UNIDADES_FEDERATIVAS);
    } finally {
      process.chdir(diretorioOriginal);
      jest.resetModules();
    }
  });
});

describe('seedGeography — o estado que não chegou a ser semeado', () => {
  it('aborta a carga de municípios nomeando a UF ausente, em vez de gravar cidade sem estado', async () => {
    // Arrange — o cenário é o do banco que devolve menos do que acabou de aceitar:
    // a inserção dos 27 estados é confirmada, mas a releitura que monta o mapa de
    // `uf -> id` traz 26. Acontece de verdade quando alguém apaga uma linha entre
    // os dois comandos, e o desfecho correto é PARAR: sem o `id` do estado, a
    // única alternativa seria gravar município apontando para outro lugar, que é
    // exatamente o que a RN-29 proíbe.
    //
    // O espião cai sobre a SEGUNDA chamada (a releitura). A primeira, que lista o
    // que já existe, tem de continuar real — é ela que decide o que inserir.
    const real = duble.state.findMany.bind(duble.state);
    let chamadas = 0;

    const espiao = jest
      .spyOn(duble.state, 'findMany')
      .mockImplementation(async (argumentos = {}) => {
        chamadas += 1;

        const linhas = await real(argumentos);

        return chamadas === 2 ? linhas.slice(1) : linhas;
      });

    // Act
    const recusa = seedGeography(prisma);

    // Assert
    await expect(recusa).rejects.toThrow(/Carga de municipios abortada/);
    await expect(recusa).rejects.toThrow(/Nenhum municipio foi criado ou alterado/);

    // E a promessa da mensagem é verificada, não apenas lida: nenhum município
    // entrou.
    expect(duble.linhasDeCidade).toEqual([]);

    espiao.mockRestore();
  });
});
