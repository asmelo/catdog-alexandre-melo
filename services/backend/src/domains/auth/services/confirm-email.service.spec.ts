import { UserStatus } from '@prisma/client';

import { ConfirmEmailService } from '~/domains/auth/services/confirm-email.service';
import * as clock from '~/utils/clock';
import { hashToken } from '~/utils/secure-token';

import { criarPrismaComTransacao } from '../../../../tests/fakes/prisma-double';
import {
  ArmazemDeTokensDeConfirmacao,
  InMemoryEmailConfirmationTokenRepository,
} from '../../../../tests/fakes/in-memory-token.repositories';
import {
  ArmazemDeUsuarios,
  InMemoryUserRepository,
} from '../../../../tests/fakes/in-memory-user.repository';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-02 — confirmação de conta pelo link do e-mail (CT-06, CT-07, CT-08).
 *
 * O token em claro NUNCA está no banco: cada cenário semeia a linha com
 * `hashToken(TOKEN_EM_CLARO)` e entrega ao service o valor em claro, que é o
 * caminho real (e-mail → frontend → `POST /confirm-email`).
 */

const INSTANTE = new Date('2026-03-10T12:00:00.000Z');
const UMA_HORA_EM_MS = 60 * 60 * 1000;

const TOKEN_EM_CLARO = 'token-em-claro-com-mais-de-32-caracteres-para-o-schema';

