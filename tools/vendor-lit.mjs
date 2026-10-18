// Phase 06: bundles the npm package `lit` into one classic script, game/vendor/lit.js, that puts what the UI kit uses on
// self.PB_LIT (js/ui-kit.js reads it). A classic script, like version.js and the art manifests, because the game's
// modules may only import each other (tools/to-module.mjs), and it keeps every way of running the game working:
// npm run dev, the build, and a plain `python3 -m http.server` (which can't resolve a bare `import 'lit'`). Run after changing the lit version in
// package.json:   node tools/vendor-lit.mjs
// The file is committed; `node tools/vendor-lit.mjs --check` fails when it doesn't match the installed version.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'game/vendor/lit.js');
const ENTRY = '\0pb-lit-entry';
const version = JSON.parse(readFileSync(join(ROOT, 'node_modules/lit/package.json'), 'utf8')).version;
const header = `/* lit ${version} (https://lit.dev, BSD-3-Clause), bundled by tools/vendor-lit.mjs. Do not edit. */\n`;

if (process.argv.includes('--check')) {
  const ok = existsSync(OUT) && readFileSync(OUT, 'utf8').startsWith(header);
  console.log(
    ok
      ? `game/vendor/lit.js matches lit ${version}`
      : `game/vendor/lit.js is not lit ${version}: run node tools/vendor-lit.mjs`
  );
  process.exit(ok ? 0 : 1);
}

const out = await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  publicDir: false,
  build: {
    write: false,
    minify: true,
    target: 'es2021',
    rollupOptions: {
      input: ENTRY,
      output: { format: 'iife', name: 'PB_LIT', extend: true },
      preserveEntrySignatures: 'strict',
    },
  },
  plugins: [
    {
      name: 'pb-lit-entry',
      resolveId: id => (id === ENTRY ? ENTRY : null),
      load: id =>
        id === ENTRY
          ? "export * from 'lit';\nexport { repeat } from 'lit/directives/repeat.js';\nexport { classMap } from 'lit/directives/class-map.js';\nexport { styleMap } from 'lit/directives/style-map.js';\n"
          : null,
    },
  ],
});
const chunk = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk');
writeFileSync(OUT, header + chunk.code);
console.log(`game/vendor/lit.js: lit ${version}, ${(chunk.code.length / 1024).toFixed(1)} KB`);
