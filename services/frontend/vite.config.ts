import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // O alias `~/` precisa existir AQUI e em `tsconfig.json` (`paths`): o
      // `tsc --noEmit` resolve pelo tsconfig e o bundle resolve por esta
      // entrada. Com apenas um dos dois, a compilacao passa e o runtime quebra
      // (ou o inverso), sem nenhum aviso.
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // Precisa bater com CORS_ALLOWED_ORIGINS e APP_WEB_URL do backend.
    port: 5173,
    // Sem `strictPort`, uma porta 5173 ocupada faz o Vite subir na 5174 e o
    // backend passa a rejeitar a origem por CORS — falha silenciosa. Melhor
    // falhar no boot do dev server.
    strictPort: true,
    proxy: {
      // Proxy de MESMA ORIGEM: o navegador enxerga `http://localhost:5173/api`,
      // entao o cookie de refresh do backend chega como first-party e nao exige
      // `SameSite=None`, nem ha preflight de CORS em desenvolvimento.
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});
