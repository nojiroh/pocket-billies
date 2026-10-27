// UI-9a: proves a CSS move kept every fight's winner. Reads the game's stylesheets in the page's order (game/index.html)
// as a git revision had them (default HEAD) and as the working tree has them, and lists each pair of declarations that
// can land on one element, set the same property at the same specificity and importance, and swapped order: the one
// that won before loses now. tools/style-diff.py proves the screens it opens; this covers every rule, opened or not.
//   node tools/css-order.mjs                 # working tree against HEAD
//   node tools/css-order.mjs --ref=HEAD~2    # against another revision
//   node tools/css-order.mjs --json          # the same as JSON
// Static and wary on purpose: two selectors can meet when their last compounds share a class, an id or an attribute,
// or when their classes are written together in one class="..." of the game's code. Declarations are matched across the
// two trees by selector, at-rule context, property and how many times that triple came before; a declaration whose
// value or importance changed, or that is gone or new, is listed apart. Exit 1 when a winner changed.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const ROOT = join(import.meta.dirname, '..');
const ARGS = process.argv.slice(2);
const REF = (ARGS.find(a => a.startsWith('--ref=')) || '--ref=HEAD').slice(6);

const sheetsOf = read =>
  [...read('game/index.html').matchAll(/<link rel="stylesheet" href="(css\/[^"]+\.css)">/g)].map(m => 'game/' + m[1]);
const readTree = p => readFileSync(join(ROOT, p), 'utf8');
const readRef = p => {
  try {
    return execFileSync('git', ['show', `${REF}:${p}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch {
    return '';
  }
};

/* a selector's specificity as one number (ids, classes, types), :where() 0, :is()/:not()/:has() their widest */
function specificity(sel) {
  let s = sel;
  let extra = 0;
  s = s.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
  s = s.replace(/:(is|not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (_, k, inner) => {
    extra += Math.max(...inner.split(',').map(specificity));
    return '';
  });
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const pe = (s.match(/::[\w-]+/g) || []).length;
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, '');
  const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) || []).length;
  s = s.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?|#[\w-]+/g, ' ');
  const types = (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 1e6 + cls * 1e3 + types + pe + extra;
}

/* the last compound: what the rule lands on (classes, ids, attributes, tag, pseudo-element) */
function target(sel) {
  const last = sel
    .replace(/\((?:[^()]|\([^()]*\))*\)/g, m => m.replace(/[\s>+~]/g, '_'))
    .split(/\s*[\s>+~]\s*/)
    .filter(Boolean)
    .pop();
  const pe = (last.match(/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+)\b/) || [])[1] || '';
  const bare = last.replace(/:(not|is|where|has)\([^)]*\)/g, '');
  return {
    keys: [...bare.matchAll(/([.#][\w-]+|\[[\w-]+)/g)].map(m => m[1]),
    tag: (bare.match(/^[a-zA-Z][\w-]*/) || [''])[0].toLowerCase(),
    pe,
  };
}

/* classes the code writes together in one class="..." (or className = '...'): they can meet on one element */
const walk = dir =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'vendor' ? [] : walk(p)) : /\.(js|html)$/.test(f) ? [p] : [];
  });
const together = new Map();
for (const f of [...walk(join(ROOT, 'game/js')), join(ROOT, 'game/index.html')]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/class(?:Name)?\s*=\s*\\?["'`]([^"'`]+)/g)) {
    const names = m[1].split(/\s+/).filter(c => /^[a-zA-Z][\w-]*$/.test(c));
    for (const a of names)
      for (const b of names) if (a !== b) (together.get(a) || together.set(a, new Set()).get(a)).add(b);
  }
}

function meet(a, b) {
  if (a.pe !== b.pe) return false;
  if (!a.keys.length || !b.keys.length) return !a.tag || !b.tag || a.tag === b.tag;
  if (a.tag && b.tag && a.tag !== b.tag) return false;
  for (const k of a.keys) if (b.keys.includes(k)) return true;
  for (const k of a.keys)
    if (k[0] === '.')
      for (const j of b.keys) if (j[0] === '.' && together.get(k.slice(1))?.has(j.slice(1))) return true;
  return false;
}

/* properties that set the same thing: one equal to, or a shorthand of, the other */
const SPECIAL = {
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
  ],
};
const under = (s, l) =>
  (SPECIAL[s] || []).includes(l) || (l.startsWith(s + '-') && !(s === 'border' && /radius$/.test(l)));
const covers = (s, l) => s === l || under(s, l);
const overlap = (p, q) => covers(p, q) || covers(q, p);

function decls(read) {
  const out = [];
  const seen = new Map();
  let order = 0;
  for (const file of sheetsOf(read)) {
    const css = read(file);
    if (!css) continue;
    postcss.parse(css).walkDecls(d => {
      const rule = d.parent;
      if (rule.type !== 'rule') return;
      let ctx = '';
      for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
        if (p.type === 'atrule') {
          if (/keyframes$/.test(p.name)) return;
          ctx = `@${p.name} ${p.params};${ctx}`;
        }
      }
      const prop = d.prop.toLowerCase();
      if (prop.startsWith('--')) return;
      for (const sel of rule.selectors) {
        const s = sel.replace(/\s+/g, ' ').trim();
        const key = `${ctx}|${s}|${prop}|${d.value.trim()}|${!!d.important}`;
        const n = (seen.get(key) || 0) + 1;
        seen.set(key, n);
        out.push({
          key: `${key}#${n}`,
          loose: `${ctx}|${s}|${prop}`,
          file,
          line: d.source.start.line,
          sel: s,
          ctx,
          prop,
          value: d.value.trim(),
          imp: !!d.important,
          order: order++,
          spec: specificity(s),
          t: target(s),
        });
      }
    });
  }
  return out;
}

const before = decls(readRef);
const after = decls(readTree);
/* the same declaration in both trees by selector, context, property and value; what is left pairs by selector,
   context and property (a value or importance changed); the rest is gone or new */
const exact = new Map(after.map(d => [d.key, d]));
const now = new Map();
const changed = [];
const left = new Map();
for (const d of after) left.set(d.key, d);
for (const d of before) {
  const n = exact.get(d.key);
  if (n) {
    now.set(d.key, n);
    left.delete(n.key);
  }
}
const loose = new Map();
for (const d of left.values()) (loose.get(d.loose) || loose.set(d.loose, []).get(d.loose)).push(d);
for (const d of before) {
  if (now.has(d.key)) continue;
  const n = loose.get(d.loose)?.shift();
  if (n) {
    now.set(d.key, n);
    changed.push({ kind: 'changed', d, n });
  } else changed.push({ kind: 'gone', d });
}
for (const list of loose.values()) for (const d of list) changed.push({ kind: 'new', d });

/* every pair that fights in the old tree, by property */
const byProp = new Map();
for (const d of before) {
  const root =
    { top: 'inset', right: 'inset', bottom: 'inset', left: 'inset', 'row-gap': 'gap', 'column-gap': 'gap' }[d.prop] ||
    d.prop.split('-')[0];
  (byProp.get(root) || byProp.set(root, []).get(root)).push(d);
}
/* the cascade: !important first, then specificity, then the later one */
const beats = (a, b) => (a.imp !== b.imp ? a.imp : a.spec !== b.spec ? a.spec > b.spec : a.order > b.order);
const flips = [];
for (const list of byProp.values()) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.file + a.line === b.file + b.line || a.value === b.value) continue;
      if (!overlap(a.prop, b.prop) || !meet(a.t, b.t)) continue;
      const na = now.get(a.key);
      const nb = now.get(b.key);
      if (!na || !nb) continue;
      if (beats(a, b) !== beats(na, nb))
        flips.push(beats(a, b) ? { was: a, lost: na, wins: nb } : { was: b, lost: nb, wins: na });
    }
  }
}

