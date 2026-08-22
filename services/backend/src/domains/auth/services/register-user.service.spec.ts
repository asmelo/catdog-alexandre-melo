import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

import { registerSchema } from '~/domains/auth/auth.validators';
import { EmailAlreadyInUseError } from '~/domains/auth/errors/registration.errors';
import { RegisterUserService } from '~/domains/auth/services/register-user.service';
import { SendConfirmationMailService } from '~/domains/auth/services/send-confirmation-mail.service';
import * as clock from '~/utils/clock';
import { hashToken } from '~/utils/secure-token';

import { FakeMailer } from '../../../../tests/fakes/fake-mailer';
import { criarPrismaComTransacao } from '../../../../tests/fakes/prisma-double';
import {
  ArmazemDeTokensDeConfirmacao,
  InMemoryEmailConfirmationTokenRepository,
} from '../../../../tests/fakes/in-memory-token.repositories';
import {
  ArmazemDeUsuarios,
  InMemoryUserRepository,
  erroDeEmailDuplicado,
} from '../../../../tests/fakes/in-memory-user.repository';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-01 — registro de conta (CT-01, CT-02, CT-04, CT-18).
 *
 * Casos de teste cobertos aqui e por que neste nível: CT-01/CT-02 e a política de
 * falha de SMTP são REGRA do caso de uso; CT-04 e CT-18 são o limite de 8
 * caracteres da RN-04, que vive na única fronteira de validação do projeto
 * (`registerSchema`) — o service jamais recebe uma senha curta, e afirmar o
 * contrário aqui seria testar um caminho que a aplicação não tem.
 */

/** Instante fixo para as asserções de TTL. O relógio real fica intocado. */
const INSTANTE = new Date('2026-03-10T12:00:00.000Z');
const VINTE_E_QUATRO_HORAS_EM_MS = 24 * 60 * 60 * 1000;

const ENTRADA_VALIDA = {
  name: 'Ana Silva',
  email: 'ana@exemplo.com',
  password: 'Senha123!',
} as const;

