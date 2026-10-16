// Phase 04a: Vite serves the repo for development (npm run dev) and builds the deployable site (npm run build).
// The game and the Studio are still classic <script> files in a fixed order, which Vite can't bundle, so for now the
// build copies the deployable folders into dist/ unchanged: game/, studio/ and the root redirect page (not tools/,
// docs/, firebase/ or validation/). Phase 04c turns the scripts into ES modules and lets Vite bundle them.
import { cpSync, createReadStream, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = import.meta.dirname
const SITE = ['index.html', 'game', 'studio']
const EMPTY = '\0pb-empty-entry'

function copySite() {
  let outDir
  return {
    name: 'pb-copy-site',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    resolveId(id) {
      return id === EMPTY ? id : null
    },
    load(id) {
      return id === EMPTY ? 'export {}' : null
    },
    generateBundle(_, bundle) {
      for (const k of Object.keys(bundle)) delete bundle[k]
    },
    closeBundle() {
      for (const p of SITE) cpSync(resolve(ROOT, p), resolve(outDir, p), { recursive: true })
      rmSync(resolve(outDir, 'assets'), { recursive: true, force: true })
    },
  }
}

// The dev server would rewrite every .js request as a module (with an inline source map: gamedata.js grows from 12 MB
// to 75 MB). None of the game's or the Studio's scripts is a module yet, so they are served exactly as on disk.
function serveClassicScripts() {
  return {
    name: 'pb-classic-scripts',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0])
        const file = resolve(ROOT, '.' + path)
        const inSite = file.startsWith(resolve(ROOT, 'game') + '/') || file.startsWith(resolve(ROOT, 'studio') + '/')
        if (!inSite || !file.endsWith('.js') || !existsSync(file)) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default {
  root: ROOT,
  appType: 'mpa',
  server: { open: '/game/' },
  preview: { open: '/game/' },
  optimizeDeps: { noDiscovery: true },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: EMPTY } },
  plugins: [serveClassicScripts(), copySite()],
}
