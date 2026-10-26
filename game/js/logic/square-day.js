// @ts-check
'use strict';
/* ================= THE SQUARE'S DAY (hub track HB-10c) =================
   Copperleaf's square through the day: where its townsfolk stop and when (a morning market, a busy midday, a quiet
   lantern evening; rules.json square.day), how many are drawn at once (the Engine's quality.townFolk), and the ranch's
   Billies who walk over from the pasture by day to visit (rules.json square.visit).
   Stops: points by the square's furniture, the props HB-10b laid round its rim (marked `sq`), each with the point it
   faces: behind a stall (keep) and in front of it (shop), by a bench or under the canopy (sit), under a lamp or the
   string lights (lamp), round the fountain's basin (fountain). The edges fill first (Gehl): every stop but the
   fountain's stands near the rim, so the middle stays walkable.
   Who goes: in each slot of the day a share of the town's folk, picked by a hash of the slot and the person (the same
   people every day), each with a rank that picks a stop by the slot's kinds in turn.
   Logic only: no DOM, runs in Node (tools/test/square-day.test.mjs). */
/** @typedef {[number, number]} Pt */
/** @typedef {{ k: string, x: number, z: number, fx: number, fz: number }} SquareStop  a point to stand on, the point
 * it faces */
/** @typedef {{ k: string, from: number, to: number, share: number, stops: string[] }} SquareSlot */
/** @typedef {{ uid: string, at: number, stay: number, stop: number }} SquareVisit  who visits, when they leave the
 * pasture (s into the block), how long they stay, which visitor stop */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hashString, rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  SQUARE_FOUNTAIN_N: [() => SQUARE_FOUNTAIN_N],
  SQUARE_FOUNTAIN_R: [() => SQUARE_FOUNTAIN_R],
  SQUARE_STANDS: [() => SQUARE_STANDS],
  // @ts-expect-error -- replaced on purpose
  folkCap: [() => folkCap, v => (folkCap = v)],
  // @ts-expect-error -- replaced on purpose
  squareGoers: [() => squareGoers, v => (squareGoers = v)],
  // @ts-expect-error -- replaced on purpose
  squareMiddle: [() => squareMiddle, v => (squareMiddle = v)],
  squareRound: [() => squareRound],
  // @ts-expect-error -- replaced on purpose
  squareSlot: [() => squareSlot, v => (squareSlot = v)],
  // @ts-expect-error -- replaced on purpose
  squareStopFor: [() => squareStopFor, v => (squareStopFor = v)],
  // @ts-expect-error -- replaced on purpose
  squareStops: [() => squareStops, v => (squareStops = v)],
  // @ts-expect-error -- replaced on purpose
  squareVisitAt: [() => squareVisitAt, v => (squareVisitAt = v)],
  // @ts-expect-error -- replaced on purpose
  squareVisits: [() => squareVisits, v => (squareVisits = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** where each kind of stop stands from its prop, along the line from the square's middle through the prop (m: + is
 * further out, - nearer the middle), and the prop kinds that give it */
export const SQUARE_STANDS = Object.freeze({
  stall: [
    ['keep', 0.9],
    ['shop', -1.4],
  ],
  market_cart: [
    ['keep', 0.9],
    ['shop', -1.4],
  ],
  bench_wood: [['sit', -0.7]],
  solar_canopy: [['sit', -0.3]],
  streetlamp: [['lamp', -0.7]],
  string_lights: [['lamp', -0.5]],
});
/** the stops round the fountain: how far from its middle (its basin is 1.75 m round) and how many */
export const SQUARE_FOUNTAIN_R = 2.6,
  SQUARE_FOUNTAIN_N = 6;

export const squareRound = (/** @type {number} */ v) => Math.round(v * 100) / 100;

/** the square's middle: the fountain among its props, or null when the map has no square (no `sq` props)
 * @param {any[]} props @returns {Pt | null} */
export function squareMiddle(props) {
  const sq = props.filter(p => p && p.sq);
  if (!sq.length) return null;
  const mx = sq.reduce((a, p) => a + p.x, 0) / sq.length,
    mz = sq.reduce((a, p) => a + p.z, 0) / sq.length;
  /** @type {any} */
  let best = null,
    d = 1e9;
  for (const p of props)
    if (p && p.k === 'fountain') {
      const e = Math.hypot(p.x - mx, p.z - mz);
      if (e < d) [best, d] = [p, e];
    }
  return best ? [best.x, best.z] : [squareRound(mx), squareRound(mz)];
}

/** the square's stops, from its props (in their order), then round the fountain
 * @param {any[]} props @returns {SquareStop[]} */
export function squareStops(props) {
  const mid = squareMiddle(props);
  if (!mid) return [];
  const [cx, cz] = mid,
    /** @type {SquareStop[]} */
    out = [];
  for (const p of props) {
    const S = p && p.sq && SQUARE_STANDS[/** @type {keyof typeof SQUARE_STANDS} */ (p.k)];
    if (!S) continue;
    const dx = p.x - cx,
      dz = p.z - cz,
      l = Math.hypot(dx, dz) || 1,
      ux = dx / l,
      uz = dz / l;
    for (const [k, d] of S) {
      const x = squareRound(p.x + ux * d),
        z = squareRound(p.z + uz * d);
      /* a shopper faces the stall; everyone else faces the middle */
      out.push(k === 'shop' ? { k, x, z, fx: p.x, fz: p.z } : { k, x, z, fx: cx, fz: cz });
    }
  }
  for (let i = 0; i < SQUARE_FOUNTAIN_N; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / SQUARE_FOUNTAIN_N;
    out.push({
      k: 'fountain',
      x: squareRound(cx + Math.cos(a) * SQUARE_FOUNTAIN_R),
      z: squareRound(cz + Math.sin(a) * SQUARE_FOUNTAIN_R),
      fx: cx,
      fz: cz,
    });
  }
  return out;
}

/** the slot of the square's day at hour h (0-24, wraps), or null between slots
 * @param {SquareSlot[]} day @param {number} h @returns {SquareSlot | null} */
export function squareSlot(day, h) {
  h = ((h % 24) + 24) % 24;
  return day.find(s => h >= s.from && h < s.to) || null;
}

/** who of a town's n folk go to the square in a slot: person index -> rank (0 first), round(share * n) of them,
 * picked by a hash of the town's seed, the slot and the person (the same people each day)
 * @param {number} n @param {SquareSlot} slot @param {number | string} seed @returns {Map<number, number>} */
export function squareGoers(n, slot, seed) {
  const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => hashString(`${seed}|${slot.k}|${a}`) - hashString(`${seed}|${slot.k}|${b}`) || a - b
    ),
    m = Math.min(n, Math.round(slot.share * n)),
    out = new Map();
  for (let r = 0; r < m; r++) out.set(order[r], r);
  return out;
}

