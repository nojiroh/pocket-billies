// Phase 05: the naming rules of docs/NAMING.md that ESLint's own rules can't check (npm run lint runs this after
// ESLint; ESLint itself checks camelcase):
// - no top-level name of one or two characters in the game's and the Studio's scripts ($ and $$ are allowed),
// - kebab-case file names in game/js, game/css and studio.
//   node tools/check-names.mjs
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, normalize } from 'node:path';
import { HOOKS, LOG_NAMES, PAGES, SCRIPT_TAG, stripped } from './to-module.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const GENERATED = new Set(['game/data/gamedata.js', HOOKS, LOG_NAMES]);

// every script of both pages, test-globals.js and the service worker, each once, with the names it declares at its
// top level: { file, names }. A module is read without its generated part (tools/to-module.mjs writes that).
function units() {
  const out = new Map();
  for (const page of PAGES) {
    const html = read(page);
    let n = 0;
    for (const [, attrs, text] of html.matchAll(SCRIPT_TAG)) {
      const src = attrs.match(/\bsrc="([^"?]+\.js)(?:\?[^"]*)?"/);
      if (!src) {
        out.set(`${page}#inline${n++}`, { text, sourceType: 'script' });
        continue;
      }
      const file = normalize(join(dirname(page), src[1]));
      if (src[1].includes('://') || out.has(file) || GENERATED.has(file)) continue;
      const module = /\btype="module"/.test(attrs);
      out.set(file, { text: module ? stripped(read(file)) : read(file), sourceType: 'script' });
    }
  }
  out.set('game/js/test-globals.js', { text: read('game/js/test-globals.js'), sourceType: 'module' });
  out.set('game/sw.js', { text: read('game/sw.js'), sourceType: 'script' });
  return [...out].map(([file, { text, sourceType }]) => {
    let ast;
    try {
      ast = espree.parse(text, { ecmaVersion: 'latest', range: true, sourceType });
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
    const g = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType }).globalScope;
    const top = sourceType === 'module' ? g.childScopes[0] : g;
    return { file, names: top.variables.filter(v => v.defs.length).map(v => v.name) };
  });
}

const ALLOWED_SHORT = new Set(['$', '$$']);
const problems = [];

for (const u of units())
  for (const name of u.names)
    if (name.length <= 2 && !ALLOWED_SHORT.has(name)) problems.push(`${u.file}: ${name} is one or two characters`);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)+$/;
const files = execFileSync('git', ['ls-files', 'game/js', 'game/css', 'studio', 'game/*.js', 'game/*.html'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(f => /\.(js|css|html)$/.test(f));
for (const f of files) if (!KEBAB.test(basename(f))) problems.push(`${f}: the file name is not kebab-case`);

if (problems.length) {
  console.error(`naming (docs/NAMING.md):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`naming: ${files.length} files and the pages' top-level names follow docs/NAMING.md`);
