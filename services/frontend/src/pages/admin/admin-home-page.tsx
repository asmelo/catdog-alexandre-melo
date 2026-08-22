import type { ReactElement } from 'react';

import { useAuth } from '~/contexts/auth/use-auth';
import { MESSAGES } from '~/utils/messages';

/**
 * Home da area administrativa (`/admin`), renderizada dentro do `AdminLayout`.
 *
 * MINIMA POR CONTRATO. A spec exclui explicitamente o CRUD de usuarios e a
 * gestao pelo painel ("Esta feature não realiza o gerenciamento de usuários pelo
 * painel administrativo"), entao esta pagina existe por um motivo so: tornar o
 * redirecionamento por role VERIFICAVEL. O CT-09 exige observar que o login de um
 * `admin` chega a `/admin` com o layout administrativo, e observar isso pede um
 * conteudo que nao possa ser confundido com o da area do cliente.
 *
 * Dai o par titulo + nome do usuario: o titulo distingue a area e o nome prova que
 * a sessao exibida e a do usuario que acabou de autenticar, e nao uma pagina
 * estatica que apareceria igual para qualquer um.
 *
 * `<h1>` e nao `<h2>`: o `AdminLayout` fornece os landmarks (`header`, `nav`,
 * `main`) e nenhum cabecalho, portanto o primeiro nivel da pagina pertence a ela.
 *
 * Nao ha `<section>` sem `aria-label` envolvendo um `<h1>` por acidente: a regiao
 * e nomeada pelo proprio titulo que a encabeça.
 */
export function AdminHomePage(): ReactElement {
  const { user } = useAuth();

  return (
    <section className="rounded-card bg-surface-card p-card shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">{MESSAGES.ADMIN_HOME.TITLE}</h1>

      {/*
        `user` e `AuthUser | null` no contexto. Sob esta arvore ele nunca e `null`
        (a rota vive atras de `ProtectedRoute` + `RoleRoute`), mas o ramo existe
        para nao depender da montagem: com `?.` ou `!` a pagina passaria a
        afirmar algo que o tipo nao garante.
      */}
      {user !== null && (
        <p className="mt-2 text-sm font-semibold text-ink-mid">
          {MESSAGES.ADMIN_HOME.GREETING}, {user.name}.
        </p>
      )}
    </section>
  );
}
