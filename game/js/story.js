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
  storyRun,
  storyWorldOK,
} from './hooks.js';
import { RULES, SPECIES, TRAINERS, trainersAt } from './game-data.js';
import { encountersHere, healAll, today } from './logic/rules.js';
import { startTrainer, startWild } from './logic/battle-engine.js';
import { setStoryFlag } from './logic/script.js';
import { activeBattle, escapeHtml, save, saveData, uiState } from './game-state.js';
import { dressingRoom } from './dressing-room.js';
import { baseMapId, walkView } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { music } from './sound.js';
import { talk, talkBox } from './talk.js';
import { cutscene } from './cutscene.js';
import { loreClue, loreData } from './lore.js';
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
  storyRivalBattle: [() => storyRivalBattle, v => (storyRivalBattle = v)],
  storyState: [() => storyState],
  trainerTalk: [() => trainerTalk, v => (trainerTalk = v)],
});
/* eslint-enable no-func-assign */
provide({ openingDone, storyAfterRival, storyAfterWin, storyFlags });
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
            const q = { id: 'legend-' + L.sp, sp: L.sp, lvl: L.lvl, gold: false, no: ++saveData.serial, legend: true };
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
/* alpha 0.4: someone who only talks (scene.people: Granny Juniper): what they say the first time, then a line or two */
export async function personTalk(P) {
  if (!P || talkBox.on || (typeof cutscene !== 'undefined' && cutscene.on)) return;
  const F = storyFlags(),
    k = 'met_' + P.id,
    first = !F[k] && P.first && P.first.length;
  let lines;
  if (first) lines = P.first;
  else {
    const L = P.lines || [];
    setStoryFlag('talk_' + P.id, ((F['talk_' + P.id] || 0) + 1) % Math.max(1, L.length));
    const a = L[F['talk_' + P.id]];
    lines = a ? [a] : [];
  }
  setStoryFlag(k);
  save();
  if (lines.length && typeof talk === 'function') await talk(lines.map(l => [P.who, l]));
}
/* ================= v47: BLAKE'S FIRST BATTLE, AND WHAT COMES AFTER =================
   The opening ends with Blake wanting a battle (cutscene.js); it starts as soon as Sundown is back on screen. */
/* what Blake says when he runs in (the opening's scene, or the step-by-step intro's conversation before the battle) */
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
/* win or lose: Blake has his say and goes off to train, Hazel heals your team and points you down the road */
async function storyAfterRival(o, T) {
  const F = storyFlags();
  setStoryFlag('rival0', o === 'win' ? 'win' : o === 'lose' ? 'lose' : 'skip');
  setStoryFlag('met_blake0');
  save();
  if (o) openingMark();
  T = T || TRAINERS.blake0 || {};
  const who = T.who || 'chad';
  const W = uiState.welcome;
  uiState.welcome = null;
  const lines = [];
  if (o === 'win')
    lines.push(
      [who, '[surprised] What? I lost to someone who fell out of the sky an hour ago?'],
      [who, '[angry] Mine only knows Tackle. That’s my excuse and I’m sticking to it.']
    );
  else if (o === 'lose')
    lines.push([who, '[happy] Ha! Told you. Mine beats yours.'], [who, 'Don’t feel bad. You only got here today.']);
  if (o) lines.push([who, 'I’m off to train on the golf course. Next time I’ll have a whole team. Try to keep up!']);
  if (lines.length && typeof talk === 'function') await talk(lines);
  healAll();
  save();
  const after = [
    [
      'gini',
      '[happy] There, good as new. Any time they’re hurt, the clinic in Marigold Town patches them up for free. It’s just down Hedgerow Lane.',
    ],
    ['gini', 'Granny Juniper has made up a room for you in her cottage, by the hives. A rest there does wonders.'],
    [
      'gini',
      'One more thing. When someone falls in, their things come down too, and they scatter along Tallgrass Meadow, past Marigold Town. If anything of yours made it, that’s where it’ll be.',
    ],
    ['gini', 'Now go and explore! The road teaches more than any book. Come back and see me any time.'],
  ];
  if (typeof talk === 'function') await talk(after);
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
  const L = T.endLines || [];
  if (typeof music === 'function') music('title');
  if (L.length && typeof talk === 'function') await talk(L.map(l => [l[0], l[1]]));
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
