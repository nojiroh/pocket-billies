// @ts-check
'use strict';
/* ================= META STATE (roguelite track RL-3) =================
   What lasts between runs, kept in the save as saveData.meta: the three currencies other than money (Research, the
   unlock currency; Scrap, the building material; Crests, the rare boss currency), the unlocks, each hub
   building's level, how many runs were played and won, the highest Expedition (the difficulty) open, and (RL-R2) the
   badges kept for good, by type (`{ water: 1 }`: the first win over a leader of a type opens that type's field move,
   logic/run-side.js), (RL-S1) the newest runs' history (logic/run-history.js), and (RS-1) who lives in Copperleaf
   (residents.json: id -> the run they moved in after, logic/residents.js). Money ($,
   saveData.se) is not here: it is the run's working field. Logic only: no DOM, runs in Node
   (tools/test/meta-state.test.mjs). The sections that spend these (unlocks.json, buildings.json) come in RL-11. */
/** @import { Meta } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { validHistory } from './run-history.js';
/* eslint-disable no-func-assign */
expose({
  META_CURRENCIES: [() => META_CURRENCIES],
  META_EXPEDITIONS: [() => META_EXPEDITIONS],
  META_GENES: [() => META_GENES],
  META_IDS: [() => META_IDS],
  META_MAX: [() => META_MAX],
  SHOW_NAME_MOST: [() => SHOW_NAME_MOST],
  SHOW_NICK_MOST: [() => SHOW_NICK_MOST],
  SHOW_PAGE: [() => SHOW_PAGE],
  SHOW_RIBBONS_MOST: [() => SHOW_RIBBONS_MOST],
  SHOW_RIB_MOST: [() => SHOW_RIB_MOST],
  SHOW_SLOTS: [() => SHOW_SLOTS],
  SHOW_VOTES_MOST: [() => SHOW_VOTES_MOST],
  SHOW_WEEK_KEY: [() => SHOW_WEEK_KEY],
  // @ts-expect-error -- replaced on purpose
  metaFill: [() => metaFill, v => (metaFill = v)],
  // @ts-expect-error -- replaced on purpose
  newMeta: [() => newMeta, v => (newMeta = v)],
  newShowMeta: [() => newShowMeta],
  plainRecord: [() => plainRecord],
  recordOf: [() => recordOf],
  ribbonOk: [() => ribbonOk],
  ribbonsShapeOk: [() => ribbonsShapeOk],
  // @ts-expect-error -- replaced on purpose
  validMeta: [() => validMeta, v => (validMeta = v)],
  // @ts-expect-error -- replaced on purpose
  validShowMeta: [() => validShowMeta, v => (validShowMeta = v)],
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
    rel: {},
    gifted: {},
    dna: 0,
    genes: [],
    unlocks: {},
    buildings: {},
    runs: 0,
    wins: 0,
    expedition: 1,
    chapter: 1,
    badges: {},
    history: [],
    residents: {},
    boards: { d: 0, w: 0 },
    show: newShowMeta(),
    bosses: {},
  };
}
/** the currencies kept between runs (currencies.json's `kept: meta` rows; RL-S2: Beans, the gift currency; SP-3: DNA) */
export const META_CURRENCIES = /** @type {const} */ (['research', 'scrap', 'crests', 'beans', 'dna']);
export const META_GENES = 1000,
  META_MAX = 1e12,
  META_IDS = 200,
  META_EXPEDITIONS = 9;
provide({ META_GENES }); /* to-module */
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
/* ON-3: the Showcase's numbers (logic/showcase.js) and the save's own parts of it: they live here, with the save's
   other checks, so every page that loads the save's checks has them (the Studio loads no Showcase) */
export const SHOW_SLOTS = 3,
  /** a page of entries (the rules refuse a bigger one) */
  SHOW_PAGE = 20,
  SHOW_WEEK_KEY = 1e6,
  /** ribbons a Billie keeps, the Trainer card's list, the votes a save remembers */
  SHOW_RIBBONS_MOST = 20,
  SHOW_RIB_MOST = 50,
  SHOW_VOTES_MOST = 200,
  SHOW_NICK_MOST = 16,
  SHOW_NAME_MOST = 40;
