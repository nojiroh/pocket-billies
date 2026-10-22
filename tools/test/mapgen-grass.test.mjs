// Terrain TR-2c: tall grass in patches (game/js/logic/mapgen.js mapgenGrassPatches). Gen 3's routes have 3-6 patches
// of 15-70 tiles, one across the path you take; here 3-6 ragged ovals of 15-70 m², the first across the road on the
// way west (runs go east to west), the road under it too; the rest off the road. None near the hub or an exit, and
// every exit is still reached. The game's wild Billies wait in any patch (walk-view.js encounterCandidates, sc.grassPatches).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes };

/** dial sets laid as a run's scenes are (exits east and west), some terraced, ledged or with mountains */
function grassy(n, seed0) {
  const biomes = Object.keys(GAME_DATA.biomes),
    out = [];
  for (let i = 0; i < n; i++)
    out.push({
      seed: seed0 + i,
      biome: biomes[i % biomes.length],
      land: {
        hills: (i % 5) / 5,
        terraces: i % 3 ? 0.5 : 0,
        cliffs: (i % 4) / 3,
        water: ['none', 'stream', 'pond'][i % 3],
        ...(i % 3 === 1 ? { ledges: 1 } : {}),
        ...(i % 6 === 5 ? { mountains: 0.8, massif: 'N' } : {}),
      },
      nature: { tall: 0.2 + (i % 7) / 8 },
      road: {
        exits:
          i % 2
            ? [
                { side: 'E', t: 0.5 },
                { side: 'W', t: 0.5 },
              ]
            : [
                { side: 'E', t: 0.15625 },
                { side: 'W', t: 0.5 },
                { side: 'W', t: 0.84375 },
              ],
        shape: ['winding', 'scurve', 'straight', 'switchback'][i % 4],
      },
    });
  return out;
}
/** the scene's ground letter at (x, z) (tiles: far row first) */
const tileAt = (sc, x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];

test('40 dial sets: 3-6 patches of 15-70 m², one across the way west, every exit still reached', () => {
  for (const p of grassy(40, 7300)) {
    const { scene: sc, notes } = G.mapgenScene(p, ctx),
      where = JSON.stringify(p),
      tall = GAME_DATA.biomes[p.biome].ground.tall;
    assert.deepEqual(notes, [], where);
    assert.ok(
      sc.grassPatches.length >= 3 && sc.grassPatches.length <= 6,
      `${where}: ${sc.grassPatches.length} patches`
    );
    for (const g of sc.grassPatches) assert.ok(g.n >= 15 && g.n <= 70, `${where}: a patch of ${g.n}`);
    assert.equal(sc.grassPatches.filter(g => g.across).length, 1, `${where}: one across the road`);
    /* walking the road west you go through it: some of the westmost exit's path lies in tall grass */
    const west = sc.edgeExits.filter(e => e.side === 'W').sort((a, b) => a.path.at(-1)[0] - b.path.at(-1)[0])[0],
      pts = G.mapgenResample(west.path, 0.25);
    assert.ok(
      pts.filter(q => tileAt(sc, q[0], q[1]) === tall).length >= 6,
      `${where}: the road west goes through the grass`
    );
    /* never at the hub or an exit */
    for (let j = 0; j < sc.h; j++)
      for (let i = 0; i < sc.w; i++) {
        if (sc.tiles[sc.h - 1 - j][i] !== tall) continue;
        const x = i + 0.5,
          z = j + 0.5;
        assert.ok(Math.hypot(x - sc.hub[0], z - sc.hub[1]) >= 6.9, `${where}: tall grass at the hub`);
        for (const e of sc.exits) assert.ok(Math.hypot(x - e[0], z - e[1]) >= 6.9, `${where}: tall grass at an exit`);
      }
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], where);
    if (sc.stepm) assert.equal(G.mapgenTraps(sc, C).n, 0, `${where}: no trap`);
  }
});

test('more grass on the dial makes more patches; none at 0', () => {
  const base = grassy(1, 7400)[0],
    at = tall => G.mapgenScene({ ...base, nature: { tall } }, ctx).scene;
  assert.equal(at(0).grassPatches, undefined);
  assert.ok(at(0.1).grassPatches.length <= at(0.9).grassPatches.length);
  assert.equal(at(0.9).grassPatches.length, 6);
});

test('the patches are the same for the same dials and keep to their own stream', () => {
  const p = grassy(1, 7401)[0],
    a = G.mapgenScene(p, ctx).scene;
  assert.deepEqual(G.mapgenScene(p, ctx).scene.grassPatches, a.grassPatches);
  const b = G.mapgenScene({ ...p, nature: { tall: 0.9 } }, ctx).scene;
  assert.deepEqual(
    b.edgeExits.map(e => e.path),
    a.edgeExits.map(e => e.path),
    'the road stays'
  );
});
