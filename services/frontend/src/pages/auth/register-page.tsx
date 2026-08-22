import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AlertMessage } from '~/components/ui/alert-message';
import { AuthCard } from '~/components/ui/auth-card';
import { PasswordField } from '~/components/ui/password-field';
import { SubmitButton } from '~/components/ui/submit-button';
import { TextField } from '~/components/ui/text-field';
import { useAuth } from '~/contexts/auth/use-auth';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError, fieldErrorsOf } from '~/services/api/api-error';
import { MESSAGES } from '~/utils/messages';
import { hasFieldErrors, validateRegisterForm, type FieldErrors } from '~/utils/validation';

const SEM_ERROS: FieldErrors = {};

const CLASSES_DO_LINK =
  'rounded-field font-extrabold text-brand-purple transition-colors hover:text-brand-purple-hover hover:underline focus-visible:shadow-focus-ring focus-visible:outline-none';

/**
 * Tela de cadastro (`/cadastro`).
 *
 * DUAS REGRAS GOVERNAM ESTE ARQUIVO, e as duas sao exigencia literal da spec:
 *
 * 1. **A confirmacao de senha nunca trafega** (RN-12). Ela existe apenas em
 *    `confirmacaoDeSenha`, e comparada em `validateRegisterForm` e morre aqui. O
 *    `register` do contexto recebe um objeto com tres campos, e o
 *    `authApi.register` copia campo por campo — o schema do backend RECUSA
 *    qualquer chave extra, entao um vazamento nao seria ignorado: viraria
 *    `400 VALIDATION_ERROR` e o cadastro pararia de funcionar.
 * 2. **O formulario nao e limpo quando a API recusa** (CT-02 / AC #10). Nenhum
 *    `setState('')` existe no tratamento de erro. Apagar quatro campos por causa
 *    de um e-mail repetido obrigaria o usuario a digitar tudo de novo para trocar
 *    uma unica palavra — e e o reflexo natural de quem escreve o `catch`.
 *
 * A validacao local roda ANTES da requisicao e, quando falha, NENHUMA chamada de
 * rede acontece (CT-03, CT-04, CT-05). O `return` antecipado no `aoSubmeter` e o
 * que garante isso, e e verificavel contando as requisicoes na aba de rede.
 */
export function RegisterPage(): ReactElement {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacaoDeSenha, setConfirmacaoDeSenha] = useState('');
  const [errosDeCampo, setErrosDeCampo] = useState<FieldErrors>(SEM_ERROS);
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

  /**
   * `EMAIL_ALREADY_IN_USE` (409) nao tem ramo proprio: a mensagem exibida e a que
   * o backend enviou ("Este e-mail já está em uso.") e o comportamento — manter
   * os campos — e o mesmo de qualquer outra falha. Escrever um `if` por codigo
   * daria a impressao de que os casos diferem quando nao diferem.
   */
  function tratarFalhaDeCadastro(erro: unknown): void {
    if (!(erro instanceof ApiError)) {
      setMensagemDeErro(MESSAGES.FORM.UNEXPECTED_ERROR);

      return;
    }

    if (erro.code === 'VALIDATION_ERROR') {
      setMensagemDeErro(null);
      setErrosDeCampo(fieldErrorsOf(erro));

      return;
    }

    setMensagemDeErro(erro.message);
  }

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    const erros = validateRegisterForm({
      name: nome,
      email,
      password: senha,
      passwordConfirmation: confirmacaoDeSenha,
    });

    setErrosDeCampo(erros);

    // A rede nao e tocada quando a validacao local reprova (CT-03 / CT-04).
    if (hasFieldErrors(erros)) {
      setMensagemDeErro(null);

      return;
    }

    setMensagemDeErro(null);
    setCadastrando(true);

    try {
      // TRES campos, nomeados um a um. `confirmacaoDeSenha` nao aparece — e nao
      // pode aparecer — nesta chamada (RN-12 / AC #16).
      await register({ name: nome, email, password: senha });

      // O registro NAO autentica: a conta nasce `PENDING_CONFIRMATION`. Por isso
      // o destino e o aviso de verificacao de e-mail, e nao a home de uma role.
      navigate(ROUTE_PATHS.CHECK_EMAIL, { replace: true });
    } catch (erro) {
      tratarFalhaDeCadastro(erro);
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <AuthCard title={MESSAGES.REGISTER.TITLE} subtitle={MESSAGES.REGISTER.SUBTITLE}>
      <form
        noValidate
        onSubmit={(evento) => {
          void aoSubmeter(evento);
        }}
        className="flex flex-col gap-3"
      >
        {mensagemDeErro !== null && <AlertMessage variant="error">{mensagemDeErro}</AlertMessage>}

        {/* A ordem dos campos e contrato do plano: nome, e-mail, senha, confirmacao. */}
        <TextField
          id="register-name"
          label={MESSAGES.REGISTER.NAME_LABEL}
          type="text"
          autoComplete="name"
          placeholder={MESSAGES.REGISTER.NAME_PLACEHOLDER}
          value={nome}
          error={errosDeCampo.name ?? ''}
          onChange={(evento) => {
            setNome(evento.target.value);
          }}
        />

        <TextField
          id="register-email"
          label={MESSAGES.REGISTER.EMAIL_LABEL}
          type="email"
          autoComplete="email"
          placeholder={MESSAGES.REGISTER.EMAIL_PLACEHOLDER}
          value={email}
          error={errosDeCampo.email ?? ''}
          onChange={(evento) => {
            setEmail(evento.target.value);
          }}
        />

        {/*
          `new-password` nos DOIS campos de senha: e o valor que faz o gerenciador
          de senhas do navegador oferecer uma senha nova e preencher os dois
          campos com o mesmo valor. `current-password` aqui ofereceria a senha
          antiga do site.
        */}
        <PasswordField
          id="register-password"
          label={MESSAGES.REGISTER.PASSWORD_LABEL}
          autoComplete="new-password"
          placeholder={MESSAGES.REGISTER.PASSWORD_PLACEHOLDER}
          value={senha}
          error={errosDeCampo.password ?? ''}
          onChange={(evento) => {
            setSenha(evento.target.value);
          }}
        />

        <PasswordField
          id="register-password-confirmation"
          label={MESSAGES.REGISTER.PASSWORD_CONFIRMATION_LABEL}
          autoComplete="new-password"
          placeholder={MESSAGES.REGISTER.PASSWORD_CONFIRMATION_PLACEHOLDER}
          value={confirmacaoDeSenha}
          error={errosDeCampo.passwordConfirmation ?? ''}
          onChange={(evento) => {
            setConfirmacaoDeSenha(evento.target.value);
          }}
        />

        <SubmitButton isLoading={cadastrando} className="mt-1.5">
          {MESSAGES.REGISTER.SUBMIT}
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-[0.8rem] font-semibold text-ink-mid">
        <Link to={ROUTE_PATHS.LOGIN} className={CLASSES_DO_LINK}>
          {MESSAGES.REGISTER.HAS_ACCOUNT}
        </Link>
      </p>
    </AuthCard>
  );
}
