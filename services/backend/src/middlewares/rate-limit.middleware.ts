import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { env } from '~/config/env';
import { AppError } from '~/shared/errors/app-error';
import { HTTP_STATUS } from '~/shared/http/http-status';

/**
 * Throttling dos endpoints de credencial.
 *
 * A RN-05 impede ENUMERACAO (as respostas nao dizem se o e-mail existe), mas nao
 * impede FORCA BRUTA: sem limite, um atacante testa milhares de senhas contra um
 * e-mail conhecido recebendo sempre o mesmo 401. Endpoint de autenticacao sem
 * throttling e achado recorrente de OWASP e do perfil do Sonar.
 *
 * Store em memoria por decisao arquitetural: a aplicacao roda em UMA instancia e
 * o volume e baixissimo ("pouco volume de uso", em
 * `.makuco/architecture/tech_restrictions_context.md`). Um Redis dedicado seria
 * exatamente o "componente desnecessario" que a mesma restricao proibe. A
 * consequencia honesta: o contador zera a cada reinicio do processo e, se algum
 * dia houver mais de uma instancia, o limite efetivo passa a ser 5 por instancia
 * — o dia em que isso mudar, o store precisa mudar junto.
 */

/**
 * 429 no envelope padrao. Declarado como `AppError` e entregue ao `next()`, e
 * NAO respondido aqui: o `error-handler.middleware.ts` continua sendo o unico
 * ponto do projeto que monta corpo de erro, e por isso o 429 sai byte a byte no
 * mesmo formato `{ error: { code, message } }` de todos os outros erros — sem
 * repetir a montagem do envelope neste arquivo, onde ela poderia divergir.
 *
 * Sem a classe, a alternativa seria o JSON default da lib
 * (`"Too many requests, please try again later."`, texto em ingles e fora do
 * envelope), que o frontend nao sabe ler.
 */
class TooManyRequestsError extends AppError {
  constructor() {
    super(
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'TOO_MANY_REQUESTS',
    );
  }
}

const SEGUNDO_EM_MS = 1000;
const MINUTO_EM_MS = 60 * SEGUNDO_EM_MS;

/**
 * Mesma normalizacao que o `emailSchema` de `auth.validators.ts` aplica
 * (`.trim()` + `.toLowerCase()`), e por um motivo de seguranca, nao de estilo:
 * os limiters rodam ANTES do `validateRequest` (para barrar a requisicao abusiva
 * sem custo de parsing de schema), logo o corpo que chega aqui esta parseado pelo
 * `express.json` mas AINDA NAO normalizado. Usando o e-mail cru, `A@x.com` e
 * `a@x.com` cairiam em contadores diferentes e o limite de login seria burlado
 * so trocando a caixa das letras a cada tentativa.
 */
const corpoComEmailSchema = z.object({ email: z.string().trim().toLowerCase() });

/**
 * `req.body` e tipado como `any` pelo Express; a atribuicao para `unknown` e o
 * `safeParse` impedem esse `any` de entrar no fluxo. Corpo ausente, sem `email`
 * ou com `email` nao textual devolve string vazia — a chave fica sendo so o IP,
 * que e o comportamento correto para uma requisicao que nem chegou a dizer qual
 * conta esta tentando.
 */
function emailNormalizadoDoCorpo(requisicao: Request): string {
  const corpo: unknown = requisicao.body;
  const resultado = corpoComEmailSchema.safeParse(corpo);

  return resultado.success ? resultado.data.email : '';
}

/** Separador que nao ocorre em endereco IP nem em e-mail valido. */
const SEPARADOR_DE_CHAVE = '|';

/**
 * `ipKeyGenerator` da propria lib, e NAO `requisicao.ip` cru — e a mesma funcao
 * que a chave default da v8 usa, com a mesma sub-rede (/56).
 *
 * Medido nesta maquina, que tem IPv6 global: IPv4 sai inteiro
 * (`127.0.0.1` -> `127.0.0.1`), endereco IPv4 mapeado e desmapeado
 * (`::ffff:192.168.0.7` -> `192.168.0.7`) e IPv6 sai como prefixo
 * (`2804:14d:1:0:abcd:1:2:3` -> `2804:14d:1::/56`). O ultimo caso e o que
 * importa: um provedor entrega um bloco inteiro a um assinante, entao com o IP
 * cru bastaria trocar de endereco dentro do proprio bloco a cada tentativa para
 * o contador nunca encher. Agrupar por prefixo custa alguma cota compartilhada
 * entre vizinhos e fecha o desvio.
 */
function chaveDeIpComEmail(requisicao: Request): string {
  const ip = ipKeyGenerator(requisicao.ip ?? '');

  return `${ip}${SEPARADOR_DE_CHAVE}${emailNormalizadoDoCorpo(requisicao)}`;
}

interface ConfiguracaoDoLimitador {
  readonly windowMs: number;
  readonly limit: number;
  /** Ausente = chave default da lib, que ja e o IP tratado para IPv6. */
  readonly keyGenerator?: (requisicao: Request) => string;
}

/**
 * Middleware transparente. Existe porque `RATE_LIMIT_ENABLED=false` precisa
 * significar "nenhum 429 em nenhuma circunstancia" — e a suite de integracao da
 * TASK-BACKEND-007, que dispara dezenas de logins seguidos, estouraria o limite
 * de 5 e passaria a falhar por 429 em vez de testar a regra que pretende testar.
 */
const SEM_LIMITE: RequestHandler = (_requisicao, _resposta, proximo) => {
  proximo();
};

