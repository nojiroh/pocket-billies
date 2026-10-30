// Buildings track BD-6: the landmarks (the Workshop, the Gene Bank, the lighthouse, the barn, Skyline Station), the
// windmill kit (tools/build-windmill-kit.py: nine designs times three colourways as the windmill kind's variants)
// and the bubble car. A rotor of many parts turns as one mesh, one draw (logic/spin-merge.js spinGroups, FL-2b).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../../game/js/logic/low-poly.js');
const { readGameData } = await import('../data-files.mjs');
const { spinGroups } = await import('../../game/js/logic/spin-merge.js');

const D = readGameData(),
  CAT = D.scenery.props,
  recipe = path => JSON.parse(readFileSync(join(ROOT, 'game/art', path), 'utf8')),
  still = rec => lowPolyFromRecipe({ ...rec, layers: rec.layers.filter(l => !l.spin) });

test('the landmarks: under the building budget, glass marked, a door inside the footprint, rotors one draw each', () => {
  for (const k of ['workshop', 'gene_bank', 'lighthouse', 'barn', 'train_station']) {
    const M = CAT[k],
      rec = recipe(M.model),
      m = still(rec),
      G = spinGroups(rec.layers);
    assert.ok(m.tris < 10000, `${k}: ${m.tris} triangles`);
    assert.ok(m.wins.length >= 1, `${k}: glass`);
    assert.ok(G.length <= 3, `${k}: ${G.length} turning meshes`);
    if (M.door) assert.ok(Math.abs(M.door.x / D.scenery.ppu) < M.box[0] / 2, `${k}: door ${M.door.x}`);
  }
  // the station's footprint and depth stay (station-place.mjs reads box[1]; the rail runs behind the platform)
  assert.deepEqual(CAT.train_station.box, [12.6, 6.6]);
  assert.equal(spinGroups(recipe(CAT.gene_bank.model).layers).length, 1, 'the helix turns as one');
});

test('the windmill kit: nine designs times three colourways, each rotor one turning mesh', () => {
  const M = CAT.windmill,
    looks = [M, ...M.variants];
  assert.equal(looks.length, 27);
  const models = new Set(looks.map(V => V.model || M.model));
  assert.equal(models.size, 9);
  const seen = new Set();
  for (const V of looks) {
    const key = V.kit.design + '/' + V.kit.colours;
    assert.ok(!seen.has(key), key);
    seen.add(key);
    assert.ok(V.img && V.name, key);
  }
  for (const path of models) {
    const rec = recipe(path),
      m = still(rec),
      G = spinGroups(rec.layers),
      cols = new Set(rec.layers.map(l => (l.col || '').toUpperCase()));
    assert.ok(m.tris < 6000, `${path}: ${m.tris} triangles`);
    assert.ok(G.length >= 1 && G.length <= 2, `${path}: ${G.length} turning meshes`);
    assert.ok(rec.warp && rec.warp.lean, `${path}: the storybook lean`);
    // every colourway's swap finds its colours in the model
    for (const V of looks.filter(V => (V.model || M.model) === path && V.swap))
      for (const c of Object.keys(V.swap)) assert.ok(cols.has(c.toUpperCase()), `${path}: ${c} for ${V.name}`);
  }
  assert.deepEqual(M.box, [3.6, 3.6]);
});

test('the bubble car: three colour looks, a hover glow under it, it bobs', () => {
  const M = CAT.bubble_car,
    rec = recipe(M.model);
  assert.equal(M.variants.length, 2);
  assert.ok(M.bob > 0);
  assert.ok(still(rec).tris < 4000);
  const glows = rec.layers.filter(l => l.glow && l.z < 0.3);
  assert.ok(glows.length >= 1, 'a glow under it');
  for (const V of M.variants)
    for (const c of Object.keys(V.swap))
      assert.ok(
        rec.layers.some(l => l.col === c),
        c
      );
});
