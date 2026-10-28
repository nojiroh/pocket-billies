// Phase 13: the checks Claude Code runs after each edit (.claude/settings.json, a PostToolUse hook on Edit and Write),
// the fast tiers of docs/phases/13: lint and the type check, the unit tests, the data check. It reads the edited file
// from the hook's JSON on stdin and runs only what that file can break:
//   game/js, studio and the root's *.js     npm run lint, and npm run typecheck for game/js
//   game/js/logic/<name>.js                  the unit test files for <name> (testsFor below)
//   tools/test/<file>.test.mjs               that test file
//   game/js/audio, game/js/sound.js         the tracker's and sound's tests (SND-8a: npm test never ran for them)
//   game/data                                npm run check:data
//   tools/*.py                               python3 -m py_compile
// Anything else (docs, art, this file) runs nothing. A failure exits with 2 and the checks' last lines on stderr, which
// Claude Code shows to Claude; without node_modules (a fresh checkout) or for a file outside the repo it does nothing.
// Tooling 2026-10-27: the whole quick tier (npm test) takes about 104 s now, more than a hook can wait after every
// edit, so it runs once before Claude finishes a reply instead (tools/before-stop.mjs). A check that runs out of time
// is reported as not finished, never as failed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { SLOW_TESTS } from './unit-tests.mjs';

const ROOT = join(import.meta.dirname, '..');
// at most this many test files after one edit (single files take 0.3-3 s); the rest wait for tools/before-stop.mjs
const MAX_TEST_FILES = 12;
const TEST_SECONDS = 60;
/* GNU timeout (Linux, the cloud) also stops the test processes node --test started; without it (macOS), only the
   time limit of execFileSync below */
const limited = (sec, cmd, args) =>
  spawnSync('timeout', ['--version']).status === 0 ? ['timeout', ['-k', '5', String(sec), cmd, ...args]] : [cmd, args];

let file = '';
try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  file = (input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path)) || '';
} catch (e) {
  process.exit(0);
}
const rel = file ? relative(ROOT, file).split(sep).join('/') : '';
if (!rel || rel.startsWith('..') || !existsSync(join(ROOT, 'node_modules'))) process.exit(0);

/** The unit test files for an edited file, most direct first: for game/js/logic/<name>.js the files named after it
 * (`<name>.test.mjs`, `<name>-real.test.mjs`), then those that use `modules['<name>']` or `modules.<name>`, then
 * those named `<name>-*`; the slow tier left out (CI and npm run test:slow run it). An edited test file is itself. */
function testsFor(rel) {
  /* SND-8a: the music and world sounds aren't logic/, so their own tests run on their edits */
  if (/^game\/js\/(audio\/.*|sound)\.js$/.test(rel))
    return { files: ['tools/test/tracker.test.mjs', 'tools/test/sound.test.mjs'], more: 0 };
  if (/^tools\/test\/.*\.test\.mjs$/.test(rel)) return { files: [rel], more: 0 };
  const m = /^game\/js\/logic\/(.+)\.js$/.exec(rel);
  if (!m) return { files: [], more: 0 };
  const name = m[1];
  const base = basename(name);
  const all = (dir = '') =>
    readdirSync(join(ROOT, 'tools/test', dir), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? all(join(dir, e.name)) : e.name.endsWith('.test.mjs') ? [join(dir, e.name)] : []
    );
  const quick = all().filter(f => !SLOW_TESTS.includes(f));
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uses = new RegExp(
    `modules\\[['"]${esc}['"]\\]` + (/^[A-Za-z_$][\w$]*$/.test(name) ? `|modules\\.${esc}\\b` : '')
  );
  const named = quick.filter(f => [`${base}.test.mjs`, `${base}-real.test.mjs`].includes(basename(f)));
  const using = quick.filter(f => !named.includes(f) && uses.test(readFileSync(join(ROOT, 'tools/test', f), 'utf8')));
  const prefixed = quick.filter(f => !named.includes(f) && !using.includes(f) && basename(f).startsWith(`${base}-`));
  const found = [...named, ...using, ...prefixed].map(f => `tools/test/${f}`);
  return { files: found.slice(0, MAX_TEST_FILES), more: Math.max(0, found.length - MAX_TEST_FILES) };
}

const runs = [];
if (/^(game\/js|studio)\/.*\.js$/.test(rel) || /^[^/]+\.js$/.test(rel)) runs.push(['npm', ['run', '-s', 'lint']]);
if (/^game\/js\/.*\.js$/.test(rel)) runs.push(['npm', ['run', '-s', 'typecheck']]);
const tests = testsFor(rel);
if (tests.files.length)
  runs.push([...limited(TEST_SECONDS, process.execPath, ['--test', ...tests.files]), 'unit tests']);
if (/^game\/data\/.*\.json$/.test(rel)) runs.push(['npm', ['run', '-s', 'check:data']]);
if (/^tools\/.*\.py$/.test(rel)) runs.push(['python3', ['-m', 'py_compile', rel]]);

const notes = [];
for (const [cmd, args, label] of runs)
  try {
    execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: (TEST_SECONDS + 15) * 1000 });
  } catch (e) {
    const n = tests.files.length;
    const what = label ? `${label} (${n} file${n === 1 ? '' : 's'})` : `${cmd} ${args.join(' ')}`;
    /* 124: GNU timeout's exit status when the time ran out */
    if (e.code === 'ETIMEDOUT' || (label && e.status === 124)) {
      notes.push(`${what} did not finish in time: not a failure; run it yourself before committing`);
      continue;
    }
    const out = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
    process.stderr.write(`after editing ${rel}: ${what} failed\n${out}\n`);
    process.exit(2);
  }
if (tests.more) notes.push(`${tests.more} more test files use it: npm test runs them before the reply ends`);
if (notes.length)
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `after editing ${rel}: ${notes.join('; ')}`,
      },
    })
  );
