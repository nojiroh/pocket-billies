/* ================= TIME OF DAY: FIVE LOOKS =================
   0.1.0 alpha (the owner: "around 5 specific times of day that I can tweak and stylize in the Studio"): the light of a
   walk scene comes from five looks, dawn, day, golden hour, dusk and night, blended by the hour. Each look is an engine
   group (todDawn ... todNight in ENGINE_DEFAULTS, game/data/engine.json, the Studio's Engine page). A look sits at an
   hour tied to the season's sunrise or sunset (dawn and day: sunrise; golden hour, dusk and night: sunset) plus its
   own `at` (hours, may be negative), and is reached over its `blend` hours: before that the previous look holds. Colours
   blend in linear light. Weather, the scene's own look and the player's dials stay on top (environment.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ANCHOR: [() => ANCHOR],
  NEUTRAL: [() => NEUTRAL],
  TIME_OF_DAY_COLOURS: [() => TIME_OF_DAY_COLOURS],
  TIME_OF_DAY_DEFAULTS: [() => TIME_OF_DAY_DEFAULTS],
  TIME_OF_DAY_GROUPS: [() => TIME_OF_DAY_GROUPS],
  TIME_OF_DAY_KEYS: [() => TIME_OF_DAY_KEYS],
  gam: [() => gam],
  lin: [() => lin],
  smooth: [() => smooth],
  timeOfDayHours: [() => timeOfDayHours, v => (timeOfDayHours = v)],
  timeOfDayLook: [() => timeOfDayLook, v => (timeOfDayLook = v)],
  todHexRgb: [() => todHexRgb, v => (todHexRgb = v)],
  wrap: [() => wrap],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const TIME_OF_DAY_KEYS = ['dawn', 'day', 'golden', 'dusk', 'night'];
/** the engine group of each look */
export const TIME_OF_DAY_GROUPS = {
  dawn: 'todDawn',
  day: 'todDay',
  golden: 'todGolden',
  dusk: 'todDusk',
  night: 'todNight',
};
export const ANCHOR = { dawn: 'rise', day: 'rise', golden: 'set', dusk: 'set', night: 'set' };
/** the fields that are colours ('#rrggbb'); every other field is a number */
export const TIME_OF_DAY_COLOURS = [
  'skyTop',
  'skyMid',
  'skyLow',
  'sunColor',
  'ambientColor',
  'haze',
  'shadowTint',
  'lightTint',
];
/* the built-in values: the numbers of the starting looks, and no colours (null: the scene's own sky and haze, white
   light, no tint). The colours are game data (game/data/engine.json todDawn ... todNight), so the stylized looks live
   with the rest of the engine's look and the Studio edits them: golden hour warm with teal shadows, dusk pink and
   violet, night deep blue with warm lamps */
export const TIME_OF_DAY_DEFAULTS = {
  dawn: {
    at: 0.2,
    blend: 1.4,
    skyTop: null,
    skyMid: null,
    skyLow: null,
    skyMix: 0.8,
    sunColor: null,
    sun: 0.75,
    ambient: 0.85,
    ambientColor: null,
    haze: null,
    hazeMix: 0.6,
    hazeDistance: 0.8,
    mist: 0.3,
    exposure: 1.02,
    saturation: 1,
    contrast: 0.98,
    warmth: 0.1,
    shadow: 0.7,
    shadowTint: null,
    lightTint: null,
    tintStrength: 0.6,
    bloom: 1.15,
    lamps: 0.35,
    stars: 0.15,
  },
  day: {
    at: 3,
    blend: 2.5,
    skyTop: null,
    skyMid: null,
    skyLow: null,
    skyMix: 0,
    sunColor: null,
    sun: 1,
    ambient: 1,
    ambientColor: null,
    haze: null,
    hazeMix: 0,
    hazeDistance: 1,
    mist: 0,
    exposure: 1,
    saturation: 1,
    contrast: 1,
    warmth: 0,
    shadow: 1,
    shadowTint: null,
    lightTint: null,
    tintStrength: 0,
    bloom: 1,
    lamps: 0,
    stars: 0,
  },
  golden: {
    at: -1.4,
    blend: 2,
    skyTop: null,
    skyMid: null,
    skyLow: null,
    skyMix: 0.55,
    sunColor: null,
    sun: 1.25,
    ambient: 0.9,
    ambientColor: null,
    haze: null,
    hazeMix: 0.5,
    hazeDistance: 0.9,
    mist: 0,
    exposure: 1.03,
    saturation: 1.12,
    contrast: 1.06,
    warmth: 0.3,
    shadow: 1.05,
    shadowTint: null,
    lightTint: null,
    tintStrength: 0.8,
    bloom: 1.25,
    lamps: 0.1,
    stars: 0,
  },
  dusk: {
    at: 0.4,
    blend: 1.2,
    skyTop: null,
    skyMid: null,
    skyLow: null,
    skyMix: 0.9,
    sunColor: null,
    sun: 0.55,
    ambient: 0.7,
    ambientColor: null,
    haze: null,
    hazeMix: 0.7,
    hazeDistance: 0.75,
    mist: 0.05,
    exposure: 1.05,
    saturation: 1.02,
    contrast: 1.02,
    warmth: 0.18,
    shadow: 0.75,
    shadowTint: null,
    lightTint: null,
    tintStrength: 0.7,
    bloom: 1.25,
    lamps: 0.7,
    stars: 0.3,
  },
  night: {
    at: 1.8,
    blend: 1.5,
    skyTop: null,
    skyMid: null,
    skyLow: null,
    skyMix: 0.95,
    sunColor: null,
    sun: 0.38,
    ambient: 0.55,
    ambientColor: null,
    haze: null,
    hazeMix: 0.85,
    hazeDistance: 0.7,
    mist: 0,
    exposure: 1.18,
    saturation: 0.82,
    contrast: 1.04,
    warmth: -0.12,
    shadow: 0.6,
    shadowTint: null,
    lightTint: null,
    tintStrength: 0.7,
    bloom: 1.2,
    lamps: 1,
    stars: 1,
  },
};

