'use strict';
/* ================= BENCH WALK (test data track TD-2) =================
   Walks one segment of the benchmark path (logic/bench-path.js) and measures it: the place opened, the hour, weather
   and townsfolk the segment asks for, the player put on its first point and walked point by point (at a run, the
   camera turning, when the segment says so), every frame's gap, the draws, graphics memory, the processor's time
   and the slow frames' causes meanwhile. The Graphics test (graphics-test.js) walks the whole path with it; TD-3's
   headless check walks the same segments. Numbers, dial names and segment ids only: nothing of the save. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { loadAllMaps } from './map-files.js';
import { uiState } from './game-state.js';
import { gpuCountBegin, gpuCountEnd } from './engine/gpu-counters.js';
import { frameScheduler, userFps } from './frame-scheduler.js';
import { RUN_FACTOR, findPath, mapById, navCellAt, navGrid, walkTo, walkView } from './walk-view.js';
import { ENGINE_DEFAULTS } from './engine/settings.js';
import { gpuMemory, gpuState } from './engine/webgl.js';
import { environment } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { paintWorkerState } from './ground-paint-worker.js';
import { render } from './ui.js';
import { selfTestFrameStats, selfTestSleep } from './self-test.js';
import { BENCH_SEGMENTS, benchFrameStats, benchLookHour } from './logic/bench-path.js';
/* eslint-disable no-func-assign */
expose({
  benchConditions: [() => benchConditions, v => ((benchConditions = v), provide({ benchConditions }))],
  benchMemory: [() => benchMemory, v => ((benchMemory = v), provide({ benchMemory }))],
  benchOpen: [() => benchOpen, v => ((benchOpen = v), provide({ benchOpen }))],
  benchPathChecks: [() => benchPathChecks, v => (benchPathChecks = v)],
  benchReady: [() => benchReady, v => (benchReady = v)],
  benchSegmentById: [() => benchSegmentById, v => (benchSegmentById = v)],
  benchWalk: [() => benchWalk, v => ((benchWalk = v), provide({ benchWalk }))],
  benchWalkEnd: [() => benchWalkEnd, v => ((benchWalkEnd = v), provide({ benchWalkEnd }))],
  held: [() => held],
  sceneOpen: [() => sceneOpen],
  segmentForce: [() => segmentForce, v => (segmentForce = v)],
  standAt: [() => standAt, v => (standAt = v)],
});
/* eslint-enable no-func-assign */
provide({ benchConditions, benchMemory, benchOpen, benchWalk, benchWalkEnd });
/* to-module: end */
function benchSegmentById(id) {
  return BENCH_SEGMENTS.find(s => s.id === id) || null;
}
/* graphics memory now (the game's own estimate, engine/webgl.js gpuMemory): MB in all and by kind */
function benchMemory() {
  const kinds = {};
  let mb = 0;
  for (const [k, v] of Object.entries(gpuMemory())) {
    kinds[k] = Math.round(v.mb * 10) / 10;
    mb += v.mb;
  }
  return { mb: Math.round(mb * 10) / 10, kinds };
}
const sceneOpen = id => walkView.ready && (walkView.id === id || (walkView.sc && walkView.sc.baseId === id));
/* the place is ready to measure: open, nothing left to prepare, plant or paint */
function benchReady(id) {
  return (
    sceneOpen(id) &&
    !(walkRenderer.prep || walkRenderer.grassJob) &&
    !(paintWorkerState && paintWorkerState.jobs && paintWorkerState.jobs.size)
  );
}
/* opens a place (once: a place already open is kept, so its ground and pictures are reused) and waits until it is
   ready; ms it took, or throws */
