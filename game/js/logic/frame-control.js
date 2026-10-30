'use strict';
/* ================= FRAME CONTROLLER =================
   Fluid track FL-3a: the automatic quality aims at the rate the scheduler delivers (logic/frame-pace.js paceSlot), as a
   pure function so Node can play recorded and made-up traces through it (tools/test/frame-control.test.mjs).
   - Each frame's interval, own work and fence lag (frames the graphics chip is behind) go in ring buffers of about two
     seconds; it decides from the missed share and high quantiles, not averages. Frames with a one-off job (a load,
     a compile, an upload burst) or counted graphics calls are left out, and so is the frame after one (its gap is the
     one-off's).
   - Down fast: two missed in a row, over 5% missed in the last second, or work p90 over 90% of the slot.
     Up slowly: 4 s with no miss and work p95 under 70% of the slot. A raise that has to come down within 5 s is
     reverted and held, the hold doubling each time.
   - The bottleneck picks the lever. GPU-bound (fence lag of 2 frames or more, or misses with work p90 under 60% of the
     slot): the effects level q (1 fast blur, no AO; 2 shadows and reflection every other frame; 3 fewer bloom levels,
     no rays, no fog march; 4 cheap blur), then the resolution. CPU-bound (work p90 over 80% with low fence lag): the
     CPU level c (fewer far small props and townsfolk: walk/quality-cull.js), then q up to 2 (fewer shadow and
     reflection draws); never the resolution. Not clear: q to 2, c, q to 4, then the resolution.
   - At the floor and still missing: the steady half rate (the owner's answer, 2026-10-29); back up when the faster
     slot has room.
   - A thermal hold: two step-downs that come after a calm spell within about 2 minutes freeze climbing for 3.
   - The levels are kept per place kind by the page (device-local, never the save): controlSaved / controlRestore. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CONTROL_FRAMES: [() => CONTROL_FRAMES],
  CONTROL_LEVELS: [() => CONTROL_LEVELS],
  HOLD_MAX_MS: [() => HOLD_MAX_MS],
  HOLD_MS: [() => HOLD_MS],
  REVERT_MS: [() => REVERT_MS],
  SETTLE_MS: [() => SETTLE_MS],
  THERMAL_CALM_MS: [() => THERMAL_CALM_MS],
  THERMAL_HOLD_MS: [() => THERMAL_HOLD_MS],
  THERMAL_PAIR_MS: [() => THERMAL_PAIR_MS],
  UP_CALM_MS: [() => UP_CALM_MS],
  applyDown: [() => applyDown, v => (applyDown = v)],
  applyUp: [() => applyUp, v => (applyUp = v)],
  clearRing: [() => clearRing, v => (clearRing = v)],
  controlBottleneck: [() => controlBottleneck, v => (controlBottleneck = v)],
  controlFrame: [() => controlFrame, v => (controlFrame = v)],
  controlQuantile: [() => controlQuantile, v => (controlQuantile = v)],
  controlRestore: [() => controlRestore, v => (controlRestore = v)],
  controlSaved: [() => controlSaved, v => (controlSaved = v)],
  frameControl: [() => frameControl, v => (frameControl = v)],
  leverDown: [() => leverDown, v => (leverDown = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** frames kept (about two seconds at 60) */
export const CONTROL_FRAMES = 120;
/** the levers' tops: q effects 0-4, c CPU 0-3 */
export const CONTROL_LEVELS = { q: 4, c: 3 };
export const SETTLE_MS = 400,
  UP_CALM_MS = 4000,
  REVERT_MS = 5000,
  HOLD_MS = 30000,
  HOLD_MAX_MS = 8 * 60000,
  THERMAL_CALM_MS = 30000,
  THERMAL_PAIR_MS = 120000,
  THERMAL_HOLD_MS = 180000;

