'use strict';
/* ================= STORY STAGE (Project Story S1) =================
   Plays a story script (logic/script.js) in the game: the lines in the dialogue box (talk.js), choices as buttons over
   it, battles, healing. Scripts live in the data: a person's `script` (a map's people), a trainer's `script`; ids are
   person:<id> and trainer:<id>. A name before a line is a speaker from story.json (Kappi, Blake ...) or a person id.
   - Safe runs: while a script plays, a save writes the state from before it (or from its last checkpoint, a battle)
     and where to carry on (logic/script.js saveDuringRun); Continue plays it again from there (storyResumeCheck).
   - Hold the dialogue box (0.6 s) to skip: the rest runs at once and still makes every change; a battle stops it.
   - ?story=<preset> (with ?test=1 only, nothing saved): a test game at a point in the story (story.json presets).
   - S2: the scene in the walk scene you stand in: `camera run-up` borrows the opening's director (cutscene.js) and
     puts you and the one who talks on it, `walk <who> beside me` brings them over, `face`, `music`, `fade`; a battle
     ends the scene first. A line waits for open windows (a battle's result) to close.
   - story:<id> scripts belong to the story, not to someone (story.json scripts: the Chosen in the lab, the ending).
   A cutscene's own commands (actor, caption, ...) and the opening's play on the cutscene stage (cutscene/stage.js): go
   and those stop a script here with an error. */
