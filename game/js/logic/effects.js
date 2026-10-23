// @ts-check
'use strict';
/* ================= EFFECTS (roguelite track RL-12) =================
   What a run's Perks (perks.json) change, as effect rows read at named points of the game (roguelite-track.md 2d;
   phase 19's handler-table idea). A Perk is data: a list of rows, each of one kind in FX_KINDS. fxRows turns the
   ids held into one list; each point asks only for its kind:
     money   a won battle's money (battle-rewards.js)         price   a run shop's prices, a run clinic's charge
     catch   a coin's chance to catch (catchOdds)              stat    stat stages for your Billies as a battle starts
     damage  what your Billies deal or take (calcDamage)       heal    a share of HP on walking into a place
     payout  the payout's Research, or the share items count at
   Stacking: rows of one kind combine whatever order they were picked in. Stages and shares add up; multipliers are
   multiplied smallest first (the same product for any order), and the product stays within FX_LIMIT, so a run holding
   every Perk stays finite. With no rows every answer is the number it was given (a multiplier of exactly 1), so a
   battle or a run without Perks is the same as before them. Later sessions add rows from other places into the same
   list (RL-11 building levels, RL-13 expeditions).
   Logic only: no DOM, no Date, no Math.random (tools/test/effects.test.mjs). */
