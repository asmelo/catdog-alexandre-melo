import {
  ROUTE_PATHS,
  buildRedirectState,
  homePathForRole,
  readRedirectTarget,
  toInternalPath,
} from '~/routes/route-paths';

/**
 * Specs dos caminhos e da sanitizacao de destino de navegacao.
 *
 * A metade de baixo deste arquivo e teste de SEGURANCA, nao de roteamento: ela
 * cobre a advisory GHSA-wrjc-x8rr-h8h6 (open redirect no `react-router@6.30.6`,
 * bypass do CVE-2025-68470), em que `<Link>` e `useNavigate` tratam `/\evil.com`
 * como destino EXTERNO. A mitigacao do projeto e recusar esses caminhos na
 * criacao do destino, e e isso que se afirma abaixo.
 */

describe('homePathForRole', () => {
  it('RN-09: a home e decidida exclusivamente pela role', () => {
    expect(homePathForRole('admin')).toBe(ROUTE_PATHS.ADMIN_HOME);
    expect(homePathForRole('cliente')).toBe(ROUTE_PATHS.CLIENT_HOME);
  });

  it('e a DEFINICAO UNICA usada pelos tres consumidores', () => {
    // Tres copias do mesmo `switch` divergiriam no primeiro perfil novo, cada uma
    // mandando o usuario para um lugar diferente.
    expect(ROUTE_PATHS.ADMIN_HOME).toBe('/admin');
    expect(ROUTE_PATHS.CLIENT_HOME).toBe('/minha-area');
  });

  it('CONFIRM_EMAIL casa com o link que o backend monta no e-mail', () => {
    // O `send-confirmation-mail.service.ts` monta `${APP_WEB_URL}/confirmar-email`.
    // Divergir aqui quebra a HU-02 em producao sem quebrar nenhum outro teste: o
    // e-mail sai, o usuario clica e chega numa 404.
    expect(ROUTE_PATHS.CONFIRM_EMAIL).toBe('/confirmar-email');
  });
});

describe('toInternalPath', () => {
  it('aceita caminho interno com uma unica barra inicial', () => {
    expect(toInternalPath('/admin')).toBe('/admin');
    expect(toInternalPath('/minha-area?aba=pedidos#topo')).toBe('/minha-area?aba=pedidos#topo');
  });

  it('descarta destino externo, esquema e caminho relativo', () => {
    for (const hostil of ['https://evil.com', 'evil.com', 'javascript:alert(1)', 'admin']) {
      expect(toInternalPath(hostil)).toBe(ROUTE_PATHS.ROOT);
    }
  });

  it('descarta URL relativa a protocolo (//evil.com)', () => {
    // O navegador resolve `//evil.com` como HOST EXTERNO. E tambem a forma
    // NORMALIZADA de `/\evil.com`, ou seja, a variante que chega de fato pela
    // barra de enderecos.
    expect(toInternalPath('//evil.com')).toBe(ROUTE_PATHS.ROOT);
    expect(toInternalPath('///evil.com')).toBe(ROUTE_PATHS.ROOT);
  });

  it('GHSA-wrjc-x8rr-h8h6: descarta barra invertida em qualquer posicao', () => {
    expect(toInternalPath('/\\evil.com')).toBe(ROUTE_PATHS.ROOT);
    expect(toInternalPath('/admin\\..\\evil')).toBe(ROUTE_PATHS.ROOT);
  });

  it('descarta os caracteres que o NAVEGADOR remove antes de resolver a URL', () => {
    /**
     * Tabulacao, LF e CR sao REMOVIDOS pela URL parser do navegador. Sem eles na
     * lista, `/\t\evil.com` passaria pela validacao como caminho interno e viraria
     * `/\evil.com` na hora da navegacao — o bypass.
     */
    for (const hostil of ['/\t\\evil.com', '/\nadmin', '/\radmin', '/ admin']) {
      expect(toInternalPath(hostil)).toBe(ROUTE_PATHS.ROOT);
    }
  });

  it('descarta valor que nao e string', () => {
    expect(toInternalPath(null)).toBe(ROUTE_PATHS.ROOT);
    expect(toInternalPath(undefined)).toBe(ROUTE_PATHS.ROOT);
  });
});

describe('buildRedirectState', () => {
  it('guarda o destino como STRING sanitizada, e nao o objeto Location', () => {
    const estado = buildRedirectState({ pathname: '/admin', search: '?aba=usuarios', hash: '#topo' });

    // Um `Location` carregaria o `pathname` cru e o `state` anterior, devolvendo ao
    // consumidor exatamente o valor nao validado que se quer eliminar.
    expect(estado).toEqual({ from: '/admin?aba=usuarios#topo' });
  });

  it('sanitiza na CRIACAO do destino', () => {
    const estado = buildRedirectState({ pathname: '/\\evil.com', search: '', hash: '' });

    expect(estado.from).toBe(ROUTE_PATHS.ROOT);
  });
});

describe('readRedirectTarget', () => {
  const FALLBACK = ROUTE_PATHS.CLIENT_HOME;

  it('devolve o destino interno guardado no state', () => {
    expect(readRedirectTarget({ from: '/minha-area/pedidos' }, FALLBACK)).toBe('/minha-area/pedidos');
  });

  it('REVALIDA em vez de confiar: state hostil cai no fallback', () => {
    /**
     * O `state` de navegacao e dado de ENTRADA — qualquer pagina pode ter chamado
     * `navigate('/login', { state })` e o `history` do navegador preserva o valor
     * entre recargas. Ler `state.from` cru transferiria a garantia para uma origem
     * que e desconhecida por definicao.
     */
    for (const hostil of ['https://evil.com', '//evil.com', '/\\evil.com', '/\tadmin']) {
      expect(readRedirectTarget({ from: hostil }, FALLBACK)).toBe(FALLBACK);
    }
  });

  it('state sem forma esperada cai no fallback', () => {
    for (const estado of [null, undefined, 'texto', 42, {}, { from: 99 }, { outro: '/admin' }]) {
      expect(readRedirectTarget(estado, FALLBACK)).toBe(FALLBACK);
    }
  });

  it('destino que reduz a raiz cai no fallback, e nao na raiz', () => {
    // A raiz so redirecionaria para a home da role de novo; o fallback JA e ela.
    expect(readRedirectTarget({ from: ROUTE_PATHS.ROOT }, FALLBACK)).toBe(FALLBACK);
  });
});