/* the script lines of a person, a trainer or the story: person:<id> (in a map's people), trainer:<id>, story:<id> */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, selfTest, toast } from './hooks.js';
import { $, clamp } from './util.js';
import { BANTER, LOCATIONS, PEOPLE, RELATIONS, RESIDENTS, STORY_DATA, TRAINERS, gameData } from './game-data.js';
import { healAll } from './logic/rules.js';
import { faceWord } from './logic/person-view.js';
import { relFavoursPay } from './logic/relations.js';
import { startTrainer } from './logic/battle-engine.js';
import { conditionHolds, conditionTree, storyStateOf } from './logic/conditions.js';
import { BANTER_HUB, banterOwner, storyPick, storyPickSaid } from './logic/story-pick.js';
import { parseScript } from './logic/script-parse.js';
import { runBase, runScript, saveDuringRun, storyTeamLookups } from './logic/script.js';
import { activeBattle, reducedMotion, save, saveData, uiState } from './game-state.js';
import { lookOf } from './person-art.js';
import { walkView, walkablePointNear } from './walk-view.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { music } from './sound.js';
import { talkBox, talkChoose, talkHide, talkLine } from './talk.js';
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
} from './cutscene/director.js';
import { trainRide } from './train-ride.js';
/* eslint-disable no-func-assign */
expose({
  cutsceneWorldBegin: [() => cutsceneWorldBegin, v => (cutsceneWorldBegin = v)],
  cutsceneWorldEnd: [() => cutsceneWorldEnd, v => (cutsceneWorldEnd = v)],
  playStoryScript: [() => playStoryScript, v => ((playStoryScript = v), provide({ playStoryScript }))],
  storyFreshTake: [() => storyFreshTake, v => ((storyFreshTake = v), provide({ storyFreshTake }))],
  storyGameStage: [() => storyGameStage],
  storyHold: [() => storyHold, v => (storyHold = v)],
  storyHomeArrive: [() => storyHomeArrive, v => ((storyHomeArrive = v), provide({ storyHomeArrive }))],
  storyOwner: [() => storyOwner, v => (storyOwner = v)],
  storyPendingCheck: [() => storyPendingCheck, v => ((storyPendingCheck = v), provide({ storyPendingCheck }))],
  storyPickId: [() => storyPickId, v => ((storyPickId = v), provide({ storyPickId }))],
  storyPickPlay: [() => storyPickPlay, v => ((storyPickPlay = v), provide({ storyPickPlay }))],
  storyPickTree: [() => storyPickTree, v => (storyPickTree = v)],
  storyResumeCheck: [() => storyResumeCheck, v => (storyResumeCheck = v)],
  storyRun: [() => storyRun],
  storyRunUp: [() => storyRunUp, v => (storyRunUp = v)],
  storyScene: [() => storyScene],
  storySceneEnd: [() => storySceneEnd, v => (storySceneEnd = v)],
  storySceneOn: [() => storySceneOn],
  storyScriptIds: [() => storyScriptIds, v => ((storyScriptIds = v), provide({ storyScriptIds }))],
  storyScriptLines: [() => storyScriptLines, v => (storyScriptLines = v)],
  storySlots: [() => storySlots],
  storySpeaker: [() => storySpeaker, v => (storySpeaker = v)],
  storyTree: [() => storyTree, v => (storyTree = v)],
  storyTrees: [() => storyTrees],
  storyWait: [() => storyWait],
  storyWindowsClosed: [() => storyWindowsClosed, v => (storyWindowsClosed = v)],
  storyWorldOK: [() => storyWorldOK, v => ((storyWorldOK = v), provide({ storyWorldOK }))],
});
/* eslint-enable no-func-assign */
provide({
  playStoryScript,
  storyFreshTake,
  storyHomeArrive,
  storyPendingCheck,
  storyPickId,
  storyPickPlay,
  storyScriptIds,
  storyWorldOK,
});
/* to-module: end */
function storyScriptLines(id) {
  const i = id.indexOf(':'),
    kind = id.slice(0, i),
    key = id.slice(i + 1);
  if (kind === 'trainer') return (TRAINERS[key] && TRAINERS[key].script) || null;
  if (kind === 'story') return ((STORY_DATA.scripts || {})[key] || {}).script || null;
  /* RL-S1: the story director's lines (banter.json) */
  if (kind === 'banter') return (BANTER[key] && BANTER[key].script) || null;
  if (kind === 'person')
    for (const sc of Object.values(gameData.maps)) {
      const P = (sc.people || []).find(p => p.id === key && p.script);
      if (P) return P.script;
    }
  return null;
}
/* every script in the data, by id (the debug menu's list) */
function storyScriptIds() {
  const ids = [];
  for (const sc of Object.values(gameData.maps))
    for (const P of sc.people || []) if (P.script) ids.push('person:' + P.id);
  for (const [id, T] of Object.entries(TRAINERS)) if (T.script) ids.push('trainer:' + id);
  for (const id of Object.keys(STORY_DATA.scripts || {})) ids.push('story:' + id);
  for (const id of Object.keys(BANTER)) ids.push('banter:' + id);
  return ids;
}
/* who says a line that names nobody: the person or trainer the script belongs to, a story script's `who` */
function storyOwner(id) {
  const key = id.slice(id.indexOf(':') + 1);
  if (id.startsWith('trainer:')) return (TRAINERS[key] && TRAINERS[key].who) || null;
  if (id.startsWith('story:')) return ((STORY_DATA.scripts || {})[key] || {}).who || null;
  /* a hub character's line is theirs (their person id is their `who`); the others name their speakers */
  /* RS-3: a resident's line is theirs too (their id is their `who` and their person's) */
  if (id.startsWith('banter:'))
    return (BANTER[key] && (banterOwner(BANTER[key].who) || (RESIDENTS[BANTER[key].who] && BANTER[key].who))) || null;
  for (const sc of Object.values(gameData.maps)) {
    const P = (sc.people || []).find(p => p.id === key);
    if (P) return P.who || P.id;
  }
  return null;
}
/* who speaks a line: a speaker's name from story.json, else a person id as written */
function storySpeaker(name) {
  return (STORY_DATA.speakers || {})[name] || name;
}
const storyTrees = new Map();
function storyTree(id) {
  const lines = storyScriptLines(id);
  if (!lines) return null;
  let t = storyTrees.get(lines);
  if (!t) storyTrees.set(lines, (t = parseScript(lines)));
  return t;
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
const storyWait = ms => new Promise(r => setTimeout(r, reducedMotion ? 0 : ms));
/* a line, a choice or a scene waits until the windows on screen (a battle's result) are closed */
async function storyWindowsClosed() {
  while (uiState.modal || activeBattle) await storyWait(200);
}
/* ---------- the scene in the walk scene you stand in ---------- */
const storyScene = { on: false, run: 0, side: 1, to: /** @type {number[] | null} */ (null) };
/* `camera run-up`: someone runs up to you (Blake, Cass, Vinylla): the director on the walk scene, you and them on it,
   them out of sight beyond you, a wide shot */
async function storyRunUp() {
  if (storyScene.on || !storyWorldOK()) return;
  const who = storyRun.speaker || 'chad',
    run = cutsceneWorldBegin(),
    P = walkView.pl,
    sc = walkView.sc,
    side = P.x < sc.w / 2 ? 1 : -1,
    to = walkablePointNear(P.x + side * 1.4, P.z + 0.3),
    from = walkablePointNear(clamp(P.x + side * 7, 1, sc.w - 1), clamp(P.z + 4.5, 1, sc.h - 1));
  Object.assign(storyScene, { on: true, run, side, to });
  cutsceneActor('me', 'me', [P.x, P.z], side > 0 ? 'sideR' : 'side');
  cutsceneActor(who, who, from, 'down');
  cutscene.actors[who].hidden = true;
  const m = [(P.x + to[0]) / 2, (P.z + to[1]) / 2],
    gy = standingHeightAt(m[0], m[1]);
  cutsceneShot({ eye: [m[0], gy + 3.6, m[1] - 8.5], tgt: [m[0], gy + 1, m[1] + 1.5], fov: 38, w: 6 });
  await cutsceneWait(300);
}
const storySceneOn = () => storyScene.on && cutscene.on && cutscene.run === storyScene.run;
/* the scene's end: the one who ran up cheers, the screen fades, the walk scene is yours again */
async function storySceneEnd(outro) {
  if (!storyScene.on) return;
  try {
    const who = storyRun.speaker,
      A = who && cutscene.actors[who];
    if (outro && storySceneOn()) {
      cutsceneHideDialogue();
      if (A) {
        A.act = 'cheer';
        A.actT = cutsceneNow();
      }
      await cutsceneWait(700);
      const f = $('#csFade');
      if (f) {
        f.style.background = '#0B0912';
        f.classList.add('on');
      }
      await new Promise(r => setTimeout(r, reducedMotion ? 50 : 450));
    }
  } finally {
    storyScene.on = false;
    cutsceneWorldEnd();
  }
}
/* the game's stage for the runner */
const storyGameStage = {
  say: async l => {
    await storyWindowsClosed();
    storyRun.line = l.id || null;
    const who = storySpeaker(l.who || 'me'),
      /* RL-12b: a run's class trainer (a route trainer) goes by its class's name, not its look's */
      T = storyRun.id && storyRun.id.startsWith('trainer:') ? TRAINERS[storyRun.id.slice(8)] : null;
    return storySceneOn()
      ? cutsceneSay(who, l.text, l.expr)
      : talkLine(
          who,
          l.text,
          l.expr,
          /* RT-2: a pair's second trainer by its own class's name */
          T && T.cls && who === T.who
            ? { name: T.mate ? T.name.split(' & ')[0] : T.name }
            : T && T.mate && who === T.mate.who
              ? { name: T.mate.name }
              : {}
        );
  },
  choose: async options => {
    await storyWindowsClosed();
    return talkChoose(options);
  },
  wait: ([s]) => storyWait(+s * 1000),
  music: ([piece]) => {
    if (typeof music === 'function') music(piece);
  },
  heal: () => {
    healAll();
    save();
  },
  /* the battle starts after the box closes (and the scene, if one is on); the script goes on once it is over */
  battle: async ([id]) => {
    if (!TRAINERS[id]) throw new Error(`no trainer ${id}`);
    await storySceneEnd(true);
    talkHide();
    startTrainer(id, { talked: true });
    while (activeBattle) await storyWait(250);
  },
  camera: async ([shot]) => {
    if (shot === 'run-up') return storyRunUp();
    if (typeof debugLog !== 'undefined') debugLog.add('story', `camera ${shot}: no such shot`);
  },
  /* walk <who> beside me: the one who ran up comes over to stand beside you */
  walk: async ([name, ...where]) => {
    const who = storySpeaker(name);
    if (!storySceneOn() || !cutscene.actors[who]) return;
    if (where.join(' ') !== 'beside me') throw new Error(`walk ${name} ${where.join(' ')}: only "beside me" for now`);
    talkHide();
    const P = walkView.pl,
      to = /** @type {number[]} */ (storyScene.to),
      m = [(P.x + to[0]) / 2, (P.z + to[1]) / 2],
      gy = standingHeightAt(m[0], m[1]);
    cutscene.actors[who].hidden = false;
    cutsceneShot({ eye: [m[0], gy + 2.3, m[1] - 5.2], tgt: [m[0], gy + 1.05, m[1] + 0.4], fov: 38, w: 4 }, 1600);
    await cutsceneWalk(who, to, 1500);
  },
  /* face <who> me: the two of you turn to each other; face <who> up/down/side/sideR */
  face: ([name, dir]) => {
    const who = storySpeaker(name),
      A = cutscene.actors[who];
    if (!storySceneOn() || !A) return;
    const toMe = storyScene.side > 0 ? 'side' : 'sideR';
    if (dir === 'me') {
      faceWord(A, toMe);
      if (cutscene.actors.me) faceWord(cutscene.actors.me, toMe === 'side' ? 'sideR' : 'side');
    } else faceWord(A, dir);
  },
  fade: ([dir]) => {
    const f = $('#csFade');
    if (f) f.classList.toggle('on', dir !== 'in');
  },
  /* skipping (hold the box): the scene's camera work and walks are passed over; a walk lands where it was going */
  skipTo: (cmd, args) => {
    if (cmd === 'walk' && storySceneOn() && storyScene.to) {
      const A = cutscene.actors[storySpeaker(args[0])];
      if (A) [A.x, A.z, A.hidden] = [storyScene.to[0], storyScene.to[1], false];
    }
  },
};
/* line: the id of the line on screen (tools/story-ids.mjs), for the debug log */
export const storyRun = { on: false, id: null, speaker: null, line: null, base: null, path: null, control: null };
provide({ storyRun }); /* to-module */
const storySlots = { name: () => lookOf('me').name || 'Trainer' };
/* RL-S1: the script command `pick <who>`: the story director's line (logic/story-pick.js) on the game's save, marked
   said; in a trainer's script `rematch` reads that trainer's leader or class. Its tree, or null for nothing to say */
export function storyPickTree(who, id) {
  const k = storyPickId(who, id);
  return k ? storyTree('banter:' + k) : null;
}
/* RL-S2 part B: the story director's line for who, picked and played (a thank-you after a gift); false when no line
   fits */
async function storyPickPlay(who) {
  const k = storyPickId(who, null);
  return k ? playStoryScript('banter:' + k) : false;
}
/* the line picked for who (marked said), or null */
function storyPickId(who, id) {
  const S = saveData,
    story = S.story || (S.story = {}),
    runs = (S.meta && S.meta.runs) || 0,
    T = id && id.startsWith('trainer:') ? TRAINERS[id.slice(8)] : null,
    state = storyStateOf(S, {
      locations: LOCATIONS,
      questStages: Object.fromEntries(Object.entries(STORY_DATA.quests || {}).map(([k, q]) => [k, q.stages])),
      ...storyTeamLookups(),
      foe: T ? T.from || T.cls : undefined,
    }),
    k = storyPick(who, BANTER, c => conditionHolds(conditionTree(c), state), story, runs);
  if (!k) return null;
  storyPickSaid(k, BANTER, story, runs);
  if (typeof debugLog !== 'undefined') debugLog.add('story', `pick ${who}: ${k}`);
  return k;
}
/* RL-S1: home from a run (run.js runEndHome, after the run has ended): each hub character's first line is picked
   now (story.fresh, said at the first talk after: storyFreshTake), and a lost run's scene waits to play
   (story.pending, storyPendingCheck) */
/* RL-14b: next, a won run's scene (a bosses.json boss's first win: battle-rewards.js bossStoryNext) */
function storyHomeArrive(won, next = '') {
  const story = saveData.story || (saveData.story = {}),
    fresh = {};
  /* RL-S2 part B: the favours the run just ended did are paid first (logic/relations.js), so a thank-you can be
     picked below */
  const state = storyStateOf(saveData, {
    locations: LOCATIONS,
    questStages: Object.fromEntries(Object.entries(STORY_DATA.quests || {}).map(([k, q]) => [k, q.stages])),
    ...storyTeamLookups(),
  });
  for (const f of relFavoursPay(saveData, c => conditionHolds(conditionTree(c), state), RELATIONS)) {
    const P = /** @type {any} */ (PEOPLE || {})[f.who],
      name = (P && P.look && P.look.name) || f.who;
    toast(f.to > f.from ? `${name}: favour done, level ${f.to}` : `${name}: favour done`);
    if (typeof debugLog !== 'undefined') debugLog.add('story', `favour ${f.quest} done: ${f.who} +${f.points}`);
  }
  /* RL-S2 part B: a `must` line not yet heard (a Chapter beat, a favour's ask or thanks: their scripts set what comes
     next) waits for the next talk instead of being picked over */
  const was = story.fresh || {};
  for (const who of BANTER_HUB) {
    const keep = was[who] && BANTER[was[who]] && BANTER[was[who]].must ? was[who] : null,
      k = keep || storyPickId(who, null);
    if (k) fresh[who] = k;
  }
  story.fresh = fresh;
  if (won && next) story.pending = next;
  else if (won) delete story.pending;
  else story.pending = 'back-lost';
}
/* the line picked for who on the way home, taken (a talk plays it once in place of their own script), or null */
function storyFreshTake(who) {
  const fresh = saveData.story && saveData.story.fresh,
    k = fresh && fresh[who];
  if (!k) return null;
  delete fresh[who];
  return BANTER[k] ? k : null;
}
/* a scene waiting since the way home (story.pending): it plays once the hub's walk scene is up, nothing else open */
export function storyPendingCheck() {
  const story = saveData.story,
    p = story && story.pending;
  if (!p || saveData.run || storyRun.on || activeBattle || uiState.modal || talkBox.on || !walkView.ready) return;
  /* HB-8: not while the train comes home (train-ride.js tells it once you've stepped off) */
  if (typeof trainRide !== 'undefined' && trainRide.on) return;
  if (uiState.tab !== 'walk' || (typeof cutscene !== 'undefined' && cutscene.on)) return;
  if (typeof selfTest !== 'undefined' && selfTest.on) return;
  delete story.pending;
  playStoryScript('story:' + p);
}
/* plays a script by id; resume: where a saved run goes on from */
async function playStoryScript(id, o = {}) {
  const tree = storyTree(id);
  if (!tree) return false;
  /* a script started while another plays (the ending, from a battle's result) plays inside it */
  if (storyRun.on) {
    await runScript(tree, storyGameStage, {
      save: saveData,
      id,
      speaker: o.speaker || storyOwner(id),
      scripts: storyTree,
      locations: LOCATIONS,
      control: storyRun.control || undefined,
      slots: storySlots,
      pick: who => storyPickTree(who, id),
    });
    return true;
  }
  const S = saveData,
    control = { skipping: false };
  const speaker = o.speaker || storyOwner(id);
  Object.assign(storyRun, { on: true, id, speaker, base: runBase(S), path: o.resume || null, control });
  /* visits:<who> counts the talks with someone (a person's or a trainer's script) */
  if (!o.resume && /^(person|trainer):/.test(id)) {
    const T = (S.story || (S.story = {})).talks || (S.story.talks = {}),
      k = id.slice(id.indexOf(':') + 1);
    T[k] = (T[k] || 0) + 1;
  }
  Object.defineProperty(S, 'toJSON', {
    configurable: true,
    value: () => saveDuringRun(S, storyRun.base, { script: id, path: storyRun.path }),
  });
  if (typeof debugLog !== 'undefined') debugLog.add('story', `script ${id}${o.resume ? ' (resumed)' : ''}`);
  try {
    await runScript(tree, storyGameStage, {
      save: S,
      id,
      speaker,
      scripts: storyTree,
      locations: LOCATIONS,
      slots: storySlots,
      questStages: Object.fromEntries(Object.entries(STORY_DATA.quests || {}).map(([k, q]) => [k, q.stages])),
      resume: o.resume || null,
      control,
      pick: who => storyPickTree(who, id),
      onCheckpoint: p => {
        storyRun.base = runBase(S);
        storyRun.path = p;
        save();
      },
    });
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined')
      debugLog.add('story', `script ${id} stopped${storyRun.line ? ` after #l:${storyRun.line}` : ''}: ${e.message}`);
    toast('The story stopped here: ' + e.message);
  } finally {
    delete S.toJSON;
    await storySceneEnd(false).catch(e => console.error(e));
    talkHide();
    Object.assign(storyRun, { on: false, id: null, speaker: null, line: null, base: null, path: null, control: null });
    save();
  }
  return true;
}
/* Continue: a script that was saved halfway plays again from where it was, once the walk scene is up */
export function storyResumeCheck() {
  const R = saveData.story && saveData.story.resume;
  if (!R || storyRun.on || activeBattle || uiState.modal || talkBox.on || !walkView.ready) return;
  if (typeof cutscene !== 'undefined' && cutscene.on) return;
  delete saveData.story.resume;
  playStoryScript(R.script, { resume: R.path });
}
/* hold the dialogue box to skip the rest of a script */
let storyHold = null;
document.addEventListener('pointerdown', ev => {
  if (!storyRun.on || !ev.target.closest || !ev.target.closest('.talk-box')) return;
  clearTimeout(storyHold);
  storyHold = setTimeout(() => {
    if (!storyRun.on || !storyRun.control) return;
    storyRun.control.skipping = true;
    if (talkBox.cur) talkBox.cur.done();
    if (talkBox.choice) talkBox.choice.pick(0);
    if (typeof debugLog !== 'undefined')
      debugLog.add('story', `skipped the rest of ${storyRun.id}${storyRun.line ? ` from #l:${storyRun.line}` : ''}`);
  }, 600);
});
for (const t of ['pointerup', 'pointercancel', 'pointerleave'])
  document.addEventListener(t, () => clearTimeout(storyHold));
