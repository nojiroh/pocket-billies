'use strict';
/* ================= FIXTURE =================
   For the fast check (tools/check-fast.py): ?fixture=<name> starts a ready-made game right where a check needs it,
   without the opening and without waiting for every map. The save is made here, keeps its own key in this browser
   and never reaches an account (game-state.js FIXTURE), so a player's save is never touched.
     title   a new game on the title screen (the boot a new player sees)
     town    Marigold Town          route   Tallgrass Meadow       cave   Gloomwater
     room    inside the shop in Marigold Town
     battle  a trainer battle (Leader Rocco) that the team wins
     stored  whatever the fixture saved last in this browser (the save round trip)
   UI-3b, for the Studio's UI look preview (the real screens with the look being edited):
     team    the Team screen          bag     the Bag, with a few of each item
     talk    the dialogue box with a line from Professor Hazel
   While a fixture runs, a page of the same origin that holds it in a frame (the Studio) can hand it a look:
   postMessage({type: 'uiLook', theme, mode, reduced, text}) (fixtureLook below).
   The trainer and the buddy carry planted names (FIXTURE_NAMES) that the debug log must never hold. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { LOCATIONS, RULES, SPECIES, START_NODE, TRAINERS } from './game-data.js';
import { makeBilly } from './logic/rules.js';
import { applyUiTheme } from './theme-sheet.js';
import { newSave } from './logic/saves.js';
import { startTrainer } from './logic/battle-engine.js';
import { FIXTURE, saveData, setSaveData, uiState } from './game-state.js';
import { LOOK_PRESETS, cleanLook } from './person-art.js';
import { applyPreferences } from './settings-screen.js';
import { actionSpot, walkData, walkView } from './walk-view.js';
import { talkLine } from './talk.js';
import { enterRoom, render, renderOverlay } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  FIXTURE_NAMES: [() => FIXTURE_NAMES],
  FIXTURE_PLACES: [() => FIXTURE_PLACES],
  fixtureLook: [() => fixtureLook, v => (fixtureLook = v)],
  fixtureSave: [() => fixtureSave, v => (fixtureSave = v)],
  fixtureStart: [() => fixtureStart, v => (fixtureStart = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FIXTURE_NAMES = { trainer: 'Quillonda', nick: 'Zorblax' };
provide({ FIXTURE_NAMES }); /* to-module */
const FIXTURE_PLACES = {
  town: 'marigold',
  route: 'tallgrass_meadow',
  cave: 'gloomwater',
  room: 'marigold',
  battle: 'fizzwell',
  team: 'marigold',
  bag: 'marigold',
  talk: 'marigold',
};
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
  /* UI-3b: the Bag fixture has something in it */
  if (FIXTURE === 'bag') for (const k of Object.keys(s.items)) s.items[k] = 3;
  /* the people who would stop you to talk have met you already */
  s.story = { met_chad: 1, met_chad2: 1, rival0: 1 };
  for (const T of Object.values(TRAINERS)) if (T.runsUp) s.story['met_' + T.id] = 1;
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
  /* phase 08b: into the shop through its door, as soon as the town is on screen */
  if (FIXTURE === 'room') {
    const go = (n = 0) => {
      const p =
        walkView.ready &&
        walkView.sc &&
        !walkView.pl.fresh &&
        walkView.sc.props.find(q => q.act === 'shop' && q.k === 'shop');
      if (!p) {
        if (n < 600) setTimeout(() => go(n + 1), 100);
        return;
      }
      const g = actionSpot(p, walkData().sc.props[p.k]);
      walkView.pl.route = null;
      walkView.pl.x = g[0];
      walkView.pl.z = g[1];
      enterRoom('shop', p);
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
