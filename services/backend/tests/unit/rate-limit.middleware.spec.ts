import express, { type Express } from 'express';
import request from 'supertest';

import { comAmbiente } from '../helpers/ambiente';

/**
 * Throttling dos endpoints de credencial (TASK-BACKEND-006).
 *
 * A suíte de integração roda com `RATE_LIMIT_ENABLED=false` de propósito — com o
 * limite de 5 logins por 15 minutos ligado, ela passaria a falhar por `429` em
 * vez de exercitar as regras que pretende testar. Este arquivo é o outro lado:
 * recarrega o módulo com o interruptor LIGADO e verifica o bloqueio, a chave e o
 * envelope da resposta.
 *
 * Nenhuma requisição sai da máquina: o app aqui é um Express mínimo levantado
 * pelo próprio `supertest`, com o limiter e o error handler reais.
 */

const MENSAGEM_DE_BLOQUEIO = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

type NomeDeLimitador = 'loginLimiter' | 'registerLimiter' | 'resendLimiter' | 'refreshLimiter';

/**
 * Monta um app com UM limiter e o error handler real — é ele que transforma o
 * `TooManyRequestsError` entregue a `next()` no envelope `{ error: {...} }`, e
 * usá-lo aqui é o que prova que o 429 sai no mesmo formato dos outros erros.
 */
async function appComLimitador(
  limitador: NomeDeLimitador,
  ligado: boolean,
  executar: (aplicacao: Express) => Promise<void>,
): Promise<void> {
  await comAmbiente({ RATE_LIMIT_ENABLED: ligado ? 'true' : 'false' }, async () => {
    const limiters = await import('~/middlewares/rate-limit.middleware');
    const { errorHandlerMiddleware } = await import(
      '~/middlewares/error-handler.middleware'
    );

    const aplicacao = express();

    aplicacao.use(express.json());
    aplicacao.post('/alvo', limiters[limitador], (_requisicao, resposta) => {
      resposta.status(200).json({ ok: true });
    });
    aplicacao.use(errorHandlerMiddleware);

    await executar(aplicacao);
  });
}

