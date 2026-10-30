// Fluid track FL-3b: the resolution in fewer, larger steps (game/js/logic/frame-control.js RES_LEVELS, resDrawLevel,
// resApply, the controller's R lever with resSteps) and the frozen cap (logic/frame-pace.js paceDue with a cap of 0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RES_LEVELS,
  controlFrame,
  controlRestore,
  frameControl,
  resApply,
  resDrawLevel,
  resStepDown,
  resStepUp,
} from '../../game/js/logic/frame-control.js';
import { paceDue, paceTask } from '../../game/js/logic/frame-pace.js';

test('the levels: fewer and larger than the 0.1 steps', () => {
  assert.deepEqual(RES_LEVELS, [1, 0.8, 0.6, 0.5]);
  assert.equal(resStepDown(1, 0.6), 0.8);
  assert.equal(resStepDown(0.8, 0.6), 0.6);
  assert.equal(resStepDown(0.6, 0.6), 0.6, 'a phone stops at 0.6');
  assert.equal(resStepDown(0.6, 0.5), 0.5);
  assert.equal(resStepDown(0.9, 0.5), 0.8, 'an ask between levels steps to the next one below');
  assert.equal(resStepUp(0.5), 0.6);
  assert.equal(resStepUp(0.8), 1);
  assert.equal(resStepUp(1), 1);
});

test("the old ladder's 0.1 steps move the size only when they cross a level (hysteresis)", () => {
  // going down: the lowest level still at or above the ask
  assert.equal(resDrawLevel(0.9, 1), 1);
  assert.equal(resDrawLevel(0.8, 1), 0.8);
  assert.equal(resDrawLevel(0.7, 1), 0.8);
  assert.equal(resDrawLevel(0.6, 0.8), 0.6);
  // going up: the highest level at or below the ask
  assert.equal(resDrawLevel(0.7, 0.6), 0.6);
  assert.equal(resDrawLevel(0.9, 0.8), 0.8);
  assert.equal(resDrawLevel(1, 0.8), 1);
  // a ladder walking 1 → 0.6 → 1 in 0.1 steps changes the drawn size 4 times, not 8
  let d = 1,
    changes = 0;
  for (const w of [0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 1]) {
    const n = resDrawLevel(w, d);
    if (n !== d) changes++;
    d = n;
  }
  assert.equal(changes, 4);
  // and back and forth across one 0.1 step changes nothing
  d = 0.8;
  for (const w of [0.9, 0.8, 0.9, 0.8, 0.7, 0.8, 0.7]) d = resDrawLevel(w, d);
  assert.equal(d, 0.8);
});

test('a waiting level is taken only where it cannot be seen', () => {
  const m = { drawn: 1, want: 0.8, held: false, fading: false, loading: false, resizing: false };
  assert.deepEqual(resApply(m), { R: 1, why: '' }, 'during a walk it waits');
  assert.deepEqual(resApply({ ...m, held: true }), { R: 0.8, why: 'held' });
  assert.deepEqual(resApply({ ...m, fading: true }), { R: 0.8, why: 'fade' });
  assert.deepEqual(resApply({ ...m, loading: true }), { R: 0.8, why: 'loading' });
  assert.deepEqual(resApply({ ...m, resizing: true }), { R: 0.8, why: 'resize' });
  assert.deepEqual(resApply({ ...m, drawn: null }), { R: 0.8, why: 'first' });
  assert.deepEqual(resApply({ ...m, want: 1, held: true }), { R: 1, why: '' }, 'nothing waiting: no change');
});

test("the controller's resolution lever steps between the levels with resSteps", () => {
  const V = 1000 / 60,
    s = frameControl(),
    seen = new Set();
  // GPU-bound: every frame misses (two refreshes), the fence two frames behind
  for (let t = 0, n = 0; t < 60000; n++) {
    t += 2 * V;
    const r = controlFrame(s, {
      now: t,
      dt: 2 * V,
      work: 4,
      lag: 2,
      slot: V,
      V,
      phone: true,
      floorR: 0.6,
      resSteps: RES_LEVELS,
    });
    if (r && r.lever === 'R') seen.add(s.lv.R);
  }
  assert.deepEqual([...seen].sort(), [0.6, 0.8], 'the resolution went 1 → 0.8 → 0.6, no 0.9 or 0.7');
  assert.equal(s.lv.R, 0.6);
  assert.equal(s.lv.half, true, 'then the half rate');
  // without the levels the old 0.1 steps
  const o = frameControl();
  const old = new Set();
  for (let t = 0; t < 60000;) {
    t += 2 * V;
    const r = controlFrame(o, { now: t, dt: 2 * V, work: 4, lag: 2, slot: V, V, phone: true, floorR: 0.6 });
    if (r && r.lever === 'R') old.add(o.lv.R);
  }
  assert.deepEqual([...old].sort(), [0.6, 0.7, 0.8, 0.9]);
});

test('kept levels come back on a level, with one R on the stack a level', () => {
  const s = controlRestore({ q: 4, c: 0, R: 0.6, taken: ['q', 'q', 'q', 'q', 'R', 'R'] }, RES_LEVELS);
  assert.equal(s.lv.R, 0.6);
  assert.equal(s.taken.filter(l => l === 'R').length, 2);
  // a level kept from the 0.1 steps comes back on the level at or above it
  assert.equal(controlRestore({ R: 0.7 }, RES_LEVELS).lv.R, 0.8);
  assert.equal(controlRestore({ R: 0.7 }).lv.R, 0.7, 'without the levels as before');
});

test('a cap of 0 freezes: one frame at once, then none until the cap changes', () => {
  const V = 1000 / 60,
    t = paceTask();
  let ran = 0;
  for (let ts = V; ts < 1000; ts += V) if (paceDue(t, ts, 60, V) >= 0) ran++;
  assert.ok(ran >= 58, `${ran} frames at 60`);
  // a screen opens: the last frame at once
  assert.ok(paceDue(t, 1000, 0, V) >= 0, 'the last frame');
  let frozen = 0;
  for (let ts = 1000 + V; ts < 30000; ts += V) if (paceDue(t, ts, 0, V) >= 0) frozen++;
  assert.equal(frozen, 0, 'no frame in 29 s behind the screen');
  // it closes: back at once, the first gap one slot (not the 29 s behind the screen)
  const dt = paceDue(t, 30000, 60, V);
  assert.ok(Math.abs(dt - V) < 0.01, `the first gap after: ${dt}`);
  // a task that starts frozen still draws its one frame
  const u = paceTask();
  assert.ok(paceDue(u, 5, 0, V) >= 0);
  assert.equal(paceDue(u, 5 + V, 0, V), -1);
  // the old floor (0.1) still draws one frame in 10 s
  const w = paceTask();
  let slow = 0;
  for (let ts = V; ts < 30000; ts += V) if (paceDue(w, ts, 0.1, V) >= 0) slow++;
  assert.ok(slow >= 3 && slow <= 4, `${slow} frames in 30 s at 0.1`);
});
