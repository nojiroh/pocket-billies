'use strict';
/* ================= STORY SCENES IN THE WALK SCENES =================
   Project Story S2: what people and trainers say is their script (docs/SCRIPTS.md), played by story-stage.js. A
   trainer's script ends with their battle; the ones who run up to you (runsUp: Blake, Cass, Vinylla) start theirs
   when you arrive, filmed in the walk scene you stand in (the stage's camera run-up). saveData.story remembers who
   you have met. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  closeModal,
  modal,
  playStoryScript,
  provide,
  selfTest,
  showPendingWindows,
  storyFreshTake,
  storyRun,
  storyWorldOK,
  toast,
} from './hooks.js';
import { CURRENCIES, PEOPLE, RELATIONS, RULES, SPECIES, TRAINERS, trainersAt } from './game-data.js';
import { encountersHere, plural, today } from './logic/rules.js';
import { relGift, relGiftBlock, relReached } from './logic/relations.js';
import { startTrainer, startWild } from './logic/battle-engine.js';
import { setStoryFlag } from './logic/script.js';
import { activeBattle, escapeHtml, save, saveData, uiState } from './game-state.js';
import { dressingRoom } from './dressing-room.js';
import { baseMapId, walkView } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { music } from './sound.js';
import { talk, talkBox } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { loreClue, loreData } from './lore.js';
import { questGiverTalk } from './quest-board.js';
/* eslint-disable no-func-assign */
expose({
  legendCheck: [() => legendCheck, v => (legendCheck = v)],
  openingDone: [() => openingDone, v => ((openingDone = v), provide({ openingDone }))],
  openingMark: [() => openingMark, v => (openingMark = v)],
  personTalk: [() => personTalk, v => (personTalk = v)],
  storyAfterRival: [() => storyAfterRival, v => ((storyAfterRival = v), provide({ storyAfterRival }))],
  storyAfterWin: [() => storyAfterWin, v => ((storyAfterWin = v), provide({ storyAfterWin }))],
  storyCheck: [() => storyCheck, v => (storyCheck = v)],
  storyEnding: [() => storyEnding, v => (storyEnding = v)],
  storyFlags: [() => storyFlags, v => ((storyFlags = v), provide({ storyFlags }))],
  storyGiftOffer: [() => storyGiftOffer, v => ((storyGiftOffer = v), provide({ storyGiftOffer }))],
  storyRivalBattle: [() => storyRivalBattle, v => (storyRivalBattle = v)],
  storyState: [() => storyState],
  trainerTalk: [() => trainerTalk, v => (trainerTalk = v)],
});
/* eslint-enable no-func-assign */
provide({ openingDone, storyAfterRival, storyAfterWin, storyFlags, storyGiftOffer });
/* to-module: end */
function storyFlags() {
  return saveData.story || (saveData.story = {});
}
/* tap a trainer in the scene, or their Battle button: they talk first (their script), then the battle starts */
export async function trainerTalk(id) {
  const T = TRAINERS[id];
  if (!T) return;
  if (talkBox.on || storyRun.on || (typeof cutscene !== 'undefined' && cutscene.on)) return;
  if (T.script) await playStoryScript('trainer:' + id);
  else startTrainer(id, { talked: true });
}
/* when you arrive where someone waits to run up to you (runsUp: Blake, Cass, Vinylla), their script starts by itself */
export function storyCheck() {
  if (
    (typeof selfTest !== 'undefined' && selfTest.on) ||
    uiState.bench ||
    !saveData.started ||
    activeBattle ||
    uiState.modal ||
    uiState.tab !== 'walk' ||
    talkBox.on ||
    (typeof cutscene !== 'undefined' && cutscene.on) ||
    (typeof dressingRoom !== 'undefined' && dressingRoom.on) ||
    !storyWorldOK()
  )
    return;
  if (saveData.trip.plan && saveData.trip.plan.length) return;
  const F = storyFlags();
  const T = trainersAt(saveData.trip.node).find(T => T.runsUp && !saveData.flags[T.id] && !F['met_' + T.id]);
  if (!T) return;
  if (storyState.pending === T.id) return;
  storyState.pending = T.id;
  setTimeout(() => {
    storyState.pending = null;
    if (
      walkView.ready &&
      !activeBattle &&
      uiState.tab === 'walk' &&
      !uiState.modal &&
      !talkBox.on &&
      !cutscene.on &&
      !storyRun.on
    )
      playStoryScript('trainer:' + T.id);
  }, 1400);
}
/* v39: the legendary encounters (rules.legends): one per scene, met when you arrive, once a day until caught */
export function legendCheck() {
  if (
    !saveData.started ||
    activeBattle ||
    uiState.modal ||
    uiState.tab !== 'walk' ||
    talkBox.on ||
    (typeof cutscene !== 'undefined' && cutscene.on) ||
    !walkView.ready ||
    (typeof selfTest !== 'undefined' && selfTest.on) ||
    uiState.bench
  )
    return;
  if (saveData.trip.plan && saveData.trip.plan.length) return;
  const F = storyFlags(),
    L = (RULES.legends || []).find(
      l => l.scene === baseMapId() && SPECIES[l.sp] && !saveData.caught[l.sp] && F['legend_' + l.sp] !== today()
    );
  if (!L || storyState.pending === 'legend') return;
  storyState.pending = 'legend';
  setTimeout(() => {
    storyState.pending = null;
    if (
      !walkView.ready ||
      activeBattle ||
      uiState.tab !== 'walk' ||
      uiState.modal ||
      talkBox.on ||
      cutscene.on ||
      baseMapId() !== L.scene
    )
      return;
    setStoryFlag('legend_' + L.sp, today());
    save();
    modal({
      title: L.title,
      html: `<p>${escapeHtml(L.text)}</p><p class="note">${escapeHtml(L.line)}</p>`,
      btns: [
        {
          l: 'Face it',
          c: 'primary',
          f: () => {
            closeModal();
            const q = { id: 'legend-' + L.sp, sp: L.sp, lvl: L.lvl, no: ++saveData.serial, legend: true };
            encountersHere().push(q);
            startWild(q);
          },
        },
        { l: 'Back away', c: 'quiet', f: closeModal },
      ],
    });
  }, 1200);
}
const storyState = { pending: null };
provide({ storyState }); /* to-module */
/* RL-S2: in the hub, with a Bean and none given them since the last run, a hub person (relations.json) is offered one
   before the talk (logic/relations.js relGift; the level's wardrobe piece comes with it). Resolves once answered */
