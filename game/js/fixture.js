'use strict';
/* ================= FIXTURE =================
   For the fast check (tools/check-fast.py): ?fixture=<name> starts a ready-made game right where a check needs it,
   without the opening and without waiting for every map. The save is made here, keeps its own key in this browser
   and never reaches an account (game-state.js FIXTURE), so a player's save is never touched.
     title   a new game on the title screen (the boot a new player sees)
     town    Copperleaf Town, the hub (RL-5: the route and the cave were parked with their places)
     room    inside Professor Hazel's lab in Copperleaf
     battle  a trainer battle (Leader Rocco) in Copperleaf that the team wins
     stored  whatever the fixture saved last in this browser (the save round trip)
     run     on a run (RL-7): standing on its landing on day 1, its world made from the seed RL7FIXTURE
     mountains   the same run with the debug menu's mountains mod (TR-3: mountains north and south, for the camera)
     ranch   inside Copperleaf's ranch (RL-9): three Billies in storage (one two levels under the cap), 50 Scrap
     relics  the run, holding five Loopholes (RL-12: one under the cap), $2,000, a mini-boss's pick waiting
   UI-3b, for the Studio's UI look preview (the real screens with the look being edited):
     team    the Team screen          bag     the Bag, with a few of each item
     talk    the dialogue box with a line from Professor Hazel
   While a fixture runs, a page of the same origin that holds it in a frame (the Studio) can hand it a look:
   postMessage({type: 'uiLook', theme, mode, reduced, text}) (fixtureLook below).
   The trainer and the buddy carry planted names (FIXTURE_NAMES) that the debug log must never hold. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { LOCATIONS, RELICS, RULES, SPECIES, START_NODE, TRAINERS } from './game-data.js';
import { makeBilly } from './logic/rules.js';
import { applyUiTheme } from './theme-sheet.js';
import { runBegin } from './logic/run-state.js';
import { runArrive, runMapStart } from './logic/run-map.js';
import { MAPGEN_VERSION } from './logic/mapgen.js';
import { RUN_MOD_MOUNTAINS } from './logic/run-scenes.js';
import { relicOfferMake } from './logic/relics.js';
import { newSave } from './logic/saves.js';
import { startTrainer } from './logic/battle-engine.js';
import { FIXTURE, saveData, setSaveData, uiState } from './game-state.js';
import { LOOK_PRESETS, cleanLook } from './person-art.js';
import { applyPreferences } from './settings-screen.js';
import { actionSpot, walkData, walkView } from './walk-view.js';
import { talkLine } from './talk.js';
import { runWorldData } from './run-world.js';
import { renderOverlay } from './overlay.js';
import { enterRoom } from './walk-control.js';
import { render } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  FIXTURE_NAMES: [() => FIXTURE_NAMES],
  FIXTURE_PLACES: [() => FIXTURE_PLACES],
  FIXTURE_RELICS: [() => FIXTURE_RELICS],
  FIXTURE_RUN_SEED: [() => FIXTURE_RUN_SEED],
  fixtureLook: [() => fixtureLook, v => (fixtureLook = v)],
  fixtureSave: [() => fixtureSave, v => (fixtureSave = v)],
  fixtureStart: [() => fixtureStart, v => (fixtureStart = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FIXTURE_NAMES = { trainer: 'Quillonda', nick: 'Zorblax' };
provide({ FIXTURE_NAMES }); /* to-module */
const FIXTURE_PLACES = {
  town: 'copperleaf',
  room: 'copperleaf',
  battle: 'copperleaf',
  team: 'copperleaf',
  bag: 'copperleaf',
  talk: 'copperleaf',
  run: 'copperleaf',
  mountains: 'copperleaf',
  relics: 'copperleaf',
  ranch: 'copperleaf',
};
/** RL-12: the Loopholes the relics fixture holds (a shop's and a clinic's price rows, a catch row, a battle's stage, a
 * heal on arrival) */