/**
 * @typedef {{ q: number, c: number, R: number, half: boolean }} ControlLevels
 * @typedef {{ iv: Float32Array, wk: Float32Array, lag: Float32Array, at: Float64Array, ms: Uint8Array, i: number, n: number,
 *   lv: ControlLevels, taken: string[], stepT: number, lastDownT: number, missT: number, missRun: number, skipNext: boolean,
 *   raised: string, raiseT: number, holdT: number, holdMs: number, thermalT: number, lateDownT: number, why: string,
 *   reverts: number, downs: number, ups: number }} ControlState
 *   iv, wk, lag, at, ms: the ring (interval, work, fence lag (-1 unknown), time, missed); lv: the levels; taken: the
 *   levers stepped down, last on top (a raise undoes the top one)
 * @typedef {{ now: number, dt: number, work: number, lag?: number, slot: number, V: number, skip?: boolean,
 *   phone?: boolean, floorR?: number, levers?: string }} ControlInput
 *   dt: the time since the last frame (ms); work: the frame's own work on the main thread (ms); lag: the fence lag in
 *   frames (-1 or missing: unknown); slot: the interval the scheduler delivers (ms, the half rate included); V: the
 *   refresh period (ms); skip: a frame with a one-off job or counted calls; floorR: the lowest resolution (0.6 on a
 *   phone, 0.5 elsewhere); levers: 'walk' (the bottleneck split, default) or 'one' (a single ladder on q: the battle)
 * @typedef {{ act: 'down' | 'up' | 'revert' | 'floor', lever: string, why: string }} ControlStep
 */

/**
 * @param {Partial<ControlLevels>} [lv] the levels to start at (a place kind's remembered ones)
 * @returns {ControlState}
 */
export function frameControl(lv) {
  const N = CONTROL_FRAMES;
  return {
    iv: new Float32Array(N),
    wk: new Float32Array(N),
    lag: new Float32Array(N),
    at: new Float64Array(N),
    ms: new Uint8Array(N),
    i: 0,
    n: 0,
    lv: { q: 0, c: 0, R: 1, half: false, ...(lv || {}) },
    taken: [],
    stepT: -1e9,
    lastDownT: -1e9,
    missT: -1e9,
    missRun: 0,
    skipNext: false,
    raised: '',
    raiseT: -1e9,
    holdT: 0,
    holdMs: HOLD_MS,
    thermalT: 0,
    lateDownT: -1e9,
    why: '',
    reverts: 0,
    downs: 0,
    ups: 0,
  };
}

/**
 * The q-th quantile of a ring's last n values (a copy is sorted; n is at most CONTROL_FRAMES).
 * @param {Float32Array} a
 * @param {number} n
 * @param {number} q 0-1
 * @param {boolean} [known] leave out negative values (an unknown fence lag)
 * @returns {number} -1 when there are none
 */
export function controlQuantile(a, n, q, known) {
  const v = [];
  for (let k = 0; k < n; k++) if (!known || a[k] >= 0) v.push(a[k]);
  if (!v.length) return -1;
  v.sort((x, y) => x - y);
  return v[Math.min(v.length - 1, Math.floor(v.length * q))];
}

/**
 * What holds the frames back, from the ring.
 * @param {ControlState} s
 * @param {number} slot
 * @param {boolean} [phone] a phone, where a wait on the graphics chip shows up as main-thread work
 * @returns {'gpu' | 'cpu' | 'mixed'}
 */
export function controlBottleneck(s, slot, phone) {
  const n = s.n,
    work = controlQuantile(s.wk, n, 0.9),
    lag = controlQuantile(s.lag, n, 0.9, true);
  if (lag >= 2) return 'gpu';
  if (work >= 0 && work < slot * 0.6) return 'gpu';
  if (work > slot * 0.8 && (lag >= 0 ? lag < 1.5 : !phone)) return 'cpu';
  return 'mixed';
}

