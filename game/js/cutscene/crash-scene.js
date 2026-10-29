'use strict';
/* ================= CUTSCENES: THE CRASH (intro track IN-5) =================
   New game's cold open (docs/phases/intro-track.md section 2, beats 1 to 5). A new save is made with a stand-in starter,
   the prepared first run starts at once (run.js runTakeOffPrepared, no train: the loading screen, then its landing),
   and on that landing game/data/cutscenes/crash.json plays beside the crashed sky train (its spots and shots are metres
   from the landing's mast: logic/first-run.js firstRunCutscene). Chosen climbs out of the wreck, Kappi checks on you,
   the cargo's three pyramids pop open into the starters (the opening's own throw-coins and pick-starter), and the one
   you pick takes the stand-in's place (logic/first-run.js firstRunStarter; the counter lane's wild Billies follow it).
   Then the run is yours, where you stand. The run's phase is 'crash' until the scene is over, so a reload plays it
   again from the top (run.js runResume). No 3D view, or the scene breaks: the run starts anyway, with the stand-in.
   Once the first run has ended at the lab (cutscene/return-scene.js), this device remembers it, and New game offers
   "Skip the crash": the opening (cutscene/opening.js) instead, from the fall to the hub. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { closeModal, mapIdAt, modal, provide, render } from '../hooks.js';
import { $ } from '../util.js';
import { CUTSCENES, RULES, SPECIES, START_NODE } from '../game-data.js';
import { makeBilly } from '../logic/rules.js';
import { firstRunCutscene, firstRunStarter } from '../logic/first-run.js';
import { newSaveKeepingPreferences } from '../logic/saves.js';
import { save, saveData, saveNow, setSaveData, uiState } from '../game-state.js';
import { artLoad } from '../art.js';
import { LOOK_PRESETS, cleanLook } from '../person-art.js';
import { rigPreload } from '../skeleton-rig.js';
import { mapById, prepareMap, stopWalkView, walkView } from '../walk-view.js';
import { loadPropModelRecipe } from '../prop-models.js';
import { cutscene, cutsceneTeardown } from './director.js';
import { cutscenePlayScript } from './stage.js';
import {
  cutsceneBegin,
  cutsceneMapId,
  cutsceneMount,
  cutsceneStart,
  cutsceneWanted,
  openingLayer,
  openingPickStarter,
  openingThrowCoins,
} from './opening.js';
import { standByMast } from '../airship.js';
import { runWorldRepool } from '../run-world.js';
import { runLoad } from '../run-loading.js';
import { runTakeOffPrepared } from '../run.js';
/* eslint-disable no-func-assign */
expose({
  INTRO_DONE_KEY: [() => INTRO_DONE_KEY],
  crashAbort: [() => crashAbort, v => (crashAbort = v)],
  crashFilm: [() => crashFilm, v => (crashFilm = v)],
  crashFinish: [() => crashFinish, v => (crashFinish = v)],
  crashNewSave: [() => crashNewSave, v => (crashNewSave = v)],
  crashPick: [() => crashPick, v => (crashPick = v)],
  crashStart: [() => crashStart, v => ((crashStart = v), provide({ crashStart }))],
  introDone: [() => introDone, v => (introDone = v)],
  introMark: [() => introMark, v => ((introMark = v), provide({ introMark }))],
  newGameStart: [() => newGameStart, v => ((newGameStart = v), provide({ newGameStart }))],
});
/* eslint-enable no-func-assign */
provide({ crashStart, introMark, newGameStart });
/* to-module: end */
/** the device's note that the cold open was played to its end (a first run finished at the lab) */
const INTRO_DONE_KEY = 'pb-intro-done';
function introDone() {
  try {
    return localStorage.getItem(INTRO_DONE_KEY) === '1';
  } catch (e) {
    return false;
  }
}
function introMark() {
  try {
    localStorage.setItem(INTRO_DONE_KEY, '1');
  } catch (e) {
    /* a private window: it is offered again next time */
  }
}

/** New game (the title, the intro screen, Settings' erase): the crash, or once it has been played here, the choice */
export function newGameStart() {
  uiState.openingFailed = false;
  if (!(typeof cutsceneWanted === 'function' && cutsceneWanted())) {
    uiState.openingFailed = 'cant';
    render();
    return;
  }
  if (!introDone()) return void crashStart();
  modal({
    title: 'New game',
    html: '<p>You have played the crash and the first run before.</p><p>Skip it, and you wake outside the lab instead, pick a starter there and go straight to Copperleaf.</p>',
    btns: [
      {
        l: 'Skip the crash',
        c: 'dark',
        f: () => {
          closeModal();
          if (typeof debugLog !== 'undefined') debugLog.add('scene', 'new game: the crash skipped');
          cutsceneStart();
        },
      },
      {
        l: 'Play it again',
        f: () => {
          closeModal();
          crashStart();
        },
      },
    ],
  });
}

/** the cold open: o.resume (a reload in the crash scene) films it on the run the save holds; otherwise a new save
 * with a stand-in starter and the prepared run's take-off, then the scene on its landing */
