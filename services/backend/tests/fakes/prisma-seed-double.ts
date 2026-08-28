/**
 * Duble de Prisma da CARGA DE GEOGRAFIA (TASK-BACKEND-011).
 *
 * Existe separado do `prisma-double` porque o que ele precisa observar e outra
 * coisa: nao o resultado das consultas, e sim COMO os comandos sao emitidos —
 * quantos ficam em voo ao mesmo tempo, em que ordem, e de que tamanho e cada
 * lote. Sao essas tres medidas que separam a carga serializada, que o Supabase
 * aguenta, da carga em paralelo, que derruba o agrupador de conexoes com 5.570
 * municipios.
 *
 * Todo comando de ESCRITA passa por `registrarEscrita`, que cede o laco de
 * eventos no meio: sem essa cessao, duas escritas disparadas em paralelo
 * terminariam sincronamente e o contador de "em voo" nunca passaria de 1, ou
 * seja, o teste passaria mesmo com `Promise.all`.
 */

export interface LinhaDeEstado {
  readonly id: string;
  readonly uf: string;
  readonly name: string;
}

export interface LinhaDeCidade {
  readonly id: string;
  readonly stateId: string;
  readonly name: string;
  readonly ibgeCode: number;
}

interface Contagem {
  readonly count: number;
}

interface SelecaoDeEstados {
  readonly where?: { readonly uf?: { readonly in: ReadonlyArray<string> } };
}

interface CriacaoDeEstados {
  readonly data: ReadonlyArray<{ readonly uf: string; readonly name: string }>;
  readonly skipDuplicates?: boolean;
}

interface AtualizacaoDeEstado {
  readonly where: { readonly uf: string };
  readonly data: { readonly name: string };
}

interface CriacaoDeCidades {
  readonly data: ReadonlyArray<{
    readonly stateId: string;
    readonly name: string;
    readonly ibgeCode: number;
  }>;
  readonly skipDuplicates?: boolean;
}

interface AtualizacaoDeCidade {
  readonly where: { readonly ibgeCode: number };
  readonly data: { readonly name: string; readonly stateId: string };
}

let sequencia = 0;

function proximoIdentificador(prefixo: string): string {
  sequencia += 1;

  return `${prefixo}-${String(sequencia).padStart(6, '0')}`;
}

class DubleDePrismaDaSemeadura {
  private estados: LinhaDeEstado[] = [];

  private cidades: LinhaDeCidade[] = [];

  /** Nome de cada comando emitido, na ordem — leituras inclusive. */
  readonly comandos: string[] = [];

  /** Tamanho de cada lote passado a `city.createMany`, na ordem. */
  readonly lotesDeCidades: number[] = [];

  private emVoo = 0;

  /** Maior numero de ESCRITAS simultaneas observado. Tem que ser 1. */
  maximoDeEscritasEmVoo = 0;

  get linhasDeEstado(): ReadonlyArray<LinhaDeEstado> {
    return this.estados;
  }

  get linhasDeCidade(): ReadonlyArray<LinhaDeCidade> {
    return this.cidades;
  }

  limpar(): void {
    this.estados = [];
    this.cidades = [];
    this.comandos.length = 0;
    this.lotesDeCidades.length = 0;
    this.emVoo = 0;
    this.maximoDeEscritasEmVoo = 0;
    sequencia = 0;
  }

  semearEstado(linha: { readonly uf: string; readonly name: string }): LinhaDeEstado {
    const estado = { id: proximoIdentificador('estado'), ...linha };

    this.estados.push(estado);

    return estado;
  }

  semearCidade(linha: {
    readonly stateId: string;
    readonly name: string;
    readonly ibgeCode: number;
  }): LinhaDeCidade {
    const cidade = { id: proximoIdentificador('cidade'), ...linha };

    this.cidades.push(cidade);

    return cidade;
  }

  private async registrarLeitura<T>(nome: string, produzir: () => T): Promise<T> {
    this.comandos.push(nome);

    return Promise.resolve().then(produzir);
  }

  private async registrarEscrita<T>(nome: string, aplicar: () => T): Promise<T> {
    this.comandos.push(nome);

    this.emVoo += 1;
    this.maximoDeEscritasEmVoo = Math.max(this.maximoDeEscritasEmVoo, this.emVoo);

    // Cede o laco de eventos: e o que torna a simultaneidade OBSERVAVEL.
    await new Promise<void>((resolver) => {
      setImmediate(resolver);
    });

    try {
      return aplicar();
    } finally {
      this.emVoo -= 1;
    }
  }

  readonly state = {
    findMany: (argumentos: SelecaoDeEstados = {}): Promise<LinhaDeEstado[]> =>
      this.registrarLeitura('state.findMany', () => {
        const filtro = argumentos.where?.uf;

        if (filtro === undefined) {
          return [...this.estados];
        }

        const desejadas = new Set(filtro.in);

        return this.estados.filter((estado) => desejadas.has(estado.uf));
      }),

    createMany: (argumentos: CriacaoDeEstados): Promise<Contagem> =>
      this.registrarEscrita('state.createMany', () => {
        const existentes = new Set(this.estados.map((estado) => estado.uf));
        let criados = 0;

        for (const linha of argumentos.data) {
          if (existentes.has(linha.uf)) {
            continue;
          }

          existentes.add(linha.uf);
          this.semearEstado(linha);
          criados += 1;
        }

        return { count: criados };
      }),

    update: (argumentos: AtualizacaoDeEstado): Promise<LinhaDeEstado> =>
      this.registrarEscrita('state.update', () => {
        const atual = this.estados.find((estado) => estado.uf === argumentos.where.uf);

        if (atual === undefined) {
          throw new Error(`Duble da semeadura: estado ${argumentos.where.uf} nao existe.`);
        }

        const atualizado = { ...atual, name: argumentos.data.name };

        this.estados = this.estados.map((estado) =>
          estado.uf === argumentos.where.uf ? atualizado : estado,
        );

        return atualizado;
      }),
  };

  readonly city = {
    findMany: (): Promise<LinhaDeCidade[]> =>
      this.registrarLeitura('city.findMany', () => [...this.cidades]),

    createMany: (argumentos: CriacaoDeCidades): Promise<Contagem> => {
      this.lotesDeCidades.push(argumentos.data.length);

      return this.registrarEscrita('city.createMany', () => {
        const existentes = new Set(this.cidades.map((cidade) => cidade.ibgeCode));
        let criadas = 0;

        for (const linha of argumentos.data) {
          if (existentes.has(linha.ibgeCode)) {
            continue;
          }

          existentes.add(linha.ibgeCode);
          this.semearCidade(linha);
          criadas += 1;
        }

        return { count: criadas };
      });
    },

    update: (argumentos: AtualizacaoDeCidade): Promise<LinhaDeCidade> =>
      this.registrarEscrita('city.update', () => {
        const atual = this.cidades.find(
          (cidade) => cidade.ibgeCode === argumentos.where.ibgeCode,
        );

        if (atual === undefined) {
          throw new Error(
            `Duble da semeadura: municipio ${String(argumentos.where.ibgeCode)} nao existe.`,
          );
        }

        const atualizada = { ...atual, ...argumentos.data };

        this.cidades = this.cidades.map((cidade) =>
          cidade.ibgeCode === argumentos.where.ibgeCode ? atualizada : cidade,
        );

        return atualizada;
      }),
  };

  async $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export const prisma = new DubleDePrismaDaSemeadura();

export function reiniciarDubleDaSemeadura(): void {
  prisma.limpar();
}
