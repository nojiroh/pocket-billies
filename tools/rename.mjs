// Phase 05: renames internal names in the game, the Studio and their tools, one rule per commit, and checks that a
// rename changed nothing else.
//
//   node tools/rename.mjs name <old> <new> [<old> <new> ...]  top-level names of the pages' scripts
//   node tools/rename.mjs prefix <old> <new>                   every top-level name made of <old> and the rest of a
//                                                              name (a capital, digit, _ or $ next): dioMount ->
//                                                              walkViewMount, _dioProj -> _walkViewProj, DIO_FX ->
//                                                              WALK_VIEW_FX, Dio -> WalkView, dio -> walkView
//   node tools/rename.mjs file <old path> <new path>           git mv, the pages' script tags and the paths naming it
//   node tools/rename.mjs verify [--base <rev>] [--expect name|prefix|file <old> <new> ...] (--expect last)
//                                                              the staged changes (git add -A first) against <rev>
//                                                              (default HEAD)
//   --dry  print what would change, write nothing; --all  every place to check by hand, not a few per file
//
// name and prefix rename a declaration and every reference that resolves to it (a local of the same name is left
// alone), window. self. globalThis. and GAME. (debug-log.js) members, the debug log's lists of the functions it wraps and
// times (strings in debug-log.js), names that can only be code inside strings (dioMount, DGL_SH: the paint worker's source,
// the self-test's list of passes), comments (names with a capital, digit, _ or $ and at least two characters; plain
// words like `at` are only listed), and the JavaScript in the Python tools' strings (tools/rename-strings.py). A
// shorthand property keeps its key ({ dioMount } -> { dioMount: walkViewMount }): changing a key is a separate
// rename. The tool refuses a new name that a page already declares or uses as a global, a browser global, or one a
// local would capture. Then it remakes the modules' generated parts (tools/to-module.mjs) and lists every other place
// that holds an old name (short names in strings, properties, other files) for a person to check.
//
// verify parses each changed script before and after (generated parts left out) and passes only when the syntax trees
// are the same but for renamed identifiers, each old name renamed the same way everywhere, and strings that differ
// only by those renames. It prints the renames it found. In the Python tools only strings may differ
// (tools/rename-strings.py verify).
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import globals from 'globals';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, normalize, relative } from 'node:path';
import * as prettier from 'prettier';
import { HOOKS, LOG, LOG_NAMES, PAGES, SCRIPT_TAG, START, stripped, run as toModule } from './to-module.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const PARSE = { ecmaVersion: 'latest', range: true, loc: true, comment: true };
// objects whose members are the pages' top-level names (GAME: debug-log.js's view of the game's modules)
const WINDOWS = new Set(['window', 'self', 'globalThis', 'GAME']);
const BROWSER = new Set([...Object.keys(globals.browser), ...Object.keys(globals.builtin)]);
const GENERATED = new Set(['game/data/gamedata.js', HOOKS, LOG_NAMES]);
// history and plans keep the names they were written with
// (and CLAUDE.md, the owner's instructions, stays as they wrote it)
const HISTORY = /^(docs\/(HANDOFF\.md|archive\/|phases\/)|CHANGELOG\.md|CLAUDE\.md)/;
const TEXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.py',
  '.html',
  '.css',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.webmanifest',
]);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// any of the names as a whole word
// a plain lowercase word (at, rnd) is only worth a look where code would use it: at( at.x at[
const codeLike = (text, m) => !/^[a-z]+$/.test(m[0]) || /^[(.[]/.test(text.slice(m.index + m[0].length));
// a name that can only be code: a capital, digit, _ or $ in it, and four characters or more (or three, mixed case)
const inStrings = n => /[A-Z0-9_$]/.test(n) && (n.length >= 4 || (n.length === 3 && /[a-z]/.test(n)));
const words = names =>
  new RegExp(
    `(?<![\\w$])(?:${[...names]
      .sort((a, b) => b.length - a.length)
      .map(esc)
      .join('|')})(?![\\w$])`,
    'g'
  );

// every script of both pages and the service worker, each once: { file, kind, raw, text, at, page }
// kind 'module': text is the module without its generated part (tools/to-module.mjs writes that again);
// 'classic': the file as it is; 'inline': a script written in a page (at: where its text starts in the page)
function units() {
  const out = new Map();
  for (const page of PAGES) {
    const html = read(page);
    let n = 0;
    for (const m of html.matchAll(SCRIPT_TAG)) {
      const [whole, attrs, text] = m;
      const src = attrs.match(/\bsrc="([^"?]+\.js)(?:\?[^"]*)?"/);
      if (!src) {
        const file = `${page}#inline${n++}`;
        out.set(file, { file, kind: 'inline', page, raw: text, text, at: m.index + whole.indexOf('>') + 1 });
        continue;
      }
      const file = normalize(join(dirname(page), src[1]));
      if (src[1].includes('://') || out.has(file) || GENERATED.has(file)) continue;
      const raw = read(file),
        module = /\btype="module"/.test(attrs);
      out.set(file, { file, kind: module ? 'module' : 'classic', raw, text: module ? stripped(raw) : raw });
    }
  }
  // imported by every module, not a page script
  const tg = 'game/js/test-globals.js';
  out.set(tg, { file: tg, kind: 'esm', raw: read(tg), text: read(tg) });
  // the service worker: a global scope of its own (version.js and sw.js)
  out.set('game/sw.js', { file: 'game/sw.js', kind: 'classic', raw: read('game/sw.js'), text: read('game/sw.js') });
  return [...out.values()].map(u => ({ ...u, ...analyse(u.text, u.kind === 'esm' ? 'module' : 'script', u.file) }));
}

function analyse(text, sourceType, file) {
  let ast;
  try {
    ast = espree.parse(text, { ...PARSE, sourceType });
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
  const g = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType }).globalScope;
  const top = sourceType === 'module' ? g.childScopes[0] : g;
  const parent = new Map();
  walk(ast, null, (n, p) => parent.set(n, p));
  const declared = new Map(top.variables.filter(v => v.defs.length).map(v => [v.name, v]));
  return { ast, g, top, parent, declared, through: g.through };
}

function walk(n, p, fn) {
  fn(n, p);
  for (const [k, v] of Object.entries(n)) {
    if (k === 'parent') continue;
    if (Array.isArray(v)) for (const c of v) c && typeof c.type === 'string' && walk(c, n, fn);
    else if (v && typeof v.type === 'string') walk(v, n, fn);
  }
}

const upper = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(); // walkView -> WALK_VIEW
const cap = s => s[0].toUpperCase() + s.slice(1);

// the pairs a prefix rule makes from the names the scripts declare
function prefixPairs(all, o, n) {
  const pairs = new Map();
  const forms = [
    [o, n, /^[A-Z0-9_$]/],
    [upper(o), upper(n), /^[_0-9]/],
    [cap(o), cap(n), /^[A-Z0-9_$]/],
  ];
  for (const u of all)
    for (const x of u.declared.keys()) {
      const lead = x.match(/^_*/)[0],
        rest = x.slice(lead.length);
      for (const [a, b, next] of forms)
        if (rest === a || (rest.startsWith(a) && next.test(rest.slice(a.length)))) {
          pairs.set(x, lead + b + rest.slice(a.length));
          break;
        }
    }
  return pairs;
}

const lineOf = (text, at) => text.slice(0, at).split('\n').length;
const snippet = (text, at) => {
  const s = text.lastIndexOf('\n', at) + 1,
    e = text.indexOf('\n', at);
  const line = text.slice(s, e < 0 ? text.length : e);
  const c = at - s;
  return line.length > 160 ? '…' + line.slice(Math.max(0, c - 70), c + 70).trim() + '…' : line.trim();
};

// what renaming the pairs (Map old -> new) changes in the scripts: { edits: file -> [[start, end, text]], notes, problems }
function plan(all, pairs) {
  const declaredIn = new Map(),
    usedIn = new Map();
  const add = (m, k, v) => (m.has(k) ? m.get(k).add(v) : m.set(k, new Set([v])));
  for (const u of all) {
    for (const n of u.declared.keys()) add(declaredIn, n, u.file);
    for (const r of u.through) add(usedIn, r.identifier.name, u.file);
  }
  const problems = [],
    seen = new Map();
  for (const [o, n] of pairs) {
    if (!/^[A-Za-z_$][\w$]*$/.test(n)) problems.push(`${n} is not a name`);
    if (!declaredIn.has(o)) problems.push(`${o}: no script declares it`);
    if (pairs.has(n)) problems.push(`${n} is renamed too: rename in two steps`);
    if (declaredIn.has(n)) problems.push(`${n} is already declared in ${[...declaredIn.get(n)].join(', ')}`);
    if (usedIn.has(n)) problems.push(`${n} is already used as a global in ${[...usedIn.get(n)].join(', ')}`);
    if (BROWSER.has(n)) problems.push(`${n} is a browser or JavaScript global`);
    if (seen.has(n)) problems.push(`${seen.get(n)} and ${o} would both be ${n}`);
    seen.set(n, o);
  }
  const edits = new Map(),
    notes = [],
    strings = [],
    count = new Map();
  const any = words(pairs.keys());
  for (const u of all) {
    const E = new Map(); // start -> [start, end, text]
    const put = (s, e, t) => E.set(s, [s, e, t]);
    const at = (s, why) => `${u.file}:${lineOf(u.text, s)}: ${why}: ${snippet(u.text, s)}`;
    const ren = id => {
      const o = id.name,
        n = pairs.get(o);
      const p = u.parent.get(id),
        pp = p && u.parent.get(p);
      if (p && p.type === 'Property' && p.shorthand && p.value === id) put(id.range[0], id.range[1], `${o}: ${n}`);
      else if (p && p.type === 'AssignmentPattern' && pp && pp.type === 'Property' && pp.shorthand && pp.value === p)
        put(id.range[0], id.range[1], `${o}: ${n}`);
      else put(id.range[0], id.range[1], n);
      count.set(o, (count.get(o) || 0) + 1);
    };
    // a local of the new name between the reference and the top would capture it
    const captured = r => {
      const n = pairs.get(r.identifier.name);
      for (let s = r.from; s && s !== u.top && s !== u.g; s = s.upper)
        if (s.set.has(n))
          return problems.push(at(r.identifier.range[0], `a local ${n} would capture ${r.identifier.name}`));
    };
    for (const [o, v] of u.declared) {
      if (!pairs.has(o)) continue;
      for (const id of v.identifiers) ren(id);
      for (const r of v.references) {
        captured(r);
        ren(r.identifier);
      }
    }
    for (const r of u.through)
      if (pairs.has(r.identifier.name)) {
        captured(r);
        ren(r.identifier);
      }
    walk(u.ast, null, n => {
      if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && WINDOWS.has(n.object.name)) {
        const pr = n.property;
        if (!n.computed && pairs.has(pr.name)) {
          put(pr.range[0], pr.range[1], pairs.get(pr.name));
          count.set(pr.name, (count.get(pr.name) || 0) + 1);
        } else if (n.computed && pr.type === 'Literal' && pairs.has(pr.value)) {
          put(pr.range[0] + 1, pr.range[1] - 1, pairs.get(pr.value));
          count.set(pr.value, (count.get(pr.value) || 0) + 1);
        }
        return;
      }
      const strs =
        n.type === 'Literal' && typeof n.value === 'string'
          ? [[n.range[0], u.text.slice(...n.range)]]
          : n.type === 'TemplateElement'
            ? [[n.range[0], u.text.slice(...n.range)]]
            : [];
      for (const [s, t] of strs) {
        // the debug log names the functions it wraps and times
        if (u.file === LOG && n.type === 'Literal' && pairs.has(n.value)) {
          put(s + 1, s + t.length - 1, pairs.get(n.value));
          strings.push(at(s, `${n.value} -> ${pairs.get(n.value)}`));
          continue;
        }
        // a name that can only be code (dioMount, DGL_SH, csStart) is renamed in strings too: the paint worker's
        // source, the self-test's list of passes; short ones (S, GD, at) are only listed
        for (const m of t.matchAll(any))
          if (inStrings(m[0])) {
            put(s + m.index, s + m.index + m[0].length, pairs.get(m[0]));
            strings.push(at(s + m.index, `${m[0]} -> ${pairs.get(m[0])}`));
          } else if (codeLike(t, m)) notes.push(at(s + m.index, `string holds ${m[0]}`));
      }
      // a property of the same name (a plain lowercase word, like .at, is another thing)
      const prop = x => pairs.has(x) && !/^[a-z]+$/.test(x);
      if (n.type === 'MemberExpression' && !n.computed && prop(n.property.name))
        notes.push(at(n.property.range[0], `property .${n.property.name}`));
      if (n.type === 'Property' && !n.shorthand && !n.computed && n.key.type === 'Identifier' && prop(n.key.name))
        notes.push(at(n.key.range[0], `key ${n.key.name}:`));
    });
    for (const c of u.ast.comments)
      for (const m of u.text.slice(...c.range).matchAll(any)) {
        const s = c.range[0] + m.index,
          o = m[0];
        if (/[A-Z0-9_$]/.test(o) && o.length > 1) put(s, s + o.length, pairs.get(o));
        else if (codeLike(u.text, { index: s, 0: o })) notes.push(at(s, `comment holds ${o}`));
      }
    if (E.size) edits.set(u.file, [...E.values()]);
  }
  return { edits, notes, strings, problems, count };
}

