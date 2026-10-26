// Phase 20 R2 (models lane): the pure parts of the instanced models (game/js/engine/model-instances.js): the record
// layout and its attributes, the batches by mesh, F5's box against the view and the pieces. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';
await import('../../game/js/engine/model-instances.js');

const G = globalThis;
const {
  MODEL_INSTANCE_FLOATS,
  MODEL_INSTANCE_ATTRIBS,
  modelInstanceStore,
  modelInstanceValues,
  reserveModelInstances,
  writeModelInstance,
  readModelInstance,
  buildModelBatches,
  boxInFrustum,
  splitPieces,
  computeFrustum,
  inFrustum,
} = G;

// a small seeded generator, so a failure repeats
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const f32 = a => (Array.isArray(a) ? a.map(Math.fround) : Math.fround(a));

test('a record reads back as written, the window bits whole (all 31 windows)', () => {
  const S = reserveModelInstances(modelInstanceStore(), 3);
  const R = rng(7);
  for (const winOn of [0, 5, 0x7fffffff, 0x7f800001, 2 ** 30 + 3]) {
    const v = modelInstanceValues();
    v.pos = [R() * 100, R(), R() * -50];
    v.s = 1.25;
    v.rot = 2.5;
    v.flip = -1;
    v.fade = 0.4;
    v.k = 0.75;
    v.base = [1.5, 0.25, 9];
    v.seed = 0.33;
    v.spin = [0, 1, 0, 0.7];
    v.spinC = [0.1, 0.2, 0.3];
    v.winOn = winOn;
    v.winK = 0.9;
    v.wear = [0.1, 0.2, 0.3, 0.4];
    v.hsv = [0.05, -0.1, 0.2, 1];
    v.tint = [1, 0.9, 0.8, 0.5];
    v.mask = [0.2, 0.1];
    writeModelInstance(S, 2, v);
    const r = readModelInstance(S.F, S.U, 2);
    for (const k of Object.keys(v)) assert.deepEqual(r[k], k === 'winOn' ? winOn : f32(v[k]), k);
  }
});

test('the store grows and keeps what it is asked for', () => {
  const S = modelInstanceStore();
  reserveModelInstances(S, 10);
  assert.ok(S.F.length >= 10 * MODEL_INSTANCE_FLOATS);
  const n = S.F.length;
  reserveModelInstances(S, 5);
  assert.equal(S.F.length, n);
  reserveModelInstances(S, 1000);
  assert.ok(S.F.length >= 1000 * MODEL_INSTANCE_FLOATS);
  assert.equal(S.U.buffer, S.F.buffer);
});

test('the attributes cover each float once, fit after the mesh and under 16', () => {
  for (const [kind, first] of [
    ['vox', 3],
    ['mdl', 5],
  ]) {
    const I = MODEL_INSTANCE_ATTRIBS[kind],
      locs = I.map(a => a[0]);
    assert.equal(new Set(locs).size, locs.length, kind);
    assert.ok(Math.min(...locs) >= first, kind);
    assert.ok(Math.max(...locs) <= 15, kind);
    const seen = new Set();
    for (const [, n, f] of I)
      for (let j = 0; j < n; j++) {
        assert.ok(!seen.has(f + j), `${kind}: float ${f + j} twice`);
        seen.add(f + j);
      }
  }
  // the low-poly model reads every float but the spare one
  const all = new Set(MODEL_INSTANCE_ATTRIBS.mdl.flatMap(([, n, f]) => Array.from({ length: n }, (_, j) => f + j)));
  for (let j = 0; j < MODEL_INSTANCE_FLOATS - 1; j++) assert.ok(all.has(j), `float ${j}`);
  // the voxel prop's are the first five of the model's
  assert.deepEqual(MODEL_INSTANCE_ATTRIBS.vox, MODEL_INSTANCE_ATTRIBS.mdl.slice(0, 5));
});

test('batches: by mesh in first-met order, each item once, records in batch order', () => {
  const R = rng(3),
    meshes = Array.from({ length: 6 }, (_, i) => ({ id: i })),
    L = Array.from({ length: 200 }, (_, i) => [{ i }, meshes[Math.floor(R() * meshes.length)]]);
  const B = buildModelBatches(L);
  assert.equal(B.length, new Set(L.map(e => e[1])).size);
  const firstMet = [...new Set(L.map(e => e[1]))];
  assert.deepEqual(
    B.map(b => b.mesh),
    firstMet
  );
  let at = 0;
  const seen = new Set();
  for (const b of B) {
    assert.equal(b.at, at);
    at += b.list.length;
    for (const e of b.list) {
      assert.equal(e[1], b.mesh);
      assert.ok(!seen.has(e[0]));
      seen.add(e[0]);
    }
    // an item's order within its mesh is kept
    const idx = b.list.map(e => e[0].i);
    assert.deepEqual(
      idx,
      [...idx].sort((a, c) => a - c)
    );
  }
  assert.equal(seen.size, L.length);
  assert.deepEqual(buildModelBatches([]), []);
});