function crashStart(o = {}) {
  if (cutscene.on) return;
  if (o.resume) return void crashFilm();
  crashNewSave();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', 'new game: the crash');
  if (!(typeof runTakeOffPrepared === 'function' && runTakeOffPrepared({ crash: crashFilm }))) {
    /* no prepared run (no firstRun.json): the opening, as before IN-5 */
    cutsceneStart();
  }
}

/** a fresh save for the crash: a default look and no name yet (both made at the lab), the first starter as a stand-in
 * for the one picked in the scene (not yet in the dex) */
function crashNewSave() {
  const R = RULES.start,
    l = R.starters.find(x => SPECIES[x + '0']) || R.starters[0];
  setSaveData(newSaveKeepingPreferences());
  uiState.trainerDraft = uiState.avatarDraft = null;
  saveData.avatar = cleanLook(LOOK_PRESETS[0]);
  saveData.started = true;
  saveData.gender = 'me';
  saveData.wardrobe = { owned: {}, outfits: [null, null, null] };
  saveData.starter = l;
  const m = makeBilly(l + '0', R.starterLevel);
  saveData.team = [m];
  saveData.buddy = m.uid;
  saveData.since = Date.now();
  saveData.trip = { node: START_NODE, plan: [] };
  saveData.visited = { [START_NODE]: 1 };
  saveData.mapSeen = null;
}

/** the crash scene on the prepared landing (the run at phase 'crash') */
async function crashFilm() {
  const s = saveData,
    R = s.run;
  if (cutscene.on || !R || R.at.phase !== 'crash') return;
  const node = s.trip.node,
    landId = mapIdAt(node),
    scene = mapById(landId),
    set = scene && CUTSCENES.crash ? firstRunCutscene(CUTSCENES.crash, scene, landId) : null;
  if (!set || !(typeof cutsceneWanted === 'function' && cutsceneWanted())) return crashFinish(null, 'no 3D view');
  if (walkView.cv) stopWalkView();
  const id = cutsceneMapId(node),
    run = cutsceneBegin({}),
    alive = () => cutscene.on && cutscene.run === run;
  /* dark, until the script's fade in: you open your eyes */
  const fade = $('#csFade');
  if (fade) {
    fade.style.background = '#0B0912';
    fade.classList.add('on');
  }
  await Promise.all([
    rigPreload(cutscene.pickList.map(l => [l + '0', 1])),
    artLoad(['coins/pyramid_32.png']),
    Promise.resolve(typeof loadPropModelRecipe === 'function' && loadPropModelRecipe('coins/pyramid.json')),
    prepareMap(id),
  ]).catch(() => {});
  if (!alive()) return;
  cutscene.layers.push(openingLayer);
  if (!(await cutsceneMount(run, id, 'crash', 'The crash site', crashAbort, set))) return;
  /* the run's loading screen lifts once the landing is drawn (run-loading.js); the scene starts under it */
  const t0 = performance.now();
  while (alive() && typeof runLoad !== 'undefined' && runLoad.on && performance.now() - t0 < 20000)
    await new Promise(r => setTimeout(r, 120));
  if (!alive()) return;
  try {
    await cutscenePlayScript('crash', {
      set,
      extra: { 'throw-coins': openingThrowCoins, 'pick-starter': crashPick },
      slots: { starter: () => (cutscene.picked ? cutscene.picked.starter : '') },
    });
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene crash: ' + (e.message || e));
    if (alive()) crashAbort();
    return;
  }
  if (!alive()) return;
  crashFinish(set, '');
}

/** pick-starter: the opening's pick card; the picked one replaces the stand-in on the run (logic/first-run.js
 * firstRunStarter) and the run's places that follow the starter are pinned again (run-world.js runWorldRepool) */
async function crashPick() {
  await openingPickStarter();
  const s = saveData,
    l = cutscene.picked && cutscene.picked.line;
  if (!s.run || !l || !SPECIES[l + '0']) return;
  firstRunStarter(s, makeBilly(l + '0', RULES.start.starterLevel), l);
  if (typeof runWorldRepool === 'function') runWorldRepool(s.run);
  save();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `the crash: ${l} picked`);
}

/** the scene is over (or couldn't play): the run is yours, standing where you woke (the crash's `me`), or by the
 * landing's mast without the scene */
function crashFinish(set, why) {
  if (cutscene.on) cutsceneTeardown();
  const s = saveData,
    R = s.run;
  if (!R) return;
  const m = s.team[0];
  if (m) {
    s.caught[m.sp] = 1;
    s.seen[m.sp] = 1;
  }
  if (R.at.phase === 'crash') R.at.phase = 'walk';
  const node = s.trip.node,
    me = set && set.spots && set.spots.me;
  uiState.inside = uiState.goingIn = uiState.backAt = uiState.mapSel = null;
  if (me) uiState.roam = { id: set.map, node, x: me[0], z: me[1] };
  else standByMast(node);
  uiState.tab = 'walk';
  saveNow();
  if (why && typeof debugLog !== 'undefined') debugLog.add('scene', `the crash skipped (${why})`);
  render();
}
/** the scene broke: the run starts anyway */
function crashAbort() {
  crashFinish(null, 'it stopped');
}
