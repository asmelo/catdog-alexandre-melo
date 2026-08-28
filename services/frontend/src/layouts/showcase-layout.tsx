import type { ReactElement } from 'react';
import { Link, Outlet } from 'react-router-dom';

import { CatDogLogo } from '~/components/ui/catdog-logo';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS } from '~/routes/route-paths';

const CLASSES_DO_LINK =
  'rounded-field px-3 py-1.5 text-sm font-extrabold text-ink-mid transition-colors hover:bg-brand-purple-light hover:text-brand-purple focus-visible:shadow-focus-ring focus-visible:outline-none';

const CLASSES_DO_BOTAO =
  'inline-flex items-center gap-2 rounded-field bg-brand-purple px-3 py-1.5 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none';

/**
 * Ícone da porta de saída. DECORATIVO: `aria-hidden` porque a palavra "Sair" ao
 * lado já é o nome acessível. Sem isso o leitor de tela anunciaria a ação duas
 * vezes (CT-09, RNF-23).
 */
function IconeDeSaida(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * Moldura da VITRINE PUBLICA.
 *
 * ============ POR QUE NAO E O `ClientLayout` ============
 *
 * Aquele e layout de AREA AUTENTICADA, e a regra central dele — verificada por
 * teste — e que nenhum controle administrativo existe no DOM. Condicionar metade
 * do conteudo dele a existencia de sessao, para reaproveita-lo aqui, quebraria
 * aquela verificacao e transformaria um componente com uma responsabilidade em
 * outro com duas.
 *
 * ============ TRES ESTADOS, E NAO DOIS ============
 *
 * O terceiro e o que a maioria das telas esquece: durante o `bootstrapping` a
 * aplicacao AINDA NAO SABE se ha sessao. Exibir "Entrar" nesse instante faria o
 * cabecalho piscar de "Entrar" para o nome do usuario a cada carga de pagina de
 * quem esta logado — e, pior, exibiria por um instante um convite a entrar para
 * quem ja entrou (RN-06, CT-07).
 *
 * ============ NOME, JAMAIS E-MAIL ============
 *
 * A captura de tela exibe o e-mail. A spec adota o NOME, por duas razoes
 * independentes: e-mail e dado pessoal numa pagina PUBLICA, passivel de ser vista
 * por terceiros sobre o ombro; e o `ClientLayout` ja exibe o nome, entao o e-mail
 * aqui criaria duas identificacoes para o mesmo usuario na mesma aplicacao.
 *
 * Nome ausente nao cai no e-mail: nao exibe NADA (RN-06, Decisao 2).
 */
export function ShowcaseLayout(): ReactElement {
  const { status, user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <header className="border-b border-hairline bg-surface-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          {/*
            O logotipo aponta para a PROPRIA vitrine, e nao para `/`: a raiz
            decide o destino por role dentro do `ProtectedRoute` e mandaria o
            visitante anonimo ao login — de dentro da unica tela que nao exige
            sessao (HU-02 cenario 6).
          */}
          <Link
            to={ROUTE_PATHS.SHOWCASE}
            aria-label="CatDog — início"
            className="rounded-field focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            <CatDogLogo size={28} />
          </Link>

          {/*
            SEM `<nav>`: a captura mostra o cabecalho da vitrine sem itens de
            navegacao. Uma regiao de navegacao com um unico link seria ruido para
            quem percorre a pagina por landmarks.
          */}
          <div className="ml-auto flex items-center gap-2">
            {/*
              `anonymous` e o caso NORMAL desta tela, e nao um erro. Nada aqui
              trata a ausencia de sessao como falha.
            */}
            {status === 'anonymous' && (
              <>
                <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_LINK}>
                  Entrar
                </Link>
                <Link to={ROUTE_PATHS.REGISTER} className={CLASSES_DO_LINK}>
                  Criar conta
                </Link>
              </>
            )}

            {status === 'authenticated' && (
              <>
                {user !== null && (
                  <span className="text-sm font-extrabold text-ink">{user.name}</span>
                )}

                {/*
                  `logout()` SEM navegacao. Quem sai permanece em `/animais`: a
                  rota e publica, e expulsar quem acabou de sair de uma tela que
                  nao exige sessao e incoerente (RN-07, CT-08). Nenhum `navigate`
                  neste componente, e o `logoutReason` do contexto nao e lido.
                */}
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className={CLASSES_DO_BOTAO}
                >
                  <IconeDeSaida />
                  Sair
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
