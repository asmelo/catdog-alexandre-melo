import type { City, Collection, State } from '~/domains/animals/animal.types';
import { request } from '~/services/api/http-client';

/**
 * Estados e municipios, dado de apoio do formulario de animal.
 *
 * SEM CACHE E SEM MEMOIZACAO, apesar de a lista de 27 estados nunca mudar dentro
 * de uma sessao. A razao nao e purismo: a decisao de DESCARTAR respostas fora de
 * ordem e da tela (RN-57). O administrador que troca de estado tres vezes rapido
 * dispara tres buscas de municipios, e a tela precisa exibir a da ULTIMA escolha
 * — nao a que voltou por ultimo. Um cache nesta camada esconderia quais
 * requisicoes ainda estao em voo e tornaria essa regra impossivel de escrever.
 *
 * As duas rotas exigem sessao de administrador: sao dado de apoio, nao dado
 * publico (RN-02).
 */

export function listStates(): Promise<Collection<State>> {
  return request<Collection<State>>('/states');
}

/** A sigla e normalizada para maiusculas pelo backend, entao `pr` e `PR` respondem igual. */
export function listCitiesByState(uf: string): Promise<Collection<City>> {
  return request<Collection<City>>(`/states/${uf}/cities`);
}
