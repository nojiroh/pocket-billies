// Phase 10, the look, session 1: the sea (game/js/logic/bowl.js). About 40% of the bowl is water, an inland sea with
// bays; every place's whole walk map and every road stays on land; water lies on the bowl's curve.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { GAME_DATA } from './setup-real.mjs';
import {
  BOWL_SEA_DEPTH,
  bowlCoastAt,
  bowlGridHeight,
  bowlGroundGrid,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSpotOf,
  bowlWaterLevel,
  bowlXY,
} from '../../game/js/logic/bowl.js';

const { locations, maps } = GAME_DATA;
const byId = id => locations.find(l => l.id === id);
const roads = GAME_DATA.roads
  .map(l => PB_DATA.road(GAME_DATA, l))
  .filter(r => r.kind === 'seam')
  .map(r => [r.a, r.b]);
const S = bowlSeaInput(locations, roads, l => maps[l.mapId] || null);
const N = 320;
const G = bowlGroundGrid(bowlReliefFeatures(locations), N, S);
const at = l => {
  const s = bowlSpotOf(l, byId);
  return { xy: bowlXY(s.a, s.r), under: s.under };
};

test('about 40% of the bowl is sea', () => {
  let sea = 0,
    all = 0;
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = -1 + (2 * i) / N,
        y = -1 + (2 * j) / N;
      if (x * x + y * y > 1) continue;
      all++;
      if (G.c[j * (N + 1) + i] > 0) sea++;
    }
  const share = sea / all;
  assert.ok(share > 0.35 && share < 0.45, `sea ${(share * 100).toFixed(1)}%`);
});

test("every place's whole walk map is on land", () => {
  for (const l of locations) {
    const { xy, under } = at(l),
      M = maps[l.mapId];
    if (under || !M) continue;
    const r = Math.hypot(xy[0], xy[1]),
      north = r < 1e-6 ? [0, 1] : [-xy[0] / r, -xy[1] / r],
      east = [north[1], -north[0]];
    for (let u = 0; u <= 10; u++)
      for (let v = 0; v <= 10; v++) {
        const mx = ((u / 10 - 0.5) * M.w) / 1000,
          mz = ((v / 10 - 0.5) * M.h) / 1000,
          x = xy[0] + east[0] * mx + north[0] * mz,
          y = xy[1] + east[1] * mx + north[1] * mz;
        if (x * x + y * y > 1) continue;
        assert.ok(bowlCoastAt(G, x, y) <= 0, `${l.id}: its map's square ${u},${v} is under water`);
      }
  }
});

test('every road is on land', () => {
  for (const [a, b] of roads) {
    const A = at(locations[a]),
      B = at(locations[b]);
    if (A.under || B.under) continue;
    for (let k = 0; k <= 60; k++) {
      const t = k / 60,
        x = A.xy[0] + (B.xy[0] - A.xy[0]) * t,
        y = A.xy[1] + (B.xy[1] - A.xy[1]) * t;
      assert.ok(bowlCoastAt(G, x, y) <= 0, `${locations[a].id} to ${locations[b].id} crosses water at ${t}`);
    }
  }
});

test('water lies on the curve: the land above it, the sea floor below it, never deeper than the limit', () => {
  for (let k = 0; k < 3000; k++) {
    const x = Math.sin(k * 12.9898) * 0.97,
      y = Math.cos(k * 78.233) * 0.97;
    if (x * x + y * y > 0.94) continue;
    const c = bowlCoastAt(G, x, y),
      d = bowlGridHeight(G, x, y) - bowlWaterLevel(x, y);
    if (c > 0.01) {
      assert.ok(d < 0, `the sea floor at ${x},${y} is above the water`);
      assert.ok(d > -BOWL_SEA_DEPTH - 0.02, `the sea at ${x},${y} is too deep`);
    }
  }
});

test('without a sea the ground has no coast', () => {
  const plain = bowlGroundGrid(bowlReliefFeatures(locations), 40);
  assert.equal(plain.c, undefined);
  assert.equal(bowlCoastAt(plain, 0.3, 0.2), -1);
});

// session 5: the sea's settings from worldmap.json (the Studio edits them), and the land and sea brush
const seaShare = g => {
  let s = 0,
    a = 0;
  for (let j = 0; j <= g.n; j++)
    for (let i = 0; i <= g.n; i++) {
      const x = -1 + (2 * i) / g.n,
        y = -1 + (2 * j) / g.n;
      if (x * x + y * y > 1) continue;
      a++;
      if (g.c[j * (g.n + 1) + i] > 0) s++;
    }
  return s / a;
};
/* IS-5: the hub's map has its island's coast, which the bowl draws exactly (IS-7); the seeded coast these tests try
   is for a place whose map has none (a run's), so here the hub's map is given without it. The game's own (gameSea)
   keeps it */
const plainMap = l => {
    const M = maps[l.mapId];
    return M ? { w: M.w, h: M.h } : null;
  },
  withSea = opt =>
    bowlGroundGrid(bowlReliefFeatures(locations), 160, bowlSeaInput(locations, roads, plainMap, 1000, opt)),
  gameSea = opt =>
    bowlGroundGrid(
      bowlReliefFeatures(locations),
      160,
      bowlSeaInput(locations, roads, l => maps[l.mapId] || null, 1000, opt)
    );
