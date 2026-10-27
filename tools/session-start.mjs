// Tooling 2026-10-27: what a cloud session needs before Claude starts work (.claude/settings.json, a SessionStart
// hook on startup and resume; docs/TESTING.md, "Claude Code in the cloud"). Cloud sessions only
// (CLAUDE_CODE_REMOTE=true): a local checkout is left alone.
//   - npm ci, when node_modules is missing or package-lock.json changed since the last install
//   - npm run data: game/data/gamedata.js (generated, gitignored), which the game and the checks load
//   - Python Playwright at the version of the browser in the cloud image (the global Node playwright's): installed
//     when it isn't; the environment's setup script (docs/TESTING.md) makes that instant
//   - on a new session, the starting state of the files the unit tests guard, for tools/before-stop.mjs
// It prints one line, which Claude Code adds to Claude's context. A step that fails is reported in that line and never
// stops the session (always exit 0). tools/before-stop.mjs imports the helpers below.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');
// the files whose change can break a unit test: the logic, the data tables and data, the tests themselves
const GUARDED = ['game/js/logic', 'game/js/game-data.js', 'game/data', 'tools/test'];

const run = (cmd, args, sec) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: sec * 1000 }).trim();
const sha = (...parts) => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

/** A hash of every tracked or new file the unit tests guard (gitignored ones, like gamedata.js, left out). */
export function guardedHash() {
  const files = run('git', ['ls-files', '-co', '--exclude-standard', '--', ...GUARDED], 30)
    .split('\n')
    .filter(Boolean)
    .sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(`${f}\0`);
    try {
      h.update(readFileSync(join(ROOT, f)));
    } catch (e) {
      h.update('(gone)');
    }
  }
  return h.digest('hex');
}

/** The hooks' state, kept in .git so npm ci can't wipe it: {start, green} hashes of the guarded files. */
function stateFile() {
  return join(run('git', ['rev-parse', '--absolute-git-dir'], 10), 'pb-hooks', 'unit-tests.json');
}
export function readState() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8'));
  } catch (e) {
    return null;
  }
}
export function writeState(state) {
  const f = stateFile();
  mkdirSync(join(f, '..'), { recursive: true });
  writeFileSync(f, JSON.stringify(state));
}

function main() {
  if (process.env.CLAUDE_CODE_REMOTE !== 'true') return;
  let source = 'startup';
  try {
    source = JSON.parse(readFileSync(0, 'utf8') || '{}').source || source;
  } catch (e) {
    /* no input: a start */
  }
  const said = [];
  const step = (fn, failed) => {
    try {
      said.push(fn());
    } catch (e) {
      const why = `${e.stderr || e.message || e}`.trim().split('\n').slice(-2).join(' ');
      said.push(`${failed} FAILED (${why.slice(0, 200)})`);
    }
  };
  const timed = fn => {
    const t = Date.now();
    fn();
    return `${Math.round((Date.now() - t) / 1000)} s`;
  };

  step(() => {
    const lock = sha(readFileSync(join(ROOT, 'package-lock.json')));
    const mark = join(ROOT, 'node_modules', '.pb-lock.sha256');
    if (existsSync(mark) && readFileSync(mark, 'utf8') === lock) return 'npm packages ready';
    const took = timed(() => run('npm', ['ci', '--no-audit', '--no-fund'], 300));
    writeFileSync(mark, lock);
    return `npm packages installed (npm ci, ${took})`;
  }, 'npm ci');

  step(() => {
    run('npm', ['run', '-s', 'data'], 120);
    return 'game data built';
  }, 'npm run data');

  step(() => {
    let want = '';
    try {
      want = JSON.parse(
        readFileSync(join(run('npm', ['root', '-g'], 30), 'playwright', 'package.json'), 'utf8')
      ).version;
    } catch (e) {
      return 'no browser in this image (no global Node playwright): the screenshot checks may not run';
    }
    const have = () => {
      try {
        return run('python3', ['-c', "from importlib.metadata import version; print(version('playwright'))"], 30);
      } catch (e) {
        return '';
      }
    };
    if (have() === want) return `Python Playwright ${want} matches the browser`;
    const pip = ['-m', 'pip', 'install', '-q', '--root-user-action=ignore', `playwright==${want}`];
    const took = timed(() => run('python3', pip, 300));
    return `Python Playwright ${want} installed (${took}; the environment's setup script in docs/TESTING.md makes this instant)`;
  }, 'Python Playwright');

  step(() => {
    const now = guardedHash();
    const state = readState();
    if (source === 'startup' || !state) {
      writeState({ start: now, green: now });
      return 'unit tests run before a reply ends once logic, data or tests change';
    }
    /* the same test as tools/before-stop.mjs: back at the start, or where the tests last passed */
    return now === state.start || now === state.green
      ? 'unit tests up to date'
      : 'logic, data or tests changed since the last unit test run';
  }, 'recording the unit tests start');

  process.stdout.write(`Session setup (tools/session-start.mjs): ${said.join('; ')}.\n`);
}

/* run only as a script: tools/before-stop.mjs imports the helpers */
if (process.argv[1] && import.meta.filename === process.argv[1]) main();
