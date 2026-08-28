import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { prisma as prismaCompartilhado } from '~/infra/prisma/prisma-client';

/**
 * Carga das 27 unidades federativas e dos municipios brasileiros a partir do
 * recorte oficial do IBGE EMBARCADO em `prisma/data/brazilian-states-cities.json`.
 *
 * RN-27 / Decisao A da spec: o IBGE e a ORIGEM do dado, nunca uma dependencia em
 * tempo de execucao. Nao ha nenhuma chamada de rede aqui — o recorte foi
 * capturado uma unica vez e versionado. Com a rede externa inteiramente
 * bloqueada esta carga conclui normalmente.
 *
 * DOIS gatilhos, deliberadamente:
 *   1. `seedGeography(prisma)`, chamado por `prisma/seed.ts` (`npm run db:seed`),
 *      ao lado do provisionamento do administrador.
 *   2. `npm run db:seed:geography`, que executa ESTE arquivo diretamente e roda
 *      SOMENTE a geografia.
 *
 * O segundo gatilho existe porque o gancho `prisma.seed` do `package.json` esta
 * ocupado pelo provisionamento do administrador, que e deliberadamente
 * AUTORITATIVO: reexecuta-lo reescreve `passwordHash`, `role`, `status` e
 * `emailConfirmedAt` da linha existente em `users`. Isso e correto para
 * provisionar acesso e errado como efeito colateral de atualizar uma tabela de
 * apoio. Sem o gatilho dedicado, atualizar o recorte municipal — operacao que se
 * repete a cada mudanca na divisao territorial — obrigaria a mexer na conta do
 * administrador junto.
 */

/**
 * Casar municipio por `ibgeCode` e a decisao central desta carga. Municipio
 * renomeado e o MESMO municipio: casar por nome criaria uma linha nova e
 * deixaria os animais ja cadastrados apontando para a linha velha. O codigo de
 * 7 digitos e a identidade estavel, e e `@unique` no schema justamente para
 * isso.
 */
const CODIGO_IBGE_MINIMO = 1_000_000;
const CODIGO_IBGE_MAXIMO = 9_999_999;

/** As 27 unidades federativas: 26 estados mais o Distrito Federal. */
const TOTAL_DE_UNIDADES_FEDERATIVAS = 27;

/**
 * Um `upsert` por municipio custaria ~5.600 idas ao banco e tornaria a carga
 * inviavel em CI. O lote de 1.000 mantem a carga em poucas dezenas de comandos
 * sem chegar perto do limite de parametros do driver.
 *
 * Vale APENAS para o `createMany`, onde o que se agrupa sao parametros de UM
 * comando. As correcoes por `update` sao governadas por outra grandeza — numero
 * de conexoes simultaneas — e por isso saem em serie; ver o comentario do laco
 * de correcao em `semearMunicipios`.
 */
const TAMANHO_DO_LOTE = 1_000;

/**
 * Caminho resolvido a partir de `__dirname`, e NAO relativo ao diretorio de
 * trabalho: `prisma db seed`, `npm run db:seed:geography` e o CI nao rodam
 * necessariamente da mesma pasta.
 */
const CAMINHO_DO_RECORTE = resolve(__dirname, '..', 'data', 'brazilian-states-cities.json');

const cidadeDoRecorteSchema = z.object({
  ibgeCode: z
    .number()
    .int()
    .min(CODIGO_IBGE_MINIMO, 'deve ser o codigo de municipio de 7 digitos')
    .max(CODIGO_IBGE_MAXIMO, 'deve ser o codigo de municipio de 7 digitos'),
  name: z.string().trim().min(1).max(120),
});

const estadoDoRecorteSchema = z.object({
  uf: z.string().regex(/^[A-Z]{2}$/, 'deve ser a sigla de duas letras maiusculas'),
  name: z.string().trim().min(1).max(60),
  cities: z.array(cidadeDoRecorteSchema).min(1),
});

/**
 * O recorte e validado ANTES de qualquer escrita. Um arquivo corrompido ou
 * truncado precisa derrubar a carga com mensagem legivel, e nao semear meia
 * federacao: `states` com 19 linhas e um defeito muito mais caro de descobrir
 * depois, quando o formulario de animal ja estiver em uso.
 */
