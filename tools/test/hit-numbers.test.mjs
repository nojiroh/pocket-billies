// Style track SY-2: numbers you feel: the damage number's size and the HP roll (game/js/logic/hit-numbers.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POP_MAX, POP_MIN, ROLL_MS, popSize, rollValue } from '../../game/js/logic/hit-numbers.js';

test("the damage number's size follows the hit: 24 px at a scratch to 40 px at a one-shot", () => {
  assert.equal(POP_MIN, 24);
  assert.equal(POP_MAX, 40);
  assert.equal(popSize(0), POP_MIN);
  assert.equal(popSize(1), POP_MAX);
  assert.equal(popSize(0.5), 32);
  assert.ok(popSize(0.1) < popSize(0.4) && popSize(0.4) < popSize(0.8), 'a bigger hit, a bigger number');
});

test('out of range or missing weights stay inside the sizes', () => {
  assert.equal(popSize(-1), POP_MIN);
  assert.equal(popSize(3), POP_MAX);
  assert.equal(popSize(NaN), popSize(0.3), "hitWeight's own fallback");
  assert.equal(popSize(undefined), popSize(0.3));
});

test("a KO's number is always the largest", () => {
  for (const w of [0, 0.05, 0.5, 1]) assert.equal(popSize(w, true), POP_MAX);
});

test('the HP roll: starts at the old value, ends exactly at the new one, whole numbers, never past the end', () => {
  assert.equal(ROLL_MS, 380, "as long as the fill's .38 s");
  assert.equal(rollValue(120, 45, 0), 120);
  assert.equal(rollValue(120, 45, ROLL_MS), 45);
  assert.equal(rollValue(120, 45, ROLL_MS + 500), 45);
  let last = 120;
  for (let t = 0; t <= ROLL_MS; t += 19) {
    const v = rollValue(120, 45, t);
    assert.ok(Number.isInteger(v), 'whole numbers');
    assert.ok(v <= last && v >= 45, 'counts down without overshooting');
    last = v;
  }
  assert.ok(rollValue(120, 45, ROLL_MS / 2) < (120 + 45) / 2, 'fast first, settling at the end');
});

test('the HP roll counts up for a heal, and a zero length sets the value at once', () => {
  assert.ok(rollValue(10, 90, 100) > 10 && rollValue(10, 90, 100) < 90);
  assert.equal(rollValue(10, 90, 50, 0), 90);
  assert.equal(rollValue(7, 7, 100), 7);
});
