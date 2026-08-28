import { useCallback, useEffect, useRef, useState } from 'react';

import type { City, State } from '~/domains/animals/animal.types';
import * as geographyApi from '~/services/api/geography-api';

/**
 * Encadeamento estado -> cidade do formulario de animal (RN-26a, RN-56, RN-57,
 * RN-58).
 *
 * ==================== POR QUE ISTO E UM HOOK PROPRIO ====================
 *
 * Sao quatro regras entrelacadas, e nenhuma delas e sobre layout: a guarda de
 * corrida, o descarte da cidade ao trocar de estado, a preservacao da cidade
 * gravada que nao consta da lista e a falha que nao pode se parecer com lista
 * vazia. Deixadas dentro do componente do formulario, elas se misturariam com
 * quinze campos de estado e a guarda de corrida — a mais sutil das quatro —
 * seria a primeira a se perder numa refatoracao.
 */

export type CitiesStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface StateCities {
  readonly states: ReadonlyArray<State>;
  readonly statesError: boolean;
  readonly cities: ReadonlyArray<City>;
  readonly citiesStatus: CitiesStatus;
  readonly selectedUf: string;
  readonly selectUf: (uf: string) => void;
  readonly retryCities: () => void;
  readonly retryStates: () => void;
}

export interface StateCitiesOptions {
  /** UF ja gravada, na edicao. Dispara a carga inicial de cidades. */
  readonly initialUf?: string;
  /** Chamado quando a troca de estado DESCARTA a cidade escolhida. */
  readonly onCityDiscarded: () => void;
}

export function useStateCities(opcoes: StateCitiesOptions): StateCities {
  const { initialUf = '', onCityDiscarded } = opcoes;

  const [states, setStates] = useState<ReadonlyArray<State>>([]);
  const [statesError, setStatesError] = useState(false);
  const [cities, setCities] = useState<ReadonlyArray<City>>([]);
  const [citiesStatus, setCitiesStatus] = useState<CitiesStatus>('idle');
  const [selectedUf, setSelectedUf] = useState(initialUf);

  /**
   * A UF da requisicao MAIS RECENTE.
   *
   * ===================== A GUARDA DE CORRIDA (RN-57) =====================
   *
   * O administrador escolhe "PR" e, um segundo depois, "ES". As duas requisicoes
   * saem; nada garante a ordem de chegada. Se a de "PR" voltar POR ULTIMO e for
   * aplicada, o campo passa a listar municipios do Parana com "ES" selecionado —
   * e o administrador grava a cidade errada acreditando que gravou a certa. Nao
   * ha erro na tela, nao ha erro no servidor: o dado sai errado em silencio.
   *
   * `ref` e nao estado: o valor precisa ser lido pelo closure da resposta no
   * instante em que ela chega, e nao no da renderizacao em que a requisicao
   * partiu. Um estado daria ao closure o valor de quando ele foi criado, que e
   * exatamente o valor obsoleto que a guarda existe para descartar.
   */
  const ufEmVoo = useRef(initialUf);

  /**
   * Contador de tentativas da carga de estados. Trocar de valor e o que faz o
   * efeito rodar de novo — `retryStates` nao pode chamar a API direto, porque a
   * requisicao em voo precisa da mesma guarda de desmonte (`ativo`) que a
   * primeira, e ela vive dentro do efeito.
   */
  const [tentativaDeEstados, setTentativaDeEstados] = useState(0);

  useEffect(() => {
    let ativo = true;

    setStatesError(false);

    void geographyApi
      .listStates()
      .then((resposta) => {
        if (ativo) {
          setStates(resposta.items);
        }
      })
      .catch(() => {
        if (ativo) {
          /**
           * FALHA EXPLICITA, e nao lista vazia — mesma razao registrada abaixo
           * para as cidades: um campo Estado sem opcoes se le como "nao ha
           * estados", que e absurdo, e deixa o administrador sem entender por que
           * nao consegue escolher a cidade.
           */
          setStatesError(true);
        }
      });

    return () => {
      ativo = false;
    };
  }, [tentativaDeEstados]);

  const retryStates = useCallback((): void => {
    setTentativaDeEstados((atual) => atual + 1);
  }, []);

  const carregarCidades = useCallback((uf: string): void => {
    if (uf === '') {
      setCities([]);
      setCitiesStatus('idle');
      return;
    }

    setCitiesStatus('loading');

    void geographyApi
      .listCitiesByState(uf)
      .then((resposta) => {
        // A guarda: aplica SO se esta ainda for a UF escolhida.
        if (ufEmVoo.current !== uf) {
          return;
        }

        setCities(resposta.items);
        setCitiesStatus('loaded');
      })
      .catch(() => {
        if (ufEmVoo.current !== uf) {
          return;
        }

        /**
         * `error`, e NUNCA lista vazia. Um campo de selecao sem opcoes se le como
         * "este estado nao tem cidades", que e falso e faz o administrador
         * desistir do cadastro em vez de tentar de novo (RN-58, CT-39).
         */
        setCities([]);
        setCitiesStatus('error');
      });
  }, []);

  /** Carga inicial da edicao: a UF gravada ja chega escolhida. */
  useEffect(() => {
    if (initialUf !== '') {
      ufEmVoo.current = initialUf;
      setSelectedUf(initialUf);
      carregarCidades(initialUf);
    }
  }, [carregarCidades, initialUf]);

  const selectUf = useCallback(
    (uf: string): void => {
      if (uf === selectedUf) {
        return;
      }

      ufEmVoo.current = uf;
      setSelectedUf(uf);
      /**
       * TROCAR DE ESTADO DESCARTA A CIDADE (RN-26a, CT-37, CA-17).
       *
       * E esta combinacao — so a cidade trafega, mais o descarte na troca — que
       * torna "Campo Magro - ES" IMPOSSIVEL DE REPRESENTAR, em vez de um erro a
       * validar. Uma validacao cruzada seria a alternativa, e ela falha no dia em
       * que alguem esquece de chama-la.
       */
      onCityDiscarded();
      carregarCidades(uf);
    },
    [carregarCidades, onCityDiscarded, selectedUf],
  );

  const retryCities = useCallback((): void => {
    carregarCidades(selectedUf);
  }, [carregarCidades, selectedUf]);

  return {
    states,
    statesError,
    cities,
    citiesStatus,
    selectedUf,
    selectUf,
    retryCities,
    retryStates,
  };
}
