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
/** the risers on a road: along the walks from the hub to the exits (the main road's two, unless others are given),
 * each road cell against its road neighbours, where the game would draw a step (shared corners more than 3 cm apart) */
function roadRisers(sc, E, walks = sc.edgeExits.slice(0, 2)) {
  const surf = G.MAPGEN_SURFACES[sc.gen.params.road.surface],
    tile = (i, j) => (sc.tiles[sc.h - 1 - (j >> 1)] || '')[i >> 1],
    out = new Set();
  for (const e of walks)
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

/** terraced routes with a third exit (a branch joins the main road), every shape */
function junctions(n, seed0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const exits = [
      [
        { side: 'W', t: 0.4 },
        { side: 'E', t: 0.6 },
        { side: 'S', t: 0.5 },
      ],
      [
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.5 },
        { side: 'E', t: 0.3 },
      ],
      [
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.3 },
        { side: 'N', t: 0.8 },
      ],
    ][i % 3];
    const p = {
      seed: seed0 + i,
      biome: ['ridge', 'canyon', 'meadow', 'autumn'][i % 4],
      land: { terraces: 0.5 + (i % 3) * 0.25, cliffs: (i % 4) / 3 },
      road: { exits, shape: Object.keys(G.MAPGEN_SHAPES)[i % 4] },
    };
    const sc = G.mapgenScene(p, ctx).scene;
    if (sc.steps) out.push({ sc, where: JSON.stringify(p) });
  }
  return out;
}
/** the changes between neighbouring cells of a scene's step grid where both pass the filter: [cm, i, j][] */
function neighbourSteps(sc, keep) {
  const u = G.mapgenDecodeBase64(sc.steps),
    S = new Int16Array(u.buffer, 0, u.length >> 1),
    M = G.mapgenDecodeBase64(sc.stepm),
    W2 = sc.w * 2,
    out = [];
  for (let q = 0; q < S.length; q++) {
    const i = q % W2,
      j = (q - i) / W2;
    if (!keep(M, i, j)) continue;
    if (i + 1 < W2 && keep(M, i + 1, j)) out.push([Math.abs(S[q + 1] - S[q]) * 5, i, j]);
    if (q + W2 < S.length && keep(M, i, j + 1)) out.push([Math.abs(S[q + W2] - S[q]) * 5, i, j]);
  }
  return out;
}

test('junctions, bends and the hub round are one ramp: walkable, no riser on any road, no notch', () => {
  const made = junctions(30, 900);
  assert.ok(made.length >= 25, `${made.length} of 30 have terraces`);
  for (const { sc, where } of made) {
    const W2 = sc.w * 2,
      surf = G.MAPGEN_SURFACES[sc.gen.params.road.surface],
      ramp = (M, i, j) => M[j * W2 + i] & 32,
      paved = (M, i, j) => ramp(M, i, j) && (sc.tiles[sc.h - 1 - (j >> 1)] || '')[i >> 1] === surf;
    /* the roads, the hub round and the exits' rounds (the ramp cells): no step between neighbours over 0.25 m */
    assert.deepEqual(
      neighbourSteps(sc, ramp).filter(s => s[0] > 25),
      [],
      `${where}: walkable steps (cm, i, j)`
    );
    /* no riser along any walk from the hub, the branches' too */
    assert.deepEqual(roadRisers(sc, gridOf(sc), sc.edgeExits), [], where);
    /* no notch: a road's surface is nowhere steeper than a road may climb (0.1 m a half metre, and 5 cm of
       rounding), so no cell is cut below its road to meet a lower neighbour (a pass that lowered cells until each
       was within 0.25 m of its neighbours cut such dents into junctions, bends and the hub round) */
    assert.deepEqual(
      neighbourSteps(sc, paved).filter(s => s[0] > 15),
      [],
      `${where}: notches (cm, i, j)`
    );
    assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
  }
});
