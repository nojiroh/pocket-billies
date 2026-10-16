'use strict';
/* ================= FRAME SCHEDULER =================
   One requestAnimationFrame loop drives everything that animates (battle, world map, sprites, sky).
   Each task has its own cap; the battle and map follow the 30 / 60 / 120 FPS setting. */
const FRAME = {
  tasks: new Map(),
  on: false,
  hz: 60,
  deltas: [],
  last: 0,
  lastWork: 0,
  meter: { t0: 0, n: 0, fps: 0, work: 0, workAvg: 0 },
};
function userFps() {
  const p = (typeof S !== 'undefined' && S && S.preferences) || {};
  const f = +p.fps;
  return f === 30 || f === 90 || f === 120 ? f : 60;
}
/* v34: frame pacing. A rate is held to an even share of the screen's own (120 on a 120 Hz screen, 60 on it as every
   second frame, 90 there as 120/1 ... rounded to 60), so frames come at a steady beat instead of 2-1-2-1 */
function framePace(cap) {
  const hz = FRAME.hz || 60;
  if (cap >= hz - 1) return hz;
  if (cap <= 12) return cap;
  const k = Math.max(1, Math.round(hz / cap));
  return hz / k;
}
/* add or replace a task; cap() returns the frames per second it wants right now */
function frameTask(name, fn, cap) {
  FRAME.tasks.set(name, { fn, cap: cap || userFps, next: 0, last: 0 });
  if (!FRAME.on) {
    FRAME.on = true;
    requestAnimationFrame(frameLoop);
  }
}
function frameStop(name) {
  FRAME.tasks.delete(name);
}
function frameLoop(ts) {
  if (!FRAME.tasks.size) {
    FRAME.on = false;
    return;
  }
  requestAnimationFrame(frameLoop);
  /* estimate the display refresh rate from quiet frames only, so a busy page doesn't read as a slow screen */
  if (FRAME.last && FRAME.lastWork < 3) {
    const d = ts - FRAME.last;
    if (d > 3 && d < 45) {
      FRAME.deltas.push(d);
      if (FRAME.deltas.length > 120) FRAME.deltas.shift();
      if (FRAME.deltas.length >= 30 && FRAME.deltas.length % 15 === 0) {
        const s = FRAME.deltas.slice().sort((a, b) => a - b),
          hz = 1000 / s[Math.floor(s.length * 0.25)];
        FRAME.hz = [30, 48, 60, 75, 90, 100, 120, 144, 165, 240].reduce(
          (a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a),
          60
        );
      }
    }
  }
  FRAME.last = ts;
  if (document.hidden) return;
  const w0 = performance.now();
  for (const [name, t] of FRAME.tasks) {
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
      FRAME.tasks.delete(name);
    }
    if (typeof NWLOG !== 'undefined') NWLOG.task(name, performance.now() - a, ts);
  }
  FRAME.lastWork = performance.now() - w0;
}
/* frame-rate meter for the debug overlay (counts battle or map frames) */
function frameCount(work) {
  const m = FRAME.meter,
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