// a classic script as Prettier writes it (the modules are written by tools/to-module.mjs), unless Prettier skips it
async function format(file, text) {
  const path = join(ROOT, file);
  if ((await prettier.getFileInfo(path, { ignorePath: join(ROOT, '.prettierignore') })).ignored) return text;
  return prettier.format(text, { ...(await prettier.resolveConfig(path)), filepath: path });
}

const apply = (text, E) => {
  for (const [s, e, t] of [...E].sort((a, b) => b[0] - a[0])) text = text.slice(0, s) + t + text.slice(e);
  return text;
};

// every tracked text file that is not a page script, for the paths and names the scripts don't hold
function otherFiles(all) {
  const scripts = new Set(all.map(u => u.file));
  return git('ls-files')
    .split('\n')
    .filter(f => f && TEXT.has(extname(f)) && !scripts.has(f) && !GENERATED.has(f) && !HISTORY.test(f))
    .filter(f => !f.startsWith('game/data/') || f.endsWith('.json'));
}

async function renameNames(pairs, dry) {
  const all = units();
  const { edits, notes, strings, problems, count } = plan(all, pairs);
  if (problems.length) throw new Error('refused:\n  ' + [...new Set(problems)].join('\n  '));
  for (const [o] of pairs) if (!count.get(o)) notes.push(`${o}: declared but nothing to rename?`);
  const pages = new Map();
  for (const [file, E] of edits) {
    const u = all.find(x => x.file === file);
    if (u.kind === 'inline') {
      if (!pages.has(u.page)) pages.set(u.page, []);
      pages.get(u.page).push(...E.map(([s, e, t]) => [s + u.at, e + u.at, t]));
    } else if (!dry) {
      const out = apply(u.text, E);
      writeFileSync(join(ROOT, file), u.kind === 'module' ? out : await format(file, out));
    }
  }
  if (!dry) for (const [page, E] of pages) writeFileSync(join(ROOT, page), apply(read(page), E));
  // the JavaScript in the Python tools' strings
  const py = otherFiles(all).filter(f => f.endsWith('.py'));
  const pyReport = JSON.parse(
    execFileSync('python3', [join(ROOT, 'tools/rename-strings.py'), dry ? 'dry' : 'apply'], {
      cwd: ROOT,
      input: JSON.stringify({ pairs: Object.fromEntries(pairs), files: py }),
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    })
  );
  // everything else that names an old name: the configs, the Node tools and the docs that describe the code as it is
  // (not CLAUDE.md, the history or the plans) get the names that can only be code; the rest is listed
  const any = words(pairs.keys()),
    other = [];
  for (const f of otherFiles(all).filter(f => !f.endsWith('.py'))) {
    const t = read(f);
    const fix = /\.(m?js|md)$/.test(f) && f !== 'CLAUDE.md' && f !== 'tools/rename.mjs';
    let out = '',
      i = 0;
    for (const m of t.matchAll(any)) {
      if (fix && inStrings(m[0])) {
        out += t.slice(i, m.index) + pairs.get(m[0]);
        i = m.index + m[0].length;
      } else if (codeLike(t, m)) notes.push(`${f}:${lineOf(t, m.index)}: holds ${m[0]}: ${snippet(t, m.index)}`);
    }
    if (i) {
      other.push(f);
      if (!dry) writeFileSync(join(ROOT, f), out + t.slice(i));
    }
  }
  if (!dry) await toModule([]);
  return { files: edits.size, count, strings, other, notes: [...notes, ...pyReport.review], python: pyReport.changed };
}

