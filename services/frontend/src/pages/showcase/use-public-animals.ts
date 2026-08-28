import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '~/services/api/api-error';
import * as catalogApi from '~/services/api/catalog-api';
import type { PublicAnimal, PublicAnimalFilters } from '~/services/api/catalog-api';
import { MESSAGES } from '~/utils/messages';

/**
 * ESTADO DISCRIMINADO por união, e não três booleanos independentes.
 *
 * Com `carregando`, `erro` e `dados` soltos, o estado `carregando && erro` e
 * REPRESENTAVEL — e e assim que uma tela passa a exibir o esqueleto e a mensagem
 * de falha ao mesmo tempo. Aqui a combinacao nao existe.
 */
export type PublicAnimalsState =
  | { readonly tipo: 'carregando' }
  | {
      readonly tipo: 'pronto';
      readonly items: readonly PublicAnimal[];
      readonly pagination: { readonly page: number; readonly pageSize: number; readonly total: number };
    }
  | { readonly tipo: 'erro'; readonly mensagem: string };

export interface PublicAnimalsResult {
  readonly state: PublicAnimalsState;
  readonly retry: () => void;
}

/**
 * A consulta da vitrine.
 *
 * ============ NADA AQUI LE `useAuth()` ============
 *
 * A consulta dispara na MONTAGEM, sem esperar a restauracao da sessao (RN-04,
 * CA-04, CT-07). Uma vitrine que espera o bootstrap para carregar deixa de ser
 * publica na pratica: o visitante anonimo veria um esqueleto enquanto a aplicacao
 * tenta renovar um token que ele nao tem.
 *
 * ============ DESCARTE DE RESPOSTA OBSOLETA POR SEQUENCIA ============
 *
 * O cliente HTTP do projeto NAO oferece `AbortSignal`, e esta feature nao o
 * altera (Decisao E). Entao o descarte e da tela: um contador em `ref` e
 * incrementado a cada disparo, e a resposta so e aplicada se a sequencia dela
 * ainda for a maior (RN-53, CA-18, CT-36).
 *
 * Sem isso, o visitante que digita "gato" e depois apaga para "ga" pode ver o
 * resultado de "gato" com "ga" no campo — e nao ha erro nenhum na tela para
 * explicar. E o mesmo principio da guarda de corrida das cidades na FEATURE-002.
 *
 * `ref` e nao estado: o valor precisa ser lido pelo closure da resposta no
 * instante em que ela CHEGA, e nao no da renderizacao em que a requisicao partiu.
 */
export function usePublicAnimals(filters: PublicAnimalFilters): PublicAnimalsResult {
  const [state, setState] = useState<PublicAnimalsState>({ tipo: 'carregando' });
  const sequencia = useRef(0);
  const [tentativa, setTentativa] = useState(0);

  /**
   * A chave de comparacao dos filtros, e nao o objeto: `toApiFilters` devolve um
   * objeto novo a cada render, e depender dele redispararia a consulta em laco.
   */
  const chaveDosFiltros = JSON.stringify(filters);

  useEffect(() => {
    sequencia.current += 1;

    const minhaSequencia = sequencia.current;

    setState({ tipo: 'carregando' });

    catalogApi
      .listPublicAnimals(JSON.parse(chaveDosFiltros) as PublicAnimalFilters)
      .then((pagina) => {
        // A guarda: aplica SO se esta ainda for a consulta mais recente.
        if (sequencia.current !== minhaSequencia) {
          return;
        }

        setState({ tipo: 'pronto', items: pagina.items, pagination: pagina.pagination });
      })
      .catch((motivo: unknown) => {
        if (sequencia.current !== minhaSequencia) {
          return;
        }

        /**
         * A mensagem do backend quando ela existe — e o caso do `429`, cuja frase
         * em PT-BR e escrita la e nao pode ser reinventada aqui. Ramificar pelo
         * `code`, JAMAIS pelo texto (RN-67, CA-39, CT-95, CT-108).
         */
        setState({
          tipo: 'erro',
          mensagem: motivo instanceof ApiError ? motivo.message : MESSAGES.ANIMALS.LOAD_ERROR,
        });
      });
  }, [chaveDosFiltros, tentativa]);

  const retry = useCallback(() => {
    setTentativa((atual) => atual + 1);
  }, []);

  return { state, retry };
}
