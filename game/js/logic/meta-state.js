// @ts-check
'use strict';
/* ================= META STATE (roguelite track RL-3) =================
   What lasts between runs, kept in the save as saveData.meta: the three currencies other than money (Research, the
   unlock currency; Scrap, the building material; Crests, the rare boss currency), the unlocks, each hub
   building's level, how many runs were played and won, the highest Expedition (the difficulty) open, and (RL-R2) the
   badges kept for good, by type (`{ water: 1 }`: the first win over a leader of a type opens that type's field move,
   logic/run-side.js), and (RL-S1) the newest runs' history (logic/run-history.js). Money ($,
   saveData.se) is not here: it is the run's working field. Logic only: no DOM, runs in Node
   (tools/test/meta-state.test.mjs). The sections that spend these (unlocks.json, buildings.json) come in RL-11. */
/** @import { Meta } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { validHistory } from './run-history.js';
/* eslint-disable no-func-assign */
expose({
  META_CURRENCIES: [() => META_CURRENCIES],
  META_EXPEDITIONS: [() => META_EXPEDITIONS],
  META_IDS: [() => META_IDS],
  META_MAX: [() => META_MAX],
  // @ts-expect-error -- replaced on purpose
  metaFill: [() => metaFill, v => (metaFill = v)],
  // @ts-expect-error -- replaced on purpose
  newMeta: [() => newMeta, v => (newMeta = v)],
  recordOf: [() => recordOf],
  // @ts-expect-error -- replaced on purpose
  validMeta: [() => validMeta, v => (validMeta = v)],
  wholeIn: [() => wholeIn],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a new player's meta state: nothing earned, Expedition I open */
/** @returns {Meta} */
export function newMeta() {
  return {
    research: 0,
    scrap: 0,
    crests: 0,
    beans: 0,
    unlocks: {},
    buildings: {},
    runs: 0,
    wins: 0,
    expedition: 1,
    badges: {},
    history: [],
  };
}
/** the currencies kept between runs (currencies.json's `kept: meta` rows; RL-S2: Beans, the gift currency) */
export const META_CURRENCIES = /** @type {const} */ (['research', 'scrap', 'crests', 'beans']);
export const META_MAX = 1e12,
  META_IDS = 200,
  META_EXPEDITIONS = 9;
/** a whole number from min to max */
export const wholeIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
/** a plain record (not an array, no __proto__ key) of at most `most` keys whose values pass `ok` */
export const recordOf = (v, most, ok) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !Object.hasOwn(v, '__proto__') &&
  Object.keys(v).length <= most &&
  Object.keys(v).every(k => /^[a-z0-9_:]{1,64}$/.test(k)) &&
  Object.values(v).every(ok);
/** the load check for saveData.meta: strict, like validSave (a broken or tampered save is refused) */
/** @param {any} o @returns {boolean} */
export function validMeta(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.hasOwn(o, '__proto__')) return false;
  for (const k of [...META_CURRENCIES, 'runs', 'wins']) if (!wholeIn(o[k], 0, META_MAX)) return false;
  return (
    o.wins <= o.runs &&
    wholeIn(o.expedition, 1, META_EXPEDITIONS) &&
    recordOf(o.unlocks, META_IDS, v => v === 1) &&
    recordOf(o.buildings, META_IDS, v => wholeIn(v, 0, 99)) &&
    recordOf(o.badges, 32, v => v === 1) &&
    validHistory(o.history)
  );
}
/** a stored meta filled out with anything new (fields a later version adds); one that still fails the check is
    started again rather than loaded broken */
/** @param {any} o @returns {Meta} */
export function metaFill(o) {
  const filled = Object.assign(newMeta(), o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  /* RL-S1: a broken history is dropped on its own, not the whole meta with it */
  if (!validHistory(filled.history)) filled.history = [];
  return validMeta(filled) ? filled : newMeta();
}
