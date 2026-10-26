'use strict';
/* ================= GRAPHICS TEST =================
   Settings → Help → "Run the graphics test" (and the debug menu): what each graphics setting costs on this device. It
   goes round the Graphics bench (test_graphics, docs/graphics-bench.md), and at each station steps the settings that
   station is built for through a few values while everything else holds still: automatic quality off, the resolution
   pinned, the time of day and the weather forced, the camera on the station's spot. Each step settles, then is
   measured for 3 s: frames per second, the processor's time per frame and the graphics chip's own time where it has
   timers. Like the full test it saves nothing and puts your settings back. Only players run it: in a headless browser
   the scenes are drawn in software and its numbers mean nothing (the checks only build its step list). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { loadAllMaps } from './map-files.js';
import {
  activeBattle,
  escapeHtml,
  pauseSaving,
  resumeSaving,
  save,
  saveData,
  setSave,
  setSaveData,
  uiState,
} from './game-state.js';
import { frameScheduler, userFps } from './frame-scheduler.js';
import { GRAPHICS_DIALS } from './settings-screen.js';
import { mapById, mapHub, walkView } from './walk-view.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { rebuildFromSettings } from './walk/map-cache.js';
import { paintWorkerState } from './ground-paint-worker.js';
import { closeModal, modal, renderOverlay, toast } from './overlay.js';
import { render } from './ui.js';
import {
  diagnosticsTimersOff,
  diagnosticsTimersOn,
  selfTest,
  selfTestFrameStats,
  selfTestSleep,
  shareReportFile,
} from './self-test.js';
/* eslint-disable no-func-assign */
expose({
  GRAPHICS_TEST_HIDDEN: [() => GRAPHICS_TEST_HIDDEN],
  GRAPHICS_TEST_MAP: [() => GRAPHICS_TEST_MAP],
  GRAPHICS_TEST_STATIONS: [() => GRAPHICS_TEST_STATIONS],
  exportGraphicsReport: [() => exportGraphicsReport, v => (exportGraphicsReport = v)],
  graphicsTest: [() => graphicsTest],
  graphicsTestCosts: [() => graphicsTestCosts, v => (graphicsTestCosts = v)],
  graphicsTestDials: [() => graphicsTestDials, v => (graphicsTestDials = v)],
  graphicsTestDrift: [() => graphicsTestDrift, v => (graphicsTestDrift = v)],
  graphicsTestFrameMs: [() => graphicsTestFrameMs],
  graphicsTestMeasure: [() => graphicsTestMeasure, v => (graphicsTestMeasure = v)],
  graphicsTestNoise: [() => graphicsTestNoise, v => (graphicsTestNoise = v)],
  graphicsTestOpen: [() => graphicsTestOpen],
  graphicsTestPlan: [() => graphicsTestPlan, v => (graphicsTestPlan = v)],
  graphicsTestPrefs: [() => graphicsTestPrefs, v => (graphicsTestPrefs = v)],
  graphicsTestReport: [() => graphicsTestReport, v => (graphicsTestReport = v)],
  graphicsTestSettle: [() => graphicsTestSettle, v => (graphicsTestSettle = v)],
  graphicsTestShow: [() => graphicsTestShow, v => (graphicsTestShow = v)],
  graphicsTestStand: [() => graphicsTestStand, v => (graphicsTestStand = v)],
  graphicsTestValue: [() => graphicsTestValue],
  runGraphicsBench: [() => runGraphicsBench, v => ((runGraphicsBench = v), provide({ runGraphicsBench }))],
});
/* eslint-enable no-func-assign */
provide({ runGraphicsBench });
/* to-module: end */
/* the hidden settings it measures besides the Expert dials: [group.key, label, values or [min, max, step], rebuild] */
const GRAPHICS_TEST_HIDDEN = [
  ['quality.shadowMap', 'Shadow detail', { values: [1024, 2048, 4096] }],
  ['shadows.cascades', 'Near shadow map', { values: [false, true] }],
  ['shadows.ao', 'Ambient occlusion', { range: [0, 1.5, 0.05] }],
  ['shadows.contact', 'Contact shadows', { range: [0, 1, 0.01] }],
  /* water track WA-1: pixel water's extra shore reads and steps */
  ['water.pixel', 'Pixel water', { values: [false, true] }],
  /* phase 20 C5: the same look when standing still, so left out of "everything lowest / highest"; how many lamps light
     the scene (8 is the phone limit stage D6 may take) */
  ['quality.stableLights', 'Steady lamps', { values: [false, true], alone: true }],
  ['quality.lights', 'Lamps lit at once', { values: [8, 16], alone: true }],
  /* phase 20 R2: the models drawn one draw per mesh; the same look, so left out of "everything lowest / highest" */
  ['quality.modelInstances', 'Models in batches', { values: [false, true], alone: true }],
  /* phase 20 R2 (pixels): each on its own, out of "everything lowest / highest" (Phone pixel budget is not here: the
     test pins resolution 1, under the phone's budget either way; the diagnostics' Renderer baseline measures it) */
  ['quality.skyLast', 'Sky last', { values: [false, true], alone: true }],
  ['quality.solidFirst', 'Solid things first', { values: [false, true], alone: true }],
  ['quality.invalidate', 'Drop spent pictures', { values: [false, true], alone: true }],
  ['quality.phoneLamps', 'Phone lamps', { values: [false, true], alone: true }],
  ['quality.rainBatch', 'Rain in one go', { values: [false, true], alone: true }],
  ['air.cheapShafts', 'Cheap light shafts', { values: [0, 0.6], alone: true }],
];
/* the stations, in the order the test walks them; their spots are the map's `bench` ([x, z, camera turn, zoom]) */
const GRAPHICS_TEST_STATIONS = [
  {
    id: 'control',
    name: 'Control pad',
    dials: ['quality.resolution', 'lens.vignette', 'lens.grain', 'quality.invalidate'],
  },
  {
    id: 'shadows',
    name: 'Shadow court',
    sun: { angle: 30, height: 30 },
    dials: ['shadows.strength', 'quality.shadowMap', 'shadows.cascades', 'shadows.ao', 'shadows.contact'],
  },
  { id: 'pond', name: 'Pond', dials: ['water.reflection', 'water.pixel'] },
  {
    id: 'sun',
    name: 'Sun gap',
    sun: { angle: -90, height: 18 },
    dials: ['air.godRays', 'quality.solidFirst', 'quality.skyLast'],
  },
  /* phase 20 R2 (D7): the Sun gap with God rays off, where the cheap shafts stand in (a station may borrow another's
     spot, and fix values of its own under every step) */
  {
    id: 'shafts',
    name: 'Sun gap, no god rays',
    spot: 'sun',
    sun: { angle: -90, height: 18 },
    fixed: { 'air.godRays': 0 },
    dials: ['air.cheapShafts'],
  },
  {
    id: 'lamps',
    name: 'Lamp square',
    time: 22,
    dials: [
      'color.bloom',
      'lights.brightness',
      'quality.stableLights',
      'quality.lights',
      'quality.modelInstances',
      'quality.phoneLamps',
      'quality.invalidate',
    ],
  },
  { id: 'meadow', name: 'Meadow', dials: ['grass.density', 'air.particles', 'air.mist'] },
  {
    id: 'depth',
    name: 'Depth corridor',
    dials: ['lens.blur', 'world.farProps', 'quality.stableLights', 'quality.modelInstances'],
  },
  { id: 'sky', name: 'Open sky', dials: ['sun.clouds', 'sun.cloudShadows', 'quality.skyLast'] },
  /* phase 20 R2: the meadow in the rain (a station may name its weather; clear otherwise) */
  { id: 'rain', name: 'Meadow in the rain', spot: 'meadow', weather: 'rain', dials: ['quality.rainBatch'] },
  { id: 'everything', name: 'Everything', all: true },
];
const GRAPHICS_TEST_MAP = 'test_graphics';
const graphicsTest = { on: false, stop: false, result: null };