async function renameFile(o, n, dry) {
  o = normalize(o);
  n = normalize(n);
  if (!git('ls-files', o).trim()) throw new Error(`${o} is not tracked`);
  if (git('ls-files', n).trim()) throw new Error(`${n} exists`);
  const all = units();
  const same = git('ls-files')
    .split('\n')
    .filter(f => f !== o && basename(f) === basename(o));
  const changed = [],
    notes = [];
  // the forms a path to the file takes: from the repository (anywhere), from each page's folder (only in that folder:
  // studio/'s js/world.js is the Studio's own), from the tools' folder (only there)
  const forms = [[o, n, '']];
  for (const page of PAGES) forms.push([relative(dirname(page), o), relative(dirname(page), n), dirname(page) + '/']);
  forms.push([relative('tools', o), relative('tools', n), 'tools/']);
  forms.sort((x, y) => y[0].length - x[0].length);
  const files = [...new Set([...otherFiles(all), ...all.filter(u => u.kind !== 'inline').map(u => u.file)])];
  for (const f of files) {
    let t = read(f);
    const was = t;
    for (const [a, b, dir] of forms)
      if (f.startsWith(dir)) t = t.replace(new RegExp(`(?<![\\w./-])${esc(a)}(?![\\w-])`, 'g'), b);
    const base = new RegExp(`(?<![\\w./-])${esc(basename(o))}(?![\\w-])`, 'g');
    for (const m of t.matchAll(base)) {
      if (same.length)
        notes.push(
          `${f}:${lineOf(t, m.index)}: ${basename(o)} (another ${same.join(', ')} too): ${snippet(t, m.index)}`
        );
    }
    if (!same.length) t = t.replace(base, basename(n));
    if (t !== was) {
      changed.push(f);
      if (!dry) writeFileSync(join(ROOT, f), t);
    }
  }
  if (!dry) {
    git('mv', o, n);
    // in a new process: to-module.mjs names some files itself (debug-log.js), and this one has the old names loaded
    execFileSync('node', [join(ROOT, 'tools/to-module.mjs')], { cwd: ROOT, stdio: 'ignore' });
  }
  return { files: changed.length, changed, notes };
}

