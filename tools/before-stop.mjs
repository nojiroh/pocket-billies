// Tooling 2026-10-27: the whole quick unit tier before Claude finishes a reply (.claude/settings.json, a Stop hook).
// The after-edit hook runs only the edited area's tests (tools/after-edit.mjs), since the tier takes about 104 s now.
// npm test runs when the files the unit tests guard (tools/session-start.mjs) changed since the session started and
// since the last run that passed: nothing runs on a reply that changed none of them, nor while Claude only pauses for
// background work. A failure exits with 2 and the failing tests on stderr, so Claude goes on to fix them. When the
// tests still fail on the stop after that (stop_hook_active), it lets Claude stop and shows you the failure instead,
// so it never loops; a state that already failed isn't run again until a file changes.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, guardedHash, readState, writeState } from './session-start.mjs';

const TEST_SECONDS = 280;

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch (e) {
  process.exit(0);
}
if (!existsSync(join(ROOT, 'node_modules'))) process.exit(0);
/* Claude is waiting for background work to wake it: the reply isn't finished */
if (Array.isArray(input.background_tasks) && input.background_tasks.length) process.exit(0);

const now = guardedHash();
const state = readState();
/* no record (a local session, or one that began before this hook): take this state as the start */
if (!state) {
  writeState({ start: now, green: now });
  process.exit(0);
}
/* back where the session started, or where the tests last passed */
if (now === state.start || now === state.green) process.exit(0);

/** Stop without blocking, with a note for you (Claude Code shows `systemMessage` to the user). */
const letStop = note => {
  process.stdout.write(JSON.stringify({ systemMessage: note }));
  process.exit(0);
};
const block = summary => {
  process.stderr.write(
    `Before finishing: npm test fails after this session's changes to logic, data or tests. Fix it, or say why ` +
      `it can't be fixed here.\n${summary}\n`
  );
  process.exit(2);
};

if (now === state.failed) {
  if (input.stop_hook_active) letStop(`Unit tests still fail (nothing changed since the last run):\n${state.summary}`);
  block(state.summary);
}

let out = '';
let failed = false;
try {
  execFileSync('timeout', ['-k', '5', String(TEST_SECONDS), 'npm', 'test', '-s'], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: (TEST_SECONDS + 15) * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  /* 124: GNU timeout's exit status when the time ran out */
  if (e.code === 'ETIMEDOUT' || e.status === 124)
    letStop(
      `npm test did not finish in ${TEST_SECONDS} s before the reply ended: not a failure; run it before committing`
    );
  out = `${e.stdout || ''}${e.stderr || ''}`;
  failed = true;
}
if (!failed) {
  writeState({ start: state.start, green: now });
  process.exit(0);
}
const lines = out.split('\n');
const failing = lines.filter(l => /^\s*not ok \d+ - /.test(l)).map(l => l.trim());
const count = lines.map(l => /^# fail (\d+)/.exec(l)).find(Boolean);
const summary = [
  `${count ? count[1] : '?'} failing:`,
  ...failing.slice(0, 12),
  ...(failing.length > 12 ? [`(and ${failing.length - 12} more)`] : []),
  ...(failing.length ? [] : lines.slice(-30)),
].join('\n');
writeState({ start: state.start, green: state.green, failed: now, summary });
if (input.stop_hook_active) letStop(`Unit tests still fail after Claude's fix attempt:\n${summary}`);
block(summary);
