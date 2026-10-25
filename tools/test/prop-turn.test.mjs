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

/* HB-1: a model's point as its shaders place it (prop-models.js: x mirrored, times the size, turned, then the base
   and the bob's rise) and a face's outward way (a decal's yaw 0 faces the front, -z) */
const modelPoint = (at, q, m) => {
  const f = m.f || 1,
    ro = m.turn + (m.bob ? m.bob[1] : 0),
    x = q[0] * f * m.s,
    y = q[1] * m.s,
    z = q[2] * m.s;
  return [
    at.x + x * Math.cos(ro) - z * Math.sin(ro),
    at.y + y + (m.bob ? m.bob[0] : 0),
    at.z + x * Math.sin(ro) + z * Math.cos(ro),
  ];
};
const faceOut = (yaw, m) => {
  const ro = m.turn + (m.bob ? m.bob[1] : 0),
    nx = Math.sin(yaw) * (m.f || 1),
    nz = -Math.cos(yaw);
  return [nx * Math.cos(ro) - nz * Math.sin(ro), nx * Math.sin(ro) + nz * Math.cos(ro)];
};

test('HB-1: a decal stays on its model: size and wobble, turn, mirror and bob as the shaders draw the model', () => {
  const at = { x: 3, y: 0.5, z: -2 },
    L = { k: 'img', x: 0.8, y: -0.1, z: 1.6, face: 'fixed', yaw: Math.PI / 2 };
  for (const s of [1, 1.06 * 1.2, 0.92])
    for (const f of [1, -1])
      for (const turn of [0, 0.4, -2.1])
        for (const bob of [null, [0.07, 0.02]]) {
          const m = { s, f, turn, bob },
            d = fn('decalPlace')(at, L, m),
            w = modelPoint(at, [L.x, L.z, L.y], m),
            tag = `s ${s} f ${f} turn ${turn} bob ${!!bob}`;
          near(d.x, w[0], tag + ' x');
          near(d.y, w[1], tag + ' y');
          near(d.z, w[2], tag + ' z');
          near(d.s, s, tag + ' size');
          /* it faces the way the model's face does (pictureRight's angle a: its outward way is (sin a, -cos a)) */
          const o = faceOut(L.yaw, m);
          near(Math.sin(d.yaw), o[0], tag + ' facing x');
          near(-Math.cos(d.yaw), o[1], tag + ' facing z');
        }
});

test('HB-1: a mirrored model never mirrors its lettering; a camera-facing layer mirrors with it', () => {
  const at = { x: 0, y: 0, z: 0 },
    m = { s: 1, f: -1, turn: 0 };
  assert.equal(fn('decalPlace')(at, { face: 'fixed' }, m).flip, 1);
  assert.equal(fn('decalPlace')(at, { face: 'fixed', flip: 1 }, m).flip, -1, 'a layer drawn mirrored on purpose');
  assert.equal(fn('decalPlace')(at, {}, m).flip, -1);
  assert.equal(fn('decalPlace')(at, {}, { s: 1, turn: 0 }).flip, 1);
  near(fn('decalPlace')(at, { face: 'fixed', yaw: 1 }, m).yaw, -1, 'the side decal faces the other side');
  assert.equal(fn('decalPlace')(at, { yaw: 1 }, m).yaw, 0, 'a camera-facing layer has no yaw');
});
