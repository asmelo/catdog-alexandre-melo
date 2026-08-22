import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AlertMessage } from '~/components/ui/alert-message';
import { AuthCard } from '~/components/ui/auth-card';
import { PasswordField } from '~/components/ui/password-field';
import { SubmitButton } from '~/components/ui/submit-button';
import { TextField } from '~/components/ui/text-field';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS, homePathForRole, readRedirectTarget } from '~/routes/route-paths';
import { ApiError, fieldErrorsOf } from '~/services/api/api-error';
import * as authApi from '~/services/api/auth-api';
import { MESSAGES } from '~/utils/messages';
import { hasFieldErrors, validateLoginForm, type FieldErrors } from '~/utils/validation';

/** Aviso de topo do formulario: variante do `AlertMessage` mais o texto a exibir. */
interface Aviso {
  readonly variant: 'success' | 'error' | 'info';
  readonly message: string;
}

const SEM_ERROS: FieldErrors = {};

/**
 * Botao secundario (reenvio do e-mail de confirmacao). Contorno roxo em vez de
 * preenchido: ele nao pode competir com o "Entrar", que continua sendo a acao
 * primaria da tela.
 */
const CLASSES_DO_BOTAO_SECUNDARIO =
  'w-full rounded-field border-[1.5px] border-brand-purple bg-surface-card py-3 text-[0.82rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const CLASSES_DO_LINK =
  'rounded-field font-extrabold text-brand-purple transition-colors hover:text-brand-purple-hover hover:underline focus-visible:shadow-focus-ring focus-visible:outline-none';

/**
 * Tela de login (`/login`) — a tela do `reference.html`.
 *
 * O "Esqueceu sua senha?" do mockup NAO e renderizado. A decisao vem da
 * TASK-FRONTEND-009 e da secao "O que Não Deve Ser Feito" da spec: recuperacao
 * de senha esta fora do escopo, e um link para um caminho morto e um defeito de
 * produto — o usuario que clica descobre que o sistema nao tem a funcao depois de
 * ter confiado que tinha.
 *
 * SEGURANCA — o destino pos-login passa por `readRedirectTarget`, NUNCA por
 * `location.state.from` cru.
 *
 * A TASK-FRONTEND-011 sanitizou o `from` na CRIACAO (dentro das guardas) para
 * mitigar a GHSA-wrjc-x8rr-h8h6 (open redirect do `react-router@6.30.6`, em que
 * `/\evil.com` e tratado como destino externo por `useNavigate`). Esta tela e o
 * CONSUMIDOR dessa mitigacao e revalida mesmo assim, porque o `state` de
 * navegacao e dado de ENTRADA: qualquer pagina pode ter chamado
 * `navigate('/login', { state })` e o `history` do navegador preserva o valor
 * entre recargas. Ler `state.from` direto transferiria a garantia para a origem
 * do valor — e a origem, aqui, e desconhecida por definicao.
 */
