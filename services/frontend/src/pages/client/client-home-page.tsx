import type { ReactElement } from 'react';

import { useAuth } from '~/contexts/auth/use-auth';
import { MESSAGES } from '~/utils/messages';

/**
 * Home da area do cliente (`/minha-area`), renderizada dentro do `ClientLayout`.
 *
 * MINIMA POR CONTRATO, pelo mesmo motivo da home do admin: ela existe para tornar
 * o CT-10 observavel (login de `cliente` chega a `/minha-area` com o layout de
 * cliente) e para dar ao CT-16 um destino visivel quando um cliente tenta abrir a
 * area administrativa. O conteudo real da area e de outras features.
 *
 * NENHUM controle administrativo aparece aqui — nem oculto, nem desabilitado.
 * A regra e do `ClientLayout` (CA-10) e vale igualmente para o conteudo que ele
 * envolve: nao existe neste arquivo nada condicionado a `role === 'admin'`,
 * porque um trecho desses seria equivalente na tela e falharia o criterio na
 * intencao — bastaria um defeito de estado para o controle aparecer.
 */
export function ClientHomePage(): ReactElement {
  const { user } = useAuth();

  return (
    <section className="rounded-card bg-surface-card p-card shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">{MESSAGES.CLIENT_HOME.TITLE}</h1>

      {user !== null && (
        <p className="mt-2 text-sm font-semibold text-ink-mid">
          {MESSAGES.CLIENT_HOME.GREETING}, {user.name}.
        </p>
      )}
    </section>
  );
}
