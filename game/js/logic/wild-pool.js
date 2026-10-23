// @ts-check
'use strict';
/* ================= A PLACE'S WILD LIST (roster track RO-1) =================
   What a run's place draws its wild Billies from: its biome's pool (pools.json, one per biome, the real lines and
   their regional forms by rarity), cut to the region's dex when the run has one (RL-R1 makes regions; until then
   there is none and the biome's whole pool is used). Logic only: no DOM, runs in Node. */
/** @import { WeightedSpecies } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  wildPoolList: [() => wildPoolList, v => (wildPoolList = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a copy of a pool's list, keeping only the species a dex names; a dex that names none of them (or no dex) keeps the
 * whole list, so a place never has nothing to meet. RL-R1: `swap` first turns a species into the region's variety of
 * its line (a base into its regional form or back: run.region.swap), a species listed twice then once, weights summed
 * @param {WeightedSpecies[]} list @param {string[] | null} [dex] @param {Record<string, string> | null} [swap]
 * @returns {WeightedSpecies[]} */
export function wildPoolList(list, dex, swap) {
  /** @type {WeightedSpecies[]} */
  const all = [];
  for (const [id0, w] of list) {
    const id = (swap && swap[id0]) || id0,
      had = all.find(e => e[0] === id);
    if (had) had[1] += w;
    else all.push([id, w]);
  }
  if (!dex || !dex.length) return all;
  const named = new Set(dex),
    cut = all.filter(([id]) => named.has(id));
  return cut.length ? cut : all;
}
