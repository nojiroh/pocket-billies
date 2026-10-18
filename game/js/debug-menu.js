'use strict';
/* ================= DEBUG MENU =================
   Open it from Settings, with Ctrl+Shift+D, or by adding ?debug to the address.
   Everything here edits the current save directly; use Export first if you want a way back. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  closeModal,
  modal,
  provide,
  render,
  renderOverlay,
  runEvolution,
  testMapChecks,
  testMaps,
  toast,
} from './hooks.js';
import { $, $$, clamp } from './util.js';
import {
  COINS,
  DATA_WARN,
  DEX_ORDER,
  EGGS,
  EGG_TIERS,
  ITEMS,
  LOCATIONS,
  RULES,
  SPECIES,
  TRAINERS,
} from './game-data.js';
import {
  activeBattle,
  addBilly,
  addEgg,
  addSteps,
  escapeHtml,
  flushSave,
  gainXp,
  healAll,
  makeBilly,
  maxLevel,
  newSaveKeepingPreferences,
  newUid,
  save,
  saveData,
  setActiveBattle,
  setSaveData,
  spawn,
  today,
  uiState,
  writeStoredSave,
  xpFor,
} from './game-state.js';
import { FRAME, frameCount, frameTask, userFps } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { applyPreferences, exportSave } from './settings-screen.js';
import { battleStage, battleStageResize, battleStageStop } from './battle-stage.js';
import { mapById } from './walk-view.js';
import { gpuState } from './engine/webgl.js';
import {
  allSnapshots,
  battleSay,
  checkFaints,
  fighter,
  paintBoxes,
  play,
  startTrainer,
  startWild,
  stopTimers,
} from './battle.js';
import { worldMap } from './world-map.js';
/* eslint-disable no-func-assign */
expose({
  debugAction: [() => debugAction, v => (debugAction = v)],
  debugButtonHTML: [() => debugButtonHTML],
  debugFps: [() => debugFps, v => ((debugFps = v), provide({ debugFps }))],
  debugHTML: [() => debugHTML, v => (debugHTML = v)],
  debugMenu: [() => debugMenu],
  debugSelectHTML: [() => debugSelectHTML],
  debugSpeciesOptions: [() => debugSpeciesOptions, v => (debugSpeciesOptions = v)],
  openDebug: [() => openDebug, v => (openDebug = v)],
  refreshDebugMenu: [() => refreshDebugMenu, v => (refreshDebugMenu = v)],
  settingsReset: [() => settingsReset, v => (settingsReset = v)],
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
function debugHTML() {
  const inB = !!activeBattle,
    node = saveData.route.node;
  return `<div class="dbg">
 <p class="note">Changes apply to this save right away. Export a backup first if you might want to undo.</p>
 <details open><summary>Performance</summary><div class="dbg-row">${debugButtonHTML('fps', debugMenu.fps ? 'Hide FPS meter' : 'Show FPS meter')}<span class="note">Screen ≈ ${FRAME.hz} Hz · cap ${userFps()} FPS · battle quality level ${battleStage.q.lvl} (0 is best)</span><button class="pb small" data-a="quicktest">Full test</button><button class="pb small" data-a="dbglog">Export debug log</button></div>
  <div class="dbg-row">${debugButtonHTML('q0', 'Force best quality')}${debugButtonHTML('qauto', 'Automatic quality')}</div>
  ${
    DATA_WARN.length
      ? `<p class="note">Game data warnings (${DATA_WARN.length}):</p><ul class="dbg-warn">${DATA_WARN.slice(0, 30)
          .map(w => `<li>${escapeHtml(w)}</li>`)
          .join('')}</ul>`
      : '<p class="note">Game data loaded with no warnings.</p>'
  }</details>
 <details><summary>Wallet and steps</summary><div class="dbg-row">${debugButtonHTML('se1', '+$1,000')}${debugButtonHTML('se10', '+$10,000')}${debugButtonHTML('st1', '+1,000 steps')}${debugButtonHTML('st10', '+10,000 steps')}</div>
  <div class="dbg-row">${debugButtonHTML('coins', '+10 of every coin')}${debugButtonHTML('items', '+5 of every item')}${debugButtonHTML('newday', 'Start a new day')}</div></details>
 <details><summary>Billies</summary><div class="dbg-row">${debugSelectHTML('dbgSp', debugSpeciesOptions(), uiState.dbgSp || DEX_ORDER[0])}<input id="dbgLv" type="number" min="1" max="${maxLevel()}" value="${uiState.dbgLv || 10}" aria-label="Level"><label class="dbg-ck"><input id="dbgGold" type="checkbox"> Golden</label></div>
  <div class="dbg-row">${debugButtonHTML('give', 'Give it to me', 'gold')}${debugButtonHTML('enc', 'Add as encounter')}${debugButtonHTML('wild', 'Battle it now', 'red')}${debugButtonHTML('alpha', 'As an Alpha', 'red')}</div>
  <div class="dbg-row">${debugButtonHTML('heal', 'Heal everyone')}${debugButtonHTML('lv5', 'Team +5 levels')}${debugButtonHTML('evo', 'Lead evolves now')}${debugButtonHTML('dex', 'Fill the Field Guide')}</div></details>
 <details><summary>Trainers and world</summary><div class="dbg-row">${debugSelectHTML(
   'dbgTr',
   Object.values(TRAINERS).map(T => [T.id, T.name]),
   ''
 )}${debugButtonHTML('trainer', 'Battle trainer', 'red')}${debugButtonHTML('trainer2', 'As a double battle', 'red')}</div>
  <div class="dbg-row">${debugSelectHTML(
    'dbgNode',
    LOCATIONS.map((r, i) => [i, `${i}. ${r.name}`]),
    node
  )}${debugButtonHTML('jump', 'Go there')}</div>
  <div class="dbg-row">${debugButtonHTML('seats', 'Earn every badge')}${debugButtonHTML('flags', 'Reset trainer wins')}${debugButtonHTML('fillq', 'Fill encounter queue')}${debugButtonHTML('clearq', 'Clear queue')}</div></details>
 <details ${uiState.bench && uiState.bench.test ? 'open' : ''}><summary>Test scenes</summary><p class="note">Small places that each show one tricky situation: stairs, ledges at the limits, bridges, water, shadows, every prop, slopes, the camera in tight spots, night lights, a dense forest, tiny and huge maps, traffic, and the light lab (v44: light on the land, in a room, on props, in the air — the places the quick check measures the lighting in). Checks test the walking rules there (what should and shouldn't be reachable).</p>
  <div class="dbg-row">${debugSelectHTML(
    'dbgTest',
    testMaps().map(k => [k, (mapById(k).name || k).replace(/^Test: /, '')]),
    uiState.dbgTest || testMaps()[0] || ''
  )}${debugButtonHTML('test', 'Go there')}${debugButtonHTML('testchk', 'Run its checks')}${uiState.bench && uiState.bench.test ? debugButtonHTML('untest', 'Back to the game', 'gold') : ''}</div>
  ${uiState.testRes ? `<ul class="dbg-warn">${uiState.testRes.map(r => `<li>${r.ok ? '✓' : '✗'} ${escapeHtml(r.what)}${r.ok ? '' : ` (expected ${r.reach ? 'reachable' : 'not reachable'})`}</li>`).join('')}</ul>` : ''}</details>
 <details><summary>Eggs and jobs</summary><div class="dbg-row">${debugSelectHTML(
   'dbgEgg',
   EGG_TIERS.map(t => [t, t + ' km']),
   EGG_TIERS[0]
 )}${debugButtonHTML('egg', 'Add egg')}${debugButtonHTML('hatch', 'Finish all incubators')}${debugButtonHTML('pay', 'Pay all jobs')}</div>
  <div class="dbg-row">${debugButtonHTML('idle', 'Age storage by a day')}${debugButtonHTML('streak', 'Lead +3 win streak')}</div></details>
 <details ${inB ? 'open' : ''}><summary>Battle${inB ? '' : ' (start one first)'}</summary><div class="dbg-row">${debugButtonHTML('win', 'Win now', 'gold')}${debugButtonHTML('lose', 'Lose now')}${debugButtonHTML('foe1', 'Foe to 1 HP')}${debugButtonHTML('catch', uiState.dbgCatch ? 'Taxing works as normal' : 'Every throw taxes')}</div>
  <div class="dbg-row">${[1, 2, 4].map(x => debugButtonHTML('speed' + x, `${x}× speed`, battleStage.speed === x ? 'dark' : '')).join('')}</div></details>
 <details><summary>Save</summary><div class="dbg-row">${debugButtonHTML('copy', 'Copy save as text')}${debugButtonHTML('export', 'Download backup')}${debugButtonHTML('wipe', 'Erase save', 'red')}</div></details>
 </div>`;
}
function openDebug() {
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
    const open = $$('.dbg details').map(d => d.open);
    M.html = debugHTML();
    renderOverlay();
    $$('.dbg details').forEach((d, i) => {
      if (open[i] != null) d.open = open[i];
    });
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
  const m = FRAME.meter;
  el.textContent = `${m.fps} fps · ${m.workAvg.toFixed(1)} ms${typeof gpuState !== 'undefined' && gpuState.gpuMs ? ' · GPU ' + gpuState.gpuMs.toFixed(1) + ' ms' : ''} · Q${battleStage.q.lvl} · ${FRAME.hz} Hz`;
}
function debugAction(x) {
  const v = id => {
      const e = $('#' + id);
      return e ? e.value : null;
    },
    sp = v('dbgSp'),
    lv = clamp(+v('dbgLv') || 10, 1, maxLevel());
  if (sp) {
    uiState.dbgSp = sp;
    uiState.dbgLv = lv;
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
      break;
    case 'se10':
      saveData.se += 10000;
      break;
    case 'st1':
      addSteps(1000, true);
      return refreshDebugMenu();
    case 'st10':
      addSteps(10000, true);
      return refreshDebugMenu();
    case 'coins':
      Object.keys(COINS).forEach(k => (saveData.coins[k] = (saveData.coins[k] || 0) + 10));
      break;
    case 'items':
      Object.keys(ITEMS).forEach(k => (saveData.items[k] = (saveData.items[k] || 0) + 5));
      break;
    case 'newday':
      saveData.day = { date: today(), steps: 0 };
      break;
    case 'give': {
      const m = makeBilly(sp, lv, { gold: $('#dbgGold').checked });
      const w = addBilly(m);
      save();
      return refreshDebugMenu(`${SPECIES[sp].name} joined your ${w === 'team' ? 'team' : 'storage'}.`);
    }
    case 'enc': {
      saveData.queue.push({ id: newUid(), sp, lvl: lv, gold: $('#dbgGold').checked, no: ++saveData.serial });
      break;
    }
    case 'alpha': {
      if (activeBattle) return toast('Finish the current battle first.');
      const q = { id: newUid(), sp, lvl: lv, gold: $('#dbgGold').checked, no: ++saveData.serial, alpha: true };
      saveData.queue.push(q);
      closeModal();
      startWild(q);
      return;
    }
    case 'wild': {
      if (activeBattle) return toast('Finish the current battle first.');
      const q = { id: newUid(), sp, lvl: lv, gold: $('#dbgGold').checked, no: ++saveData.serial };
      saveData.queue.push(q);
      closeModal();
      startWild(q);
      return;
    }
    case 'heal':
      healAll();
      break;
    case 'lv5':
      saveData.team.forEach(m => {
        const t = Math.min(maxLevel(), m.lvl + 5);
        gainXp(m, xpFor(t) - m.xp, () => {});
      });
      break;
    case 'evo': {
      const m = saveData.team[0];
      if (!m || !SPECIES[m.sp].next) return toast('Your lead doesn’t evolve.');
      closeModal();
      runEvolution(m, 'Debug menu. Nobody saw anything.');
      return;
    }
    case 'dex':
      DEX_ORDER.forEach(id => {
        saveData.seen[id] = 1;
        saveData.caught[id] = 1;
      });
      break;
    case 'trainer2': {
      const id = v('dbgTr');
      if (activeBattle) return toast('Finish the current battle first.');
      closeModal();
      startTrainer(id, { double: true });
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
      if (!id || !mapById(id)) break;
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
      break;
    }
    case 'jump': {
      const n = clamp(+v('dbgNode'), 0, LOCATIONS.length - 1);
      saveData.route = { node: n, prog: 0, plan: [], hold: false };
      saveData.visited[n] = 1;
      saveData.mapSeen = null;
      break;
    }
    case 'seats':
      Object.values(TRAINERS).forEach(T => {
        if (T.seat && !saveData.seats.includes(T.seat.id)) saveData.seats.push(T.seat.id);
        saveData.flags[T.id] = 1;
      });
      break;
    case 'flags':
      saveData.flags = {};
      saveData.seats = [];
      break;
    case 'fillq':
      while (saveData.queue.length < RULES.steps.maxEncounters) spawn();
      break;
    case 'clearq':
      saveData.queue = [];
      break;
    case 'egg':
      addEgg(+v('dbgEgg'));
      break;
    case 'hatch':
      saveData.eggs.forEach(e => {
        if (e.slot != null) e.prog = EGGS[e.tier].need;
      });
      break;
    case 'pay':
      saveData.jobs.forEach(j => {
        if (j.uid) j.pend = Math.max(j.pend, 3);
      });
      break;
    case 'idle':
      saveData.box.forEach(m => {
        if (m.boxedAt) m.boxedAt -= 864e5;
      });
      break;
    case 'streak':
      if (saveData.team[0]) saveData.team[0].streak = (saveData.team[0].streak || 0) + 3;
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
      play();
      return;
    case 'lose':
      if (!activeBattle || activeBattle.phase === 'playing' || activeBattle.over)
        return toast('Wait for your turn in a battle.');
      closeModal();
      activeBattle.events = [];
      saveData.team.forEach(m => (m.hp = 0));
      battleSay('Your team fainted. (Debug.)');
      activeBattle.over = 'lose';
      play();
      return;
    case 'foe1':
      if (!activeBattle) return;
      fighter(1).hp = 1;
      paintBoxes(allSnapshots(), activeBattle.market);
      break;
    case 'catch':
      uiState.dbgCatch = !uiState.dbgCatch;
      return refreshDebugMenu(
        uiState.dbgCatch ? 'Every throw taxes until you turn it off.' : 'Taxing is back to normal.'
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
  refreshDebugMenu('Done.');
}
function settingsReset() {
  modal({
    title: 'Start over?',
    html: '<p>This erases your team, Field Guide and money.</p>',
    btns: [
      {
        l: 'Erase and start over',
        c: 'red',
        f: () => {
          if (activeBattle) {
            stopTimers();
            setActiveBattle(null);
            battleStageStop();
          }
          setSaveData(newSaveKeepingPreferences());
          saveData.savedAt = Date.now();
          writeStoredSave(saveData);
          flushSave();
          uiState.intro = 0;
          uiState.pg = null;
          uiState.avatarDraft = null;
          uiState.trainerDraft = null;
          uiState.tab = 'walk';
          applyPreferences();
          closeModal();
          render();
        },
      },
      { l: 'Keep my progress', c: 'quiet', f: closeModal },
    ],
  });
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  if (el.dataset.a === 'dbg') debugAction(el.dataset.x);
  else if (el.dataset.a === 'debug') openDebug();
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