const recorteSchema = z
  .object({
    states: z
      .array(estadoDoRecorteSchema)
      .length(
        TOTAL_DE_UNIDADES_FEDERATIVAS,
        `o recorte deve conter exatamente ${TOTAL_DE_UNIDADES_FEDERATIVAS} unidades federativas`,
      ),
  })
  .superRefine((recorte, contexto) => {
    const ufsVistas = new Set<string>();
    const codigosVistos = new Set<number>();

    for (const estado of recorte.states) {
      if (ufsVistas.has(estado.uf)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message: `UF repetida no recorte: ${estado.uf}`,
        });
      }
      ufsVistas.add(estado.uf);

      for (const cidade of estado.cities) {
        if (codigosVistos.has(cidade.ibgeCode)) {
          contexto.addIssue({
            code: z.ZodIssueCode.custom,
            message: `codigo IBGE repetido no recorte: ${cidade.ibgeCode}`,
          });
        }
        codigosVistos.add(cidade.ibgeCode);
      }
    }
  });

type EstadoDoRecorte = z.infer<typeof estadoDoRecorteSchema>;

export interface ResumoDaCargaGeografica {
  readonly statesCreated: number;
  readonly citiesCreated: number;
}

/**
 * `JSON.parse` devolve `any`; o `parse` do Zod e o que converte esse `any` em um
 * tipo conhecido sem `as` e sem `any` vazando para o resto do modulo.
 */
function recorteInvalido(detalhes: string): Error {
  return new Error(
    `Recorte de estados e municipios invalido (${CAMINHO_DO_RECORTE}). ` +
      `Nenhum registro foi criado ou alterado:\n${detalhes}`,
  );
}

/**
 * `JSON.parse` fica DENTRO da guarda, e nao em cima dela.
 *
 * Um arquivo com uma virgula sobrando e o defeito mais provavel de um recorte
 * editado a mao, e sem este `catch` ele escapava como `SyntaxError` cru — sem
 * dizer QUAL arquivo esta quebrado e sem a garantia explicita de que nada foi
 * gravado, que e justamente o que a mensagem existe para prometer. Detectado
 * pela TASK-BACKEND-011.
 */
function decodificar(conteudo: string): unknown {
  try {
    return JSON.parse(conteudo);
  } catch (motivo: unknown) {
    throw recorteInvalido(
      `  - (raiz): nao e um JSON valido: ${motivo instanceof Error ? motivo.message : String(motivo)}`,
    );
  }
}

function lerRecorte(): readonly EstadoDoRecorte[] {
  const conteudo = readFileSync(CAMINHO_DO_RECORTE, 'utf-8');

  const resultado = recorteSchema.safeParse(decodificar(conteudo));

  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.') || '(raiz)'}: ${problema.message}`)
      .join('\n');

    throw recorteInvalido(detalhes);
  }

  return resultado.data.states;
}

function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = [];

  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho));
  }

  return lotes;
}

interface CargaDeEstados {
  readonly criados: number;
  readonly idPorUf: ReadonlyMap<string, string>;
}

/**
 * Estados sao 27: le-se o que ja existe, insere-se o que falta em um unico
 * comando e corrige-se o nome de quem divergiu. O mapa `uf -> id` e resolvido
 * UMA vez e reaproveitado por todos os municipios, em vez de uma consulta por
 * cidade.
 */
