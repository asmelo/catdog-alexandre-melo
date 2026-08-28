import type {
  Animal,
  AnimalStatus,
  Paginated,
} from '~/domains/animals/animal.types';
import { buildQuery } from '~/services/api/build-query';
import { request } from '~/services/api/http-client';

/**
 * Uma funcao por endpoint de `/api/animals`, e nada mais — o molde e o
 * `auth-api.ts`.
 *
 * NENHUMA funcao aqui trata erro. Todas deixam o `ApiError` subir para quem
 * chamou, que e quem sabe se um `ANIMAL_STALE_UPDATE` vira um aviso de recarregar
 * a tela ou se um `SPECIES_NOT_FOUND` vira um erro sob o campo de especie.
 * Tambem nao ha estado nem cache.
 *
 * A MONTAGEM DO `FormData` NAO ACONTECE AQUI, e isso e deliberado: quem conhece
 * os arquivos em preparo, a ordem das imagens e quais delas o administrador
 * decidiu manter e a TELA. Montar o formulario nesta camada obrigaria a API a
 * conhecer o estado do formulario, e a funcao passaria a ter uma assinatura nova
 * a cada campo acrescentado. Aqui ela apenas transporta.
 */

export interface ListAnimalsParams {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * `buildQuery` descarta as chaves `undefined`, entao `listAnimals({})` requisita
 * `/animals` sem query e deixa o backend aplicar os padroes da RN-42 — que e
 * exatamente o que enviar `?page=` impediria.
 */
export function listAnimals(params: ListAnimalsParams = {}): Promise<Paginated<Animal>> {
  return request<Paginated<Animal>>(
    `/animals${buildQuery({ page: params.page, pageSize: params.pageSize })}`,
  );
}

export function getAnimal(id: string): Promise<Animal> {
  return request<Animal>(`/animals/${id}`);
}

/**
 * `FormData` porque o endpoint e multipart: ele recebe os campos de texto e ate
 * cinco imagens na mesma requisicao. O cliente HTTP omite o `Content-Type`
 * sozinho nesse caso, para que o navegador escreva o cabecalho com o `boundary`.
 */
export function createAnimal(formData: FormData): Promise<Animal> {
  return request<Animal>('/animals', { method: 'POST', body: formData });
}

/**
 * `PATCH` e nunca `PUT`: a configuracao de CORS em vigor nao libera o verbo
 * `PUT` (Decisao 2 do changelog). Pelo mesmo motivo o token de concorrencia
 * viaja no CORPO do formulario, e nao em `If-Match`.
 */
export function updateAnimal(id: string, formData: FormData): Promise<Animal> {
  return request<Animal>(`/animals/${id}`, { method: 'PATCH', body: formData });
}

export interface ChangeAnimalStatusInput {
  readonly status: AnimalStatus;
  /** Token de concorrencia — o `updatedAt` que a leitura devolveu (RN-47). */
  readonly updatedAt: string;
}

/**
 * O UNICO endpoint de escrita da feature que NAO e multipart: o corpo e JSON, e o
 * middleware de leitura de multipart nao esta montado nesta rota.
 *
 * Campos copiados um a um, e nao `body: input`. O schema do backend reprova
 * QUALQUER chave extra no corpo (CT-75), entao um campo que vazasse do estado da
 * tela viraria `400 VALIDATION_ERROR` em vez de ser ignorado. Copiar
 * explicitamente faz o compilador recusar a mudanca antes de o servidor recusar a
 * requisicao — mesma decisao ja registrada no `register` do `auth-api.ts`.
 */
export function changeAnimalStatus(
  id: string,
  input: ChangeAnimalStatusInput,
): Promise<Animal> {
  return request<Animal>(`/animals/${id}/status`, {
    method: 'PATCH',
    body: { status: input.status, updatedAt: input.updatedAt },
  });
}

/** Responde `204` sem corpo. Sem token de concorrencia: o `DELETE` nao tem corpo. */
export function deleteAnimal(id: string): Promise<void> {
  return request<void>(`/animals/${id}`, { method: 'DELETE' });
}
