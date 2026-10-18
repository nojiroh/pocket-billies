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
// - phase 04d: imports from game/js/hooks.js (which the tool also writes) of the names it reads from a LATER module,
//   or from whichever module the page has (the shared renderer reading the game's or the Studio's names), and
//   provide({...}) of its own names other modules read from there (functions here; other values right after their
//   declaration, in a line ending in a to-module comment),
// - setters for the functions the debug log wraps, when the module has none of its own (game/js/debug-log-names.js, also
//   written by the tool, hands them to debug-log.js),
// - expose({...}): every top-level name of the file, put on window as a getter and a setter only when the checks or
//   the console ask for it (game/js/test-globals.js),
// and `export` in front of each declaration another module imports. Nothing else in the file is touched.
// Modules run after every classic script, in page order; imports only point back (forward names go through
// hooks.js), so the order stays the page order. The tool checks that nothing a module reads while it loads comes from
// a module that hasn't run yet.
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import * as prettier from 'prettier';

const ROOT = join(import.meta.dirname, '..');
export const PAGES = ['game/index.html', 'studio/index.html'];
export const BRIDGE = 'game/js/test-globals.js';
export const START = '/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */';
export const END = '/* to-module: end */';
export const HOOKS = 'game/js/hooks.js';
// phase 04d: the debug log (a classic script) reaches the game's modules through what this module, made by the tool
// and the last of the game's page, puts in debug-log.js's GAME object
export const LOG = 'game/js/debug-log.js';
export const LOG_NAMES = 'game/js/debug-log-names.js';
const setterName = n => 'set' + n[0].toUpperCase() + n.slice(1);
// phase 04d: after a declaration another module reads through hooks.js, the tool hands the value over
const PROVIDE_LINE = /^provide\(\{[^}]*\}\); \/\* to-module \*\/\n/gm;

const read = f => readFileSync(join(ROOT, f), 'utf8');
export const SCRIPT_TAG = /<script([^>]*)>([\s\S]*?)<\/script>/g;

// a page's scripts in order: { file, module } or { inline, text }
export function scriptsOf(page) {
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
export function stripped(text) {
  const a = text.indexOf(START);
  if (a >= 0) {
    const b = text.indexOf(END, a);
    if (b < 0) throw new Error('to-module: start marker without an end marker');
    let e = b + END.length;
    while (text[e] === '\n') e++;
    text = text.slice(0, a) + text.slice(e);
  }
  text = text.replace(PROVIDE_LINE, '');
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
    // assigned after its declaration (a copy handed to hooks.js would go stale), except in a setter of the module
    // that hands the new value over itself: function setX() { X = v; provide({ X }); }
    const setter = r => {
      const b = r.from.variableScope.block;
      return (
        b.type === 'FunctionDeclaration' &&
        /^set[A-Z_$]/.test(b.id.name) &&
        r.from.variableScope.through.some(t => t.identifier.name === 'provide')
      );
    };
    const late = v.references.some(r => r.isWrite() && !r.init && !setter(r));
    own.set(v.name, { kind, node, late });
  }
  const reads = new Set(),
    writes = new Set();
  for (const r of g.through) (r.isWrite() ? writes : reads).add(r.identifier.name);
  return { ast, own, reads, writes, ...loadTime(ast, g) };
}

// Phase 04d: what a file reads WHILE it loads, and what each of its named functions reads when it is called. Counted:
// the code that runs then (not the functions it only defines), the functions it calls at once or hands to a call
// that runs them now (forEach, map), but not callbacks for later (addEventListener, setTimeout, then) or functions
// handed to a setter (setWorldMapMount). `typeof x` can't fail, so it doesn't count. Of the names read, only the called ones are followed into their functions.
// A function stored in an object or returned is not followed: the check is a safety net, not a proof.
const LATER =
  /^(set[A-Z_$]\w*|addEventListener|setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask|then|catch|finally|on|once|observe)$/;
