import { useContext } from 'react';

import { AuthContext } from '~/contexts/auth/auth-context';
import type { AuthContextValue } from '~/contexts/auth/auth.types';

/**
 * Acesso a sessao. O tipo de retorno NAO admite `null`: o estreitamento acontece
 * aqui, uma vez, em vez de em cada consumidor.
 *
 * Falhar alto e o objetivo. Devolver `undefined` para um consumidor fora do
 * provider produziria o erro algumas linhas depois, em
 * `Cannot read properties of null (reading 'status')`, sem dizer o que faltou —
 * enquanto o erro abaixo nomeia exatamente a correcao.
 */
export function useAuth(): AuthContextValue {
  const valor = useContext(AuthContext);

  if (valor === null) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return valor;
}
