'use strict';
/* ================= FULL TEST =================
   Settings → Run the full test (and the debug menu) plays through everything that draws, for several minutes:
   the hub and every room the game's doors open (walking, turning and zooming the camera), night, weather and seasons,
   a run's road, its airship, nodes and payout, the ranch and the Lab, a room that opens in place, the light lab, a
   battle on the 3D stage (double and Alpha too), the opening's fall, Billies in the world, the world map, then a
   stress test that keeps adding load (crowds, particles, extra props, maximum quality) and measures how far the device
   keeps up. Your save is not changed: saving is paused and everything is put back
   afterwards. The results go into the debug log. If the app goes to the background (the screen locks), the test waits
   for you and runs that step again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import {
  EVENTS,
  FIELD_MOVES,
  ITEMS,
  LOCATIONS,
  MOVES,
  PERKS,
  QUESTS,
  RULES,
  SET_PIECES,
  SHOPS,
  SPECIES,
  START_NODE,
  TRAINERS,
  UNLOCK_DATA,
  gameData,
  trainersAt,
} from './game-data.js';
import { canEnter, encounterStock, encountersHere, gateText, makeBilly, maxHp, plural, spawn } from './logic/rules.js';
import { modBossHp, modFoeLevels, modsMake } from './logic/modifiers.js';
import { ranchNow } from './logic/ranch-clock.js';
import { ranchLevel, ranchSlots, ranchTrainStart } from './logic/ranch.js';
import { incomeRate } from './logic/ranch-income.js';
import { pastureBillies, pastureIn, pastureZone } from './logic/pasture.js';
import { runRestore, validRun } from './logic/run-state.js';
import { RUN_SIDE_MOD, runSideOpen } from './logic/run-side.js';
import { runArrive, runNext, runWorldNode } from './logic/run-map.js';
import { MAPGEN_HUB_BUILDINGS } from './logic/mapgen.js';
import { wildHabitat } from './logic/wild-pool.js';
import { runScenesMake, runWorldTables } from './logic/run-scenes.js';
import { runClinic, runFoes, runHealCost, runShopOpen, runWareHeals } from './logic/run-loop.js';
import { perkOfferMake } from './logic/perks.js';
import { eventAt } from './logic/encounters.js';
import { routeRareSpots, routeTrainersPlace, runRouteTrainers } from './logic/route-trainers.js';
import { fighter, liveActors, startTrainer, startWild } from './logic/battle-engine.js';
import { questOffer, questTake } from './logic/run-quests.js';
import { runUnlocks } from './logic/unlocks.js';
import { runStartOn, runStartPlan } from './logic/run-start.js';
import { loadAllMaps } from './map-files.js';
import {
  activeBattle,
  escapeHtml,
  pauseSaving,
  resumeSaving,
  save,
  saveData,
  saveHeld,
  setActiveBattle,
  setSave,
  setSaveData,
  uiState,
} from './game-state.js';
import { gpuCountBegin, gpuCountEnd } from './engine/gpu-counters.js';
import { frameScheduler, userFps } from './frame-scheduler.js';
import { PERSON_ART_CACHE } from './person-art.js';
import { closeDressingRoom, dressingRoom } from './dressing-room.js';
import { battleStage, battleStageStop } from './battle-stage.js';
import {
  GROUND_CACHE,
  PROP_CLOCK,
  actionSpot,
  climbEnds,
  findPath,
  mapBridges,
  mapById,
  mapHub,
  navCellAt,
  navGrid,
  propShown,
  stepGrid,
  stopWalkView,
  walkData,
  walkTo,
  walkView,
} from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { attributeClashes, frameBlockCheck, gpuState } from './engine/webgl.js';
import { POST_EFFECT_SHADERS } from './engine/post-effects.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { standingHeightAt } from './walk/heights.js';
import { WALK_SHADERS } from './walk/walk-shaders.js';
import { roomDimming } from './walk/lighting.js';
import { BUILDING_SHADERS, buildingState } from './buildings.js';
import { hasStructures, structureState } from './structures.js';
import { SOLID_PROP_SHADERS, solidPropState } from './solid-props.js';
import { propModelShaders, propModelState } from './prop-models.js';
import { buddyTap, companionSpecies, worldBillies } from './world-billies.js';
import { seamlessRoomMap, seamlessWorld } from './seamless-world.js';
import { endBattle, pickMove, pickTarget, stopTimers, tapMessage } from './battle.js';
import { WORLD_BOWL_SHADERS, worldBowl, worldBowlReset, worldMap, worldMapReset } from './world-bowl.js';
import { openShop } from './shop.js';
import { talkBox, talkHide } from './talk.js';
import { cutscene, cutsceneTeardown } from './cutscene/director.js';
import { fallOverWorldMap, fallWorldMapCanvas } from './opening-fall.js';
import { airshipFlight } from './airship.js';
import { runWorld, runWorldData, runWorldSync } from './run-world.js';
import { runLoad } from './run-loading.js';
import { runClinicEach, runJump, runTakeOff } from './run.js';
import { fieldWayOutGo } from './field-moves.js';
import { perkPickOpen } from './perk-screen.js';
import { encounterOpen } from './encounter-screen.js';
import { questData } from './quest-board.js';
import { ranchOpen } from './ranch-screen.js';
import { labBuy, labMilestones, renderLabBoard } from './lab-board.js';
import { storyPickTree } from './story-stage.js';
import { closeModal, modal, renderOverlay, toast } from './overlay.js';
import { renderWorldMapTab } from './map-tab.js';
import { clinicHeal } from './walk-tab.js';
import { leaveRoom, mapIdAt, walkCross, walkPick, walkState } from './walk-control.js';
import { render } from './ui.js';
/* eslint-disable no-func-assign */
expose({
  DIAGNOSTICS_PASSES: [() => DIAGNOSTICS_PASSES],
  diagnosticsMaps: [() => diagnosticsMaps, v => (diagnosticsMaps = v)],
  diagnosticsReport: [() => diagnosticsReport, v => (diagnosticsReport = v)],
  diagnosticsSummary: [() => diagnosticsSummary, v => (diagnosticsSummary = v)],
  diagnosticsTimersOff: [() => diagnosticsTimersOff, v => (diagnosticsTimersOff = v)],
  diagnosticsTimersOn: [() => diagnosticsTimersOn, v => (diagnosticsTimersOn = v)],
  emptyDiagnosticsReport: [() => emptyDiagnosticsReport],
  exportDiagnosticsReport: [() => exportDiagnosticsReport, v => (exportDiagnosticsReport = v)],
  runDiagnostics: [() => runDiagnostics, v => ((runDiagnostics = v), provide({ runDiagnostics }))],
  runFullTest: [() => runFullTest, v => ((runFullTest = v), provide({ runFullTest }))],
  selfTest: [() => selfTest],
  selfTestFrameStats: [() => selfTestFrameStats, v => (selfTestFrameStats = v)],
  selfTestSleep: [() => selfTestSleep, v => (selfTestSleep = v)],
  selfTestWalkScenes: [() => selfTestWalkScenes, v => (selfTestWalkScenes = v)],
  shareReportFile: [() => shareReportFile, v => (shareReportFile = v)],
  testMapChecks: [() => testMapChecks, v => ((testMapChecks = v), provide({ testMapChecks }))],
  testMaps: [() => testMaps, v => ((testMaps = v), provide({ testMaps }))],
});
/* eslint-enable no-func-assign */
provide({ runDiagnostics, runFullTest, testMapChecks, testMaps });
/* to-module: end */
/* phase 13: slow stretches every wait and time limit of the test, for a machine that draws a frame or two a second
   (the checks' headless browser draws in software: selfTest.slow = 3 there); 1 on a phone or a computer */
export const selfTest = { on: false, stop: false, slow: 1 };
provide({ selfTest }); /* to-module */
export function selfTestSleep(ms) {
  return new Promise(r => setTimeout(r, ms * (selfTest.slow || 1)));
}
/* frame rate of one scheduler task between two moments of the debug log; whole: only the seconds that start after t0;
   trim: drop the task's first and last second (it starts and stops partway through them, so they read low) */
