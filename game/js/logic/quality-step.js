/* ================= AUTOMATIC QUALITY: ONE STEP =================
   The decision walk/quality-cull.js adaptQuality takes about once a second, as a pure function so it can be tested:
   given the quality state (q 0-4, resolution R 0.5-1 and the timers) and the frame's numbers, it changes the state.
   q steps take away effects that cost the graphics chip (1: fast blur, no AO; 2: shadows and reflections every other
   frame; 3: fewer bloom levels, no rays; 4: cheap blur); then R lowers the resolution. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  propDrawFade: [() => propDrawFade, v => (propDrawFade = v)],
  qualityStep: [() => qualityStep, v => (qualityStep = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{ q: number, R: number, adaptT?: number, swapT?: number, raiseT?: number, holdT?: number, roomN?: number }} QualityState
 * @typedef {{ int: number, slow: number, target: number, now: number, phone?: boolean }} QualityInput
 *   int: the smoothed time between frames (ms); slow: the frame's own work on the main thread (ms); target: the
 *   frame time wanted (ms); now: performance.now(); phone: an Android phone or iPhone, where a wait on the graphics
 *   chip shows up as main-thread time
 */

/**
 * @param {QualityState} s changed in place
 * @param {QualityInput} i
 * @returns {QualityState}
 */
export function qualityStep(s, i) {
  const { int, slow: work, target, now } = i;
  /* alpha 0.4: the first 3 s after a view changes don't push it down, it comes back up while the frames keep the beat
     with work under 60% of a frame, and a step that proved too much is held off for half a minute (no see-sawing) */
  const slow = int > target * 1.3 || work > target * 0.85,
    room = int < target * 1.1 && work < target * 0.6;
  if (now - (s.adaptT || 0) < (slow ? 1200 : 900)) return s;
  s.adaptT = now;
  s.q = s.q || 0;
  /* alpha 0.4.1: when the frame's own work on the main thread is what holds it back, taking away god rays, bloom steps,
     depth of field or resolution doesn't help: those cost the graphics chip. Then only the steps that save work here
     are taken (shadows and reflections every other frame, steps 1-2), and the ones above come back. */
  /* 0.1.0 alpha: on a phone the browser hands every graphics call to another process and waits for it when it falls
     behind, so a frame the graphics chip holds up looks like main-thread work there (the Android phone: frames of
     50-60 ms, the resolution pushed back to 1 every second all session). There, once steps 1-2 are taken, a slow
     frame goes on to the graphics steps and the resolution (not below 0.6), and the resolution is never raised for it */
  const cpu = work > target * 0.7 && !(i.phone && s.q >= 2);
  if (slow && cpu) {
    if (s.q > 2) {
      s.q = 2;
      s.raiseT = now;
    } else if (s.q < 2 && now - (s.swapT || 0) >= 3000) s.q++;
    s.roomN = 0;
    if (s.R < 1 && !i.phone) s.R = Math.min(1, s.R + 0.1);
    return s;
  }
  if (slow) {
    if (now - (s.swapT || 0) < 3000) return s;
    if (now - (s.raiseT || -1e9) < 5000) s.holdT = now + 30000;
    s.roomN = 0;
    if (s.q < 4) s.q++;
    else if (s.R > (i.phone ? 0.65 : 0.55)) s.R = Math.max(i.phone ? 0.6 : 0.5, s.R - 0.1);
  } else if (room && now > (s.holdT || 0)) {
    if (s.R < 1) {
      s.R = Math.min(1, s.R + 0.1);
      s.raiseT = now;
    } else if (s.q > 0 && (s.roomN = (s.roomN || 0) + 1) >= 2) {
      s.q--;
      s.roomN = 0;
      s.raiseT = now;
    }
  }
  return s;
}

/* 0.1.0 alpha: how much of a small prop to draw (0 = skip it, 1 = all), from its size on screen and, on a phone, its
   distance. A thing under minPx pixels tall can't be seen anyway; on a phone, small things (under smallR metres
   across: flowers, tufts, pebbles, crates) fade out over the last 8 m before phoneDistance (0: no limit), where the
   haze has mostly hidden them (a phone held upright sees far down the town: about 1,000 things in view against an
   iPad's 230) */
/**
 * @param {{ r: number, depth: number, px: number }} it r: radius (m); depth: distance from the camera (m); px: height on
 *   screen (pixels)
 * @param {{ minPx: number, phoneDistance: number, phone: boolean, smallR?: number }} o
 * @returns {number}
 */
export function propDrawFade(it, o) {
  if (o.minPx > 0 && it.px < o.minPx) return 0;
  if (!o.phone || !(o.phoneDistance > 0) || it.r >= (o.smallR ?? 1)) return 1;
  const k = (o.phoneDistance - it.depth) / 8;
  return k >= 1 ? 1 : k <= 0 ? 0 : k;
}