// ---- verify ----

const IGNORE = new Set(['range', 'loc', 'start', 'end', 'raw', 'comments', 'tokens', 'parent', 'shorthand']);

// compares two syntax trees; identifiers may differ (recorded in pairs), strings too (recorded, checked after)
function same(a, b, pairs, strings, where) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object')
    throw new Error(`${where}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) throw new Error(`${where}: lists of different length`);
    a.forEach((x, i) => same(x, b[i], pairs, strings, where));
    return;
  }
  const at = a.loc ? `${where.replace(/ line \d+$/, '')} line ${a.loc.start.line}` : where;
  if (a.type !== b.type) throw new Error(`${at}: ${a.type} -> ${b.type}`);
  if (a.type === 'Identifier' && a.name !== b.name) {
    const k = `${a.name} -> ${b.name}`;
    pairs.set(k, (pairs.get(k) || 0) + 1);
    return;
  }
  if (a.type === 'Literal' && typeof a.value === 'string' && typeof b.value === 'string' && a.value !== b.value) {
    strings.push([a.value, b.value, at]);
    return;
  }
  if (a.type === 'TemplateElement' && a.value.cooked !== b.value.cooked) {
    strings.push([a.value.cooked, b.value.cooked, at]);
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (IGNORE.has(k)) continue;
    same(a[k], b[k], pairs, strings, at);
  }
}

const MARKED = new RegExp('^' + esc(START), 'm');
function tree(text, file) {
  if (MARKED.test(text)) text = stripped(text);
  for (const sourceType of ['script', 'module'])
    try {
      return espree.parse(text, { ecmaVersion: 'latest', sourceType, loc: true });
    } catch (e) {
      if (sourceType === 'module') throw new Error(`${file}: ${e.message}`);
    }
}

const inline = html => [...html.matchAll(SCRIPT_TAG)].filter(m => !/\bsrc=/.test(m[1])).map(m => m[2]);
const withoutScripts = html => html.replace(SCRIPT_TAG, (m, attrs) => (/\bsrc=/.test(attrs) ? m : '<script></script>'));

function verify(base, expect) {
  const out = { pairs: new Map(), strings: [], checked: [], python: [], other: [], problems: [] };
  const rows = git('diff', '--cached', '-M', '--name-status', base)
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('\t'));
  for (const [st, a, b = a] of rows) {
    if (GENERATED.has(b)) continue;
    if (st === 'A' || st === 'D') {
      out.problems.push(`${st} ${a}: a rename adds or deletes no file`);
      continue;
    }
    const old = git('show', `${base}:${a}`),
      now = git('show', `:${b}`);
    try {
      if (/\.(m?js)$/.test(b)) {
        same(tree(old, a), tree(now, b), out.pairs, out.strings, b);
        out.checked.push(b);
      } else if (b.endsWith('.html')) {
        const [x, y] = [inline(old), inline(now)];
        if (x.length !== y.length) throw new Error(`${b}: a different number of inline scripts`);
        x.forEach((s, i) => same(tree(s, b), tree(y[i], b), out.pairs, out.strings, `${b} inline ${i}`));
        if (withoutScripts(old) !== withoutScripts(now)) out.other.push(`${b} (outside its inline scripts)`);
        out.checked.push(b);
      } else if (b.endsWith('.py')) out.python.push([a, b]);
      else out.other.push(b);
    } catch (e) {
      out.problems.push(e.message);
    }
  }
  if (out.python.length) {
    const r = JSON.parse(
      execFileSync('python3', [join(ROOT, 'tools/rename-strings.py'), 'verify', base], {
        cwd: ROOT,
        input: JSON.stringify({ files: out.python }),
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      })
    );
    out.problems.push(...r.problems);
    out.pyStrings = r.strings;
  }
  if (expect) {
    const [rule, o, n] = expect;
    const names = new Map();
    for (let i = 1; i + 1 < expect.length; i += 2) names.set(expect[i], expect[i + 1]);
    const ok = (a, b) => {
      if (rule === 'name') return names.get(a) === b;
      if (rule === 'prefix') {
        const m = prefixPairs([{ declared: new Map([[a, null]]) }], o, n);
        return m.get(a) === b;
      }
      return false; // a file rename renames no identifier
    };
    for (const k of out.pairs.keys()) {
      const [a, b] = k.split(' -> ');
      if (!ok(a, b)) out.problems.push(`not the rule ${expect.join(' ')}: ${k}`);
    }
    if (rule !== 'file' && !out.pairs.size) out.problems.push('nothing renamed');
  }
  // one name, one new name
  const to = new Map();
  for (const k of out.pairs.keys()) {
    const [a, b] = k.split(' -> ');
    if (to.has(a) && to.get(a) !== b) out.problems.push(`${a} became both ${to.get(a)} and ${b}`);
    to.set(a, b);
  }
  // a file rename may change the paths that name the file
  if (expect && expect[0] === 'file') to.set(basename(expect[1]), basename(expect[2]));
  // a changed string is the old one with some of the renamed names in it renamed, nothing else
  const re = to.size && words(to.keys());
  for (const [x, y, where] of out.strings) {
    let pat = '',
      i = 0;
    if (re)
      for (const m of x.matchAll(re)) {
        pat += esc(x.slice(i, m.index)) + `(?:${esc(m[0])}|${esc(to.get(m[0]))})`;
        i = m.index + m[0].length;
      }
    pat += esc(x.slice(i));
    if (!new RegExp(`^${pat}$`, 's').test(y))
      out.problems.push(`${where}: string ${JSON.stringify(x.slice(0, 80))} -> ${JSON.stringify(y.slice(0, 80))}`);
  }
  out.stringCount = out.strings.length;
  return out;
}

// the places to check by hand, a few per file (--all: every one)
function report(notes, all) {
  if (!notes.length) return;
  const by = new Map();
  for (const n of new Set(notes)) {
    const f = n.slice(0, n.indexOf(':'));
    if (!by.has(f)) by.set(f, []);
    by.get(f).push(n);
  }
  console.log(`check by hand (${notes.length} in ${by.size} files):`);
  for (const [f, ns] of by) {
    console.log(`  ${f} (${ns.length})`);
    for (const n of all ? ns : ns.slice(0, 4)) console.log(`    ${n.slice(f.length + 1)}`);
  }
}

async function main(argv) {
  const dry = argv.includes('--dry'),
    all = argv.includes('--all');
  const args = argv.filter(a => a !== '--dry' && a !== '--all');
  const [cmd, ...rest] = args;
  if (cmd === 'name' || cmd === 'prefix') {
    if (!rest.length || rest.length % 2) throw new Error(`${cmd} takes <old> <new> pairs`);
    let pairs = new Map();
    if (cmd === 'name') for (let i = 0; i < rest.length; i += 2) pairs.set(rest[i], rest[i + 1]);
    else {
      if (rest.length !== 2) throw new Error('prefix takes one <old> <new>');
      pairs = prefixPairs(units(), rest[0], rest[1]);
      if (!pairs.size) throw new Error(`no top-level name starts with ${rest[0]}`);
    }
    const r = await renameNames(pairs, dry);
    console.log(`${dry ? 'would rename' : 'renamed'} ${pairs.size} name(s) in ${r.files} script(s):`);
    for (const [o, n] of pairs) console.log(`  ${o} -> ${n} (${r.count.get(o) || 0})`);
    if (r.strings.length)
      console.log(
        `renamed in strings (${r.strings.length}):\n  ${r.strings.slice(0, all ? undefined : 12).join('\n  ')}`
      );
    if (r.python.length) console.log(`Python tools' strings:\n  ${r.python.join('\n  ')}`);
    if (r.other.length) console.log(`configs, Node tools and docs:\n  ${r.other.join('\n  ')}`);
    report(r.notes, all);
  } else if (cmd === 'file') {
    if (rest.length !== 2) throw new Error('file takes <old path> <new path>');
    const r = await renameFile(rest[0], rest[1], dry);
    console.log(`${dry ? 'would move' : 'moved'} ${rest[0]} -> ${rest[1]}; paths changed in ${r.files} file(s)`);
    if (r.changed.length) console.log('  ' + r.changed.join('\n  '));
    report(r.notes, all);
  } else if (cmd === 'verify') {
    const bi = args.indexOf('--base'),
      ei = args.indexOf('--expect');
    const base = bi >= 0 ? args[bi + 1] : 'HEAD';
    const expect = ei >= 0 ? args.slice(ei + 1) : null;
    const r = verify(base, expect);
    console.log(`checked ${r.checked.length} script file(s) and ${r.python.length} Python file(s) against ${base}`);
    for (const [k, c] of [...r.pairs].sort()) console.log(`  ${k} (${c})`);
    if (r.stringCount) console.log(`strings in scripts changed: ${r.stringCount}, each only by the renames`);
    if (r.pyStrings && r.pyStrings.length)
      console.log(`Python strings changed (${r.pyStrings.length}):\n  ${r.pyStrings.slice(0, 40).join('\n  ')}`);
    if (r.other.length) console.log(`not verified, look at the diff: ${r.other.join(', ')}`);
    if (r.problems.length) {
      console.error(`NOT a pure rename:\n  ${r.problems.join('\n  ')}`);
      process.exit(1);
    }
    console.log('a pure rename');
  } else throw new Error('usage: node tools/rename.mjs name|prefix|file|verify ... (see the top of the file)');
}

if (import.meta.url === `file://${process.argv[1]}`)
  main(process.argv.slice(2)).catch(e => {
    console.error(e.message);
    process.exit(1);
  });

export { prefixPairs, units, verify };
