// Phase 04a: Vite serves the repo for development (npm run dev) and builds the deployable site (npm run build).
// The build copies the deployable folders into dist/ (game/, studio/ and the root redirect page; not tools/, docs/,
// firebase/ or validation/), then (phase 04c) bundles each page's module scripts into one file.
import { createHash } from 'node:crypto';
import {
  cpSync,
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { build } from 'vite';
import { buildData } from './tools/build-data.mjs';

const ROOT = import.meta.dirname;
const SITE = ['index.html', 'game', 'studio'];
const EMPTY = '\0pb-empty-entry';
// phase 06-4: the Studio's UI gallery (studio/gallery.html) is bundled too, so it works in the built site
const PAGES = ['game/index.html', 'studio/index.html', 'studio/gallery.html'];
const MODULE_TAG = /<script type="module" src="([^"]+)"><\/script>\n?/g;

// Phase 04c: a page's module scripts become one file, js/<page>-<hash>.js next to the page, in place of the first
// tag. Each page is bundled on its own into a single file, so the modules run in the page's order (their imports only
// point back); a shared chunk could run a Studio-and-game module before a game-only one that comes first on the page.
// LD-3 (the owner, 2026-10-27: minified, with its source map): only whitespace and comments go (PAGE_MINIFY), never a
// name, so a stack trace in a debug log still names the functions and the workers made from functions' source text
// (the ground painter's, the normal maps', the loader island's) still find them; the source map is next to it. The classic scripts
// (version.js, debug-log.js, the art manifests, the data files) stay as they are; the module sources are left out of dist/.
const PAGE_MINIFY = { compress: false, mangle: false, codegen: { removeWhitespace: true } };
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
      // a lazy import() (the Studio self-test, studio-test-start.js) goes into the same file: one bundle per page
      rollupOptions: {
        input: ENTRY,
        output: { format: 'es', codeSplitting: false, minify: PAGE_MINIFY, comments: false },
      },
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
  // every module in the bundle, the lazily imported ones too: their sources are left out of dist/
  const ids = chunk.moduleIds || Object.keys(chunk.modules || {});
  return [...srcs, ...ids.filter(id => id.startsWith(ROOT + '/'))].map(s => relative(ROOT, s));
}

// Studio plan T2.4: a module that isn't on a page (the logic worker's modules) as one file in its own place, its
// imports inlined in order; returns the sources it took in (left out of dist/), not itself
async function bundleModule(outDir, file) {
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
      rollupOptions: {
        input: resolve(ROOT, file),
        // the worker reads what it exports (an app build would drop an entry's exports)
        preserveEntrySignatures: 'strict',
        output: { format: 'es', codeSplitting: false },
      },
    },
  });
  const chunks = (Array.isArray(out) ? out : [out]).flatMap(o => o.output).filter(o => o.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`${file}: expected one bundle, got ${chunks.length}`);
  const [chunk] = chunks,
    name = file.split('/').pop();
  writeFileSync(resolve(outDir, file), chunk.code + `\n//# sourceMappingURL=${name}.map\n`);
  writeFileSync(resolve(outDir, file) + '.map', JSON.stringify({ ...chunk.map, file: name }));
  const ids = chunk.moduleIds || Object.keys(chunk.modules || {});
  return ids
    .filter(id => id.startsWith(ROOT + '/'))
    .map(s => relative(ROOT, s))
    .filter(f => f !== file);
}

// The owner, 2026-10-22: a phone must play the latest deploy. Each build is named (the commit on GitHub, else the
// time) in dist's version.js (PB_BUILD, read by the game and the service worker, so a new build is a new worker) and
// in build.json, which the game asks for to see whether the site has a newer one (game/js/update-check.js).
function stampBuild(outDir) {
  const sha = process.env.GITHUB_SHA,
    id = sha ? sha.slice(0, 12) : 'local-' + Date.now().toString(36),
    file = resolve(outDir, 'game/version.js'),
    src = readFileSync(file, 'utf8');
  if (!src.includes("self.PB_BUILD = '';")) throw new Error('game/version.js: no PB_BUILD line to stamp');
  writeFileSync(file, src.replace("self.PB_BUILD = '';", `self.PB_BUILD = ${JSON.stringify(id)};`));
  writeFileSync(resolve(outDir, 'game/build.json'), JSON.stringify({ build: id }) + '\n');
  // LD-3: the service worker fetches this build's page bundle when it installs (sw.js PRECACHE)
  const sw = resolve(outDir, 'game/sw.js'),
    swSrc = readFileSync(sw, 'utf8'),
    bundles = readdirSync(resolve(outDir, 'game/js')).filter(f => /^game-[0-9a-f]{10}\.js$/.test(f));
  if (!swSrc.includes('const PRECACHE = [];')) throw new Error('game/sw.js: no PRECACHE line to fill');
  writeFileSync(
    sw,
    swSrc.replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(bundles.map(f => 'js/' + f))};`)
  );
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
      // phase 04e: the types are for the type check only
      rmSync(resolve(outDir, 'game/types'), { recursive: true, force: true });
      buildData(resolve(outDir, 'game', 'data'));
      const sources = new Set(['game/js/test-globals.js', 'game/js/hooks.js']);
      for (const page of PAGES) for (const f of await bundlePage(outDir, page)) sources.add(f);
      // Studio plan T2.4: the Studio's logic worker loads its modules as one file too (it loads it once GAMEDATA is set)
      for (const f of await bundleModule(outDir, 'studio/js/logic-worker-modules.js')) sources.add(f);
      // LD-4: the run's helper thread's modules (game/js/run-worker.js loads them) as one file too
      for (const f of await bundleModule(outDir, 'game/js/run-worker-modules.js')) sources.add(f);
      // LD-5 (cutscenes session): the world map's helper thread's modules (game/js/bowl-worker.js loads them) too
      for (const f of await bundleModule(outDir, 'game/js/bowl-worker-modules.js')) sources.add(f);
      for (const f of sources) rmSync(resolve(outDir, f), { force: true });
      // the folder the engine's modules came from, now empty (phase 04e: and the logic's, once it has modules)
      rmdirSync(resolve(outDir, 'game/js/engine'));
      // phase 20: and the walk renderer's (walk-view-gl.js split into game/js/walk/)
      rmdirSync(resolve(outDir, 'game/js/walk'));
      if (existsSync(resolve(outDir, 'game/js/logic'))) rmdirSync(resolve(outDir, 'game/js/logic'));
      stampBuild(outDir);
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
