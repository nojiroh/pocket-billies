// @ts-check
'use strict';
/* ================= DUCKS (sound track SND-15) =================
   How the music and the beds dip under a jingle, a stinger, a cry or talk: the amounts from music.json mix duck, one
   dip's gain over time, and the points a ducked gain ramps through when dips overlap (the lowest wins). Pure: the
   ducker (audio/mix-chain.js mixDuckerMake) schedules these points on its own gains. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  duckAt: [() => duckAt, v => (duckAt = v)],
  // @ts-expect-error -- replaced on purpose
  duckPoints: [() => duckPoints, v => (duckPoints = v)],
  // @ts-expect-error -- replaced on purpose
  mixDuck: [() => mixDuck, v => (mixDuck = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* SND-15: what a jingle, a stinger, a cry or talk ducks, from music.json mix duck: the music's and the beds' gains (from
   their dB), how fast the dip comes (a, s) and goes (r, s), how long talk holds it after each letter (hold, s). A kind
   the mix leaves out ducks nothing */
/**
 * @param {any} mix music.json mix
 * @param {string} kind jingle, stinger, cry or talk
 */
export function mixDuck(mix, kind) {
  const d = (mix && mix.duck && mix.duck[kind]) || {},
    g = (/** @type {any} */ db) => (typeof db === 'number' ? Math.pow(10, db / 20) : 1);
  return { music: g(d.music), beds: g(d.beds), a: d.attack ?? 0.1, r: d.release ?? 0.8, hold: d.hold ?? 0 };
}
/* SND-15: one dip's gain at time t: 1 until t0, down to g over a seconds, held to its end, back to 1 over r */
/** @typedef {{t0: number, end: number, g: number, a: number, r: number}} SoundDip */
/**
 * @param {SoundDip} d
 * @param {number} t
 */
export function duckAt(d, t) {
  const e = Math.max(d.end, d.t0 + d.a);
  if (t <= d.t0) return 1;
  if (t < d.t0 + d.a) return 1 + ((d.g - 1) * (t - d.t0)) / d.a;
  if (t <= e) return d.g;
  if (t < e + d.r) return d.g + ((1 - d.g) * (t - e)) / d.r;
  return 1;
}
/* SND-15: the points a ducked gain ramps through from now ([time, gain], the first at now): at every dip's corners, the
   lowest of them all (dips that overlap take the lower gain) */
/**
 * @param {SoundDip[]} list
 * @param {number} now
 * @returns {number[][]}
 */
export function duckPoints(list, now) {
  const ts = [now];
  for (const d of list) {
    const e = Math.max(d.end, d.t0 + d.a);
    for (const x of [d.t0, d.t0 + d.a, e, e + d.r]) if (x > now) ts.push(x);
  }
  ts.sort((x, y) => x - y);
  const out = [];
  for (const t of ts) {
    if (out.length && t - out[out.length - 1][0] < 1e-6) continue;
    out.push([t, list.reduce((v, d) => Math.min(v, duckAt(d, t)), 1)]);
  }
  return out;
}