export function selfTestFrameStats(t0, t1, task, o) {
  const whole = o && o.whole,
    S = [];
  for (const s of debugLog.samples) {
    if (s.t < t0 || s.t > t1) continue;
    if (whole && s.t - (s.dt || 1000) < t0) continue;
    if (s.tasks[task]) S.push(s.tasks[task]);
  }
  if (o && o.trim && S.length >= 3) {
    S.pop();
    S.shift();
  }
  const f = S.map(v => v.fps),
    m = S.map(v => v.ms),
    slow = S.reduce((a, v) => a + v.long, 0);
  if (!f.length) return { fpsAvg: null, fpsWorst: null, cpuMs: null, slow: 0, seconds: 0 };
  const avg = a => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  return { fpsAvg: avg(f), fpsWorst: Math.min(...f), cpuMs: avg(m), slow, seconds: f.length };
}
/* v20: the test scenes, and their walking checks (from, to, reach) worked out from the scene data without drawing */
function testMaps() {
  return Object.keys(gameData.maps || {}).filter(k => gameData.maps[k].test);
}
function testMapChecks(id) {
  const sc = mapById(id);
  if (!sc) return [];
  const keep = [walkView.sc, walkView.nav, walkView.gkey],
    out = [];
  walkView.sc = sc;
  walkView.nav = null;
  walkView.gkey = 'check-' + id;
  try {
    const far = (q, p) => {
      const e = q && q[q.length - 1];
      return !q || Math.hypot(e[0] - p[0], e[1] - p[1]) > 0.9;
    };
    const hub = mapHub(sc),
      G = navGrid(),
      hc = navCellAt(hub[0], hub[1]);
    out.push({ what: 'where you arrive is open ground', reach: true, ok: hc >= 0 && !G.blk[hc] });
    for (const c of sc.checks || []) {
      /* WA-6b: a check with `surf` walks as the player with Surf on (deep water open, logic/surf.js) */
      const got = !far(findPath(c.from[0], c.from[1], c.to[0], c.to[1], { noHop: !!c.noHop, surf: !!c.surf }), c.to);
      out.push({ what: c.what, reach: c.reach, got, ok: got === !!c.reach });
    }
  } finally {
    [walkView.sc, walkView.nav, walkView.gkey] = keep;
  }
  return out;
}
async function runFullTest(mode) {
  const diag = mode === 'diag';
  if (selfTest.on) return;
  if (typeof activeBattle !== 'undefined' && activeBattle) {
    toast('Finish the battle first.');
    return;
  }
  if (!saveData.started) {
    toast('Start a game first.');
    return;
  }
  if (uiState.modal) {
    uiState.modal = null;
    uiState.mq = [];
    renderOverlay();
  }
  selfTest.on = true;
  selfTest.stop = false;
  /* held before the maps load, not after: the friends list publishes every 5 s and could write while they loaded */
  pauseSaving();
  try {
    await loadAllMaps(); /* phase 04b: every map whole before the test opens them */
  } catch (e) {
    selfTest.on = false;
    resumeSaving();
    throw e;
  }
  const keep = JSON.stringify(saveData),
    back = { tab: uiState.tab, roam: uiState.roam, node: saveData.trip.node },
    realSave = save,
    engKeep = gameData.engine ? JSON.stringify(gameData.engine) : null;
  setSave(() => {}); /* nothing the test does reaches your save; phase 13: nor the account or your friends (above) */
  const box = document.createElement('div');
  box.className = 'nw-bench px glass';
  box.innerHTML =
    '<b>' +
    (diag ? 'Diagnostics' : 'Full test') +
    '</b><span class="nb-step">Getting ready…</span><span class="nb-bar"><i></i></span><button class="pb small quiet" type="button">Stop</button>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => {
    selfTest.stop = true;
  };
  const stepEl = box.querySelector('.nb-step'),
    bar = box.querySelector('.nb-bar i');
  /* test cleanup lane C: the scenes the game reaches, from the door links (selfTestWalkScenes); not a run's scenes
     (made from its seed while its world is in; a run's road has a phase of its own) */
  const scenes = selfTestWalkScenes(),
    phases = [],
    stress = [],
    errs0 = debugLog.err.length,
    T0 = debugLog.now();
  const only0 = selfTest.only;
  if (diag) {
    diagnosticsReport = emptyDiagnosticsReport();
    scenes.splice(0, scenes.length, ...diagnosticsMaps());
    selfTest.only = [
      'Shaders',
      'Walk: ',
      /* test cleanup lane C: one generated run scene, made from its seed and walked over a seam */
      "A run's road",
      'Device',
      'Frame budget',
      'Rain and night',
      'Battle on the 3D stage',
      /* 0.1.0 alpha: the map's first open, timed (the owner finds it slow) */
      'World map',
      'Memory',
    ];
  }
  const total = diag
    ? scenes.length * 4 + 1 + 1 + 6 + 6 + 10 + 6 + 8 + 1
    : scenes.length * 4 + 1 + 5 + 8 + 6 + 5 + 8 + 8 + 6 + 6 + 10 + 8 + 8 + 1 + 40;
  let done = 0;
  const tick = s => {
    done += s;
    bar.style.width = Math.min(100, (done / total) * 100) + '%';
  };
  debugLog.bench = { step: 'start', result: null };
  debugLog.add('bench', 'full test start');
  scrollTo(0, 0);
  /* v33: every step reports what it measured, not just OK: how long it took, the frame rate, slow frames and what caused
    them, what the renderer drew, and on a problem what was on screen and the last errors */
  /* v47: the app went to the background mid-step (the screen locked, another app came up): nothing is drawn while it's
    hidden, so that step's numbers mean nothing. The test waits until you're back and runs the step again (twice more at
    most); a step that never got to run in the foreground is listed as not measured, not as a problem. */
  /* and it asks to keep the screen on while it runs, where the browser allows that (a lock lapses while hidden: asked again on return) */
  const wake = async () => {
    try {
      if (navigator.wakeLock && !document.hidden) {
        selfTest.wl = await navigator.wakeLock.request('screen');
        debugLog.add('bench', 'the screen stays on during the test');
      }
    } catch (e) {
      selfTest.wl = null;
    }
  };
  let hid = 0;
  const onVis = () => {
    if (document.hidden) {
      hid++;
      debugLog.add('bench', 'paused: the app is in the background');
    } else wake();
  };
  document.addEventListener('visibilitychange', onVis);
  wake();
  selfTest.offVis = () => {
    document.removeEventListener('visibilitychange', onVis);
    try {
      if (selfTest.wl) selfTest.wl.release();
    } catch (e) {}
    selfTest.wl = null;
  };
  const awake = async () => {
    if (!document.hidden) return;
    stepEl.textContent = 'Paused while the app is in the background';
    while (document.hidden && !selfTest.stop) await selfTestSleep(300);
    await selfTestSleep(800); /* frames start again */
  };
  /* v44b: selfTest.only=['light'] runs only the steps whose names hold one of those words (for diagnosis); phase 13:
     the stress test at the end too, as 'Stress test' */
  const wanted = name => !selfTest.only || selfTest.only.some(w => name.toLowerCase().includes(w.toLowerCase()));
  /* a step that opens a place calls measureFromHere() once it is open: the frame rate and slow frames count from there,
     and the slow frames before it are its opening hitch */
  let measureFrom = 0;
  const measureFromHere = () => {
    measureFrom = debugLog.now();
  };
  const phase = async (name, task, fn, sec, maxSec) => {
    if (selfTest.stop) return;
    if (!wanted(name)) return;
    for (let attempt = 0; ; attempt++) {
      await awake();
      if (selfTest.stop) return;
      const h0 = hid;
      measureFrom = 0;
      stepEl.textContent = name;
      debugLog.bench.step = name;
      const t0 = debugLog.now(),
        e0 = debugLog.err.length,
        w0 = performance.now(),
        mb0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
      let ok = true,
        note = '',
        why = '',
        err = null;
      /* no step may hold the test up: past its time limit it counts as a problem and the test moves on */
      const limit = (maxSec || Math.max(20, sec * 6)) * 1000 * (selfTest.slow || 1);
      let timer = null;
      try {
        const r = await Promise.race([
          fn(),
          new Promise((_, rej) => {
            timer = setTimeout(() => {
              selfTest.gen = (selfTest.gen || 0) + 1;
              /* a step left behind stops at its next check */ rej(
                new Error(`took longer than ${Math.round(limit / 1000)} s, skipped`)
              );
            }, limit);
          }),
        ]);
        if (r === false) ok = false;
        else if (typeof r === 'string') {
          note = r;
        }
      } catch (e) {
        ok = false;
        why = String((e && e.message) || e).slice(0, 240);
        note = why.slice(0, 140);
        err = e;
      } finally {
        clearTimeout(timer);
      }
      await selfTestSleep(300);
      if (hid !== h0 && attempt < 2) {
        debugLog.add('bench', name + ': the app went to the background, running the step again');
        continue;
      }
      const bg = hid !== h0; /* still interrupted after three tries: not measured */
      if (err && !bg) debugLog.error('test', name + ': ' + why, err && err.stack);
      const m0 = Math.max(t0, measureFrom),
        st = selfTestFrameStats(m0, debugLog.now(), task, measureFrom ? { whole: true } : { trim: true }),
        ne = debugLog.err.slice(e0).filter(x => x.kind !== 'test');
      if (ne.length && !bg) {
        ok = false;
        why = why || 'an error during the step: ' + ne[0].msg.slice(0, 200);
        note = note || ne[0].msg.slice(0, 140);
      }
      const D = debugLog.diag(t0),
        slow = debugLog.slow.filter(x => x.t >= m0),
        hitch = debugLog.slow.filter(x => x.t >= t0 && x.t < m0),
        openHitchMs = hitch.reduce((a, x) => Math.max(a, x.ms), 0),
        by = {};
      for (const x of slow) {
        const k = x.why.replace(/ \d+ ms.*$/, '');
        by[k] = (by[k] || 0) + 1;
      }
      const top = Object.entries(by)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k, n]) => `${k} ×${n}`)
          .join(', '),
        worst = slow.reduce((a, x) => Math.max(a, x.ms), 0);
      const detail = [
        `${((performance.now() - w0) / 1000).toFixed(1)} s`,
        st.fpsAvg != null ? `${st.fpsAvg} fps (worst ${st.fpsWorst})` : null,
        openHitchMs ? `opening hitch ${openHitchMs} ms` : null,
        slow.length
          ? `${slow.length} slow frame${slow.length > 1 ? 's' : ''} up to ${worst} ms${top ? ': ' + top : ''}`
          : 'no slow frames',
        D.drawn && D.drawn.skipped ? `${D.drawn.skipped} skipped` : null,
        mb0 && performance.memory
          ? `${Math.round((performance.memory.usedJSHeapSize - mb0) / 1048576) >= 0 ? '+' : ''}${Math.round((performance.memory.usedJSHeapSize - mb0) / 1048576)} MB`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
      if (bg) {
        ok = true;
        why = '';
        note = 'not measured: the app was in the background every time this step ran';
      } else if (attempt)
        note =
          (note ? note + ' ' : '') + `(run again: the app went to the background ${attempt === 1 ? 'once' : 'twice'})`;
      phases.push(
        Object.assign(
          {
            name,
            task,
            ok,
            note,
            detail,
            why: ok ? undefined : why || 'the check returned a problem',
            ctx: ok ? undefined : D,
            slowCauses: by,
            worstFrameMs: worst || undefined,
            openHitchMs: openHitchMs || undefined,
            openHitchCause: hitch.length
              ? hitch.reduce((a, x) => (x.ms > a.ms ? x : a)).why.replace(/ \d+ ms.*$/, '')
              : undefined,
            ms: Math.round(performance.now() - w0),
            retries: attempt || undefined,
            notMeasured: bg || undefined,
          },
          st
        )
      );
      tick(sec);
      return;
    }
  };
  /* v31: anything that pops up (a level-up, a request) is closed first: an open window holds the scene at 10 fps, which used to show up as a false 10 fps */
  const unblock = () => {
    if (uiState.modal || uiState.mq.length) {
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
    }
    if (typeof talkBox !== 'undefined' && talkBox.on && typeof talkHide === 'function') talkHide();
  };
  const walkAbout = async sec => {
    const end = performance.now() + sec * 1000;
    let k = 0;
    while (performance.now() < end && !selfTest.stop) {
      await selfTestSleep(500);
      k++;
      unblock();
      if (walkView.ready && walkView.sc) {
        const sc = walkView.sc,
          hb = mapHub(sc),
          a = k * 1.7,
          r = 3 + (k % 4);
        if (!walkView.pl.route)
          walkTo([clamp(hb[0] + Math.cos(a) * r, 1, sc.w - 1), clamp(hb[1] + Math.sin(a) * r * 0.7, 1, sc.h - 1)]);
        if (typeof walkRenderer !== 'undefined' && walkRenderer.on) {
          walkRenderer.yawT = Math.sin(k * 0.5) * 0.45;
          walkRenderer.zoomT = 1 + Math.sin(k * 0.33) * 0.3;
        }
      }
    }
  };
  try {
    /* 0. shaders: no two inputs share a location (a GPU-specific link failure that once blanked the scenes with buildings) */
    await phase(
      'Shaders',
      'dio',
      async () => {
        const all = Object.assign(
          {},
          typeof WALK_SHADERS !== 'undefined' ? WALK_SHADERS : {},
          typeof BUILDING_SHADERS !== 'undefined' ? BUILDING_SHADERS : {},
          typeof POST_EFFECT_SHADERS !== 'undefined' ? POST_EFFECT_SHADERS : {},
          typeof WORLD_BOWL_SHADERS !== 'undefined' ? WORLD_BOWL_SHADERS : {},
          typeof SOLID_PROP_SHADERS !== 'undefined' ? SOLID_PROP_SHADERS : {}
        );
        const bad = [];
        for (const [k, v] of Object.entries(all)) {
          const c = attributeClashes(v[0]);
          if (c.length) bad.push(k + ': ' + c.join(', '));
        }
        if (bad.length) throw new Error(bad.join('; '));
        /* phase 20 C3: the lit programs also build with the Frame block, laid out as it is packed */
        let fb = '';
        if (typeof gpuState !== 'undefined' && gpuState.gl) {
          const r = frameBlockCheck(
            Object.assign({}, all, typeof propModelShaders === 'function' ? propModelShaders() : {})
          );
          if (r.bad.length) throw new Error('Frame block: ' + r.bad.slice(0, 4).join('; '));
          fb = `; ${r.n} with the Frame block`;
        }
        if (typeof buildingState !== 'undefined' && buildingState.fail)
          throw new Error('3D buildings are off on this device: ' + String(buildingState.fail).slice(0, 90));
        return Object.keys(all).length + ' shaders' + fb;
      },
      1
    );
    /* alpha 0.4, the diagnostics test: the device, and how the automatic quality chose its level and resolution */
    if (diag)
      await phase(
        'Device and quality',
        'dio',
        async () => {
          const g = debugLog.glInfo ? debugLog.glInfo() : {},
            ev = (debugLog.ev || [])
              .filter(e => /quality|resolution/i.test(e.kind + ' ' + (e.msg || '')))
              .slice(-6)
              .map(e => e.msg || e.kind);
          diagnosticsReport.device = {
            device: debugLog.device ? debugLog.device() : null,
            graphics: g,
            auto: engineSetting('quality', 'auto') ?? null,
            resolution: typeof walkView !== 'undefined' ? walkView.R : null,
            level: typeof walkRenderer !== 'undefined' ? (walkRenderer.q ?? null) : null,
            screenHz: typeof frameScheduler !== 'undefined' ? frameScheduler.hz : null,
            /* the player's Settings → Frame rate (the save's own value) and the cap it gives */
            fpsSetting: (saveData && saveData.preferences && saveData.preferences.fps) ?? null,
            fpsCap: userFps(),
            why: ev,
          };
          return `${String(g.renderer || g.gpu || 'graphics unknown').slice(0, 60)} · resolution ×${diagnosticsReport.device.resolution ?? '?'} · quality level ${diagnosticsReport.device.level ?? '?'} · cap ${diagnosticsReport.device.fpsCap} FPS${ev.length ? ' · ' + ev.slice(-1)[0] : ''}`;
        },
        1
      );
    /* 1. every walk scene */
    for (const id of scenes) {
      if (selfTest.stop) break;
      await phase(
        'Walk: ' + ((mapById(id) || {}).name || id),
        'dio',
        async () => {
          const tm = performance.now();
          uiState.tab = 'walk';
          uiState.bench = { id };
          render();
          let open = null;
          for (let i = 0; i < 60 && !(walkView.ready && walkView.id === id); i++) await selfTestSleep(50);
          open = walkView.ready && walkView.id === id ? Math.round(performance.now() - tm) : null;
          await selfTestSleep(Math.max(500, 900 - (performance.now() - tm)));
          measureFromHere();
          const f0 = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
          await walkAbout(3);
          if (!walkView.ready || walkView.id !== id)
            throw new Error(
              `the scene didn’t open (still ${walkView.id || 'nothing'}${walkView.ready ? '' : ', loading'} after ${Math.round((performance.now() - tm) / 1000)} s)`
            );
          if (typeof walkRenderer !== 'undefined' && walkRenderer.on && walkRenderer.frames === f0)
            throw new Error('the scene isn’t drawing (black screen): no frames in 3 s');
          if (id === scenes[0]) debugLog.snap();
          const g = stGeometry(),
            sc = walkView.sc,
            gl = typeof walkRenderer !== 'undefined' && walkRenderer.on;
          return [
            `opened in ${open != null ? open + ' ms' : 'over 3 s'}`,
            `${(sc.props || []).length} props`,
            gl && typeof buildingState !== 'undefined' && buildingState.drawn
              ? `${buildingState.drawn} 3D buildings`
              : '',
            gl && typeof solidPropState !== 'undefined' && solidPropState.drawn
              ? `${solidPropState.drawn} solid props`
              : '',
            gl && walkRenderer.grassDrawn ? `${walkRenderer.grassDrawn} grass patches` : '',
            (walkView.folk || []).length ? `${walkView.folk.length} folk` : '',
            typeof worldBillies !== 'undefined' && worldBillies.bud ? 'buddy along' : '',
            g || '',
          ]
            .filter(Boolean)
            .join(', ');
        },
        4
      );
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
    /* alpha 0.4, diagnostics: where a frame's time goes in the busiest town (the processor's time for each pass, and the
     graphics chip's own timers where it has them), then what rain and night cost there */
    if (diag)
      await phase(
        'Frame budget: where the time goes',
        'dio',
        async () => {
          const sid = diagnosticsReport.busiest;
          uiState.bench = { id: sid };
          uiState.tab = 'walk';
          render();
          for (let i = 0; i < 80 && !(walkView.ready && walkView.id === sid); i++) await selfTestSleep(100);
          await selfTestSleep(900);
          const T = diagnosticsTimersOn();
          await walkAbout(4);
          const r = await diagnosticsTimersOff(T);
          diagnosticsReport.passes = r;
          return (
            `per frame: ` +
            Object.entries(r.cpu)
              .map(([k, v]) => `${k} ${v} ms`)
              .join(', ') +
            (r.gpu
              ? ` · graphics chip: ` +
                Object.entries(r.gpu)
                  .map(([k, v]) => `${k} ${v} ms`)
                  .join(', ')
              : ' · no graphics-chip timers here') +
            (r.calls
              ? ` · ${r.calls.dc[0]} draws (${r.calls.dc[1]} instances, ${r.calls.dc[2]} program switches, ` +
                `${r.calls.dc[4]} uniform calls): ` +
                Object.entries(r.calls.dcp)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(', ')
              : '')
          );
        },
        6
      );
    if (diag)
      await phase(
        'Rain and night: what they cost',
        'dio',
        async () => {
          const f0 = environment.force,
            on0 = environment.on;
          const meas = async force => {
            environment.on = true;
            environment.force = force;
            await selfTestSleep(1000);
            const t0 = debugLog.now();
            await walkAbout(3);
            return selfTestFrameStats(t0, debugLog.now(), 'dio');
          };
          try {
            const a = await meas({ time: 12.5, weather: 'clear', season: 'summer' }),
              b = await meas({ time: 12.5, weather: 'rain', season: 'summer' }),
              c = await meas({ time: 23, weather: 'clear', season: 'summer' });
            diagnosticsReport.weather = { clear: a, rain: b, night: c };
            return `clear day ${a.fpsAvg} fps (${a.cpuMs} ms), rain ${b.fpsAvg} fps (${b.cpuMs} ms), night ${c.fpsAvg} fps (${c.cpuMs} ms)`;
          } finally {
            environment.force = f0;
            environment.on = on0;
          }
        },
        10
      );
    function stGeometry() {
      const sc = walkView.sc;
      if (!sc || (!sc.steps && !sc.bridges)) return;
      const hub = mapHub(sc),
        C0 = walkData().sc,
        bad = [],
        far = (q, p) => {
          const end = q && q[q.length - 1];
          return !q || Math.hypot(end[0] - p[0], end[1] - p[1]) > 1.6;
        };
      for (const e of sc.exits || []) if (far(findPath(hub[0], hub[1], e[0], e[1]), e)) bad.push('an exit');
      for (const p of sc.props || [])
        if (
          p.act &&
          !(
            p.act === 'climb' &&
            typeof climbEnds === 'function' &&
            [climbEnds(p).bot, climbEnds(p).top].some(g => {
              const q = findPath(hub[0], hub[1], g[0], g[1]),
                e = q && q[q.length - 1];
              return e && Math.hypot(e[0] - g[0], e[1] - g[1]) <= 1.6;
            })
          )
        ) {
          const g = actionSpot(p, C0.props[p.k], C0.ppu || 34);
          if (g && far(findPath(hub[0], hub[1], g[0], g[1]), g)) bad.push(p.k);
        }
      for (const b of mapBridges(sc) || []) {
        const A = [b.a[0] - b.ux * 0.4, b.a[1] - b.uz * 0.4],
          Bp = b.pier ? [b.b[0] - b.ux * 0.4, b.b[1] - b.uz * 0.4] : [b.b[0] + b.ux * 0.4, b.b[1] + b.uz * 0.4];
        if (far(findPath(A[0], A[1], Bp[0], Bp[1]), Bp)) bad.push('across a bridge');
      }
      if (bad.length) throw new Error('can’t walk to: ' + [...new Set(bad)].join(', '));
      const E = stepGrid(sc),
        G = navGrid();
      let hops = 0;
      for (let q = 0; q < G.hop.length; q++) if (G.hop[q]) hops++;
      const gl = typeof walkRenderer !== 'undefined' && walkRenderer.on;
      if (
        gl &&
        typeof hasStructures === 'function' &&
        hasStructures(sc) &&
        !structureState.mesh &&
        !(typeof buildingState !== 'undefined' && buildingState.fail)
      )
        throw new Error('bridges and railings aren’t drawn');
      return (
        [
          E ? 'cliffs' : '',
          (sc.bridges || []).length ? `${sc.bridges.length} bridge${sc.bridges.length > 1 ? 's' : ''}` : '',
          hops ? 'ledges' : '',
          gl && walkRenderer.falls && walkRenderer.falls.length ? 'waterfalls' : '',
          (sc.escalators || []).length ? 'escalators' : '',
        ]
          .filter(Boolean)
          .join(', ') + ' walkable'
      );
    }
    /* 1c. v26: night, bad weather and the seasons drawn in town, and a room you walk into (RL-5: in the hub, Copperleaf; the
       dark cave, Fizzwell's, went to game/data/legacy with its place) */
    if (typeof environment !== 'undefined' && !selfTest.stop)
      await phase(
        'Night, weather, seasons and rooms',
        'dio',
        async () => {
          const sid = LOCATIONS[START_NODE].mapId,
            f0 = environment.force,
            out = [];
          try {
            uiState.tab = 'walk';
            uiState.bench = { id: sid };
            render();
            /* 0.1.0 alpha: a place's ground is built on the card before it draws (about 2 s for the hub on a phone), so
               wait for the scene to open and draw before timing the looks */
            for (let i = 0; i < 150 && !(walkView.ready && walkView.id === sid); i++) await selfTestSleep(100);
            if (!walkView.ready || walkView.id !== sid)
              throw new Error((gameData.maps[sid] ? gameData.maps[sid].name : sid) + ' didn’t open');
            if (typeof walkRenderer !== 'undefined' && walkRenderer.on) {
              const fa = walkRenderer.frames;
              for (let i = 0; i < 50 && walkRenderer.frames < fa + 2; i++) await selfTestSleep(100);
            }
            for (const [n, f] of [
              ['night', { time: 23.5, weather: 'clear' }],
              ['a storm', { time: 15, weather: 'storm' }],
              ['snow', { time: 11, weather: 'snow', season: 'winter' }],
              ['autumn', { time: 12, weather: 'clear', season: 'autumn' }],
            ]) {
              if (selfTest.stop) break;
              environment.force = f;
              const f1 = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
              await selfTestSleep(1600);
              if (typeof walkRenderer !== 'undefined' && walkRenderer.on && walkRenderer.frames <= f1)
                throw new Error(n + ': the scene stopped drawing');
              out.push(n);
            }
          } finally {
            environment.force = f0;
          }
          for (const id of ['int_shop']) {
            if (!gameData.maps[id] || selfTest.stop) continue;
            uiState.bench = { id };
            render();
            await selfTestSleep(1400);
            if (!walkView.ready || walkView.id !== id) throw new Error((gameData.maps[id].name || id) + ' didn’t open');
            out.push('a shop you walk into');
          }
          return out.join(', ');
        },
        5
      );
    /* 2. a battle on the 3D stage where you stand */
    /* v41: the wild foe is an ordinary first-stage species (the first stage-1 species used to be the legendary Oilympus since v39) */
    const foeSp =
      Object.keys(SPECIES).find(
        k => SPECIES[k].stage === 0 && SPECIES[k].rar === 'common' && !RULES.start.starters.includes(SPECIES[k].line)
      ) ||
      Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && SPECIES[k].rar !== 'mythical') ||
      Object.keys(SPECIES)[0];
    /* phase 06-3: one battle, on the 3D stage (the painted stage is gone) */
    const battle = async () => {
      uiState.bench = null;
      uiState.tab = 'walk';
      saveData.trip.node = back.node;
      render();
      await selfTestSleep(600);
      for (let i = 0; i < 40 && !(walkView.ready && walkView.id === mapIdAt(back.node)); i++) await selfTestSleep(200);
      /* v43: the stage needs the walk scene open */
      saveData.team.forEach(m => {
        m.hp = maxHp(m);
      });
      const q = { id: 'selftest', sp: foeSp, lvl: 5, no: 1 };
      encountersHere().unshift(q);
      startWild(q);
      const g0 = selfTest.gen || 0;
      const want = async (ph, ms) => {
        const end = performance.now() + ms * (selfTest.slow || 1);
        while (performance.now() < end) {
          if (!activeBattle || (selfTest.gen || 0) !== g0) return false;
          if (ph.includes(activeBattle.phase)) return true;
          if (activeBattle.phase === 'playing') tapMessage();
          await selfTestSleep(150);
        }
        return false;
      };
      const tb = performance.now();
      let ok = await want(['choose'], 45000),
        why = ok
          ? ''
          : `the battle never got to the move menu (stuck in ${activeBattle ? activeBattle.phase : 'no battle'})`;
      const gl = !!battleStage.gl,
        menuMs = Math.round(performance.now() - tb);
      if (ok) {
        /* phase 06-3: the moves show on the first menu; an older build has a Fight button first */
        const f = document.querySelector('[data-a=bfight]');
        if (f) {
          f.click();
          await selfTestSleep(200);
        }
        const m = document.querySelector('[data-a=bmove]');
        if (m) m.click();
        ok = await want(['choose', 'end', 'switch'], 45000);
        if (!ok) why = 'a move never finished playing';
      }
      stopTimers();
      setActiveBattle(null);
      battleStageStop();
      render();
      await selfTestSleep(600);
      if (ok && !gl) throw new Error('the battle never got its 3D stage');
      if (!ok) throw new Error(why);
      return `3D stage; move menu after ${(menuMs / 1000).toFixed(1)} s`;
    };
    /* v33: team battles: a trainer's double battle and an Alpha in the grass, each played for a turn with every fighter choosing */
    const teamBattle = async kind => {
      uiState.bench = null;
      uiState.tab = 'walk';
      saveData.trip.node = back.node;
      render();
      await selfTestSleep(1200);
      saveData.team.forEach(m => {
        m.hp = maxHp(m);
        m.status = null;
      });
      while (saveData.team.length < 3) saveData.team.push(makeBilly(foeSp, 6));
      if (kind === 'double') {
        const id = Object.keys(TRAINERS).find(
          k => TRAINERS[k].team.length >= 2 && !TRAINERS[k].team.some(m => String(m.sp).startsWith('@'))
        );
        if (!id) return 'no trainer with two Billies';
        startTrainer(id, { talked: true, double: true });
      } else {
        const q = { id: 'selftest-alpha', sp: foeSp, lvl: 5, no: 1, alpha: true };
        encountersHere().unshift(q);
        startWild(q);
      }
      const g0 = selfTest.gen || 0;
      const want = async (ph, ms) => {
        const end = performance.now() + ms * (selfTest.slow || 1);
        while (performance.now() < end) {
          if (!activeBattle || (selfTest.gen || 0) !== g0) return false;
          if (ph.includes(activeBattle.phase)) return true;
          if (activeBattle.phase === 'playing') tapMessage();
          await selfTestSleep(120);
        }
        return false;
      };
      const tb = performance.now();
      if (!(await want(['choose'], 45000)))
        throw new Error(`never got to the menu (${activeBattle ? activeBattle.phase : 'no battle'})`);
      const fmt = activeBattle.fmt,
        mine = liveActors(0).length,
        theirs = liveActors(1).length;
      let plates = 0;
      for (let i = 0; i < 40 && plates < mine + theirs; i++) {
        plates = document.querySelectorAll('#plates .bplate:not(.off)').length;
        if (plates < mine + theirs) await selfTestSleep(150);
      } /* a plate shows once its fighter is drawn */
      if (kind === 'double' && (fmt !== 'double' || theirs < 2))
        throw new Error(`expected 2 against 2, got ${mine} against ${theirs} (${fmt})`);
      if (kind === 'alpha' && (fmt !== 'alpha' || mine < 2 || !fighter(1).boss))
        throw new Error(`expected your team against one Alpha, got ${mine} against ${theirs} (${fmt})`);
      if (plates < mine + theirs) throw new Error(`only ${plates} of ${mine + theirs} nameplates in the scene`);
      let picks = 0,
        aimed = 0;
      while (activeBattle && activeBattle.phase === 'choose' && picks < 4) {
        const m = fighter(activeBattle.cur),
          mid = m.moves.find(id => MOVES[id] && MOVES[id].c !== 'X') || m.moves[0];
        pickMove(mid);
        picks++;
        if (activeBattle.phase === 'target') {
          aimed++;
          pickTarget(liveActors(1)[0]);
        }
        await selfTestSleep(80);
      }
      const tt = performance.now();
      if (!(await want(['choose', 'end', 'switch'], 60000)))
        throw new Error(`the turn never finished (${activeBattle ? activeBattle.phase : 'no battle'})`);
      const turnMs = Math.round(performance.now() - tt),
        lines = activeBattle.events.length;
      stopTimers();
      setActiveBattle(null);
      battleStageStop();
      render();
      await selfTestSleep(600);
      return `${mine} against ${theirs} (${fmt}); ${plates} nameplates; ${picks} picks, ${aimed} aimed; the turn played ${lines} lines in ${(turnMs / 1000).toFixed(1)} s`;
    };
    /* RL-5: the Road phase (v43, phase 08: out of Marigold Town over its edge and into Tallgrass Meadow on foot) went
       with those places to game/data/legacy: the hub has no road. RL-7: back on a run's road. A run is put on a copy
       of the save as the mast will (RL-8), so its world is made from its seed; the landing's north seam is walked over
       a step at a time as a player walks it, and you arrive at the next place a day later with its view. Then the save
       as it was, and the hub's world with it */
    if (typeof runWorldSync === 'function' && !selfTest.stop)
      await phase(
        "A run's road",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData();
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.goingIn = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            /* Studio plan T2.1: started as the mast starts a run (logic/run-start.js), a fresh save's unlocks */
            runStartOn(s, runStartPlan('SELFTESTRUN', { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            setSaveData(s);
            render();
            const landing = 'w:' + LOCATIONS[1].mapId + '*';
            for (let i = 0; i < 150 && !(walkView.ready && walkView.id === landing); i++) await selfTestSleep(100);
            if (walkView.id !== landing) throw new Error(`the run's landing isn't shown (still ${walkView.id})`);
            measureFromHere();
            /* the way to the exit ahead (west) and on past where a run's crossing counts (rules.json run.seamIn) */
            const to = runWorldNode(runNext(s.run.map, 0)[0]),
              e = (walkState().exits || []).find(x => x.to === to);
            if (!e) throw new Error(`no exit from the landing to ${LOCATIONS[to].name}`);
            const sc = walkView.sc,
              pt = sc.exits[e.i],
              ee = sc.edgeExits || ((sc.baseId && mapById(sc.baseId)) || {}).edgeExits || [],
              side = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[(ee[e.i] || {}).side] || [0, 1],
              past = RULES.run.seamIn + 6,
              R = findPath(walkView.pl.x, walkView.pl.z, pt[0] + side[0] * past, pt[1] + side[1] * past, {
                max: 1e6,
              });
            if (!R) throw new Error('no path out of the landing to its west exit');
            let crossed = false;
            for (let k = 1; k < R.length && !crossed; k++) {
              const [ax, az] = R[k - 1],
                [bx, bz] = R[k],
                n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8));
              for (let j = 1; j <= n && !crossed; j++) {
                for (let w = 0; w < 100 && !walkView.ready; w++) await selfTestSleep(50);
                walkView.pl.x = ax + ((bx - ax) * j) / n;
                walkView.pl.z = az + ((bz - az) * j) / n;
                walkView.pl.route = null;
                walkCross();
                crossed = saveData.trip.node === to;
                await selfTestSleep(30);
              }
            }
            if (!crossed) throw new Error(`walked out of the landing and never arrived at ${LOCATIONS[to].name}`);
            const next = 'w:' + LOCATIONS[to].mapId + '*';
            /* up to 60 s, as the fast check waits (software drawing takes longer than 15 s to lay the next view) */
            for (let i = 0; i < 600 && !(walkView.ready && walkView.id === next); i++) await selfTestSleep(100);
            if (walkView.id !== next) throw new Error(`arrived but the view is still ${walkView.id}`);
            if (saveData.run.clock !== 2) throw new Error(`arrived on day ${saveData.run.clock}, not 2`);
            await selfTestSleep(800);
            return `${runWorld.scenes} scenes made in ${runWorld.ms} ms; over the seam into the next place on day 2`;
          } finally {
            setSaveData(was);
            render();
          }
        },
        8,
        150
      );
    /* RL-R2: a run's side area (forced: a detour behind Cut), on a copy of the save: the obstacle stands on its place's
       north road and the seam behind it turns you back; with the Grass Badge and a Grass Billie it opens (the obstacle
       gone); the side's places are walked in a day each and its way out sets you down on the main path's next row.
       Then the save as it was */
    if (typeof runWorldSync === 'function' && typeof fieldWayOutGo === 'function' && !selfTest.stop)
      await phase(
        "A run's side area",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            view = async (/** @type {number} */ n) => {
              const id = 'w:' + LOCATIONS[n].mapId + '*';
              for (let i = 0; i < 600 && !(walkView.ready && walkView.id === id); i++) await selfTestSleep(100);
              if (walkView.id !== id) throw new Error(`${LOCATIONS[n].name} isn't shown (still ${walkView.id})`);
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            runStartOn(
              s,
              runStartPlan(
                'SELFTESTSIDE',
                { ...data, unlockData: UNLOCK_DATA },
                { unlocks: [], mods: [RUN_SIDE_MOD + 'detour_cut'] }
              )
            );
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            s.meta.badges = {};
            setSaveData(s);
            const S = s.run.map.side;
            if (!S || S.move !== 'cut') throw new Error('the forced detour behind Cut was not made');
            if (!runJump(runWorldNode(S.from))) throw new Error('couldn’t walk to the obstacle’s place');
            render();
            await view(runWorldNode(S.from));
            const ob = (walkView.sc.props || []).find(p => p.act === 'field');
            if (!ob || !propShown(ob)) throw new Error('no obstacle on the north road');
            const first = runWorldNode(S.nodes[0]);
            if (canEnter(first)) throw new Error('the side area is open before its obstacle');
            if (!/Grass Badge/.test(gateText(LOCATIONS[first])))
              throw new Error('the closed seam doesn’t name the badge');
            saveData.meta.badges.grass = 1;
            saveData.team.push(makeBilly('gates0', 10));
            if (runSideOpen(saveData.run.map) !== true) throw new Error('the obstacle didn’t open');
            await selfTestSleep(400);
            if (propShown(ob)) throw new Error('the obstacle still stands once open');
            if (!canEnter(first)) throw new Error('the seam is still closed once open');
            const day = saveData.run.clock;
            for (const i of S.nodes)
              if (!runArrive(saveData, i, data)) throw new Error(`couldn’t walk into side place ${i}`);
            uiState.roam = null;
            render();
            await view(runWorldNode(S.nodes[S.nodes.length - 1]));
            if (!(walkView.sc.props || []).some(p => p.act === 'fieldout'))
              throw new Error('no way out at the last place');
            fieldWayOutGo();
            if (saveData.trip.node !== runWorldNode(S.to))
              throw new Error('the way out didn’t lead back to the main path');
            await view(runWorldNode(S.to));
            const days = saveData.run.clock - day;
            if (days !== S.nodes.length + 1)
              throw new Error(`the side area took ${days} days, not ${S.nodes.length + 1}`);
            return `${S.name}: ${S.nodes.length} places behind Cut, opened with the Grass Badge, out on day ${saveData.run.clock}`;
          } finally {
            setSaveData(was);
            render();
          }
        },
        8,
        180
      );
    /* RL-13: an Expedition and its challenges, on a copy of the save: a run started at Expedition III has more zones
       and foes its levels up (modifiers.json), its boss's HP multiplied; with "No healing" and "No Perks" the clinic
       is shut, no run shop stocks a healing ware and no Perk is ever offered. Then the save as it was */
    if (typeof runStartPlan === 'function' && typeof modsMake === 'function' && !selfTest.stop)
      await phase(
        'A run at Expedition III, with challenges',
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            seed = 'SELFTESTEXP',
            plan = (expedition, mods) =>
              runStartPlan(seed, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [], mods, expedition });
          try {
            if (s.run) runRestore(s);
            const one = plan(1, []),
              three = plan(3, modsMake(['noheal', 'noperks']));
            if (three.map.nodes.length <= one.map.nodes.length)
              throw new Error(`Expedition III is ${three.map.nodes.length} places, I is ${one.map.nodes.length}`);
            runStartOn(s, three);
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            setSaveData(s);
            const run = s.run,
              up = modFoeLevels(run);
            if (run.expedition !== 3 || up !== 4) throw new Error(`Expedition ${run.expedition}, foes +${up}`);
            if (modBossHp(run) <= 1) throw new Error('the boss is no tougher at Expedition III');
            /* its foes: the leaders of its own types, at the Expedition's levels */
            const foes = Object.values(
                runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: RULES.run })
              ),
              boss = foes.find(F => F.runFoe === 'boss');
            if (!foes.length || !boss) throw new Error('the run has no leaders');
            if (!boss.hpMult || boss.hpMult <= 1) throw new Error('the boss carries no HP multiplier');
            for (const F of foes) {
              const T = TRAINERS[F.from];
              if (T && T.type)
                for (const e of F.team)
                  if (!SPECIES[e.sp].types.includes(T.type))
                    throw new Error(`${T.name} (${T.type}) fields ${SPECIES[e.sp].name}`);
            }
            /* the challenges: the clinic shut, no healing ware on sale, no Perk offered */
            s.team[0].hp = 1;
            const money = s.se;
            if (runClinic(s, RULES.run.healCost).paid || s.se !== money || s.team[0].hp !== 1)
              throw new Error('the clinic healed on a "No healing" run');
            for (let day = 1; day <= 10; day++)
              for (const w of runShopOpen(run, 1, day, RULES.run.shop, UNLOCK_DATA))
                if (w.item && runWareHeals(w.item, ITEMS)) throw new Error(`a shop sells ${w.item} on day ${day}`);
            if (perkOfferMake(run, PERKS, RULES.run.perks)) throw new Error('a Perk was offered on a "No Perks" run');
            return `Expedition III: ${three.map.nodes.length} places (I: ${one.map.nodes.length}), foes +${up}, the boss x${modBossHp(run).toFixed(2)}; the clinic shut, no healing ware, no Perk`;
          } finally {
            setSaveData(was);
            render();
          }
        },
        4,
        60
      );
    /* RL-12b: a run's waystation and stall, on a copy of the save: the first seed (SELFTESTWAY0, 1, ...) whose map has
       both; at the waystation its stand (act 'event') opens the event the place holds, at the stall its stall opens
       the place's shop with the day's wares; both hold rules.json run.wild.waystation wild Billies. Then the save as
       it was */
    if (typeof runWorldSync === 'function' && typeof encounterOpen === 'function' && !selfTest.stop)
      await phase(
        "A run's waystation and stall",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            view = async (/** @type {number} */ n) => {
              const id = 'w:' + LOCATIONS[n].mapId + '*';
              for (let i = 0; i < 600 && !(walkView.ready && walkView.id === id); i++) await selfTestSleep(100);
              if (walkView.id !== id) throw new Error(`${LOCATIONS[n].name} isn't shown (still ${walkView.id})`);
            },
            sheet = async (/** @type {string} */ sel) => {
              for (let i = 0; i < 50 && !document.querySelector(sel); i++) await selfTestSleep(100);
              return document.querySelector(sel);
            },
            shut = () => {
              uiState.modal = null;
              uiState.mq = [];
              renderOverlay();
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            let plan = null,
              seed = '';
            for (let k = 0; k < 60 && !plan; k++) {
              const p = runStartPlan(`SELFTESTWAY${k}`, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }),
                types = p.map.nodes.filter(n => !n.side).map(n => n.type);
              if (types.includes('event') && types.includes('stall')) [plan, seed] = [p, `SELFTESTWAY${k}`];
            }
            if (!plan) throw new Error('no seed of the first 60 has a waystation and a stall');
            runStartOn(s, plan);
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            setSaveData(s);
            const nodes = s.run.map.nodes,
              stand = nodes.findIndex(n => n.type === 'event' && !n.side),
              stall = nodes.findIndex(n => n.type === 'stall' && !n.side),
              out = [];
            for (const [i, act] of /** @type {[number, string][]} */ ([
              [stand, 'event'],
              [stall, 'stall'],
            ])) {
              const n = runWorldNode(i);
              if (!runJump(n)) throw new Error(`couldn’t walk to ${act === 'event' ? 'the waystation' : 'the stall'}`);
              uiState.roam = null;
              render();
              await view(n);
              const P = (walkView.sc.props || []).find(q => q.act === act);
              if (!P) throw new Error(`${LOCATIONS[n].name} has no ${act === 'event' ? 'stand' : 'stall'}`);
              const wild = encountersHere(n).length;
              if (!LOCATIONS[n].waystation || wild > RULES.run.wild.waystation)
                throw new Error(`${LOCATIONS[n].name} holds ${wild} wild Billies, more than a waystation's`);
              shut();
              walkPick({ k: 'act', act, p: P });
              if (act === 'event') {
                const ev = eventAt(saveData.run, i, EVENTS);
                if (!ev) throw new Error('the waystation holds no event');
                if (!(await sheet('#ov .event-sheet'))) throw new Error(`the stand didn’t open ${ev}`);
                out.push(`${LOCATIONS[n].name}: ${ev}`);
              } else {
                if (!(await sheet('#ov .shop-sheet .ware2'))) throw new Error('the stall didn’t open its shop');
                out.push(`${LOCATIONS[n].name}: ${document.querySelectorAll('#ov .shop-sheet .ware2').length} wares`);
              }
              shut();
            }
            return `${seed}: ${out.join('; ')}`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            setSaveData(was);
            render();
          }
        },
        8,
        180
      );
    /* RT-2: a run route's trainers, on a copy of the save: the first seed (SELFTESTRT0, 1, ...) whose map has a route
       with a pair; on its place every trainer stands on its spot (a pair's second beside it), facing the way it
       looks; the place's wild Billies are fewer for them; the pair starts a double and, beaten, leaves one reward
       pick. Route sight is off while the test runs, so the battle is started as the walk-up would. Then the save as
       it was */
    if (typeof runWorldSync === 'function' && !selfTest.stop)
      await phase(
        "A route's trainers: on their spots, a pair as a double",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            wait = async (/** @type {() => any} */ f, /** @type {number} */ ms) => {
              const end = performance.now() + ms * (selfTest.slow || 1);
              while (performance.now() < end) {
                if (f()) return true;
                if (activeBattle && activeBattle.phase === 'playing') tapMessage();
                await selfTestSleep(100);
              }
              return !!f();
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            let seed = '',
              node = -1;
            for (let k = 0; k < 40 && node < 0; k++) {
              const t = JSON.parse(JSON.stringify(s));
              runStartOn(t, runStartPlan(`SELFTESTRT${k}`, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
              const pair = Object.values(
                runRouteTrainers(t.run, { classes: EVENTS.classes, species: SPECIES, rules: RULES.run })
              ).find(T => T.mate && !(t.run.map.nodes[T.runNode] || {}).side);
              if (pair) [seed, node] = [`SELFTESTRT${k}`, pair.runNode];
            }
            if (node < 0) throw new Error('no seed of the first 40 has a route with a pair');
            runStartOn(s, runStartPlan(seed, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            s.team.forEach(m => {
              m.hp = maxHp(m);
              m.status = null;
            });
            setSaveData(s);
            const n = runWorldNode(node);
            if (!runJump(n)) throw new Error('couldn’t walk to the route');
            uiState.roam = null;
            render();
            const id = 'w:' + LOCATIONS[n].mapId + '*';
            if (!(await wait(() => walkView.ready && walkView.id === id, 60000)))
              throw new Error(`the route isn't shown (still ${walkView.id})`);
            const here = Object.values(TRAINERS).filter(T => T.route && T.runNode === node),
              count = here.reduce((a, T) => a + (T.mate ? 2 : 1), 0),
              o = walkView.sc.baseOff || [0, 0];
            if (!here.length || !here.every(T => T.route.at && T.route.spot))
              throw new Error('a route trainer has no spot');
            if (!(await wait(() => here.every(T => walkView.npcAt[T.id]), 10000)))
              throw new Error('a route trainer isn’t on the map');
            for (const T of here) {
              const p = walkView.npcAt[T.id],
                d = Math.hypot(p[0] - T.route.at[0] - o[0], p[1] - T.route.at[1] - o[1]);
              if (d > 1.5) throw new Error(`${T.name} stands ${d.toFixed(1)} m off its ${T.route.spot}`);
              if (!walkView.npcLook[T.id]) throw new Error(`${T.name} faces nowhere`);
            }
            const P = here.find(T => T.mate);
            if (!P || !walkView.npcAt[P.id + '~b']) throw new Error('the pair’s second isn’t on the map');
            const stock = encounterStock(n);
            if (stock !== Math.max(RULES.run.wild.routeMin, RULES.run.wild.route - count))
              throw new Error(`the route holds ${stock} wild Billies with ${count} trainers`);
            const picks = (saveData.run.enc && saveData.run.enc.rewardN) || 0;
            startTrainer(P.id, { talked: true });
            if (!activeBattle || activeBattle.fmt !== 'double') throw new Error('the pair didn’t start a double');
            stopTimers();
            activeBattle.over = 'win';
            endBattle();
            if (!(await wait(() => !activeBattle && saveData.flags[P.id], 15000)))
              throw new Error('the pair’s battle didn’t end');
            if (((saveData.run.enc && saveData.run.enc.rewardN) || 0) !== picks + 1)
              throw new Error('the pair left no reward pick (or two)');
            return `${seed}: ${LOCATIONS[n].name}, ${count} trainers (${here.map(T => T.route.spot + (T.route.opt ? '?' : '') + (T.mate ? '+2' : '')).join(', ')}), ${stock} wild; the pair a double, one pick`;
          } finally {
            if (activeBattle) {
              stopTimers();
              setActiveBattle(null);
            }
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        8,
        180
      );
    /* RT-4: a run route's wild Billies, on a copy of the save: the first seed (SELFTESTWH0, 1, ...) with a route place
       (trainers on it, a spot for its rarer one) whose scene has points for a habitat its pool has Billies of; there the stock is 10 less its
       trainers (4 at least), one of them the rarer one, standing on the place's rareAt, and every water or woods
       Billie on one of its habitat's points. Then the save as it was */
    if (typeof runWorldSync === 'function' && RULES.run.wild.habitats && !selfTest.stop)
      await phase(
        "A route's wild Billies: in their habitats, the rarer one in its pocket",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            H = RULES.run.wild.habitats,
            wait = async (/** @type {() => any} */ f, /** @type {number} */ ms) => {
              const end = performance.now() + ms * (selfTest.slow || 1);
              while (performance.now() < end) {
                if (f()) return true;
                await selfTestSleep(100);
              }
              return !!f();
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            let seed = '',
              node = -1;
            for (let k = 0; k < 20 && node < 0; k++) {
              const t = JSON.parse(JSON.stringify(s));
              runStartOn(t, runStartPlan(`SELFTESTWH${k}`, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
              const T = runRouteTrainers(t.run, { classes: EVENTS.classes, species: SPECIES, rules: RULES.run }),
                routes = new Set(Object.values(T).map(q => q.runNode)),
                made = runScenesMake(t.run, data),
                W = runWorldTables(t.run, LOCATIONS[0], data);
              routeTrainersPlace(t.run, T, made, EVENTS.classes);
              const rareAt = routeRareSpots(t.run, T, made);
              node = made.findIndex((sc, i) => {
                if (!routes.has(i) || !rareAt[i] || (t.run.map.nodes[i] || {}).side || !sc.habitats) return false;
                const P = W.pools[W.locations[i + 1].pool];
                return P.list.some(([sp]) => !!sc.habitats[wildHabitat(SPECIES[sp].types, H)]);
              });
              if (node >= 0) seed = `SELFTESTWH${k}`;
            }
            if (node < 0) throw new Error('no seed of the first 20 has a route whose pool fits its habitats');
            runStartOn(s, runStartPlan(seed, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            setSaveData(s);
            const n = runWorldNode(node);
            if (!runJump(n)) throw new Error('couldn’t walk to the route');
            uiState.roam = null;
            render();
            const id = 'w:' + LOCATIONS[n].mapId + '*';
            if (!(await wait(() => walkView.ready && walkView.id === id, 60000)))
              throw new Error(`the route isn't shown (still ${walkView.id})`);
            const L = LOCATIONS[n],
              list = encountersHere(n),
              want = Math.max(RULES.run.wild.routeMin, RULES.run.wild.route - (L.trainerCount || 0));
            if (list.length !== want)
              throw new Error(`${list.length} wild Billies with ${L.trainerCount} trainers (want ${want})`);
            if (!(await wait(() => list.every(q => walkView.enc[q.id]), 10000)))
              throw new Error('a wild Billie isn’t on the map');
            const sc = walkView.sc,
              o = sc.baseOff || [0, 0],
              near = (/** @type {any} */ e, /** @type {number[]} */ p) => Math.hypot(e.x - p[0], e.z - p[1]) < 0.6,
              rare = list.filter(q => q.rare);
            if (rare.length !== 1) throw new Error(`${rare.length} rarer ones`);
            if (!L.rareAt) throw new Error('the place has no spot for its rarer one');
            if (!near(walkView.enc[rare[0].id], [L.rareAt[0] + o[0], L.rareAt[1] + o[1]]))
              throw new Error('the rarer one isn’t in its pocket');
            const by = /** @type {Record<string, number>} */ ({});
            for (const q of list) {
              if (q.rare) continue;
              const k = q.hab || 'grass';
              by[k] = (by[k] || 0) + 1;
              const pts = q.hab && sc.habitats && sc.habitats[q.hab];
              if (pts && !pts.some(p => near(walkView.enc[q.id], p)))
                throw new Error(`a ${q.hab} Billie (${q.sp}) isn’t on its habitat's points`);
            }
            return `${seed}: ${L.name}, ${list.length} wild with ${L.trainerCount} trainers (${Object.entries(by)
              .map(([k, v]) => k + ' ' + v)
              .join(
                ', '
              )}, the rarer one ${rare[0].sp} lv ${rare[0].lvl} in its ${(mapById(L.mapId).spots || []).find(p => p.x === L.rareAt[0] && p.z === L.rareAt[1]).kind})`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        8,
        180
      );
    /* RT-3: a run route's set pieces, on a copy of the save: the first seed (SELFTESTSP0, 1, ...) whose map has a
       Bureau checkpoint on a main place; on that place every piece has all its props round it, the agent stands in
       the checkpoint, tapping it opens the bureau_checkpoint event, walking on plays it, and tapping again only
       talks. Then the save as it was */
    if (typeof runWorldSync === 'function' && SET_PIECES && !selfTest.stop)
      await phase(
        "A route's set pieces: whole, the Bureau's agent opens its event once",
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            data = runWorldData(),
            wait = async (/** @type {() => any} */ f, /** @type {number} */ ms) => {
              const end = performance.now() + ms * (selfTest.slow || 1);
              while (performance.now() < end) {
                if (f()) return true;
                await selfTestSleep(100);
              }
              return !!f();
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            let seed = '',
              node = -1;
            for (let k = 0; k < 12 && node < 0; k++) {
              const t = JSON.parse(JSON.stringify(s));
              runStartOn(t, runStartPlan(`SELFTESTSP${k}`, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
              const made = runScenesMake(t.run, data);
              node = made.findIndex(
                (sc, i) => !(t.run.map.nodes[i] || {}).side && (sc.pieces || []).some(L => L.id === 'bureau_checkpoint')
              );
              if (node >= 0) seed = `SELFTESTSP${k}`;
            }
            if (node < 0) throw new Error('no seed of the first 12 has a Bureau checkpoint on a main place');
            runStartOn(s, runStartPlan(seed, { ...data, unlockData: UNLOCK_DATA }, { unlocks: [] }));
            runArrive(s, 0, data);
            s.visited[s.trip.node] = 1;
            setSaveData(s);
            const n = runWorldNode(node);
            if (!runJump(n)) throw new Error('couldn’t walk to the route');
            uiState.roam = null;
            render();
            const id = 'w:' + LOCATIONS[n].mapId + '*';
            if (!(await wait(() => walkView.ready && walkView.id === id, 60000)))
              throw new Error(`the route isn't shown (still ${walkView.id})`);
            const sc = mapById(LOCATIONS[n].mapId),
              L = sc.pieces || [];
            for (const P of L) {
              const S = SET_PIECES.pieces[P.id];
              for (const q of S.props)
                if (!sc.props.some(o => o.k === q.k && Math.hypot(o.x - P.x, o.z - P.z) <= S.r + 0.5))
                  throw new Error(`the ${S.name} has no ${q.k}`);
            }
            /* an exit's signpost reads the place's name */
            const sign = sc.props.find(o => o.k === 'signpost' && o.act === 'sign' && !o.say),
              toasts = () =>
                [uiState.toastOn, ...(uiState.toastQ || [])]
                  .map(t => (t && typeof t === 'object' ? t.text : t))
                  .join(' | ');
            if (!sign) throw new Error('the route has no signpost you can read');
            walkPick({ k: 'act', act: 'sign', p: sign });
            if (!(await wait(() => toasts().includes(LOCATIONS[n].name), 3000)))
              throw new Error(`the signpost says “${toasts()}”, not the place’s name`);
            const agent = walkState().npcs.find(m => m.piece && m.piece.event === 'bureau_checkpoint');
            if (!agent) throw new Error('the Bureau checkpoint has no agent');
            if (!(await wait(() => walkView.npcAt[agent.id], 10000))) throw new Error('the agent isn’t on the map');
            walkPick({ k: 'npc', n: agent });
            if (!(await wait(() => uiState.modal && uiState.modal.cls === 'event-sheet', 5000)))
              throw new Error('tapping the agent opened no event');
            const go = uiState.modal.btns[uiState.modal.btns.length - 1];
            go.f();
            if (!(await wait(() => saveData.run.enc && saveData.run.enc.seen.includes('bureau_checkpoint'), 15000)))
              throw new Error('walking on didn’t play the event');
            /* its lines, each with a Go on */
            for (let k = 0; k < 10 && saveData.run.enc.play; k++) {
              await wait(() => uiState.modal && uiState.modal.cls === 'event-sheet', 5000);
              const b = uiState.modal && uiState.modal.btns;
              if (b && b.length === 1) b[0].f();
              await selfTestSleep(200);
            }
            if (saveData.run.enc.play) throw new Error('walking on didn’t end the event');
            uiState.modal = null;
            renderOverlay();
            walkPick({ k: 'npc', n: agent });
            await selfTestSleep(300);
            if (uiState.modal && uiState.modal.cls === 'event-sheet')
              throw new Error('the agent opened the event twice');
            return `${seed}: ${LOCATIONS[n].name}, ${L.map(P => P.id + '@' + P.spot).join(', ')}; the signpost reads its name; the agent's event once`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        8,
        180
      );
    /* RL-8: a run from the mast to the payout, on a copy of the save (nothing is written while the test runs): a short
       run (5 rows) taken off from Copperleaf (RL-9b: one Billie from home, the hub's team left as it was), the
       airship's flight to the landing, a wild battle there, "Go there" to the town (a paid heal; RL-12: its shop's
       Perk bought), the mini-boss (beaten: a Perk picked), to the boss (an Alpha, its battle carrying the
       Perks) and its payout, then home: Copperleaf without the run. Then the save as it was */
    if (typeof runTakeOff === 'function' && !selfTest.stop)
      await phase(
        'A run: airship, nodes, payout',
        'dio',
        async () => {
          const was = saveData,
            s = JSON.parse(JSON.stringify(saveData)),
            wait = async (f, ms) => {
              const end = performance.now() + ms * (selfTest.slow || 1);
              while (performance.now() < end) {
                if (f()) return true;
                if (activeBattle && activeBattle.phase === 'playing') tapMessage();
                await selfTestSleep(100);
              }
              return !!f();
            };
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.goingIn = null;
            uiState.modal = null;
            uiState.mq = [];
            uiState.tab = 'walk';
            if (s.run) runRestore(s);
            s.trip = { node: START_NODE, plan: [] };
            s.team.forEach(m => {
              m.hp = maxHp(m);
              m.status = null;
            });
            setSaveData(s);
            render();
            const hubTeam = saveData.team.map(m => m.uid).join();
            runTakeOff('SELFTESTRUN8', { rows: 5, minibosses: 1 });
            /* HB-2: the run's world is made over several frames before the flight */
            if (!saveData.run || !(await wait(() => airshipFlight.on, 30000)))
              throw new Error('the run didn’t take off');
            /* RL-13: the starter points' default pick travels; the hub's team waits in Copperleaf as it was */
            if (
              !saveData.team.length ||
              saveData.team.length > RULES.run.points.team ||
              saveData.run.start.team.map(m => m.uid).join() !== hubTeam
            )
              throw new Error(
                `took off with ${saveData.team.length} Billies, the hub's team ${hubTeam ? 'changed' : 'empty'}`
              );
            const made = [runWorld.scenes, runWorld.ms],
              t0 = performance.now();
            if (!(await wait(() => !airshipFlight.on && saveData.run.at.phase === 'walk', 20000)))
              throw new Error('the flight never landed');
            const flew = Math.round(performance.now() - t0),
              landing = 'w:' + LOCATIONS[1].mapId + '*';
            if (!(await wait(() => walkView.ready && walkView.id === landing, 15000)))
              throw new Error(`landed but the view is ${walkView.id}`);
            /* HB-2: the landing's loading screen lifts (every stage ready, or the cap) */
            if (!(await wait(() => runLoad.ready && !document.getElementById('runload'), RULES.run.load.capMs + 5000)))
              throw new Error('the landing’s loading screen never lifted');
            /* RL-R1: the run's region: the short map's 5 rows in its zones, each place its zone's biome (RL-R2: a
               side area's its field move's), its name on the Map tab */
            const G = saveData.run.region,
              side = saveData.run.map.side,
              sideBiome = side && FIELD_MOVES[side.move] ? FIELD_MOVES[side.move].biome : '';
            if (!G || G.zones.reduce((n, z) => n + z.rows, 0) !== 5)
              throw new Error(`the run's region doesn't fit its 5 rows: ${JSON.stringify(G && G.zones)}`);
            const off = saveData.run.map.nodes.find(
              n => !G.zones[n.zone] || (n.side ? sideBiome : G.zones[n.zone].biome) !== n.biome
            );
            if (off)
              throw new Error(
                `a place on row ${off.row + 1} isn't its ${off.side ? "side area's move's" : "zone's"} biome`
              );
            if (!renderWorldMapTab().includes(escapeHtml(G.name)))
              throw new Error('the Map tab doesn’t name the region');
            measureFromHere();
            uiState.modal = null;
            uiState.mq = [];
            const q = encountersHere()[0];
            if (q) {
              startWild(q);
              if (!activeBattle || !saveHeld()) throw new Error('a run battle didn’t hold the save');
              stopTimers();
              activeBattle.over = 'win';
              endBattle();
              if (!(await wait(() => !activeBattle && saveData.run.at.phase === 'walk', 15000)))
                throw new Error('the run battle never ended');
            }
            const map = saveData.run.map,
              town = runWorldNode(map.nodes.findIndex(n => n.type === 'town'));
            if (!runJump(town)) throw new Error('couldn’t walk to the town');
            uiState.modal = null;
            uiState.mq = [];
            saveData.team[0].hp = Math.max(1, saveData.team[0].hp - 3);
            saveData.se = Math.max(saveData.se, 500);
            const se = saveData.se,
              cost = runHealCost(saveData.team, runClinicEach()).cost;
            clinicHeal();
            if (!uiState.modal || !uiState.modal.btns) throw new Error('the clinic asked nothing');
            uiState.modal.btns[0].f();
            if (saveData.se !== se - cost)
              throw new Error(`the clinic took ${plural(se - saveData.se, 'Money')}, not ${cost}`);
            /* TW-3: the town has a notice board and a quest giver; its quest (when it has one) is taken and kept
               by the save's check */
            const townScene = mapById(LOCATIONS[town].mapId) || {};
            if (!(townScene.props || []).some((/** @type {any} */ p) => p.act === 'notice'))
              throw new Error('the town has no notice board');
            if (!(townScene.people || []).some((/** @type {any} */ p) => p.quest))
              throw new Error('the town has no quest giver');
            const offer = questOffer(saveData.run, town - 1, questData());
            if (offer && !questTake(saveData.run, town - 1, offer, QUESTS)) throw new Error('the quest wasn’t taken');
            if (!validRun(JSON.parse(JSON.stringify(saveData.run))))
              throw new Error('a run with a quest fails validRun');
            /* RL-12: the town's shop sells the day's Perk; the mini-boss leaves a pick; the boss's battle carries
               both */
            uiState.modal = null;
            uiState.mq = [];
            saveData.se = Math.max(saveData.se, 1000);
            const shopId = Object.keys(SHOPS).find(k => SHOPS[k].runNode === town - 1);
            openShop(shopId);
            const buy = /** @type {HTMLElement | null} */ (
              document.querySelector('#ov .shop-sheet [data-a=shoprelic]')
            );
            if (!buy) throw new Error('the town’s shop has no Perk');
            buy.click();
            if (saveData.run.perks.length !== 1) throw new Error('the shop’s Perk wasn’t bought');
            uiState.modal = null;
            uiState.mq = [];
            const mb = runWorldNode(map.nodes.findIndex(n => n.type === 'miniboss'));
            if (!runJump(mb)) throw new Error('couldn’t walk to the mini-boss');
            const MB = trainersAt(mb)[0];
            if (!MB || MB.runFoe !== 'miniboss') throw new Error('no mini-boss on its place');
            if (MB.from !== G.leaders[0])
              throw new Error(`the mini-boss is ${MB.from}, not the region's ${G.leaders[0]}`);
            /* RL-S1: the leader's word before the battle is picked by the story director (banter.json leader) */
            if (!MB.script || MB.script[0] !== 'pick leader') throw new Error('the mini-boss has no picked word');
            if (!storyPickTree('leader', 'trainer:' + MB.id)) throw new Error('no leader line could be picked');
            startTrainer(MB.id, { talked: true });
            if (!activeBattle) throw new Error('the mini-boss battle didn’t start');
            stopTimers();
            activeBattle.over = 'win';
            endBattle();
            const pickBtn = () => uiState.modal && (uiState.modal.btns || []).find(b => b.l === 'Pick a Perk');
            if (!(await wait(() => !activeBattle && !!pickBtn(), 15000)))
              throw new Error('no pick after the mini-boss');
            pickBtn().f();
            if (!uiState.modal || uiState.modal.cls !== 'relic-pick' || !saveData.run.offer)
              throw new Error('the pick didn’t open');
            const took = saveData.run.offer[0];
            uiState.relicSel = took;
            perkPickOpen();
            uiState.modal.btns[0].f();
            if (saveData.run.perks.length !== 2 || !saveData.run.perks.includes(took) || saveData.run.offer)
              throw new Error('the pick wasn’t taken');
            uiState.modal = null;
            uiState.mq = [];
            /* RL-R2: a side area's places come after the main path's, so the boss is the main path's, not the last */
            const boss = runWorldNode(map.nodes.findIndex(n => n.type === 'boss' && !n.side));
            runJump(boss);
            const B = trainersAt(boss)[0];
            if (!B || !B.alpha) throw new Error('no Alpha boss on the boss’s place');
            uiState.modal = null;
            uiState.mq = [];
            startTrainer(B.id, { talked: true });
            if (!activeBattle || activeBattle.fmt !== 'alpha') throw new Error('the boss isn’t an Alpha battle');
            if (!activeBattle.fx || !activeBattle.fx.length) throw new Error('the boss’s battle has no Perks');
            stopTimers();
            activeBattle.over = 'win';
            endBattle();
            if (
              !(await wait(() => uiState.modal && uiState.modal.btns && /payout/.test(uiState.modal.btns[0].l), 15000))
            )
              throw new Error('no way on to the payout after the boss');
            uiState.modal.btns[0].f();
            if (!(await wait(() => uiState.modal && uiState.modal.cls === 'run-payout', 5000)))
              throw new Error('no payout screen');
            uiState.modal.btns[0].f();
            if (!(await wait(() => !saveData.run && LOCATIONS.length === gameData.locations.length, 10000)))
              throw new Error('the run didn’t end');
            /* RL-S1: the run is in the history, its mini-boss beaten; the hub characters' lines picked, no scene */
            const H = saveData.meta.history[saveData.meta.history.length - 1];
            if (!H || H.end !== 'won' || H.seed !== 'SELFTESTRUN8') throw new Error('the won run isn’t in the history');
            if (!H.leaders.some(l => l.id === MB.from && l.beat)) throw new Error('the history lost the mini-boss win');
            if (!saveData.story.fresh || saveData.story.pending) throw new Error('home from a win: the story’s picks');
            return `${G.name} (${G.zones.map(z => z.biome).join(', ')}): ${made[0]} scenes made in ${made[1]} ms; flew in ${flew} ms; a battle, a heal for ${plural(cost, 'Money')}, a Perk bought and one picked after the mini-boss, the boss; home with ${saveData.meta.research} Research; in the history`;
          } finally {
            if (activeBattle) {
              stopTimers();
              setActiveBattle(null);
              battleStageStop();
            }
            airshipFlight.on = false;
            document.body.classList.remove('flying');
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        10,
        180
      );
    /* RL-9: the ranch, on a copy of the save (nothing is written while the test runs): Copperleaf's barn leads into the
       ranch's room; a Billie put in storage starts training for Scrap; a level's time later (its start moved back)
       the ranch's sheet collects the level; Stop ends it. Then the save as it was */
    if (typeof ranchOpen === 'function' && RULES.ranch && !saveData.run && !selfTest.stop)
      await phase(
        'The ranch: training between runs',
        'dio',
        async () => {
          const was = saveData,
            R = RULES.ranch,
            hub = mapById(LOCATIONS[START_NODE].mapId) || { props: [] },
            door = (hub.props || []).find(p => p.act === 'ranch');
          try {
            if (!door) throw new Error('no ranch in ' + LOCATIONS[START_NODE].name);
            const rooms = PB_DATA.doorRooms(door, walkData().sc.props[door.k], 'ranch');
            if (!rooms.some(id => mapById(id)))
              throw new Error('the ranch’s door leads to no room: ' + rooms.join(', '));
            const s = JSON.parse(JSON.stringify(saveData)),
              m = makeBilly(s.team[0].sp, 5);
            s.box.push(m);
            s.meta.scrap = R.trainCost;
            setSaveData(s);
            uiState.modal = null;
            uiState.mq = [];
            const why = ranchTrainStart(s, m.uid, Date.now() - Math.ceil(3600000 / R.levelsPerHour), R);
            if (why) throw new Error('training didn’t start: ' + why);
            if (s.meta.scrap !== 0)
              throw new Error(`training cost ${R.trainCost - s.meta.scrap} Scrap, not ${R.trainCost}`);
            /* IS-8: the trainee wanders in the pasture first; the pasture's gate is in its zone */
            const out = pastureBillies(s, R.pasture);
            if (R.pasture > 0 && (!out.length || out[0].uid !== m.uid))
              throw new Error('the trainee isn’t the first in the pasture');
            const zone = pastureZone(hub),
              gate = (hub.props || []).find(p => p.act === 'pasture');
            if (zone && (!gate || !pastureIn(zone, gate.x, gate.z)))
              throw new Error('the pasture has no gate in its zone');
            ranchOpen();
            if (!uiState.modal || uiState.modal.cls !== 'ranch-sheet' || !document.querySelector('#ov .ranch-sheet'))
              throw new Error('the ranch’s sheet didn’t open');
            if (m.lvl !== 6) throw new Error(`a level’s training gave Lv 5 → ${m.lvl}`);
            const stop = /** @type {HTMLElement | null} */ (
              document.querySelector(`#ov .ranch-sheet [data-r=stop][data-u="${m.uid}"]`)
            );
            if (!stop) throw new Error('no Stop on the trainee’s card');
            stop.click();
            if (s.ranch.trainees.length) throw new Error('Stop left it training');
            return `the barn leads into ${rooms.find(id => mapById(id))}; trained a level for ${R.trainCost} Scrap; Stop ended it; the trainee first in the pasture${zone ? ', its gate in place' : ''}`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        3,
        60
      );
    /* RL-10: breeding at the ranch, on a copy of the save: two of the lead's line in storage, a safe pair picked on the
       ranch's sheet shows its egg, Breed pays and puts that egg in the nursery, it can't hatch at once; ready (its time
       moved to now), Hatch brings it home. Then the save as it was */
    if (typeof ranchOpen === 'function' && RULES.ranch && RULES.ranch.breed && !saveData.run && !selfTest.stop)
      await phase(
        'The ranch: breeding a pair',
        'dio',
        async () => {
          const was = saveData,
            BR = RULES.ranch.breed;
          try {
            const s = JSON.parse(JSON.stringify(saveData)),
              line = SPECIES[s.team[0].sp].line,
              a = makeBilly(line + '0', 6),
              b = makeBilly(line + '0', 7);
            s.box.push(a, b);
            s.ranch.nursery = [];
            s.meta.scrap = BR.safeCost;
            setSaveData(s);
            uiState.modal = null;
            uiState.mq = [];
            ranchOpen();
            uiState.breedPick = { a: a.uid, b: b.uid, mode: 'safe' };
            ranchOpen();
            const btn = /** @type {HTMLButtonElement | null} */ (
              document.querySelector('#ov .ranch-sheet [data-r=breed]')
            );
            if (!document.querySelector('#ov .ranch-sheet .breed-preview'))
              throw new Error('a safe pair showed no egg');
            if (!btn || btn.disabled) throw new Error('Breed is off for a safe pair with the Scrap');
            btn.click();
            const e = s.ranch.nursery[0];
            if (!e || s.meta.scrap !== 0)
              throw new Error(`after Breed: ${s.ranch.nursery.length} eggs, ${s.meta.scrap} Scrap`);
            if (e.egg.sp !== line + '0') throw new Error(`the egg hatches into ${e.egg.sp}, not ${line}0`);
            const hatch = () =>
              /** @type {HTMLButtonElement | null} */ (
                document.querySelector('#ov .ranch-sheet [data-r=hatch][data-i="0"]')
              );
            if (!hatch() || !hatch().disabled) throw new Error('a new egg could hatch at once');
            e.ready = Math.max(e.at, Date.now());
            ranchOpen();
            hatch().click();
            /* the hatch window: "Hatch it", then the Billie it was (after the egg's shake) */
            const it = /** @type {HTMLElement | null} */ (document.querySelector('#ov [data-a="mb"][data-i="0"]'));
            if (!uiState.modal || uiState.modal.title !== 'An egg is hatching' || !it)
              throw new Error('Hatch opened no hatch window');
            it.click();
            if (s.ranch.nursery.length || !s.team.concat(s.box).some(m => m.uid === e.egg.uid))
              throw new Error('Hatch didn’t bring the egg home');
            const shown = () => !!uiState.modal && /^It’s/.test(uiState.modal.title);
            for (let n = 0; n < 50 * (selfTest.slow || 1) && !shown(); n++) await selfTestSleep(100);
            if (!shown()) throw new Error('the hatch window never showed the Billie');
            return `a safe pair of ${SPECIES[line + '0'].name} for ${BR.safeCost} Scrap; its egg shown, bred and hatched`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            uiState.breedPick = null;
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        3,
        60
      );
    /* RL-10b: the ranch's passive income, on a copy of the save (nothing is written while the test runs): counted for
       three hours, the sheet's Income row shows three hours' Scrap and Collect pays it; then the ranch clock's mark two
       hours ahead of the device (as after a clock set forward, collected, and turned back): the sheet says the clock
       is behind, nothing waits and Collect is shut. Then the save as it was */
    if (typeof ranchOpen === 'function' && RULES.ranch && RULES.ranch.income && !saveData.run && !selfTest.stop)
      await phase(
        'The ranch: income and a clock turned back',
        'dio',
        async () => {
          const was = saveData,
            R = RULES.ranch,
            H = 3600000;
          try {
            const s = JSON.parse(JSON.stringify(saveData)),
              now = ranchNow(s, Date.now(), R).now,
              rate = incomeRate(s, R),
              want = Math.floor(3 * rate);
            s.meta.scrap = 0;
            s.ranch.income = { bank: 0, lastAt: now - 3 * H };
            setSaveData(s);
            uiState.modal = null;
            uiState.mq = [];
            ranchOpen();
            const count = () => (document.querySelector('#ov .ranch-income .count') || { textContent: '' }).textContent,
              collect = () =>
                /** @type {HTMLButtonElement | null} */ (document.querySelector('#ov .ranch-income [data-r=collect]'));
            if (count() !== `${want} Scrap`) throw new Error(`three hours show “${count()}”, not ${want} Scrap`);
            const c = collect();
            if (!c || c.disabled) throw new Error('Collect is shut with Scrap waiting');
            c.click();
            if (s.meta.scrap !== want) throw new Error(`Collect paid ${s.meta.scrap}, not ${want}`);
            s.ranch.seen = s.ranch.income.lastAt = Date.now() + 2 * H;
            uiState.modal = null;
            ranchOpen();
            if (!document.querySelector('#ov .ranch-back')) throw new Error('the sheet didn’t say the clock is behind');
            if (count() !== '0 Scrap' || !collect() || !(/** @type {HTMLButtonElement} */ (collect()).disabled))
              throw new Error(`the clock behind: “${count()}” waiting`);
            if (s.ranch.income.lastAt !== s.ranch.seen) throw new Error('the income’s time moved back');
            return `three hours showed and paid ${want} Scrap (${rate} an hour); a clock two hours behind paid nothing and said so`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        3,
        60
      );
    /* RL-11: the Lab's unlock board, on a copy of the save (nothing is written while the test runs): the Lab tab draws
       every row of unlocks.json; a board row bought pays its Research; the ranch's upgrade raises its level and slots;
       a milestone met is granted once; a run's copy holds the shop unlock. Then the save as it was */
    if (typeof renderLabBoard === 'function' && !saveData.run && !selfTest.stop)
      await phase(
        'The Lab: unlocks',
        'dio',
        async () => {
          const was = saveData,
            tab = uiState.tab,
            D = UNLOCK_DATA;
          try {
            const s = JSON.parse(JSON.stringify(saveData));
            Object.assign(s.meta, {
              research: 1000,
              scrap: 200,
              crests: 0,
              unlocks: {},
              buildings: {},
              runs: 1,
              wins: 0,
            });
            setSaveData(s);
            uiState.modal = null;
            uiState.mq = [];
            uiState.tab = 'lab';
            render();
            const rows = document.querySelectorAll('.s-lab .lab-row').length;
            if (rows !== Object.keys(D.unlocks).length)
              throw new Error(`the board shows ${rows} rows, unlocks.json has ${Object.keys(D.unlocks).length}`);
            const buy = /** @type {HTMLElement | null} */ (
              document.querySelector('.s-lab [data-a=lab-buy][data-k=shop_nerve_tonic]')
            );
            if (!buy) throw new Error('no Buy on Nerve Tonic');
            buy.click();
            if (!s.meta.unlocks.shop_nerve_tonic || s.meta.research !== 1000 - D.unlocks.shop_nerve_tonic.cost)
              throw new Error(`buying Nerve Tonic left ${s.meta.research} Research`);
            if (!labBuy('ranch_2') || ranchLevel(s) !== 2 || ranchSlots(s, RULES.ranch) !== RULES.ranch.slots[1])
              throw new Error('the ranch’s upgrade didn’t raise its level and slots');
            const got = labMilestones();
            if (!got.includes('first_run') || labMilestones().length)
              throw new Error('the first milestone: ' + got.join());
            if (!runUnlocks(s, D).includes('shop_nerve_tonic')) throw new Error('a run wouldn’t carry the shop unlock');
            return `${rows} rows; bought Nerve Tonic for ${D.unlocks.shop_nerve_tonic.cost} Research and Ranch Lv 2; milestone ${got.join(', ')}`;
          } finally {
            uiState.modal = null;
            uiState.mq = [];
            uiState.tab = tab;
            renderOverlay();
            setSaveData(was);
            render();
          }
        },
        3,
        60
      );
    /* v46: a room that opens in place: into a building and out again, without leaving the town (RL-5: Professor Chosen's
       lab in Copperleaf, the hub; it was Marigold's shop) */
    if (typeof seamlessRoomMap === 'function' && LOCATIONS[START_NODE] && !selfTest.stop)
      await phase(
        'A room that opens in place',
        'dio',
        async () => {
          /* v47: at noon, whatever the clock says: the shop keeps opening hours now */ const f0 =
            typeof environment !== 'undefined' ? environment.force : null;
          if (typeof environment !== 'undefined') {
            environment.force = Object.assign({}, f0 || {}, { time: 12.5 });
            if (typeof PROP_CLOCK !== 'undefined') PROP_CLOCK.t = 0;
          }
          try {
            uiState.bench = null;
            uiState.inside = null;
            uiState.goingIn = null;
            uiState.tab = 'walk';
            const hub = LOCATIONS[START_NODE];
            saveData.trip = { node: START_NODE, plan: [] };
            uiState.roam = null;
            render();
            for (let i = 0; i < 60 && !(walkView.ready && walkView.id === 'w:' + hub.mapId + '*'); i++)
              await selfTestSleep(100);
            if (walkView.id !== 'w:' + hub.mapId + '*')
              throw new Error(hub.name + ' is not shown (still ' + walkView.id + ')');
            /* phase 13: the first frames of a place put you where you arrive; on a slow device that comes after this
               step has put you at the shop's door, and the walk to the door then never starts */
            const f0 = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
            for (let i = 0; i < 60 && typeof walkRenderer !== 'undefined' && walkRenderer.frames < f0 + 2; i++)
              await selfTestSleep(100);
            const p = walkView.sc.props.find(p => p.act === 'lab');
            if (!p) throw new Error('no lab in ' + hub.name);
            const C = walkData().sc,
              g = actionSpot(p, C.props[p.k], C.ppu || 34);
            walkView.pl.route = null;
            walkView.pl.x = g[0];
            walkView.pl.z = g[1];
            /* phase 08b: the town's walking grid, to compare with after coming out */
            const blk0 = navGrid().blk.slice(),
              t0 = performance.now();
            walkPick({ k: 'act', p, act: 'lab' });
            for (let i = 0; i < 150 && !(walkView.ready && walkView.sc.roomOf === 'int_lab'); i++)
              await selfTestSleep(100);
            const ms = performance.now() - t0;
            if (walkView.sc.roomOf !== 'int_lab')
              throw new Error('the lab’s room didn’t open (still ' + walkView.id + ')');
            await selfTestSleep(1200);
            /* phase 08b: the doorway is at the door; the room walks and stands only inside its own rectangle */
            const sc = walkView.sc,
              I = uiState.inside,
              ex = sc.exits[0],
              /* IS-5: along the building's front, whichever way it faces */
              dx =
                I && I.at
                  ? Math.abs((ex[0] - I.at[0]) * -(I.out || [0, -1])[1] + (ex[1] - I.at[1]) * (I.out || [0, -1])[0])
                  : 9,
              off = I && I.door ? Math.hypot(ex[0] - I.door[0], ex[1] - I.door[1]) : 9,
              RD = roomDimming(sc),
              R = sc.roomRect,
              G = navGrid(),
              inR = (x, z, m) => x > R[0] - m && x < R[0] + R[2] + m && z > R[1] - m && z < R[1] + R[3] + m;
            if (dx > 0.1) throw new Error(`the room’s doorway is ${dx.toFixed(2)} m along from the lab’s door`);
            if (off > 0.8) throw new Error(`the room’s doorway is ${off.toFixed(1)} m from the lab’s door`);
            let walkOut = 0,
              wallsOut = 0;
            for (let j = 0; j < G.gh; j++)
              for (let i = 0; i < G.gw; i++)
                if (!G.blk[j * G.gw + i] && !inR((i + 0.5) / G.N, (j + 0.5) / G.N, 0)) walkOut++;
            const E = stepGrid(sc),
              E0 = stepGrid(sc.groundOf);
            if (E && E0)
              for (let j = 0; j < E.h; j++)
                for (let i = 0; i < E.w; i++) {
                  const q = j * E.w + i;
                  if ((E.H[q] !== E0.H[q] || E.M[q] !== E0.M[q]) && !inR((i + 0.5) / 2, (j + 0.5) / 2, 0)) wallsOut++;
                }
            if (walkOut) throw new Error(`inside the room, ${walkOut} walking cells outside it are open`);
            if (wallsOut) throw new Error(`the room changes ${wallsOut} wall cells of the town outside it`);
            /* out: just in front of the door, facing out, the camera as it was when you went in */
            const cam = I.cam,
              fr = [I.at[0] + I.out[0] * 0.6, I.at[1] + I.out[1] * 0.6];
            leaveRoom();
            const P = walkView.pl,
              pd = Math.hypot(P.x - fr[0], P.z - fr[1]),
              camOk =
                !!cam &&
                walkRenderer.camT.every((v, k) => Math.abs(v - cam.T[k]) < 1e-6) &&
                walkRenderer.yawT === cam.yaw &&
                walkRenderer.zoomT === cam.zoom;
            const o = I.out || [0, -1],
              way = Math.abs(o[0]) > Math.abs(o[1]) ? (o[0] > 0 ? 'right' : 'left') : o[1] < 0 ? 'down' : 'up';
            if (pd > 0.01 || P.dir !== way)
              throw new Error(`out at ${pd.toFixed(2)} m from the door, facing ${P.dir} (not ${way})`);
            if (!camOk) throw new Error('the camera isn’t as it was when you went in');
            for (let i = 0; i < 60 && !(walkView.ready && walkView.id === 'w:' + hub.mapId + '*'); i++)
              await selfTestSleep(100);
            if (walkView.id !== 'w:' + hub.mapId + '*')
              throw new Error('walking out didn’t bring the town back (' + walkView.id + ')');
            const blk1 = navGrid().blk;
            let navDiff = blk1.length === blk0.length ? 0 : -1;
            for (let i = 0; navDiff >= 0 && i < blk0.length; i++) if (blk0[i] !== blk1[i]) navDiff++;
            if (navDiff) throw new Error(`the town’s walking grid changed after the room (${navDiff} cells)`);
            return `in ${(ms / 1000).toFixed(1)} s, doorway ${dx.toFixed(2)} m along from the door, nothing of the room outside it, town dimmed ${(RD ? RD.dim : 0).toFixed(2)}, out at the door facing out with the camera as it was, the town’s walking grid unchanged`;
          } finally {
            if (typeof environment !== 'undefined') {
              environment.force = f0;
              if (typeof PROP_CLOCK !== 'undefined') PROP_CLOCK.t = 0;
            }
          }
        },
        6,
        40
      );
    /* v44: the light lab: the four light test scenes, each drawn for a second; what each kind of renderer drew, the
     lamps' maps at night, and whether WebGL refused a draw (a sampler fed the wrong texture shows as a thing missing) */
    if (gameData.maps.test_light_terrain && typeof gpuState !== 'undefined' && gpuState.gl && !selfTest.stop)
      await phase(
        'Light lab: the land, a room, props, the air',
        'dio',
        async () => {
          const gl = gpuState.gl,
            proto = Object.getPrototypeOf(gl),
            ge = proto.getError,
            O = {};
          let refused = 0,
            last = '';
          for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
            O[k] = gl[k];
            const f = proto[k];
            gl[k] = function (...a) {
              const r = f.apply(gl, a);
              const e = ge.call(gl);
              if (e) {
                refused++;
                last = k + ' ' + e;
              }
              return r;
            };
          }
          const out = [];
          try {
            for (const [id, t] of [
              ['test_light_terrain', 17],
              ['test_light_props', 16],
              ['test_light_room', 13],
              ['test_light_room', 23],
              ['test_light_air', 17.5],
            ]) {
              if (selfTest.stop) break;
              if (typeof environment !== 'undefined')
                environment.force = { time: t, weather: 'clear', season: 'summer' };
              uiState.tab = 'walk';
              uiState.bench = { id, test: 1 };
              render();
              for (let i = 0; i < 60 && !(walkView.ready && walkView.id === id); i++) await selfTestSleep(100);
              if (walkView.id !== id) throw new Error(id + ' did not open');
              /* v44b: wait until the scene has settled: ready, every voxel recipe it uses arrived, then 20 more frames
        (the first frames after a scene opens draw voxel props as their pictures while the recipes load) */
              for (let i = 0; i < 80 && !walkView.ready; i++) await selfTestSleep(100);
              const C0 = walkData().sc.props,
                vk = (walkView.sc.props || [])
                  .filter(p => C0[p.k] && typeof C0[p.k].model === 'string')
                  .map(p => C0[p.k].model);
              for (
                let i = 0;
                i < 60 && typeof propModelState !== 'undefined' && vk.some(k => !propModelState.recipes.get(k));
                i++
              )
                await selfTestSleep(100);
              const f0 = walkRenderer.frames;
              for (let i = 0; i < 80 && walkRenderer.frames < f0 + 20; i++) await selfTestSleep(100);
              await selfTestSleep(300);
              const b = typeof buildingState !== 'undefined' ? buildingState.drawn || 0 : 0,
                v = typeof propModelState !== 'undefined' ? propModelState.drawn || 0 : 0,
                p = typeof solidPropState !== 'undefined' ? solidPropState.drawn || 0 : 0,
                lm = ((walkRenderer.X && walkRenderer.X.lampSh) || []).length,
                sc = walkView.sc;
              /* what the camera can see: a phone held upright sees the middle of the scene only, so the props check counts the
        placed things whose foot is on screen and wants each of those drawn by its renderer */
              const inView = pp => {
                const Cm = walkView.C;
                if (!Cm || !Cm.vp) return true;
                const m = Cm.vp,
                  x = pp.x,
                  z = pp.z,
                  y = standingHeightAt(x, z),
                  X = m[0] * x + m[4] * y + m[8] * z + m[12],
                  Y = m[1] * x + m[5] * y + m[9] * z + m[13],
                  W = m[3] * x + m[7] * y + m[11] * z + m[15];
                return W > 0 && Math.abs(X / W) < 0.92 && Math.abs(Y / W) < 0.92;
              };
              /* a building is drawn from its plan (build) or, since the low-poly batches, as a low-poly model with a
                 door (house_red, shop, clinic); the low-poly ones count among the voxel props too */
              const seen = (sc.props || []).filter(inView),
                lowB = pp => C0[pp.k] && !C0[pp.k].build && C0[pp.k].door && C0[pp.k].model && pp.model !== 'card',
                planB = seen.filter(pp => C0[pp.k] && C0[pp.k].build).length,
                polyB = seen.filter(lowB).length,
                wantB = planB + polyB,
                lp = typeof propModelState !== 'undefined' ? propModelState.lowPoly || 0 : 0,
                wantV = seen.filter(pp => C0[pp.k] && C0[pp.k].model && pp.model !== 'card').length;
              if (id === 'test_light_props' && (b < planB || lp < polyB || v < wantV || !wantB))
                throw new Error(
                  `props in view: ${Math.min(b, planB) + Math.min(lp, polyB)} of ${wantB} buildings and ${v} of ${wantV} voxel props drawn (${p} solid props)`
                );
              if (id === 'test_light_room' && t === 23 && !lm)
                throw new Error('no lamp shadow map in the room at night');
              out.push(
                `${(sc.name || id).replace(/^Test: /, '')} ${Math.floor(t)}:${t % 1 ? String(Math.round((t % 1) * 60)).padStart(2, '0') : '00'} — ${Math.min(b, planB) + Math.min(lp, polyB)} of ${wantB} buildings, ${v} voxels, ${p} solids drawn (${seen.length} placed things in view), ${lm} lamp map(s)`
              );
            }
          } finally {
            for (const k in O) gl[k] = O[k];
            if (typeof environment !== 'undefined') environment.force = null;
            uiState.bench = null;
            render();
          }
          if (refused) throw new Error(refused + ' draw calls refused by WebGL (last: ' + last + ')');
          return out.join('; ') + '; no draw call refused';
        },
        6,
        120
      );
    await phase('Battle on the 3D stage', 'scene', () => battle(), 7, 120);
    await phase('Double battle with a trainer', 'scene', () => teamBattle('double'), 8, 150);
    await phase('Alpha battle: your team against one', 'scene', () => teamBattle('alpha'), 8, 150);
    /* v47: the opening's fall into the Hollow Earth (the bowl's own ground, past the Inner Sun), timed */
    if (typeof fallOverWorldMap === 'function' && !selfTest.stop)
      await phase(
        'Opening: falling across the Hollow Earth',
        'map',
        async () => {
          uiState.bench = null;
          uiState.inside = null;
          if (typeof walkView !== 'undefined' && walkView.cv) stopWalkView();
          const cv = fallWorldMapCanvas();
          if (!cv) {
            uiState.tab = 'walk';
            render();
            return 'no 3D here: the opening shows the fall as pictures';
          }
          cv.hidden = false;
          cv.classList.add('in');
          cutscene.on = true;
          cutscene.run++;
          const run = cutscene.run,
            fr = [],
            f0 = worldBowl.filmed;
          let last = performance.now(),
            seen = f0;
          /* phase 10: frames counted as the bowl draws them (worldBowlFilm counts worldBowl.filmed; worldBowl.frames is
             the map tab's) */
          const watch = setInterval(() => {
            if (worldBowl.filmed !== seen) {
              const n = performance.now();
              fr.push(n - last);
              last = n;
              seen = worldBowl.filmed;
            }
          }, 4);
          try {
            await fallOverWorldMap(run, 6000);
          } finally {
            clearInterval(watch);
            cutscene.on = false;
            cutscene.run++;
          }
          uiState.tab = 'walk';
          render();
          await selfTestSleep(1200);
          if (fr.length < 3) throw new Error(`the fall drew ${fr.length} frames`);
          const a = fr.slice(2),
            avg = a.reduce((x, y) => x + y, 0) / a.length;
          return `${fr.length} frames, ${Math.round(1000 / avg)} fps, worst frame ${Math.round(Math.max(...a))} ms`;
        },
        6,
        40
      );
    /* RL-8: the phase 'Opening: Blake’s first battle' went with Blake's battle, which left the opening (the owner's
       "fall only") */
    /* v33: the billionaires out in the world: the wild ones move about in the grass, your buddy keeps up, trainers' companions stand by */
    if (typeof worldBillies !== 'undefined')
      await phase(
        'Billies in the world',
        'dio',
        async () => {
          /* RL-5: in the hub's tall grass (it was Tallgrass Meadow, parked) */
          const gid = LOCATIONS[START_NODE].mapId;
          uiState.tab = 'walk';
          uiState.bench = null;
          const node = LOCATIONS.findIndex(r => r.mapId === gid);
          if (node >= 0) saveData.trip.node = node;
          encountersHere().length = 0;
          for (let i = 0; i < 3; i++) spawn(false);
          render();
          for (let i = 0; i < 80 && !(walkView.ready && (walkView.id === gid || walkView.id === 'w:' + gid + '*')); i++)
            await selfTestSleep(100);
          await selfTestSleep(1500);
          const p0 = Object.fromEntries(Object.entries(walkView.enc).map(([k, v]) => [k, [v.x, v.z]]));
          await selfTestSleep(8000);
          const moved = Object.entries(walkView.enc).filter(
              ([k, v]) => p0[k] && Math.hypot(v.x - p0[k][0], v.z - p0[k][1]) > 0.3
            ).length,
            shown = Object.keys(worldBillies.mons).length;
          if (moved) throw new Error(moved + ' wild Billie(s) left their spot in 8 s (they should stand still)');
          const P = walkView.pl,
            hb = mapHub(walkView.sc);
          walkTo([clamp(hb[0] + 4, 1, walkView.sc.w - 1), clamp(hb[1] + 2, 1, walkView.sc.h - 1)]);
          await selfTestSleep(3500);
          const b = worldBillies.bud,
            gap = b ? Math.hypot(b.x - P.x, b.z - P.z) : null;
          if (b) buddyTap();
          const said = worldBillies.say;
          const pets = Object.values(TRAINERS).filter(T => companionSpecies(T)).length;
          if (!shown) throw new Error('no Billies shown in the grass (' + (walkView.st.enc || []).length + ' hiding)');
          if (b && gap > 4) throw new Error(`your buddy fell ${gap.toFixed(1)} m behind`);
          return `${shown} in the grass, all still on their spots after 8 s; buddy ${b ? `${gap.toFixed(1)} m behind you, said “${said.slice(0, 60)}”` : 'off'}; ${pets} trainers have a companion`;
        },
        6
      );
    /* 3. the world map: the bowl opens, a turn round it and back (its own checks: debug menu or Settings, Bowl map
       test) */
    await phase(
      'World map',
      'map',
      async () => {
        /* 0.1.0 alpha: opened from cold (its ground made again), timed until its textured ground is ready: the owner
           finds the map slow to open, and the bowl was usually already built by the time this step ran */
        worldBowlReset();
        const t0 = performance.now();
        uiState.tab = 'map';
        render();
        await selfTestSleep(500);
        while (worldBowl.on && !(worldBowl.ground && worldBowl.ground.ok) && performance.now() - t0 < 30000)
          await selfTestSleep(100);
        const readyMs = worldBowl.ground && worldBowl.ground.ok ? Math.round(performance.now() - t0) : null;
        await selfTestSleep(1000);
        if (!worldBowl.on) {
          uiState.tab = 'walk';
          render();
          return worldMap.gl ? 'the bowl didn’t open' : 'no WebGL here: the Places list';
        }
        const f0 = worldBowl.frames;
        worldBowl.bench = { turn: 0.8 };
        await selfTestSleep(2500);
        worldBowl.bench = null;
        worldMapReset();
        await selfTestSleep(1200);
        const n = worldBowl.frames - f0;
        uiState.tab = 'walk';
        render();
        await selfTestSleep(500);
        if (n < 5) throw new Error(`the bowl drew ${n} frames while turning`);
        return `${readyMs == null ? 'its ground wasn’t ready in 30 s' : `ready in ${readyMs} ms from cold`}; the bowl drew ${n} frames turning round and coming back`;
      },
      8
    );
    /* v41: what the run left behind: pictures on the graphics card, the ground pictures kept, the JS heap */
    await phase(
      'Memory after the run',
      'dio',
      async () => {
        const vxn = typeof propModelState !== 'undefined' ? propModelState.meshes.size : 0,
          wn =
            typeof seamlessWorld !== 'undefined'
              ? [...seamlessWorld.cache.keys()].filter(k => k.startsWith('w:')).length
              : 0;
        const mb = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
          tex = typeof gpuState !== 'undefined' && gpuState.texB ? Math.round(gpuState.texB / 1048576) : null,
          ntex = typeof gpuState !== 'undefined' && gpuState.texL ? gpuState.texL.size : null,
          grounds = typeof GROUND_CACHE !== 'undefined' ? GROUND_CACHE.size : null,
          gw =
            typeof GROUND_CACHE !== 'undefined'
              ? [...GROUND_CACHE.values()].reduce((a, g) => a + (g && g.width ? g.width * g.height * 4 : 0), 0)
              : 0,
          lost = typeof gpuState !== 'undefined' && gpuState.gl && gpuState.gl.isContextLost();
        if (lost) throw new Error('the WebGL context was lost during the run');
        return [
          tex != null ? `${tex} MB of pictures on the card (${ntex})` : '',
          grounds != null
            ? `${grounds} ground picture${grounds === 1 ? '' : 's'} kept (${Math.round(gw / 1048576)} MB)`
            : '',
          mb != null ? `JS heap ${mb} MB` : '',
          typeof PERSON_ART_CACHE !== 'undefined' ? `${PERSON_ART_CACHE.size} people pictures` : '',
          `${vxn} voxel meshes`,
          `${wn} road views kept`,
        ]
          .filter(Boolean)
          .join(', ');
      },
      1
    );
    /* 7. stress: more and more at once in the hub (RL-5: Copperleaf; it was Marigold), until the device can't keep up (not
       in the diagnostics test) */
    if (!diag && wanted('Stress test')) {
      const sid = LOCATIONS[START_NODE].mapId,
        sc = mapById(sid),
        folk0 = sc.folk,
        props0 = sc.props,
        eng0 = gameData.engine ? gameData.engine.defaults : null;
      unblock();
      uiState.tab = 'walk';
      uiState.bench = { id: sid };
      render();
      await selfTestSleep(1200);
      unblock();
      const steps = [
        ['Normal', () => {}],
        [
          'A crowd (40 people)',
          () => {
            sc.folk = 40;
          },
        ],
        [
          'Crowd and 600 particles',
          () => {
            for (let i = 0; i < 600; i++)
              walkView.parts.push({
                k: i % 2 ? 'leaf' : 'smoke',
                fr: i % 3,
                x: Math.random() * sc.w,
                y: 2 + Math.random() * 3,
                z: Math.random() * sc.h,
                vx: (Math.random() - 0.5) * 0.6,
                vy: 0.2,
                vz: (Math.random() - 0.5) * 0.6,
                g: 0.15,
                life: 0,
                max: 30,
              });
          },
        ],
        [
          'Plus 150 more trees and rocks',
          () => {
            const pool = ['tree_oak', 'tree_pine', 'tree_birch', 'boulder', 'bush_round', 'tree_oak_b'].filter(
              k => walkData().sc.props[k]
            );
            sc.props = props0.concat(
              Array.from({ length: 150 }, (_, i) => ({
                k: pool[i % pool.length],
                x: 1 + ((i * 7.31) % (sc.w - 2)),
                z: 1 + ((i * 3.77) % (sc.h - 2)),
                s: 0.8 + (i % 5) * 0.1,
              }))
            );
          },
        ],
        [
          'Plus maximum quality',
          () => {
            gameData.engine = gameData.engine || {};
            gameData.engine.defaults = Object.assign({}, eng0 || {}, {
              quality: { resolution: 1.5, shadowMap: 4096, auto: false },
              grass: { density: 3 },
              lens: { bokeh: 2, blur: 1 },
              shadows: { ao: 1.2 },
            });
          },
        ],
      ];
      const drawing = async () => {
        if (!(typeof walkRenderer !== 'undefined' && walkRenderer.on)) return true;
        const f = walkRenderer.frames;
        await selfTestSleep(1500);
        return walkRenderer.frames > f;
      };
      if (!(await drawing())) {
        stress.push({
          name: 'Skipped: the scene isn’t drawing',
          fpsAvg: null,
          fpsWorst: null,
          cpuMs: null,
          slow: 0,
          seconds: 0,
        });
        debugLog.error('test', 'Stress test skipped: the scene isn’t drawing');
        steps.length = 0;
      }
      for (const [name, fn] of steps) {
        if (selfTest.stop) break;
        stepEl.textContent = 'Stress test: ' + name;
        debugLog.bench.step = 'stress: ' + name;
        try {
          fn();
        } catch (e) {}
        await selfTestSleep(800);
        await walkAbout(2); /* new people and props are drawn the first time they appear; measure after that */
        let st = null;
        for (let a = 0; a < 3 && !selfTest.stop; a++) {
          await awake();
          stepEl.textContent = 'Stress test: ' + name;
          const h0 = hid,
            t0 = debugLog.now();
          await walkAbout(5);
          st = selfTestFrameStats(t0, debugLog.now(), 'dio');
          if (hid === h0) break;
          st.notMeasured = a === 2 || undefined;
        } /* v47: measured again after a spell in the background */
        stress.push(Object.assign({ name }, st));
        tick(8);
      }
      sc.folk = folk0;
      sc.props = props0;
      if (gameData.engine) gameData.engine.defaults = eng0;
      walkView.parts.length = 0;
    }
  } finally {
    selfTest.only = only0;
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
    if (activeBattle) {
      stopTimers();
      setActiveBattle(null);
      battleStageStop();
    }
    if (typeof cutscene !== 'undefined' && cutscene.on) {
      cutscene.test = false;
      cutsceneTeardown();
    }
    if (typeof dressingRoom !== 'undefined' && dressingRoom.on) closeDressingRoom();
    if (selfTest.offVis) {
      selfTest.offVis();
      selfTest.offVis = null;
    }
    if (engKeep) gameData.engine = JSON.parse(engKeep);
    setSaveData(JSON.parse(keep));
    setSave(realSave);
    resumeSaving();
    uiState.bench = null;
    uiState.roam = back.roam;
    uiState.tab = back.tab;
    uiState.modal = null;
    uiState.mq = [];
    renderOverlay();
    render();
    selfTest.on = false;
    box.remove();
  }
  const errors = debugLog.err
      .slice(errs0)
      .filter(e => e.kind !== 'test')
      .map(e => e.msg)
      .slice(0, 12),
    okAll = phases.every(p => p.ok) && !errors.length;
  const keepUp = stress.filter(s => s.fpsAvg != null && s.fpsAvg >= 28).pop();
  debugLog.bench.step = null;
  debugLog.bench.result = {
    kind: diag ? 'diagnostics' : 'full',
    diag: diag ? diagnosticsReport : undefined,
    stopped: selfTest.stop,
    seconds: Math.round((debugLog.now() - T0) / 1000),
    passed: okAll,
    phases,
    stress,
    errors,
    device: debugLog.device ? debugLog.device() : null,
  };
  debugLog.add('bench', selfTest.stop ? 'stopped' : okAll ? 'passed' : 'problems found');
  const f = v => (v == null ? '–' : v),
    ctxLine = c =>
      c
        ? [
            c.view,
            c.scene && 'scene ' + c.scene,
            c.renderer,
            (c.errors || [])[0],
            (c.slow || []).slice(-1)[0] && 'slow: ' + (c.slow || []).slice(-1)[0],
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
  const rows = phases
    .map(
      p =>
        `<tr><td>${escapeHtml(p.name)}${p.note ? `<small>${escapeHtml(p.note)}</small>` : ''}${p.detail ? `<small class="nb-det">${escapeHtml(p.detail)}</small>` : ''}${!p.ok ? `<small class="nb-why">Why: ${escapeHtml(p.why || '')}${p.ctx ? `<br>Where: ${escapeHtml(ctxLine(p.ctx))}` : ''}</small>` : ''}</td><td class="tnum">${f(p.fpsAvg)}</td><td class="tnum">${f(p.fpsWorst)}</td><td class="${p.notMeasured ? 'nb-skip' : p.ok ? 'nb-ok' : 'nb-bad'}">${p.notMeasured ? 'Not measured' : p.ok ? 'OK' : 'Problem'}</td></tr>`
    )
    .join('');
  const causes = Object.entries(debugLog.causes)
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 6);
  const srows = stress
    .map(
      s =>
        `<tr><td>${escapeHtml(s.name)}</td><td class="tnum">${f(s.fpsAvg)}</td><td class="tnum">${f(s.fpsWorst)}</td><td class="tnum">${f(s.cpuMs)}</td></tr>`
    )
    .join('');
  modal({
    title: selfTest.stop ? 'Test stopped' : okAll ? 'Everything works' : 'The test found problems',
    html: `<p class="note">Frames per second (higher is smoother; most screens show at most 60).</p>
  <table class="nb-table"><thead><tr><th>What</th><th>Average</th><th>Worst</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nothing was measured.</td></tr>'}</tbody></table>
  ${srows ? `<h3>Stress test</h3><p class="note">${keepUp ? `This device keeps up (28+ frames per second) up to: <b>${escapeHtml(keepUp.name)}</b>.` : 'This device struggled from the first step.'}</p><table class="nb-table"><thead><tr><th>Load</th><th>Average</th><th>Worst</th><th>ms per frame</th></tr></thead><tbody>${srows}</tbody></table>` : ''}
  ${causes.length ? `<h3>What made frames slow</h3><p class="note">Every frame over 33 ms, put down to what the game was busy with at the time.</p><table class="nb-table"><thead><tr><th>Busy with</th><th>Frames</th><th>Worst</th></tr></thead><tbody>${causes.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="tnum">${v.n}</td><td class="tnum">${Math.round(v.max)} ms</td></tr>`).join('')}</tbody></table>` : ''}
  ${errors.length ? `<h3>Errors</h3><ul class="nb-errs">${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}<p class="note">Your save wasn't changed. Export the debug log to send these results with your device's details.</p>`,
    btns: diag
      ? [
          {
            l: 'Save the report',
            c: 'gold',
            f: () => {
              closeModal();
              exportDiagnosticsReport();
            },
          },
          { l: 'Close', c: 'quiet', f: closeModal },
        ]
      : [
          {
            l: 'Export debug log',
            c: 'gold',
            f: () => {
              closeModal();
              exportDebugLog();
            },
          },
          { l: 'Close', c: 'quiet', f: closeModal },
        ],
  });
}
/* test cleanup lane C: the old name, kept only for tools/check-quick.py's in-game test step until it calls runFullTest */
expose({ runQuickTest: [() => runFullTest] });

/* ================= DIAGNOSTICS TEST (alpha 0.4) =================
   Next to the full test in Settings, about two minutes: the device and how the automatic quality chose its level, the hub
   and its busiest room (time to the first frame and the worst frame), a run's road (a scene made from a seed, walked
   over a seam), where a frame's time goes, memory after,
   a battle's start, what rain and night cost, and any errors. It saves a compact report made to be read (not the whole
   debug log). Like the full test it leaves your save alone and waits for you if the app goes to the background. */
const emptyDiagnosticsReport = () => ({ device: null, busiest: null, places: [], passes: null, weather: null });
let diagnosticsReport = emptyDiagnosticsReport();
function runDiagnostics() {
  return runFullTest('diag');
}
/** test cleanup lane C: the walk scenes the game reaches: the hub, then each room a door opens, the hub's own doors
 * first, then the rooms a run town's buildings open (logic/mapgen.js MAPGEN_HUB_BUILDINGS). Worked out from the door
 * links (data-files.js doorRooms), so a room no door leads to is never walked @returns {string[]} */
function selfTestWalkScenes() {
  const sc = gameData.maps || {},
    P = (gameData.scenery && gameData.scenery.props) || {},
    hub = (LOCATIONS[START_NODE] || {}).mapId,
    out = [],
    add = id => {
      if (id && mapById(id) && !out.includes(id)) out.push(id);
    },
    roomOf = (p, act) => PB_DATA.doorRooms(p, p && P[p.k], act).find(id => sc[id] && sc[id].kind === 'room');
  add(hub);
  for (const p of (sc[hub] && sc[hub].props) || []) if (PB_DATA.opensRoom(p.act)) add(roomOf(p, p.act));
  for (const [, , act] of MAPGEN_HUB_BUILDINGS) if (PB_DATA.opensRoom(act)) add(roomOf(null, act));
  return out;
}
/* the diagnostics' walk: the hub and its busiest room (a run's generated scene is the "A run's road" phase) */
function diagnosticsMaps() {
  const sc = gameData.maps,
    [hub, ...rooms] = selfTestWalkScenes(),
    room = rooms.slice().sort((a, b) => (sc[b].props || []).length - (sc[a].props || []).length)[0],
    pick = [hub, room].filter(Boolean);
  diagnosticsReport.busiest = hub;
  diagnosticsReport.places = pick;
  return pick;
}
/* timers round the render passes: the processor's time for each, and the graphics chip's own (EXT_disjoint_timer_query_webgl2) */
const DIAGNOSTICS_PASSES = {
  shadows: ['shadowPass'],
  ground: ['drawGround'],
  grass: ['drawGrass'],
  props: [
    'drawSprites',
    'drawSolidProps',
    'drawPropModels',
    'drawBuildings',
    'drawBoxFaces',
    'drawStructures',
    'drawPlayerSilhouette',
  ],
  water: ['reflectionPass', 'drawWater'],
  effects: ['effectsPass'],
  /* CAM-3: the blur timed on its own; "final pass" is the rest of the post chain (both run inside drawPostEffects, one
     after the other, so the graphics chip's timers never nest) */
  blur: ['drawDepthOfField'],
  'final pass': ['drawPostRest'],
};
export function diagnosticsTimersOn() {
  const gl = typeof gpuState !== 'undefined' ? gpuState.gl : null,
    ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    T = {
      gl,
      ext,
      orig: {},
      cpu: {},
      q: [],
      active: false,
      f0: typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0,
    };
  /* phase 20: every frame's graphics calls are counted while the timers run (engine/gpu-counters.js) */
  gpuCountBegin();
  for (const [grp, names] of Object.entries(DIAGNOSTICS_PASSES)) {
    T.cpu[grp] = 0;
    for (const n of names) {
      // phase 05: through the debug log's view of the modules (window has them only with the test globals on)
      const o = GAME[n];
      if (typeof o !== 'function') continue;
      T.orig[n] = o;
      GAME[n] = function (...a) {
        const t0 = performance.now();
        let q = null;
        if (T.ext && !T.active) {
          try {
            q = gl.createQuery();
            gl.beginQuery(T.ext.TIME_ELAPSED_EXT, q);
            T.active = true;
          } catch (e) {
            q = null;
          }
        }
        try {
          return o.apply(this, a);
        } finally {
          if (q) {
            gl.endQuery(T.ext.TIME_ELAPSED_EXT);
            T.active = false;
            T.q.push([grp, q]);
          }
          T.cpu[grp] += performance.now() - t0;
        }
      };
    }
  }
  return T;
}
export async function diagnosticsTimersOff(T) {
  for (const [n, o] of Object.entries(T.orig)) GAME[n] = o;
  const calls = gpuCountEnd();
  const frames = Math.max(1, (typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0) - T.f0),
    cpu = {};
  for (const [k, v] of Object.entries(T.cpu)) if (v > 0) cpu[k] = Math.round((v / frames) * 100) / 100;
  let gpu = null;
  if (T.ext && T.q.length) {
    await selfTestSleep(400);
    const sum = {};
    let ok = 0;
    const disj = T.gl.getParameter(T.ext.GPU_DISJOINT_EXT);
    for (const [g, q] of T.q) {
      if (T.gl.getQueryParameter(q, T.gl.QUERY_RESULT_AVAILABLE)) {
        sum[g] = (sum[g] || 0) + T.gl.getQueryParameter(q, T.gl.QUERY_RESULT) / 1e6;
        ok++;
      }
      T.gl.deleteQuery(q);
    }
    if (ok && !disj) {
      gpu = {};
      const per = ok / Object.keys(sum).length;
      for (const [k, v] of Object.entries(sum)) gpu[k] = Math.round((v / Math.max(1, frames)) * 100) / 100;
    }
  }
  return { frames, cpu, gpu, calls };
}
/* the report: what was measured, short, made to be read */
function diagnosticsSummary() {
  const R = debugLog.bench && debugLog.bench.result;
  if (!R) return null;
  const P = R.phases || [];
  const pl = P.filter(p => p.name.startsWith('Walk: ')).map(p => ({
    place: p.name.slice(6),
    opened: p.note,
    fps: p.fpsAvg,
    worstFps: p.fpsWorst,
    worstFrameMs: p.worstFrameMs || null,
    openHitchMs: p.openHitchMs || null,
    openHitchCause: p.openHitchCause || null,
    slow: p.slowCauses,
    ok: p.ok,
    why: p.why,
  }));
  const one = n => {
    const p = P.find(q => q.name.startsWith(n));
    return p
      ? {
          note: p.note,
          detail: p.detail,
          ok: p.ok,
          why: p.why,
          fps: p.fpsAvg,
          worstFps: p.fpsWorst,
          worstFrameMs: p.worstFrameMs || null,
        }
      : null;
  };
  return {
    game: 'Pocket Billies',
    kind: 'diagnostics',
    /* format 2: a place's fps and slow frames count from once it is open, its opening hitch is apart; the first and
       last second of the other steps are left out */
    format: 2,
    build: typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : null,
    created: new Date().toISOString(),
    seconds: R.seconds,
    passed: R.passed,
    device: (R.diag || diagnosticsReport).device,
    places: pl,
    frame: (R.diag || diagnosticsReport).passes,
    rainAndNight: (R.diag || diagnosticsReport).weather,
    battle: one('Battle on the 3D stage'),
    worldMap: one('World map'),
    memory: one('Memory'),
    errors: R.errors,
  };
}
async function exportDiagnosticsReport() {
  const r = diagnosticsSummary();
  if (!r) {
    toast('Run the diagnostics test first.');
    return;
  }
  const d = new Date(),
    pad = n => String(n).padStart(2, '0');
  return shareReportFile(
    JSON.stringify(r, null, 1),
    `pocket-billies-diagnostics-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`,
    'Pocket Billies diagnostics'
  );
}
/* a test's report: shared on a phone, saved to the downloads elsewhere, copied as the last resort */
export async function shareReportFile(data, name, title) {
  if (typeof debugLog !== 'undefined') debugLog.add('export', name);
  try {
    const f = new File([data], name, { type: 'application/json' });
    if (
      navigator.canShare &&
      navigator.canShare({ files: [f] }) &&
      /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
    ) {
      await navigator.share({ files: [f], title });
      toast('Report shared.');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Report saved to your downloads.');
    return;
  } catch (e) {}
  try {
    await navigator.clipboard.writeText(data);
    toast('The report was copied. Paste it into a text file.');
  } catch (e) {
    toast('This browser can’t save files here.');
  }
}
