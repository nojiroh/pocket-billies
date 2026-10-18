// @ts-check
'use strict';
/* ================= FIGHTERS (phase 17) =================
   A team member is a Billie or, from phase 17, a robot. Everything that needs a member's species data (name, types,
   base stats, weight, XP yield) asks here instead of reading SPECIES[m.sp], so a robot can stand in the same team,
   the same battles and the same screens as a Billie.
   Logic only (game/js/logic/): no DOM, runs in plain Node. */
/** @import { Species } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { SPECIES } from '../game-data.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  speciesById: [() => speciesById, v => (speciesById = v)],
  // @ts-expect-error -- replaced on purpose
  speciesOf: [() => speciesOf, v => (speciesOf = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @param {{ sp: string }} m a team member, a trainer's fighter or a wild one @returns {Species} */
export function speciesOf(m) {
  return SPECIES[m.sp];
}
/** @param {string} sp a species id @returns {Species | undefined} */
export function speciesById(sp) {
  return SPECIES[sp];
}
