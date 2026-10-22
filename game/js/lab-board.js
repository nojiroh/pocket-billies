'use strict';
/* ================= THE LAB BOARD (roguelite track RL-11) =================
   The unlock table on screen (logic/unlocks.js, game/data/unlocks.json): milestones earned in the hub (after a run
   and on load), with a toast for each. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, toast } from './hooks.js';
import { CURRENCIES, UNLOCK_DATA } from './game-data.js';
import { formatNumber } from './logic/rules.js';
import { unlockAuto } from './logic/unlocks.js';
import { save, saveData } from './game-state.js';
/* eslint-disable no-func-assign */
expose({
  labMilestones: [() => labMilestones, v => ((labMilestones = v), provide({ labMilestones }))],
  unlockGiftText: [() => unlockGiftText, v => (unlockGiftText = v)],
});
/* eslint-enable no-func-assign */
provide({ labMilestones });
/* to-module: end */
/** what an unlock gives, in a few words: "+10 Scrap", or its name @param {any} R */
function unlockGiftText(R) {
  const G = R.grant || {};
  for (const c of ['capital', 'scrap', 'seals'])
    if (G[c]) {
      const C = CURRENCIES[c] || { name: c, one: c };
      return `+${formatNumber(G[c])} ${G[c] === 1 ? C.one : C.name}`;
    }
  return R.name;
}
/** grant the milestones whose condition holds now (in the hub only), each with a toast; saves when any was granted.
 * Returns their ids */
export function labMilestones() {
  if (!saveData || !saveData.meta || saveData.run) return [];
  const got = unlockAuto(saveData, UNLOCK_DATA);
  if (!got.length) return got;
  for (const id of got) {
    const R = UNLOCK_DATA.unlocks[id];
    toast(`Milestone: ${R.name}. ${unlockGiftText(R)}.`);
  }
  if (typeof debugLog !== 'undefined') debugLog.add('meta', `milestones: ${got.join(', ')}`);
  save();
  return got;
}