/* every setting the test measures: { key, label, values, rebuild } */
function graphicsTestDials() {
  const out = [];
  const steps = (min, max, step) => {
    const r = v => Math.round(Math.round(v / step) * step * 1000) / 1000;
    return [...new Set([0, 0.25, 0.5, 0.75, 1].map(f => r(min + (max - min) * f)))];
  };
  for (const [, L] of GRAPHICS_DIALS)
    for (const [key, label, , , min, max, step, rebuild] of L)
      out.push({ key, label, values: steps(min, max, step), rebuild: !!rebuild });
  for (const [key, label, o] of GRAPHICS_TEST_HIDDEN)
    out.push({ key, label, values: o.values || steps(...o.range), rebuild: false, alone: !!o.alone });
  return out;
}
/* the whole run as a list of steps (the checks build this without running it) */
function graphicsTestPlan() {
  const D = graphicsTestDials(),
    byKey = Object.fromEntries(D.map(d => [d.key, d])),
    plan = [];
  for (const st of GRAPHICS_TEST_STATIONS) {
    plan.push({ station: st.id, kind: 'base', label: 'as it is' });
    if (st.all)
      for (const [label, end] of [
        ['everything lowest', 0],
        ['everything highest', 1],
      ])
        plan.push({
          station: st.id,
          kind: 'all',
          label,
          set: Object.fromEntries(
            D.filter(d => !d.alone).map(d => [d.key, end ? d.values[d.values.length - 1] : d.values[0]])
          ),
          rebuild: true,
        });
    const dials = (st.dials || []).filter(k => byKey[k]);
    for (const [i, k] of dials.entries()) {
      const d = byKey[k];
      /* the untouched look once more halfway through, so first, middle and last show how much the station wanders */
      if (dials.length > 1 && i === Math.ceil(dials.length / 2))
        plan.push({ station: st.id, kind: 'base', label: 'as it is, midway' });
      for (const v of d.values)
        plan.push({
          station: st.id,
          kind: 'dial',
          key: k,
          label: d.label,
          value: v,
          set: { [k]: v },
          rebuild: d.rebuild,
        });
    }
    plan.push({ station: st.id, kind: 'base', label: 'as it is, again' });
  }
  return plan;
}

