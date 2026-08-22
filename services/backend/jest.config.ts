import path from 'node:path';

import type { Config } from 'jest';

/**
 * Raiz do MONOREPO (dois níveis acima de `services/backend`).
 *
 * É a partir dela que os caminhos do `lcov.info` são escritos — ver
 * `coverageReporters` abaixo. Calculada de `__dirname`, e não de `process.cwd()`,
 * para que o relatório saia igual venha o comando de onde vier.
 */
const RAIZ_DO_MONOREPO = path.resolve(__dirname, '..', '..');

/**
 * Configuracao da suite do backend (TASK-BACKEND-007).
 *
 * `roots` cobre os dois lugares onde ha teste: os specs unitarios dos services,
 * que a task manda deixar ao lado do codigo em `src/`, e `tests/` (fakes, specs
 * de infraestrutura transversal e a suite de integracao HTTP).
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  /**
   * Sem isto o alias `~/` nao resolve sob Jest: o `paths` do `tsconfig` e
   * instrucao para o COMPILADOR, e o require em tempo de execucao continuaria
   * procurando um pacote chamado `~`.
   */
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
  },

  /**
   * `setupFilesAfterEnv` e nao `setupFiles`: o setup usa a API global do Jest
   * (`jest.restoreAllMocks` em `afterEach`), que so existe depois que o ambiente
   * de teste foi instalado.
   *
   * O plano da task cita `setupFilesAfterEach`, campo que NAO existe no Jest 29 —
   * declarar um campo desconhecido faz o Jest abortar com "Unknown option".
   */
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  transform: {
    /**
     * O `ts-jest` compila com o `tsconfig.test.json`, e nao com o `tsconfig.json`
     * do build: e ele que enxerga os globais de `@types/jest` e os arquivos de
     * `tests/`, mantendo as mesmas flags estritas do codigo de producao.
     */
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    // Unico ponto que abre socket HTTP (`listen`): nao ha o que exercitar sem
    // subir um servidor de verdade, e a montagem do Express que importa esta em
    // `app.ts`, que fica coberto.
    '!src/index.ts',
    '!src/**/*.d.ts',
    // Arquivos de rota sao declaracao pura (`router.post(caminho, ...middlewares)`).
    // Eles sao EXERCITADOS pela suite de integracao; ficam fora da metrica porque
    // nao tem ramo nem regra a cobrir e diluiriam o numero.
    '!src/**/*.routes.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  /**
   * `lcov` e o formato que o Sonar consome (`sonar.javascript.lcov.reportPaths`);
   * `text` e para o desenvolvedor ler no terminal.
   *
   * `projectRoot` na RAIZ DO MONOREPO nao e detalhe: o `istanbul` escreve cada
   * `SF:` como `path.relative(projectRoot, arquivo)`, e o default (`process.cwd()`,
   * isto e, `services/backend`) produziria `SF:src/app.ts`. O scanner do Sonar
   * roda da raiz do repositorio e resolve esses caminhos a partir dela, entao ele
   * procuraria `<raiz>/src/app.ts` — que nao existe — e importaria ZERO
   * cobertura, em silencio (apenas um "Could not resolve N file paths" no log).
   * Com a raiz do monorepo, o relatorio sai como
   * `SF:services/backend/src/app.ts`, que e exatamente a chave do arquivo no
   * Sonar. Verificado no `lcov.info` gerado.
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
   * `jest.spyOn` — quem faz isso e o `restoreAllMocks` do `tests/setup.ts`, e as
   * duas coisas juntas sao o que garante independencia de ordem (AC #2).
   */
  clearMocks: true,
  /**
   * Folga sobre o pior caso medido (a suite inteira leva ~7 s e o teste mais
   * lento, ~180 ms, e a comparacao bcrypt de tempo constante do login contra
   * usuario inexistente).
   */
  testTimeout: 15000,
};

export default config;
