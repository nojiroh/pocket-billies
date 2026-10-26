// @ts-check
'use strict';
/* ================= WATER'S PLAY (water track WA-5a) =================
   What the new kinds do when you walk in or by them (logic/water-kinds.js says which kind does what):
   - a hot spring heals the whole party for free, once a run, the first time you step in with someone hurt (the
     run's own flags: saveData.flags is a run's working copy, logic/run-state.js, so a new run starts fresh);
   - a reed that hides an item (mapgen's `hide`, logic/water-gen.js waterGenReeds) gives it as you brush past, once a
     run each;
   - a place with marsh or bog water draws more of the Billies that like it (the region's own pool, weighted by type,
     as the forecast weights it: logic/weather.js wildOddsBy).
   Logic only: no DOM, runs in Node (tools/test/water-play.test.mjs). Every table comes in as an argument. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  WATER_HEAL_FLAG: [() => WATER_HEAL_FLAG],
  WATER_REED_REACH: [() => WATER_REED_REACH],
  WATER_WILD_LIKES: [() => WATER_WILD_LIKES],
  // @ts-expect-error -- replaced on purpose
  waterHealDue: [() => waterHealDue, v => (waterHealDue = v)],
  waterHurt: [() => waterHurt],
  // @ts-expect-error -- replaced on purpose
  waterMarshOf: [() => waterMarshOf, v => (waterMarshOf = v)],
  // @ts-expect-error -- replaced on purpose
  waterReedAt: [() => waterReedAt, v => (waterReedAt = v)],
  waterReedFlag: [() => waterReedFlag],
  // @ts-expect-error -- replaced on purpose
  waterWildOdds: [() => waterWildOdds, v => ((waterWildOdds = v), provide({ waterWildOdds }))],
});
/* eslint-enable no-func-assign */
provide({ waterWildOdds });
/* to-module: end */
/** the run flag a hot spring's heal sets */
export const WATER_HEAL_FLAG = 'hotspring';
/** how close (m) you pass a reed to find what it hides */
export const WATER_REED_REACH = 0.9;
/** the wild odds' multipliers by a place's water: the marsh and the bog's own Billies (the game's types)
 * @type {Record<string, Record<string, number>>} */
export const WATER_WILD_LIKES = {
  swamp: { Water: 1.8, Grass: 1.8 },
  bog: { Ground: 2, Water: 1.5, Grass: 1.3 },
};
/** a place's marsh water: 'bog' when it has a bog, 'swamp' when its water is the marsh, else '' (its wild Billies)
 * @param {any} sc */
export function waterMarshOf(sc) {
  if (!sc || !(sc.tiles || []).some((/** @type {string} */ r) => /[wd]/.test(r))) return '';
  if ((sc.waters || []).some((/** @type {any} */ r) => r.k === 'bog')) return 'bog';
  return sc.waterKind === 'swamp' || (sc.waters || []).some((/** @type {any} */ r) => r.k === 'swamp') ? 'swamp' : '';
}
/** the wild odds of a place with marsh or bog water: each [species, weight] times its types' multipliers (none:
 * the list as it is) @param {[string, number][]} list @param {string} marsh waterMarshOf's
 * @param {(id: string) => string[]} typesOf @returns {[string, number][]} */
export function waterWildOdds(list, marsh, typesOf) {
  const F = WATER_WILD_LIKES[marsh];
  if (!F) return list;
  return list.map(([id, w]) => [id, typesOf(id).reduce((m, t) => m * (F[t] || 1), w)]);
}
/** does stepping into water of this kind heal the party now: a hot spring, not used this run, someone hurt
 * @param {string} kind the water's kind where you stand (logic/wading.js wadeKindAt)
 * @param {Record<string, any>} flags the run's flags @param {boolean} hurt anyone on the team below full or with a
 * status */
export function waterHealDue(kind, flags, hurt) {
  return kind === 'hotspring' && !(flags || {})[WATER_HEAL_FLAG] && !!hurt;
}
/** is a Billie hurt (below full HP or with a status) @param {{ hp: number, status?: any }} m @param {number} max */
export const waterHurt = (m, max) => m.hp < max || !!m.status;
/** the run flag for a reed at (x, z) in the world's own metres (a joined view's box corner added: the same reed
 * seen from either side of a seam is one find) @param {number} x @param {number} z */
export const waterReedFlag = (x, z) => `reed:${Math.round(x * 4) / 4},${Math.round(z * 4) / 4}`;
/** the hidden find you are passing at (x, z): the first reed with `hide` within WATER_REED_REACH whose flag is not
 * set, or null; ox, oz the view's corner in the world (a joined view's comp.box) @param {any} sc @param {number} x
 * @param {number} z @param {Record<string, any>} flags @param {number} [ox] @param {number} [oz]
 * @returns {{ k: string, flag: string } | null} */
export function waterReedAt(sc, x, z, flags, ox = 0, oz = 0) {
  for (const p of (sc && sc.props) || []) {
    if (!p.hide || Math.hypot(p.x - x, p.z - z) > WATER_REED_REACH) continue;
    const flag = waterReedFlag(p.x + ox, p.z + oz);
    if (!(flags || {})[flag]) return { k: p.hide, flag };
  }
  return null;
}
