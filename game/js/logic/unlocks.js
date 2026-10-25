// @ts-check
'use strict';
/* ================= UNLOCKS (roguelite track RL-11) =================
   The one unlock table (game/data/unlocks.json) and its three doors: a row is sold at a building (`at` and `cost`, in
   that building's currency, buildings.json; the Lab's rows are its board), or earned when a condition holds (`when`,
   checked in the hub after a run and on load). What is owned is saveData.meta.unlocks (id -> 1). A grant gives a
   building's level (saveData.meta.buildings, which tidy rebuilds from the owned rows so the two can't drift apart),
   an item into run shops, a biome onto run maps, or a currency.
   A run copies the shop and biome unlocks it starts with (run.unlocks), and its shops and map read that copy, so the
   same seed and the same copy always make the same run. A run saved before RL-11 has no copy: everything is open
   for it, as it was when it started. Earned rows are never granted on a run.
   The tables are passed in (`D`: {unlocks, buildings}); logic only: no DOM, runs in Node (tools/test/unlocks.test.mjs). */
/** @import { SaveData, Run } from '../../types/save-data' */
/** @import { Unlock, HubBuilding } from '../../types/game-data' */
/** @typedef {{ unlocks: Record<string, Unlock>, buildings: Record<string, HubBuilding> }} UnlockData */
/** @typedef {'unknown' | 'owned' | 'earned' | 'soon' | 'requires' | 'run' | 'cost'} UnlockRefusal */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { META_MAX } from './meta-state.js';
import { conditionHolds, storyStateOf } from './conditions.js';
/* eslint-disable no-func-assign */
expose({
  buildingLevel: [() => buildingLevel],
  // @ts-expect-error -- replaced on purpose
  runUnlocks: [() => runUnlocks, v => (runUnlocks = v)],
  // @ts-expect-error -- replaced on purpose
  unlockAuto: [() => unlockAuto, v => (unlockAuto = v)],
  // @ts-expect-error -- replaced on purpose
  unlockBuy: [() => unlockBuy, v => (unlockBuy = v)],
  unlockCurrency: [() => unlockCurrency],
  unlockDoor: [() => unlockDoor],
  // @ts-expect-error -- replaced on purpose
  unlockGrant: [() => unlockGrant, v => (unlockGrant = v)],
  // @ts-expect-error -- replaced on purpose
  unlockOpen: [() => unlockOpen, v => ((unlockOpen = v), provide({ unlockOpen }))],
  // @ts-expect-error -- replaced on purpose
  unlockReady: [() => unlockReady, v => (unlockReady = v)],
  // @ts-expect-error -- replaced on purpose
  unlockRows: [() => unlockRows, v => (unlockRows = v)],
  // @ts-expect-error -- replaced on purpose
  unlockTidy: [() => unlockTidy, v => ((unlockTidy = v), provide({ unlockTidy }))],
});
/* eslint-enable no-func-assign */
provide({ unlockOpen, unlockTidy });
/* to-module: end */
/** where a row is got: on the Lab's board, at another building, or earned by its condition
 * @param {Unlock} R @returns {'board' | 'building' | 'earned'} */
export const unlockDoor = R => (R.when ? 'earned' : R.at === 'lab' ? 'board' : 'building');
/** the currency a sold row is paid in (its building's), null for an earned one
 * @param {Unlock} R @param {UnlockData} D @returns {'research' | 'scrap' | 'crests' | 'dna' | null} */
export const unlockCurrency = (R, D) => (R.at && D.buildings[R.at] ? D.buildings[R.at].currency : null);
/** a building's level: 1 until an unlock raises it @param {SaveData} s @param {string} b */
export const buildingLevel = (s, b) => Math.max(1, (s.meta && s.meta.buildings && s.meta.buildings[b]) || 1);

/** null when the row can be bought now, else why not: unknown id, owned already, earned (not sold), its building is
 * coming later, a row it needs isn't owned, a run is on (unlocks are bought in the hub), or not enough of its currency
 * @param {SaveData} s @param {string} id @param {UnlockData} D @returns {UnlockRefusal | null} */
