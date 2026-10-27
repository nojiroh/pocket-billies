// @ts-check
'use strict';
/* ================= AMBIENCE SOUND (sound track SND-8a) =================
   The world's beds of sound made gentle and cheap (sound.js plays them; these are their numbers):
   - their own noise: long seamless loops of pink and brown noise, made once from a seed (the music's one second of
     white noise, looped every second or two, was a pattern the ear learned, and white puts most of its energy where
     hearing is most sensitive);
   - random drift instead of the regular wobbles: a level or a filter wanders to a new random value every few seconds;
   - a bed starts when it is wanted and stops once it has faded to nothing (today's 14 beds ran all the time, silent);
   - the recipes (AMBIENCE_BEDS): each bed a few layers of noise through filters, high-shelved so nothing hisses;
   - events instead of endless tones: crickets chirp in groups with pauses, a fire crackles, one bird calls at a time;
   - footsteps a little different every time, the natural grounds soft;
   - water found by buckets instead of a scan of every water cell;
   - what a bed sounds like at a distance (ambiencePreview), shared by the Sound Test and tools/check-sound.py.
   Logic only: no sound; runs in Node (tools/test/ambience-sound.test.mjs). SND-10 moves the recipes to data. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  AMBIENCE_BEDS: [() => AMBIENCE_BEDS],
  AMBIENCE_FIXED: [() => AMBIENCE_FIXED],
  AMBIENCE_NOISE_RMS: [() => AMBIENCE_NOISE_RMS],
  AMBIENCE_SOFT_GROUND: [() => AMBIENCE_SOFT_GROUND],
  AMBIENCE_SOURCES: [() => AMBIENCE_SOURCES],
  // @ts-expect-error -- replaced on purpose
  ambienceBirdWait: [() => ambienceBirdWait, v => (ambienceBirdWait = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceBuckets: [() => ambienceBuckets, v => (ambienceBuckets = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceChirp: [() => ambienceChirp, v => (ambienceChirp = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceCrackles: [() => ambienceCrackles, v => (ambienceCrackles = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceCrickets: [() => ambienceCrickets, v => (ambienceCrickets = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceDrift: [() => ambienceDrift, v => (ambienceDrift = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceLiveStep: [() => ambienceLiveStep, v => (ambienceLiveStep = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceNearest: [() => ambienceNearest, v => (ambienceNearest = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceNoise: [() => ambienceNoise, v => (ambienceNoise = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceNoiseLoop: [() => ambienceNoiseLoop, v => (ambienceNoiseLoop = v)],
  // @ts-expect-error -- replaced on purpose
  ambiencePlace: [() => ambiencePlace, v => (ambiencePlace = v)],
  // @ts-expect-error -- replaced on purpose
  ambiencePreview: [() => ambiencePreview, v => (ambiencePreview = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceRandom: [() => ambienceRandom, v => (ambienceRandom = v)],
  // @ts-expect-error -- replaced on purpose
  ambienceStep: [() => ambienceStep, v => (ambienceStep = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * a small seeded random number maker (mulberry32): the beds' own, so the music's seeded random is never touched
 * @param {number} seed
 * @returns {() => number}
 */
export function ambienceRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * n samples of noise: white, pink (Paul Kellet's filter: -3 dB an octave) or brown (leaky integrated white: -6 dB an
 * octave, never wandering off)
 * @param {'white' | 'pink' | 'brown'} kind
 * @param {number} n
 * @param {() => number} r
 * @returns {Float32Array}
 */
export function ambienceNoise(kind, n, r) {
  const d = new Float32Array(n);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    last = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return d;
}

/** the loudness (RMS) every noise loop is made at */
export const AMBIENCE_NOISE_RMS = 0.25;

/**
 * a loop of noise with no click where it starts again: sec seconds plus 0.2 s more are made, and the first 0.2 s
 * crossfaded (equal power) with what follows the end; scaled to AMBIENCE_NOISE_RMS
 * @param {'white' | 'pink' | 'brown'} kind
 * @param {number} rate the sample rate (the context's own: WebKit has had distortion on mismatched rates)
 * @param {number} sec
 * @param {number} seed
 * @returns {Float32Array}
 */
export function ambienceNoiseLoop(kind, rate, sec, seed) {
  const len = Math.floor(rate * sec),
    fade = Math.floor(rate * 0.2),
    a = ambienceNoise(kind, len + fade, ambienceRandom(seed)),
    o = a.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const th = (i / fade) * (Math.PI / 2);
    o[i] = a[i] * Math.sin(th) + a[len + i] * Math.cos(th);
  }
  let s = 0;
  for (let i = 0; i < len; i++) s += o[i] * o[i];
  const k = AMBIENCE_NOISE_RMS / (Math.sqrt(s / Math.max(1, len)) || 1);
  for (let i = 0; i < len; i++) o[i] *= k;
  return o;
}

