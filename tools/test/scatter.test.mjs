// Assets track AS-0: natural placement (game/js/logic/scatter.js). Poisson-disc points keep their spacing and leave
// no gap another would fit in, follow a spacing that changes over the area and a mask; clumps keep their gap and sit
// closer together than an even spread of the same count; layers keep clear of the ones before and pick kinds by
// weight. Every result is the same for the same seed. Plain numbers, no graphics.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  scatterClusters,
  scatterFlora,
  scatterLayers,
  scatterPick,
  scatterPoisson,
} from '../../game/js/logic/scatter.js';

const nearest = (pts, x, z, skip) => {
  let b = Infinity;
  for (const q of pts) {
    if (q === skip) continue;
    b = Math.min(b, Math.hypot(q.x - x, q.z - z));
  }
  return b;
};
const meanNearest = pts => pts.reduce((s, p) => s + nearest(pts, p.x, p.z, p), 0) / pts.length;

test('the same seed makes the same points, another salt others', () => {
  const a = scatterPoisson({ w: 30, h: 20, r: 1.5, seed: 'copperleaf', salt: 'forest' });
  const b = scatterPoisson({ w: 30, h: 20, r: 1.5, seed: 'copperleaf', salt: 'forest' });
  const c = scatterPoisson({ w: 30, h: 20, r: 1.5, seed: 'copperleaf', salt: 'meadow' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('Poisson points keep their spacing, stay inside and leave no gap of twice the spacing', () => {
  const r = 2,
    P = scatterPoisson({ x0: -20, z0: 10, w: 40, h: 30, r, seed: 7 });
  for (const p of P) {
    assert.ok(p.x >= -20 && p.x < 20 && p.z >= 10 && p.z < 40, 'inside the area');
    assert.ok(nearest(P, p.x, p.z, p) >= r - 1e-9, 'no two closer than r');
  }
  /* maximal: every spot at least 2r from the area's edge has a point within 2r */
  for (let z = 10 + 2 * r; z <= 40 - 2 * r; z += 0.7)
    for (let x = -20 + 2 * r; x <= 20 - 2 * r; x += 0.7) assert.ok(nearest(P, x, z) < 2 * r, `a gap at ${x},${z}`);
  /* a Poisson-disc fill holds about 0.55-0.75 points per r² */
  const per = P.length / ((40 * 30) / (r * r));
  assert.ok(per > 0.5 && per < 0.8, `density ${per}`);
});

test('a spacing that changes over the area thins the points where it is wide', () => {
  const P = scatterPoisson({ w: 60, h: 20, rMin: 1, rMax: 4, radiusAt: x => 1 + (3 * x) / 60, seed: 3 });
  const left = P.filter(p => p.x < 20).length,
    right = P.filter(p => p.x >= 40).length;
  assert.ok(left > right * 3, `${left} on the dense side, ${right} on the wide side`);
  for (const p of P) assert.ok(nearest(P, p.x, p.z, p) >= Math.min(p.r, 4) - 1e-9);
});

test('a mask keeps points to its spots, even in separate patches', () => {
  const inPatch = (x, z) => Math.hypot(x - 8, z - 8) < 5 || Math.hypot(x - 42, z - 30) < 5;
  const P = scatterPoisson({ w: 50, h: 40, r: 1.2, keep: inPatch, seed: 11 });
  assert.ok(P.every(p => inPatch(p.x, p.z)));
  assert.ok(P.some(p => p.x < 20) && P.some(p => p.x > 30), 'both patches filled');
});

test('points keep clear of ones already placed, and stop at max', () => {
  const avoid = [{ x: 10, z: 10, r: 4 }];
  const P = scatterPoisson({ w: 20, h: 20, r: 1, avoid, seed: 5 });
  assert.ok(P.every(p => Math.hypot(p.x - 10, p.z - 10) >= 4 - 1e-9));
  assert.equal(scatterPoisson({ w: 20, h: 20, r: 1, max: 17, seed: 5 }).length, 17);
});

test('clumps keep their gap and sit closer than an even spread of the same count', () => {
  const C = scatterClusters({ w: 80, h: 80, apart: 16, spread: 2.2, size: [4, 9], gap: 0.9, seed: 'grove' });
  for (const p of C) assert.ok(nearest(C, p.x, p.z, p) >= 0.9 - 1e-9);
  assert.ok(new Set(C.map(p => p.clump)).size >= 10, 'many clumps');
  const even = scatterPoisson({ w: 80, h: 80, r: 2.5, max: C.length, seed: 'grove' });
  assert.ok(meanNearest(C) < meanNearest(even) * 0.75, 'clumped, not even');
});

test('a kind is picked by weight; nothing from an empty or weightless list', () => {
  const L = [
    { id: 'oak', w: 3 },
    { id: 'birch', w: 1 },
    { id: 'never', w: 0 },
  ];
  const n = { oak: 0, birch: 0, never: 0 };
  for (let i = 0; i < 4000; i++) n[scatterPick(L, i / 4000)]++;
  assert.equal(n.never, 0);
  assert.equal(n.oak, 3000);
  assert.equal(n.birch, 1000);
  assert.equal(scatterPick([], 0.5), null);
  assert.equal(scatterPick([{ id: 'x', w: 0 }], 0.5), null);
});

test('layers keep clear of the trunks before them and take their own kinds', () => {
  const pts = scatterLayers({
    w: 40,
    h: 40,
    seed: 'meadow',
    layers: [
      { name: 'canopy', r: 6, clear: 1.6, kinds: [{ id: 'tree_oak', w: 1 }] },
      {
        name: 'shrub',
        clumps: { apart: 9, spread: 1.5, size: [2, 5], gap: 0.8 },
        clear: 0.6,
        kinds: [{ id: 'bush_round', w: 1 }],
      },
      {
        name: 'ground',
        r: 0.7,
        kinds: [
          { id: 'flower_a', w: 2 },
          { id: 'fern', w: 1 },
        ],
      },
    ],
  });
  const trees = pts.filter(p => p.layer === 'canopy'),
    shrubs = pts.filter(p => p.layer === 'shrub'),
    ground = pts.filter(p => p.layer === 'ground');
  assert.ok(trees.length > 10 && shrubs.length > 10 && ground.length > 100);
  assert.ok(trees.every(p => p.id === 'tree_oak') && shrubs.every(p => p.id === 'bush_round'));
  assert.ok(ground.every(p => p.id === 'flower_a' || p.id === 'fern'));
  for (const s of shrubs) assert.ok(nearest(trees, s.x, s.z) >= 1.6 - 1e-9, 'a shrub on a trunk');
  for (const g of ground) {
    assert.ok(nearest(trees, g.x, g.z) >= 1.6 - 1e-9, 'a flower on a trunk');
    assert.ok(nearest(shrubs, g.x, g.z) >= 0.6 - 1e-9, 'a flower in a shrub');
  }
});

test('scatterFlora grows a biome its own kinds, layer by layer, thinner where the density is low', () => {
  const biome = {
    trees: { tree_oak: 2, tree_birch: 1 },
    shrubs: { bush_round: 1 },
    plants: { clover: 1 },
    flora: [
      { layer: 'trees', from: 'trees', clear: 1.4, r: [3, 9] },
      { layer: 'shrubs', from: 'shrubs', clear: 0.7, clumps: { apart: 8, spread: 1.4, size: [2, 5], gap: 0.9 } },
      { layer: 'plants', from: 'plants', clumps: { apart: 4, spread: 1, size: [3, 8], gap: 0.5 } },
    ],
  };
  /* a forest on the west half, thinning to nothing at x = 60 */
  const density = (_layer, x) => Math.max(0, 1 - x / 60);
  const pts = scatterFlora(biome, { w: 80, h: 40, seed: 'flora', density });
  const by = l => pts.filter(p => p.layer === l);
  assert.ok(by('trees').every(p => p.id === 'tree_oak' || p.id === 'tree_birch'));
  assert.ok(by('shrubs').every(p => p.id === 'bush_round') && by('plants').every(p => p.id === 'clover'));
  /* each layer alone thins with the density (together, the ground cover gives way under the canopy) */
  for (const l of ['trees', 'shrubs', 'plants']) {
    const alone = scatterFlora(biome, { w: 80, h: 40, seed: 'flora', density, only: [l] });
    const west = alone.filter(p => p.x < 20).length,
      east = alone.filter(p => p.x >= 40).length;
    assert.ok(west > east * 2, `${l}: ${west} in the thick west, ${east} in the thin east`);
    assert.ok(
      alone.every(p => p.x < 60 && p.layer === l),
      `${l}: nothing where the density is 0`
    );
  }
  assert.deepEqual(scatterFlora(biome, { w: 80, h: 40, seed: 'flora', density }), pts);
  assert.deepEqual(scatterFlora({ trees: {} }, { w: 10, h: 10 }), [], 'no flora, nothing');
});
