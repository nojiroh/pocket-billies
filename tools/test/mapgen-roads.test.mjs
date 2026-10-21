// Terrain TR-1 (in map generator MG-2): smooth roads. A generated road climbs terraces as a slope the game draws with
// no riser (the step grid's ramps, measured with the game's own rule: logic/step-grid.js stepCellsJoined), and the
// land beside it, its junctions and the hub round meet it the same way.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  SG = modules['step-grid'];
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
const C = GAME_DATA.scenery;

/** a scene's step grid as the game builds it (walk-view.js stepGrid); zeroFlags: as if every flag were 0 */
function gridOf(sc, zeroFlags = false) {
  const u = G.mapgenDecodeBase64(sc.steps),
    S = new Int16Array(u.buffer, 0, u.length >> 1),
    M = zeroFlags || !sc.stepm ? new Uint8Array(S.length) : G.mapgenDecodeBase64(sc.stepm);
  return { w: sc.w * 2, h: sc.h * 2, H: Float32Array.from(S, v => v / 20), M, s: 1, m0: 1 };
}
/** the risers on the main road: along the walks from the hub to exits 0 and 1, each road cell against its road
 * neighbours, where the game would draw a step (their shared corners more than 3 cm apart) */
function roadRisers(sc, E) {
  const surf = G.MAPGEN_SURFACES[sc.gen.params.road.surface],
    tile = (i, j) => (sc.tiles[sc.h - 1 - (j >> 1)] || '')[i >> 1],
    out = new Set();
  for (const e of sc.edgeExits.slice(0, 2))
    for (let k = 1; k < e.path.length; k++) {
      const [a, b] = [e.path[k - 1], e.path[k]],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= L; t += 0.25) {
        const i = Math.floor((a[0] + ((b[0] - a[0]) * t) / L) * 2),
          j = Math.floor((a[1] + ((b[1] - a[1]) * t) / L) * 2);
        if (tile(i, j) !== surf) continue;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (tile(i + di, j + dj) === surf && !SG.stepCellsJoined(E, i, j, di, dj)) out.add(`${i},${j} ${di},${dj}`);
      }
    }
  return [...out];
}
/** terraced routes of every shape, both ways across the terraces */
function terraced(n, seed0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = {
      seed: seed0 + i,
      biome: ['ridge', 'canyon', 'meadow', 'autumn'][i % 4],
      land: { terraces: 0.4 + (i % 3) * 0.3, cliffs: (i % 4) / 3, hills: 0.4 },
      road: {
        exits:
          i % 2
            ? [
                { side: 'S', t: 0.5 },
                { side: 'N', t: 0.5 },
              ]
            : [
                { side: 'W', t: 0.5 },
                { side: 'E', t: 0.5 },
              ],
        shape: Object.keys(G.MAPGEN_SHAPES)[i % 4],
      },
    };
    const sc = G.mapgenScene(p, ctx).scene;
    if (sc.steps) out.push({ sc, where: JSON.stringify(p) });
  }
  return out;
}

test('a road climbs terraces as a slope: no riser over 3 cm on the main road', () => {
  const made = terraced(20, 500);
  assert.ok(made.length >= 15, `${made.length} of 20 have terraces`);
  let before = 0;
  for (const { sc, where } of made) {
    assert.deepEqual(roadRisers(sc, gridOf(sc)), [], where);
    before += roadRisers(sc, gridOf(sc, true)).length;
  }
  assert.ok(before > 100, `the same roads without their ramps would have ${before} risers`);
  for (const { sc, where } of made) assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
});
