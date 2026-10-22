// @ts-check
'use strict';
/* ================= BATTLE REWARDS (roguelite track RL-8) =================
   What the end of a battle pays or costs, worked out without the page, so a run's simulation (and a run's own rules)
   can reach it: the outcome (a battle called off at the turn cap ends as walking away from a wild Billie and as a
   loss to a trainer), the fee for losing, the prize money for wild Billies, the egg a wild win may drop, and a
   trainer's reward, first win and badge. battle.js endBattle applies them and shows the sheets. Moved out of
   endBattle as it was (tools/test/battle-rewards.test.mjs). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { EGGS, EGG_TIERS, RULES } from '../game-data.js';
import { pickWeighted, wildPrize } from './rules.js';
import { fxMoney } from './effects.js';
/* eslint-disable no-func-assign */
expose({
  battleOutcome: [() => battleOutcome],
  // @ts-expect-error -- replaced on purpose
  battleRewards: [() => battleRewards, v => (battleRewards = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the battle's end as endBattle reads it: the turn cap's draw is walking away (wild) or a loss (a trainer)
 * @param {string} kind @param {string | null} over @returns {string | null} */
export const battleOutcome = (kind, over) => (over === 'draw' ? (kind === 'wild' ? 'ran' : 'lose') : over);
/**
 * What a battle that has ended pays and costs. `roll` is the battle's chance (battleRoll), drawn only for a wild win's
 * egg, in the order endBattle drew it. `rules` and `eggs` default to the game's.
 * @param {{ kind: string, over: string | null, T?: any, tid?: string, foe: { lvl: number }[], fx?: any[] }} b b.fx: a run's
 *   Loopholes (logic/effects.js), which change the money a win pays
 * @param {{ se: number, flags: Record<string, number>, seats: string[], run?: any }} s
 * @param {() => number} roll
 * @param {{ battle: { loseFee: number }, eggs: { dropChance: number, dropTiers: Record<string, number> } }} [rules]
 * @param {Record<string, any>} [eggs] the egg tiers there are (EGGS) @param {number[]} [eggTiers] EGG_TIERS
 * @returns {{ o: string | null, fee: number, prize: number, egg: number, reward: number, first: boolean,
 *   seat: null | { id: string, nu: boolean, coins: Record<string, number>, items: Record<string, number> } }}
 */
export function battleRewards(b, s, roll, rules = RULES, eggs = EGGS, eggTiers = EGG_TIERS) {
  const o = battleOutcome(b.kind, b.over),
    out = { o, fee: 0, prize: 0, egg: 0, reward: 0, first: false, seat: /** @type {any} */ (null) };
  /* RL-8: on a run a loss ends the run (no fee), no egg drops (a run's eggs vanish when it ends) and no badge */
  const run = !!s.run;
  if (o === 'lose' && !run) out.fee = Math.floor(s.se * rules.battle.loseFee);
  if (b.kind === 'wild' && o === 'win') {
    out.prize = fxMoney(
      b.fx,
      b.foe.reduce((a, m) => a + wildPrize(m.lvl), 0)
    );
    const E = rules.eggs;
    if (!run && roll() < E.dropChance) {
      const tiers = Object.entries(E.dropTiers)
        .filter(([t]) => eggs[t])
        .map(([t, w]) => [+t, w]);
      out.egg = /** @type {number} */ (tiers.length ? pickWeighted(tiers, roll) : eggTiers[0]);
    }
  }
  if (b.kind === 'trainer' && o === 'win' && b.T) {
    out.reward = fxMoney(b.fx, b.T.reward || 0);
    out.first = !s.flags[b.tid || ''];
    const st = b.T.seat;
    if (st && !run)
      out.seat = { id: st.id, nu: !s.seats.includes(st.id), coins: st.coins || {}, items: st.items || {} };
  }
  return out;
}
