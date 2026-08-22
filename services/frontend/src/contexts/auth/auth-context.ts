import { createContext } from 'react';

import type { AuthContextValue } from '~/contexts/auth/auth.types';

/**
 * Valor inicial `null`, e nao um objeto vazio nem um default plausivel: e ele que
 * permite ao `useAuth` distinguir "consumidor fora do provider" de "sessao
 * anonima" e falhar com mensagem explicita em vez de devolver um `status`
 * inventado.
 *
 * Arquivo separado do provider de proposito: um `.ts` sem JSX e sem estado pode
 * ser importado por qualquer modulo (inclusive por teste) sem arrastar a arvore
 * de React do provider.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
