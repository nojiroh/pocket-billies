// @ts-check
'use strict';
/* ================= PERKS ON A RUN (roguelite track RL-12) =================
   Where a run's Perks (perks.json) come from and how many are held:
   - a pick after each mini-boss: run.perks.pick Perks drawn by rarity weight from the run's own stream
     (rngFrom(run.seed, 'relic|' + run.offerN)), none already held. The offer is put in run.offer and saved before it
     is shown, so a reload shows the same ones; choosing one (or none) clears it;
   - one in each run shop, a day: drawn from the shop's node and the day the first time the shop opens that day, kept in
     run.shelf (so buying it doesn't put another on the shelf), '' once bought; its price by rarity;
   - at most run.perks.cap held: a new one past the cap takes the place of one the player lets go.
   They last the run: nothing of them is kept at the payout. Every Perk is on offer from the first run (the owner,
   RL-12); RL-11's unlocks may narrow the pool later.
   Logic only: no DOM, no Date, no Math.random (tools/test/perks.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/** @import { Perk } from '../../types/game-data' */
/** @typedef {{ cap: number, pick: number, rarity: Record<string, number>, price: Record<string, number> }} PerkRules */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { modHas } from './modifiers.js';
import { runNodeSeed } from './run-map.js';
import { runFxMoment } from './run-loop.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  perkBuy: [() => perkBuy, v => (perkBuy = v)],
  // @ts-expect-error -- replaced on purpose
  perkChoose: [() => perkChoose, v => (perkChoose = v)],
  // @ts-expect-error -- replaced on purpose
  perkCount: [() => perkCount, v => (perkCount = v)],
  // @ts-expect-error -- replaced on purpose
  perkDraw: [() => perkDraw, v => (perkDraw = v)],
  perkOffer: [() => perkOffer],
  // @ts-expect-error -- replaced on purpose
  perkOfferMake: [() => perkOfferMake, v => (perkOfferMake = v)],
  // @ts-expect-error -- replaced on purpose
  perkOfferOrder: [() => perkOfferOrder, v => (perkOfferOrder = v)],
  perkPool: [() => perkPool],
  perkPrice: [() => perkPrice],
  // @ts-expect-error -- replaced on purpose
  perkShelf: [() => perkShelf, v => (perkShelf = v)],
  // @ts-expect-error -- replaced on purpose
  perkTake: [() => perkTake, v => (perkTake = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** PK-3: what a held Perk's card and row show of its marks on the run (perks-track.md rule 4: no hidden numbers): a
 * counter as "5/8" for a row that acts every Nth time, "VOID" once a once-a-run row is spent ('' with neither). A
 * row's mark is run.perkState['<id>/<row>'] (effects.js fxKey: a Perk's rows come first among its source's)
 * @param {Run | null | undefined} run @param {string} id @param {Record<string, Perk>} perks */
export function perkCount(run, id, perks) {
  const P = perks[id],
    M = /** @type {Record<string, { n?: number, used?: number }>} */ ((run && run.perkState) || {}),
    out = /** @type {string[]} */ ([]);
  if (!P) return '';
  P.fx.forEach((f, i) => {
    const m = M[`${id}/${i}`] || {};
    if (f.once === 'run' && m.used) out.push('VOID');
    else if (f.every) out.push(`${m.n || 0}/${f.every}`);
  });
  return [...new Set(out)].join(' · ');
}

/** the Perks that may be drawn: in perks.json, not held, with a rarity weight above 0, in perks.json's order (RF-4:
 * was by id; the data's order lets an id change without changing a seed's offers)
 * @param {Run} run @param {Record<string, Perk>} perks @param {PerkRules} rule @param {string[]} [also] left out too */
export const perkPool = (run, perks, rule, also = []) =>
  /* RL-13: the "No Perks" challenge offers none at all (logic/modifiers.js) */
  modHas(run, 'noperks')
    ? []
    : Object.keys(perks).filter(
        id => !run.perks.includes(id) && !also.includes(id) && (rule.rarity[perks[id].rarity] || 0) > 0
      );

/** draw up to n Perks from a stream, by rarity weight, none twice @param {{ pick: (w: Record<string, number>) => string }} g
 * @param {string[]} pool @param {Record<string, Perk>} perks @param {PerkRules} rule @param {number} n */
export function perkDraw(g, pool, perks, rule, n) {
  const out = [];
  let left = pool.slice();
  while (out.length < n && left.length) {
    const id = g.pick(Object.fromEntries(left.map(k => [k, rule.rarity[perks[k].rarity]])));
    out.push(id);
    left = left.filter(k => k !== id);
  }
  return out;
}

/** the next pick's Perks (the run is not changed): run.offerN's stream, rule.pick of them, none held
 * @param {Run} run @param {Record<string, Perk>} perks @param {PerkRules} rule @returns {string[]} */
export const perkOffer = (run, perks, rule) =>
  perkDraw(rngFrom(run.seed, 'relic|' + run.offerN), perkPool(run, perks, rule), perks, rule, rule.pick);

/** make the next pick: run.offer is set (null when nothing is left to offer) and the counter moves on; the caller
 * saves before showing it @param {Run} run @param {Record<string, Perk>} perks @param {PerkRules} rule */
export function perkOfferMake(run, perks, rule) {
  const ids = perkOffer(run, perks, rule);
  run.offerN++;
  run.offer = ids.length ? ids : null;
  return run.offer;
}

/** a run shop's Perk on a day ('' when bought or none is left): drawn once from the shop's node and the day, then
 * kept in run.shelf @param {Run} run @param {number} i the shop's map node @param {number} day
 * @param {Record<string, Perk>} perks @param {PerkRules} rule @returns {string} */
export function perkShelf(run, i, day, perks, rule) {
  const key = i + ':' + day;
  if (Object.hasOwn(run.shelf, key)) return run.shelf[key];
  const id = perkDraw(
    rngFrom(runNodeSeed(run.seed, i), 'relic|shop|' + day),
    perkPool(run, perks, rule),
    perks,
    rule,
    1
  )[0];
  run.shelf[key] = id || '';
  return run.shelf[key];
}

/** what a shop asks for a Perk ($, by its rarity) @param {Perk} R @param {PerkRules} rule */
export const perkPrice = (R, rule) => rule.price[R.rarity] || 0;

/**
 * Hold a Perk: '' when done, or why not: 'none' (no such Perk), 'held' (already), 'full' (at the cap and no
 * `drop` given), 'drop' (`drop` isn't held). With `drop`, it takes that one's place. PK-1: with the save it is
 * taken on (`s`, s.run being `run`), its rows of the take moment act (run-loop.js runFxMoment)
 * @param {Run} run @param {string} id @param {Record<string, Perk>} perks @param {PerkRules} rule @param {string} [drop]
 * @param {any} [s]
 */
export function perkTake(run, id, perks, rule, drop, s) {
  if (!perks[id]) return 'none';
  if (run.perks.includes(id)) return 'held';
  if (drop != null) {
    const at = run.perks.indexOf(drop);
    if (at < 0) return 'drop';
    run.perks[at] = id;
  } else {
    if (run.perks.length >= rule.cap) return 'full';
    run.perks.push(id);
  }
  if (s && s.run === run) runFxMoment(s, perks, 'take', undefined, id);
  return '';
}

/**
 * The player's answer to the pick: one of the offer (with `drop` when at the cap), or null to take none. The offer
 * is cleared once answered; '' when done, else why not (perkTake's reasons, or 'offer': not one offered).
 * @param {Run} run @param {string | null} id @param {Record<string, Perk>} perks @param {PerkRules} rule
 * @param {string} [drop] @param {any} [s] the save, for the take moment (perkTake)
 */
export function perkChoose(run, id, perks, rule, drop, s) {
  if (!run.offer) return 'offer';
  if (id != null) {
    if (!run.offer.includes(id)) return 'offer';
    const why = perkTake(run, id, perks, rule, drop, s);
    if (why) return why;
  }
  run.offer = null;
  return '';
}

/**
 * Buy the shop's Perk for a day: '' when done (the shelf empties, the money is the caller's), or why not ('gone',
 * or perkTake's reasons).
 * @param {Run} run @param {number} i @param {number} day @param {Record<string, Perk>} perks @param {PerkRules} rule
 * @param {string} [drop] @param {any} [s] the save, for the take moment (perkTake)
 */
export function perkBuy(run, i, day, perks, rule, drop, s) {
  const key = i + ':' + day,
    id = run.shelf[key];
  if (!id) return 'gone';
  const why = perkTake(run, id, perks, rule, drop, s);
  if (!why) run.shelf[key] = '';
  return why;
}

/**
 * Studio plan T4.1: a seed's Perk picks in order, as the game makes them after each mini-boss (perkOfferMake on a
 * run of that seed, then perkChoose): what is offered at each pick and what is taken. `take` is who chooses: 'none'
 * takes nothing (the Run Lab's preview), 'first' the first offered, or a Perk's id, taken when offered (else
 * nothing). A taken one leaves the pool of the picks after it; past the cap nothing more is taken. Shops are left out.
 * @param {string} seed @param {Record<string, Perk>} perks @param {PerkRules} rule @param {number} picks
 * @param {string} [take] @returns {{ offer: string[], took: string | null }[]}
 */
export function perkOfferOrder(seed, perks, rule, picks, take = 'none') {
  const run = /** @type {Run} */ (/** @type {any} */ ({ seed, perks: [], offer: null, offerN: 0, shelf: {} })),
    out = [];
  for (let k = 0; k < picks; k++) {
    const offer = (perkOfferMake(run, perks, rule) || []).slice(),
      want = take === 'first' ? offer[0] : take !== 'none' && offer.includes(take) ? take : null,
      took = want && run.perks.length < rule.cap && !perkChoose(run, want, perks, rule) ? want : null;
    if (!took && run.offer) perkChoose(run, null, perks, rule);
    out.push({ offer, took });
  }
  return out;
}