function loadTime(ast, g) {
  const parent = new Map();
  (function walk(n, p) {
    parent.set(n, p);
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) for (const c of v) c && typeof c.type === 'string' && walk(c, n);
      else if (v && typeof v.type === 'string') walk(v, n);
    }
  })(ast, null);
  const calleeName = c => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property.name : '');
  const isOuter = r => !r.resolved || r.resolved.scope === g;
  // what runs when this scope runs: { reads, calls } of names from outside the function
  const eager = (scope, out = { reads: new Set(), calls: new Set() }) => {
    for (const r of scope.references) {
      if (!isOuter(r) || r.isWrite()) continue;
      const id = r.identifier,
        p = parent.get(id);
      if (p.type === 'UnaryExpression' && p.operator === 'typeof') continue;
      out.reads.add(id.name);
      if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.callee === id) out.calls.add(id.name);
      if (p.type === 'TaggedTemplateExpression' && p.tag === id) out.calls.add(id.name);
    }
    for (const c of scope.childScopes) {
      if (c.type !== 'function') {
        eager(c, out);
        continue;
      }
      const b = c.block,
        p = parent.get(b);
      if (
        (p.type === 'CallExpression' || p.type === 'NewExpression') &&
        (p.callee === b || !LATER.test(calleeName(p.callee)))
      )
        eager(c, out);
    }
    return out;
  };
  const fnReads = new Map(); // function name -> { reads, calls } when it runs
  const named = (name, scope) => {
    const e = eager(scope);
    const was = fnReads.get(name);
    if (was) for (const k of ['reads', 'calls']) for (const n of e[k]) was[k].add(n);
    else fnReads.set(name, e);
  };
  (function find(scope) {
    for (const c of scope.childScopes) {
      if (c.type === 'function') {
        const b = c.block,
          p = parent.get(b);
        if (b.type === 'FunctionDeclaration' && b.id && scope === g) named(b.id.name, c);
        else if (p.type === 'VariableDeclarator' && p.init === b && p.id.type === 'Identifier' && c.upper === g)
          named(p.id.name, c);
        else if (p.type === 'AssignmentExpression' && p.right === b && p.left.type === 'Identifier')
          named(p.left.name, c);
      }
      find(c);
    }
  })(g);
  const top = eager(g);
  return { loadReads: top.reads, loadCalls: top.calls, fnReads };
}

