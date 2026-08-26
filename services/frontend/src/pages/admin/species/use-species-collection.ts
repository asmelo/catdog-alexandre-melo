import { useCallback, useEffect, useRef, useState } from 'react';

import * as speciesApi from '~/services/api/species-api';
import type { Species } from '~/services/api/species-api';

/**
 * Estado da COLECAO de especies da tela `/admin/especies`.
 *
 * Uma fatia por informacao (`species` e `status`), e nao um objeto unico de
 * estado: as duas mudam em momentos diferentes — `status` volta a `'carregando'`
 * a cada nova tentativa, enquanto `species` so muda quando ha lista nova ou
 * escrita local — e junta-las obrigaria cada `set` a reescrever a outra metade.
 *
 * O hook NAO conhece formulario, mensagem de sucesso nem confirmacao de
 * exclusao: ele guarda a lista e as quatro operacoes que a mexem. Quem decide o
 * que exibir e a tela.
 */

/**
 * Os tres estados de carga da HU-03, em uniao literal e nao em booleanos.
 *
 * Com `carregando`/`erro` como dois booleanos existiriam combinações impossiveis
 * (carregando E com erro) e o compilador nao teria como cobrar exaustividade na
 * tela. Mesma decisao ja registrada no `EstadoDaConfirmacao` de
 * `confirm-email-page.tsx`.
 */
export type SpeciesCollectionStatus = 'carregando' | 'pronto' | 'erro';

/**
 * Uma escrita LOCAL sobre a lista, na forma de transformacao pura.
 *
 * E o mesmo formato do atualizador funcional do `useState`, e nao por acaso: a
 * escrita e aplicada ao estado atual (`setSpecies(escrita)`) E guardada para
 * poder ser REAPLICADA sobre o retrato que a listagem em voo ainda vai trazer.
 * Guardar a operacao, e nao o resultado dela, e o que permite as duas coisas com
 * uma unica declaracao.
 */
type EscritaLocal = (lista: ReadonlyArray<Species>) => ReadonlyArray<Species>;

export interface SpeciesCollection {
  readonly species: ReadonlyArray<Species>;
  readonly status: SpeciesCollectionStatus;
  /** Refaz `GET /api/species`. E tambem o `onRetry` do estado de falha (CT-36). */
  readonly recarregar: () => void;
  readonly adicionar: (especie: Species) => void;
  readonly substituir: (especie: Species) => void;
  readonly remover: (id: string) => void;
}

/**
 * Criterio de ordenacao da RN-11 — POR LOCALE, nunca binario.
 *
 * `localeCompare('pt-BR')` e nao `<`/`>`: a ordenacao do servidor
 * (`ORDER BY name_normalized`) roda sobre PostgreSQL 17.6 com provedor ICU e
 * `en_US.UTF-8`, medido no banco de desenvolvimento, e devolve
 * `Ágil, Cão, Cavalo, Gato, Zebra`. A comparacao binaria de string devolveria
 * `Cavalo, Cão, Gato, Zebra, Ágil`, jogando todo nome acentuado para o fim.
 *
 * A divergencia so aparece com acento — com nomes ASCII os dois criterios
 * coincidem —, e a propria spec usa "Cão", "Réptil" e "Pássaro". Errar aqui faria
 * a posicao do item recem-criado saltar no proximo recarregamento (CT-13 /
 * CT-14 / CA-04).
 *
 * `toLowerCase()` dos DOIS lados porque a RN-11 ignora caixa: "Cachorro" vem
 * antes de "gato".
 */
function compararPorNome(especie: Species, outra: Species): number {
  return especie.name.toLowerCase().localeCompare(outra.name.toLowerCase(), 'pt-BR');
}

/**
 * Devolve a lista com `especie` na posicao alfabetica correta.
 *
 * Remove antes de inserir, e a remocao por `id` e o que torna esta funcao util
 * para as DUAS escritas: na criacao o `id` e inedito e o `filter` nao tira nada;
 * na renomeacao ele existe, sai da posicao antiga e volta na nova. Sem a
 * remocao, renomear duplicaria a linha.
 *
 * `findIndex` + `slice` e nao indexacao por numero: com
 * `noUncheckedIndexedAccess` cada acesso por indice viria como
 * `Species | undefined` e exigiria uma guarda que nao descreve nada.
 */