function storyGiftOffer(/** @type {string} */ who) {
  const M = saveData.meta;
  if (saveData.run || !M || relGiftBlock(M, who, RELATIONS)) return Promise.resolve(false);
  const P = /** @type {any} */ (PEOPLE || {})[who],
    name = (P && P.look && P.look.name) || who,
    C = CURRENCIES.beans || { name: 'Beans', one: 'Bean' };
  return new Promise(done =>
    modal({
      title: `A ${C.one} for ${name}?`,
      html: `<p>You have ${plural(M.beans, C.one)}.</p>`,
      btns: [
        {
          l: `Give a ${C.one}`,
          c: 'primary',
          f: () => {
            closeModal();
            const step = relGift(M, who, RELATIONS);
            if (step) {
              for (const L of relReached(who, step, RELATIONS))
                if (L.wardrobe && saveData.wardrobe) saveData.wardrobe.owned[L.wardrobe] = 1;
              toast(step.to > step.from ? `${name}: level ${step.to}` : `${name} liked that.`);
              save();
            }
            done(!!step);
          },
        },
        {
          l: 'Not now',
          c: 'quiet',
          f: () => {
            closeModal();
            done(false);
          },
        },
      ],
    })
  );
}
/* someone who only talks (a map's people: Granny Juniper, Curator Nacre): their script */
export async function personTalk(P) {
  if (!P || talkBox.on || storyRun.on || (typeof cutscene !== 'undefined' && cutscene.on)) return;
  if (P.who && !P.quest) await storyGiftOffer(P.who);
  /* RL-S1: the first talk after a run: their line picked on the way home, once, in place of their own */
  const fresh = !P.quest && P.who && storyFreshTake(P.who);
  /* TW-3: a run town's quest giver offers the town's quest (quest-board.js) */
  if (P.quest && typeof questGiverTalk === 'function') await questGiverTalk(P);
  else if (fresh) await playStoryScript('banter:' + fresh);
  else if (P.script) await playStoryScript('person:' + P.id);
  else if (P.lines && P.lines.length)
    /* TW-2: a run town's named local says their own lines, by their name (logic/run-scenes.js runTownLife) */
    await talk(
      P.lines.map((/** @type {string} */ l) => [P.who, l]),
      { name: P.name }
    );
}

