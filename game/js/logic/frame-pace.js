'use strict';
/* ================= FRAME PACING =================
   Fluid track FL-1a: the frame scheduler's arithmetic as pure functions, so a Node simulation can test it against a
   made-up screen (tools/test/frame-pace.test.mjs). frame-scheduler.js and walk/quality-cull.js call these.
   - the refresh period from every tick's delta: a low quantile of the last half second, re-read on a change (a
     browser that halves the page's rate, battery saver), never snapped to a list;
   - a rate as a whole number of refreshes (the slot), locked to the beat: a late frame doesn't buy a quick one after;
   - each frame's shown interval in refreshes, and a missed flag;
   - the steady half rate (the owner's answer, 2026-10-29), used by the automatic quality's controller;
   - what the automatic quality is fed: a change of rate (a window or a screen opening or closing) starts it afresh. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LADDER_GRACE_MS: [() => LADDER_GRACE_MS],
  PACE_EVERY_MS: [() => PACE_EVERY_MS],
  PACE_MIN_SAMPLES: [() => PACE_MIN_SAMPLES],
  PACE_WINDOW_MS: [() => PACE_WINDOW_MS],
  ladderFeed: [() => ladderFeed, v => (ladderFeed = v)],
  ladderTake: [() => ladderTake, v => (ladderTake = v)],
  paceDue: [() => paceDue, v => (paceDue = v)],
  paceSlot: [() => paceSlot, v => (paceSlot = v)],
  paceTask: [() => paceTask, v => (paceTask = v)],
  phoneAgent: [() => phoneAgent, v => (phoneAgent = v)],
  refreshPeriod: [() => refreshPeriod, v => (refreshPeriod = v)],
  refreshTick: [() => refreshTick, v => (refreshTick = v)],
  refreshTracker: [() => refreshTracker, v => (refreshTracker = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how far back the refresh period is read (ms) */
export const PACE_WINDOW_MS = 500;
/** how often the refresh period is worked out again (ms) */
export const PACE_EVERY_MS = 100;
/** the fewest deltas the period is read from */
export const PACE_MIN_SAMPLES = 8;
/** after a change of rate, the automatic quality waits this long before it takes the frames' measure again (ms) */
export const LADDER_GRACE_MS = 1500;

/**
 * @typedef {{ V: number, hz: number, samples: number[], times: number[], estT: number, lastTs: number, lastWork: number }} RefreshTracker
 *   V: the refresh period (ms); hz: refreshes a second, whole; samples, times: the deltas kept and when they came
 * @typedef {{ next: number, last: number, k: number, rate: number, capT: number, shown: number, missed: boolean, misses: number, frames: number }} PaceTask
 *   next: the earliest tick the task may run again; last: when it last ran; k: its slot (refreshes a frame); rate: the
 *   rate asked last; capT: when that changed; shown: the last frame's interval in refreshes; missed: it came late
 */

/** @returns {RefreshTracker} */
export function refreshTracker(V = 1000 / 60) {
  return { V, hz: Math.round(1000 / V), samples: [], times: [], estT: 0, lastTs: 0, lastWork: 0 };
}

/**
 * One animation tick. A delta tells about the refresh when the tick before it had little work (under half the delta:
 * the gap wasn't the work's) or when it is quicker than the period read so far (a tick never comes sooner than a
 * refresh). Busy ticks come at whole multiples and say nothing new.
 * @param {RefreshTracker} r changed in place
 * @param {number} ts the tick's time (ms)
 * @param {number} work the previous tick's work on the main thread (ms)
 * @returns {boolean} the period changed
 */
export function refreshTick(r, ts, work) {
  const d = r.lastTs ? ts - r.lastTs : 0;
  r.lastTs = ts;
  if (d > 2 && d < 100 && (work < d / 2 || d < r.V * 0.9)) {
    r.samples.push(d);
    r.times.push(ts);
  }
  while (r.times.length && ts - r.times[0] > PACE_WINDOW_MS) {
    r.times.shift();
    r.samples.shift();
  }
  if (ts - r.estT < PACE_EVERY_MS || r.samples.length < PACE_MIN_SAMPLES) return false;
  r.estT = ts;
  const V = refreshPeriod(r.samples);
  if (!(V > 0) || Math.abs(V - r.V) < r.V * 0.01) return false;
  r.V = V;
  r.hz = Math.round(1000 / V);
  return true;
}

/**
 * The refresh period from deltas: their lower quarter (a few late ticks don't count), then the mean of the deltas
 * near it (within 12%), so a 61 Hz panel reads 16.4 ms, not 60's 16.7.
 * @param {number[]} deltas
 * @returns {number} 0 when there are none
 */
