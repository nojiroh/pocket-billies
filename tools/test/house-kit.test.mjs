// Buildings track BD-4a: the house kit (tools/build-house-kit.py). One catalogue kind, house_kit, whose variants are
// about two dozen houses put together from modules. No two share body + roof + palette; each builds within the owner's
// 6,000 triangles, leans 3-5 degrees by its own height (look B), marks its glass and roof, carries a retro-future touch
// and some nature, and fits the hub's largest house plot with its door on the front.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

await import('./walk-renderer.mjs');
const { lowPolyFromRecipe } = await import('../../game/js/prop-models.js');
const S = JSON.parse(fs.readFileSync(new URL('../../game/data/scenery.json', import.meta.url), 'utf8'));
const K = S.props.house_kit,
  PPU = S.ppu || 34,
  ROWS = [K, ...K.variants],
  RETRO = [
    'antenna tip',
    'finial ball',
    'satellite dish',
    'solar sail',
    'wind spinner',
    'bubble greenhouse',
    'pneumatic tube',
    'starburst lamp',
    'rocket chimney',
  ],
  NATURE = ['flower box', 'ivy', 'hanging basket', 'roof moss', 'shrub', 'roof garden'],
  read = m => JSON.parse(fs.readFileSync(new URL(`../../game/art/${m}`, import.meta.url), 'utf8')),
  HOUSES = ROWS.map(row => ({ row, rec: read(row.model) })).map(h => ({ ...h, mesh: lowPolyFromRecipe(h.rec) }));

test('the kit: about two dozen houses, every body and roof in use, 8-10 palettes, two showpieces', () => {
  assert.ok(ROWS.length >= 20 && ROWS.length <= 30, `${ROWS.length} houses`);
  const of = f => new Set(ROWS.map(r => r.kit[f]));
  assert.equal(of('body').size, 9, 'bodies');
  assert.equal(of('roof').size, 10, 'roofs');
  assert.ok(of('palette').size >= 8 && of('palette').size <= 10, 'palettes');
  assert.equal(HOUSES.filter(h => h.rec.kit.show).length, 2, 'showpieces');
  assert.equal(new Set(ROWS.map(r => r.model)).size, ROWS.length, 'each its own model');
});

test('no two houses share body + roof + palette', () => {
  const keys = ROWS.map(r => `${r.kit.body}+${r.kit.roof}+${r.kit.palette}`);
  assert.equal(new Set(keys).size, keys.length, keys.join(' '));
  for (const { row, rec } of HOUSES)
    assert.deepEqual([row.kit.body, row.kit.roof, row.kit.palette], [rec.kit.body, rec.kit.roof, rec.kit.palette]);
});

test('each house builds within 6,000 triangles and leans 3-5 degrees by its own height', () => {
  for (const { row, rec, mesh } of HOUSES) {
    assert.ok(mesh.tris > 0 && mesh.tris <= 6000, `${row.name}: ${mesh.tris} triangles`);
    const deg = (Math.atan(Math.hypot(...rec.warp.lean) / mesh.warpFrame.H) * 180) / Math.PI;
    assert.ok(deg >= 3 && deg <= 5, `${row.name}: leans ${deg.toFixed(2)} degrees`);
  }
});

test('glass and roof are marked by the kit: windows light, placements can restyle the roof', () => {
  for (const { row, rec, mesh } of HOUSES) {
    assert.ok(mesh.wins.length >= 2, `${row.name}: ${mesh.wins.length} windows`);
    const ids = rec.layers.filter(l => l.glass).map(l => l.glass);
    assert.equal(new Set(ids).size, ids.length, `${row.name}: glass ids repeat`);
    assert.ok(Math.max(...ids) <= 30, `${row.name}: glass ids past the vertex flag's room`);
    assert.ok(
      rec.layers.some(l => l.roof === 1),
      `${row.name}: no roof part marked`
    );
    assert.ok(
      row.fx.some(e => e.k === 'window'),
      `${row.name}: no window fx`
    );
  }
});

test('every house has a retro-future touch, one rooftop ornament at most, and a nature pass', () => {
  for (const { row, rec } of HOUSES) {
    const names = rec.layers.map(l => l.name || '');
    assert.ok(
      RETRO.some(n => names.includes(n)),
      `${row.name}: no retro-future part`
    );
    assert.ok(
      NATURE.some(n => names.includes(n)),
      `${row.name}: no nature`
    );
    const orn = rec.kit.addons.filter(a =>
      ['antenna', 'weathervane', 'finial', 'dish', 'solar_sail', 'water_tower'].includes(a)
    );
    assert.ok(orn.length <= 1, `${row.name}: ornaments ${orn}`);
    assert.ok(
      rec.kit.addons.filter(a => a !== 'antenna').length <= (rec.kit.show ? 6 : 3),
      `${row.name}: add-ons ${rec.kit.addons}`
    );
    assert.ok(row.garden.trees.length >= 1 && row.garden.trees.every(t => S.props[t.k]), `${row.name}: garden trees`);
    assert.ok(
      row.garden.bushes.every(t => S.props[t.k]),
      `${row.name}: garden bushes`
    );
  }
});

test('each footprint fits the largest house plot (4.6 x 3.44 m) and its door is on the front, inside it', () => {
  const sizes = new Set();
  for (const { row } of HOUSES) {
    const [w, d] = row.box;
    assert.ok(w <= 4.6 && d <= 3.44, `${row.name}: box ${w} x ${d}`);
    assert.ok(Math.abs(row.door.x / PPU) < w / 2 - 0.3, `${row.name}: the door at ${row.door.x / PPU} m`);
    sizes.add(row.kit.size);
  }
  assert.deepEqual([...sizes].sort(), ['large', 'medium', 'small']);
});
