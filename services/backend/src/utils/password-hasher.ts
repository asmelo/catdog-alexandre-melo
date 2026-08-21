import bcrypt from 'bcrypt';

import { env } from '~/config/env';

/**
 * UNICO arquivo do projeto autorizado a importar `bcrypt`.
 *
 * O isolamento e proposital: se o build do modulo nativo falhar no Docker Alpine
 * do Render, trocar por `bcryptjs` custa a edicao deste arquivo e de mais nenhum.
 */

/**
 * Hash bcrypt fixo, gerado uma vez com custo 12 sobre um segredo aleatorio de 256
 * bits que foi descartado — nao existe senha conhecida que corresponda a ele.
 *
 * Serve ao login contra usuario inexistente: comparar a senha enviada com este
 * hash gasta o mesmo tempo de uma comparacao real (medido: 212 ms contra 218 ms),
 * fechando o canal de timing. Sem isso, RN-05/RNF-03 caem — a resposta seria
 * textualmente igual, mas responderia em microssegundos e revelaria que o e-mail
 * nao existe.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$sCjDW./3jGP.PGdB6I8ofOCUWRU/GnKG0ZHZChF7vXp9UGueZxuJ6';

/**
 * Custo vem de `env.BCRYPT_COST` (12): ~220 ms no Node 20, folgado dentro do
 * orcamento do RNF-04 (login percebido em menos de 3 s). Nao elevar sem medir de
 * novo — o custo dobra o tempo a cada incremento.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
