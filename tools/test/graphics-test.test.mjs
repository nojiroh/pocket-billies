// Phase 13: the graphics test's own rules (game/js/graphics-test.js): the report, its costs and drift, and its
// planted-name check (TD-2: the values each dial is walked at are logic/bench-path.js's, tools/test/bench-path.test.mjs).
// The test itself runs only by hand on a device; this file never runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  graphicsCosts,
  graphicsDrift,
  graphicsFrameMs,
  graphicsNames,
  graphicsNamesIn,
  graphicsReport,
  graphicsStepName,
} = await import('../../game/js/graphics-test.js');

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
    'costFrom',
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

/* format 4: costs and drift come from the mean frame (1000 / fps), no longer the median; these steps give fps where
   they gave p50 (1000 / 62.5 = 16 ms, 1000 / 47.62 = 21 ms, ...) */
const at = ms => Math.round((1000 / ms) * 100) / 100;
test("a dial's cost is its mean frame over its segment's shipped runs; inside their spread it is unsure", () => {
  const S = [
    { kind: 'base', seg: 'pond', fps: at(16) },
    { kind: 'dial', seg: 'pond', dial: 'water.reflection', fps: at(21) },
    { kind: 'dial', seg: 'pond', dial: 'water.foam', fps: at(16.5) },
    { kind: 'base', seg: 'pond', fps: at(17) },
    { kind: 'dial', seg: 'lamps', dial: 'color.bloom', fps: at(30) },
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
  const S = [10, 11, 12.5].map(ms => ({ kind: 'base', seg: 'open', fps: at(ms), drift: true }));
  assert.deepEqual(graphicsDrift(S), {
    first: 10,
    last: 12.5,
    fpsFirst: 100,
    fpsLast: 80,
    runs: 3,
    change: 25,
    drifting: true,
  });
  assert.equal(graphicsDrift(S.slice(0, 1)), null);
});

test('a phone held to 60 Hz: every median is 16.7, but the costs and the drift still show (the mean frame)', () => {
  /* frames come in whole refresh intervals, so the median stays 16.7 ms while more and more frames miss one */
  const q = (extra = {}) => ({ p50: 16.7, p90: 33.3, frames: 2400, ...extra });
  const S = [
    q({ kind: 'base', seg: 'open', fps: 49.9, drift: true }),
    q({ kind: 'base', seg: 'open', fps: 49.9 }),
    q({ kind: 'dial', seg: 'open', dial: 'shadows.mapSize', fps: 40.1 }),
    q({ kind: 'dial', seg: 'open', dial: 'grass.density', fps: 49.6 }),
    q({ kind: 'base', seg: 'open', fps: 49.0 }),
    q({ kind: 'base', seg: 'open', fps: 41.3, drift: true }),
  ];
  assert.equal(graphicsFrameMs({ fps: 49.9 }), 20.04);
  assert.equal(graphicsFrameMs({ p50: 16.7 }), null);
  const c = graphicsCosts(S);
  const shadow = c.find(x => x.dial === 'shadows.mapSize');
  assert.ok(shadow.cost > 4, `cost ${shadow.cost}`);
  assert.equal(shadow.unsure, false);
  assert.ok(shadow.noise > 0, 'the shipped runs differ, so the noise is not 0');
  assert.equal(c.find(x => x.dial === 'grass.density').unsure, true);
  const d = graphicsDrift(S);
  assert.equal(d.runs, 4);
  assert.ok(d.change > 15, `change ${d.change}%`);
  assert.equal(d.drifting, true);
  assert.deepEqual([d.fpsFirst, d.fpsLast], [49.9, 41.3]);
  /* and the report names what costs and drift are worked from */
  const r = graphicsReport({ steps: S.map((s, i) => ({ name: 'Step ' + i, ok: true, ...s })) }, []);
  assert.equal(r.format, 4);
  assert.match(r.costFrom, /mean/);
  assert.ok(
    r.costs.some(x => !x.unsure && x.cost > 0.3),
    'the "costliest here" list is not empty'
  );
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
