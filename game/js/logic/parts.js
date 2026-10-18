// @ts-check
'use strict';
/* ================= PARTS (phase 16) =================
   The arithmetic of part sizes, shared by the game (rules.js) and the Studio's Parts section, so both show the same
   numbers. P is rules.json "parts"; a build is { head: 'M', body: 'L', ... }. Logic only: no DOM, runs in Node. */
/** @import { PartRules } from '../../types/game-data' */
/** @import { Build } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  partsLean: [() => partsLean, v => (partsLean = v)],
  // @ts-expect-error -- replaced on purpose
  partsPrime: [() => partsPrime, v => (partsPrime = v)],
  // @ts-expect-error -- replaced on purpose
  partsPrimeOdds: [() => partsPrimeOdds, v => (partsPrimeOdds = v)],
  // @ts-expect-error -- replaced on purpose
  partsStatFactor: [() => partsStatFactor, v => (partsStatFactor = v)],
  // @ts-expect-error -- replaced on purpose
  partsWeightRatio: [() => partsWeightRatio, v => (partsWeightRatio = v)],
  // @ts-expect-error -- replaced on purpose
  weightClass: [() => weightClass, v => (weightClass = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @param {PartRules | undefined} P @param {Build | undefined} b */
export function partsPrime(P, b) {
  if (!P) return true;
  return P.slots.every(k => (b ? b[k] || 'M' : 'M') === 'M');
}
/** @param {PartRules | undefined} P @param {Build | undefined} b the weight as a share of the species' own (1 = all M) */
export function partsWeightRatio(P, b) {
  if (!P) return 1;
  let w = 0,
    tot = 0;
  for (const k of P.slots) {
    const sh = P.share[k] ?? 0,
      sz = P.sizes[(b && b[k]) || 'M'] || P.sizes.M;
    w += sh * sz.weight;
    tot += sh;
  }
  return tot ? w / tot : 1;
}
/** @param {PartRules | undefined} P @param {Build | undefined} b @param {string} k a stat id @returns {number} */
export function partsStatFactor(P, b, k) {
  if (!P) return 1;
  const w = partsWeightRatio(P, b),
    cap = P.cap ?? 0.2,
    clampF = (/** @type {number} */ f) => Math.min(1 + cap, Math.max(1 - cap, f));
  let f = 1;
  if (k === 'lev' || k === 'lob') f = clampF(Math.pow(w, P.attackExp));
  else if (k === 'hus') f = clampF(Math.pow(w, P.speedExp));
  if (partsPrime(P, b)) f *= 1 + (P.primeBonus || 0);
  return f;
}
/** phase 06: which way a build leans, for the balance meter in a Billie's (or bot's) Build tab. attack and speed are the
 * changes from weight alone (0.09 = +9%), before Prime's bonus; lean runs from -1 (all speed) to 1 (all attack); off
 * is how many parts are not at normal size.
 * @param {PartRules | undefined} P @param {Build | undefined} b
 * @returns {{ attack: number, speed: number, lean: number, off: number, prime: boolean }} */
export function partsLean(P, b) {
  if (!P) return { attack: 0, speed: 0, lean: 0, off: 0, prime: true };
  const w = partsWeightRatio(P, b),
    cap = P.cap ?? 0.2,
    clampF = (/** @type {number} */ f) => Math.min(1 + cap, Math.max(1 - cap, f)),
    attack = clampF(Math.pow(w, P.attackExp)) - 1,
    speed = clampF(Math.pow(w, P.speedExp)) - 1,
    off = P.slots.filter(k => ((b && b[k]) || 'M') !== 'M').length;
  return {
    attack,
    speed,
    lean: cap ? Math.max(-1, Math.min(1, (attack - speed) / (2 * cap))) : 0,
    off,
    prime: off === 0,
  };
}
/** @param {PartRules | undefined} P the chance a rolled build is Prime (every slot M) */
export function partsPrimeOdds(P) {
  if (!P || !P.sizes.M) return 0;
  const tot = Object.values(P.sizes).reduce((a, s) => a + (s.odds || 0), 0) || 1;
  return Math.pow((P.sizes.M.odds || 0) / tot, P.slots.length);
}
/** a weight class for the player, from a weight in kg */
export function weightClass(/** @type {number} */ kg) {
  return kg < 5 ? 'Feather' : kg < 30 ? 'Light' : kg < 120 ? 'Medium' : kg < 400 ? 'Heavy' : 'Super-heavy';
}
