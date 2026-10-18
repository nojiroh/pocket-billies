// Phase 04e: moves top-level declarations, by name, from one module to another (a new one or one that exists), one
// move per commit, and checks that a move changed nothing else.
//
//   node tools/move-names.mjs <from> <to> <name> [<name> ...] [--after <script>] [--header <text>] [--with-header] [--dry]
//   node tools/move-names.mjs verify [--base <rev>]     the staged changes (git add -A first) against <rev> (HEAD)
//
// A move cuts each named declaration out of <from>, with the comments above it and any statement right after it that
// works on what it declares (STEP_BRACKETS.push(...) after STEP_BRACKETS), and appends them, in their order, to <to>.
// A new <to> starts with 'use strict', --header (a comment saying what the module is) and, with --with-header, the
// header comments of <from> (they described what moves); it goes on every page that loads <from>, right after
// --after <script> or right before <from>. A declaration of several names (const a = 1, b = 2) moves whole: name them
// all. Then tools/to-module.mjs remakes the generated parts (imports, exports, hooks.js, debug-log-names.js): the code
// that stays imports what moved, the moved code imports what it reads. The tool lists what now runs at load in <to>
// (it runs earlier when <to> comes first; to-module's load-order check covers what it reads) and the statements left
// in <from> that use a moved name.
//
// verify parses every changed script before and after (generated parts and `export` left out) and passes only when
// they hold the same top-level statements, token for token (comments and layout aside), each in one file, every file
// keeps the order of the statements it got from each other file, no comment is lost, and the pages only gained
// module tags. It prints the comments that are new (a new module's header).
import * as espree from 'espree';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { HOOKS, LOG_NAMES, PAGES, headerEnd, scriptsOf, stripped, run as toModule } from './to-module.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const PARSE = { ecmaVersion: 'latest', sourceType: 'module', range: true, comment: true };
const GENERATED = new Set([HOOKS, LOG_NAMES, 'game/data/gamedata.js']);
const TAG = src => `<script type="module" src="${src}"></script>`;

function patternNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern')
    p.properties.forEach(q => patternNames(q.type === 'RestElement' ? q.argument : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach(e => patternNames(e, out));
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  return out;
}
const declared = n => {
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') return [n.id.name];
  if (n.type === 'VariableDeclaration') return n.declarations.flatMap(d => patternNames(d.id));
  return [];
};
// the identifiers a statement names (not property keys after a dot or in an object literal)
function namesIn(node) {
  const out = new Set();
  (function walk(n, parent, key) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      const prop =
        parent &&
        ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
          (parent.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand));
      if (!prop) out.add(n.name);
      return;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === 'range' || k === 'loc') continue;
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k));
      else if (v && typeof v.type === 'string') walk(v, n, k);
    }
  })(node, null, null);
  return out;
}

// the top-level statements of a module's hand-written text, each with its span: the comments and blank lines above
// it, the statement, and a comment that starts on its last line
export function statements(text) {
  const ast = espree.parse(text, PARSE);
  const h = headerEnd(text);
  const lineEnd = p => {
    let e = p;
    for (const c of ast.comments) if (c.range[0] >= e && !/\n/.test(text.slice(e, c.range[0]))) e = c.range[1];
    const nl = text.indexOf('\n', e);
    return nl < 0 ? text.length : nl + 1;
  };
  let at = h;
  const out = [];
  for (const node of ast.body) {
    if (node.range[1] <= h) continue; // 'use strict'
    const span = [at, lineEnd(node.range[1])];
    at = span[1];
    out.push({ node, span, names: declared(node) });
  }
  return { ast, header: h, statements: out, tail: text.slice(at) };
}

function pageTagsAdd(from, to, after, dry) {
  const added = [];
  for (const page of PAGES) {
    if (!scriptsOf(page).some(s => s.file === from)) continue;
    let html = read(page);
    const rel = f => relative(dirname(page), f);
    const anchor = TAG(rel(after || from));
    const i = html.indexOf(anchor);
    if (i < 0) throw new Error(`${page}: no module tag for ${after || from}`);
    const at = after ? html.indexOf('\n', i) + 1 : html.lastIndexOf('\n', i) + 1;
    html = html.slice(0, at) + TAG(rel(to)) + '\n' + html.slice(at);
    added.push(page);
    if (!dry) writeFileSync(join(ROOT, page), html);
  }
  if (!added.length) throw new Error(`${from} is not a module of a page`);
  return added;
}

