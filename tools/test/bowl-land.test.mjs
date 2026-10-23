// Phase 10, the look, session 2: the land between places (game/js/logic/bowl.js): rivers from the high ground to the
// sea, cliffs where high land meets it, how wet the land is, and the slanted light of the Inner Sun. RL-8b: on the land
// the game draws for a run (logic/run-bowl.js, three seeds); the hub's island is too small for rivers or cliffs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import {
  BOWL_RIVER_COUNT,
  BOWL_SPHERE,
  BOWL_SUN_SLANT,
  bowlCoastAt,
  bowlGroundGrid,
  bowlReliefFeatures,
  bowlSun,
  bowlWaterLevel,
  bowlXY,
} from '../../game/js/logic/bowl.js';
import { runBowlLook } from '../../game/js/logic/run-bowl.js';
import { runMapMake, runSpot } from '../../game/js/logic/run-map.js';
import { rngFrom } from '../../game/js/logic/rng.js';
import { bowlTreeStyle } from '../../game/js/logic/bowl-things.js';

const N = 320,
  W = N + 1;
/* a run's ground as the game draws it (its look from the seed; each place's map's half-diagonal its own ground) */
const RUNS = ['LANDRUN0', 'LANDRUN1', 'LANDRUN2'].map(seed => {
  const map = runMapMake(seed, GAME_DATA.nodeTypes, GAME_DATA.rules.run.map),
    spots = map.nodes.map((_, i) => {
      const s = runSpot(map, i);
      return bowlXY(s.a, s.r);
    }),
    look = runBowlLook(seed, map, spots, GAME_DATA.biomes, GAME_DATA.worldmap, bowlTreeStyle, rngFrom),
    S = {
      places: spots.map(([x, y]) => ({ x, y, reach: Math.hypot(112, 64) / 2000 + 0.012 })),
      roads: [],
      opt: look.sea,
    },
    G = bowlGroundGrid(bowlReliefFeatures([], look.relief, look.seed), N, S);
  return { seed, S, G };
});
const corner = (x, y) => Math.round(((y + 1) / 2) * N) * W + Math.round(((x + 1) / 2) * N);
const above = (G, x, y) => G.h[corner(x, y)] - bowlWaterLevel(x, y);

test('a handful of rivers run from the high ground', () => {
  for (const { seed, G } of RUNS) {
    assert.ok(G.rivers.length >= 1 && G.rivers.length <= BOWL_RIVER_COUNT, `${seed}: ${G.rivers.length} rivers`);
    for (const r of G.rivers) assert.ok(above(G, ...r[0]) > 0.006, `${seed}: a spring at ${r[0]} is low`);
  }
  assert.ok(RUNS.reduce((n, R) => n + R.G.rivers.length, 0) >= 6, 'a handful over three runs');
});

test('every river falls all the way and ends in the sea', () => {
  for (const { G } of RUNS)
    for (const r of G.rivers) {
      let last = Infinity;
      for (const [x, y] of r) {
        const a = above(G, x, y);
        assert.ok(a <= last + 1e-9, `the river from ${r[0]} climbs at ${x},${y}`);
        last = a;
      }
      const end = r[r.length - 1];
      assert.ok(bowlCoastAt(G, ...end) > 0 || G.c[corner(...end)] > 0, `the river from ${r[0]} ends on land`);
    }
});

test("rivers keep out of the places' own ground", () => {
  for (const { S, G } of RUNS)
    for (const r of G.rivers)
      for (const [x, y] of r)
        for (const p of S.places)
          assert.ok(Math.hypot(x - p.x, y - p.y) > p.reach, `a river runs through a place's ground at ${x},${y}`);
});

test('the land never sinks below the water, except in river beds', () => {
  for (const { G } of RUNS)
    for (let k = 0; k < W * W; k++) {
      const x = -1 + (2 * (k % W)) / N,
        y = -1 + (2 * Math.floor(k / W)) / N;
      if (x * x + y * y > 0.97 || G.c[k] > 0 || G.flow[k]) continue;
      assert.ok(G.h[k] - bowlWaterLevel(x, y) > 0, `dry land under the water at ${x},${y}`);
    }
});

test('high land meets the sea as cliffs somewhere, low land as beaches elsewhere', () => {
  let all = 0;
  for (const { seed, G } of RUNS) {
    let cliffs = 0,
      beaches = 0;
    for (let k = 0; k < W * W; k++) {
      const x = -1 + (2 * (k % W)) / N,
        y = -1 + (2 * Math.floor(k / W)) / N;
      if (x * x + y * y > 0.9 || G.c[k] > 0 || G.c[k] < -0.006) continue;
      const a = G.h[k] - bowlWaterLevel(x, y);
      if (a > 0.012) cliffs++;
      else if (a < 0.004) beaches++;
    }
    assert.ok(beaches > cliffs, `${seed}: ${beaches} beach corners, ${cliffs} cliff corners`);
    all += cliffs;
  }
  assert.ok(all > 20, `${all} cliff corners over three runs`);
});

test('wetness: 1 at the water, falling away inland', () => {
  for (const { seed, G } of RUNS) {
    for (let k = 0; k < W * W; k++) {
      assert.ok(G.wet[k] >= 0 && G.wet[k] <= 1);
      if (G.c[k] > 0 || G.flow[k]) assert.equal(G.wet[k], 1);
    }
    assert.ok(Math.min(...G.wet) < 0.2, `${seed}: some land is dry`);
  }
});

test('the Inner Sun: off the centre, the light slanted, the sun inside the hollow sphere', () => {
  const { dir, at } = bowlSun();
  assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-9);
  assert.ok(Math.abs((Math.acos(dir[2]) * 180) / Math.PI - BOWL_SUN_SLANT) < 1e-6);
  assert.ok(Math.hypot(at[0], at[1], at[2] - BOWL_SPHERE) < BOWL_SPHERE - 0.1, 'the sun is outside the world');
  assert.ok(at[2] > 0.5, 'the sun hangs low');
});