/* a declaration that is gone changes nothing only when one that stays, on the same selector, already beat it */
const unsafe = changed.filter(
  c =>
    c.kind === 'gone' &&
    !before.some(
      e =>
        e !== c.d &&
        e.ctx === c.d.ctx &&
        e.sel === c.d.sel &&
        covers(e.prop, c.d.prop) &&
        now.has(e.key) &&
        beats(e, c.d)
    )
);
const at = d => `${d.file}:${d.line}`;
if (ARGS.includes('--json')) console.log(JSON.stringify({ flips, changed }, null, 1));
else {
  for (const f of flips)
    console.log(
      `FLIP ${f.was.prop}: ${f.was.sel} {${f.was.value}} (${at(f.lost)}) won; now ${f.wins.sel} {${f.wins.value}} (${at(f.wins)}) wins`
    );
  const n = k => changed.filter(c => c.kind === k).length;
  for (const c of changed.filter(c => c.kind === 'changed'))
    console.log(
      `changed ${c.d.sel} ${c.d.prop}: ${c.d.value}${c.d.imp ? ' !important' : ''} -> ${c.n.value}${c.n.imp ? ' !important' : ''} (${at(c.n)})`
    );
  for (const c of unsafe)
    console.log(`GONE ${c.d.sel} ${c.d.prop}: ${c.d.value} (${at(c.d)}) nothing on its selector beat it`);
  console.log(
    `css-order against ${REF}: ${flips.length} fights change winner; ${n('changed')} declarations changed, ${n('gone')} gone (${unsafe.length} that were in force), ${n('new')} new`
  );
}
process.exit(flips.length || unsafe.length ? 1 : 0);
