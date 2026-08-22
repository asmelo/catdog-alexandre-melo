import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { AlertMessage } from '~/components/ui/alert-message';
import { AuthCard } from '~/components/ui/auth-card';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { MESSAGES } from '~/utils/messages';

const CLASSES_DO_BOTAO_DE_LINK =
  'inline-block rounded-field bg-brand-purple px-5 py-3 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none';

/**
 * Aviso pos-cadastro (`/verifique-seu-email`) — CT-01.
 *
 * Sem estado, sem efeito e sem chamada de rede: e uma tela de leitura. O
 * `AlertMessage` de `success` carrega a frase literal da tabela da spec,
 * "Verifique seu e-mail para ativar sua conta.", que e o texto que o criterio de
 * aceite compara.
 *
 * O E-MAIL DIGITADO NAO E EXIBIDO, e a ausencia e deliberada.
 *
 * A rota e publica e alcançavel por URL direta, sem nenhum estado de navegacao —
 * a tela seria montada sem ter de onde tirar o endereço. As duas formas de
 * contornar isso sao piores do que o texto generico: ler o e-mail de um
 * `location.state` faria a pagina imprimir conteudo que qualquer navegacao pode
 * ter escrito, e ler de uma query string (`?email=...`) transformaria a rota num
 * refletor de texto arbitrario — inclusive de texto escolhido por um terceiro
 * que envie o link. O usuario acabou de digitar o proprio e-mail; repeti-lo aqui
 * nao lhe diz nada que ele nao saiba.
 *
 * TAMBEM NAO HA BOTAO DE REENVIO nesta tela. O reenvio precisa do endereço, e
 * pedi-lo de novo a quem acabou de se cadastrar sugere que o cadastro falhou. Ele
 * existe onde ha motivo concreto para usa-lo: no login com conta pendente e na
 * tela de confirmacao com link expirado.
 */
export function CheckEmailPage(): ReactElement {
  return (
    <AuthCard title={MESSAGES.CHECK_EMAIL.TITLE}>
      <div className="flex flex-col gap-4">
        <AlertMessage variant="success">{MESSAGES.CHECK_EMAIL.SUCCESS}</AlertMessage>

        <p className="text-[0.82rem] font-semibold leading-relaxed text-ink-mid">
          {MESSAGES.CHECK_EMAIL.GUIDANCE}
        </p>

        <div className="text-center">
          <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_BOTAO_DE_LINK}>
            {MESSAGES.CHECK_EMAIL.BACK_TO_LOGIN}
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