/** '#rrggbb' to [r, g, b] in 0-1 (none or a bad value: null) */
export function todHexRgb(h) {
  const m = typeof h === 'string' && /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const NEUTRAL = {
  sunColor: [1, 1, 1],
  ambientColor: [1, 1, 1],
  shadowTint: [0.5, 0.5, 0.5],
  lightTint: [0.5, 0.5, 0.5],
};
export const lin = v => Math.pow(v, 2.2),
  gam = v => Math.pow(Math.max(0, v), 1 / 2.2);
export const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const wrap = h => ((h % 24) + 24) % 24;

/**
 * Each look's hour (0-24) and blend, in the day's order from dawn.
 * @param {Record<string, any>} T the five looks (missing fields from TIME_OF_DAY_DEFAULTS)
 * @param {number} rise sunrise hour
 * @param {number} set sunset hour
 */
export function timeOfDayHours(T, rise, set) {
  const base = { rise, set };
  return TIME_OF_DAY_KEYS.map(k => {
    const o = { ...TIME_OF_DAY_DEFAULTS[k], ...((T && T[k]) || {}) };
    return { k, at: wrap(base[ANCHOR[k]] + (+o.at || 0)), blend: Math.max(0.05, +o.blend || 0) };
  });
}

/**
 * The look at hour h: every number blended, every colour as [r, g, b] (0-1), and `w`, each look's share.
 * @param {Record<string, any>} T the five looks
 * @param {number} h the hour (0-24)
 * @param {number} rise
 * @param {number} set
 */
export function timeOfDayLook(T, h, rise, set) {
  const H = timeOfDayHours(T, rise, set),
    x = wrap(h);
  /* the look whose hour came last, going back round midnight if need be */
  let i = 0,
    best = 1e9;
  H.forEach((e, j) => {
    const d = wrap(x - e.at);
    if (d < best) {
      best = d;
      i = j;
    }
  });
  const a = H[i],
    b = H[(i + 1) % H.length],
    gap = wrap(b.at - a.at) || 24,
    span = Math.min(b.blend, gap),
    t = smooth((best - (gap - span)) / span);
  const A = { ...TIME_OF_DAY_DEFAULTS[a.k], ...((T && T[a.k]) || {}) },
    B = { ...TIME_OF_DAY_DEFAULTS[b.k], ...((T && T[b.k]) || {}) };
  /** @type {Record<string, any>} */
  const out = { w: Object.fromEntries(TIME_OF_DAY_KEYS.map(k => [k, 0])), from: a.k, to: b.k, t };
  out.w[a.k] += 1 - t;
  out.w[b.k] += t;
  for (const f of Object.keys(TIME_OF_DAY_DEFAULTS.day)) {
    if (f === 'at' || f === 'blend') continue;
    if (TIME_OF_DAY_COLOURS.includes(f)) {
      /* a look without the colour: the sky and haze are the scene's own (their mix is 0 there, so the other look's
         colour is used as it fades in), the light is white, a tint is none */
      const scene = f === 'skyTop' || f === 'skyMid' || f === 'skyLow' || f === 'haze',
        p = todHexRgb(A[f]) || (scene ? todHexRgb(B[f]) : NEUTRAL[f]),
        q = todHexRgb(B[f]) || (scene ? todHexRgb(A[f]) : NEUTRAL[f]);
      out[f] = p && q ? p.map((v, n) => gam(lin(v) + (lin(q[n]) - lin(v)) * t)) : null;
    } else {
      const p = +A[f] || 0,
        q = +B[f] || 0;
      out[f] = p + (q - p) * t;
    }
  }
  return out;
}
