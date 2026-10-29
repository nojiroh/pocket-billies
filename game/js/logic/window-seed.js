// @ts-check
'use strict';
/* ================= WINDOW SEED (assets track AS-1) =================
   Which of a low-poly model's windows are lit and in which colour (prop-models.js GLASS_GLSL reads the seed,
   walk/lighting.js modelWindowLight the lit bits). A building stands still, so its windows are rolled by where it
   stands, as before (the same numbers, so every building looks as it did). A model that moves (the sky train on its
   ride: its placement says `moving` or `trainRide`) is rolled by its own key and each window's place on the model
   instead, so its windows keep their colour and lit state however far it travels (they re-rolled every centimetre
   and strobed). Logic only: no DOM (tools/test/window-seed.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  movingWindowSpot: [() => movingWindowSpot, v => (movingWindowSpot = v)],
  // @ts-expect-error -- replaced on purpose
  windowKeySeed: [() => windowKeySeed, v => (windowKeySeed = v)],
  // @ts-expect-error -- replaced on purpose
  windowSeed: [() => windowSeed, v => (windowSeed = v)],
  // @ts-expect-error -- replaced on purpose
  windowsMove: [() => windowsMove, v => (windowsMove = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a placement that moves about (a ride's train), so its windows go by its key, not its place
 * @param {{ moving?: unknown, trainRide?: unknown } | null | undefined} p */
export function windowsMove(p) {
  return !!(p && (p.moving || p.trainRide));
}

/** 0..1 from a string (FNV-1a), the same every time @param {string} s */
export function windowKeySeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** the colour seed a model's windows share (0..1): a still one's from where it stands (the old hash, unchanged), a
 * moving one's from its placement's id, else its catalogue key
 * @param {{ x: number, z: number, p?: { id?: unknown, k?: unknown, moving?: unknown, trainRide?: unknown } }} it */
export function windowSeed(it) {
  if (windowsMove(it.p)) return windowKeySeed(String((it.p && (it.p.id || it.p.k)) || ''));
  return (Math.abs(Math.sin(it.x * 12.9898 + it.z * 78.233)) * 43.7585) % 1;
}

/** where a moving model's window is rolled for "lit at this hour" (environment.js environmentWindowLit takes x and
 * z): its place on the model (metres, before the size and turn) moved by the model's seed, so two trains differ
 * @param {number} seed windowSeed @param {number[]} wp the window's place [x, up, back] @returns {[number, number]} */
export function movingWindowSpot(seed, wp) {
  return [wp[0] + seed * 97.13 + wp[1] * 0.37, wp[2] + seed * 61.7 - wp[1] * 0.29];
}
