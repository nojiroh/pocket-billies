// Phase 13: the graphics test's own rules (game/js/graphics-test.js): the value each dial is tested at, and the report's
// planted-name check. The test itself runs only by hand on a device; this file never runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// engine/settings.js reads window and document when it loads (through hooks.js and art.js); nothing here draws
globalThis.window ??= globalThis;
globalThis.document ??= {};
const { ENGINE_DEFAULTS, ENGINE_SPEC } = await import('../../game/js/engine/settings.js');
const { graphicsDialSteps, graphicsNames, graphicsNamesIn, graphicsReport } =
  await import('../../game/js/graphics-test.js');

const PLANTED = { trainer: 'Quillonda', nick: 'Zorblax' };
const step = (name, extra = {}) => ({ name, ok: true, fps: 58.2, worstMs: 21, frames: 116, ...extra });

test('every engine dial gets one step, at a value other than its default', () => {
  const steps = graphicsDialSteps(ENGINE_SPEC, ENGINE_DEFAULTS);
  const all = ENGINE_SPEC.flatMap(([g, , rows]) => rows.map(r => `${g}.${r[0]}`));
  assert.deepEqual(
    steps.map(([g, k]) => `${g}.${k}`),
    all
  );
  const same = steps.filter(([g, k, , v]) => JSON.stringify(v) === JSON.stringify(ENGINE_DEFAULTS[g][k]));
  assert.deepEqual(same, []);
});

test('a number dial is tested at the top of its range, or the bottom when that is its default', () => {
  const spec = [
    [
      'lens',
      'Lens',
      [
        ['blur', 'Blur', 0, 2.5, 0.05],
        ['grain', 'Grain', 0, 0.15, 0.005],
      ],
    ],
  ];
  assert.deepEqual(graphicsDialSteps(spec, { lens: { blur: 0.5, grain: 0.15 } }), [
    ['lens', 'blur', 'Blur', 2.5],
    ['lens', 'grain', 'Grain', 0],
  ]);
});

test('the names: planted, the trainer and every nickname in the save', () => {
  const save = { avatar: { name: 'Robin' }, team: [{ nick: 'Fizz' }, { nick: '' }], box: [[{ nick: 'Bo' }]] };
  assert.deepEqual(graphicsNames(save, PLANTED).sort(), ['Fizz', 'Quillonda', 'Robin', 'Zorblax']);
});

test('a report from a clean run holds no names and passes', () => {
  const r = graphicsReport({ scene: 'marigold', steps: [step('Dial: Blur'), step('Preset: Balanced')] }, ['Quillonda']);
  assert.equal(graphicsNamesIn(JSON.stringify(r), Object.values(PLANTED)).length, 0);
  assert.equal(r.passed, true);
  assert.deepEqual(r.steps.at(-1), { step: 'The report holds no names', ok: true });
});

test('a planted name that reaches the report is taken out, and the check says so', () => {
  const r = graphicsReport(
    {
      scene: 'marigold',
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
  const r = graphicsReport({ scene: 'marigold', steps: [step('Dial: Blur')], device: { renderer: 'Chip' } }, []);
  assert.deepEqual(Object.keys(r).sort(), [
    'build',
    'created',
    'device',
    'errors',
    'format',
    'game',
    'kind',
    'passed',
    'scene',
    'seconds',
    'steps',
    'stopped',
  ]);
});
