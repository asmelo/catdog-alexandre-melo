import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AlertMessage } from '~/components/ui/alert-message';
import { AuthCard } from '~/components/ui/auth-card';
import { SubmitButton } from '~/components/ui/submit-button';
import { TextField } from '~/components/ui/text-field';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError } from '~/services/api/api-error';
import * as authApi from '~/services/api/auth-api';
import { MESSAGES } from '~/utils/messages';
import { hasFieldErrors, validateEmailOnlyForm, type FieldErrors } from '~/utils/validation';

/**
 * Os quatro estados da tela. Uniao discriminada, e nao quatro booleanos: com
 * booleanos existiriam combinações impossiveis (carregando E com sucesso) e o
 * compilador nao teria como cobrar a mensagem que cada estado precisa carregar.
 *
 * `expirado` e separado de `falha` porque so ele oferece o reenvio — e a unica
 * diferenca de COMPORTAMENTO entre os desfechos negativos. `ja utilizado` e
 * `invalido` compartilham o estado `falha`: nos dois casos nao ha o que reenviar
 * (no primeiro a conta ja esta ativa, no segundo o link nao corresponde a nada) e
 * a acao util e ir para o login.
 */
type EstadoDaConfirmacao =
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'sucesso'; readonly mensagem: string }
  | { readonly tipo: 'expirado'; readonly mensagem: string }
  | { readonly tipo: 'falha'; readonly mensagem: string };

const SEM_ERROS: FieldErrors = {};

const CLASSES_DO_BOTAO_DE_LINK =
  'inline-block rounded-field bg-brand-purple px-5 py-3 text-sm font-extrabold text-white shadow-button transition-colors hover:bg-brand-purple-hover hover:shadow-button-hover focus-visible:shadow-focus-ring focus-visible:outline-none';

/** Titulo do cartao por estado: o `AuthCard` monta UM `<h1>`, que e a ancora de navegacao do leitor de tela. */
function tituloDoEstado(estado: EstadoDaConfirmacao): string {
  if (estado.tipo === 'carregando') {
    return MESSAGES.CONFIRM_EMAIL.LOADING_TITLE;
  }

  if (estado.tipo === 'sucesso') {
    return MESSAGES.CONFIRM_EMAIL.SUCCESS_TITLE;
  }

  return MESSAGES.CONFIRM_EMAIL.ERROR_TITLE;
}

/**
 * Traduz a falha da API em estado de tela. Ramifica por `code` e exibe a
 * `message` que o backend enviou — nunca uma frase montada aqui a partir do
 * status HTTP (410 para expirado, 409 para já utilizado, 400 para invalido).
 */
function estadoDaFalha(erro: unknown): EstadoDaConfirmacao {
  if (!(erro instanceof ApiError)) {
    return { tipo: 'falha', mensagem: MESSAGES.FORM.UNEXPECTED_ERROR };
  }

  if (erro.code === 'CONFIRMATION_TOKEN_EXPIRED') {
    return { tipo: 'expirado', mensagem: erro.message };
  }

  return { tipo: 'falha', mensagem: erro.message };
}

/**
 * Resultado da confirmacao de conta (`/confirmar-email?token=...`) — CT-06, CT-07,
 * CT-08.
 *
 * O TOKEN E CONSUMIDO UMA UNICA VEZ, e essa e a regra central do arquivo.
 *
 * O `<StrictMode>` do React 18 executa o efeito de mount DUAS vezes em
 * desenvolvimento. Sem a guarda de `useRef` abaixo, a segunda execucao dispararia
 * um segundo `POST /auth/confirm-email` com o mesmo token; como o token e de uso
 * unico (RN-03), a primeira chamada o consome e a segunda volta
 * `409 CONFIRMATION_TOKEN_ALREADY_USED` — a tela exibiria
 * "Este link de confirmação já foi utilizado." para um usuario que acabou de
 * confirmar a conta com sucesso. E o mesmo efeito que o `bootstrapIniciado` do
 * `AuthProvider` absorve no `POST /auth/refresh` (TASK-FRONTEND-010), e o
 * `StrictMode` permanece ligado de proposito: desliga-lo esconderia a regressao
 * em vez de evitar o problema.
 *
 * A guarda guarda o TOKEN JA PROCESSADO, e nao um booleano. Um booleano bloquearia
 * tambem a mudanca legitima de token (o usuario abre um segundo link de
 * confirmacao enquanto esta pagina esta montada, e o React reaproveita a
 * instancia); comparar o valor bloqueia a repeticao e permite o token novo.
 *
 * Sem `token` na URL a API NAO e chamada: nao existe requisicao a fazer, e o
 * `confirmEmailSchema` do backend responderia `400` para um corpo sem token.
 */
