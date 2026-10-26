// Phase 20 E4: the sprite instances' packing (game/js/engine/sprite-instances.js): the half packer against the half
// grid, the layout's offsets against its stride, and a record taking every field packed and read back within half
// precision. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';

await import('../../game/js/engine/sprite-instances.js');

const {
  SPRITE_INSTANCE_LAYOUT,
  SPRITE_INSTANCE_STRIDE,
  SPRITE_MATERIALS,
  halfBits,
  halfValue,
  packSpriteInstance,
  packSpriteInstances,
  unpackSpriteInstance,
  spriteInstanceBytes,
  SURFACE_MATERIALS,
} = globalThis;

test('halves: exact values stay exact, others go to the nearest half, ties to even', () => {
  for (const v of [0, 1, -1, 0.5, 2, 1024, 65504, -65504, 2 ** -14, 2 ** -24, 3 * 2 ** -24, 0.25, 1.5])
    assert.equal(halfValue(halfBits(v)), v, `${v}`);
  assert.equal(halfBits(-0), 0x8000);
  assert.equal(halfValue(halfBits(70000)), Infinity);
  assert.equal(halfValue(halfBits(-1e9)), -Infinity);
  assert.ok(Number.isNaN(halfValue(halfBits(NaN))));
  assert.equal(halfBits(1 + 2 ** -11), halfBits(1), 'a tie rounds to even (down)');
  assert.equal(halfBits(1 + 3 * 2 ** -11), halfBits(1 + 2 ** -9), 'a tie rounds to even (up)');
  assert.equal(halfValue(halfBits(65519)), 65504);
  assert.equal(halfValue(halfBits(2 ** -26)), 0);
  // every half's bits come back from its value; any number lands on a nearest half
  for (let b = 0; b < 0x7c00; b++) assert.equal(halfBits(halfValue(b)), b);
  let s = 3;
  for (let n = 0; n < 20000; n++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const v = ((s / 2147483648) * 2 - 1) * 2 ** ((n % 30) - 18),
      got = halfValue(halfBits(v)),
      b = halfBits(Math.abs(v)) & 0x7fff,
      lo = halfValue(Math.max(0, b - 1)),
      hi = halfValue(b + 1);
    assert.ok(Math.abs(got - v) <= Math.min(Math.abs(Math.abs(v) - lo), Math.abs(hi - Math.abs(v))) + 1e-30, `${v}`);
  }
});

test('the layout: in order, each field aligned, ending at the stride', () => {
  const size = { f32: 4, f16: 2, u8n: 1, u8i: 1 };
  let at = 0;
  SPRITE_INSTANCE_LAYOUT.forEach(([loc, , n, fmt, off], i) => {
    assert.equal(loc, i + 1);
    assert.equal(off, at, `location ${loc}`);
    assert.equal(off % size[fmt], 0);
    at += n * size[fmt];
  });
  assert.equal(at, SPRITE_INSTANCE_STRIDE);
  assert.equal(SPRITE_INSTANCE_STRIDE % 4, 0);
  assert.ok(SPRITE_INSTANCE_LAYOUT.length + 1 <= 16, 'within WebGL2 attribute minimum');
  assert.ok(SPRITE_MATERIALS.length <= 8);
});

const record = (o = {}) => ({
  x: 101.37,
  y: 2.5,
  z: -48.125,
  ox: -0.75,
  oy: -2.9,
  w: 1.5,
  h: 2.9,
  uv: new Float32Array([0, 0, 1, 0.75]),
  flip: -1,
  slope: 0.12,
  shear: 0.043,
  dz: -0.05,
  right: [Math.cos(0.7), 0, Math.sin(0.7)],
  back: [Math.sin(0.7), 0, -Math.cos(0.7)],
  fixed: 1,
  noRecv: 1,
  flipN: -1,
  lk: { hsv: [0.025, -0.12, 0.08, 1], wear: [0.3, 1.4, 0.1, 0.05], tint: [0.9, 0.5, 0.2, 0.6], mask: [0.29, 0.13] },
  fol: [0.7, 1],
  self: [0.42, -0.6, -0.8],
  fade: 0.7,
  emit: 0.96,
  lit: 0.4,
  rim: 0.12,
  shade: 0.55,
  mt: SURFACE_MATERIALS.foliage,
  ...o,
});
const near = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-7, `${what}: ${a} against ${b}`);

test('a record packed and read back: floats exact, halves within half precision, flags and material', () => {
  const r = record();
  packSpriteInstance(3, r, false);
  const u = unpackSpriteInstance(3);
  for (const k of ['x', 'y', 'z', 'ox', 'oy', 'w', 'h']) assert.equal(u[k], Math.fround(r[k]), k);
  const H = 2 ** -11;
  for (const k of ['slope', 'shear', 'dz', 'fade', 'emit', 'lit', 'rim', 'shade']) near(u[k], r[k], H, k);
  near(u.shown, r.uv[3], H, 'shown');
  for (let i = 0; i < 4; i++) {
    near(u.hsv[i], r.lk.hsv[i], H, 'hsv');
    near(u.wear[i], r.lk.wear[i], H, 'wear');
    assert.ok(Math.abs(u.tint[i] - r.lk.tint[i]) <= 0.5 / 255 + 1e-9, 'tint');
  }
  for (const i of [0, 2]) {
    near(u.right[i], r.right[i], H, 'right');
    near(u.back[i], r.back[i], H, 'back');
  }
  near(u.mask[0], r.lk.mask[0], H, 'mask');
  near(u.mask[1], r.lk.mask[1], H, 'mask');
  near(u.fol[0], 0.7, H, 'fol');
  for (let i = 0; i < 3; i++) near(u.self[i], r.self[i], H, 'self');
  assert.deepEqual([u.fixed, u.noRecv, u.flipN, u.flip, u.cam, u.mat], [1, 1, -1, -1, false, 'foliage']);
  // no look: the neutral one; facing the camera: no axes of its own
  packSpriteInstance(
    0,
    record({ lk: null, fixed: 0, noRecv: 0, flipN: 1, flip: 1, mt: SURFACE_MATERIALS.metal }),
    true
  );
  const n = unpackSpriteInstance(0);
  assert.deepEqual(
    [n.hsv, n.wear, n.tint, n.mask],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0],
    ]
  );
  assert.deepEqual([n.right, n.back, n.cam, n.fixed, n.flip, n.mat], [[0, 0, 0], [0, 0, 0], true, 0, 1, 'metal']);
  // instance 3 untouched by instance 0
  assert.equal(unpackSpriteInstance(3).x, Math.fround(101.37));
});

test('packSpriteInstances: a run of records from instance 0, the buffer grown and kept', () => {
  const L = Array.from({ length: 600 }, (_, i) => record({ x: i, mt: SURFACE_MATERIALS[SPRITE_MATERIALS[i % 8]] }));
  const bytes = packSpriteInstances(L, 100, 600, r => r.x % 2 === 0);
  assert.equal(bytes, 500 * SPRITE_INSTANCE_STRIDE);
  assert.ok(spriteInstanceBytes.cap >= 500);
  const buf = spriteInstanceBytes.buf;
  packSpriteInstances(L, 0, 400, () => false);
  assert.equal(spriteInstanceBytes.buf, buf, 'no new buffer for fewer instances');
  for (const i of [0, 17, 399]) {
    const u = unpackSpriteInstance(i);
    assert.equal(u.x, i);
    assert.equal(u.mat, SPRITE_MATERIALS[i % 8]);
  }
});
