// The low-poly models' window seed (game/js/logic/window-seed.js): a still building keeps the old roll by where it
// stands; a moving train rolls by its key and each window's place on the model, so moving it changes nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { movingWindowSpot, windowKeySeed, windowSeed, windowsMove } from '../../game/js/logic/window-seed.js';

test('a still building keeps the old hash of where it stands', () => {
  for (const [x, z] of [
    [0, 0],
    [12.5, -40.25],
    [-3.1, 77],
  ]) {
    const old = (Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43.7585) % 1;
    assert.equal(windowSeed({ x, z, p: { k: 'shop' } }), old);
    assert.equal(windowSeed({ x, z }), old);
  }
});

test('a moving train rolls the same wherever it is', () => {
  const p = { k: 'train_greenbelt', moving: 1, trainRide: 1 },
    a = windowSeed({ x: 0, z: 0, p }),
    b = windowSeed({ x: 31.7, z: -12.02, p });
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1);
  /* parked after the ride (moving dropped) it is still the ride's train: the same seed */
  assert.equal(windowSeed({ x: 5, z: 5, p: { k: 'train_greenbelt', trainRide: 1 } }), a);
  /* an id wins over the key; two trains differ */
  assert.notEqual(windowSeed({ x: 0, z: 0, p: { ...p, id: 'other' } }), a);
  assert.notEqual(windowSeed({ x: 0, z: 0, p: { ...p, k: 'train_highland' } }), a);
});

test('which models count as moving', () => {
  assert.equal(windowsMove({ moving: 1 }), true);
  assert.equal(windowsMove({ trainRide: 1 }), true);
  assert.equal(windowsMove({ k: 'shop' }), false);
  assert.equal(windowsMove(null), false);
});

test('the key seed is steady and spread', () => {
  assert.equal(windowKeySeed('train_greenbelt'), windowKeySeed('train_greenbelt'));
  const S = new Set(['a', 'b', 'train_lakeland', 'train_wildwood', 'train_highland'].map(windowKeySeed));
  assert.equal(S.size, 5);
  for (const v of S) assert.ok(v >= 0 && v < 1);
});

test("a moving window's spot depends on the model only", () => {
  const w = [-2.4, 1.8, 0.3];
  assert.deepEqual(movingWindowSpot(0.25, w), movingWindowSpot(0.25, w));
  assert.notDeepEqual(movingWindowSpot(0.25, w), movingWindowSpot(0.5, w));
  assert.notDeepEqual(movingWindowSpot(0.25, w), movingWindowSpot(0.25, [-1.4, 1.8, 0.3]));
});