export function ConfirmEmailPage(): ReactElement {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');

  const [estado, setEstado] = useState<EstadoDaConfirmacao>({ tipo: 'carregando' });

  const tokenJaProcessado = useRef<string | null>(null);

  const [email, setEmail] = useState('');
  const [errosDeCampo, setErrosDeCampo] = useState<FieldErrors>(SEM_ERROS);
  const [reenviando, setReenviando] = useState(false);
  const [respostaDoReenvio, setRespostaDoReenvio] = useState<string | null>(null);

  useEffect(() => {
    const tokenAlvo = token ?? '';

    if (tokenJaProcessado.current === tokenAlvo) {
      return;
    }

    tokenJaProcessado.current = tokenAlvo;

    if (tokenAlvo === '') {
      setEstado({ tipo: 'falha', mensagem: MESSAGES.CONFIRM_EMAIL.MISSING_TOKEN });

      return;
    }

    setEstado({ tipo: 'carregando' });

    void authApi
      .confirmEmail(tokenAlvo)
      .then((resposta) => {
        setEstado({ tipo: 'sucesso', mensagem: resposta.message });
      })
      .catch((erro: unknown) => {
        setEstado(estadoDaFalha(erro));
      });
  }, [token]);

  /**
   * Pedido de novo link. `<form onSubmit>` de verdade tambem aqui: e um campo e um
   * botao, e o Enter tem de submeter (RNF-05).
   *
   * A resposta do backend e sempre `202` com a mesma frase generica, exista a
   * conta ou nao — dai a variante `info` e nao `success`: ela nao afirma que um
   * e-mail foi enviado.
   */
  async function aoSolicitarNovoLink(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    const erros = validateEmailOnlyForm(email);

    setErrosDeCampo(erros);

    if (hasFieldErrors(erros)) {
      return;
    }

    setReenviando(true);

    try {
      const resposta = await authApi.resendConfirmation(email);

      setRespostaDoReenvio(resposta.message);
    } catch (erro) {
      setRespostaDoReenvio(
        erro instanceof ApiError ? erro.message : MESSAGES.FORM.UNEXPECTED_ERROR,
      );
    } finally {
      setReenviando(false);
    }
  }

  return (
    <AuthCard title={tituloDoEstado(estado)}>
      <div className="flex flex-col gap-4">
        {/*
          `role="status"` + `aria-live="polite"` anunciam a espera sem interromper
          o que o leitor de tela estiver lendo. Mesmo padrao do `SessionSplash`
          das guardas (TASK-FRONTEND-011).
        */}
        {estado.tipo === 'carregando' && (
          <p
            role="status"
            aria-live="polite"
            className="text-[0.82rem] font-semibold leading-relaxed text-ink-mid"
          >
            {MESSAGES.CONFIRM_EMAIL.LOADING}
          </p>
        )}

        {estado.tipo === 'sucesso' && (
          <>
            <AlertMessage variant="success">{estado.mensagem}</AlertMessage>

            <div className="text-center">
              <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_BOTAO_DE_LINK}>
                {MESSAGES.CONFIRM_EMAIL.GO_TO_LOGIN}
              </Link>
            </div>
          </>
        )}

        {estado.tipo === 'expirado' && (
          <>
            <AlertMessage variant="error">{estado.mensagem}</AlertMessage>

            {respostaDoReenvio === null ? (
              <form
                noValidate
                onSubmit={(evento) => {
                  void aoSolicitarNovoLink(evento);
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-[0.82rem] font-semibold leading-relaxed text-ink-mid">
                  {MESSAGES.CONFIRM_EMAIL.EXPIRED_GUIDANCE}
                </p>

                <TextField
                  id="confirm-email-resend-email"
                  label={MESSAGES.CONFIRM_EMAIL.EMAIL_LABEL}
                  type="email"
                  autoComplete="email"
                  placeholder={MESSAGES.CONFIRM_EMAIL.EMAIL_PLACEHOLDER}
                  value={email}
                  error={errosDeCampo.email ?? ''}
                  onChange={(evento) => {
                    setEmail(evento.target.value);
                  }}
                />

                <SubmitButton isLoading={reenviando} loadingLabel={MESSAGES.FORM.SENDING}>
                  {MESSAGES.FORM.RESEND_CONFIRMATION}
                </SubmitButton>
              </form>
            ) : (
              <AlertMessage variant="info">{respostaDoReenvio}</AlertMessage>
            )}

            <div className="text-center">
              <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_BOTAO_DE_LINK}>
                {MESSAGES.CONFIRM_EMAIL.GO_TO_LOGIN}
              </Link>
            </div>
          </>
        )}

        {estado.tipo === 'falha' && (
          <>
            <AlertMessage variant="error">{estado.mensagem}</AlertMessage>

            <div className="text-center">
              <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_BOTAO_DE_LINK}>
                {MESSAGES.CONFIRM_EMAIL.GO_TO_LOGIN}
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthCard>
  );
}