/**
 * @typedef {{on: 'gain' | number, base: number, depth: number, min: number, max: number, tau: number, oct?: boolean}} AmbienceDriftSpec
 *   what wanders (the layer's gain, or the frequency of its filter number on), around base by depth (a fraction, or
 *   octaves with oct), a new value every min-max seconds, reached with the time constant tau
 */
/**
 * a drift's next step: the value to move to, and how long until the one after
 * @param {AmbienceDriftSpec} D
 * @param {() => number} r
 * @returns {{value: number, wait: number}}
 */
export function ambienceDrift(D, r) {
  const u = r() * 2 - 1,
    value = D.oct ? D.base * Math.pow(2, D.depth * u) : Math.max(0, D.base * (1 + D.depth * u));
  return { value, wait: D.min + r() * (D.max - D.min) };
}

/**
 * @typedef {{noise: 'pink' | 'brown', rate?: number, gain: number, filters: Array<['lowpass' | 'highpass' | 'bandpass' | 'highshelf', number, number?, number?]>, drift?: AmbienceDriftSpec[]}} AmbienceLayer
 *   a layer: a noise loop (at a playback rate), through filters [type, frequency, Q, gain dB], at a gain
 * @typedef {{bus: 'world' | 'amb', trim: number, layers: AmbienceLayer[], tone?: number, events?: 'crickets' | 'crackles', eventGain?: number}} AmbienceBed
 *   a bed: where it plays (the World or Ambience slider), its trim (from tools/check-sound.py --loudness), its layers,
 *   a low tone (Hz) under it, its events and their level (eventGain, 1 unless given)
 */
