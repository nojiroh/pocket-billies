// @ts-check
'use strict';
/* ================= RANDOM NUMBERS (roguelite track RL-2) =================
   The one seedable random source for game outcomes: a string hash (FNV-1a) and a small fast generator (sfc32) started
   from (seed, salt). The same seed and salt always give the same stream; another salt gives an independent one. Moved
   unchanged from logic/mapgen.js (map generator MG-1), so every generated scene stays the same. Logic only: no DOM,
   no Math.random, runs in Node (tools/test/rng.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  hashString: [() => hashString, v => (hashString = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRandom: [() => mapgenRandom, v => (mapgenRandom = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- random numbers: a hash of (seed, salt) starts a small fast generator (sfc32) ---------- */
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
/** a random stream for a seed and a salt: next() in [0,1), range, int, chance, pick (by weight), gauss */
export function mapgenRandom(seed, salt = '') {
  let a = hashString(`${seed}|${salt}|a`),
    b = hashString(`${seed}|${salt}|b`),
    c = hashString(`${seed}|${salt}|c`),
    d = 1;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const R = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: p => next() < p,
    /** @param {Record<string, number>} W */
    pick: W => {
      const ks = Object.keys(W).filter(k => W[k] > 0);
      let s = 0;
      for (const k of ks) s += W[k];
      let r = next() * s;
      for (const k of ks) if ((r -= W[k]) < 0) return k;
      return ks[ks.length - 1];
    },
    gauss: () => {
      const u = Math.max(1e-9, next()),
        v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return R;
}

/* value noise on a lattice, from an integer hash (no sin hash: the same in every engine) */
