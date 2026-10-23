// Studio plan T2.4: the Studio's logic worker (studio/js/logic-worker.js). What it loads is what the unit tests load
// (tools/test/load-logic.mjs: game-data.js, then every logic module by name), and its answers are the logic's own: an
// ask for runPreview returns what a direct call returns; an unknown function or a throw comes back as an error, never
// as a value. Its message handling runs in the Studio test (tools/check-studio-github.py, run_lab).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { hooks, modules, ROOT } from './setup-real.mjs';

const worker = await import('../../studio/js/logic-worker.js');
const page = await import('../../studio/js/logic-worker-page.js');

test('the worker loads game-data.js and every logic module, in load-logic.mjs’s order', () => {
  const text = readFileSync(join(ROOT, 'studio/js/logic-worker-modules.js'), 'utf8'),
    got = [...text.matchAll(/^import '\.\.\/\.\.\/(game\/js\/[^']+)';$/gm)].map(m => m[1]),
    want = [
      'game/js/game-data.js',
      ...readdirSync(join(ROOT, 'game/js/logic'))
        .filter(f => f.endsWith('.js'))
        .map(f => `game/js/logic/${f}`),
    ];
  const missing = want.filter(f => !got.includes(f));
  assert.deepEqual(missing, [], `add ${missing.join(', ')} to studio/js/logic-worker-modules.js`);
  assert.deepEqual(got, want);
});

test('the worker stands in for the page as load-logic.mjs does', () => {
  const src = readFileSync(join(ROOT, 'tools/test/load-logic.mjs'), 'utf8'),
    block = /const page = \{([\s\S]*?)\n {2}\};/.exec(src)[1],
    names = [...block.matchAll(/^ {4}(\w+):/gm)].map(m => m[1]).sort();
  assert.deepEqual(Object.keys(page.logicWorkerPage(hooks.provide)).sort(), names);
});

test('an ask for runPreview answers what a direct call returns', () => {
  const m = { runPreview: modules['run-preview'].runPreview };
  for (const [seed, o] of [
    ['LAB1', { unlocks: [] }],
    ['TESTSEED', { unlocks: [], map: { rows: 5, minibosses: 1 } }],
  ]) {
    const a = worker.logicWorkerAnswer({ id: 7, fn: 'runPreview', args: [seed, o] }, m);
    assert.equal(a.kind, 'answer');
    assert.equal(a.id, 7);
    assert.equal(a.ok, true, a.error);
    assert.deepEqual(a.value, m.runPreview(seed, o));
    assert.deepEqual(structuredClone(a), a, 'it crosses back to the page as it is');
  }
});

test('an unknown function or a throw is an error answer', () => {
  const none = worker.logicWorkerAnswer({ id: 1, fn: 'toString', args: [] }, {});
  assert.equal(none.ok, false);
  assert.match(none.error, /no toString/);
  const bad = worker.logicWorkerAnswer(
    { id: 2, fn: 'runPreview', args: [] },
    {
      runPreview: () => {
        throw new Error('broken rules');
      },
    }
  );
  assert.deepEqual(bad, { kind: 'answer', id: 2, ok: false, error: 'broken rules' });
});