export function unlockReady(s, id, D) {
  const R = D.unlocks[id];
  if (!R) return 'unknown';
  if (s.meta.unlocks[id]) return 'owned';
  if (R.when) return 'earned';
  if (!D.buildings[/** @type {string} */ (R.at)] || D.buildings[/** @type {string} */ (R.at)].soon) return 'soon';
  if ((R.requires || []).some(r => !s.meta.unlocks[r])) return 'requires';
  if (s.run) return 'run';
  const c = unlockCurrency(R, D);
  return c && s.meta[c] >= (R.cost || 0) ? null : 'cost';
}
/** what a row gives, onto the save's meta (owning it is the caller's) @param {SaveData} s @param {Unlock} R */
export function unlockGrant(s, R) {
  const G = /** @type {any} */ (R.grant);
  if (G.building) s.meta.buildings[G.building] = Math.max(buildingLevel(s, G.building), G.level);
  for (const c of /** @type {const} */ (['research', 'scrap', 'crests', 'dna']))
    if (G[c]) s.meta[c] = Math.min(META_MAX, s.meta[c] + G[c]);
}
/** buy a sold row: pays its cost in its building's currency, owns it and grants it. Returns whether it was bought
 * @param {SaveData} s @param {string} id @param {UnlockData} D */
export function unlockBuy(s, id, D) {
  if (unlockReady(s, id, D)) return false;
  const R = D.unlocks[id],
    c = /** @type {'research' | 'scrap' | 'crests' | 'dna'} */ (unlockCurrency(R, D));
  s.meta[c] -= R.cost || 0;
  s.meta.unlocks[id] = 1;
  unlockGrant(s, R);
  return true;
}
/** grant every earned row whose condition holds and whose needs are owned (again until none more: a condition may read
 * another unlock), in the hub only; returns the ids granted, in the table's order
 * @param {SaveData} s @param {UnlockData} D @returns {string[]} */
export function unlockAuto(s, D) {
  /** @type {string[]} */
  const got = [];
  if (s.run) return got;
  for (let more = true; more;) {
    more = false;
    const S = storyStateOf(s);
    for (const [id, R] of Object.entries(D.unlocks)) {
      if (!R.when || s.meta.unlocks[id] || (R.requires || []).some(r => !s.meta.unlocks[r])) continue;
      let holds = false;
      try {
        holds = conditionHolds(R.when, S);
      } catch {
        /* a condition that doesn't read (check-data refuses it) is never met */
      }
      if (!holds) continue;
      s.meta.unlocks[id] = 1;
      unlockGrant(s, R);
      got.push(id);
      more = true;
    }
  }
  return got;
}
/** on load: forget owned ids the table no longer has, and set each building's level from the owned rows (1 when none
 * raises it), so meta.buildings always follows meta.unlocks @param {SaveData} s @param {UnlockData} D */
export function unlockTidy(s, D) {
  for (const id of Object.keys(s.meta.unlocks)) if (!D.unlocks[id]) delete s.meta.unlocks[id];
  /** @type {Record<string, number>} */
  const levels = {};
  for (const id of Object.keys(s.meta.unlocks)) {
    const G = /** @type {any} */ (D.unlocks[id].grant),
      B = G.building && D.buildings[G.building];
    if (B) levels[G.building] = Math.min(B.levels, Math.max(levels[G.building] || 1, G.level));
  }
  s.meta.buildings = levels;
}
/** the shop and biome unlocks a run starts with, sorted (run.unlocks) @param {SaveData} s @param {UnlockData} D */
export function runUnlocks(s, D) {
  return Object.keys(s.meta.unlocks)
    .filter(id => {
      const G = /** @type {any} */ ((D.unlocks[id] || {}).grant || {});
      return !!(G.shop || G.biome);
    })
    .sort();
}
/** a weight table (rules.json run.shop.pick or run.map.biomes) with what the run hasn't unlocked left out: an entry a
 * row of the table grants is locked unless that row is in the run's copy; a run without a copy (saved before RL-11)
 * has everything open
 * @template {Record<string, number>} W @param {W} weights @param {'shop' | 'biome'} kind
 * @param {string[] | undefined} owned the run's copy (run.unlocks) @param {UnlockData} D @returns {W} */
export function unlockOpen(weights, kind, owned, D) {
  if (!owned) return weights;
  const mine = new Set(owned),
    /** @type {Set<string>} */ locked = new Set(),
    /** @type {Set<string>} */ open = new Set();
  for (const [id, R] of Object.entries(D.unlocks)) {
    const k = /** @type {any} */ (R.grant)[kind];
    if (!k) continue;
    locked.add(k);
    if (mine.has(id)) open.add(k);
  }
  return /** @type {W} */ (Object.fromEntries(Object.entries(weights).filter(([k]) => !locked.has(k) || open.has(k))));
}
/** the Lab board's rows: each row with where it is got, its currency, whether it is owned, and why it can't be bought
 * now (null: it can) @param {SaveData} s @param {UnlockData} D */
export function unlockRows(s, D) {
  return Object.entries(D.unlocks).map(([id, R]) => ({
    id,
    R,
    door: unlockDoor(R),
    currency: unlockCurrency(R, D),
    owned: !!s.meta.unlocks[id],
    why: unlockReady(s, id, D),
  }));
}
