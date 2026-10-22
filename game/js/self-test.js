'use strict';
/* ================= FULL TEST =================
   Settings → Run the full test (and the debug menu) plays through everything that draws, for several minutes:
   every walk scene and room (walking, turning and zooming the camera), night, weather and seasons, a road between two
   places, a room that opens in place, the light lab, a battle on the 3D stage (double and Alpha
   too), the opening's fall and Blake's first battle, Billies in the world, the world map and its 3D miniatures, then a
   stress test that keeps adding load (crowds, particles, extra props, maximum quality) and measures how far the device
   keeps up. Your save is not changed: saving is paused and everything is put back
   afterwards. The results go into the debug log. If the app goes to the background (the screen locks), the test waits
   for you and runs that step again. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import {
  LOCATIONS,
  MOVES,
  RULES,
  SPECIES,
  START_NODE,
  TRAINERS,
  UNLOCK_DATA,
  gameData,
  locationKind,
  trainersAt,
  worldExtraMaps,
} from './game-data.js';
import { encountersHere, makeBilly, maxHp, spawn } from './logic/rules.js';
import { ranchLevel, ranchSlots, ranchTrainStart } from './logic/ranch.js';
import { runBegin, runRestore } from './logic/run-state.js';
import { runArrive, runMapStart, runNext, runWorldNode } from './logic/run-map.js';
import { MAPGEN_VERSION } from './logic/mapgen.js';
import { runHealCost } from './logic/run-loop.js';
import { fighter, liveActors, startTrainer, startWild } from './logic/battle-engine.js';
import { runUnlocks } from './logic/unlocks.js';
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
import { frameScheduler } from './frame-scheduler.js';
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
import { WORLD_BOWL_SHADERS, worldBowl, worldMap, worldMapReset } from './world-bowl.js';
import { talkBox, talkHide } from './talk.js';
import { cutscene, cutsceneTeardown } from './cutscene/director.js';
import { fallOverWorldMap, fallWorldMapCanvas } from './opening-fall.js';
import { airshipFlight } from './airship.js';
import { runWorld, runWorldData, runWorldSync } from './run-world.js';
import { runJump, runTakeOff } from './run.js';
import { ranchOpen } from './ranch-screen.js';
import { labBuy, labMilestones, renderLabBoard } from './lab-board.js';
import { closeModal, modal, renderOverlay, toast } from './overlay.js';
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
  runFullTest: [() => runFullTest, v => (runFullTest = v)],
  runQuickTest: [() => runQuickTest],
  selfTest: [() => selfTest],
  selfTestFrameStats: [() => selfTestFrameStats, v => (selfTestFrameStats = v)],
  selfTestSleep: [() => selfTestSleep, v => (selfTestSleep = v)],
  shareReportFile: [() => shareReportFile, v => (shareReportFile = v)],
  testMapChecks: [() => testMapChecks, v => ((testMapChecks = v), provide({ testMapChecks }))],
  testMaps: [() => testMaps, v => ((testMaps = v), provide({ testMaps }))],
});
/* eslint-enable no-func-assign */
provide({ runDiagnostics, testMapChecks, testMaps });
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
      const got = !far(findPath(c.from[0], c.from[1], c.to[0], c.to[1], c.noHop ? { noHop: true } : {}), c.to);
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
  /* RL-7: not a run's scenes (made from its seed while its world is in; a run's road has a phase of its own) */
  const scenes = Object.keys(gameData.maps || {}).filter(
      id =>
        mapById(id) &&
        !gameData.maps[id].test &&
        !gameData.maps[id].backup &&
        !id.includes('@') &&
        !worldExtraMaps()[id]
    ),
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
      'Device',
      'Frame budget',
      'Rain and night',
      'Battle on the 3D stage',
      'Memory',
    ];
  }
  const total = diag
    ? scenes.length * 4 + 1 + 1 + 6 + 10 + 6 + 1
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
            why: ev,
          };
          return `${String(g.renderer || g.gpu || 'graphics unknown').slice(0, 60)} · resolution ×${diagnosticsReport.device.resolution ?? '?'} · quality level ${diagnosticsReport.device.level ?? '?'}${ev.length ? ' · ' + ev.slice(-1)[0] : ''}`;
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
            await selfTestSleep(900);
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
            runBegin(s, { seed: 'SELFTESTRUN', tier: 1, mapgenV: MAPGEN_VERSION, se: 300 });
            runMapStart(s.run, data);
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
            for (let i = 0; i < 150 && !(walkView.ready && walkView.id === next); i++) await selfTestSleep(100);
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
    /* RL-8: a run from the mast to the payout, on a copy of the save (nothing is written while the test runs): a short
       run (5 rows) taken off from Copperleaf, the airship's flight to the landing, a wild battle there, "Go there" to
       the town (a paid heal), to the boss (an Alpha) and its payout, then home: Copperleaf without the run. Then the
       save as it was */
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
            runTakeOff('SELFTESTRUN8', { rows: 5, minibosses: 1 });
            if (!saveData.run || !(await wait(() => airshipFlight.on, 5000)))
              throw new Error('the run didn’t take off');
            const made = [runWorld.scenes, runWorld.ms],
              t0 = performance.now();
            if (!(await wait(() => !airshipFlight.on && saveData.run.at.phase === 'walk', 20000)))
              throw new Error('the flight never landed');
            const flew = Math.round(performance.now() - t0),
              landing = 'w:' + LOCATIONS[1].mapId + '*';
            if (!(await wait(() => walkView.ready && walkView.id === landing, 15000)))
              throw new Error(`landed but the view is ${walkView.id}`);
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
              cost = runHealCost(saveData.team, RULES.run.healCost).cost;
            clinicHeal();
            if (!uiState.modal || !uiState.modal.btns) throw new Error('the clinic asked nothing');
            uiState.modal.btns[0].f();
            if (saveData.se !== se - cost) throw new Error(`the clinic took $${se - saveData.se}, not $${cost}`);
            const boss = map.nodes.length;
            runJump(boss);
            const B = trainersAt(boss)[0];
            if (!B || !B.alpha) throw new Error('no Alpha boss on the boss’s place');
            uiState.modal = null;
            uiState.mq = [];
            startTrainer(B.id, { talked: true });
            if (!activeBattle || activeBattle.fmt !== 'alpha') throw new Error('the boss isn’t an Alpha battle');
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
            return `${made[0]} scenes made in ${made[1]} ms; flew in ${flew} ms; a battle, a heal for $${cost}, the boss; home with ${saveData.meta.capital} Capital`;
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
            return `the barn leads into ${rooms.find(id => mapById(id))}; trained a level for ${R.trainCost} Scrap; Stop ended it`;
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
       every row of unlocks.json; a board row bought pays its Capital; the ranch's upgrade raises its level and slots;
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
              capital: 1000,
              scrap: 200,
              seals: 0,
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
              document.querySelector('.s-lab [data-a=lab-buy][data-k=shop_settlement]')
            );
            if (!buy) throw new Error('no Buy on Nerve Tonic');
            buy.click();
            if (!s.meta.unlocks.shop_settlement || s.meta.capital !== 1000 - D.unlocks.shop_settlement.cost)
              throw new Error(`buying Nerve Tonic left ${s.meta.capital} Capital`);
            if (!labBuy('ranch_2') || ranchLevel(s) !== 2 || ranchSlots(s, RULES.ranch) !== RULES.ranch.slots[1])
              throw new Error('the ranch’s upgrade didn’t raise its level and slots');
            const got = labMilestones();
            if (!got.includes('first_run') || labMilestones().length)
              throw new Error('the first milestone: ' + got.join());
            if (!runUnlocks(s, D).includes('shop_settlement')) throw new Error('a run wouldn’t carry the shop unlock');
            return `${rows} rows; bought Nerve Tonic for ${D.unlocks.shop_settlement.cost} Capital and Ranch Lv 2; milestone ${got.join(', ')}`;
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
    /* v46: a room that opens in place: into a building and out again, without leaving the town (RL-5: Professor Hazel's
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
              dx = I && I.at ? Math.abs(ex[0] - I.at[0]) : 9,
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
            if (pd > 0.01 || P.dir !== 'down')
              throw new Error(`out at ${pd.toFixed(2)} m from the door, facing ${P.dir}`);
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
              const seen = (sc.props || []).filter(inView),
                wantB = seen.filter(pp => C0[pp.k] && C0[pp.k].build).length,
                wantV = seen.filter(pp => C0[pp.k] && C0[pp.k].model && pp.model !== 'card').length;
              if (id === 'test_light_props' && (b < wantB || v < wantV || !wantB))
                throw new Error(
                  `props in view: ${b} of ${wantB} buildings and ${v} of ${wantV} voxel props drawn (${p} solid props)`
                );
              if (id === 'test_light_room' && t === 23 && !lm)
                throw new Error('no lamp shadow map in the room at night');
              out.push(
                `${(sc.name || id).replace(/^Test: /, '')} ${Math.floor(t)}:${t % 1 ? String(Math.round((t % 1) * 60)).padStart(2, '0') : '00'} — ${b} buildings, ${v} voxels, ${p} solids drawn (${seen.length} placed things in view), ${lm} lamp map(s)`
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
            f0 = worldBowl.frames;
          let last = performance.now(),
            seen = f0;
          /* phase 10: frames counted as the bowl draws them (worldBowlFilm) */
          const watch = setInterval(() => {
            if (worldBowl.frames !== seen) {
              const n = performance.now();
              fr.push(n - last);
              last = n;
              seen = worldBowl.frames;
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
        uiState.tab = 'map';
        render();
        await selfTestSleep(3000);
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
        return `the bowl drew ${n} frames turning round and coming back`;
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
            const pool = ['tree_oak', 'tree_pine', 'tree_birch', 'boulder', 'bush_round', 'tree_oak_deep'].filter(
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
const runQuickTest = runFullTest;
provide({ runQuickTest }); /* to-module */

/* ================= DIAGNOSTICS TEST (alpha 0.4) =================
   Next to the full test in Settings, about two minutes: the device and how the automatic quality chose its level, six
   places picked from the data to cover the hardest cases (the busiest town, the biggest route, a room, a cave, a place
   you ride across, a new place: time to the first frame and the worst frame), where a frame's time goes, memory after,
   a battle's start, what rain and night cost, and any errors. It saves a compact report made to be read (not the whole
   debug log). Like the full test it leaves your save alone and waits for you if the app goes to the background. */
const emptyDiagnosticsReport = () => ({ device: null, busiest: null, places: [], passes: null, weather: null });
let diagnosticsReport = emptyDiagnosticsReport();
function runDiagnostics() {
  return runFullTest('diag');
}
function diagnosticsMaps() {
  const sc = gameData.maps,
    ids = Object.keys(sc).filter(id => mapById(id) && !sc[id].test && !sc[id].backup && !id.includes('@')),
    pick = [],
    add = id => {
      if (id && !pick.includes(id)) pick.push(id);
    };
  const kindOf = id => sc[id].kind || (typeof locationKind === 'function' ? locationKind(id) : null);
  const towns = ids.filter(id => kindOf(id) === 'town'),
    routes = ids.filter(id => kindOf(id) === 'route');
  const busiest = towns.slice().sort((a, b) => (sc[b].props || []).length - (sc[a].props || []).length)[0];
  add(busiest);
  add(routes.slice().sort((a, b) => sc[b].w * sc[b].h - sc[a].w * sc[a].h)[0]);
  add(ids.find(id => /^int_/.test(id) && (sc[id].props || []).length > 8));
  add(ids.find(id => (sc[id].under || sc[id].far === 'cave') && kindOf(id) !== 'room'));
  add(ids.find(id => sc[id].ride));
  add(ids.find(id => sc[id].a04pearl) || ids.find(id => sc[id].a04place));
  diagnosticsReport.busiest = busiest;
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
  'final pass': ['drawPostEffects'],
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
