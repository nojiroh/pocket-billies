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
   The trainer and the buddy carry planted names (FIXTURE_NAMES) that the debug log must never hold. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { LOCATIONS, RULES, SPECIES, START_NODE, TRAINERS } from './game-data.js';
import { makeBilly } from './logic/rules.js';
import { newSave } from './logic/saves.js';
import { startTrainer } from './logic/battle-engine.js';
import { FIXTURE, saveData, setSaveData, uiState } from './game-state.js';
import { LOOK_PRESETS, cleanLook } from './person-art.js';
import { render, renderOverlay } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  FIXTURE_NAMES: [() => FIXTURE_NAMES],
  FIXTURE_PLACES: [() => FIXTURE_PLACES],
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
  s.trip = { node, prog: 0, plan: [], hold: false };
  s.visited = { [START_NODE]: 1, [node]: 1 };
  s.since = Date.now();
  const lead = makeBilly(SPECIES[sp + '2'] ? sp + '2' : sp + '0', 45),
    second = makeBilly(SPECIES.ek1 ? 'ek1' : sp + '0', 30);
  lead.nick = FIXTURE_NAMES.nick;
  s.team = [lead, second];
  s.buddy = lead.uid;
  for (const m of s.team) s.caught[m.sp] = s.seen[m.sp] = 1;
  /* the people who would stop you to talk have met you already */
  s.story = { met_chad: 1, met_chad2: 1, copperleafNote: 1, rival0: 1 };
  for (const T of Object.values(TRAINERS)) if (T.intro) s.story['met_' + T.id] = 1;
  return s;
}
if (FIXTURE && FIXTURE !== 'stored') setSaveData(fixtureSave());
/* after the loading screen (boot.js): step into the room or the battle */
export function fixtureStart() {
  uiState.modal = null;
  uiState.mq = [];
  if (FIXTURE === 'room') {
    const node = saveData.trip.node,
      here = LOCATIONS[node];
    uiState.inside = {
      id: 'int_shop',
      kind: 'shop',
      node,
      shop: here.shop || null,
      p: null,
      name: null,
      back: { id: here.mapId, x: 0, z: 0 },
    };
  }
  uiState.tab = 'walk';
  renderOverlay();
  render();
  if (FIXTURE === 'battle') startTrainer('crude');
}
