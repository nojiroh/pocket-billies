// @ts-check
'use strict';
/* ================= WHAT THE GAME MAKES OF CONTENT (Studio plan Phase 4) =================
   The Studio's content editors ask the game's own logic, through the logic worker (studio/js/logic-worker.js, where
   GAMEDATA is the Studio's draft), what an edit does. On no page, like run-preview.js: game-data.js would read the
   Studio's data as the game's.
   - perkPreview (T4.1): what some Perks do to a sample Billie (made by rules.js makeBilly at a level) and to the
     numbers of a run: fxRows, then fxStages with the battle's stageFactor on its stats, fxMoney on a wild prize and a
     mini-boss's reward, fxPrice on a shop ware and the clinic, fxCatch, fxDamage, fxHealShare, fxPayoutRates and (SP-6) fxSplice. Where
     a kind's product passes FX_LIMIT, the product before and after the clamp.
   - leaderRunValues (T4.3): what a run makes of each mini-boss leader (trainers with miniboss: true) on each mini-boss
     row and the boss's row: run-loop.js runFoes on that row alone, so its reward and its team's levels are the game's.
   - speciesStandIns (T4.3): the species game-data.js standInSpecies puts in for legacy ids (pools, eggs, teams).
   Logic only: no DOM, no Date, no Math.random (tools/test/content-preview.test.mjs). */
import { PERKS, RULES, SPECIES, STAT_IDS, TRAINERS, gameData, standInSpecies } from '../game-data.js';
import {
  FX_LIMIT,
  fxCatch,
  fxDamage,
  fxHealShare,
  fxMoney,
  fxPayoutRates,
  fxPrice,
  fxRows,
  fxSplice,
  fxStages,
} from './effects.js';
import { stageFactor } from './battle-engine.js';
import { makeBilly, stat, wildPrize } from './rules.js';
import { runMapRows } from './run-map.js';
import { runFoes } from './run-loop.js';

/**
 * What the Perks `ids` do to a sample Billie of species `sp` at level `lvl`, and to a run's numbers.
 * @param {string[]} ids @param {{ sp: string, lvl: number }} sample
 */
export function perkPreview(ids, sample) {
  const fx = fxRows(ids, PERKS),
    sp = SPECIES[sample.sp] ? sample.sp : Object.keys(SPECIES)[0],
    lvl = Math.max(1, Math.min(100, Math.round(sample.lvl) || 1)),
    m = makeBilly(sp, lvl),
    stages = fxStages(fx),
    R = RULES.run,
    ware = Object.keys(R.shop.pick).find(k => gameData.items[k]) || '',
    price = ware ? gameData.items[ware].price : 100,
    hp = stat(m, 'hp');
  const stats = STAT_IDS.map((/** @type {string} */ k) => {
    const before = stat(m, k),
      stage = stages[k] || 0;
    return { id: k, before, stage, after: Math.max(1, Math.round(before * stageFactor(stage))) };
  });
  const prize = wildPrize(lvl),
    reward = R.foes.miniboss.reward,
    types = [...new Set(fx.map(f => /** @type {any} */ (f).type).filter(Boolean))],
    hit = (/** @type {string} */ cat, /** @type {string} */ type, /** @type {boolean} */ deal) =>
      fxDamage(fx, { cat, type, deal, take: !deal }),
    pay = fxPayoutRates(fx, R.payout);
  /** where a kind's rows multiply past the code's limits: the plain product and the one used */
  const limited = /** @type {{ kind: string, what: string, raw: number, used: number }[]} */ ([]);
  /** @type {Record<string, any[]>} */
  const byKey = {};
  for (const f of fx) {
    const F = /** @type {any} */ (f);
    if (typeof F.mult !== 'number') continue;
    const key = [F.kind, F.what || F.side || '', F.cat || '', F.type || ''].join('|');
    (byKey[key] = byKey[key] || []).push(F.mult);
  }
  for (const [key, L] of Object.entries(byKey)) {
    const raw = L.reduce((a, b) => a * b, 1),
      used = Math.min(FX_LIMIT.hi, Math.max(FX_LIMIT.lo, raw));
    if (used !== raw) {
      const [kind, what, cat, type] = key.split('|');
      limited.push({ kind, what: [what, cat, type].filter(Boolean).join(' '), raw, used });
    }
  }
  return {
    ids: ids.filter(id => PERKS[id]),
    rows: fx,
    sample: { sp, lvl, name: SPECIES[sp].name, hp },
    stats,
    money: { prize: [prize, fxMoney(fx, prize)], reward: [reward, fxMoney(fx, reward)] },
    price: { ware, shop: [price, fxPrice(fx, 'shop', price)], heal: [R.healCost, fxPrice(fx, 'heal', R.healCost)] },
    catch: fxCatch(fx),
    damage: {
      dealH: hit('H', '', true),
      dealS: hit('S', '', true),
      take: hit('H', '', false),
      types: types.map(t => ({ type: t, deal: hit('H', t, true), take: hit('H', t, false) })),
    },
    heal: { share: fxHealShare(fx), hp: Math.floor(hp * fxHealShare(fx)) },
    payout: { itemShare: [R.payout.itemShare, pay.itemShare], research: pay.research },
    /* SP-6: the splice kinds */
    splice: { dna: fxSplice(fx, 'dna'), odds: fxSplice(fx, 'splice'), unstable: fxSplice(fx, 'unstable') },
    limited,
  };
}

/**
 * What a run makes of each mini-boss leader on each mini-boss row and on the boss's row (runFoes on a map of that one
 * place): the reward and the team at the run's levels. By leader id; `ids` narrows it.
 * @param {string[]} [ids]
 */
export function leaderRunValues(ids) {
  const rows = runMapRows(RULES.run.map),
    places = rows
      .map((role, row) => ({ role, row }))
      .filter(r => r.role === 'guard' || r.role === 'last')
      .map(r => ({ row: r.row, kind: r.role === 'last' ? 'boss' : 'miniboss' }));
  /** @type {Record<string, { kind: string, row: number, reward: number, levels: [number, number], team: { sp: string, lvl: number }[] }[]>} */
  const out = {};
  for (const T of Object.values(TRAINERS)) {
    const id = /** @type {any} */ (T).id;
    if (!T.miniboss || (ids && !ids.includes(id))) continue;
    out[id] = places.map(({ row, kind }) => {
      const run = /** @type {any} */ ({ seed: 'leader', map: { nodes: [{ row, lane: 0, type: kind, next: [] }] } }),
        F = Object.values(runFoes(run, { leaders: [T], rules: RULES.run }))[0];
      const team = F ? F.team.map((/** @type {any} */ e) => ({ sp: e.sp, lvl: e.lvl })) : [],
        lv = team.map((/** @type {any} */ e) => e.lvl);
      return {
        kind,
        row,
        reward: F ? F.reward : 0,
        levels: /** @type {[number, number]} */ (lv.length ? [Math.min(...lv), Math.max(...lv)] : [0, 0]),
        team,
      };
    });
  }
  return out;
}

/** the species the game puts in for each id it doesn't have (standInSpecies), with its name; null when it has none
 * to put in. Ids the game has are left out @param {string[]} ids */
export function speciesStandIns(ids) {
  /** @type {Record<string, { to: string, name: string } | null>} */
  const out = {};
  for (const id of new Set(ids)) {
    if (typeof id !== 'string' || SPECIES[id] || id[0] === '@' || id === 'robot') continue;
    const to = standInSpecies(id);
    out[id] = to !== id && SPECIES[to] ? { to, name: SPECIES[to].name } : null;
  }
  return out;
}