async function benchOpen(id, stop) {
  const t0 = performance.now();
  if (!sceneOpen(id)) {
    await loadAllMaps();
    if (!mapById(id)) throw new Error(`${id} isn’t in this build`);
    uiState.tab = 'walk';
    uiState.bench = { id, test: 1 };
    render();
  }
  for (let i = 0; i < 600 && !benchReady(id); i++) {
    if (stop && stop()) return null;
    await selfTestSleep(50);
  }
  if (!sceneOpen(id)) throw new Error(`${id} didn’t open in ${Math.round((performance.now() - t0) / 1000)} s`);
  return Math.round(performance.now() - t0);
}
/* what the segment holds for itself, put back by benchWalkEnd: the scene's townsfolk count */
const held = { folk: undefined, sc: null };
function benchWalkEnd() {
  if (held.sc) held.sc.folk = held.folk;
  held.sc = null;
  if (walkRenderer.on) walkRenderer.yawT = 0;
}
function standAt(seg) {
  const P = walkView.pl,
    o = (walkView.sc && walkView.sc.baseOff) || [0, 0];
  P.x = seg.route[0][0] + o[0];
  P.z = seg.route[0][1] + o[1];
  P.route = null;
  P.fresh = false;
  if (walkRenderer.on) {
    walkRenderer.yawT = 0;
    walkRenderer.zoomT = seg.zoom || 1;
  }
}
/* the hour, weather and season the segment asks for (forced; the caller puts environment.force back) */
function segmentForce(seg) {
  const time = seg.look ? benchLookHour(seg.look, ENGINE_DEFAULTS) : (seg.time ?? 15);
  environment.force = { time, weather: seg.weather || 'clear', season: seg.season || 'summer' };
}

/**
 * Walks a segment once. o.measure: count frames and calls (else a warm-up walk); o.stop(): stop now; o.settle: ms to
 * wait for the place to hold still first. Returns the numbers, `invalid` with why when the walk can't be trusted
 * (the app went to the background, the picture was lost, the screen's refresh rate changed), `peakMb`, the most
 * graphics memory seen, and `overBudget` when o.budget (MB) was passed during the walk (the walk stops there).
 */
