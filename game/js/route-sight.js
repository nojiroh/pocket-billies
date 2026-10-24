'use strict';
/* ================= ROUTE TRAINERS SPOT YOU (roguelite track RL-12b) =================
   On a run's route, a trainer who hasn't been beaten watches a straight line from where it stands toward the road
   (logic/route-trainers.js routeInSight, rules.json run.trainers.sight). Step into it and, as in Pokémon:
   the "!" over its head and a sting, you stop where you are, it walks up to you, says its line (its script in the
   talk box) and the battle starts. While that happens you can't move (routeSight.busy: the joystick and taps wait).
   Checked a few times a second, only in the walk view on a run, with nothing else on screen. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, selfTest } from './hooks.js';
import { RULES, TRAINERS } from './game-data.js';
import { routeInSight } from './logic/route-trainers.js';
import { activeBattle, reducedMotion, saveData, uiState } from './game-state.js';
import { walkView } from './walk-view.js';
import { jinglePlay } from './sound.js';
import { talkBox } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { trainerTalk } from './story.js';
/* eslint-disable no-func-assign */
expose({
  routeSight: [() => routeSight],
  routeSightCheck: [() => routeSightCheck, v => (routeSightCheck = v)],
  routeSightOK: [() => routeSightOK, v => (routeSightOK = v)],
  routeSpotted: [() => routeSpotted, v => (routeSpotted = v)],
  routeWatchers: [() => routeWatchers, v => (routeWatchers = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the trainer walking up to you (its id), or '' */
export const routeSight = { busy: '' };
provide({ routeSight }); /* to-module */

/** may a trainer spot you now: walking on a run, nothing else on screen */
function routeSightOK() {
  return (
    !!saveData.run &&
    saveData.run.at.phase === 'walk' &&
    uiState.tab === 'walk' &&
    !uiState.modal &&
    !activeBattle &&
    !(typeof talkBox !== 'undefined' && talkBox.on) &&
    !(typeof cutscene !== 'undefined' && cutscene.on) &&
    !(typeof selfTest !== 'undefined' && selfTest.on) &&
    walkView.ready &&
    !!walkView.pl &&
    !walkView.director
  );
}
/** the route trainers in view who haven't been beaten, with where they stand and look */
function routeWatchers() {
  return Object.keys(walkView.npcLook)
    .filter(id => TRAINERS[id] && TRAINERS[id].route && !saveData.flags[id] && walkView.npcAt[id])
    .map(id => ({ id, at: walkView.npcAt[id], look: walkView.npcLook[id] }));
}
/** one look round: the first trainer that sees you walks up */
function routeSightCheck() {
  if (routeSight.busy || !routeSightOK()) return;
  const P = walkView.pl,
    range = (RULES.run.trainers && RULES.run.trainers.sight) || 6;
  const W = routeWatchers().find(w => routeInSight(w.at, w.look, [P.x, P.z], range));
  if (W) routeSpotted(W.id);
}
/** a trainer has seen you: "!", it walks up, it talks, the battle @param {string} id */
async function routeSpotted(id) {
  const P = walkView.pl;
  routeSight.busy = id;
  walkView.spotted[id] = 1;
  walkView.stick = null;
  P.route = null;
  P.goal = null;
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `spotted by ${id}`);
  if (typeof jinglePlay === 'function') jinglePlay('reveal');
  try {
    await new Promise(r => setTimeout(r, reducedMotion ? 50 : 700));
    /* it walks up to stand a step from you */
    const pos = walkView.npcAt[id];
    if (pos) {
      const t0 = performance.now();
      while (performance.now() - t0 < 3000) {
        const dx = P.x - pos[0],
          dz = P.z - pos[1],
          d = Math.hypot(dx, dz);
        if (d <= 1.4) break;
        const step = Math.min(d - 1.4, reducedMotion ? d : 0.16);
        pos[0] += (dx / d) * step;
        pos[1] += (dz / d) * step;
        await new Promise(r => setTimeout(r, 30));
      }
    }
    if (TRAINERS[id] && !saveData.flags[id] && !activeBattle) await trainerTalk(id);
  } finally {
    routeSight.busy = '';
  }
}
setInterval(() => {
  try {
    routeSightCheck();
  } catch (e) {
    console.error(e);
  }
}, 150);
