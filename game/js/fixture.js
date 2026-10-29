'use strict';
/* ================= FIXTURE =================
   For the fast check (tools/check-fast.py): ?fixture=<name> starts a ready-made game right where a check needs it,
   without the opening and without waiting for every map. The save is made here, keeps its own key in this browser
   and never reaches an account (game-state.js FIXTURE), so a player's save is never touched.
     title   a new game on the title screen (the boot a new player sees)
     town    Copperleaf Town, the hub (RL-5: the route and the cave were parked with their places)
     room    inside Professor Chosen's lab in Copperleaf (Kappi works there too)
     battle  a trainer battle (Leader Rocco) in Copperleaf that the team wins
     stored  whatever the fixture saved last in this browser (the save round trip)
     run     on a run (RL-7): standing on its landing on day 1, its world made from the seed RL7FIXTURE
     mountains   the same run with the debug menu's mountains mod (TR-3: mountains north and south, for the camera)
     layout  the same run with every laid-out place a forest trail (RT-1: forest masses, for measuring their cost);
             &plan=<id> another plan (logic/mapgen.js MAPGEN_LAYOUTS; none: the open field as before RT-1)
     ranch   inside Copperleaf's ranch (RL-9): three Billies in storage (one two levels under the cap), 50 Scrap
     pasture the ranch's save, standing outside the pasture's gate (IS-8: the three wander inside)
     relics  the run, holding five Perks (RL-12: one under the cap), 2,000 Moneys, a mini-boss's pick waiting
     lab     Copperleaf after a run (RL-11): 500 Research, 60 Scrap, 2 Crests, one run ended (a milestone met)
     island  the test island (island track IS-0: test_island, the map with the island contract's fields)
   UI-3b, for the Studio's UI look preview (the real screens with the look being edited):
     team    the Team screen          bag     the Bag, with a few of each item
     talk    the dialogue box with a line from Professor Chosen
   While a fixture runs, a page of the same origin that holds it in a frame (the Studio) can hand it a look:
   postMessage({type: 'uiLook', theme, mode, reduced, text}) (fixtureLook below).
   The trainer and the buddy carry planted names (FIXTURE_NAMES) that the debug log must never hold. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { LOCATIONS, PERKS, RULES, SPECIES, START_NODE, TRAINERS, UNLOCK_DATA } from './game-data.js';
import { makeBilly } from './logic/rules.js';
import { applyUiTheme } from './theme-sheet.js';
import { runArrive } from './logic/run-map.js';
import { RUN_LAYOUT_MOD, RUN_MOD_MOUNTAINS } from './logic/run-scenes.js';
import { runWorldData } from './logic/run-world-data.js';
import { perkOfferMake, perkTeamOf } from './logic/perks.js';
import { newSave } from './logic/saves.js';
import { startTrainer } from './logic/battle-engine.js';
import { runUnlocks } from './logic/unlocks.js';
import { runStartOn, runStartPlan } from './logic/run-start.js';
import { FIXTURE, saveData, setSaveData, uiState } from './game-state.js';
import { LOOK_PRESETS, cleanLook } from './person-art.js';
import { applyPreferences } from './settings-screen.js';
import { actionSpot, walkData, walkView } from './walk-view.js';
import { talkChoose, talkHide, talkLine } from './talk.js';
import { renderOverlay } from './overlay.js';
import { enterRoom } from './walk-control.js';
import { render } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  FIXTURE_NAMES: [() => FIXTURE_NAMES],
  FIXTURE_PERKS: [() => FIXTURE_PERKS],
  FIXTURE_PLACES: [() => FIXTURE_PLACES],
  FIXTURE_PLAN: [() => FIXTURE_PLAN],
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
  layout: 'copperleaf',
  relics: 'copperleaf',
  ranch: 'copperleaf',
  pasture: 'copperleaf',
  lab: 'copperleaf',
  island: 'copperleaf',
};
/** RL-12: the Perks the relics fixture holds (a shop's and a clinic's price rows, a catch row, a battle's stage, a
 * heal on arrival) */