const landBodies = g => {
  const w = g.n + 1,
    seen = new Uint8Array(w * w),
    sizes = [];
  for (let k = 0; k < w * w; k++) {
    if (g.c[k] >= 0 || seen[k]) continue;
    let size = 0;
    const todo = [k];
    seen[k] = 1;
    while (todo.length) {
      const q = todo.pop(),
        i = q % w,
        j = (q - i) / w;
      size++;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + a,
          jj = j + b,
          z = jj * w + ii;
        if (ii < 0 || jj < 0 || ii > g.n || jj > g.n || seen[z] || g.c[z] >= 0) continue;
        seen[z] = 1;
        todo.push(z);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
};
const BASE = { share: 0.4, depth: 0.035, rimLand: 0.45, rough: 1, seed: 0, paint: [] };

test("the sea's settings: the share, another seed, the game's own file", () => {
  assert.ok(Math.abs(seaShare(withSea({ ...BASE, share: 0.3 })) - 0.3) < 0.02);
  const a = withSea(BASE),
    b = withSea({ ...BASE, seed: 7 });
  let moved = 0;
  for (let k = 0; k < a.c.length; k++) if (a.c[k] > 0 !== b.c[k] > 0) moved++;
  assert.ok(moved > 200, 'another seed moves the coast');
  assert.ok(GAME_DATA.worldmap && GAME_DATA.worldmap.sea, 'worldmap.json has the sea');
  /* RL-8b: the game's hub is Copperleaf's island alone (sea.island): mostly sea, one piece of land */
  const g = gameSea(GAME_DATA.worldmap.sea);
  assert.ok(GAME_DATA.worldmap.sea.island > 0, 'the hub is an island');
  /* IS-5: the hub's island is drawn at its own size from its coast (IS-7): about 1% of the bowl */
  assert.ok(seaShare(g) > 0.9 && seaShare(g) < 0.995, `the game’s island is a sensible size (${seaShare(g)})`);
  assert.equal(landBodies(g).length, 1, 'one island');
});

test('the brush makes land or sea where it paints, never over a place or a road', () => {
  /* a spot that is sea, and Copperleaf's middle (land, a place) */
  const base = withSea(BASE),
    n = base.n;
  let sx = 0,
    sy = 0;
  for (let k = 0; k < base.c.length; k++)
    if (base.c[k] > 0.05) {
      sx = -1 + (2 * (k % (n + 1))) / n;
      sy = -1 + (2 * Math.floor(k / (n + 1))) / n;
      if (sx * sx + sy * sy < 0.6) break;
    }
  const cl = at(byId('copperleaf')),
    g = withSea({
      ...BASE,
      paint: [
        { land: true, r: 0.04, pts: [[sx, sy]] },
        { land: false, r: 0.05, pts: [cl.xy] },
      ],
    });
  assert.ok(bowlCoastAt(base, sx, sy) > 0 && bowlCoastAt(g, sx, sy) < 0, 'painted land');
  assert.ok(bowlCoastAt(g, ...cl.xy) < 0, 'Copperleaf stays dry');
});

// RL-8b: an island world (sea.island, or sea.isles): the land is the places' ground and rounds of land, sea to the rim
const ISLAND = { ...BASE, rimLand: 0, rough: 0.8, island: 0.2 };

test('an island world: one island round the places, sea all the way to the rim', () => {
  const g = withSea(ISLAND),
    land = 1 - seaShare(g),
    bodies = landBodies(g),
    cl = at(byId('copperleaf'));
  assert.ok(land > 0.02 && land < 0.08, `land ${(land * 100).toFixed(1)}% of the bowl`);
  assert.equal(bodies.length, 1, `${bodies.length} pieces of land`);
  assert.ok(bowlCoastAt(g, ...cl.xy) < 0, 'Copperleaf is on it');
  for (let k = 0; k < 360; k += 5) {
    const a = (k * Math.PI) / 180;
    assert.ok(bowlCoastAt(g, Math.cos(a) * 0.9, Math.sin(a) * 0.9) > 0, `land near the rim at ${k}°`);
  }
});

test('an island world: the same settings make the same coast, another seed another', () => {
  const a = withSea(ISLAND),
    b = withSea(ISLAND),
    c = withSea({ ...ISLAND, seed: 5 });
  assert.deepEqual(a.c, b.c);
  let moved = 0;
  for (let k = 0; k < a.c.length; k++) if (a.c[k] > 0 !== c.c[k] > 0) moved++;
  assert.ok(moved > 30, `another seed moves the coast (${moved} corners)`);
});

test('an island world from rounds of land: land in each, the places on land, the rest sea', () => {
  const isles = [
      { x: 0.5, y: -0.1, r: 0.12 },
      { x: -0.5, y: 0.2, r: 0.1 },
    ],
    g = withSea({ ...BASE, rough: 0.5, isles });
  for (const b of isles) assert.ok(bowlCoastAt(g, b.x, b.y) < 0, `no land at ${b.x},${b.y}`);
  assert.ok(bowlCoastAt(g, ...at(byId('copperleaf')).xy) < 0, 'Copperleaf is on land');
  assert.ok(bowlCoastAt(g, 0, -0.6) > 0, 'sea between');
  assert.ok(landBodies(g).length >= 2, 'separate islands');
});