/** a plain record (not an array, no __proto__ key) @param {unknown} v */
export const plainRecord = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__');
/** a ribbon as a Billie keeps it: the week, its theme, the place from 0 @param {any} r */
export const ribbonOk = r =>
  plainRecord(r) && wholeIn(r.w, 0, 1e7) && wholeIn(r.p, 0, 9) && typeof r.th === 'string' && r.th.length <= 32;
/** the save's Showcase record as a new player starts it: my entries' slots, the votes I gave, the last week whose
 * ribbons were looked at, the ribbons won @returns {import('../../types/save-data').MetaShow} */
export const newShowMeta = () => ({ s: [], v: [], rw: 0, rib: [] });
/** whether a meta.show record is well formed @param {any} o */
export function validShowMeta(o) {
  if (!plainRecord(o) || Object.keys(o).some(k => !['s', 'v', 'rw', 'rib'].includes(k))) return false;
  if (!Array.isArray(o.s) || o.s.length > SHOW_SLOTS) return false;
  const slots = new Set();
  for (const x of o.s) {
    if (!plainRecord(x) || !wholeIn(x.i, 0, SHOW_SLOTS - 1) || slots.has(x.i)) return false;
    if (!wholeIn(x.k, 0, 1e15) || !wholeIn(x.w, 0, 1e7) || typeof x.b !== 'string' || x.b.length > 64) return false;
    if (typeof x.th !== 'string' || x.th.length > 32) return false;
    slots.add(x.i);
  }
  if (!Array.isArray(o.v) || o.v.length > SHOW_VOTES_MOST) return false;
  if (o.v.some((/** @type {unknown} */ k) => typeof k !== 'string' || k.length > 200)) return false;
  if (!wholeIn(o.rw, 0, 1e7) || !Array.isArray(o.rib) || o.rib.length > SHOW_RIB_MOST) return false;
  return o.rib.every(
    (/** @type {any} */ r) =>
      ribbonOk(r) &&
      typeof r.sp === 'string' &&
      r.sp.length <= 32 &&
      typeof r.nick === 'string' &&
      r.nick.length <= SHOW_NICK_MOST
  );
}
/** a Billie's ribbons as a save holds them (saves.js billiesOk): none, or up to SHOW_RIBBONS_MOST @param {unknown} v */
export const ribbonsShapeOk = v =>
  v == null || (Array.isArray(v) && v.length <= SHOW_RIBBONS_MOST && v.every(ribbonOk));
/** the load check for saveData.meta: strict, like validSave (a broken or tampered save is refused) */
/** @param {any} o @returns {boolean} */
export function validMeta(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.hasOwn(o, '__proto__')) return false;
  for (const k of [...META_CURRENCIES, 'runs', 'wins']) if (!wholeIn(o[k], 0, META_MAX)) return false;
  return (
    o.wins <= o.runs &&
    wholeIn(o.expedition, 1, META_EXPEDITIONS) &&
    wholeIn(o.chapter, 1, META_EXPEDITIONS) &&
    recordOf(o.unlocks, META_IDS, v => v === 1) &&
    recordOf(o.buildings, META_IDS, v => wholeIn(v, 0, 99)) &&
    recordOf(o.badges, 32, v => v === 1) &&
    recordOf(o.rel, 32, v => wholeIn(v, 0, 9999)) &&
    recordOf(o.gifted, 32, v => wholeIn(v, 0, META_MAX)) &&
    recordOf(o.residents, 64, v => wholeIn(v, 1, META_MAX)) &&
    /* ON-2: the last daily and weekly taken off on (logic/daily.js) */
    recordOf(o.boards, 2, v => wholeIn(v, 0, 1e7)) &&
    Object.keys(o.boards).every(k => k === 'd' || k === 'w') &&
    /* ON-3: the Showcase (logic/showcase.js) */
    validShowMeta(o.show) &&
    /* RL-14b: the bosses.json bosses beaten, by id: how many times (logic/battle-rewards.js bossWin) */
    recordOf(o.bosses, 32, v => wholeIn(v, 1, META_MAX)) &&
    Array.isArray(o.genes) &&
    o.genes.length <= META_GENES &&
    o.genes.every((/** @type {unknown} */ g) => typeof g === 'string' && /^[a-z0-9_]{1,64}@[a-z0-9_]{1,64}$/.test(g)) &&
    new Set(o.genes).size === o.genes.length &&
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
  /* ON-3: a broken Showcase record is dropped on its own too */
  if (!validShowMeta(filled.show)) filled.show = newShowMeta();
  return validMeta(filled) ? filled : newMeta();
}
