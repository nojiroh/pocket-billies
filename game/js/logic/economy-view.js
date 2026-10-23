// @ts-check
'use strict';
/* ================= THE ECONOMY, AS A LIST (Studio plan Phase 4, T4.4) =================
   Where each currency comes from and where it goes, read from the data the game reads it from, so the Studio's
   Economy page can list them with a link to each field (the plan's "economy editor": no economy data model of its own).
   - money ($, a run's): wild prizes (rules.json encounters.prizePerLevel x the level, logic/rules.js wildPrize), the
     mini-boss's and boss's rewards (run.foes), Perks' money rows; spent at the clinic (run.healCost a hurt Billie),
     on run shop wares (items.json and coins.json price; what run.shop can stock) and shop Perks (run.perks.price);
   - at the payout (logic/run-state.js payoutOf) money, items, released Billies, places and a win turn into Research,
     Scrap and Crests (run.payout);
   - Research, Scrap and Crests (kept between runs): the earned unlock rows' grants, and each building's unlock costs
     (unlocks.json, in its building's currency); the ranch's training and breeding (rules.json ranch, edited beside
     the buildings in Unlocks & hub).
   Each line: the currency, 'in' (a source), 'out' (a sink) or 'turn' (the payout's rate), what it is, its value, the
   data path (a field's data-p) and the Studio section that edits it.
   Logic only: no DOM, runs in Node (tools/test/economy-view.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ECONOMY_PAYOUT: [() => ECONOMY_PAYOUT],
  // @ts-expect-error -- replaced on purpose
  economyLines: [() => economyLines, v => (economyLines = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ currency: string, side: 'in' | 'out' | 'turn', what: string, value: number, unit?: string, path: string, section: string }} EconomyLine */

/** the payout's rates: what each turns into, and of what @type {Record<string, [string, string]>} */
export const ECONOMY_PAYOUT = {
  money: ['capital', 'Research per Money brought home'],
  itemShare: ['capital', 'Share of an item’s price, as Research'],
  released: ['capital', 'Research per Billie caught on the run and released'],
  node: ['capital', 'Research per place cleared'],
  win: ['capital', 'Research for a win'],
  winSeals: ['seals', 'Crests for a win'],
  scrapNode: ['scrap', 'Scrap per place cleared'],
  scrapWin: ['scrap', 'Scrap for a win'],
};

/**
 * Every source and sink in the data, by currency (currencies.json order), sources first.
 * @param {any} D the game data's sections @returns {EconomyLine[]}
 */
export function economyLines(D) {
  /** @type {EconomyLine[]} */
  const out = [],
    R = (D.rules && D.rules.run) || {},
    add = (/** @type {EconomyLine} */ l) => out.push(l),
    shop = R.shop || {},
    stocked = new Set([...Object.keys(shop.pick || {}), ...(shop.always || [])]);
  const prize = D.rules && D.rules.encounters && D.rules.encounters.prizePerLevel;
  if (typeof prize === 'number')
    add({
      currency: 'money',
      side: 'in',
      what: 'Wild Billie beaten: $ per level',
      value: prize,
      path: 'rules.encounters.prizePerLevel',
      section: 'rules',
    });
  for (const [k, F] of Object.entries(R.foes || {}))
    add({
      currency: 'money',
      side: 'in',
      what: `${(D.nodeTypes && D.nodeTypes[k] && D.nodeTypes[k].name) || k} beaten`,
      value: /** @type {any} */ (F).reward,
      path: `rules.run.foes.${k}.reward`,
      section: 'runlab',
    });
  for (const [k, L] of Object.entries(D.perks || {}))
    /** @type {any} */ (L.fx || []).forEach((/** @type {any} */ f, n) => {
      if (f.kind === 'money')
        add({
          currency: 'money',
          side: 'in',
          what: `Perk ${L.name || k}: wins pay ×${f.mult}`,
          value: f.mult,
          unit: '×',
          path: `perks.${k}.fx.${n}.mult`,
          section: 'relics',
        });
    });
  if (typeof R.healCost === 'number')
    add({
      currency: 'money',
      side: 'out',
      what: 'Town clinic: $ per hurt Billie',
      value: R.healCost,
      path: 'rules.run.healCost',
      section: 'runlab',
    });
  for (const id of [...stocked].sort()) {
    const coin = id.startsWith('coin:'),
      k = coin ? id.slice(5) : id,
      T = coin ? D.coins && D.coins[k] : D.items && D.items[k];
    if (T)
      add({
        currency: 'money',
        side: 'out',
        what: `Run shop: ${T.n || k}${(shop.always || []).includes(id) ? ' (always stocked)' : ''}`,
        value: T.price,
        path: `${coin ? 'coins' : 'items'}.${k}.price`,
        section: 'items',
      });
  }
  for (const [r, p] of Object.entries((R.perks && R.perks.price) || {}))
    add({
      currency: 'money',
      side: 'out',
      what: `Run shop: a ${r} Perk`,
      value: /** @type {number} */ (p),
      path: `rules.run.perks.price.${r}`,
      section: 'relics',
    });
  for (const [k, v] of Object.entries(R.payout || {}))
    if (ECONOMY_PAYOUT[k])
      add({
        currency: ECONOMY_PAYOUT[k][0],
        side: 'turn',
        what: ECONOMY_PAYOUT[k][1],
        value: /** @type {number} */ (v),
        path: `rules.run.payout.${k}`,
        section: 'runlab',
      });
  const B = D.buildings || {};
  for (const [k, U] of Object.entries(D.unlocks || {})) {
    const G = /** @type {any} */ (U).grant || {};
    for (const c of ['capital', 'scrap', 'seals'])
      if (G[c])
        add({
          currency: c,
          side: 'in',
          what: `Earned: ${U.name || k}${U.when ? ` (${U.when})` : ''}`,
          value: G[c],
          path: `unlocks.${k}.grant.${c}`,
          section: 'unlocks',
        });
    if (!U.when && U.at && B[U.at])
      add({
        currency: B[U.at].currency,
        side: 'out',
        what: `${B[U.at].name || U.at}: ${U.name || k}`,
        value: U.cost || 0,
        path: `unlocks.${k}.cost`,
        section: 'unlocks',
      });
  }
  const RA = (D.rules && D.rules.ranch) || {};
  if (typeof RA.trainCost === 'number')
    add({
      currency: 'scrap',
      side: 'out',
      what: 'Ranch: a Billie put in training',
      value: RA.trainCost,
      path: 'rules.ranch.trainCost',
      section: 'unlocks',
    });
  for (const k of ['safeCost', 'riskyCost'])
    if (RA.breed && typeof RA.breed[k] === 'number')
      add({
        currency: 'scrap',
        side: 'out',
        what: `Ranch: a ${k === 'safeCost' ? 'safe' : 'risky'} breeding`,
        value: RA.breed[k],
        path: `rules.ranch.breed.${k}`,
        section: 'unlocks',
      });
  const order = Object.keys(D.currencies || {}),
    side = { in: 0, turn: 1, out: 2 };
  return out
    .map((l, n) => ({ l, n }))
    .sort(
      (a, b) =>
        (order.indexOf(a.l.currency) + 1 || 99) - (order.indexOf(b.l.currency) + 1 || 99) ||
        side[a.l.side] - side[b.l.side] ||
        a.n - b.n
    )
    .map(x => x.l);
}
