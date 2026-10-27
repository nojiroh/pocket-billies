// Phase 13: the checks Claude Code runs after each edit (.claude/settings.json, a PostToolUse hook on Edit and Write),
// the fast tiers of docs/phases/13: lint and the type check, the unit tests, the data check. It reads the edited file
// from the hook's JSON on stdin and runs only what that file can break:
//   game/js, studio and the root's *.js     npm run lint, and npm run typecheck for game/js
//   game/js/logic, game-data.js, tools/test npm test
//   game/js/audio, game/js/sound.js         the tracker's and sound's tests (SND-8a: npm test never ran for them)
//   game/data                                npm run check:data
//   tools/*.py                               python3 -m py_compile
// Anything else (docs, art, this file) runs nothing. A failure exits with 2 and the checks' last lines on stderr, which
// Claude Code shows to Claude; without node_modules (a fresh checkout) or for a file outside the repo it does nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SLOW_TESTS } from './unit-tests.mjs';

const ROOT = join(import.meta.dirname, '..');
let file = '';
try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  file = (input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path)) || '';
} catch (e) {
  process.exit(0);
}
const rel = file ? relative(ROOT, file).split(sep).join('/') : '';
if (!rel || rel.startsWith('..') || !existsSync(join(ROOT, 'node_modules'))) process.exit(0);

const runs = [];
if (/^(game\/js|studio)\/.*\.js$/.test(rel) || /^[^/]+\.js$/.test(rel)) runs.push(['npm', ['run', '-s', 'lint']]);
if (/^game\/js\/.*\.js$/.test(rel)) runs.push(['npm', ['run', '-s', 'typecheck']]);
if (/^game\/js\/(logic\/.*|game-data)\.js$/.test(rel) || /^tools\/test\//.test(rel)) runs.push(['npm', ['test', '-s']]);
/* SND-8a: the music and world sounds aren't logic/, so npm test never ran on their edits: their own tests do */
if (/^game\/js\/(audio\/.*|sound)\.js$/.test(rel))
  runs.push(['node', ['--test', 'tools/test/tracker.test.mjs', 'tools/test/sound.test.mjs']]);
/* Studio plan T6.4: npm test is the quick tier; an edited slow test (tools/unit-tests.mjs) runs on its own */
if (/^tools\/test\/.*\.test\.mjs$/.test(rel) && SLOW_TESTS.includes(rel.slice('tools/test/'.length)))
  runs.push(['node', ['--test', rel]]);
if (/^game\/data\/.*\.json$/.test(rel)) runs.push(['npm', ['run', '-s', 'check:data']]);
if (/^tools\/.*\.py$/.test(rel)) runs.push(['python3', ['-m', 'py_compile', rel]]);

for (const [cmd, args] of runs)
  try {
    execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 50000 });
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
    process.stderr.write(`after editing ${rel}: ${cmd} ${args.join(' ')} failed\n${out}\n`);
    process.exit(2);
  }
