// The hub's floating island (game/js/logic/float-island.js): the coast resampled evenly, the rock hanging under it to
// a point, every face turned outward, the cap under the land and a few small rocks round it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const F = modules['float-island'];
const S = F.FLOAT_STRIDE;
// a rough oval coast 0.17 wide, clockwise (the resample turns it counter-clockwise)
const COAST = Array.from({ length: 60 }, (_, i) => {
  const a = (-i / 60) * Math.PI * 2;
  return [0.02 + Math.cos(a) * 0.085 * (1 + 0.1 * Math.sin(a * 3)), -0.01 + Math.sin(a) * 0.066];
});
const TOP = 0.004;

const corners = data => {
  const out = [];
  for (let i = 0; i < data.length; i += S) out.push(Array.from(data.slice(i, i + S)));
  return out;
};

test('the coast is resampled to evenly spaced corners, counter-clockwise', () => {
  const R = F.floatResample(COAST, 40);
  assert.equal(R.length, 40);
  let area = 0;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++) area += (R[j][0] - R[i][0]) * (R[j][1] + R[i][1]);
  assert.ok(area > 0, 'counter-clockwise');
  const L = R.map((p, i) => Math.hypot(R[(i + 1) % 40][0] - p[0], R[(i + 1) % 40][1] - p[1]));
  assert.ok(Math.max(...L) / Math.min(...L) < 2.2, 'about even');
});

test('the rock hangs under the coast to one lowest point, as deep as about 0.6 of the island across', () => {
  const M = F.floatIslandMesh(COAST, TOP, { rocks: 0 });
  assert.equal(M.data.length % (S * 3), 0, 'whole triangles');
  const C = corners(M.data),
    hs = C.map(c => c[1]);
  assert.ok(Math.max(...hs) <= TOP + 1e-6, 'nothing above the coast');
  assert.ok(Math.abs(TOP - Math.min(...hs) - M.depth) < 1e-6, 'the point is the depth down');
  assert.ok(M.depth > M.r * 1.0 && M.depth < M.r * 1.6);
  assert.ok(Math.abs(M.c[0] - 0.02) < 0.01 && Math.abs(M.c[1] + 0.01) < 0.01, 'its middle');
});

test('every side face looks outward or down, the cap looks up, and normals are unit long', () => {
  const M = F.floatIslandMesh(COAST, TOP, { rocks: 0 });
  const C = corners(M.data);
  let caps = 0;
  for (let i = 0; i < C.length; i += 3) {
    const [a, b, q] = [C[i], C[i + 1], C[i + 2]],
      n = a.slice(3, 6),
      band = a[6];
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5);
    if (band < 0) {
      caps++;
      assert.ok(n[1] > 0.99, 'the cap faces up');
      continue;
    }
    // GPU space: x, h, -y; outward from the axis through the middle
    const m = [(a[0] + b[0] + q[0]) / 3 - M.c[0], (a[2] + b[2] + q[2]) / 3 + M.c[1]];
    assert.ok(n[0] * m[0] + n[2] * m[1] - n[1] * 0.3 >= -1e-9, 'outward or down');
  }
  assert.equal(caps, F.FLOAT_ISLAND.corners);
});

test('a few small rocks float round it, outside the coast, below the land, each with its own drift', () => {
  const M = F.floatIslandMesh(COAST, TOP);
  const C = corners(M.data),
    rocks = new Map();
  for (const c of C) if (c[7] > 0) (rocks.get(c[7]) || rocks.set(c[7], []).get(c[7])).push(c);
  assert.equal(rocks.size, F.FLOAT_ISLAND.rocks);
  for (const pts of rocks.values()) {
    const x = pts.reduce((s, c) => s + c[0], 0) / pts.length,
      y = -pts.reduce((s, c) => s + c[2], 0) / pts.length;
    assert.ok(Math.hypot(x - M.c[0], y - M.c[1]) > M.r * 1.2, 'outside the island');
    assert.ok(Math.max(...pts.map(c => c[1])) < TOP, 'below the land');
  }
});

test('the same coast and seed make the same island', () => {
  assert.deepEqual(F.floatIslandMesh(COAST, TOP, { seed: 3 }).data, F.floatIslandMesh(COAST, TOP, { seed: 3 }).data);
  assert.notDeepEqual(F.floatIslandMesh(COAST, TOP, { seed: 3 }).data, F.floatIslandMesh(COAST, TOP, { seed: 4 }).data);
});

test('lift raises every corner by the height under it (the water’s curve the coast sits on)', () => {
  const flat = F.floatIslandMesh(COAST, TOP, { rocks: 0 }).data,
    up = F.floatIslandMesh(COAST, TOP, { rocks: 0, lift: (x, y) => 0.01 + x * 0.1 - y * 0.05 }).data;
  for (let i = 0; i < flat.length; i += S) {
    const x = up[i],
      y = -up[i + 2];
    assert.ok(Math.abs(up[i + 1] - flat[i + 1] - (0.01 + x * 0.1 - y * 0.05)) < 1e-6);
  }
});

test('the fine ground: the land’s heights inside the coast, under the water outside, squares only over the land', () => {
  const poly = new Float64Array(COAST.flat()),
    M = F.floatGroundMesh(poly, (x, y) => 0.01 + x * 0.05, () => 0, 0.002);
  assert.equal(M.I.length % 6, 0);
  assert.ok(M.I.length > 0);
  // a point well inside reads the land's height (as drawn: flat within a square here, the slope is linear)
  const h = F.floatGroundHeight(M, 0.02, -0.01);
  assert.ok(Math.abs(h - (0.01 + 0.02 * 0.05)) < 1e-6);
  // far outside: nothing, and every corner outside the coast is under the water's line
  assert.equal(F.floatGroundHeight(M, 1, 1), null);
  for (let q = 0; q < M.h.length; q++) {
    const x = M.V[q * 3],
      y = -M.V[q * 3 + 2];
    if (!F.floatInside(poly, x, y)) assert.ok(M.h[q] < 0);
  }
  assert.ok(F.floatInside(poly, 0.02, -0.01) && !F.floatInside(poly, 0.5, 0));
});
