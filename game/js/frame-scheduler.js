'use strict';
/* ================= FRAME SCHEDULER =================
   One requestAnimationFrame loop drives everything that animates (battle, world map, sprites, sky).
   Each task has its own cap; the battle and map follow the 30 / 60 / 120 FPS setting. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { debugFps, gpuFrame, gpuState, saveData } from './hooks.js';
import { paceDue, paceSlot, paceTask, refreshTick, refreshTracker } from './logic/frame-pace.js';
import { countersOff, countersOn, gpuCountDue, gpuFrameDone } from './engine/gpu-counters.js';
/* eslint-disable no-func-assign */
expose({
  METER_TASKS: [() => METER_TASKS],
  dueFrameTasks: [() => dueFrameTasks, v => (dueFrameTasks = v)],
  frameCount: [() => frameCount, v => (frameCount = v)],
  frameHalf: [() => frameHalf, v => (frameHalf = v)],
  frameLoop: [() => frameLoop, v => (frameLoop = v)],
  frameMeter: [() => frameMeter, v => (frameMeter = v)],
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
  /* FL-1a: the screen's refresh as the page gets it (hz whole, period in ms), from every tick (logic/frame-pace.js) */
  hz: 60,
  period: 1000 / 60,
  pace: refreshTracker(),
  /* FL-1a: the steady half rate (the owner's answer): the tasks that follow the set rate run every other slot; the
     automatic quality's controller (FL-3a) turns it on and off (frameHalf) */
  half: false,
  /* FL-3a: the task whose controller asked for the half rate */
  halfBy: '',
  last: 0,
  lastWork: 0,
  /* FL-1a: the overlay's numbers come from the main drawing task's own runs (the walk view, else the battle, else the
     world map), not from a task of its own */
  meter: { t0: 0, n: 0, fps: 0, work: 0, workAvg: 0, task: '' },
  /* FL-1a: the tick whose graphics calls were counted (their cost is the counters', not the frame's) */
  counted: false,
};
export function userFps() {
  const p = (typeof saveData !== 'undefined' && saveData && saveData.preferences) || {};
  const f = +p.fps;
  return f === 30 || f === 90 || f === 120 ? f : 60;
}
/* v34: frame pacing. FL-1a: a rate as a whole number of the screen's refreshes (logic/frame-pace.js paceSlot), so
   frames come at a steady beat; returns the frames a second it gives */
function framePace(cap) {
  return 1000 / (paceSlot(cap, frameScheduler.period) * frameScheduler.period);
}
/** FL-1a: the steady half rate on or off (the controller, FL-3a); the overlay and the debug log show it. FL-3a: owner
 * names the task that asked for it: when that task stops, the half rate goes with it (frameStop) */
export function frameHalf(on, owner = '') {
  frameScheduler.half = !!on;
  frameScheduler.halfBy = on ? owner : '';
}
/* add or replace a task; cap() returns the frames per second it wants right now */
export function frameTask(name, fn, cap) {
  frameScheduler.tasks.set(name, Object.assign(paceTask(), { fn, cap: cap || userFps, errs: 0, ms: 0 }));
  if (!frameScheduler.on) {
    frameScheduler.on = true;
    requestAnimationFrame(frameLoop);
  }
}
export function frameStop(name) {
  frameScheduler.tasks.delete(name);
  if (frameScheduler.half && frameScheduler.halfBy === name) frameHalf(false);
}
function frameLoop(ts) {
  if (!frameScheduler.tasks.size) {
    frameScheduler.on = false;
    return;
  }
  requestAnimationFrame(frameLoop);
  /* FL-1a: the refresh period from every tick (a busy one says nothing new), re-read when it changes */
  const P = frameScheduler.pace;
  if (refreshTick(P, ts, frameScheduler.lastWork)) {
    frameScheduler.period = P.V;
    frameScheduler.hz = P.hz;
  }
  frameScheduler.last = ts;
  frameScheduler.lastWork = 0;
  if (document.hidden) return;
  const w0 = performance.now();
  /* phase 20 H: retired GPU objects freed, a context that died before its lost event noticed (engine/webgl.js) */
  if (typeof gpuFrame === 'function') gpuFrame();
  const due = dueFrameTasks(ts);
  /* phase 20: one tick a second (every tick while a test measures) has its graphics calls counted; the counters are
     put on and taken off within this tick, so no other frame carries them (engine/gpu-counters.js). FL-1a: only a
     tick with a task to run */
  const gl = due.length && typeof gpuState !== 'undefined' && !gpuState.lost ? gpuState.gl : null,
    counted = !!gl && gpuCountDue(ts) && countersOn(gl);
  frameScheduler.counted = counted;
  try {
    runFrameTasks(ts, due);
  } finally {
    if (counted) {
      countersOff();
      gpuFrameDone(ts);
    }
    frameScheduler.counted = false;
  }
  frameScheduler.lastWork = performance.now() - w0;
  frameMeter(ts);
}
/* FL-1a: the tasks due this tick, each with the time since it last ran (logic/frame-pace.js paceDue: locked to the
   beat, half a refresh early at most, no catch-up after a late frame); a task that follows the set rate takes the
   steady half rate when it is on */
function dueFrameTasks(ts) {
  const out = [],
    V = frameScheduler.period,
    fps = userFps();
  for (const [name, t] of frameScheduler.tasks) {
    /* FL-3b (FL-6's ask): a cap of exactly 0 is a true freeze (paceDue: one frame at once, then none); anything else
       not a number is the 0.1 floor */
    const want = t.cap(),
      cap = want === 0 ? 0 : Math.max(0.1, +want || 0),
      dt = paceDue(t, ts, cap, V, frameScheduler.half && cap === fps);
    if (dt >= 0) out.push([name, t, dt]);
  }
  return out;
}
/* run the due tasks; a task that throws three times running is dropped (FL-1a: once was enough before) */
function runFrameTasks(ts, due = dueFrameTasks(ts)) {
  for (const [name, t, dt] of due) {
    if (frameScheduler.tasks.get(name) !== t) continue;
    const a = performance.now();
    try {
      t.fn(ts, dt);
      t.errs = 0;
    } catch (e) {
      console.error(name, e);
      if (++t.errs >= 3) frameScheduler.tasks.delete(name);
    }
    t.ms = performance.now() - a;
    if (typeof debugLog !== 'undefined') debugLog.task(name, t.ms, ts);
  }
}
/* FL-1a: the main drawing task, the one the overlay and the battle's quality read */
const METER_TASKS = ['dio', 'scene', 'map'];
function frameMeter(ts) {
  const m = frameScheduler.meter,
    name = METER_TASKS.find(n => frameScheduler.tasks.has(n)) || '',
    t = name ? frameScheduler.tasks.get(name) : null;
  if (name !== m.task) {
    m.task = name;
    m.t0 = ts;
    m.n = t ? t.frames : 0;
    m.work = 0;
    return;
  }
  if (t && t.last === ts) m.work += t.ms;
  if (ts - m.t0 < 500) return;
  const n = t ? t.frames - m.n : 0;
  m.fps = Math.round((n * 1000) / (ts - m.t0));
  m.workAvg = n ? m.work / n : 0;
  m.n = t ? t.frames : 0;
  m.work = 0;
  m.t0 = ts;
  if (typeof debugFps === 'function') debugFps();
}
/* the frame-rate meter for the debug overlay. FL-1a: the scheduler meters the main task itself (frameMeter); the
   callers' own counts are no longer needed and left out */
export function frameCount(work) {
  return work;
}