/* the next lever down for a bottleneck, or '' at the floor */
export function leverDown(lv, kind, floorR, levers) {
  if (levers === 'one') return lv.q < CONTROL_LEVELS.q ? 'q' : !lv.half ? 'half' : '';
  const R = lv.R > floorR + 0.05 ? 'R' : '';
  const order =
    kind === 'gpu'
      ? [lv.q < CONTROL_LEVELS.q && 'q', R]
      : kind === 'cpu'
        ? [lv.c < CONTROL_LEVELS.c && 'c', lv.q < 2 && 'q']
        : [lv.q < 2 && 'q', lv.c < CONTROL_LEVELS.c && 'c', lv.q < CONTROL_LEVELS.q && 'q', R];
  const pick = order.find(Boolean);
  return pick || (!lv.half ? 'half' : '');
}

export function applyDown(lv, lever, floorR) {
  if (lever === 'q') lv.q++;
  else if (lever === 'c') lv.c++;
  else if (lever === 'R') lv.R = Math.max(floorR, Math.round((lv.R - 0.1) * 10) / 10);
  else if (lever === 'half') lv.half = true;
}

export function applyUp(lv, lever) {
  if (lever === 'q') lv.q = Math.max(0, lv.q - 1);
  else if (lever === 'c') lv.c = Math.max(0, lv.c - 1);
  else if (lever === 'R') lv.R = Math.min(1, Math.round((lv.R + 0.1) * 10) / 10);
  else if (lever === 'half') lv.half = false;
}

/* start the ring afresh after a step: the frames before it say nothing about the new level */
export function clearRing(s, now) {
  s.n = 0;
  s.i = 0;
  s.missRun = 0;
  s.stepT = now;
}

/**
 * One drawn frame. Changes the state's levels in place and says what it did.
 * @param {ControlState} s changed in place
 * @param {ControlInput} i
 * @returns {ControlStep | null}
 */
