// Phase 06-4: lists the game's CSS rules whose class names nothing uses (no script, page or data file mentions them).
//   node tools/unused-css.mjs            # the report: file, line, selector
//   node tools/unused-css.mjs --json     # the same as JSON
//   node tools/unused-css.mjs --check    # npm run lint: fails when a rule names a class nothing uses (KEEP aside)
// A class counts as used when its name appears anywhere in game/js, studio/js, the HTML pages or game/data as a word,
// or starts with a prefix a template builds names from (class="st-${...}" makes every "st-..." used). A report is a list
// of candidates to check by hand, not a delete list: a name can also come from data or be built in ways this can't see.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const walk = (dir, ext) =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'vendor' ? [] : walk(p, ext);
    return ext.some(e => f.endsWith(e)) ? [p] : [];
  });
const sources = [
  ...walk(join(ROOT, 'game/js'), ['.js']),
  ...walk(join(ROOT, 'studio'), ['.js', '.html']),
  join(ROOT, 'game/index.html'),
  ...walk(join(ROOT, 'game/data'), ['.json']).filter(f => !f.endsWith('gamedata.js')),
];
const text = sources.map(f => readFileSync(f, 'utf8')).join('\n');
const words = new Set(text.match(/[A-Za-z_][\w-]*/g));
/* prefixes of built names: class="foo-${", 'foo-' + x, `foo-${x}` */
const prefixes = new Set();
for (const m of text.matchAll(/["'`\s]([a-z][\w-]*-)(?:\$\{|['"`]\s*\+)/g)) prefixes.add(m[1]);
// kept on purpose with no user yet: two of motion.css's eight named motions (phase 06 "Motion"), there to be used
const KEEP = new Set(['m-sheet', 'm-done']);
const used = c => KEEP.has(c) || words.has(c) || [...prefixes].some(p => c.startsWith(p));

const out = [];
for (const f of walk(join(ROOT, 'game/css'), ['.css'])) {
  const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const re = /([^{}@]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (!sel || /^(from|to|\d+%)/.test(sel)) continue;
    const parts = sel.split(',').map(s => s.trim());
    /* a rule is a candidate when every one of its selectors names at least one unused class */
    const dead = parts.every(p => (p.match(/\.([A-Za-z_][\w-]*)/g) || []).some(c => !used(c.slice(1))));
    if (dead) {
      const line = css.slice(0, m.index).split('\n').length;
      const unusedNames = [...new Set(parts.flatMap(p => (p.match(/\.([A-Za-z_][\w-]*)/g) || []).map(c => c.slice(1))))].filter(
        c => !used(c)
      );
      out.push({ file: relative(ROOT, f), line, sel, unused: unusedNames });
    }
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  for (const o of out) console.log(`${o.file}:${o.line}  ${o.sel.replace(/\s+/g, ' ').slice(0, 90)}   [${o.unused.join(' ')}]`);
  console.log(
    out.length
      ? `${out.length} rules name a class nothing uses${process.argv.includes('--check') ? ': delete them, or add the class to KEEP in tools/unused-css.mjs with why' : ''}`
      : 'unused CSS: every class a rule names is used'
  );
  if (out.length && process.argv.includes('--check')) process.exit(1);
}
