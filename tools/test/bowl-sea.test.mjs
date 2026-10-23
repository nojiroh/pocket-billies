// Phase 10, the look, session 1: the sea (game/js/logic/bowl.js). Water lies on the bowl's curve, on the ground the
// game draws: the hub's island (worldmap.json sea) and a run's own land (logic/run-bowl.js); the sea's settings, the
// brush and island worlds. RL-5/RL-8b: the old continent (about 40% sea round the old world's places and roads) is gone;
// a run's places on land are run-bowl.test.mjs's.
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
import { runBowlLook } from '../../game/js/logic/run-bowl.js';
import { runMapMake, runSpot } from '../../game/js/logic/run-map.js';
import { rngFrom } from '../../game/js/logic/rng.js';
import { bowlTreeStyle } from '../../game/js/logic/bowl-things.js';

const { locations, maps } = GAME_DATA;
const byId = id => locations.find(l => l.id === id);
const roads = GAME_DATA.roads
  .map(l => PB_DATA.road(GAME_DATA, l))
  .filter(r => r.kind === 'seam')
  .map(r => [r.a, r.b]);
const at = l => {
  const s = bowlSpotOf(l, byId);
  return { xy: bowlXY(s.a, s.r), under: s.under };
};
/* a run's ground as the game draws it: its look from the seed, each place's map's half-diagonal on land */
const runGround = seed => {
  const map = runMapMake(seed, GAME_DATA.nodeTypes, GAME_DATA.rules.run.map),
    spots = map.nodes.map((_, i) => {
      const s = runSpot(map, i);
      return bowlXY(s.a, s.r);
    }),
    look = runBowlLook(seed, map, spots, GAME_DATA.biomes, GAME_DATA.worldmap, bowlTreeStyle, rngFrom);
  return bowlGroundGrid(bowlReliefFeatures([], look.relief, look.seed), 160, {
    places: spots.map(([x, y]) => ({ x, y, reach: Math.hypot(112, 64) / 2000 + 0.012 })),
    roads: [],
    opt: look.sea,
  });
};

test('water lies on the curve: the land above it, the sea floor below it, never deeper than the limit', () => {
  const hub = bowlGroundGrid(
    bowlReliefFeatures(locations),
    160,
    bowlSeaInput(locations, roads, l => maps[l.mapId] || null, 1000, GAME_DATA.worldmap.sea)
  );
  for (const [name, G] of [
    ['the hub', hub],
    ...['SEACURVE0', 'SEACURVE1', 'SEACURVE2'].map(seed => [seed, runGround(seed)]),
  ])
    for (let k = 0; k < 3000; k++) {
      const x = Math.sin(k * 12.9898) * 0.97,
        y = Math.cos(k * 78.233) * 0.97;
      if (x * x + y * y > 0.94) continue;
      const c = bowlCoastAt(G, x, y),
        d = bowlGridHeight(G, x, y) - bowlWaterLevel(x, y);
      if (c > 0.01) {
        assert.ok(d < 0, `${name}: the sea floor at ${x},${y} is above the water`);
        assert.ok(d > -BOWL_SEA_DEPTH - 0.02, `${name}: the sea at ${x},${y} is too deep`);
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
  /* IS-5: the hub's island is drawn at its own size from its coast (IS-7): about 1% of the bowl (half that since the
     look pass made it ~150 m across) */
  assert.ok(seaShare(g) > 0.9 && seaShare(g) < 0.998, `the game’s island is a sensible size (${seaShare(g)})`);
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
