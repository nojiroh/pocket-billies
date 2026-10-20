// Phase 09 batch 9: a placement's turn (rot, degrees) moves its points, its footprint and its pictures the same way as
// the model shaders and buildings.js buildingRotation do (game/js/logic/prop-turn.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn } from './setup-fixture.mjs';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} is not ${b}`);
const nearPt = (p, q, msg) => {
  near(p[0], q[0], msg + ' x');
  near(p[1], q[1], msg + ' z');
};

test('no turn moves nothing', () => {
  const p = { x: 4, z: 7 };
  assert.equal(fn('placedTurn')(p), 0);
  assert.deepEqual(fn('turnedPoint')(p, 1.5, 2), [5.5, 9]);
  assert.deepEqual(fn('pointInProp')(p, 5.5, 9), [1.5, 2]);
  assert.deepEqual(fn('turnedBounds')(p, -1, 0, 1, 2), [3, 7, 5, 9]);
});

test('a quarter turn sends the right-hand end away from you, as the model shaders do', () => {
  const p = { x: 10, z: 5, rot: 90 };
  // the shaders: x' = x cos r - z sin r, z' = x sin r + z cos r
  nearPt(fn('turnedPoint')(p, 1, 0), [10, 6], 'right-hand end');
  nearPt(fn('turnedPoint')(p, 0, 1), [9, 5], 'a metre back');
  nearPt(fn('turnedBounds')(p, -1, 0, 1, 2), [8, 4, 10, 6], 'footprint');
});

test('pointInProp undoes turnedPoint at any angle', () => {
  for (const rot of [-170, -90, -33.3, 12, 45, 135, 180]) {
    const p = { x: -3, z: 2, rot };
    const w = fn('turnedPoint')(p, 0.7, -1.9);
    nearPt(fn('pointInProp')(p, w[0], w[1]), [0.7, -1.9], `rot ${rot}`);
  }
});

test('a turned footprint is blocked where it stands, and only there', () => {
  // a 4 m by 1 m bus shelter turned 90 degrees: it now runs 4 m along z
  const p = { x: 20, z: 20, rot: 90 },
    inside = (x, z) => {
      const [lx, lz] = fn('pointInProp')(p, x, z);
      return lx >= -2 && lx <= 2 && lz >= -0.1 && lz <= 1;
    };
  assert.ok(inside(19.5, 21.5), 'along its length');
  assert.ok(inside(19.5, 18.5), 'the other end');
  assert.ok(!inside(22, 20.5), 'where it stood unturned');
  const B = fn('turnedBounds')(p, -2, -0.1, 2, 1);
  for (const [x, z] of [
    [19.5, 21.5],
    [19.5, 18.5],
  ])
    assert.ok(x >= B[0] && x <= B[2] && z >= B[1] && z <= B[3], 'inside its bounds');
});

test('turns are kept from -180 to 180, to a tenth, and mirror the other way', () => {
  assert.equal(fn('normalTurn')(370), 10);
  assert.equal(fn('normalTurn')(-190), 170);
  assert.equal(fn('normalTurn')(-180), 180);
  assert.equal(fn('normalTurn')(360), 0);
  assert.equal(fn('normalTurn')(12.34), 12.3);
  assert.equal(fn('mirroredTurn')(30), -30);
  assert.equal(fn('mirroredTurn')(undefined), 0);
  assert.equal(fn('mirroredTurn')(180), 180);
});

test('a picture that stays put faces the placement turn; a camera-facing one never turns', () => {
  const p = { x: 0, z: 0, rot: 90 };
  near(fn('pictureFacing')({ fixed: true, p }), Math.PI / 2, 'standee');
  assert.equal(fn('pictureFacing')({ fixed: false, p }), 0);
  // a model's decal has the model's turn in its yaw already, a 3D building turns its own walls
  near(fn('pictureFacing')({ fixed: true, p, voxImg: 1, yaw: 0.25 }), 0.25, 'decal');
  assert.equal(fn('pictureFacing')({ fixed: true, p, bld3: true }), 0);
  const R = fn('pictureRight')({ fixed: true, p }, [9, 9, 9]);
  near(R[0], 0, 'right x');
  near(R[2], 1, 'right z');
  assert.deepEqual(fn('pictureRight')({ fixed: false, p }, [9, 9, 9]), [9, 9, 9]);
  near(fn('propTurn')({ p, lk: { rot: 0.5 } }), Math.PI / 2 + 0.3, 'model with a little random turn');
});