/** a goer's stop: the slot's kinds taken in turn by rank (rank 0 the first kind's first stop, rank 1 the second
 * kind's first...), round again when a kind runs out; null when the square has none of the kinds
 * @param {SquareStop[]} stops @param {SquareSlot} slot @param {number} rank @returns {SquareStop | null} */
export function squareStopFor(stops, slot, rank) {
  const kinds = slot.stops.filter(k => stops.some(s => s.k === k));
  if (!kinds.length) return null;
  const L = stops.filter(s => s.k === kinds[rank % kinds.length]);
  return L[Math.floor(rank / kinds.length) % L.length];
}

/** how many townsfolk are drawn at once: `most` (the Engine's quality.townFolk), fewer once the game has stepped its
 * quality down (q 2 or more: frames came late, 0.6 of it) or on the Balanced graphics (aim smooth, 0.8 of it); the
 * rest keep their day unseen
 * @param {number} most @param {number} q @param {string} [aim] @returns {number} */
export function folkCap(most, q, aim) {
  most = Math.max(0, Math.round(most));
  return q >= 2 ? Math.round(most * 0.6) : aim === 'smooth' ? Math.round(most * 0.8) : most;
}

/** the visits in one block of `V.every` seconds (block b: the seconds from b * every): 1 to V.most of the Billies
 * (uids, most fit first) picked by the block, each leaving the pasture at its own time so the whole visit (the walk
 * there, the stay, the walk back: `walk` seconds each way) ends inside the block; none when the hour h the block
 * starts at is outside V.from-V.to or no one is at home
 * @param {number} b @param {string[]} uids @param {{ most: number, from: number, to: number, every: number,
 * stay: [number, number] }} V @param {number} h @param {number} walk @returns {SquareVisit[]} */
export function squareVisits(b, uids, V, h, walk) {
  h = ((h % 24) + 24) % 24;
  if (!uids.length || V.most < 1 || h < V.from || h >= V.to) return [];
  const rnd = rngFrom(b, 'square|visit'),
    room = V.every - 2 * walk - 10;
  if (room < V.stay[0]) return [];
  const pool = uids.slice(),
    n = Math.min(pool.length, rnd.int(1, V.most)),
    /** @type {SquareVisit[]} */
    out = [];
  for (let i = 0; i < n; i++) {
    const uid = pool.splice(rnd.int(0, pool.length - 1), 1)[0],
      stay = Math.round(Math.min(room, rnd.range(V.stay[0], V.stay[1]))),
      at = Math.round(rnd.range(0, room - stay));
    out.push({ uid, at, stay, stop: i });
  }
  return out;
}

/** where a visit is t seconds into its block: on the way there (s: metres walked from the pasture's gate), at the
 * square, on the way back (s: metres left to the gate), or null (at home in the pasture)
 * @param {SquareVisit} v @param {number} t @param {number} walk seconds each way @param {number} len metres each way
 * @returns {{ leg: 'there' | 'stay' | 'back', s: number } | null} */
export function squareVisitAt(v, t, walk, len) {
  const u = t - v.at;
  if (u < 0 || u >= 2 * walk + v.stay) return null;
  if (u < walk) return { leg: 'there', s: (u / walk) * len };
  if (u < walk + v.stay) return { leg: 'stay', s: len };
  return { leg: 'back', s: ((2 * walk + v.stay - u) / walk) * len };
}
