'use strict';
/* ================= STORY STAGE (Project Story S1) =================
   Plays a story script (logic/script.js) in the game: the lines in the dialogue box (talk.js), choices as buttons over
   it, battles, healing. Scripts live in the data: a person's `script` (a map's people), a trainer's `script`; ids are
   person:<id> and trainer:<id>. A name before a line is a speaker from story.json (Hazel, Blake ...) or a person id.
   - Safe runs: while a script plays, a save writes the state from before it (or from its last checkpoint, a battle)
     and where to carry on (logic/script.js saveDuringRun); Continue plays it again from there (storyResumeCheck).
   - Hold the dialogue box (0.6 s) to skip: the rest runs at once and still makes every change; a battle stops it.
   - ?story=<preset> (with ?test=1 only, nothing saved): a test game at a point in the story (story.json presets).
   S1 plays lines, choices, waits, heal and battle. Walk, face, camera, fade and shot come with S2 and S5: until then
   they do nothing but say so in the debug log; go and the openings' other commands stop a script with an error. */
/* the script lines of a person or a trainer: person:<id> (in a map's people), trainer:<id> */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, toast } from './hooks.js';
import { LOCATIONS, STORY_DATA, TRAINERS, gameData } from './game-data.js';
import { healAll } from './logic/rules.js';
import { parseScript, runBase, runScript, saveDuringRun } from './logic/script.js';
import { startTrainer } from './logic/battle-engine.js';
import { activeBattle, reducedMotion, save, saveData, uiState } from './game-state.js';
import { walkView } from './walk-view.js';
import { talkBox, talkChoose, talkHide, talkLine } from './talk.js';
import { cutscene } from './cutscene.js';
/* eslint-disable no-func-assign */
expose({
  playStoryScript: [() => playStoryScript, v => ((playStoryScript = v), provide({ playStoryScript }))],
  storyGameStage: [() => storyGameStage],
  storyHold: [() => storyHold, v => (storyHold = v)],
  storyOwner: [() => storyOwner, v => (storyOwner = v)],
  storyResumeCheck: [() => storyResumeCheck, v => (storyResumeCheck = v)],
  storyRun: [() => storyRun],
  storyScriptIds: [() => storyScriptIds, v => ((storyScriptIds = v), provide({ storyScriptIds }))],
  storyScriptLines: [() => storyScriptLines, v => (storyScriptLines = v)],
  storySpeaker: [() => storySpeaker, v => (storySpeaker = v)],
  storyTree: [() => storyTree, v => (storyTree = v)],
  storyTrees: [() => storyTrees],
  storyWait: [() => storyWait],
});
/* eslint-enable no-func-assign */
provide({ playStoryScript, storyScriptIds });
/* to-module: end */
function storyScriptLines(id) {
  const i = id.indexOf(':'),
    kind = id.slice(0, i),
    key = id.slice(i + 1);
  if (kind === 'trainer') return (TRAINERS[key] && TRAINERS[key].script) || null;
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
  return ids;
}
/* who says a line that names nobody: the person or trainer the script belongs to */
function storyOwner(id) {
  const key = id.slice(id.indexOf(':') + 1);
  if (id.startsWith('trainer:')) return (TRAINERS[key] && TRAINERS[key].who) || null;
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
const storyWait = ms => new Promise(r => setTimeout(r, reducedMotion ? 0 : ms));
/* the game's stage for the runner */
const storyGameStage = {
  say: l => talkLine(storySpeaker(l.who || 'me'), l.text, l.expr, {}),
  choose: options => talkChoose(options),
  wait: ([s]) => storyWait(+s * 1000),
  heal: () => {
    healAll();
    save();
  },
  /* the battle starts after the box closes; the script goes on once it is over and its windows are closed */
  battle: async ([id]) => {
    talkHide();
    if (!TRAINERS[id]) throw new Error(`no trainer ${id}`);
    startTrainer(id, { talked: true });
    while (activeBattle || uiState.modal) await storyWait(250);
  },
};
for (const c of ['walk', 'face', 'camera', 'fade', 'shot'])
  storyGameStage[c] = args => {
    if (typeof debugLog !== 'undefined') debugLog.add('story', `${c} ${args.join(' ')}: not played yet (S2)`);
  };
const storyRun = { on: false, id: null, base: null, path: null, control: null };
/* plays a script by id; resume: where a saved run goes on from */
async function playStoryScript(id, o = {}) {
  const tree = storyTree(id);
  if (!tree || storyRun.on) return false;
  const S = saveData,
    control = { skipping: false };
  Object.assign(storyRun, { on: true, id, base: runBase(S), path: o.resume || null, control });
  Object.defineProperty(S, 'toJSON', {
    configurable: true,
    value: () => saveDuringRun(S, storyRun.base, { script: id, path: storyRun.path }),
  });
  if (typeof debugLog !== 'undefined') debugLog.add('story', `script ${id}${o.resume ? ' (resumed)' : ''}`);
  try {
    await runScript(tree, storyGameStage, {
      save: S,
      id,
      speaker: o.speaker || storyOwner(id),
      scripts: storyTree,
      locations: LOCATIONS,
      questStages: Object.fromEntries(Object.entries(STORY_DATA.quests || {}).map(([k, q]) => [k, q.stages])),
      resume: o.resume || null,
      control,
      onCheckpoint: p => {
        storyRun.base = runBase(S);
        storyRun.path = p;
        save();
      },
    });
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('story', `script ${id} stopped: ${e.message}`);
    toast('The story stopped here: ' + e.message);
  } finally {
    delete S.toJSON;
    talkHide();
    Object.assign(storyRun, { on: false, id: null, base: null, path: null, control: null });
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
    if (typeof debugLog !== 'undefined') debugLog.add('story', `skipped the rest of ${storyRun.id}`);
  }, 600);
});
for (const t of ['pointerup', 'pointercancel', 'pointerleave'])
  document.addEventListener(t, () => clearTimeout(storyHold));
