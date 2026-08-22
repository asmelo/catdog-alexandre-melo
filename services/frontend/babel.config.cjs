/**
 * Transformacao dos fontes para a suite de testes (TASK-FRONTEND-013).
 *
 * ESTE ARQUIVO NAO PARTICIPA DO BUILD DE PRODUCAO, e a verificacao e objetiva:
 * `@vitejs/plugin-react@4.7.0` chama o Babel com `babelrc: false` e
 * `configFile: false` (conferido em `dist/index.cjs`, linhas 308-309), portanto
 * ele NAO le este arquivo. Se lesse, o `targets: { node: 'current' }` abaixo
 * emitiria CommonJS dentro do bundle do navegador — quebra que apareceria so no
 * `vite build`. Vite continua transpilando TypeScript por esbuild.
 *
 * Extensao `.cjs` de proposito: o `package.json` do frontend declara
 * `"type": "module"`, entao um `babel.config.js` seria carregado como ESM e o
 * `module.exports` abaixo lancaria `module is not defined`.
 */
module.exports = {
  presets: [
    /**
     * `node: 'current'` porque o unico consumidor e o Jest, que roda no Node 20
     * do `.nvmrc`. Sem alvo declarado, o preset transpila para navegadores
     * antigos e a suite fica mais lenta sem nenhum ganho.
     *
     * E ele que converte os `import`/`export` dos fontes em CommonJS — a
     * transformacao que torna `import.meta.env` um ERRO DE SINTAXE e que o
     * `moduleNameMapper` de `~/config/env` existe para contornar.
     */
    ['@babel/preset-env', { targets: { node: 'current' } }],
    /**
     * `runtime: 'automatic'` casa com o `"jsx": "react-jsx"` do `tsconfig.json`:
     * o JSX e compilado para `jsx()` do `react/jsx-runtime` e nenhum arquivo
     * precisa importar `React`. Com o default (`classic`) cada spec e cada
     * componente sem esse import quebraria em `React is not defined`.
     */
    ['@babel/preset-react', { runtime: 'automatic' }],
    /**
     * APENAS APAGA OS TIPOS — nao verifica nenhum. A verificacao continua sendo
     * do `tsc`: `npm run typecheck` roda os dois projetos (`tsconfig.json` para
     * `src/` e `tsconfig.test.json` para os specs). Duplicar o type-check dentro
     * do runner e o atrito que a task manda evitar ao escolher `babel-jest` em
     * vez de `ts-jest`.
     *
     * O preset distingue `.ts` de `.tsx` pela extensao do arquivo, entao nenhuma
     * opcao `isTSX` e necessaria aqui.
     */
    '@babel/preset-typescript',
  ],
};
