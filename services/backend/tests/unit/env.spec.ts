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

  it('derruba o boot quando a URL do armazenamento está ausente', async () => {
    // Arrange — RN-38. Sem `.optional()` de propósito: um backend que sobe sem
    // credencial de armazenamento só falha no primeiro cadastro COM FOTO, em
    // produção, já com o administrador esperando.
    await comAmbiente({ SUPABASE_URL: undefined }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(/SUPABASE_URL/);
    });
  });

  it('derruba o boot quando a credencial de escrita do armazenamento está ausente', async () => {
    // Arrange — RNF-04: a `SUPABASE_SERVICE_ROLE_KEY` vive só no servidor, e a
    // aplicação não sobe sem ela.
    await comAmbiente({ SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  });

  it('recusa uma URL de armazenamento malformada em vez de aceitá-la e falhar na rede', async () => {
    // Arrange
    await comAmbiente({ SUPABASE_URL: 'projeto.supabase.co' }, async () => {
      // Act & Assert
      await expect(import('~/config/env')).rejects.toThrow(
        /SUPABASE_URL: deve ser uma URL valida/,
      );
    });
  });

  it('nomeia TODAS as variáveis de armazenamento ausentes de uma vez', async () => {
    // Arrange — descobrir uma variável faltante por reinício custaria uma rodada
    // de deploy por chave.
    await comAmbiente(
      { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
      async () => {
        // Act
        const falha = await import('~/config/env').catch((motivo: unknown) => motivo);

        // Assert
        const mensagem = falha instanceof Error ? falha.message : '';

        expect(mensagem).toContain('SUPABASE_URL');
        expect(mensagem).toContain('SUPABASE_SERVICE_ROLE_KEY');
      },
    );
  });

  it('o balde tem default e NÃO derruba o boot quando ausente', async () => {
    // Arrange — o nome do balde é convenção do projeto, não segredo: ele pode ter
    // valor padrão sem criar o risco que as outras duas criam.
    await comAmbiente({ SUPABASE_STORAGE_BUCKET: undefined }, async () => {
      const { env } = await import('~/config/env');

      // Act & Assert
      expect(env.SUPABASE_STORAGE_BUCKET).toBe('animal-images');
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
