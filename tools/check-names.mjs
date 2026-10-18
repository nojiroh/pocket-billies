// Phase 05: the naming rules of docs/NAMING.md that ESLint's own rules can't check (npm run lint runs this after
// ESLint; ESLint itself checks camelcase):
// - no top-level name of one or two characters in the game's and the Studio's scripts ($ and $$ are allowed),
// - no top-level name phase 05 retired (tools/retired-names.json, made from the rename table), and none with a
//   retired prefix,
// - kebab-case file names in game/js, game/css and studio.
//   node tools/check-names.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { units } from './rename.mjs';

const ROOT = join(import.meta.dirname, '..');
const retired = JSON.parse(readFileSync(join(ROOT, 'tools/retired-names.json'), 'utf8'));
const RETIRED = new Set(retired.names);
// a retired prefix in camelCase (dioMount) or UPPER_SNAKE (DIO_PAD, DIO)
const PREFIX = new RegExp(
  `^_*(?:(?:${retired.prefixes.join('|')})[A-Z0-9_$]|(?:${retired.prefixes.map(p => p.toUpperCase()).join('|')})(?:_|$))`
);
const ALLOWED_SHORT = new Set(['$', '$$']);
const problems = [];

for (const u of units())
  for (const name of u.declared.keys()) {
    const at = `${u.file}: ${name}`;
    if (name.length <= 2 && !ALLOWED_SHORT.has(name)) problems.push(`${at} is one or two characters`);
    else if (RETIRED.has(name)) problems.push(`${at} is a name phase 05 retired (docs/archive/phase-05-renames.md)`);
    else if (PREFIX.test(name)) problems.push(`${at} has a retired prefix`);
  }

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