async function semearEstados(
  prisma: PrismaClient,
  estados: readonly EstadoDoRecorte[],
): Promise<CargaDeEstados> {
  const existentes = await prisma.state.findMany({
    select: { id: true, uf: true, name: true },
  });

  const idPorUf = new Map(existentes.map((estado) => [estado.uf, estado.id]));
  const nomePorUf = new Map(existentes.map((estado) => [estado.uf, estado.name]));

  const ausentes: Prisma.StateCreateManyInput[] = estados
    .filter((estado) => !idPorUf.has(estado.uf))
    .map((estado) => ({ uf: estado.uf, name: estado.name }));

  /**
   * O contador vem do `count` devolvido pelo `createMany`, e nao de
   * `ausentes.length`: com `skipDuplicates` os dois numeros divergem sempre que
   * outra execucao concorrente tiver inserido a mesma UF no intervalo entre a
   * leitura e a escrita. Relatar o que se pretendia inserir, e nao o que foi
   * inserido, transforma o log em ficcao.
   */
  let criados = 0;

  if (ausentes.length > 0) {
    const inseridos = await prisma.state.createMany({ data: ausentes, skipDuplicates: true });

    criados = inseridos.count;

    const recemCriados = await prisma.state.findMany({
      where: { uf: { in: ausentes.map((estado) => estado.uf) } },
      select: { id: true, uf: true },
    });

    for (const estado of recemCriados) {
      idPorUf.set(estado.uf, estado.id);
    }
  }

  const renomeados = estados.filter((estado) => {
    const nomeAtual = nomePorUf.get(estado.uf);

    return nomeAtual !== undefined && nomeAtual !== estado.name;
  });

  /**
   * Em serie, um `await` por vez, pelo mesmo motivo detalhado no laco de
   * correcao de `semearMunicipios`: sao ate 27 `update` e o limiar de falha sob
   * `connection_limit=1` fica em torno de 11 comandos em voo.
   */
  for (const estado of renomeados) {
    await prisma.state.update({ where: { uf: estado.uf }, data: { name: estado.name } });
  }

  return { criados, idPorUf };
}

/**
 * Municipios sao ~5.600: uma unica leitura da tabela decide, em memoria, quem
 * falta inserir e quem mudou de nome ou de estado. Na reexecucao sem alteracao
 * no recorte, as duas listas saem vazias e a carga nao escreve NADA — e isso que
 * torna o script reexecutavel sem efeito colateral e sem erro de chave
 * duplicada.
 */
async function semearMunicipios(
  prisma: PrismaClient,
  estados: readonly EstadoDoRecorte[],
  idPorUf: ReadonlyMap<string, string>,
): Promise<number> {
  const desejados: Prisma.CityCreateManyInput[] = estados.flatMap((estado) => {
    const stateId = idPorUf.get(estado.uf);

    if (stateId === undefined) {
      throw new Error(
        `Carga de municipios abortada: o estado ${estado.uf} nao foi semeado. ` +
          'Nenhum municipio foi criado ou alterado.',
      );
    }

    return estado.cities.map((cidade) => ({
      stateId,
      name: cidade.name,
      ibgeCode: cidade.ibgeCode,
    }));
  });

  const existentes = await prisma.city.findMany({
    select: { ibgeCode: true, name: true, stateId: true },
  });

  const existentePorCodigo = new Map(existentes.map((cidade) => [cidade.ibgeCode, cidade]));

  const ausentes = desejados.filter((cidade) => !existentePorCodigo.has(cidade.ibgeCode));

  const divergentes = desejados.filter((cidade) => {
    const atual = existentePorCodigo.get(cidade.ibgeCode);

    return atual !== undefined && (atual.name !== cidade.name || atual.stateId !== cidade.stateId);
  });

  /** Mesmo motivo do contador de estados: soma-se o `count` real de cada lote. */
  let criados = 0;

  for (const lote of emLotes(ausentes, TAMANHO_DO_LOTE)) {
    const inseridos = await prisma.city.createMany({ data: lote, skipDuplicates: true });

    criados += inseridos.count;
  }

  /**
   * `update` por `ibgeCode`, jamais delete + insert: a linha precisa manter o
   * MESMO `id` para que os animais ja vinculados aquele municipio continuem
   * apontando para ele (e a FK `animals.city_id` e `Restrict`, entao um delete
   * nem passaria).
   *
   * Os `update` saem EM SERIE, um `await` por vez, e nao sob `Promise.all`. A
   * razao esta na combinacao de dois numeros, e cada um vem de um lugar:
   *
   * - `connection_limit=1` esta escrito na `DATABASE_URL` do projeto (`.env`),
   *   na string de conexao do pooler;
   * - `pool_timeout = 10 s` NAO esta na string de conexao: e o default do
   *   Prisma (engine 5.22), e so muda se alguem acrescentar `pool_timeout=`
   *   a URL.
   *
   * Com UMA conexao no pool, concorrencia nao divide a espera, MULTIPLICA — o
   * N-esimo comando disparado em paralelo fica na fila por `(N-1) x latencia`
   * ate conseguir a conexao. Medido neste ambiente: ~900 ms por `update`, entao
   * a partir de ~11 comandos em voo a espera passa dos 10 s de `pool_timeout` e
   * o Prisma derruba a carga com `P2024`, deixando a correcao pela metade.
   *
   * Lotear o paralelismo NAO resolve: sob uma conexao o limiar e ditado por
   * latencia e timeout, nao pelo tamanho do lote — 25 e 1.000 quebram no mesmo
   * ponto. Em serie nao ha fila: cada comando espera apenas o proprio tempo de
   * resposta, e a carga conclui inteira.
   *
   * O custo e o tempo total, ~1 s por municipio renomeado. E aceitavel: so ha
   * escrita quando a divisao territorial muda, e uma carga lenta que termina
   * vale mais que uma rapida que aborta no meio.
   *
   * Se um dia esse tempo incomodar, a rota de escape exige as DUAS coisas
   * juntas: subir `connection_limit` para N na `DATABASE_URL` E limitar a
   * concorrencia deste laco a C <= N. Subir so o `connection_limit` nao acelera
   * NADA — um laco com `await` a cada iteracao usa uma conexao por vez, seja o
   * pool de 1 ou de 20. Ja com C <= N nao ha fila, o `pool_timeout` sai da
   * conta e o limiar deixa de depender da latencia. Enquanto a URL disser
   * `connection_limit=1`, a serie e a unica forma correta.
   */
  for (const cidade of divergentes) {
    await prisma.city.update({
      where: { ibgeCode: cidade.ibgeCode },
      data: { name: cidade.name, stateId: cidade.stateId },
    });
  }

  return criados;
}

