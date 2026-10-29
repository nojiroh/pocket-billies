'use strict';
/* ================= CUTSCENES: THE WAY BACK (intro track IN-4) =================
   The first run's end, won or lost (run.js runOver: the run's phase is 'return' from then on, so a reload comes back
   here, to the lab). The Bureau's pickup plays where the run ended (story.json pickup-won / pickup-lost on the story
   stage: two clerks run up, stamp you and drop you through their square portal), then this module takes the screen:
   the fall from the portal's light down to Copperleaf with no captions (opening-fall.js fallPlay from 'portal'), then
   the lab scene, game/data/cutscenes/return.json, on the opening's set outside the lab door: you wake, Professor Chosen
   and Kappi come out, you make yourself up (the dressing room), Kappi tallies what you brought back (the payout sheet,
   run-payout.js, in the scene) and the two of them explain expeditions. Its end finishes the run (run.js runEndLab: the
   same runEnd as any run, no train home) and you stand outside the lab door in the hub. If it can't play (no 3D view)
   or breaks, the run still ends the same way, so nobody is left in a run that is over. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { $ } from '../util.js';
import { save, saveData, uiState } from '../game-state.js';
import { cleanLook } from '../person-art.js';
import { prepareMap, stopWalkView, walkView } from '../walk-view.js';
import { cutscene, cutsceneHideDialogue, cutsceneTeardown } from './director.js';
import { cutscenePlayScript } from './stage.js';
import {
  cutsceneBegin,
  cutsceneMapId,
  cutsceneMount,
  cutsceneStartName,
  cutsceneWanted,
  openingDressingRoom,
} from './opening.js';
import { fallPlay } from '../opening-fall.js';
import { runEndLab } from '../run.js';
import { runPayoutOpen } from '../run-payout.js';
/* eslint-disable no-func-assign */
expose({
  returnAbort: [() => returnAbort, v => (returnAbort = v)],
  returnDressingRoom: [() => returnDressingRoom, v => (returnDressingRoom = v)],
  returnFinish: [() => returnFinish, v => (returnFinish = v)],
  returnPayout: [() => returnPayout, v => (returnPayout = v)],
  returnStart: [() => returnStart, v => ((returnStart = v), provide({ returnStart }))],
  returnVeilLift: [() => returnVeilLift, v => (returnVeilLift = v)],
});
/* eslint-enable no-func-assign */
provide({ returnStart });
/* to-module: end */
/* the way back: o.fall (from the pickup) plays the fall from the portal first; a reload starts at the lab */
async function returnStart(o = {}) {
  const R = saveData.run;
  if (cutscene.on || !R || R.at.phase !== 'return') return;
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `the way back${o.fall ? ', from the portal' : ''}`);
  if (!(typeof cutsceneWanted === 'function' && cutsceneWanted())) {
    returnVeilLift();
    returnFinish('no 3D view');
    return;
  }
  if (walkView.cv) stopWalkView();
  const id = cutsceneMapId(),
    run = cutsceneBegin({});
  cutscene.back = true;
  /* white under the pickup's veil (the portal's light), then the veil goes: the fall starts from that light */
  const fade = $('#csFade');
  if (fade) {
    fade.style.background = '';
    fade.classList.add('on');
  }
  returnVeilLift();
  const pre = Promise.resolve(prepareMap(id)).catch(() => {});
  if (o.fall && typeof fallPlay === 'function') {
    try {
      await fallPlay(run, { from: 'portal' });
    } catch (e) {
      console.error(e);
      if (fade) fade.classList.add('on');
    }
  }
  if (!cutscene.skip) document.body.classList.add('cs-dazed');
  if (!cutscene.on || cutscene.run !== run) return;
  await pre;
  if (!cutscene.on || cutscene.run !== run) return;
  if (!(await cutsceneMount(run, id, 'return', 'Outside the lab in ' + cutsceneStartName(), returnAbort))) return;
  try {
    await cutscenePlayScript('return', {
      extra: { 'dressing-room': returnDressingRoom, payout: returnPayout },
      slots: { place: () => cutsceneStartName() },
    });
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene return: ' + (e.message || e));
    if (cutscene.on && cutscene.run === run) returnAbort();
    return;
  }
  if (!cutscene.on || cutscene.run !== run) return;
  returnFinish('');
}
/* the pickup's white veil (story-stage.js storyPortal) lifts once the way back has the screen */
function returnVeilLift() {
  const v = $('#backVeil');
  if (v) v.remove();
}
/* dressing-room: your look and name are made here now (the owner, intro track section 1), starting from the look you
   had (a default one since the crash); saved at once, so a reload at the lab keeps it */
async function returnDressingRoom() {
  if (!uiState.trainerDraft && saveData.avatar) uiState.trainerDraft = cleanLook(saveData.avatar);
  await openingDressingRoom();
  saveData.avatar = cleanLook(uiState.avatarDraft);
  save();
}
/* payout: Kappi tallies what the run brought back, on the payout sheet (run-payout.js) over the scene; skipping stops
   here and the scene goes on when it is closed */
async function returnPayout() {
  cutscene.skip = false;
  cutsceneHideDialogue();
  cutscene.paying = true;
  try {
    await new Promise(done => {
      if (typeof runPayoutOpen !== 'function' || !runPayoutOpen({ lab: done })) done();
    });
  } finally {
    cutscene.paying = false;
  }
}
/* the scene is over: the director down, the run finished at the lab door (run.js runEndLab) */
function returnFinish(why) {
  if (cutscene.on) cutsceneTeardown();
  cutscene.back = false;
  cutscene.paying = false;
  uiState.trainerDraft = null;
  if (why && typeof debugLog !== 'undefined') debugLog.add('scene', `the way back skipped the lab (${why})`);
  if (typeof runEndLab === 'function') runEndLab();
}
/* the scene couldn't run or broke: the run still ends, outside the lab */
function returnAbort() {
  returnVeilLift();
  returnFinish('it stopped');
}