async function benchWalk(seg, o = {}) {
  const stop = o.stop || (() => false),
    sc0 = walkView.sc;
  segmentForce(seg);
  if (sc0 && seg.folk != null && held.sc !== sc0) {
    held.sc = sc0;
    held.folk = sc0.folk;
  }
  if (sc0) sc0.folk = seg.folk != null ? seg.folk : held.sc === sc0 ? held.folk : sc0.folk;
  standAt(seg);
  /* the forced hour and weather snap in, then two whole quiet frames' worth of time */
  const t1 = performance.now();
  while (!benchReady(seg.scene) && performance.now() - t1 < (o.settle || 4000) && !stop()) await selfTestSleep(100);
  await selfTestSleep(o.settle ? 600 : 300);
  standAt(seg);
  const hz0 = frameScheduler.hz || null,
    vis0 = document.hidden,
    lost0 = !!gpuState.lost,
    gaps = [],
    gl = gpuState.gl,
    fences = [];
  let last = 0,
    going = true,
    hidden = false,
    peak = benchMemory().mb,
    over = false,
    lagSum = 0,
    lagN = 0,
    frame = 0;
  const onVis = () => {
    if (document.hidden) hidden = true;
  };
  document.addEventListener('visibilitychange', onVis);
  /* every frame's gap, and how many frames behind the graphics chip is: a fence after each frame, read on the
     frames after (getSyncParameter never waits) */
  const tick = t => {
    if (!going) return;
    frame++;
    if (last) gaps.push(t - last);
    last = t;
    if (o.measure && gl && gl.fenceSync) {
      try {
        for (let i = fences.length - 1; i >= 0; i--) {
          const [f, at] = fences[i];
          if (gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED) {
            lagSum += frame - at;
            lagN++;
            gl.deleteSync(f);
            fences.splice(i, 1);
          }
        }
        if (fences.length < 8) fences.push([gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), frame]);
      } catch (e) {}
    }
    requestAnimationFrame(tick);
  };
  const mark = 'bench:' + seg.id;
  try {
    performance.mark(mark + ':start');
  } catch (e) {}
  if (o.measure) gpuCountBegin();
  const T0 = debugLog.now(),
    slow0 = debugLog.slow.length ? debugLog.slow[debugLog.slow.length - 1].t : -1;
  requestAnimationFrame(tick);
  let calls = null;
  try {
    const P = walkView.pl;
    if (seg.hold && seg.route.length === 1) {
      const end = performance.now() + seg.hold * 1000;
      while (performance.now() < end && !stop() && !over) {
        await selfTestSleep(250);
        peak = Math.max(peak, benchMemory().mb);
        if (o.budget && peak > o.budget) over = true;
      }
    }
    for (let i = 1; i < seg.route.length && !stop() && !over; i++) {
      const [x, z] = seg.route[i],
        off = (walkView.sc && walkView.sc.baseOff) || [0, 0],
        gx = x + off[0],
        gz = z + off[1],
        t0 = performance.now();
      walkTo([gx, gz]);
      if (seg.run && P.route) P.rush = RUN_FACTOR;
      /* stuck is no progress for 3 s and 10 frames, not a fixed time: on a slow device the game's clock (at most
         60 ms a frame) walks slower than real time */
      let k = 0,
        moved = performance.now(),
        f0 = frame,
        px = P.x,
        pz = P.z;
      while (P.route && !stop() && performance.now() - t0 < 180000) {
        await selfTestSleep(100);
        k++;
        if (seg.turn && walkRenderer.on) walkRenderer.yawT = Math.sin(k * 0.12) * 0.6;
        if (Math.hypot(P.x - px, P.z - pz) > 0.02) {
          moved = performance.now();
          f0 = frame;
          px = P.x;
          pz = P.z;
        } else if (performance.now() - moved > 3000 && frame - f0 > 10) break;
        if (k % 3 === 0) {
          peak = Math.max(peak, benchMemory().mb);
          if (o.budget && peak > o.budget) {
            over = true;
            break;
          }
        }
      }
      if (stop() || over) break;
      const far = Math.hypot(P.x - gx, P.z - gz);
      P.route = null;
      /* not there: a way the place doesn't have (a rebuild moved something) or the player stuck: stop the walk */
      if (far > 1) throw new Error(`couldn’t walk ${seg.id} to point ${i} (${x}, ${z}): ${far.toFixed(1)} m short`);
    }
  } finally {
    going = false;
    if (o.measure) calls = gpuCountEnd();
    document.removeEventListener('visibilitychange', onVis);
    for (const [f] of fences)
      try {
        gl.deleteSync(f);
      } catch (e) {}
    try {
      performance.mark(mark + ':end');
      performance.measure(mark, mark + ':start', mark + ':end');
    } catch (e) {}
  }
  const T1 = debugLog.now(),
    s = benchFrameStats(gaps),
    cpu = selfTestFrameStats(T0, T1, 'dio', { whole: true }),
    slow = {};
  for (const f of debugLog.slow) if (f.t > slow0 && f.t >= T0 && f.t <= T1) slow[f.why] = (slow[f.why] || 0) + 1;
  const hz1 = frameScheduler.hz || null,
    invalid =
      hidden || vis0
        ? 'the app went to the background'
        : gpuState.lost && !lost0
          ? 'the graphics chip lost the picture'
          : hz0 && hz1 && Math.abs(hz1 - hz0) > 2
            ? `the screen's refresh rate changed (${hz0} to ${hz1} Hz)`
            : null;
  return {
    seconds: Math.round(T1 - T0) / 1000,
    ...s,
    cpuMs: cpu.cpuMs,
    fenceLag: lagN ? Math.round((lagSum / lagN) * 10) / 10 : null,
    draws: calls ? calls.dc[0] : null,
    instances: calls ? calls.dc[1] : null,
    programs: calls ? calls.dc[2] : null,
    gmb: benchMemory().mb,
    peakMb: Math.round(peak * 10) / 10,
    slow: Object.keys(slow).length ? slow : undefined,
    overBudget: over || undefined,
    invalid: invalid || undefined,
  };
}

