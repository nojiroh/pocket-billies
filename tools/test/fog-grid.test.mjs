// Air track AIR-2: the low fog's density grid (game/js/logic/fog-grid.js). A hollow fills, a hilltop stays clear,
// there is no fog indoors; water and fog weather thicken it; a step of one cell refills one slab, and the rolled grid
// holds what a grid built there from nothing holds. Plain numbers, no graphics.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  FOG_EDGE,
  FOG_GRID_SIZES,
  FOG_MARCH_STEPS,
  fogAmount,
  fogColumn,
  fogDensityAt,
  fogGridAt,
  fogGridBox,
  fogGridBuild,
  fogGridInside,
  fogGridMake,
  fogGridOrigin,
  fogGridRoll,
  fogMarchOn,
  fogRayBox,
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

// AIR-3: the light-in-air march reads the grid

test('the march gate: the fog has its own (no shadow map or shaft dial in it); off in battles, at quality 3, dial 0', () => {
  const on = { grid: true, battle: false, qe: 0, k: 1 };
  assert.equal(fogMarchOn(on), true);
  assert.equal(fogMarchOn({ ...on, qe: 2 }), true, 'quality step 2 keeps it');
  assert.equal(fogMarchOn({ ...on, qe: 3 }), false, 'quality step 3 drops it (fogit takes over)');
  assert.equal(fogMarchOn({ ...on, grid: false }), false, 'no grid (indoors, rooms, caves): fogit');
  assert.equal(fogMarchOn({ ...on, battle: true }), false, 'battles and director frames: fogit');
  assert.equal(fogMarchOn({ ...on, k: 0 }), false, 'Fog in the air at 0: fogit');
  assert.deepEqual(FOG_MARCH_STEPS, { full: 14, phone: 10 });
});

test('the box: the grid in world metres, its square round the player', () => {
  const G = fogGridMake(32, 8, 32);
  fogGridBuild(G, inputs(), fogGridOrigin(G, 10.4, -5.2, 2, 3));
  const B = fogGridBox(G);
  assert.deepEqual([B.x0, B.y0, B.z0, B.x1, B.y1, B.z1], [-6, -1, -22, 26, 7, 10]);
  assert.deepEqual([B.cx, B.cz, B.r], [10, -6, 16]);
  assert.equal(fogGridInside(B, B.cx, B.cz), 1, 'all the march inside');
  assert.equal(fogGridInside(B, B.cx + B.r * FOG_EDGE[0], B.cz), 1);
  assert.equal(fogGridInside(B, B.cx, B.cz - B.r * FOG_EDGE[1]), 0, "all fogit's past the edge");
  const mid = fogGridInside(B, B.cx + B.r * ((FOG_EDGE[0] + FOG_EDGE[1]) / 2), B.cz);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'half and half midway: the march and the mist add to one');
});

test('the ray and the box: from above, through, missing, clipped by the surface, along an axis', () => {
  const B = { x0: 0, y0: 0, z0: 0, x1: 10, y1: 4, z1: 10 },
    n = v => {
      const l = Math.hypot(...v);
      return v.map(a => a / l);
    };
  const down = fogRayBox(B, [5, 24, 5], [0, -1, 0], 100);
  assert.deepEqual(down, [20, 24]);
  assert.deepEqual(fogRayBox(B, [5, 24, 5], [0, -1, 0], 22), [20, 22], 'stops at the surface');
  assert.equal(fogRayBox(B, [5, 24, 5], [0, 1, 0], 100), null, 'looking up: misses');
  assert.equal(fogRayBox(B, [-5, 2, 5], [0, 0, 1], 100), null, 'beside it along an axis: misses');
  const inside = fogRayBox(B, [5, 2, 5], [1, 0, 0], 100);
  assert.deepEqual(inside, [0, 5], 'from inside: from the eye');
  const slant = fogRayBox(B, [-10, 14, 5], n([1, -1, 0]), 100);
  assert.ok(slant && Math.abs(slant[0] - 10 * Math.SQRT2) < 1e-9 && Math.abs(slant[1] - 14 * Math.SQRT2) < 1e-9);
});

test('the shaders: the march reads the grid on its own gate; fogit steps aside inside the grid', () => {
  const read = f => readFileSync(new URL('../../game/js/' + f, import.meta.url), 'utf8');
  const post = read('engine/post-effects.js'),
    gl = read('engine/webgl.js'),
    walk = read('walk-view-gl.js');
  assert.match(post, /precision highp sampler3D;/, 'a 3D sampler has no default precision in GLSL ES 3.0');
  assert.match(post, /uniform sampler3D uFogT;/);
  assert.match(post, /curveY\(p\.xz\)/, 'the grid is read at flat heights');
  assert.match(post, /uFogC\.z\*\.7,uFogC\.z\*\.95/, 'the march fades out at FOG_EDGE');
  assert.match(gl, /uMistBox\.z\*\.7,uMistBox\.z\*\.95/, 'fogit fades in at FOG_EDGE');
  assert.deepEqual(FOG_EDGE, [0.7, 0.95]);
  assert.match(gl, /float m=uMist\*mo\*/, 'the low mist steps aside');
  assert.match(gl, /float v=mo\*uValley\.y\*/, 'the valley mist too');
  assert.match(post, /if \(sh \|\| FG\)/, 'the march runs for the fog alone (no shadow map, shafts at 0)');
  assert.match(walk, /if \(fogBox\) X\.mistBox =/, 'the mist steps aside only when the march reads the grid');
  assert.match(walk, /fog: fogOn\n/, 'and the march gets the grid only then');
});