// a camera at (0, 10, -20) looking along +z and a little down
function viewPlanes() {
  const eye = [0, 10, -20],
    f = [0, -0.3, 0.954],
    r = [-1, 0, 0],
    up = [0, 0.954, 0.3],
    t = v => -(v[0] * eye[0] + v[1] * eye[1] + v[2] * eye[2]);
  const V = [r[0], up[0], -f[0], 0, r[1], up[1], -f[1], 0, r[2], up[2], -f[2], 0, t(r), t(up), -t(f), 1];
  const n = 0.5,
    fa = 300,
    k = 1 / Math.tan(0.5);
  const P = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
  const vp = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r2 = 0; r2 < 4; r2++) for (let i = 0; i < 4; i++) vp[c * 4 + r2] += P[i * 4 + r2] * V[c * 4 + i];
  return computeFrustum(vp);
}
const corners = b => {
  const out = [];
  for (let i = 0; i < 8; i++) out.push([b[i & 1 ? 3 : 0], b[i & 2 ? 4 : 1], b[i & 4 ? 5 : 2]]);
  return out;
};
const inside = (F, p, n = 5) => {
  for (let i = 0; i < n; i++)
    if (F[i * 4] * p[0] + F[i * 4 + 1] * p[1] + F[i * 4 + 2] * p[2] + F[i * 4 + 3] < 0) return false;
  return true;
};

test('box against the view: never shown where its sphere is hidden; shown when any corner is in view', () => {
  const F = viewPlanes(),
    R = rng(11);
  let shown = 0,
    hidden = 0;
  for (let n = 0; n < 4000; n++) {
    const c = [(R() - 0.5) * 200, (R() - 0.3) * 40, (R() - 0.3) * 200],
      h = [R() * 6, R() * 6, R() * 6],
      b = [c[0] - h[0], c[1] - h[1], c[2] - h[2], c[0] + h[0], c[1] + h[1], c[2] + h[2]],
      r = Math.hypot(h[0], h[1], h[2]),
      on = boxInFrustum(F, b);
    if (!inFrustum(F, c[0], c[1], c[2], r)) assert.equal(on, false, `sphere hidden, box shown: ${b}`);
    if (corners(b).some(p => inside(F, p))) assert.equal(on, true, `a corner in view, box hidden: ${b}`);
    if (on) shown++;
    else hidden++;
  }
  // the sample has both
  assert.ok(shown > 100 && hidden > 100, `${shown} / ${hidden}`);
  // the far plane only when asked
  const far = [-1, 0, 5000, 1, 1, 5001];
  assert.equal(boxInFrustum(F, far), true);
  assert.equal(boxInFrustum(F, far, true), false);
});

test('pieces: every item in exactly one, the limits hold, each box holds its items, the same twice', () => {
  const R = rng(5),
    items = Array.from({ length: 500 }, (_, i) => ({ i, x: R() * 300, y: R() * 3, z: R() * 120, w: 0.5 + R() * 3 })),
    boxOf = it => [it.x - it.w, it.y, it.z - it.w, it.x + it.w, it.y + 4, it.z + it.w];
  for (const o of [{ maxCount: 16 }, { maxExtent: 40 }, { maxCount: 32, maxExtent: 24 }, {}]) {
    const P = splitPieces(items, o, boxOf);
    const seen = new Map();
    for (const pc of P) {
      assert.ok(pc.items.length >= 1);
      if (o.maxCount) assert.ok(pc.items.length <= o.maxCount, `count ${pc.items.length}`);
      if (o.maxExtent && pc.items.length > 1)
        assert.ok(Math.max(pc.box[3] - pc.box[0], pc.box[5] - pc.box[2]) <= o.maxExtent, 'extent');
      for (const it of pc.items) {
        seen.set(it, (seen.get(it) || 0) + 1);
        const b = boxOf(it);
        for (let j = 0; j < 3; j++) assert.ok(pc.box[j] <= b[j] && pc.box[j + 3] >= b[j + 3], 'box holds it');
      }
      // a piece's items keep their first order
      const idx = pc.items.map(it => it.i);
      assert.deepEqual(
        idx,
        [...idx].sort((a, c) => a - c)
      );
    }
    assert.equal(seen.size, items.length);
    for (const n of seen.values()) assert.equal(n, 1);
    assert.deepEqual(
      splitPieces(items, o, boxOf).map(pc => pc.items.map(it => it.i)),
      P.map(pc => pc.items.map(it => it.i))
    );
    if (!o.maxCount && !o.maxExtent) assert.equal(P.length, 1);
  }
  // points by default; a single huge item is still a piece
  assert.equal(splitPieces([{ x: 1, z: 2 }], { maxExtent: 0.1 }).length, 1);
  assert.deepEqual(splitPieces([], { maxCount: 4 }), []);
});
