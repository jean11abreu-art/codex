import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [{
    name: 'system-fonts-for-portable-preview',
    enforce: 'pre',
    transform(source, id) {
      if ((id.endsWith('/src/styles.css') || id.endsWith('/src/hoses.css') || id.endsWith('/src/commercial.css'))) {
        return source.replace(/^@import\s+['"]@fontsource\/[^;]+;\s*/gm, '');
      }
    },
  }],
  resolve: {
    alias: [
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
    ],
  },
  build: {
    outDir: '.standalone-build',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./app.html', import.meta.url)) },
  },
});
