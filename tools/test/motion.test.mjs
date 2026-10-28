// UI track UI-16a: the Animation setting's levels and the feedback motions' numbers (game/js/logic/motion.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MOTION_CHOICES,
  MOTION_LEVELS,
  MOTION_TIMES,
  motionCountAt,
  motionCountMs,
  motionLevelOf,
  motionStaggerCap,
} from '../../game/js/logic/motion.js';

test('Device plays Full unless the phone asks for reduced motion; a choice wins over the phone', () => {
  assert.equal(motionLevelOf('system', false), 'full');
  assert.equal(motionLevelOf('system', true), 'reduced');
  assert.equal(motionLevelOf(undefined, false), 'full', 'no choice yet is Device');
  assert.equal(motionLevelOf(undefined, true), 'reduced');
  for (const phone of [false, true]) {
    assert.equal(motionLevelOf('full', phone), 'full');
    assert.equal(motionLevelOf('calm', phone), 'calm');
    assert.equal(motionLevelOf('reduced', phone), 'reduced');
  }
  assert.equal(motionLevelOf('bogus', false), 'full', 'an unknown value is Device');
  assert.deepEqual(MOTION_CHOICES, ['system', 'full', 'calm', 'reduced']);
  for (const c of MOTION_CHOICES) assert.ok(MOTION_LEVELS.includes(motionLevelOf(c, false)), c);
});

test('a count ticks for 400-700 ms, longer for bigger changes, and lands on its value', () => {
  assert.equal(motionCountMs(5, 5), 0, 'nothing to count');
  const [lo, hi] = MOTION_TIMES.tick;
  let last = 0;
  for (const d of [1, 9, 40, 300, 5000, 1e6, 1e9]) {
    const ms = motionCountMs(0, d);
    assert.ok(ms >= lo && ms <= hi, `${d}: ${ms} ms`);
    assert.ok(ms >= last, 'never shorter for a bigger change');
    last = ms;
  }
  assert.equal(motionCountMs(500, 120), motionCountMs(120, 500), 'down as long as up');
  assert.equal(motionCountAt(10, 110, 0), 10);
  assert.equal(motionCountAt(10, 110, 1), 110);
  assert.equal(motionCountAt(10, 110, 2), 110, 'clamped');
  assert.ok(motionCountAt(10, 110, 0.5) > 60, 'eases out: past halfway at half time');
});

test('rows stop staggering where the last one would land after 400 ms', () => {
  assert.equal(motionStaggerCap(240, 35), 4);
  assert.ok(240 + motionStaggerCap(240, 35) * 35 <= MOTION_TIMES.enterMax);
  assert.equal(motionStaggerCap(240, 0), 0);
  assert.equal(motionStaggerCap(500, 35), 0, 'an enter longer than the limit never staggers');
});