/** @type {Record<string, AmbienceBed>} */
export const AMBIENCE_BEDS = {
  /* crickets: chirps in groups with pauses (ambienceCrickets), two of them at different places, lower than before */
  crickets: { bus: 'amb', trim: 0.74, layers: [], events: 'crickets' },
  /* leaves: a soft rustle that comes and goes in gusts */
  leaves: {
    bus: 'amb',
    trim: 1,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['bandpass', 2400, 0.5],
          ['highpass', 800],
          ['highshelf', 5000, 0.7, -9],
        ],
        drift: [{ on: 'gain', base: 0.7, depth: 0.6, min: 1, max: 4, tau: 0.7 }],
      },
    ],
  },
  /* the town: a low hum of people, two layers that move on their own */
  town: {
    bus: 'amb',
    trim: 1.2,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['bandpass', 380, 0.7],
          ['lowpass', 1000],
        ],
        drift: [{ on: 'gain', base: 0.8, depth: 0.3, min: 1.5, max: 4, tau: 0.8 }],
      },
      {
        noise: 'pink',
        gain: 0.35,
        filters: [
          ['bandpass', 850, 1.4],
          ['highshelf', 2500, 0.7, -9],
        ],
        drift: [
          { on: 'gain', base: 0.7, depth: 0.6, min: 0.4, max: 1.6, tau: 0.25 },
          { on: 0, base: 850, depth: 0.35, min: 0.5, max: 2, tau: 0.3, oct: true },
        ],
      },
    ],
  },
  cave: {
    bus: 'amb',
    trim: 0.54,
    tone: 49,
    layers: [
      {
        noise: 'brown',
        rate: 0.5,
        gain: 1,
        filters: [['lowpass', 140]],
        drift: [{ on: 'gain', base: 1, depth: 0.3, min: 3, max: 8, tau: 2 }],
      },
    ],
  },
  room: {
    bus: 'amb',
    trim: 0.59,
    layers: [
      {
        noise: 'brown',
        rate: 0.6,
        gain: 1,
        filters: [
          ['lowpass', 260],
          ['highpass', 40],
        ],
      },
    ],
  },
  stream: {
    bus: 'world',
    trim: 1,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['bandpass', 950, 1.1],
          ['highshelf', 4000, 0.7, -6],
        ],
        drift: [
          { on: 0, base: 950, depth: 0.55, min: 0.12, max: 0.5, tau: 0.08, oct: true },
          { on: 'gain', base: 1, depth: 0.25, min: 0.2, max: 0.9, tau: 0.12 },
        ],
      },
    ],
  },
  falls: {
    bus: 'world',
    trim: 0.37,
    layers: [
      {
        noise: 'brown',
        rate: 0.8,
        gain: 1,
        filters: [
          ['lowpass', 1000],
          ['highpass', 90],
        ],
      },
    ],
  },
  /* the sea: two layers that swell on their own, never in step */
  sea: {
    bus: 'world',
    trim: 0.56,
    layers: [
      {
        noise: 'brown',
        gain: 0.8,
        filters: [
          ['lowpass', 500],
          ['highpass', 50],
        ],
        drift: [{ on: 'gain', base: 0.8, depth: 0.55, min: 4, max: 9, tau: 2.2 }],
      },
      {
        noise: 'pink',
        gain: 0.4,
        filters: [
          ['lowpass', 900],
          ['highpass', 150],
        ],
        drift: [{ on: 'gain', base: 0.4, depth: 0.6, min: 3, max: 8, tau: 1.8 }],
      },
    ],
  },
  pond: {
    bus: 'world',
    trim: 1.6,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [['bandpass', 520, 1.4]],
        drift: [{ on: 'gain', base: 1, depth: 0.35, min: 2, max: 5, tau: 1 }],
      },
    ],
  },
  fountain: {
    bus: 'world',
    trim: 1,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['bandpass', 1300, 0.6],
          ['highshelf', 3500, 0.7, -8],
        ],
        drift: [
          { on: 0, base: 1300, depth: 0.25, min: 0.3, max: 1.2, tau: 0.3, oct: true },
          { on: 'gain', base: 1, depth: 0.15, min: 0.3, max: 1.5, tau: 0.3 },
        ],
      },
    ],
  },
  /* a fire: a low roar, a faint hiss, and crackles at random (ambienceCrackles), the crackles over the roar: a phone's
     speaker hears mids, not a roar under 220 Hz */
  fire: {
    bus: 'world',
    trim: 1,
    events: 'crackles',
    eventGain: 12,
    layers: [
      {
        noise: 'brown',
        gain: 0.35,
        filters: [['lowpass', 220]],
        drift: [{ on: 'gain', base: 0.35, depth: 0.35, min: 0.4, max: 1.6, tau: 0.35 }],
      },
      {
        noise: 'pink',
        gain: 0.12,
        filters: [
          ['highpass', 1200],
          ['highshelf', 4000, 0.7, -8],
        ],
      },
    ],
  },
  lava: {
    bus: 'world',
    trim: 0.51,
    layers: [
      {
        noise: 'brown',
        rate: 0.6,
        gain: 1,
        filters: [['lowpass', 260]],
        drift: [{ on: 'gain', base: 1, depth: 0.4, min: 1, max: 3, tau: 0.6 }],
      },
    ],
  },
  /* rain: a soft wash (pink, high-passed, the highs shelved down) over a low rumble, the wash drifting a little */
  rain: {
    bus: 'world',
    trim: 0.38,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['highpass', 350],
          ['lowpass', 4500, 0.5],
          ['highshelf', 3000, 0.7, -6],
        ],
        drift: [{ on: 'gain', base: 1, depth: 0.12, min: 2, max: 6, tau: 1.5 }],
      },
      { noise: 'brown', gain: 0.55, filters: [['lowpass', 700]] },
    ],
  },
  wind: {
    bus: 'world',
    trim: 1,
    layers: [
      {
        noise: 'pink',
        gain: 1,
        filters: [
          ['bandpass', 520, 0.8],
          ['highshelf', 2500, 0.7, -9],
        ],
        drift: [
          { on: 'gain', base: 0.7, depth: 0.6, min: 1.5, max: 5, tau: 1 },
          { on: 0, base: 520, depth: 0.5, min: 1.5, max: 5, tau: 1.2, oct: true },
        ],
      },
    ],
  },
};

/**
 * a bed starting and stopping: it starts as soon as it is wanted, and stops only once it has been wanted at nothing
 * for 2.5 s (its level then has faded under -60 dB, so stopping never clicks). The state is kept between calls
 * @param {{live?: boolean, quiet?: number | null}} st
 * @param {number} target the level asked for
 * @param {number} t the time (s)
 * @returns {'start' | 'stop' | null}
 */
export function ambienceLiveStep(st, target, t) {
  if (target > 1e-4) {
    st.quiet = null;
    if (st.live) return null;
    st.live = true;
    return 'start';
  }
  if (!st.live) return null;
  if (st.quiet == null) st.quiet = t;
  if (t - st.quiet < 2.5) return null;
  st.live = false;
  st.quiet = null;
  return 'stop';
}

/**
 * crickets: each chirps in groups (6-14 chirps 0.55-0.75 s apart), then rests 2-7 s. The chirps due before t1, from
 * where each cricket's state left off (never before t0)
 * @param {Array<{next: number, left: number}>} crickets each one's state
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @returns {Array<{t: number, who: number, gain: number}>}
 */