/**
 * O interruptor e avaliado UMA vez, na montagem: quando o limite esta desligado
 * a lib nem e instanciada, entao nao ha store em memoria nem contagem ocorrendo
 * em segundo plano.
 */
function criarLimitador(configuracao: ConfiguracaoDoLimitador): RequestHandler {
  if (!env.RATE_LIMIT_ENABLED) {
    return SEM_LIMITE;
  }

  return rateLimit({
    windowMs: configuracao.windowMs,
    limit: configuracao.limit,
    ...(configuracao.keyGenerator === undefined
      ? {}
      : { keyGenerator: configuracao.keyGenerator }),
    /**
     * Sem `RateLimit-*` nem `X-RateLimit-*`: publicar o saldo restante diria a
     * quem esta sondando exatamente quantas tentativas faltam para o bloqueio,
     * informacao que hoje ele so obtem gastando requisicoes. O cliente legitimo
     * nao precisa do numero — ele recebe a mensagem em PT-BR e para.
     */
    standardHeaders: false,
    legacyHeaders: false,
    handler: (_requisicao, _resposta, proximo) => {
      proximo(new TooManyRequestsError());
    },
  });
}

/**
 * RN-05 protege a resposta; este limite protege a senha. 5 tentativas por
 * 15 minutos para o par (sub-rede, e-mail): erra a senha tres, quatro vezes e o
 * usuario legitimo ainda tem folga, enquanto o ataque de dicionario morre na
 * sexta.
 */
export const loginLimiter: RequestHandler = criarLimitador({
  windowMs: 15 * MINUTO_EM_MS,
  limit: 5,
  keyGenerator: chaveDeIpComEmail,
});

/**
 * Chave so por IP, e nao por e-mail: o abuso do cadastro e criar MUITAS contas,
 * cada uma com um e-mail diferente — uma chave que incluisse o e-mail daria
 * cota nova a cada tentativa e nao limitaria nada. Janela longa (60 min) porque
 * cadastro legitimo e evento raro por pessoa.
 */
export const registerLimiter: RequestHandler = criarLimitador({
  windowMs: 60 * MINUTO_EM_MS,
  limit: 5,
});

/**
 * O mais restritivo (3 por hora): cada chamada bem-sucedida dispara um e-mail
 * real, entao o abuso aqui usa o servidor como ferramenta de spam contra um
 * terceiro cujo endereco o atacante digitou. A chave inclui o e-mail justamente
 * para que o alvo seja protegido, e nao apenas o remetente contido.
 */
export const resendLimiter: RequestHandler = criarLimitador({
  windowMs: 60 * MINUTO_EM_MS,
  limit: 3,
  keyGenerator: chaveDeIpComEmail,
});

/**
 * Folgado de proposito (20 por minuto): a renovacao e automatica e uma aba
 * legitima pode dispara-la varias vezes em sequencia. O limite existe contra
 * varredura de cookie, nao contra uso normal — e uma janela curta faz o cliente
 * legitimo se recuperar rapido.
 */
export const refreshLimiter: RequestHandler = criarLimitador({
  windowMs: MINUTO_EM_MS,
  limit: 20,
});

/**
 * VITRINE PUBLICA — 60 requisicoes por minuto por IP.
 *
 * ============ POR QUE ESTE ENDPOINT TEM LIMITADOR, E OS OUTROS NAO ============
 *
 * As FEATURE-001 e FEATURE-002 deste modulo dispensaram limitador com um
 * argumento explicito: "os limitadores do projeto protegem endpoints de
 * credencial contra forca bruta e contra uso do servidor como ferramenta de spam;
 * nenhum dos dois riscos existe num CRUD administrativo autenticado".
 *
 * O ARGUMENTO NAO SE TRANSFERE PARA CA, e por duas razoes independentes:
 *
 * 1. Nao ha credencial nenhuma. E leitura ANONIMA — nao existe sessao a
 *    autenticar, nem conta a bloquear, nem administrador a castigar. Quem abusa
 *    e um IP qualquer da internet.
 * 2. A busca e a consulta MAIS CARA do catalogo. `contains` casa conteudo em
 *    QUALQUER posicao da cadeia, o que nao se beneficia de indice B-tree: cada
 *    busca e uma varredura sobre `animals` cruzada com `cities`. Uma rota publica
 *    que dispara varredura sem custo para quem chama e um amplificador.
 *
 * ============ POR QUE 60/MIN, E POR QUE ELE NAO ATRAPALHA ============
 *
 * A navegacao humana da vitrine — digitar na busca, trocar de filtro, paginar —
 * produz alguns pedidos por segundo em rajada e depois silencio. Sessenta por
 * minuto cobre isso com folga, inclusive para varios visitantes atras da MESMA
 * saida de rede (um escritorio, uma operadora movel), que compartilham o IP
 * (CT-109, RNF-05).
 *
 * ============ NENHUM MECANISMO NOVO ============
 *
 * Mesma fabrica, mesma `MemoryStore`, mesmo `standardHeaders: false`, mesmo
 * desligamento por `RATE_LIMIT_ENABLED` e mesmo `TooManyRequestsError` no
 * envelope padrao. Nenhum codigo de erro novo nasce nesta feature.
 *
 * Chave DEFAULT da lib — o IP ja tratado para IPv6 —, e nao `chaveDeIpComEmail`:
 * a requisicao e `GET` e nao tem corpo de onde tirar um segundo componente.
 */
export const catalogLimiter: RequestHandler = criarLimitador({
  windowMs: MINUTO_EM_MS,
  limit: 60,
});