const FIXTURE_PERKS = ['clinic_card', 'coupon_book', 'steady_hand', 'running_shoes', 'trail_snacks'];
/** RT-1: the layout fixture's plan (?plan=, forest when not given) */
const FIXTURE_PLAN = (() => {
  try {
    return (new URLSearchParams(location.search).get('plan') || 'forest').replace(/[^a-z]/g, '');
  } catch (e) {
    return 'forest';
  }
})();
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
  if (FIXTURE === 'ranch' || FIXTURE === 'pasture') {
    const R = RULES.ranch;
    s.meta.scrap = 50;
    for (const lvl of [5, 8, R.capBase - 2]) {
      const m = makeBilly(sp + '0', lvl);
      m.boxedAt = Date.now();
      s.box.push(m);
      s.caught[m.sp] = s.seen[m.sp] = 1;
    }
  }
  /* RL-11: the Lab's fixture has what a few runs bring home, and one run ended (the first milestone, granted on load) */
  if (FIXTURE === 'lab') Object.assign(s.meta, { research: 500, scrap: 60, crests: 2, runs: 1 });
  /* UI-3b: the Bag fixture has something in it */
  if (FIXTURE === 'bag') for (const k of Object.keys(s.items)) s.items[k] = 3;
  /* the people who would stop you to talk have met you already */
  s.story = { met_chad: 1, met_chad2: 1, rival0: 1 };
  for (const T of Object.values(TRAINERS)) if (T.runsUp) s.story['met_' + T.id] = 1;
  /* RL-7: a run from the mast (RL-8 does this at the airship) that has landed: its map, day 1 on the landing; its
     world goes in at boot (run-world.js) */
  if (FIXTURE === 'run' || FIXTURE === 'mountains' || FIXTURE === 'layout' || FIXTURE === 'relics') {
    const data = runWorldData();
    /* RL-9b, RL-13: the lead travels (the second stays in Copperleaf); Expedition I, no challenges. Studio plan T2.1: started
       as the mast starts a run (logic/run-start.js), with a fresh save's unlocks (none: no ridge or autumn) */
    const plan = runStartPlan(
      FIXTURE_RUN_SEED,
      { ...data, unlockData: UNLOCK_DATA },
      {
        unlocks: runUnlocks(s, UNLOCK_DATA),
        mods:
          FIXTURE === 'mountains' ? [RUN_MOD_MOUNTAINS] : FIXTURE === 'layout' ? [RUN_LAYOUT_MOD + FIXTURE_PLAN] : [],
      }
    );
    runStartOn(s, plan, { home: [lead.uid] });
    runArrive(s, 0, data);
    s.run.at.phase = 'walk';
    s.visited[s.trip.node] = 1;
  }
  /* RL-12: five Perks held (one under the cap), money for the shop, and a mini-boss's pick waiting (it opens once
     the world shows, as after a reload: run.js runResume) */
  if (FIXTURE === 'relics') {
    s.run.perks = FIXTURE_PERKS.filter(id => PERKS[id]);
    s.se = 2000;
    perkOfferMake(s.run, PERKS, RULES.run.perks, perkTeamOf(s.team));
  }
  return s;
}
if (FIXTURE && FIXTURE !== 'stored') setSaveData(fixtureSave());
/* after the loading screen (boot.js): step into the room or the battle */
export function fixtureStart() {
  uiState.modal = null;
  uiState.mq = [];
  uiState.tab = 'walk';
  /* island track IS-0: the test island instead of the town (as the debug menu's Test scenes opens it) */
  if (FIXTURE === 'island') uiState.bench = { id: 'test_island', test: 1 };
  renderOverlay();
  render();
  /* phase 08b: into a room through its door, as soon as the town is on screen (RL-5: Kappi's lab in Copperleaf) */
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
  /* IS-8: outside the pasture's gate, the field in front of you */
  if (FIXTURE === 'pasture') {
    const go = (n = 0) => {
      const p = walkView.ready && walkView.sc && !walkView.pl.fresh && walkView.sc.props.find(q => q.act === 'pasture');
      if (!p) {
        if (n < 600) setTimeout(() => go(n + 1), 100);
        return;
      }
      const g = actionSpot(p, walkData().sc.props[p.k]);
      walkView.pl.route = null;
      walkView.pl.x = g[0];
      walkView.pl.z = g[1];
    };
    go();
  }
  if (FIXTURE === 'battle') startTrainer('crude');
  /* UI-3b: the screens the Studio's UI look preview shows */
  if (FIXTURE === 'team' || FIXTURE === 'bag') {
    uiState.tab = FIXTURE;
    render();
  }
  if (FIXTURE === 'talk') {
    /* DL-3: &skin= shows a skin's bubble with a line of its own, &style= says it as a shout, a whisper or a thought */
    const q = new URLSearchParams(location.search),
      /* DL-6: &figures=mannequin (or rogue, or 1: the default figure) talks with figure close-ups: Engine > People >
         Figures and Townsfolk as figures on, as a player's own dials (the fixture's save only) */
      figs = q.get('figures');
    if (figs) {
      const p = (saveData.preferences = saveData.preferences || {}),
        people = { figures: true, folk: true, ...(/^[a-z]+$/.test(figs) ? { figure: figs } : {}) };
      p.expert = true;
      p.eng = { ...(p.eng || {}), people: { ...((p.eng && p.eng.people) || {}), ...people } };
    }
    const pick = /** @type {Record<string, [string, string, any]>} */ ({
        chosen: ['chosen', 'This is the dialogue box. The Studio shows it with the look you are editing.', {}],
        kappi: ['kappi', 'Breathe in. The water always knows the way down.', {}],
        blake: ['chad', 'Oh, it’s [b]you[/b] again. Try to keep up this time.', {}],
        bureau: [
          'clerk',
          'You look lost. That is [b]our[/b] department.[stamp=approved]',
          { cls: 'bureau_clerk', name: 'Clerk 4471' },
        ],
        folk: ['folk:3', 'Nice weather for a walk, isn’t it? The bridge is new.', {}],
        narration: ['me', 'The water is calm and deep. Would you like to Surf?', {}],
        you: ['me', 'Where am I? This doesn’t look like the city.', { skin: 'you' }],
      })[q.get('skin') || 'chosen'] || ['chosen', 'This is the dialogue box.', {}],
      style = (q.get('style') || '').replace(/[^a-z]/g, '');
    /* DL-4: &stack=1 plays a whole exchange (sides, a linked pair, Kappi's "…", a cut, a [wait], the stamp), tapped on
       by the caller (tools/look-talk.py); &choice=1 ends it in a choice */
    if (q.get('stack')) {
      const lines = /** @type {[string, string, any][]} */ ([
        ['chosen', 'So. You fell through the crust. Mostly [b]furniture[/b] does that.', {}],
        ['kappi', '[whisper] They are not furniture, Professor.', {}],
        ['kappi', 'Breathe in. The water always knows the way down.', {}],
        ['chad', '[shout] Out of my way, I was here first, I’m next in the—', {}],
        [
          'clerk',
          '[wait] Actually, the queue is [b]ours[/b].[stamp=approved]',
          { cls: 'bureau_clerk', name: 'Clerk 4471' },
        ],
        ['chosen', '[think] Was it left at the fork, or right?', {}],
      ]);
      (async () => {
        for (const [who, text, o] of lines) await talkLine(who, text, null, o);
        if (q.get('choice')) await talkChoose([{ text: 'Join the queue' }, { text: 'Walk away' }]);
        talkHide();
      })();
      return;
    }
    /* DL-5: &faces=1 plays faces: a mid-line face, emotes, a face's own emote and a listener, tapped on by the caller
       (tools/look-talk.py --only=faces) */
    if (q.get('faces')) {
      const lines = /** @type {[string, string, any][]} */ ([
        ['chosen', '[happy] Welcome back! The lab missed you. Mostly the [face=sad]floors did.', {}],
        ['kappi', 'The kettle is on.[emote=note] It always is.', {}],
        ['chad', '[surprised] You again? I thought the crust ate you!', {}],
        ['chosen', 'Blake, please. [face=angry]Not on the carpet.[emote=sweat]', {}],
        ['kappi', '[happy] I like the carpet.[emote=heart]', {}],
      ]);
      (async () => {
        for (const [who, text, o] of lines) await talkLine(who, text, null, o);
        talkHide();
      })();
      return;
    }
    const said = (/^(shout|whisper|think)$/.test(style) ? `[${style}] ` : '') + pick[1];
    talkLine(pick[0], said, null, pick[2]);
  }
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