describe('rate-limit.middleware', () => {
  it('a sexta tentativa de login no mesmo par (IP, e-mail) responde 429 no envelope padrão', async () => {
    await appComLimitador('loginLimiter', true, async (aplicacao) => {
      // Arrange — 5 tentativas por 15 minutos: quem erra a senha 3 ou 4 vezes
      // ainda tem folga, e o ataque de dicionário morre na sexta.
      const corpo = { email: 'ana@exemplo.com', password: 'errada' };

      for (let tentativa = 0; tentativa < 5; tentativa += 1) {
        const permitida = await request(aplicacao).post('/alvo').send(corpo);

        expect(permitida.status).toBe(200);
      }

      // Act
      const bloqueada = await request(aplicacao).post('/alvo').send(corpo);

      // Assert
      expect(bloqueada.status).toBe(429);
      expect(bloqueada.body).toEqual({
        error: { code: 'TOO_MANY_REQUESTS', message: MENSAGEM_DE_BLOQUEIO },
      });
    });
  });

  it('a resposta 429 não publica cabeçalho de saldo restante', async () => {
    await appComLimitador('loginLimiter', true, async (aplicacao) => {
      // Arrange — dizer quantas tentativas faltam entregaria a quem sonda uma
      // informação que hoje ele só obtém gastando requisições (e sendo contado).
      const corpo = { email: 'ana@exemplo.com', password: 'errada' };

      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        await request(aplicacao).post('/alvo').send(corpo);
      }

      // Act
      const bloqueada = await request(aplicacao).post('/alvo').send(corpo);

      // Assert
      const cabecalhos: unknown = bloqueada.headers;
      const nomes = typeof cabecalhos === 'object' && cabecalhos !== null
        ? Object.keys(cabecalhos)
        : [];

      expect(bloqueada.status).toBe(429);
      expect(nomes.filter((nome) => /ratelimit/i.test(nome))).toEqual([]);
    });
  });

  it('a chave do login normaliza a caixa do e-mail: trocar de MAIÚSCULA para minúscula não renova a cota', async () => {
    await appComLimitador('loginLimiter', true, async (aplicacao) => {
      // Arrange — os limiters rodam ANTES do `validateRequest`, então o corpo que
      // chega ao `keyGenerator` ainda NÃO passou pelo `.toLowerCase()` do schema.
      // Sem a normalização própria, `A@x.com` e `a@x.com` cairiam em contadores
      // diferentes e o limite seria burlado só trocando a caixa das letras.
      for (let tentativa = 0; tentativa < 5; tentativa += 1) {
        await request(aplicacao).post('/alvo').send({ email: '  ANA@Exemplo.com ' });
      }

      // Act
      const bloqueada = await request(aplicacao)
        .post('/alvo')
        .send({ email: 'ana@exemplo.com' });

      // Assert
      expect(bloqueada.status).toBe(429);
    });
  });

  it('e-mails diferentes têm contadores independentes no login', async () => {
    await appComLimitador('loginLimiter', true, async (aplicacao) => {
      // Arrange
      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        await request(aplicacao).post('/alvo').send({ email: 'ana@exemplo.com' });
      }

      // Act
      const outraConta = await request(aplicacao)
        .post('/alvo')
        .send({ email: 'bruno@exemplo.com' });

      // Assert — o alvo protegido é a SENHA de uma conta; bloquear o IP inteiro
      // por causa de uma conta atacada tiraria o serviço de quem divide a rede.
      expect(outraConta.status).toBe(200);
    });
  });

  it('requisição sem corpo utilizável é contada apenas pelo IP, sem quebrar a chave', async () => {
    await appComLimitador('loginLimiter', true, async (aplicacao) => {
      // Arrange — corpo ausente, sem `email` ou com `email` não textual: a chave
      // vira só o IP, que é o correto para quem nem disse qual conta está tentando.
      for (let tentativa = 0; tentativa < 5; tentativa += 1) {
        const permitida = await request(aplicacao).post('/alvo').send({ email: 42 });

        expect(permitida.status).toBe(200);
      }

      // Act
      const bloqueada = await request(aplicacao).post('/alvo');

      // Assert
      expect(bloqueada.status).toBe(429);
    });
  });

  it('o limitador de registro usa a chave default (só IP): e-mails diferentes NÃO renovam a cota', async () => {
    await appComLimitador('registerLimiter', true, async (aplicacao) => {
      // Arrange — o abuso do cadastro é criar MUITAS contas, cada uma com um
      // e-mail diferente; uma chave que incluísse o e-mail não limitaria nada.
      for (let indice = 0; indice < 5; indice += 1) {
        const permitida = await request(aplicacao)
          .post('/alvo')
          .send({ email: `pessoa${String(indice)}@exemplo.com` });

        expect(permitida.status).toBe(200);
      }

      // Act
      const bloqueada = await request(aplicacao)
        .post('/alvo')
        .send({ email: 'outra-pessoa@exemplo.com' });

      // Assert
      expect(bloqueada.status).toBe(429);
    });
  });

  it('o reenvio de confirmação é o mais restritivo: bloqueia na quarta tentativa', async () => {
    await appComLimitador('resendLimiter', true, async (aplicacao) => {
      // Arrange — cada chamada bem-sucedida dispara um e-mail real, então o abuso
      // usa o servidor como ferramenta de spam contra um terceiro.
      const corpo = { email: 'vitima@exemplo.com' };

      for (let tentativa = 0; tentativa < 3; tentativa += 1) {
        const permitida = await request(aplicacao).post('/alvo').send(corpo);

        expect(permitida.status).toBe(200);
      }

      // Act
      const bloqueada = await request(aplicacao).post('/alvo').send(corpo);

      // Assert
      expect(bloqueada.status).toBe(429);
    });
  });

  it('a renovação de sessão é folgada: 20 por minuto passam e a 21ª é bloqueada', async () => {
    await appComLimitador('refreshLimiter', true, async (aplicacao) => {
      // Arrange — a renovação é automática e uma aba legítima pode disparar
      // várias em sequência; o limite existe contra varredura de cookie.
      for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        const permitida = await request(aplicacao).post('/alvo');

        expect(permitida.status).toBe(200);
      }

      // Act
      const bloqueada = await request(aplicacao).post('/alvo');

      // Assert
      expect(bloqueada.status).toBe(429);
    });
  });

  it('com RATE_LIMIT_ENABLED=false nenhuma requisição é bloqueada, em nenhuma circunstância', async () => {
    await appComLimitador('resendLimiter', false, async (aplicacao) => {
      // Arrange — o interruptor é avaliado UMA vez, na montagem: desligado, a
      // biblioteca nem é instanciada, então não há store nem contagem em curso.
      const corpo = { email: 'ana@exemplo.com' };

      // Act
      const respostas = await Promise.all(
        Array.from({ length: 30 }, async () =>
          request(aplicacao).post('/alvo').send(corpo),
        ),
      );

      // Assert
      expect(respostas.every((resposta) => resposta.status === 200)).toBe(true);
    });
  });
});
