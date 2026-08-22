import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from '~/App';
import { AuthProvider } from '~/contexts/auth/auth-provider';
import '~/styles/index.css';

const elementoRaiz = document.getElementById('root');

// `getElementById` devolve `HTMLElement | null` sob `strict`. Falhar aqui,
// nomeando o seletor ausente, e mais diagnosticavel que o erro generico de
// container invalido lancado pelo `createRoot`.
if (elementoRaiz === null) {
  throw new Error('Elemento #root nao encontrado no index.html.');
}

/**
 * A ORDEM DO ANINHAMENTO E REQUISITO, nao estilo.
 *
 * `<BrowserRouter>` -> `<AuthProvider>` -> `<App />`. O provider fica DENTRO do
 * roteador porque a arvore que ele alimenta usa hooks de navegacao
 * (`useLocation`, `useNavigate`) — e, invertida, a montagem quebraria com
 * "useLocation() may be used only in the context of a <Router>" no primeiro
 * render de qualquer guarda.
 *
 * O `<StrictMode>` fica por fora e permanece ligado: e ele que executa o efeito
 * de mount duas vezes em desenvolvimento, e e justamente esse duplo efeito que a
 * guarda `bootstrapIniciado` do `AuthProvider` existe para absorver (um unico
 * `POST /auth/refresh`, verificado na TASK-FRONTEND-010). Desligar o StrictMode
 * esconderia a regressao em vez de evitar o problema.
 */
createRoot(elementoRaiz).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
