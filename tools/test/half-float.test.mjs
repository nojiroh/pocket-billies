// Half floats for RGBA16F textures (game/js/logic/half-float.js): the water's kinds and flow textures are uploaded as
// HALF_FLOAT so no driver has to round full floats (the owner's Adreno phone kept nothing when it did).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { halfFloatBits, halfFloats } from '../../game/js/logic/half-float.js';

/* the value a half float's bits stand for */
function halfValue(h) {
  const s = h & 0x8000 ? -1 : 1,
    e = (h >> 10) & 0x1f,
    m = h & 0x3ff;
  if (e === 0x1f) return m ? NaN : s * Infinity;
  if (e === 0) return s * m * 2 ** -24;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

test('exact values keep their bits', () => {
  for (const [v, h] of [
    [0, 0x0000],
    [-0, 0x8000],
    [1, 0x3c00],
    [-2, 0xc000],
    [0.5, 0x3800],
    [65504, 0x7bff],
    [2 ** -14, 0x0400],
    [2 ** -24, 0x0001],
    [Infinity, 0x7c00],
    [-Infinity, 0xfc00],
  ])
    assert.equal(halfFloatBits(v), h, String(v));
  assert.ok(Number.isNaN(halfValue(halfFloatBits(NaN))));
});

test('rounds to the nearest half float, ties to even, and overflows to infinity', () => {
  assert.equal(halfFloatBits(1 + 2 ** -11), 0x3c00); // a tie: stays even
  assert.equal(halfFloatBits(1 + 3 * 2 ** -11), 0x3c02); // a tie: up to even
  assert.equal(halfFloatBits(1 + 2 ** -11 + 2 ** -20), 0x3c01); // past the tie: up
  assert.equal(halfFloatBits(65520), 0x7c00);
  assert.equal(halfFloatBits(1e6), 0x7c00);
  assert.equal(halfFloatBits(2 ** -25), 0x0000); // a tie with zero: even
  assert.equal(halfFloatBits(2 ** -25 * 1.5), 0x0001);
});

test('matches Math.f16round where Node has it, and is within half a step elsewhere', () => {
  const vals = [];
  for (let i = 0; i < 4000; i++) vals.push(((Math.sin(i * 12.9898) * 43758.5453) % 1) * 10 ** ((i % 9) - 5));
  vals.push(0.42, 0.97, 1.6, 0.055, 0.25, 0.8, 0.45, 0.88, 0.86);
  for (const v of vals) {
    const got = halfValue(halfFloatBits(v));
    if (typeof Math.f16round === 'function') assert.equal(got, Math.f16round(v), String(v));
    else {
      const step = Math.abs(v) < 2 ** -14 ? 2 ** -24 : 2 ** (Math.floor(Math.log2(Math.abs(v))) - 10);
      assert.ok(Math.abs(got - v) <= step / 2, `${v} -> ${got}`);
    }
  }
});

test('halfFloats converts a whole array', () => {
  const out = halfFloats(new Float32Array([1, 0.5, -2, 0]));
  assert.ok(out instanceof Uint16Array);
  assert.deepEqual([...out], [0x3c00, 0x3800, 0xc000, 0x0000]);
});
