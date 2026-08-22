import type { ReactElement } from 'react';

import { AppRoutes } from '~/routes/app-routes';

/**
 * Raiz da aplicacao.
 *
 * Fina de proposito: substitui o placeholder de verificacao dos tokens da
 * TASK-FRONTEND-008 e nao acrescenta nada por cima do roteador. O
 * `<BrowserRouter>` e o `<AuthProvider>` ficam em `main.tsx`, um nivel acima —
 * com eles aqui, qualquer teste que montasse `<App />` precisaria de um
 * navegador, e as guardas nao poderiam ser exercitadas sob um
 * `MemoryRouter` (TASK-FRONTEND-013).
 */
export function App(): ReactElement {
  return <AppRoutes />;
}
