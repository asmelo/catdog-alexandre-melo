import { comAmbiente } from '../helpers/ambiente';

/**
 * Ponto ÚNICO de leitura de `process.env`. A validação roda no import de propósito:
 * env inválida precisa derrubar o boot com mensagem legível, em vez de propagar
 * `undefined` em silêncio até a primeira requisição de produção.
 *
 * O caminho felizardo é exercitado por toda a suíte (sem ele nada importa). Este
 * spec cobre a FALHA, que não tem outra forma de ser alcançada.
 */
describe('config/env', () => {
  it('variável obrigatória ausente derruba o import nomeando a chave e o arquivo de referência', async () => {
    // Arrange
    await comAmbiente({ DATABASE_URL: undefined }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(
        /Variaveis de ambiente invalidas[\s\S]*\.env\.example[\s\S]*DATABASE_URL/,
      );
    });
  });

  it('OBSERVAÇÃO DE CONTRATO: chave AUSENTE reporta o "Required" do Zod, e não a mensagem própria', async () => {
    // Arrange — `DATABASE_URL: z.string().min(1, 'e obrigatoria')` define a
    // mensagem do MÍNIMO, que só vale para a chave presente e vazia. Ausente, o
    // Zod usa o `required_error` default, em inglês.
    //
    // Documentado em vez de corrigido: a correção (`required_error` em cada
    // chave) fica em `src/config/env.ts`, e o critério de aceite #9 desta task
    // proíbe alterar `src/`. O texto só aparece no log de boot de quem está
    // configurando o ambiente, nunca em resposta HTTP.
    await comAmbiente({ DATABASE_URL: undefined }, async () => {
      // Act
      const falha = await import('~/config/env').catch((motivo: unknown) => motivo);

      // Assert
      expect(falha instanceof Error ? falha.message : '').toContain(
        '- DATABASE_URL: Required',
      );
    });
  });

  it('chave presente porém vazia usa a mensagem própria em PT-BR', async () => {
    // Arrange
    await comAmbiente({ DATABASE_URL: '' }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(
        /DATABASE_URL: e obrigatoria/,
      );
    });
  });

  it('acumula TODAS as chaves inválidas numa única mensagem', async () => {
    // Arrange — descobrir um problema por reinício custaria uma rodada de deploy
    // por variável.
    await comAmbiente(
      { DATABASE_URL: undefined, DIRECT_URL: undefined, JWT_ACCESS_SECRET: 'curto' },
      async () => {
        // Act
        const falha = await import('~/config/env').catch((motivo: unknown) => motivo);

        // Assert
        const mensagem = falha instanceof Error ? falha.message : '';

        expect(mensagem).toContain('DATABASE_URL');
        expect(mensagem).toContain('DIRECT_URL');
        expect(mensagem).toContain('JWT_ACCESS_SECRET: deve ter no minimo 32 caracteres');
      },
    );
  });

  it('recusa o wildcard em CORS_ALLOWED_ORIGINS, que é incompatível com `credentials: true`', async () => {
    // Arrange — o cookie HttpOnly do refresh token exige `credentials`, e o
    // navegador recusa a combinação com `origin: '*'`.
    await comAmbiente({ CORS_ALLOWED_ORIGINS: 'http://localhost:5173,*' }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(/wildcard/);
    });
  });

  it('recusa lista de origens vazia', async () => {
    // Arrange
    await comAmbiente({ CORS_ALLOWED_ORIGINS: ' , , ' }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(/ao menos uma origem/);
    });
  });

  it('recusa booleano textual fora de "true"/"false"', async () => {
    // Arrange — `COOKIE_SECURE=1` seria silenciosamente falso num parser
    // permissivo, e o cookie de sessão sairia sem `Secure` em produção.
    await comAmbiente({ COOKIE_SECURE: '1' }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(
        /COOKIE_SECURE: deve ser exatamente "true" ou "false"/,
      );
    });
  });

  it('aplica os defaults declarados e congela o resultado', async () => {
    // Arrange
    await comAmbiente({ JWT_ACCESS_TTL: undefined, BCRYPT_COST: undefined }, async () => {
      const { env } = await import('~/config/env');

      // Act & Assert
      expect(env.JWT_ACCESS_TTL).toBe('15m');
      expect(env.BCRYPT_COST).toBe(12);
      expect(Object.isFrozen(env)).toBe(true);
    });
  });
});
