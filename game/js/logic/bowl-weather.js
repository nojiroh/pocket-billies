// @ts-check
'use strict';
/* ================= THE BOWL'S SKY: WEATHER, CLOUDS, THE INNER SUN'S DAY (phase 10, the look, session 3) =================
   The world map shows the game's own weather (environment.js): each place has the weather of its kind of place, and the
   map spreads it over the place's surroundings, blended between places, so a storm over the coast and a clear sky over
   Copperleaf show at once. Clouds are a fixed set laid out once (deterministic), each shown where the weather there is
   cloudy enough; they circle the bowl slowly with the wind. The Inner Sun circles once a day and dims at night (owner,
   2026-10-19: "circles and dims"). Logic only: no DOM, runs in Node; world-bowl.js draws with it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { bowlSun } from './bowl.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_CLOUD_LEVELS: [() => BOWL_CLOUD_LEVELS],
  BOWL_SKY_KEYS: [() => BOWL_SKY_KEYS],
  BOWL_WEATHER_REACH: [() => BOWL_WEATHER_REACH],
  // @ts-expect-error -- replaced on purpose
  bowlCloudAt: [() => bowlCloudAt, v => (bowlCloudAt = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCloudLayout: [() => bowlCloudLayout, v => (bowlCloudLayout = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCloudLevel: [() => bowlCloudLevel, v => (bowlCloudLevel = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCloudShow: [() => bowlCloudShow, v => (bowlCloudShow = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRand: [() => bowlRand, v => (bowlRand = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSkyAt: [() => bowlSkyAt, v => (bowlSkyAt = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSkyGrid: [() => bowlSkyGrid, v => (bowlSkyGrid = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSunAt: [() => bowlSunAt, v => (bowlSunAt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how each setting draws the sky (owner, 2026-10-19, "as proposed"): how many clouds, at what heights above the
 * ground (bowl radii; 1 = 1000 m), and whether rain, snow and ash fall as particles and lightning flashes */
export const BOWL_CLOUD_LEVELS = {
  off: { count: 0, layers: /** @type {number[]} */ ([]), particles: 0, lightning: false },
  low: { count: 12, layers: [0.07], particles: 160, lightning: false },
  high: { count: 40, layers: [0.07, 0.16], particles: 900, lightning: true },
};
/** @typedef {'off' | 'low' | 'high'} BowlCloudLevel */
/** a weather's look: cloud cover, greyness, rain, storm, snow, fog, ash (as environment.js WEATHER_LOOKS)
 * @typedef {{ cloud?: number, grey?: number, rain?: number, storm?: number, snow?: number, fog?: number,
 *   ash?: number }} BowlWeatherLook */
/** @typedef {{ cloud: number, grey: number, rain: number, storm: number, snow: number, fog: number, ash: number }} BowlSky */
export const BOWL_SKY_KEYS = /** @type {(keyof BowlSky)[]} */ ([
  'cloud',
  'grey',
  'rain',
  'storm',
  'snow',
  'fog',
  'ash',
]);
/** how far a place's weather reaches, in bowl radii (its own ground and a bit beyond) */
export const BOWL_WEATHER_REACH = 0.16;

/** the weather at a point: each place's look weighted by closeness, so weather blends between places
 * @param {{ x: number, y: number, look: BowlWeatherLook }[]} P @param {number} x @param {number} y @returns {BowlSky} */
export function bowlSkyAt(P, x, y) {
  /** @type {BowlSky} */
  const out = { cloud: 0, grey: 0, rain: 0, storm: 0, snow: 0, fog: 0, ash: 0 };
  let tw = 0;
  for (const p of P) {
    const d2 = ((x - p.x) ** 2 + (y - p.y) ** 2) / (BOWL_WEATHER_REACH * BOWL_WEATHER_REACH),
      w = Math.exp(-d2) + 1e-6;
    tw += w;
    for (const k of BOWL_SKY_KEYS) out[k] += (p.look[k] || 0) * w;
  }
  for (const k of BOWL_SKY_KEYS) out[k] = tw ? out[k] / tw : 0;
  return out;
}
/** the weather over the whole bowl on a small grid (n x n, rows north to south like the terrain map), each cell the
 * seven values of bowlSkyAt @param {{ x: number, y: number, look: BowlWeatherLook }[]} P @param {number} [n]
 * @returns {{ n: number, v: Float32Array }} */
