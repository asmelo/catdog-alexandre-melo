import {
  RefreshTokenRevokedReason,
  UserRole,
  UserStatus,
  type RefreshToken,
} from '@prisma/client';

import { SessionExpiredError } from '~/domains/auth/errors/session.errors';
import { RefreshSessionService } from '~/domains/auth/services/refresh-session.service';
import { verifyAccessToken } from '~/domains/auth/tokens/access-token.service';
import * as clock from '~/utils/clock';
import { hashToken } from '~/utils/secure-token';

import { criarPrismaComTransacao } from '../../../../tests/fakes/prisma-double';
import {
  ArmazemDeRefreshTokens,
  InMemoryRefreshTokenRepository,
} from '../../../../tests/fakes/in-memory-token.repositories';
import {
  ArmazemDeUsuarios,
  InMemoryUserRepository,
} from '../../../../tests/fakes/in-memory-user.repository';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-04 — renovação de sessão (CT-14, CT-15) com rotação obrigatória (RN-06) e
 * derrubada da família inteira no reuso (RN-07).
 *
 * É o slice mais delicado da feature: TODO desfecho de falha responde a MESMA
 * `SessionExpiredError`, então nenhum teste pode se contentar com "deu 401" — cada
 * cenário verifica também o EFEITO no banco, que é a única coisa que distingue os
 * casos entre si.
 */

const INSTANTE = new Date('2026-03-10T12:00:00.000Z');
const UMA_HORA_EM_MS = 60 * 60 * 1000;
const SETE_DIAS_EM_MS = 7 * 24 * UMA_HORA_EM_MS;

const FAMILIA = '11111111-1111-4111-8111-111111111111';

const MENSAGEM_DE_SESSAO_EXPIRADA = 'Sua sessão expirou. Faça login novamente.';

const METADADOS = {
  ip: '203.0.113.7',
  userAgent: 'jest/29',
} as const;

