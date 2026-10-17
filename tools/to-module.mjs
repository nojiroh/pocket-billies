// Phase 04c: turns the game's and the Studio's classic scripts into ES modules, and keeps the generated parts of the
// modules up to date.
//
//   node tools/to-module.mjs game/js/boot.js game/js/ui.js   # make these modules (both pages), then refresh all
//   node tools/to-module.mjs                                 # refresh every module (npm run modules)
//   node tools/to-module.mjs --check                         # fail if a module's generated part is out of date
//
// A module keeps its code as it was. The tool writes, between the to-module markers at the top of the file:
// - imports of the names it reads from EARLIER modules of its page(s): only from a module that every page loading
//   this file loads before it, and only names this file never assigns to (an import is read-only),
// - expose({...}): every top-level name of the file, put on window as a getter and a setter of the module's own
//   variable (game/js/bridge.js). Everything that still reaches a name as a global keeps working: classic scripts, a
//   module's reference to a LATER file (the classic scripts could only do that at run time, too), the Studio's
//   stand-ins, the quick check, the console, and the debug log's wrappers (window.render = wrapped changes `render`
//   for every module that imports it, as replacing the global did).
// and `export` in front of each declaration another module imports. Nothing else in the file is touched.
// Modules run after every classic script, in page order; imports only point back, so the order stays the page order.
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import * as prettier from 'prettier';

const ROOT = join(import.meta.dirname, '..');
const PAGES = ['game/index.html', 'studio/index.html'];
const BRIDGE = 'game/js/bridge.js';
const START = '/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */';
const END = '/* to-module: end */';

const read = f => readFileSync(join(ROOT, f), 'utf8');
const SCRIPT_TAG = /<script([^>]*)>([\s\S]*?)<\/script>/g;

// a page's scripts in order: { file, module } or { inline, text }
function scriptsOf(page) {
  const out = [];
  let n = 0;
  for (const [, attrs, text] of read(page).matchAll(SCRIPT_TAG)) {
    const m = attrs.match(/\bsrc="([^"?]+\.js)(?:\?[^"]*)?"/);
    if (!m) out.push({ file: `${page}#inline${n++}`, inline: true, text });
    else if (!m[1].includes('://'))
      out.push({ file: normalize(join(dirname(page), m[1])), module: /\btype="module"/.test(attrs) });
  }
  return out;
}

// the file without its generated part and without the `export` keywords the tool put in
function stripped(text) {
  const a = text.indexOf(START);
  if (a >= 0) {
    const b = text.indexOf(END, a);
    if (b < 0) throw new Error('to-module: start marker without an end marker');
    let e = b + END.length;
    while (text[e] === '\n') e++;
    text = text.slice(0, a) + text.slice(e);
  }
  const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const cuts = [];
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') throw new Error('to-module: an import outside the generated part');
    if (node.type === 'ExportNamedDeclaration' && node.declaration)
      cuts.push([node.range[0], node.declaration.range[0]]);
    else if (node.type.startsWith('Export')) throw new Error('to-module: an export the tool did not write');
  }
  for (const [s, e] of cuts.reverse()) text = text.slice(0, s) + text.slice(e);
  return text;
}

// what a file declares at the top level and which names it reads or writes from outside
function analyse(text) {
  const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script', range: true });
  const g = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' }).globalScope;
  const own = new Map(); // name -> { kind: 'const' | 'let' | 'var' | 'function' | 'class', node: top-level statement or null }
  for (const v of g.variables) {
    if (!v.defs.length) continue;
    const d = v.defs[0];
    const kind = d.type === 'Variable' ? d.parent.kind : d.type === 'FunctionName' ? 'function' : 'class';
    const node = ast.body.find(s => s === d.parent || s === d.node) || null;
    own.set(v.name, { kind, node });
  }
  const reads = new Set(),
    writes = new Set();
  for (const r of g.through) (r.isWrite() ? writes : reads).add(r.identifier.name);
  return { ast, own, reads, writes };
}

