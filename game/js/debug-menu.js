'use strict';
/* ================= DEBUG MENU =================
   Open it from Settings, with Ctrl+Shift+D, or by adding ?debug to the address.
   Everything here edits the current save directly; use Export first if you want a way back. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  closeModal,
  giveRobotKit,
  modal,
  perkPickOpen,
  pixelSky,
  playStoryScript,
  provide,
  render,
  renderOverlay,
  runBowlMapTest,
  runEvolution,
  runJump,
  runOver,
  runStartable,
  runTakeOff,
  storyScriptIds,
  testMapChecks,
  testMaps,
  toast,
} from './hooks.js';
import { $, $$, clamp } from './util.js';
import {
  COATS,
  DATA_WARN,
  DEX_ORDER,
  ITEMS,
  LOCATIONS,
  PERKS,
  PYRAMIDS,
  RULES,
  SPECIES,
  TRAINERS,
} from './game-data.js';
import { speciesOf } from './logic/fighters.js';
import {
  addBilly,
  encounterStock,
  encountersHere,
  gainXp,
  healAll,
  makeBilly,
  maxLevel,
  newUid,
  plural,
  spawn,
  xpFor,
} from './logic/rules.js';
import { ranchNow } from './logic/ranch-clock.js';
import { RUN_MOD_MOUNTAINS } from './logic/run-scenes.js';
import { perkOfferMake, perkTake } from './logic/perks.js';
import { allSnapshots, battleSay, checkFaints, fighter, startTrainer, startWild } from './logic/battle-engine.js';
import { activeBattle, escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { frameCount, frameScheduler, frameTask, userFps } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { applyPreferences, exportSave, settingsReset } from './settings-screen.js';
import { battleStage, battleStageResize } from './battle-stage.js';
import { mapById } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import { paintBoxes, playTurnEvents } from './battle.js';
import { worldMap } from './world-bowl.js';
/* eslint-disable no-func-assign */
expose({
  DEBUG_LOOK: [() => DEBUG_LOOK],
  DEBUG_OPEN_KEY: [() => DEBUG_OPEN_KEY],
  debugAction: [() => debugAction, v => (debugAction = v)],
  debugButtonHTML: [() => debugButtonHTML],
  debugFind: [() => debugFind, v => (debugFind = v)],
  debugFps: [() => debugFps, v => ((debugFps = v), provide({ debugFps }))],
  debugHTML: [() => debugHTML, v => (debugHTML = v)],
  debugMenu: [() => debugMenu],
  debugOpenKeep: [() => debugOpenKeep, v => (debugOpenKeep = v)],
  debugOpenRead: [() => debugOpenRead, v => (debugOpenRead = v)],
  debugSceneName: [() => debugSceneName],
  debugSection: [() => debugSection],
  debugSelectHTML: [() => debugSelectHTML],
  debugSpeciesOptions: [() => debugSpeciesOptions, v => (debugSpeciesOptions = v)],
  openDebug: [() => openDebug, v => (openDebug = v)],
  refreshDebugMenu: [() => refreshDebugMenu, v => (refreshDebugMenu = v)],
});
/* eslint-enable no-func-assign */
provide({ debugFps });
/* to-module: end */
const debugMenu = { fps: false, on: /[?&]debug\b/.test(location.search) };
const debugSelectHTML = (id, opts, val) =>
  `<select id="${id}">${opts.map(([v, n]) => `<option value="${escapeHtml(v)}" ${String(v) === String(val) ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>`;
const debugButtonHTML = (x, l, c = '') => `<button class="pb small ${c}" data-a="dbg" data-x="${x}">${l}</button>`;
function debugSpeciesOptions() {
  return DEX_ORDER.map(id => [id, `${String(SPECIES[id].no).padStart(3, '0')} ${SPECIES[id].name}`]);
}
/* UI-7b: time, weather and season overrides, out of Settings (in a run game they are a cheat): the same preferences */
const DEBUG_LOOK = {
  time: [
    ['real', 'Time: the clock'],
    ['morning', 'Morning'],
    ['day', 'Midday'],
    ['evening', 'Evening'],
    ['night', 'Night'],
  ],
  weather: [
    ['auto', 'Weather: changes'],
    ['clear', 'Fair'],
    ['rain', 'Rain'],
    ['snow', 'Snow'],
    ['fog', 'Fog'],
  ],
  season: [
    ['auto', 'Season: the calendar'],
    ['spring', 'Spring'],
    ['summer', 'Summer'],
    ['autumn', 'Autumn'],
    ['winter', 'Winter'],
  ],
};
/* which sections are open, kept in this browser across openings and reloads (never in the save, so never in an
   export or a cloud save); a section never toggled uses its default */
const DEBUG_OPEN_KEY = 'pb-debug-open';
function debugOpenRead() {
  try {
    const o = JSON.parse(localStorage.getItem(DEBUG_OPEN_KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
function debugOpenKeep(k, open) {
  const o = debugOpenRead();
  o[k] = !!open;
  try {
    localStorage.setItem(DEBUG_OPEN_KEY, JSON.stringify(o));
  } catch {
    /* storage blocked: the menu still works, it just forgets */
  }
}
/* one section of the menu: a key (data-k), its title, what it holds, and whether it is open when never toggled;
   force opens it whatever was kept (the Battle section during a battle) */
const debugSection = (k, title, body, open = false, force = false) => {
  const kept = debugOpenRead()[k];
  /* a forced section isn't remembered as open: the toggle its open attribute fires is skipped (data-force) */
  return `<details data-k="${k}"${force ? ' data-force="1"' : ''}${force || (kept == null ? open : kept) ? ' open' : ''}><summary>${title}</summary>${body}</details>`;
};
/* a test scene's name without "Test: " and without a bracketed note naming a phase or track (the map data keeps it
   for the Studio): "props in the new style (phase 09)" is "props in the new style" here */
const debugSceneName = k =>
  (mapById(k).name || k)
    .replace(/^Test: /, '')
    .replace(/\s*\([^)]*\b(?:phase|track|Project Story)\b[^)]*\)/gi, '')
    .trim() || k;
function debugHTML() {
  const inB = !!activeBattle,
    node = saveData.trip.node,
    p = saveData.preferences || {},
    inTest = !!(uiState.bench && uiState.bench.test);
  const tests = `<div class="dbg-row"><button class="pb small" data-a="quicktest">Full test</button><button class="pb small" data-a="diagtest">Diagnostics test</button><button class="pb small" data-a="gfxtest">Graphics test</button><button class="pb small" data-a="gfxbench">Graphics cost test</button>${debugButtonHTML('bowltest', 'Bowl map test')}<button class="pb small" data-a="dbglog">Export debug log</button></div><p class="note">The full test (a few minutes) walks through every place and room, plays battles, the map and the opening, checks each for errors, then piles on more until the device can’t keep up. The diagnostics test (2 min) is a shorter run of the same. The graphics test tries each graphics setting on its own and saves a short report; the graphics cost test (10 min) measures what each one costs here. None of them changes the save.</p><p class="note">The bowl map test opens the bowl world map and checks its shaders, that every place is on it and opens its card when tapped, that the camera keeps above the rim, Home, and the frame rate on this device.</p>
  <div class="dbg-row">${debugButtonHTML('fps', debugMenu.fps ? 'Hide FPS meter' : 'Show FPS meter')}<span class="note">Screen ≈ ${frameScheduler.hz} Hz · cap ${userFps()} FPS · battle quality level ${battleStage.q.lvl} (0 is best)</span></div>
  <div class="dbg-row">${debugButtonHTML('q0', 'Force best quality')}${debugButtonHTML('qauto', 'Automatic quality')}</div>
  ${
    DATA_WARN.length
      ? `<p class="note">Game data warnings (${DATA_WARN.length}):</p><ul class="dbg-warn">${DATA_WARN.slice(0, 30)
          .map(w => `<li>${escapeHtml(w)}</li>`)
          .join('')}</ul>`
      : '<p class="note">Game data loaded with no warnings.</p>'
  }`;
  const give = `<div class="dbg-row">${debugButtonHTML('se1', '+1,000 Moneys', 'gold')}${debugButtonHTML('se10', '+10,000 Moneys', 'gold')}${debugButtonHTML('pyramids', '+10 of every pyramid', 'gold')}${debugButtonHTML('items', '+5 of every item', 'gold')}</div>
  <div class="dbg-row">${debugButtonHTML('scrap', '+50 Scrap', 'gold')}${debugButtonHTML('research', '+500 Research, +2 Crests', 'gold')}</div>`;
  const billies = `<div class="dbg-row">${debugSelectHTML('dbgSp', debugSpeciesOptions(), uiState.dbgSp || DEX_ORDER[0])}<input id="dbgLv" type="number" min="1" max="${maxLevel()}" value="${uiState.dbgLv || 10}" aria-label="Level">${debugSelectHTML('dbgCoat', [['', 'No coat'], ...Object.entries(COATS).map(([k, c]) => [k, c.name])], uiState.dbgCoat || '')}</div>
  <div class="dbg-row">${debugButtonHTML('give', 'Give it to me', 'gold')}${debugButtonHTML('enc', 'Add as encounter')}${debugButtonHTML('wild', 'Battle it now', 'red')}${debugButtonHTML('alpha', 'As an Alpha', 'red')}</div>
  <div class="dbg-row">${debugButtonHTML('heal', 'Heal everyone')}${debugButtonHTML('lv5', 'Team +5 levels', 'gold')}${debugButtonHTML('evo', 'Lead evolves now')}${debugButtonHTML('dex', 'Fill the Field Guide', 'gold')}</div>
  <div class="dbg-row">${debugButtonHTML('bots', 'Give the robot kit', 'gold')}</div><p class="note">Two robots and one of every robot part and gem. Battle Tinker Rho (under Places and test scenes) for a mixed team.</p>`;
  const battle = `<div class="dbg-row">${debugButtonHTML('win', 'Win now', 'gold')}${debugButtonHTML('lose', 'Lose now')}${debugButtonHTML('foe1', 'Foe to 1 HP')}${debugButtonHTML('catch', uiState.dbgCatch ? 'Catching works as normal' : 'Every throw catches')}</div>
  <div class="dbg-row">${[1, 2, 4].map(x => debugButtonHTML('speed' + x, `${x}× speed`, battleStage.speed === x ? 'dark' : '')).join('')}</div>`;
  const run = saveData.run
    ? `<p class="note">On a run: seed ${escapeHtml(saveData.run.seed)}, day ${saveData.run.clock}, ${saveData.run.at.phase}. “Go there” under Places and test scenes walks it a place at a time.</p><div class="dbg-row">${debugButtonHTML('runwin', 'Win the run', 'gold')}${debugButtonHTML('runlose', 'Lose the run', 'red')}</div><div class="dbg-row">${debugSelectHTML(
        'dbgRelic',
        Object.keys(PERKS).map(k => [k, PERKS[k].name]),
        uiState.dbgRelic || Object.keys(PERKS)[0] || ''
      )}${debugButtonHTML('relicgive', 'Give a Perk', 'gold')}${debugButtonHTML('relicpick', 'A mini-boss’s pick')}</div><p class="note">Perks held: ${saveData.run.perks.length} of ${RULES.run.perks.cap}${saveData.run.perks.length ? ` (${escapeHtml(saveData.run.perks.map(k => (PERKS[k] || { name: k }).name).join(', '))})` : ''}. Past the cap, the one held longest makes room.</p>`
    : `<div class="dbg-row"><input id="dbgRunSeed" maxlength="20" placeholder="Seed (empty: a new one)" aria-label="Run seed" value="${escapeHtml(uiState.dbgRunSeed || '')}"><label><input id="dbgRunShort" type="checkbox"${uiState.dbgRunShort ? ' checked' : ''}> Short (5 rows)</label><label><input id="dbgRunMountains" type="checkbox"${uiState.dbgRunMountains ? ' checked' : ''}> Mountains and ledges</label>${debugButtonHTML('runstart', 'Start a run')}</div><p class="note">From Copperleaf, as the mast does (Expedition I). Short: one mini-boss, a town before it, the boss. Mountains and ledges: every place gets mountains of 15-20 m on its north and south sides with trails up, and terraces with ledges (for measuring on a phone; the debug log has the frame times).</p>`;
  const places = `<div class="dbg-row">${debugSelectHTML(
    'dbgNode',
    LOCATIONS.map((r, i) => [i, `${i}. ${r.name}`]),
    node
  )}${debugButtonHTML('jump', 'Go there')}</div>
  <div class="dbg-row">${debugButtonHTML('fillq', 'Fill encounters here')}${debugButtonHTML('clearq', 'Clear encounters here', 'red')}</div>
  <p class="note">Small places that each show one tricky situation: stairs, ledges at the limits, bridges, water, shadows, every prop, slopes, the camera in tight spots, night lights, a dense forest, tiny and huge maps, traffic, and the light lab (light on the land, in a room, on props, in the air — the places the quick check measures the lighting in). Checks test the walking rules there (what should and shouldn't be reachable).</p>
  <div class="dbg-row">${debugSelectHTML(
    'dbgTest',
    testMaps().map(k => [k, debugSceneName(k)]),
    uiState.dbgTest || testMaps()[0] || ''
  )}${debugButtonHTML('test', 'Go there')}${debugButtonHTML('testchk', 'Run its checks')}${inTest ? debugButtonHTML('untest', 'Back to the game') : ''}</div>
  ${uiState.testRes ? `<ul class="dbg-warn">${uiState.testRes.map(r => `<li>${r.ok ? '✓' : '✗'} ${escapeHtml(r.what)}${r.ok ? '' : ` (expected ${r.reach ? 'reachable' : 'not reachable'})`}</li>`).join('')}</ul>` : ''}
  <div class="dbg-row">${debugSelectHTML(
    'dbgTr',
    Object.values(TRAINERS).map(T => [T.id, T.name]),
    ''
  )}${debugButtonHTML('trainer', 'Battle trainer', 'red')}${debugButtonHTML('trainer2', 'As a double battle', 'red')}</div>
  <div class="dbg-row">${debugSelectHTML('dbgTime', DEBUG_LOOK.time, p.time || 'real')}${debugSelectHTML(
    'dbgWeather',
    DEBUG_LOOK.weather,
    p.weather || 'auto'
  )}${debugSelectHTML('dbgSeason', DEBUG_LOOK.season, p.season || 'auto')}${debugButtonHTML('look', 'Set')}</div><p class="note">Fixes the time, weather or season everywhere until set back (they change which Billies come out).</p>`;
  const story = `<div class="dbg-row">${debugSelectHTML(
    'dbgScript',
    storyScriptIds().map(id => [id, id]),
    ''
  )}${debugButtonHTML('script', 'Play it')}</div><p class="note">The conversations written in the new script format. They play as written, flags and all; hold the dialogue box to skip. Walking and camera lines do nothing yet.</p>`;
  const ranch = `<div class="dbg-row">${debugButtonHTML('ranchhour', 'Age the ranch by an hour')}${debugButtonHTML('eggsready', 'Eggs ready now')}</div>`;
  const saveRow = `<div class="dbg-row">${debugButtonHTML('copy', 'Copy save as text')}${debugButtonHTML('export', 'Download backup')}${debugButtonHTML('wipe', 'Erase save', 'red')}</div>`;
  return `<div class="dbg">
 <input id="dbgFind" type="search" placeholder="Find a button" aria-label="Find a button" autocomplete="off" value="${escapeHtml(uiState.dbgFind || '')}">
 <p class="note">Changes apply to this save right away. Export a backup first if you might want to undo. Gold buttons give you things; red ones erase something or start a battle.</p>
 ${[
   debugSection('tests', 'Tests and performance', tests, true),
   debugSection('give', 'Give me', give),
   debugSection('billies', 'Billies', billies),
   debugSection('battle', `Battle${inB ? '' : ' (start one first)'}`, battle, false, inB),
   debugSection('run', 'Run', run),
   debugSection('places', 'Places and test scenes', places, false, inTest),
   debugSection('story', 'Story', story),
   debugSection('ranch', 'Ranch and time', ranch),
   debugSection('save', 'Save', saveRow),
 ].join('\n ')}
 </div>`;
}
/* the search box: only the buttons whose words hold what was typed stay, in their sections, opened; rows left with no
   button go, and so do the notes. A section's title matching keeps all of it. Empty: the sections as they were */
function debugFind(text) {
  const root = $('.dbg');
  if (!root) return;
  const q = String(text || '')
    .trim()
    .toLowerCase();
  const was = root.classList.contains('finding');
  root.classList.toggle('finding', !!q);
  $$('.dbg details[data-k]').forEach(d => {
    if (q && !was) d.dataset.was = d.open ? '1' : '';
    const title = !!q && d.querySelector('summary').textContent.toLowerCase().includes(q);
    let any = false;
    d.querySelectorAll('button').forEach(b => {
      const hit = !q || title || b.textContent.toLowerCase().includes(q);
      b.hidden = !hit;
      if (hit) any = true;
    });
    d.querySelectorAll('.dbg-row').forEach(r => {
      const bs = r.querySelectorAll('button');
      r.hidden = !!q && bs.length > 0 && [...bs].every(b => b.hidden);
    });
    d.querySelectorAll('.note, .dbg-warn').forEach(n => (n.hidden = !!q && !title));
    d.hidden = !!q && !any;
    if (q) d.open = any;
    else if (was && d.dataset.was != null) {
      d.open = d.dataset.was === '1';
      delete d.dataset.was;
    }
  });
  root.querySelectorAll(':scope > .note').forEach(n => (n.hidden = !!q));
}
function openDebug() {
  uiState.dbgFind = '';
  uiState.modal = null;
  uiState.mq = uiState.mq.filter(m => !m.dbg);
  modal({
    title: 'Debug menu',
    dbg: 1,
    cls: 'dbg-sheet',
    html: debugHTML(),
    btns: [{ l: 'Close', c: 'quiet', f: closeModal }],
  });
}
function refreshDebugMenu(msg) {
  if (msg) toast(msg);
  if (!activeBattle) render();
  const M = uiState.modal;
  if (M && M.dbg) {
    /* while searching, what was open before the search (debugFind keeps it in data-was) */
    const open = Object.fromEntries(
      $$('.dbg details[data-k]').map(d => [d.dataset.k, d.dataset.was != null ? d.dataset.was === '1' : d.open])
    );
    M.html = debugHTML();
    renderOverlay();
    $$('.dbg details[data-k]').forEach(d => {
      if (open[d.dataset.k] != null) d.open = open[d.dataset.k];
    });
    if (uiState.dbgFind) debugFind(uiState.dbgFind);
  }
}
function debugFps() {
  if (!debugMenu.fps) return;
  let el = $('#fpsMeter');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fpsMeter';
    document.body.appendChild(el);
  }
  const m = frameScheduler.meter;
  el.textContent = `${m.fps} fps · ${m.workAvg.toFixed(1)} ms${typeof gpuState !== 'undefined' && gpuState.gpuMs ? ' · GPU ' + gpuState.gpuMs.toFixed(1) + ' ms' : ''} · Q${battleStage.q.lvl} · ${frameScheduler.hz} Hz`;
}
function debugAction(x) {
  const v = id => {
      const e = $('#' + id);
      return e ? e.value : null;
    },
    sp = v('dbgSp'),
    lv = clamp(+v('dbgLv') || 10, 1, maxLevel()),
    money = () => plural(saveData.se, 'Money');
  /* what the button changed, said once the save is written (the cases that break) */
  let said = '';
  if (sp) {
    uiState.dbgSp = sp;
    uiState.dbgLv = lv;
    uiState.dbgCoat = v('dbgCoat') || '';
  }
  switch (x) {
    case 'fps':
      debugMenu.fps = !debugMenu.fps;
      if (!debugMenu.fps) {
        const e = $('#fpsMeter');
        if (e) e.remove();
      } else {
        if (!battleStage.on && !worldMap.on) frameTask('meter', () => frameCount(0));
        debugFps();
      }
      return refreshDebugMenu();
    case 'q0':
      battleStage.lockQ = true;
      battleStage.q.lvl = 0;
      if (activeBattle) battleStageResize();
      return refreshDebugMenu('Battle quality locked to best.');
    case 'qauto':
      battleStage.lockQ = false;
      return refreshDebugMenu('Battle quality adapts to frame time again.');
    case 'se1':
      saveData.se += 1000;
      said = `+1,000 Moneys: you have ${money()}.`;
      break;
    case 'se10':
      saveData.se += 10000;
      said = `+10,000 Moneys: you have ${money()}.`;
      break;
    case 'pyramids':
      Object.keys(PYRAMIDS).forEach(k => (saveData.pyramids[k] = (saveData.pyramids[k] || 0) + 10));
      said = `+10 of each of ${Object.keys(PYRAMIDS).length} pyramids.`;
      break;
    case 'items':
      Object.keys(ITEMS).forEach(k => (saveData.items[k] = (saveData.items[k] || 0) + 5));
      said = `+5 of each of ${Object.keys(ITEMS).length} items.`;
      break;
    case 'give': {
      const m = makeBilly(sp, lv, { coat: $('#dbgCoat').value || undefined });
      const w = addBilly(m);
      save();
      return refreshDebugMenu(`${SPECIES[sp].name} joined your ${w === 'team' ? 'team' : 'storage'}.`);
    }
    case 'enc': {
      encountersHere().push({
        id: newUid(),
        sp,
        lvl: lv,
        coat: $('#dbgCoat').value || undefined,
        no: ++saveData.serial,
      });
      said = `${SPECIES[sp].name} (level ${lv}) added to the encounters here: ${encountersHere().length} now.`;
      break;
    }
    case 'alpha': {
      if (activeBattle) return toast('Finish the current battle first.');
      const q = {
        id: newUid(),
        sp,
        lvl: lv,
        coat: $('#dbgCoat').value || undefined,
        no: ++saveData.serial,
        alpha: true,
      };
      encountersHere().push(q);
      closeModal();
      startWild(q);
      return;
    }
    case 'wild': {
      if (activeBattle) return toast('Finish the current battle first.');
      const q = { id: newUid(), sp, lvl: lv, coat: $('#dbgCoat').value || undefined, no: ++saveData.serial };
      encountersHere().push(q);
      closeModal();
      startWild(q);
      return;
    }
    case 'heal':
      healAll();
      said = `Healed: ${saveData.team.length} on your team.`;
      break;
    case 'look': {
      saveData.preferences = saveData.preferences || {};
      const L = { time: v('dbgTime'), weather: v('dbgWeather'), season: v('dbgSeason') };
      Object.entries(L).forEach(([k, val]) => {
        if (val) saveData.preferences[k] = val;
      });
      applyPreferences();
      if (typeof pixelSky !== 'undefined') pixelSky.dark = null;
      save();
      return refreshDebugMenu(`Time ${L.time}, weather ${L.weather}, season ${L.season}.`);
    }
    case 'bowltest':
      closeModal();
      runBowlMapTest();
      return;
    case 'bots':
      giveRobotKit();
      save();
      return refreshDebugMenu(
        'Two robots joined you, with a spare of every part. Refit them in the Workshop on the Team screen.'
      );
    case 'lv5':
      saveData.team.forEach(m => {
        const t = Math.min(maxLevel(), m.lvl + 5);
        gainXp(m, xpFor(t) - m.xp, () => {});
      });
      said = saveData.team.length
        ? `Team +5 levels: now ${saveData.team.map(m => m.lvl).join(', ')}.`
        : 'No team to level up.';
      break;
    case 'evo': {
      const m = saveData.team[0];
      if (!m || !speciesOf(m).next) return toast('Your lead doesn’t evolve.');
      closeModal();
      runEvolution(m, 'Debug menu. Nobody saw anything.');
      return;
    }
    case 'dex':
      DEX_ORDER.forEach(id => {
        saveData.seen[id] = 1;
        saveData.caught[id] = 1;
      });
      said = `Field Guide filled: ${DEX_ORDER.length} Billies seen and caught.`;
      break;
    case 'trainer2': {
      const id = v('dbgTr');
      if (activeBattle) return toast('Finish the current battle first.');
      closeModal();
      startTrainer(id, { double: true });
      return;
    }
    case 'script': {
      if (activeBattle) return toast('Finish the current battle first.');
      closeModal();
      playStoryScript(v('dbgScript'));
      return;
    }
    case 'trainer': {
      const id = v('dbgTr');
      if (activeBattle) return toast('Finish the current battle first.');
      closeModal();
      startTrainer(id);
      return;
    }
    case 'test': {
      const id = v('dbgTest');
      if (!id || !mapById(id)) return refreshDebugMenu('Pick a test scene first.');
      uiState.dbgTest = id;
      uiState.testRes = null;
      uiState.bench = { id, test: 1 };
      uiState.tab = 'walk';
      closeModal();
      render();
      toast((mapById(id).name || id) + '. Open the debug menu to leave.');
      return;
    }
    case 'untest': {
      uiState.bench = null;
      uiState.testRes = null;
      closeModal();
      render();
      return;
    }
    case 'testchk': {
      const id = v('dbgTest') || uiState.dbgTest;
      uiState.dbgTest = id;
      uiState.testRes = testMapChecks(id);
      said = `${(mapById(id) && mapById(id).name) || id}: ${uiState.testRes.filter(r => r.ok).length} of ${uiState.testRes.length} checks passed.`;
      break;
    }
    case 'jump': {
      const n = clamp(+v('dbgNode'), 0, LOCATIONS.length - 1);
      /* RL-8: on a run, walked there as you would (a day a place, the path, what the map shows) */
      if (saveData.run) {
        said = runJump(n) ? `Walked to ${LOCATIONS[n].name}.` : 'That place can’t be walked to on this run.';
        saveData.mapSeen = null;
        break;
      }
      saveData.trip = { node: n, plan: [] };
      saveData.visited[n] = 1;
      saveData.mapSeen = null;
      said = `Moved to ${LOCATIONS[n].name}.`;
      break;
    }
    /* RL-8: runs */
    case 'runstart': {
      const sd = (v('dbgRunSeed') || '')
          .trim()
          .replace(/[^A-Za-z0-9_-]/g, '')
          .slice(0, 20),
        short = !!($('#dbgRunShort') || {}).checked,
        mountains = !!($('#dbgRunMountains') || {}).checked;
      uiState.dbgRunSeed = sd;
      uiState.dbgRunShort = short;
      uiState.dbgRunMountains = mountains;
      if (!runStartable())
        return refreshDebugMenu('A run can’t start now (on a run, in a battle, or no Billie can fight).');
      uiState.modal = null;
      runTakeOff(
        sd || undefined,
        short ? { rows: 5, minibosses: 1 } : undefined,
        mountains ? [RUN_MOD_MOUNTAINS] : undefined
      );
      return;
    }
    /* RL-12: a Perk for nothing (past the cap, in the place of the one held longest), and a mini-boss's pick */
    case 'relicgive': {
      const run = saveData.run,
        id = v('dbgRelic');
      uiState.dbgRelic = id;
      if (!run) return refreshDebugMenu('No run.');
      const why = perkTake(
        run,
        id,
        PERKS,
        RULES.run.perks,
        run.perks.length >= RULES.run.perks.cap ? run.perks[0] : undefined
      );
      if (why) return refreshDebugMenu(why === 'held' ? 'Already held.' : 'That Perk can’t be given.');
      saveNow();
      return refreshDebugMenu(`${PERKS[id].name}: held.`);
    }
    case 'relicpick':
      if (!saveData.run || activeBattle) return refreshDebugMenu('No run, or a battle is on.');
      if (!perkOfferMake(saveData.run, PERKS, RULES.run.perks)) return refreshDebugMenu('Every Perk is held.');
      saveNow();
      uiState.modal = null;
      perkPickOpen();
      return;
    case 'runwin':
    case 'runlose':
      if (!saveData.run || activeBattle) return refreshDebugMenu('No run, or a battle is on.');
      uiState.modal = null;
      runOver(x === 'runwin');
      return;
    case 'fillq': {
      /* a town without wild Billies gets a route's worth, so there is always something to test with */
      const q = encountersHere();
      while (q.length < Math.max(encounterStock(saveData.trip.node), RULES.encounters.route)) spawn();
      said = `${q.length} encounters here.`;
      break;
    }
    case 'clearq':
      encountersHere().length = 0;
      said = 'Encounters here cleared.';
      break;
    /* RL-9: the ranch's trainees started an hour earlier (an hour's training, collected when the ranch opens), and
       Scrap to train with; RL-10b: an hour more of income */
    case 'ranchhour':
      saveData.ranch.trainees.forEach(t => {
        t.at = Math.max(0, t.at - 3600000);
      });
      /* RL-10b: and its income counted an hour earlier */
      if (saveData.ranch.income.lastAt)
        saveData.ranch.income.lastAt = Math.max(1, saveData.ranch.income.lastAt - 3600000);
      said = `${saveData.ranch.trainees.length} in training and the income: an hour older.`;
      break;
    /* RL-10: every egg in the ranch's nursery ready to hatch now */
    case 'eggsready':
      saveData.ranch.nursery.forEach(n => {
        n.ready = Math.max(n.at, Math.min(n.ready, ranchNow(saveData, Date.now(), RULES.ranch).now));
      });
      said = `${saveData.ranch.nursery.length} egg(s) ready to hatch at the ranch.`;
      break;
    case 'scrap':
      saveData.meta.scrap += 50;
      said = `+50 Scrap: you have ${saveData.meta.scrap}.`;
      break;
    /* RL-11: Research and Crests to try the Lab's board and the airship's upgrades with */
    case 'research':
      saveData.meta.research += 500;
      saveData.meta.crests += 2;
      said = `+500 Research, +2 Crests: you have ${saveData.meta.research} and ${saveData.meta.crests}.`;
      break;
    case 'win':
      if (!activeBattle || activeBattle.phase === 'playing' || activeBattle.over)
        return toast('Wait for your turn in a battle.');
      closeModal();
      activeBattle.events = [];
      for (let g = 0; g < 12 && !activeBattle.over; g++) {
        fighter(1).hp = 0;
        checkFaints();
      }
      playTurnEvents();
      return;
    case 'lose':
      if (!activeBattle || activeBattle.phase === 'playing' || activeBattle.over)
        return toast('Wait for your turn in a battle.');
      closeModal();
      activeBattle.events = [];
      saveData.team.forEach(m => (m.hp = 0));
      battleSay('Your team fainted. (Debug.)');
      activeBattle.over = 'lose';
      playTurnEvents();
      return;
    case 'foe1':
      if (!activeBattle) return toast('Start a battle first.');
      fighter(1).hp = 1;
      paintBoxes(allSnapshots(), activeBattle.market);
      said = 'The foe is at 1 HP.';
      break;
    case 'catch':
      uiState.dbgCatch = !uiState.dbgCatch;
      return refreshDebugMenu(
        uiState.dbgCatch ? 'Every throw catches until you turn it off.' : 'Catching is back to normal.'
      );
    case 'speed1':
    case 'speed2':
    case 'speed4':
      battleStage.speed = +x.slice(5);
      uiState.dbgSpeed = battleStage.speed !== 1;
      return refreshDebugMenu(`Battle speed ${battleStage.speed}×.`);
    case 'copy':
      navigator.clipboard &&
        navigator.clipboard.writeText(JSON.stringify(saveData)).then(
          () => toast('Save copied.'),
          () => toast('The browser blocked the clipboard.')
        );
      return;
    case 'export':
      exportSave();
      return;
    case 'wipe':
      uiState.modal = null;
      settingsReset();
      return;
  }
  save();
  refreshDebugMenu(said);
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  if (el.dataset.a === 'dbg') debugAction(el.dataset.x);
  else if (el.dataset.a === 'debug') openDebug();
});
/* a section opened or closed by hand is remembered (toggle doesn't bubble: caught on the way down) */
document.addEventListener(
  'toggle',
  ev => {
    const d = ev.target;
    if (
      d instanceof HTMLDetailsElement &&
      d.dataset.k &&
      !d.dataset.force &&
      d.closest('.dbg') &&
      !d.closest('.dbg.finding')
    )
      debugOpenKeep(d.dataset.k, d.open);
  },
  true
);
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!(el instanceof HTMLInputElement) || el.id !== 'dbgFind') return;
  uiState.dbgFind = el.value;
  debugFind(el.value);
});
document.addEventListener('keydown', ev => {
  if (ev.ctrlKey && ev.shiftKey && (ev.key === 'D' || ev.key === 'd')) {
    ev.preventDefault();
    if (uiState.modal && uiState.modal.dbg) closeModal();
    else openDebug();
  }
});
if (debugMenu.on)
  addEventListener('load', () => {
    const b = document.createElement('button');
    b.className = 'dbg-fab';
    b.dataset.a = 'debug';
    b.setAttribute('aria-label', 'Debug menu');
    b.innerHTML = uiIconHTML('bug', 20);
    document.body.appendChild(b);
  });
