// Camera track CAM-2: points of interest (game/js/logic/camera-interest.js): a weight that fades in smoothly inside
// a radius, the strongest point wins, and the lean toward it is capped.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INTEREST_DEFAULTS, interestFade, interestPick, zoneAt, zoneHas } from '../../game/js/logic/camera-interest.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const pt = (id, x, z, o = {}) => ({ id, x, z, ...INTEREST_DEFAULTS.door, ...o });

test('the weight is 0 outside the radius, full from 40% in, and smooth and falling between', () => {
  near(interestFade(10, 10), 0);
  near(interestFade(12, 10), 0);
  near(interestFade(4, 10), 1);
  near(interestFade(0, 10), 1);
  near(interestFade(7, 10), 0.5);
  let last = 1;
  for (let d = 4; d <= 10; d += 0.1) {
    const w = interestFade(d, 10);
    assert.ok(w <= last + 1e-12);
    last = w;
  }
  near(interestFade(3, 0), 0);
});

test('nothing in reach gives no pick', () => {
  assert.equal(interestPick([pt('a', 10, 0)], 0, 0, 1.5), null);
  assert.equal(interestPick([], 0, 0, 1.5), null);
});

test('the strongest point wins and the count says how many are in reach', () => {
  const I = interestPick([pt('far', 3, 0), pt('near', 0, 1), pt('out', 30, 0)], 0, 0, 1.5);
  assert.equal(I.id, 'near');
  assert.equal(I.n, 2);
  near(I.w, INTEREST_DEFAULTS.door.weight);
});

test('the lean points at the point, no further than its pull, the cap or the point itself', () => {
  const far = interestPick([pt('a', 0, 10, { radius: 20, pull: 5 })], 0, 0, 1.5);
  near(far.lean[0], 0);
  near(far.lean[1], 1.5);
  const own = interestPick([pt('a', 3, 4, { radius: 20, pull: 1 })], 0, 0, 1.5);
  near(Math.hypot(...own.lean), 1);
  near(own.lean[0] / own.lean[1], 3 / 4);
  const close = interestPick([pt('a', 0.5, 0, { pull: 1 })], 0, 0, 1.5);
  near(close.lean[0], 0.5);
});

test('weights and zooms out of range are kept sane', () => {
  const I = interestPick([pt('a', 0, 0, { weight: 3, zoom: 0 })], 0, 0, 1.5);
  near(I.w, 1);
  near(I.zoom, 1);
});

test('camera zones: inside a rect or a circle, the highest priority wins, a tie goes to the later', () => {
  const Z = [
    { shape: 'rect', x: 0, z: 0, w: 10, h: 4 },
    { shape: 'circle', x: 5, z: 2, r: 1.5, priority: 2 },
    { shape: 'rect', x: 8, z: 0, w: 4, h: 4 },
  ];
  assert.equal(zoneHas(Z[0], 10, 4), true);
  assert.equal(zoneHas(Z[0], 10.1, 4), false);
  assert.equal(zoneHas(Z[1], 6.4, 2), true);
  assert.equal(zoneAt(Z, 1, 1), 0);
  assert.equal(zoneAt(Z, 5, 2.5), 1);
  assert.equal(zoneAt(Z, 9, 1), 2);
  assert.equal(zoneAt(Z, 20, 1), -1);
  assert.equal(zoneAt(undefined, 1, 1), -1);
});