export async function move(from, to, names, { after, header, withHeader, dry } = {}) {
  from = normalize(from);
  to = normalize(to);
  const src = stripped(read(from));
  const S = statements(src);
  const want = new Set(names);
  const picked = new Set();
  for (const s of S.statements) {
    if (!s.names.some(n => want.has(n))) continue;
    const missing = s.names.filter(n => !want.has(n));
    if (missing.length)
      throw new Error(`${from}: ${s.names.join(', ')} are one declaration; name them all (${missing.join(', ')})`);
    picked.add(s);
  }
  const found = new Set([...picked].flatMap(s => s.names));
  const unknown = names.filter(n => !found.has(n));
  if (unknown.length) throw new Error(`${from} declares no top-level ${unknown.join(', ')}`);
  // a statement right after a moved declaration that works on what it declares moves with it
  for (let i = 0; i < S.statements.length; i++) {
    if (!picked.has(S.statements[i])) continue;
    const own = new Set(S.statements[i].names);
    for (let j = i + 1; j < S.statements.length && !S.statements[j].names.length; j++) {
      if (![...namesIn(S.statements[j].node)].some(n => own.has(n))) break;
      picked.add(S.statements[j]);
    }
  }
  const moved = S.statements.filter(s => picked.has(s));
  const cut = s => src.slice(...s.span);
  const movedText = moved.map(cut).join('');
  let left = src.slice(0, S.header);
  for (const s of S.statements) if (!picked.has(s)) left += cut(s);
  left += S.tail;
  let head = '';
  if (withHeader) {
    // the header comments go to the new module; 'use strict' stays
    const strict = src.slice(0, S.header).match(/(['"])use strict\1;?/);
    head = src.slice(strict ? strict.index + strict[0].length : 0, S.header).replace(/^\s*\n/, '') + '\n';
    let rest = '';
    for (const s of S.statements) if (!picked.has(s)) rest += cut(s);
    left = (strict ? strict[0] + '\n' : '') + rest.replace(/^\s*\n/, '') + S.tail;
  }
  const exists = existsSync(join(ROOT, to));
  let target;
  if (exists) {
    if (header || withHeader) throw new Error(`${to} exists: --header and --with-header are for a new module`);
    target = stripped(read(to)).replace(/\s*$/, '\n') + movedText.replace(/^\s*\n/, '');
  }
  // a new module: a blank line after its header, where tools/to-module.mjs puts the generated part (above the comments
  // that came with the first moved declaration)
  else target = "'use strict';\n" + (header ? `/* ${header} */\n` : '') + head + '\n' + movedText.replace(/^\s*\n/, '');
  const pages = exists ? [] : pageTagsAdd(from, to, after && normalize(after), true);
  // what runs at load in the new place, and what stays and uses a moved name
  const fn = d => d.init && /^(Arrow)?FunctionExpression$/.test(d.init.type);
  const atLoad = moved
    .filter(
      s =>
        s.node.type !== 'FunctionDeclaration' &&
        !(s.node.type === 'VariableDeclaration' && s.node.declarations.every(fn))
    )
    .map(
      s =>
        s.names.join(', ') ||
        src
          .slice(...s.node.range)
          .split('\n')[0]
          .slice(0, 80)
    );
  const uses = S.statements
    .filter(s => !picked.has(s) && !s.names.length && [...namesIn(s.node)].some(n => found.has(n)))
    .map(s =>
      src
        .slice(...s.node.range)
        .split('\n')[0]
        .slice(0, 80)
    );
  if (!dry) {
    mkdirSync(dirname(join(ROOT, to)), { recursive: true });
    writeFileSync(join(ROOT, from), left);
    writeFileSync(join(ROOT, to), target);
    if (pages.length) pageTagsAdd(from, to, after && normalize(after), false);
    await toModule([]);
  }
  return { moved: moved.length, names: [...found], pages, atLoad, uses };
}

// ---------- verify ----------
const tokens = code =>
  espree
    .tokenize(code, { ecmaVersion: 'latest', sourceType: 'module' })
    .map(t => t.type[0] + t.value)
    .join(' ');
function shape(text, file) {
  if (!text) return { stmts: [], comments: [] };
  let body;
  try {
    body = stripped(text);
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
  const { ast, statements: st } = statements(body);
  return {
    stmts: st.map(s => tokens(body.slice(...s.node.range))),
    comments: ast.comments.map(c => c.value.replace(/\s+/g, ' ').trim()),
  };
}
const tagLines = html => html.split('\n').filter(l => !/^<script type="module" src="[^"]+"><\/script>$/.test(l));
export function verify(base = 'HEAD') {
  const rows = git('diff', '--cached', '--name-status', '--no-renames', base)
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('\t'));
  const problems = [],
    files = [],
    added = [];
  for (const [st, f] of rows) {
    if (GENERATED.has(f)) continue;
    const old = st === 'A' ? '' : git('show', `${base}:${f}`),
      now = st === 'D' ? '' : git('show', `:${f}`);
    if (PAGES.includes(f)) {
      if (tagLines(old).join('\n') !== tagLines(now).join('\n')) problems.push(`${f}: changed outside its module tags`);
      const was = new Set(old.split('\n'));
      if (old.split('\n').some(l => !now.split('\n').includes(l))) problems.push(`${f}: a line was removed`);
      added.push(
        ...now
          .split('\n')
          .filter(l => !was.has(l))
          .map(l => `${f}: ${l}`)
      );
    } else if (/^(game|studio)\/.*\.js$/.test(f)) files.push({ f, before: shape(old, f), after: shape(now, f) });
    else problems.push(`${f}: a move changes only scripts and the pages' module tags`);
  }
  // every statement after is one from before (each used once), and nothing is left over
  const pool = new Map(); // token string -> [{ f, i }]
  for (const { f, before } of files)
    before.stmts.forEach((t, i) => {
      if (!pool.has(t)) pool.set(t, []);
      pool.get(t).push({ f, i });
    });
  let movedCount = 0;
  for (const { f, after } of files) {
    const last = new Map(); // origin file -> last index taken
    after.stmts.forEach((t, k) => {
      const c = pool.get(t);
      if (!c || !c.length) {
        problems.push(`${f}: statement ${k + 1} is new or changed: ${t.slice(0, 100)}`);
        return;
      }
      // prefer the same file, then the first in order
      const j = Math.max(
        0,
        c.findIndex(o => o.f === f)
      );
      const o = c.splice(j, 1)[0];
      if (o.f !== f) movedCount++;
      if (last.has(o.f) && o.i < last.get(o.f)) problems.push(`${f}: statement ${k + 1} (from ${o.f}) is out of order`);
      last.set(o.f, o.i);
    });
  }
  for (const [t, c] of pool)
    for (const o of c) problems.push(`${o.f}: statement ${o.i + 1} was removed: ${t.slice(0, 100)}`);
  // comments: none lost; the new ones are listed
  const was = files.flatMap(x => x.before.comments),
    now = files.flatMap(x => x.after.comments);
  const left = [...now];
  for (const c of was) {
    const i = left.indexOf(c);
    if (i < 0) problems.push(`a comment was lost: ${c.slice(0, 100)}`);
    else left.splice(i, 1);
  }
  return { files: files.map(x => x.f), moved: movedCount, newComments: left, tags: added, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = k => {
    const i = args.indexOf(k);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const flag = k => {
    const i = args.indexOf(k);
    if (i >= 0) args.splice(i, 1);
    return i >= 0;
  };
  try {
    if (args[0] === 'verify') {
      const base = opt('--base') || 'HEAD';
      const r = verify(base);
      console.log(`${r.files.length} scripts checked, ${r.moved} statements moved between them`);
      for (const t of r.tags) console.log('  tag added: ' + t);
      for (const c of r.newComments) console.log('  new comment: ' + c.slice(0, 160));
      if (r.problems.length) {
        console.error('NOT a pure move:\n  ' + r.problems.join('\n  '));
        process.exit(1);
      }
      console.log('verify: a pure move');
    } else {
      const after = opt('--after'),
        header = opt('--header'),
        withHeader = flag('--with-header'),
        dry = flag('--dry');
      const [from, to, ...names] = args;
      if (!from || !to || !names.length) throw new Error('usage: move-names.mjs <from> <to> <name> [<name> ...]');
      const r = await move(from, to, names, { after, header, withHeader, dry });
      console.log(
        `${dry ? 'would move' : 'moved'} ${r.names.length} names (${r.moved} statements) from ${from} to ${to}`
      );
      if (r.pages.length) console.log(`  module tag added to ${r.pages.join(', ')}`);
      if (r.atLoad.length) console.log(`  runs at load in ${to}: ${r.atLoad.join('; ')}`);
      if (r.uses.length) console.log(`  stays in ${from} and uses a moved name: ${r.uses.join('; ')}`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
