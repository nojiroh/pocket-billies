// Air track AIR-2: the low fog's density grid (game/js/logic/fog-grid.js). A hollow fills, a hilltop stays clear,
// there is no fog indoors; water and fog weather thicken it; a step of one cell refills one slab, and the rolled grid
// holds what a grid built there from nothing holds. Plain numbers, no graphics.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FOG_GRID_SIZES,
  fogAmount,
  fogColumn,
  fogDensityAt,
  fogGridAt,
  fogGridBuild,
  fogGridMake,
  fogGridOrigin,
  fogGridRoll,
} from '../../game/js/logic/fog-grid.js';

/* a field of flat ground at 0 with a round hollow 3 m deep at (0, 0) and a round hill 6 m high at (30, 0) */
const bump = (x, z, cx, r) => {
  const d = Math.hypot(x - cx, z) / r;
  return d >= 1 ? 0 : (1 - d * d) * (1 - d * d);
};
const field = (x, z) => -3 * bump(x, z, 0, 5) + 6 * bump(x, z, 30, 6);
const inputs = (o = {}) => ({
  heightAt: field,
  water: null,
  mistH: 0.25,
  mist: 0.12,
  fog: 0,
  valley: null,
  indoor: false,
  drift: [0, 0],
  ...o,
});
/* the density a metre over the ground at (x, z), the mean of a few noise phases so one lucky phase can't pass */
function overGround(F, x, z, h = 1) {
  const [g, top] = fogColumn(F, x, z);
  let s = 0;
  for (let i = 0; i < 8; i++) s += fogDensityAt({ ...F, drift: [i * 3.1, i * 1.7] }, x, g + h, z, g, top);
  return s / 8;
}

test('a hollow fills with fog: thicker over its floor than over the flat ground round it', () => {
  const F = inputs({ fog: 0.4 }),
    hollow = overGround(F, 0, 0, 2.5),
    flat = overGround(F, 15, 15, 2.5);
  assert.ok(hollow > 0.3, `hollow ${hollow}`);
  assert.ok(hollow > flat * 2, `hollow ${hollow} vs flat ${flat}`);
});

test('a hilltop stays clear, even in fog weather', () => {
  for (const fog of [0, 0.5, 1]) {
    const top = overGround(inputs({ fog }), 30, 0, 1);
    assert.ok(top < 0.05, `fog ${fog}: hilltop ${top}`);
  }
});

test('no fog indoors, whatever the weather, the mist or a valley says', () => {
  const F = inputs({ indoor: true, fog: 1, mist: 1, valley: [2, 1], water: 0 });
  assert.equal(fogAmount(F), 0);
  assert.equal(overGround(F, 0, 0), 0);
  const G = fogGridMake(16, 6, 16);
  fogGridBuild(G, F, fogGridOrigin(G, 0, 0, 0, 3));
  assert.ok(G.data.every(v => v === 0));
});

test('fog weather and water thicken it; a valley fills below its level', () => {
  const calm = overGround(inputs(), 15, 15, 1.5),
    foggy = overGround(inputs({ fog: 1 }), 15, 15, 1.5),
    wet = overGround(inputs({ water: 1.5 }), 15, 15, 1.5);
  assert.ok(foggy > calm * 1.5, `fog ${foggy} vs calm ${calm}`);
  assert.ok(wet > calm * 1.5, `water ${wet} vs calm ${calm}`);
  const F = inputs({ mist: 0, valley: [1, 1] }),
    [g, top] = fogColumn(F, 15, 15);
  assert.ok(fogDensityAt(F, 15, g, 15, g, top) > 0.25);
  assert.ok(fogDensityAt(F, 15, 3, 15, g, top) < 0.01);
});

test('the grid sizes: 48 x 12 x 48 cells, 32 x 8 x 32 on phones', () => {
  assert.deepEqual(FOG_GRID_SIZES.full, [48, 12, 48]);
  assert.deepEqual(FOG_GRID_SIZES.phone, [32, 8, 32]);
});

test('a step of one cell refills one slab, and the rolled grid matches one built there', () => {
  const F = inputs({ fog: 0.6 }),
    [nx, ny, nz] = FOG_GRID_SIZES.phone,
    G = fogGridMake(nx, ny, nz);
  fogGridBuild(G, F, fogGridOrigin(G, 0, 0, 0, 3));
  const cols = G.cols,
    cells = G.cells,
    reads = G.reads;
  assert.ok(reads < nx * nz * 2.5, `the columns share their ring's heights: ${reads} read for ${nx * nz} columns`);
  assert.deepEqual(fogGridRoll(G, F, G.ox + 1, G.oz), [['x', G.ox + nx - 1]]);
  assert.equal(G.cols - cols, nz, 'one slab of columns measured');
  assert.ok(G.reads - reads <= nz + 16, `one strip of new heights read: ${G.reads - reads}`);
  assert.equal(G.cells - cells, ny * nz, 'one slab of cells filled');
  assert.deepEqual(fogGridRoll(G, F, G.ox - 1, G.oz - 2).length, 3, 'a diagonal: one x slab and two z slabs');
  assert.equal(fogGridRoll(G, F, G.ox + 40, G.oz), null, 'too far for slabs');
  const H = fogGridMake(nx, ny, nz);
  fogGridBuild(H, F, [G.ox, G.oy, G.oz]);
  for (let x = G.ox; x < G.ox + nx; x += 3)
    for (let z = G.oz; z < G.oz + nz; z += 3)
      for (let y = G.oy; y < G.oy + ny; y++)
        assert.equal(fogGridAt(G, x + 0.5, y + 0.5, z + 0.5), fogGridAt(H, x + 0.5, y + 0.5, z + 0.5));
  assert.equal(fogGridAt(G, (G.ox - 1) * G.cell, 0, 0), 0, 'outside the grid: none');
});