/* the player's settings for one step: the game's own values, pinned, with the station's light and the step's value */
function graphicsTestPrefs(st, set) {
  const eng = { quality: { auto: false, resolution: 1 } };
  if (st.sun) eng.sun = Object.assign({}, st.sun);
  for (const [gk, v] of Object.entries({ ...(st.fixed || {}), ...(set || {}) })) {
    const [g, k] = gk.split('.');
    (eng[g] = eng[g] || {})[k] = v;
  }
  saveData.preferences.expert = true;
  saveData.preferences.eng = eng;
}
function graphicsTestStand(sc, st) {
  const at = (sc.bench || {})[st.spot || st.id] || [...mapHub(sc), 0, 1],
    o = (walkView.sc && walkView.sc.baseOff) || [0, 0];
  walkView.pl.x = at[0] + o[0];
  walkView.pl.z = at[1] + o[1];
  walkView.pl.route = null;
  walkView.pl.fresh = false;
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.yawT = at[2] || 0;
    walkRenderer.zoomT = at[3] || 1;
  }
}
const graphicsTestOpen = () =>
  walkView.ready && (walkView.id === GRAPHICS_TEST_MAP || (walkView.sc && walkView.sc.baseId === GRAPHICS_TEST_MAP));

async function runGraphicsBench() {
  if (graphicsTest.on || selfTest.on) return;
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
  graphicsTest.on = true;
  graphicsTest.stop = false;
  selfTest.on = true; /* the full test's guards (friends, saving, pop-ups) hold for this test too */
  pauseSaving();
  try {
    await loadAllMaps();
  } catch (e) {
    graphicsTest.on = false;
    selfTest.on = false;
    resumeSaving();
    throw e;
  }
  const sc = mapById(GRAPHICS_TEST_MAP);
  if (!sc) {
    graphicsTest.on = false;
    selfTest.on = false;
    resumeSaving();
    toast('The Graphics bench isn’t in this build.');
    return;
  }
  const keep = JSON.stringify(saveData),
    back = { tab: uiState.tab, roam: uiState.roam },
    realSave = save,
    force0 = environment.force,
    T0 = debugLog.now(),
    errs0 = debugLog.err.length;
  setSave(() => {});
  const plan = graphicsTestPlan(),
    steps = [];
  const box = document.createElement('div');
  box.className = 'nw-bench px glass';
  box.innerHTML =
    '<b>Graphics test</b><span class="nb-step">Getting ready…</span><span class="nb-bar"><i></i></span><button class="pb small quiet" type="button">Stop</button>';
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => {
    graphicsTest.stop = true;
  };
  const stepEl = box.querySelector('.nb-step'),
    bar = box.querySelector('.nb-bar i');
  let hid = 0,
    wl = null;
  const wake = async () => {
    try {
      if (navigator.wakeLock && !document.hidden) wl = await navigator.wakeLock.request('screen');
    } catch (e) {
      wl = null;
    }
  };
  const onVis = () => {
    if (document.hidden) hid++;
    else wake();
  };
  document.addEventListener('visibilitychange', onVis);
  wake();
  debugLog.add('bench', 'graphics test start');
  debugLog.bench = { step: 'graphics test', result: null };
  try {
    uiState.tab = 'walk';
    uiState.bench = { id: GRAPHICS_TEST_MAP, test: 1 };
    render();
    for (let i = 0; i < 200 && !graphicsTestOpen() && !graphicsTest.stop; i++) await selfTestSleep(100);
    if (!graphicsTestOpen()) throw new Error('the Graphics bench didn’t open');
    let done = 0;
    for (const st of GRAPHICS_TEST_STATIONS) {
      if (graphicsTest.stop) break;
      const mine = plan.filter(p => p.station === st.id);
      /* a station is measured whole: if the app went to the background during it, it runs again (twice more at most) */
      for (let attempt = 0; attempt < 3; attempt++) {
        while (document.hidden && !graphicsTest.stop) {
          stepEl.textContent = 'Paused while the app is in the background';
          await selfTestSleep(300);
        }
        const h0 = hid,
          got = [];
        environment.force = { time: st.time || 14, weather: st.weather || 'clear', season: 'summer' };
        let rebuilt = false;
        for (const p of mine) {
          if (graphicsTest.stop) break;
          stepEl.textContent = `${st.name}: ${p.kind === 'dial' ? `${p.label} ${graphicsTestValue(p.value)}` : p.label}`;
          graphicsTestPrefs(st, p.set);
          /* a rebuild before this step, and back after a step that rebuilt, so the ground and grass match */
          const rb = p.rebuild || rebuilt;
          rebuilt = !!p.rebuild;
          if (rb) rebuildFromSettings();
          graphicsTestStand(sc, st);
          const t1 = performance.now();
          await selfTestSleep(1000);
          /* a station's first step and every step that rebuilt wait until the place is ready and frames hold steady:
             a first look came out slow while the new spot's ground was still painting, and so did the step after a
             rebuild (the rebuild back) */
          if (rb || p === mine[0]) await graphicsTestSettle(sc, st, rb ? 12 : 10);
          graphicsTestStand(sc, st);
          const m = await graphicsTestMeasure(3);
          got.push(
            Object.assign({ station: st.id }, p, { set: undefined, settleMs: Math.round(performance.now() - t1) }, m)
          );
          bar.style.width = Math.min(100, ((done + got.length) / plan.length) * 100) + '%';
        }
        if (hid === h0 || attempt === 2 || graphicsTest.stop) {
          if (hid !== h0) for (const g of got) g.notMeasured = true;
          steps.push(...got);
          done += mine.length;
          break;
        }
        debugLog.add('bench', st.name + ': the app went to the background, measuring the station again');
      }
    }
  } catch (e) {
    debugLog.error('test', 'graphics test: ' + String((e && e.message) || e).slice(0, 200), e && e.stack);
  } finally {
    document.removeEventListener('visibilitychange', onVis);
    try {
      if (wl) wl.release();
    } catch (e) {}
    environment.force = force0;
    setSaveData(JSON.parse(keep));
    setSave(realSave);
    resumeSaving();
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.yawT = 0;
      walkRenderer.zoomT = 1;
    }
    uiState.bench = null;
    uiState.roam = back.roam;
    uiState.tab = back.tab;
    uiState.modal = null;
    uiState.mq = [];
    renderOverlay();
    render();
    rebuildFromSettings();
    selfTest.on = false;
    graphicsTest.on = false;
    box.remove();
  }
  const errors = debugLog.err
    .slice(errs0)
    .filter(e => e.kind !== 'test' || /graphics test/.test(e.msg))
    .map(e => e.msg)
    .slice(0, 12);
  graphicsTest.result = {
    stopped: graphicsTest.stop,
    seconds: Math.round((debugLog.now() - T0) / 1000),
    fpsCap: typeof userFps === 'function' ? userFps() : null,
    steps,
    settings: graphicsTestCosts(steps),
    drift: graphicsTestDrift(steps),
    noise: graphicsTestNoise(steps),
    errors,
  };
  debugLog.bench.step = null;
  debugLog.add('bench', graphicsTest.stop ? 'graphics test stopped' : 'graphics test done');
  graphicsTestShow();
}
/* waits until the place is ready to measure: nothing left to prepare, plant (the grass) or paint (the ground's helper
   thread included),
   then two whole seconds in a row whose frame times agree within 10 %; `sec` seconds at most in all */
