// alpha 0.4: props made of shapes are low-poly models painted with the 32 px textures (game/js/prop-models.js), and
// voxels one to a pixel (32 to the metre) when "Props as low-poly" is switched off; each within a budget a phone can
// carry. (TC-3: was the budget half of the full check's low-poly props step, tools/check-quick.py, where it took about
// five minutes; the step keeps the every-prop scene drawing them as models.)
// The step's old budget was one total over every recipe (15,000 triangles, 40,000 voxel quads), set when only small
// props had recipes; with the buildings and the city's towers on recipes the total is about 138,000 triangles, so the
// budget is per prop now: a building 10,000 triangles, any other prop 4,000 (the largest today: 8,573 and 3,798).
// Voxels are built for a sample (Copperleaf's first eight props by name): building all 160 takes six minutes here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe, propModelState } = await import('../../game/js/prop-models.js');
const { readGameData } = await import('../data-files.mjs');
const { ENGINE_DEFAULTS } = await import('../../game/js/engine/settings.js');
/* not exported: the test globals (walk-renderer.mjs asks for them) */
const { voxelise, greedyVoxelMesh } = /** @type {any} */ (globalThis);

const D = readGameData(),
  CAT = D.scenery.props,
  RECIPES = Object.entries(CAT)
    .filter(([, M]) => typeof M.model === 'string')
    .map(([k, M]) => ({ k, M, rec: JSON.parse(readFileSync(join(ROOT, 'game/art', M.model), 'utf8')) }))
    .filter(({ rec }) => rec.kind !== 'mesh'),
  /* a recipe of picture layers alone is drawn as cut-out cards (prop-models.js propModelImageItems), on purpose: a
     bush reads better flat. Only the shapes become a model */
  SHAPED = RECIPES.filter(({ rec }) => (rec.layers || []).some(l => l.k !== 'img' && !l.hide)),
  isBuilding = M => !!(M.build || M.door);

test('every recipe of shapes builds a low-poly model', () => {
  assert.ok(SHAPED.length > 100, `${SHAPED.length} recipes of shapes`);
  const none = SHAPED.filter(({ rec }) => !(lowPolyFromRecipe(rec) || { tris: 0 }).tris).map(({ k }) => k);
  assert.deepEqual(none, []);
});

test('each low-poly model within a phone’s budget: a building 10,000 triangles, any other prop 4,000', () => {
  const over = SHAPED.map(({ k, M, rec }) => [k, lowPolyFromRecipe(rec).tris, isBuilding(M) ? 10000 : 4000])
    .filter(([, tris, most]) => tris > most)
    .map(([k, tris, most]) => `${k}: ${tris} (${most})`);
  assert.deepEqual(over, []);
});

test('props are low-poly by default, voxels 32 to the metre', () => {
  assert.equal(propModelState.VPM, 32);
  /* the game data's engine defaults over the code's (engine/settings.js) */
  const world = ((D.engine || {}).defaults || {}).world || {};
  assert.equal(world.voxelLowPoly ?? ENGINE_DEFAULTS.world.voxelLowPoly, true);
});

test('as voxels one to a pixel, Copperleaf’s props build within 50,000 quads each', () => {
  const placed = new Set(D.maps.copperleaf.props.map(p => p.k)),
    sample = SHAPED.filter(({ k, M }) => placed.has(k) && !isBuilding(M))
      .sort((a, b) => (a.k < b.k ? -1 : 1))
      .slice(0, 8);
  assert.equal(sample.length, 8);
  for (const { k, rec } of sample) {
    const V = greedyVoxelMesh(voxelise(rec, 32), 32);
    assert.ok(V && V.quads > 0, `${k}: no voxels`);
    assert.ok(V.quads <= 50000, `${k}: ${V.quads} quads`);
  }
});

test('a building with picture windows has its glass marked: each window lights from its own glass', () => {
  /* the picture's window glows (scenery fx) are drawn by the glass instead (walk/effects.js skips them, it.wins) */
  const unmarked = SHAPED.filter(({ M, rec }) => (M.fx || []).some(e => e.k === 'window') && lowPolyFromRecipe(rec))
    .filter(({ rec }) => !lowPolyFromRecipe(rec).wins.length)
    .map(({ k }) => k);
  assert.deepEqual(unmarked, []);
});

test('window glass: its vertices carry the window (2-32), each window its middle and an outward look', () => {
  const rec = {
      layers: [
        { k: 'box', x: 0, y: 1, z: 0, w: 3, d: 2, h: 2, col: '#ffffff', name: 'walls' },
        { k: 'box', x: -0.8, y: -0.02, z: 1, w: 0.8, d: 0.04, h: 0.6, col: '#7EB8D4', glass: 1 },
        { k: 'box', x: 1.52, y: 1, z: 1, w: 0.03, d: 0.7, h: 0.6, col: '#7EB8D4', glass: 2 },
      ],
    },
    M = lowPolyFromRecipe(rec),
    u8 = new Uint8Array(M.vb),
    kinds = new Set();
  for (let o = 18; o < u8.length; o += 24) kinds.add(u8[o]);
  assert.deepEqual([...kinds].sort(), [0, 2, 3]);
  const [front, side] = M.wins;
  assert.equal(front.id, 1);
  assert.deepEqual(front.n, [0, 0, -1]);
  assert.ok(Math.abs(front.p[0] + 0.8) < 1e-6 && Math.abs(front.p[1] - 1.3) < 1e-6);
  assert.equal(side.id, 2);
  assert.deepEqual(side.n, [1, 0, 0]);
});