describe('RefreshSessionService', () => {
  let armazemDeUsuarios: ArmazemDeUsuarios;
  let armazemDeRefreshTokens: ArmazemDeRefreshTokens;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let servico: RefreshSessionService;
  let idDoUsuario: string;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();
    jest.spyOn(clock, 'now').mockReturnValue(INSTANTE);

    armazemDeUsuarios = new ArmazemDeUsuarios();
    armazemDeRefreshTokens = new ArmazemDeRefreshTokens();
    refreshTokens = new InMemoryRefreshTokenRepository(armazemDeRefreshTokens);

    idDoUsuario = armazemDeUsuarios.semear({
      email: 'ana@exemplo.com',
      role: UserRole.CLIENTE,
      status: UserStatus.ACTIVE,
      emailConfirmedAt: INSTANTE,
    }).id;

    servico = new RefreshSessionService(
      new InMemoryUserRepository(armazemDeUsuarios),
      refreshTokens,
      criarPrismaComTransacao(armazemDeRefreshTokens, armazemDeUsuarios),
    );
  });

  /** Semeia um elo da cadeia de rotação com o hash do valor em claro. */
  function semearToken(
    rawToken: string,
    dados: {
      readonly expiresAt?: Date;
      readonly revokedAt?: Date | null;
      readonly revokedReason?: RefreshTokenRevokedReason | null;
    } = {},
  ): string {
    return armazemDeRefreshTokens.semear({
      userId: idDoUsuario,
      familyId: FAMILIA,
      tokenHash: hashToken(rawToken),
      expiresAt: dados.expiresAt ?? new Date(INSTANTE.getTime() + SETE_DIAS_EM_MS),
      revokedAt: dados.revokedAt ?? null,
      revokedReason: dados.revokedReason ?? null,
    }).id;
  }

  // ------------------------------------------------------------------------
  // CT-14 — renovação legítima
  // ------------------------------------------------------------------------

  it('CT-14: refresh token válido emite novo par de tokens e invalida o anterior (RN-06)', async () => {
    // Arrange
    const idAntigo = semearToken('refresh-legitimo');

    // Act
    const sessao = await servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS });

    // Assert — o token novo é DIFERENTE e o antigo saiu como ROTATED apontando
    // para o substituto (auditoria da cadeia).
    const antigo = armazemDeRefreshTokens.linhas.find((token) => token.id === idAntigo);
    const novo = armazemDeRefreshTokens.buscarPorHash(hashToken(sessao.refreshToken));

    expect(sessao.refreshToken).not.toBe('refresh-legitimo');
    expect(novo).not.toBeNull();
    expect(antigo).toMatchObject({
      revokedAt: INSTANTE,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
      replacedById: novo?.id,
    });
    expect(novo?.revokedAt).toBeNull();
    // Mesma SESSÃO: a família é preservada na rotação.
    expect(novo?.familyId).toBe(FAMILIA);
  });

  it('CT-14: o vencimento do refresh token é recalculado a cada rotação (TTL deslizante de 7 dias)', async () => {
    // Arrange — o token antigo vence em 1 h; o novo tem de nascer com 7 dias.
    semearToken('refresh-legitimo', {
      expiresAt: new Date(INSTANTE.getTime() + UMA_HORA_EM_MS),
    });

    // Act
    const sessao = await servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS });

    // Assert
    const novo = armazemDeRefreshTokens.buscarPorHash(hashToken(sessao.refreshToken));

    expect(novo?.expiresAt.getTime()).toBe(INSTANTE.getTime() + SETE_DIAS_EM_MS);
  });

  it('CT-14: o access token emitido carrega `sub` e `role` do usuário e `expiresIn` em segundos', async () => {
    // Arrange
    semearToken('refresh-legitimo');

    // Act
    const sessao = await servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS });

    // Assert — `role` sai em minúsculas (contrato do JWT e das rotas).
    expect(verifyAccessToken(sessao.accessToken)).toMatchObject({
      sub: idDoUsuario,
      role: 'cliente',
      typ: 'access',
    });
    expect(sessao.expiresIn).toBe(900);
    expect(sessao.user).toEqual({
      id: idDoUsuario,
      name: 'Ana Silva',
      email: 'ana@exemplo.com',
      role: 'cliente',
    });
  });

  it('CT-14: o refresh token em claro não aparece em nenhum campo persistido', async () => {
    // Arrange
    semearToken('refresh-legitimo');

    // Act
    const sessao = await servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS });

    // Assert — o banco guarda somente o SHA-256.
    const persistido = JSON.stringify(armazemDeRefreshTokens.linhas);

    expect(persistido).not.toContain(sessao.refreshToken);
    expect(persistido).toContain(hashToken(sessao.refreshToken));
  });

  // ------------------------------------------------------------------------
  // CT-15 — reuso de token rotacionado (RN-07)
  // ------------------------------------------------------------------------

  it('CT-15: reutilização de refresh token rotacionado encerra a sessão inteira e nenhum token da família permanece utilizável', async () => {
    // Arrange — cadeia real de rotação: T1 → T2 → T3, com T3 ainda ativo.
    // O atacante reapresenta T1, o elo mais antigo.
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const revogadoEm = new Date(INSTANTE.getTime() - 2 * UMA_HORA_EM_MS);

    const idT1 = semearToken('rotacionado-1', {
      revokedAt: revogadoEm,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
    });
    const idT2 = semearToken('rotacionado-2', {
      revokedAt: revogadoEm,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
    });
    const idT3 = semearToken('legitimo-mais-recente');

    // Act
    const resultado = servico.execute({ rawToken: 'rotacionado-1', ...METADADOS });

    // Assert — o desfecho para o cliente é o 401 genérico da spec.
    await expect(resultado).rejects.toThrow(SessionExpiredError);
    await expect(resultado).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_EXPIRED',
      message: MENSAGEM_DE_SESSAO_EXPIRADA,
    });

    const familia = armazemDeRefreshTokens.daFamilia(FAMILIA);

    // (1) TODOS os tokens da família estão revogados: nenhum renova mais nada.
    expect(familia).toHaveLength(3);
    expect(familia.every((token) => token.revokedAt !== null)).toBe(true);

    // (2) O que ainda estava ATIVO saiu com REUSE_DETECTED.
    expect(porId(familia, idT3)).toMatchObject({
      revokedAt: INSTANTE,
      revokedReason: RefreshTokenRevokedReason.REUSE_DETECTED,
    });

    // (3) Os que já estavam revogados PRESERVAM o motivo original — inclusive o
    // token reapresentado, que continua ROTATED. O filtro `revokedAt: null` do
    // `revokeFamily` os exclui por construção, e é isso que impede a detecção de
    // apagar a informação de que aquele token foi legitimamente rotacionado.
    expect(porId(familia, idT1)).toMatchObject({
      revokedAt: revogadoEm,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
    });
    expect(porId(familia, idT2)).toMatchObject({
      revokedAt: revogadoEm,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
    });

    // (4) O token legítimo MAIS RECENTE também passa a ser rejeitado — é ele que
    // prova que a sessão inteira caiu, e não apenas o elo reapresentado.
    await expect(
      servico.execute({ rawToken: 'legitimo-mais-recente', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

    // (5) Nenhum token novo foi emitido em nenhuma das duas tentativas.
    expect(armazemDeRefreshTokens.daFamilia(FAMILIA)).toHaveLength(3);
    expect(aviso).toHaveBeenCalled();
  });

  it('CT-15: o reuso emite o evento de auditoria `refresh_token_reuse_detected` sem registrar o token', async () => {
    // Arrange — a resposta ao cliente é genérica de propósito, então o log é a
    // única pista que o time tem de um token vazado.
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    semearToken('rotacionado-1', {
      revokedAt: INSTANTE,
      revokedReason: RefreshTokenRevokedReason.ROTATED,
    });

    // Act
    await expect(
      servico.execute({ rawToken: 'rotacionado-1', ...METADADOS }),
    ).rejects.toThrow(SessionExpiredError);

    // Assert
    expect(aviso).toHaveBeenCalledWith(
      expect.stringContaining('Reutilizacao de refresh token detectada'),
      expect.objectContaining({
        evento: 'refresh_token_reuse_detected',
        userId: idDoUsuario,
        familyId: FAMILIA,
        ip: METADADOS.ip,
        userAgent: METADADOS.userAgent,
      }),
    );
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('rotacionado-1');
  });

  it('CT-15: cookie reapresentado depois do logout é tratado como reuso e o motivo LOGOUT é PRESERVADO', async () => {
    // Arrange — a família inteira já saiu como LOGOUT.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const encerradoEm = new Date(INSTANTE.getTime() - UMA_HORA_EM_MS);

    semearToken('token-do-logout', {
      revokedAt: encerradoEm,
      revokedReason: RefreshTokenRevokedReason.LOGOUT,
    });

    // Act
    await expect(
      servico.execute({ rawToken: 'token-do-logout', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

    // Assert — `revokeFamily` altera ZERO linhas e o histórico não é corrompido:
    // um LOGOUT não vira REUSE_DETECTED.
    expect(armazemDeRefreshTokens.daFamilia(FAMILIA)[0]).toMatchObject({
      revokedAt: encerradoEm,
      revokedReason: RefreshTokenRevokedReason.LOGOUT,
    });
  });

  it('CT-15: perder o compare-and-swap da rotação recebe o mesmo tratamento do reuso e o token recém-criado desaparece no rollback', async () => {
    // Arrange — duas renovações simultâneas: a segunda encontra `revoked_at` já
    // preenchido e `markRotated` devolve 0. Do ponto de vista do servidor é a
    // mesma evidência do reuso.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    semearToken('refresh-legitimo');
    jest.spyOn(refreshTokens, 'markRotated').mockResolvedValueOnce(0);

    // Act
    await expect(
      servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

    // Assert — a transação abortou: sobra APENAS o token original, agora
    // revogado. Sem o rollback, o token novo ficaria vivo e utilizável.
    const familia = armazemDeRefreshTokens.daFamilia(FAMILIA);

    expect(familia).toHaveLength(1);
    expect(familia[0]?.revokedAt).toEqual(INSTANTE);
    expect(familia[0]?.revokedReason).toBe(RefreshTokenRevokedReason.REUSE_DETECTED);
  });

  it('CT-15: falha inesperada dentro da transação PROPAGA em vez de virar sessão expirada', async () => {
    // Arrange — mascarar um erro de infraestrutura como 401 faria o cliente
    // deslogar o usuário por indisponibilidade do banco.
    const indisponivel = new Error('conexao com o banco encerrada');

    semearToken('refresh-legitimo');
    jest.spyOn(refreshTokens, 'create').mockRejectedValueOnce(indisponivel);

    // Act & Assert
    await expect(
      servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS }),
    ).rejects.toThrow(indisponivel);
  });

  // ------------------------------------------------------------------------
  // Demais desfechos de falha — todos com a MESMA resposta e efeitos diferentes
  // ------------------------------------------------------------------------

  it('cookie ausente responde sessão expirada sem tocar o banco', async () => {
    // Arrange
    semearToken('refresh-legitimo');

    // Act & Assert
    await expect(
      servico.execute({ rawToken: undefined, ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED', message: MENSAGEM_DE_SESSAO_EXPIRADA });
    expect(armazemDeRefreshTokens.daFamilia(FAMILIA)[0]?.revokedAt).toBeNull();
  });

  it('token desconhecido responde sessão expirada e NÃO revoga família alguma', async () => {
    // Arrange — lixo no cookie não é evidência de roubo: não há família a
    // derrubar, e derrubar a de outro usuário seria um vetor de negação de serviço.
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    semearToken('refresh-legitimo');

    // Act & Assert
    await expect(
      servico.execute({ rawToken: 'token-que-nunca-existiu', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(armazemDeRefreshTokens.daFamilia(FAMILIA)[0]?.revokedAt).toBeNull();
    expect(aviso).not.toHaveBeenCalled();
  });

  it('refresh token expirado revoga SÓ ele, como EXPIRED, e não a família', async () => {
    // Arrange — vencimento é fim de vida normal, não indício de roubo.
    const idVencido = semearToken('refresh-vencido', {
      expiresAt: new Date(INSTANTE.getTime() - UMA_HORA_EM_MS),
    });
    const idAtivo = semearToken('refresh-de-outra-aba');

    // Act & Assert
    await expect(
      servico.execute({ rawToken: 'refresh-vencido', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

    const familia = armazemDeRefreshTokens.daFamilia(FAMILIA);

    expect(porId(familia, idVencido)).toMatchObject({
      revokedAt: INSTANTE,
      revokedReason: RefreshTokenRevokedReason.EXPIRED,
    });
    expect(porId(familia, idAtivo)?.revokedAt).toBeNull();
  });

  it('conta desativada derruba a família inteira como ACCOUNT_DISABLED', async () => {
    // Arrange — RN-01: só conta ACTIVE autentica, e a verificação vale também na
    // renovação (o access token de 15 min não conhece mudança de status).
    armazemDeUsuarios.limpar();
    idDoUsuario = armazemDeUsuarios.semear({
      status: UserStatus.PENDING_CONFIRMATION,
    }).id;

    semearToken('refresh-legitimo');
    const idOutro = semearToken('refresh-de-outra-aba');

    // Act & Assert
    await expect(
      servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

    const familia = armazemDeRefreshTokens.daFamilia(FAMILIA);

    expect(familia.every((token) => token.revokedAt !== null)).toBe(true);
    expect(porId(familia, idOutro)?.revokedReason).toBe(
      RefreshTokenRevokedReason.ACCOUNT_DISABLED,
    );
  });

  it('usuário apagado com refresh token ainda válido também derruba a família', async () => {
    // Arrange — `findById` devolve `null` e o encadeamento opcional do service
    // trata os dois casos (inexistente e não-ACTIVE) pelo mesmo caminho.
    semearToken('refresh-legitimo');
    armazemDeUsuarios.limpar();

    // Act & Assert
    await expect(
      servico.execute({ rawToken: 'refresh-legitimo', ...METADADOS }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(armazemDeRefreshTokens.daFamilia(FAMILIA)[0]?.revokedReason).toBe(
      RefreshTokenRevokedReason.ACCOUNT_DISABLED,
    );
  });
});

/** Localiza um elo da família pelo id. */
function porId(
  familia: ReadonlyArray<RefreshToken>,
  id: string,
): RefreshToken | undefined {
  return familia.find((token) => token.id === id);
}