async function graphicsTestSettle(sc, st, sec) {
  const t0 = performance.now(),
    left = () => sec * 1000 - (performance.now() - t0),
    busy = () =>
      !graphicsTestOpen() ||
      !!(typeof walkRenderer !== 'undefined' && (walkRenderer.prep || walkRenderer.grassJob)) ||
      !!(typeof paintWorkerState !== 'undefined' && paintWorkerState && paintWorkerState.jobs.size);
  while (busy() && left() > 0 && !graphicsTest.stop) await selfTestSleep(100);
  graphicsTestStand(sc, st);
  const a = debugLog.now();
  while (left() > 0 && !graphicsTest.stop) {
    await selfTestSleep(250);
    const S = debugLog.samples
      .filter(s => s.t - (s.dt || 1000) >= a && s.tasks.dio && s.tasks.dio.fps)
      .map(s => 1000 / s.tasks.dio.fps);
    if (S.length < 2 || busy()) continue;
    const [x, y] = S.slice(-2);
    if (Math.abs(x - y) <= Math.max(0.5, y * 0.1)) break;
  }
  return Math.round(performance.now() - t0);
}
/* one measurement with the camera still: fps and the processor's time per frame from the debug log's seconds, the
   graphics chip's time per frame from its own timers round the render passes (where the chip has them) */
