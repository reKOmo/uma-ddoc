import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { ensureCards } from './scripts/update-cards.ts';

// `import('x.json', { with: { type: 'json' } })`, as Node needs it.
const DYNAMIC_JSON_IMPORT =
  /(import\(\s*(['"])[^'"]+\.json\2)\s*,\s*\{\s*with:\s*\{\s*type:\s*(['"])json\3\s*\}\s*,?\s*\}\s*\)/g;

// The dev server serves JSON modules as JavaScript and drops `with { type: 'json' }`
// from static imports, but not from dynamic ones, so the browser rejects those
// ("disallowed MIME type"). Strip it there too. Builds handle it already.
const stripDynamicJsonAttributes: Plugin = {
  name: 'strip-dynamic-json-import-attributes',
  apply: 'serve',
  transform(code, id) {
    if (id.includes('/node_modules/') || !code.includes('.json')) return null;
    const stripped = code.replace(DYNAMIC_JSON_IMPORT, '$1)');
    return stripped === code ? null : { code: stripped, map: null };
  },
};

export default defineConfig({
  plugins: [
    react(),
    // Fetch card data into generated/ on first dev/build of a fresh checkout.
    { name: 'ensure-cards', buildStart: ensureCards },
    stripDynamicJsonAttributes,
  ],
  // Relative asset URLs so the build works under a GitHub Pages project path.
  base: './',
  // The upstream clone (upstream/, for test:upstream) is a whole other app;
  // keep Vite's dependency scan and file watcher out of it.
  optimizeDeps: { entries: ['index.html'] },
  server: { watch: { ignored: ['**/upstream/**'] } },
});
