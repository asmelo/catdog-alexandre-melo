import { createHash, randomBytes } from 'node:crypto';

/**
 * Tokens opacos de uso unico (confirmacao de e-mail e refresh token): o valor em
 * claro vai para o usuario, apenas o hash e persistido.
 */

const BYTES_DO_TOKEN = 32;

/**
 * 256 bits de `randomBytes`. `Math.random` e proibido aqui: nao e um gerador
 * criptografico e sua sequencia e previsivel a partir de saidas observadas.
 */
export function generateOpaqueToken(): string {
  return randomBytes(BYTES_DO_TOKEN).toString('base64url');
}

/**
 * SHA-256 em hexadecimal — 64 caracteres, casando com `@db.Char(64)` do schema.
 *
 * SHA-256 e nao bcrypt por duas razoes: o segredo ja tem alta entropia (nao
 * precisa do alongamento de um KDF lento) e a busca precisa ser
 * `WHERE token_hash = ?` sobre indice unico, o que bcrypt tornaria O(n) por
 * exigir uma comparacao por registro.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