/* ================= v47: BLAKE'S FIRST BATTLE, AND WHAT COMES AFTER =================
   The opening ends with Blake wanting a battle (cutscene.js); it starts as soon as Sundown is back on screen. */
/* this device has seen Blake's first battle through once: next time it can be skipped */
function openingDone() {
  try {
    return localStorage.getItem('nw-opening-done') === '1';
  } catch (e) {
    return false;
  }
}
function openingMark() {
  try {
    localStorage.setItem('nw-opening-done', '1');
  } catch (e) {}
}
export function storyRivalBattle(o = {}) {
  const t0 = performance.now(),
    go = async () => {
      if (activeBattle || !saveData.started) return;
      uiState.modal = null;
      startTrainer('blake0', { talked: true });
      if (!activeBattle) storyAfterRival(null, TRAINERS.blake0);
    };
  /* once Sundown is on screen and settled: drawn a few times, its pictures on the card (as when the game first opens) */
  let f0 = null;
  const poll = () => {
    if (activeBattle || !saveData.started) return;
    const on = typeof walkView !== 'undefined' && walkView.ready,
      gl = typeof walkRenderer !== 'undefined' && walkRenderer.on;
    if (on && gl && f0 == null) f0 = walkRenderer.frames;
    const ready =
      typeof walkView === 'undefined' ||
      (on &&
        (!gl ||
          (walkRenderer.frames >= (f0 ?? 0) + 8 &&
            (typeof gpuState === 'undefined' || !gpuState.normQ || !gpuState.normQ.length))));
    if ((ready && performance.now() - t0 > 900) || performance.now() - t0 > 9000) {
      go();
      return;
    }
    setTimeout(poll, 150);
  };
  setTimeout(poll, 150);
}
/* win or lose: Blake has his say and goes off to train, Hazel heals your team and points you down the road (story.json
   scripts.blake-first-battle, which reads rival0) */
async function storyAfterRival(o) {
  setStoryFlag('rival0', o === 'win' ? 'win' : o === 'lose' ? 'lose' : 'skip');
  setStoryFlag('met_blake0');
  save();
  if (o) openingMark();
  const W = uiState.welcome;
  uiState.welcome = null;
  await playStoryScript('story:blake-first-battle');
  if (W) modal(W);
  else if (typeof showPendingWindows === 'function') showPendingWindows();
}
/* v47 part 4: after the first win over a trainer with a story beat: a clue to who you were (Cass Flow, at the pressing
   plant), or the ending (Vinylla, at the Inner Sun): what everyone says, the last clue, and the B-side */
async function storyAfterWin(T) {
  if (!T) return;
  if (T.ending) {
    await storyEnding(T);
    return;
  }
  if (T.clue && typeof loreClue === 'function') loreClue(T.clue);
  else if (typeof showPendingWindows === 'function') showPendingWindows();
}
async function storyEnding(T) {
  if (typeof music === 'function') music('title');
  await playStoryScript('story:ending');
  const E = ((typeof loreData === 'function' && loreData().story) || []).find(s => s.id === 'ending');
  if (typeof loreClue === 'function')
    loreClue('who'); /* the last clue: its flag, "ending", is the story's last stage */
  else {
    setStoryFlag('ending');
  }
  if (E)
    modal({
      title: escapeHtml(E.title),
      cls: 'clue-sheet',
      html: `<p>${escapeHtml(E.text)}</p><p class="note">Thank you for playing Pocket Billies. Every place, trainer and Billie is still out there: the road goes on.</p>`,
      btns: [{ l: 'Keep walking', c: 'dark', f: closeModal }],
    });
  save();
}
