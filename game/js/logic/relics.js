// @ts-check
'use strict';
/* ================= LOOPHOLES ON A RUN (roguelite track RL-12) =================
   Where a run's Loopholes (relics.json) come from and how many are held:
   - a pick after each mini-boss: run.relics.pick Loopholes drawn by rarity weight from the run's own stream
     (rngFrom(run.seed, 'relic|' + run.offerN)), none already held. The offer is put in run.offer and saved before it
     is shown, so a reload shows the same ones; choosing one (or none) clears it;
   - one in each run shop, a day: drawn from the shop's node and the day the first time the shop opens that day, kept in
     run.shelf (so buying it doesn't put another on the shelf), '' once bought; its price by rarity;
   - at most run.relics.cap held: a new one past the cap takes the place of one the player lets go.
   They last the run: nothing of them is kept at the payout. Every Loophole is on offer from the first run (the owner,
   RL-12); RL-11's unlocks may narrow the pool later.
   Logic only: no DOM, no Date, no Math.random (tools/test/relics.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/** @import { Relic } from '../../types/game-data' */
/** @typedef {{ cap: number, pick: number, rarity: Record<string, number>, price: Record<string, number> }} RelicRules */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { runNodeSeed } from './run-map.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  relicBuy: [() => relicBuy, v => (relicBuy = v)],
  // @ts-expect-error -- replaced on purpose
  relicChoose: [() => relicChoose, v => (relicChoose = v)],
  // @ts-expect-error -- replaced on purpose
  relicDraw: [() => relicDraw, v => (relicDraw = v)],
  relicOffer: [() => relicOffer],
  // @ts-expect-error -- replaced on purpose
  relicOfferMake: [() => relicOfferMake, v => (relicOfferMake = v)],
  // @ts-expect-error -- replaced on purpose
  relicOfferOrder: [() => relicOfferOrder, v => (relicOfferOrder = v)],
  relicPool: [() => relicPool],
  relicPrice: [() => relicPrice],
  // @ts-expect-error -- replaced on purpose
  relicShelf: [() => relicShelf, v => (relicShelf = v)],
  // @ts-expect-error -- replaced on purpose
  relicTake: [() => relicTake, v => (relicTake = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the Loopholes that may be drawn: in relics.json, not held, with a rarity weight above 0, by id
 * @param {Run} run @param {Record<string, Relic>} relics @param {RelicRules} rule @param {string[]} [also] left out too */
export const relicPool = (run, relics, rule, also = []) =>
  Object.keys(relics)
    .filter(id => !run.relics.includes(id) && !also.includes(id) && (rule.rarity[relics[id].rarity] || 0) > 0)
    .sort();

/** draw up to n Loopholes from a stream, by rarity weight, none twice @param {{ pick: (w: Record<string, number>) => string }} g
 * @param {string[]} pool @param {Record<string, Relic>} relics @param {RelicRules} rule @param {number} n */
export function relicDraw(g, pool, relics, rule, n) {
  const out = [];
  let left = pool.slice();
  while (out.length < n && left.length) {
    const id = g.pick(Object.fromEntries(left.map(k => [k, rule.rarity[relics[k].rarity]])));
    out.push(id);
    left = left.filter(k => k !== id);
  }
  return out;
}

/** the next pick's Loopholes (the run is not changed): run.offerN's stream, rule.pick of them, none held
 * @param {Run} run @param {Record<string, Relic>} relics @param {RelicRules} rule @returns {string[]} */
export const relicOffer = (run, relics, rule) =>
  relicDraw(rngFrom(run.seed, 'relic|' + run.offerN), relicPool(run, relics, rule), relics, rule, rule.pick);

/** make the next pick: run.offer is set (null when nothing is left to offer) and the counter moves on; the caller
 * saves before showing it @param {Run} run @param {Record<string, Relic>} relics @param {RelicRules} rule */
export function relicOfferMake(run, relics, rule) {
  const ids = relicOffer(run, relics, rule);
  run.offerN++;
  run.offer = ids.length ? ids : null;
  return run.offer;
}

/** a run shop's Loophole on a day ('' when bought or none is left): drawn once from the shop's node and the day, then
 * kept in run.shelf @param {Run} run @param {number} i the shop's map node @param {number} day
 * @param {Record<string, Relic>} relics @param {RelicRules} rule @returns {string} */
export function relicShelf(run, i, day, relics, rule) {
  const key = i + ':' + day;
  if (Object.hasOwn(run.shelf, key)) return run.shelf[key];
  const id = relicDraw(
    rngFrom(runNodeSeed(run.seed, i), 'relic|shop|' + day),
    relicPool(run, relics, rule),
    relics,
    rule,
    1
  )[0];
  run.shelf[key] = id || '';
  return run.shelf[key];
}

/** what a shop asks for a Loophole ($, by its rarity) @param {Relic} R @param {RelicRules} rule */
export const relicPrice = (R, rule) => rule.price[R.rarity] || 0;

/**
 * Hold a Loophole: '' when done, or why not: 'none' (no such Loophole), 'held' (already), 'full' (at the cap and no
 * `drop` given), 'drop' (`drop` isn't held). With `drop`, it takes that one's place.
 * @param {Run} run @param {string} id @param {Record<string, Relic>} relics @param {RelicRules} rule @param {string} [drop]
 */
export function relicTake(run, id, relics, rule, drop) {
  if (!relics[id]) return 'none';
  if (run.relics.includes(id)) return 'held';
  if (drop != null) {
    const at = run.relics.indexOf(drop);
    if (at < 0) return 'drop';
    run.relics[at] = id;
    return '';
  }
  if (run.relics.length >= rule.cap) return 'full';
  run.relics.push(id);
  return '';
}

/**
 * The player's answer to the pick: one of the offer (with `drop` when at the cap), or null to take none. The offer
 * is cleared once answered; '' when done, else why not (relicTake's reasons, or 'offer': not one offered).
 * @param {Run} run @param {string | null} id @param {Record<string, Relic>} relics @param {RelicRules} rule
 * @param {string} [drop]
 */
export function relicChoose(run, id, relics, rule, drop) {
  if (!run.offer) return 'offer';
  if (id != null) {
    if (!run.offer.includes(id)) return 'offer';
    const why = relicTake(run, id, relics, rule, drop);
    if (why) return why;
  }
  run.offer = null;
  return '';
}

/**
 * Buy the shop's Loophole for a day: '' when done (the shelf empties, the money is the caller's), or why not ('gone',
 * or relicTake's reasons).
 * @param {Run} run @param {number} i @param {number} day @param {Record<string, Relic>} relics @param {RelicRules} rule
 * @param {string} [drop]
 */
export function relicBuy(run, i, day, relics, rule, drop) {
  const key = i + ':' + day,
    id = run.shelf[key];
  if (!id) return 'gone';
  const why = relicTake(run, id, relics, rule, drop);
  if (!why) run.shelf[key] = '';
  return why;
}

/**
 * Studio plan T4.1: a seed's Loophole picks in order, as the game makes them after each mini-boss (relicOfferMake on a
 * run of that seed, then relicChoose): what is offered at each pick and what is taken. `take` is who chooses: 'none'
 * takes nothing (the Run Lab's preview), 'first' the first offered, or a Loophole's id, taken when offered (else
 * nothing). A taken one leaves the pool of the picks after it; past the cap nothing more is taken. Shops are left out.
 * @param {string} seed @param {Record<string, Relic>} relics @param {RelicRules} rule @param {number} picks
 * @param {string} [take] @returns {{ offer: string[], took: string | null }[]}
 */
export function relicOfferOrder(seed, relics, rule, picks, take = 'none') {
  const run = /** @type {Run} */ (/** @type {any} */ ({ seed, relics: [], offer: null, offerN: 0, shelf: {} })),
    out = [];
  for (let k = 0; k < picks; k++) {
    const offer = (relicOfferMake(run, relics, rule) || []).slice(),
      want = take === 'first' ? offer[0] : take !== 'none' && offer.includes(take) ? take : null,
      took = want && run.relics.length < rule.cap && !relicChoose(run, want, relics, rule) ? want : null;
    if (!took && run.offer) relicChoose(run, null, relics, rule);
    out.push({ offer, took });
  }
  return out;
}