export function controlFrame(s, i) {
  const now = i.now,
    slot = i.slot,
    floorR = i.floorR ?? 0.5,
    levers = i.levers || 'walk';
  if (i.skip) {
    s.skipNext = true;
    return null;
  }
  if (s.skipNext) {
    s.skipNext = false;
    return null;
  }
  const missed = i.dt > slot + i.V / 2;
  const k = s.i;
  s.iv[k] = i.dt;
  s.wk[k] = i.work;
  s.lag[k] = i.lag == null ? -1 : i.lag;
  s.at[k] = now;
  s.ms[k] = missed ? 1 : 0;
  s.i = (k + 1) % CONTROL_FRAMES;
  s.n = Math.min(CONTROL_FRAMES, s.n + 1);
  s.missRun = missed ? s.missRun + 1 : 0;
  if (missed) s.missT = now;
  if (now - s.stepT < SETTLE_MS) return null;

  /* down: two missed in a row, over 5% missed in the last second (at least half a second seen), or the work's p90
     over 90% of the slot */
  let seen = 0,
    miss = 0,
    oldest = now;
  for (let j = 0; j < s.n; j++) {
    if (now - s.at[j] > 1000) continue;
    seen++;
    miss += s.ms[j];
    oldest = Math.min(oldest, s.at[j]);
  }
  const share = seen && now - oldest >= 500 ? miss / seen : 0,
    workP90 = s.n >= 20 ? controlQuantile(s.wk, s.n, 0.9) : 0,
    why =
      s.missRun >= 2
        ? '2 missed in a row'
        : share > 0.05
          ? `${Math.round(share * 100)}% missed`
          : workP90 > slot * 0.9
            ? `work p90 ${workP90.toFixed(1)} ms of ${slot.toFixed(1)}`
            : '';
  if (why) {
    /* a raise that comes down within 5 s goes back, and raising is held off (the hold doubling each time) */
    if (s.raised && now - s.raiseT < REVERT_MS) {
      const lever = s.raised;
      applyDown(s.lv, lever, floorR);
      s.taken.push(lever);
      s.raised = '';
      s.holdT = now + s.holdMs;
      s.holdMs = Math.min(HOLD_MAX_MS, s.holdMs * 2);
      s.reverts++;
      s.why = why;
      clearRing(s, now);
      s.lastDownT = now;
      return { act: 'revert', lever, why };
    }
    const kind = levers === 'one' ? 'mixed' : controlBottleneck(s, slot, i.phone),
      lever = leverDown(s.lv, kind, floorR, levers);
    s.raised = '';
    if (!lever) {
      clearRing(s, now);
      return { act: 'floor', lever: '', why };
    }
    /* thermal: a step-down after a calm spell, twice within about 2 minutes */
    if (now - s.lastDownT > THERMAL_CALM_MS) {
      if (now - s.lateDownT < THERMAL_PAIR_MS) s.thermalT = now + THERMAL_HOLD_MS;
      s.lateDownT = now;
    }
    applyDown(s.lv, lever, floorR);
    s.taken.push(lever);
    s.downs++;
    s.why = `${kind}: ${why}`;
    s.lastDownT = now;
    clearRing(s, now);
    return { act: 'down', lever, why: s.why };
  }

  /* up: 4 s with no miss and work p95 under 70% of the slot (of the faster slot, to leave the half rate), no hold */
  if (now < s.holdT || now < s.thermalT) return null;
  if (now - s.missT < UP_CALM_MS || now - s.stepT < UP_CALM_MS || s.n < 30) return null;
  const top = s.taken.length ? s.taken[s.taken.length - 1] : s.lv.R < 1 && levers !== 'one' ? 'R' : '';
  if (!top) return null;
  const room = top === 'half' ? slot / 2 : slot,
    workP95 = controlQuantile(s.wk, s.n, 0.95),
    lagP90 = controlQuantile(s.lag, s.n, 0.9, true);
  if (workP95 >= room * 0.7) return null;
  if ((top === 'q' || top === 'R' || top === 'half') && lagP90 >= 1.5) return null;
  if (s.taken.length) s.taken.pop();
  applyUp(s.lv, top);
  s.raised = top;
  s.raiseT = now;
  s.ups++;
  s.why = `room: work p95 ${workP95.toFixed(1)} ms of ${room.toFixed(1)}`;
  clearRing(s, now);
  return { act: 'up', lever: top, why: s.why };
}

/**
 * What a place kind keeps (localStorage, device-local).
 * @param {ControlState} s
 * @returns {{ q: number, c: number, R: number, taken: string[] }}
 */
export function controlSaved(s) {
  return { q: s.lv.q, c: s.lv.c, R: s.lv.R, taken: s.taken.filter(l => l !== 'half').slice(-12) };
}

/**
 * A controller started at a place kind's kept levels (the half rate is never kept: it is earned again).
 * @param {unknown} kept
 * @returns {ControlState}
 */
export function controlRestore(kept) {
  const k = /** @type {any} */ (kept) || {},
    num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
  const s = frameControl({
    q: Math.round(num(k.q, 0, CONTROL_LEVELS.q, 0)),
    c: Math.round(num(k.c, 0, CONTROL_LEVELS.c, 0)),
    R: Math.round(num(k.R, 0.5, 1, 1) * 10) / 10,
  });
  /* the stack is rebuilt to match the levels, so climbing undoes what is set */
  const taken = Array.isArray(k.taken) ? k.taken.filter(l => l === 'q' || l === 'c' || l === 'R') : [];
  const want = { q: s.lv.q, c: s.lv.c, R: Math.round((1 - s.lv.R) * 10) },
    left = { ...want };
  s.taken = taken.filter(l => left[l]-- > 0);
  for (const l of /** @type {('q'|'c'|'R')[]} */ (['R', 'c', 'q'])) {
    let have = s.taken.filter(x => x === l).length;
    while (have++ < want[l]) s.taken.unshift(l);
  }
  return s;
}