/**
 * A carga NAO e envolvida em uma transacao interativa unica: ~5.600 insercoes
 * sob o pooler do Supabase estourariam o tempo limite padrao do
 * `prisma.$transaction`. Nao e preciso: cada lote e atomico por si, e a carga
 * inteira e idempotente — uma execucao interrompida no meio e resolvida
 * simplesmente rodando de novo, que insere apenas o que faltou.
 */
export async function seedGeography(prisma: PrismaClient): Promise<ResumoDaCargaGeografica> {
  const estados = lerRecorte();

  const { criados: statesCreated, idPorUf } = await semearEstados(prisma, estados);
  const citiesCreated = await semearMunicipios(prisma, estados, idPorUf);

  return { statesCreated, citiesCreated };
}

/**
 * Execucao direta (`npm run db:seed:geography`). O guarda garante que este bloco
 * NAO roda quando `prisma/seed.ts` importa o modulo.
 *
 * FORA DA METRICA DE COBERTURA, pela MESMA razao ja registrada no `jest.config.ts`
 * para o `src/index.ts`: e o ponto de entrada do PROCESSO, e nao ha o que
 * exercitar nele sem executar o processo de verdade. Sob Jest o modulo e sempre
 * importado, entao `require.main === module` e sempre falso e o bloco inteiro —
 * o `if`, o `then` e o `catch` — fica permanentemente descoberto, puxando para
 * baixo a metrica de um arquivo cuja LOGICA (validacao do recorte, loteamento,
 * serializacao das escritas e idempotencia) esta coberta por
 * `tests/unit/geography.seed.spec.ts`.
 *
 * A alternativa seria executa-lo em subprocesso, o que abriria conexao com o
 * Postgres — proibido pela TASK-BACKEND-011, que exige que a suite passe com a
 * rede desligada.
 *
 * A anotacao vale SO para este bloco: `seedGeography`, logo acima, continua
 * dentro da metrica.
 */
/* istanbul ignore next -- ponto de entrada de processo; ver comentario acima */
if (require.main === module) {
  void seedGeography(prismaCompartilhado)
    .then((resumo) => {
      console.info(
        `[catdog-backend] Geografia semeada: ${resumo.statesCreated} estado(s) e ` +
          `${resumo.citiesCreated} municipio(s) criados nesta execucao.`,
      );
    })
    .catch((motivo: unknown) => {
      console.error(
        '[catdog-backend] Carga de estados e municipios falhou:',
        motivo instanceof Error ? motivo.message : motivo,
      );

      process.exitCode = 1;
    })
    .finally(() => prismaCompartilhado.$disconnect());
}
