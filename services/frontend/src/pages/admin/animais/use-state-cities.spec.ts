import { act, renderHook, waitFor } from '@testing-library/react';

import { useStateCities } from '~/pages/admin/animais/use-state-cities';
import * as geographyApi from '~/services/api/geography-api';

/**
 * O encadeamento estado -> cidade, exercitado DIRETO no hook.
 *
 * Quase tudo dele ja e verificado pela tela, em `animal-form-page.spec.tsx`, e e
 * la que os criterios de aceite vivem. O que sobra para ca sao as bordas que a
 * interface nao alcanca — a falha ao carregar estados, a resposta obsoleta que
 * FALHA em vez de resolver, e a UF vazia — e que existem porque o hook e a peca
 * reutilizavel, nao a tela.
 */

jest.mock('~/services/api/geography-api');

const geografia = jest.mocked(geographyApi);

const ESTADOS = [
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'PR', name: 'Paraná' },
];

const CIDADES_PR = [{ id: 'c-curitiba', name: 'Curitiba' }];
const CIDADES_ES = [{ id: 'c-boa-esperanca', name: 'Boa Esperança' }];

function montar(opcoes: Parameters<typeof useStateCities>[0] = { onCityDiscarded: jest.fn() }) {
  return renderHook(() => useStateCities(opcoes));
}

beforeEach(() => {
  geografia.listStates.mockResolvedValue({ items: ESTADOS });
  geografia.listCitiesByState.mockImplementation((uf) =>
    Promise.resolve({ items: uf === 'PR' ? CIDADES_PR : CIDADES_ES }),
  );
});

describe('carga de estados', () => {
  it('publica os estados recebidos', async () => {
    const { result } = montar();

    await waitFor(() => {
      expect(result.current.states).toEqual(ESTADOS);
    });
    expect(result.current.statesError).toBe(false);
  });

  it('a falha vira `statesError`, e NÃO lista vazia', async () => {
    // Um campo Estado sem opções se leria como "não há estados", que é absurdo, e
    // deixaria o administrador sem entender por que não consegue escolher a cidade.
    geografia.listStates.mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = montar();

    await waitFor(() => {
      expect(result.current.statesError).toBe(true);
    });
    expect(result.current.states).toEqual([]);
  });

  it('`retryStates` refaz a carga e limpa a falha', async () => {
    geografia.listStates.mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = montar();

    await waitFor(() => {
      expect(result.current.statesError).toBe(true);
    });

    act(() => {
      result.current.retryStates();
    });

    await waitFor(() => {
      expect(result.current.states).toEqual(ESTADOS);
    });
    expect(result.current.statesError).toBe(false);
  });

  it('a resposta que chega DEPOIS do desmonte não atualiza estado nenhum', async () => {
    // Sem a guarda `ativo`, o React avisa "state update on an unmounted
    // component" — e o aviso vira ruído em toda suíte que monte a tela.
    let liberar = (): void => undefined;

    geografia.listStates.mockImplementation(
      () =>
        new Promise((resolver) => {
          liberar = () => {
            resolver({ items: ESTADOS });
          };
        }),
    );

    const avisos = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = montar();

    unmount();
    await act(async () => {
      liberar();
      await Promise.resolve();
    });

    expect(avisos).not.toHaveBeenCalled();
  });
});

describe('carga de cidades', () => {
  it('UF vazia não dispara requisição e deixa o campo ocioso', async () => {
    // A interface não produz este caso — a opção vazia do `<select>` é
    // `disabled` —, mas `retryCities` sem estado escolhido chegaria aqui, e uma
    // requisição a `/states//cities` responderia 404 sem explicação.
    const { result } = montar();

    await waitFor(() => {
      expect(result.current.states).toEqual(ESTADOS);
    });

    act(() => {
      result.current.retryCities();
    });

    expect(geografia.listCitiesByState).not.toHaveBeenCalled();
    expect(result.current.citiesStatus).toBe('idle');
    expect(result.current.cities).toEqual([]);
  });

  it('escolher a MESMA UF de novo não refaz a consulta nem descarta a cidade', async () => {
    const aoDescartar = jest.fn();
    const { result } = montar({ onCityDiscarded: aoDescartar });

    act(() => {
      result.current.selectUf('PR');
    });

    await waitFor(() => {
      expect(result.current.citiesStatus).toBe('loaded');
    });

    expect(geografia.listCitiesByState).toHaveBeenCalledTimes(1);
    aoDescartar.mockClear();

    act(() => {
      result.current.selectUf('PR');
    });

    // Sem esta guarda, reescolher a mesma UF apagaria a cidade já escolhida.
    expect(geografia.listCitiesByState).toHaveBeenCalledTimes(1);
    expect(aoDescartar).not.toHaveBeenCalled();
  });

  it('a FALHA de uma resposta obsoleta é descartada como a resolução seria', async () => {
    // Arrange — o espelho do CT-38 no caminho de erro: "PR" falha DEPOIS de "ES"
    // ter carregado. Sem a guarda no `catch`, o campo passaria de povoado a
    // "não foi possível carregar" sem que nada tivesse falhado para a UF atual.
    const rejeitadores = new Map<string, () => void>();

    geografia.listCitiesByState.mockImplementation(
      (uf) =>
        new Promise((resolver, rejeitar) => {
          rejeitadores.set(uf, () => {
            if (uf === 'PR') {
              rejeitar(new Error('rede caiu'));
              return;
            }

            resolver({ items: CIDADES_ES });
          });
        }),
    );

    const { result } = montar();

    act(() => {
      result.current.selectUf('PR');
    });
    act(() => {
      result.current.selectUf('ES');
    });

    // Act — ES resolve; PR falha depois.
    await act(async () => {
      rejeitadores.get('ES')?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.citiesStatus).toBe('loaded');
    });

    await act(async () => {
      rejeitadores.get('PR')?.();
      await Promise.resolve();
    });

    // Assert
    expect(result.current.citiesStatus).toBe('loaded');
    expect(result.current.cities).toEqual(CIDADES_ES);
  });

  it('`retryCities` refaz a consulta da UF corrente', async () => {
    geografia.listCitiesByState.mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = montar();

    act(() => {
      result.current.selectUf('PR');
    });

    await waitFor(() => {
      expect(result.current.citiesStatus).toBe('error');
    });

    act(() => {
      result.current.retryCities();
    });

    await waitFor(() => {
      expect(result.current.citiesStatus).toBe('loaded');
    });
    expect(result.current.cities).toEqual(CIDADES_PR);
  });

  it('`initialUf` dispara a carga da edição sem nenhuma escolha do usuário', async () => {
    const { result } = montar({ initialUf: 'PR', onCityDiscarded: jest.fn() });

    await waitFor(() => {
      expect(result.current.citiesStatus).toBe('loaded');
    });
    expect(result.current.selectedUf).toBe('PR');
    expect(result.current.cities).toEqual(CIDADES_PR);
  });
});