// where the leading comments of a file end (the generated part goes after them)
export function headerEnd(text) {
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
      if (s.file === LOG_NAMES) {
        info.set(s.file, {
          own: new Map(),
          reads: new Set(),
          writes: new Set(),
          loadReads: new Set(),
          fnReads: new Map(),
        });
        continue;
      }
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
  modules.delete(LOG_NAMES);

  // 3. Where each name a module reads from another file comes from:
  // - an import from G when, on every page loading the file, exactly one script declares it, it is the same module G,
  //   G comes before the file, G declares it in a top-level statement, and the file never assigns to it;
  // - phase 04d: an import from game/js/hooks.js when it comes from a LATER module, or from a different module (or
  //   none) depending on the page (the shared renderer reading the game's or the Studio's names). The module that
  //   declares it hands it to hooks.js: functions at the top (they exist before the module runs), everything else
  //   right after its declaration, as the bridge did. Imports pointing forward would change the order the modules run in (an
  //   imported module runs first), so they go through hooks.js and the page order stays as it is;
  // - a global, when only classic scripts declare it.
  // Anything else is an error: since phase 04d the test globals (expose) are only there for the checks and the console. A name
  // another module assigns needs a setter in the module that declares it (setX, calling provide({ X })).
  const order = pages.flatMap(p => p.scripts.map(s => s.file));
  // names some other module assigns
  const assigned = new Set([...modules].flatMap(f => [...info.get(f).writes]));
  const imports = new Map(); // file -> Map(G -> Set(names))
  const exportsOf = new Map(); // G -> Set(names)
  const hooked = new Map(); // name -> Set(files that hand it to hooks.js)
  const bridged = new Set();
  const use = (map, k, n) => {
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(n);
  };
  for (const f of modules) {
    const { reads, writes } = info.get(f);
    const on = pages.filter(p => p.scripts.some(s => s.file === f));
    const im = new Map();
    for (const n of reads) {
      if (writes.has(n)) continue;
      const defs = on.map(({ scripts }) => {
        const d = scripts.filter(s => info.get(s.file).own.has(n));
        return { d, before: d.length === 1 && scripts.indexOf(d[0]) < scripts.findIndex(s => s.file === f) };
      });
      if (!defs.some(({ d }) => d.some(s => s.module))) continue;
      const one = defs.every(({ d }) => d.length === 1) && defs.every(({ d }) => d[0].file === defs[0].d[0].file);
      const g = one ? defs[0].d[0].file : null;
      if (one && defs.every(({ before }) => before) && defs[0].d[0].module && info.get(g).own.get(n).node) {
        use(im, g, n);
        use(exportsOf, g, n);
        continue;
      }
      const ok = defs.every(
        ({ d }) =>
          d.length <= 1 &&
          d.every(
            s => s.module && s.file !== f && info.get(s.file).own.get(n).node && !info.get(s.file).own.get(n).late
          )
      );
      if (!ok || assigned.has(n)) {
        bridged.add(n);
        continue;
      }
      use(im, HOOKS, n);
      for (const { d } of defs) for (const s of d) use(hooked, n, s.file);
    }
    imports.set(f, im);
  }
  // 3b. the debug log: what debug-log.js reads (GAME.x) and the functions it wraps (wrap('render', ...) and the timing
  // lists), each from the game module that declares it. A function it wraps gets a setter in that module (its own
  // setX, or one the tool writes in the generated part), so the wrapped version is the one every module calls.
  const logText = read(LOG);
  const logReads = new Set([...logText.matchAll(/\bGAME\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  const logWraps = new Set([...logText.matchAll(/(?:\bwrap\(|\[)\s*'(\w+)',/g)].map(m => m[1]));
  const gamePage = pages.find(p => p.page === 'game/index.html').scripts;
  const logFrom = new Map(); // G -> Set(names debug-log-names.js imports)
  const genSetters = new Map(); // G -> Set(names the tool writes a setter for)
  const logSet = new Map(); // name -> its setter
  for (const n of new Set([...logReads, ...logWraps])) {
    const d = gamePage.filter(s => info.get(s.file).own.has(n));
    if (d.length !== 1 || !d[0].module) {
      if (logReads.has(n)) throw new Error(`to-module: debug-log.js reads GAME.${n}, which no game module declares`);
      continue; // a timing list may name a function that is gone; debug-log.js skips it
    }
    const g = d[0].file,
      own = info.get(g).own;
    use(logFrom, g, n);
    if (own.get(n).node) use(exportsOf, g, n);
    if (!logWraps.has(n)) continue;
    const k = setterName(n);
    if (own.has(k) && own.get(k).kind === 'function') {
      use(logFrom, g, k);
      use(exportsOf, g, k);
    } else if (['const', 'class'].includes(own.get(n).kind))
      throw new Error(`to-module: debug-log.js wraps ${n}, a ${own.get(n).kind} in ${g}`);
    else {
      use(genSetters, g, n);
      use(logFrom, g, k);
    }
    logSet.set(n, k);
  }
  const provides = new Map(); // G -> Set(names it hands to hooks.js)
  for (const [n, files] of hooked) for (const g of files) use(provides, g, n);
  for (const n of hooked.keys())
    if (n === 'provide' || n === 'set') throw new Error(`to-module: ${n} can't be a hook (hooks.js uses the name)`);

  // 4. write each module: the generated part after the leading comments, `export` before the imported declarations,
  // and provide({...}) after each declaration (not a function) another module reads through hooks.js
  const stale = [];
  const write = async (f, out, raw) => {
    out = await prettier.format(out, { ...(await prettier.resolveConfig(join(ROOT, f))), filepath: join(ROOT, f) });
    if (out !== raw) {
      stale.push(f);
      if (!check) writeFileSync(join(ROOT, f), out);
    }
  };
  for (const f of modules) {
    const { text, raw } = texts.get(f);
    const { own } = info.get(f);
    if (own.has('expose') || own.has('provide')) throw new Error(`${f} declares its own expose() or provide()`);
    const gives = [...(provides.get(f) || [])].sort();
    const early = gives.filter(n => own.get(n).kind === 'function');
    const later = gives.filter(n => own.get(n).kind !== 'function');
    const lines = [START, `import { expose } from '${spec(f, BRIDGE)}';`];
    const im = [...imports.get(f)].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    const fromHooks = [...(imports.get(f).get(HOOKS) || [])];
    const gen = [...(genSetters.get(f) || [])].sort();
    if (gives.length || gen.length || info.get(f).reads.has('provide')) fromHooks.push('provide');
    if (fromHooks.length) lines.push(`import { ${fromHooks.sort().join(', ')} } from '${spec(f, HOOKS)}';`);
    for (const [g, names] of im)
      if (g !== HOOKS) lines.push(`import { ${[...names].sort().join(', ')} } from '${spec(f, g)}';`);
    const names = [...own.keys()].sort();
    const fns = names.some(n => own.get(n).kind === 'function');
    // a module's own setter (setSaveData for saveData) also hands the value to hooks.js, so the test globals use it
    const setterOf = n => {
      const k = setterName(n);
      if ((own.has(k) && own.get(k).kind === 'function') || gen.includes(n)) return `v => ${k}(v)`;
      return hooked.has(n) ? `v => ((${n} = v), provide({ ${n} }))` : `v => (${n} = v)`;
    };
    // phase 04e: in a file the type check reads (// @ts-check at the top), TypeScript refuses an assignment to a
    // function or a class; the generated ones are on purpose, so the line before each says so. Only in those files:
    // elsewhere the comment would be noise.
    const typeChecked = /^\/\/ @ts-check\b/m.test(text.slice(0, headerEnd(text)));
    const replaces = n => typeChecked && ['function', 'class'].includes(own.get(n).kind);
    const EXPECT = '// @ts-expect-error -- replaced on purpose';
    const entry = n => {
      if (own.get(n).kind === 'const') return `${n}: [() => ${n}]`;
      const set = setterOf(n);
      // only an arrow that assigns the name itself (v => (n = v)), not one that calls the module's own setter
      return `${replaces(n) && set.startsWith('v => (') ? `\n${EXPECT}\n` : ''}${n}: [() => ${n}, ${set}]`;
    };
    if (names.length) {
      // the setters replace functions on purpose: the checks and the console set them (only with the test globals on)
      if (fns) lines.push('/* eslint-disable no-func-assign */');
      lines.push(`expose({ ${names.map(entry).join(', ')} });`);
      if (fns) lines.push('/* eslint-enable no-func-assign */');
    }
    if (early.length) lines.push(`provide({ ${early.join(', ')} });`);
    // setters for the functions the debug log wraps (debug-log-names.js)
    for (const n of gen)
      lines.push(
        `export function ${setterName(n)}(v) {`,
        ...(replaces(n) ? [`  ${EXPECT}`] : []),
        `  ${n} = v;${own.get(n).kind === 'function' ? ' // eslint-disable-line no-func-assign' : ''}`,
        `  provide({ ${n} });`,
        '}'
      );
    lines.push(END);
    // export keywords and the hand-over after each declaration hooks.js needs, last to first so the offsets hold
    const ex = new Set([...(exportsOf.get(f) || [])].map(n => own.get(n).node));
    const after = new Map();
    for (const n of later) use(after, own.get(n).node, n);
    const edits = [
      ...[...ex].map(node => [node.range[0], 'export ']),
      ...[...after].map(([node, ns]) => [
        node.range[1],
        `\nprovide({ ${[...ns].sort().join(', ')} }); /* to-module */`,
      ]),
    ];
    let body = text;
    for (const [at, str] of edits.sort((a, b) => b[0] - a[0])) body = body.slice(0, at) + str + body.slice(at);
    // the generated part goes where it was (a comment right after it stays below it), else after the leading comments
    const was = raw.indexOf(START);
    const h = was >= 0 ? was : headerEnd(body);
    const head = body.slice(0, h).replace(/\s*$/, '');
    let out = (head ? head + '\n' : '') + lines.join('\n') + '\n' + body.slice(h).replace(/^\s*\n/, '');
    await write(f, out, raw);
  }
  // hooks.js: a slot per name, filled by the module that declares it
  const slots = [...hooked.keys()].sort();
  const hooksOut = [
    '// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. A slot for each name a module reads from a',
    "// LATER module, or from whichever module the page has (the shared renderer reading the game's or the Studio's",
    '// names). The module that declares the name hands it over with provide(): functions before it runs, everything',
    '// else once it has loaded. A slot no module of the page fills stays undefined (typeof checks still work).',
    `export let ${slots.join(', ')};`,
    `const set = { ${slots.map(n => `${n}: v => (${n} = v)`).join(', ')} };`,
    '// a setter hands its new value over whether or not another module reads it through here',
    'export function provide(names) {',
    '  for (const k in names) if (set[k]) set[k](names[k]);',
    '}',
    '',
  ].join('\n');
  await write(HOOKS, hooksOut, existsSync(join(ROOT, HOOKS)) ? read(HOOKS) : '');
  // debug-log-names.js: what the debug log reads and wraps, put in debug-log.js's GAME object
  const logOut = [
    '// Phase 04d: made by tools/to-module.mjs (npm run modules), do not edit. What the debug log (debug-log.js, a classic',
    "// script that runs before the modules) reads and wraps in the game's modules: a getter for each name in its GAME",
    "// object, and a setter (the module's own) for each function it wraps. The last module of the game's page.",
    ...[...logFrom]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([g, ns]) => `import { ${[...ns].sort().join(', ')} } from '${spec(LOG_NAMES, g)}';`),
    'Object.defineProperties(GAME, {',
    ...[...new Set([...logReads, ...logSet.keys()])]
      .filter(n => [...logFrom.values()].some(ns => ns.has(n)))
      .sort()
      .map(n => `  ${n}: { get: () => ${n}${logSet.has(n) ? `, set: ${logSet.get(n)}` : ''} },`),
    '});',
    '',
  ].join('\n');
  await write(LOG_NAMES, logOut, existsSync(join(ROOT, LOG_NAMES)) ? read(LOG_NAMES) : '');
  if (bridged.size)
    throw new Error(
      `to-module: these names are assigned by another module, or declared in a way hooks.js can't follow; give each a ` +
        `setter in the module that declares it (setX, calling provide({ X })): ${[...bridged].sort().join(', ')}`
    );
  if (check && stale.length) throw new Error('to-module: out of date (run npm run modules): ' + stale.join(', '));

  // 5. Phase 04d: nothing a module reads WHILE it loads (directly or through the functions it calls then) may come
  // from a module that hasn't run yet on that page, or from hooks.js before the module filling it has handed it over.
  const problems = [];
  for (const { page, scripts } of pages) {
    const ran = scripts.filter(s => modules.has(s.file)).map(s => s.file);
    const at = new Map(ran.map((f, i) => [f, i]));
    const definer = n => scripts.find(s => info.get(s.file).own.has(n));
    for (const m of ran) {
      // [file the name is read in, name, called?]
      const todo = [...info.get(m).loadReads].map(n => [m, n, info.get(m).loadCalls.has(n)]);
      const done = new Set();
      while (todo.length) {
        const [from, n, called] = todo.pop();
        const d = info.get(from).own.has(n) ? { file: from, module: true } : definer(n);
        if (!d || !d.module || done.has(d.file + ' ' + n + called)) continue;
        done.add(d.file + ' ' + n + called);
        if (d.file !== m && !(at.get(d.file) < at.get(m)))
          problems.push(`${page}: ${m} reads ${n} (${d.file}) while it loads, before ${d.file} has run`);
        const fn = called && info.get(d.file).fnReads.get(n);
        if (fn) for (const r of fn.reads) todo.push([d.file, r, fn.calls.has(r)]);
      }
    }
  }
  if (problems.length) throw new Error('to-module: load order\n  ' + [...new Set(problems)].join('\n  '));
  return { modules: [...modules], changed: stale, hooks: slots.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then(
    r => {
      console.log(`${r.modules.length} modules, ${r.changed.length} changed`);
      console.log(`${r.hooks} names through hooks.js`);
    },
    e => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