const FIXTURE_RELICS = ['shelter', 'lobbyist', 'fineprint', 'insider', 'severance'];
/** RL-7: the run fixture's seed */
const FIXTURE_RUN_SEED = 'RL7FIXTURE';
function fixtureSave() {
  const s = newSave();
  if (FIXTURE === 'title') return s;
  const sp = (RULES.start.starters || [])[0],
    node = Math.max(
      0,
      LOCATIONS.findIndex(l => l.id === FIXTURE_PLACES[FIXTURE])
    );
  s.preferences.skipTitle = true;
  s.started = true;
  s.gender = 'me';
  s.starter = sp;
  s.avatar = cleanLook(Object.assign({}, LOOK_PRESETS[0], { name: FIXTURE_NAMES.trainer }));
  s.wardrobe = { owned: {}, outfits: [null, null, null] };
  s.trip = { node, plan: [] };
  s.visited = { [START_NODE]: 1, [node]: 1 };
  s.since = Date.now();
  const lead = makeBilly(SPECIES[sp + '2'] ? sp + '2' : sp + '0', 45),
    second = makeBilly(SPECIES.ek1 ? 'ek1' : sp + '0', 30);
  lead.nick = FIXTURE_NAMES.nick;
  s.team = [lead, second];
  s.buddy = lead.uid;
  for (const m of s.team) s.caught[m.sp] = s.seen[m.sp] = 1;
  /* RL-9: the ranch's fixture has Billies resting in storage and Scrap to train them */
  if (FIXTURE === 'ranch') {
    const R = RULES.ranch;
    s.meta.scrap = 50;
    for (const lvl of [5, 8, R.capBase - 2]) {
      const m = makeBilly(sp + '0', lvl);
      m.boxedAt = Date.now();
      s.box.push(m);
      s.caught[m.sp] = s.seen[m.sp] = 1;
    }
  }
  /* UI-3b: the Bag fixture has something in it */
  if (FIXTURE === 'bag') for (const k of Object.keys(s.items)) s.items[k] = 3;
  /* the people who would stop you to talk have met you already */
  s.story = { met_chad: 1, met_chad2: 1, rival0: 1 };
  for (const T of Object.values(TRAINERS)) if (T.runsUp) s.story['met_' + T.id] = 1;
  /* RL-7: a run from the mast (RL-8 does this at the airship) that has landed: its map, day 1 on the landing; its
     world goes in at boot (run-world.js) */
  if (FIXTURE === 'run' || FIXTURE === 'mountains' || FIXTURE === 'relics') {
    const data = runWorldData();
    /* RL-9b: one Billie from home at Bracket I, the lead (the second stays in Copperleaf) */
    runBegin(s, { seed: FIXTURE_RUN_SEED, tier: 1, mapgenV: MAPGEN_VERSION, se: RULES.start.se, home: [lead.uid] });
    if (FIXTURE === 'mountains') s.run.mods = [RUN_MOD_MOUNTAINS];
    runMapStart(s.run, data);
    runArrive(s, 0, data);
    s.run.at.phase = 'walk';
    s.visited[s.trip.node] = 1;
  }
  /* RL-12: five Loopholes held (one under the cap), money for the shop, and a mini-boss's pick waiting (it opens once
     the world shows, as after a reload: run.js runResume) */
  if (FIXTURE === 'relics') {
    s.run.relics = FIXTURE_RELICS.filter(id => RELICS[id]);
    s.se = 2000;
    relicOfferMake(s.run, RELICS, RULES.run.relics);
  }
  return s;
}
if (FIXTURE && FIXTURE !== 'stored') setSaveData(fixtureSave());
/* after the loading screen (boot.js): step into the room or the battle */
export function fixtureStart() {
  uiState.modal = null;
  uiState.mq = [];
  uiState.tab = 'walk';
  renderOverlay();
  render();
  /* phase 08b: into a room through its door, as soon as the town is on screen (RL-5: Hazel's lab in Copperleaf) */
  if (FIXTURE === 'room' || FIXTURE === 'ranch') {
    const act = FIXTURE === 'ranch' ? 'ranch' : 'lab';
    const go = (n = 0) => {
      const p = walkView.ready && walkView.sc && !walkView.pl.fresh && walkView.sc.props.find(q => q.act === act);
      if (!p) {
        if (n < 600) setTimeout(() => go(n + 1), 100);
        return;
      }
      const g = actionSpot(p, walkData().sc.props[p.k]);
      walkView.pl.route = null;
      walkView.pl.x = g[0];
      walkView.pl.z = g[1];
      enterRoom(act, p);
    };
    go();
  }
  if (FIXTURE === 'battle') startTrainer('crude');
  /* UI-3b: the screens the Studio's UI look preview shows */
  if (FIXTURE === 'team' || FIXTURE === 'bag') {
    uiState.tab = FIXTURE;
    render();
  }
  if (FIXTURE === 'talk')
    talkLine('gini', 'This is the dialogue box. The Studio shows it with the look you are editing.');
}
/* UI-3b: the Studio's UI look preview hands a fixture the look being edited: the theme sheet, and light or dark,
   reduced motion and the text size through the fixture save's own Settings (only a fixture listens) */
function fixtureLook(ev) {
  const m = ev.data || {};
  if (ev.origin !== location.origin || m.type !== 'uiLook') return;
  if (m.theme) applyUiTheme(m.theme);
  const p = (saveData.preferences = saveData.preferences || {});
  p.theme = m.mode === 'dark' ? 'dark' : 'light';
  p.motion = m.reduced ? 'reduced' : 'full';
  p.textSize = m.text || 'normal';
  applyPreferences();
}
if (FIXTURE) addEventListener('message', fixtureLook);