/** @import { FxRow, Perk } from '../../types/game-data' */
/** @typedef {FxRow & { src: string }} Fx */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { encBoonRows } from './run-enc.js';
/* eslint-disable no-func-assign */
expose({
  FX_KINDS: [() => FX_KINDS],
  FX_LIMIT: [() => FX_LIMIT],
  FX_STAGES: [() => FX_STAGES],
  fxCatch: [() => fxCatch],
  // @ts-expect-error -- replaced on purpose
  fxDamage: [() => fxDamage, v => (fxDamage = v)],
  fxHealShare: [() => fxHealShare],
  fxMoney: [() => fxMoney],
  // @ts-expect-error -- replaced on purpose
  fxMult: [() => fxMult, v => (fxMult = v)],
  fxOfRun: [() => fxOfRun],
  // @ts-expect-error -- replaced on purpose
  fxPayoutRates: [() => fxPayoutRates, v => (fxPayoutRates = v)],
  fxPrice: [() => fxPrice],
  fxRows: [() => fxRows],
  fxRunPrice: [() => fxRunPrice],
  // @ts-expect-error -- replaced on purpose
  fxStages: [() => fxStages, v => (fxStages = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const FX_KINDS = /** @type {const} */ (['money', 'price', 'catch', 'stat', 'damage', 'heal', 'payout']);
/** a product of multipliers stays within these */
export const FX_LIMIT = { lo: 0.1, hi: 4 };
/** stat stages from effects stay within these (the battle clamps again to its own stageMax) */
export const FX_STAGES = 6;

/** the effect rows of the Perks held, in the order held, each tagged with its Perk's id; an id with no entry
 * gives none @param {string[]} ids @param {Record<string, Perk>} perks @returns {Fx[]} */
export const fxRows = (ids, perks) =>
  ids.flatMap(id => (perks[id] ? perks[id].fx.map(f => /** @type {Fx} */ ({ ...f, src: id })) : []));

/** the effect rows of a run's Perks and its events' boons (null in the hub, or with none) @param {{ perks: string[] } | null | undefined} run
 * @param {Record<string, Perk>} perks @returns {Fx[] | null} */
export const fxOfRun = (run, perks) => {
  /* RL-12b: an event's boons (logic/run-enc.js) after the Perks' rows */
  const rows = run ? [...fxRows(run.perks, perks), ...encBoonRows(/** @type {any} */ (run))] : [];
  return rows.length ? rows : null;
};
provide({ fxOfRun }); /* to-module */

/** the product of the multipliers of the rows that pass `test`, smallest first, within FX_LIMIT (1 when none)
 * @param {Fx[] | null | undefined} fx @param {(f: Fx) => boolean} test */
export function fxMult(fx, test) {
  const m = (fx || [])
    .filter(test)
    .map(f => /** @type {number} */ (/** @type {any} */ (f).mult))
    .sort((a, b) => a - b);
  if (!m.length) return 1;
  const p = m.reduce((a, b) => a * b, 1);
  return Math.min(FX_LIMIT.hi, Math.max(FX_LIMIT.lo, p));
}

/** a won battle's money with the money rows (whole $) @param {Fx[] | null | undefined} fx @param {number} n */
export const fxMoney = (fx, n) => {
  const k = fxMult(fx, f => f.kind === 'money');
  return k === 1 ? n : Math.round(n * k);
};

/** a price on the run with the price rows of `what` (whole $, never below 0)
 * @param {Fx[] | null | undefined} fx @param {'shop' | 'heal'} what @param {number} n */
export const fxPrice = (fx, what, n) => {
  const k = fxMult(fx, f => f.kind === 'price' && f.what === what);
  return k === 1 ? n : Math.max(0, Math.round(n * k));
};

/** Studio plan T3.2: a price on a run with its Perks' price rows of `what` (the page's clinic and shops, and the
 * run's simulation): the price itself with no run or none held @param {{ perks: string[] } | null | undefined} run
 * @param {Record<string, Perk>} perks @param {'shop' | 'heal'} what @param {number} n */
export const fxRunPrice = (run, perks, what, n) => fxPrice(fxOfRun(run, perks), what, n);

/** what multiplies a coin's chance to catch (the chance itself stays at most 1) @param {Fx[] | null | undefined} fx */
export const fxCatch = fx => fxMult(fx, f => f.kind === 'catch');

/**
 * What multiplies a hit's damage: the deal rows when one of yours hits, the take rows when one of yours is hit (both
 * when one of yours hits another of yours). A row with a category or a type counts only for a move of it.
 * @param {Fx[] | null | undefined} fx
 * @param {{ cat: string, type: string, deal: boolean, take: boolean }} hit the move's category (H, S, X) and type
 */
export function fxDamage(fx, hit) {
  if (!fx || !fx.length || (!hit.deal && !hit.take)) return 1;
  return fxMult(
    fx,
    f =>
      f.kind === 'damage' &&
      ((f.side === 'deal' && hit.deal) || (f.side === 'take' && hit.take)) &&
      (!f.cat || f.cat === hit.cat) &&
      (!f.type || f.type === hit.type)
  );
}

/** the stat stages your Billies on the field get as a battle starts, by stat (summed, within FX_STAGES; none: {})
 * @param {Fx[] | null | undefined} fx @returns {Record<string, number>} */
export function fxStages(fx) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const f of fx || []) if (f.kind === 'stat') out[f.stat] = (out[f.stat] || 0) + f.stages;
  for (const k of Object.keys(out)) {
    out[k] = Math.max(-FX_STAGES, Math.min(FX_STAGES, out[k]));
    if (!out[k]) delete out[k];
  }
  return out;
}

/** the share of HP walking into a place heals (summed, at most 1; 0 when none) @param {Fx[] | null | undefined} fx */
export const fxHealShare = fx =>
  Math.min(
    1,
    (fx || []).reduce((a, f) => a + (f.kind === 'heal' ? f.share : 0), 0)
  );
provide({ fxHealShare }); /* to-module */

/**
 * The payout's rates with the payout rows: `itemShare` times its rows (at most 1: an item never counts above its
 * price) and `research`, what the payout's Research is multiplied by (1 when none). The other rates as they were.
 * @template {{ itemShare: number }} R
 * @param {Fx[] | null | undefined} fx @param {R} rates @returns {R & { research: number }}
 */
export function fxPayoutRates(fx, rates) {
  const share = fxMult(fx, f => f.kind === 'payout' && f.what === 'itemShare');
  return {
    ...rates,
    itemShare: share === 1 ? rates.itemShare : Math.min(1, rates.itemShare * share),
    research: fxMult(fx, f => f.kind === 'payout' && f.what === 'research'),
  };
}