/* every segment's route can be walked, point to point, on its place's walking grid (worked out from the data, nothing
   drawn: the quick check's "Test scenes: walking rules" step); [{ seg, ok, what }] */
function benchPathChecks() {
  const out = [],
    keep = [walkView.sc, walkView.nav, walkView.gkey];
  try {
    for (const seg of BENCH_SEGMENTS) {
      const sc = mapById(seg.scene);
      if (!sc) {
        out.push({ seg: seg.id, ok: false, what: seg.scene + ' isn’t in this build' });
        continue;
      }
      walkView.sc = sc;
      walkView.nav = null;
      walkView.gkey = 'bench-' + seg.scene;
      const G = navGrid(),
        c = navCellAt(seg.route[0][0], seg.route[0][1]);
      let bad = c < 0 || G.blk[c] ? 'its first point isn’t open ground' : null;
      for (let i = 1; i < seg.route.length && !bad; i++) {
        const [a, b] = [seg.route[i - 1], seg.route[i]],
          r = findPath(a[0], a[1], b[0], b[1]),
          e = r && r[r.length - 1];
        if (!r || Math.hypot(e[0] - b[0], e[1] - b[1]) > 0.9) bad = `point ${i} (${b[0]}, ${b[1]}) can’t be reached`;
      }
      out.push({ seg: seg.id, ok: !bad, what: bad || 'walkable' });
    }
  } finally {
    [walkView.sc, walkView.nav, walkView.gkey] = keep;
  }
  return out;
}

/* the run's conditions, once at the start and once at the end: the browser by name and major version (not the whole
   user agent), the screen, the fps cap, the timers, what the graphics chip and the page allow */
async function benchConditions() {
  const ua = navigator.userAgent,
    m = /(Firefox|Edg|OPR|SamsungBrowser|Chrome|Version)\/(\d+)/.exec(ua),
    name = m ? { Edg: 'Edge', OPR: 'Opera', Version: /Safari/.test(ua) ? 'Safari' : 'Browser' }[m[1]] || m[1] : null;
  /* the timer's resolution: the smallest step performance.now takes */
  let tick = Infinity,
    a = performance.now();
  for (let i = 0; i < 2000; i++) {
    const b = performance.now();
    if (b > a) {
      tick = Math.min(tick, b - a);
      a = b;
    }
  }
  /* the refresh rate as measured now: 30 frames' median gap */
  const gaps = await new Promise(res => {
    const g = [];
    let l = 0;
    const f = t => {
      if (l) g.push(t - l);
      l = t;
      if (g.length < 30) requestAnimationFrame(f);
      else res(g);
    };
    requestAnimationFrame(f);
    setTimeout(() => res(g), 2000);
  });
  const med = gaps.length ? gaps.slice().sort((x, y) => x - y)[gaps.length >> 1] : null,
    gi = debugLog.glInfo ? debugLog.glInfo() : {};
  let loaf = false;
  try {
    loaf = (PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame');
  } catch (e) {}
  return {
    browser: name ? `${name} ${m[2]}` : null,
    mobile: /Mobi|Android|iPhone|iPad/.test(ua),
    hz: frameScheduler.hz || null,
    measuredHz: med ? Math.round(1000 / med) : null,
    fpsCap: typeof userFps === 'function' ? userFps() : null,
    dpr: devicePixelRatio,
    res: walkView.R ? Math.round(walkView.R * 100) / 100 : null,
    screen: `${screen.width}x${screen.height}`,
    crossOriginIsolated: !!self.crossOriginIsolated,
    timerMs: isFinite(tick) ? Math.round(tick * 1000) / 1000 : null,
    timerQuery: gi.timerQuery ?? null,
    loaf,
    cores: navigator.hardwareConcurrency || null,
    renderer: gi.renderer || null,
  };
}
