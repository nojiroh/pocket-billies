// @ts-check
'use strict';
/* ================= THE FOUNTAIN'S COIN (hub track HB-10d) =================
   A coin tossed into the square's fountain: a small gamble, once each time you come home (the owner, 2026-10-26).
   It costs a little Scrap (rules.json square.wish.cost) and rolls one outcome by weight (square.wish.outcomes): mostly
   a small boon for the next run's first places or a joke, now and then a small curse, rarely a big win paid at once.
   Once per return: meta.wish keeps the toss stamped with meta.runs (the gift's way, logic/relations.js), so the next
   toss waits for the next run's end. The roll comes from meta.runs and the last run's seed, so a reload tosses the
   same coin. A boon or curse waits in meta.wish until the next take-off, when it becomes an event boon of the run
   (run.enc.boons, src `fountain`: fxOfRun reads it, encArrive counts its places down) and an item given goes into
   the bag. Only the outcome's id is kept: what it does is read from the rules when it is used (meta-state.js
   validWish checks what is stored).
   Logic only: no DOM, no Date, no Math.random (tools/test/fountain-wish.test.mjs). */
/** @import { Meta, Run } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { rngFrom } from './rng.js';
import { encBoon } from './run-enc.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  wishCan: [() => wishCan, v => (wishCan = v)],
  // @ts-expect-error -- replaced on purpose
  wishOutcome: [() => wishOutcome, v => (wishOutcome = v)],
  // @ts-expect-error -- replaced on purpose
  wishRoll: [() => wishRoll, v => (wishRoll = v)],
  // @ts-expect-error -- replaced on purpose
  wishSaid: [() => wishSaid, v => (wishSaid = v)],
  // @ts-expect-error -- replaced on purpose
  wishTakeoff: [() => wishTakeoff, v => ((wishTakeoff = v), provide({ wishTakeoff }))],
  // @ts-expect-error -- replaced on purpose
  wishToss: [() => wishToss, v => (wishToss = v)],
});
/* eslint-enable no-func-assign */
provide({ wishTakeoff });
/* to-module: end */
/** @typedef {{ id: string, w: number, say: string[], fx?: any[], places?: number, give?: Record<string, number>,
 * pay?: Record<string, number> }} WishOutcome  one way a toss can go */
/** @typedef {{ cost: { cur: string, n: number }, outcomes: WishOutcome[] }} WishRules  rules.json square.wish */

/** whether a coin can be tossed now: 'ok', 'done' (tossed since the last run ended) or 'poor' (not enough to pay)
 * @param {Meta} meta @param {WishRules} R @returns {'ok' | 'done' | 'poor'} */
export function wishCan(meta, R) {
  if (meta.wish && meta.wish.at === meta.runs) return 'done';
  const have = /** @type {any} */ (meta)[R.cost.cur] || 0;
  return have >= R.cost.n ? 'ok' : 'poor';
}

/** the outcome a toss gives (its rules row), by id @param {WishRules} R @param {string} id
 * @returns {WishOutcome | null} */
export function wishOutcome(R, id) {
  return R.outcomes.find(o => o.id === id) || null;
}

/** toss the coin: pay, roll, keep the toss, pay a big win at once. Returns the outcome and the line to show, or null
 * when it can't be tossed now (wishCan) @param {Meta} meta @param {WishRules} R
 * @returns {{ out: WishOutcome, say: string } | null} */
export function wishToss(meta, R) {
  if (wishCan(meta, R) !== 'ok') return null;
  const { out, say } = wishRoll(meta, R),
    M = /** @type {any} */ (meta);
  M[R.cost.cur] = (M[R.cost.cur] || 0) - R.cost.n;
  for (const [cur, n] of Object.entries(out.pay || {})) M[cur] = Math.min(1e12, (M[cur] || 0) + n);
  meta.wish = { at: meta.runs, out: out.id };
  if (!(out.fx && out.fx.length) && !out.give) meta.wish.used = 1;
  return { out, say };
}

/** the coin this return tosses: the outcome and its line, from meta.runs and the last run's seed (the same coin
 * however often the game is reloaded) @param {Meta} meta @param {WishRules} R
 * @returns {{ out: WishOutcome, say: string }} */
export function wishRoll(meta, R) {
  const H = meta.history || [],
    last = H.length ? H[H.length - 1].seed : '',
    rng = rngFrom(`${meta.runs}|${last}`, 'fountain-wish'),
    id = rng.pick(Object.fromEntries(R.outcomes.map(o => [o.id, o.w]))),
    out = /** @type {WishOutcome} */ (wishOutcome(R, id));
  return { out, say: out.say[Math.floor(rng.next() * out.say.length)] };
}

/** what the coin tossed since the last run said (the notice board shows it), or null when none was
 * @param {Meta} meta @param {WishRules} R @returns {string | null} */
export function wishSaid(meta, R) {
  const W = meta.wish;
  if (!W || W.at !== meta.runs) return null;
  const r = wishRoll(meta, R);
  return r.out.id === W.out ? r.say : null;
}

/** a run takes off: a boon or curse tossed since the last run joins it (an event boon for its places) and an item
 * given goes into the bag; then it is used. Returns the outcome used, or null
 * @param {{ meta?: Meta, run?: Run | null, items?: Record<string, number> }} s @param {WishRules} R
 * @returns {WishOutcome | null} */
export function wishTakeoff(s, R) {
  const W = s.meta && s.meta.wish;
  if (!W || W.used || !s.run || !s.meta || W.at !== s.meta.runs) return null;
  const out = wishOutcome(R, W.out);
  W.used = 1;
  if (!out) return null;
  if (out.fx && out.fx.length) encBoon(s.run, out.fx, out.places || 0, 'fountain');
  for (const [k, n] of Object.entries(out.give || {})) {
    const bag = s.items || (s.items = {});
    bag[k] = (bag[k] || 0) + n;
  }
  return out;
}
