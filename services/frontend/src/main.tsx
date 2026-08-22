import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '~/App';
import '~/styles/index.css';

const elementoRaiz = document.getElementById('root');

// `getElementById` devolve `HTMLElement | null` sob `strict`. Falhar aqui,
// nomeando o seletor ausente, e mais diagnosticavel que o erro generico de
// container invalido lancado pelo `createRoot`.
if (elementoRaiz === null) {
  throw new Error('Elemento #root nao encontrado no index.html.');
}

// Sem `BrowserRouter` e sem provider de autenticacao: eles pertencem as
// TASK-FRONTEND-010/011. Antecipa-los aqui so criaria conflito de merge.
createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