export function refreshPeriod(deltas) {
  if (!deltas.length) return 0;
  const s = deltas.slice().sort((a, b) => a - b),
    p = s[Math.floor(s.length * 0.25)];
  let sum = 0,
    n = 0;
  for (const d of s) {
    if (d < p * 0.88) continue;
    if (d > p * 1.12) break;
    sum += d;
    n++;
  }
  return n ? sum / n : p;
}

/**
 * A rate as a whole number of refreshes: the nearest (60 on a 165 Hz screen: 3, 55 a second); a rate at or above the
 * screen's: every refresh. The half rate doubles it.
 * @param {number} cap frames a second asked
 * @param {number} V the refresh period (ms)
 * @param {boolean} [half] the steady half rate
 * @returns {number} refreshes a frame, 1 or more
 */
export function paceSlot(cap, V, half) {
  const hz = 1000 / V;
  const k = cap >= hz - 1 ? 1 : Math.max(1, Math.round(hz / Math.max(0.1, cap)));
  return half ? k * 2 : k;
}

/** @returns {PaceTask} */
export function paceTask() {
  return { next: 0, last: 0, k: 1, rate: 0, capT: 0, shown: 0, missed: false, misses: 0, frames: 0 };
}

/**
 * Whether a task runs this tick, locked to the beat: it runs from half a refresh before its time, and the next time
 * is a slot after this one or, after a late frame, a slot after now (no quick frame to catch up). A change of rate
 * starts the beat again at once (a window closing: the world comes back this tick, not a second later).
 * @param {PaceTask} t changed in place
 * @param {number} ts the tick's time (ms)
 * @param {number} cap frames a second asked now
 * @param {number} V the refresh period (ms)
 * @param {boolean} [half] the steady half rate
 * @returns {number} the time since the task last ran (ms; one slot the first time), or -1 when it doesn't run
 */
export function paceDue(t, ts, cap, V, half) {
  const k = paceSlot(cap, V, half),
    T = k * V;
  if (cap !== t.rate || k !== t.k) {
    t.rate = cap;
    t.k = k;
    t.capT = ts;
    t.next = 0;
    t.last = 0;
  }
  if (ts < t.next) return -1;
  t.next = Math.max(t.next + T, ts + T - V / 2);
  const dt = t.last ? ts - t.last : T;
  t.last = ts;
  t.shown = Math.round(dt / V);
  t.missed = dt > T + V / 2;
  if (t.missed) t.misses++;
  t.frames++;
  return dt;
}

/**
 * @typedef {{ int: number, slow: number, cap: number, capT: number, graceT: number }} LadderFeed
 *   int: the smoothed time between frames (ms); slow: the smoothed work (ms); cap: the rate last seen; graceT: until
 *   when the frames aren't measured
 * @typedef {{ cap: number, aim: number, V: number, half?: boolean, now: number, dtm: number, work: number, counted?: boolean }} LadderInput
 *   cap: the rate asked now; aim: the most the automatic quality aims at (60, or more with Balanced); dtm: the time
 *   since the last frame; work: the frame's own work, the one-off jobs left out; counted: the graphics calls were
 *   counted in this frame (their cost is the counters')
 */

/** @returns {LadderFeed} */
export function ladderFeed() {
  return { int: 0, slow: 0, cap: 0, capT: 0, graceT: 0 };
}

/**
 * What the automatic quality is fed this frame. Below 30 a second (behind a window or a screen) frames don't count. A
 * change of rate starts the averages afresh and waits LADDER_GRACE_MS before measuring (the first frame after a
 * window or a screen closes waited a second: read as slow, every menu took a step down). The target is the frame's
 * slot, so 60 on a 90 Hz screen (45 a second, every second refresh) isn't read as slow.
 * @param {LadderFeed} f changed in place
 * @param {LadderInput} i
 * @returns {{ int: number, slow: number, target: number } | null} null: no step this frame
 */
export function ladderTake(f, i) {
  if (i.cap < 30) {
    f.int = 0;
    f.cap = i.cap;
    return null;
  }
  const target = paceSlot(Math.min(i.cap, i.aim), i.V, i.half) * i.V;
  if (i.cap !== f.cap) {
    f.cap = i.cap;
    f.capT = i.now;
    f.graceT = i.now + LADDER_GRACE_MS;
    f.int = 0;
    return null;
  }
  if (i.counted) return null;
  if (i.now < f.graceT) return null;
  f.int = f.int ? f.int * 0.92 + i.dtm * 0.08 : Math.min(i.dtm, target);
  f.slow = f.slow ? f.slow * 0.9 + i.work * 0.1 : i.work;
  return { int: f.int, slow: f.slow, target };
}

/**
 * One test for a phone or tablet everywhere (Android, iPhone, iPad, and an iPad that says it is a Mac: a Mac with a
 * touch screen).
 * @param {string} ua the user agent
 * @param {number} [touchPoints] navigator.maxTouchPoints
 * @returns {boolean}
 */
export function phoneAgent(ua, touchPoints = 0) {
  return /Android|iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}
