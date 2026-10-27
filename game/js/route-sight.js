'use strict';
/* ================= ROUTE TRAINERS SPOT YOU (roguelite track RL-12b) =================
   On a run's route, a trainer who hasn't been beaten watches a straight line from where it stands toward the road
   (logic/route-trainers.js routeInSight, rules.json run.trainers.sight). Step into it and, as in Pokémon:
   the "!" over its head and a sting, you stop where you are, it walks up to you, says its line (its script in the
   talk box) and the battle starts. While that happens you can't move (routeSight.busy: the joystick and taps wait).
   Checked a few times a second, only in the walk view on a run, with nothing else on screen.
   WM-7: a leader's arena (logic/arena-gen.js scene.arena) is the same on a bigger scale: step over its fence line
   and the camera frames the ring (walk/camera.js, the arena moment), the leader says who they are, walks up and the
   battle starts, with no tap. It waits for you to step out of the ring before it can start again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, selfTest } from './hooks.js';
import { RULES, TRAINERS } from './game-data.js';
import { ARENA_FENCE_IN, arenaOct } from './logic/arena-gen.js';
import { routeInSight } from './logic/route-trainers.js';
import { activeBattle, reducedMotion, saveData, uiState } from './game-state.js';
import { mapById, walkView } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { jinglePlay } from './sound.js';
import { talkBox, talkHide, talkLine } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { trainerTalk } from './story.js';
/* eslint-disable no-func-assign */
expose({
  ARENA_INTRO_MS: [() => ARENA_INTRO_MS],
  arenaEntered: [() => arenaEntered, v => (arenaEntered = v)],
  arenaHere: [() => arenaHere, v => (arenaHere = v)],
  routeSight: [() => routeSight],
  routeSightCheck: [() => routeSightCheck, v => (routeSightCheck = v)],
  routeSightOK: [() => routeSightOK, v => (routeSightOK = v)],
  routeSpotted: [() => routeSpotted, v => (routeSpotted = v)],
  routeWatchers: [() => routeWatchers, v => (routeWatchers = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the trainer walking up to you (its id), or ''; WM-7: `out`, whether you have been outside a leader's ring since its
 * last start (it starts again only once you have) */
export const routeSight = { busy: '', out: true };
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
/** one look round: the first trainer that sees you walks up; WM-7: else a leader's ring you have stepped into */
function routeSightCheck() {
  if (routeSight.busy || !routeSightOK()) return;
  const P = walkView.pl,
    range = (RULES.run.trainers && RULES.run.trainers.sight) || 6;
  const W = routeWatchers().find(w => routeInSight(w.at, w.look, [P.x, P.z], range));
  if (W) return routeSpotted(W.id);
  const A = arenaHere();
  if (!A) return;
  const d = arenaOct(P.x - A.x, P.z - A.z);
  if (d > A.r + 0.5) routeSight.out = true;
  else if (d <= A.r - ARENA_FENCE_IN - 0.6 && routeSight.out) arenaEntered(A);
}
/** WM-7: the arena of the place you're in (in the view's metres) and its leader not yet beaten (a run's mini-boss or
 * boss standing in view), or null */
function arenaHere() {
  const sc = walkView.sc,
    base = sc && (mapById(sc.baseId || walkView.id) || {}).arena;
  if (!base) return null;
  const id = Object.keys(walkView.npcAt).find(
    k => TRAINERS[k] && (TRAINERS[k].runFoe === 'miniboss' || TRAINERS[k].runFoe === 'boss') && !saveData.flags[k]
  );
  if (!id) return null;
  const o = sc.baseOff || [0, 0];
  return { ...base, id, x: base.x + o[0], z: base.z + o[1] };
}
/** WM-7: how long the camera frames the ring before the leader speaks (ms) */
const ARENA_INTRO_MS = 1400;
/** WM-7: you've stepped into a leader's ring: framed, their words, they walk up, the battle @param {any} A arenaHere's */
async function arenaEntered(A) {
  const P = walkView.pl,
    T = TRAINERS[A.id];
  routeSight.busy = A.id;
  routeSight.out = false;
  walkView.stick = null;
  P.route = null;
  P.goal = null;
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `into ${A.id}'s arena (${A.name})`);
  if (typeof jinglePlay === 'function') jinglePlay('reveal');
  walkRenderer.arenaAt = { x: A.x, z: A.z, until: walkView.t + ARENA_INTRO_MS + 2500 };
  try {
    await new Promise(r => setTimeout(r, reducedMotion ? 50 : ARENA_INTRO_MS));
    if (!T || saveData.flags[A.id] || activeBattle) return;
    await talkLine(
      T.who,
      A.mode === 'boss'
        ? `This is the ${A.name}. Your run ends here, one way or another.`
        : `Welcome to the ${A.name}! Nobody goes east without beating me.`,
      null,
      { name: T.name }
    );
    talkHide();
    walkRenderer.arenaAt = null;
    /* the leader walks up to stand two steps from you */
    const pos = walkView.npcAt[A.id];
    if (pos) {
      const t0 = performance.now();
      while (performance.now() - t0 < 3000) {
        const dx = P.x - pos[0],
          dz = P.z - pos[1],
          d = Math.hypot(dx, dz);
        if (d <= 2.2) break;
        const step = Math.min(d - 2.2, reducedMotion ? d : 0.16);
        pos[0] += (dx / d) * step;
        pos[1] += (dz / d) * step;
        await new Promise(r => setTimeout(r, 30));
      }
    }
    if (!saveData.flags[A.id] && !activeBattle) await trainerTalk(A.id);
  } finally {
    walkRenderer.arenaAt = null;
    routeSight.busy = '';
  }
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
