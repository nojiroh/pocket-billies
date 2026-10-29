// Phase 13: the graphics test's own rules (game/js/graphics-test.js): the report, its costs and drift, and its
// planted-name check (TD-2: the values each dial is walked at are logic/bench-path.js's, tools/test/bench-path.test.mjs).
// The test itself runs only by hand on a device; this file never runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { graphicsCosts, graphicsDrift, graphicsNames, graphicsNamesIn, graphicsReport, graphicsStepName } =
  await import('../../game/js/graphics-test.js');

const PLANTED = { trainer: 'Quillonda', nick: 'Zorblax' };
const step = (name, extra = {}) => ({
  name,
  kind: 'dial',
  seg: 'open',
  ok: true,
  fps: 58.2,
  p50: 16.7,
  worst: 21,
  frames: 116,
  ...extra,
});

test('the names: planted, the trainer and every nickname in the save', () => {
  const save = { avatar: { name: 'Robin' }, team: [{ nick: 'Fizz' }, { nick: '' }], box: [[{ nick: 'Bo' }]] };
  assert.deepEqual(graphicsNames(save, PLANTED).sort(), ['Fizz', 'Quillonda', 'Robin', 'Zorblax']);
});

test('a report from a clean run holds no names and passes', () => {
  const r = graphicsReport({ steps: [step('Dial: Blur'), step('Preset: Balanced')] }, ['Quillonda']);
  assert.equal(graphicsNamesIn(JSON.stringify(r), Object.values(PLANTED)).length, 0);
  assert.equal(r.passed, true);
  assert.deepEqual(r.steps.at(-1), { step: 'The report holds no names', ok: true });
});

test('a planted name that reaches the report is taken out, and the check says so', () => {
  const r = graphicsReport(
    {
      steps: [step('Dial: Blur', { ok: false, why: 'an error during the step: zorblax is not defined' })],
      errors: ['Quillonda: cannot read x'],
    },
    graphicsNames({ avatar: { name: 'Quillonda' }, team: [{ nick: 'Zorblax' }] }, PLANTED)
  );
  const text = JSON.stringify(r);
  assert.deepEqual(graphicsNamesIn(text, Object.values(PLANTED)), []);
  assert.match(text, /\[name\] is not defined/);
  assert.equal(r.steps.at(-1).ok, false);
  assert.equal(r.passed, false);
});

test('the report keeps only what the test measured: no save, no history', () => {
  const r = graphicsReport({ steps: [step('Dial: Blur')], device: { renderer: 'Chip' } }, []);
  assert.deepEqual(Object.keys(r).sort(), [
    'budgetMb',
    'build',
    'conditions',
    'costs',
    'created',
    'device',
    'drift',
    'errors',
    'format',
    'game',
    'groups',
    'kind',
    'passed',
    'res',
    'resumed',
    'seconds',
    'steps',
    'stopped',
  ]);
  /* a step keeps its numbers and ids, nothing it wasn't given */
  assert.deepEqual(Object.keys(r.steps[0]).sort(), ['fps', 'frames', 'kind', 'ok', 'p50', 'seg', 'step', 'worst']);
});

test("a dial's cost is its median frame over its segment's shipped runs; inside their spread it is unsure", () => {
  const S = [
    { kind: 'base', seg: 'pond', p50: 16 },
    { kind: 'dial', seg: 'pond', dial: 'water.reflection', p50: 21 },
    { kind: 'dial', seg: 'pond', dial: 'water.foam', p50: 16.5 },
    { kind: 'base', seg: 'pond', p50: 17 },
    { kind: 'dial', seg: 'lamps', dial: 'color.bloom', p50: 30 },
  ];
  const c = graphicsCosts(S);
  assert.deepEqual(
    c.map(x => [x.dial, x.cost, x.unsure]),
    [
      ['water.reflection', 4.5, false],
      ['water.foam', 0, true],
    ]
  );
});

test('the drift: the open ground as shipped, first and last', () => {
  const S = [10, 11, 12.5].map(p50 => ({ kind: 'base', seg: 'open', p50, drift: true }));
  assert.deepEqual(graphicsDrift(S), { first: 10, last: 12.5, runs: 3, change: 25, drifting: true });
  assert.equal(graphicsDrift(S.slice(0, 1)), null);
});

test("a step's name says the segment, the dial and both values", () => {
  assert.equal(
    graphicsStepName({ kind: 'dial', label: 'Blur', dial: 'lens.blur', shipped: 0.5, value: 1.125 }, 'Down the avenue'),
    'Down the avenue: Blur (lens.blur 0.5 → 1.125)'
  );
  assert.equal(
    graphicsStepName({ kind: 'notHere', label: 'Lagoon', dial: 'worldMap.lagoon' }),
    'Lagoon (worldMap.lagoon)'
  );
});
