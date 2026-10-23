import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiled = resolve(root, '.standalone-build');
let html = await readFile(resolve(compiled, 'app.html'), 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const style = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!script || !style) throw new Error('JavaScript ou CSS ausente no build da prévia.');

function asset(url) {
  const path = resolve(compiled, url.replace(/^\//, ''));
  if (!path.startsWith(compiled + '/')) throw new Error('Arquivo fora do build.');
  return path;
}
const js = await readFile(asset(script[1]), 'utf8');
const css = (await readFile(asset(style[1]), 'utf8'))
  .replaceAll("'DM Sans',sans-serif", 'system-ui,sans-serif')
  .replaceAll("'Manrope',sans-serif", 'system-ui,sans-serif');
if (/\bimport\.meta\b|\bimport\s*\(/.test(js) || /url\(|@font-face|@import/.test(css)) {
  throw new Error('A prévia leve não pode depender de módulos ou arquivos externos.');
}

// Render the actual application at build time, so a viewer can display the
// dashboard even before (or without) running its small interactive bundle.
const server = await createServer({
  configFile: resolve(root, 'vite.config.ts'),
  cacheDir: resolve(root, 'node_modules/.vite-preview-render'),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});
let markup;
let commercialMarkup;
try {
  const { default: App } = await server.ssrLoadModule('/src/HoseApp.tsx');
  markup = renderToString(createElement(App));
  const { default: CommercialPortal } = await server.ssrLoadModule('/src/CommercialPortal.tsx');
  commercialMarkup = renderToString(createElement(CommercialPortal));
} finally {
  await server.close();
}

html = html.replace(script[0], '');
html = html.replace(style[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace(/\s*<link\b[^>]*\brel="icon"[^>]*>/, '');
html = html.replace('<div id="root"></div>', () => `<div id="root">${markup}</div><noscript><p style="position:fixed;bottom:0;left:0;right:0;margin:0;padding:12px;background:#fff4d7;text-align:center;font:14px system-ui;z-index:100">Visualização estática. Ative o JavaScript para usar os filtros e botões.</p></noscript>`);
html = html.replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
html = html.replace('<html lang="pt-BR">', '<html lang="pt-BR">\n<!-- Prévia gerada por npm run build. Fonte: app.html e src/. -->');
html = html.replace(/^[ \t]+$/gm, '');
if (Buffer.byteLength(html) > 750000) throw new Error('A prévia ultrapassou o limite de tamanho definido para esta versão leve.');

// An explicit read-only fallback isolates viewers that reject any scripting.
const staticHtml = html
  .replace(/<script>[\s\S]*?<\/script>/g, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
  .replace(/<button\b/g, '<button disabled')
  .replace(/<input\b/g, '<input disabled')
  .replace('</style>', 'button:disabled{opacity:1}body{padding-bottom:48px}</style>')
  .replace('</body>', '<p style="position:fixed;bottom:0;left:0;right:0;z-index:100;margin:0;padding:12px;background:#fff4d7;text-align:center;font:13px system-ui">Prévia visual estática · formulário de montagem · edição disponível com JavaScript.</p></body>')
  .replace(/^[ \t]+$/gm, '');
await writeFile(resolve(root, 'painel-estatico.html'), staticHtml);

await mkdir(resolve(root, 'premium-flex-site'), { recursive: true });
for (const file of ['index.html', 'painel.html', 'dist/index.html', 'premium-flex-site/index.html']) {
  await writeFile(resolve(root, file), html);
}
console.log(`Painel leve gerado: ${Math.round(Buffer.byteLength(html) / 1024)} KiB; HTML inicial renderizado, fontes do sistema e runtime compacto.`);

// Página comercial independente; os demais aplicativos mantêm suas páginas.
const commercialHtml = html
  .replace('<html lang="pt-BR">', '<html lang="pt-BR" data-app="comercial">')
  .replace('<title>Premium Plus — Montagem de mangueiras</title>', '<title>Premiumflex — Inteligência comercial</title>')
  .replace('Ordens de montagem de mangueiras hidráulicas Premium Plus.', 'Painel comercial Premiumflex: clientes, curva ABC e relacionamento.')
  .replace(markup, () => commercialMarkup);
await mkdir(resolve(root, 'premium-flex-site/comercial'), { recursive: true });
await writeFile(resolve(root, 'premium-flex-site/comercial/index.html'), commercialHtml);
await writeFile(resolve(root, 'dist/comercial.html'), commercialHtml);
