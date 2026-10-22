// @ts-check
'use strict';
/* ================= BATTLE REWARDS (roguelite track RL-8) =================
   What the end of a battle pays or costs, worked out without the page, so a run's simulation (and a run's own rules)
   can reach it: the outcome (a battle called off at the turn cap ends as walking away from a wild Billie and as a
   loss to a trainer), the fee for losing, the prize money for wild Billies (RL-10: no egg drops any more), and a
   trainer's reward, first win and badge. battle.js endBattle applies them and shows the sheets. Moved out of
   endBattle as it was (tools/test/battle-rewards.test.mjs). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { RULES } from '../game-data.js';
import { wildPrize } from './rules.js';
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
 * What a battle that has ended pays and costs. `rules` defaults to the game's. RL-10: it draws no chance any more
 * (a wild win's egg drop, the one roll it took, is gone: eggs come from the ranch).
 * @param {{ kind: string, over: string | null, T?: any, tid?: string, foe: { lvl: number }[] }} b
 * @param {{ se: number, flags: Record<string, number>, seats: string[], run?: any }} s
 * @param {{ battle: { loseFee: number } }} [rules]
 * @returns {{ o: string | null, fee: number, prize: number, reward: number, first: boolean,
 *   seat: null | { id: string, nu: boolean, coins: Record<string, number>, items: Record<string, number> } }}
 */
export function battleRewards(b, s, rules = RULES) {
  const o = battleOutcome(b.kind, b.over),
    out = { o, fee: 0, prize: 0, reward: 0, first: false, seat: /** @type {any} */ (null) };
  /* RL-8: on a run a loss ends the run (no fee) and wins no badge */
  const run = !!s.run;
  if (o === 'lose' && !run) out.fee = Math.floor(s.se * rules.battle.loseFee);
  if (b.kind === 'wild' && o === 'win') {
    out.prize = b.foe.reduce((a, m) => a + wildPrize(m.lvl), 0);
  }
  if (b.kind === 'trainer' && o === 'win' && b.T) {
    out.reward = b.T.reward || 0;
    out.first = !s.flags[b.tid || ''];
    const st = b.T.seat;
    if (st && !run)
      out.seat = { id: st.id, nu: !s.seats.includes(st.id), coins: st.coins || {}, items: st.items || {} };
  }
  return out;
}