function inserirEmOrdem(
  lista: ReadonlyArray<Species>,
  especie: Species,
): ReadonlyArray<Species> {
  const semAVersaoAnterior = lista.filter((item) => item.id !== especie.id);
  const posicao = semAVersaoAnterior.findIndex((item) => compararPorNome(especie, item) < 0);

  if (posicao < 0) {
    return [...semAVersaoAnterior, especie];
  }

  return [
    ...semAVersaoAnterior.slice(0, posicao),
    especie,
    ...semAVersaoAnterior.slice(posicao),
  ];
}

export function useSpeciesCollection(): SpeciesCollection {
  const [species, setSpecies] = useState<ReadonlyArray<Species>>([]);
  const [status, setStatus] = useState<SpeciesCollectionStatus>('carregando');

  /**
   * Trava de mount, e nao trava de listagem: ela impede a SEGUNDA montagem do
   * `<StrictMode>` do React 18 de disparar um segundo `GET /api/species` em
   * desenvolvimento. `recarregar` continua livre para ser chamado quantas vezes
   * o usuario acionar "Tentar novamente" — o que a trava cobre e exclusivamente
   * o efeito de entrada. Mesmo cuidado ja registrado em `confirm-email-page.tsx`
   * e no `bootstrapIniciado` do `AuthProvider`.
   */
  const listagemJaIniciada = useRef(false);

  /**
   * SEQUENCIAMENTO DAS LISTAGENS — parte 1 de 2 do conserto da corrida.
   *
   * Identidade da listagem mais recente ja disparada. Cada chamada de
   * `recarregar` toma o proximo numero e so aplica a propria resposta se ainda
   * for a dona deste contador; uma listagem ultrapassada por outra e descartada
   * inteira, resposta e falha. Sem isso, duas listagens em voo terminariam pela
   * ordem de chegada da rede, e nao pela ordem em que foram pedidas.
   *
   * Numero de sequencia e nao `AbortController`: cancelar de verdade exigiria um
   * `signal` atravessando `speciesApi.listSpecies` ate o `fetch` do
   * `http-client.ts`, e nenhum dos dois esta no escopo desta correcao. Sem esse
   * caminho, o `AbortController` viraria exatamente este contador, so que mais
   * caro — a requisicao continuaria em voo e o descarte continuaria sendo feito
   * aqui, na resolucao.
   */
  const listagemMaisRecente = useRef(0);

  /**
   * SEQUENCIAMENTO DAS LISTAGENS — parte 2 de 2.
   *
   * Escritas locais ocorridas DEPOIS da partida da listagem em voo. O contador
   * acima sozinho nao resolve a corrida do achado: quem envelhece a resposta ali
   * nao e uma listagem mais nova, e sim um `POST` que concluiu no meio do voo —
   * a listagem continua sendo a mais recente e passaria pelo teste de
   * identidade, sobrescrevendo com um retrato ANTERIOR a criacao.
   *
   * Por isso a resposta nao e aplicada crua: as escritas registradas aqui sao
   * REAPLICADAS sobre `resposta.items`. Descartar a resposta inteira tambem
   * salvaria a especie recem-criada, mas jogaria fora todas as outras que a
   * listagem trouxe; reaplicar preserva as duas metades.
   *
   * Zerado na PARTIDA de cada listagem: o que ja esta refletido no retrato do
   * servidor nao pode ser aplicado de novo.
   */
  const escritasDesdeAPartida = useRef<ReadonlyArray<EscritaLocal>>([]);

  /**
   * A falha vira `status: 'erro'` e NAO sobe: quem chama e um efeito de mount ou
   * um botao de nova tentativa, e nenhum dos dois tem como tratar uma excecao.
   *
   * A `message` do `ApiError` e DESCARTADA de proposito. A falha de carga exibe
   * `MESSAGES.SPECIES.LOAD_ERROR`, que e orientacao de acao ("Tente novamente.")
   * e nao repeticao do erro do servidor — guardar a mensagem aqui criaria um
   * estado que a tela nao usa.
   *
   * `useCallback` com dependencias vazias: a identidade precisa ser estavel
   * porque ela e dependencia do efeito abaixo e vai como `onRetry` para o
   * `ErrorState`.
   */
  const recarregar = useCallback((): void => {
    const minhaListagem = listagemMaisRecente.current + 1;
    listagemMaisRecente.current = minhaListagem;
    escritasDesdeAPartida.current = [];

    setStatus('carregando');

    void speciesApi
      .listSpecies()
      .then((resposta) => {
        if (minhaListagem !== listagemMaisRecente.current) {
          return;
        }

        // As escritas locais do intervalo voltam POR CIMA do retrato do servidor,
        // na ordem em que aconteceram. Zerar antes de aplicar, e nao depois,
        // porque `inserirEmOrdem` remove por `id` antes de inserir: reaplicar a
        // mesma escrita duas vezes seria inofensivo, mas deixar a lista pendente
        // faria a PROXIMA listagem herdar escritas que ela ja traz.
        const escritas = escritasDesdeAPartida.current;
        escritasDesdeAPartida.current = [];

        // `resposta.items`, e nao `resposta`: `listSpecies` devolve o ENVELOPE de
        // colecao inteiro de proposito, para poder ganhar metadados sem quebrar
        // os chamadores. Desembrulhar e responsabilidade de quem consome.
        setSpecies(
          escritas.reduce<ReadonlyArray<Species>>(
            (lista, escrita) => escrita(lista),
            resposta.items,
          ),
        );
        setStatus('pronto');
      })
      .catch(() => {
        if (minhaListagem !== listagemMaisRecente.current) {
          return;
        }

        setStatus('erro');
      });
  }, []);

  useEffect(() => {
    if (listagemJaIniciada.current) {
      return;
    }

    listagemJaIniciada.current = true;
    recarregar();
  }, [recarregar]);

  /**
   * PONTO UNICO por onde toda escrita local passa.
   *
   * Registra a escrita para reaplicacao E a aplica ao estado — as duas coisas,
   * sempre. Se alguma das tres operacoes chamasse `setSpecies` direto, ela
   * voltaria a ser apagavel por uma listagem em voo, que e exatamente o defeito
   * corrigido aqui.
   *
   * A escrita e guardada como FUNCAO, e nao como resultado: e a mesma forma do
   * atualizador do `useState`, entao aplicar e `setSpecies(escrita)`, e reaplicar
   * sobre o retrato do servidor e chamar a mesma funcao com outra lista.
   */
  const escrever = useCallback((escrita: EscritaLocal): void => {
    escritasDesdeAPartida.current = [...escritasDesdeAPartida.current, escrita];
    setSpecies(escrita);
  }, []);

  /**
   * UMA implementacao para `adicionar` e `substituir`, exposta sob os dois nomes.
   *
   * As duas operacoes sao literalmente a mesma: colocar uma versao da especie na
   * posicao alfabetica que o nome dela pede, tirando da lista qualquer versao
   * anterior do mesmo `id`. Escrever duas funcoes identicas so criaria duas
   * copias para divergirem na primeira revisao do criterio de ordenacao.
   *
   * Os dois nomes existem porque descrevem intencoes diferentes no ponto de uso —
   * `adicionar` depois de um `POST`, `substituir` depois de um `PATCH` — e porque
   * a TASK-FRONTEND-010 ja depende dessa assinatura.
   *
   * NENHUMA das tres escritas refaz a listagem: o RNF-05 pede reflexo em menos de
   * um segundo, e uma ida extra ao servidor por escrita dobraria o custo de uma
   * tela que a spec descreve como de dezenas de registros.
   */
  const inserirEmOrdemAlfabetica = useCallback(
    (especie: Species): void => {
      escrever((atual) => inserirEmOrdem(atual, especie));
    },
    [escrever],
  );

  const remover = useCallback(
    (id: string): void => {
      escrever((atual) => atual.filter((item) => item.id !== id));
    },
    [escrever],
  );

  return {
    species,
    status,
    recarregar,
    adicionar: inserirEmOrdemAlfabetica,
    substituir: inserirEmOrdemAlfabetica,
    remover,
  };
}