describe('ConfirmEmailService', () => {
  let armazemDeUsuarios: ArmazemDeUsuarios;
  let armazemDeTokens: ArmazemDeTokensDeConfirmacao;
  let tokens: InMemoryEmailConfirmationTokenRepository;
  let servico: ConfirmEmailService;
  let idDoUsuario: string;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();
    jest.spyOn(clock, 'now').mockReturnValue(INSTANTE);

    armazemDeUsuarios = new ArmazemDeUsuarios();
    armazemDeTokens = new ArmazemDeTokensDeConfirmacao();
    tokens = new InMemoryEmailConfirmationTokenRepository(armazemDeTokens);

    idDoUsuario = armazemDeUsuarios.semear({
      status: UserStatus.PENDING_CONFIRMATION,
    }).id;

    servico = new ConfirmEmailService(
      new InMemoryUserRepository(armazemDeUsuarios),
      tokens,
      criarPrismaComTransacao(armazemDeUsuarios, armazemDeTokens),
    );
  });

  /** Semeia a linha do token com o hash do valor em claro, como em produção. */
  function semearToken(dados: { expiresAt: Date; consumedAt?: Date }): void {
    armazemDeTokens.semear({
      userId: idDoUsuario,
      tokenHash: hashToken(TOKEN_EM_CLARO),
      expiresAt: dados.expiresAt,
      ...(dados.consumedAt === undefined ? {} : { consumedAt: dados.consumedAt }),
    });
  }

  it('CT-06: link válido e não expirado ativa a conta e marca o token como consumido', async () => {
    // Arrange
    semearToken({ expiresAt: new Date(INSTANTE.getTime() + UMA_HORA_EM_MS) });

    // Act
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).resolves.toBeUndefined();

    // Assert — a conta fica ACTIVE e o instante de confirmação é o MESMO usado
    // para consumir o token: as duas escritas acontecem na mesma transação.
    expect(armazemDeUsuarios.linhas[0]).toMatchObject({
      status: UserStatus.ACTIVE,
      emailConfirmedAt: INSTANTE,
    });
    expect(armazemDeTokens.linhas[0]?.consumedAt).toEqual(INSTANTE);
  });

  it('CT-07: link expirado (mais de 24 h) responde "Este link de confirmação expirou." e não ativa a conta', async () => {
    // Arrange — RN-02: vencido é 410 (o link EXISTIU e caducou), não 400.
    semearToken({ expiresAt: new Date(INSTANTE.getTime() - UMA_HORA_EM_MS) });

    // Act
    const resultado = servico.execute({ token: TOKEN_EM_CLARO });

    // Assert
    await expect(resultado).rejects.toMatchObject({
      statusCode: 410,
      code: 'CONFIRMATION_TOKEN_EXPIRED',
      message:
        'Este link de confirmação expirou. Solicite um novo e-mail de confirmação.',
    });
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.PENDING_CONFIRMATION);
    expect(armazemDeTokens.linhas[0]?.consumedAt).toBeNull();
  });

  it('CT-07: vencimento é exclusivo — expirar exatamente no instante atual já é expirado', async () => {
    // Arrange — borda do `expiresAt <= agora` do service.
    semearToken({ expiresAt: INSTANTE });

    // Act & Assert
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).rejects.toMatchObject({
      code: 'CONFIRMATION_TOKEN_EXPIRED',
    });
  });

  it('CT-08: link já utilizado responde "Este link de confirmação já foi utilizado." (RN-03)', async () => {
    // Arrange
    semearToken({
      expiresAt: new Date(INSTANTE.getTime() + UMA_HORA_EM_MS),
      consumedAt: new Date(INSTANTE.getTime() - UMA_HORA_EM_MS),
    });

    // Act & Assert
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFIRMATION_TOKEN_ALREADY_USED',
      message: 'Este link de confirmação já foi utilizado.',
    });
  });

  it('CT-08: token consumido E vencido reporta o USO, não o vencimento', async () => {
    // Arrange — a ordem das verificações no service não é arbitrária: "já
    // utilizado" é a informação acionável ("sua conta já está ativa, faça
    // login"), enquanto "expirou, peça outro" mandaria o usuário a um reenvio
    // que nada faria.
    semearToken({
      expiresAt: new Date(INSTANTE.getTime() - UMA_HORA_EM_MS),
      consumedAt: new Date(INSTANTE.getTime() - UMA_HORA_EM_MS),
    });

    // Act & Assert
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).rejects.toMatchObject({
      code: 'CONFIRMATION_TOKEN_ALREADY_USED',
    });
  });

  it('CT-08: duplo clique no link — o compare-and-swap devolve 0 e a segunda confirmação vira "já utilizado"', async () => {
    // Arrange — a linha ainda está pendente na LEITURA, e outra requisição a
    // consome entre a leitura e o UPDATE. É exatamente a contagem devolvida por
    // `consume` que garante um único sucesso; um `update` por id gravaria duas
    // vezes e as duas requisições responderiam sucesso.
    semearToken({ expiresAt: new Date(INSTANTE.getTime() + UMA_HORA_EM_MS) });
    jest.spyOn(tokens, 'consume').mockResolvedValueOnce(0);

    // Act
    const resultado = servico.execute({ token: TOKEN_EM_CLARO });

    // Assert
    await expect(resultado).rejects.toMatchObject({
      code: 'CONFIRMATION_TOKEN_ALREADY_USED',
    });
    // A transação abortou: a conta NÃO foi ativada pela perdedora da corrida.
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.PENDING_CONFIRMATION);
  });

  it('CT-08: token inexistente responde "Link de confirmação inválido." e não vaza qual é o motivo real', async () => {
    // Arrange — nada semeado: o hash não casa com nenhuma linha.

    // Act & Assert — 400 com `code` próprio, para o frontend distinguir "link
    // quebrado" de "campo inválido"; sem `details`, porque não há campo a marcar.
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).rejects.toMatchObject({
      statusCode: 400,
      code: 'CONFIRMATION_TOKEN_INVALID',
      message: 'Link de confirmação inválido.',
    });
    expect(armazemDeUsuarios.linhas[0]?.status).toBe(UserStatus.PENDING_CONFIRMATION);
  });

  it('CT-06: a busca é pelo HASH do token — o valor em claro não é chave de nada', async () => {
    // Arrange — a linha guarda o hash; procurar pelo claro não acha.
    semearToken({ expiresAt: new Date(INSTANTE.getTime() + UMA_HORA_EM_MS) });

    // Act & Assert
    expect(armazemDeTokens.buscarPorHash(TOKEN_EM_CLARO)).toBeNull();
    expect(armazemDeTokens.buscarPorHash(hashToken(TOKEN_EM_CLARO))).not.toBeNull();
    await expect(servico.execute({ token: TOKEN_EM_CLARO })).resolves.toBeUndefined();
  });
});