export function ambienceCrickets(crickets, t0, t1, r) {
  const out = [];
  crickets.forEach((k, who) => {
    if (k.next < t0) k.next = t0;
    while (k.next < t1) {
      if (k.left <= 0) {
        k.left = 6 + Math.floor(r() * 9);
        k.next += 2 + r() * 5;
        continue;
      }
      out.push({ t: k.next, who, gain: 0.8 + r() * 0.2 });
      k.left--;
      k.next += 0.55 + r() * 0.2;
    }
  });
  return out;
}

/**
 * a chirp: three short pulses of a sine, each faded in and out (Hann), 30 ms apart
 * @param {number} rate
 * @param {number} f
 * @param {number} seed
 * @returns {Float32Array}
 */
export function ambienceChirp(rate, f, seed) {
  const n = Math.floor(0.09 * rate),
    d = new Float32Array(n),
    ph = ambienceRandom(seed)() * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    const s = Math.floor(k * 0.03 * rate),
      L = Math.floor(0.016 * rate);
    for (let i = 0; i < L && s + i < n; i++)
      d[s + i] += Math.sin(ph + (2 * Math.PI * f * (s + i)) / rate) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / L));
  }
  return d;
}

/**
 * a fire's crackles: clusters of one to three snaps, about 3.5 clusters a second at random (Poisson), each snap a
 * few milliseconds of band-passed noise at a random pitch and mostly quiet
 * @param {{next: number}} st
 * @param {number} t0
 * @param {number} t1
 * @param {() => number} r
 * @returns {Array<{t: number, f: number, q: number, d: number, gain: number, pan: number}>}
 */
export function ambienceCrackles(st, t0, t1, r) {
  const out = [];
  if (st.next < t0) st.next = t0;
  while (st.next < t1) {
    const k = 1 + Math.floor(r() * 3),
      pan = Math.floor(r() * 3) - 1;
    for (let i = 0; i < k; i++)
      out.push({
        t: st.next + i * (0.015 + r() * 0.05),
        f: 1300 + r() * 3200,
        q: 1 + r() * 2,
        d: 0.004 + r() * 0.012,
        gain: 0.15 + 0.85 * Math.pow(r(), 2.5),
        pan: pan * 0.25,
      });
    st.next += -Math.log(1 - r()) / 3.5;
  }
  return out;
}

/**
 * birds: one at a time. After a call ends, how long until the next may start: about 6-14 s outside towns (one in ten
 * seconds or so), 14-30 s in a town
 * @param {() => number} r
 * @param {boolean} town
 * @returns {number}
 */
export function ambienceBirdWait(r, town) {
  return town ? 14 + r() * 16 : 6 + r() * 8;
}

/** the grounds that take the soft step: grass of every kind, lawn, flowers, forest floor, leaf litter, moss, sand, dirt, mud, marsh, soil, ash */
export const AMBIENCE_SOFT_GROUND = 'gGftlyLMCHEFJBRsSNuDoAzZ';

/**
 * a footstep's sounds: a soft thump on the natural grounds, hollow boards on a bridge, a click on stone and paving;
 * each step a little different (its pitch by up to 10 %, its level by up to 2 dB), the feet a little left and right
 * @param {string} ter the ground (a terrain code; 'wet' and 'n' snow are their own)
 * @param {() => number} r
 * @param {number} foot 0 or 1
 * @returns {{pan: number, hits: Array<{at: number, dur: number, vol: number, bp?: number, lp?: number, hp?: number, q?: number}>}}
 */
export function ambienceStep(ter, r, foot) {
  const k = 0.9 + r() * 0.2,
    v = Math.pow(10, ((r() * 2 - 1) * 2) / 20),
    pan = foot ? 0.08 : -0.08;
  if (ter === 'n')
    return {
      pan,
      hits: [
        { at: 0, dur: 0.07, vol: 0.07 * v, bp: 2600 * k, q: 0.9 },
        { at: 0.025, dur: 0.05, vol: 0.05 * v, bp: 4200 * k, q: 1.2 },
      ],
    };
  if (ter === 'wet')
    return {
      pan,
      hits: [
        { at: 0, dur: 0.09, vol: 0.07 * v, bp: 1500 * k, q: 0.5 },
        { at: 0.03, dur: 0.06, vol: 0.04 * v, hp: 5000 * k },
      ],
    };
  if (ter === 'b') return { pan, hits: [{ at: 0, dur: 0.06, vol: 0.08 * v, bp: 520 * k, q: 2.2 }] };
  if (AMBIENCE_SOFT_GROUND.includes(ter))
    return {
      pan,
      hits: [
        { at: 0, dur: 0.07, vol: 0.14 * v, lp: 380 * k, q: 0.7 },
        { at: 0.008, dur: 0.05, vol: 0.22 * v, bp: 1100 * k, q: 0.9 },
      ],
    };
  return { pan, hits: [{ at: 0, dur: 0.035, vol: 0.07 * v, bp: 2200 * k, q: 1.4 }] };
}