// where the leading comments of a file end (the generated part goes after them)
function headerEnd(text) {
  let i = 0;
  for (;;) {
    const ws = text.slice(i).match(/^\s*/)[0].length;
    const j = i + ws;
    if (text.startsWith('//', j)) i = text.indexOf('\n', j) < 0 ? text.length : text.indexOf('\n', j) + 1;
    else if (text.startsWith('/*', j)) i = text.indexOf('*/', j) + 2;
    else if (/^(['"])use strict\1;?/.test(text.slice(j)))
      i = j + text.slice(j).match(/^(['"])use strict\1;?/)[0].length;
    else return i;
  }
}

function spec(from, to) {
  const r = relative(dirname(from), to);
  return r.startsWith('.') ? r : './' + r;
}

export async function run(args) {
  const check = args.includes('--check');
  const make = args.filter(a => !a.startsWith('--')).map(f => normalize(f));
  // 1. mark the files to convert as modules on every page that loads them
  for (const page of PAGES) {
    let html = read(page),
      changed = false;
    for (const f of make) {
      const src = relative(dirname(page), f);
      const tag = `<script src="${src}"></script>`;
      if (html.includes(tag)) {
        html = html.replace(tag, `<script type="module" src="${src}"></script>`);
        changed = true;
      }
    }
    if (changed && !check) writeFileSync(join(ROOT, page), html);
  }
  for (const f of make)
    if (!PAGES.some(p => scriptsOf(p).some(s => s.file === f))) throw new Error(`${f} is not a script of a page`);

  // 2. every page's scripts, what each declares and reads
  const pages = PAGES.map(p => ({ page: p, scripts: scriptsOf(p) }));
  const info = new Map();
  const texts = new Map();
  for (const { scripts } of pages)
    for (const s of scripts) {
      if (info.has(s.file)) continue;
      if (s.file === 'game/data/gamedata.js') {
        info.set(s.file, {
          own: new Map([['GAMEDATA', { kind: 'var', node: null }]]),
          reads: new Set(),
          writes: new Set(),
        });
        continue;
      }
      const raw = s.inline ? s.text : read(s.file);
      const text = s.inline ? raw : stripped(raw);
      texts.set(s.file, { raw, text });
      info.set(s.file, analyse(text));
    }
  const modules = new Set(pages.flatMap(p => p.scripts.filter(s => s.module).map(s => s.file)));
  if (make.length && !check) for (const f of make) modules.add(f);

  // 3. imports: a name is imported from G when, on every page loading the file, exactly one script declares it, it
  // is the same module G, G comes before the file, G declares it in a top-level statement, and the file never assigns
  // to it
  const imports = new Map(); // file -> Map(G -> Set(names))
  const exportsOf = new Map(); // G -> Set(names)
  for (const f of modules) {
    const { reads, writes } = info.get(f);
    const on = pages.filter(p => p.scripts.some(s => s.file === f));
    const im = new Map();
    for (const n of reads) {
      if (writes.has(n)) continue;
      let from = null;
      for (const { scripts } of on) {
        const defs = scripts.filter(s => info.get(s.file).own.has(n));
        const here = scripts.findIndex(s => s.file === f);
        const g = defs.length === 1 ? defs[0] : null;
        if (!g || !g.module || scripts.indexOf(g) > here || (from && from !== g.file)) {
          from = false;
          break;
        }
        from = g.file;
      }
      if (!from || !info.get(from).own.get(n).node) continue;
      if (!im.has(from)) im.set(from, new Set());
      im.get(from).add(n);
      if (!exportsOf.has(from)) exportsOf.set(from, new Set());
      exportsOf.get(from).add(n);
    }
    imports.set(f, im);
  }

  // 4. write each module: the generated part after the leading comments, `export` before the imported declarations
  const stale = [];
  const order = pages.flatMap(p => p.scripts.map(s => s.file));
  for (const f of modules) {
    const { text, raw } = texts.get(f);
    const { own, ast } = info.get(f);
    if (own.has('expose')) throw new Error(`${f} declares its own expose()`);
    const lines = [START, `import { expose } from '${spec(f, BRIDGE)}';`];
    const im = [...imports.get(f)].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    for (const [g, names] of im) lines.push(`import { ${[...names].sort().join(', ')} } from '${spec(f, g)}';`);
    const names = [...own.keys()].sort();
    if (names.length) {
      // the setters replace functions on purpose: the debug log and the Studio wrap or swap them through window
      lines.push('/* eslint-disable no-func-assign */');
      lines.push(
        `expose({ ${names.map(n => (own.get(n).kind === 'const' ? `${n}: [() => ${n}]` : `${n}: [() => ${n}, v => (${n} = v)]`)).join(', ')} });`
      );
      lines.push('/* eslint-enable no-func-assign */');
    }
    lines.push(END);
    // export keywords, last to first so the offsets hold
    const ex = new Set([...(exportsOf.get(f) || [])].map(n => own.get(n).node));
    let body = text;
    for (const node of [...ex].sort((a, b) => b.range[0] - a.range[0]))
      body = body.slice(0, node.range[0]) + 'export ' + body.slice(node.range[0]);
    void ast;
    const h = headerEnd(body);
    const head = body.slice(0, h).replace(/\s*$/, '');
    let out = (head ? head + '\n' : '') + lines.join('\n') + '\n' + body.slice(h).replace(/^\s*\n/, '');
    out = await prettier.format(out, { ...(await prettier.resolveConfig(join(ROOT, f))), filepath: join(ROOT, f) });
    if (out !== raw) {
      stale.push(f);
      if (!check) writeFileSync(join(ROOT, f), out);
    }
  }
  if (check && stale.length) throw new Error('to-module: out of date (run npm run modules): ' + stale.join(', '));
  return { modules: [...modules], changed: stale };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then(
    r => console.log(`${r.modules.length} modules, ${r.changed.length} changed`),
    e => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
