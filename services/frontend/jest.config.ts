import path from 'node:path';

import type { Config } from 'jest';

/**
 * Raiz do MONOREPO (dois niveis acima de `services/frontend`).
 *
 * Calculada de `__dirname` e nao de `process.cwd()`, para que o `lcov.info` saia
 * igual venha o comando de onde vier. Ver `coverageReporters`.
 */
const RAIZ_DO_MONOREPO = path.resolve(__dirname, '..', '..');

/**
 * Configuracao da suite do frontend (TASK-FRONTEND-013).
 *
 * As divergencias em relacao a `services/backend/jest.config.ts` existem porque
 * o ambiente e jsdom + Vite, e nao Node + Express. O que foi mantido do
 * precedente: `roots` cobrindo os dois lugares com arquivo de teste, o
 * `projectRoot` do reporter de lcov e os quatro limites de cobertura em 80.
 */
const config: Config = {
  /**
   * `jsdom`, e nao `node`: metade da suite monta arvore de React e consulta DOM.
   * O ambiente e trocado por pacote proprio desde o Jest 28 — daqui vem a
   * dependencia `jest-environment-jsdom`.
   */
  testEnvironment: 'jsdom',

  /**
   * Os specs vivem DENTRO de `src/`, ao lado do codigo (tabela *Files* da task).
   * `tests/` guarda apenas infraestrutura de teste (setup, dublê de env e o
   * harness de autenticacao) e entra em `roots` para que uma mudanca la invalide
   * o cache do Jest.
   */
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  /**
   * `setupFilesAfterEnv` e nao `setupFiles`: o setup usa a API global do Jest
   * (`afterEach`, `jest.restoreAllMocks`), que so existe depois de o ambiente de
   * teste estar instalado.
   */
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  /**
   * `babel-jest` em vez de `ts-jest`, por decisao da task: `ts-jest` com JSX e o
   * ESM do Vite e fonte recorrente de atrito, e o type-check ja e feito pelo
   * `tsc --noEmit` do `npm run typecheck` (dois projetos) — duplica-lo aqui so
   * deixaria a suite lenta.
   */
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  /**
   * A ORDEM DAS TRES ENTRADAS E SIGNIFICATIVA: o Jest aplica os padroes na ordem
   * de declaracao e para no primeiro que casa. `^~/config/env$` precisa vir
   * ANTES de `^~/(.*)$`, senao o generico o captura e o dublê nunca e usado.
   *
   * 1. `~/config/env` -> `tests/env-mock.ts`. ESTRUTURAL, nao conveniencia:
   *    `import.meta` e erro de SINTAXE sob a transformacao CommonJS do
   *    `@babel/preset-env`, entao o modulo real nao chega nem a ser avaliado. Só
   *    funciona porque a TASK-FRONTEND-008 confinou os acessos a
   *    `import.meta.env` a esse unico arquivo.
   * 2. `~/*` -> `src/*`. O `paths` do `tsconfig` e instrucao para o COMPILADOR;
   *    o `require` em tempo de execucao continuaria procurando um pacote chamado
   *    `~`.
   * 3. CSS -> `identity-obj-proxy`. O Jest nao sabe carregar `.css`; o proxy
   *    devolve o nome da classe como valor, o que mantem legivel qualquer
   *    asserção sobre `className`.
   */
  moduleNameMapper: {
    '^~/config/env$': '<rootDir>/tests/env-mock.ts',
    '^~/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // Unico ponto que toca `document.getElementById` e `createRoot`: nao ha o que
    // exercitar sem um navegador de verdade, e tudo o que ele monta (`App`,
    // provider, roteador) e coberto separadamente.
    '!src/main.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',

  /**
   * `projectRoot` na RAIZ DO MONOREPO nao e detalhe de formatacao — e o que
   * evita cobertura zerada em silencio no Sonar.
   *
   * O `istanbul` escreve cada registro como `path.relative(projectRoot, arquivo)`
   * e o default e `process.cwd()`, isto e, `services/frontend`. O relatorio sairia
   * com `SF:src/App.tsx`; o scanner roda da RAIZ do repositorio e resolveria
   * `<raiz>/src/App.tsx`, que nao existe — importando ZERO cobertura com apenas
   * um "Could not resolve N file paths" no log. Ver DESCOBERTA-062 da
   * TASK-BACKEND-007, que encontrou e corrigiu o mesmo problema no backend.
   *
   * PEGADINHA: `npx jest --coverage --coverageReporters=lcov` SUBSTITUI este
   * array e perde a opcao, voltando a gerar caminhos errados. O comando que vale
   * e `npm run test:cov`.
   */
  coverageReporters: ['text', ['lcov', { projectRoot: RAIZ_DO_MONOREPO }]],

  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  /**
   * Zera as chamadas registradas em cada mock antes de cada teste. Nao desfaz
   * `jest.spyOn` — quem faz isso e o `restoreAllMocks` de `tests/setup.ts`. As
   * duas coisas juntas sao o que sustenta a independencia de ordem exigida pela
   * AC #8.
   */
  clearMocks: true,

  /**
   * Folga larga sobre o pior caso medido. `userEvent` avanca o tempo real entre
   * eventos de teclado, e um formulario preenchido campo a campo leva centenas
   * de milissegundos — bem mais do que uma chamada de funcao pura.
   */
  testTimeout: 15000,
};

export default config;
