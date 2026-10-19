// Phase 20: the diagnostics' and the Graphics test's pass timers (game/js/self-test.js DIAGNOSTICS_PASSES) wrap a
// render pass through the debug log's GAME object, which holds only what game/js/debug-log-names.js (made by npm run
// modules from debug-log.js's lists) puts there. A name missing there is skipped without a word, so its time vanished
// from both reports (drawPropModels, drawBoxFaces and drawStructures did until phase 20). Text only; nothing runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

test('every pass the diagnostics time is in the debug log, with a setter so the timer is the one called', () => {
  const st = read('game/js/self-test.js'),
    block = st.match(/const DIAGNOSTICS_PASSES = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'DIAGNOSTICS_PASSES not found in self-test.js');
  const names = [...block[1].matchAll(/'(\w+)'(?!:)/g)].map(m => m[1]);
  assert.ok(names.length >= 10, 'too few pass names read: ' + names.join(', '));
  const log = read('game/js/debug-log-names.js'),
    missing = names.filter(n => !new RegExp(`^  ${n}: \\{ get: \\(\\) => ${n}, set: \\w+ \\},$`, 'm').test(log));
  assert.deepEqual(missing, []);
});
