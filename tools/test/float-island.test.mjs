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
    M = F.floatGroundMesh(
      poly,
      (x, y) => 0.01 + x * 0.05,
      () => 0,
      0.002
    );
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

// HB-3: the lagoon round the floating island and its falls
const POLY = new Float64Array(COAST.flat());
const ringOf = () => F.floatLagoonRing(POLY);

test('the lagoon’s ring: round the coast, everywhere outside it, about 1.3 times the island’s radius', () => {
  const { ring, c, r, lr } = ringOf();
  assert.equal(ring.length, F.FLOAT_LAGOON.corners * 2);
  for (let k = 0; k < ring.length; k += 2) assert.ok(!F.floatInside(POLY, ring[k], ring[k + 1]), 'outside the coast');
  // every coast point inside the ring, with room
  for (const [x, y] of COAST) assert.ok(F.floatInside(ring, x, y));
  assert.ok(lr > r * 1.2 && lr < r * 1.45, `ring ${lr / r} times the radius`);
  assert.ok(Math.abs(c[0] - 0.02) < 0.01 && Math.abs(c[1] + 0.01) < 0.01);
  // counter-clockwise
  let area = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2)
    area += (ring[j] - ring[i]) * (ring[j + 1] + ring[i + 1]);
  assert.ok(area > 0);
});

test('the ring never folds into a bay: a coast with a deep cove still gives a ring outside it', () => {
  const cove = Array.from({ length: 80 }, (_, i) => {
    const a = (i / 80) * Math.PI * 2,
      bay = Math.exp(-(((a - 1) / 0.25) ** 2)) * 0.6;
    return [Math.cos(a) * 0.08 * (1 - bay), Math.sin(a) * 0.08 * (1 - bay)];
  });
  const P = new Float64Array(cove.flat()),
    { ring } = F.floatLagoonRing(P);
  for (const [x, y] of cove) assert.ok(F.floatInside(ring, x, y), 'the cove inside the ring');
});

test('the lagoon’s depth: shallow off the beach, a basin, a shallow sill at the rim', () => {
  const K = F.FLOAT_LAGOON;
  assert.ok(Math.abs(F.floatLagoonDepth(0) - K.beach) < 1e-9);
  assert.ok(Math.abs(F.floatLagoonDepth(1) - K.sill) < 1e-9);
  assert.ok(F.floatLagoonDepth(0.5) > K.depth);
  assert.ok(F.floatLagoonDepth(0.5) > F.floatLagoonDepth(0.15) && F.floatLagoonDepth(0.5) > F.floatLagoonDepth(0.85));
});

test('the lagoon’s ground and water: land inside the coast, the bed under the water out to the ring, its rim faded', () => {
  const { ring } = ringOf(),
    water = () => 0,
    land = () => 0.002,
    bed = (x, y) => -F.floatLagoonDepth(F.floatLagoonAt(POLY, ring, x, y).t) / 1000,
    G = F.floatGroundMesh(POLY, land, water, 0.002, { ring, bedAt: bed });
  let lag = 0;
  for (let q = 0; q < G.h.length; q++) {
    if (G.inn[q] === 1) assert.ok(G.h[q] > 0, 'land above the water');
    if (G.inn[q] === 2) {
      lag++;
      assert.ok(G.h[q] < 0, 'the bed under it');
    }
  }
  assert.ok(lag > 0);
  const W = F.floatLagoonWater(G, ring, water, 0.005);
  assert.ok(W.I.length > 0 && W.I.length % 6 === 0);
  for (const q of W.I) {
    const x = W.V[q * 5],
      y = -W.V[q * 5 + 2];
    assert.ok(W.V[q * 5 + 1] <= 0, 'at the water’s line');
    if (F.floatInside(POLY, x, y)) continue;
    assert.ok(W.V[q * 5 + 3] > 0, 'deep where the bed is');
  }
  // faded at the ring, clear near the coast
  const near = W.V.filter((_, k) => k % 5 === 4);
  assert.ok(Math.max(...near) > 0.9 && Math.min(...near) === 0);
});

test('three falls where the rim comes nearest the coast, spread round, each pointing out', () => {
  const { ring, c } = ringOf(),
    S = F.floatFallSpots(ring, POLY, 3),
    m = ring.length / 2;
  assert.equal(S.length, 3);
  for (const f of S) {
    assert.ok(Math.abs(Math.hypot(f.dx, f.dy) - 1) < 1e-9);
    assert.ok((f.x - c[0]) * f.dx + (f.y - c[1]) * f.dy > 0, 'outward');
    for (const g of S) if (g !== f) assert.ok(Math.min(Math.abs(f.k - g.k), m - Math.abs(f.k - g.k)) >= m / 4);
  }
  assert.deepEqual(F.floatFallSpots(ring, POLY, 3), S, 'the same each time');
});

test('a fall’s sheet hangs from the lip down by its drop, moving out as it falls', () => {
  const f = { x: 0.1, y: 0, dx: 1, dy: 0 },
    M = F.floatFallMesh(f, 0.004, 0.003, 0.05);
  assert.ok(M.I.length > 0 && M.I.length % 6 === 0);
  const hs = [],
    outs = [];
  for (let q = 0; q < M.V.length; q += 5) {
    hs.push(M.V[q + 1]);
    outs.push([M.V[q + 4], M.V[q]]);
  }
  assert.ok(Math.abs(Math.max(...hs) - 0.004) < 1e-9 && Math.abs(Math.min(...hs) - (0.004 - 0.05)) < 1e-9);
  const top = outs.filter(o => o[0] === 0).map(o => o[1]),
    bottom = outs.filter(o => o[0] === 1).map(o => o[1]);
  assert.ok(Math.min(...bottom) > Math.max(...top), 'further out at the foot');
});

test('mist along the lagoon’s rim: just outside the ring, low over the water, the same each time', () => {
  const { ring, c, r } = ringOf(),
    M = F.floatMistPuffs(ring, c, r);
  assert.ok(M.length >= 40);
  for (const p of M) {
    assert.ok(!F.floatInside(ring, p.x, p.y), 'outside the ring');
    assert.ok(Math.abs(p.h) < r * 0.03 && p.s > r * 0.05 && p.s < r * 0.2);
  }
  assert.deepEqual(F.floatMistPuffs(ring, c, r), M);
});
