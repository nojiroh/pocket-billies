// Map generator track MG-1: the route generator (game/js/logic/mapgen.js) on 40 random dial sets: each scene reaches
// every exit, and nothing stands in water it does not grow in. The slow tier (tools/unit-tests.mjs SLOW_TESTS): 40
// whole scenes; mapgen.test.mjs checks the same on its spread of dials.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
const P = GAME_DATA.scenery.props;
const SHALLOW = modules['water-gen'].WATERGEN_SHALLOW_PROP;
const at = (sc, x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];

test('40 random dial sets: each reaches every exit, with nothing in water it does not grow in', () => {
  const R = modules.rng.rngFrom(7, 'sweep'),
    pick = o => Object.keys(o)[R.int(0, Object.keys(o).length - 1)];
  for (let i = 0; i < 40; i++) {
    const exits = [];
    for (let k = R.int(1, 3); k > 0; k--) exits.push({ side: 'NSEW'[R.int(0, 3)], t: R.range(0.15, 0.85) });
    const c = {
      biome: pick(GAME_DATA.biomes),
      seed: i,
      w: R.int(60, 140),
      h: R.int(48, 100),
      land: {
        hills: R.next(),
        terraces: R.chance(0.3) ? R.next() : 0,
        cliffs: R.next(),
        water: pick(G.MAPGEN_WATER),
        waterAmount: R.next(),
      },
      road: {
        exits,
        shape: pick(G.MAPGEN_SHAPES),
        surface: pick(G.MAPGEN_SURFACES),
        wobble: R.next(),
        width: R.range(1.6, 4),
        verge: R.next(),
      },
      feature: pick(G.MAPGEN_FEATURES),
      nature: { growth: R.next(), tall: R.next(), clearings: R.next(), trees: R.next() },
    };
    const sc = G.mapgenScene(c, ctx).scene,
      where = JSON.stringify(c);
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery), [], where);
    for (const p of [sc.hub, ...sc.exits]) assert.ok(!'wd'.includes(at(sc, ...p)), `${where}: ${p} in water`);
    for (const p of sc.props)
      /* WA-5a: rocks may stand in shallows you wade, never in deep water */
      if ('wd'.includes(at(sc, p.x, p.z)) && p.k !== 'dock_post' && !(at(sc, p.x, p.z) === 'w' && SHALLOW.test(p.k)))
        assert.ok(/[wd]/.test(P[p.k].grow || ''), `${where}: ${p.k} in water`);
  }
});