export function LoginPage(): ReactElement {
  const { login, logoutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errosDeCampo, setErrosDeCampo] = useState<FieldErrors>(SEM_ERROS);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [autenticando, setAutenticando] = useState(false);

  /**
   * O reenvio so aparece depois de um `ACCOUNT_NOT_CONFIRMED`. Estado separado do
   * `aviso` porque o botao precisa SOBREVIVER a troca da mensagem: ao clicar em
   * reenviar, o aviso passa a ser a resposta do reenvio e o botao continua na
   * tela para uma segunda tentativa.
   */
  const [ofereceReenvio, setOfereceReenvio] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  /**
   * Ramifica por `code`, nunca por `message` nem por `status`.
   *
   * `INVALID_CREDENTIALS` (401) e `ACCOUNT_NOT_CONFIRMED` (403) caem no mesmo
   * `setAviso` de proposito: a frase exibida e a que o backend enviou, e nao uma
   * frase montada aqui a partir do codigo. O que o codigo decide e apenas se o
   * botao de reenvio aparece — e ele aparece exclusivamente no segundo caso, que
   * e o unico em que sabemos que a conta existe e esta pendente.
   *
   * `TOO_MANY_REQUESTS`, `NETWORK_ERROR` e qualquer codigo futuro caem no mesmo
   * ramo final e exibem a mensagem da API. Um `switch` exaustivo aqui obrigaria
   * esta tela a ser editada a cada codigo novo do backend.
   */
  function tratarFalhaDeLogin(erro: unknown): void {
    if (!(erro instanceof ApiError)) {
      setOfereceReenvio(false);
      setAviso({ variant: 'error', message: MESSAGES.FORM.UNEXPECTED_ERROR });

      return;
    }

    if (erro.code === 'VALIDATION_ERROR') {
      // Erro por campo nao vira aviso de topo: a mensagem pertence ao input que
      // a causou, e duplica-la em cima do formulario faria o leitor de tela
      // anunciar a mesma frase duas vezes.
      setOfereceReenvio(false);
      setAviso(null);
      setErrosDeCampo(fieldErrorsOf(erro));

      return;
    }

    setOfereceReenvio(erro.code === 'ACCOUNT_NOT_CONFIRMED');
    setAviso({ variant: 'error', message: erro.message });
  }

  /**
   * `onSubmit` do `<form>`, e nao `onClick` do botao (RNF-05 / AC #6). E o que faz
   * o Enter em qualquer campo submeter o formulario, sem mouse — comportamento
   * que o navegador da de graça e que um `onClick` jogaria fora.
   */
  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    const erros = validateLoginForm({ email, password: senha });

    setErrosDeCampo(erros);

    if (hasFieldErrors(erros)) {
      setAviso(null);
      setOfereceReenvio(false);

      return;
    }

    setAviso(null);
    setAutenticando(true);

    try {
      const usuario = await login({ email, password: senha });

      /**
       * O `state` do roteador e tipado como `any` pela biblioteca. A anotacao
       * explicita para `unknown` impede que o valor seja usado sem passar pela
       * revalidacao abaixo.
       */
      const estadoDeNavegacao: unknown = location.state;

      // Fallback = home da role (RN-09). `readRedirectTarget` devolve o fallback
      // sempre que o `from` nao provar ser um caminho interno.
      const destino = readRedirectTarget(estadoDeNavegacao, homePathForRole(usuario.role));

      // `replace`: o login nao deve ficar no historico, senao o botao "voltar"
      // devolve o usuario autenticado a um formulario que a guarda
      // `PublicOnlyRoute` vai imediatamente redirecionar.
      navigate(destino, { replace: true });
    } catch (erro) {
      tratarFalhaDeLogin(erro);
    } finally {
      setAutenticando(false);
    }
  }

  /**
   * Reenvio do e-mail de confirmacao. Usa o e-mail JA digitado no formulario —
   * nao ha campo extra, porque o endereço que produziu o
   * `ACCOUNT_NOT_CONFIRMED` e exatamente o que esta no estado.
   *
   * A resposta e sempre `202` com a mesma frase generica, exista a conta ou nao
   * (mesmo espirito da RN-05), e por isso e exibida como `info` e nao como
   * `success`: ela nao confirma que um e-mail foi enviado.
   */
  async function aoReenviarConfirmacao(): Promise<void> {
    setReenviando(true);

    try {
      const resposta = await authApi.resendConfirmation(email);

      setAviso({ variant: 'info', message: resposta.message });
    } catch (erro) {
      setAviso({
        variant: 'error',
        message: erro instanceof ApiError ? erro.message : MESSAGES.FORM.UNEXPECTED_ERROR,
      });
    } finally {
      setReenviando(false);
    }
  }

  /**
   * A sessao expirada e o unico aviso que a tela mostra sem o usuario ter feito
   * nada. Perde para qualquer `aviso` produzido nesta visita: depois de uma
   * tentativa de login, o resultado dela e a informacao relevante.
   */
  const avisoDeSessaoExpirada: Aviso | null =
    aviso === null && logoutReason === 'session-expired'
      ? { variant: 'error', message: MESSAGES.FORM.SESSION_EXPIRED }
      : null;
  const avisoExibido = aviso ?? avisoDeSessaoExpirada;

  return (
    <AuthCard title={MESSAGES.LOGIN.TITLE} subtitle={MESSAGES.LOGIN.SUBTITLE}>
      <form
        noValidate
        onSubmit={(evento) => {
          void aoSubmeter(evento);
        }}
        className="flex flex-col gap-3"
      >
        {/*
          `noValidate` desliga as bolhas nativas do navegador: elas nao sao
          estilizaveis, aparecem em ingles em alguns idiomas de sistema e
          impediriam a submissao antes de o catalogo de mensagens da spec ser
          aplicado. A validacao e a de `~/utils/validation`.

          O aviso e montado ACIMA dos campos e apenas quando existe: o
          `AlertMessage` tem `role="alert"`, que so e anunciado pelo leitor de
          tela se o elemento aparecer no momento da mensagem.
        */}
        {avisoExibido !== null && (
          <AlertMessage variant={avisoExibido.variant}>{avisoExibido.message}</AlertMessage>
        )}

        <TextField
          id="login-email"
          label={MESSAGES.LOGIN.EMAIL_LABEL}
          type="email"
          autoComplete="email"
          placeholder={MESSAGES.LOGIN.EMAIL_PLACEHOLDER}
          value={email}
          error={errosDeCampo.email ?? ''}
          onChange={(evento) => {
            setEmail(evento.target.value);
          }}
        />

        <PasswordField
          id="login-password"
          label={MESSAGES.LOGIN.PASSWORD_LABEL}
          autoComplete="current-password"
          placeholder={MESSAGES.LOGIN.PASSWORD_PLACEHOLDER}
          value={senha}
          error={errosDeCampo.password ?? ''}
          onChange={(evento) => {
            setSenha(evento.target.value);
          }}
        />

        {/*
          `isLoading` cuida do `disabled` e do `aria-busy` (TASK-FRONTEND-009).
          Nenhuma trava propria e reimplementada aqui: duas fontes para o mesmo
          estado divergiriam.
        */}
        <SubmitButton isLoading={autenticando} className="mt-1.5">
          {MESSAGES.LOGIN.SUBMIT}
        </SubmitButton>

        {ofereceReenvio && (
          <button
            type="button"
            disabled={reenviando}
            onClick={() => {
              void aoReenviarConfirmacao();
            }}
            className={CLASSES_DO_BOTAO_SECUNDARIO}
          >
            {reenviando ? MESSAGES.FORM.SENDING : MESSAGES.FORM.RESEND_CONFIRMATION}
          </button>
        )}
      </form>

      {/*
        `ink.mid` e nao o `--text-muted` do mockup: medido na TASK-FRONTEND-009,
        `ink.muted` sobre o cartao branco reprova o WCAG AA. Mesma divergencia
        (e mesmo motivo) do placeholder do `TextField`.
      */}
      <p className="mt-4 text-center text-[0.8rem] font-semibold text-ink-mid">
        {MESSAGES.LOGIN.NO_ACCOUNT}{' '}
        <Link to={ROUTE_PATHS.REGISTER} className={CLASSES_DO_LINK}>
          {MESSAGES.LOGIN.SIGN_UP}
        </Link>
      </p>
    </AuthCard>
  );
}
