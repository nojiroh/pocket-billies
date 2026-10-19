'use strict';
/* ================= FRAME SCHEDULER =================
   One requestAnimationFrame loop drives everything that animates (battle, world map, sprites, sky).
   Each task has its own cap; the battle and map follow the 30 / 60 / 120 FPS setting. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { debugFps, gpuState, saveData } from './hooks.js';
import { countersOff, countersOn, gpuCountDue, gpuFrameDone } from './engine/gpu-counters.js';
/* eslint-disable no-func-assign */
expose({
  frameCount: [() => frameCount, v => (frameCount = v)],
  frameLoop: [() => frameLoop, v => (frameLoop = v)],
  framePace: [() => framePace, v => (framePace = v)],
  frameScheduler: [() => frameScheduler],
  frameStop: [() => frameStop, v => (frameStop = v)],
  frameTask: [() => frameTask, v => (frameTask = v)],
  runFrameTasks: [() => runFrameTasks, v => (runFrameTasks = v)],
  userFps: [() => userFps, v => (userFps = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const frameScheduler = {
  tasks: new Map(),
  on: false,
  hz: 60,
  deltas: [],
  last: 0,
  lastWork: 0,
  meter: { t0: 0, n: 0, fps: 0, work: 0, workAvg: 0 },
};
export function userFps() {
  const p = (typeof saveData !== 'undefined' && saveData && saveData.preferences) || {};
  const f = +p.fps;
  return f === 30 || f === 90 || f === 120 ? f : 60;
}
/* v34: frame pacing. A rate is held to an even share of the screen's own (120 on a 120 Hz screen, 60 on it as every
   second frame, 90 there as 120/1 ... rounded to 60), so frames come at a steady beat instead of 2-1-2-1 */
function framePace(cap) {
  const hz = frameScheduler.hz || 60;
  if (cap >= hz - 1) return hz;
  if (cap <= 12) return cap;
  const k = Math.max(1, Math.round(hz / cap));
  return hz / k;
}
/* add or replace a task; cap() returns the frames per second it wants right now */
export function frameTask(name, fn, cap) {
  frameScheduler.tasks.set(name, { fn, cap: cap || userFps, next: 0, last: 0 });
  if (!frameScheduler.on) {
    frameScheduler.on = true;
    requestAnimationFrame(frameLoop);
  }
}
export function frameStop(name) {
  frameScheduler.tasks.delete(name);
}
function frameLoop(ts) {
  if (!frameScheduler.tasks.size) {
    frameScheduler.on = false;
    return;
  }
  requestAnimationFrame(frameLoop);
  /* estimate the display refresh rate from quiet frames only, so a busy page doesn't read as a slow screen */
  if (frameScheduler.last && frameScheduler.lastWork < 3) {
    const d = ts - frameScheduler.last;
    if (d > 3 && d < 45) {
      frameScheduler.deltas.push(d);
      if (frameScheduler.deltas.length > 120) frameScheduler.deltas.shift();
      if (frameScheduler.deltas.length >= 30 && frameScheduler.deltas.length % 15 === 0) {
        const s = frameScheduler.deltas.slice().sort((a, b) => a - b),
          hz = 1000 / s[Math.floor(s.length * 0.25)];
        frameScheduler.hz = [30, 48, 60, 75, 90, 100, 120, 144, 165, 240].reduce(
          (a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a),
          60
        );
      }
    }
  }
  frameScheduler.last = ts;
  if (document.hidden) return;
  const w0 = performance.now();
  /* phase 20: one tick a second (every tick while a test measures) has its graphics calls counted; the counters are
     put on and taken off within this tick, so no other frame carries them (engine/gpu-counters.js) */
  const gl = typeof gpuState !== 'undefined' && !gpuState.lost ? gpuState.gl : null,
    counted = !!gl && gpuCountDue(ts) && countersOn(gl);
  try {
    runFrameTasks(ts);
  } finally {
    if (counted) {
      countersOff();
      gpuFrameDone(ts);
    }
  }
  frameScheduler.lastWork = performance.now() - w0;
}
function runFrameTasks(ts) {
  for (const [name, t] of frameScheduler.tasks) {
    const iv = 1000 / Math.max(1, framePace(t.cap()));
    if (ts < t.next - 1.2) continue;
    t.next = ts - t.next > iv * 2 ? ts + iv : t.next + iv;
    const dt = t.last ? ts - t.last : iv;
    t.last = ts;
    const a = performance.now();
    try {
      t.fn(ts, dt);
    } catch (e) {
      console.error(name, e);
      frameScheduler.tasks.delete(name);
    }
    if (typeof debugLog !== 'undefined') debugLog.task(name, performance.now() - a, ts);
  }
}
/* frame-rate meter for the debug overlay (counts battle or map frames) */
export function frameCount(work) {
  const m = frameScheduler.meter,
    now = performance.now();
  m.n++;
  m.work += work || 0;
  if (now - m.t0 >= 500) {
    m.fps = Math.round((m.n * 1000) / (now - m.t0));
    m.workAvg = m.n ? m.work / m.n : 0;
    m.n = 0;
    m.work = 0;
    m.t0 = now;
    if (typeof debugFps === 'function') debugFps();
  }
}
