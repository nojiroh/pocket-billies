// Phase 04a: Vite serves the repo for development (npm run dev) and builds the deployable site (npm run build).
// The build copies the deployable folders into dist/ (game/, studio/ and the root redirect page; not tools/, docs/,
// firebase/ or validation/), then (phase 04c) bundles each page's module scripts into one file.
import { createHash } from 'node:crypto';
import { cpSync, createReadStream, existsSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { build } from 'vite';
import { buildData } from './tools/build-data.mjs';

const ROOT = import.meta.dirname;
const SITE = ['index.html', 'game', 'studio'];
const EMPTY = '\0pb-empty-entry';
const PAGES = ['game/index.html', 'studio/index.html'];
const MODULE_TAG = /<script type="module" src="([^"]+)"><\/script>\n?/g;

// Phase 04c: a page's module scripts become one file, js/<page>-<hash>.js next to the page, in place of the first
// tag. Each page is bundled on its own into a single file, so the modules run in the page's order (their imports only
// point back); a shared chunk could run a Studio-and-game module before a game-only one that comes first on the page.
// Not minified, so a stack trace in a debug log reads as the code; the source map is next to it. The classic scripts
// (version.js, log.js, the art manifests, the data files) stay as they are; the module sources are left out of dist/.
async function bundlePage(outDir, page) {
  const file = resolve(outDir, page);
  const html = readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(MODULE_TAG)].map(m => resolve(ROOT, dirname(page), m[1]));
  const ENTRY = '\0pb-entry';
  const out = await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    publicDir: false,
    build: {
      write: false,
      minify: false,
      sourcemap: true,
      target: 'esnext',
      modulePreload: false,
      copyPublicDir: false,
      rollupOptions: { input: ENTRY, output: { format: 'es' } },
    },
    plugins: [
      {
        name: 'pb-entry',
        resolveId: id => (id === ENTRY ? id : null),
        load: id => (id === ENTRY ? srcs.map(s => `import ${JSON.stringify(s)};`).join('\n') : null),
      },
    ],
  });
  const chunks = (Array.isArray(out) ? out : [out]).flatMap(o => o.output).filter(o => o.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`${page}: expected one bundle, got ${chunks.length}`);
  const [chunk] = chunks;
  const name = `${page.split('/')[0]}-${createHash('sha256').update(chunk.code).digest('hex').slice(0, 10)}.js`;
  const js = resolve(dirname(file), 'js', name);
  writeFileSync(js, chunk.code + `\n//# sourceMappingURL=${name}.map\n`);
  writeFileSync(js + '.map', JSON.stringify({ ...chunk.map, file: name }));
  let first = true;
  writeFileSync(
    file,
    html.replace(MODULE_TAG, () => {
      if (!first) return '';
      first = false;
      return `<script type="module" src="js/${name}"></script>\n`;
    })
  );
  return srcs.map(s => relative(ROOT, s));
}

function copySite() {
  let outDir;
  return {
    name: 'pb-copy-site',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    resolveId(id) {
      return id === EMPTY ? id : null;
    },
    load(id) {
      return id === EMPTY ? 'export {}' : null;
    },
    generateBundle(_, bundle) {
      for (const k of Object.keys(bundle)) delete bundle[k];
    },
    async closeBundle() {
      for (const p of SITE) cpSync(resolve(ROOT, p), resolve(outDir, p), { recursive: true });
      rmSync(resolve(outDir, 'assets'), { recursive: true, force: true });
      buildData(resolve(outDir, 'game', 'data'));
      const sources = new Set(['game/js/test-globals.js', 'game/js/hooks.js']);
      for (const page of PAGES) for (const f of await bundlePage(outDir, page)) sources.add(f);
      for (const f of sources) rmSync(resolve(outDir, f));
      // the folder the engine's modules came from, now empty
      rmdirSync(resolve(outDir, 'game/js/engine'));
    },
  };
}

// The dev server would rewrite every .js request (with an inline source map: gamedata.js grows from 12 MB to 75 MB).
// The modules run in the browser as they are (relative imports, no packages) and the classic scripts must not be
// rewritten, so every script is served exactly as on disk.
function serveClassicScripts() {
  return {
    name: 'pb-classic-scripts',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0]);
        const file = resolve(ROOT, '.' + path);
        const inSite = file.startsWith(resolve(ROOT, 'game') + '/') || file.startsWith(resolve(ROOT, 'studio') + '/');
        if (!inSite || !file.endsWith('.js') || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// Phase 04b: data/gamedata.js is generated from the data files (game/data/*.json); made when the server starts and
// again whenever a data file changes (the Studio or an editor saving one).
function generateGameData() {
  return {
    name: 'pb-game-data',
    apply: 'serve',
    configureServer(server) {
      buildData();
      const data = resolve(ROOT, 'game', 'data') + '/';
      const again = f => {
        if (!f.startsWith(data) || !f.endsWith('.json')) return;
        try {
          buildData();
        } catch (e) {
          server.config.logger.error('game data: ' + e.message);
        }
      };
      server.watcher.add(data);
      for (const ev of ['add', 'change', 'unlink']) server.watcher.on(ev, again);
    },
  };
}

export default {
  root: ROOT,
  appType: 'mpa',
  server: { open: '/game/' },
  preview: { open: '/game/' },
  optimizeDeps: { noDiscovery: true },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: EMPTY } },
  plugins: [generateGameData(), serveClassicScripts(), copySite()],
};
