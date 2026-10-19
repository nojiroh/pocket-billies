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
