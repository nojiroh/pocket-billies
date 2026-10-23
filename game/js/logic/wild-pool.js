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
 * whole list, so a place never has nothing to meet
 * @param {WeightedSpecies[]} list @param {string[] | null} [dex] @returns {WeightedSpecies[]} */
export function wildPoolList(list, dex) {
  const all = list.map(([id, w]) => /** @type {WeightedSpecies} */ ([id, w]));
  if (!dex || !dex.length) return all;
  const named = new Set(dex),
    cut = all.filter(([id]) => named.has(id));
  return cut.length ? cut : all;
}
