import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'nexo-development-entry',
      configureServer(server) {
        // index.html is the standalone preview; use the source entry for HMR.
        server.middlewares.use((request, _response, next) => {
          if (request.url && /^\/(?:index\.html|comercial\/?)?(?:\?|$)/.test(request.url)) {
            request.url = request.url.replace(/^\/(?:index\.html|comercial\/?)?/, '/app.html');
          }
          next();
        });
      },
    },
  ],
  build: { rollupOptions: { input: fileURLToPath(new URL('./app.html', import.meta.url)) } },
});