async function graphicsTestMeasure(sec) {
  const t0 = debugLog.now(),
    T = diagnosticsTimersOn();
  let r = null;
  try {
    await selfTestSleep(sec * 1000);
  } finally {
    r = await diagnosticsTimersOff(T);
  }
  const s = selfTestFrameStats(t0, debugLog.now(), 'dio', { whole: true }),
    gpu = r.gpu ? Math.round(Object.values(r.gpu).reduce((a, v) => a + v, 0) * 100) / 100 : null;
  /* phase 20: per frame, draw calls, instances, program switches and the draws of each pass */
  const c = r.calls;
  return {
    fps: s.fpsAvg,
    worstFps: s.fpsWorst,
    cpuMs: s.cpuMs,
    gpuMs: gpu,
    gpuPasses: r.gpu,
    slow: s.slow,
    draws: c ? c.dc[0] : null,
    instances: c ? c.dc[1] : null,
    programs: c ? c.dc[2] : null,
    passDraws: c ? c.dcp : null,
  };
}
const graphicsTestValue = v =>
  typeof v === 'boolean'
    ? v
      ? 'on'
      : 'off'
    : typeof v === 'number' && v >= 100
      ? String(v)
      : String(+(+v).toFixed(3));
/* a frame's whole time, from the frame rate (ms) */
const graphicsTestFrameMs = s => (s && s.fps ? Math.round((1000 / s.fps) * 10) / 10 : null);
/* per station, how far its untouched look wandered (first, midway, last): the largest difference in ms per frame, of
   the graphics chip's time where it has timers, else of the whole frame. A cost smaller than that is not sure */
