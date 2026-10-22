// @ts-check
'use strict';
/* ================= A RUN'S OWN WORLD MAP (roguelite track RL-8b) =================
   The owner, after the first play: "a run gets its own world map, generated from its seed", laid across the bowl
   with no hub on it. The bowl (world-bowl.js, logic/bowl.js) draws whatever look it is handed; this works out a run's
   look from the hub's (worldmap.json) and the run's seed:
   - Land: an island world (bowl.js bowlIsles) of rounds of land, one under each of the run's places (it always
     covers the place's map), a few lobes along the run's way north and south of it, and a few islets out in the
     sea. Its coast and noise seeds come from the seed (bowlSeedShift), so another run has other hills, patches,
     trees and clouds.
   - Ground: near each place its biome's own ground (biomes.json ground: the base three times, the patches by their
     share), between them the run's commonest biome's, with its trees.
   The same seed and the same data give the same look. Logic only: no DOM, runs in Node
   (tools/test/run-bowl.test.mjs); every table comes in as an argument. */
/** @import { RunMap } from '../../types/save-data' */
/** @import { Biome } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BOWL_LAND: [() => RUN_BOWL_LAND],
  // @ts-expect-error -- replaced on purpose
  runBowlGround: [() => runBowlGround, v => (runBowlGround = v)],
  // @ts-expect-error -- replaced on purpose
  runBowlLook: [() => runBowlLook, v => (runBowlLook = v)],
  // @ts-expect-error -- replaced on purpose
  runBowlTrees: [() => runBowlTrees, v => (runBowlTrees = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the land under and round a run's places (bowl radii): each place's round, the lobes along its way, the islets */
export const RUN_BOWL_LAND = {
  place: [0.12, 0.17],
  lobes: [3, 5],
  lobe: [0.08, 0.16],
  lobeOff: [0.1, 0.22],
  islets: [3, 6],
  islet: [0.025, 0.06],
  rough: 0.9,
};

/** a biome's ground for the world map: its base three times, then each patch, twice when it covers a fifth or more
 * (the map's lists favour their first ground) @param {Biome | undefined} B */
export function runBowlGround(B) {
  const g = (B && B.ground) || null;
  if (!g || !g.base) return '';
  return (
    g.base.repeat(3) +
    Object.entries(g.patches || {})
      .sort((p, q) => q[1] - p[1])
      .map(([k, w]) => (w >= 0.2 ? k + k : k))
      .join('')
  );
}

/** a biome's tree kinds on the world map (its own trees, by their shape: bowl-things.js styles), most common first
 * @param {Biome | undefined} B @param {(k: string) => string} styleOf */
export function runBowlTrees(B, styleOf) {
  const W = /** @type {Record<string, number>} */ ((B && /** @type {any} */ (B).trees) || {}),
    /** @type {Record<string, number>} */ n = {};
  for (const [k, w] of Object.entries(W)) n[styleOf(k)] = (n[styleOf(k)] || 0) + w;
  const out = Object.entries(n)
    .sort((p, q) => q[1] - p[1])
    .map(([k]) => k);
  return out.length ? out.concat(out[0]) : ['round', 'round', 'tall', 'bush'];
}

/** a run's world map look: the hub's look (worldmap.json, as the bowl reads it) with the run's own land, seeds,
 * grounds and trees. spots: each map node's place on the bowl ([x, y] seen from above, logic/run-map.js runSpot)
 * @param {string} seed @param {RunMap} map @param {[number, number][]} spots
 * @param {Record<string, Biome>} biomes @param {any} hub worldmap.json @param {(k: string) => string} styleOf
 * @param {(seed: string, salt: string) => { next: () => number, range: (a: number, b: number) => number,
 *   int: (a: number, b: number) => number }} rng logic/rng.js rngFrom */
export function runBowlLook(seed, map, spots, biomes, hub, styleOf, rng) {
  const R = rng(seed, 'bowl'),
    L = RUN_BOWL_LAND,
    /** @type {{ x: number, y: number, r: number }[]} */
    isles = [];
  /* a round under each place (it covers the 112 x 64 m map: half its diagonal is 0.064) */
  spots.forEach(([x, y]) => isles.push({ x, y, r: R.range(L.place[0], L.place[1]) }));
  /* lobes along the way, north or south of it */
  const xs = spots.map(p => p[0]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    near = (/** @type {number} */ x) =>
      spots.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b), spots[0]);
  for (let k = R.int(L.lobes[0], L.lobes[1]); k > 0; k--) {
    const x = R.range(x0, x1),
      side = R.next() < 0.5 ? -1 : 1;
    isles.push({ x, y: near(x)[1] + side * R.range(L.lobeOff[0], L.lobeOff[1]), r: R.range(L.lobe[0], L.lobe[1]) });
  }
  /* islets out in the sea, clear of the way */
  for (let k = R.int(L.islets[0], L.islets[1]), tries = 0; k > 0 && tries < 60; tries++) {
    const a = R.range(0, Math.PI * 2),
      d = R.range(0.25, 0.78),
      x = Math.cos(a) * d,
      y = Math.sin(a) * d,
      r = R.range(L.islet[0], L.islet[1]);
    if (isles.some(b => Math.hypot(b.x - x, b.y - y) < b.r + r + 0.06)) continue;
    isles.push({ x, y, r });
    k--;
  }
  /* the grounds: each biome's own near its places; between them the run's commonest biome's, with its trees */
  /** @type {Record<string, number>} */
  const count = {};
  for (const n of map.nodes) if (n.biome) count[n.biome] = (count[n.biome] || 0) + 1;
  const main = Object.keys(count).sort((p, q) => count[q] - count[p] || (p < q ? -1 : 1))[0] || '',
    MB = biomes[main],
    g = (MB && MB.ground) || null,
    /** @type {Record<string, string>} */ kinds = {};
  for (const b of Object.keys(count)) {
    const s = runBowlGround(biomes[b]);
    if (s) kinds[b] = s;
  }
  const hubRegions = (hub && hub.regions) || {},
    start = hubRegions.starter || {},
    region = g
      ? {
          ground: runBowlGround(MB) || start.ground,
          wet: `${g.floor || g.base}${g.base}`,
          dry: `${g.base}${g.verge || g.base}`,
          high: `${g.rock || 'r'}${g.base}`,
          trees: runBowlTrees(MB, styleOf),
        }
      : start;
  return {
    seed: R.int(1, 9972),
    sea: { ...((hub && hub.sea) || {}), seed: R.int(0, 9999), island: 0, rough: L.rough, isles, paint: [] },
    relief: (hub && hub.relief) || null,
    regions: { ...hubRegions, starter: region },
    kinds: { ...((hub && hub.kinds) || {}), ...kinds },
  };
}
