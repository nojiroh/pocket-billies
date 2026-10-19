'use strict';
/* ================= STORY SCENES IN THE WALK SCENES =================
   Short scenes filmed in the walk scene you are standing in, with the same director as the opening (cutscene.js):
   your rival Blake runs up the first time you reach him and talks before the battle; trainers talk with their
   portrait before a fight. A trainer's "intro" lines (game data) make the scene; "lines" are what they say in
   battle. saveData.story remembers which scenes you have seen. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, notice, provide, render, selfTest, showPendingWindows } from './hooks.js';
import { $, clamp } from './util.js';
import { LOCATION_BY_ID, RULES, SPECIES, TRAINERS, trainersAt } from './game-data.js';
import { encountersHere, healAll, today } from './logic/rules.js';
import { startTrainer, startWild } from './logic/battle-engine.js';
import { setStoryFlag } from './logic/script.js';
import { activeBattle, escapeHtml, reducedMotion, save, saveData, uiState } from './game-state.js';
import { dressingRoom } from './dressing-room.js';
import { baseMapId, walkView, walkablePointNear } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { music } from './sound.js';
import { talk, talkBox, talkHide, talkLine } from './talk.js';
import {
  cutscene,
  cutsceneActor,
  cutsceneFlush,
  cutsceneFrame,
  cutsceneHideDialogue,
  cutsceneNow,
  cutsceneSay,
  cutsceneShot,
  cutsceneWait,
  cutsceneWalk,
} from './cutscene.js';
import { loreClue, loreData } from './lore.js';
/* eslint-disable no-func-assign */
expose({
  cutsceneWorldBegin: [() => cutsceneWorldBegin, v => (cutsceneWorldBegin = v)],
  cutsceneWorldEnd: [() => cutsceneWorldEnd, v => (cutsceneWorldEnd = v)],
  legendCheck: [() => legendCheck, v => (legendCheck = v)],
  openingDone: [() => openingDone, v => ((openingDone = v), provide({ openingDone }))],
  openingMark: [() => openingMark, v => (openingMark = v)],
  personTalk: [() => personTalk, v => (personTalk = v)],
  rivalScene: [() => rivalScene, v => (rivalScene = v)],
  storyAfterRival: [() => storyAfterRival, v => ((storyAfterRival = v), provide({ storyAfterRival }))],
  storyAfterWin: [() => storyAfterWin, v => ((storyAfterWin = v), provide({ storyAfterWin }))],
  storyCheck: [() => storyCheck, v => (storyCheck = v)],
  storyEnding: [() => storyEnding, v => (storyEnding = v)],
  storyFlags: [() => storyFlags, v => ((storyFlags = v), provide({ storyFlags }))],
  storyMovedCheck: [() => storyMovedCheck, v => (storyMovedCheck = v)],
  storyRivalBattle: [() => storyRivalBattle, v => (storyRivalBattle = v)],
  storyState: [() => storyState],
  storyWorldOK: [() => storyWorldOK, v => (storyWorldOK = v)],
  trainerTalk: [() => trainerTalk, v => (trainerTalk = v)],
});
/* eslint-enable no-func-assign */
provide({ openingDone, storyAfterRival, storyAfterWin, storyFlags });
/* to-module: end */
function storyFlags() {
  return saveData.story || (saveData.story = {});
}
/* tap a trainer in the scene, or their Battle button: they talk first, then the battle starts */
export async function trainerTalk(id) {
  const T = TRAINERS[id];
  if (!T) return;
  if (talkBox.on || (typeof cutscene !== 'undefined' && cutscene.on)) return;
  const F = storyFlags();
  if (T.intro && T.intro.length && !F['met_' + id] && !saveData.flags[id] && storyWorldOK()) {
    await rivalScene(T);
    return;
  }
  const lines = (
    saveData.flags[id] ? ['[happy] Back for more? All right!'] : (T.lines || []).map(l => l.replace(/^[“"]|[”"]$/g, ''))
  ).slice(0, 2);
  if (lines.length && typeof talk === 'function')
    await talk(lines.map((l, i) => [T.who, i ? l : l.startsWith('[') ? l : '[happy] ' + l]));
  startTrainer(id, { talked: true });
}
function storyWorldOK() {
  return (
    typeof walkRenderer !== 'undefined' &&
    walkRenderer.on &&
    walkView.ready &&
    walkView.cv &&
    !activeBattle &&
    typeof cutsceneFrame === 'function'
  );
}
/* the director, borrowed for a scene in the current walk scene (no remount, no letterbox fade-in) */
function cutsceneWorldBegin() {
  cutscene.on = true;
  cutscene.run++;
  cutscene.skip = false;
  cutscene.actors = {};
  cutscene.stars = [];
  cutscene.coins = [];
  cutscene.fx = [];
  cutscene.flashes = [];
  cutscene.cam = null;
  cutscene.hide = null;
  cutscene.world = true;
  let el = $('#cs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cs';
    el.className = 'cs';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div class="cs-bars" aria-hidden="true"><i></i><i></i></div><button class="cs-skip pb small quiet" data-a="cs-skip">Skip ›</button><div class="cs-fade" id="csFade"></div>';
  el.hidden = false;
  document.body.classList.add('in-cs', 'cs-world');
  walkView.director = { frame: cutsceneFrame };
  return cutscene.run;
}
function cutsceneWorldEnd() {
  talkHide();
  cutscene.on = false;
  cutscene.run++;
  cutscene.skip = false;
  cutscene.world = false;
  cutsceneFlush();
  walkView.director = null;
  walkRenderer.bt = null;
  walkRenderer.camT = null;
  walkRenderer.focus = null;
  const el = $('#cs');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  document.body.classList.remove('in-cs', 'cs-world');
  render();
}
/* Blake (or any trainer with intro lines) runs up to you, talks, and the battle starts */
async function rivalScene(T) {
  const run = cutsceneWorldBegin(),
    alive = () => cutscene.on && cutscene.run === run,
    P = walkView.pl,
    sc = walkView.sc,
    F = storyFlags();
  setStoryFlag('met_' + T.id);
  save();
  /* v47: "intro0" is for a game begun before the opening had Blake's first battle in it */
  const intro = T.intro0 && T.intro0.length && !F.rival0 ? T.intro0 : T.intro;
  if (typeof music === 'function') music('rival');
  try {
    /* where he comes from: the side of the scene away from the camera, a little to one side of you */
    const side = P.x < sc.w / 2 ? 1 : -1,
      to = walkablePointNear(P.x + side * 1.4, P.z + 0.3),
      from = walkablePointNear(clamp(P.x + side * 7, 1, sc.w - 1), clamp(P.z + 4.5, 1, sc.h - 1));
    cutsceneActor('me', 'me', [P.x, P.z], side > 0 ? 'sideR' : 'side');
    cutsceneActor('rival', T.who, from, 'down');
    cutscene.actors.rival.hidden = true;
    const mid = () => [(P.x + to[0]) / 2, (P.z + to[1]) / 2],
      m = mid(),
      gy = standingHeightAt(m[0], m[1]);
    cutsceneShot({ eye: [m[0], gy + 3.6, m[1] - 8.5], tgt: [m[0], gy + 1, m[1] + 1.5], fov: 38, w: 6 });
    await cutsceneWait(300);
    if (!alive()) return;
    /* "!" and he runs in */
    await talkLine(T.who, (intro[0] || 'Hey!').replace(/^\[\w+\]\s*/, ''), 'angry', {});
    talkHide();
    cutscene.actors.rival.hidden = false;
    cutsceneShot({ eye: [m[0], gy + 2.3, m[1] - 5.2], tgt: [m[0], gy + 1.05, m[1] + 0.4], fov: 38, w: 4 }, 1600);
    await cutsceneWalk('rival', to, 1500);
    if (!alive()) return;
    cutscene.actors.rival.dir = side > 0 ? 'side' : 'sideR';
    cutscene.actors.me.dir = side > 0 ? 'sideR' : 'side';
    for (const l of intro.slice(1)) {
      await cutsceneSay(T.who, l);
      if (!alive()) return;
    }
    cutsceneHideDialogue();
    cutscene.actors.rival.act = 'cheer';
    cutscene.actors.rival.actT = cutsceneNow();
    await cutsceneWait(700);
    const f = $('#csFade');
    if (f) {
      f.style.background = '#0B0912';
      f.classList.add('on');
    }
    await new Promise(r => setTimeout(r, reducedMotion ? 50 : 450));
  } finally {
    cutsceneWorldEnd();
  }
  startTrainer(T.id, { talked: true });
}
/* when you arrive somewhere a story trainer waits, the scene starts by itself */
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
  const T = trainersAt(saveData.trip.node).find(
    T => T.intro && T.intro.length && !saveData.flags[T.id] && !F['met_' + T.id]
  );
  if (!T) return;
  if (storyState.pending === T.id) return;
  storyState.pending = T.id;
  setTimeout(() => {
    storyState.pending = null;
    if (walkView.ready && !activeBattle && uiState.tab === 'walk' && !uiState.modal && !talkBox.on && !cutscene.on)
      rivalScene(T);
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
/* alpha 0.4: a game begun before Copperleaf: the lab and your room have moved, and you are told once */
export function storyMovedCheck() {
  if (
    !saveData.started ||
    activeBattle ||
    uiState.modal ||
    uiState.title ||
    talkBox.on ||
    (typeof cutscene !== 'undefined' && cutscene.on) ||
    (typeof selfTest !== 'undefined' && selfTest.on) ||
    uiState.bench
  )
    return;
  const F = storyFlags();
  if (F.copperleafNote) return;
  if (!LOCATION_BY_ID.copperleaf) return;
  /* phase 06: a notice, not a choice: it waits behind the dot on the portrait, and counts as seen once read */
  notice({
    id: 'copperleaf-note',
    title: 'Copperleaf Town',
    html: '<p>Professor Hazel has moved her lab to Copperleaf Town, the hamlet up Route 1 · Hedgerow Lane, north of Marigold Town. Your room went with her: it is in Granny Juniper’s cottage there now, among the beehives.</p><p class="note">Marigold Town keeps its shop and its clinic. Copperleaf has the swing.</p>',
    onRead: () => {
      setStoryFlag('copperleafNote');
      save();
    },
  });
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
  setStoryFlag('askLongGrass');
  save();
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
