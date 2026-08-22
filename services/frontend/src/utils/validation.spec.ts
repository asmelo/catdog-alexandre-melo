import { MESSAGES } from '~/utils/messages';
import {
  hasFieldErrors,
  validateEmailOnlyForm,
  validateLoginForm,
  validateRegisterForm,
} from '~/utils/validation';

/**
 * Specs das regras de validacao de formulario.
 *
 * Cada regra e exercitada CHAMANDO A FUNCAO, e nao montando uma arvore, digitando
 * num campo e lendo o DOM. Foi para isso que a TASK-FRONTEND-008 as deixou puras:
 * uma regra verificada por consulta ao DOM e uma regra verificada de forma
 * indireta, e o teste passaria a falhar por mudanca de marcacao.
 *
 * As mensagens sao comparadas contra `MESSAGES`, nao contra literais repetidas
 * aqui. Duplicar as frases criaria uma segunda fonte de verdade para o mesmo texto
 * — exatamente o que o catalogo existe para evitar.
 */

const SENHA_VALIDA = 'Abc12345';

describe('validateLoginForm', () => {
  it('aceita e-mail e senha preenchidos', () => {
    expect(validateLoginForm({ email: 'pessoa@catdog.test', password: SENHA_VALIDA })).toEqual({});
  });

  it('exige e-mail e senha, e a obrigatoriedade vence o formato', () => {
    const erros = validateLoginForm({ email: '', password: '' });

    // Campo vazio recebe "Este campo é obrigatório.", nao "Informe um e-mail
    // válido.": o problema a resolver primeiro e o de preencher.
    expect(erros).toEqual({
      email: MESSAGES.VALIDATION.FIELD_REQUIRED,
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('trata campo com apenas espacos como em branco', () => {
    // O `nameSchema`/`loginSchema` do backend tambem aparam antes de exigir
    // conteudo; sem o `.trim()` aqui, " " passaria e voltaria como
    // `VALIDATION_ERROR` do servidor.
    expect(validateLoginForm({ email: '   ', password: '   ' })).toEqual({
      email: MESSAGES.VALIDATION.FIELD_REQUIRED,
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('reprova e-mail sem arroba, sem dominio ou com espaco', () => {
    for (const email of ['sem-arroba', 'pessoa@sem-ponto', 'pessoa @catdog.test', '@catdog.test']) {
      expect(validateLoginForm({ email, password: SENHA_VALIDA })).toEqual({
        email: MESSAGES.VALIDATION.EMAIL_INVALID,
      });
    }
  });

  it('NAO aplica o tamanho minimo de senha no login', () => {
    /**
     * Omissao deliberada. Responder "A senha deve ter pelo menos 8 caracteres."
     * na tela de login informaria a quem sonda o sistema qual e o formato aceito
     * e, para uma conta antiga com senha mais curta, bloquearia o login em vez de
     * recusar a credencial. E a mesma decisao do `loginSchema` do backend.
     */
    expect(validateLoginForm({ email: 'pessoa@catdog.test', password: 'curta' })).toEqual({});
  });
});

describe('validateRegisterForm', () => {
  const validos = {
    name: 'Caio Cliente',
    email: 'pessoa@catdog.test',
    password: SENHA_VALIDA,
    passwordConfirmation: SENHA_VALIDA,
  };

  it('aceita o formulario completo e valido', () => {
    expect(validateRegisterForm(validos)).toEqual({});
  });

  it('CT-18: senha com exatamente 8 caracteres e aceita', () => {
    // Borda inferior da RN-04: 8 passa, 7 nao.
    expect(validateRegisterForm({ ...validos, password: 'Abc12345', passwordConfirmation: 'Abc12345' })).toEqual({});
  });

  it('reprova senha com 7 caracteres', () => {
    expect(validateRegisterForm({ ...validos, password: 'Abc1234', passwordConfirmation: 'Abc1234' })).toEqual({
      password: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT,
    });
  });

  it('avalia TODAS as regras em uma passada, e nao apenas a primeira que falha', () => {
    const erros = validateRegisterForm({
      name: '',
      email: 'invalido',
      password: 'curta',
      passwordConfirmation: 'outra',
    });

    // Um formulario que aponta um problema por vez obriga o usuario a submeter
    // quatro vezes para descobrir os quatro erros.
    expect(erros).toEqual({
      name: MESSAGES.VALIDATION.FIELD_REQUIRED,
      email: MESSAGES.VALIDATION.EMAIL_INVALID,
      password: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT,
      passwordConfirmation: MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH,
    });
  });

  it('senha vazia e ausencia, nao senha curta', () => {
    expect(validateRegisterForm({ ...validos, password: '', passwordConfirmation: '' })).toEqual({
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
      passwordConfirmation: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('NAO apara a senha: espaco e caractere valido de segredo', () => {
    // Aparar mudaria em silencio o segredo escolhido. Oito espacos e uma senha
    // ruim, nao uma senha ausente.
    expect(validateRegisterForm({ ...validos, password: '        ', passwordConfirmation: '        ' })).toEqual({});
  });

  it('confirmacao em branco recebe obrigatoriedade, nao divergencia', () => {
    // Emitir "As senhas não coincidem." para um campo vazio culparia o usuario por
    // algo que ele ainda nao fez.
    expect(validateRegisterForm({ ...validos, passwordConfirmation: '' })).toEqual({
      passwordConfirmation: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('RN-12: a confirmacao divergente e reportada no proprio campo', () => {
    expect(validateRegisterForm({ ...validos, passwordConfirmation: `${SENHA_VALIDA}x` })).toEqual({
      passwordConfirmation: MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH,
    });
  });
});

describe('validateEmailOnlyForm', () => {
  it('aceita e-mail valido e reprova em branco e mal formado', () => {
    expect(validateEmailOnlyForm('pessoa@catdog.test')).toEqual({});
    expect(validateEmailOnlyForm('')).toEqual({ email: MESSAGES.VALIDATION.FIELD_REQUIRED });
    expect(validateEmailOnlyForm('invalido')).toEqual({ email: MESSAGES.VALIDATION.EMAIL_INVALID });
  });
});

describe('hasFieldErrors', () => {
  it('distingue mapa vazio de mapa com ao menos um campo', () => {
    expect(hasFieldErrors({})).toBe(false);
    expect(hasFieldErrors({ email: MESSAGES.VALIDATION.EMAIL_INVALID })).toBe(true);
  });
});