export function bowlSkyGrid(P, n = 64) {
  const v = new Float32Array(n * n * BOWL_SKY_KEYS.length);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const s = bowlSkyAt(P, -1 + ((i + 0.5) / n) * 2, 1 - ((j + 0.5) / n) * 2);
      BOWL_SKY_KEYS.forEach((k, q) => (v[(j * n + i) * BOWL_SKY_KEYS.length + q] = s[k]));
    }
  return { n, v };
}

/** a small deterministic random sequence @param {number} seed */
export function bowlRand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}
/** @typedef {{ a: number, r: number, layer: number, size: number, rank: number,
 *   puffs: { dx: number, dy: number, dh: number, s: number }[] }} BowlCloud */
/** the clouds for a setting, laid out once: spread evenly over the bowl (a sunflower), each with a few puffs, a size,
 * its layer, and a rank (0-1) that decides how cloudy the weather must be for it to show
 * @param {BowlCloudLevel} level @param {number} [seed] @returns {BowlCloud[]} */
export function bowlCloudLayout(level, seed = 7) {
  const L = BOWL_CLOUD_LEVELS[level] || BOWL_CLOUD_LEVELS.off,
    rnd = bowlRand(seed),
    /** @type {BowlCloud[]} */ out = [];
  for (let k = 0; k < L.count; k++) {
    const layer = L.layers.length ? k % L.layers.length : 0,
      high = layer > 0,
      a = k * 137.508 + rnd() * 20,
      r = Math.min(0.92, Math.sqrt((k + 0.5) / L.count) * 0.95 + (rnd() - 0.5) * 0.05),
      size = (high ? 0.06 : 0.035) + rnd() * (high ? 0.05 : 0.03),
      n = high ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3),
      puffs = [];
    for (let q = 0; q < n; q++) {
      const t = n > 1 ? q / (n - 1) - 0.5 : 0;
      puffs.push({
        dx: t * size * 1.6 + (rnd() - 0.5) * size * 0.3,
        dy: (rnd() - 0.5) * size * 0.5,
        dh: rnd() * size * 0.25,
        s: size * (0.55 + rnd() * 0.35) * (1 - Math.abs(t) * 0.5),
      });
    }
    out.push({ a, r, layer, size, rank: rnd(), puffs });
  }
  return out;
}
/** where a cloud is now: they circle the bowl with the wind, slower further out (a whole turn takes about
 * 40 minutes at the middle) @param {BowlCloud} c @param {number} t seconds @returns {[number, number]} */
export function bowlCloudAt(c, t) {
  const a = ((c.a + (t * 0.15) / Math.max(0.25, c.r)) * Math.PI) / 180;
  return [c.r * Math.cos(a), c.r * Math.sin(a)];
}
/** how much a cloud shows (0 hidden to 1 full) under the weather there: a cloud shows when the cover beats its rank,
 * fading in over a little range so fronts build and clear smoothly @param {BowlCloud} c @param {BowlSky} s */
export function bowlCloudShow(c, s) {
  const cover = c.layer > 0 ? s.cloud * 0.85 + s.grey * 0.15 : s.cloud;
  return Math.max(0, Math.min(1, (cover - c.rank * 0.9) / 0.15));
}

/** the Inner Sun's day (owner: circles and dims). It goes once round the bowl a day, at its usual slant, highest-lit
 * at midday; at night it dims to a low red glow. @param {number} hour 0-24 @param {number} night 1 full night .. 0 day
 * (environment.js environmentState) @returns {{ dir: [number, number, number], at: [number, number, number],
 *   light: number, az: number }} */
export function bowlSunAt(hour, night) {
  const az = (((135 + (hour - 13) * 15) % 360) + 360) % 360,
    { dir, at } = bowlSun(az);
  return { dir, at, az, light: 1 - 0.85 * Math.max(0, Math.min(1, night)) };
}
/** which setting draws: the player's choice, else from the graphics preset (Beautiful: high, Balanced: low)
 * @param {string | undefined} pref 'auto', 'off', 'low', 'high' @param {string | undefined} aim the graphics aim
 * ('sharp' is Beautiful) @returns {BowlCloudLevel} */
export function bowlCloudLevel(pref, aim) {
  if (pref === 'off' || pref === 'low' || pref === 'high') return pref;
  return aim === 'sharp' ? 'high' : 'low';
}
