import { toAnimalResponse, type AnimalResponse } from '~/domains/animals/mappers/animal.mapper';
import type { AnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { now } from '~/utils/clock';

/**
 * Caso de uso: listar animais para a area administrativa (RN-41, RN-42).
 *
 * PAGINADO NO SERVIDOR desde a primeira entrega (Decisao 8 do changelog). O
 * argumento que dispensou a paginacao na FEATURE-001 deste modulo — dezenas de
 * registros em tabela de apoio — nao se transfere: o animal e a entidade de
 * maior volume do produto e cresce sem teto, e acrescentar paginacao depois
 * quebraria o contrato do endpoint e os testes que ja o consomem.
 *
 * SEM busca, filtro ou ordenacao configuravel (RN-42b): os tres pertencem a
 * feature de filtragem da vitrine.
 */

/**
 * Teto do `skip` enviado ao banco. `page` NAO tem teto — ver `execute`.
 *
 * `Number.MAX_SAFE_INTEGER` e o maior inteiro que o JavaScript representa sem
 * perda: acima dele o proprio `Number` ja deixa de distinguir uma pagina da
 * seguinte, entao nao ha recorte a preservar. Ele cabe com folga no inteiro de
 * 64 bits do Postgres (9.007e15 contra 9.223e18), que e o limite que o Prisma
 * verifica antes de emitir a consulta, e esta muitas ordens de grandeza acima de
 * qualquer contagem de `animals` concebivel — saturar aqui NUNCA pode esconder
 * uma linha existente, so pode adiantar a pagina vazia que a consulta devolveria
 * de qualquer forma.
 */
const SKIP_MAXIMO = Number.MAX_SAFE_INTEGER;

/**
 * `page` e `pageSize` chegam JA coagidos a numero e JA dentro da faixa,
 * garantidos por `listAnimalsQuerySchema` no `validateRequest`. O service nao
 * revalida nem reaplica padrao: duplicar a regra aqui criaria um segundo lugar
 * onde ela pode divergir.
 */
export interface ListAnimalsInput {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Metadados da pagina (RN-42a). `total` e o da COLECAO INTEIRA, nao o da pagina:
 * e ele que a interface compara com `pageSize` para decidir se exibe controles
 * de navegacao — por isso a captura com um unico animal nao os mostra e mesmo
 * assim esta em conformidade.
 */
export interface AnimalPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * Envelope `{ items: [...] }` da FEATURE-001 deste modulo, ESTENDIDO de forma
 * ADITIVA com `pagination`: quem ja consome `items` nao e afetado.
 *
 * Montado no SERVICE e nao no controller, como em `list-states.service.ts`: o
 * contrato desta task fixa a assinatura do caso de uso com o envelope pronto, e
 * isso mantem o handler reduzido a repassar o que o service devolveu, sem
 * decisao de formato dividida entre duas camadas.
 */
export interface ListAnimalsResult {
  readonly items: ReadonlyArray<AnimalResponse>;
  readonly pagination: AnimalPagination;
}

export class ListAnimalsService {
  constructor(private readonly animals: AnimalRepository) {}

  /**
   * CADASTRO VAZIO responde `items: []` e `total: 0` — NUNCA um erro (CT-29).
   * "Nenhum animal cadastrado" e um estado legitimo do recurso, e quem o
   * transforma em texto na tela e o frontend; um `404` aqui faria o cliente
   * tratar colecao vazia como rota inexistente.
   *
   * PAGINA ALEM DO TOTAL tambem responde `200` com `items: []` e o `total` REAL,
   * e nao um erro: pedir a pagina 9 de um cadastro com 40 animais e uma pergunta
   * legitima cuja resposta e "nao ha nada aqui, e existem 40 registros ao todo".
   * E o `total` que permite a interface se recuperar sozinha, voltando a uma
   * pagina que existe.
   */
  async execute(entrada: ListAnimalsInput): Promise<ListAnimalsResult> {
    /**
     * `page` e base UM no contrato e `skip` e base ZERO no banco. A conversao
     * vive AQUI, no unico ponto que conhece as duas convencoes — deixa-la no
     * repositorio faria a porta falar de paginas, e no controller faria a camada
     * HTTP calcular recorte de consulta.
     *
     * SATURADO, e nao recusado na validacao. O produto `(page - 1) * pageSize`
     * cresce sem limite e estoura o inteiro de 64 bits do `skip`, e o Prisma
     * recusa o valor ANTES de falar com o banco — `?page=1e19` respondia `500`,
     * entrada de usuario virando falha de infraestrutura. O limiar medido era
     * `skip > 2^63−1`: `?page=460000000000000000` respondia `200` e
     * `?page=470000000000000000` respondia `500`.
     *
     * O teto fica no `skip` e NAO em `page` porque um teto em `page` mudaria o
     * contrato: "pagina alem do total" ja e uma pergunta legitima que responde
     * `200` com `items: []` e o `total` real — a spec nao pede teto algum —, e
     * capa-la faria duas requisicoes que diferem SO em magnitude responderem
     * `400` e `200`, com a fronteira desenhada num detalhe de armazenamento em
     * vez de numa regra de negocio. O texto de `INVALID_PAGE` ("inteiro maior ou
     * igual a 1") tambem deixaria de ser verdadeiro, e ele e comparado
     * caractere a caractere pelos criterios de aceite.
     *
     * `Math.min` tambem cobre o `Infinity` que o proprio produto produz quando
     * `page` se aproxima do maior `double` finito.
     */
    const skip = Math.min((entrada.page - 1) * entrada.pageSize, SKIP_MAXIMO);

    const pagina = await this.animals.listPaginated({ skip, take: entrada.pageSize });

    /**
     * UMA leitura do relogio para a pagina INTEIRA, e nao uma por item.
     *
     * Duas razoes: a virada de meia-noite no meio do `map` faria dois animais
     * nascidos no mesmo dia sairem com idades diferentes na MESMA resposta; e o
     * teste que fixa o instante espiona uma unica chamada, nao vinte.
     */
    const instante = now();

    return {
      items: pagina.items.map((animal) => toAnimalResponse(animal, instante)),
      pagination: {
        page: entrada.page,
        pageSize: entrada.pageSize,
        total: pagina.total,
      },
    };
  }
}
