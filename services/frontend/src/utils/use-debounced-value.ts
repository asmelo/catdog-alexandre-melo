import { useEffect, useState } from 'react';

/**
 * Atrasa a propagacao de um valor que MUDA A CADA TECLA.
 *
 * ============ APLICADO SO AO QUE E DIGITADO ============
 *
 * Busca e idade maxima passam por aqui; os campos de SELECAO nao (RN-52). Atrasar
 * uma escolha discreta e latencia sem ganho nenhum — o visitante escolheu "Gato"
 * uma vez e fica olhando a tela parada por 350 ms sem entender por que.
 *
 * Sem a espera na busca, dez caracteres digitados em sequencia disparariam dez
 * requisicoes, das quais nove seriam descartadas — e a busca por conteudo em
 * qualquer posicao e a consulta mais cara do catalogo (RNF-19).
 *
 * A LIMPEZA DO TEMPORIZADOR e o que faz a espera funcionar: sem ela, cada tecla
 * agendaria uma atualizacao propria e todas as dez chegariam com 350 ms de
 * atraso, em vez de uma so. O `clearTimeout` cancela o agendamento anterior a
 * cada mudanca, e so o ULTIMO sobrevive.
 */
export function useDebouncedValue<T>(valor: T, atrasoMs: number): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setAtrasado(valor);
    }, atrasoMs);

    return () => {
      clearTimeout(temporizador);
    };
  }, [valor, atrasoMs]);

  return atrasado;
}