function graphicsTestNoise(steps) {
  const out = {};
  for (const st of GRAPHICS_TEST_STATIONS) {
    const B = steps.filter(s => s.station === st.id && s.kind === 'base');
    const ms = B.map(s => (s.gpuMs != null ? s.gpuMs : graphicsTestFrameMs(s))).filter(v => v != null);
    if (ms.length >= 2) out[st.id] = Math.round((Math.max(...ms) - Math.min(...ms)) * 10) / 10;
  }
  return out;
}
/* per setting: its steps and what each costs over the lowest one (ms per frame), the costliest first. The cost is the
   graphics chip's time where it has timers, else the whole frame's time from the frame rate (the processor's time
   alone misses a device that waits on its graphics chip); `unclear` when it is within the station's noise */
function graphicsTestCosts(steps) {
  const by = {},
    noise = graphicsTestNoise(steps);
  for (const s of steps) if (s.kind === 'dial') (by[s.key] = by[s.key] || []).push(s);
  const d1 = x => (x == null ? null : Math.round(x * 100) / 100);
  return Object.entries(by)
    .map(([key, L]) => {
      const b = L[0],
        bf = graphicsTestFrameMs(b);
      const pts = L.map(s => {
        const f = graphicsTestFrameMs(s);
        return {
          value: s.value,
          fps: s.fps,
          draws: s.draws,
          frameMs: f,
          cpuMs: s.cpuMs,
          gpuMs: s.gpuMs,
          frameCost: f != null && bf != null ? d1(f - bf) : null,
          cpuCost: s.cpuMs != null && b.cpuMs != null ? d1(s.cpuMs - b.cpuMs) : null,
          gpuCost: s.gpuMs != null && b.gpuMs != null ? d1(s.gpuMs - b.gpuMs) : null,
          notMeasured: s.notMeasured,
        };
      });
      const top = pts[pts.length - 1],
        n = noise[L[0].station] ?? null,
        cost = d1(Math.max(top.gpuCost ?? top.frameCost ?? top.cpuCost ?? 0, 0));
      return {
        key,
        label: L[0].label,
        station: L[0].station,
        cost,
        noise: n,
        unclear: n != null && cost <= n,
        fpsDrop: b.fps != null && top.fps != null ? d1(b.fps - top.fps) : null,
        steps: pts,
      };
    })
    .sort((a, b) => b.cost - a.cost);
}
/* a station's untouched look, first and last: a big change means the device warmed up (or something else changed) */
function graphicsTestDrift(steps) {
  const out = {};
  for (const st of GRAPHICS_TEST_STATIONS) {
    const B = steps.filter(s => s.station === st.id && s.kind === 'base');
    if (B.length < 2) continue;
    const [a, b] = [B[0], B[B.length - 1]],
      ms = s => (s.gpuMs != null ? s.gpuMs : s.cpuMs);
    if (ms(a) == null || ms(b) == null) continue;
    const ch = ms(a) ? (ms(b) - ms(a)) / ms(a) : 0;
    out[st.id] = { first: ms(a), last: ms(b), change: Math.round(ch * 100), drifting: Math.abs(ch) > 0.15 };
  }
  return out;
}
function graphicsTestShow() {
  const R = graphicsTest.result;
  if (!R) return;
  const chip = R.steps.some(s => s.gpuMs != null),
    unit = chip ? "graphics chip's time" : 'whole frame (from the frame rate: this device has no graphics-chip timers)',
    f = v => (v == null ? '–' : v),
    sgn = v => (v == null ? '–' : (v > 0 ? '+' : '') + v),
    cost = p => (chip ? p.gpuCost : p.frameCost);
  const rows = R.settings
    .map(
      s =>
        `<tr><td>${escapeHtml(s.label)}${s.unclear ? ' <em>(within noise)</em>' : ''}<small>${s.steps.map(p => `${escapeHtml(graphicsTestValue(p.value))}: ${sgn(cost(p))}`).join(' · ')}</small></td><td class="tnum">${sgn(cost(s.steps[s.steps.length - 1]))}</td><td class="tnum">${f(s.steps[0].fps)} → ${f(s.steps[s.steps.length - 1].fps)}</td><td class="tnum">${f(s.steps[0].draws)} → ${f(s.steps[s.steps.length - 1].draws)}</td></tr>`
    )
    .join('');
  const all = R.steps.filter(s => s.kind === 'all'),
    allLine = all.length
      ? `<p class="note">Everything at once: ${all.map(s => `${escapeHtml(s.label)} ${f(s.fps)} fps (${f(chip ? s.gpuMs : graphicsTestFrameMs(s))} ms, ${f(s.draws)} draws)`).join(', ')}.</p>`
      : '',
    drift = Object.entries(R.drift)
      .filter(([, d]) => d.drifting)
      .map(([k]) => (GRAPHICS_TEST_STATIONS.find(s => s.id === k) || {}).name || k);
  modal({
    title: R.stopped ? 'Graphics test stopped' : 'What each setting costs',
    html: `<p class="note">The extra time each setting adds to a frame on this device, in ms of the ${unit}, over the setting at its lowest (a frame has ${R.fpsCap ? Math.round(1000 / R.fpsCap) : 16} ms at your ${f(R.fpsCap)} fps cap, so nothing shows below it). Costliest first; a cost no bigger than its place's own wandering is marked “within noise”.</p>
  <table class="nb-table"><thead><tr><th>Setting</th><th>At highest</th><th>fps</th><th>Draws</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nothing was measured.</td></tr>'}</tbody></table>${allLine}
  ${drift.length ? `<p class="note">These places measured differently at the end than at the start, so their numbers are less sure (the device may have warmed up): ${drift.map(escapeHtml).join(', ')}.</p>` : ''}
  ${R.errors.length ? `<h3>Errors</h3><ul class="nb-errs">${R.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}<p class="note">Your settings and your save weren't changed.</p>`,
    btns: [
      {
        l: 'Save the report',
        c: 'gold',
        f: () => {
          closeModal();
          exportGraphicsReport();
        },
      },
      { l: 'Close', c: 'quiet', f: closeModal },
    ],
  });
}
/* the report: per setting its steps, plus the device; no save data, no names */
function graphicsTestReport() {
  const R = graphicsTest.result;
  if (!R) return null;
  return {
    game: 'Pocket Billies',
    kind: 'graphics',
    format: 2,
    build: typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : null,
    created: new Date().toISOString(),
    seconds: R.seconds,
    stopped: R.stopped,
    device: debugLog.device ? debugLog.device() : null,
    graphics: debugLog.glInfo ? debugLog.glInfo() : null,
    screenHz: typeof frameScheduler !== 'undefined' ? frameScheduler.hz : null,
    fpsCap: R.fpsCap,
    settings: R.settings,
    everything: R.steps.filter(s => s.kind === 'all'),
    drift: R.drift,
    noise: R.noise,
    steps: R.steps,
    errors: R.errors,
  };
}
function exportGraphicsReport() {
  const r = graphicsTestReport();
  if (!r) {
    toast('Run the graphics test first.');
    return;
  }
  const d = new Date(),
    pad = n => String(n).padStart(2, '0');
  return shareReportFile(
    JSON.stringify(r, null, 1),
    `pocket-billies-graphics-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`,
    'Pocket Billies graphics test'
  );
}