describe('RegisterUserService', () => {
  let armazemDeUsuarios: ArmazemDeUsuarios;
  let armazemDeTokens: ArmazemDeTokensDeConfirmacao;
  let usuarios: InMemoryUserRepository;
  let tokens: InMemoryEmailConfirmationTokenRepository;
  let mailer: FakeMailer;
  let servico: RegisterUserService;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();

    armazemDeUsuarios = new ArmazemDeUsuarios();
    armazemDeTokens = new ArmazemDeTokensDeConfirmacao();
    usuarios = new InMemoryUserRepository(armazemDeUsuarios);
    tokens = new InMemoryEmailConfirmationTokenRepository(armazemDeTokens);
    mailer = new FakeMailer();

    servico = new RegisterUserService(
      usuarios,
      tokens,
      // O mailer entra como FÁBRICA, como em produção: é o que permite ao
      // backend subir sem SMTP configurado.
      new SendConfirmationMailService(() => mailer),
      criarPrismaComTransacao(armazemDeUsuarios, armazemDeTokens),
    );
  });

  it('CT-01: registro com campos válidos e e-mail novo cria a conta pendente e envia o e-mail de confirmação', async () => {
    // Arrange
    jest.spyOn(clock, 'now').mockReturnValue(INSTANTE);

    // Act
    await servico.execute(ENTRADA_VALIDA);

    // Assert
    expect(armazemDeUsuarios.linhas).toHaveLength(1);
    expect(armazemDeUsuarios.linhas[0]).toMatchObject({
      name: 'Ana Silva',
      email: 'ana@exemplo.com',
      // RN-08: o auto-registro sempre produz CLIENTE — a role não é parâmetro.
      role: UserRole.CLIENTE,
      status: UserStatus.PENDING_CONFIRMATION,
      emailConfirmedAt: null,
    });
    expect(mailer.sentMessages).toHaveLength(1);
    expect(mailer.ultimaMensagem?.to).toBe('ana@exemplo.com');
    expect(mailer.ultimaMensagem?.subject).toBe('Confirme sua conta na CatDog');
  });

  it('CT-01: o e-mail carrega o token em claro e o banco guarda apenas o SHA-256, com validade de 24 h (RN-02)', async () => {
    // Arrange
    jest.spyOn(clock, 'now').mockReturnValue(INSTANTE);

    // Act
    await servico.execute(ENTRADA_VALIDA);

    // Assert
    const tokenEnviado = extrairTokenDoEmail(mailer.ultimaMensagem?.text);
    const registro = armazemDeTokens.linhas[0];

    expect(registro).toBeDefined();
    // O token em claro NUNCA é persistido: o que está na linha é o hash dele.
    expect(registro?.tokenHash).toBe(hashToken(tokenEnviado));
    expect(registro?.tokenHash).not.toBe(tokenEnviado);
    expect(registro?.consumedAt).toBeNull();
    expect(registro?.expiresAt.getTime()).toBe(
      INSTANTE.getTime() + VINTE_E_QUATRO_HORAS_EM_MS,
    );
  });

  it('CT-01: a senha é persistida exclusivamente como hash bcrypt (RNF-01 / CA-13)', async () => {
    // Arrange & Act
    await servico.execute(ENTRADA_VALIDA);

    // Assert
    const persistido = armazemDeUsuarios.linhas[0]?.passwordHash ?? '';

    expect(persistido).not.toContain(ENTRADA_VALIDA.password);
    expect(persistido).toMatch(/^\$2[aby]\$\d{2}\$/);
    await expect(bcrypt.compare(ENTRADA_VALIDA.password, persistido)).resolves.toBe(true);
  });

  it('CT-02: e-mail já cadastrado é recusado com "Este e-mail já está em uso." e nada é criado', async () => {
    // Arrange — RN-13: bloqueia em QUALQUER status, inclusive conta pendente.
    armazemDeUsuarios.semear({ email: 'ana@exemplo.com' });

    // Act
    const resultado = servico.execute(ENTRADA_VALIDA);

    // Assert
    await expect(resultado).rejects.toThrow(EmailAlreadyInUseError);
    await expect(resultado).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'Este e-mail já está em uso.',
    });
    expect(armazemDeUsuarios.linhas).toHaveLength(1);
    expect(armazemDeTokens.linhas).toHaveLength(0);
    expect(mailer.sentMessages).toHaveLength(0);
  });

  it('CT-02: cadastro simultâneo que perde a constraint de unicidade também responde EMAIL_ALREADY_IN_USE', async () => {
    // Arrange — a consulta prévia não vê o concorrente (ela roda antes do
    // commit dele) e a colisão só aparece no INSERT, como P2002.
    armazemDeUsuarios.semear({ email: 'ana@exemplo.com' });
    jest.spyOn(usuarios, 'findByEmail').mockResolvedValueOnce(null);

    // Act & Assert — sem a tradução do P2002 o perdedor da corrida receberia 500.
    await expect(servico.execute(ENTRADA_VALIDA)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_ALREADY_IN_USE',
    });
  });

  it('CT-02: colisão de unicidade sem alvo identificável é tratada como e-mail duplicado', async () => {
    // Arrange — o Postgres pode devolver `meta.target` ausente; o service assume
    // e-mail, porque a outra unicidade alcançada é um token de 256 bits.
    const semAlvo = erroDeEmailDuplicado();

    Reflect.deleteProperty(semAlvo, 'meta');
    jest.spyOn(usuarios, 'create').mockRejectedValueOnce(semAlvo);

    // Act & Assert
    await expect(servico.execute(ENTRADA_VALIDA)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_IN_USE',
    });
  });

  it('CT-02: colisão reportada com `meta.target` textual também vira EMAIL_ALREADY_IN_USE', async () => {
    // Arrange — o Postgres devolve em `target` ora o nome do índice
    // (`users_email_key`, uma string), ora a lista de campos (um array). O
    // service trata as duas formas, e este é o ramo textual.
    const comAlvoTextual = erroDeEmailDuplicado();

    Reflect.set(comAlvoTextual, 'meta', { target: 'users_email_key' });
    jest.spyOn(usuarios, 'create').mockRejectedValueOnce(comAlvoTextual);

    // Act & Assert
    await expect(servico.execute(ENTRADA_VALIDA)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_IN_USE',
    });
  });

  it('CT-02: colisão em OUTRA unicidade (não o e-mail) NÃO é mascarada como 409', async () => {
    // Arrange — a colisão de `token_hash` seria um problema completamente
    // diferente, e responder "e-mail em uso" esconderia a causa real.
    const colisaoDeToken = erroDeEmailDuplicado();

    Reflect.set(colisaoDeToken, 'meta', { target: ['token_hash'] });
    jest.spyOn(usuarios, 'create').mockRejectedValueOnce(colisaoDeToken);

    // Act & Assert
    await expect(servico.execute(ENTRADA_VALIDA)).rejects.toThrow(colisaoDeToken);
  });

  it('CT-02: falha que não é violação de unicidade PROPAGA em vez de virar 409', async () => {
    // Arrange
    const indisponivel = new Error('conexao com o banco encerrada');

    jest.spyOn(usuarios, 'create').mockRejectedValueOnce(indisponivel);

    // Act & Assert — mascarar isto como conflito esconderia uma falha real.
    await expect(servico.execute(ENTRADA_VALIDA)).rejects.toThrow(indisponivel);
  });

  it('CT-04: senha de 7 caracteres é recusada com "A senha deve ter pelo menos 8 caracteres." (RN-04)', () => {
    // Arrange
    const corpo = { ...ENTRADA_VALIDA, password: 'Abc1234' };

    // Act
    const resultado = registerSchema.safeParse(corpo);

    // Assert
    expect(resultado.success).toBe(false);
    expect(problemasPorCampo(resultado)).toEqual([
      { field: 'password', message: 'A senha deve ter pelo menos 8 caracteres.' },
    ]);
  });

  it('CT-18: senha de exatamente 8 caracteres passa na validação e a conta é criada', async () => {
    // Arrange — limite inferior da RN-04: 8 é aceito, 7 não.
    const corpo = { ...ENTRADA_VALIDA, password: 'Abc12345' };
    const validado = registerSchema.safeParse(corpo);

    // Act
    await servico.execute({ ...corpo });

    // Assert
    expect(validado.success).toBe(true);
    expect(armazemDeUsuarios.linhas).toHaveLength(1);
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.PENDING_CONFIRMATION);
    expect(mailer.sentMessages).toHaveLength(1);
  });

  it('CT-01: indisponibilidade do SMTP não desfaz o cadastro nem propaga exceção', async () => {
    // Arrange — a tabela de Integrações da spec manda registrar a falha e
    // permitir reenvio manual; derrubar o cadastro perderia uma conta já gravada.
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mailer.falharComoSmtpIndisponivel();

    // Act
    await expect(servico.execute(ENTRADA_VALIDA)).resolves.toBeUndefined();

    // Assert
    expect(armazemDeUsuarios.linhas).toHaveLength(1);
    expect(armazemDeTokens.linhas).toHaveLength(1);
    expect(mailer.sentMessages).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Falha no envio do e-mail de confirmacao'),
      expect.objectContaining({ evento: 'confirmation_mail_send_failed' }),
    );
  });

  it('CT-01: o log de falha de envio NÃO carrega o e-mail nem o token', async () => {
    // Arrange — log é destino de baixo controle de acesso.
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mailer.falharComoSmtpIndisponivel();

    // Act
    await servico.execute(ENTRADA_VALIDA);

    // Assert
    const registrado = JSON.stringify(log.mock.calls);

    expect(registrado).not.toContain(ENTRADA_VALIDA.email);
    expect(registrado).not.toContain(armazemDeTokens.linhas[0]?.tokenHash ?? 'hash');
  });
});

/**
 * Extrai o token do corpo em texto puro do e-mail. Lê a mensagem REAL enviada, e
 * não um valor que o teste já conhecia: é assim que se verifica que o link
 * entregue ao usuário corresponde ao hash gravado.
 */
function extrairTokenDoEmail(corpo: string | undefined): string {
  const encontrado = /[?&]token=([^\s&]+)/.exec(corpo ?? '');
  const token = encontrado?.[1];

  if (token === undefined) {
    throw new Error(`Nenhum token encontrado no corpo do e-mail: ${String(corpo)}`);
  }

  return decodeURIComponent(token);
}

/** Achata o `ZodError` na mesma forma do `details` que a API publica. */
function problemasPorCampo(
  resultado: ReturnType<typeof registerSchema.safeParse>,
): ReadonlyArray<{ field: string; message: string }> {
  if (resultado.success) {
    return [];
  }

  return resultado.error.issues.map((problema) => ({
    field: problema.path.join('.'),
    message: problema.message,
  }));
}