/**
 * water cells in buckets of size metres, so the nearest one is found by looking only near you
 * @param {ArrayLike<number>[]} cells each [x, z, ...]
 * @param {number} [size]
 * @returns {{size: number, n: number, map: Map<number, ArrayLike<number>[]>}}
 */
export function ambienceBuckets(cells, size = 4) {
  const map = new Map();
  for (const c of cells) {
    const key = (Math.floor(c[0] / size) + 32768) * 65536 + (Math.floor(c[1] / size) + 32768);
    let L = map.get(key);
    if (!L) map.set(key, (L = []));
    L.push(c);
  }
  return { size, n: cells.length, map };
}

/**
 * the nearest cell within range of (x, z), and how far it is; null when none is
 * @param {{size: number, map: Map<number, ArrayLike<number>[]>}} B
 * @param {number} x
 * @param {number} z
 * @param {number} range
 * @returns {{cell: ArrayLike<number>, d: number} | null}
 */
export function ambienceNearest(B, x, z, range) {
  const s = B.size,
    i0 = Math.floor((x - range) / s),
    i1 = Math.floor((x + range) / s),
    j0 = Math.floor((z - range) / s),
    j1 = Math.floor((z + range) / s);
  /** @type {{cell: ArrayLike<number>, d: number} | null} */
  let best = null;
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const L = B.map.get((i + 32768) * 65536 + (j + 32768));
      if (!L) continue;
      for (const c of L) {
        const d = Math.hypot(c[0] - x, c[1] - z);
        if (d <= range && (!best || d < best.d)) best = { cell: c, d };
      }
    }
  return best;
}

/** the sources placed in a scene: how far each is heard (m) and its level at the source */
export const AMBIENCE_SOURCES = {
  stream: { range: 10, gain: 0.5 },
  falls: { range: 14, gain: 0.7 },
  sea: { range: 8, gain: 0.6 },
  pond: { range: 6, gain: 0.22 },
  lava: { range: 10, gain: 0.5 },
  fountain: { range: 9, gain: 0.45 },
  fire: { range: 7, gain: 0.35 },
};
/** the beds set by the place, not by a distance (as updateAmbience and ambienceBeds set them at their fullest) */
export const AMBIENCE_FIXED = {
  /* the sea anywhere in a sea scene: SND-8a lowered it (0.35 before) so the coast is heard near the water, not all over */
  sea_coast: { bed: 'sea', gain: 0.2 },
  rain: { bed: 'rain', gain: 0.42 },
  wind: { bed: 'wind', gain: 0.4 },
  leaves: { bed: 'leaves', gain: 0.22 },
  crickets: { bed: 'crickets', gain: 0.11 },
  town: { bed: 'town', gain: 0.13 },
  cave: { bed: 'cave', gain: 0.3 },
  room: { bed: 'room', gain: 0.16 },
};

/**
 * how loud a source is at a distance: (1 - d / range)^1.6, 0 beyond its range
 * @param {number} d
 * @param {number} range
 * @returns {number}
 */
export function ambiencePlace(d, range) {
  return d > range ? 0 : Math.pow(1 - d / range, 1.6);
}

/**
 * the beds' levels for a list of sounds, each at a distance, as the game would set them (the Sound Test and the
 * loudness report play them): [kind, metres], kind a source (AMBIENCE_SOURCES), a place's bed (AMBIENCE_FIXED), or
 * 'birds' and 'steps' (events, not beds: left out here)
 * @param {Array<[string, number]>} list
 * @returns {Record<string, number>}
 */
export function ambiencePreview(list) {
  /** @type {Record<string, number>} */
  const T = {};
  /** @type {Record<string, {range: number, gain: number}>} */
  const S = AMBIENCE_SOURCES;
  /** @type {Record<string, {bed: string, gain: number}>} */
  const F = AMBIENCE_FIXED;
  for (const [k, d] of list) {
    const s = S[k],
      f = F[k];
    if (s) T[k] = Math.max(T[k] || 0, ambiencePlace(d, s.range) * s.gain);
    else if (f) T[f.bed] = Math.max(T[f.bed] || 0, f.gain);
  }
  return T;
}
